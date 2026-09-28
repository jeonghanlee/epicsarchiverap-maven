package org.epics.archiverappliance.etl;

import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;
import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.LoggerContext;
import org.apache.logging.log4j.core.appender.AbstractAppender;
import org.apache.logging.log4j.core.config.Configuration;
import org.apache.logging.log4j.core.config.LoggerConfig;
import org.apache.logging.log4j.core.config.Property;
import org.apache.logging.log4j.core.layout.PatternLayout;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.etl.common.ETLPVLookupItems;
import org.epics.archiverappliance.etl.common.PBThreeTierETLPVLookup;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;

/**
 * The ETL lookup reads the current time from the clock and the skip-store variable from the environment
 * reader it is constructed with, so tests control both at the outermost boundary while the scheduling
 * code under test is the shipped one.
 */
public class ETLLookupClockAndEnvironmentTest {
    private static final long TEN_YEARS_SECONDS = 3600L * 24 * 365 * 10;
    private final String base = ConfigServiceForTests.getDefaultPBTestFolder() + "/"
            + ETLLookupClockAndEnvironmentTest.class.getSimpleName();
    private ConfigServiceForTests configService;
    private PBThreeTierETLPVLookup lookup;

    private static final class CapturingAppender extends AbstractAppender {
        final List<String> messages = new CopyOnWriteArrayList<>();

        CapturingAppender() {
            super("LookupClockCapture", null, PatternLayout.createDefaultLayout(), true, Property.EMPTY_ARRAY);
        }

        @Override
        public void append(LogEvent event) {
            messages.add(event.getMessage().getFormattedMessage());
        }
    }

    @BeforeEach
    public void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1);
        FileUtils.deleteDirectory(new File(base));
        Assertions.assertTrue(new File(base + "/sts").mkdirs());
        Assertions.assertTrue(new File(base + "/mts").mkdirs());
    }

    @AfterEach
    public void tearDown() throws Exception {
        if (lookup != null) {
            lookup.manualControlForUnitTests();
        }
        configService.shutdownNow();
        FileUtils.deleteDirectory(new File(base));
    }

    private ETLPVLookupItems addPV(String pvName, Clock clock, Function<String, String> environmentReader)
            throws Exception {
        PlainPBStoragePlugin sts = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=STS&rootFolder=" + base + "/sts&partitionGranularity=PARTITION_5MIN",
                configService);
        PlainPBStoragePlugin mts = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=MTS&rootFolder=" + base + "/mts&partitionGranularity=PARTITION_HOUR",
                configService);
        PVTypeInfo typeInfo = new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        typeInfo.setDataStores(new String[] {sts.getURLRepresentation(), mts.getURLRepresentation()});
        configService.updateTypeInfoForPV(pvName, typeInfo);
        lookup = new PBThreeTierETLPVLookup(configService, clock, environmentReader);
        lookup.addETLJobsForUnitTests(pvName, typeInfo);
        return lookup.getLookupItemsForPV(pvName).getFirst();
    }

    @Test
    public void skipStoreNameComesFromTheEnvironmentReader() throws Exception {
        Function<String, String> reader =
                name -> PBThreeTierETLPVLookup.SKIP_ETL_FOR_STORE_ENV.equals(name) ? "MTS" : null;
        ETLPVLookupItems item = addPV("ArchUnitTest:ETLLookupEnv:skip", Clock.systemUTC(), reader);

        long delay = item.getCancellingFuture().getDelay(TimeUnit.SECONDS);
        Assertions.assertTrue(delay > TEN_YEARS_SECONDS - 60, "the skipped store waits ten years, got " + delay);
        Assertions.assertEquals(0, item.getNumberofTimesWeETLed(), "no job ran for the skipped store");
    }

    @Test
    public void unsetSkipVariableLeavesTheScheduleAlone() throws Exception {
        ETLPVLookupItems item = addPV("ArchUnitTest:ETLLookupEnv:noskip", Clock.systemUTC(), name -> null);

        long delay = item.getCancellingFuture().getDelay(TimeUnit.SECONDS);
        Assertions.assertTrue(delay <= 300, "without the variable the job is scheduled within one cadence, got " + delay);
    }

    @Test
    public void initialDelayIsComputedFromTheClock() throws Exception {
        String name = PBThreeTierETLPVLookup.class.getName();
        LoggerContext ctx = (LoggerContext) LogManager.getContext(false);
        Configuration cfg = ctx.getConfiguration();
        CapturingAppender appender = new CapturingAppender();
        appender.start();
        cfg.addAppender(appender);
        LoggerConfig loggerConfig = new LoggerConfig(name, Level.DEBUG, true);
        loggerConfig.addAppender(appender, Level.DEBUG, null);
        cfg.addLogger(name, loggerConfig);
        ctx.updateLoggers();
        try {
            // Two minutes into a 5-minute partition: the next partition starts at 00:05, the transition 0
            // offset adds 5 minutes, so the expected run is 00:10 and the computed delay is 00:02 - 00:10.
            Clock fixed = Clock.fixed(Instant.parse("2026-01-01T00:02:00Z"), ZoneOffset.UTC);
            String pvName = "ArchUnitTest:ETLLookupEnv:clock";
            addPV(pvName, fixed, n -> null);
            // The test log4j configuration uses asynchronous loggers, so the line reaches the appender
            // after the call returns; wait for it within a bound.
            String scheduled = "none";
            long deadline = System.currentTimeMillis() + 10_000;
            while ("none".equals(scheduled) && System.currentTimeMillis() < deadline) {
                scheduled = appender.messages.stream()
                        .filter(m -> m.contains("Scheduled ETL job for " + pvName))
                        .findFirst()
                        .orElse("none");
                if ("none".equals(scheduled)) {
                    Thread.sleep(50);
                }
            }
            Assertions.assertTrue(scheduled.contains("with initial delay of -480 "), scheduled);
        } finally {
            cfg.removeLogger(name);
            appender.stop();
            ctx.updateLoggers();
        }
    }
}
