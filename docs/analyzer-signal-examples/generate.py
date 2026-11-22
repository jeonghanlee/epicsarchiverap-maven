#!/usr/bin/env python3
"""Generate physical signal examples from explicit, synthetic model parameters."""

import argparse
import csv
import html
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


ROOT = Path(__file__).resolve().parent
SCENARIOS = {
    "beam_current": ("Stored beam current", "Decay, top-off injections, missed injections, and a partial loss"),
    "bpm": ("BPM position", "Temperature-related drift and a separate fast vibration waveform"),
    "magnet_supply": ("Magnet current", "Command tracking and ripple on constant-current plateaus"),
    "rf_cavity": ("RF cavity envelope", "Filling, flat top, decay, detuning, and an early RF trip"),
    "vacuum": ("Vacuum pressure", "Outgassing slopes, a persistent leak floor, and a recoverable burst"),
    "temperature": ("Temperature response", "Dead time, response time constants, and a missing interval"),
    "photon_counts": ("Photon counts", "Poisson fluctuations, shutter closure, and attenuation"),
    "camera": ("Camera beam image", "Spatial drift, broadening, and ADC saturation"),
}
PLOT_STYLE = {
    "font.family": "DejaVu Sans", "font.size": 10,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.alpha": 0.18,
    "axes.prop_cycle": plt.cycler(color=["#1565a8", "#e07a24", "#338369", "#a34a72"]),
    "figure.facecolor": "#ffffff", "savefig.facecolor": "#ffffff",
}


def native(value):
    if isinstance(value, np.ndarray):
        return native(value.tolist())
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, dict):
        return {key: native(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [native(item) for item in value]
    return value


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(native(value), separators=(",", ":"), allow_nan=False) + "\n")


def table(kind, axis, columns, **metadata):
    """Columns contain name, unit, role, and values; roles separate truth from observations."""
    return {
        "kind": kind, "axis": axis, **metadata,
        "columns": [{"name": key, "unit": unit, "role": role} for key, unit, role, _ in columns],
        "data": {key: native(values) for key, _, _, values in columns},
    }


def beam_current(p, rng):
    t = np.arange(0, p["duration_s"] + p["sample_interval_s"], p["sample_interval_s"])
    truth = np.empty(len(t))
    injected = np.zeros(len(t))
    missed = np.zeros(len(t), dtype=int)
    truth[0] = p["target_mA"]
    for i in range(1, len(t)):
        truth[i] = truth[i - 1] * np.exp(-(t[i] - t[i - 1]) / p["lifetime_s"])
        if t[i] == p["partial_loss_s"]:
            truth[i] *= 1 - p["loss_fraction"]
        elif t[i] % p["injection_period_s"] == 0:
            if t[i] in p["missed_injection_s"]:
                missed[i] = 1
            else:
                injected[i] = min(p["target_mA"] - truth[i], p["recovery_limit_mA_per_injection"])
                truth[i] += injected[i]
    current = truth + rng.normal(0, p["noise_rms_mA"], len(t))
    return {"current": table("time_series", "elapsed_s", [
        ("elapsed_s", "s", "axis", t), ("current_mA", "mA", "observation", current),
        ("injected_mA", "mA", "event_truth", injected),
        ("missed_injection", "boolean", "event_truth", missed),
        ("truth_current_mA", "mA", "model_truth", truth),
    ])}, {}, [
        {"name": "missed_injection", "elapsed_s": at} for at in p["missed_injection_s"]
    ] + [{"name": "partial_loss", "elapsed_s": p["partial_loss_s"], "fraction": p["loss_fraction"]}]


def bpm(p, rng):
    t = np.arange(0, p["slow_duration_s"] + p["slow_interval_s"], p["slow_interval_s"])
    temp = p["temperature_baseline_degC"] + p["temperature_amplitude_degC"] * np.sin(
        2 * np.pi * t / p["temperature_period_s"])
    delayed = p["temperature_amplitude_degC"] * np.sin(
        2 * np.pi * (t - p["response_delay_s"]) / p["temperature_period_s"])
    x = p["sensitivity_um_per_degC"][0] * delayed
    y = p["sensitivity_um_per_degC"][1] * delayed
    slow = table("time_series", "elapsed_s", [
        ("elapsed_s", "s", "axis", t), ("temperature_degC", "degC", "observation", temp),
        ("bpm_x_um", "um", "observation", x + rng.normal(0, p["slow_noise_rms_um"], len(t))),
        ("bpm_y_um", "um", "observation", y + rng.normal(0, p["slow_noise_rms_um"], len(t))),
        ("truth_x_um", "um", "model_truth", x), ("truth_y_um", "um", "model_truth", y),
    ])
    ft = np.arange(int(p["fast_duration_s"] * p["fast_sample_rate_Hz"])) / p["fast_sample_rate_Hz"]
    active = (ft >= p["disturbance_start_s"]) & (ft < p["disturbance_end_s"])
    gain = np.where(active, p["disturbance_multiplier"], 1)
    fx = np.zeros(len(ft))
    fy = np.zeros(len(ft))
    for f, a in zip(p["frequencies_Hz"], p["amplitudes_um"]):
        fx += a * gain * np.sin(2 * np.pi * f * ft)
        fy += 0.7 * a * gain * np.sin(2 * np.pi * f * ft + 0.3)
    fast = table("time_waveform", "elapsed_s", [
        ("elapsed_s", "s", "axis", ft),
        ("bpm_x_um", "um", "observation", fx + rng.normal(0, p["fast_noise_rms_um"], len(ft))),
        ("bpm_y_um", "um", "observation", fy + rng.normal(0, p["fast_noise_rms_um"], len(ft))),
        ("truth_x_um", "um", "model_truth", fx),
    ], acquisition="Independent fast capture; not interpolated from the slow archive")
    return {"slow": slow, "fast": fast}, {}, [
        {"table": "fast", "name": "vibration_increase", "start_s": p["disturbance_start_s"],
         "end_s": p["disturbance_end_s"]}]


def magnet_supply(p, rng):
    dt = 1 / p["sample_rate_Hz"]
    t = np.arange(int(p["duration_s"] * p["sample_rate_Hz"])) * dt
    command = np.interp(t, [0, p["ramp_start_s"], p["ramp_end_s"], p["duration_s"]],
                        [p["initial_A"], p["initial_A"], p["final_A"], p["final_A"]])
    response = np.empty(len(t))
    response[0] = p["initial_A"]
    decay = np.exp(-dt / p["response_time_s"])
    for i in range(1, len(t)):
        response[i] = decay * response[i - 1] + (1 - decay) * command[i - 1]
    gain = np.where(t >= p["degraded_start_s"], p["degraded_multiplier"], 1)
    ripple = sum(a * np.sin(2 * np.pi * f * t)
                 for f, a in zip(p["ripple_frequencies_Hz"], p["ripple_amplitudes_A"])) * gain
    measured = response + ripple + rng.normal(0, p["noise_rms_A"], len(t))
    return {"current": table("time_waveform", "elapsed_s", [
        ("elapsed_s", "s", "axis", t), ("setpoint_A", "A", "command", command),
        ("readback_A", "A", "observation", measured),
        ("tracking_error_A", "A", "derived", measured - command),
        ("truth_response_A", "A", "model_truth", response),
        ("truth_ripple_A", "A", "model_truth", ripple),
    ])}, {}, [{"name": "ripple_increase", "elapsed_s": p["degraded_start_s"]}]


def rf_cavity(p, rng):
    t = np.arange(0, p["duration_us"] + p["sample_interval_us"], p["sample_interval_us"])
    fill_drive = p["target_MV"] / (1 - np.exp(-p["fill_end_us"] / p["time_constant_us"]))
    tables = {}
    captures = [("normal", p["pulse_end_us"], 0), ("trip", p["trip_us"], 0),
                ("detuned", p["pulse_end_us"], p["detuning_Hz"])]
    for capture_id, (name, end, detuning) in enumerate(captures):
        drive = np.where(t < p["fill_end_us"], fill_drive, p["target_MV"])
        drive[t >= end] = 0
        pole = 1 + 1j * 2 * np.pi * detuning * p["time_constant_us"] * 1e-6
        decay = np.exp(-pole * p["sample_interval_us"] / p["time_constant_us"])
        voltage = np.zeros(len(t), dtype=complex)
        for i in range(1, len(t)):
            voltage[i] = decay * voltage[i - 1] + (1 - decay) * drive[i - 1] / pole
        iq = voltage + p["iq_noise_rms_MV"] * (
            rng.normal(size=len(t)) + 1j * rng.normal(size=len(t)))
        tables[name] = table("time_waveform", "pulse_time_us", [
            ("pulse_time_us", "us", "axis", t), ("drive_MV", "MV", "command", drive),
            ("i_MV", "MV", "observation", iq.real), ("q_MV", "MV", "observation", iq.imag),
            ("amplitude_MV", "MV", "derived", np.abs(iq)),
            ("truth_amplitude_MV", "MV", "model_truth", np.abs(voltage)),
        ], capture_elapsed_s=capture_id, detuning_Hz=detuning)
    return tables, {}, [{"table": "trip", "name": "rf_drive_off", "pulse_time_us": p["trip_us"]}]


def vacuum(p, rng):
    t = np.arange(0, p["duration_s"] + p["sample_interval_s"], p["sample_interval_s"])
    clean = p["initial_pressure_mbar"] / (1 + t / p["time_offset_s"]) + p["base_pressure_mbar"]
    polymer = p["initial_pressure_mbar"] / np.sqrt(1 + t / p["time_offset_s"]) + p["base_pressure_mbar"]
    leak = clean + p["leak_floor_mbar"]
    burst = clean + np.where(t >= p["burst_start_s"], p["burst_amplitude_mbar"] * np.exp(
        -np.maximum(t - p["burst_start_s"], 0) / p["burst_decay_s"]), 0)
    columns = [("elapsed_s", "s", "axis", t)]
    for name, ideal in [("metal", clean), ("polymer", polymer), ("leak", leak), ("burst", burst)]:
        noise = np.exp(rng.normal(-p["relative_noise_rms"] ** 2 / 2, p["relative_noise_rms"], len(t)))
        columns.append((name + "_mbar", "mbar", "observation", ideal * noise))
    columns.append(("truth_metal_mbar", "mbar", "model_truth", clean))
    return {"pressure": table("time_series", "elapsed_s", columns)}, {}, [
        {"name": "gas_burst", "elapsed_s": p["burst_start_s"]}]


def temperature(p, rng):
    t = np.arange(0, p["duration_s"] + p["sample_interval_s"], p["sample_interval_s"])
    age = np.maximum(t - p["step_s"] - p["delay_s"], 0)
    command = p["initial_degC"] + p["step_degC"] * (t >= p["step_s"])
    normal = p["initial_degC"] + p["step_degC"] * (1 - np.exp(-age / p["normal_tau_s"]))
    slow = p["initial_degC"] + p["step_degC"] * (1 - np.exp(-age / p["slow_tau_s"]))
    measured = (normal + rng.normal(0, p["noise_rms_degC"], len(t))).tolist()
    valid = (t < p["gap_start_s"]) | (t >= p["gap_end_s"])
    for i in np.flatnonzero(~valid):
        measured[i] = None
    return {"response": table("time_series", "elapsed_s", [
        ("elapsed_s", "s", "axis", t), ("setpoint_degC", "degC", "command", command),
        ("normal_degC", "degC", "observation", measured),
        ("normal_valid", "boolean", "quality", valid.astype(int)),
        ("slow_degC", "degC", "observation", slow + rng.normal(0, p["noise_rms_degC"], len(t))),
        ("truth_normal_degC", "degC", "model_truth", normal),
        ("truth_slow_degC", "degC", "model_truth", slow),
    ])}, {}, [{"name": "setpoint_step", "elapsed_s": p["step_s"]},
             {"name": "missing_observations", "start_s": p["gap_start_s"], "end_s": p["gap_end_s"]}]


def photon_counts(p, rng):
    start = np.arange(round(p["duration_s"] / p["exposure_s"])) * p["exposure_s"]
    shutter = (start < p["shutter_closed_start_s"]) | (start >= p["shutter_closed_end_s"])
    transmission = np.where(start >= p["attenuation_start_s"], p["attenuation_factor"], 1)
    mean = (p["source_rate_per_s"] * shutter * transmission + p["dark_rate_per_s"]) * p["exposure_s"]
    counts = rng.poisson(mean)
    return {"counts": table("time_series", "elapsed_s", [
        ("elapsed_s", "s", "axis", start + p["exposure_s"]),
        ("exposure_start_s", "s", "axis", start),
        ("exposure_s", "s", "acquisition", np.full(len(start), p["exposure_s"])),
        ("counts", "count", "observation", counts),
        ("count_rate_per_s", "count/s", "derived", counts / p["exposure_s"]),
        ("shutter_open", "boolean", "state", shutter.astype(int)),
        ("transmission", "1", "command", transmission),
        ("truth_mean_counts", "count", "model_truth", mean),
    ], timestamp_semantics="End of exposure")}, {}, [
        {"name": "shutter_closed", "start_s": p["shutter_closed_start_s"], "end_s": p["shutter_closed_end_s"]},
        {"name": "attenuation", "elapsed_s": p["attenuation_start_s"]}]


def camera(p, rng):
    yy, xx = np.mgrid[:p["height"], :p["width"]]
    times = np.concatenate([[0], np.cumsum(rng.uniform(
        p["nominal_interval_s"] - p["interval_jitter_s"],
        p["nominal_interval_s"] + p["interval_jitter_s"], p["frame_count"] - 1))])
    frames, stats, truths = [], [], []
    for i in range(p["frame_count"]):
        cx = p["initial_center_x_px"] + p["drift_x_px_per_frame"] * i
        sx = p["sigma_x_px"] + max(0, i - p["broadening_start_frame"] + 1) * p["sigma_x_increment_px"]
        peak = p["saturated_peak_adu"] if i >= p["saturation_start_frame"] else p["normal_peak_adu"]
        spot = peak * np.exp(-0.5 * (((xx - cx) / sx) ** 2 + ((yy - p["center_y_px"]) / p["sigma_y_px"]) ** 2))
        signal = rng.poisson(spot / p["gain_adu_per_detected_photon"]) * p["gain_adu_per_detected_photon"]
        image = np.clip(np.rint(signal + p["background_adu"] + rng.normal(
            0, p["read_noise_rms_adu"], xx.shape)), 0, p["adc_max_adu"]).astype(int)
        weights = np.where(image >= p["centroid_threshold_adu"], image, 0)
        mx, my = np.sum(weights * xx) / weights.sum(), np.sum(weights * yy) / weights.sum()
        measured_sx = np.sqrt(np.sum(weights * (xx - mx) ** 2) / weights.sum())
        measured_sy = np.sqrt(np.sum(weights * (yy - my) ** 2) / weights.sum())
        frames.append(image)
        stats.append([mx, my, measured_sx, measured_sy, np.count_nonzero(image == p["adc_max_adu"]), image.sum()])
        truths.append([cx, p["center_y_px"], sx, p["sigma_y_px"]])
    stats, truths, frames = np.array(stats), np.array(truths), np.array(frames)
    columns = [("elapsed_s", "s", "axis", times)]
    for i, (name, unit) in enumerate([
        ("centroid_x_px", "pixel"), ("centroid_y_px", "pixel"),
        ("sigma_x_px", "pixel"), ("sigma_y_px", "pixel"),
        ("saturated_pixels", "pixel_count"), ("total_adu", "ADU")]):
        columns.append((name, unit, "derived", stats[:, i]))
    for i, name in enumerate(["center_x_px", "center_y_px", "sigma_x_px", "sigma_y_px"]):
        columns.append(("truth_" + name, "pixel", "model_truth", truths[:, i]))
    tables = {"statistics": table("time_series", "elapsed_s", columns)}
    for i in [0, p["broadening_start_frame"], p["frame_count"] - 1]:
        for axis, size, projection in [("x", p["width"], frames[i].mean(axis=0)),
                                       ("y", p["height"], frames[i].mean(axis=1))]:
            tables[f"profile_{axis}_{i:03d}"] = table("spatial_profile", "position_px", [
                ("position_px", "pixel", "axis", np.arange(size)),
                ("position_um", "um", "calibrated_axis", np.arange(size) * p["pixel_scale_um"]),
                ("mean_intensity_adu", "ADU", "derived", projection),
            ], frame_index=i, frame_elapsed_s=times[i], projection="Mean along the other image axis")
        counts, edges = np.histogram(frames[i], bins=p["histogram_bins"], range=(0, p["adc_max_adu"] + 1))
        tables[f"histogram_{i:03d}"] = table("intensity_histogram", "bin_lower_adu", [
            ("bin_lower_adu", "ADU", "axis", edges[:-1]),
            ("bin_upper_adu", "ADU", "axis", edges[1:]),
            ("pixel_count", "pixel_count", "derived", counts),
        ], frame_index=i, frame_elapsed_s=times[i], bins="Left-inclusive, right-exclusive; last bin includes right edge")
    arrays = {"images": {"dimension_order": ["frame", "y", "x"], "shape": list(frames.shape),
                         "unit": "ADU", "frame_elapsed_s": times, "values": frames}}
    return tables, arrays, [{"name": "broadening", "frame_index": p["broadening_start_frame"]},
                           {"name": "adc_saturation", "frame_index": p["saturation_start_frame"]}]


def save_scenario(root, key, model, config, result):
    tables, arrays, events = result
    document = {
        "schema": "analyzer-synthetic-signals-1", "scenario": key, "synthetic": True,
        "title": SCENARIOS[key][0], "source_ids": model["source_ids"], "parameters": model,
        "time_origin_utc": config["time_origin_utc"], "parameter_policy": config["parameter_policy"],
        "tables": tables, "arrays": arrays, "events": events,
    }
    write_json(root / "data" / f"{key}.json", document)
    directory = root / "data" / key
    directory.mkdir(parents=True, exist_ok=True)
    for name, item in tables.items():
        with (directory / f"{name}.csv").open("w", newline="") as stream:
            writer = csv.writer(stream)
            writer.writerow(item["data"])
            writer.writerows(zip(*item["data"].values()))


def data(document, name):
    return {key: np.array(value, dtype=float) for key, value in document["tables"][name]["data"].items()}


def amplitude_spectrum(time, values):
    dt = np.diff(time)
    if not np.allclose(dt, dt[0], rtol=1e-8, atol=1e-12):
        raise ValueError("Spectrum requires uniformly sampled data")
    window = np.hanning(len(values))
    transformed = np.abs(np.fft.rfft((values - np.mean(values)) * window)) / window.sum()
    transformed[1:-1] *= 2
    if len(values) % 2:
        transformed[-1] *= 2
    return np.fft.rfftfreq(len(values), dt[0]), transformed


def draw_main(ax, key, doc):
    if key == "beam_current":
        d = data(doc, "current")
        ax.plot(d["elapsed_s"] / 60, d["current_mA"], lw=1)
        for at in doc["parameters"]["missed_injection_s"]:
            ax.axvline(at / 60, color="#e07a24", alpha=0.5, lw=1)
        ax.axvline(doc["parameters"]["partial_loss_s"] / 60, color="#a34a72", ls="--", lw=1)
        ax.set(xlabel="Acquisition time (min)", ylabel="Stored current (mA)")
    elif key == "bpm":
        d = data(doc, "fast")
        ax.plot(d["elapsed_s"], d["bpm_x_um"], lw=0.3)
        ax.set(xlabel="Time within fast capture (s)", ylabel="Horizontal position (um)")
    elif key == "magnet_supply":
        d = data(doc, "current")
        selected = d["elapsed_s"] >= 5
        ax.plot(d["elapsed_s"][selected], d["tracking_error_A"][selected] * 1000, lw=0.35)
        ax.set(xlabel="Acquisition time (s); constant 110 A command", ylabel="Current error (mA)")
    elif key == "rf_cavity":
        for name in ["normal", "trip", "detuned"]:
            d = data(doc, name)
            ax.plot(d["pulse_time_us"] / 1000, d["amplitude_MV"], label=name, lw=1.2)
        ax.set(xlabel="Time within pulse (ms)", ylabel="Cavity envelope (MV)")
        ax.legend(fontsize=8)
    elif key == "vacuum":
        d = data(doc, "pressure")
        for name in ["metal", "polymer", "leak", "burst"]:
            ax.loglog(d["elapsed_s"][1:] / 3600, d[name + "_mbar"][1:], label=name, lw=1)
        ax.set(xlabel="Elapsed pumping time (h)", ylabel="Pressure (mbar)")
        ax.legend(fontsize=8)
    elif key == "temperature":
        d = data(doc, "response")
        for name, label in [("setpoint_degC", "command"), ("normal_degC", "tau = 120 s"), ("slow_degC", "tau = 240 s")]:
            ax.plot(d["elapsed_s"] / 60, d[name], label=label, lw=1)
        ax.axvspan(doc["parameters"]["gap_start_s"] / 60, doc["parameters"]["gap_end_s"] / 60,
                   color="#999999", alpha=0.2)
        ax.set(xlabel="Acquisition time (min)", ylabel="Temperature (degC)")
        ax.legend(fontsize=8)
    elif key == "photon_counts":
        d = data(doc, "counts")
        ax.plot(d["elapsed_s"], d["counts"], lw=0.4, alpha=0.65, label="observed counts")
        ax.plot(d["elapsed_s"], d["truth_mean_counts"], lw=1.5, color="#e07a24", label="model mean")
        ax.set(xlabel="Exposure end time (s)", ylabel="Detections per 0.1 s exposure")
        ax.legend(fontsize=8)
    else:
        frame = np.array(doc["arrays"]["images"]["values"])[-1]
        im = ax.imshow(frame, origin="lower", cmap="magma", vmin=0, vmax=doc["parameters"]["adc_max_adu"])
        ax.figure.colorbar(im, ax=ax, label="Intensity (ADU)", fraction=0.04, pad=0.02)
        ax.set(xlabel="Image X (pixel)", ylabel="Image Y (pixel)")
        ax.grid(False)


def draw_detail(axes, key, doc):
    ax = axes[0]
    if key == "bpm":
        d = data(doc, "slow")
        ax.plot(d["elapsed_s"] / 3600, d["bpm_x_um"], label="BPM X")
        ax.plot(d["elapsed_s"] / 3600, d["bpm_y_um"], label="BPM Y")
        ax.set(xlabel="Acquisition time (h)", ylabel="Position (um)")
        ax.legend()
        d = data(doc, "fast")
        for start, end in [(0, 4), (4, 6)]:
            take = (d["elapsed_s"] >= start) & (d["elapsed_s"] < end)
            f, a = amplitude_spectrum(d["elapsed_s"][take], d["bpm_x_um"][take])
            axes[1].semilogy(f, a, label=f"{start}-{end} s")
        axes[1].set(xlim=(0, 150), xlabel="Frequency (Hz)", ylabel="Peak amplitude (um)")
        axes[1].legend()
    elif key == "magnet_supply":
        d = data(doc, "current")
        ax.plot(d["elapsed_s"], d["setpoint_A"], label="command")
        ax.plot(d["elapsed_s"], d["readback_A"], label="readback", lw=0.7)
        ax.set(xlabel="Acquisition time (s)", ylabel="Current (A)")
        ax.legend()
        for start, end in [(5, 7), (7, 9)]:
            take = (d["elapsed_s"] >= start) & (d["elapsed_s"] < end)
            f, a = amplitude_spectrum(d["elapsed_s"][take], d["tracking_error_A"][take] * 1000)
            axes[1].semilogy(f, a, label=f"{start}-{end} s")
        axes[1].set(xlim=(0, 150), xlabel="Frequency (Hz)", ylabel="Peak ripple (mA)")
        axes[1].legend()
    elif key == "camera":
        p = doc["parameters"]
        for i in [0, p["broadening_start_frame"], p["frame_count"] - 1]:
            d = data(doc, f"profile_x_{i:03d}")
            ax.plot(d["position_px"], d["mean_intensity_adu"], label=f"Frame {i}")
        ax.set(xlabel="Image X (pixel)", ylabel="Mean Y projection (ADU)")
        ax.legend()
        d = data(doc, "statistics")
        axes[1].plot(d["elapsed_s"], d["centroid_x_px"], "o-", ms=3, label="measured centroid")
        axes[1].plot(d["elapsed_s"], d["truth_center_x_px"], "--", label="model center")
        axes[1].set(xlabel="Frame acquisition time (s)", ylabel="Image X (pixel)")
        axes[1].legend()


def render(root):
    plt.rcParams.update(PLOT_STYLE)
    directory = root / "plots"
    directory.mkdir(parents=True, exist_ok=True)
    overview, overview_axes = plt.subplots(4, 2, figsize=(15, 16), layout="constrained")
    overview.suptitle("Physical signal examples | SYNTHETIC DATA\nReference-based phenomena; all model values are illustrative", fontsize=18)
    cards, inventory = [], []
    for (key, (title, description)), overview_ax in zip(SCENARIOS.items(), overview_axes.flat):
        doc = json.loads((root / "data" / f"{key}.json").read_text())
        draw_main(overview_ax, key, doc)
        overview_ax.set_title(title, loc="left", fontweight="bold")
        detailed = key in {"bpm", "magnet_supply", "camera"}
        fig, axes = plt.subplots(3 if detailed else 1, 1, figsize=(11, 10 if detailed else 4.5),
                                 squeeze=False, layout="constrained")
        fig.suptitle(f"{title} | SYNTHETIC\n{description}")
        draw_main(axes[0, 0], key, doc)
        if detailed:
            draw_detail(axes[1:, 0], key, doc)
        fig.savefig(directory / f"{key}.png", dpi=140)
        plt.close(fig)
        csv_links = " ".join(f'<a href="data/{key}/{name}.csv">{name}.csv</a>' for name in doc["tables"])
        cards.append(f'<article><h2>{html.escape(title)}</h2><p>{html.escape(description)}</p>'
                     f'<a href="plots/{key}.png"><img src="plots/{key}.png" alt="{html.escape(title)}"></a>'
                     f'<p><a href="data/{key}.json">Complete JSON with units and metadata</a></p>'
                     f'<p class="downloads">{csv_links}</p></article>')
        inventory.append({"scenario": key, "json": f"data/{key}.json", "source_ids": doc["source_ids"],
                          "table_rows": {name: len(next(iter(item["data"].values()))) for name, item in doc["tables"].items()},
                          "array_shapes": {name: item["shape"] for name, item in doc["arrays"].items()}})
    overview.savefig(directory / "overview.png", dpi=120)
    plt.close(overview)
    write_json(root / "inventory.json", inventory)
    page = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    page += '<title>Synthetic physical signal examples</title><style>body{margin:32px auto;max-width:1150px;padding:0 20px;font:16px/1.5 system-ui;color:#223244;background:#f4f6f8}h1{line-height:1.2}article{background:white;border:1px solid #d9e1e8;border-radius:10px;padding:24px;margin:24px 0}img{max-width:100%;height:auto}a{color:#1565a8}.downloads a{display:inline-block;margin:4px 12px 4px 0}header{padding:12px 0}</style>'
    page += '<header><h1>Physical signal examples</h1><p><strong>SYNTHETIC DATA.</strong> Eight physical signal families informed by ten primary references. Values and events are model choices, not facility measurements.</p><p><a href="README.md">Signal meaning, analysis questions, and sources</a> | <a href="models.json">Model parameters</a> | <a href="plots/overview.png">Overview</a> | <a href="verification.json">Validation results</a></p></header>'
    page += "".join(cards) + '</html>\n'
    (root / "index.html").write_text(page)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT)
    args = parser.parse_args()
    config = json.loads((ROOT / "models.json").read_text())
    args.output.mkdir(parents=True, exist_ok=True)
    if args.output.resolve() != ROOT:
        for name in ["README.md", "models.json"]:
            (args.output / name).write_bytes((ROOT / name).read_bytes())
    builders = [beam_current, bpm, magnet_supply, rf_cavity, vacuum, temperature, photon_counts, camera]
    for i, (key, builder) in enumerate(zip(SCENARIOS, builders)):
        rng = np.random.default_rng(np.random.SeedSequence([config["seed"], i]))
        save_scenario(args.output, key, config[key], config, builder(config[key], rng))
    render(args.output)
    print(f"Generated {len(SCENARIOS)} synthetic signal families in {args.output}")


if __name__ == "__main__":
    main()
