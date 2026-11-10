// The correlations of aa/correlation.js against SciPy and NumPy: Pearson and Spearman with their p-values, the cross-correlation,
// the correlation and partial correlation matrices and the profile, with the incomplete beta function behind the p-values.
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";
import { reference, close, closeArray } from "./reference.mjs";

const correlation = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/correlation.js");
const ref = reference.correlationCases;

test("Pearson's r and its p-value equal SciPy pearsonr", () => {
    const result = correlation.pearson(ref.x, ref.y);
    close(result.r, ref.pearson.r, 1e-9, 1e-15, "r");
    assert.ok(Math.abs(result.p - ref.pearson.p) <= 1e-6, `p ${result.p} vs ${ref.pearson.p}`);
    assert.equal(result.n, ref.x.length);
});

test("Spearman's rho and its p-value equal SciPy spearmanr, with average ranks for ties", () => {
    const result = correlation.spearman(ref.x, ref.y);
    close(result.rho, ref.spearman.rho, 1e-9, 1e-15, "rho");
    assert.ok(Math.abs(result.p - ref.spearman.p) <= 1e-6, `p ${result.p} vs ${ref.spearman.p}`);
    assert.deepEqual(correlation.averageRanks([3, 1, 3, 2]), [3.5, 1, 3.5, 2]);
});

test("the cross-correlation over lags equals the NumPy values and peaks at the lag of the shifted copy", () => {
    const result = correlation.crossCorrelation(ref.x, ref.lagged, 5);
    assert.deepEqual(result.lags, ref.lags);
    closeArray(result.values, ref.cross, 1e-9, "cross-correlation");
    assert.equal(result.lags[result.values.indexOf(Math.max(...result.values))], 3);
});

test("the correlation matrix and the partial correlation equal NumPy", () => {
    const matrix = correlation.correlationMatrix(ref.four);
    matrix.forEach((row, i) => closeArray(row, ref.correlationMatrix[i], 1e-9, `row ${i}`));
    const partial = correlation.partialCorrelation(ref.four);
    partial.forEach((row, i) => closeArray(row, ref.partialCorrelation[i], 1e-9, `partial row ${i}`));
});

test("the profile of y against x gives the mean, the standard error and the count of each bin as NumPy", () => {
    const bins = correlation.profile(reference.profileCases.x, reference.profileCases.y, reference.profileCases.edges);
    bins.forEach((bin, b) => {
        const expected = reference.profileCases.bins[b];
        assert.equal(bin.count, expected.count, `count ${b}`);
        if (expected.mean !== null) close(bin.mean, expected.mean, 1e-9, 1e-15, `mean ${b}`);
        if (expected.error !== null) close(bin.error, expected.error, 1e-9, 1e-15, `error ${b}`);
    });
});

test("the incomplete beta function and the Student t are exact on known values", () => {
    close(correlation.incompleteBeta(1, 1, 0.3), 0.3, 1e-12, 1e-15, "uniform");
    close(correlation.incompleteBeta(2, 2, 0.5), 0.5, 1e-12, 1e-15, "symmetric");
    close(correlation.incompleteBeta(0.5, 0.5, 0.25), 2 / Math.PI * Math.asin(0.5), 1e-10, 1e-15, "arcsine");
    close(correlation.studentTwoSided(0, 10), 1, 1e-12, 1e-15, "t of zero");
    close(correlation.studentTwoSided(2.228138851986274, 10), 0.05, 1e-6, 1e-12, "t at the 5 percent point of 10 degrees of freedom");
});

test("inputs without spread or with fewer than three pairs are refused", () => {
    assert.equal(correlation.pearson([1, 1, 1], [1, 2, 3]), null);
    assert.equal(correlation.pearson([1, 2], [1, 2]), null);
    assert.equal(correlation.spearman([1, 2], [1, 2]), null);
    assert.equal(correlation.partialCorrelation([[1, 2, 3], [1, 2, 3]]), null);
});
