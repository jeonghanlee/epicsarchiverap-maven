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
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Start an appserver with persistence, archive several PVs, then pause and delete a subset through
 * the mgmt BPL, replacing the former browser-driven flow. The deleted PVs must report as not being
 * archived while the rest keep being archived. Verifies the server workflow rather than the UI.
 */
@Tag("integration")
@Tag("localEpics")
public class DeleteMultiplePVTest {
    private static Logger logger = LogManager.getLogger(DeleteMultiplePVTest.class.getName());
    private static final String MGMT = "http://localhost:17665/mgmt/bpl/";
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

    private static void awaitStatus(String actionEndpoint, String pv, String expectedStatus, Duration atMost) {
        Awaitility.await()
                .atMost(atMost)
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> {
                    if (actionEndpoint != null) {
                        GetUrlContent.getURLContentAsJSONObject(MGMT + actionEndpoint + "?pv=" + enc(pv));
                    }
                    return expectedStatus.equals(statusOf(pv));
                });
    }

    @Test
    public void testDeleteMultiplePV() throws Exception {
        String[] allPVs = new String[] {
            "UnitTestNoNamingConvention:sine", "UnitTestNoNamingConvention:cosine", "test_0", "test_1", "test_2"
        };
        String[] subset = new String[] {"test_0", "test_1"};
        String[] survivors = new String[] {
            "UnitTestNoNamingConvention:sine", "UnitTestNoNamingConvention:cosine", "test_2"
        };

        // Wait for the appliance to accept archive requests, then submit every PV.
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONArray(MGMT + "archivePV?pv=" + enc(allPVs[0])) != null);
        for (String pv : allPVs) {
            GetUrlContent.getURLContentAsJSONArray(MGMT + "archivePV?pv=" + enc(pv));
        }
        for (String pv : allPVs) {
            awaitStatus(null, pv, "Being archived", Duration.ofMinutes(5));
        }

        // Pause then delete the subset.
        for (String pv : subset) {
            awaitStatus("pauseArchivingPV", pv, "Paused", Duration.ofMinutes(2));
        }
        for (String pv : subset) {
            awaitStatus("deletePV", pv, "Not being archived", Duration.ofMinutes(2));
        }

        // The remaining PVs must still be archived.
        for (String pv : survivors) {
            Assertions.assertEquals(
                    "Being archived", statusOf(pv), "Expecting " + pv + " to still be archived");
        }
    }
}
