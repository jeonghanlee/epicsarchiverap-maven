/*******************************************************************************
 * Copyright (c) 2026 EPICS archiver appliance contributors.
 * EPICS archiver appliance is distributed subject to a Software License Agreement found
 * in file LICENSE that is included with this distribution.
 *******************************************************************************/
package org.epics.archiverappliance.retrieval;

import org.epics.archiverappliance.StoragePlugin;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.common.YearSecondTimestamp;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.utils.simulation.SimulationEvent;

import java.io.BufferedWriter;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.Random;
import java.util.function.LongToDoubleFunction;

/**
 * Writes a signal of known parameters into a storage plugin of an appliance, for the checks of the Analyzer tools that
 * need archived data with a known distribution, a known period or a known pattern over days. The values are the same on
 * every run for the same window, and the samples written are also written as a CSV (the seconds of the epoch and the
 * value) for the comparison with what the retrieval returns.
 *
 * <ul>
 * <li>normal: a normal sample of mean 10 and standard deviation 2, one value every 10 seconds, 7 days;</li>
 * <li>sine: 1.5 times the sine of a period of 600 seconds from the start of the window, one value every 10 seconds,
 *     3 days;</li>
 * <li>pattern: 20 plus a daily cosine of amplitude 3 that peaks at 14:00 UTC, minus 4 on Saturday and Sunday, plus a
 *     normal noise of standard deviation 0.2, one value every minute, 28 days;</li>
 * <li>basis:N (N from 1 to 16): a sine of period 900 plus 300 N seconds and amplitude 1 plus N/4, plus a normal noise of
 *     standard deviation 0.5, one value every 10 seconds, 3 days; the sixteen are independent of one another;</li>
 * <li>target: 2 times basis:1, minus 1.5 times basis:2, plus 0.5 times basis:3 (basis:4 and the others contribute
 *     nothing), plus 5, plus a normal noise of standard deviation 0.3, one value every 10 seconds, 3 days;</li>
 * <li>corra and corrb: a pair of normal signals of correlation 0.8 (A of mean 5 and standard deviation 1, B equal to 3
 *     plus 0.8 times the deviation of A plus a normal noise of standard deviation 0.6), one value every 10 seconds,
 *     3 days;</li>
 * <li>slow: 10 plus 2 times the sine of a period of 3600 seconds from the start of the window, one value every 60
 *     seconds, 3 days, without noise, for the pairing of signals of different rates.</li>
 * </ul>
 *
 * Each kind draws its noise from its own seed, so a signal does not change when another kind is added. The window ends
 * at the start of the day (UTC) of the end argument, an epoch second that defaults to now.
 * Usage: AnalyzerFixtureData kind pvName pluginURL csvFile [endEpochSeconds]
 */
public class AnalyzerFixtureData {
    public static final double NORMAL_MEAN = 10.0;
    public static final double NORMAL_SD = 2.0;
    public static final double SINE_AMPLITUDE = 1.5;
    public static final long SINE_PERIOD_SECONDS = 600;
    public static final double PATTERN_BASE = 20.0;
    public static final double PATTERN_DAILY_AMPLITUDE = 3.0;
    public static final double PATTERN_WEEKEND_DROP = 4.0;
    public static final double PATTERN_NOISE_SD = 0.2;
    public static final int BASIS_COUNT = 16;
    public static final double BASIS_NOISE_SD = 0.5;
    public static final double[] TARGET_COEFFICIENTS = {2.0, -1.5, 0.5, 0.0};
    public static final double TARGET_OFFSET = 5.0;
    public static final double TARGET_NOISE_SD = 0.3;
    public static final double CORR_A_MEAN = 5.0;
    public static final double CORR_A_SD = 1.0;
    public static final double CORR_B_OFFSET = 3.0;
    public static final double CORR_RHO = 0.8;
    public static final double CORR_B_NOISE_SD = 0.6;
    public static final double SLOW_BASE = 10.0;
    public static final double SLOW_AMPLITUDE = 2.0;
    public static final long SLOW_PERIOD_SECONDS = 3600;
    private static final long SEED = 20261107L;
    private static final long BASIS_SEED = 20261110L;
    private static final long CORR_SEED = 20261120L;
    private static final long DAY_SECONDS = 86400L;

    /** The signal of a kind: its spacing in seconds, its length in days and the value at an epoch second. */
    private record Signal(long spacing, int days, LongToDoubleFunction valueAt) {}

    /** The period in seconds of the basis signal n (from 1). */
    public static long basisPeriodSeconds(int n) {
        return 900L + 300L * n;
    }

    /** The amplitude of the basis signal n (from 1). */
    public static double basisAmplitude(int n) {
        return 1.0 + n / 4.0;
    }

    /** The value of the basis signal n at an epoch second, with its own source of noise advanced once per call. */
    private static LongToDoubleFunction basis(int n, long windowStart) {
        Random noise = new Random(BASIS_SEED + n);
        return secs -> basisAmplitude(n) * Math.sin(2 * Math.PI * (secs - windowStart) / basisPeriodSeconds(n))
                + BASIS_NOISE_SD * noise.nextGaussian();
    }

    private static Signal signalOf(String kind, long windowStart) {
        Random random = new Random(SEED);
        if (kind.startsWith("basis:")) {
            int n = Integer.parseInt(kind.substring("basis:".length()));
            if (n < 1 || n > BASIS_COUNT) {
                throw new IllegalArgumentException("Unknown kind " + kind + "; basis:N takes N from 1 to " + BASIS_COUNT);
            }
            return new Signal(10, 3, basis(n, windowStart));
        }
        switch (kind) {
            case "normal":
                return new Signal(10, 7, secs -> NORMAL_MEAN + NORMAL_SD * random.nextGaussian());
            case "sine":
                return new Signal(10, 3, secs -> SINE_AMPLITUDE
                        * Math.sin(2 * Math.PI * (secs - windowStart) / SINE_PERIOD_SECONDS));
            case "pattern":
                return new Signal(60, 28, secs -> {
                    ZonedDateTime time = Instant.ofEpochSecond(secs).atZone(ZoneOffset.UTC);
                    double hour = time.getHour() + time.getMinute() / 60.0;
                    boolean weekend = time.getDayOfWeek() == DayOfWeek.SATURDAY
                            || time.getDayOfWeek() == DayOfWeek.SUNDAY;
                    return PATTERN_BASE
                            + PATTERN_DAILY_AMPLITUDE * Math.cos(2 * Math.PI * (hour - 14.0) / 24.0)
                            - (weekend ? PATTERN_WEEKEND_DROP : 0.0)
                            + PATTERN_NOISE_SD * random.nextGaussian();
                });
            case "target": {
                LongToDoubleFunction[] bases = new LongToDoubleFunction[TARGET_COEFFICIENTS.length];
                for (int k = 0; k < bases.length; k++) {
                    bases[k] = basis(k + 1, windowStart);
                }
                Random noise = new Random(BASIS_SEED);
                return new Signal(10, 3, secs -> {
                    double value = TARGET_OFFSET;
                    for (int k = 0; k < bases.length; k++) {
                        value += TARGET_COEFFICIENTS[k] * bases[k].applyAsDouble(secs);
                    }
                    return value + TARGET_NOISE_SD * noise.nextGaussian();
                });
            }
            case "corra": {
                Random a = new Random(CORR_SEED);
                return new Signal(10, 3, secs -> CORR_A_MEAN + CORR_A_SD * a.nextGaussian());
            }
            case "corrb": {
                Random a = new Random(CORR_SEED);
                Random extra = new Random(CORR_SEED + 1);
                return new Signal(10, 3, secs -> CORR_B_OFFSET + CORR_RHO * CORR_A_SD * a.nextGaussian()
                        + CORR_B_NOISE_SD * extra.nextGaussian());
            }
            case "slow":
                return new Signal(60, 3, secs -> SLOW_BASE
                        + SLOW_AMPLITUDE * Math.sin(2 * Math.PI * (secs - windowStart) / SLOW_PERIOD_SECONDS));
            default:
                throw new IllegalArgumentException(
                        "Unknown kind " + kind + "; use normal, sine, pattern, basis:N, target, corra, corrb or slow");
        }
    }

    /**
     * Generates the signal of the kind into the plugin and its CSV and returns the number of samples written.
     * The window is the whole days before the day of endEpochSeconds.
     */
    public static long generate(String kind, String pvName, StoragePlugin plugin, Path csv, long endEpochSeconds)
            throws Exception {
        long end = endEpochSeconds - Math.floorMod(endEpochSeconds, DAY_SECONDS);
        Signal probe = signalOf(kind, 0);
        long start = end - probe.days() * DAY_SECONDS;
        Signal signal = signalOf(kind, start);
        long count = 0;
        try (BufferedWriter out = Files.newBufferedWriter(csv, StandardCharsets.UTF_8)) {
            out.write("secs,value\n");
            ArrayListEventStream stream = null;
            int streamYear = -1;
            for (long secs = start; secs < end; secs += signal.spacing()) {
                YearSecondTimestamp yts = TimeUtils.convertToYearSecondTimestamp(secs);
                if (stream != null && (yts.getYear() != streamYear || stream.size() >= DAY_SECONDS)) {
                    append(plugin, pvName, stream);
                    stream = null;
                }
                if (stream == null) {
                    streamYear = yts.getYear();
                    stream = new ArrayListEventStream(
                            (int) (DAY_SECONDS / signal.spacing()),
                            new RemotableEventStreamDesc(ArchDBRTypes.DBR_SCALAR_DOUBLE, pvName, (short) streamYear));
                }
                double value = signal.valueAt().applyAsDouble(secs);
                stream.add(new SimulationEvent(
                        yts.getSecondsintoyear(),
                        yts.getYear(),
                        ArchDBRTypes.DBR_SCALAR_DOUBLE,
                        new ScalarValue<Double>(value)));
                out.write(secs + "," + Double.toString(value) + "\n");
                count++;
            }
            if (stream != null) {
                append(plugin, pvName, stream);
            }
        }
        return count;
    }

    private static void append(StoragePlugin plugin, String pvName, ArrayListEventStream stream) throws Exception {
        try (BasicContext context = new BasicContext()) {
            plugin.appendData(context, pvName, stream);
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            System.err.println("Usage: AnalyzerFixtureData kind pvName pluginURL csvFile [endEpochSeconds]");
            System.exit(2);
        }
        if (args[2].contains("${")) {
            // The type info of a PV names its stores with the variables of the appliance; the caller replaces them.
            System.err.println("The plugin URL holds an unexpanded variable: " + args[2]);
            System.exit(2);
        }
        long end = args.length > 4 ? Long.parseLong(args[4]) : System.currentTimeMillis() / 1000;
        ConfigService configService = new ConfigServiceForTests(new File("./bin"), 1);
        StoragePlugin plugin = StoragePluginURLParser.parseStoragePlugin(args[2], configService);
        long count = generate(args[0], args[1], plugin, Path.of(args[3]), end);
        long windowEnd = end - Math.floorMod(end, DAY_SECONDS);
        System.out.println("generated " + count + " samples of " + args[1] + " (" + args[0] + ") before " + windowEnd);
        System.exit(0);
    }
}
