package org.epics.archiverappliance.etl;

import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;
import org.apache.commons.io.FileUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.etl.common.ETLPVLookupItems;
import org.epics.archiverappliance.etl.common.ETLPassDriver;
import org.epics.archiverappliance.etl.common.ETLPassRecord;
import org.epics.archiverappliance.etl.common.PBThreeTierETLPVLookup;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;

/**
 * The ETL lookup reads the current time from the clock and the skip-store variable from the environment
 * reader it is constructed with, so tests control both at the outermost boundary while the drivers, the
 * jobs and the stores under test are the shipped ones.
 */
public class ETLLookupClockAndEnvironmentTest {
    private final String base = ConfigServiceForTests.getDefaultPBTestFolder() + "/"
            + ETLLookupClockAndEnvironmentTest.class.getSimpleName();
    private ConfigServiceForTests configService;
    private PBThreeTierETLPVLookup lookup;

    @BeforeEach
    public void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1);
        FileUtils.deleteDirectory(new File(base));
        Assertions.assertTrue(new File(base + "/sts").mkdirs());
        Assertions.assertTrue(new File(base + "/mts").mkdirs());
    }

    @AfterEach
    public void tearDown() throws Exception {
        if (lookup != null) {
            lookup.manualControlForUnitTests();
        }
        configService.shutdownNow();
        FileUtils.deleteDirectory(new File(base));
    }

    private ETLPVLookupItems addPV(String pvName, Clock clock, Function<String, String> environmentReader)
            throws Exception {
        PlainPBStoragePlugin sts = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=STS&rootFolder=" + base + "/sts&partitionGranularity=PARTITION_5MIN",
                configService);
        PlainPBStoragePlugin mts = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=MTS&rootFolder=" + base + "/mts&partitionGranularity=PARTITION_HOUR",
                configService);
        PVTypeInfo typeInfo = new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        typeInfo.setDataStores(new String[] {sts.getURLRepresentation(), mts.getURLRepresentation()});
        configService.updateTypeInfoForPV(pvName, typeInfo);
        lookup = new PBThreeTierETLPVLookup(configService, clock, environmentReader);
        lookup.addETLJobsForUnitTests(pvName, typeInfo);
        return lookup.getLookupItemsForPV(pvName).getFirst();
    }

    private ETLPassRecord runOnePass(ETLPVLookupItems item, Clock clock) throws Exception {
        ETLPassDriver driver = lookup.getDriverFor(item);
        Assertions.assertNotNull(driver, "the PV joined a driver");
        driver.start();
        return driver.tick(clock.instant()).get(60, TimeUnit.SECONDS);
    }

    @Test
    public void skipStoreNameComesFromTheEnvironmentReader() throws Exception {
        Function<String, String> reader =
                name -> PBThreeTierETLPVLookup.SKIP_ETL_FOR_STORE_ENV.equals(name) ? "MTS" : null;
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:02:00Z"), ZoneOffset.UTC);
        ETLPVLookupItems item = addPV("ArchUnitTest:ETLLookupEnv:skip", clock, reader);

        ETLPassRecord record = runOnePass(item, clock);
        Assertions.assertEquals(1, record.jobsSkipped(), "the job into the named store is skipped");
        Assertions.assertEquals(0, record.jobsRun());
        Assertions.assertNull(item.getLastRunReport(), "no job ran for the skipped store");
    }

    @Test
    public void unsetSkipVariableRunsTheJob() throws Exception {
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:02:00Z"), ZoneOffset.UTC);
        ETLPVLookupItems item = addPV("ArchUnitTest:ETLLookupEnv:noskip", clock, name -> null);

        ETLPassRecord record = runOnePass(item, clock);
        Assertions.assertEquals(1, record.jobsRun());
        Assertions.assertEquals(0, record.jobsSkipped());
        Assertions.assertNotNull(item.getLastRunReport(), "the job ran and left its report");
    }

    @Test
    public void thePlanComesFromTheClock() throws Exception {
        // Two minutes into a 5-minute partition: the start-up pass is planned at 00:02, and the grid of
        // transition 0 (boundary plus 5 minutes) puts the next pass at 00:05.
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:02:00Z"), ZoneOffset.UTC);
        ETLPVLookupItems item = addPV("ArchUnitTest:ETLLookupEnv:clock", clock, name -> null);

        ETLPassRecord record = runOnePass(item, clock);
        Assertions.assertEquals(Instant.parse("2026-01-01T00:02:00Z"), record.plannedAt());
        Assertions.assertEquals(Instant.parse("2026-01-01T00:01:00Z"), record.processingTime());
        Assertions.assertEquals(
                Instant.parse("2026-01-01T00:05:00Z"), lookup.getDriverFor(item).getNextPlannedAt());
    }
}
