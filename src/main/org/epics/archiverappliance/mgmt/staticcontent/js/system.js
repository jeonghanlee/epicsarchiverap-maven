// The System overview: three questions answered first, then one row per measure with what it means and where the
// detail is. The judgements are made in system/judge.js.
import { appliances, get, node, number, settled } from "./system/api.js";
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
import { chooseAppliance, clock, infoButton, pageHref, statusNode } from "./system/view.js";

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
    const rows = [
        {
            item: "Archived PVs",
            now: total === null ? "?" : `${total.toLocaleString()}${paused ? ` (${paused} paused)` : ""}`,
            kind: "ok",
            detail:
                total === null
                    ? "The appliance did not report how many PVs it archives."
                    : `${count(total, "PV")} ${total === 1 ? "is" : "are"} archived${paused ? `; ${paused} of them ${paused === 1 ? "is" : "are"} paused and not sampled` : ", none paused"}.`,
            meaning: [
                ["What it is", "A PV is one named value of the control system, for example a beam current. These are the PVs the archiver keeps samples of. A paused PV is known but is not sampled."],
                ["Judged", "Not judged. It is a count."],
                ["Then", "Samples on the Operations page lists them; Browse PVs finds one by name."],
            ],
            link: "Samples",
            href: "operations.html#samples",
        },
        {
            item: "Connected PVs",
            now: connected === null || total === null ? "?" : `${connected.toLocaleString()} of ${total.toLocaleString()}`,
            kind: connection.kind,
            detail: connection.text || (total === null ? "The appliance did not report the connections." : `${total === 1 ? "The PV is" : `All ${total.toLocaleString()} PVs are`} connected to ${total === 1 ? "its" : "their"} IOC.`),
            meaning: [
                ["What it is", "The archived PVs the engine can reach on the control system network right now. The engine is the part of the appliance that connects to the IOCs and receives their values."],
                ["Normal when", `Every PV is connected, or a PV lost its connection less than ${hours === 1 ? "an hour" : `${hours} hours`} ago, which is often a restart.`],
                ["Attention when", `A PV has been disconnected for more than ${hours === 1 ? "an hour" : `${hours} hours`}. No samples are stored for it.`],
                ["A problem when", "No PV is connected."],
                ["Then", "Samples on the Operations page lists the disconnected PVs by host. Many PVs of one host mean that IOC or its network is down."],
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
            meaning: [
                ["What it is", "A sample is one reading of a PV: its value, with the time and the alarm severity the IOC gave it. This is how many samples reach the engine each second, from all archived PVs together."],
                ["Judged", "Not judged. Read it against what you expect: about the sum of how often your PVs change."],
                ["Look closer when", "It falls to nearly zero (the IOCs stopped sending or the network is cut) or rises suddenly (a PV began to change fast)."],
                ["Then", "Samples on the Operations page shows which PVs send the most."],
            ],
            link: "Samples",
            href: "operations.html#samples",
        },
        {
            item: "Samples dropped",
            now: dropped.pvs ? `${dropped.events.toLocaleString()} from ${dropped.pvs} PV${dropped.pvs > 1 ? "s" : ""}` : "0",
            kind: dropped.kind,
            detail: dropped.text || "No PV reports a dropped sample.",
            meaning: [
                ["What it is", "A dropped sample is one the engine received and then discarded: its timestamp was wrong, the engine's buffer was full, or the type of the PV changed. It is lost data."],
                ["Normal when", "No PV reports a dropped sample."],
                ["A problem when", "Any PV reports one."],
                ["Then", "Samples lost on the Operations page names the PVs and the reason; each reason has its own fix, such as the clock of the IOC or a new archive request."],
            ],
            link: "Samples lost",
            href: "operations.html#dropped",
        },
        {
            item: "Writing to disk",
            now: write.usage === null ? "unknown" : `${write.usage.toFixed(write.usage < 1 ? 2 : 0)} % of the write period`,
            kind: write.kind,
            detail: write.text || `The engine needs ${write.usage.toFixed(write.usage < 1 ? 2 : 0)} % of its write period to write; samples are lost only at ${THRESHOLDS.writeProblemPercent} %.`,
            meaning: [
                ["What it is", "The engine collects samples in memory and writes them out once per write period. This is the share of that period the writing takes."],
                ["Normal when", `Below ${THRESHOLDS.writeAttentionPercent} % of the period.`],
                ["Attention when", `${THRESHOLDS.writeAttentionPercent} % or more.`],
                ["A problem when", `${THRESHOLDS.writeProblemPercent} % or more: the engine cannot keep up and samples are lost.`],
                ["Then", "Write path on the Operations page shows the measures behind it."],
            ],
            link: "Write path",
            href: "operations.html#write",
        },
        {
            item: "Moving data between stores",
            now: etl.kind === "unknown" ? "unknown" : `busiest pass ${etl.busiest.toFixed(0)} % of its interval`,
            kind: etl.kind,
            detail: etl.text || `The busiest pass used ${etl.busiest.toFixed(0)} % of its interval; the passes keep up.`,
            meaning: [
                ["What it is", "The appliance keeps data in three stores: short term, medium term and long term. The ETL moves data from one store to the next at a fixed interval, and each move is a pass."],
                ["Normal when", "Each pass finishes within its interval."],
                ["Attention when", "A pass overran its interval, started late, or a job failed."],
                ["A problem when", `A pass needs ${THRESHOLDS.etlBusyProblemPercent} % or more of its interval.`],
                ["Then", "Stores on the Operations page shows each pass. A short term store that keeps filling means the ETL cannot keep up."],
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
            meaning: [
                ["What it is", "How long the free space of the fullest store lasts at the current growth, with the free share of the fullest device beside it."],
                ["Normal when", `The space lasts ${THRESHOLDS.daysLeftAttention} days or more and at least ${THRESHOLDS.freeAttentionPercent} % is free.`],
                ["Attention when", `Fewer than ${THRESHOLDS.daysLeftAttention} days are left, or less than ${THRESHOLDS.freeAttentionPercent} % is free.`],
                ["A problem when", `Fewer than ${THRESHOLDS.daysLeftProblem} days are left, or less than ${THRESHOLDS.freeProblemPercent} % is free.`],
                ["Then", "Stores on the Operations page shows each device. Archive less of a large prefix or add space."],
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
            meaning: [
                ["What it is", "Retrieval is the server that answers requests for stored data, from the viewer or from your scripts. The numbers are the requests served so far and the users who made them."],
                ["Normal when", "The retrieval process is running."],
                ["A problem when", "It is not running, so no request is answered."],
                ["Then", "The server does not record how long a request takes; Retrieval performance measures one request from your browser."],
            ],
            link: "Retrieval performance",
            href: "retrieval.html",
        },
        {
            item: "Components",
            now: stopped ? String(appliance.status) : "all running",
            kind: components.kind,
            detail: components.text || "Management, engine, ETL and retrieval all run, at the same version.",
            meaning: [
                ["What it is", "Management, engine, ETL and retrieval run as separate processes. Together they are the appliance."],
                ["Normal when", "All four run, at the same version."],
                ["Attention when", "They run different versions."],
                ["A problem when", "The appliance reports that it is not working."],
                ["Then", "Processes on the Operations page shows each one, its uptime and its heap."],
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
    const button = infoButton(row.item, row.meaning, `Open: ${row.link}, in the last column.`, "help.html#system");
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
