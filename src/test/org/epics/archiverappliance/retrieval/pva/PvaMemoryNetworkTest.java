package org.epics.archiverappliance.retrieval.pva;

import org.epics.archiverappliance.retrieval.RetrievalMemoryNetworkFixture;
import org.epics.pva.PVASettings;
import org.epics.pva.client.PVAClient;
import org.epics.pva.client.PVAChannel;
import org.epics.pva.data.PVAAnyArray;
import org.epics.pva.data.PVAStructure;
import org.epics.pva.data.PVAStructureArray;
import org.epics.pva.data.nt.PVAURI;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.net.DatagramSocket;
import java.nio.file.Files;
import java.util.Map;
import java.util.ArrayList;
import java.util.concurrent.CompletableFuture;
import java.lang.management.ManagementFactory;
import java.lang.management.ThreadMXBean;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Collections;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

/** Exercises RPC through the built retrieval WAR on an isolated discovery port. */
@Tag("integration")
public class PvaMemoryNetworkTest {
    /** Heap fraction the held pair aims at: the middle of the admission window between 0.50 and 0.60. */
    private static final double TARGET_FRACTION = Double.parseDouble(
            System.getProperty("archappl.memory.test.pvaAdmissionTargetFraction", "0.55"));
    private static final Pattern ADMISSION_REFUSAL = Pattern.compile(
            "Retrieval memory admission refused: collection usage (\\d+) exceeds threshold (\\d+)");

    private record AdmissionRefusal(long used, long threshold) {
        String message() {
            return "Retrieval memory admission refused: collection usage " + used
                    + " exceeds threshold " + threshold;
        }
    }

    private static final class ClientLog extends Handler implements AutoCloseable {
        private final List<String> records = new CopyOnWriteArrayList<>();
        private final Path evidence;
        private final Level previousLevel = PVASettings.logger.getLevel();

        ClientLog(Path evidence) {
            this.evidence = evidence;
            Level level = Level.parse(System.getProperty("archappl.memory.test.pvaClientLogLevel", "WARNING"));
            setLevel(level);
            PVASettings.logger.setLevel(level);
            PVASettings.logger.addHandler(this);
        }

        @Override public void publish(LogRecord record) {
            if (!isLoggable(record)) return;
            StringWriter rendered = new StringWriter();
            rendered.append(record.getInstant().toString()).append(" ")
                    .append(Long.toString(System.nanoTime())).append(" ")
                    .append(record.getLevel().toString()).append(" ")
                    .append(record.getLoggerName()).append(" ")
                    .append(record.getSourceClassName()).append(".").append(record.getSourceMethodName())
                    .append(" ").append(record.getMessage()).append("\n");
            if (record.getThrown() != null) record.getThrown().printStackTrace(new PrintWriter(rendered));
            records.add(rendered.toString());
        }

        int mark() { return records.size(); }

        boolean hasRefusal(int mark, String query, String condition) {
            return records.stream().skip(mark).anyMatch(record -> record.contains(query)
                    && record.contains(condition) && record.contains("RPCRequest.handleResponse"));
        }

        void assertRefusal(int mark, String query, String condition) {
            assertTrue(hasRefusal(mark, query, condition),
                    "The actual client exception must identify this RPC and refusal: " + records);
        }

        AdmissionRefusal admissionRefusal(int mark, String query) {
            return records.stream().skip(mark)
                    .filter(record -> record.contains(query) && record.contains("RPCRequest.handleResponse"))
                    .map(ADMISSION_REFUSAL::matcher).filter(matcher -> matcher.find())
                    .map(matcher -> new AdmissionRefusal(
                            Long.parseLong(matcher.group(1)), Long.parseLong(matcher.group(2))))
                    .findFirst().orElseThrow(() -> new AssertionError("Missing actual client admission values"));
        }

        @Override public void flush() { }

        @Override public void close() {
            PVASettings.logger.removeHandler(this);
            PVASettings.logger.setLevel(previousLevel);
            try {
                Files.write(evidence, records);
            } catch (java.io.IOException failure) {
                throw new java.io.UncheckedIOException(failure);
            }
        }
    }

    private record Answer(int records, String sha256) {}

    private static Answer answer(PVAStructure reply) throws Exception {
        PVAAnyArray values = reply.get("value");
        assertNotNull(values);
        assertEquals(1, values.get().length);
        PVAStructureArray data = values.get()[0].get();
        assertTrue(data.get().length > 0);
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        for (PVAStructure sample : data.get()) digest.update(sample.toString().getBytes(StandardCharsets.UTF_8));
        return new Answer(data.get().length, HexFormat.of().formatHex(digest.digest()));
    }

    private static List<java.lang.management.ThreadInfo> activeRequests(ThreadMXBean threads) {
        return java.util.Arrays.stream(threads.dumpAllThreads(false, false)).filter(thread ->
                java.util.Arrays.stream(thread.getStackTrace()).anyMatch(frame ->
                        frame.getClassName().equals(PvaGetPVData.class.getName()))).toList();
    }

    @Test
    public void twoFittingRequestsRefuseAThirdAndCompleteBeforeRecovery() throws Exception {
        withServer(true, (server, port) -> {
            Integer configuredSeconds = Integer.getInteger("archappl.memory.test.pvaAdmissionSeconds");
            // The held pair is a raw query: the raw path keeps one structure per event while the PB file is read, so
            // the read hold retains the pair's memory. A summary query such as mean_1 keeps only its bins during the
            // read and builds its structures after it, where no hold at the file boundary reaches them; the memory
            // admission itself does not depend on the query, and mean_1 stays available as an input.
            String processor = Boolean.parseBoolean(System.getProperty("archappl.memory.test.pvaRawAdmission", "true"))
                    ? "" : "mean_1";
            assertNotNull(server.readHold, "The admission case holds the PB readers of its requests");
            long maximum = server.memory.getHeapMemoryUsage().getMax();
            ThreadMXBean threads = ManagementFactory.newPlatformMXBeanProxy(server.connector.getMBeanServerConnection(),
                    ManagementFactory.THREAD_MXBEAN_NAME, ThreadMXBean.class);
            List<PVAClient> clients = new ArrayList<>();
            List<PVAChannel> channels = new ArrayList<>();
            List<List<String>> states = new ArrayList<>();
            List<Integer> connectedStates = new ArrayList<>();
            List<CompletableFuture<PVAStructure>> requests = new ArrayList<>();
            List<String> samples = Collections.synchronizedList(new ArrayList<>());
            samples.add("elapsedNanos,heapUsed,currentOld,collectedOld,activeRpcThreads,phase");
            List<String> outcomes = new ArrayList<>();
            List<String> stacks = Collections.synchronizedList(new ArrayList<>());
            AtomicReference<String> phase = new AtomicReference<>("connect");
            AtomicReference<Throwable> samplingFailure = new AtomicReference<>();
            var sampler = Executors.newSingleThreadScheduledExecutor();
            long started = System.nanoTime();
            try (var log = new ClientLog(server.evidence.resolve("pva-admission-client.log"))) {
                for (int i = 0; i < 3; i++) {
                    var client = new PVAClient();
                    clients.add(client);
                    List<String> state = new CopyOnWriteArrayList<>();
                    states.add(state);
                    var channel = client.getChannel(PvaDataRetrievalService.PVA_DATA_SERVICE,
                            (changed, value) -> state.add(java.time.Instant.now() + " " + value));
                    channels.add(channel);
                    assertTrue(channel.connect().get(30, TimeUnit.SECONDS));
                    assertData(channel);
                    connectedStates.add(state.size());
                }
                sampler.scheduleWithFixedDelay(() -> {
                    try {
                        var active = activeRequests(threads);
                        long elapsed = System.nanoTime() - started;
                        samples.add(elapsed + "," + server.memory.getHeapMemoryUsage().getUsed() + ","
                                + server.oldPool.getUsage().getUsed() + ","
                                + server.oldPool.getCollectionUsage().getUsed() + "," + active.size() + "," + phase.get());
                        if (stacks.size() < 6000) {
                            StringBuilder snapshot = new StringBuilder(elapsed + " " + phase.get() + "\n");
                            for (var thread : active) {
                                snapshot.append(thread.getThreadId()).append(' ').append(thread.getThreadName()).append('\n');
                                for (var frame : thread.getStackTrace()) snapshot.append("  ").append(frame).append('\n');
                            }
                            stacks.add(snapshot.toString());
                        }
                    } catch (Throwable failure) {
                        samplingFailure.compareAndSet(null, failure);
                    }
                }, 0, 50, TimeUnit.MILLISECONDS);

                // The pair is sized from this run: the old generation after collection before any load (baseline)
                // and the bytes one held answer retains per record, measured on a calibration request whose PB
                // reader is held after a fixed number of records. The target is the middle of the admission window.
                phase.set("calibration");
                server.memory.gc();
                long baseline = server.oldPool.getCollectionUsage().getUsed();
                int calibrationSeconds = Integer.getInteger("archappl.memory.test.pvaCalibrationSeconds", 60000);
                int calibrationRecords = calibrationSeconds * 5 / 6;
                server.readHold.holdAfterRecords(calibrationRecords);
                var calibration = channels.getFirst().invoke(load(processor, calibrationSeconds));
                long calibrationHeldBy = System.nanoTime() + Duration.ofSeconds(10).toNanos();
                while (server.readHold.heldReaders() != 1 && System.nanoTime() < calibrationHeldBy) Thread.sleep(10);
                assertEquals(1, server.readHold.heldReaders(), "The calibration PB reader must reach the hold");
                server.readHold.assertHealthy();
                server.memory.gc();
                long heldByOne = server.oldPool.getCollectionUsage().getUsed();
                server.readHold.release();
                assertEquals(calibrationSeconds + 1, answer(calibration.get(120, TimeUnit.SECONDS)).records(),
                        "Every one-second bin of the calibration query must arrive after the release");
                double bytesPerRecord = (double) (heldByOne - baseline) / calibrationRecords;
                assertTrue(bytesPerRecord > 0,
                        "Incomplete exposure: a held answer must retain memory: " + heldByOne + " against " + baseline);
                int targetRecords = (int) ((maximum * TARGET_FRACTION - baseline) / (2 * bytesPerRecord));
                int seconds = configuredSeconds != null ? configuredSeconds : targetRecords + targetRecords / 10 + 2000;
                assertTrue(targetRecords > 0 && seconds < Duration.between(RetrievalMemoryNetworkFixture.FROM,
                        RetrievalMemoryNetworkFixture.TO).getSeconds(), "Derived query must fit the generated store");
                PVAURI load = load(processor, seconds);
                outcomes.add("baseline=" + baseline + " calibrationRecords=" + calibrationRecords
                        + " calibrationCollected=" + heldByOne + " bytesPerRecord=" + bytesPerRecord
                        + " targetRecords=" + targetRecords + " seconds=" + seconds);
                Files.writeString(server.evidence.resolve("pva-admission-inputs.txt"),
                        "query=" + load + "\nmaxHeap=" + maximum + "\nbaselineCollected=" + baseline
                        + "\ncalibrationSeconds=" + calibrationSeconds + "\ncalibrationRecords=" + calibrationRecords
                        + "\ncalibrationCollected=" + heldByOne + "\nbytesPerRecord=" + bytesPerRecord
                        + "\ntargetFraction=" + TARGET_FRACTION + "\ntargetRecords=" + targetRecords
                        + "\nseconds=" + seconds + "\nclients=3\nrequestSeconds=120\n"
                        + "clientConnectionTimeoutSeconds=" + PVASettings.EPICS_PVA_CONN_TMO + "\n"
                        + "clientLogLevel=" + System.getProperty("archappl.memory.test.pvaClientLogLevel", "WARNING") + "\n");

                phase.set("single-control");
                long singleStarted = System.nanoTime();
                var single = channels.getFirst().invoke(load);
                requests.add(single);
                Answer control = answer(single.get(120, TimeUnit.SECONDS));
                outcomes.add("single=" + control + " millis=" + (System.nanoTime() - singleStarted) / 1_000_000);
                assertEquals(seconds + 1, control.records(), "Every one-second bin in the inclusive query must arrive");
                requests.clear();
                assertData(channels.getFirst());

                phase.set("two-requests");
                int holdRecords = Integer.getInteger("archappl.memory.test.pvaHoldRecords", targetRecords);
                if (server.readHold != null) server.readHold.holdAfterRecords(holdRecords);
                long loadStarted = System.nanoTime();
                long finishBy = loadStarted + Duration.ofSeconds(120).toNanos();
                requests.add(channels.get(0).invoke(load));
                requests.add(channels.get(1).invoke(load));
                if (server.readHold != null) {
                    phase.set("held-requests");
                    int step = Math.max(1000, seconds / 100);
                    while (true) {
                        long heldBy = Math.min(finishBy, System.nanoTime() + Duration.ofSeconds(10).toNanos());
                        while (server.readHold.heldReaders() != 2 && System.nanoTime() < heldBy) Thread.sleep(10);
                        assertEquals(2, server.readHold.heldReaders(), "Both actual PB readers must reach the hold");
                        server.readHold.assertHealthy();
                        assertEquals(2, activeRequests(threads).size(), "Both PVA handlers must retain their requests");
                        server.memory.gc();
                        long retained = server.oldPool.getCollectionUsage().getUsed();
                        outcomes.add("heldRecords=" + holdRecords + " collectedAfterGc=" + retained);
                        assertTrue(retained < maximum * .60, "Held requests must remain below pressure");
                        if (retained > maximum * .50) break;
                        holdRecords += step;
                        assertTrue(holdRecords < seconds - 2000,
                                "Incomplete exposure: real retained responses did not reach admission before the query end");
                        server.readHold.holdAfterRecords(holdRecords);
                    }
                }
                boolean admission = false;
                int overlap = 0;
                while (!requests.stream().allMatch(CompletableFuture::isDone) && System.nanoTime() < finishBy) {
                    var active = activeRequests(threads);
                    overlap = Math.max(overlap, active.size());
                    long collected = server.oldPool.getCollectionUsage().getUsed();
                    if (!admission && active.size() == 2 && collected > maximum * .50 && collected < maximum * .60) {
                        phase.set("third-request");
                        int marker = log.mark();
                        int serverMarker = server.tomcat.consoleLines("appliance0").size();
                        var probe = channels.get(2).invoke(query("mean_60"));
                        long probeStarted = System.nanoTime();
                        try {
                            long replyBy = Math.min(finishBy, probeStarted + Duration.ofSeconds(5).toNanos());
                            while (!log.hasRefusal(marker, "mean_60", "memory admission")
                                    && !probe.isDone() && System.nanoTime() < replyBy) Thread.sleep(10);
                            if (probe.isDone() && !log.hasRefusal(marker, "mean_60", "memory admission")) {
                                Answer accepted = answer(probe.get());
                                outcomes.add("probeAccepted=" + accepted + " probeCollected=" + collected
                                        + " millis=" + (System.nanoTime() - probeStarted) / 1_000_000);
                                assertEquals(61, accepted.records(), "A normal probe must return every expected bin");
                            } else {
                                log.assertRefusal(marker, "mean_60", "memory admission");
                                AdmissionRefusal refusal = log.admissionRefusal(marker, "mean_60");
                                int activeAtRefusal = activeRequests(threads).size();
                                outcomes.add("probeCollected=" + collected + " refusalUsed=" + refusal.used()
                                        + " refusalThreshold=" + refusal.threshold() + " activeAtRefusal=" + activeAtRefusal
                                        + " millis=" + (System.nanoTime() - probeStarted) / 1_000_000);
                                assertEquals((long) (maximum * .50), refusal.threshold());
                                assertTrue(refusal.used() > maximum * .50 && refusal.used() < maximum * .60,
                                        "Actual refusal usage must be between admission and pressure: " + refusal);
                                assertTrue(activeAtRefusal >= 2, "The two original requests must still run at refusal");
                                if (server.readHold != null) {
                                    assertEquals(2, server.readHold.heldReaders(), "Both original reads must span the refusal");
                                    server.readHold.assertHealthy();
                                }
                                assertTrue(server.tomcat.consoleLines("appliance0").stream().skip(serverMarker)
                                        .anyMatch(line -> line.contains(refusal.message())),
                                        "The server must record the same refusal usage and threshold");
                                assertTrue(finishBy - System.nanoTime() >= Duration.ofSeconds(5).toNanos(),
                                        "The pending-RPC observation must fit within the original pair deadline");
                                assertThrows(TimeoutException.class, () -> probe.get(5, TimeUnit.SECONDS));
                                admission = true;
                                if (server.readHold != null) {
                                    assertEquals(2, server.readHold.heldReaders());
                                    server.readHold.assertHealthy();
                                    server.readHold.close();
                                    server.readHold.awaitReleased(Duration.ofSeconds(2));
                                }
                            }
                        } finally {
                            probe.cancel(true);
                            phase.set("two-requests");
                        }
                    }
                    assertNull(server.tomcat.exitStatus("appliance0"));
                    Thread.sleep(20);
                }
                outcomes.add("overlap=" + overlap + " admission=" + admission);
                for (int i = 0; i < 2; i++) {
                    Answer result = answer(requests.get(i).get(Math.max(1, finishBy - System.nanoTime()), TimeUnit.NANOSECONDS));
                    outcomes.add("response=" + i + " " + result);
                    assertEquals(control, result, "Both original responses must match the real control");
                }
                phase.set("quiescence");
                long recoverBy = System.nanoTime() + Duration.ofSeconds(30).toNanos();
                long idleSince = 0;
                while (System.nanoTime() < recoverBy) {
                    if (activeRequests(threads).isEmpty()) {
                        if (idleSince == 0) idleSince = System.nanoTime();
                        if (System.nanoTime() - idleSince >= Duration.ofMillis(250).toNanos()) break;
                    } else idleSince = 0;
                    Thread.sleep(20);
                }
                assertTrue(idleSince != 0 && System.nanoTime() - idleSince >= Duration.ofMillis(250).toNanos(),
                        "The server must leave the RPC handlers; cancelling client futures is not quiescence");
                phase.set("recovery");
                var recovery = channels.get(2).invoke(query("mean_60"));
                Answer recovered = answer(recovery.get(Math.max(1, recoverBy - System.nanoTime()), TimeUnit.NANOSECONDS));
                outcomes.add("recovery=" + recovered);
                for (int i = 0; i < 3; i++) assertEquals(connectedStates.get(i), states.get(i).size(),
                        "No channel may reconnect during the test: " + states.get(i));
                assertNull(samplingFailure.get(), "Required observations must remain available");
                assertNull(server.tomcat.exitStatus("appliance0"));
                assertTrue(overlap >= 2, "Incomplete exposure: independent server RPC threads did not overlap");
                assertTrue(admission, "Incomplete exposure: the fitting pair did not demonstrate memory admission");
                assertFalse(server.tomcat.consoleLines("appliance0").stream()
                        .anyMatch(line -> line.contains("Retrieval memory pressure:")),
                        "Pressure must not replace admission with completion of both original requests");
                outcomes.add("result=passed");
            } finally {
                if (server.readHold != null) server.readHold.close();
                sampler.shutdownNow();
                sampler.awaitTermination(10, TimeUnit.SECONDS);
                Files.write(server.evidence.resolve("pva-admission-memory.csv"), samples);
                Files.write(server.evidence.resolve("pva-admission-stacks.txt"), stacks);
                Files.write(server.evidence.resolve("pva-admission-outcomes.txt"), outcomes);
                Files.writeString(server.evidence.resolve("pva-admission-states.txt"), states.toString());
                for (var request : requests) request.cancel(true);
                for (PVAClient client : clients) client.close();
            }
        });
    }

    private static PVAURI load(String processor, int seconds) {
        return new PVAURI("name", "pva", null, PvaGetPVData.NAME, Map.of(
                "pv", RetrievalMemoryNetworkFixture.PV, "pp", processor,
                "from", RetrievalMemoryNetworkFixture.FROM.toString(),
                "to", RetrievalMemoryNetworkFixture.FROM.plusSeconds(seconds).toString()));
    }

    private static PVAURI query(String processor) {
        return new PVAURI("name", "pva", null, PvaGetPVData.NAME, Map.of(
                "pv", RetrievalMemoryNetworkFixture.PV, "pp", processor,
                "from", RetrievalMemoryNetworkFixture.FROM.toString(),
                "to", RetrievalMemoryNetworkFixture.FROM.plusSeconds(3600).toString()));
    }

    private static void assertData(PVAChannel channel) throws Exception {
        PVAStructure response = channel.invoke(query("mean_60")).get(30, TimeUnit.SECONDS);
        PVAAnyArray values = response.get("value");
        assertNotNull(values);
        assertEquals(1, values.get().length);
        PVAStructureArray data = values.get()[0].get();
        assertTrue(data.get().length > 0, "The generated store must return data over PVA");
    }

    @FunctionalInterface
    private interface NetworkCase {
        void run(RetrievalMemoryNetworkFixture server, int port) throws Exception;
    }

    private static void withServer(NetworkCase test) throws Exception {
        withServer(Boolean.getBoolean("archappl.memory.test.pvaReadHold"), test);
    }

    private static void withServer(boolean withReadHold, NetworkCase test) throws Exception {
        int port;
        try (DatagramSocket reservation = new DatagramSocket(0)) { port = reservation.getLocalPort(); }
        List<String> serverOptions = new ArrayList<>(List.of(
                "-DEPICS_PVAS_BROADCAST_PORT=" + port, "-DEPICS_PVA_BROADCAST_PORT=" + port));
        String sendBuffer = System.getProperty("archappl.memory.test.pvaSendBufferBytes");
        if (sendBuffer != null) {
            assertTrue(Integer.parseInt(sendBuffer) > 0, "The PVA send buffer must be positive");
            serverOptions.add("-DEPICS_PVA_SEND_BUFFER_SIZE=" + sendBuffer);
        }
        String originalAddress = PVASettings.EPICS_PVA_ADDR_LIST;
        String originalNames = PVASettings.EPICS_PVA_NAME_SERVERS;
        boolean originalAuto = PVASettings.EPICS_PVA_AUTO_ADDR_LIST;
        int originalBroadcast = PVASettings.EPICS_PVA_BROADCAST_PORT;
        PVASettings.EPICS_PVA_ADDR_LIST = "127.0.0.1:" + port;
        PVASettings.EPICS_PVA_NAME_SERVERS = "";
        PVASettings.EPICS_PVA_AUTO_ADDR_LIST = false;
        PVASettings.EPICS_PVA_BROADCAST_PORT = port;
        try (var server = new RetrievalMemoryNetworkFixture(null, withReadHold, serverOptions.toArray(String[]::new))) {
            var runtime = ManagementFactory.newPlatformMXBeanProxy(
                    server.connector.getMBeanServerConnection(), ManagementFactory.RUNTIME_MXBEAN_NAME,
                    java.lang.management.RuntimeMXBean.class);
            String actualBuffer = runtime.getSystemProperties().get("EPICS_PVA_SEND_BUFFER_SIZE");
            Files.writeString(server.evidence.resolve("pva-send-buffer.txt"),
                    "requestedServerBytes=" + sendBuffer + "\nserverSystemProperty=" + actualBuffer
                    + "\nclientEffectiveBytes=" + PVASettings.EPICS_PVA_SEND_BUFFER_SIZE + "\n");
            if (sendBuffer != null) assertEquals(sendBuffer, actualBuffer,
                    "The server JVM must receive the requested PVA send buffer setting");
            test.run(server, port);
        } finally {
            PVASettings.EPICS_PVA_ADDR_LIST = originalAddress;
            PVASettings.EPICS_PVA_NAME_SERVERS = originalNames;
            PVASettings.EPICS_PVA_AUTO_ADDR_LIST = originalAuto;
            PVASettings.EPICS_PVA_BROADCAST_PORT = originalBroadcast;
        }
    }

    @Test
    public void declaredRefusalIsVisibleAndTheSameConnectionRecovers() throws Exception {
        withServer((server, port) -> {
            List<String> states = new CopyOnWriteArrayList<>();
            try (var client = new PVAClient(); var log = new ClientLog(server.evidence.resolve("pva-client.log"))) {
                PVAChannel channel = client.getChannel(PvaDataRetrievalService.PVA_DATA_SERVICE,
                        (changed, state) -> states.add(java.time.Instant.now() + " " + state));
                assertTrue(channel.connect().get(30, TimeUnit.SECONDS));
                Files.writeString(server.evidence.resolve("pva-connection.txt"),
                        "discoveryPort=" + port + "\nremote=" + channel.getRemoteAddress() + "\n");
                assertData(channel);
                int connectedStates = states.size();
                for (String processor : List.of("optimized_2147483647", "optimLastSample_2147483647")) {
                    int logMark = log.mark();
                    long before = server.tomcat.consoleLines("appliance0").stream()
                            .filter(line -> line.contains("exceeds request budget")).count();
                    var request = channel.invoke(query(processor));
                    assertThrows(TimeoutException.class, () -> request.get(5, TimeUnit.SECONDS),
                            "The current PVA library logs a failed RPC and leaves its future pending");
                    assertTrue(server.tomcat.consoleLines("appliance0").stream()
                            .filter(line -> line.contains("exceeds request budget")).count() > before,
                            "Each timeout needs its own server-side budget rejection");
                    log.assertRefusal(logMark, processor, "exceeds request budget");
                    request.cancel(true);
                    assertData(channel);
                    assertEquals(connectedStates, states.size(), "Recovery must not reconnect the channel: " + states);
                    System.out.println("T8 declared refusal processor=" + processor
                            + " remote=" + channel.getRemoteAddress() + " recovery=data");
                }
                assertNull(server.tomcat.exitStatus("appliance0"));
            } finally {
                Files.write(server.evidence.resolve("pva-channel-states.txt"), states);
            }
        });
    }

    @Test
    public void retainedRawControlAndFixedQueryCompleteWithoutPressure() throws Exception {
        withServer((server, port) -> {
            try (var client = new PVAClient()) {
                var channel = client.getChannel(PvaDataRetrievalService.PVA_DATA_SERVICE);
                assertTrue(channel.connect().get(30, TimeUnit.SECONDS));
                long maximum = server.memory.getHeapMemoryUsage().getMax();
                for (String processor : List.of("optimized_300000", "optimLastSample_300000")) {
                    long before = server.tomcat.consoleLines("appliance0").stream()
                            .filter(line -> line.contains("exceeds request budget")).count();
                    var fixed = new PVAURI("name", "pva", null, PvaGetPVData.NAME, Map.of(
                            "pv", RetrievalMemoryNetworkFixture.PV, "pp", processor,
                            "from", RetrievalMemoryNetworkFixture.FROM.minusSeconds(296400).toString(),
                            "to", RetrievalMemoryNetworkFixture.FROM.plusSeconds(3600).toString()));
                    var request = channel.invoke(fixed);
                    if (maximum <= 512L * 1024 * 1024) {
                        assertThrows(TimeoutException.class, () -> request.get(5, TimeUnit.SECONDS));
                        assertTrue(server.tomcat.consoleLines("appliance0").stream()
                                .filter(line -> line.contains("exceeds request budget")).count() > before);
                        request.cancel(true);
                    } else {
                        PVAAnyArray values = request.get(30, TimeUnit.SECONDS).get("value");
                        assertTrue(((PVAStructureArray) values.get()[0].get()).get().length > 0);
                    }
                    assertData(channel);
                    System.out.println("T8 fixedQuery processor=" + processor + " maxHeap=" + maximum
                            + " refused=" + (maximum <= 512L * 1024 * 1024));
                }
                int seconds = Integer.getInteger("archappl.memory.test.rawSeconds", 5000);
                var rawQuery = new PVAURI("name", "pva", null, PvaGetPVData.NAME, Map.of(
                        "pv", RetrievalMemoryNetworkFixture.PV, "pp", "",
                        "from", RetrievalMemoryNetworkFixture.FROM.toString(),
                        "to", RetrievalMemoryNetworkFixture.FROM.plusSeconds(seconds).toString()));
                long started = System.nanoTime();
                Files.writeString(server.evidence.resolve("pva-raw-inputs.txt"),
                        "started=" + java.time.Instant.now() + "\nquery=" + rawQuery + "\ndeadlineSeconds=120\n");
                PVAAnyArray raw = channel.invoke(rawQuery).get(120, TimeUnit.SECONDS).get("value");
                PVAStructureArray data = raw.get()[0].get();
                assertEquals(seconds + 1, data.get().length);
                String result = "maxHeap=" + maximum + " records=" + data.get().length
                        + " elapsedMillis=" + (System.nanoTime() - started) / 1_000_000;
                Files.writeString(server.evidence.resolve("pva-raw.txt"), result + "\n");
                System.out.println("T8 raw " + result);
                assertNull(server.tomcat.exitStatus("appliance0"));
            }
        });
    }

    @Test
    public void separateConnectionsStopUnderPressureAndRecover() throws Exception {
        withServer((server, port) -> {
            List<PVAClient> clients = new ArrayList<>();
            List<PVAChannel> channels = new ArrayList<>();
            List<CompletableFuture<PVAStructure>> requests = new ArrayList<>();
            List<PVAURI> queries = new ArrayList<>();
            List<List<String>> states = new ArrayList<>();
            List<Integer> connectedStates = new ArrayList<>();
            List<String> samples = new ArrayList<>();
            samples.add("elapsedNanos,heapUsed,collectedUsed,activeRpcThreads");
            long maximum = server.memory.getHeapMemoryUsage().getMax();
            long seconds = Math.min(Duration.between(RetrievalMemoryNetworkFixture.FROM,
                    RetrievalMemoryNetworkFixture.TO).getSeconds(), (long) (maximum * .16 / 112) - 2);
            int count = Integer.getInteger("archappl.memory.test.concurrency", 8);
            ThreadMXBean threads = ManagementFactory.newPlatformMXBeanProxy(server.connector.getMBeanServerConnection(),
                    ManagementFactory.THREAD_MXBEAN_NAME, ThreadMXBean.class);
            long peak = 0;
            int overlap = 0;
            long started = 0;
            try (var log = new ClientLog(server.evidence.resolve("pva-pressure-client.log"))) {
                for (int i = 0; i < count; i++) {
                    PVAClient client = new PVAClient();
                    clients.add(client);
                    List<String> state = new CopyOnWriteArrayList<>();
                    states.add(state);
                    PVAChannel channel = client.getChannel(PvaDataRetrievalService.PVA_DATA_SERVICE,
                            (changed, value) -> state.add(java.time.Instant.now() + " " + value));
                    assertTrue(channel.connect().get(30, TimeUnit.SECONDS));
                    channels.add(channel);
                    assertData(channel);
                    connectedStates.add(state.size());
                    queries.add(new PVAURI("name", "pva", null, PvaGetPVData.NAME, Map.of(
                            "pv", RetrievalMemoryNetworkFixture.PV, "pp", "mean_1",
                            "from", RetrievalMemoryNetworkFixture.FROM.toString(),
                            "to", RetrievalMemoryNetworkFixture.FROM.plusSeconds(seconds - i).toString())));
                }
                Files.writeString(server.evidence.resolve("pva-pressure-inputs.txt"),
                        "clients=" + count + "\nmaxHeap=" + maximum + "\nqueries=" + queries + "\n");
                int mark = log.mark();
                started = System.nanoTime();
                for (int i = 0; i < count; i++) requests.add(channels.get(i).invoke(queries.get(i)));
                boolean rejected = false;
                do {
                    long heap = server.memory.getHeapMemoryUsage().getUsed();
                    long collected = server.oldPool.getCollectionUsage().getUsed();
                    int active = 0;
                    for (var thread : threads.dumpAllThreads(false, false)) {
                        if (java.util.Arrays.stream(thread.getStackTrace()).anyMatch(frame ->
                                frame.getClassName().equals(PvaGetPVData.class.getName()))) active++;
                    }
                    overlap = Math.max(overlap, active);
                    peak = Math.max(peak, heap);
                    samples.add((System.nanoTime() - started) + "," + heap + "," + collected + "," + active);
                    rejected = server.tomcat.consoleLines("appliance0").stream()
                            .anyMatch(line -> line.contains("Retrieval memory pressure:"));
                    assertNull(server.tomcat.exitStatus("appliance0"), "The server must survive PVA pressure");
                    assertTrue(System.nanoTime() - started < Duration.ofSeconds(120).toNanos(),
                            "Incomplete pressure exposure: no PVA pressure refusal within the deadline");
                    if (!rejected) Thread.sleep(20);
                } while (!rejected);
                assertTrue(overlap >= 2, "Independent RPCs must overlap on different server threads");
                long clientBy = System.nanoTime() + Duration.ofSeconds(5).toNanos();
                int refused = -1;
                do {
                    for (int i = 0; i < count; i++) {
                        if (log.hasRefusal(mark, queries.get(i).toString(), "Retrieval memory pressure:")) {
                            refused = i;
                            break;
                        }
                    }
                    if (refused < 0) Thread.sleep(20);
                } while (refused < 0 && System.nanoTime() < clientBy);
                assertTrue(refused >= 0, "The client must receive the pressure condition for a loaded RPC");
                var failedRequest = requests.get(refused);
                assertThrows(TimeoutException.class, () -> failedRequest.get(5, TimeUnit.SECONDS),
                        "A pressure-stopped RPC must remain pending instead of returning partial success");
                long recoverBy = System.nanoTime() + Duration.ofSeconds(30).toNanos();
                while (!activeRequests(threads).isEmpty() && System.nanoTime() < recoverBy) {
                    assertNull(server.tomcat.exitStatus("appliance0"));
                    Thread.sleep(20);
                }
                assertTrue(activeRequests(threads).isEmpty(),
                        "Server work must finish before client cancellation or recovery");
                for (var request : requests) request.cancel(true);
                for (int i = 0; i < count; i++) {
                    var recovery = channels.get(i).invoke(query("mean_60"));
                    try {
                        long remaining = recoverBy - System.nanoTime();
                        assertTrue(remaining > 0, "All existing connections must recover within 30 seconds");
                        assertEquals(61, answer(recovery.get(remaining, TimeUnit.NANOSECONDS)).records());
                        assertEquals(connectedStates.get(i), states.get(i).size(),
                                "Recovery must not rely on a reconnected channel");
                    } finally {
                        recovery.cancel(true);
                    }
                }
                assertNull(server.tomcat.exitStatus("appliance0"));
                String result = "maxHeap=" + maximum + " peak=" + peak + " headroom=" + (maximum - peak)
                        + " overlap=" + overlap + " refusedClient=" + refused + " recoveredClients=" + count
                        + " elapsedMillis=" + (System.nanoTime() - started) / 1_000_000;
                Files.writeString(server.evidence.resolve("pva-pressure-result.txt"), result + "\n");
                System.out.println("T8 pressure " + result);
            } finally {
                Files.write(server.evidence.resolve("pva-memory.csv"), samples);
                Files.writeString(server.evidence.resolve("pva-pressure-states.txt"), states.toString() + "\n");
                for (var request : requests) request.cancel(true);
                for (PVAClient client : clients) client.close();
            }
        });
    }

}
