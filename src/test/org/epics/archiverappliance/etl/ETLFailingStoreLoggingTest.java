package org.epics.archiverappliance.etl;

import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;
import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.Level;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.CapturedLog;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.etl.common.ETLJob;
import org.epics.archiverappliance.etl.common.ETLMetricsForLifetime;
import org.epics.archiverappliance.etl.common.ETLPVLookupItems;
import org.epics.archiverappliance.etl.common.ETLPassDriver;
import org.epics.archiverappliance.etl.common.ETLPassRecord;
import org.epics.archiverappliance.etl.common.OutOfSpaceHandling;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.epics.archiverappliance.utils.simulation.SimulationEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.nio.file.Files;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * What ETL logs while its destination store cannot be written, over real PlainPB stores, the shipped
 * ETLPassDriver and the shipped ETLJob. A destination root folder path that is a regular file stands for the unusable
 * store; directory creation under it fails for every user, root included. A pass over many PVs reports the failure
 * once per transition, and a job outside a pass reports once per PV, neither with a stack trace above DEBUG.
 */
public class ETLFailingStoreLoggingTest {
    private static final String PASS_PHRASE = ETLPassDriver.FAILED_PASS_PHRASE;
    private static final int PV_COUNT = 5;
    private static final int SOURCE_SECONDS = 20 * 60;
    private static final long CADENCE_SECONDS = 300;
    private final String base =
            ConfigServiceForTests.getDefaultPBTestFolder() + "/" + ETLFailingStoreLoggingTest.class.getSimpleName();
    private final String blockedPath = base + "/blocked";
    private ConfigServiceForTests configService;
    private ExecutorService worker;
    private Instant yearStart;

    @BeforeEach
    public void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1);
        FileUtils.deleteDirectory(new File(base));
        Assertions.assertTrue(new File(base + "/sts").mkdirs());
        Files.writeString(new File(blockedPath).toPath(), "not a directory");
        Assumptions.assumeFalse(new File(blockedPath + "/probe").mkdirs(), "the blocked path accepted a directory");
        worker = Executors.newSingleThreadExecutor();
        yearStart = TimeUtils.getStartOfYear(TimeUtils.getCurrentYear());
    }

    @AfterEach
    public void tearDown() throws Exception {
        worker.shutdownNow();
        configService.shutdownNow();
        FileUtils.deleteDirectory(new File(base));
    }

    private String stsUrl() {
        return "pb://localhost?name=STS&rootFolder=" + base + "/sts&partitionGranularity=PARTITION_5MIN";
    }

    private String blockedMtsUrl() {
        return "pb://localhost?name=MTS&rootFolder=" + blockedPath + "&partitionGranularity=PARTITION_HOUR";
    }

    private ETLPVLookupItems item(String pvName) throws Exception {
        return new ETLPVLookupItems(
                pvName,
                ArchDBRTypes.DBR_SCALAR_DOUBLE,
                StoragePluginURLParser.parseETLSource(stsUrl(), configService),
                StoragePluginURLParser.parseETLDest(blockedMtsUrl(), configService),
                0,
                new ETLMetricsForLifetime(0),
                OutOfSpaceHandling.DELETE_SRC_STREAMS_IF_FIRST_DEST_WHEN_OUT_OF_SPACE);
    }

    private void writeSource(String pvName) throws Exception {
        PlainPBStoragePlugin sts =
                (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(stsUrl(), configService);
        short year = TimeUtils.getCurrentYear();
        try (BasicContext context = new BasicContext()) {
            ArrayListEventStream data = new ArrayListEventStream(
                    SOURCE_SECONDS, new RemotableEventStreamDesc(ArchDBRTypes.DBR_SCALAR_DOUBLE, pvName, year));
            for (int s = 0; s < SOURCE_SECONDS; s++) {
                data.add(new SimulationEvent(s, year, ArchDBRTypes.DBR_SCALAR_DOUBLE, new ScalarValue<Double>((double) s)));
            }
            sts.appendData(context, pvName, data);
        }
    }

    private static long field(String message, String name) {
        Matcher matcher = Pattern.compile(name + "=(\\d+)").matcher(message);
        Assertions.assertTrue(matcher.find(), name + " missing in: " + message);
        return Long.parseLong(matcher.group(1));
    }

    @Test
    public void aPassOverManyPVsReportsTheFailingStoreOnce() throws Exception {
        Instant now = yearStart.plusSeconds(17 * 60 + 30);
        ETLPassDriver driver = new ETLPassDriver(0, CADENCE_SECONDS, Clock.fixed(now, ZoneOffset.UTC), name -> null, worker);
        for (int i = 0; i < PV_COUNT; i++) {
            String pvName = "ArchUnitTest:ETLFailingStore:pass" + i;
            driver.addPV(item(pvName));
            writeSource(pvName);
        }
        driver.start();

        try (CapturedLog log = new CapturedLog("org.epics.archiverappliance.etl", Level.DEBUG)) {
            ETLPassRecord record = driver.tick(now).get(60, TimeUnit.SECONDS);
            log.settle();

            long failedPartitions = record.streamsReturned() - record.partitionsMoved() - record.streamsDeletedForSpace();
            Assertions.assertTrue(failedPartitions >= PV_COUNT, "the unusable store fails partitions: " + record);

            List<CapturedLog.Entry> errors = log.at(Level.ERROR);
            List<CapturedLog.Entry> passErrors =
                    errors.stream().filter(e -> e.message().startsWith(PASS_PHRASE)).toList();
            Assertions.assertEquals(1, passErrors.size(), "pass errors among: " + errors);
            String message = passErrors.getFirst().message();
            Assertions.assertTrue(message.contains("transition=0"), message);
            Assertions.assertTrue(message.contains("source=STS destination=MTS"), message);
            Assertions.assertEquals(CADENCE_SECONDS, field(message, "cadence"), message);
            Assertions.assertTrue(message.contains("plannedAt=" + record.plannedAt()), message);
            Assertions.assertEquals(failedPartitions, field(message, "failedPartitions"), message);
            Assertions.assertEquals(PV_COUNT, field(message, "affectedPVs"), message);
            Assertions.assertTrue(message.contains("firstPV=ArchUnitTest:ETLFailingStore:pass"), message);
            Assertions.assertTrue(message.contains("firstError="), message);

            Assertions.assertEquals(1, errors.size(), "the failing store is one ERROR per pass: " + errors);
            Assertions.assertTrue(
                    errors.stream().noneMatch(CapturedLog.Entry::hasThrowable), "no stack trace above DEBUG");
            Assertions.assertTrue(
                    log.at(Level.DEBUG).stream().anyMatch(CapturedLog.Entry::hasThrowable),
                    "the stack trace stays available at DEBUG");
        }
    }

    @Test
    public void aJobOutsideAPassReportsOnceWithoutAStackTrace() throws Exception {
        String pvName = "ArchUnitTest:ETLFailingStore:alone";
        configService.getETLLookup().manualControlForUnitTests();
        PVTypeInfo typeInfo = new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        typeInfo.setDataStores(new String[] {stsUrl(), blockedMtsUrl()});
        configService.updateTypeInfoForPV(pvName, typeInfo);
        configService.registerPVToAppliance(pvName, configService.getMyApplianceInfo());
        ETLPVLookupItems item = configService.getETLLookup().getLookupItemsForPV(pvName).getFirst();
        writeSource(pvName);

        try (CapturedLog log = new CapturedLog("org.epics.archiverappliance.etl", Level.DEBUG)) {
            new ETLJob(item, yearStart.plusSeconds(17 * 60 + 30)).run();
            log.settle();

            List<CapturedLog.Entry> errors = log.at(Level.ERROR);
            Assertions.assertEquals(1, errors.size(), "one ERROR for the PV: " + errors);
            Assertions.assertTrue(errors.getFirst().message().contains(pvName), errors.getFirst().message());
            Assertions.assertTrue(errors.getFirst().message().contains("failed to move"), errors.getFirst().message());
            Assertions.assertFalse(errors.getFirst().hasThrowable(), "no stack trace above DEBUG");
            Assertions.assertTrue(
                    log.at(Level.DEBUG).stream().anyMatch(CapturedLog.Entry::hasThrowable),
                    "the stack trace stays available at DEBUG");
        }
    }
}
