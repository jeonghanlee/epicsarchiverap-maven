// The correlations of the analyzer: Pearson's r and Spearman's rho with their p-values (the beta and the Student t distributions
// through the regularized incomplete beta function), the cross-correlation over lags, the correlation matrix of several
// variables, the partial correlation from its inverse, and the profile of y against x. Inputs are arrays of finite numbers of
// equal length. The bundled D3 has none of these.
import { invert } from "./matrix.js";

const BETA_ITERATIONS_MOST = 300;
const BETA_EPSILON = 1e-15;
const BETA_TINY = 1e-300;

/** The natural logarithm of the gamma function (Lanczos). */
export function logGamma(x) {
    const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (const c of g) { y += 1; ser += c / y; }
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** The continued fraction of the incomplete beta function (Numerical Recipes betacf). */
function betaContinuedFraction(a, b, x) {
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < BETA_TINY) d = BETA_TINY;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= BETA_ITERATIONS_MOST; m += 1) {
        const m2 = 2 * m;
        let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < BETA_TINY) d = BETA_TINY;
        c = 1 + aa / c;
        if (Math.abs(c) < BETA_TINY) c = BETA_TINY;
        d = 1 / d;
        h *= d * c;
        aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < BETA_TINY) d = BETA_TINY;
        c = 1 + aa / c;
        if (Math.abs(c) < BETA_TINY) c = BETA_TINY;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < BETA_EPSILON) break;
    }
    return h;
}

/** The regularized incomplete beta function I_x(a, b). */
export function incompleteBeta(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) {
        return (front * betaContinuedFraction(a, b, x)) / a;
    }
    return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** The two-sided p-value of a Student t statistic with nu degrees of freedom. */
export function studentTwoSided(t, nu) {
    if (!Number.isFinite(t)) return 0;
    return incompleteBeta(nu / 2, 0.5, nu / (nu + t * t));
}

/** The mean of an array. */
const mean = (values) => values.reduce((s, v) => s + v, 0) / values.length;

/**
 * Pearson's correlation of x and y with the two-sided p-value of SciPy (the beta distribution of r under no correlation):
 * {r, p, n}. Null for fewer than three pairs or an input without spread.
 */
export function pearson(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 3) return null;
    const mx = mean(x);
    const my = mean(y);
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < n; i += 1) {
        sxy += (x[i] - mx) * (y[i] - my);
        sxx += (x[i] - mx) ** 2;
        syy += (y[i] - my) ** 2;
    }
    if (!(sxx > 0 && syy > 0)) return null;
    const r = Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
    const ab = n / 2 - 1;
    const p = Math.min(1, 2 * incompleteBeta(ab, ab, (1 - Math.abs(r)) / 2));
    return { r, p, n };
}

/** The average ranks of the values (ties share the mean of their ranks), from 1. */
export function averageRanks(values) {
    const order = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
    const ranks = new Array(values.length);
    let i = 0;
    while (i < order.length) {
        let j = i;
        while (j + 1 < order.length && values[order[j + 1]] === values[order[i]]) j += 1;
        const rank = (i + j) / 2 + 1;
        for (let k = i; k <= j; k += 1) ranks[order[k]] = rank;
        i = j + 1;
    }
    return ranks;
}

/**
 * Spearman's rank correlation with the two-sided p-value of SciPy (the Student t with n minus 2 degrees of freedom): {rho, p, n}.
 * Null for fewer than three pairs or ranks without spread.
 */
export function spearman(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 3) return null;
    const result = pearson(averageRanks(x.slice(0, n)), averageRanks(y.slice(0, n)));
    if (!result) return null;
    const rho = result.r;
    const t = rho * Math.sqrt((n - 2) / Math.max(1 - rho * rho, Number.MIN_VALUE));
    return { rho, p: Math.abs(rho) >= 1 ? 0 : studentTwoSided(t, n - 2), n };
}

/**
 * The cross-correlation of x and y at each lag: Pearson's r of x[t] and y[t + lag] over the samples both have. Returns
 * {lags, values} for the lags from -maxLag to maxLag; a lag with fewer than three overlapping pairs, or without spread, is NaN.
 */
export function crossCorrelation(x, y, maxLag) {
    const lags = [];
    const values = [];
    for (let lag = -maxLag; lag <= maxLag; lag += 1) {
        const a = lag >= 0 ? x.slice(0, x.length - lag) : x.slice(-lag);
        const b = lag >= 0 ? y.slice(lag) : y.slice(0, y.length + lag);
        const n = Math.min(a.length, b.length);
        const result = pearson(a.slice(0, n), b.slice(0, n));
        lags.push(lag);
        values.push(result ? result.r : NaN);
    }
    return { lags, values };
}

/** The correlation matrix of the columns (arrays of equal length); an entry without spread is NaN. */
export function correlationMatrix(columns) {
    return columns.map((a, i) => columns.map((b, j) => {
        if (i === j) return 1;
        const result = pearson(a, b);
        return result ? result.r : NaN;
    }));
}

/**
 * The partial correlation of each pair of columns given all the others, from the inverse of the correlation matrix:
 * -P[i][j] over the square root of P[i][i] P[j][j]. Null when the matrix is singular.
 */
export function partialCorrelation(columns) {
    const corr = correlationMatrix(columns);
    if (corr.some((row) => row.some((v) => !Number.isFinite(v)))) return null;
    const precision = invert(corr);
    if (!precision) return null;
    return precision.map((row, i) => row.map((v, j) => (i === j ? 1 : -v / Math.sqrt(precision[i][i] * precision[j][j]))));
}

/**
 * The profile of y against x: the mean of y, its standard error and the count in each of the bins given by ascending edges
 * (a value at the last edge belongs to the last bin). A bin without a value has mean and error null; with one value, error null.
 */
export function profile(x, y, edges) {
    const bins = edges.slice(0, -1).map(() => []);
    for (let i = 0; i < x.length; i += 1) {
        if (x[i] < edges[0] || x[i] > edges[edges.length - 1]) continue;
        let b = 0;
        while (b < bins.length - 1 && x[i] >= edges[b + 1]) b += 1;
        bins[b].push(y[i]);
    }
    return bins.map((inside) => {
        if (!inside.length) return { count: 0, mean: null, error: null };
        const m = mean(inside);
        if (inside.length === 1) return { count: 1, mean: m, error: null };
        const variance = inside.reduce((s, v) => s + (v - m) ** 2, 0) / (inside.length - 1);
        return { count: inside.length, mean: m, error: Math.sqrt(variance / inside.length) };
    });
}
