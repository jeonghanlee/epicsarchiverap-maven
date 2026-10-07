package org.epics.archiverappliance.etl;

import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.Level;
import org.epics.archiverappliance.ByteArray;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.CapturedLog;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.etl.common.ETLMetricsForLifetime;
import org.epics.archiverappliance.etl.common.ETLPVLookupItems;
import org.epics.archiverappliance.etl.common.ETLPassDriver;
import org.epics.archiverappliance.etl.common.ETLPassRecord;
import org.epics.archiverappliance.etl.common.ETLPassTicker;
import org.epics.archiverappliance.etl.common.ETLRunReport;
import org.epics.archiverappliance.etl.common.OutOfSpaceHandling;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.epics.archiverappliance.utils.simulation.SimulationEvent;
import org.epics.archiverappliance.utils.nio.ArchPaths;
import edu.stanford.slac.archiverappliance.PlainPB.FileBackedPBEventStream;
import edu.stanford.slac.archiverappliance.PlainPB.PlainPBPathNameUtility;
import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Comparator;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * ETL pass driver and ticker over real PlainPB stores and the shipped ETLJob. The only substitutes are the driver
 * clock (a settable clock, and a stepping clock for the overrun case) and the environment reader.
 */
public class ETLPassDriverTest {
    private static final long WAIT_SECONDS = 60;
    private static final int TRANSFER_SAMPLES = 900;
    private static final int PARTITION_SAMPLES = 300;
    private static final String INVALID_REDUCTION = "&reducedata=firstSample_notAnInteger";
    private final String base =
            ConfigServiceForTests.getDefaultPBTestFolder() + "/" + ETLPassDriverTest.class.getSimpleName();
    private ConfigServiceForTests configService;
    private ExecutorService worker0;
    private ExecutorService worker1;
    private Instant yearStart;

    /** A clock whose instant the test sets, and which advances by a fixed step on every read when one is set. */
    private static final class TestClock extends Clock {
        private Instant instant;
        private long stepSeconds = 0;

        TestClock(Instant instant) {
            this.instant = instant;
        }

        synchronized void set(Instant instant) {
            this.instant = instant;
        }

        synchronized void setStepSeconds(long stepSeconds) {
            this.stepSeconds = stepSeconds;
        }

        @Override
        public synchronized Instant instant() {
            Instant now = instant;
            instant = instant.plusSeconds(stepSeconds);
            return now;
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
        Assertions.assertTrue(new File(base).mkdirs());
        worker0 = Executors.newSingleThreadExecutor();
        worker1 = Executors.newSingleThreadExecutor();
        yearStart = TimeUtils.getStartOfYear(TimeUtils.getCurrentYear());
    }

    @AfterEach
    public void tearDown() throws Exception {
        worker0.shutdownNow();
        worker1.shutdownNow();
        configService.shutdownNow();
        FileUtils.deleteDirectory(new File(base));
    }

    private String url(String name, String folder, String granularity) {
        return "pb://localhost?name=" + name + "&rootFolder=" + base + "/" + folder + "&partitionGranularity="
                + granularity;
    }

    private ETLPVLookupItems item(String pvName, String srcUrl, String destUrl, int transition) throws Exception {
        return new ETLPVLookupItems(
                pvName,
                ArchDBRTypes.DBR_SCALAR_DOUBLE,
                StoragePluginURLParser.parseETLSource(srcUrl, configService),
                StoragePluginURLParser.parseETLDest(destUrl, configService),
                transition,
                new ETLMetricsForLifetime(transition),
                OutOfSpaceHandling.DELETE_SRC_STREAMS_IF_FIRST_DEST_WHEN_OUT_OF_SPACE);
    }

    /** Writes one sample per second over the given seconds from the start of the year into the source store. */
    private void write(String pvName, String srcUrl, int seconds) throws Exception {
        PlainPBStoragePlugin sts = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(srcUrl, configService);
        short year = TimeUtils.getCurrentYear();
        try (BasicContext context = new BasicContext()) {
            ArrayListEventStream data = new ArrayListEventStream(
                    seconds, new RemotableEventStreamDesc(ArchDBRTypes.DBR_SCALAR_DOUBLE, pvName, year));
            for (int s = 0; s < seconds; s++) {
                data.add(new SimulationEvent(s, year, ArchDBRTypes.DBR_SCALAR_DOUBLE, new ScalarValue<Double>((double) s)));
            }
            sts.appendData(context, pvName, data);
        }
    }

    private Instant at(long secondsIntoYear) {
        return yearStart.plusSeconds(secondsIntoYear);
    }

    private static ETLPassRecord await(Future<ETLPassRecord> pass) throws Exception {
        Assertions.assertNotNull(pass, "a pass was expected to start");
        return pass.get(WAIT_SECONDS, TimeUnit.SECONDS);
    }

    private record PhysicalSample(Instant timestamp, String eventBytes) {}

    private record Transfer(
            String pv, String sourceUrl, String destinationUrl, ETLPVLookupItems lookup,
            TestClock clock, ETLPassDriver driver, List<PhysicalSample> original, List<Long> sourceSizes) {}

    /** Lists only this PV's physical files, without retrieval merging or deduplication. */
    private Path[] pvFiles(String pv, String storeUrl) throws Exception {
        PlainPBStoragePlugin store =
                (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(storeUrl, configService);
        if (!Files.isDirectory(Path.of(store.getRootFolder()))) {
            return new Path[0];
        }
        return PlainPBPathNameUtility.getAllPathsForPV(
                new ArchPaths(), store.getRootFolder(), pv, store.getExtensionString(),
                store.getPartitionGranularity(), PlainPBStoragePlugin.CompressionMode.NONE,
                configService.getPVNameToKeyConverter());
    }

    private List<PhysicalSample> physicalSamples(String pv, String storeUrl) throws Exception {
        List<PhysicalSample> samples = new ArrayList<>();
        for (Path path : pvFiles(pv, storeUrl)) {
            try (var stream = new FileBackedPBEventStream(pv, path, ArchDBRTypes.DBR_SCALAR_DOUBLE)) {
                for (Event event : stream) {
                    ByteArray raw = event.getRawForm();
                    samples.add(new PhysicalSample(event.getEventTimeStamp(), Base64.getEncoder().encodeToString(
                            Arrays.copyOfRange(raw.data, raw.off, raw.off + raw.len))));
                }
            }
        }
        samples.sort(Comparator.comparing(PhysicalSample::timestamp).thenComparing(PhysicalSample::eventBytes));
        return samples;
    }

    private Transfer transfer(String name, boolean invalidReduction) throws Exception {
        String pv = "ArchUnitTest:ETLPassDriver:" + name;
        String source = url("STS", "sts", "PARTITION_5MIN") + "&hold=2&gather=1";
        String destination = url("MTS", "mts", "PARTITION_HOUR") + "&hold=2&gather=1";
        ETLPVLookupItems lookup = item(pv, source, destination + (invalidReduction ? INVALID_REDUCTION : ""), 0);
        write(pv, source, TRANSFER_SAMPLES);
        List<PhysicalSample> original = physicalSamples(pv, source);
        Assertions.assertEquals(TRANSFER_SAMPLES, original.size());
        List<Long> sizes = new ArrayList<>();
        for (Path path : pvFiles(pv, source)) {
            sizes.add(Files.size(path));
        }
        Assertions.assertEquals(3, sizes.size());
        TestClock clock = new TestClock(at(15 * 60));
        ETLPassDriver driver = new ETLPassDriver(0, 300, clock, nameInEnvironment -> null, worker0);
        driver.addPV(lookup);
        driver.start();
        return new Transfer(pv, source, destination, lookup, clock, driver, original, sizes);
    }

    private ETLPassRecord runAt(ETLPassDriver driver, TestClock clock, int minute) throws Exception {
        Instant time = at(minute * 60L);
        clock.set(time);
        ETLPassRecord record = await(driver.tick(time));
        Assertions.assertEquals(time, record.plannedAt());
        Assertions.assertEquals(time, record.startedAt());
        Assertions.assertEquals(time.minusSeconds(60), record.processingTime());
        return record;
    }

    private void assertPhysicalState(Transfer transfer, int movedSamples) throws Exception {
        Assertions.assertAll(
                () -> Assertions.assertEquals(
                        transfer.original().subList(movedSamples, TRANSFER_SAMPLES),
                        physicalSamples(transfer.pv(), transfer.sourceUrl()), "retained source events"),
                () -> Assertions.assertEquals(
                        transfer.original().subList(0, movedSamples),
                        physicalSamples(transfer.pv(), transfer.destinationUrl()), "destination events"));
    }

    private void assertStartup(Transfer transfer) throws Exception {
        ETLPassRecord record = runAt(transfer.driver(), transfer.clock(), 15);
        Assertions.assertEquals(0, record.streamsReturned());
        Assertions.assertEquals(0, record.partitionsMoved());
        Assertions.assertEquals(0, record.jobsFailed());
        assertPhysicalState(transfer, 0);
    }

    private void assertFailedTransfer(Transfer transfer, ETLPassRecord record, int partitions) throws Exception {
        ETLRunReport job = transfer.lookup().getLastRunReport();
        Assertions.assertAll(
                () -> assertPhysicalState(transfer, 0),
                () -> Assertions.assertEquals(partitions, record.streamsReturned()),
                () -> Assertions.assertEquals(1, record.jobsRun()),
                () -> Assertions.assertEquals(1, record.jobsFailed()),
                () -> Assertions.assertEquals(0, record.jobsAborted()),
                () -> Assertions.assertEquals(0, record.jobsSkipped()),
                () -> Assertions.assertEquals(0, record.partitionsMoved()),
                () -> Assertions.assertEquals(0, record.bytesMoved()),
                () -> Assertions.assertEquals(0, record.streamsDeletedForSpace()),
                () -> Assertions.assertEquals(partitions, job.partitionsFailed()),
                () -> Assertions.assertNotNull(job.firstFailure()),
                () -> Assertions.assertTrue(String.valueOf(job.firstFailure()).contains("returned false")),
                () -> Assertions.assertTrue(String.valueOf(job.firstFailure()).contains(
                        pvFiles(transfer.pv(), transfer.sourceUrl())[0].toAbsolutePath().toString())));
    }

    private void assertFailureLog(CapturedLog log, ETLPassRecord record, String pv, int partitions) throws Exception {
        log.settle();
        List<CapturedLog.Entry> failures = log.at(Level.ERROR).stream()
                .filter(entry -> entry.message().startsWith("ETL pass failed to move partitions:"))
                .filter(entry -> entry.message().contains("plannedAt=" + record.plannedAt() + " "))
                .toList();
        Assertions.assertEquals(1, failures.size(), "failure log for " + record.plannedAt());
        String message = failures.getFirst().message();
        Assertions.assertTrue(message.contains("source=STS destination=MTS "), message);
        Assertions.assertTrue(message.contains("failedPartitions=" + partitions + " "), message);
        Assertions.assertTrue(message.contains("affectedPVs=1 "), message);
        Assertions.assertTrue(message.contains("firstPV=" + pv + " "), message);
        Assertions.assertTrue(message.contains("returned false"), message);
    }

    @Test
    public void falseAppendRetainsSourceAndReportsFailure() throws Exception {
        Transfer transfer = transfer("falseAppend", true);
        assertStartup(transfer);
        try (CapturedLog log = new CapturedLog("org.epics.archiverappliance.etl", Level.DEBUG)) {
            ETLPassRecord record = runAt(transfer.driver(), transfer.clock(), 20);
            assertFailedTransfer(transfer, record, 1);
            assertFailureLog(log, record, transfer.pv(), 1);
        }
    }

    @Test
    public void falseAppendContinuesThroughTwoPartitionsOfOnePV() throws Exception {
        Transfer transfer = transfer("twoFalseAppends", true);
        assertStartup(transfer);
        try (CapturedLog log = new CapturedLog("org.epics.archiverappliance.etl", Level.DEBUG)) {
            ETLPassRecord first = runAt(transfer.driver(), transfer.clock(), 20);
            assertFailedTransfer(transfer, first, 1);
            assertFailureLog(log, first, transfer.pv(), 1);
            ETLPassRecord second = runAt(transfer.driver(), transfer.clock(), 25);
            assertFailedTransfer(transfer, second, 2);
            assertFailureLog(log, second, transfer.pv(), 2);
        }
    }

    @Test
    public void falseAppendDoesNotStopLaterPVsOrInflateMovedTotals() throws Exception {
        Transfer a = transfer("mixed:A", false);
        Transfer b = transfer("mixed:B", true);
        Transfer c = transfer("mixed:C", false);
        // One driver owns the ordered pass over all three PVs.
        a.driver().addPV(b.lookup());
        a.driver().addPV(c.lookup());
        assertStartup(a);
        assertPhysicalState(b, 0);
        assertPhysicalState(c, 0);
        try (CapturedLog log = new CapturedLog("org.epics.archiverappliance.etl", Level.DEBUG)) {
            ETLPassRecord record = runAt(a.driver(), a.clock(), 20);
            Assertions.assertAll(
                    () -> assertPhysicalState(a, PARTITION_SAMPLES),
                    () -> assertPhysicalState(b, 0),
                    () -> assertPhysicalState(c, PARTITION_SAMPLES),
                    () -> Assertions.assertEquals(3, record.jobsRun()),
                    () -> Assertions.assertEquals(1, record.jobsFailed()),
                    () -> Assertions.assertEquals(0, record.jobsAborted()),
                    () -> Assertions.assertEquals(0, record.jobsSkipped()),
                    () -> Assertions.assertEquals(3, record.streamsReturned()),
                    () -> Assertions.assertEquals(2, record.partitionsMoved()),
                    () -> Assertions.assertEquals(a.sourceSizes().getFirst() + c.sourceSizes().getFirst(), record.bytesMoved()),
                    () -> Assertions.assertEquals(0, record.streamsDeletedForSpace()),
                    () -> Assertions.assertEquals(0, a.lookup().getLastRunReport().partitionsFailed()),
                    () -> Assertions.assertEquals(1, b.lookup().getLastRunReport().partitionsFailed()),
                    () -> Assertions.assertEquals(0, c.lookup().getLastRunReport().partitionsFailed()));
            assertFailureLog(log, record, b.pv(), 1);
        }
    }

    private void assertSuccessfulPass(Transfer transfer, ETLPVLookupItems lookup, int minute,
            int movedSamples, int partitions, long bytes) throws Exception {
        ETLPassRecord record = runAt(transfer.driver(), transfer.clock(), minute);
        assertPhysicalState(transfer, movedSamples);
        Assertions.assertEquals(0, record.jobsFailed());
        Assertions.assertEquals(0, lookup.getLastRunReport().partitionsFailed());
        Assertions.assertEquals(0, record.streamsDeletedForSpace());
        Assertions.assertEquals(partitions, record.partitionsMoved());
        Assertions.assertEquals(bytes, record.bytesMoved());
    }

    @Test
    public void retainedFilesRecoverAfterRemovingInvalidReduction() throws Exception {
        Transfer transfer = transfer("reductionRetry", true);
        assertStartup(transfer);
        try (CapturedLog log = new CapturedLog("org.epics.archiverappliance.etl", Level.DEBUG)) {
            ETLPassRecord failed = runAt(transfer.driver(), transfer.clock(), 20);
            assertFailedTransfer(transfer, failed, 1);
            assertFailureLog(log, failed, transfer.pv(), 1);
        }
        ETLPVLookupItems corrected = item(transfer.pv(), transfer.sourceUrl(), transfer.destinationUrl(), 0);
        transfer.driver().addPV(corrected);
        assertSuccessfulPass(transfer, corrected, 25, 600, 2,
                transfer.sourceSizes().get(0) + transfer.sourceSizes().get(1));
        assertSuccessfulPass(transfer, corrected, 30, 900, 1, transfer.sourceSizes().get(2));
        assertSuccessfulPass(transfer, corrected, 35, 900, 0, 0);
    }

    @Test
    public void heldPartitionsMoveWithoutChangingPhysicalSamples() throws Exception {
        Transfer transfer = transfer("exactMovement", false);
        assertStartup(transfer);
        for (int partition = 0; partition < 3; partition++) {
            assertSuccessfulPass(transfer, transfer.lookup(), 20 + partition * 5,
                    (partition + 1) * PARTITION_SAMPLES, 1, transfer.sourceSizes().get(partition));
        }
    }

    @Test
    public void filesystemFailureRetainsPhysicalSamplesUntilRecovery() throws Exception {
        Path blocked = Path.of(base, "mts");
        Files.writeString(blocked, "not a directory");
        Transfer transfer = transfer("filesystemRetry", false);
        assertStartup(transfer);
        ETLPassRecord failed = runAt(transfer.driver(), transfer.clock(), 20);
        Assertions.assertEquals(1, failed.jobsFailed());
        Assertions.assertEquals(0, failed.partitionsMoved());
        Assertions.assertEquals(0, failed.bytesMoved());
        assertPhysicalState(transfer, 0);
        Files.move(blocked, Path.of(base, "blocked-destination-marker"));
        Files.createDirectory(blocked);
        assertSuccessfulPass(transfer, transfer.lookup(), 25, 600, 2,
                transfer.sourceSizes().get(0) + transfer.sourceSizes().get(1));
        assertSuccessfulPass(transfer, transfer.lookup(), 30, 900, 1, transfer.sourceSizes().get(2));
    }

    @Test
    public void fiveMinuteSourceFiresOnItsGrid() throws Exception {
        String sts = url("STS", "sts", "PARTITION_5MIN");
        String mts = url("MTS", "mts", "PARTITION_HOUR");
        TestClock clock = new TestClock(at(7 * 60 + 30));
        ETLPassDriver driver = new ETLPassDriver(0, 300, clock, name -> null, worker0);
        for (int i = 0; i < 3; i++) {
            String pv = "ArchUnitTest:ETLPassDriver:five" + i;
            driver.addPV(item(pv, sts, mts, 0));
            write(pv, sts, 20 * 60);
        }
        Assertions.assertNull(driver.tick(clock.instant()), "no pass before start");

        driver.start();
        ETLPassRecord startup = await(driver.tick(at(7 * 60 + 30)));
        Assertions.assertEquals(at(7 * 60 + 30), startup.plannedAt(), "the start-up pass is planned at its start");
        Assertions.assertEquals(at(6 * 60 + 30), startup.processingTime());
        Assertions.assertEquals(3, startup.partitionsMoved(), "the partition that closed at 00:05 moves");
        Assertions.assertEquals(at(10 * 60), driver.getNextPlannedAt());

        Assertions.assertNull(driver.tick(at(10 * 60 - 1)), "no pass before the grid time");
        clock.set(at(10 * 60));
        ETLPassRecord atTen = await(driver.tick(at(10 * 60)));
        Assertions.assertEquals(at(10 * 60), atTen.plannedAt());
        Assertions.assertEquals(at(9 * 60), atTen.processingTime());
        Assertions.assertEquals(0, atTen.partitionsMoved(), "the 00:05 to 00:10 partition is still current at 00:09");
        Assertions.assertEquals(at(15 * 60), driver.getNextPlannedAt());

        clock.set(at(15 * 60));
        ETLPassRecord atFifteen = await(driver.tick(at(15 * 60)));
        Assertions.assertEquals(at(14 * 60), atFifteen.processingTime());
        Assertions.assertEquals(3, atFifteen.partitionsMoved(), "the partition that closed at 00:10 moves");
        Assertions.assertFalse(atFifteen.overrun());
        Assertions.assertEquals(3, driver.getCompletedPasses());
    }

    @Test
    public void fifteenMinuteSourceUsesTheOffset() throws Exception {
        String sts = url("STS", "sts", "PARTITION_15MIN");
        String mts = url("MTS", "mts", "PARTITION_HOUR");
        TestClock clock = new TestClock(at(20 * 60));
        ETLPassDriver driver = new ETLPassDriver(0, 900, clock, name -> null, worker0);
        String pv = "ArchUnitTest:ETLPassDriver:fifteen";
        driver.addPV(item(pv, sts, mts, 0));
        write(pv, sts, 45 * 60);

        driver.start();
        ETLPassRecord startup = await(driver.tick(at(20 * 60)));
        Assertions.assertEquals(1, startup.partitionsMoved(), "the 00:00 to 00:15 partition moves");
        Assertions.assertEquals(at(35 * 60), driver.getNextPlannedAt(), "grid of 15 minutes plus 5 minutes");

        clock.set(at(35 * 60));
        ETLPassRecord next = await(driver.tick(at(35 * 60)));
        Assertions.assertEquals(at(34 * 60), next.processingTime());
        Assertions.assertEquals(1, next.partitionsMoved(), "the 00:15 to 00:30 partition moves");
    }

    @Test
    public void overrunIsRecordedAndTheNextPassWaitsForTheFollowingGridTime() throws Exception {
        String sts = url("STS", "sts", "PARTITION_5MIN");
        String mts = url("MTS", "mts", "PARTITION_HOUR");
        TestClock clock = new TestClock(at(10 * 60));
        ETLPassDriver driver = new ETLPassDriver(0, 300, clock, name -> null, worker0);
        String pv = "ArchUnitTest:ETLPassDriver:overrun";
        driver.addPV(item(pv, sts, mts, 0));
        write(pv, sts, 10 * 60);
        driver.start();
        // Every clock read advances 400 s, so the end of the pass reads past the next grid time.
        clock.setStepSeconds(400);
        ETLPassRecord record = await(driver.tick(at(10 * 60)));
        clock.setStepSeconds(0);

        Assertions.assertTrue(record.overrun(), "endedAt " + record.endedAt() + " is past the next grid time");
        Instant next = driver.getNextPlannedAt();
        Assertions.assertTrue(next.isAfter(record.endedAt()), "the next pass waits for a grid time after the end");
        Assertions.assertEquals(0, (next.getEpochSecond() - 300) % 300, "the next planned time is on the grid");
    }

    @Test
    public void aClockThatWentBackwardsReschedulesFromTheClock() throws Exception {
        String sts = url("STS", "sts", "PARTITION_5MIN");
        String mts = url("MTS", "mts", "PARTITION_HOUR");
        TestClock clock = new TestClock(at(20 * 60));
        ETLPassDriver driver = new ETLPassDriver(0, 300, clock, name -> null, worker0);
        driver.addPV(item("ArchUnitTest:ETLPassDriver:back", sts, mts, 0));
        driver.start();
        await(driver.tick(at(20 * 60)));
        Assertions.assertEquals(at(25 * 60), driver.getNextPlannedAt());

        Assertions.assertNull(driver.tick(at(12 * 60)), "no pass when the clock reads before the last start");
        Assertions.assertEquals(at(15 * 60), driver.getNextPlannedAt(), "rescheduled to the grid time after 00:12");
    }

    @Test
    public void laterTransitionWaitsForTheEarlierOne() throws Exception {
        String sts = url("STS", "sts", "PARTITION_5MIN");
        String mts = url("MTS", "mts", "PARTITION_HOUR");
        String lts = url("LTS", "lts", "PARTITION_DAY");
        TestClock clock = new TestClock(at(20 * 60));
        ETLPassDriver first = new ETLPassDriver(0, 300, clock, name -> null, worker0);
        ETLPassDriver second = new ETLPassDriver(1, 3600, clock, name -> null, worker1);
        for (int i = 0; i < 20; i++) {
            String pv = "ArchUnitTest:ETLPassDriver:order" + i;
            first.addPV(item(pv, sts, mts, 0));
            second.addPV(item(pv, mts, lts, 1));
            write(pv, sts, 15 * 60);
        }
        ETLPassTicker ticker = new ETLPassTicker(clock);
        ticker.addDriver(second);
        ticker.addDriver(first);
        first.start();
        second.start();
        Instant secondPlanned = at(20 * 60);

        List<Future<ETLPassRecord>> firstTick = ticker.tickAll(at(20 * 60));
        Assertions.assertEquals(1, firstTick.size(), "only transition 0 starts while it runs");
        Assertions.assertFalse(second.isRunning());
        ETLPassRecord firstRecord = await(firstTick.get(0));

        List<Future<ETLPassRecord>> secondTick = ticker.tickAll(at(20 * 60));
        Assertions.assertEquals(1, secondTick.size(), "transition 1 starts at the first tick after transition 0 ended");
        ETLPassRecord secondRecord = await(secondTick.get(0));
        Assertions.assertEquals(secondPlanned, secondRecord.plannedAt(), "its planned time is unchanged");
        Assertions.assertFalse(secondRecord.startedAt().isBefore(firstRecord.endedAt()));
    }

    @Test
    public void recordSumsMatchTheJobs() throws Exception {
        String sts = url("STS", "sts", "PARTITION_5MIN");
        String mts = url("MTS", "mts", "PARTITION_HOUR");
        TestClock clock = new TestClock(at(12 * 60));
        ETLPassDriver driver = new ETLPassDriver(0, 300, clock, name -> null, worker0);
        String large = "ArchUnitTest:ETLPassDriver:large";
        String small = "ArchUnitTest:ETLPassDriver:small";
        driver.addPV(item(large, sts, mts, 0));
        driver.addPV(item(small, sts, mts, 0));
        write(large, sts, 15 * 60);
        write(small, sts, 5 * 60);

        driver.start();
        ETLPassRecord first = await(driver.tick(at(12 * 60)));
        Assertions.assertEquals(2, first.pvCount());
        Assertions.assertEquals(2, first.jobsRun());
        Assertions.assertEquals(0, first.jobsFailed());
        Assertions.assertEquals(3, first.partitionsMoved(), "two partitions of the large PV and one of the small");
        Assertions.assertEquals(2, first.maxPartitionsMovedByOnePv());
        Assertions.assertTrue(first.bytesMoved() > 0);
        Assertions.assertTrue(first.busyMillis() >= first.slowestMillis());
        Assertions.assertTrue(first.slowestPv().equals(large) || first.slowestPv().equals(small));

        // A second pass on the next day of the driver clock.
        clock.set(at(24 * 60 * 60 + 12 * 60));
        ETLPassRecord second = await(driver.tick(at(24 * 60 * 60 + 12 * 60)));
        Assertions.assertEquals(2, driver.getCompletedPasses());
        Assertions.assertEquals(first.busyMillis() + second.busyMillis(), driver.getBusyMillisTotal());
        Instant now = at(2 * 24 * 60 * 60);
        double expected = (driver.getBusyMillisTotal() * 100.0) / ((now.getEpochSecond() - yearStart.getEpochSecond()) * 1000.0);
        Assertions.assertEquals(expected, driver.getWeeklyUsagePercent(now), 1e-12);
    }

    @Test
    public void unwritableDestinationCountsAsAFailedJob() throws Exception {
        File blocked = new File(base + "/blocked");
        Files.writeString(blocked.toPath(), "not a directory");
        Assumptions.assumeFalse(new File(blocked, "probe").mkdirs(), "the blocked path accepted a directory");
        String sts = url("STS", "sts", "PARTITION_5MIN");
        String good = url("MTS", "mts", "PARTITION_HOUR");
        String bad = "pb://localhost?name=MTS&rootFolder=" + blocked.getAbsolutePath()
                + "&partitionGranularity=PARTITION_HOUR";
        TestClock clock = new TestClock(at(12 * 60));
        ETLPassDriver driver = new ETLPassDriver(0, 300, clock, name -> null, worker0);
        driver.addPV(item("ArchUnitTest:ETLPassDriver:good", sts, good, 0));
        driver.addPV(item("ArchUnitTest:ETLPassDriver:bad", sts, bad, 0));
        write("ArchUnitTest:ETLPassDriver:good", sts, 10 * 60);
        write("ArchUnitTest:ETLPassDriver:bad", sts, 10 * 60);

        driver.start();
        ETLPassRecord record = await(driver.tick(at(12 * 60)));
        Assertions.assertEquals(2, record.jobsRun());
        Assertions.assertEquals(1, record.jobsFailed(), "the job into the unwritable store fails");
        Assertions.assertNotNull(driver.getNextPlannedAt(), "the driver has a next firing after the failure");
    }
}
