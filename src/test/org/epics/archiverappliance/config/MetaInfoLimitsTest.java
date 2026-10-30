package org.epics.archiverappliance.config;

import gov.aps.jca.dbr.DBR_CTRL_Double;
import org.apache.logging.log4j.Level;
import org.epics.archiverappliance.common.CapturedLog;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Exercises connection metadata updates through the shipped parser and configuration service. */
class MetaInfoLimitsTest {
    private static final String PV = "MetaInfoLimitsTest:temperature";
    private static final String CONFIG_LOGGER = "config." + MetaInfo.class.getName();
    private ConfigServiceForTests configService;
    private MetaInfo metaInfo;
    private DBR_CTRL_Double connection;

    enum Limit {
        LOWER_DISPLAY("lowerDisplayLimit", -100, DBR_CTRL_Double::setLowerDispLimit,
                PVTypeInfo::getLowerDisplayLimit, PVTypeInfo::setLowerDisplayLimit),
        UPPER_DISPLAY("upperDisplayLimit", 100, DBR_CTRL_Double::setUpperDispLimit,
                PVTypeInfo::getUpperDisplayLimit, PVTypeInfo::setUpperDisplayLimit),
        LOWER_WARNING("lowerWarningLimit", -50, DBR_CTRL_Double::setLowerWarningLimit,
                PVTypeInfo::getLowerWarningLimit, PVTypeInfo::setLowerWarningLimit),
        UPPER_WARNING("upperWarningLimit", 50, DBR_CTRL_Double::setUpperWarningLimit,
                PVTypeInfo::getUpperWarningLimit, PVTypeInfo::setUpperWarningLimit),
        LOWER_ALARM("lowerAlarmLimit", -75, DBR_CTRL_Double::setLowerAlarmLimit,
                PVTypeInfo::getLowerAlarmLimit, PVTypeInfo::setLowerAlarmLimit),
        UPPER_ALARM("upperAlarmLimit", 75, DBR_CTRL_Double::setUpperAlarmLimit,
                PVTypeInfo::getUpperAlarmLimit, PVTypeInfo::setUpperAlarmLimit),
        LOWER_CONTROL("lowerCtrlLimit", -110, DBR_CTRL_Double::setLowerCtrlLimit,
                PVTypeInfo::getLowerCtrlLimit, PVTypeInfo::setLowerCtrlLimit),
        UPPER_CONTROL("upperCtrlLimit", 110, DBR_CTRL_Double::setUpperCtrlLimit,
                PVTypeInfo::getUpperCtrlLimit, PVTypeInfo::setUpperCtrlLimit);

        final String field;
        final double initial;
        final BiConsumer<DBR_CTRL_Double, Double> setConnection;
        final Function<PVTypeInfo, Double> getStored;
        final BiConsumer<PVTypeInfo, Double> setStored;

        Limit(String field, double initial, BiConsumer<DBR_CTRL_Double, Double> setConnection,
                Function<PVTypeInfo, Double> getStored, BiConsumer<PVTypeInfo, Double> setStored) {
            this.field = field;
            this.initial = initial;
            this.setConnection = setConnection;
            this.getStored = getStored;
            this.setStored = setStored;
        }
    }

    @BeforeEach
    void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1);
        metaInfo = new MetaInfo();
        metaInfo.setHostName("localhost");
        connection = new DBR_CTRL_Double(1);
        connection.setUnits("C");
        connection.setPrecision((short) 2);
        PVTypeInfo stored = new PVTypeInfo(PV, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        stored.setUnits("C");
        stored.setPrecision(2.0);
        stored.setHostName("localhost");
        for (Limit limit : Limit.values()) {
            limit.setConnection.accept(connection, limit.initial);
            limit.setStored.accept(stored, limit.initial);
        }
        configService.updateTypeInfoForPV(PV, stored);
    }

    @AfterEach
    void tearDown() {
        if (configService != null) configService.shutdownNow();
    }

    @ParameterizedTest
    @EnumSource(Limit.class)
    void aSingleChangedLimitIsSavedWhenTheUnitIsUnchanged(Limit changed) throws Exception {
        changed.setConnection.accept(connection, changed.initial + 1);
        try (CapturedLog config = new CapturedLog(CONFIG_LOGGER, Level.INFO);
                CapturedLog writes = new CapturedLog(DefaultConfigService.class.getName(), Level.DEBUG)) {
            writes.settle();
            long initialWrites = writeCount(writes);
            metaInfo.applyBasicInfo(PV, connection, configService);
            config.settle();
            PVTypeInfo stored = configService.getTypeInfoForPV(PV);
            for (Limit limit : Limit.values()) {
                assertEquals(limit.initial + (limit == changed ? 1 : 0), limit.getStored.apply(stored), limit.field);
            }
            assertEquals("C", stored.getUnits());
            assertEquals(2.0, stored.getPrecision());
            List<CapturedLog.Entry> lines = config.at(Level.INFO);
            assertEquals(1, lines.size());
            assertTrue(lines.getFirst().message().contains(PV));
            assertTrue(lines.getFirst().message().contains(changed.field));
            assertEquals(initialWrites + 1, writeCount(writes));

            metaInfo.applyBasicInfo(PV, connection, configService);
            config.settle();
            assertEquals(1, config.at(Level.INFO).size(), "unchanged metadata produces no configuration log");
            assertEquals(initialWrites + 1, writeCount(writes), "unchanged metadata is not saved again");
        }
    }

    @ParameterizedTest
    @ValueSource(doubles = {0.0, -1.0})
    void zeroAndNegativeLimitsAreSavedAsNumbers(double value) {
        for (Limit limit : Limit.values()) limit.setConnection.accept(connection, value);
        metaInfo.applyBasicInfo(PV, connection, configService);
        for (Limit limit : Limit.values()) {
            assertEquals(value, limit.getStored.apply(configService.getTypeInfoForPV(PV)), limit.field);
        }
    }

    @Test
    void identicalInitialMetadataDoesNotWriteOrLog() throws Exception {
        try (CapturedLog config = new CapturedLog(CONFIG_LOGGER, Level.INFO);
                CapturedLog writes = new CapturedLog(DefaultConfigService.class.getName(), Level.DEBUG)) {
            writes.settle();
            long initialWrites = writeCount(writes);
            metaInfo.applyBasicInfo(PV, connection, configService);
            config.settle();
            assertEquals(0, config.at(Level.INFO).size());
            assertEquals(initialWrites, writeCount(writes));
        }
    }

    @Test
    void limitsTransitionToNanAndBackWithoutRepeatedUpdates() throws Exception {
        for (Limit limit : Limit.values()) limit.setConnection.accept(connection, Double.NaN);
        try (CapturedLog config = new CapturedLog(CONFIG_LOGGER, Level.INFO);
                CapturedLog writes = new CapturedLog(DefaultConfigService.class.getName(), Level.DEBUG)) {
            writes.settle();
            long initialWrites = writeCount(writes);
            metaInfo.applyBasicInfo(PV, connection, configService);
            config.settle();
            for (Limit limit : Limit.values()) {
                assertTrue(Double.isNaN(limit.getStored.apply(configService.getTypeInfoForPV(PV))), limit.field);
                assertTrue(config.at(Level.INFO).getFirst().message().contains(limit.field));
            }
            assertEquals(1, config.at(Level.INFO).size());
            assertEquals(initialWrites + 1, writeCount(writes));
            metaInfo.applyBasicInfo(PV, connection, configService);
            config.settle();
            assertEquals(1, config.at(Level.INFO).size());
            assertEquals(initialWrites + 1, writeCount(writes));

            for (Limit limit : Limit.values()) limit.setConnection.accept(connection, limit.initial);
            metaInfo.applyBasicInfo(PV, connection, configService);
            config.settle();
            for (Limit limit : Limit.values()) {
                assertEquals(limit.initial, limit.getStored.apply(configService.getTypeInfoForPV(PV)), limit.field);
                assertTrue(config.at(Level.INFO).getLast().message().contains(limit.field));
            }
            assertEquals(2, config.at(Level.INFO).size());
            assertEquals(initialWrites + 2, writeCount(writes));
            metaInfo.applyBasicInfo(PV, connection, configService);
            config.settle();
            assertEquals(2, config.at(Level.INFO).size());
            assertEquals(initialWrites + 2, writeCount(writes));
        }
    }

    @Test
    void unitsAndPrecisionStillUpdateTogetherWithLimits() throws Exception {
        connection.setUnits("K");
        connection.setPrecision((short) 3);
        connection.setUpperDispLimit(101.0);
        try (CapturedLog config = new CapturedLog(CONFIG_LOGGER, Level.INFO);
                CapturedLog writes = new CapturedLog(DefaultConfigService.class.getName(), Level.DEBUG)) {
            writes.settle();
            long initialWrites = writeCount(writes);
            metaInfo.applyBasicInfo(PV, connection, configService);
            config.settle();
            PVTypeInfo stored = configService.getTypeInfoForPV(PV);
            assertEquals("K", stored.getUnits());
            assertEquals(3.0, stored.getPrecision());
            assertEquals(101.0, stored.getUpperDisplayLimit());
            assertEquals(1, config.at(Level.INFO).size());
            String message = config.at(Level.INFO).getFirst().message();
            for (String field : List.of(PV, "units", "precision", "upperDisplayLimit")) {
                assertTrue(message.contains(field), message);
            }
            assertEquals(initialWrites + 1, writeCount(writes));
        }
    }

    private static long writeCount(CapturedLog log) {
        return log.entries().stream().filter(entry -> entry.message().equals("Updating typeinfo for " + PV)).count();
    }
}
