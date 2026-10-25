package org.epics.archiverappliance.retrieval;

import org.junit.jupiter.api.Test;
import org.epics.archiverappliance.retrieval.mimeresponses.JSONResponse;

import java.io.ByteArrayOutputStream;
import java.time.Duration;
import java.util.Properties;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class RetrievalDeadlineTest {
    private static RetrievalMemoryProtection guard() {
        return new RetrievalMemoryProtection(RetrievalMemoryProtectionTest.settings(.85, .95, 1024, 100));
    }

    @Test void configurationMatchesValveEnablementAndThresholdOrder() {
        var properties = new Properties();
        assertEquals(Duration.ofSeconds(900).toNanos(), RetrievalMemoryProtection.httpTimeoutNanos(properties));
        properties.setProperty("archappl.valve.stuckThresholdSeconds", "5");
        properties.setProperty("archappl.valve.interruptThresholdSeconds", "2");
        assertEquals(Duration.ofSeconds(5).toNanos(), RetrievalMemoryProtection.httpTimeoutNanos(properties));
        properties.setProperty("archappl.valve.interruptThresholdSeconds", "-1");
        assertEquals(0, RetrievalMemoryProtection.httpTimeoutNanos(properties));
        properties.setProperty("archappl.valve.interruptThresholdSeconds", "2");
        properties.setProperty("archappl.valve.stuckThresholdSeconds", "0");
        assertEquals(0, RetrievalMemoryProtection.httpTimeoutNanos(properties));
        properties.setProperty("archappl.valve.stuckThresholdSeconds", "bad");
        assertThrows(NumberFormatException.class, () -> RetrievalMemoryProtection.httpTimeoutNanos(properties));
    }

    @Test void deadlineSurvivesAConsumedInterruptAndDoesNotPoisonNextRequest() throws Exception {
        var guard = guard();
        var cancellation = new RetrievalMemoryProtection.Cancellation(Duration.ofMillis(20).toNanos(), () -> false);
        try (var request = guard.begin(cancellation)) {
            Thread.currentThread().interrupt();
            assertThrows(InterruptedException.class, () -> Thread.sleep(1));
            assertFalse(Thread.currentThread().isInterrupted());
            Thread.sleep(30);
            var failure = assertThrows(RetrievalMemoryProtection.Rejected.class,
                    RetrievalMemoryProtection::checkCancellationNow);
            assertEquals(503, failure.httpStatus());
            assertEquals("Retrieval request deadline exceeded", failure.getMessage());
            assertSame(failure, assertThrows(RetrievalMemoryProtection.Rejected.class, request::check));
        } finally {
            Thread.interrupted();
        }
        try (var request = guard.begin()) {
            assertDoesNotThrow(request::check);
            assertFalse(RetrievalMemoryProtection.currentFailed());
        }
    }

    @Test void workerSharesTheOriginalDeadlineAndCanBeReused() throws Exception {
        var guard = guard();
        try (var executor = Executors.newSingleThreadExecutor();
                var request = guard.begin(new RetrievalMemoryProtection.Cancellation(
                        Duration.ofMillis(20).toNanos(), () -> false))) {
            var cancellation = RetrievalMemoryProtection.currentCancellation();
            Thread.sleep(30);
            var worker = executor.submit(() -> {
                try (var scope = guard.begin(cancellation)) {
                    var failure = assertThrows(RetrievalMemoryProtection.Rejected.class, scope::check);
                    assertEquals("Retrieval request deadline exceeded", failure.getMessage());
                    assertFalse(Thread.currentThread().isInterrupted());
                    return Thread.currentThread();
                }
            }).get(5, TimeUnit.SECONDS);
            assertSame(worker, executor.submit(() -> {
                try (var scope = guard.begin()) {
                    scope.check();
                    return Thread.currentThread();
                }
            }).get(5, TimeUnit.SECONDS));
            assertThrows(RetrievalMemoryProtection.Rejected.class, request::check);
        }
    }

    @Test void deadlineIsCheckedBeforeMimeCompletionWithFewerThanOneEventInterval() throws Exception {
        var guard = guard();
        var bytes = new ByteArrayOutputStream();
        try (var request = guard.begin(new RetrievalMemoryProtection.Cancellation(
                Duration.ofMillis(20).toNanos(), () -> false))) {
            var consumer = new MergeDedupConsumer(new JSONResponse(), bytes);
            int before = bytes.size();
            Thread.sleep(30);
            assertThrows(RetrievalMemoryProtection.Rejected.class, consumer::close);
            assertEquals(before, bytes.size(), "Expired completion must not emit a success trailer");
        }
    }
}
