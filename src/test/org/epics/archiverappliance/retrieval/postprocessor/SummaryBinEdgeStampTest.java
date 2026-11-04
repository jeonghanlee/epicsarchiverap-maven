package org.epics.archiverappliance.retrieval.postprocessor;

import org.apache.commons.io.FileUtils;
import org.awaitility.Awaitility;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.EventStream;
import org.epics.archiverappliance.PVCaPut;
import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.retrieval.client.RawDataRetrievalAsEventStream;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A bin event is stamped at the bin midpoint and the retrieval drops events stamped after the request end. The bin
 * interval is chosen so that the midpoint of the current bin lies after the end of the window, which ends inside that
 * bin. Every bin operator of the real retrieval must then return one event for the bin, stamped at the window end,
 * and one event when the window ends at the next bin edge; the raw retrieval returns every sample.
 */
@Tag("integration")
@Tag("localEpics")
public class SummaryBinEdgeStampTest {
    private static final String MGMT = "http://localhost:17665/mgmt/bpl/";
    private static final String[] OPERATORS = {
        "mean", "meanSample", "median", "firstFill", "lastFill", "linear", "loess"
    };
    private static final long[] CANDIDATE_BINS = {432000, 345600, 259200, 604800, 172800, 86400, 43200, 21600};
    private static final double[] VALUES = {0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5};

    private final TomcatSetup tomcatSetup = new TomcatSetup();
    private final SIOCSetup siocSetup = new SIOCSetup();
    private final String pvName = "UnitTestNoNamingConvention:inactive1";

    @BeforeEach
    public void setUp() throws Exception {
        clean();
        if (!System.getenv().containsKey("ARCHAPPL_SHORT_TERM_FOLDER")
                && !System.getProperties().containsKey("ARCHAPPL_SHORT_TERM_FOLDER")) {
            System.getProperties().put("ARCHAPPL_SHORT_TERM_FOLDER", ConfigServiceForTests.getDefaultShortTermFolder());
        }
        if (!System.getenv().containsKey("ARCHAPPL_MEDIUM_TERM_FOLDER")
                && !System.getProperties().containsKey("ARCHAPPL_MEDIUM_TERM_FOLDER")) {
            System.getProperties().put("ARCHAPPL_MEDIUM_TERM_FOLDER", ConfigServiceForTests.getDefaultPBTestFolder());
        }
        siocSetup.startSIOCWithDefaultDB();
        tomcatSetup.setUpWebApps(this.getClass().getSimpleName());
    }

    @AfterEach
    public void tearDown() throws Exception {
        tomcatSetup.tearDown();
        siocSetup.stopSIOC();
        clean();
    }

    private static void clean() throws Exception {
        FileUtils.deleteDirectory(new File(ConfigServiceForTests.getDefaultShortTermFolder() + File.separator
                + "UnitTestNoNamingConvention"));
        FileUtils.deleteDirectory(new File(ConfigServiceForTests.getDefaultPBTestFolder() + File.separator
                + "UnitTestNoNamingConvention"));
    }

    private static String enc(String text) {
        return URLEncoder.encode(text, StandardCharsets.UTF_8);
    }

    private static String statusOf(String pv) throws Exception {
        JSONArray status = GetUrlContent.getURLContentAsJSONArray(MGMT + "getPVStatus?pv=" + enc(pv));
        if (status == null || status.isEmpty()) return "(absent)";
        return String.valueOf(((JSONObject) status.get(0)).get("status"));
    }

    /** The events of one request, as epoch seconds of their stamps. */
    private List<Long> stamps(String pv, Instant start, Instant end) throws Exception {
        RawDataRetrievalAsEventStream retrieval = new RawDataRetrievalAsEventStream(
                "http://localhost:" + ConfigServiceForTests.RETRIEVAL_TEST_PORT + "/retrieval/data/getData.raw");
        List<Long> result = new ArrayList<>();
        try (EventStream stream = retrieval.getDataForPVS(new String[] {pv}, start, end, null)) {
            if (stream != null) {
                for (Event event : stream) result.add(event.getEpochSeconds());
            }
        }
        return result;
    }

    @Test
    public void everyBinOperatorReturnsTheBinThatContainsTheWindowEnd() throws Exception {
        Awaitility.await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> GetUrlContent.getURLContentAsJSONArray(MGMT + "archivePV?pv=" + enc(pvName)) != null);
        Awaitility.await()
                .atMost(Duration.ofMinutes(5))
                .pollInterval(Duration.ofSeconds(10))
                .ignoreExceptions()
                .until(() -> "Being archived".equals(statusOf(pvName)));
        new PVCaPut().caPutValues(pvName, VALUES, 1100);
        Thread.sleep(3000);

        Instant start = TimeUtils.minusDays(TimeUtils.now(), 1);
        Instant end = TimeUtils.now();
        long endSeconds = TimeUtils.convertToEpochSeconds(end);
        long bin = 0;
        for (long candidate : CANDIDATE_BINS) {
            if (endSeconds % candidate < candidate / 2 - 600) {
                bin = candidate;
                break;
            }
        }
        Assertions.assertTrue(bin > 0, "no candidate bin has its midpoint after the end of the window");
        Instant nextEdge = TimeUtils.convertFromEpochSeconds((endSeconds / bin + 1) * bin, 0);
        long midpoint = (endSeconds / bin) * bin + bin / 2;

        List<Long> raw = stamps(pvName, start, end);
        StringBuilder out = new StringBuilder();
        out.append("PROBE bin=").append(bin).append(" end=").append(endSeconds).append(" currentBinMidpoint=")
                .append(midpoint).append(" midpointAfterEnd=").append(midpoint - endSeconds).append(" s raw=")
                .append(raw.size()).append('\n');
        Assertions.assertEquals(VALUES.length, raw.size(), "the raw retrieval returns every sample");

        for (String operator : OPERATORS) {
            String name = operator + "_" + bin + "(" + pvName + ")";
            List<Long> insideEnd = stamps(name, start, end);
            List<Long> atNextEdge = stamps(name, start, nextEdge);
            Assertions.assertEquals(List.of(endSeconds), insideEnd, operator + " returns one event, stamped at the window end");
            out.append("PROBE operator=").append(operator).append(" eventsEndInsideBin=").append(insideEnd.size())
                    .append(" eventsEndAtNextEdge=").append(atNextEdge.size()).append('\n');
            Assertions.assertTrue(
                    atNextEdge.size() >= 1, operator + " returns its event when the window ends at the next bin edge");
        }
        System.out.print(out);
        Files.writeString(new File("target/summary-bin-edge-probe.txt").toPath(), out.toString());
    }
}
