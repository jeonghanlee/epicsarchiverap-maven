package org.epics.archiverappliance.mgmt;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.awaitility.Awaitility;
import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.TomcatSetup;
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

/**
 * Archive a PV with an explicit sampling period through the mgmt BPL, replacing the former
 * browser-driven flow. Submit the PV to archivePV with samplingperiod, poll getPVStatus until it
 * is being archived, then confirm the reported sampling period. Verifies the server, not the UI.
 */
@Tag("integration")
@Tag("localEpics")
public class ArchiveWithSamplingPeriodPVTest {
    private static Logger logger = LogManager.getLogger(ArchiveWithSamplingPeriodPVTest.class.getName());
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

    @Test
    public void testArchiveWithSamplingPeriod() throws Exception {
        String pvNameToArchive = "UnitTestNoNamingConvention:sine";
        String samplingPeriod = "10.0";
        String mgmtUrl = "http://localhost:17665/mgmt/bpl/";
        String encoded = URLEncoder.encode(pvNameToArchive, StandardCharsets.UTF_8);
        String archivePVUrl = mgmtUrl + "archivePV?pv=" + encoded + "&samplingperiod=" + samplingPeriod;
        String getPVStatusUrl = mgmtUrl + "getPVStatus?pv=" + encoded;
        logger.info("Archiving " + pvNameToArchive + " with a " + samplingPeriod + "s sampling period");

        // Retry the archive request through the appliance startup window, ignoring transient errors,
        // until the submission is accepted.
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONArray(archivePVUrl) != null);

        // Poll the PV's status until the appliance reports it is being archived.
        Awaitility.await()
                .atMost(Duration.ofMinutes(5))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> {
                    JSONArray status = GetUrlContent.getURLContentAsJSONArray(getPVStatusUrl);
                    return status != null
                            && "Being archived".equals(((JSONObject) status.get(0)).get("status"));
                });

        // The requested sampling period must be reflected in the PV's status.
        JSONObject status = (JSONObject) GetUrlContent.getURLContentAsJSONArray(getPVStatusUrl).get(0);
        Assertions.assertEquals(
                samplingPeriod,
                status.get("samplingPeriod"),
                "Expecting the sampling period to be " + samplingPeriod + "; instead it is "
                        + status.get("samplingPeriod"));
    }
}
