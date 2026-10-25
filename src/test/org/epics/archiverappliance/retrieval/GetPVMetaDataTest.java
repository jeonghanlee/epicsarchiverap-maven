package org.epics.archiverappliance.retrieval;

import org.awaitility.Awaitility;
import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.epics.archiverappliance.utils.ui.JSONDecoder;
import org.epics.archiverappliance.utils.ui.JSONEncoder;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.json.simple.parser.JSONParser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

import static org.epics.archiverappliance.config.ConfigServiceForTests.MGMT_URL;
import static org.epics.archiverappliance.config.ConfigServiceForTests.RETRIEVAL_URL;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifies the getMetadata call of the retrieval application: the answer for a paused PV, which the engine
 * does not hold, carries the type information alone; the answer for a connected PV carries the type
 * information and the metadata of the engine.
 */
@Tag("integration")
public class GetPVMetaDataTest {
    private static final String PAUSED_PV = "TST-CT{}Sig:1-I";
    private static final String CONNECTED_PV = "UnitTestNoNamingConvention:sine";
    private static final String PROTOTYPE = "src/test/org/epics/archiverappliance/retrieval/postprocessor/data/PVTypeInfoPrototype.json";
    private final TomcatSetup tomcatSetup = new TomcatSetup();
    private final SIOCSetup siocSetup = new SIOCSetup();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    @BeforeEach
    public void setUp() throws Exception {
        tomcatSetup.setUpWebApps(this.getClass().getSimpleName());
    }

    @AfterEach
    public void tearDown() throws Exception {
        try {
            tomcatSetup.tearDown();
        } finally {
            siocSetup.stopSIOC();
        }
    }

    private static String enc(String pv) {
        return URLEncoder.encode(pv, StandardCharsets.UTF_8);
    }

    private HttpResponse<String> getMetadata(String pv) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create(RETRIEVAL_URL + "/getMetadata?pv=" + enc(pv)))
                .timeout(Duration.ofSeconds(15)).GET().build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private static String statusOf(String pv) {
        JSONArray status = GetUrlContent.getURLContentAsJSONArray(MGMT_URL + "/getPVStatus?pv=" + enc(pv));
        if (status == null || status.isEmpty()) {
            return "(absent)";
        }
        return String.valueOf(((JSONObject) status.get(0)).get("status"));
    }

    @Test
    public void pausedPVAnswersItsTypeInformation() throws Exception {
        // Put the type information of a paused PV; no IOC serves the PV and the engine does not hold it.
        JSONObject prototypeJSON = (JSONObject) JSONValue.parse(new InputStreamReader(new FileInputStream(PROTOTYPE)));
        PVTypeInfo prototype = new PVTypeInfo();
        JSONDecoder.getDecoder(PVTypeInfo.class).decode(prototypeJSON, prototype);
        PVTypeInfo pausedTypeInfo = new PVTypeInfo(PAUSED_PV, prototype);
        pausedTypeInfo.setPaused(true);
        pausedTypeInfo.setChunkKey("TST-CT{}Sig/1-I:");
        GetUrlContent.postObjectAndGetContentAsJSONObject(
                MGMT_URL + "/putPVTypeInfo?pv=" + enc(PAUSED_PV) + "&createnew=true",
                JSONEncoder.getEncoder(PVTypeInfo.class).encode(pausedTypeInfo));

        HttpResponse<String> response = getMetadata(PAUSED_PV);
        assertEquals(200, response.statusCode(), response.body());
        assertTrue(response.headers().firstValue("Content-Type").orElse("").startsWith("application/json"));
        assertFalse(response.body().isBlank(), "The answer for a paused PV is not empty");
        JSONObject answer = (JSONObject) new JSONParser().parse(response.body());
        assertEquals(PAUSED_PV, answer.get("pvName"));
        assertEquals("true", answer.get("paused"), "The type information of a paused PV says it is paused");
        assertEquals("appliance0", answer.get("applianceIdentity"));
    }

    @Test
    @Tag("localEpics")
    public void connectedPVAnswersTypeInformationAndEngineMetadata() throws Exception {
        siocSetup.startSIOCWithDefaultDB();
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONArray(MGMT_URL + "/archivePV?pv=" + enc(CONNECTED_PV)) != null);
        Awaitility.await()
                .atMost(Duration.ofMinutes(5))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> "Being archived".equals(statusOf(CONNECTED_PV)));
        // The EGU is captured a little after the connect; wait until the engine reports it.
        Awaitility.await()
                .atMost(Duration.ofMinutes(5))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> {
                    HttpResponse<String> response = getMetadata(CONNECTED_PV);
                    return response.statusCode() == 200
                            && "apples".equals(((JSONObject) new JSONParser().parse(response.body())).get("EGU"));
                });

        HttpResponse<String> response = getMetadata(CONNECTED_PV);
        assertEquals(200, response.statusCode(), response.body());
        JSONObject answer = (JSONObject) new JSONParser().parse(response.body());
        assertEquals(CONNECTED_PV, answer.get("pvName"));
        assertEquals("false", answer.get("paused"));
        assertEquals("apples", answer.get("EGU"), "The metadata of the engine is part of the answer");
        assertNotNull(answer.get("HOPR"));
    }
}
