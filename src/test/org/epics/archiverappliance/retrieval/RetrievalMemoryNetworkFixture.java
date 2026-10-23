package org.epics.archiverappliance.retrieval;

import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.utils.ui.JSONEncoder;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

import javax.management.remote.JMXConnector;
import javax.management.remote.JMXConnectorFactory;
import javax.management.remote.JMXServiceURL;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryPoolMXBean;
import java.lang.management.RuntimeMXBean;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** External HTTP/JMX clients and generated PB input for the production startup and retrieval paths. */
public final class RetrievalMemoryNetworkFixture implements AutoCloseable {
    public static final String PV = "MemoryQualification:SineV1";
    public static final Instant FROM = Instant.parse("2011-02-01T00:00:00Z");
    public static final Instant TO = FROM.plusSeconds(30L * 86400);
    public static final Duration TIMEOUT = Duration.ofSeconds(120);
    public final Path evidence;
    public final TomcatSetup tomcat;
    public final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    public JMXConnector connector;
    public MemoryMXBean memory;
    public MemoryPoolMXBean oldPool;
    public PbReadHold readHold;

    public RetrievalMemoryNetworkFixture(String... options) throws Exception {
        this(null, options);
    }

    public RetrievalMemoryNetworkFixture(Integer backgroundSeconds, String... options) throws Exception {
        String name = "MemoryRequests-" + UUID.randomUUID();
        evidence = Path.of("target", "memory-network", name).toAbsolutePath();
        Files.createDirectories(evidence);
        String heap = System.getProperty("archappl.memory.test.heap", "512m");
        tomcat = new TomcatSetup().withProductionConfig().withJmx().withJvmOptions(
                "-Xms" + heap, "-Xmx" + heap, "-XX:+ExitOnOutOfMemoryError",
                "-XX:+HeapDumpOnOutOfMemoryError", "-XX:HeapDumpPath=" + evidence,
                "-Xlog:gc*:file=" + evidence.resolve("gc.log") + ":time,uptime");
        tomcat.withJvmOptions(System.getProperty("archappl.memory.test.gc", "-XX:+UseG1GC").trim().split("\\s+"));
        tomcat.withJvmOptions(options);
        if (backgroundSeconds != null) tomcat.withEngineBackgroundProcessorDelay(backgroundSeconds);
        try {
            GenerateData.generateSineForPV(PV, 0, ArchDBRTypes.DBR_SCALAR_DOUBLE, FROM, TO);
            if (Boolean.getBoolean("archappl.memory.test.pvaReadHold")) {
                readHold = new PbReadHold(evidence, Path.of(ConfigServiceForTests.getDefaultPBTestFolder(),
                        "MemoryQualification", "SineV1:2011.pb"));
                tomcat.withEnvironment(readHold.environment());
            }
            tomcat.setUpWebApps(name);
            assertTrue(tomcat.consoleLines("appliance0").stream()
                    .anyMatch(line -> line.contains("Retrieval memory protection enabled:")),
                    "The built WAR must activate memory protection at startup");
            connector = JMXConnectorFactory.connect(new JMXServiceURL(
                    "service:jmx:rmi:///jndi/rmi://127.0.0.1:" + tomcat.jmxPort("appliance0") + "/jmxrmi"));
            var connection = connector.getMBeanServerConnection();
            memory = ManagementFactory.newPlatformMXBeanProxy(
                    connection, ManagementFactory.MEMORY_MXBEAN_NAME, MemoryMXBean.class);
            oldPool = ManagementFactory.getPlatformMXBeans(connection, MemoryPoolMXBean.class).stream()
                    .filter(pool -> pool.getType() == java.lang.management.MemoryType.HEAP
                            && pool.isCollectionUsageThresholdSupported())
                    .max(java.util.Comparator.comparingLong(pool -> pool.getUsage().getMax())).orElseThrow();
            RuntimeMXBean runtime = ManagementFactory.newPlatformMXBeanProxy(
                    connection, ManagementFactory.RUNTIME_MXBEAN_NAME, RuntimeMXBean.class);
            Files.writeString(evidence.resolve("runtime.txt"), "runtime=" + runtime.getVmVersion()
                    + "\npid=" + runtime.getPid() + "\nstartedMillis=" + runtime.getStartTime()
                    + "\noptions=" + runtime.getInputArguments() + "\nheap=" + memory.getHeapMemoryUsage()
                    + "\npool=" + oldPool.getName() + "\ncollectionUsage=" + oldPool.getCollectionUsage() + "\n");
            PVTypeInfo info = new PVTypeInfo(PV, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
            info.setApplianceIdentity("appliance0");
            info.setPaused(true);
            info.setCreationTime(FROM);
            info.setModificationTime(Instant.now());
            info.setComputedEventRate(1);
            info.setComputedStorageRate(17);
            info.setComputedBytesPerEvent(17);
            info.setChunkKey(GenerateData.configService.getPVNameToKeyConverter().convertPVNameToKey(PV));
            info.setDataStores(new String[] {"pb://localhost?name=MTS&rootFolder="
                    + Path.of(ConfigServiceForTests.getDefaultPBTestFolder()).toAbsolutePath()
                    + "&partitionGranularity=PARTITION_YEAR"});
            String body = JSONEncoder.getEncoder(PVTypeInfo.class).encode(info).toJSONString();
            Files.writeString(evidence.resolve("type-info.json"), body);
            HttpResponse<String> registered = client.send(HttpRequest.newBuilder(URI.create(
                            ConfigServiceForTests.MGMT_URL + "/putPVTypeInfo?pv=" + encode(PV) + "&createnew=true"))
                    .timeout(TIMEOUT).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(200, registered.statusCode(), registered.body());
            JSONObject registration = (JSONObject) JSONValue.parse(registered.body());
            assertNotNull(registration, registered.body());
            assertFalse(registration.containsKey("error"), registered.body());
            long deadline = System.nanoTime() + Duration.ofSeconds(30).toNanos();
            HttpResponse<String> normal;
            do {
                normal = get("json", "mean_60", FROM, FROM.plusSeconds(3600));
                if (hasData(normal)) break;
                Thread.sleep(100);
            } while (System.nanoTime() < deadline);
            assertTrue(hasData(normal), "The real store must return generated data: " + normal.body());
            Files.writeString(evidence.resolve("normal.json"), normal.body());
            System.out.println("Memory network evidence " + evidence);
        } catch (Exception | AssertionError failure) {
            try { close(); } catch (Exception cleanup) { failure.addSuppressed(cleanup); }
            throw failure;
        }
    }

    public static String encode(String text) {
        return URLEncoder.encode(text, StandardCharsets.UTF_8);
    }

    public URI uri(String format, String processor, Instant from, Instant to) {
        return URI.create(ConfigServiceForTests.DATA_RETRIEVAL_URL + "/data/getData." + format
                + "?pv=" + encode(PV) + "&pp=" + encode(processor)
                + "&from=" + encode(TimeUtils.convertToISO8601String(from))
                + "&to=" + encode(TimeUtils.convertToISO8601String(to)));
    }

    public HttpResponse<String> get(String format, String processor, Instant from, Instant to) throws Exception {
        return client.send(HttpRequest.newBuilder(uri(format, processor, from, to))
                .timeout(TIMEOUT).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    public static boolean hasData(HttpResponse<String> response) {
        if (response.statusCode() != 200 || !(JSONValue.parse(response.body()) instanceof JSONArray rows)
                || rows.isEmpty()) return false;
        return ((JSONObject) rows.getFirst()).get("data") instanceof JSONArray data && !data.isEmpty();
    }

    @Override public void close() throws Exception {
        try {
            if (readHold != null) readHold.close();
            if (connector != null) connector.close();
        } finally {
            try {
                tomcat.tearDown();
            } finally {
                client.close();
                Files.write(evidence.resolve("console.log"), tomcat.consoleLines("appliance0"));
            }
        }
    }
}
