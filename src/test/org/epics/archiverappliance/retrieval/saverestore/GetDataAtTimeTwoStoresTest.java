/*******************************************************************************
 * Copyright (c) 2011 The Board of Trustees of the Leland Stanford Junior University
 * as Operator of the SLAC National Accelerator Laboratory.
 * Copyright (c) 2011 Brookhaven National Laboratory.
 * EPICS archiver appliance is distributed subject to a Software License Agreement found
 * in file LICENSE that is included with this distribution.
 *******************************************************************************/

package org.epics.archiverappliance.retrieval.saverestore;

import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.time.Period;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.stream.Stream;

import org.apache.commons.io.FileUtils;
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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;

/**
 * Test GetDataAtTime's internal method getDataAtTimeForPVFromStores for a PV whose samples are split between two stores.
 * The medium term store holds the older samples up to a split time and the short term store holds the newer ones, as after
 * an ETL run. For an instant after the first sample of the short term store, the newest sample at or before the instant is
 * in the short term store even though the medium term store also holds samples at or before it. For an instant before the
 * first sample of the short term store, the sample comes from the medium term store.
 * A second PV has only two samples in the short term store, as right after an ETL run, and the instants before them lie in
 * the same hour partition, so that the short term store has a file that holds nothing at or before the instant.
 */
public class GetDataAtTimeTwoStoresTest {
    private static final String PV_NAME = "GetDataAtTimeTwoStoresTest";
    private static final String TINY_PV_NAME = "GetDataAtTimeTwoStoresTinyTest";
    private static final String ONE_PV_NAME = "GetDataAtTimeTwoStoresOneSampleTest";
    private static final ArchDBRTypes DBR_TYPE = ArchDBRTypes.DBR_SCALAR_DOUBLE;
    private static final Instant NOW = TimeUtils.now().truncatedTo(ChronoUnit.SECONDS);
    private static final Instant YESTERDAY = NOW.minus(1, ChronoUnit.DAYS);
    private static final Instant SPLIT = NOW.minus(3, ChronoUnit.HOURS);
    // The tiny PV: the short term store holds two samples that start 40 minutes into an hour, the medium term store the rest.
    private static final Instant HOUR = NOW.minus(5, ChronoUnit.HOURS).truncatedTo(ChronoUnit.HOURS);
    private static final Instant TINY_FIRST = HOUR.plus(40, ChronoUnit.MINUTES);
    // The one sample PV: the day file of the medium term store holds one sample, the hour file of the short term store
    // holds one later sample, and the samples before them are in the file of the previous day.
    private static final Instant DAY_START = NOW.truncatedTo(ChronoUnit.DAYS);
    private static final Instant ONE_MTS = DAY_START.plusSeconds(60).plusNanos(354000000);
    private static final Instant ONE_STS = DAY_START.plusSeconds(280).plusNanos(354000000);
    private static final Instant ONE_OLDEST = DAY_START.minusSeconds(3600);
    private static ConfigServiceForTests configService;

    private static final File TEST_FOLDER = new File(ConfigServiceForTests.getDefaultPBTestFolder()
            + File.separator
            + GetDataAtTimeTwoStoresTest.class.getSimpleName());
    private static final String STS_STORE = "pb://localhost?name=STS&rootFolder=" + new File(TEST_FOLDER, "sts").getAbsolutePath()
            + "&partitionGranularity=PARTITION_HOUR";
    private static final String MTS_STORE = "pb://localhost?name=MTS&rootFolder=" + new File(TEST_FOLDER, "mts").getAbsolutePath()
            + "&partitionGranularity=PARTITION_DAY";

    static {
        try {
            configService = new ConfigServiceForTests(-1);
        } catch (ConfigException e) {
            throw new RuntimeException(e);
        }
    }

    @BeforeAll
    public static void setUp() throws Exception {
        FileUtils.deleteDirectory(TEST_FOLDER);
        writeSamples(PV_NAME, MTS_STORE, YESTERDAY, SPLIT);
        writeSamples(PV_NAME, STS_STORE, SPLIT.plus(1, ChronoUnit.SECONDS), NOW);
        registerPV(PV_NAME);
        writeSamples(TINY_PV_NAME, MTS_STORE, YESTERDAY, TINY_FIRST.minus(1, ChronoUnit.SECONDS));
        writeSamples(TINY_PV_NAME, STS_STORE, TINY_FIRST, TINY_FIRST.plus(1, ChronoUnit.SECONDS));
        registerPV(TINY_PV_NAME);
        writeSamples(ONE_PV_NAME, MTS_STORE, ONE_OLDEST, ONE_OLDEST.plus(5, ChronoUnit.SECONDS));
        writeOneSample(ONE_PV_NAME, MTS_STORE, ONE_MTS);
        writeOneSample(ONE_PV_NAME, STS_STORE, ONE_STS);
        registerPV(ONE_PV_NAME);
    }

    @AfterAll
    public static void tearDown() throws IOException {
        FileUtils.deleteDirectory(TEST_FOLDER);
    }

    /** Writes one sample a second from first to last, both included, whose value is its epoch seconds. */
    private static void writeSamples(String pvName, String store, Instant first, Instant last) throws IOException {
        PlainPBStoragePlugin plugin = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(store, configService);
        short year = TimeUtils.getCurrentYear();
        try (BasicContext context = new BasicContext()) {
            ArrayListEventStream events = new ArrayListEventStream(
                    year, new RemotableEventStreamDesc(DBR_TYPE, pvName, year));
            for (Instant ts = first; !ts.isAfter(last); ts = ts.plus(1, ChronoUnit.SECONDS)) {
                events.add((DBRTimeEvent) new POJOEvent(DBR_TYPE, ts, new ScalarValue<Long>(ts.getEpochSecond()), 0, 0).makeClone());
            }
            plugin.appendData(context, pvName, events);
        }
    }

    private static void writeOneSample(String pvName, String store, Instant ts) throws IOException {
        PlainPBStoragePlugin plugin = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(store, configService);
        short year = TimeUtils.getCurrentYear();
        try (BasicContext context = new BasicContext()) {
            ArrayListEventStream events = new ArrayListEventStream(
                    year, new RemotableEventStreamDesc(DBR_TYPE, pvName, year));
            events.add((DBRTimeEvent) new POJOEvent(DBR_TYPE, ts, new ScalarValue<Long>(ts.getEpochSecond()), 0, 0).makeClone());
            plugin.appendData(context, pvName, events);
        }
    }

    private static void registerPV(String pvName) throws IOException {
        try {
            PVTypeInfo typeInfo = new PVTypeInfo(pvName, DBR_TYPE, true, 1);
            // The order of the stores of a PV is the order of the data they hold: the shortest term first.
            typeInfo.setDataStores(new String[] {STS_STORE, MTS_STORE});
            typeInfo.setApplianceIdentity(configService.getMyApplianceInfo().getIdentity());
            configService.updateTypeInfoForPV(pvName, typeInfo);
            configService.registerPVToAppliance(pvName, configService.getMyApplianceInfo());
        } catch (AlreadyRegisteredException ex) {
            throw new IOException(ex);
        }
    }

    public static Stream<Arguments> provideInstants() {
        return Stream.of(
                // In the range of the short term store: the newest sample at or before the instant is in it.
                Arguments.of(NOW),
                Arguments.of(NOW.minus(1, ChronoUnit.HOURS)),
                Arguments.of(SPLIT.plus(10, ChronoUnit.SECONDS)),
                Arguments.of(SPLIT.plus(1, ChronoUnit.SECONDS)),
                // Before the first sample of the short term store: the sample comes from the medium term store.
                Arguments.of(SPLIT),
                Arguments.of(SPLIT.minus(30, ChronoUnit.MINUTES)),
                Arguments.of(NOW.minus(10, ChronoUnit.HOURS)));
    }

    public static Stream<Arguments> provideInstantsOfTheTinyPV() {
        return Stream.of(
                // The short term store holds nothing at or before these instants: the sample comes from the medium term store.
                Arguments.of(HOUR.plus(1, ChronoUnit.MINUTES)),
                Arguments.of(HOUR.plus(10, ChronoUnit.MINUTES)),
                Arguments.of(TINY_FIRST.minus(1, ChronoUnit.SECONDS)),
                // At or after the first sample of the short term store.
                Arguments.of(TINY_FIRST),
                Arguments.of(TINY_FIRST.plus(1, ChronoUnit.SECONDS)),
                Arguments.of(TINY_FIRST.plus(30, ChronoUnit.SECONDS)));
    }

    public static Stream<Arguments> provideInstantsOfTheOneSamplePV() {
        return Stream.of(
                // Before the sample of the medium term store: the sample comes from the file of the previous day.
                Arguments.of(DAY_START.plusSeconds(30), ONE_OLDEST.plus(5, ChronoUnit.SECONDS)),
                // The only sample of the day file of the medium term store, which the short term store does not hold at or before the instant.
                Arguments.of(ONE_MTS, ONE_MTS),
                Arguments.of(ONE_MTS.plusSeconds(1), ONE_MTS),
                Arguments.of(ONE_STS.minusSeconds(1), ONE_MTS),
                // The only sample of the hour file of the short term store.
                Arguments.of(ONE_STS, ONE_STS),
                Arguments.of(ONE_STS.plusSeconds(10), ONE_STS));
    }

    @ParameterizedTest
    @MethodSource("provideInstantsOfTheOneSamplePV")
    public void testNewestSampleWhenTheFilesHoldOneSample(Instant when, Instant expected) throws Exception {
        assertNewestSample(ONE_PV_NAME, when, expected);
    }

    @ParameterizedTest
    @MethodSource("provideInstants")
    public void testNewestSampleAtOrBefore(Instant when) throws Exception {
        assertNewestSample(PV_NAME, when);
    }

    @ParameterizedTest
    @MethodSource("provideInstantsOfTheTinyPV")
    public void testNewestSampleWhenTheShortTermStoreHoldsTwoSamples(Instant when) throws Exception {
        Instant expected = when.isAfter(TINY_FIRST.plus(1, ChronoUnit.SECONDS)) ? TINY_FIRST.plus(1, ChronoUnit.SECONDS) : when;
        assertNewestSample(TINY_PV_NAME, when, expected);
    }

    private static void assertNewestSample(String pvName, Instant when) throws Exception {
        assertNewestSample(pvName, when, when);
    }

    private static void assertNewestSample(String pvName, Instant when, Instant expected) throws Exception {
        HashMap<String, HashMap<String, Object>> pvDatas = GetDataAtTime.testGetDataAtTimeForPVFromStores(
                pvName, when, Period.parse("P1D"), configService);
        HashMap<String, Object> pvData = pvDatas.get(pvName);
        Assertions.assertNotNull(pvData, "No sample at or before " + when);
        long secs = (long) pvData.get("secs");
        Assertions.assertEquals(secs, ((Number) pvData.get("val")).longValue());
        Assertions.assertEquals(expected.getEpochSecond(), secs,
                "The newest sample at or before " + when + " is the one of " + expected + ", got " + secs);
    }
}
