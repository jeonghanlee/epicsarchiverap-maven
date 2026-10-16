package edu.stanford.slac.archiverappliance.PlainPB;

import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.time.Period;
import java.time.temporal.ChronoUnit;
import java.util.stream.LongStream;
import java.util.stream.Stream;

import org.apache.commons.io.FileUtils;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.BiDirectionalIterable.IterationDirection;
import org.epics.archiverappliance.common.POJOEvent;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * A backward iteration through the storage plugin over a day file that holds one, two or three samples, as in the first
 * hours of a freshly started store. For an end time, the first event at or before it must be the newest sample at or before
 * it, and there must be none when the end time is earlier than the first sample.
 */
public class BackwardIterationOfSmallFileTest {
    private static final ArchDBRTypes DBR_TYPE = ArchDBRTypes.DBR_SCALAR_DOUBLE;
    private static final File TEST_FOLDER = new File(ConfigServiceForTests.getDefaultPBTestFolder()
            + File.separator
            + BackwardIterationOfSmallFileTest.class.getSimpleName());
    private static final Instant DAY_START = TimeUtils.now().truncatedTo(ChronoUnit.DAYS);
    private static final long FIRST_SECOND = 60;
    private static final long SECONDS_BETWEEN = 220;
    private static final int NANOS = 354000000;
    private static ConfigServiceForTests configService;
    private static PlainPBStoragePlugin plugin;

    @BeforeAll
    public static void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1);
        FileUtils.deleteDirectory(TEST_FOLDER);
        plugin = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=STS&rootFolder=" + TEST_FOLDER.getAbsolutePath() + "&partitionGranularity=PARTITION_DAY",
                configService);
        for (int numSamples = 1; numSamples <= 3; numSamples++) {
            writeSamples(pvName(numSamples), numSamples);
        }
    }

    @AfterAll
    public static void tearDown() throws IOException {
        FileUtils.deleteDirectory(TEST_FOLDER);
    }

    private static String pvName(int numSamples) {
        return "BackwardIterationOfSmallFileTest" + numSamples;
    }

    private static Instant sampleTime(int index) {
        return DAY_START.plusSeconds(FIRST_SECOND + SECONDS_BETWEEN * index).plusNanos(NANOS);
    }

    private static void writeSamples(String pvName, int numSamples) throws IOException {
        short year = TimeUtils.getCurrentYear();
        try (BasicContext context = new BasicContext()) {
            ArrayListEventStream events = new ArrayListEventStream(year, new RemotableEventStreamDesc(DBR_TYPE, pvName, year));
            for (int i = 0; i < numSamples; i++) {
                Instant ts = sampleTime(i);
                events.add((DBRTimeEvent) new POJOEvent(DBR_TYPE, ts, new ScalarValue<Long>(ts.getEpochSecond()), 0, 0).makeClone());
            }
            plugin.appendData(context, pvName, events);
        }
    }

    public static Stream<Arguments> provideSamplesAndOffsets() {
        // Seconds after the start of the day: before the first sample, at it, shortly after it, between samples, at the last sample and after it.
        long[] offsets = {
            FIRST_SECOND - 30,
            FIRST_SECOND,
            FIRST_SECOND + 1,
            FIRST_SECOND + SECONDS_BETWEEN - 1,
            FIRST_SECOND + SECONDS_BETWEEN,
            FIRST_SECOND + 2 * SECONDS_BETWEEN,
            FIRST_SECOND + 3 * SECONDS_BETWEEN + 400
        };
        return Stream.of(1, 2, 3).flatMap(numSamples -> LongStream.of(offsets).mapToObj(offset -> Arguments.of(numSamples, offset)));
    }

    @ParameterizedTest
    @MethodSource("provideSamplesAndOffsets")
    public void testNewestSampleAtOrBefore(int numSamples, long offsetSeconds) throws Exception {
        Instant endTime = DAY_START.plusSeconds(offsetSeconds);
        Instant expected = null;
        for (int i = 0; i < numSamples; i++) {
            if (!sampleTime(i).isAfter(endTime)) {
                expected = sampleTime(i);
            }
        }
        final Instant[] picked = {null};
        try (BasicContext context = new BasicContext()) {
            plugin.iterate(
                    context,
                    pvName(numSamples),
                    endTime,
                    (Event event) -> {
                        Instant ts = event.getEventTimeStamp();
                        if (!ts.isAfter(endTime)) {
                            picked[0] = ts;
                            return false;
                        }
                        return true;
                    },
                    IterationDirection.BACKWARDS,
                    Period.ofDays(1));
        }
        Assertions.assertEquals(
                expected, picked[0], "The newest sample at or before " + endTime + " in a file with " + numSamples + " samples");
    }
}
