// The dependency tools of the analyzer for several signals: the mutual information of two variables (the binned plug-in
// estimate in nats), hierarchical clustering with average linkage on the distance one minus the absolute correlation (the
// linkage rows and the order of the leaves of SciPy), the principal components of standardised variables, and the multiple
// linear regression with standardised coefficients. Inputs are columns, arrays of finite numbers of equal length. The bundled
// D3 has none of these.
import { linearLeastSquares } from "./fit.js";
import { symmetricEigen } from "./matrix.js";
import { correlationMatrix } from "./correlation.js";

/** The mean and the sample standard deviation of an array. */
function spread(values) {
    const m = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
    return { mean: m, sd: Math.sqrt(variance) };
}

/**
 * The mutual information of x and y in nats, the plug-in estimate over bins equal-width bins of each variable's range (a value
 * at the top of the range falls in the last bin, as np.histogram2d counts it). Null for fewer than two pairs or a variable
 * without spread.
 */
export function mutualInformation(x, y, bins) {
    const n = Math.min(x.length, y.length);
    if (n < 2 || !(bins >= 2)) return null;
    // A loop, not Math.min(...values): a spread of more than about a hundred thousand values overflows the call stack.
    const range = (values) => { let low = Infinity; let high = -Infinity; for (const v of values) { if (v < low) low = v; if (v > high) high = v; } return [low, high]; };
    const [x0, x1] = range(x.slice(0, n));
    const [y0, y1] = range(y.slice(0, n));
    if (!(x1 > x0 && y1 > y0)) return null;
    const index = (v, low, high) => Math.min(bins - 1, Math.floor(((v - low) / (high - low)) * bins));
    const joint = Array.from({ length: bins }, () => new Array(bins).fill(0));
    for (let i = 0; i < n; i += 1) joint[index(x[i], x0, x1)][index(y[i], y0, y1)] += 1;
    const px = joint.map((row) => row.reduce((s, v) => s + v, 0) / n);
    const py = joint[0].map((_, j) => joint.reduce((s, row) => s + row[j], 0) / n);
    let information = 0;
    for (let i = 0; i < bins; i += 1) {
        for (let j = 0; j < bins; j += 1) {
            const p = joint[i][j] / n;
            if (p > 0) information += p * Math.log(p / (px[i] * py[j]));
        }
    }
    return information;
}

/**
 * Hierarchical clustering with average linkage of the items whose distances the symmetric matrix holds: the linkage rows of
 * SciPy ([lower cluster, higher cluster, distance, size], new clusters numbered from n) and the order of the leaves of the
 * dendrogram. Null for fewer than two items.
 */
export function averageLinkage(distances) {
    const n = distances.length;
    if (n < 2) return null;
    const clusters = new Map();
    for (let i = 0; i < n; i += 1) clusters.set(i, { size: 1, members: [i], leaves: [i] });
    const between = new Map();
    const key = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) between.set(key(i, j), distances[i][j]);
    const linkage = [];
    let next = n;
    while (clusters.size > 1) {
        const ids = [...clusters.keys()];
        let best = null;
        for (let a = 0; a < ids.length; a += 1) {
            for (let b = a + 1; b < ids.length; b += 1) {
                const d = between.get(key(ids[a], ids[b]));
                if (best === null || d < best.d) best = { i: Math.min(ids[a], ids[b]), j: Math.max(ids[a], ids[b]), d };
            }
        }
        const ci = clusters.get(best.i);
        const cj = clusters.get(best.j);
        const merged = { size: ci.size + cj.size, members: [...ci.members, ...cj.members], leaves: [...ci.leaves, ...cj.leaves] };
        linkage.push([best.i, best.j, best.d, merged.size]);
        for (const other of clusters.keys()) {
            if (other === best.i || other === best.j) continue;
            const di = between.get(key(best.i, other));
            const dj = between.get(key(best.j, other));
            between.set(key(next, other), (di * ci.size + dj * cj.size) / merged.size);
        }
        clusters.delete(best.i);
        clusters.delete(best.j);
        clusters.set(next, merged);
        next += 1;
    }
    return { linkage, leaves: clusters.values().next().value.leaves };
}

/** The distance matrix one minus the absolute correlation of the columns, zero on the diagonal. */
export function correlationDistances(columns) {
    return correlationMatrix(columns).map((row, i) => row.map((r, j) => (i === j ? 0 : 1 - Math.abs(r))));
}

/**
 * The principal components of the standardised columns: the eigenvalues of their correlation matrix in descending order, the
 * share of the variance of each, and the components (unit eigenvectors, the largest element of each positive). Null when a
 * column has no spread.
 */
export function principalComponents(columns) {
    const corr = correlationMatrix(columns);
    if (corr.some((row) => row.some((v) => !Number.isFinite(v)))) return null;
    const eigen = symmetricEigen(corr);
    if (!eigen) return null;
    const order = eigen.values.map((_, k) => k).sort((a, b) => eigen.values[b] - eigen.values[a]);
    const values = order.map((k) => eigen.values[k]);
    const total = values.reduce((s, v) => s + v, 0);
    return { eigenvalues: values, share: values.map((v) => v / total), components: order.map((k) => eigen.vectors[k]) };
}

/**
 * The multiple linear regression of y on the columns with an intercept: the coefficients (the intercept first), their errors,
 * the standardised coefficients (each times the standard deviation of its column over that of y), R squared, the chi-square
 * per degree of freedom, the degrees of freedom and the residuals. Null when the system is singular or has no degree of freedom.
 */
export function multipleRegression(columns, y) {
    const n = y.length;
    const design = y.map((_, i) => [1, ...columns.map((column) => column[i])]);
    const fit = linearLeastSquares(design, y);
    if (!fit) return null;
    const sy = spread(y).sd;
    const standardised = columns.map((column, k) => (fit.params[k + 1] * spread(column).sd) / sy);
    const residuals = y.map((v, i) => v - design[i].reduce((s, d, k) => s + d * fit.params[k], 0));
    return { params: fit.params, errors: fit.errors, standardised, rSquared: fit.rSquared, chi2PerDof: fit.chi2PerDof, dof: fit.dof, residuals, n };
}

/**
 * The condition number of the correlation matrix of the columns: its largest eigenvalue over its smallest, so that a value far
 * above 1e3 warns of columns that are nearly linear combinations of each other. Infinity when the smallest eigenvalue is not
 * positive; null when a column has no spread or the decomposition fails.
 */
export function conditionNumber(columns) {
    const corr = correlationMatrix(columns);
    if (corr.some((row) => row.some((v) => !Number.isFinite(v)))) return null;
    const eigen = symmetricEigen(corr);
    if (!eigen) return null;
    const largest = Math.max(...eigen.values);
    const smallest = Math.min(...eigen.values);
    return smallest > 0 ? largest / smallest : Infinity;
}

/** The pairs of columns whose absolute correlation is at least threshold, as [{i, j, r}] with i below j, the largest first. */
export function collinearPairs(columns, threshold) {
    const corr = correlationMatrix(columns);
    const pairs = [];
    for (let i = 0; i < columns.length; i += 1) {
        for (let j = i + 1; j < columns.length; j += 1) {
            if (Number.isFinite(corr[i][j]) && Math.abs(corr[i][j]) >= threshold) pairs.push({ i, j, r: corr[i][j] });
        }
    }
    return pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}
