package org.epics.archiverappliance.retrieval;

import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.mgmt.pva.actions.PvaActionException;
import org.epics.archiverappliance.retrieval.pva.PvaGetPVData;
import org.epics.pva.data.nt.PVAURI;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import javax.servlet.ServletConfig;
import javax.servlet.ServletContext;
import javax.servlet.ServletOutputStream;
import javax.servlet.WriteListener;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Real servlet/action and PB-store paths, with only the HTTP transport boundary substituted. */
class RetrievalProtectedRequestTest {
    private static final String PV = ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "ProtectedRequest";
    private static final String FROM = "2011-02-01T00:00:00.000Z";
    private static final String TO = "2011-02-01T01:00:00.000Z";
    private static final double BUDGET_FRACTION = .01;
    private static final long SCALAR_BIN_BYTES = 112;
    private static final List<String> FORMATS = List.of("json", "csv", "txt", "svg", "mat", "raw", "flx", "jplot", "qw");
    private static ConfigServiceForTests config;
    private static DataRetrievalServlet servlet;

    @BeforeAll static void setup() throws Exception {
        GenerateData.generateSineForPV(PV, 0, ArchDBRTypes.DBR_SCALAR_DOUBLE,
                TimeUtils.convertFromISO8601String(FROM), TimeUtils.convertFromISO8601String(TO));
        GenerateData.generateSineForPV(PV + "B", 45, ArchDBRTypes.DBR_SCALAR_DOUBLE,
                TimeUtils.convertFromISO8601String(FROM), TimeUtils.convertFromISO8601String(TO));
        config = new ConfigServiceForTests(-1);
        for (String pv : List.of(PV, PV + "B")) {
            var typeInfo = config.getTypeInfoForPV(pv);
            typeInfo.setApplianceIdentity(config.getMyApplianceInfo().getIdentity());
            typeInfo.setDataStores(new String[]{"pb://localhost?name=MTS&rootFolder="
                    + config.getPBRootFolder() + "&partitionGranularity=PARTITION_YEAR"});
            config.updateTypeInfoForPV(pv, typeInfo);
        }
        config.getRetrievalRuntimeState().configureMemoryProtection(new RetrievalMemoryProtection.Settings(
                BUDGET_FRACTION, .85, .95, .9, 1, Duration.ofMillis(100), SCALAR_BIN_BYTES, 256, 176));
        ServletContext context = (ServletContext) Proxy.newProxyInstance(ServletContext.class.getClassLoader(),
                new Class<?>[]{ServletContext.class}, (proxy, method, args) ->
                        method.getName().equals("getAttribute") && args[0].equals(ConfigService.CONFIG_SERVICE_NAME)
                                ? config : null);
        ServletConfig servletConfig = (ServletConfig) Proxy.newProxyInstance(ServletConfig.class.getClassLoader(),
                new Class<?>[]{ServletConfig.class}, (proxy, method, args) ->
                        method.getName().equals("getServletContext") ? context : null);
        servlet = new DataRetrievalServlet();
        servlet.init(servletConfig);
    }

    private static Map<String, String> query(String operator) {
        Map<String, String> query = new HashMap<>();
        query.put("pv", PV);
        query.put("from", FROM);
        query.put("to", TO);
        if (!operator.equals("raw")) query.put("pp", operator);
        return query;
    }

    private static HttpServletRequest request(String path, Map<String, String> query) {
        return (HttpServletRequest) Proxy.newProxyInstance(HttpServletRequest.class.getClassLoader(),
                new Class<?>[]{HttpServletRequest.class}, (proxy, method, args) -> switch (method.getName()) {
                    case "getPathInfo" -> "/" + path;
                    case "getParameter" -> query.get(args[0]);
                    case "getParameterMap" -> query.entrySet().stream().collect(java.util.stream.Collectors.toMap(
                            Map.Entry::getKey, entry -> new String[]{entry.getValue()}));
                    case "getParameterNames" -> java.util.Collections.enumeration(query.keySet());
                    case "getParameterValues" -> query.containsKey(args[0]) ? query.get(args[0]).split(",") : null;
                    case "getRemoteAddr" -> "127.0.0.1";
                    case "getMethod" -> query.getOrDefault("method", "GET");
                    case "getContentType" -> "application/x-www-form-urlencoded";
                    case "getHeader" -> null;
                    case "getRequestURL" -> new StringBuffer("http://localhost/retrieval/data/" + path);
                    default -> throw new UnsupportedOperationException(method.toString());
                });
    }

    private static class Response {
        final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        int status = 200;
        String message;
        boolean committed;
        boolean interruptOnWrite;
        boolean commitOnWrite;
        boolean closed;
        final java.io.StringWriter text = new java.io.StringWriter();
        final ServletOutputStream output = new ServletOutputStream() {
            @Override public boolean isReady() { return true; }
            @Override public void setWriteListener(WriteListener listener) { }
            @Override public void write(int value) {
                bytes.write(value);
                if (interruptOnWrite && bytes.size() >= 256) {
                    if (commitOnWrite) committed = true;
                    Thread.currentThread().interrupt();
                }
            }
            @Override public void close() { closed = true; }
        };
        final HttpServletResponse transport = (HttpServletResponse) Proxy.newProxyInstance(
                HttpServletResponse.class.getClassLoader(), new Class<?>[]{HttpServletResponse.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "getOutputStream" -> output;
                    case "getWriter" -> new java.io.PrintWriter(text);
                    case "isCommitted" -> committed;
                    case "flushBuffer" -> { committed = true; yield null; }
                    case "reset" -> { assertFalse(committed); bytes.reset(); yield null; }
                    case "sendError" -> { assertFalse(committed); status = (int) args[0];
                        message = args.length > 1 ? (String) args[1] : null; yield null; }
                    case "setStatus" -> { status = (int) args[0]; yield null; }
                    case "setContentType", "setHeader", "addHeader", "setCharacterEncoding" -> null;
                    default -> throw new UnsupportedOperationException(method.toString());
                });
    }

    @Test void oversizedDeclarationsFailBeforePreallocationInEveryFormat() throws Exception {
        for (String format : FORMATS) {
            for (String operator : List.of("optimized_2147483647", "optimLastSample_2147483647")) {
                Response response = new Response();
                servlet.doGet(request("getData." + format, query(operator)), response.transport);
                assertEquals(400, response.status, format + ": " + response.message);
                assertTrue(response.message.contains("budget"), response.message);
                assertFalse(response.committed);
                assertEquals(0, response.bytes.size());
            }
        }
        assertNormalRequest();
    }

    @Test void multiPvAdmissionUsesTheSameGuard() throws Exception {
        Response response = new Response();
        servlet.doGet(request("getDataForPVs.json", query("optimized_2147483647")), response.transport);
        assertEquals(400, response.status, response.message);
        assertTrue(response.message.contains("budget"));
        assertNormalRequest();
    }

    @Test void multiPvBudgetIncludesEveryPostprocessorForGetPostAndPva() throws Exception {
        Map<String, String> parameters = query("mean_1");
        long budget = (long) (Runtime.getRuntime().maxMemory() * BUDGET_FRACTION);
        long bins = budget / SCALAR_BIN_BYTES * 3 / 4;
        long declared = bins * SCALAR_BIN_BYTES;
        assertTrue(declared <= budget && declared * 2 > budget);
        parameters.put("to", TimeUtils.convertToISO8601String(
                TimeUtils.convertFromISO8601String(FROM).plusSeconds(bins - 2)));
        Response single = new Response();
        servlet.doGet(request("getData.json", parameters), single.transport);
        assertEquals(200, single.status, single.message);
        parameters.put("pv", PV + "," + PV + "B");
        for (String method : List.of("GET", "POST")) {
            Response response = new Response();
            parameters.put("method", method);
            if (method.equals("GET")) servlet.doGet(request("getDataForPVs.json", parameters), response.transport);
            else servlet.doPost(request("getDataForPVs.json", parameters), response.transport);
            assertEquals(400, response.status, response.message);
            assertTrue(response.message.contains("budget"), response.message);
            assertFalse(response.committed);
        }
        parameters.put("pv", PV + ";" + PV + "B");
        PvaActionException failure = assertThrows(PvaActionException.class, () -> new PvaGetPVData().request(
                new PVAURI("name", "pva", null, PvaGetPVData.NAME, parameters), config));
        assertTrue(failure.getMessage().contains("budget"), failure.toString());
        assertNormalRequest();
    }

    @Test void perApplianceTimeQueryRunsWorkersAndReturnsStoredSamples() throws Exception {
        Map<String, String> parameters = query("raw");
        parameters.put("pv", PV + "," + PV + "B");
        parameters.put("method", "POST");
        parameters.put("at", "2011-02-01T00:30:00.000Z");
        Response response = new Response();
        servlet.doPost(request("getDataAtTimeForAppliance", parameters), response.transport);
        assertEquals(200, response.status, response.message);
        var answer = (org.json.simple.JSONObject) org.json.simple.JSONValue.parseWithException(response.text.toString());
        assertEquals(2, answer.size());
        for (String pv : List.of(PV, PV + "B")) {
            var sample = (org.json.simple.JSONObject) answer.get(pv);
            assertNotNull(sample, response.text.toString());
            assertEquals(TimeUtils.convertFromISO8601String(parameters.get("at")).getEpochSecond(), sample.get("secs"));
        }
        assertNormalRequest();
    }

    @Test void interruptedTimeQueryRejectsWorkersAndRecovers() throws Exception {
        Map<String, String> parameters = query("raw");
        parameters.put("pv", PV + "," + PV + "B");
        parameters.put("method", "POST");
        parameters.put("at", "2011-02-01T00:30:00.000Z");
        Response response = new Response();
        try {
            Thread.currentThread().interrupt();
            servlet.doPost(request("getDataAtTimeForAppliance", parameters), response.transport);
            assertEquals(503, response.status, response.message);
            assertTrue(response.message.contains("interrupted"), response.message);
            assertTrue(Thread.currentThread().isInterrupted());
            assertEquals("", response.text.toString(), "Interrupted workers must not produce a success body");
        } finally { Thread.interrupted(); }
        perApplianceTimeQueryRunsWorkersAndReturnsStoredSamples();
    }

    @Test void timeQueryInterruptedDuringStoreIterationStopsAndRecovers() throws Exception {
        Thread caller = Thread.currentThread();
        var observedWorker = new java.util.concurrent.atomic.AtomicReference<Thread>();
        String loggerName = "edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin";
        var context = (org.apache.logging.log4j.core.LoggerContext) org.apache.logging.log4j.LogManager.getContext(false);
        var configuration = context.getConfiguration();
        var previous = configuration.getLoggers().get(loggerName);
        var appender = new org.apache.logging.log4j.core.appender.AbstractAppender(
                "InterruptTimeQuery", null, null, false, org.apache.logging.log4j.core.config.Property.EMPTY_ARRAY) {
            @Override public void append(org.apache.logging.log4j.core.LogEvent event) {
                String message = event.getMessage().getFormattedMessage();
                if (message.startsWith("Iterating thru ") && message.contains("ArchUnitTestProtectedRequest")
                        && Thread.currentThread() != caller
                        && observedWorker.compareAndSet(null, Thread.currentThread())) {
                    caller.interrupt();
                }
            }
        };
        var logger = new org.apache.logging.log4j.core.config.LoggerConfig(
                loggerName, org.apache.logging.log4j.Level.INFO, true);
        appender.start();
        logger.addAppender(appender, org.apache.logging.log4j.Level.INFO, null);
        configuration.addLogger(loggerName, logger);
        context.updateLoggers();
        try {
            Map<String, String> parameters = query("raw");
            parameters.put("pv", PV + "," + PV + "B");
            parameters.put("method", "POST");
            parameters.put("at", "2011-02-01T00:30:00.000Z");
            Response response = new Response();
            servlet.doPost(request("getDataAtTimeForAppliance", parameters), response.transport);
            assertNotNull(observedWorker.get(), "The interrupt must occur inside the real PB worker path");
            assertEquals(503, response.status, response.message);
            assertTrue(response.message.contains("interrupted"), response.message);
            assertTrue(caller.isInterrupted());
            assertEquals("", response.text.toString());
        } finally {
            Thread.interrupted();
            configuration.removeLogger(loggerName);
            if (previous != null) configuration.addLogger(loggerName, previous);
            context.updateLoggers();
            appender.stop();
        }
        perApplianceTimeQueryRunsWorkersAndReturnsStoredSamples();
    }

    @Test void stoppedOutputBeforeCommitReturnsAnErrorAndRecovers() throws Exception {
        Response response = new Response();
        response.interruptOnWrite = true;
        try {
            servlet.doGet(request("getData.json", query("raw")), response.transport);
            assertEquals(503, response.status, response.message);
            assertTrue(response.message.contains("interrupted"));
            assertFalse(response.closed, "Failed output must not receive normal completion");
        } finally { Thread.interrupted(); }
        assertNormalRequest();
    }

    @Test void stoppedOutputAfterCommitEscapesToTheContainerAndRecovers() throws Exception {
        Response response = new Response();
        response.interruptOnWrite = true;
        response.commitOnWrite = true;
        try {
            assertThrows(IOException.class,
                    () -> servlet.doGet(request("getData.json", query("raw")), response.transport));
            assertTrue(response.committed);
            assertNull(response.message, "Committed responses cannot receive a replacement error body");
            assertFalse(response.closed, "Failed output must not receive normal completion");
        } finally { Thread.interrupted(); }
        assertNormalRequest();
    }

    @Test void pvaActionPropagatesRefusalAndRecovers() throws Exception {
        PvaGetPVData action = new PvaGetPVData();
        for (String operator : List.of("optimized_2147483647", "optimLastSample_2147483647")) {
            PvaActionException failure = assertThrows(PvaActionException.class,
                    () -> action.request(new PVAURI("name", "pva", null, PvaGetPVData.NAME, query(operator)), config));
            assertTrue(failure.getMessage().contains("budget"), failure.toString());
        }
        assertNotNull(action.request(new PVAURI("name", "pva", null, PvaGetPVData.NAME, query("mean_60")), config));
    }

    private static void assertNormalRequest() throws Exception {
        Response normal = new Response();
        servlet.doGet(request("getData.json", query("mean_60")), normal.transport);
        assertEquals(200, normal.status, normal.message);
        String body = normal.bytes.toString(StandardCharsets.UTF_8);
        assertTrue(body.contains("secs"), body);
        assertNotNull(org.json.simple.JSONValue.parseWithException(body));
        assertFalse(RetrievalMemoryProtection.currentFailed());
    }
}
