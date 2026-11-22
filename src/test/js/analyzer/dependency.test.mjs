// The dependency routines of aa/dependency.js against SciPy and NumPy: the mutual information, the average-linkage clustering,
// the principal components and the multiple regression.
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";
import { reference, close, closeArray } from "./reference.mjs";

const dependency = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/dependency.js");

test("the mutual information equals the binned estimate of NumPy for the linear, the square and the independent pairs", () => {
    const cases = reference.mutualInformationCases;
    for (const c of cases.cases) {
        close(dependency.mutualInformation(c.x, c.y, cases.bins), c.value, 1e-9, 1e-15, c.name);
    }
    assert.equal(dependency.mutualInformation([1, 1, 1], [1, 2, 3], 4), null);
});

test("the average-linkage clustering gives the linkage rows and the leaf order of SciPy", () => {
    const c = reference.clusteringCases;
    const distances = c.correlationMatrix.map((row, i) => row.map((r, j) => (i === j ? 0 : 1 - Math.abs(r))));
    const result = dependency.averageLinkage(distances);
    assert.equal(result.linkage.length, c.linkage.length);
    result.linkage.forEach((row, k) => {
        assert.equal(row[0], c.linkage[k][0], `row ${k} first`);
        assert.equal(row[1], c.linkage[k][1], `row ${k} second`);
        close(row[2], c.linkage[k][2], 1e-9, 1e-15, `row ${k} distance`);
        assert.equal(row[3], c.linkage[k][3], `row ${k} size`);
    });
    assert.deepEqual(result.leaves, c.leaves);
});

test("the correlation distances are one minus the absolute correlation with zeros on the diagonal", () => {
    const distances = dependency.correlationDistances(reference.correlationCases.four);
    distances.forEach((row, i) => row.forEach((d, j) => close(d, i === j ? 0 : 1 - Math.abs(reference.correlationCases.correlationMatrix[i][j]), 1e-9, 1e-15, `${i}.${j}`)));
});

test("the principal components of standardised variables equal NumPy in eigenvalues, shares and components", () => {
    const c = reference.pcaCases;
    const result = dependency.principalComponents(c.columns);
    closeArray(result.eigenvalues, c.eigenvalues, 1e-9, "eigenvalues");
    closeArray(result.share, c.share, 1e-9, "share");
    result.components.forEach((component, k) => closeArray(component, c.components[k], 1e-8, `component ${k}`));
});

test("the multiple regression equals NumPy in coefficients, errors, standardised coefficients, R squared and residuals", () => {
    const c = reference.regressionCases;
    const result = dependency.multipleRegression(c.x, c.y);
    closeArray(result.params, c.params, 1e-9, "params");
    closeArray(result.errors, c.errors, 1e-9, "errors");
    closeArray(result.standardised, c.standardised, 1e-9, "standardised");
    close(result.rSquared, c.rSquared, 1e-9, 1e-15, "r squared");
    close(result.chi2PerDof, c.chi2PerDof, 1e-9, 1e-15, "chi2");
    closeArray(result.residuals, c.residuals, 1e-9, "residuals");
    assert.equal(result.dof, c.dof);
    assert.equal(dependency.multipleRegression([[1, 2, 3], [2, 4, 6]], [1, 2, 3]), null, "collinear columns are singular");
});
