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
 * Test an operator adding a PV to the system, replacing the former browser-driven flow.
 * Submit the PV to the mgmt archivePV BPL, then poll getPVStatus until the appliance
 * reports it as being archived. This verifies the server workflow rather than the UI.
 * @author mshankar
 */
@Tag("integration")
@Tag("localEpics")
public class ArchivePVTest {
    private static Logger logger = LogManager.getLogger(ArchivePVTest.class.getName());
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
    public void testSimpleArchivePV() throws Exception {
        String pvNameToArchive = "UnitTestNoNamingConvention:sine";
        String mgmtUrl = "http://localhost:17665/mgmt/bpl/";
        String encoded = URLEncoder.encode(pvNameToArchive, StandardCharsets.UTF_8);
        String archivePVUrl = mgmtUrl + "archivePV?pv=" + encoded;
        String getPVStatusUrl = mgmtUrl + "getPVStatus?pv=" + encoded;
        logger.info("Archiving " + pvNameToArchive + " through " + archivePVUrl);

        // The appliance can still be completing startup (cluster connect, post-startup) when the
        // test begins, so the first archive request may be refused. Retry it, ignoring transient
        // errors, until the appliance accepts the submission.
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONArray(archivePVUrl) != null);

        // Once submitted, the connect-and-archive workflow takes a while; poll the PV's status
        // until the appliance reports it is being archived.
        Awaitility.await()
                .atMost(Duration.ofMinutes(5))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> {
                    JSONArray status = GetUrlContent.getURLContentAsJSONArray(getPVStatusUrl);
                    return status != null
                            && "Being archived".equals(((JSONObject) status.get(0)).get("status"));
                });
    }
}
