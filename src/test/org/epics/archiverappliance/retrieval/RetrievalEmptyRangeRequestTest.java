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
import org.junit.jupiter.api.function.Executable;

import javax.servlet.http.HttpServletRequest;
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
        servlet = ServletTransportFixture.initServlet(config);
    }

    private static HttpServletRequest request(String operator, String from, String to) {
        Map<String, String> query = new HashMap<>();
        query.put("pv", PV);
        query.put("from", from);
        query.put("to", to);
        if (!operator.equals("raw")) query.put("pp", operator);
        return ServletTransportFixture.request("getData.json", query);
    }

    /** The number of samples in the JSON answer; an answer without an entry for the PV holds none. */
    private static int samples(Response response) throws Exception {
        JSONArray answer = (JSONArray) JSONValue.parseWithException(response.body());
        int samples = 0;
        for (Object entry : answer) {
            samples += ((JSONArray) ((JSONObject) entry).get("data")).size();
        }
        return samples;
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
        assertEquals(0, samples(response));
    }

    /** Each operator is checked on its own, so one failing operator does not hide the others. */
    @Test
    void operatorsAnswerNoSamplesOverARangeWithoutSamples() {
        assertAll(OPERATORS.stream().map(operator -> (Executable) () -> {
            Response response = get(operator, EMPTY_FROM, EMPTY_TO);
            assertEquals(200, response.status, operator + ": " + response.message);
            assertEquals(0, samples(response), operator);
        }));
    }

    @Test
    void operatorsAnswerSamplesOverARangeWithSamples() {
        assertAll(OPERATORS.stream().map(operator -> (Executable) () -> {
            Response response = get(operator, DATA_FROM, DATA_TO);
            assertEquals(200, response.status, operator + ": " + response.message);
            assertTrue(samples(response) > 0, operator + " answered no sample over a range with samples");
        }));
    }
}
