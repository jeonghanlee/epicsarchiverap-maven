package org.epics.archiverappliance.engine.pv;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Every CA command thread of the engine must hold its own UDP search port. The kernel can give two
 * sockets bound with SO_REUSEADDR to port 0 the same port, and unicast search replies then reach only
 * the later-bound socket, so the earlier context's channels never connect. With 200 command threads a
 * shared port appears in about half of the engine starts, so eight starts expose a missing check. The
 * test builds the threads with the engine's own EngineContext.createCommandThreads and destroys the
 * unstarted contexts.
 */
public class CommandThreadSearchPortTest {
    private static final int COMMAND_THREADS = 200;
    private static final int ENGINE_STARTS = 8;

    @Test
    public void everyCommandThreadHasItsOwnSearchPort() throws Exception {
        List<String> shared = new ArrayList<>();
        for (int start = 0; start < ENGINE_STARTS; start++) {
            JCACommandThread[] threads = EngineContext.createCommandThreads(COMMAND_THREADS);
            try {
                Map<Integer, Integer> threadForPort = new HashMap<>();
                for (int thread = 0; thread < threads.length; thread++) {
                    int port = threads[thread].getSearchPort();
                    Integer other = threadForPort.put(port, thread);
                    if (other != null) {
                        shared.add("start " + start + ": threads " + other + " and " + thread + " on port " + port);
                    }
                }
            } finally {
                for (JCACommandThread thread : threads) {
                    thread.destroyUnstartedContext();
                }
            }
        }
        Assertions.assertEquals(List.of(), shared, "CA command threads sharing a search port");
    }
}
