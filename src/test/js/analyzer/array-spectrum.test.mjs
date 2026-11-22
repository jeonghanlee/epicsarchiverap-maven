// The spectrum of an array uses the sampling frequency within the array, typed or taken from a companion value, never the rate at which
// the archive stores arrays. The routines of aa/spectrum.js are those of the Spectrum tab; this check runs them on the array of known
// content (a sine of 100.5 Hz sampled at 2048 Hz with peaks and a background) as the Waveform tab will call them.
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";
import { reference } from "./reference.mjs";

const spectrum = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/spectrum.js");
const wave = reference.arrayCases.wave.values;

test("the peak of the spectrum of the known array is its sine within one bin, for each window", () => {
    for (const window of ["rectangular", "hann", "hamming", "blackman"]) {
        const s = spectrum.spectra(wave, 2048, window);
        const peak = spectrum.spectralPeak(s.frequencies, s.power);
        assert.ok(Math.abs(peak.frequency - 100.5) < s.binWidth, `${window}: ${peak.frequency} Hz`);
        assert.equal(s.binWidth, 1, "the bin is the sampling frequency over the number of elements");
    }
});

test("the frequency scales with the sampling frequency that is given, so a wrong rate gives a wrong frequency and not an error", () => {
    const peakAt = (fs) => {
        const s = spectrum.spectra(wave, fs, "hann");
        return spectrum.spectralPeak(s.frequencies, s.power);
    };
    const at2048 = peakAt(2048);
    const at4096 = peakAt(4096);
    assert.ok(Math.abs(at4096.frequency - 2 * at2048.frequency) < 1e-9);
    assert.equal(spectrum.spectra(wave, 0, "hann"), null, "a sampling frequency that is not positive is refused");
    assert.equal(spectrum.spectra(wave, NaN, "hann"), null);
});
