// The reference values of the tools of two and several signals, checked for what the routines will be compared against: the fits
// that ROOT makes (root_fits.C, root-fits.json) recover the parameters each fixed dataset was made with within four standard
// errors and hold their fixed and bounded parameters, and the matrix, correlation, component and clustering values
// (generate-references.py) have the properties the routines must reproduce. The routines themselves are checked in their own files.
import test from "node:test";
import assert from "node:assert/strict";
import { reference, rootFits, close, closeArray } from "./reference.mjs";

const fits = rootFits.fitCases;
const within = (actual, truth, error, what, k = 4) => assert.ok(Math.abs(actual - truth) <= k * error, `${what}: ${actual} is more than ${k} errors (${error}) from ${truth}`);

test("the fits of ROOT recover the parameters of every model within four errors, with the status 0 and a free parameter for each start value", () => {
    for (const name of ["line", "polynomial2", "exponential", "power", "logarithm", "sine", "gaussian", "landau"]) {
        const c = fits[name];
        assert.equal(c.fit.status, 0, `${name}: status`);
        assert.equal(c.fit.params.length, c.start.length);
        c.fit.params.forEach((p, i) => within(p, c.truth[i], c.fit.errors[i], `${name}[${i}]`));
        assert.equal(c.fit.ndf, c.x.length - c.fit.params.length);
        assert.ok(c.fit.rSquared > 0.9 && c.fit.rSquared <= 1, `${name}: R squared ${c.fit.rSquared}`);
    }
});

test("the histogram fit of ROOT leaves the empty bins out and recovers the mean and the width of the draws within four errors", () => {
    const h = rootFits.weightedFitCases.histogram;
    assert.equal(h.included, h.counts.filter((c) => c > 0).length);
    assert.equal(h.fit.ndf, h.included - h.fit.params.length);
    assert.equal(h.fit.status, 0);
    within(h.fit.params[1], 10.0, h.fit.errors[1], "mean");
    within(h.fit.params[2], 2.0, h.fit.errors[2], "width");
});

test("a fixed parameter keeps its value and has no error; a bounded parameter stops at its bound", () => {
    const fixed = fits.sine.fixedOffset;
    assert.equal(fixed.params[3], 1.0);
    assert.equal(fixed.errors[3], 0);
    assert.equal(fixed.ndf, fits.sine.x.length - 3);
    const bounded = fits.gaussian.boundedWidth;
    // Minuit2 keeps a bounded parameter inside its limits through a sine transformation; the refined fit ends on the bound to rounding.
    close(bounded.params[fits.gaussian.bounds.index], fits.gaussian.bounds.low, 1e-12, 1e-12, "bounded width");
    assert.ok(bounded.chi2 > fits.gaussian.fit.chi2, "a constrained fit cannot do better than the free one");
});

test("the Landau density of the reference is the CERNLIB density: positive, peaking near -0.22 and integrating to about one", () => {
    const d = fits.landau.density;
    const peak = d.v[d.value.indexOf(Math.max(...d.value))];
    assert.ok(Math.abs(peak - -0.22) < 0.6, `peak at ${peak}`);
    assert.ok(d.value.every((v) => v > 0));
    const step = d.v[1] - d.v[0];
    const integral = d.value.reduce((s, v) => s + v * step, 0);
    assert.ok(integral > 0.85 && integral < 1.0, `integral over the sampled range ${integral}`);
});

test("the correlation values are consistent: Pearson between -1 and 1, a symmetric matrix with ones, the partial correlation symmetric", () => {
    const c = reference.correlationCases;
    assert.ok(Math.abs(c.pearson.r) <= 1 && c.pearson.p >= 0 && c.pearson.p <= 1);
    assert.ok(Math.abs(c.spearman.rho) <= 1);
    assert.equal(c.cross.length, c.lags.length);
    assert.equal(c.cross[c.lags.indexOf(3)], Math.max(...c.cross), "the lag of the shifted copy carries the largest cross-correlation");
    for (let i = 0; i < 4; i += 1) {
        close(c.correlationMatrix[i][i], 1, 1e-12, 1e-12, "diagonal");
        close(c.partialCorrelation[i][i], 1, 1e-12, 1e-12, "partial diagonal");
        for (let j = 0; j < 4; j += 1) {
            close(c.correlationMatrix[i][j], c.correlationMatrix[j][i], 1e-12, 1e-12, "symmetry");
            close(c.partialCorrelation[i][j], c.partialCorrelation[j][i], 1e-12, 1e-12, "partial symmetry");
        }
    }
});

test("the regression recovers its coefficients within four errors and its residuals sum to zero", () => {
    const r = reference.regressionCases;
    r.params.forEach((p, i) => within(p, r.truth[i], r.errors[i], `coefficient ${i}`));
    assert.equal(r.standardised.length, 3);
    close(r.residuals.reduce((s, v) => s + v, 0), 0, 1e-9, 1e-9, "sum of residuals");
});

test("the principal components of standardised variables: the eigenvalues add up to the number of variables and the components are orthonormal", () => {
    const p = reference.pcaCases;
    close(p.eigenvalues.reduce((s, v) => s + v, 0), 4, 1e-9, 1e-12, "trace");
    assert.ok(p.eigenvalues.every((v, i) => i === 0 || v <= p.eigenvalues[i - 1]), "descending");
    for (let a = 0; a < 4; a += 1) {
        for (let b = 0; b < 4; b += 1) {
            const dot = p.components[a].reduce((s, v, k) => s + v * p.components[b][k], 0);
            close(dot, a === b ? 1 : 0, 1e-9, 1e-9, `component ${a}.${b}`);
        }
        assert.ok(p.components[a][p.components[a].map(Math.abs).indexOf(Math.max(...p.components[a].map(Math.abs)))] > 0, "largest element positive");
    }
});

test("the mutual information is largest for the square relation, then the linear one, and smallest for independent variables", () => {
    const [linear, square, independent] = reference.mutualInformationCases.cases.map((c) => c.value);
    assert.ok(square > linear && linear > independent && independent >= 0, `${square} ${linear} ${independent}`);
});

test("the clustering leaves are a permutation that keeps the correlated pairs together", () => {
    const c = reference.clusteringCases;
    assert.deepEqual([...c.leaves].sort(), [0, 1, 2, 3, 4, 5]);
    const position = (i) => c.leaves.indexOf(i);
    assert.ok(Math.abs(position(0) - position(1)) <= 2 && Math.abs(position(3) - position(4)) === 1, `leaves ${c.leaves}`);
    assert.equal(c.linkage.length, 5);
});

test("the matrix references hold: inverse times the matrix is the identity, the Cholesky factor rebuilds the matrix, the solution solves the system", () => {
    const m = reference.matrixCases;
    const mul = (a, b) => a.map((row) => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)));
    const identity = mul(m.spd, m.inverse);
    for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) close(identity[i][j], i === j ? 1 : 0, 1e-9, 1e-9, `identity ${i}.${j}`);
    const lt = m.cholesky[0].map((_, j) => m.cholesky.map((row) => row[j]));
    const rebuilt = mul(m.cholesky, lt);
    for (let i = 0; i < 4; i += 1) closeArray(rebuilt[i], m.spd[i], 1e-9, `cholesky row ${i}`);
    const applied = m.spd.map((row) => row.reduce((s, v, k) => s + v * m.solution[k], 0));
    closeArray(applied, m.rhs, 1e-9, "solution");
    const generalIdentity = mul(m.general, m.generalInverse);
    for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) close(generalIdentity[i][j], i === j ? 1 : 0, 1e-9, 1e-9, `general ${i}.${j}`);
});
