// The analyzer owns validated selection state and retrieves data from its own appliance.
import { createChart } from "../comm/js/aa/chart.js";
import { node } from "../comm/js/aa/dom.js";
import { infoButton } from "../comm/js/aa/card.js";
import { PROFILES, currentProfile, setProfile, onProfileChange } from "../comm/js/aa/chart/profile.js";
import { currentZone, ZONES, setZone, onZoneChange, formatInZone, partsInZone, zoneName } from "../comm/js/aa/timezone.js";
import { booleanOf, integerIn, isoDuration, orderedParameters, parseIsoDuration, readChartState, timeOf, wholeSecondsOf, writeChartParameters } from "../comm/js/aa/chart/state.js";
import { lineLook } from "../comm/js/aa/chart/series.js";
import { buildStatistics } from "../comm/js/aa/chart/statistics.js";
import { buildRangeStrip } from "../comm/js/aa/chart/strip.js";
import { createDistribution } from "./distribution.js";
import { createTrendTools } from "./trend-tools.js";
import { createCompare } from "./compare.js";
import { createSpectrum } from "./spectrum.js";
import { createCorrelation } from "./correlation.js";
import { deepFields, readToolParameters, writeToolParameters } from "./tool-address.js";
import { csvText, gridOf, interpolateRows, intervalForBins, isoText, longTable, nanosOf, nanosOfDate, observationsOf, parseDuration, timeText, valueText, wideTable } from "./export.js";

const d3 = globalThis.d3;
const DATA = "../../data/getData.json";
const MATCHING = "../../bpl/getMatchingPVs";
const APPLIANCE = "../../bpl/getApplianceInfo";
const CONCURRENT_REQUESTS = 6;
const TARGET_SAMPLES = 700;
// The retrieval accepts an averaging interval of whole seconds up to the largest signed 32-bit value.
const INTERVAL_MOST = 2147483647;
// Datasets retrieved in this page session, by PV, operator and range; a repeated request is answered from here.
const CACHE_LIMIT = 48;
const HOUR = 3600000;
const INPUT_FORMAT = "%Y-%m-%dT%H:%M:%S";
const VIEWS = ["trend", "distribution", "correlation", "dependency", "spectrum", "compare", "waveform", "image"];
// The views that have their tool in this version; the others explain that they are not available.
const AVAILABLE_VIEWS = ["trend", "distribution", "correlation", "spectrum", "compare"];
const PV_NAME = /^[a-zA-Z0-9:_\-+[\];/,#{}^<>]+(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/;
// The page holds two datasets per PV. The selected dataset (summary) is the records of the selected range at the
// resolution sample, resolved once from the interval option when the selection is made; the Summary statistics come
// from it. The display dataset (data) is the records of the displayed range at the display resolution; the chart,
// the Visible range statistics and the min and max bands come from it. When both are the same request they share.
const state = { pvs: [], from: null, to: null, selected: null, view: "trend", chart: null, tools: null,
    sample: null, interval: "auto", minmax: false, displaySeconds: null,
    summary: new Map(), summaryFailures: new Map(), data: new Map(), failures: new Map(), bands: new Map(),
    // The choices of the Export tab, named as the address names them; a product runs only from its button.
    export: { product: "data", range: "view", from: "", to: "", source: "raw", bins: "700", step: "1", gap: "", layout: "long",
        alarms: true, values: "source", decimals: "6", time: "iso", units: false, stats: "visible" },
    // The texts the cursors were read from (written back while a cursor has not moved) and the pin references of the
    // address still to be resolved against the display data.
    cursorTexts: [null, null], pinRefs: [] };
// The defaults of the export choices, for the address.
const EXPORT_DEFAULTS = { product: "data", range: "view", source: "raw", bins: "700", step: "1", gap: "", layout: "long", alarms: true, values: "source", decimals: "6", time: "iso", units: false, stats: "visible" };
const EXPORT_CHOICES = { product: ["data", "statistics", "png", "svg", "link", "serverCsv", "serverMat"], range: ["view", "custom"], source: ["plot", "raw", "optimized", "interpolated"],
    layout: ["long", "wide"], values: ["source", "fixed", "exponential"], time: ["iso", "unixms"], stats: ["visible", "selected"] };
const cache = new Map();
// The endpoint that gives the last observation at or before a time, and the search period sent with it.
const DATA_AT_TIME = "../../data/getDataAtTime";
const SEARCH_PERIOD = "P1D";
// The most rows a page-built CSV holds; a larger export needs a smaller range or the server product.
const EXPORT_ROWS_MOST = 500000;
// The most samples the Data tab lists per PV.
const DATA_ROWS_MOST = 500;
const SEVERITY_NAMES = ["NONE", "MINOR", "MAJOR", "INVALID"];
const $ = (id) => document.getElementById(id);
let chart;
let controller = null;
let inputKey = "";

function inputTime(date) {
    return formatInZone(date, INPUT_FORMAT, currentZone()) + "." + String(date.getMilliseconds()).padStart(3, "0");
}

/** Converts calendar input in the chosen zone; nonexistent or ambiguous local times require UTC entry. */
function readTime(text, original) {
    if (!text) return null;
    const normalized = text.length === 16 ? text + ":00.000" : text.length === 19 ? text + ".000" : text;
    if (normalized === inputTime(original)) return original;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(text);
    if (!match) return null;
    const fields = match.slice(1, 7).map((part) => Number(part || 0));
    const ms = Number((match[7] || "").padEnd(3, "0"));
    const naive = Date.UTC(fields[0], fields[1] - 1, fields[2], fields[3], fields[4], fields[5], ms);
    const candidates = new Set();
    for (const shift of [-24, 0, 24]) {
        const probe = new Date(naive + shift * HOUR);
        const p = partsInZone(probe, currentZone());
        const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, probe.getMilliseconds());
        const value = new Date(naive - (local - probe.getTime()));
        const q = partsInZone(value, currentZone());
        if ([q.year, q.month, q.day, q.hour, q.minute, q.second].every((v, i) => v === fields[i])) {
            candidates.add(value.getTime());
        }
    }
    return candidates.size === 1 ? new Date([...candidates][0]) : null;
}


/** A resolution of the address: raw, or whole seconds as an ISO 8601 duration; null for anything else. */
function resolutionOfText(text) {
    if (text === "raw") return "raw";
    return wholeSecondsOf(text);
}

/**
 * Reads the address as docs/analyzer-address.openapi.json declares it: the PVs, the displayed and the selected range,
 * the resolutions, the band, the export choices, the options of the analysis tools (tool-address.js), the zone, the profile
 * and the view, and the chart state through state.js. An invalid value falls back to its default; a pair is applied whole or not at all.
 */
function readAddress() {
    const parameters = new URLSearchParams(window.location.search);
    state.pvs = [...new Set(parameters.getAll("pv").map((name) => name.trim()).filter((name) => PV_NAME.test(name)))];
    const from = timeOf(parameters.get("from")), to = timeOf(parameters.get("to"));
    state.to = to || new Date();
    state.from = from && from < state.to ? from : new Date(state.to.getTime() - HOUR);
    const selectedFrom = timeOf(parameters.get("selectedFrom")), selectedTo = timeOf(parameters.get("selectedTo"));
    state.selected = selectedFrom && selectedTo && selectedFrom < selectedTo ? { from: selectedFrom, to: selectedTo } : { from: state.from, to: state.to };
    state.sample = resolutionOfText(parameters.get("sample"));
    state.interval = resolutionOfText(parameters.get("interval")) ?? "auto";
    state.minmax = booleanOf(parameters.get("minMax")) ?? false;
    state.view = VIEWS.includes(parameters.get("view")) ? parameters.get("view") : "trend";
    state.tools = readToolParameters(parameters, state.pvs);
    const zone = parameters.get("tz");
    setZone(ZONES.some((item) => item.id === zone) ? zone : "browser");
    let profile = parameters.get("profile");
    if (!PROFILES.some((item) => item.id === profile)) {
        try { profile = window.localStorage.getItem("aa.chartProfile"); } catch (error) { profile = null; }
    }
    setProfile(PROFILES.some((item) => item.id === profile) ? profile : "default");
    // The export choices restore the form only; an invalid field keeps its default and the others stay.
    const fields = deepFields(parameters, "export");
    const choice = { ...EXPORT_DEFAULTS, from: "", to: "" };
    for (const [name, choices] of Object.entries(EXPORT_CHOICES)) {
        if (choices.includes(fields.get(name))) choice[name] = fields.get(name);
    }
    const exportFrom = timeOf(fields.get("from")), exportTo = timeOf(fields.get("to"));
    if (exportFrom && exportTo && exportFrom < exportTo) {
        choice.from = inputTime(exportFrom);
        choice.to = inputTime(exportTo);
    } else if (choice.range === "custom") {
        choice.range = "view";
    }
    if (integerIn(fields.get("bins"), 1, BINS_MOST) !== null) choice.bins = fields.get("bins").trim();
    const step = parseIsoDuration(fields.get("step"));
    if (step !== null) choice.step = String(step);
    const gap = parseIsoDuration(fields.get("gap"));
    if (gap !== null) choice.gap = String(gap);
    if (booleanOf(fields.get("alarms")) !== null) choice.alarms = booleanOf(fields.get("alarms"));
    if (integerIn(fields.get("decimals"), 0, 15) !== null) choice.decimals = fields.get("decimals").trim();
    if (booleanOf(fields.get("units")) !== null) choice.units = booleanOf(fields.get("units"));
    state.export = choice;
    state.chart = readChartState(parameters, state.pvs);
    state.cursorTexts = state.chart.cursorTexts;
    state.pinRefs = state.chart.pinRefs;
}

/** The RFC 3339 text of an observation's seconds and nanoseconds, with the fraction the nanoseconds need. */
function timeTextOf(secs, nanos) {
    const fraction = nanos ? `.${String(nanos).padStart(9, "0").replace(/0+$/, "")}` : "";
    return `${new Date(secs * 1000).toISOString().slice(0, 19)}${fraction}Z`;
}

/** The PV@time of each pin of the chart: the exact time text it carries, else the observation's own time from the display data. */
function pinTextsOf(chartState) {
    return (chartState.pins || []).map((pin) => {
        if (pin.time) return `${pin.name}@${pin.time}`;
        const record = (state.data.get(pin.name)?.records || []).find((item) => item.t === pin.t);
        return `${pin.name}@${record ? timeTextOf(record.secs, record.nanos) : new Date(pin.t).toISOString()}`;
    });
}

/** The export choices that differ from their defaults, as export[field] parameters. */
function writeExportParameters(parameters) {
    const choice = state.export;
    for (const name of ["product", "range", "source", "layout", "values", "time", "stats"]) {
        if (choice[name] !== EXPORT_DEFAULTS[name]) parameters.set(`export[${name}]`, choice[name]);
    }
    if (choice.range === "custom") {
        const from = readTime(choice.from, state.from), to = readTime(choice.to, state.to);
        if (from && to && from < to) {
            parameters.set("export[from]", from.toISOString());
            parameters.set("export[to]", to.toISOString());
        }
    }
    if (choice.bins !== EXPORT_DEFAULTS.bins && integerIn(choice.bins, 1, BINS_MOST) !== null) parameters.set("export[bins]", choice.bins.trim());
    const step = Number(choice.step);
    if (Number.isFinite(step) && step > 0 && step !== Number(EXPORT_DEFAULTS.step)) parameters.set("export[step]", isoDuration(step));
    const gap = Number(choice.gap);
    if (choice.gap.trim() !== "" && Number.isFinite(gap) && gap > 0) parameters.set("export[gap]", isoDuration(gap));
    if (choice.alarms === false) parameters.set("export[alarms]", "false");
    if (choice.decimals !== EXPORT_DEFAULTS.decimals && integerIn(choice.decimals, 0, 15) !== null) parameters.set("export[decimals]", choice.decimals.trim());
    if (choice.units === true) parameters.set("export[units]", "true");
}

/** Writes the address: pv first in series order, then every other parameter in code-point order, defaults left out. */
function writeAddress() {
    const parameters = new URLSearchParams();
    for (const name of state.pvs) parameters.append("pv", name);
    parameters.set("from", state.from.toISOString());
    parameters.set("to", state.to.toISOString());
    if (state.selected && (+state.selected.from !== +state.from || +state.selected.to !== +state.to)) {
        parameters.set("selectedFrom", state.selected.from.toISOString());
        parameters.set("selectedTo", state.selected.to.toISOString());
    }
    if (state.sample !== null) parameters.set("sample", state.sample === "raw" ? "raw" : isoDuration(state.sample));
    if (state.interval !== "auto") parameters.set("interval", state.interval === "raw" ? "raw" : isoDuration(state.interval));
    if (state.minmax === true) parameters.set("minMax", "true");
    parameters.set("view", state.view);
    writeExportParameters(parameters);
    writeToolParameters(parameters, tools, state.pvs);
    const chartState = chart ? chart.getState() : state.chart;
    writeChartParameters(parameters, { ...chartState, cursorTexts: state.cursorTexts, pinTexts: pinTextsOf(chartState) }, currentZone(), currentProfile(), state.pvs);
    window.history.replaceState(null, "", `${window.location.pathname}?${orderedParameters(parameters)}`);
    const active = document.querySelector("ul.mainmenu a[aria-current='page']");
    if (active) active.href = window.location.href;
}

/**
 * Resolves the pin references of the address against the display data: a reference whose PV has its display dataset
 * becomes a pin with the value of the observation at exactly its time, or an unavailable pin without one; the
 * references of PVs still loading wait.
 */
function resolvePins() {
    if (!state.pinRefs.length || !chart) return;
    const pins = chart.getState().pins;
    const waiting = [];
    let added = false;
    for (const ref of state.pinRefs) {
        const dataset = state.data.get(ref.name);
        if (!dataset && !state.failures.has(ref.name)) {
            waiting.push(ref);
            continue;
        }
        // A PV whose retrieval failed keeps its pin as unavailable, so that the reference stays in the address.
        const record = dataset ? dataset.records.find((item) => BigInt(item.secs) * 1000000000n + BigInt(item.nanos || 0) === ref.nanos) : null;
        const t = record ? record.t : Number(ref.nanos / 1000000n);
        // A pin carries its exact time text, so two observations of one PV within a millisecond stay two pins.
        if (!pins.some((pin) => pin.name === ref.name && (pin.time ? pin.time === ref.time : pin.t === t))) {
            pins.push({ name: ref.name, egu: dataset ? dataset.egu || "" : "", t, v: record ? record.v : null, s: record ? record.severity : 0, time: ref.time });
            added = true;
        }
    }
    state.pinRefs = waiting;
    if (added) chart.setState({ pins });
}

async function setupHeader() {
    const menu = document.querySelector("ul.mainmenu");
    const links = [...menu.querySelectorAll("a")].map((link) => [link, link.getAttribute("href")]);
    menu.addEventListener("click", (event) => {
        if (menu.dataset.ready !== "true") event.preventDefault();
    });
    for (const [link] of links) link.setAttribute("aria-disabled", "true");
    try {
        const response = await fetch(APPLIANCE);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const info = await response.json();
        const management = new URL(String(info.mgmtURL || "").replace(/\/?$/, "/"));
        if (!["http:", "https:"].includes(management.protocol)) throw new Error("No management address");
        const base = new URL("../ui/", management);
        for (const [link, href] of links) {
            link.href = href === "analyzer.html" ? window.location.href : new URL(href, base).href;
            link.removeAttribute("aria-disabled");
        }
        menu.dataset.ready = "true";
    } catch (error) {
        $("headerMessage").textContent = `The console menu is unavailable: ${error.message}. Reload to retry.`;
    }
}

/** The averaging interval in seconds that draws about TARGET_SAMPLES means over the span, at least one second. */
function autoSeconds(from, to) {
    return Math.max(1, Math.ceil((to - from) / 1000 / TARGET_SAMPLES));
}

/** The resolution of a range under the interval option: raw records, or the whole seconds of the means. */
function resolutionOf(from, to) {
    return state.interval === "raw" ? "raw" : state.interval === "auto" ? autoSeconds(from, to) : state.interval;
}

/** The text of a resolution: raw samples or means over N seconds. */
function sourceText(seconds) {
    return seconds === "raw" ? "raw samples" : `means over ${seconds} s`;
}

/**
 * One dataset of a PV: its records over a range, raw or through the no-fill operator kind (mean, min or max) at a
 * resolution of whole seconds, which leaves an interval without samples empty. Each record keeps the source seconds
 * and nanoseconds, the value, the severity and the status; points carries what the chart draws. A dataset once
 * retrieved in this page session is answered from the cache.
 */
async function fetchSeries(name, kind, seconds, from, to, signal) {
    const pv = seconds === "raw" ? name
        : kind === "min" ? `minSample_${seconds}(${name})`
        : kind === "max" ? `maxSample_${seconds}(${name})`
        : `meanSample_${seconds}(${name})`;
    const key = `${pv}|${from.toISOString()}|${to.toISOString()}`;
    if (cache.has(key)) return cache.get(key);
    const query = new URLSearchParams({ pv, from: from.toISOString(), to: to.toISOString() });
    const response = await fetch(`${DATA}?${query}`, { signal });
    if (!response.ok) throw new Error(`${response.statusText || "Retrieval failed"} (HTTP ${response.status})`);
    const body = await response.json();
    const first = body[0];
    const points = [];
    const records = [];
    // Every record is kept with its source seconds and nanoseconds; a value that is not a finite number stays in the
    // records as an invalid observation (v null) and is not drawn.
    for (const sample of first ? first.data : []) {
        const finite = typeof sample.val === "number" && Number.isFinite(sample.val);
        const fields = sample.fields;
        const lost = Boolean(fields && (Number(fields.cnxlostepsecs) > 0 || fields.startup === "true" || fields.connectionChange === "true"));
        const secs = Number(sample.secs);
        const nanos = Number(sample.nanos || 0);
        const t = secs * 1000 + Math.floor(nanos / 1e6);
        const severity = Number(sample.severity) || 0;
        if (finite) points.push({ t, v: sample.val, s: severity, g: lost });
        records.push({ secs, nanos, t, v: finite ? sample.val : null, text: finite ? null : JSON.stringify(sample.val ?? null),
            severity, status: Number(sample.status) || 0, lost });
    }
    const form = !first ? "No samples" : points.length ? "Numeric samples" : first.data.length ? "No supported scalar samples" : "No samples";
    const dataset = { name, egu: first?.meta?.EGU ?? "", points, records, form, kind, seconds, from, to };
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(key, dataset);
    return dataset;
}

/**
 * Retrieves the selected dataset and the display dataset of every PV, and the min and max of the display when the
 * band is asked for, in one batch of at most CONCURRENT_REQUESTS requests at a time. A request that an earlier batch
 * already answered is served from the cache; a batch started later abandons this one.
 */
async function load() {
    controller?.abort();
    const request = new AbortController();
    controller = request;
    const { signal } = request;
    const pvs = [...state.pvs];
    const selected = state.selected;
    const display = { from: state.from, to: state.to };
    if (state.sample === null) {
        // The resolution of the selected dataset is resolved once and written to the address with it.
        state.sample = resolutionOf(selected.from, selected.to);
        writeAddress();
    }
    const displaySeconds = resolutionOf(display.from, display.to);
    const shared = displaySeconds === state.sample && +display.from === +selected.from && +display.to === +selected.to;
    state.displaySeconds = displaySeconds;
    state.data = new Map();
    state.failures = new Map();
    state.summary = new Map();
    state.summaryFailures = new Map();
    state.bands = new Map();
    render();
    const tasks = [];
    for (const name of pvs) {
        tasks.push({ name, role: "summary", kind: "mean", seconds: state.sample, ...selected });
        if (!shared) tasks.push({ name, role: "display", kind: "mean", seconds: displaySeconds, ...display });
        if (state.minmax && displaySeconds !== "raw") {
            for (const kind of ["min", "max"]) tasks.push({ name, role: kind, kind, seconds: displaySeconds, ...display });
        }
    }
    let next = 0;
    const pump = async () => {
        while (next < tasks.length && !signal.aborted) {
            const task = tasks[next++];
            try {
                const dataset = await fetchSeries(task.name, task.kind, task.seconds, task.from, task.to, signal);
                if (signal.aborted || request !== controller || !state.pvs.includes(task.name)) continue;
                if (task.role === "summary") {
                    state.summary.set(task.name, dataset);
                    if (shared) state.data.set(task.name, dataset);
                } else if (task.role === "display") {
                    state.data.set(task.name, dataset);
                } else {
                    const band = state.bands.get(task.name) || {};
                    band[task.role] = dataset;
                    state.bands.set(task.name, band);
                }
            } catch (error) {
                if (signal.aborted || request !== controller || !state.pvs.includes(task.name)) continue;
                const text = String(error.message || error);
                if (task.role === "summary") {
                    state.summaryFailures.set(task.name, text);
                    if (shared) state.failures.set(task.name, text);
                } else if (task.role === "display") {
                    state.failures.set(task.name, text);
                } else {
                    state.failures.set(task.name, `${task.role}: ${text}`);
                }
            }
            if (!signal.aborted && request === controller) render();
        }
    };
    await Promise.all(Array.from({ length: CONCURRENT_REQUESTS }, pump));
}

/** The min and max datasets of the display of a PV, when both are there. */
function bandOf(name) {
    const band = state.bands.get(name);
    return band && band.min && band.max ? { min: band.min.points, max: band.max.points } : null;
}

function timeData() {
    return { from: state.from, to: state.to,
        windowChosen: +state.from !== +state.selected.from || +state.to !== +state.selected.to,
        canPanLater: state.to.getTime() < Date.now(),
        // The selected dataset: the PVs, the selected range and its resolution. A change of it starts the chart's
        // history and references anew.
        datasetKey: `${state.pvs.join("\n")}|${+state.selected.from}|${+state.selected.to}|${state.sample}` };
}

function renderInputs(force = false) {
    const key = `${+state.from}:${+state.to}:${currentZone()}`;
    if (force || key !== inputKey) {
        $("fromTime").value = inputTime(state.from);
        $("toTime").value = inputTime(state.to);
        inputKey = key;
    }
    $("timeControls").replaceChildren(buildRangeStrip({ ...timeData(), timeZone: currentZone(),
        onPan: panBy, onReset: resetTime, values: false }, new Map(), [], () => {}));
    $("activeRange").textContent = `${formatInZone(state.from, "%Y-%m-%d %H:%M:%S", currentZone())} to ${formatInZone(state.to, "%Y-%m-%d %H:%M:%S", currentZone())} ${zoneName(currentZone(), state.to)}`;
}

function removePV(name) {
    state.pvs = state.pvs.filter((other) => other !== name);
    state.data.delete(name);
    state.failures.delete(name);
    writeAddress();
    render();
    $("pvName").focus();
}

// The choices of the per-signal and per-unit settings and of the display settings, as the chart defines them.
const DASH_CHOICES = [["auto", "Profile"], ["solid", "Solid"], ["dash", "Dash"], ["dot", "Dot"], ["dashdot", "Dash dot"]];
const SCALE_CHOICES = [["", "Y scale option"], ["linear", "Linear"], ["symlog", "Symmetric log"], ["log", "Log"], ["sqrt", "Square root"]];
const LEGEND_CHOICES = [["list", "List"], ["table", "Table with values"], ["off", "Off"]];
const LEGEND_STATISTIC_CHOICES = [["min", "Min"], ["max", "Max"], ["mean", "Mean"], ["median", "Median"], ["std", "Std dev"], ["last", "Last"], ["count", "Samples"]];
const TOOLTIP_CHOICES = [["all", "All lines"], ["single", "Nearest line"]];
const TIPSORT_CHOICES = [["series", "Line order"], ["asc", "Value ascending"], ["desc", "Value descending"]];
const GRID_CHOICES = [["y", "Horizontal"], ["x", "Vertical"], ["both", "Both"], ["off", "Off"]];

/** A select of choices ([value, text]) with the current value, or the first when none matches. */
function choiceSelect(label, choices, current, attributes = {}) {
    const select = node("select", { "aria-label": label, ...attributes });
    for (const [value, text] of choices) {
        const option = node("option", { value }, text);
        option.selected = value === String(current ?? choices[0][0]);
        select.append(option);
    }
    return select;
}

/** A number typed in a form: null for blank, NaN for unreadable, else the number. */
function typedNumber(text) {
    const trimmed = text.trim();
    return trimmed === "" ? null : Number(trimmed);
}

/** The value of a form field as text, for comparison with the value it was built with. */
function fieldText(field) {
    return field.type === "checkbox" ? String(field.checked) : field.value;
}

/** Marks the fields of a form with the values they were built with, so that a changed field can be told apart. */
function markBuilt(form) {
    for (const field of form.querySelectorAll("input[aria-label], select[aria-label]")) {
        field.dataset.built = fieldText(field);
    }
}

/**
 * The values changed in the forms of a panel but not applied yet, by the label of each field, so that a panel built
 * again after a change elsewhere on the page shows them still; restoreTyped puts them back into the new fields. A
 * field that still shows the value it was built with is left to the new form, which shows the current state.
 */
function captureTyped(host) {
    const typed = new Map();
    for (const field of host.querySelectorAll("input[aria-label], select[aria-label]")) {
        if (field.dataset.built !== undefined && fieldText(field) !== field.dataset.built) {
            typed.set(field.getAttribute("aria-label"), field.type === "checkbox" ? field.checked : field.value);
        }
    }
    return typed;
}

function restoreTyped(host, typed) {
    for (const field of host.querySelectorAll("input[aria-label], select[aria-label]")) {
        const label = field.getAttribute("aria-label");
        if (!typed.has(label)) continue;
        if (field.type === "checkbox") field.checked = typed.get(label); else field.value = typed.get(label);
    }
}

function renderSignals() {
    const focusedLabel = $("signals").contains(document.activeElement) ? document.activeElement.getAttribute("aria-label") : null;
    const typed = captureTyped($("signals"));
    const chartState = chart.getState();
    const hidden = new Set(chartState.hidden);
    const signalSettings = new Map(chartState.signals);
    $("chips").replaceChildren();
    $("signals").replaceChildren();
    for (const name of state.pvs) {
        const series = state.data.get(name);
        const failure = state.failures.get(name);
        const remove = node("button", { type: "button", class: "plain", "aria-label": `Remove ${name}` }, "Remove");
        remove.addEventListener("click", () => removePV(name));
        $("chips").append(node("li", null, node("span", { class: "pv" }, name),
            node("span", { class: "unit-label" }, series?.egu || (series ? "no unit" : "")), remove));
        const visible = node("input", { type: "checkbox", "aria-label": `Show ${name}` });
        visible.checked = !hidden.has(name);
        visible.addEventListener("change", () => {
            if (visible.checked) hidden.delete(name); else hidden.add(name);
            chart.setState({ hidden: [...hidden] });
        });
        // The drawing settings of the signal: display name, width, dash, gap, fill partner and decimals.
        const current = signalSettings.get(name) || {};
        const field = (label, attributes, value) => {
            const input = node("input", { "aria-label": `${label} of ${name}`, ...attributes });
            input.value = value === undefined || value === null ? "" : String(value);
            return [node("label", null, label, input), input];
        };
        const [nameLabel, nameInput] = field("Display name", { type: "text", maxlength: "128", placeholder: name }, current.name);
        const [widthLabel, widthInput] = field("Width", { type: "number", step: "0.5", min: "0.5", max: "10", placeholder: "Profile" }, current.width);
        const dashSelect = choiceSelect(`Dash of ${name}`, DASH_CHOICES, current.dash || "auto");
        const [gapLabel, gapInput] = field("Gap (s)", { type: "number", step: "any", min: "0", placeholder: "None" }, current.gap);
        const partners = state.pvs.filter((other) => other !== name && state.data.get(other) && (state.data.get(other).egu || "") === (series?.egu || ""));
        const fillSelect = choiceSelect(`Fill of ${name}`, [["", "None"], ...partners.map((other) => [other, other])], current.fill || "");
        const [decimalsLabel, decimalsInput] = field("Decimals", { type: "number", step: "1", min: "0", max: "15", placeholder: "Auto" }, current.decimals);
        const error = node("p", { class: "error", role: "alert" });
        // The page checks the fields itself and explains an error beside the form, so the browser's own check is off.
        const form = node("form", { class: "signal-form", "data-pv": name, novalidate: "" },
            nameLabel, widthLabel, node("label", null, "Dash", dashSelect), gapLabel,
            node("label", null, "Fill with", fillSelect), decimalsLabel,
            node("button", { type: "submit" }, "Apply"), error);
        markBuilt(form);
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const next = {};
            const width = typedNumber(widthInput.value);
            const gap = typedNumber(gapInput.value);
            const decimals = typedNumber(decimalsInput.value);
            if (width !== null && !(width >= 0.5 && width <= 10)) { error.textContent = "Width is from 0.5 to 10 pixels, or blank for the profile."; return; }
            if (gap !== null && !(gap > 0)) { error.textContent = "The gap is a positive number of seconds, or blank for none."; return; }
            if (decimals !== null && !(Number.isInteger(decimals) && decimals >= 0 && decimals <= 15)) { error.textContent = "Decimals are a whole number from 0 to 15, or blank for automatic."; return; }
            if (nameInput.value.trim() && [...nameInput.value].length > 128) { error.textContent = "A display name has at most 128 characters."; return; }
            if (nameInput.value.trim()) next.name = nameInput.value.trim();
            if (width !== null) next.width = width;
            if (dashSelect.value !== "auto") next.dash = dashSelect.value;
            if (gap !== null) next.gap = gap;
            if (fillSelect.value) next.fill = fillSelect.value;
            if (decimals !== null) next.decimals = decimals;
            error.textContent = "";
            const updated = new Map(signalSettings);
            if (Object.keys(next).length) updated.set(name, next); else updated.delete(name);
            chart.setState({ signals: [...updated] });
        });
        $("signals").append(node("li", null, node("label", null, visible, node("span", { class: "pv" }, name)),
            node("p", { class: failure ? "warn" : "note" },
                failure ? `Retrieval failed: ${failure}` : series ? `${series.form}; ${series.egu || "no unit"}; ${series.points.length} returned.` : "Loading"),
            form));
    }
    restoreTyped($("signals"), typed);
    if (focusedLabel) {
        [...$("signals").querySelectorAll("input, select")].find((input) => input.getAttribute("aria-label") === focusedLabel)?.focus();
    }
}

/** The display settings of the Options tab: split, legend, its values, tooltip, its order, grid and line-end names. */
function renderDisplayOptions() {
    const host = $("displayOptions");
    const display = chart.getState().display;
    const apply = (patch) => chart.setState({ display: { ...display, ...patch } });
    const split = node("input", { type: "checkbox" });
    split.checked = display.split === "unit";
    split.addEventListener("change", () => apply({ split: split.checked ? "unit" : "none" }));
    const endlabels = node("input", { type: "checkbox" });
    endlabels.checked = display.endlabels === true;
    endlabels.addEventListener("change", () => apply({ endlabels: endlabels.checked }));
    const legend = choiceSelect("Legend", LEGEND_CHOICES, display.legend);
    legend.addEventListener("change", () => apply({ legend: legend.value }));
    const statistics = node("span", { class: "legend-statistics" });
    for (const [value, text] of LEGEND_STATISTIC_CHOICES) {
        const box = node("input", { type: "checkbox", value });
        box.checked = display.legendstat.includes(value);
        box.addEventListener("change", () => {
            const chosen = [...statistics.querySelectorAll("input:checked")].map((input) => input.value);
            if (chosen.length) apply({ legendstat: chosen }); else box.checked = true;
        });
        statistics.append(node("label", { class: "check-inline" }, box, ` ${text}`));
    }
    const tooltip = choiceSelect("Tooltip", TOOLTIP_CHOICES, display.tooltip);
    tooltip.addEventListener("change", () => apply({ tooltip: tooltip.value }));
    const tipsort = choiceSelect("Tooltip order", TIPSORT_CHOICES, display.tipsort);
    tipsort.addEventListener("change", () => apply({ tipsort: tipsort.value }));
    const grid = choiceSelect("Grid", GRID_CHOICES, display.grid);
    grid.addEventListener("change", () => apply({ grid: grid.value }));
    host.replaceChildren(
        node("div", { class: "opt-row" },
            node("label", null, "Legend ", legend), node("label", null, "Tooltip ", tooltip), node("label", null, "Tooltip order ", tipsort), node("label", null, "Grid ", grid)),
        node("p", { class: "note" }, "Legend values"), statistics,
        node("label", { class: "check" }, split, " Split by unit"),
        node("label", { class: "check" }, endlabels, " Names at the line ends"));
}

function renderAxes() {
    const typed = captureTyped($("axes"));
    const chartState = chart.getState();
    const ranges = new Map(chartState.ranges);
    const axesSettings = new Map(chartState.axes);
    const units = [...new Set([...state.data.values()].map((series) => series.egu || "").concat([...ranges.keys()], [...axesSettings.keys()]))];
    $("axes").replaceChildren();
    if (!units.length) $("axes").append(node("p", null, "Plot a numeric signal to configure its unit."));
    units.forEach((unit, index) => {
        const name = unit || "no unit";
        const range = ranges.get(unit);
        const current = axesSettings.get(unit) || {};
        const form = node("form", { class: "axis-form", "data-unit": unit, novalidate: "" });
        const number = (label, id, placeholder, value) => {
            const input = node("input", { type: "number", step: "any", id, "aria-label": `${label} ${name}`, placeholder });
            if (value !== undefined && value !== null) input.value = String(value);
            return input;
        };
        const low = number("Minimum", `axis-${index}-low`, "Auto", range ? range[0] : null);
        const high = number("Maximum", `axis-${index}-high`, "Auto", range ? range[1] : null);
        const softLow = number("Soft minimum", `axis-${index}-softlow`, "None", current.softmin);
        const softHigh = number("Soft maximum", `axis-${index}-softhigh`, "None", current.softmax);
        const scale = choiceSelect(`Scale ${name}`, SCALE_CHOICES, current.scale || "");
        const symlog = number("Symmetric log constant", `axis-${index}-symlog`, "Auto", current.symlog);
        const zero = node("input", { type: "checkbox", "aria-label": `Zero centered ${name}` });
        zero.checked = current.zero === true;
        const prefix = node("input", { type: "checkbox", "aria-label": `SI prefix ${name}` });
        prefix.checked = current.prefix === "si";
        const label = node("input", { type: "text", maxlength: "128", "aria-label": `Label ${name}`, placeholder: name });
        label.value = current.label || "";
        const error = node("p", { class: "error", role: "alert" });
        const automatic = node("button", { type: "button" }, "Auto");
        form.append(node("h3", null, unit || "No unit"),
            node("label", null, "Minimum", low), node("label", null, "Maximum", high),
            node("label", null, "Soft minimum", softLow), node("label", null, "Soft maximum", softHigh),
            node("label", null, "Scale", scale), node("label", null, "Symmetric log constant", symlog),
            node("label", { class: "check-inline" }, zero, " Zero centered"), node("label", { class: "check-inline" }, prefix, " SI prefix"),
            node("label", null, "Label", label),
            node("button", { type: "submit" }, "Apply"), automatic, error);
        markBuilt(form);
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const minimum = typedNumber(low.value), maximum = typedNumber(high.value);
            const softMinimum = typedNumber(softLow.value), softMaximum = typedNumber(softHigh.value);
            const constant = typedNumber(symlog.value);
            if ((minimum === null) !== (maximum === null)) { error.textContent = "Enter both a minimum and a maximum for a fixed range, or neither for the automatic range."; return; }
            if (minimum !== null && !(Number.isFinite(minimum) && Number.isFinite(maximum) && minimum < maximum)) { error.textContent = "Enter a finite minimum below the maximum."; return; }
            if ((softMinimum !== null && !Number.isFinite(softMinimum)) || (softMaximum !== null && !Number.isFinite(softMaximum))
                || (softMinimum !== null && softMaximum !== null && softMinimum >= softMaximum)) { error.textContent = "Soft bounds are finite numbers, the minimum below the maximum; either may be blank."; return; }
            if (constant !== null && !(constant > 0)) { error.textContent = "The symmetric log constant is a positive number, or blank for automatic."; return; }
            if (label.value.trim() && [...label.value].length > 128) { error.textContent = "A label has at most 128 characters."; return; }
            error.textContent = "";
            const next = {};
            if (scale.value) next.scale = scale.value;
            if (constant !== null) next.symlog = constant;
            if (softMinimum !== null) next.softmin = softMinimum;
            if (softMaximum !== null) next.softmax = softMaximum;
            if (zero.checked) next.zero = true;
            if (prefix.checked) next.prefix = "si";
            if (label.value.trim()) next.label = label.value.trim();
            const nextAxes = new Map(axesSettings);
            if (Object.keys(next).length) nextAxes.set(unit, next); else nextAxes.delete(unit);
            const nextRanges = new Map(chart.getState().ranges);
            if (minimum !== null) nextRanges.set(unit, [minimum, maximum]); else nextRanges.delete(unit);
            chart.setState({ ranges: [...nextRanges], axes: [...nextAxes] });
        });
        automatic.addEventListener("click", () => chart.setState({ ranges: chart.getState().ranges.filter(([other]) => other !== unit) }));
        $("axes").append(form);
    });
    restoreTyped($("axes"), typed);
}

function render() {
    renderInputs();
    renderSignals();
    renderAxes();
    const loaded = state.pvs.map((name) => state.data.get(name)).filter(Boolean);
    const failed = state.pvs.filter((name) => state.failures.has(name)).length;
    const waiting = state.pvs.length - loaded.length - failed;
    $("message").textContent = !state.pvs.length ? "Choose an archived PV and select Plot."
        : waiting ? `Loading ${waiting} of ${state.pvs.length} signals...`
        : failed ? `${failed} of ${state.pvs.length} signals could not be read. See Signals for details.`
        : `${loaded.length} signals retrieved.`;
    const displaySeconds = state.displaySeconds ?? resolutionOf(state.from, state.to);
    const band = state.minmax && displaySeconds !== "raw" ? " with the min-max band" : "";
    // The band is the min and the max of each averaging interval; raw samples have no interval, so it is left out and said so.
    const bandNote = state.minmax && displaySeconds === "raw" ? "The min-max band is not available for raw samples. " : "";
    const note = `Display: ${sourceText(displaySeconds)}${band}; intervals without samples stay empty. ${bandNote}`
        + `Summary: ${sourceText(state.sample ?? resolutionOf(state.selected.from, state.selected.to))} over the selected range. `
        + `Visible range counts the displayed samples inside the time and Y ranges.${failed ? " Some signals are missing." : ""}`;
    $("sourceNote").textContent = note;
    $("dataNote").textContent = note;
    renderSummary();
    renderDataTable();
    resolvePins();
    if (state.view === "distribution") {
        distribution.render();
    } else if (state.view === "spectrum") {
        spectrum.render();
    } else if (state.view === "correlation") {
        correlation.render();
    } else if (state.view === "compare") {
        compare.render();
    } else if (state.view !== "trend") {
        chart.message("This analysis has not run.");
    } else if (loaded.some((series) => series.points.length)) {
        trendTools.render();
        chart.draw({ series: loaded.map((series, index) => ({ ...series, focus: index === 0, minmax: bandOf(series.name) })),
            ...timeData(), gapMs: Infinity, overlay: trendTools.overlay });
    } else {
        chart.message(waiting ? "Loading samples..." : state.pvs.length ? "No supported numeric samples in this range." : "Select archived signals to draw their trend.",
            state.pvs.length ? timeData() : undefined);
        trendTools.render();
    }
    // A navigation unit that none of the loaded PVs has falls back to the time axis once every PV has answered, which
    // writes the address again without it; while one is still loading the unit is kept, since its data may still arrive.
    const navigation = chart.getState();
    if (state.view === "trend" && navigation.nav !== "x" && !waiting && !loaded.some((series) => (series.egu || "") === navigation.navUnit)) {
        chart.setState({ nav: "x", navUnit: null });
    }
}

function applyRange(from, to, selected = false) {
    state.from = from;
    state.to = to;
    if (selected) {
        // A new selected range is a new selected dataset: its resolution is resolved again from the interval option.
        state.selected = { from, to };
        state.sample = null;
    }
    $("rangeError").textContent = "";
    writeAddress();
    renderInputs(true);
    load();
}

/**
 * The Summary tables: the statistics of the selected dataset of each PV, in the results and in the Data tab. The
 * retrieval also returns the last record before the selected range, which the line holds from the start; the
 * statistics count the records inside the range only, both ends included.
 */
function renderSummary() {
    const { from, to } = state.selected;
    const rows = state.pvs.flatMap((name, index) => {
        const dataset = state.summary.get(name);
        if (!dataset) return [];
        const values = dataset.records.filter((record) => record.t >= from.getTime() && record.t <= to.getTime() && Number.isFinite(record.v)).map((record) => record.v);
        return [{ name, egu: dataset.egu, color: lineLook(dataset, index).color, values }];
    });
    for (const host of [$("summary"), $("dataSummary")]) {
        host.replaceChildren();
        if (rows.length) host.append(buildStatistics(rows, infoButton(...CARDS.summary), "Summary"));
    }
}

/** The help page of the console, for the Help link of the cards, once the menu has resolved the console addresses. */
function helpPage() {
    return document.querySelector("ul.mainmenu").dataset.ready === "true" ? $("help").href : null;
}

/**
 * The information cards of the page's own calculations, in the form of the console's cards: the title a question, In short
 * the first row. The chart widget carries the cards of its ranges, options and Visible range.
 */
const CARDS = {
    summary: [
        "Summary: which samples does it count?",
        [
            ["In short", "The samples of the selected range at the resolution the line above the plot names for the Summary, whatever the plot shows now; Visible range counts the displayed samples inside the time and Y ranges."],
            ["Selected range", `From and To with Show, a shortcut or Apply selection choose the selected range. Its resolution is resolved once, the stored samples up to ${TARGET_SAMPLES} seconds and above that means over whole seconds, about ${TARGET_SAMPLES} of them, and it is kept while you pan or zoom.`],
            ["Means", "A mean over N seconds is the retrieval's meanSample_N: the mean of the stored samples of each interval of N seconds. An interval without a sample has no value and is not counted."],
            ["Columns", "Samples is the number of finite values; Min, Mean, Median and Max their smallest value, mean, median and largest value; Std dev their sample standard deviation (N - 1), 0 with fewer than two samples; Unit the unit of the PV."],
        ],
        null,
        helpPage,
    ],
    interval: [
        "Interval and band: what is drawn?",
        [
            ["In short", `Automatic draws the stored samples of a window up to ${TARGET_SAMPLES} seconds and means over whole seconds above that, about ${TARGET_SAMPLES} per window. Raw samples forces the stored samples; Seconds forces means over the interval typed.`],
            ["Means", "The mean of each interval is the retrieval's meanSample_N over the stored samples of that interval. An interval without a sample stays empty, and the line is not drawn through it."],
            ["Min-max band", "The band is the minimum and the maximum of the stored samples of each averaging interval, the retrieval's minSample_N and maxSample_N, drawn under the mean. Raw samples have no interval, so the band is left out."],
            ["Display and Summary", "The display resolution follows the window shown; the Summary keeps the resolution of the selected range. The note above the plot names both."],
        ],
        null,
        helpPage,
    ],
    export: [
        "Export sources: how are the values produced?",
        [
            ["In short", "Samples shown and Raw samples are the retrieval's values as they are. Optimized bins and Linear interpolation are calculated for the chosen range, and the CSV names its source, range and interval in its first lines."],
            ["Samples shown", "The values the plot draws over the range: the stored samples or the display means."],
            ["Raw samples", "Every stored sample of the range, with its severity and status."],
            ["Optimized bins", "The range divided into the number of bins asked for: the retrieval's mean, minimum and maximum of the stored samples over each interval (meanSample_N, minSample_N, maxSample_N). The interval is the span divided by the bins, rounded up to whole seconds, so there can be fewer bins than asked for."],
            ["Linear interpolation", "A row at from, from + step and so on up to to, each value interpolated between the two stored samples around that time; the sample before the range comes from one getDataAtTime request. No value is made before the first or after the last sample, across a recorded gap, between samples farther apart than the gap typed, or through conflicting samples: the row stays, with an empty value and the reason in the quality and reason columns. An interpolated value takes the higher severity of its two samples and no status."],
            ["Statistics", "Visible range or the Summary as the tables show them, with the source and the range of every row."],
        ],
        null,
        helpPage,
    ],
};

/** The retrieval options of the Options tab: the interval of the display and the selected dataset, and the min-max band. */
function renderRetrievalOptions() {
    const host = $("retrievalOptions");
    const choice = node("select", { "aria-label": "Interval" });
    for (const [value, text] of [["auto", "Automatic"], ["raw", "Raw samples"], ["seconds", "Seconds"]]) {
        const option = node("option", { value }, text);
        option.selected = value === (typeof state.interval === "number" ? "seconds" : state.interval);
        choice.append(option);
    }
    const seconds = node("input", { type: "number", min: "1", max: String(INTERVAL_MOST), step: "1", "aria-label": "Interval in seconds" });
    seconds.value = typeof state.interval === "number" ? String(state.interval) : "";
    seconds.hidden = choice.value !== "seconds";
    const apply = node("button", { type: "button" }, "Apply");
    apply.hidden = seconds.hidden;
    const error = node("p", { class: "error", role: "alert" });
    const change = (interval) => {
        state.interval = interval;
        state.sample = null;
        error.textContent = "";
        writeAddress();
        load();
    };
    choice.addEventListener("change", () => {
        seconds.hidden = choice.value !== "seconds";
        apply.hidden = seconds.hidden;
        if (choice.value !== "seconds") change(choice.value);
    });
    apply.addEventListener("click", () => {
        const value = Number(seconds.value);
        if (!/^\d+$/.test(seconds.value.trim()) || value < 1 || value > INTERVAL_MOST) {
            error.textContent = `Enter whole seconds from 1 to ${INTERVAL_MOST}.`;
            return;
        }
        change(value);
    });
    const minmax = node("input", { type: "checkbox" });
    minmax.checked = state.minmax;
    minmax.addEventListener("change", () => {
        state.minmax = minmax.checked;
        writeAddress();
        load();
    });
    const info = infoButton(...CARDS.interval);
    info.classList.add("opt-info");
    host.replaceChildren(
        node("div", { class: "opt-row" }, node("label", null, "Interval ", choice), node("label", null, "Seconds ", seconds), apply, info),
        node("label", { class: "check" }, minmax, " Min-max band of the display means"),
        error);
}

function panBy(direction) {
    const span = state.to - state.from;
    const to = Math.min(Date.now(), state.to.getTime() + direction * span / 2);
    applyRange(new Date(to - span), new Date(to));
}

function resetTime() {
    applyRange(state.selected.from, state.selected.to);
}

/**
 * Says that a view has no tool in this version. The view of the page in view stays, unless the page was opened on the
 * unavailable view itself (restored), when no view is shown and Return to Trend is offered.
 */
function explainView(view, restored = false) {
    const label = view[0].toUpperCase() + view.slice(1);
    $("unavailableView").hidden = false;
    $("unavailableReason").textContent = `${label} is not available in this version. No ${view} analysis has run.`;
    $("returnTrend").hidden = !restored;
    $("trendPanel").hidden = restored || state.view !== "trend";
    $("distributionPanel").hidden = restored || state.view !== "distribution";
    $("comparePanel").hidden = restored || state.view !== "compare";
    $("spectrumPanel").hidden = restored || state.view !== "spectrum";
    $("correlationPanel").hidden = restored || state.view !== "correlation";
}

/** Shows the panel of an available view and marks its tab, without writing the address or drawing. */
function activateView(view) {
    state.view = view;
    $("trendPanel").hidden = view !== "trend";
    $("distributionPanel").hidden = view !== "distribution";
    $("comparePanel").hidden = view !== "compare";
    $("spectrumPanel").hidden = view !== "spectrum";
    $("correlationPanel").hidden = view !== "correlation";
    $("unavailableView").hidden = true;
    for (const tab of $("analysisTabs").querySelectorAll('[role="tab"]')) {
        const active = tab.dataset.view === view;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
    }
}

function showView(view) {
    activateView(view);
    writeAddress();
    render();
}

function showTrend() {
    showView("trend");
}

function wireTabs(host, activate) {
    const tabs = [...host.querySelectorAll('[role="tab"]')];
    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => activate(tab));
        tab.addEventListener("keydown", (event) => {
            const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
                : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
                : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
            if (next < 0) return;
            event.preventDefault();
            tabs.forEach((item, i) => { item.tabIndex = i === next ? 0 : -1; });
            tabs[next].focus();
        });
    });
}

/** The Data tab: the samples of the display dataset inside the displayed window, with their source fields. */
function renderDataTable() {
    const host = $("dataSamples");
    host.replaceChildren();
    if (!state.selected || !state.pvs.length) return;
    const zone = currentZone();
    const from = state.from.getTime(), to = state.to.getTime();
    const table = node("table", { class: "chart-stats data-samples", "aria-label": "Samples in view" });
    table.append(node("thead", null, node("tr", null, ...["PV", "Time", "Value", "Severity", "Status", "Source"].map((text) => node("th", { scope: "col" }, text)))));
    const body = node("tbody", null);
    let shown = 0, total = 0;
    for (const name of state.pvs) {
        const dataset = state.data.get(name);
        if (!dataset) continue;
        const inView = dataset.records.filter((record) => record.t >= from && record.t <= to);
        total += inView.length;
        const source = `${sourceText(dataset.seconds)}${dataset.egu ? `; ${dataset.egu}` : ""}`;
        for (const record of inView.slice(0, DATA_ROWS_MOST)) {
            body.append(node("tr", null, node("td", null, name), node("td", { class: "num" }, isoText(nanosOf(record), zone)),
                node("td", { class: "num" }, record.v === null ? record.text : String(record.v)),
                node("td", null, SEVERITY_NAMES[record.severity] || String(record.severity)), node("td", { class: "num" }, String(record.status)), node("td", null, source)));
            shown += 1;
        }
    }
    table.append(body);
    host.append(node("p", { class: "note" }, total ? `${shown} of ${total} samples in view${shown < total ? `; the first ${DATA_ROWS_MOST} of each PV are listed` : ""}.` : "No samples in view."));
    if (total) host.append(table);
}

// The choices of the Export tab, as the page names them.
const EXPORT_PRODUCTS = [["data", "Data as CSV"], ["statistics", "Statistics as CSV"], ["png", "Plot as PNG"], ["svg", "Plot as SVG"],
    ["link", "Address of this view"], ["serverCsv", "Server CSV (getData.csv)"], ["serverMat", "Server MAT (getData.mat)"]];
const EXPORT_SOURCES = [["plot", "Samples shown"], ["raw", "Raw samples"], ["optimized", "Optimized bins (min, mean, max)"], ["interpolated", "Linear interpolation"]];
const EXPORT_RANGES = [["view", "Range shown"], ["custom", "Typed range"]];
const EXPORT_LAYOUTS = [["long", "Long (time, pv, value)"], ["wide", "Wide (one column per PV)"]];
const EXPORT_FORMATS = [["source", "As stored"], ["fixed", "Fixed decimals"], ["exponential", "Exponential"]];
const EXPORT_TIMES = [["iso", "ISO 8601 in the zone"], ["unixms", "UNIX milliseconds"]];
const EXPORT_STATS = [["visible", "Visible range"], ["selected", "Summary (selected dataset)"]];
const BINS_MOST = 1000000;

/** Why a server product cannot serve the current choices, or null when it can. */
function serverLimit(choice) {
    if (choice.source === "plot" || choice.source === "interpolated") return "The server streams raw samples and the mean, min and max operators; it does not produce the samples shown or an interpolation.";
    if (choice.layout === "wide") return "The server writes one PV per file, not a wide table.";
    if (choice.time === "unixms" || choice.values !== "source") return "The server writes its own columns (secs, value, severity, status, nanos) and does not format times or values.";
    return null;
}

/** The Export tab: the product and the choices it takes, with the action that runs it. */
function renderExport() {
    const host = $("exportForm");
    const choice = state.export;
    const focusedLabel = host.contains(document.activeElement) ? document.activeElement.getAttribute("aria-label") : null;
    // A changed choice clears the links and the explanation of the last run; they belonged to the choices before it.
    const set = (key) => (event) => {
        choice[key] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
        $("exportLinks").replaceChildren();
        $("exportError").textContent = "";
        renderExport();
    };
    const select = (label, key, choices) => {
        const control = choiceSelect(label, choices, choice[key]);
        control.addEventListener("change", set(key));
        return node("label", null, `${label} `, control);
    };
    const text = (label, key, attributes) => {
        const control = node("input", { "aria-label": label, ...attributes });
        control.value = choice[key];
        control.addEventListener("change", set(key));
        return node("label", null, `${label} `, control);
    };
    const box = (label, key) => {
        const control = node("input", { type: "checkbox", "aria-label": label });
        control.checked = choice[key] === true;
        control.addEventListener("change", set(key));
        return node("label", { class: "check-inline" }, control, ` ${label}`);
    };
    const product = choice.product;
    const data = product === "data";
    const server = product === "serverCsv" || product === "serverMat";
    const rows = [select("Product", "product", EXPORT_PRODUCTS)];
    if (data || server) {
        rows.push(select("Range", "range", EXPORT_RANGES));
        if (choice.range === "custom") {
            rows.push(text("Export from", "from", { type: "datetime-local", step: "0.001" }), text("Export to", "to", { type: "datetime-local", step: "0.001" }));
        }
        rows.push(select("Source", "source", EXPORT_SOURCES));
        if (choice.source === "optimized") rows.push(text("Bins", "bins", { type: "number", min: "1", max: String(BINS_MOST), step: "1" }));
        if (choice.source === "interpolated") {
            rows.push(text("Step (s)", "step", { type: "text", inputmode: "decimal" }), text("Gap (s)", "gap", { type: "text", inputmode: "decimal", placeholder: "None" }));
        }
    }
    if (data) {
        rows.push(select("Layout", "layout", EXPORT_LAYOUTS), box("Severity and status", "alarms"), select("Values", "values", EXPORT_FORMATS));
        if (choice.values !== "source") rows.push(text("Decimal places", "decimals", { type: "number", min: "0", max: "15", step: "1" }));
        rows.push(select("Time", "time", EXPORT_TIMES), box("Unit in the header", "units"));
    }
    if (product === "statistics") rows.push(select("Statistics of", "stats", EXPORT_STATS));
    const limit = server ? serverLimit(choice) : null;
    const run = $("runExport");
    run.textContent = product === "link" ? "Copy link" : server ? "Show links" : "Download";
    run.disabled = Boolean(limit);
    const info = infoButton(...CARDS.export);
    info.classList.add("opt-info");
    host.replaceChildren(node("div", { class: "opt-row export-form" }, ...rows, info));
    $("exportNote").textContent = limit || {
        data: "A CSV of the chosen source over the chosen range, with metadata lines first.",
        statistics: "The statistics table as CSV, naming its dataset, source and interval.",
        png: "The plot as it is drawn, with its axes and the visible lines.",
        svg: "The plot as it is drawn, as a scalable image.",
        link: "The address of this view with every option; archived data can change after it is copied.",
        serverCsv: "The retrieval's own CSV, one file per PV with the columns secs, value, severity, status and nanos; the browser holds no copy.",
        serverMat: "The retrieval's own MATLAB file, one per PV, as the server produces it.",
    }[product];
    if (focusedLabel) {
        [...host.querySelectorAll("input, select")].find((control) => control.getAttribute("aria-label") === focusedLabel)?.focus();
    }
}

/** Saves text or binary content as a file through a temporary link. */
function saveFile(content, type, filename) {
    const address = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
    const link = node("a", { href: address, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(address), 1000);
}

/** The export range: the shown range, or the typed range when it is valid; an invalid typed range falls back with a note. */
function exportRange() {
    const choice = state.export;
    if (choice.range === "custom") {
        const from = readTime(choice.from, state.from), to = readTime(choice.to, state.to);
        if (from && to && from < to) return { from, to, custom: true };
        $("exportError").textContent = "The typed range is not valid (From must be before To); the shown range was used.";
    }
    return { from: state.from, to: state.to, custom: false };
}

/** The last observation at or before a time for each PV, from the retrieval, keyed by PV; a PV without one is absent. */
async function dataAtTime(names, at) {
    const query = new URLSearchParams({ at: at.toISOString(), searchPeriod: SEARCH_PERIOD });
    const response = await fetch(`${DATA_AT_TIME}?${query}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(names) });
    if (!response.ok) throw new Error(`The retrieval could not give the observation before the range (HTTP ${response.status}).`);
    const body = await response.json();
    const out = new Map();
    for (const name of names) {
        const event = body && typeof body === "object" ? body[name] : null;
        if (!event || event.secs === undefined) continue;
        const finite = typeof event.val === "number" && Number.isFinite(event.val);
        out.set(name, { secs: Number(event.secs), nanos: Number(event.nanos || 0), v: finite ? event.val : null, text: finite ? null : JSON.stringify(event.val ?? null),
            severity: Number(event.severity) || 0, status: Number(event.status) || 0, lost: false });
    }
    return out;
}

/** The rows of a dataset inside a range, as the CSV tables take them. */
function recordRows(dataset, fromNs, toNs) {
    return dataset.records.map((record) => ({ ...record, t: nanosOf(record), value: record.v === null ? record.text : record.v }))
        .filter((row) => row.t >= fromNs && row.t <= toNs);
}

/** Runs the chosen product of the Export tab. */
async function runExport() {
    const choice = state.export;
    const error = $("exportError");
    error.textContent = "";
    $("exportLinks").replaceChildren();
    const run = $("runExport");
    run.disabled = true;
    try {
        if (choice.product === "link") {
            await copyAddress();
        } else if (choice.product === "png" || choice.product === "svg") {
            await savePlot(choice.product);
        } else if (choice.product === "statistics") {
            saveStatistics();
        } else {
            const range = exportRange();
            if (choice.product === "serverCsv" || choice.product === "serverMat") {
                showServerLinks(range);
            } else {
                await saveData(range);
            }
        }
    } catch (failure) {
        error.textContent = String(failure.message || failure);
    } finally {
        run.disabled = Boolean(choice.product.startsWith("server") && serverLimit(choice));
    }
}

async function copyAddress() {
    writeAddress();
    try {
        await navigator.clipboard.writeText(window.location.href);
        $("message").textContent = "Link copied.";
    } catch (failure) {
        $("message").textContent = "Copy the current address from the address bar; clipboard access is unavailable.";
    }
}

/** The data CSV: the chosen source over the range, in the chosen layout and formats, with metadata lines first. */
async function saveData(range) {
    const choice = state.export;
    const zone = currentZone();
    const fromNs = nanosOfDate(range.from), toNs = nanosOfDate(range.to);
    const precision = /^\d+$/.test(String(choice.decimals).trim()) ? Number(String(choice.decimals).trim()) : NaN;
    if (choice.values !== "source" && !(precision >= 0 && precision <= 15)) throw new Error("Decimal places are a whole number from 0 to 15.");
    const metadata = [`product: data`, `source: ${choice.source}`, `range: ${range.from.toISOString()} to ${range.to.toISOString()} (${range.custom ? "typed" : "shown"})`,
        `time: ${choice.time === "unixms" ? "UNIX milliseconds" : `ISO 8601 in ${zoneName(zone, range.from)}`}`, `values: ${choice.values}${choice.values === "source" ? "" : ` with ${precision} decimal places`}`];
    const series = [];
    let step = null, gap = null, preceding = new Map();
    if (choice.source === "interpolated") {
        step = parseDuration(choice.step);
        if (step === null) throw new Error("The interpolation step is positive decimal seconds with at most nine fractional digits.");
        if (choice.gap.trim() !== "") {
            gap = parseDuration(choice.gap);
            if (gap === null) throw new Error("The interpolation gap is positive decimal seconds with at most nine fractional digits, or blank for none.");
        }
        metadata.push(`step: ${choice.step.trim()} s`, `gap: ${gap === null ? "none" : `${choice.gap.trim()} s`}`, `preceding observation: data/getDataAtTime at ${range.from.toISOString()} with searchPeriod ${SEARCH_PERIOD}`);
        preceding = await dataAtTime(state.pvs, range.from);
    }
    let bins = null, interval = null;
    if (choice.source === "optimized") {
        bins = Number(choice.bins);
        if (!(/^\d+$/.test(choice.bins.trim()) && bins >= 1 && bins <= BINS_MOST)) throw new Error(`Bins is a whole number from 1 to ${BINS_MOST}.`);
        interval = intervalForBins(range.from.getTime(), range.to.getTime(), bins);
        if (interval > INTERVAL_MOST) throw new Error("The range is too long for one retrieval interval; choose a shorter range or more bins.");
        metadata.push(`requested bins: ${bins}`, `interval: ${interval} s`);
    }
    for (const name of state.pvs) {
        if (choice.source === "plot") {
            const dataset = state.data.get(name);
            if (!dataset) continue;
            if (range.custom && (range.from < dataset.from || range.to > dataset.to)) {
                throw new Error("Samples shown cover the displayed range only; the typed range lies outside them. Choose Raw samples or the shown range.");
            }
            metadata.push(`${name}: ${sourceText(dataset.seconds)}`);
            series.push({ name, unit: dataset.egu, rows: recordRows(dataset, fromNs, toNs) });
        } else if (choice.source === "raw") {
            const dataset = await fetchSeries(name, "mean", "raw", range.from, range.to);
            series.push({ name, unit: dataset.egu, rows: recordRows(dataset, fromNs, toNs) });
        } else if (choice.source === "optimized") {
            const [mean, min, max] = await Promise.all(["mean", "min", "max"].map((kind) => fetchSeries(name, kind, interval, range.from, range.to)));
            const minAt = new Map(min.records.map((record) => [String(nanosOf(record)), record]));
            const maxAt = new Map(max.records.map((record) => [String(nanosOf(record)), record]));
            const rows = recordRows(mean, fromNs, toNs).map((row) => {
                const key = String(row.t);
                return { ...row, min: minAt.get(key)?.v ?? null, max: maxAt.get(key)?.v ?? null };
            });
            metadata.push(`${name}: ${rows.length} bins returned`);
            series.push({ name, unit: mean.egu, rows });
        } else {
            const dataset = await fetchSeries(name, "mean", "raw", range.from, range.to);
            const observations = observationsOf(preceding.get(name) || null, dataset.records, fromNs);
            const rows = interpolateRows(observations, gridOf(fromNs, toNs, step), gap);
            metadata.push(`${name}: ${preceding.has(name) ? "preceding observation found" : "no preceding observation within the search period"}`);
            series.push({ name, unit: dataset.egu, rows });
        }
    }
    const total = series.reduce((sum, s) => sum + s.rows.length, 0);
    if (total > EXPORT_ROWS_MOST) throw new Error(`This export has ${total} rows; choose a shorter range, fewer bins or the server product.`);
    const options = { alarms: choice.alarms === true, units: choice.units === true, bins: choice.source === "optimized", quality: choice.source === "interpolated" };
    const cell = { time: (t) => timeText(t, choice.time, zone), value: (value) => valueText(value, choice.values, precision),
        plain: (value) => (value === null || value === undefined ? "" : String(value)) };
    const table = choice.layout === "wide" ? wideTable(series, options, cell) : longTable(series, options, cell);
    saveFile(csvText(metadata, table.header, table.rows), "text/csv", `analyzer-${choice.source}.csv`);
    $("message").textContent = `Exported ${total} rows of ${choice.source} data.`;
}

/** The statistics CSV: the Visible range rows or the Summary rows, with the dataset they come from. */
function saveStatistics() {
    const choice = state.export;
    const selected = choice.stats === "selected";
    const ranges = new Map(chart.getState().ranges);
    const rows = [];
    for (const name of state.pvs) {
        const dataset = selected ? state.summary.get(name) : state.data.get(name);
        if (!dataset) continue;
        const { from, to } = selected ? state.selected : { from: state.from, to: state.to };
        const range = selected ? null : ranges.get(dataset.egu || "");
        const values = dataset.records.filter((record) => record.t >= from.getTime() && record.t <= to.getTime() && Number.isFinite(record.v)
            && (!range || (record.v >= range[0] && record.v <= range[1]))).map((record) => record.v);
        const statistic = (fn) => (values.length ? String(fn(values)) : "");
        rows.push([name, dataset.egu || "", String(values.length), statistic(d3.min), statistic(d3.mean), statistic(d3.median), statistic(d3.max),
            values.length > 1 ? String(d3.deviation(values)) : "", sourceText(dataset.seconds), from.toISOString(), to.toISOString()]);
    }
    const metadata = [`product: statistics`, `dataset: ${selected ? "Summary (selected dataset)" : "Visible range (displayed samples inside the time and Y ranges)"}`];
    saveFile(csvText(metadata, ["pv", "unit", "samples", "min", "mean", "median", "max", "std", "source", "from", "to"], rows), "text/csv", `analyzer-statistics-${choice.stats}.csv`);
    $("message").textContent = `Exported the ${selected ? "Summary" : "Visible range"} statistics.`;
}

// The style properties an SVG element keeps, as presentation attributes, when the plot leaves the page and its
// stylesheet; the page's content security policy allows no inline style attribute, so attributes carry them.
const PLOT_STYLES = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "opacity", "font-family", "font-size", "font-weight", "visibility", "text-anchor"];

/** The drawn plot as one standalone SVG document: the panels under one another, with the page styles written on the elements. */
function plotDocument() {
    const sources = [...$("charts").querySelectorAll("svg[data-chart-canvas]")].filter((svg) => getComputedStyle(svg).display !== "none");
    if (!sources.length) throw new Error("There is no plot to export.");
    const svgNs = "http://www.w3.org/2000/svg";
    const output = document.createElementNS(svgNs, "svg");
    let width = 0, height = 0;
    for (const source of sources) {
        const [, , w, h] = (source.getAttribute("viewBox") || "0 0 640 250").split(/\s+/).map(Number);
        const clone = source.cloneNode(true);
        const originals = [source, ...source.querySelectorAll("*")];
        const copies = [clone, ...clone.querySelectorAll("*")];
        const hidden = [];
        copies.forEach((copy, index) => {
            const computed = getComputedStyle(originals[index]);
            if (index > 0 && computed.getPropertyValue("display") === "none") {
                hidden.push(copy);
                return;
            }
            copy.removeAttribute("style");
            for (const property of PLOT_STYLES) {
                copy.setAttribute(property, computed.getPropertyValue(property));
            }
        });
        for (const element of hidden) element.remove();
        clone.removeAttribute("width");
        clone.removeAttribute("height");
        clone.setAttribute("width", String(w));
        clone.setAttribute("height", String(h));
        clone.setAttribute("y", String(height));
        output.append(clone);
        width = Math.max(width, w);
        height += h;
    }
    const background = document.createElementNS(svgNs, "rect");
    background.setAttribute("width", String(width));
    background.setAttribute("height", String(height));
    background.setAttribute("fill", "#ffffff");
    output.prepend(background);
    output.setAttribute("xmlns", svgNs);
    output.setAttribute("width", String(width));
    output.setAttribute("height", String(height));
    output.setAttribute("viewBox", `0 0 ${width} ${height}`);
    return { text: new XMLSerializer().serializeToString(output), width, height };
}

/** Saves the plot as SVG, or as PNG drawn from that SVG at twice the size. */
async function savePlot(kind) {
    const plot = plotDocument();
    if (kind === "svg") {
        saveFile(plot.text, "image/svg+xml", "analyzer-plot.svg");
        $("message").textContent = "Exported the plot as SVG.";
        return;
    }
    // The SVG is read back as a data URL, the one image source besides the page's own that its content security policy allows.
    const scale = 2;
    const image = new Image();
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("The plot could not be drawn as an image."));
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(plot.text)}`;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(plot.width * scale);
    canvas.height = Math.round(plot.height * scale);
    const context = canvas.getContext("2d");
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The plot could not be encoded as PNG.");
    saveFile(blob, "image/png", "analyzer-plot.png");
    $("message").textContent = "Exported the plot as PNG.";
}

/** The server products: one link per PV to the retrieval's own CSV or MAT of the chosen source over the range. */
function showServerLinks(range) {
    const choice = state.export;
    const extension = choice.product === "serverCsv" ? "csv" : "mat";
    const list = node("ul", { class: "export-links" });
    const operators = choice.source === "raw" ? [["", "raw samples"]]
        : (() => {
            const bins = Number(choice.bins);
            if (!(/^\d+$/.test(choice.bins.trim()) && bins >= 1 && bins <= BINS_MOST)) throw new Error(`Bins is a whole number from 1 to ${BINS_MOST}.`);
            const interval = intervalForBins(range.from.getTime(), range.to.getTime(), bins);
            if (interval > INTERVAL_MOST) throw new Error("The range is too long for one retrieval interval; choose a shorter range or more bins.");
            return [[`meanSample_${interval}`, `means over ${interval} s`], [`minSample_${interval}`, `minima over ${interval} s`], [`maxSample_${interval}`, `maxima over ${interval} s`]];
        })();
    for (const name of state.pvs) {
        for (const [operator, text] of operators) {
            const query = new URLSearchParams({ pv: operator ? `${operator}(${name})` : name, from: range.from.toISOString(), to: range.to.toISOString() });
            list.append(node("li", null, node("a", { href: `../../data/getData.${extension}?${query}`, target: "_blank", rel: "noopener" }, `${name}: ${text} (${extension.toUpperCase()})`)));
        }
    }
    $("exportLinks").replaceChildren(node("p", { class: "note" }, `${operators.length * state.pvs.length} server products over ${range.from.toISOString()} to ${range.to.toISOString()}.`), list);
}

let suggestionGeneration = 0;
async function suggest(text) {
    const generation = ++suggestionGeneration;
    const term = text.trim();
    const list = $("suggestions");
    list.replaceChildren();
    if (term.length < 2) return;
    try {
        const response = await fetch(`${MATCHING}?${new URLSearchParams({ pv: `*${term}*`, limit: "20" })}`);
        if (!response.ok) return;
        const names = await response.json();
        if (generation === suggestionGeneration) list.replaceChildren(...names.map((name) => node("option", { value: name })));
    } catch (error) {
        // Suggestions are optional; Plot still accepts an archived name.
    }
}

function wire() {
    let timer = 0;
    $("pvName").addEventListener("input", (event) => {
        window.clearTimeout(timer);
        suggestionGeneration++;
        timer = window.setTimeout(() => suggest(event.target.value), 200);
    });
    $("addForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const name = $("pvName").value.trim();
        if (PV_NAME.test(name) && !state.pvs.includes(name)) {
            state.pvs.push(name);
            $("pvName").value = "";
            writeAddress();
            load();
        } else if (name) {
            $("message").textContent = PV_NAME.test(name) ? "This PV is already selected." : "This is not a valid PV name.";
        }
    });
    document.querySelectorAll("#ranges button").forEach((button) => button.addEventListener("click", () => {
        const to = readTime($("toTime").value, state.to);
        if (!to) { $("rangeError").textContent = "Enter a valid end time first."; return; }
        $("fromTime").value = inputTime(new Date(to.getTime() - Number(button.dataset.minutes) * 60000));
        $("toTime").value = inputTime(to);
    }));
    $("spanForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const from = readTime($("fromTime").value, state.from), to = readTime($("toTime").value, state.to);
        if (from && to && from < to) applyRange(from, to, true);
        else $("rangeError").textContent = "Enter valid, unambiguous times with From before To. Use UTC for a repeated local time.";
    });
    $("projection").checked = state.chart.projection;
    $("projection").addEventListener("change", () => chart.setState({ projection: $("projection").checked }));
    renderRetrievalOptions();
    renderDisplayOptions();
    wireTabs($("analysisTabs"), (tab) => AVAILABLE_VIEWS.includes(tab.dataset.view) ? showView(tab.dataset.view) : explainView(tab.dataset.view, !AVAILABLE_VIEWS.includes(state.view)));
    wireTabs($("settingsTabs"), (tab) => {
        for (const item of $("settingsTabs").querySelectorAll('[role="tab"]')) {
            const active = item === tab;
            item.setAttribute("aria-selected", String(active));
            item.tabIndex = active ? 0 : -1;
            $(item.dataset.panel + "Panel").hidden = !active;
        }
    });
    $("returnTrend").addEventListener("click", showTrend);
    $("toggleSettings").addEventListener("click", () => {
        const hidden = !$("settings").hidden;
        $("settings").hidden = hidden;
        $("workspace").classList.toggle("settings-hidden", hidden);
        $("toggleSettings").textContent = hidden ? "Show settings" : "Hide settings";
        $("toggleSettings").setAttribute("aria-expanded", String(!hidden));
        render();
    });
    renderExport();
    $("runExport").addEventListener("click", runExport);
    onZoneChange(() => { writeAddress(); renderInputs(true); render(); });
    onProfileChange(writeAddress);
    let resize = 0;
    window.addEventListener("resize", () => {
        window.clearTimeout(resize);
        resize = window.setTimeout(render, 150);
    });
}

readAddress();
// The trend tools are made after the chart, which may report a state change first; the report waits until they exist.
let trendTools = null;
// The analysis tools by the name of their address parameter, once they are built.
let tools = null;
let hiddenKey = "";
chart = createChart($("charts"), {
    id: "analyzer-trend", idPrefix: "trend", legend: true, initialState: state.chart,
    controlsHost: $("chartOptions"), statisticsHost: [$("statistics"), $("dataStatistics")], statisticsTitle: "Visible range",
    rangeHost: $("timeControls"), fitWidth: true, tools: true, toolbarHost: $("trendTools"),
    helpHref: helpPage,
    onZoom: (from, to) => applyRange(from, to), onPan: panBy, onReset: resetTime,
    onApply: (from, to) => applyRange(from, to, true),
    onStateChange: (next) => {
        state.chart = next;
        $("projection").checked = next.projection;
        writeAddress();
        renderSignals();
        renderAxes();
        renderDisplayOptions();
        // A signal hidden or shown changes what the trend tools may draw over the chart, which is drawn again with them.
        const hiddenNow = next.hidden.join("\n");
        if (trendTools && hiddenNow !== hiddenKey) {
            hiddenKey = hiddenNow;
            render();
        }
    },
});
/** The signals of the selection with the selected dataset each has, for the Distribution tab. */
function distributionSignals() {
    return state.pvs.map((name, index) => {
        const dataset = state.summary.get(name);
        return { name, egu: dataset ? dataset.egu : "", dataset, failure: state.summaryFailures.get(name), color: lineLook(dataset || {}, index).color };
    });
}
/** The signals of the selection with the display dataset each has, for the trend tools. */
function trendSignals() {
    return state.pvs.map((name) => {
        const dataset = state.data.get(name);
        return { name, egu: dataset ? dataset.egu : "", dataset, failure: state.failures.get(name), hidden: chart.getState().hidden.includes(name) };
    });
}
trendTools = createTrendTools($("trendTools2"), { signals: trendSignals, window: () => ({ from: state.from, to: state.to }), zone: currentZone, onChange: () => { render(); writeAddress(); }, helpHref: helpPage,
    sourceText, isHidden: (name) => chart.getState().hidden.includes(name), settings: state.tools.trend });
const spectrum = createSpectrum($("spectrumHost"), { signals: distributionSignals, zone: currentZone, sourceText, helpHref: helpPage, settings: state.tools.spectrum, changed: writeAddress });
const correlation = createCorrelation($("correlationHost"), { signals: distributionSignals, range: () => state.selected, zone: currentZone, sourceText, helpHref: helpPage, settings: state.tools.correlation, changed: writeAddress });
const compare = createCompare($("compareHost"), { signals: distributionSignals, range: () => state.selected, resolution: () => state.sample ?? resolutionOf(state.selected.from, state.selected.to),
    fetch: (name, seconds, from, to) => fetchSeries(name, "mean", seconds, from, to), parseTime: readTime, formatTime: inputTime, zone: currentZone, sourceText, helpHref: helpPage,
    settings: state.tools.compare, changed: writeAddress });
const distribution = createDistribution($("distributionHost"), { signals: distributionSignals, zone: currentZone, sourceText, helpHref: helpPage, settings: state.tools.distribution, changed: writeAddress });
tools = { distribution, trend: trendTools, compare, spectrum, correlation };
wire();
writeAddress();
if (AVAILABLE_VIEWS.includes(state.view)) {
    activateView(state.view);
} else {
    $("trendTab").setAttribute("aria-selected", "false");
    explainView(state.view, true);
}
setupHeader();
render();
if (state.pvs.length) load();
