// The calculations of the Export tab: timestamps as integer nanoseconds, the interpolation grid and its rows, the long
// and wide CSV tables, the text of a time and of a value. Nothing here reads the page or the network; the page gives
// the records it retrieved and takes the text back.

import { partsInZone } from "../comm/js/aa/timezone.js";

const d3 = globalThis.d3;

const NANOS_PER_SECOND = 1000000000n;
const NANOS_PER_MILLISECOND = 1000000n;
// The severity above which an observation is not a valid endpoint of an interpolation: NONE 0, MINOR 1, MAJOR 2, INVALID 3.
const SEVERITY_MOST_VALID = 2;

/** The timestamp of a record (secs and nanos) as integer nanoseconds. */
export function nanosOf(record) {
    return BigInt(record.secs) * NANOS_PER_SECOND + BigInt(record.nanos || 0);
}

/** The integer nanoseconds of a Date, at its millisecond precision. */
export function nanosOfDate(date) {
    return BigInt(date.getTime()) * NANOS_PER_MILLISECOND;
}

/**
 * A duration typed as decimal seconds: positive, no exponent, at most nine fractional digits, so that it is exact in
 * integer nanoseconds. Returns the nanoseconds as a BigInt, or null for text that is not such a duration.
 */
export function parseDuration(text) {
    const match = /^\s*(\d+)(?:\.(\d{1,9}))?\s*$/.exec(String(text));
    if (!match) {
        return null;
    }
    const whole = BigInt(match[1]);
    const fraction = BigInt((match[2] || "").padEnd(9, "0"));
    const nanos = whole * NANOS_PER_SECOND + fraction;
    return nanos > 0n ? nanos : null;
}

/** The grid timestamps from + k * step, for k >= 0, at or before to. */
export function gridOf(from, to, step) {
    const grid = [];
    for (let t = from; t <= to; t += step) {
        grid.push(t);
    }
    return grid;
}

/**
 * The observations of a PV ordered by time, with exact duplicates collapsed and conflicting duplicates (one timestamp,
 * different value, severity or status) marked, from the preceding observation (or null) and the raw records of the
 * range. A record whose value is not a finite number is kept as an invalid observation.
 */
export function observationsOf(preceding, records, from) {
    const list = [];
    if (preceding) {
        list.push({ ...preceding, t: nanosOf(preceding) });
    }
    for (const record of records) {
        const t = nanosOf(record);
        if (t >= from) {
            list.push({ ...record, t });
        }
    }
    list.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
    const out = [];
    for (const observation of list) {
        const last = out[out.length - 1];
        if (last && last.t === observation.t) {
            const same = Object.is(last.v, observation.v) && last.severity === observation.severity && last.status === observation.status
                && Boolean(last.lost) === Boolean(observation.lost);
            if (!same) {
                last.conflict = true;
            }
            continue;
        }
        out.push({ ...observation, conflict: false });
    }
    // A raw observation at exactly from replaces the preceding observation.
    if (preceding && out.length > 1 && out[0].t < from && out[1].t === from) {
        out.shift();
    }
    return out;
}

const validEndpoint = (observation) => Number.isFinite(observation.v) && !observation.conflict
    && Number.isInteger(observation.severity) && observation.severity >= 0 && observation.severity <= SEVERITY_MOST_VALID;

/**
 * The rows of the interpolation grid for one PV: at each grid timestamp the observation found there (observed), a
 * value interpolated between the neighbors (interpolated), or a missing result with its reason (no_bracket, gap,
 * invalid_input, conflicting_timestamp). The grid is in ascending order, as gridOf gives it; gap, when given, is the
 * greatest distance between neighbors in nanoseconds.
 */
export function interpolateRows(observations, grid, gap) {
    const rows = [];
    let index = 0;
    for (const t of grid) {
        while (index < observations.length && observations[index].t < t) {
            index += 1;
        }
        const at = index < observations.length && observations[index].t === t ? observations[index] : null;
        if (at) {
            if (at.conflict) {
                rows.push({ t, quality: "missing", reason: "conflicting_timestamp" });
            } else if (!Number.isFinite(at.v)) {
                rows.push({ t, quality: "missing", reason: "invalid_input" });
            } else {
                rows.push({ t, quality: "observed", value: at.v, severity: at.severity, status: at.status });
            }
            continue;
        }
        const left = index > 0 ? observations[index - 1] : null;
        const right = index < observations.length ? observations[index] : null;
        if (!left || !right) {
            rows.push({ t, quality: "missing", reason: "no_bracket" });
        } else if (left.conflict || right.conflict) {
            rows.push({ t, quality: "missing", reason: "conflicting_timestamp" });
        } else if (!validEndpoint(left) || !validEndpoint(right)) {
            rows.push({ t, quality: "missing", reason: "invalid_input" });
        } else if (right.lost || (gap !== null && gap !== undefined && right.t - left.t > gap)) {
            rows.push({ t, quality: "missing", reason: "gap" });
        } else {
            const fraction = Number(t - left.t) / Number(right.t - left.t);
            const value = d3.interpolateNumber(left.v, right.v)(fraction);
            if (!Number.isFinite(value)) {
                rows.push({ t, quality: "missing", reason: "invalid_input" });
            } else {
                rows.push({ t, quality: "interpolated", value, severity: Math.max(left.severity, right.severity), status: "",
                    left: { severity: left.severity, status: left.status }, right: { severity: right.severity, status: right.status } });
            }
        }
    }
    return rows;
}

/** The ISO 8601 text of integer nanoseconds in the zone, with the offset and the fraction the nanoseconds need. */
export function isoText(nanos, zone) {
    const seconds = nanos / NANOS_PER_SECOND;
    const rest = nanos % NANOS_PER_SECOND;
    const date = new Date(Number(seconds) * 1000);
    const p = partsInZone(date, zone);
    const pad = (number) => String(number).padStart(2, "0");
    const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const offsetMinutes = Math.round((local - date.getTime()) / 60000);
    const sign = offsetMinutes < 0 ? "-" : "+";
    const offset = `${sign}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}:${pad(Math.abs(offsetMinutes) % 60)}`;
    const fraction = rest === 0n ? "" : `.${String(rest).padStart(9, "0").replace(/0+$/, "")}`;
    return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${fraction}${offset}`;
}

/** The UNIX milliseconds of integer nanoseconds as exact text, with fractional digits when the nanoseconds need them. */
export function unixMillisText(nanos) {
    const whole = nanos / NANOS_PER_MILLISECOND;
    const rest = nanos % NANOS_PER_MILLISECOND;
    return rest === 0n ? String(whole) : `${whole}.${String(rest).padStart(6, "0").replace(/0+$/, "")}`;
}

/** The text of a time in the chosen form: iso in the zone, or unixms. */
export function timeText(nanos, form, zone) {
    return form === "unixms" ? unixMillisText(nanos) : isoText(nanos, zone);
}

/** The text of a value: as stored (source), with fixed decimals, or in exponential form; empty for no value. */
export function valueText(value, form, precision) {
    if (value === null || value === undefined || value === "") {
        return "";
    }
    if (typeof value !== "number") {
        return String(value);
    }
    if (form === "fixed") {
        return value.toFixed(precision);
    }
    if (form === "exponential") {
        return value.toExponential(precision);
    }
    return String(value);
}

/** The CSV text of rows (arrays of cells) under a header, with the metadata lines before it, each starting with #. */
export function csvText(metadata, header, rows) {
    const lines = metadata.map((line) => `# ${line}`);
    lines.push(d3.csvFormatRows([header, ...rows]));
    return `${lines.join("\n")}\n`;
}

/**
 * The long table: one row per PV and time. Each series is {name, unit, rows: [{t, value, severity, status, quality,
 * reason, left, right, min, max}]}; the columns follow the options (alarms, units, quality, bins).
 */
export function longTable(series, options, cell) {
    const header = ["time", "pv"];
    if (options.units) header.push("unit");
    // A bin carries its mean, min and max; a sample its value.
    header.push(options.bins ? "mean" : "value");
    if (options.bins) header.push("min", "max");
    if (options.alarms) header.push("severity", "status");
    if (options.quality) {
        header.push("quality", "reason");
        if (options.alarms) header.push("left_severity", "left_status", "right_severity", "right_status");
    }
    const rows = [];
    for (const s of series) {
        for (const row of s.rows) {
            const out = [cell.time(row.t), s.name];
            if (options.units) out.push(s.unit || "");
            out.push(cell.value(row.value));
            if (options.bins) out.push(cell.value(row.min), cell.value(row.max));
            if (options.alarms) out.push(cell.plain(row.severity), cell.plain(row.status));
            if (options.quality) {
                out.push(row.quality || "", row.reason || "");
                if (options.alarms) {
                    out.push(cell.plain(row.left?.severity), cell.plain(row.left?.status), cell.plain(row.right?.severity), cell.plain(row.right?.status));
                }
            }
            rows.push(out);
        }
    }
    return { header, rows };
}

/**
 * The wide table: one row per time, one group of columns per PV. On the interpolation grid every series has a row
 * at every time, and a missing result leaves its cells empty; otherwise the times are the union of the times of the
 * series, and a series without a sample at a time carries the sample at or before it (sample and hold).
 */
export function wideTable(series, options, cell) {
    const header = ["time"];
    for (const s of series) {
        const base = options.bins ? `${s.name} mean` : s.name;
        header.push(options.units && s.unit ? `${base} (${s.unit})` : base);
        if (options.bins) header.push(`${s.name} min`, `${s.name} max`);
        if (options.alarms) header.push(`${s.name} severity`, `${s.name} status`);
        if (options.quality) {
            header.push(`${s.name} quality`, `${s.name} reason`);
            if (options.alarms) header.push(`${s.name} left_severity`, `${s.name} left_status`, `${s.name} right_severity`, `${s.name} right_status`);
        }
    }
    const times = [...new Set(series.flatMap((s) => s.rows.map((row) => row.t)))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const cursors = series.map(() => 0);
    const rows = [];
    for (const t of times) {
        const out = [cell.time(t)];
        series.forEach((s, index) => {
            while (cursors[index] < s.rows.length && s.rows[cursors[index]].t < t) {
                cursors[index] += 1;
            }
            const exact = cursors[index] < s.rows.length && s.rows[cursors[index]].t === t ? s.rows[cursors[index]] : null;
            const held = !options.quality && !exact && cursors[index] > 0 ? s.rows[cursors[index] - 1] : null;
            const row = exact || held;
            out.push(cell.value(row ? row.value : null));
            if (options.bins) out.push(cell.value(row ? row.min : null), cell.value(row ? row.max : null));
            if (options.alarms) out.push(cell.plain(row ? row.severity : null), cell.plain(row ? row.status : null));
            if (options.quality) {
                out.push(exact ? exact.quality : "", exact ? exact.reason || "" : "");
                if (options.alarms) {
                    out.push(cell.plain(exact?.left?.severity), cell.plain(exact?.left?.status), cell.plain(exact?.right?.severity), cell.plain(exact?.right?.status));
                }
            }
        });
        rows.push(out);
    }
    return { header, rows };
}

/** The retrieval interval in whole seconds that gives about count bins over a range, at least one second. */
export function intervalForBins(fromMs, toMs, count) {
    return Math.max(1, Math.ceil((toMs - fromMs) / 1000 / count));
}
