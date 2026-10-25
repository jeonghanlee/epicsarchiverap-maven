package org.epics.archiverappliance.mgmt;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.awaitility.Awaitility;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.EventStream;
import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.retrieval.client.RawDataRetrievalAsEventStream;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

/**
 * Check addAlias and removeAlias through the mgmt BPL, replacing the browser-driven flow. Archive a
 * PV, then confirm data is retrievable only under the real name until an alias is added, and no
 * longer under the alias once it is removed. Verifies the server workflow rather than the UI.
 */
@Tag("integration")
@Tag("localEpics")
public class AddRemoveAliasTest {
    private static Logger logger = LogManager.getLogger(AddRemoveAliasTest.class.getName());
    private static final String MGMT = "http://localhost:17665/mgmt/bpl/";
    private static final String REAL = "UnitTestNoNamingConvention:sine";
    private static final String ALIAS = "UnitTestNoNamingConvention:arandomalias";
    TomcatSetup tomcatSetup = new TomcatSetup();
    SIOCSetup siocSetup = new SIOCSetup();

    @BeforeEach
    public void setUp() throws Exception {
        siocSetup.startSIOCWithDefaultDB();
        tomcatSetup.setUpWebApps(this.getClass().getSimpleName());
    }

    @AfterEach
    public void tearDown() throws Exception {
        tomcatSetup.tearDown();
        siocSetup.stopSIOC();
    }

    private static String enc(String pv) {
        return URLEncoder.encode(pv, StandardCharsets.UTF_8);
    }

    private static String statusOf(String pv) {
        JSONArray status = GetUrlContent.getURLContentAsJSONArray(MGMT + "getPVStatus?pv=" + enc(pv));
        if (status == null || status.isEmpty()) {
            return "(absent)";
        }
        return String.valueOf(((JSONObject) status.get(0)).get("status"));
    }

    private int retrievalCount(String pvName) throws IOException {
        RawDataRetrievalAsEventStream rawDataRetrieval = new RawDataRetrievalAsEventStream(
                "http://localhost:" + ConfigServiceForTests.RETRIEVAL_TEST_PORT + "/retrieval/data/getData.raw");
        Instant end = TimeUtils.plusDays(TimeUtils.now(), 3);
        Instant start = TimeUtils.minusDays(end, 6);
        try (EventStream stream = rawDataRetrieval.getDataForPVS(new String[] {pvName}, start, end, null)) {
            long previousEpochSeconds = 0;
            int eventCount = 0;
            if (stream != null) {
                for (Event e : stream) {
                    long actualSeconds = e.getEpochSeconds();
                    Assertions.assertTrue(actualSeconds >= previousEpochSeconds);
                    previousEpochSeconds = actualSeconds;
                    eventCount++;
                }
            }
            logger.info("Got " + eventCount + " event for pv " + pvName);
            return eventCount;
        }
    }

    @Test
    public void testSimpleArchivePV() throws Exception {
        // Archive the real PV and wait until it is being archived.
        String archivePVUrl = MGMT + "archivePV?pv=" + enc(REAL);
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONArray(archivePVUrl) != null);
        Awaitility.await()
                .atMost(Duration.ofMinutes(5))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> "Being archived".equals(statusOf(REAL)));

        // The .HIHI meta field is monitored a little after the main channel connects; drive it and
        // wait until both the value stream and the meta field have captured data.
        Awaitility.await()
                .atMost(Duration.ofMinutes(6))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> {
                    SIOCSetup.caput(REAL + ".HIHI", 2.0);
                    SIOCSetup.caput(REAL + ".HIHI", 3.0);
                    SIOCSetup.caput(REAL + ".HIHI", 4.0);
                    return retrievalCount(REAL) > 0 && retrievalCount(REAL + ".HIHI") > 0;
                });

        // Before the alias exists, nothing is retrievable under the alias name.
        Assertions.assertEquals(0, retrievalCount(ALIAS), "No data expected under the alias before it is added");
        Assertions.assertEquals(0, retrievalCount(ALIAS + ".HIHI"), "No data expected under the alias field before it is added");

        // Add the alias; data becomes retrievable under both the real name and the alias.
        GetUrlContent.getURLContentAsJSONObject(
                MGMT + "addAlias?pv=" + enc(REAL) + "&aliasname=" + enc(ALIAS));
        Awaitility.await()
                .atMost(Duration.ofMinutes(1))
                .pollInterval(Duration.ofSeconds(2))
                .ignoreExceptions()
                .until(() -> retrievalCount(ALIAS) > 0 && retrievalCount(ALIAS + ".HIHI") > 0);
        Assertions.assertTrue(retrievalCount(REAL) > 0, "Real name still retrievable after adding the alias");

        // Remove the alias; it no longer resolves to any data.
        GetUrlContent.getURLContentAsJSONObject(
                MGMT + "removeAlias?pv=" + enc(REAL) + "&aliasname=" + enc(ALIAS));
        Awaitility.await()
                .atMost(Duration.ofMinutes(1))
                .pollInterval(Duration.ofSeconds(2))
                .ignoreExceptions()
                .until(() -> retrievalCount(ALIAS) == 0 && retrievalCount(ALIAS + ".HIHI") == 0);
        Assertions.assertTrue(retrievalCount(REAL) > 0, "Real name still retrievable after removing the alias");
    }
}
