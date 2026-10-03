/*******************************************************************************
 * Copyright (c) 2011 The Board of Trustees of the Leland Stanford Junior University
 * as Operator of the SLAC National Accelerator Laboratory.
 * Copyright (c) 2011 Brookhaven National Laboratory.
 * EPICS archiver appliance is distributed subject to a Software License Agreement found
 * in file LICENSE that is included with this distribution.
 *******************************************************************************/
package org.epics.archiverappliance.etl.common;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.StoragePlugin;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.PartitionGranularity;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.etl.ETLDest;
import org.epics.archiverappliance.etl.ETLSource;
import org.epics.archiverappliance.etl.StorageMetrics;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentSkipListSet;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Function;

/**
 * The ETL lookup of one appliance: the lookup items of every PV and lifetime transition, and the pass drivers
 * that run their jobs.
 * <p>
 * Each PV joins, at each transition, the driver of its (transition index, cadence); the drivers of one transition
 * index share one worker thread, so the jobs of an index have one order. One ticker thread ticks every driver every
 * few seconds in transition order. The config sync thread registers the PVs of this appliance and starts every
 * driver after each of its loops. Pause and delete queue the consolidation of a PV on the worker thread of its
 * index, between the jobs of a running pass; the shutdown hook stops the ticker, waits a bounded time for the
 * running jobs, interrupts them, and then consolidates every PV but one whose job is still running.
 * <p>
 * The lookup reads the current time from its clock and ARCHAPPL_SKIP_ETL_FOR_STORE through its environment
 * reader; production passes the system clock and System::getenv, tests supply their own.
 */
public final class PBThreeTierETLPVLookup {
    private static final Logger logger = LogManager.getLogger(PBThreeTierETLPVLookup.class.getName());
    private static final Logger configlogger = LogManager.getLogger("config." + PBThreeTierETLPVLookup.class.getName());

    /** The name of the environment variable that names a destination store ETL must not write to. */
    public static final String SKIP_ETL_FOR_STORE_ENV = "ARCHAPPL_SKIP_ETL_FOR_STORE";

    /** Worker threads per transition index; only 1 is supported. */
    public static final String WORKERS_PROPERTY = "org.epics.archiverappliance.etl.common.ETLPassWorkers";

    /** Seconds the shutdown hook waits for a running job before interrupting it, and again after the interrupt. */
    public static final String STOP_WAIT_PROPERTY = "org.epics.archiverappliance.etl.common.ETLPassStopWaitSeconds";

    public static final long DEFAULT_STOP_WAIT_SECONDS = 60;

    /** What ETL does when a destination store lacks space; the value names an OutOfSpaceHandling constant. */
    public static final String OUT_OF_SPACE_HANDLING_PROPERTY =
            "org.epics.archiverappliance.etl.common.OutOfSpaceHandling";

    public static final OutOfSpaceHandling DEFAULT_OUT_OF_SPACE_HANDLING =
            OutOfSpaceHandling.DELETE_SRC_STREAMS_IF_FIRST_DEST_WHEN_OUT_OF_SPACE;

    private ConfigService configService = null;

    /** The out of space handling read once for all PVs and transitions; null until the first ETL job is added. */
    private OutOfSpaceHandling outOfSpaceHandling = null;

    /** Used to poll the config service in the background and add ETL jobs for PVs. */
    private ScheduledThreadPoolExecutor configServiceSyncThread = null;

    /** PVs for whom we have already added etl jobs. */
    private final ConcurrentSkipListSet<String> pvsForWhomWeHaveAddedETLJobs = new ConcurrentSkipListSet<String>();

    /**
     * Metrics and state for each lifetimeid transition for a pv.
     * The first level index is the source lifetimeid; the second level index is the pv name.
     */
    private final HashMap<Integer, ConcurrentHashMap<String, ETLPVLookupItems>> lifetimeId2PVName2LookupItem =
            new HashMap<Integer, ConcurrentHashMap<String, ETLPVLookupItems>>();

    /** One worker thread per transition index, shared by the drivers of that index. */
    private final Map<Integer, ExecutorService> workers = new ConcurrentHashMap<>();

    /** Drivers keyed by transition index, then by cadence in seconds. */
    private final Map<Integer, TreeMap<Long, ETLPassDriver>> drivers = new ConcurrentHashMap<>();

    private final ETLMetrics applianceMetrics = new ETLMetrics();

    private final Clock clock;
    private final Function<String, String> environmentReader;
    private final ETLPassTicker ticker;
    private ScheduledThreadPoolExecutor tickerThread = null;

    /** Set by the shutdown hook and by the test stop: no worker runs a queued task after either. */
    private volatile boolean workersStopped = false;

    private volatile boolean hookRan = false;

    public PBThreeTierETLPVLookup(ConfigService configService) {
        this(configService, Clock.systemUTC(), System::getenv);
    }

    public PBThreeTierETLPVLookup(
            ConfigService configService, Clock clock, Function<String, String> environmentReader) {
        this.configService = configService;
        this.clock = clock;
        this.environmentReader = environmentReader;
        this.ticker = new ETLPassTicker(clock);
        this.applianceMetrics.setDrivers(ticker::getDrivers, clock);
        configServiceSyncThread = new ScheduledThreadPoolExecutor(1, r -> new Thread(r, "Config service sync thread"));

        configService.addShutdownHook(new ETLShutdownThread(this));
    }

    /**
     * Initialize the ETL background scheduled executors and create the runtime state for various ETL components.
     */
    public void postStartup() {
        configlogger.info(
                "Beginning ETL post startup; scheduling the configServiceSyncThread to keep the local ETL lifetimeId2PVName2LookupItem in sync");
        int workersRequested = readWorkers();
        if (workersRequested != 1) {
            logger.error(WORKERS_PROPERTY + " is " + workersRequested + "; only 1 is supported and 1 is used");
        }
        readStopWaitSeconds();
        tickerThread = new ScheduledThreadPoolExecutor(1, r -> {
            Thread t = new Thread(r, "ETL tick");
            t.setDaemon(true);
            return t;
        });
        ticker.startTicking(tickerThread);
        // Seconds; needs to be the smallest time interval in the PartitionGranularity.
        int DEFAULT_ETL_PERIOD = 60 * 5;
        // Seconds.
        int DEFAULT_ETL_INITIAL_DELAY = 60;
        configServiceSyncThread.scheduleWithFixedDelay(
                () -> {
                    try {
                        Iterable<String> pVsForThisAppliance = configService.getPVsForThisAppliance();
                        if (pVsForThisAppliance != null) {
                            for (String pvName : pVsForThisAppliance) {
                                if (!pvsForWhomWeHaveAddedETLJobs.contains(pvName)) {
                                    PVTypeInfo typeInfo = configService.getTypeInfoForPV(pvName);
                                    if (!typeInfo.isPaused()) {
                                        addETLJobs(pvName, typeInfo);
                                    } else {
                                        logger.info("Skipping adding ETL jobs for paused PV " + pvName);
                                    }
                                }
                            }
                        } else {
                            configlogger.info("There are no PVs on this appliance yet");
                        }
                        startDrivers();
                    } catch (Throwable t) {
                        configlogger.error("Excepting syncing ETL jobs with config service", t);
                    }
                },
                DEFAULT_ETL_INITIAL_DELAY,
                DEFAULT_ETL_PERIOD,
                TimeUnit.SECONDS);
        configlogger.debug("Done initializing ETL post startup.");
    }

    /** Starts every driver; a started driver ignores the call. */
    public void startDrivers() {
        for (ETLPassDriver driver : ticker.getDrivers()) {
            driver.start();
        }
    }

    private int readWorkers() {
        String value = configService.getInstallationProperties().getProperty(WORKERS_PROPERTY, "1");
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException ex) {
            logger.error(WORKERS_PROPERTY + " is not a number: " + value + "; 1 is used");
            return 1;
        }
    }

    /** The stop wait bound; a value below 0 or not a number is replaced by the default with an ERROR line. */
    public long readStopWaitSeconds() {
        String value = configService
                .getInstallationProperties()
                .getProperty(STOP_WAIT_PROPERTY, Long.toString(DEFAULT_STOP_WAIT_SECONDS));
        try {
            long seconds = Long.parseLong(value.trim());
            if (seconds < 0) {
                logger.error(STOP_WAIT_PROPERTY + " is " + seconds + "; the default " + DEFAULT_STOP_WAIT_SECONDS
                        + " is used");
                return DEFAULT_STOP_WAIT_SECONDS;
            }
            return seconds;
        } catch (NumberFormatException ex) {
            logger.error(STOP_WAIT_PROPERTY + " is not a number: " + value + "; the default "
                    + DEFAULT_STOP_WAIT_SECONDS + " is used");
            return DEFAULT_STOP_WAIT_SECONDS;
        }
    }

    private ExecutorService workerFor(int transitionIndex) {
        return workers.computeIfAbsent(transitionIndex, index -> Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "ETL - " + index);
            t.setDaemon(true);
            return t;
        }));
    }

    private ETLPassDriver driverFor(int transitionIndex, ETLSource etlSource) {
        long cadence = ETLPassDriver.cadenceFor(etlSource.getPartitionGranularity());
        TreeMap<Long, ETLPassDriver> byCadence = drivers.computeIfAbsent(transitionIndex, index -> new TreeMap<>());
        synchronized (byCadence) {
            ETLPassDriver driver = byCadence.get(cadence);
            if (driver == null) {
                driver = new ETLPassDriver(
                        transitionIndex, cadence, clock, environmentReader, workerFor(transitionIndex));
                byCadence.put(cadence, driver);
                ticker.addDriver(driver);
                configlogger.info("Added ETL pass driver for transition " + transitionIndex + " with cadence "
                        + cadence + " s");
            }
            return driver;
        }
    }

    /** The driver that holds the given lookup item, or null when none does. */
    public ETLPassDriver getDriverFor(ETLPVLookupItems item) {
        TreeMap<Long, ETLPassDriver> byCadence = drivers.get(item.getLifetimeorder());
        if (byCadence == null) {
            return null;
        }
        synchronized (byCadence) {
            for (ETLPassDriver driver : byCadence.values()) {
                if (driver.hasPV(item.getPvName())) {
                    return driver;
                }
            }
        }
        return null;
    }

    /** Every driver, in registration order. */
    public List<ETLPassDriver> getDrivers() {
        return ticker.getDrivers();
    }

    public ETLPassTicker getTicker() {
        return ticker;
    }

    /**
     * Add jobs for each of the ETL lifetime transitions: one lookup item per transition, joined to the driver of
     * its transition index and cadence. No job runs at registration; the PV joins the driver's next pass.
     * @param pvName
     * @param typeInfo
     */
    private void addETLJobs(String pvName, PVTypeInfo typeInfo) {
        if (!pvsForWhomWeHaveAddedETLJobs.contains(pvName)) {
            // Precompute the chunkKey when we have access to the typeInfo. The keyConverter should store it in its
            // cache.
            String chunkKey = configService.getPVNameToKeyConverter().convertPVNameToKey(pvName);
            logger.debug("Adding etl jobs for pv " + pvName + " for chunkkey " + chunkKey);
            String[] dataSources = typeInfo.getDataStores();
            if (dataSources == null || dataSources.length < 2) {
                logger.warn("Skipping adding PV to ETL as it has less than 2 datasources" + pvName);
                return;
            }

            for (int etllifetimeid = 0; etllifetimeid < dataSources.length - 1; etllifetimeid++) {
                try {
                    if (!lifetimeId2PVName2LookupItem.containsKey(etllifetimeid)) {
                        configlogger.info("Adding ETL metrics for lifetimeid " + etllifetimeid);
                        lifetimeId2PVName2LookupItem.put(
                                etllifetimeid, new ConcurrentHashMap<String, ETLPVLookupItems>());
                        applianceMetrics.add(etllifetimeid);
                    }

                    String sourceStr = dataSources[etllifetimeid];
                    ETLSource etlSource = StoragePluginURLParser.parseETLSource(sourceStr, configService);
                    String destStr = dataSources[etllifetimeid + 1];
                    ETLDest etlDest = StoragePluginURLParser.parseETLDest(destStr, configService);
                    ETLPVLookupItems etlpvLookupItems = new ETLPVLookupItems(
                            pvName,
                            typeInfo.getDBRType(),
                            etlSource,
                            etlDest,
                            etllifetimeid,
                            applianceMetrics.get(etllifetimeid),
                            readOutOfSpaceHandling());
                    if (etlDest instanceof StorageMetrics) {
                        // At least on some of the test machines, checking free space seems to take the longest time. In
                        // this, getting the fileStore seems to take the longest time.
                        // The plainPB plugin caches the fileStore; so we make a call once when adding to initialize
                        // this upfront.
                        ((StorageMetrics) etlDest).getUsableSpace(etlpvLookupItems.getMetricsForLifetime());
                    }
                    lifetimeId2PVName2LookupItem.get(etllifetimeid).put(pvName, etlpvLookupItems);
                    ETLPassDriver driver = driverFor(etllifetimeid, etlSource);
                    driver.addPV(etlpvLookupItems);
                    logger.debug("Added " + pvName + " to " + driver);
                } catch (Throwable t) {
                    logger.error("Exception get  for pv " + pvName, t);
                }
            }

            pvsForWhomWeHaveAddedETLJobs.add(pvName);
        } else {
            logger.debug("Not adding ETL jobs for PV already in pvsForWhomWeHaveAddedETLJobs " + pvName);
        }
    }

    private boolean skipsStore(ETLPVLookupItems item) {
        String skipStoreName = environmentReader.apply(SKIP_ETL_FOR_STORE_ENV);
        return skipStoreName != null
                && item.getETLDest() instanceof StoragePlugin dest
                && skipStoreName.equals(dest.getName());
    }

    private static Instant oneYearLater() {
        return TimeUtils.convertFromEpochSeconds(
                TimeUtils.getCurrentEpochSeconds() + 365L * PartitionGranularity.PARTITION_DAY.getApproxSecondsPerChunk(),
                0);
    }

    /**
     * Runs the consolidation job of one lookup item: between the jobs of the running pass of its driver, else on
     * the worker thread of its index, else on the calling thread when no worker runs. Waits for it to end.
     */
    private void consolidate(ETLPVLookupItems lookupItem, ETLPassDriver driver) {
        if (skipsStore(lookupItem)) {
            logger.error("Skipping the consolidation of " + lookupItem + " into store "
                    + environmentReader.apply(SKIP_ETL_FOR_STORE_ENV) + " as " + SKIP_ETL_FOR_STORE_ENV + " names it");
            return;
        }
        ETLJob job = new ETLJob(lookupItem, oneYearLater());
        if (workersStopped) {
            job.run();
            return;
        }
        CompletableFuture<Void> done = new CompletableFuture<>();
        Runnable task = () -> {
            try {
                job.run();
            } finally {
                done.complete(null);
            }
        };
        if (driver == null || !driver.enqueueIfRunning(task)) {
            workerFor(lookupItem.getLifetimeorder()).execute(task);
        }
        try {
            done.get();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        } catch (ExecutionException ex) {
            logger.error("Exception consolidating " + lookupItem, ex);
        }
    }

    /**
     * Cancel the ETL jobs for each of the ETL lifetime transitions and also remove from internal structures.
     * The PV leaves its drivers first; then, index by index, its consolidation runs and is waited for.
     * After the shutdown hook has run nothing is queued: the PV is logged and left to the hook's consolidation.
     * @param pvName The name of PV.
     */
    public void deleteETLJobs(String pvName) {
        if (pvsForWhomWeHaveAddedETLJobs.contains(pvName)) {
            logger.debug(
                    "deleting etl jobs for  pv " + pvName + " from the locally cached copy of pvs for this appliance");
            if (hookRan) {
                logger.error("The shutdown hook has run; not consolidating " + pvName + " on delete");
                pvsForWhomWeHaveAddedETLJobs.remove(pvName);
                return;
            }
            int lifetTimeIdTransitions = lifetimeId2PVName2LookupItem.size();
            for (int etllifetimeid = 0; etllifetimeid < lifetTimeIdTransitions; etllifetimeid++) {
                ETLPVLookupItems lookupItem =
                        lifetimeId2PVName2LookupItem.get(etllifetimeid).get(pvName);
                if (lookupItem != null) {
                    ETLPassDriver driver = getDriverFor(lookupItem);
                    if (driver != null) {
                        driver.removePV(pvName);
                    }
                    lifetimeId2PVName2LookupItem.get(etllifetimeid).remove(pvName);

                    if (lookupItem.getETLSource().consolidateOnShutdown()) {
                        logger.debug("Need to consolidate data from etl source "
                                + ((StoragePlugin) lookupItem.getETLSource()).getName() + " for pv " + pvName
                                + " for storage " + ((StorageMetrics) lookupItem.getETLDest()).getName());
                        consolidate(lookupItem, driver);
                    }
                } else {
                    logger.debug("Did not find lookup item for " + pvName + " for lifetime id " + etllifetimeid);
                }
            }

            pvsForWhomWeHaveAddedETLJobs.remove(pvName);
        } else {
            logger.debug("Not deleting ETL jobs for PV missing from pvsForWhomWeHaveAddedETLJobs " + pvName);
        }
    }

    /**
     * Get the internal state for all the ETL lifetime transitions for a pv
     * @param pvName The name of PV.
     * @return LinkedList  &emsp;
     */
    public LinkedList<ETLPVLookupItems> getLookupItemsForPV(String pvName) {
        LinkedList<ETLPVLookupItems> ret = new LinkedList<ETLPVLookupItems>();
        if (pvsForWhomWeHaveAddedETLJobs.contains(pvName)) {
            int lifetTimeIdTransitions = lifetimeId2PVName2LookupItem.size();
            for (int etllifetimeid = 0; etllifetimeid < lifetTimeIdTransitions; etllifetimeid++) {
                ETLPVLookupItems lookupItem =
                        lifetimeId2PVName2LookupItem.get(etllifetimeid).get(pvName);
                if (lookupItem != null) {
                    ret.add(lookupItem);
                } else {
                    logger.debug("Did not find lookup item for " + pvName + " for lifetime id " + etllifetimeid);
                }
            }
        } else {
            logger.debug("Returning empty list for PV missing from pvsForWhomWeHaveAddedETLJobs " + pvName);
        }
        return ret;
    }

    /**
     * Get the latest (last known) entry from the stores for this PV.
     * @param pvName The name of PV.
     * @return Event LatestEventFromDataStores
     * @throws IOException  &emsp;
     */
    public Event getLatestEventFromDataStores(String pvName) throws IOException {
        LinkedList<ETLPVLookupItems> etlEntries = getLookupItemsForPV(pvName);
        try (BasicContext context = new BasicContext()) {
            for (ETLPVLookupItems etlEntry : etlEntries) {
                Event e = etlEntry.getETLDest().getLastKnownEvent(context, pvName);
                if (e != null) return e;
            }
        }
        return null;
    }

    /**
     * The shutdown order: stop the ticker and flag every driver, wait up to the bound for the running job of every
     * index, interrupt the worker threads and wait up to the bound again, then consolidate on this thread, index by
     * index, every PV but one whose job is still running, plus the tasks still queued between jobs.
     */
    public void shutdown() {
        logger.debug("Shutting down ETL threads.");
        hookRan = true;
        configServiceSyncThread.shutdown();
        ticker.stop();
        if (tickerThread != null) {
            tickerThread.shutdown();
        }
        long bound = readStopWaitSeconds();
        waitForRunningPasses(bound);
        for (ExecutorService worker : workers.values()) {
            worker.shutdownNow();
        }
        workersStopped = true;
        waitForRunningPasses(bound);

        Map<String, Integer> leftPerStore = new TreeMap<>();
        int lifetTimeIdTransitions = lifetimeId2PVName2LookupItem.size();
        for (int lifetimeId = 0; lifetimeId < lifetTimeIdTransitions; lifetimeId++) {
            TreeMap<Long, ETLPassDriver> byCadence = drivers.get(lifetimeId);
            if (byCadence != null) {
                for (ETLPassDriver driver : byCadence.values()) {
                    for (Runnable queued : driver.takeQueued()) {
                        try {
                            queued.run();
                        } catch (Throwable t) {
                            logger.error("Error running a queued consolidation at shutdown", t);
                        }
                    }
                }
            }
            ConcurrentHashMap<String, ETLPVLookupItems> lifetimeItems = lifetimeId2PVName2LookupItem.get(lifetimeId);
            for (String pvName : lifetimeItems.keySet()) {
                try {
                    ETLPVLookupItems etlitem = lifetimeItems.get(pvName);
                    if (!etlitem.getETLSource().consolidateOnShutdown()) {
                        continue;
                    }
                    String sourceName = ((StoragePlugin) etlitem.getETLSource()).getName();
                    ETLPassDriver driver = getDriverFor(etlitem);
                    if (driver != null && pvName.equals(driver.getCurrentJobPv())) {
                        logger.error("Not consolidating " + pvName + " from " + sourceName
                                + " at shutdown: its ETL job is still running after the stop wait");
                        leftPerStore.merge(sourceName, 1, Integer::sum);
                        continue;
                    }
                    if (skipsStore(etlitem)) {
                        logger.error("Not consolidating " + pvName + " from " + sourceName + " at shutdown: "
                                + SKIP_ETL_FOR_STORE_ENV + " names its destination");
                        leftPerStore.merge(sourceName, 1, Integer::sum);
                        continue;
                    }
                    logger.debug("Need to consolidate data from etl source " + sourceName + " for pv " + pvName
                            + " for storage " + ((StorageMetrics) etlitem.getETLDest()).getName());
                    new ETLJob(etlitem, oneYearLater()).run();
                } catch (Throwable t) {
                    logger.error("Error when consolidating data on shutdown for pv " + pvName, t);
                }
            }
        }
        for (Map.Entry<String, Integer> left : leftPerStore.entrySet()) {
            logger.error(left.getValue() + " PVs left unconsolidated in store " + left.getKey() + " at shutdown");
        }
    }

    private void waitForRunningPasses(long boundSeconds) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(boundSeconds);
        for (ETLPassDriver driver : ticker.getDrivers()) {
            Future<ETLPassRecord> pass = driver.getCurrentPass();
            if (pass == null) {
                continue;
            }
            long remaining = deadline - System.nanoTime();
            if (remaining <= 0) {
                continue;
            }
            try {
                pass.get(remaining, TimeUnit.NANOSECONDS);
            } catch (TimeoutException ex) {
                logger.warn("A pass of " + driver + " is still running after the stop wait");
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                return;
            } catch (ExecutionException ex) {
                logger.error("A pass of " + driver + " ended with an exception", ex);
            }
        }
    }

    private static final class ETLShutdownThread implements Runnable {
        private PBThreeTierETLPVLookup theLookup = null;

        public ETLShutdownThread(PBThreeTierETLPVLookup theLookup) {
            this.theLookup = theLookup;
        }

        @Override
        public void run() {
            theLookup.shutdown();
        }
    }

    public ETLMetrics getApplianceMetrics() {
        return applianceMetrics;
    }

    /**
     * Some unit tests want to run the ETL jobs manually; stop the ticker and the workers, and keep them stopped
     * so that a driver created later stays idle.
     */
    public void manualControlForUnitTests() {
        logger.error("Shutting down ETL for unit tests...");
        ticker.stop();
        if (tickerThread != null) {
            tickerThread.shutdownNow();
        }
        for (ExecutorService worker : workers.values()) {
            worker.shutdownNow();
        }
        workersStopped = true;
    }

    /**
     * The out of space handling named by the installation property; a value that names no OutOfSpaceHandling
     * constant is replaced by the default with an ERROR line naming the value.
     */
    public static OutOfSpaceHandling determineOutOfSpaceHandling(ConfigService configService) {
        String value = configService
                .getInstallationProperties()
                .getProperty(OUT_OF_SPACE_HANDLING_PROPERTY, DEFAULT_OUT_OF_SPACE_HANDLING.toString());
        try {
            return OutOfSpaceHandling.valueOf(value);
        } catch (IllegalArgumentException ex) {
            logger.error(OUT_OF_SPACE_HANDLING_PROPERTY + " is " + value + ", which names no OutOfSpaceHandling; "
                    + "the default " + DEFAULT_OUT_OF_SPACE_HANDLING + " is used");
            return DEFAULT_OUT_OF_SPACE_HANDLING;
        }
    }

    /** Reads the out of space handling on the first call and returns the same value for every later PV. */
    private synchronized OutOfSpaceHandling readOutOfSpaceHandling() {
        if (outOfSpaceHandling == null) {
            outOfSpaceHandling = determineOutOfSpaceHandling(configService);
        }
        return outOfSpaceHandling;
    }

    public void addETLJobsForUnitTests(String pvName, PVTypeInfo typeInfo) {
        logger.warn("addETLJobsForUnitTests This message should only be called from the unit tests.");
        addETLJobs(pvName, typeInfo);
    }
}
