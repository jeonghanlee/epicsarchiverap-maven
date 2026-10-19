package org.epics.archiverappliance.mgmt.bpl;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.HashMap;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.common.BPLAction;
import org.epics.archiverappliance.common.BPLEndpoint;
import org.epics.archiverappliance.common.BPLParam;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.utils.ui.MimeTypeConstants;
import org.json.simple.JSONValue;

/** Resumes a held archive request of this appliance; the cluster-wide call resumeArchiveRequest asks every appliance. */
@BPLEndpoint(
        summary = "Resume a held archive request on this appliance alone; resumeArchiveRequest asks every appliance of the cluster.",
        params = {@BPLParam(name = "pv", description = "The name of the PV whose request is held.")})
public class ResumeArchiveRequestForAppliance implements BPLAction {
    private static final Logger logger = LogManager.getLogger(ResumeArchiveRequestForAppliance.class);

    @Override
    public void execute(HttpServletRequest req, HttpServletResponse resp, ConfigService configService) throws IOException {
        String pvName = req.getParameter("pv");
        if (pvName == null || pvName.isEmpty()) {
            resp.sendError(HttpServletResponse.SC_BAD_REQUEST);
            return;
        }
        boolean resumed = configService.getMgmtRuntimeState().resumeArchiveRequest(pvName);
        logger.debug("Resume of the held archive request for " + pvName + ": " + resumed);
        HashMap<String, Object> infoValues = new HashMap<>();
        infoValues.put("status", resumed ? "ok" : "no");
        infoValues.put("desc", resumed ? "Resumed the held archive request for PV " + pvName : "No held archive request for PV " + pvName + " on this appliance");
        resp.setContentType(MimeTypeConstants.APPLICATION_JSON);
        try (PrintWriter out = resp.getWriter()) {
            out.println(JSONValue.toJSONString(infoValues));
        }
    }
}
