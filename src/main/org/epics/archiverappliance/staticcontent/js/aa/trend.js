// The calculations of the Trend additions of the analyzer: the rate of change between successive samples, the linear fit of
// the values against time (the slow trend), the time a signal holds a value beyond a level, and the reading of the limits that
// the retrieval reports for a PV. The samples are objects {t, v} with t in milliseconds and v finite, in ascending time.

const SECOND = 1000;

/**
 * The rate of change between each pair of successive samples: the value change per second, stamped with the time of the later
 * sample. A pair with the same time or a time that goes back is skipped, since it has no rate.
 */
export function rateOfChange(points) {
    const rates = [];
    for (let i = 1; i < points.length; i += 1) {
        const seconds = (points[i].t - points[i - 1].t) / SECOND;
        if (seconds > 0) {
            rates.push({ t: points[i].t, v: (points[i].v - points[i - 1].v) / seconds });
        }
    }
    return rates;
}

/**
 * The least-squares line of the values against time in seconds counted from the first sample: its slope per second, its
 * intercept at the first sample, the coefficient of determination, the standard error of the slope and the count. Null for fewer
 * than three samples or samples all at one time. A series of constant values has the slope 0 and no coefficient of determination
 * (null): it is a division of zero by zero, which SciPy's linregress settles by returning a correlation of 0.
 */
export function linearFit(points) {
    const n = points.length;
    if (n < 3) {
        return null;
    }
    const t0 = points[0].t;
    let meanX = 0;
    let meanY = 0;
    for (const p of points) {
        meanX += (p.t - t0) / SECOND;
        meanY += p.v;
    }
    meanX /= n;
    meanY /= n;
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (const p of points) {
        const dx = (p.t - t0) / SECOND - meanX;
        const dy = p.v - meanY;
        sxx += dx * dx;
        sxy += dx * dy;
        syy += dy * dy;
    }
    if (!(sxx > 0)) {
        return null;
    }
    const slope = sxy / sxx;
    const intercept = meanY - slope * meanX;
    const residual = Math.max(0, syy - slope * sxy);
    return { t0, slope, intercept, rSquared: syy > 0 ? 1 - residual / syy : null, slopeError: Math.sqrt(residual / (n - 2) / sxx), n };
}

/** The value of a fit at the time t in milliseconds. */
export function fitValueAt(fit, t) {
    return fit.intercept + (fit.slope * (t - fit.t0)) / SECOND;
}

/**
 * The time a signal holds a value beyond a level, between two times. The signal holds each sample until the next one, which is how
 * the chart draws it, and only the time from the first sample inside or before the window to the last sample counts: the time
 * after the last sample is not known and is left out. side is "above" or "below"; a value equal to the level is not beyond it.
 * Returns the milliseconds beyond, the milliseconds observed and their fraction (null when nothing was observed).
 */
export function timeBeyond(points, level, side, from, to) {
    let beyond = 0;
    let observed = 0;
    for (let i = 0; i + 1 < points.length; i += 1) {
        const start = Math.max(points[i].t, from);
        const stop = Math.min(points[i + 1].t, to);
        if (!(stop > start)) {
            continue;
        }
        observed += stop - start;
        if (side === "above" ? points[i].v > level : points[i].v < level) {
            beyond += stop - start;
        }
    }
    return { beyond, observed, fraction: observed > 0 ? beyond / observed : null };
}

// The limits of a PV in the metadata of the retrieval: the alarm and warning limits and the display range, each by its record field.
export const LIMIT_FIELDS = [
    { field: "HIHI", name: "High alarm", side: "above" },
    { field: "HIGH", name: "High warning", side: "above" },
    { field: "LOW", name: "Low warning", side: "below" },
    { field: "LOLO", name: "Low alarm", side: "below" },
];

/**
 * The limits a PV has, from its metadata (field to text): the four alarm and warning limits that are numbers, and the display
 * range when its low and high differ (a range of 0 and 0 is a range that was never set, and the text NaN is a limit that was not
 * set). Each is {field, name, side, value}; the display range gives two, Display low as below and Display high as above.
 */
export function limitsOf(metadata) {
    const number = (text) => {
        const value = typeof text === "number" ? text : typeof text === "string" && text.trim() !== "" ? Number(text) : NaN;
        return Number.isFinite(value) ? value : null;
    };
    const limits = [];
    for (const { field, name, side } of LIMIT_FIELDS) {
        const value = number(metadata && metadata[field]);
        if (value !== null) {
            limits.push({ field, name, side, value });
        }
    }
    const low = number(metadata && metadata.LOPR);
    const high = number(metadata && metadata.HOPR);
    if (low !== null && high !== null && low !== high) {
        limits.push({ field: "LOPR", name: "Display low", side: "below", value: low });
        limits.push({ field: "HOPR", name: "Display high", side: "above", value: high });
    }
    return limits;
}
