// Time series drawing with D3 scales and shapes. Principles: ink goes to the data, the axes carry only the
// range, lines are labelled directly, missing data is a gap, and a monitored value is held until the next sample.

const d3 = globalThis.d3;

import { CHART_OPTIONS } from "./options.js";
import { attachGestures, RANGES } from "./gestures.js";
import { buildLegend, HIDDEN } from "./legend.js";
import { labelLayout } from "./layout.js";
import { axisWidthOf, makeValueScale, PLOT_LEAST } from "./scales.js";
import { DASHES, finiteSeries, lineLook, movingStats, splitOnGaps } from "./series.js";
import { buildStatistics } from "./statistics.js";
import { buildRangeStrip } from "./strip.js";
import { format } from "./text.js";
import { formatInZone } from "../timezone.js";
import { drawProjection, PROJECTION_WIDTH } from "./projection.js";

// The lines and sample marks are clipped to the plot area; each drawing takes the next id of the page.
let clipCount = 0;
const CLIP_PAD = 3;

// More samples than this in view are not marked one by one.
export const MARKER_LIMIT = 200;

// The most sample marks drawn for one line when marks are asked for on every sample.
const MARK_CAP = 1500;

/**
 * timeZone is the zone the labels, the tooltip and the strip are written in (an IANA identifier, UTC or browser); without it the browser zone.
 * input: {series: [{name, egu, points: [{t, v, s, g?}], focus, quiet?}], from: Date, to: Date, gapMs: number (Infinity: none), labelNames?: boolean, height?: number, axisWidth?: number}
 * axisWidth is the least width in pixels of a value axis (see axisRoom()).
 * onZoom(from, to) turns a horizontal drag over the plot into a request for that window. Exact samples are marked
 * when the window holds few enough of them to be told apart.
 * quiet draws a series thin and pale, as the background of a series that carries the point (a floor over raw values).
 * labelNames false labels the end of a line with its value only, for a chart whose title already names it.
 * labelRoom is the least room in pixels to leave on the right for the labels (see labelRoom()).
 * onReset() is called on a double-click, after the value ranges chosen on the axes are dropped, so that the page can return
 * to the time window it started from.
 * info(topic) may return an element, an information control of the page, to put beside the title of the table of
 * statistics (topic "statistics") and at the end of the range strip (topic "range").
 * The range strip above the chart always shows the time window as an interval, with its date and time (strip false leaves it
 * out, for a page that shows the window itself); windowChosen true
 * says that the window was chosen and not the range of the page, which lights the controls given by onPan(direction) (earlier
 * is -1, later is 1; canPanLater false dims later) and onReset(). fromIncluded and toIncluded false write that end of the
 * interval with a parenthesis because the data at that end is left out; both are included unless a page says otherwise.
 * options is the object of buildChartOptions(): line shape, value scale, sample marks, running average and standard
 * deviation band; CHART_OPTIONS holds the values used until the viewer changes one.
 * projection true draws a histogram of the samples in view for each line at the right of the plot, on the value axis of
 * its unit, with a line at its mean, and puts a table of basic statistics under the chart, or in each element of
 * statisticsHost (an element of the page or a list of them) when the page gives one.
 * legend true gives each line a color and a dash and puts a legend under the chart in place of the labels at the
 * end of the lines; a click on a legend item hides that line until it is clicked again.
 * Replaces the content of host and returns nothing.
 */
export function drawTimeSeries(host, input) {
    host.textContent = "";
    // The table of statistics goes into each element of input.statisticsHost (one element or a list); under the chart
    // when the page gives none.
    const statisticsHosts = [].concat(input.statisticsHost || []);
    for (const element of statisticsHosts) {
        element.textContent = "";
    }
    const { series, from, to, gapMs } = input;
    const legend = input.legend === true;
    const all = finiteSeries(series);
    if (!all.length) {
        host.textContent = "No samples in this time range.";
        return;
    }
    let hidden = HIDDEN.get(host);
    if (!hidden) {
        hidden = new Set();
        HIDDEN.set(host, hidden);
    }
    for (const name of [...hidden]) {
        if (!all.some((s) => s.name === name)) {
            hidden.delete(name);
        }
    }
    const drawn = legend ? all.filter((s) => !hidden.has(s.name)) : all;
    const legendBox = legend ? buildLegend(host, all, hidden, () => drawTimeSeries(host, input)) : null;
    if (!drawn.length) {
        const note = document.createElement("p");
        note.textContent = "All lines are hidden. Click a legend item to show it.";
        host.append(note, legendBox);
        return;
    }
    const hostWidth = Math.max(320, host.clientWidth || 640);
    // The drawing is as wide as its host unless its axes and projection leave the plot too little room (see below).
    let width = hostWidth;
    const narrow = width < 560;
    // input.height is the height of the drawing in pixels; a taller drawing gets more ticks on its value axes.
    const height = Math.max(200, Math.floor(input.height || 250));
    const tickCount = Math.max(4, Math.round((height - 42) / 48));
    const labelNames = input.labelNames !== false;
    const layout = labelLayout(host, drawn, width, labelNames);
    const { names, labelText, widest } = layout;
    const right = legend ? 12 : Math.max(layout.right, Math.min(input.labelRoom || 0, Math.floor(width * 0.45)));
    // One value axis per unit, each with its own range: the first half on the left of the plot, the rest on the right.
    const units = [...new Set(drawn.map((s) => s.egu || ""))];
    const multi = units.length > 1;
    const onLeft = Math.ceil(units.length / 2);
    const onRight = units.length - onLeft;
    let ranges = RANGES.get(host);
    if (!ranges) {
        ranges = new Map();
        RANGES.set(host, ranges);
    }
    for (const unit of [...ranges.keys()]) {
        if (!units.includes(unit)) {
            ranges.delete(unit);
        }
    }
    const plotTop = multi ? 30 : 8;
    const plotBottomMargin = 34;
    const options = { ...CHART_OPTIONS, ...(input.options || {}) };
    const scaleNotes = [];
    const scales = new Map(
        units.map((unit) => {
            const values = drawn.filter((s) => (s.egu || "") === unit).flatMap((s) => s.points.map((p) => p.v));
            const made = makeValueScale(options.yscale, values, ranges.get(unit), [height - plotBottomMargin, plotTop], unit, tickCount);
            if (made.reason) {
                scaleNotes.push(made.reason);
            }
            return [unit, made.scale];
        })
    );
    const yOf = (s) => scales.get(s.egu || "");
    // The width of a value axis follows its widest tick label, and is at least what the page asks for (stacked charts).
    const axisWidth = Math.max(axisWidthOf([...scales.values()], tickCount), Math.floor(input.axisWidth || 0));
    const margin = {
        top: plotTop,
        right: right + axisWidth * onRight + (input.projection === true ? PROJECTION_WIDTH : 0),
        bottom: plotBottomMargin,
        left: axisWidth + axisWidth * (onLeft - 1),
    };
    // Axes and projection never take the plot below its least width: the drawing grows wider than its host, which
    // scrolls sideways inside its own box, and the page does not.
    if (width - margin.left - margin.right < PLOT_LEAST) {
        width = margin.left + margin.right + PLOT_LEAST;
    }
    const widened = width > hostWidth;
    const x = d3.scaleTime().domain([from, to]).range([margin.left, width - margin.right]);

    const svg = d3
        .create("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", widened ? width : "100%")
        .attr("height", height)
        .attr("role", "img")
        .attr("aria-label", `Time series of ${drawn.length} PV${drawn.length > 1 ? "s" : ""}`);

    const egu = drawn[0].egu;
    // The side and the x position of the line of the axis of the unit at position index.
    const axisAt = (index) => {
        const rightSide = index >= onLeft;
        const step = rightSide ? index - onLeft : index;
        return { rightSide, x: rightSide ? width - margin.right + axisWidth * step : margin.left - axisWidth * step };
    };
    units.forEach((unit, index) => {
        const scale = scales.get(unit);
        const { rightSide, x: axisX } = axisAt(index);
        for (const tick of scale.ticks(tickCount)) {
            if (index === 0) {
                svg.append("line").attr("class", "grid").attr("x1", margin.left).attr("x2", width - margin.right).attr("y1", scale(tick)).attr("y2", scale(tick));
            }
            svg.append("text")
                .attr("class", "axis")
                .attr("x", rightSide ? axisX + 6 : axisX - 6)
                .attr("y", scale(tick) + 4)
                .attr("text-anchor", rightSide ? "start" : "end")
                .text(d3.format(".4~g")(tick));
        }
        if (multi) {
            svg.append("line").attr("class", "axis-line").attr("x1", axisX).attr("x2", axisX).attr("y1", margin.top).attr("y2", height - margin.bottom);
            svg.append("text")
                .attr("class", "axis unit")
                .attr("x", axisX)
                .attr("y", margin.top - 14)
                .attr("text-anchor", rightSide ? "start" : "end")
                .text(unit || "no unit");
        }
    });
    const spanHours = (to - from) / 3600000;
    // A window of ten minutes or less is labelled to the second, so that its four labels differ.
    // The labels are written in the chosen zone at each instant, so a change of daylight saving time falls at its true place.
    const timeFormat = (when) => formatInZone(when, spanHours > 36 ? "%m-%d %H:%M" : spanHours > 1 / 6 ? "%H:%M" : "%H:%M:%S", input.timeZone);
    [0, 1 / 3, 2 / 3, 1].forEach((fraction, index, all) => {
        const when = new Date(from.getTime() + fraction * (to - from));
        svg.append("text")
            .attr("class", "axis")
            .attr("x", x(when))
            .attr("y", height - 8)
            .attr("text-anchor", index === 0 ? "start" : index === all.length - 1 ? "end" : "middle")
            .text(timeFormat(when));
    });

    // Alarm lane: the only mark besides a line that uses the alert color.
    const laneY = height - margin.bottom + 8;
    for (const s of drawn) {
        for (const point of s.points) {
            if (point.s > 0) {
                svg.append("rect").attr("class", "alarm").attr("x", x(point.t) - 1).attr("y", laneY).attr("width", 3).attr("height", 4);
            }
        }
    }

    const clipId = `aa-chart-clip-${(clipCount += 1)}`;
    svg.append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("x", margin.left - CLIP_PAD)
        .attr("y", margin.top - CLIP_PAD)
        .attr("width", width - margin.right - margin.left + 2 * CLIP_PAD)
        .attr("height", height - margin.bottom - margin.top + 2 * CLIP_PAD);
    const plotArea = svg.append("g").attr("clip-path", `url(#${clipId})`);
    const curve = { step: d3.curveStepAfter, line: d3.curveLinear, smooth: d3.curveMonotoneX }[options.shape] || d3.curveStepAfter;
    const lineOf = (s) => d3.line().x((p) => x(p.t)).y((p) => yOf(s)(p.v)).curve(curve);
    const ordered = drawn.slice().sort((a, b) => Number(a.focus) - Number(b.focus));
    const labels = [];
    const inView = (s) => s.points.filter((p) => p.t >= from.getTime() && p.t <= to.getTime());
    ordered.forEach((s) => {
        const slot = all.indexOf(s);
        const look = legend ? lineLook(s, slot) : null;
        const color = look ? look.color : null;
        for (const part of splitOnGaps(s.points, gapMs)) {
            // A band of one standard deviation and a running average of the last samples, under the line itself.
            if ((options.band || options.average) && part.length > 1) {
                const stats = movingStats(part.map((p) => p.v), options.window);
                const scale = yOf(s);
                const [lowest] = d3.extent(scale.domain());
                if (options.band) {
                    const area = d3.area()
                        .x((p) => x(p.t))
                        .y0((p, i) => scale(Math.max(stats[i].mean - stats[i].deviation, lowest)))
                        .y1((p, i) => scale(stats[i].mean + stats[i].deviation))
                        .curve(d3.curveLinear);
                    const band = plotArea.append("path").attr("class", "band").attr("d", area(part));
                    if (color) {
                        band.style("fill", color);
                    }
                }
                if (options.average) {
                    const average = d3.line().x((p) => x(p.t)).y((p, i) => scale(stats[i].mean)).curve(d3.curveLinear);
                    const path = plotArea.append("path").attr("class", "average").attr("d", average(part));
                    if (color) {
                        path.style("stroke", color);
                    }
                }
            }
            if (options.shape === "points") {
                continue;
            }
            const path = plotArea.append("path")
                .attr("class", s.focus ? "line focus" : s.quiet ? "line quiet" : "line")
                .attr("stroke-dasharray", look ? look.dash : s.focus ? null : DASHES[slot % DASHES.length] || null)
                .attr("d", lineOf(s)(part));
            if (look) {
                path.style("stroke", look.color).style("stroke-width", look.width);
                if (s.quiet) {
                    // A series that is only the background of another one stays pale in a chart with a legend too.
                    path.style("opacity", "0.6");
                }
            }
        }
        const last = s.points[s.points.length - 1];
        labels.push({ y: yOf(s)(last.v), series: s, last });
    });

    // The samples themselves: automatically once few enough are in view to be told apart, or on every sample, or never.
    const showMarks = options.shape === "points" || options.marks === "on"
        || (options.marks === "auto" && drawn.every((s) => inView(s).length <= MARKER_LIMIT));
    if (showMarks) {
        for (const s of ordered) {
            const inside = inView(s);
            const stride = Math.max(1, Math.ceil(inside.length / MARK_CAP));
            for (const point of inside.filter((p, i) => i % stride === 0)) {
                const dot = plotArea.append("circle")
                    .attr("class", s.focus ? "dot focus" : "dot")
                    .attr("cx", x(point.t))
                    .attr("cy", yOf(s)(point.v))
                    .attr("r", 2.4);
                if (legend) {
                    dot.style("stroke", lineLook(s, all.indexOf(s)).color);
                }
            }
        }
    }

    // The Y projection: for each line the samples in view in bins of the value axis of its unit, drawn as bars growing
    // to the right from the edge of the band, and a line at the mean. The samples in view are those inside the time
    // window and, when the viewer dragged a value range out on the axis of the unit, inside that range.
    const statistics = drawProjection(svg, { drawn, all, ranges, inView, yOf, projection: input.projection, width, margin, axisWidth, onRight });

    // Direct labels at the end of each line, pushed apart so they do not overlap.
    labels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i += 1) {
        if (labels[i].y - labels[i - 1].y < 13) {
            labels[i].y = labels[i - 1].y + 13;
        }
    }
    const room = right - 6;
    for (const label of legend ? [] : labels) {
        const full = labelText(label.series, drawn.indexOf(label.series));
        // A label that still does not fit the room is shortened with an ellipsis; its full text is the title.
        const text = widest <= room ? full : `${full.slice(0, Math.max(4, Math.floor((full.length * room) / widest) - 1))}\u2026`;
        const element = svg.append("text")
            .attr("class", label.series.focus ? "label focus" : "label")
            .attr("x", width - right + 6)
            .attr("y", label.y + 4)
            .text(text);
        if (text !== full) {
            element.append("title").text(full);
        }
    }

    const cross = svg.append("line").attr("class", "cross").attr("y1", margin.top).attr("y2", height - margin.bottom).attr("visibility", "hidden");
    const tip = document.createElement("div");
    tip.className = "tip";
    tip.hidden = true;
    const bisect = d3.bisector((p) => p.t).center;

    svg.on("pointermove", (event) => {
        const box = svg.node().getBoundingClientRect();
        const px = ((event.clientX - box.left) / box.width) * width;
        if (px < margin.left || px > width - margin.right) {
            cross.attr("visibility", "hidden");
            tip.hidden = true;
            return;
        }
        const when = x.invert(px);
        tip.textContent = "";
        const heading = document.createElement("b");
        heading.textContent = formatInZone(when, "%Y-%m-%d %H:%M:%S", input.timeZone);
        tip.append(heading);
        let nearest = null;
        for (const s of drawn) {
            const point = s.points[bisect(s.points, when.getTime())];
            const row = document.createElement("div");
            row.textContent = `${names[drawn.indexOf(s)]}  ${point ? format(point.v, s.egu) : "no sample"}${point && point.s ? "  ALARM" : ""}`;
            if (point && point.s) {
                row.className = "alarm-text";
            }
            tip.append(row);
            if (point && (!nearest || Math.abs(point.t - when) < Math.abs(nearest.t - when))) {
                nearest = point;
            }
        }
        cross.attr("visibility", "visible").attr("x1", x(nearest ? nearest.t : when)).attr("x2", x(nearest ? nearest.t : when));
        tip.hidden = false;
        const left = (px / width) * box.width + 12;
        tip.style.left = `${left > box.width - 240 ? left - 252 : left}px`;
        tip.style.top = "8px";
    });
    svg.on("pointerleave", () => {
        cross.attr("visibility", "hidden");
        tip.hidden = true;
    });

    attachGestures({ svg, host, input, redraw: () => drawTimeSeries(host, input), x, scales, units, ranges, width, height, margin, plotTop, axisWidth, onLeft, onRight, axisAt });

    if (input.strip !== false) {
        host.append(buildRangeStrip(input, ranges, units, () => drawTimeSeries(host, input)));
    }
    host.append(svg.node(), tip);
    if (legendBox) {
        host.append(legendBox);
    }
    if (scaleNotes.length) {
        const note = document.createElement("p");
        note.className = "chart-note";
        note.setAttribute("role", "status");
        note.textContent = scaleNotes.join(" ");
        host.append(note);
    }
    if (input.projection === true) {
        for (const element of statisticsHosts.length ? statisticsHosts : [host]) {
            element.append(buildStatistics(statistics, typeof input.info === "function" ? input.info("statistics") : null));
        }
    }
    host.dataset.egu = egu;
}
