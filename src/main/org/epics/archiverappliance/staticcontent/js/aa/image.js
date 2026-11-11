// The analysis of one image: an array whose element count is its width times its height, stored row-major with the origin at the top
// left and the column index running along X. A region is the half-open block [x0, x1) by [y0, y1) of stored indices, so that a flip of
// the display never changes the indices. The functions refuse an image whose size does not match its element count and a region that
// does not lie inside the image, with a RangeError that names the reason.
import { checkValues, difference } from "./array.js";
import { fitModel } from "./fit.js";

/** The full width at half maximum of a Gaussian is this factor times its sigma (about 2.355). */
export const FWHM_FACTOR = 2 * Math.sqrt(2 * Math.log(2));

/** Throws a RangeError unless the width and the height are whole numbers of at least 1 and match the number of elements. */
export function checkImage(pixels, width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
        throw new RangeError("The width and the height of an image are whole numbers of pixels, 1 or more.");
    }
    if (!pixels || pixels.length !== width * height) {
        throw new RangeError(`An image of ${width} by ${height} pixels has ${width * height} elements; the array has ${pixels ? pixels.length : 0}.`);
    }
}

/** Throws a RangeError unless the region is a non-empty block of whole indices inside the image. */
export function checkRegion(width, height, region) {
    const { x0, x1, y0, y1 } = region || {};
    for (const [name, value] of [["x0", x0], ["x1", x1], ["y0", y0], ["y1", y1]]) {
        if (!Number.isInteger(value)) throw new RangeError(`The ${name} of the region is not a whole number.`);
    }
    if (x0 < 0 || y0 < 0 || x1 > width || y1 > height) {
        throw new RangeError(`The region ${x0}..${x1} by ${y0}..${y1} lies outside the image of ${width} by ${height} pixels.`);
    }
    if (x1 <= x0 || y1 <= y0) {
        throw new RangeError(`The region ${x0}..${x1} by ${y0}..${y1} is empty; its upper bounds must exceed its lower bounds.`);
    }
}

/**
 * The values of a region: the total and the mean intensity, the minimum, the first maximum in row-major order with its position,
 * the intensity-weighted centroid (null unless the total is positive) and the X and Y projections (the sums of the columns and of
 * the rows of the region). With no region the whole image is taken.
 */
export function regionStats(pixels, width, height, region = { x0: 0, x1: width, y0: 0, y1: height }) {
    checkImage(pixels, width, height);
    checkValues(pixels);
    checkRegion(width, height, region);
    const { x0, x1, y0, y1 } = region;
    const projectionX = new Float64Array(x1 - x0);
    const projectionY = new Float64Array(y1 - y0);
    let total = 0;
    let min = Infinity;
    let best = -Infinity;
    let peak = null;
    for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
            const v = pixels[y * width + x];
            total += v;
            projectionX[x - x0] += v;
            projectionY[y - y0] += v;
            if (v < min) min = v;
            if (v > best) {
                best = v;
                peak = { x, y, value: v };
            }
        }
    }
    let centroid = null;
    if (total > 0) {
        let sx = 0;
        let sy = 0;
        for (let k = 0; k < projectionX.length; k += 1) sx += (x0 + k) * projectionX[k];
        for (let k = 0; k < projectionY.length; k += 1) sy += (y0 + k) * projectionY[k];
        centroid = { x: sx / total, y: sy / total };
    }
    const count = (x1 - x0) * (y1 - y0);
    return { x0, x1, y0, y1, total, mean: total / count, min, peak, centroid, projectionX, projectionY };
}

/**
 * The Gaussian size of a projection: the Gaussian of the fit panel fitted from a start made of the data (the amplitude the range of
 * the projection, the centre the first position of its maximum, the width one sixth of its number of positions, the offset its
 * minimum). Returns the fit with sigma and the full width at half maximum, or {ok: false, reason} when the fit cannot be made,
 * among them a projection that is constant, whose width would be only the start value.
 */
export function gaussianSize(positions, projection) {
    let top = 0;
    let high = -Infinity;
    let low = Infinity;
    for (let i = 0; i < projection.length; i += 1) {
        if (projection[i] > high) {
            high = projection[i];
            top = i;
        }
        if (projection[i] < low) low = projection[i];
    }
    if (high === low) {
        return { ok: false, reason: "The projection is constant, so it has no width to fit; choose a region that holds the feature." };
    }
    const fit = fitModel("gaussian", Array.from(positions), Array.from(projection), { start: [high - low, positions[top], positions.length / 6, low] });
    if (!fit.ok) return fit;
    if (!fit.converged) return { ok: false, reason: "The Gaussian fit of the projection did not converge." };
    const sigma = Math.abs(fit.params[2]);
    return { ...fit, sigma, fwhm: FWHM_FACTOR * sigma };
}

/** The Gaussian size of a region in X and in Y, from the fits of its two projections. */
export function regionSize(pixels, width, height, region) {
    const stats = regionStats(pixels, width, height, region);
    const positions = (from, count) => Array.from({ length: count }, (_, k) => from + k);
    return {
        x: gaussianSize(positions(stats.x0, stats.projectionX.length), stats.projectionX),
        y: gaussianSize(positions(stats.y0, stats.projectionY.length), stats.projectionY),
    };
}

/** The image with a constant level subtracted from every pixel; no value is clamped, so a pixel below the level stays negative. */
export function subtractConstant(pixels, level) {
    checkValues(pixels);
    if (!Number.isFinite(level)) throw new RangeError("The level to subtract is not a finite number.");
    const out = new Float64Array(pixels.length);
    for (let i = 0; i < pixels.length; i += 1) out[i] = pixels[i] - level;
    return out;
}

/** The pixel-by-pixel difference of two frames of the same size (the image minus the reference). */
export function frameDifference(pixels, reference, width, height) {
    checkImage(pixels, width, height);
    checkImage(reference, width, height);
    return difference(pixels, reference);
}
