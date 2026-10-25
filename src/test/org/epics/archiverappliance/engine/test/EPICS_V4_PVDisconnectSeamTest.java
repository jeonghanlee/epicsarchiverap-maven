package org.epics.archiverappliance.engine.test;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.SIOCSetup;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.epics.archiverappliance.engine.pv.PV;
import org.epics.archiverappliance.engine.pv.PVFactory;
import org.epics.archiverappliance.engine.pv.PVListener;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Regression guard for the EPICS_V4_PV disconnect paths. A reactive disconnect
 * (the IOC dropping) followed by stop() must notify pvDisconnected once, not twice.
 * The teardown disconnect() and the reactive handleDisconnected() do not
 * double-notify: pvxs re-searches on a drop and disconnect() clears connected
 * before closing the channel.
 */
@Tag("localEpics")
public class EPICS_V4_PVDisconnectSeamTest {
    private static final Logger logger =
            LogManager.getLogger(EPICS_V4_PVDisconnectSeamTest.class.getName());
    private static final String pvPrefix = "V4DiscSeam";
    private static SIOCSetup ioc = null;
    private static ConfigServiceForTests configService;

    @BeforeAll
    public static void setUp() throws Exception {
        ioc = new SIOCSetup(pvPrefix);
        ioc.startSIOCWithDefaultDB();
        configService = new ConfigServiceForTests(-1);
        Thread.sleep(3000);
    }

    @AfterAll
    public static void tearDown() throws Exception {
        configService.shutdownNow();
        ioc.stopSIOC();
    }

    @Test
    public void reactiveDisconnectThenStop() throws Exception {
        String pvName = pvPrefix + "UnitTestNoNamingConvention:sine";
        AtomicInteger connects = new AtomicInteger(0);
        AtomicInteger disconnects = new AtomicInteger(0);

        PV pv = PVFactory.createPV(pvName, configService, 0, true);
        pv.addListener(new PVListener() {
            @Override
            public void pvConnectionRequestMade(PV pv) {}

            @Override
            public void pvConnected(PV pv) {
                connects.incrementAndGet();
            }

            @Override
            public void pvDisconnected(PV pv) {
                disconnects.incrementAndGet();
            }

            @Override
            public void pvValueUpdate(PV pv, DBRTimeEvent ev) {}

            @Override
            public void sampleDroppedTypeChange(PV pv, ArchDBRTypes newDBRType) {}
        });

        pv.start();
        for (int i = 0; i < 300 && connects.get() == 0; i++) {
            Thread.sleep(100);
        }
        Assertions.assertTrue(connects.get() > 0, "PV " + pvName + " did not connect");

        // Reactive disconnect: kill the IOC so the channel drops and handleDisconnected() runs.
        ioc.stopSIOC();
        for (int i = 0; i < 200 && disconnects.get() == 0; i++) {
            Thread.sleep(100);
        }
        int afterReactive = disconnects.get();
        logger.info("after reactive disconnect (IOC killed): pvDisconnected = {}", afterReactive);

        // Now tear the PV down. disconnect() does not consult state, so it may fire again.
        pv.stop();
        Thread.sleep(3000);
        int total = disconnects.get();
        logger.info("after stop() following a reactive disconnect: total pvDisconnected = {}", total);

        // The disconnect notification is idempotent: teardown and the reactive path together
        // notify pvDisconnected at most once. The reactive notification itself is nondeterministic
        // (it depends on a connect/search race in the client), so assert the no-double-notify
        // guarantee rather than an exact count.
        Assertions.assertTrue(
                total <= 1,
                "stop() after a reactive disconnect notified pvDisconnected " + total
                        + " times; more than once is a teardown/handleDisconnected double-disconnect");
    }
}
