package edu.stanford.slac.archiverappliance.PlainPB;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import org.apache.commons.io.FileUtils;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.POJOEvent;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.config.exception.ConfigException;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.epics.archiverappliance.utils.nio.ArchPaths;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * A crash mid-write can leave a partial record at the end of a PB chunk. When appending resumes, the
 * append state truncates the file to the last complete record before writing, so the incomplete tail
 * never corrupts the stream. Without the truncation the resumed data is written after the partial
 * bytes and the file no longer reads back as a clean, ordered event stream.
 */
public class PBAppendCrashRecoveryTest {
    private static final String pvName =
            ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "PBAppendCrashRecoveryTest";
    private static final ArchDBRTypes dbrType = ArchDBRTypes.DBR_SCALAR_DOUBLE;
    private static ConfigServiceForTests configService;
    private static final short currentYear = TimeUtils.getCurrentYear();
    private static final Instant base = TimeUtils.getStartOfYear(currentYear).plus(1000, ChronoUnit.SECONDS);

    private static final File testFolder = new File(ConfigServiceForTests.getDefaultPBTestFolder()
            + File.separator
            + PBAppendCrashRecoveryTest.class.getSimpleName());
    private static final String storagePBPluginString = "pb://localhost?name="
            + PBAppendCrashRecoveryTest.class.getSimpleName()
            + "&rootFolder=" + testFolder.getAbsolutePath()
            + "&partitionGranularity=PARTITION_YEAR";

    static {
        try {
            configService = new ConfigServiceForTests(-1);
        } catch (ConfigException e) {
            throw new RuntimeException(e);
        }
    }

    private static PlainPBStoragePlugin plugin() throws IOException {
        return (PlainPBStoragePlugin)
                StoragePluginURLParser.parseStoragePlugin(storagePBPluginString, configService);
    }

    @BeforeAll
    public static void setUp() throws IOException {
        deleteData();
    }

    @AfterAll
    public static void tearDown() throws IOException {
        deleteData();
    }

    private static void deleteData() throws IOException {
        FileUtils.deleteDirectory(testFolder);
    }

    private static void append(PlainPBStoragePlugin plugin, int firstOffset, int count) throws IOException {
        ArrayListEventStream events = new ArrayListEventStream(
                currentYear, new RemotableEventStreamDesc(dbrType, pvName, currentYear));
        for (int i = 0; i < count; i++) {
            Instant ts = base.plus(firstOffset + i, ChronoUnit.SECONDS);
            events.add(new POJOEvent(dbrType, ts, new ScalarValue<Long>(ts.getEpochSecond()), 0, 0));
        }
        try (BasicContext context = new BasicContext()) {
            plugin.appendData(context, pvName, events);
        }
    }

    private static Path chunkPath() throws Exception {
        return PlainPBPathNameUtility.getPathNameForTime(
                plugin(),
                pvName,
                TimeUtils.getStartOfYear(currentYear),
                new ArchPaths(),
                configService.getPVNameToKeyConverter());
    }

    private static List<Long> readAllEpochSeconds(Path path) throws IOException {
        List<Long> secs = new ArrayList<>();
        try (FileBackedPBEventStream strm = new FileBackedPBEventStream(pvName, path, dbrType)) {
            for (Event e : strm) {
                secs.add(e.getEpochSeconds());
            }
        }
        return secs;
    }

    @Test
    public void resumedAppendTruncatesTheCrashedTail() throws Exception {
        // Ten complete records from a first process.
        append(plugin(), 0, 10);
        Path path = chunkPath();
        long cleanSize = Files.size(path);

        // Simulate a crash mid-write: a partial, unparseable record with no terminating newline.
        Files.write(path, new byte[] {8, 42, 21, 99, 7}, StandardOpenOption.APPEND);
        Assertions.assertTrue(
                Files.size(path) > cleanSize, "The corrupt tail should have grown the file");

        // A fresh plugin (a restarted process) resumes appending five more records.
        append(plugin(), 10, 5);

        List<Long> secs = readAllEpochSeconds(path);
        List<Long> expected = new ArrayList<>();
        for (int i = 0; i < 15; i++) {
            expected.add(base.plus(i, ChronoUnit.SECONDS).getEpochSecond());
        }
        Assertions.assertEquals(
                expected,
                secs,
                "After a crashed tail, the resumed file must read back as the clean ordered stream");
    }
}
