// The matrix routines of aa/matrix.js against NumPy: the inverse, the solution, the Cholesky factor and the eigen decomposition
// of the matrices of the reference file, and the refusals of a singular or indefinite matrix.
import test from "node:test";
import assert from "node:assert/strict";
import { reference, close, closeArray } from "./reference.mjs";

const matrix = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/matrix.js");
const ref = reference.matrixCases;

test("the inverse of the symmetric and of the general matrix equal NumPy", () => {
    const spd = matrix.invert(ref.spd);
    spd.forEach((row, i) => closeArray(row, ref.inverse[i], 1e-9, `spd row ${i}`));
    const general = matrix.invert(ref.general);
    general.forEach((row, i) => closeArray(row, ref.generalInverse[i], 1e-9, `general row ${i}`));
});

test("the solution of the system equals NumPy and solves it", () => {
    const x = matrix.solve(ref.spd, ref.rhs);
    closeArray(x, ref.solution, 1e-9, "solution");
    closeArray(matrix.apply(ref.spd, x), ref.rhs, 1e-9, "applied");
});

test("the Cholesky factor equals NumPy and rebuilds the matrix", () => {
    const l = matrix.cholesky(ref.spd);
    l.forEach((row, i) => closeArray(row, ref.cholesky[i], 1e-9, `row ${i}`));
    matrix.multiply(l, matrix.transpose(l)).forEach((row, i) => closeArray(row, ref.spd[i], 1e-9, `rebuilt row ${i}`));
});

test("the eigenvalues and eigenvectors of the symmetric matrix equal NumPy, ascending with the largest element of each vector positive", () => {
    const { values, vectors } = matrix.symmetricEigen(ref.spd);
    closeArray(values, ref.eigenvalues, 1e-9, "eigenvalues");
    vectors.forEach((vector, k) => closeArray(vector, ref.eigenvectors[k], 1e-8, `vector ${k}`));
    vectors.forEach((vector, k) => closeArray(matrix.apply(ref.spd, vector), vector.map((v) => v * values[k]), 1e-9, `A v = lambda v for ${k}`));
});

test("a singular matrix has no inverse and no solution, an indefinite matrix no Cholesky factor, a non-symmetric matrix no eigen decomposition", () => {
    const singular = [[1, 2], [2, 4]];
    assert.equal(matrix.invert(singular), null);
    assert.equal(matrix.solve(singular, [1, 2]), null);
    assert.equal(matrix.cholesky([[1, 2], [2, 1]]), null);
    assert.equal(matrix.symmetricEigen(ref.general), null);
    assert.equal(matrix.multiply([[1, 2]], [[1, 2]]), null);
});

test("the identity, the transpose and the product behave on small cases", () => {
    assert.deepEqual(matrix.identity(2), [[1, 0], [0, 1]]);
    assert.deepEqual(matrix.transpose([[1, 2, 3], [4, 5, 6]]), [[1, 4], [2, 5], [3, 6]]);
    assert.deepEqual(matrix.multiply([[1, 2], [3, 4]], [[5], [6]]), [[17], [39]]);
    close(matrix.apply([[1, 2], [3, 4]], [1, 1])[1], 7, 1e-12, 1e-12, "apply");
});

test("a matrix whose first pivot is zero is still inverted and solved (partial pivoting)", () => {
    const swapped = [[0, 1, 2], [1, 0, 3], [4, 5, 0]];
    const inverse = matrix.invert(swapped);
    assert.ok(inverse && inverse.every((row) => row.every(Number.isFinite)), "inverse exists");
    matrix.multiply(swapped, inverse).forEach((row, i) => row.forEach((v, j) => close(v, i === j ? 1 : 0, 1e-9, 1e-9, `identity ${i}.${j}`)));
    closeArray(matrix.apply(swapped, matrix.solve(swapped, [1, 2, 3])), [1, 2, 3], 1e-9, "solution");
});

test("every eigenvector is returned with its largest element positive, whatever sign the rotations produce", () => {
    const seeds = [[[2, -1, 0], [-1, 2, -1], [0, -1, 2]], [[4, -2, 1], [-2, 5, -3], [1, -3, 6]], [[1, -0.9], [-0.9, 1]], [[3, 1, -2, 0], [1, 2, 0, -1], [-2, 0, 4, 1], [0, -1, 1, 2]]];
    for (const a of seeds) {
        const { values, vectors } = matrix.symmetricEigen(a);
        vectors.forEach((vector, k) => {
            const largest = vector.reduce((best, v, i) => (Math.abs(v) > Math.abs(vector[best]) ? i : best), 0);
            assert.ok(vector[largest] > 0, `vector ${k} of ${JSON.stringify(a)}: ${vector}`);
            closeArray(matrix.apply(a, vector), vector.map((v) => v * values[k]), 1e-9, `A v = lambda v`);
        });
    }
});

