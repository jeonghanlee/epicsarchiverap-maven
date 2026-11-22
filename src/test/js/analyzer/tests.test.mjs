// The distribution functions and the tests of aa/tests.js against SciPy.
import test from "node:test";
import assert from "node:assert/strict";
import { d3 } from "./load-d3.mjs";
import { reference, close } from "./reference.mjs";

const T = "../../../main/org/epics/archiverappliance/staticcontent/js/aa/tests.js";
const tests = await import(T);

test("the chi-square survival function agrees with SciPy", () => {
    for (const row of reference.chi2sf) {
        close(tests.chiSquareSurvival(row.x, row.k), row.sf, 1e-9, 1e-14, `chi2 sf(${row.x}, ${row.k})`);
    }
});

test("the Kolmogorov survival function agrees with SciPy", () => {
    for (const row of reference.kolmogorov) {
        close(tests.kolmogorovSurvival(row.lambda), row.q, 1e-9, 1e-14, `Q(${row.lambda})`);
    }
});

test("the chi-square test of two histograms agrees with chi2_contingency", () => {
    for (const row of reference.chiSquare) {
        const result = tests.chiSquareHomogeneity(row.a, row.b);
        close(result.statistic, row.statistic, 1e-9, 1e-12, "statistic");
        assert.equal(result.degrees, row.degrees);
        close(result.pValue, row.pValue, 1e-9, 1e-12, "p-value");
    }
});

test("the chi-square test has no result without two bins or without counts", () => {
    assert.equal(tests.chiSquareHomogeneity([0, 0, 0], [0, 0, 0]), null);
    assert.equal(tests.chiSquareHomogeneity([5, 0], [3, 0]), null);
    assert.throws(() => tests.chiSquareHomogeneity([1, 2], [1]));
});

test("the Kolmogorov-Smirnov statistic equals that of ks_2samp and its p-value the Kolmogorov survival of the scaled distance", () => {
    for (const row of reference.ks) {
        const result = tests.kolmogorovSmirnov(row.a, row.b);
        close(result.statistic, row.statistic, 1e-12, 1e-12, `${row.name} statistic`);
        close(result.effectiveSize, row.effectiveSize, 1e-12, 0, `${row.name} size`);
        close(result.pValue, row.pValue, 1e-9, 1e-12, `${row.name} p-value`);
        assert.equal(result.asymptotic, true);
    }
    assert.equal(tests.kolmogorovSmirnov([], [1]), null);
});

test("the k-sample Anderson-Darling test agrees with anderson_ksamp, with its capped and floored significance", () => {
    for (const row of reference.ad) {
        const result = tests.andersonDarling(row.samples);
        close(result.statistic, row.statistic, 1e-9, 1e-12, `${row.name} statistic`);
        for (let i = 0; i < row.critical.length; i += 1) close(result.critical[i], row.critical[i], 1e-12, 1e-12, `${row.name} critical ${i}`);
        close(result.significance, row.significance, 1e-9, 1e-12, `${row.name} significance`);
        assert.equal(result.capped, row.capped, `${row.name} capped`);
        assert.equal(result.floored, row.floored, `${row.name} floored`);
    }
    assert.equal(tests.andersonDarling([[1, 2, 3], []]), null);
    assert.equal(tests.andersonDarling([[2, 2], [2, 2]]), null);
});

test("the difference of two samples is the difference of their means and spreads with their errors", () => {
    const c = reference.compare;
    const result = tests.compareSamples(c.a, c.b);
    close(result.meanDifference, c.meanDifference, 1e-9, 1e-12, "mean difference");
    close(result.meanDifferenceError, c.meanDifferenceError, 1e-9, 1e-12, "mean difference error");
    close(result.sdDifference, c.sdDifference, 1e-9, 1e-12, "sd difference");
    close(result.sdDifferenceError, c.sdDifferenceError, 1e-9, 1e-12, "sd difference error");
    assert.equal(tests.compareSamples([1], [2, 3]).sdDifference, null);
});

test("two samples that differ by a known shift are told apart, and two of one distribution are not", () => {
    const draw = (seed, mean, count) => Array.from({ length: count }, d3.randomNormal.source(d3.randomLcg(seed))(mean, 1));
    const a = draw(11, 0, 800);
    const same = draw(12, 0, 800);
    const shifted = draw(13, 0.5, 800);
    assert.ok(tests.kolmogorovSmirnov(a, same).pValue > 0.01);
    assert.ok(tests.kolmogorovSmirnov(a, shifted).pValue < 1e-6);
    assert.ok(tests.andersonDarling([a, same]).significance > 0.01);
    assert.equal(tests.andersonDarling([a, shifted]).floored, true);
    const c = tests.compareSamples(shifted, a);
    assert.ok(Math.abs(c.meanDifference - 0.5) <= 4 * c.meanDifferenceError);
});
