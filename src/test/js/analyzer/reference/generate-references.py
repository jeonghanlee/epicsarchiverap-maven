#!/usr/bin/env python3
"""Writes references.json: fixed datasets and the values that NumPy and SciPy compute from them, against which the checks of
the analyzer routines (stats.js, tests.js, spectrum.js, trend.js, compare.js, the preparation of the Spectrum tab, and the fits, correlations,
regression, principal components, mutual information, clustering and matrix routines of the tools of two and several signals) compare their results. NumPy and SciPy are needed to write the file
and never to run the checks, which read it.

Usage: python3 -I src/test/js/analyzer/reference/generate-references.py
"""
import json
import math
import os
import warnings

import numpy as np
import scipy
from scipy import signal, special, stats

HERE = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(20261107)


def listing(array):
    return [float(x) for x in np.asarray(array).ravel()]


def moments_of(values):
    n = len(values)
    sd = float(np.std(values, ddof=1))
    return {
        "n": n,
        "min": float(np.min(values)),
        "max": float(np.max(values)),
        "mean": float(np.mean(values)),
        "variance": float(np.var(values, ddof=1)),
        "sd": sd,
        "skewness": float(stats.skew(values, bias=True)),
        "kurtosis": float(stats.kurtosis(values, fisher=True, bias=True)),
        "seMean": sd / math.sqrt(n),
        "seSd": sd / math.sqrt(2 * (n - 1)),
    }


def box_of(values):
    q1, median, q3 = np.quantile(values, [0.25, 0.5, 0.75])
    low, high = q1 - 1.5 * (q3 - q1), q3 + 1.5 * (q3 - q1)
    inside = values[(values >= low) & (values <= high)]
    return {
        "q1": float(q1), "median": float(median), "q3": float(q3),
        "whiskerLow": float(inside.min()), "whiskerHigh": float(inside.max()),
        "outliers": listing(np.sort(values[(values < low) | (values > high)])),
    }


reference = {"meta": {"numpy": np.__version__, "scipy": scipy.__version__, "seed": 20261107}}

# Samples: a normal one, a skewed one with outliers and a small one.
samples = {
    "normal": rng.normal(10.0, 2.0, 1000),
    "skewed": rng.gamma(2.0, 3.0, 600),
    "small": np.array([2.5, 3.5, 3.5, 7.0, 9.25]),
}
reference["moments"] = []
for name, values in samples.items():
    ps = [0.0, 0.05, 0.25, 0.5, 0.75, 0.95, 1.0]
    grid = np.linspace(values.min() - 1, values.max() + 1, 61)
    kde = stats.gaussian_kde(values, bw_method="silverman")
    reference["moments"].append({
        "name": name,
        "values": listing(values),
        "expected": moments_of(values),
        "quantiles": {"ps": ps, "values": listing(np.quantile(values, ps))},
        "box": box_of(values),
        "kde": {"grid": listing(grid), "density": listing(kde(grid)), "bandwidth": float(kde.factor * np.std(values, ddof=1))},
    })

# Distribution functions.
xs = [0.001, 0.2, 1.0, 3.2, 7.9, 15.0, 40.0, 120.0]
ks = [1, 2, 4, 7, 10, 30, 60]
reference["chi2sf"] = [{"x": x, "k": k, "sf": float(stats.chi2.sf(x, k))} for x in xs for k in ks]
# A histogram of hundreds of bins gives hundreds of degrees of freedom.
reference["chi2sf"] += [{"x": x, "k": k, "sf": float(stats.chi2.sf(x, k))}
                        for x, k in [(100, 99), (300, 299), (520, 499), (1000, 999), (1100, 999)]]
lambdas = [0.02, 0.1, 0.3, 0.5, 0.8, 0.99, 1.0, 1.01, 1.3, 1.8, 2.5, 3.2]
reference["kolmogorov"] = [{"lambda": v, "q": float(special.kolmogorov(v))} for v in lambdas]

# Two histograms on common bins, one with empty bins.
edges = np.linspace(2, 18, 17)
a = rng.normal(10, 2, 800)
b = rng.normal(10.4, 2.3, 500)
ca, _ = np.histogram(a, edges)
cb, _ = np.histogram(b, edges)
table = np.array([ca, cb])
table = table[:, table.sum(axis=0) > 0]
chi2 = stats.chi2_contingency(table, correction=False)
reference["chiSquare"] = [{
    "a": [int(x) for x in ca], "b": [int(x) for x in cb],
    "statistic": float(chi2.statistic), "degrees": int(chi2.dof), "pValue": float(chi2.pvalue),
}]
ca2 = np.array([0, 3, 9, 20, 11, 4, 0, 0])
cb2 = np.array([0, 1, 5, 14, 17, 9, 2, 0])
table2 = np.array([ca2, cb2])[:, (ca2 + cb2) > 0]
chi2b = stats.chi2_contingency(table2, correction=False)
reference["chiSquare"].append({
    "a": [int(x) for x in ca2], "b": [int(x) for x in cb2],
    "statistic": float(chi2b.statistic), "degrees": int(chi2b.dof), "pValue": float(chi2b.pvalue),
})

# Two-sample Kolmogorov-Smirnov: the statistic of ks_2samp and the Kolmogorov survival at its scaled value.
reference["ks"] = []
pairs = {
    "shifted": (rng.normal(0, 1, 300), rng.normal(0.3, 1, 220)),
    "same": (rng.normal(0, 1, 250), rng.normal(0, 1, 250)),
    "ties": (np.round(rng.normal(5, 2, 200)), np.round(rng.normal(5.5, 2, 150))),
    "far": (rng.normal(0, 1, 100), rng.normal(4, 1, 100)),
}
for name, (x, y) in pairs.items():
    result = stats.ks_2samp(x, y, method="asymp")
    d = float(stats.ks_2samp(x, y).statistic)
    en = len(x) * len(y) / (len(x) + len(y))
    reference["ks"].append({
        "name": name, "a": listing(x), "b": listing(y), "statistic": d,
        "effectiveSize": en, "pValue": float(special.kolmogorov(math.sqrt(en) * d)),
    })

# k-sample Anderson-Darling with midranks, as SciPy reports it (the p-value is capped at 0.25 and floored at 0.001).
reference["ad"] = []
cases = {
    "two same": [rng.normal(0, 1, 120), rng.normal(0, 1, 90)],
    "two near": [rng.normal(0, 1, 150), rng.normal(0.35, 1, 120)],
    "two far": [rng.normal(0, 1, 100), rng.normal(2.5, 1, 100)],
    "three": [rng.normal(0, 1, 80), rng.normal(0.2, 1.1, 70), rng.normal(0.5, 1, 90)],
    "ties": [np.round(rng.normal(5, 2, 100)), np.round(rng.normal(5.6, 2, 80))],
}
for name, groups in cases.items():
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        result = stats.anderson_ksamp(groups)
    reference["ad"].append({
        "name": name, "samples": [listing(g) for g in groups],
        "statistic": float(result.statistic), "critical": listing(result.critical_values),
        "significance": float(result.significance_level),
        "capped": bool(result.statistic < result.critical_values.min()),
        "floored": bool(result.statistic > result.critical_values.max()),
    })

# The difference of two samples, by the arithmetic of its definition.
x, y = samples["normal"][:400], samples["skewed"][:300]
mx, my = moments_of(x), moments_of(y)
reference["compare"] = {
    "a": listing(x), "b": listing(y),
    "meanDifference": mx["mean"] - my["mean"],
    "meanDifferenceError": math.hypot(mx["seMean"], my["seMean"]),
    "sdDifference": mx["sd"] - my["sd"],
    "sdDifferenceError": math.hypot(mx["seSd"], my["seSd"]),
}

# Resampling irregular samples to an even interval.
times = np.cumsum(rng.uniform(0.5, 2.0, 300))
values = np.sin(times / 7) + 0.1 * rng.normal(size=300)
interval = 1.25
grid = times[0] + interval * np.arange(int(math.floor((times[-1] - times[0]) / interval + 1e-9)) + 1)
reference["resample"] = {
    "times": listing(times), "values": listing(values), "interval": interval,
    "expected": listing(np.interp(grid, times, values)),
    "largestGap": float(np.max(np.diff(times))),
}

# Windows, periodic as SciPy's get_window gives them.
reference["windows"] = {name: listing(signal.get_window(scipy_name, 64))
                        for name, scipy_name in [("rectangular", "boxcar"), ("hann", "hann"), ("hamming", "hamming"), ("blackman", "blackman")]}

# The transform at a power of two, composite lengths and a prime.
reference["fft"] = []
for n in [1, 2, 8, 64, 12, 100, 97, 1000, 1024]:
    re, im = rng.normal(size=n), rng.normal(size=n)
    out = np.fft.fft(re + 1j * im)
    reference["fft"].append({"n": n, "re": listing(re), "im": listing(im), "outRe": listing(out.real), "outIm": listing(out.imag)})

# The periodogram density, with and without padding, for an even and an odd length.
fs = 10.0
t = np.arange(1000) / fs
x = 2.0 * np.sin(2 * np.pi * 1.3 * t + 0.4) + 0.5 * np.sin(2 * np.pi * 3.1 * t) + rng.normal(0, 0.3, 1000) + 7.0
reference["periodogram"] = []
for name, window, nfft, data in [("hann", "hann", 1000, x), ("hamming padded", "hamming", 2048, x),
                                 ("rectangular odd", "boxcar", 999, x[:999]), ("blackman", "blackman", 1000, x)]:
    f, p = signal.periodogram(data, fs, window=window, nfft=nfft, detrend="constant", scaling="density")
    reference["periodogram"].append({
        "name": "rectangular" if window == "boxcar" else window, "fs": fs, "nfft": nfft, "values": listing(data),
        "frequencies": listing(f), "power": listing(p),
    })

# The spectrogram.
f, tt, sxx = signal.spectrogram(x[:1024] if len(x) >= 1024 else np.pad(x, (0, 1024 - len(x))), fs, window="hann", nperseg=128,
                                noverlap=64, nfft=128, detrend="constant", scaling="density", mode="psd")
padded = x[:1024] if len(x) >= 1024 else np.pad(x, (0, 1024 - len(x)))
reference["spectrogram"] = {
    "values": listing(padded), "fs": fs, "segment": 128, "overlap": 64,
    "frequencies": listing(f), "times": listing(tt), "power": [listing(sxx[:, j]) for j in range(sxx.shape[1])],
}

# The autocorrelation by direct sums.
n = 500
series = np.sin(2 * np.pi * np.arange(n) / 40) + 0.4 * rng.normal(size=n) + 3.0
d = series - series.mean()
full = np.correlate(d, d, "full")
reference["autocorrelation"] = {"values": listing(series), "maxLag": 120, "expected": listing(full[n - 1:n - 1 + 121] / full[n - 1])}

# The Trend additions: irregular times, the rate between successive samples, the least-squares line, and the time held beyond a
# level (computed here by clipping each holding interval to the window with NumPy, not by the routine under check).
trend_rng = np.random.default_rng(20261108)
count = 400
gaps = trend_rng.choice([5, 10, 10, 10, 20, 60], size=count - 1)
times_s = np.concatenate([[0], np.cumsum(gaps)])
slope_true, level0 = 0.002, 10.0
vals = level0 + slope_true * times_s + 1.5 * np.sin(2 * np.pi * times_s / 900) + 0.3 * trend_rng.normal(size=count)
t0_ms = 1794000000000
times_ms = t0_ms + times_s * 1000
dt = np.diff(times_s)
fit = stats.linregress(times_s, vals)


def beyond_of(level, side, lo_ms, hi_ms):
    start = np.clip(times_ms[:-1], lo_ms, hi_ms)
    stop = np.clip(times_ms[1:], lo_ms, hi_ms)
    length = stop - start
    held = vals[:-1]
    flag = held > level if side == "above" else held < level
    return {"beyond": float(length[flag].sum()), "observed": float(length.sum())}


window = [int(times_ms[40]), int(times_ms[300])]
reference["trend"] = {
    "times": [int(t) for t in times_ms], "values": listing(vals),
    "rates": listing(np.diff(vals) / dt),
    "fit": {"slope": float(fit.slope), "intercept": float(fit.intercept), "rSquared": float(fit.rvalue ** 2), "slopeError": float(fit.stderr), "n": count},
    "window": window,
    "beyond": [
        {"level": 11.0, "side": "above", "window": window, **beyond_of(11.0, "above", *window)},
        {"level": 9.0, "side": "below", "window": window, **beyond_of(9.0, "below", *window)},
        {"level": 11.0, "side": "above", "window": [int(times_ms[0] - 5000), int(times_ms[-1] + 5000)], **beyond_of(11.0, "above", int(times_ms[0] - 5000), int(times_ms[-1] + 5000))},
        {"level": float(vals[10]), "side": "above", "window": window, **beyond_of(float(vals[10]), "above", *window)},
    ],
}

# A constant series has no coefficient of determination (zero over zero); SciPy settles it by returning a correlation of 0.
constant = stats.linregress([0.0, 1.0, 2.0, 3.0], [5.0, 5.0, 5.0, 5.0])
reference["trendConstant"] = {"slope": float(constant.slope), "stderr": float(constant.stderr), "rvalue": float(constant.rvalue)}

# The Compare tab: two samples, the common bins, the chi-square table with the expected counts of SciPy's chi2_contingency, the two-sample
# Kolmogorov-Smirnov distance with the classical asymptotic p-value, the k-sample Anderson-Darling test, and the decision of each test.
compare_rng = np.random.default_rng(20261109)


def compare_case(name, a, b):
    a, b = np.asarray(a, dtype=float), np.asarray(b, dtype=float)
    pooled = np.concatenate([a, b])
    bins = int(math.ceil(math.log2(len(pooled)))) + 1
    lo, hi = float(pooled.min()), float(pooled.max())
    flat = not hi > lo
    case = {"name": name, "a": listing(a), "b": listing(b), "bins": bins}
    if flat or len(a) < 8 or len(b) < 8:
        case["refusal"] = "samples" if (len(a) < 8 or len(b) < 8) else "flat"
        return case
    ca = np.histogram(a, bins=bins, range=(lo, hi))[0]
    cb = np.histogram(b, bins=bins, range=(lo, hi))[0]
    used = (ca + cb) > 0
    table = np.vstack([ca[used], cb[used]])
    chi2, p, dof, expected = stats.chi2_contingency(table, correction=False)
    below = int((expected < 5).sum())
    case["countsA"], case["countsB"] = [int(c) for c in ca], [int(c) for c in cb]
    case["expectedBelowFive"], case["cells"] = below, int(expected.size)
    case["chi2Refused"] = bool(below / expected.size > 0.2)
    case["chi2"] = {"statistic": float(chi2), "degrees": int(dof), "bins": int(used.sum()), "p": float(p)}
    d = float(stats.ks_2samp(a, b).statistic)
    effective = len(a) * len(b) / (len(a) + len(b))
    case["ks"] = {"statistic": d, "p": float(special.kolmogorov(math.sqrt(effective) * d))}
    ad = stats.anderson_ksamp([a, b], midrank=True)
    case["ad"] = {"statistic": float(ad.statistic), "significance": float(ad.significance_level)}
    return case


reference["compareCases"] = [
    compare_case("equal", compare_rng.normal(10, 2, 400), compare_rng.normal(10, 2, 400)),
    compare_case("shifted", compare_rng.normal(10, 2, 400), compare_rng.normal(11, 2, 400)),
    compare_case("unequal sizes", compare_rng.normal(10, 2, 20), compare_rng.normal(10, 2, 2000)),
    compare_case("twenty each", 1.5 * np.sin(compare_rng.uniform(0, 2 * np.pi, 20)), 1.5 * np.sin(compare_rng.uniform(0, 2 * np.pi, 20))),
    compare_case("two separate groups", compare_rng.normal(0, 0.5, 100), compare_rng.normal(20, 0.5, 100)),
    compare_case("few", compare_rng.normal(0, 1, 6), compare_rng.normal(0, 1, 5)),
    compare_case("flat", [5.0] * 12, [5.0] * 14),
]

# The Spectrum tab: the preparation of an irregular series (the median spacing, the gaps, the linear interpolation to an even interval) and
# the three scalings of the one-sided spectrum (SciPy's periodogram with density and spectrum), on a regular series, on an irregular
# series with a gap and on a sine whose period is a whole number of samples (the amplitude of its bin is the amplitude of the sine).
spectrum_rng = np.random.default_rng(20261110)


def scalings(even, fs, window):
    f, density = signal.periodogram(even, fs, window=window, detrend="constant", scaling="density")
    _, power = signal.periodogram(even, fs, window=window, detrend="constant", scaling="spectrum")
    return {"window": window, "frequencies": listing(f), "density": listing(density), "power": listing(power)}


def spectrum_case(name, times, values, windows=("boxcar", "hann")):
    times, values = np.asarray(times, dtype=float), np.asarray(values, dtype=float)
    median = float(np.median(np.diff(times)))
    count = int(math.floor((times[-1] - times[0]) / median + 1e-9)) + 1
    case = {"name": name, "times": listing(times), "values": listing(values), "median": median, "count": count}
    spacings = np.diff(times)
    case["gaps"] = [{"from": float(times[i]), "to": float(times[i + 1])} for i in np.where(spacings > 5 * median)[0]]
    even_times = times[0] + np.arange(count) * median
    even = np.interp(even_times, times, values)
    case["even"] = listing(even)
    case["spectra"] = [scalings(even, 1 / median, w) for w in windows]
    return case


regular_times = np.arange(0, 1200 * 10, 10.0)
sine_values = 1.5 * np.sin(2 * np.pi * regular_times / 600)
noisy = 1.5 * np.sin(2 * np.pi * regular_times / 600) + 0.3 * spectrum_rng.normal(size=len(regular_times)) + 10.0
irregular_times = np.cumsum(spectrum_rng.integers(7, 14, size=700)).astype(float)
irregular_times[300:] += 300.0
irregular_values = 1.5 * np.sin(2 * np.pi * irregular_times / 600) + 0.3 * spectrum_rng.normal(size=len(irregular_times))
reference["spectrumCases"] = {
    "regular": spectrum_case("regular", regular_times, noisy, ("boxcar", "hann", "hamming", "blackman")),
    "sine": spectrum_case("sine", regular_times, sine_values),
    "irregularWithGap": spectrum_case("irregular with a gap", irregular_times, irregular_values),
}

# The tools of two and several signals: fixed datasets with the values of NumPy and SciPy for the fits, the correlations, the
# regression, the principal component analysis, the mutual information, the clustering, the profile and the matrix routines.
# The Landau density of the page is the CERNLIB algorithm (ROOT TMath::Landau), which equals SciPy's landau.pdf with the
# location log(pi/2) and the scale pi/2 within 5e-9 relative; the model below uses SciPy with that mapping.
from scipy import optimize, linalg
from scipy.cluster import hierarchy
from scipy.spatial import distance

pair_rng = np.random.default_rng(20261111)
LANDAU_LOCATION = math.log(math.pi / 2)
LANDAU_SCALE = math.pi / 2


def landau_density(v):
    """The CERNLIB Landau density at the Landau variable v, through SciPy's parameterisation."""
    return stats.landau.pdf(v, LANDAU_LOCATION, LANDAU_SCALE)


def linear_fit(design, y):
    """Least squares of y on the columns of design: the coefficients, their errors (the covariance scaled by the reduced
    chi-square, as an unweighted fit has them), the chi-square per degree of freedom and R squared."""
    coef, _, _, _ = np.linalg.lstsq(design, y, rcond=None)
    residuals = y - design @ coef
    dof = len(y) - design.shape[1]
    chi2 = float(residuals @ residuals)
    cov = np.linalg.inv(design.T @ design) * (chi2 / dof)
    ss_tot = float(((y - y.mean()) ** 2).sum())
    return {"params": listing(coef), "errors": listing(np.sqrt(np.diag(cov))), "chi2PerDof": chi2 / dof, "rSquared": 1 - chi2 / ss_tot, "dof": dof}


def iterative_fit(model, x, y, p0, fixed=None, bounds=None):
    """SciPy curve_fit from p0 (Levenberg-Marquardt without bounds, trust region with them); a fixed parameter is held at
    its p0 value and left out of the errors."""
    names = list(range(len(p0)))
    free = [i for i in names if not (fixed and i in fixed)]
    def f(xx, *free_values):
        full = list(p0)
        for i, v in zip(free, free_values):
            full[i] = v
        return model(xx, *full)
    kwargs = {"method": "lm"} if bounds is None else {"method": "trf", "bounds": ([bounds[0][i] for i in free], [bounds[1][i] for i in free])}
    popt, pcov = optimize.curve_fit(f, x, y, p0=[p0[i] for i in free], maxfev=20000, **kwargs)
    full = list(p0)
    for i, v in zip(free, popt):
        full[i] = float(v)
    residuals = y - model(x, *full)
    dof = len(y) - len(free)
    chi2 = float(residuals @ residuals)
    ss_tot = float(((y - y.mean()) ** 2).sum())
    return {"params": full, "free": free, "errors": listing(np.sqrt(np.diag(pcov))), "chi2PerDof": chi2 / dof, "rSquared": 1 - chi2 / ss_tot, "dof": dof}


def sine_model(x, a, f, phi, c):
    return a * np.sin(2 * np.pi * f * x + phi) + c


def gaussian_model(x, a, mu, sigma, c):
    return a * np.exp(-((x - mu) ** 2) / (2 * sigma ** 2)) + c


def landau_model(x, a, mpv, width, c):
    return a * landau_density((x - mpv) / width) / width + c


x60 = np.linspace(0.5, 10.0, 60)
line_y = -1.0 + 2.5 * x60 + pair_rng.normal(0, 0.4, 60)
poly_y = 1.0 - 0.8 * x60 + 0.3 * x60 ** 2 + pair_rng.normal(0, 0.5, 60)
exp_y = 3.0 * np.exp(0.25 * x60) * np.exp(pair_rng.normal(0, 0.05, 60))
power_y = 2.0 * x60 ** 1.5 * np.exp(pair_rng.normal(0, 0.05, 60))
log_y = 1.5 + 2.0 * np.log(x60) + pair_rng.normal(0, 0.2, 60)
sine_x = np.linspace(0, 20, 200)
sine_y = sine_model(sine_x, 2.0, 0.15, 0.7, 1.0) + pair_rng.normal(0, 0.15, 200)
gauss_x = np.linspace(-5, 15, 200)
gauss_y = gaussian_model(gauss_x, 4.0, 5.0, 1.5, 0.5) + pair_rng.normal(0, 0.1, 200)
landau_x = np.linspace(-5, 25, 300)
landau_y = landau_model(landau_x, 30.0, 4.0, 1.2, 0.2) + pair_rng.normal(0, 0.05, 300)
reference["fitCases"] = {
    "line": {"x": listing(x60), "y": listing(line_y), "truth": [-1.0, 2.5], "fit": linear_fit(np.column_stack([np.ones(60), x60]), line_y)},
    "polynomial2": {"x": listing(x60), "y": listing(poly_y), "truth": [1.0, -0.8, 0.3], "fit": linear_fit(np.column_stack([np.ones(60), x60, x60 ** 2]), poly_y)},
    # The exponential, power and logarithm models are linear in a transformed variable: the fit is of the transformed y, and the
    # natural parameters and their errors follow (a = exp(c0), its error a times the error of c0).
    "exponential": {"x": listing(x60), "y": listing(exp_y), "truth": [3.0, 0.25], "transformed": linear_fit(np.column_stack([np.ones(60), x60]), np.log(exp_y))},
    "power": {"x": listing(x60), "y": listing(power_y), "truth": [2.0, 1.5], "transformed": linear_fit(np.column_stack([np.ones(60), np.log(x60)]), np.log(power_y))},
    "logarithm": {"x": listing(x60), "y": listing(log_y), "truth": [1.5, 2.0], "fit": linear_fit(np.column_stack([np.ones(60), np.log(x60)]), log_y)},
    "sine": {"x": listing(sine_x), "y": listing(sine_y), "truth": [2.0, 0.15, 0.7, 1.0], "p0": [1.5, 0.14, 0.5, 0.8],
             "fit": iterative_fit(sine_model, sine_x, sine_y, [1.5, 0.14, 0.5, 0.8]),
             "fixedOffset": iterative_fit(sine_model, sine_x, sine_y, [1.5, 0.14, 0.5, 1.0], fixed=[3])},
    "gaussian": {"x": listing(gauss_x), "y": listing(gauss_y), "truth": [4.0, 5.0, 1.5, 0.5], "p0": [3.0, 4.5, 2.0, 0.0],
                 "fit": iterative_fit(gaussian_model, gauss_x, gauss_y, [3.0, 4.5, 2.0, 0.0]),
                 "boundedWidth": iterative_fit(gaussian_model, gauss_x, gauss_y, [3.0, 4.5, 2.0, 0.0], bounds=([0, -np.inf, 1.8, -np.inf], [np.inf, np.inf, 3.0, np.inf]))},
    "landau": {"x": listing(landau_x), "y": listing(landau_y), "truth": [30.0, 4.0, 1.2, 0.2], "p0": [25.0, 3.5, 1.0, 0.0],
               "landauLocation": LANDAU_LOCATION, "landauScale": LANDAU_SCALE,
               "density": {"v": listing(np.linspace(-4, 30, 69)), "value": listing(landau_density(np.linspace(-4, 30, 69)))},
               "fit": iterative_fit(landau_model, landau_x, landau_y, [25.0, 3.5, 1.0, 0.0])},
}

# Correlations: Pearson and Spearman with their p-values, the cross-correlation over lags (Pearson's r of x[t] and y[t + lag] over
# the samples both have), and the partial correlation of four variables from the inverse of their correlation matrix.
cx = pair_rng.normal(0, 1, 200)
cy = 0.6 * cx + pair_rng.normal(0, 0.8, 200)
lagged = np.roll(cx, 3) + pair_rng.normal(0, 0.3, 200)
pearson = stats.pearsonr(cx, cy)
spearman = stats.spearmanr(cx, cy)
def cross(x, y, lag):
    if lag >= 0:
        a, b = x[: len(x) - lag], y[lag:]
    else:
        a, b = x[-lag:], y[: len(y) + lag]
    return float(np.corrcoef(a, b)[0, 1])
four = np.column_stack([cx, cy, cx ** 2 + pair_rng.normal(0, 0.5, 200), pair_rng.normal(0, 1, 200)])
corr4 = np.corrcoef(four, rowvar=False)
precision = np.linalg.inv(corr4)
partial = -precision / np.sqrt(np.outer(np.diag(precision), np.diag(precision)))
np.fill_diagonal(partial, 1.0)
reference["correlationCases"] = {
    "x": listing(cx), "y": listing(cy),
    "pearson": {"r": float(pearson.statistic), "p": float(pearson.pvalue)},
    "spearman": {"rho": float(spearman.statistic), "p": float(spearman.pvalue)},
    "lagged": listing(lagged), "lags": list(range(-5, 6)), "cross": [cross(cx, lagged, lag) for lag in range(-5, 6)],
    "four": [listing(col) for col in four.T], "correlationMatrix": [listing(row) for row in corr4], "partialCorrelation": [listing(row) for row in partial],
}

# The multiple linear regression of y on three variables with an intercept: the coefficients, their errors, the standardised
# coefficients (each times the standard deviation of its variable over that of y), R squared and the residuals.
X3 = pair_rng.normal(0, 1, (120, 3)) * np.array([1.0, 2.0, 0.5])
ry = 2.0 + 1.5 * X3[:, 0] - 0.7 * X3[:, 1] + 3.0 * X3[:, 2] + pair_rng.normal(0, 0.5, 120)
design = np.column_stack([np.ones(120), X3])
regression = linear_fit(design, ry)
reference["regressionCases"] = {
    "x": [listing(col) for col in X3.T], "y": listing(ry), "truth": [2.0, 1.5, -0.7, 3.0], **regression,
    "standardised": listing(np.array(regression["params"][1:]) * X3.std(axis=0, ddof=1) / ry.std(ddof=1)),
    "residuals": listing(ry - design @ np.array(regression["params"])),
}

# The principal component analysis of standardised variables: the eigenvalues of the correlation matrix in descending order, the
# share of the variance of each, and the components with the sign that makes their largest element positive.
standardised = (four - four.mean(axis=0)) / four.std(axis=0, ddof=1)
values, vectors = np.linalg.eigh(np.corrcoef(standardised, rowvar=False))
order = np.argsort(values)[::-1]
values, vectors = values[order], vectors[:, order]
for k in range(vectors.shape[1]):
    if vectors[np.argmax(np.abs(vectors[:, k])), k] < 0:
        vectors[:, k] = -vectors[:, k]
reference["pcaCases"] = {"columns": [listing(col) for col in four.T], "eigenvalues": listing(values), "share": listing(values / values.sum()), "components": [listing(vectors[:, k]) for k in range(vectors.shape[1])]}

# The mutual information of two variables as the binned plug-in estimate in nats over k equal-width bins of each variable's range.
def mutual_information(x, y, bins):
    counts, _, _ = np.histogram2d(x, y, bins=bins)
    p = counts / counts.sum()
    px, py = p.sum(axis=1, keepdims=True), p.sum(axis=0, keepdims=True)
    nonzero = p > 0
    return float((p[nonzero] * np.log(p[nonzero] / (px @ py)[nonzero])).sum())
mi_x, mi_y = pair_rng.normal(0, 1, 500), pair_rng.normal(0, 1, 500)
reference["mutualInformationCases"] = {"bins": 16, "cases": [
    {"name": "linear", "x": listing(cx), "y": listing(cy), "value": mutual_information(cx, cy, 16)},
    {"name": "square", "x": listing(cx), "y": listing(cx ** 2), "value": mutual_information(cx, cx ** 2, 16)},
    {"name": "independent", "x": listing(mi_x), "y": listing(mi_y), "value": mutual_information(mi_x, mi_y, 16)},
]}

# Hierarchical clustering of six signals by the distance one minus the absolute correlation, with average linkage: the linkage
# matrix of SciPy and the order of the leaves, which orders the correlation matrix of the Dependency tab.
base_a, base_b = pair_rng.normal(0, 1, 300), pair_rng.normal(0, 1, 300)
six = np.column_stack([base_a, base_a + pair_rng.normal(0, 0.3, 300), -base_a + pair_rng.normal(0, 0.5, 300), base_b, base_b + pair_rng.normal(0, 0.4, 300), pair_rng.normal(0, 1, 300)])
corr6 = np.corrcoef(six, rowvar=False)
dist6 = 1 - np.abs(corr6)
np.fill_diagonal(dist6, 0.0)
linkage = hierarchy.linkage(distance.squareform(dist6, checks=False), method="average")
reference["clusteringCases"] = {"correlationMatrix": [listing(row) for row in corr6], "linkage": [listing(row) for row in linkage], "leaves": [int(i) for i in hierarchy.leaves_list(linkage)]}

# The profile of y against x: the mean of y, its standard error and the count in each of ten equal bins of x.
edges = np.linspace(cx.min(), cx.max(), 11)
which = np.clip(np.digitize(cx, edges) - 1, 0, 9)
profile = []
for b in range(10):
    inside = cy[which == b]
    profile.append({"count": int(len(inside)), "mean": float(inside.mean()) if len(inside) else None, "error": float(inside.std(ddof=1) / math.sqrt(len(inside))) if len(inside) > 1 else None})
reference["profileCases"] = {"x": listing(cx), "y": listing(cy), "edges": listing(edges), "bins": profile}

# The matrix routines: a symmetric positive definite matrix with its inverse, Cholesky factor, a solved system and its eigen
# decomposition (ascending eigenvalues, each vector with its largest element positive), and a general matrix with its inverse.
spd = np.array([[4.0, 1.0, 0.5, 0.0], [1.0, 3.0, 0.2, 0.1], [0.5, 0.2, 2.0, 0.3], [0.0, 0.1, 0.3, 1.0]])
rhs = np.array([1.0, 2.0, 3.0, 4.0])
evals, evecs = np.linalg.eigh(spd)
for k in range(4):
    if evecs[np.argmax(np.abs(evecs[:, k])), k] < 0:
        evecs[:, k] = -evecs[:, k]
general = np.array([[2.0, -1.0, 0.0], [1.0, 3.0, 1.0], [0.5, 0.0, 4.0]])
reference["matrixCases"] = {
    "spd": [listing(row) for row in spd], "inverse": [listing(row) for row in np.linalg.inv(spd)], "cholesky": [listing(row) for row in np.linalg.cholesky(spd)],
    "rhs": listing(rhs), "solution": listing(np.linalg.solve(spd, rhs)), "eigenvalues": listing(evals), "eigenvectors": [listing(evecs[:, k]) for k in range(4)],
    "general": [listing(row) for row in general], "generalInverse": [listing(row) for row in np.linalg.inv(general)],
}

# The pairing of two irregular signals at the union of their sample times, by the gap rule of the Correlation tab: the value a
# signal holds at a time is its last sample at or before it, paired only when that sample is not older than five times the
# signal's median spacing and the sample that ends the hold does not follow a lost connection. Written here by its own loop.
def held(points, t, gap_ms):
    times = [q[0] for q in points]
    i = int(np.searchsorted(times, t, side="right")) - 1
    if i < 0:
        return None
    t0, v0, _ = points[i]
    if t - t0 > gap_ms:
        return None
    if t > t0 and i + 1 < len(points) and points[i + 1][2]:
        return None
    return v0


def pair_case(x, y):
    median = lambda pts: float(np.median(np.diff([q[0] for q in pts]))) if len(pts) > 1 else None
    gap_x, gap_y = 5 * median(x), 5 * median(y)
    x_times = {q[0] for q in x}
    pairs, excluded_x, excluded_y = [], 0, 0
    for t, v, _ in x:
        h = held(y, t, gap_y)
        if h is None:
            excluded_x += 1
        else:
            pairs.append((t, v, h))
    for t, v, _ in y:
        if t in x_times:
            continue
        h = held(x, t, gap_x)
        if h is None:
            excluded_y += 1
        else:
            pairs.append((t, h, v))
    pairs.sort()
    return {"x": [list(q) for q in x], "y": [list(q) for q in y], "pairs": [list(q) for q in pairs], "excludedX": excluded_x, "excludedY": excluded_y, "medianX": median(x), "medianY": median(y)}


# x every 10 s from 0 with a gap of 120 s after 100 s and a lost connection at 400 s; y every 25 s from 7 s. Times in ms.
pair_x = [(t * 1000, float(np.sin(t / 50)), False) for t in list(range(0, 110, 10)) + list(range(230, 400, 10))] + [(400000, 0.5, True)] + [(t * 1000, float(np.cos(t / 50)), False) for t in range(410, 500, 10)]
pair_y = [(t * 1000, 0.1 * t, False) for t in range(7, 500, 25)]
reference["pairingCases"] = {"irregular": pair_case(pair_x, pair_y), "aligned": pair_case([(t * 1000, float(t), False) for t in range(0, 100, 10)], [(t * 1000, float(2 * t), False) for t in range(0, 100, 10)])}

# A weighted fit of a histogram (Poisson weights, one over the count, empty bins left out; the covariance taken as it is, SciPy's
# absolute_sigma) and the one-sigma band of a fitted curve from the covariance and the numerical gradient of the model.
hist_sample = pair_rng.normal(10.0, 2.0, 5000)
hist_counts, hist_edges = np.histogram(hist_sample, bins=30, range=(2.0, 18.0))
hist_centres = (hist_edges[:-1] + hist_edges[1:]) / 2
keep = hist_counts > 0
hist_p0 = [float(hist_counts.max()), 10.5, 1.5, 0.0]
hist_popt, hist_pcov = optimize.curve_fit(gaussian_model, hist_centres[keep], hist_counts[keep].astype(float), p0=hist_p0, sigma=np.sqrt(hist_counts[keep]), absolute_sigma=True, maxfev=20000)
hist_resid = (hist_counts[keep] - gaussian_model(hist_centres[keep], *hist_popt)) / np.sqrt(hist_counts[keep])
reference["weightedFitCases"] = {"histogram": {"centres": listing(hist_centres), "counts": [int(c) for c in hist_counts], "p0": hist_p0, "params": listing(hist_popt), "errors": listing(np.sqrt(np.diag(hist_pcov))),
    "chi2PerDof": float((hist_resid ** 2).sum() / (int(keep.sum()) - 4)), "dof": int(keep.sum()) - 4, "included": int(keep.sum())}}


def band_of(model, params, cov, xs):
    out = []
    for xv in xs:
        grad = []
        for k, pk in enumerate(params):
            h = 1e-7 * max(1.0, abs(pk))
            up, down = list(params), list(params)
            up[k] += h
            down[k] -= h
            grad.append((model(xv, *up) - model(xv, *down)) / (2 * h))
        grad = np.array(grad)
        out.append(float(np.sqrt(max(grad @ cov @ grad, 0.0))))
    return out


sine_fit_popt, sine_fit_pcov = optimize.curve_fit(sine_model, sine_x, sine_y, p0=[1.5, 0.14, 0.5, 0.8], method="lm", maxfev=20000)
band_xs = [0.0, 5.0, 10.0, 15.0, 20.0]
reference["fitCases"]["sine"]["band"] = {"x": band_xs, "sigma": band_of(sine_model, sine_fit_popt, sine_fit_pcov, band_xs)}
line_design = np.column_stack([np.ones(60), x60])
line_fit = linear_fit(line_design, line_y)
line_cov = np.linalg.inv(line_design.T @ line_design) * line_fit["chi2PerDof"]
reference["fitCases"]["line"]["band"] = {"x": band_xs, "sigma": band_of(lambda xv, a, b: a + b * xv, line_fit["params"], line_cov, band_xs)}

# The alignment of several signals on the times all of them share (the means over one interval of the server carry the time of
# their interval, and an interval without samples is absent): the common times, the columns on them, the number of distinct times
# in any signal, the number dropped and the share of the union each signal holds.
align_times = [[0, 60, 120, 180, 240, 300, 360], [0, 60, 180, 240, 300, 360, 420], [60, 120, 180, 240, 360, 420, 480]]
align_series = [{"name": f"s{k}", "points": [{"t": t * 1000, "v": float(k * 100 + t / 60)} for t in times]} for k, times in enumerate(align_times)]
common_times = sorted(set.intersection(*[set(times) for times in align_times]))
union_times = sorted(set.union(*[set(times) for times in align_times]))
reference["alignmentCases"] = {
    "series": align_series, "times": [t * 1000 for t in common_times], "union": len(union_times), "common": len(common_times),
    "dropped": len(union_times) - len(common_times),
    "columns": [[float(k * 100 + t / 60) for t in common_times] for k in range(3)],
    "shares": [len(times) / len(union_times) for times in align_times],
}

# The condition number of a correlation matrix (the largest eigenvalue over the smallest, as np.linalg.cond gives for a symmetric
# positive definite matrix) and the pairs of columns whose absolute correlation reaches a threshold, for a well-conditioned set
# and for a set whose second column is the first plus a little noise.
cond_base = pair_rng.normal(0, 1, (200, 3))
cond_near = np.column_stack([cond_base[:, 0], cond_base[:, 0] + pair_rng.normal(0, 0.02, 200), cond_base[:, 2]])
def cond_case(columns, threshold):
    corr = np.corrcoef(columns, rowvar=False)
    pairs = [{"i": i, "j": j, "r": float(corr[i, j])} for i in range(corr.shape[0]) for j in range(i + 1, corr.shape[0]) if abs(corr[i, j]) >= threshold]
    pairs.sort(key=lambda pair: -abs(pair["r"]))
    return {"columns": [listing(col) for col in columns.T], "cond": float(np.linalg.cond(corr)), "threshold": threshold, "pairs": pairs}
reference["conditionCases"] = {"well": cond_case(cond_base, 0.9), "near": cond_case(cond_near, 0.9)}

with open(os.path.join(HERE, "references.json"), "w") as out:
    json.dump(reference, out, separators=(",", ":"))
    out.write("\n")
print("wrote references.json", os.path.getsize(os.path.join(HERE, "references.json")), "bytes")
