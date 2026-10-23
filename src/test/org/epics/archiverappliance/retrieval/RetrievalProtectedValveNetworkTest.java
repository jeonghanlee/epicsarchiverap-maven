package org.epics.archiverappliance.retrieval;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.time.Duration;
import java.util.ArrayList;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import javax.management.ObjectName;

import static org.junit.jupiter.api.Assertions.*;

/** Verifies HTTP deadlines independently of valve ticks and after a consumed socket-write interrupt. */
@Tag("integration")
public class RetrievalProtectedValveNetworkTest {
    private static final int CONCURRENCY = 2;
    private static final int REQUESTS = 5;
    private static final long STOP_MILLIS = 5000;
    private record Outcome(int status, long millis, String message) {}

    private static RetrievalMemoryNetworkFixture server() throws Exception {
        return server(1);
    }

    private static RetrievalMemoryNetworkFixture server(int backgroundSeconds) throws Exception {
        var options = new ArrayList<String>(java.util.List.of(
                "-Xms4g", "-Xmx4g",
                "-Darchappl.valve.concurrency=" + CONCURRENCY,
                "-Darchappl.valve.stuckThresholdSeconds=1",
                "-Darchappl.valve.interruptThresholdSeconds=1"));
        var recording = java.nio.file.Path.of("target", "memory-network",
                "valve-exceptions-" + java.util.UUID.randomUUID() + ".jfr").toAbsolutePath();
        Files.createDirectories(recording.getParent());
        options.add("-XX:StartFlightRecording=filename=" + recording
                + ",settings=" + java.nio.file.Path.of("src/test/resources/retrieval-interrupt.jfc").toAbsolutePath()
                + ",dumponexit=true,maxsize=64m");
        var server = new RetrievalMemoryNetworkFixture(backgroundSeconds, options.toArray(String[]::new));
        try {
            Files.writeString(server.evidence.resolve("exception-recording.txt"), recording.toString());
            var connection = server.connector.getMBeanServerConnection();
            var valves = connection.queryNames(new ObjectName(
                    "Catalina:type=Valve,host=localhost,context=/retrieval,name=StuckThreadDetectionValve"), null);
            assertEquals(1, valves.size());
            ObjectName valve = valves.iterator().next();
            assertEquals(1, ((Number) connection.getAttribute(valve, "threshold")).intValue());
            var runtime = java.lang.management.ManagementFactory.newPlatformMXBeanProxy(connection,
                    java.lang.management.ManagementFactory.RUNTIME_MXBEAN_NAME,
                    java.lang.management.RuntimeMXBean.class);
            String interruptSetting = runtime.getSystemProperties().get("archappl.valve.interruptThresholdSeconds");
            assertEquals("1", interruptSetting);
            var war = java.nio.file.Path.of(System.getProperty("archappl.war.dir", "target"),
                    System.getProperty("archappl.final.name") + "-retrieval.war");
            try (var archive = new java.util.zip.ZipFile(war.toFile());
                    var input = archive.getInputStream(archive.getEntry("META-INF/context.xml"))) {
                var document = javax.xml.parsers.DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(input);
                var declarations = document.getElementsByTagName("Valve");
                String declaredInterrupt = null;
                for (int i = 0; i < declarations.getLength(); i++) {
                    var declaration = (org.w3c.dom.Element) declarations.item(i);
                    if (declaration.getAttribute("className").equals(
                            "org.apache.catalina.valves.StuckThreadDetectionValve")) {
                        declaredInterrupt = declaration.getAttribute("interruptThreadThreshold");
                    }
                }
                assertEquals("${archappl.valve.interruptThresholdSeconds:-900}", declaredInterrupt);
                Files.writeString(server.evidence.resolve("deadline-settings.txt"),
                        "thresholdJmx=1\ninterruptSystemProperty=" + interruptSetting
                                + "\ninterruptWarDeclaration=" + declaredInterrupt + "\n");
            }
            assertTrue(server.tomcat.consoleLines("appliance0").stream()
                    .anyMatch(line -> line.contains("Retrieval HTTP deadline: 1000 ms")));
            return server;
        } catch (Exception | AssertionError failure) {
            try { server.close(); } catch (Exception cleanup) { failure.addSuppressed(cleanup); }
            throw failure;
        }
    }

    @Test
    public void overloadAndDeadlineReachTheProtectionCheckBeforeValveTick() throws Exception {
        try (var server = server(60)) {
            var connection = server.connector.getMBeanServerConnection();
            for (String context : new String[] {"/mgmt", "/retrieval"}) {
                var valves = connection.queryNames(new ObjectName(
                        "Catalina:type=Valve,host=localhost,context=" + context + ",name=SemaphoreValve"), null);
                assertEquals(1, valves.size());
                assertEquals(CONCURRENCY, ((Number) connection.getAttribute(
                        valves.iterator().next(), "concurrency")).intValue());
            }
            var target = server.uri("mat", "optimized_1000000",
                    RetrievalMemoryNetworkFixture.FROM, RetrievalMemoryNetworkFixture.TO);
            long started = System.nanoTime();
            var pending = new ArrayList<CompletableFuture<Outcome>>();
            for (int i = 0; i < REQUESTS; i++) {
                pending.add(server.client.sendAsync(HttpRequest.newBuilder(target)
                                .timeout(Duration.ofSeconds(15)).GET().build(),
                                info -> info.statusCode() == 503 ? HttpResponse.BodySubscribers.ofString(
                                        java.nio.charset.StandardCharsets.UTF_8)
                                        : HttpResponse.BodySubscribers.replacing(""))
                        .handle((response, failure) -> new Outcome(failure == null ? response.statusCode() : -1,
                                (System.nanoTime() - started) / 1_000_000,
                                failure == null ? response.body() : failure.toString())));
            }
            CompletableFuture.allOf(pending.toArray(CompletableFuture[]::new)).get(20, TimeUnit.SECONDS);
            var outcomes = pending.stream().map(CompletableFuture::join).toList();
            Files.writeString(server.evidence.resolve("protected-valve-outcomes.txt"), outcomes + "\n");
            long valveRefusals = outcomes.stream().filter(result -> result.status() == 503
                    && !result.message().contains("Retrieval request deadline exceeded")
                    && result.millis() < 1000).count();
            assertEquals(REQUESTS - CONCURRENCY, valveRefusals, outcomes.toString());
            long interrupted = outcomes.stream().filter(result -> result.status() == 503
                    && result.message().contains("Retrieval request deadline exceeded")
                    && result.millis() < STOP_MILLIS).count();
            assertEquals(CONCURRENCY, interrupted, outcomes.toString());
            var console = server.tomcat.consoleLines("appliance0");
            assertFalse(console.stream().anyMatch(line -> line.contains("has been interrupted because")));
            assertTrue(console.stream().anyMatch(line -> line.contains("RetrievalMemoryProtection$Rejected")
                    && line.contains("Retrieval request deadline exceeded")));
            assertFalse(console.stream().anyMatch(line -> line.contains("Retrieval memory pressure:")
                    || line.contains("exceeds request budget") || line.contains("memory admission refused")));
            assertTrue(RetrievalMemoryNetworkFixture.hasData(server.get("json", "mean_60",
                    RetrievalMemoryNetworkFixture.FROM, RetrievalMemoryNetworkFixture.FROM.plusSeconds(3600))));
            assertNull(server.tomcat.exitStatus("appliance0"));
            System.out.println("T7 protected valve " + outcomes);
        }
    }

    @Test
    public void committedRawResponseEndsAsATransportFailureAfterInterrupt() throws Exception {
        committedResponse(1, true);
    }

    @Test
    public void committedRawResponseStopsAfterDeadlineWithoutValveInterrupt() throws Exception {
        committedResponse(60, false);
    }

    private void committedResponse(int backgroundSeconds, boolean requireInterrupt) throws Exception {
        var server = server(backgroundSeconds);
        try (server) {
            var target = server.uri("csv", "", RetrievalMemoryNetworkFixture.FROM, RetrievalMemoryNetworkFixture.TO);
            long started = System.nanoTime();
            var response = server.client.send(HttpRequest.newBuilder(target)
                    .timeout(Duration.ofSeconds(15)).GET().build(), HttpResponse.BodyHandlers.ofInputStream());
            assertEquals(200, response.statusCode());
            try (var body = response.body()) {
                assertTrue(body.read() >= 0, "A real body byte must arrive before the interrupt");
                long pausedUntil = System.nanoTime() + Duration.ofSeconds(3).toNanos();
                while (System.nanoTime() < pausedUntil) Thread.sleep(20);
                boolean interrupted = server.tomcat.consoleLines("appliance0").stream()
                        .anyMatch(line -> line.contains("has been interrupted because"));
                assertEquals(requireInterrupt, interrupted, "The valve exposure must match this case");
                long resumed = System.nanoTime();
                var drain = CompletableFuture.supplyAsync(() -> {
                    try {
                        return "complete bytes=" + body.transferTo(java.io.OutputStream.nullOutputStream());
                    } catch (IOException failure) {
                        return "failure=" + failure;
                    }
                });
                String outcome = drain.get(10, TimeUnit.SECONDS);
                long elapsed = (System.nanoTime() - started) / 1_000_000;
                Files.writeString(server.evidence.resolve("committed-valve-outcome.txt"),
                        "status=" + response.statusCode() + " elapsedMillis=" + elapsed
                                + " resumedMillis=" + (System.nanoTime() - resumed) / 1_000_000
                                + " valveInterrupted=" + interrupted + " " + outcome + "\n");
                assertTrue(outcome.startsWith("failure="), outcome);
                assertTrue(elapsed < STOP_MILLIS, "The interrupted response must stop within the declared window");
                var console = server.tomcat.consoleLines("appliance0");
                assertTrue(console.stream().anyMatch(line -> line.contains("RetrievalMemoryProtection$Rejected")
                        && line.contains("Retrieval request deadline exceeded")));
                assertFalse(console.stream().anyMatch(line -> line.contains("Retrieval memory pressure:")
                        || line.contains("exceeds request budget") || line.contains("memory admission refused")));
                assertTrue(RetrievalMemoryNetworkFixture.hasData(server.get("json", "mean_60",
                        RetrievalMemoryNetworkFixture.FROM, RetrievalMemoryNetworkFixture.FROM.plusSeconds(3600))));
                assertNull(server.tomcat.exitStatus("appliance0"));
                System.out.println("T7 committed valve elapsedMillis=" + elapsed + " " + outcome);
            }
        }
        assertCommittedExceptions(server.evidence, requireInterrupt);
    }

    private static void assertCommittedExceptions(java.nio.file.Path evidence, boolean requireInterrupt)
            throws IOException {
        var recording = java.nio.file.Path.of(Files.readString(evidence.resolve("exception-recording.txt")));
        var deadlines = new java.util.HashMap<Long, java.time.Instant>();
        var aborts = new java.util.HashMap<Long, java.time.Instant>();
        var consumedInterrupts = new java.util.HashMap<Long, java.time.Instant>();
        try (var events = new jdk.jfr.consumer.RecordingFile(recording)) {
            while (events.hasMoreEvents()) {
                var event = events.readEvent();
                if (!event.getEventType().getName().equals("jdk.JavaExceptionThrow")) continue;
                var stack = event.getStackTrace();
                if (stack == null) continue;
                long thread = event.getThread().getJavaThreadId();
                String exception = event.getClass("thrownClass").getName();
                String message = event.getString("message");
                if (exception.equals(RetrievalMemoryProtection.Rejected.class.getName())
                        && "Retrieval request deadline exceeded".equals(message)) {
                    deadlines.putIfAbsent(thread, event.getStartTime());
                }
                if (exception.equals("java.io.IOException") && "Retrieval response interrupted".equals(message)
                        && stack.getFrames().stream().anyMatch(frame -> frame.getMethod().getName().equals("respondToFailure")
                        && frame.getMethod().getType().getName().equals(DataRetrievalServlet.class.getName()))) {
                    aborts.putIfAbsent(thread, event.getStartTime());
                }
                if (exception.equals("java.lang.InterruptedException")
                        && stack.getFrames().stream().anyMatch(frame -> frame.getMethod().getName().equals("doWrite")
                        && frame.getMethod().getType().getName().equals(
                                "org.apache.tomcat.util.net.NioEndpoint$NioSocketWrapper"))) {
                    consumedInterrupts.putIfAbsent(thread, event.getStartTime());
                }
            }
        }
        Files.writeString(evidence.resolve("committed-exceptions.txt"), "deadlines=" + deadlines
                + "\naborts=" + aborts + "\nconsumedInterrupts=" + consumedInterrupts + "\n");
        assertTrue(deadlines.entrySet().stream().anyMatch(entry -> {
            var abort = aborts.get(entry.getKey());
            var consumed = consumedInterrupts.get(entry.getKey());
            return abort != null && !abort.isBefore(entry.getValue())
                    && (!requireInterrupt || consumed != null && !consumed.isAfter(entry.getValue()));
        }), "The same request must reject its deadline and abort; the interrupt case must first consume a write interrupt");
    }
}
