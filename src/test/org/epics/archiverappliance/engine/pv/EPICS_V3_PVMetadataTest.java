package org.epics.archiverappliance.engine.pv;

import gov.aps.jca.dbr.CTRL;
import gov.aps.jca.dbr.DBR;
import gov.aps.jca.dbr.DBR_CTRL_Byte;
import gov.aps.jca.dbr.DBR_CTRL_Double;
import gov.aps.jca.dbr.DBR_CTRL_Float;
import gov.aps.jca.dbr.DBR_CTRL_Int;
import gov.aps.jca.dbr.DBR_CTRL_Short;
import gov.aps.jca.dbr.DBR_LABELS_Enum;
import gov.aps.jca.dbr.DBR_TIME_Double;
import gov.aps.jca.dbr.Severity;
import gov.aps.jca.dbr.Status;
import gov.aps.jca.dbr.TimeStamp;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Runs the Channel Access property-event handler and the metadata attachment of the shipped PV class. */
class EPICS_V3_PVMetadataTest {
    private static final String PV_NAME = "EPICS_V3_PVMetadataTest:value";
    private ConfigServiceForTests configService;
    private EPICS_V3_PV pv;

    enum CtrlType {
        SHORT(DBR_CTRL_Short::new, false),
        INTEGER(DBR_CTRL_Int::new, false),
        BYTE(DBR_CTRL_Byte::new, false),
        FLOAT(DBR_CTRL_Float::new, true),
        DOUBLE(DBR_CTRL_Double::new, true);

        final Supplier<DBR> factory;
        final boolean hasPrecision;

        CtrlType(Supplier<DBR> factory, boolean hasPrecision) {
            this.factory = factory;
            this.hasPrecision = hasPrecision;
        }
    }

    @BeforeEach
    void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1);
        pv = new EPICS_V3_PV(PV_NAME, configService, false, ArchDBRTypes.DBR_SCALAR_DOUBLE, 0, true);
        pv.markPVHasMetafields(true);
        pv.setDBEroperties();
    }

    @AfterEach
    void tearDown() {
        if (configService != null) configService.shutdownNow();
    }

    private static DBR control(CtrlType type) {
        DBR dbr = type.factory.get();
        CTRL ctrl = (CTRL) dbr;
        ctrl.setUnits("mm");
        ctrl.setLowerDispLimit(-20);
        ctrl.setUpperDispLimit(80);
        ctrl.setLowerWarningLimit(-10);
        ctrl.setUpperWarningLimit(60);
        ctrl.setLowerAlarmLimit(-15);
        ctrl.setUpperAlarmLimit(70);
        ctrl.setLowerCtrlLimit(-12);
        ctrl.setUpperCtrlLimit(34);
        if (dbr instanceof DBR_CTRL_Double d) d.setPrecision((short) 3);
        if (dbr instanceof DBR_CTRL_Float f) f.setPrecision((short) 3);
        return dbr;
    }

    /** A sample built by the same JCA conversion the PV uses for a monitor update. */
    private DBRTimeEvent sample(long epochSeconds) {
        try {
            DBR_TIME_Double dbr = new DBR_TIME_Double(new double[] {1.0});
            dbr.setTimeStamp(new TimeStamp(epochSeconds));
            dbr.setSeverity(Severity.NO_ALARM);
            dbr.setStatus(Status.NO_ALARM);
            return configService.getArchiverTypeSystem()
                    .getJCADBRConstructor(ArchDBRTypes.DBR_SCALAR_DOUBLE)
                    .newInstance(dbr);
        } catch (ReflectiveOperationException ex) {
            throw new AssertionError(ex);
        }
    }

    private static Map<String, String> fieldsOf(DBRTimeEvent sample) {
        Map<String, String> fields = sample.getFields();
        return fields == null ? new HashMap<>() : fields;
    }

    @ParameterizedTest
    @EnumSource(CtrlType.class)
    void propertyEventOfEveryNumericControlTypeUpdatesTheRecordFields(CtrlType type) {
        pv.processDBEProperties(control(type));
        Map<String, String> latest = pv.getLatestMetadata();
        assertEquals("mm", latest.get("EGU"), type.name());
        assertEquals("80", latest.get("HOPR").replaceAll("\\.0$", ""), type.name());
        assertEquals("-20", latest.get("LOPR").replaceAll("\\.0$", ""), type.name());
        assertEquals("34", latest.get("DRVH").replaceAll("\\.0$", ""), type.name());
        assertEquals("-12", latest.get("DRVL").replaceAll("\\.0$", ""), type.name());
        if (type.hasPrecision) assertEquals("3", latest.get("PREC"), type.name());
    }

    private static DBR labels(String... labels) {
        DBR_LABELS_Enum dbr = new DBR_LABELS_Enum(1);
        dbr.setLabels(labels);
        return dbr;
    }

    @Test
    void enumLabelsAreStoredAsIndexedKeysWithACount() {
        pv.processDBEProperties(labels("Passive", "Event", "I/O Intr"));
        Map<String, String> latest = pv.getLatestMetadata();
        assertEquals("Passive", latest.get("ENUM_0"));
        assertEquals("Event", latest.get("ENUM_1"));
        assertEquals("I/O Intr", latest.get("ENUM_2"));
        assertEquals("3", latest.get("ENUM_COUNT"));
        assertFalse(latest.containsKey("LABELS"), "no comma-joined LABELS key");
    }

    @Test
    void aShorterChoiceListRemovesTheLabelsBeyondTheNewCount() {
        pv.getTotalMetaInfo().setLabel(new String[] {"Passive", "Event", "I/O Intr"});
        pv.processDBEProperties(labels("Passive", "Event", "I/O Intr"));
        pv.processDBEProperties(labels("Passive"));
        Map<String, String> latest = pv.getLatestMetadata();
        assertEquals("Passive", latest.get("ENUM_0"));
        assertNull(latest.get("ENUM_1"));
        assertNull(latest.get("ENUM_2"));
        assertEquals("1", latest.get("ENUM_COUNT"));
    }

    @Test
    void anEmptyChoiceListIsStoredWithCountZero() {
        pv.getTotalMetaInfo().setLabel(new String[] {"Passive"});
        pv.processDBEProperties(labels("Passive"));
        pv.processDBEProperties(labels());
        Map<String, String> latest = pv.getLatestMetadata();
        assertNull(latest.get("ENUM_0"));
        assertEquals("0", latest.get("ENUM_COUNT"));
    }

    @Test
    void aChangeIsNotStoredWithTheLastSampleOfAnEarlierBatch() {
        DBRTimeEvent earlier = sample(1_000);
        pv.updataMetaFieldValue(PV_NAME + ".HIHI", "10");
        pv.aboutToWriteBuffer(earlier);
        assertTrue(fieldsOf(earlier).isEmpty(), "the writer hook must not attach a later change: " + fieldsOf(earlier));
    }

    @Test
    void aChangeIsStoredWithTheNextSampleAndStopsRepeatingOnceAccepted() {
        pv.updataMetaFieldValue(PV_NAME + ".HIHI", "10");
        DBRTimeEvent first = sample(2_000);
        pv.attachPendingMetadata(first);
        assertEquals("10", fieldsOf(first).get("HIHI"));
        DBRTimeEvent notAcceptedYet = sample(2_001);
        pv.attachPendingMetadata(notAcceptedYet);
        assertEquals("10", fieldsOf(notAcceptedYet).get("HIHI"), "still pending until a sample is accepted");
        pv.sampleWrittenIntoStores(first);
        DBRTimeEvent later = sample(2_002);
        pv.attachPendingMetadata(later);
        assertFalse(fieldsOf(later).containsKey("HIHI"), "an accepted change is not repeated");
    }

    @Test
    void aNewerValueStaysPendingWhenAnOlderSampleIsAccepted() {
        pv.updataMetaFieldValue(PV_NAME + ".HIHI", "10");
        DBRTimeEvent older = sample(3_000);
        pv.attachPendingMetadata(older);
        pv.updataMetaFieldValue(PV_NAME + ".HIHI", "20");
        pv.sampleWrittenIntoStores(older);
        DBRTimeEvent next = sample(3_001);
        pv.attachPendingMetadata(next);
        assertEquals("20", fieldsOf(next).get("HIHI"));
    }

    @Test
    void theDailySnapshotIsAttachedOnceAndRepeatsUntilAccepted() {
        pv.updataMetaFieldValue(PV_NAME + ".LOLO", "-5");
        DBRTimeEvent first = sample(4_000);
        pv.attachPendingMetadata(first);
        assertEquals("-5", fieldsOf(first).get("LOLO"));
        DBRTimeEvent second = sample(4_001);
        pv.attachPendingMetadata(second);
        assertEquals("-5", fieldsOf(second).get("LOLO"), "snapshot stays pending until accepted");
        pv.sampleWrittenIntoStores(second);
        DBRTimeEvent third = sample(4_002);
        pv.attachPendingMetadata(third);
        assertTrue(fieldsOf(third).isEmpty(), "no second snapshot within a day: " + fieldsOf(third));
    }

    @Test
    void theDailySnapshotCarriesTheConnectionEnumLabelsWithoutPropertyEvents() {
        pv.getTotalMetaInfo().setLabel(new String[] {"Top-up", "Decay"});
        pv.updataMetaFieldValue(PV_NAME + ".HIHI", "10");
        DBRTimeEvent first = sample(5_000);
        pv.attachPendingMetadata(first);
        Map<String, String> fields = fieldsOf(first);
        assertEquals("Top-up", fields.get("ENUM_0"));
        assertEquals("Decay", fields.get("ENUM_1"));
        assertEquals("2", fields.get("ENUM_COUNT"));
        assertFalse(fields.containsKey("LABELS"));
    }

    @Test
    void aPendingChangeOfAnIndexRemovedByAShorterListIsNotStored() {
        pv.processDBEProperties(labels("A", "B", "C"));
        DBRTimeEvent first = sample(6_000);
        pv.attachPendingMetadata(first);
        pv.sampleWrittenIntoStores(first);
        pv.processDBEProperties(labels("A", "X", "C"));
        pv.processDBEProperties(labels("A"));
        DBRTimeEvent next = sample(6_001);
        pv.attachPendingMetadata(next);
        Map<String, String> fields = fieldsOf(next);
        assertFalse(fields.containsKey("ENUM_1"), "a removed index must not be stored: " + fields);
        assertFalse(fields.containsKey("ENUM_2"), "a removed index must not be stored: " + fields);
        assertEquals("1", fields.get("ENUM_COUNT"));
    }

    @Test
    void aControlResponseWithoutUnitsIsStoredWithEmptyUnits() {
        DBR_CTRL_Double response = (DBR_CTRL_Double) control(CtrlType.DOUBLE);
        response.setUnits(null);
        pv.processDBEProperties(response);
        assertEquals("", pv.getLatestMetadata().get("EGU"));
        assertEquals("80", pv.getLatestMetadata().get("HOPR").replaceAll("\\.0$", ""));
    }

    @Test
    void aLabelResponseWithoutALabelArrayLeavesTheMetadataUnchanged() {
        pv.getTotalMetaInfo().setLabel(new String[] {"A", "B"});
        pv.processDBEProperties(labels("A", "B"));
        Map<String, String> before = new TreeMap<>(pv.getLatestMetadata());
        pv.processDBEProperties(new DBR_LABELS_Enum(1));
        assertEquals(before, new TreeMap<>(pv.getLatestMetadata()));
    }

    @Test
    void theLabelKeysAndTheCountAgreeInEveryConcurrentRead() throws Exception {
        pv.getTotalMetaInfo().setLabel(new String[] {"L0"});
        AtomicBoolean stop = new AtomicBoolean();
        AtomicLong reads = new AtomicLong();
        AtomicLong inconsistent = new AtomicLong();
        Thread writer = new Thread(() -> {
            try {
                for (int i = 0; i < 20_000; i++) {
                    String[] list = new String[1 + (i % 5)];
                    for (int k = 0; k < list.length; k++) list[k] = "L" + k;
                    pv.processDBEProperties(labels(list));
                }
            } finally {
                stop.set(true);
            }
        });
        Thread reader = new Thread(() -> {
            while (!stop.get()) {
                Map<String, String> latest = pv.getLatestMetadata();
                String count = latest.get("ENUM_COUNT");
                if (count == null) continue;
                reads.incrementAndGet();
                long keys = latest.keySet().stream()
                        .filter(key -> key.startsWith("ENUM_") && !key.equals("ENUM_COUNT")).count();
                if (keys != Integer.parseInt(count)) inconsistent.incrementAndGet();
            }
        });
        writer.start();
        reader.start();
        writer.join();
        reader.join();
        assertTrue(reads.get() > 0, "the reader saw labels");
        assertEquals(0, inconsistent.get(), "reads whose label keys differ from the count");
    }
}
