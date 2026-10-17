// The Browse PVs page: find PVs, scan the selected ones, inspect a few in detail, and act on them.
import * as api from "./browse/api.js";
import { createChart } from "../comm/js/aa/chart.js";
import { infoButton } from "../comm/js/aa/card.js";
import { node } from "../comm/js/aa/dom.js";
import { sparkline } from "../comm/js/aa/spark.js";
import { drawHistogram, drawScatter } from "../comm/js/aa/plots.js";
import { valueParts, dateTimeText, instantTitle } from "./browse/format.js";
import { buildDetails } from "./browse/details.js";

// Initial limits (D47). They are configuration; measurement and use adjust them.
const LIMITS = { table: 100, chart: 5, concurrentRequests: 6, indexed: 500000 };
// A row of the result list is as high as a touch target on a narrow screen.
function rowHeight() {
    return window.matchMedia("(max-width: 600px)").matches ? 44 : 30;
}
// A name as the server reads it: the base name, then an optional field (X:Y.RBV).
const PV_NAME = /^[a-zA-Z0-9:_\-+[\];/,#{}^<>]+(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/;
// Up to this span the server answer is not reduced (bin = ceil(seconds / 600)).
const BIN_FREE_MINUTES = 10;
// The automatic refresh of the page: the choices in seconds (0 is off), the default, and the key under which the browser keeps the choice.
const REFRESH_KEY = "aa.browse.refresh";
const REFRESH_CHOICES = [0, 10, 30, 60];
const REFRESH_DEFAULT = 30;
// The Trend and the chart are read again when the data is older than this, so a refresh every 10 s reads them every 30 s.
const TREND_MIN_MS = 25000;

const STATES = {
    "Being archived": "The engine is sampling this PV and its samples are being stored.",
    Paused: "The archiver knows this PV but is not sampling it. Resume to continue storing samples.",
    Disconnected: "The archiver cannot reach this PV on the control system network. No samples are stored until it returns.",
    "Not being archived": "The archiver has no request for this PV. Archive it to start storing samples.",
    "Initial sampling": "The archiver is looking up the type and settings of this PV before it stores samples.",
    "Appliance assigned": "The request was accepted and the PV is assigned to an appliance. Sampling has not started yet.",
    "Appliance Down": "The appliance that holds this PV does not answer, so its state cannot be read.",
};

// States of a PV whose archive request has not finished; the request can still be aborted.
const PENDING = new Set(["Initial sampling", "Appliance assigned"]);

// Reports of the server shown as a selection of the list. value is the field that is shown beside each PV.
// A ranked report keeps the order of the server; the others are in alphabetical order.
const TOP = { limit: "1000" };
const REPORTS = {
    disconnected: { endpoint: "../bpl/getCurrentlyDisconnectedPVs", value: "lastKnownEvent", note: "Beside each PV: the time of its last event." },
    paused: { endpoint: "../bpl/getPausedPVsReport", value: "modificationTime", note: "Beside each PV: when its settings last changed." },
    never: { endpoint: "../bpl/getNeverConnectedPVs", value: "requestTime", note: "Beside each PV: when its archive request was made." },
    metagets: { endpoint: "../bpl/getMetaGets", value: "internalState", note: "Beside each PV: the state of its first connection." },
    recent: { endpoint: "../bpl/getRecentlyAddedPVs", params: TOP, value: "creationTime", ranked: true, note: "Newest first. Beside each PV: when it was added." },
    modified: { endpoint: "../bpl/getRecentlyModifiedPVs", params: TOP, value: "modificationTime", ranked: true, note: "Newest first. Beside each PV: when it changed." },
    eventrate: { endpoint: "../bpl/getEventRateReport", params: TOP, value: "eventRate", ranked: true, note: "Highest first. Beside each PV: events per second." },
    storagerate: { endpoint: "../bpl/getStorageRateReport", params: TOP, value: "storageRate_MBperDay", ranked: true, note: "Highest first. Beside each PV: MB of storage per day." },
    consumed: { endpoint: "../bpl/getPVsByStorageConsumed", params: TOP, value: "storageConsumedInMB", ranked: true, note: "Highest first. Beside each PV: MB of storage used." },
    lost: { endpoint: "../bpl/getLostConnectionsReport", params: TOP, value: "lostConnections", ranked: true, note: "Highest first. Beside each PV: connection drops." },
    silent: { endpoint: "../bpl/getSilentPVsReport", params: TOP, value: "lastKnownEvent", ranked: true, note: "Silent longest first. Beside each PV: the time of its last event." },
    droppedtime: { endpoint: "../bpl/getPVsByDroppedEventsTimestamp", params: TOP, value: "eventsDropped", ranked: true, note: "Highest first. Beside each PV: events dropped for a wrong time stamp." },
    droppedbuffer: { endpoint: "../bpl/getPVsByDroppedEventsBuffer", params: TOP, value: "eventsDropped", ranked: true, note: "Highest first. Beside each PV: events dropped by buffer overflow." },
    droppedtype: { endpoint: "../bpl/getPVsByDroppedEventsTypeChange", params: TOP, value: "eventsDropped", ranked: true, note: "Highest first. Beside each PV: events dropped by a type change." },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HUMAN_TIME = /^([A-Z][a-z]{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})(?: [A-Z]{2,5})?$/;
const pad = (value) => String(value).padStart(2, "0");

/**
 * A date-time of a report in the short form the list has room for: the time of day for today, the day and the minute
 * for this year, the day and the year for an earlier year. Text that is not a date-time gives null.
 */
function shortTime(raw) {
    let month;
    let day;
    let year;
    let time;
    const human = HUMAN_TIME.exec(raw);
    if (human) {
        [, month, day, year, time] = human;
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(raw)) {
        const date = new Date(raw);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        month = MONTHS[date.getMonth()];
        day = pad(date.getDate());
        year = String(date.getFullYear());
        time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    } else {
        return null;
    }
    const now = new Date();
    if (Number(year) !== now.getFullYear()) {
        return `${month}/${day}/${year}`;
    }
    if (month === MONTHS[now.getMonth()] && Number(day) === now.getDate()) {
        return time;
    }
    return `${month}/${day} ${time.slice(0, 5)}`;
}

/**
 * The value beside a PV in a report: a number with four significant digits, a date-time in its short form, any other
 * text as the server gave it. The title is the full text, shown when the pointer rests on the value.
 */
function reportValue(raw) {
    if (raw === undefined || raw === null || raw === "") {
        return { text: "", title: "" };
    }
    const full = String(raw);
    const number = Number(raw);
    if (Number.isFinite(number) && /^-?[\d.]+(e[+-]?\d+)?$/i.test(full)) {
        return { text: String(Number(number.toPrecision(4))), title: "" };
    }
    const short = shortTime(full);
    return { text: short ?? full, title: short ? full : "" };
}

// The chart widget of the page, built when the page is wired.
let chart = null;

const state = {
    count: 0,
    asOf: 0,
    overflow: false,
    partial: false,
    query: "",
    mode: "contains",
    prefix: null,
    report: null,
    allowed: null,
    reportValues: new Map(),
    reportRanked: false,
    results: [],
    total: 0,
    groups: {},
    selected: [],
    // The PVs whose Plot box is on, at most LIMITS.chart, in the order they were turned on.
    plotted: [],
    active: 0,
    focus: null,
    status: new Map(),
    // The newest sample at or before the end of the window of each PV of the table (getDataAtTime); null when the PV has
    // none in the 30 days before it, absent while it is not read yet.
    latest: new Map(),
    // getPVTypeInfo of each PV of the table, which tells its protocol; null when it could not be read.
    typeInfo: new Map(),
    // The events dropped for each PV: the sum of the three getPVsByDroppedEvents reports.
    dropped: new Map(),
    // The seconds between two refreshes of the page (0 is off), as the person chose them, and the time of the last refresh.
    refreshSeconds: savedRefresh(),
    refreshedAt: 0,
    data: new Map(),
    rangeMinutes: 60,
    // A window the person dragged out of the chart, or null while the range button decides.
    window: null,
    minimumSamplingPeriod: 0.1,
};

const $ = (id) => document.getElementById(id);
let pendingReport = null;
let addressNote = "";

function stateOf(name) {
    const row = state.status.get(name);
    if (!row) {
        return null;
    }
    if (row.status === "Being archived" && String(row.connectionState) === "false") {
        return "Disconnected";
    }
    return row.status;
}

function formatValue(value, egu) {
    if (value === undefined) {
        return "";
    }
    const digits = Math.abs(value) >= 100 ? 1 : Math.abs(value) >= 1 ? 3 : 4;
    return `${value.toFixed(digits)}${egu ? ` ${egu}` : ""}`;
}

// ---- names and search ---------------------------------------------------------------------

const worker = new Worker("js/browse/names-worker.js");
let searchId = 0;
let latestSearch = 0;

// The worker keeps the list of names current by itself; the page is told when it changed.
let namesReady;
const namesLoaded = new Promise((resolve) => {
    namesReady = resolve;
});

function describeIndex(message) {
    if (message.error) {
        return `The PV list could not be refreshed: ${message.error}`;
    }
    if (!message.asOf) {
        return "Loading PV names…";
    }
    const time = new Date(message.asOf).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    if (message.overflow) {
        return `${message.count.toLocaleString()} PVs: the server searches the list. As of ${time}.`;
    }
    return `As of ${time}${message.syncing ? ", checking" : ""}.`;
}

worker.onmessage = (event) => {
    const message = event.data;
    if (message.type === "status") {
        state.count = message.count;
        state.asOf = message.asOf;
        state.overflow = message.overflow;
        $("indexCount").textContent = describeIndex(message);
        if (message.asOf || message.error) {
            namesReady();
        }
        if (message.changed) {
            runSearch();
        }
    } else if (message.type === "result" && message.id === latestSearch) {
        $("searchError").textContent = message.error || "";
        state.results = message.names;
        state.total = message.total;
        state.groups = message.groups || {};
        state.partial = Boolean(message.partial);
        renderFinder();
    }
};

function startNames() {
    worker.postMessage({ type: "init", base: document.baseURI, key: window.location.pathname, indexLimit: LIMITS.indexed });
    document.addEventListener("visibilitychange", () => {
        worker.postMessage({ type: "visibility", visible: !document.hidden });
        if (!document.hidden) {
            refreshStatus(0);
        }
    });
}

// A name was added or removed from this page: do not wait for the next check.
function refreshNames(full) {
    worker.postMessage({ type: "refresh", full: Boolean(full) });
}

function runSearch() {
    searchId += 1;
    latestSearch = searchId;
    worker.postMessage({
        type: "search",
        id: searchId,
        query: state.query,
        mode: state.mode,
        prefix: state.prefix,
        allowed: state.allowed,
        keepOrder: state.reportRanked,
        limit: 50000,
    });
    writeAddress();
}

function renderFinder() {
    const groups = $("groups");
    groups.textContent = "";
    Object.keys(state.groups)
        .sort()
        .slice(0, 24)
        .forEach((key) => {
            const button = node("button", { type: "button", "aria-pressed": String(state.prefix === key) }, key);
            button.append(node("span", { class: "n" }, String(state.groups[key])));
            button.addEventListener("click", () => {
                state.prefix = state.prefix === key ? null : key;
                runSearch();
            });
            groups.append(button);
        });

    $("count").textContent = state.overflow
        ? `${state.total.toLocaleString()}${state.partial ? " or more" : ""} PVs match`
        : `${state.total.toLocaleString()} of ${state.count.toLocaleString()} PVs match`;
    renderResults();
    renderArchiveOffer();
}

async function setReport(key) {
    $("searchError").textContent = "";
    if (!key) {
        state.report = null;
        state.allowed = null;
        state.reportValues = new Map();
        state.reportRanked = false;
        $("reportNote").textContent = "";
        runSearch();
        return;
    }
    const report = REPORTS[key];
    try {
        const rows = await api.reportRows(report.endpoint, report.params);
        state.allowed = rows.map((row) => row.pvName ?? row.name).filter(Boolean);
        state.reportValues = new Map(rows.map((row) => [row.pvName ?? row.name, reportValue(row[report.value])]));
        state.reportRanked = Boolean(report.ranked);
        state.report = key;
        $("reportNote").textContent = report.note;
    } catch (error) {
        $("searchError").textContent = `Could not load this selection: ${error.message}`;
        $("report").value = state.report || "";
        return;
    }
    runSearch();
}

// A windowed list: only the rows in view exist in the document.
function renderResults() {
    const list = $("results");
    const spacer = $("resultsSpacer");
    spacer.style.height = `${state.results.length * rowHeight()}px`;
    const top = list.scrollTop;
    const first = Math.max(0, Math.floor(top / rowHeight()) - 5);
    const last = Math.min(state.results.length, Math.ceil((top + list.clientHeight) / rowHeight()) + 5);
    const rows = $("resultRows");
    rows.textContent = "";
    for (let i = first; i < last; i += 1) {
        const name = state.results[i];
        const selected = state.selected.includes(name);
        const row = node("li", { role: "option", id: `row-${i}`, class: i === state.active ? "active" : null, "aria-selected": String(selected) });
        row.style.transform = `translateY(${i * rowHeight()}px)`;
        row.append(node("span", { class: "tick" }), node("span", { class: "pv" }, name));
        const word = stateOf(name);
        if (state.report && state.reportValues.has(name)) {
            const value = state.reportValues.get(name);
            row.append(node("span", { class: "num report-value", title: value.title || null }, value.text));
        } else if (word && word !== "Being archived") {
            row.append(node("span", { class: `state-word ${word === "Disconnected" ? "warn" : ""}` }, word));
        }
        row.addEventListener("click", () => toggle(name));
        rows.append(row);
    }
    readVisibleStatus(first, last);
}

// The state of the rows in view, read in one call for the rows that have none or an old one. A name that is not
// archived answers "Not being archived", so the list tells which of the names it shows can be plotted.
const rowStatusAt = new Map();
let visibleTimer = 0;
function readVisibleStatus(first, last) {
    window.clearTimeout(visibleTimer);
    visibleTimer = window.setTimeout(async () => {
        if (document.hidden) {
            return;
        }
        const selected = new Set(state.selected);
        const names = state.results
            .slice(first, last)
            .filter((name) => !selected.has(name) && Date.now() - (rowStatusAt.get(name) || 0) > 30000)
            .slice(0, 60);
        if (!names.length) {
            return;
        }
        for (const name of names) {
            rowStatusAt.set(name, Date.now());
        }
        try {
            const rows = await api.pvStatus(names);
            for (const row of rows) {
                state.status.set(row.pvName, row);
            }
            if (state.status.size > 5000) {
                for (const key of Array.from(state.status.keys())) {
                    if (!selected.has(key) && !names.includes(key)) {
                        state.status.delete(key);
                    }
                }
            }
            renderResults();
        } catch (error) {
            // The rows stay without a state; the next scroll asks again.
            for (const name of names) {
                rowStatusAt.delete(name);
            }
        }
    }, 250);
}

// The link to the Archive PVs page is always there and always reads the same; it carries the typed text only when
// the text is one complete PV name, so a name still being typed is never offered as a request.
function renderArchiveOffer() {
    const text = state.query.trim();
    $("archiveLink").href = state.mode === "contains" && PV_NAME.test(text) ? `archive.html#pv=${encodeURIComponent(text)}` : "archive.html";
}

// Keyboard use of the list: the arrow keys move, Space or Enter selects or clears the active row.
function moveInResults(event) {
    const count = state.results.length;
    if (!count) {
        return;
    }
    const list = $("results");
    const page = Math.max(1, Math.floor(list.clientHeight / rowHeight()) - 1);
    const moves = { ArrowDown: 1, ArrowUp: -1, PageDown: page, PageUp: -page };
    if (event.key in moves) {
        state.active = Math.min(count - 1, Math.max(0, state.active + moves[event.key]));
    } else if (event.key === "Home") {
        state.active = 0;
    } else if (event.key === "End") {
        state.active = count - 1;
    } else if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        toggle(state.results[state.active]);
        return;
    } else {
        return;
    }
    event.preventDefault();
    if (state.active * rowHeight() < list.scrollTop) {
        list.scrollTop = state.active * rowHeight();
    } else if ((state.active + 1) * rowHeight() > list.scrollTop + list.clientHeight) {
        list.scrollTop = (state.active + 1) * rowHeight() - list.clientHeight;
    }
    list.setAttribute("aria-activedescendant", `row-${state.active}`);
    renderResults();
}

// ---- selection, status, data ---------------------------------------------------------------

function toggle(name) {
    const index = state.selected.indexOf(name);
    if (index >= 0) {
        state.selected.splice(index, 1);
        if (state.focus === name) {
            state.focus = state.selected[0] || null;
        }
    } else if (state.selected.length < LIMITS.table) {
        state.selected.push(name);
        state.focus = name;
    } else {
        $("limitNote").textContent = `The table holds at most ${LIMITS.table} PVs.`;
    }
    afterSelection();
}

function afterSelection() {
    state.plotted = state.plotted.filter((name) => state.selected.includes(name));
    renderResults();
    renderTable();
    refreshStatus();
    refreshData();
    refreshLatest();
    readDropped();
    // Data already read is not read again, so nothing else would draw the chart for a PV that was only unchecked.
    scheduleRender();
    writeAddress();
}

// The status is read again while the page is visible: soon after an action and while a request is
// unfinished, and at a slow pace otherwise, so a change made elsewhere shows up too.
const STATUS_FAST_MS = 3000;
const STATUS_SLOW_MS = 20000;
const AFTER_ACTION_MS = 30000;
let statusTimer = 0;
let fastUntil = 0;

function refreshStatus(delay = 150) {
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(readStatus, delay);
}

async function readStatus() {
    if (!state.selected.length || document.hidden) {
        return;
    }
    try {
        const rows = await api.pvStatus(state.selected);
        for (const row of rows) {
            state.status.set(row.pvName, row);
        }
        renderTable();
        renderResults();
        readProtocols();
    } catch (error) {
        $("limitNote").textContent = `Could not read the status: ${error.message}`;
    }
    const unfinished = state.selected.some((name) => {
        const word = stateOf(name);
        return !word || PENDING.has(word);
    });
    // With the refresh off the state is read again only while a request is unfinished or after an action.
    if (state.refreshSeconds === 0 && !unfinished && Date.now() >= fastUntil) {
        return;
    }
    refreshStatus(unfinished || Date.now() < fastUntil ? STATUS_FAST_MS : STATUS_SLOW_MS);
}

// Many PVs answer within a few milliseconds of each other; the list and the chart are drawn once per short interval
// instead of once per answer, which keeps the cost of a selection linear in the number of PVs.
let renderTimer = 0;
function scheduleRender() {
    if (renderTimer) {
        return;
    }
    renderTimer = window.setTimeout(() => {
        renderTimer = 0;
        renderTable();
        renderChart();
    }, 60);
}

let dataController = null;
async function refreshData() {
    if (dataController) {
        dataController.abort();
    }
    dataController = new AbortController();
    const { signal } = dataController;
    // One value per ten pixels or so: the bin follows the span of the window, and a short window is read unreduced.
    const to = state.window ? state.window.to : new Date();
    const from = state.window ? state.window.from : new Date(to.getTime() - state.rangeMinutes * 60000);
    const bin = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 1000 / 600));
    const key = state.window ? `${from.getTime()}-${to.getTime()}` : `last-${state.rangeMinutes}`;
    const wanted = state.selected.filter((name) => {
        const cached = state.data.get(name);
        // A fixed window does not age; a window that ends now is read again when its data is older than the Trend interval.
        return !cached || cached.key !== key || (!state.window && Date.now() - cached.loaded > TREND_MIN_MS);
    });
    let next = 0;
    const pump = async () => {
        while (next < wanted.length && !signal.aborted) {
            const name = wanted[next];
            next += 1;
            // One retry covers a request that fails once in transit; the reason of a second failure stays visible.
            for (let attempt = 1; attempt <= 2 && !signal.aborted; attempt += 1) {
                try {
                    const result = await api.series(name, from, to, bin, signal);
                    state.data.set(name, { ...result, key, minutes: state.rangeMinutes, loaded: Date.now(), from, to, bin });
                    break;
                } catch (error) {
                    if (error.name === "AbortError") {
                        break;
                    }
                    if (attempt === 2) {
                        state.data.set(name, { name, egu: "", points: [], key, minutes: state.rangeMinutes, loaded: Date.now(), from, to, bin, failed: true, error: String(error.message || error) });
                    }
                }
            }
            if (!signal.aborted) {
                scheduleRender();
            }
        }
    };
    await Promise.all(Array.from({ length: LIMITS.concurrentRequests }, pump));
}

// ---- refresh --------------------------------------------------------------------------------

function savedRefresh() {
    try {
        const text = window.localStorage.getItem(REFRESH_KEY);
        return text !== null && REFRESH_CHOICES.includes(Number(text)) ? Number(text) : REFRESH_DEFAULT;
    } catch (error) {
        return REFRESH_DEFAULT;
    }
}

function saveRefresh() {
    try {
        window.localStorage.setItem(REFRESH_KEY, String(state.refreshSeconds));
    } catch (error) {
        // The choice is kept for this visit only.
    }
}

/** True while the window of the chart ends now, so that a refresh has something new to read. */
function windowEndsNow() {
    return !state.window || Date.now() - state.window.to.getTime() < 2000;
}

/** The choice of the control, whether it is dim, and the time of the last refresh. */
function renderRefresh() {
    const dim = !windowEndsNow();
    $("refresh").setAttribute("data-dim", String(dim));
    $("refresh").title = dim ? "The window ends earlier than now, so there is nothing new to read." : "";
    for (const button of document.querySelectorAll("#refreshSet button")) {
        button.setAttribute("aria-pressed", String(Number(button.dataset.seconds) === state.refreshSeconds));
        button.disabled = dim;
    }
    $("refreshNow").disabled = dim;
    $("updated").textContent = state.refreshedAt ? `Updated ${new Date(state.refreshedAt).toLocaleTimeString([], { hour12: false })}` : "";
}

let refreshTimer = 0;
/** Plans the next automatic refresh; nothing is planned when it is off, the window is in the past or the tab is hidden. */
function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = 0;
    if (state.refreshSeconds > 0 && windowEndsNow() && !document.hidden) {
        refreshTimer = window.setTimeout(() => {
            refreshPage(false);
            scheduleRefresh();
        }, state.refreshSeconds * 1000);
    }
}

/**
 * Reads again what the page shows: Value and Last event, the lost events, and the Trend and the chart when their data is older
 * than TREND_MIN_MS. now forces the data to be read (the button of the control).
 */
function refreshPage(now) {
    if (now) {
        for (const entry of state.data.values()) {
            entry.loaded = 0;
        }
        refreshStatus(0);
    }
    refreshData();
    refreshLatest();
    readDropped(now);
}

// ---- Value and Last event, protocol and lost events of the rows --------------------------------

let latestController = null;
/**
 * Reads the newest sample at or before the end of the window of every PV of the table in one call. While the window ends
 * now the instant is left out, which the server answers with the newest sample; the end of a window in the past is sent.
 */
async function refreshLatest() {
    if (latestController) {
        latestController.abort();
    }
    if (!state.selected.length) {
        return;
    }
    latestController = new AbortController();
    const { signal } = latestController;
    const names = state.selected.slice();
    try {
        const answer = await api.dataAtTime(names, state.window ? state.window.to : null, signal);
        for (const name of names) {
            state.latest.set(name, answer[name] || null);
        }
        state.refreshedAt = Date.now();
        renderRefresh();
        renderTable();
    } catch (error) {
        if (error.name !== "AbortError") {
            $("limitNote").textContent = `Could not read the values: ${error.message}`;
        }
    }
}

let protocolBusy = false;
/** Reads the settings of the archived PVs of the table that have none yet; the protocol of a PV is among them. */
async function readProtocols() {
    if (protocolBusy) {
        return;
    }
    protocolBusy = true;
    try {
        for (;;) {
            const names = state.selected.filter((name) => !state.typeInfo.has(name) && stateOf(name) && stateOf(name) !== "Not being archived");
            if (!names.length) {
                break;
            }
            await Promise.all(
                names.slice(0, 4).map(async (name) => {
                    try {
                        state.typeInfo.set(name, await api.typeInfo(name));
                    } catch (error) {
                        state.typeInfo.set(name, null);
                    }
                })
            );
            renderTable();
        }
    } finally {
        protocolBusy = false;
    }
}

// The reports list every PV of the appliance, so a PV added to the table is already in what was read a moment ago.
const DROPPED_FRESH_MS = 5000;
let droppedAt = 0;

/** Reads the events dropped of every PV from the three reports of the server, called without a limit; again only after a few seconds unless forced. */
async function readDropped(force) {
    if (document.hidden || (!force && Date.now() - droppedAt < DROPPED_FRESH_MS)) {
        return;
    }
    droppedAt = Date.now();
    try {
        const endpoints = [REPORTS.droppedtime.endpoint, REPORTS.droppedbuffer.endpoint, REPORTS.droppedtype.endpoint];
        const sums = new Map();
        for (const rows of await Promise.all(endpoints.map((endpoint) => api.reportRows(endpoint)))) {
            for (const row of rows) {
                const lost = Number(row.eventsDropped);
                if (lost > 0) {
                    sums.set(row.pvName, (sums.get(row.pvName) || 0) + lost);
                }
            }
        }
        state.dropped = sums;
        renderTable();
    } catch (error) {
        // The mark stays as it was; the next read tries again.
    }
}

// ---- rendering of scan, chart, detail ------------------------------------------------------

/** The address of the analyzer for some PVs, over the window of the chart; empty for no PV. */
function analyzerHref(names) {
    if (!names.length) {
        return "";
    }
    const to = state.window ? state.window.to : new Date();
    const from = state.window ? state.window.from : new Date(to.getTime() - state.rangeMinutes * 60000);
    const query = new URLSearchParams();
    for (const name of names) {
        query.append("pv", name);
    }
    query.set("from", from.toISOString());
    query.set("to", to.toISOString());
    return `analyzer.html?${query}`;
}

function plotCell(name) {
    const on = state.plotted.includes(name);
    const full = !on && state.plotted.length >= LIMITS.chart;
    const box = node("input", {
        type: "checkbox",
        "data-key": "plot",
        "aria-label": `Plot ${name}`,
        title: full ? `At most ${LIMITS.chart} PVs are plotted at a time. Turn another Plot box off first.` : null,
    });
    box.checked = on;
    box.disabled = full;
    box.addEventListener("change", () => setPlot(name, box.checked));
    box.addEventListener("click", (event) => event.stopPropagation());
    return node("td", { class: "plot" }, box);
}

/** Turns the Plot box of a PV on or off; at most LIMITS.chart PVs are plotted. */
function setPlot(name, on) {
    const at = state.plotted.indexOf(name);
    if (on && at < 0 && state.plotted.length < LIMITS.chart) {
        state.plotted.push(name);
    } else if (!on && at >= 0) {
        state.plotted.splice(at, 1);
    }
    renderTable();
    renderChart();
    writeAddress();
}

/** CA or PVA, from the settings of the PV; empty for a PV that is not archived or whose settings are not read yet. */
function protocolCell(name) {
    const info = state.typeInfo.get(name);
    const cell = node("td", { class: "proto" });
    if (info && stateOf(name) !== "Not being archived") {
        cell.append(node("span", { class: "proto-tag" }, String(info.usePVAccess) === "true" ? "PVA" : "CA"));
    }
    return cell;
}

/** The events lost for a PV: the sum of eventsDropped of the three reports. */
function lostOf(name) {
    return state.dropped.get(name) || 0;
}

/** A PV is in its normal state when it is being archived and none of the reports lists it. */
function isNormal(name) {
    const word = stateOf(name);
    return (!word || word === "Being archived") && !lostOf(name);
}

function stateCell(name, shown) {
    const word = stateOf(name);
    const cell = node("td", { class: "state", hidden: shown ? null : "" });
    if (word) {
        cell.append(node("span", { class: word === "Being archived" ? "state-word" : `state-word ${word === "Disconnected" ? "warn" : "paused"}`, title: STATES[word] || "State reported by the archiver." }, word));
    }
    const lost = lostOf(name);
    if (lost) {
        cell.append(node("span", { class: "lost", title: `${lost} events were dropped (wrong time stamp, buffer overflow or type change).` }, `${lost} lost`));
    }
    return cell;
}

/** The value of the newest sample at or before the end of the window, its integer part and the rest in their own columns. */
function valueCell(name) {
    const cell = node("td", { class: "r value" });
    const sample = state.latest.get(name);
    if (sample === undefined) {
        return cell;
    }
    if (sample === null) {
        cell.title = "no sample in 30 days";
        return cell;
    }
    const parts = valueParts(sample.val, sample.meta && sample.meta.DBRType);
    const unit = sample.meta && sample.meta.EGU ? sample.meta.EGU : "";
    const inner = node("div", { class: "v" });
    if (parts.text !== undefined) {
        inner.append(node("span", { class: "vtext" }, parts.text));
    } else {
        inner.append(node("span", { class: "whole" }, parts.whole), node("span", { class: "rest" }, parts.rest));
    }
    if (unit) {
        inner.append(node("span", { class: "unit" }, unit));
    }
    cell.append(inner);
    return cell;
}

/** The date and time of the sample that Value shows, which is the time of the data. */
function lastEventCell(name) {
    const sample = state.latest.get(name);
    const cell = node("td", { class: "r num last" });
    if (sample) {
        cell.textContent = dateTimeText(sample.secs);
        cell.title = instantTitle(sample.secs, sample.nanos);
    } else if (sample === null) {
        cell.title = "no sample in 30 days";
    }
    return cell;
}

/** The standard deviation of the points of the Trend of a PV, as the Summary of the chart computes it. */
function deviationCell(name, shown) {
    const cell = node("td", { class: "r num sdev", hidden: shown ? null : "" });
    const data = state.data.get(name);
    const sample = state.latest.get(name);
    if (shown && data && data.points.length && !(sample && Array.isArray(sample.val))) {
        const values = data.points.map((p) => p.v);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        cell.textContent = formatValue(Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length), data.egu);
    }
    return cell;
}

/** The control of a row that carries the key, for the focus to return to; false when the row or the control is gone. */
function focusControl(name, key) {
    const row = Array.from($("pvTable").querySelectorAll("tbody tr")).find((tr) => tr.dataset.name === name);
    const control = row && (row.querySelector(`[data-key="${key}"]`) || row.querySelector("[data-key]"));
    if (control) {
        control.focus();
        return true;
    }
    return false;
}

function actionButton(label, key, handler) {
    const button = node("button", { type: "button", class: "act", "data-key": key }, label);
    button.addEventListener("click", (event) => {
        event.stopPropagation();
        handler(button);
    });
    return button;
}

/** The actions of a row for the state of its PV, read from getPVStatus; none before the archiver has told the state. */
function actionsCell(name) {
    const cell = node("td", { class: "actions-cell" });
    if (!state.status.get(name)) {
        return cell;
    }
    const word = stateOf(name);
    if (PENDING.has(word)) {
        cell.append(actionButton("Cancel request", "cancel", () => doAction("../bpl/abortArchivingPV", name)));
    } else if (word === "Not being archived") {
        cell.append(node("a", { class: "plain-link", "data-key": "archive", href: `archive.html#pv=${encodeURIComponent(name)}` }, "Archive…"));
    } else {
        const paused = word === "Paused";
        cell.append(actionButton(paused ? "Resume" : "Pause", "pause", () => doAction(paused ? "../bpl/resumeArchivingPV" : "../bpl/pauseArchivingPV", name)));
        const more = actionButton("More", "more", (button) => openRowMenu(name, button));
        more.setAttribute("aria-haspopup", "menu");
        more.setAttribute("aria-expanded", String(menuFor === name));
        cell.append(more);
    }
    return cell;
}

// The More menu is one element of the page, placed under the button of the row it was opened for, so that it survives the
// table being drawn again.
let menuFor = null;

function openRowMenu(name, button) {
    if (menuFor === name) {
        closeRowMenu(true);
        return;
    }
    menuFor = name;
    const menu = $("rowMenu");
    menu.hidden = false;
    const box = button.getBoundingClientRect();
    const left = Math.min(Math.max(8, box.right - menu.offsetWidth), window.innerWidth - menu.offsetWidth - 8);
    menu.style.left = `${left + window.scrollX}px`;
    menu.style.top = `${box.bottom + window.scrollY + 4}px`;
    button.setAttribute("aria-expanded", "true");
    $("menuSampling").focus();
}

/** Closes the More menu; the focus goes back to the button of its row when asked (Esc), and stays where the person clicked otherwise. */
function closeRowMenu(returnFocus) {
    if (menuFor === null) {
        return;
    }
    const name = menuFor;
    menuFor = null;
    $("rowMenu").hidden = true;
    document.querySelectorAll('#pvTable [data-key="more"]').forEach((button) => button.setAttribute("aria-expanded", "false"));
    if (returnFocus) {
        focusControl(name, "more");
    }
}

// The control a window was opened from, so that the focus returns to it when the window closes, although the table was drawn again meanwhile.
let opener = null;

function restoreOpener() {
    if (document.querySelector("dialog[open]") || !opener) {
        return;
    }
    const { name, key } = opener;
    opener = null;
    if (!focusControl(name, key)) {
        $("results").focus();
    }
}

/** A click on the dark backdrop, which is the dialog element itself outside its box, closes the window; Esc closes it natively. */
function closeOnBackdrop(dialog) {
    dialog.addEventListener("click", (event) => {
        const box = dialog.getBoundingClientRect();
        const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
        if (event.target === dialog && outside) {
            dialog.close();
        }
    });
    dialog.addEventListener("close", restoreOpener);
}

function openMaintenance(name) {
    $("maintenanceName").textContent = name;
    const hand = (id, handler) => {
        $(id).onclick = () => {
            $("maintenanceDialog").close();
            handler(name);
        };
    };
    hand("maintenanceRename", openRename);
    hand("maintenanceType", openChangeType);
    hand("maintenanceConsolidate", openConsolidate);
    $("maintenanceDialog").showModal();
}

/** The Details button of a row; a PV that is not archived has nothing to show. */
function detailsCell(name) {
    const cell = node("td", { class: "details-cell" });
    if (state.status.get(name) && stateOf(name) !== "Not being archived") {
        cell.append(actionButton("Details", "details", () => openDetails(name)));
    }
    return cell;
}

// The PV whose Details window is open; an answer for another PV, read before this one was opened, is dropped.
let detailsFor = null;

/** Reads what the three calls hold about a PV and shows it in groups in the Details window. */
async function openDetails(name) {
    detailsFor = name;
    opener = { name, key: "details" };
    $("detailsName").textContent = name;
    $("detailsState").textContent = stateOf(name) || "";
    $("detailsBody").textContent = "Reading…";
    $("detailsDialog").showModal();
    try {
        const [statusRows, typeInfo, rows] = await Promise.all([api.pvStatus([name]), api.typeInfo(name), api.details(name)]);
        if (detailsFor !== name) {
            return;
        }
        const named = new Map();
        for (const entry of rows) {
            if (!named.has(entry.name)) {
                named.set(entry.name, entry.value);
            }
        }
        $("detailsBody").replaceChildren(buildDetails({ status: statusRows[0] || {}, info: typeInfo, details: named }));
    } catch (error) {
        if (detailsFor === name) {
            $("detailsBody").textContent = `The details could not be read: ${error.message}`;
        }
    }
}

function renderTable() {
    // The focus stays on the control it was on when the rows are drawn again.
    const active = document.activeElement;
    const home = active && active.closest ? active.closest("#pvTable tbody tr[data-name]") : null;
    const restore = home ? { name: home.dataset.name, key: active.dataset ? active.dataset.key : undefined, row: active === home } : null;
    $("bulk").hidden = !state.selected.length;
    const all = analyzerHref(state.selected);
    $("analyzerAll").hidden = !all;
    if (all) {
        $("analyzerAll").setAttribute("href", all);
    }
    $("selN").textContent = String(state.selected.length);
    $("limScan").textContent = String(state.selected.length);
    $("limScanMax").textContent = String(LIMITS.table);
    $("limChart").textContent = String(state.plotted.length);
    $("limChartMax").textContent = String(LIMITS.chart);
    // The State column is there while a PV is not in its normal state; the Std dev column while the band of the chart is on.
    const showState = state.selected.some((name) => !isNormal(name));
    const showDeviation = Boolean(chart && chart.options.band);
    $("pvTable").querySelector("th.statecol").hidden = !showState;
    $("pvTable").querySelector("th.sdcol").hidden = !showDeviation;
    // The widest whole part and rest of the values set the two columns of Value, so that every row has its decimal point in the same place.
    let whole = 3;
    let rest = 3;
    let unit = 0;
    for (const name of state.selected) {
        const sample = state.latest.get(name);
        if (sample) {
            unit = Math.max(unit, sample.meta && sample.meta.EGU ? sample.meta.EGU.length : 0);
            const parts = valueParts(sample.val, sample.meta && sample.meta.DBRType);
            if (parts.text !== undefined) {
                rest = Math.max(rest, parts.text.length - whole);
            } else {
                whole = Math.max(whole, parts.whole.length);
                rest = Math.max(rest, parts.rest.length);
            }
        }
    }
    $("pvTable").style.setProperty("--whole", `${whole}ch`);
    $("pvTable").style.setProperty("--rest", `${rest}ch`);
    $("pvTable").style.setProperty("--unit", `${unit}ch`);
    const body = $("pvTable").querySelector("tbody");
    body.textContent = "";
    if (!state.selected.length) {
        body.append(node("tr", null, node("td", { colspan: "10", class: "empty" }, "Pick PVs in the list to add them to this table.")));
    }
    for (const name of state.selected) {
        const data = state.data.get(name);
        const row = node("tr", { "data-name": name, "data-focus": String(state.focus === name), tabindex: "0" });
        row.append(plotCell(name));
        row.append(node("td", { class: "pv" }, name));
        row.append(protocolCell(name));
        row.append(stateCell(name, showState));
        const trend = node("td", { class: "spark-cell" });
        // An array PV has no Trend line: its Value reads "array of N".
        const sample = state.latest.get(name);
        if (data && data.points.length && !(sample && Array.isArray(sample.val))) {
            trend.append(sparkline(data.points, data.points.some((p) => p.s > 0)));
        } else if (data && data.failed) {
            trend.title = data.error || "";
        }
        row.append(trend);
        row.append(valueCell(name));
        row.append(lastEventCell(name));
        row.append(deviationCell(name, showDeviation));
        row.append(actionsCell(name));
        row.append(detailsCell(name));
        const focusRow = () => {
            state.focus = name;
            renderTable();
            renderChart();
        };
        row.addEventListener("click", focusRow);
        row.addEventListener("keydown", (event) => {
            if (event.target === row && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                focusRow();
            }
        });
        body.append(row);
    }
    if (restore) {
        if (restore.key) {
            focusControl(restore.name, restore.key);
        } else if (restore.row) {
            const again = Array.from(body.querySelectorAll("tr")).find((tr) => tr.dataset.name === restore.name);
            if (again) {
                again.focus();
            }
        }
    }
}

function chartList() {
    // The PVs whose Plot box is on and that have samples in the window; the PVs of every unit are drawn, each unit on an axis of its own.
    return { list: state.plotted.map((name) => state.data.get(name)).filter((d) => d && d.points.length), over: 0 };
}

// The card of how to read the chart, which the chart widget shows beside its heading.
const HELP_PAGE = "help.html#browse";
function chartCard() {
    return [
        "Reading the chart",
        [
            ["Plot boxes", `The Plot box of a row in the table draws that PV here. At most ${LIMITS.chart} PVs are drawn at a time; when ${LIMITS.chart} are on, the other boxes are disabled until one is turned off.`],
            ["Ranges", "The line above the chart holds the time window and the value range of each axis; its information control explains them."],
            [
                "Values",
                `A window longer than ${BIN_FREE_MINUTES} minutes shows one point per interval, the mean of its samples; an interval ` +
                    `without a sample has no point. A window of ${BIN_FREE_MINUTES} minutes or less shows the stored samples.`,
            ],
        ],
        null,
        HELP_PAGE,
    ];
}
// What each search mode matches; every mode ignores case. The hint under Find names the chosen mode in one line.
const MODE_HINTS = {
    contains: "Words in any order, case ignored",
    glob: "The whole name; * is any characters, ? is one",
    regex: "Any part of the name; ^ and $ anchor it",
};
const MODES_CARD = [
    "Search modes",
    [
        ["Contains", "Every word you type must appear in the name, in any order and in any place. The text bpm c02 x finds SR:BPM:C02:X and BPM:X:C02."],
        ["Glob", "The whole name must match. * stands for any characters and ? for exactly one, so SR:BPM:*:X finds every X of SR:BPM and SR:BPM:0?:X finds SR:BPM:01:X to SR:BPM:09:X."],
        ["Regex", "A regular expression that may match any part of the name; ^ anchors it to the start and $ to the end, so ^SR:BPM:0[1-4]:X$ finds the first four X."],
    ],
    null,
    HELP_PAGE,
];
function zoomTo(from, to) {
    state.window = { from, to };
    state.data.clear();
    refreshData();
    refreshLatest();
    writeAddress();
    renderRefresh();
    scheduleRefresh();
}

/** Returns from a chosen time window to the range of the buttons; nothing changes when no window was chosen. */
function resetWindow() {
    if (!state.window) {
        return;
    }
    state.window = null;
    state.data.clear();
    refreshData();
    refreshLatest();
    writeAddress();
    renderRefresh();
    scheduleRefresh();
    renderChart();
}

/** Moves the window by half of its span, earlier or later; it never reaches into the future. */
function panBy(direction) {
    // Before a window is chosen the window is the range of the buttons, ending now.
    const current = state.window || { from: new Date(Date.now() - state.rangeMinutes * 60000), to: new Date() };
    const span = current.to.getTime() - current.from.getTime();
    let to = current.to.getTime() + (direction * span) / 2;
    const now = Date.now();
    if (to > now) {
        to = now;
    }
    state.window = { from: new Date(to - span), to: new Date(to) };
    state.data.clear();
    refreshData();
    refreshLatest();
    writeAddress();
    renderRefresh();
    scheduleRefresh();
}

function renderChart() {
    const { list } = chartList();
    $("limChart").textContent = String(state.plotted.length);
    $("limChartMax").textContent = String(LIMITS.chart);
    if (!list.length) {
        const answered = state.plotted.length > 0 && state.plotted.every((name) => state.data.has(name));
        chart.message(
            !state.selected.length
                ? "Pick PVs in the list, then turn on their Plot box to draw them here."
                : !state.plotted.length
                  ? "Turn on the Plot box of a PV in the table to draw it here."
                  : answered
                    ? "No samples in this time range. A PV that did not change has none; try a wider range."
                    : "Loading samples…",
        );
        renderStats([]);
        renderPlots([]);
        return;
    }
    const first = list[0];
    const analyzer = new URLSearchParams();
    for (const d of list) {
        analyzer.append("pv", d.name);
    }
    analyzer.set("from", first.from.toISOString());
    analyzer.set("to", first.to.toISOString());
    chart.draw({
        series: list.map((d) => ({ name: d.name, egu: d.egu, points: d.points, focus: d.name === state.focus })),
        from: first.from,
        to: first.to,
        gapMs: Infinity,
        windowChosen: Boolean(state.window),
        canPanLater: Boolean(state.window) && Date.now() - state.window.to.getTime() >= 2000,
        analyzerHref: `analyzer.html?${analyzer}`,
    });
    renderStats(list);
    renderPlots(list);
}

/** The distribution of the focused PV and the scatter of the first two PVs of the chart. */
function renderPlots(list) {
    const focus = list.find((d) => d.name === state.focus) || list[0];
    if (!focus) {
        $("hist").textContent = "";
        $("histNote").textContent = "";
        $("scatter").textContent = "";
        $("scatterNote").textContent = "";
        return;
    }
    const averaged = focus.bin > 1 ? `the ${focus.bin} s averages of the chart` : "the samples of the chart";
    const mean = drawHistogram($("hist"), { values: focus.points.map((p) => p.v), egu: focus.egu });
    $("histNote").textContent = mean === null ? "" : `${focus.name}: ${averaged}; the line is the mean, ${formatValue(mean, focus.egu)}.`;
    if (list.length < 2) {
        $("scatter").textContent = "Select a second PV of the same unit to compare two PVs.";
        $("scatterNote").textContent = "";
        return;
    }
    const other = list.find((d) => d !== focus && d.egu === focus.egu);
    if (!other) {
        $("scatter").textContent = "Select a second PV of the same unit to compare two PVs.";
        $("scatterNote").textContent = "";
        return;
    }
    const correlation = drawScatter($("scatter"), { x: focus, y: other });
    $("scatterNote").textContent = correlation === null ? "" : `${focus.name} across, ${other.name} up. Correlation ${correlation.toFixed(2)}.`;
}

function renderStats(list) {
    const body = $("stats").querySelector("tbody");
    body.textContent = "";
    for (const d of list) {
        const values = d.points.map((p) => p.v);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const deviation = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
        const cells = [d.name, String(values.length), formatValue(Math.min(...values), ""), formatValue(mean, ""), formatValue(Math.max(...values), ""), formatValue(deviation, ""), formatValue(values[values.length - 1], "")];
        body.append(node("tr", null, ...cells.map((text, i) => node("td", { class: i === 0 ? "pv" : "num" }, text))));
    }
}

async function doAction(kind, name, params) {
    fastUntil = Date.now() + AFTER_ACTION_MS;
    try {
        await api.pvAction(kind, name, params);
        state.status.delete(name);
        refreshStatus();
        return true;
    } catch (error) {
        $("limitNote").textContent = `${kind.split("/").pop()} failed for ${name}: ${error.message}`;
        // An action can change part of the state before it fails; show what the archiver holds now.
        state.status.delete(name);
        refreshStatus();
        return false;
    }
}

// ---- dialogs -------------------------------------------------------------------------------

function openStopDialog(name) {
    const dialog = $("stopDialog");
    $("stopName").textContent = name;
    $("stopDeleteData").checked = false;
    $("stopForm").onsubmit = async (event) => {
        event.preventDefault();
        dialog.close();
        // The archiver removes only a paused PV, so a running one is paused first.
        const paused = stateOf(name) === "Paused" || (await doAction("../bpl/pauseArchivingPV", name));
        if (!paused || !(await doAction("../bpl/deletePV", name, { deleteData: String($("stopDeleteData").checked) }))) {
            return;
        }
        state.selected = state.selected.filter((n) => n !== name);
        state.focus = state.selected[0] || null;
        afterSelection();
        refreshNames(true);
    };
    dialog.showModal();
}

// ---- maintenance of one PV and actions on several --------------------------------------------

const TYPES = [
    ["DBR_SCALAR_STRING", "string"],
    ["DBR_SCALAR_SHORT", "short"],
    ["DBR_SCALAR_FLOAT", "float"],
    ["DBR_SCALAR_ENUM", "enum"],
    ["DBR_SCALAR_BYTE", "byte"],
    ["DBR_SCALAR_INT", "int"],
    ["DBR_SCALAR_DOUBLE", "double"],
    ["DBR_WAVEFORM_STRING", "waveform of string"],
    ["DBR_WAVEFORM_SHORT", "waveform of short"],
    ["DBR_WAVEFORM_FLOAT", "waveform of float"],
    ["DBR_WAVEFORM_ENUM", "waveform of enum"],
    ["DBR_WAVEFORM_BYTE", "waveform of byte"],
    ["DBR_WAVEFORM_INT", "waveform of int"],
    ["DBR_WAVEFORM_DOUBLE", "waveform of double"],
];

function say(text) {
    $("actionNote").textContent = text;
}

/**
 * One dialog serves every maintenance operation. config: {title, name, text, fields: [{id, label, options | type,
 * value, min, step}], ack, submit, danger, run(values) -> message}. run throws to refuse; its message is shown
 * under the list on success.
 */
function openMaintain(config) {
    const dialog = $("maintainDialog");
    $("maintainTitle").textContent = config.title;
    $("maintainName").textContent = config.name || "";
    $("maintainText").textContent = config.text || "";
    $("maintainError").textContent = "";
    const fields = $("maintainFields");
    fields.textContent = "";
    for (const field of config.fields || []) {
        const id = `maintain-${field.id}`;
        let control;
        if (field.options) {
            control = node("select", { id });
            for (const [value, text] of field.options) {
                control.append(node("option", { value }, text));
            }
            control.value = field.value ?? field.options[0][0];
        } else {
            control = node("input", {
                id,
                type: field.type || "text",
                value: field.value ?? "",
                min: field.min,
                step: field.step,
                required: "required",
                autocomplete: "off",
                spellcheck: "false",
            });
        }
        fields.append(node("label", { for: id }, field.label), control);
    }
    $("maintainAckRow").hidden = !config.ack;
    $("maintainAck").checked = false;
    $("maintainAck").required = Boolean(config.ack);
    $("maintainAckText").textContent = config.ack || "";
    const submit = $("maintainSubmit");
    submit.textContent = config.submit || "Apply";
    submit.className = config.danger ? "danger" : "";
    $("maintainForm").onsubmit = async (event) => {
        event.preventDefault();
        $("maintainError").textContent = "";
        const values = {};
        for (const field of config.fields || []) {
            values[field.id] = document.getElementById(`maintain-${field.id}`).value.trim();
        }
        submit.disabled = true;
        try {
            const message = await config.run(values);
            dialog.close();
            say(message || "");
        } catch (error) {
            $("maintainError").textContent = error.message;
        } finally {
            submit.disabled = false;
        }
    };
    dialog.showModal();
}

/** Pauses a running PV before an operation that needs it; says whether it did. */
async function pauseFor(name) {
    if (stateOf(name) === "Paused") {
        return false;
    }
    await api.pvAction("../bpl/pauseArchivingPV", name);
    return true;
}

/** Runs an operation that needs a paused PV. When it fails after the pause, the message says the PV stays paused. */
async function whilePaused(name, operation) {
    const didPause = await pauseFor(name);
    try {
        return await operation();
    } catch (error) {
        afterOperation(name);
        throw new Error(didPause ? `${error.message} The PV was paused for this and is still paused: resume it if you stop here.` : error.message);
    }
}

function afterOperation(name) {
    fastUntil = Date.now() + AFTER_ACTION_MS;
    state.status.delete(name);
    refreshStatus();
}

async function openChangeSampling(name) {
    let info;
    try {
        info = await api.typeInfo(name);
    } catch (error) {
        say(`The settings of ${name} could not be read: ${error.message}`);
        return;
    }
    openMaintain({
        title: "Change sampling",
        name,
        text: "The new method and period apply at once to a running PV. The stored data does not change.",
        fields: [
            { id: "method", label: "Sampling method", options: [["MONITOR", "Monitor: store each change"], ["SCAN", "Scan: store at a fixed period"]], value: info.samplingMethod },
            { id: "period", label: "Sampling period in seconds", type: "number", min: String(state.minimumSamplingPeriod), step: "any", value: info.samplingPeriod },
        ],
        submit: "Change",
        run: async (values) => {
            if (Number(values.period) < state.minimumSamplingPeriod) {
                throw new Error(`The period must be at least ${state.minimumSamplingPeriod} s.`);
            }
            await api.operate("../bpl/changeArchivalParameters", { pv: name, samplingperiod: values.period, samplingmethod: values.method });
            afterOperation(name);
            return `${name} is sampled by ${values.method} with a period of ${values.period} s.`;
        },
    });
}

function openRename(name) {
    openMaintain({
        title: "Rename",
        name,
        text: "The settings and the data are copied to the new name. The PV is paused, and both names stay paused. Check the data of the new name, resume it, and then stop the old one.",
        fields: [{ id: "newname", label: "New name", value: name }],
        submit: "Rename",
        run: async (values) => {
            if (!PV_NAME.test(values.newname) || values.newname === name) {
                throw new Error("Give a different name made of letters, digits and : _ - + [ ] ; / , # { } ^ < >, with an optional .FIELD.");
            }
            await whilePaused(name, () => api.operate("../bpl/renamePV", { pv: name, newname: values.newname }));
            state.selected = state.selected.map((pv) => (pv === name ? values.newname : pv));
            state.plotted = state.plotted.map((pv) => (pv === name ? values.newname : pv));
            state.focus = values.newname;
            state.status.delete(name);
            afterSelection();
            refreshNames(true);
            return `${values.newname} holds the data of ${name}. Both are paused: check the new one, resume it, then stop ${name}.`;
        },
    });
}

function openChangeType(name) {
    openMaintain({
        title: "Change the type",
        name,
        text: "The stored data of every store is converted to the new type, so it is changed in place and cannot be undone. The PV is paused first and stays paused. Consolidate the data into one store first for the best result.",
        fields: [{ id: "newtype", label: "New type", options: TYPES }],
        ack: "I have a backup of the data of this PV.",
        submit: "Change the type",
        danger: true,
        run: async (values) => {
            await whilePaused(name, () => api.operate("../bpl/changeTypeForPV", { pv: name, newtype: values.newtype }));
            afterOperation(name);
            return `${name} is stored as ${values.newtype}. It is paused: resume it when the data is checked.`;
        },
    });
}

async function openConsolidate(name) {
    let stores;
    try {
        const info = await api.typeInfo(name);
        stores = (info.dataStores || []).map((url) => /name=([A-Za-z0-9_]+)/.exec(url)).filter(Boolean).map((match) => match[1]);
    } catch (error) {
        say(`The settings of ${name} could not be read: ${error.message}`);
        return;
    }
    if (!stores.length) {
        say(`${name} has no store to consolidate into.`);
        return;
    }
    openMaintain({
        title: "Consolidate the data",
        name,
        text: "The data of the earlier stores is moved up to the chosen store, so one store holds it. The PV is paused first and stays paused.",
        fields: [{ id: "storage", label: "Consolidate into", options: stores.map((store) => [store, store]), value: stores[stores.length - 1] }],
        submit: "Consolidate",
        run: async (values) => {
            await whilePaused(name, () => api.operate("../bpl/consolidateDataForPV", { pv: name, storage: values.storage }));
            afterOperation(name);
            return `The data of ${name} was consolidated into ${values.storage}. It is paused: resume it when you are ready.`;
        },
    });
}

/** One sentence for the per-PV answers of a bulk call. A PV that was already in the wanted state is no failure. */
function summarizeBulk(rows, verb) {
    const unchanged = (row) => /already paused|is not paused/i.test(String(row.validation || ""));
    const done = rows.filter((row) => row.status === "ok").length;
    const same = rows.filter(unchanged).length;
    const failed = rows.filter((row) => row.status !== "ok" && !unchanged(row));
    const parts = [`${done} PV${done === 1 ? "" : "s"} ${verb}`];
    if (same) {
        parts.push(`${same} already in that state`);
    }
    if (failed.length) {
        const reason = failed[0].validation || failed[0].engine_validation || failed[0].etl_validation || "no reason given";
        parts.push(`${failed.length} failed (first: ${failed[0].pvName}: ${reason})`);
    }
    return `${parts.join(", ")}.`;
}

function bulkAction(kind) {
    const names = state.selected.slice();
    const count = names.length;
    const plural = `${count} PV${count === 1 ? "" : "s"}`;
    if (kind === "pause" || kind === "resume") {
        openMaintain({
            title: `${kind === "pause" ? "Pause" : "Resume"} ${plural}`,
            name: count > 3 ? `${names.slice(0, 3).join(", ")} and ${count - 3} more` : names.join(", "),
            text: kind === "pause" ? "The archiver stops sampling these PVs and keeps their data." : "The archiver samples these PVs again.",
            submit: kind === "pause" ? "Pause" : "Resume",
            run: async () => {
                const rows = await api.bulk(kind === "pause" ? "../bpl/pauseArchivingPV" : "../bpl/resumeArchivingPV", names);
                state.status.clear();
                afterSelection();
                return summarizeBulk(rows, kind === "pause" ? "paused" : "resumed");
            },
        });
        return;
    }
    openMaintain({
        title: `Stop archiving ${plural}`,
        name: count > 3 ? `${names.slice(0, 3).join(", ")} and ${count - 3} more` : names.join(", "),
        text: "The PVs are paused and then removed from the archiver. The stored data stays unless you also delete it.",
        fields: [{ id: "data", label: "Stored data", options: [["false", "Keep the stored data"], ["true", "Delete the stored data"]] }],
        submit: "Stop archiving",
        danger: true,
        run: async (values) => {
            await api.bulk("../bpl/pauseArchivingPV", names);
            let rows = await api.bulk("../bpl/deletePV", names, { deleteData: values.data });
            // deletePV answers one result for all the PVs, without their names: its status tells whether they were removed.
            if (rows.length === 1 && !rows[0].pvName) {
                rows = names.map((pvName) => ({ ...rows[0], pvName }));
            }
            const removed = new Set(rows.filter((row) => row.status === "ok").map((row) => row.pvName));
            state.selected = state.selected.filter((pv) => !removed.has(pv));
            state.focus = state.selected[0] || null;
            afterSelection();
            refreshNames(true);
            return summarizeBulk(rows, "removed");
        },
    });
}

// ---- address state -------------------------------------------------------------------------

function writeAddress() {
    const parameters = new URLSearchParams();
    if (state.query) {
        parameters.set("q", state.query);
    }
    if (state.mode !== "contains") {
        parameters.set("mode", state.mode);
    }
    if (state.rangeMinutes !== 60) {
        parameters.set("range", String(state.rangeMinutes));
    }
    if (state.report) {
        parameters.set("report", state.report);
    }
    if (state.window) {
        parameters.set("from", String(state.window.from.getTime()));
        parameters.set("to", String(state.window.to.getTime()));
    }
    for (const name of state.selected) {
        parameters.append("pv", name);
    }
    for (const name of state.plotted) {
        parameters.append("plot", name);
    }
    const text = parameters.toString();
    window.history.replaceState(null, "", text ? `#${text}` : window.location.pathname);
}

function readAddress() {
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    state.query = parameters.get("q") || "";
    state.mode = parameters.get("mode") || "contains";
    state.rangeMinutes = Number(parameters.get("range")) || 60;
    const from = Number(parameters.get("from"));
    const to = Number(parameters.get("to"));
    state.window = from > 0 && to > from ? { from: new Date(from), to: new Date(to) } : null;
    const named = parameters.getAll("pv");
    state.selected = named.slice(0, LIMITS.table);
    if (named.length > LIMITS.table) {
        addressNote = `The address names ${named.length} PVs; the table holds at most ${LIMITS.table}, so the first ${LIMITS.table} are shown.`;
    }
    state.plotted = [...new Set(parameters.getAll("plot"))].filter((name) => state.selected.includes(name)).slice(0, LIMITS.chart);
    state.focus = state.selected[0] || null;
    $("q").value = state.query;
    pendingReport = REPORTS[parameters.get("report")] ? parameters.get("report") : null;
}

// ---- start ---------------------------------------------------------------------------------

function wire() {
    let debounce = 0;
    $("q").addEventListener("input", (event) => {
        state.query = event.target.value;
        window.clearTimeout(debounce);
        debounce = window.setTimeout(runSearch, 150);
    });
    $("modesInfo").append(infoButton(...MODES_CARD));
    $("queryHint").textContent = MODE_HINTS[state.mode] || MODE_HINTS.contains;
    document.querySelectorAll("#modes button").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
        button.addEventListener("click", () => {
            state.mode = button.dataset.mode;
            $("queryHint").textContent = MODE_HINTS[state.mode];
            document.querySelectorAll("#modes button").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
            runSearch();
        });
    });
    document.querySelectorAll("#ranges button").forEach((button) => {
        button.setAttribute("aria-pressed", String(Number(button.dataset.minutes) === state.rangeMinutes));
        button.addEventListener("click", () => {
            state.rangeMinutes = Number(button.dataset.minutes);
            state.window = null;
            document.querySelectorAll("#ranges button").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
            state.data.clear();
            refreshData();
            refreshLatest();
            writeAddress();
            renderRefresh();
            scheduleRefresh();
        });
    });
    document.querySelectorAll("#refreshSet button").forEach((button) => {
        button.addEventListener("click", () => {
            state.refreshSeconds = Number(button.dataset.seconds);
            saveRefresh();
            renderRefresh();
            scheduleRefresh();
        });
    });
    $("refreshNow").addEventListener("click", () => refreshPage(true));
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && state.refreshSeconds > 0 && windowEndsNow()) {
            refreshPage(false);
        }
        scheduleRefresh();
    });
    $("report").addEventListener("change", (event) => setReport(event.target.value));
    $("results").addEventListener("scroll", renderResults);
    $("results").addEventListener("keydown", moveInResults);
    $("results").addEventListener("focus", () => {
        $("results").setAttribute("aria-activedescendant", `row-${state.active}`);
    });
    chart = createChart($("chartHost"), {
        id: "browse",
        title: "Inspect",
        dialogTitle: "Chart",
        help: chartCard(),
        helpHref: HELP_PAGE,
        legend: true,
        onZoom: zoomTo,
        onPan: panBy,
        onReset: resetWindow,
        onOptionsChange: () => renderTable(),
    });
    $("bulkPause").addEventListener("click", () => bulkAction("pause"));
    $("bulkResume").addEventListener("click", () => bulkAction("resume"));
    $("bulkStop").addEventListener("click", () => bulkAction("stop"));
    $("maintainCancel").addEventListener("click", () => $("maintainDialog").close());
    $("stopCancel").addEventListener("click", () => $("stopDialog").close());
    $("maintenanceClose").addEventListener("click", () => $("maintenanceDialog").close());
    $("detailsClose").addEventListener("click", () => $("detailsDialog").close());
    for (const id of ["maintainDialog", "stopDialog", "maintenanceDialog", "detailsDialog"]) {
        closeOnBackdrop($(id));
    }
    // The More menu: its items open the windows of the row, Esc closes it and returns to its button, a click outside closes it.
    const fromMenu = (open) => () => {
        const name = menuFor;
        closeRowMenu(false);
        opener = { name, key: "more" };
        open(name);
    };
    $("menuSampling").addEventListener("click", fromMenu(openChangeSampling));
    $("menuMaintenance").addEventListener("click", fromMenu(openMaintenance));
    $("menuStop").addEventListener("click", fromMenu(openStopDialog));
    $("rowMenu").addEventListener("keydown", (event) => {
        const items = Array.from($("rowMenu").querySelectorAll("button"));
        const at = items.indexOf(document.activeElement);
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            closeRowMenu(true);
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            items[(at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
        } else if (event.key === "Tab") {
            closeRowMenu(false);
        }
    });
    document.addEventListener("click", (event) => {
        if (menuFor !== null && !$("rowMenu").contains(event.target) && !event.target.closest('[data-key="more"]')) {
            closeRowMenu(false);
        }
    });
    window.addEventListener("resize", () => closeRowMenu(false));
    document.querySelector(".scroll").addEventListener("scroll", () => closeRowMenu(false));
    let resize = 0;
    window.addEventListener("resize", () => {
        window.clearTimeout(resize);
        resize = window.setTimeout(() => {
            renderChart();
            renderResults();
        }, 120);
    });
}

async function readMinimumSamplingPeriod() {
    try {
        const value = Number((await api.applianceProperties()).minimum_sampling_period);
        if (Number.isFinite(value) && value > 0) {
            state.minimumSamplingPeriod = value;
        }
    } catch (error) {
        // The default stays.
    }
}

readAddress();
$("limitNote").textContent = addressNote;
wire();
renderRefresh();
scheduleRefresh();
renderFinder();
renderTable();
renderChart();
readMinimumSamplingPeriod();
startNames();
namesLoaded.then(async () => {
    if (pendingReport) {
        $("report").value = pendingReport;
        await setReport(pendingReport);
    }
    if (state.selected.length) {
        afterSelection();
    }
});
