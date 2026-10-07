package org.epics.archiverappliance.etl;

import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.ByteArray;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.EventStream;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.CapturedLog;
import org.epics.archiverappliance.common.POJOEvent;
import org.epics.archiverappliance.common.PartitionGranularity;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.data.AlarmInfo;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.etl.common.ETLMetricsForLifetime;
import org.epics.archiverappliance.etl.common.ETLMetrics;
import org.epics.archiverappliance.etl.common.ETLPVLookupItems;
import org.epics.archiverappliance.etl.common.ETLPassDriver;
import org.epics.archiverappliance.etl.common.ETLPassRecord;
import org.epics.archiverappliance.etl.common.ETLPassTicker;
import org.epics.archiverappliance.etl.common.ETLRunReport;
import org.epics.archiverappliance.etl.common.OutOfSpaceHandling;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.epics.archiverappliance.retrieval.workers.CurrentThreadWorkerEventStream;
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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

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
import java.util.stream.Stream;

/**
 * ETL pass driver and ticker over real PlainPB stores and the shipped ETLJob. The only substitutes are the driver
 * clock (a settable clock, and a stepping clock for the overrun case) and the environment reader.
 */
public class ETLPassDriverTest {
    private static final Logger logger = LogManager.getLogger(ETLPassDriverTest.class);
    private static final long WAIT_SECONDS = 60;
    private static final int TRANSFER_SAMPLES = 900;
    private static final int PARTITION_SAMPLES = 300;
    private static final String INVALID_REDUCTION = "&reducedata=firstSample_notAnInteger";
    private static final long FIXTURE_DAY_SECONDS = 4 * 86400L;
    private static final String HOLD_AND_GATHER = "&hold=2&gather=1";
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

    private record Sample(Instant timestamp, double value, int status, int severity) {
        Event event() {
            return new POJOEvent(ArchDBRTypes.DBR_SCALAR_DOUBLE, timestamp,
                    new ScalarValue<Double>(value), status, severity);
        }
    }

    private record Hop(String name, PartitionGranularity source, PartitionGranularity destination, int transition) {}

    private static List<Hop> hops() {
        return List.of(
                new Hop("shortenedSTS", PartitionGranularity.PARTITION_5MIN, PartitionGranularity.PARTITION_HOUR, 0),
                new Hop("shortenedMTS", PartitionGranularity.PARTITION_HOUR, PartitionGranularity.PARTITION_DAY, 1),
                new Hop("defaultSTS", PartitionGranularity.PARTITION_HOUR, PartitionGranularity.PARTITION_DAY, 0),
                new Hop("defaultMTS", PartitionGranularity.PARTITION_DAY, PartitionGranularity.PARTITION_YEAR, 1));
    }

    private static Stream<Arguments> selectionBoundaries() {
        return hops().stream().flatMap(hop -> Stream.of(-1, 0, 1).map(offset -> Arguments.of(hop, offset)));
    }

    private static Stream<Arguments> chains() {
        return Stream.of(Arguments.of(hops().get(0), hops().get(1)), Arguments.of(hops().get(2), hops().get(3)));
    }

    private static Stream<Arguments> reductionPolicies() {
        return Stream.of(hops().get(1), hops().get(3))
                .flatMap(hop -> Stream.of(10, 30, 60).map(interval -> Arguments.of(hop, interval)));
    }

    private void writeSamples(String pv, String storeUrl, List<Sample> samples) throws Exception {
        PlainPBStoragePlugin store =
                (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(storeUrl, configService);
        ArrayListEventStream events = new ArrayListEventStream(samples.size(),
                new RemotableEventStreamDesc(ArchDBRTypes.DBR_SCALAR_DOUBLE, pv, TimeUtils.getCurrentYear()));
        for (Sample sample : samples) {
            events.add(sample.event());
        }
        try (BasicContext context = new BasicContext()) {
            store.appendData(context, pv, events);
        }
    }

    private static PhysicalSample physicalSample(Event event) {
        ByteArray raw = event.getRawForm();
        return new PhysicalSample(event.getEventTimeStamp(), Base64.getEncoder().encodeToString(
                Arrays.copyOfRange(raw.data, raw.off, raw.off + raw.len)));
    }

    private List<PhysicalSample> expectedPhysical(List<Sample> samples) {
        return samples.stream().map(sample -> physicalSample(sample.event())).toList();
    }

    private Sample sample(Instant timestamp, int value) {
        return new Sample(timestamp, value, value % 3, value % 2);
    }

    private ETLPassDriver driver(Hop hop, TestClock clock, String pv, String source, String destination)
            throws Exception {
        ETLPassDriver driver = new ETLPassDriver(hop.transition(), ETLPassDriver.cadenceFor(hop.source()),
                clock, name -> null, hop.transition() == 0 ? worker0 : worker1);
        driver.addPV(item(pv, source, destination, hop.transition()));
        return driver;
    }

    /** All futures finish before the outer clock advances or physical storage is inspected. */
    private ETLPassRecord tickOne(ETLPassTicker ticker, TestClock clock, Instant time) throws Exception {
        clock.set(time);
        List<Future<ETLPassRecord>> passes = ticker.tickAll(time);
        Assertions.assertEquals(1, passes.size(), "exactly one transition must be due");
        ETLPassRecord pass = await(passes.getFirst());
        Assertions.assertEquals(time, pass.startedAt());
        Assertions.assertEquals(time.minusSeconds(60), pass.processingTime());
        Assertions.assertEquals(0, pass.jobsFailed());
        Assertions.assertEquals(0, pass.jobsAborted());
        Assertions.assertEquals(0, pass.streamsDeletedForSpace());
        return pass;
    }

    private void assertSourceFiles(String pv, String source, Path[] original, int removed) throws Exception {
        List<Path> expected = Arrays.asList(original).subList(removed, original.length);
        List<Path> actual = Arrays.asList(pvFiles(pv, source));
        Assertions.assertEquals(expected, actual, "retained source file paths");
        for (int i = 0; i < removed; i++) {
            Assertions.assertFalse(Files.exists(original[i]), "source file must be deleted: " + original[i]);
        }
    }

    @ParameterizedTest(name = "{0}, startup boundary offset {1} s")
    @MethodSource("selectionBoundaries")
    public void holdBoundaryPreservesPhysicalSamplesAtStartupAndScheduledPass(Hop hop, int offset) throws Exception {
        String pv = "ArchUnitTest:ETLPassDriver:boundary:" + hop.name();
        String source = url("SOURCE", "source", hop.source().name()) + HOLD_AND_GATHER;
        String destination = url("DEST", "destination", hop.destination().name());
        long partition = hop.source().getApproxSecondsPerChunk();
        Instant origin = at(FIXTURE_DAY_SECONDS);
        // Four partitions: two events before the cutoff, three in the next partition, and two recent events.
        List<Sample> input = List.of(sample(origin, 1), sample(origin.plusSeconds(partition - 1), 2),
                sample(origin.plusSeconds(partition), 3), sample(origin.plusSeconds(partition + 1), 4),
                sample(origin.plusSeconds(2 * partition - 1), 5), sample(origin.plusSeconds(2 * partition), 6),
                sample(origin.plusSeconds(3 * partition), 7));
        writeSamples(pv, source, input);
        List<PhysicalSample> original = expectedPhysical(input);
        Assertions.assertEquals(original, physicalSamples(pv, source), "writer baseline");
        Path[] files = pvFiles(pv, source);
        Assertions.assertEquals(4, files.length);
        Instant start = origin.plusSeconds(3 * partition + 60 + offset);
        TestClock clock = new TestClock(start);
        ETLPassDriver driver = driver(hop, clock, pv, source, destination);
        ETLPassTicker ticker = new ETLPassTicker(clock);
        ticker.addDriver(driver);
        driver.start();
        ETLPassRecord startup = tickOne(ticker, clock, start);
        int moved = offset < 0 ? 0 : 2;
        Assertions.assertEquals(start, startup.plannedAt(), "startup is armed at service start");
        Assertions.assertEquals(original.subList(0, moved), physicalSamples(pv, destination));
        Assertions.assertEquals(original.subList(moved, input.size()), physicalSamples(pv, source));
        assertSourceFiles(pv, source, files, offset < 0 ? 0 : 1);

        // The first scheduled pass follows the same boundary but includes the transition's grid offset.
        long gridOffset = hop.transition() == 0 ? 300 : 600;
        Instant scheduled = origin.plusSeconds(3 * partition + gridOffset);
        if (partition == 300) {
            scheduled = origin.plusSeconds(4 * partition);
        }
        Assertions.assertEquals(scheduled, driver.getNextPlannedAt());
        clock.set(scheduled.minusSeconds(1));
        Assertions.assertTrue(ticker.tickAll(clock.instant()).isEmpty(), "no pass before its grid time");
        ETLPassRecord next = tickOne(ticker, clock, scheduled);
        Assertions.assertEquals(scheduled, next.plannedAt());
        Assertions.assertEquals(original.subList(0, 2), physicalSamples(pv, destination),
                "scheduled pass preserves multiplicities, including already moved events");
        Assertions.assertEquals(original.subList(2, input.size()), physicalSamples(pv, source));
        assertSourceFiles(pv, source, files, 1);
    }

    @ParameterizedTest
    @MethodSource("chains")
    public void bothTransitionsPreserveIntermediateFilesAndRetainRecentSamples(Hop firstHop, Hop secondHop)
            throws Exception {
        String pv = "ArchUnitTest:ETLPassDriver:chain:" + firstHop.name();
        String sts = url("STS", "sts", firstHop.source().name()) + HOLD_AND_GATHER;
        String mts = url("MTS", "mts", secondHop.source().name()) + HOLD_AND_GATHER;
        String lts = url("LTS", "lts", secondHop.destination().name());
        long firstPartition = firstHop.source().getApproxSecondsPerChunk();
        long secondPartition = secondHop.source().getApproxSecondsPerChunk();
        Instant origin = at(FIXTURE_DAY_SECONDS);
        List<Sample> input = List.of(sample(origin, 1), sample(origin.plusSeconds(firstPartition - 1), 2),
                sample(origin.plusSeconds(2 * secondPartition), 3), sample(origin.plusSeconds(3 * secondPartition), 4));
        writeSamples(pv, sts, input);
        List<PhysicalSample> original = expectedPhysical(input);
        Assertions.assertEquals(original, physicalSamples(pv, sts));
        Path[] stsFiles = pvFiles(pv, sts);
        Assertions.assertEquals(3, stsFiles.length);
        Instant firstStart = origin.plusSeconds(3 * firstPartition + 60);
        TestClock clock = new TestClock(firstStart);
        ETLPassDriver first = driver(firstHop, clock, pv, sts, mts);
        ETLPassDriver second = driver(secondHop, clock, pv, mts, lts);
        ETLPassTicker ticker = new ETLPassTicker(clock);
        ticker.addDriver(first);
        first.start();
        tickOne(ticker, clock, firstStart);
        Assertions.assertEquals(original.subList(0, 2), physicalSamples(pv, mts), "first intermediate transfer");
        Assertions.assertEquals(original.subList(2, 4), physicalSamples(pv, sts));
        assertSourceFiles(pv, sts, stsFiles, 1);
        Assertions.assertTrue(physicalSamples(pv, lts).isEmpty());

        Instant secondStart = origin.plusSeconds(3 * secondPartition + 60);
        tickOne(ticker, clock, secondStart);
        Assertions.assertEquals(original.subList(0, 3), physicalSamples(pv, mts), "complete intermediate baseline");
        Assertions.assertEquals(original.subList(3, 4), physicalSamples(pv, sts));
        assertSourceFiles(pv, sts, stsFiles, 2);
        Path[] mtsFiles = pvFiles(pv, mts);
        Assertions.assertEquals(2, mtsFiles.length);
        // Local verification inspects MTS before enabling the next real transition at the same clock time.
        ticker.addDriver(second);
        second.start();
        tickOne(ticker, clock, secondStart);
        Assertions.assertEquals(original.subList(0, 2), physicalSamples(pv, lts));
        Assertions.assertEquals(original.subList(2, 3), physicalSamples(pv, mts));
        Assertions.assertEquals(original.subList(3, 4), physicalSamples(pv, sts));
        assertSourceFiles(pv, mts, mtsFiles, 1);
    }

    private static Sample decodedSample(Event event) {
        AlarmInfo alarm = (AlarmInfo) event;
        return new Sample(event.getEventTimeStamp(), event.getSampleValue().getValue().doubleValue(),
                alarm.getStatus(), alarm.getSeverity());
    }

    @ParameterizedTest(name = "{0}, lastSample_{1}")
    @MethodSource("reductionPolicies")
    public void lastSamplePoliciesPreserveIndependentBoundaryExpectations(Hop hop, int interval) throws Exception {
        String pv = "ArchUnitTest:ETLPassDriver:reduction:" + hop.name() + ":" + interval;
        String source = url("MTS", "mts", hop.source().name()) + HOLD_AND_GATHER;
        String destination = url("LTS", "lts", hop.destination().name()) + "&reducedata=lastSample_" + interval;
        Instant origin = at(FIXTURE_DAY_SECONDS);
        List<Sample> input = List.of(sample(origin.plusSeconds(1), 1),
                sample(origin.plusSeconds(interval).minusNanos(1), 2), sample(origin.plusSeconds(interval), 3),
                sample(origin.plusSeconds(interval).plusNanos(1), 4),
                sample(origin.plusSeconds(2L * interval).minusNanos(1), 5),
                sample(origin.plusSeconds(2L * interval), 6), sample(origin.plusSeconds(2L * interval).plusNanos(1), 7),
                sample(origin.plusSeconds(4L * interval), 8));
        // Last events in bins 0, 1, 2 and 4; bin 3 is empty and must not be filled.
        List<Sample> expected = List.of(input.get(1), input.get(4), input.get(6), input.get(7));
        writeSamples(pv, source, input);
        Assertions.assertEquals(expectedPhysical(input), physicalSamples(pv, source));
        Path[] sourceFiles = pvFiles(pv, source);
        Assertions.assertEquals(1, sourceFiles.length);
        Instant start = origin.plusSeconds(3L * hop.source().getApproxSecondsPerChunk() + 60);
        TestClock clock = new TestClock(start);
        ETLPassDriver driver = driver(hop, clock, pv, source, destination);
        ETLPassTicker ticker = new ETLPassTicker(clock);
        ticker.addDriver(driver);
        driver.start();
        tickOne(ticker, clock, start);
        assertSourceFiles(pv, source, sourceFiles, 1);
        List<Sample> actual = new ArrayList<>();
        for (Path path : pvFiles(pv, destination)) {
            try (var stream = new FileBackedPBEventStream(pv, path, ArchDBRTypes.DBR_SCALAR_DOUBLE)) {
                for (Event event : stream) {
                    actual.add(decodedSample(event));
                }
            }
        }
        Assertions.assertEquals(expected, actual, "physical reduced timestamps, values, status and severity");
        PlainPBStoragePlugin store =
                (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(destination, configService);
        List<Sample> retrieved = new ArrayList<>();
        try (BasicContext context = new BasicContext(); EventStream stream = new CurrentThreadWorkerEventStream(pv,
                store.getDataForPV(context, pv, origin, origin.plusSeconds(5L * interval)))) {
            for (Event event : stream) {
                retrieved.add(decodedSample(event));
            }
        }
        Assertions.assertEquals(expected, retrieved, "storage retrieval matches the independent expectation");
        tickOne(ticker, clock, driver.getNextPlannedAt());
        Assertions.assertEquals(expectedPhysical(expected), physicalSamples(pv, destination),
                "a scheduled pass with no source input adds no duplicate reduced events");
    }

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
