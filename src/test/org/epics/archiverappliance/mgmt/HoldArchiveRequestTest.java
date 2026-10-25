package org.epics.archiverappliance.mgmt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.File;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

import org.awaitility.Awaitility;
import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/**
 * The hold of an archive request on a real appliance: with the hold set to one minute in a properties file of this test,
 * a request for a name no server holds reads Held with its reason within a few minutes, in getPVStatus and in the
 * never-connected report; it resumes to Initial sampling, and it is gone after a cancel. The properties file of the
 * test is handed to the Tomcats through the override TomcatSetup carries, set before the setup and cleared after, so
 * the shared test properties stay as they are.
 */
@Tag("integration")
public class HoldArchiveRequestTest {
    private static final String MGMT_URL = "http://localhost:17665/mgmt/bpl/";
    private static final String PV = "NO:SUCH:PV";
    private static final String HOLD_KEY = "org.epics.archiverappliance.mgmt.MgmtRuntimeState.holdArchiveRequestInMins";

    private final TomcatSetup tomcatSetup = new TomcatSetup();

    @BeforeEach
    public void setUp() throws Exception {
        Path shared = new File("src/sitespecific/tests/classpathfiles/archappl.properties").toPath();
        Path own = new File("target/" + this.getClass().getSimpleName() + "/archappl.properties").toPath();
        Files.createDirectories(own.getParent());
        Files.writeString(own, Files.readString(shared) + "\n" + HOLD_KEY + "=1\n");
        System.setProperty(ConfigService.ARCHAPPL_PROPERTIES_FILENAME, own.toAbsolutePath().toString());
        tomcatSetup.setUpWebApps(this.getClass().getSimpleName());
    }

    @AfterEach
    public void tearDown() throws Exception {
        try {
            tomcatSetup.tearDown();
        } finally {
            System.clearProperty(ConfigService.ARCHAPPL_PROPERTIES_FILENAME);
        }
    }

    private static JSONObject status() {
        JSONArray rows = GetUrlContent.getURLContentAsJSONArray(MGMT_URL + "getPVStatus?pv=" + encode(PV));
        assertNotNull(rows);
        assertEquals(1, rows.size());
        return (JSONObject) rows.get(0);
    }

    private static String encode(String text) {
        return URLEncoder.encode(text, StandardCharsets.UTF_8);
    }

    @Test
    public void aRequestNoServerAnswersIsHeldResumedAndCancelled() {
        JSONArray answer = GetUrlContent.getURLContentAsJSONArray(MGMT_URL + "archivePV?pv=" + encode(PV));
        assertNotNull(answer);
        assertEquals("Archive request submitted", ((JSONObject) answer.get(0)).get("status"));
        assertEquals("Initial sampling", status().get("status"));

        // The hold time is one minute and the workflow ticks every ten seconds; the engine is asked within the first ticks.
        Awaitility.await().atMost(Duration.ofMinutes(4)).pollInterval(Duration.ofSeconds(5))
                .until(() -> "Held".equals(status().get("status")));
        JSONObject held = status();
        assertEquals("No server answered in 1 minute", held.get("reason"), "the reason names the hold time: " + held);

        JSONArray never = GetUrlContent.getURLContentAsJSONArray(MGMT_URL + "getNeverConnectedPVs");
        assertNotNull(never);
        JSONObject row = (JSONObject) never.stream().filter(o -> PV.equals(((JSONObject) o).get("pvName"))).findFirst().orElse(null);
        assertNotNull(row, "the held request stays in the never-connected report: " + never);
        assertEquals("Held", row.get("status"));
        assertEquals("No server answered in 1 minute", row.get("reason"));

        JSONObject resumed = GetUrlContent.getURLContentAsJSONObject(MGMT_URL + "resumeArchiveRequest?pv=" + encode(PV));
        assertNotNull(resumed);
        assertEquals("ok", resumed.get("status"), "the held request resumes: " + resumed);
        assertEquals("Initial sampling", status().get("status"), "a resumed request is searching again");

        JSONObject cancelled = GetUrlContent.getURLContentAsJSONObject(MGMT_URL + "abortArchivingPV?pv=" + encode(PV));
        assertNotNull(cancelled);
        assertEquals("ok", cancelled.get("status"));
        Awaitility.await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofSeconds(2))
                .until(() -> "Not being archived".equals(status().get("status")));
        assertTrue(true);
    }
}
