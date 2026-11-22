// The common bins, the rules that say when a test can run, and the numbers and tests of two samples in aa/compare.js against NumPy and
// SciPy (np.histogram, chi2_contingency with its expected counts, ks_2samp with the classical asymptotic p-value, anderson_ksamp).
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";
import { reference, close } from "./reference.mjs";

const compare = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/compare.js");

const sizes = reference.compareCases.map((c) => `${c.name}: ${c.a.length} and ${c.b.length}`).join("; ");

for (const c of reference.compareCases.filter((x) => !x.refusal)) {
    test(`the common bins of ${c.name} equal np.histogram of the pooled range`, () => {
        const pooled = c.a.concat(c.b);
        const lo = Math.min(...pooled);
        const hi = Math.max(...pooled);
        assert.deepEqual(compare.binCounts(c.a, lo, hi, c.bins), c.countsA);
        assert.deepEqual(compare.binCounts(c.b, lo, hi, c.bins), c.countsB);
        assert.equal(compare.compute(c.a, c.b, false).number, c.bins);
    });

    test(`the chi-square rule of ${c.name} refuses exactly when SciPy's expected counts are below 5 in more than 20 percent of the cells`, () => {
        const refusal = compare.testRefusal("chi2", c.a, c.b, c.countsA, c.countsB);
        assert.equal(refusal !== null, c.chi2Refused, `${c.expectedBelowFive} of ${c.cells} cells; ${refusal}`);
        if (refusal) assert.match(refusal, new RegExp(`${c.expectedBelowFive} of the ${c.cells} cells`));
    });

    test(`the tests of ${c.name} equal SciPy`, () => {
        const r = compare.compute(c.a, c.b, false);
        if (!c.chi2Refused) {
            close(r.tests.chi2.result.statistic, c.chi2.statistic, 1e-9, 1e-12, "chi-square statistic");
            assert.equal(r.tests.chi2.result.degrees, c.chi2.degrees);
            assert.equal(r.tests.chi2.result.bins, c.chi2.bins);
            close(r.tests.chi2.result.pValue, c.chi2.p, 1e-9, 1e-12, "chi-square p-value");
        } else {
            assert.ok(r.tests.chi2.refusal, "refused");
            assert.equal(r.tests.chi2.result, undefined);
        }
        close(r.tests.ks.result.statistic, c.ks.statistic, 1e-12, 1e-15, "KS distance");
        close(r.tests.ks.result.pValue, c.ks.p, 1e-9, 1e-12, "KS p-value");
        close(r.tests.ad.result.statistic, c.ad.statistic, 1e-9, 1e-12, "AD statistic");
        close(r.tests.ad.result.significance, c.ad.significance, 1e-9, 1e-12, "AD significance");
    });
}

test(`fewer than 8 samples in either dataset refuses every test with the least number; the numbers stay (${sizes})`, () => {
    const c = reference.compareCases.find((x) => x.name === "few");
    assert.equal(c.refusal, "samples");
    const r = compare.compute(c.a, c.b, false);
    for (const method of compare.COMPARE_METHOD_NAMES) assert.match(r.tests[method].refusal, /at least 8 samples in each dataset; A holds 6\./);
    assert.equal(r.m.a.n, 6);
    assert.equal(r.m.b.n, 5);
    assert.ok(r.difference !== null && Number.isFinite(r.difference.meanDifference));
    // Exactly 8 samples in each dataset is enough, and 7 in one of them is not.
    const eight = Array.from({ length: 8 }, (_, i) => i);
    assert.equal(compare.testRefusal("ks", eight, eight.map((v) => v + 0.5), [4, 4], [4, 4]), null);
    assert.match(compare.testRefusal("ks", eight.slice(1), eight, [4, 3], [4, 4]), /at least 8 samples/);
});

test("samples that all have one value are refused as having no distribution, and the units rule refuses every test and gives no difference", () => {
    const c = reference.compareCases.find((x) => x.name === "flat");
    assert.equal(c.refusal, "flat");
    for (const method of compare.COMPARE_METHOD_NAMES) assert.match(compare.compute(c.a, c.b, false).tests[method].refusal, /one value/);
    const shifted = reference.compareCases.find((x) => x.name === "shifted");
    const unlike = compare.compute(shifted.a, shifted.b, true);
    assert.equal(unlike.difference, null);
    for (const method of compare.COMPARE_METHOD_NAMES) assert.match(unlike.tests[method].refusal, /units differ/);
});

test("the numbers of two samples are the moments and the differences with their errors", () => {
    const c = reference.compareCases.find((x) => x.name === "shifted");
    const r = compare.compute(c.a, c.b, false);
    close(r.difference.meanDifference, r.m.a.mean - r.m.b.mean, 1e-12, 0, "mean difference");
    close(r.difference.meanDifferenceError, Math.hypot(r.m.a.seMean, r.m.b.seMean), 1e-12, 0, "mean difference error");
    assert.ok(r.difference.meanDifference < 0, "A has the lower mean");
});
