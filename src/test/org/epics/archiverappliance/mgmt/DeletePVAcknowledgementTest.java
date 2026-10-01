package org.epics.archiverappliance.mgmt;

import com.sun.net.httpserver.HttpServer;
import org.epics.archiverappliance.config.ApplianceInfo;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.mgmt.bpl.DeletePV;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import javax.servlet.ReadListener;
import javax.servlet.ServletInputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayInputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Proxy;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/** Exercises shipped management/configuration with controlled outer HTTP and servlet boundaries. */
public class DeletePVAcknowledgementTest {
    private static final String PREFIX = "DeletionAck:";
    private static final String OK = "{\"status\":\"ok\"}";
    private ConfigServiceForTests config;
    private HttpServer server;
    private ApplianceInfo appliance;
    private String failingComponent, failureBody;
    private int failureCode;
    private final List<String> requests = new ArrayList<>();

    @BeforeEach
    void setup() throws Exception {
        config = new ConfigServiceForTests(-1);
        config.getETLLookup().manualControlForUnitTests();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        String address = "http://127.0.0.1:" + server.getAddress().getPort();
        appliance = new ApplianceInfo(config.getMyApplianceInfo().getIdentity(), address + "/mgmt",
                address + "/engine", address + "/retrieval", address + "/etl", "127.0.0.1:1", address);
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            String query = URLDecoder.decode(exchange.getRequestURI().getRawQuery(), StandardCharsets.UTF_8);
            synchronized (requests) { requests.add(path + "?" + query); }
            boolean fail = path.startsWith("/" + failingComponent + "/") && query.contains(":bad");
            byte[] body = (fail ? failureBody : OK).getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(fail ? failureCode : 200, body.length == 0 ? -1 : body.length);
            if (body.length != 0) exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void cleanup() {
        server.stop(0);
        config.shutdownNow();
    }

    static Stream<Arguments> failures() {
        List<Arguments> cases = new ArrayList<>();
        for (String component : List.of("engine", "etl")) {
            for (String body : List.of("", "null", "[]", "42", "\"text\"", "not-json", "{}",
                    "{\"status\":\"error\"}", "{\"status\":true}", "{\"status\":null}",
                    "{\"status\":\"ok\",\"validation\":\"failed\"}",
                    "{\"status\":\"ok\",\"validation\":[]}",
                    "{\"status\":\"ok\",\"validation\":null}")) {
                cases.add(Arguments.of(component, body, 200));
            }
            cases.add(Arguments.of(component, OK, 503));
        }
        return cases.stream();
    }

    private PVTypeInfo register(String pv) throws Exception {
        PVTypeInfo info = new PVTypeInfo(pv, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        info.setPaused(true);
        config.updateTypeInfoForPV(pv, info);
        config.registerPVToAppliance(pv, appliance);
        config.addAlias(pv + "Alias", pv);
        return info;
    }

    private JSONObject execute(String mode, List<String> pvs) throws Exception {
        StringWriter body = new StringWriter();
        PrintWriter writer = new PrintWriter(body);
        Map<String, String> params = Map.of("pv", String.join(",", pvs), "deleteData", "true");
        byte[] input = org.json.simple.JSONValue.toJSONString(pvs).getBytes(StandardCharsets.UTF_8);
        ByteArrayInputStream bytes = new ByteArrayInputStream(input);
        ServletInputStream stream = new ServletInputStream() {
            public int read() { return bytes.read(); }
            public boolean isFinished() { return bytes.available() == 0; }
            public boolean isReady() { return true; }
            public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException(); }
        };
        HttpServletRequest request = (HttpServletRequest) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[] {HttpServletRequest.class}, (proxy, method, args) -> switch (method.getName()) {
                    case "getMethod" -> mode.startsWith("POST") ? "POST" : "GET";
                    case "getParameter" -> params.get(args[0]);
                    case "getParameterMap" -> params.entrySet().stream().collect(java.util.stream.Collectors.toMap(
                            Map.Entry::getKey, entry -> new String[] {entry.getValue()}));
                    case "getContentType" -> mode.equals("POST-json") ? "application/json"
                            : "application/x-www-form-urlencoded";
                    case "getInputStream" -> stream;
                    default -> throw new UnsupportedOperationException(method.getName());
                });
        HttpServletResponse response = (HttpServletResponse) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[] {HttpServletResponse.class}, (proxy, method, args) -> switch (method.getName()) {
                    case "getWriter" -> writer;
                    case "setContentType" -> null;
                    default -> throw new AssertionError("Unexpected servlet operation: " + method.getName());
                });
        new DeletePV().execute(request, response, config);
        return (JSONObject) new JSONParser().parse(body.toString());
    }

    @ParameterizedTest
    @MethodSource("failures")
    void preservesUnconfirmedMetadataAndContinuesIndependentItems(String component, String body, int code)
            throws Exception {
        failingComponent = component;
        failureBody = body;
        failureCode = code;
        for (String mode : List.of("GET-single", "GET-batch", "POST-form", "POST-json")) {
            String bad = PREFIX + mode + ":bad", good = PREFIX + mode + ":good";
            PVTypeInfo badInfo = register(bad);
            register(good);
            JSONObject response = execute(mode, mode.equals("GET-single") ? List.of(bad) : List.of(bad, good));
            assertNotEquals("ok", response.get("status"));
            assertInstanceOf(String.class, response.get("validation"));
            assertFalse(((String) response.get("validation")).isBlank());
            assertSame(badInfo, config.getTypeInfoForPV(bad));
            assertTrue(badInfo.isPaused());
            assertTrue(config.getAllPVs().contains(bad));
            assertEquals(bad, config.getRealNameForAlias(bad + "Alias"));
            if (!mode.equals("GET-single")) {
                assertNull(config.getTypeInfoForPV(good));
                assertNull(config.getApplianceForPV(good));
                assertNull(config.getRealNameForAlias(good + "Alias"));
                synchronized (requests) {
                    assertTrue(requests.stream().anyMatch(url -> url.startsWith("/etl/") && url.contains(good)));
                }
            }
        }
    }
}
