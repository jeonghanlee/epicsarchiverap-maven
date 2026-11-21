/* Offline interface prototype using the bundled, reference-based synthetic observations. */
"use strict";

const BASE_START = Date.parse(SIGNAL_DOCUMENTS.beam_current.time_origin_utc);
const BASE_END = BASE_START + 7201000;
const DAY = 86400000;
const HISTOGRAM_BINS = { default: 20, minimum: 1, maximum: 1000, presets: [5, 12, 20, 40, 80], displayPrecision: 6 };
const COLORS = {
    default: ["#007681", "#5a6b70", "#b36b00", "#984a78"],
    redgreen: ["#00007a", "#f50000", "#339985"],
    mono: ["#000000", "#434343", "#898989"],
};
const DASHES = ["", "10 4", "3 4"];
const VIEWS = [
    { id: "trend", name: "Trend", description: "Inspect change over time, with one axis for each unit.", kind: "Time series" },
    { id: "distribution", name: "Distribution", description: "Inspect the spread and typical values of one signal.", kind: "One signal" },
    { id: "correlation", name: "Correlation", description: "Inspect two signals together, then choose a model and fit range.", kind: "Two signals" },
    { id: "dependency", name: "Dependency", description: "Compare statistical relationships across the selected signals.", kind: "Several signals" },
    { id: "spectrum", name: "Spectrum", description: "Inspect periodic components with explicit data preparation.", kind: "One signal" },
    { id: "compare", name: "Compare", description: "Compare a signal across two explicitly labeled time ranges.", kind: "Two ranges" },
    { id: "waveform", name: "Waveform", description: "Inspect one archived array and compare its shape across time.", kind: "Array data" },
    { id: "image", name: "Image", description: "Inspect a frame, its region of interest and intensity distribution.", kind: "Image data" },
];
const PANELS = ["Signals", "Axes", "Options", "Data", "Export"];
const state = {
    view: "trend", example: "beam_current", acquisition: "default", scope: "full", status: "ready", panel: "Options",
    pvs: ["beam_current.current.current_mA"], hidden: [],
    from: BASE_START, to: BASE_END, zone: "UTC", profile: "default",
    shape: "line", scale: "linear", marks: "auto", avg: false, band: false, projection: false,
    window: 30, signal: "beam_current.current.current_mA", x: "", y: "",
    frame: 0, bins: HISTOGRAM_BINS.default, binRange: null, binSignal: null, panelOpen: true, ranges: {}, chartViews: {}, overlay: true, profileAxis: "x",
    waveformComponent: "amplitude_MV", frequencyMax: 200, recipe: "",
    referenceFrom: BASE_START - 7201000, referenceTo: BASE_START,
};
let resultExport = [];
const $ = id => document.getElementById(id);
const escapeText = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const selected = () => state.pvs.map(id => SIGNALS.find(signal => signal.id === id)).filter(Boolean);
const numeric = () => selected().filter(signal => signal.kind === "scalar");
const availableSignals = () => SIGNALS.filter(signal => signal.example === state.example && signal.acquisition === state.acquisition);
const documentData = () => SIGNAL_DOCUMENTS[state.example];
const excludedSignal = () => state.status === "partial" ? numeric().at(-1)?.id : null;
const series = () => numeric().filter(signal => signal.id !== excludedSignal()).map(signal => ({ ...signal, samples: signal.samples.filter(sample => sample.time >= state.from && sample.time < state.to) }));
const validSamples = signal => signal.samples.filter(sample => Number.isFinite(sample.value));
const currentSeries = () => series().find(signal => signal.id === state.signal) || series()[0];
const color = index => COLORS[state.profile][index % COLORS[state.profile].length];
const zone = () => state.zone === "browser" ? Intl.DateTimeFormat().resolvedOptions().timeZone : state.zone;
const fmt = value => Number.isFinite(value) ? d3.format(".5~g")(value) : "Unavailable";
const allFrameTimes = () => state.example === "camera" ? documentData().arrays.images.frame_elapsed_s.map(t => BASE_START + t * 1000) : state.example === "rf_cavity" ? Object.values(documentData().tables).map(t => BASE_START + t.capture_elapsed_s * 1000) : [];
const frameTimes = () => allFrameTimes().filter(time => time >= state.from && time < state.to);
const absoluteFrame = () => allFrameTimes().indexOf(frameTime());
const frameTime = () => frameTimes()[Math.min(state.frame, frameTimes().length - 1)];
const table = (headers, rows) => `<div class="table-scroll"><table><thead><tr>${headers.map(h => `<th>${escapeText(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeText(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const selectField = (label, id, options, value, disabled = false) => `<label${disabled ? ' class="preview-control"' : ""}>${escapeText(label)}<select id="${id}"${disabled ? " disabled" : ""}>${options.map(option => { const pair = Array.isArray(option) ? option : [option, option]; return `<option value="${escapeText(pair[0])}"${String(pair[0]) === String(value) ? " selected" : ""}>${escapeText(pair[1])}</option>`; }).join("")}</select></label>`;
const previewNote = text => `<span class="preview">Preview: ${escapeText(text)}</span>`;

function dateText(time, input = false) {
    if (!Number.isFinite(time)) return "No frame";
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
        timeZone: zone(), year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(time).map(part => [part.type, part.value]));
    const milliseconds = String(new Date(time).getUTCMilliseconds()).padStart(3, "0");
    return `${parts.year}-${parts.month}-${parts.day}${input ? "T" : " "}${parts.hour}:${parts.minute}:${parts.second}.${milliseconds}`;
}

function parseDate(value) {
    const target = Date.parse(`${value}Z`);
    if (!Number.isFinite(target)) return NaN;
    let instant = target;
    for (let i = 0; i < 3; i++) instant += target - Date.parse(`${dateText(instant, true)}Z`);
    return Date.parse(`${dateText(instant, true)}Z`) === target ? instant : NaN;
}

function notice(text) { $("message").textContent = text; }

function unavailable(id) {
    if (state.scope === "m1" && id !== "trend") return "This tool is not available in this version. Complete design shows the full proposal.";
    const count = numeric().length;
    if (id === "waveform") return selected().some(s => s.kind === "waveform") ? "" : "Choose the RF cavity or camera example for a captured waveform or spatial profile.";
    if (id === "image") return selected().some(s => s.kind === "image") ? "" : "Choose the camera example. Image dimensions must accompany the pixels.";
    if (id === "correlation") return count >= 2 ? "" : "Choose two numeric signals from this example.";
    if (id === "dependency") return count >= 3 ? "" : "Choose at least three numeric signals. The slow BPM or vacuum example supplies them.";
    if (!count) return "This example contains captured arrays. Use Waveform, or select a numeric time-series example.";
    if (id === "spectrum") return spectrumInput(currentSeries()).error || "";
    return "";
}

function exampleRange() {
    if (state.example === "rf_cavity") return [BASE_START, BASE_START + 3000];
    const first = availableSignals().find(signal => signal.samples);
    if (!first) return [BASE_START, BASE_END];
    const times = first.samples.map(sample => sample.time);
    const extra = state.example === "camera" ? 1 : Math.max(1, times[1] - times[0]);
    return [times[0], Math.ceil(times.at(-1) + extra)];
}

function chooseExample(example, acquisition = "slow") {
    state.example = example;
    state.acquisition = example === "bpm" ? acquisition : "default";
    const config = EXAMPLES[example];
    const defaults = example === "bpm" && acquisition === "fast" ? ["fast.bpm_x_um", "fast.bpm_y_um"] : config.defaults;
    state.pvs = defaults.map(id => `${example}.${id}`);
    state.hidden = []; state.ranges = {}; state.chartViews = {}; state.binRange = null; state.binSignal = null; state.frame = 0; state.recipe = "";
    state.scale = config.scale; state.shape = "line"; state.status = "ready";
    state.avg = false; state.band = false; state.projection = false;
    [state.from, state.to] = exampleRange();
    state.referenceFrom = state.from - (state.to - state.from); state.referenceTo = state.from;
    state.view = state.scope === "m1" ? "trend" : config.view;
    const scalars = numeric();
    state.signal = scalars[0]?.id || ""; state.x = scalars[0]?.id || ""; state.y = scalars[1]?.id || "";
}

function applyRecipe(index) {
    const recipe = EXAMPLES[state.example].recipes[index];
    if (recipe.acquisition && recipe.acquisition !== state.acquisition) chooseExample(state.example, recipe.acquisition);
    if (recipe.range) [state.from, state.to] = recipe.range.map(t => BASE_START + t * 1000);
    else [state.from, state.to] = exampleRange();
    if (recipe.reference) [state.referenceFrom, state.referenceTo] = recipe.reference.map(t => BASE_START + t * 1000);
    for (const key of ["signal", "x", "y"]) if (recipe[key]) {
        const id = `${state.example}.${recipe[key]}`;
        if (!state.pvs.includes(id)) state.pvs.push(id);
        if (key === "signal" && state.signal !== id) state.binRange = null;
        state[key] = id;
    }
    state.frame = recipe.frame ?? 0;
    if (recipe.profileAxis) state.profileAxis = recipe.profileAxis;
    state.view = state.scope === "m1" ? "trend" : recipe.view;
    state.recipe = recipe.name;
    render(); notice("Example selection applied to the saved synthetic data.");
}

function restoreAddress() {
    const params = new URLSearchParams(location.hash.slice(1));
    state.scope = params.get("scope") === "m1" ? "m1" : "full";
    const example = Object.hasOwn(EXAMPLES, params.get("example")) ? params.get("example") : "beam_current";
    chooseExample(example, params.get("acquisition") === "fast" ? "fast" : "slow");
    for (const [key, values] of Object.entries({ view: VIEWS.map(v => v.id), scope: ["full", "m1"], panel: PANELS, profile: Object.keys(COLORS), zone: ["UTC", "America/Los_Angeles", "browser"], shape: ["step", "line", "smooth", "points"], marks: ["auto", "on", "off"], scale: ["linear", "symlog", "log", "sqrt"], profileAxis: ["x", "y", "histogram"], waveformComponent: ["amplitude_MV", "i_MV", "q_MV", "drive_MV"] })) {
        if (values.includes(params.get(key))) state[key] = params.get(key);
    }
    if (params.has("pv")) state.pvs = [...new Set(params.getAll("pv").filter(id => availableSignals().some(s => s.id === id)))];
    for (const key of ["from", "to", "referenceFrom", "referenceTo"]) {
        const value = Date.parse(params.get(key));
        if (Number.isFinite(value)) state[key] = value;
    }
    if (state.to <= state.from) [state.from, state.to] = exampleRange();
    if (state.referenceTo <= state.referenceFrom) { state.referenceTo = state.from; state.referenceFrom = state.from - (state.to - state.from); }
    for (const key of ["signal", "x", "y"]) if (state.pvs.includes(params.get(key))) state[key] = params.get(key);
    for (const key of ["avg", "band", "projection"]) state[key] = params.get(key) === "1";
    state.overlay = params.get("overlay") !== "0";
    try {
        const views = JSON.parse(params.get("chartViews") || "{}");
        for (const [key, ranges] of Object.entries(views)) {
            if (!/^(trend|distribution|correlation|spectrum|compare|waveform|image):[0-9]+$/.test(key) || !ranges) continue;
            const valid = {};
            for (const axis of ["x", "y"]) {
                const range = ranges[axis];
                if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite)
                    || range[0] >= range[1] || !Number.isFinite(range[1] - range[0])) continue;
                if (axis === "x" && /^(trend|compare):/.test(key) && !range.every(value => Number.isFinite(new Date(value).getTime()))) continue;
                valid[axis] = range;
            }
            if (Object.keys(valid).length) state.chartViews[key] = valid;
        }
    } catch { /* Invalid plot ranges do not replace the automatic domains. */ }
    for (const [key, min, max] of [["frame", 0, 31], ["window", 2, 120], ["frequencyMax", 0.000001, 1000000]]) {
        if (params.has(key) && Number.isFinite(Number(params.get(key)))) state[key] = Math.max(min, Math.min(max, Number(params.get(key))));
    }
    state.frame = Math.round(state.frame); state.window = Math.round(state.window);
    const requestedBins = Number(params.get("bins"));
    state.bins = validBinCount(requestedBins) ? requestedBins : HISTOGRAM_BINS.default;
    const binLow = params.get("binLow"), binHigh = params.get("binHigh");
    if (binLow?.trim() && binHigh?.trim() && histogramEdges([Number(binLow), Number(binHigh)], state.bins)) {
        state.binRange = [Number(binLow), Number(binHigh)];
    }
    state.hidden = params.getAll("hidden").filter(id => state.pvs.includes(id));
    for (const range of params.getAll("yrange")) {
        const [unit, low, high] = range.split(":");
        if (Number.isFinite(+low) && Number.isFinite(+high) && +low < +high && (state.scale !== "log" || +low > 0)) state.ranges[unit] = [+low, +high];
    }
}

function address() {
    const params = new URLSearchParams();
    for (const key of ["view", "example", "acquisition", "scope", "panel", "profile", "zone", "shape", "marks", "scale", "signal", "x", "y", "frame", "window", "bins", "profileAxis", "waveformComponent", "frequencyMax"]) params.set(key, state[key]);
    params.set("overlay", state.overlay ? "1" : "0");
    if (state.binRange) {
        params.set("binLow", state.binRange[0]);
        params.set("binHigh", state.binRange[1]);
    }
    for (const key of ["from", "to", "referenceFrom", "referenceTo"]) params.set(key, new Date(state[key]).toISOString());
    for (const key of ["avg", "band", "projection"]) if (state[key]) params.set(key, "1");
    if (!state.pvs.length) params.append("pv", "");
    state.pvs.forEach(pv => params.append("pv", pv));
    state.hidden.forEach(pv => params.append("hidden", pv));
    Object.entries(state.ranges).forEach(([unit, range]) => params.append("yrange", `${unit}:${range.join(":")}`));
    if (Object.keys(state.chartViews).length) params.set("chartViews", JSON.stringify(state.chartViews));
    return `${location.href.split("#")[0]}#${params}`;
}

function saveAddress() {
    try { history.replaceState(null, "", address()); } catch { /* The share dialog remains available on restricted file origins. */ }
}

function renderCommon() {
    $("example").innerHTML = Object.entries(EXAMPLES).map(([id, spec]) => `<option value="${id}">${spec.title}</option>`).join("");
    const spec = EXAMPLES[state.example];
    $("example-title").textContent = "SIGNAL EXAMPLE";
    setHelp($("example-question"), spec.title, spec.title, `${spec.question} ${spec.detail}`);
    $("example-detail").textContent = "";
    $("example-actions").innerHTML = spec.recipes.map((recipe, i) => `<button type="button" data-recipe="${i}" aria-pressed="${state.recipe === recipe.name}">${recipe.name}</button>`).join("") + (state.example === "bpm" ? selectField("Acquisition", "acquisition", [["slow", "Slow history / 60 s"], ["fast", "Fast capture / 2 kHz"]], state.acquisition) : "");
    for (const [id, key] of [["example", "example"], ["scope", "scope"], ["demo-state", "status"], ["profile", "profile"], ["zone", "zone"]]) $(id).value = state[key];
    $("from").value = dateText(state.from, true);
    $("to").value = dateText(state.to, true);
    setHelp($("range-zone"), zone(), "Selected time range", "From is included; To is excluded. Changing this interval selects new source observations. Plot zoom changes only the display and the visible-range statistics.");
    $("signal-count").textContent = state.pvs.length;
    $("pv-list").innerHTML = availableSignals().map(s => `<option value="${s.id}">${s.label} / ${s.unit}</option>`).join("");
    $("chips").innerHTML = selected().map((s, i) => `<span class="chip"><span class="swatch" style="background:${color(i)}"></span><code title="${s.id}">${s.label}</code><small>${s.unit}</small><button type="button" data-remove="${s.id}" aria-label="Remove ${s.id}">x</button></span>`).join("") || '<span class="field-label">No PVs selected</span>';
    $("analysis-tabs").innerHTML = VIEWS.map(view => `<button type="button" role="tab" id="tab-${view.id}" aria-controls="analysis-panel" aria-selected="${state.view === view.id}" aria-disabled="${!!unavailable(view.id)}" tabindex="${state.view === view.id ? 0 : -1}" title="${escapeText(unavailable(view.id) || view.description)}" data-view="${view.id}">${view.name}</button>`).join("");
    $("analysis-panel").setAttribute("aria-labelledby", `tab-${state.view}`);
    $("workspace").classList.toggle("panel-hidden", !state.panelOpen);
    $("inspector").hidden = !state.panelOpen;
    $("toggle-panel").textContent = state.panelOpen ? "Hide settings" : "Show settings";
    $("toggle-panel").setAttribute("aria-expanded", state.panelOpen);
    $("footer-state").textContent = `${state.status === "ready" ? "Ready" : state.status} / ${state.pvs.length} selected signals`;
    $("footer-range").textContent = `${dateText(state.from)} to ${dateText(state.to)} / ${zone()}`;
}

function renderInputs() {
    const options = numeric().map(s => [s.id, `${s.label} (${s.unit})`]);
    const signal = selectField("Signal", "active-signal", options, state.signal);
    let html = "";
    if (["distribution", "spectrum", "compare"].includes(state.view)) html = signal;
    if (state.view === "correlation") html = selectField("X signal", "x-signal", options, state.x) + selectField("Y signal", "y-signal", options, state.y) + '<button type="button" id="swap-signals">Swap</button>';
    if (state.view === "dependency") html = selectField("Target signal", "active-signal", options, state.signal);
    if (state.view === "spectrum") html += '<span class="field-label">Hann window / mean removed / one-sided amplitude</span>';
    if (state.view === "compare") html += `<label>Reference B from<input id="reference-from" type="datetime-local" step="0.001" value="${dateText(state.referenceFrom, true)}"></label><label>Reference B to<input id="reference-to" type="datetime-local" step="0.001" value="${dateText(state.referenceTo, true)}"></label><button type="button" id="apply-reference">Apply B</button>`;
    if (["waveform", "image"].includes(state.view)) {
        state.frame = Math.min(state.frame, Math.max(0, frameTimes().length - 1));
        html = `<label class="frame-control">Frame ${state.frame + 1} of ${frameTimes().length}: ${dateText(frameTime())}<input id="frame" type="range" min="0" max="${Math.max(0, frameTimes().length - 1)}" value="${state.frame}" aria-label="Selected frame"></label><button type="button" data-frame-step="-1">Previous</button><button type="button" data-frame-step="1">Next</button>`;
        if (state.view === "waveform") html += state.example === "camera" ? selectField("Array meaning", "profile-axis", [["x", "X spatial profile"], ["y", "Y spatial profile"], ["histogram", "Intensity histogram"]], state.profileAxis) : selectField("Envelope channel", "waveform-component", [["amplitude_MV", "Amplitude"], ["i_MV", "I"], ["q_MV", "Q"], ["drive_MV", "Drive command"]], state.waveformComponent);
    }
    $("view-inputs").innerHTML = html;
}

function plot(target, xDomain, yDomain, xLabel, yLabel, options = {}) {
    return makeSharedPlot(target, xDomain, yDomain, xLabel, yLabel, options);
}

function padded(values, scale = "linear") {
    const finite = values.filter(Number.isFinite);
    if (!finite.length) return [0, 1];
    const [min, max] = d3.extent(finite);
    if (scale === "log") return [Math.max(Number.MIN_VALUE, min / 1.2), max * 1.2];
    const padding = (max - min || Math.abs(min) || 1) * 0.15;
    return [min - padding, max + padding];
}

function line(p, samples, xValue, yValue, index, opts = {}) {
    const curve = state.shape === "step" && opts.time ? d3.curveStepAfter : state.shape === "smooth" ? d3.curveMonotoneX : d3.curveLinear;
    if (state.shape !== "points" || opts.forceLine) p.marks.append("path").datum(samples).attr("fill", "none").attr("stroke", color(index)).attr("stroke-width", 1.8).attr("stroke-dasharray", DASHES[index % DASHES.length]).attr("d", d3.line().defined(value => Number.isFinite(xValue(value)) && Number.isFinite(yValue(value))).x(value => p.x(xValue(value))).y(value => p.y(yValue(value))).curve(curve));
    if (state.shape === "points" || state.marks === "on") p.marks.selectAll(`.point-${index}`).data(samples.filter(value => Number.isFinite(yValue(value)))).join("circle").attr("class", `point-${index}`).attr("cx", value => p.x(xValue(value))).attr("cy", value => p.y(yValue(value))).attr("r", 2.1).attr("fill", color(index));
}

function metrics(items) {
    return `<div class="metrics">${items.map(([label, value, detail]) => `<div class="metric"><small>${escapeText(label)}</small><strong>${escapeText(value)}</strong><span>${detail.length > 28 ? helpHint(label, detail) : escapeText(detail)}</span></div>`).join("")}</div>`;
}

function drawTrend() {
    const data = series().filter(s => !state.hidden.includes(s.id));

    const units = [...new Set(data.map(s => s.unit))];
    if (state.scale === "log" && (data.some(s => validSamples(s).some(p => p.value <= 0)) || units.some(unit => state.ranges[unit] && state.ranges[unit][0] <= 0))) {
        showEmpty("Log scale needs positive values", "Choose Linear or Symmetric log in Axes."); return;
    }
    drawSharedTrend(series());
    $("results-body").innerHTML = table(["Signal", "Valid", "Missing", "Min", "Max", "Mean", "Std. dev.", "Unit"], data.map(s => {
        const valid = validSamples(s);
        return [s.label, valid.length, s.samples.length - valid.length, fmt(d3.min(valid, d => d.value)), fmt(d3.max(valid, d => d.value)), fmt(d3.mean(valid, d => d.value)), fmt(d3.deviation(valid, d => d.value)), s.unit];
    }));
    resultExport = data.flatMap(s => s.samples.map(sample => ({ signal: s.id, elapsed_s: sample.elapsed, timestamp_utc: new Date(sample.time).toISOString(), value: sample.value, unit: s.unit, source: "synthetic" })));
}

function validBinCount(count) {
    return Number.isInteger(count) && count >= HISTOGRAM_BINS.minimum && count <= HISTOGRAM_BINS.maximum;
}

function histogramEdges(domain, count) {
    const [low, high] = domain;
    if (!validBinCount(count) || !Number.isFinite(low) || !Number.isFinite(high)
        || !(low < high) || !Number.isFinite(high - low)) return null;
    const edges = Array.from({ length: count + 1 }, (_, index) => index === count ? high : low + (high - low) * (index / count));
    return edges.every((value, index) => Number.isFinite(value) && (!index || value > edges[index - 1])) ? edges : null;
}

function invalidateHistogram() {
    delete fitSessions.distribution;
    for (const key of Object.keys(state.chartViews)) if (key.startsWith("distribution:")) delete state.chartViews[key];
}

function binBoundLabels(domain) {
    for (let precision = HISTOGRAM_BINS.displayPrecision; precision <= 17; precision++) {
        const labels = domain.map(value => String(Number(value.toPrecision(precision))));
        if (Number(labels[0]) < Number(labels[1])) return labels;
    }
    return domain.map(String);
}

function histogramControls() {
    const signal = currentSeries();
    const values = signal ? validSamples(signal).map(sample => sample.value) : [];
    const domain = state.binRange || padded(values);
    const bounds = binBoundLabels(domain);
    const included = values.filter(value => value >= domain[0] && value <= domain[1]).length;
    const unit = signal?.unit || "";
    const counts = HISTOGRAM_BINS.presets.includes(state.bins) ? HISTOGRAM_BINS.presets
        : [...HISTOGRAM_BINS.presets, [state.bins, `Custom: ${state.bins}`]];
    return `<h3>Histogram${helpHint("Histogram bins", "Bin range defines the first and last bin edges. Bins have equal width. Each bin includes its lower edge and excludes its upper edge; the last bin also includes the maximum. Values outside the bin range are excluded from the histogram and its fit, while Summary retains all selected samples. Changing the bin range or count clears the fit and plot zoom. Auto restores the padded data range. Plot navigation does not change bin edges.")}</h3>`
        + `<form id="custom-bin-form" class="bin-count-controls" novalidate>${selectField("Bin count", "bins", counts, state.bins)}`
        + `<label for="custom-bins"><span>Custom count${helpHint("Custom bin count", `Enter an integer from ${HISTOGRAM_BINS.minimum} to ${HISTOGRAM_BINS.maximum}, then press Apply. The preset choices remain available. Changing the count preserves the bin range and clears the fit and plot zoom.`)}</span>`
        + `<input id="custom-bins" name="count" type="number" min="${HISTOGRAM_BINS.minimum}" max="${HISTOGRAM_BINS.maximum}" step="1" value="${state.bins}" aria-describedby="bin-count-error"></label><button type="submit">Apply</button></form>`
        + '<p id="bin-count-error" class="warning" role="alert"></p>'
        + `<form id="bin-range-form" novalidate><div class="fit-range-label">Bin range / ${escapeText(unit)} <span id="bin-range-mode">${state.binRange ? "Manual" : "Auto"}</span>${helpHint("Bin boundary precision", "Boundary labels normally show six significant digits, with more digits for narrow ranges. Calculations and exports retain the full values. Editing a boundary uses the entered value; an unedited boundary keeps its full value. Displayed digits do not indicate measurement accuracy.")}</div>`
        + `<div class="panel-pair"><label>Bin minimum<input id="bin-low" name="low" type="number" step="any" value="${bounds[0]}" data-bound-value="${domain[0]}"></label><label>Bin maximum<input id="bin-high" name="high" type="number" step="any" value="${bounds[1]}" data-bound-value="${domain[1]}"></label></div>`
        + `<div class="fit-actions"><button type="submit">Apply bin range</button><button id="bin-range-auto" type="button">Auto</button></div><p id="bin-range-error" class="warning" role="alert"></p></form>`
        + `<p id="bin-width" class="range-values">Bin width: ${fmt((domain[1] - domain[0]) / state.bins)} ${escapeText(unit)}</p>`
        + `<p id="bin-counts" class="range-values${included ? "" : " warning"}">Included: ${included} / Excluded: ${values.length - included}</p>`;
}

function histogram(target, values, unit, height = 330) {
    const domain = state.binRange || padded(values);
    const thresholds = histogramEdges(domain, state.bins).slice(1, -1);
    const bins = d3.bin().domain(domain).thresholds(thresholds)(values);
    const p = plot(target, domain, [0, d3.max(bins, b => b.length) || 1], `Value / ${unit}`, "Sample count", { height });
    const barWidth = bin => Math.max(0, p.x(bin.x1) - p.x(bin.x0));
    const barGap = bin => Math.min(1, barWidth(bin) / 10);
    p.marks.selectAll("rect").data(bins).join("rect").attr("x", b => p.x(b.x0) + barGap(b)).attr("y", b => p.y(b.length)).attr("width", b => barWidth(b) - 2 * barGap(b)).attr("height", b => p.y(0) - p.y(b.length)).attr("fill", color(0)).attr("opacity", 0.78);
    const findBin = d3.bisector(bin => bin.x0).right;
    p.bindHover(p.host, pointer => {
        if (+pointer.x < domain[0] || +pointer.x > domain[1]) return null;
        const index = Math.min(bins.length - 1, findBin(bins, +pointer.x) - 1), bin = bins[index];
        const [lowLabel, highLabel] = binBoundLabels([bin.x0, bin.x1]);
        return { title: `Bin ${index + 1}`, rows: [
            `Range: [${lowLabel}, ${highLabel}${index === bins.length - 1 ? "]" : ")"} ${unit}`,
            `Samples: ${bin.length}`, ...fitHoverRows(p, index)], px: p.x(bin.x0 + (bin.x1 - bin.x0) / 2), py: p.y(bin.length) };
    });
    return { bins, p };
}

function drawDistribution() {
    const signal = currentSeries();
    const values = validSamples(signal).map(s => s.value);
    const { bins, p } = histogram($("chart-area"), values, signal.unit);
    const binnedValues = bins.flat();
    histogramRangeSummary(p, binnedValues, signal.unit, signal.label);
    const mean = d3.mean(values), variance = d3.variance(values);
    const fourth = signal.unit === "count" ? ["Variance / mean", mean > 0 ? fmt(variance / mean) : "Unavailable", "Interpret within a constant illumination state"] : ["Median", fmt(d3.median(values)), signal.unit];
    $("results-body").innerHTML = metrics([["Samples", values.length, "Sample-weighted; selected interval"], ["Mean", fmt(mean), signal.unit], ["Std. deviation", fmt(Math.sqrt(variance)), signal.unit], fourth]);
    resultExport = bins.map((bin, index) => ({ signal: signal.id, from_utc: new Date(state.from).toISOString(), to_utc: new Date(state.to).toISOString(), lower: bin.x0, upper: bin.x1, sample_count: bin.length, axis_unit: signal.unit, upper_inclusive: index === bins.length - 1, source: "synthetic" }));
    if (!binnedValues.length) return;
    const integerCounts = signal.unit === "count" && bins.at(-1).x1 <= 10000
        && binnedValues.every(value => Number.isInteger(value) && value >= 0 && value <= 10000);
    const rows = bins.map((bin, index) => {
        const firstInteger = Math.max(0, Math.ceil(bin.x0)), lastInteger = index === bins.length - 1 ? Math.floor(bin.x1) : Math.ceil(bin.x1) - 1;
        return { index, x: bin.x0 + (bin.x1 - bin.x0) / 2, y: bin.length, lower: bin.x0, upper: bin.x1, upperInclusive: index === bins.length - 1, firstInteger, lastInteger,
            logFactorials: integerCounts ? d3.range(firstInteger, lastInteger + 1).map(FitEngine.logFactorial) : [] };
    });
    prepareFit({ histogram: true, values: binnedValues, rows, low: bins[0].x0, high: bins.at(-1).x1, integerCounts, xUnit: signal.unit, yUnit: "sample count" });
    drawFit(p);
}

function paired(xSignal, ySignal) {
    const yValues = new Map(validSamples(ySignal).map(sample => [sample.time, sample.value]));
    return validSamples(xSignal).filter(sample => yValues.has(sample.time)).map(sample => ({ time: sample.time, x: sample.value, y: yValues.get(sample.time) }));
}

function pearson(pairs) {
    if (pairs.length < 2) return null;
    const mx = d3.mean(pairs, d => d.x), my = d3.mean(pairs, d => d.y);
    const xx = d3.sum(pairs, d => (d.x - mx) ** 2), yy = d3.sum(pairs, d => (d.y - my) ** 2);
    return xx > 0 && yy > 0 ? d3.sum(pairs, d => (d.x - mx) * (d.y - my)) / Math.sqrt(xx * yy) : null;
}

function drawCorrelation() {
    const data = series();
    const xSignal = data.find(s => s.id === state.x), ySignal = data.find(s => s.id === state.y);
    if (!xSignal || !ySignal) { showEmpty("An input is unavailable", "Choose two available signals or restore Ready state."); return; }
    const pairs = paired(xSignal, ySignal);
    if (pairs.length < 2) { showEmpty("Insufficient paired samples", "Select an overlapping interval with at least two finite pairs."); return; }
    const p = plot($("chart-area"), padded(pairs.map(d => d.x)), padded(pairs.map(d => d.y)), `${xSignal.label} / ${xSignal.unit}`, `${ySignal.label} / ${ySignal.unit}`);
    p.marks.selectAll("circle").data(pairs).join("circle").attr("cx", d => p.x(d.x)).attr("cy", d => p.y(d.y)).attr("r", pairs.length > 1000 ? 1.7 : 3).attr("fill", color(0)).attr("opacity", 0.45);
    pointHover(p, pairs, pair => pair.x, pair => pair.y, (pair, index) => ({ title: "Paired observation", rows: [
        `${xSignal.label}: ${fmt(pair.x)} ${xSignal.unit}`, `${ySignal.label}: ${fmt(pair.y)} ${ySignal.unit}`,
        `${dateText(pair.time)} ${zone()}`, ...fitHoverRows(p, index)] }));
    $("results-body").innerHTML = metrics([["Paired samples", pairs.length, "Exact matching timestamps"], ["Pearson r", fmt(pearson(pairs)), "Association does not establish causation"], ["X excluded", xSignal.samples.length - pairs.length, "Missing or unmatched observations"], ["Y excluded", ySignal.samples.length - pairs.length, "Missing or unmatched observations"]]);
    resultExport = pairs.map(pair => ({ x_signal: xSignal.id, y_signal: ySignal.id, timestamp_utc: new Date(pair.time).toISOString(), x: pair.x, y: pair.y, x_unit: xSignal.unit, y_unit: ySignal.unit, source: "synthetic" }));
    correlationRangeSummary(p, pairs, xSignal.unit, ySignal.unit);
    const [low, high] = d3.extent(pairs, pair => pair.x);
    prepareFit({ histogram: false, rows: pairs.map((pair, index) => ({ ...pair, index })), low, high, xUnit: xSignal.unit, yUnit: ySignal.unit });
    drawFit(p);
}

function drawDependency() {
    const data = series();
    const count = data.length;
    if (count < 3) { showEmpty("Insufficient available inputs", "This matrix needs three available signals."); return; }
    const width = Math.max(260, Math.min(760, $("chart-area").clientWidth));
    const left = width < 500 ? 90 : 170;
    const cell = Math.min(86, (width - left - 10) / count);
    const svg = d3.select($("chart-area")).append("svg").attr("viewBox", `0 0 ${width} ${Math.max(230, 65 + cell * count)}`).attr("role", "img").attr("aria-label", "Pearson correlation matrix computed from exact timestamp pairs");
    const tip = SharedChart.createHoverTip($("chart-area"));
    svg.on("pointerleave.hover", tip.hide).on("keydown.hover", event => { if (event.key === "Escape") tip.hide(); });
    data.forEach((signal, i) => {
        svg.append("text").attr("x", left - 8).attr("y", 43 + cell / 2 + i * cell).attr("font-size", width < 500 ? 9 : 12).attr("text-anchor", "end").text(signal.label);
        svg.append("text").attr("x", left + i * cell + cell / 2).attr("y", 25).attr("font-size", 10).attr("text-anchor", "middle").text(i + 1);
        data.forEach((other, j) => {
            const pairs = paired(signal, other), value = pearson(pairs);
            resultExport.push({ x: signal.id, y: other.id, pearson_r: value, paired_samples: pairs.length, source: "synthetic" });
            const group = svg.append("g").attr("role", "button").attr("tabindex", 0).attr("aria-label", `Open correlation of ${signal.label} and ${other.label}`).attr("transform", `translate(${left + j * cell},${40 + i * cell})`).style("cursor", "pointer");
            group.append("rect").attr("width", cell - 3).attr("height", cell - 3).attr("rx", 3).attr("fill", Number.isFinite(value) ? d3.interpolateRdBu((1 + value) / 2) : "#ddd");
            group.append("text").attr("x", (cell - 3) / 2).attr("y", cell / 2 + 3).attr("text-anchor", "middle").attr("fill", Math.abs(value) > 0.65 ? "white" : "#173f48").attr("font-size", width < 500 ? 10 : 16).text(Number.isFinite(value) ? value.toFixed(2) : "N/A");
            const activate = () => { state.x = signal.id; state.y = other.id; state.view = "correlation"; render(); $("tab-correlation").focus(); };
            group.on("click", activate).on("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); activate(); } });
            const show = event => {
                if (event.buttons || event.pointerType === "touch") { tip.hide(); return; }
                const box = group.node().getBoundingClientRect();
                const anchor = event.type === "focus" ? { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 } : event;
                tip.show(anchor, { title: `${signal.label} / ${other.label}`, rows: [`Pearson r: ${fmt(value)}`, `Paired samples: ${pairs.length}`] });
            };
            group.on("pointermove.hover focus.hover", show).on("pointerleave.hover blur.hover", tip.hide);
        });
    });
    const candidates = [];
    data.forEach((signal, i) => data.slice(i + 1).forEach(other => {
        const pairs = paired(signal, other), r = pearson(pairs);
        if (Number.isFinite(r)) candidates.push({ label: `${signal.label} / ${other.label}`, r, count: pairs.length });
    }));
    const strongest = d3.greatest(candidates, pair => Math.abs(pair.r));
    setRangeSummary("dependency", "Selected signals", `${data.length} signals`,
        metrics([["Defined pairs", candidates.length, ""], ["Strongest |r|", strongest ? fmt(Math.abs(strongest.r)) : "Unavailable", ""],
            ["Pearson r", strongest ? fmt(strongest.r) : "Unavailable", ""], ["Paired samples", strongest?.count || 0, ""]])
        + `<p class="range-values">${escapeText(strongest?.label || "No defined pair")}</p>`,
        "Strongest absolute off-diagonal Pearson coefficient among the selected signals. Each pair uses exact timestamp matches. Diagonal self-correlations and undefined correlations are excluded. Selecting a matrix cell opens its zoomable scatter plot.");
    $("results-body").innerHTML = table(["Column", "Signal", "Unit"], data.map((signal, i) => [i + 1, signal.label, signal.unit]));
}

function spectrumInput(signal) {
    if (!signal || signal.samples.length < 16) return { error: "Select at least 16 time samples for a spectrum." };
    if (signal.samples.some(sample => !Number.isFinite(sample.value))) return { error: "The selected signal contains missing observations. Select a complete interval; gaps are not filled." };
    const dt = signal.samples[1].elapsed - signal.samples[0].elapsed;
    if (!(dt > 0) || signal.samples.slice(1).some((sample, i) => Math.abs(sample.elapsed - signal.samples[i].elapsed - dt) > Math.max(1e-9, dt * 1e-6))) return { error: "The timestamps are not uniformly spaced. No implicit resampling is performed." };
    return { samples: signal.samples, dt };
}

function amplitudeSpectrum(samples, dt) {
    const n = samples.length, mean = d3.mean(samples, sample => sample.value);
    const size = 2 ** Math.ceil(Math.log2(n));
    const real = new Float64Array(size), imaginary = new Float64Array(size);
    let weight = 0;
    for (let i = 0; i < n; i++) {
        const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
        real[i] = (samples[i].value - mean) * window; weight += window;
    }
    for (let i = 1, j = 0; i < size; i++) {
        let bit = size >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) [real[i], real[j]] = [real[j], real[i]];
    }
    for (let length = 2; length <= size; length *= 2) {
        const angle = -2 * Math.PI / length;
        const wr = Math.cos(angle), wi = Math.sin(angle);
        for (let start = 0; start < size; start += length) {
            let ur = 1, ui = 0;
            for (let k = 0; k < length / 2; k++) {
                const a = start + k, b = a + length / 2;
                const tr = ur * real[b] - ui * imaginary[b], ti = ur * imaginary[b] + ui * real[b];
                real[b] = real[a] - tr; imaginary[b] = imaginary[a] - ti;
                real[a] += tr; imaginary[a] += ti;
                const next = ur * wr - ui * wi; ui = ur * wi + ui * wr; ur = next;
            }
        }
    }
    const bins = Array.from({ length: size / 2 + 1 }, (_, i) => ({
        frequency: i / (size * dt), amplitude: Math.hypot(real[i], imaginary[i]) / weight * (i === 0 || i === size / 2 ? 1 : 2),
    }));
    return { bins, size, count: n, sampleRate: 1 / dt, duration: n * dt };
}

function drawSpectrum() {
    const signal = currentSeries(), input = spectrumInput(signal);
    if (input.error) { showEmpty("Spectrum unavailable", input.error); return; }
    const result = amplitudeSpectrum(input.samples, input.dt);
    const limit = Math.min(state.frequencyMax, result.sampleRate / 2);
    const bins = result.bins.filter(bin => bin.frequency <= limit);
    const maximum = d3.max(bins, d => d.amplitude) || 1;
    const p = plot($("chart-area"), [0, limit], [0, maximum * 1.1], "Frequency / Hz", `Peak amplitude / ${signal.unit}`);
    line(p, bins, d => d.frequency, d => d.amplitude, 0, { forceLine: true });
    sampleHover(p, [{ title: signal.label, samples: bins, x: bin => bin.frequency, y: bin => bin.amplitude,
        rows: bin => [`Frequency: ${fmt(bin.frequency)} Hz`, `Peak amplitude: ${fmt(bin.amplitude)} ${signal.unit}`] }]);
    spectrumRangeSummary(p, bins, signal.unit);
    const peaks = result.bins.filter((bin, i, all) => i > 0 && i < all.length - 1 && bin.amplitude > all[i - 1].amplitude && bin.amplitude >= all[i + 1].amplitude).sort((a, b) => b.amplitude - a.amplitude).slice(0, 3);
    $("results-body").innerHTML = metrics([["Sample rate", fmt(result.sampleRate), "Hz / from timestamps"], ["Duration", fmt(result.duration), "s / N times sample interval"], ["Natural resolution", fmt(1 / result.duration), "Hz / zero padding does not improve this"], ["Samples / FFT", `${result.count} / ${result.size}`, "Hann window; mean removed"]]) + table(["Peak bin", "Frequency (Hz)", `Amplitude (${signal.unit})`], peaks.map((peak, i) => [i + 1, fmt(peak.frequency), fmt(peak.amplitude)]));
    setHelp($("data-note"), `${signal.label} / 0-${fmt(limit)} Hz`, "Amplitude spectrum", `Complete uniform samples; no interpolation. One-sided peak amplitude, not PSD. Nyquist: ${fmt(result.sampleRate / 2)} Hz. Mean removal and a symmetric Hann window precede zero padding.`);
    resultExport = bins.map((bin, index) => ({ upper_inclusive: index === bins.length - 1, signal: signal.id, from_utc: new Date(state.from).toISOString(), to_utc: new Date(state.to).toISOString(), frequency_Hz: bin.frequency, amplitude: bin.amplitude, amplitude_unit: signal.unit, sample_rate_Hz: result.sampleRate, sample_count: result.count, fft_length: result.size, window: "symmetric Hann", detrend: "remove mean", source: "synthetic" }));
}

function drawCompare() {
    const signal = currentSeries(), original = FIXTURE.find(s => s.id === signal.id);
    const samplesB = original.samples.filter(sample => sample.time >= state.referenceFrom && sample.time < state.referenceTo);
    const groups = [{ name: "A", from: state.from, to: state.to, samples: signal.samples }, { name: "B", from: state.referenceFrom, to: state.referenceTo, samples: samplesB }];
    const domain = padded(groups.flatMap(group => group.samples.map(s => s.value)));
    const container = document.createElement("div"); container.className = "chart-grid"; $("chart-area").append(container);
    for (const [index, group] of groups.entries()) {
        const child = document.createElement("div"); container.append(child);
        const heading = document.createElement("p"); heading.className = "plot-caption"; heading.textContent = `${group.name} / ${dateText(group.from)} to ${dateText(group.to)}`; child.append(heading);
        const p = plot(child, [group.from, group.to], domain, `Time / ${zone()}`, signal.unit, { time: true, width: 370, height: 280 });
        line(p, group.samples, d => d.time, d => d.value, index, { time: true });
        sampleHover(p, [{ title: `Range ${group.name} / ${signal.label}`, samples: group.samples, x: sample => sample.time, y: sample => sample.value,
            rows: sample => [`${dateText(sample.time)} ${zone()}`, `Value: ${fmt(sample.value)} ${signal.unit}`] }]);
        sampleRangeSummary(p, group.samples, sample => sample.time, sample => sample.value, `Range ${group.name}`, zone(), signal.unit, { time: true });
        if (!group.samples.length) { const note = document.createElement("p"); note.className = "plot-caption"; note.textContent = "No saved samples in this interval."; child.append(note); }
        resultExport.push(...group.samples.map(sample => ({ signal: signal.id, range: group.name, elapsed_s: sample.elapsed, value: sample.value, unit: signal.unit, source: "synthetic" })));
    }
    $("results-body").innerHTML = table(["Range", "Valid samples", "Mean", "Std. dev.", "Unit"], groups.map(group => {
        const values = group.samples.map(sample => sample.value).filter(Number.isFinite);
        return [group.name, values.length, fmt(d3.mean(values)), fmt(d3.deviation(values)), signal.unit];
    }));
}

function waveform(frame) {
    const doc = documentData();
    if (state.example === "rf_cavity") {
        const name = Object.keys(doc.tables)[frame], values = doc.tables[name].data;
        return { frame, label: name, xLabel: "Time within pulse / us", axisUnit: "us", unit: "MV", samples: values.pulse_time_us.map((x, i) => ({ x, value: values[state.waveformComponent][i] })) };
    }
    const pixels = doc.arrays.images.values[frame];
    const [height, width] = doc.arrays.images.shape.slice(1);
    if (state.profileAxis === "histogram") {
        const counts = new Array(doc.parameters.histogram_bins).fill(0), step = (doc.parameters.adc_max_adu + 1) / counts.length;
        for (const row of pixels) for (const value of row) counts[Math.min(counts.length - 1, Math.floor(value / step))]++;
        return { frame, label: `Frame ${frame} histogram`, xLabel: "Pixel intensity / ADU (bin center)", axisUnit: "ADU", unit: "pixel count", samples: counts.map((value, i) => ({ x: (i + 0.5) * step, value })) };
    }
    const xProfile = state.profileAxis === "x", length = xProfile ? width : height;
    const samples = Array.from({ length }, (_, i) => ({ x: i, value: xProfile ? d3.mean(pixels, row => row[i]) : d3.mean(pixels[i]) }));
    return { frame, label: `Frame ${frame} ${state.profileAxis.toUpperCase()} profile`, xLabel: `Image ${state.profileAxis.toUpperCase()} / pixel`, axisUnit: "pixel", unit: "ADU", samples };
}

function drawWaveform() {
    const index = absoluteFrame(), current = waveform(index);
    const reference = state.overlay && index !== 0 ? waveform(0) : null;
    const all = [...current.samples, ...(reference?.samples || [])];
    const p = plot($("chart-area"), d3.extent(current.samples, d => d.x), padded(all.map(d => d.value)), current.xLabel, current.unit);
    line(p, current.samples, d => d.x, d => d.value, 0, { forceLine: true });
    if (reference) line(p, reference.samples, d => d.x, d => d.value, 1, { forceLine: true });
    sampleHover(p, [current, ...(reference ? [reference] : [])].map(wave => ({ title: wave.label, samples: wave.samples,
        x: sample => sample.x, y: sample => sample.value,
        rows: sample => [`Position: ${fmt(sample.x)} ${wave.axisUnit}`, `Value: ${fmt(sample.value)} ${wave.unit}`] })));
    for (const wave of [current, ...(reference ? [reference] : [])]) {
        const key = `${p.host.dataset.plotKey}:${wave.frame}`;
        if (state.example === "camera" && state.profileAxis === "histogram") {
            histogramRangeSummary(p, documentData().arrays.images.values[wave.frame].flat(), "ADU", wave.label, key, "Pixels");
        } else {
            sampleRangeSummary(p, wave.samples, sample => sample.x, sample => sample.value, wave.label, wave.axisUnit, wave.unit,
                { key, peak: true, countLabel: "Elements" });
        }
    }
    const peak = d3.greatest(current.samples, d => d.value);
    $("results-body").innerHTML = metrics([["Elements", current.samples.length, current.label], ["Peak position", fmt(peak.x), current.axisUnit], ["Maximum", fmt(peak.value), current.unit], ["Mean", fmt(d3.mean(current.samples, d => d.value)), current.unit]]);
    $("legend").innerHTML = `<span class="plot-caption">Solid: ${escapeText(current.label)}${reference ? ` / Dashed: ${escapeText(reference.label)}` : ""}</span>`;
    resultExport = [current, ...(reference ? [reference] : [])].flatMap(wave => wave.samples.map(sample => ({ capture: wave.label, frame_index: wave.frame, capture_time_utc: new Date(allFrameTimes()[wave.frame]).toISOString(), channel: state.example === "rf_cavity" ? state.waveformComponent : state.profileAxis, axis: sample.x, axis_unit: wave.axisUnit, value: sample.value, unit: wave.unit, source: "synthetic" })));
}

function drawProjection(target, pixels, axis) {
    const xProfile = axis === "x", length = xProfile ? pixels[0].length : pixels.length;
    const samples = Array.from({ length }, (_, i) => ({ x: i, value: xProfile ? d3.mean(pixels, row => row[i]) : d3.mean(pixels[i]) }));
    const p = plot(target, [0, length - 1], padded(samples.map(d => d.value)), `Image ${axis.toUpperCase()} / pixel`, "Mean intensity / ADU", { height: 200 });
    line(p, samples, d => d.x, d => d.value, 0, { forceLine: true });
    sampleHover(p, [{ title: `Image ${axis.toUpperCase()} profile`, samples, x: sample => sample.x, y: sample => sample.value,
        rows: sample => [`Position: ${fmt(sample.x)} pixel`, `Mean intensity: ${fmt(sample.value)} ADU`] }]);
    sampleRangeSummary(p, samples, sample => sample.x, sample => sample.value, `Image ${axis.toUpperCase()} profile`, "pixel", "ADU", { peak: true, countLabel: "Profile points", note: "These are full-frame mean profile values, not statistics of a cropped image region." });
}

function drawImage() {
    const doc = documentData(), index = absoluteFrame(), pixels = doc.arrays.images.values[index];
    const stats = doc.tables.statistics.data;
    const [height, width] = doc.arrays.images.shape.slice(1), maximum = doc.parameters.adc_max_adu;
    const wrapper = document.createElement("div"); wrapper.className = "image-layout";
    const canvas = document.createElement("canvas"); canvas.width = width * 4; canvas.height = height * 4;
    canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", `Saved synthetic camera frame ${index}, ${width} by ${height}, intensity in ADU`);
    const context = canvas.getContext("2d");
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        context.fillStyle = d3.interpolateViridis(pixels[y][x] / maximum); context.fillRect(x * 4, (height - y - 1) * 4, 4, 4);
        resultExport.push({ frame: index, elapsed_s: doc.arrays.images.frame_elapsed_s[index], x_pixel: x, y_pixel: y, intensity_ADU: pixels[y][x], source: "synthetic" });
    }
    const cx = (stats.centroid_x_px[index] + 0.5) * 4, cy = (height - stats.centroid_y_px[index] - 0.5) * 4;
    context.strokeStyle = "white"; context.lineWidth = 1; context.beginPath(); context.moveTo(cx - 7, cy); context.lineTo(cx + 7, cy); context.moveTo(cx, cy - 7); context.lineTo(cx, cy + 7); context.stroke();
    wrapper.append(canvas);
    const legend = document.createElement("div"); legend.className = "image-legend";
    legend.innerHTML = `<span>Intensity<strong>0 to ${maximum} ADU</strong><div class="color-scale"></div></span><span>Frame ${index}<strong>${width} x ${height}</strong>Origin: lower left</span><span>Saturated pixels<strong>${stats.saturated_pixels[index]}</strong>At the ADC maximum</span>`;
    wrapper.append(legend); $("chart-area").append(wrapper);
    const caption = document.createElement("p"); caption.className = "image-caption"; caption.textContent = `X: 0-${width - 1} pixels / Y: 0-${height - 1} pixels. Cross: measured centroid. Full frame; no region crop.`; $("chart-area").append(caption);
    const captionText = caption.textContent, tip = SharedChart.createHoverTip(wrapper);
    canvas.addEventListener("pointermove", event => {
        if (event.buttons || event.pointerType === "touch") { tip.hide(); return; }
        const rect = canvas.getBoundingClientRect();
        const x = Math.min(width - 1, Math.max(0, Math.floor((event.clientX - rect.left) / rect.width * width)));
        const y = height - 1 - Math.min(height - 1, Math.max(0, Math.floor((event.clientY - rect.top) / rect.height * height)));
        caption.textContent = `Pixel X=${x}, Y=${y}: ${pixels[y][x]} ADU. Full-frame centroid and profiles shown.`;
        tip.show(event, { title: `Frame ${index}`, rows: [`Pixel X: ${x} / Y: ${y}`, `Intensity: ${pixels[y][x]} ADU`] });
    });
    canvas.addEventListener("pointerleave", () => { tip.hide(); caption.textContent = captionText; });
    const projections = document.createElement("div"); projections.className = "chart-grid"; $("chart-area").append(projections);
    for (const axis of ["x", "y"]) { const target = document.createElement("div"); projections.append(target); drawProjection(target, pixels, axis); }
    $("results-body").innerHTML = metrics([["Centroid X", fmt(stats.centroid_x_px[index]), "pixel / thresholded intensity"], ["Centroid Y", fmt(stats.centroid_y_px[index]), "pixel / thresholded intensity"], ["Width X", fmt(stats.sigma_x_px[index]), "RMS pixels / thresholded intensity"], ["Width Y", fmt(stats.sigma_y_px[index]), "RMS pixels / thresholded intensity"]]);
}

function showEmpty(title, text, action = "") {
    $("chart-area").innerHTML = `<div class="empty-state"><span class="state-mark">[ ${state.status === "loading" ? "..." : "-"} ]</span><h3>${escapeText(title)}</h3><p>${escapeText(text)}</p>${action ? `<button type="button" class="primary" id="recover">${escapeText(action)}</button>` : ""}</div>`;
}

function renderView() {
    SharedChart.preserveViewport(drawView);
}

function drawView() {
    preparePlots();
    activeFit = null;
    const view = VIEWS.find(v => v.id === state.view);
    setHelp($("view-title"), view.name, view.name, view.description);
    $("view-description").textContent = "";
    $("view-kind").textContent = view.kind;
    $("chart-area").replaceChildren(); $("results-body").replaceChildren(); $("legend").replaceChildren();
    resultExport = [];
    $("results-title").textContent = ["trend", "distribution", "waveform"].includes(state.view) ? "Summary" : "Results";
    setHelp($("results-note"), "Selected data", "Summary", "Statistics of the full data selection. Visible range below follows the displayed axes. Viewport changes do not change the original summary, analysis input, fitted model or parameter uncertainty.");
    renderInputs();
    const signal = currentSeries(), valid = signal ? validSamples(signal) : [];
    let note = signal ? `${signal.label}: ${valid.length} valid observations, ${signal.samples.length - valid.length} missing. From included; To excluded. No archive request.` : "Saved synthetic captured arrays; frame acquisition time is separate from the array axis.";
    if (state.view === "correlation" || state.view === "dependency") note = "Calculated from finite samples at exactly matching timestamps. No interpolation; association does not establish causation.";
    if (["waveform", "image"].includes(state.view)) note = `Saved ${state.example === "camera" ? "camera" : "RF"} capture / ${dateText(frameTime())} ${zone()} / physical array axis shown below.`;
    if (state.status === "partial") note = `Simulated partial request: ${SIGNALS.find(s => s.id === excludedSignal())?.label || "one input"} is excluded. Other results use saved samples.`;
    const dataLabel = state.status === "partial" ? "Partial data" : ["waveform", "image"].includes(state.view)
        ? `Frame ${absoluteFrame()} / ${dateText(frameTime())} ${zone()}`
        : ["trend", "correlation", "dependency"].includes(state.view) ? `${series().length} signals`
        : `${signal?.label || "Signal"} / ${valid.length} samples${signal && signal.samples.length > valid.length ? ` / ${signal.samples.length - valid.length} missing` : ""}`;
    setHelp($("data-note"), dataLabel, "Selected observations", note);
    $("data-note").classList.toggle("warning", state.status === "partial");
    if (!state.pvs.length) { showEmpty("Choose signals", "Select a signal from this example and press Plot."); return; }
    if (state.status === "loading") { showEmpty("Loading selected range", "This is a request-state preview. No completed result is displayed.", "Cancel preview request"); return; }
    if (state.status === "error") { showEmpty("The data request failed", "The selection is retained. This is a request-state preview.", "Retry preview request"); return; }
    const problem = unavailable(state.view);
    if (problem) { showEmpty("This view is unavailable", problem, "Return to Trend"); return; }
    const arrays = ["waveform", "image"].includes(state.view);
    if (state.status === "empty" || (["distribution", "compare"].includes(state.view) && !valid.length) || (arrays ? !frameTimes().length : !series().some(s => validSamples(s).length))) { showEmpty("No samples in this range", "Missing values are not replaced with zeros. Change the range or signal."); return; }
    ({ trend: drawTrend, distribution: drawDistribution, correlation: drawCorrelation, dependency: drawDependency, spectrum: drawSpectrum, compare: drawCompare, waveform: drawWaveform, image: drawImage })[state.view]();
    renderRangeSummaries();
    activateHelp($("results-body"));
}

function renderPanel() {
    closeHelp();
    $("inspector-title").textContent = `${VIEWS.find(v => v.id === state.view).name} settings`;
    $("panel-tabs").innerHTML = PANELS.map(name => `<button type="button" id="panel-tab-${name}" data-panel="${name}" role="tab" aria-controls="panel-content" aria-selected="${state.panel === name}" tabindex="${state.panel === name ? 0 : -1}">${name}</button>`).join("");
    $("panel-content").setAttribute("aria-labelledby", `panel-tab-${state.panel}`);
    let html = "";
    if (state.panel === "Signals") html = '<h3>Selected signals</h3>' + selected().map(s => `<div class="signal-item"><strong>${s.label}</strong><code>${s.id}</code><small>${s.type} / ${s.unit}</small>${s.kind === "scalar" ? `<label class="check"><input type="checkbox" data-signal-visible="${s.id}"${state.hidden.includes(s.id) ? "" : " checked"}>Draw in Trend</label>` : ""}</div>`).join("") + '<p>Identifiers name example data columns, not installed PVs. Hiding a line does not remove its signal.</p>';
    if (state.panel === "Axes") {
        const units = [...new Set(numeric().map(s => s.unit))];
        html = selectField("Y scale / Trend", "y-scale", [["linear", "Linear"], ["symlog", "Symmetric log"], ["log", "Log"], ["sqrt", "Square root"]], state.scale) + '<h3>Ranges by unit / Trend</h3>' + units.map(unit => `<form class="axis-range" data-unit="${unit}"><label>${unit} / blank for auto</label><div class="panel-pair"><label>Minimum<input name="low" type="number" step="any" value="${state.ranges[unit]?.[0] ?? ""}"></label><label>Maximum<input name="high" type="number" step="any" value="${state.ranges[unit]?.[1] ?? ""}"></label></div><button type="submit">Apply ${unit}</button></form>`).join("");
    }
    if (state.panel === "Options") {
        if (state.view === "trend") html = selectField("Line", "shape", [["step", "Step"], ["line", "Straight"], ["smooth", "Smooth"], ["points", "Points"]], state.shape) + selectField("Sample marks", "marks", [["auto", "Auto"], ["on", "On"], ["off", "Off"]], state.marks) + '<hr class="panel-rule">' + [["avg", "Running average"], ["band", "Standard deviation band"], ["projection", "Value projection"]].map(([id, label]) => `<label class="check"><input type="checkbox" id="${id}"${state[id] ? " checked" : ""}>${label}</label>`).join("") + selectField("Window / samples", "window", [10, 30, 60], state.window) + '<p>Missing observations remain gaps. Vertical event lines are known scenario annotations.</p>';
        if (state.view === "distribution") html = histogramControls() + fitPanel();
        if (state.view === "correlation") html = '<h3>Pairing</h3><p>Exact matching timestamps; missing values excluded. Pearson r uses all plotted pairs; fitting uses the specified X range.</p>' + fitPanel();
        if (state.view === "dependency") html = '<h3>Pearson matrix</h3><p>Each cell uses exact timestamp pairs. Select a cell to inspect its observations in Correlation.</p>' + previewNote("PCA, partial correlation, and multivariate regression are not implemented.");
        if (state.view === "spectrum") html = `<h3>Amplitude spectrum</h3><p>Mean removed, symmetric Hann window, then zero padding to the next power of two. Peak amplitude keeps the signal unit.</p><label>Maximum displayed frequency (Hz)<input id="frequency-max" type="number" min="0.000001" step="any" value="${state.frequencyMax}"></label><p>The display is capped at Nyquist. Gaps and irregular timing are rejected. Zero padding refines the frequency grid, not the physical resolution.</p>`;
        if (state.view === "compare") html = '<h3>One signal, two ranges</h3><p>A follows the common range. Set B above the plot and press Apply B. Matching units share a value scale.</p>' + previewNote("No significance test or p-value is calculated.");
        if (state.view === "waveform") html = `<label class="check"><input id="overlay" type="checkbox"${state.overlay ? " checked" : ""}>Overlay first saved capture</label><p>${state.example === "camera" ? "Profiles average along the other image axis. Histograms count pixels in ADU bins. Neither axis is elapsed time." : "The waveform axis is time within the RF pulse. Frame timestamps identify separate captures."}</p>`;
        if (state.view === "image") html = '<h3>Full-frame image</h3><p>96 x 64 pixels; fixed color range 0-4095 ADU. The cross shows the thresholded centroid from the saved image statistics.</p><p>Profiles are calculated from the displayed pixels. Frame intervals are deliberately irregular.</p>' + previewNote("ROI selection, background models, and image fitting remain future controls.");
    }
    if (state.panel === "Data") {
        const doc = documentData();
        html = `<h3>Saved source data</h3><p>${EXAMPLES[state.example].title}<br>Origin: ${doc.time_origin_utc}<br>Synthetic measurements and timestamps.<br>No connection or alarm status inferred.</p><p><a href="../analyzer-signal-examples/data/${state.example}.json">Source JSON and units</a><br><a href="../analyzer-signal-examples/README.md">Sources ${doc.source_ids.map(id => `[${id}]`).join(", ")} and model assumptions</a></p>`;
        if (resultExport.length) {
            const columns = Object.keys(resultExport[0]).slice(0, 3);
            html += table(columns, resultExport.slice(0, 8).map(row => columns.map(key => row[key] === null ? "Missing" : typeof row[key] === "number" ? fmt(row[key]) : row[key]))) + `<p>First eight rows of the active result (${resultExport.length} rows). CSV export preserves full numeric precision.</p>`;
        } else html += '<p>No completed result in this view.</p>';
    }
    if (state.panel === "Export") {
        const product = { trend: "Selected visible time samples", distribution: "Histogram bins", correlation: "Paired observations", dependency: "Pearson coefficients and pair counts", spectrum: "Displayed amplitude spectrum bins", compare: "Range A and B samples", waveform: "Displayed waveform and reference", image: "Pixels of the selected frame" }[state.view];
        html = `<h3>${product}</h3><p>CSV contains ${resultExport.length} rows from this view, with units and a synthetic source label. Missing observations use empty values.</p><button type="button" id="download-csv"${resultExport.length ? "" : " disabled"}>Download result CSV</button><button type="button" id="panel-copy">Copy mockup link</button><p><a href="../analyzer-signal-examples/data/${state.example}.json">Complete source JSON</a></p>`;
        if (activeFit) html += `<h3>Fit result</h3><p>Result CSV includes fitted values and residuals. Parameter CSV includes estimates, standard errors, approximate 95% intervals, units, and status. Fit JSON also includes the covariance matrix and parameter order. Fit settings and results stay in this browser session; links reopen the data selection only.</p><button type="button" id="download-fit"${activeFit.result?.success ? "" : " disabled"}>Download fit JSON</button><button type="button" id="download-fit-parameters"${activeFit.result?.success ? "" : " disabled"}>Download parameters CSV</button>`;
    }
    $("panel-content").innerHTML = html;
    compactPanelHelp();
}

function render() {
    SharedChart.preserveViewport(() => {
        const ids = numeric().map(s => s.id);
        if (!ids.includes(state.signal)) { state.signal = ids[0] || ""; state.binRange = null; }
        if (!ids.includes(state.x)) state.x = ids[0] || "";
        if (!ids.includes(state.y)) state.y = ids[1] || ids[0] || "";
        const binSignal = currentSeries()?.id || null;
        if (state.binSignal && state.binSignal !== binSignal) { state.binRange = null; invalidateHistogram(); }
        state.binSignal = binSignal;
        renderCommon(); renderView(); renderPanel(); saveAddress();
    });
}

function activateView(id) {
    const reason = unavailable(id);
    if (reason) { notice(reason); return; }
    state.view = id; render(); notice(""); $(`tab-${id}`).focus();
}

function tabKeyboard(event) {
    const tab = event.target.closest('[role="tab"]');
    if (!tab) return;
    const tabs = [...tab.parentElement.querySelectorAll('[role="tab"]')];
    let index = tabs.indexOf(tab);
    if (event.key === "ArrowRight") index = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") index = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = tabs.length - 1;
    else return;
    event.preventDefault(); tabs[index].focus();
}

async function copyLink() {
    const url = address();
    if (location.protocol === "file:") { $("share-address").value = url; $("share-dialog").showModal(); $("share-address").focus(); $("share-address").select(); return; }
    try { await navigator.clipboard.writeText(url); notice("Mockup link copied. It carries demonstration settings, not archived data."); }
    catch { $("share-address").value = url; $("share-dialog").showModal(); $("share-address").focus(); $("share-address").select(); }
}

function downloadCsv() {
    if (!["ready", "partial"].includes(state.status) || !resultExport.length) { notice("No completed result to export."); return; }
    const url = URL.createObjectURL(new Blob([d3.csvFormat(resultExport)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `analyzer-${state.example}-${state.view}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice(`Downloaded ${resultExport.length} rows of the active ${state.view} result. Source: synthetic data.`);
}

document.addEventListener("keydown", tabKeyboard);
document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.recipe !== undefined) applyRecipe(Number(button.dataset.recipe));
    else if (button.dataset.view) activateView(button.dataset.view);
    else if (button.dataset.panel) { state.panel = button.dataset.panel; renderPanel(); saveAddress(); $(`panel-tab-${state.panel}`).focus(); }
    else if (button.dataset.remove) { state.pvs = state.pvs.filter(pv => pv !== button.dataset.remove); render(); }
    else if (button.dataset.visible) { const id = button.dataset.visible; state.hidden = state.hidden.includes(id) ? state.hidden.filter(pv => pv !== id) : [...state.hidden, id]; render(); }
    else if (button.dataset.span) { const end = parseDate($("to").value); if (Number.isFinite(end)) { $("from").value = dateText(end - Number(button.dataset.span) * 60000, true); notice("Range prepared. Press Show to apply it to all views."); } }
    else if (button.dataset.frameStep) { state.frame = Math.max(0, Math.min(frameTimes().length - 1, state.frame + Number(button.dataset.frameStep))); render(); }
    else if (button.dataset.site) notice(`${button.dataset.site} navigates to the management console in the product. This standalone mockup has no console connection.`);
    else if (button.dataset.preview) notice(button.dataset.preview);
    else if (["copy-link", "panel-copy"].includes(button.id)) copyLink();
    else if (button.id === "toggle-panel") { state.panelOpen = !state.panelOpen; renderCommon(); renderView(); }
    else if (button.id === "full-range") { [state.from, state.to] = exampleRange(); state.frame = 0; state.recipe = ""; render(); notice("Full acquisition range selected."); }
    else if (button.id === "apply-reference") {
        const from = parseDate($("reference-from").value), to = parseDate($("reference-to").value);
        if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) { notice("Enter a valid reference interval."); return; }
        state.referenceFrom = from; state.referenceTo = to; render();
    }
    else if (button.id === "swap-signals") { [state.x, state.y] = [state.y, state.x]; render(); }
    else if (button.id === "recover") { if (unavailable(state.view)) state.view = "trend"; state.status = "ready"; render(); notice("Preview state restored. No network request was made."); }
    else if (button.id === "download-csv") downloadCsv();
    else if (button.id === "bin-range-auto") {
        if (state.binRange) { state.binRange = null; invalidateHistogram(); render(); }
        else renderPanel();
    }
    else if (button.id === "run-fit") runFit();
    else if (button.id === "reset-fit" && activeFit) { activeFit.config = fitConfiguration(activeFit.data, activeFit.config.model); activeFit.result = null; activeFit.message = "Estimates reset from the selected observations. Run fit to calculate a result."; render(); }
    else if (button.id === "download-fit") downloadFit();
    else if (button.id === "download-fit-parameters") downloadFit("csv");
});

document.addEventListener("change", event => {
    const input = event.target;
    if (changeFit(input)) return;
    if (input.id === "example") chooseExample(input.value);
    else if (input.id === "acquisition") chooseExample(state.example, input.value);
    else if (input.id === "scope") { state.scope = input.value; if (input.value === "m1") state.view = "trend"; }
    else if (input.id === "demo-state") state.status = input.value;
    else if (input.id === "profile") state.profile = input.value;
    else if (input.id === "zone") state.zone = input.value;
    else if (["active-signal", "x-signal", "y-signal"].includes(input.id)) {
        if (input.id === "active-signal" && input.value !== state.signal) { state.binRange = null; invalidateHistogram(); }
        state[{ "active-signal": "signal", "x-signal": "x", "y-signal": "y" }[input.id]] = input.value;
    }
    else if (["shape", "marks"].includes(input.id)) state[input.id] = input.value;
    else if (input.id === "y-scale") state.scale = input.value;
    else if (["avg", "band", "projection", "overlay"].includes(input.id)) state[input.id] = input.checked;
    else if (input.id === "profile-axis") state.profileAxis = input.value;
    else if (input.id === "waveform-component") state.waveformComponent = input.value;
    else if (input.id === "frequency-max") {
        const value = Number(input.value);
        if (!(value > 0) || !Number.isFinite(value)) { notice("Frequency limit must be a positive number."); return; }
        state.frequencyMax = value;
    }
    else if (input.id === "bins") {
        const signal = currentSeries(), count = Number(input.value);
        const domain = state.binRange || padded(signal ? validSamples(signal).map(sample => sample.value) : []);
        if (!histogramEdges(domain, count)) { renderPanel(); $("bin-range-error").textContent = "The range cannot represent this many distinct bins."; return; }
        if (count !== state.bins) { state.bins = count; invalidateHistogram(); }
    }
    else if (["window", "frame"].includes(input.id)) state[input.id] = Number(input.value);
    else if (input.dataset.signalVisible) { const id = input.dataset.signalVisible; state.hidden = input.checked ? state.hidden.filter(pv => pv !== id) : [...state.hidden, id]; }
    else return;
    render();
});

$("range-form").addEventListener("submit", event => {
    event.preventDefault(); const from = parseDate($("from").value); const to = parseDate($("to").value);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) { notice("Enter a valid time range with From earlier than To."); return; }
    state.from = from; state.to = to; state.frame = 0; state.recipe = ""; render(); notice("Common time range applied. It is retained when you change analysis tabs.");
});
$("pv-form").addEventListener("submit", event => {
    event.preventDefault(); const id = $("pv-input").value.trim();
    if (!availableSignals().some(s => s.id === id)) { notice("Choose a signal identifier from the current example list."); return; }
    if (!state.pvs.includes(id)) state.pvs.push(id);
    $("pv-input").value = ""; render(); notice("Demo signal selected. No archiving operation was performed.");
});
$("panel-content").addEventListener("input", event => {
    if (event.target.matches("#bin-low, #bin-high")) event.target.dataset.edited = "true";
});
$("panel-content").addEventListener("submit", event => {
    if (event.target.id === "custom-bin-form") {
        event.preventDefault();
        const input = event.target.elements.count, count = Number(input.value);
        if (!validBinCount(count)) {
            input.setAttribute("aria-invalid", "true");
            $("bin-count-error").textContent = `Enter an integer from ${HISTOGRAM_BINS.minimum} to ${HISTOGRAM_BINS.maximum}.`;
            return;
        }
        const signal = currentSeries();
        const domain = state.binRange || padded(signal ? validSamples(signal).map(sample => sample.value) : []);
        if (!histogramEdges(domain, count)) {
            input.setAttribute("aria-invalid", "true");
            $("bin-count-error").textContent = "The range cannot represent this many distinct bins.";
            return;
        }
        if (count !== state.bins) { state.bins = count; invalidateHistogram(); }
        render();
        return;
    }
    if (event.target.id === "bin-range-form") {
        event.preventDefault();
        const inputs = [event.target.elements.low, event.target.elements.high];
        if (!inputs.some(input => input.dataset.edited)) return;
        const [low, high] = inputs.map(input => input.dataset.edited ? input.value.trim() : input.dataset.boundValue);
        const domain = [Number(low), Number(high)];
        if (!low || !high || !histogramEdges(domain, state.bins)) {
            $("bin-range-error").textContent = "Enter finite bounds with minimum below maximum and enough width for distinct bins.";
            return;
        }
        if (JSON.stringify(domain) !== JSON.stringify(state.binRange)) { state.binRange = domain; invalidateHistogram(); }
        render();
        return;
    }
    if (!event.target.matches(".axis-range")) return;
    event.preventDefault(); const form = event.target; const low = form.elements.low.value; const high = form.elements.high.value;
    if (!low && !high) delete state.ranges[form.dataset.unit];
    else if (low && high && Number.isFinite(+low) && Number.isFinite(+high) && +low < +high && (state.scale !== "log" || +low > 0)) state.ranges[form.dataset.unit] = [+low, +high];
    else { notice("Enter both bounds in increasing order. A log scale needs positive bounds."); return; }
    render(); notice("Axis range applied to Trend.");
});
window.addEventListener("hashchange", () => { restoreAddress(); render(); });
let resizeFrame;
window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(renderView);
});
restoreAddress();
render();
