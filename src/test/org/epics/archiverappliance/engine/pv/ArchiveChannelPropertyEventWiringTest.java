package org.epics.archiverappliance.engine.pv;

import gov.aps.jca.dbr.DBR_CTRL_Double;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.engine.ArchiveEngine;
import org.epics.archiverappliance.engine.model.ArchiveChannel;
import org.epics.archiverappliance.engine.test.FakeWriter;
import org.epics.archiverappliance.mgmt.policy.PolicyConfig.SamplingMethod;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Archives a PV through the shipped engine with property events enabled and feeds the PV a real control
 * response. The channel never connects, so no IOC is needed; the wiring of the metadata storage is what runs.
 */
class ArchiveChannelPropertyEventWiringTest {
    private static final String PV_NAME = "ArchiveChannelPropertyEventWiringTest:value";
    private ConfigServiceForTests configService;

    @BeforeEach
    void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1);
    }

    @AfterEach
    void tearDown() {
        if (configService != null) configService.shutdownNow();
    }

    @Test
    void aPropertyEventOnlyChannelHasStorageForTheFirstControlResponse() throws Exception {
        ArchiveEngine.archivePV(PV_NAME, 1, SamplingMethod.MONITOR,
                new FakeWriter(), configService, ArchDBRTypes.DBR_SCALAR_DOUBLE, null,
                new String[] {"HOPR"}, false, true);
        ArchiveChannel channel = configService.getEngineContext().getChannelList().get(PV_NAME);
        assertNotNull(channel, "the engine created the channel");
        Field field = ArchiveChannel.class.getDeclaredField("pv");
        field.setAccessible(true);
        EPICS_V3_PV pv = (EPICS_V3_PV) field.get(channel);

        DBR_CTRL_Double response = new DBR_CTRL_Double(1);
        response.setUnits("mm");
        response.setUpperDispLimit(91);
        response.setLowerDispLimit(-20);
        response.setUpperWarningLimit(60);
        response.setLowerWarningLimit(-10);
        response.setUpperAlarmLimit(70);
        response.setLowerAlarmLimit(-15);
        response.setUpperCtrlLimit(34);
        response.setLowerCtrlLimit(-12);
        response.setPrecision((short) 4);
        pv.processDBEProperties(response);
        assertEquals("91.0", pv.getLatestMetadata().get("HOPR"));
        assertEquals("4", pv.getLatestMetadata().get("PREC"));
    }
}
