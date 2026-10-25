package org.epics.archiverappliance.retrieval;

import jdk.jfr.consumer.RecordingFile;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

import java.lang.management.ManagementFactory;
import java.lang.management.ThreadMXBean;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/** Correlates real HTTP pressure failures with the store-reading path in the server's JFR. */
@Tag("integration")
public class RetrievalWorkerPressureNetworkTest {
    private static final int LOAD_REQUESTS = 8;
    private static final int SNAPSHOT_PVS = 256;
    private static final int SPARSE_INPUT_SECONDS = 60;
    private static final Duration LOAD_TIMEOUT = Duration.ofSeconds(120);
    private static final Duration RECOVERY_TIMEOUT = Duration.ofSeconds(30);
    private static final Duration WORKER_TIMEOUT = Duration.ofSeconds(10);
    private static final String PRESSURE = "Retrieval memory pressure:";

    private record Outcome(int status, String body, String failure) {}

    private static HttpRequest normalRequest(RetrievalMemoryNetworkFixture server, boolean snapshot, Duration timeout) {
        String pv = RetrievalMemoryNetworkFixture.encode(RetrievalMemoryNetworkFixture.PV);
        if (snapshot) {
            URI uri = URI.create(ConfigServiceForTests.DATA_RETRIEVAL_URL
                    + "/data/getDataAtTimeForAppliance?at="
                    + RetrievalMemoryNetworkFixture.encode(RetrievalMemoryNetworkFixture.FROM.plusSeconds(1800).toString())
                    + "&searchPeriod=P1D");
            return HttpRequest.newBuilder(uri).timeout(timeout)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString("pv=" + pv)).build();
        }
        String uri = server.uri("json", "mean_60", RetrievalMemoryNetworkFixture.FROM,
                RetrievalMemoryNetworkFixture.FROM.plusSeconds(3600)).toString()
                .replace("getData.json", "getDataForPVs.json") + "&pv=" + pv;
        return HttpRequest.newBuilder(URI.create(uri)).timeout(timeout).GET().build();
    }

    private static void assertNormal(HttpResponse<String> response, boolean snapshot) {
        assertEquals(200, response.statusCode(), response.body());
        Object parsed = JSONValue.parse(response.body());
        if (snapshot) {
            JSONObject values = assertInstanceOf(JSONObject.class, parsed);
            JSONObject value = assertInstanceOf(JSONObject.class, values.get(RetrievalMemoryNetworkFixture.PV));
            assertEquals(RetrievalMemoryNetworkFixture.FROM.plusSeconds(1800).getEpochSecond(),
                    ((Number) value.get("secs")).longValue());
        } else {
            JSONArray rows = assertInstanceOf(JSONArray.class, parsed);
            assertEquals(2, rows.size());
            for (Object row : rows) assertFalse(((JSONArray) ((JSONObject) row).get("data")).isEmpty());
        }
    }

    private static void baseline(RetrievalMemoryNetworkFixture server, boolean snapshot) throws Exception {
        var response = server.client.send(normalRequest(server, snapshot, RECOVERY_TIMEOUT),
                HttpResponse.BodyHandlers.ofString());
        Files.writeString(server.evidence.resolve("worker-pressure-baseline.json"), response.body());
        assertNormal(response, snapshot);
    }

    private static RetrievalMemoryNetworkFixture server() throws Exception {
        Path recording = Path.of("target", "memory-network", "worker-pressure-" + UUID.randomUUID() + ".jfr")
                .toAbsolutePath();
        Files.createDirectories(recording.getParent());
        var server = new RetrievalMemoryNetworkFixture("-XX:StartFlightRecording=filename=" + recording
                + ",settings=" + Path.of("src/test/resources/retrieval-interrupt.jfc").toAbsolutePath()
                + ",dumponexit=true,maxsize=64m");
        Files.writeString(server.evidence.resolve("exception-recording.txt"), recording.toString());
        return server;
    }

    private static CompletableFuture<Outcome> send(RetrievalMemoryNetworkFixture server, HttpRequest request) {
        return server.client.sendAsync(request, info -> info.statusCode() == 503 || info.statusCode() == 400
                        ? HttpResponse.BodySubscribers.ofString(StandardCharsets.UTF_8)
                        : HttpResponse.BodySubscribers.replacing(""))
                .handle((response, failure) -> new Outcome(failure == null ? response.statusCode() : -1,
                        failure == null ? response.body() : "", failure == null ? "" : failure.toString()));
    }

    private static ThreadMXBean threads(RetrievalMemoryNetworkFixture server) throws Exception {
        return ManagementFactory.newPlatformMXBeanProxy(server.connector.getMBeanServerConnection(),
                ManagementFactory.THREAD_MXBEAN_NAME, ThreadMXBean.class);
    }

    private static List<java.lang.management.ThreadInfo> storeWorkers(ThreadMXBean threads, boolean snapshot) {
        return Arrays.stream(threads.dumpAllThreads(false, false)).filter(thread ->
                Arrays.stream(thread.getStackTrace()).anyMatch(frame -> snapshot
                        ? frame.getClassName().equals(GetDataAtTime.class.getName())
                            && frame.getMethodName().equals("readDataAtTimeForPVFromStores")
                        : frame.getClassName().equals(DataRetrievalServlet.class.getName())
                            && frame.getMethodName().equals("doGetMultiPV"))).toList();
    }

    private static void captureTerminal(RetrievalMemoryNetworkFixture server,
            List<CompletableFuture<Outcome>> requests) throws Exception {
        Path evidence = server.evidence.resolve("worker-pressure-terminal.txt");
        if (Files.exists(evidence)) return;
        Files.writeString(evidence, "observed=" + java.time.Instant.now()
                + "\nserverExitStatus=" + server.tomcat.exitStatus("appliance0") + "\nrequests="
                + requests.stream().map(request -> request.isCancelled() ? "cancelled"
                        : request.isDone() ? request.join().toString() : "pending").toList() + "\n");
    }

    private static void awaitAndRecover(RetrievalMemoryNetworkFixture server, List<CompletableFuture<Outcome>> requests,
            List<CompletableFuture<Outcome>> targets, boolean snapshot) throws Exception {
        var threads = threads(server);
        var samples = new ArrayList<String>();
        samples.add("elapsedNanos,heapUsed,collectedUsed,storeWorkers,pending");
        long started = System.nanoTime();
        try {
            while (!requests.stream().allMatch(CompletableFuture::isDone)) {
                samples.add((System.nanoTime() - started) + "," + server.memory.getHeapMemoryUsage().getUsed()
                        + "," + server.oldPool.getCollectionUsage().getUsed() + ","
                        + storeWorkers(threads, snapshot).size() + ","
                        + requests.stream().filter(request -> !request.isDone()).count());
                assertNull(server.tomcat.exitStatus("appliance0"), "The isolated JVM must survive pressure");
                assertTrue(System.nanoTime() - started < LOAD_TIMEOUT.toNanos(), "HTTP load exceeded its bound");
                Thread.sleep(20);
            }
            var outcomes = requests.stream().map(CompletableFuture::join).toList();
            var targetOutcomes = targets.stream().map(CompletableFuture::join).toList();
            Files.writeString(server.evidence.resolve("worker-pressure-outcomes.txt"),
                    "targets=" + targetOutcomes + "\nall=" + outcomes + "\n");
            assertTrue(targetOutcomes.stream().anyMatch(outcome -> outcome.status() == 503
                            && outcome.body().contains(PRESSURE)),
                    "Incomplete target pressure exposure: no pressure-specific HTTP 503: " + targetOutcomes);
            assertTrue(outcomes.stream().noneMatch(outcome -> outcome.status() == 400),
                    "The load must fit the declared request budget");
            long recoverBy = System.nanoTime() + RECOVERY_TIMEOUT.toNanos();
            while (!storeWorkers(threads, snapshot).isEmpty() && System.nanoTime() < recoverBy) Thread.sleep(20);
            assertTrue(storeWorkers(threads, snapshot).isEmpty(), "Target workers must finish before recovery");
            HttpResponse<String> response;
            do {
                long remaining = recoverBy - System.nanoTime();
                assertTrue(remaining > 0, "Same-path recovery exceeded its bound");
                response = server.client.send(normalRequest(server, snapshot, Duration.ofNanos(remaining)),
                        HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200) break;
                Thread.sleep(20);
            } while (System.nanoTime() < recoverBy);
            Files.writeString(server.evidence.resolve("worker-pressure-recovery.json"), response.body());
            assertNormal(response, snapshot);
            assertTrue(System.nanoTime() < recoverBy, "Same-JVM recovery exceeded its bound");
            assertNull(server.tomcat.exitStatus("appliance0"));
        } finally {
            Files.write(server.evidence.resolve("worker-pressure-memory.csv"), samples);
            captureTerminal(server, requests);
            for (var request : requests) request.cancel(true);
        }
    }

    private static void assertPressurePath(Path evidence, boolean snapshot) throws Exception {
        Path recording = Path.of(Files.readString(evidence.resolve("exception-recording.txt")));
        var matches = new ArrayList<String>();
        try (var events = new RecordingFile(recording)) {
            while (events.hasMoreEvents()) {
                var event = events.readEvent();
                if (!event.getEventType().getName().equals("jdk.JavaExceptionThrow")) continue;
                String message = event.getString("message");
                if (!event.getClass("thrownClass").getName().equals(RetrievalMemoryProtection.Rejected.class.getName())
                        || message == null || !message.startsWith(PRESSURE) || event.getStackTrace() == null) continue;
                boolean target = event.getStackTrace().getFrames().stream().anyMatch(frame -> snapshot
                        ? frame.getMethod().getType().getName().equals(GetDataAtTime.class.getName() + "$GetDataPredicate")
                            && frame.getMethod().getName().equals("test")
                        : frame.getMethod().getType().getName().equals(DataRetrievalServlet.class.getName())
                            && frame.getMethod().getName().equals("doGetMultiPV"));
                if (target) matches.add(event.toString());
            }
        }
        Files.write(evidence.resolve("worker-pressure-exceptions.txt"), matches);
        assertFalse(matches.isEmpty(), "Incomplete pressure exposure in the actual target store-reading path");
    }

    @Test
    public void multiPVRequestsStopInsideTheirProcessingPath() throws Exception {
        var server = server();
        try (server) {
            baseline(server, false);
            long maximum = server.memory.getHeapMemoryUsage().getMax();
            long seconds = Math.min(Duration.between(RetrievalMemoryNetworkFixture.FROM,
                    RetrievalMemoryNetworkFixture.TO).getSeconds(), (long) (maximum * .07 / 112) - 2);
            String target = server.uri("json", "mean_1", RetrievalMemoryNetworkFixture.FROM,
                    RetrievalMemoryNetworkFixture.FROM.plusSeconds(seconds)).toString()
                    .replace("getData.json", "getDataForPVs.json")
                    + "&pv=" + RetrievalMemoryNetworkFixture.encode(RetrievalMemoryNetworkFixture.PV);
            Files.writeString(server.evidence.resolve("worker-pressure-inputs.txt"),
                    "target=" + target + "\nrequests=" + LOAD_REQUESTS + "\nheap=" + maximum + "\n");
            var requests = new ArrayList<CompletableFuture<Outcome>>();
            for (int i = 0; i < LOAD_REQUESTS; i++) requests.add(send(server,
                    HttpRequest.newBuilder(URI.create(target)).timeout(LOAD_TIMEOUT).GET().build()));
            awaitAndRecover(server, requests, requests, false);
        }
        assertPressurePath(server.evidence, false);
    }

    @Test
    public void sparseMultiPVRequestsStopDuringIteratorConstruction() throws Exception {
        var server = server();
        try (server) {
            baseline(server, false);
            long maximum = server.memory.getHeapMemoryUsage().getMax();
            long seconds = (long) (maximum * .07 / 112) - 2;
            var from = RetrievalMemoryNetworkFixture.TO.minusSeconds(SPARSE_INPUT_SECONDS);
            String target = server.uri("json", "mean_1", from, from.plusSeconds(seconds)).toString()
                    .replace("getData.json", "getDataForPVs.json")
                    + "&pv=" + RetrievalMemoryNetworkFixture.encode(RetrievalMemoryNetworkFixture.PV);
            String control = server.uri("json", "mean_1", from,
                    from.plusSeconds(2L * SPARSE_INPUT_SECONDS)).toString()
                    .replace("getData.json", "getDataForPVs.json")
                    + "&pv=" + RetrievalMemoryNetworkFixture.encode(RetrievalMemoryNetworkFixture.PV);
            Files.writeString(server.evidence.resolve("worker-pressure-inputs.txt"),
                    "target=" + target + "\nrequests=" + LOAD_REQUESTS + "\nheap=" + maximum
                            + "\nstoreInputSeconds=" + SPARSE_INPUT_SECONDS + "\ncontrol=" + control + "\n");
            var response = server.client.send(HttpRequest.newBuilder(URI.create(control))
                    .timeout(RECOVERY_TIMEOUT).GET().build(), HttpResponse.BodyHandlers.ofString());
            Files.writeString(server.evidence.resolve("iterator-sparse-control.json"), response.body());
            assertEquals(200, response.statusCode(), response.body());
            JSONArray rows = assertInstanceOf(JSONArray.class, JSONValue.parse(response.body()));
            assertEquals(2, rows.size());
            for (Object row : rows) {
                JSONArray data = assertInstanceOf(JSONArray.class, ((JSONObject) row).get("data"));
                assertEquals(2 * SPARSE_INPUT_SECONDS, data.size(),
                        "The real postprocessor must extend the sparse store input across empty bins");
                JSONObject last = (JSONObject) data.getLast();
                assertEquals(from.plusSeconds(2L * SPARSE_INPUT_SECONDS - 1).getEpochSecond(),
                        ((Number) last.get("secs")).longValue());
                assertEquals(500000000, ((Number) last.get("nanos")).intValue());
            }
            var requests = new ArrayList<CompletableFuture<Outcome>>();
            for (int i = 0; i < LOAD_REQUESTS; i++) requests.add(send(server,
                    HttpRequest.newBuilder(URI.create(target)).timeout(LOAD_TIMEOUT).GET().build()));
            awaitAndRecover(server, requests, requests, false);
        }
        assertPressurePath(server.evidence, false);
        Path recording = Path.of(Files.readString(server.evidence.resolve("exception-recording.txt")));
        var matches = new ArrayList<String>();
        try (var events = new RecordingFile(recording)) {
            while (events.hasMoreEvents()) {
                var event = events.readEvent();
                if (!event.getEventType().getName().equals("jdk.JavaExceptionThrow")) continue;
                String message = event.getString("message");
                if (!event.getClass("thrownClass").getName().equals(RetrievalMemoryProtection.Rejected.class.getName())
                        || message == null || !message.startsWith(PRESSURE) || event.getStackTrace() == null) continue;
                var frames = event.getStackTrace().getFrames();
                boolean constructor = frames.stream().anyMatch(frame -> frame.getMethod().getType().getName()
                        .equals("org.epics.archiverappliance.retrieval.postprocessors."
                                + "SummaryStatsCollectorEventStream$SummaryStatsCollectorEventStreamIterator")
                        && frame.getMethod().getName().equals("<init>"));
                boolean binCheck = frames.stream().anyMatch(frame -> frame.getMethod().getType().getName()
                        .equals(RetrievalMemoryProtection.class.getName())
                        && frame.getMethod().getName().equals("checkCurrent"));
                if (constructor && binCheck) matches.add(event.toString());
            }
        }
        Files.write(server.evidence.resolve("iterator-pressure-exceptions.txt"), matches);
        assertFalse(matches.isEmpty(), "Incomplete exposure: pressure must stop the real iterator bin loop");
    }

    @Test
    public void frontSnapshotPropagatesWorkerPressureAndRecovers() throws Exception {
        var server = server();
        Outcome targetOutcome;
        try (server) {
            String pv = RetrievalMemoryNetworkFixture.encode(RetrievalMemoryNetworkFixture.PV);
            var aliases = new ArrayList<String>();
            long registerBy = System.nanoTime() + RECOVERY_TIMEOUT.toNanos();
            for (int i = 0; i < SNAPSHOT_PVS; i++) {
                String alias = "MemoryQualification:FrontAlias" + i;
                URI uri = URI.create(ConfigServiceForTests.MGMT_URL + "/addAlias?pv=" + pv
                        + "&aliasname=" + RetrievalMemoryNetworkFixture.encode(alias));
                long remaining = registerBy - System.nanoTime();
                assertTrue(remaining > 0, "Alias registration exceeded its shared bound");
                var added = server.client.send(HttpRequest.newBuilder(uri).timeout(Duration.ofNanos(remaining)).GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                assertEquals(200, added.statusCode(), added.body());
                assertEquals("ok", ((JSONObject) JSONValue.parse(added.body())).get("status"));
                aliases.add(alias);
            }
            Files.write(server.evidence.resolve("front-snapshot-aliases.txt"), aliases);
            var normal = normalRequest(server, true, RECOVERY_TIMEOUT);
            URI normalURI = URI.create(normal.uri().toString()
                    .replace("getDataAtTimeForAppliance", "getDataAtTime"));
            var normalFront = HttpRequest.newBuilder(normalURI).timeout(RECOVERY_TIMEOUT)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString("pv=" + pv)).build();
            var before = server.client.send(normalFront, HttpResponse.BodyHandlers.ofString());
            Files.writeString(server.evidence.resolve("front-snapshot-baseline.json"), before.body());
            assertNormal(before, true);
            URI snapshot = URI.create(ConfigServiceForTests.DATA_RETRIEVAL_URL + "/data/getDataAtTime?at="
                    + RetrievalMemoryNetworkFixture.encode(
                            RetrievalMemoryNetworkFixture.FROM.plusSeconds(20L * 86400).toString())
                    + "&searchPeriod=P1D");
            String body = "pv=" + aliases.stream().map(RetrievalMemoryNetworkFixture::encode)
                    .collect(java.util.stream.Collectors.joining(","));
            Files.writeString(server.evidence.resolve("worker-pressure-inputs.txt"),
                    "snapshot=" + snapshot + "\nbody=" + body + "\nbackgroundRequests=" + LOAD_REQUESTS + "\n");
            var pending = new ArrayList<CompletableFuture<Outcome>>();
            var target = server.client.sendAsync(HttpRequest.newBuilder(snapshot).timeout(LOAD_TIMEOUT)
                            .header("Content-Type", "application/x-www-form-urlencoded")
                            .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString())
                    .handle((response, failure) -> new Outcome(failure == null ? response.statusCode() : -1,
                            failure == null ? response.body() : "", failure == null ? "" : failure.toString()));
            pending.add(target);
            try {
                var threadBean = threads(server);
                long readyBy = System.nanoTime() + WORKER_TIMEOUT.toNanos();
                List<java.lang.management.ThreadInfo> active;
                do {
                    active = storeWorkers(threadBean, true);
                    if (active.size() >= 2) break;
                    Thread.sleep(10);
                } while (!target.isDone() && System.nanoTime() < readyBy);
                var stacks = new StringBuilder("workers=" + active.size() + "\n");
                for (var worker : active) {
                    stacks.append("thread=").append(worker.getThreadId()).append('\n');
                    for (var frame : worker.getStackTrace()) stacks.append("  ").append(frame).append('\n');
                }
                Files.writeString(server.evidence.resolve("snapshot-workers-before-load.txt"), stacks.toString());
                assertTrue(active.size() >= 2, "Incomplete exposure: real front-end store readers must overlap");
                long maximum = server.memory.getHeapMemoryUsage().getMax();
                long seconds = Math.min(Duration.between(RetrievalMemoryNetworkFixture.FROM,
                        RetrievalMemoryNetworkFixture.TO).getSeconds(), (long) (maximum * .16 / 112) - 2);
                URI load = server.uri("json", "mean_1", RetrievalMemoryNetworkFixture.FROM,
                        RetrievalMemoryNetworkFixture.FROM.plusSeconds(seconds));
                var background = new ArrayList<CompletableFuture<Outcome>>();
                for (int i = 0; i < LOAD_REQUESTS; i++) background.add(send(server,
                        HttpRequest.newBuilder(load).timeout(LOAD_TIMEOUT).GET().build()));
                pending.addAll(background);
                awaitAndRecover(server, pending, background, true);
                targetOutcome = target.join();
                Files.writeString(server.evidence.resolve("front-snapshot-outcome.txt"), targetOutcome.toString());
                var after = server.client.send(normalFront, HttpResponse.BodyHandlers.ofString());
                Files.writeString(server.evidence.resolve("front-snapshot-recovery.json"), after.body());
                assertNormal(after, true);
            } finally {
                captureTerminal(server, pending);
                for (var request : pending) request.cancel(true);
            }
        }
        assertPressurePath(server.evidence, true);
        assertEquals(503, targetOutcome.status(), "Front-end must propagate worker pressure: " + targetOutcome);
        assertTrue(targetOutcome.body().contains(PRESSURE), targetOutcome.toString());
    }

    @Test
    public void snapshotWorkersStopWhileReadingUnderPressure() throws Exception {
        var server = server();
        try (server) {
            baseline(server, true);
            String pv = RetrievalMemoryNetworkFixture.encode(RetrievalMemoryNetworkFixture.PV);
            URI snapshot = URI.create(ConfigServiceForTests.DATA_RETRIEVAL_URL
                    + "/data/getDataAtTimeForAppliance?at="
                    + RetrievalMemoryNetworkFixture.encode(RetrievalMemoryNetworkFixture.FROM.plusSeconds(20L * 86400).toString())
                    + "&searchPeriod=P1D");
            String body = "pv=" + String.join(",", java.util.Collections.nCopies(SNAPSHOT_PVS, pv));
            var request = HttpRequest.newBuilder(snapshot).timeout(LOAD_TIMEOUT)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build();
            Files.writeString(server.evidence.resolve("worker-pressure-inputs.txt"),
                    "snapshot=" + snapshot + "\nbody=" + body + "\nbackgroundRequests=" + LOAD_REQUESTS + "\n");
            var pending = new ArrayList<CompletableFuture<Outcome>>();
            var target = send(server, request);
            pending.add(target);
            try {
                var threads = threads(server);
                long readyBy = System.nanoTime() + WORKER_TIMEOUT.toNanos();
                List<java.lang.management.ThreadInfo> active;
                do {
                    active = storeWorkers(threads, true);
                    if (active.size() >= 2) break;
                    Thread.sleep(10);
                } while (!target.isDone() && System.nanoTime() < readyBy);
                var stacks = new StringBuilder("workers=" + active.size() + "\n");
                for (var worker : active) {
                    stacks.append("thread=").append(worker.getThreadId()).append('\n');
                    for (var frame : worker.getStackTrace()) stacks.append("  ").append(frame).append('\n');
                }
                Files.writeString(server.evidence.resolve("snapshot-workers-before-load.txt"), stacks.toString());
                assertTrue(active.size() >= 2, "Incomplete exposure: snapshot workers must already be reading");
                long maximum = server.memory.getHeapMemoryUsage().getMax();
                long seconds = Math.min(Duration.between(RetrievalMemoryNetworkFixture.FROM,
                        RetrievalMemoryNetworkFixture.TO).getSeconds(), (long) (maximum * .16 / 112) - 2);
                URI load = server.uri("json", "mean_1", RetrievalMemoryNetworkFixture.FROM,
                        RetrievalMemoryNetworkFixture.FROM.plusSeconds(seconds));
                Files.writeString(server.evidence.resolve("snapshot-background-input.txt"), load.toString());
                for (int i = 0; i < LOAD_REQUESTS; i++) pending.add(send(server,
                        HttpRequest.newBuilder(load).timeout(LOAD_TIMEOUT).GET().build()));
                awaitAndRecover(server, pending, List.of(target), true);
            } finally {
                captureTerminal(server, pending);
                for (var future : pending) future.cancel(true);
            }
        }
        assertPressurePath(server.evidence, true);
    }
}
