package org.epics.archiverappliance.retrieval;

import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Duration;
import java.time.Instant;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Sends the retrieval candidates that neither the declared-size estimate nor the in-loop check covers to the built WARs
 * on a fixture-owned JVM with the heap of the memory tests. Each candidate gets its own JVM, because
 * {@code -XX:+ExitOnOutOfMemoryError} ends the JVM of a candidate that exhausts the heap. A candidate passes when the
 * request is refused with a named condition or completes whole, and the JVM is alive without an OutOfMemoryError.
 */
@Tag("integration")
public class RetrievalOperatorMemoryNetworkTest {
    private static final String APPLIANCE = "appliance0";
    private static final int NAMES = Integer.getInteger("archappl.memory.test.listNames", 10_000);
    /** The request line, with its method and protocol, may not pass 8 KiB (maxHttpHeaderSize of the container). */
    private static final int ADDRESS_BYTES = Integer.getInteger("archappl.memory.test.addressBytes", 8_000);
    private static final Duration BODY_DEADLINE = Duration.ofSeconds(120);
    private static final String PV = RetrievalMemoryNetworkFixture.PV;
    private static final Instant FROM = RetrievalMemoryNetworkFixture.FROM;
    private static final Instant TO = RetrievalMemoryNetworkFixture.TO;

    private record Outcome(int status, long bytes, String failure, String head) {}

    @FunctionalInterface
    private interface Candidate extends Function<RetrievalMemoryNetworkFixture, HttpRequest> {}

    private static String iso(Instant instant) {
        return RetrievalMemoryNetworkFixture.encode(TimeUtils.convertToISO8601String(instant));
    }

    /** The names of a list request: the registered PV, so that every name reaches the type information and the store. */
    private static String jsonNames(int count) {
        StringBuilder body = new StringBuilder("[");
        for (int i = 0; i < count; i++) body.append(i == 0 ? "" : ",").append('"').append(PV).append('"');
        return body.append(']').toString();
    }

    /** Distinct names that the appliance does not archive: the answer to getDataAtTime skips each of them. */
    private static String jsonUnarchivedNames(int count) {
        StringBuilder body = new StringBuilder("[");
        for (int i = 0; i < count; i++) body.append(i == 0 ? "" : ",").append(String.format("\"Candidate:NoSuchPV:%05d\"", i));
        return body.append(']').toString();
    }

    /**
     * Distinct names that all name the registered PV: the server reads {@code operator(name)} and the operator
     * argument differs, so no name collapses into another and every name has data. A name that is not archived ends
     * getDataForPVs at the first such name with 404, and so measures nothing about the length of the list.
     */
    private static String jsonDistinctValidNames(int count) {
        StringBuilder body = new StringBuilder("[");
        for (int i = 1; i <= count; i++) body.append(i == 1 ? "" : ",").append("\"mean_").append(i).append('(').append(PV).append(")\"");
        return body.append(']').toString();
    }

    private static HttpRequest get(URI uri) {
        return HttpRequest.newBuilder(uri).timeout(RetrievalMemoryNetworkFixture.TIMEOUT).GET().build();
    }

    /** The content type is exactly application/json: the server compares the whole string (PVsMatchingParameter). */
    private static HttpRequest post(URI uri, String body) {
        return HttpRequest.newBuilder(uri).timeout(RetrievalMemoryNetworkFixture.TIMEOUT)
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build();
    }

    private static Outcome send(RetrievalMemoryNetworkFixture server, HttpRequest request) {
        try {
            HttpResponse<InputStream> response = server.client.send(request, HttpResponse.BodyHandlers.ofInputStream());
            long deadline = System.nanoTime() + BODY_DEADLINE.toNanos();
            byte[] chunk = new byte[8192];
            byte[] head = new byte[400];
            int headLength = 0;
            long bytes = 0;
            try (InputStream body = response.body()) {
                int read;
                while ((read = body.read(chunk)) >= 0) {
                    if (headLength < head.length) {
                        int copy = Math.min(read, head.length - headLength);
                        System.arraycopy(chunk, 0, head, headLength, copy);
                        headLength += copy;
                    }
                    bytes += read;
                    if (System.nanoTime() > deadline) return new Outcome(response.statusCode(), bytes, "body deadline", "");
                }
            } catch (IOException ex) {
                return new Outcome(response.statusCode(), bytes, "body " + ex, new String(head, 0, headLength, StandardCharsets.UTF_8));
            }
            return new Outcome(response.statusCode(), bytes, "", new String(head, 0, headLength, StandardCharsets.UTF_8));
        } catch (Exception ex) {
            return new Outcome(-1, 0, ex.toString(), "");
        }
    }

    /** A heap dump is written when an OutOfMemoryError ends the JVM (-XX:+HeapDumpOnOutOfMemoryError). */
    private static boolean hasHeapDump(RetrievalMemoryNetworkFixture server) throws IOException {
        try (var files = Files.list(server.evidence)) {
            return files.anyMatch(file -> file.getFileName().toString().endsWith(".hprof"));
        }
    }

    private void check(String label, Candidate candidate) throws Exception {
        try (var server = new RetrievalMemoryNetworkFixture()) {
            HttpRequest request = candidate.apply(server);
            Outcome outcome;
            long peakHeap;
            long peakCollected;
            try (var peak = server.startHeapPeak()) {
                outcome = send(server, request);
                peakHeap = peak.peak();
                peakCollected = peak.peakCollected();
            }
            boolean alive = server.tomcat.exitStatus(APPLIANCE) == null;
            // The command line options in the console log name OutOfMemoryError too, so only the exception counts.
            boolean exhausted = server.tomcat.consoleLines(APPLIANCE).stream()
                    .anyMatch(line -> line.contains("java.lang.OutOfMemoryError"))
                    || hasHeapDump(server);
            long afterCollection = -1;
            long maximum = -1;
            if (alive) {
                server.memory.gc();
                afterCollection = server.memory.getHeapMemoryUsage().getUsed();
                maximum = server.memory.getHeapMemoryUsage().getMax();
            }
            String refusal = server.tomcat.consoleLines(APPLIANCE).stream()
                    .filter(line -> line.contains("Retrieval memory pressure:")
                            || line.contains("Retrieval memory admission refused:")
                            || line.contains("exceeds request budget"))
                    .findFirst().orElse("");
            // A refusal counts only when the server log names a memory condition: an unknown operator or a malformed
            // body also ends in 400, and a server that is still starting ends in 503, and neither is a result.
            String result = exhausted || !alive ? "exhausted"
                    : (outcome.status() == 400 || outcome.status() == 503) && !refusal.isEmpty() ? "refused"
                    : outcome.status() == 200 && outcome.failure().isEmpty() ? "completed" : "failed";
            String line = "T1 candidate=" + label + " result=" + result + " status=" + outcome.status()
                    + " bytes=" + outcome.bytes() + " failure=[" + outcome.failure() + "] jvmAlive=" + alive
                    + " outOfMemoryError=" + exhausted + " peakHeap=" + peakHeap + " peakCollected=" + peakCollected + " heapAfterCollection=" + afterCollection + " maxHeap=" + maximum
                    + " request=" + request.method() + " " + request.uri().toString().length() + " characters"
                    + " refusalLog=[" + refusal + "] head=[" + outcome.head().replace('\n', ' ') + "]";
            Files.writeString(server.evidence.resolve("operator-" + label + ".txt"), line + "\n");
            System.out.println(line);
            assertTrue(alive && !exhausted, "The candidate exhausted the heap or ended the JVM: " + line);
            assertTrue(result.equals("refused") || result.equals("completed"), "No result for the candidate: " + line);
        }
    }

    private static URI raw(String processor, Instant from, Instant to, RetrievalMemoryNetworkFixture server) {
        return server.uri("json", processor, from, to);
    }

    @Test public void firstSampleOverTheRawRange() throws Exception {
        check("firstSample", server -> get(raw("firstSample", FROM, TO, server)));
    }

    @Test public void deadBandOverTheRawRange() throws Exception {
        check("deadBand", server -> get(raw("deadBand", FROM, TO, server)));
    }

    @Test public void flyersOverTheRawRange() throws Exception {
        check("flyers", server -> get(raw("flyers", FROM, TO, server)));
    }

    @Test public void ignoreflyersOverTheRawRange() throws Exception {
        check("ignoreflyers", server -> get(raw("ignoreflyers", FROM, TO, server)));
    }

    /** median keeps every value of a bin; mean_3600 over the same range is the control that the declared size covers. */
    @Test public void medianOverThirtyDays() throws Exception {
        check("median_3600", server -> get(raw("median_3600", FROM, TO, server)));
    }

    @Test public void kurtosisOverThirtyDays() throws Exception {
        check("kurtosis_3600", server -> get(raw("kurtosis_3600", FROM, TO, server)));
    }

    @Test public void skewnessOverThirtyDays() throws Exception {
        check("skewness_3600", server -> get(raw("skewness_3600", FROM, TO, server)));
    }

    @Test public void meanControlOverThirtyDays() throws Exception {
        check("mean_3600", server -> get(raw("mean_3600", FROM, TO, server)));
    }

    @Test public void getDataForPVsByPostWithAListOfNames() throws Exception {
        check("getDataForPVs-post-" + NAMES, server -> post(URI.create(ConfigServiceForTests.DATA_RETRIEVAL_URL
                + "/data/getDataForPVs.json?from=" + iso(FROM) + "&to=" + iso(FROM.plusSeconds(3600))), jsonNames(NAMES)));
    }

    /** The GET carries each name in the address, so the container limits it to about 8 KiB of request line. */
    @Test public void getDataForPVsByGetWithTheMostNamesTheAddressAllows() throws Exception {
        String base = ConfigServiceForTests.DATA_RETRIEVAL_URL + "/data/getDataForPVs.json?from=" + iso(FROM)
                + "&to=" + iso(FROM.plusSeconds(3600));
        String one = "&pv=" + RetrievalMemoryNetworkFixture.encode(PV);
        // the request line is "GET " + path and query + " HTTP/1.1"; the host and port are not part of it
        int fixed = "GET ".length() + " HTTP/1.1".length() + base.length() - URI.create(base).getScheme().length()
                - "://".length() - URI.create(base).getAuthority().length();
        int count = Math.max(1, (ADDRESS_BYTES - fixed) / one.length());
        check("getDataForPVs-get-" + count, server -> get(URI.create(base + one.repeat(count))));
    }

    @Test public void getDataForPVsByPostWithDistinctValidNames() throws Exception {
        check("getDataForPVs-post-distinct-" + NAMES, server -> post(URI.create(ConfigServiceForTests.DATA_RETRIEVAL_URL
                + "/data/getDataForPVs.json?from=" + iso(FROM) + "&to=" + iso(FROM.plusSeconds(3600))),
                jsonDistinctValidNames(NAMES)));
    }

    @Test public void getDataAtTimeWithUnarchivedNames() throws Exception {
        check("getDataAtTime-unarchived-" + NAMES, server -> post(URI.create(ConfigServiceForTests.DATA_RETRIEVAL_URL
                + "/data/getDataAtTime?at=" + iso(FROM.plusSeconds(86400))), jsonUnarchivedNames(NAMES)));
    }

    @Test public void getDataAtTimeWithAListOfNames() throws Exception {
        check("getDataAtTime-" + NAMES, server -> post(URI.create(ConfigServiceForTests.DATA_RETRIEVAL_URL
                + "/data/getDataAtTime?at=" + iso(FROM.plusSeconds(86400))), jsonNames(NAMES)));
    }
}
