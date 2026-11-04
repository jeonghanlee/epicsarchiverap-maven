package org.epics.archiverappliance.retrieval.postprocessors;

import java.time.Instant;

import org.epics.archiverappliance.common.TimeUtils;

/**
 * The time stamp of the event of a bin. The event is stamped at the midpoint of the bin. The retrieval drops every event
 * stamped after the end of the request window, so a bin that holds samples inside the window and contains the window end
 * would be lost whenever its midpoint lies after that end. The event of such a bin is stamped at the window end instead,
 * so that it stays inside the window and the newest samples are not left out. A bin without samples of its own, which only repeats the
 * value of the previous bin, keeps its midpoint, and so do the bins after the one that contains the window end.
 */
final class BinTimeStamp {
	private BinTimeStamp() {}

	/**
	 * @param binNumber the number of the bin, the epoch seconds of its start divided by the interval
	 * @param intervalSecs the length of a bin in seconds
	 * @param nanos the nanoseconds of the midpoint, 500 ms for an odd interval
	 * @param binHasSamples true when the bin holds samples of its own
	 * @param windowEnd the end of the request window; null or {@link Instant#MAX} when it is not known
	 * @return the time stamp of the event of the bin
	 */
	static Instant of(long binNumber, int intervalSecs, int nanos, boolean binHasSamples, Instant windowEnd) {
		Instant midpoint = TimeUtils.convertFromEpochSeconds(binNumber * intervalSecs + intervalSecs / 2, nanos);
		if (binHasSamples
				&& windowEnd != null
				&& !Instant.MAX.equals(windowEnd)
				&& TimeUtils.convertToEpochSeconds(windowEnd) / intervalSecs == binNumber
				&& midpoint.isAfter(windowEnd)) {
			return windowEnd;
		}
		return midpoint;
	}
}
