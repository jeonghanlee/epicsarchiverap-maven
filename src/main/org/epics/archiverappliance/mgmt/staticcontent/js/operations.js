// The Operations page: for the person who looks after the appliance. Each section has a card that says when its
// numbers are an attention or a problem and what to do; the judgements are made in system/judge.js and the thresholds
// are listed at the end of the page.
import { createChart } from "../comm/js/aa/chart.js";
import { infoButton } from "../comm/js/aa/card.js";
import { node } from "../comm/js/aa/dom.js";
import { appliances, get, number, pauseResume, settled } from "./system/api.js";
import {
    DROPPED_REPORTS,
    THRESHOLDS,
    TIER_NAMES,
    daysText,
    etlTiers,
    heapFloor,
    judgeEtl,
    judgeStorage,
    judgeWrite,
    measureMap,
    prefixOf,
    groupByHost,
} from "./system/judge.js";
import { GROUP_LIMIT, LEAF_LIMIT, drawUsage, usageGroups } from "./system/treemap.js";
import { HEAP_CARD, chooseAppliance, statusNode, timeText } from "./system/view.js";

const $ = (id) => document.getElementById(id);
const REFRESH_MS = 30000;
const USAGE_REFRESH_MS = 300000;
// The reports list at most this many PVs of each appliance; without a limit they list 100.
const USAGE_PV_LIMIT = "100000";
const LIST_LIMIT = 200;
const openGroups = new Set();
let list = [];
let current = null;
let latest = null;
let timer = 0;

// ---- the cards of the sections ---------------------------------------------------------------------

const HELP = "help.html#system";
// The thresholds in words, so that a card never types a number the judgement holds.
const T = THRESHOLDS;
const HOURS = T.disconnectedSeconds / 3600;
const HOURS_TEXT = HOURS === 1 ? "an hour" : `${HOURS} hours`;
const CARDS = [
    [
        "samplesHeading",
        "Samples: are they coming in?",
        [
            ["In short", `Every archived PV should be connected to its IOC; a PV disconnected for more than ${HOURS_TEXT} is a finding.`],
            ["What it shows", "How many PVs are archived, connected and paused, the PVs that lost their connection most often, and the disconnected PVs grouped by host."],
            ["Normal", `Every PV is connected, or a loss is shorter than ${HOURS_TEXT}, which is often a restart.`],
            ["Attention", `A PV has been disconnected for more than ${HOURS_TEXT}. No samples are stored for it.`],
            ["Problem", "No PV is connected. PVs that were never connected, and PVs that lose their connection again and again, are listed but not judged."],
            ["What to do", "Find the host in the list below and check its IOC, or pause the PVs that no longer exist."],
        ],
    ],
    [
        "hostsHeading",
        "Disconnected PVs by host: which IOC is down?",
        [
            ["In short", "PVs of one host that lost their connection at the same time are one group, which is usually one IOC."],
            ["Groups", `PVs of one host that lost their connection within ${T.lossWindowSeconds} seconds of each other are one group.`],
            ["The host", "The host the Channel Access connection came from; the appliance reports no IOC name, and a PV Access PV has no host."],
            ["Partly listed", "A host listed with only some of its PVs may still be running: its other PVs are connected."],
            ["What to do", "PVs lists the group, Open in Browse PVs selects them on that page, and Pause these… pauses the PVs that no longer exist."],
        ],
    ],
    [
        "droppedHeading",
        "Samples lost: is data missing?",
        [
            ["In short", "A dropped sample is one the engine received and then discarded. It is lost data, and each cause has its own remedy."],
            ["What it shows", "Four reports: the PVs with samples dropped for a wrong time stamp, by buffer overflow and by a type change, and the slow PVs among them that lost more than they sent. The server calls a sample an event."],
            ["Normal", "No PV is in any report."],
            ["Problem", "Any PV in a report. The stored data of that PV has holes."],
            [
                "What to do",
                "Wrong time stamp: fix the clock of the IOC. " +
                    "Buffer overflow: the record posts faster than the rate measured at the archive request; Change sampling with a shorter period rebuilds its buffer. " +
                    "Type change: the engine pauses the PV. In Maintenance, change the type to the new one and resume. " +
                    "From a number to a string or a waveform the change fails; then stop archiving the PV, delete its data and archive it again.",
            ],
        ],
    ],
    [
        "writeHeading",
        "Write path: does the engine keep up?",
        [
            ["In short", "The engine writes the samples of each write period to the short term store, and the writing must take less than the period."],
            ["What it shows", "The share of the period the writing takes, the time it took, the jobs waiting, the incoming rate against the rate this disk sustained when the engine started, and the fastest PVs."],
            ["Normal", `Below ${T.writeAttentionPercent} % of the period.`],
            ["Attention", `${T.writeAttentionPercent} % or more: the writer needs more than half of its period.`],
            ["Problem", `${T.writeProblemPercent} %: the writer needs all of its period, and samples are lost.`],
            ["What to do", "Check the disk of the short term store, slow the fastest PVs with Change sampling, or add an appliance. The write delay a buffer absorbs is a setting described in the manual; ask the administrator."],
        ],
    ],
    [
        "storesHeading",
        "Stores: is there room, and does data move on?",
        [
            ["In short", "The stores must have room for the data the archiver adds, and each ETL pass must finish within its interval."],
            ["What it shows", "The passes of the ETL, the part that moves data from the short term store to the medium term store and on to the long term store at a fixed interval. The days left on each device at the current growth, and the largest users of storage."],
            ["Normal", `At least ${T.daysLeftAttention} days left, at least ${T.freeAttentionPercent} % free on every device, and every pass within its interval.`],
            ["Attention", `Fewer than ${T.daysLeftAttention} days left, less than ${T.freeAttentionPercent} % free, a pass that overran its interval or started late, or a failed job.`],
            ["Problem", `Fewer than ${T.daysLeftProblem} days left, less than ${T.freeProblemPercent} % free, or a pass busy for ${T.etlBusyProblemPercent} % of its interval.`],
            ["What to do", "Free or add disk space, or archive less of the prefixes below. For a pass that overran, look at the slowest PV of that pass."],
        ],
    ],
    [
        "usageHeading",
        "Largest users of storage: where does the space go?",
        [
            ["In short", "The treemap draws the stored data, or the sample rate, by PV name prefix, so the prefixes that use the space show at once."],
            ["Block", "A block is a PV name prefix, the part of the name up to its second colon. The blocks inside it are its PVs."],
            ["Size", "Stored data is what a PV occupies in all stores; event rate is its samples per second, the server calling a sample an event. The buttons switch between them."],
            ["Scope", `Every appliance of the cluster. The ${GROUP_LIMIT} largest prefixes and the ${LEAF_LIMIT} largest PVs are drawn; the rest of a prefix is one block.`],
            ["What to do", "Click a prefix to find its PVs in Browse PVs, and archive less of a prefix that holds most of the space."],
        ],
    ],
    [
        "processesHeading",
        "Processes: is each part healthy?",
        [
            ["In short", "The four processes of the appliance must run at one version, and the heap floor of each must stay low."],
            ["What it shows", "Management, engine, ETL and retrieval, each with its start, its uptime, its heap now and the lowest heap after a collection, the floor. The heap rises and falls all the time; the floor is the line that matters."],
            ["Normal", `All four run at the same version, and the floor is below ${T.heapFloorAttention} % of the maximum heap.`],
            ["Attention", `A version differs, or the floor is above ${T.heapFloorAttention} % or has risen by ${T.heapFloorRiseAttention} points in a day.`],
            ["Problem", `A process is down, or the floor is above ${T.heapFloorProblem} %.`],
            ["What to do", "A climbing floor means the heap is too small or something leaks. Raise the heap size of that process, a setting of the installation, and watch whether the floor settles."],
        ],
    ],
];

for (const [heading, title, rows] of CARDS) {
    // The section is named by the heading text alone; the button sits beside it in the heading element.
    const text = $(heading);
    const host = text.tagName === "SPAN" ? text.parentElement : text;
    host.append(" ", infoButton(title, rows, null, HELP));
}

function fill(tableId, rows) {
    const body = $(tableId).querySelector("tbody");
    body.textContent = "";
    for (const cells of rows) {
        body.append(node("tr", null, ...cells.map((cell, index) => (cell instanceof Node ? node("td", { class: index ? "r num" : null }, cell) : node("td", { class: index ? "r num" : null }, String(cell))))));
    }
    return body;
}

function emptyRow(tableId, columns, text) {
    $(tableId).querySelector("tbody").replaceChildren(node("tr", null, node("td", { colspan: String(columns), class: "empty" }, text)));
}

// ---- samples ---------------------------------------------------------------------------------------

function renderSamples(data) {
    const m = data.measures;
    const show = (name) => (m.has(name) ? String(m.get(name)) : "not reported");
    fill("counts", [
        ["Total PVs", show("Total PV count")],
        ["Connected", show("Connected PV count")],
        ["Disconnected now", show("Disconnected PV count")],
        ["Paused", show("Paused PV count")],
        ["Never connected", data.never ? String(data.never.length) : "not read"],
        ["Channels with pending search requests", show("Channels with pending search requests")],
        ["PVs waiting for their first meta data", show("PVs pending computation of meta info")],
        ["Events per second", show("Event Rate (in events/sec)")],
        ["Data rate in bytes per second", show("Data Rate (in bytes/sec)")],
    ]);
    if (!data.lost) {
        emptyRow("lostConnections", 3, "The report could not be read.");
    } else if (!data.lost.length) {
        emptyRow("lostConnections", 3, "No PV lost its connection.");
    } else {
        fill("lostConnections", data.lost.map((row) => [row.pvName, String(row.lostConnections), String(row.currentlyConnected)]));
    }
    renderHosts(data.disconnected);
}

function renderHosts(rows) {
    const body = $("hosts").querySelector("tbody");
    body.textContent = "";
    if (!rows) {
        $("hostsNote").textContent = "The list could not be read.";
        return;
    }
    const groups = groupByHost(rows);
    $("hostsNote").textContent = rows.length
        ? `${rows.length} PV${rows.length > 1 ? "s are" : " is"} disconnected, in ${groups.length} group${groups.length > 1 ? "s" : ""} of host and time of loss.`
        : "No PV is disconnected.";
    for (const group of groups) {
        const key = `${group.host}|${group.first}`;
        const counts = new Map();
        for (const item of group.items) {
            counts.set(prefixOf(item.pv), (counts.get(prefixOf(item.pv)) || 0) + 1);
        }
        const prefixes = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        const top = prefixes[0] ? prefixes[0][0] : "";
        const when = group.first === group.last ? timeText(group.first) : `${timeText(group.first)} to ${timeText(group.last)}`;
        const toggle = node("button", { type: "button", class: "link", "aria-expanded": String(openGroups.has(key)) }, "PVs");
        const pauseThese = node("button", { type: "button", class: "link" }, "Pause these…");
        pauseThese.addEventListener("click", () => confirmPause(group));
        const open = new URLSearchParams({ q: top, report: "disconnected" });
        const row = node(
            "tr",
            null,
            node("td", { class: group.host ? "pv" : "pv warn" }, group.host || "unknown host"),
            node("td", { class: "r num warn" }, String(group.items.length)),
            node("td", { class: "num" }, when),
            node("td", { class: "pv" }, prefixes.slice(0, 3).map(([name, count]) => `${name} (${count})`).join(", ")),
            node("td", null, toggle, " ", node("a", { href: `index.html#${open}` }, "Open in Browse PVs"), " ", pauseThese),
        );
        body.append(row);
        const showList = () => {
            const names = group.items.slice().sort((a, b) => (a.pv < b.pv ? -1 : a.pv > b.pv ? 1 : 0));
            const items = node("ul", { class: "pvlist" });
            for (const item of names.slice(0, LIST_LIMIT)) {
                items.append(node("li", null, node("span", { class: "pv" }, item.pv), ` lost ${item.lostText}`));
            }
            if (names.length > LIST_LIMIT) {
                items.append(node("li", { class: "sub" }, `and ${names.length - LIST_LIMIT} more; open the group in the Browse PVs page for the whole list.`));
            }
            return node("tr", { class: "detail" }, node("td", { colspan: "5" }, items));
        };
        let detail = null;
        if (openGroups.has(key)) {
            detail = showList();
            row.after(detail);
        }
        toggle.addEventListener("click", () => {
            if (detail) {
                detail.remove();
                detail = null;
                openGroups.delete(key);
            } else {
                detail = showList();
                row.after(detail);
                openGroups.add(key);
            }
            toggle.setAttribute("aria-expanded", String(Boolean(detail)));
        });
    }
}

/** Asks once, then pauses the PVs of a group in one call and says what happened. */
function confirmPause(group) {
    const dialog = $("confirmDialog");
    const names = group.items.map((item) => item.pv);
    const host = group.host || "an unknown host";
    $("confirmTitle").textContent = `Pause ${names.length} PV${names.length === 1 ? "" : "s"}`;
    $("confirmText").textContent = `These PVs lost their connection to ${host}. The archiver stops asking for them and keeps their data. Resume them from the Browse PVs page when the IOC is back.`;
    $("confirmError").textContent = "";
    $("confirmForm").onsubmit = async (event) => {
        event.preventDefault();
        const submit = $("confirmSubmit");
        submit.disabled = true;
        try {
            const rows = await pauseResume("../bpl/pauseArchivingPV", names);
            const same = (row) => /already paused/i.test(String(row.validation || ""));
            const done = rows.filter((row) => row.status === "ok").length;
            const already = rows.filter(same).length;
            const failed = rows.filter((row) => row.status !== "ok" && !same(row));
            dialog.close();
            $("hostsResult").textContent = `${done} of ${names.length} PVs paused${already ? `, ${already} already paused` : ""}${failed.length ? `; ${failed.length} failed (first: ${failed[0].pvName}: ${failed[0].validation || failed[0].engine_validation || "no reason given"})` : ""}.`;
            refresh();
        } catch (error) {
            $("confirmError").textContent = error.message;
        } finally {
            submit.disabled = false;
        }
    };
    dialog.showModal();
}

// ---- samples lost ----------------------------------------------------------------------------------

function renderDropped(data) {
    const body = $("droppedTable").querySelector("tbody");
    body.textContent = "";
    DROPPED_REPORTS.forEach((report, index) => {
        const rows = data.dropped[index];
        if (!rows) {
            body.append(node("tr", null, node("td", null, report.label), node("td", { colspan: "4", class: "empty" }, "The report could not be read.")));
            return;
        }
        const worst = rows.slice().sort((a, b) => (number(b.eventsDropped) || 0) - (number(a.eventsDropped) || 0))[0];
        const total = rows.reduce((sum, row) => sum + (number(row.eventsDropped) || 0), 0);
        body.append(
            node(
                "tr",
                null,
                node("td", null, report.label),
                node("td", { class: rows.length ? "r num warn" : "r num" }, String(rows.length)),
                node("td", { class: "pv" }, worst ? worst.pvName : "-"),
                node("td", { class: "r num" }, rows.length ? total.toLocaleString() : "-"),
                node("td", { class: "why" }, rows.length ? report.action : "Nothing to do."),
            ),
        );
    });
}

// ---- write path ------------------------------------------------------------------------------------

function renderWrite(data) {
    const m = data.measures;
    const write = judgeWrite(m);
    const rate = number(m.get("Event Rate (in events/sec)"));
    const benchmark = number(m.get("Benchmark - writing at (events/sec)"));
    const headroom = rate && benchmark ? benchmark / rate : null;
    const show = (name, suffix = "") => (m.has(name) ? `${m.get(name)}${suffix}` : "not reported");
    fill("writeTable", [
        ["Write time as share of the write period", node("span", null, statusNode(write.kind, write.text), write.usage === null ? "" : ` ${write.usage.toFixed(write.usage < 1 ? 2 : 0)} %`)],
        ["Time spent writing sample buffers to the short term store", show("Time consumed for writing samplebuffers to STS (in secs)", " s")],
        ["Jobs waiting in the engine queue", show("Approx pending jobs in engine queue")],
        ["Incoming rate", rate === null ? "not reported" : `${rate.toLocaleString(undefined, { maximumFractionDigits: 1 })} events per s`],
        ["Benchmark write rate", benchmark === null ? "not reported" : `${benchmark.toLocaleString()} events per s`],
        ["Headroom", headroom === null ? "unknown" : `${headroom.toLocaleString(undefined, { maximumFractionDigits: 0 })} times`],
        ["PVs in the archive workflow", show("PVs in archive workflow")],
    ]);
    if (!data.fastest) {
        emptyRow("fastest", 2, "The report could not be read.");
    } else {
        fill("fastest", data.fastest.map((row) => [row.pvName, String(Number(row.eventRate).toFixed(2))]));
    }
}

// ---- stores and ETL --------------------------------------------------------------------------------

function renderStorage(data) {
    const host = $("storage");
    host.textContent = "";
    const bytes = number(data.appliance.dataRate);
    const storage = judgeStorage(data.storage, bytes);
    const rate = storage.perDayGB ? `${(storage.perDayGB * 1000).toFixed(storage.perDayGB < 1 ? 1 : 0)} MB per day` : "an unknown rate";
    $("daysLeft").textContent = data.storage && data.storage.length
        ? storage.kind === "ok"
            ? storage.days === null
                ? "The archiver adds no data at the moment, so the days left cannot be computed."
                : `At ${rate} the space lasts ${daysText(storage.days)}.`
            : `${storage.text} The archiver adds ${rate}.`
        : "";
    if (!data.storage) {
        host.textContent = "The storage report could not be read.";
        return;
    }
    if (!data.storage.length) {
        host.textContent = "The appliance reported no storage devices.";
        return;
    }
    for (const device of data.storage) {
        const total = number(device.total_space);
        const free = number(device.available_space);
        const freePercent = number(device.available_space_percent);
        const used = total !== null && free !== null ? total - free : null;
        const usedPercent = freePercent !== null ? 100 - freePercent : null;
        const low = freePercent !== null && freePercent < THRESHOLDS.freeAttentionPercent;
        const track = node("div", { class: "track", role: "img", "aria-label": usedPercent === null ? "usage unknown" : `${usedPercent.toFixed(0)} percent used` });
        const fillBar = node("div", { class: low ? "fill low" : "fill" });
        fillBar.style.width = `${Math.max(0, Math.min(100, usedPercent === null ? 0 : usedPercent))}%`;
        track.append(fillBar);
        const copy = device.time_copy_data_into_store && device.time_copy_data_into_store !== "NaN" ? `, copy ${device.time_copy_data_into_store} s` : "";
        host.append(
            node(
                "div",
                { class: "bar-row" },
                node("span", { class: "pv" }, device.name),
                track,
                node("span", { class: low ? "num warn" : "num" }, used === null ? "" : `${used.toFixed(1)} of ${total.toFixed(1)} GB used${copy}`),
            ),
        );
    }
}

const ETL_ROWS = [
    "Passes so far",
    "Last pass started at",
    "Last pass duration (s)",
    "Last pass busy time (s)",
    "Last pass busy time as % of cadence",
    "Last pass overran the cadence",
    "Last pass late by (s)",
    "Last pass PVs",
    "Last pass partitions moved",
    "Last pass bytes moved",
    "Last pass jobs failed",
    "Last pass jobs aborted",
    "Last pass jobs skipped",
    "Last pass slowest PV",
    "Last pass slowest PV time (s)",
    "Average busy time per pass (s)",
    "Weekly usage (%)",
    "Current pass",
];

function renderEtl(data) {
    const tiers = etlTiers(data.measures);
    const keys = Object.keys(tiers).sort();
    const table = $("etl");
    table.querySelector("thead").replaceChildren(node("tr", null, node("th", null, "Measure"), ...keys.map((key) => node("th", { class: "r" }, TIER_NAMES[key] || key))));
    const body = table.querySelector("tbody");
    body.textContent = "";
    if (!keys.length) {
        body.append(node("tr", null, node("td", { class: "empty" }, "The appliance reported no ETL measures.")));
    }
    const judged = judgeEtl(tiers);
    if (keys.length) {
        body.append(node("tr", null, node("td", null, "Judgement"), node("td", { colspan: String(keys.length) }, statusNode(judged.kind, judged.text))));
    }
    for (const name of ETL_ROWS) {
        body.append(node("tr", null, node("td", null, name), ...keys.map((key) => node("td", { class: "r num" }, tiers[key][name] === undefined ? "" : String(tiers[key][name])))));
    }
    const m = data.measures;
    const plan = (name, suffix = "") => (m.has(name) ? `${m.get(name)}${suffix}` : "not reported");
    fill("plan", [
        ["Plan last updated", plan("Capacity planning last update")],
        ["Storage rate, whole cluster", plan("Aggregated appliance storage rate (in GB/year)", " GB per year")],
        ["Storage rate, this appliance", plan("Incremental appliance storage rate (in GB/year)", " GB per year")],
        ["Event rate, whole cluster", plan("Aggregated appliance event rate (in events/sec)", " per s")],
        ["Event rate, this appliance", plan("Incremental appliance event rate (in events/sec)", " per s")],
        ["PV count, whole cluster", plan("Aggregated appliance PV count")],
        ["PV count, this appliance", plan("Incremental appliance PV count")],
    ]);
}

// ---- usage by name prefix --------------------------------------------------------------------------

const usage = { stored: undefined, rate: undefined, metric: "stored", loadedAt: 0, loading: false };

function usageText(value) {
    if (usage.metric === "stored") {
        // The value is in MB; a small PV shows in KB or bytes so it never reads as zero.
        if (value >= 1024) {
            return `${(value / 1024).toFixed(1)} GB`;
        }
        if (value >= 1) {
            return `${value.toFixed(value >= 10 ? 0 : 1)} MB`;
        }
        const kilobytes = value * 1024;
        return kilobytes >= 1 ? `${kilobytes.toFixed(kilobytes >= 10 ? 0 : 1)} KB` : `${Math.round(value * 1048576)} B`;
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)} per s`;
}

function renderUsage() {
    const host = $("usageChart");
    const note = $("usageNote");
    const stored = usage.metric === "stored";
    $("usageStored").setAttribute("aria-pressed", String(stored));
    $("usageRate").setAttribute("aria-pressed", String(!stored));
    const rows = stored ? usage.stored : usage.rate;
    if (rows === undefined) {
        host.replaceChildren(node("p", { class: "sub" }, "Reading the report."));
        note.textContent = "";
        return;
    }
    if (!rows) {
        host.replaceChildren(node("p", { class: "sub" }, "The report could not be read."));
        note.textContent = "";
        return;
    }
    const model = usageGroups(rows, (row) => row.pvName, stored ? (row) => Number(row.storageConsumed) / 1048576 : (row) => Number(row.eventRate));
    if (!model.groups.length) {
        host.replaceChildren(node("p", { class: "sub" }, stored ? "No PV has stored data yet." : "No PV reported an event rate."));
        note.textContent = "";
        return;
    }
    const total = usageText(model.total);
    const partial = model.listedPVs < model.pvs || model.foldedPrefixes > 0;
    note.textContent = `${model.pvs} PVs, ${total} in all${partial ? `; the ${model.listedPVs} largest are drawn one by one` : ""}.`;
    drawUsage(host, model, {
        width: host.clientWidth || host.parentElement.clientWidth,
        format: usageText,
        href: (prefix) => `index.html#${new URLSearchParams({ q: prefix })}`,
    });
}

/** Reads both reports of the cluster; they are large for a big cluster, so they are read at most every five minutes. */
async function loadUsage() {
    if (usage.loading || (usage.stored !== undefined && Date.now() - usage.loadedAt < USAGE_REFRESH_MS)) {
        return;
    }
    usage.loading = true;
    try {
        const [stored, rate] = await settled([
            get("../bpl/getPVsByStorageConsumed", { limit: USAGE_PV_LIMIT }),
            get("../bpl/getEventRateReport", { limit: USAGE_PV_LIMIT }),
        ]);
        usage.stored = stored;
        usage.rate = rate;
        usage.loadedAt = Date.now();
        renderUsage();
    } finally {
        usage.loading = false;
    }
}

function wireUsage() {
    for (const [id, metric] of [["usageStored", "stored"], ["usageRate", "rate"]]) {
        $(id).addEventListener("click", () => {
            usage.metric = metric;
            renderUsage();
        });
    }
}

// ---- processes -------------------------------------------------------------------------------------

function duration(seconds) {
    const total = Math.floor(Number(seconds));
    if (!Number.isFinite(total)) {
        return "";
    }
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return days ? `${days} d ${hours} h` : `${hours} h ${minutes} m`;
}

const COMPONENTS = [
    ["MGMT", "Management", null],
    ["ENGINE", "Engine", "engine_heap (%)"],
    ["ETL", "ETL", "etl_heap (%)"],
    ["RETRIEVAL", "Retrieval", "retrieval_heap (%)"],
];

function seriesByLabel(series, label) {
    const found = (series || []).find((s) => s.label === label);
    return found ? found.data : null;
}

/** The id of a chart of this page: the widget keeps the options of the chart under it and prefixes its controls with it. */
function chartId(title) {
    return `ops-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function floorChart(host, title, floor) {
    const points = floor.data.map(([t, v]) => ({ t, v, s: 0 }));
    const lowest = floor.floor.map(([t, v]) => ({ t, v, s: 0 }));
    const section = node(
        "div",
        { class: "process-chart" },
        node("h3", null, title, " ", infoButton(...HEAP_CARD)),
        statusNode(floor.kind, floor.text)
    );
    const chartHost = node("div");
    section.append(chartHost);
    host.append(section);
    createChart(chartHost, { id: chartId(title), idPrefix: chartId(title), dialogTitle: title, helpHref: HELP, legend: true }).draw({
        series: [
            { name: "heap", egu: "%", points, focus: false, quiet: true },
            { name: "floor", egu: "%", points: lowest, focus: true },
        ],
        from: new Date(points[0].t),
        to: new Date(points[points.length - 1].t),
        gapMs: 600000,
    });
    const rhythm = floor.rhythm === null ? "" : ` A collection runs about every ${floor.rhythm.toFixed(0)} minutes.`;
    section.append(node("p", { class: "sub" }, `Lowest after a collection: ${floor.first.toFixed(0)} % at the start of the day, ${floor.last.toFixed(0)} % now.${rhythm}`));
}

function renderProcesses(data) {
    const local = !data.servingIdentity || data.servingIdentity === data.appliance.instance;
    const info = (local && data.processInfo) || {};
    const body = $("processTable").querySelector("tbody");
    body.textContent = "";
    const host = $("process");
    host.textContent = "";
    $("processNote").textContent = "";
    const charts = [];
    for (const [key, label, seriesLabel] of COMPONENTS) {
        const metrics = info[`${key}_metrics`];
        const raw = seriesLabel ? seriesByLabel(data.series, seriesLabel) : null;
        // The latest value of the series belongs to the selected appliance, whichever one answered.
        const heapNow = metrics && metrics.length ? number(metrics[metrics.length - 1].heapUsedPercent) : raw && raw.length ? number(raw[raw.length - 1][1]) : null;
        const floor = seriesLabel ? heapFloor(raw) : null;
        body.append(
            node(
                "tr",
                null,
                node("td", null, label),
                node("td", { class: "num" }, info[`${key}_start`] || ""),
                node("td", { class: "r num" }, duration(info[`${key}_uptime`])),
                node("td", { class: "r num" }, heapNow === null ? "" : `${heapNow.toFixed(0)} %`),
                node("td", null, floor ? statusNode(floor.kind, floor.text || `${floor.last.toFixed(0)} %`) : node("span", { class: "why" }, seriesLabel ? "not enough data yet" : "not reported over time")),
            ),
        );
        if (floor) {
            charts.push([`${label} heap`, floor]);
        }
    }
    if (!data.series) {
        $("processNote").textContent = "The process metrics could not be read.";
        return;
    }
    if (!charts.length) {
        $("processNote").textContent = "A trend appears when the appliance has collected two hours of values.";
    }
    if (!local) {
        $("processNote").textContent = `${$("processNote").textContent} Start time and uptime are reported only by the appliance that serves this page (${data.servingIdentity}).`.trim();
    }
    for (const [title, floor] of charts) {
        floorChart(host, title, floor);
    }
    const load = seriesByLabel(data.series, "system_load (%)");
    if (load && load.length > 1) {
        const points = load.map(([t, v]) => ({ t, v: Number(v), s: 0 })).filter((p) => Number.isFinite(p.v));
        const section = node("div", { class: "process-chart" }, node("h3", null, "Load average of the host"));
        const chartHost = node("div");
        section.append(chartHost);
        host.append(section);
        createChart(chartHost, { id: chartId("load"), idPrefix: chartId("load"), dialogTitle: "Load average of the host", helpHref: HELP, labelNames: false }).draw({
            series: [{ name: "load", egu: "", points, focus: true }],
            from: new Date(points[0].t),
            to: new Date(points[points.length - 1].t),
            gapMs: 600000,
        });
        const high = Math.max(...points.map((p) => p.v));
        section.append(
            node("p", { class: "sub" }, `One-minute load average of the host: now ${points[points.length - 1].v.toFixed(1)}, highest ${high.toFixed(1)}. The appliance does not report the number of cores, so no judgement is made; a load above the number of cores means processes wait for a processor.`),
        );
    }
}

// ---- configuration and thresholds ------------------------------------------------------------------

const BASIS = [
    ["Days left, attention / problem", `${THRESHOLDS.daysLeftAttention} / ${THRESHOLDS.daysLeftProblem} days`, "A choice: a store fills slowly, so published alert horizons of hours do not fit."],
    ["Device free share, attention / problem", `${THRESHOLDS.freeAttentionPercent} / ${THRESHOLDS.freeProblemPercent} %`, "Prometheus node_exporter mixin, almost out of space."],
    ["Write time, attention / problem", `${THRESHOLDS.writeAttentionPercent} / ${THRESHOLDS.writeProblemPercent} % of the write period`, "Samples are lost when the writer needs more than its period; the half is a choice."],
    ["Heap floor level, attention / problem", `${THRESHOLDS.heapFloorAttention} / ${THRESHOLDS.heapFloorProblem} % of the maximum heap`, "A live data set above 70 % of the heap (Netflix Spectator example); 90 % from the node_exporter memory alert."],
    ["Heap floor rise in a day, attention", `${THRESHOLDS.heapFloorRiseAttention} points`, "A rising live set under stable load is a leak sign (Oracle troubleshooting guide); the number is a choice."],
    ["Disconnected PV, attention", `${THRESHOLDS.disconnectedSeconds / 3600} h`, "A choice: shorter losses are often restarts."],
    ["ETL busy share, problem", `${THRESHOLDS.etlBusyProblemPercent} % of its interval`, "A choice; an overran pass or a failed job is attention."],
];

function renderConfiguration(data) {
    const policies = data.policies ? Object.keys(data.policies).sort() : [];
    const rows = [
        ["Minimum sampling period", data.properties && data.properties.minimum_sampling_period ? `${data.properties.minimum_sampling_period} s` : "not reported"],
        ["Appliances in the cluster", data.cluster ? `${data.cluster.length}: ${data.cluster.map((a) => a.identity).join(", ")}` : "not read"],
        ["Policies", policies.length ? `${policies.length}: ${policies.join(", ")}` : "not read"],
    ];
    const body = $("config").querySelector("tbody");
    body.textContent = "";
    for (const [label, value] of rows) {
        body.append(node("tr", null, node("td", null, label), node("td", { class: "wrap" }, value)));
    }
    body.append(node("tr", null, node("th", { colspan: "2" }, "Thresholds the judgements use and their basis")));
    for (const [label, value, basis] of BASIS) {
        body.append(node("tr", null, node("td", null, label), node("td", { class: "wrap" }, node("span", { class: "num" }, value), node("br"), node("span", { class: "why" }, basis))));
    }
}

// ---- loading ---------------------------------------------------------------------------------------

async function gather(appliance) {
    const name = appliance.instance;
    const mine = (rows) => (rows ? rows.filter((row) => !row.instance || row.instance === name) : rows);
    const [load, storage, series, processInfo, disconnected, never, lost, fastest, properties, policies, cluster, serving, ...dropped] = await settled([
        get("../bpl/getApplianceMetricsForAppliance", { appliance: name }),
        get("../bpl/getStorageMetricsForAppliance", { appliance: name }),
        get("../bpl/getProcessMetricsDataForAppliance", { appliance: name }),
        get("../bpl/getProcessMetrics"),
        get("../bpl/getCurrentlyDisconnectedPVs"),
        get("../bpl/getNeverConnectedPVs"),
        get("../bpl/getLostConnectionsReport", { limit: "5" }),
        get("../bpl/getEventRateReport", { limit: "5" }),
        get("../bpl/getApplianceProperties"),
        get("../bpl/getPolicyList"),
        get("../bpl/getAppliancesInCluster"),
        get("../bpl/getApplianceInfo"),
        ...DROPPED_REPORTS.map((report) => get(report.endpoint, { limit: "1000" })),
    ]);
    return {
        appliance,
        measures: measureMap(load),
        storage,
        series,
        processInfo,
        disconnected: mine(disconnected),
        never: mine(never),
        lost: mine(lost),
        fastest: mine(fastest),
        properties,
        policies,
        cluster,
        // The process report of the appliance that answered; another appliance of the cluster is not in it.
        servingIdentity: serving ? serving.identity : null,
        dropped: dropped.map(mine),
    };
}

function renderAll(data) {
    renderSamples(data);
    renderDropped(data);
    renderWrite(data);
    renderStorage(data);
    renderEtl(data);
    renderProcesses(data);
    renderConfiguration(data);
}

async function refresh() {
    try {
        list = await appliances();
        $("problem").textContent = "";
    } catch (error) {
        $("problem").textContent = `The appliance metrics could not be read: ${error.message}`;
        return;
    }
    current = chooseAppliance(list, $("applianceChoice"), refresh);
    if (!current) {
        $("problem").textContent = "No appliance reported metrics.";
        return;
    }
    try {
        latest = await gather(current);
        renderAll(latest);
        loadUsage();
    } catch (error) {
        $("problem").textContent = `The page could not be drawn: ${error.message}`;
    }
}

$("confirmCancel").addEventListener("click", () => $("confirmDialog").close());
wireUsage();
renderUsage();
refresh();
timer = window.setInterval(() => {
    if (!document.hidden) {
        refresh();
    }
}, REFRESH_MS);
window.addEventListener("resize", () => {
    window.clearTimeout(window.resizeTimer);
    window.resizeTimer = window.setTimeout(() => {
        if (latest) {
            renderProcesses(latest);
        }
        renderUsage();
    }, 200);
});
