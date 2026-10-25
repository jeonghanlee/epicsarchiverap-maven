package org.epics.archiverappliance.mgmt;

import org.apache.logging.log4j.Level;
import org.epics.archiverappliance.common.CapturedLog;
import org.epics.archiverappliance.config.ConfigService.WAR_FILE;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

/**
 * The archive PV workflow tick of the shipped MgmtRuntimeState writes its per-tick lines below INFO, so a deployed
 * mgmt at the default level writes none of them. The tick runs on the real scheduler; the first tick is immediate.
 * The test configuration starts the workflow after 10 seconds and the test marks the appliance as having loaded its
 * PVs, so the tick goes past the cluster initialization check. The test captures at DEBUG, judges the level of each
 * captured event, and requires both lines to appear so that a tick that never ran cannot pass.
 */
public class MgmtWorkflowTickLoggingTest {
    private static final String TICK_LINE = "Running the archive PV workflow with ";
    private static final String CLUSTER_LINE = "Appliances that have loaded their PVs";
    private static final long TICK_WAIT_MS = 30000;
    private ConfigServiceForTests configService;

    @BeforeEach
    public void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1) {
            {
                appliancesConfigLoaded.put(getMyApplianceInfo().getIdentity(), Boolean.TRUE);
            }
        };
    }

    @AfterEach
    public void tearDown() throws Exception {
        configService.shutdownNow();
    }

    @Test
    public void theTickWritesNoInfoLine() throws Exception {
        try (CapturedLog log = new CapturedLog("org.epics.archiverappliance", Level.DEBUG)) {
            MgmtRuntimeState state = configService.getMgmtRuntimeState();
            state.componentStartedUp(WAR_FILE.ENGINE);
            state.componentStartedUp(WAR_FILE.ETL);
            state.componentStartedUp(WAR_FILE.RETRIEVAL);
            long deadline = System.currentTimeMillis() + TICK_WAIT_MS;
            while (System.currentTimeMillis() < deadline
                    && log.entries().stream().noneMatch(e -> e.message().startsWith(TICK_LINE))) {
                Thread.sleep(200);
            }
            log.settle();

            List<CapturedLog.Entry> tick =
                    log.entries().stream().filter(e -> e.message().startsWith(TICK_LINE)).toList();
            List<CapturedLog.Entry> cluster =
                    log.entries().stream().filter(e -> e.message().startsWith(CLUSTER_LINE)).toList();
            Assertions.assertFalse(tick.isEmpty(), "the tick ran: " + log.entries());
            Assertions.assertFalse(cluster.isEmpty(), "the cluster initialization check ran");
            for (CapturedLog.Entry entry : tick) {
                Assertions.assertEquals(Level.DEBUG, entry.level(), entry.message());
            }
            for (CapturedLog.Entry entry : cluster) {
                Assertions.assertEquals(Level.DEBUG, entry.level(), entry.message());
                Assertions.assertTrue(
                        entry.message().startsWith(CLUSTER_LINE + ": "), "names follow a separator: " + entry.message());
            }
        }
    }
}
