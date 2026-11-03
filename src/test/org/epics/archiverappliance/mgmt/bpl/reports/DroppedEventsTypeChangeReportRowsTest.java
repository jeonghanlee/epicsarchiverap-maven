package org.epics.archiverappliance.mgmt.bpl.reports;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.List;
import java.util.stream.Collectors;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * The rows that the management report adds for the PVs the engine paused for a type change, read from the type
 * information of a real configuration service: which PVs are listed, in which order, without the PVs the engines
 * already report, and under the limit.
 */
public class DroppedEventsTypeChangeReportRowsTest {
    private static final String PREFIX = "TypeChangeRows:";
    private ConfigServiceForTests config;

    @BeforeEach
    public void setUp() throws Exception {
        config = new ConfigServiceForTests(-1);
        archive("c", true, "type changed from DBR_SCALAR_DOUBLE to DBR_WAVEFORM_DOUBLE");
        archive("a", true, "type changed from DBR_SCALAR_DOUBLE to DBR_SCALAR_INT");
        archive("b", true, "type changed from DBR_SCALAR_INT to DBR_SCALAR_STRING");
        archive("operator", true, "");
        archive("other", true, "No server answered in 3 minutes");
        archive("running", false, "");
    }

    @AfterEach
    public void tearDown() {
        config.shutdownNow();
    }

    private void archive(String name, boolean paused, String reason) throws Exception {
        String pvName = PREFIX + name;
        PVTypeInfo info = new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        info.setPaused(paused);
        info.setPauseReason(reason);
        config.updateTypeInfoForPV(pvName, info);
        config.registerPVToAppliance(pvName, config.getMyApplianceInfo());
    }

    private static JSONArray engineRows(String... names) {
        JSONArray rows = new JSONArray();
        for (String name : names) {
            JSONObject row = new JSONObject();
            row.put("pvName", PREFIX + name);
            row.put("eventsDropped", "3");
            rows.add(row);
        }
        return rows;
    }

    private List<String> names(JSONArray engine, String limit) {
        return DroppedEventsTypeChangeReport.pausedForTypeChange(config, engine, limit).stream()
                .map(row -> (String) row.get("pvName"))
                .collect(Collectors.toList());
    }

    @Test
    public void listsOnlyThePVsPausedForATypeChangeInTheOrderOfTheirNames() {
        assertEquals(List.of(PREFIX + "a", PREFIX + "b", PREFIX + "c"), names(engineRows(), null));
    }

    @Test
    public void aRowCarriesTheTwoTypesOfTheReasonAndNoCount() {
        JSONObject row = DroppedEventsTypeChangeReport.pausedForTypeChange(config, engineRows(), null).get(1);
        assertEquals(PREFIX + "b", row.get("pvName"));
        assertEquals("DBR_SCALAR_INT", row.get("oldType"));
        assertEquals("DBR_SCALAR_STRING", row.get("newType"));
        assertFalse(row.containsKey("eventsDropped"));
    }

    @Test
    public void aPVThatAnEngineAlreadyReportsIsNotListedTwice() {
        assertEquals(List.of(PREFIX + "a", PREFIX + "c"), names(engineRows("b"), null));
    }

    @Test
    public void theLimitKeepsTheFirstRows() {
        assertEquals(List.of(PREFIX + "a", PREFIX + "b"), names(engineRows(), "2"));
        assertEquals(List.of(PREFIX + "a"), names(engineRows(), " 1 "));
        assertEquals(List.of(), names(engineRows(), "0"));
    }

    @Test
    public void aLimitAboveTheCountOrNotAnIntegerKeepsEveryRow() {
        List<String> all = List.of(PREFIX + "a", PREFIX + "b", PREFIX + "c");
        assertEquals(all, names(engineRows(), "100"));
        assertEquals(all, names(engineRows(), "many"));
        assertEquals(all, names(engineRows(), ""));
        assertEquals(all, names(engineRows(), "-1"));
    }
}
