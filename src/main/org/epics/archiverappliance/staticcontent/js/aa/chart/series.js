// The series of a chart: the samples that count, the gaps between them, the running statistics and the look of a line.

const d3 = globalThis.d3;

export const DASHES = ["", "", "6 3", "2 3", "9 3 2 3"];

// The colors of the lines of a chart that has a legend, by position in the series list.
export const PALETTE = ["#007681", "#5a6b70", "#b36b00", "#6a4c93", "#b3261e", "#2e7d32", "#c2185b", "#1565c0", "#7b5e00", "#455a64"];

/** The series with the samples whose value is a number; a series left without a sample is dropped. */
export function finiteSeries(series) {
    return series.map((s) => ({ ...s, points: s.points.filter((p) => Number.isFinite(p.v)) })).filter((s) => s.points.length);
}

// A line breaks before a point flagged g (the connection was lost before it) and, when gapMs is finite,
// where two points are further apart than gapMs. A monitored PV may be silent for long and keeps its value.
export function splitOnGaps(points, gapMs) {
    const parts = [];
    let current = [];
    for (const point of points) {
        const last = current[current.length - 1];
        if (last && (point.g || point.t - last.t > gapMs)) {
            parts.push(current);
            current = [];
        }
        current.push(point);
    }
    if (current.length) {
        parts.push(current);
    }
    return parts;
}

/** The mean and the standard deviation of the last `size` values at each position of values (a shorter window at the start). */
export function movingStats(values, size) {
    const out = [];
    for (let i = 0; i < values.length; i += 1) {
        const window = values.slice(Math.max(0, i - size + 1), i + 1);
        const mean = d3.mean(window);
        out.push({ mean, deviation: window.length > 1 ? d3.deviation(window) : 0 });
    }
    return out;
}

/** The look of the line of the series at position slot of a chart that has a legend. */
export function lineLook(series, slot) {
    return { color: PALETTE[slot % PALETTE.length], dash: DASHES[slot % DASHES.length] || null, width: series.focus ? 2.5 : series.quiet ? 1.2 : 1.8 };
}
