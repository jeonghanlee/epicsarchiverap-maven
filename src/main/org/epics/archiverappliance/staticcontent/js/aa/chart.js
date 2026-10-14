// Time series drawing with D3 scales and shapes. Principles: ink goes to the data, the axes carry only the
// range, lines are labelled directly, missing data is a gap, and a monitored value is held until the next sample.
const d3 = globalThis.d3;

// The least width of one value axis with its tick labels, and the width one label character needs at the font of the axes.
const AXIS_WIDTH_LEAST = 56;
const AXIS_CHAR = 8.6;

const DASHES = ["", "", "6 3", "2 3", "9 3 2 3"];

// The colors of the lines of a chart that has a legend, by position in the series list.
const PALETTE = ["#007681", "#5a6b70", "#b36b00", "#6a4c93", "#b3261e", "#2e7d32", "#c2185b", "#1565c0", "#7b5e00", "#455a64"];

const SVG_NS = "http://www.w3.org/2000/svg";

// The names of the lines a viewer has hidden through the legend, kept per chart host across redraws.
const HIDDEN = new WeakMap();

// The value ranges a viewer chose by a drag along an axis, by unit, kept per chart host across redraws.
const RANGES = new WeakMap();

// A drag shorter than this many pixels is a click and chooses nothing.
const DRAG_LEAST = 6;

// The Y projection: the room right of the right axes, the bins of a histogram and its longest bar, in pixels.
const PROJECTION_WIDTH = 140;
const PROJECTION_BINS = 24;
const PROJECTION_BAR = 100;

// The lines and sample marks are clipped to the plot area; each drawing takes the next id of the page.
let clipCount = 0;
const CLIP_PAD = 3;

/** A value with a precision by magnitude: values below 0.001 in exponent form so that a pressure never reads as 0. */
function format(value, egu) {
    const magnitude = Math.abs(value);
    let text;
    if (value === 0) {
        text = "0";
    } else if (magnitude < 1e-3) {
        text = value.toExponential(2);
    } else {
        text = value.toFixed(magnitude >= 100 ? 1 : magnitude >= 1 ? 3 : 4);
    }
    return `${text}${egu ? ` ${egu}` : ""}`;
}

/** The look of the line of the series at position slot of a chart that has a legend. */
function lineLook(series, slot) {
    return { color: PALETTE[slot % PALETTE.length], dash: DASHES[slot % DASHES.length] || null, width: series.focus ? 2.5 : 1.8 };
}

/**
 * The table of basic statistics of the samples in view, one row per drawn series: samples, minimum, mean, median,
 * maximum, standard deviation and the unit.
 */
function buildStatistics(rows, info) {
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

/** The legend under a chart: one button per series with its line, name and unit; a click hides or shows that line. */
function buildLegend(host, all, hidden, redraw) {
    const box = document.createElement("div");
    box.className = "legend";
    box.setAttribute("aria-label", "Legend");
    all.forEach((s, slot) => {
        const off = hidden.has(s.name);
        const look = lineLook(s, slot);
        const item = document.createElement("button");
        item.type = "button";
        item.className = "item";
        item.dataset.series = s.name;
        item.setAttribute("aria-pressed", String(!off));
        item.title = `${off ? "Show" : "Hide"} ${s.name}`;
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
        item.append(swatch, document.createTextNode(s.name));
        if (s.egu) {
            const unit = document.createElement("span");
            unit.className = "unit";
            unit.textContent = s.egu;
            item.append(" ", unit);
        }
        item.addEventListener("click", () => {
            if (hidden.has(s.name)) {
                hidden.delete(s.name);
            } else {
                hidden.add(s.name);
            }
            redraw();
            // The redraw replaced the buttons; the keyboard stays on the item that was pressed.
            for (const button of host.querySelectorAll(".legend button")) {
                if (button.dataset.series === s.name) {
                    button.focus();
                }
            }
        });
        box.append(item);
    });
    return box;
}

/** Names without the leading segments they all share; a single name stays whole. */
function shortNames(names) {
    if (names.length < 2) {
        return names;
    }
    const parts = names.map((name) => name.split(":"));
    let shared = 0;
    while (shared < Math.min(...parts.map((p) => p.length)) - 1 && parts.every((p) => p[shared] === parts[0][shared])) {
        shared += 1;
    }
    return parts.map((p) => p.slice(shared).join(":"));
}

// More samples than this in view are not marked one by one.
const MARKER_LIMIT = 200;

// A line breaks before a point flagged g (the connection was lost before it) and, when gapMs is finite,
// where two points are further apart than gapMs. A monitored PV may be silent for long and keeps its value.
function splitOnGaps(points, gapMs) {
    const parts = [];
    let current = [];
    for (const point of points) {
        const last = current[current.length - 1];
        if (last && (point.g || point.t - last.t > gapMs)) {
            parts.push(current);
            current = [];
        }
        current.push(point);
    }
    if (current.length) {
        parts.push(current);
    }
    return parts;
}

/** The options a viewer can change on a chart, with the value each has until it is changed (see buildChartOptions). */
export const CHART_OPTIONS = { shape: "step", yscale: "linear", marks: "auto", average: false, band: false, window: 30 };

// The most sample marks drawn for one line when marks are asked for on every sample.
const MARK_CAP = 1500;

/**
 * The value scale of one unit. kind is linear, symlog, log or sqrt. A kind the values do not suit (log needs values
 * above zero, square root values not below zero) falls back to symmetric log with the reason in the result.
 * chosen is a value range the viewer dragged out, or undefined.
 */
function makeValueScale(kind, values, chosen, range, unit, tickCount) {
    let applied = kind;
    let reason = "";
    const name = unit || "no unit";
    if (applied === "log" && values.some((v) => !(v > 0))) {
        applied = "symlog";
        reason = `${name}: the log scale needs values above zero, so symmetric log is shown.`;
    } else if (applied === "sqrt" && values.some((v) => v < 0)) {
        applied = "symlog";
        reason = `${name}: the square root scale needs values that are not below zero, so symmetric log is shown.`;
    }
    let fixed = chosen;
    if (fixed && ((applied === "log" && Math.min(...fixed) <= 0) || (applied === "sqrt" && Math.min(...fixed) < 0))) {
        fixed = undefined;
    }
    let [low, high] = fixed || d3.extent(values);
    if (!fixed) {
        const pad = (high - low) * 0.1 || Math.abs(high) * 0.05 || 1;
        if (applied === "log") {
            low /= 1.2;
            high *= 1.2;
        } else {
            // A series that never goes below zero keeps zero as its floor instead of a padded negative value.
            low = values.every((v) => v >= 0) ? Math.max(0, low - pad) : low - pad;
            high += pad;
        }
    }
    let scale;
    if (applied === "log") {
        scale = d3.scaleLog();
    } else if (applied === "sqrt") {
        scale = d3.scaleSqrt();
    } else if (applied === "symlog") {
        scale = d3.scaleSymlog().constant(Math.max(Math.abs(high), Math.abs(low)) / 100 || 1);
    } else {
        scale = d3.scaleLinear();
    }
    scale.domain([low, high]).range(range);
    if (!fixed) {
        scale.nice(tickCount);
    }
    return { scale, kind: applied, reason };
}

/** The mean and the standard deviation of the last `size` values at each position of values (a shorter window at the start). */
function movingStats(values, size) {
    const out = [];
    for (let i = 0; i < values.length; i += 1) {
        const window = values.slice(Math.max(0, i - size + 1), i + 1);
        const mean = d3.mean(window);
        out.push({ mean, deviation: window.length > 1 ? d3.deviation(window) : 0 });
    }
    return out;
}

/**
 * The controls of the options of a chart: line shape, value scale, sample marks, running average, standard deviation
 * band and their window in samples. options is the object the page holds; onChange(next) is called with a new object
 * after each change, and the page draws the chart again with it. The page puts the returned element in its panel.
 * info is an element, an information control of the page, put at the end of the first row.
 */
export function buildChartOptions(options, onChange, info) {
    const current = { ...CHART_OPTIONS, ...options };
    const body = document.createElement("div");
    body.className = "opt-controls";
    const row = () => {
        const element = document.createElement("div");
        element.className = "opt-row";
        body.append(element);
        return element;
    };
    const apply = (name, value) => {
        current[name] = value;
        onChange({ ...current });
    };
    const select = (label, name, choices, convert = (v) => v) => {
        const wrap = document.createElement("label");
        wrap.append(`${label} `);
        const element = document.createElement("select");
        for (const [value, text] of choices) {
            const option = document.createElement("option");
            option.value = String(value);
            option.textContent = text;
            element.append(option);
        }
        element.value = String(current[name]);
        element.addEventListener("change", () => apply(name, convert(element.value)));
        wrap.append(element);
        return wrap;
    };
    const check = (label, name) => {
        const wrap = document.createElement("label");
        const element = document.createElement("input");
        element.type = "checkbox";
        element.checked = Boolean(current[name]);
        element.addEventListener("change", () => apply(name, element.checked));
        wrap.append(element, ` ${label}`);
        return wrap;
    };
    row().append(
        select("Line", "shape", [["step", "Step"], ["line", "Straight"], ["smooth", "Smooth"], ["points", "Points"]]),
        select("Y scale", "yscale", [["linear", "Linear"], ["symlog", "Symmetric log"], ["log", "Log"], ["sqrt", "Square root"]]),
        select("Marks", "marks", [["auto", "Auto"], ["on", "On"], ["off", "Off"]]),
        select("Window", "window", [[10, "10 samples"], [30, "30 samples"], [60, "60 samples"]], Number)
    );
    if (info) {
        info.classList.add("opt-info");
        body.firstElementChild.append(info);
    }
    row().append(check("Running average", "average"), check("Standard deviation band", "band"));
    return body;
}

/**
 * The width in pixels the end-of-line labels need, measured with the style of a label in the host. A label that is wider
 * than the room the chart leaves would be cut at the edge of the drawing, with the end of the value missing.
 */
function labelWidth(host, texts) {
    const probe = d3.select(host).append("svg").attr("width", 0).attr("height", 0).attr("aria-hidden", "true");
    let widest = 0;
    for (const text of texts) {
        widest = Math.max(widest, probe.append("text").attr("class", "label focus").text(text).node().getComputedTextLength());
    }
    probe.remove();
    return widest;
}

/** The texts of the labels at the end of the lines of a chart and the room they need on the right. */
function labelLayout(host, drawn, width, labelNames) {
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
    const drawn = input.series.filter((s) => s.points.length);
    if (!drawn.length) {
        return 0;
    }
    return labelLayout(host, drawn, Math.max(320, host.clientWidth || 640), input.labelNames !== false).right;
}

/**
 * input: {series: [{name, egu, points: [{t, v, s, g?}], focus, quiet?}], from: Date, to: Date, gapMs: number (Infinity: none), labelNames?: boolean, height?: number}
 * onZoom(from, to) turns a horizontal drag over the plot into a request for that window. Exact samples are marked
 * when the window holds few enough of them to be told apart.
 * quiet draws a series thin and pale, as the background of a series that carries the point (a floor over raw values).
 * labelNames false labels the end of a line with its value only, for a chart whose title already names it.
 * labelRoom is the least room in pixels to leave on the right for the labels (see labelRoom()).
 * onReset() is called on a double-click, after the value ranges chosen on the axes are dropped, so that the page can return
 * to the time window it started from.
 * info(topic) may return an element, an information control of the page, to put beside the title of the table of
 * statistics (topic "statistics").
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
    const all = series.filter((s) => s.points.length);
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
    const width = Math.max(320, host.clientWidth || 640);
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
    // The width of a value axis follows its widest tick label, so that a label such as 1.74e-9 stays clear of the next axis.
    const tickChars = Math.max(...[...scales.values()].flatMap((scale) => scale.ticks(tickCount).map((tick) => d3.format(".4~g")(tick).length)));
    const axisWidth = Math.max(AXIS_WIDTH_LEAST, Math.ceil(tickChars * AXIS_CHAR) + 14);
    const margin = {
        top: plotTop,
        right: right + axisWidth * onRight + (input.projection === true ? PROJECTION_WIDTH : 0),
        bottom: plotBottomMargin,
        left: axisWidth + axisWidth * (onLeft - 1),
    };
    const x = d3.scaleTime().domain([from, to]).range([margin.left, width - margin.right]);

    const svg = d3
        .create("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
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
    const timeFormat = d3.timeFormat(spanHours > 36 ? "%m-%d %H:%M" : spanHours > 1 / 6 ? "%H:%M" : "%H:%M:%S");
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
    const statistics = [];
    for (const s of drawn) {
        const chosen = ranges.get(s.egu || "");
        const [floor, ceiling] = chosen ? [Math.min(...chosen), Math.max(...chosen)] : [-Infinity, Infinity];
        const values = inView(s).map((p) => p.v).filter((v) => Number.isFinite(v) && v >= floor && v <= ceiling);
        statistics.push({ name: s.name, egu: s.egu, color: PALETTE[all.indexOf(s) % PALETTE.length], values });
        if (input.projection !== true || !values.length) {
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
        heading.textContent = d3.timeFormat("%Y-%m-%d %H:%M:%S")(when);
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

    // A drag across the plot asks the page for that time window (when it passes onZoom); a drag along an axis chooses
    // the value range of that axis and redraws at once; a short click chooses nothing; a double-click returns to the
    // automatic value ranges and, through onReset, to the time window the page was asked for first.
    const plotBottom = height - margin.bottom;
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
    const band = svg.append("rect").attr("class", "brush").attr("visibility", "hidden");
    const pointAt = (event) => {
        const box = svg.node().getBoundingClientRect();
        return [((event.clientX - box.left) / box.width) * width, ((event.clientY - box.top) / box.height) * height];
    };
    // The index of the unit whose axis column holds the point, or -1.
    const axisIndexAt = (px, py) => {
        if (py < plotTop || py > plotBottom) {
            return -1;
        }
        if (px < margin.left) {
            const step = Math.floor((margin.left - px) / axisWidth);
            return step < onLeft ? step : -1;
        }
        if (px > width - margin.right) {
            const step = Math.floor((px - (width - margin.right)) / axisWidth);
            return step < onRight ? onLeft + step : -1;
        }
        return -1;
    };
    let drag = null;
    svg.style("touch-action", "pan-y");
    svg.on("pointermove.cursor", (event) => {
        const [px, py] = pointAt(event);
        svg.style("cursor", axisIndexAt(px, py) >= 0 ? "ns-resize" : null);
    });
    svg.on("pointerdown", (event) => {
        if (event.button !== 0) {
            return;
        }
        const [px, py] = pointAt(event);
        const inPlot = px > margin.left - 1 && px < width - margin.right + 1 && py >= plotTop && py <= plotBottom;
        const index = inPlot ? -1 : axisIndexAt(px, py);
        if (inPlot && typeof input.onZoom === "function") {
            drag = { kind: "x", start: clamp(px, margin.left, width - margin.right) };
        } else if (index >= 0) {
            drag = { kind: "y", start: clamp(py, plotTop, plotBottom), index };
        } else {
            return;
        }
        try {
            svg.node().setPointerCapture(event.pointerId);
        } catch (error) {
            // A synthetic pointer has nothing to capture; the drag still works.
        }
    });
    svg.on("pointermove.brush", (event) => {
        if (drag === null) {
            return;
        }
        const [px, py] = pointAt(event);
        if (drag.kind === "x") {
            const now = clamp(px, margin.left, width - margin.right);
            band.attr("visibility", "visible").attr("x", Math.min(drag.start, now)).attr("width", Math.abs(now - drag.start))
                .attr("y", plotTop).attr("height", plotBottom - plotTop);
        } else {
            const { rightSide, x: axisX } = axisAt(drag.index);
            const now = clamp(py, plotTop, plotBottom);
            band.attr("visibility", "visible").attr("x", rightSide ? axisX : axisX - axisWidth).attr("width", axisWidth)
                .attr("y", Math.min(drag.start, now)).attr("height", Math.abs(now - drag.start));
        }
    });
    svg.on("pointerup", (event) => {
        if (drag === null) {
            return;
        }
        const chosen = drag;
        drag = null;
        band.attr("visibility", "hidden");
        const [px, py] = pointAt(event);
        if (chosen.kind === "x") {
            const now = clamp(px, margin.left, width - margin.right);
            if (Math.abs(now - chosen.start) >= DRAG_LEAST + 2) {
                input.onZoom(x.invert(Math.min(chosen.start, now)), x.invert(Math.max(chosen.start, now)));
            }
            return;
        }
        const now = clamp(py, plotTop, plotBottom);
        if (Math.abs(now - chosen.start) >= DRAG_LEAST) {
            const scale = scales.get(units[chosen.index]);
            const [a, b] = [scale.invert(chosen.start), scale.invert(now)];
            ranges.set(units[chosen.index], [Math.min(a, b), Math.max(a, b)]);
            drawTimeSeries(host, input);
        }
    });
    svg.on("pointercancel", () => {
        drag = null;
        band.attr("visibility", "hidden");
    });
    svg.on("dblclick", () => {
        const had = ranges.size > 0;
        ranges.clear();
        if (had) {
            drawTimeSeries(host, input);
        }
        if (typeof input.onReset === "function") {
            input.onReset();
        }
    });

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
