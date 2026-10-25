package org.epics.archiverappliance.retrieval.extrafields;

import edu.stanford.slac.archiverappliance.PB.EPICSEvent.PayloadInfo;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.awaitility.Awaitility;
import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.retrieval.client.EpicsMessage;
import org.epics.archiverappliance.retrieval.client.GenMsgIterator;
import org.epics.archiverappliance.retrieval.client.InfoChangeHandler;
import org.epics.archiverappliance.retrieval.client.RawDataRetrieval;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;

/**
 * Make sure a change in EGU is captured and returned as part of retrieval, through the mgmt BPL and
 * replacing the browser-driven flow. Archive a PV, read its EGU, caput a new EGU, re-gather the
 * metadata by pausing and resuming, and confirm retrieval reflects the new EGU. Verifies the server.
 */
@Tag("integration")
@Tag("localEpics")
public class EGUChangeTest {
    private static Logger logger = LogManager.getLogger(EGUChangeTest.class.getName());
    private static final String MGMT = "http://localhost:17665/mgmt/bpl/";
    TomcatSetup tomcatSetup = new TomcatSetup();
    SIOCSetup siocSetup = new SIOCSetup();
    private String pvName = "UnitTestNoNamingConvention:sine";

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

    @Test
    public void testSimpleArchivePV() throws Exception {
        // Archive the PV and wait until it is being archived.
        String archivePVUrl = MGMT + "archivePV?pv=" + enc(pvName);
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONArray(archivePVUrl) != null);
        Awaitility.await()
                .atMost(Duration.ofMinutes(5))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> "Being archived".equals(statusOf(pvName)));

        // The EGU meta field is captured a little after connect; wait until retrieval reports it.
        Awaitility.await()
                .atMost(Duration.ofMinutes(5))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> "apples".equals(retrievedEGU()));

        // Change the EGU on the IOC, then re-gather the metadata by pausing and resuming.
        SIOCSetup.caput(pvName + ".EGU", "oranges");
        JSONObject pauseStatus = GetUrlContent.getURLContentAsJSONObject(MGMT + "pauseArchivingPV?pv=" + enc(pvName));
        Assertions.assertTrue(pauseStatus.containsKey("status") && pauseStatus.get("status").equals("ok"), "Cannot pause PV");
        JSONObject resumeStatus = GetUrlContent.getURLContentAsJSONObject(MGMT + "resumeArchivingPV?pv=" + enc(pvName));
        Assertions.assertTrue(resumeStatus.containsKey("status") && resumeStatus.get("status").equals("ok"), "Cannot resume PV");

        // Retrieval must now report the new EGU.
        Awaitility.await()
                .atMost(Duration.ofMinutes(5))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> "oranges".equals(retrievedEGU()));
    }

    /**
     * Retrieve the PV and return the EGU reported in the payload headers, or null if no data yet.
     */
    private String retrievedEGU() throws Exception {
        RawDataRetrieval rawDataRetrieval = new RawDataRetrieval(
                "http://localhost:" + ConfigServiceForTests.RETRIEVAL_TEST_PORT + "/retrieval/data/getData.raw");
        Instant now = TimeUtils.now();
        Instant start = TimeUtils.minusDays(now, 100);
        Instant end = TimeUtils.plusDays(now, 10);
        HashMap<String, String> metaFields = new HashMap<String, String>();
        int eventCount = 0;
        try (GenMsgIterator strm = rawDataRetrieval.getDataForPVs(
                Arrays.asList(pvName), TimeUtils.toSQLTimeStamp(start), TimeUtils.toSQLTimeStamp(end), false, null)) {
            if (strm == null) {
                return null;
            }
            mergeHeaders(strm.getPayLoadInfo(), metaFields);
            strm.onInfoChange(new InfoChangeHandler() {
                @Override
                public void handleInfoChange(PayloadInfo info) {
                    mergeHeaders(info, metaFields);
                }
            });
            for (@SuppressWarnings("unused") EpicsMessage dbrevent : strm) {
                eventCount++;
            }
        }
        if (eventCount == 0) {
            return null;
        }
        return metaFields.get("EGU");
    }

    private static void mergeHeaders(PayloadInfo info, HashMap<String, String> headers) {
        int headerCount = info.getHeadersCount();
        for (int i = 0; i < headerCount; i++) {
            headers.put(info.getHeaders(i).getName(), info.getHeaders(i).getVal());
        }
    }
}
