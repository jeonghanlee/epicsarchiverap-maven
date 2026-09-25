package org.epics.archiverappliance.mgmt.bpl;

import java.io.IOException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.epics.archiverappliance.common.BPLAction;
import org.epics.archiverappliance.common.BPLEndpoint;
import org.epics.archiverappliance.common.BPLParam;
import org.epics.archiverappliance.common.SetLogLevel;
import org.epics.archiverappliance.config.ConfigService;

/**
 * Sets the log level of a logger in one component of this appliance without a restart.
 */
@BPLEndpoint(
        summary = "Sets the log level of a logger in one component of this appliance until the next change or"
                + " restart.",
        params = {
            @BPLParam(name = "component", description = "mgmt (default), engine, etl or retrieval."),
            @BPLParam(name = "logger", description = "Logger name; empty or root selects the root logger."),
            @BPLParam(name = "level", description = "One of OFF, FATAL, ERROR, WARN, INFO, DEBUG, TRACE, ALL.")
        })
public class SetComponentLogLevel implements BPLAction {
    @Override
    public void execute(HttpServletRequest req, HttpServletResponse resp, ConfigService configService)
            throws IOException {
        ComponentLogLevels.route(req, resp, configService, new SetLogLevel(), "/setLogLevel", true);
    }
}
