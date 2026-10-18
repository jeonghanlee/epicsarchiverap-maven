// The System overview: three questions answered first, then one row per measure with what it means and where the
// detail is. The judgements are made in system/judge.js.
import { infoButton } from "../comm/js/aa/card.js";
import { node } from "../comm/js/aa/dom.js";
import { appliances, get, number, settled } from "./system/api.js";
import {
    DROPPED_REPORTS,
    THRESHOLDS,
    daysText,
    etlTiers,
    judgeConnections,
    judgeDropped,
    judgeEtl,
    judgeStorage,
    judgeWrite,
    measureMap,
    worst,
} from "./system/judge.js";
import { chooseAppliance, clock, pageHref, statusNode } from "./system/view.js";

const $ = (id) => document.getElementById(id);
const REFRESH_MS = 20000;
let list = [];
let current = null;
let timer = 0;

async function gather(appliance) {
    const name = appliance.instance;
    const [load, storage, disconnected, never, versions, ...dropped] = await settled([
        get("../bpl/getApplianceMetricsForAppliance", { appliance: name }),
        get("../bpl/getStorageMetricsForAppliance", { appliance: name }),
        get("../bpl/getCurrentlyDisconnectedPVs"),
        get("../bpl/getNeverConnectedPVs"),
        get("../bpl/getVersions"),
        ...DROPPED_REPORTS.map((report) => get(report.endpoint, { limit: "1000" })),
    ]);
    const mine = (rows) => (rows ? rows.filter((row) => !row.instance || row.instance === name) : rows);
    return {
        measures: measureMap(load),
        storage,
        disconnected: mine(disconnected),
        never: mine(never),
        versions,
        dropped: dropped.map(mine),
    };
}

function rowsFor(appliance, data) {
    const measures = data.measures;
    const connection = judgeConnections(appliance, data.disconnected, data.never);
    const dropped = judgeDropped(data.dropped);
    const write = judgeWrite(measures);
    const etl = judgeEtl(etlTiers(measures));
    const bytesPerSecond = number(appliance.dataRate);
    const storage = judgeStorage(data.storage, bytesPerSecond);
    const total = number(appliance.pvCount);
    const connected = number(appliance.connectedPVCount);
    const paused = number(measures.get("Paused PV count"));
    const events = number(measures.get("Event Rate (in events/sec)"));
    const requests = measures.get("Number of Retrieval Requests");
    const users = measures.get("Number of unique users");
    const stopped = String(appliance.status) !== "Working";
    const retrievalDown = /retrieval/i.test(String(appliance.status)) && stopped;
    const differing = data.versions && "components_with_different_versions" in data.versions;
    const free = data.storage && data.storage.length ? Math.min(...data.storage.map((d) => number(d.available_space_percent) ?? 100)) : null;
    const components = stopped
        ? { kind: "bad", text: `The appliance reports: ${appliance.status}.` }
        : differing
          ? { kind: "warn", text: "The components run different versions." }
          : { kind: "ok", text: "" };
    const count = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
    const hours = THRESHOLDS.disconnectedSeconds / 3600;
    const hoursText = hours === 1 ? "an hour" : `${hours} hours`;
    const rows = [
        {
            item: "Archived PVs",
            now: total === null ? "?" : `${total.toLocaleString()}${paused ? ` (${paused} paused)` : ""}`,
            kind: "ok",
            detail:
                total === null
                    ? "The appliance did not report how many PVs it archives."
                    : `${count(total, "PV")} ${total === 1 ? "is" : "are"} archived${paused ? `; ${paused} of them ${paused === 1 ? "is" : "are"} paused and not sampled` : ", none paused"}.`,
            card: [
                "Archived PVs: how many does the archiver keep?",
                [
                    ["In short", "The PVs the archiver keeps samples of; a paused PV is known but not sampled. A count, not judged."],
                    ["What it shows", "A PV is one named value of the control system, for example a beam current. The number of PVs archived, and how many of them are paused."],
                    ["What to do", "Samples on the Operations page lists them; Browse PVs finds one by name."],
                ],
            ],
            link: "Samples",
            href: "operations.html#samples",
        },
        {
            item: "Connected PVs",
            now: connected === null || total === null ? "?" : `${connected.toLocaleString()} of ${total.toLocaleString()}`,
            kind: connection.kind,
            detail: connection.text || (total === null ? "The appliance did not report the connections." : `${total === 1 ? "The PV is" : `All ${total.toLocaleString()} PVs are`} connected to ${total === 1 ? "its" : "their"} IOC.`),
            card: [
                "Connected PVs: can the engine reach them?",
                [
                    ["In short", `The archived PVs the engine reaches on the control system network right now; a PV disconnected for more than ${hoursText} needs a look.`],
                    ["What it shows", "The engine is the part of the appliance that connects to the IOCs and receives their values. The connected PVs against the archived PVs."],
                    ["Normal", `Every PV is connected, or a PV lost its connection less than ${hoursText} ago, which is often a restart.`],
                    ["Attention", `A PV has been disconnected for more than ${hoursText}. No samples are stored for it.`],
                    ["Problem", "No PV is connected."],
                    ["What to do", "Samples on the Operations page lists the disconnected PVs by host. Many PVs of one host mean that IOC or its network is down."],
                ],
            ],
            link: "Samples",
            href: "operations.html#samples",
        },
        {
            item: "Samples arriving",
            now: events === null ? `${appliance.eventRate} per second` : `${events.toLocaleString(undefined, { maximumFractionDigits: 1 })} per second`,
            kind: "ok",
            detail:
                events === null || connected === null
                    ? "The appliance did not report how fast samples arrive."
                    : events === 0
                      ? `No sample arrived in the last measurement, from ${count(connected, "connected PV")}.`
                      : `${events.toLocaleString(undefined, { maximumFractionDigits: 1 })} samples arrive each second from ${count(connected, "connected PV")}.`,
            card: [
                "Samples arriving: how fast do values come in?",
                [
                    ["In short", "How many samples reach the engine each second from all archived PVs together. Not judged: read it against what you expect, about the sum of how often your PVs change."],
                    ["What it shows", "A sample is one reading of a PV: its value, with the time and the alarm severity the IOC gave it. The server calls a sample an event."],
                    ["What to do", "Look closer when it falls to nearly zero, the IOCs stopped sending or the network is cut, or when it rises suddenly, a PV began to change fast. Samples on the Operations page shows which PVs send the most."],
                ],
            ],
            link: "Samples",
            href: "operations.html#samples",
        },
        {
            item: "Samples dropped",
            now: dropped.pvs ? `${dropped.events.toLocaleString()} from ${dropped.pvs} PV${dropped.pvs > 1 ? "s" : ""}` : "0",
            kind: dropped.kind,
            detail: dropped.text || "No PV reports a dropped sample.",
            card: [
                "Samples dropped: is data lost?",
                [
                    ["In short", "A dropped sample is one the engine received and then discarded. It is lost data."],
                    ["What it shows", "The samples dropped for a wrong time stamp, by buffer overflow and by a type change, summed over the PVs that report one."],
                    ["Normal", "No PV reports a dropped sample."],
                    ["Problem", "Any PV reports one; the stored data of that PV has holes."],
                    ["What to do", "Samples lost on the Operations page names the PVs and the cause. A wrong time stamp asks for the clock of the IOC, a buffer overflow for a shorter sampling period, a type change for the type change in Maintenance."],
                ],
            ],
            link: "Samples lost",
            href: "operations.html#dropped",
        },
        {
            item: "Writing to disk",
            now: write.usage === null ? "unknown" : `${write.usage.toFixed(write.usage < 1 ? 2 : 0)} % of the write period`,
            kind: write.kind,
            detail: write.text || `The engine needs ${write.usage.toFixed(write.usage < 1 ? 2 : 0)} % of its write period to write; samples are lost only at ${THRESHOLDS.writeProblemPercent} %.`,
            card: [
                "Writing to disk: does the engine keep up?",
                [
                    ["In short", `The share of the write period the engine needs to write its samples; at ${THRESHOLDS.writeProblemPercent} % samples are lost.`],
                    ["What it shows", "The engine collects samples in memory and writes them to the short term store once per write period."],
                    ["Normal", `Below ${THRESHOLDS.writeAttentionPercent} % of the period.`],
                    ["Attention", `${THRESHOLDS.writeAttentionPercent} % or more.`],
                    ["Problem", `${THRESHOLDS.writeProblemPercent} % or more: the engine cannot keep up and samples are lost.`],
                    ["What to do", "Write path on the Operations page shows the measures behind it."],
                ],
            ],
            link: "Write path",
            href: "operations.html#write",
        },
        {
            item: "Moving data between stores",
            now: etl.kind === "unknown" ? "unknown" : `busiest pass ${etl.busiest.toFixed(0)} % of its interval`,
            kind: etl.kind,
            detail: etl.text || `The busiest pass used ${etl.busiest.toFixed(0)} % of its interval; the passes keep up.`,
            card: [
                "Moving data between stores: does the ETL keep up?",
                [
                    ["In short", "The ETL moves data from one store to the next at a fixed interval, and each pass must finish within its interval."],
                    ["What it shows", "The appliance keeps data in three stores: short term, medium term and long term. The busiest pass, as a share of its interval."],
                    ["Normal", "Each pass finishes within its interval."],
                    ["Attention", "A pass overran its interval, started late, or a job failed."],
                    ["Problem", `A pass needs ${THRESHOLDS.etlBusyProblemPercent} % or more of its interval.`],
                    ["What to do", "Stores on the Operations page shows each pass. A short term store that keeps filling means the ETL cannot keep up."],
                ],
            ],
            link: "Stores",
            href: "operations.html#stores",
        },
        {
            item: "Storage left",
            now: `${daysText(storage.days)}${free === null ? "" : `, ${free.toFixed(1)} % free`}`,
            kind: storage.kind,
            detail:
                storage.text ||
                (storage.days === null
                    ? `${free === null ? "No" : `${free.toFixed(1)} % of the fullest device is free; no`} data is added at the moment, so the days left cannot be computed.`
                    : `At the current growth the space lasts ${daysText(storage.days)}${free === null ? "" : `, and the fullest device has ${free.toFixed(1)} % free`}.`),
            card: [
                "Storage left: how long does the space last?",
                [
                    ["In short", "How long the free space of the fullest store lasts at the current growth, with the free share of the fullest device beside it."],
                    ["Normal", `The space lasts ${THRESHOLDS.daysLeftAttention} days or more and at least ${THRESHOLDS.freeAttentionPercent} % is free.`],
                    ["Attention", `Fewer than ${THRESHOLDS.daysLeftAttention} days are left, or less than ${THRESHOLDS.freeAttentionPercent} % is free.`],
                    ["Problem", `Fewer than ${THRESHOLDS.daysLeftProblem} days are left, or less than ${THRESHOLDS.freeProblemPercent} % is free.`],
                    ["What to do", "Stores on the Operations page shows each device. Archive less of a large prefix or add space."],
                ],
            ],
            link: "Stores",
            href: "operations.html#stores",
        },
        {
            item: "Retrieval",
            now: requests === undefined ? "?" : `${requests} request${requests === "1" ? "" : "s"}, ${users ?? "?"} user${users === "1" ? "" : "s"}`,
            kind: retrievalDown ? "bad" : "ok",
            detail: retrievalDown
                ? "The retrieval process is not running, so no request is served."
                : requests === undefined
                  ? "The retrieval process is running; the appliance did not report how many requests it served."
                  : `The retrieval process is running and has served ${requests} request${requests === "1" ? "" : "s"} for ${users ?? "?"} user${users === "1" ? "" : "s"}.`,
            card: [
                "Retrieval: is stored data being served?",
                [
                    ["In short", "Retrieval is the server that answers requests for stored data, from the console, the analyzer or your scripts; it must run."],
                    ["What it shows", "The requests served so far and the users who made them."],
                    ["Normal", "The retrieval process is running."],
                    ["Problem", "It is not running, so no request is answered."],
                    ["What to do", "The server does not record how long a request takes; Retrieval performance measures one request from your browser."],
                ],
            ],
            link: "Retrieval performance",
            href: "retrieval.html",
        },
        {
            item: "Components",
            now: stopped ? String(appliance.status) : "all running",
            kind: components.kind,
            detail: components.text || "Management, engine, ETL and retrieval all run, at the same version.",
            card: [
                "Components: do all four run?",
                [
                    ["In short", "Management, engine, ETL and retrieval run as separate processes; together they are the appliance."],
                    ["Normal", "All four run, at the same version."],
                    ["Attention", "They run different versions."],
                    ["Problem", "The appliance reports that it is not working."],
                    ["What to do", "Processes on the Operations page shows each one, its uptime and its heap."],
                ],
            ],
            link: "Processes",
            href: "operations.html#processes",
        },
    ];
    return { rows, connection, dropped, write, etl, storage, retrievalDown, stopped };
}

/** The item name with its information button; the last word and the button never part, so the button is not alone. */
function itemCell(row) {
    const cut = row.item.lastIndexOf(" ");
    const head = cut < 0 ? "" : `${row.item.slice(0, cut)} `;
    const last = cut < 0 ? row.item : row.item.slice(cut + 1);
    const button = infoButton(row.card[0], row.card[1], `Open: ${row.link}, in the last column.`, "help.html#system");
    return node("td", null, head, node("span", { class: "nobreak" }, last, button));
}

function render(appliance, data) {
    const result = rowsFor(appliance, data);
    const { rows } = result;
    const STORING = ["Connected PVs", "Samples dropped", "Writing to disk", "Moving data between stores"];
    const rowOf = (name) => rows.find((row) => row.item === name);
    const findings = (items) => worst(rows.filter((row) => items.includes(row.item)).map((row) => row.kind));
    const unreportedIn = (items) => rows.filter((row) => items.includes(row.item) && row.kind === "unknown");
    const firstProblem = (items) => rows.filter((row) => items.includes(row.item) && (row.kind === "warn" || row.kind === "bad")).sort((a, b) => (a.kind === "bad" ? -1 : 1) - (b.kind === "bad" ? -1 : 1))[0];
    const connected = number(appliance.connectedPVCount);
    const total = number(appliance.pvCount);
    const events = rowOf("Samples arriving");
    // A line is Normal only when every measure it rests on is reported and fine; a measure that is not reported makes it
    // Not reported, with the sentence that says what is still unknown.
    const storingProblem = firstProblem(STORING);
    const storingUnknown = unreportedIn(STORING);
    const storingKind = findings(STORING) !== "ok" ? findings(STORING) : storingUnknown.length ? "unknown" : "ok";
    const verdicts = [
        {
            what: "Storing samples",
            kind: storingKind,
            text: storingProblem
                ? `${storingProblem.detail} See ${storingProblem.link}.`
                : `${connected === null ? "?" : connected.toLocaleString()} of ${total === null ? "?" : total.toLocaleString()} PVs are connected, ${events ? events.now.replace(" per second", "") : "?"} samples arrive per second and none are dropped.${storingUnknown.length ? ` Not yet reported: ${storingUnknown.map((row) => row.item.toLowerCase()).join(", ")}. See ${storingUnknown[0].link}.` : ""}`,
        },
        {
            what: "Reading data",
            kind: result.retrievalDown ? "bad" : "ok",
            text: result.retrievalDown ? "Retrieval is not running. See Processes." : rowOf("Retrieval").detail,
        },
        {
            what: "Room left",
            kind: result.storage.kind,
            text: result.storage.kind === "ok" ? rowOf("Storage left").detail : `${result.storage.text} See Stores.`,
        },
    ];
    const overall = worst([...verdicts.map((v) => v.kind), ...rows.map((r) => r.kind)]);
    const unreported = rows.filter((row) => row.kind === "unknown").length;
    const normal = unreported ? `no problem found, ${unreported} measure${unreported > 1 ? "s" : ""} not reported` : "archiving normally";
    $("headline").textContent = `${appliance.instance}: ${overall === "ok" ? normal : overall === "warn" ? "needs a look" : "needs action"}`;
    const verdictList = $("verdicts");
    verdictList.textContent = "";
    for (const verdict of verdicts) {
        verdictList.append(node("li", null, node("span", { class: "what" }, verdict.what), statusNode(verdict.kind, verdict.text)));
    }
    const body = $("summary").querySelector("tbody");
    body.textContent = "";
    for (const row of rows) {
        body.append(
            node(
                "tr",
                null,
                itemCell(row),
                node("td", { class: "num" }, row.now),
                node("td", null, statusNode(row.kind, "")),
                node("td", { class: "detail" }, row.detail),
                node("td", null, node("a", { href: pageHref(row.href) }, row.link)),
            ),
        );
    }
    $("asOf").textContent = `As of ${clock()}, refreshed every ${REFRESH_MS / 1000} s while this page is open.`;
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
        $("headline").textContent = "No appliance reported metrics";
        return;
    }
    $("versionLine").textContent = "";
    try {
        const data = await gather(current);
        render(current, data);
        const versions = data.versions;
        if (versions) {
            $("versionLine").textContent = String(versions.mgmt_version || "");
        }
    } catch (error) {
        $("problem").textContent = `The status could not be judged: ${error.message}`;
    }
}

function start() {
    refresh();
    window.clearInterval(timer);
    timer = window.setInterval(() => {
        if (!document.hidden) {
            refresh();
        }
    }, REFRESH_MS);
}

start();
