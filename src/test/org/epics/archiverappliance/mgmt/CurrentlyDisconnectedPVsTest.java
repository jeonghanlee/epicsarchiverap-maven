package org.epics.archiverappliance.mgmt;

import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.TomcatSetup;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.json.simple.parser.JSONParser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

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
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

/** Verifies deployed reports with the shipped Tomcat and IOC fixtures. */
@Tag("integration")
public class CurrentlyDisconnectedPVsTest {
    private static final String MGMT = "http://127.0.0.1:17665/mgmt/bpl/";
    private static final String ENGINE = "http://127.0.0.1:17665/engine/bpl/";
    private static final String PREFIX = "M17DISC:";
    private static final List<String> ACTIVE = List.of(PREFIX + "test_0", PREFIX + "test_1");
    private static final String PAUSED = PREFIX + "test_2";
    private final TomcatSetup tomcat = new TomcatSetup();
    private final SIOCSetup ioc = new SIOCSetup(PREFIX);
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private Process ownedIoc;
    private final List<Map<String, Object>> lifecycle = new ArrayList<>();
    private final Path evidence = Path.of("work/disconnected-java-" + System.nanoTime());

    private Process fixtureIocProcess() throws Exception {
        var field = SIOCSetup.class.getDeclaredField("watchedProcess");
        field.setAccessible(true);
        return (Process) field.get(ioc);
    }

    private void recordIocExit(String phase) throws Exception {
        if (ownedIoc == null) return;
        boolean alive = ownedIoc.isAlive();
        int code = alive ? -1 : ownedIoc.exitValue();
        lifecycle.add(Map.of("phase", phase, "observed_at", Instant.now().toString(),
                "pid", ownedIoc.pid(), "alive", alive, "exit", code));
        Files.createDirectories(evidence);
        Files.writeString(evidence.resolve("ioc-lifecycle.json"), JSONValue.toJSONString(lifecycle));
        assertFalse(alive, "owned IOC survived " + phase);
        assertEquals(0, code, "owned IOC must exit normally");
    }

    @BeforeEach
    void setup() throws Exception {
        ioc.startSIOCWithDefaultDB();
        ownedIoc = fixtureIocProcess();
        tomcat.setUpWebApps(getClass().getSimpleName());
    }

    @AfterEach
    void cleanup() throws Exception {
        try {
            tomcat.tearDown();
        } finally {
            try {
                ioc.stopSIOC();
            } finally {
                recordIocExit("teardown");
            }
        }
    }

    private Object query(String base, String action) throws Exception {
        HttpResponse<String> response = http.send(HttpRequest.newBuilder(URI.create(base + action))
                .timeout(Duration.ofSeconds(15)).GET().build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        assertEquals(200, response.statusCode(), response.body());
        assertTrue(response.headers().firstValue("Content-Type").orElse("").startsWith("application/json"));
        return new JSONParser().parse(response.body());
    }

    private Object pvQuery(String action, String pv) throws Exception {
        return query(MGMT, action + "?pv=" + URLEncoder.encode(pv, StandardCharsets.UTF_8));
    }

    private boolean connected(String pv, String expected) throws Exception {
        JSONArray details = (JSONArray) pvQuery("getPVDetails", pv);
        return details.stream().anyMatch(value -> {
            Map<?, ?> row = (Map<?, ?>) value;
            return "pv".equals(row.get("source"))
                    && "Is this PV currently connected?".equals(row.get("name"))
                    && expected.equals(row.get("value"));
        });
    }

    private Set<String> names(String base, String action) throws Exception {
        return (Set<String>) ((JSONArray) query(base, action)).stream()
                .map(value -> (String) ((Map<?, ?>) value).get("pvName")).collect(Collectors.toSet());
    }

    private void await(CheckedCondition condition, int seconds, String description) throws Exception {
        long deadline = System.nanoTime() + Duration.ofSeconds(seconds).toNanos();
        while (System.nanoTime() < deadline) {
            if (condition.check()) return;
            Thread.sleep(1000);
        }
        fail(description + " deadline expired after " + seconds + " seconds");
    }

    @FunctionalInterface
    private interface CheckedCondition { boolean check() throws Exception; }

    @Test
    void reportsActualIocLossExcludesPausedAndRecovers() throws Exception {
        for (String pv : List.of(ACTIVE.get(0), ACTIVE.get(1), PAUSED)) {
            JSONArray result = (JSONArray) pvQuery("archivePV", pv);
            assertFalse(result.isEmpty());
            await(() -> "Being archived".equals(((JSONObject) ((JSONArray) pvQuery("getPVStatus", pv)).getFirst())
                    .get("status")), 360, "archive " + pv);
            await(() -> connected(pv, "yes"), 120, "connected " + pv);
        }
        assertEquals(Set.of(), names(MGMT, "getCurrentlyDisconnectedPVs"));
        pvQuery("pauseArchivingPV", PAUSED);
        await(() -> "Paused".equals(((JSONObject) ((JSONArray) pvQuery("getPVStatus", PAUSED)).getFirst())
                .get("status")), 120, "pause control");
        ioc.stopSIOC();
        recordIocExit("loss");
        for (String pv : ACTIVE) await(() -> connected(pv, "no"), 120, "disconnected " + pv);
        await(() -> names(MGMT, "getCurrentlyDisconnectedPVs").equals(Set.copyOf(ACTIVE)), 120, "management loss report");
        assertEquals(Set.copyOf(ACTIVE), names(ENGINE, "getCurrentlyDisconnectedPVsForThisAppliance"));
        JSONArray rows = (JSONArray) query(MGMT, "getCurrentlyDisconnectedPVs");
        for (Object value : rows) {
            Map<?, ?> row = (Map<?, ?>) value;
            assertTrue(Long.parseLong((String) row.get("noConnectionAsOfEpochSecs")) > 0);
            assertFalse(((String) row.get("connectionLostAt")).isEmpty());
        }
        Process original = ownedIoc;
        ioc.startSIOCWithDefaultDB();
        ownedIoc = fixtureIocProcess();
        assertNotSame(original, ownedIoc);
        assertNotEquals(original.pid(), ownedIoc.pid());
        for (String pv : ACTIVE) await(() -> connected(pv, "yes"), 120, "reconnected " + pv);
        await(() -> names(MGMT, "getCurrentlyDisconnectedPVs").isEmpty(), 120, "recovered report");
        assertEquals("Paused", ((JSONObject) ((JSONArray) pvQuery("getPVStatus", PAUSED)).getFirst()).get("status"));
    }
}
