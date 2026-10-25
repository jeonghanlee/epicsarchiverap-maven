package org.epics.archiverappliance.utils.ui;

import com.sun.net.httpserver.HttpServer;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/** Exercises the real HTTP helper with only its outer server response controlled. */
class GetUrlContentStatusTest {
    private static final String CONTENT_TYPE = "text/html; charset=UTF-8";
    private static final String ERROR_BODY = "<html><body>Retrieval memory pressure: test condition</body></html>";
    private HttpServer server;

    private String serve(int status, String contentType, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/reply", exchange -> {
            exchange.getRequestBody().readAllBytes();
            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.sendResponseHeaders(status, bytes.length);
            try (var output = exchange.getResponseBody()) { output.write(bytes); }
        });
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/reply";
    }

    @AfterEach void stop() {
        if (server != null) server.stop(0);
    }

    @Test void strictFailurePreservesStatusContentTypeAndBody() throws Exception {
        String url = serve(503, CONTENT_TYPE, ERROR_BODY);
        var failure = assertThrows(GetUrlContent.HttpStatusException.class,
                () -> GetUrlContent.postStringListAndGetJSON(url, "pv", List.of("test:pv"), true));
        assertEquals(503, failure.status());
        assertEquals(CONTENT_TYPE, failure.contentType());
        assertArrayEquals(ERROR_BODY.getBytes(StandardCharsets.UTF_8), failure.body());
    }

    @Test void strictSuccessParsesTheActualResponse() throws Exception {
        String url = serve(200, "application/json", "{\"sample\":123}");
        JSONObject result = GetUrlContent.postStringListAndGetJSON(url, "pv", List.of("test:pv"), true);
        assertEquals(123L, result.get("sample"));
    }

    @Test void strictMalformedSuccessCannotBecomeAnEmptyResult() throws Exception {
        String url = serve(200, CONTENT_TYPE, "<html>unavailable</html>");
        assertThrows(IOException.class,
                () -> GetUrlContent.postStringListAndGetJSON(url, "pv", List.of("test:pv"), true));
    }

    @Test void legacyCallRetainsItsPermissiveParsing() throws Exception {
        String url = serve(503, CONTENT_TYPE, ERROR_BODY);
        assertNull(GetUrlContent.postStringListAndGetJSON(url, "pv", List.of("test:pv")));
    }

    @Test void cancellationStopsAnOutstandingResponseHeaderRead() throws Exception {
        cancellationStopsRead(false);
    }

    @Test void cancellationStopsAnOutstandingResponseBodyRead() throws Exception {
        cancellationStopsRead(true);
    }

    private void cancellationStopsRead(boolean sendHeaders) throws Exception {
        var reached = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var expired = new AtomicBoolean();
        byte[] body = "{\"sample\":123}".getBytes(StandardCharsets.UTF_8);
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/reply", exchange -> {
            try {
                exchange.getRequestBody().readAllBytes();
                if (sendHeaders) {
                    exchange.sendResponseHeaders(200, body.length);
                    exchange.getResponseBody().write(body, 0, 1);
                    exchange.getResponseBody().flush();
                }
                reached.countDown();
                expired.set(!release.await(5, TimeUnit.SECONDS));
                if (sendHeaders) exchange.getResponseBody().write(body, 1, body.length - 1);
                else {
                    exchange.sendResponseHeaders(200, body.length);
                    exchange.getResponseBody().write(body);
                }
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
            }
        });
        server.start();
        String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/reply";
        try (var executor = Executors.newSingleThreadExecutor(); var requests = new GetUrlContent.HttpRequests()) {
            var worker = new AtomicReference<Thread>();
            var pending = executor.submit(() -> {
                worker.set(Thread.currentThread());
                return assertThrows(IOException.class,
                        () -> GetUrlContent.postStringListAndGetJSON(url, "pv", List.of("test:pv"), true, requests));
            });
            try {
                assertTrue(reached.await(2, TimeUnit.SECONDS), "The real HTTP request must reach the held server");
                String expectedFrame = sendHeaders ? JSONValue.class.getName()
                        : "org.apache.http.impl.conn.DefaultHttpResponseParser";
                long waitUntil = System.nanoTime() + TimeUnit.SECONDS.toNanos(2);
                boolean reading = false;
                do {
                    reading = java.util.Arrays.stream(worker.get().getStackTrace())
                            .anyMatch(frame -> frame.getClassName().equals(expectedFrame));
                    if (!reading) Thread.sleep(1);
                } while (!reading && System.nanoTime() < waitUntil);
                assertTrue(reading, "The actual HTTP worker must enter " + expectedFrame);
                requests.close();
                assertNotNull(pending.get(2, TimeUnit.SECONDS));
                assertEquals(1, release.getCount(), "The real HTTP call must finish before server release");
                assertFalse(expired.get());
            } finally {
                release.countDown();
            }
        }
    }

    @Test void cancellationPreventsLateRequestRegistration() throws Exception {
        String url = serve(200, "application/json", "{\"sample\":123}");
        try (var requests = new GetUrlContent.HttpRequests()) {
            requests.close();
            IOException failure = assertThrows(IOException.class,
                    () -> GetUrlContent.postStringListAndGetJSON(url, "pv", List.of("test:pv"), true, requests));
            assertEquals("HTTP requests have been cancelled", failure.getMessage());
        }
    }
}
