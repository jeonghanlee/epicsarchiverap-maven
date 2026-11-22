// The Compare tab of the analyzer: two time ranges of one numeric signal, or two numeric signals, side by side. Range A is the selected
// dataset of the page; range B is a separately labeled range that defaults to the preceding range of the same duration and is
// retrieved at the same resolution when the comparison runs. The tab shows the two trends on one value scale when the units match,
// the two distributions normalized and overlaid, the counts, means and spreads with their differences, and the test of the chosen
// method. A comparison runs only from its button and a result is cleared when anything it was computed from changes; an input that
// cannot give a result is refused with its reason, and unlike units are never compared or normalized.
import { createPlotCanvas } from "../comm/js/aa/chart.js";
import { node } from "../comm/js/aa/dom.js";
import { infoButton } from "../comm/js/aa/card.js";
import { format } from "../comm/js/aa/chart/text.js";
import { finiteValues } from "../comm/js/aa/stats.js";
import { compute } from "../comm/js/aa/compare.js";
import { formatInZone, zoneName } from "../comm/js/aa/timezone.js";
import { pointsInside } from "./distribution.js";

const d3 = globalThis.d3;

export const COMPARE_MODES = [["ranges", "Two ranges of one signal"], ["signals", "Two signals"]];
export const COMPARE_METHODS = [["chi2", "Chi-square (histograms)"], ["ks", "Kolmogorov-Smirnov"], ["ad", "Anderson-Darling"]];
// The settings of the tab and their defaults; the address carries the ones that differ, and range B only when the user set it (viewer/tool-address.js).
export const COMPARE_DEFAULTS = Object.freeze({ mode: "ranges", a: null, b: null, method: "chi2", from: null, to: null, edited: false });
const HEIGHT = 220;
const DISTRIBUTION_HEIGHT = 260;
const WIDTH_LEAST = 300;
const MARGIN = { left: 72, right: 16, top: 36, bottom: 40 };
const TIME_FORMAT = "%Y-%m-%d %H:%M:%S";
const AXIS_TIME_FORMAT = "%m-%d %H:%M";
const NARROW_WIDTH = 360;
const MEDIUM_WIDTH = 480;

const CARD = [
    "Compare: what is compared and how?",
    [
        ["In short", "Two sets of samples of numeric scalars: range A and range B of one signal, or the signals A and B. A comparison runs when you select Run comparison and is cleared when anything it used changes."],
        ["Ranges", "Range A is the selected range of the page. Range B is proposed as the range of the same duration just before A; you can edit it before you run. B is retrieved at the same resolution as A (stored samples, or means over the same number of seconds), and it must not overlap A, since a sample in both ranges would count twice; a range B that ends where A starts leaves the sample at that instant to A."],
        ["Signals", "The signals A and B are compared over the selected range. Their units must match: signals with unlike units show their own numbers only, with no difference, no overlay and no test, and nothing is scaled to make them comparable."],
        ["Plots", "The two trends stand side by side on one value scale when the units match, so a level difference is visible; on a narrow page they stack. Below them the two distributions are drawn on the same bins as densities, so ranges with different counts can be compared: A as filled bars and B as an outline."],
        ["Numbers", "Count, mean, standard deviation, minimum and maximum of each, and the differences A minus B of the means and of the standard deviations with their standard errors."],
        ["Tests", "Chi-square compares the two histograms on the same bins; Kolmogorov-Smirnov uses the largest distance between the two distribution functions, with an asymptotic p-value that is not exact for small samples; Anderson-Darling is the two-sample test of Scholz and Stephens with an interval for the significance (not below 0.001 and not above 0.25). Each needs at least 8 samples in each dataset and some spread; chi-square also needs most of the cells of its table (a bin of A and a bin of B) to be expected to hold at least 5 samples, which a range much smaller than the other seldom meets. A test that cannot run says why instead of showing a p-value."],
        ["Independence", "The tests treat the samples as independent. Successive samples of a signal are not, so a small p-value overstates the evidence; read it with the size of the difference."],
        ["Means", "With the automatic interval the samples are means over N seconds, and the comparison describes the means, not the stored samples; choose Raw samples under Options, Interval, to compare the stored samples."],
    ],
    null,
];

/** The text of a p-value: small values by their bound, the others with their digits. */
export function pText(p) {
    if (p === null || p === undefined || !Number.isFinite(p)) return "not defined";
    if (p < 0.001) return "less than 0.001";
    return p.toFixed(p < 0.1 ? 4 : 3);
}

/**
 * Whether the two datasets can be compared and what each test needs: a reason for each refusal, or the values. Samples are the finite
 * numeric values of each dataset; the units must match for any comparison of the two.
 */
export function checkComparison(a, b, mode) {
    const named = (side) => (mode === "ranges" ? `range ${side}` : `signal ${side}`);
    for (const [side, entry] of [["A", a], ["B", b]]) {
        if (!entry.dataset) {
            return { ok: false, reason: entry.failure ? `The samples of ${named(side)} could not be read: ${entry.failure}` : `The samples of ${named(side)} are loading.` };
        }
        if (!pointsInside(entry.dataset).length) {
            return { ok: false, reason: entry.dataset.form === "No samples" ? `${named(side)} holds no samples.` : `${named(side)} has no numeric scalar samples; the comparison reads numeric scalars only.` };
        }
    }
    const valuesA = finiteValues(pointsInside(a.dataset).map((p) => p.v));
    const valuesB = finiteValues(pointsInside(b.dataset).map((p) => p.v));
    for (const [side, values] of [["A", valuesA], ["B", valuesB]]) {
        if (values.length < 2) return { ok: false, reason: `The comparison needs at least 2 samples in each dataset; ${named(side)} holds ${values.length}.` };
    }
    return { ok: true, valuesA, valuesB, unitsDiffer: (a.egu || "") !== (b.egu || "") };
}

/** The text that says what a test result means, without a verdict. */
export function testText(method, result) {
    if (method === "chi2") {
        return `Chi-square test that the histograms of A and B on ${result.bins} bins come from one distribution: statistic ${result.statistic.toPrecision(5)}, ${result.degrees} degrees of freedom, p-value ${pText(result.pValue)}.`;
    }
    if (method === "ks") {
        return `Kolmogorov-Smirnov: the largest distance between the distribution functions of A and B is ${result.statistic.toPrecision(5)}, p-value ${pText(result.pValue)} (asymptotic; not exact for small samples).`;
    }
    const level = result.floored ? "not above 0.001" : result.capped ? "not below 0.25" : pText(result.significance);
    return `Anderson-Darling test of two samples: standardized statistic ${result.statistic.toPrecision(5)}, significance ${level}${result.floored || result.capped ? " (the table of critical values ends there)" : ""}.`;
}

/** The compare view of the page: its controls are built once and its body is drawn again at each render and at each run. */
export function createCompare(host, options) {
    const settings = { ...COMPARE_DEFAULTS, ...(options.settings || {}) };
    // A change of a setting tells the page, which writes the address.
    const changed = () => { if (options.changed) options.changed(); };
    // The result of the last run with the key of what it was computed from, or null.
    let result = null;
    let running = 0;
    // The result that the body shows now, and the element that holds the test of the chosen method.
    let drawn = null;
    let testHost = null;
    const mode = node("select", { "aria-label": "Compare mode" });
    for (const [value, text] of COMPARE_MODES) mode.append(node("option", { value }, text));
    mode.value = settings.mode;
    const signalA = node("select", { "aria-label": "Compare signal A" });
    const signalB = node("select", { "aria-label": "Compare signal B" });
    const fromB = node("input", { type: "datetime-local", step: "0.001", "aria-label": "Range B from" });
    const toB = node("input", { type: "datetime-local", step: "0.001", "aria-label": "Range B to" });
    const method = node("select", { "aria-label": "Comparison method" });
    for (const [value, text] of COMPARE_METHODS) method.append(node("option", { value }, text));
    method.value = settings.method;
    const run = node("button", { type: "button" }, "Run comparison");
    const error = node("p", { class: "error", role: "alert" });
    const message = node("p", { class: "note", role: "status" });
    const field = (text, control) => node("label", null, text, control);
    const rangeFields = node("span", { class: "cmp-range" }, field("Range B from ", fromB), field("to ", toB));
    const signalFields = node("span", { class: "cmp-signals" }, field("Signal B ", signalB));
    const controls = node("div", { class: "cmp-controls" }, field("Compare ", mode), field("Signal A ", signalA), rangeFields, signalFields,
        field("Method ", method), run, infoButton(...CARD, options.helpHref));
    const proposal = node("p", { class: "note cmp-proposal" });
    const body = node("div", { class: "cmp-body" });
    host.replaceChildren(controls, error, proposal, message, body);

    /** The key of everything a result is computed from; a result with another key is stale. */
    const currentKey = () => JSON.stringify([settings.mode, settings.a, settings.mode === "signals" ? settings.b : null, +options.range().from, +options.range().to,
        options.resolution(), settings.mode === "ranges" ? [+settings.from, +settings.to] : null]);

    mode.addEventListener("change", () => { settings.mode = mode.value; clear(); render(); changed(); });
    signalA.addEventListener("change", () => { settings.a = signalA.value; clear(); render(); changed(); });
    signalB.addEventListener("change", () => { settings.b = signalB.value; clear(); render(); changed(); });
    method.addEventListener("change", () => { settings.method = method.value; if (result) fillTest(); changed(); });
    for (const input of [fromB, toB]) {
        input.addEventListener("change", () => {
            const start = options.parseTime(fromB.value, settings.from);
            const stop = options.parseTime(toB.value, settings.to);
            if (!start || !stop || !(start < stop)) {
                error.textContent = "Enter range B as a start before its end, in the time zone of the page.";
                fromB.value = options.formatTime(settings.from);
                toB.value = options.formatTime(settings.to);
                return;
            }
            error.textContent = "";
            settings.from = start;
            settings.to = stop;
            settings.edited = true;
            clear();
            render();
            changed();
        });
    }
    run.addEventListener("click", () => start());

    /** Drops the result and any run in progress, with the text of that run: a run that was given up shows no loading text. */
    function clear() {
        running += 1;
        result = null;
        drawn = null;
        message.textContent = "";
        body.replaceChildren();
    }

    /** The proposal of range B: the range of the duration of A that ends where A starts, until the user has edited B. */
    function proposeRange() {
        const { from, to } = options.range();
        if (!settings.edited || !settings.from || !settings.to) {
            const span = +to - +from;
            const proposed = [new Date(+from - span), new Date(+from)];
            if (!settings.from || +settings.from !== +proposed[0] || +settings.to !== +proposed[1]) {
                settings.from = proposed[0];
                settings.to = proposed[1];
                if (result) clear();
            }
        }
    }

    function syncSignals(list) {
        const names = list.map((entry) => entry.name);
        for (const select of [signalA, signalB]) {
            if (names.join("\n") !== [...select.options].map((option) => option.value).join("\n")) {
                select.replaceChildren(...list.map((entry) => node("option", { value: entry.name }, entry.name)));
            }
        }
        if (!names.includes(settings.a)) settings.a = names[0] ?? null;
        if (!names.includes(settings.b) || (settings.mode === "signals" && settings.b === settings.a && names.length > 1)) settings.b = names.find((n) => n !== settings.a) ?? names[0] ?? null;
        if (settings.a !== null) signalA.value = settings.a;
        if (settings.b !== null) signalB.value = settings.b;
    }

    function render() {
        const list = options.signals();
        syncSignals(list);
        // A result that was computed from other ranges, signals or resolution is cleared first, and the page says why.
        if (result && result.key !== currentKey()) {
            clear();
            message.textContent = "What the comparison used has changed. Select Run comparison to compare again.";
        }
        proposeRange();
        mode.value = settings.mode;
        method.value = settings.method;
        rangeFields.hidden = settings.mode !== "ranges";
        signalFields.hidden = settings.mode !== "signals";
        if (document.activeElement !== fromB) fromB.value = options.formatTime(settings.from);
        if (document.activeElement !== toB) toB.value = options.formatTime(settings.to);
        const zone = options.zone();
        proposal.textContent = settings.mode === "ranges"
            ? `Range A is the selected range, ${formatInZone(options.range().from, TIME_FORMAT, zone)} to ${formatInZone(options.range().to, TIME_FORMAT, zone)} ${zoneName(zone, options.range().to)}. Range B ${settings.edited ? "is the range you entered" : "is proposed as the range of the same duration just before A"}; edit it before the run.`
            : "Signal A and signal B are compared over the selected range.";
        if (!list.length) {
            run.disabled = true;
            clear();
            message.textContent = "Select archived signals to compare.";
            return;
        }
        run.disabled = false;
        if (result) {
            message.textContent = "";
            if (drawn !== result) draw();
        } else if (!message.textContent || /Select archived signals/.test(message.textContent)) {
            message.textContent = "Choose what to compare and select Run comparison.";
        }
    }

    async function start() {
        const list = options.signals();
        const token = (running += 1);
        error.textContent = "";
        message.textContent = "";
        body.replaceChildren();
        result = null;
        drawn = null;
        const key = currentKey();
        const entryA = list.find((item) => item.name === settings.a);
        let entryB;
        if (settings.mode === "signals") {
            if (list.length < 2) { message.textContent = "Comparing two signals needs two selected signals; select a second archived signal."; return; }
            if (settings.a === settings.b) { message.textContent = "Signal A and signal B are the same signal; choose two different signals, or compare two ranges of one signal."; return; }
            entryB = list.find((item) => item.name === settings.b);
        } else {
            const { from, to } = options.range();
            if (!(settings.from < settings.to)) { message.textContent = "Range B must start before it ends."; return; }
            if (+settings.from < +to && +settings.to > +from) {
                message.textContent = "Range B overlaps range A. A sample in both ranges would count twice and the tests need independent datasets; move range B so that it does not overlap A.";
                return;
            }
            message.textContent = "Loading range B...";
            let dataset = null;
            let failure = null;
            try {
                dataset = await options.fetch(settings.a, options.resolution(), settings.from, settings.to);
            } catch (problem) {
                failure = String(problem.message || problem);
            }
            if (token !== running) return;
            // The selected range or the resolution may have changed while range B was on its way; a result of the old ones is not shown.
            if (key !== currentKey()) {
                message.textContent = "What the comparison used changed while range B was loading. Select Run comparison to compare again.";
                return;
            }
            message.textContent = "";
            // A range that ends where A starts shares that instant with A (both ends of a range are included); the sample there belongs to A only.
            const adjacent = dataset && +dataset.to === +from;
            const own = adjacent ? { ...dataset, points: dataset.points.filter((p) => p.t < +dataset.to) } : dataset;
            entryB = { name: settings.a, egu: dataset ? dataset.egu : entryA?.egu ?? "", dataset: own, failure };
        }
        if (!entryA) { message.textContent = "Select archived signals to compare."; return; }
        const check = checkComparison(entryA, entryB, settings.mode);
        if (!check.ok) {
            message.textContent = check.reason;
            return;
        }
        result = { key, mode: settings.mode, entryA, entryB, check, ...compute(check.valuesA, check.valuesB, check.unitsDiffer) };
        draw();
    }

    function labelOf(side) {
        const entry = side === "A" ? result.entryA : result.entryB;
        const zone = options.zone();
        const dataset = entry.dataset;
        const range = `${formatInZone(dataset.from, TIME_FORMAT, zone)} to ${formatInZone(dataset.to, TIME_FORMAT, zone)} ${zoneName(zone, dataset.to)}`;
        return { title: `${side}: ${entry.name}${entry.egu ? ` (${entry.egu})` : " (no unit)"}`, detail: `${range}; ${options.sourceText(dataset.seconds)}` };
    }

    function trendPlot(side, parent, scaleDomain) {
        const entry = side === "A" ? result.entryA : result.entryB;
        const dataset = entry.dataset;
        const width = Math.max(WIDTH_LEAST, Math.floor(parent.clientWidth || 360));
        const x = d3.scaleTime().domain([dataset.from, dataset.to]).range([MARGIN.left, width - MARGIN.right]);
        const inside = pointsInside(dataset);
        const own = d3.extent(inside, (p) => p.v);
        const [low, high] = scaleDomain || own;
        const pad = (high - low) * 0.06 || 1;
        const y = d3.scaleLinear().domain([low - pad, high + pad]).range([HEIGHT - MARGIN.bottom, MARGIN.top]);
        const unit = entry.egu || "";
        const zone = options.zone();
        const ticks = (width < NARROW_WIDTH ? [0, 1] : width < MEDIUM_WIDTH ? [0, 1 / 2, 1] : [0, 1 / 3, 2 / 3, 1]).map((f) => new Date(+dataset.from + f * (+dataset.to - +dataset.from)));
        const surface = createPlotCanvas({ width, height: HEIGHT, margin: MARGIN, x, scales: new Map([[unit, y]]), units: [unit], axisWidth: MARGIN.left, onLeft: 1,
            unitLabels: true, axisLabels: new Map([[unit, unit || "no unit"]]), axisLabelAnchor: "start", label: `Trend of ${side}: ${entry.name}`,
            xFormat: (date) => formatInZone(date, AXIS_TIME_FORMAT, zone), xTicks: ticks, grid: "y", tickCount: 5 });
        parent.append(surface.svg.node());
        surface.marks.append("path").attr("class", `cmp-trend cmp-trend-${side.toLowerCase()}`).attr("data-count", inside.length)
            .attr("d", d3.line().x((p) => x(p.t)).y((p) => y(p.v))(inside));
        return surface;
    }

    function draw() {
        body.replaceChildren();
        drawn = result;
        const r = result;
        const zone = options.zone();
        const unit = r.entryA.egu || "";
        const labels = node("div", { class: "cmp-labels" });
        for (const side of ["A", "B"]) {
            const label = labelOf(side);
            labels.append(node("div", { class: `cmp-label cmp-label-${side.toLowerCase()}` }, node("strong", null, label.title), node("span", null, label.detail)));
        }
        body.append(labels);
        if (r.check.unitsDiffer) {
            body.append(node("p", { class: "note cmp-units", role: "status" }, `The units differ (${unit || "no unit"} and ${r.entryB.egu || "no unit"}). Unlike units are not compared: no difference, no overlay and no test, and nothing is scaled; the numbers of each signal stand alone.`));
        }
        const plots = node("div", { class: "cmp-plots" });
        const plotA = node("div", { class: "chart cmp-plot" });
        const plotB = node("div", { class: "chart cmp-plot" });
        plots.append(plotA, plotB);
        body.append(plots);
        const shared = r.check.unitsDiffer ? null : [Math.min(d3.min(r.check.valuesA), d3.min(r.check.valuesB)), Math.max(d3.max(r.check.valuesA), d3.max(r.check.valuesB))];
        trendPlot("A", plotA, shared);
        trendPlot("B", plotB, shared);
        if (!r.check.unitsDiffer) drawDistributions(r);
        drawTable(r);
        testHost = node("div", { class: "cmp-test-host" });
        body.append(testHost);
        fillTest();
        body.append(node("p", { class: "note cmp-source" }, `Datasets: A has ${r.m.a.n} samples (${options.sourceText(r.entryA.dataset.seconds)}), B has ${r.m.b.n} (${options.sourceText(r.entryB.dataset.seconds)}).${r.entryA.dataset.seconds === "raw" ? "" : " The numbers describe the means, not the stored samples."}`));
    }

    function drawDistributions(r) {
        const holder = node("div", { class: "chart cmp-distribution" });
        body.append(holder);
        const width = Math.max(WIDTH_LEAST, Math.floor(holder.clientWidth || 720));
        const x = d3.scaleLinear().domain([r.lowest, r.highest > r.lowest ? r.highest : r.lowest + 1]).range([MARGIN.left, width - MARGIN.right]);
        const binWidth = (r.highest - r.lowest) / r.number || 1;
        const densityA = r.countsA.map((c) => c / (r.m.a.n * binWidth));
        const densityB = r.countsB.map((c) => c / (r.m.b.n * binWidth));
        const top = Math.max(d3.max(densityA), d3.max(densityB)) * 1.1 || 1;
        const y = d3.scaleLinear().domain([0, top]).range([DISTRIBUTION_HEIGHT - MARGIN.bottom, MARGIN.top]);
        const unit = r.entryA.egu || "";
        const surface = createPlotCanvas({ width, height: DISTRIBUTION_HEIGHT, margin: MARGIN, x, scales: new Map([[unit, y]]), units: [unit], axisWidth: MARGIN.left, onLeft: 1,
            unitLabels: true, axisLabels: new Map([[unit, `Density per ${unit || "unit"}`]]), axisLabelAnchor: "start", xLabel: `${r.entryA.name} / ${unit || "no unit"}`, xTickY: DISTRIBUTION_HEIGHT - 24,
            label: "Normalized distributions of A and B", xFormat: d3.format(".4~g"), xTicks: x.ticks(width < MEDIUM_WIDTH ? 3 : 5), grid: "y", tickCount: 5 });
        holder.append(surface.svg.node());
        const edge = (i) => r.lowest + i * binWidth;
        const bars = (counts, density, cls) => surface.marks.selectAll(`rect.${cls}`).data(density).join("rect").attr("class", cls)
            .attr("data-count", (_, i) => counts[i]).attr("data-x0", (_, i) => edge(i)).attr("data-x1", (_, i) => edge(i + 1))
            .attr("x", (_, i) => x(edge(i)) + 0.5).attr("width", Math.max(1, x(edge(1)) - x(edge(0)) - 1))
            .attr("y", (d) => y(d)).attr("height", (d) => y(0) - y(d));
        bars(r.countsA, densityA, "cmp-bar-a");
        bars(r.countsB, densityB, "cmp-bar-b");
        // The bins by their lower edge; a one-argument accessor, since a two-argument function would be read by D3 as a comparator.
        const starts = r.countsA.map((_, i) => ({ x0: edge(i) }));
        const search = d3.bisector((bin) => bin.x0).right;
        surface.bindHover(holder, ({ x: at }) => {
            const i = Math.min(r.countsA.length - 1, Math.max(0, search(starts, +at) - 1));
            return { title: `${format(edge(i), "")} to ${format(edge(i + 1), unit)}`, rows: [`A: ${r.countsA[i]} samples, share ${((100 * r.countsA[i]) / r.m.a.n).toFixed(2)} %`, `B: ${r.countsB[i]} samples, share ${((100 * r.countsB[i]) / r.m.b.n).toFixed(2)} %`],
                px: x((edge(i) + edge(i + 1)) / 2), py: y(Math.max(densityA[i], densityB[i])) };
        });
        holder.append(node("p", { class: "note" }, `Both distributions on the same ${r.number} bins as densities: A filled, B outlined.`));
    }

    function drawTable(r) {
        const eguA = r.entryA.egu || "";
        const eguB = r.entryB.egu || "";
        const head = node("tr", null, ...["", "A", "B", ...(r.difference ? ["A minus B"] : [])].map((text) => node("th", { scope: "col" }, text)));
        const row = (name, a, b, diff) => node("tr", { "data-row": name }, node("th", { scope: "row" }, name), node("td", { class: "num" }, a), node("td", { class: "num" }, b), ...(r.difference ? [node("td", { class: "num" }, diff ?? "")] : []));
        const fmt = (v, u) => (v === null || v === undefined ? "not defined" : format(v, u));
        const d = r.difference;
        const rows = [
            row("Samples", String(r.m.a.n), String(r.m.b.n), ""),
            row("Mean", fmt(r.m.a.mean, eguA), fmt(r.m.b.mean, eguB), d && d.meanDifference !== null ? `${format(d.meanDifference, eguA)} ± ${format(d.meanDifferenceError, "")}` : ""),
            row("Standard deviation", fmt(r.m.a.sd, eguA), fmt(r.m.b.sd, eguB), d && d.sdDifference !== null ? `${format(d.sdDifference, eguA)} ± ${format(d.sdDifferenceError, "")}` : ""),
            row("Minimum", fmt(r.m.a.min, eguA), fmt(r.m.b.min, eguB), ""),
            row("Maximum", fmt(r.m.a.max, eguA), fmt(r.m.b.max, eguB), ""),
        ];
        body.append(node("h3", { class: "chart-stats-title" }, "Numbers"),
            node("div", { class: "cmp-table-box" }, node("table", { class: "chart-stats cmp-table", "aria-label": "Counts, means and spreads of A and B" }, node("thead", null, head), node("tbody", null, ...rows))));
        if (r.difference) body.append(node("p", { class: "note" }, "The differences carry their standard errors, the square root of the sum of the squares of the two standard errors."));
    }

    function fillTest() {
        const r = result;
        const chosen = r.tests[settings.method];
        const section = node("div", { class: "cmp-test" }, node("h3", { class: "chart-stats-title" }, COMPARE_METHODS.find(([value]) => value === settings.method)[1]));
        if (chosen.refusal) {
            section.append(node("p", { class: "note cmp-test-refusal", role: "status" }, chosen.refusal));
        } else {
            section.append(node("p", { class: "cmp-test-result", "data-method": settings.method, "data-p": chosen.result.pValue ?? chosen.result.significance }, testText(settings.method, chosen.result)));
            section.append(node("p", { class: "note" }, "The test treats the samples as independent; successive samples of a signal are not, so a small p-value overstates the evidence."));
        }
        testHost.replaceChildren(section);
    }

    return { render, settings, clear };
}
