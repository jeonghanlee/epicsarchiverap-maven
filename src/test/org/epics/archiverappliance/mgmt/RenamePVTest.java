package org.epics.archiverappliance.mgmt;

import org.apache.commons.io.FileUtils;
import org.awaitility.Awaitility;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.EventStream;
import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.epics.archiverappliance.retrieval.client.RawDataRetrievalAsEventStream;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/** Verifies that rename copies configuration and exact samples, retaining both paused names. */
@Tag("integration")
@Tag("localEpics")
public class RenamePVTest {
    private static final String MGMT = "http://localhost:17665/mgmt/bpl/";
    private static final String OLD_NAME = "UnitTestNoNamingConvention:sine";
    private static final String NEW_NAME = "UnitTestNoNamingConvention:sinerenamed";
    private static final String[] COPIED_FIELDS = {
        "paused", "samplingMethod", "samplingPeriod", "DBRType", "scalar", "elementCount",
        "policyName", "dataStores", "archiveFields", "usePVAccess", "useDBEProperties", "creationTime"
    };
    private final TomcatSetup tomcatSetup = new TomcatSetup();
    private final SIOCSetup siocSetup = new SIOCSetup();

    private record Sample(long seconds, int nanos, Object value, int status, int severity) {}

    @BeforeEach
    public void setUp() throws Exception {
        deleteStoredData();
        siocSetup.startSIOCWithDefaultDB();
        tomcatSetup.setUpWebApps(getClass().getSimpleName());
    }

    @AfterEach
    public void tearDown() throws Exception {
        try {
            tomcatSetup.tearDown();
        } finally {
            try {
                siocSetup.stopSIOC();
            } finally {
                deleteStoredData();
            }
        }
    }

    private static void deleteStoredData() throws IOException {
        for (String store : new String[] {
            System.getenv("ARCHAPPL_SHORT_TERM_FOLDER"),
            System.getenv("ARCHAPPL_MEDIUM_TERM_FOLDER"),
            System.getenv("ARCHAPPL_LONG_TERM_FOLDER")
        }) {
            if (store != null) {
                File pvFolder = new File(store, "UnitTestNoNamingConvention");
                if (pvFolder.exists()) {
                    FileUtils.deleteDirectory(pvFolder);
                }
            }
        }
    }

    private static String enc(String pv) {
        return URLEncoder.encode(pv, StandardCharsets.UTF_8);
    }

    private static String statusOf(String pv) throws Exception {
        JSONArray status = GetUrlContent.getURLContentAsJSONArray(MGMT + "getPVStatus?pv=" + enc(pv));
        return status == null || status.isEmpty() ? "(absent)"
                : String.valueOf(((JSONObject) status.get(0)).get("status"));
    }

    private static JSONObject typeInfo(String pv) throws Exception {
        JSONObject body = GetUrlContent.getURLContentAsJSONObject(MGMT + "getPVTypeInfo?pv=" + enc(pv));
        Assertions.assertNotNull(body);
        Assertions.assertEquals(pv, body.get("pvName"));
        return body;
    }

    private static Map<Sample, Integer> samples(String pvName, Instant start, Instant end) throws IOException {
        RawDataRetrievalAsEventStream retrieval = new RawDataRetrievalAsEventStream(
                "http://localhost:" + ConfigServiceForTests.RETRIEVAL_TEST_PORT + "/retrieval/data/getData.raw");
        Map<Sample, Integer> records = new HashMap<>();
        try (EventStream stream = retrieval.getDataForPVS(new String[] {pvName}, start, end, null)) {
            Assertions.assertNotNull(stream, "Expected an actual retrieval stream");
            for (Event event : stream) {
                DBRTimeEvent sample = (DBRTimeEvent) event;
                records.merge(new Sample(sample.getEpochSeconds(), sample.getEventTimeStamp().getNano(),
                        sample.getSampleValue().getValue(), sample.getStatus(), sample.getSeverity()), 1, Integer::sum);
            }
        }
        return records;
    }

    @Test
    public void testRenamePV() throws Exception {
        Instant start = Instant.now();
        JSONArray archive = GetUrlContent.getURLContentAsJSONArray(MGMT + "archivePV?pv=" + enc(OLD_NAME));
        Assertions.assertNotNull(archive);
        Awaitility.await().atMost(Duration.ofSeconds(360)).pollInterval(Duration.ofSeconds(1))
                .until(() -> "Being archived".equals(statusOf(OLD_NAME)));
        Awaitility.await().atMost(Duration.ofSeconds(120)).pollInterval(Duration.ofSeconds(1))
                .until(() -> samples(OLD_NAME, start, Instant.now()).values().stream().mapToInt(Integer::intValue).sum() >= 3);
        JSONObject pause = GetUrlContent.getURLContentAsJSONObject(MGMT + "pauseArchivingPV?pv=" + enc(OLD_NAME));
        Assertions.assertNotNull(pause);
        Assertions.assertEquals("ok", pause.get("status"));
        Awaitility.await().atMost(Duration.ofSeconds(120)).pollInterval(Duration.ofSeconds(1))
                .until(() -> "Paused".equals(statusOf(OLD_NAME)));
        Instant end = Instant.now();
        JSONObject sourceInfo = typeInfo(OLD_NAME);
        Map<Sample, Integer> baseline = samples(OLD_NAME, start, end);
        Assertions.assertTrue(baseline.values().stream().mapToInt(Integer::intValue).sum() >= 3);

        JSONObject response = GetUrlContent.getURLContentAsJSONObject(
                MGMT + "renamePV?pv=" + enc(OLD_NAME) + "&newname=" + enc(NEW_NAME));
        Assertions.assertNotNull(response);
        Assertions.assertEquals("ok", response.get("status"));
        Assertions.assertTrue(response.get("validation") == null || "".equals(response.get("validation")));
        Awaitility.await().atMost(Duration.ofSeconds(120)).pollInterval(Duration.ofSeconds(1))
                .until(() -> "Paused".equals(statusOf(OLD_NAME)) && "Paused".equals(statusOf(NEW_NAME))
                        && baseline.equals(samples(NEW_NAME, start, end)));
        Assertions.assertEquals(baseline, samples(OLD_NAME, start, end), "Source data must remain unchanged");
        Assertions.assertEquals(sourceInfo, typeInfo(OLD_NAME), "Source configuration must remain unchanged");
        JSONObject destination = typeInfo(NEW_NAME);
        for (String field : COPIED_FIELDS) {
            Assertions.assertTrue(sourceInfo.containsKey(field), "Missing source field " + field);
            Assertions.assertEquals(sourceInfo.get(field), destination.get(field), "Copied field " + field);
        }
    }
}
