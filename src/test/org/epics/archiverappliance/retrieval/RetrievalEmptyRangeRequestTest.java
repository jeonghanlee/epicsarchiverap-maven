package org.epics.archiverappliance.retrieval;

import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;

import javax.servlet.ServletConfig;
import javax.servlet.ServletContext;
import javax.servlet.ServletOutputStream;
import javax.servlet.WriteListener;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * getData.json requests through the real retrieval servlet over a range that holds no sample of an archived PV, one
 * that ends before the first sample: the operators that keep the events they select (nth, optimized, optimLastSample)
 * answer 200 with no samples, as the raw request and the other operators do, and over a range with samples they
 * answer the samples. Only the HTTP transport is substituted; the servlet runs without a container.
 */
class RetrievalEmptyRangeRequestTest {
    private static final String PV = ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "EmptyRange";
    private static final String DATA_FROM = "2011-02-01T00:00:00.000Z";
    private static final String DATA_TO = "2011-02-01T01:00:00.000Z";
    private static final String EMPTY_FROM = "2010-12-31T00:00:00.000Z";
    private static final String EMPTY_TO = "2010-12-31T01:00:00.000Z";
    private static final List<String> OPERATORS = List.of("nth_10", "optimized_10", "optimLastSample_10");
    private static DataRetrievalServlet servlet;

    @BeforeAll
    static void setup() throws Exception {
        GenerateData.generateSineForPV(PV, 0, ArchDBRTypes.DBR_SCALAR_DOUBLE,
                TimeUtils.convertFromISO8601String(DATA_FROM), TimeUtils.convertFromISO8601String(DATA_TO));
        ConfigServiceForTests config = new ConfigServiceForTests(-1);
        var typeInfo = config.getTypeInfoForPV(PV);
        typeInfo.setApplianceIdentity(config.getMyApplianceInfo().getIdentity());
        typeInfo.setDataStores(new String[] {"pb://localhost?name=MTS&rootFolder="
                + config.getPBRootFolder() + "&partitionGranularity=PARTITION_YEAR"});
        config.updateTypeInfoForPV(PV, typeInfo);
        ServletContext context = (ServletContext) Proxy.newProxyInstance(ServletContext.class.getClassLoader(),
                new Class<?>[] {ServletContext.class}, (proxy, method, args) ->
                        method.getName().equals("getAttribute") && args[0].equals(ConfigService.CONFIG_SERVICE_NAME)
                                ? config : null);
        ServletConfig servletConfig = (ServletConfig) Proxy.newProxyInstance(ServletConfig.class.getClassLoader(),
                new Class<?>[] {ServletConfig.class}, (proxy, method, args) ->
                        method.getName().equals("getServletContext") ? context : null);
        servlet = new DataRetrievalServlet();
        servlet.init(servletConfig);
    }

    private static HttpServletRequest request(String operator, String from, String to) {
        Map<String, String> query = new HashMap<>();
        query.put("pv", PV);
        query.put("from", from);
        query.put("to", to);
        if (!operator.equals("raw")) query.put("pp", operator);
        return (HttpServletRequest) Proxy.newProxyInstance(HttpServletRequest.class.getClassLoader(),
                new Class<?>[] {HttpServletRequest.class}, (proxy, method, args) -> switch (method.getName()) {
                    case "getPathInfo" -> "/getData.json";
                    case "getParameter" -> query.get(args[0]);
                    case "getParameterMap" -> query.entrySet().stream().collect(java.util.stream.Collectors.toMap(
                            Map.Entry::getKey, entry -> new String[] {entry.getValue()}));
                    case "getParameterNames" -> java.util.Collections.enumeration(query.keySet());
                    case "getParameterValues" -> query.containsKey(args[0]) ? query.get(args[0]).split(",") : null;
                    case "getRemoteAddr" -> "127.0.0.1";
                    case "getMethod" -> "GET";
                    case "getContentType" -> "application/x-www-form-urlencoded";
                    case "getHeader" -> null;
                    case "getRequestURL" -> new StringBuffer("http://localhost/retrieval/data/getData.json");
                    default -> throw new UnsupportedOperationException(method.toString());
                });
    }

    /** A response whose body and status the test reads back. */
    private static class Response {
        final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        int status = 200;
        String message;
        boolean committed;
        final ServletOutputStream output = new ServletOutputStream() {
            @Override public boolean isReady() { return true; }
            @Override public void setWriteListener(WriteListener listener) { }
            @Override public void write(int value) { bytes.write(value); }
        };
        final HttpServletResponse transport = (HttpServletResponse) Proxy.newProxyInstance(
                HttpServletResponse.class.getClassLoader(), new Class<?>[] {HttpServletResponse.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "getOutputStream" -> output;
                    case "getWriter" -> new java.io.PrintWriter(output);
                    case "isCommitted" -> committed;
                    case "flushBuffer" -> { committed = true; yield null; }
                    case "reset" -> { bytes.reset(); yield null; }
                    case "sendError" -> { status = (int) args[0]; message = args.length > 1 ? (String) args[1] : null; yield null; }
                    case "setStatus" -> { status = (int) args[0]; yield null; }
                    case "setContentType", "setHeader", "addHeader", "setCharacterEncoding", "setContentLength" -> null;
                    default -> throw new UnsupportedOperationException(method.toString());
                });

        /** The number of samples in the JSON answer; an answer without an entry for the PV holds none. */
        int samples() throws Exception {
            JSONArray answer = (JSONArray) JSONValue.parseWithException(bytes.toString(StandardCharsets.UTF_8));
            int samples = 0;
            for (Object entry : answer) {
                samples += ((JSONArray) ((JSONObject) entry).get("data")).size();
            }
            return samples;
        }
    }

    private static Response get(String operator, String from, String to) throws Exception {
        Response response = new Response();
        servlet.doGet(request(operator, from, to), response.transport);
        return response;
    }

    /** The raw request is the control: the range holds no sample, so any other answer is not about the operator. */
    @Test
    void rawRequestOverARangeWithoutSamplesAnswersNoSamples() throws Exception {
        Response response = get("raw", EMPTY_FROM, EMPTY_TO);
        assertEquals(200, response.status, response.message);
        assertEquals(0, response.samples());
    }

    /** Each operator is checked on its own, so one failing operator does not hide the others. */
    @Test
    void operatorsAnswerNoSamplesOverARangeWithoutSamples() {
        assertAll(OPERATORS.stream().map(operator -> (Executable) () -> {
            Response response = get(operator, EMPTY_FROM, EMPTY_TO);
            assertEquals(200, response.status, operator + ": " + response.message);
            assertEquals(0, response.samples(), operator);
        }));
    }

    @Test
    void operatorsAnswerSamplesOverARangeWithSamples() {
        assertAll(OPERATORS.stream().map(operator -> (Executable) () -> {
            Response response = get(operator, DATA_FROM, DATA_TO);
            assertEquals(200, response.status, operator + ": " + response.message);
            assertTrue(response.samples() > 0, operator + " answered no sample over a range with samples");
        }));
    }
}
