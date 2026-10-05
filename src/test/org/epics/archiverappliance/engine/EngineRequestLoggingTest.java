package org.epics.archiverappliance.engine;

import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;
import org.apache.logging.log4j.Level;
import org.epics.archiverappliance.common.CapturedLog;
import org.epics.archiverappliance.common.POJOEvent;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.ConfigService.WAR_FILE;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.engine.model.ArchiveChannel;
import org.epics.archiverappliance.engine.model.MonitoredArchiveChannel;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.servlet.ServletConfig;
import javax.servlet.ServletContext;
import javax.servlet.ServletOutputStream;
import javax.servlet.WriteListener;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Proxy;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * What the shipped engine servlet and BPL dispatcher write to the log for one request, over the real servlet, the
 * real GetEngineDataAction and a real engine channel. Only the servlet request, response and context objects are
 * stand-ins, since they are the container boundary. The log is captured at DEBUG and each event is judged by its
 * level, so a request that writes nothing cannot pass for one that writes the right thing.
 */
public class EngineRequestLoggingTest {
    private static final String PV = "EngineRequestLoggingTest:test";
    private static final ArchDBRTypes TYPE = ArchDBRTypes.DBR_SCALAR_DOUBLE;
    private static final String DATA_MARKER = "Found a total of";
    private static final String REQUESTER = "10.1.2.3";
    private static final List<String> REQUEST_LOGGERS = List.of("BasicDispatcher", "BPLServlet", "GetEngineDataAction");
    private final Instant base = Instant.now().minusSeconds(20);
    @TempDir
    Path directory;
    private ConfigServiceForTests config;
    private BPLServlet servlet;
    private ArchiveChannel channel;

    /** The container side of one request: parameters in, status and body out. */
    private static final class Exchange {
        final Map<String, String> parameters = new HashMap<>();
        final ByteArrayOutputStream body = new ByteArrayOutputStream();
        final StringWriter text = new StringWriter();
        int error = 0;
    }

    private static Object defaultFor(Class<?> type) {
        if (type == boolean.class) return false;
        if (type == int.class) return 0;
        if (type == long.class) return 0L;
        return null;
    }

    private HttpServletRequest request(Exchange exchange, String method, String path) {
        return (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] {HttpServletRequest.class}, (proxy, call, args) -> {
                    switch (call.getName()) {
                        case "getMethod":
                            return method;
                        case "getPathInfo":
                            return path;
                        case "getParameter":
                            return exchange.parameters.get((String) args[0]);
                        case "getRemoteAddr":
                            return REQUESTER;
                        default:
                            return defaultFor(call.getReturnType());
                    }
                });
    }

    private HttpServletResponse response(Exchange exchange) {
        ServletOutputStream out = new ServletOutputStream() {
            @Override
            public void write(int b) {
                exchange.body.write(b);
            }

            @Override
            public boolean isReady() {
                return true;
            }

            @Override
            public void setWriteListener(WriteListener listener) {}
        };
        return (HttpServletResponse) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] {HttpServletResponse.class}, (proxy, call, args) -> {
                    switch (call.getName()) {
                        case "getOutputStream":
                            return out;
                        case "getWriter":
                            return new PrintWriter(exchange.text);
                        case "sendError":
                            exchange.error = (Integer) args[0];
                            return null;
                        default:
                            return defaultFor(call.getReturnType());
                    }
                });
    }

    @BeforeEach
    void setUp() throws Exception {
        config = new ConfigServiceForTests(1) {
            {
                warFile = WAR_FILE.ENGINE;
            }
        };
        PlainPBStoragePlugin storage = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=request-log&rootFolder=" + directory + "&partitionGranularity=PARTITION_YEAR",
                config);
        channel = new MonitoredArchiveChannel(PV, storage, 100, null, 1, config, TYPE, null, 0, false);
        config.getEngineContext().getChannelList().put(PV, channel);
        ServletContext context = (ServletContext) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] {ServletContext.class}, (proxy, call, args) -> {
                    if (call.getName().equals("getAttribute") && ConfigService.CONFIG_SERVICE_NAME.equals(args[0])) {
                        return config;
                    }
                    return defaultFor(call.getReturnType());
                });
        ServletConfig servletConfig = (ServletConfig) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] {ServletConfig.class}, (proxy, call, args) -> {
                    if (call.getName().equals("getServletContext")) {
                        return context;
                    }
                    return defaultFor(call.getReturnType());
                });
        servlet = new BPLServlet();
        servlet.init(servletConfig);
    }

    @AfterEach
    void tearDown() throws Exception {
        if (config != null) config.shutdownNow();
    }

    private void addSamples(int count) {
        for (int i = 0; i < count; i++) {
            Assertions.assertTrue(channel.getSampleBuffer().add(
                    new POJOEvent(TYPE, base.plusSeconds(i), new ScalarValue<Double>((double) i), 0, 0)));
        }
    }

    private Exchange dataRequest(String pv, String from, String to) throws Exception {
        Exchange exchange = new Exchange();
        if (pv != null) exchange.parameters.put("pv", pv);
        if (from != null) exchange.parameters.put("from", from);
        if (to != null) exchange.parameters.put("to", to);
        servlet.service(request(exchange, "GET", "/getData.raw"), response(exchange));
        return exchange;
    }

    /** The INFO lines of the loggers a request passes through; the engine's background threads log elsewhere. */
    private static List<CapturedLog.Entry> infoLines(CapturedLog log) {
        return log.at(Level.INFO).stream()
                .filter(e -> REQUEST_LOGGERS.stream().anyMatch(name -> e.logger().endsWith(name)))
                .toList();
    }

    private static CapturedLog.Entry onlyDataRecord(CapturedLog log) {
        List<CapturedLog.Entry> records = infoLines(log).stream()
                .filter(e -> e.message().startsWith(DATA_MARKER))
                .toList();
        Assertions.assertEquals(1, records.size(), "one data record among: " + infoLines(log));
        Assertions.assertTrue(records.getFirst().logger().endsWith("GetEngineDataAction"), records.getFirst().logger());
        return records.getFirst();
    }

    private static void assertRecordFields(CapturedLog.Entry record, String outcome, int events) {
        String message = record.message();
        Assertions.assertTrue(message.startsWith(DATA_MARKER + " " + events + " in "), message);
        Assertions.assertTrue(message.contains("pv=" + PV), message);
        Assertions.assertTrue(message.contains("requester=" + REQUESTER), message);
        Assertions.assertTrue(message.contains("outcome=" + outcome), message);
        Assertions.assertFalse(record.hasThrowable(), "no stack trace in the record");
    }

    private static void assertRestoredAtDebug(CapturedLog log, String path) {
        Assertions.assertTrue(
                log.at(Level.DEBUG).stream().anyMatch(e -> e.message().equals("Servicing " + path)),
                "the dispatcher line is available at DEBUG");
        Assertions.assertTrue(
                log.at(Level.DEBUG).stream()
                        .anyMatch(e -> e.message().startsWith("Beginning request into Engine servlet " + path)),
                "the servlet line is available at DEBUG");
    }

    @Test
    void aServedRequestWritesOneRecordAtInfo() throws Exception {
        addSamples(3);
        try (CapturedLog log = new CapturedLog("org.epics.archiverappliance", Level.DEBUG)) {
            Exchange exchange = dataRequest(PV, base.minusSeconds(5).toString(), base.plusSeconds(30).toString());
            log.settle();
            Assertions.assertTrue(exchange.body.size() > 0, "the stream was served");
            Assertions.assertEquals(0, exchange.error);
            assertRecordFields(onlyDataRecord(log), "served", 3);
            Assertions.assertEquals(1, infoLines(log).size(), "only the record at INFO: " + infoLines(log));
            assertRestoredAtDebug(log, "/getData.raw");
        }
    }

    @Test
    void anEmptyResponseWritesOneRecordAtInfo() throws Exception {
        try (CapturedLog log = new CapturedLog("org.epics.archiverappliance", Level.DEBUG)) {
            Exchange exchange = dataRequest(PV, base.minusSeconds(5).toString(), base.plusSeconds(30).toString());
            log.settle();
            Assertions.assertTrue(exchange.body.size() > 0, "a header-only stream was served");
            Assertions.assertEquals(0, exchange.error);
            assertRecordFields(onlyDataRecord(log), "empty", 0);
            Assertions.assertEquals(1, infoLines(log).size(), "only the record at INFO: " + infoLines(log));
        }
    }

    @Test
    void aFailedRequestWritesOneRecordAtInfoAndOneErrorWithTheStackTrace() throws Exception {
        try (CapturedLog log = new CapturedLog("org.epics.archiverappliance", Level.DEBUG)) {
            Assertions.assertThrows(IOException.class, () -> dataRequest(PV, "not-a-time", null));
            log.settle();
            assertRecordFields(onlyDataRecord(log), "failed", 0);
            Assertions.assertEquals(1, infoLines(log).size(), "only the record at INFO: " + infoLines(log));
            List<CapturedLog.Entry> errors = log.at(Level.ERROR);
            Assertions.assertEquals(1, errors.size(), "the exception is logged once: " + errors);
            Assertions.assertTrue(errors.getFirst().hasThrowable(), "the stack trace stays on the ERROR");
        }
    }

    @Test
    void aPVWithoutAChannelWritesNothingAtInfo() throws Exception {
        try (CapturedLog log = new CapturedLog("org.epics.archiverappliance", Level.DEBUG)) {
            Exchange exchange = dataRequest("EngineRequestLoggingTest:absent", null, null);
            log.settle();
            Assertions.assertEquals(404, exchange.error);
            Assertions.assertEquals(List.of(), infoLines(log), "nothing at INFO");
            Assertions.assertTrue(
                    log.at(Level.DEBUG).stream().anyMatch(e -> e.message().startsWith("No data for PV")),
                    "the miss is available at DEBUG");
        }
    }

    @Test
    void aRequestWithoutAPVParameterWritesNothingAtInfo() throws Exception {
        try (CapturedLog log = new CapturedLog("org.epics.archiverappliance", Level.DEBUG)) {
            Exchange exchange = dataRequest(null, null, null);
            log.settle();
            Assertions.assertEquals(400, exchange.error);
            Assertions.assertEquals(List.of(), infoLines(log), "nothing at INFO");
        }
    }

    @Test
    void aBPLRequestWritesNoLineAtInfoForGetAndPost() throws Exception {
        try (CapturedLog log = new CapturedLog("org.epics.archiverappliance", Level.DEBUG)) {
            Exchange get = new Exchange();
            servlet.service(request(get, "GET", "/ping"), response(get));
            Exchange post = new Exchange();
            servlet.service(request(post, "POST", "/ping"), response(post));
            log.settle();
            Assertions.assertTrue(get.text.toString().contains("pong"));
            Assertions.assertTrue(post.text.toString().contains("pong"));
            Assertions.assertEquals(List.of(), infoLines(log), "nothing at INFO");
            Assertions.assertEquals(
                    2,
                    log.at(Level.DEBUG).stream()
                            .filter(e -> e.message().equals("Servicing /ping"))
                            .count(),
                    "both dispatcher lines are available at DEBUG");
            Assertions.assertTrue(log.at(Level.DEBUG).stream()
                    .anyMatch(e -> e.message().startsWith("Beginning POST request into Engine servlet /ping")));
        }
    }
}
