// The Distribution tab of the analyzer: the distribution of the values of one numeric signal over the selected range, as a
// histogram, a box plot, the pattern by hour of the day or by day of the week, or a time-and-value map, with the moments, the
// quantiles and the values beyond k standard deviations below. It reads the selected dataset of the page (the Summary
// dataset: the stored samples, or the means over N seconds, of the selected range), so that its numbers do not change when
// the displayed window is panned or zoomed. A count is a count of samples of that dataset; it is not the time a signal
// spent at a value. An input that cannot give a result is refused with its reason and shows no plot and no stale numbers.
import { createPlotCanvas } from "../comm/js/aa/chart.js";
import { node } from "../comm/js/aa/dom.js";
import { infoButton } from "../comm/js/aa/card.js";
import { format } from "../comm/js/aa/chart/text.js";
import { moments, quantiles, boxPlot, kernelDensity } from "../comm/js/aa/stats.js";
import { partsInZone, formatInZone, zoneName } from "../comm/js/aa/timezone.js";

const d3 = globalThis.d3;

export const DISTRIBUTION_VIEWS = [["histogram", "Histogram"], ["box", "Box plot"], ["hour", "Pattern by hour"], ["weekday", "Pattern by weekday"], ["heatmap", "Time and value"]];
export const RULES = [["sturges", "Sturges"], ["scott", "Scott"], ["freedman", "Freedman-Diaconis"], ["count", "Bin count"]];
export const NORMALIZATIONS = [["count", "Samples"], ["fraction", "Fraction of samples"], ["density", "Density"]];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const BINS_LEAST = 1;
export const BINS_MOST = 1000;
export const SIGMA_LEAST = 0.5;
export const SIGMA_MOST = 20;
// The settings of the tab and their defaults; the address carries the ones that differ (viewer/tool-address.js).
export const DISTRIBUTION_DEFAULTS = Object.freeze({ signal: null, view: "histogram", rule: "sturges", bins: 20, normalize: "count", kde: false, sigma: 3 });
const HEATMAP_ROWS_MOST = 40;
const HEATMAP_COLUMNS_MOST = 48;
const BEYOND_LISTED = 20;
// The kernel density sums over every sample at 200 positions; beyond this many samples it is left out so that the page stays responsive.
const KDE_SAMPLES_MOST = 100000;
const HEIGHT = 320;
const WIDTH_LEAST = 320;
// A plot narrower than this has about three value labels on its horizontal axis instead of five, so that the labels do not touch.
const NARROW_PLOT = 480;
const MARGIN = { left: 72, right: 24, top: 36, bottom: 56 };
const TIME_FORMAT = "%Y-%m-%d %H:%M:%S";

/** The information card of the tab: the title a question, In short the first row. */
const CARD = [
    "Distribution: what do the plots and the numbers count?",
    [
        ["In short", "The values of one signal over the selected range. Every count is a count of samples of the dataset named under the plot; it is not the time the signal spent at a value."],
        ["Dataset", "The selected range at the resolution the page resolved for its Summary: the stored samples, or the means over N seconds. The statistics of means describe the means, not the stored samples, and they do not change when you pan or zoom the Trend."],
        ["Histogram", "Equal-width bins between the minimum and the maximum. The rule gives the number of bins (Sturges, Scott, Freedman-Diaconis) or you give it; the last bin includes the maximum. Density divides a count by the number of samples and the bin width, so that the bars add up to 1; the kernel density is a Gaussian estimate with Silverman's bandwidth."],
        ["Box plot", "The quartiles, the median, whiskers at the most extreme values within 1.5 times the interquartile range of the box, and the values beyond them."],
        ["Patterns", "The mean of the samples of each hour of the day or each day of the week in the time zone of the page, with one standard deviation. A time of the dataset with no sample leaves its hour or day out; each point counts the samples of the dataset, so a period with more samples weighs more."],
        ["Time and value", "The samples counted in cells of time and value across the selected range; a darker cell holds more samples."],
        ["Settings", "The bin count is a whole number from 1 to 1000 and is used only with the rule Bin count; the number of standard deviations k is from 0.5 to 20. A value outside the range is refused with the range and the last valid value stays. A pattern needs at least 2 different hours or days in the dataset and the time and value map at least 8 samples; a range with no samples, with fewer than 2 samples, or with all values equal shows the reason in place of the plot."],
        ["Beyond k", "The samples whose distance from the mean is more than k standard deviations, listed in time order."],
        ["Numbers", "Skewness is the moment coefficient g1 and kurtosis is the excess g2 (0 for a normal distribution). The standard error of the mean is the standard deviation over the square root of n, and that of the standard deviation uses the normal-theory formula."],
    ],
    null,
];

/** The equal-width bins of the values: the number of bins from the rule, or the given count, between the minimum and the maximum. */
export function histogramBins(values, minimum, maximum, rule, count) {
    let wanted = count;
    if (rule === "sturges") wanted = d3.thresholdSturges(values);
    else if (rule === "scott") wanted = d3.thresholdScott(values, minimum, maximum);
    else if (rule === "freedman") wanted = d3.thresholdFreedmanDiaconis(values, minimum, maximum);
    const number = Math.min(BINS_MOST, Math.max(BINS_LEAST, Math.round(Number.isFinite(wanted) ? wanted : 1)));
    const width = (maximum - minimum) / number;
    const edges = Array.from({ length: number - 1 }, (_, i) => minimum + (i + 1) * width);
    const bins = d3.bin().domain([minimum, maximum]).thresholds(edges)(values);
    return { number, width, bins };
}

/** The key of a sample in a pattern: the hour of the day (0 to 23) or the day of the week (Monday 0 to Sunday 6) in the zone. */
function patternKey(timeMs, view, zone) {
    const parts = partsInZone(new Date(timeMs), zone);
    if (view === "hour") return parts.hour;
    return (new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay() + 6) % 7;
}

/**
 * The finite samples of a dataset inside its range, both ends included, which is what the Summary of the page counts: the retrieval
 * also returns the last record before the range, which the line holds from the start and which is not a sample of the range.
 */
export function pointsInside(dataset) {
    return dataset.points.filter((p) => p.t >= +dataset.from && p.t <= +dataset.to);
}

/**
 * Whether the dataset of the signal can show the view: its samples, their count and spread, and for a pattern or the map the
 * coverage the view needs. The answer holds the reason in words when it cannot, and the finite samples when it can.
 */
export function checkInput(entry, view, zone) {
    const dataset = entry.dataset;
    if (!dataset) {
        return entry.failure ? { ok: false, reason: `The samples of this signal could not be read: ${entry.failure}` } : { ok: false, loading: true, reason: "Loading samples..." };
    }
    const points = pointsInside(dataset);
    if (!points.length) {
        return { ok: false, reason: dataset.form === "No samples" ? "The selected range holds no samples of this signal." : "This signal has no numeric scalar samples in the selected range; the Distribution tab reads numeric scalars only." };
    }
    const values = points.map((p) => p.v);
    const m = moments(values);
    if (m.n < 2) return { ok: false, reason: `The distribution needs at least 2 samples; the selected range holds ${m.n}.` };
    if (!(m.sd > 0)) return { ok: false, reason: `All ${m.n} samples have the value ${format(m.mean, entry.egu)}; there is no distribution to show.` };
    if (view === "hour" || view === "weekday") {
        const keys = new Set(points.map((p) => patternKey(p.t, view, zone)));
        if (keys.size < 2) {
            return { ok: false, reason: `The selected range covers ${keys.size} ${view === "hour" ? "hour of the day" : "day of the week"}; a pattern needs at least 2. Choose a longer range.` };
        }
    }
    if (view === "heatmap" && m.n < 8) return { ok: false, reason: `The time and value map needs at least 8 samples; the selected range holds ${m.n}.` };
    return { ok: true, points, values, moments: m };
}

/** The canvas of a view in host: the axes, the clip and the surface for the marks. */
function canvasIn(host, input) {
    const width = Math.max(WIDTH_LEAST, Math.floor(host.clientWidth || 720));
    const x = input.xScale.range([MARGIN.left, width - MARGIN.right]);
    const y = input.yScale.range([HEIGHT - MARGIN.bottom, MARGIN.top]);
    const unit = input.unit ?? "";
    const surface = createPlotCanvas({
        width, height: HEIGHT, margin: MARGIN, x, scales: new Map([[unit, y]]), units: [unit], axisWidth: MARGIN.left, onLeft: 1,
        unitLabels: true, axisLabels: new Map([[unit, input.yLabel]]), axisLabelAnchor: "start", xLabel: input.xLabel, xTickY: HEIGHT - 30, label: input.label,
        xFormat: input.xFormat, xTicks: input.xTicks || x.ticks(width < NARROW_PLOT ? 3 : 5), tickFormats: input.tickFormats, grid: input.grid, tickCount: 5,
    });
    host.append(surface.svg.node());
    return { surface, x, y, width };
}

/** The distribution view of the page: its controls are built once and its body is drawn again at each render. */
export function createDistribution(host, options) {
    const settings = { ...DISTRIBUTION_DEFAULTS, ...(options.settings || {}) };
    // A change of a setting draws the tab again and tells the page, which writes the address.
    const changed = () => { render(); if (options.changed) options.changed(); };
    const select = (label, choices, key) => {
        const element = node("select", { "aria-label": label });
        for (const [value, text] of choices) element.append(node("option", { value }, text));
        element.value = settings[key];
        element.addEventListener("change", () => { settings[key] = element.value; changed(); });
        return element;
    };
    const signal = node("select", { "aria-label": "Distribution signal" });
    signal.addEventListener("change", () => { settings.signal = signal.value; changed(); });
    const view = select("Distribution view", DISTRIBUTION_VIEWS, "view");
    const rule = select("Bin rule", RULES, "rule");
    const normalize = select("Normalization", NORMALIZATIONS, "normalize");
    const bins = node("input", { type: "number", min: String(BINS_LEAST), max: String(BINS_MOST), step: "1", "aria-label": "Number of bins" });
    bins.value = String(settings.bins);
    const error = node("p", { class: "error", role: "alert" });
    bins.addEventListener("change", () => {
        const value = Number(bins.value);
        if (!/^\d+$/.test(bins.value.trim()) || value < BINS_LEAST || value > BINS_MOST) {
            error.textContent = `Enter a whole number of bins from ${BINS_LEAST} to ${BINS_MOST}.`;
            bins.value = String(settings.bins);
            return;
        }
        error.textContent = "";
        settings.bins = value;
        changed();
    });
    const kde = node("input", { type: "checkbox", "aria-label": "Kernel density" });
    kde.checked = settings.kde;
    kde.addEventListener("change", () => { settings.kde = kde.checked; changed(); });
    const sigma = node("input", { type: "number", min: String(SIGMA_LEAST), max: String(SIGMA_MOST), step: "0.5", "aria-label": "Standard deviations for the values beyond" });
    sigma.value = String(settings.sigma);
    sigma.addEventListener("change", () => {
        const value = Number(sigma.value);
        if (!(value >= SIGMA_LEAST && value <= SIGMA_MOST)) {
            error.textContent = `Enter a number of standard deviations from ${SIGMA_LEAST} to ${SIGMA_MOST}.`;
            sigma.value = String(settings.sigma);
            return;
        }
        error.textContent = "";
        settings.sigma = value;
        changed();
    });
    const field = (text, control) => node("label", null, text, control);
    const info = infoButton(...CARD, options.helpHref);
    const controls = node("div", { class: "dist-controls" },
        field("Signal ", signal), field("View ", view), field("Bin rule ", rule), field("Bins ", bins), field("Normalize ", normalize),
        node("label", { class: "check-inline" }, kde, " Kernel density"), field("Beyond k ", sigma), info);
    const message = node("p", { class: "note", role: "status" });
    const plot = node("div", { class: "chart dist-plot" });
    const source = node("p", { class: "note dist-source" });
    const summary = node("div", { class: "dist-summary" });
    const beyond = node("div", { class: "dist-beyond" });
    host.replaceChildren(controls, error, message, plot, source, summary, beyond);

    /** Keeps the options of the signal list as the selection has them, and the chosen signal while it is still selected. */
    function syncSignals(list) {
        const names = list.map((entry) => entry.name);
        if (names.join("\n") !== [...signal.options].map((option) => option.value).join("\n")) {
            signal.replaceChildren(...list.map((entry) => node("option", { value: entry.name }, entry.name)));
        }
        if (!names.includes(settings.signal)) settings.signal = names[0] ?? null;
        if (settings.signal !== null) signal.value = settings.signal;
    }

    function render() {
        const list = options.signals();
        syncSignals(list);
        plot.replaceChildren();
        summary.replaceChildren();
        beyond.replaceChildren();
        source.textContent = "";
        const histogramView = settings.view === "histogram";
        rule.disabled = !(histogramView || settings.view === "heatmap");
        bins.disabled = rule.disabled || settings.rule !== "count";
        normalize.disabled = !histogramView;
        kde.disabled = !histogramView;
        if (!list.length) {
            message.textContent = "Select archived signals to see their distribution.";
            return;
        }
        const entry = list.find((item) => item.name === settings.signal);
        const zone = options.zone();
        const check = checkInput(entry, settings.view, zone);
        if (!check.ok) {
            message.textContent = check.reason;
            return;
        }
        message.textContent = "";
        const { values, points, moments: m } = check;
        const drawn = { histogram: drawHistogram, box: drawBox, hour: drawPattern, weekday: drawPattern, heatmap: drawHeatmap }[settings.view];
        drawn(entry, values, points, m, zone);
        const dataset = entry.dataset;
        const sourceText = options.sourceText(dataset.seconds);
        source.textContent = `Dataset: the ${m.n} samples (${sourceText}) of the selected range, ${formatInZone(dataset.from, TIME_FORMAT, zone)} to ${formatInZone(dataset.to, TIME_FORMAT, zone)} ${zoneName(zone, dataset.to)}. `
            + `A count is a count of samples of this dataset, not time spent at a value.${dataset.seconds === "raw" ? "" : " The numbers describe the means, not the stored samples."}`;
        drawSummary(entry, values, m);
        drawBeyond(entry, points, m, zone);
    }

    function describe(entry, text) {
        return `${text} of ${entry.name}`;
    }

    function drawHistogram(entry, values, points, m) {
        const { number, width: binWidth, bins: binned } = histogramBins(values, m.min, m.max, settings.rule, settings.bins);
        const scale = settings.normalize === "count" ? 1 : settings.normalize === "fraction" ? 1 / m.n : 1 / (m.n * binWidth);
        const heights = binned.map((b) => b.length * scale);
        const grid = Float64Array.from({ length: 200 }, (_, i) => m.min + ((m.max - m.min) * i) / 199);
        const density = settings.kde && m.n <= KDE_SAMPLES_MOST ? kernelDensity(values, grid) : null;
        // A density estimate is a density; it is scaled to the bars: counts per bin, fractions per bin or density.
        const curveScale = settings.normalize === "count" ? m.n * binWidth : settings.normalize === "fraction" ? binWidth : 1;
        const top = Math.max(d3.max(heights), density ? d3.max(density) * curveScale : 0) * 1.08;
        const { surface, x, y } = canvasIn(plot, {
            xScale: d3.scaleLinear().domain([m.min, m.max]), yScale: d3.scaleLinear().domain([0, top]),
            yLabel: { count: "Samples", fraction: "Fraction", density: `Density per ${entry.egu || "unit"}` }[settings.normalize],
            xLabel: `${entry.name} / ${entry.egu || "no unit"}`, label: describe(entry, `Histogram of ${number} bins`), xFormat: d3.format(".4~g"),
        });
        surface.marks.selectAll("rect").data(binned).join("rect").attr("class", "dist-bar").attr("fill", entry.color).attr("data-count", (b) => b.length).attr("data-x0", (b) => b.x0).attr("data-x1", (b) => b.x1)
            .attr("x", (b) => x(b.x0) + 0.5).attr("width", (b) => Math.max(0, x(b.x1) - x(b.x0) - 1))
            .attr("y", (b, i) => y(heights[i])).attr("height", (b, i) => y(0) - y(heights[i]));
        if (density) {
            const line = d3.line().x((_, i) => x(grid[i])).y((d) => y(d * curveScale));
            surface.marks.append("path").attr("class", "dist-kde").attr("d", line(Array.from(density)));
        }
        for (const [value, name] of [[m.mean, "mean"], [d3.median(values), "median"]]) {
            surface.marks.append("line").attr("class", `dist-${name}`).attr("x1", x(value)).attr("x2", x(value)).attr("y1", MARGIN.top).attr("y2", HEIGHT - MARGIN.bottom);
        }
        const search = d3.bisector((b) => b.x0).right;
        surface.bindHover(plot, ({ x: at }) => {
            const index = Math.min(binned.length - 1, Math.max(0, search(binned, +at) - 1));
            const b = binned[index];
            return { title: `${format(b.x0, "")} to ${format(b.x1, entry.egu)}`, rows: [`Samples: ${b.length}`, `Share of samples: ${((100 * b.length) / m.n).toFixed(2)} %`],
                px: x((b.x0 + b.x1) / 2), py: y(heights[index]) };
        });
        note(`Solid line: mean. Dashed line: median.${settings.kde && !density ? ` The kernel density is left out above ${KDE_SAMPLES_MOST} samples.` : ""}`);
    }

    function note(text) {
        plot.append(node("p", { class: "note dist-legend" }, text));
    }

    function drawBox(entry, values, points, m) {
        const box = boxPlot(values);
        const pad = (m.max - m.min) * 0.03;
        const { surface, x, y } = canvasIn(plot, {
            xScale: d3.scaleLinear().domain([m.min - pad, m.max + pad]), yScale: d3.scaleLinear().domain([0, 1]), yLabel: "",
            tickFormats: new Map([["", () => ""]]), grid: "x", xLabel: `${entry.name} / ${entry.egu || "no unit"}`, label: describe(entry, "Box plot"), xFormat: d3.format(".4~g"),
        });
        const middle = y(0.5), half = (y(0) - y(1)) * 0.2;
        const marks = surface.marks;
        marks.append("line").attr("class", "dist-whisker").attr("x1", x(box.whiskerLow)).attr("x2", x(box.q1)).attr("y1", middle).attr("y2", middle);
        marks.append("line").attr("class", "dist-whisker").attr("x1", x(box.q3)).attr("x2", x(box.whiskerHigh)).attr("y1", middle).attr("y2", middle);
        for (const end of [box.whiskerLow, box.whiskerHigh]) {
            marks.append("line").attr("class", "dist-whisker").attr("x1", x(end)).attr("x2", x(end)).attr("y1", middle - half / 2).attr("y2", middle + half / 2);
        }
        marks.append("rect").attr("class", "dist-box").attr("fill", entry.color).attr("data-q1", box.q1).attr("data-median", box.median).attr("data-q3", box.q3).attr("data-outliers", box.outliers.length).attr("x", x(box.q1)).attr("width", Math.max(1, x(box.q3) - x(box.q1)))
            .attr("y", middle - half).attr("height", 2 * half);
        marks.append("line").attr("class", "dist-median").attr("x1", x(box.median)).attr("x2", x(box.median)).attr("y1", middle - half).attr("y2", middle + half);
        marks.append("path").attr("class", "dist-mean-mark").attr("d", d3.symbol().type(d3.symbolDiamond).size(60)()).attr("transform", `translate(${x(m.mean)},${middle})`);
        marks.selectAll("circle").data(box.outliers).join("circle").attr("class", "dist-outlier").attr("r", 2.5).attr("cx", (v) => x(v))
            .attr("cy", (_, i) => middle + (((i % 5) - 2) * half) / 3);
        surface.bindHover(plot, () => ({
            title: `Box plot of ${entry.name}`,
            rows: [`Median: ${format(box.median, entry.egu)}`, `Quartiles: ${format(box.q1, "")} to ${format(box.q3, entry.egu)}`,
                `Whiskers: ${format(box.whiskerLow, "")} to ${format(box.whiskerHigh, entry.egu)}`, `Mean: ${format(m.mean, entry.egu)}`, `Values beyond the whiskers: ${box.outliers.length}`],
            px: x(box.median), py: middle,
        }));
        note("Box: first to third quartile with the median. Whiskers: most extreme values within 1.5 times the box. Dots: values beyond them. Diamond: mean.");
    }

    function drawPattern(entry, values, points, m, zone) {
        const keys = settings.view === "hour" ? 24 : 7;
        const groups = Array.from({ length: keys }, () => []);
        for (const p of points) groups[patternKey(p.t, settings.view, zone)].push(p.v);
        const stats = groups.map((g) => moments(g));
        const used = stats.map((s, i) => ({ key: i, ...s })).filter((s) => s.n > 0);
        const low = d3.min(used, (s) => s.mean - (s.sd ?? 0));
        const high = d3.max(used, (s) => s.mean + (s.sd ?? 0));
        const pad = (high - low) * 0.1 || 1;
        const label = (key) => (settings.view === "hour" ? String(key) : WEEKDAYS[key]);
        const { surface, x, y } = canvasIn(plot, {
            xScale: d3.scaleLinear().domain([-0.5, keys - 0.5]), yScale: d3.scaleLinear().domain([low - pad, high + pad]), yLabel: entry.egu || "no unit",
            unit: entry.egu || "", xLabel: settings.view === "hour" ? `Hour of the day, ${zoneName(zone, new Date(points[0].t))}` : `Day of the week, ${zoneName(zone, new Date(points[0].t))}`,
            label: describe(entry, `Mean by ${settings.view === "hour" ? "hour of the day" : "day of the week"}`),
            xFormat: (key) => label(Math.round(key)), xTicks: settings.view === "hour" ? d3.range(0, 24, 2) : d3.range(0, 7),
        });
        const marks = surface.marks;
        marks.selectAll("line.dist-bar-sd").data(used.filter((s) => s.sd !== null)).join("line").attr("class", "dist-bar-sd").attr("stroke", entry.color)
            .attr("x1", (s) => x(s.key)).attr("x2", (s) => x(s.key)).attr("y1", (s) => y(s.mean - s.sd)).attr("y2", (s) => y(s.mean + s.sd));
        marks.append("path").attr("class", "dist-pattern").attr("stroke", entry.color).attr("fill", "none")
            .attr("d", d3.line().x((s) => x(s.key)).y((s) => y(s.mean)).defined((s) => s.n > 0)(used));
        marks.selectAll("circle").data(used).join("circle").attr("class", "dist-point").attr("fill", entry.color).attr("r", 3.5).attr("data-key", (s) => s.key).attr("data-n", (s) => s.n).attr("data-mean", (s) => s.mean)
            .attr("cx", (s) => x(s.key)).attr("cy", (s) => y(s.mean));
        surface.bindHover(plot, ({ x: at }) => {
            const key = Math.round(+at);
            const s = stats[key];
            if (!s || s.n === 0) return null;
            return { title: `${settings.view === "hour" ? `Hour ${key}` : WEEKDAYS[key]}`, rows: [`Samples: ${s.n}`, `Mean: ${format(s.mean, entry.egu)}`,
                `Standard deviation: ${s.sd === null ? "not defined for one sample" : format(s.sd, entry.egu)}`, `Range: ${format(s.min, "")} to ${format(s.max, entry.egu)}`], px: x(key), py: y(s.mean) };
        });
        note(`Points: the mean of the samples of that ${settings.view === "hour" ? "hour" : "day"}; bars: one standard deviation. A ${settings.view === "hour" ? "hour" : "day"} with no sample has no point.`);
    }

    function drawHeatmap(entry, values, points, m, zone) {
        const from = entry.dataset.from.getTime();
        const to = entry.dataset.to.getTime();
        const columns = Math.min(HEATMAP_COLUMNS_MOST, Math.max(2, Math.floor(m.n / 4)));
        const { number: rows } = histogramBins(values, m.min, m.max, settings.rule, settings.bins);
        const rowCount = Math.min(HEATMAP_ROWS_MOST, rows);
        const cells = new Map();
        const columnOf = (t) => Math.min(columns - 1, Math.max(0, Math.floor(((t - from) / (to - from)) * columns)));
        const rowOf = (v) => Math.min(rowCount - 1, Math.floor(((v - m.min) / (m.max - m.min)) * rowCount));
        for (const p of points) {
            const key = columnOf(p.t) * rowCount + rowOf(p.v);
            cells.set(key, (cells.get(key) ?? 0) + 1);
        }
        const most = d3.max(cells.values());
        const color = d3.scaleSequential(d3.interpolateViridis).domain([0, most]);
        const { surface, x, y } = canvasIn(plot, {
            xScale: d3.scaleTime().domain([from, to]), yScale: d3.scaleLinear().domain([m.min, m.max]), yLabel: entry.egu || "no unit", unit: entry.egu || "",
            xLabel: `Time, ${zoneName(zone, entry.dataset.to)}`, label: describe(entry, "Samples by time and value"),
            xFormat: (date) => formatInZone(date, "%m-%d %H:%M", zone), xTicks: d3.scaleTime().domain([from, to]).ticks(5),
        });
        const cellList = [...cells].map(([key, count]) => ({ column: Math.floor(key / rowCount), row: key % rowCount, count }));
        const stepX = (to - from) / columns;
        const stepY = (m.max - m.min) / rowCount;
        surface.marks.selectAll("rect").data(cellList).join("rect").attr("class", "dist-cell").attr("fill", (c) => color(c.count)).attr("data-count", (c) => c.count)
            .attr("x", (c) => x(from + c.column * stepX)).attr("width", (c) => Math.max(1, x(from + (c.column + 1) * stepX) - x(from + c.column * stepX) - 0.5))
            .attr("y", (c) => y(m.min + (c.row + 1) * stepY)).attr("height", (c) => Math.max(1, y(m.min + c.row * stepY) - y(m.min + (c.row + 1) * stepY) - 0.5));
        surface.bindHover(plot, ({ x: at, py }) => {
            const t = +at;
            const value = y.invert(py);
            const c = cellList.find((cell) => columnOf(t) === cell.column && rowOf(value) === cell.row);
            if (!c) return null;
            return { title: `${formatInZone(new Date(from + c.column * stepX), TIME_FORMAT, zone)}`, rows: [`Value: ${format(m.min + c.row * stepY, "")} to ${format(m.min + (c.row + 1) * stepY, entry.egu)}`, `Samples: ${c.count}`],
                px: x(from + (c.column + 0.5) * stepX), py: y(m.min + (c.row + 0.5) * stepY) };
        });
        note(`Each cell counts the samples of its time and value; a darker cell holds more, from 1 to ${most}. ${columns} columns of time and ${rowCount} rows of value.`);
    }

    function drawSummary(entry, values, m) {
        const q = quantiles(values, [0.05, 0.25, 0.5, 0.75, 0.95]);
        const unit = entry.egu || "";
        const rows = [
            ["Samples", String(m.n)], ["Minimum", format(m.min, unit)], ["Maximum", format(m.max, unit)], ["Mean", format(m.mean, unit)], ["Median", format(q[2], unit)],
            ["Standard deviation", format(m.sd, unit)], ["Skewness", m.skewness === null ? "not defined" : format(m.skewness, "")],
            ["Excess kurtosis", m.kurtosis === null ? "not defined" : format(m.kurtosis, "")], ["Standard error of the mean", format(m.seMean, unit)],
            ["Standard error of the standard deviation", format(m.seSd, unit)], ["5th percentile", format(q[0], unit)], ["25th percentile", format(q[1], unit)],
            ["75th percentile", format(q[3], unit)], ["95th percentile", format(q[4], unit)],
        ];
        const table = node("table", { class: "chart-stats dist-table", "aria-label": `Statistics of ${entry.name}` },
            node("tbody", null, ...rows.map(([name, value]) => node("tr", null, node("th", { scope: "row" }, name), node("td", { class: "num" }, value)))));
        summary.append(node("h3", { class: "chart-stats-title" }, `Statistics of ${entry.name}`), table);
    }

    function drawBeyond(entry, points, m, zone) {
        const limit = settings.sigma * m.sd;
        const outside = points.filter((p) => Math.abs(p.v - m.mean) > limit);
        const heading = node("h3", { class: "chart-stats-title" }, `Values beyond ${settings.sigma} standard deviations`);
        if (!outside.length) {
            beyond.append(heading, node("p", { class: "note" }, `None of the ${m.n} samples is more than ${settings.sigma} standard deviations from the mean.`));
            return;
        }
        const shown = outside.slice(0, BEYOND_LISTED);
        const table = node("table", { class: "chart-stats dist-table", "aria-label": "Values beyond k standard deviations" },
            node("thead", null, node("tr", null, ...["Time", "Value", "Distance"].map((text) => node("th", { scope: "col" }, text)))),
            node("tbody", null, ...shown.map((p) => node("tr", null, node("td", null, formatInZone(new Date(p.t), TIME_FORMAT, zone)),
                node("td", { class: "num" }, format(p.v, entry.egu)), node("td", { class: "num" }, `${((p.v - m.mean) / m.sd).toFixed(2)} sd`)))));
        beyond.append(heading, node("p", { class: "note" }, `${outside.length} of ${m.n} samples${outside.length > shown.length ? `; the first ${shown.length} in time order are listed` : ""}.`), table);
    }

    return { render, settings };
}
