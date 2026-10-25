package org.epics.archiverappliance.retrieval.saverestore;

import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.time.Period;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;

import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.POJOEvent;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.config.exception.AlreadyRegisteredException;
import org.epics.archiverappliance.config.exception.ConfigException;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.retrieval.GetDataAtTime;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;

/**
 * Verify that getDataAtTimeForPVFromStores returns the closest sample before the requested time
 * even when that sample lives in an earlier storage chunk than the requested time.
 * <p>
 * The store partitions per hour. A run of samples ends just before an hour boundary in one chunk,
 * then a gap spans the boundary, then more samples resume in the next chunk. Querying inside the
 * gap, where the boundary chunk holds only later samples, forces the retrieval to cross backward
 * into the previous chunk for the answer. The fork resolves this with a BiDirectionalIterable
 * backward iteration rather than the upstream positioned iterator, so this test pins that the
 * chunk boundary is crossed correctly.
 */
public class GetDataAtTimeChunkBoundaryTest {
    private static final Logger logger = LogManager.getLogger(GetDataAtTimeChunkBoundaryTest.class.getName());
    private static final String pvName = "GetDataAtTimeChunkBoundaryTest";
    private static final ArchDBRTypes dbrType = ArchDBRTypes.DBR_SCALAR_DOUBLE;
    private static ConfigServiceForTests configService;
    private static final short currentYear = TimeUtils.getCurrentYear();

    // An hour boundary safely in the past; the samples sit on either side of it with a gap across.
    private static final Instant boundary =
            Instant.ofEpochSecond((TimeUtils.now().getEpochSecond() / 3600L) * 3600L).minus(3, ChronoUnit.HOURS);
    // Previous chunk: five 1 Hz samples ending one second before the boundary.
    private static final Instant preRunFirst = boundary.minus(5, ChronoUnit.SECONDS);
    private static final Instant lastBeforeBoundary = boundary.minus(1, ChronoUnit.SECONDS);
    // Boundary chunk: five 1 Hz samples starting a minute after the boundary.
    private static final Instant postRunFirst = boundary.plus(60, ChronoUnit.SECONDS);

    private static final File testFolder = new File(ConfigServiceForTests.getDefaultPBTestFolder()
            + File.separator
            + GetDataAtTimeChunkBoundaryTest.class.getSimpleName());
    private static final String storagePBPluginString = "pb://localhost?name="
            + GetDataAtTimeChunkBoundaryTest.class.getSimpleName()
            + "&rootFolder=" + testFolder.getAbsolutePath()
            + "&partitionGranularity=PARTITION_HOUR";

    static {
        try {
            configService = new ConfigServiceForTests(-1);
        } catch (ConfigException e) {
            throw new RuntimeException(e);
        }
    }

    private static PlainPBStoragePlugin getStoragePlugin() throws IOException {
        return (PlainPBStoragePlugin)
                StoragePluginURLParser.parseStoragePlugin(storagePBPluginString, configService);
    }

    @BeforeAll
    public static void setUp() throws Exception {
        deleteData();
        createTestData();
    }

    @AfterAll
    public static void tearDown() throws IOException {
        deleteData();
    }

    private static void deleteData() throws IOException {
        FileUtils.deleteDirectory(new File(getStoragePlugin().getRootFolder()));
    }

    private static void appendRange(PlainPBStoragePlugin storagePlugin, BasicContext context, Instant first, int count)
            throws IOException {
        ArrayListEventStream events = new ArrayListEventStream(
                currentYear, new RemotableEventStreamDesc(dbrType, pvName, currentYear));
        for (int i = 0; i < count; i++) {
            Instant ts = first.plus(i, ChronoUnit.SECONDS);
            DBRTimeEvent ev = (DBRTimeEvent) new POJOEvent(
                            dbrType, ts, new ScalarValue<Long>(ts.getEpochSecond()), 0, 0)
                    .makeClone();
            events.add(ev);
        }
        storagePlugin.appendData(context, pvName, events);
    }

    private static void createTestData() throws IOException {
        PlainPBStoragePlugin storagePlugin = getStoragePlugin();
        try (BasicContext context = new BasicContext()) {
            appendRange(storagePlugin, context, preRunFirst, 5);
            appendRange(storagePlugin, context, postRunFirst, 5);
        }

        // The two runs must land in different chunk files for this to exercise a boundary.
        int pbFiles = FileUtils.listFiles(testFolder, new String[] {"pb"}, true).size();
        Assertions.assertTrue(
                pbFiles >= 2, "Expected the samples to straddle two chunk files, found " + pbFiles);

        try {
            PVTypeInfo typeInfo = new PVTypeInfo(pvName, dbrType, true, 1);
            typeInfo.setDataStores(new String[] {storagePBPluginString});
            typeInfo.setApplianceIdentity(configService.getMyApplianceInfo().getIdentity());
            configService.updateTypeInfoForPV(pvName, typeInfo);
            configService.registerPVToAppliance(pvName, configService.getMyApplianceInfo());
        } catch (AlreadyRegisteredException ex) {
            throw new IOException(ex);
        }
    }

    private static long secsAt(Instant when) throws Exception {
        try (BasicContext context = new BasicContext()) {
            HashMap<String, HashMap<String, Object>> pvDatas =
                    GetDataAtTime.testGetDataAtTimeForPVFromStores(pvName, when, Period.parse("P1D"), configService);
            HashMap<String, Object> pvData = pvDatas.get(pvName);
            Assertions.assertNotNull(pvData, "Getting at time " + when + " returns null?");
            return (long) pvData.get("secs");
        }
    }

    @Test
    public void queryInGapReturnsPreviousChunkSample() throws Exception {
        // In the gap past the boundary: the boundary chunk's samples are all still in the future, so
        // the answer is the last sample from the previous chunk.
        long secs = secsAt(boundary.plus(30, ChronoUnit.SECONDS));
        Assertions.assertEquals(
                lastBeforeBoundary.getEpochSecond(),
                secs,
                "Query in the cross-boundary gap must return the previous chunk's last sample");
    }

    @Test
    public void queryInsideBoundaryChunkReturnsThatChunkSample() throws Exception {
        // Past a sample in the boundary chunk: the answer is that sample, no crossing needed.
        Instant when = postRunFirst.plus(2, ChronoUnit.SECONDS);
        long secs = secsAt(when);
        Assertions.assertEquals(
                when.getEpochSecond(),
                secs,
                "Query inside the boundary chunk must return that chunk's sample");
        logger.info("Chunk boundary retrieval verified around {}", boundary);
    }
}
