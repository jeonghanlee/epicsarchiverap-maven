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
 *     normal noise of standard deviation 0.2, one value every minute, 28 days.</li>
 * </ul>
 *
 * The window ends at the start of the day (UTC) of the end argument, an epoch second that defaults to now.
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
    private static final long SEED = 20261107L;
    private static final long DAY_SECONDS = 86400L;

    /** The signal of a kind: its spacing in seconds, its length in days and the value at an epoch second. */
    private record Signal(long spacing, int days, LongToDoubleFunction valueAt) {}

    private static Signal signalOf(String kind, long windowStart) {
        Random random = new Random(SEED);
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
            default:
                throw new IllegalArgumentException("Unknown kind " + kind + "; use normal, sine or pattern");
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
