package org.epics.archiverappliance.etl;

import edu.stanford.slac.archiverappliance.PlainPB.PlainPBStoragePlugin;
import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.Level;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.EventStream;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.CapturedLog;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.etl.common.ETLPVLookupItems;
import org.epics.archiverappliance.etl.common.ETLPassDriver;
import org.epics.archiverappliance.etl.common.ETLPassRecord;
import org.epics.archiverappliance.etl.common.PBThreeTierETLPVLookup;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.epics.archiverappliance.utils.simulation.SimulationEvent;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * What a delete does when the ETL stops while its consolidation waits behind a busy worker, over the real lookup,
 * pass drivers, ETLJob and PlainPB stores. Two drivers share transition index 0: a 5MIN source with many PVs whose
 * pass runs long, and an HOUR source whose driver runs nothing. The delete of an HOUR-source PV queues behind the
 * long pass on the one worker thread of the index; the stop with no stop wait drops that queued task. The delete
 * must return within a time limit with the PV moved once, after the shutdown and after the test stop. An interrupted
 * wait keeps the flag and logs an ERROR. The only substitutes are the clock and the environment reader.
 */
@Tag("slow")
public class PBThreeTierETLPVLookupStopTest {
    /** PVs of the 5MIN source: enough one-day jobs that the pass of this driver lasts many seconds. */
    private static final int LONG_DRIVER_PV_COUNT = 64;

    private static final int SHORT_DRIVER_PV_COUNT = 2;
    private static final int DATA_SECONDS = 24 * 60 * 60;
    private static final long BUSY_BOUND_SECONDS = 120;
    private static final long WAIT_SECONDS = 300;
    private static final long POLL_MILLIS = 5;
    private static final long DELETE_LIMIT_SECONDS = 30;
    private static final long WAITING_BOUND_SECONDS = 30;
    private static final long CADENCE_5MIN_SECONDS = 300;
    private static final String LOOKUP_LOGGER = PBThreeTierETLPVLookup.class.getName();
    private final String base =
            ConfigServiceForTests.getDefaultPBTestFolder() + "/" + PBThreeTierETLPVLookupStopTest.class.getSimpleName();
    private ConfigServiceForTests configService;
    private PBThreeTierETLPVLookup lookup;
    private Instant yearStart;
    private Instant now;
    private ETLPassDriver longDriver;
    private ETLPassDriver shortDriver;
    private final List<ETLPVLookupItems> shortItems = new ArrayList<>();

    private static final class TestClock extends Clock {
        private final Instant instant;

        TestClock(Instant instant) {
            this.instant = instant;
        }

        @Override
        public Instant instant() {
            return instant;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }

    @BeforeEach
    public void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1);
        configService
                .getInstallationProperties()
                .setProperty(PBThreeTierETLPVLookup.STOP_WAIT_PROPERTY, "0");
        FileUtils.deleteDirectory(new File(base));
        Assertions.assertTrue(new File(base).mkdirs());
        yearStart = TimeUtils.getStartOfYear(TimeUtils.getCurrentYear());
        now = yearStart.plusSeconds(DATA_SECONDS + 60 * 60);
        shortItems.clear();
    }

    @AfterEach
    public void tearDown() throws Exception {
        if (lookup != null) {
            lookup.manualControlForUnitTests();
        }
        configService.shutdownNow();
        FileUtils.deleteDirectory(new File(base));
    }

    private String storeUrl(String name, String folder, String granularity, boolean consolidateOnShutdown)
            throws Exception {
        PlainPBStoragePlugin store = (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(
                "pb://localhost?name=" + name + "&rootFolder=" + base + "/" + folder + "&partitionGranularity="
                        + granularity + (consolidateOnShutdown ? "&consolidateOnShutdown=true" : ""),
                configService);
        return store.getURLRepresentation();
    }

    /** Registers the PVs of one pair of stores, each holding DATA_SECONDS of samples, one per second, in its source. */
    private List<ETLPVLookupItems> addPVs(String prefix, int count, String sourceUrl, String destinationUrl)
            throws Exception {
        PlainPBStoragePlugin source =
                (PlainPBStoragePlugin) StoragePluginURLParser.parseStoragePlugin(sourceUrl, configService);
        short year = TimeUtils.getCurrentYear();
        List<ETLPVLookupItems> items = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            String pvName = String.format("ArchUnitTest:ETLStop:%s%02d", prefix, i);
            PVTypeInfo typeInfo = new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
            typeInfo.setDataStores(new String[] {sourceUrl, destinationUrl});
            configService.updateTypeInfoForPV(pvName, typeInfo);
            lookup.addETLJobsForUnitTests(pvName, typeInfo);
            try (BasicContext context = new BasicContext()) {
                ArrayListEventStream data = new ArrayListEventStream(
                        DATA_SECONDS, new RemotableEventStreamDesc(ArchDBRTypes.DBR_SCALAR_DOUBLE, pvName, year));
                for (int s = 0; s < DATA_SECONDS; s++) {
                    data.add(new SimulationEvent(
                            s, year, ArchDBRTypes.DBR_SCALAR_DOUBLE, new ScalarValue<Double>((double) s)));
                }
                source.appendData(context, pvName, data);
            }
            items.add(lookup.getLookupItemsForPV(pvName).getFirst());
        }
        return items;
    }

    /**
     * The lookup with a 5MIN-source driver and an HOUR-source driver on transition index 0, and the clock past every
     * source partition.
     */
    private void fixture() throws Exception {
        lookup = new PBThreeTierETLPVLookup(configService, new TestClock(now), name -> null);
        addPVs(
                "long",
                LONG_DRIVER_PV_COUNT,
                storeUrl("STSL", "stsLong", "PARTITION_5MIN", true),
                storeUrl("MTSL", "mtsLong", "PARTITION_HOUR", false));
        shortItems.addAll(addPVs(
                "short",
                SHORT_DRIVER_PV_COUNT,
                storeUrl("STSS", "stsShort", "PARTITION_HOUR", true),
                storeUrl("MTSS", "mtsShort", "PARTITION_DAY", false)));
        for (ETLPassDriver driver : lookup.getDrivers()) {
            Assertions.assertEquals(0, driver.getTransitionIndex());
            if (driver.getCadenceSeconds() == CADENCE_5MIN_SECONDS) {
                longDriver = driver;
            } else {
                shortDriver = driver;
            }
        }
        Assertions.assertNotNull(longDriver, "the driver of the 5MIN source");
        Assertions.assertNotNull(shortDriver, "the driver of the HOUR source");
        Assertions.assertEquals(2, lookup.getDrivers().size(), "two drivers on one transition index");
    }

    /**
     * Starts the long driver's pass and waits, bounded, until the worker runs the job of a PV. A pass that does not
     * reach that state fails the test.
     */
    private Future<ETLPassRecord> startBusyPass() throws Exception {
        longDriver.start();
        Future<ETLPassRecord> pass = longDriver.tick(now);
        Assertions.assertNotNull(pass, "the start-up pass of the long driver starts at the first tick");
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(BUSY_BOUND_SECONDS);
        while (longDriver.getCurrentJobPv() == null) {
            Assertions.assertFalse(pass.isDone(), "the pass ended before the worker was seen busy");
            Assertions.assertTrue(
                    System.nanoTime() < deadline, "the worker was not busy within " + BUSY_BOUND_SECONDS + " s");
            Thread.sleep(POLL_MILLIS);
        }
        return pass;
    }

    /** True when the thread waits inside the consolidation of the lookup. */
    private static boolean waitsInConsolidate(Thread thread) {
        Thread.State state = thread.getState();
        if (state != Thread.State.WAITING && state != Thread.State.TIMED_WAITING) {
            return false;
        }
        for (StackTraceElement frame : thread.getStackTrace()) {
            if (frame.getClassName().equals(PBThreeTierETLPVLookup.class.getName())
                    && frame.getMethodName().equals("consolidate")) {
                return true;
            }
        }
        return false;
    }

    /** Waits, bounded, until the thread waits inside the consolidation; returns an empty string, else the failure. */
    private String awaitWaitingInConsolidate(AtomicReference<Thread> deleting) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(WAITING_BOUND_SECONDS);
        while (System.nanoTime() < deadline) {
            Thread thread = deleting.get();
            if (thread != null && waitsInConsolidate(thread)) {
                return "";
            }
            Thread.sleep(POLL_MILLIS);
        }
        return "the delete thread did not wait inside the consolidation within " + WAITING_BOUND_SECONDS + " s";
    }

    /** The second into the year of the last event in the destination store, or -1 when it holds none. */
    private long lastDestinationSecond(ETLPVLookupItems item) throws Exception {
        try (BasicContext context = new BasicContext()) {
            Event last = item.getETLDest().getLastKnownEvent(context, item.getPvName());
            return last == null ? -1 : last.getEpochSeconds() - yearStart.getEpochSecond();
        }
    }

    /** The number of events of the PV in its destination store within the seconds the fixture wrote. */
    private long destinationEventCount(ETLPVLookupItems item) throws Exception {
        PlainPBStoragePlugin destination = (PlainPBStoragePlugin) item.getETLDest();
        long count = 0;
        try (BasicContext context = new BasicContext()) {
            for (Callable<EventStream> callable : destination.getDataForPV(
                    context, item.getPvName(), yearStart, yearStart.plusSeconds(DATA_SECONDS))) {
                try (EventStream stream = callable.call()) {
                    for (Event event : stream) {
                        long second = event.getEpochSeconds() - yearStart.getEpochSecond();
                        if (second >= 0 && second < DATA_SECONDS) {
                            count++;
                        }
                    }
                }
            }
        }
        return count;
    }

    /**
     * Queues the delete of an HOUR-source PV behind the busy pass, stops the ETL from a helper thread once the
     * delete waits, and checks that the delete returns within the time limit with the PV moved once.
     */
    private void deleteReturnsAfterTheStop(Runnable stop) throws Exception {
        fixture();
        Future<ETLPassRecord> pass = startBusyPass();
        ETLPVLookupItems target = shortItems.getFirst();
        String pvName = target.getPvName();
        AtomicReference<Thread> deleting = new AtomicReference<>();
        AtomicReference<String> stopperFailure = new AtomicReference<>();
        Thread stopper = new Thread(
                () -> {
                    try {
                        String failure = awaitWaitingInConsolidate(deleting);
                        if (!failure.isEmpty()) {
                            stopperFailure.set(failure);
                        } else if (!longDriver.isRunning()) {
                            stopperFailure.set("the long pass ended before the stop");
                        }
                        stop.run();
                    } catch (Throwable t) {
                        stopperFailure.set(t.toString());
                    }
                },
                "stopper");
        stopper.setDaemon(true);
        stopper.start();

        try {
            Assertions.assertTimeoutPreemptively(Duration.ofSeconds(DELETE_LIMIT_SECONDS), () -> {
                deleting.set(Thread.currentThread());
                lookup.deleteETLJobs(pvName);
                Assertions.assertFalse(
                        Thread.currentThread().isInterrupted(), "the delete leaves the interrupt flag clear");
            });
        } finally {
            stopper.join(TimeUnit.SECONDS.toMillis(WAIT_SECONDS));
        }
        Assertions.assertFalse(stopper.isAlive(), "the stop returned");
        Assertions.assertNull(stopperFailure.get());
        Assertions.assertFalse(waitsInConsolidate(deleting.get()), "no thread stays blocked in the delete");
        Assertions.assertFalse(shortDriver.hasPV(pvName), "the deleted PV left its driver");
        Assertions.assertEquals(
                DATA_SECONDS - 1, lastDestinationSecond(target), "the calling thread moved every partition of the PV");
        Assertions.assertEquals(DATA_SECONDS, destinationEventCount(target), "the destination holds the data once");
        pass.get(WAIT_SECONDS, TimeUnit.SECONDS);
    }

    @Test
    public void deleteBehindABusyWorkerReturnsAfterShutdown() throws Exception {
        deleteReturnsAfterTheStop(() -> lookup.shutdown());
    }

    @Test
    public void deleteBehindABusyWorkerReturnsAfterManualControl() throws Exception {
        deleteReturnsAfterTheStop(() -> lookup.manualControlForUnitTests());
    }

    @Test
    public void interruptedWaitKeepsTheFlagAndLogsAnError() throws Exception {
        fixture();
        Future<ETLPassRecord> pass = startBusyPass();
        ETLPVLookupItems target = shortItems.getFirst();
        String pvName = target.getPvName();
        AtomicReference<Thread> deleting = new AtomicReference<>();
        AtomicReference<Boolean> flagAfterDelete = new AtomicReference<>();
        Thread deleter = new Thread(
                () -> {
                    deleting.set(Thread.currentThread());
                    lookup.deleteETLJobs(pvName);
                    flagAfterDelete.set(Thread.currentThread().isInterrupted());
                },
                "deleter");
        deleter.setDaemon(true);

        try (CapturedLog log = new CapturedLog(LOOKUP_LOGGER, Level.ERROR)) {
            deleter.start();
            Assertions.assertEquals("", awaitWaitingInConsolidate(deleting));
            deleter.interrupt();
            deleter.join(TimeUnit.SECONDS.toMillis(DELETE_LIMIT_SECONDS));
            Assertions.assertFalse(deleter.isAlive(), "the interrupted delete returned");
            log.settle();

            Assertions.assertEquals(Boolean.TRUE, flagAfterDelete.get(), "the interrupt flag stays set");
            List<CapturedLog.Entry> errors = log.at(Level.ERROR).stream()
                    .filter(e -> e.message().contains(pvName))
                    .toList();
            Assertions.assertEquals(1, errors.size(), "one ERROR names the PV: " + log.entries());
            Assertions.assertTrue(errors.getFirst().message().contains("index 0"), errors.getFirst().message());
        }
        Assertions.assertTrue(longDriver.isRunning(), "the long pass ran through the check");
        Assertions.assertEquals(-1, lastDestinationSecond(target), "the interrupted thread moved nothing");
        lookup.manualControlForUnitTests();
        pass.get(WAIT_SECONDS, TimeUnit.SECONDS);
    }

    @Test
    public void interruptedDeleteAfterTheStopRunsNothingOnTheCallingThread() throws Exception {
        fixture();
        lookup.manualControlForUnitTests();
        ETLPVLookupItems target = shortItems.getFirst();
        String pvName = target.getPvName();
        AtomicReference<Boolean> flagAfterDelete = new AtomicReference<>();
        Thread deleter = new Thread(
                () -> {
                    Thread.currentThread().interrupt();
                    lookup.deleteETLJobs(pvName);
                    flagAfterDelete.set(Thread.currentThread().isInterrupted());
                },
                "deleter");
        deleter.setDaemon(true);

        try (CapturedLog log = new CapturedLog(LOOKUP_LOGGER, Level.ERROR)) {
            deleter.start();
            deleter.join(TimeUnit.SECONDS.toMillis(DELETE_LIMIT_SECONDS));
            Assertions.assertFalse(deleter.isAlive(), "the delete returned");
            log.settle();

            Assertions.assertEquals(Boolean.TRUE, flagAfterDelete.get(), "the interrupt flag stays set");
            List<CapturedLog.Entry> errors = log.at(Level.ERROR).stream()
                    .filter(e -> e.message().contains(pvName))
                    .toList();
            Assertions.assertEquals(1, errors.size(), "one ERROR names the PV: " + log.entries());
            Assertions.assertTrue(errors.getFirst().message().contains("index 0"), errors.getFirst().message());
        }
        Assertions.assertFalse(shortDriver.hasPV(pvName), "the deleted PV left its driver");
        Assertions.assertEquals(-1, lastDestinationSecond(target), "an interrupted thread runs no job inline");
    }
}
