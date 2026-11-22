// The moments, quantiles, box plot and kernel density of aa/stats.js against NumPy and SciPy, and against samples of known
// parameters made with the seeded generators.
import test from "node:test";
import assert from "node:assert/strict";
import { d3 } from "./load-d3.mjs";
import { reference, close, closeArray } from "./reference.mjs";

const STATS = "../../../main/org/epics/archiverappliance/staticcontent/js/aa/stats.js";
const stats = await import(STATS);

for (const sample of reference.moments) {
    test(`moments of the ${sample.name} sample agree with NumPy and SciPy`, () => {
        const m = stats.moments(sample.values);
        for (const key of Object.keys(sample.expected)) {
            close(m[key], sample.expected[key], 1e-9, 1e-12, key);
        }
    });

    test(`quantiles of the ${sample.name} sample agree with NumPy`, () => {
        const got = stats.quantiles(sample.values, sample.quantiles.ps);
        closeArray(got, sample.quantiles.values, 1e-12, "quantiles");
    });

    test(`the box plot of the ${sample.name} sample agrees with the definition of Tukey`, () => {
        const box = stats.boxPlot(sample.values);
        for (const key of ["q1", "median", "q3", "whiskerLow", "whiskerHigh"]) {
            close(box[key], sample.box[key], 1e-12, 1e-12, key);
        }
        assert.deepEqual(box.outliers, sample.box.outliers);
    });

    test(`the kernel density of the ${sample.name} sample agrees with SciPy gaussian_kde (Silverman)`, () => {
        close(stats.silvermanBandwidth(sample.values), sample.kde.bandwidth, 1e-12, 0, "bandwidth");
        closeArray(stats.kernelDensity(sample.values, sample.kde.grid), sample.kde.density, 1e-9, "density");
    });
}

test("a sample too small or too flat leaves what it cannot define null", () => {
    assert.deepEqual(stats.moments([]), { n: 0, min: null, max: null, mean: null, variance: null, sd: null, skewness: null, kurtosis: null, seMean: null, seSd: null });
    const one = stats.moments([4]);
    assert.equal(one.mean, 4);
    assert.equal(one.sd, null);
    const flat = stats.moments([3, 3, 3, 3, 3]);
    assert.equal(flat.sd, 0);
    assert.equal(flat.skewness, null);
    assert.equal(stats.kernelDensity([3, 3, 3], [3]), null);
    assert.equal(stats.boxPlot([]), null);
});

test("values that are not finite are left out", () => {
    const m = stats.moments([1, 2, NaN, 3, Infinity, 4]);
    assert.equal(m.n, 4);
    close(m.mean, 2.5);
});

test("a normal sample of known parameters is estimated within 4 standard errors", () => {
    const random = d3.randomNormal.source(d3.randomLcg(7))(10, 2);
    const values = Array.from({ length: 20000 }, random);
    const m = stats.moments(values);
    assert.ok(Math.abs(m.mean - 10) <= 4 * m.seMean, `mean ${m.mean} (se ${m.seMean})`);
    assert.ok(Math.abs(m.sd - 2) <= 4 * m.seSd, `sd ${m.sd} (se ${m.seSd})`);
    assert.ok(Math.abs(m.skewness) < 0.1 && Math.abs(m.kurtosis) < 0.2);
});
