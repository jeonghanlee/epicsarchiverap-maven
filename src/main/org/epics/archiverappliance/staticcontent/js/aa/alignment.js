// The alignment of several signals averaged over one common interval, for the analyses of several signals. The means that
// the server computes over N seconds carry the time of their interval, the same for every signal, and an interval without
// samples is absent. The signals are aligned on the times that every one of them has (the intervals missing from any signal
// are dropped as a whole), and the result says how many intervals each signal has, how many there are in all and how many were
// dropped, so that the coverage of an analysis is never hidden.

/**
 * Aligns the series on the times all of them share. Each series is {name, points: [{t, v}]} with t in milliseconds and v a finite
 * number. Returns {times, columns, union, common, dropped, signals}: the common times in ascending order, one column of values
 * per series in the order given, the number of distinct times in any series (union), the number in all of them (common), the
 * number dropped (union minus common) and per signal {name, count, share} with the number of its times and its share of the
 * union. With no series, or a series without a point, the common times are empty.
 */
export function alignOnTimes(series) {
    const maps = series.map((s) => new Map(s.points.map((p) => [p.t, p.v])));
    const all = new Set();
    for (const map of maps) for (const t of map.keys()) all.add(t);
    const times = [...all].filter((t) => maps.every((map) => map.has(t))).sort((a, b) => a - b);
    const union = all.size;
    return {
        times,
        columns: maps.map((map) => times.map((t) => map.get(t))),
        union,
        common: times.length,
        dropped: union - times.length,
        signals: series.map((s, i) => ({ name: s.name, count: maps[i].size, share: union ? maps[i].size / union : 0 })),
    };
}
