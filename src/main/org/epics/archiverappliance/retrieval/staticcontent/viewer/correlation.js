// The Correlation tab of the analyzer: two numeric scalars of the selected range paired at the union of their sample times
// (aa/pairing.js, with its gap rule), shown as a scatter plot with each axis in its own unit, a profile of Y against X or a
// density contour, with X and Y projections, points sized, faded or coloured by time, a rectangle selection that counts and
// correlates the pairs inside it, Pearson's and Spearman's correlation with their p-values, the cross-correlation over lags of
// the paired sequence, and the two trends under one another sharing the time axis. The pairing is written above the plot with
// its counts; an input that cannot give a result is refused with its reason and shows no plot and no stale number. The fit panel
// fits a model of Y against X over the pairs from its button, draws the curve with its one-sigma band and the residuals, and a
// typed expression over x and y makes a derived signal, drawn as a third trend and offered to the Export tab.
import { createPlotCanvas } from "../comm/js/aa/chart.js";
import { node } from "../comm/js/aa/dom.js";
import { infoButton } from "../comm/js/aa/card.js";
import { format } from "../comm/js/aa/chart/text.js";
import { pairSeries, GAP_FACTOR } from "../comm/js/aa/pairing.js";
import { pearson, spearman, crossCorrelation, profile } from "../comm/js/aa/correlation.js";
import { formatInZone, zoneName } from "../comm/js/aa/timezone.js";
import { parse } from "../comm/js/aa/expression.js";
import { compatibleUnits, conversionFactor } from "../comm/js/aa/units.js";
import { pointsInside } from "./distribution.js";
import { createFitPanel, fittedCurve, residualsOf, FIT_PANEL_DEFAULTS } from "./fit-panel.js";

const d3 = globalThis.d3;

export const CORRELATION_VIEWS = [["scatter", "Scatter plot"], ["profile", "Profile"], ["density", "Density contour"]];
export const POINT_SIZES = [["1", "1 px"], ["2", "2 px"], ["3", "3 px"], ["4", "4 px"]];
export const POINT_OPACITIES = [["1", "Opaque"], ["0.6", "Faded"], ["0.3", "Faint"]];
export const LAG_CHOICES = [["0", "None"], ["5", "5 pairs"], ["10", "10 pairs"], ["20", "20 pairs"]];
// The settings of the tab and their defaults; the address carries the ones that differ (viewer/tool-address.js).
export const CORRELATION_DEFAULTS = Object.freeze({ x: null, y: null, view: "scatter", size: "2", opacity: "0.6", time: false, lags: "10", brush: false, model: FIT_PANEL_DEFAULTS.model, fitFrom: "", fitTo: "", xUnit: "", yUnit: "" });
const RESIDUAL_HEIGHT = 140;
export const PAIRS_LEAST = 3;
export const PROFILE_BINS = 10;
export const DENSITY_BANDWIDTH = 12;
export const PROJECTION_BINS = 30;
const HEIGHT = 360;
const PROJECTION_HEIGHT = 80;
const TREND_HEIGHT = 220;
const WIDTH_LEAST = 320;
const MARGIN = { left: 84, right: 24, top: 36, bottom: 60 };
const TIME_FORMAT = "%Y-%m-%d %H:%M:%S";
const AXIS_TIME_FORMAT = "%m-%d %H:%M";
const MEDIUM_WIDTH = 480;
const NARROW_WIDTH = 360;
// The value axes start this far under the top margin, so that the label of the highest tick stays clear of the axis name,
// which the canvas writes 14 pixels above the plot and, when it is long, from the left edge over the tick labels.
const AXIS_TOP_ROOM = 14;

const CARD = [
    "Correlation: how are two signals paired, and what do the numbers mean?",
    [
        ["In short", "The samples of two signals of the selected range are paired at every time either has a sample, each paired with the value the other holds there, and the pairs are drawn as points, with their correlation."],
        ["Pairing", `An archived signal holds its last value until the next sample, so at a sample time of one signal the other has a value: its last sample at or before that time. A held value is paired only when it is not older than ${GAP_FACTOR} times the median spacing of its signal and no lost connection was recorded between it and the sample time; a sample without such a value is left out and counted. A time both signals sample gives one pair. The pairing line above the plot gives the counts, the spacings and the overlap of the two signals.`],
        ["Scatter plot", "Each pair is a point, X and Y in their own units; the projections beside the axes are the histograms of the paired values. Point size and transparency help dense data; colour by time paints early pairs dark and late pairs light. Select pairs with a rectangle to count them and read their correlation."],
        ["Profile", `The mean of Y in each of ${PROFILE_BINS} equal bins of X with the standard error of that mean, drawn with its bars: the shape of the dependence without the scatter.`],
        ["Density contour", "The density of the points estimated with a Gaussian kernel and drawn as contours, for data too dense to read as points."],
        ["Correlation", "Pearson's r measures a straight-line relation, Spearman's rho a monotonic one (it correlates the ranks). The p-value is the chance of a correlation at least this far from zero in unrelated signals; it says nothing about the size of an effect. Neither says which signal drives the other."],
        ["Cross-correlation", "Pearson's r between X and Y shifted by a number of pairs, for lags up to the number chosen; the lag of the largest absolute value says whether one signal follows the other, in pairs of the paired sequence, not in seconds."],
        ["Trends", "The two signals over the selected range, one under the other on the same time axis, so that a pair can be placed in time."],
        ["Fit", "A model of Y against X fitted to the pairs in the fit range from Run fit: the line, polynomial, exponential, power and logarithm by least squares (exponential and power in a transformed variable), the sine, Gaussian and Landau by Levenberg-Marquardt from the start values, with parameters fixed or bounded. The errors come from the covariance scaled by the reduced chi-square; the band is one sigma of the fitted curve; the residuals (observed minus fitted) are drawn under the fit result. A fit of another pairing is cleared, and a fit never certifies the physical model."],
        ["Unit", "The unit of X and of Y can be shown in another prefix of the same base unit (mm in um, V in mV, kHz in MHz): the values are multiplied by a power of ten and the pairs, the correlation, the fit and its parameters, the trends and the derived signal use the converted values. A unit that is not a prefix and a base unit in use (mm/s, degC, Gs) offers no change, so that nothing is converted by a guess; a change clears a fit made in the earlier unit."],
        ["Derived signal", "A typed expression over x and y (or the PV names, in the units shown), evaluated at every pair and drawn as a third trend: a difference, a sum, a ratio, or any arithmetic of them. The unit is yours to name; the Export tab writes the signal as CSV."],
    ],
    null,
];

/** The histogram of values over count equal bins between low and high: [{x0, x1, n}]. */
function histogram(values, low, high, count) {
    const width = (high - low) / count || 1;
    const bins = Array.from({ length: count }, (_, i) => ({ x0: low + i * width, x1: low + (i + 1) * width, n: 0 }));
    for (const v of values) {
        const i = Math.min(count - 1, Math.max(0, Math.floor((v - low) / width)));
        bins[i].n += 1;
    }
    return bins;
}

const nameWithUnit = (entry) => `${entry.name}${entry.egu ? ` (${entry.egu})` : ""}`;
const pText = (p) => (p === 0 ? "p below 1e-300" : p < 1e-4 ? `p ${p.toExponential(2)}` : `p ${p.toFixed(4)}`);

/** The Correlation tab: its controls are built once and its body is drawn again at each render. */
export function createCorrelation(host, options) {
    const settings = { ...CORRELATION_DEFAULTS, ...(options.settings || {}) };
    const changed = () => { render(); if (options.changed) options.changed(); };
    const select = (label, choices, key) => {
        const element = node("select", { "aria-label": label });
        for (const [value, text] of choices) element.append(node("option", { value }, text));
        element.value = settings[key];
        element.addEventListener("change", () => { settings[key] = element.value; changed(); });
        return element;
    };
    const signalX = node("select", { "aria-label": "Correlation signal X" });
    const signalY = node("select", { "aria-label": "Correlation signal Y" });
    signalX.addEventListener("change", () => { settings.x = signalX.value; changed(); });
    signalY.addEventListener("change", () => { settings.y = signalY.value; changed(); });
    // The unit each signal is shown in: its own, or another prefix of the same base unit (aa/units.js); the choices follow the signal.
    const unitSelectX = node("select", { "aria-label": "Correlation unit of X" });
    const unitSelectY = node("select", { "aria-label": "Correlation unit of Y" });
    unitSelectX.addEventListener("change", () => { settings.xUnit = unitSelectX.value; changed(); });
    unitSelectY.addEventListener("change", () => { settings.yUnit = unitSelectY.value; changed(); });
    const swap = node("button", { type: "button", "aria-label": "Swap X and Y" }, "Swap");
    swap.addEventListener("click", () => { [settings.x, settings.y] = [settings.y, settings.x]; [settings.xUnit, settings.yUnit] = [settings.yUnit, settings.xUnit]; changed(); });
    const view = select("Correlation view", CORRELATION_VIEWS, "view");
    const size = select("Point size", POINT_SIZES, "size");
    const opacity = select("Point transparency", POINT_OPACITIES, "opacity");
    const time = node("input", { type: "checkbox", "aria-label": "Colour by time" });
    time.checked = settings.time;
    time.addEventListener("change", () => { settings.time = time.checked; changed(); });
    const lags = select("Lags for the cross-correlation", LAG_CHOICES, "lags");
    const brush = node("input", { type: "checkbox", "aria-label": "Select pairs" });
    brush.checked = settings.brush;
    brush.addEventListener("change", () => { settings.brush = brush.checked; changed(); });
    const field = (text, control) => node("label", null, text, control);
    const controls = node("div", { class: "cor-controls" }, field("X ", signalX), field("X unit ", unitSelectX), field("Y ", signalY), field("Y unit ", unitSelectY), swap, field("View ", view), field("Size ", size), field("Points ", opacity),
        node("label", { class: "check-inline" }, time, " Colour by time"), field("Lags ", lags), node("label", { class: "check-inline" }, brush, " Select pairs"), infoButton(...CARD, options.helpHref));
    const message = node("p", { class: "note", role: "status" });
    const pairing = node("p", { class: "note cor-pairing" });
    const selection = node("p", { class: "note cor-selection", role: "status" });
    const plots = node("div", { class: "cor-plots" });
    const numbers = node("div", { class: "cor-numbers" });
    const trends = node("div", { class: "cor-trends" });
    const residuals = node("div", { class: "chart cor-residuals" });
    const fitHost = node("div", { class: "cor-fit" });
    const fitPanel = createFitPanel(fitHost, { label: "Fit", settings: { model: settings.model, from: settings.fitFrom, to: settings.fitTo }, changed: () => { settings.model = fitPanel.settings.model; settings.fitFrom = fitPanel.settings.from; settings.fitTo = fitPanel.settings.to; if (options.changed) options.changed(); } });
    // The key of the pairing a fit was computed from; a fit of another pairing is cleared.
    let fitKey = null;
    let pairingKey = null;
    // The units the last result was shown in, for what the Export tab writes.
    let shown = { x: "", y: "" };
    fitPanel.onResult(() => { fitKey = pairingKey; render(); });
    const expression = node("input", { type: "text", size: "24", "aria-label": "Derived signal expression", placeholder: "y - x" });
    const unitField = node("input", { type: "text", size: "6", "aria-label": "Derived signal unit", placeholder: "unit" });
    const apply = node("button", { type: "button" }, "Derive");
    const derivedError = node("p", { class: "error", role: "alert" });
    const derived = { expression: "", unit: "", parsed: null, points: [] };
    apply.addEventListener("click", () => {
        const text = expression.value.trim();
        derivedError.textContent = "";
        if (!text) { derived.expression = ""; derived.parsed = null; derived.points = []; render(); return; }
        const parsed = parse(text);
        if (!parsed.ok) { derivedError.textContent = parsed.reason; return; }
        const unknown = parsed.variables.filter((v) => !["x", "y", "X", "Y", settings.x, settings.y].includes(v));
        if (unknown.length) { derivedError.textContent = `Unknown variable${unknown.length > 1 ? "s" : ""} ${unknown.join(", ")}: use x and y, or the names of the two signals.`; return; }
        derived.expression = text;
        derived.unit = unitField.value.trim();
        derived.parsed = parsed;
        render();
    });
    const derivedHost = node("div", { class: "cor-derived" }, node("h3", { class: "cor-section-title" }, "Derived signal"), node("div", { class: "cor-controls" }, node("label", null, "Expression ", expression), node("label", null, "Unit ", unitField), apply), derivedError);
    host.replaceChildren(controls, message, pairing, plots, selection, numbers, node("h3", { class: "cor-section-title" }, "Fit of Y against X"), fitHost, residuals, derivedHost, trends);

    function syncSignals(list) {
        const names = list.map((entry) => entry.name);
        for (const element of [signalX, signalY]) {
            if (names.join("\n") !== [...element.options].map((option) => option.value).join("\n")) {
                element.replaceChildren(...list.map((entry) => node("option", { value: entry.name }, entry.name)));
            }
        }
        if (!names.includes(settings.x)) settings.x = names[0] ?? null;
        // Y starts as the first signal other than X; a user who chooses the same signal for both is told so, not corrected.
        if (!names.includes(settings.y)) settings.y = names.find((n) => n !== settings.x) ?? names[0] ?? null;
        if (settings.x !== null) signalX.value = settings.x;
        if (settings.y !== null) signalY.value = settings.y;
    }

    /**
     * Fills each unit choice with the units that the unit text of its signal can be shown in. A unit that the signal does not offer
     * (another signal chosen, or a text of the address) is dropped once the samples of the signal are known, and so is the unit that
     * the signal already has, which is the default; the address is then written again.
     */
    function syncUnits(list) {
        let dropped = false;
        for (const [select, key, name] of [[unitSelectX, "xUnit", settings.x], [unitSelectY, "yUnit", settings.y]]) {
            const entry = list.find((item) => item.name === name);
            const choices = entry ? compatibleUnits(entry.egu) : [];
            if (settings[key] && entry && entry.dataset && (!choices.includes(settings[key]) || settings[key] === entry.egu)) { settings[key] = ""; dropped = true; }
            select.replaceChildren(node("option", { value: "" }, entry && entry.egu ? `as stored (${entry.egu})` : "as stored"), ...choices.filter((c) => !entry || c !== entry.egu).map((c) => node("option", { value: c }, c)));
            select.value = settings[key];
            select.disabled = choices.length === 0;
        }
        if (dropped && options.changed) options.changed();
    }

    /** The finite samples of an entry inside the selected range, or the reason there are none. */
    function samplesOf(entry, role) {
        if (!entry.dataset) return { ok: false, reason: entry.failure ? `The samples of ${role} (${entry.name}) could not be read: ${entry.failure}` : `Loading the samples of ${role}...` };
        const points = pointsInside(entry.dataset);
        if (!points.length) return { ok: false, reason: entry.dataset.form === "No samples" ? `${role} (${entry.name}) holds no samples in the selected range.` : `${role} (${entry.name}) has no numeric scalar samples in the selected range; the correlation reads numeric scalars only.` };
        return { ok: true, points };
    }

    function render() {
        const list = options.signals();
        syncSignals(list);
        syncUnits(list);
        plots.replaceChildren();
        numbers.replaceChildren();
        trends.replaceChildren();
        residuals.replaceChildren();
        fitPanel.setEnabled(false);
        pairing.textContent = "";
        message.textContent = "";
        selection.textContent = "";
        view.value = settings.view;
        size.value = settings.size;
        opacity.value = settings.opacity;
        lags.value = settings.lags;
        time.checked = settings.time;
        brush.checked = settings.brush;
        swap.disabled = list.length < 2;
        if (list.length < 2) {
            message.textContent = "Select two archived signals to correlate.";
            return;
        }
        if (settings.x === settings.y) {
            message.textContent = "X and Y are the same signal; choose two different signals.";
            return;
        }
        const storedX = list.find((item) => item.name === settings.x);
        const storedY = list.find((item) => item.name === settings.y);
        const sx = samplesOf(storedX, "X");
        if (!sx.ok) { message.textContent = sx.reason; return; }
        const sy = samplesOf(storedY, "Y");
        if (!sy.ok) { message.textContent = sy.reason; return; }
        // A change of unit multiplies the values by a power of ten and names the unit shown: the pairs, the correlations, the fit, the
        // derived signal and the trends all use the converted values.
        const factorX = (settings.xUnit && conversionFactor(storedX.egu, settings.xUnit)) || 1;
        const factorY = (settings.yUnit && conversionFactor(storedY.egu, settings.yUnit)) || 1;
        const entryX = { ...storedX, egu: settings.xUnit || storedX.egu };
        const entryY = { ...storedY, egu: settings.yUnit || storedY.egu };
        if (factorX !== 1) sx.points = sx.points.map((p) => ({ ...p, v: p.v * factorX }));
        if (factorY !== 1) sy.points = sy.points.map((p) => ({ ...p, v: p.v * factorY }));
        shown = { x: entryX.egu, y: entryY.egu };
        const zone = options.zone();
        const paired = pairSeries(sx.points, sy.points);
        if (!paired.overlap) {
            const span = (points) => `${formatInZone(new Date(points[0].t), TIME_FORMAT, zone)} to ${formatInZone(new Date(points[points.length - 1].t), TIME_FORMAT, zone)}`;
            message.textContent = `The two signals share no time: X covers ${span(sx.points)} and Y covers ${span(sy.points)} ${zoneName(zone, new Date(sy.points[0].t))}. Choose a range where both have samples.`;
            return;
        }
        const slower = Math.min(paired.countX, paired.countY);
        const spacing = (ms) => (ms === null ? "one sample" : `every ${d3.format(".4~g")(ms / 1000)} s`);
        pairing.textContent = `Pairing: at every sample time of either signal, the value the other holds there, not older than ${GAP_FACTOR} median spacings (X ${spacing(paired.medianX)}, Y ${spacing(paired.medianY)}) and not across a lost connection. `
            + `${paired.pairs.length} pairs from ${paired.countX} samples of X and ${paired.countY} of Y (the slower signal has ${slower}); ${paired.excludedX} of X and ${paired.excludedY} of Y left out without a value of the other. `
            + `Overlap ${formatInZone(new Date(paired.overlap.from), TIME_FORMAT, zone)} to ${formatInZone(new Date(paired.overlap.to), TIME_FORMAT, zone)} ${zoneName(zone, new Date(paired.overlap.to))}; ${options.sourceText(entryX.dataset.seconds)}.`;
        if (paired.pairs.length < PAIRS_LEAST) {
            message.textContent = `${paired.pairs.length} pair${paired.pairs.length === 1 ? "" : "s"}; a correlation needs at least ${PAIRS_LEAST}. Choose a longer range or signals that overlap.`;
            return;
        }
        const xs = paired.pairs.map((p) => p.x);
        const ys = paired.pairs.map((p) => p.y);
        const r = pearson(xs, ys);
        const rho = spearman(xs, ys);
        const constant = r === null ? (d3.extent(xs)[0] === d3.extent(xs)[1] ? "X" : "Y") : null;
        pairingKey = JSON.stringify([settings.x, settings.y, settings.xUnit, settings.yUnit, +options.range().from, +options.range().to, entryX.dataset.seconds, paired.pairs.length]);
        if (fitPanel.result && fitKey !== pairingKey) {
            fitPanel.clear();
            message.textContent = "The pairing the fit used has changed; the fit was cleared. Select Run fit to fit again.";
        }
        // The units are part of the name of the data, so that the start values of an iterative model follow a change of unit.
        fitPanel.setData(xs, ys, null, `${entryY.name} (${entryY.egu || "no unit"}) against ${entryX.name} (${entryX.egu || "no unit"})`);
        fitPanel.setEnabled(true);
        const fit = fitPanel.result && fitKey === pairingKey ? fitPanel.result : null;
        if (derived.parsed) {
            const values = { [settings.x]: 0, [settings.y]: 0 };
            derived.points = paired.pairs.map((p) => { values.x = p.x; values.X = p.x; values.y = p.y; values.Y = p.y; values[settings.x] = p.x; values[settings.y] = p.y; return { t: p.t, v: derived.parsed.evaluate(values) }; }).filter((p) => Number.isFinite(p.v));
            if (!derived.points.length) derivedError.textContent = `${derived.expression} gives no finite value over the pairs.`;
        } else {
            derived.points = [];
        }
        drawMain(entryX, entryY, paired, zone, fit);
        const rows = [
            ["Pairs", `${paired.pairs.length} at the union of the sample times`],
            ["Samples", `X ${paired.countX}, Y ${paired.countY}; the slower signal has ${slower}`],
            ["Left out", `${paired.excludedX} of X and ${paired.excludedY} of Y without a value of the other within ${GAP_FACTOR} median spacings`],
            ["Pearson r", r ? `${r.r.toFixed(4)} (${pText(r.p)}; a straight-line relation)` : `not defined: ${constant} does not vary over the pairs`],
            ["Spearman rho", rho ? `${rho.rho.toFixed(4)} (${pText(rho.p)}; a monotonic relation)` : `not defined: ${constant} does not vary over the pairs`],
        ];
        const maxLag = Number(settings.lags);
        if (maxLag > 0 && r) {
            const cross = crossCorrelation(xs, ys, maxLag);
            let best = 0;
            cross.values.forEach((v, i) => { if (Number.isFinite(v) && Math.abs(v) > Math.abs(cross.values[best] || 0)) best = i; });
            rows.push(["Cross-correlation", `largest |r| ${cross.values[best].toFixed(4)} at a lag of ${cross.lags[best]} pair${Math.abs(cross.lags[best]) === 1 ? "" : "s"} (Y shifted against X; lags to ${maxLag} pairs, not seconds)`]);
        }
        numbers.append(node("table", { class: "chart-stats cor-table", "aria-label": "The numbers of the correlation" }, node("tbody", null, ...rows.map(([name, value]) => node("tr", { "data-row": name }, node("th", { scope: "row" }, name), node("td", null, value))))));
        drawTrends(entryX, entryY, sx.points, sy.points, zone);
    }

    /** What the Export tab can write: the last fit of this pairing and the derived signal. */
    function exportables() {
        const fit = fitPanel.result && fitKey === pairingKey ? fitPanel.result : null;
        return { fit: fit ? { ...fit, tab: "correlation", x: settings.x, y: settings.y, xUnit: shown.x, yUnit: shown.y } : null, derived: derived.parsed && derived.points.length ? { expression: derived.expression, unit: derived.unit, x: settings.x, y: settings.y, xUnit: shown.x, yUnit: shown.y, points: derived.points } : null };
    }

    /** The scatter plot, the profile or the density contour, with the two projections. */
    function drawMain(entryX, entryY, paired, zone, fit) {
        const pairs = paired.pairs;
        const width = Math.max(WIDTH_LEAST, Math.floor(plots.clientWidth || 720));
        const projectionWidth = Math.min(PROJECTION_HEIGHT * 2, Math.floor(width / 4));
        const mainWidth = width - projectionWidth;
        const xs = pairs.map((p) => p.x);
        const ys = pairs.map((p) => p.y);
        const pad = ([low, high]) => { const d = (high - low) * 0.05 || Math.abs(low) * 0.05 || 1; return [low - d, high + d]; };
        const xDomain = pad(d3.extent(xs));
        const yDomain = pad(d3.extent(ys));
        const unitX = entryX.egu || "";
        const unitY = entryY.egu || "";
        const x = d3.scaleLinear().domain(xDomain).range([MARGIN.left, mainWidth - MARGIN.right]);
        const y = d3.scaleLinear().domain(yDomain).range([HEIGHT - MARGIN.bottom, MARGIN.top + AXIS_TOP_ROOM]);
        const surface = createPlotCanvas({ width: mainWidth, height: HEIGHT, margin: MARGIN, x, scales: new Map([[unitY || "y", y]]), units: [unitY || "y"], axisWidth: MARGIN.left, onLeft: 1,
            unitLabels: true, axisLabels: new Map([[unitY || "y", nameWithUnit(entryY)]]), axisLabelAnchor: "start", xLabel: nameWithUnit(entryX), xTickY: HEIGHT - 30,
            label: `${CORRELATION_VIEWS.find(([v]) => v === settings.view)[1]} of ${entryY.name} against ${entryX.name}`, xFormat: d3.format(".4~g"), xTicks: x.ticks(mainWidth < MEDIUM_WIDTH ? 3 : 6), grid: "both", tickCount: 5 });
        const main = node("div", { class: "cor-main" });
        main.append(surface.svg.node());
        const colour = d3.scaleSequential(d3.interpolateViridis).domain([pairs[0].t, pairs[pairs.length - 1].t]);
        const radius = Number(settings.size);
        const alpha = Number(settings.opacity);
        if (settings.view === "density") {
            const contours = d3.contourDensity().x((p) => x(p.x)).y((p) => y(p.y)).size([mainWidth, HEIGHT]).bandwidth(DENSITY_BANDWIDTH)(pairs);
            const shade = d3.scaleSequential(d3.interpolateViridis).domain([0, d3.max(contours, (c) => c.value) || 1]);
            surface.marks.selectAll("path").data(contours).join("path").attr("class", "cor-contour").attr("data-count", contours.length).attr("d", d3.geoPath()).attr("fill", (c) => shade(c.value)).attr("fill-opacity", 0.7);
        } else {
            surface.marks.selectAll("circle").data(pairs).join("circle").attr("class", "cor-point").attr("r", radius).attr("fill-opacity", alpha)
                .attr("cx", (p) => x(p.x)).attr("cy", (p) => y(p.y)).attr("fill", (p) => (settings.time ? colour(p.t) : "var(--accent)"));
        }
        if (settings.view === "profile") {
            const edges = d3.range(PROFILE_BINS + 1).map((i) => xDomain[0] + ((xDomain[1] - xDomain[0]) * i) / PROFILE_BINS);
            const bins = profile(xs, ys, edges);
            const centres = bins.map((b, i) => ({ ...b, xc: (edges[i] + edges[i + 1]) / 2 })).filter((b) => b.mean !== null);
            const group = surface.marks.append("g").attr("class", "cor-profile").attr("data-bins", centres.length);
            group.selectAll("line").data(centres.filter((b) => b.error !== null)).join("line").attr("class", "cor-profile-bar")
                .attr("x1", (b) => x(b.xc)).attr("x2", (b) => x(b.xc)).attr("y1", (b) => y(b.mean - b.error)).attr("y2", (b) => y(b.mean + b.error));
            group.append("path").attr("class", "cor-profile-line").attr("d", d3.line().x((b) => x(b.xc)).y((b) => y(b.mean))(centres));
            group.selectAll("circle").data(centres).join("circle").attr("class", "cor-profile-mean").attr("r", 3.5).attr("cx", (b) => x(b.xc)).attr("cy", (b) => y(b.mean));
        }
        if (fit) {
            const curve = fittedCurve(fit, Math.max(xDomain[0], fit.range[0]), Math.min(xDomain[1], fit.range[1]));
            surface.marks.append("path").attr("class", "cor-fit-band").attr("data-points", curve.length)
                .attr("d", d3.area().x((p) => x(p.x)).y0((p) => y(p.y - (Number.isFinite(p.sigma) ? p.sigma : 0))).y1((p) => y(p.y + (Number.isFinite(p.sigma) ? p.sigma : 0)))(curve));
            surface.marks.append("path").attr("class", "cor-fit-curve").attr("data-model", fit.model).attr("d", d3.line().x((p) => x(p.x)).y((p) => y(p.y))(curve));
            // The residuals are drawn under the fit result over the full width of the tab, on their own x scale of the same domain.
            const res = residualsOf(fit, xs, ys);
            const rWidth = Math.max(WIDTH_LEAST, Math.floor(residuals.clientWidth || width));
            const rx = d3.scaleLinear().domain(xDomain).range([MARGIN.left, rWidth - MARGIN.right]);
            const rExtent = d3.extent(res, (p) => p.r);
            const rPad = (rExtent[1] - rExtent[0]) * 0.1 || 1;
            const ry = d3.scaleLinear().domain([rExtent[0] - rPad, rExtent[1] + rPad]).range([RESIDUAL_HEIGHT - 40, MARGIN.top + AXIS_TOP_ROOM]);
            const rSurface = createPlotCanvas({ width: rWidth, height: RESIDUAL_HEIGHT, margin: { left: MARGIN.left, right: MARGIN.right, top: MARGIN.top, bottom: 40 }, x: rx, scales: new Map([[unitY || "y", ry]]), units: [unitY || "y"], axisWidth: MARGIN.left, onLeft: 1,
                unitLabels: true, axisLabels: new Map([[unitY || "y", `Residuals of ${fit.model}: observed minus fitted ${unitY}`]]), axisLabelAnchor: "start", label: `Residuals of the ${fit.model} fit`, xFormat: d3.format(".4~g"), xTicks: rx.ticks(rWidth < MEDIUM_WIDTH ? 3 : 6), grid: "y", tickCount: 3 });
            rSurface.marks.append("line").attr("class", "cor-zero").attr("x1", rx.range()[0]).attr("x2", rx.range()[1]).attr("y1", ry(0)).attr("y2", ry(0));
            rSurface.marks.selectAll("circle").data(res).join("circle").attr("class", "cor-residual").attr("r", 1.5).attr("data-count", res.length).attr("cx", (p) => rx(p.x)).attr("cy", (p) => ry(p.r));
            residuals.append(rSurface.svg.node());
        }
        const nearest = (px, py) => {
            let best = null;
            let bestDistance = Infinity;
            for (const p of pairs) {
                const dx = x(p.x) - px;
                const dy = y(p.y) - py;
                const distance = dx * dx + dy * dy;
                if (distance < bestDistance) { bestDistance = distance; best = p; }
            }
            return best;
        };
        surface.bindHover(main, ({ px, py }) => {
            const p = nearest(px, py);
            if (!p) return null;
            return { title: formatInZone(new Date(p.t), TIME_FORMAT, zone), rows: [`${entryX.name}: ${format(p.x, unitX)}`, `${entryY.name}: ${format(p.y, unitY)}`], px: x(p.x), py: y(p.y) };
        });
        if (settings.brush) {
            const brushLayer = surface.marks.append("g").attr("class", "cor-brush");
            const b = d3.brush().extent([[MARGIN.left, MARGIN.top], [mainWidth - MARGIN.right, HEIGHT - MARGIN.bottom]]).on("end", (event) => {
                if (!event.selection) { selection.textContent = ""; surface.marks.selectAll(".cor-point").classed("cor-selected", false); return; }
                const [[x0, y0], [x1, y1]] = event.selection;
                const inside = pairs.filter((p) => x(p.x) >= x0 && x(p.x) <= x1 && y(p.y) >= y0 && y(p.y) <= y1);
                surface.marks.selectAll(".cor-point").classed("cor-selected", (p) => inside.includes(p));
                const r = inside.length >= PAIRS_LEAST ? pearson(inside.map((p) => p.x), inside.map((p) => p.y)) : null;
                selection.textContent = `Selection: ${inside.length} of ${pairs.length} pairs, X ${format(x.invert(x0), unitX)} to ${format(x.invert(x1), unitX)}, Y ${format(y.invert(y1), unitY)} to ${format(y.invert(y0), unitY)}; `
                    + (r ? `Pearson r ${r.r.toFixed(4)} (${pText(r.p)}) over the selection.` : inside.length < PAIRS_LEAST ? `fewer than ${PAIRS_LEAST} pairs, no correlation.` : "the selection does not vary; no correlation.");
            });
            brushLayer.call(b);
        }
        // The projections: the histogram of the paired Y values beside the plot and of the paired X values under it.
        const yBins = histogram(ys, yDomain[0], yDomain[1], PROJECTION_BINS);
        const side = d3.create("svg").attr("viewBox", `0 0 ${projectionWidth} ${HEIGHT}`).attr("width", "100%").attr("height", HEIGHT).attr("role", "img").attr("aria-label", `Projection of ${entryY.name}`).attr("class", "cor-projection cor-projection-y");
        const sideScale = d3.scaleLinear().domain([0, d3.max(yBins, (b) => b.n) || 1]).range([4, projectionWidth - 8]);
        side.selectAll("rect").data(yBins).join("rect").attr("class", "cor-projection-bar").attr("x", 4).attr("y", (b) => y(b.x1)).attr("height", (b) => Math.max(0, y(b.x0) - y(b.x1) - 0.5)).attr("width", (b) => sideScale(b.n) - 4);
        const xBins = histogram(xs, xDomain[0], xDomain[1], PROJECTION_BINS);
        const under = d3.create("svg").attr("viewBox", `0 0 ${mainWidth} ${PROJECTION_HEIGHT}`).attr("width", "100%").attr("height", PROJECTION_HEIGHT).attr("role", "img").attr("aria-label", `Projection of ${entryX.name}`).attr("class", "cor-projection cor-projection-x");
        const underScale = d3.scaleLinear().domain([0, d3.max(xBins, (b) => b.n) || 1]).range([PROJECTION_HEIGHT - 4, 8]);
        under.selectAll("rect").data(xBins).join("rect").attr("class", "cor-projection-bar").attr("x", (b) => x(b.x0)).attr("width", (b) => Math.max(0, x(b.x1) - x(b.x0) - 0.5)).attr("y", (b) => underScale(b.n)).attr("height", (b) => PROJECTION_HEIGHT - 4 - underScale(b.n));
        plots.append(node("div", { class: "cor-grid" }, main, node("div", { class: "cor-side" }, side.node()), node("div", { class: "cor-under" }, under.node()), node("div")));
    }

    /** The two signals over the selected range, one under the other on one time axis. */
    function drawTrends(entryX, entryY, pointsX, pointsY, zone) {
        const width = Math.max(WIDTH_LEAST, Math.floor(trends.clientWidth || 720));
        const range = options.range();
        const xScale = d3.scaleTime().domain([range.from, range.to]).range([MARGIN.left, width - MARGIN.right]);
        const ticks = (width < NARROW_WIDTH ? [0, 1] : width < MEDIUM_WIDTH ? [0, 1 / 2, 1] : [0, 1 / 3, 2 / 3, 1]).map((f) => new Date(+range.from + f * (+range.to - +range.from)));
        for (const [entry, points, role] of [[entryX, pointsX, "X"], [entryY, pointsY, "Y"]]) {
            const unit = entry.egu || "";
            const [low, high] = d3.extent(points, (p) => p.v);
            const pad = (high - low) * 0.06 || 1;
            const y = d3.scaleLinear().domain([low - pad, high + pad]).range([TREND_HEIGHT - 36, MARGIN.top + AXIS_TOP_ROOM]);
            const surface = createPlotCanvas({ width, height: TREND_HEIGHT, margin: { left: MARGIN.left, right: MARGIN.right, top: MARGIN.top, bottom: 36 }, x: xScale, scales: new Map([[unit || role, y]]), units: [unit || role], axisWidth: MARGIN.left, onLeft: 1,
                unitLabels: true, axisLabels: new Map([[unit || role, `${role}: ${nameWithUnit(entry)}`]]), axisLabelAnchor: "start", label: `Trend of ${role}: ${entry.name}`, xFormat: (date) => formatInZone(date, AXIS_TIME_FORMAT, zone), xTicks: ticks, grid: "y", tickCount: 3 });
            surface.marks.append("path").attr("class", `cor-trend cor-trend-${role.toLowerCase()}`).attr("data-count", points.length).attr("d", d3.line().x((p) => xScale(p.t)).y((p) => y(p.v))(points));
            trends.append(surface.svg.node());
        }
        if (derived.points.length) {
            const unit = derived.unit;
            const [low, high] = d3.extent(derived.points, (p) => p.v);
            const pad = (high - low) * 0.06 || 1;
            const y = d3.scaleLinear().domain([low - pad, high + pad]).range([TREND_HEIGHT - 36, MARGIN.top + AXIS_TOP_ROOM]);
            const surface = createPlotCanvas({ width, height: TREND_HEIGHT, margin: { left: MARGIN.left, right: MARGIN.right, top: MARGIN.top, bottom: 36 }, x: xScale, scales: new Map([[unit || "z", y]]), units: [unit || "z"], axisWidth: MARGIN.left, onLeft: 1,
                unitLabels: true, axisLabels: new Map([[unit || "z", `Derived: ${derived.expression}${unit ? ` (${unit})` : ""}`]]), axisLabelAnchor: "start", label: `Trend of the derived signal ${derived.expression}`, xFormat: (date) => formatInZone(date, AXIS_TIME_FORMAT, zone), xTicks: ticks, grid: "y", tickCount: 3 });
            surface.marks.append("path").attr("class", "cor-trend cor-trend-z").attr("data-count", derived.points.length).attr("d", d3.line().x((p) => xScale(p.t)).y((p) => y(p.v))(derived.points));
            trends.append(surface.svg.node());
        }
    }

    return { render, settings, exportables };
}
