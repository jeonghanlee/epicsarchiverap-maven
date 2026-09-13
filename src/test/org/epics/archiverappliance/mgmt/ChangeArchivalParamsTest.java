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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Change a PV's archival parameters through the mgmt BPL, replacing the former browser-driven flow.
 * Archive the PV, then change its sampling period through changeArchivalParameters and confirm the
 * new period is reflected in the PV's status. Verifies the server workflow rather than the UI.
 */
@Tag("integration")
@Tag("localEpics")
public class ChangeArchivalParamsTest {
    private static Logger logger = LogManager.getLogger(ChangeArchivalParamsTest.class.getName());
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
    public void testChangeArchivalParams() throws Exception {
        String pvNameToArchive = "UnitTestNoNamingConvention:sine";
        String newSamplingPeriod = "11.0";
        String mgmtUrl = "http://localhost:17665/mgmt/bpl/";
        String encoded = URLEncoder.encode(pvNameToArchive, StandardCharsets.UTF_8);
        String archivePVUrl = mgmtUrl + "archivePV?pv=" + encoded;
        String getPVStatusUrl = mgmtUrl + "getPVStatus?pv=" + encoded;
        String changeParamsUrl = mgmtUrl + "changeArchivalParameters?pv=" + encoded + "&samplingperiod=11";
        logger.info("Archiving " + pvNameToArchive + " then changing its sampling period to " + newSamplingPeriod);

        // Retry the archive request through the appliance startup window until it is accepted.
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONArray(archivePVUrl) != null);

        // Poll until the appliance reports the PV is being archived.
        Awaitility.await()
                .atMost(Duration.ofMinutes(5))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> {
                    JSONArray status = GetUrlContent.getURLContentAsJSONArray(getPVStatusUrl);
                    return status != null
                            && "Being archived".equals(((JSONObject) status.get(0)).get("status"));
                });

        // Change the sampling period, then poll the status until the new period is reflected.
        Awaitility.await()
                .atMost(Duration.ofMinutes(3))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> {
                    GetUrlContent.getURLContentAsJSONObject(changeParamsUrl);
                    JSONArray status = GetUrlContent.getURLContentAsJSONArray(getPVStatusUrl);
                    return status != null
                            && newSamplingPeriod.equals(((JSONObject) status.get(0)).get("samplingPeriod"));
                });
    }
}
