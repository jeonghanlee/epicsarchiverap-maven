package org.epics.archiverappliance.mgmt;

import org.apache.commons.io.FileUtils;
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

import java.io.File;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

/**
 * Archive a PV and a PV field (VAL) through the mgmt BPL, replacing the former browser-driven flow,
 * then confirm data is retrievable under both the bare name and its .VAL form. Verifies the server
 * workflow rather than the UI.
 */
@Tag("integration")
@Tag("localEpics")
public class VALNoVALTest {
    private static Logger logger = LogManager.getLogger(VALNoVALTest.class.getName());
    private static final String MGMT = "http://localhost:17665/mgmt/bpl/";
    TomcatSetup tomcatSetup = new TomcatSetup();
    SIOCSetup siocSetup = new SIOCSetup();
    String folderSTS = ConfigServiceForTests.getDefaultShortTermFolder() + File.separator + "reshardSTS";
    String folderMTS = ConfigServiceForTests.getDefaultPBTestFolder() + File.separator + "reshardMTS";
    String folderLTS = ConfigServiceForTests.getDefaultPBTestFolder() + File.separator + "reshardLTS";

    @BeforeEach
    public void setUp() throws Exception {
        System.getProperties().put("ARCHAPPL_SHORT_TERM_FOLDER", folderSTS);
        System.getProperties().put("ARCHAPPL_MEDIUM_TERM_FOLDER", folderMTS);
        System.getProperties().put("ARCHAPPL_LONG_TERM_FOLDER", folderLTS);

        FileUtils.deleteDirectory(new File(folderSTS));
        FileUtils.deleteDirectory(new File(folderMTS));
        FileUtils.deleteDirectory(new File(folderLTS));

        siocSetup.startSIOCWithDefaultDB();
        tomcatSetup.setUpWebApps(this.getClass().getSimpleName());
    }

    @AfterEach
    public void tearDown() throws Exception {
        tomcatSetup.tearDown();
        siocSetup.stopSIOC();

        FileUtils.deleteDirectory(new File(folderSTS));
        FileUtils.deleteDirectory(new File(folderMTS));
        FileUtils.deleteDirectory(new File(folderLTS));
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

    @Test
    public void testVALNoVALTest() throws Exception {
        String pvNameToArchive1 = "UnitTestNoNamingConvention:sine";
        String pvNameToArchive2 = "UnitTestNoNamingConvention:cosine.VAL";

        // Wait for the appliance to accept archive requests, then submit both PVs.
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONArray(MGMT + "archivePV?pv=" + enc(pvNameToArchive1)) != null);
        GetUrlContent.getURLContentAsJSONArray(MGMT + "archivePV?pv=" + enc(pvNameToArchive2));

        // Both must reach "Being archived".
        for (String pv : new String[] {pvNameToArchive1, pvNameToArchive2}) {
            Awaitility.await()
                    .atMost(Duration.ofMinutes(5))
                    .pollInterval(Duration.ofSeconds(10))
                    .ignoreExceptions()
                    .until(() -> "Being archived".equals(statusOf(pv)));
        }

        // Wait for samples to accumulate, then confirm data is retrievable under the bare name and .VAL.
        Awaitility.await()
                .atMost(Duration.ofMinutes(3))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> countRetrievedEvents(pvNameToArchive1) > 55);
        Assertions.assertTrue(
                countRetrievedEvents(pvNameToArchive1 + ".VAL") > 55,
                "Expecting retrievable data for the .VAL form of " + pvNameToArchive1);
    }

    /**
     * Retrieve data for the PV and return the event count, asserting that timestamps are in order.
     */
    private int countRetrievedEvents(String pvName) throws Exception {
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
}
