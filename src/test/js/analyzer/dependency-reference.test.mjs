// The reference values of the tools of two and several signals (generate-references.py), checked for what the routines will be
// compared against: each fixed dataset recovers the parameters it was made with within four standard errors, the fixed and
// bounded fits hold their constraints, and the matrix, correlation, component and clustering values have the properties the
// routines must reproduce. The routines themselves are checked in their own files.
import test from "node:test";
import assert from "node:assert/strict";
import { reference, close, closeArray } from "./reference.mjs";

const fits = reference.fitCases;
const within = (actual, truth, error, what, k = 4) => assert.ok(Math.abs(actual - truth) <= k * error, `${what}: ${actual} is more than ${k} errors (${error}) from ${truth}`);

test("the linear fits recover the parameters of the line, the polynomial and the logarithm within four errors", () => {
    for (const name of ["line", "polynomial2", "logarithm"]) {
        const c = fits[name];
        c.fit.params.forEach((p, i) => within(p, c.truth[i], c.fit.errors[i], `${name}[${i}]`));
        assert.equal(c.fit.dof, c.x.length - c.fit.params.length);
        assert.ok(c.fit.rSquared > 0.9 && c.fit.rSquared <= 1);
    }
});

test("the exponential and power fits recover their natural parameters through the transformed fit", () => {
    for (const name of ["exponential", "power"]) {
        const c = fits[name];
        const [c0, c1] = c.transformed.params;
        const [e0, e1] = c.transformed.errors;
        within(Math.exp(c0), c.truth[0], Math.exp(c0) * e0, `${name} a`);
        within(c1, c.truth[1], e1, `${name} b`);
    }
});

test("the iterative fits recover the sine, the Gaussian and the Landau parameters within four errors", () => {
    for (const name of ["sine", "gaussian", "landau"]) {
        const c = fits[name];
        c.fit.free.forEach((index, j) => within(c.fit.params[index], c.truth[index], c.fit.errors[j], `${name}[${index}]`));
        assert.equal(c.fit.free.length, c.p0.length);
    }
});

test("a fixed parameter keeps its value and is left out of the errors; a bounded parameter stops at its bound", () => {
    const fixed = fits.sine.fixedOffset;
    assert.equal(fixed.params[3], 1.0);
    assert.deepEqual(fixed.free, [0, 1, 2]);
    assert.equal(fixed.errors.length, 3);
    const bounded = fits.gaussian.boundedWidth;
    close(bounded.params[2], 1.8, 1e-9, 1e-12, "bounded width");
    assert.ok(bounded.chi2PerDof > fits.gaussian.fit.chi2PerDof, "a constrained fit cannot do better than the free one");
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
