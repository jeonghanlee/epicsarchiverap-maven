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

import javax.servlet.ServletConfig;
import javax.servlet.ServletContext;
import javax.servlet.ServletOutputStream;
import javax.servlet.WriteListener;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Concurrent getData.json requests through the real retrieval servlet, as a page that plots several PVs sends them:
 * every round sends one raw and one averaged request per PV at the same moment, every response carries the samples
 * with status 200, and afterwards the retrieval metrics of each PV count exactly the requests sent for it. The
 * servlet runs without a container and without the memory protection, whose budget would refuse concurrent requests.
 */
class RetrievalConcurrentRequestTest {
    private static final List<String> PVS = List.of(
            ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "ConcurrentA",
            ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "ConcurrentB",
            ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "ConcurrentC");
    private static final List<String> OPERATORS = List.of("raw", "mean_60");
    private static final String FROM = "2011-02-01T00:00:00.000Z";
    private static final String TO = "2011-02-01T01:00:00.000Z";
    private static final int ROUNDS = 40;
    private static ConfigServiceForTests config;
    private static DataRetrievalServlet servlet;

    @BeforeAll
    static void setup() throws Exception {
        int phase = 0;
        for (String pv : PVS) {
            GenerateData.generateSineForPV(pv, phase, ArchDBRTypes.DBR_SCALAR_DOUBLE,
                    TimeUtils.convertFromISO8601String(FROM), TimeUtils.convertFromISO8601String(TO));
            phase += 30;
        }
        config = new ConfigServiceForTests(-1);
        for (String pv : PVS) {
            var typeInfo = config.getTypeInfoForPV(pv);
            typeInfo.setApplianceIdentity(config.getMyApplianceInfo().getIdentity());
            typeInfo.setDataStores(new String[] {"pb://localhost?name=MTS&rootFolder="
                    + config.getPBRootFolder() + "&partitionGranularity=PARTITION_YEAR"});
            config.updateTypeInfoForPV(pv, typeInfo);
        }
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

    private static HttpServletRequest request(String pv, String operator) {
        Map<String, String> query = new HashMap<>();
        query.put("pv", pv);
        query.put("from", FROM);
        query.put("to", TO);
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
        volatile int status = 200;
        volatile String message;
        volatile boolean committed;
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

        int samples() throws Exception {
            JSONArray answer = (JSONArray) JSONValue.parseWithException(bytes.toString(StandardCharsets.UTF_8));
            JSONObject first = (JSONObject) answer.get(0);
            return ((JSONArray) first.get("data")).size();
        }
    }

    @Test
    void concurrentRequestsAllAnswerAndAreAllCounted() throws Exception {
        int perRound = PVS.size() * OPERATORS.size();
        ExecutorService pool = Executors.newFixedThreadPool(perRound);
        try {
            for (int round = 0; round < ROUNDS; round++) {
                CountDownLatch start = new CountDownLatch(1);
                List<Future<Response>> answers = new ArrayList<>();
                for (String pv : PVS) {
                    for (String operator : OPERATORS) {
                        answers.add(pool.submit(() -> {
                            start.await();
                            Response response = new Response();
                            servlet.doGet(request(pv, operator), response.transport);
                            return response;
                        }));
                    }
                }
                start.countDown();
                for (Future<Response> answer : answers) {
                    Response response = answer.get(2, TimeUnit.MINUTES);
                    assertEquals(200, response.status, "round " + round + ": " + response.message);
                    assertTrue(response.samples() > 0, "round " + round + ": samples");
                }
            }
        } finally {
            pool.shutdownNow();
        }
        for (String pv : PVS) {
            RetrievalMetrics metrics = config.getRetrievalRuntimeState().getPVRetrievalMetrics(pv);
            assertNotNull(metrics, "metrics of " + pv);
            assertEquals(String.valueOf((long) ROUNDS * OPERATORS.size()),
                    metrics.getMetrics().get(RetrievalMetrics.NUMBER_OF_RETRIEVAL_REQUESTS), "count of " + pv);
        }
    }
}
