// The analyzer owns validated selection state and retrieves data from its own appliance.
import { createChart } from "../comm/js/aa/chart.js";
import { node } from "../comm/js/aa/dom.js";
import { PROFILES, setProfile, onProfileChange } from "../comm/js/aa/chart/profile.js";
import { currentZone, ZONES, setZone, onZoneChange, formatInZone, partsInZone, zoneName } from "../comm/js/aa/timezone.js";
import { readChartState, writeChartParameters } from "../comm/js/aa/chart/state.js";
import { buildRangeStrip } from "../comm/js/aa/chart/strip.js";

const DATA = "../../data/getData.json";
const MATCHING = "../../bpl/getMatchingPVs";
const APPLIANCE = "../../bpl/getApplianceInfo";
const CONCURRENT_REQUESTS = 6;
const TARGET_SAMPLES = 700;
const HOUR = 3600000;
const INPUT_FORMAT = "%Y-%m-%dT%H:%M:%S";
const VIEWS = ["trend", "distribution", "correlation", "dependency", "spectrum", "compare", "waveform", "image"];
const PV_NAME = /^[a-zA-Z0-9:_\-+[\];/,#{}^<>]+(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/;
const state = { pvs: [], from: null, to: null, selected: null, view: "trend",
    chart: null, data: new Map(), failures: new Map() };
const $ = (id) => document.getElementById(id);
let chart;
let controller = null;
let inputKey = "";

function parseDate(text) {
    if (!text) return null;
    const date = new Date(text);
    return Number.isFinite(date.getTime()) ? date : null;
}

function inputTime(date) {
    return formatInZone(date, INPUT_FORMAT, currentZone()) + "." + String(date.getMilliseconds()).padStart(3, "0");
}

/** Converts calendar input in the chosen zone; nonexistent or ambiguous local times require UTC entry. */
function readTime(text, original) {
    if (!text) return null;
    const normalized = text.length === 16 ? text + ":00.000" : text.length === 19 ? text + ".000" : text;
    if (normalized === inputTime(original)) return original;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(text);
    if (!match) return null;
    const fields = match.slice(1, 7).map((part) => Number(part || 0));
    const ms = Number((match[7] || "").padEnd(3, "0"));
    const naive = Date.UTC(fields[0], fields[1] - 1, fields[2], fields[3], fields[4], fields[5], ms);
    const candidates = new Set();
    for (const shift of [-24, 0, 24]) {
        const probe = new Date(naive + shift * HOUR);
        const p = partsInZone(probe, currentZone());
        const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, probe.getMilliseconds());
        const value = new Date(naive - (local - probe.getTime()));
        const q = partsInZone(value, currentZone());
        if ([q.year, q.month, q.day, q.hour, q.minute, q.second].every((v, i) => v === fields[i])) {
            candidates.add(value.getTime());
        }
    }
    return candidates.size === 1 ? new Date([...candidates][0]) : null;
}

function readAddress() {
    const parameters = new URLSearchParams(window.location.search);
    state.pvs = [...new Set(parameters.getAll("pv").map((name) => name.trim()).filter((name) => PV_NAME.test(name)))];
    state.to = parseDate(parameters.get("to")) || new Date();
    state.from = parseDate(parameters.get("from")) || new Date(state.to.getTime() - HOUR);
    if (state.from >= state.to) state.from = new Date(state.to.getTime() - HOUR);
    state.selected = { from: state.from, to: state.to };
    state.chart = readChartState(parameters);
    state.view = VIEWS.includes(parameters.get("view")) ? parameters.get("view") : "trend";
    const zone = parameters.get("tz");
    setZone(ZONES.some((item) => item.id === zone) ? zone : "browser");
    let profile = parameters.get("profile");
    if (!PROFILES.some((item) => item.id === profile)) {
        try { profile = window.localStorage.getItem("aa.chartProfile"); } catch (error) { profile = null; }
    }
    setProfile(PROFILES.some((item) => item.id === profile) ? profile : "default");
}

function writeAddress() {
    const parameters = new URLSearchParams();
    for (const name of state.pvs) parameters.append("pv", name);
    parameters.set("from", state.from.toISOString());
    parameters.set("to", state.to.toISOString());
    parameters.set("view", state.view);
    writeChartParameters(parameters, chart ? chart.getState() : state.chart);
    window.history.replaceState(null, "", `${window.location.pathname}?${parameters}`);
    const active = document.querySelector("ul.mainmenu a[aria-current='page']");
    if (active) active.href = window.location.href;
}

async function setupHeader() {
    const menu = document.querySelector("ul.mainmenu");
    const links = [...menu.querySelectorAll("a")].map((link) => [link, link.getAttribute("href")]);
    menu.addEventListener("click", (event) => {
        if (menu.dataset.ready !== "true") event.preventDefault();
    });
    for (const [link] of links) link.setAttribute("aria-disabled", "true");
    try {
        const response = await fetch(APPLIANCE);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const info = await response.json();
        const management = new URL(String(info.mgmtURL || "").replace(/\/?$/, "/"));
        if (!["http:", "https:"].includes(management.protocol)) throw new Error("No management address");
        const base = new URL("../ui/", management);
        for (const [link, href] of links) {
            link.href = href === "analyzer.html" ? window.location.href : new URL(href, base).href;
            link.removeAttribute("aria-disabled");
        }
        menu.dataset.ready = "true";
    } catch (error) {
        $("headerMessage").textContent = `The console menu is unavailable: ${error.message}. Reload to retry.`;
    }
}

async function fetchSeries(name, from, to, bin, signal) {
    // meanSample leaves an interval without samples empty instead of holding a disconnected value.
    const operator = bin > 1 ? `meanSample_${bin}(${name})` : name;
    const query = new URLSearchParams({ pv: operator, from: from.toISOString(), to: to.toISOString() });
    const response = await fetch(`${DATA}?${query}`, { signal });
    if (!response.ok) throw new Error(`${response.statusText || "Retrieval failed"} (HTTP ${response.status})`);
    const body = await response.json();
    const first = body[0];
    if (!first) return { name, egu: "", points: [], form: "No samples" };
    const points = [];
    for (const sample of first.data) {
        if (typeof sample.val === "number" && Number.isFinite(sample.val)) {
            const fields = sample.fields;
            const lost = Boolean(fields && (Number(fields.cnxlostepsecs) > 0 || fields.startup === "true" || fields.connectionChange === "true"));
            points.push({ t: sample.secs * 1000 + Math.floor((sample.nanos || 0) / 1e6), v: sample.val, s: sample.severity || 0, g: lost });
        }
    }
    const form = points.length ? "Numeric samples" : first.data.length ? "No supported scalar samples" : "No samples";
    return { name, egu: first.meta?.EGU ?? "", points, form };
}

async function load() {
    controller?.abort();
    const request = new AbortController();
    controller = request;
    const { signal } = request;
    const { from, to } = state;
    const pvs = [...state.pvs];
    const bin = Math.max(1, Math.ceil((to - from) / 1000 / TARGET_SAMPLES));
    state.data = new Map();
    state.failures = new Map();
    render();
    let next = 0;
    const pump = async () => {
        while (next < pvs.length && !signal.aborted) {
            const name = pvs[next++];
            try {
                const series = await fetchSeries(name, from, to, bin, signal);
                if (!signal.aborted && request === controller && state.pvs.includes(name)) state.data.set(name, { ...series, bin });
            } catch (error) {
                if (!signal.aborted && request === controller && state.pvs.includes(name)) state.failures.set(name, String(error.message || error));
            }
            if (!signal.aborted && request === controller) render();
        }
    };
    await Promise.all(Array.from({ length: CONCURRENT_REQUESTS }, pump));
}

function timeData() {
    return { from: state.from, to: state.to,
        windowChosen: +state.from !== +state.selected.from || +state.to !== +state.selected.to,
        canPanLater: state.to.getTime() < Date.now(),
        // The selected dataset: the PVs and the selected range. A change of it starts the chart's history and references anew.
        datasetKey: `${state.pvs.join("\n")}|${+state.selected.from}|${+state.selected.to}` };
}

function renderInputs(force = false) {
    const key = `${+state.from}:${+state.to}:${currentZone()}`;
    if (force || key !== inputKey) {
        $("fromTime").value = inputTime(state.from);
        $("toTime").value = inputTime(state.to);
        inputKey = key;
    }
    $("timeControls").replaceChildren(buildRangeStrip({ ...timeData(), timeZone: currentZone(),
        onPan: panBy, onReset: resetTime, values: false }, new Map(), [], () => {}));
    $("activeRange").textContent = `${formatInZone(state.from, "%Y-%m-%d %H:%M:%S", currentZone())} to ${formatInZone(state.to, "%Y-%m-%d %H:%M:%S", currentZone())} ${zoneName(currentZone(), state.to)}`;
}

function removePV(name) {
    state.pvs = state.pvs.filter((other) => other !== name);
    state.data.delete(name);
    state.failures.delete(name);
    writeAddress();
    render();
    $("pvName").focus();
}

function renderSignals() {
    const focusedLabel = $("signals").contains(document.activeElement) ? document.activeElement.getAttribute("aria-label") : null;
    const hidden = new Set(chart.getState().hidden);
    $("chips").replaceChildren();
    $("signals").replaceChildren();
    for (const name of state.pvs) {
        const series = state.data.get(name);
        const failure = state.failures.get(name);
        const remove = node("button", { type: "button", class: "plain", "aria-label": `Remove ${name}` }, "Remove");
        remove.addEventListener("click", () => removePV(name));
        $("chips").append(node("li", null, node("span", { class: "pv" }, name),
            node("span", { class: "unit-label" }, series?.egu || (series ? "no unit" : "")), remove));
        const visible = node("input", { type: "checkbox", "aria-label": `Show ${name}` });
        visible.checked = !hidden.has(name);
        visible.addEventListener("change", () => {
            if (visible.checked) hidden.delete(name); else hidden.add(name);
            chart.setState({ hidden: [...hidden] });
        });
        $("signals").append(node("li", null, node("label", null, visible, node("span", { class: "pv" }, name)),
            node("p", { class: failure ? "warn" : "note" },
                failure ? `Retrieval failed: ${failure}` : series ? `${series.form}; ${series.egu || "no unit"}; ${series.points.length} returned.` : "Loading")));
    }
    if (focusedLabel) {
        [...$("signals").querySelectorAll("input")].find((input) => input.getAttribute("aria-label") === focusedLabel)?.focus();
    }
}

function renderAxes() {
    const ranges = new Map(chart.getState().ranges);
    const units = [...new Set([...state.data.values()].map((series) => series.egu || "").concat([...ranges.keys()]))];
    $("axes").replaceChildren();
    if (!units.length) $("axes").append(node("p", null, "Plot a numeric signal to configure its unit."));
    units.forEach((unit, index) => {
        const range = ranges.get(unit);
        const form = node("form", { class: "axis-form", "data-unit": unit });
        const low = node("input", { type: "number", step: "any", id: `axis-${index}-low`, "aria-label": `Minimum ${unit || "no unit"}`, placeholder: "Auto" });
        const high = node("input", { type: "number", step: "any", id: `axis-${index}-high`, "aria-label": `Maximum ${unit || "no unit"}`, placeholder: "Auto" });
        if (range) { low.value = range[0]; high.value = range[1]; }
        const error = node("p", { class: "error", role: "alert" });
        const automatic = node("button", { type: "button" }, "Auto");
        form.append(node("h3", null, unit || "No unit"),
            node("label", null, "Minimum", low), node("label", null, "Maximum", high),
            node("button", { type: "submit" }, "Apply"), automatic, error);
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const minimum = Number(low.value), maximum = Number(high.value);
            if (!low.value.trim() || !high.value.trim() || !Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
                error.textContent = "Enter a finite minimum below the maximum.";
                return;
            }
            const next = new Map(chart.getState().ranges);
            next.set(unit, [minimum, maximum]);
            chart.setState({ ranges: [...next] });
        });
        automatic.addEventListener("click", () => chart.setState({ ranges: chart.getState().ranges.filter(([name]) => name !== unit) }));
        $("axes").append(form);
    });
}

function render() {
    renderInputs();
    renderSignals();
    renderAxes();
    const loaded = state.pvs.map((name) => state.data.get(name)).filter(Boolean);
    const failed = state.pvs.filter((name) => state.failures.has(name)).length;
    const waiting = state.pvs.length - loaded.length - failed;
    $("message").textContent = !state.pvs.length ? "Choose an archived PV and select Plot."
        : waiting ? `Loading ${waiting} of ${state.pvs.length} signals...`
        : failed ? `${failed} of ${state.pvs.length} signals could not be read. See Signals for details.`
        : `${loaded.length} signals retrieved.`;
    const bin = loaded[0]?.bin || Math.max(1, Math.ceil((state.to - state.from) / 1000 / TARGET_SAMPLES));
    const source = bin > 1 ? `Means over ${bin} s. Intervals without samples remain empty.` : "Stored numeric samples.";
    const note = `${source} Statistics count the visible samples within the time and Y ranges. ${failed ? "Some signals are missing." : ""}`;
    $("sourceNote").textContent = note;
    $("dataNote").textContent = note;
    if (state.view !== "trend") {
        chart.message("This analysis has not run.");
    } else if (loaded.some((series) => series.points.length)) {
        chart.draw({ series: loaded.map((series, index) => ({ ...series, focus: index === 0 })),
            ...timeData(), gapMs: Infinity });
    } else {
        chart.message(waiting ? "Loading samples..." : state.pvs.length ? "No supported numeric samples in this range." : "Select archived signals to draw their trend.");
    }
}

function applyRange(from, to, selected = false) {
    state.from = from;
    state.to = to;
    if (selected) state.selected = { from, to };
    $("rangeError").textContent = "";
    writeAddress();
    renderInputs(true);
    load();
}

function panBy(direction) {
    const span = state.to - state.from;
    const to = Math.min(Date.now(), state.to.getTime() + direction * span / 2);
    applyRange(new Date(to - span), new Date(to));
}

function resetTime() {
    applyRange(state.selected.from, state.selected.to);
}

function explainView(view, restored = false) {
    const label = view[0].toUpperCase() + view.slice(1);
    $("unavailableView").hidden = false;
    $("unavailableReason").textContent = `${label} is not available in this version. No ${view} analysis has run.`;
    $("returnTrend").hidden = !restored;
    $("trendPanel").hidden = restored;
}

function showTrend() {
    state.view = "trend";
    $("trendPanel").hidden = false;
    $("unavailableView").hidden = true;
    $("trendTab").setAttribute("aria-selected", "true");
    writeAddress();
    render();
}

function wireTabs(host, activate) {
    const tabs = [...host.querySelectorAll('[role="tab"]')];
    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => activate(tab));
        tab.addEventListener("keydown", (event) => {
            const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
                : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
                : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
            if (next < 0) return;
            event.preventDefault();
            tabs.forEach((item, i) => { item.tabIndex = i === next ? 0 : -1; });
            tabs[next].focus();
        });
    });
}

function csv() {
    const rows = ["pv,time,value,severity,interval_seconds"];
    for (const name of state.pvs) {
        const series = state.data.get(name);
        for (const point of series ? series.points : []) {
            rows.push(`${JSON.stringify(name)},${new Date(point.t).toISOString()},${point.v},${point.s},${series.bin}`);
        }
    }
    return rows.join("\n");
}

let suggestionGeneration = 0;
async function suggest(text) {
    const generation = ++suggestionGeneration;
    const term = text.trim();
    const list = $("suggestions");
    list.replaceChildren();
    if (term.length < 2) return;
    try {
        const response = await fetch(`${MATCHING}?${new URLSearchParams({ pv: `*${term}*`, limit: "20" })}`);
        if (!response.ok) return;
        const names = await response.json();
        if (generation === suggestionGeneration) list.replaceChildren(...names.map((name) => node("option", { value: name })));
    } catch (error) {
        // Suggestions are optional; Plot still accepts an archived name.
    }
}

function wire() {
    let timer = 0;
    $("pvName").addEventListener("input", (event) => {
        window.clearTimeout(timer);
        suggestionGeneration++;
        timer = window.setTimeout(() => suggest(event.target.value), 200);
    });
    $("addForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const name = $("pvName").value.trim();
        if (PV_NAME.test(name) && !state.pvs.includes(name)) {
            state.pvs.push(name);
            $("pvName").value = "";
            writeAddress();
            load();
        } else if (name) {
            $("message").textContent = PV_NAME.test(name) ? "This PV is already selected." : "This is not a valid PV name.";
        }
    });
    document.querySelectorAll("#ranges button").forEach((button) => button.addEventListener("click", () => {
        const to = readTime($("toTime").value, state.to);
        if (!to) { $("rangeError").textContent = "Enter a valid end time first."; return; }
        $("fromTime").value = inputTime(new Date(to.getTime() - Number(button.dataset.minutes) * 60000));
        $("toTime").value = inputTime(to);
    }));
    $("spanForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const from = readTime($("fromTime").value, state.from), to = readTime($("toTime").value, state.to);
        if (from && to && from < to) applyRange(from, to, true);
        else $("rangeError").textContent = "Enter valid, unambiguous times with From before To. Use UTC for a repeated local time.";
    });
    $("projection").checked = state.chart.projection;
    $("projection").addEventListener("change", () => chart.setState({ projection: $("projection").checked }));
    wireTabs($("analysisTabs"), (tab) => tab.dataset.view === "trend" ? showTrend() : explainView(tab.dataset.view, state.view !== "trend"));
    wireTabs($("settingsTabs"), (tab) => {
        for (const item of $("settingsTabs").querySelectorAll('[role="tab"]')) {
            const active = item === tab;
            item.setAttribute("aria-selected", String(active));
            item.tabIndex = active ? 0 : -1;
            $(item.dataset.panel + "Panel").hidden = !active;
        }
    });
    $("returnTrend").addEventListener("click", showTrend);
    $("toggleSettings").addEventListener("click", () => {
        const hidden = !$("settings").hidden;
        $("settings").hidden = hidden;
        $("workspace").classList.toggle("settings-hidden", hidden);
        $("toggleSettings").textContent = hidden ? "Show settings" : "Hide settings";
        $("toggleSettings").setAttribute("aria-expanded", String(!hidden));
        render();
    });
    $("copyLink").addEventListener("click", async () => {
        writeAddress();
        try {
            await navigator.clipboard.writeText(window.location.href);
            $("message").textContent = "Link copied.";
        } catch (error) {
            $("message").textContent = "Copy the current address from the address bar; clipboard access is unavailable.";
        }
    });
    $("downloadCsv").addEventListener("click", () => {
        const address = URL.createObjectURL(new Blob([csv()], { type: "text/csv" }));
        const link = node("a", { href: address, download: "archived-data.csv" });
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(address), 1000);
    });
    onZoneChange(() => { writeAddress(); renderInputs(true); });
    onProfileChange(writeAddress);
    let resize = 0;
    window.addEventListener("resize", () => {
        window.clearTimeout(resize);
        resize = window.setTimeout(render, 150);
    });
}

readAddress();
chart = createChart($("charts"), {
    id: "analyzer-trend", idPrefix: "trend", legend: true, initialState: state.chart,
    controlsHost: $("chartOptions"), statisticsHost: [$("statistics"), $("dataStatistics")],
    rangeHost: $("timeControls"), fitWidth: true, tools: true, toolbarHost: $("trendTools"),
    helpHref: () => document.querySelector("ul.mainmenu").dataset.ready === "true" ? $("help").href : null,
    onZoom: (from, to) => applyRange(from, to), onPan: panBy, onReset: resetTime,
    onApply: (from, to) => applyRange(from, to, true),
    onStateChange: (next) => {
        state.chart = next;
        $("projection").checked = next.projection;
        writeAddress();
        renderSignals();
        renderAxes();
    },
});
wire();
writeAddress();
if (state.view !== "trend") {
    $("trendTab").setAttribute("aria-selected", "false");
    explainView(state.view, true);
}
setupHeader();
render();
if (state.pvs.length) load();
