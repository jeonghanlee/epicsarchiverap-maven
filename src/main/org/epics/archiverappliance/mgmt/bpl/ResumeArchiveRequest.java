package org.epics.archiverappliance.mgmt.bpl;

import java.io.IOException;
import java.io.PrintWriter;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedList;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.common.BPLAction;
import org.epics.archiverappliance.common.BPLEndpoint;
import org.epics.archiverappliance.common.BPLParam;
import org.epics.archiverappliance.config.ApplianceInfo;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.epics.archiverappliance.utils.ui.MimeTypeConstants;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

/**
 * Resumes an archive request the appliance held because no server answered its name: the request goes back to its start
 * and the engine searches for the name again. The request lives on the appliance that received it, so every appliance of
 * the cluster is asked, as the abort is.
 */
@BPLEndpoint(
        summary = "Resume an archive request that the appliance held because no server answered its name within the hold time; the engine searches for the name again.",
        params = {@BPLParam(name = "pv", description = "The name of the PV whose request is held.")})
public class ResumeArchiveRequest implements BPLAction {
    private static final Logger logger = LogManager.getLogger(ResumeArchiveRequest.class);

    @Override
    public void execute(HttpServletRequest req, HttpServletResponse resp, ConfigService configService) throws IOException {
        String pvName = req.getParameter("pv");
        if (pvName == null || pvName.isEmpty()) {
            resp.sendError(HttpServletResponse.SC_BAD_REQUEST);
            return;
        }
        String realName = configService.getRealNameForAlias(pvName);
        if (realName != null) {
            pvName = realName;
        }
        logger.info("Resuming the held archive request for the PV " + pvName);
        LinkedList<String> urls = new LinkedList<>();
        for (ApplianceInfo info : configService.getAppliancesInCluster()) {
            urls.add(info.getMgmtURL() + "/resumeArchiveRequestForThisAppliance?pv=" + URLEncoder.encode(pvName, StandardCharsets.UTF_8));
        }
        HashMap<String, Object> infoValues = new HashMap<>();
        resp.setContentType(MimeTypeConstants.APPLICATION_JSON);
        try (PrintWriter out = resp.getWriter()) {
            boolean resumed = false;
            for (String url : urls) {
                JSONObject answer = GetUrlContent.getURLContentAsJSONObject(url);
                if (answer != null && "ok".equals(answer.get("status"))) {
                    resumed = true;
                }
            }
            infoValues.put("status", resumed ? "ok" : "no");
            infoValues.put("desc", resumed ? "Resumed the held archive request for PV " + pvName : "No held archive request for PV " + pvName);
            out.println(JSONValue.toJSONString(infoValues));
        }
    }
}
