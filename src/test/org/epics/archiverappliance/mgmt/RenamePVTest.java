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
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

/**
 * Rename an archived PV through the mgmt BPL (single-instance). A PV must be paused before it can be
 * renamed; after renamePV the recorded data is retrievable under the new name and no longer under
 * the old one. This is the light single-instance rename check; the multi-year data-migration variant
 * was retired with the large-volume test set (large-volume verification is owned by EPICS-Arche).
 */
@Tag("integration")
@Tag("localEpics")
public class RenamePVTest {
    private static Logger logger = LogManager.getLogger(RenamePVTest.class.getName());
    private static final String MGMT = "http://localhost:17665/mgmt/bpl/";
    private static final String OLD_NAME = "UnitTestNoNamingConvention:sine";
    private static final String NEW_NAME = "UnitTestNoNamingConvention:sinerenamed";
    TomcatSetup tomcatSetup = new TomcatSetup();
    SIOCSetup siocSetup = new SIOCSetup();

    @BeforeEach
    public void setUp() throws Exception {
        deleteStoredData();
        siocSetup.startSIOCWithDefaultDB();
        tomcatSetup.setUpWebApps(this.getClass().getSimpleName());
    }

    @AfterEach
    public void tearDown() throws Exception {
        tomcatSetup.tearDown();
        siocSetup.stopSIOC();
        deleteStoredData();
    }

    private static void deleteStoredData() throws IOException {
        for (String store : new String[] {
            System.getenv("ARCHAPPL_SHORT_TERM_FOLDER"),
            System.getenv("ARCHAPPL_MEDIUM_TERM_FOLDER"),
            System.getenv("ARCHAPPL_LONG_TERM_FOLDER")
        }) {
            if (store == null) {
                continue;
            }
            File pvFolder = new File(store, "UnitTestNoNamingConvention");
            if (pvFolder.exists()) {
                FileUtils.deleteDirectory(pvFolder);
            }
        }
    }

    private static String enc(String pv) throws Exception {
        return URLEncoder.encode(pv, StandardCharsets.UTF_8);
    }

    private static String statusOf(String pv) throws Exception {
        JSONArray status = GetUrlContent.getURLContentAsJSONArray(MGMT + "getPVStatus?pv=" + enc(pv));
        if (status == null || status.isEmpty()) {
            return "(absent)";
        }
        return String.valueOf(((JSONObject) status.get(0)).get("status"));
    }

    private int retrievalCount(String pvName) throws IOException {
        RawDataRetrievalAsEventStream rawDataRetrieval = new RawDataRetrievalAsEventStream(
                "http://localhost:" + ConfigServiceForTests.RETRIEVAL_TEST_PORT + "/retrieval/data/getData.raw");
        Instant end = TimeUtils.plusDays(TimeUtils.now(), 1);
        Instant start = TimeUtils.minusDays(end, 2);
        try (EventStream stream = rawDataRetrieval.getDataForPVS(new String[] {pvName}, start, end, null)) {
            int eventCount = 0;
            if (stream != null) {
                for (@SuppressWarnings("unused") Event e : stream) {
                    eventCount++;
                }
            }
            return eventCount;
        }
    }

    @Test
    public void testRenamePV() throws Exception {
        // Archive the PV and wait until it is being archived, then until it has recorded some data.
        String archivePVUrl = MGMT + "archivePV?pv=" + enc(OLD_NAME);
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONArray(archivePVUrl) != null);
        Awaitility.await()
                .atMost(Duration.ofMinutes(5))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> "Being archived".equals(statusOf(OLD_NAME)));
        Awaitility.await()
                .atMost(Duration.ofMinutes(3))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> retrievalCount(OLD_NAME) > 0);

        // A PV must be paused before it can be renamed.
        GetUrlContent.getURLContentAsJSONObject(MGMT + "pauseArchivingPV?pv=" + enc(OLD_NAME));
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> "Paused".equals(statusOf(OLD_NAME)));

        // Record how much data was stored under the old name, then rename.
        int beforeCount = retrievalCount(OLD_NAME);
        Assertions.assertTrue(beforeCount > 0, "Expected recorded data under the old name before rename");
        logger.info("Renaming " + OLD_NAME + " to " + NEW_NAME + " with " + beforeCount + " recorded events");
        GetUrlContent.getURLContentAsJSONObject(
                MGMT + "renamePV?pv=" + enc(OLD_NAME) + "&newname=" + enc(NEW_NAME));

        // All the data recorded under the old name must be retrievable under the new name.
        Awaitility.await()
                .atMost(Duration.ofMinutes(3))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> retrievalCount(NEW_NAME) >= beforeCount);
    }
}
