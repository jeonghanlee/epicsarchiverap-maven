package edu.stanford.slac.archiverappliance.PlainPB;

import org.apache.commons.io.FileUtils;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.utils.nio.ArchPaths;
import org.epics.archiverappliance.utils.simulation.SimulationEventStream;
import org.epics.archiverappliance.utils.simulation.SineGenerator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;

/**
 * PBFileInfo reports file offsets for the last sample of a PB chunk: the last-sample position is where the last
 * complete line starts and the truncation point is where it ends. The chunks are real PARTITION_DAY files written by
 * the plugin, plain and ZIP_PER_PV, smaller and larger than one 16 KiB read, complete and with a crashed partial record
 * appended. The expected offsets are derived from the chunk bytes.
 */
public class PBFileInfoPositionTest {
    private static final String PV_NAME =
            ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + ":PBFileInfoPositionTest";
    private static final ArchDBRTypes DBR_TYPE = ArchDBRTypes.DBR_SCALAR_DOUBLE;
    private static final int PHASE_DIFF_IN_DEGREES = 10;
    private static final int DAY_INDEX = 6;
    private static final int SECONDS_PER_DAY = 86400;
    private static final byte[] PARTIAL_RECORD = new byte[] {8, 42, 21, 99, 7};
    private static final byte NEWLINE = '\n';

    private final File testFolder = new File(ConfigServiceForTests.getDefaultPBTestFolder()
            + File.separator + PBFileInfoPositionTest.class.getSimpleName());
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

    @ParameterizedTest(name = "zipPerPV={0} samples={1} crashedTail={2}")
    @CsvSource({
        "false, 10, false",
        "false, 10, true",
        "false, 86400, false",
        "false, 86400, true",
        "true, 10, false",
        "true, 10, true",
        "true, 86400, false",
        "true, 86400, true"
    })
    public void lastSamplePositionsAreFileOffsets(boolean zipPerPV, int samples, boolean crashedTail) throws Exception {
        PlainPBStoragePlugin plugin = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=PBFileInfoPosition&rootFolder=" + testFolder.getAbsolutePath()
                        + "&partitionGranularity=PARTITION_DAY" + (zipPerPV ? "&compress=ZIP_PER_PV" : ""),
                configService);
        try (BasicContext context = new BasicContext()) {
            plugin.appendData(
                    context,
                    PV_NAME,
                    new SimulationEventStream(
                            DBR_TYPE,
                            new SineGenerator(PHASE_DIFF_IN_DEGREES),
                            dayStart,
                            dayStart.plusSeconds(samples),
                            1));
        }

        try (ArchPaths paths = new ArchPaths()) {
            Path chunk = PlainPBPathNameUtility.getPathNameForTime(
                    plugin, PV_NAME, dayStart, paths, configService.getPVNameToKeyConverter());
            long completeSize = Files.size(chunk);
            if (crashedTail) {
                Files.write(chunk, PARTIAL_RECORD, StandardOpenOption.APPEND);
            }
            byte[] bytes = Files.readAllBytes(chunk);
            Assertions.assertEquals(NEWLINE, bytes[(int) completeSize - 1], "The complete part ends with a newline");
            int lastLineStart = (int) completeSize - 1;
            while (lastLineStart > 0 && bytes[lastLineStart - 1] != NEWLINE) {
                lastLineStart--;
            }

            PBFileInfo info = new PBFileInfo(chunk);
            Assertions.assertEquals(
                    dayStart.plusSeconds(samples - 1).getEpochSecond(),
                    info.getLastEvent().getEpochSeconds(),
                    "Last sample");
            Assertions.assertEquals(lastLineStart, info.getPositionOfLastSample(), "Last-sample position");
            Assertions.assertEquals(completeSize, info.getTruncationPoint(), "Truncation point");
        }
    }
}
