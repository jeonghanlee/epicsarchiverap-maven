package org.epics.archiverappliance.retrieval;

import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.time.Duration;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Normal controls and a fixed request compared across bounded server heaps. */
@Tag("integration")
public class RetrievalMemoryControlsTest {
    @Test
    public void rawMultiPVSnapshotAndFixedQueryUseTheProductionStore() throws Exception {
        try (var server = new RetrievalMemoryNetworkFixture()) {
            var from = RetrievalMemoryNetworkFixture.FROM;
            var to = RetrievalMemoryNetworkFixture.TO;
            for (String processor : List.of("optimized_300000", "optimLastSample_300000")) {
                var fixed = server.get("json", processor, from.minusSeconds(296400), from.plusSeconds(3600));
                long maximum = server.memory.getHeapMemoryUsage().getMax();
                if (maximum <= 512L * 1024 * 1024) {
                    assertEquals(400, fixed.statusCode(), fixed.body());
                    assertTrue(fixed.body().contains("budget"));
                } else {
                    assertTrue(RetrievalMemoryNetworkFixture.hasData(fixed), fixed.body());
                }
                Files.writeString(server.evidence.resolve(processor + ".json"), fixed.body());
                System.out.println("T7 fixedQuery processor=" + processor + " maxHeap=" + maximum
                        + " status=" + fixed.statusCode());
            }

            String encodedPV = RetrievalMemoryNetworkFixture.encode(RetrievalMemoryNetworkFixture.PV);
            String multi = server.uri("json", "mean_60", from, from.plusSeconds(3600)).toString()
                    .replace("getData.json", "getDataForPVs.json") + "&pv=" + encodedPV;
            var response = server.client.send(HttpRequest.newBuilder(URI.create(multi))
                    .timeout(RetrievalMemoryNetworkFixture.TIMEOUT).GET().build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(200, response.statusCode(), response.body());
            JSONArray rows = (JSONArray) JSONValue.parse(response.body());
            assertNotNull(rows);
            assertEquals(2, rows.size(), response.body());
            for (Object row : rows) assertFalse(((JSONArray) ((JSONObject) row).get("data")).isEmpty());
            Files.writeString(server.evidence.resolve("multi.json"), response.body());
            var refused = server.client.send(HttpRequest.newBuilder(URI.create(
                            multi.replace("mean_60", "optimized_2147483647")))
                    .timeout(RetrievalMemoryNetworkFixture.TIMEOUT).GET().build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(400, refused.statusCode(), refused.body());
            assertTrue(refused.body().contains("budget"));

            URI at = URI.create(ConfigServiceForTests.DATA_RETRIEVAL_URL
                    + "/data/getDataAtTimeForAppliance?at="
                    + RetrievalMemoryNetworkFixture.encode(from.plusSeconds(1800).toString()) + "&searchPeriod=P1D");
            var snapshot = server.client.send(HttpRequest.newBuilder(at)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .timeout(RetrievalMemoryNetworkFixture.TIMEOUT)
                    .POST(HttpRequest.BodyPublishers.ofString("pv=" + encodedPV)).build(),
                    HttpResponse.BodyHandlers.ofString());
            assertEquals(200, snapshot.statusCode(), snapshot.body());
            JSONObject snapshotData = (JSONObject) JSONValue.parse(snapshot.body());
            assertNotNull(snapshotData);
            assertTrue(snapshotData.get(RetrievalMemoryNetworkFixture.PV) instanceof JSONObject, snapshot.body());
            Files.writeString(server.evidence.resolve("at-time.json"), snapshot.body());

            var file = server.evidence.resolve("raw.csv");
            var raw = server.client.send(HttpRequest.newBuilder(server.uri("csv", "", from, to))
                    .timeout(RetrievalMemoryNetworkFixture.TIMEOUT).GET().build(), HttpResponse.BodyHandlers.ofFile(file));
            assertEquals(200, raw.statusCode());
            long count = 0;
            long first = -1;
            long last = -1;
            try (var lines = Files.lines(file)) {
                var iterator = lines.iterator();
                while (iterator.hasNext()) {
                    String line = iterator.next();
                    if (line.isBlank()) continue;
                    String[] fields = line.split(",");
                    assertEquals(5, fields.length, line);
                    long timestamp = Long.parseLong(fields[0]);
                    if (count == 0) first = timestamp;
                    else assertEquals(last + 1, timestamp, "Every generated second must arrive once");
                    last = timestamp;
                    count++;
                }
            }
            assertEquals(Duration.between(from, to).getSeconds(), count);
            assertEquals(from.getEpochSecond(), first);
            assertEquals(to.getEpochSecond() - 1, last);
            assertNull(server.tomcat.exitStatus("appliance0"));
            System.out.println("T7 raw complete events=" + count + " first=" + first + " last=" + last
                    + " bytes=" + Files.size(file));
        }
    }
}
