package org.epics.archiverappliance.mgmt;

import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.TomcatSetup;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
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
import java.time.Duration;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * Verifies the limit parameter of the paused PVs report and of the paused PVs of one appliance
 * with the shipped Tomcat and IOC fixtures: a limit below the number of paused PVs cuts the answer,
 * a limit that is not an integer of at least 1 answers HTTP 400 and an absent limit returns all.
 */
@Tag("integration")
public class PausedPVsLimitTest {
    private static final String MGMT = "http://127.0.0.1:17665/mgmt/bpl/";
    private static final String PREFIX = "M84PAUSE:";
    private static final List<String> PVS = List.of(PREFIX + "test_0", PREFIX + "test_1", PREFIX + "test_2");
    private static final String REPORT = "getPausedPVsReport";
    private static final String THIS_APPLIANCE = "getPausedPVsForThisAppliance";
    private final TomcatSetup tomcat = new TomcatSetup();
    private final SIOCSetup ioc = new SIOCSetup(PREFIX);
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    @BeforeEach
    void setup() throws Exception {
        ioc.startSIOCWithDefaultDB();
        tomcat.setUpWebApps(getClass().getSimpleName());
    }

    @AfterEach
    void cleanup() throws Exception {
        try {
            tomcat.tearDown();
        } finally {
            ioc.stopSIOC();
        }
    }

    private HttpResponse<String> get(String action, String query) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create(MGMT + action + query))
                .timeout(Duration.ofSeconds(15)).GET().build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private Object pvQuery(String action, String pv) throws Exception {
        HttpResponse<String> response = get(action, "?pv=" + URLEncoder.encode(pv, StandardCharsets.UTF_8));
        assertEquals(200, response.statusCode(), response.body());
        return new JSONParser().parse(response.body());
    }

    private String statusOf(String pv) throws Exception {
        return (String) ((JSONObject) ((JSONArray) pvQuery("getPVStatus", pv)).getFirst()).get("status");
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

    /** Names of the paused PVs that the call answers; a row of the report is an object, an entry of the appliance call a name. */
    private List<String> pausedNames(String action, String query) throws Exception {
        HttpResponse<String> response = get(action, query);
        assertEquals(200, response.statusCode(), action + query + ": " + response.body());
        assertTrue(response.headers().firstValue("Content-Type").orElse("").startsWith("application/json"));
        JSONArray entries = (JSONArray) new JSONParser().parse(response.body());
        return entries.stream()
                .map(entry -> entry instanceof JSONObject row ? (String) row.get("pvName") : (String) entry)
                .toList();
    }

    private void assertLimited(String action, String query, int expected) throws Exception {
        List<String> names = pausedNames(action, query);
        assertEquals(expected, names.size(), action + query + " answered " + names);
        assertEquals(names.size(), Set.copyOf(names).size(), action + query + " repeats a PV: " + names);
        assertTrue(PVS.containsAll(names), action + query + " answered a PV that was not paused: " + names);
    }

    private void assertRejected(String action, String query) throws Exception {
        HttpResponse<String> response = get(action, query);
        assertEquals(400, response.statusCode(), action + query + ": " + response.body());
    }

    @Test
    void limitCutsTheAnswerAndABadLimitIsRejected() throws Exception {
        for (String pv : PVS) {
            JSONArray result = (JSONArray) pvQuery("archivePV", pv);
            assertFalse(result.isEmpty());
            await(() -> "Being archived".equals(statusOf(pv)), 360, "archive " + pv);
        }
        for (String pv : PVS) {
            pvQuery("pauseArchivingPV", pv);
            await(() -> "Paused".equals(statusOf(pv)), 120, "pause " + pv);
        }

        for (String action : List.of(REPORT, THIS_APPLIANCE)) {
            assertLimited(action, "?limit=2", 2);
            assertLimited(action, "?limit=1", 1);
            assertLimited(action, "?limit=3", 3);
            assertLimited(action, "?limit=10", 3);
            assertLimited(action, "", 3);
            assertRejected(action, "?limit=0");
            assertRejected(action, "?limit=-1");
            assertRejected(action, "?limit=x");
            assertRejected(action, "?limit=");
            assertRejected(action, "?limit=2.5");
        }
    }
}
