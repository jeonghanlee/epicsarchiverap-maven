// The analyzer owns validated selection state and retrieves data from its own appliance.
import { createChart } from "../comm/js/aa/chart.js";
import { node } from "../comm/js/aa/dom.js";
import { PROFILES, setProfile, onProfileChange } from "../comm/js/aa/chart/profile.js";
import { currentZone, ZONES, setZone, onZoneChange, formatInZone, partsInZone, zoneName } from "../comm/js/aa/timezone.js";
import { readChartState, writeChartParameters } from "../comm/js/aa/chart/state.js";
import { lineLook } from "../comm/js/aa/chart/series.js";
import { buildStatistics } from "../comm/js/aa/chart/statistics.js";
import { buildRangeStrip } from "../comm/js/aa/chart/strip.js";

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
const PV_NAME = /^[a-zA-Z0-9:_\-+[\];/,#{}^<>]+(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/;
// The page holds two datasets per PV. The selected dataset (summary) is the records of the selected range at the
// resolution sample, resolved once from the interval option when the selection is made; the Summary statistics come
// from it. The display dataset (data) is the records of the displayed range at the display resolution; the chart,
// the Visible range statistics and the min and max bands come from it. When both are the same request they share.
const state = { pvs: [], from: null, to: null, selected: null, view: "trend", chart: null,
    sample: null, interval: "auto", minmax: false, displaySeconds: null,
    summary: new Map(), summaryFailures: new Map(), data: new Map(), failures: new Map(), bands: new Map() };
const cache = new Map();
const $ = (id) => document.getElementById(id);
let chart;
let controller = null;
let inputKey = "";

function parseDate(text) {
    if (!text) return null;
    const date = new Date(text);
    return Number.isFinite(date.getTime()) ? date : null;
}

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

function readAddress() {
    const parameters = new URLSearchParams(window.location.search);
    state.pvs = [...new Set(parameters.getAll("pv").map((name) => name.trim()).filter((name) => PV_NAME.test(name)))];
    state.to = parseDate(parameters.get("to")) || new Date();
    state.from = parseDate(parameters.get("from")) || new Date(state.to.getTime() - HOUR);
    if (state.from >= state.to) state.from = new Date(state.to.getTime() - HOUR);
    state.selected = { from: state.from, to: state.to };
    state.chart = readChartState(parameters);
    state.view = VIEWS.includes(parameters.get("view")) ? parameters.get("view") : "trend";
    const zone = parameters.get("tz");
    setZone(ZONES.some((item) => item.id === zone) ? zone : "browser");
    let profile = parameters.get("profile");
    if (!PROFILES.some((item) => item.id === profile)) {
        try { profile = window.localStorage.getItem("aa.chartProfile"); } catch (error) { profile = null; }
    }
    setProfile(PROFILES.some((item) => item.id === profile) ? profile : "default");
}

function writeAddress() {
    const parameters = new URLSearchParams();
    for (const name of state.pvs) parameters.append("pv", name);
    parameters.set("from", state.from.toISOString());
    parameters.set("to", state.to.toISOString());
    parameters.set("view", state.view);
    writeChartParameters(parameters, chart ? chart.getState() : state.chart);
    window.history.replaceState(null, "", `${window.location.pathname}?${parameters}`);
    const active = document.querySelector("ul.mainmenu a[aria-current='page']");
    if (active) active.href = window.location.href;
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
    for (const sample of first ? first.data : []) {
        if (typeof sample.val === "number" && Number.isFinite(sample.val)) {
            const fields = sample.fields;
            const lost = Boolean(fields && (Number(fields.cnxlostepsecs) > 0 || fields.startup === "true" || fields.connectionChange === "true"));
            const secs = Number(sample.secs);
            const nanos = Number(sample.nanos || 0);
            const point = { t: secs * 1000 + Math.floor(nanos / 1e6), v: sample.val, s: sample.severity || 0, g: lost };
            points.push(point);
            records.push({ secs, nanos, t: point.t, v: sample.val, severity: point.s, status: Number(sample.status) || 0, lost });
        }
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
    if (state.sample === null) state.sample = resolutionOf(selected.from, selected.to);
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
    if (state.view !== "trend") {
        chart.message("This analysis has not run.");
    } else if (loaded.some((series) => series.points.length)) {
        chart.draw({ series: loaded.map((series, index) => ({ ...series, focus: index === 0, minmax: bandOf(series.name) })),
            ...timeData(), gapMs: Infinity });
    } else {
        chart.message(waiting ? "Loading samples..." : state.pvs.length ? "No supported numeric samples in this range." : "Select archived signals to draw their trend.",
            state.pvs.length ? timeData() : undefined);
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
        const values = dataset.records.filter((record) => record.t >= from.getTime() && record.t <= to.getTime()).map((record) => record.v);
        return [{ name, egu: dataset.egu, color: lineLook(dataset, index).color, values }];
    });
    for (const host of [$("summary"), $("dataSummary")]) {
        host.replaceChildren();
        if (rows.length) host.append(buildStatistics(rows, null, "Summary"));
    }
}

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
    host.replaceChildren(
        node("div", { class: "opt-row" }, node("label", null, "Interval ", choice), node("label", null, "Seconds ", seconds), apply),
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

function explainView(view, restored = false) {
    const label = view[0].toUpperCase() + view.slice(1);
    $("unavailableView").hidden = false;
    $("unavailableReason").textContent = `${label} is not available in this version. No ${view} analysis has run.`;
    $("returnTrend").hidden = !restored;
    $("trendPanel").hidden = restored;
}

function showTrend() {
    state.view = "trend";
    $("trendPanel").hidden = false;
    $("unavailableView").hidden = true;
    $("trendTab").setAttribute("aria-selected", "true");
    writeAddress();
    render();
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

function csv() {
    const rows = ["pv,time,value,severity,interval_seconds"];
    for (const name of state.pvs) {
        const series = state.data.get(name);
        for (const point of series ? series.points : []) {
            rows.push(`${JSON.stringify(name)},${new Date(point.t).toISOString()},${point.v},${point.s},${series.seconds === "raw" ? 1 : series.seconds}`);
        }
    }
    return rows.join("\n");
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
    wireTabs($("analysisTabs"), (tab) => tab.dataset.view === "trend" ? showTrend() : explainView(tab.dataset.view, state.view !== "trend"));
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
    $("copyLink").addEventListener("click", async () => {
        writeAddress();
        try {
            await navigator.clipboard.writeText(window.location.href);
            $("message").textContent = "Link copied.";
        } catch (error) {
            $("message").textContent = "Copy the current address from the address bar; clipboard access is unavailable.";
        }
    });
    $("downloadCsv").addEventListener("click", () => {
        const address = URL.createObjectURL(new Blob([csv()], { type: "text/csv" }));
        const link = node("a", { href: address, download: "archived-data.csv" });
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(address), 1000);
    });
    onZoneChange(() => { writeAddress(); renderInputs(true); });
    onProfileChange(writeAddress);
    let resize = 0;
    window.addEventListener("resize", () => {
        window.clearTimeout(resize);
        resize = window.setTimeout(render, 150);
    });
}

readAddress();
chart = createChart($("charts"), {
    id: "analyzer-trend", idPrefix: "trend", legend: true, initialState: state.chart,
    controlsHost: $("chartOptions"), statisticsHost: [$("statistics"), $("dataStatistics")], statisticsTitle: "Visible range",
    rangeHost: $("timeControls"), fitWidth: true, tools: true, toolbarHost: $("trendTools"),
    helpHref: () => document.querySelector("ul.mainmenu").dataset.ready === "true" ? $("help").href : null,
    onZoom: (from, to) => applyRange(from, to), onPan: panBy, onReset: resetTime,
    onApply: (from, to) => applyRange(from, to, true),
    onStateChange: (next) => {
        state.chart = next;
        $("projection").checked = next.projection;
        writeAddress();
        renderSignals();
        renderAxes();
        renderDisplayOptions();
    },
});
wire();
writeAddress();
if (state.view !== "trend") {
    $("trendTab").setAttribute("aria-selected", "false");
    explainView(state.view, true);
}
setupHeader();
render();
if (state.pvs.length) load();
