// The fits of aa/fit.js against SciPy and NumPy: the linear models by least squares, the transformed models, the iterative
// models by Levenberg-Marquardt from the same start values as SciPy curve_fit, a fixed and a bounded parameter, and the Landau
// density against SciPy's landau.pdf at the location log(pi/2) and the scale pi/2.
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";
import { reference, close, closeArray } from "./reference.mjs";

const fit = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/fit.js");
const cases = reference.fitCases;

/** Each parameter within 1e-6 relative of SciPy's, or within a tenth of its standard error, whichever is larger. */
function closeParams(actual, expected, errors, what) {
    actual.forEach((value, k) => {
        const allowed = Math.max(1e-6 * Math.abs(expected[k]), 0.1 * errors[k]);
        assert.ok(Math.abs(value - expected[k]) <= allowed, `${what}[${k}]: ${value} differs from ${expected[k]} by more than ${allowed}`);
    });
}

test("the line, the polynomial and the logarithm equal the NumPy least squares in parameters, errors, chi-square per degree of freedom and R squared", () => {
    for (const [name, modelName] of [["line", "line"], ["polynomial2", "polynomial"], ["logarithm", "logarithm"]]) {
        const c = cases[name];
        const result = fit.fitModel(modelName, c.x, c.y);
        assert.equal(result.ok, true, name);
        closeArray(result.params, c.fit.params, 1e-9, `${name} params`);
        closeArray(result.errors, c.fit.errors, 1e-9, `${name} errors`);
        close(result.chi2PerDof, c.fit.chi2PerDof, 1e-9, 1e-15, `${name} chi2`);
        close(result.rSquared, c.fit.rSquared, 1e-9, 1e-15, `${name} r2`);
        assert.equal(result.dof, c.fit.dof);
    }
});

test("the exponential and the power model fit the transformed y and give the natural parameters with their errors", () => {
    for (const [name, modelName] of [["exponential", "exponential"], ["power", "power"]]) {
        const c = cases[name];
        const result = fit.fitModel(modelName, c.x, c.y);
        assert.equal(result.ok, true, name);
        closeArray(result.transformed.params, c.transformed.params, 1e-9, `${name} transformed params`);
        closeArray(result.transformed.errors, c.transformed.errors, 1e-9, `${name} transformed errors`);
        close(result.params[0], Math.exp(c.transformed.params[0]), 1e-9, 1e-15, `${name} a`);
        close(result.params[1], c.transformed.params[1], 1e-9, 1e-15, `${name} b`);
        close(result.errors[0], Math.exp(c.transformed.params[0]) * c.transformed.errors[0], 1e-9, 1e-15, `${name} error of a`);
        close(result.chi2PerDof, c.transformed.chi2PerDof, 1e-9, 1e-15, `${name} chi2`);
    }
});

test("the sine, the Gaussian and the Landau fits from the start values of SciPy reach its parameters and errors", () => {
    for (const name of ["sine", "gaussian", "landau"]) {
        const c = cases[name];
        const result = fit.fitModel(name, c.x, c.y, { start: c.p0 });
        assert.equal(result.ok, true, name);
        assert.equal(result.converged, true, `${name} converged`);
        closeParams(result.params, c.fit.params, c.fit.errors, `${name} params`);
        closeArray(result.errors, c.fit.errors, 1e-6, `${name} errors`);
        close(result.chi2PerDof, c.fit.chi2PerDof, 1e-6, 1e-15, `${name} chi2`);
        close(result.rSquared, c.fit.rSquared, 1e-6, 1e-15, `${name} r2`);
        assert.equal(result.dof, c.fit.dof);
    }
});

test("a fixed parameter keeps its start value and is left out of the errors; the others equal SciPy's constrained fit", () => {
    const c = cases.sine.fixedOffset;
    const result = fit.fitModel("sine", cases.sine.x, cases.sine.y, { start: [1.5, 0.14, 0.5, 1.0], fixed: [3] });
    assert.equal(result.params[3], 1.0);
    assert.deepEqual(result.free, c.free);
    closeParams(result.free.map((k) => result.params[k]), c.free.map((k) => c.params[k]), c.errors, "fixed-offset params");
    closeArray(result.errors, c.errors, 1e-6, "fixed-offset errors");
    close(result.chi2PerDof, c.chi2PerDof, 1e-6, 1e-15, "fixed-offset chi2");
});

test("a bounded parameter stops at its bound and the other parameters and the errors equal SciPy's bounded fit", () => {
    const c = cases.gaussian.boundedWidth;
    const result = fit.fitModel("gaussian", cases.gaussian.x, cases.gaussian.y, { start: [3.0, 4.5, 2.0, 0.0], lower: [0, null, 1.8, null], upper: [null, null, 3.0, null] });
    close(result.params[2], 1.8, 1e-9, 1e-12, "width at its bound");
    closeParams(result.params, c.params, c.errors, "bounded params");
    closeArray(result.errors, c.errors, 1e-6, "bounded errors");
    close(result.chi2PerDof, c.chi2PerDof, 1e-6, 1e-15, "bounded chi2");
});

test("the Landau density equals SciPy's landau.pdf at the location log(pi/2) and the scale pi/2", () => {
    const d = cases.landau.density;
    d.v.forEach((v, i) => close(fit.landauDensity(v), d.value[i], 2e-8, 1e-12, `density at ${v}`));
});

test("the models refuse data outside their domain and too few points, and the guesses start near the data", () => {
    assert.equal(fit.fitModel("power", [0, 1, 2], [1, 2, 3]).ok, false);
    assert.equal(fit.fitModel("exponential", [1, 2, 3], [1, -2, 3]).ok, false);
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

test("a weighted fit of a histogram (Poisson weights, empty bins left out) equals SciPy curve_fit with absolute errors", () => {
    const h = reference.weightedFitCases.histogram;
    const kept = h.counts.map((c, i) => i).filter((i) => h.counts[i] > 0);
    const x = kept.map((i) => h.centres[i]);
    const y = kept.map((i) => h.counts[i]);
    const weights = y.map((c) => 1 / c);
    const result = fit.fitModel("gaussian", x, y, { start: h.p0, weights });
    assert.equal(result.ok, true);
    assert.equal(result.weighted, true);
    closeParams(result.params, h.params, h.errors, "weighted params");
    closeArray(result.errors, h.errors, 1e-6, "weighted errors");
    close(result.chi2PerDof, h.chi2PerDof, 1e-6, 1e-15, "weighted chi2 per dof");
    assert.equal(result.dof, h.dof);
    assert.equal(x.length, h.included);
});

test("the one-sigma band of a fitted curve equals the covariance transported through the gradient, for the sine and the line", () => {
    const s = cases.sine;
    const sineFit = fit.fitModel("sine", s.x, s.y, { start: s.p0 });
    s.band.x.forEach((xv, i) => close(fit.fitUncertaintyAt("sine", sineFit, xv), s.band.sigma[i], 1e-5, 1e-12, `sine band at ${xv}`));
    const l = cases.line;
    const lineFit = fit.fitModel("line", l.x, l.y);
    l.band.x.forEach((xv, i) => close(fit.fitUncertaintyAt("line", lineFit, xv), l.band.sigma[i], 1e-6, 1e-12, `line band at ${xv}`));
    assert.ok(Number.isNaN(fit.fitUncertaintyAt("exponential", fit.fitModel("exponential", cases.exponential.x, cases.exponential.y), 1)), "no band for a model fitted in a transformed variable");
});
