// The rate of change, the linear fit, the time beyond a level and the limits of aa/trend.js against NumPy and SciPy, and against
// hand-worked small cases.
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";
import { reference, close, closeArray } from "./reference.mjs";

const trend = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/trend.js");
const ref = reference.trend;
const points = ref.times.map((t, i) => ({ t, v: ref.values[i] }));

test("the rate of change equals the NumPy difference over the time step", () => {
    const rates = trend.rateOfChange(points);
    closeArray(rates.map((r) => r.v), ref.rates, 1e-12, "rates");
    assert.deepEqual(rates.map((r) => r.t), ref.times.slice(1));
});

test("the linear fit agrees with SciPy linregress", () => {
    const fit = trend.linearFit(points);
    close(fit.slope, ref.fit.slope, 1e-9, 1e-15, "slope");
    close(fit.intercept, ref.fit.intercept, 1e-9, 1e-12, "intercept");
    close(fit.rSquared, ref.fit.rSquared, 1e-9, 1e-12, "r squared");
    close(fit.slopeError, ref.fit.slopeError, 1e-9, 1e-15, "slope error");
    assert.equal(fit.n, ref.fit.n);
    close(trend.fitValueAt(fit, points[0].t), fit.intercept, 1e-12, 1e-12, "value at the first time");
    const lastSeconds = (ref.times[ref.times.length - 1] - ref.times[0]) / 1000;
    close(trend.fitValueAt(fit, ref.times[ref.times.length - 1]), ref.fit.intercept + ref.fit.slope * lastSeconds, 1e-9, 1e-12, "value at the last time");
});

test("the fit of samples made with a known slope finds it within four standard errors", () => {
    const fit = trend.linearFit(points);
    assert.ok(Math.abs(fit.slope - 0.002) <= 4 * fit.slopeError, `slope ${fit.slope} +- ${fit.slopeError}`);
});

for (const [index, expected] of ref.beyond.entries()) {
    test(`the time beyond ${expected.level} ${expected.side} in window ${index} equals the NumPy clipped sum`, () => {
        const got = trend.timeBeyond(points, expected.level, expected.side, expected.window[0], expected.window[1]);
        close(got.beyond, expected.beyond, 1e-12, 0, "beyond");
        close(got.observed, expected.observed, 1e-12, 0, "observed");
    });
}

test("rate, fit and time beyond on small worked cases", () => {
    const p = [{ t: 0, v: 0 }, { t: 2000, v: 4 }, { t: 3000, v: 4 }, { t: 3000, v: 9 }, { t: 7000, v: 1 }];
    assert.deepEqual(trend.rateOfChange(p), [{ t: 2000, v: 2 }, { t: 3000, v: 0 }, { t: 7000, v: -2 }]);
    const line = trend.linearFit([{ t: 0, v: 1 }, { t: 1000, v: 3 }, { t: 2000, v: 5 }, { t: 3000, v: 7 }]);
    close(line.slope, 2, 1e-12, 0, "slope");
    close(line.intercept, 1, 1e-12, 0, "intercept");
    close(line.rSquared, 1, 1e-12, 0, "r squared");
    assert.equal(line.slopeError, 0);
    // Constant values: SciPy gives the slope and the error as 0 and settles the undefined correlation by returning 0; r squared is not
    // defined, so the routine returns null and the page says so, rather than 1 (a perfect fit) or 0 (no fit).
    const flat = trend.linearFit([0, 1000, 2000, 3000].map((t) => ({ t, v: 5 })));
    close(flat.slope, reference.trendConstant.slope, 1e-12, 1e-15, "slope");
    close(flat.slopeError, reference.trendConstant.stderr, 1e-12, 1e-15, "slope error");
    assert.equal(reference.trendConstant.rvalue, 0);
    assert.equal(flat.rSquared, null);
    // The signal holds 0 for 2 s, 4 for 1 s, 4 for 0 s, 9 for 4 s: above 3 for 5 s of 7 s; a value equal to the level is not beyond it.
    assert.deepEqual(trend.timeBeyond(p, 3, "above", 0, 7000), { beyond: 1000 + 0 + 4000, observed: 7000, fraction: 5 / 7 });
    assert.deepEqual(trend.timeBeyond(p, 4, "above", 0, 7000), { beyond: 4000, observed: 7000, fraction: 4 / 7 });
    assert.deepEqual(trend.timeBeyond(p, 4, "below", 0, 7000), { beyond: 2000, observed: 7000, fraction: 2 / 7 });
    // A window clips the holding intervals; a window outside the samples observes nothing.
    assert.deepEqual(trend.timeBeyond(p, 3, "above", 1000, 2500), { beyond: 500, observed: 1500, fraction: 1 / 3 });
    assert.deepEqual(trend.timeBeyond(p, 3, "above", 8000, 9000), { beyond: 0, observed: 0, fraction: null });
});

test("what has no rate, no fit or no time stays null or empty", () => {
    assert.deepEqual(trend.rateOfChange([]), []);
    assert.deepEqual(trend.rateOfChange([{ t: 0, v: 1 }]), []);
    assert.deepEqual(trend.rateOfChange([{ t: 5, v: 1 }, { t: 5, v: 2 }, { t: 4, v: 3 }]), []);
    assert.equal(trend.linearFit([{ t: 0, v: 1 }, { t: 1000, v: 2 }]), null);
    assert.equal(trend.linearFit([{ t: 7, v: 1 }, { t: 7, v: 2 }, { t: 7, v: 3 }]), null);
});

test("the limits are the numbers the metadata carries, and a display range of 0 and 0 is none", () => {
    const set = trend.limitsOf({ HIHI: "16.0", HIGH: "14.0", LOW: "6.0", LOLO: "4.0", LOPR: "0.0", HOPR: "20.0" });
    assert.deepEqual(set.map((l) => [l.field, l.value, l.side]), [["HIHI", 16, "above"], ["HIGH", 14, "above"], ["LOW", 6, "below"], ["LOLO", 4, "below"], ["LOPR", 0, "below"], ["HOPR", 20, "above"]]);
    const partial = trend.limitsOf({ HIHI: "NaN", HIGH: "NaN", LOW: "490.0", LOLO: "450.0", LOPR: "0.0", HOPR: "0.0" });
    assert.deepEqual(partial.map((l) => l.field), ["LOW", "LOLO"]);
    assert.deepEqual(trend.limitsOf({ HIHI: "NaN", HIGH: "NaN", LOW: "NaN", LOLO: "NaN", LOPR: "0.0", HOPR: "0.0" }), []);
    assert.deepEqual(trend.limitsOf({}), []);
    assert.deepEqual(trend.limitsOf(null), []);
    assert.deepEqual(trend.limitsOf({ HIHI: "", HIGH: "abc", LOW: "Infinity" }), []);
});
