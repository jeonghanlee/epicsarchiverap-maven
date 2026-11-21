# Reference-based synthetic signal examples

Eight physical signal examples for deciding what an archive analyzer should analyze. Every measurement, event, PV name, calibration, and timestamp in this directory is synthetic. The source documents establish real measurement practices and observed phenomena; the numeric simulation settings are explicit choices in [models.json](models.json). These files are not downloaded measurements or an inventory of installed facility PVs.

## Scope

This collection covers physical signal meaning, acquisition axes, illustrative normal and abnormal behavior, and analysis questions. It supplies local JSON/CSV data and plots for analyzer design. It does not implement analyzer tabs, certify equipment limits, simulate a complete accelerator, or verify the IOC-to-archive path.

## Signals and analysis questions

| Signal | Measurement and axis | Analysis question | Sources |
|---|---|---|---|
| Stored beam current | Current in mA against acquisition time | What is the lifetime between injections? Were injections missed? How large was a partial beam loss? | [1] |
| BPM position | Position in um; slow timestamps and a separate fast time waveform | Is orbit drift delayed relative to temperature? Which frequencies dominate motion? Did vibration grow? | [2], [3] |
| Magnet current | Setpoint/readback in A against time | Does the supply follow the ramp? What is the residual ripple on a constant-current plateau? | [4] |
| RF cavity envelope | I/Q and amplitude in MV against time within each pulse | What are fill time, flat-top error, decay time, and the effect of an early RF trip or detuning? | [5] |
| Vacuum gauge pressure | Pressure in mbar against elapsed pumping time | Does pressure follow an outgassing slope? Is there a persistent floor or a recoverable pressure burst? | [6] |
| Temperature readback | Temperature in degC against time | What are dead time, time constant, and settling time after a commanded step? | [7] |
| Photon counts | Integer detections per exposure, with shutter and attenuation state | What are dark counts, count-rate changes, and noise variance under fixed illumination? | [8] |
| Camera beam image | Pixel intensity; image X/Y, spatial profiles, intensity bins, and frame timestamps | Does the spot move or broaden? Does saturation distort the profile and centroid measurement? | [9], [10] |

These are eight signal families, not eight tabs. One signal can require several views. A waveform can be a time trace, a spatial profile, or a histogram; its length does not identify its axis.

## Source observations and model choices

### Stored beam current

The ALS describes the change from decaying current between refills to frequent top-off injections [1]. The model uses exponential decay with a chosen 8 h lifetime, 400 mA target, and 60 s injection schedule. Three injections are deliberately missed, followed later by an 8% partial loss. Recovery injections have a chosen 4 mA maximum increment. Injection markers must be excluded from lifetime fits. The loss and missed-injection scenarios are invented examples, not reported ALS incidents.

### BPM position

Wittenburg describes orbit disturbances on different time scales, including support vibration, mains frequencies, and temperature effects [2]. The SIRIUS paper reports a 60 Hz peak in fast BPM measurements and day-scale drift correlated with temperature [3]. The slow model spans two days at 60 s intervals, with two position channels responding to temperature after 1800 s. The fast model spans 8 s at 2 kHz, with 12, 60, and 120 Hz components and a 4-6 s amplitude increase. Amplitudes, coupling coefficients, and the delay are chosen. The slow and fast records are separate examples; a slow archive cannot recover the fast spectrum. Correlation alone cannot establish which device caused real orbit motion.

### Magnet current

The PLS paper examines current stability, ripple oscillograms, and ripple spectra [4]. The example supply ramps from 100 to 110 A, follows a first-order response, and has 10, 60, and 120 Hz ripple. Ripple grows after 7 s. Frequency and amplitude choices are illustrative, not the PLS measured spectrum or acceptance limits. Compare 5-7 s and 7-9 s constant-current segments; a spectrum of the entire ramp would mix commanded motion with ripple.

### RF cavity envelope

The DESY paper compares cavity filling under detuning and discusses the relation between filling time, loaded Q, and RF drive [5]. The model is a simplified complex envelope satisfying `dV/dt = -(1/tau + i*2*pi*df)*V + drive/tau`. It uses an elevated constant drive during filling, then a lower constant drive on the flat top. Three captures share relative pulse timing: on resonance, an early trip, and 200 Hz detuning. Their acquisition timestamps differ. The model excludes beam loading and feedback; the numeric envelope parameters are not a FLASH cavity specification. The samples describe the envelope, not the RF carrier.

### Vacuum pressure

Bregliozzi shows pressure-versus-time curves for metallic outgassing, a leak, and polymeric outgassing [6]. The generated curves use `P0/(1+t/t0) + base`, `P0/sqrt(1+t/t0) + base`, and the metallic curve plus a leak floor. A fourth curve adds a recoverable exponential pressure burst. These models begin in the high-vacuum outgassing regime. They do not represent pumping from atmospheric pressure. Slopes are compared using positive elapsed times on logarithmic axes; pressure alone does not uniquely identify gas composition or a leak.

### Temperature readback

NI distinguishes sensor response time from time constant and shows responses to positive and negative steps [7]. The example uses two deliberately chosen first-order thermal responses to the same 22-to-25 degC command: 20 s delay and 120/240 s time constants. A 60 s interval is absent from one sensor record. The example's thermal plant and delay are assumptions, not specifications of a particular NI sensor. Missing observations remain missing; the data do not fill the interval with zeros or interpolated measurements.

### Photon counts

NIST describes detector characterization using a Poisson source, dark counts, and time-tagged detections [8]. This example supplies binned counts, not individual photon event times. It chooses independent Poisson observations with 0.1 s exposure, 800 counts/s signal, and 5 counts/s dark background. Shutter closure and later attenuation change the mean. Mean/variance comparisons must use a constant-state segment. Dead time, afterpulsing, efficiency calibration, and nonclassical source statistics are outside this model.

### Camera beam image

ALS uses synchrotron-radiation images to measure transverse beam size [9]. areaDetector distinguishes image statistics, spatial profiles, intensity histograms, and time series [10]; it also cautions that statistics updates need not have uniform timing. The example generates 32 Gaussian images at 96 x 64 pixels with explicit irregular frame timestamps, horizontal drift, later broadening, and final ADC saturation. Pixel scale, spot dimensions, noise, and clipping levels are chosen. X/Y profiles are mean projections of the saved image. Histograms count pixels in intensity bins. Centroids use raw intensities above the configured threshold, consistent with that documented definition; background and clipping can bias the result. The model does not reproduce the complete NDPluginStats implementation or infer electron emittance from image width.

## Data contract

Each scenario has `data/<scenario>.json` and CSV tables under `data/<scenario>/`. JSON contains `synthetic`, `source_ids`, `parameters`, an arbitrary UTC origin, explicit column units/roles, numeric tables, and event annotations. CSV files contain the same table values and use empty fields for missing observations. Numeric table columns have equal lengths; timestamps are strictly increasing within each time table.

`elapsed_s` is elapsed acquisition time relative to the scenario's UTC origin. RF `pulse_time_us` is time inside a captured pulse, with acquisition timestamps in capture metadata. BPM fast data use a separate, explicitly timed burst. Camera arrays have dimension order `[frame, y, x]`; X/Y profiles use pixel coordinates, and intensity histograms use ADU bins. Pixel scale is an optional synthetic image-plane calibration, not a source-size conversion. Each frame has its own actual simulated timestamp.

Model inputs and noise-free truth columns are labeled separately from synthetic observations. Event annotations are generated scenario truth, not results found by an anomaly detector. No facility PV names are invented; mapping to actual PVs requires the installed measurement and archive configuration.

## Generate and inspect

Run `generate.py` with Python 3 and NumPy/Matplotlib installed. It reads `models.json`, writes the JSON/CSV collection, renders an overview and per-scenario figures, and writes a local `index.html`. Plotting reads the saved JSON files. `verify.py` additionally requires SciPy; it reads the saved JSON/CSV and checks their physical and structural properties. `verification.json` records observed results. These checks are not analyzer or archive integration tests.

Open [index.html](index.html) for figures and downloads, or [overview.png](plots/overview.png) for a single-page preview. The generator uses fixed independent random seeds per scenario. The synthetic time origin is fixed and does not indicate the date of a real experiment.

## Reference catalog

All ten source URLs below were opened on Nov. 4, 2026. Relevant text was read for each cited claim; no source figures or datasets are redistributed. For [6], the CERN-hosted copy could not be read through its access challenge; the author's arXiv copy was read instead. Citation formats follow the IEEE Reference Guide: [1], [7], [8], [9] use T (Websites); [2], [6] use S (Preprint arXiv); [3], [4], [5] use C (Conference Proceedings Online or Conference Paper Online); [10] uses I (Manual Online).

## References

[1] L. Tamura. "ALS Tips Hat to 10 Years of Top-Off." Advanced Light Source. Accessed: Nov. 4, 2026. [Online]. Available: https://als.lbl.gov/als-tips-hat-to-10-years-of-top-off/

[2] K. Wittenburg, "Diagnostics examples from third-generation light sources," 2020, [arXiv:2005.06762](https://arxiv.org/pdf/2005.06762).

[3] L. Liu et al., "Status of Sirius operation," in Proc. 13th Int. Particle Accel. Conf. (IPAC2022), Bangkok, Thailand, 2022, pp. 1385-1388. [Online]. Available: https://proceedings.jacow.org/ipac2022/papers/tupoms002.pdf

[4] S. H. Nam, S. H. Jeong, S. H. Han, J. H. Suh, K. M. Ha, and M. Yoon. (1996). Magnet power supplies of PLS 2 GeV storage ring. Presented at EPAC'96. [Online]. Available: https://proceedings.jacow.org/e96/PAPERS/MOPG/MOP104G.PDF

[5] V. Ayvazyan, S. Choroba, Z. Geng, G. Petrosyan, S. Simrock, and V. Vogel. (2010). Optimization of filling procedure for TESLA-type cavities for klystron RF power minimization for European XFEL. Presented at IPAC'10. [Online]. Available: https://msk.desy.de/localfsExplorer_read?currentPath=%2Fafs%2Fdesy.de%2Fgroup%2Fmsk%2Fwww%2Fhtml%2FPublikationen%2FReports%2FIPAC2010%2Fipac2010_ayvazyan.pdf

[6] G. Bregliozzi, "Vacuum acceptance tests for particle accelerator equipment," 2020, [arXiv:2006.10367](https://arxiv.org/pdf/2006.10367).

[7] NI. "Sensor Terminology." NI. Accessed: Nov. 4, 2026. [Online]. Available: https://www.ni.com/en/shop/data-acquisition/sensor-fundamentals/sensor-terminology.html

[8] NIST. "Sources, detectors and metrology." NIST. Accessed: Nov. 4, 2026. [Online]. Available: https://www.nist.gov/programs-projects/sources-detectors-and-metrology

[9] Lawrence Berkeley National Laboratory. "Diagnostics and Systems Integration." Accelerator Technology & Applied Physics Division. Accessed: Nov. 4, 2026. [Online]. Available: https://atap.lbl.gov/research/scientific-programs-and-centers/advanced-light-source-accelerator-physics-program/diagnostics-and-systems-integration/

[10] M. Rivers. NDPluginStats. (n.d.). Accessed: Nov. 4, 2026. [Online]. Available: https://areadetector.github.io/areaDetector/ADCore/NDPluginStats.html
