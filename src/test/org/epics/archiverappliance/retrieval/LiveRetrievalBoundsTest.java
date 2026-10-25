package org.epics.archiverappliance.retrieval;

import com.sun.net.httpserver.HttpServer;
import edu.stanford.slac.archiverappliance.PBOverHTTP.InputStreamBackedEventStream;
import edu.stanford.slac.archiverappliance.PBOverHTTP.PBOverHTTPStoragePlugin;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.epics.archiverappliance.retrieval.mimeresponses.JSONResponse;
import org.epics.archiverappliance.utils.ui.StreamPBIntoOutput;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.json.simple.parser.JSONParser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.InetSocketAddress;
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
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.*;

/** Exercises exact retrieval bounds using PB bytes acquired from the original IOC. */
@Tag("integration")
public class LiveRetrievalBoundsTest {
    private static final String ROOT = "http://127.0.0.1:17665";
    private static final String PREFIX = "BOUNDSTEST:";
    private static final String PV = PREFIX + "test_0";
    private final TomcatSetup tomcat = new TomcatSetup();
    private final SIOCSetup ioc = new SIOCSetup(PREFIX);
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private long observationDeadline = Long.MAX_VALUE;
    private Process ownedIoc;

    @SuppressWarnings("unchecked")
    private List<Process> tomcatProcesses() throws Exception {
        var field = TomcatSetup.class.getDeclaredField("watchedProcesses");
        field.setAccessible(true);
        return List.copyOf((List<Process>) field.get(tomcat));
    }

    @BeforeEach
    void setup() throws Exception {
        ioc.startSIOCWithDefaultDB();
        var field = SIOCSetup.class.getDeclaredField("watchedProcess");
        field.setAccessible(true);
        ownedIoc = (Process) field.get(ioc);
        tomcat.setUpWebApps(getClass().getSimpleName());
    }

    @AfterEach
    void cleanup() throws Exception {
        List<Process> children = tomcatProcesses();
        try {
            tomcat.tearDown();
        } finally {
            ioc.stopSIOC();
        }
        for (Process child : children) {
            assertFalse(child.isAlive(), "owned Tomcat survived teardown");
            assertEquals(143, child.exitValue(), "owned Tomcat must exit after ordinary SIGTERM");
        }
        if (ownedIoc != null) {
            assertFalse(ownedIoc.isAlive(), "owned IOC survived teardown");
            assertEquals(0, ownedIoc.exitValue(), "owned IOC must exit normally");
        }
    }

    private byte[] get(String url) throws Exception {
        long remaining = observationDeadline == Long.MAX_VALUE ? Duration.ofSeconds(15).toNanos()
                : observationDeadline - System.nanoTime();
        assertTrue(remaining > 0, "observation deadline expired");
        var response = http.send(HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofNanos(Math.min(Duration.ofSeconds(15).toNanos(), remaining)))
                .GET().build(), HttpResponse.BodyHandlers.ofByteArray());
        assertEquals(200, response.statusCode(), new String(response.body(), StandardCharsets.UTF_8));
        return response.body();
    }

    private static String bounds(String pv, Instant start, Instant end) {
        return "?pv=" + URLEncoder.encode(pv, StandardCharsets.UTF_8)
                + "&from=" + start + "&to=" + end;
    }

    private static InputStreamBackedEventStream stream(byte[] data, Instant start) throws Exception {
        return new InputStreamBackedEventStream(new ByteArrayInputStream(data), start);
    }

    private static List<Event> events(byte[] data, Instant start) throws Exception {
        List<Event> rows = new ArrayList<>();
        try (var input = stream(data, start)) {
            for (Event event : input) rows.add(event.makeClone());
        }
        return rows;
    }

    private static List<Instant> timestamps(byte[] data, Instant start) throws Exception {
        return events(data, start).stream().map(Event::getEventTimeStamp).toList();
    }

    private static List<Instant> jsonTimestamps(byte[] data) throws Exception {
        JSONArray body = (JSONArray) new JSONParser().parse(new String(data, StandardCharsets.UTF_8));
        assertEquals(1, body.size());
        JSONArray rows = (JSONArray) ((JSONObject) body.getFirst()).get("data");
        List<Instant> result = new ArrayList<>();
        for (Object value : rows) {
            JSONObject row = (JSONObject) value;
            result.add(Instant.ofEpochSecond(((Number) row.get("secs")).longValue(),
                    ((Number) row.get("nanos")).longValue()));
        }
        return result;
    }

    private List<Instant> merge(byte[] data, Instant start, Instant end, boolean switchPv) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (var context = new BasicContext(); var input = stream(data, start);
             var consumer = new MergeDedupConsumer(new JSONResponse(), output)) {
            consumer.processingPV(context, PV, start, end, input.getDescription());
            consumer.consumeEventStream(input);
            if (switchPv) consumer.processingPV(context, PV + ":next", start, end, input.getDescription());
        }
        JSONArray body = (JSONArray) new JSONParser().parse(output.toString(StandardCharsets.UTF_8));
        List<Instant> result = new ArrayList<>();
        for (Object item : body) {
            for (Object value : (JSONArray) ((JSONObject) item).get("data")) {
                JSONObject row = (JSONObject) value;
                result.add(Instant.ofEpochSecond(((Number) row.get("secs")).longValue(),
                        ((Number) row.get("nanos")).longValue()));
            }
        }
        return result;
    }

    @Test
    void exactBoundsSurvivePublicHttpStreamingSerializationAndFinalFlush() throws Exception {
        get(ROOT + "/mgmt/bpl/archivePV?pv=" + PV + "&samplingperiod=0.1");
        long archiveDeadline = System.nanoTime() + Duration.ofSeconds(360).toNanos();
        observationDeadline = archiveDeadline;
        boolean archived = false;
        while (System.nanoTime() < archiveDeadline) {
            JSONArray status = (JSONArray) new JSONParser().parse(new String(
                    get(ROOT + "/mgmt/bpl/getPVStatus?pv=" + PV), StandardCharsets.UTF_8));
            if (!status.isEmpty() && "Being archived".equals(((JSONObject) status.getFirst()).get("status"))) {
                archived = true;
                break;
            }
            Thread.sleep(Duration.ofNanos(Math.min(Duration.ofSeconds(1).toNanos(),
                    Math.max(0, observationDeadline - System.nanoTime()))));
        }
        assertTrue(archived, "archive setup deadline expired");
        Instant start = Instant.now().minusSeconds(30);
        byte[] captured = null;
        List<Event> acquired = List.of();
        long deadline = System.nanoTime() + Duration.ofSeconds(120).toNanos();
        observationDeadline = deadline;
        while (System.nanoTime() < deadline) {
            captured = get(ROOT + "/engine/bpl/getData.raw" + bounds(PV, start, Instant.now().plusSeconds(1)));
            acquired = events(captured, start);
            if (acquired.size() >= 2 && acquired.getLast().getEventTimeStamp().getNano() % 1_000_000 != 0) break;
            Thread.sleep(Duration.ofNanos(Math.min(Duration.ofSeconds(1).toNanos(),
                    Math.max(0, observationDeadline - System.nanoTime()))));
        }
        assertTrue(acquired.size() >= 2, "real engine samples unavailable");
        Instant target = acquired.getLast().getEventTimeStamp();
        assertNotEquals(0, target.getNano() % 1_000_000, "target must exercise submillisecond precision");
        observationDeadline = Long.MAX_VALUE;
        byte[] original = captured;
        Instant first = acquired.getFirst().getEventTimeStamp();
        byte[] single = get(ROOT + "/engine/bpl/getData.raw" + bounds(PV, target, target));
        assertEquals(List.of(target), timestamps(single, target), "actual single-event engine response required");
        Path evidence = Path.of("work/retrieval-bounds-java-" + System.nanoTime());
        Files.createDirectories(evidence);
        Files.write(evidence.resolve("engine.raw"), original);
        Files.write(evidence.resolve("single-event.raw"), single);
        Files.writeString(evidence.resolve("target.txt"), target.toString());

        assertAll(
                () -> {
                    var excluded = jsonTimestamps(get(ROOT + "/retrieval/data/getData.json"
                            + bounds(PV, start, target.minusNanos(1))));
                    assertTrue(excluded.stream().noneMatch(t -> t.isAfter(target.minusNanos(1))), "public overflow");
                    var included = jsonTimestamps(get(ROOT + "/retrieval/data/getData.json" + bounds(PV, start, target)));
                    assertTrue(included.contains(target), "exact public boundary must retain target");
                    assertTrue(timestamps(get(ROOT + "/engine/bpl/getData.raw"
                            + bounds(PV, start, Instant.now().plusSeconds(1))), start).contains(target),
                            "target aged out of actual engine buffer");
                },
                () -> {
                    ByteArrayOutputStream output = new ByteArrayOutputStream();
                    StreamPBIntoOutput.streamPBIntoOutputStream(stream(original, start), output, start, target.minusNanos(1));
                    assertTrue(timestamps(output.toByteArray(), start).stream()
                            .noneMatch(t -> t.isAfter(target.minusNanos(1))), "engine fractional overflow");
                    output.reset();
                    StreamPBIntoOutput.streamPBIntoOutputStream(stream(original, start), output, start, target);
                    assertTrue(timestamps(output.toByteArray(), start).contains(target), "engine exact inclusion");
                },
                () -> assertTrue(merge(original, start, target.minusNanos(1), false).stream()
                        .noneMatch(t -> t.isAfter(target.minusNanos(1))), "merge overflow"),
                () -> assertEquals(List.of(), merge(single, start, target.minusNanos(1), false), "close-only overflow"),
                () -> assertEquals(List.of(), merge(single, start, target.minusNanos(1), true), "PV-switch overflow"),
                () -> {
                    Instant from = first.plusNanos(1);
                    List<Instant> merged = merge(original, from, target, false);
                    assertTrue(merged.contains(first), "supported preceding value must survive");
                    assertTrue(merged.contains(target), "merge exact inclusion");
                },
                () -> {
                    Instant rollover = Instant.ofEpochSecond(target.getEpochSecond());
                    assertTrue(merge(original, start, rollover, false).stream()
                            .noneMatch(t -> t.isAfter(rollover)), "second rollover overflow");
                },
                () -> verifySerialization(original, start, target));
    }

    private void verifySerialization(byte[] captured, Instant start, Instant end) throws Exception {
        List<String> requests = new CopyOnWriteArrayList<>();
        HttpServer boundary = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        boundary.createContext("/raw", exchange -> {
            requests.add(exchange.getRequestURI().getRawQuery());
            exchange.sendResponseHeaders(200, captured.length);
            try (var output = exchange.getResponseBody()) { output.write(captured); }
        });
        boundary.start();
        try (var context = new BasicContext()) {
            var plugin = new PBOverHTTPStoragePlugin();
            String url = "http://127.0.0.1:" + boundary.getAddress().getPort() + "/raw";
            plugin.initialize("pbraw://localhost?rawURL=" + URLEncoder.encode(url, StandardCharsets.UTF_8),
                    new ConfigServiceForTests(-1));
            for (var callable : plugin.getDataForPV(context, PV, start, end, null)) {
                try (var input = callable.call()) { assertNotNull(input.getDescription()); }
            }
            for (var callable : plugin.getDataForMultiPVs(context, List.of(PV, PV + ":next"), start, end, null)) {
                try (var input = callable.call()) { assertNotNull(input.getDescription()); }
            }
            assertEquals(2, requests.size());
            for (String request : requests) {
                assertTrue(request.contains("&from=" + start), request);
                assertTrue(request.contains("&to=" + end), request);
            }
        } finally {
            boundary.stop(0);
        }
    }

    /** Decodes real HTTP PB responses with the shipped stream reader for the Python runner. */
    @SuppressWarnings("unchecked")
    public static void main(String[] args) throws Exception {
        if (args.length != 2) throw new IllegalArgumentException("Usage: LiveRetrievalBoundsTest <raw-file> <from>");
        for (Event event : events(Files.readAllBytes(Path.of(args[0])), Instant.parse(args[1]))) {
            DBRTimeEvent sample = (DBRTimeEvent) event;
            JSONObject row = new JSONObject();
            row.put("secs", sample.getEpochSeconds());
            row.put("nanos", sample.getEventTimeStamp().getNano());
            row.put("val", sample.getSampleValue().getValue());
            row.put("status", sample.getStatus());
            row.put("severity", sample.getSeverity());
            System.out.println(JSONValue.toJSONString(row));
        }
    }
}
