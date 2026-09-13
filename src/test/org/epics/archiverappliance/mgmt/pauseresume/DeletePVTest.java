package org.epics.archiverappliance.mgmt.pauseresume;

import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.awaitility.Awaitility;
import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.persistence.JDBM2Persistence;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Start an appserver with persistence, archive a PV, then pause, resume, pause and delete it through
 * the mgmt BPL, replacing the former browser-driven flow. Each transition is confirmed through the
 * PV's status. Verifies the server workflow rather than the UI.
 */
@Tag("integration")
@Tag("localEpics")
public class DeletePVTest {
    private static Logger logger = LogManager.getLogger(DeletePVTest.class.getName());
    private File persistenceFolder =
            new File(ConfigServiceForTests.getDefaultPBTestFolder() + File.separator + "DeletePVTest");
    TomcatSetup tomcatSetup = new TomcatSetup();
    SIOCSetup siocSetup = new SIOCSetup();

    @BeforeEach
    public void setUp() throws Exception {
        if (persistenceFolder.exists()) {
            FileUtils.deleteDirectory(persistenceFolder);
        }
        persistenceFolder.mkdirs();
        System.getProperties()
                .put(
                        ConfigService.ARCHAPPL_PERSISTENCE_LAYER,
                        "org.epics.archiverappliance.config.persistence.JDBM2Persistence");
        System.getProperties()
                .put(
                        JDBM2Persistence.ARCHAPPL_JDBM2_FILENAME,
                        persistenceFolder.getPath() + File.separator + "testconfig.jdbm2");

        siocSetup.startSIOCWithDefaultDB();
        tomcatSetup.setUpWebApps(this.getClass().getSimpleName());
    }

    @AfterEach
    public void tearDown() throws Exception {
        tomcatSetup.tearDown();
        siocSetup.stopSIOC();
    }

    private static String statusOf(String getPVStatusUrl) {
        JSONArray status = GetUrlContent.getURLContentAsJSONArray(getPVStatusUrl);
        if (status == null || status.isEmpty()) {
            return "(absent)";
        }
        return String.valueOf(((JSONObject) status.get(0)).get("status"));
    }

    @Test
    public void testSimpleDeletePV() throws Exception {
        String pvName = "UnitTestNoNamingConvention:sine";
        String mgmtUrl = "http://localhost:17665/mgmt/bpl/";
        String encoded = URLEncoder.encode(pvName, StandardCharsets.UTF_8);
        String archivePVUrl = mgmtUrl + "archivePV?pv=" + encoded;
        String getPVStatusUrl = mgmtUrl + "getPVStatus?pv=" + encoded;
        String pauseUrl = mgmtUrl + "pauseArchivingPV?pv=" + encoded;
        String resumeUrl = mgmtUrl + "resumeArchivingPV?pv=" + encoded;
        String deleteUrl = mgmtUrl + "deletePV?pv=" + encoded;

        // Wait for the appliance to accept archive requests, then wait until the PV is being archived.
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONArray(archivePVUrl) != null);
        awaitStatus(null, getPVStatusUrl, "Being archived", Duration.ofMinutes(5));

        // Pause, resume, pause again, then delete; confirm the PV's status after each transition.
        awaitStatus(pauseUrl, getPVStatusUrl, "Paused", Duration.ofMinutes(2));
        awaitStatus(resumeUrl, getPVStatusUrl, "Being archived", Duration.ofMinutes(2));
        awaitStatus(pauseUrl, getPVStatusUrl, "Paused", Duration.ofMinutes(2));
        awaitStatus(deleteUrl, getPVStatusUrl, "Not being archived", Duration.ofMinutes(2));
    }

    /**
     * Re-issue the (idempotent) action, if any, and poll the PV status until it reaches the expected
     * value, ignoring transient errors.
     */
    private static void awaitStatus(String actionUrl, String getPVStatusUrl, String expectedStatus, Duration atMost) {
        Awaitility.await()
                .atMost(atMost)
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> {
                    if (actionUrl != null) {
                        GetUrlContent.getURLContentAsJSONObject(actionUrl);
                    }
                    return expectedStatus.equals(statusOf(getPVStatusUrl));
                });
    }
}
