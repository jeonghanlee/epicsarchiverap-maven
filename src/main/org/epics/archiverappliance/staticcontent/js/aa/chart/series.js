// The series of a chart: the samples that count, the gaps between them, the running statistics and the look of a line.

import { combination } from "./profile.js";

const d3 = globalThis.d3;

// The dash patterns and the colors of the lines come from the display profile in force (see profile.js).
export { DASHES } from "./profile.js";

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

/** The look of the line of the series at position slot of a chart: the combination of the profile in force and the width. */
export function lineLook(series, slot) {
    const combo = combination(slot);
    return { color: combo.color, dash: combo.dash || null, marker: combo.marker, width: series.focus ? 2.5 : series.quiet ? 1.2 : 1.8 };
}

/** The path of the marker of a combination, centered on the origin, by the name of its d3 symbol. */
export function markerPath(name, size = 30) {
    const types = { circle: d3.symbolCircle, square: d3.symbolSquare, triangle: d3.symbolTriangle, diamond: d3.symbolDiamond, cross: d3.symbolCross };
    return d3.symbol().type(types[name] || d3.symbolCircle).size(size)();
}
