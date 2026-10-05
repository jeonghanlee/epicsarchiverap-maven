package org.epics.archiverappliance.etl.common;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.StoragePlugin;
import org.epics.archiverappliance.common.PartitionGranularity;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentSkipListMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.function.Function;

/**
 * Runs the ETL passes of one (transition index, cadence): the jobs of every PV of the driver, one after another,
 * on the worker thread of the transition index, fired on a fixed grid.
 * <p>
 * The grid is the epoch plus whole multiples of the cadence plus the offset of the transition index. A pass starts
 * when a tick finds the driver clock at or past the next planned firing time and no pass of the driver running; the
 * start-up pass is armed by {@link #start()} and started by the next tick. The processing time of a pass is its start
 * time minus the processing margin and is given to every job of the pass. The next planned firing time is the earliest
 * grid time later than both the planned time and the end of the last pass; when the clock reads earlier than the
 * start of the last pass, it is the earliest grid time later than the clock.
 * <p>
 * Every job runs under its own catch, and the pass record is closed and the next firing computed in a finally block,
 * so a failed job never leaves the driver without a next firing. Tasks queued with {@link #enqueueIfRunning} while a
 * pass runs (the consolidation of a paused or deleted PV) run on the worker thread between two jobs of the pass.
 */
public final class ETLPassDriver {
    private static final Logger logger = LogManager.getLogger(ETLPassDriver.class.getName());

    /** Seconds between the start of a pass and the processing time it gives its jobs. */
    public static final long PROCESSING_MARGIN_SECONDS = 60;

    /** Longest cadence; a source partition longer than this is visited on an 8-hour grid. */
    public static final long MAX_CADENCE_SECONDS = 8L * 60 * 60;

    /** Offset of the grid of transition index 0; transition index t uses (t + 1) times this. */
    public static final long OFFSET_STEP_SECONDS = 5L * 60;

    /** The leading phrase of the one ERROR a pass writes for each pair of stores that failed to take partitions. */
    public static final String FAILED_PASS_PHRASE = "ETL pass failed to move partitions";

    private static final long SECONDS_PER_DAY = 24L * 60 * 60;
    private static final int WEEKLY_DAYS = 7;

    private final int transitionIndex;
    private final long cadenceSeconds;
    private final long offsetSeconds;
    private final Clock clock;
    private final Function<String, String> environmentReader;
    private final ExecutorService worker;
    private final ConcurrentSkipListMap<String, ETLPVLookupItems> pvs = new ConcurrentSkipListMap<>();

    private boolean started = false;
    private boolean armed = false;
    private Instant armedAt = null;
    private boolean running = false;
    private Future<ETLPassRecord> currentPass = null;
    private String currentJobPv = null;
    private final ArrayDeque<Runnable> betweenJobs = new ArrayDeque<>();
    private volatile boolean stopped = false;
    private Instant nextPlannedAt = null;
    private ETLPassRecord lastCompleted = null;
    private Progress inProgress = null;
    private long completedPasses = 0;
    private long busyMillisTotal = 0;
    private final TreeMap<Long, Long> busyMillisPerEpochDay = new TreeMap<>();

    /**
     * @param transitionIndex   the lifetime transition, 0 for STS to MTS
     * @param cadenceSeconds    the interval between planned firings
     * @param clock             the clock every time of the pass is read from
     * @param environmentReader resolves ARCHAPPL_SKIP_ETL_FOR_STORE; production passes System::getenv
     * @param worker            the single worker thread of the transition index, shared by its drivers
     */
    public ETLPassDriver(
            int transitionIndex,
            long cadenceSeconds,
            Clock clock,
            Function<String, String> environmentReader,
            ExecutorService worker) {
        this.transitionIndex = transitionIndex;
        this.cadenceSeconds = cadenceSeconds;
        this.offsetSeconds = OFFSET_STEP_SECONDS * (transitionIndex + 1);
        this.clock = clock;
        this.environmentReader = environmentReader;
        this.worker = worker;
    }

    /** The cadence for a source partition: the partition length, at most 8 hours. */
    public static long cadenceFor(PartitionGranularity sourceGranularity) {
        return Math.min(sourceGranularity.getApproxSecondsPerChunk(), MAX_CADENCE_SECONDS);
    }

    /** The earliest grid time strictly later than the given time. */
    public Instant nextGridAfter(Instant time) {
        long k = Math.floorDiv(time.getEpochSecond() - offsetSeconds, cadenceSeconds) + 1;
        return Instant.ofEpochSecond(k * cadenceSeconds + offsetSeconds);
    }

    public int getTransitionIndex() {
        return transitionIndex;
    }

    public long getCadenceSeconds() {
        return cadenceSeconds;
    }

    public void addPV(ETLPVLookupItems item) {
        pvs.put(item.getPvName(), item);
    }

    public void removePV(String pvName) {
        pvs.remove(pvName);
    }

    public boolean hasPV(String pvName) {
        return pvs.containsKey(pvName);
    }

    /**
     * Starts the driver; later calls do nothing. A driver holding at least one PV arms its start-up pass, planned at
     * the clock's instant, for the next tick; a driver without PVs waits for its next grid time.
     */
    public synchronized void start() {
        if (started) {
            return;
        }
        started = true;
        if (!pvs.isEmpty()) {
            armed = true;
            armedAt = clock.instant();
        } else {
            nextPlannedAt = nextGridAfter(clock.instant());
        }
    }

    /** Sets the stop flag: a running pass starts no job after it, and no later tick starts a pass. */
    public void stop() {
        stopped = true;
    }

    /**
     * Starts a pass when one is due and none of this driver is running, and hands it to the worker thread.
     *
     * @param now the time of the tick, read from the ticker's clock
     * @return a future that completes when the pass record is closed, or null when no pass starts
     */
    public synchronized Future<ETLPassRecord> tick(Instant now) {
        if (!started || stopped || running) {
            return null;
        }
        if (!armed) {
            if (lastCompleted != null && now.isBefore(lastCompleted.startedAt())) {
                nextPlannedAt = nextGridAfter(now);
                return null;
            }
            if (nextPlannedAt == null || now.isBefore(nextPlannedAt)) {
                return null;
            }
        }
        Instant planned = armed ? armedAt : nextPlannedAt;
        armed = false;
        running = true;
        currentPass = worker.submit(() -> runPass(planned));
        return currentPass;
    }

    /** The future of the running pass, or null when none runs. */
    public synchronized Future<ETLPassRecord> getCurrentPass() {
        return running ? currentPass : null;
    }

    /** The PV whose job the running pass is executing, or null between jobs and when no pass runs. */
    public synchronized String getCurrentJobPv() {
        return currentJobPv;
    }

    /**
     * Queues a task to run on the worker thread between two jobs of the running pass.
     *
     * @return false, and the task is not queued, when no pass runs; the caller then runs it elsewhere
     */
    public synchronized boolean enqueueIfRunning(Runnable task) {
        if (!running) {
            return false;
        }
        betweenJobs.add(task);
        return true;
    }

    /** Removes and returns every task still queued for the running pass. */
    public synchronized List<Runnable> takeQueued() {
        List<Runnable> tasks = new ArrayList<>(betweenJobs);
        betweenJobs.clear();
        return tasks;
    }

    private void runQueued() {
        for (Runnable task : takeQueued()) {
            try {
                task.run();
            } catch (Throwable t) {
                logger.error("Exception in a task queued between ETL jobs of " + this, t);
            }
        }
    }

    public synchronized boolean isRunning() {
        return running;
    }

    public synchronized Instant getNextPlannedAt() {
        return nextPlannedAt;
    }

    public synchronized ETLPassRecord getLastCompleted() {
        return lastCompleted;
    }

    /** The pass in progress as a record with endedAt null, or null when no pass runs. */
    public synchronized ETLPassRecord getInProgress() {
        return inProgress == null ? null : inProgress.toRecord(null, false, cadenceSeconds);
    }

    public synchronized long getCompletedPasses() {
        return completedPasses;
    }

    public synchronized long getBusyMillisTotal() {
        return busyMillisTotal;
    }

    /**
     * Busy time over the counted days of the last seven, as a percent of the seconds from the start of the first
     * counted day to the given time; the current day is partial.
     */
    public synchronized double getWeeklyUsagePercent(Instant now) {
        long today = Math.floorDiv(now.getEpochSecond(), SECONDS_PER_DAY);
        busyMillisPerEpochDay.headMap(today - (WEEKLY_DAYS - 1)).clear();
        if (busyMillisPerEpochDay.isEmpty()) {
            return 0.0;
        }
        long seconds = now.getEpochSecond() - busyMillisPerEpochDay.firstKey() * SECONDS_PER_DAY;
        if (seconds <= 0) {
            return 0.0;
        }
        long totalMillis = 0;
        for (long millis : busyMillisPerEpochDay.values()) {
            totalMillis += millis;
        }
        return (totalMillis * 100.0) / (seconds * 1000.0);
    }

    private ETLPassRecord runPass(Instant planned) {
        Instant startedAt = clock.instant();
        Instant processingTime = startedAt.minusSeconds(PROCESSING_MARGIN_SECONDS);
        List<String> snapshot = new ArrayList<>(pvs.keySet());
        Progress progress = new Progress(planned, startedAt, processingTime, snapshot.size());
        synchronized (this) {
            inProgress = progress;
        }
        ETLPassRecord record = null;
        try {
            for (String pvName : snapshot) {
                if (stopped) {
                    synchronized (this) {
                        progress.aborted = true;
                    }
                    break;
                }
                runQueued();
                ETLPVLookupItems item = pvs.get(pvName);
                if (item == null) {
                    synchronized (this) {
                        progress.skip(pvName);
                    }
                    continue;
                }
                String skipStore = environmentReader.apply(PBThreeTierETLPVLookup.SKIP_ETL_FOR_STORE_ENV);
                if (skipStore != null
                        && item.getETLDest() instanceof StoragePlugin dest
                        && skipStore.equals(dest.getName())) {
                    logger.error("Skipping ETL for " + pvName + " into store " + skipStore + " as "
                            + PBThreeTierETLPVLookup.SKIP_ETL_FOR_STORE_ENV + " names it");
                    synchronized (this) {
                        progress.skip(pvName);
                    }
                    continue;
                }
                runJob(item, processingTime, progress);
            }
        } finally {
            Instant endedAt = clock.instant();
            boolean overrun = endedAt.isAfter(nextGridAfter(planned));
            Instant after = planned.isAfter(endedAt) ? planned : endedAt;
            List<Runnable> leftover;
            List<String> failureLines;
            synchronized (this) {
                failureLines = progress.failureMessages(transitionIndex, cadenceSeconds);
                record = progress.toRecord(endedAt, overrun, cadenceSeconds);
                lastCompleted = record;
                inProgress = null;
                running = false;
                currentPass = null;
                leftover = new ArrayList<>(betweenJobs);
                betweenJobs.clear();
                completedPasses++;
                busyMillisTotal += record.busyMillis();
                long day = Math.floorDiv(startedAt.getEpochSecond(), SECONDS_PER_DAY);
                busyMillisPerEpochDay.merge(day, record.busyMillis(), Long::sum);
                nextPlannedAt = nextGridAfter(after);
            }
            logger.debug("ETL pass of transition " + transitionIndex + " cadence " + cadenceSeconds + " s: " + record);
            for (String failure : failureLines) {
                logger.error(failure);
            }
            for (Runnable task : leftover) {
                try {
                    task.run();
                } catch (Throwable t) {
                    logger.error("Exception in a task queued between ETL jobs of " + this, t);
                }
            }
        }
        return record;
    }

    private void runJob(ETLPVLookupItems item, Instant processingTime, Progress progress) {
        ETLJob job = new ETLJob(item, processingTime, true);
        synchronized (this) {
            currentJobPv = item.getPvName();
        }
        long start = System.nanoTime();
        boolean aborted = false;
        try {
            job.run();
        } catch (Throwable t) {
            aborted = true;
            logger.error("ETL job for " + item + " let a Throwable escape", t);
        }
        long millis = (System.nanoTime() - start) / 1_000_000;
        synchronized (this) {
            currentJobPv = null;
            progress.addJob(item.getPvName(), millis, item.getLastRunReport(), job.getExceptionFromLastRun(), aborted);
            progress.addFailedPartitions(item, item.getLastRunReport());
        }
    }

    /** The name of a store for the logs: the plugin name when the store has one, else its description. */
    static String storeName(Object store) {
        return store instanceof StoragePlugin plugin ? plugin.getName() : String.valueOf(store);
    }

    /** What failed in one pass for one pair of stores. */
    private static final class FailedStores {
        final String source;
        final String destination;
        final String firstPv;
        final String firstFailure;
        int partitions;
        int pvs;

        FailedStores(String source, String destination, String firstPv, String firstFailure) {
            this.source = source;
            this.destination = destination;
            this.firstPv = firstPv;
            this.firstFailure = firstFailure;
        }
    }

    /** Accumulates one pass while it runs; read and written under the driver's lock. */
    private static final class Progress {
        final Instant plannedAt;
        final Instant startedAt;
        final Instant processingTime;
        final int pvCount;
        int jobsRun;
        int jobsFailed;
        int jobsAborted;
        int streamsReturned;
        int partitionsMoved;
        long bytesMoved;
        int streamsDeletedForSpace;
        long busyMillis;
        String slowestPv;
        long slowestMillis;
        int maxPartitionsMovedByOnePv;
        boolean aborted;
        final List<String> skippedPvs = new ArrayList<>();
        final Map<String, FailedStores> failedStores = new LinkedHashMap<>();

        Progress(Instant plannedAt, Instant startedAt, Instant processingTime, int pvCount) {
            this.plannedAt = plannedAt;
            this.startedAt = startedAt;
            this.processingTime = processingTime;
            this.pvCount = pvCount;
        }

        void skip(String pvName) {
            skippedPvs.add(pvName);
        }

        void addJob(String pvName, long millis, ETLRunReport report, Exception exception, boolean escaped) {
            jobsRun++;
            busyMillis += millis;
            if (slowestPv == null || millis > slowestMillis) {
                slowestPv = pvName;
                slowestMillis = millis;
            }
            if (report != null) {
                streamsReturned += report.streamsReturned();
                partitionsMoved += report.partitionsMoved();
                bytesMoved += report.bytesMoved();
                streamsDeletedForSpace += report.streamsDeletedForSpace();
                maxPartitionsMovedByOnePv = Math.max(maxPartitionsMovedByOnePv, report.partitionsMoved());
            }
            boolean failed = escaped
                    || exception != null
                    || report == null
                    || !report.streamsCompleted()
                    || report.streamsReturned() > report.partitionsMoved() + report.streamsDeletedForSpace()
                    || (report.commitAttempted() && !report.commitSucceeded());
            if (failed) {
                jobsFailed++;
            }
            if (escaped) {
                jobsAborted++;
            }
        }

        /** Adds the partitions the job could not append to the pair of stores of its lookup item. */
        void addFailedPartitions(ETLPVLookupItems item, ETLRunReport report) {
            if (report == null || report.partitionsFailed() == 0) {
                return;
            }
            String source = storeName(item.getETLSource());
            String destination = storeName(item.getETLDest());
            FailedStores failed = failedStores.computeIfAbsent(
                    source + "\n" + destination,
                    key -> new FailedStores(source, destination, item.getPvName(), report.firstFailure()));
            failed.partitions += report.partitionsFailed();
            failed.pvs++;
        }

        /** One line per pair of stores that failed in the pass, each starting with the same fixed phrase. */
        List<String> failureMessages(int transitionIndex, long cadenceSeconds) {
            List<String> lines = new ArrayList<>();
            for (FailedStores failed : failedStores.values()) {
                lines.add(FAILED_PASS_PHRASE + ": transition=" + transitionIndex + " source=" + failed.source
                        + " destination=" + failed.destination + " cadence=" + cadenceSeconds + " plannedAt="
                        + plannedAt + " failedPartitions=" + failed.partitions + " affectedPVs=" + failed.pvs
                        + " firstPV=" + failed.firstPv + " firstError="
                        + String.valueOf(failed.firstFailure).replaceAll("\\s+", " "));
            }
            return lines;
        }

        ETLPassRecord toRecord(Instant endedAt, boolean overrun, long cadenceSeconds) {
            long late = startedAt.getEpochSecond() - plannedAt.getEpochSecond();
            return new ETLPassRecord(
                    plannedAt,
                    startedAt,
                    endedAt,
                    late > cadenceSeconds ? late : 0,
                    processingTime,
                    pvCount,
                    jobsRun,
                    jobsFailed,
                    jobsAborted,
                    skippedPvs.size(),
                    streamsReturned,
                    partitionsMoved,
                    bytesMoved,
                    streamsDeletedForSpace,
                    busyMillis,
                    slowestPv,
                    slowestMillis,
                    maxPartitionsMovedByOnePv,
                    overrun,
                    aborted,
                    List.copyOf(skippedPvs));
        }
    }

    @Override
    public String toString() {
        return "ETLPassDriver(transition " + transitionIndex + ", cadence " + cadenceSeconds + " s, " + pvs.size()
                + " PVs)";
    }

    /** The PV names of the driver, in pass order. */
    public List<String> getPVNames() {
        return new ArrayList<>(pvs.keySet());
    }

    /** The lookup items of the driver by PV name. */
    public Map<String, ETLPVLookupItems> getLookupItems() {
        return Collections.unmodifiableMap(pvs);
    }
}
