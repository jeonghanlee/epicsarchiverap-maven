package org.epics.archiverappliance.retrieval;

import com.sun.management.HotSpotDiagnosticMXBean;
import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import javax.management.remote.JMXConnector;
import javax.management.remote.JMXConnectorFactory;
import javax.management.remote.JMXServiceURL;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryPoolMXBean;
import java.lang.management.RuntimeMXBean;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.ArrayList;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;

/** Measures and verifies memory protection through the built WARs on a fixture-owned JVM. */
@Tag("integration")
public class RetrievalMemoryNetworkTest {
    private static final String APPLIANCE = "appliance0";
    private static final String HEAP = System.getProperty("archappl.memory.test.heap", "512m");
    private static final String GC_OPTIONS = System.getProperty("archappl.memory.test.gc", "-XX:+UseG1GC");
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);

    private record LoadOutcome(int status, long millis, String failure) {}

    @Test
    public void concurrentAccumulationStopsUnderPressureAndRecovers() throws Exception {
        try (var server = new RetrievalMemoryNetworkFixture()) {
            long maximum = server.memory.getHeapMemoryUsage().getMax();
            long seconds = Math.min(Duration.between(RetrievalMemoryNetworkFixture.FROM,
                    RetrievalMemoryNetworkFixture.TO).getSeconds(), (long) (maximum * .16 / 112) - 2);
            int count = Integer.getInteger("archappl.memory.test.concurrency", 8);
            var from = RetrievalMemoryNetworkFixture.FROM;
            var to = from.plusSeconds(seconds);
            var target = server.uri("json", "mean_1", from, to);
            List<CompletableFuture<LoadOutcome>> pending = new ArrayList<>();
            List<String> samples = new ArrayList<>();
            samples.add("elapsedNanos,heapUsed,collectedUsed,busy,pending");
            long started = System.nanoTime();
            String parameters = "uri=" + target + "\nrequests=" + count + "\nmaxHeap=" + maximum + "\n";
            Files.writeString(server.evidence.resolve("pressure-inputs.txt"), parameters);
            for (int i = 0; i < count; i++) {
                pending.add(server.client.sendAsync(HttpRequest.newBuilder(target)
                                .timeout(RetrievalMemoryNetworkFixture.TIMEOUT).GET().build(),
                                HttpResponse.BodyHandlers.discarding())
                        .handle((response, failure) -> new LoadOutcome(failure == null ? response.statusCode() : -1,
                                (System.nanoTime() - started) / 1_000_000,
                                failure == null ? "" : failure.toString())));
            }
            int maximumBusy = 0;
            boolean admissionRefused = false;
            long peak = 0;
            try {
                while (!pending.stream().allMatch(CompletableFuture::isDone)) {
                    long heap = server.memory.getHeapMemoryUsage().getUsed();
                    long collected = server.oldPool.getCollectionUsage().getUsed();
                    int busy = server.tomcat.currentThreadsBusy(APPLIANCE);
                    maximumBusy = Math.max(maximumBusy, busy);
                    peak = Math.max(peak, heap);
                    samples.add((System.nanoTime() - started) + "," + heap + "," + collected + "," + busy + ","
                            + pending.stream().filter(future -> !future.isDone()).count());
                    if (!admissionRefused && collected > maximum * .50) {
                        var probe = server.get("json", "mean_60", from, from.plusSeconds(3600));
                        Files.writeString(server.evidence.resolve("admission-probe.txt"),
                                probe.statusCode() + "\n" + probe.body());
                        admissionRefused = probe.statusCode() == 503 && probe.body().contains("memory admission");
                    }
                    assertNull(server.tomcat.exitStatus(APPLIANCE), "The server must survive pressure");
                    assertTrue(System.nanoTime() - started < Duration.ofSeconds(130).toNanos(),
                            "The concurrent requests exceeded their deadline");
                    Thread.sleep(20);
                }
            } finally {
                Files.write(server.evidence.resolve("memory.csv"), samples);
            }
            List<LoadOutcome> outcomes = pending.stream().map(CompletableFuture::join).toList();
            Files.writeString(server.evidence.resolve("outcomes.txt"), outcomes + "\n");
            System.out.println("T7 pressure " + parameters + "maxBusy=" + maximumBusy + " peak=" + peak
                    + " headroom=" + (maximum - peak) + " admissionRefused=" + admissionRefused + " " + outcomes);
            assertTrue(maximumBusy >= 2, "The real HTTP requests must overlap");
            assertTrue(server.tomcat.consoleLines(APPLIANCE).stream()
                    .anyMatch(line -> line.contains("Retrieval memory pressure:")),
                    "Incomplete pressure exposure: no production pressure rejection was observed");
            assertTrue(outcomes.stream().anyMatch(result -> result.status() == -1 || result.status() == 503),
                    "A pressure rejection must reach the client as a failure");
            assertTrue(outcomes.stream().noneMatch(result -> result.status() == 400),
                    "The workload must fit the declared budget");
            long recoverBy = System.nanoTime() + Duration.ofSeconds(30).toNanos();
            HttpResponse<String> normal;
            do {
                normal = server.get("json", "mean_60", from, from.plusSeconds(3600));
                if (RetrievalMemoryNetworkFixture.hasData(normal)) break;
                Thread.sleep(100);
            } while (System.nanoTime() < recoverBy);
            Files.writeString(server.evidence.resolve("recovery.json"), normal.body());
            assertTrue(RetrievalMemoryNetworkFixture.hasData(normal), normal.body());
            assertNull(server.tomcat.exitStatus(APPLIANCE));
        }
    }

    @Test
    public void oversizedRequestsAreRefusedBeforeAllocationAndNormalRequestsRecover() throws Exception {
        try (var server = new RetrievalMemoryNetworkFixture()) {
            for (String format : List.of("json", "csv", "txt", "svg", "mat", "raw", "flx", "jplot", "qw")) {
                for (String processor : List.of("optimized_2147483647", "optimLastSample_2147483647")) {
                    var response = server.get(format, processor, RetrievalMemoryNetworkFixture.FROM,
                            RetrievalMemoryNetworkFixture.FROM.plusSeconds(3600));
                    assertEquals(400, response.statusCode(), format + " " + processor + " " + response.body());
                    assertTrue(response.body().contains("budget"), response.body());
                    System.out.println("T7 declared refusal format=" + format + " processor=" + processor
                            + " status=" + response.statusCode());
                }
            }
            var normal = server.get("json", "mean_60", RetrievalMemoryNetworkFixture.FROM,
                    RetrievalMemoryNetworkFixture.FROM.plusSeconds(3600));
            assertTrue(RetrievalMemoryNetworkFixture.hasData(normal), normal.body());
            assertNull(server.tomcat.exitStatus(APPLIANCE));
        }
    }

    @Test
    public void baselineReportsRealServerHeapAndCollector() throws Exception {
        String name = "MemoryNetwork-" + UUID.randomUUID();
        Path evidence = Path.of("target", "memory-network", name).toAbsolutePath();
        Files.createDirectories(evidence);
        TomcatSetup fixture = new TomcatSetup().withProductionConfig().withJmx().withJvmOptions(
                "-Xms" + HEAP, "-Xmx" + HEAP,
                "-XX:+ExitOnOutOfMemoryError", "-XX:+HeapDumpOnOutOfMemoryError",
                "-XX:HeapDumpPath=" + evidence,
                "-Xlog:gc*:file=" + evidence.resolve("gc.log") + ":time,uptime");
        fixture.withJvmOptions(GC_OPTIONS.trim().split("\\s+"));
        try {
            fixture.setUpWebApps(name);
            JMXServiceURL address = new JMXServiceURL("service:jmx:rmi:///jndi/rmi://127.0.0.1:"
                    + fixture.jmxPort(APPLIANCE) + "/jmxrmi");
            try (JMXConnector connector = JMXConnectorFactory.connect(address)) {
                var connection = connector.getMBeanServerConnection();
                RuntimeMXBean runtime = ManagementFactory.newPlatformMXBeanProxy(
                        connection, ManagementFactory.RUNTIME_MXBEAN_NAME, RuntimeMXBean.class);
                MemoryMXBean memory = ManagementFactory.newPlatformMXBeanProxy(
                        connection, ManagementFactory.MEMORY_MXBEAN_NAME, MemoryMXBean.class);
                List<MemoryPoolMXBean> pools = ManagementFactory.getPlatformMXBeans(connection, MemoryPoolMXBean.class);
                HotSpotDiagnosticMXBean diagnostic = ManagementFactory.newPlatformMXBeanProxy(
                        connection, "com.sun.management:type=HotSpotDiagnostic", HotSpotDiagnosticMXBean.class);
                StringBuilder report = new StringBuilder();
                report.append("runtime=").append(runtime.getVmVersion()).append('\n');
                report.append("pid=").append(runtime.getPid()).append('\n');
                report.append("options=").append(runtime.getInputArguments()).append('\n');
                report.append("heapBefore=").append(memory.getHeapMemoryUsage()).append('\n');
                memory.gc();
                report.append("heapAfter=").append(memory.getHeapMemoryUsage()).append('\n');
                for (MemoryPoolMXBean pool : pools) {
                    report.append("pool=").append(pool.getName())
                            .append(" usageThresholdSupported=").append(pool.isUsageThresholdSupported())
                            .append(" collectionThresholdSupported=").append(pool.isCollectionUsageThresholdSupported())
                            .append(" usage=").append(pool.getUsage())
                            .append(" collectionUsage=").append(pool.getCollectionUsage()).append('\n');
                }
                for (String option : List.of("MaxHeapSize", "UseG1GC", "UseZGC", "ZGenerational", "G1ReservePercent",
                        "G1UseAdaptiveIHOP", "ExplicitGCInvokesConcurrent", "DisableExplicitGC", "SoftMaxHeapSize")) {
                    report.append(option).append('=').append(diagnostic.getVMOption(option).getValue()).append('\n');
                }
                Files.writeString(evidence.resolve("baseline.txt"), report);
                System.out.println("T7 baseline " + evidence + "\n" + report);
                assertTrue(memory.getHeapMemoryUsage().getMax() > 0);
                assertFalse(pools.isEmpty());
            }
            try (HttpClient client = HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build()) {
                HttpResponse<String> response = client.send(HttpRequest.newBuilder(
                                URI.create(ConfigServiceForTests.DATA_RETRIEVAL_URL + "/ping"))
                        .timeout(REQUEST_TIMEOUT).GET().build(), HttpResponse.BodyHandlers.ofString());
                assertEquals(200, response.statusCode(), response.body());
                assertNull(fixture.exitStatus(APPLIANCE), "The baseline JVM must still answer");
            }
        } finally {
            try {
                fixture.tearDown();
            } finally {
                Files.write(evidence.resolve("console.log"), fixture.consoleLines(APPLIANCE));
            }
        }
    }
}
