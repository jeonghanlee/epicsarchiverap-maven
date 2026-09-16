package org.epics.archiverappliance;

import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;

@Tag("integration")
public class TomcatSetupTest {
    @Test
    public void rejectsOccupiedPortAndCanStartAgain() throws Exception {
        TomcatSetup fixture = new TomcatSetup();
        try {
            try (ServerSocket occupiedPort = new ServerSocket()) {
                occupiedPort.bind(new InetSocketAddress(
                        InetAddress.getLoopbackAddress(), ConfigServiceForTests.RETRIEVAL_TEST_PORT));
                Assertions.assertThrows(IOException.class,
                        () -> fixture.setUpWebApps("TomcatSetupTestOccupiedPort"));
                Assertions.assertFalse(fixture.watchedProcesses.isEmpty());
                for (Process process : fixture.watchedProcesses) {
                    Assertions.assertFalse(process.isAlive(), "Failed startup left Tomcat running");
                }
            }

            fixture.setUpWebApps("TomcatSetupTestRecovery");
            Process process = fixture.watchedProcesses.getLast();
            Assertions.assertTrue(process.isAlive(), "Successful startup must leave Tomcat running");
            fixture.tearDown();
            Assertions.assertFalse(process.isAlive(), "Teardown must wait for Tomcat to exit");
            fixture.tearDown();
        } finally {
            fixture.tearDown();
        }
    }
}
