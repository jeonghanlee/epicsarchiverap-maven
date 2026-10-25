package org.epics.archiverappliance.etl;

import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;
import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.EventStream;
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
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * What the lookup does while a pass is running, over real PlainPB stores and the shipped ETLJob: a delete of a PV
 * the pass has not reached, a delete of the PV at the pass cursor, the shutdown with no stop wait, and the Current
 * pass rows. The fixture holds enough source partitions per PV for a pass to last seconds; a run in which the pass
 * ended before the test acted, or in which the pass reached the chosen PV first, is reported as inconclusive through
 * Assumptions. The only substitutes are the clock and the environment reader.
 */
@Tag("slow")
public class ETLPassInProgressTest {
    private static final Logger logger = LogManager.getLogger(ETLPassInProgressTest.class);
    /**
     * The cost of a job grows with its partition count, so the fixture is many PVs holding a day of 5-minute
     * partitions each.
     */
    private static final int PV_COUNT = 64;
    private static final int DATA_SECONDS = 24 * 60 * 60;
    private static final long WAIT_SECONDS = 300;
    private static final long POLL_MILLIS = 20;
    private static final String TRANSITION_ID = "ETL(0&raquo;1)";
    private static final Pattern JOBS_DONE = Pattern.compile("^(\\d+) of (\\d+)$");
    private final String base =
            ConfigServiceForTests.getDefaultPBTestFolder() + "/" + ETLPassInProgressTest.class.getSimpleName();
    private ConfigServiceForTests configService;
    private PBThreeTierETLPVLookup lookup;
    private Instant yearStart;
    private Instant now;
    private final List<String> names = new ArrayList<>();
    private final List<ETLPVLookupItems> items = new ArrayList<>();

    private static final class TestClock extends Clock {
        private final Instant instant;

        TestClock(Instant instant) {
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

    @BeforeEach
    public void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1);
        FileUtils.deleteDirectory(new File(base));
        Assertions.assertTrue(new File(base + "/sts").mkdirs());
        Assertions.assertTrue(new File(base + "/mts").mkdirs());
        yearStart = TimeUtils.getStartOfYear(TimeUtils.getCurrentYear());
        now = yearStart.plusSeconds(DATA_SECONDS + 60 * 60);
        names.clear();
        items.clear();
    }

    @AfterEach
    public void tearDown() throws Exception {
        if (lookup != null) {
            lookup.manualControlForUnitTests();
        }
        configService.shutdownNow();
        FileUtils.deleteDirectory(new File(base));
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

    /**
     * The lookup with its clock past every source partition, and PV_COUNT PVs each holding DATA_SECONDS of samples
     * at one per second in the source store; the names sort in registration order, which is the pass order.
     */
    private ETLPassDriver fixture() throws Exception {
        lookup = new PBThreeTierETLPVLookup(configService, new TestClock(now), name -> null);
        PlainPBStoragePlugin sts =
                (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(stsUrl(), configService);
        short year = TimeUtils.getCurrentYear();
        for (int i = 0; i < PV_COUNT; i++) {
            String pvName = String.format("ArchUnitTest:ETLPassInProgress:pv%02d", i);
            PVTypeInfo typeInfo = new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
            typeInfo.setDataStores(new String[] {stsUrl(), mtsUrl()});
            configService.updateTypeInfoForPV(pvName, typeInfo);
            lookup.addETLJobsForUnitTests(pvName, typeInfo);
            try (BasicContext context = new BasicContext()) {
                ArrayListEventStream data = new ArrayListEventStream(
                        DATA_SECONDS, new RemotableEventStreamDesc(ArchDBRTypes.DBR_SCALAR_DOUBLE, pvName, year));
                for (int s = 0; s < DATA_SECONDS; s++) {
                    data.add(new SimulationEvent(
                            s, year, ArchDBRTypes.DBR_SCALAR_DOUBLE, new ScalarValue<Double>((double) s)));
                }
                sts.appendData(context, pvName, data);
            }
            names.add(pvName);
            items.add(lookup.getLookupItemsForPV(pvName).getFirst());
        }
        List<ETLPassDriver> drivers = lookup.getDrivers();
        Assertions.assertEquals(1, drivers.size(), "one driver for one transition and cadence");
        Assertions.assertEquals(names, drivers.get(0).getPVNames(), "the pass order is the name order");
        return drivers.get(0);
    }

    /** Starts the driver and its start-up pass through one tick. */
    private Future<ETLPassRecord> startPass(ETLPassDriver driver) {
        driver.start();
        Future<ETLPassRecord> pass = driver.tick(now);
        Assertions.assertNotNull(pass, "the start-up pass starts at the first tick");
        return pass;
    }

    /**
     * Waits, bounded, until the record in progress counts one job and returns that record. A pass that ended first
     * makes the run inconclusive.
     */
    private ETLPassRecord waitForTheFirstJob(ETLPassDriver driver, Future<ETLPassRecord> pass) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(WAIT_SECONDS);
        while (System.nanoTime() < deadline) {
            ETLPassRecord inProgress = driver.getInProgress();
            if (inProgress != null && inProgress.jobsRun() >= 1) {
                return inProgress;
            }
            Assumptions.assumeFalse(pass.isDone(), "inconclusive: the pass ended before the test acted");
            Thread.sleep(POLL_MILLIS);
        }
        throw new AssertionError("no job of the pass completed within " + WAIT_SECONDS + " s");
    }

    private ETLPassRecord closedRecord(ETLPassDriver driver, Future<ETLPassRecord> pass) throws Exception {
        ETLPassRecord record = pass.get(WAIT_SECONDS, TimeUnit.SECONDS);
        logger.info("pass record: " + record);
        Assertions.assertNotNull(record.endedAt());
        Assertions.assertNull(driver.getInProgress(), "no record in progress after the pass closed");
        return record;
    }

    /** The second into the year of the last event in the destination store, or -1 when it holds none. */
    private long lastDestinationSecond(ETLPVLookupItems item) throws Exception {
        try (BasicContext context = new BasicContext()) {
            Event last = item.getETLDest().getLastKnownEvent(context, item.getPvName());
            return last == null ? -1 : last.getEpochSeconds() - yearStart.getEpochSecond();
        }
    }

    /** The number of events of the PV in the destination store within the seconds the fixture wrote. */
    private long destinationEventCount(ETLPVLookupItems item) throws Exception {
        PlainPBStoragePlugin mts =
                (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(mtsUrl(), configService);
        long count = 0;
        try (BasicContext context = new BasicContext()) {
            for (Callable<EventStream> callable :
                    mts.getDataForPV(context, item.getPvName(), yearStart, yearStart.plusSeconds(DATA_SECONDS))) {
                try (EventStream stream = callable.call()) {
                    for (Event event : stream) {
                        long second = event.getEpochSeconds() - yearStart.getEpochSecond();
                        if (second >= 0 && second < DATA_SECONDS) {
                            count++;
                        }
                    }
                }
            }
        }
        return count;
    }

    private static String row(LinkedList<Map<String, String>> details, String name) {
        for (Map<String, String> detail : details) {
            if (name.equals(detail.get("name"))) {
                return detail.get("value");
            }
        }
        return null;
    }

    @Test
    public void deleteOfAPvAheadOfTheCursorConsolidatesWhileThePassIsOpen() throws Exception {
        ETLPassDriver driver = fixture();
        Future<ETLPassRecord> pass = startPass(driver);
        ETLPassRecord inProgress = waitForTheFirstJob(driver, pass);
        int position = inProgress.jobsRun() + 2;
        Assumptions.assumeTrue(position < PV_COUNT, "inconclusive: fewer than two PVs left after the cursor");
        String pvName = names.get(position);
        ETLPVLookupItems item = items.get(position);
        Assumptions.assumeTrue(lastDestinationSecond(item) == -1, "inconclusive: the pass reached the chosen PV");

        lookup.deleteETLJobs(pvName);
        Assertions.assertFalse(driver.hasPV(pvName));
        Assertions.assertEquals(
                DATA_SECONDS - 1, lastDestinationSecond(item), "the consolidation on delete moved every partition");
        Assumptions.assumeTrue(driver.getInProgress() != null, "inconclusive: the pass ended before the check");

        ETLPassRecord record = closedRecord(driver, pass);
        Assumptions.assumeTrue(
                record.skippedPvs().contains(pvName), "inconclusive: the pass ran the chosen PV before the delete");
        Assertions.assertEquals(PV_COUNT - 1, record.jobsRun(), "the removed PV is never counted as run");
        Assertions.assertEquals(1, record.jobsSkipped());
        Assertions.assertFalse(record.aborted());
    }

    @Test
    public void shutdownWithNoStopWaitAbortsThePassAndConsolidatesTheRest() throws Exception {
        configService.getInstallationProperties().setProperty(PBThreeTierETLPVLookup.STOP_WAIT_PROPERTY, "0");
        ETLPassDriver driver = fixture();
        Future<ETLPassRecord> pass = startPass(driver);
        int jobsBefore = waitForTheFirstJob(driver, pass).jobsRun();

        lookup.shutdown();
        ETLPassRecord record = closedRecord(driver, pass);
        Assertions.assertTrue(record.aborted(), "the stop flag closed the record as aborted");
        Assertions.assertTrue(
                record.jobsRun() <= jobsBefore + 1,
                "no job starts after the flag: " + jobsBefore + " before, " + record.jobsRun() + " in the record");
        Assertions.assertNull(driver.tick(now.plusSeconds(60 * 60)), "no pass starts after the flag");

        // The job running when the flag was set is the last one the record counts; its outcome depends on when the
        // interrupt reached it, so its data is not asserted. Every other PV was moved by the pass or by the shutdown
        // consolidation.
        int running = record.jobsRun() - 1;
        for (int i = 0; i < PV_COUNT; i++) {
            if (i == running) {
                continue;
            }
            Assertions.assertEquals(
                    DATA_SECONDS - 1, lastDestinationSecond(items.get(i)), names.get(i) + " holds every partition");
        }
    }

    @Test
    public void deleteOfThePvAtTheCursorRunsOrSkipsItOnce() throws Exception {
        ETLPassDriver driver = fixture();
        Future<ETLPassRecord> pass = startPass(driver);
        int position = waitForTheFirstJob(driver, pass).jobsRun();
        Assumptions.assumeTrue(position < PV_COUNT, "inconclusive: the pass ended before the delete");
        String pvName = names.get(position);
        ETLPVLookupItems item = items.get(position);

        lookup.deleteETLJobs(pvName);
        Assertions.assertFalse(driver.hasPV(pvName));
        Assertions.assertEquals(DATA_SECONDS - 1, lastDestinationSecond(item), "the PV reached the destination");

        ETLPassRecord record = closedRecord(driver, pass);
        boolean skipped = record.skippedPvs().contains(pvName);
        Assertions.assertEquals(PV_COUNT, record.jobsRun() + record.jobsSkipped(), "every PV is run or skipped");
        Assertions.assertEquals(
                skipped ? PV_COUNT - 1 : PV_COUNT, record.jobsRun(), "the PV is run once or skipped, never both");
        Assertions.assertEquals(DATA_SECONDS, destinationEventCount(item), "the destination holds the data once");
        Assertions.assertFalse(record.aborted());
        logger.info(pvName + " at position " + position + " was " + (skipped ? "skipped" : "run") + " by the pass");
    }

    @Test
    public void currentPassRowsReadTheRecordInProgress() throws Exception {
        ETLPassDriver driver = fixture();
        Future<ETLPassRecord> pass = startPass(driver);
        ETLPassRecord before = waitForTheFirstJob(driver, pass);

        LinkedList<Map<String, String>> details = lookup.getApplianceMetrics().details(configService);
        ETLPassRecord after = driver.getInProgress();
        Assumptions.assumeTrue(after != null, "inconclusive: the pass ended while the rows were read");

        Assertions.assertNull(
                row(details, "Current pass in " + TRANSITION_ID), "the none row is absent while a pass runs");
        Assertions.assertEquals(
                TimeUtils.convertToHumanReadableString(before.startedAt().getEpochSecond()),
                row(details, "Current pass in " + TRANSITION_ID + " started at"));
        String elapsed = row(details, "Current pass in " + TRANSITION_ID + " elapsed (s)");
        Assertions.assertNotNull(elapsed, "the elapsed row is present");
        Assertions.assertTrue(Double.parseDouble(elapsed.replace(",", "")) >= 0, "elapsed reads " + elapsed);
        String jobsDone = row(details, "Current pass in " + TRANSITION_ID + " jobs done of PVs");
        Assertions.assertNotNull(jobsDone, "the jobs done row is present");
        Matcher matcher = JOBS_DONE.matcher(jobsDone);
        Assertions.assertTrue(matcher.matches(), "the row reads " + jobsDone);
        int done = Integer.parseInt(matcher.group(1));
        Assertions.assertEquals(PV_COUNT, Integer.parseInt(matcher.group(2)));
        Assertions.assertEquals(PV_COUNT, before.pvCount());
        Assertions.assertTrue(
                done >= before.jobsRun() && done <= after.jobsRun(),
                "jobs done " + done + " between " + before.jobsRun() + " and " + after.jobsRun());

        closedRecord(driver, pass);
    }
}
