# Reusable chart canvas

`createPlotCanvas` in `staticcontent/js/aa/chart/canvas.js` provides the shared SVG surface of the Browse PVs chart, the Analyzer Trend and the offline mockup's numeric plots. `aa/chart.js` exports it with `buildCanvasControls`, `drawTimeSeries`, `createChart`, `createHoverTip`, `preserveViewport`, `axisRoom`, `labelRoom` and `CHART_OPTIONS`. The surface depends on the bundled D3 and on `chart/gestures.js`, `chart/references.js` and `chart/hover.js`; it has no PV lookup, HTTP request, storage, profile, tab or application-state dependency.

## Ownership and data flow

The caller supplies dimensions, a continuous X scale, a map of Y scales and their ordered axis IDs. The surface draws axes, grid lines and axis labels, creates a unique clipping region and returns a D3 selection for data marks. Time series, histogram bars, scatter points and fit curves are data layers supplied by callers. The surface does not compute statistics or change the selected observations.

Each caller owns its domains and range map. `bindInteractions(host, input, redraw, preview)` connects pointer, wheel, touch and keyboard input to that instance. A completed change of the X domain calls `input.onZoom(low, high)` in the scale's native type: Date for a time scale, number for a numeric scale; while a navigation gesture runs, the optional `input.onNavigate(low, high)` receives the domain so that the caller can redraw the data at hand. A Y change writes the supplied `input.ranges` Map and calls `redraw()`; `preview()`, optional, rebuilds the drawing without reporting, for the frames of a running gesture. Redraw rebuilds the surface and layers from those ranges. A double-click clears the range map and calls `input.onReset()`; callers restore their original X domain there.

The surface installs no document listeners, window listeners or resize observers of its own; `d3.zoom` holds window listeners only while a gesture runs. Replacing the old SVG releases its event handlers with the detached nodes; `destroy()` removes the SVG and any bound hover tooltip explicitly. A caller replacing a whole chart host also replaces its tooltip. A caller that owns a ResizeObserver must disconnect it when destroying its enclosing component. Two instances share no domain or range state. Callers must use separate scales and maps for independent charts.

## Gestures

`chart/gestures.js` owns the input of a drawing. The caller owns the active tool, the ranges, the candidate selection and the redraw; the module reports completed gestures only.

- **One navigation behavior per host.** The `d3.zoom` behavior is installed once on the host element and shared by the drawings that replace one another in it, so a gesture that started on one drawing continues over the drawings that redraw under it. The gesture maps its relative transform through the scales of the drawing current when it began; a redraw in the middle of it changes nothing it depends on. The value ranges chosen by a drag along an axis are kept per host (`RANGES`, a WeakMap) across redraws.
- **The drag tool.** Without `input.tool` a drag over the plot chooses the time window, the simple form of the console. With a tool (`TOOLS`: `select`, `pan`, `box`) a drag over the plot is the candidate selection of Select, reported through `input.onSelect(range or null)` without changing an axis; the pan of Pan, through `d3.zoom`; or the box of Box zoom, whose rectangle commits the X domain, the Y range of the targeted unit, or both. A drag shorter than 6 pixels is a click and chooses nothing. A Shift+click inside the plot is reported through `input.onPoint({px, py, x})` for the caller to pick a sample.
- **The axes navigation moves.** `input.nav` (`NAVIGATION_TARGETS`: `x`, `y`, `xy`) with `input.navUnit` names the axes Pan, Box zoom and the wheel move; a value-axis target whose unit the drawing does not have falls back to the time axis.
- **Wheel and touch.** `input.wheel: true` enables Ctrl+wheel zoom around the pointer; a wheel without Ctrl never zooms, so page scrolling stays available. Two fingers pinch and pan; a second finger takes a pending brush over to navigation without committing it. A navigation gesture on a time axis keeps the window between one second and ten years; a range typed on the page is not bound by this.
- **Axis drag and keyboard.** A drag along an axis column chooses the value range of that unit. The focusable area of each value axis accepts the arrow keys (move by a quarter of the span), `+` and `-` (halve and double the span) and Home (clear the range); `input.keyboardX: true` adds the same keys and Home on the X axis. Focus is restored on the same axis after the redraw.
- **Reset.** A double-click clears every value range and calls `input.onReset()`; the D3 double-click zoom is disabled.

## References

`chart/references.js` draws the marks a caller places on a drawing and owns none of their meaning. `input.pins` (`[{x, y, unit, text}]`, in the native values of the scales) are drawn inside the clipped marks. `input.cursors` (`[value or null, value or null]`) are two lines across the plot, each with a handle at the top that drags along the X axis (`d3.drag`) or moves with the arrow keys by one percent of the plot width, ten percent with Shift, and with Home and End; `input.onCursorChange(index, value)` receives the X value a cursor was left at. A cursor outside the X domain stays in the caller's state and is not drawn; the axes never widen for it.

## Interface

| Input | Contract |
|---|---|
| `width`, `height`, `margin` | SVG coordinate dimensions; margin has `left`, `right`, `top`, `bottom` |
| `x` | D3 continuous scale with an ascending domain and range from the left to right plot edge |
| `scales`, `units` | Map of axis ID to D3 continuous Y scale; ordered axis IDs; Y range runs bottom to top |
| `axisWidth`, `onLeft` | Width of each Y axis column and number of axes on the left; remaining axes use the right |
| `tickCount`, `xTicks`, `xFormat` | Optional tick count, explicit X ticks and formatter; numeric formatting is the default |
| `tickFormats` | Optional Map of axis ID to the formatter of its tick labels |
| `grid` | The lines behind the data: `y` (the default) at the ticks of the first axis, `x` at the X ticks, `both` or `off` |
| `unitLabels`, `axisLabels`, `axisLabelAnchor`, `xLabel`, `xTickY`, `xTickLabels` | Optional axis labels and X tick baseline; `axisLabels` maps IDs to labels; `axisLabelAnchor` overrides unit-label alignment; `xTickLabels: false` draws the X ticks without labels, for a plot stacked above the one that carries them |
| `label`, `displayWidth` | Accessible chart description and optional rendered SVG width |

The returned object contains `svg`, `marks`, `x`, `scales`, `units`, `width`, `height`, `margin`, `xFormat`, `axisAt(index)`, `bindInteractions`, `bindHover` and `destroy`. Append data layers to `marks` to keep them inside the clipped drawing area. Mount `svg.node()` in an element with class `chart` and load the common `css/chart.css`. The enclosing page supplies its theme variables.

`bindInteractions` requires `ranges` and `redraw`. Supply `onZoom` to enable X navigation and `onReset` to restore the caller's X domain; the other inputs of the gestures and references above (`onNavigate`, `tool`, `nav`, `navUnit`, `wheel`, `keyboardX`, `selection`, `onSelect`, `onPoint`, `cursors`, `onCursorChange`, `pins`) are optional. `buildCanvasControls(x, onZoom, onReset)` returns optional pan, zoom and reset buttons for a caller to place outside the SVG.

## Time series and the chart widget

`drawTimeSeries` composes this surface with archived sample rendering, legends, profiles, references and statistics. It retains its host/state interface, returns the canvas (the first panel's when split by unit) when data is visible, and accepts `overlay(canvas)` for additional clipped marks, which it calls once for the canvas of each panel (a caller that draws for one unit checks that the canvas has the scale of the unit). Beyond the simple form of the console, it takes the navigation inputs of the canvas (`tool`, `nav`, `navUnit`, `selection`, `onSelect`, `onNavigate`, `keyboardX`, `wheel`), `hover: false`, `pins` with `onPin(observation)` for the sample nearest to a Shift+click, `cursors` with `onCursorChange(index, time)` whose readings it tables under the chart (the last observation at or before the cursor, unavailable across a gap), `minmax` bands per series, `display` (`split`, `legend`, `legendstat`, `tooltip`, `tipsort`, `grid`, `endlabels`; see `DISPLAY_DEFAULTS`), `signals` (a Map of series name to `width`, `dash`, `gap`, `fill`, `decimals`, `name`) and `axes` (a Map of unit to `scale`, `symlog`, `softmin`, `softmax`, `zero`, `prefix`, `label`). A chart without `display` keeps the simple form.

`createChart` in `chart/widget.js` wraps the drawing with its controls and keeps the state between draws: the options, the projection, the ranges by unit, the hidden lines, the tool, the wheel and hover toggles, the navigation target, the cursors, the pins, the display settings and the per-signal and per-unit settings. `getState()` returns a copy, `setState(patch)` validates, redraws and reports through `onStateChange(state)`, and `initialState` seeds it. With `tools: true` the widget adds the toolbar of the Analyzer (the drag tool, Ctrl+wheel zoom, Hover, Navigate, Undo, Redo, Reset, the two cursors with Pin at cursor, and the pinned samples); `onApply(from, to)` receives the candidate selection when Apply selection is pressed. Every completed navigation or axis change records the window, the ranges and the axis settings; Undo and Redo restore them, and Reset drops the ranges and returns to the selected range through `onReset`. The history, the pins and the selection belong to one dataset: a draw whose data carries a new `datasetKey` starts them anew. `message(text, data)` shows a text in place of the chart and, with the window data, keeps the history and Reset available on a window without samples. `controlsHost`, `statisticsHost`, `rangeHost` and `toolbarHost` place the controls, the statistics, the time strip and the toolbar in the page.

`chart/state.js` reads and writes the chart part of the Analyzer address as `docs/analyzer-address.openapi.json` declares it; the viewer owns the PVs, the ranges, the retrieval and the export choices.

## Hover and redraw position

`bindHover(host, pick)` installs an optional tooltip and sample marker. The caller's `pick({px, py, x, event})` receives SVG coordinates and the native X value and returns `{title, rows, px, py}` or null. `title` and `rows` are plain text; optional `px`/`py` locate the selected sample marker. The caller owns hit testing, source values, units and missing-data policy. The surface suppresses hover outside the plot, during dragging and for touch input, and hides it on leave, wheel or Escape. The tooltip stays within the host's visible horizontal extent and the browser viewport. Rebinding removes the previous tooltip and listeners. `bindPlotHover(surface, host, pick)` in `chart/hover.js` is the same binding for a caller that holds the surface.

`createHoverTip(host)` exposes the same text renderer for matrix cells and image pixels. The host must establish a CSS positioning context. `show({clientX, clientY}, {title, rows})`, `hide()` and `destroy()` manage this tooltip; its caller owns pointer and focus listeners.

`preserveViewport(draw)` protects synchronous redraws from temporary page-height shrinkage and restores the preceding scroll position after the final layout. It installs no listeners. `drawTimeSeries` uses it internally, and the mockup uses it around page and view redraws. Axis keyboard focus is restored with `preventScroll`. If the final page is shorter than the previous scroll position permits, the browser's normal scroll limits still apply.

## Offline consumers

`work/analyzer-mockup/build-chart.cjs` compiles the actual production modules with webpack for direct `file://` use and records SHA-256 hashes in `shared-chart-sources.json`. Rebuild after changing a chart module. `shared-plots.js` adapts the canvas to the mockup; `canvas-demo.html` and `canvas-demo.js` demonstrate two independent instances, a time axis and a numeric axis, with saved synthetic temperature observations and no Analyzer page state; `verify-canvas.cjs` exercises them in a browser and checks the bundle against the source hashes.

The mockup stores displayed domains separately from the selected data interval. Zoom, pan and reset affect only the display; bins, fit input, covariance and exported observations remain unchanged. The copied URL preserves display ranges, while changing the data selection clears them. Fit parameters and fitted results remain local to the open page.

The page's `range-summary.js` derives additional Visible range statistics from the returned scales and original observations. It leaves the selected-data Summary unchanged. These calculations and the information-card explanations belong to the page; the reusable surface does not interpret signal types or calculate statistics.
