package org.epics.archiverappliance.mgmt.bpl;

import java.io.IOException;
import java.io.PrintWriter;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.common.BPLAction;
import org.epics.archiverappliance.common.BPLEndpoint;
import org.epics.archiverappliance.common.BPLParam;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.epics.archiverappliance.utils.ui.MimeTypeConstants;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

/**
 * Asks the engine of this appliance whether a complete PV name answers on the control system network, before it is
 * archived. The engine opens a channel of its own, waits for the connection up to the timeout and closes it; the
 * answer carries pvName, found, protocol, type and host (Channel Access only) when found, and elapsedMs.
 */
@BPLEndpoint(
        summary = "Search one complete PV name on the control system network, over Channel Access or PV Access as the name decides, and say whether a server holds it, with its type and host when found. Nothing is archived.",
        params = {
            @BPLParam(name = "pv", description = "The complete name of the PV, with pva:// or ca:// to choose the protocol; a plain name takes the default protocol of the installation."),
            @BPLParam(name = "timeout", description = "How many seconds to wait for a server; 5 by default, at most 30.")
        })
public class SearchPV implements BPLAction {
    private static final Logger logger = LogManager.getLogger(SearchPV.class);

    @Override
    public void execute(HttpServletRequest req, HttpServletResponse resp, ConfigService configService) throws IOException {
        String pvName = req.getParameter("pv");
        if (pvName == null || pvName.isEmpty()) {
            resp.sendError(HttpServletResponse.SC_BAD_REQUEST, "The parameter pv is missing");
            return;
        }
        String timeout = req.getParameter("timeout");
        StringBuilder url = new StringBuilder(configService.getMyApplianceInfo().getEngineURL())
                .append("/searchPV?pv=")
                .append(URLEncoder.encode(pvName, StandardCharsets.UTF_8));
        if (timeout != null && !timeout.isEmpty()) {
            url.append("&timeout=").append(URLEncoder.encode(timeout, StandardCharsets.UTF_8));
        }
        JSONObject answer = GetUrlContent.getURLContentAsJSONObject(url.toString(), false);
        if (answer == null) {
            logger.error("The engine did not answer the search for " + pvName);
            resp.sendError(HttpServletResponse.SC_BAD_GATEWAY, "The engine did not answer the search");
            return;
        }
        resp.setContentType(MimeTypeConstants.APPLICATION_JSON);
        try (PrintWriter out = resp.getWriter()) {
            out.println(JSONValue.toJSONString(answer));
        }
    }
}
