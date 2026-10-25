package org.epics.archiverappliance.retrieval;

import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

import javax.management.MBeanServerConnection;
import javax.management.ObjectName;
import javax.management.remote.JMXConnector;
import javax.management.remote.JMXConnectorFactory;
import javax.management.remote.JMXServiceURL;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * The valves of the context.xml of the retrieval and management WARs, on the real appliance of the fixture: the
 * concurrency of the SemaphoreValve (requests above it are answered 503 at once) and the application deadline that
 * retrieval derives from the thresholds of the StuckThreadDetectionValve (a request that runs longer than that is
 * stopped and answered 503 naming the deadline). The values come from system properties of the child JVM, the way the
 * attributes of the context.xml read them, and the Engine runs its background processing every second.
 */
@Tag("integration")
public class ValveConcurrencyTest {
    private static final String PV_NAME = ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "RetrievalOomExit";
    private static final String DATA_FROM = "2011-02-01T00:00:00.000Z";
    private static final String DATA_TO = "2011-03-03T00:00:00.000Z";
    private static final int CONCURRENCY = 2;
    private static final int REQUESTS = 5;
    private static final int STUCK_SECONDS = 1;
    private static final long REFUSAL_MILLIS_LIMIT = 1000;
    private static final String APPLIANCE = "appliance0";
    private static final String SLOW_PP = "optimized_2000000";
    private static final int SEARCH_SECONDS = 5;
    private static final long INTERRUPT_MILLIS_LIMIT = 5000;
    private static final String DEADLINE_MESSAGE = "Retrieval request deadline exceeded";

    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    // status is the HTTP status, or -1 when the client could not read the answer to its end (the message says why).
    private record Outcome(int status, long millis, String message) {}

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    @Test
    public void managementRequestsAboveTheConcurrencyAreRefusedWhileRealSearchesRun() throws Exception {
        TomcatSetup fixture = new TomcatSetup()
                .withJvmOptions("-Darchappl.valve.concurrency=" + CONCURRENCY)
                .withJmx();
        try {
            fixture.setUpWebApps("ManagementValveConcurrency");
            long idleDeadline = System.nanoTime() + Duration.ofSeconds(10).toNanos();
            long idleSince = 0;
            while (true) {
                if (fixture.currentThreadsBusy(APPLIANCE) == 0) {
                    if (idleSince == 0) idleSince = System.nanoTime();
                    if (System.nanoTime() - idleSince >= Duration.ofMillis(250).toNanos()) break;
                } else {
                    idleSince = 0;
                }
                Assertions.assertTrue(System.nanoTime() < idleDeadline,
                        "Startup requests must release the connector before the overload workload");
                Thread.sleep(25);
            }
            String missingPV = "ca://T5:ABSENT:" + UUID.randomUUID();
            URI uri = URI.create(ConfigServiceForTests.MGMT_URL + "/searchPV?pv=" + encode(missingPV)
                    + "&timeout=" + SEARCH_SECONDS);
            List<CompletableFuture<Outcome>> pending = new ArrayList<>();
            long sent = System.nanoTime();
            for (int i = 0; i < REQUESTS; i++) {
                pending.add(client.sendAsync(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(30)).GET().build(),
                                HttpResponse.BodyHandlers.ofString())
                        .thenApply(response -> new Outcome(response.statusCode(),
                                (System.nanoTime() - sent) / 1_000_000, response.body())));
            }
            int maxBusy = 0;
            while (!pending.stream().allMatch(CompletableFuture::isDone)) {
                maxBusy = Math.max(maxBusy, fixture.currentThreadsBusy(APPLIANCE));
                Thread.sleep(100);
            }
            int refused = 0;
            int admitted = 0;
            for (CompletableFuture<Outcome> future : pending) {
                Outcome outcome = future.get();
                System.out.println("T5 management status " + outcome.status() + " millis " + outcome.millis());
                if (outcome.status() == 503) {
                    refused++;
                    Assertions.assertTrue(outcome.millis() < REFUSAL_MILLIS_LIMIT, "Late refusal: " + outcome.millis());
                } else {
                    Assertions.assertEquals(200, outcome.status(), "A permitted search must complete");
                    JSONObject answer = (JSONObject) JSONValue.parse(outcome.message());
                    Assertions.assertNotNull(answer, "The real search must return JSON");
                    Assertions.assertEquals(missingPV, answer.get("pvName"));
                    Assertions.assertEquals(Boolean.FALSE, answer.get("found"));
                    Assertions.assertFalse(answer.containsKey("error"), "The search must wait, not fail internally");
                    long elapsed = ((Number) answer.get("elapsedMs")).longValue();
                    Assertions.assertTrue(elapsed >= SEARCH_SECONDS * 1000L, "The engine search did not wait: " + elapsed);
                    admitted++;
                }
            }
            Assertions.assertEquals(REQUESTS - CONCURRENCY, refused);
            Assertions.assertEquals(CONCURRENCY, admitted);
            Assertions.assertTrue(maxBusy >= CONCURRENCY, "Concurrent searches must have occupied the connector");
            HttpResponse<String> recovery = client.send(HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(30))
                    .GET().build(), HttpResponse.BodyHandlers.ofString());
            Assertions.assertEquals(200, recovery.statusCode(), "A search must work after the permits are released");
            System.out.println("T5 management maxBusyThreads " + maxBusy + " recoveryStatus " + recovery.statusCode());
        } finally {
            fixture.tearDown();
        }
    }

    @Test
    public void requestsAboveTheConcurrencyAreRefusedAtOnceAndALongRequestIsReported() throws Exception {
        Instant start = TimeUtils.convertFromISO8601String(DATA_FROM);
        Instant end = TimeUtils.convertFromISO8601String(DATA_TO);
        GenerateData.generateSineForPV(PV_NAME, 0, ArchDBRTypes.DBR_SCALAR_DOUBLE, start, end);

        TomcatSetup fixture = new TomcatSetup()
                .withJvmOptions(
                        "-Darchappl.valve.concurrency=" + CONCURRENCY,
                        "-Darchappl.valve.stuckThresholdSeconds=" + STUCK_SECONDS,
                        "-Darchappl.valve.interruptThresholdSeconds=" + STUCK_SECONDS)
                .withEngineBackgroundProcessorDelay(1)
                .withJmx();
        try {
            fixture.setUpWebApps("ValveConcurrency");

            // The valves of both web applications read the properties.
            JMXServiceURL url = new JMXServiceURL(
                    "service:jmx:rmi:///jndi/rmi://127.0.0.1:" + fixture.jmxPort(APPLIANCE) + "/jmxrmi");
            try (JMXConnector connector = JMXConnectorFactory.connect(url)) {
                MBeanServerConnection connection = connector.getMBeanServerConnection();
                Set<ObjectName> semaphores = connection.queryNames(
                        new ObjectName("Catalina:type=Valve,host=localhost,context=*,name=SemaphoreValve"), null);
                Set<String> contexts = new TreeSet<>();
                for (ObjectName semaphore : semaphores) {
                    contexts.add(semaphore.getKeyProperty("context"));
                    Assertions.assertEquals(CONCURRENCY, ((Number) connection.getAttribute(semaphore, "concurrency")).intValue(),
                            "concurrency of " + semaphore);
                }
                Assertions.assertEquals(Set.of("/mgmt", "/retrieval"), contexts, "SemaphoreValve contexts: " + semaphores);
            }

            // More long requests than the concurrency, sent together.
            String url0 = ConfigServiceForTests.DATA_RETRIEVAL_URL + "/data/getData.json?pv=" + encode(PV_NAME)
                    + "&pp=" + encode(SLOW_PP) + "&from=" + encode(DATA_FROM) + "&to=" + encode(DATA_TO);
            List<CompletableFuture<Outcome>> pending = new ArrayList<>();
            long sent = System.nanoTime();
            for (int i = 0; i < REQUESTS; i++) {
                pending.add(client.sendAsync(
                                HttpRequest.newBuilder(URI.create(url0)).timeout(Duration.ofSeconds(120)).GET().build(),
                                HttpResponse.BodyHandlers.ofString())
                        .handle((response, failure) -> new Outcome(
                                failure == null ? response.statusCode() : -1,
                                (System.nanoTime() - sent) / 1_000_000,
                                failure == null ? response.body() : String.valueOf(failure.getCause() != null ? failure.getCause() : failure))));
            }
            int maxBusy = 0;
            while (!pending.stream().allMatch(CompletableFuture::isDone)) {
                maxBusy = Math.max(maxBusy, fixture.currentThreadsBusy(APPLIANCE));
                Thread.sleep(100);
            }
            List<Outcome> outcomes = new ArrayList<>();
            for (CompletableFuture<Outcome> future : pending) outcomes.add(future.get());
            System.out.println("T5 outcomes " + outcomes + " maxBusyThreads " + maxBusy);

            long refused = outcomes.stream().filter(ValveConcurrencyTest::isConcurrencyRefusal).count();
            long admitted = outcomes.size() - refused;
            Assertions.assertEquals(REQUESTS - CONCURRENCY, refused, "Requests refused with 503: " + outcomes);
            Assertions.assertEquals(CONCURRENCY, admitted, "Requests admitted: " + outcomes);
            for (Outcome outcome : outcomes) {
                if (isConcurrencyRefusal(outcome)) {
                    Assertions.assertTrue(outcome.millis() < REFUSAL_MILLIS_LIMIT,
                            "A request above the concurrency must be refused at once: " + outcome);
                }
            }
            Assertions.assertTrue(maxBusy >= 1, "The busy threads must have been read while the requests ran");

            // The admitted requests ran past the valve thresholds; the application deadline, derived from those
            // thresholds, stopped them and reported the stop to the client within the low-threshold window.
            List<Outcome> stopped = outcomes.stream().filter(ValveConcurrencyTest::isDeadlineStop).toList();
            Assertions.assertEquals(CONCURRENCY, stopped.size(), "Requests stopped at the application deadline: " + outcomes);
            for (Outcome outcome : stopped) {
                Assertions.assertTrue(outcome.millis() >= STUCK_SECONDS * 1000L && outcome.millis() < INTERRUPT_MILLIS_LIMIT,
                        "A long request is outside the low-threshold window: " + outcome);
            }
            System.out.println("T5 deadline stops elapsedMillis " + stopped.stream().map(Outcome::millis).toList());
        } finally {
            fixture.tearDown();
        }
    }

    /** A 503 that names the application deadline was admitted by the valve and stopped by the request itself. */
    private static boolean isDeadlineStop(Outcome outcome) {
        return outcome.status() == 503 && outcome.message().contains(DEADLINE_MESSAGE);
    }

    /** Any other 503 is the valve refusing a request above its concurrency. */
    private static boolean isConcurrencyRefusal(Outcome outcome) {
        return outcome.status() == 503 && !isDeadlineStop(outcome);
    }
}
