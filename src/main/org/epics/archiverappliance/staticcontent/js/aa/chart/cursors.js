// The readout of the reference cursors of a time-series chart: for each drawn series, the observation each cursor
// reads and the differences between the two. A cursor reads the last observation at or before its time, the value the
// step line holds there; a lost connection or a gap wider than the gap threshold between that observation and the
// cursor leaves the reading unavailable, and nothing is interpolated.

import { splitOnGaps } from "./series.js";
import { format } from "./text.js";
import { formatInZone } from "../timezone.js";

const TIME_FORMAT = "%Y-%m-%d %H:%M:%S";

/**
 * The observation of points (sorted by t) that a cursor at time t reads, or null: the last observation at or before t,
 * unless the run of connected samples it belongs to ends before t.
 */
export function heldObservation(points, gapMs, t) {
    const parts = splitOnGaps(points, gapMs);
    for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];
        if (part[0].t > t) {
            return null;
        }
        const next = parts[i + 1];
        if (next && next[0].t <= t) {
            continue;
        }
        const last = part[part.length - 1];
        if (t > last.t && (next || t - last.t > gapMs)) {
            return null;
        }
        let low = 0;
        let high = part.length - 1;
        while (low < high) {
            const mid = (low + high + 1) >> 1;
            if (part[mid].t <= t) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        return part[low];
    }
    return null;
}

/**
 * The table of the cursors: one row per drawn series with the reading of each cursor (value and the time of the
 * observation), and the differences of time and value between the two readings when both exist.
 */
export function buildCursorTable(drawn, names, cursors, gapMs, timeZone) {
    const wrap = document.createElement("div");
    wrap.className = "chart-cursors";
    const title = document.createElement("h3");
    title.className = "chart-stats-title";
    title.textContent = "Cursors";
    const table = document.createElement("table");
    table.className = "chart-stats";
    table.setAttribute("aria-label", "Cursor readout");
    const head = document.createElement("tr");
    for (const text of ["PV", "Cursor 1", "Cursor 2", "Time difference", "Value difference"]) {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = text;
        head.append(cell);
    }
    const thead = document.createElement("thead");
    thead.append(head);
    const body = document.createElement("tbody");
    const readingText = (series, observation) => observation
        ? `${format(observation.v, series.egu)} at ${formatInZone(new Date(observation.t), TIME_FORMAT, timeZone)}`
        : "unavailable";
    drawn.forEach((series, index) => {
        const readings = cursors.map((time) => (time === null || time === undefined ? undefined : heldObservation(series.points, gapMs, +time)));
        const row = document.createElement("tr");
        const name = document.createElement("td");
        name.textContent = names[index];
        row.append(name);
        for (const reading of readings) {
            const cell = document.createElement("td");
            cell.textContent = reading === undefined ? "-" : readingText(series, reading);
            row.append(cell);
        }
        const [first, second] = readings;
        const both = first && second;
        for (const text of [both ? `${format((second.t - first.t) / 1000, "s")}` : "-", both ? format(second.v - first.v, series.egu) : "-"]) {
            const cell = document.createElement("td");
            cell.className = "num";
            cell.textContent = text;
            row.append(cell);
        }
        body.append(row);
    });
    table.append(thead, body);
    wrap.append(title, table);
    return wrap;
}
