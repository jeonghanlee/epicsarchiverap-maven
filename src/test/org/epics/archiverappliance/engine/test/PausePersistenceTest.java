package org.epics.archiverappliance.engine.test;

import edu.stanford.slac.archiverappliance.PlainPB.AppendDataStateData;
import edu.stanford.slac.archiverappliance.PlainPB.FileBackedPBEventStream;
import edu.stanford.slac.archiverappliance.PB.utils.LineEscaper;
import edu.stanford.slac.archiverappliance.PlainPB.PlainPBPathNameUtility;
import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.common.POJOEvent;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.epics.archiverappliance.engine.ArchiveEngine;
import org.epics.archiverappliance.engine.bpl.PauseArchivingPV;
import org.epics.archiverappliance.engine.model.ArchiveChannel;
import org.epics.archiverappliance.engine.model.MonitoredArchiveChannel;
import org.epics.archiverappliance.engine.writer.WriterRunnable;
import org.epics.archiverappliance.utils.nio.ArchPaths;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

import java.io.FilterOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Engine and PB persistence tests; only the outer file output is controlled. */
public class PausePersistenceTest {
    private static final String PV = "PausePersistenceTest:test";
    private static final ArchDBRTypes TYPE = ArchDBRTypes.DBR_SCALAR_DOUBLE;
    private final Instant base = Instant.now().minusSeconds(20);
    @TempDir Path directory;
    private ConfigServiceForTests config;
    private PlainPBStoragePlugin storage;
    private ArchiveChannel channel;
    private WriterRunnable writer;
    private Path file;

    @BeforeEach
    void setUp() throws Exception {
        config = new ConfigServiceForTests(1);
        storage = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=pause-test&rootFolder=" + directory + "&partitionGranularity=PARTITION_YEAR",
                config);
        channel = new MonitoredArchiveChannel(PV, storage, 100, null, 1, config, TYPE, null, 0, false);
        config.getEngineContext().getChannelList().put(PV, channel);
        writer = config.getEngineContext().getWriteThead();
        writer.addChannel(channel);
        try (ArchPaths paths = new ArchPaths()) {
            file = PlainPBPathNameUtility.getPathNameForTime(storage, PV, base, paths,
                    config.getPVNameToKeyConverter());
        }
        Files.createDirectories(file.getParent());
    }

    @AfterEach
    void tearDown() throws Exception {
        if (config != null) config.shutdownNow();
    }

    private void add(int offset) {
        assertTrue(channel.getSampleBuffer().add(new POJOEvent(
                TYPE, base.plusSeconds(offset), new ScalarValue<Double>((double) offset), 3, 2)));
    }

    private void assertStored(int count) throws Exception {
        assertTrue(Files.isRegularFile(file), "Pause must create a PB file for pending data");
        List<Instant> timestamps = new ArrayList<>();
        try (FileBackedPBEventStream stream = new FileBackedPBEventStream(PV, file, TYPE)) {
            for (Event event : stream) {
                int offset = timestamps.size();
                assertEquals((double) offset, ((Number) event.getSampleValue().getValue()).doubleValue());
                assertEquals(3, ((DBRTimeEvent) event).getStatus());
                assertEquals(2, ((DBRTimeEvent) event).getSeverity());
                timestamps.add(event.getEventTimeStamp());
            }
        }
        assertEquals(java.util.stream.IntStream.range(0, count).mapToObj(base::plusSeconds).toList(), timestamps);
    }

    @Test
    void pausePersistsPendingSamplesBeforeRemovingChannel() throws Exception {
        add(0);
        add(1);
        add(2);
        ArchiveEngine.pauseArchivingPV(PV, config);
        assertStored(3);
        assertNull(config.getEngineContext().getChannelList().get(PV));
        assertFalse(channel.getSampleBuffer().add(new POJOEvent(
                TYPE, base.plusSeconds(3), new ScalarValue<Double>(3.0), 3, 2)),
                "A late callback must not add to the detached buffer");
    }

    @Test
    void failedPauseRetainsDataForRetry() throws Exception {
        Files.createDirectory(file);
        add(0);
        add(1);
        assertThrows(IOException.class, () -> ArchiveEngine.pauseArchivingPV(PV, config));
        assertSame(channel, config.getEngineContext().getChannelList().get(PV));
        Files.delete(file);
        ArchiveEngine.pauseArchivingPV(PV, config);
        assertStored(2);
        assertNull(config.getEngineContext().getChannelList().get(PV));
    }

    @Test
    void resumeAfterFailedPausePersistsPendingDataBeforeAcceptingMore() throws Exception {
        Files.createDirectory(file);
        add(0);
        assertThrows(IOException.class, () -> ArchiveEngine.pauseArchivingPV(PV, config));
        Files.delete(file);
        ArchiveEngine.resumeArchivingPV(PV, config);
        assertStored(1);
        add(1);
        ArchiveEngine.pauseArchivingPV(PV, config);
        assertStored(2);
    }

    @Test
    void closeFailureRetainsDataAndResetsTheAppendTimestamp() throws Exception {
        assumeTrue(Files.exists(Path.of("/dev/full")), "Requires the Linux full device");
        Files.createSymbolicLink(file, Path.of("/dev/full"));
        add(0);
        add(1);
        assertThrows(IOException.class, writer::flushBuffer, "Output close must propagate its write failure");
        assertThrows(IOException.class, () -> ArchiveEngine.pauseArchivingPV(PV, config));
        assertSame(channel, config.getEngineContext().getChannelList().get(PV));
        Files.delete(file);
        ArchiveEngine.pauseArchivingPV(PV, config);
        assertStored(2);
    }

    @ParameterizedTest
    @ValueSource(strings = {"header", "first-sample", "next-sample", "existing-file"})
    void partialWriteRetainsDataForRetry(String boundary) throws Exception {
        assumeTrue(Files.isExecutable(Path.of("/usr/bin/prlimit"))
                && Files.isExecutable(Path.of("/bin/bash")), "Requires Linux prlimit and Bash");
        Path logging = directory.resolve("child-log.xml");
        Files.writeString(logging, "<Configuration status=\"OFF\"><Loggers><Root level=\"off\"/></Loggers></Configuration>");
        // Ignore SIGXFSZ only in the child so the real write reports EFBIG to Java.
        Process process = new ProcessBuilder("/bin/bash", "-c", "trap '' XFSZ; exec \"$@\"", "partial-write",
                Path.of(System.getProperty("java.home"), "bin", "java").toString(), "-Xmx256m",
                "-Dlog4j2.configurationFile=" + logging, "-cp",
                System.getProperty("surefire.test.class.path", System.getProperty("java.class.path")),
                PartialWriteProcess.class.getName(), directory.toString(), boundary)
                .redirectErrorStream(true).start();
        try (var reader = Executors.newVirtualThreadPerTaskExecutor()) {
            var output = reader.submit(() -> {
                try (var input = process.getInputStream(); var bytes = new ByteArrayOutputStream()) {
                    input.transferTo(bytes);
                    return bytes.toString(java.nio.charset.StandardCharsets.UTF_8);
                }
            });
            try {
                assertTrue(process.waitFor(60, TimeUnit.SECONDS), "Partial-write child timed out");
                String transcript = output.get(5, TimeUnit.SECONDS);
                System.out.print(transcript);
                assertEquals(0, process.exitValue(), transcript);
            } finally {
                if (process.isAlive()) process.destroyForcibly();
                assertTrue(process.waitFor(5, TimeUnit.SECONDS), "Partial-write child did not exit");
            }
        }
    }

    /** Isolates RLIMIT_FSIZE from the test runner while exercising the shipped engine fixture. */
    public static class PartialWriteProcess {
        private static String limit(String... arguments) throws Exception {
            List<String> command = new ArrayList<>(List.of("/usr/bin/prlimit", "--pid",
                    Long.toString(ProcessHandle.current().pid())));
            command.addAll(List.of(arguments));
            Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
            try {
                assertTrue(process.waitFor(5, TimeUnit.SECONDS), "prlimit timed out");
                String output = new String(process.getInputStream().readAllBytes(),
                        java.nio.charset.StandardCharsets.UTF_8).strip();
                assertEquals(0, process.exitValue(), output);
                return output;
            } finally {
                if (process.isAlive()) {
                    process.destroyForcibly();
                    process.waitFor();
                }
            }
        }

        public static void main(String[] args) {
            int result = 0;
            PausePersistenceTest fixture = new PausePersistenceTest();
            try {
                String boundary = args[1];
                fixture.directory = Path.of(args[0], "reference");
                fixture.setUp();
                fixture.add(0);
                fixture.add(1);
                fixture.writer.flushBuffer();
                byte[] reference = Files.readAllBytes(fixture.file);
                List<Integer> ends = new ArrayList<>();
                for (int i = 0; i < reference.length; i++) {
                    if (reference[i] == LineEscaper.NEWLINE_CHAR) ends.add(i + 1);
                }
                assertEquals(3, ends.size(), "Reference must contain a header and two samples");
                long cutoff = switch (boundary) {
                    case "header" -> ends.get(0) / 2;
                    case "first-sample" -> ends.get(0) + 1;
                    case "next-sample", "existing-file" -> ends.get(1) + 1;
                    default -> throw new IllegalArgumentException(boundary);
                };
                fixture.tearDown();
                fixture.directory = Path.of(args[0], "failure");
                fixture.setUp();
                fixture.add(0);
                byte[] committed = new byte[0];
                if (boundary.equals("existing-file")) {
                    fixture.writer.flushBuffer();
                    committed = Files.readAllBytes(fixture.file);
                    assertEquals(committed.length + 1, cutoff);
                }
                fixture.add(1);
                System.out.println("Testing partial write: " + boundary + " (limit " + cutoff + ")");
                String originalLimit = limit("--fsize", "--output=SOFT", "--noheadings", "--raw");
                try {
                    // A trailing colon changes only the soft limit; restoration needs the original hard limit.
                    limit("--fsize=" + cutoff + ":");
                    assertThrows(IOException.class, () -> ArchiveEngine.pauseArchivingPV(PV, fixture.config));
                    assertSame(fixture.channel, fixture.config.getEngineContext().getChannelList().get(PV));
                } finally {
                    limit("--fsize=" + originalLimit + ":");
                }
                assertArrayEquals(committed, Files.readAllBytes(fixture.file),
                        "Failed output must restore the last completed append");
                ArchiveEngine.pauseArchivingPV(PV, fixture.config);
                fixture.assertStored(2);
                assertNull(fixture.config.getEngineContext().getChannelList().get(PV));
                System.out.println("Partial-write retry passed: " + boundary + " (limit " + cutoff + ")");
            } catch (Throwable failure) {
                failure.printStackTrace();
                result = 1;
            } finally {
                try {
                    fixture.tearDown();
                } catch (Exception failure) {
                    failure.printStackTrace();
                    result = 1;
                }
            }
            // CA client search timers may outlive ConfigServiceForTests outside Surefire.
            System.exit(result);
        }
    }

    private JSONObject pauseResponse() throws Exception {
        StringWriter body = new StringWriter();
        HttpServletRequest request = (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] {HttpServletRequest.class}, (proxy, method, args) -> {
                    if (method.getName().equals("getParameter") && args[0].equals("pv")) return PV;
                    throw new UnsupportedOperationException(method.getName());
                });
        HttpServletResponse response = (HttpServletResponse) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] {HttpServletResponse.class}, (proxy, method, args) -> {
                    if (method.getName().equals("getWriter")) return new PrintWriter(body);
                    if (method.getName().equals("setContentType")) return null;
                    throw new UnsupportedOperationException(method.getName());
                });
        new PauseArchivingPV().execute(request, response, config);
        JSONArray rows = (JSONArray) JSONValue.parseWithException(body.toString());
        assertEquals(1, rows.size());
        JSONObject row = (JSONObject) rows.getFirst();
        assertEquals(PV, row.get("pvName"));
        return row;
    }

    @Test
    void engineResponseReportsPersistenceFailureAndSuccessfulRetry() throws Exception {
        Files.createDirectory(file);
        add(0);
        JSONObject failure = pauseResponse();
        assertEquals("failed", failure.get("status"));
        assertFalse(((String) failure.get("validation")).isBlank());
        assertSame(channel, config.getEngineContext().getChannelList().get(PV));
        Files.delete(file);
        assertEquals("ok", pauseResponse().get("status"));
        assertStored(1);
    }

    @Test
    void queuedYearChangeCannotRotateARemovedBuffer() throws Exception {
        CountDownLatch occupied = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        var scheduler = config.getEngineContext().getScheduler();
        var blocker = scheduler.submit(() -> {
            occupied.countDown();
            if (!release.await(10, TimeUnit.SECONDS)) throw new IOException("Scheduler release timed out");
            return null;
        });
        try {
            assertTrue(occupied.await(5, TimeUnit.SECONDS));
            Instant oldYear = base.atZone(java.time.ZoneOffset.UTC).withDayOfYear(1)
                    .toLocalDate().atStartOfDay(java.time.ZoneOffset.UTC).toInstant().minusSeconds(1);
            assertTrue(channel.getSampleBuffer().add(new POJOEvent(TYPE, oldYear,
                    new ScalarValue<Double>(-1.0), 3, 2)));
            add(0);
            ArchiveEngine.pauseArchivingPV(PV, config);
            var oldBuffer = channel.getSampleBuffer();
            var persistedBatch = oldBuffer.getPreviousSamples();
            channel = new MonitoredArchiveChannel(PV, storage, 100, null, 1, config, TYPE, null, 0, false);
            config.getEngineContext().getChannelList().put(PV, channel);
            writer.addChannel(channel);
            add(1);
            release.countDown();
            blocker.get(5, TimeUnit.SECONDS);
            scheduler.submit(() -> {}).get(5, TimeUnit.SECONDS);
            assertSame(persistedBatch, oldBuffer.getPreviousSamples(), "Stale callback must leave the old buffer intact");
            assertEquals(1, channel.getSampleBuffer().getQueueSize(), "Stale callback must leave the new buffer intact");
            ArchiveEngine.pauseArchivingPV(PV, config);
            assertStored(2);
        } finally {
            release.countDown();
        }
    }

    @Test
    void periodicFailureDoesNotLoseTheBatchOnTheNextRotation() throws Exception {
        Files.createDirectory(file);
        add(0);
        assertThrows(IOException.class, writer::flushBuffer);
        add(1);
        assertThrows(IOException.class, writer::flushBuffer);
        Files.delete(file);
        writer.flushBuffer();
        ArchiveEngine.pauseArchivingPV(PV, config);
        assertStored(2);
    }

    @Test
    void oneFailedBufferDoesNotPreventOtherChannelsFromWriting() throws Exception {
        String otherName = PV + "Control";
        ArchiveChannel other = new MonitoredArchiveChannel(otherName, storage, 100, null, 1,
                config, TYPE, null, 0, false);
        config.getEngineContext().getChannelList().put(otherName, other);
        writer.addChannel(other);
        // Obstruct the actual first buffer in the writer's iteration order.
        Field buffers = WriterRunnable.class.getDeclaredField("buffers");
        buffers.setAccessible(true);
        String failingName = (String) ((Map<?, ?>) buffers.get(writer)).keySet().iterator().next();
        String healthyName = failingName.equals(PV) ? otherName : PV;
        Path failingFile;
        Path healthyFile;
        try (ArchPaths paths = new ArchPaths()) {
            failingFile = PlainPBPathNameUtility.getPathNameForTime(storage, failingName, base,
                    paths, config.getPVNameToKeyConverter());
            healthyFile = PlainPBPathNameUtility.getPathNameForTime(storage, healthyName, base,
                    paths, config.getPVNameToKeyConverter());
        }
        Files.createDirectories(failingFile);
        try {
            for (ArchiveChannel current : List.of(channel, other)) {
                assertTrue(current.getSampleBuffer().add(new POJOEvent(
                        TYPE, base, new ScalarValue<Double>(0.0), 3, 2)));
            }
            assertThrows(IOException.class, writer::flushBuffer);
            assertTrue(Files.isRegularFile(healthyFile), "A failed PV must not prevent another PV's append");
            try (FileBackedPBEventStream stream = new FileBackedPBEventStream(healthyName, healthyFile, TYPE)) {
                var events = stream.iterator();
                assertTrue(events.hasNext());
                assertEquals(base, events.next().getEventTimeStamp());
                assertFalse(events.hasNext());
            }
        } finally {
            Files.delete(failingFile);
        }
    }

    @Test
    void pauseWaitsForAnActiveAppendAndDrainsTheNextBatch() throws Exception {
        add(0);
        writer.flushBuffer();
        CountDownLatch closing = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch pausing = new CountDownLatch(1);
        // Keep serialization and the real file intact; control only output completion.
        Field states = PlainPBStoragePlugin.class.getDeclaredField("appendDataStates");
        states.setAccessible(true);
        AppendDataStateData state = (AppendDataStateData) ((Map<?, ?>) states.get(storage)).get(PV);
        Field output = AppendDataStateData.class.getDeclaredField("os");
        output.setAccessible(true);
        OutputStream actual = Files.newOutputStream(file, StandardOpenOption.APPEND);
        output.set(state, new FilterOutputStream(actual) {
            @Override
            public void close() throws IOException {
                closing.countDown();
                try {
                    if (!release.await(10, TimeUnit.SECONDS)) throw new IOException("Output release timed out");
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IOException(e);
                } finally {
                    super.close();
                }
            }
        });
        try (var executor = Executors.newFixedThreadPool(2)) {
            try {
                add(1);
                var periodic = executor.submit(() -> { writer.flushBuffer(); return null; });
                assertTrue(closing.await(5, TimeUnit.SECONDS), "Periodic append reached output close");
                add(2);
                var pause = executor.submit(() -> {
                    pausing.countDown();
                    ArchiveEngine.pauseArchivingPV(PV, config);
                    return null;
                });
                assertTrue(pausing.await(5, TimeUnit.SECONDS));
                assertThrows(java.util.concurrent.TimeoutException.class,
                        () -> pause.get(200, TimeUnit.MILLISECONDS), "Pause must wait for the active writer");
                release.countDown();
                periodic.get(5, TimeUnit.SECONDS);
                pause.get(5, TimeUnit.SECONDS);
                assertStored(3);
            } finally {
                release.countDown();
            }
        }
    }
}
