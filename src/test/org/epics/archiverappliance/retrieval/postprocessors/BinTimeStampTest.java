package org.epics.archiverappliance.retrieval.postprocessors;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.common.POJOEvent;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.epics.archiverappliance.retrieval.postprocessors.SummaryStatsPostProcessor.SummaryValue;
import org.junit.jupiter.api.Test;

/**
 * The time stamp of the event of a bin: the midpoint, except for the bin that holds samples and contains the end of the
 * request window when its midpoint lies after that end. The collectors are run with real values; nothing is replaced.
 */
public class BinTimeStampTest {
    /** Bin 10 of 100 s runs from 1000 s to 1100 s; its midpoint is 1050 s. */
    private static final int INTERVAL = 100;

    private static Instant at(long seconds) {
        return Instant.ofEpochSecond(seconds);
    }

    @Test
    public void theBinThatContainsTheEndAndHoldsSamplesIsStampedAtTheEndWhenItsMidpointIsAfterIt() {
        assertEquals(at(1020), BinTimeStamp.of(10, INTERVAL, 0, true, at(1020)));
    }

    @Test
    public void aMidpointThatIsNotAfterTheEndStaysTheMidpoint() {
        assertEquals(at(1050), BinTimeStamp.of(10, INTERVAL, 0, true, at(1050)));
        assertEquals(at(1050), BinTimeStamp.of(10, INTERVAL, 0, true, at(1099)));
    }

    @Test
    public void aBinWithoutSamplesOrAnotherBinOrAnUnknownEndKeepsTheMidpoint() {
        assertEquals(at(1050), BinTimeStamp.of(10, INTERVAL, 0, false, at(1020)));
        assertEquals(at(1150), BinTimeStamp.of(11, INTERVAL, 0, true, at(1020)));
        assertEquals(at(950), BinTimeStamp.of(9, INTERVAL, 0, true, at(1020)));
        assertEquals(at(1050), BinTimeStamp.of(10, INTERVAL, 0, true, null));
        assertEquals(at(1050), BinTimeStamp.of(10, INTERVAL, 0, true, Instant.MAX));
    }

    @Test
    public void anOddIntervalKeepsItsHalfSecond() {
        // Bin 10 of 101 s runs from 1010 s to 1111 s; its midpoint is 1060.5 s.
        assertEquals(Instant.ofEpochSecond(1060, 500_000_000), BinTimeStamp.of(10, 101, 500_000_000, true, at(1100)));
        assertEquals(at(1030), BinTimeStamp.of(10, 101, 500_000_000, true, at(1030)));
    }

    private static List<Instant> summaryStamps(Instant windowEnd, Long... binsWithSamples) throws Exception {
        LinkedHashMap<Long, SummaryValue> data = new LinkedHashMap<>();
        for (long bin : binsWithSamples) data.put(bin, new SummaryValue(1.5, 0, false));
        RemotableEventStreamDesc desc = new RemotableEventStreamDesc(ArchDBRTypes.DBR_SCALAR_DOUBLE, "PV", (short) 1970);
        List<Instant> stamps = new ArrayList<>();
        try (SummaryStatsCollectorEventStream stream =
                new SummaryStatsCollectorEventStream(9, 11, INTERVAL, desc, data, true, false, false, 1, windowEnd)) {
            for (Event event : stream) stamps.add(event.getEventTimeStamp());
        }
        return stamps;
    }

    @Test
    public void theSummaryCollectorStampsTheEventOfTheLastBinAtTheEnd() throws Exception {
        // Bin 10 holds the samples, bin 11 only repeats its value; the window ends inside bin 10 before its midpoint.
        assertEquals(List.of(at(1020), at(1150)), summaryStamps(at(1020), 10L));
    }

    @Test
    public void theSummaryCollectorKeepsTheMidpointsWithoutAnEndOrWhenTheEndIsLater() throws Exception {
        assertEquals(List.of(at(1050), at(1150)), summaryStamps(null, 10L));
        assertEquals(List.of(at(1050), at(1150)), summaryStamps(at(1099), 10L));
    }

    @Test
    public void theSummaryCollectorDoesNotStampARepeatedValueAtTheEnd() throws Exception {
        // The window ends inside bin 11, which holds no samples of its own: its event keeps its midpoint.
        assertEquals(List.of(at(1050), at(1150)), summaryStamps(at(1120), 10L));
    }

    private static List<Instant> fillStamps(Instant windowEnd) throws Exception {
        LinkedHashMap<Long, Event> data = new LinkedHashMap<>();
        data.put(10L, new POJOEvent(ArchDBRTypes.DBR_SCALAR_DOUBLE, at(1005), new ScalarValue<Double>(2.5), 0, 0));
        RemotableEventStreamDesc desc = new RemotableEventStreamDesc(ArchDBRTypes.DBR_SCALAR_DOUBLE, "PV", (short) 1970);
        List<Instant> stamps = new ArrayList<>();
        try (FillsCollectorEventStream stream =
                new FillsCollectorEventStream(9, 10, INTERVAL, desc, data, true, windowEnd)) {
            for (Event event : stream) stamps.add(event.getEventTimeStamp());
        }
        return stamps;
    }

    @Test
    public void theFillsCollectorStampsTheEventOfTheLastBinAtTheEnd() throws Exception {
        assertEquals(List.of(at(1020)), fillStamps(at(1020)));
        assertEquals(List.of(at(1050)), fillStamps(at(1099)));
        assertEquals(List.of(at(1050)), fillStamps(null));
    }
}
