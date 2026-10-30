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
            ["The host", "The endpoint reported by the CA or PVA connection. PVA endpoints may include a port. The appliance reports no IOC name; one host can serve several IOCs."],
            ["Partly listed", "A host listed with only some of its PVs may still be running: its other PVs are connected."],
            ["What to do", "PVs lists the group, Open in Browse PVs selects them on that page, and Pause these… pauses the PVs that no longer exist."],
        ],
    ],
    [
        "dropoutHeading",
        "PVs that drop out most: which connections flap?",
        [
            ["In short", "The five PVs whose connection dropped most often since the engine started."],
            ["Drops", "How often the connection was lost. A PV that drops again and again sits on an IOC that restarts or on a network that flaps."],
            ["What to do", "Open the PV in Browse PVs; its Details hold the times of the connection. Many PVs of one host point at that IOC."],
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
        "Writing to disk: does the engine keep up?",
        [
            ["In short", "Once per write period the engine writes the sample buffers of all PVs to the short term store; the write must take less than the period."],
            ["What it shows", "The share of the period the last write took, the rate the write moved against the rate at which samples arrive, and the fastest PVs."],
            ["Normal", `Below ${T.writeAttentionPercent} % of the period.`],
            ["Attention", `${T.writeAttentionPercent} % or more: the writer needs more than half of its period.`],
            ["Problem", `${T.writeProblemPercent} %: the writer needs all of its period, and samples are lost.`],
            ["What to do", "Slow the fastest PVs with Change sampling, check the disk under the short term store, or add an appliance. The write delay a buffer absorbs is a setting described in the manual; ask the administrator."],
        ],
    ],
    [
        "fastestHeading",
        "Fastest PVs: which PVs send the most?",
        [
            ["In short", "The five PVs with the highest sample rate; they take the largest share of the write time and of the storage."],
            ["What to do", "A PV that is faster than needed gets a longer period with Change sampling in Browse PVs."],
        ],
    ],
    [
        "storesHeading",
        "Stores: is there room?",
        [
            ["In short", "The three stores of this appliance and how full their devices are; the sentence says how long the free space lasts at the current growth."],
            ["The stores", "Short term, medium term and long term store: data moves from one to the next as it ages, so the short term store holds the newest data."],
            ["Used and of", "The space used and the size of the device that holds the store, in GB. Stores on one disk show the same numbers."],
            ["Copy time", "The average seconds of a move into this store over its runs so far. The short term store receives from the engine, not from a move, so it has none."],
            ["Attention", `Fewer than ${T.daysLeftAttention} days left, or a device with less than ${T.freeAttentionPercent} % free, drawn in the alarm color; fewer than ${T.daysLeftProblem} days or less than ${T.freeProblemPercent} % free is a problem.`],
            ["What to do", "Free or add disk space, or archive less of the prefixes shown under Largest users of storage."],
        ],
    ],
    [
        "movesHeading",
        "Moves between stores: does data move on?",
        [
            ["In short", "The ETL moves the data of every PV from one store to the next at a fixed interval; each column is one move, and a pass should finish within its interval."],
            ["A pass", "One run of a move over all its PVs, one job per PV. Took is the time from start to end; busy is the time inside the jobs, and busy divided by the interval is what the judgement reads."],
            ["Partitions and jobs", "A partition is the file of one PV for one period of the store, such as a day. A job failed when its data did not arrive whole, aborted when an error the ETL could not handle ended it, skipped when the PV had no next store."],
            ["Late and overran", "Started late is the gap between the planned and the actual start when it is more than one interval; overran means the pass ended later than its planned start plus one interval."],
            ["Problem", `A pass busy for ${T.etlBusyProblemPercent} % of its interval; an overran or late pass or a failed job is attention.`],
            ["What to do", "A pass that overruns or a job that fails points at a slow or full destination: look at the slowest PV and at the device of that store."],
        ],
    ],
    [
        "ratesHeading",
        "Rates at the archive requests: what did the PVs promise?",
        [
            ["In short", "Each PV was measured for about a minute when it was archived; these are those sample and storage rates added up for this appliance, and how they changed since the capacity plan."],
            ["Not the rates of now", "The Samples section counts what arrives now; these sums keep the rates measured at the archive requests and change only when a PV is added or removed."],
            ["The capacity plan", "A scheduled task of the management that reads these sums from every appliance; the change since then is what was added or removed meanwhile."],
            ["What to do", "Compare the storage per year with the free space of the stores to see when a disk is needed; a large change since the plan means the plan is stale."],
        ],
    ],
    [
        "usageHeading",
        "Largest users of storage: where does the space go?",
        [
            ["In short", "The treemap draws the stored data, or the sample rate, by PV name prefix, so the prefixes that use the space show at once."],
            ["Block", "A block is a PV name prefix, the part of the name up to its second colon. The blocks inside it are its PVs."],
            ["Size", "Stored data is what a PV occupies in all stores; event rate is its samples per second, the server calling a sample an event. The buttons switch between them."],
            ["Scope", `Every appliance of this installation. The ${GROUP_LIMIT} largest prefixes and the ${LEAF_LIMIT} largest PVs are drawn; the rest of a prefix is one block.`],
            ["What to do", "Click a prefix to find its PVs in Browse PVs, and archive less of a prefix that holds most of the space."],
        ],
    ],
    [
        "processesHeading",
        "Processes: is each part healthy?",
        [
            ["In short", "The four processes of the appliance must run at one version, and the heap floor of each must stay low."],
            ["Heap and floor", "The heap is the memory a process holds; it rises and falls with garbage collection. The floor is the lowest heap reading of the last hour, which a collection cannot free."],
            ["Normal", `All four run at the same version, and the floor is below ${T.heapFloorAttention} % of the maximum heap.`],
            ["Attention", `A version differs, or the floor is above ${T.heapFloorAttention} % or has risen by ${T.heapFloorRiseAttention} points in a day.`],
            ["Problem", `A process is down, or the floor is above ${T.heapFloorProblem} %.`],
            ["What to do", "A climbing floor means the heap is too small or something leaks. Raise the heap size of that process, a setting of the installation, and watch whether the floor settles."],
        ],
    ],
    [
        "configHeading",
        "Configuration in effect: what does this installation run with?",
        [
            ["In short", "The settings of this installation that the pages read, and the thresholds the judgements use, which are starting values."],
            ["Thresholds", "The attention and problem values of the measures of this page and of the Overview; the cards of the sections read the same values."],
            ["Basis", "The free share of a device and the heap floor levels follow the alerts of the Prometheus node exporter; the floor as the live set follows the Netflix Spectator example and the Oracle troubleshooting guide. The days left, the half of the write period, the heap rise, the hour of a disconnected PV and the ETL busy share are choices."],
            ["What to do", "A threshold that does not fit the site is a change of the console; ask the administrator."],
        ],
    ],
];

// The card of the load chart, beside its heading.
const LOAD_CARD = [
    "Load of the host: is the machine busy?",
    [
        ["In short", "The one-minute load average of the host over the day: the processes running or waiting for a processor, as the operating system counts them."],
        ["Reading", "A load above the number of processor cores means processes wait. The appliance does not report the number of cores, so the load is not judged."],
        ["What to do", "Compare the load with the cores of the host. A load that stays above them slows every process, the writes of the engine among them."],
    ],
    null,
    HELP,
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

/**
 * The name cell of a measure row: the plain name and its small information control, whose card holds the one sentence
 * that says what the value is.
 */
function named(name, sentence) {
    return node("td", { class: "name" }, name, " ", infoButton(name, sentence, null, HELP, true));
}

/** A row that only names the group of the rows under it, across every column. */
function groupRow(label, columns) {
    return node("tr", { class: "group" }, node("td", { colspan: String(columns) }, label));
}

/** Fills a table of measures: each row is [name, sentence, ...values] or ["group", label]. */
function fillMeasures(tableId, rows) {
    const body = $(tableId).querySelector("tbody");
    body.textContent = "";
    const columns = Math.max(...rows.map((row) => (row[0] === "group" ? 1 : row.length - 1)));
    for (const row of rows) {
        if (row[0] === "group") {
            body.append(groupRow(row[1], columns));
            continue;
        }
        const [name, sentence, ...values] = row;
        body.append(node("tr", null, named(name, sentence), ...values.map((value) => node("td", { class: "r num" }, value instanceof Node ? value : String(value)))));
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
    fillMeasures("counts", [
        ["Active PVs", "Archived PVs that are not paused; the engine holds a channel for each of them.", show("Total PV count")],
        ["Connected", "Active PVs whose channel is connected to its IOC right now.", show("Connected PV count")],
        ["Disconnected now", "Active PVs whose channel is not connected right now; nothing is stored for them meanwhile.", show("Disconnected PV count")],
        ["Paused", "Archived PVs paused on purpose; they have no channel until they are resumed.", show("Paused PV count")],
        ["Never connected", "Archive requests whose PV has not connected once since the request.", data.never ? String(data.never.length) : "not read"],
        ["Still searching for a server", "Channel Access channels whose search for a server is still unanswered, of all channels of the engine.", show("Channels with pending search requests")],
        ["Being measured", "New archive requests the engine monitors for about a minute to measure their sample and storage rates before they are archived.", show("PVs pending computation of meta info")],
        ["Samples per second", "The sample rates of all active PVs added up; the engine counts each rate over its measuring window.", show("Event Rate (in events/sec)")],
        ["Bytes per second", "The storage rates of all active PVs added up: the bytes their samples take, each second.", show("Data Rate (in bytes/sec)")],
    ]);
    if (!data.lost) {
        emptyRow("lostConnections", 3, "The report could not be read.");
    } else if (!data.lost.length) {
        emptyRow("lostConnections", 3, "No PV lost its connection.");
    } else {
        fill("lostConnections", data.lost.map((row) => [row.pvName, String(row.lostConnections), String(row.currentlyConnected).toLowerCase() === "yes" ? "yes" : "no"]));
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
    const seconds = number(m.get("Time consumed for writing samplebuffers to STS (in secs)"));
    const period = number(m.get("Write period (in secs)"));
    // The rate the last write moved: the samples of one period divided by the seconds of the write; the headroom is the
    // period divided by those seconds.
    const moved = rate !== null && seconds && period ? (rate * period) / seconds : number(m.get("Benchmark - writing at (events/sec)"));
    const headroom = seconds && period ? period / seconds : null;
    const show = (name, suffix = "") => (m.has(name) ? `${m.get(name)}${suffix}` : "not reported");
    fillMeasures("writeTable", [
        [
            "Write time, share of the period",
            "The seconds of the last write divided by the write period, in percent; at 100 % the next write is due before the last one ends, and samples are lost.",
            node("span", null, statusNode(write.kind, write.text), write.usage === null ? "" : ` ${write.usage.toFixed(write.usage < 1 ? 2 : 0)} %`),
        ],
        ["Last write took", "The seconds the last write of all sample buffers to the short term store took.", show("Time consumed for writing samplebuffers to STS (in secs)", " s")],
        ["Write period", "The seconds between two writes; the engine writes all sample buffers once per period.", period === null ? "not reported" : `${period} s`],
        ["Samples arriving", "The sample rates of all active PVs added up, per second.", rate === null ? "not reported" : `${rate.toLocaleString(undefined, { maximumFractionDigits: 1 })} per s`],
        ["Writing rate at the last write", "The samples of one period divided by the seconds of the last write: the samples per second the write moved to disk.", moved === null ? "not reported" : `${Math.round(moved).toLocaleString()} per s`],
        ["Headroom", "The write period divided by the seconds of the last write: how many times longer the write could take before it fills the period.", headroom === null ? "unknown" : `${headroom.toLocaleString(undefined, { maximumFractionDigits: 0 })} times`],
        ["Writes queued", "Tasks waiting in the write scheduler of the engine: the next periodic write, and writes queued when a buffer changes its year.", show("Approx pending jobs in engine queue")],
        ["Requests not yet archived", "Archive requests the management is still working on: measuring the PV, or assigning it to an appliance.", show("PVs in archive workflow")],
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
    // One row per store: the name with the full name of the store under it, the bar with its percent, and the numbers
    // in columns, so that a row with a copy time pushes nothing.
    host.append(node("div", { class: "bar-row head" }, node("span"), node("span"), node("span", { class: "col" }, "used"), node("span", { class: "col" }, "of"), node("span", { class: "col" }, "copy time")));
    for (const device of data.storage) {
        const total = number(device.total_space);
        const free = number(device.available_space);
        const freePercent = number(device.available_space_percent);
        const used = total !== null && free !== null ? total - free : null;
        const usedPercent = freePercent !== null ? 100 - freePercent : null;
        const low = freePercent !== null && freePercent < THRESHOLDS.freeAttentionPercent;
        const percentText = usedPercent === null ? "" : `${usedPercent.toFixed(0)} %`;
        const track = node("div", {
            class: "track",
            role: "img",
            "aria-label": usedPercent === null ? "usage unknown" : `${usedPercent.toFixed(0)} percent used`,
            title: usedPercent === null ? "" : `${percentText} used, ${free.toFixed(1)} GB free`,
        });
        const fillBar = node("div", { class: low ? "fill low" : "fill" }, percentText);
        fillBar.style.width = `${Math.max(0, Math.min(100, usedPercent === null ? 0 : usedPercent))}%`;
        track.append(fillBar);
        const copy = device.time_copy_data_into_store && device.time_copy_data_into_store !== "NaN" ? `${device.time_copy_data_into_store} s` : "";
        const full = STORE_NAMES[String(device.name).toUpperCase()];
        host.append(
            node(
                "div",
                { class: "bar-row" },
                node("span", { class: "pv" }, device.name, full ? node("small", null, full) : null),
                track,
                node("span", { class: low ? "col num warn" : "col num" }, used === null ? "" : `${used.toFixed(1)} GB`),
                node("span", { class: "col num" }, total === null ? "" : `${total.toFixed(1)} GB`),
                node("span", { class: "col copy num" }, copy),
            ),
        );
    }
}

// The full names of the stores, by the names the appliance reports.
const STORE_NAMES = { STS: "short term store", MTS: "medium term store", LTS: "long term store" };

/** The size of a count of bytes in a unit the reader can take in. */
function bytesText(count) {
    if (count === null) {
        return "";
    }
    if (count >= 1073741824) {
        return `${(count / 1073741824).toFixed(1)} GB`;
    }
    if (count >= 1048576) {
        return `${(count / 1048576).toFixed(1)} MB`;
    }
    if (count >= 1024) {
        return `${(count / 1024).toFixed(1)} KB`;
    }
    return `${count} B`;
}

// The rows of the table of the moves: the plain name, the one sentence of the row, and the measure of the ETL it reads
// (one per move), with the unit the value is shown in; a group row names the rows under it.
const SECONDS = (value) => (value === "" ? "" : `${value} s`);
const PERCENT = (value) => (value === "" ? "" : `${value} %`);
const AS_IS = (value) => value;
const ETL_ROWS = [
    ["group", "Last pass"],
    ["Started", "When the last completed pass of this move started.", "Last pass started at", AS_IS],
    ["Took", "Seconds from the start of the pass to its end.", "Last pass duration (s)", SECONDS],
    ["Busy", "Seconds spent inside the jobs of the pass, one job per PV.", "Last pass busy time (s)", SECONDS],
    ["Busy, share of the interval", "The busy seconds divided by the interval of the move, in percent; the judgement reads this.", "Last pass busy time as % of cadence", PERCENT],
    ["Started late", "Seconds between the planned start and the actual start, when they are more than one interval apart; otherwise 0.", "Last pass late by (s)", SECONDS],
    ["Overran", "Yes when the pass ended later than its planned start plus one interval.", "Last pass overran the cadence", AS_IS],
    ["PVs", "PVs the pass was planned for.", "Last pass PVs", AS_IS],
    ["Partitions moved", "Partitions appended to the next store and committed; a partition is the file of one PV for one period of the store, such as a day.", "Last pass partitions moved", AS_IS],
    ["Data moved", "The bytes of those partitions.", "Last pass bytes moved", (value) => bytesText(number(value))],
    ["Jobs failed", "Jobs whose data did not arrive whole: an error, a partition not appended, or a commit that failed.", "Last pass jobs failed", AS_IS],
    ["Jobs aborted", "Jobs that ended with an error the ETL could not handle; they count among the failed too.", "Last pass jobs aborted", AS_IS],
    ["Jobs skipped", "PVs the pass left out: no next store is set for the PV, or the store is excluded by a setting.", "Last pass jobs skipped", AS_IS],
    ["Slowest PV", "The job that took the longest.", "Last pass slowest PV", AS_IS],
    ["Slowest PV took", "The seconds of that job.", "Last pass slowest PV time (s)", SECONDS],
    ["group", "Over time"],
    ["Passes so far", "Passes completed since the ETL started.", "Passes so far", AS_IS],
    ["Busy per pass, average", "Busy seconds of all passes so far divided by their number.", "Average busy time per pass (s)", SECONDS],
    ["Busy, share of the week", "Busy seconds of the last seven days divided by the seconds since the first of those days, in percent.", "Weekly usage (%)", PERCENT],
    ["Pass running now", "The pass in progress, as jobs done of its PVs; none between passes.", "Current pass", AS_IS],
];

function renderEtl(data) {
    const tiers = etlTiers(data.measures);
    const keys = Object.keys(tiers).sort();
    const table = $("etl");
    table.querySelector("thead").replaceChildren(node("tr", null, node("th"), ...keys.map((key) => node("th", { class: "r" }, TIER_NAMES[key] || key))));
    const body = table.querySelector("tbody");
    body.textContent = "";
    if (!keys.length) {
        body.append(node("tr", null, node("td", { class: "empty" }, "The appliance reported no ETL measures.")));
        return;
    }
    const judged = judgeEtl(tiers);
    body.append(
        node(
            "tr",
            null,
            named("Judgement", "Normal while the last pass of every move ended within its interval, started on time and had no failed job."),
            node("td", { colspan: String(keys.length) }, statusNode(judged.kind, judged.text)),
        ),
    );
    // A pass in progress is reported as its jobs done of its PVs; between passes the measure reads none.
    const current = (values) => (values["Current pass jobs done of PVs"] !== undefined ? String(values["Current pass jobs done of PVs"]) : values["Current pass"] === undefined ? "" : String(values["Current pass"]));
    for (const row of ETL_ROWS) {
        if (row[0] === "group") {
            body.append(groupRow(row[1], keys.length + 1));
            continue;
        }
        const [name, sentence, measure, format] = row;
        const cells = keys.map((key) => {
            const values = tiers[key];
            const raw = measure === "Current pass" ? current(values) : values[measure] === undefined ? "" : String(values[measure]);
            return node("td", { class: "r num" }, measure === "Current pass" ? raw : format(raw));
        });
        body.append(node("tr", null, named(name, sentence), ...cells));
    }
    const m = data.measures;
    const plan = (name, suffix = "", signed = false) => {
        if (!m.has(name)) {
            return "not reported";
        }
        const text = String(m.get(name));
        return `${signed && !text.startsWith("-") ? "+" : ""}${text}${suffix}`;
    };
    fillMeasures("plan", [
        ["Capacity plan computed", "When the capacity plan last read these sums from the appliances.", plan("Capacity planning last update")],
        ["group", "This appliance, from the rates measured at each archive request"],
        ["Storage per year", "The storage rates of all PVs of this appliance, each measured when the PV was archived, added up and scaled to a year.", plan("Aggregated appliance storage rate (in GB/year)", " GB")],
        ["Samples per second", "The sample rates of all PVs of this appliance, each measured when the PV was archived, added up.", plan("Aggregated appliance event rate (in events/sec)")],
        ["Archived PVs", "The PVs of this appliance, paused ones included.", plan("Aggregated appliance PV count")],
        ["group", "Change since the capacity plan"],
        ["Storage per year", "The difference between the sum above now and at the time of the capacity plan.", plan("Incremental appliance storage rate (in GB/year)", " GB", true)],
        ["Samples per second", "The same difference for the sample rates.", plan("Incremental appliance event rate (in events/sec)", "", true)],
        ["Archived PVs", "PVs added, less PVs removed, since the capacity plan.", plan("Incremental appliance PV count", "", true)],
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
    section.append(node("p", { class: "sub" }, `Floor: ${floor.first.toFixed(0)} % at the start of the day, ${floor.last.toFixed(0)} % now.${rhythm}`));
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
        const section = node("div", { class: "process-chart" }, node("h3", null, "Load of the host", " ", infoButton(...LOAD_CARD)));
        const chartHost = node("div");
        section.append(chartHost);
        host.append(section);
        createChart(chartHost, { id: chartId("load"), idPrefix: chartId("load"), dialogTitle: "Load of the host", helpHref: HELP, labelNames: false }).draw({
            series: [{ name: "load", egu: "", points, focus: true }],
            from: new Date(points[0].t),
            to: new Date(points[points.length - 1].t),
            gapMs: 600000,
        });
        const high = Math.max(...points.map((p) => p.v));
        section.append(node("p", { class: "sub" }, `One-minute load average: now ${points[points.length - 1].v.toFixed(1)}, highest today ${high.toFixed(1)}.`));
    }
}

// ---- configuration and thresholds ------------------------------------------------------------------

// The thresholds the judgements use, as rows with the sentence of each; the basis of the values is in the card of the section.
const THRESHOLD_ROWS = [
    ["Days left", "How long the free space lasts at the current growth.", `${THRESHOLDS.daysLeftAttention} / ${THRESHOLDS.daysLeftProblem} days`],
    ["Device free share", "The free part of the device of a store.", `${THRESHOLDS.freeAttentionPercent} / ${THRESHOLDS.freeProblemPercent} %`],
    ["Write time", "The share of the write period the last write took.", `${THRESHOLDS.writeAttentionPercent} / ${THRESHOLDS.writeProblemPercent} %`],
    ["Heap floor", "The lowest heap reading of the last hour, in percent of the maximum heap.", `${THRESHOLDS.heapFloorAttention} / ${THRESHOLDS.heapFloorProblem} %`],
    ["Heap floor rise in a day", "How much the floor rose since the start of the day, in points.", `${THRESHOLDS.heapFloorRiseAttention} points (attention)`],
    ["Disconnected PV", "How long a PV may be disconnected before it is a finding.", `${THRESHOLDS.disconnectedSeconds / 3600} h (attention)`],
    ["Move busy share", "The busy seconds of a pass against its interval.", `${THRESHOLDS.etlBusyProblemPercent} % (problem)`],
];

function renderConfiguration(data) {
    const policies = data.policies ? Object.keys(data.policies).sort() : [];
    fillMeasures("config", [
        ["Minimum sampling period", "The shortest sampling period an archive request may ask for; a setting of the installation.", data.properties && data.properties.minimum_sampling_period ? `${data.properties.minimum_sampling_period} s` : "not reported"],
        ["Appliances in the installation", "The appliances that share the PVs of this archiver.", data.cluster ? `${data.cluster.length}: ${data.cluster.map((a) => a.identity).join(", ")}` : "not read"],
        ["Policies", "The named sampling and storage rules of the site; one is chosen for each PV at its archive request, by its name.", policies.length ? `${policies.length}: ${policies.join(", ")}` : "not read"],
        ["group", "Thresholds the judgements use, attention / problem"],
        ...THRESHOLD_ROWS,
    ]);
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
