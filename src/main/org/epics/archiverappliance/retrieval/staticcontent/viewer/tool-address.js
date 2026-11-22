// The options of the analysis tools in the address of the Analyzer, as docs/analyzer-address.openapi.json declares them: one
// deepObject parameter per tool, named as its view (distribution[bins]=50, trend[threshold]=12, compare[method]=ks,
// spectrum[window]=blackman). Reading takes each field that is valid and leaves the others at their defaults; a pair (the
// range B of the comparison) applies whole or not at all, and a signal is kept only when it is one of the selected PVs.
// Writing leaves out every field that equals its default, so that a plain address stays short, and writes range B only
// when the user set it (the proposal of the page is not a setting). The Waveform and Image tabs carry every setting of their
// defaults: the frame and the reference as ISO instants, the companion PVs only with the source that uses them.
import { booleanOf, finiteNumber, integerIn, timeOf } from "../comm/js/aa/chart/state.js";
import { WINDOWS } from "../comm/js/aa/spectrum.js";
import { DISTRIBUTION_VIEWS, RULES, NORMALIZATIONS, BINS_LEAST, BINS_MOST, SIGMA_LEAST, SIGMA_MOST, DISTRIBUTION_DEFAULTS } from "./distribution.js";
import { SIDES, TREND_TOOL_DEFAULTS } from "./trend-tools.js";
import { COMPARE_MODES, COMPARE_METHODS, COMPARE_DEFAULTS } from "./compare.js";
import { SPECTRUM_VIEWS, OUTPUTS, GAP_POLICIES, PADDINGS, SEGMENTS, OVERLAPS, SPECTRUM_DEFAULTS } from "./spectrum.js";
import { CORRELATION_VIEWS, POINT_SIZES, POINT_OPACITIES, LAG_CHOICES, CORRELATION_DEFAULTS } from "./correlation.js";
import { DEPENDENCY_VIEWS, DEPENDENCY_INTERVALS, DEPENDENCY_DEFAULTS } from "./dependency.js";
import { MODEL_NAMES } from "../comm/js/aa/fit.js";
import { DIRECTIONS } from "../comm/js/aa/array.js";
import { OVERLAY_MOST, SUMMARY_VALUES } from "../comm/js/aa/arrays.js";
import { WAVEFORM_VIEWS, AXIS_CHOICES, FS_SOURCES, SPECTRUM_WINDOWS, SPECTRUM_SCALES, PEAK_VIEWS, WAVEFORM_DEFAULTS } from "./waveform.js";
import { IMAGE_VIEWS, SIZE_SOURCES, BACKGROUNDS, SERIES_VALUES, IMAGE_DEFAULTS } from "./image.js";

export const TOOL_NAMES = ["distribution", "trend", "compare", "spectrum", "correlation", "dependency", "waveform", "image"];

const values = (choices) => choices.map(([value]) => value);
const SEGMENT_VALUES = ["auto", ...SEGMENTS.map(String)];

/** The first value of each field of the deepObject parameter name (name[field]=value), or an empty Map. */
export function deepFields(parameters, name) {
    const fields = new Map();
    for (const [key, value] of parameters) {
        const match = /^([A-Za-z]+)\[(.*)\]$/.exec(key);
        if (match && match[1] === name && !fields.has(match[2])) fields.set(match[2], value);
    }
    return fields;
}

/** Sets target[key] to the field when it is one of the choices. */
function choice(target, fields, key, choices) {
    if (choices.includes(fields.get(key))) target[key] = fields.get(key);
}

/** Sets target[key] to the field when it is true or false. */
function flag(target, fields, key) {
    const value = booleanOf(fields.get(key));
    if (value !== null) target[key] = value;
}

/** Sets target[key] to the field when it names one of the selected PVs. */
function signal(target, fields, key, pvs) {
    if (pvs.includes(fields.get(key))) target[key] = fields.get(key);
}

/**
 * The settings of the four tools that the address carries, by tool name: each an object with the fields that are valid,
 * to be laid over the defaults of the tool. pvs are the selected PV names, which a signal field must be one of.
 */
export function readToolParameters(parameters, pvs) {
    const tools = { distribution: {}, trend: {}, compare: {}, spectrum: {}, correlation: {}, dependency: {}, waveform: {}, image: {} };
    let fields = deepFields(parameters, "distribution");
    signal(tools.distribution, fields, "signal", pvs);
    choice(tools.distribution, fields, "view", values(DISTRIBUTION_VIEWS));
    choice(tools.distribution, fields, "rule", values(RULES));
    choice(tools.distribution, fields, "normalize", values(NORMALIZATIONS));
    const bins = integerIn(fields.get("bins"), BINS_LEAST, BINS_MOST);
    if (bins !== null) tools.distribution.bins = bins;
    flag(tools.distribution, fields, "kde");
    const sigma = finiteNumber(fields.get("sigma") ?? "");
    if (sigma !== null && sigma >= SIGMA_LEAST && sigma <= SIGMA_MOST) tools.distribution.sigma = sigma;

    fields = deepFields(parameters, "trend");
    signal(tools.trend, fields, "signal", pvs);
    for (const key of ["rate", "fit", "limits"]) flag(tools.trend, fields, key);
    const threshold = fields.get("threshold");
    if (threshold !== undefined && finiteNumber(threshold) !== null) tools.trend.threshold = threshold.trim();
    choice(tools.trend, fields, "side", values(SIDES));

    fields = deepFields(parameters, "compare");
    choice(tools.compare, fields, "mode", values(COMPARE_MODES));
    signal(tools.compare, fields, "a", pvs);
    signal(tools.compare, fields, "b", pvs);
    choice(tools.compare, fields, "method", values(COMPARE_METHODS));
    const from = timeOf(fields.get("from")), to = timeOf(fields.get("to"));
    if (from && to && from < to) {
        tools.compare.from = from;
        tools.compare.to = to;
        tools.compare.edited = true;
    }

    fields = deepFields(parameters, "spectrum");
    signal(tools.spectrum, fields, "signal", pvs);
    choice(tools.spectrum, fields, "view", values(SPECTRUM_VIEWS));
    const interval = fields.get("interval");
    if (interval !== undefined && finiteNumber(interval) > 0) tools.spectrum.interval = interval.trim();
    choice(tools.spectrum, fields, "gaps", values(GAP_POLICIES));
    choice(tools.spectrum, fields, "window", WINDOWS);
    choice(tools.spectrum, fields, "output", values(OUTPUTS));
    flag(tools.spectrum, fields, "log");
    choice(tools.spectrum, fields, "padding", values(PADDINGS));
    choice(tools.spectrum, fields, "segment", SEGMENT_VALUES);
    choice(tools.spectrum, fields, "overlap", values(OVERLAPS));

    fields = deepFields(parameters, "correlation");
    signal(tools.correlation, fields, "x", pvs);
    signal(tools.correlation, fields, "y", pvs);
    choice(tools.correlation, fields, "view", values(CORRELATION_VIEWS));
    choice(tools.correlation, fields, "size", values(POINT_SIZES));
    choice(tools.correlation, fields, "opacity", values(POINT_OPACITIES));
    flag(tools.correlation, fields, "time");
    choice(tools.correlation, fields, "lags", values(LAG_CHOICES));
    flag(tools.correlation, fields, "brush");
    choice(tools.correlation, fields, "model", MODEL_NAMES);
    for (const key of ["fitFrom", "fitTo"]) {
        const text = fields.get(key);
        if (text !== undefined && finiteNumber(text) !== null) tools.correlation[key] = text.trim();
    }
    for (const key of ["xUnit", "yUnit"]) {
        const text = fields.get(key);
        if (text !== undefined && /^[A-Za-z\u00b5\u03a9]{1,5}$/.test(text)) tools.correlation[key] = text;
    }
    choice(tools.distribution, deepFields(parameters, "distribution"), "fit", MODEL_NAMES);

    fields = deepFields(parameters, "dependency");
    signal(tools.dependency, fields, "target", pvs);
    choice(tools.dependency, fields, "view", values(DEPENDENCY_VIEWS));
    choice(tools.dependency, fields, "interval", values(DEPENDENCY_INTERVALS));
    readWaveform(tools.waveform, deepFields(parameters, "waveform"), pvs);
    readImage(tools.image, deepFields(parameters, "image"), pvs);
    return tools;
}

/** Sets target[key] to the field when it is a finite number, kept as the text typed. */
function numberText(target, fields, key) {
    const text = fields.get(key);
    if (text !== undefined && finiteNumber(text) !== null) target[key] = text.trim();
}

/** Sets target[key] to the field when it is a whole number from least to most, kept as the text typed. */
function wholeText(target, fields, key, least = 0, most = Number.MAX_SAFE_INTEGER) {
    const text = fields.get(key);
    if (text !== undefined && integerIn(text, least, most) !== null) target[key] = text.trim();
}

/** Sets target[key] to the milliseconds of the instant the field holds, as text, when it is an ISO time. */
function instantText(target, fields, key) {
    const date = timeOf(fields.get(key));
    if (date) target[key] = String(date.getTime());
}

/** Sets target[key] to the field when it is a unit of one to five letters. */
function unitText(target, fields, key) {
    const text = fields.get(key);
    if (text !== undefined && /^[A-Za-z\u00b5\u03a9]{1,5}$/.test(text)) target[key] = text;
}

/** The settings of the Waveform tab that the address holds and that are valid. */
function readWaveform(target, fields, pvs) {
    signal(target, fields, "signal", pvs);
    choice(target, fields, "view", values(WAVEFORM_VIEWS));
    choice(target, fields, "axis", values(AXIS_CHOICES));
    numberText(target, fields, "axisStart");
    numberText(target, fields, "axisStep");
    unitText(target, fields, "axisUnit");
    signal(target, fields, "axisPv", pvs);
    instantText(target, fields, "frame");
    wholeText(target, fields, "overlay", 1, OVERLAY_MOST);
    choice(target, fields, "value", SUMMARY_VALUES.map(([key]) => key));
    instantText(target, fields, "reference");
    choice(target, fields, "fsSource", values(FS_SOURCES));
    numberText(target, fields, "fs");
    signal(target, fields, "fsPv", pvs);
    choice(target, fields, "window", values(SPECTRUM_WINDOWS));
    choice(target, fields, "scale", values(SPECTRUM_SCALES));
    numberText(target, fields, "sigma");
    numberText(target, fields, "threshold");
    flag(target, fields, "searchBackground");
    flag(target, fields, "markov");
    for (const key of ["averageWindow", "deconvolution", "backgroundIterations"]) wholeText(target, fields, key);
    choice(target, fields, "backgroundDirection", DIRECTIONS);
    choice(target, fields, "peakView", values(PEAK_VIEWS));
}

/** The settings of the Image tab that the address holds and that are valid. */
function readImage(target, fields, pvs) {
    signal(target, fields, "signal", pvs);
    choice(target, fields, "view", values(IMAGE_VIEWS));
    choice(target, fields, "sizeSource", values(SIZE_SOURCES));
    for (const key of ["width", "height"]) wholeText(target, fields, key);
    signal(target, fields, "widthPv", pvs);
    signal(target, fields, "heightPv", pvs);
    instantText(target, fields, "frame");
    for (const key of ["x0", "x1", "y0", "y1", "bx0", "bx1", "by0", "by1"]) wholeText(target, fields, key);
    choice(target, fields, "background", values(BACKGROUNDS));
    numberText(target, fields, "level");
    flag(target, fields, "flipX");
    flag(target, fields, "flipY");
    instantText(target, fields, "reference");
    choice(target, fields, "seriesValue", values(SERIES_VALUES));
}

/** Writes name[key]=value for every field of settings that differs from its default (a signal: from the first PV). */
function writeFields(parameters, name, settings, defaults, pvs, skip = []) {
    for (const [key, fallback] of Object.entries(defaults)) {
        if (skip.includes(key)) continue;
        const value = settings[key];
        const base = key === "signal" || key === "a" || key === "x" || key === "target" ? (pvs[0] ?? null) : fallback;
        if (value === null || value === undefined || value === base) continue;
        parameters.set(`${name}[${key}]`, String(value));
    }
}

/**
 * Writes the options of the tools that differ from their defaults into the parameters. tools holds the modules by tool
 * name, each with its settings; a missing module writes nothing.
 */
export function writeToolParameters(parameters, tools, pvs) {
    if (!tools) return;
    if (tools.distribution) writeFields(parameters, "distribution", tools.distribution.settings, DISTRIBUTION_DEFAULTS, pvs);
    if (tools.trend) writeFields(parameters, "trend", tools.trend.settings, TREND_TOOL_DEFAULTS, pvs);
    if (tools.compare) {
        const settings = tools.compare.settings;
        writeFields(parameters, "compare", settings, COMPARE_DEFAULTS, pvs, ["b", "from", "to", "edited"]);
        // Signal B defaults to the first PV other than A; range B is written only when the user set it.
        const otherwise = pvs.find((name) => name !== settings.a) ?? pvs[0] ?? null;
        if (settings.b !== null && settings.b !== otherwise) parameters.set("compare[b]", settings.b);
        if (settings.edited && settings.from && settings.to) {
            parameters.set("compare[from]", settings.from.toISOString());
            parameters.set("compare[to]", settings.to.toISOString());
        }
    }
    if (tools.spectrum) writeFields(parameters, "spectrum", tools.spectrum.settings, SPECTRUM_DEFAULTS, pvs);
    if (tools.correlation) {
        const settings = tools.correlation.settings;
        writeFields(parameters, "correlation", settings, CORRELATION_DEFAULTS, pvs, ["y"]);
        // Signal Y defaults to the first PV other than X.
        const otherwise = pvs.find((name) => name !== settings.x) ?? pvs[0] ?? null;
        if (settings.y !== null && settings.y !== otherwise) parameters.set("correlation[y]", settings.y);
    }
    if (tools.dependency) writeFields(parameters, "dependency", tools.dependency.settings, DEPENDENCY_DEFAULTS, pvs);
    if (tools.waveform) {
        const settings = tools.waveform.settings;
        const companions = { axisPv: settings.axis === "companion", fsPv: settings.fsSource === "pv" };
        writeFields(parameters, "waveform", settings, WAVEFORM_DEFAULTS, pvs, ["frame", "reference", ...Object.keys(companions)]);
        writeInstantsAndCompanions(parameters, "waveform", settings, companions);
    }
    if (tools.image) {
        const settings = tools.image.settings;
        const companions = { widthPv: settings.sizeSource === "pv", heightPv: settings.sizeSource === "pv" };
        writeFields(parameters, "image", settings, IMAGE_DEFAULTS, pvs, ["frame", "reference", ...Object.keys(companions)]);
        writeInstantsAndCompanions(parameters, "image", settings, companions);
    }
}

/** Writes the frame and the reference as ISO instants, and each companion PV that its source uses. */
function writeInstantsAndCompanions(parameters, name, settings, companions) {
    for (const key of ["frame", "reference"]) {
        const milliseconds = finiteNumber(settings[key] ?? "");
        if (milliseconds !== null) parameters.set(`${name}[${key}]`, new Date(milliseconds).toISOString());
    }
    for (const [key, used] of Object.entries(companions)) {
        if (used && settings[key]) parameters.set(`${name}[${key}]`, settings[key]);
    }
}
