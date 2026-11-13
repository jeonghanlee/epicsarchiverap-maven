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
import org.epics.archiverappliance.data.VectorValue;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.utils.simulation.SimulationEvent;

import java.io.BufferedOutputStream;
import java.io.BufferedWriter;
import java.io.DataOutputStream;
import java.io.File;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
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
 *     seconds, 3 days, without noise, for the pairing of signals of different rates;</li>
 * <li>wavefs, imagew, imageh: companion values, one every 60 seconds over 3 days, for the roles of the sampling
 *     frequency, the width and the height of an array: 2048 Hz up to the middle of the hour of wave and 1024 Hz from it,
 *     and 640 by 480 up to the middle of the frames of image and 480 by 640 from it, so that a value read at the time of
 *     a frame differs between the two halves.</li>
 * </ul>
 *
 * The array kinds write one waveform event per frame instead of one scalar:
 *
 * <ul>
 * <li>wave: 2048 elements, a sine of 100.5 Hz and amplitude 1 at a sampling frequency of 2048 Hz, three Gaussian peaks
 *     (positions 400, 900 and 1500, heights 3, 2 and 4, standard deviations 12, 20 and 15 elements; the height of the
 *     first grows by 1 percent of its start value each frame), a background of 0.5 plus 0.4 times the square of the
 *     fractional position, and a normal noise of standard deviation 0.05, one frame every 10 seconds for one hour;</li>
 * <li>waveaxis: the axis of wave, two frames: element n holding 0.5 n at the start of that hour, and 100 plus 0.25 n
 *     from its middle, so that the axis read at the time of a frame differs between the two halves of the hour;</li>
 * <li>image: 640 by 480 pixels, row-major, a Gaussian blob of amplitude 50000 (above the largest signed 16-bit value)
 *     and standard deviations 25 (X) and 15 (Y) pixels on a background of 1000, whose centre is at X 300 plus 2 per
 *     frame and Y 240, with a normal noise of standard deviation 20 rounded to whole counts, 20 frames 30 seconds
 *     apart;</li>
 * <li>frame: 1920 by 1200 pixels of the same kind (amplitude 40000, background 500, centre 960 and 600, standard
 *     deviations 80 and 50, noise 10), 6 frames 10 seconds apart, for the measurement of the size of a camera frame;</li>
 * <li>laser, als, airy: the pixels of laser.png (1307 by 1075), als.png (537 by 537) and airy.png (2560 by 1920) of
 *     src/test/js/analyzer/reference/images, whose SOURCES.md names their published originals, 3 identical frames 30
 *     seconds apart each;</li>
 * <li>screen: screen-0.png to screen-4.png of the same folder (1034 by 779, 12-bit counts), synthetic frames of a
 *     low-current electron beam on a YAG:Ce screen, 5 frames 10 seconds apart;</li>
 * <li>bound: 2560 by 2160 pixels (5,529,600, the largest frame the Image tab reads) of the kind of frame (amplitude
 *     40000, background 500, centre 1280 and 1080, standard deviations 160 and 90, noise 10), 2 frames 30 seconds
 *     apart.</li>
 * </ul>
 *
 * The array kinds take the archived type as a sixth argument (DBR_WAVEFORM_DOUBLE, DBR_WAVEFORM_INT or
 * DBR_WAVEFORM_SHORT; wave and waveaxis default to double, image and frame to int) and write the comparison file as CSV
 * (secs and the elements of the frame) for wave and waveaxis and as a binary file of big-endian 32-bit signed integers
 * for image and frame (the seconds, then the pixels of each frame in row-major order).
 *
 * Each kind draws its noise from its own seed, so a signal does not change when another kind is added. The window ends
 * at the start of the day (UTC) of the end argument, an epoch second that defaults to now.
 * Usage: AnalyzerFixtureData kind pvName pluginURL csvFile [endEpochSeconds [dbrType]]
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
    public static final int WAVE_LENGTH = 2048;
    public static final double WAVE_SAMPLING_HZ = 2048.0;
    public static final double WAVE_SAMPLING_SECOND_HZ = 1024.0;
    public static final double WAVE_SINE_HZ = 100.5;
    public static final double WAVE_SINE_AMPLITUDE = 1.0;
    public static final double[] WAVE_PEAK_POSITIONS = {400.0, 900.0, 1500.0};
    public static final double[] WAVE_PEAK_HEIGHTS = {3.0, 2.0, 4.0};
    public static final double[] WAVE_PEAK_SIGMAS = {12.0, 20.0, 15.0};
    public static final double WAVE_FIRST_PEAK_GROWTH = 0.01;
    public static final double WAVE_BACKGROUND_BASE = 0.5;
    public static final double WAVE_BACKGROUND_RISE = 0.4;
    public static final double WAVE_NOISE_SD = 0.05;
    public static final double WAVE_AXIS_STEP = 0.5;
    public static final double WAVE_AXIS_SECOND_START = 100.0;
    public static final double WAVE_AXIS_SECOND_STEP = 0.25;
    public static final int WAVE_FRAMES = 360;
    public static final long WAVE_SPACING_SECONDS = 10;
    public static final int IMAGE_WIDTH = 640;
    public static final int IMAGE_HEIGHT = 480;
    public static final double IMAGE_AMPLITUDE = 50000.0;
    public static final double IMAGE_BACKGROUND = 1000.0;
    public static final double IMAGE_SIGMA_X = 25.0;
    public static final double IMAGE_SIGMA_Y = 15.0;
    public static final double IMAGE_CENTRE_X = 300.0;
    public static final double IMAGE_CENTRE_X_STEP = 2.0;
    public static final double IMAGE_CENTRE_Y = 240.0;
    public static final double IMAGE_NOISE_SD = 20.0;
    public static final int IMAGE_FRAMES = 20;
    public static final long IMAGE_SPACING_SECONDS = 30;
    public static final int FRAME_WIDTH = 1920;
    public static final int FRAME_HEIGHT = 1200;
    public static final int FRAME_COUNT = 6;
    public static final long FRAME_SPACING_SECONDS = 10;
    /** The folder, on the test class path, of the PNG images that the picture kinds archive. */
    public static final String PICTURE_FOLDER = "/js/analyzer/reference/images/";
    public static final int PICTURE_FRAMES = 3;
    public static final long PICTURE_SPACING_SECONDS = 30;
    public static final int SCREEN_FRAMES = 5;
    public static final int BOUND_WIDTH = 2560;
    public static final int BOUND_HEIGHT = 2160;
    public static final int BOUND_FRAMES = 2;
    private static final long BOUND_SEED = 20261113L;
    public static final long SCREEN_SPACING_SECONDS = 10;
    private static final long ARRAY_SEED = 20261111L;
    private static final long IMAGE_SEED = 20261112L;
    private static final long FRAME_SEED = 20261113L;

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
            case "wavefs": {
                long change = windowStart + 3 * DAY_SECONDS - WAVE_FRAMES * WAVE_SPACING_SECONDS / 2;
                return new Signal(60, 3, secs -> secs >= change ? WAVE_SAMPLING_SECOND_HZ : WAVE_SAMPLING_HZ);
            }
            case "imagew": {
                long change = windowStart + 3 * DAY_SECONDS - IMAGE_FRAMES * IMAGE_SPACING_SECONDS / 2;
                return new Signal(60, 3, secs -> secs >= change ? IMAGE_HEIGHT : IMAGE_WIDTH);
            }
            case "imageh": {
                long change = windowStart + 3 * DAY_SECONDS - IMAGE_FRAMES * IMAGE_SPACING_SECONDS / 2;
                return new Signal(60, 3, secs -> secs >= change ? IMAGE_WIDTH : IMAGE_HEIGHT);
            }
            case "slow":
                return new Signal(60, 3, secs -> SLOW_BASE
                        + SLOW_AMPLITUDE * Math.sin(2 * Math.PI * (secs - windowStart) / SLOW_PERIOD_SECONDS));
            default:
                throw new IllegalArgumentException(
                        "Unknown kind " + kind + "; use normal, sine, pattern, basis:N, target, corra, corrb, slow, wavefs, imagew, imageh,"
                                + " wave, waveaxis, image, frame, laser, als, airy, screen or bound");
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


    /** True for the kinds that write one array per event. */
    public static boolean isArrayKind(String kind) {
        return kind.equals("wave") || kind.equals("waveaxis") || kind.equals("image") || kind.equals("frame")
                || isPictureKind(kind) || kind.equals("screen") || kind.equals("bound");
    }

    /** True for the kinds that archive a published image of the reference folder. */
    static boolean isPictureKind(String kind) {
        return kind.equals("laser") || kind.equals("als") || kind.equals("airy");
    }

    /** The pixels of a single-channel PNG of the reference folder on the test class path, row-major. */
    static double[] picturePixels(String name) throws java.io.IOException {
        try (java.io.InputStream in = AnalyzerFixtureData.class.getResourceAsStream(PICTURE_FOLDER + name)) {
            if (in == null) {
                throw new java.io.FileNotFoundException(PICTURE_FOLDER + name + " is not on the test class path");
            }
            java.awt.image.Raster raster = javax.imageio.ImageIO.read(in).getRaster();
            if (raster.getNumBands() != 1) {
                throw new IllegalArgumentException(name + " has " + raster.getNumBands() + " channels, not one");
            }
            int width = raster.getWidth();
            int height = raster.getHeight();
            double[] pixels = new double[width * height];
            raster.getSamples(0, 0, width, height, 0, pixels);
            return pixels;
        }
    }

    /** The elements of the wave frame k: a sine, three peaks (the first one growing), a background and noise. */
    static double[] waveFrame(int k, Random noise) {
        double[] values = new double[WAVE_LENGTH];
        for (int n = 0; n < WAVE_LENGTH; n++) {
            double position = n / (double) (WAVE_LENGTH - 1);
            double value = WAVE_SINE_AMPLITUDE * Math.sin(2 * Math.PI * WAVE_SINE_HZ * n / WAVE_SAMPLING_HZ)
                    + WAVE_BACKGROUND_BASE + WAVE_BACKGROUND_RISE * position * position;
            for (int p = 0; p < WAVE_PEAK_POSITIONS.length; p++) {
                double height = WAVE_PEAK_HEIGHTS[p] * (p == 0 ? 1.0 + WAVE_FIRST_PEAK_GROWTH * k : 1.0);
                double offset = (n - WAVE_PEAK_POSITIONS[p]) / WAVE_PEAK_SIGMAS[p];
                value += height * Math.exp(-0.5 * offset * offset);
            }
            values[n] = value + WAVE_NOISE_SD * noise.nextGaussian();
        }
        return values;
    }

    /** The pixels of an image frame, row-major with the origin at the top left: a Gaussian blob, a background, noise. */
    static int[] imageFrame(int width, int height, double amplitude, double background, double centreX, double centreY,
            double sigmaX, double sigmaY, double noiseSd, Random noise) {
        int[] pixels = new int[width * height];
        for (int y = 0; y < height; y++) {
            double dy = (y - centreY) / sigmaY;
            for (int x = 0; x < width; x++) {
                double dx = (x - centreX) / sigmaX;
                double value = background + amplitude * Math.exp(-0.5 * (dx * dx + dy * dy))
                        + noiseSd * noise.nextGaussian();
                pixels[y * width + x] = (int) Math.max(0, Math.min(65535, Math.round(value)));
            }
        }
        return pixels;
    }

    /** The list of numbers of an archived waveform type for the values of a frame (all rounded to whole numbers). */
    private static VectorValue<? extends Number> vectorOf(ArchDBRTypes type, double[] values) {
        List<Number> list = new ArrayList<>(values.length);
        for (double value : values) {
            switch (type) {
                case DBR_WAVEFORM_DOUBLE -> list.add(value);
                case DBR_WAVEFORM_INT -> list.add((int) Math.round(value));
                case DBR_WAVEFORM_SHORT -> list.add((short) Math.round(value));
                default -> throw new IllegalArgumentException("Unsupported array type " + type);
            }
        }
        return new VectorValue<Number>(list);
    }

    /**
     * Generates the frames of an array kind into the plugin and the comparison file and returns the number of frames
     * written. The window is the span of the frames, ending at the start of the day of endEpochSeconds.
     */
    public static long generateArray(String kind, String pvName, StoragePlugin plugin, Path file, long endEpochSeconds,
            ArchDBRTypes type) throws Exception {
        long end = endEpochSeconds - Math.floorMod(endEpochSeconds, DAY_SECONDS);
        int frames;
        long spacing;
        switch (kind) {
            case "wave" -> {
                frames = WAVE_FRAMES;
                spacing = WAVE_SPACING_SECONDS;
            }
            case "waveaxis" -> {
                frames = 2;
                spacing = WAVE_FRAMES * WAVE_SPACING_SECONDS / 2;
            }
            case "image" -> {
                frames = IMAGE_FRAMES;
                spacing = IMAGE_SPACING_SECONDS;
            }
            case "frame" -> {
                frames = FRAME_COUNT;
                spacing = FRAME_SPACING_SECONDS;
            }
            case "laser", "als", "airy" -> {
                frames = PICTURE_FRAMES;
                spacing = PICTURE_SPACING_SECONDS;
            }
            case "screen" -> {
                frames = SCREEN_FRAMES;
                spacing = SCREEN_SPACING_SECONDS;
            }
            case "bound" -> {
                frames = BOUND_FRAMES;
                spacing = PICTURE_SPACING_SECONDS;
            }
            default -> throw new IllegalArgumentException("Unknown array kind " + kind);
        }
        long start = end - frames * spacing;
        Random waveNoise = new Random(ARRAY_SEED);
        Random imageNoise = new Random(kind.equals("frame") ? FRAME_SEED : kind.equals("bound") ? BOUND_SEED : IMAGE_SEED);
        boolean text = kind.equals("wave") || kind.equals("waveaxis");
        ArrayListEventStream stream = null;
        int streamYear = -1;
        try (OutputStream raw = Files.newOutputStream(file);
                DataOutputStream binary = new DataOutputStream(new BufferedOutputStream(raw));
                BufferedWriter out = new BufferedWriter(new OutputStreamWriter(raw, StandardCharsets.UTF_8))) {
            for (int k = 0; k < frames; k++) {
                long secs = start + k * spacing;
                double[] values;
                switch (kind) {
                    case "wave" -> values = waveFrame(k, waveNoise);
                    case "waveaxis" -> {
                        values = new double[WAVE_LENGTH];
                        for (int n = 0; n < WAVE_LENGTH; n++) {
                            values[n] = k == 0 ? WAVE_AXIS_STEP * n : WAVE_AXIS_SECOND_START + WAVE_AXIS_SECOND_STEP * n;
                        }
                    }
                    case "image" -> values = toDoubles(imageFrame(IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_AMPLITUDE,
                            IMAGE_BACKGROUND, IMAGE_CENTRE_X + IMAGE_CENTRE_X_STEP * k, IMAGE_CENTRE_Y, IMAGE_SIGMA_X,
                            IMAGE_SIGMA_Y, IMAGE_NOISE_SD, imageNoise));
                    case "laser", "als", "airy" -> values = picturePixels(kind + ".png");
                    case "screen" -> values = picturePixels("screen-" + k + ".png");
                    case "bound" -> values = toDoubles(imageFrame(BOUND_WIDTH, BOUND_HEIGHT, 40000.0, 500.0,
                            BOUND_WIDTH / 2.0, BOUND_HEIGHT / 2.0, 160.0, 90.0, 10.0, imageNoise));
                    default -> values = toDoubles(imageFrame(FRAME_WIDTH, FRAME_HEIGHT, 40000.0, 500.0,
                            FRAME_WIDTH / 2.0, FRAME_HEIGHT / 2.0, 80.0, 50.0, 10.0, imageNoise));
                }
                YearSecondTimestamp yts = TimeUtils.convertToYearSecondTimestamp(secs);
                if (stream != null && yts.getYear() != streamYear) {
                    append(plugin, pvName, stream);
                    stream = null;
                }
                if (stream == null) {
                    streamYear = yts.getYear();
                    stream = new ArrayListEventStream(
                            frames, new RemotableEventStreamDesc(type, pvName, (short) streamYear));
                }
                VectorValue<? extends Number> vector = vectorOf(type, values);
                stream.add(new SimulationEvent(yts.getSecondsintoyear(), yts.getYear(), type, vector));
                if (text) {
                    StringBuilder row = new StringBuilder().append(secs);
                    for (int n = 0; n < vector.getElementCount(); n++) {
                        row.append(',').append(vector.getValue(n));
                    }
                    out.write(row.append('\n').toString());
                } else {
                    binary.writeLong(secs);
                    for (int n = 0; n < vector.getElementCount(); n++) {
                        binary.writeInt(vector.getValue(n).intValue());
                    }
                }
            }
            out.flush();
            binary.flush();
            if (stream != null) {
                append(plugin, pvName, stream);
            }
        }
        return frames;
    }

    private static double[] toDoubles(int[] pixels) {
        double[] values = new double[pixels.length];
        for (int i = 0; i < pixels.length; i++) {
            values[i] = pixels[i];
        }
        return values;
    }

    private static void append(StoragePlugin plugin, String pvName, ArrayListEventStream stream) throws Exception {
        try (BasicContext context = new BasicContext()) {
            plugin.appendData(context, pvName, stream);
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            System.err.println("Usage: AnalyzerFixtureData kind pvName pluginURL csvFile [endEpochSeconds [dbrType]]");
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
        long windowEnd = end - Math.floorMod(end, DAY_SECONDS);
        if (isArrayKind(args[0])) {
            ArchDBRTypes type = ArchDBRTypes.valueOf(args.length > 5
                    ? args[5]
                    : (args[0].startsWith("wave") ? "DBR_WAVEFORM_DOUBLE" : "DBR_WAVEFORM_INT"));
            long frames = generateArray(args[0], args[1], plugin, Path.of(args[3]), end, type);
            System.out.println("generated " + frames + " frames of " + args[1] + " (" + args[0] + ", " + type
                    + ") before " + windowEnd);
            System.exit(0);
        }
        long count = generate(args[0], args[1], plugin, Path.of(args[3]), end);
        System.out.println("generated " + count + " samples of " + args[1] + " (" + args[0] + ") before " + windowEnd);
        System.exit(0);
    }
}
