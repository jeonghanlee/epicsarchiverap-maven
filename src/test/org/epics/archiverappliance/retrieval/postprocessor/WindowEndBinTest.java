package org.epics.archiverappliance.retrieval.postprocessor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import org.junit.jupiter.api.Test;

/**
 * The choice of the bin for the window-end tests: every second of a year, and a step of a minute over twelve years, gets a
 * bin whose midpoint lies after the window end with margin and whose start lies before the samples written just before the
 * end. The sizes that the tests used before fail some minutes of every month; those minutes now take the computed size.
 */
public class WindowEndBinTest {
    private static final long YEAR_START = Instant.parse("2026-01-01T00:00:00Z").getEpochSecond();
    private static final long YEAR_END = Instant.parse("2027-01-01T00:00:00Z").getEpochSecond();
    private static final long TWELVE_YEARS_END = Instant.parse("2038-01-01T00:00:00Z").getEpochSecond();

    private static void assertFits(long end) {
        long bin = WindowEndBin.forEnd(end);
        assertTrue(bin > 0 && bin <= WindowEndBin.LARGEST, "size " + bin + " at " + end);
        assertTrue(WindowEndBin.fits(end, bin), "size " + bin + " does not fit the end " + end);
        long midpoint = end / bin * bin + bin / 2;
        assertTrue(midpoint - end >= WindowEndBin.MARGIN_SECONDS, "the midpoint of " + bin + " is too near the end " + end);
        assertTrue(end - end / bin * bin >= WindowEndBin.SAMPLE_SPAN_SECONDS, "the bin " + bin + " starts too near the end " + end);
    }

    @Test
    public void everySecondOfAYearGetsAFittingBin() {
        long computed = 0;
        for (long end = YEAR_START; end < YEAR_END; end++) {
            assertFits(end);
            if (WindowEndBin.needsComputedSize(end)) {
                computed++;
            }
        }
        assertTrue(computed > 0, "the computed size is used at some seconds of the year");
        assertTrue(computed < (YEAR_END - YEAR_START) / 20, "the usual sizes fit most seconds: computed " + computed);
    }

    @Test
    public void everyMinuteOfTwelveYearsGetsAFittingBin() {
        for (long end = YEAR_START; end < TWELVE_YEARS_END; end += 61) {
            assertFits(end);
        }
    }

    @Test
    public void aUsualSizeIsKeptWhenOneFitsAndTheComputedSizeIsLargerThanAnyOfThem() {
        long largestUsual = java.util.Arrays.stream(WindowEndBin.USUAL_BINS).max().getAsLong();
        for (long end = YEAR_START; end < YEAR_START + 40L * 86400; end += 7) {
            long bin = WindowEndBin.forEnd(end);
            boolean usual = java.util.Arrays.stream(WindowEndBin.USUAL_BINS).anyMatch(size -> size == bin);
            assertEquals(!WindowEndBin.needsComputedSize(end), usual, "the size " + bin + " at " + end);
            if (!usual) {
                assertTrue(bin > largestUsual, "the computed size " + bin + " is larger than the usual sizes");
            }
        }
    }
}
