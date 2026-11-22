package org.epics.archiverappliance.mgmt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Proxy;
import java.util.stream.Stream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.engine.ArchiveEngine;
import org.epics.archiverappliance.engine.pv.PVMetrics;
import org.epics.archiverappliance.engine.test.FakeWriter;
import org.epics.archiverappliance.mgmt.bpl.reports.DroppedEventsTypeChangeReport;
import org.epics.archiverappliance.mgmt.policy.PolicyConfig.SamplingMethod;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * The report of the PVs with events dropped by a type change lists a PV that the engine paused for that reason. The soft
 * IOC is started with the default database, the PV is archived as a double, then the IOC is replaced by one that serves
 * the same name as an integer record; the engine pauses the PV and removes its channel. The shipped management report is
 * then read in this JVM with the real configuration; only the HTTP request and response are stand-ins. One case names the
 * PV over Channel Access and one over PVAccess, the protocol of the type information; the name has no prefix.
 */
@Tag("localEpics")
public class TypeChangeReportTest {
    private static final String TYPE_CHANGE_DB = "src/resources/test/UnitTestTypeChange.db";
    private final String pvPrefix = TypeChangeReportTest.class.getSimpleName().substring(0, 10);
    private SIOCSetup ioc;
    private ConfigServiceForTests config;
    private final FakeWriter writer = new FakeWriter();

    static Stream<Arguments> protocols() {
        return Stream.of(Arguments.of("Channel Access", false), Arguments.of("PVAccess", true));
    }

    @BeforeEach
    public void setUp() throws Exception {
        ioc = new SIOCSetup(pvPrefix);
        ioc.startSIOCWithDefaultDB();
        config = new ConfigServiceForTests(-1);
        Thread.sleep(3000);
    }

    @AfterEach
    public void tearDown() throws Exception {
        config.shutdownNow();
        ioc.stopSIOC();
    }

    private JSONArray report() throws Exception {
        StringWriter body = new StringWriter();
        PrintWriter out = new PrintWriter(body);
        HttpServletRequest request = (HttpServletRequest) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] {HttpServletRequest.class}, (proxy, method, args) ->
                        switch (method.getName()) {
                            case "getParameter" -> null;
                            default -> throw new UnsupportedOperationException(method.getName());
                        });
        HttpServletResponse response = (HttpServletResponse) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[] {HttpServletResponse.class}, (proxy, method, args) ->
                        switch (method.getName()) {
                            case "getWriter" -> out;
                            case "setContentType" -> null;
                            default -> throw new AssertionError("Unexpected servlet operation: " + method.getName());
                        });
        new DroppedEventsTypeChangeReport().execute(request, response, config);
        out.flush();
        return (JSONArray) new JSONParser().parse(body.toString());
    }

    private static JSONObject rowOf(JSONArray rows, String pvName) {
        for (Object row : rows) {
            if (pvName.equals(((JSONObject) row).get("pvName"))) return (JSONObject) row;
        }
        return null;
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("protocols")
    public void listsThePVThatTheEnginePausedForATypeChange(String protocol, boolean usePVAccess) throws Exception {
        // The management stores the name without its pva:// prefix and keeps the protocol in the type information.
        String pvName = pvPrefix + "--ArchUnitTest:sine";
        PVTypeInfo typeInfo = new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        typeInfo.setSamplingMethod(SamplingMethod.MONITOR);
        typeInfo.setSamplingPeriod(1.0F);
        typeInfo.setUsePVAccess(usePVAccess);
        config.updateTypeInfoForPV(pvName, typeInfo);
        // An archived PV is registered to its appliance; the report reads the PVs of the cluster from that registration.
        config.registerPVToAppliance(pvName, config.getMyApplianceInfo());
        ArchiveEngine.archivePV(pvName, 1.0F, SamplingMethod.MONITOR, writer, config,
                ArchDBRTypes.DBR_SCALAR_DOUBLE, null, usePVAccess, false);
        Thread.sleep(6000);
        PVMetrics metrics = ArchiveEngine.getMetricsforPV(pvName, config);
        assertNotNull(metrics, "the engine holds a channel for " + pvName);
        assertTrue(metrics.getEventCounts() > 0, "the double record delivers events before the change");
        assertNull(rowOf(report(), pvName), "the report does not list the PV before the change");

        ioc.stopSIOC();
        ioc = new SIOCSetup(pvPrefix);
        ioc.startSIOCWithDB(TYPE_CHANGE_DB);
        PVTypeInfo after = null;
        for (int i = 0; i < 60; i++) {
            Thread.sleep(1000);
            after = config.getTypeInfoForPV(pvName);
            if (after != null && after.isPaused()) break;
        }
        assertNotNull(after);
        assertTrue(after.isPaused(), "the engine pauses the PV after the first event of the other type");
        assertNull(config.getEngineContext().getChannelList().get(pvName), "the channel is gone after the pause");

        JSONObject row = rowOf(report(), pvName);
        assertNotNull(row, "the report lists the PV the engine paused for a type change (" + protocol + ")");
        assertEquals(ArchDBRTypes.DBR_SCALAR_DOUBLE.toString(), row.get("oldType"), row.toJSONString());
        assertEquals(ArchDBRTypes.DBR_SCALAR_INT.toString(), row.get("newType"), row.toJSONString());
        assertFalse(row.containsKey("eventsDropped"), "the count went with the channel: " + row.toJSONString());
    }
}
