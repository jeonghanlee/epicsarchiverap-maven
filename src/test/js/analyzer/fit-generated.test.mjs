// The fits, correlations and decompositions on signals of known parameters made with the seeded generators of the bundled D3:
// a line with noise, an exponential decay, a sine, a Gaussian, a Landau, two signals of known correlation and a matrix of known
// eigenvalues. Each routine returns the parameter it was made with within four standard errors, or the exact value.
import test from "node:test";
import assert from "node:assert/strict";
import { d3 } from "./load-d3.mjs";
import { close, closeArray } from "./reference.mjs";

const fit = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/fit.js");
const correlation = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/correlation.js");
const matrix = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/matrix.js");
const dependency = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/dependency.js");

const normal = (seed, sd) => d3.randomNormal.source(d3.randomLcg(seed))(0, sd);
const grid = (n, from, to) => Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));
const within = (actual, truth, error, what) => assert.ok(Math.abs(actual - truth) <= 4 * error, `${what}: ${actual} is more than 4 errors (${error}) from ${truth}`);

test("a line, an exponential decay and a logarithm with noise return their parameters within four errors", () => {
    const x = grid(100, 1, 20);
    const noise = normal(0.11, 0.3);
    const line = fit.fitModel("line", x, x.map((v) => 4 - 0.5 * v + noise()));
    within(line.params[0], 4, line.errors[0], "intercept");
    within(line.params[1], -0.5, line.errors[1], "slope");
    const decay = normal(0.12, 0.02);
    const exponential = fit.fitModel("exponential", x, x.map((v) => 5 * Math.exp(-0.2 * v) * Math.exp(decay())));
    within(exponential.params[0], 5, exponential.errors[0], "amplitude of the decay");
    within(exponential.params[1], -0.2, exponential.errors[1], "rate of the decay");
    const logNoise = normal(0.13, 0.1);
    const logarithm = fit.fitModel("logarithm", x, x.map((v) => 2 + 3 * Math.log(v) + logNoise()));
    within(logarithm.params[1], 3, logarithm.errors[1], "coefficient of the logarithm");
});

test("a sine, a Gaussian and a Landau with noise return their parameters within four errors from the model's own guess", () => {
    const x = grid(300, 0, 30);
    const sineNoise = normal(0.21, 0.1);
    const sine = fit.fitModel("sine", x, x.map((v) => 1.5 * Math.sin(2 * Math.PI * 0.2 * v + 0.4) + 2 + sineNoise()));
    assert.equal(sine.converged, true);
    within(Math.abs(sine.params[0]), 1.5, sine.errors[0], "amplitude");
    within(Math.abs(sine.params[1]), 0.2, sine.errors[1], "frequency");
    within(sine.params[3], 2, sine.errors[3], "offset");
    const gaussNoise = normal(0.22, 0.05);
    const gaussian = fit.fitModel("gaussian", x, x.map((v) => 3 * Math.exp(-((v - 12) ** 2) / (2 * 2 * 2)) + 0.5 + gaussNoise()));
    [3, 12, 2, 0.5].forEach((truth, k) => within(gaussian.params[k], truth, gaussian.errors[k], `gaussian ${k}`));
    const landauNoise = normal(0.23, 0.02);
    const landau = fit.fitModel("landau", x, x.map((v) => (20 * fit.landauDensity((v - 8) / 1.5)) / 1.5 + 0.1 + landauNoise()));
    [20, 8, 1.5, 0.1].forEach((truth, k) => within(landau.params[k], truth, landau.errors[k], `landau ${k}`));
});

test("two signals of known correlation return it within four standard errors, and Spearman agrees in sign and size", () => {
    const a = normal(0.31, 1);
    const b = normal(0.32, 1);
    const rho = 0.7;
    const x = Array.from({ length: 4000 }, () => a());
    const y = x.map((v) => rho * v + Math.sqrt(1 - rho * rho) * b());
    const result = correlation.pearson(x, y);
    const error = (1 - rho * rho) / Math.sqrt(x.length);
    within(result.r, rho, error, "Pearson r");
    assert.ok(result.p < 1e-6);
    const rank = correlation.spearman(x, y);
    assert.ok(Math.abs(rank.rho - rho) < 0.05, `Spearman ${rank.rho}`);
    const target = x.map((v, i) => 2 * v - y[i] + 1 + 0.1 * b());
    const regression = dependency.multipleRegression([x, y], target);
    [1, 2, -1].forEach((truth, k) => within(regression.params[k], truth, regression.errors[k], `coefficient ${k}`));
});

test("a matrix built from known eigenvalues returns them, and its inverse and Cholesky factor are consistent", () => {
    const values = [0.5, 2, 3.5];
    const angle = 0.7;
    const q = [[Math.cos(angle), -Math.sin(angle), 0], [Math.sin(angle), Math.cos(angle), 0], [0, 0, 1]];
    const d = values.map((v, i) => values.map((_, j) => (i === j ? v : 0)));
    const a = matrix.multiply(matrix.multiply(q, d), matrix.transpose(q));
    const eigen = matrix.symmetricEigen(a);
    closeArray(eigen.values, values, 1e-9, "eigenvalues");
    const identity = matrix.multiply(a, matrix.invert(a));
    identity.forEach((row, i) => row.forEach((v, j) => close(v, i === j ? 1 : 0, 1e-9, 1e-9, `identity ${i}.${j}`)));
    const l = matrix.cholesky(a);
    matrix.multiply(l, matrix.transpose(l)).forEach((row, i) => closeArray(row, a[i], 1e-9, `cholesky ${i}`));
    const pca = dependency.principalComponents([grid(50, 0, 1), grid(50, 0, 1).map((v) => 2 * v + 1), grid(50, 0, 1).map((v, i) => (i % 2 ? 1 : -1))]);
    assert.ok(Math.abs(pca.eigenvalues[0] - 2) < 0.01 && Math.abs(pca.eigenvalues[2]) < 1e-9, `two identical directions share one component and leave one empty: ${pca.eigenvalues}`);
});
