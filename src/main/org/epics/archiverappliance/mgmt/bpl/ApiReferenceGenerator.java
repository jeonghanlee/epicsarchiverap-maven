package org.epics.archiverappliance.mgmt.bpl;

import java.io.IOException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.epics.archiverappliance.common.BPLAction;
import org.epics.archiverappliance.common.BPLEndpoint;
import org.epics.archiverappliance.common.BPLParam;
import org.epics.archiverappliance.mgmt.BPLServlet;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;

/**
 * Generates the mgmt API reference from the BPLServlet registry and the
 * BPLEndpoint annotations on the registered action classes. The registry
 * supplies each path and its HTTP methods in registration order; the
 * annotation supplies the summary and parameters. The reference is written as
 * a self-contained index.html and a machine-readable api.json into the
 * directory given as the single argument, so the mgmt WAR ships it under ui/api.
 */
public class ApiReferenceGenerator {

    static final String HTML_FILE = "index.html";
    static final String JSON_FILE = "api.json";

    /** One documented action: its path, methods, class, and annotation metadata. */
    public static final class Endpoint {
        public final String path;
        public final List<String> methods;
        public final String className;
        public final String summary;
        public final Map<String, String> params;

        Endpoint(String path, List<String> methods, String className, String summary, Map<String, String> params) {
            this.path = path;
            this.methods = methods;
            this.className = className;
            this.summary = summary;
            this.params = params;
        }
    }

    public static void main(String[] args) throws IOException {
        if (args.length != 1) {
            throw new IllegalArgumentException("Usage: ApiReferenceGenerator <output directory>");
        }
        Path outputDir = Path.of(args[0]);
        write(collect(), outputDir);
    }

    /** Joins the registry (paths, methods) with the annotations (summary, params). */
    public static List<Endpoint> collect() {
        List<Endpoint> endpoints = new ArrayList<>();
        for (String path : BPLServlet.getRegisteredPaths()) {
            Class<? extends BPLAction> getAction = BPLServlet.getGetAction(path);
            Class<? extends BPLAction> postAction = BPLServlet.getPostAction(path);
            List<String> methods = new ArrayList<>();
            if (getAction != null) {
                methods.add("GET");
            }
            if (postAction != null) {
                methods.add("POST");
            }
            Class<? extends BPLAction> documented = getAction != null ? getAction : postAction;
            BPLEndpoint meta = documented.getAnnotation(BPLEndpoint.class);
            String summary = meta != null ? meta.summary() : null;
            Map<String, String> params = new LinkedHashMap<>();
            if (meta != null) {
                for (BPLParam p : meta.params()) {
                    params.put(p.name(), p.description());
                }
            }
            endpoints.add(new Endpoint(path, methods, documented.getName(), summary, params));
        }
        return endpoints;
    }

    /** Writes index.html and api.json for the endpoints into the output directory. */
    public static void write(List<Endpoint> endpoints, Path outputDir) throws IOException {
        Files.createDirectories(outputDir);
        try (Writer out = Files.newBufferedWriter(outputDir.resolve(JSON_FILE), StandardCharsets.UTF_8)) {
            out.write(toJson(endpoints).toJSONString());
        }
        try (Writer out = Files.newBufferedWriter(outputDir.resolve(HTML_FILE), StandardCharsets.UTF_8)) {
            out.write(toHtml(endpoints));
        }
    }

    @SuppressWarnings("unchecked")
    static JSONObject toJson(List<Endpoint> endpoints) {
        JSONArray list = new JSONArray();
        for (Endpoint e : endpoints) {
            JSONObject obj = new JSONObject();
            obj.put("path", e.path);
            JSONArray methods = new JSONArray();
            methods.addAll(e.methods);
            obj.put("methods", methods);
            obj.put("class", e.className);
            if (e.summary != null) {
                obj.put("summary", e.summary);
            }
            JSONArray params = new JSONArray();
            for (Map.Entry<String, String> p : e.params.entrySet()) {
                JSONObject param = new JSONObject();
                param.put("name", p.getKey());
                param.put("description", p.getValue());
                params.add(param);
            }
            obj.put("params", params);
            list.add(obj);
        }
        JSONObject root = new JSONObject();
        root.put("endpoints", list);
        return root;
    }

    static String toHtml(List<Endpoint> endpoints) {
        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n");
        sb.append("<title>EPICS Archiver Appliance mgmt API</title>\n");
        sb.append("<style>\n");
        sb.append("body{font-family:sans-serif;margin:2em;line-height:1.4}\n");
        sb.append("code{background:#f4f4f4;padding:0 .2em}\n");
        sb.append("table{border-collapse:collapse;margin:.5em 0 1.5em}\n");
        sb.append("th,td{border:1px solid #ccc;padding:.3em .6em;text-align:left;vertical-align:top}\n");
        sb.append(".methods{color:#555;font-size:.9em}\n");
        sb.append("</style>\n</head>\n<body>\n");
        sb.append("<h1>EPICS Archiver Appliance mgmt API</h1>\n");
        sb.append("<p>Business process layer actions served under <code>/mgmt/bpl</code>, ");
        sb.append("generated from the BPLServlet registry at build time.</p>\n");
        sb.append("<ul>\n");
        for (Endpoint e : endpoints) {
            sb.append("<li><a href=\"#").append(anchor(e.path)).append("\"><code>")
                    .append(escape(e.path)).append("</code></a></li>\n");
        }
        sb.append("</ul>\n");
        for (Endpoint e : endpoints) {
            sb.append("<h2 id=\"").append(anchor(e.path)).append("\"><code>")
                    .append(escape(e.path)).append("</code></h2>\n");
            sb.append("<p class=\"methods\">").append(escape(String.join(", ", e.methods)))
                    .append(" &middot; <code>").append(escape(e.className)).append("</code></p>\n");
            // Summaries and descriptions are developer-authored HTML fragments, as in the
            // javadoc they replace, so they are rendered as written.
            if (e.summary != null) {
                sb.append("<p>").append(e.summary).append("</p>\n");
            }
            if (!e.params.isEmpty()) {
                sb.append("<table>\n<tr><th>Parameter</th><th>Description</th></tr>\n");
                for (Map.Entry<String, String> p : e.params.entrySet()) {
                    sb.append("<tr><td><code>").append(escape(p.getKey())).append("</code></td><td>")
                            .append(p.getValue()).append("</td></tr>\n");
                }
                sb.append("</table>\n");
            }
        }
        sb.append("</body>\n</html>\n");
        return sb.toString();
    }

    private static String anchor(String path) {
        return path.replaceAll("[^A-Za-z0-9]", "");
    }

    private static String escape(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
