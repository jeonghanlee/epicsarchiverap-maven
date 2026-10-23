package org.epics.archiverappliance.retrieval;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

import static org.junit.jupiter.api.Assertions.*;

/** Exercises admission while two real accumulating responses remain in progress. */
@Tag("integration")
public class RetrievalAdmissionNetworkTest {
    private static final String APPLIANCE = "appliance0";
    private static final double QUERY_FRACTION = Double.parseDouble(
            System.getProperty("archappl.memory.test.admissionQueryFraction", "0.065"));
    private static final long RESPONSE_SECONDS = 30;
    private record Body(long bytes, String sha256) {}
    private record Probe(String name, HttpRequest request, int rows) {}

    private static List<Probe> probes(RetrievalMemoryNetworkFixture server) {
        var from = RetrievalMemoryNetworkFixture.FROM;
        String single = server.uri("json", "mean_60", from, from.plusSeconds(3600)).toString();
        String encodedPV = RetrievalMemoryNetworkFixture.encode(RetrievalMemoryNetworkFixture.PV);
        List<Probe> probes = new ArrayList<>();
        probes.add(new Probe("single", HttpRequest.newBuilder(URI.create(single))
                .timeout(Duration.ofSeconds(RESPONSE_SECONDS)).GET().build(), 1));
        probes.add(new Probe("multi", HttpRequest.newBuilder(URI.create(single.replace(
                "getData.json", "getDataForPVs.json") + "&pv=" + encodedPV))
                .timeout(Duration.ofSeconds(RESPONSE_SECONDS)).GET().build(), 2));
        for (String endpoint : List.of("getDataAtTime", "getDataAtTimeForAppliance")) {
            URI uri = URI.create(ConfigServiceForTests.DATA_RETRIEVAL_URL + "/data/" + endpoint
                    + "?at=" + RetrievalMemoryNetworkFixture.encode(from.plusSeconds(1800).toString())
                    + "&searchPeriod=P1D");
            probes.add(new Probe(endpoint, HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(RESPONSE_SECONDS))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString("pv=" + encodedPV)).build(), 0));
        }
        return probes;
    }

    private static void assertNormal(Probe probe, HttpResponse<String> response) {
        assertEquals(200, response.statusCode(), probe.name() + " " + response.body());
        Object parsed = JSONValue.parse(response.body());
        if (probe.rows() == 0) {
            assertInstanceOf(JSONObject.class, parsed);
            assertInstanceOf(JSONObject.class, ((JSONObject) parsed).get(RetrievalMemoryNetworkFixture.PV));
        } else {
            assertInstanceOf(JSONArray.class, parsed);
            JSONArray rows = (JSONArray) parsed;
            assertEquals(probe.rows(), rows.size());
            for (Object row : rows) assertFalse(((JSONArray) ((JSONObject) row).get("data")).isEmpty());
        }
    }

    private static Body consume(InputStream input) throws Exception {
        try (input) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[16384];
            long bytes = 0;
            int count;
            while ((count = input.read(buffer)) != -1) {
                digest.update(buffer, 0, count);
                bytes += count;
            }
            return new Body(bytes, HexFormat.of().formatHex(digest.digest()));
        }
    }

    @Test
    public void thirdRequestIsRefusedBetweenThresholdsAndRecoversAfterTwoComplete() throws Exception {
        try (var server = new RetrievalMemoryNetworkFixture()) {
            long maximum = server.memory.getHeapMemoryUsage().getMax();
            long seconds = (long) (maximum * QUERY_FRACTION / 112) - 2;
            assertTrue(seconds > 0 && seconds < Duration.between(
                    RetrievalMemoryNetworkFixture.FROM, RetrievalMemoryNetworkFixture.TO).getSeconds());
            var from = RetrievalMemoryNetworkFixture.FROM;
            var target = server.uri("csv", "mean_1", from, from.plusSeconds(seconds));
            var request = HttpRequest.newBuilder(target).timeout(Duration.ofSeconds(RESPONSE_SECONDS)).GET().build();
            List<Probe> probes = probes(server);
            assertTrue(server.tomcat.consoleLines(APPLIANCE).stream().anyMatch(line -> line.contains(
                    "budget=" + (long) (maximum * .20) + ", admission=" + (long) (maximum * .50)
                            + ", pressure=" + (long) (maximum * .60))), "Verify the actual production settings");
            Files.writeString(server.evidence.resolve("admission-inputs.txt"),
                    "uri=" + target + "\nrequests=2\nmaxHeap=" + maximum
                            + "\nqueryFraction=" + QUERY_FRACTION + "\nseconds=" + seconds
                            + "\nadmissionFraction=0.50\npressureFraction=0.60\n");
            List<String> samples = Collections.synchronizedList(new ArrayList<>());
            samples.add("elapsedNanos,heapUsed,currentOld,collectedOld,busy,phase");
            List<String> outcomes = new ArrayList<>();
            AtomicReference<String> phase = new AtomicReference<>("single-control");
            AtomicReference<Throwable> samplingFailure = new AtomicReference<>();
            var sampler = Executors.newSingleThreadScheduledExecutor();
            var readers = Executors.newFixedThreadPool(2);
            List<CompletableFuture<HttpResponse<InputStream>>> pending = new ArrayList<>();
            List<InputStream> bodies = new ArrayList<>();
            long started = System.nanoTime();
            sampler.scheduleWithFixedDelay(() -> {
                try {
                    samples.add((System.nanoTime() - started) + "," + server.memory.getHeapMemoryUsage().getUsed()
                            + "," + server.oldPool.getUsage().getUsed() + ","
                            + server.oldPool.getCollectionUsage().getUsed() + ","
                            + server.tomcat.currentThreadsBusy(APPLIANCE) + "," + phase.get());
                } catch (Throwable failure) {
                    samplingFailure.compareAndSet(null, failure);
                }
            }, 0, 20, TimeUnit.MILLISECONDS);
            try {
                var single = server.client.send(request, HttpResponse.BodyHandlers.ofInputStream());
                bodies.add(single.body());
                assertEquals(200, single.statusCode(), "The accumulating request must fit alone");
                Body control = readers.submit(() -> consume(single.body())).get(RESPONSE_SECONDS, TimeUnit.SECONDS);
                assertTrue(control.bytes() > 1024 * 1024, "The real control must contain a substantial response");
                outcomes.add("single=" + control);
                var normal = server.get("json", "mean_60", from, from.plusSeconds(3600));
                assertTrue(RetrievalMemoryNetworkFixture.hasData(normal), normal.body());
                for (Probe probe : probes) {
                    var response = server.client.send(probe.request(), HttpResponse.BodyHandlers.ofString());
                    Files.writeString(server.evidence.resolve("admission-control-" + probe.name() + ".json"), response.body());
                    assertNormal(probe, response);
                }

                phase.set("two-requests");
                for (int i = 0; i < 2; i++) {
                    pending.add(server.client.sendAsync(request, HttpResponse.BodyHandlers.ofInputStream()));
                }
                for (var future : pending) {
                    var response = future.get(RESPONSE_SECONDS, TimeUnit.SECONDS);
                    bodies.add(response.body());
                    outcomes.add("overlapStatus=" + response.statusCode());
                    assertEquals(200, response.statusCode(), "Both accumulating requests must be admitted");
                }
                long settleBy = System.nanoTime() + Duration.ofSeconds(5).toNanos();
                while (server.oldPool.getUsage().getUsed() <= maximum * .50 && System.nanoTime() < settleBy) {
                    assertNull(server.tomcat.exitStatus(APPLIANCE));
                    Thread.sleep(20);
                }
                int beforeBusy = server.tomcat.currentThreadsBusy(APPLIANCE);
                long beforeCurrent = server.oldPool.getUsage().getUsed();
                long beforeCollected = server.oldPool.getCollectionUsage().getUsed();
                outcomes.add("before busy=" + beforeBusy + " current=" + beforeCurrent + " collected=" + beforeCollected);
                assertTrue(beforeBusy >= 2, "Incomplete exposure: two server requests must still overlap");
                for (Probe probe : probes) {
                    phase.set("admission-" + probe.name());
                    long probeStarted = System.nanoTime();
                    var refused = server.client.send(probe.request(), HttpResponse.BodyHandlers.ofString());
                    long probeMillis = (System.nanoTime() - probeStarted) / 1_000_000;
                    Files.writeString(server.evidence.resolve("admission-probe-" + probe.name() + ".txt"),
                            refused.statusCode() + "\n" + refused.body());
                    long collected = server.oldPool.getCollectionUsage().getUsed();
                    int afterBusy = server.tomcat.currentThreadsBusy(APPLIANCE);
                    outcomes.add("probe=" + probe.name() + " status=" + refused.statusCode() + " millis=" + probeMillis
                            + " collected=" + collected + " busy=" + afterBusy);
                    assertTrue(collected > maximum * .50 && collected < maximum * .60,
                            "Incomplete exposure: collection usage must be between admission and pressure: " + collected);
                    assertEquals(503, refused.statusCode(), refused.body());
                    assertTrue(refused.body().contains("memory admission"), refused.body());
                    assertTrue(afterBusy >= 2, "Both original requests must remain in flight during refusal");
                    assertTrue(probeMillis < 5000, "Admission must return within five seconds");
                }

                phase.set("drain");
                var first = readers.submit(() -> consume(pending.get(0).join().body()));
                var second = readers.submit(() -> consume(pending.get(1).join().body()));
                Body firstBody = first.get(RESPONSE_SECONDS, TimeUnit.SECONDS);
                Body secondBody = second.get(RESPONSE_SECONDS, TimeUnit.SECONDS);
                outcomes.add("first=" + firstBody);
                outcomes.add("second=" + secondBody);
                assertEquals(control, firstBody, "The first response must finish identically to the real control");
                assertEquals(control, secondBody, "The second response must finish identically to the real control");

                phase.set("recovery");
                long recoverStarted = System.nanoTime();
                long recoverBy = recoverStarted + Duration.ofSeconds(30).toNanos();
                do {
                    normal = server.get("json", "mean_60", from, from.plusSeconds(3600));
                    if (RetrievalMemoryNetworkFixture.hasData(normal)) break;
                    Thread.sleep(100);
                } while (System.nanoTime() < recoverBy);
                Files.writeString(server.evidence.resolve("admission-recovery.json"), normal.body());
                outcomes.add("recoveryStatus=" + normal.statusCode() + " millis="
                        + (System.nanoTime() - recoverStarted) / 1_000_000);
                assertTrue(RetrievalMemoryNetworkFixture.hasData(normal), normal.body());
                for (Probe probe : probes) {
                    var response = server.client.send(probe.request(), HttpResponse.BodyHandlers.ofString());
                    Files.writeString(server.evidence.resolve("admission-recovery-" + probe.name() + ".json"), response.body());
                    assertNormal(probe, response);
                    outcomes.add("recovery=" + probe.name() + " status=" + response.statusCode());
                }
                assertNull(server.tomcat.exitStatus(APPLIANCE));
                assertFalse(server.tomcat.consoleLines(APPLIANCE).stream().anyMatch(line ->
                        line.contains("Retrieval memory pressure:") || line.contains("Retrieval request deadline exceeded")
                                || line.contains("Retrieval request interrupted")),
                        "Pressure or cancellation must not replace the admission-only scenario");
                assertNull(samplingFailure.get(), "Required JMX observations must remain available");
                outcomes.add("result=passed");
            } finally {
                sampler.shutdownNow();
                assertTrue(sampler.awaitTermination(10, TimeUnit.SECONDS));
                Files.write(server.evidence.resolve("admission-memory.csv"), samples);
                Files.write(server.evidence.resolve("admission-outcomes.txt"), outcomes);
                for (var future : pending) {
                    if (future.isDone() && !future.isCompletedExceptionally()) future.join().body().close();
                    else future.cancel(true);
                }
                for (InputStream body : bodies) body.close();
                readers.shutdownNow();
                assertTrue(readers.awaitTermination(10, TimeUnit.SECONDS));
            }
        }
    }
}
