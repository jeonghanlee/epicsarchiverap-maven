/*******************************************************************************
 * Copyright (c) 2011 The Board of Trustees of the Leland Stanford Junior University
 * as Operator of the SLAC National Accelerator Laboratory.
 * Copyright (c) 2011 Brookhaven National Laboratory.
 * EPICS archiver appliance is distributed subject to a Software License Agreement found
 * in file LICENSE that is included with this distribution.
 *******************************************************************************/


package org.epics.archiverappliance.etl.bpl;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.common.BPLAction;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.etl.ETLContext;
import org.epics.archiverappliance.etl.ETLInfo;
import org.epics.archiverappliance.etl.ETLSource;
import org.epics.archiverappliance.utils.ui.MimeTypeConstants;
import org.json.simple.JSONValue;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
/**
 * Removes ETL jobs and, when requested, confirms stored-data deletion before acknowledging it.
 * @author Luofeng  Li 
 *
 */
public class DeletePV implements BPLAction {
	private static final Logger logger = LogManager.getLogger(DeletePV.class);
	
	@Override
	public void execute(HttpServletRequest req, HttpServletResponse resp, ConfigService configService) throws IOException {
		String pvName = req.getParameter("pv");
		if(pvName == null || pvName.equals("")) {
			resp.sendError(HttpServletResponse.SC_BAD_REQUEST);
			return;
		}

		boolean deleteData = false;
		String deleteDataStr=req.getParameter("deleteData");
		if(deleteDataStr!=null && !deleteDataStr.equals("")) {
			deleteData = Boolean.parseBoolean(deleteDataStr);
		}
		
		PVTypeInfo typeInfo = configService.getTypeInfoForPV(pvName);
		if(typeInfo == null) {
			logger.debug("Unable to find typeinfo for PV...");
			resp.sendError(HttpServletResponse.SC_BAD_REQUEST);
			return;
		}
		
		HashMap<String, Object> infoValues = new HashMap<String, Object>();
		resp.setContentType(MimeTypeConstants.APPLICATION_JSON);

		try (PrintWriter out = resp.getWriter()) {
			List<String> failures = new ArrayList<>();
			// Remove any ETL jobs from the runtime state. 
			configService.getETLLookup().deleteETLJobs(pvName);
			
			if(deleteData) {
				HashMap<String, String> timingValues = new HashMap<String, String>();
				infoValues.put("deletes_timing", timingValues);
				if (typeInfo.getDataStores() == null || typeInfo.getDataStores().length == 0) {
					failures.add("No usable data stores for PV " + pvName);
				} else {
					for(String dataSource : typeInfo.getDataStores()) {
						ETLContext context = new ETLContext();
						try {
							ETLSource etlSource = StoragePluginURLParser.parseETLSource(dataSource, configService);
							if (etlSource == null) throw new IOException("Data store has no usable deletion source");
							List<ETLInfo> infos = etlSource.getETLStreamsForDeletion(pvName, context);
							if (infos == null) throw new IOException("Deletion source returned no stream result");
							for(ETLInfo info : infos) {
								if (info == null) throw new IOException("Deletion source returned a null stream");
								timingValues.put(info.getKey() + ": Start", TimeUtils.convertToHumanReadableString(System.currentTimeMillis()/1000));
								logger.debug("Marking src " + info.getKey() + " for deletion when stopping archiving pv " + pvName);
								etlSource.deleteETLStream(info, context);
								timingValues.put(info.getKey() + ": End", TimeUtils.convertToHumanReadableString(System.currentTimeMillis()/1000));
							}
						} catch(Exception ex) {
							logger.error("Exception deleting data for PV " + pvName, ex);
							failures.add("Deletion failed for " + dataSource + ": " + ex);
						} finally {
							try {
								context.getPaths().close();
							} catch (Exception ex) {
								logger.error("Exception finalizing deletion for PV " + pvName, ex);
								failures.add("Deletion finalization failed for " + dataSource + ": " + ex);
							}
							try {
								context.close();
							} catch (Exception ex) {
								logger.error("Exception closing deletion context for PV " + pvName, ex);
								failures.add("Deletion cleanup failed for " + dataSource + ": " + ex);
							}
						}
					}
				}
			}
			
			infoValues.put("status", failures.isEmpty() ? "ok" : "error");
			infoValues.put("desc", failures.isEmpty()
					? "Successfully removed PV " + pvName + " from the cluster"
					: "Unable to confirm stored-data deletion for PV " + pvName + ": " + String.join("; ", failures));
			out.println(JSONValue.toJSONString(infoValues));
			return;
		}
		
	}
}
