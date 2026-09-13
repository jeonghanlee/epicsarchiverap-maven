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
 * Test archiving of fields through the mgmt BPL, replacing the former browser-driven flow.
 * Standard fields (HIHI-style and metadata) must reach "Being archived"; a non-existent field
 * (.YYZ) must not. Verifies the server workflow rather than the UI.
 */
@Tag("integration")
@Tag("localEpics")
public class ArchiveFieldsWorkflowTest {
    private static Logger logger = LogManager.getLogger(ArchiveFieldsWorkflowTest.class.getName());
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

    private static String statusOf(String getPVStatusUrl) {
        JSONArray status = GetUrlContent.getURLContentAsJSONArray(getPVStatusUrl);
        if (status == null || status.isEmpty()) {
            return "(absent)";
        }
        return String.valueOf(((JSONObject) status.get(0)).get("status"));
    }

    @Test
    public void testArchiveFieldsPV() throws Exception {
        String base = "UnitTestNoNamingConvention:sine";
        String bogusField = base + ".YYZ";
        String[] realFields = new String[] {
            base, base + ".EOFF", base + ".EGU", base + ".ALST", base + ".HOPR", base + ".DESC"
        };
        String mgmtUrl = "http://localhost:17665/mgmt/bpl/";

        // Wait for the appliance to accept archive requests, then submit every field.
        String firstArchiveUrl = mgmtUrl + "archivePV?pv=" + URLEncoder.encode(realFields[0], StandardCharsets.UTF_8);
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONArray(firstArchiveUrl) != null);
        for (String field : realFields) {
            GetUrlContent.getURLContentAsJSONArray(
                    mgmtUrl + "archivePV?pv=" + URLEncoder.encode(field, StandardCharsets.UTF_8));
        }
        GetUrlContent.getURLContentAsJSONArray(
                mgmtUrl + "archivePV?pv=" + URLEncoder.encode(bogusField, StandardCharsets.UTF_8));

        // Every real field must reach "Being archived".
        for (String field : realFields) {
            String getPVStatusUrl = mgmtUrl + "getPVStatus?pv=" + URLEncoder.encode(field, StandardCharsets.UTF_8);
            Awaitility.await()
                    .atMost(Duration.ofMinutes(5))
                    .pollInterval(Duration.ofSeconds(10))
                    .ignoreExceptions()
                    .until(() -> "Being archived".equals(statusOf(getPVStatusUrl)));
        }

        // The non-existent field must not be archived.
        String bogusStatusUrl = mgmtUrl + "getPVStatus?pv=" + URLEncoder.encode(bogusField, StandardCharsets.UTF_8);
        String bogusStatus = statusOf(bogusStatusUrl);
        logger.info("Status of the non-existent field " + bogusField + " is " + bogusStatus);
        Assertions.assertNotEquals(
                "Being archived", bogusStatus,
                "Expecting the non-existent field " + bogusField + " to not be archived; instead it is " + bogusStatus);
    }
}
