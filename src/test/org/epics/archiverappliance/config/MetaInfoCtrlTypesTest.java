package org.epics.archiverappliance.config;

import gov.aps.jca.dbr.CTRL;
import gov.aps.jca.dbr.DBR;
import gov.aps.jca.dbr.DBR_CTRL_Byte;
import gov.aps.jca.dbr.DBR_CTRL_Double;
import gov.aps.jca.dbr.DBR_CTRL_Float;
import gov.aps.jca.dbr.DBR_CTRL_Int;
import gov.aps.jca.dbr.DBR_CTRL_Short;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Runs the shipped metadata parser and configuration update with valid Channel Access responses
 * of every numeric control type, and with precision-only and host-only changes.
 */
class MetaInfoCtrlTypesTest {
    private static final String PV = "MetaInfoCtrlTypesTest:value";
    private ConfigServiceForTests configService;
    private MetaInfo metaInfo;

    enum CtrlType {
        SHORT(DBR_CTRL_Short::new),
        INTEGER(DBR_CTRL_Int::new),
        BYTE(DBR_CTRL_Byte::new),
        FLOAT(DBR_CTRL_Float::new),
        DOUBLE(DBR_CTRL_Double::new);

        final Supplier<DBR> factory;

        CtrlType(Supplier<DBR> factory) {
            this.factory = factory;
        }
    }

    @BeforeEach
    void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1);
        metaInfo = new MetaInfo();
        metaInfo.setHostName("ioc-a");
        PVTypeInfo stored = new PVTypeInfo(PV, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        stored.setUnits("C");
        stored.setPrecision(2.0);
        stored.setHostName("ioc-a");
        configService.updateTypeInfoForPV(PV, stored);
    }

    @AfterEach
    void tearDown() {
        if (configService != null) configService.shutdownNow();
    }

    private static DBR connection(CtrlType type, short precision, int lowerCtrl, int upperCtrl) {
        DBR dbr = type.factory.get();
        CTRL ctrl = (CTRL) dbr;
        ctrl.setUnits("C");
        ctrl.setLowerDispLimit(-100);
        ctrl.setUpperDispLimit(100);
        ctrl.setLowerWarningLimit(-50);
        ctrl.setUpperWarningLimit(50);
        ctrl.setLowerAlarmLimit(-75);
        ctrl.setUpperAlarmLimit(75);
        ctrl.setLowerCtrlLimit(lowerCtrl);
        ctrl.setUpperCtrlLimit(upperCtrl);
        if (dbr instanceof DBR_CTRL_Double d) d.setPrecision(precision);
        if (dbr instanceof DBR_CTRL_Float f) f.setPrecision(precision);
        return dbr;
    }

    @ParameterizedTest
    @EnumSource(CtrlType.class)
    void controlLimitsOfEveryNumericControlTypeReachStoredConfiguration(CtrlType type) {
        metaInfo.applyBasicInfo(PV, connection(type, (short) 2, -12, 34), configService);
        PVTypeInfo stored = configService.getTypeInfoForPV(PV);
        assertEquals(-12.0, stored.getLowerCtrlLimit(), type + " lower control limit");
        assertEquals(34.0, stored.getUpperCtrlLimit(), type + " upper control limit");
    }

    @ParameterizedTest
    @EnumSource(CtrlType.class)
    void zeroControlLimitsOfEveryNumericControlTypeAreStoredAsZero(CtrlType type) {
        metaInfo.applyBasicInfo(PV, connection(type, (short) 2, -12, 34), configService);
        metaInfo.applyBasicInfo(PV, connection(type, (short) 2, 0, 0), configService);
        PVTypeInfo stored = configService.getTypeInfoForPV(PV);
        assertEquals(0.0, stored.getLowerCtrlLimit(), type + " lower control limit");
        assertEquals(0.0, stored.getUpperCtrlLimit(), type + " upper control limit");
    }

    @Test
    void precisionChangeWithUnchangedUnitsIsStored() {
        metaInfo.applyBasicInfo(PV, connection(CtrlType.DOUBLE, (short) 5, 0, 0), configService);
        assertEquals("C", configService.getTypeInfoForPV(PV).getUnits());
        assertEquals(5.0, configService.getTypeInfoForPV(PV).getPrecision());
    }

    @Test
    void changedNonEmptyHostReplacesStoredHost() {
        metaInfo.setHostName("ioc-b");
        metaInfo.applyBasicInfo(PV, connection(CtrlType.DOUBLE, (short) 2, 0, 0), configService);
        assertEquals("ioc-b", configService.getTypeInfoForPV(PV).getHostName());
    }

    @Test
    void absentHostDoesNotEraseStoredHost() {
        metaInfo.setHostName(null);
        metaInfo.applyBasicInfo(PV, connection(CtrlType.DOUBLE, (short) 2, 0, 0), configService);
        assertEquals("ioc-a", configService.getTypeInfoForPV(PV).getHostName());
    }

    @Test
    void emptyHostDoesNotEraseStoredHost() {
        metaInfo.setHostName("");
        metaInfo.applyBasicInfo(PV, connection(CtrlType.DOUBLE, (short) 2, 0, 0), configService);
        assertEquals("ioc-a", configService.getTypeInfoForPV(PV).getHostName());
    }

    @ParameterizedTest
    @EnumSource(value = CtrlType.class, names = {"SHORT", "INTEGER", "BYTE"})
    void precisionOfIntegerTypesStaysZeroWhenStoredPrecisionIsZero(CtrlType type) {
        PVTypeInfo stored = configService.getTypeInfoForPV(PV);
        stored.setPrecision(0.0);
        configService.updateTypeInfoForPV(PV, stored);
        metaInfo.applyBasicInfo(PV, connection(type, (short) 0, 0, 0), configService);
        assertEquals(0.0, configService.getTypeInfoForPV(PV).getPrecision());
    }
}
