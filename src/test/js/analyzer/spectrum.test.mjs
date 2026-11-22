// The spectral routines of aa/spectrum.js against NumPy and SciPy, and on signals of known frequency and period.
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";
import { reference, close, closeArray } from "./reference.mjs";

const S = "../../../main/org/epics/archiverappliance/staticcontent/js/aa/spectrum.js";
const spectrum = await import(S);

test("resampling irregular samples to an even interval agrees with NumPy's interpolation", () => {
    const r = reference.resample;
    const result = spectrum.resampleEven(r.times, r.values, r.interval);
    closeArray(result.values, r.expected, 1e-12, "resampled");
    close(result.largestGap, r.largestGap, 1e-12, 0, "largest gap");
    assert.equal(result.start, r.times[0]);
    assert.equal(spectrum.resampleEven([1], [2], 1), null);
    assert.equal(spectrum.resampleEven([1, 2], [2, 3], 0), null);
});

test("the median spacing of the times", () => {
    assert.equal(spectrum.medianSpacing([0, 1, 2, 4, 5]), 1);
    assert.equal(spectrum.medianSpacing([3]), null);
});

test("the windows agree with SciPy's periodic windows", () => {
    for (const [name, expected] of Object.entries(reference.windows)) {
        closeArray(spectrum.windowFunction(name, 64), expected, 1e-12, name);
    }
    assert.throws(() => spectrum.windowFunction("nuttall", 8));
});

test("the transform agrees with NumPy at a power of two, at composite lengths and at a prime", () => {
    for (const row of reference.fft) {
        const out = spectrum.fft(row.re, row.im);
        closeArray(out.re, row.outRe, 1e-12, `n=${row.n} re`);
        closeArray(out.im, row.outIm, 1e-12, `n=${row.n} im`);
    }
});

test("the periodogram density agrees with SciPy for each window, with padding and for an odd length", () => {
    for (const row of reference.periodogram) {
        const result = spectrum.periodogram(row.values, row.fs, row.name, row.nfft);
        closeArray(result.frequencies, row.frequencies, 1e-12, `${row.name} frequencies`);
        closeArray(result.power, row.power, 1e-9, `${row.name} power`);
    }
    assert.equal(spectrum.periodogram([1], 1), null);
    assert.equal(spectrum.periodogram([1, 2, 3], 1, "hann", 2), null);
});

test("the spectrogram agrees with SciPy", () => {
    const r = reference.spectrogram;
    const result = spectrum.spectrogram(Float64Array.from(r.values), r.fs, "hann", r.segment, r.overlap);
    closeArray(result.frequencies, r.frequencies, 1e-12, "frequencies");
    closeArray(result.times, r.times, 1e-12, "times");
    assert.equal(result.power.length, r.power.length);
    for (let j = 0; j < r.power.length; j += 1) closeArray(result.power[j], r.power[j], 1e-9, `segment ${j}`);
    assert.equal(spectrum.spectrogram([1, 2, 3], 1, "hann", 8, 4), null);
});

test("the autocorrelation agrees with the direct sums", () => {
    const r = reference.autocorrelation;
    closeArray(spectrum.autocorrelation(r.values, r.maxLag), r.expected, 1e-9, "autocorrelation");
    assert.equal(spectrum.autocorrelation([5, 5, 5, 5], 2), null);
});

test("the peak of a sine on a bin is found at its frequency with the width of its window", () => {
    // 1000 samples at 10 Hz: a sine of 1.5 Hz falls on bin 150 of 1000, so the peak is exact for the rectangular window.
    const n = 1000;
    const values = Float64Array.from({ length: n }, (_, i) => 3 * Math.sin((2 * Math.PI * 1.5 * i) / 10));
    const { frequencies, power } = spectrum.periodogram(values, 10, "rectangular");
    const peak = spectrum.spectralPeak(frequencies, power);
    close(peak.binFrequency, 1.5, 1e-12);
    close(peak.frequency, 1.5, 1e-9);
    assert.ok(peak.width > 0 && peak.width < 2 * (10 / n), `width ${peak.width}`);
});

test("the width and the refined frequency of a peak follow their definitions on spectra worked by hand", () => {
    const f = [0, 1, 2, 3, 4, 5, 6];
    // Symmetric: the peak 10 at 3, half power 5 crossed at 2 + (5 - 4) / 6 and at 3 + (10 - 5) / 6, so the width is 5/3.
    const symmetric = spectrum.spectralPeak(f, [0, 1, 4, 10, 4, 1, 0]);
    assert.equal(symmetric.index, 3);
    close(symmetric.frequency, 3, 1e-12);
    close(symmetric.width, 5 / 3, 1e-12);
    // Skewed: the neighbours 4 and 6 move the parabola to 3 + 0.5 (4 - 6) / (4 - 20 + 6) = 3.1; the half power is crossed at
    // 2 + 1 / 6 on the left and at 4 + (6 - 5) / (6 - 1) = 4.2 on the right, so the width is 4.2 - 2 - 1 / 6.
    const skewed = spectrum.spectralPeak(f, [0, 1, 4, 10, 6, 1, 0]);
    close(skewed.frequency, 3.1, 1e-12);
    close(skewed.width, 4.2 - (2 + 1 / 6), 1e-12);
    // A peak that does not fall to half of its power inside the spectrum has no width.
    assert.equal(spectrum.spectralPeak(f, [0, 8, 9, 10, 9, 8, 7]).width, null);
    assert.equal(spectrum.spectralPeak([0, 1], [1, 2]), null);
});

test("the spectrum peak of a sine of a known period lies within one frequency bin, whatever the window", () => {
    // The sine of the generated fixture: a period of 600 s sampled every 10 s over 3 days, 25,920 samples, which are not a power of two.
    const n = 25920;
    const values = Float64Array.from({ length: n }, (_, i) => 1.5 * Math.sin((2 * Math.PI * i * 10) / 600) + 0.2 * Math.sin(i * 0.37));
    for (const name of spectrum.WINDOWS) {
        const padded = spectrum.nextPowerOfTwo(n);
        for (const nfft of [n, padded]) {
            const { frequencies, power, binWidth } = spectrum.periodogram(values, 0.1, name, nfft);
            const peak = spectrum.spectralPeak(frequencies, power);
            assert.ok(Math.abs(peak.frequency - 1 / 600) <= binWidth, `${name} nfft ${nfft}: ${peak.frequency} against ${1 / 600} (bin ${binWidth})`);
        }
    }
});

test("the autocorrelation peak of a series of a known period lies within one sample of it", () => {
    const period = 60;
    const values = Float64Array.from({ length: 3000 }, (_, i) => Math.sin((2 * Math.PI * i) / period) + 0.1 * Math.sin(i * 1.7));
    const found = spectrum.autocorrelationPeriod(spectrum.autocorrelation(values, 200));
    assert.ok(Math.abs(found.lag - period) <= 1, `lag ${found.lag}`);
    assert.equal(spectrum.autocorrelationPeriod(Float64Array.from([1, 0.9, 0.8, 0.7])), null);
});

test("a series resampled to an even interval gives the frequency of the signal it came from", () => {
    // An irregular series of a 0.05 Hz sine, resampled to 1 s: the peak is at 0.05 Hz within one bin.
    const times = [];
    const values = [];
    let t = 0;
    for (let i = 0; i < 3000; i += 1) {
        t += 0.6 + ((i * 7919) % 100) / 100 * 0.8;
        times.push(t);
        values.push(Math.sin(2 * Math.PI * 0.05 * t));
    }
    const even = spectrum.resampleEven(times, values, 1);
    const { frequencies, power, binWidth } = spectrum.periodogram(even.values, 1, "hann");
    const peak = spectrum.spectralPeak(frequencies, power);
    assert.ok(Math.abs(peak.frequency - 0.05) <= binWidth, `${peak.frequency} (bin ${binWidth})`);
});
