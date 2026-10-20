package org.epics.archiverappliance.retrieval;

import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.servlet.http.HttpServletResponse;

/**
 * Tests the retrieval operator of data requests: each PV of a getDataForPVs request takes the operator of its own
 * function-call name or of the request pp, and a request with an unknown or malformed operator is a bad request
 * whose body carries the reason.
 */
@Tag("integration")
public class RetrievalOperatorRequestTest {

    private static final String PV_A = ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "OperatorRequestA";
    private static final String PV_B = ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "OperatorRequestB";
    private static final String FROM = "2011-02-01T08:00:00.000Z";
    private static final String TO = "2011-02-01T09:00:00.000Z";
    private static final int MIN_RAW_EVENTS_IN_RANGE = 3000;
    private static final int MAX_BINNED_EVENTS_IN_RANGE = 100;

    private final TomcatSetup tomcatSetup = new TomcatSetup();
    private final HttpClient client = HttpClient.newHttpClient();

    @BeforeEach
    public void setUp() throws Exception {
        Instant dataStart = TimeUtils.convertFromISO8601String("2011-02-01T00:00:00.000Z");
        Instant dataEnd = TimeUtils.convertFromISO8601String("2011-02-02T00:00:00.000Z");
        GenerateData.generateSineForPV(PV_A, 0, ArchDBRTypes.DBR_SCALAR_DOUBLE, dataStart, dataEnd);
        GenerateData.generateSineForPV(PV_B, 45, ArchDBRTypes.DBR_SCALAR_DOUBLE, dataStart, dataEnd);
        tomcatSetup.setUpWebApps(this.getClass().getSimpleName());
    }

    @AfterEach
    public void tearDown() throws Exception {
        tomcatSetup.tearDown();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private HttpResponse<String> get(String method, String query) throws Exception {
        String url = ConfigServiceForTests.DATA_RETRIEVAL_URL + "/data/" + method + ".json?" + query
                + "&from=" + encode(FROM) + "&to=" + encode(TO);
        return client.send(HttpRequest.newBuilder(URI.create(url)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> getSingle(String query) throws Exception {
        return get("getData", query);
    }

    private HttpResponse<String> getMulti(String query) throws Exception {
        return get("getDataForPVs", query);
    }

    /**
     * Returns the data array of the named PV from the JSON answer of getData or getDataForPVs.
     */
    private static JSONArray dataOf(HttpResponse<String> response, String pvName) {
        Assertions.assertEquals(HttpServletResponse.SC_OK, response.statusCode(), response.body());
        JSONArray answer = (JSONArray) JSONValue.parse(response.body());
        Assertions.assertNotNull(answer, response.body());
        for (Object element : answer) {
            JSONObject entry = (JSONObject) element;
            if (pvName.equals(((JSONObject) entry.get("meta")).get("name"))) {
                return (JSONArray) entry.get("data");
            }
        }
        Assertions.fail("No data of " + pvName + " in the answer");
        return null;
    }

    /**
     * Requests the PVs together and each one alone; the data of each PV in the joint answer has to equal its single answer.
     * @param multiQuery The query of the getDataForPVs request.
     * @param singleQueryByPv The query of the getData request for each PV in the joint answer.
     */
    private void assertEachPVEqualsItsSingleAnswer(String multiQuery, Map<String, String> singleQueryByPv)
            throws Exception {
        HttpResponse<String> multi = getMulti(multiQuery);
        for (Map.Entry<String, String> single : singleQueryByPv.entrySet()) {
            JSONArray expected = dataOf(getSingle(single.getValue()), single.getKey());
            JSONArray actual = dataOf(multi, single.getKey());
            Assertions.assertFalse(expected.isEmpty(), single.getValue());
            Assertions.assertEquals(
                    expected.toJSONString(),
                    actual.toJSONString(),
                    "Data of " + single.getKey() + " for " + multiQuery + " differs from the request " + single.getValue());
        }
    }

    private static Map<String, String> singles(String queryOfA, String queryOfB) {
        Map<String, String> singles = new LinkedHashMap<>();
        singles.put(PV_A, queryOfA);
        singles.put(PV_B, queryOfB);
        return singles;
    }

    /**
     * The operator of the first PV does not reach the PVs after it.
     */
    @Test
    public void testOperatorOfAPVDoesNotReachTheNextPV() throws Exception {
        String binnedA = "pv=" + encode(PV_A) + "&pp=mean_60";
        String rawB = "pv=" + encode(PV_B);

        assertEachPVEqualsItsSingleAnswer(
                "pv=" + encode("mean_60(" + PV_A + ")") + "&pv=" + encode(PV_B), singles(binnedA, rawB));
        assertEachPVEqualsItsSingleAnswer(
                "pv=" + encode("mean(" + PV_A + ",60)") + "&pv=" + encode(PV_B), singles(binnedA, rawB));
        assertEachPVEqualsItsSingleAnswer(
                "pv=" + encode(PV_B) + "&pv=" + encode("mean_60(" + PV_A + ")"), singles(binnedA, rawB));
    }

    /**
     * A PV without an operator of its own takes the pp of the request, also after a PV with an operator.
     */
    @Test
    public void testRequestOperatorReachesThePVsWithoutAnOperatorOfTheirOwn() throws Exception {
        String binnedA = "pv=" + encode(PV_A) + "&pp=mean_60";
        String requestBinnedB = "pv=" + encode(PV_B) + "&pp=mean_10";

        assertEachPVEqualsItsSingleAnswer(
                "pp=mean_10&pv=" + encode("mean_60(" + PV_A + ")") + "&pv=" + encode(PV_B),
                singles(binnedA, requestBinnedB));
        assertEachPVEqualsItsSingleAnswer(
                "pp=mean_10&pv=" + encode("mean(" + PV_A + ",60)") + "&pv=" + encode(PV_B),
                singles(binnedA, requestBinnedB));
        assertEachPVEqualsItsSingleAnswer(
                "pp=mean_10&pv=" + encode(PV_A) + "&pv=" + encode(PV_B),
                singles("pv=" + encode(PV_A) + "&pp=mean_10", requestBinnedB));
    }

    /**
     * The binned PV has fewer events than the raw one, so the operator is applied to the PV that names it.
     */
    @Test
    public void testOperatorIsAppliedToTheNamedPV() throws Exception {
        HttpResponse<String> multi =
                getMulti("pv=" + encode("mean_60(" + PV_A + ")") + "&pv=" + encode(PV_B));
        Assertions.assertTrue(dataOf(multi, PV_A).size() <= MAX_BINNED_EVENTS_IN_RANGE);
        Assertions.assertTrue(dataOf(multi, PV_B).size() >= MIN_RAW_EVENTS_IN_RANGE);
    }

    private static final List<String> BAD_OPERATORS =
            List.of("bogus", "meanx", "mean_abc", "mean_0", "mean_60.5", "nth_-1");

    /**
     * An unknown or malformed operator is a bad request; the body names the operator.
     */
    @Test
    public void testBadOperatorAnswersBadRequestWithTheReason() throws Exception {
        for (String operator : BAD_OPERATORS) {
            assertBadRequestNaming(operator, getSingle("pv=" + encode(PV_A) + "&pp=" + encode(operator)));
            assertBadRequestNaming(
                    operator, getMulti("pv=" + encode(PV_A) + "&pv=" + encode(PV_B) + "&pp=" + encode(operator)));
            assertBadRequestNaming(operator, getSingle("pv=" + encode(operator + "(" + PV_A + ")")));
            assertBadRequestNaming(
                    operator, getMulti("pv=" + encode(PV_B) + "&pv=" + encode(operator + "(" + PV_A + ")")));
        }
    }

    private static void assertBadRequestNaming(String operator, HttpResponse<String> response) {
        Assertions.assertEquals(
                HttpServletResponse.SC_BAD_REQUEST, response.statusCode(), operator + ": " + response.body());
        Assertions.assertTrue(
                response.body().contains(operator), "The body does not name " + operator + ": " + response.body());
    }

    /**
     * A blank pp and the names of raw data answer the raw data; the server-internal names are accepted as raw data too.
     */
    @Test
    public void testRawAndInternalNamesAnswerRawData() throws Exception {
        int rawEvents = dataOf(getSingle("pv=" + encode(PV_A)), PV_A).size();
        Assertions.assertTrue(rawEvents >= MIN_RAW_EVENTS_IN_RANGE);
        for (String pp : List.of("", "%20", "pb", "twoweek", "extraFields")) {
            HttpResponse<String> single = getSingle("pv=" + encode(PV_A) + "&pp=" + pp);
            Assertions.assertEquals(rawEvents, dataOf(single, PV_A).size(), "getData pp=" + pp);
            HttpResponse<String> multi = getMulti("pv=" + encode(PV_A) + "&pv=" + encode(PV_B) + "&pp=" + pp);
            Assertions.assertEquals(rawEvents, dataOf(multi, PV_A).size(), "getDataForPVs pp=" + pp);
            Assertions.assertEquals(rawEvents, dataOf(multi, PV_B).size(), "getDataForPVs pp=" + pp);
        }
    }

    /**
     * A valid operator answers 200 with the data; deadBand_0 is valid.
     */
    @Test
    public void testValidOperatorsAnswerData() throws Exception {
        HttpResponse<String> binned = getSingle("pv=" + encode(PV_A) + "&pp=mean_60");
        Assertions.assertTrue(dataOf(binned, PV_A).size() <= MAX_BINNED_EVENTS_IN_RANGE);
        HttpResponse<String> binnedMulti = getMulti("pv=" + encode(PV_A) + "&pv=" + encode(PV_B) + "&pp=mean_60");
        Assertions.assertTrue(dataOf(binnedMulti, PV_A).size() <= MAX_BINNED_EVENTS_IN_RANGE);
        Assertions.assertTrue(dataOf(binnedMulti, PV_B).size() <= MAX_BINNED_EVENTS_IN_RANGE);

        Assertions.assertFalse(dataOf(getSingle("pv=" + encode(PV_A) + "&pp=deadBand_0"), PV_A).isEmpty());
        Assertions.assertFalse(dataOf(getMulti("pv=" + encode(PV_A) + "&pv=" + encode(PV_B) + "&pp=deadBand_0"), PV_A)
                .isEmpty());
    }
}
