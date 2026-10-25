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
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.epics.archiverappliance.utils.simulation.SimulationEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.zip.ZipFile;

import static org.junit.jupiter.api.Assertions.*;

/** Checks explicit deletion over shipped writers, readers, plugins and filesystems. */
public class PlainPBExplicitDeletionTest {
    private static final String PV = ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + ":ExplicitDelete:signal";
    private static final ArchDBRTypes TYPE = ArchDBRTypes.DBR_SCALAR_DOUBLE;
    @TempDir Path root;
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

    private PlainPBStoragePlugin store(String options) throws Exception {
        return (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=DELETE&rootFolder=" + URLEncoder.encode(root.toString(), StandardCharsets.UTF_8)
                        + "&partitionGranularity=PARTITION_HOUR" + options,
                config);
    }

    private void write(PlainPBStoragePlugin plugin, String pv, int seconds, int count) throws Exception {
        short year = TimeUtils.getCurrentYear();
        ArrayListEventStream stream = new ArrayListEventStream(count, new RemotableEventStreamDesc(TYPE, pv, year));
        for (int i = 0; i < count; i++) {
            stream.add(new SimulationEvent(seconds + i, year, TYPE, new ScalarValue<Double>((double) (seconds + i))));
        }
        try (BasicContext context = new BasicContext()) {
            plugin.appendData(context, pv, stream);
        }
    }

    private Path path(PlainPBStoragePlugin plugin, String pv, Instant timestamp, ETLContext context) throws Exception {
        return PlainPBPathNameUtility.getPathNameForTime(plugin, pv, timestamp,
                context.getPaths(), config.getPVNameToKeyConverter());
    }

    @Test
    void listsExactTargetWithoutOrdinarySelectionOrPayloadDecoding() throws Exception {
        config.setNamedFlag("deletion-gate", false);
        PlainPBStoragePlugin plugin = store("&hold=2&gather=1&etlOutofStoreIf=deletion-gate");
        write(plugin, PV, 0, 3);
        write(plugin, PV + "_other", 0, 3);
        try (ETLContext context = new ETLContext()) {
            Instant future = TimeUtils.getStartOfYear(TimeUtils.getCurrentYear()).plusSeconds(20L * 366 * 86400);
            Path empty = path(plugin, PV, future, context);
            Files.createFile(empty);
            Path corrupt = path(plugin, PV, future.plusSeconds(3600), context);
            Files.writeString(corrupt, "invalid payload");
            assertTrue(plugin.getETLStreams(PV, future.plusSeconds(7200), context).isEmpty());
            List<ETLInfo> infos = plugin.getETLStreamsForDeletion(PV, context);
            assertEquals(3, infos.size());
            assertTrue(infos.stream().allMatch(info -> PV.equals(info.getPvName())));
            assertTrue(infos.stream().anyMatch(info -> info.getSize() == 0));
            for (ETLInfo info : infos) plugin.deleteETLStream(info, context);
            assertTrue(plugin.getETLStreamsForDeletion(PV, context).isEmpty());
            assertEquals(1, plugin.getETLStreamsForDeletion(PV + "_other", context).size());
        }
    }

    @Test
    void reportsChangedSizeAndPreservesOrdinaryCleanup() throws Exception {
        PlainPBStoragePlugin plugin = store("");
        write(plugin, PV, 0, 3);
        try (ETLContext context = new ETLContext()) {
            ETLInfo info = plugin.getETLStreamsForDeletion(PV, context).getFirst();
            write(plugin, PV, 3, 1);
            assertThrows(IOException.class, () -> plugin.deleteETLStream(info, context));
            plugin.markForDeletion(info, context);
            Path file = context.getPaths().get(info.getKey());
            assertTrue(Files.exists(file));
            try (FileBackedPBEventStream stream = new FileBackedPBEventStream(PV, file, TYPE)) {
                int samples = 0;
                for (var ignored : stream) samples++;
                assertEquals(4, samples);
            }
            plugin.deleteETLStream(plugin.getETLStreamsForDeletion(PV, context).getFirst(), context);
            assertFalse(Files.exists(file));
            plugin.deleteETLStream(info, context);
        }
    }

    @Test
    void distinguishesMissingPvFromAnInvalidParent() throws Exception {
        PlainPBStoragePlugin plugin = store("");
        try (ETLContext context = new ETLContext()) {
            assertTrue(plugin.getETLStreamsForDeletion(PV, context).isEmpty());
            Path parent = path(plugin, PV, TimeUtils.getStartOfYear(TimeUtils.getCurrentYear()), context).getParent();
            Files.createDirectories(parent.getParent());
            Files.writeString(parent, "not a directory");
            assertThrows(IOException.class, () -> plugin.getETLStreamsForDeletion(PV, context));
        }
    }

    @Test
    void reportsActualRemovalFailure() throws Exception {
        PlainPBStoragePlugin plugin = store("");
        write(plugin, PV, 0, 3);
        try (ETLContext context = new ETLContext()) {
            ETLInfo original = plugin.getETLStreamsForDeletion(PV, context).getFirst();
            Path file = context.getPaths().get(original.getKey());
            Files.delete(file);
            Files.createDirectory(file);
            Files.writeString(file.resolve("child"), "retained");
            ETLInfo info = new ETLInfo(PV, TYPE, original.getKey(), original.getGranularity(),
                    null, null, Files.size(file));
            assertThrows(IOException.class, () -> plugin.deleteETLStream(info, context));
            assertEquals("retained", Files.readString(file.resolve("child")));
        }
    }

    @Test
    void finalizesZipDeletionBeforeReopeningTheArchive() throws Exception {
        PlainPBStoragePlugin plugin = store("&compress=ZIP_PER_PV");
        write(plugin, PV, 0, 3);
        Path archive;
        try (ETLContext context = new ETLContext()) {
            ETLInfo info = plugin.getETLStreamsForDeletion(PV, context).getFirst();
            Path entry = context.getPaths().get(info.getKey());
            archive = Path.of(entry.getFileSystem().toString());
            plugin.deleteETLStream(info, context);
            context.getPaths().close();
        }
        try (ZipFile zip = new ZipFile(archive.toFile())) {
            assertFalse(zip.stream().anyMatch(entry -> entry.getName().endsWith(".pb")));
        }
    }

    @Test
    void propagatesRealZipFinalizationFailure() throws Exception {
        PlainPBStoragePlugin plugin = store("&compress=ZIP_PER_PV");
        write(plugin, PV, 0, 3);
        Path moved;
        try (ETLContext context = new ETLContext()) {
            ETLInfo info = plugin.getETLStreamsForDeletion(PV, context).getFirst();
            Path entry = context.getPaths().get(info.getKey());
            Path archive = Path.of(entry.getFileSystem().toString());
            plugin.deleteETLStream(info, context);
            Path directory = archive.getParent();
            Path newDirectory = directory.resolveSibling(directory.getFileName() + "-moved");
            Files.move(directory, newDirectory);
            moved = newDirectory.resolve(archive.getFileName());
            assertThrows(IOException.class, () -> context.getPaths().close());
        }
        try (ZipFile zip = new ZipFile(moved.toFile())) {
            assertTrue(zip.stream().anyMatch(entry -> entry.getName().endsWith(".pb")));
        }
    }

    @ParameterizedTest
    @CsvSource({"Hash#signal,false", "Percent%23signal,false", "Plus+signal,false", "signal,true"})
    void preservesLiteralZipPathsDuringDeletion(String suffix, boolean specialRoot) throws Exception {
        if (specialRoot) root = Files.createDirectory(root.resolve("store # % +"));
        String pv = ConfigServiceForTests.ARCH_UNIT_TEST_PVNAME_PREFIX + ":ExplicitDelete:" + suffix;
        String control = PV + "_control";
        PlainPBStoragePlugin plugin = store("&compress=ZIP_PER_PV");
        write(plugin, pv, 0, 3);
        write(plugin, control, 10, 3);
        Path archive;
        try (ETLContext context = new ETLContext()) {
            Path entry = path(plugin, pv, TimeUtils.getStartOfYear(TimeUtils.getCurrentYear()), context);
            archive = Path.of(entry.getFileSystem().toString());
            List<ETLInfo> infos = plugin.getETLStreamsForDeletion(pv, context);
            assertEquals(1, infos.size());
            assertEquals(entry.toString(), context.getPaths().get(infos.getFirst().getKey()).toString());
            try (FileBackedPBEventStream stream = new FileBackedPBEventStream(pv, entry, TYPE)) {
                assertEquals(3, java.util.stream.StreamSupport.stream(stream.spliterator(), false).count());
            }
            plugin.deleteETLStream(infos.getFirst(), context);
            context.getPaths().close();
        }
        try (ZipFile zip = new ZipFile(archive.toFile())) {
            assertFalse(zip.stream().anyMatch(entry -> entry.getName().endsWith(".pb")));
        }
        try (ETLContext context = new ETLContext()) {
            assertTrue(plugin.getETLStreamsForDeletion(pv, context).isEmpty());
            List<ETLInfo> retained = plugin.getETLStreamsForDeletion(control, context);
            assertEquals(1, retained.size());
            Path entry = context.getPaths().get(retained.getFirst().getKey());
            try (FileBackedPBEventStream stream = new FileBackedPBEventStream(control, entry, TYPE)) {
                assertEquals(3, java.util.stream.StreamSupport.stream(stream.spliterator(), false).count());
            }
        }
    }

    @Test
    void delegatesDeletionToTheActualMergeDestination() throws Exception {
        PlainPBStoragePlugin plugin = store("");
        write(plugin, PV, 0, 3);
        String destination = URLEncoder.encode(plugin.getURLRepresentation(), StandardCharsets.UTF_8);
        String other = URLEncoder.encode("pbraw://localhost?name=OTHER&rawURL=http://127.0.0.1:1/retrieval",
                StandardCharsets.UTF_8);
        ETLSource merge = StoragePluginURLParser.parseETLSource(
                "merge://localhost?name=MERGE&dest=" + destination + "&other=" + other, config);
        try (ETLContext context = new ETLContext()) {
            List<ETLInfo> infos = merge.getETLStreamsForDeletion(PV, context);
            assertEquals(1, infos.size());
            assertNull(infos.getFirst().getStrmCreator());
            merge.deleteETLStream(infos.getFirst(), context);
            assertTrue(plugin.getETLStreamsForDeletion(PV, context).isEmpty());
        }
    }
}
