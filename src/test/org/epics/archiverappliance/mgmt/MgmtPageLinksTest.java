package org.epics.archiverappliance.mgmt;

import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The help targets of the deployed mgmt pages resolve to files the mgmt WAR serves.
 * Each page is fetched from the running appliance; its Help link and every window.open target are then fetched too.
 */
@Tag("integration")
public class MgmtPageLinksTest {
    private static final List<String> PAGES = List.of(
            "index.html",
            "reports.html",
            "metrics.html",
            "storage.html",
            "appliance.html",
            "integration.html",
            "pvdetails.html",
            "cacompare.html");
    private static final Pattern HELP_LINK = Pattern.compile("<a href=\"([^\"]+)\" id=\"help\">");
    private static final Pattern WINDOW_OPEN = Pattern.compile("window\\.open\\(\"([^\"]+)\"");

    TomcatSetup tomcatSetup = new TomcatSetup();

    @BeforeEach
    public void setUp() throws Exception {
        tomcatSetup.setUpWebApps(this.getClass().getSimpleName());
    }

    @AfterEach
    public void tearDown() throws Exception {
        tomcatSetup.tearDown();
    }

    @Test
    public void testHelpTargetsResolve() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        TreeSet<String> targets = new TreeSet<String>();
        for (String page : PAGES) {
            HttpResponse<String> pageResponse = get(client, page);
            Assertions.assertEquals(200, pageResponse.statusCode(), "Page " + page);
            Matcher helpLink = HELP_LINK.matcher(pageResponse.body());
            Assertions.assertTrue(helpLink.find(), "Page " + page + " has a Help link");
            targets.add(helpLink.group(1));
            Matcher windowOpen = WINDOW_OPEN.matcher(pageResponse.body());
            while (windowOpen.find()) {
                targets.add(windowOpen.group(1));
            }
        }

        TreeSet<String> missing = new TreeSet<String>();
        for (String target : targets) {
            String path = target.replaceFirst("#.*$", "");
            if (get(client, path).statusCode() != 200) {
                missing.add(target);
            }
        }
        Assertions.assertTrue(missing.isEmpty(), "The mgmt pages open targets the WAR does not serve " + missing);
    }

    private static HttpResponse<String> get(HttpClient client, String relativePath) throws Exception {
        URI uri = URI.create(ConfigServiceForTests.MGMT_UI_URL + "/" + relativePath);
        return client.send(HttpRequest.newBuilder(uri).GET().build(), HttpResponse.BodyHandlers.ofString());
    }
}
