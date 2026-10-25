package org.epics.archiverappliance.mgmt.pauseresume;

import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.awaitility.Awaitility;
import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.config.persistence.JDBM2Persistence;
import org.epics.archiverappliance.mgmt.policy.PolicyConfig.SamplingMethod;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Create a paused PV in persistence, start the appserver, and delete the PV through the mgmt BPL,
 * replacing the former browser-driven flow. The PV loads paused; after deletePV it must report as
 * not being archived. Verifies the server workflow rather than the UI.
 */
@Tag("integration")
@Tag("localEpics")
public class DeletePVAfterRestartTest {
    private static final Logger logger = LogManager.getLogger(DeletePVAfterRestartTest.class.getName());
    private final File persistenceFolder = new File(ConfigServiceForTests.getDefaultPBTestFolder() + File.separator + "DeletePVTest");

    private final String pvPrefix = DeletePVAfterRestartTest.class.getSimpleName();
    private final String pvNameToArchive = pvPrefix + "UnitTestNoNamingConvention:sine";
    TomcatSetup tomcatSetup = new TomcatSetup();
    SIOCSetup siocSetup = new SIOCSetup(pvPrefix);

    @BeforeEach
    public void setUp() throws Exception {
        if (persistenceFolder.exists()) {
            FileUtils.deleteDirectory(persistenceFolder);
        }
        persistenceFolder.mkdirs();
        System.getProperties().put(ConfigService.ARCHAPPL_PERSISTENCE_LAYER, "org.epics.archiverappliance.config.persistence.JDBM2Persistence");
        System.getProperties().put(JDBM2Persistence.ARCHAPPL_JDBM2_FILENAME, persistenceFolder.getPath() + File.separator + "testconfig_appliance0.jdbm2");
        JDBM2Persistence persistenceLayer = new JDBM2Persistence();
        persistenceLayer.putTypeInfo(pvNameToArchive, generatePVTypeInfo(pvNameToArchive, "appliance0"));

        siocSetup.startSIOCWithDefaultDB();
        // Replace the testconfig_appliance0.jdbm2 with testconfig.jdbm2 as TomcatSetup adds this to the JDBM2 file name to make the tests work in a cluster
        System.getProperties().put(JDBM2Persistence.ARCHAPPL_JDBM2_FILENAME, persistenceFolder.getPath() + File.separator + "testconfig.jdbm2");
        tomcatSetup.setUpWebApps(this.getClass().getSimpleName());
    }

    @AfterEach
    public void tearDown() throws Exception {
        tomcatSetup.tearDown();
        siocSetup.stopSIOC();
    }

    private static String statusOf(String getPVStatusUrl) {
        JSONArray status = GetUrlContent.getURLContentAsJSONArray(getPVStatusUrl);
        if (status == null || status.isEmpty()) {
            return "(absent)";
        }
        return String.valueOf(((JSONObject) status.get(0)).get("status"));
    }

    @Test
    public void testSimpleDeletePV() throws Exception {
        String mgmtUrl = "http://localhost:17665/mgmt/bpl/";
        String encoded = URLEncoder.encode(pvNameToArchive, StandardCharsets.UTF_8);
        String getPVStatusUrl = mgmtUrl + "getPVStatus?pv=" + encoded;
        String deleteUrl = mgmtUrl + "deletePV?pv=" + encoded;
        logger.info("The PV " + pvNameToArchive + " loads paused from persistence; deleting it");

        // The PV loads paused from persistence.
        awaitStatus(null, getPVStatusUrl, "Paused", Duration.ofMinutes(3));
        // Deleting a paused PV must leave it not being archived.
        awaitStatus(deleteUrl, getPVStatusUrl, "Not being archived", Duration.ofMinutes(2));
    }

    private static void awaitStatus(String actionUrl, String getPVStatusUrl, String expectedStatus, Duration atMost) {
        Awaitility.await()
                .atMost(atMost)
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> {
                    if (actionUrl != null) {
                        GetUrlContent.getURLContentAsJSONObject(actionUrl);
                    }
                    return expectedStatus.equals(statusOf(getPVStatusUrl));
                });
    }

    private static PVTypeInfo generatePVTypeInfo(String pvName, String applianceIdentity) {
        PVTypeInfo typeInfo = new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, false, 1);
        typeInfo.setUpperDisplayLimit(Double.valueOf(1.0));
        typeInfo.setLowerDisplayLimit(Double.valueOf(-1.0));
        typeInfo.setHasReducedDataSet(true);
        typeInfo.setComputedEventRate(1.0f);
        typeInfo.setComputedStorageRate(12.0f);
        typeInfo.setUserSpecifiedEventRate(1.0f);
        typeInfo.setApplianceIdentity(applianceIdentity);
        typeInfo.addArchiveField("HIHI");
        typeInfo.addArchiveField("LOLO");
        typeInfo.setSamplingPeriod(1.0f);
        typeInfo.setSamplingMethod(SamplingMethod.MONITOR);
        typeInfo.setPaused(true);
        typeInfo.setDataStores(new String[] {
                "pb://localhost?name=STS&rootFolder=${ARCHAPPL_SHORT_TERM_FOLDER}&partitionGranularity=PARTITION_HOUR",
                "pb://localhost?name=MTS&rootFolder=${ARCHAPPL_MEDIUM_TERM_FOLDER}&partitionGranularity=PARTITION_DAY",
                "pb://localhost?name=LTS&rootFolder=${ARCHAPPL_LONG_TERM_FOLDER}&partitionGranularity=PARTITION_YEAR"
        });
        return typeInfo;
    }
}
