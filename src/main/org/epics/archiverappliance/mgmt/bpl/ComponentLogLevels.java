package org.epics.archiverappliance.mgmt.bpl;

import java.io.IOException;
import java.io.PrintWriter;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.epics.archiverappliance.common.BPLAction;
import org.epics.archiverappliance.common.LogLevels;
import org.epics.archiverappliance.config.ApplianceInfo;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.epics.archiverappliance.utils.ui.MimeTypeConstants;
import org.json.simple.JSONObject;

/**
 * Routes a log-level request to one component of this appliance. The mgmt
 * component is served by the local action; engine, etl and retrieval are
 * reached through their own BPL, because each WAR holds its own log4j2
 * LoggerContext.
 */
final class ComponentLogLevels {
    private static final String MGMT = "mgmt";

    private ComponentLogLevels() {}

    static void route(
            HttpServletRequest req,
            HttpServletResponse resp,
            ConfigService configService,
            BPLAction local,
            String actionPath,
            boolean withLevel)
            throws IOException {
        String component = req.getParameter(LogLevels.COMPONENT_PARAM);
        if (component == null || component.isBlank() || MGMT.equals(component.trim())) {
            local.execute(req, resp, configService);
            return;
        }
        if (withLevel && LogLevels.parseLevel(req.getParameter(LogLevels.LEVEL_PARAM)) == null) {
            resp.sendError(HttpServletResponse.SC_BAD_REQUEST, "Unknown or missing level");
            return;
        }
        String componentURL = componentURL(configService.getMyApplianceInfo(), component.trim());
        if (componentURL == null) {
            resp.sendError(HttpServletResponse.SC_BAD_REQUEST, "Unknown component " + component);
            return;
        }
        StringBuilder url = new StringBuilder(componentURL).append(actionPath).append("?");
        appendParam(url, LogLevels.LOGGER_PARAM, req.getParameter(LogLevels.LOGGER_PARAM));
        if (withLevel) {
            url.append("&");
            appendParam(url, LogLevels.LEVEL_PARAM, req.getParameter(LogLevels.LEVEL_PARAM));
        }
        JSONObject result = GetUrlContent.getURLContentAsJSONObject(url.toString());
        if (result == null) {
            resp.sendError(HttpServletResponse.SC_BAD_GATEWAY, "No valid response from component " + component);
            return;
        }
        resp.setContentType(MimeTypeConstants.APPLICATION_JSON);
        try (PrintWriter out = resp.getWriter()) {
            out.println(result.toJSONString());
        }
    }

    private static String componentURL(ApplianceInfo info, String component) {
        switch (component) {
            case "engine":
                return info.getEngineURL();
            case "etl":
                return info.getEtlURL();
            case "retrieval":
                return info.getRetrievalURL();
            default:
                return null;
        }
    }

    private static void appendParam(StringBuilder url, String name, String value) {
        url.append(name).append("=").append(URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8));
    }
}
