package org.epics.archiverappliance.common;

import java.io.IOException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.config.ConfigService;

/**
 * Changes the log4j2 level of one logger in this component without a restart.
 * The change lasts until the next change or until the component restarts.
 */
@BPLEndpoint(
        summary = "Sets the log level of a logger in this component until the next change or restart.",
        params = {
            @BPLParam(name = "logger", description = "Logger name; empty or root selects the root logger."),
            @BPLParam(name = "level", description = "One of OFF, FATAL, ERROR, WARN, INFO, DEBUG, TRACE, ALL.")
        })
public class SetLogLevel implements BPLAction {
    private static final Logger logger = LogManager.getLogger(SetLogLevel.class.getName());

    @Override
    public void execute(HttpServletRequest req, HttpServletResponse resp, ConfigService configService)
            throws IOException {
        String loggerName = LogLevels.loggerName(req.getParameter(LogLevels.LOGGER_PARAM));
        Level level = LogLevels.parseLevel(req.getParameter(LogLevels.LEVEL_PARAM));
        if (level == null) {
            resp.sendError(HttpServletResponse.SC_BAD_REQUEST, "Unknown or missing level");
            return;
        }
        Level previous = LogLevels.effectiveLevel(loggerName);
        LogLevels.setLevel(loggerName, level);
        logger.warn("Log level of logger [" + loggerName + "] changed from " + previous + " to " + level);
        LogLevels.writeLevel(resp, configService, loggerName, previous, LogLevels.effectiveLevel(loggerName));
    }
}
