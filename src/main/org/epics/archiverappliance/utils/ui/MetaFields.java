package org.epics.archiverappliance.utils.ui;

import java.util.HashMap;
import java.util.Map;

/**
 * Utility class for dealing with metafields as part of responses.
 * @author mshankar
 *
 */
public class MetaFields {

    /*
     * We typically return meta fields as a "meta" attribute in JSON objects.
     * Use this utility method to add a meta field name/value pair into a JSON object
     */
    @SuppressWarnings("unchecked")
    public static void addMetaFieldValue(HashMap<String, Object> jsonval, String fieldName, String fieldValue) {
        if(!jsonval.keySet().contains("meta")) {
            HashMap<String, String> metaFields = new HashMap<String, String>();
            jsonval.put("meta", metaFields);    
        }
        HashMap<String, String> meta = ((HashMap<String, String>)jsonval.get("meta"));
        if(!meta.containsKey(fieldName)) {
            meta.put(fieldName, fieldValue);
        }
        trimEnumLabels(meta);
    }

    /** Applies an explicit enum choice count without changing legacy metadata lacking a count. */
    public static void trimEnumLabels(Map<String, String> fields) {
        String countText = fields.get("ENUM_COUNT");
        if (countText == null) return;
        final int count;
        try {
            count = Integer.parseInt(countText);
        } catch (NumberFormatException ex) {
            return;
        }
        if (count < 0) return;
        fields.keySet().removeIf(key -> {
            if (!key.startsWith("ENUM_") || key.equals("ENUM_COUNT")) return false;
            try {
                return Integer.parseInt(key.substring(5)) >= count;
            } catch (NumberFormatException ex) {
                return false;
            }
        });
    }

}
