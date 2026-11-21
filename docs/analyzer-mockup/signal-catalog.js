/* Signal identities and acquisition axes for the reference-based synthetic examples. */
"use strict";

const EXAMPLES = {
    beam_current: {
        title: "Stored beam current", question: "Are injections maintaining the stored current? When does beam loss occur?",
        detail: "2 h of current measurements in mA. Injection misses and a partial loss are annotated.",
        view: "trend", scale: "linear", defaults: ["current.current_mA"],
        recipes: [
            { name: "Full operation", view: "trend", range: [0, 7201] },
            { name: "Missed injections", view: "trend", range: [1680, 2040] },
            { name: "Partial beam loss", view: "trend", range: [4140, 4920] },
        ],
    },
    bpm: {
        title: "BPM position", question: "Does position follow temperature drift, or contain a fast periodic disturbance?",
        detail: "Slow history: 48 h at 60 s intervals. Fast capture: 8 s at 2 kHz. These are separate acquisitions.",
        view: "trend", scale: "linear", defaults: ["slow.bpm_x_um", "slow.bpm_y_um", "slow.temperature_degC"],
        recipes: [
            { name: "Slow drift", view: "trend", acquisition: "slow" },
            { name: "Temperature relationship", view: "correlation", acquisition: "slow", x: "slow.temperature_degC", y: "slow.bpm_x_um" },
            { name: "Fast vibration", view: "trend", acquisition: "fast" },
            { name: "Baseline spectrum", view: "spectrum", acquisition: "fast", range: [0, 4] },
            { name: "Disturbed spectrum", view: "spectrum", acquisition: "fast", range: [4, 6] },
        ],
    },
    magnet_supply: {
        title: "Magnet power supply", question: "Does the current follow its command, and does ripple increase on the plateau?",
        detail: "10 s capture at 2 kHz. Command: 100 to 110 A. Ripple increases after 7 s.",
        view: "trend", scale: "linear", defaults: ["current.readback_A", "current.setpoint_A"],
        recipes: [
            { name: "Ramp tracking", view: "trend", range: [0, 10] },
            { name: "Healthy ripple", view: "spectrum", range: [5, 7], signal: "current.tracking_error_A" },
            { name: "Increased ripple", view: "spectrum", range: [7, 9], signal: "current.tracking_error_A" },
            { name: "Before / after", view: "compare", range: [7, 9], reference: [5, 7], signal: "current.tracking_error_A" },
        ],
    },
    rf_cavity: {
        title: "RF cavity envelope", question: "How do an early trip and detuning change the cavity pulse?",
        detail: "Three captured envelopes. The X axis within each waveform is microseconds, not the archive update time.",
        view: "waveform", scale: "linear", defaults: ["envelope"],
        recipes: [
            { name: "Normal pulse", view: "waveform", frame: 0 },
            { name: "Early RF trip", view: "waveform", frame: 1 },
            { name: "Detuned cavity", view: "waveform", frame: 2 },
        ],
    },
    vacuum: {
        title: "Vacuum pressure", question: "Does pressure recover, or remain above the expected pump-down curve?",
        detail: "24 h in the high-vacuum outgassing regime. Pressure is in mbar; the pressure axis uses a log scale.",
        view: "trend", scale: "log", defaults: ["pressure.metal_mbar", "pressure.polymer_mbar", "pressure.leak_mbar", "pressure.burst_mbar"],
        recipes: [
            { name: "Pump-down curves", view: "trend", range: [0, 86460] },
            { name: "Pressure burst", view: "trend", range: [27600, 33600] },
            { name: "Persistent pressure floor", view: "trend", range: [64800, 86460] },
        ],
    },
    temperature: {
        title: "Temperature response", question: "How quickly does the readback reach its new setpoint? Where is data missing?",
        detail: "A 22 to 25 degC command, two response speeds, and 30 missing observations in the normal response.",
        view: "trend", scale: "linear", defaults: ["response.normal_degC", "response.slow_degC", "response.setpoint_degC"],
        recipes: [
            { name: "Step response", view: "trend", range: [500, 1500] },
            { name: "Missing interval", view: "trend", range: [1600, 1850] },
            { name: "Steady-state spread", view: "distribution", range: [2400, 3602] },
        ],
    },
    photon_counts: {
        title: "Photon counts", question: "Do count fluctuations, dark counts, and attenuation match the measurement state?",
        detail: "Integer detections per 0.1 s exposure. Shutter closes at 200-260 s; attenuation begins at 400 s.",
        view: "trend", scale: "linear", defaults: ["counts.counts"],
        recipes: [
            { name: "Shutter and attenuation", view: "trend", range: [0, 600.1] },
            { name: "Constant illumination", view: "distribution", range: [0, 200.1] },
            { name: "Dark counts", view: "distribution", range: [200.1, 260.1] },
            { name: "Attenuated counts", view: "distribution", range: [400.1, 600.1] },
        ],
    },
    camera: {
        title: "Camera beam image", question: "Is the spot moving or broadening, and when does the detector saturate?",
        detail: "32 frames at 96 x 64 pixels. Image values are ADU; frame timestamps are not uniformly spaced.",
        view: "image", scale: "linear", defaults: ["image", "profile", "statistics.centroid_x_px", "statistics.sigma_x_px"],
        recipes: [
            { name: "Initial image", view: "image", frame: 0 },
            { name: "Saturated image", view: "image", frame: 31 },
            { name: "Spatial profile", view: "waveform", frame: 31, profileAxis: "x" },
            { name: "Spot motion and width", view: "trend" },
        ],
    },
};
const COLUMN_LABELS = {
    current_mA: "Beam current", bpm_x_um: "BPM X", bpm_y_um: "BPM Y", temperature_degC: "Temperature",
    setpoint_A: "Current setpoint", readback_A: "Current readback", tracking_error_A: "Current error",
    metal_mbar: "Metal outgassing", polymer_mbar: "Polymer outgassing", leak_mbar: "Leak floor", burst_mbar: "Pressure burst",
    setpoint_degC: "Temperature setpoint", normal_degC: "Normal response", slow_degC: "Slow response",
    counts: "Photon counts", count_rate_per_s: "Photon count rate", shutter_open: "Shutter open", transmission: "Transmission",
    centroid_x_px: "Centroid X", centroid_y_px: "Centroid Y", sigma_x_px: "Width X", sigma_y_px: "Width Y",
    saturated_pixels: "Saturated pixels", total_adu: "Total intensity",
};
const SIGNALS = [];
for (const [example, document] of Object.entries(SIGNAL_DOCUMENTS)) {
    const origin = Date.parse(document.time_origin_utc);
    for (const [name, table] of Object.entries(document.tables)) {
        if (!table.data.elapsed_s) continue;
        if (example === "camera" && name !== "statistics") continue;
        for (const column of table.columns) {
            if (!["observation", "command", "derived", "state"].includes(column.role)) continue;
            const samples = table.data.elapsed_s.map((elapsed, i) => ({
                time: origin + elapsed * 1000, elapsed, value: table.data[column.name][i],
            }));
            SIGNALS.push({
                id: `${example}.${name}.${column.name}`, label: COLUMN_LABELS[column.name] || column.name,
                example, acquisition: example === "bpm" ? name : "default", table: name, column: column.name,
                unit: column.unit, role: column.role, type: table.kind === "time_waveform" ? "Captured time samples" : "Numeric time series",
                kind: "scalar", samples,
            });
        }
    }
}
SIGNALS.push(
    { id: "rf_cavity.envelope", label: "Cavity envelope", example: "rf_cavity", acquisition: "default", unit: "MV", type: "Time waveform / 2001 samples", kind: "waveform" },
    { id: "camera.image", label: "Beam image", example: "camera", acquisition: "default", unit: "ADU", type: "Image / 96 x 64 pixels", kind: "image" },
    { id: "camera.profile", label: "Image profile / histogram", example: "camera", acquisition: "default", unit: "ADU", type: "Spatial profile or intensity histogram", kind: "waveform" },
);
const FIXTURE = SIGNALS.filter(signal => signal.kind === "scalar");
