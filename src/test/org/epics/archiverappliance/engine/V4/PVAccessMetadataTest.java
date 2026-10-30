package org.epics.archiverappliance.engine.V4;

import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.epics.archiverappliance.engine.pv.PV;
import org.epics.archiverappliance.engine.pv.PVFactory;
import org.epics.archiverappliance.engine.pv.PVListener;
import org.epics.pva.data.PVAData;
import org.epics.pva.data.PVADouble;
import org.epics.pva.data.PVAInt;
import org.epics.pva.data.PVAString;
import org.epics.pva.data.PVAStructure;
import org.epics.pva.data.nt.PVAAlarm;
import org.epics.pva.data.nt.PVATimeStamp;
import org.epics.pva.server.PVAServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Real PVA reception followed by the production metadata-to-configuration transfer. */
class PVAccessMetadataTest {
    private ConfigServiceForTests config;
    private PVAServer server;
    private PV pv;
    private String connectionHost;

    @AfterEach
    void tearDown() {
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

    private PVTypeInfo receive(PVAData... metadata) throws Exception {
        config = new ConfigServiceForTests(-1);
        server = new PVAServer();
        String name = "PVAccessMetadataTest:" + UUID.randomUUID();
        List<PVAData> fields = new ArrayList<>(List.of(new PVADouble("value", 1.25),
                new PVATimeStamp(Instant.now()), new PVAAlarm()));
        fields.addAll(List.of(metadata));
        server.createPV(name, new PVAStructure("", "epics:nt/NTScalar:1.0", fields));
        CompletableFuture<String> connectedHost = new CompletableFuture<>();
        CompletableFuture<DBRTimeEvent> firstValue = new CompletableFuture<>();
        pv = PVFactory.createPV(name, config, 0, true);
        pv.addListener(new PVListener() {
            public void pvConnectionRequestMade(PV source) {}
            public void pvConnected(PV source) { connectedHost.complete(source.getHostName()); }
            public void pvDisconnected(PV source) {}
            public void sampleDroppedTypeChange(PV source, ArchDBRTypes type) {}
            public void pvValueUpdate(PV source, DBRTimeEvent event) { firstValue.complete(event); }
        });
        pv.start();
        firstValue.get(15, TimeUnit.SECONDS);
        PVTypeInfo type = new PVTypeInfo(name, pv.getArchDBRTypes(), true, 1);
        type.absorbMetaInfo(pv.getTotalMetaInfo());
        config.updateTypeInfoForPV(name, type);
        PVTypeInfo stored = config.getTypeInfoForPV(name);
        connectionHost = connectedHost.get(15, TimeUnit.SECONDS);
        return stored;
    }
}
