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
 * Archive a PV through its EPICS alias via the mgmt BPL, replacing the browser-driven flow. The
 * alias resolves to the real name; data (including the .HIHI meta field) is then retrievable under
 * both the real name and the alias. Verifies the server workflow rather than the UI.
 */
@Tag("integration")
@Tag("localEpics")
public class ArchiveAliasedPVTest {
    private static Logger logger = LogManager.getLogger(ArchiveAliasedPVTest.class.getName());
    private static final String MGMT = "http://localhost:17665/mgmt/bpl/";
    private static final String ALIAS = "UnitTestNoNamingConvention:sinealias";
    private static final String REAL = "UnitTestNoNamingConvention:sine";
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
        // Submit the alias for archiving; the workflow resolves it to the real name and archives that.
        String archivePVUrl = MGMT + "archivePV?pv=" + enc(ALIAS);
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONArray(archivePVUrl) != null);
        // The alias resolves to the real name in getPVStatus once the conversion completes.
        Awaitility.await()
                .atMost(Duration.ofMinutes(6))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> "Being archived".equals(statusOf(ALIAS)));

        // The .HIHI meta field is monitored a little after the main channel connects; drive it and
        // wait until data is retrievable under the real name and its meta field.
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

        // Data is retrievable under both the real name and the alias, for the value and the field.
        Awaitility.await()
                .atMost(Duration.ofMinutes(1))
                .pollInterval(Duration.ofSeconds(2))
                .ignoreExceptions()
                .until(() -> retrievalCount(ALIAS) > 0 && retrievalCount(ALIAS + ".HIHI") > 0);
        Assertions.assertTrue(retrievalCount(REAL) > 0, "Data expected under the real name " + REAL);
        Assertions.assertTrue(retrievalCount(REAL + ".HIHI") > 0, "Data expected under the real meta field");
    }
}
