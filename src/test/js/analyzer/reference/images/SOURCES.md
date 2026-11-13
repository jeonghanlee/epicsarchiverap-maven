# Test images of the Image tab: sources and licences

The Image tab of the Analyzer is checked on these single-channel images. `AnalyzerFixtureData` archives their pixels as frames of image PVs, so that each travels the archive, the retrieval and the page. The published originals are not kept here; `prepare-images.py` derives the PNG files from them and checks their SHA-256 first.

| File | Pixels | Derived from | Licence |
| --- | --- | --- | --- |
| `laser.png` | 1307 by 1075, 8 bits | the green channel of "Green laser pointer TEM00 profile.JPG" by Zaereth, a 5 mW green laser pointer beam showing the TEM00 profile, https://commons.wikimedia.org/wiki/File:Green_laser_pointer_TEM00_profile.JPG (SHA-256 27d6e8f4c5430e4024742635d34236edc798105849def7adb04fe8d86a1a06b9) | CC0 1.0 |
| `als.png` | 537 by 537, 8 bits | panel A (the electron beam profile of the ALS) of "ALS Beam Comparison.png", from the ALS-U overview of Lawrence Berkeley National Laboratory, https://commons.wikimedia.org/wiki/File:ALS_Beam_Comparison.png (SHA-256 1bca8c132ae6132a42035aa15509f378a575863122acf6e2befdb61f35692cb7), cut two pixels inside its axes; the value is the luminance of the colour map of the plot, which rises with the plotted intensity but is not that intensity | Public domain |
| `airy.png` | 2560 by 1920, 8 bits | the red channel of "Beugungsscheibchen.k.720.jpg" by Bautsch, the diffraction pattern of a 0.09 mm pinhole in red laser light photographed at 65 mm, https://commons.wikimedia.org/wiki/File:Beugungsscheibchen.k.720.jpg (SHA-256 2752f24da74bf2eb75b4b52b70eccfe31d4abd2c650b08cababc61a73dce5104), reduced from 5184 by 3888 with a Lanczos filter | CC0 1.0 |
| `screen-0.png` to `screen-4.png` | 1034 by 779, 16-bit files holding 12-bit counts | synthetic frames of a low-current electron beam on a YAG:Ce screen, written by `make-screen-frames.py` (seed 20261112) from the model below; `screen-truth.json` holds the parameters | this repository |

## Synthetic YAG:Ce screen frames: sources of the model

`make-screen-frames.py` writes camera frames of a low-current electron beam on a YAG:Ce screen. Each part of the model and each number comes from the sources below; the beam sizes, the tilt, the drift and the peak signal are a chosen working point inside the ranges those sources report, and are written into `screen-truth.json` with every frame so that a check knows the true answer.

| Part of the model | Value used | Source |
| --- | --- | --- |
| Camera format | 1034 by 779 pixels, 12 bits, clipping at 4095 | [R1]: the Basler Scout of the ALBA screens, "12-bit resolution, 1034x779 pixels"; CCD saturation at 4095 enlarges the apparent size |
| Scale on the screen | 20 um per pixel | [R1]: "generally 1 pixel = 20 um" |
| Screen | YAG:Ce, 0.5 mm thick, 30 mm diameter, viewed at 45 degrees in the horizontal plane | [R1] (0.5 mm, 30 mm, tilted 45 degrees horizontally); [R3] (0.5 mm crystal, light taken out at 45 degrees) |
| Horizontal tail from the depth of the crystal | the emission convolved with a one-sided box of thickness times tan 45 degrees, 25 pixels, along x | [R2]: a horizontal tail, more pronounced for thicker screens, from the observation geometry; [R1]: the thickness of the tilted YAG enlarges the horizontal size |
| Saturation of the emission | emitted = I / (1 + I / 2), I in units of the core peak | [R4]: saturation of the emission sites by a dense beam increases the observed size; [R1]: YAG emission saturation |
| Optical resolution | Gaussian point-spread function of sigma 10 um | [R2]: "resolution of the optical system was measured to be about 10 um"; [R3]: "limited to a resolution of about 10 microns" |
| Halo | 1 percent of the peak, four times the core width | [R5]: the beam halo measured with a YAG:Ce screen, a faint distribution around the core |
| Camera noise | photon shot noise (Poisson in electrons), dark noise 12 e-, gain 0.4 counts per electron, offset 100 counts, quantization | [R6]: the linear camera model of EMVA 1288 (photon noise, dark noise, quantization noise; system gain) |
| Powder screens, not modelled | resolution sigma 140 to 180 um | [R7]: kept as the reason this frame models a single crystal, whose resolution is the 10 um above |

## References

- [R1] U. Iriso, G. Benedetti, F. Pérez, "Experience with YAG and OTR screens at ALBA", Proc. DIPAC'09, Basel, Switzerland, TUPB15. https://proceedings.jacow.org/d09/papers/tupb15.pdf
- [R2] G. Kube, C. Behrens, W. Lauth, "Resolution studies of inorganic scintillation screens for high energy and high brilliance electron beams", Proc. IPAC'10, Kyoto, Japan, MOPD088. https://proceedings.jacow.org/IPAC10/papers/mopd088.pdf
- [R3] W. S. Graves, E. D. Johnson, P. G. O'Shea, "A high resolution electron beam profile monitor", Proc. PAC'97, Vancouver, Canada, 7C007. https://proceedings.jacow.org/pac97/papers/pdf/7C007.PDF
- [R4] A. Murokh, J. Rosenzweig, I. Ben-Zvi, X. Wang, V. Yakimenko, "Limitations on measuring a transverse profile of ultra-dense electron beams with scintillators", Proc. PAC 2001, Chicago, USA, TPAH049. https://proceedings.jacow.org/p01/PAPERS/TPAH049.PDF
- [R5] T. Naito, T. Mitsuhashi, "Beam halo measurement utilizing YAG:Ce screen", Proc. IBIC2015, Melbourne, Australia, TUPB024. https://proceedings.jacow.org/IBIC2015/papers/tupb024.pdf
- [R6] European Machine Vision Association, "EMVA Standard 1288: Standard for characterization of image sensors and cameras", Release 3.1 (overview: B. Jähne, https://www.ait.ac.at/fileadmin/mc/digital_safety_security/downloads/1200_JAEHNE_EMVA1288_Release_3.1_handout.pdf); the standard: https://www.emva.org/standards-technology/emva-1288/
- [R7] A. H. Lumpkin et al., "Spatial resolution limits of YAG:Ce powder beam-profile monitors at the Fermilab A0 photoinjector", Proc. FEL2009, Liverpool, UK, TUPC46. https://epaper.kek.jp/FEL2009/papers/tupc46.pdf
