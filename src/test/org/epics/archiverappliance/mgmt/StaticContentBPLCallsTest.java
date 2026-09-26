package org.epics.archiverappliance.mgmt;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Every BPL action that the mgmt web pages call is registered in BPLServlet.
 * Reads the HTML and JavaScript files that the mgmt WAR serves under ui/ and checks each ../bpl/ path
 * against the GET and POST registries.
 */
public class StaticContentBPLCallsTest {
    private static final Path MGMT_STATIC_CONTENT = Paths.get("src/main/org/epics/archiverappliance/mgmt/staticcontent");
    private static final Pattern BPL_CALL = Pattern.compile("\\.\\./bpl/([A-Za-z]+(?:/[A-Za-z]+)*)");

    @Test
    public void testEveryCalledActionIsRegistered() throws IOException {
        List<Path> pageFiles;
        try (Stream<Path> paths = Files.walk(MGMT_STATIC_CONTENT)) {
            pageFiles = paths.filter(p -> p.toString().endsWith(".html") || p.toString().endsWith(".js"))
                    .collect(Collectors.toList());
        }
        Assertions.assertFalse(pageFiles.isEmpty(), "No page files under " + MGMT_STATIC_CONTENT);

        TreeSet<String> called = new TreeSet<String>();
        for (Path pageFile : pageFiles) {
            Matcher matcher = BPL_CALL.matcher(Files.readString(pageFile, StandardCharsets.UTF_8));
            while (matcher.find()) {
                called.add("/" + matcher.group(1));
            }
        }
        Assertions.assertTrue(called.contains("/getPVStatus"), "Expected the pages to call /getPVStatus");

        TreeSet<String> unregistered = new TreeSet<String>();
        for (String path : called) {
            if (BPLServlet.getGetAction(path) == null && BPLServlet.getPostAction(path) == null) {
                unregistered.add(path);
            }
        }
        Assertions.assertTrue(unregistered.isEmpty(), "The mgmt pages call unregistered BPL actions " + unregistered);
    }
}
