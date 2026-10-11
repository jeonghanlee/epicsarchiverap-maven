package org.epics.archiverappliance.engine.test;

import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.EventStream;
import org.epics.archiverappliance.Writer;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.engine.ArchiveEngine;
import org.epics.archiverappliance.mgmt.policy.PolicyConfig.SamplingMethod;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Checks that a late write pass costs every PV the same margin in time, whatever its sampling period.
 * The real engine, the real channels and a real soft IOC run unchanged with the deployed write period of
 * 10 s; only the storage writer, the outermost boundary, is replaced by one that records what it receives
 * and sleeps once at a chosen position of the first write pass in which every buffer holds data. A delay
 * inside the one second margin loses nothing on 0.1 s, 1 s and 10 s PVs; a delay beyond it loses samples
 * on the 0.1 s PVs that are written after the sleep. The lost-event counter of the engine and the gaps in
 * the counter values handed to the writer must agree.
 */
@Tag("localEpics")
public class SampleBufferMarginTest {
    private static final String PREFIX = "SbMargin:";
    private static final int FAST = 40;
    private static final int ONE_SECOND = 20;
    private static final int TEN_SECOND = 5;
    private static final int TOTAL = FAST + ONE_SECOND + TEN_SECOND;
    private static final int DELAY_CALL_INDEX = 3;
    private static final long NEW_PASS_GAP_NANOS = 2_000_000_000L;
    private static final long PER_CALL_MS = 1;
    private static final String WRITE_PERIOD_SECONDS = "10";
    private static final Path REPORT_DIR = Path.of("work/exp");

    /** Records every batch handed over by the engine and delays one append once. */
    static class RecordingWriter implements Writer {
        final long delayMs;
        int passIndex = -1;
        int callInPass = 0;
        long lastCallNanos = 0;
        int armedPass = -1;
        boolean delayApplied = false;
        final List<Integer> passCalls = new ArrayList<>();
        final Map<String, Double> lastValue = new HashMap<>();
        final Map<String, Long> missingSteps = new HashMap<>();
        final Map<String, Integer> callIndexInArmedPass = new HashMap<>();

        RecordingWriter(long delayMs) {
            this.delayMs = delayMs;
        }

        @Override
        public synchronized int appendData(BasicContext context, String pvName, EventStream stream) throws IOException {
            long now = System.nanoTime();
            if (passIndex < 0 || now - lastCallNanos > NEW_PASS_GAP_NANOS) {
                if (passIndex >= 0) passCalls.add(callInPass);
                passIndex++;
                callInPass = 0;
                if (armedPass < 0 && passIndex >= 1 && passCalls.get(passIndex - 1) == TOTAL) {
                    armedPass = passIndex;
                }
            }
            int idx = callInPass++;
            boolean armed = passIndex == armedPass;
            if (armed) callIndexInArmedPass.put(pvName, idx);
            for (Event ev : stream) {
                double v = ev.getSampleValue().getValue().doubleValue();
                Double prev = lastValue.put(pvName, v);
                if (prev != null) {
                    long step = Math.round(v - prev);
                    long missing = (((step - 1) % 3600) + 3600) % 3600;
                    if (missing > 0) missingSteps.merge(pvName, missing, Long::sum);
                }
            }
            try {
                if (armed && idx == DELAY_CALL_INDEX && delayMs > 0) {
                    Thread.sleep(delayMs);
                    delayApplied = true;
                } else if (PER_CALL_MS > 0) {
                    Thread.sleep(PER_CALL_MS);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            lastCallNanos = System.nanoTime();
            return 0;
        }

        @Override
        public Event getLastKnownEvent(BasicContext context, String pvName) throws IOException {
            return null;
        }
    }

    /** Per-class outcome of one scenario. */
    static class ClassResult {
        int capacity;
        int lostPvs;
        long lostTotal;
        long missingSteps;
    }

    private static String dbText() {
        StringBuilder sb = new StringBuilder();
        for (int i = 1; i <= FAST; i++) sb.append(record("F", i, ".1 second"));
        for (int i = 1; i <= ONE_SECOND; i++) sb.append(record("S", i, "1 second"));
        for (int i = 1; i <= TEN_SECOND; i++) sb.append(record("T", i, "10 second"));
        return sb.toString();
    }

    private static String record(String cls, int i, String scan) {
        String name = String.format("$(P)%s:CH%02d", cls, i);
        return "record(calc, \"" + name + "\") {\n"
                + "  field(SCAN, \"" + scan + "\")\n"
                + "  field(CALC, \"(A+1)%3600\")\n"
                + "  field(INPA, \"" + name + " NPP\")\n"
                + "  field(MDEL, \"0\")\n"
                + "  field(ADEL, \"0\")\n"
                + "}\n";
    }

    private static List<String> pvNames(String cls, int count) {
        List<String> out = new ArrayList<>();
        for (int i = 1; i <= count; i++) out.add(String.format("%s%s:CH%02d", PREFIX, cls, i));
        return out;
    }

    private Map<String, ClassResult> runScenario(String name, long delayMs) throws Exception {
        File db = File.createTempFile("sample-buffer-margin", ".db");
        db.deleteOnExit();
        Files.writeString(db.toPath(), dbText(), StandardCharsets.UTF_8);

        String softIoc = System.getProperty("archappl.softioc", "softIocPVX");
        ProcessBuilder pb = new ProcessBuilder(softIoc, "-m", "P=" + PREFIX, "-d", db.getAbsolutePath());
        pb.environment().put("EPICS_CAS_INTF_ADDR_LIST", "127.0.0.1");
        pb.environment().put("EPICS_CAS_BEACON_ADDR_LIST", "127.0.0.1");
        pb.environment().put("EPICS_PVAS_INTF_ADDR_LIST", "224.0.1.1,1@127.0.0.1");
        pb.redirectErrorStream(true);
        pb.redirectOutput(ProcessBuilder.Redirect.DISCARD);
        pb.redirectInput(ProcessBuilder.Redirect.PIPE);
        Process ioc = pb.start();
        ConfigServiceForTests cfg = null;
        List<String> report = new ArrayList<>();
        Map<String, ClassResult> results = new HashMap<>();
        RecordingWriter writer = new RecordingWriter(delayMs);
        try {
            Thread.sleep(3000);
            cfg = new ConfigServiceForTests(-1);
            cfg.getInstallationProperties().setProperty(
                    "org.epics.archiverappliance.config.PVTypeInfo.secondsToBuffer", WRITE_PERIOD_SECONDS);

            List<String> fast = pvNames("F", FAST);
            List<String> one = pvNames("S", ONE_SECOND);
            List<String> ten = pvNames("T", TEN_SECOND);
            for (String pv : ten) ArchiveEngine.archivePV(pv, 10F, SamplingMethod.MONITOR, writer, cfg,
                    ArchDBRTypes.DBR_SCALAR_DOUBLE, null, false, false);
            for (String pv : one) ArchiveEngine.archivePV(pv, 1F, SamplingMethod.MONITOR, writer, cfg,
                    ArchDBRTypes.DBR_SCALAR_DOUBLE, null, false, false);
            for (String pv : fast) ArchiveEngine.archivePV(pv, 0.1F, SamplingMethod.MONITOR, writer, cfg,
                    ArchDBRTypes.DBR_SCALAR_DOUBLE, null, false, false);

            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(200);
            while (System.nanoTime() < deadline) {
                synchronized (writer) {
                    if (writer.armedPass >= 0 && writer.passIndex >= writer.armedPass + 2) break;
                }
                Thread.sleep(500);
            }
            Thread.sleep(500);

            synchronized (writer) {
                report.add("scenario=" + name + " delayMs=" + delayMs + " delayCallIndex=" + DELAY_CALL_INDEX
                        + " perCallMs=" + PER_CALL_MS + " writePeriodSeconds=" + cfg.getEngineContext().getWritePeriod()
                        + " marginSeconds=" + cfg.getEngineContext().getSampleBufferMarginSeconds());
                report.add("armedPass=" + writer.armedPass + " delayApplied=" + writer.delayApplied
                        + " callsPerPass=" + writer.passCalls);
                results.put("F", summarize(report, "F(0.1s)", fast, cfg, writer));
                results.put("S", summarize(report, "S(1s)  ", one, cfg, writer));
                results.put("T", summarize(report, "T(10s) ", ten, cfg, writer));
            }
            Assertions.assertTrue(writer.armedPass >= 0, "no write pass covered every buffer");
            Assertions.assertTrue(delayMs == 0 || writer.delayApplied, "the delay was not applied");
            for (ClassResult r : results.values()) {
                Assertions.assertEquals(r.lostTotal, r.missingSteps,
                        "engine lost-event counter and the gaps seen by the writer disagree");
            }
            return results;
        } finally {
            for (String line : report) System.out.println("SBMARGIN " + line);
            Files.createDirectories(REPORT_DIR);
            try (PrintWriter pw = new PrintWriter(Files.newBufferedWriter(REPORT_DIR.resolve("result-" + name + ".txt")))) {
                for (String line : report) pw.println(line);
            }
            if (cfg != null) cfg.shutdownNow();
            try (PrintWriter w = new PrintWriter(ioc.getOutputStream())) {
                w.println("exit");
                w.flush();
            }
            if (!ioc.waitFor(5, TimeUnit.SECONDS)) ioc.destroyForcibly();
        }
    }

    private static ClassResult summarize(List<String> report, String label, List<String> pvs,
                                         ConfigServiceForTests cfg, RecordingWriter writer) throws Exception {
        ClassResult r = new ClassResult();
        List<Integer> lostAt = new ArrayList<>();
        for (String pv : pvs) {
            r.capacity = cfg.getEngineContext().getChannelList().get(pv).getSampleBuffer().getCapacity();
            long lost = ArchiveEngine.getMetricsforPV(pv, cfg).getSampleBufferFullLostEventCount();
            r.missingSteps += writer.missingSteps.getOrDefault(pv, 0L);
            if (lost > 0) {
                r.lostPvs++;
                r.lostTotal += lost;
                lostAt.add(writer.callIndexInArmedPass.getOrDefault(pv, -1));
            }
        }
        report.add(String.format("class %s pvs=%d capacity=%d lostPVs=%d lostTotal(engine)=%d missingSteps(writer)=%d"
                + " lostAtCallIndex=%s", label, pvs.size(), r.capacity, r.lostPvs, r.lostTotal, r.missingSteps, lostAt));
        return r;
    }

    private static void assertNoLoss(Map<String, ClassResult> results) {
        for (Map.Entry<String, ClassResult> e : results.entrySet()) {
            Assertions.assertEquals(0, e.getValue().lostTotal, "class " + e.getKey() + " lost samples");
        }
    }

    @Test
    public void noDelayLosesNothing() throws Exception {
        assertNoLoss(runScenario("margin-delay-0ms", 0));
    }

    @Test
    public void delayInsideTheMarginLosesNothing() throws Exception {
        assertNoLoss(runScenario("margin-delay-500ms", 500));
    }

    @Test
    public void delayBeyondTheMarginLosesOnFastPVs() throws Exception {
        Map<String, ClassResult> results = runScenario("margin-delay-1500ms", 1500);
        Assertions.assertTrue(results.get("F").lostTotal > 0, "0.1 s PVs kept every sample through a 1.5 s delay");
        Assertions.assertEquals(0, results.get("T").lostTotal, "10 s PVs lost samples");
    }
}
