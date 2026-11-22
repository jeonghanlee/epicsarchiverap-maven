// The pairing of two archived signals for the Correlation tab: at every sample time of either signal, the value the other signal
// holds there (its last sample at or before that time). The samples are objects {t, v, g?} in ascending time, t in milliseconds,
// g true on a sample recorded after a lost connection. A held value is paired only when it is not older than gapFactor times the
// median spacing of its signal and the sample that ends the hold does not carry the lost flag (a loss between the two samples
// cannot be placed, so the hold is not trusted); a sample without such a value is left out and counted. The bundled D3 has
// the bisector this uses.

const d3 = globalThis.d3;

export const GAP_FACTOR = 5;

/** The median spacing in milliseconds of the sample times; null for fewer than two samples. */
export function medianSpacingMs(points) {
    if (points.length < 2) return null;
    const spacings = [];
    for (let i = 1; i < points.length; i += 1) spacings.push(points[i].t - points[i - 1].t);
    return d3.median(spacings);
}

/**
 * The value that points hold at time t under the gap rule: {v, age} of the last sample at or before t, or null when there is none,
 * when the hold is older than gapMs, or when the next sample carries the lost flag.
 */
export function heldValue(points, t, gapMs) {
    const index = d3.bisector((p) => p.t).right(points, t) - 1;
    if (index < 0) return null;
    const last = points[index];
    const next = points[index + 1];
    if (t - last.t > gapMs) return null;
    if (t > last.t && next && next.g) return null;
    return { v: last.v, age: t - last.t };
}

/**
 * Pairs the samples of x and of y: {pairs: [{t, x, y}], countX, countY, excludedX, excludedY, medianX, medianY, overlap} where a
 * pair stands at the union of the sample times (one pair when both signals have a sample at the same time), the excluded counts
 * are the samples of each signal that found no value of the other, and overlap is the span both signals cover, or null.
 */
export function pairSeries(x, y, gapFactor = GAP_FACTOR) {
    const medianX = medianSpacingMs(x);
    const medianY = medianSpacingMs(y);
    const gapX = medianX === null ? Infinity : gapFactor * medianX;
    const gapY = medianY === null ? Infinity : gapFactor * medianY;
    const pairs = [];
    let excludedX = 0;
    let excludedY = 0;
    for (const p of x) {
        const held = heldValue(y, p.t, gapY);
        if (held) pairs.push({ t: p.t, x: p.v, y: held.v });
        else excludedX += 1;
    }
    for (const p of y) {
        // A time that x also samples was paired exactly in the loop above.
        const at = d3.bisector((q) => q.t).left(x, p.t);
        if (at < x.length && x[at].t === p.t) continue;
        const held = heldValue(x, p.t, gapX);
        if (held) pairs.push({ t: p.t, x: held.v, y: p.v });
        else excludedY += 1;
    }
    pairs.sort((a, b) => a.t - b.t);
    const overlap = x.length && y.length ? { from: Math.max(x[0].t, y[0].t), to: Math.min(x[x.length - 1].t, y[y.length - 1].t) } : null;
    return { pairs, countX: x.length, countY: y.length, excludedX, excludedY, medianX, medianY, overlap: overlap && overlap.from <= overlap.to ? overlap : null };
}
