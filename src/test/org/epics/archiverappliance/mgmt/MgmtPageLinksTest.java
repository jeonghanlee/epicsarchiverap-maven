package org.epics.archiverappliance.mgmt;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.management.ObjectName;
import javax.management.remote.JMXConnector;
import javax.management.remote.JMXConnectorFactory;
import javax.management.remote.JMXServiceURL;

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
            "archive.html",
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
    private static final Pattern HTML_ASSET = Pattern.compile(
            "<(?:script|link|img|source)\\b[^>]*\\b(?:src|href|srcset)=[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
    private static final Pattern CSS_ASSET = Pattern.compile("url\\(\\s*[\"']?([^\\s\"')]+)|@import\\s+[\"']([^\"']+)");
    private static final Pattern JS_MODULE = Pattern.compile(
            "(?m)(?:^\\s*(?:import\\s+(?:[\\w\\s{},*]+?\\s+from\\s+)?|export\\s+(?:\\{[^}]*\\}|\\*)\\s+from\\s+)"
                    + "|\\bimport\\s*\\(\\s*)[\"']([^\"']+)[\"']");
    private static final int CONCURRENT_ROUNDS = 3;
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);

    TomcatSetup tomcatSetup = new TomcatSetup().withJmx();

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
        Assertions.assertTrue(targets.contains("archive.html") && targets.contains("index.html"),
                "The menu opens the Archive PVs page and the Browse PVs page as two entries " + targets);
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
        return client.send(HttpRequest.newBuilder(uri).timeout(REQUEST_TIMEOUT).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    /**
     * Measures concurrent page and static dependency requests on the shipped WAR, including CSS references and
     * JavaScript module imports. This is an HTTP workload; it does not execute browser scripts or their BPL calls.
     */
    @Test
    public void pagesAndTheirStaticDependenciesAnswerConcurrentRequests() throws Exception {
        HttpClient client = HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build();
        List<String> pages = new ArrayList<>(MENU_PAGES);
        pages.addAll(FORWARDING_PAGES);
        JMXServiceURL jmx = new JMXServiceURL("service:jmx:rmi:///jndi/rmi://127.0.0.1:"
                + tomcatSetup.jmxPort("appliance0") + "/jmxrmi");
        try (JMXConnector connector = JMXConnectorFactory.connect(jmx)) {
            var connection = connector.getMBeanServerConnection();
            Set<ObjectName> pools = connection.queryNames(new ObjectName("Catalina:type=ThreadPool,name=\"http-nio-*\""), null);
            Assertions.assertEquals(1, pools.size(), "One shared HTTP connector is required");
            ObjectName pool = pools.iterator().next();
            int workloadMax = 0;
            for (String page : pages) {
                Set<URI> targets = staticDependencies(client, URI.create(ConfigServiceForTests.MGMT_UI_URL + "/" + page));
                if (MENU_PAGES.contains(page)) Assertions.assertTrue(targets.size() > 1, "No static dependencies: " + page);
                int maximum = 0;
                long samples = 0;
                long started = System.nanoTime();
                for (int round = 0; round < CONCURRENT_ROUNDS; round++) {
                    List<CompletableFuture<HttpResponse<Void>>> pending = new ArrayList<>();
                    for (URI target : targets) {
                        pending.add(client.sendAsync(HttpRequest.newBuilder(target).timeout(REQUEST_TIMEOUT).GET().build(),
                                HttpResponse.BodyHandlers.discarding()));
                    }
                    do {
                        maximum = Math.max(maximum, ((Number) connection.getAttribute(pool, "currentThreadsBusy")).intValue());
                        samples++;
                    } while (!pending.stream().allMatch(CompletableFuture::isDone));
                    for (CompletableFuture<HttpResponse<Void>> request : pending) {
                        HttpResponse<Void> response = request.get();
                        Assertions.assertEquals(200, response.statusCode(), "Concurrent request: " + response.uri());
                    }
                }
                workloadMax = Math.max(workloadMax, maximum);
                System.out.println("T5 console page " + page + " requests " + targets.size() * CONCURRENT_ROUNDS
                        + " samples " + samples + " maxBusyThreads " + maximum
                        + " millis " + (System.nanoTime() - started) / 1_000_000
                        + " paths " + targets.stream().map(URI::getPath).toList());
            }
            Assertions.assertTrue(workloadMax > 0, "The console workload must produce an observed busy thread");
        }
    }

    private static Set<URI> staticDependencies(HttpClient client, URI page) throws Exception {
        Set<URI> targets = new TreeSet<>();
        ArrayDeque<URI> unread = new ArrayDeque<>();
        unread.add(page);
        while (!unread.isEmpty()) {
            URI target = unread.remove();
            if (!targets.add(target)) continue;
            HttpResponse<String> response = client.send(HttpRequest.newBuilder(target).timeout(REQUEST_TIMEOUT).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            Assertions.assertEquals(200, response.statusCode(), "Static dependency: " + target);
            String path = target.getPath();
            Pattern references = path.endsWith(".html") ? HTML_ASSET
                    : path.endsWith(".css") ? CSS_ASSET : path.endsWith(".js") ? JS_MODULE : null;
            if (references == null) continue;
            Matcher matcher = references.matcher(response.body());
            while (matcher.find()) {
                String value = matcher.group(1);
                if (value == null) value = matcher.group(2);
                if (value.startsWith("data:") || value.startsWith("#")) continue;
                URI dependency = target.resolve(value).normalize();
                Assertions.assertEquals(page.getAuthority(), dependency.getAuthority(), "Nonlocal static dependency: " + dependency);
                unread.add(dependency);
            }
        }
        return targets;
    }
}
