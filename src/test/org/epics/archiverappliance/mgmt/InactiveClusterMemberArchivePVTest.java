package org.epics.archiverappliance.mgmt;

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
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Load two paused PVs from persistence, one assigned to this appliance and one to a member that is
 * not part of this single-appliance cluster, and exercise the request-to-archive flow through the
 * mgmt BPL, replacing the browser-driven flow. The PV on this appliance reports "Paused" and stays
 * paused when re-requested; the PV assigned to the absent member reports "Not being archived" and,
 * once requested here, is picked up by this appliance ("Initial sampling"). Verifies the server.
 */
@Tag("integration")
@Tag("localEpics")
public class InactiveClusterMemberArchivePVTest {
    private static Logger logger = LogManager.getLogger(InactiveClusterMemberArchivePVTest.class.getName());
    private static final String MGMT = "http://localhost:17665/mgmt/bpl/";
    File persistenceFolder = new File(
            ConfigServiceForTests.getDefaultPBTestFolder() + File.separator + "InactiveClusterMemberArchivePVTest");
    private String pvNameToArchive1 = "UnitTestNoNamingConvention:inactive1";
    private String pvNameToArchive2 = "UnitTestNoNamingConvention:inactive2";
    TomcatSetup tomcatSetup = new TomcatSetup();
    SIOCSetup siocSetup = new SIOCSetup();

    @BeforeEach
    public void setUp() throws Exception {
        if (persistenceFolder.exists()) {
            FileUtils.deleteDirectory(persistenceFolder);
        }
        persistenceFolder.mkdirs();
        System.getProperties()
                .put(
                        ConfigService.ARCHAPPL_PERSISTENCE_LAYER,
                        "org.epics.archiverappliance.config.persistence.JDBM2Persistence");
        System.getProperties()
                .put(
                        JDBM2Persistence.ARCHAPPL_JDBM2_FILENAME,
                        persistenceFolder.getPath() + File.separator + "testconfig_appliance0.jdbm2");
        JDBM2Persistence persistenceLayer = new JDBM2Persistence();
        persistenceLayer.putTypeInfo(pvNameToArchive1, generatePVTypeInfo(pvNameToArchive1, "appliance0"));
        persistenceLayer.putTypeInfo(pvNameToArchive2, generatePVTypeInfo(pvNameToArchive2, "appliance1"));

        siocSetup.startSIOCWithDefaultDB();
        // Replace the testconfig_appliance0.jdbm2 with testconfig.jdbm2 as TomcatSetup adds this to the JDBM2 file name
        // to make the tests work in a cluster
        System.getProperties()
                .put(
                        JDBM2Persistence.ARCHAPPL_JDBM2_FILENAME,
                        persistenceFolder.getPath() + File.separator + "testconfig.jdbm2");
        tomcatSetup.setUpWebApps(this.getClass().getSimpleName());
    }

    @AfterEach
    public void tearDown() throws Exception {
        tomcatSetup.tearDown();
        siocSetup.stopSIOC();
        FileUtils.deleteDirectory(persistenceFolder);
    }

    private static String enc(String pv) {
        return URLEncoder.encode(pv, StandardCharsets.UTF_8);
    }

    private static String statusOf(String pv) {
        JSONArray status = GetUrlContent.getURLContentAsJSONArray(MGMT + "getPVStatus?pv=" + enc(pv));
        if (status == null || status.isEmpty()) {
            return "(absent)";
        }
        return String.valueOf(((JSONObject) status.get(0)).get("status"));
    }

    private static void awaitStatus(String pv, String expectedStatus, Duration atMost) {
        Awaitility.await()
                .atMost(atMost)
                .pollInterval(Duration.ofSeconds(5))
                .ignoreExceptions()
                .until(() -> expectedStatus.equals(statusOf(pv)));
    }

    @Test
    public void testRequestForArchivingThatAlreadyExistsOnInactiveMember() throws Exception {
        // Both PVs load paused from persistence. The PV assigned to this appliance reports "Paused";
        // the PV assigned to a member outside this single-appliance cluster is not archived here and
        // so reports "Not being archived".
        awaitStatus(pvNameToArchive1, "Paused", Duration.ofMinutes(3));
        awaitStatus(pvNameToArchive2, "Not being archived", Duration.ofMinutes(3));

        // Requesting to archive both: the already-paused PV stays paused; the previously unarchived
        // PV is picked up by this appliance and enters the archive workflow.
        GetUrlContent.getURLContentAsJSONArray(MGMT + "archivePV?pv=" + enc(pvNameToArchive1));
        GetUrlContent.getURLContentAsJSONArray(MGMT + "archivePV?pv=" + enc(pvNameToArchive2));
        awaitStatus(pvNameToArchive1, "Paused", Duration.ofMinutes(1));
        awaitStatus(pvNameToArchive2, "Initial sampling", Duration.ofMinutes(2));
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
        typeInfo.setPaused(true);
        return typeInfo;
    }
}
