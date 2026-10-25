package org.epics.archiverappliance.etl;

import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;
import org.apache.commons.io.FileUtils;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.etl.common.ETLJob;
import org.epics.archiverappliance.etl.common.ETLPVLookupItems;
import org.epics.archiverappliance.etl.common.ETLRunReport;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.epics.archiverappliance.utils.simulation.SimulationEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.nio.file.Files;
import java.time.Instant;

/**
 * The run report an ETL job leaves on its lookup item, over real PlainPB stores:
 * a normal move and a destination that cannot be written. A destination root folder path that is a regular
 * file stands for the unusable store; directory creation under it fails for every user, root included.
 */
public class ETLJobRunReportTest {
    private static final int PARTITION_SECONDS = 300;
    private static final int PARTITIONS_WRITTEN = 3;
    private final String base =
            ConfigServiceForTests.getDefaultPBTestFolder() + "/" + ETLJobRunReportTest.class.getSimpleName();
    private final String stsFolder = base + "/sts";
    private final String mtsFolder = base + "/mts";
    private final String blockedPath = base + "/blocked";
    private ConfigServiceForTests configService;

    @BeforeEach
    public void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1);
        FileUtils.deleteDirectory(new File(base));
        Assertions.assertTrue(new File(stsFolder).mkdirs());
        Assertions.assertTrue(new File(mtsFolder).mkdirs());
        Files.writeString(new File(blockedPath).toPath(), "not a directory");
    }

    @AfterEach
    public void tearDown() throws Exception {
        configService.shutdownNow();
        FileUtils.deleteDirectory(new File(base));
    }

    private String store(String name, String rootFolder, String granularity) throws Exception {
        PlainPBStoragePlugin plugin = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=" + name + "&rootFolder=" + rootFolder + "&partitionGranularity=" + granularity,
                configService);
        return plugin.getURLRepresentation();
    }

    private ETLPVLookupItems register(String pvName, String stsUrl, String mtsUrl) throws Exception {
        PVTypeInfo typeInfo = new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        typeInfo.setDataStores(new String[] {stsUrl, mtsUrl});
        configService.updateTypeInfoForPV(pvName, typeInfo);
        configService.registerPVToAppliance(pvName, configService.getMyApplianceInfo());
        configService.getETLLookup().manualControlForUnitTests();
        return configService.getETLLookup().getLookupItemsForPV(pvName).getFirst();
    }

    /** Writes one sample per second over PARTITIONS_WRITTEN source partitions from the start of the year. */
    private void writeSource(String pvName, String stsUrl) throws Exception {
        PlainPBStoragePlugin sts = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(stsUrl, configService);
        short year = TimeUtils.getCurrentYear();
        int count = PARTITIONS_WRITTEN * PARTITION_SECONDS;
        try (BasicContext context = new BasicContext()) {
            ArrayListEventStream data = new ArrayListEventStream(
                    count, new RemotableEventStreamDesc(ArchDBRTypes.DBR_SCALAR_DOUBLE, pvName, year));
            for (int s = 0; s < count; s++) {
                data.add(new SimulationEvent(s, year, ArchDBRTypes.DBR_SCALAR_DOUBLE, new ScalarValue<Double>((double) s)));
            }
            sts.appendData(context, pvName, data);
        }
    }

    /** Processing time inside the last written partition, so every earlier partition is eligible. */
    private Instant processingTime() {
        return TimeUtils.getStartOfYear(TimeUtils.getCurrentYear())
                .plusSeconds((long) (PARTITIONS_WRITTEN - 1) * PARTITION_SECONDS + 10);
    }

    @Test
    public void reportsTheMovedPartitions() throws Exception {
        String pvName = "ArchUnitTest:ETLJobRunReport:normal";
        String stsUrl = store("STS", stsFolder, "PARTITION_5MIN");
        ETLPVLookupItems item = register(pvName, stsUrl, store("MTS", mtsFolder, "PARTITION_HOUR"));
        writeSource(pvName, stsUrl);

        new ETLJob(item, processingTime()).run();

        ETLRunReport report = item.getLastRunReport();
        Assertions.assertNotNull(report);
        Assertions.assertTrue(report.streamsCompleted());
        Assertions.assertEquals(PARTITIONS_WRITTEN - 1, report.streamsReturned());
        Assertions.assertEquals(PARTITIONS_WRITTEN - 1, report.partitionsMoved());
        Assertions.assertTrue(report.bytesMoved() > 0);
        Assertions.assertEquals(0, report.streamsDeletedForSpace());
        Assertions.assertTrue(report.commitAttempted());
        Assertions.assertTrue(report.commitSucceeded());
    }

    @Test
    public void reportsAnUnwritableDestination() throws Exception {
        Assumptions.assumeFalse(new File(blockedPath + "/probe").mkdirs(), "the blocked path accepted a directory");
        String pvName = "ArchUnitTest:ETLJobRunReport:blockeddest";
        String stsUrl = store("STS", stsFolder, "PARTITION_5MIN");
        ETLPVLookupItems item = register(pvName, stsUrl, store("MTS", blockedPath, "PARTITION_HOUR"));
        writeSource(pvName, stsUrl);

        new ETLJob(item, processingTime()).run();

        ETLRunReport report = item.getLastRunReport();
        Assertions.assertNotNull(report);
        Assertions.assertTrue(report.streamsCompleted());
        Assertions.assertEquals(PARTITIONS_WRITTEN - 1, report.streamsReturned());
        Assertions.assertEquals(0, report.partitionsMoved());
        Assertions.assertTrue(report.streamsReturned() > report.partitionsMoved() + report.streamsDeletedForSpace());
    }
}
