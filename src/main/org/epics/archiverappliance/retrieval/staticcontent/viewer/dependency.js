// The Dependency tab of the analyzer: three to twenty numeric signals averaged over one common interval, aligned on the
// intervals every signal has (aa/alignment.js), shown as a correlation matrix ordered by hierarchical clustering with its
// dendrogram, a ranking of the signals by their mutual information with a chosen target, a scatter plot matrix, the partial
// correlation, a multiple regression of the target on the others and a principal component analysis. The common interval, the
// alignment, the coverage of each signal and the number of intervals dropped are written with every result; an input that cannot
// give a result is refused with its reason and shows no stale number. A cell of a matrix opens the Correlation tab with the
// same range and the two signals of the cell. The ranking is statistical association, never causation.
import { createPlotCanvas } from "../comm/js/aa/chart.js";
import { node } from "../comm/js/aa/dom.js";
import { infoButton } from "../comm/js/aa/card.js";
import { alignOnTimes } from "../comm/js/aa/alignment.js";
import { pearson, spearman, correlationMatrix, partialCorrelation } from "../comm/js/aa/correlation.js";
import { mutualInformation, averageLinkage, correlationDistances, principalComponents, multipleRegression, conditionNumber, collinearPairs } from "../comm/js/aa/dependency.js";
import { formatInZone } from "../comm/js/aa/timezone.js";
import { pointsInside } from "./distribution.js";

const d3 = globalThis.d3;

export const DEPENDENCY_VIEWS = [["matrix", "Correlation matrix"], ["mutual", "Mutual information matrix"], ["ranking", "Ranking by mutual information"], ["scatter", "Scatter plot matrix"], ["partial", "Partial correlation"], ["regression", "Multiple regression"], ["pca", "Principal components"]];
export const DEPENDENCY_INTERVALS = [["auto", "Same as the page"], ["10", "10 s"], ["60", "1 min"], ["600", "10 min"], ["3600", "1 h"], ["21600", "6 h"]];
// The settings of the tab and their defaults; the address carries the ones that differ (viewer/tool-address.js).
export const DEPENDENCY_DEFAULTS = Object.freeze({ target: null, view: "matrix", interval: "auto" });
export const SIGNALS_LEAST = 3;
export const SIGNALS_MOST = 20;
export const INTERVALS_LEAST = 10;
export const INTERVALS_MOST = 100000;
export const MI_BINS = 16;
export const SCATTER_SIGNALS_MOST = 6;
export const SCATTER_POINTS_MOST = 300;
export const COLLINEAR_THRESHOLD = 0.99;
export const CONDITION_WARNING = 1000;
export const COVERAGE_WARNING = 0.5;
const CONCURRENT = 4;
const WIDTH_LEAST = 320;
const MARGIN = { left: 84, right: 24, top: 36, bottom: 40 };
const RESIDUAL_HEIGHT = 200;
const AXIS_TIME_FORMAT = "%m-%d %H:%M";

const CARD = [
    "Dependency: what do the matrix and its numbers say?",
    [
        ["In short", "Three to twenty signals are averaged over one common interval and aligned on the intervals that every one of them has; the numbers describe those means. Every view names the interval, the number of intervals used, those dropped and the share of the intervals each signal has."],
        ["Correlation matrix", "Pearson's r of every pair of signals, ordered by hierarchical clustering with average linkage on one minus the absolute correlation, so that signals that move together sit together; the dendrogram on the left shows the merges. Select a cell to open the Correlation tab with the same range and the two signals of the cell."],
        ["Mutual information matrix", `The mutual information of every pair of signals in nats over ${MI_BINS} equal-width bins of each variable, in the order of the correlation matrix. It is close to zero for signals with no relation of any shape and large for a straight line, a curve or a cycle alike, so a pair that is dark here and pale in the correlation matrix has a relation that is not a straight line. The diagonal is the entropy of the signal over the same bins and is left uncoloured.`],
        ["Ranking", `The mutual information of each signal with the target, in nats, estimated over ${MI_BINS} equal-width bins of each variable: how much knowing the signal narrows the target, whatever the shape of the relation. It is statistical association and says nothing about which signal drives which. The estimate is higher than the truth for few intervals.`],
        ["Scatter plot matrix", `The target and the ${SCATTER_SIGNALS_MOST - 1} signals most associated with it, every pair as a scatter plot below the diagonal and its correlation above; at most ${SCATTER_POINTS_MOST} points per panel, evenly spaced in time.`],
        ["Partial correlation", "The correlation of two signals after the effect of all the others is taken out. A large value where the matrix shows a small one, or the reverse, says that a third signal links or hides the pair."],
        ["Multiple regression", "The target as a linear combination of the other signals with an intercept, by least squares: the coefficients with their errors, the standardised coefficients (the change of the target in standard deviations per standard deviation of the signal) and R squared. Consecutive means are not independent, so the errors are smaller than the data justify, and a good fit is not a cause."],
        ["Principal components", "The eigenvalues of the correlation matrix, the share of the total variance of each, and the components (unit vectors over the signals). A few components with most of the variance say that the signals move together."],
        ["Conditioning", `The condition number of the correlation matrix is its largest eigenvalue over its smallest. Above ${CONDITION_WARNING} the signals are nearly combinations of each other and the partial correlation and the regression are unreliable; remove one of a pair that moves together.`],
    ],
    null,
];

const nameWithUnit = (entry) => `${entry.name}${entry.egu ? ` (${entry.egu})` : ""}`;
const fixed = (v, digits = 4) => (Number.isFinite(v) ? v.toFixed(digits) : "not defined");
/** A table in a box that scrolls sideways, so that a long signal name never widens the page. */
const scrollable = (table) => node("div", { class: "dep-table-wrap" }, table);
const percent = (share) => `${(100 * share).toFixed(share < 0.1 || share === 1 ? 1 : 0)} %`;

/** The usable result of the signals aligned: a message when the analysis cannot run, else the aligned columns and their numbers. */
export function analyse(entries, datasets) {
    const unusable = [];
    const series = [];
    for (const entry of entries) {
        const dataset = datasets.get(entry.name);
        const points = dataset && dataset.points ? pointsInside(dataset) : [];
        if (!points.length) unusable.push(entry.name);
        series.push({ name: entry.name, points });
    }
    if (unusable.length) {
        return { ok: false, reason: `${unusable.length === 1 ? `${unusable[0]} has` : `${unusable.join(", ")} have`} no numeric scalar means in the selected range; the Dependency tab reads numeric scalars only. Remove ${unusable.length === 1 ? "it" : "them"} from the selection.` };
    }
    const aligned = alignOnTimes(series);
    const result = { ok: false, aligned };
    if (aligned.common < INTERVALS_LEAST) {
        result.reason = `${aligned.common} of ${aligned.union} intervals hold every signal; the Dependency tab needs at least ${INTERVALS_LEAST}. Choose a longer range, a shorter interval or fewer signals.`;
        return result;
    }
    const flat = entries.filter((_, k) => !(d3.extent(aligned.columns[k])[0] < d3.extent(aligned.columns[k])[1]));
    if (flat.length) {
        result.reason = `${flat.map((e) => e.name).join(", ")} ${flat.length === 1 ? "does" : "do"} not vary over the ${aligned.common} common intervals; a correlation is not defined. Remove ${flat.length === 1 ? "it" : "them"} from the selection.`;
        return result;
    }
    const corr = correlationMatrix(aligned.columns);
    const clustering = averageLinkage(correlationDistances(aligned.columns));
    return { ...result, ok: true, corr, clustering, order: clustering.leaves, condition: conditionNumber(aligned.columns), columns: aligned.columns, times: aligned.times };
}

/** The names of the signal pairs that move together, for a refusal of an analysis that needs independent signals. */
function togetherText(names, columns) {
    const pairs = collinearPairs(columns, COLLINEAR_THRESHOLD).slice(0, 3);
    return pairs.length ? ` The pairs ${pairs.map((p) => `${names[p.i]} and ${names[p.j]} (r ${fixed(p.r, 4)})`).join(", ")} move together; remove one of each pair.` : " A signal is a combination of several others; remove the signals that it follows.";
}

/** The Dependency tab: its controls are built once and its body is drawn again at each render. */
export function createDependency(host, options) {
    const settings = { ...DEPENDENCY_DEFAULTS, ...(options.settings || {}) };
    // A change of a control tries again the signals whose means could not be read; the other renders keep the result of the retrieval.
    const changed = () => { if (current.failures.size) current.key = null; render(); if (options.changed) options.changed(); };
    const select = (label, choices, key) => {
        const element = node("select", { "aria-label": label });
        for (const [value, text] of choices) element.append(node("option", { value }, text));
        element.value = settings[key];
        element.addEventListener("change", () => { settings[key] = element.value; changed(); });
        return element;
    };
    const target = node("select", { "aria-label": "Dependency target signal" });
    target.addEventListener("change", () => { settings.target = target.value; changed(); });
    const view = select("Dependency view", DEPENDENCY_VIEWS, "view");
    const interval = select("Dependency interval", DEPENDENCY_INTERVALS, "interval");
    const field = (text, control) => node("label", null, text, control);
    const controls = node("div", { class: "cor-controls" }, field("View ", view), field("Target ", target), field("Interval ", interval), infoButton(...CARD, options.helpHref));
    const message = node("p", { class: "note", role: "status" });
    const summary = node("div", { class: "dep-summary" });
    const body = node("div", { class: "dep-body" });
    host.replaceChildren(controls, message, summary, body);

    // The means of the signals for one selection, interval and range: retrieved four at a time, and the analysis of them kept for the key.
    let current = { key: null, results: new Map(), failures: new Map(), pending: 0, analysis: null };

    function syncSignals(list) {
        const names = list.map((entry) => entry.name);
        if (names.join("\n") !== [...target.options].map((option) => option.value).join("\n")) {
            target.replaceChildren(...list.map((entry) => node("option", { value: entry.name }, entry.name)));
        }
        if (!names.includes(settings.target)) settings.target = names[0] ?? null;
        if (settings.target !== null) target.value = settings.target;
    }

    /** The seconds of the common interval: the interval chosen, or that of the page (the automatic one when the page shows raw samples). */
    function intervalSeconds(range) {
        if (settings.interval !== "auto") return Number(settings.interval);
        const page = options.resolution();
        return page === "raw" ? options.autoSeconds(range.from, range.to) : page;
    }

    function load(list, seconds, range, key) {
        current = { key, results: new Map(), failures: new Map(), pending: list.length, analysis: null };
        const mine = current;
        const queue = list.map((entry) => entry.name);
        const next = () => {
            const name = queue.shift();
            if (name === undefined) return;
            options.fetch(name, seconds, range.from, range.to)
                .then((dataset) => mine.results.set(name, dataset))
                .catch((error) => mine.failures.set(name, error && error.message ? error.message : String(error)))
                .finally(() => {
                    mine.pending -= 1;
                    if (current === mine) render();
                    next();
                });
        };
        for (let k = 0; k < Math.min(CONCURRENT, queue.length); k += 1) next();
    }

    function clearBody() {
        summary.replaceChildren();
        body.replaceChildren();
    }

    function render() {
        const list = options.signals();
        syncSignals(list);
        clearBody();
        message.textContent = "";
        view.value = settings.view;
        interval.value = settings.interval;
        target.disabled = !["ranking", "scatter", "regression"].includes(settings.view);
        if (list.length < SIGNALS_LEAST) {
            message.textContent = `Select three to twenty archived signals for the Dependency tab; ${list.length} selected.`;
            return;
        }
        if (list.length > SIGNALS_MOST) {
            message.textContent = `${list.length} signals are selected; the Dependency tab takes at most ${SIGNALS_MOST}. Remove ${list.length - SIGNALS_MOST} of them.`;
            return;
        }
        const range = options.range();
        const seconds = intervalSeconds(range);
        const intervals = Math.ceil((+range.to - +range.from) / 1000 / seconds);
        if (intervals > INTERVALS_MOST) {
            message.textContent = `The range holds ${intervals} intervals of ${seconds} s; the Dependency tab takes at most ${INTERVALS_MOST} per signal. Choose a longer interval or a shorter range.`;
            return;
        }
        const key = JSON.stringify([list.map((entry) => entry.name), seconds, +range.from, +range.to]);
        if (current.key !== key) load(list, seconds, range, key);
        const failed = list.filter((entry) => current.failures.has(entry.name));
        if (failed.length) {
            message.textContent = `The means of ${failed.map((entry) => `${entry.name} (${current.failures.get(entry.name)})`).join(", ")} could not be read; the Dependency tab needs every signal. Change the view or the interval to try again.`;
            return;
        }
        if (current.pending > 0) {
            message.textContent = `Loading the means of ${current.pending} of ${list.length} signals...`;
            return;
        }
        if (!current.analysis) current.analysis = analyse(list, current.results);
        const analysis = current.analysis;
        if (analysis.aligned) drawSummary(list, analysis, seconds);
        if (!analysis.ok) {
            message.textContent = analysis.reason;
            return;
        }
        const entries = list;
        const run = { matrix: drawMatrix, mutual: drawMutual, ranking: drawRanking, scatter: drawScatter, partial: drawPartial, regression: drawRegression, pca: drawPca }[settings.view];
        run(entries, analysis);
    }

    /** The common interval, the alignment and the coverage, written with every result. */
    function drawSummary(list, analysis, seconds) {
        const a = analysis.aligned;
        const page = options.resolution();
        const rows = [
            ["Interval", `means over ${seconds} s${settings.interval === "auto" && page === "raw" ? " (the page shows raw samples, so the tab averages them over the automatic interval of the range)" : ""}; ${list.length} signals`],
            ["Alignment", `the intervals that every signal has: ${a.common} of ${a.union} intervals used, ${a.dropped} dropped because a signal has no samples in them`],
        ];
        if (analysis.ok) {
            const cond = analysis.condition;
            rows.push(["Condition number", `${cond === null ? "not defined" : cond === Infinity ? "infinite" : cond.toPrecision(4)} of the correlation matrix${cond !== null && cond > CONDITION_WARNING ? `; above ${CONDITION_WARNING}, the partial correlation and the regression are unreliable` : ""}`]);
        }
        const thin = a.signals.filter((s) => s.share < COVERAGE_WARNING).map((s) => s.name);
        if (a.common / Math.max(1, a.union) < COVERAGE_WARNING || thin.length) {
            rows.push(["Coverage", `${thin.length ? `${thin.join(", ")} ${thin.length === 1 ? "has" : "have"} samples in fewer than half of the intervals; ` : ""}the result describes ${percent(a.common / Math.max(1, a.union))} of the intervals. Choose another interval, a longer range or fewer signals.`]);
        }
        summary.append(scrollable(node("table", { class: "chart-stats cor-table", "aria-label": "The common interval and the coverage" }, node("tbody", null, ...rows.map(([name, value]) => node("tr", { "data-row": name }, node("th", { scope: "row" }, name), node("td", null, value)))))));
        const coverage = node("table", { class: "chart-stats dep-coverage", "aria-label": "The share of the intervals each signal has" },
            node("thead", null, node("tr", null, node("th", { scope: "col" }, "Signal"), node("th", { scope: "col" }, "Intervals"), node("th", { scope: "col" }, "Share of the intervals in any signal"))),
            node("tbody", null, ...a.signals.map((s) => node("tr", { "data-signal": s.name }, node("th", { scope: "row" }, s.name), node("td", null, String(s.count)), node("td", null, percent(s.share))))));
        // The coverage of every signal is a list as long as the selection: it is kept closed under its summary, so that the matrix stays in view.
        summary.append(node("details", { class: "dep-coverage-box" }, node("summary", null, `Coverage of each signal (the lowest share is ${percent(Math.min(...a.signals.map((s) => s.share)))})`), scrollable(coverage)));
    }

    /** Opens the Correlation tab with the two signals of a matrix cell. */
    const open = (x, y) => { if (options.openCorrelation) options.openCorrelation(x, y); };

    /** The numbers of a matrix as a table in the order given, a row and a column per signal. */
    function matrixTable(label, names, order, values, digits, diagonal = () => "1") {
        const head = node("tr", null, node("th", { scope: "col" }, ""), ...order.map((i) => node("th", { scope: "col" }, names[i])));
        const rows = order.map((i) => node("tr", { "data-row": names[i] }, node("th", { scope: "row" }, names[i]), ...order.map((j) => node("td", { "data-r": String(values[i][j]) }, i === j ? diagonal(values[i][j]) : fixed(values[i][j], digits)))));
        return node("div", { class: "dep-table-wrap" }, node("table", { class: "chart-stats dep-table", "aria-label": label }, node("thead", null, head), node("tbody", null, ...rows)));
    }

    /** A heatmap of a symmetric matrix with its rows and columns in the order given, a dendrogram beside it when the linkage is given; a cell opens the Correlation tab. */
    function drawHeatmap(names, order, values, label, linkage, mutual = false) {
        const p = names.length;
        const width = Math.max(WIDTH_LEAST, Math.floor(body.clientWidth || 720));
        const labelWidth = Math.min(420, 7 * Math.max(...names.map((n) => n.length)) + 34);
        const dendroWidth = linkage ? 110 : 0;
        const top = 24;
        const cell = Math.max(12, Math.min(40, Math.floor((width - dendroWidth - labelWidth) / p)));
        const svg = d3.create("svg").attr("class", "dep-heatmap").attr("role", "group").attr("aria-label", label).attr("width", dendroWidth + p * cell + labelWidth).attr("height", top + p * cell);
        // A correlation is drawn on a diverging scale from -1 to 1; a mutual information on a sequential one from 0 to its largest value between two signals.
        const largest = mutual ? Math.max(...values.flatMap((row, i) => row.filter((_, j) => i !== j))) || 1 : 1;
        const colour = mutual ? d3.scaleSequential(d3.interpolateYlGnBu).domain([0, largest]) : d3.scaleSequential(d3.interpolateRdBu).domain([1, -1]);
        if (linkage) {
            const maxD = Math.max(...linkage.map((row) => row[2])) || 1;
            const xOf = (d) => dendroWidth - 4 - (d / maxD) * (dendroWidth - 10);
            const nodes = new Map(order.map((idx, pos) => [idx, { y: top + (pos + 0.5) * cell, d: 0 }]));
            linkage.forEach(([a, b, d], k) => {
                const na = nodes.get(a);
                const nb = nodes.get(b);
                svg.append("path").attr("class", "dep-dendrogram").attr("d", `M${xOf(na.d)},${na.y}H${xOf(d)}V${nb.y}H${xOf(nb.d)}`).attr("fill", "none");
                nodes.set(p + k, { y: (na.y + nb.y) / 2, d });
            });
        }
        const readout = node("p", { class: "note dep-readout", role: "status" }, "Hover or focus a cell to read its value; select it to open the Correlation tab.");
        const cells = [];
        order.forEach((i, row) => {
            svg.append("text").attr("class", "dep-label").attr("x", dendroWidth + p * cell + 6).attr("y", top + (row + 0.5) * cell + 4).text(`${row + 1}  ${names[i]}`);
            svg.append("text").attr("class", "dep-label dep-column").attr("x", dendroWidth + (row + 0.5) * cell).attr("y", top - 8).attr("text-anchor", "middle").text(String(row + 1));
            order.forEach((j, column) => {
                const v = values[i][j];
                const fill = i === j && mutual ? "var(--rule, #ccc)" : Number.isFinite(v) ? colour(mutual ? Math.max(0, Math.min(largest, v)) : Math.max(-1, Math.min(1, v))) : "transparent";
                const g = svg.append("g").attr("class", "dep-cell").attr("data-x", names[j]).attr("data-y", names[i]).attr("data-r", i === j ? 1 : v).attr("transform", `translate(${dendroWidth + column * cell},${top + row * cell})`);
                g.append("rect").attr("width", cell).attr("height", cell).attr("fill", fill).attr("stroke", "var(--panel, #fff)");
                if (cell >= 30 && i !== j) g.append("text").attr("class", "dep-value").attr("x", cell / 2).attr("y", cell / 2 + 4).attr("text-anchor", "middle").attr("fill", d3.hcl(fill).l > 58 ? "#000" : "#fff").text(fixed(v, mutual ? 3 : 2));
                const element = g.node();
                const text = `${names[i]} against ${names[j]}: ${i === j ? "the signal itself" : fixed(v, 4)}`;
                element.setAttribute("aria-label", i === j ? text : `${text}. Open in the Correlation tab`);
                if (i !== j) {
                    element.setAttribute("role", "button");
                    element.setAttribute("tabindex", cells.length === 0 ? "0" : "-1");
                    cells.push({ element, row, column });
                    element.addEventListener("click", () => open(names[j], names[i]));
                    element.addEventListener("keydown", (event) => {
                        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(names[j], names[i]); return; }
                        const step = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[event.key];
                        if (!step) return;
                        event.preventDefault();
                        // The diagonal has no button, so a step onto it goes one cell further.
                        let to = null;
                        for (let k = 1; k <= 2 && !to; k += 1) to = cells.find((c) => c.row === row + step[0] * k && c.column === column + step[1] * k) ?? null;
                        if (to) { for (const c of cells) c.element.setAttribute("tabindex", c === to ? "0" : "-1"); to.element.focus(); }
                    });
                }
                for (const type of ["mouseover", "focus"]) element.addEventListener(type, () => { readout.textContent = `${text}${i === j ? "" : `; ${names[i]} on the row, ${names[j]} on the column`}`; });
            });
        });
        const holder = node("div", { class: "dep-heatmap-wrap" });
        holder.append(svg.node());
        body.append(holder, readout, matrixTable(`${label}, the numbers`, names, order, values, 4, mutual ? (v) => fixed(v, 4) : undefined));
    }

    function drawMatrix(entries, analysis) {
        const names = entries.map((e) => e.name);
        drawHeatmap(names, analysis.order, analysis.corr, "Correlation matrix of the signals, ordered by clustering", analysis.clustering.linkage);
    }

    function drawMutual(entries, analysis) {
        const names = entries.map((e) => e.name);
        const p = names.length;
        const values = Array.from({ length: p }, () => new Array(p).fill(0));
        for (let i = 0; i < p; i += 1) {
            for (let j = i; j < p; j += 1) {
                values[i][j] = mutualInformation(analysis.columns[i], analysis.columns[j], MI_BINS);
                values[j][i] = values[i][j];
            }
        }
        body.append(node("p", { class: "note" }, `Mutual information of every pair in nats over ${MI_BINS} equal-width bins of each variable, in the order of the clustering of the correlation matrix; the diagonal is the entropy of the signal. It is statistical association of any shape, not cause, and higher than the truth for few intervals (${analysis.aligned.common} here).`));
        drawHeatmap(names, analysis.order, values, "Mutual information of the signals", analysis.clustering.linkage, true);
    }

    function drawPartial(entries, analysis) {
        const names = entries.map((e) => e.name);
        const partial = partialCorrelation(analysis.columns);
        if (!partial) {
            message.textContent = `The partial correlation needs a matrix that can be inverted, and this one cannot.${togetherText(names, analysis.columns)}`;
            return;
        }
        body.append(node("p", { class: "note" }, "Partial correlation: each pair after the effect of all the other signals is taken out; the signals are in the order of the clustering of the correlation matrix."));
        drawHeatmap(names, analysis.order, partial, "Partial correlation of the signals", null);
    }

    function targetIndex(entries) {
        return Math.max(0, entries.findIndex((e) => e.name === settings.target));
    }

    function drawRanking(entries, analysis) {
        const t = targetIndex(entries);
        const rows = entries.map((e, k) => ({ entry: e, k })).filter((r) => r.k !== t).map((r) => {
            const mi = mutualInformation(analysis.columns[r.k], analysis.columns[t], MI_BINS);
            const p = pearson(analysis.columns[r.k], analysis.columns[t]);
            const s = spearman(analysis.columns[r.k], analysis.columns[t]);
            return { ...r, mi, r: p ? p.r : NaN, rho: s ? s.rho : NaN };
        }).sort((a, b) => b.mi - a.mi);
        body.append(node("p", { class: "note" }, `Ranking of the signals by their mutual information with ${nameWithUnit(entries[t])}, in nats over ${MI_BINS} equal-width bins of each variable. It measures statistical association, not cause, and is higher than the truth for few intervals (${analysis.aligned.common} here).`));
        const top = Math.max(...rows.map((r) => r.mi)) || 1;
        // The width is set through the style object: the content security policy bars a style attribute.
        const bar = (percentOfTop) => { const element = node("span", { class: "dep-bar", "aria-hidden": "true" }); element.style.width = `${percentOfTop}%`; return element; };
        const table = node("table", { class: "chart-stats dep-ranking", "aria-label": "Signals ranked by mutual information with the target" },
            node("thead", null, node("tr", null, ...["Rank", "Signal", "Mutual information (nats)", "Association", "Pearson r", "Spearman rho"].map((h) => node("th", { scope: "col" }, h)))),
            node("tbody", null, ...rows.map((r, rank) => node("tr", { "data-signal": r.entry.name, "data-mi": String(r.mi) },
                node("td", null, String(rank + 1)), node("th", { scope: "row" }, nameWithUnit(r.entry)), node("td", null, fixed(r.mi, 4)),
                node("td", null, bar(Math.max(1, (100 * r.mi) / top))), node("td", null, fixed(r.r, 4)), node("td", null, fixed(r.rho, 4))))));
        body.append(scrollable(table));
    }

    function drawScatter(entries, analysis) {
        const t = targetIndex(entries);
        const others = entries.map((e, k) => ({ e, k })).filter((r) => r.k !== t)
            .map((r) => ({ ...r, mi: mutualInformation(analysis.columns[r.k], analysis.columns[t], MI_BINS) })).sort((a, b) => b.mi - a.mi).slice(0, SCATTER_SIGNALS_MOST - 1);
        const picked = [{ e: entries[t], k: t }, ...others];
        const width = Math.max(WIDTH_LEAST, Math.floor(body.clientWidth || 720));
        const size = Math.max(70, Math.min(170, Math.floor((width - 10) / picked.length)));
        const step = Math.max(1, Math.ceil(analysis.aligned.common / SCATTER_POINTS_MOST));
        const index = d3.range(0, analysis.aligned.common, step);
        body.append(node("p", { class: "note" }, `The scatter plot matrix shows ${nameWithUnit(entries[t])} and the ${others.length} of the other ${entries.length - 1} signals most associated with it; ${step === 1 ? "every interval" : `one interval in every ${step}`} (${index.length} points) per panel.`));
        const svg = d3.create("svg").attr("class", "dep-scatter-matrix").attr("role", "img").attr("aria-label", "Scatter plot matrix of the target and its most associated signals").attr("width", size * picked.length).attr("height", size * picked.length);
        picked.forEach((row, r) => picked.forEach((col, c) => {
            const g = svg.append("g").attr("class", "dep-panel").attr("data-x", col.e.name).attr("data-y", row.e.name).attr("transform", `translate(${c * size},${r * size})`);
            g.append("rect").attr("width", size - 2).attr("height", size - 2).attr("fill", "none").attr("stroke", "var(--line, #999)");
            const xs = analysis.columns[col.k];
            const ys = analysis.columns[row.k];
            if (r === c) {
                g.append("text").attr("class", "dep-label").attr("x", 6).attr("y", 16).text(row.e.name.length > size / 6.5 ? `${row.e.name.slice(0, Math.floor(size / 6.5) - 1)}…` : row.e.name);
                const bins = d3.bin().thresholds(10)(xs);
                const h = d3.scaleLinear().domain([0, d3.max(bins, (b) => b.length)]).range([0, size - 40]);
                const x = d3.scaleLinear().domain([bins[0].x0, bins[bins.length - 1].x1]).range([4, size - 6]);
                g.selectAll("rect.dep-histogram").data(bins).join("rect").attr("class", "dep-histogram").attr("x", (b) => x(b.x0)).attr("width", (b) => Math.max(1, x(b.x1) - x(b.x0) - 1)).attr("y", (b) => size - 6 - h(b.length)).attr("height", (b) => h(b.length));
            } else if (r > c) {
                const x = d3.scaleLinear().domain(d3.extent(xs)).range([6, size - 8]);
                const y = d3.scaleLinear().domain(d3.extent(ys)).range([size - 8, 6]);
                g.selectAll("circle").data(index).join("circle").attr("class", "dep-point").attr("r", 1.6).attr("cx", (i) => x(xs[i])).attr("cy", (i) => y(ys[i]));
                g.attr("data-count", index.length);
            } else {
                const p = pearson(xs, ys);
                g.append("text").attr("class", "dep-r").attr("x", size / 2).attr("y", size / 2 + 4).attr("text-anchor", "middle").text(`r ${p ? p.r.toFixed(2) : "n/a"}`);
            }
        }));
        body.append(svg.node());
    }

    function drawRegression(entries, analysis) {
        const names = entries.map((e) => e.name);
        const t = targetIndex(entries);
        const predictors = entries.map((e, k) => k).filter((k) => k !== t);
        const n = analysis.aligned.common;
        if (n <= predictors.length + 1) {
            message.textContent = `A regression on ${predictors.length} signals with an intercept needs more than ${predictors.length + 1} intervals; ${n} are common. Choose a longer range, a shorter interval or fewer signals.`;
            return;
        }
        const fit = multipleRegression(predictors.map((k) => analysis.columns[k]), analysis.columns[t]);
        if (!fit) {
            message.textContent = `The regression of ${names[t]} cannot be solved: its system is singular.${togetherText(names, analysis.columns)}`;
            return;
        }
        body.append(node("p", { class: "note" }, `Regression of ${nameWithUnit(entries[t])} on the other ${predictors.length} signals with an intercept, by least squares over ${n} intervals. A good fit is not a cause; consecutive means are not independent, so the errors are smaller than the data justify.`));
        const terms = [["Intercept", fit.params[0], fit.errors[0], null], ...predictors.map((k, j) => [nameWithUnit(entries[k]), fit.params[j + 1], fit.errors[j + 1], fit.standardised[j]])];
        body.append(scrollable(node("table", { class: "chart-stats dep-regression", "aria-label": "The coefficients of the regression" },
            node("thead", null, node("tr", null, ...["Term", "Coefficient", "Error", "Standardised"].map((h) => node("th", { scope: "col" }, h)))),
            node("tbody", null, ...terms.map(([name, value, error, standard]) => node("tr", { "data-term": name, "data-coefficient": String(value), "data-error": String(error), "data-standardised": standard === null ? "" : String(standard) }, node("th", { scope: "row" }, name), node("td", null, fixed(value, 5)), node("td", null, fixed(error, 5)), node("td", null, standard === null ? "" : fixed(standard, 4))))))));
        body.append(scrollable(node("table", { class: "chart-stats cor-table dep-fit", "aria-label": "The fit of the regression" }, node("tbody", null,
            ...[["R squared", fixed(fit.rSquared, 4), fit.rSquared], ["Chi-square per degree of freedom", `${fixed(fit.chi2PerDof, 4)} (${fit.dof} degrees of freedom, ${n} intervals)`, fit.chi2PerDof]]
                .map(([name, value, exact]) => node("tr", { "data-row": name, "data-value": String(exact) }, node("th", { scope: "row" }, name), node("td", null, value)))))));
        const zone = options.zone();
        const range = options.range();
        const width = Math.max(WIDTH_LEAST, Math.floor(body.clientWidth || 720));
        const xScale = d3.scaleTime().domain([range.from, range.to]).range([MARGIN.left, width - MARGIN.right]);
        const residuals = analysis.times.map((time, i) => ({ t: time, v: fit.residuals[i] }));
        const [low, high] = d3.extent(residuals, (p) => p.v);
        const pad = (high - low) * 0.08 || 1;
        const y = d3.scaleLinear().domain([low - pad, high + pad]).range([RESIDUAL_HEIGHT - MARGIN.bottom, MARGIN.top + 14]);
        const unit = entries[t].egu || "residual";
        const surface = createPlotCanvas({ width, height: RESIDUAL_HEIGHT, margin: { left: MARGIN.left, right: MARGIN.right, top: MARGIN.top, bottom: MARGIN.bottom }, x: xScale, scales: new Map([[unit, y]]), units: [unit], axisWidth: MARGIN.left, onLeft: 1,
            unitLabels: true, axisLabels: new Map([[unit, `Residuals: observed minus fitted ${names[t]}`]]), axisLabelAnchor: "start", label: `Residuals of the regression of ${names[t]}`, xFormat: (date) => formatInZone(date, AXIS_TIME_FORMAT, zone),
            xTicks: [0, 1 / 3, 2 / 3, 1].map((f) => new Date(+range.from + f * (+range.to - +range.from))), grid: "y", tickCount: 3 });
        surface.marks.append("line").attr("class", "cor-zero").attr("x1", xScale.range()[0]).attr("x2", xScale.range()[1]).attr("y1", y(0)).attr("y2", y(0));
        surface.marks.selectAll("circle").data(residuals).join("circle").attr("class", "dep-residual").attr("r", 1.5).attr("data-count", residuals.length).attr("cx", (p) => xScale(p.t)).attr("cy", (p) => y(p.v));
        body.append(node("div", { class: "chart dep-residuals" }, surface.svg.node()));
    }

    function drawPca(entries, analysis) {
        const names = entries.map((e) => e.name);
        const pca = principalComponents(analysis.columns);
        if (!pca) {
            message.textContent = "The principal components cannot be computed: a signal has no spread over the common intervals.";
            return;
        }
        body.append(node("p", { class: "note" }, `Principal components of the ${entries.length} standardised signals: the eigenvalues of their correlation matrix (they add up to ${entries.length}), the share of the total variance, and the components as unit vectors over the signals.`));
        let cumulative = 0;
        body.append(scrollable(node("table", { class: "chart-stats dep-pca", "aria-label": "The variance of the principal components" },
            node("thead", null, node("tr", null, ...["Component", "Eigenvalue", "Share of the variance", "Cumulative share"].map((h) => node("th", { scope: "col" }, h)))),
            node("tbody", null, ...pca.eigenvalues.map((value, k) => {
                cumulative += pca.share[k];
                return node("tr", { "data-component": String(k + 1), "data-eigenvalue": String(value), "data-share": String(pca.share[k]) }, node("th", { scope: "row" }, `PC${k + 1}`), node("td", null, fixed(value, 4)), node("td", null, percent(pca.share[k])), node("td", null, percent(Math.min(1, cumulative))));
            })))));
        body.append(node("div", { class: "dep-table-wrap" }, node("table", { class: "chart-stats dep-loadings", "aria-label": "The components over the signals" },
            node("thead", null, node("tr", null, node("th", { scope: "col" }, "Component"), ...names.map((n) => node("th", { scope: "col" }, n)))),
            node("tbody", null, ...pca.components.map((vector, k) => node("tr", { "data-component": String(k + 1) }, node("th", { scope: "row" }, `PC${k + 1}`), ...vector.map((v) => node("td", { "data-v": String(v) }, fixed(v, 3)))))))));
    }

    return { render, settings };
}
