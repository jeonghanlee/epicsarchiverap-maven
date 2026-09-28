package org.epics.archiverappliance.etl.common;

import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.common.reports.Details;
import org.epics.archiverappliance.config.ConfigService;

import java.text.DecimalFormat;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Supplier;

/**
 * The ETL values of the appliance: the per-transition FileStore contexts the lookup items share, and the rows and
 * keys the mgmt pages read, every one taken from the pass records of the drivers. A transition index with several
 * drivers (several source cadences) reports one line per driver, named by its cadence.
 */
public class ETLMetrics implements Details {
    private static final DecimalFormat TWO_DIGITS = new DecimalFormat("###,###,###,###,###,###.##");
    private final List<ETLMetricsForLifetime> etlMetricsForLifetimeList = new LinkedList<ETLMetricsForLifetime>();
    private Supplier<List<ETLPassDriver>> drivers = ArrayList::new;
    private Clock clock = Clock.systemUTC();

    public void add(int lifetimeID) {
        etlMetricsForLifetimeList.add(new ETLMetricsForLifetime(lifetimeID));
    }

    public ETLMetricsForLifetime get(int lifetimeID) {
        return etlMetricsForLifetimeList.get(lifetimeID);
    }

    /** The drivers whose records the rows and keys are computed from, and the clock the rows read the time from. */
    public void setDrivers(Supplier<List<ETLPassDriver>> drivers, Clock clock) {
        this.drivers = drivers;
        this.clock = clock;
    }

    private TreeMap<Integer, List<ETLPassDriver>> driversByIndex() {
        TreeMap<Integer, List<ETLPassDriver>> byIndex = new TreeMap<>();
        for (ETLPassDriver driver : drivers.get()) {
            byIndex.computeIfAbsent(driver.getTransitionIndex(), k -> new ArrayList<>()).add(driver);
        }
        return byIndex;
    }

    private static double percentOfCadence(ETLPassRecord record, long cadenceSeconds) {
        return (record.busyMillis() * 100.0) / (cadenceSeconds * 1000.0);
    }

    /**
     * The keys of the mgmt appliance list: totalETLRuns(N) is the largest completed-pass count of the drivers of
     * transition N, timeForOverallETLInSeconds(N) the sum of their busy totals, and maxETLPercentage the largest
     * busy time of a last completed pass as a percent of its cadence, over all drivers.
     */
    public Map<String, String> metrics() {
        HashMap<String, String> metrics = new HashMap<String, String>();
        double maxETLPercentage = 0.0;
        for (Map.Entry<Integer, List<ETLPassDriver>> entry : driversByIndex().entrySet()) {
            long passes = 0;
            long busyMillis = 0;
            for (ETLPassDriver driver : entry.getValue()) {
                passes = Math.max(passes, driver.getCompletedPasses());
                busyMillis += driver.getBusyMillisTotal();
                ETLPassRecord last = driver.getLastCompleted();
                if (last != null) {
                    maxETLPercentage = Math.max(maxETLPercentage, percentOfCadence(last, driver.getCadenceSeconds()));
                }
            }
            metrics.put("totalETLRuns(" + entry.getKey() + ")", Long.toString(passes));
            metrics.put("timeForOverallETLInSeconds(" + entry.getKey() + ")", Long.toString(busyMillis / 1000));
        }
        metrics.put("maxETLPercentage", TWO_DIGITS.format(maxETLPercentage));
        return metrics;
    }

    @Override
    public LinkedList<Map<String, String>> details(ConfigService configService) {
        LinkedList<Map<String, String>> details = new LinkedList<Map<String, String>>();
        TreeMap<Integer, List<ETLPassDriver>> byIndex = driversByIndex();
        if (byIndex.isEmpty()) {
            details.add(metricDetail("Startup", "In Progress"));
            return details;
        }
        Instant now = clock.instant();
        for (Map.Entry<Integer, List<ETLPassDriver>> entry : byIndex.entrySet()) {
            int index = entry.getKey();
            boolean several = entry.getValue().size() > 1;
            for (ETLPassDriver driver : entry.getValue()) {
                String id = "ETL(" + index + "&raquo;" + (index + 1) + ")"
                        + (several ? " cadence " + driver.getCadenceSeconds() + " s" : "");
                long cadence = driver.getCadenceSeconds();
                details.add(metricDetail("Passes so far in " + id, Long.toString(driver.getCompletedPasses())));
                ETLPassRecord last = driver.getLastCompleted();
                if (last != null) {
                    details.add(metricDetail(
                            "Last pass in " + id + " started at",
                            TimeUtils.convertToHumanReadableString(last.startedAt().getEpochSecond())));
                    details.add(metricDetail(
                            "Last pass in " + id + " duration (s)",
                            TWO_DIGITS.format((last.endedAt().toEpochMilli() - last.startedAt().toEpochMilli())
                                    / 1000.0)));
                    details.add(metricDetail(
                            "Last pass in " + id + " busy time (s)", TWO_DIGITS.format(last.busyMillis() / 1000.0)));
                    details.add(metricDetail(
                            "Last pass in " + id + " busy time as % of cadence",
                            TWO_DIGITS.format(percentOfCadence(last, cadence))));
                    details.add(metricDetail("Last pass in " + id + " PVs", Integer.toString(last.pvCount())));
                    details.add(metricDetail("Last pass in " + id + " jobs failed", Integer.toString(last.jobsFailed())));
                    details.add(metricDetail(
                            "Last pass in " + id + " jobs aborted", Integer.toString(last.jobsAborted())));
                    details.add(metricDetail(
                            "Last pass in " + id + " jobs skipped", Integer.toString(last.jobsSkipped())));
                    details.add(metricDetail(
                            "Last pass in " + id + " partitions moved", Integer.toString(last.partitionsMoved())));
                    details.add(metricDetail(
                            "Last pass in " + id + " bytes moved", Long.toString(last.bytesMoved())));
                    details.add(metricDetail(
                            "Last pass in " + id + " slowest PV",
                            last.slowestPv() == null ? "none" : last.slowestPv()));
                    details.add(metricDetail(
                            "Last pass in " + id + " slowest PV time (s)",
                            TWO_DIGITS.format(last.slowestMillis() / 1000.0)));
                    details.add(metricDetail(
                            "Last pass in " + id + " max partitions moved by one PV",
                            Integer.toString(last.maxPartitionsMovedByOnePv())));
                    details.add(metricDetail(
                            "Last pass in " + id + " overran the cadence",
                            last.overrun() ? "yes" : "no"));
                    details.add(metricDetail(
                            "Last pass in " + id + " late by (s)", Long.toString(last.lateSeconds())));
                    details.add(metricDetail(
                            "Average busy time per pass in " + id + " (s)",
                            TWO_DIGITS.format(driver.getBusyMillisTotal()
                                    / (1000.0 * Math.max(1, driver.getCompletedPasses())))));
                }
                ETLPassRecord current = driver.getInProgress();
                if (current != null) {
                    details.add(metricDetail(
                            "Current pass in " + id + " started at",
                            TimeUtils.convertToHumanReadableString(current.startedAt().getEpochSecond())));
                    details.add(metricDetail(
                            "Current pass in " + id + " elapsed (s)",
                            TWO_DIGITS.format((now.toEpochMilli() - current.startedAt().toEpochMilli()) / 1000.0)));
                    details.add(metricDetail(
                            "Current pass in " + id + " jobs done of PVs",
                            current.jobsRun() + " of " + current.pvCount()));
                } else {
                    details.add(metricDetail("Current pass in " + id, "none"));
                }
                details.add(metricDetail(
                        "Weekly usage in " + id + " (%)", TWO_DIGITS.format(driver.getWeeklyUsagePercent(now))));
            }
        }
        return details;
    }

    @Override
    public ConfigService.WAR_FILE source() {
        return ConfigService.WAR_FILE.ETL;
    }
}
