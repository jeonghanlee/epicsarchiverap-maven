# Analyzer interface design

Date: 2026-11-04
Status: M1 foundation composition accepted; M2-M5 capabilities remain planned
Architecture: [Analyzer design](design-analyzer.md)
Plan and acceptance: [M1](milestone-bfb0dc71.md#m1---analyzer-phase-a-page-header-and-address)
Interactive proposal: [Open mockup](../work/analyzer-mockup/index.html)

## Scope

This proposal specifies the complete analyzer interface: the shared signal and time selection, eight analysis tabs, their inputs and results, configuration and export, and behavior when data or a tool is unavailable. It uses analysis tabs as requested in the design discussion. The M1 foundation composition is accepted on 2026-11-04; detailed M2-M5 behavior remains subject to each phase's plan acceptance.

M1 includes deciding this composition and implementing its foundation. Designing the complete interface here does not move the computations or advanced controls of M2-M5 into M1. The canonical milestone document owns implementation scope, acceptance, authorization and verification.

**Out of scope:** changes to archiving, storage or retrieval algorithms; implementing production analysis routines; selecting an unresolved production numerical method; accepting M2-M5 implementation plans. The mockup uses reference-based synthetic data and local demonstration calculations. It does not contact an appliance or validate the production analyzer.

## User workflow

Select archived PVs and a time range, inspect their trend, then switch analysis without losing that selection. Choose the inputs needed by a particular analysis, inspect its result and the data it used, and share the address or export a named result.

The same flow applies to a temperature drift, two signals around an event, a periodic disturbance, a waveform at one timestamp, or an image region. Labels describe signals and units rather than a particular facility.

## Page composition

The page has five levels, in this order:

1. The existing site header and navigation, including time zone and display profile.
2. Common PV selection and time range.
3. Analysis tabs, always in the same order.
4. The active analysis: its input selectors, main plot and result table.
5. A page footer with request state, data origin and active range.

Decision 2026-11-04: the time-range controls appear once with the common PV/time selection above the analysis tabs. They control the common range used by every chart and are not repeated per chart. Axes contains the unit-specific Y-range settings. The complete M1 foundation plan was subsequently accepted and authorized on 2026-11-04.

A right-hand panel contains Signals, Axes, Options, Data and Export. It belongs to the active analysis but retains common signal settings. It can be hidden to enlarge the plot. Results stay below the main plot, so opening a configuration panel does not hide them. Data is an inspection view, not a ninth analysis tab.

At wide widths, the main plot fills the available space beside a 320 px panel. Below 1100 px, the panel moves beneath the plot and results. Below 600 px, forms stack and comparisons become vertically stacked. Only the tab row and large data tables may scroll horizontally; the page itself must fit at 320 px. The site navigation uses the existing compact-menu behavior.

### Common controls

| Control | Behavior | Phase |
| --- | --- | --- |
| PV search and Plot | Select archived names; adding a PV never starts archiving | M1 |
| Selected PV chips | Show identity and unit; remove a PV from the analysis | M1 |
| From, To and Show | Edit a range as a draft, validate, then apply it once | M1 |
| Range shortcuts | Resolve against the current endpoint; Show applies the displayed absolute endpoints | M1 |
| Shared time-range controls | One group above the analysis tabs controls the common range of every chart | M1 |
| Time zone | Change display and time entry without changing the selected instants | M1 |
| Display profile | Retain Default, Red-green and Monochrome and their distinct line styles | M1 |
| Copy link | Copy the effective, validated view state with absolute time endpoints | M1 |
| Data source and interval | Display Auto, raw or a chosen interval and the actual returned data form | M2 |
| Plot interaction controls | Range selection, pan, zoom, cursors and history under the accepted M2 gesture rule | M2 |

There is one common time range for the page. A tab never changes it merely by becoming active. Compare adds a separately labeled reference range B; Waveform and Image add a frame timestamp within the common range. These local selections must not silently replace the common range.

### Analysis tabs and availability

| Tab | Required input | Main output | Phase |
| --- | --- | --- | --- |
| Trend | One or more supported scalar signals | Time series, legend and summary | M1 foundation; M2-M3 additions |
| Distribution | One numeric scalar | Histogram, summary and time patterns | M3 |
| Correlation | Two numeric scalars with overlapping usable data | Scatter, fit, residuals and pair statistics | M4 |
| Dependency | Three to twenty numeric scalars | Matrix, ranking and multivariate results | M4 |
| Spectrum | A numeric scalar with adequate time data | Spectrum, peaks and processing details | M3 |
| Compare | One numeric scalar and two ranges, or two numeric scalars | Aligned comparisons and distribution differences | M3 |
| Waveform | A numeric array | Profiles, time-element heatmap and array summaries | M5 |
| Image | An array with known, compatible image dimensions | Frame, region, projections and image summaries | M5 |

Keep the order Trend, Distribution, Correlation, Dependency, Spectrum, Compare, Waveform, Image. Do not infer a tool's availability from PV count alone: metadata and the data within the selected range must also support it. Image dimensions must match the selected frame; a numeric array is not automatically an image.

Unavailable tabs stay visible, keyboard reachable and marked unavailable with an explanation. Examples are "Choose two numeric signals", "No overlapping samples", "Set image width and height" and "This tool is not available in this version". Activating one shows its reason without changing the current view. A restored address requesting an unavailable view opens an explanation with a return to Trend; it never silently pretends that the requested analysis ran.

In an M1 build, Trend is functional; the other seven tabs explain that the tool is unavailable in that version. Product text does not expose milestone numbers. The mockup has a separate review-only M1 mode to demonstrate this behavior; that switch is not part of the product.

### Input suitability checks

Decision 2026-11-04: include this contract in the plans, and implement and verify the checks when each analysis tab or tool is developed. A complete validator for later tabs is not required to complete M1. Distribution, Spectrum, Compare and the advanced Trend tools own their checks in M3; Correlation, Dependency and fits, including histogram fits, own theirs in M4; Waveform and Image own theirs in M5.

PV selection reads available metadata to identify the data form and any missing information. Before running an analysis, check the actual selected interval or frame: supported type, usable sample count, missing or nonfinite values, timestamps, pairing coverage, units, array dimensions and the selected method's numerical prerequisites. Repeat applicable checks after a selection, range, frame, source or settings change, and invalidate the prior result.

Known incompatible input stops the affected calculation with a specific reason and a way to correct it. If required information is unknown, request it explicitly; never present unknown as supported or as proof that the signal is unsuitable. Physical purpose, axis meaning and statistical assumptions come from explicit metadata or user choices where available. A PV name, numeric type or unit alone does not prove that a signal is a temperature, an RF waveform, a camera image or a Poisson count process. Passing input checks or converging a fit does not establish a physical model or statistical distribution.

Checks are specific to the method: FFT needs a valid time axis and an explicit sampling/gap policy; correlations need usable aligned pairs and nonconstant inputs; fits need valid domains, sufficient independent observations and estimable parameters. Generic arrays may be plotted by element index without an inferred physical axis. Array spectra require their own sample interval, not the archive event rate; images require declared dimensions matching the selected frame and valid regions. Each tab's verification includes valid, incompatible and unknown cases through the shipped page and retrieval path.

## Analysis views

### Trend

Show selected scalar signals against the common time axis. Each unit has its own axis, with the same series identity, color, dash and marker used elsewhere. The legend toggles drawing visibility without removing the PV from the page selection. Removing a PV is an explicit operation in the common selection or Signals panel.

Keep the current chart controls: shape, Y scale, marks, running average, standard deviation band and their shared sample window. Each unit can have an automatic or fixed Y range. The Y projection is optional. The summary table remains available when the projection is hidden and names its data source and sample count.

M2 adds unit splitting, interval selection, min-max envelopes, cursors and the accepted gestures. M3 adds signal limits, time beyond limits and slow-trend analysis. The four existing time-axis labels and existing chart defaults remain the M1 behavior.

### Distribution

A signal selector chooses the active numeric PV from the common selection. The main view is a histogram; view choices expose the box plot, pattern by hour or weekday, and time-value heatmap from the existing design. Bin rule, bin count, normalization and optional value filter are local controls.

Below the plot, report sample count, minimum, maximum, mean, median, standard deviation and the other planned moments and quantiles. State whether statistics describe raw samples or aggregate samples. A sample-weighted histogram must not be labeled as time spent at a value. Time-weighted statistics require an explicit, separately specified rule before implementation.

The Fit section supports model selection, a value range, initial parameters, fixed parameters, and bounds. Overlay expected bin counts on the histogram and display observed-minus-fitted residuals below it. M4 evaluates the model at the bin centres against the bin counts, and the fit runs with Poisson weights (the residual of each bin divided by the square root of its count, empty bins left out) only after the user declares the counts as counts of independent samples; integrating the probability over the bin edges is a later candidate, and a Poisson model still requires integer count observations (Decision 2026-11-09 of M4). Name the objective, normalization, included bins, and termination status. Parameter results include standard errors, intervals, their method and assumptions, and explicit unavailable states for fixed or constrained cases. Histogram fitting follows the M4 fit scope; production uncertainty assumptions and numerical acceptance require their own specification.

### Correlation

Choose X and Y independently, retain each unit, and offer Swap. Show scatter by default, with profile and density as views. Pairing is a visible processing setting; the existing design proposes last-observed values at the union of sample times. Show the pair count, each input's original sample count, exclusions and the usable time overlap. A pairing result never conceals a period with unknown connection state.

The Fit section contains model, parameters, fixed or bounded values, fit range and Run fit. Show parameters and errors, goodness-of-fit measures valid for the selected method, and residuals below the plot. A failed or underdetermined fit has no successful curve or numeric success result. The gap rule: a value of the other signal is paired only when it is not older than five times the median spacing of that signal and no connection loss lies between it and the sample time; a sample without such a value is left out and counted. A fit of the scatter plot is unweighted and its errors are the covariance scaled by the reduced chi-square; a fit of a histogram is weighted, with the covariance as it is. A fit runs from its button, and one made for other pairs, in another unit, for another histogram or under a withdrawn declaration is cleared with a note (Decision 2026-11-09 of M4). The unit of X and of Y can each be shown in another prefix of the same base unit (mm in um): the values are multiplied by a power of ten, a unit that is not a prefix and a base unit offers no change, and the converted unit is written in the address and in the export (Decision 2026-11-10 of M4).

### Dependency

Choose a target signal and at least two other numeric signals. Display the matrix first, with the mutual information matrix, ranking, scatter matrix, partial correlation, multiple regression and PCA available as views. The signals are averaged over one common interval, that of the page or one chosen in the tab, and aligned on the intervals that every signal has. The scatter matrix shows the target and the five signals most associated with it; fewer than three signals, a signal without numeric means or without spread, fewer than ten common intervals and more than 100,000 intervals are refused with their reason; a condition number above 1,000 is written beside the result, and signals that move together are named when the partial correlation or the regression cannot be solved (Decision 2026-11-10 of M4). A selected matrix cell opens Correlation with the same time range and the corresponding X/Y signals.

Show the common interval, alignment policy, sample coverage and exclusion count with the result. Ranking expresses statistical association; wording must not imply causation. Large or poorly conditioned analyses must offer a smaller selection or different interval rather than an unexplained blank result.

### Spectrum

Choose the signal and show the data preparation immediately above the plot: raw input requirement, resampling interval, window, detrending and output type. Keep amplitude, power and power spectral density distinct in labels and units. Do not treat an irregular archived series as uniformly sampled without an explicit resampling step.

Show peak frequency and width, effective sample rate, usable duration, frequency resolution and exclusions. Autocorrelation and spectrogram are alternate views. Gaps or insufficient duration produce a specific explanation; a change of the inputs computes the spectrum again at once or clears it with the reason, so no stale result stays on the page. The supported resampling and gap policy, normalization and leakage checks are specified and verified under M3: the interval defaults to the median spacing of the samples, a spacing of more than five intervals is a gap that stops the spectrum unless the user chooses to interpolate across it, the mean is removed before the window, and the density, power and amplitude scalings agree with SciPy.

### Compare

Range A follows the common range; range B defaults to the preceding equal-duration range as a visible proposal, editable before Run comparison. The user can instead select two numeric signals. Keep the two inputs and their units explicit.

Place trends side by side with linked value scales when units match, and show normalized distributions below. Show counts, means, spreads and their differences. Statistical tests belong to the selected comparison method and display applicability failures instead of an unexplained p-value. On a narrow page A and B stack vertically while their labels remain visible. Comparing unlike units does not silently normalize them.

### Waveform

Choose an array PV and a timestamp inside the common range. Previous/next frame and a time slider select actual available timestamps. Use element index until a compatible companion axis is specified. The main views are a single profile, overlaid timestamps, time-element heatmap and difference from a selected reference.

Report array length, maximum and its index, minimum, mean, RMS, sum, center and FWHM where meaningful. A selected summary can be viewed over time. Spectral controls require the array's sampling frequency; the archive update rate is not the array sample rate. Peak and background controls belong to the existing M5 scope.

### Image

Choose an image PV, a frame time, dimensions and orientation. Render the image on canvas with axes and labels in SVG. Show the color scale, full-frame versus region selection, background choice and reference frame. Do not load the entire time range of images to show one frame.

The region is visible on the image and editable numerically, with X/Y projections beside or beneath it. Results identify whether centroid, peak, intensity and fitted widths describe the region or the full frame. Dimension changes, missing frames, invalid regions and failed fits are explicit states. A result trend requires a separate request over selected frames, with progress and cancel.

## Right-hand panel

| Panel | Contents | Persistence |
| --- | --- | --- |
| Signals | PV identity, type, units, drawing visibility, display name, role in the current analysis | Shared identity; local roles |
| Axes | Automatic or fixed ranges per unit, scale, labels; later soft limits and grid | Per view and unit |
| Options | Only controls relevant to the current view; inputs above the plot remain visible | Per view |
| Data | Effective source, metadata, returned samples, severity/status, exclusions; existing summary in M1 | Matches the active result |
| Export | Product, source, range, format and Copy link | Explicit export selection |

The panel title names the active view. Switching its subtab does not issue retrieval requests. Changing presentation options redraws existing data; changing data preparation makes an analysis stale until the user applies or runs it. M1 retains the existing viewer CSV; the full sample table and export choices arrive in M2.

Export always names the product: plotted samples, raw archived samples, optimized samples, interpolated samples, statistics, fit, derived signal, or image. Never imply that these products contain the same data. The existing design's server-streamed CSV/MAT route remains distinct from browser-produced tables. Share links include state, not the underlying archived data; later data corrections can change a reopened result.

## State and data flow

The page owns validated state. Chart components receive state and report changes through explicit interfaces; the page does not inspect their private DOM or range maps.

```text
Address / source-page link / user input
                  |
          Validate page state
                  |
      Signal metadata and capabilities
                  |
       Retrieval request generation
                  |
   Source-tagged samples and coverage
                  |
     View preparation / computation
                  |
     Plot + result table + Data panel
                  |
         Export / share address
```

Shared state includes ordered PVs, absolute start/end instants, zone, display profile and active view. Local state includes the selected signal or X/Y roles, model and parameters, comparison range B, selected frame and region. Drawing state includes visibility, per-unit ranges and chart options. Transient state includes open panels, focus, pending input and request progress; it is not a scientific result.

The existing M1 parameter names remain `pv`, `from`, `to`, `tz`, `profile`, `view`, `shape`, `yscale`, `marks`, `avg`, `band`, `window`, `yproj` and repeated `yrange`. The [M2 Address Contract](milestone-bfb0dc71.md#m2-address-contract) specifies M2 additions, defaults, validation and restoration, including independent selected/display queries and per-signal and per-unit settings. Its implementation follows the canonical plan. M3-M5 add their analysis-specific names in their own plans; mockup-local state is not the production URL schema. M3 added one deepObject parameter per tool, named as its view (`distribution[...]`, `trend[...]`, `compare[...]`, `spectrum[...]`), and M4 added `correlation[...]` and `dependency[...]` and the model of the histogram fit, `distribution[fit]`, read and written like the Export choices: a default is not written, an invalid field keeps its default, and range B of the comparison is a pair written only when the user set it (Decision 2026-11-09 of M3).

Decision 2026-11-04: new source-page links, including the menu, and copied links explicitly record both effective preferences, including `tz=browser` and `profile=default`; range changes retain them. Valid explicit values take precedence independently. For direct legacy links, missing `tz` uses Browser regardless of a stored zone, and missing `profile` uses the retrieval origin's valid stored profile or Default. Unreadable URL values are ignored and use the corresponding missing-value rule; unknown names remain tolerated. Invalid control input is rejected near its control. M1/T5 verifies the selected preference rule after implementation.

Each request generation belongs to one validated selection. Cancel obsolete requests where supported and discard late responses from older generations. Tabs may reuse cached data only when PVs, range, source, interval and processing identity match. A presentation-only change does not create a new scientific result. Partial failures remain associated with the affected PV; export states which signals it includes.

Keep archived event timestamps, raw versus aggregate origin, operator/interval, units, connection or alarm status and exclusions available through preparation. Graph resolution is not an analysis sampling specification. A constant trace, no data, a disconnected interval and an unsuccessful request are different states.

## Loading, errors and accessibility

| State | Visible behavior | Recovery |
| --- | --- | --- |
| No selection | Explain Plot and offer search | Select archived PVs |
| Loading | Show the requested range and progress; any previous result is labeled stale | Cancel or wait |
| No samples | Name the PV and requested range; no zero-valued replacement | Change range or selection |
| Partial data | Identify missing PVs/intervals and retain valid results with a qualification | Retry affected input or exclude it explicitly |
| Request failure | Show a useful error without reporting successful analysis | Retry the same request |
| Unsupported input | Explain required type, dimensions or sample count | Choose compatible input |
| Calculation failure | Show method and reason; keep input available for inspection | Change parameters or method |

Use semantic tablists, a selected tab and an associated tabpanel. Arrow keys move between tabs, Home/End reach the ends, and Enter/Space activate. Focus remains predictable when the panel closes or data refreshes. All controls have labels; availability explanations and errors are readable without hover. Announce request state through a live region, without announcing every plotted point.

Retain display profiles and non-color series distinctions. A table is available for numeric results. Touch targets are at least 44 px in the compact layout. Numerical and keyboard alternatives accompany range and region gestures.

## Phase boundary

| Phase | Deliverable in this design |
| --- | --- |
| M1 | Approve composition; site header/navigation; PV/range/profile/zone; working Trend using existing chart behavior; independent statistics; URL round trip; existing CSV; clear unavailable-tool presentation |
| M2 | Advanced chart interaction, source/interval controls, sample Data table, complete Export panel |
| M3 | Distribution, Spectrum, Compare and the planned single-signal Trend additions |
| M4 | Correlation, Dependency, fits and derived signals |
| M5 | Waveform and Image with their frame, region and numerical tools |

The mockup's full mode shows the eventual composition. Its M1 mode exposes only the foundation. A working demonstration control is not evidence that the product capability is implemented.

## Mockup contract

Open `work/analyzer-mockup/index.html` in a browser from this checkout. It loads the checkout's bundled D3 and site images with relative paths and uses no remote assets. Classic scripts also permit direct local-file opening.

The mockup builds its chart bundle from the production modules. Trend uses `drawTimeSeries`; histograms, scatter plots and other numeric plots use its independent `createPlotCanvas` surface. Each plot owns its X/Y display ranges and uses the same drag, keyboard, pan/zoom and reset controls. Display changes preserve the selected observations and fitted parameters; only explicit analysis-input changes invalidate a fit. `work/analyzer-mockup/canvas-demo.html` demonstrates independent time and numeric instances. This reuse does not make the prototype's analysis tools available in the deployed Analyzer.

The original Summary or Results keeps the selected-data values. A separate Visible range section recalculates graph-specific statistics from original points inside the displayed axes: signal statistics for Trend, raw values for histograms, pairs and Pearson r for Correlation, visible frequency bins and peaks for Spectrum, and independent ranges or profiles for Compare, Waveform and Image. Histogram Y frequency zoom does not select samples; its X value range does. Empty ranges show zero observations and unavailable estimates. Calculation details and plot instructions use the existing console information-card `(i)` control, while values, units, ranges and status remain visible.

Hover exposes values in every analysis view: histogram boundaries and sample count, paired X/Y values and acquisition time, matrix coefficients and pair counts, spectrum frequency and amplitude, comparison timestamps and values, captured waveform/profile coordinates and values, and image pixel coordinates and ADU. Completed fits add fitted values and residuals at the corresponding observations; residual plots expose their own observed/fitted values. Numeric views use the reusable canvas tooltip, and matrix/image views use its shared text renderer. Picking uses actual samples or computed bins, not interpolated measurements; missing and empty inputs have no sample tooltip. Axis drag, keyboard zoom and redraw retain the page's preceding scroll position and keyboard focus.

Distribution Options retains the bin-count presets (5, 12, 20, 40, 80) and adds a Custom count input with Apply for integers from 1 to 1000. Explicit minimum/maximum boundaries have separate Apply and Auto controls, with effective bin width and included/excluded sample counts. Bin settings are distinct from the display viewport and the fit range. Changing bin settings invalidates the old fit and resets Distribution zoom; copied links retain the settings, including custom counts. Visible range statistics use the intersection of the bin range and displayed X range, while Summary retains the source selection. The last bin includes the maximum; invalid counts or indistinguishable boundaries retain the previous result.

The review-only strip selects one of eight physical signal families: stored beam current, BPM position, magnet current, RF cavity envelope, vacuum pressure, temperature, photon counts, and camera images. It also selects full or M1 scope and ready/loading/no-data/error/partial states. It is visibly outside the proposed product UI. The question card describes the selected measurement and offers named intervals or captures. All observations are synthetic; source references and chosen model parameters are recorded in `work/analyzer-signal-examples/README.md`. Dataset identifiers are not installed facility PV names.

The mockup exercises tab selection, shared range application, per-view input selection, configuration panels, profile and zone display, show/hide settings, availability messages, selected frame, copying the mockup address, and exporting the active result. Histograms and summaries use finite selected observations; scatter plots and Pearson matrices use exact timestamp pairs. Distribution and Correlation calculate fits from these observations, with model selection, ranges, initial values, fixed parameters, bounds, termination status, curves, residuals, and JSON/CSV export. Changes to fitting inputs clear the prior result; fit settings and results remain local to the open page. Parameter standard errors and approximate 95% normal intervals use local residual-scaled covariance for least squares and expected Fisher information for the Poisson objective. Fixed, bound-limited, and non-estimable cases show their status and reason. JSON includes covariance and parameter order; parameter CSV includes errors, intervals, units, and assumptions. Curve confidence bands remain unavailable. Amplitude spectra use complete uniform samples, mean removal, a symmetric Hann window, and zero padding, with the input interval and resolution shown. Missing or irregular samples are not silently resampled. RF arrays use time within a pulse; camera profiles use position and histograms use intensity. Image pixels, irregular frame times, and statistics come from the saved camera example. Image fitting, PCA, significance tests, and region editing remain explicitly marked previews or unavailable.

The local bundle includes all example frames so the mockup opens without a server. This packaging does not change the production requirement to retrieve individual image frames. The mockup's interval convention is From-inclusive and To-exclusive; its exact-pair and numerical demonstration rules do not approve the unresolved production methods. Detailed offline behavior and data flow are recorded in `work/analyzer-mockup/README.md`.

The M1 composition, unavailable-tool presentation and panel placement are accepted on 2026-11-04. Numerical-method choices and the comparison default remain for the later phases; M1 acceptance does not settle them.
