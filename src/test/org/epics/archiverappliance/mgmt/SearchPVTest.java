package org.epics.archiverappliance.mgmt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/**
 * The search of one complete PV name on the network through the management, which forwards to the engine of the
 * appliance: a name the soft IOC serves over Channel Access answers found with its type and host, a name it serves over
 * PV Access answers found with its type and no host, and a name no server holds answers not found within the timeout.
 * The fixture is the database of the console checks, so the names are the ones the console checks use.
 */
@Tag("integration")
@Tag("localEpics")
public class SearchPVTest {
    private static final String MGMT_URL = "http://localhost:17665/mgmt/bpl/";
    private static final String DATABASE = "src/resources/test/ConsoleChartPVs.db";

    private final TomcatSetup tomcatSetup = new TomcatSetup();
    private final SIOCSetup siocSetup = new SIOCSetup();

    @BeforeEach
    public void setUp() throws Exception {
        tomcatSetup.setUpWebApps(this.getClass().getSimpleName());
        siocSetup.startSIOCWithDB(DATABASE);
    }

    @AfterEach
    public void tearDown() throws Exception {
        tomcatSetup.tearDown();
        siocSetup.stopSIOC();
    }

    private static JSONObject search(String pvName, String timeout) {
        String url = MGMT_URL + "searchPV?pv=" + URLEncoder.encode(pvName, StandardCharsets.UTF_8)
                + (timeout == null ? "" : "&timeout=" + timeout);
        JSONObject answer = GetUrlContent.getURLContentAsJSONObject(url);
        assertNotNull(answer, "The search of " + pvName + " answered nothing");
        return answer;
    }

    @Test
    public void testCAName() {
        JSONObject answer = search("SR:TICK", null);
        assertEquals("SR:TICK", answer.get("pvName"));
        assertEquals(Boolean.TRUE, answer.get("found"), "SR:TICK is served by the soft IOC: " + answer);
        assertEquals("CA", answer.get("protocol"));
        assertEquals("DBR_SCALAR_DOUBLE", answer.get("type"), "a calc record is a double: " + answer);
        assertNotNull(answer.get("host"), "a Channel Access channel reports its host: " + answer);
        assertFalse(String.valueOf(answer.get("host")).isEmpty());
        assertTrue(((Number) answer.get("elapsedMs")).longValue() < 5000, "found before the timeout: " + answer);
    }

    @Test
    public void testPVAName() {
        JSONObject answer = search("pva://SR:OP:MODECODE", null);
        assertEquals("pva://SR:OP:MODECODE", answer.get("pvName"));
        assertEquals(Boolean.TRUE, answer.get("found"), "SR:OP:MODECODE is served over PV Access: " + answer);
        assertEquals("PVA", answer.get("protocol"));
        assertEquals("DBR_SCALAR_DOUBLE", answer.get("type"), "a calc record is a double: " + answer);
        assertNull(answer.get("host"), "a PV Access channel reports no host: " + answer);
    }

    @Test
    public void testNameNoServerAnswers() {
        JSONObject answer = search("NO:SUCH:PV", "2");
        assertEquals(Boolean.FALSE, answer.get("found"), "no server holds NO:SUCH:PV: " + answer);
        long elapsed = ((Number) answer.get("elapsedMs")).longValue();
        assertTrue(elapsed >= 2000 && elapsed < 10000, "the search waited for its timeout of 2 s: " + answer);
        assertNull(answer.get("type"));
        assertNull(answer.get("host"));
    }

    @Test
    public void testTimeoutIsCapped() {
        JSONObject answer = search("NO:SUCH:PV:EITHER", "90");
        assertEquals(Boolean.FALSE, answer.get("found"));
        long elapsed = ((Number) answer.get("elapsedMs")).longValue();
        assertTrue(elapsed >= 30000 && elapsed < 40000, "a timeout above 30 s is cut to 30 s: " + answer);
    }
}
