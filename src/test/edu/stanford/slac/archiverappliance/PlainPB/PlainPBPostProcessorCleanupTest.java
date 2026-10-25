package edu.stanford.slac.archiverappliance.PlainPB;

import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.etl.ETLContext;
import org.epics.archiverappliance.etl.ETLInfo;
import org.epics.archiverappliance.etl.ETLSource;
import org.epics.archiverappliance.etl.common.ETLJob;
import org.epics.archiverappliance.etl.common.ETLMetricsForLifetime;
import org.epics.archiverappliance.etl.common.ETLPVLookupItems;
import org.epics.archiverappliance.etl.common.OutOfSpaceHandling;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.epics.archiverappliance.utils.simulation.SimulationEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Enumeration;
import java.util.List;
import java.util.TreeSet;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Checks that the post-processor files of a partition leave a store with its data: over two hops of the shipped ETLJob
 * (STS to a MTS that carries pp=mean_60, then that MTS to the LTS) and over the explicit deletion of a PV's data. The
 * zip archive per PV is covered for the explicit deletion only, because a zip store is the last store of a chain and
 * is not an ETL source.
 */
public class PlainPBPostProcessorCleanupTest {
    private static final String PV = ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + ":PPCleanup:signal";
    private static final ArchDBRTypes TYPE = ArchDBRTypes.DBR_SCALAR_DOUBLE;
    private static final int HOUR = 3600;

    @TempDir
    Path root;

    private ConfigServiceForTests config;

    @BeforeEach
    void setup() throws Exception {
        config = new ConfigServiceForTests(-1);
        config.getETLLookup().manualControlForUnitTests();
    }

    @AfterEach
    void cleanup() {
        config.shutdownNow();
    }

    private String url(String name, String granularity, String options) {
        return "pb://localhost?name=" + name + "&rootFolder=" + root.resolve(name.toLowerCase()) + "&partitionGranularity="
                + granularity + options;
    }

    private ETLPVLookupItems item(String srcUrl, String destUrl, int transition) throws Exception {
        return new ETLPVLookupItems(
                PV,
                TYPE,
                StoragePluginURLParser.parseETLSource(srcUrl, config),
                StoragePluginURLParser.parseETLDest(destUrl, config),
                transition,
                new ETLMetricsForLifetime(transition),
                OutOfSpaceHandling.DELETE_SRC_STREAMS_IF_FIRST_DEST_WHEN_OUT_OF_SPACE);
    }

    /** Writes one sample a second over the given seconds from the start of the year with the shipped writer. */
    private void write(String srcUrl, int seconds) throws Exception {
        PlainPBStoragePlugin sts = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(srcUrl, config);
        short year = TimeUtils.getCurrentYear();
        try (BasicContext context = new BasicContext()) {
            ArrayListEventStream data = new ArrayListEventStream(seconds, new RemotableEventStreamDesc(TYPE, PV, year));
            for (int s = 0; s < seconds; s++) {
                data.add(new SimulationEvent(s, year, TYPE, new ScalarValue<Double>((double) s)));
            }
            sts.appendData(context, PV, data);
        }
    }

    private Instant startOfYearPlus(long seconds) {
        return Instant.ofEpochSecond(TimeUtils.getStartOfCurrentYearInSeconds() + seconds);
    }

    private void hop(ETLPVLookupItems item, Instant asIf) {
        ETLJob job = new ETLJob(item, asIf);
        job.run();
        assertNull(job.getExceptionFromLastRun(), "the ETL job must complete");
    }

    /**
     * The names of the files of the MTS, read from the folder, or from the entries of the zip archives under it when
     * the store is compressed; the names carry the partition and the extension (2026_01_01_00.pb, 2026_01_01_00.mean_60).
     */
    private TreeSet<String> mtsFileNames() throws IOException {
        TreeSet<String> names = new TreeSet<>();
        Path mts = root.resolve("mts");
        if (!Files.exists(mts)) {
            return names;
        }
        try (Stream<Path> files = Files.walk(mts)) {
            for (Path file : (Iterable<Path>) files.filter(Files::isRegularFile)::iterator) {
                String name = file.getFileName().toString();
                if (name.endsWith("_pb.zip")) {
                    try (ZipFile zip = new ZipFile(file.toFile())) {
                        Enumeration<? extends ZipEntry> entries = zip.entries();
                        while (entries.hasMoreElements()) {
                            ZipEntry entry = entries.nextElement();
                            if (!entry.isDirectory()) {
                                names.add(partitionAndExtension(entry.getName()));
                            }
                        }
                    }
                } else {
                    names.add(partitionAndExtension(name));
                }
            }
        }
        return names;
    }

    /** The part of a file name after the last colon of the PV key: the partition and the extension. */
    private static String partitionAndExtension(String path) {
        String name = path.substring(path.lastIndexOf('/') + 1);
        return name.substring(name.lastIndexOf(':') + 1);
    }

    private static TreeSet<String> set(String... names) {
        return new TreeSet<>(List.of(names));
    }

    @Test
    void thePostProcessorFilesOfAMovedPartitionLeaveTheStore() throws Exception {
        String sts = url("STS", "PARTITION_HOUR", "");
        String mts = url("MTS", "PARTITION_HOUR", "&pp=mean_60");
        String lts = url("LTS", "PARTITION_YEAR", "");
        write(sts, 2 * HOUR);
        String year = Short.toString(TimeUtils.getCurrentYear());
        String hour0 = year + "_01_01_00";
        String hour1 = year + "_01_01_01";

        // Hop 1 with an as-if time past both partitions: both reach the MTS, which computes its pp cache for each.
        hop(item(sts, mts, 0), startOfYearPlus(3 * HOUR));
        assertEquals(set(hour0 + ".pb", hour0 + ".mean_60", hour1 + ".pb", hour1 + ".mean_60"), mtsFileNames(),
                "after the first hop the MTS holds the .pb and .mean_60 files of both partitions");

        // Hop 2 with an as-if time between the two partitions: only the older moves on, with its pp file.
        hop(item(mts, lts, 1), startOfYearPlus(HOUR + HOUR / 2));
        assertEquals(set(hour1 + ".pb", hour1 + ".mean_60"), mtsFileNames(),
                "after the second hop the MTS holds only the files of the newer partition");

        // The explicit deletion of the PV's data from the MTS lists and removes the pp file with the .pb file.
        ETLSource source = StoragePluginURLParser.parseETLSource(mts, config);
        try (ETLContext context = new ETLContext()) {
            List<ETLInfo> infos = source.getETLStreamsForDeletion(PV, context);
            assertEquals(2, infos.size(), "the deletion lists the .pb file and its pp file");
            for (ETLInfo info : infos) {
                source.deleteETLStream(info, context);
            }
        }
        assertEquals(set(), mtsFileNames(), "after the deletion the MTS holds no file of the PV");
    }

    @Test
    void theExplicitDeletionRemovesThePostProcessorFilesOfAZipStore() throws Exception {
        String sts = url("STS", "PARTITION_HOUR", "");
        String mts = url("MTS", "PARTITION_HOUR", "&pp=mean_60&compress=ZIP_PER_PV");
        write(sts, 2 * HOUR);
        String year = Short.toString(TimeUtils.getCurrentYear());
        String hour0 = year + "_01_01_00";
        String hour1 = year + "_01_01_01";

        // One hop fills the zip archive of the MTS with both partitions and their pp caches.
        hop(item(sts, mts, 0), startOfYearPlus(3 * HOUR));
        assertEquals(set(hour0 + ".pb", hour0 + ".mean_60", hour1 + ".pb", hour1 + ".mean_60"), mtsFileNames(),
                "after the hop the archive holds the .pb and .mean_60 entries of both partitions");

        // The explicit deletion lists the pp entries beside the .pb entries and removes them all.
        ETLSource source = StoragePluginURLParser.parseETLSource(mts, config);
        try (ETLContext context = new ETLContext()) {
            List<ETLInfo> infos = source.getETLStreamsForDeletion(PV, context);
            assertEquals(4, infos.size(), "the deletion lists the two .pb entries and their pp entries");
            for (ETLInfo info : infos) {
                source.deleteETLStream(info, context);
            }
        }
        assertEquals(set(), mtsFileNames(), "after the deletion the archive holds no entry of the PV");
    }
}
