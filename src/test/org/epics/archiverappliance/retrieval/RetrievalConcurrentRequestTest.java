package org.epics.archiverappliance.retrieval;

import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.retrieval.ServletTransportFixture.Response;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import javax.servlet.http.HttpServletRequest;
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
        servlet = ServletTransportFixture.initServlet(config);
    }

    private static HttpServletRequest request(String pv, String operator) {
        Map<String, String> query = new HashMap<>();
        query.put("pv", pv);
        query.put("from", FROM);
        query.put("to", TO);
        if (!operator.equals("raw")) query.put("pp", operator);
        return ServletTransportFixture.request("getData.json", query);
    }

    /** The number of samples of the first PV in the JSON answer. */
    private static int samples(Response response) throws Exception {
        JSONArray answer = (JSONArray) JSONValue.parseWithException(response.body());
        JSONObject first = (JSONObject) answer.get(0);
        return ((JSONArray) first.get("data")).size();
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
                    assertTrue(samples(response) > 0, "round " + round + ": samples");
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
