package org.epics.archiverappliance.retrieval.pva;

import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.retrieval.RetrievalMemoryProtection;
import org.epics.archiverappliance.utils.simulation.SimulationEventStream;
import org.epics.archiverappliance.utils.simulation.SineGenerator;
import org.epics.pva.data.PVAAnyArray;
import org.epics.pva.data.PVAStringArray;
import org.epics.pva.data.PVAStructure;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class PvaMemoryProtectionTest {
    @Test void outputLoopStopsWithoutAnInputWrapper() throws Exception {
        var settings = new RetrievalMemoryProtection.Settings(.95, .85, .95, .01, 4,
                Duration.ofMillis(100), 112, 256, 176);
        var guard = new RetrievalMemoryProtection(settings);
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        var result = new PVAStructure("result", "NTComplexTable", new PVAStringArray("labels"), new PVAAnyArray("value"));
        try (var request = guard.begin(); var context = new BasicContext();
                var source = new SimulationEventStream(ArchDBRTypes.DBR_SCALAR_DOUBLE, new SineGenerator(0),
                        start, start.plusSeconds(20), 1);
                var consumer = new PvaMergeDedupConsumer(new PvaMimeResponse(), result)) {
            consumer.processingPV(context, "test", start, start.plusSeconds(20), source.getDescription());
            Thread.currentThread().interrupt();
            var stopped = assertThrows(RetrievalMemoryProtection.Rejected.class,
                    () -> consumer.consumeEventStream(source));
            assertTrue(stopped.getMessage().contains("interrupted"));
            assertTrue(consumer.totalEvents < 4);
        } finally { Thread.interrupted(); }
    }
}
