// Time series drawing with D3 scales and shapes. Principles: ink goes to the data, the axes carry only the
// range, lines are labelled directly, missing data is a gap, and a monitored value is held until the next sample.

const d3 = globalThis.d3;

import { CHART_OPTIONS } from "./options.js";
import { RANGES } from "./gestures.js";
import { createPlotCanvas } from "./canvas.js";
import { preserveViewport } from "./viewport.js";
import { buildLegend, HIDDEN, LEGEND_DEFAULT_STATISTICS } from "./legend.js";
import { labelLayout } from "./layout.js";
import { axisWidthOf, makeValueScale, PLOT_LEAST } from "./scales.js";
import { DASHES, finiteSeries, lineLook, markerPath, movingStats, splitOnGaps } from "./series.js";
import { buildStatistics } from "./statistics.js";
import { buildRangeStrip } from "./strip.js";
import { buildCursorTable, heldObservation } from "./cursors.js";
import { format } from "./text.js";
import { formatInZone } from "../timezone.js";
import { drawProjection, PROJECTION_WIDTH } from "./projection.js";

// More samples than this in view are not marked one by one.
export const MARKER_LIMIT = 200;

// The most sample marks drawn for one line when marks are asked for on every sample.
const MARK_CAP = 1500;

/** The display settings of a chart with the full options, with the value each has until it is changed. */
export const DISPLAY_DEFAULTS = {
    split: "none", legend: "list", legendstat: LEGEND_DEFAULT_STATISTICS, tooltip: "all", tipsort: "series", grid: "y", endlabels: false,
};

// The dash patterns a signal can be given by name; auto follows the display profile.
const DASH_PATTERNS = { solid: "", dash: "8 4", dot: "2 3", dashdot: "9 3 2 3" };

/**
 * timeZone is the zone the labels, the tooltip and the strip are written in (an IANA identifier, UTC or browser); without it the browser zone.
 * input: {series: [{name, egu, points: [{t, v, s, g?}], focus, quiet?, minmax?}], from: Date, to: Date, gapMs: number (Infinity: none), labelNames?: boolean, height?: number, axisWidth?: number}
 * axisWidth is the least width in pixels of a value axis (see axisRoom()).
 * onZoom(from, to) turns a horizontal drag over the plot into a request for that window. Exact samples are marked
 * when the window holds few enough of them to be told apart.
 * quiet draws a series thin and pale, as the background of a series that carries the point (a floor over raw values).
 * minmax ({min: points, max: points}) draws the band between the min and the max of the display means under the line.
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
 * statistics true emits the table even without projection; statisticsTitle names it. ranges (Map by unit) and hidden
 * (Set by name) can be supplied by the caller; onRangesChange and onVisibilityChange report pointer, keyboard and reset changes.
 * fitWidth scales a multi-axis drawing to the host width instead of widening the page.
 * legend true gives each line a color and a dash and puts a legend under the chart in place of the labels at the
 * end of the lines; a click on a legend item hides that line until it is clicked again.
 * Replaces the content of host and returns its canvas (the first panel's, when split), or undefined when no series is visible.
 * overlay(canvas) can append clipped data layers; it is called for each panel with the canvas of the panel. keyboardX and wheel enable optional X navigation.
 * tool, nav, navUnit and selection, with onSelect and onNavigate, are the navigation inputs of the canvas (see
 * gestures.js); hover false leaves the tooltip out. pins ([{name, t, v}]) are drawn on the lines they belong to and
 * onPin(observation) receives the sample nearest to a Shift+click; cursors ([time or null, time or null]) and
 * onCursorChange(index, time) place the two reference cursors, whose readings are tabled under the chart.
 * display ({split, legend, legendstat, tooltip, tipsort, grid, endlabels}, see DISPLAY_DEFAULTS), signals (Map of
 * series name to {width, dash, gap, fill, decimals, name}) and axes (Map of unit to {scale, symlog, softmin, softmax,
 * zero, prefix, label}) are the full options of the analyzer; a chart without display keeps the simple form.
 */
export function drawTimeSeries(host, input) {
    return preserveViewport(() => drawSeries(host, input));
}

/** The value a series holds at time t on its points, by the gap rule of the series, or null. */
function heldAt(points, gapMs, t) {
    const observation = heldObservation(points, gapMs, t);
    return observation ? observation.v : null;
}

/**
 * The paired samples of two series for the fill between them: at every time either series has a sample inside the
 * span where both hold a value, the value each holds there; a time where either has none ends a run.
 */
function pairedRuns(a, b, gapA, gapB) {
    const times = [...new Set([...a.points, ...b.points].map((p) => p.t))].sort((p, q) => p - q);
    const runs = [];
    let run = [];
    for (const t of times) {
        const va = heldAt(a.points, gapA, t);
        const vb = heldAt(b.points, gapB, t);
        if (va === null || vb === null) {
            if (run.length > 1) runs.push(run);
            run = [];
            continue;
        }
        run.push({ t, a: va, b: vb });
    }
    if (run.length > 1) runs.push(run);
    return runs;
}

function drawSeries(host, input) {
    // The panels keep their elements across redraws: the navigation behavior of a panel is bound to its element, and a
    // gesture that redraws the chart under the pointer continues on the same element.
    const keptPanels = [...host.children].filter((element) => element.classList.contains("chart-panel"));
    host.textContent = "";
    // The table of statistics goes into each element of input.statisticsHost (one element or a list); under the chart
    // when the page gives none.
    const statisticsHosts = [].concat(input.statisticsHost || []);
    for (const element of statisticsHosts) {
        element.textContent = "";
    }
    const { series, from, to, gapMs } = input;
    const full = Boolean(input.display);
    const display = { ...DISPLAY_DEFAULTS, ...(input.display || {}) };
    const signals = input.signals instanceof Map ? input.signals : new Map();
    const axes = input.axes instanceof Map ? input.axes : new Map();
    const legendMode = full ? display.legend : input.legend === true ? "list" : "off";
    // A chart with a legend or the full options draws its lines through the combinations of the profile (combinations true too).
    const styled = full || input.legend === true || input.combinations === true;
    const all = finiteSeries(series);
    if (!all.length) {
        host.textContent = "No samples in this time range.";
        return;
    }
    let hidden = input.hidden || HIDDEN.get(host);
    if (!hidden) {
        hidden = new Set();
        HIDDEN.set(host, hidden);
    }
    for (const name of input.hidden ? [] : [...hidden]) {
        if (!all.some((s) => s.name === name)) {
            hidden.delete(name);
        }
    }
    // Hidden lines stay hidden whatever the legend shows; a chart without a legend and without a hidden set draws all.
    const hides = Boolean(input.hidden) || legendMode !== "off";
    const drawn = hides ? all.filter((s) => !hidden.has(s.name)) : all;
    const redrawAll = () => {
        drawTimeSeries(host, input);
        if (typeof input.onVisibilityChange === "function") input.onVisibilityChange([...hidden]);
    };
    const settingOf = (s) => signals.get(s.name) || {};
    const axisOf = (unit) => axes.get(unit) || {};
    const labels = new Map(all.map((s) => [s.name, typeof settingOf(s).name === "string" && settingOf(s).name ? settingOf(s).name : s.name]));
    const lookOf = (s) => {
        const look = lineLook(s, all.indexOf(s));
        const setting = settingOf(s);
        if (Number.isFinite(setting.width)) look.width = setting.width;
        if (typeof setting.dash === "string" && setting.dash in DASH_PATTERNS) look.dash = DASH_PATTERNS[setting.dash] || null;
        return look;
    };
    const looks = new Map(all.map((s) => [s.name, lookOf(s)]));
    // The text of a value of a series: the decimals the page chose, or the SI prefix of its unit written before the
    // unit (0.7499 V becomes 749.9 mV), or the ordinary form.
    const valueText = (s, v, withUnit = true) => {
        const decimals = settingOf(s).decimals;
        const prefixed = axisOf(s.egu || "").prefix === "si";
        if (prefixed && !Number.isInteger(decimals)) {
            const si = d3.format(".4~s")(v);
            const letter = /[a-zA-Zµ]$/.test(si) ? si.slice(-1) : "";
            const number = letter ? si.slice(0, -1) : si;
            return withUnit && s.egu ? `${number} ${letter}${s.egu}` : si;
        }
        const text = Number.isInteger(decimals) ? v.toFixed(decimals) : format(v, "");
        return `${text}${withUnit && s.egu ? ` ${s.egu}` : ""}`;
    };
    const gapOf = (s) => (Number.isFinite(settingOf(s).gap) && settingOf(s).gap > 0 ? settingOf(s).gap * 1000 : gapMs);
    const legendOptions = { mode: legendMode, statistics: display.legendstat, labels, looks, values: new Map(), format: (v, s) => valueText(s, v, false) };
    if (!drawn.length) {
        const note = document.createElement("p");
        note.textContent = "All lines are hidden. Click a legend item to show it.";
        host.append(note);
        if (legendMode !== "off") host.append(buildLegend(host, all, hidden, redrawAll, legendOptions));
        return;
    }
    const hostWidth = Math.max(320, host.clientWidth || 640);
    // The drawing is as wide as its host unless its axes and projection leave the plot too little room (see below).
    let width = hostWidth;
    // input.height is the height of the drawing in pixels; a taller drawing gets more ticks on its value axes.
    const height = Math.max(200, Math.floor(input.height || 250));
    const tickCount = Math.max(4, Math.round((height - 42) / 48));
    const labelNames = input.labelNames !== false;
    const layout = labelLayout(host, drawn, width, labelNames);
    const names = drawn.map((s) => labels.get(s.name));
    const endLabels = full ? display.endlabels === true : legendMode === "off";
    const right = !endLabels ? 12 : Math.max(layout.right, Math.min(input.labelRoom || 0, Math.floor(width * 0.45)));
    // One value axis per unit, each with its own range: the first half on the left of the plot, the rest on the right;
    // or, split by unit, one panel per unit under another with the axis on its left.
    const units = [...new Set(drawn.map((s) => s.egu || ""))];
    const panels = display.split === "unit" && units.length > 1 ? units.map((unit) => [unit]) : [units];
    const multi = units.length > 1;
    let ranges = input.ranges || RANGES.get(host);
    if (!ranges) {
        ranges = new Map();
        RANGES.set(host, ranges);
    }
    for (const unit of input.ranges ? [] : [...ranges.keys()]) {
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
            const axis = axisOf(unit);
            const values = drawn.filter((s) => (s.egu || "") === unit).flatMap((s) => s.points.map((p) => p.v));
            const made = makeValueScale(axis.scale || options.yscale, values, ranges.get(unit), [height - plotBottomMargin, plotTop], unit, tickCount,
                { soft: [Number.isFinite(axis.softmin) ? axis.softmin : null, Number.isFinite(axis.softmax) ? axis.softmax : null], zero: axis.zero === true, symlog: axis.symlog });
            if (made.reason) {
                scaleNotes.push(made.reason);
            }
            return [unit, made.scale];
        })
    );
    const tickFormats = new Map(units.map((unit) => [unit, axisOf(unit).prefix === "si" ? d3.format(".4~s") : d3.format(".4~g")]));
    const axisLabels = new Map(units.map((unit) => [unit, typeof axisOf(unit).label === "string" && axisOf(unit).label ? axisOf(unit).label : unit || "no unit"]));
    const yOf = (s) => scales.get(s.egu || "");
    // The width of a value axis follows its widest tick label, and is at least what the page asks for (stacked charts).
    const axisWidth = Math.max(axisWidthOf(scales, tickCount, tickFormats), Math.floor(input.axisWidth || 0));
    // The margins are those of the widest panel, so that every panel shares one time axis.
    const onLeftOf = (panelUnits) => Math.ceil(panelUnits.length / 2);
    const mostLeft = Math.max(...panels.map((panelUnits) => onLeftOf(panelUnits)));
    const mostRight = Math.max(...panels.map((panelUnits) => panelUnits.length - onLeftOf(panelUnits)));
    const margin = {
        top: plotTop,
        right: right + axisWidth * mostRight + (input.projection === true ? PROJECTION_WIDTH : 0),
        bottom: plotBottomMargin,
        left: axisWidth + axisWidth * (mostLeft - 1),
    };
    // Axes and projection never take the plot below its least width: the drawing grows wider than its host, which
    // scrolls sideways inside its own box, and the page does not.
    if (width - margin.left - margin.right < PLOT_LEAST) {
        width = margin.left + margin.right + PLOT_LEAST;
    }
    const widened = width > hostWidth;
    const x = d3.scaleTime().domain([from, to]).range([margin.left, width - margin.right]);

    const spanHours = (to - from) / 3600000;
    const timeFormat = (when) => formatInZone(when, spanHours > 36 ? "%m-%d %H:%M" : spanHours > 1 / 6 ? "%H:%M" : "%H:%M:%S", input.timeZone);
    const curve = { step: d3.curveStepAfter, line: d3.curveLinear, smooth: d3.curveMonotoneX }[options.shape] || d3.curveStepAfter;
    const inView = (s) => s.points.filter((p) => p.t >= from.getTime() && p.t <= to.getTime());
    const bisect = d3.bisector((p) => p.t).center;
    const rangeChanged = () => {
        drawTimeSeries(host, input);
        if (typeof input.onRangesChange === "function") input.onRangesChange([...ranges]);
    };
    const preview = () => drawTimeSeries(host, input);
    // While a navigation gesture runs, the samples at hand are drawn at the window the pointer asks for; nothing is retrieved.
    const onNavigate = typeof input.onNavigate === "function" ? input.onNavigate
        : (low, high) => drawTimeSeries(host, { ...input, from: low, to: high, windowChosen: true });
    // A Shift+click picks the drawn sample nearest to the pointer, for the page to pin.
    const onPoint = typeof input.onPin !== "function" ? undefined : ({ px, py }) => {
        let best = null;
        for (const s of drawn) {
            const point = s.points[bisect(s.points, x.invert(px).getTime())];
            if (!point) continue;
            const distance = Math.hypot(x(point.t) - px, yOf(s)(point.v) - py);
            if (!best || distance < best.distance) best = { distance, series: s, point };
        }
        if (best) input.onPin({ name: best.series.name, egu: best.series.egu || "", t: best.point.t, v: best.point.v, s: best.point.s });
    };
    // The tooltip: the sample of every drawn line nearest to the time under the pointer (all), or of the nearest line
    // only (single), in the order of the lines or by value.
    const pickAt = (panelSeries) => ({ px, py, x: when }) => {
        const at = when.getTime();
        const candidates = drawn.map((s) => ({ series: s, point: s.points[bisect(s.points, at)] || null }));
        let nearest = null;
        for (const candidate of candidates) {
            if (!candidate.point || !panelSeries.includes(candidate.series)) continue;
            const distance = Math.hypot(x(candidate.point.t) - px, yOf(candidate.series)(candidate.point.v) - py);
            if (!nearest || distance < nearest.distance) nearest = { ...candidate, distance };
        }
        let shown = display.tooltip === "single" ? (nearest ? [nearest] : []) : candidates;
        if (display.tipsort === "asc" || display.tipsort === "desc") {
            const sign = display.tipsort === "asc" ? 1 : -1;
            shown = shown.slice().sort((a, b) => {
                if (!a.point && !b.point) return 0;
                if (!a.point) return 1;
                if (!b.point) return -1;
                return sign * (a.point.v - b.point.v);
            });
        }
        if (!shown.length) return null;
        const rows = shown.map(({ series: s, point }) => `${labels.get(s.name)}  ${point ? valueText(s, point.v) : "no sample"}${point && point.s ? "  ALARM" : ""}`);
        const marked = nearest ? nearest.point : null;
        return { title: formatInZone(when, "%Y-%m-%d %H:%M:%S", input.timeZone), rows,
            px: marked ? x(marked.t) : undefined, py: marked ? yOf(nearest.series)(marked.v) : undefined };
    };

    if (input.strip !== false) {
        host.append(buildRangeStrip(input, ranges, units, rangeChanged));
    }

    const statistics = [];
    let firstCanvas = null;
    panels.forEach((panelUnits, panelIndex) => {
        const panelHost = keptPanels[panelIndex] || document.createElement("div");
        panelHost.className = "chart-panel";
        panelHost.textContent = "";
        const panelSeries = drawn.filter((s) => panelUnits.includes(s.egu || ""));
        const onLeft = onLeftOf(panelUnits);
        const panelScales = new Map(panelUnits.map((unit) => [unit, scales.get(unit)]));
        const last = panelIndex === panels.length - 1;
        const canvas = createPlotCanvas({ width, height, margin, x, scales: panelScales, units: panelUnits, axisWidth, onLeft, tickCount,
            displayWidth: widened && !input.fitWidth ? width : "100%", unitLabels: multi, axisLabels, grid: display.grid, tickFormats,
            xTickLabels: last,
            label: `Time series of ${panelSeries.length} PV${panelSeries.length > 1 ? "s" : ""}${panels.length > 1 ? ` in ${panelUnits[0] || "no unit"}` : ""}`,
            xTicks: [0, 1 / 3, 2 / 3, 1].map(fraction => new Date(from.getTime() + fraction * (to - from))),
            xFormat: timeFormat });
        const { svg, marks: plotArea } = canvas;
        firstCanvas ||= canvas;

        // Alarm lane: the only mark besides a line that uses the alert color.
        const laneY = height - margin.bottom + 8;
        for (const s of panelSeries) {
            for (const point of s.points) {
                if (point.s > 0) {
                    svg.append("rect").attr("class", "alarm").attr("x", x(point.t) - 1).attr("y", laneY).attr("width", 3).attr("height", 4);
                }
            }
        }

        const lineOf = (s) => d3.line().x((p) => x(p.t)).y((p) => yOf(s)(p.v)).curve(curve);
        const ordered = panelSeries.slice().sort((a, b) => Number(a.focus) - Number(b.focus));
        const endLabelList = [];
        // The fill between two signals of one unit, under both lines, on the times where both hold a value.
        for (const s of ordered) {
            const partner = drawn.find((other) => other.name === settingOf(s).fill);
            if (!partner || partner === s || (partner.egu || "") !== (s.egu || "") || !panelUnits.includes(s.egu || "")) continue;
            if (drawn.find((other) => settingOf(other).fill === s.name && drawn.indexOf(other) < drawn.indexOf(s))) continue;
            const scale = yOf(s);
            for (const run of pairedRuns(s, partner, gapOf(s), gapOf(partner))) {
                const area = d3.area().x((p) => x(p.t)).y0((p) => scale(p.a)).y1((p) => scale(p.b)).curve(options.shape === "step" ? d3.curveStepAfter : d3.curveLinear);
                plotArea.append("path").attr("class", "fill").attr("d", area(run)).style("fill", looks.get(s.name).color);
            }
        }
        ordered.forEach((s) => {
            const slot = all.indexOf(s);
            const look = styled ? looks.get(s.name) : null;
            const color = look ? look.color : null;
            const scale = yOf(s);
            // The band between the min and the max of the display means, under the line of the mean.
            if (s.minmax && Array.isArray(s.minmax.min) && Array.isArray(s.minmax.max)) {
                const maxAt = new Map(s.minmax.max.map((p) => [p.t, p]));
                const pairs = s.minmax.min.filter((p) => maxAt.has(p.t)).map((p) => ({ t: p.t, lo: p.v, hi: maxAt.get(p.t).v, g: p.g || maxAt.get(p.t).g }));
                for (const part of splitOnGaps(pairs, gapOf(s))) {
                    const area = d3.area().x((p) => x(p.t)).y0((p) => scale(p.lo)).y1((p) => scale(p.hi)).curve(d3.curveStepAfter);
                    const band = plotArea.append("path").attr("class", "minmax").attr("d", area(part));
                    if (color) band.style("fill", color);
                }
            }
            for (const part of splitOnGaps(s.points, gapOf(s))) {
                // A band of one standard deviation and a running average of the last samples, under the line itself.
                if ((options.band || options.average) && part.length > 1) {
                    const stats = movingStats(part.map((p) => p.v), options.window);
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
            // The name at the end of a line stands at its last visible finite observation.
            const visible = inView(s);
            const lastPoint = visible.length ? visible[visible.length - 1] : null;
            if (lastPoint) endLabelList.push({ y: scale(lastPoint.v), series: s, last: lastPoint });
        });

        // The samples themselves: automatically once few enough are in view to be told apart, or on every sample, or never.
        const showMarks = options.shape === "points" || options.marks === "on"
            || (options.marks === "auto" && drawn.every((s) => inView(s).length <= MARKER_LIMIT));
        if (showMarks) {
            for (const s of ordered) {
                const inside = inView(s);
                const stride = Math.max(1, Math.ceil(inside.length / MARK_CAP));
                const look = styled ? looks.get(s.name) : null;
                for (const point of inside.filter((p, i) => i % stride === 0)) {
                    const cx = x(point.t);
                    const cy = yOf(s)(point.v);
                    const dot = look
                        ? plotArea.append("path").attr("d", markerPath(look.marker)).attr("transform", `translate(${cx},${cy})`)
                        : plotArea.append("circle").attr("cx", cx).attr("cy", cy).attr("r", 2.4);
                    dot.attr("class", s.focus ? "dot focus" : "dot");
                    if (look) {
                        dot.style("stroke", look.color);
                    }
                }
            }
        }

        // The Y projection: for each line the samples in view in bins of the value axis of its unit, drawn as bars growing
        // to the right from the edge of the band, and a line at the mean. The samples in view are those inside the time
        // window and, when the viewer dragged a value range out on the axis of the unit, inside that range.
        const onRight = panelUnits.length - onLeft;
        statistics.push(...drawProjection(svg, { drawn: panelSeries, all, ranges, inView, yOf, projection: input.projection, width, margin, axisWidth, onRight }));

        // Direct labels at the end of each line, pushed apart so they do not overlap.
        endLabelList.sort((a, b) => a.y - b.y);
        for (let i = 1; i < endLabelList.length; i += 1) {
            if (endLabelList[i].y - endLabelList[i - 1].y < 13) {
                endLabelList[i].y = endLabelList[i - 1].y + 13;
            }
        }
        const room = right - 6;
        for (const label of endLabels ? endLabelList : []) {
            const name = labels.get(label.series.name);
            const value = valueText(label.series, label.last.v, false);
            const text0 = !labelNames ? value : width < 560 ? name : `${name}  ${value}`.trim();
            // A label that still does not fit the room is shortened with an ellipsis; its full text is the title.
            const widest = layout.widest;
            const text = widest <= room ? text0 : `${text0.slice(0, Math.max(4, Math.floor((text0.length * room) / Math.max(widest, 1)) - 1))}…`;
            const element = svg.append("text")
                .attr("class", label.series.focus ? "label focus" : "label")
                .attr("x", width - right + 6)
                .attr("y", label.y + 4)
                .text(text);
            if (text !== text0) {
                element.append("title").text(text0);
            }
        }

        if (typeof input.overlay === "function") input.overlay(canvas);

        // The pins of the page on the lines of this panel; a pin of a hidden line waits in the page's state, and a pin
        // without a value (unavailable) is listed by the page but not drawn.
        const pins = (Array.isArray(input.pins) ? input.pins : []).flatMap((pin) => {
            const s = panelSeries.find((series) => series.name === pin.name);
            return s && Number.isFinite(pin.v) ? [{ x: new Date(pin.t), y: pin.v, unit: s.egu || "", text: valueText(s, pin.v, false) }] : [];
        });
        canvas.bindInteractions(panelHost, { ...input, ranges, pins, onPoint, onNavigate }, rangeChanged, preview);
        if (input.hover !== false) {
            canvas.bindHover(panelHost, pickAt(panelSeries));
        }
        panelHost.append(svg.node());
        host.append(panelHost);
    });

    for (const row of statistics) {
        legendOptions.values.set(row.name, row.values);
    }
    if (legendMode !== "off") {
        host.append(buildLegend(host, all, hidden, redrawAll, legendOptions));
    }
    const cursors = Array.isArray(input.cursors) ? input.cursors : [];
    if (cursors.some((time) => time !== null && time !== undefined)) {
        host.append(buildCursorTable(drawn, names, cursors, gapOf, input.timeZone, (s, v) => valueText(s, v)));
    }
    if (scaleNotes.length) {
        const note = document.createElement("p");
        note.className = "chart-note";
        note.setAttribute("role", "status");
        note.textContent = scaleNotes.join(" ");
        host.append(note);
    }
    if (input.projection === true || input.statistics === true) {
        for (const element of statisticsHosts.length ? statisticsHosts : [host]) {
            element.append(buildStatistics(statistics, typeof input.info === "function" ? input.info("statistics") : null, input.statisticsTitle));
        }
    }
    host.dataset.egu = drawn[0].egu;
    return firstCanvas;
}
