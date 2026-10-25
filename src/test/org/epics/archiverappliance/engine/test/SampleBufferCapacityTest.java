package org.epics.archiverappliance.engine.test;

import org.epics.archiverappliance.engine.ArchiveEngine;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

/**
 * The sample buffer capacity of a PV is the samples expected within one write period plus a margin
 * expressed in seconds, so the time a buffer tolerates a late write pass does not depend on the
 * sampling period. Sampling periods enter the engine as float, so the cases below take the same path.
 */
public class SampleBufferCapacityTest {
    private static final double WRITE_PERIOD = 10.0;
    private static final double MARGIN = 1.0;

    @Test
    public void marginIsOneSecondAtEverySamplingPeriod() {
        Assertions.assertEquals(110, ArchiveEngine.computeBufferCapacity(WRITE_PERIOD, 0.1F, MARGIN));
        Assertions.assertEquals(11, ArchiveEngine.computeBufferCapacity(WRITE_PERIOD, 1.0F, MARGIN));
        Assertions.assertEquals(2, ArchiveEngine.computeBufferCapacity(WRITE_PERIOD, 10.0F, MARGIN));
    }

    @Test
    public void marginRoundsUpToWholeSamples() {
        Assertions.assertEquals(33 + 4, ArchiveEngine.computeBufferCapacity(WRITE_PERIOD, 0.3F, MARGIN));
        Assertions.assertEquals(20 + 2, ArchiveEngine.computeBufferCapacity(WRITE_PERIOD, 0.5F, MARGIN));
    }

    @Test
    public void marginIsNeverBelowOneSample() {
        Assertions.assertEquals(101, ArchiveEngine.computeBufferCapacity(WRITE_PERIOD, 0.1F, 0.0));
        Assertions.assertEquals(2, ArchiveEngine.computeBufferCapacity(WRITE_PERIOD, 60.0F, MARGIN));
    }

    @Test
    public void writePeriodScalesTheExpectedSamplesOnly() {
        Assertions.assertEquals(20 + 10, ArchiveEngine.computeBufferCapacity(2.0, 0.1F, MARGIN));
        Assertions.assertEquals(2 + 1, ArchiveEngine.computeBufferCapacity(2.0, 1.0F, MARGIN));
    }
}
