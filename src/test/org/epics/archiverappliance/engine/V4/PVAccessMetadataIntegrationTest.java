package org.epics.archiverappliance.engine.V4;

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
import java.util.List;
import java.time.Instant;
import java.util.function.BooleanSupplier;

import static org.epics.archiverappliance.engine.V4.PVAccessUtil.waitForStatusChange;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/** Archives equivalent shipped IOC records through both protocols and reads the management APIs. */
@Tag("integration")
@Tag("localEpics")
class PVAccessMetadataIntegrationTest {
    private static final String MGMT = "http://localhost:17665/mgmt/bpl/";
    private static final String PVA_PV = "SR:RF:CAV2:TEMP";
    private static final String CA_PV = "SR:RF:CAV2:POWER";
    private final TomcatSetup tomcat = new TomcatSetup();
    private final SIOCSetup ioc = new SIOCSetup();

    @BeforeEach
    void setUp() throws Exception {
        String macros = "CAV2_TEMP_EGU=mm,CAV2_TEMP_PREC=3,CAV2_TEMP_HOPR=80,CAV2_TEMP_LOPR=-20,"
                + "CAV2_POWER_EGU=mm,CAV2_POWER_PREC=3,CAV2_POWER_HOPR=80,CAV2_POWER_LOPR=-20";
        ioc.startSIOCWithDB("src/resources/test/ConsoleChartPVs.db", macros);
        tomcat.setUpWebApps(getClass().getSimpleName());
    }

    @AfterEach
    void tearDown() throws Exception {
        try {
            tomcat.tearDown();
        } finally {
            ioc.stopSIOC();
        }
    }

    @Test
    void equivalentRecordsHaveEquivalentMetadata() {
        GetUrlContent.getURLContentAsJSONArray(MGMT + "archivePV?pv=" + encode("pva://" + PVA_PV));
        GetUrlContent.getURLContentAsJSONArray(MGMT + "archivePV?pv=" + encode(CA_PV));
        waitForStatusChange(PVA_PV, "Being archived", 120, MGMT, 1);
        waitForStatusChange(CA_PV, "Being archived", 120, MGMT, 1);
        JSONObject pva = typeInfo(PVA_PV);
        JSONObject ca = typeInfo(CA_PV);
        for (JSONObject info : List.of(pva, ca)) {
            assertEquals("mm", info.get("units"));
            assertEquals(3.0, number(info, "precision"));
            assertEquals(-20.0, number(info, "lowerDisplayLimit"));
            assertEquals(80.0, number(info, "upperDisplayLimit"));
            assertEquals(-20.0, number(info, "lowerCtrlLimit"));
            assertEquals(80.0, number(info, "upperCtrlLimit"));
            for (String key : List.of("lowerWarningLimit", "upperWarningLimit", "lowerAlarmLimit", "upperAlarmLimit")) {
                assertTrue(Double.isNaN(number(info, key)), key);
            }
            assertNotNull(info.get("hostName"));
            assertFalse(info.get("hostName").toString().isBlank());
        }
        for (String key : List.of("units", "precision", "lowerDisplayLimit", "upperDisplayLimit",
                "lowerCtrlLimit", "upperCtrlLimit", "lowerWarningLimit", "upperWarningLimit",
                "lowerAlarmLimit", "upperAlarmLimit")) {
            assertEquals(ca.get(key), pva.get(key), key);
        }
        for (String pv : List.of(PVA_PV, CA_PV)) {
            JSONArray details = GetUrlContent.getURLContentAsJSONArray(MGMT + "getPVDetails?pv=" + encode(pv));
            assertEquals("mm", detail(details, "Units:"));
            assertEquals(3.0, Double.parseDouble(detail(details, "Precision:")));
            assertFalse(detail(details, "Host name").isBlank());
        }
    }

    @Test
    void changedIocMetadataReachesEngineAndArchivedSamples() throws Exception {
        Instant start = Instant.now().minusSeconds(5);
        GetUrlContent.getURLContentAsJSONArray(MGMT + "archivePV?pv=" + encode("pva://" + PVA_PV));
        waitForStatusChange(PVA_PV, "Being archived", 120, MGMT, 1);
        JSONObject stored = typeInfo(PVA_PV);
        assertEquals("5 second", ((JSONObject) stored.get("extraFields")).get("SCAN"));
        SIOCSetup.caput(PVA_PV + ".SCAN", 0);
        SIOCSetup.caput(PVA_PV + ".PREC", 5);
        await(() -> "5".equals(latest().get("PREC")));
        SIOCSetup.caput(PVA_PV + ".DESC", "Changed metadata fixture");
        await(() -> "Changed metadata fixture".equals(latest().get("DESC")));
        SIOCSetup.caput(PVA_PV + ".HYST", 0.75);
        await(() -> "0.75".equals(latest().get("HYST")));
        SIOCSetup.caput(PVA_PV + ".PROC", 1);
        await(() -> hasArchivedMetadata(start));
        assertEquals(stored.get("precision"), typeInfo(PVA_PV).get("precision"));
        JSONArray details = GetUrlContent.getURLContentAsJSONArray(MGMT + "getPVDetails?pv=" + encode(PVA_PV));
        assertEquals("available", detail(details, "Latest metadata availability"));
        assertEquals("Changed metadata fixture", detail(details, "Latest metadata: DESC"));
        assertEquals("0.75", detail(details, "Latest metadata: HYST"));
    }

    private static JSONObject latest() {
        return GetUrlContent.getURLContentAsJSONObject(
                MGMT.replace("/mgmt/bpl/", "/engine/bpl/getMetadata?pv=") + encode(PVA_PV));
    }

    private static boolean hasArchivedMetadata(Instant start) {
        JSONArray response = GetUrlContent.getURLContentAsJSONArray(
                MGMT.replace("/mgmt/bpl/", "/retrieval/data/getData.json?pv=") + encode(PVA_PV)
                        + "&from=" + encode(start.toString()) + "&to=" + encode(Instant.now().toString()));
        for (Object stream : response) {
            JSONArray samples = (JSONArray) ((JSONObject) stream).get("data");
            for (Object sample : samples) {
                JSONObject fields = (JSONObject) ((JSONObject) sample).get("fields");
                if (fields != null && "5".equals(fields.get("PREC"))
                        && "Changed metadata fixture".equals(fields.get("DESC"))
                        && "0.75".equals(fields.get("HYST"))) return true;
            }
        }
        return false;
    }

    private static void await(BooleanSupplier condition) throws Exception {
        long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(30);
        while (!condition.getAsBoolean() && System.nanoTime() < deadline) Thread.sleep(200);
        assertTrue(condition.getAsBoolean(), "timed out waiting for native IOC metadata");
    }

    private static JSONObject typeInfo(String pv) {
        return GetUrlContent.getURLContentAsJSONObject(MGMT + "getPVTypeInfo?pv=" + encode(pv));
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static double number(JSONObject info, String key) {
        assertNotNull(info.get(key), key);
        return Double.parseDouble(info.get(key).toString());
    }

    private static String detail(JSONArray details, String name) {
        for (Object entry : details) {
            JSONObject row = (JSONObject) entry;
            if (name.equals(row.get("name"))) {
                assertNotNull(row.get("value"), name);
                return row.get("value").toString();
            }
        }
        return fail("Missing detail: " + name);
    }
}
