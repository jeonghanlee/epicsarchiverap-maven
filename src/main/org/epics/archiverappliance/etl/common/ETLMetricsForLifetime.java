package org.epics.archiverappliance.etl.common;

import java.io.IOException;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.ConcurrentHashMap;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.etl.StorageMetricsContext;
import org.epics.archiverappliance.utils.nio.ArchPaths;

/**
 * The per-transition state the store plugins share through StorageMetricsContext: the FileStore of each root
 * folder, cached on first use. It is read from the ETL worker thread, the BPL threads and the config sync thread,
 * so the cache is concurrent. The per-transition ETL values are the pass records of the drivers.
 * @author mshankar
 *
 */
public class ETLMetricsForLifetime implements StorageMetricsContext {
	private static Logger logger = LogManager.getLogger(ETLMetricsForLifetime.class.getName());
	int lifeTimeId;

	private final ConcurrentHashMap<String, FileStore> storageMetricsFileStores = new ConcurrentHashMap<String, FileStore>();

	public ETLMetricsForLifetime(int lifeTimeId) {
		this.lifeTimeId = lifeTimeId;
	}

	public int getLifeTimeId() {
		return lifeTimeId;
	}

	/* (non-Javadoc)
	 * @see org.epics.archiverappliance.etl.StorageMetricsContext#getFileStore(java.lang.String)
	 */
	@Override
	public FileStore getFileStore(String rootFolder) throws IOException {
		FileStore fileStore = this.storageMetricsFileStores.get(rootFolder);
		if(fileStore == null) {
			try(ArchPaths paths = new ArchPaths()) {
				Path rootF = paths.get(rootFolder);
				fileStore = Files.getFileStore(rootF);
				this.storageMetricsFileStores.put(rootFolder, fileStore);
				logger.debug("Adding filestore to ETLMetricsForLifetime cache for rootFolder " + rootFolder);
			}
		} else {
			logger.debug("Filestore for rootFolder " + rootFolder + " is already in ETLMetricsForLifetime cache");
		}
		return fileStore;
	}
}
