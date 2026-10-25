package org.epics.archiverappliance.mgmt.pva;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.awaitility.Awaitility;
import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.mgmt.pva.actions.NTUtil;
import org.epics.archiverappliance.mgmt.pva.actions.PvaArchivePVAction;
import org.epics.archiverappliance.mgmt.pva.actions.PvaGetArchivedPVs;
import org.epics.pva.client.PVAChannel;
import org.epics.pva.client.PVAClient;
import org.epics.pva.data.PVAStringArray;
import org.epics.pva.data.PVAStructure;
import org.epics.pva.data.nt.PVATable;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.epics.archiverappliance.mgmt.pva.PvaMgmtService.PVA_MGMT_SERVICE;

/**
 * {@link PvaGetArchivedPVs}
 *
 * @author Kunal Shroff
 *
 */
@Tag("integration")
@Tag("localEpics")
public class PvaGetArchivedPVsTest {

    private static final Logger logger = LogManager.getLogger(PvaGetArchivedPVsTest.class.getName());
    private static final Duration ARCHIVE_TIMEOUT = Duration.ofMinutes(2);
    private static final Duration ARCHIVE_POLL_INTERVAL = Duration.ofSeconds(1);

    static TomcatSetup tomcatSetup = new TomcatSetup();
    static SIOCSetup siocSetup = new SIOCSetup();

    private static PVAClient pvaClient;
    private static PVAChannel pvaChannel;

    @BeforeAll
    public static void setup() throws Exception {
        logger.info("Set up for the PvaGetArchivedPVsTest");
        siocSetup.startSIOCWithDefaultDB();
        tomcatSetup.setUpWebApps(PvaGetArchivedPVsTest.class.getSimpleName());
        pvaClient = new PVAClient();
        pvaChannel = pvaClient.getChannel(PVA_MGMT_SERVICE);
        pvaChannel.connect().get(5, TimeUnit.SECONDS);
    }

    @AfterAll
    public static void tearDown() {
        logger.info("Tear Down for the PvaGetArchivedPVsTest");
        Assertions.assertAll("PVA management fixture cleanup",
                () -> { if (pvaChannel != null) pvaChannel.close(); },
                () -> { if (pvaClient != null) pvaClient.close(); },
                tomcatSetup::tearDown,
                siocSetup::stopSIOC);
        pvaChannel = null;
        pvaClient = null;
    }

    @Test
    public void archivedPVTest() {
        List<String> pvNamesAll = new ArrayList<String>(1000);
        List<String> pvNamesEven = new ArrayList<String>(500);
        List<String> pvNamesOdd = new ArrayList<String>(500);
        List<String> expectedStatus = new ArrayList<String>(1000);
        for (int i = 0; i < 1000; i++) {
            pvNamesAll.add("test_" + i);
            if (i % 2 == 0) {
                pvNamesEven.add("test_" + i);
                expectedStatus.add("Archived");
            } else {
                pvNamesOdd.add("test_" + i);
                expectedStatus.add("Not Archived");
            }
        }

        try {
            // Submit all the even named pv's to be archived
            PVATable archivePvReqTable = PVATable.PVATableBuilder.aPVATable()
                    .name(PvaArchivePVAction.NAME)
                    .descriptor(PvaArchivePVAction.NAME)
                    .addColumn(new PVAStringArray("pv", pvNamesEven.toArray(new String[pvNamesEven.size()])))
                    .build();
            pvaChannel.invoke(archivePvReqTable).get(30, TimeUnit.SECONDS);

            PVATable archivedPvStatusReqTable = PVATable.PVATableBuilder.aPVATable()
                    .name(PvaArchivePVAction.NAME)
                    .descriptor(PvaGetArchivedPVs.NAME)
                    .addColumn(new PVAStringArray("pv", pvNamesAll.toArray(new String[pvNamesAll.size()])))
                    .build();
            Awaitility.await("Archived PV names and statuses")
                    .pollInterval(ARCHIVE_POLL_INTERVAL)
                    .atMost(ARCHIVE_TIMEOUT)
                    .untilAsserted(() -> {
                        PVAStructure result = pvaChannel.invoke(archivedPvStatusReqTable).get(30, TimeUnit.SECONDS);
                        Assertions.assertArrayEquals(
                                pvNamesAll.toArray(new String[1000]),
                                NTUtil.extractStringArray(PVATable.fromStructure(result).getColumn("pv")));
                        Assertions.assertArrayEquals(
                                expectedStatus.toArray(new String[1000]),
                                NTUtil.extractStringArray(PVATable.fromStructure(result).getColumn("status")));
                    });
        } catch (Exception e) {
            e.printStackTrace();
            Assertions.fail(e.getMessage());
        }
    }
}
