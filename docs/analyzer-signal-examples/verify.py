#!/usr/bin/env python3
"""Measure the saved synthetic observations and validate their exported data."""

import argparse
import csv
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.optimize import curve_fit
from scipy.signal import periodogram, find_peaks


ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    docs = {path.stem: json.loads(path.read_text()) for path in sorted((args.root / "data").glob("*.json"))}
    checks = []

    def check(name, passed, observed, expected):
        checks.append({"name": name, "passed": bool(passed), "observed": observed, "expected": expected})

    def values(scenario, table):
        return {name: np.array(v, dtype=float) for name, v in docs[scenario]["tables"][table]["data"].items()}

    def parameter(scenario, name):
        return docs[scenario]["parameters"][name]

    check("scenario_count", len(docs) == 8, len(docs), 8)
    table_count = 0
    for scenario, doc in docs.items():
        assert doc["synthetic"] is True and doc["source_ids"] and doc["parameter_policy"]
        for name, table in doc["tables"].items():
            table_count += 1
            columns = table["data"]
            lengths = {len(v) for v in columns.values()}
            assert len(lengths) == 1 and next(iter(lengths)) > 0, (scenario, name, lengths)
            assert {c["name"] for c in table["columns"]} == set(columns)
            assert all(c["unit"] and c["role"] for c in table["columns"])
            axis = np.array(columns[table["axis"]])
            assert np.all(np.diff(axis) > 0), (scenario, name, "axis ordering")
            for key, vals in columns.items():
                assert all(v is None or np.isfinite(v) for v in vals), (scenario, name, key)
                if any(v is None for v in vals):
                    assert (scenario, name, key) == ("temperature", "response", "normal_degC")
            with (args.root / "data" / scenario / f"{name}.csv").open() as stream:
                rows = csv.DictReader(stream)
                assert rows.fieldnames == list(columns)
                count = 0
                for i, row in enumerate(rows):
                    for key, vals in columns.items():
                        got = None if row[key] == "" else float(row[key])
                        assert got == vals[i], (scenario, name, key, i)
                    count += 1
                assert count == len(axis)
    check("json_csv_units_axes_and_values", True, table_count, "All tables match exactly; axes increase and units are present")

    d = values("beam_current", "current")
    use = (d["elapsed_s"] > 1740) & (d["elapsed_s"] < 1980)
    lifetime = float(-1 / np.polyfit(d["elapsed_s"][use], np.log(d["current_mA"][use]), 1)[0])
    check("beam_lifetime_from_observations_h", abs(lifetime / parameter("beam_current", "lifetime_s") - 1) < 0.02,
          lifetime / 3600, "8 h within 2%, excluding injection samples")
    at = int(parameter("beam_current", "partial_loss_s"))
    i = int(np.flatnonzero(d["elapsed_s"] == at)[0])
    loss = float(1 - d["current_mA"][i] / d["current_mA"][i - 1])
    check("beam_partial_loss_fraction", abs(loss - 0.08) < 0.001, loss, "0.08 within 0.001")
    check("missed_injections", int(d["missed_injection"].sum()) == 3, int(d["missed_injection"].sum()), 3)

    d = values("bpm", "slow")
    lags = range(61)
    correlations = [np.corrcoef(d["temperature_degC"][:len(d["elapsed_s"]) - lag or None],
                               d["bpm_x_um"][lag:])[0, 1] for lag in lags]
    lag_s = int(np.argmax(correlations)) * parameter("bpm", "slow_interval_s")
    check("bpm_temperature_delay_s", abs(lag_s - 1800) <= 120, lag_s, "1800 s within 120 s")
    d = values("bpm", "fast")
    before = (d["elapsed_s"] >= 0) & (d["elapsed_s"] < 4)
    during = (d["elapsed_s"] >= 4) & (d["elapsed_s"] < 6)
    f, power = periodogram(d["bpm_x_um"][before], fs=parameter("bpm", "fast_sample_rate_Hz"), window="hann", scaling="spectrum")
    peaks, _ = find_peaks(power)
    strongest = sorted(float(v) for v in f[peaks[np.argsort(power[peaks])[-3:]]])
    check("bpm_dominant_frequencies_Hz", strongest == [12, 60, 120], strongest, [12, 60, 120])
    ratio = float(np.std(d["bpm_x_um"][during]) / np.std(d["bpm_x_um"][before]))
    check("bpm_disturbance_rms_ratio", 2.9 < ratio < 3.1, ratio, "3 within 0.1")

    d = values("magnet_supply", "current")
    before = (d["elapsed_s"] >= 5) & (d["elapsed_s"] < 7)
    after = (d["elapsed_s"] >= 7) & (d["elapsed_s"] < 9)
    ratio = float(np.std(d["tracking_error_A"][after]) / np.std(d["tracking_error_A"][before]))
    check("magnet_ripple_rms_ratio", 2.9 < ratio < 3.1, ratio, "3 within 0.1 on constant-current plateaus")
    f, power = periodogram(d["tracking_error_A"][before], fs=parameter("magnet_supply", "sample_rate_Hz"), window="hann", scaling="spectrum")
    peaks, _ = find_peaks(power)
    strongest = sorted(float(v) for v in f[peaks[np.argsort(power[peaks])[-3:]]])
    check("magnet_ripple_frequencies_Hz", strongest == [10, 60, 120], strongest, [10, 60, 120])

    d = values("rf_cavity", "normal")
    use = (d["pulse_time_us"] >= 2300) & (d["pulse_time_us"] < 3500)
    tau = float(-1 / np.polyfit(d["pulse_time_us"][use], np.log(d["amplitude_MV"][use]), 1)[0])
    check("rf_decay_time_constant_us", abs(tau - 350) < 5, tau, "350 us within 5 us")
    flat = (d["pulse_time_us"] >= 900) & (d["pulse_time_us"] < 1400)
    mean = float(d["amplitude_MV"][flat].mean())
    check("rf_flat_top_MV", abs(mean - 15) < 0.02, mean, "15 MV within 0.02 MV")
    trip = values("rf_cavity", "trip")
    index = int(np.flatnonzero(trip["pulse_time_us"] == 1850)[0])
    ratio = float(trip["amplitude_MV"][index] / d["amplitude_MV"][index])
    check("rf_early_trip_decay_ratio", abs(ratio - np.exp(-1)) < 0.01, ratio, "exp(-1) at one time constant after trip")

    d = values("vacuum", "pressure")
    use = (d["elapsed_s"] >= 600) & (d["elapsed_s"] <= 7200)
    slopes = {name: float(np.polyfit(np.log(d["elapsed_s"][use]), np.log(d[name + "_mbar"][use]), 1)[0])
              for name in ["metal", "polymer"]}
    check("vacuum_loglog_slopes", abs(slopes["metal"] + 1) < 0.1 and abs(slopes["polymer"] + 0.5) < 0.06,
          slopes, "Approximately -1 for metal and -0.5 for polymer in the selected interval")
    assert all(np.all(v > 0) for k, v in d.items() if k.endswith("_mbar"))
    recovery = d["elapsed_s"] >= parameter("vacuum", "burst_start_s") + 7200
    ratio = float(np.median(d["burst_mbar"][recovery] / d["metal_mbar"][recovery]))
    check("vacuum_burst_recovery_ratio", abs(ratio - 1) < 0.05, ratio, "Return to metal curve within 5%")
    ratio = float(np.median(d["leak_mbar"][-60:] / d["metal_mbar"][-60:]))
    check("vacuum_persistent_floor", ratio > 10, ratio, "Leak pressure remains more than 10 times the clean pressure near 24 h")

    d = values("temperature", "response")
    def response(t, baseline, step, start, tau):
        return baseline + step * (1 - np.exp(-np.maximum(t - start, 0) / tau))
    estimates = {}
    use = (d["elapsed_s"] >= 550) & (d["elapsed_s"] < 1300)
    for name in ["normal", "slow"]:
        fit, _ = curve_fit(response, d["elapsed_s"][use], d[name + "_degC"][use],
                           p0=[22, 3, 620, 150], bounds=([20, 1, 600, 30], [24, 5, 650, 400]))
        estimates[name] = {"response_start_s": float(fit[2]), "tau_s": float(fit[3])}
    check("temperature_response_fits", abs(estimates["normal"]["tau_s"] - 120) < 6 and
          abs(estimates["slow"]["tau_s"] - 240) < 12 and
          all(abs(v["response_start_s"] - 620) < 4 for v in estimates.values()),
          estimates, "120/240 s within 5%; response starts at 620 s within 4 s")
    missing = np.isnan(d["normal_degC"])
    expected_gap = (d["elapsed_s"] >= 1700) & (d["elapsed_s"] < 1760)
    check("temperature_gap_preserved", np.array_equal(missing, expected_gap) and
          np.array_equal(~missing, d["normal_valid"].astype(bool)), int(missing.sum()), "30 missing samples with matching quality")

    d = values("photon_counts", "counts")
    assert np.all(d["counts"] >= 0) and np.all(d["counts"] == np.rint(d["counts"]))
    use = d["exposure_start_s"] < 200
    mean = float(d["counts"][use].mean())
    fano = float(d["counts"][use].var(ddof=1) / mean)
    check("photon_constant_state_statistics", abs(mean - 80.5) < 2 and 0.85 < fano < 1.15,
          {"mean_counts": mean, "variance_over_mean": fano}, "Mean 80.5 within 2; Poisson variance/mean near 1")
    dark = float(d["counts"][d["shutter_open"] == 0].mean())
    attenuated = float(d["counts"][d["exposure_start_s"] >= 400].mean())
    check("photon_state_changes", abs(dark - 0.5) < 0.12 and abs(attenuated - 40.5) < 1,
          {"dark_mean_counts": dark, "attenuated_mean_counts": attenuated}, "Means 0.5 and 40.5 per exposure")

    doc = docs["camera"]
    images = np.array(doc["arrays"]["images"]["values"])
    assert list(images.shape) == doc["arrays"]["images"]["shape"] == [32, 64, 96]
    d = values("camera", "statistics")
    assert np.array_equal(d["elapsed_s"], doc["arrays"]["images"]["frame_elapsed_s"])
    assert not np.allclose(np.diff(d["elapsed_s"]), np.diff(d["elapsed_s"])[0])
    for name, item in doc["tables"].items():
        if name.startswith("profile_"):
            frame = images[item["frame_index"]]
            projection = frame.mean(axis=0 if name.startswith("profile_x") else 1)
            assert np.array_equal(projection, item["data"]["mean_intensity_adu"])
        if name.startswith("histogram_"):
            histogram = item["data"]
            edges = histogram["bin_lower_adu"] + [histogram["bin_upper_adu"][-1]]
            counts, _ = np.histogram(images[item["frame_index"]], bins=edges)
            assert np.array_equal(counts, histogram["pixel_count"]) and counts.sum() == 64 * 96
    saturated = (images == parameter("camera", "adc_max_adu")).sum(axis=(1, 2))
    assert np.array_equal(saturated, d["saturated_pixels"])
    drift = float(np.polyfit(np.arange(26), d["centroid_x_px"][:26], 1)[0])
    check("camera_drift_px_per_frame", abs(drift - 0.4) < 0.02, drift, "0.4 within 0.02")
    check("camera_saturation_and_projections", np.all(saturated[:26] == 0) and np.all(saturated[26:] > 0),
          {"saturated_frames": int(np.count_nonzero(saturated)), "last_frame_saturated_pixels": int(saturated[-1])},
          "Six saturated frames; profiles and histograms match the saved pixel arrays")

    hashes = {str(path.relative_to(args.root)): hashlib.sha256(path.read_bytes()).hexdigest()
              for path in sorted((args.root / "data").rglob("*")) if path.is_file()}
    passed = all(check["passed"] for check in checks)
    result = {"status": "passed" if passed else "failed", "scope": "Saved synthetic data only; not analyzer or archive integration",
              "checks": checks, "data_sha256": hashes}
    (args.root / "verification.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"status": result["status"], "checks": len(checks), "files": len(hashes),
                      "failed": [check for check in checks if not check["passed"]]}, indent=2))
    raise SystemExit(0 if passed else 1)


if __name__ == "__main__":
    main()
