# Reusable chart canvas

`createPlotCanvas` in `staticcontent/js/aa/chart/canvas.js` provides the shared SVG surface for the Browse PVs chart, Analyzer Trend and the offline analyzer's numeric plots. It is exported through `aa/chart.js`. The surface depends on the bundled D3, `chart/gestures.js` and `chart/hover.js`; it has no PV lookup, HTTP request, storage, profile, tab or application-state dependency.

## Ownership and data flow

The caller supplies dimensions, a continuous X scale, a map of Y scales and their ordered axis IDs. The surface draws axes and grid lines, creates a unique clipping region and returns a D3 selection for data marks. Time series, histogram bars, scatter points and fit curves are data layers supplied by callers. The surface does not compute statistics or change the selected observations.

Each caller owns its domains and range map. `bindInteractions(host, input, redraw)` connects pointer and keyboard input to that instance. X selection calls `input.onZoom(low, high)` in the scale's native type: Date for a time scale, number for a numeric scale. Y selection changes the supplied `input.ranges` Map and calls `redraw()`. Redraw rebuilds the surface and layers from those ranges. Double-click clears the range map and calls `input.onReset()`; callers restore their original X domain there.

No document listeners, window listeners or resize observers are installed by the surface. Replacing the old SVG releases its event handlers with the detached nodes; `destroy()` removes the SVG and any bound hover tooltip explicitly. A caller replacing a whole chart host also replaces its tooltip. A caller that owns a ResizeObserver must disconnect it when destroying its enclosing component. Two instances share no domain or range state. Callers must use separate scales and maps for independent charts.

## Interface

| Input | Contract |
|---|---|
| `width`, `height`, `margin` | SVG coordinate dimensions; margin has `left`, `right`, `top`, `bottom` |
| `x` | D3 continuous scale with an ascending domain and range from the left to right plot edge |
| `scales`, `units` | Map of axis ID to D3 continuous Y scale; ordered axis IDs; Y range runs bottom to top |
| `axisWidth`, `onLeft` | Width of each Y axis column and number of axes on the left; remaining axes use the right |
| `tickCount`, `xTicks`, `xFormat` | Optional tick count, explicit X ticks and formatter; numeric formatting is the default |
| `unitLabels`, `axisLabels`, `axisLabelAnchor`, `xLabel`, `xTickY` | Optional axis labels and X tick baseline; `axisLabels` maps IDs to labels; `axisLabelAnchor` overrides unit-label alignment |
| `label`, `displayWidth` | Accessible chart description and optional rendered SVG width |

The returned object contains `svg`, `marks`, `x`, `scales`, `units`, `width`, `height`, `margin`, `axisAt(index)`, `bindInteractions`, `bindHover` and `destroy`. Append data layers to `marks` to keep them inside the clipped drawing area. Mount `svg.node()` in an element with class `chart` and load the common `css/chart.css`. The enclosing page supplies its theme variables.

`bindInteractions` requires `ranges` and `redraw`. Supply `onZoom` to enable X selection and `onReset` to restore the caller's X domain. Y keyboard controls are always available: arrows move the range, plus/minus change its span, and Home restores the automatic range. Optional `keyboardX: true` enables left/right, plus/minus and Home on the X axis. Optional `wheel: true` enables Ctrl+wheel zoom around the pointer, while ordinary wheel scrolling is unchanged. `buildCanvasControls(x, onZoom, onReset)` returns optional pan, zoom and reset buttons for a caller to place outside the SVG.

`drawTimeSeries` composes this surface with archived sample rendering, legends, profiles and statistics. It retains its existing host/state interface, returns the canvas when data is visible, and accepts `overlay(canvas)` for additional clipped marks. Existing Browse PVs and Analyzer consumers therefore use the same surface without managing generic layers themselves.

## Hover and redraw position

`bindHover(host, pick)` installs an optional tooltip and sample marker. The caller's `pick({px, py, x, event})` receives SVG coordinates and the native X value and returns `{title, rows, px, py}` or null. `title` and `rows` are plain text; optional `px`/`py` locate the selected sample marker. The caller owns hit testing, source values, units and missing-data policy. The surface suppresses hover outside the plot, during dragging and for touch input, and hides it on leave, wheel or Escape. The tooltip stays within the host's visible horizontal extent and the browser viewport. Rebinding removes the previous tooltip and listeners.

`createHoverTip(host)` exposes the same text renderer for matrix cells and image pixels. The host must establish a CSS positioning context. `show({clientX, clientY}, {title, rows})`, `hide()` and `destroy()` manage this tooltip; its caller owns pointer and focus listeners.

`preserveViewport(draw)` protects synchronous redraws from temporary page-height shrinkage and restores the preceding scroll position after the final layout. It installs no listeners. `drawTimeSeries` uses it internally, and the mockup uses it around page and view redraws. Axis keyboard focus is restored with `preventScroll`. If the final page is shorter than the previous scroll position permits, the browser's normal scroll limits still apply.

## Offline consumers

`work/analyzer-mockup/build-chart.cjs` compiles the actual production modules with webpack for direct `file://` use and records SHA-256 hashes in `shared-chart-sources.json`. Rebuild after changing a chart module. `shared-plots.js` adapts the canvas to the mockup; `canvas-demo.html` and `canvas-demo.js` demonstrate two independent instances with saved synthetic temperature observations and no Analyzer page state.

The mockup stores displayed domains separately from the selected data interval. Zoom, pan and reset affect only the display; bins, fit input, covariance and exported observations remain unchanged. The copied URL preserves display ranges, while changing the data selection clears them. Fit parameters and fitted results remain local to the open page.

The page's `range-summary.js` derives additional Visible range statistics from the returned scales and original observations. It leaves the selected-data Summary unchanged. These calculations and the information-card explanations belong to the page; the reusable surface does not interpret signal types or calculate statistics.
