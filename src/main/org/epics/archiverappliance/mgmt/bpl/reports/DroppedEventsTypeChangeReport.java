package org.epics.archiverappliance.mgmt.bpl.reports;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.common.BPLAction;
import org.epics.archiverappliance.common.BPLEndpoint;
import org.epics.archiverappliance.common.BPLParam;
import org.epics.archiverappliance.config.ApplianceInfo;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.epics.archiverappliance.utils.ui.MimeTypeConstants;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

/**
 * A report of the PVs whose events were dropped because the type of the underlying PV changed.
 *
 * The engines report the PVs whose channel is dropping events, with the count. The engine pauses such a PV at its first
 * event of the other type and removes its channel, with the reason in the type information; this report adds one row for
 * every such PV of the cluster, with the old and the new type taken from the reason and without a count, because the
 * count went with the channel.
 *
 * @author mshankar
 *
 */
@BPLEndpoint(
        summary = "Return a list of PVs sorted by number of times we've lost events because of changes in type of the underlying PV, followed by the PVs the engine paused because their type changed, with the old and the new type and no count.",
        params = {
            @BPLParam(name = "limit", description = "Limit this report to this many PVs per appliance in the cluster, and to this many paused PVs. Optional, if unspecified, there are no limits enforced.")
        })
public class DroppedEventsTypeChangeReport implements BPLAction {
	private static Logger logger = LogManager.getLogger(DroppedEventsTypeChangeReport.class.getName());
	/** The reason the engine writes into the type information when it pauses a PV for a type change. */
	static final Pattern TYPE_CHANGE_REASON = Pattern.compile("^type changed from (\\S+) to (\\S+)$");

	@Override
	public void execute(HttpServletRequest req, HttpServletResponse resp, ConfigService configService) throws IOException {
		String limit = req.getParameter("limit");
		logger.info("Report for PVs that have dropped events because of type changes for " + (limit == null ? "default limit " : ("limit " + limit)));
		resp.setContentType(MimeTypeConstants.APPLICATION_JSON);
		LinkedList<String> storageRateURLs = new LinkedList<String>();
		for(ApplianceInfo info : configService.getAppliancesInCluster()) {
			storageRateURLs.add(info.getEngineURL() + "/getPVsByDroppedEventsTypeChange" + (limit == null ? "" : ("?limit=" + limit)));
		}
		try (PrintWriter out = resp.getWriter()) {
			JSONArray rows = GetUrlContent.combineJSONArrays(storageRateURLs);
			rows.addAll(pausedForTypeChange(configService, rows, limit));
			out.println(JSONValue.toJSONString(rows));
		}
	}

	/**
	 * The rows of the PVs the engine paused for a type change, in the order of their names, without the PVs the engines
	 * already report and at most {@code limit} of them when a limit is given.
	 */
	@SuppressWarnings("unchecked")
	static List<JSONObject> pausedForTypeChange(ConfigService configService, JSONArray engineRows, String limit) {
		Set<String> reported = new HashSet<>();
		for (Object row : engineRows) {
			if (row instanceof Map) reported.add(String.valueOf(((Map<String, Object>) row).get("pvName")));
		}
		TreeMap<String, JSONObject> paused = new TreeMap<>();
		for (String pvName : configService.getAllPVs()) {
			if (reported.contains(pvName)) continue;
			PVTypeInfo typeInfo = configService.getTypeInfoForPV(pvName);
			if (typeInfo == null || !typeInfo.isPaused()) continue;
			Matcher reason = TYPE_CHANGE_REASON.matcher(typeInfo.getPauseReason());
			if (!reason.matches()) continue;
			JSONObject row = new JSONObject(new LinkedHashMap<String, String>());
			row.put("pvName", pvName);
			row.put("oldType", reason.group(1));
			row.put("newType", reason.group(2));
			paused.put(pvName, row);
		}
		List<JSONObject> rows = new ArrayList<>(paused.values());
		if (limit != null && !limit.isBlank()) {
			try {
				int count = Integer.parseInt(limit.trim());
				if (count >= 0 && count < rows.size()) rows = rows.subList(0, count);
			} catch (NumberFormatException ex) {
				logger.warn("Ignoring the limit " + limit + " of the type change report, which is not an integer");
			}
		}
		return rows;
	}
}
