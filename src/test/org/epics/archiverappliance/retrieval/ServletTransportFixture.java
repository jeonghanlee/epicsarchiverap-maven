package org.epics.archiverappliance.retrieval;

import org.epics.archiverappliance.config.ConfigService;

import javax.servlet.ServletConfig;
import javax.servlet.ServletContext;
import javax.servlet.ServletOutputStream;
import javax.servlet.WriteListener;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertFalse;

/**
 * Runs the real retrieval servlet without a container for the tests that drive it in process: the servlet is
 * initialized against a given configuration, a request carries a path and its query parameters, and a response
 * records the status, the error message, the body and the commit state. Only the HTTP transport is substituted.
 */
final class ServletTransportFixture {
    private ServletTransportFixture() {}

    /** Initializes a retrieval servlet that finds the given configuration as a container would hand it over. */
    static DataRetrievalServlet initServlet(ConfigService config) throws Exception {
        ServletContext context = (ServletContext) Proxy.newProxyInstance(ServletContext.class.getClassLoader(),
                new Class<?>[] {ServletContext.class}, (proxy, method, args) ->
                        method.getName().equals("getAttribute") && args[0].equals(ConfigService.CONFIG_SERVICE_NAME)
                                ? config : null);
        ServletConfig servletConfig = (ServletConfig) Proxy.newProxyInstance(ServletConfig.class.getClassLoader(),
                new Class<?>[] {ServletConfig.class}, (proxy, method, args) ->
                        method.getName().equals("getServletContext") ? context : null);
        DataRetrievalServlet servlet = new DataRetrievalServlet();
        servlet.init(servletConfig);
        return servlet;
    }

    /**
     * A request for the path under the data URL, such as getData.json, with the given query parameters; the entry
     * "method" also sets the HTTP method (GET when absent).
     */
    static HttpServletRequest request(String path, Map<String, String> query) {
        return (HttpServletRequest) Proxy.newProxyInstance(HttpServletRequest.class.getClassLoader(),
                new Class<?>[] {HttpServletRequest.class}, (proxy, method, args) -> switch (method.getName()) {
                    case "getPathInfo" -> "/" + path;
                    case "getParameter" -> query.get(args[0]);
                    case "getParameterMap" -> query.entrySet().stream().collect(Collectors.toMap(
                            Map.Entry::getKey, entry -> new String[] {entry.getValue()}));
                    case "getParameterNames" -> Collections.enumeration(query.keySet());
                    case "getParameterValues" -> query.containsKey(args[0]) ? query.get(args[0]).split(",") : null;
                    case "getRemoteAddr" -> "127.0.0.1";
                    case "getMethod" -> query.getOrDefault("method", "GET");
                    case "getContentType" -> "application/x-www-form-urlencoded";
                    case "getHeader" -> null;
                    case "getRequestURL" -> new StringBuffer("http://localhost/retrieval/data/" + path);
                    default -> throw new UnsupportedOperationException(method.toString());
                });
    }

    /**
     * A response whose status, error message and body the test reads back. The bytes written to the output stream
     * are in bytes (body()); what is written through the writer is in text. With interruptOnWrite set, a write
     * interrupts the writing thread once 256 bytes have been written, to model a client that stops reading, and
     * with commitOnWrite also set the response is committed first. An error sent or a reset made after the
     * response is committed fails the test, as a container refuses it.
     */
    static class Response {
        final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        final StringWriter text = new StringWriter();
        volatile int status = 200;
        volatile String message;
        volatile boolean committed;
        volatile boolean closed;
        boolean interruptOnWrite;
        boolean commitOnWrite;
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
                HttpServletResponse.class.getClassLoader(), new Class<?>[] {HttpServletResponse.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "getOutputStream" -> output;
                    case "getWriter" -> new PrintWriter(text);
                    case "isCommitted" -> committed;
                    case "flushBuffer" -> { committed = true; yield null; }
                    case "reset" -> { assertFalse(committed); bytes.reset(); yield null; }
                    case "sendError" -> { assertFalse(committed); status = (int) args[0];
                        message = args.length > 1 ? (String) args[1] : null; yield null; }
                    case "setStatus" -> { status = (int) args[0]; yield null; }
                    case "setContentType", "setHeader", "addHeader", "setCharacterEncoding", "setContentLength" -> null;
                    default -> throw new UnsupportedOperationException(method.toString());
                });

        /** The body written to the output stream, decoded as UTF-8. */
        String body() {
            return bytes.toString(StandardCharsets.UTF_8);
        }
    }
}
