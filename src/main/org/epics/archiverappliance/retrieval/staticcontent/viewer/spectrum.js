// The Spectrum tab of the analyzer: the spectrum of one numeric scalar over the selected range, as the one-sided spectrum, a spectrogram
// over time or the autocorrelation. It reads the selected dataset of the page (the stored samples, or the means over N seconds), makes
// them an even series by linear interpolation at an interval that is the median spacing unless one is typed, and shows that preparation
// above the plot: the interval, the gap policy, the window, the removal of the mean, the transform length and the output. Amplitude,
// power and power spectral density are kept apart in their names and units. An input that cannot give a result is refused with its
// reason and shows no plot and no stale number.
import { createPlotCanvas } from "../comm/js/aa/chart.js";
import { node } from "../comm/js/aa/dom.js";
import { infoButton } from "../comm/js/aa/card.js";
import { format } from "../comm/js/aa/chart/text.js";
import { finiteNumber } from "../comm/js/aa/chart/state.js";
import { WINDOWS, nextPowerOfTwo, spectra, spectralPeak, spectrogram, autocorrelation, autocorrelationPeriod, prepareSeries, GAP_FACTOR } from "../comm/js/aa/spectrum.js";
import { formatInZone, zoneName } from "../comm/js/aa/timezone.js";
import { pointsInside } from "./distribution.js";

const d3 = globalThis.d3;

export const SPECTRUM_VIEWS = [["spectrum", "Spectrum"], ["spectrogram", "Spectrogram"], ["autocorrelation", "Autocorrelation"]];
export const OUTPUTS = [["density", "Power spectral density"], ["power", "Power spectrum"], ["amplitude", "Amplitude spectrum"]];
export const GAP_POLICIES = [["refuse", "Refuse a gap"], ["interpolate", "Interpolate across gaps"]];
export const PADDINGS = [["none", "None"], ["power2", "To a power of two"]];
const WINDOW_TEXT = { rectangular: "Rectangular", hann: "Hann", hamming: "Hamming", blackman: "Blackman" };
export const SEGMENTS = [64, 128, 256, 512, 1024, 2048];
export const OVERLAPS = [["0", "None"], ["0.5", "Half"], ["0.75", "Three quarters"]];
// The settings of the tab and their defaults; the address carries the ones that differ (viewer/tool-address.js).
export const SPECTRUM_DEFAULTS = Object.freeze({ signal: null, view: "spectrum", interval: "", gaps: "refuse", window: "hann", output: "power", log: true, padding: "none", segment: "auto", overlap: "0.5" });
// The autocorrelation has a period only when its highest peak after the first fall below zero is at least this high.
const PERIOD_PEAK_LEAST = 0.2;
// The most cells of a spectrogram that are drawn; the frequency rows are merged (the largest of each) to stay below it.
const CELLS_MOST = 20000;
const HEIGHT = 300;
const WIDTH_LEAST = 320;
const MARGIN = { left: 84, right: 24, top: 36, bottom: 60 };
const TIME_FORMAT = "%Y-%m-%d %H:%M:%S";
const AXIS_TIME_FORMAT = "%m-%d %H:%M";
const MEDIUM_WIDTH = 480;

const CARD = [
    "Spectrum: how is the spectrum made, and what do its numbers mean?",
    [
        ["In short", "The frequencies in the samples of one signal over the selected range. The samples are first made an even series by linear interpolation, since a spectrum needs equal spacing; the preparation is written above the plot and nothing is computed from the irregular samples directly."],
        ["Data", "The selected dataset of the page: the stored samples, or means over N seconds, of the selected range, so the numbers do not change when you pan or zoom the Trend. With means the spectrum describes the means, which cannot show a frequency above half of their rate. The sample before the range that the retrieval returns, and values that are not numbers, are left out and counted."],
        ["Interval", "The even interval in seconds is the median spacing of the samples unless you type one. The sampling frequency is its inverse, and the highest frequency shown, the Nyquist frequency, is half of that. A shorter interval than half the median spacing makes points that the interpolation invents; the page says so."],
        ["Gaps", "A spacing of more than 5 intervals is a gap. By default a gap stops the spectrum with the time of the first one, since interpolating across it draws a straight line where nothing was measured; choose to interpolate across gaps to go on, and the page counts the gaps it bridged."],
        ["Window", "The window tapers the series before the transform to reduce leakage, the spread of a frequency over its neighbours. The rectangular window keeps the narrowest peak but leaks most; Hann, Hamming and Blackman leak less and widen the peak. The mean is removed first, so the zero frequency is empty."],
        ["Output", "Power spectral density is the power per hertz in unit squared per hertz and does not depend on the length of the series; the power spectrum is the mean square that a bin carries, in unit squared; the amplitude spectrum is the amplitude in the unit of the signal that a sinusoid at the frequency of the bin would have. Choose power or amplitude to read a peak, density to compare series of different lengths."],
        ["Peak", "The strongest peak above zero frequency, its frequency refined by a parabola through the peak and its two neighbours, and its width at half of the peak power. The frequency resolution is the inverse of the duration; a peak narrower than that is not resolved, and zero padding only interpolates the spectrum between its bins."],
        ["Spectrogram", "The spectrum of overlapping segments of the series, as time against frequency. A shorter segment shows when a frequency changes and a longer one shows the frequency more exactly. A cell is the density of one segment; the colors are on a logarithmic scale. The plot holds at most about 20,000 cells: where more would result, a cell shows the largest value of several neighbouring frequency bins, and the table says how many. Output and zero padding do not apply to the spectrogram."],
        ["Autocorrelation", "How like itself the series is at a lag, from 1 at lag zero. A period is read from it when, after it first falls below zero, it rises again to a peak of at least 0.2; a lower peak is not a period."],
    ],
    null,
];

const unitOf = (output, unit) => (output === "density" ? `${unit || "unit"}²/Hz` : output === "power" ? `${unit || "unit"}²` : unit || "unit");

/** A frequency in hertz: the exponent form below a millihertz, where the decimals would be a row of zeros. */
export function hertz(value) {
    return Math.abs(value) < 1e-3 ? value.toExponential(3) : value.toPrecision(5);
}

// The least distance in pixels between two time labels of the spectrogram: a label is up to 90 pixels wide, the first is written from its
// position to the right and the last from its position to the left, so the two of them need twice that.
const LABEL_DISTANCE = 180;

/** The ticks, in order, that are at least minimum pixels apart, where positionOf gives the pixel of a tick. */
function spaced(ticks, positionOf, minimum) {
    const keep = [];
    for (const tick of ticks) {
        if (!keep.length || positionOf(tick) - positionOf(keep[keep.length - 1]) >= minimum) keep.push(tick);
    }
    return keep;
}

/** The text of a duration in seconds with its largest units, for the numbers of the spectrum. */
export function secondsText(seconds) {
    if (!Number.isFinite(seconds)) return "not defined";
    const abs = Math.abs(seconds);
    if (abs >= 86400) return `${(seconds / 86400).toPrecision(4)} d`;
    if (abs >= 3600) return `${(seconds / 3600).toPrecision(4)} h`;
    if (abs >= 60) return `${(seconds / 60).toPrecision(4)} min`;
    return `${seconds.toPrecision(4)} s`;
}

/** The spectrum view of the page: its controls are built once and its body is drawn again at each render. */
export function createSpectrum(host, options) {
    const settings = { ...SPECTRUM_DEFAULTS, ...(options.settings || {}) };
    // A change of a setting draws the view again and tells the page, which writes the address.
    const changed = () => { render(); if (options.changed) options.changed(); };
    const select = (label, choices, key) => {
        const element = node("select", { "aria-label": label });
        for (const [value, text] of choices) element.append(node("option", { value }, text));
        element.value = settings[key];
        element.addEventListener("change", () => { settings[key] = element.value; changed(); });
        return element;
    };
    const signal = node("select", { "aria-label": "Spectrum signal" });
    signal.addEventListener("change", () => { settings.signal = signal.value; changed(); });
    const view = select("Spectrum view", SPECTRUM_VIEWS, "view");
    const interval = node("input", { type: "text", inputmode: "decimal", size: "8", "aria-label": "Resampling interval in seconds", placeholder: "median spacing" });
    interval.value = settings.interval;
    const error = node("p", { class: "error", role: "alert" });
    interval.addEventListener("change", () => {
        const text = interval.value.trim();
        if (text !== "" && !(finiteNumber(text) > 0)) {
            error.textContent = "Enter a positive number of seconds for the interval, or leave it empty for the median spacing of the samples.";
            interval.value = settings.interval;
            return;
        }
        error.textContent = "";
        settings.interval = text;
        changed();
    });
    const gaps = select("Gap policy", GAP_POLICIES, "gaps");
    const windowSelect = select("Window", WINDOWS.map((name) => [name, WINDOW_TEXT[name]]), "window");
    const output = select("Output", OUTPUTS, "output");
    const log = node("input", { type: "checkbox", "aria-label": "Logarithmic value axis" });
    log.checked = settings.log;
    log.addEventListener("change", () => { settings.log = log.checked; changed(); });
    const padding = select("Zero padding", PADDINGS, "padding");
    const segment = select("Segment length", [["auto", "Automatic"], ...SEGMENTS.map((n) => [String(n), `${n} samples`])], "segment");
    const overlap = select("Segment overlap", OVERLAPS, "overlap");
    const field = (text, control) => node("label", null, text, control);
    const controls = node("div", { class: "spec-controls" }, field("Signal ", signal), field("View ", view), field("Interval (s) ", interval), field("Gaps ", gaps), field("Window ", windowSelect),
        field("Output ", output), node("label", { class: "check-inline" }, log, " Logarithmic axis"), field("Padding ", padding), field("Segment ", segment), field("Overlap ", overlap), infoButton(...CARD, options.helpHref));
    const preparation = node("p", { class: "note spec-preparation" });
    const message = node("p", { class: "note", role: "status" });
    const plot = node("div", { class: "chart spec-plot" });
    const numbers = node("div", { class: "spec-numbers" });
    host.replaceChildren(controls, error, message, preparation, plot, numbers);

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
        numbers.replaceChildren();
        preparation.textContent = "";
        message.textContent = "";
        if (document.activeElement !== interval) interval.value = settings.interval;
        view.value = settings.view;
        segment.disabled = settings.view !== "spectrogram";
        overlap.disabled = settings.view !== "spectrogram";
        output.disabled = settings.view !== "spectrum";
        log.disabled = settings.view !== "spectrum";
        padding.disabled = settings.view !== "spectrum";
        windowSelect.disabled = settings.view === "autocorrelation";
        if (!list.length) {
            message.textContent = "Select archived signals to see their spectrum.";
            return;
        }
        const entry = list.find((item) => item.name === settings.signal);
        const dataset = entry.dataset;
        if (!dataset) {
            message.textContent = entry.failure ? `The samples of this signal could not be read: ${entry.failure}` : "Loading samples...";
            return;
        }
        const points = pointsInside(dataset);
        if (!points.length) {
            message.textContent = dataset.form === "No samples" ? "The selected range holds no samples of this signal." : "This signal has no numeric scalar samples in the selected range; the spectrum reads numeric scalars only.";
            return;
        }
        const typed = settings.interval === "" ? null : finiteNumber(settings.interval);
        const prepared = prepareSeries(points.map((p) => p.t / 1000), points.map((p) => p.v), { interval: typed, gaps: settings.gaps });
        if (!prepared.ok) {
            const firstGap = prepared.gaps && prepared.gaps.length ? prepared.gaps[0] : null;
            message.textContent = firstGap
                ? `${prepared.reason} The first gap lies between ${formatInZone(new Date(firstGap.from * 1000), TIME_FORMAT, options.zone())} and ${formatInZone(new Date(firstGap.to * 1000), TIME_FORMAT, options.zone())}.`
                : prepared.reason;
            return;
        }
        const excluded = dataset.records.length - points.length;
        const zone = options.zone();
        const nfft = settings.padding === "power2" ? nextPowerOfTwo(prepared.count) : prepared.count;
        const unit = entry.egu || "";
        const outputText = OUTPUTS.find(([value]) => value === settings.output)[1];
        const sourceText = options.sourceText(dataset.seconds);
        preparation.textContent = `Data preparation: the ${points.length} samples (${sourceText}) of the selected range, resampled by linear interpolation to an even interval of ${secondsText(prepared.interval)}`
            + `${prepared.defaulted ? " (the median spacing)" : " (typed)"}: ${prepared.count} points at ${(prepared.rate).toPrecision(4)} Hz over ${secondsText(prepared.duration)}. `
            + `Gaps: ${prepared.gaps.length ? `${prepared.gaps.length} bridged by interpolation` : "none"}. Mean removed. `
            + (settings.view === "autocorrelation" ? "Output: the autocorrelation, no unit." : (settings.view === "spectrogram" ? `Window: ${WINDOW_TEXT[settings.window]}. Transform: one per overlapping segment (length and overlap in the table). Output: power spectral density of each segment, ${unitOf("density", unit)}.` : `Window: ${WINDOW_TEXT[settings.window]}. Transform: ${nfft} points${nfft > prepared.count ? " (zero padded)" : ""}. Output: ${outputText.toLowerCase()}, ${unitOf(settings.output, unit)}.`))
            + `${dataset.seconds === "raw" ? "" : " The samples are means, so the spectrum describes the means."}`;
        const notes = [];
        if (prepared.oversampled) notes.push(`The interval is shorter than half of the median spacing (${secondsText(prepared.median)}): the points between samples are made by the interpolation, and the spectrum above ${hertz(1 / (2 * prepared.median))} Hz, half of the sampling frequency of the samples, shows nothing that was measured.`);
        if (prepared.gaps.length) notes.push(`${prepared.gaps.length} gap${prepared.gaps.length > 1 ? "s" : ""} of more than ${GAP_FACTOR} intervals bridged by a straight line, the longest ${secondsText(prepared.gaps.reduce((longest, g) => Math.max(longest, g.length), 0))}; the lines are not measured values.`);
        const drawn = { spectrum: drawSpectrum, spectrogram: drawSpectrogram, autocorrelation: drawAutocorrelation }[settings.view];
        const facts = drawn(entry, prepared, nfft, zone, notes);
        if (!facts) return;
        const rows = [
            ...facts,
            ["Effective sample rate", `${prepared.rate.toPrecision(5)} Hz (interval ${secondsText(prepared.interval)}; the Nyquist frequency is ${(prepared.rate / 2).toPrecision(5)} Hz)`],
            ["Usable duration", `${secondsText(prepared.duration)} (${prepared.count} points)`],
            ["Frequency resolution", `${hertz(1 / prepared.duration)} Hz, the inverse of the duration${nfft > prepared.count ? `; the bins are ${hertz(prepared.rate / nfft)} Hz apart because of zero padding` : ""}`],
            ["Left out", `${excluded} record${excluded === 1 ? "" : "s"} outside the range or not numeric; ${prepared.gaps.length} gap${prepared.gaps.length === 1 ? "" : "s"} bridged`],
        ];
        numbers.append(node("table", { class: "chart-stats spec-table", "aria-label": "The numbers of the spectrum" }, node("tbody", null, ...rows.map(([name, value]) => node("tr", { "data-row": name }, node("th", { scope: "row" }, name), node("td", null, value))))));
        for (const text of notes) numbers.append(node("p", { class: "note spec-note" }, text));
    }

    /** The canvas of a view: the axes, the clip and the surface for the marks. */
    function canvasIn(input) {
        const width = Math.max(WIDTH_LEAST, Math.floor(plot.clientWidth || 720));
        const x = input.xScale.range([MARGIN.left, width - MARGIN.right]);
        const y = input.yScale.range([HEIGHT - MARGIN.bottom, MARGIN.top]);
        const surface = createPlotCanvas({
            width, height: HEIGHT, margin: MARGIN, x, scales: new Map([[input.yUnit, y]]), units: [input.yUnit], axisWidth: MARGIN.left, onLeft: 1,
            unitLabels: true, axisLabels: new Map([[input.yUnit, input.yLabel]]), axisLabelAnchor: "start", xLabel: input.xLabel, xTickY: HEIGHT - 30, label: input.label,
            xFormat: input.xFormat, xTicks: input.xTicks || x.ticks(width < MEDIUM_WIDTH ? 3 : 6), tickFormats: input.tickFormats, grid: "y", tickCount: 5,
        });
        plot.append(surface.svg.node());
        return { surface, x, y };
    }

    function drawSpectrum(entry, prepared, nfft, zone, notes) {
        const s = spectra(prepared.values, prepared.rate, settings.window, nfft);
        const series = s[settings.output];
        const peak = spectralPeak(s.frequencies, s.power);
        if (!peak) { message.textContent = "The spectrum has fewer than 3 bins; choose a longer range."; return null; }
        const unit = entry.egu || "";
        const label = unitOf(settings.output, unit);
        let top = 0;
        let bottom = Infinity;
        for (let k = 1; k < series.length; k += 1) { if (series[k] > top) top = series[k]; if (series[k] > 0 && series[k] < bottom) bottom = series[k]; }
        const logScale = settings.log && top > 0 && bottom < Infinity;
        const yScale = logScale ? d3.scaleLog().domain([Math.max(bottom, top * 1e-12), top * 1.6]) : d3.scaleLinear().domain([0, top * 1.08 || 1]);
        const nyquist = prepared.rate / 2;
        const { surface, x, y } = canvasIn({ xScale: d3.scaleLinear().domain([0, nyquist]), yScale, yUnit: label, yLabel: `${OUTPUTS.find(([value]) => value === settings.output)[1]} / ${label}`,
            xLabel: "Frequency / Hz", label: `Spectrum of ${entry.name}`, xFormat: d3.format(".4~g") });
        const floor = y.domain()[0];
        const line = d3.line().x((_, k) => x(s.frequencies[k + 1])).y((value) => y(Math.max(value, floor)));
        surface.marks.append("path").attr("class", "spec-line").attr("data-bins", series.length - 1).attr("data-output", settings.output).attr("d", line(Array.from(series).slice(1)));
        surface.marks.append("line").attr("class", "spec-peak-line").attr("x1", x(peak.frequency)).attr("x2", x(peak.frequency)).attr("y1", MARGIN.top).attr("y2", HEIGHT - MARGIN.bottom);
        surface.marks.append("circle").attr("class", "spec-peak").attr("data-frequency", peak.frequency).attr("data-bin", peak.index).attr("data-width", peak.width ?? "").attr("r", 4)
            .attr("cx", x(peak.frequency)).attr("cy", y(Math.max(series[peak.index], floor)));
        const search = d3.bisector((f) => f).center;
        surface.bindHover(plot, ({ x: at }) => {
            const k = Math.max(1, Math.min(series.length - 1, search(s.frequencies, +at)));
            return { title: `${s.frequencies[k].toPrecision(5)} Hz (period ${secondsText(1 / s.frequencies[k])})`, rows: [`${OUTPUTS.find(([value]) => value === settings.output)[1]}: ${series[k].toPrecision(5)} ${label}`], px: x(s.frequencies[k]), py: y(Math.max(series[k], floor)) };
        });
        if (settings.window === "rectangular") notes.push("The rectangular window leaks: a frequency that does not fall on a bin spreads over its neighbours, and a strong peak can hide a weak one beside it. A Hann window leaks much less.");
        const peakValue = series[peak.index];
        return [
            ["Peak frequency", `${peak.frequency.toPrecision(6)} Hz (the bin at ${peak.binFrequency.toPrecision(6)} Hz; refined by a parabola through the bin and its neighbours)`],
            ["Peak period", `${secondsText(1 / peak.frequency)}`],
            ["Peak width", peak.width === null ? "not defined: the spectrum does not fall to half of the peak power on both sides" : `${hertz(peak.width)} Hz at half of the peak power`],
            ["Peak value", `${peakValue.toPrecision(5)} ${label} (${OUTPUTS.find(([value]) => value === settings.output)[1].toLowerCase()} at the bin)`],
        ];
    }

    function drawSpectrogram(entry, prepared, nfft, zone, notes) {
        const n = prepared.count;
        const overlapShare = Number(settings.overlap);
        const fits = (size) => Math.floor((n - Math.round(size * overlapShare)) / (size - Math.round(size * overlapShare))) >= 2 && n >= size;
        let size;
        if (settings.segment === "auto") {
            size = [...SEGMENTS].reverse().find((candidate) => candidate <= n / 8 && fits(candidate)) ?? SEGMENTS.find(fits);
        } else {
            size = Number(settings.segment);
        }
        if (!size || !fits(size)) {
            message.textContent = `At ${size ?? SEGMENTS[0]} samples the segment does not fit twice into the ${n} points with the overlap chosen; choose a shorter segment, a smaller overlap or a longer range.`;
            return null;
        }
        const overlapSamples = Math.round(size * overlapShare);
        const leftover = n - ((Math.floor((n - overlapSamples) / (size - overlapSamples)) - 1) * (size - overlapSamples) + size);
        const g = spectrogram(prepared.values, prepared.rate, settings.window, size, overlapSamples);
        const columns = g.times.length;
        const bins = g.frequencies.length - 1;
        const group = Math.max(1, Math.ceil((bins * columns) / CELLS_MOST));
        const rows = Math.ceil(bins / group);
        const power = (c, r) => { let best = 0; for (let k = r * group + 1; k <= Math.min(bins, (r + 1) * group); k += 1) best = Math.max(best, g.power[c][k]); return best; };
        let top = 0;
        for (let c = 0; c < columns; c += 1) for (let r = 0; r < rows; r += 1) top = Math.max(top, power(c, r));
        const start = prepared.start * 1000;
        const x = d3.scaleTime().domain([new Date(start), new Date(start + prepared.duration * 1000)]);
        const nyquist = prepared.rate / 2;
        const label = `Frequency / Hz`;
        const { surface, x: xs, y } = canvasIn({ xScale: x, yScale: d3.scaleLinear().domain([0, nyquist]), yUnit: "Hz", yLabel: label, xLabel: `Time, ${zoneName(zone, new Date(start))}`, label: `Spectrogram of ${entry.name}`,
            xFormat: (date) => formatInZone(date, AXIS_TIME_FORMAT, zone),
            xTicks: spaced(x.ticks(12), (tick) => ((+tick - start) / (prepared.duration * 1000)) * (Math.max(WIDTH_LEAST, plot.clientWidth || 720) - MARGIN.left - MARGIN.right), LABEL_DISTANCE) });
        const color = d3.scaleSequential(d3.interpolateViridis).domain([Math.log10(top) - 8, Math.log10(top)]);
        const step = (size - overlapSamples) / prepared.rate;
        const cellWidth = Math.max(1, xs(new Date(start + step * 1000)) - xs(new Date(start)));
        const cells = [];
        for (let c = 0; c < columns; c += 1) {
            for (let r = 0; r < rows; r += 1) cells.push({ c, r, value: power(c, r) });
        }
        const binWidth = prepared.rate / size;
        const bandOf = (r) => [(r * group + 0.5) * binWidth, (Math.min(bins, (r + 1) * group) + 0.5) * binWidth];
        const rowTop = (r) => y(Math.min(bandOf(r)[1], nyquist));
        const rowBottom = (r) => y(bandOf(r)[0]);
        surface.marks.selectAll("rect").data(cells).join("rect").attr("class", "spec-cell").attr("data-column", (d) => d.c).attr("data-row", (d) => d.r)
            .attr("fill", (d) => color(Math.log10(Math.max(d.value, top * 1e-8)))).attr("x", (d) => xs(new Date(start + (g.times[d.c] - step / 2) * 1000)))
            .attr("width", cellWidth + 0.5).attr("y", (d) => rowTop(d.r)).attr("height", (d) => rowBottom(d.r) - rowTop(d.r) + 0.5);
        const search = d3.bisector((t) => t).center;
        surface.bindHover(plot, ({ x: at, py }) => {
            const c = Math.max(0, Math.min(columns - 1, search(g.times, (+at - start) / 1000)));
            const k = Math.max(1, Math.min(bins, Math.round(y.invert(py) / binWidth)));
            const r = Math.floor((k - 1) / group);
            const [low, high] = bandOf(r);
            return { title: formatInZone(new Date(start + g.times[c] * 1000), TIME_FORMAT, zone), rows: [`Frequency: ${low.toPrecision(4)} to ${high.toPrecision(4)} Hz`, `Density: ${power(c, r).toPrecision(4)} ${unitOf("density", entry.egu)}`],
                px: xs(new Date(start + g.times[c] * 1000)), py: (rowTop(r) + rowBottom(r)) / 2 };
        });
        let bright = cells[0];
        for (const cell of cells) if (cell.value > bright.value) bright = cell;
        const [lowBand, highBand] = bandOf(bright.r);
        notes.push(`Each column is the density of one segment of ${size} samples (${secondsText(size / prepared.rate)}) at the overlap chosen; the frequency resolution of a segment is ${hertz(prepared.rate / size)} Hz, not that of the whole range.${leftover > 0 ? ` The last ${leftover} samples do not fill a segment and are not drawn.` : ""} The colors are logarithmic, over eight decades below the largest cell.`);
        return [
            ["Segments", `${columns} of ${size} samples, ${overlapSamples} overlapping; ${rows} frequency rows${group > 1 ? ` (each the largest of ${group} bins)` : ""}`],
            ["Brightest cell", `${lowBand.toPrecision(5)} to ${highBand.toPrecision(5)} Hz, segment ${bright.c + 1}, centred at ${formatInZone(new Date(start + g.times[bright.c] * 1000), TIME_FORMAT, zone)}, density ${bright.value.toPrecision(5)} ${unitOf("density", entry.egu)}`],
        ];
    }

    function drawAutocorrelation(entry, prepared, nfft, zone, notes) {
        const lags = Math.min(prepared.count - 1, Math.floor(prepared.count / 2));
        const r = autocorrelation(prepared.values, lags);
        if (!r) { message.textContent = "The autocorrelation is not defined for this series."; return null; }
        const found = autocorrelationPeriod(r, PERIOD_PEAK_LEAST);
        const { surface, x, y } = canvasIn({ xScale: d3.scaleLinear().domain([0, lags * prepared.interval]), yScale: d3.scaleLinear().domain([Math.min(-0.2, d3.min(r) * 1.1), 1.05]),
            yUnit: "", yLabel: "Autocorrelation", xLabel: "Lag / s", label: `Autocorrelation of ${entry.name}`, xFormat: d3.format(".4~g"), tickFormats: new Map([["", d3.format(".2f")]]) });
        surface.marks.append("line").attr("class", "spec-zero").attr("x1", x(0)).attr("x2", x(lags * prepared.interval)).attr("y1", y(0)).attr("y2", y(0));
        surface.marks.append("path").attr("class", "spec-line spec-acf").attr("data-lags", r.length).attr("d", d3.line().x((_, k) => x(k * prepared.interval)).y((v) => y(v))(Array.from(r)));
        if (found) {
            surface.marks.append("line").attr("class", "spec-peak-line").attr("x1", x(found.lag * prepared.interval)).attr("x2", x(found.lag * prepared.interval)).attr("y1", MARGIN.top).attr("y2", HEIGHT - MARGIN.bottom);
            surface.marks.append("circle").attr("class", "spec-peak").attr("data-lag", found.lag).attr("data-value", found.value).attr("r", 4).attr("cx", x(found.lag * prepared.interval)).attr("cy", y(found.value));
        }
        surface.bindHover(plot, ({ x: at }) => {
            const k = Math.max(0, Math.min(r.length - 1, Math.round(+at / prepared.interval)));
            return { title: `Lag ${secondsText(k * prepared.interval)} (${k} samples)`, rows: [`Autocorrelation: ${r[k].toFixed(4)}`], px: x(k * prepared.interval), py: y(r[k]) };
        });
        return [
            ["Period", found ? `${secondsText(found.lag * prepared.interval)} (${found.lag} samples; the autocorrelation there is ${found.value.toFixed(3)})` : `none: after it first falls below zero the autocorrelation does not rise again to ${PERIOD_PEAK_LEAST}, or it does not fall below zero within ${secondsText(lags * prepared.interval)}`],
            ["Lags shown", `0 to ${secondsText(lags * prepared.interval)} (${lags} samples, half of the series)`],
        ];
    }

    return { render, settings };
}
