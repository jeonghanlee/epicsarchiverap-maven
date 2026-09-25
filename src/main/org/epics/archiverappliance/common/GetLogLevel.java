package org.epics.archiverappliance.common;

import java.io.IOException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.epics.archiverappliance.config.ConfigService;

/**
 * Reports the effective log4j2 level of one logger in this component.
 */
@BPLEndpoint(
        summary = "Returns the effective log level of a logger in this component.",
        params = {
            @BPLParam(name = "logger", description = "Logger name; empty or root selects the root logger.")
        })
public class GetLogLevel implements BPLAction {
    @Override
    public void execute(HttpServletRequest req, HttpServletResponse resp, ConfigService configService)
            throws IOException {
        String loggerName = LogLevels.loggerName(req.getParameter(LogLevels.LOGGER_PARAM));
        LogLevels.writeLevel(resp, configService, loggerName, null, LogLevels.effectiveLevel(loggerName));
    }
}
