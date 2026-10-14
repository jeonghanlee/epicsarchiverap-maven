// The Archive PVs page: names are typed or pasted, requested in one call, and followed until each one is archived.
// The table lists the PVs requested in this visit, with the answer of the request, the state read back from the
// appliance and the actions of that state.
import * as api from "./browse/api.js";
import { infoButton } from "./system/view.js";

const $ = (id) => document.getElementById(id);

// A name as the server reads it: the base name, then an optional field (X:Y.RBV).
const PV_NAME = /^[a-zA-Z0-9:_\-+[\];/,#{}^<>]+(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/;

// States of a PV whose archive request has not finished; the request can still be cancelled.
const PENDING = new Set(["Initial sampling", "Appliance assigned"]);
const RUNNING = new Set(["Being archived", "Disconnected"]);
const POLL_FAST_MS = 2000;
const POLL_SLOW_MS = 10000;
const AFTER_ACTION_MS = 15000;
const INFO_PER_POLL = 6;
const HELP = "help.html#archive";

const CARD = [
    ["Each name", "One name per line, or a pasted list. A name that is already archived is left as it is; the answer of the request says so."],
    ["Sampling", "By default the policy of the site decides the method and the period of each PV. Open the sampling choice to set them yourself."],
    ["Initial sampling", "The appliance first measures the PV, which takes a few minutes. A name that no server answers stays there until you cancel the request."],
    ["Then", "Open an archived PV in Browse PVs to look at its data."],
];

const WORDS = {
    "Appliance assigned": { kind: "wait", note: "The request was accepted and the PV is assigned to an appliance. Sampling has not started yet." },
    "Initial sampling": { kind: "wait", note: "The appliance is looking up the type and settings of the PV. A name that no server answers stays here; cancel the request if the name is wrong." },
    "Being archived": { kind: "ok", note: "" },
    Disconnected: { kind: "bad", note: "The appliance cannot reach this PV on the control system network. No samples are stored until it returns." },
    Paused: { kind: "stop", note: "The appliance knows this PV but is not sampling it. Resume to continue storing samples." },
    "Not being archived": { kind: "stop", note: "The appliance has no request for this PV." },
    "Appliance Down": { kind: "bad", note: "The appliance that holds this PV does not answer, so its state cannot be read." },
};

const rows = new Map(); // name -> {name, answer, kind, status, info, note, selected}
let order = [];
let minimumPeriod = 0.1;
let pollTimer = 0;
let fastUntil = 0;
let stopTargets = [];

function node(tag, attributes, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes || {})) {
        if (value !== undefined && value !== null) {
            element.setAttribute(key, value);
        }
    }
    element.append(...children.filter((child) => child !== null && child !== undefined));
    return element;
}

function say(text, isError) {
    const outcome = $("outcome");
    outcome.textContent = text;
    outcome.classList.toggle("error", Boolean(isError));
}

// ---- the input -------------------------------------------------------------------------------------

function typedNames() {
    const seen = new Set();
    return $("names")
        .value.split(/\s+/)
        .filter(Boolean)
        .filter((name) => !seen.has(name) && seen.add(name));
}

function choice() {
    return { method: $("method").value, period: $("period").value.trim(), policy: $("policy").value, controlling: $("controlling").value.trim() };
}

function describeChoice(c) {
    const parts = [];
    if (c.method) {
        parts.push(c.method === "SCAN" ? "Scan" : "Monitor");
    }
    if (c.period) {
        parts.push(`${c.period} s`);
    }
    if (c.policy) {
        parts.push(`policy ${c.policy}`);
    }
    if (c.controlling) {
        parts.push(`only while ${c.controlling} is true`);
    }
    return parts.length ? parts.join(", ") : "the site policy decides";
}

function choiceProblem(c) {
    if (c.period && !(Number(c.period) >= minimumPeriod)) {
        return `The period is at least ${minimumPeriod} seconds.`;
    }
    return "";
}

function refreshInput() {
    const list = typedNames();
    const bad = list.filter((name) => !PV_NAME.test(name));
    const good = list.length - bad.length;
    const c = choice();
    const problem = choiceProblem(c);
    $("choiceSummary").textContent = describeChoice(c);
    $("choiceError").textContent = problem;
    $("choiceError").classList.toggle("error", Boolean(problem));
    const note = $("parseNote");
    note.textContent = "";
    if (!list.length) {
        note.textContent = "Names are read one per line; spaces and tabs also separate them.";
    } else {
        note.append(`${good} name${good === 1 ? "" : "s"}`);
        if (bad.length) {
            note.append(", not valid PV names: ");
            bad.slice(0, 5).forEach((name, index) => note.append(index ? ", " : "", node("span", { class: "bad" }, name)));
            if (bad.length > 5) {
                note.append(` and ${bad.length - 5} more`);
            }
        }
    }
    $("archive").disabled = list.length === 0 || Boolean(problem);
    $("archive").textContent = list.length > 1 ? `Archive ${list.length} PVs` : "Archive";
}

// ---- the request -----------------------------------------------------------------------------------

/** Asks the server for each valid name; a name that is not valid is listed and not sent. */
async function request(list, c) {
    const valid = list.filter((name) => PV_NAME.test(name));
    const items = valid.map((pv) => {
        const item = { pv };
        if (c.period) {
            item.samplingperiod = c.period;
        }
        if (c.method) {
            item.samplingmethod = c.method;
        }
        if (c.controlling) {
            item.controllingPV = c.controlling;
        }
        if (c.policy) {
            item.policy = c.policy;
        }
        return item;
    });
    let answers = [];
    if (items.length) {
        try {
            answers = await api.archivePVs(items);
        } catch (error) {
            say(`The archive request failed: ${error.message}`, true);
            return false;
        }
    }
    const answerOf = new Map((Array.isArray(answers) ? answers : [answers]).map((a) => [a.pvName, a.status]));
    for (const name of list) {
        const row = rows.get(name) || { name, selected: false };
        rows.set(name, row);
        order = order.filter((other) => other !== name);
        order.unshift(name);
        row.note = "";
        row.info = undefined;
        if (!PV_NAME.test(name)) {
            row.kind = "invalid";
            row.answer = "Not a valid PV name";
            row.status = null;
        } else {
            row.kind = "requested";
            row.answer = answerOf.get(name) || "The server gave no answer";
            row.status = null;
        }
    }
    $("requested").hidden = false;
    say("");
    fastUntil = Date.now() + AFTER_ACTION_MS;
    render();
    poll();
    return true;
}

// ---- following the PVs -----------------------------------------------------------------------------

function wordOf(row) {
    if (row.kind === "invalid") {
        return "Not requested";
    }
    if (!row.status) {
        return null;
    }
    if (row.status.status === "Being archived" && String(row.status.connectionState) === "false") {
        return "Disconnected";
    }
    return row.status.status;
}

async function poll() {
    window.clearTimeout(pollTimer);
    const names = order.filter((name) => rows.get(name).kind === "requested");
    if (!names.length) {
        return;
    }
    try {
        const result = await api.pvStatus(names);
        for (const item of result) {
            const row = rows.get(item.pvName);
            if (row) {
                row.status = item;
            }
        }
        await readPolicies(names);
        render();
    } catch (error) {
        say(`The states could not be read: ${error.message}`, true);
    }
    const unfinished = names.some((name) => {
        const word = wordOf(rows.get(name));
        return !word || PENDING.has(word);
    });
    pollTimer = window.setTimeout(poll, unfinished || Date.now() < fastUntil ? POLL_FAST_MS : POLL_SLOW_MS);
}

/** What the policy chose for a PV that is being archived, read once from its settings. */
async function readPolicies(names) {
    const wanted = names.filter((name) => {
        const row = rows.get(name);
        return RUNNING.has(wordOf(row)) && row.info === undefined;
    });
    for (const name of wanted.slice(0, INFO_PER_POLL)) {
        const row = rows.get(name);
        try {
            const info = await api.typeInfo(name);
            row.info = { policy: info.policyName, method: info.samplingMethod, period: info.samplingPeriod };
        } catch (error) {
            row.info = null;
        }
    }
}

function detailOf(row, word) {
    if (row.kind === "invalid") {
        return "Names use letters, digits and : _ - + [ ] ; / , # { } ^ < >, with an optional field after a dot.";
    }
    if (RUNNING.has(word) && row.status) {
        const monitored = String(row.status.isMonitored) === "true";
        const parts = [`${monitored ? "monitored" : "scanned"}, ${row.status.samplingPeriod} s`];
        if (row.info && row.info.policy) {
            parts.push(`policy ${row.info.policy}`);
        }
        const text = parts.join(", ");
        return row.status.lastEvent ? `${text}; last event ${row.status.lastEvent}` : text;
    }
    if (row.note) {
        return row.note;
    }
    return (WORDS[word] && WORDS[word].note) || "";
}

function actionsOf(row, word) {
    const button = (label, handler, className) => {
        const element = node("button", { type: "button", class: `link ${className || ""}`.trim() }, label);
        element.addEventListener("click", handler);
        return element;
    };
    if (!word || row.kind === "invalid") {
        return [];
    }
    if (PENDING.has(word)) {
        return [button("Cancel request", () => cancel([row]))];
    }
    if (RUNNING.has(word)) {
        return [button("Pause", () => pauseOrResume([row], "pause")), button("Stop archiving…", () => openStop([row]), "danger")];
    }
    if (word === "Paused") {
        return [button("Resume", () => pauseOrResume([row], "resume")), button("Stop archiving…", () => openStop([row]), "danger")];
    }
    if (word === "Not being archived") {
        return [button("Archive again", () => request([row.name], choice()))];
    }
    return [];
}

function render() {
    const body = $("requestRows");
    body.textContent = "";
    for (const name of order) {
        const row = rows.get(name);
        const word = wordOf(row);
        const meta = WORDS[word] || { kind: row.kind === "invalid" ? "bad" : "wait" };
        const box = node("input", { type: "checkbox", "aria-label": `Select ${name}` });
        box.checked = row.selected;
        box.addEventListener("change", () => {
            row.selected = box.checked;
            counts();
        });
        const state = node("td", null, node("span", { class: `st ${meta.kind}` }, word || "Reading the state"), node("span", { class: "detail" }, detailOf(row, word)));
        const actions = node("td", null);
        actionsOf(row, word).forEach((element) => actions.append(element, " "));
        body.append(node("tr", null, node("td", null, box), node("td", { class: "pv" }, name), node("td", null, row.answer), state, actions));
    }
    counts();
}

function counts() {
    const all = order.map((name) => rows.get(name));
    const words = all.map((row) => wordOf(row));
    const count = (test) => words.filter(test).length;
    const parts = [`${all.length} listed`];
    const archived = count((w) => w === "Being archived");
    const pending = count((w) => PENDING.has(w));
    const paused = count((w) => w === "Paused");
    const disconnected = count((w) => w === "Disconnected");
    const not = count((w) => w === "Not being archived" || w === "Not requested");
    if (archived) {
        parts.push(`${archived} being archived`);
    }
    if (disconnected) {
        parts.push(`${disconnected} disconnected`);
    }
    if (pending) {
        parts.push(`${pending} waiting for the appliance`);
    }
    if (paused) {
        parts.push(`${paused} paused`);
    }
    if (not) {
        parts.push(`${not} not archived`);
    }
    $("summaryLine").textContent = parts.join(", ");
    const chosen = all.filter((row) => row.selected).length;
    $("selectedCount").textContent = `${chosen} selected`;
    for (const id of ["bulkPause", "bulkResume", "bulkStop", "bulkCancel"]) {
        $(id).disabled = chosen === 0;
    }
    $("selectAll").checked = all.length > 0 && chosen === all.length;
}

function selectedRows() {
    return order.map((name) => rows.get(name)).filter((row) => row.selected);
}

// ---- actions ---------------------------------------------------------------------------------------

function afterAction() {
    fastUntil = Date.now() + AFTER_ACTION_MS;
    render();
    poll();
}

/** One sentence for the answers of a call on several PVs; a PV that did not answer ok is counted as left. */
function counted(results) {
    const ok = results.filter((item) => item && item.status === "ok").length;
    return { ok, left: results.length - ok };
}

async function cancel(list) {
    let done = 0;
    const failed = [];
    for (const row of list) {
        try {
            await api.pvAction("../bpl/abortArchivingPV", row.name);
            row.note = "The request was cancelled.";
            done += 1;
        } catch (error) {
            failed.push(`${row.name}: ${error.message}`);
        }
    }
    say(`${done ? `Cancelled ${done} request${done === 1 ? "" : "s"}.` : ""}${failed.length ? ` Could not cancel ${failed.join("; ")}.` : ""}`.trim(), failed.length > 0);
    afterAction();
}

async function pauseOrResume(list, kind) {
    const wanted = list.filter((row) => (kind === "pause" ? RUNNING.has(wordOf(row)) : wordOf(row) === "Paused"));
    const skipped = list.length - wanted.length;
    const verb = kind === "pause" ? "Paused" : "Resumed";
    if (!wanted.length) {
        say(`Nothing to ${kind}: ${skipped} of the selected PV${skipped === 1 ? " is" : "s are"} not ${kind === "pause" ? "being archived" : "paused"}.`, true);
        return;
    }
    try {
        const results = await api.bulk(kind === "pause" ? "../bpl/pauseArchivingPV" : "../bpl/resumeArchivingPV", wanted.map((row) => row.name));
        const { ok, left } = counted(results);
        say(`${verb} ${ok}.${left + skipped ? ` Left ${left + skipped} unchanged.` : ""}`, ok === 0);
    } catch (error) {
        say(`${kind === "pause" ? "Pause" : "Resume"} failed: ${error.message}`, true);
    }
    afterAction();
}

function openStop(list) {
    stopTargets = list;
    $("stopName").textContent = list.length === 1 ? list[0].name : `${list.length} PVs`;
    $("stopData").checked = false;
    $("stopError").textContent = "";
    $("stopDialog").showModal();
}

async function stopSelected() {
    const deleteData = String($("stopData").checked);
    const pending = stopTargets.filter((row) => PENDING.has(wordOf(row)));
    const running = stopTargets.filter((row) => RUNNING.has(wordOf(row)));
    const paused = stopTargets.filter((row) => wordOf(row) === "Paused");
    const other = stopTargets.length - pending.length - running.length - paused.length;
    $("stopDialog").close();
    const parts = [];
    let isError = false;
    try {
        if (running.length) {
            await api.bulk("../bpl/pauseArchivingPV", running.map((row) => row.name));
        }
        const removable = running.concat(paused);
        if (removable.length) {
            const results = await api.bulk("../bpl/deletePV", removable.map((row) => row.name), { deleteData });
            const { ok, left } = counted(results);
            parts.push(`Stopped ${ok} PV${ok === 1 ? "" : "s"}${deleteData === "true" && ok ? " and deleted their stored data" : ""}`);
            if (left) {
                parts.push(`${left} could not be stopped`);
                isError = true;
            }
            for (const row of removable) {
                row.note = deleteData === "true" ? "Stopped; the stored data was deleted." : "Stopped; the stored data stays.";
            }
        }
    } catch (error) {
        parts.push(`Stop failed: ${error.message}`);
        isError = true;
    }
    if (pending.length) {
        // A request that has not started has no settings to stop; it is cancelled, and the answer says so.
        let cancelled = 0;
        for (const row of pending) {
            try {
                await api.pvAction("../bpl/abortArchivingPV", row.name);
                row.note = "The request was cancelled.";
                cancelled += 1;
            } catch (error) {
                parts.push(`${row.name} could not be cancelled: ${error.message}`);
                isError = true;
            }
        }
        if (cancelled) {
            parts.push(`cancelled ${cancelled} pending request${cancelled === 1 ? "" : "s"} instead, because a request that has not started cannot be stopped`);
        }
    }
    if (other) {
        parts.push(`left ${other} that ${other === 1 ? "is" : "are"} not archived`);
    }
    say(`${parts.join("; ")}.`, isError);
    afterAction();
}

// ---- start -----------------------------------------------------------------------------------------

async function start() {
    $("pageHeading").parentElement.append(" ", infoButton("Archive PVs: adding PVs and following them", CARD, null, HELP));
    for (const id of ["names", "method", "period", "policy", "controlling"]) {
        $(id).addEventListener("input", refreshInput);
    }
    $("archive").addEventListener("click", async () => {
        const list = typedNames();
        if (list.length && (await request(list, choice()))) {
            $("names").value = "";
            refreshInput();
        }
    });
    $("clearNames").addEventListener("click", () => {
        $("names").value = "";
        refreshInput();
        $("names").focus();
    });
    $("bulkPause").addEventListener("click", () => pauseOrResume(selectedRows(), "pause"));
    $("bulkResume").addEventListener("click", () => pauseOrResume(selectedRows(), "resume"));
    $("bulkStop").addEventListener("click", () => openStop(selectedRows()));
    $("bulkCancel").addEventListener("click", () => {
        const wanted = selectedRows().filter((row) => PENDING.has(wordOf(row)));
        if (!wanted.length) {
            say("None of the selected PVs is waiting for the appliance.", true);
            return;
        }
        cancel(wanted);
    });
    $("selectAll").addEventListener("change", (event) => {
        order.forEach((name) => {
            rows.get(name).selected = event.target.checked;
        });
        render();
    });
    $("stopCancel").addEventListener("click", () => $("stopDialog").close());
    $("stopForm").addEventListener("submit", (event) => {
        event.preventDefault();
        stopSelected();
    });
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && order.length) {
            poll();
        }
    });

    // Names carried in the address (pv=NAME, repeatable) fill the input.
    const carried = new URLSearchParams(window.location.hash.slice(1)).getAll("pv");
    if (carried.length) {
        $("names").value = carried.join("\n");
    }
    refreshInput();

    try {
        const properties = await api.applianceProperties();
        const minimum = Number(properties && properties.minimum_sampling_period);
        if (Number.isFinite(minimum) && minimum > 0) {
            minimumPeriod = minimum;
            $("period").min = String(minimum);
            $("period").placeholder = "the policy decides";
            refreshInput();
        }
    } catch (error) {
        // The default minimum stays.
    }
    try {
        const response = await fetch("../bpl/getPolicyList");
        if (response.ok) {
            const policies = await response.json();
            for (const name of Object.keys(policies).sort()) {
                $("policy").append(node("option", { value: name }, name));
            }
        }
    } catch (error) {
        // The list is an option; without it the policy stays the normal selection.
    }
}

start();
