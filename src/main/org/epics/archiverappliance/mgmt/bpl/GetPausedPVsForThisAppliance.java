package org.epics.archiverappliance.mgmt.bpl;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.LinkedList;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.common.BPLEndpoint;
import org.epics.archiverappliance.common.BPLAction;
import org.epics.archiverappliance.common.BPLParam;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.utils.ui.MimeTypeConstants;
import org.json.simple.JSONValue;

/**
 * Get a list of PVs for this appliance that are paused as a JSON array
 * @author mshankar
 *
 */
@BPLEndpoint(
        summary = "Get a list of PVs for this appliance that are paused as a JSON array /",
        params = {
            @BPLParam(name = "limit", description = "Limit the list to this many PVs; an integer from 1 to 2147483647, else HTTP 400. Optional, if unspecified, there are no limits enforced.")
        })
public class GetPausedPVsForThisAppliance implements BPLAction {
	private static Logger logger = LogManager.getLogger(GetPausedPVsForThisAppliance.class.getName());

	/**
	 * Parses the value of the limit parameter.
	 * @param limitStr The value of the parameter; null if the request does not carry it.
	 * @return The limit, or Integer.MAX_VALUE if the request carries none.
	 * @throws IllegalArgumentException If the value is not an integer of at least 1.
	 */
	public static int parseLimit(String limitStr) {
		if(limitStr == null) {
			return Integer.MAX_VALUE;
		}
		int limit;
		try {
			limit = Integer.parseInt(limitStr);
		} catch(NumberFormatException ex) {
			throw new IllegalArgumentException("The limit must be an integer of at least 1, not \"" + limitStr + "\"", ex);
		}
		if(limit < 1) {
			throw new IllegalArgumentException("The limit must be an integer of at least 1, not \"" + limitStr + "\"");
		}
		return limit;
	}

	@Override
	public void execute(HttpServletRequest req, HttpServletResponse resp, ConfigService configService) throws IOException {
		int limit;
		try {
			limit = parseLimit(req.getParameter("limit"));
		} catch(IllegalArgumentException ex) {
			logger.warn("Bad limit for the paused pvs of the appliance: " + ex.getMessage());
			resp.sendError(HttpServletResponse.SC_BAD_REQUEST, ex.getMessage());
			return;
		}
		logger.debug("Getting paused pvs for appliance " + configService.getMyApplianceInfo().getIdentity());
		LinkedList<String> pausedPVSForThisAppliance = new LinkedList<String>();
		for(String pvName : configService.getPausedPVsInThisAppliance()) {
			if(pausedPVSForThisAppliance.size() >= limit) {
				break;
			}
			pausedPVSForThisAppliance.add(pvName);
		}
		resp.setContentType(MimeTypeConstants.APPLICATION_JSON);
		try (PrintWriter out = resp.getWriter()) {
			out.println(JSONValue.toJSONString(pausedPVSForThisAppliance));
		} catch(Exception ex) {
			logger.error("Exception getting paused pvs for appliance " + configService.getMyApplianceInfo().getIdentity(), ex);
			resp.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
		}
	}

}
