package org.epics.archiverappliance;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import javax.management.MBeanServerConnection;
import javax.management.ObjectName;
import javax.management.remote.JMXConnector;
import javax.management.remote.JMXConnectorFactory;
import javax.management.remote.JMXServiceURL;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * The options of the fixture for a child Tomcat: JVM options, the backgroundProcessorDelay of the Engine, JMX, the
 * exit status of a child that ended and the console lines read after it ended.
 */
@Tag("integration")
public class TomcatSetupOptionsTest {
    private static final String HEAP_OPTION = "-Xmx192m";
    private static final String PROPERTY_OPTION = "-Darchappl.fixture.optionprobe=on";
    private static final int ENGINE_DELAY_SECONDS = 1;

    @Test
    public void childTomcatGetsTheOptionsTheEngineDelayAndJmx() throws Exception {
        TomcatSetup fixture = new TomcatSetup()
                .withJvmOptions(HEAP_OPTION, PROPERTY_OPTION)
                .withEngineBackgroundProcessorDelay(ENGINE_DELAY_SECONDS)
                .withJmx();
        try {
            fixture.setUpWebApps("TomcatSetupOptions");
            String appliance = fixture.processesByAppliance.keySet().iterator().next();
            Assertions.assertNull(fixture.exitStatus(appliance), "A running Tomcat has no exit status");

            JMXServiceURL url = new JMXServiceURL(
                    "service:jmx:rmi:///jndi/rmi://127.0.0.1:" + fixture.jmxPort(appliance) + "/jmxrmi");
            try (JMXConnector connector = JMXConnectorFactory.connect(url)) {
                MBeanServerConnection connection = connector.getMBeanServerConnection();
                List<String> arguments = Arrays.asList((String[]) connection.getAttribute(
                        new ObjectName("java.lang:type=Runtime"), "InputArguments"));
                Assertions.assertTrue(arguments.contains(HEAP_OPTION), "The child JVM lacks " + HEAP_OPTION + ": " + arguments);
                Assertions.assertTrue(arguments.contains(PROPERTY_OPTION), "The child JVM lacks " + PROPERTY_OPTION + ": " + arguments);
                Assertions.assertTrue(arguments.contains("-Deaatag=eaatesttm"), "The tag of the fixture must stay: " + arguments);
                Assertions.assertEquals(ENGINE_DELAY_SECONDS,
                        ((Number) connection.getAttribute(new ObjectName("Catalina:type=Engine"), "backgroundProcessorDelay")).intValue());
            }

            int busy = fixture.currentThreadsBusy(appliance);
            Assertions.assertTrue(busy >= 0, "currentThreadsBusy must be read over JMX: " + busy);
            Assertions.assertTrue(fixture.consoleLines(appliance).stream()
                    .anyMatch(line -> line.contains("All components in this appliance have started up")));
        } finally {
            fixture.tearDown();
        }
    }

    @Test
    public void exitStatusAndTheLinesAfterTheEndAreRead() throws Exception {
        TomcatSetup fixture = new TomcatSetup();
        try {
            fixture.setUpWebApps("TomcatSetupExit");
            String appliance = fixture.processesByAppliance.keySet().iterator().next();
            Process child = fixture.processesByAppliance.get(appliance);
            int linesBeforeTheEnd = fixture.consoleLines(appliance).size();
            // Signal the child without Process.destroy, which closes the pipe of its console before the last lines are read;
            // a JVM that ends by itself, as on an OutOfMemoryError, leaves the pipe open to its end.
            child.toHandle().destroy();
            Integer status = fixture.waitForExit(appliance, 60, TimeUnit.SECONDS);
            Assertions.assertNotNull(status, "The child did not end within 60 seconds");
            Assertions.assertEquals(status, fixture.exitStatus(appliance));
            // The reader goes on to the end of the stream, so the lines that the child wrote while it ended are there.
            long deadline = System.currentTimeMillis() + 10_000;
            while (fixture.consoleLines(appliance).size() <= linesBeforeTheEnd && System.currentTimeMillis() < deadline) {
                Thread.sleep(100);
            }
            Assertions.assertTrue(fixture.consoleLines(appliance).size() > linesBeforeTheEnd,
                    "No console line was read after the child ended");
        } finally {
            fixture.tearDown();
        }
    }
}
