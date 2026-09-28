package org.epics.archiverappliance.etl.common;

import java.time.Instant;
import java.util.List;

/**
 * One ETL pass of one driver: the jobs of every PV of the driver, started by one firing.
 * Times read from the driver clock are plannedAt, startedAt, endedAt and processingTime; busyMillis and
 * slowestMillis are wall-clock job durations. endedAt is null for the pass in progress.
 *
 * @param plannedAt                 the planned firing time; the start time for a start-up pass
 * @param startedAt                 driver clock at the start of the pass
 * @param endedAt                   driver clock at the end of the pass, or null while it runs
 * @param lateSeconds               startedAt minus plannedAt when that exceeds one cadence, else 0
 * @param processingTime            startedAt minus the processing margin, given to every job of the pass
 * @param pvCount                   PVs in the snapshot taken at the start
 * @param jobsRun                   jobs run
 * @param jobsFailed                jobs that listed incompletely, left returned streams unmoved, failed the
 *                                  commit, recorded an exception, or let a Throwable escape
 * @param jobsAborted               jobs that let a Throwable escape
 * @param jobsSkipped               PVs skipped for the skip store or because they left the set
 * @param streamsReturned           streams the sources returned, summed over the jobs
 * @param partitionsMoved           streams appended and committed, summed over the jobs
 * @param bytesMoved                source bytes of the moved streams
 * @param streamsDeletedForSpace    streams deleted for lack of space
 * @param busyMillis                sum of the job durations
 * @param slowestPv                 the PV of the longest job, or null when no job ran
 * @param slowestMillis             the duration of the longest job
 * @param maxPartitionsMovedByOnePv the largest count of partitions one job moved
 * @param overrun                   endedAt is past the next grid time after plannedAt
 * @param aborted                   the stop flag ended the pass before every PV was visited
 * @param skippedPvs                the PVs counted in jobsSkipped
 */
public record ETLPassRecord(
        Instant plannedAt,
        Instant startedAt,
        Instant endedAt,
        long lateSeconds,
        Instant processingTime,
        int pvCount,
        int jobsRun,
        int jobsFailed,
        int jobsAborted,
        int jobsSkipped,
        int streamsReturned,
        int partitionsMoved,
        long bytesMoved,
        int streamsDeletedForSpace,
        long busyMillis,
        String slowestPv,
        long slowestMillis,
        int maxPartitionsMovedByOnePv,
        boolean overrun,
        boolean aborted,
        List<String> skippedPvs) {}
