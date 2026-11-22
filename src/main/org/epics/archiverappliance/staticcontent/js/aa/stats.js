// Statistics of one sample of numbers, for the Distribution tab and the Trend additions of the analyzer: the moments with their
// errors, the quantiles, the box plot and a kernel density estimate. The bundled D3 supplies the sums, the sorting rule of the
// quantiles and the extent; what it lacks (the skewness, the kurtosis, the errors, the density) is written here.
// A value that a sample is too small or too flat to define is null, not NaN.

const d3 = globalThis.d3;

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/** The finite numbers of values as a Float64Array, in the order given. */
export function finiteValues(values) {
    const out = [];
    for (const value of values) {
        if (Number.isFinite(value)) {
            out.push(value);
        }
    }
    return Float64Array.from(out);
}

/**
 * The sample moments. Sums are compensated (d3.fsum) and the central moments are taken about the mean in a second pass.
 * variance and sd use the divisor n - 1; skewness is g1 = m3 / m2^1.5 and kurtosis the excess g2 = m4 / m2^2 - 3, with m_k the
 * central moments of divisor n (the definitions of SciPy's skew and kurtosis with bias on). seMean is sd / sqrt(n) and seSd
 * is sd / sqrt(2 (n - 1)), the standard error of a standard deviation of a normal sample.
 */
export function moments(input) {
    const values = finiteValues(input);
    const n = values.length;
    const result = { n, min: null, max: null, mean: null, variance: null, sd: null, skewness: null, kurtosis: null, seMean: null, seSd: null };
    if (n === 0) {
        return result;
    }
    const [min, max] = d3.extent(values);
    const mean = d3.fsum(values) / n;
    const m2 = d3.fsum(values, (x) => (x - mean) ** 2) / n;
    result.min = min;
    result.max = max;
    result.mean = mean;
    if (n >= 2) {
        result.variance = (m2 * n) / (n - 1);
        result.sd = Math.sqrt(result.variance);
        result.seMean = result.sd / Math.sqrt(n);
        result.seSd = result.sd / Math.sqrt(2 * (n - 1));
    }
    if (m2 > 0) {
        if (n >= 3) {
            const m3 = d3.fsum(values, (x) => (x - mean) ** 3) / n;
            result.skewness = m3 / m2 ** 1.5;
        }
        if (n >= 4) {
            const m4 = d3.fsum(values, (x) => (x - mean) ** 4) / n;
            result.kurtosis = m4 / (m2 * m2) - 3;
        }
    }
    return result;
}

/** The quantiles of the probabilities ps (0 to 1) by linear interpolation between the order statistics (NumPy's default). */
export function quantiles(input, ps) {
    const sorted = finiteValues(input).sort();
    return ps.map((p) => (sorted.length ? d3.quantileSorted(sorted, p) : null));
}

/**
 * The box plot of Tukey: the quartiles, the whiskers at the most extreme values within 1.5 times the interquartile range of
 * the box, and the values beyond them. Null for an empty sample.
 */
export function boxPlot(input) {
    const sorted = finiteValues(input).sort();
    if (!sorted.length) {
        return null;
    }
    const q1 = d3.quantileSorted(sorted, 0.25);
    const median = d3.quantileSorted(sorted, 0.5);
    const q3 = d3.quantileSorted(sorted, 0.75);
    const low = q1 - 1.5 * (q3 - q1);
    const high = q3 + 1.5 * (q3 - q1);
    let whiskerLow = sorted[sorted.length - 1];
    let whiskerHigh = sorted[0];
    const outliers = [];
    for (const value of sorted) {
        if (value < low || value > high) {
            outliers.push(value);
        } else {
            whiskerLow = Math.min(whiskerLow, value);
            whiskerHigh = Math.max(whiskerHigh, value);
        }
    }
    return { q1, median, q3, whiskerLow, whiskerHigh, outliers };
}

/** The bandwidth of Silverman's rule as SciPy defines it: sd times (3 n / 4)^(-1/5). Null when the sample has no spread. */
export function silvermanBandwidth(input) {
    const { n, sd } = moments(input);
    return n >= 2 && sd > 0 ? sd * ((3 * n) / 4) ** -0.2 : null;
}

/**
 * A Gaussian kernel density estimate at the positions of grid: the mean of normal densities of standard deviation
 * bandwidth centred on the values. The bandwidth is Silverman's rule unless one is given. Null when it is undefined.
 */
export function kernelDensity(input, grid, bandwidth = silvermanBandwidth(input)) {
    const values = finiteValues(input);
    if (!values.length || !(bandwidth > 0)) {
        return null;
    }
    const scale = 1 / (values.length * bandwidth * SQRT_2PI);
    const density = new Float64Array(grid.length);
    for (let g = 0; g < grid.length; g += 1) {
        const x = grid[g];
        let sum = 0;
        for (let i = 0; i < values.length; i += 1) {
            const z = (x - values[i]) / bandwidth;
            sum += Math.exp(-0.5 * z * z);
        }
        density[g] = sum * scale;
    }
    return density;
}
