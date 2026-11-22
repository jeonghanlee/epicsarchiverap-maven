// The preparation of an irregular series for a spectrum, and the three scalings of the one-sided spectrum, of aa/spectrum.js against
// NumPy (median, interp) and SciPy (periodogram with the scalings density and spectrum).
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";
import { reference, close, closeArray } from "./reference.mjs";

const spectrum = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/spectrum.js");
const cases = reference.spectrumCases;
const WINDOW_NAMES = { boxcar: "rectangular", hann: "hann", hamming: "hamming", blackman: "blackman" };

test("a regular series is prepared at its median spacing and equals the samples", () => {
    const c = cases.regular;
    const p = spectrum.prepareSeries(c.times, c.values);
    assert.equal(p.ok, true);
    assert.equal(p.interval, c.median);
    assert.equal(p.defaulted, true);
    assert.equal(p.count, c.count);
    assert.equal(p.gaps.length, 0);
    closeArray(Array.from(p.values), c.even, 1e-12, "values");
    close(p.rate, 1 / c.median, 1e-12, 0, "rate");
    close(p.duration, (c.count - 1) * c.median, 1e-12, 0, "duration");
});

test("an irregular series with a gap is refused by default with the gap and its time, and interpolated when the policy says so", () => {
    const c = cases.irregularWithGap;
    const refused = spectrum.prepareSeries(c.times, c.values);
    assert.equal(refused.ok, false);
    assert.equal(refused.gaps.length, c.gaps.length);
    assert.deepEqual(refused.gaps.map((g) => [g.from, g.to]), c.gaps.map((g) => [g.from, g.to]));
    assert.match(refused.reason, /1 gap of more than 5 intervals; the first is 313 s long \(31\.3 intervals\)/);
    const p = spectrum.prepareSeries(c.times, c.values, { gaps: "interpolate" });
    assert.equal(p.ok, true);
    assert.equal(p.interval, c.median);
    assert.equal(p.count, c.count);
    closeArray(Array.from(p.values), c.even, 1e-12, "np.interp");
    assert.equal(p.gaps.length, 1);
    close(p.irregularity, 313 / c.median, 1e-12, 0, "largest spacing over the median");
    // A gap is a spacing of more than 5 resampling intervals: at an interval of 100 s the spacing of 313 s is not one.
    const coarse = spectrum.prepareSeries(c.times, c.values, { interval: 100 });
    assert.equal(coarse.ok, true);
    assert.equal(coarse.gaps.length, 0);
});

test("a typed interval replaces the median and changes the number of points; a short or long result or a bad interval is refused with its reason", () => {
    const c = cases.regular;
    const typed = spectrum.prepareSeries(c.times, c.values, { interval: 20 });
    assert.equal(typed.ok, true);
    assert.equal(typed.defaulted, false);
    assert.equal(typed.count, Math.floor((c.times[c.times.length - 1] - c.times[0]) / 20 + 1e-9) + 1);
    assert.equal(typed.oversampled, false);
    assert.equal(spectrum.prepareSeries(c.times, c.values, { interval: 4 }).oversampled, true);
    assert.match(spectrum.prepareSeries(c.times, c.values, { interval: 5000 }).reason, /makes \d+ points; a spectrum needs at least 16/);
    assert.match(spectrum.prepareSeries(c.times, c.values, { interval: 1e-3 }).reason, /the most is 1048576/);
    for (const bad of [0, -3, NaN, Infinity]) assert.match(spectrum.prepareSeries(c.times, c.values, { interval: bad }).reason, /positive number of seconds/);
});

test("too few samples, shared times and a constant series are refused with their reasons", () => {
    assert.match(spectrum.prepareSeries([0], [1]).reason, /at least 2 samples; the range holds 1/);
    assert.match(spectrum.prepareSeries([5, 5, 5], [1, 2, 3]).reason, /share their times.*different times/);
    const t = Array.from({ length: 40 }, (_, i) => i * 10);
    assert.match(spectrum.prepareSeries(t, t.map(() => 3)).reason, /one value/);
    assert.match(spectrum.prepareSeries(t.slice(0, 10), t.slice(0, 10).map((v) => v % 7)).reason, /makes 10 points; a spectrum needs at least 16/);
});

for (const [name, c] of Object.entries(cases)) {
    for (const reference_ of c.spectra) {
        test(`the density and power spectra of ${name} with the ${reference_.window} window equal SciPy periodogram`, () => {
            const s = spectrum.spectra(Float64Array.from(c.even), 1 / c.median, WINDOW_NAMES[reference_.window]);
            closeArray(Array.from(s.frequencies), reference_.frequencies, 1e-12, "frequencies");
            closeArray(Array.from(s.density), reference_.density, 1e-9, "density");
            closeArray(Array.from(s.power), reference_.power, 1e-9, "power");
            // The amplitude is the square root of twice the power, but at zero frequency and at the Nyquist frequency of an even length.
            const last = reference_.power.length - 1;
            const nyquist = c.even.length % 2 === 0;
            closeArray(Array.from(s.amplitude), reference_.power.map((v, k) => Math.sqrt(k === 0 || (nyquist && k === last) ? v : 2 * v)), 1e-9, "amplitude");
        });
    }
}

test("a sine of a whole number of periods has the amplitude of the sine at its bin, the power a half of the square of it, with the rectangular and the Hann window", () => {
    const c = cases.sine;
    for (const name of ["rectangular", "hann"]) {
        const s = spectrum.spectra(Float64Array.from(c.even), 1 / c.median, name);
        let best = 1;
        for (let k = 2; k < s.power.length; k += 1) if (s.power[k] > s.power[best]) best = k;
        close(s.frequencies[best], 1 / 600, 1e-9, 0, "peak frequency");
        close(s.amplitude[best], 1.5, 1e-9, 0, `amplitude with the ${name} window`);
        close(s.power[best], 1.5 * 1.5 / 2, 1e-9, 0, `power with the ${name} window`);
    }
});

test("the power spectral density integrates to the variance of the series (Parseval), whatever the window of the rectangular kind", () => {
    const c = cases.regular;
    const values = Float64Array.from(c.even);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const s = spectrum.spectra(values, 1 / c.median, "rectangular");
    const integral = s.density.reduce((a, b) => a + b, 0) * s.binWidth;
    close(integral, variance, 1e-9, 0, "integral of the density");
});

test("the autocorrelation period needs a peak of the height asked for", () => {
    const n = 600;
    const sine = Float64Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * i) / 60));
    const r = spectrum.autocorrelation(sine, 200);
    const found = spectrum.autocorrelationPeriod(r, 0.2);
    assert.ok(Math.abs(found.lag - 60) <= 1, `lag ${found.lag}`);
    assert.equal(spectrum.autocorrelationPeriod(r, 0.999999), null);
    assert.equal(spectrum.autocorrelationPeriod(r).lag, found.lag);
});

test("spectra are not given for fewer than two samples, a frequency that is not positive or a transform shorter than the series", () => {
    assert.equal(spectrum.spectra(Float64Array.from([1]), 1), null);
    assert.equal(spectrum.spectra(Float64Array.from([1, 2, 3]), 0), null);
    assert.equal(spectrum.spectra(Float64Array.from([1, 2, 3, 4]), 1, "hann", 3), null);
});
