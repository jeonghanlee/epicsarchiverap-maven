package org.epics.archiverappliance.retrieval.pva;

import com.sun.management.ThreadMXBean;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.epics.archiverappliance.data.SampleValue;
import org.epics.archiverappliance.utils.simulation.SimulationEventStream;
import org.epics.archiverappliance.utils.simulation.SineGenerator;
import org.epics.pva.data.PVAAnyArray;
import org.epics.pva.data.PVAByteArray;
import org.epics.pva.data.PVAData;
import org.epics.pva.data.PVADoubleArray;
import org.epics.pva.data.PVAFloatArray;
import org.epics.pva.data.PVAInt;
import org.epics.pva.data.PVAIntArray;
import org.epics.pva.data.PVANumber;
import org.epics.pva.data.PVAShortArray;
import org.epics.pva.data.PVAString;
import org.epics.pva.data.PVAStringArray;
import org.epics.pva.data.PVAStructure;
import org.epics.pva.data.PVAStructureArray;
import org.epics.pva.data.PVAny;
import org.epics.pva.data.nt.PVAEnum;
import org.epics.pva.data.nt.PVATimeStamp;
import org.junit.jupiter.api.Test;

import java.lang.management.ManagementFactory;
import java.lang.reflect.Array;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PvaMimeResponseAllocationTest {
    private static final Instant START = Instant.parse("2026-01-01T00:00:00Z");
    private static final int[] COUNTS = {5000, 10000, 20000};
    private static final double MAX_DOUBLING_RATIO = 2.7;
    private static final Path EVIDENCE = Path.of(System.getProperty("archappl.pva.array.evidence", "target/pva-array"));

    private static PVAStructure result() {
        return new PVAStructure("result", "NTComplexTable", new PVAStringArray("labels"), new PVAAnyArray("value"));
    }

    private static SimulationEventStream source(ArchDBRTypes type, int seconds) {
        return new SimulationEventStream(type, new SineGenerator(0), START, START.plusSeconds(seconds), 1);
    }

    private static PVAStructure build(int count) throws Exception {
        PVAStructure result = result();
        try (var context = new BasicContext(); var stream = source(ArchDBRTypes.DBR_SCALAR_DOUBLE, count);
                var consumer = new PvaMergeDedupConsumer(new PvaMimeResponse(), result)) {
            consumer.processingPV(context, "allocation", START, START.plusSeconds(count), stream.getDescription());
            consumer.consumeEventStream(stream);
        }
        return result;
    }

    private static void assertSampleValue(ArchDBRTypes type, SampleValue expected, PVAStructure sample) {
        PVAData value = sample.get("value");
        String expectedType = switch (type) {
            case DBR_SCALAR_BYTE -> "byte";
            case DBR_SCALAR_SHORT -> "short";
            case DBR_SCALAR_INT -> "int";
            case DBR_SCALAR_FLOAT -> "float";
            case DBR_SCALAR_DOUBLE -> "double";
            case DBR_SCALAR_STRING -> "string";
            case DBR_SCALAR_ENUM -> "structure";
            case DBR_WAVEFORM_BYTE -> "byte[]";
            case DBR_WAVEFORM_SHORT -> "short[]";
            case DBR_WAVEFORM_INT -> "int[]";
            case DBR_WAVEFORM_FLOAT -> "float[]";
            case DBR_WAVEFORM_DOUBLE -> "double[]";
            case DBR_WAVEFORM_STRING -> "string[]";
            default -> throw new AssertionError("Unsupported test type " + type);
        };
        assertNotNull(value, type + " value field");
        assertEquals(expectedType, value.getType(), type + " PVA type");
        if (type == ArchDBRTypes.DBR_SCALAR_ENUM) {
            PVAEnum enumeration = assertInstanceOf(PVAEnum.class, value);
            PVAInt index = enumeration.get("index");
            assertEquals(expected.getValue().intValue(), index.get(), type + " index");
            PVAStringArray choices = enumeration.get("choices");
            assertArrayEquals(new String[0], choices.get(), type + " choices");
        } else if (value instanceof PVANumber number) {
            assertEquals(expected.getValue(), number.getNumber(), type + " value");
        } else if (value instanceof PVAString string) {
            assertEquals(expected.toString(), string.get(), type + " value");
        } else {
            Object array = switch (value) {
                case PVAByteArray bytes -> bytes.get();
                case PVAShortArray shorts -> shorts.get();
                case PVAIntArray ints -> ints.get();
                case PVAFloatArray floats -> floats.get();
                case PVADoubleArray doubles -> doubles.get();
                case PVAStringArray strings -> strings.get();
                default -> throw new AssertionError("Unsupported PVA array " + value.getType());
            };
            List<?> expectedValues = expected.getValues();
            assertEquals(expectedValues.size(), Array.getLength(array), type + " array length");
            for (int i = 0; i < expectedValues.size(); i++) {
                assertEquals(expectedValues.get(i), Array.get(array, i), type + " element " + i);
            }
        }
    }

    @Test
    void allocationGrowsLinearlyWhenEventCountDoubles() throws Exception {
        var bean = (ThreadMXBean) ManagementFactory.getThreadMXBean();
        assertTrue(bean.isThreadAllocatedMemorySupported());
        assertTrue(bean.isThreadAllocatedMemoryEnabled());
        for (int i = 0; i < 3; i++) build(1000);
        Files.createDirectories(EVIDENCE);
        List<String> observations = new ArrayList<>();
        observations.add("events,allocatedBytes,elapsedNanos,responseSha256");
        long[] allocated = new long[COUNTS.length];
        for (int i = 0; i < COUNTS.length; i++) {
            long before = bean.getCurrentThreadAllocatedBytes();
            long started = System.nanoTime();
            PVAStructure result = build(COUNTS[i]);
            long elapsed = System.nanoTime() - started;
            allocated[i] = bean.getCurrentThreadAllocatedBytes() - before;
            PVAAnyArray values = result.get("value");
            PVAStructureArray samples = values.get()[0].get();
            assertEquals(COUNTS[i], samples.get().length);
            assertEquals(START, PVATimeStamp.getTimeStamp(samples.get()[0]).instant());
            assertEquals(START.plusSeconds(COUNTS[i] - 1),
                    PVATimeStamp.getTimeStamp(samples.get()[COUNTS[i] - 1]).instant());
            String digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(result.toString().getBytes(StandardCharsets.UTF_8)));
            observations.add(COUNTS[i] + "," + allocated[i] + "," + elapsed + "," + digest);
            Files.write(EVIDENCE.resolve("allocation.csv"), observations);
        }
        assertAll("Doubling event count must not quadruple allocation",
                () -> assertTrue((double) allocated[1] / allocated[0] < MAX_DOUBLING_RATIO, observations.toString()),
                () -> assertTrue((double) allocated[2] / allocated[1] < MAX_DOUBLING_RATIO, observations.toString()));
    }

    @Test
    void preservesTypesEmptyPvsAndSamplesAcrossPvBoundaries() throws Exception {
        List<ArchDBRTypes> types = Arrays.stream(ArchDBRTypes.values())
                .filter(type -> type != ArchDBRTypes.DBR_WAVEFORM_ENUM && type != ArchDBRTypes.DBR_V4_GENERIC_BYTES)
                .toList();
        PVAStructure result = result();
        var response = new PvaMimeResponse();
        response.setOutputStruct(result);
        List<String> expectedLabels = new ArrayList<>();
        List<List<SampleValue>> expectedSamples = new ArrayList<>();
        try (var context = new BasicContext()) {
            for (ArchDBRTypes type : types) {
                String label = type.name();
                expectedLabels.add(label);
                List<SampleValue> inputValues = new ArrayList<>();
                expectedSamples.add(inputValues);
                try (var stream = source(type, 3)) {
                    response.processingPV(context, label, START, START.plusSeconds(3), stream.getDescription());
                    response.swicthingToStream(stream);
                    for (var event : stream) {
                        inputValues.add(((DBRTimeEvent) event).getSampleValue());
                        response.consumeEvent(event);
                    }
                }
                expectedLabels.add("empty-" + label);
                try (var empty = source(type, 0)) {
                    response.processingPV(context, "empty-" + label, START, START, empty.getDescription());
                }
            }
        }
        response.close();
        String closed = result.toString();
        response.close();
        assertEquals(closed, result.toString(), "Repeated close must preserve the completed response");
        PVAStringArray labels = result.get("labels");
        assertArrayEquals(expectedLabels.toArray(String[]::new), labels.get());
        PVAAnyArray values = result.get("value");
        assertEquals(expectedLabels.size(), values.get().length);
        for (int i = 0; i < types.size(); i++) {
            PVAStructureArray samples = values.get()[2 * i].get();
            assertEquals(3, samples.get().length);
            for (int j = 0; j < 3; j++) {
                assertEquals(START.plusSeconds(j), PVATimeStamp.getTimeStamp(samples.get()[j]).instant());
                assertSampleValue(types.get(i), expectedSamples.get(i).get(j), samples.get()[j]);
            }
            assertNull(values.get()[2 * i + 1].get(), "An empty PV keeps its empty variant value");
        }
        Files.createDirectories(EVIDENCE);
        Files.writeString(EVIDENCE.resolve("typed-response.txt"), closed);
    }

    @Test
    void closesEmptyAndSingleEventResponses() throws Exception {
        PVAStructure empty = result();
        var response = new PvaMimeResponse();
        response.setOutputStruct(empty);
        response.close();
        assertEquals(0, ((PVAStringArray) empty.get("labels")).get().length);
        assertNull(((PVAAnyArray) empty.get("value")).get());
        PVAAnyArray values = build(1).get("value");
        PVAny value = values.get()[0];
        PVAStructureArray samples = value.get();
        assertEquals(1, samples.get().length);
        assertEquals(START, PVATimeStamp.getTimeStamp(samples.get()[0]).instant());
    }
}
