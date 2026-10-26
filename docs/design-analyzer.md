# Analyzer design

Date: 2026-10-19
Status: draft 1, gathered from the register; four items are open (see Decisions)
Register: `docs/milestone-bfb0dc71.md` M1 (phase A: page, header and address), M2 (phase B: interaction, options and export), M3 (phase C: tools for one signal), M4 (phase D: tools for two and several signals), M5 (phase E: waveforms and images); the chart component is row M59 (previous document, commit bfb0dc71), complete; issue #39
Register decisions of `docs/milestone-bfb0dc71.md`: register D1 (console pages), register D2 (the analyzer as a self-contained analysis tool built with the bundled D3) and register D5 (the five phases); D1 to D6 under Decisions are the decisions of this note

## Scope

This document gathers the design of the analyzer: what it is, how it relates to the console, which page it is, how it draws, what its address carries, and which analysis tools it offers for each kind of signal. The register rows M1, M2, M3, M4 and M5 hold the plans, tests and evidence; this document holds the one picture they implement.

**Out of scope:** the chart component itself beyond what the analyzer needs of it (M59 (previous document, commit bfb0dc71), complete); the Browse PVs page (M58 (previous document, commit bfb0dc71), complete) except its control into the analyzer; the retrieval server and its data calls; the storage of data.

## Terms

- **Analyzer:** the page of the retrieval web application that draws and analyzes archived data (`ui/viewer/archViewer.html`, `viewer.js`, `viewer.css`). It replaces the data viewer.
- **Console:** the management interface, served by the management web application; its menu has the entries Archive PVs, Browse PVs, System, Help and Analyzer (register decision D1).
- **Chart component:** the shared drawing code under `staticcontent/js/aa/chart/`, served to both web applications as `ui/comm/js/aa/`; `createChart` builds a chart with its options, legend, projection, statistics and range strip; `drawTimeSeries` draws one chart.
- **Simple form:** the chart component as the console pages use it: one axis per unit, a legend, a tooltip, ranges chosen with the pointer, the Y projection with its statistics, the Chart options and an enlarged window (M59 (previous document, commit bfb0dc71)).
- **Signal:** one PV as a time series. Its kind is decided from its type information: a numeric scalar, a state or string, a waveform (an array), or an image (an array whose element count is width times height).
- **Tool:** one analysis the analyzer offers for a kind of signal (a summary, a distribution, a fit, a scatter plot, a spectrum).
- **Address:** the query string of the analyzer, which names the PVs, the time window, the zone and the options; a page that opens the analyzer builds it, and the analyzer writes it back as the page changes.

## Current structure

- The analyzer is the data viewer: a bar with the title, a PV input named Add, the range buttons and the From/To form, then one chart for each unit drawn through `drawTimeSeries` with `strip: false`, then Copy link and Download CSV. It reads `pv` (repeated), `from` and `to` from its address and writes them back. It carries no site header, logo or menu. Its content security policy allows connections to its own origin only.
- The menu entry Analyzer of the console is `analyzer.html`, which asks the management for the appliance information and forwards to the viewer at `dataRetrievalURL`, carrying the query string along (`js/analyzer-forward.js`).
- The Browse PVs page builds the address of the analyzer from the plotted PVs, the time window and, when the viewer chose one, the zone (`tz`); the options chosen on the page are not passed.
- The chart component has the options Line (step, straight, smooth, points), Y scale (linear, symmetric log, log, square root), Marks (auto, on, off), Window (10, 30, 60 samples), Running average and Standard deviation band, which share the one window (`options.js`); a time range chosen by a drag over the plot and a value range by a drag along an axis, the arrow and plus and minus keys on a focused axis, and a double-click back (`gestures.js`); a legend that hides and shows a line; the Y projection with a table of statistics; the range strip (`strip.js`); the time axis on `d3.scaleTime` with four labels, at the start, one third, two thirds and the end of the span, written in the chosen zone (`draw.js`). The wheel does nothing; a touch gesture scrolls the page vertically and selects horizontally.
- The Browse PVs page shows, under its chart, a Distribution panel, a scatter plot of two PVs and a Summary of the chart (`plots.js`, `browse.js`). The scatter plot takes a second PV of the same unit as the first, pairs only samples at exactly equal times, and draws the second PV's values on a linear Y scale in a chart of fixed height, with the X range alone written under it.
- The bundled D3 7.9.0 (`staticcontent/js/vendor/d3.min.js`) carries `d3-zoom`, `d3-brush`, `d3-drag`, `contourDensity`, `Delaunay`, `quadtree` and `d3-dsv`; the pages use none of these.
- The retrieval web application serves the BPL calls of its `BPLServlet` (metrics, PV details, searches, metadata) and none that answers the appliance information; the management serves `getApplianceInfo` with `mgmtURL` and `dataRetrievalURL`.
- The static check (`scripts/ui-static-checks.bash`) verifies the four marker blocks of the site header (`site_header`, `site_logo`, `site_navbar`, `site_footer`) on the console pages only.

## Reference tools

Read on 2026-10-19: the Phoebus Data Browser (EPICS), SLAC Trace (PyDM; the replacement of StripTool and the Java Archive Viewer), Grafana (Explore and the Time series panel), ROOT (the Fit Panel `TFitEditor`, the histogram painter `THistPainter`, the web browser `RBrowser` and JSROOT), Bokeh (the toolbar tools), Plotly (the mode bar) and the InfluxDB Data Explorer.

### Common structure

1. The selection (PVs or a query) and the time range at the top.
2. One main view in the middle with a switch between views (Grafana's visualization types; InfluxDB's Table and Graph; JSROOT's `layout` of simple, flex, tabs or grid); a comparison puts two views side by side with their time ranges linked (Grafana's split view).
3. A configuration panel beside or under the view, in tabs: the Phoebus Properties panel (Traces, Time axis, Value axes, Misc) and Trace's Configuration section (Traces, Y-Axes, Plot Config, Import/Export).
4. A results panel in tabs: Grafana's inspector (Data, Stats, Query, JSON), the Phoebus Statistics tab, and an Export panel of its own (Phoebus).
5. Tools opened from the view: Trace's Archive Search, Formula Maker and Data Insight; ROOT's Fit Panel from the context menu of a histogram.
6. The drag on the plot is modal: Bokeh and Plotly let one drag tool be active at a time (pan, box zoom, box select, lasso), chosen on a toolbar, while the wheel zoom and the hover inspectors stay on; reset, undo and redo are action buttons.

### Options the tools offer

- Drawing (Grafana Graph styles, InfluxDB Graph, ROOT 1-D options): style (lines, bars, points), interpolation (linear, smooth, step before, step after), line width, fill opacity and gradient, line style (solid, dash, dots), connect or disconnect across a gap (never, always, by a threshold), show points (auto, always, never), point size, stack (off, normal, 100 %), show values; ROOT's error bars (E, E1 to E6 as bars, rectangles or filled bands), smooth curve (C), bar (B), line (L), markers (P).
- Axes (Grafana Axis, InfluxDB Y axis): placement (auto, left, right, hidden), label, width, grid lines, scale (linear, log base 2 or 10, symlog with a linear threshold), centered zero, soft minimum and maximum (suggested limits that do not clip), time zone, unit prefix (none, SI, binary), prefix and suffix, domain (auto or a typed minimum and maximum), tick count and interval.
- Legend and tooltip (Grafana, InfluxDB): legend visibility, mode (list or table), placement (bottom or right), computed values in the legend (minimum, maximum, mean, last and others, several at once), a filter of series by name or label; tooltip mode (single, all, hidden), sort order of its values, hover proximity, hover dimension (X, Y, both).
- Thresholds and value display (Grafana): thresholds absolute or in percent drawn as lines or regions, value mappings (a value, range or pattern to a text and a colour), unit, minimum and maximum, decimals, display name, colour scheme, the text for no value.
- Transformations of the data (Grafana, 34 in all; those that apply here): a field from a calculation on other fields, a filter by values, group by and reduce (statistics per group), histogram, join by field (series aligned on time), smoothing, trendline (linear or polynomial), sort, limit, time format, type conversion.
- Fit panel (ROOT `TFitEditor`): a predefined function or a typed expression, an operation (none, add, convolution), parameter settings with initial values, fixed and bounded parameters, the method (chi-square, binned likelihood, linear, robust), options (integral, best errors by Minos, weights of 1, use range with sliders, improve, add to the list of fitted functions), draw options (same pad, no drawing), and the minimization settings (library, method, tolerance, iterations, print level).
- Histograms and two-dimensional displays (ROOT `THistPainter`): error bar styles, bar and curve forms, the statistics box (entries, mean, standard deviation, skewness, kurtosis with errors, integral, underflows, overflows) and the fit box (probability, chi-square per degree of freedom, parameters with errors); colour maps with a palette (COL, COLZ), contours (CONT), boxes (BOX), candle and violin plots, lego and surface views, log axes, superimposing with SAME, normalisation.
- Toolbar and gestures (Bokeh, Plotly): pan (x, y or both), box zoom, wheel zoom (x, y or both), box select, lasso select, tap select, crosshair, hover, zoom in and out, autoscale, reset, undo, redo, save as image; one drag tool active at a time, inspectors always on, the toolbar above, below, left or right, optionally hidden until the pointer enters the plot.
- Export (Phoebus Export panel, Grafana inspector, Bokeh, Plotly, ROOT): the time range (the plot's or another), the source (the samples shown, the raw archived samples, optimized data of N bins with minimum, maximum and mean, or a linear interpolation at a fixed interval), the format (one table per channel or one table in all, error columns for optimized data, severity and status, default, decimal or exponential digits, text or UNIX millisecond time stamps), the file (tab-separated text, CSV for Excel, Matlab `.mat` or `.m`), the same export from the command line; Grafana's CSV with transformations applied, joined by time across queries, panel and data JSON, the request copied; images as PNG or SVG; ROOT's objects saved as files or macros.

### What the analyzer takes from them

- The structure: the selection and the range at the top; tabs by kind of analysis in the middle with a comparison as a split view; a drawer with the tabs Signals, Axes, Options, Data and Export; the drag tool chosen on the range strip with the wheel and the hover always on. This structure is a proposal: the page composition and the assignment of the drag are open (Decisions).
- The options: line width and style, a gap threshold that disconnects the line, a fill between two signals, soft and fixed axis ranges, grid lines, centered zero, SI prefixes, an axis label, a legend in table mode with computed values, a tooltip in single or all mode with a sort order, thresholds as lines with the time beyond them, decimals and a display name per signal, a filter by value, a group by time interval with a reduce, undo and redo of the range, and the full export of the Export tab (below).

## Analysis scenarios

The questions an operator or a physicist brings to archived data, each with the tab that answers it (the proposed tabs, named in Page composition):

1. Did this signal drift overnight, and from when: the Trend with the running average and two cursors reading the time and the difference.
2. What changed with the beam current when it dropped: several signals around that time; the Dependency tab ranks the signals by how much each explains the chosen one; the top two go to the Correlation tab.
3. What is the frequency of this ripple: a short range read raw; the Spectrum tab gives the peak frequency; the Compare tab puts the spectrum before and after side by side.
4. Is the signal different after the maintenance or the setting change: the Compare tab with two time ranges of one signal, the distributions overlaid and normalised, the difference of the means and spreads, and the tests.
5. Does the position follow the temperature: the Correlation tab with the two signals paired by the value each holds at the other's sample times, and a linear fit whose slope is the change per degree.
6. How long was the signal outside its alarm limits last week, and when: the Trend with the limits as reference lines and the time beyond them; the Distribution tab's pattern by hour and weekday.
7. What did the BPM or camera profile look like at that moment: the Waveform tab with one array at a time, several times overlaid, and the time series of the peak position.
8. Did the beam spot move: the Image tab with the frame, a region of interest, and the time series of the centroid.

The register splits the scenarios over its phases. Scenario 1 needs the Trend tab (M1) and the two cursors (M2). Scenarios 3, 4 and 6 are the Spectrum, Compare and Distribution tabs and the Trend additions of M3; scenario 3 reads raw samples through the interval option of M2. Scenarios 2 and 5 are the Dependency and Correlation tabs of M4. Scenarios 7 and 8 are M5.

## Requirements

- R1. The analyzer is an independent service: an application of its own, served by the retrieval web application on its own address, that may be split out of the appliance later. It carries the site header, logo and menu of the console, whose items are links to the console pages; it is not shown inside a frame of a console page (Decision 2026-10-15, confirmed 2026-10-19).
- R2. The analyzer is a data analysis tool in the browser: an operator analyzes archived data in it without exporting to an external tool (register decision D2).
- R3. It is built with the bundled D3 and nothing else: every tool the bundle provides is used where it has one, a module of the official D3 repositories outside the bundle may be vendored with its version, source and licence recorded, and the page writes the computations the bundle lacks (correlation, regression, fits, FFT, tests) and checks them on signals of known parameters (register decision D2 and the decisions of M59 (previous document, commit bfb0dc71)).
- R4. It is a general signal analysis tool, not only a tool of accelerator operation; the wording names a signal, its unit and a time range (decision of M59 (previous document, commit bfb0dc71)).
- R5. The console pages that plot use the chart component in its simple form and open their PVs in the analyzer; the analyzer extends the same component with every drawing option and gesture (M59 (previous document, commit bfb0dc71), M1).
- R6. The address carries everything the analyzer shows, one named parameter per option, so that an address can be read, edited and shared by hand; an option not set is absent and the analyzer applies its default; a name it does not know or a value it cannot read is ignored, so an address with `pv`, `from` and `to` alone opens as before (register M1, decisions of 2026-10-14).
- R7. The tools are added by the kind of signal; the page decides the kind from the type information, and the user chooses the purpose within it (register M3, decision of 2026-10-14).
- R8. The Browse PVs page keeps its Distribution, scatter plot and Summary panels as additional information in their simple forms; the analyzer carries the full forms of these tools (Decision 2026-10-19, replacing the decision of 2026-10-15 that the panels leave the page).

## Proposed design

### Page and header

- The analyzer keeps its address under the retrieval web application. Its page carries the header of the console: the site header and logo, the same menu as the console pages (the five entries in the same order and look), and the time zone choice (`comm/js/aa/timezone.js`, `mountTimeZoneSelect`). A menu item pressed on the analyzer navigates to that console page at `mgmtURL`, and the Analyzer entry pressed on a console page navigates to the analyzer; the entry of the page in view is marked on both sides (Decision 2026-10-19).
- The analyzer reads `mgmtURL` from its own web application: the retrieval `BPLServlet` registers the management's `GetApplianceInfo` action under `/getApplianceInfo`, which answers from `configService.getMyApplianceInfo()`, so the content security policy stays at `connect-src 'self'` (Decision 2026-10-19).
- The menu entry `analyzer.html` of the console keeps forwarding with the query string. The console's control into the analyzer (Browse PVs, Archive PVs, the System charts) opens the analyzer in the same tab.
- The header markup carries the four marker blocks of the site header, and the static check verifies them on this page as on the console pages.
- The input for plotting a PV is named for what it does (for example Plot or Show), not Add, which reads as the start of archiving.

### Page composition

Open. The analyzer holds the trend with its options, the distribution and statistics, the tools of two signals (scatter, profile, fit), the tools of several signals (matrix, ranking, graph), the comparison of two ranges, and the waveform and image tools. How these are arranged on one page, whether as tabs by kind of analysis, by kind of signal (one numeric, two numeric, several, waveform, image), or as panels under one chart, is decided by the owner from a clickable mockup, before M1 is accepted.

The register proposes tabs by kind of analysis: Trend, Distribution, Correlation, Dependency, Spectrum, Compare, Waveform and Image, each enabled by the kind of the chosen signals, and a drawer with the tabs Signals, Axes, Options, Data and Export. The scenarios and the phases use these names.

 The composition decides where the range strip goes (one for the page or one per chart) and where the options sit.

### Drawing options and gestures

In addition to the simple form, the analyzer offers:

- Options beside the plot: sample marks on, off or automatic; line as step, straight, smooth or points; Y axis linear, symmetric log, log or square root, each unit automatic or fixed to a typed range; the averaging interval chosen in seconds, or raw samples forced; the running average and the standard deviation band with their one window in samples; a min-max band around the line when the data is averaged, read through the retrieval `min` and `max` post-processors with the mean; a split by unit that draws one plot per unit under another, sharing the time axis, the crosshair and the time range; the Y projection and the Distribution panel as options of their own.
- Gestures: a drag over the plot selects a time range and a drag along an axis a value range, as in the simple form; the wheel and the trackpad pinch zoom the time axis around the pointer (`d3-zoom`) within limits on the factor and the pannable range; Shift and a drag pans; a double-click returns to the original range and a step back returns to the previous one; on a touch screen one finger selects and two fingers pan and zoom; a click on a legend item hides its line, a click on a series brings it to the front, and a click on a sample pins its values; two reference cursors show the difference of time and value between them (`d3-drag`); the nearest sample to the pointer is found with `d3-delaunay` or `d3-quadtree` on plots with many points; a change of range reads the data again once after the gesture ends, because the averaging interval follows the span. The assignment of the drag is open: the owner decides it before the plan of M2 is accepted (Decisions).
- Transitions on zoom and range changes (`d3-transition`); CSV export through `d3-dsv` in place of the viewer's own code; values in SI prefixes with matched significant digits (`d3-format`).

### Address

The names: `pv` (repeated), `from`, `to`, `tz` (the zone, absent for the browser zone), `view` (the tab), `shape` (`step` by default, `line`, `smooth`, `points`), `yscale` (`linear` by default, `symlog`, `log`, `sqrt`), `marks` (`auto` by default, `on`, `off`), `avg` (`1` when the running average is on), `band` (`1` when the standard deviation band is on), `window` (the window in samples of both, 30 by default; a second name follows if the Open row on the window decides two), `yproj` (`1`), `yrange` (repeated, `unit:low:high`, `none` for a PV with no unit), `interval` (`raw` or the averaging interval in seconds, automatic when absent), `split` (`none` by default, `unit`). M2 adds the names of its options, and the tools of M3, M4 and M5 add their own names when they are designed. The control of the Browse PVs page adds the options chosen on the page to the address it opens.

### Tools by kind of signal (M3 and M4)

M3 builds the tools of one numeric scalar and the comparison of two time ranges. M4 builds the tools of two and of several numeric scalars, the fits and the derived signals.

- One numeric scalar: a summary (samples, minimum, maximum, mean, median, standard deviation, skewness, kurtosis, the errors of the mean and of the standard deviation, quantiles, lost events); the trend with zoom, two cursors and a min-max band; the distribution (histogram, box plot); the variation (running average, standard deviation band, rate of change); a slow trend (a linear fit against time); the limits of the PV as reference lines with the time outside them; the pattern by hour and weekday and a time-value heatmap for a long span; the periodicity (autocorrelation, spectrum by FFT after resampling to an even interval); the values beyond k standard deviations.
- Two numeric scalars: a scatter plot with each axis in its own unit, the samples paired by the value each PV holds at the other's sample times, with the number of pairs and of samples of the slower PV, the correlation (Pearson, Spearman, a cross-correlation over a lag), a profile, a fit of Y against X with its parameters and their errors, the chi-square per degree of freedom, R², a confidence band and the residuals, a density contour for dense data, derived signals (difference, sum, ratio), and the two trends under one another sharing the time axis. The analyzer opens with the first two plotted PVs as X and Y.
- A comparison of two time ranges of one signal, or of two signals: the distributions drawn over one another and normalised, and the tests of whether they differ (chi-square, Kolmogorov-Smirnov, Anderson-Darling) with the difference of the means and of the spreads.
- Several numeric scalars (three or more, up to 20): all signals averaged over one common interval; the mutual information of each pair and a ranking by how much each explains the chosen one; a correlation matrix as a heatmap ordered by clustering; a scatter plot matrix; the partial correlation; a multiple linear regression; a principal component analysis.
- General functions: a derived signal from a typed expression parsed by the page (the content security policy forbids `eval`); a threshold line with the time beyond it; a change of unit; the export of a fit, a statistics table and a derived signal; time scales from milliseconds to years in the ticks and the interval.
- The fit models are line, polynomial, exponential, power, logarithm, sine, Gaussian and Landau; a fit may fix or bound a parameter. The fits, correlations, regression, principal component analysis, clustering and FFT are computed by the page with small matrix routines written for it.
- The tools for state and string signals come after the numeric ones, when the site archives such signals.

### Analysis functions

The analyzer uses every applicable function of the bundled D3 7.9.0 (578 public names, read from `d3.min.js` on 2026-10-19) and writes the rest in its own modules under `staticcontent/js/aa/` (R3). The two lists below are the inventory.

Provided by the bundled D3:

- Descriptive statistics (`d3-array`): `min`, `max`, `extent`, `sum`, `fsum` and `fcumsum` (full precision), `cumsum`, `mean`, `median`, `mode`, `variance`, `deviation`, `quantile`, `quantileSorted`, `quantileIndex`, `medianIndex`, `minIndex`, `maxIndex`, `least`, `greatest`, `rank`, `count`, `Adder`.
- Histograms and binning: `bin` (and its alias `histogram`) with the threshold rules `thresholdSturges`, `thresholdScott` and `thresholdFreedmanDiaconis`, `ticks`, `tickStep`, `tickIncrement`, `nice`, `range`; `blur`, `blur2` and `blurImage` for smoothing a series, a two-dimensional histogram or an image.
- Grouping and joining: `group`, `groups`, `rollup`, `rollups`, `flatGroup`, `flatRollup`, `index`, `indexes`, `groupSort`, `cross`, `pairs`, `zip`, `transpose`, `merge`, `permute`, `shuffle`, `union`, `intersection`, `difference`, `subset`, `superset`, `disjoint`, `bisect` and `bisector` (a sample at or before a time), `quickselect`, `sort`, `ascending`, `descending`, `InternMap`, `InternSet`.
- Density and geometry: `contours` and `contourDensity` (iso-lines of a two-dimensional density), `Delaunay` and `Voronoi`, `quadtree`, `polygonHull`, `polygonArea`, `polygonCentroid`, `polygonContains`, `polygonLength`.
- Scales: `scaleLinear`, `scaleLog`, `scaleSymlog`, `scalePow`, `scaleSqrt`, `scaleTime`, `scaleUtc`, `scaleQuantile`, `scaleQuantize`, `scaleThreshold`, `scaleOrdinal`, `scaleBand`, `scalePoint`, `scaleRadial`, `scaleIdentity`, the `scaleSequential*` and `scaleDiverging*` families with the colour interpolators (`interpolateViridis`, `interpolateInferno`, `interpolateTurbo`, `interpolateRdBu`, the Brewer schemes and the `schemeCategory10`, `schemeTableau10`, `schemeObservable10` categorical schemes).
- Shapes: `line`, `area`, `curveLinear`, `curveStep`, `curveStepAfter`, `curveStepBefore`, `curveMonotoneX`, `curveMonotoneY`, `curveBasis`, `curveCardinal`, `curveCatmullRom`, `curveNatural`, `curveBumpX`, `stack` with its orders and offsets, `arc`, `pie`, `symbol` with the symbol types, `link`, `path`.
- Hierarchy and graphs (for the ordering of a correlation matrix and the graph of dependence): `hierarchy`, `cluster`, `tree`, `treemap`, `pack`, `partition`, `stratify`, `forceSimulation`, `forceLink`, `forceManyBody`, `forceCenter`, `forceCollide`, `forceX`, `forceY`, `forceRadial`, `chord`, `ribbon`.
- Interaction and animation: `zoom`, `zoomIdentity`, `zoomTransform`, `brush`, `brushX`, `brushY`, `brushSelection`, `drag`, `pointer`, `pointers`, `transition`, `interrupt`, the `ease*` functions, `timer`, `interval`.
- Time and format: the `time*` and `utc*` intervals from millisecond to year and the weekdays, `timeTicks`, `utcTicks`, `timeTickInterval`, `timeFormat`, `timeParse`, `utcFormat`, `utcParse`, `isoFormat`, `isoParse`; `format`, `formatPrefix`, `formatSpecifier`, `precisionFixed`, `precisionPrefix`, `precisionRound`, `tickFormat`, `formatLocale`.
- Files: `csvParse`, `csvFormat`, `csvFormatRows`, `tsvParse`, `tsvFormat`, `dsvFormat` (any delimiter), `autoType`, `csv`, `tsv`, `json`, `text`, `blob`, `image`.
- Random variates for test signals of known parameters: `randomNormal`, `randomLogNormal`, `randomUniform`, `randomInt`, `randomExponential`, `randomPareto`, `randomBernoulli`, `randomGeometric`, `randomBinomial`, `randomGamma`, `randomBeta`, `randomWeibull`, `randomCauchy`, `randomLogistic`, `randomPoisson`, `randomBates`, `randomIrwinHall`, `randomLcg` (a seeded generator).
- Interpolation: `interpolate`, `interpolateNumber`, `interpolateNumberArray`, `interpolateBasis`, `interpolateDate`, `interpolateRound`, `piecewise`, `quantize`.

Written by the page, because the bundle has none of them (register decision D2; `d3-regression` is a third-party module outside the official D3 repositories and is not used):

- Moments and shape: skewness, kurtosis, the standard errors of the mean and of the standard deviation, trimmed statistics, a kernel density estimate.
- Moving statistics: the running average, the exponential average, the moving standard deviation band, the rate of change, the min-max band of averaged data from the retrieval `min` and `max` operators.
- Correlation: Pearson and Spearman (through `rank`), partial correlation, the cross-correlation over a time lag, autocorrelation, mutual information (through `bin`), the correlation and covariance matrices.
- Regression and fits: least squares for the line, polynomial, exponential, power and logarithm models (linear in a transformed variable), an iterative least squares (Levenberg-Marquardt) for the sine, Gaussian and Landau shapes and for a typed model, with fixed and bounded parameters, a weighted fit, the parameter errors from the covariance, the chi-square per degree of freedom, R², a confidence band and the residuals; a multiple linear regression; a profile (the mean of Y with its error in each bin of X, through `bin` and `rollup`); a trend line against time.
- Spectra: the FFT (radix 2 with zero padding, or Bluestein for any length) after resampling the irregular samples to an even interval by linear interpolation, with the window functions (rectangular, Hann, Hamming, Blackman), the power spectral density, the peak frequency with its width, the spectrogram over time, the autocorrelation through the FFT; for a waveform, the sampling frequency typed or read from a companion PV.
- Tests: chi-square on binned data, Kolmogorov-Smirnov and Anderson-Darling on two samples, the difference of means with its error.
- Linear algebra: a small matrix module (multiply, invert, solve, Cholesky, the Jacobi eigen decomposition) for the regression, the covariance and the principal component analysis; hierarchical clustering of the correlation matrix (through `hierarchy` and `cluster` for the drawing).
- Signals: a derived signal from a typed expression parsed by the page (`eval` is forbidden by the content security policy), a change of unit, a threshold with the time beyond it, resampling to a common interval, the pairing of two signals by the value each holds at the other's sample times (through `bisector`), outliers beyond k standard deviations, a peak search with a background estimate, the summary values of an array (maximum and its position, minimum, mean, RMS, sum, centre, FWHM), the centroid, projections and Gaussian size of an image.
- Still open (register M4, settled before its plan is accepted): LOESS and a non-linear fit library vendored later; a typed formula as a user-defined fit function.

Every written routine is checked on signals of known parameters made with the `random*` generators and on closed forms (R3).

### Waveforms and images (M5)

- One waveform: the array at a time with X as the element number or from a companion axis PV; several times overlaid; the time against the element number as a heatmap; summary values of each array (maximum and its position, minimum, mean, RMS, sum, centre, FWHM) and their time series; the difference from a reference time; the spectrum by FFT with the sampling frequency given by the user or a companion PV, a window function and the peak frequency; a peak search with a background estimated and subtracted. The length and the rate come from the type information.
- An image: one frame as a heatmap on a canvas with a colour scale and iso-lines, the axes and text staying SVG; a rectangle of interest chosen with the mouse; the X and Y projections; the centroid, the peak position, the total intensity and the size by a Gaussian fit in each direction, and those values as time series; a background subtraction and the difference of two frames. The width and height come from the companion PVs of the array plugin (`ArraySize0_RBV`, `ArraySize1_RBV`) or are typed by the user. A whole frame is read one at a time.
- The analysis is built for the arrays of the site's camera IOC first: profiles of 1920 and 1200 elements, time-series arrays of 2048 points, a histogram of 256 bins and the statistics of up to four regions of interest.

### Export

The Export tab of the drawer, after the Phoebus Export panel and the Grafana inspector:

- Range: the window shown, or a typed range.
- Source: the samples shown; the raw archived samples; optimized data of N bins with the minimum, mean and maximum of each; a linear interpolation at a fixed interval.
- Format: CSV with one column per signal aligned on time (a sample at or before each time), or one long table (time, signal, value); severity and status included or not; the digits (as stored, fixed decimals, exponential); time as ISO 8601 in the chosen zone or as UNIX milliseconds; the unit in the header.
- Products: the data as CSV; the statistics table of the view as CSV; a fit result (model, parameters with errors, chi-square per degree of freedom, R²) as CSV or JSON; a derived signal as CSV; the plot as PNG or SVG; the address of the page with every option, copied to the clipboard.
- Large ranges: the page hands the retrieval's own `getData.csv` and `getData.mat` addresses with the operator and the range, so the server streams the file and the browser holds no copy; the Matlab file comes from the retrieval as it is. The retrieval's CSV holds one PV and has no header line; its columns are `secs,value,severity,status,nanos`. The aligned columns, the ISO 8601 time and the unit in the header of Format belong to the page's own CSV.

### Data access

The analyzer reads data from its own web application: `data/getData.json` with an operator (`meanSample_N`, `min_N`, `max_N`, raw) chosen from the span and the `interval` option; the type information of a PV from `bpl/getMetadata` or the management; the appliance information from the retrieval's `getApplianceInfo`. A range change issues one batch of requests, one per drawn PV, after the gesture ends.

## Interfaces that change

- The retrieval `BPLServlet` gains `/getApplianceInfo` (the management's action class).
- The analyzer page gains the header markup with its marker blocks and the time zone choice; `analyzer-forward.js` is unchanged.
- The Browse PVs control into the analyzer adds the options of the page to the address.
- The chart component gains the options and gestures of the analyzer that the simple form lacks (zoom, pan, pins, cursors, fixed ranges, interval, min-max band, split by unit); the simple form of the console pages is unchanged.
- `scripts/ui-static-checks.bash` verifies the marker blocks on the analyzer page.

## Configuration

None. The analyzer reads the addresses of the web applications from the appliance information.

## Deployment

The analyzer stays in the retrieval WAR and is served at `/retrieval/ui/viewer/`; the console pages link to it through `dataRetrievalURL`, and it links back through `mgmtURL`. No proxy, frame or shared cookie is needed; the two origins share only the address.

## Register

M1 (phase A) implements Page and header, Page composition and Address; M2 (phase B) implements Drawing options and gestures, Export and the address names of the options it adds; M3 (phase C) implements the tools of one signal and the comparison of two ranges in Tools by kind of signal; M4 (phase D) implements the tools of two and several signals, the fits and the derived signals; M5 (phase E) implements Waveforms and images. Data access serves the Trend tab of M1 and the interval and the one batch of requests after a gesture of M2. Each row keeps its own Test Plan; the checks of the page composition belong to M1.

## Testing

Every check runs on a local appliance with the shipped soft IOC fixture (`src/resources/test/ConsoleChartPVs.db`) and real pointer and touch actions in the browser; the computations of M3 and M5 are checked on signals of known parameters. The static check and `MgmtPageLinksTest` cover the page, the entry and the forward; the default suite and the two workflows gate each row.

## Decisions

D1 to D6 are the decisions of this note. register D1, D2 and D5 are decisions of the register. The four Open rows are undecided; the owner decides each, as the row states.

| ID | Decision | Date |
| --- | --- | --- |
| D1 | The analyzer is an independent service with the header of the console; not in a frame | 2026-10-15, confirmed 2026-10-19 |
| D2 | The analyzer reads `mgmtURL` from the retrieval's own `getApplianceInfo` | 2026-10-19 |
| D3 | The defaults of the options are those of the chart component (step, linear, marks auto, average and band off, window 30), interval automatic, split none | 2026-10-19 |
| D4 | The Distribution, scatter plot and Summary panels stay on the Browse PVs page as additional information; the analyzer carries the full forms (replaces the decision of 2026-10-15) | 2026-10-19 |
| D5 | The time axis carries the four labels, at fixed fractions of the span in the chosen zone, that the component draws; no further work | 2026-10-19 |
| D6 | The analyzer carries the same menu as the console pages; an entry pressed on either side navigates to the page on the other side | 2026-10-19 |
| Open | The page composition (tabs or panels, by kind of analysis or by kind of signal), from a mockup; the owner decides before M1 is accepted | |
| Open | The assignment of the drag on the plot: select (as in the simple form) with Shift to pan, or pan with Shift to select, or a mode control on the range strip; the reference tools (Bokeh, Plotly) use the mode control with one drag tool active at a time and the wheel and hover always on; the owner decides before the plan of M2 is accepted | |
| Open | Whether a line carries a label at its end besides its entry in the legend, which names every line in the simple form (register M58 (previous document, commit bfb0dc71), decision of 2026-10-14); the owner decides before the plan of M2 is accepted | |
| Open | The window of the running average and the band: one shared window (`window`, as the component and the address have it) or two; the owner decides before the plan of M2 is accepted | |
