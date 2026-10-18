// The External servers tab of System: the other EPICS Archiver Appliance clusters this appliance serves data for.
import { infoButton } from "../comm/js/aa/card.js";
import { node } from "../comm/js/aa/dom.js";

const $ = (id) => document.getElementById(id);
const HELP = "help.html#system";

// ---- the cards of the list and of the two windows --------------------------------------------------

const CARDS = [
    [
        "pageHeading",
        "External servers: whose data does this appliance serve?",
        [
            ["In short", "Other EPICS Archiver Appliance clusters whose stored data this appliance serves through its own retrieval, each with its address and its indexes."],
            ["Server URL", "The retrieval address of the other cluster, its data_retrieval_url: host, port and /retrieval."],
            ["Indexes", "The archives of that server this appliance serves; pbraw is the raw data of an archiver appliance."],
            ["What to do", "Add a server… connects another cluster; Remove… beside a server stops serving its data."],
        ],
    ],
    [
        "addTitle",
        "Add a server: what do I give?",
        [
            ["In short", "The data_retrieval_url of the other cluster, as its appliances.xml defines it: its host and port, then /retrieval."],
            ["Connect", "This appliance asks the server for its archives and serves its raw data from then on. A server that does not answer is refused, with the reason."],
        ],
    ],
    [
        "removeTitle",
        "Remove the server: what stops?",
        [
            ["In short", "This appliance stops serving the data of that server; the data of this appliance is untouched."],
            ["What to do", "The cluster may have to be restarted before the change takes effect."],
        ],
    ],
];

for (const [heading, title, rows] of CARDS) {
    $(heading).append(" ", infoButton(title, rows, null, HELP));
}

async function getJSON(path, parameters) {
    const query = parameters ? `?${new URLSearchParams(parameters)}` : "";
    const response = await fetch(`${path}${query}`);
    if (!response.ok) {
        throw new Error(`${response.statusText || "the server could not complete the request"} (HTTP ${response.status})`);
    }
    return response.json();
}

function say(text, isError) {
    const message = $("message");
    message.textContent = text;
    message.classList.toggle("error", Boolean(isError));
}

async function loadServers() {
    const body = $("servers").querySelector("tbody");
    body.textContent = "";
    let servers;
    try {
        servers = await getJSON("../bpl/getExternalArchiverServers");
    } catch (error) {
        body.append(node("tr", null, node("td", { colspan: "3", class: "empty" }, `The list could not be read: ${error.message}`)));
        return;
    }
    if (!servers.length) {
        body.append(node("tr", null, node("td", { colspan: "3", class: "empty" }, "No external server is configured.")));
        return;
    }
    for (const server of servers) {
        const remove = node("button", { type: "button", class: "plain danger" }, "Remove…");
        remove.addEventListener("click", () => openRemove(server));
        body.append(
            node(
                "tr",
                null,
                node("td", { class: "pv" }, String(server.CAUrl)),
                node("td", { class: "num" }, String(server.indexes)),
                node("td", { class: "r" }, remove),
            ),
        );
    }
}

function openAdd() {
    $("serverUrl").value = "";
    $("addError").textContent = "";
    $("addDialog").showModal();
}

async function submitAdd(event) {
    event.preventDefault();
    $("addError").textContent = "";
    const url = $("serverUrl").value.trim();
    try {
        const answer = await getJSON("../bpl/addExternalArchiverServer", { externalarchiverserverurl: url, externalServerType: "ARCHAPPL_PBRAW" });
        if (answer.validation) {
            $("addError").textContent = answer.validation;
            return;
        }
        await getJSON("../bpl/addExternalArchiverServerArchives", { channelarchiverserverurl: url, archives: "pbraw" });
        $("addDialog").close();
        say("The server was added.");
        loadServers();
    } catch (error) {
        $("addError").textContent = `The server could not be reached: ${error.message}`;
    }
}

let removing = null;
function openRemove(server) {
    removing = server;
    $("removeName").textContent = String(server.CAUrl);
    $("removeDialog").showModal();
}

async function submitRemove(event) {
    event.preventDefault();
    const server = removing;
    $("removeDialog").close();
    if (!server) {
        return;
    }
    try {
        const answer = await getJSON("../bpl/removeExternalArchiverServer", { channelarchiverserverurl: server.CAUrl, archives: server.indexes });
        if (answer.status === "ok") {
            say("The server was removed. The cluster may have to be restarted for this to take effect.");
        } else {
            say("The server could not be removed. The archiver logs say why.", true);
        }
    } catch (error) {
        say(`The server could not be removed: ${error.message}`, true);
    }
    loadServers();
}

$("addServer").addEventListener("click", openAdd);
$("addForm").addEventListener("submit", submitAdd);
$("addCancel").addEventListener("click", () => $("addDialog").close());
$("removeForm").addEventListener("submit", submitRemove);
$("removeCancel").addEventListener("click", () => $("removeDialog").close());
loadServers();
