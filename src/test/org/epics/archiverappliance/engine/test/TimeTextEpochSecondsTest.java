package org.epics.archiverappliance.engine.test;

import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.engine.epics.EngineChannelStatus;
import org.epics.archiverappliance.engine.pv.PVMetrics;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

/**
 * Every time that the management calls write as text is accompanied by the same instant as epoch seconds: the time
 * elements of getPVDetails carry epochSeconds, and the flat answer of getPVStatus carries the name of the time with
 * EpochSeconds appended; a time that reads Never has no epoch seconds, and the text is unchanged.
 */
public class TimeTextEpochSecondsTest {
    private static final long RECEIVED = 1792300000L;
    private static final long ROTATED = 1792300010L;

    private static Map<String, String> element(List<Map<String, String>> details, String name) {
        return details.stream().filter(d -> name.equals(d.get("name"))).findFirst().orElseThrow();
    }

    @Test
    public void detailsCarryEpochSecondsBesideTheText() {
        PVMetrics metrics = new PVMetrics("TimeText:pv", null, RECEIVED, ArchDBRTypes.DBR_SCALAR_DOUBLE);
        metrics.setSecondsOfLastEvent(RECEIVED);
        metrics.setLastRotateLogsEpochSeconds(ROTATED);
        List<Map<String, String>> details = metrics.getDetailedStatus();
        Map<String, String> received = element(details, "When did we receive the last event?");
        Assertions.assertEquals(TimeUtils.convertToHumanReadableString(RECEIVED), received.get("value"), "the text is unchanged");
        Assertions.assertEquals(Long.toString(RECEIVED), received.get("epochSeconds"), "the same instant as epoch seconds");
        Assertions.assertEquals(Long.toString(ROTATED), element(details, "What did we last push the data to the short term store?").get("epochSeconds"));
        Map<String, String> never = element(details, "When did we last lose a connection to this PV?");
        Assertions.assertEquals("Never", never.get("value"));
        Assertions.assertFalse(never.containsKey("epochSeconds"), "a time that reads Never has no epoch seconds");
        Assertions.assertFalse(element(details, "Is this PV currently connected?").containsKey("epochSeconds"), "an element without a time has none");
    }

    @Test
    public void statusCarriesEpochSecondsBesideEachTime() {
        EngineChannelStatus status = new EngineChannelStatus(new PVMetrics("TimeText:pv", null, RECEIVED, ArchDBRTypes.DBR_SCALAR_DOUBLE))
                .setEpochSecondsOfLastEvent(RECEIVED)
                .setLastRotateLogsEpochSeconds(ROTATED);
        JSONObject json = (JSONObject) JSONValue.parse(status.toJSONString());
        Assertions.assertEquals(TimeUtils.convertToHumanReadableString(RECEIVED), json.get("lastEvent"), "the text is unchanged");
        Assertions.assertEquals(Long.toString(RECEIVED), json.get("lastEventEpochSeconds"));
        Assertions.assertEquals(Long.toString(ROTATED), json.get("lastRotateLogsEpochSeconds"));
        Assertions.assertEquals("Never", json.get("connectionFirstEstablished"));
        Assertions.assertFalse(json.containsKey("connectionFirstEstablishedEpochSeconds"), "a time that reads Never has no epoch seconds");
    }
}
