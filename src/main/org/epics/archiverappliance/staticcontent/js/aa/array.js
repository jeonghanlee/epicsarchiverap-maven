// The analysis of one array (a waveform): the summary values of an array, the half-maximum width, the background by the clipping of
// ROOT, the peaks (found by the search of ROOT and measured here), the difference of two arrays and the grid of a heatmap of arrays
// over time. An array is indexed from zero; every function takes the elements as a plain or typed array of finite numbers and refuses
// anything else with a RangeError that names the reason, so that no value is made of an element that is not a number.

import { searchPeaks } from "./search.js";

/** Throws a RangeError unless the values are a non-empty array-like of finite numbers. */
export function checkValues(values) {
    if (!values || typeof values.length !== "number" || values.length === 0) {
        throw new RangeError("The array has no elements.");
    }
    for (let i = 0; i < values.length; i += 1) {
        if (!Number.isFinite(values[i])) {
            throw new RangeError(`Element ${i} of the array is not a finite number.`);
        }
    }
}

/**
 * The half-maximum width: the level is half way from the minimum to the maximum; from the first position of the maximum the search
 * goes to each side as far as the first element strictly below the level, and the crossing is the linear interpolation between that
 * element and its neighbour towards the maximum. Null when the array is flat or when either side never falls below the level (the
 * peak is cut by the end of the array). The positions are in elements.
 */
export function halfMaximumWidth(values) {
    checkValues(values);
    const n = values.length;
    let top = 0;
    let high = -Infinity;
    let low = Infinity;
    for (let i = 0; i < n; i += 1) {
        if (values[i] > high) {
            high = values[i];
            top = i;
        }
        if (values[i] < low) low = values[i];
    }
    if (high === low) return null;
    return crossingWidth(values, top, low + (high - low) / 2);
}

/**
 * The summary values of an array: the number of elements, the maximum and minimum with the first position of each, the mean, the root
 * mean square, the sum, the centre (the intensity-weighted centroid in elements, null unless the sum is positive) and the
 * half-maximum width (null when it is not defined).
 */
export function summary(values) {
    checkValues(values);
    const n = values.length;
    let sum = 0;
    let squares = 0;
    let weighted = 0;
    let max = -Infinity;
    let maxAt = 0;
    let min = Infinity;
    let minAt = 0;
    for (let i = 0; i < n; i += 1) {
        const v = values[i];
        sum += v;
        squares += v * v;
        weighted += i * v;
        if (v > max) {
            max = v;
            maxAt = i;
        }
        if (v < min) {
            min = v;
            minAt = i;
        }
    }
    return { n, max, maxAt, min, minAt, mean: sum / n, rms: Math.sqrt(squares / n), sum, centre: sum > 0 ? weighted / sum : null, fwhm: halfMaximumWidth(values) };
}

/** The number of iterations of the clipping that ROOT uses when none is given. */
export const DEFAULT_ITERATIONS = 20;
/** The direction of the clipping that ROOT uses when none is given: the width starts at the iterations and falls to 1. */
export const DEFAULT_DIRECTION = "decreasing";
export const DIRECTIONS = ["decreasing", "increasing"];

/** Throws a RangeError unless the number of iterations is a whole number of at least 1 and the direction is a known one. */
export function checkClipping(iterations, direction) {
    if (!Number.isInteger(iterations) || iterations < 1) {
        throw new RangeError("The number of iterations of the background is a whole number, 1 or more.");
    }
    if (!DIRECTIONS.includes(direction)) {
        throw new RangeError(`The direction of the background is one of ${DIRECTIONS.join(" and ")}.`);
    }
}

/**
 * The background of an array by the clipping that TSpectrum::Background of ROOT computes (the method of Morhac, known as SNIP,
 * with order 2 and no smoothing): at each width p every element becomes the lesser of itself and the mean of the elements p before
 * and p after it, the elements of the width from the ends being left as they are; p rises from 1 to the iterations ("increasing") or
 * falls from the iterations to 1 ("decreasing"). A peak narrower than about twice the iterations is clipped away, a slow trend stays.
 * As ROOT does, an array shorter than twice the iterations plus 1 is refused (ROOT answers "Too Large Clipping Window").
 */
export function clipBackground(values, iterations = DEFAULT_ITERATIONS, direction = DEFAULT_DIRECTION) {
    checkValues(values);
    checkClipping(iterations, direction);
    const n = values.length;
    if (n < 2 * iterations + 1) {
        throw new RangeError(`The array has ${n} elements and a clipping of ${iterations} iterations needs at least ${2 * iterations + 1}; give fewer iterations.`);
    }
    let current = Float64Array.from(values);
    let next = new Float64Array(n);
    for (let step = 0; step < iterations; step += 1) {
        const p = direction === "increasing" ? step + 1 : iterations - step;
        next.set(current);
        for (let i = p; i < n - p; i += 1) {
            const mean = (current[i - p] + current[i + p]) / 2;
            if (mean < current[i]) next[i] = mean;
        }
        [current, next] = [next, current];
    }
    return current;
}

/**
 * The width of a peak at half of its height: from the element of the peak to each side as far as the first element strictly below
 * the level, the crossing being the linear interpolation between that element and its neighbour towards the peak. Null when either
 * side never falls below the level (the peak is cut by the end of the array). The positions are in elements.
 */
function crossingWidth(values, top, level) {
    const n = values.length;
    let i = top;
    while (i > 0 && values[i] >= level) i -= 1;
    if (values[i] >= level) return null;
    const left = i + (level - values[i]) / (values[i + 1] - values[i]);
    let j = top;
    while (j < n - 1 && values[j] >= level) j += 1;
    if (values[j] >= level) return null;
    const right = j - 1 + (values[j - 1] - level) / (values[j - 1] - values[j]);
    return { left, right, width: right - left, level };
}

/**
 * The peaks of an array: the positions are those of the search of ROOT (searchPeaks, with the options sigma, threshold, background,
 * markov, deconvolutionIterations, averageWindow and maxPeaks of search.js), the highest first. ROOT gives no width, so the width of a
 * peak is measured here: the width at half of its height above the background, which is the clipping of clipBackground over
 * options.widthIterations (20 by default, none when it is null) in options.widthDirection ("decreasing" by default). A peak whose
 * height above the background is not positive, or that is cut by the end of the array at half its height, has a null width.
 * Returns the positions, the peaks (position, nearest element, the array value there, the height above the background, the width and
 * the positions of its two crossings), the background (null without one), the array minus the background and the deconvolved spectrum.
 */
export function peaks(values, options = {}) {
    checkValues(values);
    const { widthIterations = DEFAULT_ITERATIONS, widthDirection = DEFAULT_DIRECTION, ...searchOptions } = options;
    const found = searchPeaks(values, searchOptions);
    const background = widthIterations === null ? null : clipBackground(values, widthIterations, widthDirection);
    const above = new Float64Array(values.length);
    for (let i = 0; i < values.length; i += 1) above[i] = values[i] - (background ? background[i] : 0);
    const listed = found.peaks.map((p) => {
        const height = above[p.index];
        const width = height > 0 ? crossingWidth(above, p.index, height / 2) : null;
        return { ...p, height, width: width ? width.width : null, left: width ? width.left : null, right: width ? width.right : null };
    });
    return { positions: found.positions, peaks: listed, background, above, deconvolved: found.deconvolved };
}

/** The element-by-element difference of an array and a reference array of the same length. */
export function difference(values, reference) {
    checkValues(values);
    checkValues(reference);
    if (values.length !== reference.length) {
        throw new RangeError(`The array has ${values.length} elements and the reference has ${reference.length}; the difference needs equal lengths.`);
    }
    const out = new Float64Array(values.length);
    for (let i = 0; i < values.length; i += 1) out[i] = values[i] - reference[i];
    return out;
}

/**
 * The grid of a heatmap of arrays over time: one row for each frame, one column for each element, the cells in row-major order,
 * with the one extent of all the frames for the colour scale. The frames must have one length.
 */
export function heatmapGrid(frames) {
    if (!frames || frames.length === 0) throw new RangeError("There is no frame to draw.");
    checkValues(frames[0]);
    const columns = frames[0].length;
    const cells = new Float64Array(frames.length * columns);
    let min = Infinity;
    let max = -Infinity;
    frames.forEach((frame, row) => {
        checkValues(frame);
        if (frame.length !== columns) {
            throw new RangeError(`Frame ${row} has ${frame.length} elements and the first has ${columns}; a heatmap needs one length.`);
        }
        for (let k = 0; k < columns; k += 1) {
            const v = frame[k];
            cells[row * columns + k] = v;
            if (v < min) min = v;
            if (v > max) max = v;
        }
    });
    return { rows: frames.length, columns, cells, min, max };
}
