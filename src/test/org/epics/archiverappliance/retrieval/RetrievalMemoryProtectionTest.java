package org.epics.archiverappliance.retrieval;

import com.sun.management.ThreadMXBean;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.retrieval.postprocessors.OptimizedWithLastSample;
import org.epics.archiverappliance.retrieval.postprocessors.PostProcessor;
import org.epics.archiverappliance.retrieval.postprocessors.PostProcessors;
import org.junit.jupiter.api.Test;

import java.lang.management.ManagementFactory;
import java.time.Duration;
import java.time.Instant;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import java.io.ByteArrayOutputStream;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.utils.simulation.SimulationEventStream;
import org.epics.archiverappliance.utils.simulation.SineGenerator;
import org.epics.archiverappliance.retrieval.mimeresponses.PBRAWResponse;
import org.epics.archiverappliance.retrieval.mimeresponses.JSONResponse;

import static org.junit.jupiter.api.Assertions.*;

class RetrievalMemoryProtectionTest {
    private static volatile byte[] retained;
    private static final Instant START = Instant.parse("2026-01-01T00:00:00Z");
    private static final Instant END = START.plusSeconds(80L * 86400);

    static RetrievalMemoryProtection.Settings settings(double admission, double pressure, int events, long interval) {
        return new RetrievalMemoryProtection.Settings(.95, admission, pressure, .01, events,
                Duration.ofMillis(interval), 112, 256, 176);
    }

    @Test void selectsOldGenerationAndCountsOnlyRequestAllocation() {
        var guard = new RetrievalMemoryProtection(settings(.85, .95, 4, 100));
        assertEquals("G1 Old Gen", guard.poolName());
        retained = new byte[8 * 1024 * 1024];
        try (var request = guard.begin()) {
            long before = request.allocatedSinceStart();
            assertTrue(before < 1024 * 1024, "Allocation before begin must not enter the request counter");
            retained = new byte[4 * 1024 * 1024];
            long after = request.allocatedSinceStart();
            assertTrue(after - before >= 4 * 1024 * 1024);
            assertTrue(after - before < 5 * 1024 * 1024);
        } finally { retained = null; }
    }

    @Test void interruptStopsWithoutMemoryPressureOrAllocation() {
        var guard = new RetrievalMemoryProtection(settings(.85, .95, 4, 100));
        try (var request = guard.begin()) {
            Thread.currentThread().interrupt();
            for (int i = 0; i < 3; i++) request.event();
            var rejected = assertThrows(RetrievalMemoryProtection.Rejected.class, request::event);
            assertTrue(rejected.getMessage().contains("interrupted"));
            assertTrue(Thread.currentThread().isInterrupted());
            assertTrue(RetrievalMemoryProtection.currentFailed());
        } finally { Thread.interrupted(); }
        assertFalse(RetrievalMemoryProtection.currentFailed());
        try (var request = guard.begin()) { assertDoesNotThrow(request::check); }
    }

    @Test void runningWorkerObservesCancellationAndCanBeReused() throws Exception {
        var guard = new RetrievalMemoryProtection(settings(.85, .95, 4, 100));
        var cancelled = new java.util.concurrent.atomic.AtomicBoolean();
        var ready = new java.util.concurrent.CountDownLatch(1);
        var proceed = new java.util.concurrent.CountDownLatch(1);
        try (var executor = java.util.concurrent.Executors.newSingleThreadExecutor()) {
            var work = java.util.concurrent.CompletableFuture.supplyAsync(() -> {
                try (var request = guard.begin(cancelled::get)) {
                    ready.countDown();
                    assertTrue(proceed.await(5, TimeUnit.SECONDS));
                    assertFalse(Thread.currentThread().isInterrupted());
                    for (int i = 0; i < 3; i++) request.event();
                    var failure = assertThrows(RetrievalMemoryProtection.Rejected.class, request::event);
                    assertEquals(503, failure.httpStatus());
                    assertTrue(failure.getMessage().contains("interrupted"));
                    assertFalse(Thread.currentThread().isInterrupted(), "Caller cancellation must not poison the worker");
                    return Thread.currentThread();
                } catch (InterruptedException ex) {
                    throw new IllegalStateException(ex);
                }
            }, executor);
            Thread worker;
            try {
                assertTrue(ready.await(5, TimeUnit.SECONDS), "The real worker scope must be active before interruption");
                cancelled.set(true);
                proceed.countDown();
                worker = work.join();
            } finally {
                proceed.countDown();
            }
            assertSame(worker, java.util.concurrent.CompletableFuture.supplyAsync(() -> {
                try (var request = guard.begin()) {
                    request.check();
                    assertFalse(RetrievalMemoryProtection.currentFailed());
                    return Thread.currentThread();
                }
            }, executor).join());
        }
    }

    @Test void rejectsHugePointCountsBeforeAnyPostProcessorAllocation() throws Exception {
        var guard = new RetrievalMemoryProtection(settings(.85, .95, 4, 100));
        for (String operator : new String[] {"optimized_500000000", "optimized_2147483647",
                "optimLastSample_2147483647"}) {
            PostProcessor processor = PostProcessors.findPostProcessor(operator);
            processor.initialize(operator, "test");
            try (var request = guard.begin()) {
                var rejected = assertThrows(RetrievalMemoryProtection.Rejected.class,
                        () -> request.admit(processor, START, END, 0));
                assertEquals(400, rejected.httpStatus());
                assertTrue(rejected.getMessage().contains("budget"));
                assertTrue(request.allocatedSinceStart() < 1024 * 1024);
            }
        }
    }

    @Test void usesEstimateWhenTheRealJvmCounterIsUnavailable() {
        ThreadMXBean bean = (ThreadMXBean) ManagementFactory.getThreadMXBean();
        boolean enabled = bean.isThreadAllocatedMemoryEnabled();
        bean.setThreadAllocatedMemoryEnabled(false);
        try {
            var guard = new RetrievalMemoryProtection(settings(.85, .95, 4, 100));
            try (var request = guard.begin()) {
                request.admit(new org.epics.archiverappliance.retrieval.postprocessors.DefaultRawPostProcessor(),
                        START, END, 1234567);
                assertEquals(1234567, request.allocatedSinceStart());
            }
        } finally { bean.setThreadAllocatedMemoryEnabled(enabled); }
    }

    @Test void optimizedLastSampleIntervalDoesNotOverflow() throws Exception {
        for (int points : new int[] {2147484, 3000000}) {
            var processor = new OptimizedWithLastSample();
            processor.initialize("optimLastSample_" + points, "test");
            var info = new PVTypeInfo("test", ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
            processor.estimateMemoryConsumption("test", info, START, END, null);
            long interval = 80L * 86400 / points;
            assertEquals(START.getEpochSecond() / interval * interval, processor.getStartBinEpochSeconds());
            assertEquals(END.getEpochSecond() / interval * interval, processor.getEndBinEpochSeconds());
            try (var input = new SimulationEventStream(ArchDBRTypes.DBR_SCALAR_DOUBLE, new SineGenerator(0),
                    END.minusSeconds(20), END, 1)) {
                long inputEvents = 0;
                for (var event : input) inputEvents++;
                assertEquals(20, inputEvents, "The fixture emits one event per second before its exclusive end");
                try (var intermediate = processor.wrap(new CallableEventStream(input)).call()) {
                    assertNotNull(intermediate.getDescription());
                }
                try (var output = processor.getConsolidatedEventStream()) {
                    long events = 0;
                    for (var event : output) events++;
                    assertEquals(inputEvents, events, "Positive intervals must retain the real input events");
                }
            }
        }
    }

    @Test void rejectsInvalidSettings() {
        assertThrows(IllegalArgumentException.class, () -> settings(.8, .7, 1, 100));
        assertThrows(IllegalArgumentException.class, () -> settings(.5, .7, 0, 100));
        assertThrows(IllegalArgumentException.class, () -> settings(.5, .7, 1, 0));
    }

    @Test void standardJvmManagementInterfaceUsesTheEstimate() throws Exception {
        var bean = ManagementFactory.newPlatformMXBeanProxy(ManagementFactory.getPlatformMBeanServer(),
                ManagementFactory.THREAD_MXBEAN_NAME, java.lang.management.ThreadMXBean.class);
        assertFalse(bean instanceof ThreadMXBean);
        assertTrue(bean.getThreadCount() > 0, "The proxy must read the actual JVM management bean");
        var guard = new RetrievalMemoryProtection(settings(.85, .95, 4, 100), bean);
        try (var request = guard.begin()) {
            request.admit(new org.epics.archiverappliance.retrieval.postprocessors.DefaultRawPostProcessor(),
                    START, END, 2345678);
            assertEquals(2345678, request.allocatedSinceStart());
        }
    }

    @Test void guardedInputStopsBeforeThePostProcessorCanContinue() throws Exception {
        var guard = new RetrievalMemoryProtection(settings(.85, .95, 4, 100));
        var processor = PostProcessors.findPostProcessor("mean_1");
        processor.initialize("mean_1", "test");
        processor.estimateMemoryConsumption("test", new PVTypeInfo("test", ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1),
                START, START.plusSeconds(20), null);
        try (var request = guard.begin(); var source = simulation()) {
            var callable = CallableEventStream.makeOneStreamCallable(source, processor, true);
            Thread.currentThread().interrupt();
            assertThrows(RetrievalMemoryProtection.Rejected.class, callable::call);
        } finally { Thread.interrupted(); }
    }

    @Test void guardedStreamPreservesRawResponseInterface() throws Exception {
        var guard = new RetrievalMemoryProtection(settings(.85, .95, 4, 100));
        var output = new ByteArrayOutputStream();
        try (var request = guard.begin(); var context = new BasicContext(); var source = simulation();
                var consumer = new MergeDedupConsumer(new PBRAWResponse(), output)) {
            var stream = new CallableEventStream(source).call();
            consumer.processingPV(context, "test", START, START.plusSeconds(20), stream.getDescription());
            consumer.consumeEventStream(stream);
            assertTrue(consumer.totalEvents >= 20);
        }
        assertTrue(output.size() > 100);
    }

    @Test void httpOutputLoopStopsWithoutAnInputWrapper() throws Exception {
        var guard = new RetrievalMemoryProtection(settings(.85, .95, 4, 100));
        try (var request = guard.begin(); var context = new BasicContext(); var source = simulation();
                var consumer = new MergeDedupConsumer(new JSONResponse(), new ByteArrayOutputStream())) {
            consumer.processingPV(context, "test", START, START.plusSeconds(20), source.getDescription());
            Thread.currentThread().interrupt();
            assertThrows(RetrievalMemoryProtection.Rejected.class, () -> consumer.consumeEventStream(source));
            assertTrue(consumer.totalEvents < 4);
        } finally { Thread.interrupted(); }
    }

    private static SimulationEventStream simulation() {
        return new SimulationEventStream(ArchDBRTypes.DBR_SCALAR_DOUBLE, new SineGenerator(0),
                START, START.plusSeconds(20), 1);
    }

    @Test void warnsAtStartupWhenExplicitCollectionIsDisabled() throws Exception {
        Path output = Files.createTempFile(Path.of("target"), "retrieval-disable-gc-", ".log");
        Process child = new ProcessBuilder(Path.of(System.getProperty("java.home"), "bin", "java").toString(),
                "-Xmx128m", "-XX:+DisableExplicitGC",
                "-Dlog4j.configurationFile=" + Path.of("src/resources/test/log4j2.xml").toAbsolutePath(),
                "-cp", System.getProperty("java.class.path"),
                getClass().getName()).redirectErrorStream(true).redirectOutput(output.toFile()).start();
        try {
            assertTrue(child.waitFor(20, TimeUnit.SECONDS), "Disabled-GC probe timed out: " + output);
            assertEquals(0, child.exitValue(), Files.readString(output));
            String log = Files.readString(output);
            assertTrue(log.contains("WARN") && log.contains("DisableExplicitGC is enabled"), log);
        } finally {
            if (child.isAlive()) child.destroyForcibly().waitFor();
        }
    }

    public static void main(String[] args) {
        new RetrievalMemoryProtection(settings(.85, .95, 4, 100));
        org.apache.logging.log4j.LogManager.shutdown();
    }
}
