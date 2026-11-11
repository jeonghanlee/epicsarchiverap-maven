// The reading of arrays for the analyzer: what a request for the frames of an array PV may ask, the reading of the response within a
// byte limit, the frames as typed arrays, the thinning of the frames to the most the page draws, the frame at or before a time, the
// element axis, and the series of a summary value over the frames. The server refuses by declared size only the binned operators, so a
// raw or thinned range of arrays is bounded here to protect the browser: in elements from the type information before the request, in
// bytes while the response arrives, and in elements again over the frames read.
import { checkValues, summary } from "./array.js";

/** The most frames the page keeps for the overlay, the heatmap over time and the series of summary values. */
export const FRAMES_MOST = 200;
/**
 * The most elements of one request of frames: one camera frame of 1920 by 1200, the largest single read of the analyzer. Time and memory
 * of the browser follow the element count; measured in Chromium, about 1 s from request to drawing and 250 MB more memory at this size.
 */
export const ELEMENTS_MOST = 2304000;
/** The bytes an element takes in the JSON of the retrieval at most: 19.5 for a double, the least favourable of the types measured. */
export const BYTES_PER_ELEMENT = 20;
/** The most bytes of one response that the page reads: the most elements at the bytes of a double, beyond which the bound cannot hold. */
export const REQUEST_BYTES_MOST = ELEMENTS_MOST * BYTES_PER_ELEMENT;
/** A count of elements as the page writes it, with thousands separated by commas. */
export const elementsText = (count) => Number(count).toLocaleString("en-US");
/** The most frames one overlay draws. */
export const OVERLAY_MOST = 20;

/** The step of the server operator nth: the frames the range is expected to hold (the event rate of the type information times the seconds) over the most frames. */
export function thinningStep(eventRate, seconds, framesMost = FRAMES_MOST) {
    const rate = Number(eventRate);
    if (!(rate > 0) || !(seconds > 0)) return 1;
    return Math.max(1, Math.ceil((rate * seconds) / framesMost));
}

/**
 * The plan of the request of the frames of one PV over a range: the step of the thinning and the frames expected, from the element
 * count and the event rate of the type information. Not ok when one frame alone holds more than the most elements of a request, or when
 * the element count is not a whole number of at least 1; with more frames expected than fit, the step grows until they fit. byElements
 * says that the most elements, not the most frames, set how many frames fit.
 */
export function requestPlan({ elementCount, eventRate, seconds }, limits = {}) {
    const framesMost = limits.framesMost ?? FRAMES_MOST;
    const elementsMost = limits.elementsMost ?? ELEMENTS_MOST;
    if (!Number.isInteger(elementCount) || elementCount < 1) {
        return { ok: false, reason: "The element count of the PV is not known, so the size of a frame cannot be estimated." };
    }
    if (elementCount > elementsMost) {
        return { ok: false, reason: `One frame of this array holds ${elementsText(elementCount)} elements, more than the ${elementsText(elementsMost)} the page reads in one request to keep the browser responsive; the array cannot be read as frames.` };
    }
    const fits = Math.max(1, Math.min(framesMost, Math.floor(elementsMost / elementCount)));
    const expected = Number(eventRate) > 0 && seconds > 0 ? Math.max(1, Math.ceil(Number(eventRate) * seconds)) : null;
    const step = thinningStep(eventRate, seconds, fits);
    return { ok: true, step, expected, framesAllowed: fits, byElements: fits < framesMost, estimatedElements: expected === null ? null : Math.ceil(expected / step) * elementCount };
}

/**
 * The text of a response read in chunks, stopped as soon as it exceeds the limit. Returns {text} or {exceeded: true, bytes} with the
 * bytes read so far; the unread rest of the response is cancelled.
 */
export async function readBounded(response, limit = REQUEST_BYTES_MOST) {
    if (!response.body) {
        const text = await response.text();
        return text.length > limit ? { exceeded: true, bytes: text.length } : { text };
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parts = [];
    let bytes = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > limit) {
            await reader.cancel();
            return { exceeded: true, bytes };
        }
        parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return { text: parts.join("") };
}

/** The distinct element counts of the array frames (a scalar record has none), in order of first appearance, each with the index of the first frame that has it. */
export function lengthsOf(frames) {
    const lengths = [];
    frames.forEach((frame, index) => {
        if (!frame.scalar && !lengths.some((entry) => entry.length === frame.length)) lengths.push({ length: frame.length, first: index });
    });
    return lengths;
}

/** The frames whose time lies in [from, to] (milliseconds), and the last frame before the range, which the retrieval adds as the sample in force at its start. */
export function framesInside(frames, from, to) {
    const inside = frames.filter((frame) => frame.t >= from && frame.t <= to);
    const before = frames.filter((frame) => frame.t < from);
    return { inside, before: before.length ? before[before.length - 1] : null };
}

/**
 * The frames of a retrieval response (the parsed JSON of getData.json): for each record the source seconds and nanoseconds, the time in
 * milliseconds, the elements as a Float64Array (null when the record is not an array of finite numbers, with the reason in problem), the
 * severity and the status. form says what the response holds: no samples, array samples, scalar samples or a mixture; lengths lists the
 * distinct element counts with the index of the first frame that has each.
 */
export function parseFrames(body) {
    const first = Array.isArray(body) ? body[0] : null;
    const records = first && Array.isArray(first.data) ? first.data : [];
    const frames = [];
    let arrays = 0;
    let scalars = 0;
    for (const sample of records) {
        const secs = Number(sample.secs);
        const nanos = Number(sample.nanos || 0);
        const frame = { secs, nanos, t: secs * 1000 + Math.floor(nanos / 1e6), values: null, length: 0, scalar: false, severity: Number(sample.severity) || 0, status: Number(sample.status) || 0, problem: null };
        if (Array.isArray(sample.val)) {
            arrays += 1;
            frame.length = sample.val.length;
            const values = Float64Array.from(sample.val, Number);
            const bad = values.findIndex((v) => !Number.isFinite(v));
            if (sample.val.length === 0) frame.problem = "The record holds no elements.";
            else if (bad >= 0) frame.problem = `Element ${bad} of the record is not a finite number.`;
            else frame.values = values;
        } else {
            scalars += 1;
            frame.scalar = true;
            frame.problem = "The record is a scalar, not an array.";
        }
        frames.push(frame);
    }
    const form = !records.length ? "No samples" : arrays && scalars ? "Mixed samples" : arrays ? "Array samples" : "Scalar samples";
    return { meta: first ? first.meta || {} : {}, frames, form, lengths: lengthsOf(frames) };
}

/**
 * The frames thinned again on the page to at most `most` frames holding at most `elementsMost` elements in all: every Mth from the
 * first, M the least whole number that fits both. Reports the step, the frames and elements before thinning, and byElements when the
 * most elements, not the most frames, set the step.
 */
export function thinOnPage(frames, most = FRAMES_MOST, elementsMost = ELEMENTS_MOST) {
    const elements = frames.reduce((sum, frame) => sum + (frame.length || 0), 0);
    const keep = (step) => frames.filter((_, index) => index % step === 0);
    const sumOf = (list) => list.reduce((sum, frame) => sum + (frame.length || 0), 0);
    const byFrames = Math.ceil(frames.length / most);
    let step = Math.max(1, byFrames, Math.ceil(elements / elementsMost));
    while (step < frames.length && sumOf(keep(step)) > elementsMost) step += 1;
    if (step === 1) return { frames, step, total: frames.length, elements, byElements: false };
    return { frames: keep(step), step, total: frames.length, elements, byElements: step > byFrames };
}

/** The index of the last frame at or before the time t (milliseconds), or -1 when every frame is later. */
export function frameAtOrBefore(frames, t) {
    let low = 0;
    let high = frames.length - 1;
    let found = -1;
    while (low <= high) {
        const middle = (low + high) >> 1;
        if (frames[middle].t <= t) {
            found = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    return found;
}

export const AXIS_MODES = ["index", "typed", "companion"];

/**
 * The positions of the elements along X for an axis setting: the element number (0 to length - 1), a typed start and step, or the
 * values of a companion axis array that must have the length of the frame, be finite and not decrease. Returns {ok: true, x} or
 * {ok: false, reason} that says what to correct.
 */
export function axisValues(spec, length, companion = null) {
    if (spec.mode === "index") return { ok: true, x: Float64Array.from({ length }, (_, i) => i) };
    if (spec.mode === "typed") {
        const start = Number(spec.start);
        const step = Number(spec.step);
        if (String(spec.start).trim() === "" || !Number.isFinite(start)) return { ok: false, reason: "The start of the axis is not a number; type one or choose the element number." };
        if (String(spec.step).trim() === "" || !Number.isFinite(step) || step === 0) return { ok: false, reason: "The step of the axis is not a nonzero number; type one or choose the element number." };
        return { ok: true, x: Float64Array.from({ length }, (_, i) => start + step * i) };
    }
    if (spec.mode === "companion") {
        if (!companion) return { ok: false, reason: "No axis array has been read yet; choose a PV for the axis or the element number." };
        if (companion.length !== length) return { ok: false, reason: `The axis array has ${companion.length} elements and the frame has ${length}; an axis needs one value for each element.` };
        for (let i = 0; i < companion.length; i += 1) {
            if (!Number.isFinite(companion[i])) return { ok: false, reason: `Element ${i} of the axis array is not a finite number.` };
            if (i > 0 && companion[i] < companion[i - 1]) return { ok: false, reason: `The axis array decreases at element ${i}; an axis must not decrease.` };
        }
        return { ok: true, x: companion };
    }
    return { ok: false, reason: `The axis mode ${spec.mode} is not known.` };
}

/** The summary values the series offers, by key: the label and how to take it from the summary of a frame. */
export const SUMMARY_VALUES = [
    ["max", "Maximum", (s) => s.max], ["maxAt", "Position of the maximum", (s) => s.maxAt], ["min", "Minimum", (s) => s.min],
    ["mean", "Mean", (s) => s.mean], ["rms", "RMS", (s) => s.rms], ["sum", "Sum", (s) => s.sum],
    ["centre", "Centre", (s) => s.centre], ["width", "Half-maximum width", (s) => (s.fwhm ? s.fwhm.width : null)],
];

/** The summary of every readable frame, with its time: {t, summary} for each frame whose elements are numbers. */
export function frameSummaries(frames) {
    const out = [];
    for (const frame of frames) {
        if (!frame.values) continue;
        out.push({ t: frame.t, summary: summary(frame.values) });
    }
    return out;
}

/** One summary value over the frames as points {t, v}; a frame for which it is not defined (a centre of a non-positive sum, a width cut by the end) is left out and counted. */
export function summarySeries(summaries, key) {
    const take = SUMMARY_VALUES.find(([name]) => name === key);
    if (!take) throw new RangeError(`The summary value ${key} is not known.`);
    const points = [];
    let undefinedCount = 0;
    for (const { t, summary: s } of summaries) {
        const v = take[2](s);
        if (v === null || !Number.isFinite(v)) undefinedCount += 1;
        else points.push({ t, v });
    }
    return { points, undefinedCount };
}

/**
 * The elements a line drawing uses: all of them when they are no more than twice the columns of the plot, else for each of `columns`
 * blocks of neighbouring elements the one with the lowest and the one with the highest value, in element order, so that a narrow
 * peak is never lost and the path stays small.
 */
export function drawingIndices(values, columns) {
    const n = values.length;
    if (n <= 2 * columns) return Array.from({ length: n }, (_, i) => i);
    const indices = [];
    for (let block = 0; block < columns; block += 1) {
        const first = Math.floor((block * n) / columns);
        const last = Math.floor(((block + 1) * n) / columns);
        let low = first;
        let high = first;
        for (let i = first + 1; i < last; i += 1) {
            if (values[i] < values[low]) low = i;
            if (values[i] > values[high]) high = i;
        }
        if (low === high) indices.push(low);
        else indices.push(Math.min(low, high), Math.max(low, high));
    }
    return indices;
}

/** Throws a RangeError unless the frames of an overlay or a heatmap all have the length of the first and hold numbers. */
export function checkFrames(frames) {
    if (!frames.length) throw new RangeError("There is no frame to draw.");
    const length = frames[0].length;
    for (let i = 0; i < frames.length; i += 1) {
        if (!frames[i].values) throw new RangeError(`Frame ${i} cannot be read: ${frames[i].problem}`);
        if (frames[i].length !== length) throw new RangeError(`Frame ${i} has ${frames[i].length} elements and the first has ${length}; the frames of one drawing need one length.`);
        checkValues(frames[i].values);
    }
}

/** The frames an overlay draws: the current one and up to `count - 1` others spaced evenly over the frames, in time order. */
export function overlayFrames(frames, currentIndex, count) {
    const n = Math.min(Math.max(1, count), OVERLAY_MOST, frames.length);
    if (n === 1) return [currentIndex];
    const chosen = new Set([currentIndex]);
    for (let k = 0; k < n; k += 1) chosen.add(Math.round((k * (frames.length - 1)) / (n - 1)));
    const list = [...chosen].sort((a, b) => a - b);
    while (list.length > n) {
        // Too many by one: drop the evenly spaced frame nearest to the current one that is not the current one.
        const drop = list.filter((index) => index !== currentIndex).sort((a, b) => Math.abs(a - currentIndex) - Math.abs(b - currentIndex))[0];
        list.splice(list.indexOf(drop), 1);
    }
    return list;
}
