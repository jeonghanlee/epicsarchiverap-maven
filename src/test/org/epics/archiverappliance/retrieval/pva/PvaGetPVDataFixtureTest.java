package org.epics.archiverappliance.retrieval.pva;

import org.epics.pva.PVASettings;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.net.DatagramSocket;
import java.net.InetAddress;
import java.util.List;
import java.util.concurrent.TimeoutException;

@Tag("integration")
public class PvaGetPVDataFixtureTest {
    @Test
    public void cleansUpAfterManagementChannelConnectionFails() throws Exception {
        String originalAddresses = PVASettings.EPICS_PVA_ADDR_LIST;
        boolean originalAutoAddresses = PVASettings.EPICS_PVA_AUTO_ADDR_LIST;
        try (DatagramSocket unansweredSearch = new DatagramSocket(0, InetAddress.getLoopbackAddress())) {
            // A real UDP endpoint accepts searches without advertising a PVA service.
            PVASettings.EPICS_PVA_ADDR_LIST = "127.0.0.1:" + unansweredSearch.getLocalPort();
            PVASettings.EPICS_PVA_AUTO_ADDR_LIST = false;
            Assertions.assertThrows(TimeoutException.class, PvaGetPVDataTest::setup);

            List<ProcessHandle> tomcats = ProcessHandle.current().descendants()
                    .filter(process -> process.info().commandLine().orElse("")
                            .contains("tomcat_PvaGetPVDataTest/"))
                    .toList();
            Assertions.assertFalse(tomcats.isEmpty(), "The real Tomcat fixture must have started");
            Assertions.assertDoesNotThrow(PvaGetPVDataTest::tearDown);
            for (ProcessHandle process : tomcats) {
                Assertions.assertFalse(process.isAlive(), "Partial setup failure left Tomcat running");
            }
            Assertions.assertDoesNotThrow(PvaGetPVDataTest::tearDown);
        } finally {
            PVASettings.EPICS_PVA_ADDR_LIST = originalAddresses;
            PVASettings.EPICS_PVA_AUTO_ADDR_LIST = originalAutoAddresses;
            // Keep a regression against broken cleanup from leaking its own Tomcat.
            PvaGetPVDataTest.tomcatSetup.tearDown();
        }
    }
}
