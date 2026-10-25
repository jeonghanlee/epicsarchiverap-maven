package org.epics.archiverappliance.retrieval.saverestore;

import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.time.Period;
import java.util.HashMap;

import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.POJOEvent;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.common.YearSecondTimestamp;
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
 * Verify getDataAtTimeForPVFromStores for a slowly changing PV whose samples sit in one file with a
 * long gap. A dense block of samples is followed by a multi-day gap and then a later sample, all in
 * one yearly chunk. Querying inside the gap must return the last sample of the dense block, which is
 * the last event on or before the query. Seeking the end position must land past that sample, not on
 * it, or the backward iterator excludes it and the query returns an earlier sample or none.
 */
public class GetDataAtTimeSparseGapTest {
    private static final Logger logger = LogManager.getLogger(GetDataAtTimeSparseGapTest.class.getName());
    private static final String pvName = "GetDataAtTimeSparseGapTest";
    private static final ArchDBRTypes dbrType = ArchDBRTypes.DBR_SCALAR_DOUBLE;
    private static ConfigServiceForTests configService;
    private static final short dataYear = (short) (TimeUtils.getCurrentYear() - 1);

    private static final int DAY = 86400;
    // Dense block: hourly samples across the twelve hours of day 100.
    private static final int denseStartSecs = 100 * DAY;
    private static final int lastDenseSecs = 100 * DAY + 11 * 3600;
    // The next sample only appears three days later, leaving a wide gap.
    private static final int laterSampleSecs = 103 * DAY;
    // Query inside the gap, on day 101.
    private static final int querySecs = 101 * DAY + 12 * 3600;

    private static Instant at(int secondsIntoYear) {
        return TimeUtils.convertFromYearSecondTimestamp(new YearSecondTimestamp(dataYear, secondsIntoYear, 0));
    }

    private static final File testFolder = new File(ConfigServiceForTests.getDefaultPBTestFolder()
            + File.separator
            + GetDataAtTimeSparseGapTest.class.getSimpleName());
    private static final String storagePBPluginString = "pb://localhost?name="
            + GetDataAtTimeSparseGapTest.class.getSimpleName()
            + "&rootFolder=" + testFolder.getAbsolutePath()
            + "&partitionGranularity=PARTITION_YEAR";

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

    private static void add(ArrayListEventStream events, int secondsIntoYear) {
        Instant ts = at(secondsIntoYear);
        events.add((DBRTimeEvent) new POJOEvent(
                        dbrType, ts, new ScalarValue<Long>(ts.getEpochSecond()), 0, 0)
                .makeClone());
    }

    private static void createTestData() throws IOException {
        PlainPBStoragePlugin storagePlugin = getStoragePlugin();
        try (BasicContext context = new BasicContext()) {
            ArrayListEventStream events = new ArrayListEventStream(
                    dataYear, new RemotableEventStreamDesc(dbrType, pvName, dataYear));
            for (int s = denseStartSecs; s <= lastDenseSecs; s += 3600) {
                add(events, s);
            }
            add(events, laterSampleSecs);
            storagePlugin.appendData(context, pvName, events);
        }

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
            Assertions.assertNotNull(pvData, "Getting at time " + when + " returns no data");
            return (long) pvData.get("secs");
        }
    }

    @Test
    public void queryInGapReturnsLastDenseSample() throws Exception {
        long secs = secsAt(at(querySecs));
        Assertions.assertEquals(
                at(lastDenseSecs).getEpochSecond(),
                secs,
                "A query in the gap must return the last sample of the dense block, not an earlier one");
        logger.info("Sparse-gap retrieval verified: query {} returned {}", at(querySecs), at(lastDenseSecs));
    }
}
