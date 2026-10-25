package org.epics.archiverappliance.retrieval;

import edu.stanford.slac.archiverappliance.PB.data.PBCommonSetup;
import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;
import org.epics.archiverappliance.EventStream;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.retrieval.mimeresponses.JSONResponse;
import org.epics.archiverappliance.retrieval.postprocessors.PostProcessorWithConsolidatedEventStream;
import org.epics.archiverappliance.retrieval.postprocessors.PostProcessors;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.OutputStream;
import java.lang.ref.Reference;
import java.lang.management.ManagementFactory;
import com.sun.management.ThreadMXBean;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Callable;

import static org.junit.jupiter.api.Assertions.*;

/** Runs alone with equal bounded Xms/Xmx; the store and post processors are the shipped retrieval path. */
@Tag("slow")
class RetrievalMemoryProtectionMeasurementTest {
    private static final long MAX_HEAP = Runtime.getRuntime().maxMemory();
    private static final Path RESULTS = Path.of("target", "retrieval-protection-measurement.tsv");
    private static final String PV = "RetrievalMemoryMeasurement:Sine";
    private static volatile byte[] retained;

    @Test void freshOldUsageTriggersPressureCollection() {
        var guard = guardForFreshUsage();
        try (var request = guard.begin()) {
            retained = new byte[(int) (MAX_HEAP * .04)];
            assertStaleCollectionUsage(guard);
            var rejected = assertThrows(RetrievalMemoryProtection.Rejected.class, request::check);
            assertEquals(503, rejected.httpStatus());
            assertTrue(rejected.getMessage().contains("memory pressure"));
            assertTrue(rejected.collectionUsed() > guard.pressureThresholdBytes());
            assertEquals(1, guard.collectionRequests());
        } finally {
            retained = null;
            System.gc();
        }
    }

    @Test void freshOldUsageTriggersAdmissionCollection() {
        var guard = guardForFreshUsage();
        try {
            retained = new byte[(int) (MAX_HEAP * .04)];
            assertStaleCollectionUsage(guard);
            var rejected = assertThrows(RetrievalMemoryProtection.Rejected.class, () -> {
                try (var request = guard.begin()) { }
            });
            assertEquals(503, rejected.httpStatus());
            assertTrue(rejected.getMessage().contains("admission"));
            assertEquals(1, guard.collectionRequests());
        } finally {
            retained = null;
            System.gc();
        }
    }

    @Test void freshOldUsageDoesNotRejectGarbageAndRespectsCollectionInterval() {
        var guard = guardForFreshUsage();
        try (var request = guard.begin()) {
            retained = new byte[(int) (MAX_HEAP * .04)];
            assertStaleCollectionUsage(guard);
            retained = null;
            assertDoesNotThrow(request::check);
            assertEquals(1, guard.collectionRequests());
            assertTrue(guard.collectionUsedBytes() < guard.pressureThresholdBytes());

            retained = new byte[(int) (MAX_HEAP * .04)];
            assertStaleCollectionUsage(guard);
            assertDoesNotThrow(request::check);
            assertEquals(1, guard.collectionRequests(), "Current usage must not bypass the shared GC interval");
        } finally {
            retained = null;
            System.gc();
        }
    }

    private static RetrievalMemoryProtection guardForFreshUsage() {
        new RetrievalMemoryProtection(RetrievalMemoryProtectionTest.settings(.85, .95, 1, 30_000));
        currentOldUsage();
        System.gc();
        double baseline = (double) currentOldUsage() / MAX_HEAP;
        assertTrue(baseline < .8, "The fixture needs room for a four-percent live allocation");
        return new RetrievalMemoryProtection(RetrievalMemoryProtectionTest.settings(
                baseline + .01, baseline + .02, 1, 30_000));
    }

    private static long currentOldUsage() {
        return ManagementFactory.getMemoryPoolMXBeans().stream()
                .filter(pool -> pool.getName().equals("G1 Old Gen"))
                .findFirst().orElseThrow().getUsage().getUsed();
    }

    private static void assertStaleCollectionUsage(RetrievalMemoryProtection guard) {
        assertTrue(guard.collectionUsedBytes() < guard.pressureThresholdBytes(),
                "The real collection counter must still be below the pressure threshold");
        assertTrue(currentOldUsage() > guard.pressureThresholdBytes(),
                "The real current old-generation usage must already exceed the pressure threshold");
    }

    @Test void admissionRecoversWithoutOtherAllocationAndLimitsCollectionRequests() throws Exception {
        System.gc();
        var guard = new RetrievalMemoryProtection(RetrievalMemoryProtectionTest.settings(.35, .8, 1024, 100));
        List<byte[]> live = holdFraction(.45);
        System.gc();
        assertTrue(guard.collectionUsedBytes() > MAX_HEAP * .35);
        assertThrows(RetrievalMemoryProtection.Rejected.class, guard::begin);
        long requests = guard.collectionRequests();
        assertThrows(RetrievalMemoryProtection.Rejected.class, guard::begin);
        assertEquals(requests, guard.collectionRequests());
        live.clear();
        long release = System.nanoTime();
        while (System.nanoTime() - release < Duration.ofMillis(150).toNanos()) Thread.onSpinWait();
        try (var request = guard.begin()) { assertDoesNotThrow(request::check); }
        assertEquals(requests + 1, guard.collectionRequests());
        record("admission-recovery\tcollections=" + guard.collectionRequests()
                + "\tcollectionUsed=" + guard.collectionUsedBytes());
    }

    @Test void pressureStopsAboveFloorAndAllowsBelowFloor() throws Exception {
        System.gc();
        var guard = new RetrievalMemoryProtection(RetrievalMemoryProtectionTest.settings(.35, .5, 1024, 100));
        List<byte[]> live;
        try (var request = guard.begin()) {
            live = CompletableFuture.supplyAsync(() -> holdFraction(.55)).get();
            System.gc();
            assertTrue(guard.collectionUsedBytes() > guard.pressureThresholdBytes());
            assertTrue(request.allocatedSinceStart() < MAX_HEAP * .01);
            assertDoesNotThrow(request::check);
            retained = new byte[(int) (MAX_HEAP * .02)];
            var rejected = assertThrows(RetrievalMemoryProtection.Rejected.class, request::check);
            assertEquals(503, rejected.httpStatus());
            assertTrue(rejected.getMessage().contains("memory pressure"));
            Reference.reachabilityFence(live);
        } finally { retained = null; }
        live.clear();
        System.gc();
        record("pressure-floor\tpassed");
    }

    @Test void realStoreStopsAccumulationAndPreservesStreaming() throws Exception {
        Instant start = TimeUtils.convertFromEpochSeconds(
                TimeUtils.getStartOfCurrentYearInSeconds() + 50L * 86400, 0);
        Instant end = start.plusSeconds(30L * 86400 - 1);
        GenerateData.generateSineForPV(PV, 0, ArchDBRTypes.DBR_SCALAR_DOUBLE, start, end);
        var storage = new PlainPBStoragePlugin();
        new PBCommonSetup().setUpRootFolder(storage);
        int selectedCase = Integer.getInteger("retrieval.protection.measure.case", -1);
        int caseNumber = 0;
        for (double threshold : new double[] {.45, .55, .65}) {
            for (int interval : new int[] {1024, 8192}) {
                for (long collectionMillis : new long[] {100, 500}) {
                    int thisCase = caseNumber++;
                    if (selectedCase >= 0 && selectedCase != thisCase) continue;
                    System.gc();
                    System.out.println("START measurement case=" + thisCase + " threshold=" + threshold
                            + " events=" + interval + " collectionMillis=" + collectionMillis);
                    var guard = new RetrievalMemoryProtection(
                            RetrievalMemoryProtectionTest.settings(.35, threshold, interval, collectionMillis));
                    var stopped = assertThrows(RetrievalMemoryProtection.Rejected.class,
                            () -> runStore(storage, guard, "mean_2", start, end));
                    assertTrue(stopped.getMessage().contains("memory pressure"), stopped.getMessage());
                    long heapUsed = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage().getUsed();
                    long overshoot = heapUsed - guard.pressureThresholdBytes();
                    assertTrue(overshoot >= 0);
                    assertTrue(overshoot < MAX_HEAP - guard.pressureThresholdBytes());
                    record("mean_2\tmaxHeap=" + MAX_HEAP + "\tthreshold=" + threshold + "\tevents=" + interval
                            + "\tcollectionMillis=" + collectionMillis + "\tused=" + stopped.collectionUsed()
                            + "\theapUsed=" + heapUsed + "\tovershoot=" + overshoot
                            + "\theadroom=" + (MAX_HEAP - heapUsed));
                }
            }
        }
        System.gc();
        var guard = new RetrievalMemoryProtection(RetrievalMemoryProtectionTest.settings(.35, .65, 1024, 100));
        long allocated = runStore(storage, guard, "raw", start, end);
        assertTrue(allocated > MAX_HEAP, "Streaming must allocate more than the bounded heap");
        record("raw\tallocated=" + allocated + "\tmaxHeap=" + MAX_HEAP + "\tcompleted");
    }

    private long runStore(PlainPBStoragePlugin storage, RetrievalMemoryProtection guard, String name,
                          Instant start, Instant end) throws Exception {
        var processor = name.equals("raw")
                ? new org.epics.archiverappliance.retrieval.postprocessors.DefaultRawPostProcessor()
                : PostProcessors.findPostProcessor(name);
        processor.initialize(name, PV);
        var info = new PVTypeInfo(PV, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        try (var request = guard.begin(); BasicContext context = new BasicContext();
                var consumer = new MergeDedupConsumer(new JSONResponse(), OutputStream.nullOutputStream())) {
            request.admit(processor, start, end, processor.estimateMemoryConsumption(PV, info, start, end, null));
            boolean started = false;
            for (Callable<EventStream> callable : storage.getDataForPV(context, PV, start, end, processor)) {
                try (EventStream stream = callable.call()) {
                    if (!started) {
                        consumer.processingPV(context, PV, start, end, stream.getDescription());
                        started = true;
                    }
                    if (!(processor instanceof PostProcessorWithConsolidatedEventStream)) {
                        consumer.consumeEventStream(stream);
                    }
                }
            }
            if (processor instanceof PostProcessorWithConsolidatedEventStream consolidating) {
                try (EventStream stream = consolidating.getConsolidatedEventStream()) {
                    consumer.consumeEventStream(stream);
                }
            }
            assertTrue(consumer.totalEvents > 2_500_000, "The real 30-day streaming fixture must be consumed");
            return request.allocatedSinceStart();
        }
    }

    @Test void unavailableCounterUsesEstimateToStopUnderRealPressure() throws Exception {
        System.gc();
        ThreadMXBean bean = (ThreadMXBean) ManagementFactory.getThreadMXBean();
        boolean enabled = bean.isThreadAllocatedMemoryEnabled();
        bean.setThreadAllocatedMemoryEnabled(false);
        List<byte[]> live = null;
        try {
            var guard = new RetrievalMemoryProtection(RetrievalMemoryProtectionTest.settings(.35, .5, 1024, 100));
            try (var request = guard.begin()) {
                live = CompletableFuture.supplyAsync(() -> holdFraction(.55)).get();
                System.gc();
                assertTrue(guard.collectionUsedBytes() > guard.pressureThresholdBytes());
                assertDoesNotThrow(request::check);
                request.admit(new org.epics.archiverappliance.retrieval.postprocessors.DefaultRawPostProcessor(),
                        Instant.EPOCH, Instant.EPOCH.plusSeconds(86400), (long) (MAX_HEAP * .02));
                var rejected = assertThrows(RetrievalMemoryProtection.Rejected.class, request::check);
                assertTrue(rejected.getMessage().contains("memory pressure"));
                Reference.reachabilityFence(live);
            }
        } finally {
            bean.setThreadAllocatedMemoryEnabled(enabled);
            if (live != null) live.clear();
            System.gc();
        }
        record("unavailable-counter-pressure\tpassed");
    }

    private static List<byte[]> holdFraction(double fraction) {
        var live = new ArrayList<byte[]>();
        long total = (long) (MAX_HEAP * fraction);
        for (long n = 0; n < total; n += 65536) live.add(new byte[65536]);
        return live;
    }

    private static void record(String line) throws Exception {
        Files.writeString(RESULTS, line + System.lineSeparator(), StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        System.out.println("MEASURE " + line);
    }
}
