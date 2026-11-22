package org.epics.archiverappliance.retrieval.pva;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.DatagramSocket;
import java.nio.file.Files;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.epics.archiverappliance.retrieval.RetrievalMemoryNetworkFixture;
import org.epics.pva.PVASettings;
import org.epics.pva.client.PVAChannel;
import org.epics.pva.client.PVAClient;
import org.epics.pva.data.PVAAnyArray;
import org.epics.pva.data.PVAStructure;
import org.epics.pva.data.PVAStructureArray;
import org.epics.pva.data.nt.PVAURI;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/**
 * Calls the built retrieval WAR over PVAccess from separate connections while the real PB reads of two calls are held.
 * The server runs with two call permits: the third call is refused with a message in the log of the retrieval
 * application, and a call after the held calls have ended is answered.
 */
@Tag("integration")
public class PvaCallLimiterNetworkTest {
    private static final String APPLIANCE = "appliance0";
    private static final int PERMITS = 2;
    /** A day of raw events is larger than one read of the PB file, so the read after the hold position is held. */
    private static final int LOAD_SECONDS = 86_400;
    private static final int HOLD_RECORDS = 1000;
    private static final String REFUSAL = "PVAccess retrieval call refused: all " + PERMITS + " call permits are in use";

    @FunctionalInterface
    private interface NetworkCase {
        void run(RetrievalMemoryNetworkFixture server) throws Exception;
    }

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
        try (var server = new RetrievalMemoryNetworkFixture(null, true,
                "-DEPICS_PVAS_BROADCAST_PORT=" + port, "-DEPICS_PVA_BROADCAST_PORT=" + port,
                "-D" + PvaCallLimiter.PROPERTY + "=" + PERMITS)) {
            test.run(server);
        } finally {
            PVASettings.EPICS_PVA_ADDR_LIST = originalAddress;
            PVASettings.EPICS_PVA_NAME_SERVERS = originalNames;
            PVASettings.EPICS_PVA_AUTO_ADDR_LIST = originalAuto;
            PVASettings.EPICS_PVA_BROADCAST_PORT = originalBroadcast;
        }
    }

    private static PVAURI query(String processor, int seconds) {
        return new PVAURI("name", "pva", null, PvaGetPVData.NAME, Map.of(
                "pv", RetrievalMemoryNetworkFixture.PV, "pp", processor,
                "from", RetrievalMemoryNetworkFixture.FROM.toString(),
                "to", RetrievalMemoryNetworkFixture.FROM.plusSeconds(seconds).toString()));
    }

    private static void assertData(PVAChannel channel) throws Exception {
        PVAStructure response = channel.invoke(query("mean_60", 3600)).get(30, TimeUnit.SECONDS);
        PVAAnyArray values = response.get("value");
        assertNotNull(values);
        PVAStructureArray data = values.get()[0].get();
        assertTrue(data.get().length > 0, "The generated store must return data over PVA");
    }

    private static long refusals(RetrievalMemoryNetworkFixture server) {
        return server.tomcat.consoleLines(APPLIANCE).stream().filter(line -> line.contains(REFUSAL)).count();
    }

    private static long failures(RetrievalMemoryNetworkFixture server) {
        return server.tomcat.consoleLines(APPLIANCE).stream()
                .filter(line -> line.contains("PVAccess retrieval request failed")).count();
    }

    /** A call for a name that is not archived fails inside the retrieval; its permit must be returned all the same. */
    private static PVAURI failing() {
        return new PVAURI("name", "pva", null, PvaGetPVData.NAME, Map.of(
                "pv", "NoSuchPV:ForTheLimiter", "pp", "",
                "from", RetrievalMemoryNetworkFixture.FROM.toString(),
                "to", RetrievalMemoryNetworkFixture.FROM.plusSeconds(60).toString()));
    }

    @Test
    public void callsBeyondThePermitsAreRefusedAndALaterCallIsAnswered() throws Exception {
        withServer(server -> {
            assertNotNull(server.readHold, "The case holds the PB readers of its calls");
            List<PVAClient> clients = new ArrayList<>();
            List<PVAChannel> channels = new ArrayList<>();
            List<CompletableFuture<PVAStructure>> held = new ArrayList<>();
            try {
                for (int i = 0; i < PERMITS + 1; i++) {
                    var client = new PVAClient();
                    clients.add(client);
                    var channel = client.getChannel(PvaDataRetrievalService.PVA_DATA_SERVICE);
                    channels.add(channel);
                    assertTrue(channel.connect().get(30, TimeUnit.SECONDS));
                    assertData(channel);
                }
                assertEquals(0, refusals(server), "No normal call may be refused before the permits are used");

                // More failing calls than permits, one after the other: every one must fail inside the retrieval,
                // none may be refused, and the permits must be free again for the held calls below.
                long failedBefore = failures(server);
                for (int i = 0; i < PERMITS + 1; i++) {
                    var call = channels.get(i % channels.size()).invoke(failing());
                    long failedBy = System.nanoTime() + Duration.ofSeconds(30).toNanos();
                    while (failures(server) - failedBefore < i + 1 && System.nanoTime() < failedBy) Thread.sleep(10);
                    assertEquals(i + 1, failures(server) - failedBefore, "The failing call must fail inside the retrieval");
                    call.cancel(true);
                }
                assertEquals(0, refusals(server), "A failing call must not be refused while the permits are free");

                server.readHold.holdAfterRecords(HOLD_RECORDS);
                for (int i = 0; i < PERMITS; i++) held.add(channels.get(i).invoke(query("", LOAD_SECONDS)));
                long heldBy = System.nanoTime() + Duration.ofSeconds(30).toNanos();
                while (server.readHold.heldReaders() != PERMITS && System.nanoTime() < heldBy) Thread.sleep(10);
                assertEquals(PERMITS, server.readHold.heldReaders(), "Every permit must be used by a real held PB read");
                server.readHold.assertHealthy();

                var refused = channels.get(PERMITS).invoke(query("mean_60", 3600));
                long refusedBy = System.nanoTime() + Duration.ofSeconds(30).toNanos();
                while (refusals(server) == 0 && System.nanoTime() < refusedBy) Thread.sleep(10);
                assertEquals(1, refusals(server), "The call beyond the permits must be refused with a message in the log");
                String seen;
                try {
                    refused.get(10, TimeUnit.SECONDS);
                    seen = "answered";
                } catch (TimeoutException timeout) {
                    refused.cancel(true);
                    seen = "pending";
                } catch (Exception failure) {
                    seen = "error " + failure;
                }
                assertTrue(!seen.equals("answered"), "The call beyond the permits must not be answered");
                assertEquals(PERMITS, server.readHold.heldReaders(), "The held calls must span the refusal");
                held.forEach(call -> assertTrue(!call.isDone(), "A held call must still be running"));

                server.readHold.release();
                for (var call : held) {
                    PVAAnyArray values = call.get(120, TimeUnit.SECONDS).get("value");
                    assertNotNull(values);
                }
                assertData(channels.get(PERMITS));
                assertEquals(1, refusals(server), "The call after the held calls ended must not be refused");
                String line = "T2 permits=" + PERMITS + " refusalMessages=" + refusals(server) + " refusedCallSaw=[" + seen + "]";
                Files.writeString(server.evidence.resolve("pva-call-limiter.txt"), line + "\n");
                System.out.println(line);
            } finally {
                for (var call : held) call.cancel(true);
                for (PVAClient client : clients) client.close();
            }
        });
    }
}
