// The Image tab of the analyzer: one array PV read as an image of a width and a height (typed, or read from a PV of each role at the time
// of the frame; never inferred from the length), one frame at a time. The tab learns where the frames of the range lie without their
// pixels (count_N of the retrieval) when the server would read at most LIST_ELEMENTS_MOST elements for it, and otherwise steps through the
// range at evenly spaced times; each frame is read alone through a window of one millisecond, which holds the frame at or before its end.
// A frame is drawn as a heatmap on a canvas (viridis from its lowest to its highest value, or a diverging scale for the difference of two
// frames, with a colour bar labelled by value) with iso-lines at 10, 50 and 90 percent, computed on the grid the canvas shows; Flip X and
// Flip Y mirror the picture and never the stored indices. A region of interest chosen with the mouse or typed gives the total, the mean,
// the minimum, the peak, the centroid, the X projection (drawn under the picture) and the Y projection (at its side) on the pixel axes of
// the picture, and the Gaussian size of each projection, after an optional background (a typed level or the mean of a second region); the
// values over at most SERIES_MOST frames are read one frame at a time with a count of the times read, a frame whose size or region does not
// hold being counted as refused with its reason, and Cancel. A frame larger than
// PIXELS_MOST elements is refused before any request, and an image whose size does not match its length, a region outside it and a
// reference of another size are refused with their reason, leaving no stale result.
import { createPlotCanvas } from "../comm/js/aa/chart.js";
import { createHoverTip } from "../comm/js/aa/chart/hover.js";
import { node } from "../comm/js/aa/dom.js";
import { infoButton } from "../comm/js/aa/card.js";
import { finiteNumber } from "../comm/js/aa/chart/state.js";
import { BYTES_PER_ELEMENT, elementsText, parseFrames, readBounded } from "../comm/js/aa/arrays.js";
import { FWHM_FACTOR, checkImage, checkRegion, frameDifference, gaussianSize, regionStats, subtractConstant } from "../comm/js/aa/image.js";
import { formatInZone } from "../comm/js/aa/timezone.js";

const d3 = globalThis.d3;

/** The largest frame the tab reads: 2560 by 2160 pixels (decision of 2026-11-12, measured in the browser and on the server). */
export const PIXELS_MOST = 5529600;
/** The most elements the server may read to list the frames of a range (count_N); beyond, the range is stepped by time. */
export const LIST_ELEMENTS_MOST = 230400000;
/** The most stops of a range: one-second bins of an hour, or evenly spaced times. */
export const STOPS_MOST = 3600;
/** The most frames whose values are read over the range. */
export const SERIES_MOST = 100;
/** The display grid fits the frame in at most this many canvas pixels. */
const GRID = { width: 1000, height: 800 };
const LEVELS = [0.1, 0.5, 0.9];
const COLOUR_STEPS = 256;
const PLOT_HEIGHT = 220;
const AXES = { left: 56, right: 12, top: 8, bottom: 44 };
/** The projection under the picture (its height) and the one at its side (its width), on the pixel axes of the picture. */
const PROJECTION = { under: 170, side: 220, pad: 12, valueAxis: 30 };
/** The colour bar: its length and the spacing of its gradient stops. */
const COLOUR_BAR = { width: 290, height: 34, length: 200, stops: 10 };
const MARGIN = { left: 84, right: 24, top: 24, bottom: 52 };
const TIME_FORMAT = "%Y-%m-%d %H:%M:%S";

export const IMAGE_VIEWS = [["frame", "Frame"], ["difference", "Difference from a reference"], ["series", "Values over the range"]];
export const SIZE_SOURCES = [["typed", "Typed"], ["pv", "PVs of the width and height"]];
export const BACKGROUNDS = [["none", "None"], ["level", "Typed level"], ["region", "Mean of a background region"]];
export const SERIES_VALUES = [["total", "Total"], ["centroidX", "Centroid X"], ["centroidY", "Centroid Y"], ["peak", "Peak value"], ["sigmaX", "Sigma X"], ["sigmaY", "Sigma Y"]];
// The settings of the tab and their defaults; the address carries the ones that differ (viewer/tool-address.js).
export const IMAGE_DEFAULTS = Object.freeze({ signal: null, view: "frame", sizeSource: "typed", width: "", height: "", widthPv: null, heightPv: null, frame: "",
    x0: "", x1: "", y0: "", y1: "", background: "none", level: "", bx0: "", bx1: "", by0: "", by1: "", flipX: false, flipY: false, reference: "", seriesValue: "centroidX" });

const CARD = [
    "Image: how is an image read, and what do its numbers mean?",
    [
        ["In short", "An image PV stores each frame as one array of width times height values, row by row from the top left. The tab reads one frame at a time and draws it, with the values of a region you choose."],
        ["Size", "The width and the height are typed, or read from a PV of each role at the time of the frame. They are never guessed from the length: a size whose width times height is not the number of elements is refused. Only single-channel images are read; a colour image of three values a pixel is refused."],
        ["Largest frame", `To keep your browser and the server responsive, a frame holds at most ${elementsText(PIXELS_MOST)} elements (2560 by 2160); a larger one is refused before it is read. Measured on one workstation: 1920 by 1200 read and parsed in 0.55 to 0.85 s and 114 to 130 MB of browser memory, 2560 by 2160 in 0.75 to 0.84 s and up to 302 MB, 4096 by 4096 stopped the page. The retrieval needs a heap of at least 512 MB to serve a frame of 2560 by 2160; 384 MB was not enough.`],
        ["Frames of a range", `When the server would read at most ${elementsText(LIST_ELEMENTS_MOST)} elements (100 frames of 1920 by 1200, about 7 s) it is asked where the frames lie, without their pixels, in bins of N seconds, at most ${STOPS_MOST}; each bin shows its last frame. A longer range is stepped at ${STOPS_MOST} evenly spaced times, each showing the frame at or before it. For example 1920 by 1200 every 10 s lists about 17 minutes, 640 by 480 every 30 s about 6.3 hours, 640 by 480 at 10 Hz about 75 s.`],
        ["Picture", "The colour is viridis from the lowest to the highest value of the frame, shown by the colour bar with its values; the difference of two frames is coloured from blue (negative) through white to red (positive). The X projection lies under the picture and the Y projection at its side, on the pixel axes of the picture. A frame wider than the canvas shows in each canvas pixel the highest of the pixels it covers (for the difference, the one of largest size), so that a narrow feature stays visible; every number comes from the frame at full resolution. Iso-lines mark 10, 50 and 90 percent of the way from the lowest to the highest value."],
        ["Orientation", "Flip X and Flip Y mirror the picture only. The indices, the region and every value stay those of the stored image, the column index running along X from the left and the row index along Y from the top."],
        ["Region", "Drag a rectangle on the picture, or type the first and the last-plus-one column and row. A drag takes the pixels whose centres lie inside it and writes their indices into the fields."],
        ["Values", "The total, the mean, the minimum, the peak (the first highest pixel in row order), the intensity-weighted centroid (not defined for a total that is not positive), and the X and Y projections, the sums of the columns and the rows of the region."],
        ["Gaussian size", `A Gaussian with a constant is fitted to each projection: sigma, the full width at half maximum (${FWHM_FACTOR.toFixed(4)} sigma) and the centre, with their standard errors, in pixels. Each is the size along an axis of the stored image, not of a tilted spot.`],
        ["Background", "A typed level, or the mean of a second region, is subtracted from every pixel before the values; no value is clamped, so the centroid is not defined when the total falls to zero or below. The Gaussian size does not change: its constant takes the level."],
        ["Difference", "The frame in view minus a reference read at or before a typed time; a reference of another size is refused."],
        ["Values over the range", `The values of the region for at most ${SERIES_MOST} frames read at evenly spaced times of the range, one at a time, with a count of the times read; a frame whose size cannot be read or does not hold the region is counted as refused, with the reason. Cancel stops the reading and keeps what was read.`],
    ],
    null,
];

const number = (value) => (Number.isFinite(value) ? Number(value).toPrecision(6) : "not defined");
const timeText = (t, zone) => formatInZone(new Date(t), TIME_FORMAT, zone);
const whole = (text) => { const v = finiteNumber(text); return Number.isInteger(v) ? v : null; };

/** The colour table of a scale as [r, g, b] triples. */
function colourTable(interpolate) {
    return Array.from({ length: COLOUR_STEPS }, (_, k) => {
        const colour = d3.color(interpolate(k / (COLOUR_STEPS - 1)));
        return [colour.r, colour.g, colour.b];
    });
}

/** The display grid of a frame: blocks of b by b pixels, each its highest pixel, or for signed values the one of largest size. */
export function displayGrid(pixels, width, height, signed = false) {
    const b = Math.max(1, Math.ceil(Math.max(width / GRID.width, height / GRID.height)));
    const gw = Math.ceil(width / b);
    const gh = Math.ceil(height / b);
    const cells = new Float64Array(gw * gh).fill(NaN);
    for (let y = 0; y < height; y += 1) {
        const row = Math.floor(y / b) * gw;
        for (let x = 0; x < width; x += 1) {
            const k = row + Math.floor(x / b);
            const v = pixels[y * width + x];
            const held = cells[k];
            if (Number.isNaN(held) || (signed ? Math.abs(v) > Math.abs(held) : v > held)) cells[k] = v;
        }
    }
    return { cells, width: gw, height: gh, block: b };
}

/** The lowest and highest value of an array. */
function rangeOf(values) {
    let low = Infinity;
    let high = -Infinity;
    for (const v of values) { if (v < low) low = v; if (v > high) high = v; }
    return { low, high };
}

/** The Image tab: its controls are built once and its body is drawn again at each render. */
export function createImage(host, options) {
    const settings = { ...IMAGE_DEFAULTS, ...(options.settings || {}) };
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
    const checkbox = (label, key) => {
        const element = node("input", { type: "checkbox", "aria-label": label });
        element.checked = settings[key] === true;
        element.addEventListener("change", () => { settings[key] = element.checked; changed(); });
        return element;
    };
    const pvSelect = (label, key) => {
        const element = node("select", { "aria-label": label });
        element.addEventListener("change", () => { settings[key] = element.value; changed(); });
        return element;
    };
    const signal = node("select", { "aria-label": "Image signal" });
    signal.addEventListener("change", () => { settings.signal = signal.value; settings.frame = ""; changed(); });
    const view = select("Image view", IMAGE_VIEWS, "view");
    const sizeSource = select("Size from", SIZE_SOURCES, "sizeSource");
    const widthBox = textInput("Image width", "width", 6, "pixels");
    const heightBox = textInput("Image height", "height", 6, "pixels");
    const widthPv = pvSelect("Width PV", "widthPv");
    const heightPv = pvSelect("Height PV", "heightPv");
    const flipX = checkbox("Flip X", "flipX");
    const flipY = checkbox("Flip Y", "flipY");
    const regionBoxes = ["x0", "x1", "y0", "y1"].map((key) => textInput(`Region ${key}`, key, 5));
    const wholeFrame = node("button", { type: "button" }, "Whole frame");
    const background = select("Background", BACKGROUNDS, "background");
    const levelBox = textInput("Background level", "level", 8);
    const bgBoxes = ["bx0", "bx1", "by0", "by1"].map((key) => textInput(`Background region ${key.slice(1)}`, key, 5));
    const referenceBox = node("input", { type: "text", size: "20", "aria-label": "Reference at or before the time", placeholder: "time" });
    const readReference = node("button", { type: "button" }, "Read reference");
    const seriesValue = select("Value over the range", SERIES_VALUES, "seriesValue");
    const readSeries = node("button", { type: "button" }, "Read the values");
    const cancelSeries = node("button", { type: "button", disabled: "" }, "Cancel");
    const slider = node("input", { type: "range", min: "0", max: "0", step: "1", value: "0", "aria-label": "Frame of the range" });
    const previous = node("button", { type: "button", "aria-label": "Previous frame" }, "Previous");
    const next = node("button", { type: "button", "aria-label": "Next frame" }, "Next");
    const timeBox = node("input", { type: "text", size: "20", "aria-label": "Frame at or before the time", placeholder: "time" });
    const goTo = node("button", { type: "button" }, "Go to time");
    const error = node("p", { class: "error", role: "alert" });
    const field = (text, control) => node("label", null, text, control);
    const sizeFields = { typed: [field("Width ", widthBox), field("Height ", heightBox)], pv: [field("Width PV ", widthPv), field("Height PV ", heightPv)] };
    const controls = node("div", { class: "wave-controls img-controls" }, field("Signal ", signal), field("View ", view), field("Size from ", sizeSource), ...sizeFields.typed, ...sizeFields.pv,
        field("Flip X ", flipX), field("Flip Y ", flipY), infoButton(...CARD, options.helpHref));
    const regionBar = node("div", { class: "wave-controls img-region", role: "group", "aria-label": "Region" }, node("span", null, "Region "), ...regionBoxes.map((box, k) => field(["x ", "to ", "y ", "to "][k], box)), wholeFrame,
        field("Background ", background), field("Level ", levelBox), ...bgBoxes.map((box, k) => field(["bx ", "to ", "by ", "to "][k], box)));
    const viewBar = node("div", { class: "wave-controls" }, field("Reference ", referenceBox), readReference, field("Value ", seriesValue), readSeries, cancelSeries);
    const frameBar = node("div", { class: "wave-frames", role: "group", "aria-label": "Frame of the range" }, previous, slider, next, field("Time ", timeBox), goTo);
    const frameNote = node("p", { class: "note wave-frame-note img-note", role: "status" });
    const message = node("p", { class: "note wave-message img-message", role: "status" });
    const readout = node("p", { class: "note wave-readout img-readout", role: "status" });
    const plot = node("div", { class: "chart img-plot" });
    const numbers = node("div", { class: "wave-numbers img-numbers" });
    host.replaceChildren(controls, regionBar, viewBar, frameBar, error, message, frameNote, plot, readout, numbers);

    // One selection: a signal over a range, its type information, its stops (bins or times), the frame in view and the frames read.
    let current = { key: null, status: "idle" };
    const sizes = new Map();
    let series = null;
    // A drag on the picture: where it started, in stored pixels, and how the picture maps the pointer.
    let drag = null;
    window.addEventListener("mouseup", (event) => {
        if (!drag) return;
        const { from, toStored, width, height } = drag;
        drag = null;
        const end = toStored(event);
        // The pixels whose centres (index + 0.5) lie inside the rectangle.
        const x0 = Math.max(0, Math.ceil(Math.min(from.fx, end.fx) - 0.5));
        const x1 = Math.min(width, Math.floor(Math.max(from.fx, end.fx) - 0.5) + 1);
        const y0 = Math.max(0, Math.ceil(Math.min(from.fy, end.fy) - 0.5));
        const y1 = Math.min(height, Math.floor(Math.max(from.fy, end.fy) - 0.5) + 1);
        Object.assign(settings, { x0: String(x0), x1: String(x1), y0: String(y0), y1: String(y1) });
        changed();
    });

    function syncSignals(list) {
        const names = list.map((entry) => entry.name);
        if (names.join("\n") !== [...signal.options].map((o) => o.value).join("\n")) signal.replaceChildren(...list.map((e) => node("option", { value: e.name }, e.name)));
        if (!names.includes(settings.signal)) settings.signal = names[0] ?? null;
        if (settings.signal !== null) signal.value = settings.signal;
        const others = names.filter((name) => name !== settings.signal);
        for (const [element, key] of [[widthPv, "widthPv"], [heightPv, "heightPv"]]) {
            if (others.join("\n") !== [...element.options].map((o) => o.value).join("\n")) element.replaceChildren(...others.map((name) => node("option", { value: name }, name)));
            if (!others.includes(settings[key])) settings[key] = others.find((name) => (key === "widthPv" ? /W(IDTH)?$/i : /H(EIGHT)?$/i).test(name)) ?? others[0] ?? null;
            if (settings[key] !== null) element.value = settings[key];
        }
    }

    /** The JSON of a window of one millisecond ending at end: the frame at or before it, alone. */
    async function frameEndingAt(name, end, signal) {
        const response = await options.retrieve(name, new Date(end - 1), new Date(end), signal);
        if (!response.ok) throw new Error(`${response.statusText || "Retrieval failed"} (HTTP ${response.status})`);
        const read = await readBounded(response, PIXELS_MOST * BYTES_PER_ELEMENT);
        if (read.exceeded) throw new RangeError(`The answer passed ${(PIXELS_MOST * BYTES_PER_ELEMENT / 1048576).toFixed(0)} MB, more than a frame of ${elementsText(PIXELS_MOST)} elements takes, and was stopped.`);
        const parsed = parseFrames(JSON.parse(read.text));
        const found = parsed.frames.filter((f) => f.t < end).pop() || null;
        return { found, meta: parsed.meta };
    }

    /** Reads the type information and the stops of a signal over the range. */
    async function load(name, range) {
        current.controller?.abort();
        const controller = new AbortController();
        const mine = { key: `${name}|${+range.from}|${+range.to}`, name, range, status: "loading", reason: "", meta: null, stops: [], mode: null, n: 1, index: 0, frames: new Map(), typed: null, reference: null, controller };
        current = mine;
        sizes.clear();
        series = null;
        const fail = (reason) => { if (current === mine) { mine.status = "failed"; mine.reason = reason; render(); } };
        try {
            const meta = await options.metadata(name);
            if (current !== mine) return;
            if (!meta) return fail(`${name} has no type information on this appliance, so it cannot be read as an image. Archive it first.`);
            const type = String(meta.DBRType || "");
            if (!type.includes("WAVEFORM")) return fail(`${name} is stored as ${type || "an unknown type"}, not as an array; the Image tab reads arrays.`);
            if (type.includes("STRING") || type.includes("ENUM")) return fail(`${name} is an array of ${type.includes("STRING") ? "strings" : "enumerated values"}; the Image tab reads numeric arrays.`);
            mine.meta = meta;
            const elements = Number(meta.elementCount);
            if (elements > PIXELS_MOST) return fail(`A frame of ${name} holds ${elementsText(elements)} elements, more than the ${elementsText(PIXELS_MOST)} (2560 by 2160) the tab reads; it is not read.`);
            const seconds = Math.max(1, Math.ceil((range.to - range.from) / 1000));
            const estimate = seconds * Number(meta.computedEventRate || 0) * elements;
            if (estimate <= LIST_ELEMENTS_MOST) {
                const n = Math.max(1, Math.ceil(seconds / STOPS_MOST));
                const response = await options.retrieve(`count_${n}(${name})`, range.from, range.to, controller.signal);
                if (current !== mine) return;
                if (!response.ok) return fail(`${response.statusText || "Retrieval failed"} (HTTP ${response.status}).`);
                const body = await response.json();
                if (current !== mine) return;
                const bins = (Array.isArray(body) && body[0] && Array.isArray(body[0].data) ? body[0].data : []).filter((s) => Number(s.val) > 0);
                mine.mode = "bins";
                mine.n = n;
                mine.stops = bins.map((s) => Math.min(+range.to, (Number(s.secs) + n) * 1000));
                if (!mine.stops.length) return fail("The selected range holds no frame of this image. Choose a range in which it was stored.");
            } else {
                mine.mode = "times";
                const step = (range.to - range.from) / STOPS_MOST;
                mine.stops = Array.from({ length: STOPS_MOST }, (_, k) => Math.round(+range.from + step * (k + 1)));
            }
            const wanted = settings.frame === "" ? -1 : mine.stops.findIndex((s) => s >= finiteNumber(settings.frame) + 1);
            mine.index = wanted >= 0 ? wanted : mine.stops.length - 1;
            mine.status = "ready";
            render();
        } catch (problem) {
            if (problem.name === "AbortError") return;
            fail(String(problem.message || problem));
        }
    }

    /** The frame of a stop, read once and kept for the selection (at most three frames are kept). */
    function frameOf(end) {
        let entry = current.frames.get(end);
        if (entry) return entry;
        entry = { state: "loading" };
        current.frames.set(end, entry);
        while (current.frames.size > 3) current.frames.delete(current.frames.keys().next().value);
        const mine = current;
        frameEndingAt(mine.name, end, mine.controller.signal)
            .then(({ found, meta }) => {
                if (!found) Object.assign(entry, { state: "failed", reason: "The archive holds no frame at or before this time." });
                else if (!found.values) Object.assign(entry, { state: "failed", reason: found.problem || "The frame is not an array of numbers." });
                else Object.assign(entry, { state: "ready", frame: found, unit: (meta && meta.EGU) || "" });
                if (current === mine) render();
            })
            .catch((problem) => { if (problem.name === "AbortError") return; Object.assign(entry, { state: "failed", reason: String(problem.message || problem) }); if (current === mine) render(); });
        return entry;
    }

    /** The end of the window of the stop in view, or of a frame read at a typed time. */
    const stopInView = () => (current.typed !== null ? current.typed : current.stops[current.index]);

    /** The size of the image at the time of a frame: typed, or the last value of each PV at or before it, read once. */
    function sizeAt(frame) {
        if (settings.sizeSource === "typed") {
            if (settings.width === "" || settings.height === "") return { ok: false, reason: "Type the width and the height of the image in pixels, or choose the PVs of its width and height; a size is never taken from the length of the array." };
            const width = whole(settings.width);
            const height = whole(settings.height);
            if (!(width >= 1) || !(height >= 1)) return { ok: false, reason: "The width and the height of an image are whole numbers of pixels, 1 or more." };
            return { ok: true, width, height, source: "typed" };
        }
        if (!settings.widthPv || !settings.heightPv) return { ok: false, reason: "Choose the PVs of the width and the height, or type them." };
        const values = [];
        for (const pv of [settings.widthPv, settings.heightPv]) {
            const key = `${pv}|${frame.t}`;
            let entry = sizes.get(key);
            if (!entry) {
                entry = { state: "loading" };
                sizes.set(key, entry);
                const mine = current;
                options.retrieve(pv, new Date(frame.t), new Date(frame.t + 1), new AbortController().signal)
                    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`${response.statusText || "Retrieval failed"} (HTTP ${response.status})`))))
                    .then((body) => {
                        const sample = Array.isArray(body) && body[0] && Array.isArray(body[0].data) ? body[0].data.filter((s) => Number(s.secs) * 1000 <= frame.t + 1).pop() || body[0].data[0] : null;
                        if (!sample) Object.assign(entry, { state: "failed", reason: `${pv} holds no value at or before the time of the frame.` });
                        else if (Array.isArray(sample.val)) Object.assign(entry, { state: "failed", reason: `${pv} is an array, not one number of pixels.` });
                        else Object.assign(entry, { state: "ready", value: Number(sample.val) });
                        if (current === mine) render();
                    })
                    .catch((problem) => { Object.assign(entry, { state: "failed", reason: String(problem.message || problem) }); if (current === mine) render(); });
            }
            if (entry.state === "loading") return { ok: false, loading: true, reason: "Reading the size of the image..." };
            if (entry.state === "failed") return { ok: false, reason: entry.reason };
            values.push(entry.value);
        }
        const [width, height] = values;
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return { ok: false, reason: `The PVs give ${width} by ${height}; the width and the height are whole numbers of pixels, 1 or more.` };
        return { ok: true, width, height, source: "pv" };
    }

    /** The size at the time of a frame once its PVs are read (at most 30 s of waiting). */
    async function sizeReady(frame) {
        for (let waited = 0; waited < 30000; waited += 50) {
            const size = sizeAt(frame);
            if (!size.loading) return size;
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return { ok: false, reason: "The size of the image was not read within 30 s." };
    }

    /** The region of interest from the typed fields, or the whole frame when they are empty. */
    function regionOf(width, height, keys = ["x0", "x1", "y0", "y1"], wholeWhenEmpty = true) {
        const texts = keys.map((key) => settings[key]);
        if (texts.every((t) => t === "") && wholeWhenEmpty) return { x0: 0, x1: width, y0: 0, y1: height };
        const [x0, x1, y0, y1] = texts.map((t) => whole(t));
        const region = { x0, x1, y0, y1 };
        checkRegion(width, height, region);
        return region;
    }

    /** The pixels after the background of I5: a typed level or the mean of the background region; null when no background is chosen. */
    function backgroundLevel(pixels, width, height) {
        if (settings.background === "level") {
            const level = finiteNumber(settings.level);
            if (!Number.isFinite(level)) throw new RangeError("Type the background level as a number.");
            return level;
        }
        if (settings.background === "region") {
            const region = regionOf(width, height, ["bx0", "bx1", "by0", "by1"], false);
            return regionStats(pixels, width, height, region).mean;
        }
        return null;
    }

    /** The values of a region of an image after its background, with the Gaussian size of each projection. */
    function valuesOf(pixels, width, height) {
        const level = backgroundLevel(pixels, width, height);
        const used = level === null ? pixels : subtractConstant(pixels, level);
        const region = regionOf(width, height);
        const stats = regionStats(used, width, height, region);
        const positions = (from, count) => Array.from({ length: count }, (_, k) => from + k);
        const sizeX = gaussianSize(positions(stats.x0, stats.projectionX.length), stats.projectionX);
        const sizeY = gaussianSize(positions(stats.y0, stats.projectionY.length), stats.projectionY);
        return { level, stats, sizeX, sizeY, region };
    }

    function drawPicture(pixels, width, height, signed, label, reference) {
        const grid = displayGrid(pixels, width, height, signed);
        const { low, high } = rangeOf(pixels);
        const largest = Math.max(Math.abs(low), Math.abs(high)) || 1;
        const table = colourTable(signed ? (t) => d3.interpolateRdBu(1 - t) : d3.interpolateViridis);
        const scaleLow = signed ? -largest : low;
        const span = signed ? 2 * largest : high - low || 1;
        const canvas = document.createElement("canvas");
        canvas.width = grid.width;
        canvas.height = grid.height;
        const context = canvas.getContext("2d");
        const picture = context.createImageData(grid.width, grid.height);
        for (let gy = 0; gy < grid.height; gy += 1) {
            for (let gx = 0; gx < grid.width; gx += 1) {
                const sx = settings.flipX ? grid.width - 1 - gx : gx;
                const sy = settings.flipY ? grid.height - 1 - gy : gy;
                const v = grid.cells[sy * grid.width + sx];
                const colour = table[Math.max(0, Math.min(COLOUR_STEPS - 1, Math.round(((v - scaleLow) / span) * (COLOUR_STEPS - 1))))];
                const offset = (gy * grid.width + gx) * 4;
                picture.data[offset] = colour[0];
                picture.data[offset + 1] = colour[1];
                picture.data[offset + 2] = colour[2];
                picture.data[offset + 3] = 255;
            }
        }
        context.putImageData(picture, 0, 0);
        canvas.className = "img-heat";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", label);
        Object.assign(canvas.dataset, { width, height, block: grid.block, low: scaleLow, high: scaleLow + span, flipX: settings.flipX, flipY: settings.flipY });
        // The canvas is shown at a fixed size beside its axes: the column index along X and the row index along Y, as the flips place them;
        // the Y projection takes the room at its side.
        const room = Math.max(240, Math.min(GRID.width, Math.floor((plot.clientWidth || 1000) - AXES.left - AXES.right - PROJECTION.side)));
        const shownWidth = room;
        const shownHeight = Math.round((room * grid.height) / grid.width);
        canvas.style.width = `${shownWidth}px`;
        canvas.style.height = `${shownHeight}px`;
        canvas.style.left = `${AXES.left}px`;
        canvas.style.top = `${AXES.top}px`;
        const box = node("div", { class: "img-picture" });
        box.style.width = `${shownWidth + AXES.left + AXES.right}px`;
        box.style.height = `${shownHeight + AXES.top + AXES.bottom}px`;
        const axes = d3.create("svg").attr("class", "img-axes").attr("width", shownWidth + AXES.left + AXES.right).attr("height", shownHeight + AXES.top + AXES.bottom);
        const xs = d3.scaleLinear().domain(settings.flipX ? [width, 0] : [0, width]).range([AXES.left, AXES.left + shownWidth]);
        const ys = d3.scaleLinear().domain(settings.flipY ? [height, 0] : [0, height]).range([AXES.top, AXES.top + shownHeight]);
        axes.append("g").attr("class", "axis img-axis-x").attr("transform", `translate(0,${AXES.top + shownHeight})`).call(d3.axisBottom(xs).ticks(6, "~d"));
        axes.append("g").attr("class", "axis img-axis-y").attr("transform", `translate(${AXES.left},0)`).call(d3.axisLeft(ys).ticks(5, "~d"));
        axes.append("text").attr("class", "img-axis-label").attr("x", AXES.left + shownWidth / 2).attr("y", AXES.top + shownHeight + 34).attr("text-anchor", "middle").text("X / pixel (column)");
        axes.append("text").attr("class", "img-axis-label").attr("transform", `translate(14,${AXES.top + shownHeight / 2}) rotate(-90)`).attr("text-anchor", "middle").text("Y / pixel (row)");
        const levels = signed ? [-largest / 2, largest / 2] : LEVELS.map((f) => low + f * (high - low));
        const svg = d3.create("svg").attr("class", "img-overlay").attr("viewBox", `0 0 ${grid.width} ${grid.height}`).attr("preserveAspectRatio", "none")
            .style("left", `${AXES.left}px`).style("top", `${AXES.top}px`).style("width", `${shownWidth}px`).style("height", `${shownHeight}px`);
        const contours = d3.contours().size([grid.width, grid.height]).thresholds(levels)(grid.cells.map((v) => (Number.isNaN(v) ? scaleLow : v)));
        const mirror = `translate(${settings.flipX ? grid.width : 0},${settings.flipY ? grid.height : 0}) scale(${settings.flipX ? -1 : 1},${settings.flipY ? -1 : 1})`;
        svg.append("g").attr("transform", mirror).selectAll("path").data(contours).join("path").attr("class", (_, k) => `img-iso img-iso-${k}`).attr("data-level", (c) => c.value).attr("d", d3.geoPath());
        const rect = svg.append("rect").attr("class", "img-region-box").attr("fill", "none");
        box.append(axes.node(), canvas, svg.node());
        // The colour bar: the colour table from the lowest to the highest value of the scale, labelled by value.
        const bar = d3.create("svg").attr("class", "img-colourbar").attr("width", COLOUR_BAR.width).attr("height", COLOUR_BAR.height)
            .attr("role", "img").attr("aria-label", `Colour scale from ${number(scaleLow)} to ${number(scaleLow + span)}`)
            .attr("data-low", scaleLow).attr("data-high", scaleLow + span);
        const gradient = bar.append("defs").append("linearGradient").attr("id", "img-colourbar-gradient");
        for (let k = 0; k <= COLOUR_BAR.stops; k += 1) {
            const [r, g, b] = table[Math.round((k / COLOUR_BAR.stops) * (COLOUR_STEPS - 1))];
            gradient.append("stop").attr("offset", `${(k / COLOUR_BAR.stops) * 100}%`).attr("stop-color", `rgb(${r},${g},${b})`);
        }
        const barStart = (COLOUR_BAR.width - COLOUR_BAR.length) / 2;
        bar.append("rect").attr("x", barStart).attr("y", 2).attr("width", COLOUR_BAR.length).attr("height", 10).attr("fill", "url(#img-colourbar-gradient)");
        const barScale = d3.scaleLinear().domain([scaleLow, scaleLow + span]).range([barStart, barStart + COLOUR_BAR.length]);
        bar.append("g").attr("class", "axis").attr("transform", "translate(0,12)").call(d3.axisBottom(barScale).tickValues([scaleLow, scaleLow + span / 2, scaleLow + span]).tickFormat(number));
        const legend = node("ul", { class: "wave-legend img-legend" }, node("li", null, "Colour ", bar.node()),
            ...levels.map((value, k) => node("li", { "data-level": String(value) }, `Iso-line ${signed ? (k ? "+" : "-") + "half" : `${LEVELS[k] * 100} %`}: ${number(value)}`)));
        // The X projection under the picture and the Y projection at its side, on the pixel axes of the picture.
        const under = node("div", { class: "img-projection img-projection-x" });
        const side = node("div", { class: "img-projection img-projection-y" });
        plot.replaceChildren(node("div", { class: "img-layout" }, box, side, under), legend);
        const toStored = (event) => {
            const r = canvas.getBoundingClientRect();
            let fx = (event.clientX - r.left) / r.width;
            let fy = (event.clientY - r.top) / r.height;
            if (settings.flipX) fx = 1 - fx;
            if (settings.flipY) fy = 1 - fy;
            return { fx: fx * width, fy: fy * height };
        };
        const showRegion = (region) => {
            if (!region) { rect.attr("width", 0).attr("height", 0); return; }
            const gx0 = settings.flipX ? width - region.x1 : region.x0;
            const gy0 = settings.flipY ? height - region.y1 : region.y0;
            rect.attr("x", gx0 / grid.block).attr("y", gy0 / grid.block).attr("width", (region.x1 - region.x0) / grid.block).attr("height", (region.y1 - region.y0) / grid.block);
        };
        canvas.addEventListener("mousemove", (event) => {
            const { fx, fy } = toStored(event);
            const x = Math.max(0, Math.min(width - 1, Math.floor(fx)));
            const y = Math.max(0, Math.min(height - 1, Math.floor(fy)));
            const value = pixels[y * width + x];
            readout.textContent = reference ? `Pixel x ${x}, y ${y}: ${number(value + reference[y * width + x])} minus ${number(reference[y * width + x])} = ${number(value)}` : `Pixel x ${x}, y ${y}: ${number(value)}`;
            readout.dataset.x = x;
            readout.dataset.y = y;
        });
        canvas.addEventListener("mousedown", (event) => { drag = { from: toStored(event), toStored, width, height }; event.preventDefault(); });
        return { showRegion, grid, xs, ys, shownWidth, shownHeight, under, side };
    }

    /**
     * The X projection under the picture and the Y projection at its side, each drawn on the pixel scale of the picture (the centre of
     * pixel i at i + 0.5, mirrored as the flips mirror the picture), with the fitted Gaussian over it and a tooltip of the index and the sum.
     */
    function drawProjections(stats, sizeX, sizeY, unit, picture) {
        const sumLabel = `Sum${unit ? ` / ${unit}` : ""}`;
        for (const [axis, values, from, size, cell] of [["X", stats.projectionX, stats.x0, sizeX, picture.under], ["Y", stats.projectionY, stats.y0, sizeY, picture.side]]) {
            const along = axis === "X";
            const pixel = along ? picture.xs : picture.ys;
            const width = along ? picture.shownWidth + AXES.left + AXES.right : PROJECTION.side;
            const height = along ? PROJECTION.under : picture.shownHeight + AXES.top + AXES.bottom;
            const positions = Array.from({ length: values.length }, (_, k) => from + k);
            const { low, high } = rangeOf(values);
            const domain = [Math.min(0, low), high + (high - low) * 0.06 || 1];
            // The value scale runs down from the picture for X and to the right of it for Y.
            const value = along ? d3.scaleLinear().domain(domain).range([height - PROJECTION.valueAxis, PROJECTION.pad])
                : d3.scaleLinear().domain(domain).range([PROJECTION.pad, width - PROJECTION.pad - 24]);
            const svg = d3.create("svg").attr("class", "img-projection-plot").attr("width", width).attr("height", height)
                .attr("role", "img").attr("aria-label", `${axis} projection of the region`);
            if (along) {
                svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - PROJECTION.valueAxis})`).call(d3.axisBottom(pixel).ticks(6, "~d"));
                svg.append("g").attr("class", "axis").attr("transform", `translate(${AXES.left},0)`).call(d3.axisLeft(value).ticks(3).tickFormat(d3.format("~s")));
                svg.append("text").attr("class", "img-axis-label").attr("transform", `translate(14,${(height - PROJECTION.valueAxis) / 2}) rotate(-90)`).attr("text-anchor", "middle").text(sumLabel);
            } else {
                svg.append("g").attr("class", "axis").attr("transform", `translate(0,${AXES.top + picture.shownHeight})`).call(d3.axisBottom(value).ticks(3).tickFormat(d3.format("~s")));
                svg.append("text").attr("class", "img-axis-label").attr("x", width / 2).attr("y", AXES.top + picture.shownHeight + 34).attr("text-anchor", "middle").text(sumLabel);
            }
            const point = (p, v) => (along ? [pixel(p + 0.5), value(v)] : [value(v), pixel(p + 0.5)]);
            svg.append("path").attr("class", "wave-line img-projection-line").attr("d", d3.line()(positions.map((p, k) => point(p, values[k]))));
            if (size.ok) {
                const [a, mu, sigma, c] = size.params;
                svg.append("path").attr("class", "wave-line img-fit").attr("d", d3.line()(positions.map((p) => point(p, a * Math.exp(-((p - mu) ** 2) / (2 * sigma * sigma)) + c))));
            }
            cell.append(svg.node());
            const tip = createHoverTip(cell);
            svg.on("pointermove", (event) => {
                const [px, py] = d3.pointer(event, svg.node());
                const index = Math.floor(pixel.invert(along ? px : py));
                const k = index - from;
                if (k < 0 || k >= values.length) { tip.hide(); return; }
                tip.show(event, { title: `${axis} ${index}`, rows: [`Sum: ${number(values[k])}${unit ? ` ${unit}` : ""}`] });
            }).on("pointerleave", tip.hide);
        }
    }

    const rows = (label, list) => numbers.append(node("table", { class: "chart-stats wave-table img-table", "aria-label": label },
        node("tbody", null, ...list.map(([name, value]) => node("tr", { "data-row": name }, node("th", { scope: "row" }, name), node("td", null, value))))));

    function showValues(values, unit, frameText) {
        const { stats, sizeX, sizeY, level, region } = values;
        const u = unit ? ` ${unit}` : "";
        const size = (s, axis) => (s.ok ? [[`Sigma ${axis}`, `${number(s.sigma)} ± ${number(s.errors[2])} pixels`], [`FWHM ${axis}`, `${number(s.fwhm)} pixels`], [`Centre ${axis}`, `${number(s.params[1])} ± ${number(s.errors[1])} pixels`]]
            : [[`Sigma ${axis}`, `not defined: ${s.reason}`]]);
        rows("Values of the region", [
            ["Frame", frameText], ["Region", `x ${region.x0} to ${region.x1}, y ${region.y0} to ${region.y1} (${elementsText((region.x1 - region.x0) * (region.y1 - region.y0))} pixels)`],
            ["Background", level === null ? "none" : `${number(level)}${u} subtracted`],
            ["Total", `${number(stats.total)}${u}`], ["Mean", `${number(stats.mean)}${u}`], ["Minimum", `${number(stats.min)}${u}`],
            ["Peak", stats.peak ? `${number(stats.peak.value)}${u} at x ${stats.peak.x}, y ${stats.peak.y}` : "not defined"],
            ["Centroid X", stats.centroid ? `${number(stats.centroid.x)} pixels` : "not defined: the total is not positive"],
            ["Centroid Y", stats.centroid ? `${number(stats.centroid.y)} pixels` : "not defined: the total is not positive"],
            ...size(sizeX, "X"), ...size(sizeY, "Y"),
        ]);
    }

    function drawSeries(unit) {
        if (!series) {
            message.textContent = "Choose a region and press Read the values to read them for at most 100 frames of the range.";
            return;
        }
        const refusedText = series.refused ? `; ${series.refused} frames refused, the last because: ${series.reason.replace(/\.$/, "")}` : "";
        if (!series.points.length) {
            message.textContent = series.running ? `Reading the values: ${series.read} of ${series.planned} times read${refusedText}.` : `No frame gave values (${series.read} of ${series.planned} times read)${refusedText}.`;
            return;
        }
        const key = settings.seriesValue;
        const points = series.points.filter((p) => Number.isFinite(p[key]));
        const width = Math.max(320, Math.floor(plot.clientWidth || 720));
        const x = d3.scaleTime().domain(d3.extent(points, (p) => new Date(p.t))).range([MARGIN.left, width - MARGIN.right]);
        const { low, high } = rangeOf(points.map((p) => p[key]));
        const pad = (high - low) * 0.06 || 1;
        const y = d3.scaleLinear().domain([low - pad, high + pad]).range([PLOT_HEIGHT - MARGIN.bottom, MARGIN.top]);
        const label = SERIES_VALUES.find(([k]) => k === key)[1];
        const surface = createPlotCanvas({ width, height: PLOT_HEIGHT, margin: MARGIN, x, scales: new Map([["v", y]]), units: ["v"], axisWidth: MARGIN.left, onLeft: 1, unitLabels: true,
            axisLabels: new Map([["v", label]]), axisLabelAnchor: "start", xLabel: "Time", xTickY: PLOT_HEIGHT - 26, label: `${label} over the range`,
            xFormat: (date) => formatInZone(date, "%H:%M:%S", options.zone()), xTicks: x.ticks(5), grid: "y", tickCount: 4 });
        plot.replaceChildren(surface.svg.node());
        surface.marks.append("path").attr("class", "wave-line img-series").attr("d", d3.line().x((p) => x(new Date(p.t))).y((p) => y(p[key]))(points));
        surface.bindHover(plot, ({ x: at }) => {
            const p = points[Math.max(0, Math.min(points.length - 1, d3.bisector((q) => q.t).center(points, +at)))];
            return { title: timeText(p.t, options.zone()), rows: [`${label}: ${number(p[key])}${key === "total" || key === "peak" ? (unit ? ` ${unit}` : "") : " pixels"}`] };
        });
        readout.textContent = `${series.points.length} frames read${series.running ? `, reading: ${series.read} of ${series.planned}` : series.cancelled ? `; cancelled after ${series.read} of ${series.planned}` : `; ${series.read} of ${series.planned} times read`}`
            + `${series.skipped ? `; ${series.skipped} times met a frame already read` : ""}${refusedText}.`;
    }

    function syncControls() {
        for (const [source, list] of Object.entries(sizeFields)) for (const element of list) element.hidden = settings.sizeSource !== source;
        sizeSource.value = settings.sizeSource;
        view.value = settings.view;
        background.value = settings.background;
        seriesValue.value = settings.seriesValue;
        flipX.checked = settings.flipX === true;
        flipY.checked = settings.flipY === true;
        levelBox.parentElement.hidden = settings.background !== "level";
        for (const box of bgBoxes) box.parentElement.hidden = settings.background !== "region";
        referenceBox.parentElement.hidden = settings.view !== "difference";
        readReference.hidden = settings.view !== "difference";
        for (const element of [seriesValue.parentElement, readSeries, cancelSeries]) element.hidden = settings.view !== "series";
        for (const [control, key] of [[widthBox, "width"], [heightBox, "height"], [levelBox, "level"], ...regionBoxes.map((b, k) => [b, ["x0", "x1", "y0", "y1"][k]]), ...bgBoxes.map((b, k) => [b, ["bx0", "bx1", "by0", "by1"][k]])]) {
            if (document.activeElement !== control) control.value = settings[key];
        }
        const ready = current.status === "ready";
        frameBar.hidden = !ready;
        if (ready) {
            slider.max = String(current.stops.length - 1);
            slider.value = String(current.index);
            previous.disabled = current.index === 0 && current.typed === null;
            next.disabled = current.index === current.stops.length - 1 && current.typed === null;
        }
    }

    function render() {
        syncSignals(options.signals());
        syncControls();
        error.textContent = "";
        message.textContent = "";
        readout.textContent = "";
        frameNote.textContent = "";
        numbers.replaceChildren();
        plot.replaceChildren();
        const range = options.range();
        if (!settings.signal) {
            message.textContent = "Select an archived image PV to read its frames.";
            return;
        }
        const key = `${settings.signal}|${+range.from}|${+range.to}`;
        if (current.key !== key) {
            load(settings.signal, range);
            message.textContent = "Reading where the frames of the range lie...";
            return;
        }
        if (current.status === "loading") { message.textContent = "Reading where the frames of the range lie..."; return; }
        if (current.status === "failed") { message.textContent = current.reason; return; }
        const end = stopInView();
        const entry = frameOf(end);
        const where = current.typed !== null ? "read at the typed time" : current.mode === "bins" ? `stop ${current.index + 1} of ${current.stops.length}, the last frame of a bin of ${current.n} s` : `stop ${current.index + 1} of ${current.stops.length}, the frame at or before an evenly spaced time`;
        if (entry.state === "loading") { message.textContent = "Reading the frame..."; return; }
        if (entry.state === "failed") { message.textContent = entry.reason; return; }
        const frame = entry.frame;
        // A frame met twice at evenly spaced times is shown once: a move that meets the frame shown before moves on the same way.
        if (current.mode === "times" && current.typed === null && current.direction && current.lastShown === frame.t) {
            const target = current.index + current.direction;
            if (target >= 0 && target < current.stops.length) {
                current.index = target;
                settings.frame = String(current.stops[target] - 1);
                Promise.resolve().then(changed);
                message.textContent = "Reading the frame...";
                return;
            }
        }
        current.lastShown = frame.t;
        current.direction = 0;
        const size = sizeAt(frame);
        frameNote.textContent = `Frame of ${timeText(frame.t, options.zone())}, ${where}${current.mode === "times" ? "; the stops are times, not frames" : ""}; ${elementsText(frame.length)} elements${size.ok ? `, ${size.width} by ${size.height} (${size.source === "pv" ? "from the PVs at the time of the frame" : "typed"})` : ""}.`;
        if (!size.ok) { message.textContent = size.reason; return; }
        const unit = entry.unit || "";
        try {
            if (size.width * size.height > PIXELS_MOST) throw new RangeError(`An image of ${size.width} by ${size.height} pixels holds ${elementsText(size.width * size.height)} elements, more than the ${elementsText(PIXELS_MOST)} the tab reads.`);
            checkImage(frame.values, size.width, size.height);
            if (settings.view === "series") {
                regionOf(size.width, size.height);
                drawSeries(unit);
                return;
            }
            let pixels = frame.values;
            let reference = null;
            if (settings.view === "difference") {
                if (!current.reference) { message.textContent = "Type the time of the reference frame and read it; the difference is the frame in view minus that frame."; return; }
                const ref = current.reference;
                const refSize = ref.size;
                if (refSize.width !== size.width || refSize.height !== size.height || ref.frame.length !== frame.length) {
                    throw new RangeError(`The reference frame is ${refSize.width} by ${refSize.height} and the frame in view is ${size.width} by ${size.height}; a difference needs one size.`);
                }
                pixels = frameDifference(frame.values, ref.frame.values, size.width, size.height);
                reference = ref.frame.values;
            }
            const values = valuesOf(pixels, size.width, size.height);
            const picture = drawPicture(pixels, size.width, size.height, settings.view === "difference", `${settings.view === "difference" ? "Difference" : "Frame"} of ${current.name}, ${size.width} by ${size.height}`, reference);
            picture.showRegion(values.region);
            drawProjections(values.stats, values.sizeX, values.sizeY, unit, picture);
            showValues(values, unit, `${timeText(frame.t, options.zone())}${reference ? ` minus ${timeText(current.reference.frame.t, options.zone())}` : ""}`);
        } catch (problem) {
            if (!(problem instanceof RangeError)) throw problem;
            plot.replaceChildren();
            numbers.replaceChildren();
            message.textContent = problem.message;
        }
    }

    function moveTo(index, direction = 0) {
        current.direction = direction;
        current.typed = null;
        current.index = Math.max(0, Math.min(current.stops.length - 1, index));
        settings.frame = String(current.stops[current.index] - 1);
        changed();
    }

    slider.addEventListener("input", () => moveTo(Number(slider.value)));
    // Previous and Next move one stop; from a frame read at a typed time, to the stop after or before that time.
    const step = (direction) => {
        if (current.status !== "ready") return;
        if (current.typed !== null) {
            const t = current.typed;
            const at = direction > 0 ? current.stops.findIndex((s) => s > t) : current.stops.map((s) => s < t).lastIndexOf(true);
            return moveTo(at < 0 ? (direction > 0 ? current.stops.length - 1 : 0) : at);
        }
        moveTo(current.index + direction, direction);
    };
    previous.addEventListener("click", () => step(-1));
    next.addEventListener("click", () => step(1));
    for (const element of [previous, next]) element.addEventListener("keydown", (event) => {
        if (event.key === "Home") { event.preventDefault(); moveTo(0); }
        if (event.key === "End") { event.preventDefault(); moveTo(current.stops.length - 1); }
    });
    // Go to time: the frame at or before a typed time, read through a window ending just after it; it stays in view until another stop is shown.
    goTo.addEventListener("click", () => {
        error.textContent = "";
        if (current.status !== "ready") return;
        const date = options.parseTime ? options.parseTime(timeBox.value.trim(), new Date(stopInView())) : null;
        if (!date) { error.textContent = "Enter the time in the zone of the page as year-month-dayThour:minute:second, for example 2026-11-07T12:00:00."; return; }
        current.typed = +date + 1;
        settings.frame = String(+date);
        changed();
    });
    wholeFrame.addEventListener("click", () => { Object.assign(settings, { x0: "", x1: "", y0: "", y1: "" }); changed(); });
    readReference.addEventListener("click", async () => {
        error.textContent = "";
        if (current.status !== "ready") return;
        const date = options.parseTime ? options.parseTime(referenceBox.value.trim(), new Date(stopInView())) : null;
        if (!date) { error.textContent = "Enter the time of the reference in the zone of the page as year-month-dayThour:minute:second, for example 2026-11-07T12:00:00."; return; }
        const mine = current;
        try {
            const { found } = await frameEndingAt(mine.name, +date + 1, mine.controller.signal);
            if (current !== mine) return;
            if (!found || !found.values) { error.textContent = "The archive holds no frame at or before the time of the reference."; return; }
            // The size of the reference is that at its own time.
            const size = await sizeReady(found);
            if (current !== mine) return;
            if (!size.ok) { error.textContent = size.reason; return; }
            current.reference = { frame: found, size };
            settings.reference = String(found.t);
            changed();
        } catch (problem) {
            error.textContent = `The reference could not be read: ${problem.message || problem}`;
        }
    });
    // The values over the range: at most SERIES_MOST frames at evenly spaced times, read one at a time; Cancel keeps what was read.
    readSeries.addEventListener("click", async () => {
        if (current.status !== "ready" || (series && series.running)) return;
        const mine = current;
        const controller = new AbortController();
        const times = Array.from({ length: SERIES_MOST }, (_, k) => Math.round(+mine.range.from + ((mine.range.to - mine.range.from) * (k + 1)) / SERIES_MOST));
        series = { points: [], running: true, cancelled: false, read: 0, planned: times.length, skipped: 0, refused: 0, reason: "", controller };
        cancelSeries.disabled = false;
        readSeries.disabled = true;
        render();
        const seen = new Set();
        // Each time is counted once when its answer has been handled; a frame whose size or region does not hold is refused with its reason.
        for (const end of times) {
            if (controller.signal.aborted || current !== mine) break;
            try {
                const { found } = await frameEndingAt(mine.name, end, controller.signal);
                if (found && found.values && seen.has(found.t)) series.skipped += 1;
                else if (found && found.values) {
                    seen.add(found.t);
                    const size = await sizeReady(found);
                    if (!size.ok) throw new RangeError(size.reason);
                    checkImage(found.values, size.width, size.height);
                    const v = valuesOf(found.values, size.width, size.height);
                    series.points.push({ t: found.t, total: v.stats.total, centroidX: v.stats.centroid ? v.stats.centroid.x : NaN, centroidY: v.stats.centroid ? v.stats.centroid.y : NaN,
                        peak: v.stats.peak ? v.stats.peak.value : NaN, sigmaX: v.sizeX.ok ? v.sizeX.sigma : NaN, sigmaY: v.sizeY.ok ? v.sizeY.sigma : NaN });
                }
            } catch (problem) {
                if (problem.name === "AbortError") break;
                series.refused += 1;
                series.reason = String(problem.message || problem);
            }
            series.read += 1;
            if (current === mine) render();
        }
        series.running = false;
        series.cancelled = controller.signal.aborted;
        cancelSeries.disabled = true;
        readSeries.disabled = false;
        if (current === mine) render();
    });
    cancelSeries.addEventListener("click", () => { if (series && series.running) series.controller.abort(); });

    return { render, settings };
}
