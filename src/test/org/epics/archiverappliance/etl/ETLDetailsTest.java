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
import org.epics.archiverappliance.etl.common.ETLDetails;
import org.epics.archiverappliance.etl.common.ETLJob;
import org.epics.archiverappliance.etl.common.ETLPVLookupItems;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.epics.archiverappliance.utils.simulation.SimulationEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * The per-PV ETL details rows after a real ETL job over PlainPB stores. Each phase-time row must carry the
 * total of its own phase. The job's own millisecond timings can be zero or equal, so distinct known amounts are
 * added to the two post-move phases through the production accumulator before the rows are read.
 */
public class ETLDetailsTest {
    private static final int PARTITION_SECONDS = 300;
    private static final int PARTITIONS_WRITTEN = 3;
    private static final long ADDED_RUN_POST_PROCESSORS_MS = 1_000_000L;
    private static final long ADDED_EXECUTE_POST_ETL_TASKS_MS = 3_000_000L;
    private static final String PV_NAME = "ArchUnitTest:ETLDetails:phaseTimes";
    private final String base =
            ConfigServiceForTests.getDefaultPBTestFolder() + "/" + ETLDetailsTest.class.getSimpleName();
    private final String stsFolder = base + "/sts";
    private final String mtsFolder = base + "/mts";
    private ConfigServiceForTests configService;

    @BeforeEach
    public void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1);
        FileUtils.deleteDirectory(new File(base));
        Assertions.assertTrue(new File(stsFolder).mkdirs());
        Assertions.assertTrue(new File(mtsFolder).mkdirs());
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

    /** Writes one sample per second over PARTITIONS_WRITTEN source partitions from the start of the year. */
    private void writeSource(String stsUrl) throws Exception {
        PlainPBStoragePlugin sts = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(stsUrl, configService);
        short year = TimeUtils.getCurrentYear();
        int count = PARTITIONS_WRITTEN * PARTITION_SECONDS;
        try (BasicContext context = new BasicContext()) {
            ArrayListEventStream data = new ArrayListEventStream(
                    count, new RemotableEventStreamDesc(ArchDBRTypes.DBR_SCALAR_DOUBLE, PV_NAME, year));
            for (int s = 0; s < count; s++) {
                data.add(new SimulationEvent(s, year, ArchDBRTypes.DBR_SCALAR_DOUBLE, new ScalarValue<Double>((double) s)));
            }
            sts.appendData(context, PV_NAME, data);
        }
    }

    /** Returns the value of the single details row with the given name. */
    private static String rowValue(List<Map<String, String>> rows, String name) {
        List<String> values = rows.stream()
                .filter(row -> name.equals(row.get("name")))
                .map(row -> row.get("value"))
                .toList();
        Assertions.assertEquals(1, values.size(), "rows named " + name);
        return values.getFirst();
    }

    @Test
    public void phaseTimeRowsCarryTheirOwnPhase() throws Exception {
        String stsUrl = store("STS", stsFolder, "PARTITION_5MIN");
        PVTypeInfo typeInfo = new PVTypeInfo(PV_NAME, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        typeInfo.setDataStores(new String[] {stsUrl, store("MTS", mtsFolder, "PARTITION_HOUR")});
        configService.updateTypeInfoForPV(PV_NAME, typeInfo);
        configService.registerPVToAppliance(PV_NAME, configService.getMyApplianceInfo());
        configService.getETLLookup().manualControlForUnitTests();
        ETLPVLookupItems item = configService.getETLLookup().getLookupItemsForPV(PV_NAME).getFirst();
        writeSource(stsUrl);

        Instant processingTime = TimeUtils.getStartOfYear(TimeUtils.getCurrentYear())
                .plusSeconds((long) (PARTITIONS_WRITTEN - 1) * PARTITION_SECONDS + 10);
        new ETLJob(item, processingTime).run();
        Assertions.assertEquals(PARTITIONS_WRITTEN - 1, item.getLastRunReport().partitionsMoved());
        Assertions.assertEquals(1, item.getNumberofTimesWeETLed());

        item.addInfoAboutDetailedTime(
                0, 0, 0, 0, 0, 0, ADDED_RUN_POST_PROCESSORS_MS, ADDED_EXECUTE_POST_ETL_TASKS_MS, 0);
        Assertions.assertNotEquals(item.getTime4runPostProcessors(), item.getTime4executePostETLTasks());

        List<Map<String, String>> rows = new ETLDetails(PV_NAME).details(configService);
        String order = Integer.toString(item.getLifetimeorder());
        Assertions.assertEquals(
                Long.toString(item.getTime4runPostProcessors()),
                rowValue(rows, "ETL Total time spent by runPostProcessors() in ETL(" + order + ") (ms)"));
        Assertions.assertEquals(
                Long.toString(item.getTime4executePostETLTasks()),
                rowValue(rows, "ETL Total time spent by executePostETLTasks() in ETL(" + order + ") (ms)"));
    }
}
