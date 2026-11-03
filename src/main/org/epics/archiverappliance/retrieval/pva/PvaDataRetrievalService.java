package org.epics.archiverappliance.retrieval.pva;

import java.util.HashMap;
import java.util.Map;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.mgmt.pva.actions.PvaAction;
import org.epics.pva.data.PVAStructure;
import org.epics.pva.data.nt.PVAURI;
import org.epics.pva.server.RPCService;

/**
 * 
 * @author Kunal Shroff
 *
 */
public class PvaDataRetrievalService implements RPCService {

	public static final String PVA_DATA_SERVICE = "pvaDataRetrievalService";

	private static Logger logger = LogManager.getLogger(PvaDataRetrievalService.class.getName());
	private final ConfigService configService;

	/**
	 * List of supported operations
	 */
	Map<String, PvaAction> actions = new HashMap<String, PvaAction>();

	private final PvaCallLimiter limiter;

	public PvaDataRetrievalService(ConfigService configService) {
		this.configService = configService;
		this.limiter = PvaCallLimiter.fromProperties(System.getProperties());
		logger.info("Creating an instance of PvaDataRetrievalService with " + limiter.total() + " call permits");
		actions.put(PvaGetPVData.NAME, new PvaGetPVData());
	}

	/**
	 * 
	 */
	@Override
	public PVAStructure call(PVAStructure pvaStructure) throws Exception {
		if (!limiter.tryAcquire()) {
			logger.warn("PVAccess retrieval call refused: all " + limiter.total() + " call permits are in use");
			throw new IllegalStateException("PVAccess retrieval is busy: all " + limiter.total() + " call permits are in use");
		}
		try {
			return handle(pvaStructure);
		} finally {
			limiter.release();
		}
	}

	private PVAStructure handle(PVAStructure pvaStructure) throws Exception {
		PVAURI uri = PVAURI.fromStructure(pvaStructure);
		if (uri != null) {
			if (actions.get(uri.getPath()) != null) {
				return actions.get(uri.getPath()).request(pvaStructure, configService);
			} else {
				throw new UnsupportedOperationException("The requested operation is not supported " + uri.getPath());
			}
		} else {
			// Unable to handle the request args
			throw new IllegalArgumentException(PVA_DATA_SERVICE + " only supports request args of type NTURI");
		}
	}

}
