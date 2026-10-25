package org.epics.archiverappliance.common;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.HashMap;

import javax.servlet.http.HttpServletResponse;

import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.LoggerContext;
import org.apache.logging.log4j.core.config.Configurator;
import org.apache.logging.log4j.util.Strings;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.utils.ui.MimeTypeConstants;
import org.json.simple.JSONObject;

/**
 * Reads and changes log4j2 levels in the LoggerContext of the calling webapp.
 * Each WAR carries its own log4j-core, so a change made here applies to this
 * component's JVM and webapp only. An empty logger name or "root" selects the
 * root logger.
 */
public final class LogLevels {
    public static final String LOGGER_PARAM = "logger";
    public static final String LEVEL_PARAM = "level";
    public static final String COMPONENT_PARAM = "component";
    private static final String ROOT = "root";

    private LogLevels() {}

    /** Normalizes the logger request parameter; returns the empty string for the root logger. */
    public static String loggerName(String requested) {
        if (requested == null || Strings.isBlank(requested) || ROOT.equalsIgnoreCase(requested.trim())) {
            return LogManager.ROOT_LOGGER_NAME;
        }
        return requested.trim();
    }

    /** Parses a level name case-insensitively; returns null when it names no log4j2 level. */
    public static Level parseLevel(String requested) {
        if (requested == null || Strings.isBlank(requested)) {
            return null;
        }
        return Level.getLevel(requested.trim().toUpperCase());
    }

    /** Returns the effective level of the named logger in this webapp's LoggerContext. */
    public static Level effectiveLevel(String loggerName) {
        LoggerContext context = LoggerContext.getContext(false);
        return context.getLogger(loggerName).getLevel();
    }

    /** Sets the named logger, or the root logger, to the given level in this webapp's LoggerContext. */
    public static void setLevel(String loggerName, Level level) {
        if (LogManager.ROOT_LOGGER_NAME.equals(loggerName)) {
            Configurator.setRootLevel(level);
        } else {
            Configurator.setLevel(loggerName, level);
        }
    }

    /** Writes the component, the logger name, its level and, when given, its previous level as a JSON object. */
    public static void writeLevel(
            HttpServletResponse resp, ConfigService configService, String loggerName, Level previous, Level current)
            throws IOException {
        HashMap<String, String> output = new HashMap<>();
        output.put(COMPONENT_PARAM, configService.getWarFile().name().toLowerCase());
        output.put(LOGGER_PARAM, LogManager.ROOT_LOGGER_NAME.equals(loggerName) ? ROOT : loggerName);
        output.put(LEVEL_PARAM, current.name());
        if (previous != null) {
            output.put("previousLevel", previous.name());
        }
        resp.setContentType(MimeTypeConstants.APPLICATION_JSON);
        try (PrintWriter out = resp.getWriter()) {
            out.println(JSONObject.toJSONString(output));
        }
    }
}
