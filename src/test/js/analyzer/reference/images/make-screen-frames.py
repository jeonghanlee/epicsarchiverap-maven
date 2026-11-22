"""Generates synthetic camera frames of a low-current electron beam on a YAG:Ce screen, every parameter taken from the papers listed in
SOURCES.md, with the beam parameters written beside the frames (screen-truth.json).

Model, in the order the light travels:
  1. The beam: a tilted two-dimensional Gaussian, plus a faint wide halo [R5].
  2. The screen: YAG:Ce 0.5 mm thick, 30 mm in diameter, observed at 45 degrees in the horizontal plane [R1, R3]; the light emitted
     along the depth of the crystal is seen displaced horizontally, which gives a one-sided horizontal tail [R2]; the emission
     saturates at high charge density, which flattens the core [R4, R1].
  3. The optics: a Gaussian point-spread function of 10 micrometres [R2, R3].
  4. The camera: 1034 by 779 pixels of 12 bits, 20 micrometres of screen per pixel [R1]; photon shot noise, dark noise and
     quantization as the linear camera model has them [R6]; the sensor clips at 4095 [R1].
Usage: make-screen-frames.py; writes screen-<k>.png (16-bit single channel, row-major, height by width) for k = 0 to 4 and
screen-truth.json beside this script.
"""
import json
import os

import numpy as np

OUT = os.path.dirname(os.path.abspath(__file__))
FRAMES = 5
SEED = 20261112

# [R1] Basler Scout of the ALBA screen monitors: 12 bits, 1034 by 779 pixels; 1 pixel is about 20 um on the screen.
WIDTH, HEIGHT, BITS, UM_PER_PIXEL = 1034, 779, 12, 20.0
FULL_SCALE = 2 ** BITS - 1
# [R1, R3] YAG:Ce 0.5 mm thick, observed at 45 degrees in the horizontal plane.
THICKNESS_UM, VIEW_DEG = 500.0, 45.0
# [R2, R3] optical resolution about 10 um.
PSF_SIGMA_UM = 10.0
# The beam on the screen (a chosen working point; the sizes are those of a low-current linac beam of [R1] in the hundreds of um).
SIGMA_X_UM, SIGMA_Y_UM, TILT_DEG = 600.0, 300.0, 20.0
CENTRE_X_PX, CENTRE_Y_PX, DRIFT_X_PX = 500.0, 400.0, 3.0
# [R5] a halo of about 1 percent of the peak, four times wider than the core.
HALO_FRACTION, HALO_WIDTH = 0.01, 4.0
# [R4, R1] the emission saturates: emitted = I / (1 + I / I_sat), I_sat in units of the core peak.
SATURATION = 2.0
# [R6] the linear camera model: mean photo-electrons at the peak, dark noise in electrons, system gain in counts per electron, offset.
PEAK_ELECTRONS, DARK_NOISE_E, GAIN_DN_PER_E, OFFSET_DN = 12000.0, 12.0, 0.4, 100.0


def frame(rng, k):
    y, x = np.mgrid[0:HEIGHT, 0:WIDTH].astype(float)
    cx, cy = CENTRE_X_PX + DRIFT_X_PX * k, CENTRE_Y_PX
    sx, sy, t = SIGMA_X_UM / UM_PER_PIXEL, SIGMA_Y_UM / UM_PER_PIXEL, np.radians(TILT_DEG)
    u = (x - cx) * np.cos(t) + (y - cy) * np.sin(t)
    v = -(x - cx) * np.sin(t) + (y - cy) * np.cos(t)
    core = np.exp(-0.5 * ((u / sx) ** 2 + (v / sy) ** 2))
    halo = HALO_FRACTION * np.exp(-0.5 * ((u / (HALO_WIDTH * sx)) ** 2 + (v / (HALO_WIDTH * sy)) ** 2))
    deposit = core + halo
    emitted = deposit / (1.0 + deposit / SATURATION)
    # [R2] depth of the crystal seen at 45 degrees: light from depth d appears d * tan(45) further along x; the emission is uniform in
    # depth, so the image is the emission convolved with a one-sided box of thickness * tan(view) in x.
    shift_px = THICKNESS_UM * np.tan(np.radians(VIEW_DEG)) / UM_PER_PIXEL
    steps = max(1, int(round(shift_px)))
    smeared = np.zeros_like(emitted)
    for s in range(steps):
        smeared[:, s:] += emitted[:, : WIDTH - s] if s else emitted
    smeared /= steps
    # [R2, R3] the optics: Gaussian point-spread function, applied along x and y.
    p = PSF_SIGMA_UM / UM_PER_PIXEL
    radius = int(np.ceil(4 * p))
    kernel = np.exp(-0.5 * (np.arange(-radius, radius + 1) / p) ** 2)
    kernel /= kernel.sum()
    blurred = np.apply_along_axis(lambda r: np.convolve(r, kernel, mode="same"), 1, smeared)
    blurred = np.apply_along_axis(lambda c: np.convolve(c, kernel, mode="same"), 0, blurred)
    # [R6] photon shot noise (Poisson in electrons), dark noise, gain, offset, quantization; [R1] clipping at full scale.
    electrons = rng.poisson(blurred / blurred.max() * PEAK_ELECTRONS)
    signal = OFFSET_DN + GAIN_DN_PER_E * (electrons + rng.normal(0.0, DARK_NOISE_E, electrons.shape))
    counts = np.clip(np.rint(signal), 0, FULL_SCALE).astype(np.uint16)
    return counts, {"frame": k, "centreX": cx, "centreY": cy}


def main():
    from PIL import Image
    rng = np.random.default_rng(SEED)
    truths = []
    for k in range(FRAMES):
        counts, truth = frame(rng, k)
        Image.fromarray(counts.astype(np.uint16)).save(os.path.join(OUT, f"screen-{k}.png"))
        truth["clipped"] = int((counts == FULL_SCALE).sum())
        truth["max"] = int(counts.max())
        truths.append(truth)
    meta = {"width": WIDTH, "height": HEIGHT, "bits": BITS, "umPerPixel": UM_PER_PIXEL, "sigmaXum": SIGMA_X_UM, "sigmaYum": SIGMA_Y_UM, "tiltDeg": TILT_DEG,
            "thicknessUm": THICKNESS_UM, "viewDeg": VIEW_DEG, "psfSigmaUm": PSF_SIGMA_UM, "haloFraction": HALO_FRACTION, "haloWidth": HALO_WIDTH,
            "saturation": SATURATION, "peakElectrons": PEAK_ELECTRONS, "darkNoiseE": DARK_NOISE_E, "gainDnPerE": GAIN_DN_PER_E, "offsetDn": OFFSET_DN,
            "seed": SEED, "frames": truths}
    with open(os.path.join(OUT, "screen-truth.json"), "w") as handle:
        json.dump(meta, handle, indent=1)
    print("wrote", FRAMES, "frames; frame 0 max", truths[0]["max"], "clipped pixels", truths[0]["clipped"])


if __name__ == "__main__":
    main()
