package org.epics.archiverappliance.etl.common;

/**
 * What one ETL job did for one PV and one lifetime transition.
 * The job fills it in whatever way it ends, including when the source cannot list its streams.
 *
 * @param streamsCompleted       the source listed its streams for the processing time without an exception
 * @param streamsReturned        the count of streams the source returned
 * @param partitionsMoved        the count of streams appended to the destination and committed
 * @param bytesMoved             the source size of the moved streams
 * @param streamsDeletedForSpace the count of streams deleted without a move under the out-of-space handling,
 *                               counted only when the commit succeeded, since only then are they marked for deletion
 * @param commitAttempted        the job reached the commit of the destination
 * @param commitSucceeded        the commit returned success without an exception
 * @param partitionsFailed       the count of streams whose append to the destination threw an exception
 * @param firstFailure           the exception class and message of the first such stream, or null when none failed
 */
public record ETLRunReport(
        boolean streamsCompleted,
        int streamsReturned,
        int partitionsMoved,
        long bytesMoved,
        int streamsDeletedForSpace,
        boolean commitAttempted,
        boolean commitSucceeded,
        int partitionsFailed,
        String firstFailure) {}
