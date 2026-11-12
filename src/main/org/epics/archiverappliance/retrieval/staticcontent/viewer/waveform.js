// The Waveform tab of the analyzer: one array PV (a waveform) read as frames over the selected range, shown as the array at a time with
// the frame before and after it and a slider over the times, an overlay of several times, the time against the element as a heatmap on a
// canvas, the summary values of a frame, and one summary value over the frames. The X axis is the element number, a typed start and
// step, or the values of a companion array PV read at the time of the frame. The frames come from the retrieval raw or thinned by the
// server (the operator nth, the step taken from the event rate and the element count of the type information) and are thinned again
// here to at most 200 frames and at most 2,304,000 elements, the bound that keeps the browser responsive; the note above the plot names
// each step, and the bound when it thinned. A frame above the bound is refused before any request, and a response larger than the bound
// can be is stopped while it arrives. A PV that is not an array, frames of unequal length, an axis that does not fit and a range that
// holds no frame are refused with their reason and show no stale result. The frame in view is one place in one list of frames: a frame
// read at a typed time joins the frames of the range in time order while it is in view, so the slider, Previous, Next, the note and the
// overlay all move from it as from any other frame.
import { createPlotCanvas } from "../comm/js/aa/chart.js";
import { node } from "../comm/js/aa/dom.js";
import { infoButton } from "../comm/js/aa/card.js";
import { finiteNumber } from "../comm/js/aa/chart/state.js";
import { ELEMENTS_MOST, FRAMES_MOST, OVERLAY_MOST, REQUEST_BYTES_MOST, SUMMARY_VALUES, elementsText, axisValues, checkFrames, frameAtOrBefore, frameSummaries, framesInside, lengthsOf, overlayFrames, parseFrames, readBounded,
    requestPlan, summarySeries, thinOnPage, drawingIndices } from "../comm/js/aa/arrays.js";
import { DIRECTIONS, difference, heatmapGrid, peaks, summary } from "../comm/js/aa/array.js";
import { nextPowerOfTwo, spectra, spectralPeak } from "../comm/js/aa/spectrum.js";
import { formatInZone, zoneName } from "../comm/js/aa/timezone.js";

const d3 = globalThis.d3;

export const WAVEFORM_VIEWS = [["array", "Array at a time"], ["overlay", "Overlay of times"], ["heatmap", "Time against element"], ["values", "Summary values"], ["series", "Summary value over time"],
    ["difference", "Difference from a reference"], ["spectrum", "Spectrum"], ["peaks", "Peaks and background"]];
export const AXIS_CHOICES = [["index", "Element number"], ["typed", "Typed start and step"], ["companion", "Companion PV"]];
export const FS_SOURCES = [["typed", "Typed"], ["pv", "PV of the sampling frequency"]];
export const SPECTRUM_WINDOWS = [["rectangular", "Rectangular"], ["hann", "Hann"], ["hamming", "Hamming"], ["blackman", "Blackman"]];
export const SPECTRUM_SCALES = [["log", "Logarithmic"], ["linear", "Linear"]];
export const PEAK_VIEWS = [["array", "Array with its background"], ["subtracted", "Array minus the background"]];
const DIRECTION_TEXT = { decreasing: "Falling width", increasing: "Rising width" };
// The settings of the tab and their defaults; the address carries the ones that differ (viewer/tool-address.js). The peak search keeps the
// defaults of ROOT's TSpectrum::Search (sigma 2, threshold 5 percent, background removal and Markov smoothing on, 3 deconvolution
// iterations, an averaging window of 3); the clipped background of the background view and of the widths keeps 20 iterations, falling.
export const WAVEFORM_DEFAULTS = Object.freeze({ signal: null, view: "array", axis: "index", axisStart: "0", axisStep: "1", axisUnit: "", axisPv: null, frame: "", overlay: "8", value: "max",
    reference: "", fsSource: "typed", fs: "", fsPv: null, window: "hann", scale: "log", sigma: "2", threshold: "5", searchBackground: true, markov: true, averageWindow: "3",
    deconvolution: "3", backgroundIterations: "20", backgroundDirection: "decreasing", peakView: "array" });
const MOST_PEAKS = 100;
const HEIGHT = 300;
const WIDTH_LEAST = 320;
const MARGIN = { left: 84, right: 24, top: 36, bottom: 60 };
const TIME_FORMAT = "%Y-%m-%d %H:%M:%S";
const AXIS_TIME_FORMAT = "%m-%d %H:%M";
const MEDIUM_WIDTH = 480;
const COLOUR_STEPS = 256;

const CARD = [
    "Waveform: how is an array read, and what do its numbers mean?",
    [
        ["In short", "An array PV stores one array at each time it changes. The tab reads those arrays over the selected range as frames, and shows one frame at a time, several times overlaid, or all of them as a picture of time against element."],
        ["Frames", `The arrays stored in the selected range. When the range may hold more than ${FRAMES_MOST} the server is asked for every Nth (nth, the step from the event rate of the PV) and the page keeps at most ${FRAMES_MOST}; the note above the plot then names the steps.`],
        ["Size of a read", `To keep your browser responsive, one read holds at most ${elementsText(ELEMENTS_MOST)} elements, one camera frame of 1920 by 1200. A longer range is thinned further, and the note above the plot says so; an array whose single frame is larger is refused. Measured in Chromium on one workstation: 737,280 elements took 0.25 s and 89 MB of browser memory, 3,072,000 took 0.55 s and 149 MB, 4,608,000 took 1.1 s and 245 MB.`],
        ["Array at a time", "One frame as element against value, with the time of the frame and Previous, Next and a slider over the times that were read. The time box reads the frame stored at or before a time you type, even when it lies before the selected range; that frame takes its place among the frames in time order until you move to another."],
        ["Overlay", `Up to ${OVERLAY_MOST} frames spaced evenly over the range, the current one in black, the others coloured from the first to the last time. The frames of one drawing must have one length.`],
        ["Time against element", "Every frame as a row, the colour the value, from the lowest to the highest value of all the frames. The rows are the frames read, spread over the time axis; an element block narrower than a pixel is averaged."],
        ["Axis", "The element number, or a typed start and step (position = start + step x number), or the values of another array PV read at the time of the frame, which must have one value for each element and must not decrease. Nothing is assumed about what the axis means: the unit is the one you type."],
        ["Summary values", "The length, the maximum and minimum with their element, the mean, the root mean square, the sum, the centre (the intensity-weighted centroid, not defined for a sum that is not positive) and the half-maximum width (not defined when the array stays above half of its range on one side)."],
        ["Summary value over time", "One of those values for each frame read, in time order; a frame for which it is not defined is left out and counted."],
        ["Difference from a reference", "The frame in view minus a reference read at or before a typed time; another length is refused."],
        ["Spectrum", "The power spectral density of the frame and its strongest peak. The sampling frequency is typed or read from a PV of that role, never the archive rate."],
        ["Peaks and background", "The peaks of ROOT's TSpectrum in its order, with the height and the width at half height above the clipped background."],
    ],
    null,
];

const number = (value) => (Number.isFinite(value) ? Number(value).toPrecision(6) : "not defined");
const timeText = (t, zone) => formatInZone(new Date(t), TIME_FORMAT, zone);
const unitText = (unit) => (unit ? ` ${unit}` : "");

/** The position along an axis of a fractional element, by linear interpolation between the two elements around it. */
export function positionAt(x, element) {
    const low = Math.max(0, Math.min(x.length - 1, Math.floor(element)));
    const high = Math.min(x.length - 1, low + 1);
    return x[low] + (x[high] - x[low]) * (element - low);
}

/** True when the neighbouring positions of an axis are equally far apart (to a millionth of the step). */
export function evenlySpaced(x) {
    if (x.length < 3) return true;
    const step = (x[x.length - 1] - x[0]) / (x.length - 1);
    for (let i = 1; i < x.length; i += 1) if (Math.abs(x[i] - x[i - 1] - step) > 1e-6 * Math.abs(step)) return false;
    return true;
}

/** A colour table of COLOUR_STEPS steps of the viridis scale as [r, g, b] triples. */
function colourTable() {
    return Array.from({ length: COLOUR_STEPS }, (_, k) => {
        const colour = d3.color(d3.interpolateViridis(k / (COLOUR_STEPS - 1)));
        return [colour.r, colour.g, colour.b];
    });
}

/**
 * The picture of a grid on a canvas of width x height pixels: the column of a pixel is the mean of the elements it covers, the row the
 * frame whose time is nearest to the time of the pixel row. times are the frame times (increasing), t0 and t1 the times of the top and
 * the bottom of the picture. Returns the canvas.
 */
export function heatmapCanvas(grid, times, width, height, t0, t1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    const image = context.createImageData(width, height);
    const table = colourTable();
    const span = grid.max - grid.min || 1;
    const columns = Float64Array.from({ length: width }, () => 0);
    const rowFor = (pixelRow) => {
        const t = t0 + ((t1 - t0) * (pixelRow + 0.5)) / height;
        let best = 0;
        let distance = Infinity;
        const at = d3.bisectLeft(times, t);
        for (const candidate of [at - 1, at]) {
            if (candidate < 0 || candidate >= times.length) continue;
            const d = Math.abs(times[candidate] - t);
            if (d < distance) {
                distance = d;
                best = candidate;
            }
        }
        return best;
    };
    for (let r = 0; r < height; r += 1) {
        const frame = rowFor(r);
        for (let c = 0; c < width; c += 1) {
            const first = Math.floor((c * grid.columns) / width);
            const last = Math.max(first + 1, Math.floor(((c + 1) * grid.columns) / width));
            let total = 0;
            for (let k = first; k < last; k += 1) total += grid.cells[frame * grid.columns + k];
            const value = total / (last - first);
            columns[c] = value;
            const colour = table[Math.max(0, Math.min(COLOUR_STEPS - 1, Math.round(((value - grid.min) / span) * (COLOUR_STEPS - 1))))];
            const offset = (r * width + c) * 4;
            image.data[offset] = colour[0];
            image.data[offset + 1] = colour[1];
            image.data[offset + 2] = colour[2];
            image.data[offset + 3] = 255;
        }
    }
    context.putImageData(image, 0, 0);
    return canvas;
}

/** The Waveform tab: its controls are built once and its body is drawn again at each render. */
export function createWaveform(host, options) {
    const settings = { ...WAVEFORM_DEFAULTS, ...(options.settings || {}) };
    const changed = () => { render(); if (options.changed) options.changed(); };
    const select = (label, choices, key) => {
        const element = node("select", { "aria-label": label });
        for (const [value, text] of choices) element.append(node("option", { value }, text));
        element.value = settings[key];
        element.addEventListener("change", () => { settings[key] = element.value; changed(); });
        return element;
    };
    const textInput = (label, key, size, placeholder = "") => {
        const element = node("input", { type: "text", inputmode: "decimal", size: String(size), "aria-label": label, placeholder });
        element.value = settings[key];
        element.addEventListener("change", () => { settings[key] = element.value.trim(); changed(); });
        return element;
    };
    const signal = node("select", { "aria-label": "Waveform signal" });
    signal.addEventListener("change", () => { settings.signal = signal.value; settings.frame = ""; changed(); });
    const view = select("Waveform view", WAVEFORM_VIEWS, "view");
    const axis = select("Waveform axis", AXIS_CHOICES, "axis");
    const axisStart = textInput("Axis start", "axisStart", 8);
    const axisStep = textInput("Axis step", "axisStep", 8);
    const axisUnit = textInput("Axis unit", "axisUnit", 6, "unit");
    const axisPv = node("select", { "aria-label": "Axis PV" });
    axisPv.addEventListener("change", () => { settings.axisPv = axisPv.value; changed(); });
    const overlay = node("input", { type: "text", inputmode: "numeric", size: "3", "aria-label": "Frames overlaid" });
    overlay.value = settings.overlay;
    const valueSelect = select("Summary value", SUMMARY_VALUES.map(([key, label]) => [key, label]), "value");
    const slider = node("input", { type: "range", min: "0", max: "0", step: "1", value: "0", "aria-label": "Frame of the range" });
    const previous = node("button", { type: "button", "aria-label": "Previous frame" }, "Previous");
    const next = node("button", { type: "button", "aria-label": "Next frame" }, "Next");
    const timeBox = node("input", { type: "text", size: "20", "aria-label": "Frame at or before the time", placeholder: "time" });
    const goTo = node("button", { type: "button" }, "Go to time");
    const checkbox = (label, key) => {
        const element = node("input", { type: "checkbox", "aria-label": label });
        element.checked = settings[key] === true;
        element.addEventListener("change", () => { settings[key] = element.checked; changed(); });
        return element;
    };
    const referenceBox = node("input", { type: "text", size: "20", "aria-label": "Reference at or before the time", placeholder: "time" });
    const readReference = node("button", { type: "button" }, "Read reference");
    const fsSource = select("Sampling frequency from", FS_SOURCES, "fsSource");
    const fsBox = textInput("Sampling frequency", "fs", 8, "Hz");
    const fsPv = node("select", { "aria-label": "Sampling frequency PV" });
    fsPv.addEventListener("change", () => { settings.fsPv = fsPv.value; forgetFailedFrequencies(); changed(); });
    const windowSelect = select("Spectrum window", SPECTRUM_WINDOWS, "window");
    const scaleSelect = select("Spectrum scale", SPECTRUM_SCALES, "scale");
    const sigmaBox = textInput("Peak sigma", "sigma", 5);
    const thresholdBox = textInput("Peak threshold", "threshold", 5, "%");
    const searchBackground = checkbox("Remove the background in the search", "searchBackground");
    const markov = checkbox("Markov smoothing", "markov");
    const averageBox = textInput("Markov window", "averageWindow", 4);
    const deconvolutionBox = textInput("Deconvolution iterations", "deconvolution", 4);
    const backgroundBox = textInput("Background iterations", "backgroundIterations", 5);
    const directionSelect = select("Background direction", DIRECTIONS.map((d) => [d, DIRECTION_TEXT[d]]), "backgroundDirection");
    const peakViewSelect = select("Peaks view", PEAK_VIEWS, "peakView");
    const error = node("p", { class: "error", role: "alert" });
    const field = (text, control) => node("label", null, text, control);
    const viewFields = {
        difference: [field("Reference ", referenceBox), readReference],
        spectrum: [field("Frequency from ", fsSource), field("Sampling frequency ", fsBox), field("Frequency PV ", fsPv), field("Window ", windowSelect), field("Scale ", scaleSelect)],
        peaks: [field("Sigma ", sigmaBox), field("Threshold % ", thresholdBox), field("Background in search ", searchBackground), field("Markov ", markov), field("Markov window ", averageBox),
            field("Deconvolution ", deconvolutionBox), field("Background iterations ", backgroundBox), field("Background ", directionSelect), field("Show ", peakViewSelect)],
    };
    const controls = node("div", { class: "wave-controls" }, field("Signal ", signal), field("View ", view), field("Axis ", axis), field("Start ", axisStart), field("Step ", axisStep), field("Unit ", axisUnit), field("Axis PV ", axisPv),
        field("Frames overlaid ", overlay), field("Value ", valueSelect), ...viewFields.difference, ...viewFields.spectrum, ...viewFields.peaks, infoButton(...CARD, options.helpHref));
    const frameBar = node("div", { class: "wave-frames", role: "group", "aria-label": "Frame of the range" }, previous, slider, next, field("Time ", timeBox), goTo);
    const frameNote = node("p", { class: "note wave-frame-note", role: "status" });
    const message = node("p", { class: "note wave-message", role: "status" });
    const readout = node("p", { class: "note wave-readout", role: "status" });
    const plot = node("div", { class: "chart wave-plot" });
    const numbers = node("div", { class: "wave-numbers" });
    host.replaceChildren(controls, frameBar, error, message, frameNote, plot, readout, numbers);

    // The frames of one signal over one range, read once for a selection: the type information, the plan of the request, the frames kept
    // (thinned), which the heatmap and the series draw. The frames the user moves through (nav) are those frames and, while one is in
    // view, the frame read at a typed time in its place in time (typed); index is the frame in view within nav, the one state that the
    // slider, Previous, Next, the note and the overlay all follow.
    let current = { key: null, name: null, status: "idle", reason: "", meta: null, plan: null, parsed: null, thinned: null, nav: null, typed: null, step: 1, index: 0, controller: null };
    // The companion axis arrays read, by PV and frame time.
    const companions = new Map();

    function syncSignals(list) {
        const names = list.map((entry) => entry.name);
        if (names.join("\n") !== [...signal.options].map((option) => option.value).join("\n")) {
            signal.replaceChildren(...list.map((entry) => node("option", { value: entry.name }, entry.name)));
        }
        if (!names.includes(settings.signal)) settings.signal = names[0] ?? null;
        if (settings.signal !== null) signal.value = settings.signal;
        const others = names.filter((name) => name !== settings.signal);
        if (others.join("\n") !== [...axisPv.options].map((option) => option.value).join("\n")) {
            axisPv.replaceChildren(...others.map((name) => node("option", { value: name }, name)));
        }
        if (!others.includes(settings.axisPv)) settings.axisPv = others[0] ?? null;
        if (settings.axisPv !== null) axisPv.value = settings.axisPv;
        if (others.join("\n") !== [...fsPv.options].map((option) => option.value).join("\n")) {
            fsPv.replaceChildren(...others.map((name) => node("option", { value: name }, name)));
        }
        if (!others.includes(settings.fsPv)) settings.fsPv = others[0] ?? null;
        if (settings.fsPv !== null) fsPv.value = settings.fsPv;
    }

    /** Reads the frames of a signal over the range: the type information, the plan, the request bounded in bytes, and the frames. */
    async function load(name, range) {
        current.controller?.abort();
        const controller = new AbortController();
        const mine = { key: `${name}|${range.from.toISOString()}|${range.to.toISOString()}`, name, status: "loading", reason: "", meta: null, plan: null, parsed: null, thinned: null, nav: null, typed: null, step: 1, index: 0, controller };
        current = mine;
        companions.clear();
        frequencies.clear();
        const fail = (reason) => { if (current === mine) { mine.status = "failed"; mine.reason = reason; render(); } };
        try {
            const meta = await options.metadata(name);
            if (current !== mine) return;
            if (!meta) return fail(`${name} has no type information on this appliance, so it cannot be read as an array. Archive it first.`);
            mine.meta = meta;
            const type = String(meta.DBRType || "");
            if (!type.includes("WAVEFORM")) return fail(`${name} is stored as ${type || "an unknown type"}, not as an array; the Waveform tab reads arrays. Use the Trend for a scalar.`);
            if (type.includes("STRING") || type.includes("ENUM")) return fail(`${name} is an array of ${type.includes("STRING") ? "strings" : "enumerated values"}; the Waveform tab reads numeric arrays.`);
            const seconds = (range.to - range.from) / 1000;
            const plan = requestPlan({ elementCount: Number(meta.elementCount), eventRate: Number(meta.computedEventRate), seconds });
            if (!plan.ok) return fail(plan.reason);
            mine.plan = plan;
            const expression = plan.step > 1 ? `nth_${plan.step}(${name})` : name;
            const response = await options.retrieve(expression, range.from, range.to, controller.signal);
            if (current !== mine) return;
            if (!response.ok) return fail(`${response.statusText || "Retrieval failed"} (HTTP ${response.status}).`);
            const read = await readBounded(response, REQUEST_BYTES_MOST);
            if (current !== mine) return;
            if (read.exceeded) {
                return fail(`The response passed ${(REQUEST_BYTES_MOST / 1048576).toFixed(0)} MB, more than ${elementsText(ELEMENTS_MOST)} elements take, and was stopped to keep the browser responsive; choose a shorter range. The type information expected ${plan.expected ?? "an unknown number of"} frames of ${Number(meta.elementCount)} elements.`);
            }
            const parsed = parseFrames(JSON.parse(read.text));
            if (parsed.form === "No samples") return fail("The selected range holds no frame of this array. Choose a range in which it was stored.");
            if (parsed.form === "Scalar samples") return fail(`${name} holds scalar samples in this range; the Waveform tab reads arrays.`);
            // The retrieval adds the sample in force at the start of the range; a frame before the range is not a frame of the range.
            const { inside, before } = framesInside(parsed.frames, +range.from, +range.to);
            if (!inside.length) {
                return fail(`The selected range holds no frame of this array${before ? `; the last frame before it is at ${timeText(before.t, options.zone())}` : ""}. Choose a range in which the array was stored.`);
            }
            const oversized = inside.find((frame) => frame.length > ELEMENTS_MOST);
            if (oversized) {
                return fail(`A frame of this array holds ${elementsText(oversized.length)} elements, more than the ${elementsText(ELEMENTS_MOST)} the page reads at a time to keep the browser responsive; the array cannot be read as frames.`);
            }
            parsed.frames = inside;
            parsed.lengths = lengthsOf(inside);
            const thinned = thinOnPage(inside, FRAMES_MOST, ELEMENTS_MOST);
            mine.parsed = parsed;
            mine.thinned = thinned.frames;
            mine.nav = thinned.frames;
            mine.step = thinned.step;
            mine.total = thinned.total;
            mine.elements = thinned.elements;
            mine.byElements = thinned.byElements || (plan.step > 1 && plan.byElements);
            const wanted = settings.frame === "" ? -1 : frameAtOrBefore(thinned.frames, finiteNumber(settings.frame));
            mine.index = wanted >= 0 ? wanted : thinned.frames.length - 1;
            mine.status = "ready";
            render();
        } catch (problem) {
            if (problem.name === "AbortError") return;
            fail(String(problem.message || problem));
        }
    }

    /** The frame in view. */
    const frameInView = () => current.nav[current.index];

    /**
     * Moves to a frame of the frames the user moves through. A frame read at a typed time stays in them only while it is in view: moving
     * to another frame takes it out, so that they are again the frames of the range.
     */
    function moveTo(index) {
        let target = Math.max(0, Math.min(current.nav.length - 1, index));
        if (current.typed && current.nav[target] !== current.typed) {
            if (current.nav.indexOf(current.typed) < target) target -= 1;
            current.nav = current.thinned;
            current.typed = null;
        }
        current.index = target;
        settings.frame = String(current.nav[target].t);
        changed();
    }

    /** Shows a frame read at a typed time: a frame of the range at that time is moved to; another joins the frames in time order. */
    function showTyped(frame) {
        const same = current.thinned.findIndex((f) => f.t === frame.t);
        if (same >= 0) {
            current.nav = current.thinned;
            current.typed = null;
            current.index = same;
        } else {
            current.nav = [...current.thinned, frame].sort((a, b) => a.t - b.t);
            current.typed = frame;
            current.index = current.nav.indexOf(frame);
        }
        settings.frame = String(frame.t);
        changed();
    }

    /** The companion axis array at the time of the frame: read once for a PV and time, from the frame at or before that time. */
    function companionFor(frame) {
        if (settings.axis !== "companion" || !settings.axisPv) return { values: null, state: "none" };
        const key = `${settings.axisPv}|${frame.t}`;
        const known = companions.get(key);
        if (known) return known;
        const entry = { values: null, state: "loading" };
        companions.set(key, entry);
        const controller = new AbortController();
        const mine = current;
        options.retrieve(settings.axisPv, new Date(frame.t), new Date(frame.t + 1), controller.signal)
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`${response.statusText || "Retrieval failed"} (HTTP ${response.status})`))))
            .then((body) => {
                if (current !== mine) return;
                const parsed = parseFrames(body);
                const found = parsed.frames.find((f) => f.values);
                entry.values = found ? found.values : null;
                entry.state = found ? "ready" : "failed";
                entry.reason = found ? "" : parsed.form === "No samples" ? `${settings.axisPv} holds no frame at or before the time of the frame.` : `${settings.axisPv} is not an array of numbers at the time of the frame.`;
                render();
            })
            .catch((problem) => { if (current === mine) { entry.state = "failed"; entry.reason = String(problem.message || problem); render(); } });
        return entry;
    }

    /**
     * The sampling frequency within the frame: typed, or the value of the PV of that role at the frame time (its last value at or before
     * it), read once for a PV and a time. Returns {ok, fs, source} or {ok: false, loading, reason}. The event rate of the archive is never
     * used: it is how often the array was stored, not how far apart its elements are. A read that failed is kept until the user chooses
     * the typed source or another PV, and is then read anew when the PV is chosen again.
     */
    const frequencies = new Map();
    const forgetFailedFrequencies = () => { for (const [key, entry] of frequencies) if (entry.state === "failed") frequencies.delete(key); };
    function samplingFrequency(frame) {
        if (settings.fsSource === "typed") {
            forgetFailedFrequencies();
            if (settings.fs === "") return { ok: false, reason: "Type the sampling frequency within the array, in Hz, or choose a PV of the sampling frequency; the rate at which the archive stored the array is not that frequency." };
            const fs = finiteNumber(settings.fs);
            if (!(fs > 0)) return { ok: false, reason: "The sampling frequency is not a positive number of Hz." };
            return { ok: true, fs, source: "typed" };
        }
        if (!settings.fsPv) return { ok: false, reason: "Choose a PV of the sampling frequency, or type it." };
        const key = `${settings.fsPv}|${frame.t}`;
        let entry = frequencies.get(key);
        if (!entry) {
            entry = { state: "loading" };
            frequencies.set(key, entry);
            const mine = current;
            options.retrieve(settings.fsPv, new Date(frame.t), new Date(frame.t + 1), new AbortController().signal)
                .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`${response.statusText || "Retrieval failed"} (HTTP ${response.status})`))))
                .then((body) => {
                    const sample = Array.isArray(body) && body[0] && Array.isArray(body[0].data) ? body[0].data.find((s) => Number(s.secs) * 1000 <= frame.t + 1) || body[0].data[0] : null;
                    if (!sample) Object.assign(entry, { state: "failed", reason: `${settings.fsPv} holds no value at or before the time of the frame.` });
                    else if (Array.isArray(sample.val)) Object.assign(entry, { state: "failed", reason: `${settings.fsPv} is an array, not one number; the sampling frequency is one number of Hz.` });
                    else if (!(Number(sample.val) > 0)) Object.assign(entry, { state: "failed", reason: `${settings.fsPv} holds ${sample.val} at the time of the frame, not a positive number of Hz.` });
                    else Object.assign(entry, { state: "ready", fs: Number(sample.val) });
                    if (current === mine) render();
                })
                .catch((problem) => { Object.assign(entry, { state: "failed", reason: String(problem.message || problem) }); if (current === mine) render(); });
        }
        if (entry.state === "loading") return { ok: false, loading: true, reason: `Reading the sampling frequency from ${settings.fsPv}...` };
        if (entry.state === "failed") return { ok: false, reason: entry.reason };
        return { ok: true, fs: entry.fs, source: settings.fsPv };
    }

    /** The element positions for the frame in view, or {ok: false, reason} when the axis does not fit. */
    function axisOf(frame) {
        const spec = { mode: settings.axis, start: settings.axisStart, step: settings.axisStep };
        if (settings.axis === "companion") {
            const companion = companionFor(frame);
            if (companion.state === "loading") return { ok: false, loading: true, reason: `Reading the axis array ${settings.axisPv}...` };
            if (companion.state === "failed") return { ok: false, reason: companion.reason };
            if (companion.state === "none") return { ok: false, reason: "Choose a PV for the axis." };
            return axisValues(spec, frame.length, companion.values);
        }
        return axisValues(spec, frame.length);
    }

    const axisLabel = () => (settings.axis === "index" ? "Element number" : settings.axis === "typed" ? `Position${unitText(settings.axisUnit ? `/ ${settings.axisUnit}` : "")}` : `${settings.axisPv}`);
    const valueUnit = () => (current.parsed && current.parsed.meta && current.parsed.meta.EGU) || "";

    function canvasIn(input) {
        const margin = input.margin || MARGIN;
        const width = Math.max(WIDTH_LEAST, Math.floor(plot.clientWidth || 720));
        const x = input.xScale.range([margin.left, width - margin.right]);
        const y = input.yScale.range(input.down ? [margin.top, HEIGHT - margin.bottom] : [HEIGHT - margin.bottom, margin.top]);
        const surface = createPlotCanvas({
            width, height: HEIGHT, margin, x, scales: new Map([[input.yUnit, y]]), units: [input.yUnit], axisWidth: margin.left, onLeft: 1,
            unitLabels: true, axisLabels: new Map([[input.yUnit, input.yLabel]]), axisLabelAnchor: "start", xLabel: input.xLabel, xTickY: HEIGHT - 30, label: input.label,
            xFormat: input.xFormat, xTicks: input.xTicks || x.ticks(width < MEDIUM_WIDTH ? 2 : 6), tickFormats: input.tickFormats, grid: input.grid || "y", tickCount: 5,
        });
        return { surface, x, y, width, margin };
    }

    const extent = (arrays) => {
        let low = Infinity;
        let high = -Infinity;
        for (const values of arrays) for (const v of values) { if (v < low) low = v; if (v > high) high = v; }
        if (low === high) { low -= 1; high += 1; }
        const pad = (high - low) * 0.06;
        return [low - pad, high + pad];
    };
    const xExtent = (x) => (x[0] === x[x.length - 1] ? [x[0] - 0.5, x[0] + 0.5] : d3.extent(x));

    function drawArray(frame, x, label = `${current.name} at ${timeText(frame.t, options.zone())}`) {
        const unit = valueUnit();
        const { surface, x: xs, y, width } = canvasIn({ xScale: d3.scaleLinear().domain(xExtent(x)), yScale: d3.scaleLinear().domain(extent([frame.values])), yUnit: unit || "value",
            yLabel: `Value${unitText(unit ? `/ ${unit}` : "")}`, xLabel: axisLabel(), label, xFormat: d3.format(".4~g") });
        plot.replaceChildren();
        plot.append(surface.svg.node());
        const indices = drawingIndices(frame.values, Math.floor(width - MARGIN.left - MARGIN.right));
        const line = d3.line().x((i) => xs(x[i])).y((i) => y(frame.values[i]));
        surface.marks.append("path").attr("class", "wave-line").attr("data-elements", frame.length).attr("data-drawn", indices.length).attr("d", line(indices));
        const s = summary(frame.values);
        surface.marks.append("circle").attr("class", "wave-max").attr("data-element", s.maxAt).attr("r", 4).attr("cx", xs(x[s.maxAt])).attr("cy", y(frame.values[s.maxAt]));
        const search = d3.bisector((v) => v).center;
        surface.bindHover(plot, ({ x: at }) => {
            const k = Math.max(0, Math.min(frame.length - 1, search(x, +at)));
            return { title: `Element ${k}`, rows: [`${axisLabel()}: ${number(x[k])}`, `Value: ${number(frame.values[k])}${unitText(unit)}`] };
        });
        return surface;
    }

    function drawOverlay(frames, indexes, x, inView) {
        const unit = valueUnit();
        const shown = indexes.map((i) => frames[i]);
        const { surface, x: xs, y, width } = canvasIn({ xScale: d3.scaleLinear().domain(xExtent(x)), yScale: d3.scaleLinear().domain(extent(shown.map((f) => f.values))), yUnit: unit || "value",
            yLabel: `Value${unitText(unit ? `/ ${unit}` : "")}`, xLabel: axisLabel(), label: `${shown.length} frames of ${current.name}`, xFormat: d3.format(".4~g") });
        plot.replaceChildren();
        plot.append(surface.svg.node());
        const colour = d3.scaleSequential(d3.interpolateViridis).domain([0, Math.max(1, shown.length - 1)]);
        const entries = [];
        shown.forEach((frame, k) => {
            const isCurrent = indexes[k] === inView;
            const stroke = isCurrent ? "#000" : colour(k);
            const line = d3.line().x((i) => xs(x[i])).y((i) => y(frame.values[i]));
            surface.marks.append("path").attr("class", isCurrent ? "wave-line wave-current" : "wave-line wave-overlay").attr("data-frame", indexes[k]).attr("data-time", frame.t)
                .style("stroke", stroke).style("stroke-width", isCurrent ? 2 : 1.2).attr("d", line(drawingIndices(frame.values, Math.floor(width - MARGIN.left - MARGIN.right))));
            const swatch = node("span", { class: "wave-swatch", "aria-hidden": "true" });
            swatch.style.background = stroke;
            entries.push(node("li", null, swatch, `${timeText(frame.t, options.zone())}${isCurrent ? " (in view)" : ""}`));
        });
        // The legend names the time of each line in the order of time, with the colour of its line.
        numbers.append(node("ul", { class: "wave-legend", "aria-label": "Frames overlaid, by time" }, ...entries));
        return shown;
    }

    function drawHeatmap(frames, x) {
        const unit = valueUnit();
        const grid = heatmapGrid(frames.map((f) => f.values));
        const times = frames.map((f) => f.t);
        const t0 = times[0];
        const t1 = times.length > 1 ? times[times.length - 1] : t0 + 1000;
        // A span of a day and a half or less is labelled with the time of day and the date once in the axis title; a longer one with the date and time.
        const shortSpan = t1 - t0 <= 36 * 3600000;
        const margin = shortSpan ? MARGIN : { ...MARGIN, left: 124 };
        const { surface, width } = canvasIn({ xScale: d3.scaleLinear().domain(xExtent(x)), yScale: d3.scaleTime().domain([new Date(t0), new Date(t1)]), yUnit: "time", margin,
            yLabel: shortSpan ? `Time, ${zoneName(options.zone(), new Date(t0))}, ${formatInZone(new Date(t0), "%Y-%m-%d", options.zone())}` : `Time, ${zoneName(options.zone(), new Date(t0))}`,
            xLabel: axisLabel(), label: `${frames.length} frames of ${current.name} against element`, xFormat: d3.format(".4~g"),
            tickFormats: new Map([["time", (date) => formatInZone(date, shortSpan ? "%H:%M" : AXIS_TIME_FORMAT, options.zone())]]), grid: "off", down: true });
        const inner = { width: Math.max(1, Math.round(width - margin.left - margin.right)), height: HEIGHT - margin.top - margin.bottom };
        // The rows of the picture follow the time axis downwards, the earliest frame at the top.
        const canvas = heatmapCanvas(grid, times, inner.width, inner.height, t0, t1);
        canvas.className = "wave-heat";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `Heatmap of ${frames.length} frames by ${grid.columns} elements`);
        canvas.dataset.rows = grid.rows;
        canvas.dataset.columns = grid.columns;
        canvas.dataset.min = grid.min;
        canvas.dataset.max = grid.max;
        canvas.style.left = `${margin.left}px`;
        canvas.style.top = `${margin.top}px`;
        canvas.style.width = `${inner.width}px`;
        canvas.style.height = `${inner.height}px`;
        const box = node("div", { class: "wave-heatmap" });
        // The axes of the surface are drawn over the canvas: the time axis runs down the picture, as the frame rows do.
        box.append(canvas, surface.svg.node());
        plot.replaceChildren(box);
        canvas.addEventListener("mousemove", (event) => {
            const rect = canvas.getBoundingClientRect();
            const column = Math.max(0, Math.min(inner.width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * inner.width)));
            const row = Math.max(0, Math.min(inner.height - 1, Math.floor(((event.clientY - rect.top) / rect.height) * inner.height)));
            const t = t0 + ((t1 - t0) * (row + 0.5)) / inner.height;
            const at = d3.bisectLeft(times, t);
            const frame = Math.min(frames.length - 1, Math.max(0, at > 0 && (at >= times.length || t - times[at - 1] < times[at] - t) ? at - 1 : at));
            const element = Math.min(grid.columns - 1, Math.floor((column * grid.columns) / inner.width));
            readout.textContent = `${timeText(times[frame], options.zone())}, element ${element}: ${number(grid.cells[frame * grid.columns + element])}${unitText(unit)}`;
        });
        readout.textContent = `Colour: ${number(grid.min)}${unitText(unit)} (dark) to ${number(grid.max)}${unitText(unit)} (bright). Point at the picture for a value.`;
        return grid;
    }

    function drawValues(frame, x) {
        const s = summary(frame.values);
        const unit = valueUnit();
        const inAxis = (element) => (settings.axis === "index" ? "" : ` (${number(x[element])}${settings.axis === "typed" ? unitText(settings.axisUnit) : ""})`);
        const widthText = s.fwhm
            ? `${number(s.fwhm.width)} elements${settings.axis === "index" ? "" : `, ${number(positionAt(x, s.fwhm.right) - positionAt(x, s.fwhm.left))}${settings.axis === "typed" ? unitText(settings.axisUnit) : ""} along the axis`}`
            : "not defined: the array stays above half of its range on one side, or is flat";
        const rows = [
            ["Elements", String(s.n)],
            ["Time", timeText(frame.t, options.zone())],
            ["Maximum", `${number(s.max)}${unitText(unit)} at element ${s.maxAt}${inAxis(s.maxAt)}`],
            ["Minimum", `${number(s.min)}${unitText(unit)} at element ${s.minAt}${inAxis(s.minAt)}`],
            ["Mean", `${number(s.mean)}${unitText(unit)}`],
            ["RMS", `${number(s.rms)}${unitText(unit)}`],
            ["Sum", `${number(s.sum)}${unitText(unit)}`],
            ["Centre", s.centre === null ? "not defined: the sum is not positive" : `element ${number(s.centre)}${settings.axis === "index" ? "" : ` (${number(positionAt(x, s.centre))}${settings.axis === "typed" ? unitText(settings.axisUnit) : ""})`}`],
            ["Half-maximum width", widthText],
        ];
        plot.replaceChildren();
        numbers.append(node("table", { class: "chart-stats wave-table", "aria-label": "Summary values of the frame" }, node("tbody", null, ...rows.map(([name, value]) => node("tr", { "data-row": name }, node("th", { scope: "row" }, name), node("td", null, value))))));
    }

    function drawSeries(frames) {
        const unit = valueUnit();
        const summaries = frameSummaries(frames);
        const { points, undefinedCount } = summarySeries(summaries, settings.value);
        const label = SUMMARY_VALUES.find(([key]) => key === settings.value)[1];
        plot.replaceChildren();
        if (!points.length) {
            message.textContent = `${label} is not defined for any of the ${frames.length} frames read.`;
            return null;
        }
        const yUnit = settings.value === "maxAt" || settings.value === "centre" || settings.value === "width" ? "element" : unit || "value";
        const t0 = points[0].t;
        const t1 = points.length > 1 ? points[points.length - 1].t : t0 + 1000;
        const { surface, x: xs, y } = canvasIn({ xScale: d3.scaleTime().domain([new Date(t0), new Date(t1)]), yScale: d3.scaleLinear().domain(extent([points.map((p) => p.v)])), yUnit,
            yLabel: `${label}${yUnit === "element" ? " / elements" : unitText(unit ? `/ ${unit}` : "")}`, xLabel: `Time, ${zoneName(options.zone(), new Date(t0))}`, label: `${label} of ${current.name} over time`,
            xFormat: (date) => formatInZone(date, AXIS_TIME_FORMAT, options.zone()) });
        plot.append(surface.svg.node());
        const line = d3.line().x((p) => xs(new Date(p.t))).y((p) => y(p.v));
        surface.marks.append("path").attr("class", "wave-line wave-series").attr("data-points", points.length).attr("data-value", settings.value).attr("d", line(points));
        const search = d3.bisector((p) => p.t).center;
        surface.bindHover(plot, ({ x: at }) => {
            const k = Math.max(0, Math.min(points.length - 1, search(points, +at)));
            return { title: timeText(points[k].t, options.zone()), rows: [`${label}: ${number(points[k].v)}`] };
        });
        if (undefinedCount) message.textContent = `${label} is not defined for ${undefinedCount} of the ${frames.length} frames; they are left out of the series.`;
        const values = points.map((p) => p.v);
        const rows = [
            ["Frames read", String(frames.length)], ["Points drawn", String(points.length)], ["Not defined", String(undefinedCount)],
            ["First", `${number(points[0].v)} at ${timeText(points[0].t, options.zone())}`], ["Last", `${number(points[points.length - 1].v)} at ${timeText(points[points.length - 1].t, options.zone())}`],
            ["Lowest", number(Math.min(...values))], ["Highest", number(Math.max(...values))],
        ];
        numbers.append(node("table", { class: "chart-stats wave-table", "aria-label": `${label} over the frames` }, node("tbody", null, ...rows.map(([name, value]) => node("tr", { "data-row": name }, node("th", { scope: "row" }, name), node("td", null, value))))));
        return points;
    }

    /** A table of named rows under the plot. */
    const rowsTable = (label, rows) => numbers.append(node("table", { class: "chart-stats wave-table", "aria-label": label },
        node("tbody", null, ...rows.map(([name, value]) => node("tr", { "data-row": name }, node("th", { scope: "row" }, name), node("td", null, value))))));

    /** The frame in view minus the reference frame, element by element, with the summary values of the difference. */
    function drawDifference(frame, x) {
        const reference = current.reference;
        if (!reference) {
            message.textContent = "Type the time of the reference frame and read it; the difference is the frame in view minus that frame.";
            return;
        }
        if (!reference.values) throw new RangeError(`The reference frame cannot be read: ${reference.problem}`);
        if (reference.length !== frame.length) {
            throw new RangeError(`The reference frame has ${reference.length} elements and the frame in view has ${frame.length}; a difference needs one length.`);
        }
        const values = difference(frame.values, reference.values);
        drawArray({ ...frame, values }, x, `${current.name} at ${timeText(frame.t, options.zone())} minus ${timeText(reference.t, options.zone())}`);
        const s = summary(values);
        const unit = valueUnit();
        rowsTable("Summary values of the difference", [
            ["Reference", timeText(reference.t, options.zone())], ["Frame", timeText(frame.t, options.zone())],
            ["Maximum", `${number(s.max)}${unitText(unit)} at element ${s.maxAt}`], ["Minimum", `${number(s.min)}${unitText(unit)} at element ${s.minAt}`],
            ["Mean", `${number(s.mean)}${unitText(unit)}`], ["RMS", `${number(s.rms)}${unitText(unit)}`], ["Sum", `${number(s.sum)}${unitText(unit)}`],
        ]);
    }

    /** The power spectral density of the frame in view at its sampling frequency, with the window chosen and the strongest peak. */
    function drawSpectrum(frame) {
        const rate = samplingFrequency(frame);
        if (!rate.ok) {
            message.textContent = rate.reason;
            return;
        }
        const nfft = nextPowerOfTwo(frame.length);
        const s = spectra(frame.values, rate.fs, settings.window, nfft);
        if (!s) throw new RangeError("The frame has too few elements for a spectrum.");
        const peak = spectralPeak(s.frequencies, s.power);
        if (!peak || !(peak.power > 0)) throw new RangeError("The frame has no power above 0 Hz: a constant array has no spectrum to show.");
        const unit = valueUnit();
        const densityUnit = `${unit || "unit"}²/Hz`;
        const log = settings.scale === "log";
        // The logarithmic axis reaches down to 1e-12 of the highest density, as the Spectrum tab draws it: the bin at 0 Hz holds only a
        // rounding residue once the mean is removed, and a lower bound taken from it would press the spectrum into the top of the plot.
        const high = d3.max(s.density);
        const low = log ? Math.max(d3.min(Array.from(s.density).filter((v) => v > 0)), high * 1e-12) : 0;
        const yScale = log ? d3.scaleLog().domain([low, high]) : d3.scaleLinear().domain([0, high * 1.06 || 1]);
        const { surface, x: xs, y } = canvasIn({ xScale: d3.scaleLinear().domain([0, rate.fs / 2]), yScale, yUnit: densityUnit, yLabel: `Power spectral density / ${densityUnit}`,
            xLabel: "Frequency / Hz", label: `Spectrum of ${current.name} at ${timeText(frame.t, options.zone())}`, xFormat: d3.format(".4~g") });
        plot.replaceChildren();
        plot.append(surface.svg.node());
        const line = d3.line().x((_, i) => xs(s.frequencies[i])).y((v) => y(Math.max(v, low)));
        surface.marks.append("path").attr("class", "wave-line wave-spectrum").attr("data-bins", s.frequencies.length).attr("d", line(Array.from(s.density)));
        if (peak) {
            surface.marks.append("circle").attr("class", "wave-max").attr("r", 4).attr("cx", xs(peak.binFrequency)).attr("cy", y(s.density[peak.index]));
        }
        const search = d3.bisector((f) => f).center;
        surface.bindHover(plot, ({ x: at }) => {
            const k = Math.max(0, Math.min(s.frequencies.length - 1, search(s.frequencies, +at)));
            return { title: `${number(s.frequencies[k])} Hz`, rows: [`Density: ${number(s.density[k])} ${densityUnit}`] };
        });
        rowsTable("Spectrum of the frame", [
            ["Sampling frequency", `${number(rate.fs)} Hz (${rate.source === "typed" ? "typed" : `${rate.source} at the time of the frame`})`],
            ["Window", SPECTRUM_WINDOWS.find(([w]) => w === settings.window)[1]], ["Transform length", String(nfft)], ["Bin width", `${number(s.binWidth)} Hz`],
            ["Peak frequency", peak ? `${number(peak.frequency)} Hz (bin ${number(peak.binFrequency)} Hz)` : "none"],
            ["Peak width", peak && peak.width !== null ? `${number(peak.width)} Hz at half of the peak power` : "not defined"],
            ["Peak density", peak ? `${number(s.density[peak.index])} ${densityUnit}` : "none"],
        ]);
    }

    /** The settings of the peak search and of the background, read from the controls; a RangeError names the first one out of range. */
    function peakSettings() {
        const whole = (text, name, least) => {
            const v = finiteNumber(text);
            if (!Number.isInteger(v) || v < least) throw new RangeError(`The ${name} is a whole number, ${least} or more.`);
            return v;
        };
        const sigma = finiteNumber(settings.sigma);
        if (!Number.isFinite(sigma)) throw new RangeError("The sigma of the searched peaks is not a number.");
        const percent = finiteNumber(settings.threshold);
        if (!(percent > 0 && percent < 100)) throw new RangeError("The threshold is a percent of the highest value of the spectrum, above 0 and below 100.");
        return {
            sigma, threshold: percent / 100, background: settings.searchBackground, markov: settings.markov,
            averageWindow: settings.markov ? whole(settings.averageWindow, "averaging window of the Markov smoothing", 1) : 3,
            deconvolutionIterations: whole(settings.deconvolution, "number of deconvolution iterations", 0), maxPeaks: MOST_PEAKS,
            widthIterations: whole(settings.backgroundIterations, "number of iterations of the background", 1), widthDirection: settings.backgroundDirection,
        };
    }

    /** The peaks of the frame in view as ROOT finds them, the clipped background, and either the array with it or the array minus it. */
    function drawPeaks(frame, x) {
        const found = peaks(frame.values, peakSettings());
        const unit = valueUnit();
        const subtracted = settings.peakView === "subtracted";
        const shown = subtracted ? found.above : frame.values;
        const { surface, x: xs, y } = canvasIn({ xScale: d3.scaleLinear().domain(xExtent(x)), yScale: d3.scaleLinear().domain(extent([shown, ...(subtracted ? [] : [found.background])])), yUnit: unit || "value",
            yLabel: `Value${unitText(unit ? `/ ${unit}` : "")}`, xLabel: axisLabel(), label: `Peaks of ${current.name} at ${timeText(frame.t, options.zone())}`, xFormat: d3.format(".4~g") });
        plot.replaceChildren();
        plot.append(surface.svg.node());
        const width = Math.floor(plot.clientWidth || 720) - MARGIN.left - MARGIN.right;
        const line = (values) => d3.line().x((i) => xs(x[i])).y((i) => y(values[i]))(drawingIndices(values, Math.max(1, width)));
        surface.marks.append("path").attr("class", "wave-line").attr("data-elements", frame.length).attr("d", line(shown));
        if (!subtracted) surface.marks.append("path").attr("class", "wave-line wave-background").attr("d", line(found.background));
        for (const p of found.peaks) {
            surface.marks.append("circle").attr("class", "wave-peak").attr("data-element", p.index).attr("r", 4).attr("cx", xs(positionAt(x, p.position))).attr("cy", y(shown[p.index]));
        }
        const search = d3.bisector((v) => v).center;
        surface.bindHover(plot, ({ x: at }) => {
            const k = Math.max(0, Math.min(frame.length - 1, search(x, +at)));
            return { title: `Element ${k}`, rows: [`Value: ${number(frame.values[k])}${unitText(unit)}`, `Background: ${number(found.background[k])}${unitText(unit)}`, `Minus background: ${number(found.above[k])}${unitText(unit)}`] };
        });
        const inAxis = (position) => (settings.axis === "index" ? "" : ` (${number(positionAt(x, position))}${settings.axis === "typed" ? unitText(settings.axisUnit) : ""})`);
        readout.textContent = `${found.peaks.length} peak${found.peaks.length === 1 ? "" : "s"} in the order of ROOT, the highest of the deconvolved spectrum first.`;
        numbers.append(node("table", { class: "chart-stats wave-table wave-peaks", "aria-label": "Peaks of the frame" },
            node("thead", null, node("tr", null, ...["", "Position / elements", "Nearest element", "Height", "Width at half height / elements"].map((h) => node("th", { scope: "col" }, h)))),
            node("tbody", null, ...found.peaks.map((p, k) => node("tr", { "data-row": String(k + 1) }, node("th", { scope: "row" }, String(k + 1)),
                node("td", null, `${number(p.position)}${inAxis(p.position)}`), node("td", null, String(p.index)), node("td", null, `${number(p.value)}${unitText(unit)}`),
                node("td", null, p.width === null ? "not defined" : `${number(p.width)}${settings.axis === "index" ? "" : `, ${number(positionAt(x, p.right) - positionAt(x, p.left))}${settings.axis === "typed" ? unitText(settings.axisUnit) : ""} along the axis`}`))))));
    }

    function syncFrameBar() {
        const ready = current.status === "ready";
        frameBar.hidden = !ready;
        if (!ready) return;
        const count = current.nav.length;
        slider.max = String(count - 1);
        slider.value = String(current.index);
        slider.disabled = count < 2;
        previous.disabled = slider.disabled || current.index <= 0;
        next.disabled = slider.disabled || current.index >= count - 1;
        const frame = frameInView();
        if (document.activeElement !== timeBox) timeBox.value = options.formatTime ? options.formatTime(new Date(frame.t)) : "";
    }

    function render() {
        const list = options.signals();
        syncSignals(list);
        plot.replaceChildren();
        numbers.replaceChildren();
        message.textContent = "";
        frameNote.textContent = "";
        readout.textContent = "";
        error.textContent = "";
        view.value = settings.view;
        axis.value = settings.axis;
        const typed = settings.axis === "typed";
        for (const control of [axisStart, axisStep, axisUnit]) control.parentElement.hidden = !typed;
        axisPv.parentElement.hidden = settings.axis !== "companion";
        overlay.parentElement.hidden = settings.view !== "overlay";
        valueSelect.parentElement.hidden = settings.view !== "series";
        for (const [name, list] of Object.entries(viewFields)) for (const element of list) element.hidden = settings.view !== name;
        if (settings.view === "spectrum") {
            fsBox.parentElement.hidden = settings.fsSource !== "typed";
            fsPv.parentElement.hidden = settings.fsSource !== "pv";
        }
        averageBox.parentElement.hidden = settings.view !== "peaks" || !settings.markov;
        fsSource.value = settings.fsSource;
        windowSelect.value = settings.window;
        scaleSelect.value = settings.scale;
        directionSelect.value = settings.backgroundDirection;
        peakViewSelect.value = settings.peakView;
        searchBackground.checked = settings.searchBackground === true;
        markov.checked = settings.markov === true;
        for (const [control, key] of [[fsBox, "fs"], [sigmaBox, "sigma"], [thresholdBox, "threshold"], [averageBox, "averageWindow"], [deconvolutionBox, "deconvolution"], [backgroundBox, "backgroundIterations"]]) {
            if (document.activeElement !== control) control.value = settings[key];
        }
        if (document.activeElement !== axisStart) axisStart.value = settings.axisStart;
        if (document.activeElement !== axisStep) axisStep.value = settings.axisStep;
        if (document.activeElement !== axisUnit) axisUnit.value = settings.axisUnit;
        if (document.activeElement !== overlay) overlay.value = settings.overlay;
        valueSelect.value = settings.value;
        if (!list.length) {
            frameBar.hidden = true;
            message.textContent = "Select an archived array PV to see its frames.";
            return;
        }
        const range = options.range();
        const key = `${settings.signal}|${range.from.toISOString()}|${range.to.toISOString()}`;
        if (current.key !== key) {
            frameBar.hidden = true;
            message.textContent = "Reading the frames...";
            load(settings.signal, range);
            return;
        }
        if (current.status === "loading") {
            frameBar.hidden = true;
            message.textContent = "Reading the frames...";
            return;
        }
        if (current.status === "failed") {
            frameBar.hidden = true;
            message.textContent = current.reason;
            return;
        }
        syncFrameBar();
        const frame = frameInView();
        const { plan, parsed } = current;
        frameNote.textContent = `Frame ${current.index + 1} of ${current.nav.length}${frame === current.typed ? ", read at the typed time" : ""}, ${timeText(frame.t, options.zone())}, ${frame.length} elements.`
            + `${frame === current.typed ? ` The heatmap and the series draw the ${current.thinned.length} frames of the range.` : ""}`
            + `${plan.step > 1 || current.step > 1 ? ` Showing one frame in ${plan.step * current.step} (server step ${plan.step}, page step ${current.step}).` : ""}`
            + `${current.byElements ? ` To keep the browser responsive, the page reads at most ${elementsText(ELEMENTS_MOST)} elements at a time; the frames read held ${elementsText(current.elements)} elements in ${current.total} frames.` : ""}`
            + `${parsed.lengths.length > 1 ? ` The frames have ${parsed.lengths.length} different element counts (${parsed.lengths.map((e) => e.length).join(", ")}).` : ""}`;
        if (!frame.values) {
            message.textContent = `This frame cannot be read: ${frame.problem}`;
            return;
        }
        const x = axisOf(frame);
        if (!x.ok) {
            message.textContent = x.reason;
            return;
        }
        try {
            if (settings.view === "array") {
                drawArray(frame, x.x);
            } else if (settings.view === "values") {
                drawValues(frame, x.x);
            } else if (settings.view === "difference") {
                drawDifference(frame, x.x);
            } else if (settings.view === "spectrum") {
                drawSpectrum(frame);
            } else if (settings.view === "peaks") {
                drawPeaks(frame, x.x);
            } else if (settings.view === "series") {
                drawSeries(current.thinned);
            } else if (settings.view === "overlay") {
                const count = finiteNumber(settings.overlay);
                if (!Number.isInteger(count) || count < 1 || count > OVERLAY_MOST) {
                    error.textContent = `Enter a whole number of frames from 1 to ${OVERLAY_MOST}.`;
                    return;
                }
                checkFrames(current.nav);
                const indexes = overlayFrames(current.nav, current.index, count);
                drawOverlay(current.nav, indexes, x.x, current.index);
                readout.textContent = `${indexes.length} frames overlaid; the frame in view is black.`;
            } else {
                checkFrames(current.thinned);
                if (!evenlySpaced(x.x)) {
                    message.textContent = "The axis is not evenly spaced, and the picture of time against element draws the elements evenly. Choose the element number or a typed step for this view.";
                    return;
                }
                drawHeatmap(current.thinned, x.x);
            }
        } catch (problem) {
            if (!(problem instanceof RangeError)) throw problem;
            plot.replaceChildren();
            message.textContent = problem.message;
        }
    }

    slider.addEventListener("input", () => moveTo(Number(slider.value)));
    previous.addEventListener("click", () => moveTo(current.index - 1));
    next.addEventListener("click", () => moveTo(current.index + 1));
    goTo.addEventListener("click", async () => {
        error.textContent = "";
        if (current.status !== "ready") return;
        const date = options.parseTime ? options.parseTime(timeBox.value.trim(), new Date(frameInView().t)) : null;
        if (!date) {
            error.textContent = "Enter the time in the zone of the page as year-month-dayThour:minute:second, for example 2026-11-07T12:00:00.";
            return;
        }
        const mine = current;
        try {
            const response = await options.retrieve(mine.name, date, new Date(+date + 1), new AbortController().signal);
            if (!response.ok) throw new Error(`${response.statusText || "Retrieval failed"} (HTTP ${response.status})`);
            const parsed = parseFrames(await response.json());
            if (current !== mine) return;
            const found = parsed.frames.find((f) => f.t <= +date) || parsed.frames[0];
            if (!found) {
                error.textContent = "The archive holds no frame at or before that time.";
                return;
            }
            showTyped(found);
        } catch (problem) {
            error.textContent = `The frame could not be read: ${problem.message || problem}`;
        }
    });
    // The reference of the difference: the frame stored at or before a typed time, read from the archive and kept until another is read or
    // the selection changes.
    readReference.addEventListener("click", async () => {
        error.textContent = "";
        if (current.status !== "ready") return;
        const date = options.parseTime ? options.parseTime(referenceBox.value.trim(), new Date(frameInView().t)) : null;
        if (!date) {
            error.textContent = "Enter the time of the reference in the zone of the page as year-month-dayThour:minute:second, for example 2026-11-07T12:00:00.";
            return;
        }
        const mine = current;
        try {
            const response = await options.retrieve(mine.name, date, new Date(+date + 1), new AbortController().signal);
            if (!response.ok) throw new Error(`${response.statusText || "Retrieval failed"} (HTTP ${response.status})`);
            const parsed = parseFrames(await response.json());
            if (current !== mine) return;
            const found = parsed.frames.find((f) => f.t <= +date) || parsed.frames[0];
            if (!found) {
                error.textContent = "The archive holds no frame at or before the time of the reference.";
                return;
            }
            current.reference = found;
            settings.reference = String(found.t);
            changed();
        } catch (problem) {
            error.textContent = `The reference could not be read: ${problem.message || problem}`;
        }
    });
    overlay.addEventListener("change", () => {
        const count = finiteNumber(overlay.value.trim());
        if (!Number.isInteger(count) || count < 1 || count > OVERLAY_MOST) {
            error.textContent = `Enter a whole number of frames from 1 to ${OVERLAY_MOST}.`;
            overlay.value = settings.overlay;
            return;
        }
        settings.overlay = String(count);
        changed();
    });
    return { render, settings };
}
