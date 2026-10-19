package edu.stanford.slac.archiverappliance.PlainPB;

import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Checks the store URL of the PlainPB plugin through the shipped parser: the reducedata operators that apply to a
 * store, and the refusal of reducedata together with pp on one store.
 */
public class PlainPBStoreUrlTest {
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

    private String url(String options) {
        return "pb://localhost?name=URLTEST&rootFolder=" + URLEncoder.encode(root.toString(), StandardCharsets.UTF_8)
                + "&partitionGranularity=PARTITION_HOUR" + options;
    }

    @ParameterizedTest
    @ValueSource(strings = {"optimized", "optimized_500", "optimLastSample_100"})
    void aRangeOperatorIsRefusedAsReducedata(String operator) {
        IOException ex = assertThrows(
                IOException.class, () -> StoragePluginURLParser.parseStoragePlugin(url("&reducedata=" + operator), config));
        String message = ex.getMessage();
        assertNotNull(message);
        assertTrue(message.contains("reducedata=" + operator), message);
        assertTrue(message.contains("bin width in seconds"), message);
        assertTrue(message.contains("firstSample_3600"), message);
    }

    @Test
    void aBinOperatorIsAcceptedAsReducedata() throws Exception {
        PlainPBStoragePlugin plugin =
                (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(url("&reducedata=firstSample_3600"), config);
        assertTrue(plugin.getURLRepresentation().contains("&reducedata=firstSample_3600"), plugin.getURLRepresentation());
    }

    @Test
    void reducedataWithPpIsRefused() {
        IOException ex = assertThrows(
                IOException.class,
                () -> StoragePluginURLParser.parseStoragePlugin(url("&reducedata=firstSample_3600&pp=mean_60"), config));
        String message = ex.getMessage();
        assertNotNull(message);
        assertTrue(message.contains("reducedata=firstSample_3600"), message);
        assertTrue(message.contains("pp=mean_60"), message);
        assertTrue(message.contains("not combined"), message);
    }

    @Test
    void ppAloneIsAccepted() throws Exception {
        PlainPBStoragePlugin one = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(url("&pp=mean_60"), config);
        assertTrue(one.getURLRepresentation().contains("&pp=mean_60"), one.getURLRepresentation());
        PlainPBStoragePlugin two = (PlainPBStoragePlugin)
                StoragePluginURLParser.parseStoragePlugin(url("&pp=firstSample&pp=firstSample_3600"), config);
        assertTrue(two.getURLRepresentation().contains("&pp=firstSample&pp=firstSample_3600"), two.getURLRepresentation());
        assertEquals(-1, two.getURLRepresentation().indexOf("&reducedata="), two.getURLRepresentation());
    }
}
