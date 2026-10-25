package org.epics.archiverappliance.common;

import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Exercises LogLevels against the real log4j2 LoggerContext of the test JVM:
 * logger-name normalization, level parsing, and a set-then-read round trip for
 * a named logger and for the root logger, restoring both afterwards.
 */
public class LogLevelsTest {
    private static final String TEST_LOGGER = "org.epics.archiverappliance.common.LogLevelsTest.probe";
    private Level rootBefore;
    private Level namedBefore;

    @BeforeEach
    public void remember() {
        rootBefore = LogLevels.effectiveLevel(LogManager.ROOT_LOGGER_NAME);
        namedBefore = LogLevels.effectiveLevel(TEST_LOGGER);
    }

    @AfterEach
    public void restore() {
        LogLevels.setLevel(LogManager.ROOT_LOGGER_NAME, rootBefore);
        LogLevels.setLevel(TEST_LOGGER, namedBefore);
    }

    @Test
    public void loggerNameSelectsRootForEmptyOrRoot() {
        Assertions.assertEquals(LogManager.ROOT_LOGGER_NAME, LogLevels.loggerName(null));
        Assertions.assertEquals(LogManager.ROOT_LOGGER_NAME, LogLevels.loggerName(""));
        Assertions.assertEquals(LogManager.ROOT_LOGGER_NAME, LogLevels.loggerName("  "));
        Assertions.assertEquals(LogManager.ROOT_LOGGER_NAME, LogLevels.loggerName("ROOT"));
        Assertions.assertEquals("config", LogLevels.loggerName(" config "));
    }

    @Test
    public void parseLevelAcceptsNamesCaseInsensitivelyAndRejectsOthers() {
        Assertions.assertEquals(Level.DEBUG, LogLevels.parseLevel("debug"));
        Assertions.assertEquals(Level.WARN, LogLevels.parseLevel(" WARN "));
        Assertions.assertNull(LogLevels.parseLevel(null));
        Assertions.assertNull(LogLevels.parseLevel(""));
        Assertions.assertNull(LogLevels.parseLevel("VERBOSE"));
    }

    @Test
    public void setLevelChangesTheNamedLoggerOnly() {
        LogLevels.setLevel(TEST_LOGGER, Level.TRACE);
        Assertions.assertEquals(Level.TRACE, LogLevels.effectiveLevel(TEST_LOGGER));
        Assertions.assertTrue(LogManager.getLogger(TEST_LOGGER).isTraceEnabled());
        Assertions.assertEquals(rootBefore, LogLevels.effectiveLevel(LogManager.ROOT_LOGGER_NAME));
    }

    @Test
    public void setLevelChangesTheRootLogger() {
        LogLevels.setLevel(LogManager.ROOT_LOGGER_NAME, Level.ERROR);
        Assertions.assertEquals(Level.ERROR, LogLevels.effectiveLevel(LogManager.ROOT_LOGGER_NAME));
    }
}
