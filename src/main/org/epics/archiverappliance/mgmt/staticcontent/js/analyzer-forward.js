// The Analyzer entry of the menu: the data viewer is served by the retrieval web application on its own port, so this
// page asks the appliance for that address and forwards to the viewer, carrying any PV and window parameters along.
fetch("../bpl/getApplianceInfo")
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
    .then((info) => {
        const base = String(info.dataRetrievalURL || "");
        if (!base) {
            throw new Error("the appliance reports no retrieval address");
        }
        window.location.replace(`${base}/ui/viewer/archViewer.html${window.location.search}`);
    })
    .catch((error) => {
        document.getElementById("forwardNote").textContent = `The data viewer could not be opened: ${error.message}.`;
    });
