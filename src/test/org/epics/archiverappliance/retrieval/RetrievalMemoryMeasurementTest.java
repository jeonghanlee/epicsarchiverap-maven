package org.epics.archiverappliance.retrieval;

import com.sun.management.ThreadMXBean;
import edu.stanford.slac.archiverappliance.PB.data.PBCommonSetup;
import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.EventStream;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.retrieval.mimeresponses.JSONResponse;
import org.epics.archiverappliance.retrieval.postprocessors.AfterAllStreams;
import org.epics.archiverappliance.retrieval.postprocessors.DefaultRawPostProcessor;
import org.epics.archiverappliance.retrieval.postprocessors.PostProcessor;
import org.epics.archiverappliance.retrieval.postprocessors.PostProcessorWithConsolidatedEventStream;
import org.epics.archiverappliance.retrieval.postprocessors.PostProcessors;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryPoolMXBean;
import java.lang.management.MemoryType;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

/**
 * Measures the memory one retrieval request allocates and holds, per post processor, on the path the retrieval
 * servlet takes: the post processor is found by name, initialized and asked for its estimate; the plain PB store
 * returns the callables wrapped by the post processor; each callable runs on the calling thread, as
 * CurrentThreadExecutorService runs it; the answer is written as JSON through MergeDedupConsumer to a discarding
 * stream, with the consolidated stream and the final data written last as the servlet writes them.
 *
 * The data is one PV of 1 Hz scalar doubles written once by GenerateData into the plain PB test store. Each case
 * records the bytes the request thread allocated, the heap held after a full collection while the request is still
 * referenced, the events written, the duration, and the OutOfMemoryError when one is thrown. With the system property
 * retrieval.measure.histogram set to true, a class histogram of the test JVM is taken at the point of largest
 * retention of the consolidating cases. Results are printed and appended to target/retrieval-memory-measurement.tsv
 * after each case, so a case that exhausts the heap and takes other threads of the test JVM down does not lose the
 * cases before it; the system property retrieval.measure.case selects one case by its position, so that each case can
 * run in a JVM of its own.
 *
 * Tagged slow because it fills the heap; run it alone with its own heap, for example
 * ./mvnw -o -B -ntp test -Dtest=RetrievalMemoryMeasurementTest -Dtest.excludedGroups= -DargLine=-Xmx256m
 */
@Tag("slow")
public class RetrievalMemoryMeasurementTest {
    private static final Logger logger = LogManager.getLogger(RetrievalMemoryMeasurementTest.class.getName());

    private static final String PV_NAME = "RetrievalMemoryMeasurement:Sine";
    private static final int DATA_FIRST_DAY = 50;
    private static final int DATA_DAYS = Integer.getInteger("retrieval.measure.dataDays", 30);
    private static final int WIDE_RANGE_DAYS = 80;
    private static final long SECONDS_PER_DAY = 86400L;
    private static final boolean TAKE_HISTOGRAM = Boolean.getBoolean("retrieval.measure.histogram");
    private static final int HISTOGRAM_LINES = 8;
    private static final Path RESULT_FILE = Path.of("target", "retrieval-memory-measurement.tsv");
    private static final int ONLY_CASE = Integer.getInteger("retrieval.measure.case", -1);

    private record MeasureCase(String operator, int rangeDays) {}

    private record MeasureResult(
            MeasureCase measureCase,
            long eventsWritten,
            long allocatedBytes,
            long heldAfterStreamsBytes,
            long heldAfterAnswerBytes,
            long millis,
            String outcome,
            List<String> histogram) {}

    private static final List<MeasureCase> CASES = List.of(
            new MeasureCase(null, DATA_DAYS),
            new MeasureCase("mean_60", DATA_DAYS),
            new MeasureCase("mean_3", DATA_DAYS),
            new MeasureCase("optimized_100000", WIDE_RANGE_DAYS),
            new MeasureCase("optimized_1000000", WIDE_RANGE_DAYS),
            new MeasureCase("optimized_2000000", WIDE_RANGE_DAYS),
            new MeasureCase("optimized_2000000", DATA_DAYS),
            new MeasureCase("optimLastSample_100000", WIDE_RANGE_DAYS),
            new MeasureCase("optimLastSample_1000000", WIDE_RANGE_DAYS),
            new MeasureCase("optimLastSample_2000000", WIDE_RANGE_DAYS));

    @Test
    public void measureRetrievalMemoryPerPostProcessor() throws Exception {
        Instant dataStart = TimeUtils.convertFromEpochSeconds(
                TimeUtils.getStartOfCurrentYearInSeconds() + DATA_FIRST_DAY * SECONDS_PER_DAY, 0);
        Instant dataEnd = TimeUtils.convertFromEpochSeconds(
                TimeUtils.convertToEpochSeconds(dataStart) + DATA_DAYS * SECONDS_PER_DAY - 1, 0);
        long generated = GenerateData.generateSineForPV(PV_NAME, 0, ArchDBRTypes.DBR_SCALAR_DOUBLE, dataStart, dataEnd);
        logger.info("Generated {} events for {} from {} to {}", generated, PV_NAME, dataStart, dataEnd);

        PlainPBStoragePlugin storagePlugin = new PlainPBStoragePlugin();
        new PBCommonSetup().setUpRootFolder(storagePlugin);

        Files.createDirectories(RESULT_FILE.getParent());
        for (int index = 0; index < CASES.size(); index++) {
            if (ONLY_CASE >= 0 && ONLY_CASE != index) {
                continue;
            }
            MeasureCase measureCase = CASES.get(index);
            Instant end = dataEnd;
            Instant start = TimeUtils.convertFromEpochSeconds(
                    TimeUtils.convertToEpochSeconds(end) - measureCase.rangeDays() * SECONDS_PER_DAY + 1, 0);
            MeasureResult result = measureOneRequest(storagePlugin, measureCase, start, end);
            record(index, result);
            collectFully();
        }
    }

    /**
     * Records how the usage after collection of the old-generation pool behaves in this JVM: the heap occupancy at
     * which it is first updated while live data grows, the stale value it keeps after the data is released and nothing
     * is allocated, and the time of an explicit collection with and without the live data.
     */
    @Test
    public void measureCollectionBehaviour() throws Exception {
        MemoryPoolMXBean oldPool = null;
        for (MemoryPoolMXBean pool : ManagementFactory.getMemoryPoolMXBeans()) {
            if (pool.getType() == MemoryType.HEAP
                    && pool.isCollectionUsageThresholdSupported()
                    && (oldPool == null
                            || pool.getUsage().getMax() > oldPool.getUsage().getMax())) {
                oldPool = pool;
            }
        }
        long maxHeap = Runtime.getRuntime().maxMemory();
        long limit = (long) (maxHeap * 0.55);
        List<byte[]> live = new ArrayList<>();
        long retained = 0;
        long firstUpdateOldUsed = -1;
        int chunk = 100 * 1024;
        collectFully();
        long baseline = oldPool.getCollectionUsage().getUsed();
        while (retained < limit) {
            live.add(new byte[chunk]);
            retained += chunk;
            for (int i = 0; i < 3; i++) {
                byte[] garbage = new byte[chunk];
                garbage[0] = 1;
            }
            if (firstUpdateOldUsed < 0 && oldPool.getCollectionUsage().getUsed() > baseline + (4L << 20)) {
                firstUpdateOldUsed = oldPool.getUsage().getUsed();
            }
        }
        long retainedAtEnd = retained;
        long start = System.nanoTime();
        System.gc();
        long pauseWithLiveMs = (System.nanoTime() - start) / 1_000_000;
        live.clear();
        live = null;
        long staleAfterRelease = oldPool.getCollectionUsage().getUsed();
        start = System.nanoTime();
        System.gc();
        long pauseAfterReleaseMs = (System.nanoTime() - start) / 1_000_000;
        long afterGc = oldPool.getCollectionUsage().getUsed();
        List<String> lines = List.of(String.join(
                "\t",
                "JVM",
                oldPool.getName(),
                "maxHeapMB=" + (maxHeap >> 20),
                "retainedMB=" + (retainedAtEnd >> 20),
                "firstUpdateOldUsedMB=" + (firstUpdateOldUsed < 0 ? "-" : Long.toString(firstUpdateOldUsed >> 20)),
                "firstUpdatePercentOfMax="
                        + (firstUpdateOldUsed < 0 ? "-" : Long.toString(firstUpdateOldUsed * 100 / maxHeap)),
                "staleCollectionUsedAfterReleaseMB=" + (staleAfterRelease >> 20),
                "pauseWithLiveMs=" + pauseWithLiveMs,
                "pauseAfterReleaseMs=" + pauseAfterReleaseMs,
                "collectionUsedAfterGcMB=" + (afterGc >> 20)));
        Files.createDirectories(RESULT_FILE.getParent());
        Files.write(
                RESULT_FILE,
                lines,
                StandardCharsets.UTF_8,
                java.nio.file.StandardOpenOption.CREATE,
                java.nio.file.StandardOpenOption.APPEND);
        for (String line : lines) {
            System.out.println("MEASURE " + line);
        }
    }

    private MeasureResult measureOneRequest(
            PlainPBStoragePlugin storagePlugin, MeasureCase measureCase, Instant start, Instant end) {
        ThreadMXBean threadBean = (ThreadMXBean) ManagementFactory.getThreadMXBean();
        collectFully();
        long baselineHeld = heapUsed();
        long allocatedBefore = threadBean.getCurrentThreadAllocatedBytes();
        long startNanos = System.nanoTime();
        long heldAfterStreams = -1;
        long heldAfterAnswer = -1;
        long eventsWritten = -1;
        String outcome = "answered";
        List<String> histogram = List.of();
        PostProcessor postProcessor = null;
        MergeDedupConsumer consumer = null;
        try {
            postProcessor = measureCase.operator() == null
                    ? new DefaultRawPostProcessor()
                    : PostProcessors.findPostProcessor(measureCase.operator());
            postProcessor.initialize(measureCase.operator(), PV_NAME);
            PVTypeInfo typeInfo = new PVTypeInfo(PV_NAME, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
            postProcessor.estimateMemoryConsumption(PV_NAME, typeInfo, start, end, null);
            consumer = new MergeDedupConsumer(new JSONResponse(), OutputStream.nullOutputStream());
            try (BasicContext context = new BasicContext()) {
                boolean processingStarted = false;
                for (Callable<EventStream> callable :
                        storagePlugin.getDataForPV(context, PV_NAME, start, end, postProcessor)) {
                    try (EventStream eventStream = callable.call()) {
                        if (!processingStarted) {
                            consumer.processingPV(context, PV_NAME, start, end, eventStream.getDescription());
                            processingStarted = true;
                        }
                        if (!(postProcessor instanceof PostProcessorWithConsolidatedEventStream)) {
                            consumer.consumeEventStream(eventStream);
                        }
                    }
                }
                heldAfterStreams = collectFully() - baselineHeld;
                if (postProcessor instanceof PostProcessorWithConsolidatedEventStream consolidating) {
                    if (TAKE_HISTOGRAM) {
                        histogram = classHistogram();
                    }
                    try (EventStream consolidated = consolidating.getConsolidatedEventStream()) {
                        consumer.consumeEventStream(consolidated);
                    }
                }
                if (postProcessor instanceof AfterAllStreams afterAllStreams) {
                    EventStream finalData = afterAllStreams.anyFinalData();
                    if (finalData != null) {
                        consumer.consumeEventStream(finalData);
                    }
                }
                heldAfterAnswer = collectFully() - baselineHeld;
            }
            consumer.close();
            eventsWritten = consumer.totalEventsForAllPVs;
        } catch (OutOfMemoryError oom) {
            postProcessor = null;
            consumer = null;
            outcome = "OutOfMemoryError: " + oom.getMessage();
        } catch (Exception ex) {
            outcome = ex.getClass().getSimpleName() + ": " + ex.getMessage();
            logger.error("Measurement of {} failed", measureCase, ex);
        }
        long allocated = threadBean.getCurrentThreadAllocatedBytes() - allocatedBefore;
        long millis = (System.nanoTime() - startNanos) / 1_000_000;
        return new MeasureResult(
                measureCase, eventsWritten, allocated, heldAfterStreams, heldAfterAnswer, millis, outcome, histogram);
    }

    private static long collectFully() {
        System.gc();
        System.gc();
        return heapUsed();
    }

    private static long heapUsed() {
        MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
        return memoryBean.getHeapMemoryUsage().getUsed();
    }

    private static List<String> classHistogram() {
        List<String> lines = new ArrayList<>();
        String pid = Long.toString(ProcessHandle.current().pid());
        try {
            Process jcmd = new ProcessBuilder("jcmd", pid, "GC.class_histogram")
                    .redirectErrorStream(true)
                    .start();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(jcmd.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.trim().matches("^\\d+:.*") && lines.size() < HISTOGRAM_LINES) {
                        lines.add(line.trim());
                    }
                }
            }
            jcmd.waitFor();
        } catch (IOException | InterruptedException ex) {
            lines.add("histogram not taken: " + ex.getMessage());
        }
        return lines;
    }

    private static void record(int index, MeasureResult result) throws IOException {
        long maxHeap = Runtime.getRuntime().maxMemory();
        List<String> lines = new ArrayList<>();
        lines.add(String.join(
                "\t",
                Long.toString(maxHeap >> 20),
                Integer.toString(index),
                result.measureCase().operator() == null ? "raw" : result.measureCase().operator(),
                Integer.toString(result.measureCase().rangeDays()),
                Long.toString(result.eventsWritten()),
                Long.toString(result.allocatedBytes() >> 20),
                result.heldAfterStreamsBytes() < 0 ? "-" : Long.toString(result.heldAfterStreamsBytes() >> 20),
                result.heldAfterAnswerBytes() < 0 ? "-" : Long.toString(result.heldAfterAnswerBytes() >> 20),
                Long.toString(result.millis()),
                result.outcome()));
        for (String histogramLine : result.histogram()) {
            lines.add("#   " + histogramLine);
        }
        Files.write(
                RESULT_FILE,
                lines,
                StandardCharsets.UTF_8,
                java.nio.file.StandardOpenOption.CREATE,
                java.nio.file.StandardOpenOption.APPEND);
        for (String line : lines) {
            System.out.println("MEASURE " + line);
        }
    }
}
