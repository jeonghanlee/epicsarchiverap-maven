package org.epics.archiverappliance.retrieval;

import com.sun.net.httpserver.HttpServer;
import jdk.jfr.consumer.RecordingFile;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.lang.management.ThreadMXBean;
import javax.management.ObjectName;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.junit.jupiter.api.Assertions.*;

/** Delays transport of an actual appliance response while the front-end's original deadline expires. */
@Tag("integration")
class RetrievalFrontSnapshotDeadlineNetworkTest {
    private static final Duration RESPONSE_BOUND = Duration.ofSeconds(5);
    private static final Duration RECOVERY_BOUND = Duration.ofSeconds(30);
    private static final Duration CLIENT_TIMEOUT = Duration.ofSeconds(15);
    private static final Duration HOLD_LIMIT = Duration.ofSeconds(10);
    private static final String DEADLINE = "Retrieval request deadline exceeded";

    private static final class ResponseDelay implements AutoCloseable {
        final Path evidence;
        final Path appliances;
        final HttpServer proxy;
        final HttpClient client = HttpClient.newHttpClient();
        final java.util.concurrent.ExecutorService executor = Executors.newCachedThreadPool();
        final CountDownLatch held = new CountDownLatch(1);
        final CountDownLatch release = new CountDownLatch(1);
        volatile boolean armed;
        volatile boolean expired;
        volatile int backendStatus;

        ResponseDelay(Path evidence) throws Exception {
            this.evidence = evidence;
            proxy = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            proxy.setExecutor(executor);
            proxy.createContext("/", exchange -> {
                try {
                    byte[] request = exchange.getRequestBody().readAllBytes();
                    URI backend = URI.create("http://127.0.0.1:" + ConfigServiceForTests.RETRIEVAL_TEST_PORT
                            + exchange.getRequestURI());
                    var builder = HttpRequest.newBuilder(backend).timeout(CLIENT_TIMEOUT)
                            .method(exchange.getRequestMethod(), HttpRequest.BodyPublishers.ofByteArray(request));
                    String requestType = exchange.getRequestHeaders().getFirst("Content-Type");
                    if (requestType != null) builder.header("Content-Type", requestType);
                    var response = client.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
                    boolean delay = armed && exchange.getRequestURI().getPath()
                            .endsWith("getDataAtTimeForAppliance");
                    if (delay) {
                        backendStatus = response.statusCode();
                        Files.write(evidence.resolve("backend-response.json"), response.body());
                        record("HOLD status=" + backendStatus + " sha256=" + HexFormat.of().formatHex(
                                MessageDigest.getInstance("SHA-256").digest(response.body())));
                        held.countDown();
                        expired = !release.await(HOLD_LIMIT.toNanos(), TimeUnit.NANOSECONDS);
                        record(expired ? "EXPIRED" : "RELEASE");
                    }
                    response.headers().firstValue("Content-Type").ifPresent(value ->
                            exchange.getResponseHeaders().set("Content-Type", value));
                    exchange.sendResponseHeaders(response.statusCode(), response.body().length);
                    try (var output = exchange.getResponseBody()) { output.write(response.body()); }
                    if (delay) record("DELIVERED");
                } catch (Exception failure) {
                    record("TRANSPORT " + failure);
                } finally {
                    exchange.close();
                }
            });
            var document = javax.xml.parsers.DocumentBuilderFactory.newInstance().newDocumentBuilder()
                    .parse(Path.of("src/sitespecific/tests/classpathfiles/appliances.xml").toFile());
            document.getElementsByTagName("retrieval_url").item(0).setTextContent(
                    "http://127.0.0.1:" + proxy.getAddress().getPort() + "/retrieval/bpl");
            appliances = evidence.resolve("appliances.xml");
            javax.xml.transform.TransformerFactory.newInstance().newTransformer().transform(
                    new javax.xml.transform.dom.DOMSource(document),
                    new javax.xml.transform.stream.StreamResult(appliances.toFile()));
            proxy.start();
        }

        synchronized void record(String value) throws java.io.IOException {
            Files.writeString(evidence.resolve("transport.txt"), System.nanoTime() + " " + value + "\n",
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        }

        @Override public void close() throws Exception {
            release.countDown();
            proxy.stop(0);
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));
            client.close();
        }
    }

    private record Waiting(int frontend, int fanout, int stores, String stacks) {}

    private static Waiting waiting(ThreadMXBean bean) {
        int frontend = 0, fanout = 0, stores = 0;
        var stacks = new StringBuilder();
        for (var thread : bean.dumpAllThreads(false, false)) {
            boolean selected = false;
            for (var frame : thread.getStackTrace()) {
                if (!frame.getClassName().equals(GetDataAtTime.class.getName())) continue;
                switch (frame.getMethodName()) {
                    case "getDataAtTime" -> frontend++;
                    case "getDataFromRetrieval" -> fanout++;
                    case "readDataAtTimeForPVFromStores" -> stores++;
                    default -> { }
                }
                selected = true;
            }
            if (selected) {
                stacks.append("thread=").append(thread.getThreadId()).append('\n');
                for (var frame : thread.getStackTrace()) stacks.append("  ").append(frame).append('\n');
            }
        }
        return new Waiting(frontend, fanout, stores, stacks.toString());
    }

    private static HttpRequest normalRequest() {
        URI uri = URI.create(ConfigServiceForTests.DATA_RETRIEVAL_URL + "/data/getDataAtTime?at="
                + RetrievalMemoryNetworkFixture.encode(
                        RetrievalMemoryNetworkFixture.FROM.plusSeconds(1800).toString()) + "&searchPeriod=P1D");
        return HttpRequest.newBuilder(uri).timeout(CLIENT_TIMEOUT)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString("pv="
                        + RetrievalMemoryNetworkFixture.encode(RetrievalMemoryNetworkFixture.PV))).build();
    }

    private static void normal(HttpResponse<String> response) {
        assertEquals(200, response.statusCode(), response.body());
        JSONObject body = assertInstanceOf(JSONObject.class, JSONValue.parse(response.body()));
        JSONObject sample = assertInstanceOf(JSONObject.class, body.get(RetrievalMemoryNetworkFixture.PV));
        assertEquals(RetrievalMemoryNetworkFixture.FROM.plusSeconds(1800).getEpochSecond(),
                ((Number) sample.get("secs")).longValue());
    }

    @Test void deadlineStopsFrontendAndHttpWaitBeforeDelayedResponseIsReleased() throws Exception {
        Path evidence = Path.of("target", "memory-network", "FrontDeadline-" + UUID.randomUUID()).toAbsolutePath();
        Files.createDirectories(evidence);
        Path recording = evidence.resolve("exceptions.jfr");
        boolean timely = false, quiescentWhileHeld = false;
        HttpResponse<String> finalResponse;
        try (var delay = new ResponseDelay(evidence)) {
            String previous = System.getProperty(ConfigService.ARCHAPPL_APPLIANCES);
            RetrievalMemoryNetworkFixture server;
            System.setProperty(ConfigService.ARCHAPPL_APPLIANCES, delay.appliances.toString());
            try {
                server = new RetrievalMemoryNetworkFixture(60,
                        "-Darchappl.valve.stuckThresholdSeconds=1", "-Darchappl.valve.interruptThresholdSeconds=1",
                        "-XX:StartFlightRecording=filename=" + recording + ",settings="
                                + Path.of("src/test/resources/retrieval-interrupt.jfc").toAbsolutePath()
                                + ",dumponexit=true,maxsize=64m");
            } finally {
                if (previous == null) System.clearProperty(ConfigService.ARCHAPPL_APPLIANCES);
                else System.setProperty(ConfigService.ARCHAPPL_APPLIANCES, previous);
            }
            Files.writeString(evidence.resolve("fixture.txt"), server.evidence.toString());
            try (server) {
                var baseline = server.client.send(normalRequest(), HttpResponse.BodyHandlers.ofString());
                Files.writeString(evidence.resolve("baseline.json"), baseline.body());
                normal(baseline);
                assertTrue(server.tomcat.consoleLines("appliance0").stream()
                        .anyMatch(line -> line.contains("Retrieval HTTP deadline: 1000 ms")));
                var connection = server.connector.getMBeanServerConnection();
                var runtime = ManagementFactory.newPlatformMXBeanProxy(connection,
                        ManagementFactory.RUNTIME_MXBEAN_NAME, RuntimeMXBean.class);
                assertEquals("1", runtime.getSystemProperties().get("archappl.valve.interruptThresholdSeconds"));
                Object background = connection.getAttribute(new ObjectName("Catalina:type=Engine"),
                        "backgroundProcessorDelay");
                Files.writeString(evidence.resolve("deadline-settings.txt"), "interruptThresholdSeconds=1\n"
                        + "backgroundProcessorDelay=" + background + "\noptions=" + runtime.getInputArguments() + "\n");
                assertEquals(60, ((Number) background).intValue());
                var bean = ManagementFactory.newPlatformMXBeanProxy(connection,
                        ManagementFactory.THREAD_MXBEAN_NAME, ThreadMXBean.class);
                delay.armed = true;
                long started = System.nanoTime();
                var pending = server.client.sendAsync(normalRequest(), HttpResponse.BodyHandlers.ofString());
                try {
                    assertTrue(delay.held.await(2, TimeUnit.SECONDS), "Incomplete real response-delay exposure");
                    assertEquals(200, delay.backendStatus, "The subordinate request must complete normally");
                    Waiting active = waiting(bean);
                    Files.writeString(evidence.resolve("active-stacks.txt"), active.toString());
                    assertTrue(active.frontend() >= 1 && active.fanout() >= 1,
                            "Both the actual front-end and its subordinate HTTP call must be waiting");
                    long remaining = started + RESPONSE_BOUND.toNanos() - System.nanoTime();
                    try {
                        pending.get(Math.max(1, remaining), TimeUnit.NANOSECONDS);
                        timely = System.nanoTime() - started < RESPONSE_BOUND.toNanos();
                    } catch (TimeoutException expected) {
                        Files.writeString(evidence.resolve("response-bound.txt"), "No front-end response within five seconds\n");
                    }
                    Waiting heldState = waiting(bean);
                    quiescentWhileHeld = heldState.frontend() == 0 && heldState.fanout() == 0 && heldState.stores() == 0;
                    Files.writeString(evidence.resolve("before-release.txt"), "elapsedNanos="
                            + (System.nanoTime() - started) + "\ntimely=" + timely
                            + "\nheap=" + server.memory.getHeapMemoryUsage()
                            + "\ncollectionUsage=" + server.oldPool.getCollectionUsage() + "\n" + heldState + "\n");
                } finally {
                    delay.armed = false;
                    delay.record("CLIENT_RELEASE");
                    delay.release.countDown();
                }
                finalResponse = pending.get(CLIENT_TIMEOUT.toNanos(), TimeUnit.NANOSECONDS);
                Files.writeString(evidence.resolve("client-response.txt"), "elapsedNanos="
                        + (System.nanoTime() - started) + "\nstatus=" + finalResponse.statusCode()
                        + "\nbody=" + finalResponse.body() + "\n");
                long recoverBy = System.nanoTime() + RECOVERY_BOUND.toNanos();
                Waiting ended;
                do {
                    ended = waiting(bean);
                    if (ended.frontend() == 0 && ended.fanout() == 0 && ended.stores() == 0) break;
                    Thread.sleep(20);
                } while (System.nanoTime() < recoverBy);
                Files.writeString(evidence.resolve("terminal.txt"), "observed=" + java.time.Instant.now()
                        + "\nserverExitStatus=" + server.tomcat.exitStatus("appliance0")
                        + "\npending=" + !pending.isDone() + "\n" + ended + "\n");
                assertEquals(0, ended.frontend() + ended.fanout() + ended.stores());
                var recovered = server.client.send(normalRequest(), HttpResponse.BodyHandlers.ofString());
                Files.writeString(evidence.resolve("recovery.json"), recovered.body());
                normal(recovered);
                assertFalse(delay.expired, "Expired transport holds cannot establish the intended exposure");
                assertNull(server.tomcat.exitStatus("appliance0"));
            }
        }
        var deadlines = new ArrayList<String>();
        var memoryRejections = new ArrayList<String>();
        try (var events = new RecordingFile(recording)) {
            while (events.hasMoreEvents()) {
                var event = events.readEvent();
                if (event.getEventType().getName().equals("jdk.JavaExceptionThrow")
                        && event.getClass("thrownClass").getName().equals(RetrievalMemoryProtection.Rejected.class.getName())
                        ) {
                    if (DEADLINE.equals(event.getString("message"))) deadlines.add(event.toString());
                    else memoryRejections.add(event.toString());
                }
            }
        }
        Files.write(evidence.resolve("deadline-exceptions.txt"), deadlines);
        Files.write(evidence.resolve("other-rejections.txt"), memoryRejections);
        boolean timelyResult = timely, quiescentResult = quiescentWhileHeld;
        assertAll(
                () -> assertFalse(deadlines.isEmpty(), "The actual deadline check must run"),
                () -> assertTrue(memoryRejections.isEmpty(), "Another rejection must not mask the deadline"),
                () -> assertEquals(503, finalResponse.statusCode(), finalResponse.body()),
                () -> assertTrue(finalResponse.body().contains(DEADLINE), finalResponse.body()),
                () -> assertTrue(timelyResult, "The front-end must report its deadline within five seconds while HTTP response transport is held"),
                () -> assertTrue(quiescentResult, "The front-end HTTP wait must stop before the delayed response is released"));
    }
}
