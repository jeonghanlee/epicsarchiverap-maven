package org.epics.archiverappliance.engine.test;

import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.common.POJOEvent;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.engine.ArchiveEngine;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.engine.model.SampleBuffer;
import org.epics.archiverappliance.engine.pv.PVMetrics;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * What the sample buffer keeps and what it counts when more samples arrive between two writes than it has slots, and
 * when the buffer is swapped for the write: the numbers that the figures of the sample buffer section of the manual state.
 */
public class SampleBufferKeepsNewestTest {
    private static final ArchDBRTypes TYPE = ArchDBRTypes.DBR_SCALAR_DOUBLE;
    private static final Instant BASE = Instant.parse("2026-06-15T12:00:00Z");
    private static final String NAME = "SampleBufferKeepsNewest:pv";

    private PVMetrics metrics;
    private SampleBuffer buffer;
    private int capacity;

    @BeforeEach
    void createBuffer() {
        capacity = ArchiveEngine.computeBufferCapacity(10.0, 1.0, 1.0);
        metrics = new PVMetrics(NAME, null, -1, TYPE);
        buffer = new SampleBuffer(NAME, capacity, TYPE, metrics);
    }

    private boolean add(int index) {
        return buffer.add(new POJOEvent(TYPE, BASE.plusSeconds(index), new ScalarValue<Double>((double) index), 0, 0));
    }

    private static List<Integer> values(ArrayListEventStream stream) {
        List<Integer> values = new ArrayList<>();
        for (Event event : stream) {
            values.add(event.getSampleValue().getValue().intValue());
        }
        return values;
    }

    @Test
    public void twentySamplesIntoElevenSlotsKeepTheNewestElevenAndCountNineLosses() {
        Assertions.assertEquals(11, capacity, "a 1.0 s PV with a write period of 10 s and a margin of 1 s");
        for (int i = 0; i < capacity; i++) {
            Assertions.assertTrue(add(i), "a sample that fits is accepted");
        }
        for (int i = capacity; i < 20; i++) {
            Assertions.assertFalse(add(i), "a sample that finds the buffer full pushes out the oldest one");
        }
        Assertions.assertEquals(9, metrics.getSampleBufferFullLostEventCount());
        List<Integer> kept = values(buffer.getCurrentSamples());
        Assertions.assertEquals(11, kept.size());
        Assertions.assertEquals(9, kept.get(0), "the oldest kept sample is the tenth to arrive");
        Assertions.assertEquals(19, kept.get(kept.size() - 1), "the newest sample is kept");
    }

    @Test
    public void emptyBufferIsNotSwappedForTheWrite() {
        Assertions.assertNull(buffer.samplesToWrite(), "a buffer without samples gives nothing to write");
        Assertions.assertFalse(buffer.hasPendingWrite());
    }

    @Test
    public void failedWriteRetriesTheSameBatchWhileNewSamplesFillTheNewBuffer() {
        for (int i = 0; i < 3; i++) {
            add(i);
        }
        ArrayListEventStream first = buffer.samplesToWrite();
        Assertions.assertEquals(List.of(0, 1, 2), values(first));
        Assertions.assertTrue(buffer.hasPendingWrite());
        add(3);
        Assertions.assertSame(first, buffer.samplesToWrite(), "until the write is acknowledged the same batch is returned");
        Assertions.assertEquals(List.of(3), values(buffer.getCurrentSamples()), "new samples go to the new buffer");
        buffer.samplesWritten();
        Assertions.assertFalse(buffer.hasPendingWrite());
        Assertions.assertEquals(List.of(3), values(buffer.samplesToWrite()), "after the acknowledgement the next batch is swapped in");
    }
}
