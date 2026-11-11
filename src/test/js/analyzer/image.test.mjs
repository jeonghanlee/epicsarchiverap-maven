// The image routines (aa/image.js) against the values that NumPy and SciPy compute from the fixed 64 by 48 image of the reference
// file: the sums, projections, centroid and peak of three regions, the Gaussian size of the projections (curve_fit from the same
// start), the subtraction of a constant, the difference of two frames, and the refusals of a size that does not match the element
// count and of a region outside the image.
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";
import { reference, close, closeArray } from "./reference.mjs";

const image = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/image.js");
const ref = reference.imageCases;
const region = (r) => ({ x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1 });

test("the total, the mean, the projections, the first maximum and the centroid of a region equal NumPy", () => {
    for (const r of ref.regions) {
        const stats = image.regionStats(ref.pixels, ref.width, ref.height, region(r));
        close(stats.total, r.total, 1e-9, 0, "total");
        close(stats.mean, r.mean, 1e-9, 0, "mean");
        assert.equal(stats.min, r.min);
        closeArray(stats.projectionX, r.projectionX, 1e-12, "projection X");
        closeArray(stats.projectionY, r.projectionY, 1e-12, "projection Y");
        assert.deepEqual(stats.peak, r.peak, "the first maximum in row-major order");
        close(stats.centroid.x, r.centroid.x, 1e-9, 0, "centroid X");
        close(stats.centroid.y, r.centroid.y, 1e-9, 0, "centroid Y");
    }
});

test("with no region the whole image is taken", () => {
    const stats = image.regionStats(ref.pixels, ref.width, ref.height);
    close(stats.total, ref.regions[0].total, 1e-9, 0, "total");
    assert.equal(stats.projectionX.length, ref.width);
    assert.equal(stats.projectionY.length, ref.height);
});

test("the Gaussian size of the X and the Y projection equals curve_fit from the same start, within 1e-6 or a tenth of the error", () => {
    for (const r of ref.regions) {
        const size = image.regionSize(ref.pixels, ref.width, ref.height, region(r));
        for (const [axis, expected] of [["x", r.fitX], ["y", r.fitY]]) {
            const fit = size[axis];
            assert.ok(fit.ok, `${axis} fit: ${fit.reason}`);
            fit.params.forEach((p, k) => {
                const tolerance = Math.max(1e-6 * Math.abs(expected.params[k]), 0.1 * expected.errors[k]);
                assert.ok(Math.abs(p - expected.params[k]) <= tolerance, `${axis} parameter ${k}: ${p} against ${expected.params[k]}`);
            });
            close(fit.sigma, expected.sigma, 1e-6, 0, `${axis} sigma`);
            close(fit.fwhm, expected.fwhm, 1e-6, 0, `${axis} FWHM`);
            close(fit.fwhm, image.FWHM_FACTOR * fit.sigma, 1e-12, 0, `${axis} FWHM from sigma`);
        }
    }
});

test("the blob of known centre and width returns its centre and width within four errors", () => {
    const size = image.regionSize(ref.pixels, ref.width, ref.height, region(ref.regions[0]));
    const within = (fit, k, truth, what) => assert.ok(Math.abs(fit.params[k] - truth) <= 4 * fit.errors[k], `${what}: ${fit.params[k]} against ${truth}`);
    within(size.x, 1, 30.4, "mu X");
    within(size.x, 2, 5.0, "sigma X");
    within(size.y, 1, 22.6, "mu Y");
    within(size.y, 2, 3.0, "sigma Y");
});

test("the subtraction of a constant keeps negative pixels and the centroid is that of the subtracted image", () => {
    const subtracted = image.subtractConstant(ref.pixels, ref.constant);
    const stats = image.regionStats(subtracted, ref.width, ref.height);
    close(stats.total, ref.subtracted.total, 1e-9, 0, "total");
    close(stats.centroid.x, ref.subtracted.centroid.x, 1e-9, 0, "centroid X");
    close(stats.centroid.y, ref.subtracted.centroid.y, 1e-9, 0, "centroid Y");
    assert.equal(stats.min, ref.subtracted.min);
    assert.ok(stats.min < 0, "a pixel below the level stays negative");
});

test("the difference of two frames is pixelwise, the image minus the reference", () => {
    const diff = image.frameDifference(ref.pixels, ref.second, ref.width, ref.height);
    const total = diff.reduce((a, v) => a + v, 0);
    close(total, ref.difference.total, 1e-9, 0, "total");
    assert.equal(Math.min(...diff), ref.difference.min);
    assert.equal(Math.max(...diff), ref.difference.max);
    const cells = [];
    for (let y = 10; y < 14; y += 1) for (let x = 28; x < 34; x += 1) cells.push(diff[y * ref.width + x]);
    closeArray(cells, ref.difference.cells, 1e-12, "cells");
});

test("the peak is the first maximum in row-major order, along X before Y", () => {
    const px = [1, 2, 9, 9, 3, 4];
    assert.deepEqual(image.regionStats(px, 3, 2).peak, { x: 2, y: 0, value: 9 });
    assert.deepEqual(image.regionStats(px, 3, 2, { x0: 0, x1: 2, y0: 0, y1: 2 }).peak, { x: 0, y: 1, value: 9 }, "inside a region the first one it holds");
});

test("a constant projection has no width: an image of one level and a region of one level are refused with the reason", () => {
    const flat = new Float64Array(64 * 48).fill(100);
    const size = image.regionSize(flat, 64, 48);
    for (const axis of ["x", "y"]) {
        assert.equal(size[axis].ok, false);
        assert.match(size[axis].reason, /constant/);
    }
    const positions = Array.from({ length: 20 }, (_, i) => i);
    for (const level of [0, 100, -5]) {
        const fit = image.gaussianSize(positions, new Array(20).fill(level));
        assert.equal(fit.ok, false, `level ${level}`);
        assert.equal(fit.sigma, undefined, "no width is reported");
    }
});

test("an all-zero image has no centroid and its size cannot be fitted", () => {
    const z = ref.zero;
    const stats = image.regionStats(z.pixels, z.width, z.height);
    assert.equal(stats.centroid, null);
    assert.equal(stats.total, 0);
    const size = image.regionSize(z.pixels, z.width, z.height);
    assert.equal(size.x.ok, false);
});

test("a size that does not match the element count, a region outside the image and a pixel that is not a number are refused with a reason", () => {
    const px = new Float64Array(12);
    assert.throws(() => image.regionStats(px, 5, 3), /5 by 3 pixels has 15 elements; the array has 12/);
    assert.throws(() => image.regionStats(px, 4.5, 3), /whole numbers/);
    assert.throws(() => image.regionStats(px, 0, 12), /whole numbers/);
    assert.throws(() => image.regionStats(px, 4, 3, { x0: 0, x1: 5, y0: 0, y1: 3 }), /outside the image of 4 by 3/);
    assert.throws(() => image.regionStats(px, 4, 3, { x0: -1, x1: 2, y0: 0, y1: 3 }), /outside/);
    assert.throws(() => image.regionStats(px, 4, 3, { x0: 2, x1: 2, y0: 0, y1: 3 }), /empty/);
    assert.throws(() => image.regionStats(px, 4, 3, { x0: 0.5, x1: 2, y0: 0, y1: 3 }), /x0 of the region is not a whole number/);
    assert.throws(() => image.regionStats([1, NaN, 3, 4], 2, 2), /Element 1/);
    assert.throws(() => image.subtractConstant(px, NaN), /level/);
    assert.throws(() => image.frameDifference(px, new Float64Array(6), 4, 3), /6 elements|has 6/);
});
