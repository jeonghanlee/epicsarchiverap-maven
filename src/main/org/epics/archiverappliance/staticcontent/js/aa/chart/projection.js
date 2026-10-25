// The samples in view of each line, the rows of statistics, and the Y projection drawn at the right of the plot.

const d3 = globalThis.d3;

import { PALETTE } from "./series.js";

// The Y projection: the room right of the right axes, the bins of a histogram and its longest bar, in pixels.
export const PROJECTION_WIDTH = 140;
const PROJECTION_BINS = 24;
const PROJECTION_BAR = 100;

    // The Y projection: for each line the samples in view in bins of the value axis of its unit, drawn as bars growing
    // to the right from the edge of the band, and a line at the mean. The samples in view are those inside the time
    // window and, when the viewer dragged a value range out on the axis of the unit, inside that range.
export function drawProjection(svg, { drawn, all, ranges, inView, yOf, projection, width, margin, axisWidth, onRight }) {
    const statistics = [];
    for (const s of drawn) {
        const chosen = ranges.get(s.egu || "");
        const [floor, ceiling] = chosen ? [Math.min(...chosen), Math.max(...chosen)] : [-Infinity, Infinity];
        const values = inView(s).map((p) => p.v).filter((v) => Number.isFinite(v) && v >= floor && v <= ceiling);
        statistics.push({ name: s.name, egu: s.egu, color: PALETTE[all.indexOf(s) % PALETTE.length], values });
        if (projection !== true || !values.length) {
            continue;
        }
        const scale = yOf(s);
        const color = PALETTE[all.indexOf(s) % PALETTE.length];
        const bandX = width - margin.right + axisWidth * onRight + 14;
        const bins = d3.bin().domain(scale.domain()).thresholds(PROJECTION_BINS)(values);
        const most = Math.max(1, d3.max(bins, (b) => b.length));
        for (const bin of bins) {
            if (!bin.length) {
                continue;
            }
            svg.append("rect")
                .attr("class", "proj")
                .attr("x", bandX)
                .attr("y", Math.min(scale(bin.x0), scale(bin.x1)))
                .attr("width", (bin.length / most) * PROJECTION_BAR)
                .attr("height", Math.max(1, Math.abs(scale(bin.x0) - scale(bin.x1)) - 1))
                .style("fill", color)
                .style("stroke", color);
        }
        const mean = d3.mean(values);
        const [low, high] = d3.extent(scale.domain());
        if (mean >= low && mean <= high) {
            svg.append("line")
                .attr("class", "proj-mean")
                .attr("x1", bandX - 8)
                .attr("x2", bandX + PROJECTION_BAR)
                .attr("y1", scale(mean))
                .attr("y2", scale(mean))
                .style("stroke", color);
        }
    }
    return statistics;
}
