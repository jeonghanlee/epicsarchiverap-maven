package org.epics.archiverappliance.etl.common;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Future;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Ticks every ETL pass driver of the appliance, in transition order, and keeps the ordering rule: no pass of
 * transition index t + 1 starts while a pass of index t is running. A pass held back by the rule starts at the first
 * tick after the pass of index t ends, with its planned time unchanged. A Throwable from one driver's tick is logged
 * and neither stops the ticker nor skips the other drivers.
 */
public final class ETLPassTicker {
    private static final Logger logger = LogManager.getLogger(ETLPassTicker.class.getName());

    /** Seconds between two ticks of the ticker thread. */
    public static final long TICK_SECONDS = 5;

    private final Clock clock;
    private final List<ETLPassDriver> drivers = new CopyOnWriteArrayList<>();
    private ScheduledFuture<?> ticking = null;

    public ETLPassTicker(Clock clock) {
        this.clock = clock;
    }

    public void addDriver(ETLPassDriver driver) {
        drivers.add(driver);
    }

    public List<ETLPassDriver> getDrivers() {
        return new ArrayList<>(drivers);
    }

    /**
     * Ticks every driver in transition order at the given time.
     *
     * @return the futures of the passes this tick started
     */
    public List<Future<ETLPassRecord>> tickAll(Instant now) {
        List<ETLPassDriver> ordered = new ArrayList<>(drivers);
        ordered.sort(Comparator.comparingInt(ETLPassDriver::getTransitionIndex));
        int lowestRunningIndex = Integer.MAX_VALUE;
        List<Future<ETLPassRecord>> startedPasses = new ArrayList<>();
        for (ETLPassDriver driver : ordered) {
            if (driver.getTransitionIndex() > lowestRunningIndex) {
                continue;
            }
            try {
                Future<ETLPassRecord> pass = driver.tick(now);
                if (pass != null) {
                    startedPasses.add(pass);
                }
            } catch (Throwable t) {
                logger.error("Exception ticking " + driver, t);
            }
            if (driver.isRunning()) {
                lowestRunningIndex = Math.min(lowestRunningIndex, driver.getTransitionIndex());
            }
        }
        return startedPasses;
    }

    /** Ticks all drivers every TICK_SECONDS on the given executor, reading the time from the ticker's clock. */
    public synchronized void startTicking(ScheduledExecutorService executor) {
        if (ticking != null) {
            return;
        }
        ticking = executor.scheduleWithFixedDelay(
                () -> {
                    try {
                        tickAll(clock.instant());
                    } catch (Throwable t) {
                        logger.error("Exception in the ETL pass ticker", t);
                    }
                },
                TICK_SECONDS,
                TICK_SECONDS,
                TimeUnit.SECONDS);
    }

    /** Stops ticking and sets the stop flag of every driver. */
    public synchronized void stop() {
        if (ticking != null) {
            ticking.cancel(false);
            ticking = null;
        }
        for (ETLPassDriver driver : drivers) {
            driver.stop();
        }
    }
}
