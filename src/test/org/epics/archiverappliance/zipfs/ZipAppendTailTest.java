package org.epics.archiverappliance.zipfs;

import edu.stanford.slac.archiverappliance.PlainPB.FileBackedPBEventStream;
import edu.stanford.slac.archiverappliance.PlainPB.PBFileInfo;
import edu.stanford.slac.archiverappliance.PlainPB.PlainPBPathNameUtility;
import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;
import org.apache.commons.io.FileUtils;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.utils.nio.ArchPaths;
import org.epics.archiverappliance.utils.nio.WrappedSeekableByteChannel;
import org.epics.archiverappliance.utils.simulation.SimulationEventStream;
import org.epics.archiverappliance.utils.simulation.SineGenerator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.Arrays;

/**
 * Appends to PARTITION_DAY PB chunks must keep every complete sample, with and without ZIP_PER_PV
 * compression. The day is the seventh day of the year of a sine series (one sample per second, 10 degree
 * phase); its values depend only on the seconds into the year, so the chunk bytes are the same every year.
 * In a ZIP_PER_PV store this chunk is a deflated zip entry whose stream returns fewer bytes than a 16 KiB
 * read requests near its end, the condition under which the tail of a complete chunk was truncated
 * when an append resumed on it.
 */
public class ZipAppendTailTest {
    private static final String PV_NAME = ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + ":ZipAppendTailTest";
    private static final ArchDBRTypes DBR_TYPE = ArchDBRTypes.DBR_SCALAR_DOUBLE;
    private static final int PHASE_DIFF_IN_DEGREES = 10;
    private static final int DAY_INDEX = 6;
    private static final int SECONDS_PER_DAY = 86400;
    private static final int HALF_DAY = SECONDS_PER_DAY / 2;
    private static final int READ_SIZE = 16 * 1024;
    private static final byte[] PARTIAL_RECORD = new byte[] {8, 42, 21, 99, 7};

    private final File testFolder = new File(
            ConfigServiceForTests.getDefaultPBTestFolder() + File.separator + ZipAppendTailTest.class.getSimpleName());
    private final Instant dayStart = TimeUtils.getStartOfYear(TimeUtils.getCurrentYear())
            .plusSeconds((long) DAY_INDEX * SECONDS_PER_DAY);
    private ConfigServiceForTests configService;

    @BeforeEach
    public void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1);
        FileUtils.deleteDirectory(testFolder);
        testFolder.mkdirs();
    }

    @AfterEach
    public void tearDown() throws Exception {
        FileUtils.deleteDirectory(testFolder);
    }

    private PlainPBStoragePlugin plugin(boolean zipPerPV) throws IOException {
        String url = "pb://localhost?name=ZipAppendTail&rootFolder=" + testFolder.getAbsolutePath()
                + File.separator + (zipPerPV ? "zip" : "plain")
                + "&partitionGranularity=PARTITION_DAY" + (zipPerPV ? "&compress=ZIP_PER_PV" : "");
        return (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(url, configService);
    }

    /** Appends one sample per second from firstSecond through lastSecond of the day, both included. */
    private void append(PlainPBStoragePlugin plugin, int firstSecond, int lastSecond) throws IOException {
        SimulationEventStream stream = new SimulationEventStream(
                DBR_TYPE,
                new SineGenerator(PHASE_DIFF_IN_DEGREES),
                dayStart.plusSeconds(firstSecond),
                dayStart.plusSeconds(lastSecond + 1L),
                1);
        try (BasicContext context = new BasicContext()) {
            plugin.appendData(context, PV_NAME, stream);
        }
    }

    private Path chunkPath(PlainPBStoragePlugin plugin, ArchPaths paths) throws IOException {
        return PlainPBPathNameUtility.getPathNameForTime(
                plugin, PV_NAME, dayStart, paths, configService.getPVNameToKeyConverter());
    }

    /** Reads the chunk and fails unless it holds exactly the samples of the whole day, one per second. */
    private void assertWholeDay(PlainPBStoragePlugin plugin) throws IOException {
        try (ArchPaths paths = new ArchPaths()) {
            long expected = dayStart.getEpochSecond();
            int count = 0;
            try (FileBackedPBEventStream strm = new FileBackedPBEventStream(PV_NAME, chunkPath(plugin, paths), DBR_TYPE)) {
                for (Event e : strm) {
                    Assertions.assertEquals(expected, e.getEpochSeconds(), "Sample " + count + " is out of sequence");
                    expected++;
                    count++;
                }
            }
            Assertions.assertEquals(SECONDS_PER_DAY, count, "The chunk does not hold the whole day");
        }
    }

    @Test
    public void wrappedChannelReadsMatchTheEntryBytes() throws Exception {
        PlainPBStoragePlugin plugin = plugin(true);
        append(plugin, 0, SECONDS_PER_DAY - 1);
        try (ArchPaths paths = new ArchPaths()) {
            Path entry = chunkPath(plugin, paths);
            byte[] reference = Files.readAllBytes(entry);
            long size = reference.length;
            Assertions.assertTrue(size > 2L * READ_SIZE, "The entry is too small for this check: " + size);
            long[] positions = new long[] {0, size / 2, size - READ_SIZE, size - 100, size / 3, 0, size};
            try (WrappedSeekableByteChannel channel = new WrappedSeekableByteChannel(entry)) {
                Assertions.assertEquals(size, channel.size());
                for (long position : positions) {
                    channel.position(position);
                    ByteBuffer buf = ByteBuffer.allocate(READ_SIZE);
                    int bytesRead = channel.read(buf);
                    int expectedBytes = (int) Math.min(READ_SIZE, size - position);
                    if (expectedBytes == 0) {
                        Assertions.assertEquals(-1, bytesRead, "Read at the end of the entry");
                        continue;
                    }
                    Assertions.assertEquals(expectedBytes, bytesRead, "Bytes read at position " + position);
                    Assertions.assertEquals(position + bytesRead, channel.position(), "Position after the read");
                    Assertions.assertArrayEquals(
                            Arrays.copyOfRange(reference, (int) position, (int) position + expectedBytes),
                            Arrays.copyOf(buf.array(), bytesRead),
                            "Bytes read at position " + position);
                }
            }
        }
    }

    @Test
    public void fileInfoOfAZipEntryFindsTheLastSample() throws Exception {
        PlainPBStoragePlugin plugin = plugin(true);
        append(plugin, 0, SECONDS_PER_DAY - 1);
        try (ArchPaths paths = new ArchPaths()) {
            Path entry = chunkPath(plugin, paths);
            PBFileInfo info = new PBFileInfo(entry);
            Assertions.assertEquals(
                    dayStart.plusSeconds(SECONDS_PER_DAY - 1).getEpochSecond(),
                    info.getLastEvent().getEpochSeconds(),
                    "Last sample of the entry");
            long size = Files.size(entry);
            Assertions.assertTrue(
                    info.getTruncationPoint() >= size,
                    "Truncation point " + info.getTruncationPoint() + " cuts into a complete entry of " + size + " bytes");
        }
    }

    @Test
    public void reappendKeepsTheWholeDayInAZipEntry() throws Exception {
        PlainPBStoragePlugin plugin = plugin(true);
        append(plugin, 0, SECONDS_PER_DAY - 1);
        append(plugin(true), 0, SECONDS_PER_DAY - 1);
        assertWholeDay(plugin);
    }

    @Test
    public void resumedAppendCompletesTheDayInAZipEntry() throws Exception {
        PlainPBStoragePlugin plugin = plugin(true);
        append(plugin, 0, HALF_DAY - 1);
        append(plugin(true), HALF_DAY, SECONDS_PER_DAY - 1);
        assertWholeDay(plugin);
    }

    @Test
    public void resumedAppendTruncatesACrashedTailInAZipEntry() throws Exception {
        crashedTailThenResume(true);
    }

    @Test
    public void resumedAppendTruncatesACrashedTailInAPlainFile() throws Exception {
        crashedTailThenResume(false);
    }

    private void crashedTailThenResume(boolean zipPerPV) throws Exception {
        PlainPBStoragePlugin plugin = plugin(zipPerPV);
        append(plugin, 0, HALF_DAY - 1);
        try (ArchPaths paths = new ArchPaths()) {
            Path chunk = chunkPath(plugin, paths);
            long cleanSize = Files.size(chunk);
            Files.write(chunk, PARTIAL_RECORD, StandardOpenOption.APPEND);
            Assertions.assertEquals(cleanSize + PARTIAL_RECORD.length, Files.size(chunk), "Crashed tail written");
        }
        append(plugin(zipPerPV), HALF_DAY, SECONDS_PER_DAY - 1);
        assertWholeDay(plugin);
    }
}
