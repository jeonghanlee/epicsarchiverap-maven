package org.epics.archiverappliance.common;

import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.LoggerContext;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Configuration;
import org.apache.logging.log4j.core.config.LoggerConfig;
import org.apache.logging.log4j.core.config.Property;
import org.apache.logging.log4j.core.layout.PatternLayout;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Collects the events of one logger tree at and above a level, for tests that count what the shipped classes log.
 * The test log4j configuration uses asynchronous loggers, so {@link #settle()} waits before events are read.
 */
public final class CapturedLog implements AutoCloseable {
    private static final long SETTLE_MS = 1500;

    /** One captured event: its level, logger, formatted message and whether it carried a throwable. */
    public record Entry(Level level, String logger, String message, boolean hasThrowable) {}

    private final class Collector extends AbstractAppender {
        Collector() {
            super("CapturedLog-" + loggerName, null, PatternLayout.createDefaultLayout(), true, Property.EMPTY_ARRAY);
        }

        @Override
        public void append(LogEvent event) {
            entries.add(new Entry(
                    event.getLevel(),
                    event.getLoggerName(),
                    event.getMessage().getFormattedMessage(),
                    event.getThrown() != null));
        }
    }

    private final String loggerName;
    private final List<Entry> entries = new CopyOnWriteArrayList<>();
    private final LoggerContext context;
    private final Configuration configuration;
    private final Collector collector;

    /**
     * Starts capturing the events of loggerName and its children at level and above.
     *
     * @param loggerName a logger or package name
     * @param level      the lowest level to capture
     */
    public CapturedLog(String loggerName, Level level) {
        this.loggerName = loggerName;
        this.context = (LoggerContext) LogManager.getContext(false);
        this.configuration = context.getConfiguration();
        this.collector = new Collector();
        collector.start();
        configuration.addAppender(collector);
        LoggerConfig loggerConfig = new LoggerConfig(loggerName, level, true);
        loggerConfig.addAppender(collector, level, null);
        configuration.addLogger(loggerName, loggerConfig);
        context.updateLoggers();
    }

    /** Waits for the asynchronous loggers to deliver the events logged so far. */
    public void settle() throws InterruptedException {
        Thread.sleep(SETTLE_MS);
    }

    /** The captured events, oldest first. */
    public List<Entry> entries() {
        return List.copyOf(entries);
    }

    /** The captured events of exactly one level. */
    public List<Entry> at(Level level) {
        return entries.stream().filter(entry -> entry.level() == level).toList();
    }

    @Override
    public void close() {
        configuration.removeLogger(loggerName);
        collector.stop();
        context.updateLoggers();
    }
}
