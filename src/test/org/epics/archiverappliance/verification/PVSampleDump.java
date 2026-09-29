package org.epics.archiverappliance.verification;

import edu.stanford.slac.archiverappliance.PlainPB.FileBackedPBEventStream;
import edu.stanford.slac.archiverappliance.PlainPB.PBFileInfo;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.config.PVNames;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.json.simple.JSONObject;

import java.nio.file.Path;
import java.util.Collections;
import java.util.HashMap;

/** Exposes shipped readers and normalization for subprocess verification. */
public class PVSampleDump {
    @SuppressWarnings("unchecked")
    public static void main(String[] args) throws Exception {
        if (args.length == 0) {
            throw new IllegalArgumentException("Usage: PVSampleDump <PBFile>... | --normalize <PV>...");
        }
        if (args[0].equals("--normalize")) {
            for (int i = 1; i < args.length; i++) {
                System.out.println(PVNames.normalizeChannelName(args[i]));
            }
            return;
        }
        for (String filename : args) {
            Path path = Path.of(filename);
            PBFileInfo info = new PBFileInfo(path);
            try (FileBackedPBEventStream stream = new FileBackedPBEventStream(
                    info.getPVName(), path, info.getType())) {
                JSONObject header = new JSONObject();
                header.put("kind", "header");
                header.put("file", path.toString());
                header.put("pvName", info.getPVName());
                header.put("type", info.getType().toString());
                HashMap<String, String> headers = new HashMap<>();
                info.getInfo().getHeadersList().forEach(field -> headers.put(field.getName(), field.getVal()));
                header.put("fields", headers);
                header.put("year", info.getDataYear());
                System.out.println(header.toJSONString());
                for (Event event : stream) {
                    DBRTimeEvent sample = (DBRTimeEvent) event;
                    JSONObject row = new JSONObject();
                    row.put("kind", "sample");
                    row.put("pvName", info.getPVName());
                    row.put("type", info.getType().toString());
                    row.put("secs", sample.getEpochSeconds());
                    row.put("nanos", sample.getEventTimeStamp().getNano());
                    row.put("val", sample.getSampleValue().getValue());
                    row.put("status", sample.getStatus());
                    row.put("severity", sample.getSeverity());
                    row.put("fields", sample.hasFieldValues() ? sample.getFields() : Collections.emptyMap());
                    System.out.println(row.toJSONString());
                }
            }
        }
    }
}
