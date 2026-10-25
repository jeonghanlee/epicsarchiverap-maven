package edu.stanford.slac.archiverappliance.PlainPB;

import org.apache.commons.io.FileUtils;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.PartitionGranularity;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.common.YearSecondTimestamp;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.etl.ETLContext;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.epics.archiverappliance.utils.simulation.SimulationEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Instant;

/**
 * Zero-byte and header-only source files on a real PlainPB store with a 5-minute partition and hold 2. Such a file
 * is deleted by getETLStreams once its modification time is more than (hold + 1) partitions, 900 s here, before the
 * processing time, and kept before that. The files are named for a partition before the processing time so that
 * getETLStreams examines them; the header-only file is a file the real writer produced, cut at its first sample.
 */
public class PlainPBStaleEmptyFileTest {
    private static final PartitionGranularity GRANULARITY = PartitionGranularity.PARTITION_5MIN;
    private static final int HOLD = 2;
    private static final long YOUNGER_THAN_INTENDED_AGE_S = 120;
    private static final long OLDER_THAN_INTENDED_AGE_S = 1000;
    private static final long DATA_AGE_S = 20 * 60;
    private static final int SAMPLES = 10;
    private final String rootFolder =
            ConfigServiceForTests.getDefaultPBTestFolder() + "/" + PlainPBStaleEmptyFileTest.class.getSimpleName();
    private ConfigServiceForTests configService;
    private PlainPBStoragePlugin store;

    @BeforeEach
    public void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1);
        FileUtils.deleteDirectory(new File(rootFolder));
        Assertions.assertTrue(new File(rootFolder).mkdirs());
        store = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=STS&rootFolder=" + rootFolder + "&partitionGranularity=" + GRANULARITY
                        + "&hold=" + HOLD,
                configService);
    }

    @AfterEach
    public void tearDown() throws Exception {
        configService.shutdownNow();
        FileUtils.deleteDirectory(new File(rootFolder));
    }

    /** The path of the store's file for the PV and the partition containing the given time. */
    private Path partitionPath(String pvName, Instant inPartition) {
        return Paths.get(
                store.getRootFolder(),
                configService.getPVNameToKeyConverter().convertPVNameToKey(pvName)
                        + TimeUtils.getPartitionName(inPartition, GRANULARITY)
                        + store.getExtensionString());
    }

    private Path zeroByteFile(String pvName, Instant inPartition) throws Exception {
        Path path = partitionPath(pvName, inPartition);
        Files.createDirectories(path.getParent());
        Files.write(path, new byte[0], StandardOpenOption.CREATE_NEW);
        return path;
    }

    /** Writes real samples through the store and cuts the produced file at its first sample. */
    private Path headerOnlyFile(String pvName, Instant inPartition) throws Exception {
        YearSecondTimestamp start = TimeUtils.convertToYearSecondTimestamp(inPartition);
        ArrayListEventStream data = new ArrayListEventStream(
                SAMPLES, new RemotableEventStreamDesc(ArchDBRTypes.DBR_SCALAR_DOUBLE, pvName, start.getYear()));
        for (int s = 0; s < SAMPLES; s++) {
            data.add(new SimulationEvent(
                    start.getSecondsintoyear() + s,
                    start.getYear(),
                    ArchDBRTypes.DBR_SCALAR_DOUBLE,
                    new ScalarValue<Double>((double) s)));
        }
        try (BasicContext context = new BasicContext()) {
            store.appendData(context, pvName, data);
        }
        Path path = partitionPath(pvName, inPartition);
        long firstSample = new PBFileInfo(path).getPositionOfFirstSample();
        try (FileChannel channel = FileChannel.open(path, StandardOpenOption.WRITE)) {
            channel.truncate(firstSample);
        }
        Assertions.assertNull(new PBFileInfo(path).getFirstEvent(), "header-only file " + path);
        return path;
    }

    /** Runs getETLStreams at the file's modification time plus the given seconds. */
    private void etlAt(String pvName, Path path, long secondsAfterModification) throws Exception {
        Instant processingTime =
                Files.getLastModifiedTime(path).toInstant().plusSeconds(secondsAfterModification);
        try (ETLContext context = new ETLContext()) {
            store.getETLStreams(pvName, processingTime, context);
        }
    }

    private void assertKeptUntilTheIntendedAge(String pvName, Path path) throws Exception {
        Assertions.assertTrue(Files.exists(path), "created " + path);
        etlAt(pvName, path, YOUNGER_THAN_INTENDED_AGE_S);
        Assertions.assertTrue(Files.exists(path), "kept " + YOUNGER_THAN_INTENDED_AGE_S + " s after modification");
        etlAt(pvName, path, OLDER_THAN_INTENDED_AGE_S);
        Assertions.assertFalse(Files.exists(path), "deleted " + OLDER_THAN_INTENDED_AGE_S + " s after modification");
    }

    @Test
    public void zeroByteFileIsKeptUntilTheIntendedAge() throws Exception {
        String pvName = ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "PlainPBStaleEmpty:zero";
        Path path = zeroByteFile(pvName, Instant.now().minusSeconds(DATA_AGE_S));
        assertKeptUntilTheIntendedAge(pvName, path);
    }

    @Test
    public void headerOnlyFileIsKeptUntilTheIntendedAge() throws Exception {
        String pvName = ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + "PlainPBStaleEmpty:header";
        Path path = headerOnlyFile(pvName, Instant.now().minusSeconds(DATA_AGE_S));
        assertKeptUntilTheIntendedAge(pvName, path);
    }
}
