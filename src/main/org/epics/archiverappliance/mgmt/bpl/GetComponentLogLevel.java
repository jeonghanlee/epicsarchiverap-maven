package org.epics.archiverappliance.mgmt.bpl;

import java.io.IOException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.epics.archiverappliance.common.BPLAction;
import org.epics.archiverappliance.common.BPLEndpoint;
import org.epics.archiverappliance.common.BPLParam;
import org.epics.archiverappliance.common.GetLogLevel;
import org.epics.archiverappliance.config.ConfigService;

/**
 * Reports the effective log level of a logger in one component of this appliance.
 */
@BPLEndpoint(
        summary = "Returns the effective log level of a logger in one component of this appliance.",
        params = {
            @BPLParam(name = "component", description = "mgmt (default), engine, etl or retrieval."),
            @BPLParam(name = "logger", description = "Logger name; empty or root selects the root logger.")
        })
public class GetComponentLogLevel implements BPLAction {
    @Override
    public void execute(HttpServletRequest req, HttpServletResponse resp, ConfigService configService)
            throws IOException {
        ComponentLogLevels.route(req, resp, configService, new GetLogLevel(), "/getLogLevel", false);
    }
}
