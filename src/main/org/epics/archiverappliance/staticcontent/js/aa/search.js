// The peak search of an array: a translation into JavaScript of TSpectrum::SearchHighRes of ROOT, the engine behind TSpectrum::Search
// (hist/spectrum/src/TSpectrum.cxx of ROOT 6.40.04, by Miroslav Morhac), which keeps the arithmetic and the single working buffer of the
// original so that it returns the peaks that ROOT returns. The method is published in M. Morhac et al., Identification of peaks in
// multidimensional coincidence gamma-ray spectra, Nucl. Instrum. Meth. A443 (2000) 108-125, and rests on M.A. Mariscotti, Nucl. Instrum.
// Meth. 50 (1967) 309-320.
//
// This file is distributed under the terms of the GNU Lesser General Public License, version 2.1 or (at your option) any later version,
// like the code it translates (ROOT is the data analysis framework of CERN). The other files of this repository keep their own licence.
//
// The search removes the background by clipping, smooths the spectrum with a Markov chain, deconvolves it with a Gaussian response of the
// given sigma by the Gold method, and lists the local maxima of the deconvolved spectrum that pass two tests: the deconvolved value
// exceeds the lesser of one percent and the threshold of the highest deconvolved value, and the spectrum before the deconvolution (the
// array without its background) exceeds the threshold times its own highest value. The peak with the highest value before the deconvolution comes first. It gives
// the position (in elements, fractional) and, as TSpectrum::Search does, the value of the array at the nearest element; it gives no
// width.

/** The most elements of a response (a sigma at or above this over five is refused, as ROOT refuses it). */
const PEAK_WINDOW = 1024;
/** The half width, in elements, of the smoothing that the clipping uses with the Markov option. */
const BACKGROUND_SMOOTHING_HALF = 2;

export const DEFAULT_SIGMA = 2;
export const DEFAULT_THRESHOLD = 0.05;
export const DEFAULT_MAX_PEAKS = 100;
export const DEFAULT_DECONVOLUTION_ITERATIONS = 3;
export const DEFAULT_AVERAGE_WINDOW = 3;

/** Throws a RangeError that names the reason when the arguments are not those the search accepts (ROOT writes an error and finds nothing). */
export function checkSearch(length, options) {
    const { sigma, threshold, background, markov, averageWindow, deconvolutionIterations, maxPeaks } = options;
    if (!(sigma >= 1)) throw new RangeError("The sigma of the searched peaks is 1 or more.");
    if (!(threshold > 0 && threshold < 1)) throw new RangeError("The threshold of the peak search is a fraction of the highest peak, above 0 and below 1.");
    if (Math.trunc(5.0 * sigma + 0.5) >= PEAK_WINDOW / 2) throw new RangeError("The sigma of the searched peaks is too large.");
    if (markov && !(averageWindow > 0 && Number.isInteger(averageWindow))) throw new RangeError("The averaging window of the Markov smoothing is a whole number, 1 or more.");
    if (!Number.isInteger(deconvolutionIterations) || deconvolutionIterations < 0) throw new RangeError("The iterations of the deconvolution are a whole number, 0 or more.");
    if (!Number.isInteger(maxPeaks) || maxPeaks < 1) throw new RangeError("The most peaks to list is a whole number, 1 or more.");
    const clipping = Math.trunc(7 * sigma + 0.5);
    if (background && length < 2 * clipping + 1) {
        throw new RangeError(`The array has ${length} elements and the background of a sigma of ${sigma} needs at least ${2 * clipping + 1}; give a smaller sigma or no background.`);
    }
    if (length < 3 || length < Math.trunc(2 * sigma + 0.5)) {
        throw new RangeError(`The array has ${length} elements, too few for a sigma of ${sigma}.`);
    }
}

/**
 * The peaks of an array as ROOT finds them. options: sigma (the sigma of the searched peaks in elements, 2 by default), threshold (the
 * fraction of the highest value of the spectrum before the deconvolution, below which a peak is dropped, 0.05; a peak must also
 * exceed the lesser of one percent and the threshold of the highest deconvolved value, as in ROOT), background (remove the background first, true), markov (smooth with
 * the Markov chain, true), deconvolutionIterations (of the Gold deconvolution, 3), averageWindow (of the Markov chain, 3) and maxPeaks (100). Returns
 * {positions, peaks, deconvolved}: the positions in elements as ROOT lists them (the highest first), the peaks with the nearest element
 * and the array value there, and the deconvolved spectrum (zeros when nothing was found).
 */
export function searchPeaks(source, options = {}) {
    const settings = {
        sigma: DEFAULT_SIGMA, threshold: DEFAULT_THRESHOLD, background: true, markov: true, deconvolutionIterations: DEFAULT_DECONVOLUTION_ITERATIONS,
        averageWindow: DEFAULT_AVERAGE_WINDOW, maxPeaks: DEFAULT_MAX_PEAKS, ...options,
    };
    for (let i = 0; i < source.length; i += 1) {
        if (!Number.isFinite(source[i])) throw new RangeError(`Element ${i} of the array is not a finite number.`);
    }
    checkSearch(source.length, settings);
    const { sigma, background, markov, averageWindow, maxPeaks } = settings;
    const deconIterations = settings.deconvolutionIterations;
    const thresholdPercent = 100 * settings.threshold;
    const ssize = source.length;

    const numberIterations = Math.trunc(7 * sigma + 0.5);
    const shift = numberIterations;
    const sizeExt = ssize + 2 * numberIterations;
    const bw = BACKGROUND_SMOOTHING_HALF;
    // One working buffer in seven parts of sizeExt elements, used in turn for several purposes as in the original.
    const ws = new Float64Array(7 * sizeExt);
    const ext = sizeExt; // the extended spectrum, then the spectrum without background
    const aux = 2 * sizeExt; // the Markov-smoothed spectrum, then the source of the deconvolution
    const iter = 3 * sizeExt; // the result of the last deconvolution iteration
    const vec = 4 * sizeExt; // the vector p of the deconvolution
    const pre = 6 * sizeExt; // the spectrum without background, kept for the threshold on the peaks

    // The slope of a line through the first 2 sigma elements, never rising, extends the spectrum to the left.
    let slope = 0;
    const k = Math.trunc(2 * sigma + 0.5);
    if (k >= 2) {
        let m0 = 0;
        let m1 = 0;
        let m2 = 0;
        let l0 = 0;
        let l1 = 0;
        for (let i = 0; i < k; i += 1) {
            const a = i;
            const b = source[i];
            m0 += 1;
            m1 += a;
            m2 += a * a;
            l0 += b;
            l1 += a * b;
        }
        const det = m0 * m2 - m1 * m1;
        slope = det !== 0 ? (-l0 * m1 + l1 * m0) / det : 0;
        if (slope > 0) slope = 0;
    }
    const extended = (i) => {
        if (i < shift) return Math.max(0, source[0] + slope * (i - shift));
        if (i >= ssize + shift) return Math.max(0, source[ssize - 1]);
        return source[i - shift];
    };
    for (let i = 0; i < sizeExt; i += 1) ws[i + ext] = extended(i);

    if (background) {
        for (let i = 1; i <= numberIterations; i += 1) {
            for (let j = i; j < sizeExt - i; j += 1) {
                let a = ws[ext + j];
                if (!markov) {
                    const b = (ws[ext + j - i] + ws[ext + j + i]) / 2.0;
                    if (b < a) a = b;
                    ws[j] = a;
                } else {
                    let av = 0;
                    let men = 0;
                    for (let w = j - bw; w <= j + bw; w += 1) {
                        if (w >= 0 && w < sizeExt) {
                            av += ws[ext + w];
                            men += 1;
                        }
                    }
                    av /= men;
                    let b = 0;
                    men = 0;
                    for (let w = j - i - bw; w <= j - i + bw; w += 1) {
                        if (w >= 0 && w < sizeExt) {
                            b += ws[ext + w];
                            men += 1;
                        }
                    }
                    b /= men;
                    let c = 0;
                    men = 0;
                    for (let w = j + i - bw; w <= j + i + bw; w += 1) {
                        if (w >= 0 && w < sizeExt) {
                            c += ws[ext + w];
                            men += 1;
                        }
                    }
                    c /= men;
                    b = (b + c) / 2;
                    if (b < a) av = b;
                    ws[j] = av;
                }
            }
            for (let j = i; j < sizeExt - i; j += 1) ws[ext + j] = ws[j];
        }
        for (let j = 0; j < sizeExt; j += 1) ws[ext + j] = extended(j) - ws[ext + j];
        for (let j = 0; j < sizeExt; j += 1) {
            if (ws[ext + j] < 0) ws[ext + j] = 0;
        }
    }

    for (let i = 0; i < sizeExt; i += 1) ws[i + pre] = ws[i + ext];

    if (markov) {
        for (let j = 0; j < sizeExt; j += 1) ws[aux + j] = ws[ext + j];
        const xmin = 0;
        const xmax = sizeExt - 1;
        let maxch = 0;
        let area = 0;
        for (let i = 0; i < sizeExt; i += 1) {
            ws[i] = 0;
            if (maxch < ws[aux + i]) maxch = ws[aux + i];
            area += ws[aux + i];
        }
        if (maxch === 0) {
            return { positions: [], peaks: [], deconvolved: new Float64Array(ssize) };
        }
        let nom = 1;
        ws[xmin] = 1;
        for (let i = xmin; i < xmax; i += 1) {
            const nip = ws[aux + i] / maxch;
            const nim = ws[aux + i + 1] / maxch;
            let sp = 0;
            let sm = 0;
            for (let l = 1; l <= averageWindow; l += 1) {
                let a = i + l > xmax ? ws[aux + xmax] / maxch : ws[aux + i + l] / maxch;
                let b = a - nip;
                a = a + nip <= 0 ? 1 : Math.sqrt(a + nip);
                b = Math.exp(b / a);
                sp += b;
                a = i - l + 1 < xmin ? ws[aux + xmin] / maxch : ws[aux + i - l + 1] / maxch;
                b = a - nim;
                a = a + nim <= 0 ? 1 : Math.sqrt(a + nim);
                b = Math.exp(b / a);
                sm += b;
            }
            const a = sp / sm;
            ws[i + 1] = ws[i] * a;
            nom += ws[i + 1];
        }
        for (let i = xmin; i <= xmax; i += 1) ws[i] /= nom;
        for (let j = 0; j < sizeExt; j += 1) ws[ext + j] = ws[j] * area;
        for (let j = 0; j < sizeExt; j += 1) ws[aux + j] = ws[ext + j];
        if (background) {
            for (let i = 1; i <= numberIterations; i += 1) {
                for (let j = i; j < sizeExt - i; j += 1) {
                    let a = ws[ext + j];
                    const b = (ws[ext + j - i] + ws[ext + j + i]) / 2.0;
                    if (b < a) a = b;
                    ws[j] = a;
                }
                for (let j = i; j < sizeExt - i; j += 1) ws[ext + j] = ws[j];
            }
            for (let j = 0; j < sizeExt; j += 1) ws[ext + j] = ws[aux + j] - ws[ext + j];
        }
    }

    // The Gold deconvolution: the response of the given sigma, the matrix of its autocorrelation and the vector p, then the iterations.
    let area = 0;
    let lhGold = -1;
    let posit = 0;
    let maximum = 0;
    for (let i = 0; i < sizeExt; i += 1) {
        let lda = i - 3 * sigma;
        lda = (lda * lda) / (2 * sigma * sigma);
        lda = Math.trunc(1000 * Math.exp(-lda));
        if (lda !== 0) lhGold = i + 1;
        ws[i] = lda;
        area += lda;
        if (lda > maximum) {
            maximum = lda;
            posit = i;
        }
    }
    for (let i = 0; i < sizeExt; i += 1) ws[aux + i] = Math.abs(ws[ext + i]);
    let reach = lhGold - 1;
    if (reach > sizeExt) reach = sizeExt;
    let imin = -reach;
    let imax = reach;
    for (let i = imin; i <= imax; i += 1) {
        let lda = 0;
        const jmin = i < 0 ? -i : 0;
        let jmax = lhGold - 1 - i;
        if (jmax > lhGold - 1) jmax = lhGold - 1;
        for (let j = jmin; j <= jmax; j += 1) lda += ws[j] * ws[i + j];
        ws[ext + i - imin] = lda;
    }
    reach = lhGold - 1;
    imin = -reach;
    imax = sizeExt + reach - 1;
    for (let i = imin; i <= imax; i += 1) {
        let lda = 0;
        for (let j = 0; j <= lhGold - 1; j += 1) {
            const kk = i + j;
            if (kk >= 0 && kk < sizeExt) lda += ws[j] * ws[aux + kk];
        }
        ws[vec + i - imin] = lda;
    }
    for (let i = imin; i <= imax; i += 1) ws[aux + i - imin] = ws[vec + i - imin];
    for (let i = 0; i < sizeExt; i += 1) ws[i] = 1;
    for (let lindex = 0; lindex < deconIterations; lindex += 1) {
        for (let i = 0; i < sizeExt; i += 1) {
            if (Math.abs(ws[aux + i]) > 0.00001 && Math.abs(ws[i]) > 0.00001) {
                let lda = 0;
                let jmin = lhGold - 1;
                if (jmin > i) jmin = i;
                jmin = -jmin;
                let jmax = lhGold - 1;
                if (jmax > sizeExt - 1 - i) jmax = sizeExt - 1 - i;
                for (let j = jmin; j <= jmax; j += 1) lda += ws[j + lhGold - 1 + ext] * ws[i + j];
                const ldb = ws[aux + i];
                lda = lda !== 0 ? ldb / lda : 0;
                ws[iter + i] = lda * ws[i];
            }
        }
        for (let i = 0; i < sizeExt; i += 1) ws[i] = ws[iter + i];
    }
    for (let i = 0; i < sizeExt; i += 1) ws[ext + ((i + posit) % sizeExt)] = ws[i];
    maximum = 0;
    let maximumDecon = 0;
    const j0 = lhGold - 1;
    for (let i = 0; i < sizeExt - j0; i += 1) {
        if (i >= shift && i < ssize + shift) {
            ws[i] = area * ws[ext + i + j0];
            if (maximumDecon < ws[i]) maximumDecon = ws[i];
            if (maximum < ws[pre + i]) maximum = ws[pre + i];
        } else {
            ws[i] = 0;
        }
    }
    const fraction = Math.min(1, thresholdPercent) / 100;

    // The local maxima of the deconvolved spectrum that pass both tests, kept in the order of the spectrum before the deconvolution,
    // highest first.
    const positions = new Array(maxPeaks).fill(0);
    let peakIndex = 0;
    for (let i = 1; i < sizeExt - 1; i += 1) {
        if (ws[i] > ws[i - 1] && ws[i] > ws[i + 1] && i >= shift && i < ssize + shift) {
            if (ws[i] > fraction * maximumDecon && ws[pre + i] > (thresholdPercent * maximum) / 100.0) {
                let a = 0;
                let b = 0;
                for (let j = i - 1; j <= i + 1; j += 1) {
                    a += (j - shift) * ws[j];
                    b += ws[j];
                }
                a /= b;
                if (a < 0) a = 0;
                if (a >= ssize) a = ssize - 1;
                if (peakIndex === 0) {
                    positions[0] = a;
                    peakIndex = 1;
                } else {
                    let j;
                    let higher = false;
                    for (j = 0; j < peakIndex && !higher; j += 1) {
                        if (ws[pre + shift + Math.trunc(a)] > ws[pre + shift + Math.trunc(positions[j])]) higher = true;
                    }
                    if (!higher) {
                        if (j < maxPeaks) positions[j] = a;
                    } else {
                        for (let kk = peakIndex; kk >= j; kk -= 1) {
                            if (kk < maxPeaks) positions[kk] = positions[kk - 1];
                        }
                        positions[j - 1] = a;
                    }
                    if (peakIndex < maxPeaks) peakIndex += 1;
                }
            }
        }
    }
    const deconvolved = new Float64Array(ssize);
    for (let i = 0; i < ssize; i += 1) deconvolved[i] = ws[i + shift];
    const found = positions.slice(0, peakIndex);
    const peaks = found.map((x) => {
        const index = Math.trunc(x + 0.5);
        return { position: x, index, value: source[index] };
    });
    return { positions: found, peaks, deconvolved };
}
