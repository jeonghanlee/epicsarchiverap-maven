package org.epics.archiverappliance.mgmt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import edu.stanford.slac.archiverappliance.PB.data.DBR2PBTypeMapping;
import edu.stanford.slac.archiverappliance.PB.data.PBCommonSetup;
import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Constructor;
import java.lang.reflect.Proxy;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.stream.Stream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.EventStream;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.PartitionGranularity;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.mgmt.bpl.ChangeTypeForPV;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.epics.archiverappliance.utils.simulation.SimulationEventStream;
import org.epics.archiverappliance.utils.simulation.SimulationValueGenerator;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Calls the shipped {@link ChangeTypeForPV} on a PV that is archived as a double in a real PB store and checks the
 * stored history after the change. Only the HTTP request and response are stand-ins.
 */
public class ChangeTypeForPVTest {
    private static final int EVENTS = 40;
    private static final int PERIOD_SECONDS = 600;

    private ConfigServiceForTests config;
    private PBCommonSetup setup;
    private PlainPBStoragePlugin store;
    private Instant start;

    @BeforeEach
    void setUp() throws Exception {
        config = new ConfigServiceForTests(-1);
        config.getETLLookup().manualControlForUnitTests();
        setup = new PBCommonSetup();
        store = new PlainPBStoragePlugin();
        setup.setUpRootFolder(store, "ChangeTypeForPVTest", PartitionGranularity.PARTITION_DAY);
        start = TimeUtils.getStartOfYear(TimeUtils.getCurrentYear());
    }

    @AfterEach
    void tearDown() throws Exception {
        config.shutdownNow();
        setup.deleteTestFolder();
    }

    static Stream<Arguments> supportedTargets() {
        return Stream.of(
                Arguments.of(ArchDBRTypes.DBR_SCALAR_STRING),
                Arguments.of(ArchDBRTypes.DBR_WAVEFORM_DOUBLE),
                Arguments.of(ArchDBRTypes.DBR_WAVEFORM_FLOAT),
                Arguments.of(ArchDBRTypes.DBR_WAVEFORM_INT),
                Arguments.of(ArchDBRTypes.DBR_WAVEFORM_SHORT),
                Arguments.of(ArchDBRTypes.DBR_WAVEFORM_ENUM),
                Arguments.of(ArchDBRTypes.DBR_WAVEFORM_BYTE));
    }

    static Stream<Arguments> definedFailures() {
        return Stream.of(
                Arguments.of(ArchDBRTypes.DBR_WAVEFORM_STRING), Arguments.of(ArchDBRTypes.DBR_V4_GENERIC_BYTES));
    }

    /** The value of the event at the given index; the fraction makes the text of a number differ from an integer. */
    private static double valueAt(int index) {
        return index + 0.5;
    }

    private String archiveAsDouble(String pv) throws Exception {
        ArrayListEventStream stream = new ArrayListEventStream(
                EVENTS, new RemotableEventStreamDesc(ArchDBRTypes.DBR_SCALAR_DOUBLE, pv, TimeUtils.getCurrentYear()));
        Constructor<? extends DBRTimeEvent> constructor = DBR2PBTypeMapping.getPBClassFor(
                        ArchDBRTypes.DBR_SCALAR_DOUBLE)
                .getSerializingConstructor();
        SimulationValueGenerator generator = (type, secondsIntoYear) ->
                new ScalarValue<Double>(valueAt((secondsIntoYear / PERIOD_SECONDS)));
        try (SimulationEventStream simulation = new SimulationEventStream(
                ArchDBRTypes.DBR_SCALAR_DOUBLE,
                generator,
                start,
                start.plusSeconds((long) EVENTS * PERIOD_SECONDS),
                PERIOD_SECONDS)) {
            for (Event event : simulation) {
                DBRTimeEvent stored = constructor.newInstance(event);
                stored.addFieldValue("HIHI", "Test");
                stream.add(stored);
            }
        }
        try (BasicContext context = new BasicContext()) {
            store.appendData(context, pv, stream);
        }
        PVTypeInfo info = new PVTypeInfo(pv, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        info.setPaused(true);
        info.setDataStores(new String[] {store.getURLRepresentation()});
        config.updateTypeInfoForPV(pv, info);
        config.registerPVToAppliance(pv, config.getMyApplianceInfo());
        return pv;
    }

    private JSONObject change(String pv, ArchDBRTypes target) throws Exception {
        StringWriter body = new StringWriter();
        PrintWriter writer = new PrintWriter(body);
        Map<String, String> params = Map.of("pv", pv, "newtype", target.toString());
        HttpServletRequest request = (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] {HttpServletRequest.class}, (proxy, method, args) ->
                        switch (method.getName()) {
                            case "getParameter" -> params.get(args[0]);
                            default -> throw new UnsupportedOperationException(method.getName());
                        });
        HttpServletResponse response = (HttpServletResponse) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] {HttpServletResponse.class}, (proxy, method, args) ->
                        switch (method.getName()) {
                            case "getWriter" -> writer;
                            case "setContentType" -> null;
                            default -> throw new AssertionError("Unexpected servlet operation: " + method.getName());
                        });
        new ChangeTypeForPV().execute(request, response, config);
        writer.flush();
        return (JSONObject) new JSONParser().parse(body.toString());
    }

    /** What the test checks of one stored event, read while its stream is open. */
    private record Stored(Instant time, String field, int elements, double first, String text) {}

    private List<Stored> readAll(String pv, ArchDBRTypes expectedType) throws Exception {
        List<Stored> events = new ArrayList<>();
        try (BasicContext context = new BasicContext()) {
            List<Callable<EventStream>> callables = store.getDataForPV(
                    context, pv, start.minusSeconds(86400), start.plusSeconds(86400L * 3));
            for (Callable<EventStream> callable : callables) {
                try (EventStream stream = callable.call()) {
                    assertSame(expectedType, stream.getDescription().getArchDBRType());
                    for (Event event : stream) {
                        DBRTimeEvent stored = (DBRTimeEvent) event;
                        var value = stored.getSampleValue();
                        boolean text = expectedType == ArchDBRTypes.DBR_SCALAR_STRING;
                        events.add(new Stored(
                                stored.getEventTimeStamp(),
                                stored.getFieldValue("HIHI"),
                                value.getElementCount(),
                                text ? Double.NaN : value.getValue(0).doubleValue(),
                                text ? value.toString() : null));
                    }
                }
            }
        }
        return events;
    }

    @ParameterizedTest
    @MethodSource("supportedTargets")
    void convertsTheStoredHistoryIntoTheNewType(ArchDBRTypes target) throws Exception {
        String pv = archiveAsDouble("ChangeTypeForPVTest:" + target);
        JSONObject answer = change(pv, target);
        assertEquals("ok", answer.get("status"), answer.toJSONString());
        assertSame(target, config.getTypeInfoForPV(pv).getDBRType());
        List<Stored> events = readAll(pv, target);
        assertEquals(EVENTS, events.size());
        for (int i = 0; i < events.size(); i++) {
            Stored event = events.get(i);
            assertEquals(start.plusSeconds((long) i * PERIOD_SECONDS), event.time());
            assertEquals("Test", event.field());
            if (target == ArchDBRTypes.DBR_SCALAR_STRING) {
                assertEquals(Double.toString(valueAt(i)), event.text());
            } else {
                assertEquals(1, event.elements(), "One element at event " + i);
                double expected = switch (target) {
                    case DBR_WAVEFORM_DOUBLE, DBR_WAVEFORM_FLOAT -> valueAt(i);
                    default -> (int) valueAt(i);
                };
                assertEquals(expected, event.first(), 0.0001, "Value at event " + i);
            }
        }
    }

    @ParameterizedTest
    @MethodSource("definedFailures")
    void aTargetWithoutADefinedConversionFailsAndLeavesTheHistory(ArchDBRTypes target) throws Exception {
        String pv = archiveAsDouble("ChangeTypeForPVTest:failing:" + target);
        assertThrows(Exception.class, () -> change(pv, target));
        assertSame(ArchDBRTypes.DBR_SCALAR_DOUBLE, config.getTypeInfoForPV(pv).getDBRType());
        List<Stored> events = readAll(pv, ArchDBRTypes.DBR_SCALAR_DOUBLE);
        assertEquals(EVENTS, events.size());
        assertEquals(valueAt(0), events.get(0).first(), 0.0001);
    }

    @ParameterizedTest
    @MethodSource("supportedTargets")
    void theAnswerNamesTheOldAndTheNewTypeAndTheConversion(ArchDBRTypes target) throws Exception {
        String pv = archiveAsDouble("ChangeTypeForPVTest:answer:" + target);
        JSONObject answer = change(pv, target);
        assertEquals("ok", answer.get("status"));
        assertEquals(ArchDBRTypes.DBR_SCALAR_DOUBLE.toString(), answer.get("oldType"));
        assertEquals(target.toString(), answer.get("newType"));
        assertInstanceOf(String.class, answer.get("history"));
        assertTrue(((String) answer.get("history")).contains("converted"));
        assertNotNull(answer.get("pv"));
    }
}
