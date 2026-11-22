# Analyzer mockup with physical signal examples

Open [index.html](index.html) directly in a browser. The mockup uses the eight [reference-based synthetic signal examples](../analyzer-signal-examples/README.md). Its canvas comes from the production chart modules; its analysis tabs remain an offline prototype with no appliance connection. [canvas-demo.html](canvas-demo.html) demonstrates two independent canvas instances outside the Analyzer page.

## Interaction

Choose a signal family in the proposal strip. The question card explains the measurement and supplies named intervals or captures. These buttons apply an example selection; switching an analysis tab preserves the selected signals and interval. BPM provides separate slow-history and fast-capture acquisitions. RF and camera frame timestamps are separate from the axis inside an array.

The eight analysis tabs remain Trend, Distribution, Correlation, Dependency, Spectrum, Compare, Waveform, and Image. Their availability depends on the selected input. M1 foundation exposes only Trend and explains the other unavailable views.

| View | Working behavior |
|---|---|
| Trend | Saved samples, unit-specific axes, finite-value summaries, gaps, visibility, optional running average and deviation band |
| Distribution | Equal-width histogram, finite-sample statistics, Gaussian or Poisson fitting, and residuals |
| Correlation | Exact timestamp pairs, scatter, Pearson coefficient, linear/quadratic/Gaussian fitting, and residuals |
| Dependency | Pairwise Pearson matrix, pair counts, and navigation to the selected scatter plot |
| Spectrum | One-sided peak amplitude from the selected complete, uniformly timed observations |
| Compare | One signal in explicitly selected A/B intervals with matching value scales |
| Waveform | RF envelope channels, camera X/Y mean profiles, or pixel-intensity histograms; optional first-capture overlay |
| Image | Saved frame pixels, actual irregular frame times, fixed ADU color range, centroid, saturation count, and mean profiles |

From is included and To is excluded in this prototype. Intervals do not interpolate missing values. Profiles use image coordinates; histograms use intensity bins. Their axes are not time. Camera centroid and width values are the saved, thresholded image statistics; they are not fitted beam parameters.

### Plot hover

Every analysis view exposes values under the pointer. Histogram tooltips show the bin interval and count; Scatter shows the nearest visible observation within 16 screen pixels, with X/Y units and its timestamp. Dependency cells show Pearson r and the number of paired observations. Spectrum shows a computed frequency bin and amplitude. Compare and Waveform show actual samples for each range or capture; Image shows pixel coordinates and ADU, with separate mean-profile tooltips. Completed fits include fitted values and residuals, also available in the residual plot. Missing samples and empty intervals do not acquire interpolated values. Hover hides during dragging, outside the plot, and on Escape. Axis changes retain the preceding page position.

### Histogram bins

Distribution / Options retains the Bin count presets (5, 12, 20, 40, 80) beside a Custom count input and Apply button. Custom counts accept integers from 1 to 1000; typing alone leaves the current result unchanged. Bin minimum and Bin maximum have separate Apply bin range and Auto controls. The fields show the effective boundaries and their unit. Bins have equal width; the panel also displays that width and included/excluded finite-sample counts. Each bin includes its lower edge and excludes its upper edge, except the last bin also includes the maximum. CSV marks that last boundary with `upper_inclusive`; fitted observation rows carry `upperInclusive`.

Boundary inputs normally display six significant digits, with additional digits when needed to distinguish a narrow range. Calculations, exports, and copied settings retain the full boundary values. Applying untouched inputs leaves the result unchanged; editing one boundary retains the other boundary's full value. Display precision does not indicate measurement accuracy.

Changing bin bounds or count clears the previous fit and Distribution display ranges. Auto restores the padded range of the current data. Copy link preserves manual bounds and count; changing the source signal restores automatic bounds. Invalid, reversed, nonfinite or numerically indistinguishable bin edges leave the previous result intact. An empty bin range shows empty bins and no fit controls. Poisson fitting requires nonnegative integer observations with unit count, and both the observations and bin maximum must be at most 10000.

Bin range is separate from plot zoom and fit range. Summary retains all selected source observations. Visible range summarizes the original values that lie inside both the histogram bin range and the displayed X range. The fit uses complete bins inside its independently configured fit range; changing plot zoom does not change bin boundaries or refit the model.

### Selected data and visible range

The original Summary or Results retains the full data selection. A separate Visible range section below it recalculates statistics when the displayed axes change. Values use original finite observations, not interpolated lines or bin-center estimates. Both displayed endpoints are included, within the already selected source interval. Standard deviation uses the sample definition with N - 1; zero points show a count of zero and unavailable statistics, and one point has no estimated standard deviation.

| View | Additional statistics |
|---|---|
| Trend | Per visible signal: sample count, mean, standard deviation, median, minimum and maximum inside the time and unit-specific Y ranges |
| Distribution | Sample count, mean, standard deviation and median inside the X value range; Y frequency zoom does not filter observations |
| Correlation | Exact pairs inside both axes: pair count, Pearson r, coordinate means, standard deviations and medians |
| Dependency | Current selected signals: defined off-diagonal pairs and the strongest absolute Pearson coefficient, with its signed value, signal names and pair count |
| Spectrum | Visible frequency-bin count, greatest bin's frequency and amplitude, and mean bin amplitude; transform input and settings remain unchanged; no integrated-power claim |
| Compare | Independent sample count, mean, standard deviation and median for the displayed A and B ranges |
| Waveform | Separate current/reference array statistics and peak position; camera intensity histograms instead summarize the original pixels inside the intensity range |
| Image | Independent X/Y mean-profile statistics and peaks; full-frame centroid and widths remain unchanged |
| Fit residuals | Visible existing residual count, mean, standard deviation and median; the fitted model and its overall RMSE remain unchanged |

Plot navigation, statistical definitions, input assumptions and fitting explanations use the console's existing `infoButton` and information card. Essential values, units, ranges, errors and fit status remain visible. The cards open by mouse or keyboard and close with Escape or Close, returning focus to their button. `mockup-help.js` adapts the card and `range-summary.js` owns viewport statistics; the canvas remains independent of these analysis calculations.

Spectrum removes the sample mean, applies a symmetric Hann window, and zero-pads to the next power of two. Interior positive-frequency magnitudes are doubled after division by the window sum; DC and Nyquist are not doubled. The display separates the original record resolution from the padded frequency grid. At least 16 finite observations and uniform time intervals are required. No gap filling, irregular-data resampling, PSD calculation, or continuous-frequency peak fitting is supplied.

Correlation uses exact timestamp pairs and excludes missing observations. A constant input has no defined correlation. Curve confidence bands, statistical significance tests, PCA, ROI editing, and image fitting remain unavailable or explicitly marked Preview.

Export writes the active result: samples, histogram bins, pairs, matrix coefficients, displayed spectrum bins, comparison samples, waveform values, or selected-frame pixels. CSV includes units and a synthetic source label. Copy link retains the example, acquisition, selected inputs, common and reference intervals, view, frame, and supported display settings.

## Fitting

In Distribution or Correlation, open Options, select a model, and press Run fit. Each parameter has an initial value, a Fixed checkbox, and lower/upper bounds. Blank bounds mean unbounded; positive scale and nonnegative count parameters retain their physical lower limits. Reset estimates restores data-based initial values and default bounds. Solver settings expose the iteration limit and relative stopping tolerance. Fitted curves and residuals can be shown independently.

Distribution supplies Gaussian, Gaussian plus constant background, and Poisson models. Gaussian predictions integrate probability over each bin; background is a count density multiplied by bin width. The normalization parameter `n` describes the full distribution, including probability outside the displayed range. Poisson requires nonnegative integer observations with unit `count`, up to 10000 in this prototype, and sums probability over the integer values in each bin. The objective is Poisson deviance by default, with unweighted least squares available. Only complete bins inside the fit range participate; empty bins are retained. Bins containing no possible nonnegative integer outcome do not contribute to the Poisson degrees of freedom.

Correlation supplies linear, quadratic, and Gaussian-plus-offset models with unweighted least squares in Y. Linear and quadratic models use the displayed fixed reference `x0` to center X; `b` is the value at that reference. Both X fit-range endpoints are included. Pearson r describes all plotted pairs, while fitted parameters, residual RMSE, and R squared describe only the fit-range pairs. No X uncertainty, interpolation, or time-lag correction is applied.

Results show the objective, parameter values and constraints, standard errors, approximate 95% parameter intervals, raw observed-minus-fitted residuals, and solver termination. The solver uses scaled numerical derivatives and bounded damped least squares. Invalid inputs, insufficient independent observations, dependent parameter derivatives, stalled searches, and iteration limits have no successful curve or fit export. Convergence is a numerical stopping condition, not validation of a physical model. No p-value is estimated.

Changing data selection, bins, model, or numerical settings clears the result, including its uncertainty. Changing curve visibility or display profile retains it. Result CSV adds fitted values and residuals only for included observations. Parameter CSV exports estimates, standard errors, approximate 95% intervals, units, constraints, calculation status, and assumptions. Fit JSON also exports the covariance matrix, its parameter order, variance scale, and calculation method. Unavailable numeric fields are JSON nulls and empty CSV fields, never zero uncertainty. Fit settings and results are local to the open page and are not encoded in shared links or retained after reload.

For a Gaussian example, select Temperature response and Steady-state spread. For a Poisson example, select Photon counts and Dark counts, then choose the Poisson model. For linear regression, select BPM position and Temperature relationship. All three use the saved synthetic observations.

### Parameter uncertainty

For unweighted least squares, the local covariance approximation [1] is `C = s^2 * inverse(J^T J)`, where `J` is the derivative of model predictions with respect to the free parameters and `s^2 = SSE / df`. This assumes independent Y errors with equal variance and uses the residuals to estimate that variance. X uncertainty and serial correlation are not modeled.

For the Poisson objective, the expected Fisher information provides the asymptotic covariance approximation [2]. Applied to the prototype's bin means, this gives `C = inverse(J^T diag(1 / expected_count) J)`. The prediction derivatives are evaluated at the fitted parameters; the covariance is not rescaled by residual deviance. The method assumes independent Poisson bin counts and does not correct for overdispersion or a fixed-total multinomial sampling model.

The standard error is the square root of the covariance diagonal. Approximate 95% intervals are `estimate +/- 1.959963984540054 * SE`. These are local normal approximations, not small-sample Student t intervals, profile-likelihood intervals, or curve confidence bands. Model mismatch and calibration errors are excluded. Numerical agreement with a reference calculation does not establish interval coverage for correlated samples or an unsuitable model.

Fixed parameters have status Fixed and no estimated error; their supplied values are treated as exact when estimating the remaining parameters. The covariance and errors for all free parameters are withheld if a parameter is at a bound, an approximate interval reaches a bound, the sensitivity matrix is singular or ill-conditioned, or the least-squares residual variance is zero at numerical resolution. The reason appears beside the result; intervals are not clipped to bounds. The condition limit is `1e10` for the column-normalized information matrix.

## Data flow

`build_data.py` reads the saved JSON files and checks them against their verification hashes. It serializes those documents into `signal-data.js` for direct local-file opening, without a fetch request or a local server. `signal-catalog.js` assigns display labels and preserves units, roles, acquisition times, nulls, and array dimensions. `mockup.js` selects observations and performs the described calculations. `shared-plots.js` renders Trend through the production `drawTimeSeries` and numeric plots through `createPlotCanvas`, using the checkout's bundled D3.

The shared canvas supplies axes, clipping, X/Y drag selection, keyboard axis controls, pan/zoom buttons, Ctrl+wheel zoom and reset. Each plot owns its displayed ranges. Viewing a narrower range does not change selected observations, histogram bins, fit settings, covariance or result exports. Data-selection changes clear display ranges; tab changes preserve them. Copied links include those display ranges. Dependency matrices and image pixels retain their dedicated renderers; their associated numeric profiles use the shared canvas.

Run `node docs/analyzer-mockup/build-chart.cjs` after changing production chart modules. This requires webpack and compiles their actual source for local-file opening. `shared-chart-sources.json` records the source hashes. The [canvas API](../../docs/design-chart-canvas.md) defines ownership and lifecycle.

`fit-ui.js` owns per-view settings, invalidation, overlays, residual plots, parameter uncertainty tables, and fit exports. `fit-engine.js` evaluates models, minimizes residual objectives, and estimates local covariance without a network service or external numerical package.

Run `python3 docs/analyzer-mockup/build_data.py` from the repository root after regenerating and verifying the source examples. The bundle contains all example frames for offline review. This is a prototype packaging choice; the production design still calls for retrieving only the selected image frame.

Every measurement is synthetic. Dataset column identifiers are not facility PV names. The source catalog separates published measurement phenomena from chosen model settings. The [interface design](../../docs/design-analyzer-ui.md) owns the proposed production composition and phase boundaries.

## Verification

`verify-fitting.cjs` opens the actual local-file page in Chromium, operates its controls, and saves the downloaded JSON/CSV and screenshots. It requires Playwright and Chromium; `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` can override the local validation defaults. `verify-fitting.py` checks exported observations against the source JSON and compares the downloaded fits with independent SciPy calculations, including fixed parameters, bounds, and restricted ranges. It validates covariance and standard errors using analytical model derivatives, NumPy matrix inversion, and SciPy linear-regression errors, then checks interval endpoints and both CSV products against the JSON. NumPy and SciPy are validation dependencies only.

```bash
node docs/analyzer-mockup/verify-fitting.cjs
python3 docs/analyzer-mockup/verify-fitting.py
```

The reports are `fit-browser-check.json` and `fit-numerical-check.json`. They verify this offline prototype, not the production analyzer or its milestone acceptance.

`node docs/analyzer-mockup/verify-canvas.cjs` exercises independent time/numeric instances, keyboard focus, drag coordinates at 1440/720/320 pixels, wheel zoom, reset, copied ranges, and unchanged fit/export values. It writes `canvas-browser-check.json` and screenshots, and verifies the generated bundle against the production source hashes.

`node docs/analyzer-mockup/verify-range-summary.cjs` operates the actual plot controls and compares displayed range statistics with independent arithmetic over the saved observations. It covers empty and one-sample ranges, per-unit Trend axes, correlation, FFT bins, independent comparisons/profiles, retained source summaries and fitted results, and information-card focus and compact layouts. Results are in `range-summary-check.json`.

`node docs/analyzer-mockup/verify-bin-range.cjs` verifies bin boundaries against original observations, endpoint inclusion, included/excluded counts, fit invalidation, Auto, copied settings, invalid and empty ranges, and compact controls. It also checks retained preset choices, custom counts from 1 to 1000, Apply and Enter, invalid inputs, dense bar widths, and custom counts restored after reload. It exports Gaussian and Poisson fits with manual bin ranges, including a custom-count Gaussian fit, for `verify-fitting.py` to compare with SciPy. The browser report is `bin-range-check.json`.

`node docs/analyzer-mockup/verify-hover.cjs` drives real mouse and keyboard input across the analysis views, comparing tooltips with actual observations, saved image pixels and completed fit exports. It checks missing/empty inputs, fit preservation, matrix navigation, tooltip boundaries, and scroll/focus preservation during X/Y-axis changes at 1440, 720 and 320 pixels. Results and source hashes are recorded in `hover-check.json`.

## References

[1] SciPy. "curve_fit." SciPy Manual. Accessed: Nov. 4, 2026. [Online]. Available: https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.curve_fit.html

[2] C. Czado. "Lecture 6: Poisson regression." Carnegie Mellon University. Accessed: Nov. 4, 2026. [Online]. Available: https://www.stat.cmu.edu/~brian/valerie/617-2022/617-2021/week07/resources/lec6.pdf
