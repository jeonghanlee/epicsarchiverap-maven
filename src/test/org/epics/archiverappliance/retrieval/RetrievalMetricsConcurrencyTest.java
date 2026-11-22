package org.epics.archiverappliance.retrieval;

import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The retrieval metrics of the runtime state under concurrent requests: several threads record retrievals of a few
 * PVs at once through the real update path, and afterwards the count of each PV equals the number of its updates, the
 * users of each PV are all there, and the summed metrics of the reports add the PVs up. A map or an entry that is
 * not safe for concurrent use loses an update, lets an update meet a missing entry or throws while it is read.
 */
class RetrievalMetricsConcurrencyTest {
    private static final List<String> PVS = List.of(
            ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "MetricsA",
            ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "MetricsB",
            ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "MetricsC",
            ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "MetricsD");
    private static final int THREADS = 8;
    private static final int ROUNDS = 20000;
    private static final int USERS = 5;

    @Test
    void concurrentUpdatesAreAllCountedAndReadConsistently() throws Exception {
        ConfigServiceForTests config = new ConfigServiceForTests(-1);
        RetrievalState state = config.getRetrievalRuntimeState();
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<?>> workers = new ArrayList<>();
            for (int thread = 0; thread < THREADS; thread++) {
                int offset = thread;
                workers.add(pool.submit(() -> {
                    start.await();
                    // Every thread spreads its updates over the PVs and the users, so that each PV receives
                    // THREADS * ROUNDS / PVS.size() updates from every user.
                    for (int round = 0; round < ROUNDS; round++) {
                        String pv = PVS.get((round + offset) % PVS.size());
                        state.updateRetrievalMetrics(pv, Instant.now(), "user" + (round % USERS));
                    }
                    return null;
                }));
            }
            start.countDown();
            for (Future<?> worker : workers) {
                worker.get(2, TimeUnit.MINUTES);
            }
        } finally {
            pool.shutdownNow();
        }
        long expectedPerPV = (long) THREADS * ROUNDS / PVS.size();
        for (String pv : PVS) {
            RetrievalMetrics metrics = state.getPVRetrievalMetrics(pv);
            assertNotNull(metrics, "metrics of " + pv);
            Map<String, String> values = metrics.getMetrics();
            assertEquals(expectedPerPV, Long.parseLong(values.get(RetrievalMetrics.NUMBER_OF_RETRIEVAL_REQUESTS)), "count of " + pv);
            assertEquals(USERS, Integer.parseInt(values.get(RetrievalMetrics.NUMBER_OF_UNIQUE_USERS)), "users of " + pv);
        }
        Map<String, String> summed = RetrievalMetrics.calculateSummedMetrics(config).getMetrics();
        assertEquals((long) THREADS * ROUNDS, Long.parseLong(summed.get(RetrievalMetrics.NUMBER_OF_RETRIEVAL_REQUESTS)), "summed count");
        assertEquals(USERS, Integer.parseInt(summed.get(RetrievalMetrics.NUMBER_OF_UNIQUE_USERS)), "summed users");
        assertTrue(summed.get(RetrievalMetrics.LAST_RETRIEVAL_REQUEST) != null, "summed last request");
    }
}
