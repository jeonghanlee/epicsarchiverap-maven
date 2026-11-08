// The Trend additions of the analyzer for one signal: the rate of change between successive samples, a slow trend (a linear fit
// against time), the limits of the PV as lines with the time spent beyond each, and a threshold typed by the user with the time
// beyond it. Everything reads the displayed dataset of the signal inside the displayed window, so it follows a pan or a zoom. The
// lines are drawn over the trend chart through its overlay; the numbers and the rate plot are under the chart. An input that
// cannot give a result is refused with its reason and shows no line, no plot and no stale number.
import { createPlotCanvas } from "../comm/js/aa/chart.js";
import { node } from "../comm/js/aa/dom.js";
import { infoButton } from "../comm/js/aa/card.js";
import { format } from "../comm/js/aa/chart/text.js";
import { finiteNumber } from "../comm/js/aa/chart/state.js";
import { rateOfChange, linearFit, fitValueAt, timeBeyond, limitsOf } from "../comm/js/aa/trend.js";
import { formatInZone, zoneName } from "../comm/js/aa/timezone.js";

const d3 = globalThis.d3;

const METADATA = "../../bpl/getMetadata";
const HEIGHT = 240;
const WIDTH_LEAST = 320;
const MARGIN = { left: 72, right: 24, top: 36, bottom: 40 };
// A time label is about 80 pixels wide: a plot under 360 pixels has two time labels, under 480 three and a wider one four, so that
// the labels do not overlap.
const NARROW_WIDTH = 360;
const MEDIUM_WIDTH = 480;
const TIME_FORMAT = "%Y-%m-%d %H:%M:%S";
const AXIS_TIME_FORMAT = "%m-%d %H:%M";
const SIDES = [["above", "above"], ["below", "below"]];
const HOUR_SECONDS = 3600;
const DAY_SECONDS = 86400;

const CARD = [
    "Trend tools: what do the lines and the numbers use?",
    [
        ["In short", "They read the samples of one signal that the Trend draws now, inside the displayed window; they change when you pan or zoom, and they are not a forecast."],
        ["Rate of change", "The change of the value per second between each two successive samples, plotted at the time of the later one. It is large where the samples are close and the value jumps; the means of a long interval give a smoothed rate."],
        ["Slow trend", "The least-squares line of the values against time over the samples in the window. The slope is given per hour and per day with its standard error, and r squared says how much of the variation in the values the line explains (it is not defined when the values do not vary). A signal with a daily cycle can show a slope that depends on where the window starts."],
        ["Limits", "The alarm and warning limits and the display range that the archiver reports for the PV (HIHI, HIGH, LOW, LOLO, LOPR and HOPR); a limit that is not set is not drawn, and a display range of 0 and 0 counts as not set. A PV with none of them says so. If the limits could not be read, switch Limits off and on to ask again."],
        ["Dataset", "The samples the Trend draws now. With the automatic interval they are means over N seconds: a value that stays beyond a level for less than N seconds is not seen in them, and an interval whose mean is beyond the level counts whole, so a time beyond a level can read lower or higher than the stored samples give. Choose Raw samples under Options, Interval, to count the stored samples. The page names the dataset above the numbers."],
        ["Time beyond", "The time the signal holds a value above or below a level, counted as the chart draws it: each sample holds until the next one. The time before the first sample and after the last one in the window is not known and is left out; a value equal to the level is not beyond it. The share is the time beyond over the observed time."],
        ["Threshold", "A level that you type, in the unit of the signal, with the side to count. It applies when you press Enter or leave the field; a value that is not a finite number is refused with its reason and the last valid value stays, and an empty field means none. Text you have typed and not yet entered stays while the page draws again."],
        ["Hidden signals", "A signal hidden in the legend of the Trend shows no tool lines and no numbers; show it again to see them."],
    ],
    null,
];

/** The text of a duration in milliseconds as days, hours, minutes and seconds, the two largest units that are not zero. */
export function durationText(ms) {
    const seconds = Math.round(ms / 1000);
    if (seconds <= 0) return "0 s";
    const parts = [[Math.floor(seconds / DAY_SECONDS), "d"], [Math.floor((seconds % DAY_SECONDS) / HOUR_SECONDS), "h"], [Math.floor((seconds % HOUR_SECONDS) / 60), "min"], [seconds % 60, "s"]]
        .filter(([count]) => count > 0);
    return parts.slice(0, 2).map(([count, unit]) => `${count} ${unit}`).join(" ");
}

/** The trend tools of the page: the controls are built once; the body and the lines follow each render. */
export function createTrendTools(host, options) {
    const settings = { signal: null, rate: false, fit: false, limits: false, threshold: "", side: "above" };
    // What the last render computed: the lines for the overlay and the unit they belong to.
    let drawing = { name: null, unit: null, lines: [], fit: null };
    // The metadata of the retrieval by PV name: {limits} or {failure}; a PV whose request is out is not asked again.
    const metadata = new Map();
    const check = (label, key, before) => {
        const box = node("input", { type: "checkbox", "aria-label": label });
        box.addEventListener("change", () => { settings[key] = box.checked; if (before) before(box.checked); options.onChange(); });
        return box;
    };
    const signal = node("select", { "aria-label": "Trend tools signal" });
    signal.addEventListener("change", () => { settings.signal = signal.value; options.onChange(); });
    const rate = check("Rate of change", "rate");
    const fit = check("Slow trend", "fit");
    // A request that failed is asked again when the limits are switched on again.
    const limits = check("Limits", "limits", (on) => {
        if (on) for (const [name, found] of [...metadata]) if (found.failure) metadata.delete(name);
    });
    const threshold = node("input", { type: "text", inputmode: "decimal", size: "8", "aria-label": "Threshold value", placeholder: "none" });
    const side = node("select", { "aria-label": "Threshold side" });
    for (const [value, text] of SIDES) side.append(node("option", { value }, text));
    const error = node("p", { class: "error", role: "alert" });
    threshold.addEventListener("change", () => {
        const text = threshold.value.trim();
        if (text !== "" && finiteNumber(text) === null) {
            error.textContent = "Enter a finite number for the threshold, or leave it empty for none.";
            threshold.value = settings.threshold;
            return;
        }
        error.textContent = "";
        settings.threshold = text;
        options.onChange();
    });
    side.addEventListener("change", () => { settings.side = side.value; options.onChange(); });
    const field = (text, control) => node("label", null, text, control);
    const controls = node("div", { class: "trend-tools-controls" },
        field("Signal ", signal),
        node("label", { class: "check-inline" }, rate, " Rate of change"),
        node("label", { class: "check-inline" }, fit, " Slow trend"),
        node("label", { class: "check-inline" }, limits, " Limits"),
        field("Threshold ", threshold), field("Beyond ", side), infoButton(...CARD, options.helpHref));
    const message = node("p", { class: "note", role: "status" });
    const numbers = node("div", { class: "trend-numbers" });
    const ratePlot = node("div", { class: "chart trend-rate-plot" });
    host.replaceChildren(node("h3", { class: "trend-tools-title" }, "Trend tools"), controls, error, message, numbers, ratePlot);

    function syncSignals(list) {
        const names = list.map((entry) => entry.name);
        if (names.join("\n") !== [...signal.options].map((option) => option.value).join("\n")) {
            signal.replaceChildren(...list.map((entry) => node("option", { value: entry.name }, entry.name)));
        }
        if (!names.includes(settings.signal)) settings.signal = names[0] ?? null;
        if (settings.signal !== null) signal.value = settings.signal;
    }

    /** Asks the retrieval for the metadata of a PV once; the limits arrive after the page has drawn, and it draws again. */
    function requestLimits(name) {
        if (metadata.has(name)) return;
        metadata.set(name, { pending: true });
        fetch(`${METADATA}?${new URLSearchParams({ pv: name })}`)
            .then((response) => {
                if (!response.ok) throw new Error(`${response.statusText || "Request failed"} (HTTP ${response.status})`);
                return response.json();
            })
            .then((body) => metadata.set(name, { limits: limitsOf(body) }))
            .catch((problem) => metadata.set(name, { failure: String(problem.message || problem) }))
            .then(() => options.onChange());
    }

    function render() {
        drawing = { name: null, unit: null, lines: [], fit: null };
        numbers.replaceChildren();
        ratePlot.replaceChildren();
        const list = options.signals();
        syncSignals(list);
        for (const [box, key] of [[rate, "rate"], [fit, "fit"], [limits, "limits"]]) box.checked = settings[key];
        // Text typed in the threshold field and not yet entered stays while the page draws again.
        if (document.activeElement !== threshold) threshold.value = settings.threshold;
        side.value = settings.side;
        if (!list.length) {
            message.textContent = "Select archived signals to use the trend tools.";
            return;
        }
        if (!settings.rate && !settings.fit && !settings.limits && settings.threshold === "") {
            message.textContent = "Choose a rate of change, a slow trend, the limits or a threshold.";
            return;
        }
        const entry = list.find((item) => item.name === settings.signal);
        if (entry.hidden) {
            message.textContent = "This signal is hidden in the legend. Show it to see its lines and numbers.";
            return;
        }
        const dataset = entry.dataset;
        if (!dataset) {
            message.textContent = entry.failure ? `The samples of this signal could not be read: ${entry.failure}` : "Loading samples...";
            return;
        }
        if (!dataset.points.length) {
            message.textContent = dataset.form === "No samples" ? "The displayed window holds no samples of this signal." : "This signal has no numeric scalar samples in the displayed window; the trend tools read numeric scalars only.";
            return;
        }
        const { from, to } = options.window();
        const points = dataset.points.filter((p) => p.t >= +from && p.t <= +to);
        if (!points.length) {
            message.textContent = "The displayed window holds no samples of this signal.";
            return;
        }
        message.textContent = "";
        const unit = entry.egu || "";
        const zone = options.zone();
        const notes = [];
        const lines = [];
        // The dataset the numbers describe. Means hide an excursion shorter than their interval, which a limit needs to see.
        const raw = dataset.seconds === "raw";
        numbers.append(node("p", { class: "note trend-dataset" }, `Dataset: the ${points.length} samples (${options.sourceText(dataset.seconds)}) of the displayed window.`
            + (raw ? "" : ` These are means, not the stored samples: a value that stays beyond a level for less than ${dataset.seconds} s is not seen, and an interval whose mean is beyond a level counts whole, so a time beyond a level can read lower or higher than it was. Choose Raw samples under Options, Interval, to count the stored samples.`)));
        let fitted = null;
        if (settings.fit) {
            fitted = linearFit(points);
            if (!fitted) {
                notes.push(`A slow trend needs at least 3 samples at different times; the window holds ${points.length}.`);
            } else {
                const perHour = fitted.slope * HOUR_SECONDS;
                const perDay = fitted.slope * DAY_SECONDS;
                const error = fitted.slopeError;
                notes.push(`Slow trend of ${entry.name}: ${format(perHour, `${unit}/h`)} (${format(perDay, `${unit}/day`)}), standard error ${format(error * HOUR_SECONDS, `${unit}/h`)}, ${fitted.rSquared === null ? "r squared not defined (the values do not vary)" : `r squared ${fitted.rSquared.toFixed(4)}`}, from ${fitted.n} samples.`);
            }
        }
        const table = [];
        const addRow = (name, field, value, side) => {
            const result = timeBeyond(dataset.points, value, side, +from, +to);
            table.push({ name, field, value, side, result });
            lines.push({ kind: field === "threshold" ? "threshold" : field === "LOPR" || field === "HOPR" ? "display" : field === "HIHI" || field === "LOLO" ? "alarm" : "warning", name, field, value });
        };
        if (settings.limits) {
            requestLimits(entry.name);
            const found = metadata.get(entry.name);
            if (!found || found.pending) {
                notes.push("Reading the limits of this PV...");
            } else if (found.failure) {
                notes.push(`The limits of this PV could not be read: ${found.failure}. Switch Limits off and on to ask again.`);
            } else if (!found.limits.length) {
                notes.push("This PV has no limits set: none of its alarm and warning limits is a number, and its display range is not set.");
            } else {
                for (const limit of found.limits) addRow(limit.name, limit.field, limit.value, limit.side);
            }
        }
        if (settings.threshold !== "") {
            addRow("Threshold", "threshold", finiteNumber(settings.threshold), settings.side);
        }
        if (table.length) {
            const observed = table[0].result.observed;
            numbers.append(node("table", { class: "chart-stats trend-table", "aria-label": "Time beyond the limits and the threshold" },
                node("thead", null, node("tr", null, ...["Level", "Field", "Value", "Beyond", "Time beyond", "Share of observed time"].map((text) => node("th", { scope: "col" }, text)))),
                node("tbody", null, ...table.map((row) => node("tr", { "data-field": row.field },
                    node("th", { scope: "row" }, row.name), node("td", null, row.field === "threshold" ? "typed" : row.field), node("td", { class: "num" }, format(row.value, unit)),
                    node("td", null, row.side), node("td", { class: "num" }, durationText(row.result.beyond)),
                    node("td", { class: "num" }, row.result.fraction === null ? "no observed time" : `${(100 * row.result.fraction).toFixed(2)} %`))))));
            notes.push(`Observed time: ${durationText(observed)} of the displayed window, from the first to the last sample in it, each sample held until the next. `
                + `Window ${formatInZone(from, TIME_FORMAT, zone)} to ${formatInZone(to, TIME_FORMAT, zone)} ${zoneName(zone, to)}.`);
        }
        for (const text of notes) numbers.append(node("p", { class: "note trend-note" }, text));
        drawing = { name: entry.name, unit, lines, fit: fitted ? { fit: fitted, first: points[0].t, last: points[points.length - 1].t } : null };
        if (settings.rate) drawRate(entry, points, from, to, zone);
    }

    function drawRate(entry, points, from, to, zone) {
        const rates = rateOfChange(points);
        if (!rates.length) {
            ratePlot.append(node("p", { class: "note" }, `A rate of change needs at least 2 samples at different times; the window holds ${points.length}.`));
            return;
        }
        const unit = `${entry.egu || ""}/s`;
        const width = Math.max(WIDTH_LEAST, Math.floor(ratePlot.clientWidth || 720));
        const x = d3.scaleTime().domain([from, to]).range([MARGIN.left, width - MARGIN.right]);
        const [low, high] = d3.extent([...rates.map((r) => r.v), 0]);
        const pad = (high - low) * 0.08 || 1;
        const y = d3.scaleLinear().domain([low - pad, high + pad]).range([HEIGHT - MARGIN.bottom, MARGIN.top]);
        const surface = createPlotCanvas({
            width, height: HEIGHT, margin: MARGIN, x, scales: new Map([[unit, y]]), units: [unit], axisWidth: MARGIN.left, onLeft: 1,
            unitLabels: true, axisLabels: new Map([[unit, `Rate of change / ${unit}`]]), axisLabelAnchor: "start",
            label: `Rate of change of ${entry.name}`, xFormat: (date) => formatInZone(date, AXIS_TIME_FORMAT, zone),
            xTicks: (width < NARROW_WIDTH ? [0, 1] : width < MEDIUM_WIDTH ? [0, 1 / 2, 1] : [0, 1 / 3, 2 / 3, 1]).map((fraction) => new Date(+from + fraction * (+to - +from))), grid: "y", tickCount: 5,
        });
        ratePlot.append(surface.svg.node());
        surface.marks.append("line").attr("class", "trend-zero").attr("x1", x(from)).attr("x2", x(to)).attr("y1", y(0)).attr("y2", y(0));
        const line = d3.line().x((r) => x(r.t)).y((r) => y(r.v));
        surface.marks.append("path").attr("class", "trend-rate").attr("d", line(rates)).attr("data-count", rates.length)
            .attr("data-min", d3.min(rates, (r) => r.v)).attr("data-max", d3.max(rates, (r) => r.v));
        const search = d3.bisector((r) => r.t).center;
        surface.bindHover(ratePlot, ({ x: at }) => {
            const r = rates[search(rates, +at)];
            return { title: formatInZone(new Date(r.t), TIME_FORMAT, zone), rows: [`Rate of change: ${format(r.v, unit)}`], px: x(r.t), py: y(r.v) };
        });
        ratePlot.append(node("p", { class: "note" }, `Rate of change of ${entry.name}: the change of the value per second between successive samples, ${rates.length} rates from ${points.length} samples.`));
    }

    /** Draws the fit, the limits and the threshold over the trend chart, on the canvas whose axes have the unit of the signal. */
    function overlay(canvas) {
        const { marks, x, scales } = canvas;
        const y = scales.get(drawing.unit);
        if (drawing.unit === null || !y || options.isHidden(drawing.name)) return;
        const [left, right] = x.range();
        for (const line of drawing.lines) {
            const py = y(line.value);
            if (!Number.isFinite(py)) continue;
            marks.append("line").attr("class", `trend-level trend-${line.kind}`).attr("data-field", line.field).attr("data-value", line.value)
                .attr("x1", left).attr("x2", right).attr("y1", py).attr("y2", py);
            marks.append("text").attr("class", "trend-level-label").attr("x", left + 4).attr("y", py - 3).text(`${line.name} ${format(line.value, "")}`);
        }
        if (drawing.fit) {
            const { fit: f, first, last } = drawing.fit;
            marks.append("line").attr("class", "trend-fit").attr("data-slope", f.slope).attr("data-intercept", f.intercept)
                .attr("x1", x(new Date(first))).attr("x2", x(new Date(last))).attr("y1", y(fitValueAt(f, first))).attr("y2", y(fitValueAt(f, last)));
        }
    }

    return { render, overlay, settings };
}
