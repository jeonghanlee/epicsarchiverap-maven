package org.epics.archiverappliance.engine;

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
import java.time.Instant;
import java.util.List;
import java.util.function.BooleanSupplier;

import static org.epics.archiverappliance.engine.V4.PVAccessUtil.waitForStatusChange;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Archives shipped IOC records through Channel Access and follows changed metadata to storage and retrieval. */
@Tag("integration")
@Tag("localEpics")
class CAMetadataIntegrationTest {
    private static final String MGMT = "http://localhost:17665/mgmt/bpl/";
    private static final String ENGINE_METADATA = "http://localhost:17665/engine/bpl/getMetadata?pv=";
    private static final String DOUBLE_PV = "SR:RF:CAV2:POWER";
    private static final String ENUM_PV = "SR:OP:MODE";
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
    void precisionAndLimitChangesReachStoredConfigurationAfterReconnect() throws Exception {
        archive(DOUBLE_PV);
        JSONObject initial = typeInfo(DOUBLE_PV);
        assertEquals(3.0, number(initial, "precision"));
        assertEquals(80.0, number(initial, "upperDisplayLimit"));
        SIOCSetup.caput(DOUBLE_PV + ".PREC", 5);
        SIOCSetup.caput(DOUBLE_PV + ".HOPR", 90);
        reconnect(DOUBLE_PV);
        await(DOUBLE_PV, () -> number(typeInfo(DOUBLE_PV), "precision") == 5.0
                && number(typeInfo(DOUBLE_PV), "upperDisplayLimit") == 90.0);
        assertEquals("mm", typeInfo(DOUBLE_PV).get("units"), "the unit did not change");
        JSONArray details = GetUrlContent.getURLContentAsJSONArray(MGMT + "getPVDetails?pv=" + encode(DOUBLE_PV));
        String connectionHost = detail(details, "Host name");
        assertFalse(connectionHost.isBlank(), "the engine reports the connection host");
        assertEquals(connectionHost, typeInfo(DOUBLE_PV).get("hostName"),
                "the stored host agrees with the connection host after the update");
    }

    @Test
    void propertyEventsDeliverChangedMetadataToLatestMetadataAndSamples() throws Exception {
        Instant start = Instant.now().minusSeconds(5);
        archive(DOUBLE_PV);
        enablePropertyEvents(DOUBLE_PV, "HOPR", "PREC");
        reconnect(DOUBLE_PV);
        await(DOUBLE_PV, () -> "80.0".equals(latest(DOUBLE_PV).get("HOPR")) || "80".equals(latest(DOUBLE_PV).get("HOPR")));
        SIOCSetup.caput(DOUBLE_PV + ".HOPR", 91);
        SIOCSetup.caput(DOUBLE_PV + ".PREC", 4);
        await(DOUBLE_PV, () -> startsWith(latest(DOUBLE_PV).get("HOPR"), "91") && "4".equals(latest(DOUBLE_PV).get("PREC")));
        await(DOUBLE_PV, () -> hasArchivedFields(DOUBLE_PV, start, "HOPR", "91"));
        JSONArray details = GetUrlContent.getURLContentAsJSONArray(MGMT + "getPVDetails?pv=" + encode(DOUBLE_PV));
        assertEquals("available", detail(details, "Latest metadata availability"));
    }

    @Test
    void enumLabelsAreStoredAsIndexedKeysWithACount() throws Exception {
        Instant start = Instant.now().minusSeconds(5);
        archive(ENUM_PV);
        enablePropertyEvents(ENUM_PV, "PREC");
        reconnect(ENUM_PV);
        await(ENUM_PV, () -> "Top-up".equals(latest(ENUM_PV).get("ENUM_0")));
        assertEquals("3", latest(ENUM_PV).get("ENUM_COUNT"));
        assertFalse(latest(ENUM_PV).containsKey("LABELS"), "no comma-joined LABELS key");
        SIOCSetup.caput(ENUM_PV + ".ZRST", "Top-up changed");
        await(ENUM_PV, () -> "Top-up changed".equals(latest(ENUM_PV).get("ENUM_0")));
        await(ENUM_PV, () -> hasArchivedFields(ENUM_PV, start, "ENUM_0", "Top-up changed"));
    }

    @Test
    void defaultPolicyPVReportsScanAndDescAndStoresFieldsWithItsSamples() throws Exception {
        Instant start = Instant.now().minusSeconds(5);
        archive(DOUBLE_PV);
        assertEquals("2 second", ((JSONObject) typeInfo(DOUBLE_PV).get("extraFields")).get("SCAN"),
                "SCAN is stored with the configuration at archive time");
        JSONArray details = GetUrlContent.getURLContentAsJSONArray(MGMT + "getPVDetails?pv=" + encode(DOUBLE_PV));
        assertEquals("2 second", detail(details, "Extra info - SCAN:"));
        await(DOUBLE_PV, () -> "cavity forward power".equals(latest(DOUBLE_PV).get("DESC")));
        assertFalse(latest(DOUBLE_PV).containsKey("HYST"), "HYST is not collected by the default policy");
        await(DOUBLE_PV, () -> hasArchivedFields(DOUBLE_PV, start, "DESC", "cavity forward power")
                && hasArchivedFields(DOUBLE_PV, start, "HOPR", "80"));
        SIOCSetup.caput(DOUBLE_PV + ".HOPR", 92);
        await(DOUBLE_PV, () -> hasArchivedFields(DOUBLE_PV, start, "HOPR", "92"));
    }

    private static void archive(String pv) {
        GetUrlContent.getURLContentAsJSONArray(MGMT + "archivePV?pv=" + encode(pv));
        waitForStatusChange(pv, "Being archived", 120, MGMT, 1);
    }

    private static void reconnect(String pv) {
        GetUrlContent.getURLContentAsJSONObject(MGMT + "pauseArchivingPV?pv=" + encode(pv));
        waitForStatusChange(pv, "Paused", 60, MGMT, 1);
        GetUrlContent.getURLContentAsJSONObject(MGMT + "resumeArchivingPV?pv=" + encode(pv));
        waitForStatusChange(pv, "Being archived", 120, MGMT, 1);
    }

    /** The shipped policies do not enable property events, so the stored settings are changed explicitly. */
    @SuppressWarnings("unchecked")
    private static void enablePropertyEvents(String pv, String... fields) throws Exception {
        GetUrlContent.getURLContentAsJSONObject(MGMT + "pauseArchivingPV?pv=" + encode(pv));
        waitForStatusChange(pv, "Paused", 60, MGMT, 1);
        JSONObject info = typeInfo(pv);
        JSONArray archiveFields = new JSONArray();
        archiveFields.addAll(List.of(fields));
        info.put("archiveFields", archiveFields);
        info.put("useDBEProperties", "true");
        GetUrlContent.postObjectAndGetContentAsJSONObject(
                MGMT + "putPVTypeInfo?pv=" + encode(pv) + "&override=true&createnew=false", info);
        GetUrlContent.getURLContentAsJSONObject(MGMT + "resumeArchivingPV?pv=" + encode(pv));
        waitForStatusChange(pv, "Being archived", 120, MGMT, 1);
    }

    private static JSONObject latest(String pv) {
        return GetUrlContent.getURLContentAsJSONObject(ENGINE_METADATA + encode(pv));
    }

    private static boolean hasArchivedFields(String pv, Instant start, String key, String valuePrefix) {
        JSONArray response = GetUrlContent.getURLContentAsJSONArray(
                MGMT.replace("/mgmt/bpl/", "/retrieval/data/getData.json?pv=") + encode(pv)
                        + "&from=" + encode(start.toString()) + "&to=" + encode(Instant.now().toString()));
        for (Object stream : response) {
            JSONArray samples = (JSONArray) ((JSONObject) stream).get("data");
            for (Object sample : samples) {
                JSONObject fields = (JSONObject) ((JSONObject) sample).get("fields");
                if (fields != null && startsWith(fields.get(key), valuePrefix)) return true;
            }
        }
        return false;
    }

    private static boolean startsWith(Object value, String prefix) {
        return value != null && value.toString().startsWith(prefix);
    }

    private static void await(String pv, BooleanSupplier condition) throws Exception {
        long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(60);
        while (!condition.getAsBoolean() && System.nanoTime() < deadline) Thread.sleep(500);
        assertTrue(condition.getAsBoolean(), "timed out waiting for native IOC metadata of " + pv
                + "; latest metadata: " + latest(pv) + "; stored: " + typeInfo(pv));
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
            if (name.equals(row.get("name"))) return String.valueOf(row.get("value"));
        }
        throw new AssertionError("Missing detail: " + name);
    }
}
