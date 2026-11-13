"""Derives the single-channel test images of the Image tab from their published originals (SOURCES.md) and writes them beside this
script as PNG files, the pixels that AnalyzerFixtureData archives:

  laser.png   the green channel of "Green laser pointer TEM00 profile.JPG", 1307 by 1075, 8 bits;
  als.png     panel A of "ALS Beam Comparison.png" cut two pixels inside its axes, the luminance of its colour map, 8 bits;
  airy.png    the red channel of "Beugungsscheibchen.k.720.jpg" reduced from 5184 by 3888 to 2560 by 1920 (Lanczos), 8 bits.

The originals are not kept in the repository; their SHA-256 in SOURCES.md is checked before anything is written.
Usage: prepare-images.py ORIGINALS_DIR
"""
import hashlib
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ORIGINALS = {
    "Green_laser_pointer_TEM00_profile.JPG": "27d6e8f4c5430e4024742635d34236edc798105849def7adb04fe8d86a1a06b9",
    "ALS_Beam_Comparison.png": "1bca8c132ae6132a42035aa15509f378a575863122acf6e2befdb61f35692cb7",
    "Beugungsscheibchen.k.720.jpg": "2752f24da74bf2eb75b4b52b70eccfe31d4abd2c650b08cababc61a73dce5104",
}
# Panel A of the ALS figure: the rows and columns of its axes box, found as the dark block of the left half (rows 31 to 571,
# columns 101 to 641 of the original), cut two pixels inside so that no axis line remains.
ALS_ROWS, ALS_COLS, ALS_INSET = (31, 571), (101, 641), 2
AIRY_SIZE = (2560, 1920)


def original(folder, name):
    path = os.path.join(folder, name)
    digest = hashlib.sha256(open(path, "rb").read()).hexdigest()
    if digest != ORIGINALS[name]:
        raise SystemExit(f"{name}: SHA-256 {digest} differs from {ORIGINALS[name]}")
    return Image.open(path)


def main():
    folder = sys.argv[1]
    laser = np.asarray(original(folder, "Green_laser_pointer_TEM00_profile.JPG").convert("RGB"))[..., 1]
    Image.fromarray(laser, mode="L").save(os.path.join(HERE, "laser.png"))
    rgb = np.asarray(original(folder, "ALS_Beam_Comparison.png").convert("RGB")).astype(float)
    r0, r1 = ALS_ROWS[0] + ALS_INSET, ALS_ROWS[1] - ALS_INSET + 1
    c0, c1 = ALS_COLS[0] + ALS_INSET, ALS_COLS[1] - ALS_INSET + 1
    panel = rgb[r0:r1, c0:c1]
    luminance = np.rint(0.299 * panel[..., 0] + 0.587 * panel[..., 1] + 0.114 * panel[..., 2]).astype(np.uint8)
    Image.fromarray(luminance, mode="L").save(os.path.join(HERE, "als.png"))
    airy = original(folder, "Beugungsscheibchen.k.720.jpg").convert("RGB").getchannel("R").resize(AIRY_SIZE, Image.LANCZOS)
    airy.save(os.path.join(HERE, "airy.png"))
    for name in ("laser.png", "als.png", "airy.png"):
        image = Image.open(os.path.join(HERE, name))
        print(name, image.size, image.mode, hashlib.sha256(open(os.path.join(HERE, name), "rb").read()).hexdigest())


if __name__ == "__main__":
    main()
