// The fits of aa/fit.js against ROOT 6.36.10 (root_fits.C writes the data and the fits of root-fits.json): TGraph::Fit for the points
// of every model, TH1::Fit with the option I for the histogram, the covariance that Minuit2 reports for the errors, a fixed and a
// bounded parameter, the one-sigma band, and the Landau density against TMath::Landau.
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";
import { rootFits, close, closeArray } from "./reference.mjs";

const fit = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/fit.js");
const cases = rootFits.fitCases;
const chi2Of = (result) => result.chi2PerDof * result.dof;

/** Each parameter within 1e-6 relative of ROOT's, or within a tenth of its standard error, whichever is larger. */
function closeParams(actual, expected, errors, what) {
    actual.forEach((value, k) => {
        const allowed = Math.max(1e-6 * Math.abs(expected[k]), 0.1 * errors[k]);
        assert.ok(Math.abs(value - expected[k]) <= allowed, `${what}[${k}]: ${value} differs from ${expected[k]} by more than ${allowed}`);
    });
}

/** Each error within rel of ROOT's own (a fixed parameter has the error 0 in ROOT and no entry in the errors of the page). */
function closeErrors(actual, expected, rel, what) {
    const free = expected.map((e, k) => k).filter((k) => expected[k] > 0);
    assert.equal(actual.length, free.length, `${what}: number of errors`);
    free.forEach((k, j) => close(actual[j], expected[k], rel, 0, `${what}[${k}]`));
}

test("the line, the inverse line, the polynomial and the logarithm equal ROOT in parameters, errors, chi-square, R squared and degrees of freedom", () => {
    for (const [name, modelName] of [["line", "line"], ["lineInverse", "line"], ["polynomial2", "polynomial"], ["logarithm", "logarithm"]]) {
        const c = cases[name];
        const result = fit.fitModel(modelName, c.x, c.y);
        assert.equal(result.ok, true, name);
        assert.equal(c.fit.status, 0, `${name}: ROOT status`);
        closeArray(result.params, c.fit.params, 1e-9, `${name} params`);
        // The logarithm is linear, so its exact covariance is known; Minuit2's numerical covariance differs from it by 5.6e-9 relative.
        closeArray(result.errors, c.fit.errors, name === "logarithm" ? 1e-6 : 1e-9, `${name} errors`);
        close(chi2Of(result), c.fit.chi2, 1e-9, 1e-15, `${name} chi2`);
        close(result.rSquared, c.fit.rSquared, 1e-9, 1e-15, `${name} r2`);
        assert.equal(result.dof, c.fit.ndf);
    }
});

test("the exponential and the power model are fitted in y, as ROOT fits them, from the start values of ROOT and from their own guess", () => {
    for (const name of ["exponential", "power"]) {
        const c = cases[name];
        for (const options of [{ start: c.start }, {}]) {
            const result = fit.fitModel(name, c.x, c.y, options);
            const what = `${name} ${options.start ? "from ROOT start" : "from guess"}`;
            assert.equal(result.ok, true, what);
            assert.equal(result.converged, true, `${what} converged`);
            closeParams(result.params, c.fit.params, c.fit.errors, `${what} params`);
            // The covariance of these two comes from the numerical Hessian of Minuit2, which is off from the exact one by 0.14 percent
            // (exponential) and 0.41 percent (power); the page is within 0.1 percent of the exact value.
            closeErrors(result.errors, c.fit.errors, 1e-2, `${what} errors`);
            close(chi2Of(result), c.fit.chi2, 1e-6, 1e-15, `${what} chi2`);
            assert.equal(result.dof, c.fit.ndf);
        }
    }
});

test("the sine, the Gaussian and the Landau fits from the start values of ROOT reach its parameters, errors, chi-square and R squared", () => {
    for (const name of ["sine", "gaussian", "landau"]) {
        const c = cases[name];
        const result = fit.fitModel(name, c.x, c.y, { start: c.start });
        assert.equal(result.ok, true, name);
        assert.equal(result.converged, true, `${name} converged`);
        closeParams(result.params, c.fit.params, c.fit.errors, `${name} params`);
        closeErrors(result.errors, c.fit.errors, 1e-3, `${name} errors`);
        close(chi2Of(result), c.fit.chi2, 1e-6, 1e-15, `${name} chi2`);
        close(result.rSquared, c.fit.rSquared, 1e-6, 1e-15, `${name} r2`);
        assert.equal(result.dof, c.fit.ndf);
    }
});

test("a fixed parameter keeps its start value and is left out of the errors; the others equal ROOT's fit with that parameter fixed", () => {
    const c = cases.sine.fixedOffset;
    const result = fit.fitModel("sine", cases.sine.x, cases.sine.y, { start: [1.5, 0.14, 0.5, 1.0], fixed: [3] });
    assert.equal(result.params[3], 1.0);
    assert.deepEqual(result.free, [0, 1, 2]);
    closeParams(result.params, c.params, c.errors, "fixed-offset params");
    closeErrors(result.errors, c.errors, 1e-3, "fixed-offset errors");
    close(chi2Of(result), c.chi2, 1e-6, 1e-15, "fixed-offset chi2");
    assert.equal(result.dof, c.ndf);
});

test("a bounded parameter stops at its bound and the parameters and the chi-square equal ROOT's fit with the same limits", () => {
    const c = cases.gaussian.boundedWidth;
    const b = cases.gaussian.bounds;
    const result = fit.fitModel("gaussian", cases.gaussian.x, cases.gaussian.y, { start: cases.gaussian.start, lower: [null, null, b.low, null], upper: [null, null, b.high, null] });
    close(result.params[b.index], b.low, 1e-9, 1e-12, "width at its bound");
    closeParams(result.params, c.params, c.errors, "bounded params");
    close(chi2Of(result), c.chi2, 1e-6, 1e-15, "bounded chi2");
});

test("the Landau density equals TMath::Landau", () => {
    const d = cases.landau.density;
    d.v.forEach((v, i) => close(fit.landauDensity(v), d.value[i], 1e-9, 1e-15, `density at ${v}`));
});

test("the models refuse data outside their domain and too few points, and the guesses start near the data", () => {
    assert.equal(fit.fitModel("power", [0, 1, 2], [1, 2, 3]).ok, false);
    assert.equal(fit.fitModel("line", [1, 2], [1, 2]).ok, false);
    assert.equal(fit.fitModel("sine", [1, 2, 3], [1, 2, 3]).ok, false);
    assert.equal(fit.fitModel("gaussian", [1, 2, 3, 4, 5, 6], [1, NaN, 3, 2, 1, 0]).ok, false, "a value that is not finite is refused");
    assert.equal(fit.fitModel("line", [1, 2, Infinity, 4], [1, 2, 3, 4]).ok, false);
    const guessed = fit.fitModel("gaussian", cases.gaussian.x, cases.gaussian.y);
    assert.equal(guessed.ok, true);
    closeParams(guessed.params, cases.gaussian.fit.params, cases.gaussian.fit.errors, "gaussian from its own guess");
    const sine = fit.fitModel("sine", cases.sine.x, cases.sine.y);
    assert.equal(sine.ok, true);
    close(Math.abs(sine.params[1]), cases.sine.fit.params[1], 1e-3, 1e-12, "sine frequency from its own guess");
    assert.equal(fit.MODEL_NAMES.length, 8);
});

test("a histogram fit takes the mean of the model over each bin and Poisson errors, as the option I of TH1::Fit does", () => {
    const h = rootFits.weightedFitCases.histogram;
    const kept = h.counts.map((c, i) => i).filter((i) => h.counts[i] > 0);
    const x = kept.map((i) => (h.low[i] + h.high[i]) / 2);
    const y = kept.map((i) => h.counts[i]);
    const edges = { low: kept.map((i) => h.low[i]), high: kept.map((i) => h.high[i]) };
    const result = fit.fitModel("gaussian", x, y, { start: h.start, weights: y.map((c) => 1 / c), edges });
    assert.equal(result.ok, true);
    assert.equal(result.weighted, true);
    closeParams(result.params, h.fit.params, h.fit.errors, "histogram params");
    closeErrors(result.errors, h.fit.errors, 1e-3, "histogram errors");
    close(chi2Of(result), h.fit.chi2, 1e-6, 1e-15, "histogram chi2");
    assert.equal(result.dof, h.fit.ndf);
    assert.equal(x.length, h.included);
    const centred = fit.fitModel("gaussian", x, y, { start: h.start, weights: y.map((c) => 1 / c) });
    assert.ok(Math.abs(centred.params[0] - h.fit.params[0]) > 1e-3 * h.fit.params[0], "the model at the bin centres is not the mean over the bins");
});

test("the one-sigma band of a fitted curve equals ROOT's covariance transported through the gradient, for the sine and the line", () => {
    for (const [name, modelName, rel] of [["sine", "sine", 1e-3], ["line", "line", 1e-6]]) {
        const c = cases[name];
        const result = fit.fitModel(modelName, c.x, c.y, name === "sine" ? { start: c.start } : {});
        c.fit.band.x.forEach((xv, i) => close(fit.fitUncertaintyAt(modelName, result, xv), c.fit.band.sigma[i], rel, 1e-12, `${name} band at ${xv}`));
    }
    const e = cases.exponential;
    const exponential = fit.fitModel("exponential", e.x, e.y);
    assert.ok(Number.isFinite(fit.fitUncertaintyAt("exponential", exponential, 5)) && fit.fitUncertaintyAt("exponential", exponential, 5) > 0, "the exponential has a band now that it is fitted in y");
});
