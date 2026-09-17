package org.epics.archiverappliance.mgmt.pauseresume;

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
import java.util.List;

/**
 * Pause a PV through its .VAL field name via the mgmt bulk pause/resume path. Bulk pause/resume
 * normalizes the incoming name before the alias and type-info lookups, so pausing "pv.VAL" pauses
 * the base PV. Without normalization the ".VAL" name misses the lookups and the base PV stays
 * archived. The bulk path is reached with a POST body; the single-PV GET path does not normalize.
 */
@Tag("integration")
@Tag("localEpics")
public class PauseByFieldNameTest {
    private static final Logger logger = LogManager.getLogger(PauseByFieldNameTest.class.getName());
    private static final String MGMT = "http://localhost:17665/mgmt/bpl/";
    private static final String PV = "UnitTestNoNamingConvention:sine";
    private static final String VAL = PV + ".VAL";
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

    @Test
    public void pauseByValFieldPausesTheBasePV() throws Exception {
        String archivePVUrl = MGMT + "archivePV?pv=" + enc(PV);
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONArray(archivePVUrl) != null);
        Awaitility.await()
                .atMost(Duration.ofMinutes(6))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> "Being archived".equals(statusOf(PV)));

        // Pause using the .VAL field name through the bulk path (POST body); the base PV must
        // become paused. A POST routes to pauseMultiplePVs, which normalizes the name before the
        // alias and type-info lookups.
        logger.info("Pausing via the field name {}", VAL);
        GetUrlContent.postStringListAndGetJSON(MGMT + "pauseArchivingPV", "pv", List.of(VAL));

        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> "Paused".equals(statusOf(PV)));
        Assertions.assertEquals("Paused", statusOf(PV), "Pausing " + VAL + " should pause the base PV " + PV);
    }
}
