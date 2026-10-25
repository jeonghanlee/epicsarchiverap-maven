package org.epics.archiverappliance.engine.test;

import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.engine.ArchiveEngine;
import org.epics.archiverappliance.engine.pv.PVMetrics;
import org.epics.archiverappliance.mgmt.policy.PolicyConfig.SamplingMethod;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/**
 * The engine pauses a PV, with the reason in its type information, when its record comes back under the same name with
 * another type: the soft IOC is started with the default database, the PV is archived as a double, then the IOC is
 * replaced by one that serves the same name as an integer record.
 */
@Tag("localEpics")
public class TypeChangePauseTest {
    private static final String TYPE_CHANGE_DB = "src/resources/test/UnitTestTypeChange.db";
    private final String pvPrefix = TypeChangePauseTest.class.getSimpleName().substring(0, 10);
    private final String pvName = pvPrefix + "--ArchUnitTest:sine";
    private SIOCSetup ioc;
    private ConfigServiceForTests testConfigService;
    private final FakeWriter writer = new FakeWriter();

    @BeforeEach
    public void setUp() throws Exception {
        ioc = new SIOCSetup(pvPrefix);
        ioc.startSIOCWithDefaultDB();
        testConfigService = new ConfigServiceForTests(-1);
        Thread.sleep(3000);
    }

    @AfterEach
    public void tearDown() throws Exception {
        testConfigService.shutdownNow();
        ioc.stopSIOC();
    }

    @Test
    public void pausesWithReasonWhenTheTypeChanges() throws Exception {
        PVTypeInfo typeInfo = new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        typeInfo.setSamplingMethod(SamplingMethod.MONITOR);
        typeInfo.setSamplingPeriod(1.0F);
        testConfigService.updateTypeInfoForPV(pvName, typeInfo);
        ArchiveEngine.archivePV(pvName, 1.0F, SamplingMethod.MONITOR, writer, testConfigService,
                ArchDBRTypes.DBR_SCALAR_DOUBLE, null, false, false);
        Thread.sleep(6000);
        PVMetrics metrics = ArchiveEngine.getMetricsforPV(pvName, testConfigService);
        Assertions.assertTrue(metrics.getEventCounts() > 0, "the double record delivers events before the change");
        Assertions.assertFalse(testConfigService.getTypeInfoForPV(pvName).isPaused(), "the PV is not paused before the change");

        ioc.stopSIOC();
        ioc = new SIOCSetup(pvPrefix);
        ioc.startSIOCWithDB(TYPE_CHANGE_DB);

        PVTypeInfo after = null;
        for (int i = 0; i < 60; i++) {
            Thread.sleep(1000);
            after = testConfigService.getTypeInfoForPV(pvName);
            if (after != null && after.isPaused()) {
                break;
            }
        }
        Assertions.assertNotNull(after);
        Assertions.assertTrue(after.isPaused(), "the engine pauses the PV after the first event of the other type");
        Assertions.assertTrue(after.getPauseReason().contains("DBR_SCALAR_DOUBLE") && after.getPauseReason().contains("DBR_SCALAR_INT"),
                "the reason names the old and the new type: " + after.getPauseReason());
        Assertions.assertNull(testConfigService.getEngineContext().getChannelList().get(pvName), "the channel is gone after the pause");
        Assertions.assertEquals(1, metrics.getInvalidTypeLostEventCount(), "only the first event of the other type was counted before the pause");
    }
}
