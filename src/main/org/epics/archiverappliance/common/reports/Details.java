package org.epics.archiverappliance.common.reports;

import org.epics.archiverappliance.config.ConfigService;

import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.Map;

public interface Details {

    static Map<String, String> metricDetail(String source, String name, String value) {
        Map<String, String> obj = new LinkedHashMap<String, String>();
        obj.put("name", name);
        obj.put("value", value);
        obj.put("source", source);
        return obj;
    }

    /**
     * A detail that holds a time: the text in the zone of the server as its value and, when the time is set, the same
     * instant as epochSeconds; a time that reads Never has no epochSeconds.
     */
    static Map<String, String> timeDetail(String source, String name, long epochSeconds) {
        Map<String, String> obj = metricDetail(source, name, org.epics.archiverappliance.common.TimeUtils.convertToHumanReadableString(epochSeconds));
        if (epochSeconds > 0) {
            obj.put("epochSeconds", Long.toString(epochSeconds));
        }
        return obj;
    }

    ConfigService.WAR_FILE source();

    default Map<String, String> timeDetail(String name, long epochSeconds) {
        return timeDetail(source().toString(), name, epochSeconds);
    }

    default Map<String, String> metricDetail(String name, String value) {
        return metricDetail(source().toString(), name, value);
    }

    LinkedList<Map<String, String>> details(ConfigService configService);
}
