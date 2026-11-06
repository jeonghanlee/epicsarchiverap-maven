// The legend under a chart, as a list or as a table with computed values, and the names of the lines a viewer has hidden
// through it.

import { SVG_NS } from "../dom.js";
import { lineLook, markerPath } from "./series.js";

const d3 = globalThis.d3;

// The names of the lines a viewer has hidden through the legend, kept per chart host across redraws.
export const HIDDEN = new WeakMap();

// The computed values a legend table can show, in the order a page may ask for them, and the columns shown by default.
export const LEGEND_STATISTICS = ["min", "max", "mean", "median", "std", "last", "count"];
export const LEGEND_DEFAULT_STATISTICS = ["min", "max", "mean", "last"];
const STATISTIC_TITLES = { min: "Min", max: "Max", mean: "Mean", median: "Median", std: "Std dev", last: "Last", count: "Samples" };

/** The value of one statistic over the displayed values of a series, or null when there is none. */
function statisticOf(name, values) {
    if (!values.length) {
        return name === "count" ? 0 : null;
    }
    switch (name) {
        case "min": return d3.min(values);
        case "max": return d3.max(values);
        case "mean": return d3.mean(values);
        case "median": return d3.median(values);
        case "std": return values.length > 1 ? d3.deviation(values) : null;
        case "last": return values[values.length - 1];
        case "count": return values.length;
        default: return null;
    }
}

/** The swatch of a series: its line and the marker of its combination, as the chart draws them. */
function swatchOf(look) {
    const swatch = document.createElementNS(SVG_NS, "svg");
    swatch.setAttribute("width", "30");
    swatch.setAttribute("height", "10");
    swatch.setAttribute("aria-hidden", "true");
    const line = document.createElementNS(SVG_NS, "line");
    for (const [name, value] of [["x1", "1"], ["x2", "29"], ["y1", "5"], ["y2", "5"], ["stroke", look.color], ["stroke-width", String(look.width)]]) {
        line.setAttribute(name, value);
    }
    if (look.dash) {
        line.setAttribute("stroke-dasharray", look.dash);
    }
    swatch.append(line);
    // The marker of the combination sits on the line, so the legend shows what a chart with its samples marked draws.
    const marker = document.createElementNS(SVG_NS, "path");
    marker.setAttribute("d", markerPath(look.marker, 36));
    marker.setAttribute("transform", "translate(15,5)");
    marker.setAttribute("fill", "#ffffff");
    marker.setAttribute("stroke", look.color);
    marker.setAttribute("stroke-width", "1.2");
    swatch.append(marker);
    return swatch;
}

/**
 * The legend under a chart: one button per series with its line, name and unit; a click hides or shows that line.
 * options.mode table adds one column per statistic of options.statistics, computed over options.values (a Map of
 * series name to the displayed values inside the axes) and written with options.format(value, series); labels maps
 * a series name to the name shown, looks a series name to its look (the combination of the profile unless the page
 * gives one).
 */
export function buildLegend(host, all, hidden, redraw, options = {}) {
    const mode = options.mode === "table" ? "table" : "list";
    const statistics = mode === "table"
        ? (Array.isArray(options.statistics) ? options.statistics.filter((name) => LEGEND_STATISTICS.includes(name)) : LEGEND_DEFAULT_STATISTICS)
        : [];
    const labelOf = (s) => (options.labels && options.labels.get(s.name)) || s.name;
    const lookOf = (s, slot) => (options.looks && options.looks.get(s.name)) || lineLook(s, slot);
    const format = typeof options.format === "function" ? options.format : (value) => String(value);
    const item = (s, slot) => {
        const off = hidden.has(s.name);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "item";
        button.dataset.series = s.name;
        button.setAttribute("aria-pressed", String(!off));
        button.title = `${off ? "Show" : "Hide"} ${s.name}`;
        button.append(swatchOf(lookOf(s, slot)), document.createTextNode(labelOf(s)));
        if (s.egu) {
            const unit = document.createElement("span");
            unit.className = "unit";
            unit.textContent = s.egu;
            button.append(" ", unit);
        }
        button.addEventListener("click", () => {
            if (hidden.has(s.name)) {
                hidden.delete(s.name);
            } else {
                hidden.add(s.name);
            }
            redraw();
            // The redraw replaced the buttons; the keyboard stays on the item that was pressed.
            for (const element of host.querySelectorAll(".legend button")) {
                if (element.dataset.series === s.name) {
                    element.focus();
                }
            }
        });
        return button;
    };
    if (mode === "list") {
        const box = document.createElement("div");
        box.className = "legend";
        box.setAttribute("aria-label", "Legend");
        all.forEach((s, slot) => box.append(item(s, slot)));
        return box;
    }
    const table = document.createElement("table");
    table.className = "legend legend-table";
    table.setAttribute("aria-label", "Legend with values of the displayed samples");
    const head = document.createElement("tr");
    for (const text of ["Series", ...statistics.map((name) => STATISTIC_TITLES[name])]) {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = text;
        head.append(cell);
    }
    const thead = document.createElement("thead");
    thead.append(head);
    const body = document.createElement("tbody");
    all.forEach((s, slot) => {
        const row = document.createElement("tr");
        const first = document.createElement("td");
        first.append(item(s, slot));
        row.append(first);
        const values = hidden.has(s.name) ? [] : (options.values && options.values.get(s.name)) || [];
        for (const name of statistics) {
            const cell = document.createElement("td");
            cell.className = "num";
            const value = hidden.has(s.name) ? null : statisticOf(name, values);
            cell.textContent = value === null ? "-" : name === "count" ? String(value) : format(value, s);
            row.append(cell);
        }
        body.append(row);
    });
    table.append(thead, body);
    return table;
}
