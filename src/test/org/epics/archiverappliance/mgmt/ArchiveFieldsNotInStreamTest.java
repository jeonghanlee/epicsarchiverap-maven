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
import java.util.List;

/**
 * Archive a PV (given by an EPICS alias) governed by a policy that adds a field not in the
 * archived-as-part-of-stream set, through the mgmt BPL and replacing the browser-driven flow.
 * The alias resolves to the real name; the non-stream field gets its own type info; and data is
 * retrievable under the real name, the field, and their aliases. Verifies the server, not the UI.
 */
@Tag("integration")
@Tag("localEpics")
public class ArchiveFieldsNotInStreamTest {
    private static Logger logger = LogManager.getLogger(ArchiveFieldsNotInStreamTest.class.getName());
    private static final String MGMT = "http://localhost:17665/mgmt/bpl/";
    TomcatSetup tomcatSetup = new TomcatSetup();
    SIOCSetup siocSetup = new SIOCSetup();

    @BeforeEach
    public void setUp() throws Exception {
        System.getProperties().put("ARCHAPPL_POLICIES", System.getProperty("user.dir") + "/src/test/org/epics/archiverappliance/mgmt/ArchiveFieldsNotInStream.py");
        // This test asserts exact sample counts, so it must start from empty stores; otherwise
        // samples left by an earlier run are merged into the retrieved stream.
        deleteStoredDataForThesePVs();
        siocSetup.startSIOCWithDefaultDB();
        tomcatSetup.setUpWebApps(this.getClass().getSimpleName());
    }

    @AfterEach
    public void tearDown() throws Exception {
        tomcatSetup.tearDown();
        siocSetup.stopSIOC();
        deleteStoredDataForThesePVs();
    }

    /**
     * Remove the stored data for the PVs this test archives from each of the three stores.
     */
    private static void deleteStoredDataForThesePVs() throws IOException {
        for (String storeFolder : new String[] {
            System.getenv("ARCHAPPL_SHORT_TERM_FOLDER"),
            System.getenv("ARCHAPPL_MEDIUM_TERM_FOLDER"),
            System.getenv("ARCHAPPL_LONG_TERM_FOLDER")
        }) {
            if (storeFolder == null) {
                continue;
            }
            File pvFolder = new File(storeFolder, "ArchUnitTest");
            if (pvFolder.exists()) {
                FileUtils.deleteDirectory(pvFolder);
            }
        }
    }

    private static String statusOf(String pv) {
        JSONArray status = GetUrlContent.getURLContentAsJSONArray(
                MGMT + "getPVStatus?pv=" + URLEncoder.encode(pv, StandardCharsets.UTF_8));
        if (status == null || status.isEmpty()) {
            return "(absent)";
        }
        return String.valueOf(((JSONObject) status.get(0)).get("status"));
    }

    private static JSONObject awaitTypeInfo(String pv) {
        String url = MGMT + "getPVTypeInfo?pv=" + URLEncoder.encode(pv, StandardCharsets.UTF_8);
        Awaitility.await()
                .atMost(Duration.ofMinutes(5))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONObject(url, false) != null);
        return GetUrlContent.getURLContentAsJSONObject(url, true);
    }

    @Test
    public void testArchiveFieldsPV() throws Exception {
        String aliasToArchive = "ArchUnitTest:fieldtstalias";
        String realName = "ArchUnitTest:fieldtst";
        String archivePVUrl = MGMT + "archivePV?pv=" + URLEncoder.encode(aliasToArchive, StandardCharsets.UTF_8);

        // Submit the alias for archiving; the workflow resolves it to the real name and archives that.
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONArray(archivePVUrl) != null);
        Awaitility.await()
                .atMost(Duration.ofMinutes(6))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> "Being archived".equals(statusOf(realName)));

        // The real PV's type info carries the stream fields (HIHI, LOLO) but not the non-stream ones.
        JSONObject valInfo = awaitTypeInfo(realName);
        logger.debug(valInfo.toJSONString());
        @SuppressWarnings("unchecked")
        List<String> archiveFields = (List<String>) valInfo.get("archiveFields");
        Assertions.assertTrue(archiveFields.contains("HIHI"), "TypeInfo should contain the HIHI field but it does not");
        Assertions.assertTrue(archiveFields.contains("LOLO"), "TypeInfo should contain the LOLO field but it does not");
        Assertions.assertTrue(!archiveFields.contains("DESC"), "TypeInfo should not contain the DESC field but it does");
        Assertions.assertTrue(!archiveFields.contains("C"), "TypeInfo should not contain the C field but it does");

        // The non-stream field gets its own type info.
        JSONObject cInfo = awaitTypeInfo(realName + ".C");
        Assertions.assertTrue(cInfo != null, "Did not find a typeinfo for " + realName + ".C");
        logger.debug(cInfo.toJSONString());

        testRetrievalCount(realName, new double[] {0.0});

        // The non-stream field is archived by its own, later workflow. The value sequence below is a
        // one-shot: fieldtst:cnt climbs by 0.5 and latches at its limit, writing each previous value
        // to the .C field, so it only runs while the counter is moving. The field must therefore
        // already be archiving before the caput that restarts the counter, or the samples are lost.
        Awaitility.await()
                .atMost(Duration.ofMinutes(6))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> "Being archived".equals(statusOf(realName + ".C")));

        siocSetup.caput("ArchUnitTest:fieldtst:cnt", "0.0");
        Thread.sleep(2 * 60 * 1000);
        testRetrievalCount(realName, new double[] {0.0});
        testRetrievalCount(realName + ".C", new double[] {3.5, 0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5});
        testRetrievalCount(aliasToArchive, new double[] {0.0});
        testRetrievalCount(aliasToArchive + ".C", new double[] {3.5, 0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5});
    }

    private void testRetrievalCount(String pvName, double[] expectedValues) throws IOException {
        RawDataRetrievalAsEventStream rawDataRetrieval = new RawDataRetrievalAsEventStream("http://localhost:" + ConfigServiceForTests.RETRIEVAL_TEST_PORT + "/retrieval/data/getData.raw");
        Instant end = TimeUtils.plusDays(TimeUtils.now(), 1);
        Instant start = TimeUtils.minusDays(end, 2);
        try (EventStream stream = rawDataRetrieval.getDataForPVS(new String[] {pvName}, start, end, null)) {
            long previousEpochSeconds = 0;
            int eventCount = 0;
            Assertions.assertTrue(stream != null, "Got a null event stream for PV " + pvName);
            for (Event e : stream) {
                long actualSeconds = e.getEpochSeconds();
                logger.debug("For " + pvName + " got value " + e.getSampleValue().getValue().doubleValue());
                Assertions.assertTrue(actualSeconds > previousEpochSeconds, "Got a sample at or before the previous sample " + actualSeconds + " ! >= " + previousEpochSeconds);
                previousEpochSeconds = actualSeconds;
                Assertions.assertTrue(Math.abs(Math.abs(e.getSampleValue().getValue().doubleValue()) - Math.abs(expectedValues[eventCount])) < 0.001, "Got " + e.getSampleValue().getValue().doubleValue() + " expecting " + expectedValues[eventCount] + " at " + eventCount);
                eventCount++;
            }
            Assertions.assertTrue(eventCount == expectedValues.length, "Expecting " + expectedValues.length + " got " + eventCount + " for pv " + pvName);
        }
    }
}
