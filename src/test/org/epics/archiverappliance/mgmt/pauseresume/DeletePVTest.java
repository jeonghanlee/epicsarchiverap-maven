package org.epics.archiverappliance.mgmt.pauseresume;

import edu.stanford.slac.archiverappliance.PlainPB.FileBackedPBEventStream;
import edu.stanford.slac.archiverappliance.PlainPB.PBFileInfo;
import org.awaitility.Awaitility;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.EventStream;
import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.persistence.JDBM2Persistence;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.epics.archiverappliance.retrieval.client.RawDataRetrievalAsEventStream;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Verifies configuration deletion and both PB-data modes through actual BPL and readers. */
@Tag("integration")
@Tag("localEpics")
public class DeletePVTest {
    private static final String MGMT = "http://localhost:17665/mgmt/bpl/";
    private static final String[] STORE_ENV = {
        "ARCHAPPL_SHORT_TERM_FOLDER", "ARCHAPPL_MEDIUM_TERM_FOLDER", "ARCHAPPL_LONG_TERM_FOLDER"
    };
    private final String prefix = "PVDELJ:" + UUID.randomUUID().toString().substring(0, 8) + ":";
    private final String target = prefix + "test_0";
    private final String control = prefix + "test_1";
    private final String alias = prefix + "configuredAlias";
    private final TomcatSetup tomcatSetup = new TomcatSetup();
    private final SIOCSetup siocSetup = new SIOCSetup(prefix);
    private boolean tomcatStopped;

    private record Sample(long seconds, int nanos, Object value, int status, int severity) {}
    private record Stored(Map<String, Map<Sample, Integer>> samples, Set<String> headers, Set<Path> paths) {}

    @BeforeEach
    public void setUp() throws Exception {
        Path persistence = Path.of(ConfigServiceForTests.getDefaultPBTestFolder(), prefix.replace(":", ""));
        Files.createDirectories(persistence);
        System.setProperty(ConfigService.ARCHAPPL_PERSISTENCE_LAYER, JDBM2Persistence.class.getName());
        System.setProperty(JDBM2Persistence.ARCHAPPL_JDBM2_FILENAME, persistence.resolve("testconfig.jdbm2").toString());
        siocSetup.startSIOCWithDefaultDB();
        tomcatSetup.setUpWebApps(getClass().getSimpleName());
    }

    @AfterEach
    public void tearDown() throws Exception {
        try {
            if (!tomcatStopped) {
                tomcatSetup.tearDown();
            }
        } finally {
            siocSetup.stopSIOC();
        }
    }

    private static String enc(String name) {
        return URLEncoder.encode(name, StandardCharsets.UTF_8);
    }

    private static JSONObject api(String action, String query) throws Exception {
        JSONObject response = GetUrlContent.getURLContentAsJSONObject(MGMT + action + "?" + query);
        Assertions.assertNotNull(response, action + " response");
        return response;
    }

    private static String status(String pv) throws Exception {
        JSONArray rows = GetUrlContent.getURLContentAsJSONArray(MGMT + "getPVStatus?pv=" + enc(pv));
        Assertions.assertNotNull(rows);
        Assertions.assertEquals(1, rows.size());
        return String.valueOf(((JSONObject) rows.get(0)).get("status"));
    }

    private static boolean typeInfoAbsent(String pv) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) URI.create(MGMT + "getPVTypeInfo?pv=" + enc(pv))
                .toURL().openConnection();
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(5000);
        try {
            return connection.getResponseCode() == 404;
        } finally {
            connection.disconnect();
        }
    }

    private static void accepted(JSONObject response) {
        Assertions.assertEquals("ok", response.get("status"));
        Assertions.assertTrue(response.get("validation") == null || "".equals(response.get("validation")));
    }

    private static Sample sample(DBRTimeEvent event) {
        return new Sample(event.getEpochSeconds(), event.getEventTimeStamp().getNano(),
                event.getSampleValue().getValue(), event.getStatus(), event.getSeverity());
    }

    private static Map<Sample, Integer> retrieval(String pv, Instant start, Instant end) throws IOException {
        Map<Sample, Integer> result = new HashMap<>();
        RawDataRetrievalAsEventStream reader = new RawDataRetrievalAsEventStream(
                "http://localhost:" + ConfigServiceForTests.RETRIEVAL_TEST_PORT + "/retrieval/data/getData.raw");
        try (EventStream events = reader.getDataForPVS(new String[] {pv}, start, end, null)) {
            Assertions.assertNotNull(events);
            for (Event event : events) {
                result.merge(sample((DBRTimeEvent) event), 1, Integer::sum);
            }
        }
        return result;
    }

    private Stored stored(Instant start, Instant end) throws IOException {
        Map<String, Map<Sample, Integer>> result = new HashMap<>();
        Set<String> headers = new HashSet<>();
        Set<Path> paths = new HashSet<>();
        for (String variable : STORE_ENV) {
            Assertions.assertNotNull(System.getenv(variable), variable);
            Path folder = Path.of(System.getenv(variable), prefix.split(":"));
            if (!Files.exists(folder)) {
                continue;
            }
            try (var files = Files.walk(folder)) {
                for (Path path : files.filter(Files::isRegularFile).toList()) {
                    paths.add(path);
                    Assertions.assertTrue(path.toString().endsWith(".pb"), "Unexpected store file " + path);
                    PBFileInfo info = new PBFileInfo(path);
                    headers.add(info.getPVName());
                    Map<Sample, Integer> records = result.computeIfAbsent(info.getPVName(), key -> new HashMap<>());
                    try (FileBackedPBEventStream events = new FileBackedPBEventStream(
                            info.getPVName(), path, info.getType())) {
                        for (Event event : events) {
                            if (!event.getEventTimeStamp().isBefore(start) && !event.getEventTimeStamp().isAfter(end)) {
                                records.merge(sample((DBRTimeEvent) event), 1, Integer::sum);
                            }
                        }
                    }
                }
            }
        }
        return new Stored(result, headers, paths);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    public void testDeletionModes(boolean deleteData) throws Exception {
        Instant start = Instant.now();
        for (String pv : new String[] {target, control}) {
            JSONArray response = GetUrlContent.getURLContentAsJSONArray(MGMT + "archivePV?pv=" + enc(pv));
            Assertions.assertNotNull(response);
        }
        Awaitility.await().atMost(Duration.ofSeconds(360)).pollInterval(Duration.ofSeconds(1))
                .until(() -> "Being archived".equals(status(target)) && "Being archived".equals(status(control)));
        Awaitility.await().atMost(Duration.ofSeconds(120)).pollInterval(Duration.ofSeconds(1))
                .until(() -> retrieval(target, start, Instant.now()).values().stream().mapToInt(Integer::intValue).sum() >= 3
                        && retrieval(control, start, Instant.now()).values().stream().mapToInt(Integer::intValue).sum() >= 3);
        accepted(api("pauseArchivingPV", "pv=" + enc(target)));
        Awaitility.await().atMost(Duration.ofSeconds(120)).pollInterval(Duration.ofSeconds(1))
                .until(() -> "Paused".equals(status(target)));
        Instant end = Instant.now();
        Map<Sample, Integer> baseline = retrieval(target, start, end);
        Map<Sample, Integer> controlBaseline = retrieval(control, start, end);
        JSONObject controlInfo = api("getPVTypeInfo", "pv=" + enc(control));
        Awaitility.await().atMost(Duration.ofSeconds(120)).pollInterval(Duration.ofSeconds(1))
                .until(() -> baseline.equals(stored(start, end).samples().get(target)));
        Assertions.assertTrue(baseline.values().stream().mapToInt(Integer::intValue).sum() >= 3);
        accepted(api("addAlias", "pv=" + enc(target) + "&aliasname=" + enc(alias)));

        JSONObject rejected = api("deletePV", "pv=" + enc(control) + "&deleteData=" + deleteData);
        Assertions.assertNotEquals("ok", rejected.get("status"));
        Assertions.assertTrue(rejected.get("validation") instanceof String
                && !((String) rejected.get("validation")).isEmpty());
        Assertions.assertEquals(controlInfo, api("getPVTypeInfo", "pv=" + enc(control)));

        accepted(api("deletePV", "pv=" + enc(alias) + "&deleteData=" + deleteData));
        Awaitility.await().atMost(Duration.ofSeconds(120)).pollInterval(Duration.ofSeconds(1))
                .until(() -> "Not being archived".equals(status(target)) && typeInfoAbsent(target));
        JSONArray aliases = GetUrlContent.getURLContentAsJSONArray(MGMT + "getAllAliases");
        Assertions.assertNotNull(aliases);
        Assertions.assertTrue(aliases.stream().noneMatch(row -> target.equals(((JSONObject) row).get("srcPVName"))));
        Assertions.assertEquals(controlInfo, api("getPVTypeInfo", "pv=" + enc(control)));
        Assertions.assertEquals(controlBaseline, retrieval(control, start, end));
        tomcatSetup.tearDown();
        tomcatStopped = true;
        Stored finalData = stored(start, end);
        Assertions.assertEquals(controlBaseline, finalData.samples().get(control));
        if (deleteData) {
            Assertions.assertFalse(finalData.headers().contains(target));
            Assertions.assertTrue(finalData.paths().stream().noneMatch(path -> path.getFileName().toString().startsWith("test_0:")));
        } else {
            Assertions.assertEquals(baseline, finalData.samples().get(target));
        }
    }
}
