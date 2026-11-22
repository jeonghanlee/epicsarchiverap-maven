// The peak search (aa/search.js, a translation of SearchHighRes of ROOT) against the peaks and the deconvolved spectrum that ROOT writes
// for the stored cases of the reference file: arrays with and without negative values, with and without the background and the Markov
// smoothing, several sigmas, thresholds and numbers of peaks; and the arguments that ROOT refuses.
import test from "node:test";
import assert from "node:assert/strict";
import { reference, close, closeArray } from "./reference.mjs";

const search = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/search.js");
const cases = reference.arrayCases.rootSearch;
const optionsOf = (c) => ({ sigma: c.sigma, threshold: c.threshold, background: c.background, markov: c.markov, deconvolutionIterations: c.deconvolutionIterations, averageWindow: c.averageWindow, maxPeaks: c.maxPeaks });

test("the positions equal those of ROOT, highest first, for every stored search", () => {
    const computed = cases.filter((c) => !c.refused);
    assert.ok(computed.length >= 24);
    for (const c of computed) {
        const found = search.searchPeaks(c.values, optionsOf(c));
        assert.equal(found.positions.length, c.positions.length, `${c.name}: number of peaks`);
        found.positions.forEach((x, i) => close(x, c.positions[i], 1e-9, 1e-9, `${c.name} position ${i}`));
        found.peaks.forEach((p, i) => {
            assert.equal(p.index, Math.trunc(c.positions[i] + 0.5), `${c.name}: nearest element`);
            assert.equal(p.value, c.values[p.index], `${c.name}: value of the array there`);
        });
    }
});

test("the deconvolved spectrum equals the one that ROOT leaves in its destination", () => {
    for (const c of cases.filter((x) => !x.refused)) {
        const found = search.searchPeaks(c.values, optionsOf(c));
        closeArray(found.deconvolved, c.deconvolved, 1e-9, `${c.name} deconvolved`);
    }
});

test("the arguments that ROOT refuses are refused with a reason, and the search of a flat array finds nothing", () => {
    for (const c of cases.filter((x) => x.refused)) {
        assert.throws(() => search.searchPeaks(c.values, optionsOf(c)), RangeError, c.name);
    }
    assert.throws(() => search.searchPeaks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { sigma: 0.5 }), /1 or more/);
    assert.throws(() => search.searchPeaks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { sigma: 1, threshold: 0 }), /fraction/);
    assert.throws(() => search.searchPeaks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { sigma: 1, threshold: 1 }), /fraction/);
    assert.throws(() => search.searchPeaks(new Float64Array(20), { sigma: 4 }), /needs at least 57/);
    assert.throws(() => search.searchPeaks([1, NaN, 3, 4, 5], { sigma: 1, background: false }), /Element 1/);
    assert.throws(() => search.searchPeaks([1, 2, 3, 4, 5, 6, 7, 8], { sigma: 1, markov: true, averageWindow: 0 }), /averaging window/);
    assert.throws(() => search.searchPeaks([1, 2, 3, 4, 5, 6, 7, 8], { sigma: 1, maxPeaks: 0 }), /most peaks/);
    assert.throws(() => search.searchPeaks([1, 2], { sigma: 1, background: false }), /too few/);
    const flat = search.searchPeaks(new Float64Array(60).fill(7), { sigma: 2 });
    assert.deepEqual(flat.positions, []);
});

test("the defaults are ROOT's: sigma 2, 5 percent of the highest peak, the background removed, the Markov smoothing, 3 iterations, a window of 3 and 100 peaks", () => {
    assert.equal(search.DEFAULT_SIGMA, 2);
    assert.equal(search.DEFAULT_THRESHOLD, 0.05);
    assert.equal(search.DEFAULT_DECONVOLUTION_ITERATIONS, 3);
    assert.equal(search.DEFAULT_AVERAGE_WINDOW, 3);
    assert.equal(search.DEFAULT_MAX_PEAKS, 100);
    const c = cases.find((x) => x.name === "wave-default");
    const found = search.searchPeaks(c.values);
    found.positions.forEach((x, i) => close(x, c.positions[i], 1e-9, 1e-9, `default position ${i}`));
    assert.equal(found.positions.length, 100, "the buffer of 100 peaks is full on the wave, as ROOT warns");
});

test("the boundaries of ROOT are kept: the clipping window of 7 sigma rounded, an array of exactly 2 windows plus 1 elements, and a sigma whose window reaches 512", () => {
    const named = (name) => cases.find((c) => c.name === name);
    assert.equal(named("boundary-clipping-ok").refused, false);
    assert.equal(named("refused-boundary-clipping").refused, true);
    assert.equal(named("boundary-clipping-ok").values.length, 15);
    assert.equal(named("boundary-sigma-ok").refused, false);
    assert.equal(named("refused-boundary-sigma").refused, true);
    for (const name of ["wave-small-sigma1.5", "positive-sigma2.5", "symmetric-pair", "signed-noise-start", "peak-at-the-end"]) {
        const c = named(name);
        assert.ok(c.positions.length >= 1, `${name}: ROOT finds a peak`);
    }
    const last = named("peak-at-the-end");
    assert.ok(last.positions[0] <= last.values.length - 1 && last.positions[0] > last.values.length - 6, "the peak at the end is limited to the array");
    const tie = named("symmetric-pair").positions;
    assert.equal(tie.length, 2, "two equal peaks are both listed, in ROOT's order");
    assert.ok(named("signed-noise-start").values[0] < 0, "an array that starts below zero");
    const equal = named("tie-plain");
    assert.equal(equal.values[30], equal.values[90], "two peaks of exactly one value");
    assert.deepEqual(equal.positions.slice(0, 2).map(Math.round), [30, 90], "equal peaks keep the order of the array");
    assert.ok(named("peak-at-the-start").positions.every((x) => x > 20), "ROOT lists no peak that stands at the very start of the array");
});

test("a Gaussian peak well above the noise is found at its centre, whatever the background under it", () => {
    const n = 300;
    const values = Float64Array.from({ length: n }, (_, i) => 5 + 0.02 * i + 40 * Math.exp(-0.5 * ((i - 120.4) / 6) ** 2));
    const found = search.searchPeaks(values, { sigma: 6 });
    assert.ok(found.positions.length >= 1);
    assert.ok(Math.abs(found.positions[0] - 120.4) < 1.0, `the highest peak is at ${found.positions[0]}`);
});
