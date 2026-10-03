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
import org.epics.archiverappliance.etl.common.OutOfSpaceHandling;
import org.epics.archiverappliance.etl.common.PBThreeTierETLPVLookup;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.util.LinkedList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * A misspelled OutOfSpaceHandling property on the real registration path: every PV still gets its ETL lookup item
 * with the default handling, and the lookup logs exactly one ERROR line naming the bad value.
 */
public class ETLOutOfSpaceHandlingTest {
    /** The installation property as sites write it in archappl.properties. */
    private static final String PROPERTY = "org.epics.archiverappliance.etl.common.OutOfSpaceHandling";
    private static final String BAD_VALUE = "DELETE_SRC_STREAMS_WHEN_OUT_OF_SPAC";
    private static final OutOfSpaceHandling DEFAULT_HANDLING =
            OutOfSpaceHandling.DELETE_SRC_STREAMS_IF_FIRST_DEST_WHEN_OUT_OF_SPACE;
    private static final String[] PV_NAMES = {
        "ArchUnitTest:ETLOutOfSpaceHandling:one", "ArchUnitTest:ETLOutOfSpaceHandling:two"
    };
    private static final long LOG_WAIT_MS = 10_000;
    private static final long LOG_SETTLE_MS = 1_000;
    private final String base =
            ConfigServiceForTests.getDefaultPBTestFolder() + "/" + ETLOutOfSpaceHandlingTest.class.getSimpleName();
    private final String stsFolder = base + "/sts";
    private final String mtsFolder = base + "/mts";
    private ConfigServiceForTests configService;

    /** Collects the formatted messages of the events routed to it. */
    private static final class CapturingAppender extends AbstractAppender {
        final List<String> messages = new CopyOnWriteArrayList<>();

        CapturingAppender() {
            super("OutOfSpaceHandlingCapture", null, PatternLayout.createDefaultLayout(), true, Property.EMPTY_ARRAY);
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
        Assertions.assertTrue(new File(stsFolder).mkdirs());
        Assertions.assertTrue(new File(mtsFolder).mkdirs());
    }

    @AfterEach
    public void tearDown() throws Exception {
        configService.shutdownNow();
        FileUtils.deleteDirectory(new File(base));
    }

    private String store(String name, String rootFolder, String granularity) throws Exception {
        PlainPBStoragePlugin plugin = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=" + name + "&rootFolder=" + rootFolder + "&partitionGranularity=" + granularity,
                configService);
        return plugin.getURLRepresentation();
    }

    private long badValueErrors(CapturingAppender appender) {
        return appender.messages.stream().filter(m -> m.contains(BAD_VALUE)).count();
    }

    @Test
    public void misspelledValueFallsBackToTheDefaultWithOneError() throws Exception {
        configService.getInstallationProperties().setProperty(PROPERTY, BAD_VALUE);
        configService.getETLLookup().manualControlForUnitTests();
        String stsUrl = store("STS", stsFolder, "PARTITION_5MIN");
        String mtsUrl = store("MTS", mtsFolder, "PARTITION_HOUR");

        String loggerName = PBThreeTierETLPVLookup.class.getName();
        LoggerContext ctx = (LoggerContext) LogManager.getContext(false);
        Configuration cfg = ctx.getConfiguration();
        CapturingAppender appender = new CapturingAppender();
        appender.start();
        cfg.addAppender(appender);
        LoggerConfig loggerConfig = new LoggerConfig(loggerName, Level.ERROR, true);
        loggerConfig.addAppender(appender, Level.ERROR, null);
        cfg.addLogger(loggerName, loggerConfig);
        ctx.updateLoggers();
        try {
            for (String pvName : PV_NAMES) {
                PVTypeInfo typeInfo = new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
                typeInfo.setDataStores(new String[] {stsUrl, mtsUrl});
                configService.updateTypeInfoForPV(pvName, typeInfo);
                configService.registerPVToAppliance(pvName, configService.getMyApplianceInfo());
            }

            for (String pvName : PV_NAMES) {
                LinkedList<ETLPVLookupItems> items = configService.getETLLookup().getLookupItemsForPV(pvName);
                Assertions.assertEquals(1, items.size(), "lookup items for " + pvName);
                Assertions.assertEquals(DEFAULT_HANDLING, items.getFirst().getOutOfSpaceHandling());
            }

            // The test log4j configuration uses asynchronous loggers; wait for the line within a bound, then allow
            // any further line to arrive before counting.
            long deadline = System.currentTimeMillis() + LOG_WAIT_MS;
            while (System.currentTimeMillis() < deadline && badValueErrors(appender) == 0) {
                Thread.sleep(50);
            }
            Thread.sleep(LOG_SETTLE_MS);
            Assertions.assertEquals(1, badValueErrors(appender), "logged: " + appender.messages);
        } finally {
            cfg.removeLogger(loggerName);
            appender.stop();
            ctx.updateLoggers();
        }
    }
}
