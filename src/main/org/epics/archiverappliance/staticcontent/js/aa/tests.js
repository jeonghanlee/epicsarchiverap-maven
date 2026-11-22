// The statistical tests of the Compare tab, with the distribution functions they need (the bundled D3 has none): the
// chi-square test of two histograms, the two-sample Kolmogorov-Smirnov test, the k-sample Anderson-Darling test and the
// difference of the means and of the spreads of two samples.

import { finiteValues, moments } from "./stats.js";

// The Lanczos approximation (g = 7, nine terms) of the logarithm of the gamma function.
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

function logGamma(x) {
    if (x < 0.5) {
        return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
    }
    const z = x - 1;
    let sum = LANCZOS[0];
    for (let i = 1; i < 9; i += 1) {
        sum += LANCZOS[i] / (z + i);
    }
    const t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

const GAMMA_EPS = 1e-16;
const GAMMA_ITERATIONS = 1000;

/** The regularized upper incomplete gamma function Q(a, x): by its series for x < a + 1 and by a continued fraction beyond. */
export function gammaQ(a, x) {
    if (!(a > 0) || x < 0) {
        return NaN;
    }
    if (x === 0) {
        return 1;
    }
    const front = Math.exp(-x + a * Math.log(x) - logGamma(a));
    if (x < a + 1) {
        let term = 1 / a;
        let sum = term;
        for (let n = 1; n < GAMMA_ITERATIONS; n += 1) {
            term *= x / (a + n);
            sum += term;
            if (Math.abs(term) < Math.abs(sum) * GAMMA_EPS) {
                break;
            }
        }
        return 1 - sum * front;
    }
    // Lentz's continued fraction.
    const tiny = 1e-300;
    let b = x + 1 - a;
    let c = 1 / tiny;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i < GAMMA_ITERATIONS; i += 1) {
        const an = -i * (i - a);
        b += 2;
        d = an * d + b;
        if (Math.abs(d) < tiny) d = tiny;
        c = b + an / c;
        if (Math.abs(c) < tiny) c = tiny;
        d = 1 / d;
        const delta = d * c;
        h *= delta;
        if (Math.abs(delta - 1) < GAMMA_EPS) {
            break;
        }
    }
    return front * h;
}

/** The survival function of the chi-square distribution of k degrees of freedom at x. */
export function chiSquareSurvival(x, k) {
    return gammaQ(k / 2, x / 2);
}

/** The Kolmogorov survival function Q(lambda): the probability that the scaled maximum distance exceeds lambda. */
export function kolmogorovSurvival(lambda) {
    if (!(lambda > 0)) {
        return 1;
    }
    if (lambda < 1) {
        // The transformed series converges fast for small lambda.
        let sum = 0;
        for (let k = 1; k <= 20; k += 1) {
            sum += Math.exp((-((2 * k - 1) ** 2) * Math.PI ** 2) / (8 * lambda * lambda));
        }
        return Math.min(1, Math.max(0, 1 - (Math.sqrt(2 * Math.PI) / lambda) * sum));
    }
    let sum = 0;
    for (let k = 1; k <= 100; k += 1) {
        const term = Math.exp(-2 * k * k * lambda * lambda);
        sum += (k % 2 ? 1 : -1) * term;
        if (term < 1e-18) {
            break;
        }
    }
    return Math.min(1, Math.max(0, 2 * sum));
}

/**
 * The chi-square test that two histograms over the same bins come from one distribution. A bin that is empty in both is
 * left out. The statistic is the sum over the bins of (a sqrt(nb / na) - b sqrt(na / nb))^2 / (a + b), the degrees of freedom
 * are the bins used less one, and the p-value is the survival function. Null when fewer than two bins are used.
 */
export function chiSquareHomogeneity(countsA, countsB) {
    if (countsA.length !== countsB.length) {
        throw new Error("The two histograms need the same bins");
    }
    let na = 0;
    let nb = 0;
    for (let i = 0; i < countsA.length; i += 1) {
        na += countsA[i];
        nb += countsB[i];
    }
    if (!(na > 0) || !(nb > 0)) {
        return null;
    }
    let statistic = 0;
    let bins = 0;
    for (let i = 0; i < countsA.length; i += 1) {
        const total = countsA[i] + countsB[i];
        if (total > 0) {
            bins += 1;
            statistic += (countsA[i] * Math.sqrt(nb / na) - countsB[i] * Math.sqrt(na / nb)) ** 2 / total;
        }
    }
    if (bins < 2) {
        return null;
    }
    const degrees = bins - 1;
    return { statistic, degrees, bins, pValue: chiSquareSurvival(statistic, degrees) };
}

/**
 * The two-sample Kolmogorov-Smirnov test: the largest distance D between the two empirical distribution functions, and its
 * asymptotic p-value, the Kolmogorov survival function at sqrt(n m / (n + m)) D. The asymptotic form is not exact for small
 * samples, which the caller says. Null when a sample is empty.
 */
export function kolmogorovSmirnov(inputA, inputB) {
    const a = finiteValues(inputA).sort();
    const b = finiteValues(inputB).sort();
    if (!a.length || !b.length) {
        return null;
    }
    let i = 0;
    let j = 0;
    let distance = 0;
    while (i < a.length && j < b.length) {
        const x = Math.min(a[i], b[j]);
        while (i < a.length && a[i] <= x) i += 1;
        while (j < b.length && b[j] <= x) j += 1;
        distance = Math.max(distance, Math.abs(i / a.length - j / b.length));
    }
    const effective = (a.length * b.length) / (a.length + b.length);
    return { statistic: distance, effectiveSize: effective, pValue: kolmogorovSurvival(Math.sqrt(effective) * distance), asymptotic: true };
}

// Table 2 of Scholz and Stephens (1987): the critical values of the standardized k-sample statistic at the significance
// levels, as t(m) = b0 + b1 / sqrt(m) + b2 / m with m = k - 1.
const AD_SIGNIFICANCE = [0.25, 0.1, 0.05, 0.025, 0.01, 0.005, 0.001];
const AD_B0 = [0.675, 1.281, 1.645, 1.96, 2.326, 2.573, 3.085];
const AD_B1 = [-0.245, 0.25, 0.678, 1.149, 1.822, 2.364, 3.615];
const AD_B2 = [-0.105, -0.305, -0.362, -0.391, -0.396, -0.345, -0.154];

/** The coefficients [c0, c1, c2] of the least-squares quadratic c0 + c1 x + c2 x^2 through the points (x, y). */
function quadraticFit(xs, ys) {
    const centre = xs.reduce((s, x) => s + x, 0) / xs.length;
    const u = xs.map((x) => x - centre);
    const s = [0, 0, 0, 0, 0];
    const t = [0, 0, 0];
    for (let i = 0; i < u.length; i += 1) {
        for (let p = 0; p < 5; p += 1) s[p] += u[i] ** p;
        for (let p = 0; p < 3; p += 1) t[p] += ys[i] * u[i] ** p;
    }
    // Solve the 3 x 3 normal equations by Gauss elimination with partial pivoting.
    const m = [[s[0], s[1], s[2], t[0]], [s[1], s[2], s[3], t[1]], [s[2], s[3], s[4], t[2]]];
    for (let col = 0; col < 3; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < 3; row += 1) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
        [m[col], m[pivot]] = [m[pivot], m[col]];
        for (let row = col + 1; row < 3; row += 1) {
            const f = m[row][col] / m[col][col];
            for (let k = col; k < 4; k += 1) m[row][k] -= f * m[col][k];
        }
    }
    const c = [0, 0, 0];
    for (let row = 2; row >= 0; row -= 1) {
        let value = m[row][3];
        for (let k = row + 1; k < 3; k += 1) value -= m[row][k] * c[k];
        c[row] = value / m[row][row];
    }
    // c is in the centred variable; return the evaluator.
    return (x) => c[0] + c[1] * (x - centre) + c[2] * (x - centre) ** 2;
}

/**
 * The k-sample Anderson-Darling test of Scholz and Stephens (1987) with midranks: the statistic A2kN, its standardized form,
 * the critical values and a significance level interpolated from them. Outside the table the level is the nearest end of
 * it (capped at 0.25 or floored at 0.001), and capped or floored says so. Null when a sample is empty or the pooled sample
 * has fewer than four values or fewer than two distinct ones.
 */
export function andersonDarling(inputs) {
    const samples = inputs.map((input) => finiteValues(input).sort());
    const k = samples.length;
    if (k < 2 || samples.some((s) => !s.length)) {
        return null;
    }
    const pooled = Float64Array.from(samples.flatMap((s) => [...s])).sort();
    const N = pooled.length;
    if (N < 4) {
        return null;
    }
    const distinct = [];
    for (const value of pooled) {
        if (!distinct.length || distinct[distinct.length - 1] !== value) distinct.push(value);
    }
    if (distinct.length < 2) {
        return null;
    }
    const countLeft = (sorted, x) => {
        let low = 0;
        let high = sorted.length;
        while (low < high) {
            const mid = (low + high) >> 1;
            if (sorted[mid] < x) low = mid + 1; else high = mid;
        }
        return low;
    };
    const countRight = (sorted, x) => {
        let low = 0;
        let high = sorted.length;
        while (low < high) {
            const mid = (low + high) >> 1;
            if (sorted[mid] <= x) low = mid + 1; else high = mid;
        }
        return low;
    };
    const lj = distinct.map((x) => countRight(pooled, x) - countLeft(pooled, x));
    const bj = distinct.map((x, index) => countLeft(pooled, x) + lj[index] / 2);
    let a2kn = 0;
    for (const sample of samples) {
        let inner = 0;
        for (let index = 0; index < distinct.length; index += 1) {
            const right = countRight(sample, distinct[index]);
            const left = countLeft(sample, distinct[index]);
            const mij = right - (right - left) / 2;
            inner += ((lj[index] / N) * (N * mij - bj[index] * sample.length) ** 2) / (bj[index] * (N - bj[index]) - (N * lj[index]) / 4);
        }
        a2kn += inner / sample.length;
    }
    a2kn *= (N - 1) / N;
    const H = samples.reduce((s, sample) => s + 1 / sample.length, 0);
    let h = 0;
    let gSum = 0;
    // hs_cs is the cumulative sum of 1 / i for i from N - 1 down to 2; h is its last value plus one and g sums hs_cs / j.
    let cumulative = 0;
    for (let i = N - 1, j = 2; i > 1; i -= 1, j += 1) {
        cumulative += 1 / i;
        gSum += cumulative / j;
    }
    h = cumulative + 1;
    const g = gSum;
    const a = (4 * g - 6) * (k - 1) + (10 - 6 * g) * H;
    const b = (2 * g - 4) * k ** 2 + 8 * h * k + (2 * g - 14 * h - 4) * H - 8 * h + 4 * g - 6;
    const c = (6 * h + 2 * g - 2) * k ** 2 + (4 * h - 4 * g + 6) * k + (2 * h - 6) * H + 4 * h;
    const d = (2 * h + 6) * k ** 2 - 4 * h * k;
    const sigmaSquared = (a * N ** 3 + b * N ** 2 + c * N + d) / ((N - 1) * (N - 2) * (N - 3));
    const m = k - 1;
    const statistic = (a2kn - m) / Math.sqrt(sigmaSquared);
    const critical = AD_B0.map((b0, index) => b0 + AD_B1[index] / Math.sqrt(m) + AD_B2[index] / m);
    let significance;
    let capped = false;
    let floored = false;
    if (statistic < Math.min(...critical)) {
        significance = Math.max(...AD_SIGNIFICANCE);
        capped = true;
    } else if (statistic > Math.max(...critical)) {
        significance = Math.min(...AD_SIGNIFICANCE);
        floored = true;
    } else {
        significance = Math.exp(quadraticFit(critical, AD_SIGNIFICANCE.map(Math.log))(statistic));
    }
    return { a2kn, statistic, critical, significance, capped, floored };
}

/**
 * The difference of two samples: of the means (a minus b) with its standard error from the two standard errors of the mean
 * (Welch), and of the standard deviations with its standard error from their two standard errors (normal theory). A value that
 * a sample cannot give is null.
 */
export function compareSamples(inputA, inputB) {
    const a = moments(inputA);
    const b = moments(inputB);
    const both = (x, y, combine) => (x === null || y === null ? null : combine(x, y));
    return {
        a,
        b,
        meanDifference: both(a.mean, b.mean, (x, y) => x - y),
        meanDifferenceError: both(a.seMean, b.seMean, (x, y) => Math.hypot(x, y)),
        sdDifference: both(a.sd, b.sd, (x, y) => x - y),
        sdDifferenceError: both(a.seSd, b.seSd, (x, y) => Math.hypot(x, y)),
    };
}
