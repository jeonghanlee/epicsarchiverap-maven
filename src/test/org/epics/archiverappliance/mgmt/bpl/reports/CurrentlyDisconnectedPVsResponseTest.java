package org.epics.archiverappliance.mgmt.bpl.reports;

import com.sun.net.httpserver.HttpServer;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ApplianceInfo;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.json.simple.parser.JSONParser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.lang.reflect.Proxy;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;

/** Executes shipped configuration and action; only engine HTTP and servlet boundaries are controlled. */
public class CurrentlyDisconnectedPVsResponseTest {
    private static final long LOCALE_EPOCH = 1767225600L;
    private ConfigServiceForTests config;
    private HttpServer engine, target;
    private ExecutorService workers;
    private String body = "[]", location;
    private int code = 200;
    private boolean closeBeforeHeaders;
    private long delayMillis;
    private final List<Map<String, String>> requests = new CopyOnWriteArrayList<>();
    private final List<String> sameOriginRequests = new CopyOnWriteArrayList<>();
    private final List<String> differentOriginRequests = new CopyOnWriteArrayList<>();
    private final List<JSONObject> observations = new ArrayList<>();

    private static class EngineConfig extends ConfigServiceForTests {
        EngineConfig(String address) throws Exception {
            super(-1);
            ApplianceInfo info = new ApplianceInfo(TESTAPPLIANCE0, address + "/mgmt", address + "/engine/bpl",
                    address + "/retrieval", address + "/etl", "127.0.0.1:1", address);
            appliances.put(TESTAPPLIANCE0, info);
            myApplianceInfo = info;
        }
    }

    @BeforeEach
    void setup() throws Exception {
        workers = Executors.newCachedThreadPool();
        engine = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        engine.setExecutor(workers);
        target = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        target.createContext("/target", exchange -> {
            differentOriginRequests.add(exchange.getRequestURI().toString());
            exchange.sendResponseHeaders(200, 2);
            exchange.getResponseBody().write("[]".getBytes(StandardCharsets.UTF_8));
            exchange.close();
        });
        engine.createContext("/target", exchange -> {
            sameOriginRequests.add(exchange.getRequestURI().toString());
            exchange.sendResponseHeaders(200, 2);
            exchange.getResponseBody().write("[]".getBytes(StandardCharsets.UTF_8));
            exchange.close();
        });
        engine.createContext("/engine/bpl/getCurrentlyDisconnectedPVsForThisAppliance", exchange -> {
            requests.add(Map.of("method", exchange.getRequestMethod(), "path", exchange.getRequestURI().getPath(),
                    "component", String.valueOf(exchange.getRequestHeaders().getFirst("ARCHAPPL_COMPONENT"))));
            try {
                if (closeBeforeHeaders) return;
                if (delayMillis > 0) Thread.sleep(delayMillis);
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json;charset=UTF-8");
                if (location != null) exchange.getResponseHeaders().set("Location", location);
                exchange.sendResponseHeaders(code, bytes.length == 0 ? -1 : bytes.length);
                if (bytes.length > 0) exchange.getResponseBody().write(bytes);
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
            }
        });
        engine.start();
        target.start();
        config = new EngineConfig("http://127.0.0.1:" + engine.getAddress().getPort());
    }

    @AfterEach
    void cleanup() throws Exception {
        if (engine != null) engine.stop(0);
        if (target != null) target.stop(0);
        if (workers != null) workers.shutdownNow();
        if (config != null) config.shutdownNow();
        Path folder = Path.of("work/disconnected-action-evidence");
        Files.createDirectories(folder);
        Files.writeString(folder.resolve(getClass().getSimpleName() + "-" + System.nanoTime() + ".json"),
                JSONValue.toJSONString(Map.of("requests", requests, "same_origin_targets", sameOriginRequests,
                        "different_origin_targets", differentOriginRequests,
                        "responses", observations)));
    }

    private static JSONObject row(String pv) {
        JSONObject row = new JSONObject();
        row.putAll(Map.of("pvName", pv, "instance", "appliance0", "connectionLostAt", "N/A",
                "lastKnownEvent", "Never", "noConnectionAsOfEpochSecs", "0", "hostName", "N/A",
                "commandThreadID", "1"));
        return row;
    }

    private static class ServletBoundary {
        int status = 200;
        String contentType, encoding;
        final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        PrintWriter writer;
    }

    private JSONObject execute() throws Exception {
        ServletBoundary boundary = new ServletBoundary();
        HttpServletResponse response = (HttpServletResponse) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[] {HttpServletResponse.class}, (proxy, method, args) -> switch (method.getName()) {
                    case "setContentType" -> { boundary.contentType = (String) args[0]; yield null; }
                    case "setCharacterEncoding" -> {
                        assertNull(boundary.writer, "encoding must be set before obtaining the writer");
                        boundary.encoding = (String) args[0]; yield null;
                    }
                    case "setStatus" -> { boundary.status = (int) args[0]; yield null; }
                    case "getWriter" -> {
                        assertEquals("UTF-8", boundary.encoding);
                        boundary.writer = new PrintWriter(new OutputStreamWriter(boundary.bytes, boundary.encoding));
                        yield boundary.writer;
                    }
                    default -> throw new AssertionError("Unexpected servlet operation: " + method.getName());
                });
        HttpServletRequest request = (HttpServletRequest) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[] {HttpServletRequest.class}, (proxy, method, args) -> {
                    throw new AssertionError("Unexpected request operation: " + method.getName());
                });
        long began = System.nanoTime();
        new CurrentlyDisconnectedPVs().execute(request, response, config);
        JSONObject observation = new JSONObject();
        observation.putAll(Map.of("status", boundary.status, "content_type", boundary.contentType,
                "encoding", boundary.encoding, "body", boundary.bytes.toString(StandardCharsets.UTF_8),
                "body_hex", HexFormat.of().formatHex(boundary.bytes.toByteArray()),
                "elapsed_seconds", (System.nanoTime() - began) / 1e9));
        observation.put("outbound_requests", List.copyOf(requests));
        observation.put("same_origin_targets", List.copyOf(sameOriginRequests));
        observation.put("different_origin_targets", List.copyOf(differentOriginRequests));
        observation.put("boundary_status", code);
        observation.put("boundary_location", location);
        observation.put("boundary_body", body);
        observations.add(observation);
        assertEquals("application/json", boundary.contentType);
        assertEquals("UTF-8", boundary.encoding);
        assertEquals(1, requests.size(), requests.toString());
        assertEquals("GET", requests.getFirst().get("method"));
        assertEquals("true", requests.getFirst().get("component"));
        assertEquals("/engine/bpl/getCurrentlyDisconnectedPVsForThisAppliance", requests.getFirst().get("path"));
        return observation;
    }

    private void expectError() throws Exception {
        JSONObject response = execute();
        assertEquals(503, response.get("status"));
        JSONObject error = assertInstanceOf(JSONObject.class, new JSONParser().parse((String) response.get("body")));
        assertEquals("error", error.get("status"));
        assertFalse(assertInstanceOf(String.class, error.get("desc")).isBlank());
    }

    @Test
    void healthyArraysPreserveEveryField() throws Exception {
        for (List<JSONObject> rows : List.of(List.<JSONObject>of(), List.of(row("TEST:A"), row("TEST:B")))) {
            requests.clear();
            body = JSONValue.toJSONString(rows);
            JSONObject response = execute();
            assertEquals(200, response.get("status"));
            assertEquals(new JSONParser().parse(body), new JSONParser().parse((String) response.get("body")));
        }
    }

    @ParameterizedTest
    @ValueSource(ints = {400, 404, 500, 503})
    void nonSuccessStatusIsCompleteError(int status) throws Exception {
        code = status;
        expectError();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "null", "{}", "42", "true", "not-json", "[", "[{}]", "[null]", "[1]"})
    void invalidDocumentsAreCompleteErrors(String document) throws Exception {
        body = document;
        expectError();
    }

    @Test
    void invalidLaterRowsNeverProducePartialArrays() throws Exception {
        for (String field : List.of("pvName", "instance", "connectionLostAt", "lastKnownEvent",
                "noConnectionAsOfEpochSecs", "hostName", "commandThreadID")) {
            for (Object invalid : List.of(12, true, List.of("text"))) {
                requests.clear();
                JSONObject invalidRow = row("TEST:B");
                invalidRow.put(field, invalid);
                body = JSONValue.toJSONString(List.of(row("TEST:A"), invalidRow));
                expectError();
            }
        }
        for (String field : List.of("pvName", "instance", "connectionLostAt", "lastKnownEvent", "noConnectionAsOfEpochSecs")) {
            for (Object invalid : List.of("", "\n")) {
                requests.clear();
                JSONObject invalidRow = row("TEST:B");
                invalidRow.put(field, invalid);
                body = JSONValue.toJSONString(List.of(row("TEST:A"), invalidRow));
                expectError();
            }
            requests.clear();
            JSONObject missing = row("TEST:B");
            missing.remove(field);
            body = JSONValue.toJSONString(List.of(row("TEST:A"), missing));
            expectError();
        }
        requests.clear();
        body = JSONValue.toJSONString(List.of(row("TEST:A"), row("TEST:A")));
        expectError();
    }

    @ParameterizedTest
    @ValueSource(ints = {301, 302, 303, 307, 308})
    void redirectsNeverSendRequestsToEitherTarget(int status) throws Exception {
        for (HttpServer destination : List.of(engine, target)) {
            requests.clear();
            sameOriginRequests.clear();
            differentOriginRequests.clear();
            code = status;
            location = "http://127.0.0.1:" + destination.getAddress().getPort() + "/target";
            expectError();
            assertTrue(sameOriginRequests.isEmpty(), sameOriginRequests.toString());
            assertTrue(differentOriginRequests.isEmpty(), differentOriginRequests.toString());
        }
    }

    @Test
    void acceptedGetResponseLossIsNotRetried() throws Exception {
        closeBeforeHeaders = true;
        expectError();
    }

    @Test
    void silentEngineReturnsFinalErrorWithinFifteenSeconds() throws Exception {
        delayMillis = 20000;
        expectError();
        assertTrue((double) observations.getLast().get("elapsed_seconds") < 15);
    }

    @Test
    void localeStringsSurviveActualActionUtf8Bytes() throws Exception {
        Locale original = Locale.getDefault();
        JSONArray captured = new JSONArray();
        try {
            for (Locale locale : List.of(Locale.US, Locale.FRANCE, Locale.JAPAN)) {
                requests.clear();
                Locale.setDefault(locale);
                JSONObject row = row("TEST:" + locale.toLanguageTag());
                row.put("connectionLostAt", TimeUtils.convertToHumanReadableString(LOCALE_EPOCH));
                row.put("lastKnownEvent", TimeUtils.convertToHumanReadableString(LOCALE_EPOCH));
                body = JSONValue.toJSONString(List.of(row));
                JSONObject response = execute();
                assertEquals(200, response.get("status"));
                JSONArray parsed = (JSONArray) new JSONParser().parse((String) response.get("body"));
                assertEquals(row, parsed.getFirst());
                captured.add(row);
            }
        } finally {
            Locale.setDefault(original);
        }
        MessageDigest hash = MessageDigest.getInstance("SHA-256");
        String sourceHash = HexFormat.of().formatHex(hash.digest(Files.readAllBytes(
                Path.of("src/main/org/epics/archiverappliance/common/TimeUtils.java"))));
        String classHash;
        try (var input = TimeUtils.class.getResourceAsStream("TimeUtils.class")) {
            classHash = HexFormat.of().formatHex(hash.digest(input.readAllBytes()));
        }
        Files.createDirectories(Path.of("work"));
        Files.writeString(Path.of("work/disconnected-locale.json"), JSONValue.toJSONString(Map.of(
                "epoch", LOCALE_EPOCH, "source_sha256", sourceHash, "class_sha256", classHash, "rows", captured)));
    }

    @Test
    void timestampControlsAndLineSeparatorsAreRejected() throws Exception {
        for (String field : List.of("connectionLostAt", "lastKnownEvent")) {
            for (int control : List.of(0, 9, 10, 13, 31, 127, 128, 159, 0x2028, 0x2029)) {
                requests.clear();
                JSONObject invalid = row("TEST:B");
                invalid.put(field, "time" + (char) control);
                body = JSONValue.toJSONString(List.of(row("TEST:A"), invalid));
                expectError();
            }
        }
    }
}
