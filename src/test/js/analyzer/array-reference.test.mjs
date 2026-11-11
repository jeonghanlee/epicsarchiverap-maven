// The reference values of the array and image tools (generate-references.py), checked for what the routines will be compared
// against: the summary values equal a direct recomputation from the stored array, the fixed arrays and images of known content
// return the centre and width they were made with, and the rules the routines must follow (a flat or one-sided half-maximum
// width and a centre of a non-positive sum are not defined, a plateau peak is its middle, an end of the array is no peak) hold in
// the stored values. The routines themselves are checked in their own files.
import test from "node:test";
import assert from "node:assert/strict";
import { reference, close, closeArray } from "./reference.mjs";

const arrays = reference.arrayCases;
const images = reference.imageCases;
const FWHM_FACTOR = 2 * Math.sqrt(2 * Math.log(2));

test("the summary values of the stored arrays equal a direct recomputation", () => {
    for (const name of ["wave", "gaussian", "ramp", "negative", "flat"]) {
        const values = arrays[name].values;
        const s = arrays[name].summary;
        const sum = values.reduce((a, v) => a + v, 0);
        close(s.sum, sum, 1e-12, 1e-12, `${name} sum`);
        close(s.mean, sum / values.length, 1e-12, 1e-12, `${name} mean`);
        close(s.rms, Math.sqrt(values.reduce((a, v) => a + v * v, 0) / values.length), 1e-12, 1e-12, `${name} rms`);
        assert.equal(s.max, Math.max(...values), `${name} max`);
        assert.equal(s.min, Math.min(...values), `${name} min`);
        assert.equal(values[s.maxAt], s.max);
        assert.equal(values.indexOf(s.max), s.maxAt, `${name} first position of the maximum`);
        assert.equal(values.indexOf(s.min), s.minAt, `${name} first position of the minimum`);
    }
});

test("the centre is the intensity-weighted centroid and is not defined for a sum that is not positive", () => {
    const g = arrays.gaussian;
    const centroid = g.values.reduce((a, v, i) => a + i * v, 0) / g.summary.sum;
    close(g.summary.centre, centroid, 1e-12, 1e-12, "centroid");
    assert.equal(arrays.negative.summary.centre, null);
    assert.ok(arrays.flat.summary.centre !== null);
});

test("the half-maximum width of a Gaussian is 2.355 sigma, and it is not defined for a flat array or when a side stays above half", () => {
    const g = arrays.gaussian;
    assert.ok(Math.abs(g.summary.fwhm.width - g.fwhmOfModel) < 0.01 * g.fwhmOfModel, `${g.summary.fwhm.width} against ${g.fwhmOfModel}`);
    close(g.fwhmOfModel, FWHM_FACTOR * 20, 1e-12, 0, "model width");
    assert.ok(g.summary.fwhm.left < g.summary.maxAt && g.summary.maxAt < g.summary.fwhm.right);
    assert.equal(arrays.ramp.summary.fwhm, null, "the ramp stays above half on its right");
    assert.equal(arrays.flat.summary.fwhm, null);
    assert.equal(arrays.negative.summary.fwhm, null);
});

test("the stored backgrounds of ROOT lie on or below the array and leave the first and last element as they are", () => {
    for (const c of arrays.rootBackground.filter((x) => !x.error)) {
        assert.equal(c.background.length, c.values.length, c.name);
        c.values.forEach((v, i) => assert.ok(c.background[i] <= v + 1e-12, `${c.name}: the background lies on or below the array at ${i}`));
        assert.equal(c.background[0], c.values[0], `${c.name}: the first element is not clipped`);
        assert.equal(c.background[c.values.length - 1], c.values[c.values.length - 1], `${c.name}: the last element is not clipped`);
    }
});

test("the stored searches of ROOT hold positions inside the array, at most the peaks asked for, and the refusals", () => {
    for (const c of arrays.rootSearch) {
        if (c.refused) {
            assert.deepEqual(c.positions, [], `${c.name}: a refused search finds nothing`);
            continue;
        }
        assert.ok(c.positions.length <= c.maxPeaks, `${c.name}: at most ${c.maxPeaks} peaks`);
        for (const x of c.positions) assert.ok(x >= 0 && x <= c.values.length - 1, `${c.name}: position ${x}`);
        assert.equal(c.deconvolved.length, c.values.length);
    }
    assert.equal(arrays.rootSearch.filter((c) => c.refused).length, 6);
    assert.equal(arrays.rootSearch.find((c) => c.name === "wave-five-peaks").positions.length, 5);
});

test("the wave carries the three peaks it was made with, among the peaks that ROOT lists, each wider than the sine", () => {
    const found = arrays.rootSearch.find((c) => c.name === "wave-sigma8").positions;
    for (const centre of [400, 900, 1500]) {
        assert.ok(found.some((x) => Math.abs(x - centre) < 25), `a peak near ${centre}`);
    }
    close(arrays.wave.summary.max, Math.max(...arrays.wave.values), 0, 0, "wave maximum");
});

test("the stored widths are at half of the height above ROOT's background, and none is cut by the array without being null", () => {
    for (const c of arrays.peakWidths) {
        const background = c.widthIterations === null ? null : arrays.rootBackground.find((b) => b.name === `${c.name}-width`).background;
        for (const p of c.peaks) {
            assert.equal(p.value, c.values[p.index]);
            close(p.height, c.values[p.index] - (background ? background[p.index] : 0), 1e-12, 1e-12, "height");
            if (p.width === null) continue;
            assert.ok(p.left < p.index && p.index < p.right, `${c.name}: peak ${p.index} crossings`);
            close(p.right - p.left, p.width, 1e-12, 1e-12, "width");
            assert.ok(p.width > 0);
        }
    }
});

test("the difference array is the array minus its reference, element by element", () => {
    const w = arrays.wave;
    closeArray(w.difference, w.values.map((v, i) => v - w.reference[i]), 1e-12, "difference");
});

test("the heatmap frames keep one extent over all the frames", () => {
    const h = arrays.heatmap;
    assert.equal(h.min, Math.min(...h.frames.map((f) => Math.min(...f))));
    assert.equal(h.max, Math.max(...h.frames.map((f) => Math.max(...f))));
});

test("an image region has the sums, projections, centroid and peak of the pixels it holds", () => {
    const w = images.width;
    for (const r of images.regions) {
        let total = 0;
        const columns = new Array(r.x1 - r.x0).fill(0);
        const rows = new Array(r.y1 - r.y0).fill(0);
        let best = -Infinity;
        let at = null;
        for (let y = r.y0; y < r.y1; y += 1) {
            for (let x = r.x0; x < r.x1; x += 1) {
                const v = images.pixels[y * w + x];
                total += v;
                columns[x - r.x0] += v;
                rows[y - r.y0] += v;
                if (v > best) { best = v; at = { x, y }; }
            }
        }
        close(r.total, total, 1e-12, 0, "total");
        closeArray(r.projectionX, columns, 1e-12, "projection X");
        closeArray(r.projectionY, rows, 1e-12, "projection Y");
        assert.deepEqual({ x: r.peak.x, y: r.peak.y }, at, "the first maximum in row-major order");
        assert.equal(r.peak.value, best);
        close(r.centroid.x, columns.reduce((a, v, i) => a + (r.x0 + i) * v, 0) / total, 1e-12, 0, "centroid X");
        close(r.centroid.y, rows.reduce((a, v, i) => a + (r.y0 + i) * v, 0) / total, 1e-12, 0, "centroid Y");
    }
});

test("the Gaussian size of the blob of known centre and width is within the error of the values it was made with", () => {
    const whole = images.regions[0];
    const within = (actual, truth, error, what) => assert.ok(Math.abs(actual - truth) <= 4 * error, `${what}: ${actual} is more than four errors (${error}) from ${truth}`);
    within(whole.fitX.params[1], 30.4, whole.fitX.errors[1], "mu X");
    within(whole.fitX.params[2], 5.0, whole.fitX.errors[2], "sigma X");
    within(whole.fitY.params[1], 22.6, whole.fitY.errors[1], "mu Y");
    within(whole.fitY.params[2], 3.0, whole.fitY.errors[2], "sigma Y");
    close(whole.fitX.fwhm, FWHM_FACTOR * whole.fitX.sigma, 1e-12, 0, "FWHM X");
    close(whole.fitY.fwhm, FWHM_FACTOR * whole.fitY.sigma, 1e-12, 0, "FWHM Y");
});

test("the subtraction of a constant and the difference of two frames are the pixelwise results, and an all-zero image has no centroid", () => {
    const w = images.width;
    const h = images.height;
    let total = 0;
    let weightedX = 0;
    let weightedY = 0;
    let lowest = Infinity;
    for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
            const v = images.pixels[y * w + x] - images.constant;
            total += v;
            weightedX += x * v;
            weightedY += y * v;
            lowest = Math.min(lowest, v);
        }
    }
    close(images.subtracted.total, total, 1e-12, 0, "subtracted total");
    close(images.subtracted.centroid.x, weightedX / total, 1e-12, 0, "subtracted centroid X");
    close(images.subtracted.centroid.y, weightedY / total, 1e-12, 0, "subtracted centroid Y");
    assert.equal(images.subtracted.min, lowest);
    const diff = images.pixels.map((v, i) => v - images.second[i]);
    close(images.difference.total, diff.reduce((a, v) => a + v, 0), 1e-12, 0, "difference total");
    assert.equal(images.difference.max, Math.max(...diff));
    assert.equal(images.difference.min, Math.min(...diff));
    assert.equal(images.zero.centroid, null);
    assert.equal(images.zero.pixels.length, images.zero.width * images.zero.height);
});
