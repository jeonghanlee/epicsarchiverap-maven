// The spectral routines of the Spectrum tab: the resampling of irregular samples to an even interval, the window functions,
// the Fourier transform (radix 2, and Bluestein for any length), the periodogram power spectral density, the peak with its
// width, the spectrogram and the autocorrelation. The bundled D3 has none of these; the bisector is its one help.

const d3 = globalThis.d3;

/** The median spacing in seconds of ascending times in seconds; null for fewer than two times. */
export function medianSpacing(times) {
    if (times.length < 2) {
        return null;
    }
    const gaps = new Float64Array(times.length - 1);
    for (let i = 1; i < times.length; i += 1) {
        gaps[i - 1] = times[i] - times[i - 1];
    }
    return d3.median(gaps);
}

/**
 * Resamples the samples (times in seconds, ascending, and values) to an even interval in seconds by linear interpolation,
 * from the first time to the last time that a whole number of intervals reaches; nothing is extrapolated. Returns the first
 * time, the interval, the values and the largest spacing of the input, which tells a gap. Null for fewer than two samples
 * or an interval that is not positive.
 */
export function resampleEven(times, values, interval) {
    if (times.length < 2 || times.length !== values.length || !(interval > 0)) {
        return null;
    }
    const start = times[0];
    const count = Math.floor((times[times.length - 1] - start) / interval + 1e-9) + 1;
    const out = new Float64Array(count);
    const bisect = d3.bisector((time) => time).right;
    let largestGap = 0;
    for (let i = 1; i < times.length; i += 1) {
        largestGap = Math.max(largestGap, times[i] - times[i - 1]);
    }
    for (let k = 0; k < count; k += 1) {
        const t = start + k * interval;
        const hi = Math.min(Math.max(bisect(times, t), 1), times.length - 1);
        const lo = hi - 1;
        const span = times[hi] - times[lo];
        out[k] = span > 0 ? values[lo] + ((values[hi] - values[lo]) * (t - times[lo])) / span : values[hi];
    }
    return { start, interval, values: out, largestGap };
}

export const WINDOWS = ["rectangular", "hann", "hamming", "blackman"];

/** The periodic window of the name and length n, the form for spectral analysis (the window of SciPy's get_window). */
export function windowFunction(name, n) {
    const w = new Float64Array(n);
    for (let k = 0; k < n; k += 1) {
        const x = (2 * Math.PI * k) / n;
        switch (name) {
            case "rectangular": w[k] = 1; break;
            case "hann": w[k] = 0.5 - 0.5 * Math.cos(x); break;
            case "hamming": w[k] = 0.54 - 0.46 * Math.cos(x); break;
            case "blackman": w[k] = 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x); break;
            default: throw new Error(`Unknown window ${name}`);
        }
    }
    return w;
}

const isPowerOfTwo = (n) => n > 0 && (n & (n - 1)) === 0;

/** The next power of two at or above n. */
export function nextPowerOfTwo(n) {
    let m = 1;
    while (m < n) m *= 2;
    return m;
}

/** An in-place radix-2 transform of the arrays re and im, whose length is a power of two. */
function fftRadix2(re, im, inverse = false) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i += 1) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }
    for (let size = 2; size <= n; size <<= 1) {
        const half = size >> 1;
        const angle = ((inverse ? 2 : -2) * Math.PI) / size;
        for (let start = 0; start < n; start += size) {
            for (let k = 0; k < half; k += 1) {
                const wr = Math.cos(angle * k);
                const wi = Math.sin(angle * k);
                const a = start + k;
                const b = a + half;
                const tr = re[b] * wr - im[b] * wi;
                const ti = re[b] * wi + im[b] * wr;
                re[b] = re[a] - tr;
                im[b] = im[a] - ti;
                re[a] += tr;
                im[a] += ti;
            }
        }
    }
}

/**
 * The discrete Fourier transform of the samples re and im (im may be omitted): radix 2 when the length is a power of two,
 * Bluestein's chirp transform for any other length. Returns new arrays {re, im}; the transform is the unnormalized one
 * X_k = sum x_t exp(-2 pi i k t / n).
 */
export function fft(reInput, imInput = null) {
    const n = reInput.length;
    const re = Float64Array.from(reInput);
    const im = imInput ? Float64Array.from(imInput) : new Float64Array(n);
    if (n <= 1 || isPowerOfTwo(n)) {
        if (n > 1) fftRadix2(re, im);
        return { re, im };
    }
    // Bluestein: X_k = w_k sum (x_t w_t) conj(w_(k-t)) with w_t = exp(-i pi t^2 / n), a convolution done with radix 2.
    const m = nextPowerOfTwo(2 * n - 1);
    const wr = new Float64Array(n);
    const wi = new Float64Array(n);
    for (let t = 0; t < n; t += 1) {
        // t^2 mod 2n keeps the angle small and exact for lengths into the millions.
        const angle = (Math.PI * ((t * t) % (2 * n))) / n;
        wr[t] = Math.cos(angle);
        wi[t] = -Math.sin(angle);
    }
    const ar = new Float64Array(m);
    const ai = new Float64Array(m);
    const br = new Float64Array(m);
    const bi = new Float64Array(m);
    for (let t = 0; t < n; t += 1) {
        ar[t] = re[t] * wr[t] - im[t] * wi[t];
        ai[t] = re[t] * wi[t] + im[t] * wr[t];
    }
    br[0] = wr[0];
    bi[0] = -wi[0];
    for (let t = 1; t < n; t += 1) {
        br[t] = br[m - t] = wr[t];
        bi[t] = bi[m - t] = -wi[t];
    }
    fftRadix2(ar, ai);
    fftRadix2(br, bi);
    for (let i = 0; i < m; i += 1) {
        const r = ar[i] * br[i] - ai[i] * bi[i];
        const s = ar[i] * bi[i] + ai[i] * br[i];
        ar[i] = r;
        ai[i] = s;
    }
    fftRadix2(ar, ai, true);
    const outRe = new Float64Array(n);
    const outIm = new Float64Array(n);
    for (let k = 0; k < n; k += 1) {
        const cr = ar[k] / m;
        const ci = ai[k] / m;
        outRe[k] = cr * wr[k] - ci * wi[k];
        outIm[k] = cr * wi[k] + ci * wr[k];
    }
    return { re: outRe, im: outIm };
}

/**
 * The periodogram power spectral density of the samples at the sampling frequency fs (Hz): the mean is removed, the window of
 * the name is applied, the series is padded with zeros to nfft, and the one-sided density is |X|^2 / (fs sum of w^2), doubled
 * except at zero frequency and, for an even nfft, at the Nyquist frequency (SciPy's periodogram with the density scaling).
 */
export function periodogram(values, fs, windowName = "rectangular", nfft = values.length) {
    const n = values.length;
    if (n < 2 || !(fs > 0) || nfft < n) {
        return null;
    }
    let mean = 0;
    for (let i = 0; i < n; i += 1) mean += values[i];
    mean /= n;
    const w = windowFunction(windowName, n);
    const x = new Float64Array(nfft);
    let windowPower = 0;
    for (let i = 0; i < n; i += 1) {
        x[i] = (values[i] - mean) * w[i];
        windowPower += w[i] * w[i];
    }
    const { re, im } = fft(x);
    const half = Math.floor(nfft / 2) + 1;
    const frequencies = new Float64Array(half);
    const power = new Float64Array(half);
    const scale = 1 / (fs * windowPower);
    for (let k = 0; k < half; k += 1) {
        frequencies[k] = (k * fs) / nfft;
        const doubled = k > 0 && !(nfft % 2 === 0 && k === half - 1);
        power[k] = (re[k] * re[k] + im[k] * im[k]) * scale * (doubled ? 2 : 1);
    }
    return { frequencies, power, binWidth: fs / nfft };
}

/**
 * The strongest peak of a spectrum above zero frequency: its bin, the frequency refined by a parabola through the peak and its
 * two neighbours, its power, and its width, the full width at half of the peak power measured by linear interpolation of the
 * two crossings (null when a crossing lies outside the spectrum). Null for a spectrum with fewer than three bins.
 */
export function spectralPeak(frequencies, power) {
    if (frequencies.length < 3) {
        return null;
    }
    let index = 1;
    for (let k = 2; k < power.length; k += 1) {
        if (power[k] > power[index]) index = k;
    }
    const step = frequencies[1] - frequencies[0];
    let frequency = frequencies[index];
    if (index > 0 && index < power.length - 1) {
        const a = power[index - 1];
        const b = power[index];
        const c = power[index + 1];
        const denominator = a - 2 * b + c;
        if (denominator !== 0) {
            frequency += (0.5 * step * (a - c)) / denominator;
        }
    }
    const half = power[index] / 2;
    let left = null;
    for (let k = index; k > 0; k -= 1) {
        if (power[k - 1] <= half) {
            left = frequencies[k - 1] + (step * (half - power[k - 1])) / (power[k] - power[k - 1]);
            break;
        }
    }
    let right = null;
    for (let k = index; k < power.length - 1; k += 1) {
        if (power[k + 1] <= half) {
            right = frequencies[k] + (step * (power[k] - half)) / (power[k] - power[k + 1]);
            break;
        }
    }
    return { index, binFrequency: frequencies[index], frequency, power: power[index], width: left !== null && right !== null ? right - left : null };
}

/**
 * The spectrogram: the periodogram density of overlapping segments of length segment, a step of segment minus overlap apart,
 * as in SciPy's spectrogram with the density scaling and the constant detrend. times are the segment centres in seconds.
 */
export function spectrogram(values, fs, windowName, segment, overlap) {
    const step = segment - overlap;
    if (!(fs > 0) || segment < 2 || overlap < 0 || step < 1 || values.length < segment) {
        return null;
    }
    const count = Math.floor((values.length - overlap) / step);
    const times = [];
    const columns = [];
    let frequencies = null;
    for (let s = 0; s < count; s += 1) {
        const part = values.subarray ? values.subarray(s * step, s * step + segment) : values.slice(s * step, s * step + segment);
        const spectrum = periodogram(part, fs, windowName, segment);
        frequencies ??= spectrum.frequencies;
        columns.push(spectrum.power);
        times.push((segment / 2 + s * step) / fs);
    }
    return { frequencies, times, power: columns };
}

/**
 * The autocorrelation at lags 0 to maxLag: the sum of the products of the deviations from the mean at a lag, over the sum of
 * their squares (so that lag 0 is 1), computed through the transform of the series padded to at least twice its length.
 * Null for fewer than two values or a series with no spread.
 */
export function autocorrelation(values, maxLag) {
    const n = values.length;
    if (n < 2) {
        return null;
    }
    let mean = 0;
    for (let i = 0; i < n; i += 1) mean += values[i];
    mean /= n;
    const size = nextPowerOfTwo(2 * n);
    const x = new Float64Array(size);
    for (let i = 0; i < n; i += 1) x[i] = values[i] - mean;
    const { re, im } = fft(x);
    for (let k = 0; k < size; k += 1) {
        re[k] = re[k] * re[k] + im[k] * im[k];
        im[k] = 0;
    }
    fftRadix2(re, im, true);
    if (!(re[0] > 0)) {
        return null;
    }
    const lags = Math.min(maxLag, n - 1);
    const out = new Float64Array(lags + 1);
    for (let k = 0; k <= lags; k += 1) out[k] = re[k] / re[0];
    return out;
}

/**
 * The period of a series in samples from its autocorrelation: the lag of the highest value after the autocorrelation has first
 * fallen below zero. Null when it never falls below zero within the lags given.
 */
export function autocorrelationPeriod(r) {
    let first = -1;
    for (let k = 1; k < r.length; k += 1) {
        if (r[k] < 0) {
            first = k;
            break;
        }
    }
    if (first < 0) {
        return null;
    }
    let best = first;
    for (let k = first; k < r.length; k += 1) {
        if (r[k] > r[best]) best = k;
    }
    return best > first ? { lag: best, value: r[best] } : null;
}
