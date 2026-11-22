// The array routines (aa/array.js) against the values that NumPy, SciPy and ROOT compute from the fixed arrays of the reference file:
// the summary values, the half-maximum width, the background (ROOT), the peaks (the search of ROOT and the width at half the height
// above the background), the difference and the grid of a heatmap, and the refusals of input that is not an array of finite numbers.
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";
import { reference, close, closeArray } from "./reference.mjs";

const array = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/array.js");
const cases = reference.arrayCases;

test("the summary values equal NumPy for the stored arrays, and the centre and the width are null where they are not defined", () => {
    for (const name of ["wave", "gaussian", "ramp", "negative", "flat"]) {
        const expected = cases[name].summary;
        const actual = array.summary(cases[name].values);
        for (const key of ["max", "min", "mean", "rms", "sum"]) close(actual[key], expected[key], 1e-9, 1e-12, `${name} ${key}`);
        assert.equal(actual.maxAt, expected.maxAt, `${name} position of the maximum`);
        assert.equal(actual.minAt, expected.minAt, `${name} position of the minimum`);
        if (expected.centre === null) assert.equal(actual.centre, null, `${name} centre`);
        else close(actual.centre, expected.centre, 1e-9, 1e-12, `${name} centre`);
        if (expected.fwhm === null) assert.equal(actual.fwhm, null, `${name} width`);
        else for (const key of ["left", "right", "width", "level"]) close(actual.fwhm[key], expected.fwhm[key], 1e-9, 1e-12, `${name} width ${key}`);
    }
});

test("the half-maximum width of a Gaussian array is within 1 percent of 2.355 sigma", () => {
    const g = cases.gaussian;
    const width = array.halfMaximumWidth(g.values).width;
    assert.ok(Math.abs(width - g.fwhmOfModel) < 0.01 * g.fwhmOfModel, `${width} against ${g.fwhmOfModel}`);
});

test("the width is measured from the first position of the maximum and uses the first element strictly below the level", () => {
    // Levels: min 0, max 4, half 2; the crossing on the left is between 0 and 4 at 0.5 of the step, on the right between 4 and 0.
    const w = array.halfMaximumWidth([0, 4, 4, 0]);
    assert.deepEqual([w.left, w.right, w.width, w.level], [0.5, 2.5, 2, 2]);
    assert.equal(array.halfMaximumWidth([0, 2, 4, 2, 0]).width, 2, "an element equal to the level is not below it");
    assert.equal(array.halfMaximumWidth([4, 2, 0]), null, "the left side never falls below the level");
    assert.equal(array.halfMaximumWidth([0, 2, 4]), null, "the right side never falls below the level");
});

test("the background equals the output of TSpectrum::Background of ROOT for every stored case, in both directions and for signed and positive arrays", () => {
    assert.ok(cases.rootBackground.length >= 16);
    for (const c of cases.rootBackground) {
        if (c.error) {
            assert.throws(() => array.clipBackground(c.values, c.iterations, c.direction), RangeError, `${c.name}: ROOT answers "${c.error}"`);
            assert.ok(c.values.length < 2 * c.iterations + 1, `${c.name}: ROOT refuses only an array shorter than twice the iterations plus 1`);
            continue;
        }
        assert.ok(c.values.length >= 2 * c.iterations + 1, `${c.name}: ROOT computes it`);
        const actual = array.clipBackground(c.values, c.iterations, c.direction);
        closeArray(actual, c.background, 1e-12, `${c.name} (${c.iterations} iterations, ${c.direction})`);
    }
    assert.ok(cases.rootBackground.filter((c) => c.error).length >= 4, "the refusals of ROOT are stored");
    const directions = new Set(cases.rootBackground.map((c) => c.direction));
    assert.deepEqual([...directions].sort(), ["decreasing", "increasing"]);
    assert.ok(cases.rootBackground.some((c) => c.values.some((v) => v < 0)), "an array with negative values");
});

test("the clipping lowers each element to the mean of its two neighbours at the width, leaves the ends of each width, and depends on the direction", () => {
    assert.deepEqual(Array.from(array.clipBackground([0, 10, 0], 1)), [0, 0, 0]);
    assert.deepEqual(Array.from(array.clipBackground([5, 10, 5], 1)), [5, 5, 5]);
    assert.deepEqual(Array.from(array.clipBackground([10, 0, 10], 1)), [10, 0, 10], "an element below its neighbours stays");
    assert.deepEqual(Array.from(array.clipBackground([1, 2, 3, 4, 5], 2)), [1, 2, 3, 4, 5], "a straight line is its own background");
    const rising = cases.rootBackground.find((c) => c.name === "wave-20-increasing");
    const falling = cases.rootBackground.find((c) => c.name === "wave-20-decreasing");
    assert.ok(rising.background.some((v, i) => v !== falling.background[i]), "ROOT's two directions differ on the wave");
    assert.equal(array.DEFAULT_ITERATIONS, 20);
    assert.equal(array.DEFAULT_DIRECTION, "decreasing");
    assert.deepEqual(Array.from(array.clipBackground(falling.values)), falling.background, "the defaults are ROOT's: 20 iterations, the falling width");
    assert.throws(() => array.clipBackground([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5), RangeError, "ten elements are too few for 5 iterations");
    assert.doesNotThrow(() => array.clipBackground([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 5), "eleven elements are enough");
});

test("the peaks are those of ROOT's search and their widths equal a second method, for six stored cases", () => {
    assert.ok(cases.peakWidths.length >= 6);
    for (const c of cases.peakWidths) {
        const search = cases.rootSearch.find((x) => x.name === c.searchName);
        const found = array.peaks(c.values, {
            sigma: search.sigma, threshold: search.threshold, background: search.background, markov: search.markov,
            deconvolutionIterations: search.deconvolutionIterations, averageWindow: search.averageWindow, maxPeaks: search.maxPeaks,
            widthIterations: c.widthIterations, widthDirection: c.widthDirection,
        });
        assert.equal(found.peaks.length, c.peaks.length, `${c.name}: number of peaks`);
        found.peaks.forEach((p, k) => {
            const e = c.peaks[k];
            close(p.position, e.position, 1e-9, 1e-9, `${c.name} position`);
            assert.equal(p.index, e.index, `${c.name} nearest element`);
            assert.equal(p.value, e.value, `${c.name} value`);
            close(p.height, e.height, 1e-9, 1e-12, `${c.name} height`);
            if (e.width === null) {
                assert.equal(p.width, null, `${c.name} peak ${e.index} has no width`);
            } else {
                for (const key of ["width", "left", "right"]) close(p[key], e[key], 1e-9, 1e-12, `${c.name} peak ${e.index} ${key}`);
            }
        });
    }
    assert.ok(cases.peakWidths.some((c) => c.peaks.some((p) => p.width === null)), "a stored peak that is cut by the end of the array has no width");
});

test("the width background defaults to ROOT's 20 iterations with the falling width, and a search without a width background has none", () => {
    const c = cases.peakWidths.find((x) => x.name === "wave-widths");
    const search = cases.rootSearch.find((x) => x.name === c.searchName);
    const options = { sigma: search.sigma, threshold: search.threshold, background: search.background, markov: search.markov, deconvolutionIterations: search.deconvolutionIterations, averageWindow: search.averageWindow, maxPeaks: search.maxPeaks };
    const defaulted = array.peaks(c.values, options);
    const explicit = array.peaks(c.values, { ...options, widthIterations: 20, widthDirection: "decreasing" });
    assert.deepEqual(defaulted.peaks.map((p) => p.width), explicit.peaks.map((p) => p.width));
    assert.deepEqual(Array.from(defaulted.background), Array.from(explicit.background));
});

test("a peak whose height above the background is not positive has no width, and no background gives the width on the array itself", () => {
    const values = Float64Array.from({ length: 80 }, (_, i) => 10 + 8 * Math.exp(-0.5 * ((i - 40) / 4) ** 2));
    const found = array.peaks(values, { sigma: 4, background: false, widthIterations: null });
    assert.ok(found.peaks.length >= 1);
    assert.equal(found.background, null);
    const top = found.peaks[0];
    assert.ok(Math.abs(top.index - 40) <= 1);
    const level = (values[top.index] + 0) / 2;
    assert.ok(top.width === null || top.width > 0);
    assert.equal(top.height, values[top.index], "no background: the height is the value");
    assert.ok(level > 0);
    const flat = array.peaks(new Float64Array(60).fill(5), { sigma: 2, widthIterations: 5 });
    assert.deepEqual(flat.peaks, [], "a flat array has no peak");
});

test("a sum of exactly zero has no centre", () => {
    assert.equal(array.summary([1, -1]).centre, null);
    assert.equal(array.summary([0, 0, 0]).centre, null);
});

test("the difference is the array minus its reference and the heatmap grid keeps one extent over all the frames", () => {
    closeArray(array.difference(cases.wave.values, cases.wave.reference), cases.wave.difference, 1e-12, "difference");
    const grid = array.heatmapGrid(cases.heatmap.frames);
    assert.equal(grid.rows, 5);
    assert.equal(grid.columns, 32);
    assert.equal(grid.min, cases.heatmap.min);
    assert.equal(grid.max, cases.heatmap.max);
    closeArray(grid.cells, cases.heatmap.frames.flat(), 1e-12, "cells in row-major order");
});

test("an empty array, an element that is not a number, an iteration count that is not a whole number or a direction that is unknown, a mismatched pair and unequal frames are refused with a reason", () => {
    assert.throws(() => array.summary([]), /no elements/);
    assert.throws(() => array.summary([1, NaN, 3]), /Element 1 .* not a finite number/);
    assert.throws(() => array.summary([1, Infinity]), /Element 1/);
    assert.throws(() => array.clipBackground([1, 2, 3], 0), /whole number/);
    assert.throws(() => array.clipBackground([1, 2, 3], 2.5), /whole number/);
    assert.throws(() => array.clipBackground([1, 2, 3], 3, "up"), /direction/);
    assert.throws(() => array.peaks([1, 2, 1]), /needs at least 29/, "three elements are too few for the background of the default sigma");
    assert.throws(() => array.peaks([1, 2, 1, 2, 1, 2], { sigma: 1, background: false, widthIterations: 5 }), /needs at least 11/, "the width background has its own length rule");
    assert.throws(() => array.difference([1, 2, 3], [1, 2]), /3 elements .* 2/);
    assert.throws(() => array.heatmapGrid([[1, 2], [1, 2, 3]]), /Frame 1 has 3 elements/);
    assert.throws(() => array.heatmapGrid([]), /no frame/);
    assert.throws(() => array.heatmapGrid([null]), RangeError, "a frame that is missing is refused, not a TypeError");
    assert.throws(() => array.heatmapGrid([[]]), /no elements/);
});
