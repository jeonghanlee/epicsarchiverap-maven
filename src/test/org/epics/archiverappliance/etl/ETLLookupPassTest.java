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
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.etl.common.ETLPVLookupItems;
import org.epics.archiverappliance.etl.common.ETLPassDriver;
import org.epics.archiverappliance.etl.common.ETLPassRecord;
import org.epics.archiverappliance.etl.common.PBThreeTierETLPVLookup;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.epics.archiverappliance.utils.simulation.SimulationEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.text.DecimalFormat;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;

/**
 * The ETL lookup driving passes through its drivers over real PlainPB stores: the reported rows and keys, PVs
 * added and removed between passes, the skip store on a pass and on a delete, and the shutdown order. The only
 * substitutes are the clock and the environment reader.
 */
public class ETLLookupPassTest {
    private static final DecimalFormat TWO_DIGITS = new DecimalFormat("###,###,###,###,###,###.##");
    private static final long WAIT_SECONDS = 60;
    private final String base =
            ConfigServiceForTests.getDefaultPBTestFolder() + "/" + ETLLookupPassTest.class.getSimpleName();
    private ConfigServiceForTests configService;
    private PBThreeTierETLPVLookup lookup;
    private Instant yearStart;

    private static final class TestClock extends Clock {
        private volatile Instant instant;

        TestClock(Instant instant) {
            this.instant = instant;
        }

        void set(Instant instant) {
            this.instant = instant;
        }

        @Override
        public Instant instant() {
            return instant;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }

    private static final class CapturingAppender extends AbstractAppender {
        final List<String> messages = new CopyOnWriteArrayList<>();

        CapturingAppender() {
            super("LookupPassCapture", null, PatternLayout.createDefaultLayout(), true, Property.EMPTY_ARRAY);
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
        yearStart = TimeUtils.getStartOfYear(TimeUtils.getCurrentYear());
    }

    @AfterEach
    public void tearDown() throws Exception {
        if (lookup != null) {
            lookup.manualControlForUnitTests();
        }
        configService.shutdownNow();
        FileUtils.deleteDirectory(new File(base));
    }

    private Instant at(long secondsIntoYear) {
        return yearStart.plusSeconds(secondsIntoYear);
    }

    private String stsUrl() throws Exception {
        PlainPBStoragePlugin sts = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=STS&rootFolder=" + base
                        + "/sts&partitionGranularity=PARTITION_5MIN&consolidateOnShutdown=true",
                configService);
        return sts.getURLRepresentation();
    }

    private String mtsUrl() throws Exception {
        PlainPBStoragePlugin mts = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=MTS&rootFolder=" + base + "/mts&partitionGranularity=PARTITION_HOUR",
                configService);
        return mts.getURLRepresentation();
    }

    private PBThreeTierETLPVLookup newLookup(Clock clock, Function<String, String> reader) {
        lookup = new PBThreeTierETLPVLookup(configService, clock, reader);
        return lookup;
    }

    private ETLPVLookupItems register(String pvName, int secondsOfData) throws Exception {
        PVTypeInfo typeInfo = new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        typeInfo.setDataStores(new String[] {stsUrl(), mtsUrl()});
        configService.updateTypeInfoForPV(pvName, typeInfo);
        lookup.addETLJobsForUnitTests(pvName, typeInfo);
        if (secondsOfData > 0) {
            appendToSource(pvName, 0, secondsOfData);
        }
        return lookup.getLookupItemsForPV(pvName).getFirst();
    }

    /** One sample per second into the source store, from fromSecond up to toSecond into the year. */
    private void appendToSource(String pvName, int fromSecond, int toSecond) throws Exception {
        PlainPBStoragePlugin sts =
                (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(stsUrl(), configService);
        short year = TimeUtils.getCurrentYear();
        try (BasicContext context = new BasicContext()) {
            ArrayListEventStream data = new ArrayListEventStream(
                    toSecond - fromSecond, new RemotableEventStreamDesc(ArchDBRTypes.DBR_SCALAR_DOUBLE, pvName, year));
            for (int s = fromSecond; s < toSecond; s++) {
                data.add(new SimulationEvent(
                        s, year, ArchDBRTypes.DBR_SCALAR_DOUBLE, new ScalarValue<Double>((double) s)));
            }
            sts.appendData(context, pvName, data);
        }
    }

    /** The second into the year of the last event in the destination store, or -1 when it holds none. */
    private long lastDestinationSecond(ETLPVLookupItems item) throws Exception {
        try (BasicContext context = new BasicContext()) {
            Event last = item.getETLDest().getLastKnownEvent(context, item.getPvName());
            return last == null ? -1 : last.getEpochSeconds() - yearStart.getEpochSecond();
        }
    }

    private ETLPassDriver theDriver() {
        List<ETLPassDriver> drivers = lookup.getDrivers();
        Assertions.assertEquals(1, drivers.size(), "one driver for one transition and cadence");
        return drivers.get(0);
    }

    private ETLPassRecord pass(ETLPassDriver driver, Instant now) throws Exception {
        return driver.tick(now).get(WAIT_SECONDS, TimeUnit.SECONDS);
    }

    private static String row(LinkedList<Map<String, String>> details, String name) {
        for (Map<String, String> detail : details) {
            if (name.equals(detail.get("name"))) {
                return detail.get("value");
            }
        }
        return null;
    }

    private boolean destinationHolds(ETLPVLookupItems item) throws Exception {
        try (BasicContext context = new BasicContext()) {
            return item.getETLDest().getLastKnownEvent(context, item.getPvName()) != null;
        }
    }

    @Test
    public void rowsAndKeysComeFromTheRecords() throws Exception {
        TestClock clock = new TestClock(at(12 * 60));
        newLookup(clock, name -> null);
        register("ArchUnitTest:ETLLookupPass:rows1", 15 * 60);
        register("ArchUnitTest:ETLLookupPass:rows2", 15 * 60);
        ETLPassDriver driver = theDriver();
        driver.start();
        ETLPassRecord first = pass(driver, at(12 * 60));
        clock.set(at(24 * 60 * 60 + 12 * 60));
        ETLPassRecord second = pass(driver, at(24 * 60 * 60 + 12 * 60));

        LinkedList<Map<String, String>> details = lookup.getApplianceMetrics().details(configService);
        String id = "ETL(0&raquo;1)";
        Assertions.assertEquals("2", row(details, "Passes so far in " + id));
        Assertions.assertEquals(
                TWO_DIGITS.format((first.busyMillis() + second.busyMillis()) / 2000.0),
                row(details, "Average busy time per pass in " + id + " (s)"));
        Assertions.assertEquals(
                TWO_DIGITS.format(second.busyMillis() / 1000.0), row(details, "Last pass in " + id + " busy time (s)"));
        Assertions.assertEquals(
                Integer.toString(second.partitionsMoved()), row(details, "Last pass in " + id + " partitions moved"));
        Assertions.assertEquals("none", row(details, "Current pass in " + id));
        Assertions.assertEquals(
                TWO_DIGITS.format(driver.getWeeklyUsagePercent(clock.instant())),
                row(details, "Weekly usage in " + id + " (%)"));

        Map<String, String> metrics = lookup.getApplianceMetrics().metrics();
        Assertions.assertEquals("2", metrics.get("totalETLRuns(0)"));
        Assertions.assertEquals(
                Long.toString(driver.getBusyMillisTotal() / 1000), metrics.get("timeForOverallETLInSeconds(0)"));
        Assertions.assertEquals(
                TWO_DIGITS.format(second.busyMillis() * 100.0 / (300 * 1000.0)), metrics.get("maxETLPercentage"));
    }

    @Test
    public void pvsJoinAndLeaveBetweenPasses() throws Exception {
        TestClock clock = new TestClock(at(12 * 60));
        newLookup(clock, name -> null);
        ETLPVLookupItems first = register("ArchUnitTest:ETLLookupPass:first", 10 * 60);
        ETLPassDriver driver = theDriver();
        driver.start();
        ETLPassRecord startup = pass(driver, at(12 * 60));
        Assertions.assertEquals(1, startup.pvCount());

        // A PV registered after the start-up pass joins the next planned pass.
        ETLPVLookupItems second = register("ArchUnitTest:ETLLookupPass:second", 10 * 60);
        Assertions.assertSame(driver, lookup.getDriverFor(second));
        clock.set(at(15 * 60));
        ETLPassRecord next = pass(driver, at(15 * 60));
        Assertions.assertEquals(2, next.pvCount());

        // A PV removed between passes is absent from the next snapshot, and its consolidation moves the data the
        // passes have not: the two passes moved the partitions closed before 00:11, so the samples appended into the
        // 00:15 partition reach the destination only through the consolidation on delete.
        Assertions.assertEquals(10 * 60 - 1, lastDestinationSecond(first));
        appendToSource(first.getPvName(), 15 * 60, 20 * 60);
        lookup.deleteETLJobs(first.getPvName());
        Assertions.assertFalse(driver.hasPV(first.getPvName()));
        Assertions.assertEquals(
                20 * 60 - 1, lastDestinationSecond(first), "the consolidation on delete moved the open partition");
        clock.set(at(20 * 60));
        ETLPassRecord after = pass(driver, at(20 * 60));
        Assertions.assertEquals(1, after.pvCount());
    }

    @Test
    public void skipStoreCoversThePassAndTheDelete() throws Exception {
        Function<String, String> reader =
                name -> PBThreeTierETLPVLookup.SKIP_ETL_FOR_STORE_ENV.equals(name) ? "MTS" : null;
        TestClock clock = new TestClock(at(12 * 60));
        newLookup(clock, reader);
        ETLPVLookupItems one = register("ArchUnitTest:ETLLookupPass:skip1", 10 * 60);
        ETLPVLookupItems two = register("ArchUnitTest:ETLLookupPass:skip2", 10 * 60);
        ETLPassDriver driver = theDriver();
        driver.start();
        ETLPassRecord record = pass(driver, at(12 * 60));
        Assertions.assertEquals(2, record.jobsSkipped());
        Assertions.assertEquals(0, record.jobsRun());

        lookup.deleteETLJobs(one.getPvName());
        Assertions.assertNull(one.getLastRunReport(), "no consolidation job ran into the named store");
        Assertions.assertFalse(destinationHolds(one));
        Assertions.assertFalse(destinationHolds(two));
    }

    @Test
    public void shutdownFlagsTheDriversAndConsolidatesEveryPV() throws Exception {
        configService.getInstallationProperties().setProperty(PBThreeTierETLPVLookup.STOP_WAIT_PROPERTY, "0");
        TestClock clock = new TestClock(at(12 * 60));
        newLookup(clock, name -> null);
        ETLPVLookupItems one = register("ArchUnitTest:ETLLookupPass:stop1", 10 * 60);
        ETLPVLookupItems two = register("ArchUnitTest:ETLLookupPass:stop2", 10 * 60);
        ETLPassDriver driver = theDriver();
        driver.start();
        pass(driver, at(12 * 60));
        Assertions.assertEquals(10 * 60 - 1, lastDestinationSecond(one));
        Assertions.assertEquals(10 * 60 - 1, lastDestinationSecond(two));
        // Samples in the open 00:15 partition reach the destination only through the shutdown consolidation.
        appendToSource(one.getPvName(), 15 * 60, 20 * 60);
        appendToSource(two.getPvName(), 15 * 60, 20 * 60);

        lookup.shutdown();
        clock.set(at(15 * 60));
        Assertions.assertNull(driver.tick(at(15 * 60)), "no pass starts after the stop flag");
        Assertions.assertEquals(
                20 * 60 - 1, lastDestinationSecond(one), "the shutdown consolidation moved the first PV");
        Assertions.assertEquals(
                20 * 60 - 1, lastDestinationSecond(two), "the shutdown consolidation moved the second PV");
    }

    @Test
    public void shutdownUnderTheSkipStoreWritesNothingAndLogsTheCount() throws Exception {
        configService.getInstallationProperties().setProperty(PBThreeTierETLPVLookup.STOP_WAIT_PROPERTY, "0");
        Function<String, String> reader =
                name -> PBThreeTierETLPVLookup.SKIP_ETL_FOR_STORE_ENV.equals(name) ? "MTS" : null;
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
            TestClock clock = new TestClock(at(12 * 60));
            newLookup(clock, reader);
            ETLPVLookupItems one = register("ArchUnitTest:ETLLookupPass:skipstop1", 10 * 60);
            ETLPVLookupItems two = register("ArchUnitTest:ETLLookupPass:skipstop2", 10 * 60);
            theDriver().start();
            pass(theDriver(), at(12 * 60));

            lookup.shutdown();
            Assertions.assertFalse(destinationHolds(one));
            Assertions.assertFalse(destinationHolds(two));
            // The test log4j configuration uses asynchronous loggers; wait for the line within a bound.
            String expected = "2 PVs left unconsolidated in store STS at shutdown";
            long deadline = System.currentTimeMillis() + 10_000;
            while (System.currentTimeMillis() < deadline && appender.messages.stream().noneMatch(expected::equals)) {
                Thread.sleep(50);
            }
            Assertions.assertTrue(appender.messages.contains(expected), "logged: " + appender.messages);
        } finally {
            cfg.removeLogger(loggerName);
            appender.stop();
            ctx.updateLoggers();
        }
    }
}
