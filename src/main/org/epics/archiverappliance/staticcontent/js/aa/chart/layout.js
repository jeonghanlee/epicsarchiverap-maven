// The room that a chart leaves for the labels at the end of its lines and for its value axes.

const d3 = globalThis.d3;

import { CHART_OPTIONS } from "./options.js";
import { HIDDEN } from "./legend.js";
import { RANGES } from "./gestures.js";
import { axisWidthOf, makeValueScale } from "./scales.js";
import { finiteSeries } from "./series.js";
import { format, shortNames } from "./text.js";

/**
 * The width in pixels the end-of-line labels need, measured with the style of a label in the host. A label that is wider
 * than the room the chart leaves would be cut at the edge of the drawing, with the end of the value missing.
 */
export function labelWidth(host, texts) {
    const probe = d3.select(host).append("svg").attr("width", 0).attr("height", 0).attr("aria-hidden", "true");
    let widest = 0;
    for (const text of texts) {
        widest = Math.max(widest, probe.append("text").attr("class", "label focus").text(text).node().getComputedTextLength());
    }
    probe.remove();
    return widest;
}

/** The texts of the labels at the end of the lines of a chart and the room they need on the right. */
export function labelLayout(host, drawn, width, labelNames) {
    const narrow = width < 560;
    const names = shortNames(drawn.map((d) => d.name));
    const labelText = (s, i) => {
        const value = format(s.points[s.points.length - 1].v, "");
        return !labelNames ? value : narrow ? names[i] : `${names[i]}  ${value}`.trim();
    };
    // The widest label and its offset, within a share of the chart, with the earlier fixed size as the least.
    const widest = Math.ceil(labelWidth(host, drawn.map(labelText)));
    const least = labelNames ? (narrow ? 76 : 170) : 70;
    return { names, labelText, widest, right: Math.max(least, Math.min(widest + 12, Math.floor(width * 0.45))) };
}

/**
 * The room on the right of a chart for its labels. Charts drawn one above the other pass the largest of their rooms
 * as input.labelRoom, so that their time axes line up.
 */
export function labelRoom(host, input) {
    const drawn = finiteSeries(input.series);
    if (!drawn.length) {
        return 0;
    }
    return labelLayout(host, drawn, Math.max(320, host.clientWidth || 640), input.labelNames !== false).right;
}

/**
 * The width in pixels the value axes of a chart need for their tick labels. Charts drawn one above the other pass the
 * largest of their widths as input.axisWidth, so that their plots start at the same place.
 */
export function axisRoom(host, input) {
    const hidden = HIDDEN.get(host);
    const all = finiteSeries(input.series);
    const drawn = input.legend === true && hidden ? all.filter((s) => !hidden.has(s.name)) : all;
    if (!drawn.length) {
        return 0;
    }
    const height = Math.max(200, Math.floor(input.height || 250));
    const tickCount = Math.max(4, Math.round((height - 42) / 48));
    const options = { ...CHART_OPTIONS, ...(input.options || {}) };
    const units = [...new Set(drawn.map((s) => s.egu || ""))];
    const ranges = RANGES.get(host) || new Map();
    const top = units.length > 1 ? 30 : 8;
    const scales = units.map((unit) => {
        const values = drawn.filter((s) => (s.egu || "") === unit).flatMap((s) => s.points.map((p) => p.v));
        return makeValueScale(options.yscale, values, ranges.get(unit), [height - 34, top], unit, tickCount).scale;
    });
    return axisWidthOf(scales, tickCount);
}
