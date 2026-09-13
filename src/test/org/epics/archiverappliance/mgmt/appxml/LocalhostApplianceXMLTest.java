package org.epics.archiverappliance.mgmt.appxml;

import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.awaitility.Awaitility;
import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.PrintWriter;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Test various versions of appliances.xml and make sure we can start the config service correctly.
 * @author mshankar
 *
 */
@Tag("integration")
public class LocalhostApplianceXMLTest {
    private static Logger logger = LogManager.getLogger(LocalhostApplianceXMLTest.class.getName());
    File testFolder = new File(ConfigServiceForTests.getDefaultPBTestFolder() + File.separator + "ApplianceXMLTest");
    TomcatSetup tomcatSetup = new TomcatSetup();

    @BeforeEach
    public void setUp() throws Exception {
        if (testFolder.exists()) {
            FileUtils.deleteDirectory(testFolder);
        }
        testFolder.mkdirs();
    }

    @AfterEach
    public void tearDown() throws Exception {
        FileUtils.deleteDirectory(testFolder);
    }

    @Test
    public void testIPAddressAppliancesXML() throws Exception {
        String localhost = "localhost";
        logger.info("Testing appliances.xml with localhost using " + localhost);
        String appliancesFilename = testFolder.getAbsolutePath() + File.separator + "localhostaddress_appliances.xml";
        try (PrintWriter out = new PrintWriter(new File(appliancesFilename))) {
            out.println("<appliances>\n\t<appliance>\n\t\t<identity>appliance0</identity>\n\t\t" + "<cluster_inetport>"
                    + localhost + ":16670</cluster_inetport>\n\t\t<mgmt_url>http://" + localhost
                    + ":17665/mgmt/bpl</mgmt_url>\n\t\t" + "<engine_url>http://"
                    + localhost + ":17665/engine/bpl</engine_url>\n\t\t<etl_url>http://" + localhost
                    + ":17665/etl/bpl</etl_url>" + "<retrieval_url>http://"
                    + localhost + ":17665/retrieval/bpl</retrieval_url>\n\t\t<data_retrieval_url>http://" + localhost
                    + ":17665/retrieval</data_retrieval_url>\n\t" + "</appliance>\n\t</appliances>");
        }
        System.getProperties().put(ConfigService.ARCHAPPL_APPLIANCES, appliancesFilename);

        tomcatSetup.setUpWebApps(this.getClass().getSimpleName());

        // The Selenium version opened the mgmt home page and looked for the archstatpVNames element.
        // The same check without a browser: GET the page and confirm it is served with that marker.
        // Poll for readiness rather than assume the page is deployed the instant Tomcat starts.
        HttpClient http = HttpClient.newHttpClient();
        HttpRequest homePage = HttpRequest.newBuilder(URI.create("http://localhost:17665/mgmt/ui/index.html")).GET().build();
        Awaitility.await()
                .atMost(Duration.ofSeconds(120))
                .pollInterval(Duration.ofSeconds(1))
                .ignoreExceptions()
                .until(() -> http.send(homePage, HttpResponse.BodyHandlers.ofString()).statusCode() == 200);
        HttpResponse<String> response = http.send(homePage, HttpResponse.BodyHandlers.ofString());
        Assertions.assertEquals(200, response.statusCode(), "The mgmt home page was not served after booting from " + appliancesFilename);
        Assertions.assertTrue(response.body().contains("archstatpVNames"),
                "The mgmt home page did not contain the expected content");

        tomcatSetup.tearDown();
    }
}
