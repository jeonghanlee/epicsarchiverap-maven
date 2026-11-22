package org.epics.archiverappliance.engine.V4;

import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.epics.archiverappliance.engine.model.ScannedArchiveChannel;
import org.epics.archiverappliance.engine.writer.WriterRunnable;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;
import edu.stanford.slac.archiverappliance.PlainPB.PlainPBPathNameUtility;
import edu.stanford.slac.archiverappliance.PlainPB.FileBackedPBEventStream;
import org.epics.archiverappliance.utils.nio.ArchPaths;
import org.epics.archiverappliance.engine.pv.PV;
import org.epics.archiverappliance.engine.pv.PVFactory;
import org.epics.archiverappliance.engine.pv.PVListener;
import org.epics.pva.data.PVAData;
import org.epics.pva.data.PVADouble;
import org.epics.pva.data.PVAInt;
import org.epics.pva.data.PVAString;
import org.epics.pva.data.PVAStringArray;
import org.epics.pva.data.PVAStructure;
import org.epics.pva.data.nt.PVAAlarm;
import org.epics.pva.data.nt.PVATimeStamp;
import org.epics.pva.server.PVAServer;
import org.epics.pva.server.ServerPV;
import edu.stanford.slac.archiverappliance.PB.data.PBScalarDouble;
import edu.stanford.slac.archiverappliance.PB.data.PBScalarEnum;
import org.epics.archiverappliance.utils.ui.MetaFields;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import java.nio.file.Path;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.function.BooleanSupplier;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Real PVA reception followed by the production metadata-to-configuration transfer. */
class PVAccessMetadataTest {
    @TempDir Path directory;
    private ScannedArchiveChannel scan;
    private PlainPBStoragePlugin scanStorage;
    private WriterRunnable scanWriter;
    private ConfigServiceForTests config;
    private PVAServer server;
    private PV pv;
    private String connectionHost;
    private DBRTimeEvent initialEvent;
    private ServerPV serverPV;
    private PVAStructure serverData;
    private final LinkedBlockingQueue<DBRTimeEvent> events = new LinkedBlockingQueue<>();

    @AfterEach
    void tearDown() throws Exception {
        if (scan != null) scan.stop();
        if (pv != null) pv.stop();
        if (config != null) config.shutdownNow();
        if (server != null) server.close();
    }

    @Test
    void numericMetadataReachesTheConfiguration() throws Exception {
        PVTypeInfo stored = receive(
                new PVAStructure("display", "display_t", new PVAString("units", "mm"),
                        new PVAInt("precision", 3), new PVADouble("limitLow", -20), new PVADouble("limitHigh", 80)),
                new PVAStructure("control", "control_t", new PVADouble("limitLow", -30),
                        new PVADouble("limitHigh", 90), new PVADouble("minStep", 0.125)),
                new PVAStructure("valueAlarm", "valueAlarm_t", new PVADouble("lowWarningLimit", -10),
                        new PVADouble("highWarningLimit", 60), new PVADouble("lowAlarmLimit", -15),
                        new PVADouble("highAlarmLimit", 70)));
        assertAll(
                () -> assertEquals("mm", stored.getUnits()),
                () -> assertEquals(3.0, stored.getPrecision()),
                () -> assertEquals(-20, stored.getLowerDisplayLimit()),
                () -> assertEquals(80, stored.getUpperDisplayLimit()),
                () -> assertEquals(-30, stored.getLowerCtrlLimit()),
                () -> assertEquals(90, stored.getUpperCtrlLimit()),
                () -> assertEquals(-10, stored.getLowerWarningLimit()),
                () -> assertEquals(60, stored.getUpperWarningLimit()),
                () -> assertEquals(-15, stored.getLowerAlarmLimit()),
                () -> assertEquals(70, stored.getUpperAlarmLimit()));
    }

    @Test
    void absentGroupsLeaveEveryLimitUnknown() throws Exception {
        PVTypeInfo stored = receive();
        assertAll(
                () -> assertTrue(Double.isNaN(stored.getLowerDisplayLimit())),
                () -> assertTrue(Double.isNaN(stored.getUpperDisplayLimit())),
                () -> assertTrue(Double.isNaN(stored.getLowerCtrlLimit())),
                () -> assertTrue(Double.isNaN(stored.getUpperCtrlLimit())),
                () -> assertTrue(Double.isNaN(stored.getLowerWarningLimit())),
                () -> assertTrue(Double.isNaN(stored.getUpperWarningLimit())),
                () -> assertTrue(Double.isNaN(stored.getLowerAlarmLimit())),
                () -> assertTrue(Double.isNaN(stored.getUpperAlarmLimit())));
    }

    @Test
    void absentMembersDoNotReplaceZeroOrNanWithDefaults() throws Exception {
        PVTypeInfo stored = receive(
                new PVAStructure("display", "display_t", new PVADouble("limitLow", 0)),
                new PVAStructure("control", "control_t", new PVADouble("limitHigh", Double.NaN)),
                new PVAStructure("valueAlarm", "valueAlarm_t", new PVAInt("lowWarningLimit", -5),
                        new PVAInt("highAlarmLimit", 0)));
        assertAll(
                () -> assertEquals(0, stored.getLowerDisplayLimit()),
                () -> assertTrue(Double.isNaN(stored.getUpperDisplayLimit())),
                () -> assertTrue(Double.isNaN(stored.getLowerCtrlLimit())),
                () -> assertTrue(Double.isNaN(stored.getUpperCtrlLimit())),
                () -> assertEquals(-5, stored.getLowerWarningLimit()),
                () -> assertTrue(Double.isNaN(stored.getUpperWarningLimit())),
                () -> assertTrue(Double.isNaN(stored.getLowerAlarmLimit())),
                () -> assertEquals(0, stored.getUpperAlarmLimit()));
    }

    @Test
    void hostIsAvailableAtConnectionAndStoredWithMetadata() throws Exception {
        PVTypeInfo stored = receive();
        assertNotNull(connectionHost, "host is available when the connection listener runs");
        assertFalse(connectionHost.isBlank());
        assertEquals(connectionHost, stored.getHostName());
    }

    @Test
    void precisionAndMappedFieldsReachInitialSampleAndLatestMetadata() throws Exception {
        receive(new PVAStructure("display", "display_t", new PVAInt("precision", 3),
                        new PVAString("description", "Metadata fixture")),
                new PVAStructure("control", "control_t", new PVADouble("minStep", 0.125)),
                new PVAStructure("valueAlarm", "valueAlarm_t", new PVADouble("hysteresis", 0.5)));
        assertAll(
                () -> assertEquals("3", pv.getLatestMetadata().get("PREC")),
                () -> assertEquals("3", initialEvent.getFields().get("PREC")),
                () -> assertEquals("Metadata fixture", initialEvent.getFields().get("DESC")),
                () -> assertEquals("0.5", initialEvent.getFields().get("HYST")),
                () -> assertEquals("0.125", initialEvent.getFields().get("control.minStep")));
    }

    @Test
    void enumChoicesReachMetadataAndInitialSample() throws Exception {
        receiveValue(new PVAStructure("value", "enum_t", new PVAInt("index", 1),
                new PVAStringArray("choices", "Passive", "1 second")));
        assertAll(
                () -> assertNotNull(pv.getTotalMetaInfo().getLabel()),
                () -> assertEquals("1 second", pv.getLatestMetadata().get("ENUM_1")),
                () -> assertEquals("1 second", initialEvent.getFields().get("ENUM_1")));
    }

    @Test
    void propertyOnlyUpdatesAreRetainedUntilNextTimestampedSample() throws Exception {
        receive(new PVAStructure("display", "display_t", new PVAInt("precision", 3),
                        new PVAString("description", "Initial description")),
                new PVAStructure("valueAlarm", "valueAlarm_t", new PVADouble("hysteresis", 0.5)));
        await(serverPV::isSubscribed);
        // A timestamped marker establishes that the subscription is delivering samples.
        Instant marker = Instant.now().plusSeconds(1);
        ((PVATimeStamp) serverData.get("timeStamp")).set(marker);
        serverPV.update(serverData);
        nextSample(marker);
        events.clear();
        PVAStructure display = serverData.get("display");
        ((PVAInt) display.get("precision")).set(0);
        ((PVAString) display.get("description")).set("Changed description");
        serverPV.update(serverData);
        await(() -> "Changed description".equals(pv.getLatestMetadata().get("DESC")));
        PVAStructure alarm = serverData.get("valueAlarm");
        ((PVADouble) alarm.get("hysteresis")).set(0.75);
        serverPV.update(serverData);
        await(() -> "0.75".equals(pv.getLatestMetadata().get("HYST")));
        assertTrue(events.isEmpty(), "property-only notifications must not create samples");
        var lastSave = pv.getClass().getDeclaredField("archiveFieldsSavedAtEpSec");
        lastSave.setAccessible(true);
        lastSave.setLong(pv, 0);
        pv.aboutToWriteBuffer(initialEvent);
        assertEquals("Initial description", initialEvent.getFields().get("DESC"),
                "a daily flush must not attach new properties to an older sample");
        Instant next = marker.plusSeconds(1);
        ((PVATimeStamp) serverData.get("timeStamp")).set(next);
        serverPV.update(serverData);
        DBRTimeEvent received = nextSample(next);
        PBScalarDouble decoded = new PBScalarDouble(received.getYearSecondTimestamp().getYear(), received.getRawForm());
        assertAll(
                () -> assertEquals("0", decoded.getFieldValue("PREC")),
                () -> assertEquals("Changed description", decoded.getFieldValue("DESC")),
                () -> assertEquals("0.75", decoded.getFieldValue("HYST")));
    }

    @Test
    void enumChangesReplaceShorterAndEmptyLists() throws Exception {
        receiveValue(new PVAStructure("value", "enum_t", new PVAInt("index", 0),
                new PVAStringArray("choices", "Passive", "1 second")));
        await(serverPV::isSubscribed);
        Instant marker = Instant.now().plusSeconds(1);
        ((PVATimeStamp) serverData.get("timeStamp")).set(marker);
        serverPV.update(serverData);
        nextSample(marker);
        PVAStructure value = serverData.get("value");
        PVAStringArray choices = value.get("choices");
        for (String[] labels : new String[][] { { "Renamed" }, {} }) {
            choices.set(labels);
            serverPV.update(serverData);
            await(() -> Integer.toString(labels.length).equals(pv.getLatestMetadata().get("ENUM_COUNT")));
            marker = marker.plusSeconds(1);
            ((PVATimeStamp) serverData.get("timeStamp")).set(marker);
            serverPV.update(serverData);
            DBRTimeEvent event = nextSample(marker);
            PBScalarEnum decoded = new PBScalarEnum(event.getYearSecondTimestamp().getYear(), event.getRawForm());
            assertEquals(Integer.toString(labels.length), decoded.getFieldValue("ENUM_COUNT"));
            HashMap<String, Object> response = new HashMap<>();
            decoded.getFields().forEach((key, field) -> MetaFields.addMetaFieldValue(response, key, field));
            initialEvent.getFields().forEach((key, field) -> MetaFields.addMetaFieldValue(response, key, field));
            Map<?, ?> metadata = (Map<?, ?>) response.get("meta");
            assertFalse(metadata.containsKey("ENUM_1"));
            if (labels.length == 0) assertFalse(metadata.containsKey("ENUM_0"));
            else assertEquals("Renamed", metadata.get("ENUM_0"));
        }
    }

    @Test
    void legacyPbPrecisionRemainsUnchanged() throws Exception {
        byte[] bytes = java.nio.file.Files.readAllBytes(
                java.nio.file.Path.of("src/resources/test/pva-metadata/legacy-precision.sample"));
        PBScalarDouble decoded = new PBScalarDouble((short) 2026,
                new org.epics.archiverappliance.ByteArray(bytes));
        assertEquals("0.25", decoded.getFieldValue("PREC"));
    }

    @Test
    void recordFieldSubscriptionsOverrideStaleMainMetadata() throws Exception {
        receive(new PVAStructure("display", "display_t", new PVAString("description", "Main description")),
                new PVAStructure("valueAlarm", "valueAlarm_t", new PVADouble("hysteresis", Double.NaN)));
        PVAStructure description = new PVAStructure("", "epics:nt/NTScalar:1.0",
                new PVAString("value", "Record description"));
        PVAStructure hysteresis = new PVAStructure("", "epics:nt/NTScalar:1.0", new PVADouble("value", 0.5));
        ServerPV descPV = server.createPV(pv.getName() + ".DESC", description);
        ServerPV hystPV = server.createPV(pv.getName() + ".HYST", hysteresis);
        ((org.epics.archiverappliance.engine.pv.EPICS_V4_PV) pv).enableRecordMetadata();
        await(() -> "Record description".equals(pv.getLatestMetadata().get("DESC")));
        await(() -> "0.5".equals(pv.getLatestMetadata().get("HYST")));
        ((PVAString) description.get("value")).set("Changed field");
        descPV.update(description);
        ((PVADouble) hysteresis.get("value")).set(0.75);
        hystPV.update(hysteresis);
        await(() -> "Changed field".equals(pv.getLatestMetadata().get("DESC")));
        await(() -> "0.75".equals(pv.getLatestMetadata().get("HYST")));
        Instant timestamp = Instant.now().plusSeconds(1);
        ((PVATimeStamp) serverData.get("timeStamp")).set(timestamp);
        serverPV.update(serverData);
        DBRTimeEvent sample = nextSample(timestamp);
        PBScalarDouble decoded = new PBScalarDouble(sample.getYearSecondTimestamp().getYear(), sample.getRawForm());
        assertEquals("Changed field", decoded.getFieldValue("DESC"));
        assertEquals("0.75", decoded.getFieldValue("HYST"));
        assertEquals("Changed field", pv.getLatestMetadata().get("DESC"));
        pv.stop();
        await(() -> !descPV.isSubscribed() && !hystPV.isSubscribed());
    }

    @Test
    void disconnectedRecordFieldsFallBackToMainMetadataAndRecover() throws Exception {
        receive(new PVAStructure("display", "display_t", new PVAString("description", "Main description")),
                new PVAStructure("valueAlarm", "valueAlarm_t", new PVADouble("hysteresis", 0.25)));
        PVAStructure description = new PVAStructure("", "epics:nt/NTScalar:1.0",
                new PVAString("value", "Record description"));
        PVAStructure hysteresis = new PVAStructure("", "epics:nt/NTScalar:1.0", new PVADouble("value", 0.5));
        ServerPV descPV = server.createPV(pv.getName() + ".DESC", description);
        ServerPV hystPV = server.createPV(pv.getName() + ".HYST", hysteresis);
        ((org.epics.archiverappliance.engine.pv.EPICS_V4_PV) pv).enableRecordMetadata();
        await(() -> "Record description".equals(pv.getLatestMetadata().get("DESC")));
        await(() -> "0.5".equals(pv.getLatestMetadata().get("HYST")));
        descPV.close();
        hystPV.close();
        await(() -> "Main description".equals(pv.getLatestMetadata().get("DESC")));
        await(() -> "0.25".equals(pv.getLatestMetadata().get("HYST")));
        assertTrue(pv.isConnected(), "the parent must remain connected during field loss");
        Instant timestamp = Instant.now().plusSeconds(1);
        assertMetadataSample(timestamp, "Main description", "0.25");

        ((PVAString) ((PVAStructure) serverData.get("display")).get("description")).set("Updated main");
        ((PVADouble) ((PVAStructure) serverData.get("valueAlarm")).get("hysteresis")).set(0.75);
        serverPV.update(serverData);
        await(() -> "Updated main".equals(pv.getLatestMetadata().get("DESC")));
        await(() -> "0.75".equals(pv.getLatestMetadata().get("HYST")));
        timestamp = timestamp.plusSeconds(1);
        assertMetadataSample(timestamp, "Updated main", "0.75");

        ((PVAString) description.get("value")).set("Reconnected field");
        ((PVADouble) hysteresis.get("value")).set(0.9);
        server.createPV(pv.getName() + ".DESC", description);
        server.createPV(pv.getName() + ".HYST", hysteresis);
        await(() -> "Reconnected field".equals(pv.getLatestMetadata().get("DESC")));
        await(() -> "0.9".equals(pv.getLatestMetadata().get("HYST")));
        assertMetadataSample(timestamp.plusSeconds(1), "Reconnected field", "0.9");
    }

    @ParameterizedTest
    @ValueSource(booleans = { false, true })
    void scanRetainsMetadataUntilAValueIsStored(boolean timer) throws Exception {
        receive(new PVAStructure("display", "display_t", new PVAString("description", "Initial"),
                        new PVAInt("precision", 3)),
                new PVAStructure("valueAlarm", "valueAlarm_t", new PVADouble("hysteresis", 0.25)));
        startScan();
        Instant baseline = Instant.now().plusSeconds(2);
        publishScanSample(baseline);
        await(() -> baseline.equals(scan.getLastArchivedValue().getEventTimeStamp()));
        var lastSave = pv.getClass().getDeclaredField("archiveFieldsSavedAtEpSec");
        lastSave.setAccessible(true);
        var scanPV = org.epics.archiverappliance.engine.model.ArchiveChannel.class.getDeclaredField("pv");
        scanPV.setAccessible(true);
        lastSave.setLong(scanPV.get(scan), 0);

        PVAStructure display = serverData.get("display");
        ((PVAString) display.get("description")).set("First change");
        ((PVAInt) display.get("precision")).set(5);
        ((PVADouble) ((PVAStructure) serverData.get("valueAlarm")).get("hysteresis")).set(0.75);
        serverPV.update(serverData);
        await(() -> "First change".equals(scan.getLatestMetadata().get("DESC")));
        publishScanSample(baseline.plusMillis(100));
        awaitScanReception(baseline.plusMillis(100));
        ((PVAString) display.get("description")).set("Latest change");
        serverPV.update(serverData);
        await(() -> "Latest change".equals(scan.getLatestMetadata().get("DESC")));
        publishScanSample(baseline.plusMillis(200));
        awaitScanReception(baseline.plusMillis(200));
        assertEquals(baseline, scan.getLastArchivedValue().getEventTimeStamp());
        Instant storedTime = timer ? baseline.plusMillis(200) : baseline.plusSeconds(2);
        if (timer) {
            Thread.sleep(1100);
            scan.run();
        } else {
            publishScanSample(storedTime);
        }
        await(() -> storedTime.equals(scan.getLastArchivedValue().getEventTimeStamp()));
        DBRTimeEvent stored = readScanSample(storedTime);
        assertEquals("Latest change", stored.getFieldValue("DESC"));
        assertEquals("5", stored.getFieldValue("PREC"));
        assertEquals("0.75", stored.getFieldValue("HYST"));
        assertEquals("Latest change", stored.getFieldValue("display.description"));
        publishScanSample(storedTime.plusSeconds(2));
        await(() -> storedTime.plusSeconds(2).equals(scan.getLastArchivedValue().getEventTimeStamp()));
        assertFalse(scan.getLastArchivedValue().getFields().containsKey("DESC"),
                "accepted metadata must not be repeated on every later sample");
    }

    @Test
    void scanRetainsAnEmptyEnumListAcrossSkippedSamples() throws Exception {
        receiveValue(new PVAStructure("value", "enum_t", new PVAInt("index", 0),
                new PVAStringArray("choices", "A", "B")));
        startScan();
        Instant baseline = Instant.now().plusSeconds(2);
        publishScanSample(baseline);
        await(() -> baseline.equals(scan.getLastArchivedValue().getEventTimeStamp()));
        PVAStringArray choices = ((PVAStructure) serverData.get("value")).get("choices");
        choices.set(new String[] { "Renamed" });
        serverPV.update(serverData);
        await(() -> "1".equals(scan.getLatestMetadata().get("ENUM_COUNT")));
        publishScanSample(baseline.plusMillis(100));
        awaitScanReception(baseline.plusMillis(100));
        choices.set(new String[0]);
        serverPV.update(serverData);
        await(() -> "0".equals(scan.getLatestMetadata().get("ENUM_COUNT")));
        publishScanSample(baseline.plusMillis(200));
        awaitScanReception(baseline.plusMillis(200));
        Instant storedTime = baseline.plusSeconds(2);
        publishScanSample(storedTime);
        await(() -> storedTime.equals(scan.getLastArchivedValue().getEventTimeStamp()));
        DBRTimeEvent stored = readScanSample(storedTime);
        assertEquals("0", stored.getFieldValue("ENUM_COUNT"));
        assertFalse(stored.getFields().containsKey("ENUM_0"));
        assertFalse(stored.getFields().containsKey("ENUM_1"));
    }

    private void startScan() throws Exception {
        scanStorage = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=scan-metadata&rootFolder=" + directory + "&partitionGranularity=PARTITION_YEAR",
                config);
        scan = new ScannedArchiveChannel(pv.getName(), scanStorage, 100, null, 1, config,
                pv.getArchDBRTypes(), null, 0, true);
        config.getEngineContext().getChannelList().put(pv.getName(), scan);
        scanWriter = new WriterRunnable(config);
        scanWriter.addChannel(scan);
        scan.start();
        await(() -> scan.getLastArchivedValue() != null);
    }

    private void publishScanSample(Instant timestamp) throws Exception {
        ((PVATimeStamp) serverData.get("timeStamp")).set(timestamp);
        serverPV.update(serverData);
    }

    private void awaitScanReception(Instant timestamp) throws Exception {
        var latest = org.epics.archiverappliance.engine.model.ArchiveChannel.class
                .getDeclaredField("latestDBRTimeEvent");
        latest.setAccessible(true);
        await(() -> {
            synchronized (scan) {
                try {
                    return timestamp.equals(((DBRTimeEvent) latest.get(scan)).getEventTimeStamp());
                } catch (IllegalAccessException ex) {
                    throw new IllegalStateException(ex);
                }
            }
        });
    }

    private DBRTimeEvent readScanSample(Instant timestamp) throws Exception {
        scanWriter.flushChannel(scan);
        Path file;
        try (ArchPaths paths = new ArchPaths()) {
            file = PlainPBPathNameUtility.getPathNameForTime(scanStorage, pv.getName(), timestamp,
                    paths, config.getPVNameToKeyConverter());
        }
        try (var stream = new FileBackedPBEventStream(pv.getName(), file, pv.getArchDBRTypes())) {
            for (var event : stream) {
                if (timestamp.equals(event.getEventTimeStamp())) return (DBRTimeEvent) event;
            }
        }
        throw new AssertionError("No stored scan sample for " + timestamp);
    }

    private void assertMetadataSample(Instant timestamp, String description, String hysteresis) throws Exception {
        ((PVATimeStamp) serverData.get("timeStamp")).set(timestamp);
        serverPV.update(serverData);
        DBRTimeEvent sample = nextSample(timestamp);
        PBScalarDouble decoded = new PBScalarDouble(sample.getYearSecondTimestamp().getYear(), sample.getRawForm());
        assertEquals(description, decoded.getFieldValue("DESC"));
        assertEquals(hysteresis, decoded.getFieldValue("HYST"));
    }

    private DBRTimeEvent nextSample(Instant timestamp) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (System.nanoTime() < deadline) {
            DBRTimeEvent event = events.poll(100, TimeUnit.MILLISECONDS);
            if (event != null && event.getEventTimeStamp().equals(timestamp)) return event;
        }
        throw new AssertionError("No sample for " + timestamp);
    }

    private static void await(BooleanSupplier condition) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (!condition.getAsBoolean() && System.nanoTime() < deadline) Thread.sleep(20);
        assertTrue(condition.getAsBoolean(), "timed out waiting for PVA update");
    }

    private PVTypeInfo receive(PVAData... metadata) throws Exception {
        return receiveValue(new PVADouble("value", 1.25), metadata);
    }

    private PVTypeInfo receiveValue(PVAData value, PVAData... metadata) throws Exception {
        config = new ConfigServiceForTests(-1);
        server = new PVAServer();
        String name = "PVAccessMetadataTest:" + UUID.randomUUID();
        List<PVAData> fields = new ArrayList<>(List.of(value,
                new PVATimeStamp(Instant.now()), new PVAAlarm()));
        fields.addAll(List.of(metadata));
        serverData = new PVAStructure("", "epics:nt/NTScalar:1.0", fields);
        serverPV = server.createPV(name, serverData);
        CompletableFuture<String> connectedHost = new CompletableFuture<>();
        CompletableFuture<DBRTimeEvent> firstValue = new CompletableFuture<>();
        pv = PVFactory.createPV(name, config, 0, true);
        pv.addListener(new PVListener() {
            public void pvConnectionRequestMade(PV source) {}
            public void pvConnected(PV source) { connectedHost.complete(source.getHostName()); }
            public void pvDisconnected(PV source) {}
            public void sampleDroppedTypeChange(PV source, ArchDBRTypes type) {}
            public void pvValueUpdate(PV source, DBRTimeEvent event) {
                events.add(event);
                firstValue.complete(event);
            }
        });
        pv.start();
        initialEvent = firstValue.get(15, TimeUnit.SECONDS);
        PVTypeInfo type = new PVTypeInfo(name, pv.getArchDBRTypes(), true, 1);
        type.absorbMetaInfo(pv.getTotalMetaInfo());
        config.updateTypeInfoForPV(name, type);
        PVTypeInfo stored = config.getTypeInfoForPV(name);
        connectionHost = connectedHost.get(15, TimeUnit.SECONDS);
        return stored;
    }
}
