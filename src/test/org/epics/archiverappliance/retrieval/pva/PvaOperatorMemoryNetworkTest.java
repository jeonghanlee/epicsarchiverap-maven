package org.epics.archiverappliance.retrieval.pva;

import org.epics.archiverappliance.retrieval.RetrievalMemoryNetworkFixture;
import org.epics.pva.PVASettings;
import org.epics.pva.client.PVAClient;
import org.epics.pva.data.PVAAnyArray;
import org.epics.pva.data.PVAStructure;
import org.epics.pva.data.nt.PVAURI;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.net.DatagramSocket;
import java.nio.file.Files;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Sends the PVAccess call with a long list of names to the built retrieval WAR on a fixture-owned JVM with the heap of
 * the memory tests. The names are separated by semicolons in the {@code pv} argument. The candidate passes when the
 * call is refused with a named condition in the retrieval log or completes whole, and the JVM is alive without an
 * OutOfMemoryError.
 */
@Tag("integration")
public class PvaOperatorMemoryNetworkTest {
    private static final String APPLIANCE = "appliance0";
    private static final int NAMES = Integer.getInteger("archappl.memory.test.listNames", 10_000);

    @FunctionalInterface
    private interface NetworkCase {
        void run(RetrievalMemoryNetworkFixture server) throws Exception;
    }

    /** The discovery port is private to this test, so that no other PVAccess server answers the client. */
    private static void withServer(NetworkCase test) throws Exception {
        int port;
        try (DatagramSocket reservation = new DatagramSocket(0)) { port = reservation.getLocalPort(); }
        String originalAddress = PVASettings.EPICS_PVA_ADDR_LIST;
        String originalNames = PVASettings.EPICS_PVA_NAME_SERVERS;
        boolean originalAuto = PVASettings.EPICS_PVA_AUTO_ADDR_LIST;
        int originalBroadcast = PVASettings.EPICS_PVA_BROADCAST_PORT;
        PVASettings.EPICS_PVA_ADDR_LIST = "127.0.0.1:" + port;
        PVASettings.EPICS_PVA_NAME_SERVERS = "";
        PVASettings.EPICS_PVA_AUTO_ADDR_LIST = false;
        PVASettings.EPICS_PVA_BROADCAST_PORT = port;
        try (var server = new RetrievalMemoryNetworkFixture(null, false,
                "-DEPICS_PVAS_BROADCAST_PORT=" + port, "-DEPICS_PVA_BROADCAST_PORT=" + port)) {
            test.run(server);
        } finally {
            PVASettings.EPICS_PVA_ADDR_LIST = originalAddress;
            PVASettings.EPICS_PVA_NAME_SERVERS = originalNames;
            PVASettings.EPICS_PVA_AUTO_ADDR_LIST = originalAuto;
            PVASettings.EPICS_PVA_BROADCAST_PORT = originalBroadcast;
        }
    }

    private static String repeated(int count) {
        return String.join(";", java.util.Collections.nCopies(count, RetrievalMemoryNetworkFixture.PV));
    }

    /**
     * Distinct names that all name the registered PV, as {@code operator(name)} with a different operator argument.
     * A name that is not archived makes the server fail the call at the first such name, and the client library then
     * leaves the call pending, so such a list measures nothing about its length.
     */
    private static String distinctValid(int count) {
        StringBuilder names = new StringBuilder();
        for (int i = 1; i <= count; i++) {
            names.append(i == 1 ? "" : ";").append("mean_").append(i).append('(')
                    .append(RetrievalMemoryNetworkFixture.PV).append(')');
        }
        return names.toString();
    }

    private void check(String label, String names) throws Exception {
        withServer(server -> {
            String result;
            String detail;
            long peakHeap;
            long peakCollected;
            try (var peak = server.startHeapPeak(); var client = new PVAClient()) {
                var channel = client.getChannel(PvaDataRetrievalService.PVA_DATA_SERVICE);
                assertTrue(channel.connect().get(30, TimeUnit.SECONDS));
                var query = new PVAURI("name", "pva", null, PvaGetPVData.NAME, Map.of("pv", names,
                        "from", RetrievalMemoryNetworkFixture.FROM.toString(),
                        "to", RetrievalMemoryNetworkFixture.FROM.plusSeconds(3600).toString()));
                var request = channel.invoke(query);
                String refusal = "";
                try {
                    PVAStructure response = request.get(120, TimeUnit.SECONDS);
                    PVAAnyArray values = response.get("value");
                    result = "completed";
                    detail = "entries=" + values.get().length;
                } catch (TimeoutException timeout) {
                    request.cancel(true);
                    refusal = server.tomcat.consoleLines(APPLIANCE).stream()
                            .filter(line -> line.contains("Retrieval memory pressure:")
                                    || line.contains("Retrieval memory admission refused:")
                                    || line.contains("exceeds request budget"))
                            .findFirst().orElse("");
                    result = refusal.isEmpty() ? "failed" : "refused";
                    detail = "the call stayed pending for 120 s; refusalLog=[" + refusal + "]";
                } catch (Exception failure) {
                    result = "failed";
                    detail = failure.toString();
                }
                peakHeap = peak.peak();
                peakCollected = peak.peakCollected();
            }
            boolean alive = server.tomcat.exitStatus(APPLIANCE) == null;
            boolean exhausted = server.tomcat.consoleLines(APPLIANCE).stream()
                    .anyMatch(line -> line.contains("java.lang.OutOfMemoryError"));
            try (var files = Files.list(server.evidence)) {
                exhausted |= files.anyMatch(file -> file.getFileName().toString().endsWith(".hprof"));
            }
            long afterCollection = -1;
            long maximum = -1;
            if (alive) {
                server.memory.gc();
                afterCollection = server.memory.getHeapMemoryUsage().getUsed();
                maximum = server.memory.getHeapMemoryUsage().getMax();
            }
            if (exhausted || !alive) result = "exhausted";
            String line = "T1 candidate=" + label + " result=" + result + " jvmAlive=" + alive
                    + " outOfMemoryError=" + exhausted + " peakHeap=" + peakHeap + " peakCollected=" + peakCollected + " heapAfterCollection=" + afterCollection
                    + " maxHeap=" + maximum + " names=" + names.split(";").length
                    + " argument=" + names.length() + " characters detail=[" + detail + "]";
            Files.writeString(server.evidence.resolve("operator-" + label + ".txt"), line + "\n");
            System.out.println(line);
            assertTrue(alive && !exhausted, "The candidate exhausted the heap or ended the JVM: " + line);
            assertTrue(result.equals("refused") || result.equals("completed"), "No result for the candidate: " + line);
        });
    }

    @Test public void pvaCallWithAListOfRepeatedNames() throws Exception {
        check("pva-list-" + NAMES, repeated(NAMES));
    }

    @Test public void pvaCallWithAListOfDistinctValidNames() throws Exception {
        check("pva-list-distinct-" + NAMES, distinctValid(NAMES));
    }
}
