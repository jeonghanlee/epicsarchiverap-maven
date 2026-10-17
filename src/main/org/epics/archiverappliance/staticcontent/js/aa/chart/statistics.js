// The table of basic statistics of the samples in view, one row per drawn line.

const d3 = globalThis.d3;

import { format } from "./text.js";

/**
 * The table of basic statistics of the samples in view, one row per drawn series: samples, minimum, mean, median,
 * maximum, standard deviation and the unit.
 */
export function buildStatistics(rows, info) {
    const wrap = document.createElement("div");
    wrap.className = "chart-stats-wrap";
    const title = document.createElement("h3");
    title.className = "chart-stats-title";
    title.textContent = "Statistics";
    const table = document.createElement("table");
    table.className = "chart-stats";
    table.setAttribute("aria-label", "Statistics");
    const head = document.createElement("tr");
    for (const title of ["PV", "Samples", "Min", "Mean", "Median", "Max", "Std dev", "Unit"]) {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = title;
        head.append(cell);
    }
    const thead = document.createElement("thead");
    thead.append(head);
    const body = document.createElement("tbody");
    for (const row of rows) {
        const tr = document.createElement("tr");
        const name = document.createElement("td");
        const swatch = document.createElement("span");
        swatch.className = "swatch";
        swatch.style.background = row.color;
        name.append(swatch, document.createTextNode(row.name));
        tr.append(name);
        const values = row.values;
        const cells = values.length
            ? [String(values.length), format(d3.min(values), ""), format(d3.mean(values), ""), format(d3.median(values), ""),
               format(d3.max(values), ""), format(d3.deviation(values) || 0, "")]
            : ["0", "-", "-", "-", "-", "-"];
        for (const text of cells) {
            const cell = document.createElement("td");
            cell.className = "num";
            cell.textContent = text;
            tr.append(cell);
        }
        const unit = document.createElement("td");
        unit.textContent = row.egu || "-";
        tr.append(unit);
        body.append(tr);
    }
    table.append(thead, body);
    if (info) {
        title.append(" ", info);
    }
    wrap.append(title, table);
    return wrap;
}
