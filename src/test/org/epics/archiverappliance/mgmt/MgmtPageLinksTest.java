package org.epics.archiverappliance.mgmt;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/**
 * The links of the deployed mgmt pages resolve to files the mgmt WAR serves.
 * Each page with a menu bar is fetched from the running appliance; its menu entries, Help link and every window.open
 * target are then fetched too. Each forwarding page is fetched, and the address it forwards to is fetched as well.
 */
@Tag("integration")
public class MgmtPageLinksTest {
    private static final List<String> MENU_PAGES = List.of(
            "index.html",
            "system.html",
            "operations.html",
            "retrieval.html",
            "external.html",
            "help.html");
    private static final List<String> FORWARDING_PAGES = List.of(
            "reports.html",
            "metrics.html",
            "storage.html",
            "appliance.html",
            "pvdetails.html",
            "cacompare.html",
            "integration.html",
            "analyzer.html");
    private static final Pattern MENU = Pattern.compile("<ul class=\"mainmenu\"[^>]*>(.*?)</ul>", Pattern.DOTALL);
    private static final Pattern MENU_LINK = Pattern.compile("<a href=\"([^\"]+)\"");
    private static final Pattern HELP_LINK = Pattern.compile("<a href=\"([^\"]+)\" id=\"help\">");
    private static final Pattern WINDOW_OPEN = Pattern.compile("window\\.open\\(\"([^\"]+)\"");
    private static final Pattern FORWARD_TARGET = Pattern.compile("url=([^\"]+)\"|<a href=\"([^\"]+)\"");

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
    public void testPageTargetsResolve() throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        TreeSet<String> targets = new TreeSet<String>();
        for (String page : MENU_PAGES) {
            HttpResponse<String> pageResponse = get(client, page);
            Assertions.assertEquals(200, pageResponse.statusCode(), "Page " + page);
            Matcher menu = MENU.matcher(pageResponse.body());
            Assertions.assertTrue(menu.find(), "Page " + page + " has a menu bar");
            Matcher menuLink = MENU_LINK.matcher(menu.group(1));
            int entries = 0;
            while (menuLink.find()) {
                targets.add(menuLink.group(1));
                entries++;
            }
            Assertions.assertEquals(5, entries, "Page " + page + " has the five menu entries");
            Matcher helpLink = HELP_LINK.matcher(pageResponse.body());
            Assertions.assertTrue(helpLink.find(), "Page " + page + " has a Help link");
            targets.add(helpLink.group(1));
            Matcher windowOpen = WINDOW_OPEN.matcher(pageResponse.body());
            while (windowOpen.find()) {
                targets.add(windowOpen.group(1));
            }
        }
        for (String page : FORWARDING_PAGES) {
            HttpResponse<String> pageResponse = get(client, page);
            Assertions.assertEquals(200, pageResponse.statusCode(), "Forwarding page " + page);
            Matcher forward = FORWARD_TARGET.matcher(pageResponse.body());
            Assertions.assertTrue(forward.find(), "Forwarding page " + page + " names where it forwards to");
            do {
                targets.add(forward.group(1) != null ? forward.group(1) : forward.group(2));
            } while (forward.find());
        }

        TreeSet<String> missing = new TreeSet<String>();
        for (String target : targets) {
            String path = target.replaceFirst("[#?].*$", "");
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
