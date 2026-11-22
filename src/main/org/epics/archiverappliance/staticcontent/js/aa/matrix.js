// Small dense matrices for the analyzer routines: products, the transpose, the inverse and the solution of a system by
// Gauss-Jordan elimination with partial pivoting, the Cholesky factor of a symmetric positive definite matrix, and the eigen
// decomposition of a symmetric matrix by Jacobi rotations. A matrix is an array of rows (arrays of numbers); a vector is an
// array of numbers. The routines never change their arguments. The bundled D3 has none of these.

const JACOBI_SWEEPS_MOST = 100;
const JACOBI_OFF_DIAGONAL_LEAST = 1e-300;

/** The n by n identity matrix. */
export function identity(n) {
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)));
}

/** The transpose of a matrix. */
export function transpose(a) {
    return a.length ? a[0].map((_, j) => a.map((row) => row[j])) : [];
}

/** The product of two matrices; null when the shapes do not fit. */
export function multiply(a, b) {
    if (!a.length || !b.length || a[0].length !== b.length) {
        return null;
    }
    return a.map((row) => b[0].map((_, j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)));
}

/** A matrix applied to a vector; null when the shapes do not fit. */
export function apply(a, v) {
    if (!a.length || a[0].length !== v.length) {
        return null;
    }
    return a.map((row) => row.reduce((sum, value, k) => sum + value * v[k], 0));
}

/**
 * Gauss-Jordan elimination with partial pivoting of [a | right], where right is a matrix with as many rows as a. Returns the
 * columns of right transformed, or null when a is singular (a pivot smaller than tolerance times the largest entry of a).
 */
function eliminate(a, right, tolerance) {
    const n = a.length;
    const m = a.map((row, i) => [...row, ...right[i]]);
    let largest = 0;
    for (const row of a) for (const value of row) largest = Math.max(largest, Math.abs(value));
    for (let column = 0; column < n; column += 1) {
        let pivot = column;
        for (let r = column + 1; r < n; r += 1) if (Math.abs(m[r][column]) > Math.abs(m[pivot][column])) pivot = r;
        if (!(Math.abs(m[pivot][column]) > tolerance * largest)) {
            return null;
        }
        [m[column], m[pivot]] = [m[pivot], m[column]];
        const lead = m[column][column];
        for (let c = 0; c < m[column].length; c += 1) m[column][c] /= lead;
        for (let r = 0; r < n; r += 1) {
            if (r === column) continue;
            const factor = m[r][column];
            if (factor === 0) continue;
            for (let c = 0; c < m[r].length; c += 1) m[r][c] -= factor * m[column][c];
        }
    }
    return m.map((row) => row.slice(n));
}

/** The inverse of a square matrix, or null when it is singular. */
export function invert(a, tolerance = 1e-14) {
    if (!a.length || a.some((row) => row.length !== a.length)) {
        return null;
    }
    return eliminate(a, identity(a.length), tolerance);
}

/** The solution x of a x = b for a square a and a vector b, or null when a is singular. */
export function solve(a, b, tolerance = 1e-14) {
    if (!a.length || a.length !== b.length || a.some((row) => row.length !== a.length)) {
        return null;
    }
    const result = eliminate(a, b.map((value) => [value]), tolerance);
    return result ? result.map((row) => row[0]) : null;
}

/** The lower triangular Cholesky factor L with L times its transpose equal to a; null when a is not positive definite. */
export function cholesky(a) {
    const n = a.length;
    const l = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j <= i; j += 1) {
            let sum = a[i][j];
            for (let k = 0; k < j; k += 1) sum -= l[i][k] * l[j][k];
            if (i === j) {
                if (!(sum > 0)) {
                    return null;
                }
                l[i][i] = Math.sqrt(sum);
            } else {
                l[i][j] = sum / l[j][j];
            }
        }
    }
    return l;
}

/**
 * The eigenvalues and eigenvectors of a symmetric matrix by cyclic Jacobi rotations: {values, vectors} with the values in
 * ascending order and vectors[k] the unit eigenvector of values[k], its largest element positive (the sign convention of the
 * reference values). Null for a matrix that is not square and symmetric.
 */
export function symmetricEigen(input) {
    const n = input.length;
    if (!n || input.some((row, i) => row.length !== n || row.some((value, j) => Math.abs(value - input[j][i]) > 1e-12 * (1 + Math.abs(value))))) {
        return null;
    }
    const a = input.map((row) => [...row]);
    const v = identity(n);
    for (let sweep = 0; sweep < JACOBI_SWEEPS_MOST; sweep += 1) {
        let off = 0;
        for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) off += a[p][q] * a[p][q];
        if (off < JACOBI_OFF_DIAGONAL_LEAST) break;
        for (let p = 0; p < n; p += 1) {
            for (let q = p + 1; q < n; q += 1) {
                if (a[p][q] === 0) continue;
                const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
                const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
                const c = 1 / Math.sqrt(t * t + 1);
                const s = t * c;
                for (let k = 0; k < n; k += 1) {
                    const akp = a[k][p];
                    const akq = a[k][q];
                    a[k][p] = c * akp - s * akq;
                    a[k][q] = s * akp + c * akq;
                }
                for (let k = 0; k < n; k += 1) {
                    const apk = a[p][k];
                    const aqk = a[q][k];
                    a[p][k] = c * apk - s * aqk;
                    a[q][k] = s * apk + c * aqk;
                }
                for (let k = 0; k < n; k += 1) {
                    const vkp = v[k][p];
                    const vkq = v[k][q];
                    v[k][p] = c * vkp - s * vkq;
                    v[k][q] = s * vkp + c * vkq;
                }
            }
        }
    }
    const order = a.map((_, i) => i).sort((i, j) => a[i][i] - a[j][j]);
    const values = order.map((i) => a[i][i]);
    const vectors = order.map((i) => {
        const vector = v.map((row) => row[i]);
        const largest = vector.reduce((best, value, k) => (Math.abs(value) > Math.abs(vector[best]) ? k : best), 0);
        return vector[largest] < 0 ? vector.map((value) => -value) : vector;
    });
    return { values, vectors };
}
