// The External servers tab of System: the other EPICS Archiver Appliance clusters this appliance serves data for.
import { node } from "../comm/js/aa/dom.js";

const $ = (id) => document.getElementById(id);

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
