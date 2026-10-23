package org.epics.archiverappliance.retrieval;

import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Records what a retrieval JVM and its HTTP client do when one request exhausts memory, on the real appliance of the
 * fixture with one PV of 1 Hz doubles over 30 days.
 *
 * Part A, without the JVM options of the first protection layer: for each response format, the status and the body
 * of a request whose preallocation fails (an argument near 2^31 of optimized, which fails with Requested array size
 * exceeds VM limit before an event is written), and whether the next request is answered.
 *
 * Part B, with -XX:+ExitOnOutOfMemoryError and -XX:+HeapDumpOnOutOfMemoryError and a limited heap: the request of
 * optimized_2000000 over 80 days that needs more than that heap; the exit status of the JVM, the heap dump in its logs
 * folder, the console line of the JVM and what the client received.
 *
 * It exhausts memory on purpose, so it is tagged slow and run on its own, for example
 * ./mvnw -o -B -ntp test -Dtest=RetrievalOutOfMemoryExitTest -Dtest.excludedGroups=
 * The results are printed and appended to target/retrieval-oom-exit.tsv.
 */
@Tag("slow")
public class RetrievalOutOfMemoryExitTest {
    private static final String PV_NAME = ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "RetrievalOomExit";
    private static final String DATA_FROM = "2011-02-01T00:00:00.000Z";
    private static final String DATA_TO = "2011-03-03T00:00:00.000Z";
    private static final String SMALL_RANGE_FROM = DATA_FROM;
    private static final String SMALL_RANGE_TO = "2011-02-01T01:00:00.000Z";
    private static final String WIDE_RANGE_FROM = "2010-12-13T00:00:00.000Z";
    private static final String APPLIANCE = "appliance0";
    private static final List<String> FORMATS = List.of("json", "csv", "txt", "svg", "mat", "raw", "flx", "jplot", "qw");
    private static final String HEAP_OPTION = "-Xmx512m";
    private static final int EXIT_WAIT_SECONDS = 180;
    private static final Path RESULT_FILE = Path.of("target", "retrieval-oom-exit.tsv");

    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static void generateData() throws Exception {
        Instant start = TimeUtils.convertFromISO8601String(DATA_FROM);
        Instant end = TimeUtils.convertFromISO8601String(DATA_TO);
        long events = GenerateData.generateSineForPV(PV_NAME, 0, ArchDBRTypes.DBR_SCALAR_DOUBLE, start, end);
        System.out.println("T3 data events generated now: " + events + " (0 when the files already exist)");
    }

    private String getDataUrl(String format, String pp, String from, String to) {
        return ConfigServiceForTests.DATA_RETRIEVAL_URL + "/data/getData." + format + "?pv=" + encode(PV_NAME)
                + "&pp=" + encode(pp) + "&from=" + encode(from) + "&to=" + encode(to);
    }

    private static void record(List<String> lines) throws Exception {
        Files.createDirectories(RESULT_FILE.getParent());
        Files.write(RESULT_FILE, lines, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        for (String line : lines) {
            System.out.println("T3 " + line);
        }
    }

    @Test
    public void partAPreallocationFailureAnsweredToTheClientInEachFormat() throws Exception {
        generateData();
        TomcatSetup fixture = new TomcatSetup();
        List<String> lines = new ArrayList<>();
        try {
            fixture.setUpWebApps("RetrievalOomExitA");
            for (String format : FORMATS) {
                String line;
                try {
                    HttpResponse<byte[]> response = client.send(
                            HttpRequest.newBuilder(URI.create(getDataUrl(format, "optimized_2147483647", SMALL_RANGE_FROM, SMALL_RANGE_TO)))
                                    .timeout(Duration.ofSeconds(60)).GET().build(),
                            HttpResponse.BodyHandlers.ofByteArray());
                    String body = format.equals("raw") ? "(binary)" : new String(response.body(), StandardCharsets.UTF_8)
                            .replaceAll("\\s+", " ");
                    line = String.join("\t", "A", format, "status=" + response.statusCode(),
                            "contentType=" + response.headers().firstValue("Content-Type").orElse("-"),
                            "bodyBytes=" + response.body().length, "body=[" + body.substring(0, Math.min(100, body.length())) + "]");
                } catch (Exception ex) {
                    line = String.join("\t", "A", format, "client exception " + ex);
                }
                lines.add(line);
            }
            // The JVM still answers: a request with a normal operator after the failures.
            HttpResponse<String> next = client.send(
                    HttpRequest.newBuilder(URI.create(getDataUrl("json", "mean_60", SMALL_RANGE_FROM, SMALL_RANGE_TO))).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            lines.add(String.join("\t", "A", "next request after the failures", "status=" + next.statusCode(),
                    "bodyBytes=" + next.body().length()));
            lines.add(String.join("\t", "A", "the JVM is running", "exitStatus=" + fixture.exitStatus(APPLIANCE)));
        } finally {
            fixture.tearDown();
            record(lines);
        }
    }

    @Test
    public void partBHeapExhaustionWithTheOptionsEndsTheJvm() throws Exception {
        generateData();
        File logsFolder = new File(TomcatSetup.getApplianceFolder("RetrievalOomExitB", APPLIANCE), "logs");
        TomcatSetup fixture = new TomcatSetup().withJvmOptions(
                HEAP_OPTION,
                "-XX:+ExitOnOutOfMemoryError",
                "-XX:+HeapDumpOnOutOfMemoryError",
                "-XX:HeapDumpPath=" + logsFolder.getAbsolutePath());
        List<String> lines = new ArrayList<>();
        try {
            fixture.setUpWebApps("RetrievalOomExitB");
            Assertions.assertNull(fixture.exitStatus(APPLIANCE), "The JVM must run before the request");
            long sent = System.nanoTime();
            String clientOutcome;
            try {
                HttpResponse<byte[]> response = client.send(
                        HttpRequest.newBuilder(URI.create(getDataUrl("json", "optimized_2000000", WIDE_RANGE_FROM, DATA_TO)))
                                .timeout(Duration.ofSeconds(EXIT_WAIT_SECONDS)).GET().build(),
                        HttpResponse.BodyHandlers.ofByteArray());
                clientOutcome = "status=" + response.statusCode() + " bodyBytes=" + response.body().length;
            } catch (Exception ex) {
                clientOutcome = "client exception " + ex;
            }
            long clientMillis = (System.nanoTime() - sent) / 1_000_000;
            Integer status = fixture.waitForExit(APPLIANCE, EXIT_WAIT_SECONDS, TimeUnit.SECONDS);
            Thread.sleep(2000);
            File[] dumps = logsFolder.listFiles((dir, name) -> name.endsWith(".hprof"));
            String dumpInfo = dumps == null || dumps.length == 0
                    ? "none"
                    : dumps[0].getName() + " " + (dumps[0].length() >> 20) + " MB";
            List<String> console = fixture.consoleLines(APPLIANCE);
            String terminating = console.stream().filter(l -> l.contains("Terminating due to")).findFirst().orElse("none");
            lines.add(String.join("\t", "B", "heap=" + HEAP_OPTION, "client=" + clientOutcome, "clientMillis=" + clientMillis,
                    "exitStatus=" + status, "heapDump=" + dumpInfo, "terminatingLine=[" + terminating + "]"));
            Assertions.assertNotNull(status, "The JVM did not end within " + EXIT_WAIT_SECONDS + " seconds");
            Assertions.assertEquals(3, status.intValue(), "Exit status of a JVM that ends on an OutOfMemoryError with ExitOnOutOfMemoryError");
            Assertions.assertNotNull(dumps, "No logs folder");
            Assertions.assertTrue(dumps.length >= 1, "No heap dump in " + logsFolder);
            Assertions.assertTrue(terminating.contains("java.lang.OutOfMemoryError"), "No Terminating line in the console: " + terminating);
        } finally {
            fixture.tearDown();
            record(lines);
        }
    }
}
