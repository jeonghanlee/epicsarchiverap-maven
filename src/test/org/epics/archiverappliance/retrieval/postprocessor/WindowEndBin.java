package org.epics.archiverappliance.retrieval.postprocessor;

/**
 * The bin size, in seconds, for which the bin that holds the end of a request window has its midpoint after that end and
 * holds samples written just before it. The usual sizes are tried first. When none of them fits the time of the day, a
 * size between half the end and the end is used: the first bin after the epoch then holds the window end, and its
 * midpoint lies far after it.
 */
final class WindowEndBin {
    /** Bin sizes tried first: days and half or quarter days, in the order the test has always tried them. */
    static final long[] USUAL_BINS = {432000, 345600, 259200, 604800, 172800, 86400, 43200, 21600};
    /** The seconds by which the midpoint lies after the end, so the clock cannot carry the end past it during a run. */
    static final long MARGIN_SECONDS = 600;
    /** The seconds the window end lies after the start of its bin, so that the samples written just before it are in that bin. */
    static final long SAMPLE_SPAN_SECONDS = 60;
    /** The largest bin size an operator accepts. */
    static final long LARGEST = Integer.MAX_VALUE;

    private WindowEndBin() {}

    /** Whether the bin of this size has the properties above for a window that ends at the given epoch second. */
    static boolean fits(long endSeconds, long bin) {
        long intoBin = endSeconds % bin;
        return intoBin >= SAMPLE_SPAN_SECONDS && intoBin < bin / 2 - MARGIN_SECONDS;
    }

    /** True when the usual sizes do not fit and the computed size is used. */
    static boolean needsComputedSize(long endSeconds) {
        for (long bin : USUAL_BINS) {
            if (fits(endSeconds, bin)) {
                return false;
            }
        }
        return true;
    }

    static long forEnd(long endSeconds) {
        for (long bin : USUAL_BINS) {
            if (fits(endSeconds, bin)) {
                return bin;
            }
        }
        long bin = endSeconds / 6 * 5;
        if (bin > LARGEST || !fits(endSeconds, bin)) {
            throw new IllegalStateException("No bin size fits a window that ends at epoch second " + endSeconds);
        }
        return bin;
    }
}
