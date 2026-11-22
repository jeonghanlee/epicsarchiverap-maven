// The chart part of the Analyzer address, read and written as docs/analyzer-address.openapi.json declares it: lists as
// repeated parameters or comma-separated values, per-target settings as deepObject keys (width[PV], axisMin[UNIT]),
// times in RFC 3339 UTC, durations in ISO 8601, booleans as true and false. The viewer owns the PVs, the ranges, the
// retrieval and the export choices; this module owns the parameters of the chart widget and the shared helpers.
import { CHART_OPTIONS, normalizeOptions } from "./options.js";
import { currentProfile } from "./profile.js";
import { currentZone } from "../timezone.js";

const OPTION_PARAMETERS = { shape: "shape", yscale: "yscale", marks: "marks", average: "avg", band: "band", window: "window" };
const TOOLS = ["select", "pan", "box"];
const NAVIGATION_TARGETS = ["x", "y", "xy"];
const DASHES = ["solid", "dash", "dot", "dashdot"];
const SCALES = ["linear", "symlog", "log", "sqrt"];
const LEGEND_STATISTICS = ["min", "max", "mean", "median", "std", "last", "count"];
// The display settings and the value each has until it is changed; the chart's DISPLAY_DEFAULTS say the same.
const DISPLAY = { split: ["none", "unit"], legend: ["list", "table", "off"], tooltip: ["all", "single"], tipsort: ["series", "asc", "desc"], grid: ["off", "x", "y", "both"] };
const DISPLAY_DEFAULTS = { split: "none", legend: "list", legendstat: ["min", "max", "mean", "last"], tooltip: "all", tipsort: "series", grid: "y", endlabels: false };
// The display parameters by the name the chart uses for each.
const DISPLAY_NAMES = { split: "split", legend: "legend", tooltip: "tooltip", tipsort: "tooltipSort", grid: "grid" };
const TEXT_MOST = 128;
// The per-target parameters this module writes; a page's own per-target parameters (export[...]) are left alone.
const CHART_DEEP_NAMES = ["width", "dash", "gap", "fill", "decimals", "name", "axisScale", "axisSymlog", "axisMin", "axisMax", "axisSoftMin", "axisSoftMax", "axisZero", "axisPrefix", "axisLabel"];
const SECONDS_MOST = 2147483647;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;
const DEEP_KEY = /^([A-Za-z]+)\[(.*)\]$/;

/** A nonempty finite decimal number, else null. */
export function finiteNumber(text) {
    if (typeof text !== "string" || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(text.trim())) {
        return null;
    }
    const value = Number(text.trim());
    return Number.isFinite(value) ? value : null;
}

/** A base-10 integer within [low, high], else null. */
export function integerIn(text, low, high) {
    if (typeof text !== "string" || !/^\d+$/.test(text.trim())) {
        return null;
    }
    const value = Number(text.trim());
    return value >= low && value <= high ? value : null;
}

/** true, false or null for anything else. */
export function booleanOf(text) {
    return text === "true" ? true : text === "false" ? false : null;
}

/** Plain text of at most TEXT_MOST code points without control characters, else null. */
export function plainText(text) {
    if (typeof text !== "string" || !text.trim() || [...text].length > TEXT_MOST) {
        return null;
    }
    for (const character of text) {
        const code = character.codePointAt(0);
        if (code < 32 || (code >= 127 && code < 160)) {
            return null;
        }
    }
    return text;
}

/** An RFC 3339 time in UTC with up to nine fractional digits, as a Date at millisecond precision, else null. */
export function timeOf(text) {
    if (typeof text !== "string" || !TIME.test(text)) {
        return null;
    }
    const date = new Date(text.replace(/(\.\d{3})\d*Z$/, "$1Z"));
    return Number.isFinite(date.getTime()) ? date : null;
}

/** The integer nanoseconds of an RFC 3339 time in UTC, or null. */
export function nanosOfTime(text) {
    const date = timeOf(text);
    if (!date) {
        return null;
    }
    const fraction = (/\.(\d+)Z$/.exec(text) || [, ""])[1].padEnd(9, "0");
    return BigInt(Math.floor(date.getTime() / 1000)) * 1000000000n + BigInt(fraction);
}

/** The seconds of an ISO 8601 duration of hours, minutes and seconds (PT5S, PT1.5S, PT5M), else null. */
export function parseIsoDuration(text) {
    const match = typeof text === "string" ? /^PT(?=\d)(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d{1,9})?)S)?$/.exec(text.trim()) : null;
    if (!match) {
        return null;
    }
    const seconds = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
    return seconds > 0 ? seconds : null;
}

/** A whole number of seconds from 1 to SECONDS_MOST given as an ISO 8601 duration, else null. */
export function wholeSecondsOf(text) {
    const seconds = parseIsoDuration(text);
    return seconds !== null && Number.isInteger(seconds) && seconds <= SECONDS_MOST ? seconds : null;
}

/** The ISO 8601 duration of a number of seconds, written in seconds (PT300S, PT1.5S). */
export function isoDuration(seconds) {
    return `PT${String(seconds)}S`;
}

/** Copies valid per-unit ranges; an empty unit denotes a signal with no engineering unit. */
export function validRanges(entries = []) {
    return entries.filter(([unit, range]) => typeof unit === "string" && Array.isArray(range)
        && range.length === 2 && range.every(Number.isFinite) && range[0] < range[1])
        .map(([unit, range]) => [unit, [...range]]);
}

/** The deepObject parameters of the query: name to a Map of target to its first value. */
function deepObjects(parameters) {
    const objects = new Map();
    for (const [key, value] of parameters) {
        const match = DEEP_KEY.exec(key);
        if (!match) {
            continue;
        }
        const targets = objects.get(match[1]) || new Map();
        if (!targets.has(match[2])) {
            targets.set(match[2], value);
        }
        objects.set(match[1], targets);
    }
    return objects;
}

/** The first value of a single parameter, or null. */
const first = (parameters, name) => (parameters.has(name) ? parameters.get(name) : null);

/**
 * Reads the chart state of an address: the phase A options, the hidden lines, the tools, the cursors (with the text
 * they were read from), the pin references, the display settings, the per-PV and per-unit settings and the fixed
 * ranges. pvs, when given, is the list of selected PV names; a setting, hide entry, fill target or pin of another name
 * is dropped. An invalid value falls back to its default; a pair is applied whole or not at all.
 */
export function readChartState(parameters, pvs = null) {
    const known = (name) => pvs === null || pvs.includes(name);
    const options = normalizeOptions({
        shape: parameters.get("shape"), yscale: parameters.get("yscale"), marks: parameters.get("marks"),
        average: parameters.get("avg") === "1", band: parameters.get("band") === "1", window: Number(parameters.get("window")),
    });
    const deep = deepObjects(parameters);
    const targetsOf = (name) => deep.get(name) || new Map();

    const hidden = [...new Set(parameters.getAll("hide").filter(known))];
    const tool = TOOLS.includes(first(parameters, "drag")) ? first(parameters, "drag") : "select";
    const wheel = booleanOf(first(parameters, "wheel")) ?? false;
    const hover = booleanOf(first(parameters, "hover")) ?? true;
    const navUnit = first(parameters, "navUnit");
    const navGiven = first(parameters, "nav");
    const nav = NAVIGATION_TARGETS.includes(navGiven) && (navGiven === "x" || typeof navUnit === "string") ? navGiven : "x";
    const cursorTexts = ["cursor1", "cursor2"].map((name) => (timeOf(first(parameters, name)) ? first(parameters, name) : null));
    const cursors = cursorTexts.map((text) => (text ? timeOf(text) : null));
    const pinRefs = [];
    for (const text of parameters.getAll("pin")) {
        const at = text.lastIndexOf("@");
        const name = at > 0 ? text.slice(0, at) : "";
        const time = at > 0 ? text.slice(at + 1) : "";
        const nanos = nanosOfTime(time);
        if (!name || nanos === null || !known(name) || pinRefs.some((ref) => ref.name === name && ref.nanos === nanos)) {
            continue;
        }
        pinRefs.push({ name, time, nanos });
    }

    const display = { ...DISPLAY_DEFAULTS, legendstat: [...DISPLAY_DEFAULTS.legendstat] };
    for (const [name, parameter] of Object.entries(DISPLAY_NAMES)) {
        const value = first(parameters, parameter);
        if (DISPLAY[name].includes(value)) {
            display[name] = value;
        }
    }
    const statistics = (first(parameters, "legendStats") || "").split(",").map((item) => item.trim()).filter((item) => LEGEND_STATISTICS.includes(item));
    if (parameters.has("legendStats") && statistics.length) {
        display.legendstat = [...new Set(statistics)];
    }
    display.endlabels = booleanOf(first(parameters, "endLabels")) ?? false;

    const signals = new Map();
    const signalNames = new Set([...["width", "dash", "gap", "fill", "decimals", "name"].flatMap((key) => [...targetsOf(key).keys()])].filter(known));
    for (const name of signalNames) {
        const settings = {};
        const width = finiteNumber(targetsOf("width").get(name));
        if (width !== null && width >= 0.5 && width <= 10) settings.width = width;
        const dash = targetsOf("dash").get(name);
        if (DASHES.includes(dash)) settings.dash = dash;
        const gap = parseIsoDuration(targetsOf("gap").get(name));
        if (gap !== null) settings.gap = gap;
        const fill = targetsOf("fill").get(name);
        if (typeof fill === "string" && fill && fill !== name && known(fill)) settings.fill = fill;
        const decimals = integerIn(targetsOf("decimals").get(name), 0, 15);
        if (decimals !== null) settings.decimals = decimals;
        const label = plainText(targetsOf("name").get(name));
        if (label !== null) settings.name = label;
        if (Object.keys(settings).length) signals.set(name, settings);
    }

    const axes = new Map();
    const ranges = new Map();
    const axisKeys = ["axisScale", "axisSymlog", "axisMin", "axisMax", "axisSoftMin", "axisSoftMax", "axisZero", "axisPrefix", "axisLabel"];
    const units = new Set(axisKeys.flatMap((key) => [...targetsOf(key).keys()]));
    for (const unit of units) {
        const settings = {};
        const scale = targetsOf("axisScale").get(unit);
        if (SCALES.includes(scale)) settings.scale = scale;
        const symlog = finiteNumber(targetsOf("axisSymlog").get(unit));
        if (symlog !== null && symlog > 0) settings.symlog = symlog;
        const softmin = finiteNumber(targetsOf("axisSoftMin").get(unit));
        const softmax = finiteNumber(targetsOf("axisSoftMax").get(unit));
        if (!(softmin !== null && softmax !== null && softmin >= softmax)) {
            if (softmin !== null) settings.softmin = softmin;
            if (softmax !== null) settings.softmax = softmax;
        }
        if (booleanOf(targetsOf("axisZero").get(unit)) === true) settings.zero = true;
        if (targetsOf("axisPrefix").get(unit) === "si") settings.prefix = "si";
        const label = plainText(targetsOf("axisLabel").get(unit));
        if (label !== null) settings.label = label;
        if (Object.keys(settings).length) axes.set(unit, settings);
        // A fixed pair, whole or not at all, and only when it suits the scale of the unit.
        const low = finiteNumber(targetsOf("axisMin").get(unit));
        const high = finiteNumber(targetsOf("axisMax").get(unit));
        const kind = settings.scale || options.yscale;
        if (low !== null && high !== null && low < high && !(kind === "log" && low <= 0) && !(kind === "sqrt" && low < 0)) {
            ranges.set(unit, [low, high]);
        }
    }
    // The legacy fixed range of phase A, for a unit without a new pair; the last valid entry of a unit wins.
    for (const text of parameters.getAll("yrange")) {
        const match = /^(.*):([^:]+):([^:]+)$/.exec(text);
        if (!match || !match[1] || !match[2].trim() || !match[3].trim()) {
            continue;
        }
        const unit = match[1] === "none" ? "" : match[1];
        if (targetsOf("axisMin").has(unit) && targetsOf("axisMax").has(unit)) {
            continue;
        }
        const entries = validRanges([[unit, [Number(match[2]), Number(match[3])]]]);
        if (entries.length) {
            ranges.set(...entries[0]);
        }
    }
    return { options, projection: parameters.get("yproj") === "1", ranges: [...ranges], hidden, tool, wheel, hover, nav,
        navUnit: nav === "x" ? null : navUnit, cursors, cursorTexts, pinRefs, display, signals: [...signals], axes: [...axes] };
}

/**
 * Writes the chart state into the parameters: the zone and profile as phase A does, the phase A options that differ
 * from their defaults, and every parameter of the contract whose value differs from its default. state is the
 * chart's getState() plus, when the page has them, cursorTexts (the texts the cursors were read from, written back
 * while the cursor has not moved) and pinTexts (the PV@time of each pin). pvs, when given, drops the settings of PVs
 * that are not selected. The caller orders the parameters.
 */
export function writeChartParameters(parameters, state = {}, zone = currentZone(), profile = currentProfile(), pvs = null) {
    const known = (name) => pvs === null || pvs.includes(name);
    parameters.set("tz", zone);
    parameters.set("profile", profile);
    const options = normalizeOptions(state.options);
    for (const [name, parameter] of Object.entries(OPTION_PARAMETERS)) {
        parameters.delete(parameter);
        if (options[name] !== CHART_OPTIONS[name]) {
            parameters.set(parameter, typeof options[name] === "boolean" ? "1" : String(options[name]));
        }
    }
    parameters.delete("yproj");
    if (state.projection === true) {
        parameters.set("yproj", "1");
    }
    for (const name of ["yrange", "hide", "drag", "wheel", "hover", "nav", "navUnit", "cursor1", "cursor2", "pin", "split", "legend", "legendStats",
        "tooltip", "tooltipSort", "grid", "endLabels"]) {
        parameters.delete(name);
    }
    // Only the chart's own per-target parameters are cleared; the page's (export[...]) stay.
    for (const key of [...parameters.keys()]) {
        const match = DEEP_KEY.exec(key);
        if (match && CHART_DEEP_NAMES.includes(match[1])) {
            parameters.delete(key);
        }
    }
    for (const name of state.hidden || []) {
        if (known(name)) parameters.append("hide", name);
    }
    if (TOOLS.includes(state.tool) && state.tool !== "select") parameters.set("drag", state.tool);
    if (state.wheel === true) parameters.set("wheel", "true");
    if (state.hover === false) parameters.set("hover", "false");
    if (NAVIGATION_TARGETS.includes(state.nav) && state.nav !== "x" && typeof state.navUnit === "string") {
        parameters.set("nav", state.nav);
        parameters.set("navUnit", state.navUnit);
    }
    (state.cursors || []).forEach((time, index) => {
        if (!time) {
            return;
        }
        const date = new Date(time);
        const kept = Array.isArray(state.cursorTexts) ? state.cursorTexts[index] : null;
        const text = kept && timeOf(kept) && timeOf(kept).getTime() === date.getTime() ? kept : date.toISOString();
        parameters.set(`cursor${index + 1}`, text);
    });
    for (const text of state.pinTexts || []) {
        const at = text.lastIndexOf("@");
        if (at > 0 && known(text.slice(0, at))) parameters.append("pin", text);
    }
    const display = { ...DISPLAY_DEFAULTS, ...(state.display || {}) };
    for (const [name, parameter] of Object.entries(DISPLAY_NAMES)) {
        if (DISPLAY[name].includes(display[name]) && display[name] !== DISPLAY_DEFAULTS[name]) parameters.set(parameter, display[name]);
    }
    const statistics = Array.isArray(display.legendstat) ? display.legendstat.filter((item) => LEGEND_STATISTICS.includes(item)) : [];
    if (statistics.length && statistics.join(",") !== DISPLAY_DEFAULTS.legendstat.join(",")) parameters.set("legendStats", statistics.join(","));
    if (display.endlabels === true) parameters.set("endLabels", "true");
    for (const [name, settings] of state.signals || []) {
        if (!known(name) || !settings) continue;
        if (Number.isFinite(settings.width)) parameters.set(`width[${name}]`, String(settings.width));
        if (DASHES.includes(settings.dash)) parameters.set(`dash[${name}]`, settings.dash);
        if (Number.isFinite(settings.gap) && settings.gap > 0) parameters.set(`gap[${name}]`, isoDuration(settings.gap));
        if (typeof settings.fill === "string" && settings.fill && known(settings.fill)) parameters.set(`fill[${name}]`, settings.fill);
        if (Number.isInteger(settings.decimals)) parameters.set(`decimals[${name}]`, String(settings.decimals));
        if (typeof settings.name === "string" && settings.name) parameters.set(`name[${name}]`, settings.name);
    }
    const fixed = new Map(validRanges(state.ranges));
    for (const [unit, settings] of state.axes || []) {
        if (!settings) continue;
        if (SCALES.includes(settings.scale)) parameters.set(`axisScale[${unit}]`, settings.scale);
        if (Number.isFinite(settings.symlog) && settings.symlog > 0) parameters.set(`axisSymlog[${unit}]`, String(settings.symlog));
        // The soft bounds are the bounds of the policy in force only without a fixed pair.
        if (!fixed.has(unit)) {
            if (Number.isFinite(settings.softmin)) parameters.set(`axisSoftMin[${unit}]`, String(settings.softmin));
            if (Number.isFinite(settings.softmax)) parameters.set(`axisSoftMax[${unit}]`, String(settings.softmax));
        }
        if (settings.zero === true) parameters.set(`axisZero[${unit}]`, "true");
        if (settings.prefix === "si") parameters.set(`axisPrefix[${unit}]`, "si");
        if (typeof settings.label === "string" && settings.label) parameters.set(`axisLabel[${unit}]`, settings.label);
    }
    for (const [unit, [low, high]] of fixed) {
        parameters.set(`axisMin[${unit}]`, String(low));
        parameters.set(`axisMax[${unit}]`, String(high));
    }
}

/**
 * The parameters in canonical order: pv first in series order, then every other parameter in the code-point order of
 * its name, repeated values in their order. One state gives one address.
 */
export function orderedParameters(parameters) {
    const ordered = new URLSearchParams();
    for (const name of parameters.getAll("pv")) {
        ordered.append("pv", name);
    }
    const rest = [...parameters].filter(([key]) => key !== "pv").sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    for (const [key, value] of rest) {
        ordered.append(key, value);
    }
    return ordered;
}

/** Enriches a source link without changing its relative path or its fragment. */
export function withChartState(address, state = {}) {
    const hash = address.indexOf("#");
    const tail = hash < 0 ? "" : address.slice(hash);
    const base = hash < 0 ? address : address.slice(0, hash);
    const question = base.indexOf("?");
    const path = question < 0 ? base : base.slice(0, question);
    const parameters = new URLSearchParams(question < 0 ? "" : base.slice(question + 1));
    writeChartParameters(parameters, state);
    parameters.set("view", "trend");
    return `${path}?${orderedParameters(parameters)}${tail}`;
}
