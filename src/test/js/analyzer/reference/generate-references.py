#!/usr/bin/env python3
"""Writes references.json: fixed datasets and the values that NumPy and SciPy compute from them, against which the checks of
the analyzer routines (stats.js, tests.js, spectrum.js, trend.js, compare.js) compare their results. NumPy and SciPy are needed to write the file
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

with open(os.path.join(HERE, "references.json"), "w") as out:
    json.dump(reference, out, separators=(",", ":"))
    out.write("\n")
print("wrote references.json", os.path.getsize(os.path.join(HERE, "references.json")), "bytes")
