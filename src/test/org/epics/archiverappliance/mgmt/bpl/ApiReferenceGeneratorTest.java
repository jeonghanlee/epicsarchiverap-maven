package org.epics.archiverappliance.mgmt.bpl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.epics.archiverappliance.common.BPLEndpoint;
import org.epics.archiverappliance.mgmt.BPLServlet;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Verifies that the generated API reference agrees with the BPLServlet
 * registry: every registered path appears, in registration order, in both the
 * JSON and the HTML, and every annotated action contributes its summary.
 */
public class ApiReferenceGeneratorTest {

    @Test
    public void referenceListsEveryRegisteredAction(@TempDir Path outputDir) throws Exception {
        List<String> registered = BPLServlet.getRegisteredPaths();
        assertFalse(registered.isEmpty(), "The registry must have actions to document");

        List<ApiReferenceGenerator.Endpoint> endpoints = ApiReferenceGenerator.collect();
        assertEquals(registered.size(), endpoints.size(), "One endpoint per registered path");
        for (int i = 0; i < registered.size(); i++) {
            assertEquals(registered.get(i), endpoints.get(i).path, "Registration order is preserved");
            assertFalse(endpoints.get(i).methods.isEmpty(), "Every path has at least one HTTP method");
        }

        ApiReferenceGenerator.write(endpoints, outputDir);

        String html = Files.readString(outputDir.resolve(ApiReferenceGenerator.HTML_FILE), StandardCharsets.UTF_8);
        JSONObject root = (JSONObject) JSONValue.parse(
                Files.readString(outputDir.resolve(ApiReferenceGenerator.JSON_FILE), StandardCharsets.UTF_8));
        JSONArray jsonEndpoints = (JSONArray) root.get("endpoints");
        Set<String> jsonPaths = new HashSet<>();
        for (Object o : jsonEndpoints) {
            jsonPaths.add((String) ((JSONObject) o).get("path"));
        }

        for (String path : registered) {
            assertTrue(jsonPaths.contains(path), "api.json must list " + path);
            assertTrue(html.contains("<code>" + path + "</code>"), "index.html must list " + path);
        }

        for (ApiReferenceGenerator.Endpoint e : endpoints) {
            Class<?> action = Class.forName(e.className);
            BPLEndpoint meta = action.getAnnotation(BPLEndpoint.class);
            if (meta != null) {
                assertEquals(meta.summary(), e.summary, "Annotation summary is carried for " + e.path);
                assertTrue(html.contains(meta.summary()), "index.html must carry the summary of " + e.path);
            }
        }
    }
}
