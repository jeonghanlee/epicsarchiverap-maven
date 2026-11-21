var SharedChart;
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   buildCanvasControls: () => (/* binding */ buildCanvasControls),
/* harmony export */   createPlotCanvas: () => (/* binding */ createPlotCanvas)
/* harmony export */ });
/* harmony import */ var _gestures_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2);
/* harmony import */ var _hover_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3);
/* harmony import */ var _references_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4);
// Reusable SVG plot surface. Callers supply scales and data layers; the surface owns axes, clipping and input geometry.




const d3 = globalThis.d3;
const CLIP_PAD = 3;
// The width one character of an axis label needs, at the font of the axes, to judge whether a label fits before its axis.
const LABEL_CHAR = 8.6;
let nextClip = 0;

/**
 * Builds a detached surface with no PV, retrieval, application-state or storage dependency.
 * x is a D3 continuous scale; scales is a Map of axis IDs to value scales. Units gives their order.
 * The caller owns domains, ranges, dimensions and redraw. Marks belong in the returned clipped marks group.
 * xTicks/xFormat support numeric or time axes without interpreting numbers as timestamps. grid (off, x, y or
 * both) names the lines behind the data, tickFormats maps an axis ID to the formatter of its tick labels, and
 * xTickLabels false draws the X ticks without their labels, for a plot stacked above the one that carries them.
 * bindInteractions(host, input, redraw, preview) uses the same gestures as the time-series widget. Input contains
 * ranges (Map), onZoom(low, high), onReset(), optional keyboardX/wheel booleans and the navigation and reference
 * inputs of gestures.js and references.js (tool, nav, navUnit, selection, onSelect, onNavigate, onPoint, cursors,
 * onCursorChange, pins). Redraw must rebuild the drawing from the updated ranges and report the change; preview,
 * optional, rebuilds it without reporting, for the frames of a running gesture. The surface installs no document,
 * window or observer listeners of its own; d3.zoom holds window listeners only while a gesture runs.
 */
function createPlotCanvas(config) {
    const { width, height, margin, x, scales, units, axisWidth, onLeft, tickCount = 5 } = config;
    const onRight = units.length - onLeft;
    const plotTop = margin.top;
    const svg = d3.create("svg").attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", config.displayWidth || "100%").attr("height", height)
        .attr("role", "img").attr("aria-label", config.label || "Chart")
        .attr("data-chart-canvas", "shared");
    const axisAt = (index) => {
        const rightSide = index >= onLeft;
        const step = rightSide ? index - onLeft : index;
        return { rightSide, x: rightSide ? width - margin.right + axisWidth * step : margin.left - axisWidth * step };
    };
    // grid names the lines behind the data: y (the default) across the plot at the ticks of the first axis, x down
    // the plot at the X ticks, both, or off. tickFormats maps an axis ID to the formatter of its tick labels.
    const grid = ["off", "x", "y", "both"].includes(config.grid) ? config.grid : "y";
    const tickFormats = config.tickFormats || new Map();
    units.forEach((unit, index) => {
        const scale = scales.get(unit);
        const { rightSide, x: axisX } = axisAt(index);
        const tickFormat = tickFormats.get(unit) || d3.format(".4~g");
        for (const tick of scale.ticks(tickCount)) {
            if (index === 0 && (grid === "y" || grid === "both")) {
                svg.append("line").attr("class", "grid").attr("x1", margin.left).attr("x2", width - margin.right)
                    .attr("y1", scale(tick)).attr("y2", scale(tick));
            }
            svg.append("text").attr("class", "axis").attr("x", rightSide ? axisX + 6 : axisX - 6)
                .attr("y", scale(tick) + 4).attr("text-anchor", rightSide ? "start" : "end")
                .text(tickFormat(tick));
        }
        if (config.unitLabels) {
            svg.append("line").attr("class", "axis-line").attr("x1", axisX).attr("x2", axisX)
                .attr("y1", plotTop).attr("y2", height - margin.bottom);
            // A label of a left axis ends at its axis line unless it would run off the drawing; it then starts at the
            // left edge of its column instead, so that a long label stays readable.
            const labelText = config.axisLabels?.get(unit) || unit || "no unit";
            const fits = rightSide || axisX - labelText.length * LABEL_CHAR >= 0;
            svg.append("text").attr("class", "axis unit").attr("x", fits ? axisX : Math.max(2, axisX - axisWidth)).attr("y", plotTop - 14)
                .attr("text-anchor", config.axisLabelAnchor || (rightSide || !fits ? "start" : "end"))
                .text(labelText);
        }
    });
    const ticks = config.xTicks || x.ticks(5);
    const format = config.xFormat || d3.format(".4~g");
    ticks.forEach((value, index) => {
        if (grid === "x" || grid === "both") {
            svg.append("line").attr("class", "grid").attr("x1", x(value)).attr("x2", x(value))
                .attr("y1", plotTop).attr("y2", height - margin.bottom);
        }
        if (config.xTickLabels === false) return;
        svg.append("text").attr("class", "axis").attr("x", x(value))
            .attr("y", config.xTickY ?? height - 8)
            .attr("text-anchor", index === 0 ? "start" : index === ticks.length - 1 ? "end" : "middle")
            .text(format(value));
    });
    if (config.xLabel) {
        svg.append("text").attr("class", "axis").attr("x", (margin.left + width - margin.right) / 2)
            .attr("y", height - 7).attr("text-anchor", "middle").text(config.xLabel);
    }
    const clipId = `aa-chart-clip-${++nextClip}`;
    svg.append("clipPath").attr("id", clipId).append("rect")
        .attr("x", margin.left - CLIP_PAD).attr("y", plotTop - CLIP_PAD)
        .attr("width", width - margin.right - margin.left + 2 * CLIP_PAD)
        .attr("height", height - margin.bottom - plotTop + 2 * CLIP_PAD);
    const marks = svg.append("g").attr("class", "plot-marks").attr("clip-path", `url(#${clipId})`);

    function bindInteractions(host, input, redraw, preview) {
        (0,_gestures_js__WEBPACK_IMPORTED_MODULE_0__.attachGestures)({ svg, host, input, redraw, preview, x, scales, units, ranges: input.ranges,
            width, height, margin, plotTop, axisWidth, onLeft, onRight, axisAt });
        (0,_references_js__WEBPACK_IMPORTED_MODULE_2__.drawReferences)(surface, host, input);
        if (typeof input.onZoom !== "function") return;
        const choose = (low, high) => {
            if (Number.isFinite(+low) && Number.isFinite(+high) && +low < +high) input.onZoom(low, high);
        };
        if (input.keyboardX) {
            svg.append("rect").attr("class", "axis-key axis-key-x").attr("tabindex", 0).attr("role", "group")
                .attr("aria-label", "X range: left and right move, plus and minus zoom, Home resets")
                .attr("pointer-events", "none").attr("x", margin.left).attr("y", height - margin.bottom)
                .attr("width", width - margin.left - margin.right).attr("height", margin.bottom)
                .on("keydown", (event) => {
                    const [left, right] = x.range();
                    const span = right - left, middle = (left + right) / 2;
                    const pairs = { ArrowLeft: [left - span / 4, right - span / 4], ArrowRight: [left + span / 4, right + span / 4],
                        "+": [middle - span / 4, middle + span / 4], "=": [middle - span / 4, middle + span / 4],
                        "-": [middle - span, middle + span] };
                    if (!pairs[event.key] && event.key !== "Home") return;
                    event.preventDefault();
                    if (event.key === "Home") input.onReset?.();
                    else choose(...pairs[event.key].map(x.invert));
                    host.querySelector(".axis-key-x")?.focus({ preventScroll: true });
                });
        }
    }

    let hover;
    const surface = { svg, marks, x, scales, units, width, height, margin, axisAt, bindInteractions, xFormat: format,
        bindHover(host, pick) { hover?.destroy(); hover = (0,_hover_js__WEBPACK_IMPORTED_MODULE_1__.bindPlotHover)(surface, host, pick); return hover; },
        destroy() { hover?.destroy(); svg.remove(); } };
    return surface;
}

/** Optional navigation controls. Domain values stay in the scale's native numeric or Date form. */
function buildCanvasControls(x, onZoom, onReset) {
    const controls = document.createElement("div");
    controls.className = "canvas-controls";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "Plot navigation");
    const [left, right] = x.range(), span = right - left, middle = (left + right) / 2;
    const actions = [
        ["Pan left", () => onZoom(x.invert(left - span / 4), x.invert(right - span / 4))],
        ["Zoom in", () => onZoom(x.invert(middle - span / 4), x.invert(middle + span / 4))],
        ["Zoom out", () => onZoom(x.invert(middle - span), x.invert(middle + span))],
        ["Pan right", () => onZoom(x.invert(left + span / 4), x.invert(right + span / 4))],
        ["Reset axes", onReset],
    ];
    for (const [label, action] of actions) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", action);
        controls.append(button);
    }
    return controls;
}


/***/ }),
/* 2 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   NAVIGATION_TARGETS: () => (/* binding */ NAVIGATION_TARGETS),
/* harmony export */   RANGES: () => (/* binding */ RANGES),
/* harmony export */   TOOLS: () => (/* binding */ TOOLS),
/* harmony export */   attachGestures: () => (/* binding */ attachGestures)
/* harmony export */ });
// The pointer, wheel, touch and keyboard gestures of a chart. Navigation (pan, Ctrl+wheel, pinch) runs through d3.zoom,
// a drag over the plot (the time window, a box zoom or a candidate selection) through d3.brush, a drag or the keys along
// an axis choose the value range of that axis, and a double-click returns to the automatic ranges. The caller owns the
// active tool, the ranges, the candidate selection and the redraw; this module reports completed gestures only.

const d3 = globalThis.d3;

// The value ranges a viewer chose by a drag along an axis, by unit, kept per chart host across redraws.
const RANGES = new WeakMap();

// The navigation behavior of each chart host, installed once and shared by the drawings that replace one another in it:
// a gesture that starts on one drawing continues over the drawings that redraw under it.
const NAVIGATION = new WeakMap();

// The tools a drag over the plot can serve. A caller without a tool keeps the simple form of the console: a drag chooses
// the time window.
const TOOLS = ["select", "pan", "box"];

// The axes navigation can move: x alone, one value axis, or both.
const NAVIGATION_TARGETS = ["x", "y", "xy"];

// A drag shorter than this many pixels is a click and chooses nothing.
const DRAG_LEAST = 6;

/** The relative transform of a zoom gesture: the transform now, expressed against the transform when the gesture began. */
function relativeTransform(now, start) {
    const k = now.k / start.k;
    return d3.zoomIdentity.translate(now.x - k * start.x, now.y - k * start.y).scale(k);
}

/** Whether the point of an event lies inside the plot of the drawing the context describes. */
function insidePlot(context, event) {
    const [px, py] = d3.pointer(event, context.svg);
    const { plot } = context;
    return px >= plot.left && px <= plot.right && py >= plot.top && py <= plot.bottom;
}

/**
 * The navigation behavior of a chart host. d3.zoom reads its pointer positions against the host, which persists across
 * redraws, while the scales belong to the drawing current when the gesture began: a gesture maps its relative transform
 * through those scales, so a redraw in the middle of it changes nothing it depends on. Each drawing refreshes the context
 * the filter reads (tool, wheel, targets, plot area).
 */
// The window a navigation gesture on the time axis can reach: at least one second, the least retrieval interval, and at
// most ten years. A range typed on the page is not bound by this.
const SPAN_LEAST_MS = 1000;
const SPAN_MOST_MS = 10 * 365.25 * 24 * 3600 * 1000;

function navigationOf(host) {
    let entry = NAVIGATION.get(host);
    if (entry) {
        return entry;
    }
    // touchNodes holds the drawings that touch gestures began on: the browser delivers the rest of each gesture to
    // the element it began on, so a drawing a redraw replaced stays in the host, hidden, until its gesture ends.
    entry = { context: null, gesture: null, brushing: false, touchNavigated: false, brushCut: false, frame: 0, touchNodes: new Set() };
    const filter = (event) => {
        const context = entry.context;
        if (!context) {
            return false;
        }
        if (event.type === "wheel") {
            return context.wheel && event.ctrlKey && insidePlot(context, event);
        }
        if (event.type === "mousedown") {
            return event.button === 0 && context.tool === "pan" && insidePlot(context, event);
        }
        if (event.type === "touchstart") {
            const touches = event.touches;
            return touches.length > 0 && (touches.length >= 2 || context.tool === "pan") && insidePlot(context, touches[0]);
        }
        return false;
    };
    // The scales of the gesture in the pixels of the host: the drawing is an SVG with a viewBox, drawn at a scale f inside
    // the host, with the offset of its box in the host.
    const hostScales = (context) => {
        const box = context.svg.getBoundingClientRect();
        const hostBox = host.getBoundingClientRect();
        const f = box.width / context.width;
        const ox = box.left - hostBox.left + host.scrollLeft;
        const oy = box.top - hostBox.top + host.scrollTop + (box.height - context.height * f) / 2;
        const x = context.x.copy().range(context.x.range().map((v) => ox + v * f));
        const yScale = context.navY ? context.scales.get(context.navUnit) : null;
        const y = yScale ? yScale.copy().range(yScale.range().map((v) => oy + v * f)) : null;
        return { x, y };
    };
    const keepTouchNodes = () => {
        for (const node of entry.touchNodes) {
            if (!node.isConnected) {
                node.style.display = "none";
                node.setAttribute("aria-hidden", "true");
                host.append(node);
            }
        }
    };
    const releaseTouchNodes = () => {
        for (const node of entry.touchNodes) {
            node.remove();
        }
        entry.touchNodes.clear();
    };
    // Any redraw of the host, from a gesture frame or from the page, keeps the drawings the touch gestures began on.
    entry.keep = keepTouchNodes;
    entry.release = releaseTouchNodes;
    const domainsOf = (gesture, transform) => {
        const relative = relativeTransform(transform, gesture.start);
        const result = {};
        if (gesture.context.navX) {
            result.x = relative.rescaleX(gesture.x).domain();
        }
        if (gesture.y) {
            const [a, b] = relative.rescaleY(gesture.y).domain();
            result.y = [Math.min(a, b), Math.max(a, b)];
        }
        return result;
    };
    const behavior = d3.zoom()
        .filter(filter)
        .on("start", (event) => {
            const context = entry.context;
            const scales = hostScales(context);
            // A mouse gesture is followed by d3.zoom on the window; a touch gesture stays with its drawing (see touchNodes).
            if (event.sourceEvent && event.sourceEvent.type === "touchstart") {
                entry.touchNodes.add(context.svg);
            }
            entry.gesture = { context, start: event.transform, x: scales.x, y: scales.y };
            // The scale extent of this gesture keeps the window between SPAN_LEAST_MS and SPAN_MOST_MS; d3 applies it
            // before it anchors the zoom, so the point under the pointer stays in place at the limit.
            const span = context.navX && scales.x ? +scales.x.domain()[1] - +scales.x.domain()[0] : 0;
            behavior.scaleExtent(span > 0 ? [(event.transform.k * span) / SPAN_MOST_MS, (event.transform.k * span) / SPAN_LEAST_MS] : [0, Infinity]);
            // A second finger while a brush is pending takes the gesture over; that brush commits nothing when it ends.
            if (entry.brushing && event.sourceEvent && event.sourceEvent.type === "touchstart") {
                entry.touchNavigated = true;
            }
        })
        .on("zoom", (event) => {
            const gesture = entry.gesture;
            if (!gesture || !event.sourceEvent) {
                return;
            }
            // The drawing follows the pointer once per frame, with the data it already has; nothing is retrieved.
            gesture.pending = domainsOf(gesture, event.transform);
            if (!entry.frame) {
                entry.frame = window.requestAnimationFrame(() => {
                    entry.frame = 0;
                    const live = entry.gesture;
                    if (!live || !live.pending) {
                        return;
                    }
                    const context = entry.context;
                    const domains = live.pending;
                    live.pending = null;
                    if (domains.y) {
                        context.ranges.set(live.context.navUnit, domains.y);
                    }
                    if (domains.x && typeof context.input.onNavigate === "function") {
                        context.input.onNavigate(domains.x[0], domains.x[1]);
                    } else if (domains.y) {
                        context.preview();
                    }
                    keepTouchNodes();
                });
            }
        })
        .on("end", (event) => {
            const gesture = entry.gesture;
            entry.gesture = null;
            if (entry.frame) {
                window.cancelAnimationFrame(entry.frame);
                entry.frame = 0;
            }
            if (!gesture || !event.sourceEvent) {
                return;
            }
            const context = entry.context;
            const domains = domainsOf(gesture, event.transform);
            const [from, to] = gesture.x.domain();
            const movedX = domains.x && Number.isFinite(+domains.x[0]) && Number.isFinite(+domains.x[1])
                && +domains.x[0] < +domains.x[1] && (+domains.x[0] !== +from || +domains.x[1] !== +to);
            if (domains.y) {
                context.ranges.set(gesture.context.navUnit, domains.y);
            }
            const cut = entry.brushCut === true;
            entry.brushCut = false;
            releaseTouchNodes();
            if (movedX) {
                context.input.onZoom(domains.x[0], domains.x[1]);
            } else if (domains.y) {
                context.redraw();
            } else if (cut) {
                // The fingers did not move the view; the drawing is rebuilt so that its brush is whole again.
                context.preview();
            }
        });
    // The browser reports two fingers as two touchstarts, and the brush of the Select and Box zoom tools takes the first
    // one and stops the events that follow. When the second finger lands inside the plot, the brush is taken out of the
    // drawing and both fingers are handed to the navigation behavior, so that a pinch navigates whatever the tool.
    const secondFinger = (event) => {
        const context = entry.context;
        if (!context || !context.brushLayer || entry.gesture || !event.touches || event.touches.length < 2
            || !insidePlot(context, event.touches[0])) {
            return;
        }
        const listener = d3.select(host).on("touchstart.zoom");
        if (typeof listener !== "function") {
            return;
        }
        // Every brush in the host loses its listeners: the one of the current drawing and those of the drawings kept
        // for the first finger, which would otherwise swallow that finger's remaining events.
        d3.select(host).selectAll(".brush-layer").on(".brush", null);
        context.brushLayer.call(context.brush.move, null);
        entry.brushing = false;
        entry.touchNavigated = false;
        entry.brushCut = true;
        const touches = Array.from(event.touches);
        listener.call(host, { type: "touchstart", touches, changedTouches: touches, ctrlKey: false, button: 0,
            view: event.view, target: event.target, timeStamp: event.timeStamp,
            stopImmediatePropagation() {}, preventDefault() {} });
        event.stopImmediatePropagation();
    };
    d3.select(host).on("touchstart.fingers", secondFinger).call(behavior).on("dblclick.zoom", null);
    entry.behavior = behavior;
    NAVIGATION.set(host, entry);
    return entry;
}

/**
 * Connects the gestures of one drawing. input is the caller's: onZoom(low, high) receives a completed change of the X
 * domain; onNavigate(low, high), optional, receives the domain while a navigation gesture is still running, to redraw the
 * data at hand; onReset() answers a double-click; tool is one of TOOLS (without it a drag over the plot chooses the time
 * window, as the console does); nav and navUnit name the axes navigation moves; wheel enables Ctrl+wheel zoom;
 * selection is the candidate range of the Select tool and onSelect(range or null) reports its change; onPoint({px, py, x})
 * reports a Shift+click inside the plot. redraw rebuilds the drawing and reports the change; preview rebuilds it silently.
 */
function attachGestures({ svg, host, input, redraw, preview, x, scales, units, ranges, width, height, margin, plotTop, axisWidth, onLeft, onRight, axisAt }) {
    const plotBottom = height - margin.bottom;
    const plotLeft = margin.left;
    const plotRight = width - margin.right;
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
    const pointAt = (event) => d3.pointer(event, svg.node());
    const timed = typeof input.onZoom === "function";
    const tool = !timed ? null : TOOLS.includes(input.tool) ? input.tool : "window";
    const nav = NAVIGATION_TARGETS.includes(input.nav) ? input.nav : "x";
    const navUnit = nav !== "x" && units.includes(input.navUnit) ? input.navUnit : null;
    // A value-axis target without a known unit falls back to the time axis.
    const navY = navUnit !== null;
    const navX = nav !== "y" || !navY;
    const silent = typeof preview === "function" ? preview : redraw;
    const navigation = navigationOf(host);
    navigation.context = {
        svg: svg.node(), x, scales, ranges, input, redraw, preview: silent, width, height,
        tool, wheel: input.wheel === true && timed, navX: navX && timed, navY, navUnit,
        plot: { left: plotLeft, right: plotRight, top: plotTop, bottom: plotBottom },
        brushLayer: null, brush: null,
    };
    // A drawing kept for a touch gesture that is over by now is dropped; one of a running gesture stays.
    if (navigation.gesture || navigation.brushing) {
        navigation.keep();
    } else {
        navigation.release();
    }
    // The index of the unit whose axis column holds the point, or -1.
    const axisIndexAt = (px, py) => {
        if (py < plotTop || py > plotBottom) {
            return -1;
        }
        if (px < margin.left) {
            const step = Math.floor((margin.left - px) / axisWidth);
            return step < onLeft ? step : -1;
        }
        if (px > width - margin.right) {
            const step = Math.floor((px - (width - margin.right)) / axisWidth);
            return step < onRight ? onLeft + step : -1;
        }
        return -1;
    };
    svg.style("touch-action", "pan-y");

    // A drag over the plot: the candidate selection of the Select tool, the box of Box zoom, or the time window of the
    // simple form. Pan leaves the plot to the navigation behavior. Shift is kept for a click that picks a sample.
    if (tool !== null && tool !== "pan") {
        const box = tool === "box";
        const maker = box && navX && navY ? d3.brush : box && navY ? d3.brushY : d3.brushX;
        const brush = maker()
            .extent([[plotLeft, plotTop], [plotRight, plotBottom]])
            // A touchstart with a second finger is left to the navigation behavior of the host, which sees it only when
            // the brush does not take it.
            .filter((event) => !event.ctrlKey && !event.button && !event.shiftKey && !(event.touches && event.touches.length > 1))
            .on("start", (event) => {
                if (event.sourceEvent) {
                    navigation.brushing = true;
                    if (event.sourceEvent.type === "touchstart") {
                        navigation.touchNodes.add(svg.node());
                    }
                }
            })
            .on("end", (event) => {
                // A move by the program (restoring the selection, clearing it) has no source event and reports nothing.
                if (!event.sourceEvent) {
                    return;
                }
                navigation.brushing = false;
                if (!navigation.gesture) {
                    navigation.release();
                }
                const selection = event.selection;
                if (navigation.touchNavigated) {
                    // A second finger took the gesture over to navigation; the pending brush commits nothing.
                    navigation.touchNavigated = false;
                    layer.call(brush.move, null);
                    return;
                }
                if (tool === "select") {
                    const wide = selection && selection[1] - selection[0] >= DRAG_LEAST;
                    if (!wide && selection) {
                        layer.call(brush.move, null);
                    }
                    if (typeof input.onSelect === "function") {
                        input.onSelect(wide ? [x.invert(selection[0]), x.invert(selection[1])] : null);
                    }
                    return;
                }
                if (!selection) {
                    return;
                }
                layer.call(brush.move, null);
                const xs = box && navX && navY ? [selection[0][0], selection[1][0]] : navX ? selection : null;
                const ys = box && navX && navY ? [selection[0][1], selection[1][1]] : box && navY ? selection : null;
                let changedY = false;
                if (ys && Math.abs(ys[1] - ys[0]) >= DRAG_LEAST) {
                    const scale = scales.get(navUnit);
                    const [a, b] = [scale.invert(ys[0]), scale.invert(ys[1])];
                    ranges.set(navUnit, [Math.min(a, b), Math.max(a, b)]);
                    changedY = true;
                }
                if (xs && xs[1] - xs[0] >= DRAG_LEAST + 2) {
                    input.onZoom(x.invert(xs[0]), x.invert(xs[1]));
                } else if (changedY) {
                    redraw();
                }
            });
        const layer = svg.append("g").attr("class", `brush-layer tool-${tool}`).call(brush);
        navigation.context.brushLayer = layer;
        navigation.context.brush = brush;
        if (tool === "select" && Array.isArray(input.selection) && input.selection.length === 2) {
            const [a, b] = input.selection.map((value) => x(value));
            if (Number.isFinite(a) && Number.isFinite(b) && b > a && b > plotLeft && a < plotRight) {
                layer.call(brush.move, [clamp(a, plotLeft, plotRight), clamp(b, plotLeft, plotRight)]);
            }
        }
    }
    if (tool === "pan") {
        svg.style("cursor", "grab");
    }
    svg.on("click.point", (event) => {
        if (!event.shiftKey || typeof input.onPoint !== "function") {
            return;
        }
        const [px, py] = pointAt(event);
        if (px >= plotLeft && px <= plotRight && py >= plotTop && py <= plotBottom) {
            input.onPoint({ px, py, x: x.invert(px) });
        }
    });

    // A drag along an axis chooses the value range of that axis and redraws at once; a short drag chooses nothing.
    const band = svg.append("rect").attr("class", "brush").attr("visibility", "hidden");
    let drag = null;
    svg.on("pointermove.cursor", (event) => {
        const [px, py] = pointAt(event);
        if (axisIndexAt(px, py) >= 0) {
            svg.style("cursor", "ns-resize");
        } else if (tool === "pan") {
            svg.style("cursor", "grab");
        } else {
            svg.style("cursor", null);
        }
    });
    svg.on("pointerdown", (event) => {
        if (event.button !== 0) {
            return;
        }
        const [px, py] = pointAt(event);
        const index = axisIndexAt(px, py);
        if (index < 0) {
            return;
        }
        drag = { start: clamp(py, plotTop, plotBottom), index };
        try {
            svg.node().setPointerCapture(event.pointerId);
        } catch (error) {
            // A synthetic pointer has nothing to capture; the drag still works.
        }
    });
    svg.on("pointermove.brush", (event) => {
        if (drag === null) {
            return;
        }
        const [, py] = pointAt(event);
        const { rightSide, x: axisX } = axisAt(drag.index);
        const now = clamp(py, plotTop, plotBottom);
        band.attr("visibility", "visible").attr("x", rightSide ? axisX : axisX - axisWidth).attr("width", axisWidth)
            .attr("y", Math.min(drag.start, now)).attr("height", Math.abs(now - drag.start));
    });
    svg.on("pointerup", (event) => {
        if (drag === null) {
            return;
        }
        const chosen = drag;
        drag = null;
        band.attr("visibility", "hidden");
        const [, py] = pointAt(event);
        const now = clamp(py, plotTop, plotBottom);
        if (Math.abs(now - chosen.start) >= DRAG_LEAST) {
            const scale = scales.get(units[chosen.index]);
            const [a, b] = [scale.invert(chosen.start), scale.invert(now)];
            ranges.set(units[chosen.index], [Math.min(a, b), Math.max(a, b)]);
            redraw();
        }
    });
    svg.on("pointercancel", () => {
        drag = null;
        band.attr("visibility", "hidden");
    });
    // The same choice from the keyboard: an axis takes the focus; arrows move its range, plus and minus narrow and widen
    // it and Home clears it.
    const rangeByKey = (unit, key) => {
        const [first, second] = ranges.get(unit) || scales.get(unit).domain();
        const low = Math.min(first, second);
        const high = Math.max(first, second);
        const span = high - low;
        const mid = (low + high) / 2;
        const moves = {
            ArrowUp: [low + span / 4, high + span / 4],
            ArrowDown: [low - span / 4, high - span / 4],
            "+": [mid - span / 4, mid + span / 4],
            "=": [mid - span / 4, mid + span / 4],
            "-": [mid - span, mid + span],
        };
        return moves[key] || null;
    };
    units.forEach((unit, index) => {
        const { rightSide, x: axisX } = axisAt(index);
        svg.append("rect")
            .attr("class", "axis-key")
            .attr("tabindex", 0)
            .attr("role", "group")
            .attr("aria-label", `Value range of ${unit || "no unit"}: arrow keys move it, plus and minus narrow and widen it, Home clears it`)
            .attr("data-unit", unit)
            .attr("pointer-events", "none")
            .attr("x", rightSide ? axisX : axisX - axisWidth)
            .attr("y", plotTop)
            .attr("width", axisWidth)
            .attr("height", plotBottom - plotTop)
            .on("keydown", (event) => {
                let changed = false;
                if (event.key === "Home") {
                    changed = ranges.delete(unit);
                } else {
                    const next = rangeByKey(unit, event.key);
                    if (next && next.every(Number.isFinite)) {
                        ranges.set(unit, next);
                        changed = true;
                    }
                }
                if (!changed && !["ArrowUp", "ArrowDown", "+", "=", "-", "Home"].includes(event.key)) {
                    return;
                }
                event.preventDefault();
                if (changed) {
                    redraw();
                    for (const element of host.querySelectorAll(".axis-key")) {
                        if (element.dataset.unit === unit) {
                            element.focus({ preventScroll: true });
                        }
                    }
                }
            });
    });
    svg.on("dblclick", () => {
        const had = ranges.size > 0;
        ranges.clear();
        if (had) {
            redraw();
        }
        if (typeof input.onReset === "function") {
            input.onReset();
        }
    });
}


/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   bindPlotHover: () => (/* binding */ bindPlotHover),
/* harmony export */   createHoverTip: () => (/* binding */ createHoverTip)
/* harmony export */ });
// Shared value tooltip and pointer geometry; callers supply the actual observations and their labels.
const d3 = globalThis.d3;
const TIP_GAP = 12;
const TIP_WIDTH = 300;

/** A text-only tooltip inside a positioned host. show accepts client coordinates and {title, rows}. */
function createHoverTip(host) {
    const element = document.createElement("div");
    element.className = "tip canvas-tip";
    element.setAttribute("role", "tooltip");
    element.hidden = true;
    host.append(element);
    const hide = () => { element.hidden = true; };
    return {
        element, hide,
        show(point, value) {
            if (!value) { hide(); return; }
            const heading = document.createElement("b");
            heading.textContent = value.title;
            element.replaceChildren(heading);
            for (const text of value.rows || []) {
                const row = document.createElement("div");
                row.textContent = text;
                element.append(row);
            }
            const box = host.getBoundingClientRect();
            const leftEdge = Math.max(0, box.left), rightEdge = Math.min(window.innerWidth, box.right);
            element.style.maxWidth = `${Math.max(0, Math.min(TIP_WIDTH, rightEdge - leftEdge))}px`;
            element.hidden = false;
            const size = element.getBoundingClientRect();
            const left = Math.max(leftEdge, Math.min(point.clientX + TIP_GAP, rightEdge - size.width));
            const preferredTop = point.clientY + TIP_GAP + size.height <= window.innerHeight
                ? point.clientY + TIP_GAP : point.clientY - size.height - TIP_GAP;
            const top = Math.max(0, Math.min(preferredTop, window.innerHeight - size.height));
            element.style.left = `${left - box.left + host.scrollLeft - host.clientLeft}px`;
            element.style.top = `${top - box.top + host.scrollTop - host.clientTop}px`;
        },
        destroy() { element.remove(); },
    };
}

/** pick receives plot coordinates and returns a tooltip with optional x/y marker coordinates, or null. */
function bindPlotHover(surface, host, pick) {
    const { svg, width, height, margin, x } = surface;
    const tip = createHoverTip(host);
    const overlay = svg.append("g").attr("class", "canvas-hover").attr("pointer-events", "none");
    const cross = overlay.append("line").attr("class", "cross").attr("visibility", "hidden")
        .attr("y1", margin.top).attr("y2", height - margin.bottom);
    const dot = overlay.append("circle").attr("class", "hover-point").attr("r", 4).attr("visibility", "hidden");
    const insideX = px => Number.isFinite(px) && px >= margin.left && px <= width - margin.right;
    const insideY = py => Number.isFinite(py) && py >= margin.top && py <= height - margin.bottom;
    const hide = () => { tip.hide(); cross.attr("visibility", "hidden"); dot.attr("visibility", "hidden"); };
    svg.on("pointermove.hover", event => {
        const [px, py] = d3.pointer(event, svg.node());
        if (event.buttons || event.pointerType === "touch" || !insideX(px) || !insideY(py)) { hide(); return; }
        const value = pick({ px, py, x: x.invert(px), event });
        if (!value) { hide(); return; }
        tip.show(event, value);
        cross.attr("visibility", insideX(value.px) ? "visible" : "hidden").attr("x1", value.px).attr("x2", value.px);
        dot.attr("visibility", insideX(value.px) && insideY(value.py) ? "visible" : "hidden")
            .attr("cx", value.px).attr("cy", value.py);
    }).on("pointerleave.hover pointerdown.hover pointercancel.hover wheel.hover", hide)
        .on("keydown.hover", event => { if (event.key === "Escape") hide(); });
    return { hide, destroy() { svg.on(".hover", null); overlay.remove(); tip.destroy(); } };
}


/***/ }),
/* 4 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   drawReferences: () => (/* binding */ drawReferences)
/* harmony export */ });
// The reference marks a caller places on a drawing: two movable cursors across the plot and pinned points. The caller
// owns their values and their meaning; this module draws them, moves a cursor by pointer (d3.drag) or keyboard and
// reports the X value where it was left.

const d3 = globalThis.d3;

// The handle of a cursor, at the top of the plot: its size in pixels of the drawing.
const HANDLE_WIDTH = 12;
const HANDLE_HEIGHT = 14;

// The share of the plot width one arrow key moves a cursor; Shift multiplies it by ten.
const KEY_STEP = 0.01;

/**
 * Draws input.pins ([{x, y, unit, text}], in the native values of the scales) inside the clipped marks and input.cursors
 * ([value or null, value or null]) across the plot, each with a handle that drags along the X axis or moves with the
 * arrow keys, Home and End. onCursorChange(index, value) receives the X value a cursor was left at. A cursor outside the
 * X domain stays in the caller's state and is not drawn; the axes never widen for it.
 */
function drawReferences(surface, host, input) {
    const { svg, marks, x, scales, width, height, margin } = surface;
    const plotLeft = margin.left;
    const plotRight = width - margin.right;
    const plotTop = margin.top;
    const plotBottom = height - margin.bottom;
    const clamp = (value) => Math.max(plotLeft, Math.min(plotRight, value));
    const describe = (value) => (typeof surface.xFormat === "function" ? surface.xFormat(value) : String(value));
    for (const pin of Array.isArray(input.pins) ? input.pins : []) {
        const scale = scales.get(pin.unit);
        const px = x(pin.x);
        const py = scale ? scale(pin.y) : NaN;
        if (!Number.isFinite(px) || !Number.isFinite(py)) {
            continue;
        }
        const group = marks.append("g").attr("class", "pin").attr("transform", `translate(${px},${py})`);
        group.append("circle").attr("r", 5);
        if (pin.text) {
            group.append("text").attr("x", 7).attr("y", -7).text(pin.text);
        }
    }
    const report = (index, px) => {
        if (typeof input.onCursorChange === "function") {
            input.onCursorChange(index, x.invert(clamp(px)));
        }
    };
    (Array.isArray(input.cursors) ? input.cursors : []).forEach((value, index) => {
        if (value === null || value === undefined) {
            return;
        }
        let px = x(value);
        if (!Number.isFinite(px) || px < plotLeft || px > plotRight) {
            return;
        }
        const group = svg.append("g").attr("class", `cursor cursor-${index + 1}`);
        const line = group.append("line").attr("y1", plotTop).attr("y2", plotBottom);
        const handle = group.append("rect")
            .attr("class", "cursor-handle")
            .attr("tabindex", 0)
            .attr("role", "slider")
            .attr("aria-label", `Cursor ${index + 1}: drag it, or move it with the arrow keys, Home and End`)
            .attr("aria-valuetext", describe(value))
            .attr("data-cursor", String(index))
            .attr("rx", 2)
            .attr("y", plotTop)
            .attr("width", HANDLE_WIDTH)
            .attr("height", HANDLE_HEIGHT);
        const place = () => {
            line.attr("x1", px).attr("x2", px);
            handle.attr("x", px - HANDLE_WIDTH / 2);
        };
        place();
        // The handle takes the pointer before the plot does: a drag on it moves the cursor, never the view.
        handle.call(d3.drag()
            .container(svg.node())
            .on("drag", (event) => {
                px = clamp(event.x);
                place();
            })
            .on("end", (event) => {
                if (event.sourceEvent) {
                    report(index, px);
                }
            }));
        handle.on("keydown", (event) => {
            const step = (plotRight - plotLeft) * KEY_STEP * (event.shiftKey ? 10 : 1);
            const next = { ArrowLeft: px - step, ArrowRight: px + step, Home: plotLeft, End: plotRight }[event.key];
            if (next === undefined) {
                return;
            }
            event.preventDefault();
            report(index, next);
            // The redraw replaced the handle; the keyboard stays on the cursor that was moved.
            const replaced = host.querySelector(`[data-cursor="${index}"]`);
            if (replaced) {
                replaced.focus({ preventScroll: true });
            }
        });
    });
}


/***/ }),
/* 5 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DISPLAY_DEFAULTS: () => (/* binding */ DISPLAY_DEFAULTS),
/* harmony export */   MARKER_LIMIT: () => (/* binding */ MARKER_LIMIT),
/* harmony export */   drawTimeSeries: () => (/* binding */ drawTimeSeries)
/* harmony export */ });
/* harmony import */ var _options_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6);
/* harmony import */ var _gestures_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2);
/* harmony import */ var _canvas_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(1);
/* harmony import */ var _viewport_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(7);
/* harmony import */ var _legend_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(8);
/* harmony import */ var _layout_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(12);
/* harmony import */ var _scales_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(13);
/* harmony import */ var _series_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(10);
/* harmony import */ var _statistics_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(16);
/* harmony import */ var _strip_js__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(17);
/* harmony import */ var _cursors_js__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(18);
/* harmony import */ var _text_js__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(14);
/* harmony import */ var _timezone_js__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(15);
/* harmony import */ var _projection_js__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(19);
// Time series drawing with D3 scales and shapes. Principles: ink goes to the data, the axes carry only the
// range, lines are labelled directly, missing data is a gap, and a monitored value is held until the next sample.

const d3 = globalThis.d3;
















// More samples than this in view are not marked one by one.
const MARKER_LIMIT = 200;

// The most sample marks drawn for one line when marks are asked for on every sample.
const MARK_CAP = 1500;

/** The display settings of a chart with the full options, with the value each has until it is changed. */
const DISPLAY_DEFAULTS = {
    split: "none", legend: "list", legendstat: _legend_js__WEBPACK_IMPORTED_MODULE_4__.LEGEND_DEFAULT_STATISTICS, tooltip: "all", tipsort: "series", grid: "y", endlabels: false,
};

// The dash patterns a signal can be given by name; auto follows the display profile.
const DASH_PATTERNS = { solid: "", dash: "8 4", dot: "2 3", dashdot: "9 3 2 3" };

/**
 * timeZone is the zone the labels, the tooltip and the strip are written in (an IANA identifier, UTC or browser); without it the browser zone.
 * input: {series: [{name, egu, points: [{t, v, s, g?}], focus, quiet?, minmax?}], from: Date, to: Date, gapMs: number (Infinity: none), labelNames?: boolean, height?: number, axisWidth?: number}
 * axisWidth is the least width in pixels of a value axis (see axisRoom()).
 * onZoom(from, to) turns a horizontal drag over the plot into a request for that window. Exact samples are marked
 * when the window holds few enough of them to be told apart.
 * quiet draws a series thin and pale, as the background of a series that carries the point (a floor over raw values).
 * minmax ({min: points, max: points}) draws the band between the min and the max of the display means under the line.
 * labelNames false labels the end of a line with its value only, for a chart whose title already names it.
 * labelRoom is the least room in pixels to leave on the right for the labels (see labelRoom()).
 * onReset() is called on a double-click, after the value ranges chosen on the axes are dropped, so that the page can return
 * to the time window it started from.
 * info(topic) may return an element, an information control of the page, to put beside the title of the table of
 * statistics (topic "statistics") and at the end of the range strip (topic "range").
 * The range strip above the chart always shows the time window as an interval, with its date and time (strip false leaves it
 * out, for a page that shows the window itself); windowChosen true
 * says that the window was chosen and not the range of the page, which lights the controls given by onPan(direction) (earlier
 * is -1, later is 1; canPanLater false dims later) and onReset(). fromIncluded and toIncluded false write that end of the
 * interval with a parenthesis because the data at that end is left out; both are included unless a page says otherwise.
 * options is the object of buildChartOptions(): line shape, value scale, sample marks, running average and standard
 * deviation band; CHART_OPTIONS holds the values used until the viewer changes one.
 * projection true draws a histogram of the samples in view for each line at the right of the plot, on the value axis of
 * its unit, with a line at its mean, and puts a table of basic statistics under the chart, or in each element of
 * statisticsHost (an element of the page or a list of them) when the page gives one.
 * statistics true emits the table even without projection; statisticsTitle names it. ranges (Map by unit) and hidden
 * (Set by name) can be supplied by the caller; onRangesChange and onVisibilityChange report pointer, keyboard and reset changes.
 * fitWidth scales a multi-axis drawing to the host width instead of widening the page.
 * legend true gives each line a color and a dash and puts a legend under the chart in place of the labels at the
 * end of the lines; a click on a legend item hides that line until it is clicked again.
 * Replaces the content of host and returns its canvas (the first panel's, when split), or undefined when no series is visible.
 * overlay(canvas) can append clipped data layers. keyboardX and wheel enable optional X navigation.
 * tool, nav, navUnit and selection, with onSelect and onNavigate, are the navigation inputs of the canvas (see
 * gestures.js); hover false leaves the tooltip out. pins ([{name, t, v}]) are drawn on the lines they belong to and
 * onPin(observation) receives the sample nearest to a Shift+click; cursors ([time or null, time or null]) and
 * onCursorChange(index, time) place the two reference cursors, whose readings are tabled under the chart.
 * display ({split, legend, legendstat, tooltip, tipsort, grid, endlabels}, see DISPLAY_DEFAULTS), signals (Map of
 * series name to {width, dash, gap, fill, decimals, name}) and axes (Map of unit to {scale, symlog, softmin, softmax,
 * zero, prefix, label}) are the full options of the analyzer; a chart without display keeps the simple form.
 */
function drawTimeSeries(host, input) {
    return (0,_viewport_js__WEBPACK_IMPORTED_MODULE_3__.preserveViewport)(() => drawSeries(host, input));
}

/** The value a series holds at time t on its points, by the gap rule of the series, or null. */
function heldAt(points, gapMs, t) {
    const observation = (0,_cursors_js__WEBPACK_IMPORTED_MODULE_10__.heldObservation)(points, gapMs, t);
    return observation ? observation.v : null;
}

/**
 * The paired samples of two series for the fill between them: at every time either series has a sample inside the
 * span where both hold a value, the value each holds there; a time where either has none ends a run.
 */
function pairedRuns(a, b, gapA, gapB) {
    const times = [...new Set([...a.points, ...b.points].map((p) => p.t))].sort((p, q) => p - q);
    const runs = [];
    let run = [];
    for (const t of times) {
        const va = heldAt(a.points, gapA, t);
        const vb = heldAt(b.points, gapB, t);
        if (va === null || vb === null) {
            if (run.length > 1) runs.push(run);
            run = [];
            continue;
        }
        run.push({ t, a: va, b: vb });
    }
    if (run.length > 1) runs.push(run);
    return runs;
}

function drawSeries(host, input) {
    // The panels keep their elements across redraws: the navigation behavior of a panel is bound to its element, and a
    // gesture that redraws the chart under the pointer continues on the same element.
    const keptPanels = [...host.children].filter((element) => element.classList.contains("chart-panel"));
    host.textContent = "";
    // The table of statistics goes into each element of input.statisticsHost (one element or a list); under the chart
    // when the page gives none.
    const statisticsHosts = [].concat(input.statisticsHost || []);
    for (const element of statisticsHosts) {
        element.textContent = "";
    }
    const { series, from, to, gapMs } = input;
    const full = Boolean(input.display);
    const display = { ...DISPLAY_DEFAULTS, ...(input.display || {}) };
    const signals = input.signals instanceof Map ? input.signals : new Map();
    const axes = input.axes instanceof Map ? input.axes : new Map();
    const legendMode = full ? display.legend : input.legend === true ? "list" : "off";
    // A chart with a legend or the full options draws its lines through the combinations of the profile (combinations true too).
    const styled = full || input.legend === true || input.combinations === true;
    const all = (0,_series_js__WEBPACK_IMPORTED_MODULE_7__.finiteSeries)(series);
    if (!all.length) {
        host.textContent = "No samples in this time range.";
        return;
    }
    let hidden = input.hidden || _legend_js__WEBPACK_IMPORTED_MODULE_4__.HIDDEN.get(host);
    if (!hidden) {
        hidden = new Set();
        _legend_js__WEBPACK_IMPORTED_MODULE_4__.HIDDEN.set(host, hidden);
    }
    for (const name of input.hidden ? [] : [...hidden]) {
        if (!all.some((s) => s.name === name)) {
            hidden.delete(name);
        }
    }
    // Hidden lines stay hidden whatever the legend shows; a chart without a legend and without a hidden set draws all.
    const hides = Boolean(input.hidden) || legendMode !== "off";
    const drawn = hides ? all.filter((s) => !hidden.has(s.name)) : all;
    const redrawAll = () => {
        drawTimeSeries(host, input);
        if (typeof input.onVisibilityChange === "function") input.onVisibilityChange([...hidden]);
    };
    const settingOf = (s) => signals.get(s.name) || {};
    const axisOf = (unit) => axes.get(unit) || {};
    const labels = new Map(all.map((s) => [s.name, typeof settingOf(s).name === "string" && settingOf(s).name ? settingOf(s).name : s.name]));
    const lookOf = (s) => {
        const look = (0,_series_js__WEBPACK_IMPORTED_MODULE_7__.lineLook)(s, all.indexOf(s));
        const setting = settingOf(s);
        if (Number.isFinite(setting.width)) look.width = setting.width;
        if (typeof setting.dash === "string" && setting.dash in DASH_PATTERNS) look.dash = DASH_PATTERNS[setting.dash] || null;
        return look;
    };
    const looks = new Map(all.map((s) => [s.name, lookOf(s)]));
    // The text of a value of a series: the decimals the page chose, or the SI prefix of its unit written before the
    // unit (0.7499 V becomes 749.9 mV), or the ordinary form.
    const valueText = (s, v, withUnit = true) => {
        const decimals = settingOf(s).decimals;
        const prefixed = axisOf(s.egu || "").prefix === "si";
        if (prefixed && !Number.isInteger(decimals)) {
            const si = d3.format(".4~s")(v);
            const letter = /[a-zA-Zµ]$/.test(si) ? si.slice(-1) : "";
            const number = letter ? si.slice(0, -1) : si;
            return withUnit && s.egu ? `${number} ${letter}${s.egu}` : si;
        }
        const text = Number.isInteger(decimals) ? v.toFixed(decimals) : (0,_text_js__WEBPACK_IMPORTED_MODULE_11__.format)(v, "");
        return `${text}${withUnit && s.egu ? ` ${s.egu}` : ""}`;
    };
    const gapOf = (s) => (Number.isFinite(settingOf(s).gap) && settingOf(s).gap > 0 ? settingOf(s).gap * 1000 : gapMs);
    const legendOptions = { mode: legendMode, statistics: display.legendstat, labels, looks, values: new Map(), format: (v, s) => valueText(s, v, false) };
    if (!drawn.length) {
        const note = document.createElement("p");
        note.textContent = "All lines are hidden. Click a legend item to show it.";
        host.append(note);
        if (legendMode !== "off") host.append((0,_legend_js__WEBPACK_IMPORTED_MODULE_4__.buildLegend)(host, all, hidden, redrawAll, legendOptions));
        return;
    }
    const hostWidth = Math.max(320, host.clientWidth || 640);
    // The drawing is as wide as its host unless its axes and projection leave the plot too little room (see below).
    let width = hostWidth;
    // input.height is the height of the drawing in pixels; a taller drawing gets more ticks on its value axes.
    const height = Math.max(200, Math.floor(input.height || 250));
    const tickCount = Math.max(4, Math.round((height - 42) / 48));
    const labelNames = input.labelNames !== false;
    const layout = (0,_layout_js__WEBPACK_IMPORTED_MODULE_5__.labelLayout)(host, drawn, width, labelNames);
    const names = drawn.map((s) => labels.get(s.name));
    const endLabels = full ? display.endlabels === true : legendMode === "off";
    const right = !endLabels ? 12 : Math.max(layout.right, Math.min(input.labelRoom || 0, Math.floor(width * 0.45)));
    // One value axis per unit, each with its own range: the first half on the left of the plot, the rest on the right;
    // or, split by unit, one panel per unit under another with the axis on its left.
    const units = [...new Set(drawn.map((s) => s.egu || ""))];
    const panels = display.split === "unit" && units.length > 1 ? units.map((unit) => [unit]) : [units];
    const multi = units.length > 1;
    let ranges = input.ranges || _gestures_js__WEBPACK_IMPORTED_MODULE_1__.RANGES.get(host);
    if (!ranges) {
        ranges = new Map();
        _gestures_js__WEBPACK_IMPORTED_MODULE_1__.RANGES.set(host, ranges);
    }
    for (const unit of input.ranges ? [] : [...ranges.keys()]) {
        if (!units.includes(unit)) {
            ranges.delete(unit);
        }
    }
    const plotTop = multi ? 30 : 8;
    const plotBottomMargin = 34;
    const options = { ..._options_js__WEBPACK_IMPORTED_MODULE_0__.CHART_OPTIONS, ...(input.options || {}) };
    const scaleNotes = [];
    const scales = new Map(
        units.map((unit) => {
            const axis = axisOf(unit);
            const values = drawn.filter((s) => (s.egu || "") === unit).flatMap((s) => s.points.map((p) => p.v));
            const made = (0,_scales_js__WEBPACK_IMPORTED_MODULE_6__.makeValueScale)(axis.scale || options.yscale, values, ranges.get(unit), [height - plotBottomMargin, plotTop], unit, tickCount,
                { soft: [Number.isFinite(axis.softmin) ? axis.softmin : null, Number.isFinite(axis.softmax) ? axis.softmax : null], zero: axis.zero === true, symlog: axis.symlog });
            if (made.reason) {
                scaleNotes.push(made.reason);
            }
            return [unit, made.scale];
        })
    );
    const tickFormats = new Map(units.map((unit) => [unit, axisOf(unit).prefix === "si" ? d3.format(".4~s") : d3.format(".4~g")]));
    const axisLabels = new Map(units.map((unit) => [unit, typeof axisOf(unit).label === "string" && axisOf(unit).label ? axisOf(unit).label : unit || "no unit"]));
    const yOf = (s) => scales.get(s.egu || "");
    // The width of a value axis follows its widest tick label, and is at least what the page asks for (stacked charts).
    const axisWidth = Math.max((0,_scales_js__WEBPACK_IMPORTED_MODULE_6__.axisWidthOf)(scales, tickCount, tickFormats), Math.floor(input.axisWidth || 0));
    // The margins are those of the widest panel, so that every panel shares one time axis.
    const onLeftOf = (panelUnits) => Math.ceil(panelUnits.length / 2);
    const mostLeft = Math.max(...panels.map((panelUnits) => onLeftOf(panelUnits)));
    const mostRight = Math.max(...panels.map((panelUnits) => panelUnits.length - onLeftOf(panelUnits)));
    const margin = {
        top: plotTop,
        right: right + axisWidth * mostRight + (input.projection === true ? _projection_js__WEBPACK_IMPORTED_MODULE_13__.PROJECTION_WIDTH : 0),
        bottom: plotBottomMargin,
        left: axisWidth + axisWidth * (mostLeft - 1),
    };
    // Axes and projection never take the plot below its least width: the drawing grows wider than its host, which
    // scrolls sideways inside its own box, and the page does not.
    if (width - margin.left - margin.right < _scales_js__WEBPACK_IMPORTED_MODULE_6__.PLOT_LEAST) {
        width = margin.left + margin.right + _scales_js__WEBPACK_IMPORTED_MODULE_6__.PLOT_LEAST;
    }
    const widened = width > hostWidth;
    const x = d3.scaleTime().domain([from, to]).range([margin.left, width - margin.right]);

    const spanHours = (to - from) / 3600000;
    const timeFormat = (when) => (0,_timezone_js__WEBPACK_IMPORTED_MODULE_12__.formatInZone)(when, spanHours > 36 ? "%m-%d %H:%M" : spanHours > 1 / 6 ? "%H:%M" : "%H:%M:%S", input.timeZone);
    const curve = { step: d3.curveStepAfter, line: d3.curveLinear, smooth: d3.curveMonotoneX }[options.shape] || d3.curveStepAfter;
    const inView = (s) => s.points.filter((p) => p.t >= from.getTime() && p.t <= to.getTime());
    const bisect = d3.bisector((p) => p.t).center;
    const rangeChanged = () => {
        drawTimeSeries(host, input);
        if (typeof input.onRangesChange === "function") input.onRangesChange([...ranges]);
    };
    const preview = () => drawTimeSeries(host, input);
    // While a navigation gesture runs, the samples at hand are drawn at the window the pointer asks for; nothing is retrieved.
    const onNavigate = typeof input.onNavigate === "function" ? input.onNavigate
        : (low, high) => drawTimeSeries(host, { ...input, from: low, to: high, windowChosen: true });
    // A Shift+click picks the drawn sample nearest to the pointer, for the page to pin.
    const onPoint = typeof input.onPin !== "function" ? undefined : ({ px, py }) => {
        let best = null;
        for (const s of drawn) {
            const point = s.points[bisect(s.points, x.invert(px).getTime())];
            if (!point) continue;
            const distance = Math.hypot(x(point.t) - px, yOf(s)(point.v) - py);
            if (!best || distance < best.distance) best = { distance, series: s, point };
        }
        if (best) input.onPin({ name: best.series.name, egu: best.series.egu || "", t: best.point.t, v: best.point.v, s: best.point.s });
    };
    // The tooltip: the sample of every drawn line nearest to the time under the pointer (all), or of the nearest line
    // only (single), in the order of the lines or by value.
    const pickAt = (panelSeries) => ({ px, py, x: when }) => {
        const at = when.getTime();
        const candidates = drawn.map((s) => ({ series: s, point: s.points[bisect(s.points, at)] || null }));
        let nearest = null;
        for (const candidate of candidates) {
            if (!candidate.point || !panelSeries.includes(candidate.series)) continue;
            const distance = Math.hypot(x(candidate.point.t) - px, yOf(candidate.series)(candidate.point.v) - py);
            if (!nearest || distance < nearest.distance) nearest = { ...candidate, distance };
        }
        let shown = display.tooltip === "single" ? (nearest ? [nearest] : []) : candidates;
        if (display.tipsort === "asc" || display.tipsort === "desc") {
            const sign = display.tipsort === "asc" ? 1 : -1;
            shown = shown.slice().sort((a, b) => {
                if (!a.point && !b.point) return 0;
                if (!a.point) return 1;
                if (!b.point) return -1;
                return sign * (a.point.v - b.point.v);
            });
        }
        if (!shown.length) return null;
        const rows = shown.map(({ series: s, point }) => `${labels.get(s.name)}  ${point ? valueText(s, point.v) : "no sample"}${point && point.s ? "  ALARM" : ""}`);
        const marked = nearest ? nearest.point : null;
        return { title: (0,_timezone_js__WEBPACK_IMPORTED_MODULE_12__.formatInZone)(when, "%Y-%m-%d %H:%M:%S", input.timeZone), rows,
            px: marked ? x(marked.t) : undefined, py: marked ? yOf(nearest.series)(marked.v) : undefined };
    };

    if (input.strip !== false) {
        host.append((0,_strip_js__WEBPACK_IMPORTED_MODULE_9__.buildRangeStrip)(input, ranges, units, rangeChanged));
    }

    const statistics = [];
    let firstCanvas = null;
    panels.forEach((panelUnits, panelIndex) => {
        const panelHost = keptPanels[panelIndex] || document.createElement("div");
        panelHost.className = "chart-panel";
        panelHost.textContent = "";
        const panelSeries = drawn.filter((s) => panelUnits.includes(s.egu || ""));
        const onLeft = onLeftOf(panelUnits);
        const panelScales = new Map(panelUnits.map((unit) => [unit, scales.get(unit)]));
        const last = panelIndex === panels.length - 1;
        const canvas = (0,_canvas_js__WEBPACK_IMPORTED_MODULE_2__.createPlotCanvas)({ width, height, margin, x, scales: panelScales, units: panelUnits, axisWidth, onLeft, tickCount,
            displayWidth: widened && !input.fitWidth ? width : "100%", unitLabels: multi, axisLabels, grid: display.grid, tickFormats,
            xTickLabels: last,
            label: `Time series of ${panelSeries.length} PV${panelSeries.length > 1 ? "s" : ""}${panels.length > 1 ? ` in ${panelUnits[0] || "no unit"}` : ""}`,
            xTicks: [0, 1 / 3, 2 / 3, 1].map(fraction => new Date(from.getTime() + fraction * (to - from))),
            xFormat: timeFormat });
        const { svg, marks: plotArea } = canvas;
        firstCanvas ||= canvas;

        // Alarm lane: the only mark besides a line that uses the alert color.
        const laneY = height - margin.bottom + 8;
        for (const s of panelSeries) {
            for (const point of s.points) {
                if (point.s > 0) {
                    svg.append("rect").attr("class", "alarm").attr("x", x(point.t) - 1).attr("y", laneY).attr("width", 3).attr("height", 4);
                }
            }
        }

        const lineOf = (s) => d3.line().x((p) => x(p.t)).y((p) => yOf(s)(p.v)).curve(curve);
        const ordered = panelSeries.slice().sort((a, b) => Number(a.focus) - Number(b.focus));
        const endLabelList = [];
        // The fill between two signals of one unit, under both lines, on the times where both hold a value.
        for (const s of ordered) {
            const partner = drawn.find((other) => other.name === settingOf(s).fill);
            if (!partner || partner === s || (partner.egu || "") !== (s.egu || "") || !panelUnits.includes(s.egu || "")) continue;
            if (drawn.find((other) => settingOf(other).fill === s.name && drawn.indexOf(other) < drawn.indexOf(s))) continue;
            const scale = yOf(s);
            for (const run of pairedRuns(s, partner, gapOf(s), gapOf(partner))) {
                const area = d3.area().x((p) => x(p.t)).y0((p) => scale(p.a)).y1((p) => scale(p.b)).curve(options.shape === "step" ? d3.curveStepAfter : d3.curveLinear);
                plotArea.append("path").attr("class", "fill").attr("d", area(run)).style("fill", looks.get(s.name).color);
            }
        }
        ordered.forEach((s) => {
            const slot = all.indexOf(s);
            const look = styled ? looks.get(s.name) : null;
            const color = look ? look.color : null;
            const scale = yOf(s);
            // The band between the min and the max of the display means, under the line of the mean.
            if (s.minmax && Array.isArray(s.minmax.min) && Array.isArray(s.minmax.max)) {
                const maxAt = new Map(s.minmax.max.map((p) => [p.t, p]));
                const pairs = s.minmax.min.filter((p) => maxAt.has(p.t)).map((p) => ({ t: p.t, lo: p.v, hi: maxAt.get(p.t).v, g: p.g || maxAt.get(p.t).g }));
                for (const part of (0,_series_js__WEBPACK_IMPORTED_MODULE_7__.splitOnGaps)(pairs, gapOf(s))) {
                    const area = d3.area().x((p) => x(p.t)).y0((p) => scale(p.lo)).y1((p) => scale(p.hi)).curve(d3.curveStepAfter);
                    const band = plotArea.append("path").attr("class", "minmax").attr("d", area(part));
                    if (color) band.style("fill", color);
                }
            }
            for (const part of (0,_series_js__WEBPACK_IMPORTED_MODULE_7__.splitOnGaps)(s.points, gapOf(s))) {
                // A band of one standard deviation and a running average of the last samples, under the line itself.
                if ((options.band || options.average) && part.length > 1) {
                    const stats = (0,_series_js__WEBPACK_IMPORTED_MODULE_7__.movingStats)(part.map((p) => p.v), options.window);
                    const [lowest] = d3.extent(scale.domain());
                    if (options.band) {
                        const area = d3.area()
                            .x((p) => x(p.t))
                            .y0((p, i) => scale(Math.max(stats[i].mean - stats[i].deviation, lowest)))
                            .y1((p, i) => scale(stats[i].mean + stats[i].deviation))
                            .curve(d3.curveLinear);
                        const band = plotArea.append("path").attr("class", "band").attr("d", area(part));
                        if (color) {
                            band.style("fill", color);
                        }
                    }
                    if (options.average) {
                        const average = d3.line().x((p) => x(p.t)).y((p, i) => scale(stats[i].mean)).curve(d3.curveLinear);
                        const path = plotArea.append("path").attr("class", "average").attr("d", average(part));
                        if (color) {
                            path.style("stroke", color);
                        }
                    }
                }
                if (options.shape === "points") {
                    continue;
                }
                const path = plotArea.append("path")
                    .attr("class", s.focus ? "line focus" : s.quiet ? "line quiet" : "line")
                    .attr("stroke-dasharray", look ? look.dash : s.focus ? null : _series_js__WEBPACK_IMPORTED_MODULE_7__.DASHES[slot % _series_js__WEBPACK_IMPORTED_MODULE_7__.DASHES.length] || null)
                    .attr("d", lineOf(s)(part));
                if (look) {
                    path.style("stroke", look.color).style("stroke-width", look.width);
                    if (s.quiet) {
                        // A series that is only the background of another one stays pale in a chart with a legend too.
                        path.style("opacity", "0.6");
                    }
                }
            }
            // The name at the end of a line stands at its last visible finite observation.
            const visible = inView(s);
            const lastPoint = visible.length ? visible[visible.length - 1] : null;
            if (lastPoint) endLabelList.push({ y: scale(lastPoint.v), series: s, last: lastPoint });
        });

        // The samples themselves: automatically once few enough are in view to be told apart, or on every sample, or never.
        const showMarks = options.shape === "points" || options.marks === "on"
            || (options.marks === "auto" && drawn.every((s) => inView(s).length <= MARKER_LIMIT));
        if (showMarks) {
            for (const s of ordered) {
                const inside = inView(s);
                const stride = Math.max(1, Math.ceil(inside.length / MARK_CAP));
                const look = styled ? looks.get(s.name) : null;
                for (const point of inside.filter((p, i) => i % stride === 0)) {
                    const cx = x(point.t);
                    const cy = yOf(s)(point.v);
                    const dot = look
                        ? plotArea.append("path").attr("d", (0,_series_js__WEBPACK_IMPORTED_MODULE_7__.markerPath)(look.marker)).attr("transform", `translate(${cx},${cy})`)
                        : plotArea.append("circle").attr("cx", cx).attr("cy", cy).attr("r", 2.4);
                    dot.attr("class", s.focus ? "dot focus" : "dot");
                    if (look) {
                        dot.style("stroke", look.color);
                    }
                }
            }
        }

        // The Y projection: for each line the samples in view in bins of the value axis of its unit, drawn as bars growing
        // to the right from the edge of the band, and a line at the mean. The samples in view are those inside the time
        // window and, when the viewer dragged a value range out on the axis of the unit, inside that range.
        const onRight = panelUnits.length - onLeft;
        statistics.push(...(0,_projection_js__WEBPACK_IMPORTED_MODULE_13__.drawProjection)(svg, { drawn: panelSeries, all, ranges, inView, yOf, projection: input.projection, width, margin, axisWidth, onRight }));

        // Direct labels at the end of each line, pushed apart so they do not overlap.
        endLabelList.sort((a, b) => a.y - b.y);
        for (let i = 1; i < endLabelList.length; i += 1) {
            if (endLabelList[i].y - endLabelList[i - 1].y < 13) {
                endLabelList[i].y = endLabelList[i - 1].y + 13;
            }
        }
        const room = right - 6;
        for (const label of endLabels ? endLabelList : []) {
            const name = labels.get(label.series.name);
            const value = valueText(label.series, label.last.v, false);
            const text0 = !labelNames ? value : width < 560 ? name : `${name}  ${value}`.trim();
            // A label that still does not fit the room is shortened with an ellipsis; its full text is the title.
            const widest = layout.widest;
            const text = widest <= room ? text0 : `${text0.slice(0, Math.max(4, Math.floor((text0.length * room) / Math.max(widest, 1)) - 1))}…`;
            const element = svg.append("text")
                .attr("class", label.series.focus ? "label focus" : "label")
                .attr("x", width - right + 6)
                .attr("y", label.y + 4)
                .text(text);
            if (text !== text0) {
                element.append("title").text(text0);
            }
        }

        if (panelIndex === 0 && typeof input.overlay === "function") input.overlay(canvas);

        // The pins of the page on the lines of this panel; a pin of a hidden line waits in the page's state, and a pin
        // without a value (unavailable) is listed by the page but not drawn.
        const pins = (Array.isArray(input.pins) ? input.pins : []).flatMap((pin) => {
            const s = panelSeries.find((series) => series.name === pin.name);
            return s && Number.isFinite(pin.v) ? [{ x: new Date(pin.t), y: pin.v, unit: s.egu || "", text: valueText(s, pin.v, false) }] : [];
        });
        canvas.bindInteractions(panelHost, { ...input, ranges, pins, onPoint, onNavigate }, rangeChanged, preview);
        if (input.hover !== false) {
            canvas.bindHover(panelHost, pickAt(panelSeries));
        }
        panelHost.append(svg.node());
        host.append(panelHost);
    });

    for (const row of statistics) {
        legendOptions.values.set(row.name, row.values);
    }
    if (legendMode !== "off") {
        host.append((0,_legend_js__WEBPACK_IMPORTED_MODULE_4__.buildLegend)(host, all, hidden, redrawAll, legendOptions));
    }
    const cursors = Array.isArray(input.cursors) ? input.cursors : [];
    if (cursors.some((time) => time !== null && time !== undefined)) {
        host.append((0,_cursors_js__WEBPACK_IMPORTED_MODULE_10__.buildCursorTable)(drawn, names, cursors, gapOf, input.timeZone, (s, v) => valueText(s, v)));
    }
    if (scaleNotes.length) {
        const note = document.createElement("p");
        note.className = "chart-note";
        note.setAttribute("role", "status");
        note.textContent = scaleNotes.join(" ");
        host.append(note);
    }
    if (input.projection === true || input.statistics === true) {
        for (const element of statisticsHosts.length ? statisticsHosts : [host]) {
            element.append((0,_statistics_js__WEBPACK_IMPORTED_MODULE_8__.buildStatistics)(statistics, typeof input.info === "function" ? input.info("statistics") : null, input.statisticsTitle));
        }
    }
    host.dataset.egu = drawn[0].egu;
    return firstCanvas;
}


/***/ }),
/* 6 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CHART_OPTIONS: () => (/* binding */ CHART_OPTIONS),
/* harmony export */   buildChartOptions: () => (/* binding */ buildChartOptions),
/* harmony export */   normalizeOptions: () => (/* binding */ normalizeOptions)
/* harmony export */ });
// The options a viewer can change on a chart and the controls that change them.

/** The options a viewer can change on a chart, with the value each has until it is changed (see buildChartOptions). */
const CHART_OPTIONS = { shape: "step", yscale: "linear", marks: "auto", average: false, band: false, window: 30 };

const CHOICES = {
    shape: [["step", "Step"], ["line", "Straight"], ["smooth", "Smooth"], ["points", "Points"]],
    yscale: [["linear", "Linear"], ["symlog", "Symmetric log"], ["log", "Log"], ["sqrt", "Square root"]],
    marks: [["auto", "Auto"], ["on", "On"], ["off", "Off"]],
    window: [[10, "10 samples"], [30, "30 samples"], [60, "60 samples"]],
};

/** Returns supported options only; unreadable fields use the ordinary chart defaults. */
function normalizeOptions(input = {}) {
    const options = { ...CHART_OPTIONS };
    for (const [name, choices] of Object.entries(CHOICES)) {
        if (choices.some(([value]) => value === input[name])) {
            options[name] = input[name];
        }
    }
    for (const name of ["average", "band"]) {
        if (typeof input[name] === "boolean") {
            options[name] = input[name];
        }
    }
    return options;
}

/**
 * The controls of the options of a chart: line shape, value scale, sample marks, running average, standard deviation
 * band and their window in samples. options is the object the page holds; onChange(next) is called with a new object
 * after each change, and the page draws the chart again with it. The page puts the returned element in its panel.
 * info is an element, an information control of the page, put at the end of the first row.
 */
function buildChartOptions(options, onChange, info) {
    const current = normalizeOptions(options);
    const body = document.createElement("div");
    body.className = "opt-controls";
    const row = () => {
        const element = document.createElement("div");
        element.className = "opt-row";
        body.append(element);
        return element;
    };
    const apply = (name, value) => {
        current[name] = value;
        onChange({ ...current });
    };
    const select = (label, name, choices, convert = (v) => v) => {
        const wrap = document.createElement("label");
        wrap.append(`${label} `);
        const element = document.createElement("select");
        for (const [value, text] of choices) {
            const option = document.createElement("option");
            option.value = String(value);
            option.textContent = text;
            element.append(option);
        }
        element.value = String(current[name]);
        element.addEventListener("change", () => apply(name, convert(element.value)));
        wrap.append(element);
        return wrap;
    };
    const check = (label, name) => {
        const wrap = document.createElement("label");
        const element = document.createElement("input");
        element.type = "checkbox";
        element.checked = Boolean(current[name]);
        element.addEventListener("change", () => apply(name, element.checked));
        wrap.append(element, ` ${label}`);
        return wrap;
    };
    row().append(
        select("Line", "shape", CHOICES.shape),
        select("Y scale", "yscale", CHOICES.yscale),
        select("Marks", "marks", CHOICES.marks),
        select("Window", "window", CHOICES.window, Number)
    );
    if (info) {
        info.classList.add("opt-info");
        body.firstElementChild.append(info);
    }
    row().append(check("Running average", "average"), check("Standard deviation band", "band"));
    return body;
}


/***/ }),
/* 7 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   preserveViewport: () => (/* binding */ preserveViewport)
/* harmony export */ });
// Synchronous redraws retain the page viewport while their old content is replaced.
function preserveViewport(draw) {
    const left = window.scrollX, top = window.scrollY;
    const body = document.body, root = document.documentElement;
    const minimum = body.style.minHeight, anchoring = root.style.overflowAnchor;
    body.style.minHeight = `${Math.max(body.offsetHeight, root.scrollHeight)}px`;
    root.style.overflowAnchor = "none";
    try {
        return draw();
    } finally {
        body.style.minHeight = minimum;
        window.scrollTo({ left, top, behavior: "instant" });
        root.style.overflowAnchor = anchoring;
    }
}


/***/ }),
/* 8 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   HIDDEN: () => (/* binding */ HIDDEN),
/* harmony export */   LEGEND_DEFAULT_STATISTICS: () => (/* binding */ LEGEND_DEFAULT_STATISTICS),
/* harmony export */   LEGEND_STATISTICS: () => (/* binding */ LEGEND_STATISTICS),
/* harmony export */   buildLegend: () => (/* binding */ buildLegend)
/* harmony export */ });
/* harmony import */ var _dom_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9);
/* harmony import */ var _series_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(10);
// The legend under a chart, as a list or as a table with computed values, and the names of the lines a viewer has hidden
// through it.




const d3 = globalThis.d3;

// The names of the lines a viewer has hidden through the legend, kept per chart host across redraws.
const HIDDEN = new WeakMap();

// The computed values a legend table can show, in the order a page may ask for them, and the columns shown by default.
const LEGEND_STATISTICS = ["min", "max", "mean", "median", "std", "last", "count"];
const LEGEND_DEFAULT_STATISTICS = ["min", "max", "mean", "last"];
const STATISTIC_TITLES = { min: "Min", max: "Max", mean: "Mean", median: "Median", std: "Std dev", last: "Last", count: "Samples" };

/** The value of one statistic over the displayed values of a series, or null when there is none. */
function statisticOf(name, values) {
    if (!values.length) {
        return name === "count" ? 0 : null;
    }
    switch (name) {
        case "min": return d3.min(values);
        case "max": return d3.max(values);
        case "mean": return d3.mean(values);
        case "median": return d3.median(values);
        case "std": return values.length > 1 ? d3.deviation(values) : null;
        case "last": return values[values.length - 1];
        case "count": return values.length;
        default: return null;
    }
}

/** The swatch of a series: its line and the marker of its combination, as the chart draws them. */
function swatchOf(look) {
    const swatch = document.createElementNS(_dom_js__WEBPACK_IMPORTED_MODULE_0__.SVG_NS, "svg");
    swatch.setAttribute("width", "30");
    swatch.setAttribute("height", "10");
    swatch.setAttribute("aria-hidden", "true");
    const line = document.createElementNS(_dom_js__WEBPACK_IMPORTED_MODULE_0__.SVG_NS, "line");
    for (const [name, value] of [["x1", "1"], ["x2", "29"], ["y1", "5"], ["y2", "5"], ["stroke", look.color], ["stroke-width", String(look.width)]]) {
        line.setAttribute(name, value);
    }
    if (look.dash) {
        line.setAttribute("stroke-dasharray", look.dash);
    }
    swatch.append(line);
    // The marker of the combination sits on the line, so the legend shows what a chart with its samples marked draws.
    const marker = document.createElementNS(_dom_js__WEBPACK_IMPORTED_MODULE_0__.SVG_NS, "path");
    marker.setAttribute("d", (0,_series_js__WEBPACK_IMPORTED_MODULE_1__.markerPath)(look.marker, 36));
    marker.setAttribute("transform", "translate(15,5)");
    marker.setAttribute("fill", "#ffffff");
    marker.setAttribute("stroke", look.color);
    marker.setAttribute("stroke-width", "1.2");
    swatch.append(marker);
    return swatch;
}

/**
 * The legend under a chart: one button per series with its line, name and unit; a click hides or shows that line.
 * options.mode table adds one column per statistic of options.statistics, computed over options.values (a Map of
 * series name to the displayed values inside the axes) and written with options.format(value, series); labels maps
 * a series name to the name shown, looks a series name to its look (the combination of the profile unless the page
 * gives one).
 */
function buildLegend(host, all, hidden, redraw, options = {}) {
    const mode = options.mode === "table" ? "table" : "list";
    const statistics = mode === "table"
        ? (Array.isArray(options.statistics) ? options.statistics.filter((name) => LEGEND_STATISTICS.includes(name)) : LEGEND_DEFAULT_STATISTICS)
        : [];
    const labelOf = (s) => (options.labels && options.labels.get(s.name)) || s.name;
    const lookOf = (s, slot) => (options.looks && options.looks.get(s.name)) || (0,_series_js__WEBPACK_IMPORTED_MODULE_1__.lineLook)(s, slot);
    const format = typeof options.format === "function" ? options.format : (value) => String(value);
    const item = (s, slot) => {
        const off = hidden.has(s.name);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "item";
        button.dataset.series = s.name;
        button.setAttribute("aria-pressed", String(!off));
        button.title = `${off ? "Show" : "Hide"} ${s.name}`;
        button.append(swatchOf(lookOf(s, slot)), document.createTextNode(labelOf(s)));
        if (s.egu) {
            const unit = document.createElement("span");
            unit.className = "unit";
            unit.textContent = s.egu;
            button.append(" ", unit);
        }
        button.addEventListener("click", () => {
            if (hidden.has(s.name)) {
                hidden.delete(s.name);
            } else {
                hidden.add(s.name);
            }
            redraw();
            // The redraw replaced the buttons; the keyboard stays on the item that was pressed.
            for (const element of host.querySelectorAll(".legend button")) {
                if (element.dataset.series === s.name) {
                    element.focus();
                }
            }
        });
        return button;
    };
    if (mode === "list") {
        const box = document.createElement("div");
        box.className = "legend";
        box.setAttribute("aria-label", "Legend");
        all.forEach((s, slot) => box.append(item(s, slot)));
        return box;
    }
    const table = document.createElement("table");
    table.className = "legend legend-table";
    table.setAttribute("aria-label", "Legend with values of the displayed samples");
    const head = document.createElement("tr");
    for (const text of ["Series", ...statistics.map((name) => STATISTIC_TITLES[name])]) {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = text;
        head.append(cell);
    }
    const thead = document.createElement("thead");
    thead.append(head);
    const body = document.createElement("tbody");
    all.forEach((s, slot) => {
        const row = document.createElement("tr");
        const first = document.createElement("td");
        first.append(item(s, slot));
        row.append(first);
        const values = hidden.has(s.name) ? [] : (options.values && options.values.get(s.name)) || [];
        for (const name of statistics) {
            const cell = document.createElement("td");
            cell.className = "num";
            const value = hidden.has(s.name) ? null : statisticOf(name, values);
            cell.textContent = value === null ? "-" : name === "count" ? String(value) : format(value, s);
            row.append(cell);
        }
        body.append(row);
    });
    table.append(thead, body);
    return table;
}


/***/ }),
/* 9 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SVG_NS: () => (/* binding */ SVG_NS),
/* harmony export */   node: () => (/* binding */ node)
/* harmony export */ });
// The DOM helpers that the pages of the management and retrieval web applications share: the element builder and the SVG namespace.

/** An element with attributes (a null or undefined value sets none) and children (a null or undefined child is skipped). */
function node(tag, attributes, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes || {})) {
        if (value !== undefined && value !== null) {
            element.setAttribute(key, value);
        }
    }
    element.append(...children.filter((child) => child !== null && child !== undefined));
    return element;
}

const SVG_NS = "http://www.w3.org/2000/svg";


/***/ }),
/* 10 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DASHES: () => (/* reexport safe */ _profile_js__WEBPACK_IMPORTED_MODULE_0__.DASHES),
/* harmony export */   finiteSeries: () => (/* binding */ finiteSeries),
/* harmony export */   lineLook: () => (/* binding */ lineLook),
/* harmony export */   markerPath: () => (/* binding */ markerPath),
/* harmony export */   movingStats: () => (/* binding */ movingStats),
/* harmony export */   splitOnGaps: () => (/* binding */ splitOnGaps)
/* harmony export */ });
/* harmony import */ var _profile_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(11);
// The series of a chart: the samples that count, the gaps between them, the running statistics and the look of a line.



const d3 = globalThis.d3;

// The dash patterns and the colors of the lines come from the display profile in force (see profile.js).


/** The series with the samples whose value is a number; a series left without a sample is dropped. */
function finiteSeries(series) {
    return series.map((s) => ({ ...s, points: s.points.filter((p) => Number.isFinite(p.v)) })).filter((s) => s.points.length);
}

// A line breaks before a point flagged g (the connection was lost before it) and, when gapMs is finite,
// where two points are further apart than gapMs. A monitored PV may be silent for long and keeps its value.
function splitOnGaps(points, gapMs) {
    const parts = [];
    let current = [];
    for (const point of points) {
        const last = current[current.length - 1];
        if (last && (point.g || point.t - last.t > gapMs)) {
            parts.push(current);
            current = [];
        }
        current.push(point);
    }
    if (current.length) {
        parts.push(current);
    }
    return parts;
}

/** The mean and the standard deviation of the last `size` values at each position of values (a shorter window at the start). */
function movingStats(values, size) {
    const out = [];
    for (let i = 0; i < values.length; i += 1) {
        const window = values.slice(Math.max(0, i - size + 1), i + 1);
        const mean = d3.mean(window);
        out.push({ mean, deviation: window.length > 1 ? d3.deviation(window) : 0 });
    }
    return out;
}

/** The look of the line of the series at position slot of a chart: the combination of the profile in force and the width. */
function lineLook(series, slot) {
    const combo = (0,_profile_js__WEBPACK_IMPORTED_MODULE_0__.combination)(slot);
    return { color: combo.color, dash: combo.dash || null, marker: combo.marker, width: series.focus ? 2.5 : series.quiet ? 1.2 : 1.8 };
}

/** The path of the marker of a combination, centered on the origin, by the name of its d3 symbol. */
function markerPath(name, size = 30) {
    const types = { circle: d3.symbolCircle, square: d3.symbolSquare, triangle: d3.symbolTriangle, diamond: d3.symbolDiamond, cross: d3.symbolCross };
    return d3.symbol().type(types[name] || d3.symbolCircle).size(size)();
}


/***/ }),
/* 11 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DASHES: () => (/* binding */ DASHES),
/* harmony export */   FIRM_LINES: () => (/* binding */ FIRM_LINES),
/* harmony export */   MARKERS: () => (/* binding */ MARKERS),
/* harmony export */   PROFILES: () => (/* binding */ PROFILES),
/* harmony export */   combination: () => (/* binding */ combination),
/* harmony export */   currentProfile: () => (/* binding */ currentProfile),
/* harmony export */   mountProfileSelect: () => (/* binding */ mountProfileSelect),
/* harmony export */   mountProfileSelectIn: () => (/* binding */ mountProfileSelectIn),
/* harmony export */   onProfileChange: () => (/* binding */ onProfileChange),
/* harmony export */   profileParameter: () => (/* binding */ profileParameter),
/* harmony export */   setProfile: () => (/* binding */ setProfile),
/* harmony export */   withProfile: () => (/* binding */ withProfile)
/* harmony export */ });
// The display profiles of the charts: for a reader who sees colors as most do (Default), for a reader who cannot tell red
// from green (Red-green) and for a reader who sees no color (Monochrome). A profile is a table of combinations of a color, a
// dash pattern and a marker, one for each line of a chart by its position; no two combinations of a table are alike, and the
// first FIRM_LINES of them also differ from each other in color and in dash pattern, so that a line is told apart by its color
// and its dash without its marker, which a dense line does not show. More lines are supported by adding combinations here.
// The choice is one for the whole application, kept in the browser store, read from the address (parameter `profile`, which
// wins and is kept, as `tz` does), offered in a selection box next to the time zone and announced by an event on document.
// The menu script (js/menu.js of the console) is not a module: it reads the same store key and listens to the same event.

const STORE_KEY = "aa.chartProfile";
const PARAM = "profile";
const EVENT = "aa-chart-profile";
const DEFAULT = "default";

/** The lines of a chart that every profile keeps apart by color and dash pattern alone. */
const FIRM_LINES = 5;

/** The dash patterns, by position; each of the first FIRM_LINES differs from the others. */
const DASHES = ["", "14 4", "6 3", "2 3", "9 3 2 3"];

/** The markers, by position (the names of the d3 symbols). */
const MARKERS = ["circle", "square", "triangle", "diamond", "cross"];

// The combinations of a table: the dash pattern and the marker follow the position; from the sixth combination on the dash
// pattern is moved on by two places when spread is true, for a table whose colors repeat, so that no combination repeats.
function table(colors, spread = false) {
    return colors.map((color, i) => ({
        color,
        dash: DASHES[(i + (spread ? Math.floor(i / FIRM_LINES) * 2 : 0)) % DASHES.length],
        marker: MARKERS[i % MARKERS.length],
    }));
}

// The colors of Red-green were chosen from a grid of colors that have a contrast of at least 3.2:1 against white and against the
// chart background, so that the first five have a CIEDE2000 difference of at least 26 from each other for a reader with normal
// color vision and with protanopia, deuteranopia and tritanopia (the simulations of Machado et al., 2009); the other three keep
// at least 13 from every color before them. The grays of Monochrome are five steps of lightness (CIE L* 0, 14, 28, 43 and 57)
// down to the lightest gray that keeps 3.2:1 against the chart background.
const RED_GREEN = ["#00007a", "#f50000", "#339985", "#c400f5", "#5c1f2b", "#00627a", "#b83d56", "#7a0000"];
const MONOCHROME = ["#000000", "#242424", "#434343", "#656565", "#898989", "#000000", "#242424", "#434343"];

/** The profiles, with the label of the selection box and the table of combinations of each. */
const PROFILES = [
    {
        id: DEFAULT,
        label: "Default",
        combos: table(["#007681", "#5a6b70", "#b36b00", "#6a4c93", "#b3261e", "#2e7d32", "#c2185b", "#1565c0", "#7b5e00", "#455a64"]),
    },
    { id: "redgreen", label: "Red-green", combos: table(RED_GREEN) },
    { id: "mono", label: "Monochrome", combos: table(MONOCHROME, true) },
];

let current = null;

function known(id) {
    return PROFILES.some((profile) => profile.id === id) ? id : DEFAULT;
}

function stored() {
    try {
        return window.localStorage.getItem(STORE_KEY);
    } catch (error) {
        return null;
    }
}

function keep(id) {
    try {
        window.localStorage.setItem(STORE_KEY, id);
    } catch (error) {
        // The choice holds for this visit only.
    }
}

/** The profile in force: the parameter of the address wins and is kept, then the store, then Default. */
function currentProfile() {
    if (current === null) {
        const hash = new URLSearchParams(window.location.hash.slice(1)).get(PARAM);
        const query = new URLSearchParams(window.location.search).get(PARAM);
        const fromAddress = hash || query;
        current = known(fromAddress || stored() || DEFAULT);
        if (fromAddress && known(fromAddress) === fromAddress) {
            keep(current);
        }
    }
    return current;
}

/** Changes the profile, keeps it, and tells the page through the aa-chart-profile event on document. */
function setProfile(id) {
    current = known(id);
    keep(current);
    for (const select of document.querySelectorAll("select.chart-profile")) {
        select.value = current;
    }
    document.dispatchEvent(new CustomEvent(EVENT, { detail: { profile: current } }));
}

/** Calls the function each time the profile changes. */
function onProfileChange(handler) {
    document.addEventListener(EVENT, handler);
}

/** The combination of color, dash pattern and marker of the line at position slot, in the profile in force. */
function combination(slot) {
    const profile = PROFILES.find((p) => p.id === currentProfile());
    return profile.combos[slot % profile.combos.length];
}

/** The address parameter that carries the profile to another page, empty for Default. */
function profileParameter() {
    return currentProfile() === DEFAULT ? "" : `${PARAM}=${encodeURIComponent(currentProfile())}`;
}

/** The address with the profile parameter added when the profile is not Default; an address that has one keeps it. */
function withProfile(address) {
    const parameter = profileParameter();
    if (!parameter || new RegExp(`[?&#]${PARAM}=`).test(address)) {
        return address;
    }
    const hash = address.indexOf("#");
    const base = hash < 0 ? address : address.slice(0, hash);
    const tail = hash < 0 ? "" : address.slice(hash);
    return `${base}${base.includes("?") ? "&" : "?"}${parameter}${tail}`;
}

function build() {
    const select = document.createElement("select");
    select.className = "chart-profile";
    select.id = "chartProfile";
    select.setAttribute("aria-label", "Display profile of the charts");
    select.title = "How the lines of the charts are told apart: Default, Red-green for readers who cannot tell red from green, Monochrome for readers who see no color";
    for (const profile of PROFILES) {
        const option = document.createElement("option");
        option.value = profile.id;
        option.textContent = profile.label;
        select.append(option);
    }
    select.value = currentProfile();
    select.addEventListener("change", () => setProfile(select.value));
    const label = document.createElement("label");
    label.className = "chart-profile";
    label.append(document.createTextNode("Profile "), select);
    return label;
}

/** Puts the selection box in the menu bar of the page before the time zone, once; a page without a menu bar gets none. */
function mountProfileSelect() {
    const nav = document.querySelector("nav.nav");
    if (!nav || nav.querySelector("select.chart-profile")) {
        return;
    }
    nav.insertBefore(build(), nav.querySelector("label.timezone"));
}

/** Puts the selection box at the end of the element, once, for a page that has no menu bar. */
function mountProfileSelectIn(element) {
    if (!element || element.querySelector("select.chart-profile")) {
        return;
    }
    element.append(build());
}

if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mountProfileSelect);
    } else {
        mountProfileSelect();
    }
}


/***/ }),
/* 12 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   axisRoom: () => (/* binding */ axisRoom),
/* harmony export */   labelLayout: () => (/* binding */ labelLayout),
/* harmony export */   labelRoom: () => (/* binding */ labelRoom),
/* harmony export */   labelWidth: () => (/* binding */ labelWidth)
/* harmony export */ });
/* harmony import */ var _options_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6);
/* harmony import */ var _legend_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(8);
/* harmony import */ var _gestures_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(2);
/* harmony import */ var _scales_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(13);
/* harmony import */ var _series_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(10);
/* harmony import */ var _text_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(14);
// The room that a chart leaves for the labels at the end of its lines and for its value axes.

const d3 = globalThis.d3;








/**
 * The width in pixels the end-of-line labels need, measured with the style of a label in the host. A label that is wider
 * than the room the chart leaves would be cut at the edge of the drawing, with the end of the value missing.
 */
function labelWidth(host, texts) {
    const probe = d3.select(host).append("svg").attr("width", 0).attr("height", 0).attr("aria-hidden", "true");
    let widest = 0;
    for (const text of texts) {
        widest = Math.max(widest, probe.append("text").attr("class", "label focus").text(text).node().getComputedTextLength());
    }
    probe.remove();
    return widest;
}

/** The texts of the labels at the end of the lines of a chart and the room they need on the right. */
function labelLayout(host, drawn, width, labelNames) {
    const narrow = width < 560;
    const names = (0,_text_js__WEBPACK_IMPORTED_MODULE_5__.shortNames)(drawn.map((d) => d.name));
    const labelText = (s, i) => {
        const value = (0,_text_js__WEBPACK_IMPORTED_MODULE_5__.format)(s.points[s.points.length - 1].v, "");
        return !labelNames ? value : narrow ? names[i] : `${names[i]}  ${value}`.trim();
    };
    // The widest label and its offset, within a share of the chart, with the earlier fixed size as the least.
    const widest = Math.ceil(labelWidth(host, drawn.map(labelText)));
    const least = labelNames ? (narrow ? 76 : 170) : 70;
    return { names, labelText, widest, right: Math.max(least, Math.min(widest + 12, Math.floor(width * 0.45))) };
}

/**
 * The room on the right of a chart for its labels. Charts drawn one above the other pass the largest of their rooms
 * as input.labelRoom, so that their time axes line up.
 */
function labelRoom(host, input) {
    const drawn = (0,_series_js__WEBPACK_IMPORTED_MODULE_4__.finiteSeries)(input.series);
    if (!drawn.length) {
        return 0;
    }
    return labelLayout(host, drawn, Math.max(320, host.clientWidth || 640), input.labelNames !== false).right;
}

/**
 * The width in pixels the value axes of a chart need for their tick labels. Charts drawn one above the other pass the
 * largest of their widths as input.axisWidth, so that their plots start at the same place.
 */
function axisRoom(host, input) {
    const hidden = _legend_js__WEBPACK_IMPORTED_MODULE_1__.HIDDEN.get(host);
    const all = (0,_series_js__WEBPACK_IMPORTED_MODULE_4__.finiteSeries)(input.series);
    const drawn = input.legend === true && hidden ? all.filter((s) => !hidden.has(s.name)) : all;
    if (!drawn.length) {
        return 0;
    }
    const height = Math.max(200, Math.floor(input.height || 250));
    const tickCount = Math.max(4, Math.round((height - 42) / 48));
    const options = { ..._options_js__WEBPACK_IMPORTED_MODULE_0__.CHART_OPTIONS, ...(input.options || {}) };
    const units = [...new Set(drawn.map((s) => s.egu || ""))];
    const ranges = _gestures_js__WEBPACK_IMPORTED_MODULE_2__.RANGES.get(host) || new Map();
    const top = units.length > 1 ? 30 : 8;
    const scales = new Map(units.map((unit) => {
        const values = drawn.filter((s) => (s.egu || "") === unit).flatMap((s) => s.points.map((p) => p.v));
        return [unit, (0,_scales_js__WEBPACK_IMPORTED_MODULE_3__.makeValueScale)(options.yscale, values, ranges.get(unit), [height - 34, top], unit, tickCount).scale];
    }));
    return (0,_scales_js__WEBPACK_IMPORTED_MODULE_3__.axisWidthOf)(scales, tickCount);
}


/***/ }),
/* 13 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PLOT_LEAST: () => (/* binding */ PLOT_LEAST),
/* harmony export */   SCALE_KINDS: () => (/* binding */ SCALE_KINDS),
/* harmony export */   axisWidthOf: () => (/* binding */ axisWidthOf),
/* harmony export */   makeValueScale: () => (/* binding */ makeValueScale)
/* harmony export */ });
// The value scales of a chart, the least width of its plot and the width of its value axes.

const d3 = globalThis.d3;

// The least width of one value axis with its tick labels, and the width one label character needs at the font of the axes.
const AXIS_WIDTH_LEAST = 56;
const AXIS_CHAR = 8.6;

// The least width in pixels the plot keeps; a chart with more axes than its host holds is made wider than the host.
const PLOT_LEAST = 240;

// The kinds of value scale a unit can be drawn on.
const SCALE_KINDS = ["linear", "symlog", "log", "sqrt"];

/**
 * The value scale of one unit. kind is linear, symlog, log or sqrt. A kind the values do not suit (log needs values
 * above zero, square root values not below zero) falls back to symmetric log with the reason in the result.
 * chosen is a fixed range the viewer dragged out or typed, or undefined; the scale then keeps it (policy fixed).
 * Without it the domain follows the values (policy auto), widened to include the optional soft bounds of
 * settings.soft ([low or null, high or null], policy soft) and, with settings.zero, made symmetric around zero on a
 * linear or symmetric log scale. settings.symlog is the linear-region constant of a symmetric log scale.
 * The result names the policy applied.
 */
function makeValueScale(kind, values, chosen, range, unit, tickCount, settings = {}) {
    let applied = SCALE_KINDS.includes(kind) ? kind : "linear";
    let reason = "";
    const name = unit || "no unit";
    if (applied === "log" && values.some((v) => !(v > 0))) {
        applied = "symlog";
        reason = `${name}: the log scale needs values above zero, so symmetric log is shown.`;
    } else if (applied === "sqrt" && values.some((v) => v < 0)) {
        applied = "symlog";
        reason = `${name}: the square root scale needs values that are not below zero, so symmetric log is shown.`;
    }
    let fixed = chosen;
    if (fixed && ((applied === "log" && Math.min(...fixed) <= 0) || (applied === "sqrt" && Math.min(...fixed) < 0))) {
        fixed = undefined;
    }
    let policy = fixed ? "fixed" : "auto";
    let [low, high] = fixed || d3.extent(values);
    if (!fixed) {
        const given = Array.isArray(settings.soft) ? settings.soft : [null, null];
        // A soft bound outside the domain of the scale (above zero on a log scale, not below zero on a square root
        // scale) would make the domain invalid; the pair is left out and the reason is noted.
        const outside = given.some((bound) => Number.isFinite(bound) && ((applied === "log" && bound <= 0) || (applied === "sqrt" && bound < 0)));
        const soft = outside ? [null, null] : given;
        if (outside) {
            reason = `${name}: the soft bounds are outside the ${applied === "log" ? "log" : "square root"} scale and are not applied.`;
        }
        if (Number.isFinite(soft[0]) || Number.isFinite(soft[1])) {
            policy = "soft";
            if (Number.isFinite(soft[0])) low = Math.min(low, soft[0]);
            if (Number.isFinite(soft[1])) high = Math.max(high, soft[1]);
        }
        const pad = (high - low) * 0.1 || Math.abs(high) * 0.05 || 1;
        if (applied === "log") {
            low /= 1.2;
            high *= 1.2;
        } else {
            // A series that never goes below zero keeps zero as its floor instead of a padded negative value.
            low = values.every((v) => v >= 0) && !(Number.isFinite(soft[0]) && soft[0] < 0) ? Math.max(0, low - pad) : low - pad;
            high += pad;
        }
        // Zero in the middle: the same reach above and below zero, on the scales that hold zero.
        if (settings.zero === true && (applied === "linear" || applied === "symlog")) {
            const reach = Math.max(Math.abs(low), Math.abs(high));
            low = -reach;
            high = reach;
        }
    }
    let scale;
    if (applied === "log") {
        scale = d3.scaleLog();
    } else if (applied === "sqrt") {
        scale = d3.scaleSqrt();
    } else if (applied === "symlog") {
        const constant = Number.isFinite(settings.symlog) && settings.symlog > 0 ? settings.symlog
            : Math.max(Math.abs(high), Math.abs(low)) / 100 || 1;
        scale = d3.scaleSymlog().constant(constant);
    } else {
        scale = d3.scaleLinear();
    }
    scale.domain([low, high]).range(range);
    if (!fixed) {
        scale.nice(tickCount);
    }
    return { scale, kind: applied, reason, policy };
}

/** The width of a value axis for its widest tick label, so that a label such as 1.74e-9 stays clear of the next axis. */
function axisWidthOf(scales, tickCount, formats = new Map()) {
    const chars = Math.max(...[...scales.entries()].flatMap(([unit, scale]) => {
        const format = formats.get(unit) || d3.format(".4~g");
        return scale.ticks(tickCount).map((tick) => format(tick).length);
    }));
    return Math.max(AXIS_WIDTH_LEAST, Math.ceil(chars * AXIS_CHAR) + 14);
}


/***/ }),
/* 14 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   format: () => (/* binding */ format),
/* harmony export */   intervalText: () => (/* binding */ intervalText),
/* harmony export */   shortNames: () => (/* binding */ shortNames),
/* harmony export */   windowLabel: () => (/* binding */ windowLabel)
/* harmony export */ });
/* harmony import */ var _timezone_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(15);


// The texts of a chart: a value with its unit, an interval, the time window and the names of the lines.

/** A value with a precision by magnitude: values below 0.001 in exponent form so that a pressure never reads as 0. */
function format(value, egu) {
    const magnitude = Math.abs(value);
    let text;
    if (value === 0) {
        text = "0";
    } else if (magnitude < 1e-3) {
        text = value.toExponential(2);
    } else {
        text = value.toFixed(magnitude >= 100 ? 1 : magnitude >= 1 ? 3 : 4);
    }
    return `${text}${egu ? ` ${egu}` : ""}`;
}

/** An interval as text: a bracket includes the data at its end and a parenthesis leaves it out, as in [a, b) or (a, b]. */
function intervalText(low, high, lowIncluded, highIncluded, text) {
    return `${lowIncluded ? "[" : "("}${text(low)}, ${text(high)}${highIncluded ? "]" : ")"}`;
}

/**
 * The time window as text. The precision follows the span: seconds up to 10 minutes, minutes above. What both ends share is
 * written once, in front of the brackets: the date when the day is the same and the hour too when that is the same as well;
 * when only the year is the same, the end leaves it out. {text, full} where full is the whole interval for a tooltip.
 */
function windowLabel(from, to, fromIncluded, toIncluded, zone) {
    const pad = (number) => String(number).padStart(2, "0");
    // The fields are read in the chosen zone (Browser and UTC included), so that both ends share the same clock.
    const fields = (date) => {
        const p = (0,_timezone_js__WEBPACK_IMPORTED_MODULE_0__.partsInZone)(date, zone);
        return [p.year, p.month, p.day, p.hour, p.minute, p.second];
    };
    const seconds = to.getTime() - from.getTime() <= 600000;
    const [f, t] = [fields(from), fields(to)];
    const day = (x) => `${x[0]}-${pad(x[1])}-${pad(x[2])}`;
    const clock = (x) => `${pad(x[3])}:${pad(x[4])}${seconds ? `:${pad(x[5])}` : ""}`;
    const open = fromIncluded ? "[" : "(";
    const close = toIncluded ? "]" : ")";
    const full = `${open}${day(f)} ${clock(f)}, ${day(t)} ${clock(t)}${close}`;
    if (f[0] === t[0] && f[1] === t[1] && f[2] === t[2]) {
        if (f[3] === t[3]) {
            const rest = (x) => `${pad(x[4])}${seconds ? `:${pad(x[5])}` : ""}`;
            return { text: `${day(f)} ${pad(f[3])}:${open}${rest(f)}, ${rest(t)}${close}`, full };
        }
        return { text: `${day(f)} ${open}${clock(f)}, ${clock(t)}${close}`, full };
    }
    if (f[0] === t[0]) {
        return { text: `${open}${day(f)} ${clock(f)}, ${pad(t[1])}-${pad(t[2])} ${clock(t)}${close}`, full };
    }
    return { text: full, full };
}

/** Names without the leading segments they all share; a single name stays whole. */
function shortNames(names) {
    if (names.length < 2) {
        return names;
    }
    const parts = names.map((name) => name.split(":"));
    let shared = 0;
    while (shared < Math.min(...parts.map((p) => p.length)) - 1 && parts.every((p) => p[shared] === parts[0][shared])) {
        shared += 1;
    }
    return parts.map((p) => p.slice(shared).join(":"));
}


/***/ }),
/* 15 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ZONES: () => (/* binding */ ZONES),
/* harmony export */   currentZone: () => (/* binding */ currentZone),
/* harmony export */   formatInZone: () => (/* binding */ formatInZone),
/* harmony export */   mountTimeZoneSelect: () => (/* binding */ mountTimeZoneSelect),
/* harmony export */   onZoneChange: () => (/* binding */ onZoneChange),
/* harmony export */   partsInZone: () => (/* binding */ partsInZone),
/* harmony export */   serverStyleText: () => (/* binding */ serverStyleText),
/* harmony export */   setZone: () => (/* binding */ setZone),
/* harmony export */   zoneName: () => (/* binding */ zoneName)
/* harmony export */ });
// The time zone in which the charts and the time texts of the application are written: one choice for the whole application,
// kept in the browser store, offered in a selection box at the right end of the menu bar, and read from the address as tz.
// Browser (the default) and UTC are the zones of the Date object; the five cities are computed with Intl at each instant, so a
// change of daylight saving time inside a window falls at its true place.

const STORE_KEY = "aa.timeZone";
const BROWSER = "browser";
const EVENT = "aa-timezone";

/** The choices of the selection box: the value kept in the store (an IANA identifier, UTC or browser) and the label shown. */
const ZONES = [
    { id: BROWSER, label: "Browser" },
    { id: "UTC", label: "UTC" },
    { id: "America/Los_Angeles", label: "Berkeley" },
    { id: "America/Chicago", label: "Chicago" },
    { id: "America/New_York", label: "NYC" },
    { id: "Asia/Seoul", label: "Seoul" },
    { id: "Europe/Berlin", label: "Berlin" },
];

let current = null;

/** The identifier is one of the choices; anything else reads as the default. */
function known(id) {
    return ZONES.some((zone) => zone.id === id) ? id : BROWSER;
}

function stored() {
    try {
        return window.localStorage.getItem(STORE_KEY);
    } catch (error) {
        return null;
    }
}

/** The zone in force: tz of the address wins and is kept, then the store, then the browser. */
function currentZone() {
    if (current === null) {
        const fromAddress = new URLSearchParams(window.location.hash.slice(1)).get("tz") || new URLSearchParams(window.location.search).get("tz");
        current = known(fromAddress || stored() || BROWSER);
        if (fromAddress && known(fromAddress) === fromAddress) {
            keep(current);
        }
    }
    return current;
}

function keep(id) {
    try {
        window.localStorage.setItem(STORE_KEY, id);
    } catch (error) {
        // The choice holds for this visit only.
    }
}

/** Changes the zone, keeps it, and tells the page through the aa-timezone event on document. */
function setZone(id) {
    current = known(id);
    keep(current);
    for (const select of document.querySelectorAll("select.timezone")) {
        select.value = current;
    }
    document.dispatchEvent(new CustomEvent(EVENT, { detail: { zone: current } }));
}

/** Calls the function each time the zone changes. */
function onZoneChange(handler) {
    document.addEventListener(EVENT, handler);
}

/** The IANA identifier for Intl, undefined for the browser. */
function intlZone(zone) {
    return zone === BROWSER || !zone ? undefined : zone;
}

const partFormatters = new Map();

/** The calendar fields of an instant in the zone: {year, month, day, hour, minute, second}. */
function partsInZone(date, zone) {
    const key = intlZone(zone) || "";
    let formatter = partFormatters.get(key);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: intlZone(zone),
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        partFormatters.set(key, formatter);
    }
    const out = {};
    for (const part of formatter.formatToParts(date)) {
        if (part.type !== "literal") {
            out[part.type] = Number(part.value);
        }
    }
    return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (number) => String(number).padStart(2, "0");

/**
 * Writes an instant in the zone with a pattern of %Y %m %d %b %H %M %S (year, month, day, month name, hour, minute, second);
 * the other characters stay.
 */
function formatInZone(date, pattern, zone) {
    const p = partsInZone(date, zone);
    const values = { Y: String(p.year), m: pad(p.month), d: pad(p.day), b: MONTHS[p.month - 1], H: pad(p.hour), M: pad(p.minute), S: pad(p.second) };
    return pattern.replace(/%([YmdbHMS])/g, (match, letter) => values[letter]);
}

/** The short name of the zone at the instant, such as PDT, UTC or KST; the name of the city when the browser gives none. */
function zoneName(zone, date) {
    try {
        const part = new Intl.DateTimeFormat("en-US", { timeZone: intlZone(zone), timeZoneName: "short" })
            .formatToParts(date || new Date())
            .find((item) => item.type === "timeZoneName");
        if (part && !/^GMT[+-]/.test(part.value)) {
            return part.value;
        }
    } catch (error) {
        // An unknown zone is written by its label below.
    }
    const choice = ZONES.find((item) => item.id === zone);
    return choice ? choice.label : String(zone);
}

/** A time as the server writes it, MMM/dd/yyyy HH:mm:ss and the zone, but in the chosen zone. */
function serverStyleText(epochSeconds, zone) {
    const date = new Date(epochSeconds * 1000);
    return `${formatInZone(date, "%b/%d/%Y %H:%M:%S", zone)} ${zoneName(zone, date)}`;
}

/** Puts the selection box at the right end of the menu bar of the page, once; a page without a menu bar gets none. */
function mountTimeZoneSelect() {
    const nav = document.querySelector("nav.nav");
    if (!nav || nav.querySelector("select.timezone")) {
        return;
    }
    const select = document.createElement("select");
    select.className = "timezone";
    select.id = "timeZone";
    select.setAttribute("aria-label", "Time zone of the charts and the times");
    select.title = "Time zone in which every chart and time of the console is written";
    for (const zone of ZONES) {
        const option = document.createElement("option");
        option.value = zone.id;
        option.textContent = zone.label;
        select.append(option);
    }
    select.value = currentZone();
    select.addEventListener("change", () => setZone(select.value));
    const label = document.createElement("label");
    label.className = "timezone";
    label.append(document.createTextNode("Time zone "), select);
    nav.append(label);
}

if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mountTimeZoneSelect);
    } else {
        mountTimeZoneSelect();
    }
}


/***/ }),
/* 16 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   buildStatistics: () => (/* binding */ buildStatistics)
/* harmony export */ });
/* harmony import */ var _text_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(14);
// The table of basic statistics of the samples in view, one row per drawn line.

const d3 = globalThis.d3;



/**
 * The table of basic statistics of a set of samples, one row per series: samples, minimum, mean, median, maximum,
 * standard deviation and the unit. heading names the set (Statistics unless the page says otherwise).
 */
function buildStatistics(rows, info, heading = "Statistics") {
    const wrap = document.createElement("div");
    wrap.className = "chart-stats-wrap";
    const title = document.createElement("h3");
    title.className = "chart-stats-title";
    title.textContent = heading;
    const table = document.createElement("table");
    table.className = "chart-stats";
    table.setAttribute("aria-label", "Statistics");
    const head = document.createElement("tr");
    for (const title of ["PV", "Samples", "Min", "Mean", "Median", "Max", "Std dev", "Unit"]) {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = title;
        head.append(cell);
    }
    const thead = document.createElement("thead");
    thead.append(head);
    const body = document.createElement("tbody");
    for (const row of rows) {
        const tr = document.createElement("tr");
        const name = document.createElement("td");
        const swatch = document.createElement("span");
        swatch.className = "swatch";
        swatch.style.background = row.color;
        name.append(swatch, document.createTextNode(row.name));
        tr.append(name);
        const values = row.values;
        const cells = values.length
            ? [String(values.length), (0,_text_js__WEBPACK_IMPORTED_MODULE_0__.format)(d3.min(values), ""), (0,_text_js__WEBPACK_IMPORTED_MODULE_0__.format)(d3.mean(values), ""), (0,_text_js__WEBPACK_IMPORTED_MODULE_0__.format)(d3.median(values), ""),
               (0,_text_js__WEBPACK_IMPORTED_MODULE_0__.format)(d3.max(values), ""), (0,_text_js__WEBPACK_IMPORTED_MODULE_0__.format)(d3.deviation(values) || 0, "")]
            : ["0", "-", "-", "-", "-", "-"];
        for (const text of cells) {
            const cell = document.createElement("td");
            cell.className = "num";
            cell.textContent = text;
            tr.append(cell);
        }
        const unit = document.createElement("td");
        unit.textContent = row.egu || "-";
        tr.append(unit);
        body.append(tr);
    }
    table.append(thead, body);
    if (info) {
        title.append(" ", info);
    }
    wrap.append(title, table);
    return wrap;
}


/***/ }),
/* 17 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   buildRangeStrip: () => (/* binding */ buildRangeStrip),
/* harmony export */   keepTipInside: () => (/* binding */ keepTipInside),
/* harmony export */   stripControl: () => (/* binding */ stripControl),
/* harmony export */   stripIcon: () => (/* binding */ stripIcon)
/* harmony export */ });
/* harmony import */ var _dom_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9);
/* harmony import */ var _text_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(14);
/* harmony import */ var _timezone_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(15);
// The range strip above a chart: the time window, the controls that move it and the value ranges chosen on the axes.





// The paths of the icons of the range strip, in a drawing of 24 by 24: earlier, later, back to the chosen range, and a
// value axis.
const STRIP_ICONS = {
    earlier: "M14.5 6.5 9 12l5.5 5.5",
    later: "M9.5 6.5 15 12l-5.5 5.5",
    back: "M4.5 8.5v4h4M5 12.5A7.5 7.5 0 1 0 8 6.5",
    value: "M12 4v16M8.5 7.5 12 4l3.5 3.5M8.5 16.5 12 20l3.5-3.5",
};

/** The icon of a control of the range strip: an SVG drawing of one path that takes the color of the text. */
function stripIcon(pathData) {
    const svg = document.createElementNS(_dom_js__WEBPACK_IMPORTED_MODULE_0__.SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS(_dom_js__WEBPACK_IMPORTED_MODULE_0__.SVG_NS, "path");
    path.setAttribute("d", pathData);
    svg.append(path);
    return svg;
}

/** Moves the tooltip of a control sideways so that it stays inside the box of its chart and inside the window. */
function keepTipInside(button, tip) {
    tip.style.left = "0px";
    const box = tip.getBoundingClientRect();
    const limit = (button.closest(".chart") || document.documentElement).getBoundingClientRect();
    const right = Math.min(limit.right, document.documentElement.clientWidth) - 6;
    const left = Math.max(limit.left, 0) + 6;
    let shift = 0;
    if (box.right > right) {
        shift = right - box.right;
    }
    if (box.left + shift < left) {
        shift = left - box.left;
    }
    tip.style.left = `${shift}px`;
}

/**
 * A control of the range strip: an icon with an optional label and a tooltip on hover and on focus. A control with nothing to
 * do is dim and does not act, but keeps its place and its tooltip.
 */
function stripControl(icon, tip, label, active, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = active ? "strip-tool" : "strip-tool dim";
    button.setAttribute("aria-label", tip);
    button.setAttribute("aria-disabled", String(!active));
    button.append(stripIcon(STRIP_ICONS[icon]));
    if (label) {
        const text = document.createElement("span");
        text.className = "strip-label";
        text.textContent = label;
        button.append(text);
    }
    const tipBox = document.createElement("span");
    tipBox.className = "strip-tip";
    tipBox.setAttribute("role", "tooltip");
    tipBox.textContent = tip;
    button.append(tipBox);
    button.addEventListener("mouseenter", () => keepTipInside(button, tipBox));
    button.addEventListener("focus", () => keepTipInside(button, tipBox));
    button.addEventListener("click", () => {
        if (active) {
            onClick();
        }
    });
    return button;
}

/**
 * The strip above a chart: the time window as an interval with its date and time, the controls that move it and return to
 * the chosen range (when the page gives onPan and onReset), one control for each value axis that names its unit and shows the
 * range chosen on it, and the information control of the page (topic "range"). The strip is always there, so that choosing a
 * range moves nothing; a control with nothing to do is dim.
 */
function buildRangeStrip(input, ranges, units, redraw) {
    const strip = document.createElement("div");
    strip.className = "range-strip";
    const chosen = input.windowChosen === true;
    const time = document.createElement("span");
    time.className = "strip-group";
    if (typeof input.onPan === "function") {
        time.append(stripControl("earlier", "Earlier: move the window back by half its span", "", true, () => input.onPan(-1)));
        time.append(
            stripControl("later", "Later: move the window forward by half its span", "", input.canPanLater === true, () => input.onPan(1))
        );
    }
    if (typeof input.onReset === "function") {
        time.append(stripControl("back", "Back to the selected range", "", chosen, () => input.onReset()));
    }
    const windowText = document.createElement("span");
    windowText.className = "strip-window";
    const label = (0,_text_js__WEBPACK_IMPORTED_MODULE_1__.windowLabel)(input.from, input.to, input.fromIncluded !== false, input.toIncluded !== false, input.timeZone);
    windowText.textContent = label.text;
    windowText.title = label.full;
    time.append(windowText);
    // The zone the window is written in, after the interval, so that a reader in another zone sees which clock it is.
    const zone = document.createElement("span");
    zone.className = "strip-zone";
    zone.textContent = (0,_timezone_js__WEBPACK_IMPORTED_MODULE_2__.zoneName)(input.timeZone, input.to);
    zone.title = "The time zone of the charts and the times; chosen in the menu bar";
    time.append(zone);
    strip.append(time);
    if (input.values === false) {
        return strip;
    }
    const values = document.createElement("span");
    values.className = "strip-group";
    for (const unit of units) {
        const name = unit || "no unit";
        const range = ranges.get(unit);
        values.append(
            stripControl(
                "value",
                range ? `Back to the automatic range of ${name}` : `${name}: drag along its axis to choose a range`,
                name,
                Boolean(range),
                () => {
                    ranges.delete(unit);
                    redraw();
                }
            )
        );
        if (range) {
            const text = document.createElement("span");
            text.className = "strip-range";
            text.textContent = (0,_text_js__WEBPACK_IMPORTED_MODULE_1__.intervalText)(range[0], range[1], true, true, (value) => (0,_text_js__WEBPACK_IMPORTED_MODULE_1__.format)(value, ""));
            values.append(text);
        }
    }
    strip.append(values);
    // One control that returns the time window and every value range at once.
    const anything = chosen || ranges.size > 0;
    strip.append(
        stripControl("back", "Reset all: the time window and every value range", "All", anything, () => {
            ranges.clear();
            redraw();
            if (chosen && typeof input.onReset === "function") {
                input.onReset();
            }
        })
    );
    const info = typeof input.info === "function" ? input.info("range") : null;
    if (info) {
        const spacer = document.createElement("span");
        spacer.className = "strip-spacer";
        strip.append(spacer, info);
    }
    return strip;
}


/***/ }),
/* 18 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   buildCursorTable: () => (/* binding */ buildCursorTable),
/* harmony export */   heldObservation: () => (/* binding */ heldObservation)
/* harmony export */ });
/* harmony import */ var _series_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(10);
/* harmony import */ var _text_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(14);
/* harmony import */ var _timezone_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(15);
// The readout of the reference cursors of a time-series chart: for each drawn series, the observation each cursor
// reads and the differences between the two. A cursor reads the last observation at or before its time, the value the
// step line holds there; a lost connection or a gap wider than the gap threshold between that observation and the
// cursor leaves the reading unavailable, and nothing is interpolated.





const TIME_FORMAT = "%Y-%m-%d %H:%M:%S";

/**
 * The observation of points (sorted by t) that a cursor at time t reads, or null: the last observation at or before t,
 * unless the run of connected samples it belongs to ends before t.
 */
function heldObservation(points, gapMs, t) {
    const parts = (0,_series_js__WEBPACK_IMPORTED_MODULE_0__.splitOnGaps)(points, gapMs);
    for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];
        if (part[0].t > t) {
            return null;
        }
        const next = parts[i + 1];
        if (next && next[0].t <= t) {
            continue;
        }
        const last = part[part.length - 1];
        if (t > last.t && (next || t - last.t > gapMs)) {
            return null;
        }
        let low = 0;
        let high = part.length - 1;
        while (low < high) {
            const mid = (low + high + 1) >> 1;
            if (part[mid].t <= t) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        return part[low];
    }
    return null;
}

/**
 * The table of the cursors: one row per drawn series with the reading of each cursor (value and the time of the
 * observation), and the differences of time and value between the two readings when both exist. gapMs is the gap
 * threshold in milliseconds, or a function of the series that gives it, for a chart whose signals have their own.
 */
function buildCursorTable(drawn, names, cursors, gapMs, timeZone, valueOf = (series, v) => (0,_text_js__WEBPACK_IMPORTED_MODULE_1__.format)(v, series.egu)) {
    const gapOf = typeof gapMs === "function" ? gapMs : () => gapMs;
    const wrap = document.createElement("div");
    wrap.className = "chart-cursors";
    const title = document.createElement("h3");
    title.className = "chart-stats-title";
    title.textContent = "Cursors";
    const table = document.createElement("table");
    table.className = "chart-stats";
    table.setAttribute("aria-label", "Cursor readout");
    const head = document.createElement("tr");
    for (const text of ["PV", "Cursor 1", "Cursor 2", "Time difference", "Value difference"]) {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = text;
        head.append(cell);
    }
    const thead = document.createElement("thead");
    thead.append(head);
    const body = document.createElement("tbody");
    const readingText = (series, observation) => observation
        ? `${valueOf(series, observation.v)} at ${(0,_timezone_js__WEBPACK_IMPORTED_MODULE_2__.formatInZone)(new Date(observation.t), TIME_FORMAT, timeZone)}`
        : "unavailable";
    drawn.forEach((series, index) => {
        const readings = cursors.map((time) => (time === null || time === undefined ? undefined : heldObservation(series.points, gapOf(series), +time)));
        const row = document.createElement("tr");
        const name = document.createElement("td");
        name.textContent = names[index];
        row.append(name);
        for (const reading of readings) {
            const cell = document.createElement("td");
            cell.textContent = reading === undefined ? "-" : readingText(series, reading);
            row.append(cell);
        }
        const [first, second] = readings;
        const both = first && second;
        for (const text of [both ? `${(0,_text_js__WEBPACK_IMPORTED_MODULE_1__.format)((second.t - first.t) / 1000, "s")}` : "-", both ? valueOf(series, second.v - first.v) : "-"]) {
            const cell = document.createElement("td");
            cell.className = "num";
            cell.textContent = text;
            row.append(cell);
        }
        body.append(row);
    });
    table.append(thead, body);
    wrap.append(title, table);
    return wrap;
}


/***/ }),
/* 19 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PROJECTION_WIDTH: () => (/* binding */ PROJECTION_WIDTH),
/* harmony export */   drawProjection: () => (/* binding */ drawProjection)
/* harmony export */ });
/* harmony import */ var _series_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(10);
// The samples in view of each line, the rows of statistics, and the Y projection drawn at the right of the plot.

const d3 = globalThis.d3;



// The Y projection: the room right of the right axes, the bins of a histogram and its longest bar, in pixels.
const PROJECTION_WIDTH = 140;
const PROJECTION_BINS = 24;
const PROJECTION_BAR = 100;

    // The Y projection: for each line the samples in view in bins of the value axis of its unit, drawn as bars growing
    // to the right from the edge of the band, and a line at the mean. The samples in view are those inside the time
    // window and, when the viewer dragged a value range out on the axis of the unit, inside that range.
function drawProjection(svg, { drawn, all, ranges, inView, yOf, projection, width, margin, axisWidth, onRight }) {
    const statistics = [];
    for (const s of drawn) {
        const chosen = ranges.get(s.egu || "");
        const [floor, ceiling] = chosen ? [Math.min(...chosen), Math.max(...chosen)] : [-Infinity, Infinity];
        const values = inView(s).map((p) => p.v).filter((v) => Number.isFinite(v) && v >= floor && v <= ceiling);
        statistics.push({ name: s.name, egu: s.egu, color: (0,_series_js__WEBPACK_IMPORTED_MODULE_0__.lineLook)(s, all.indexOf(s)).color, values });
        if (projection !== true || !values.length) {
            continue;
        }
        const scale = yOf(s);
        const color = (0,_series_js__WEBPACK_IMPORTED_MODULE_0__.lineLook)(s, all.indexOf(s)).color;
        const bandX = width - margin.right + axisWidth * onRight + 14;
        const bins = d3.bin().domain(scale.domain()).thresholds(PROJECTION_BINS)(values);
        const most = Math.max(1, d3.max(bins, (b) => b.length));
        for (const bin of bins) {
            if (!bin.length) {
                continue;
            }
            svg.append("rect")
                .attr("class", "proj")
                .attr("x", bandX)
                .attr("y", Math.min(scale(bin.x0), scale(bin.x1)))
                .attr("width", (bin.length / most) * PROJECTION_BAR)
                .attr("height", Math.max(1, Math.abs(scale(bin.x0) - scale(bin.x1)) - 1))
                .style("fill", color)
                .style("stroke", color);
        }
        const mean = d3.mean(values);
        const [low, high] = d3.extent(scale.domain());
        if (mean >= low && mean <= high) {
            svg.append("line")
                .attr("class", "proj-mean")
                .attr("x1", bandX - 8)
                .attr("x2", bandX + PROJECTION_BAR)
                .attr("y1", scale(mean))
                .attr("y2", scale(mean))
                .style("stroke", color);
        }
    }
    return statistics;
}


/***/ }),
/* 20 */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   infoButton: () => (/* binding */ infoButton)
/* harmony export */ });
/* harmony import */ var _dom_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9);
// The information control of the pages: a small button with an italic "i" that opens a card with the text, what to do and a link into
// the help page. One card is open at a time; it closes with Esc, a click outside, a scroll of a box inside the page, and it moves with a resize.


let openTitle = null;
let openCard = null;

function closeCard() {
    if (openCard) {
        openCard.card.remove();
        openCard.button.setAttribute("aria-expanded", "false");
        openCard.button.classList.remove("on");
        openCard = null;
    }
    openTitle = null;
}

function placeCard(button, card) {
    const box = button.getBoundingClientRect();
    // The card is as wide as the text wants, up to 340 px, and never wider than the page without its scrollbar.
    const width = Math.min(card.classList.contains("wide") ? 420 : 340, document.documentElement.clientWidth - 16);
    card.style.width = `${width}px`;
    // The place is worked out in the window and then shifted into the coordinates of the element the card sits in: the
    // page itself, or a positioned parent such as the box of a chart or a dialog.
    const parent = card.offsetParent;
    const inPage = !parent || parent === document.body || parent === document.documentElement;
    const base = inPage ? { left: -window.scrollX, top: -window.scrollY } : parent.getBoundingClientRect();
    const inset = inPage ? { left: 0, top: 0 } : { left: parent.clientLeft - parent.scrollLeft, top: parent.clientTop - parent.scrollTop };
    const viewLeft = Math.min(Math.max(8, box.left + box.width / 2 - 24), document.documentElement.clientWidth - width - 8);
    // The card opens below its button, or above it when it does not fit below and does fit above. A card that fits on
    // neither side is as tall as the window allows, scrolls inside, and lies within the window without its arrow.
    card.style.maxHeight = `${window.innerHeight - 16}px`;
    const height = card.offsetHeight;
    const below = box.bottom + 8;
    const above = box.top - 8 - height;
    const fitsBelow = below + height <= window.innerHeight - 8;
    const flip = !fitsBelow && above >= 8;
    const free = !fitsBelow && !flip;
    const top = free ? Math.max(8, window.innerHeight - 8 - height) : flip ? above : below;
    card.classList.toggle("above", flip);
    card.classList.toggle("free", free);
    card.style.left = `${viewLeft - base.left - inset.left}px`;
    card.style.top = `${top - base.top - inset.top}px`;
    card.style.setProperty("--arrow", `${box.left + box.width / 2 - viewLeft - 6}px`);
}

function showCard(button, title, text, action, helpHref) {
    closeCard();
    const help = typeof helpHref === "function" ? helpHref() : helpHref;
    const rows = Array.isArray(text);
    const body = rows
        ? (0,_dom_js__WEBPACK_IMPORTED_MODULE_0__.node)("dl", { class: "rows" }, ...text.flatMap(([term, detail]) => [(0,_dom_js__WEBPACK_IMPORTED_MODULE_0__.node)("dt", null, term), (0,_dom_js__WEBPACK_IMPORTED_MODULE_0__.node)("dd", null, detail)]))
        : (0,_dom_js__WEBPACK_IMPORTED_MODULE_0__.node)("p", null, text);
    const card = (0,_dom_js__WEBPACK_IMPORTED_MODULE_0__.node)("div", { class: rows ? "card wide" : button.classList.contains("small") ? "card narrow" : "card", role: "dialog", "aria-label": title, id: "infoCard" },
        (0,_dom_js__WEBPACK_IMPORTED_MODULE_0__.node)("h4", null, title),
        body,
        action ? (0,_dom_js__WEBPACK_IMPORTED_MODULE_0__.node)("p", { class: "act" }, action) : null,
        (0,_dom_js__WEBPACK_IMPORTED_MODULE_0__.node)("div", { class: "foot" }, help ? (0,_dom_js__WEBPACK_IMPORTED_MODULE_0__.node)("a", { href: help }, "More in Help") : null,
            (0,_dom_js__WEBPACK_IMPORTED_MODULE_0__.node)("button", { type: "button", class: "plain close" }, "Close")),
    );
    card.querySelector(".close").addEventListener("click", () => {
        const owner = openCard && openCard.button;
        closeCard();
        if (owner) {
            owner.focus();
        }
    });
    // The box of a chart clips what overflows it, so the card of a control inside one is placed after the box.
    (button.closest(".chart") || button).insertAdjacentElement("afterend", card);
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-controls", "infoCard");
    button.classList.add("on");
    openCard = { card, button };
    openTitle = title;
    placeCard(button, card);
}

// Esc closes the card and nothing else: inside a dialog the default action of the key would close the dialog too.
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openCard) {
        event.preventDefault();
        const owner = openCard.button;
        closeCard();
        owner.focus();
    }
});
document.addEventListener("click", (event) => {
    if (openCard && !openCard.card.contains(event.target) && !openCard.button.contains(event.target)) {
        closeCard();
    }
});
// A table that scrolls sideways moves the button from under its card; the card is closed then. Page scrolling is
// not a reason: the card scrolls with the page.
document.addEventListener(
    "scroll",
    (event) => {
        if (openCard && event.target !== document && event.target !== document.documentElement) {
            closeCard();
        }
    },
    true,
);
window.addEventListener("resize", () => {
    if (openCard) {
        placeCard(openCard.button, openCard.card);
    }
});

// The italic serif "i" of the information control as an SVG path (the outline of the letter i of Noto Serif Bold Italic,
// SIL Open Font License 1.1), so that the mark looks the same on every platform whatever fonts it has.
const INFO_GLYPH_PATH =
    "M12.82 6.48Q12.08 6.48 11.57 6.13Q11.07 5.79 11.07 5.09Q11.07 4.1 11.7 3.68Q12.33 3.25 13.16 3.25Q13.87 3.25 14.41 3.58" +
    "Q14.95 3.9 14.95 4.66Q14.95 5.58 14.29 6.03Q13.63 6.48 12.82 6.48ZM11.72 20.75Q10.44 20.75 9.75 20.13Q9.05 19.52 9.05 18.44" +
    "Q9.05 17.97 9.14 17.29Q9.23 16.62 9.41 15.77L10.28 11.6Q10.35 11.3 10.4 11.01Q10.44 10.72 10.44 10.63Q10.44 10.03 10.17 9.86" +
    "Q9.9 9.69 9.25 9.69H8.85L9.07 8.5H14.37L12.82 15.79Q12.68 16.4 12.59 16.94Q12.5 17.47 12.5 17.95Q12.5 18.96 13.29 18.96" +
    "Q13.65 18.96 13.94 18.82Q14.23 18.69 14.61 18.44L15.15 19.2Q14.61 19.76 13.78 20.26Q12.95 20.75 11.72 20.75Z";

/** The SVG element of the "i" of an information control, built from the path above. */
function infoGlyph() {
    const svg = document.createElementNS(_dom_js__WEBPACK_IMPORTED_MODULE_0__.SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS(_dom_js__WEBPACK_IMPORTED_MODULE_0__.SVG_NS, "path");
    path.setAttribute("d", INFO_GLYPH_PATH);
    svg.append(path);
    return svg;
}

/**
 * An information control: a small raised button with an italic "i" that opens a card with the text (one paragraph, or
 * rows of a term and its text), what to do about it and a link into the help page. The card stays open across a
 * refresh of the page that rebuilds its button. With small set, the control is the quiet one of a table row, and its
 * card is the narrow one of a single sentence.
 * helpHref is an address or a function resolving it when the card opens; no address leaves out the Help link.
 */
function infoButton(title, text, action, helpHref, small) {
    const button = (0,_dom_js__WEBPACK_IMPORTED_MODULE_0__.node)("button", { type: "button", class: small ? "info small" : "info", "aria-expanded": "false", "aria-label": `About ${title}` }, infoGlyph());
    button.addEventListener("click", () => {
        if (openCard && openCard.button === button) {
            closeCard();
        } else {
            showCard(button, title, text, action, helpHref);
        }
    });
    if (openTitle === title) {
        requestAnimationFrame(() => {
            if (button.isConnected) {
                showCard(button, title, text, action, helpHref);
            }
        });
    }
    return button;
}


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	// define getter/value functions for harmony exports
/******/ 	__webpack_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop));
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = (exports) => {
/******/ 		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/ 	
/************************************************************************/
let __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   buildCanvasControls: () => (/* reexport safe */ _src_main_org_epics_archiverappliance_staticcontent_js_aa_chart_canvas_js__WEBPACK_IMPORTED_MODULE_0__.buildCanvasControls),
/* harmony export */   createHoverTip: () => (/* reexport safe */ _src_main_org_epics_archiverappliance_staticcontent_js_aa_chart_hover_js__WEBPACK_IMPORTED_MODULE_4__.createHoverTip),
/* harmony export */   createPlotCanvas: () => (/* reexport safe */ _src_main_org_epics_archiverappliance_staticcontent_js_aa_chart_canvas_js__WEBPACK_IMPORTED_MODULE_0__.createPlotCanvas),
/* harmony export */   drawTimeSeries: () => (/* reexport safe */ _src_main_org_epics_archiverappliance_staticcontent_js_aa_chart_draw_js__WEBPACK_IMPORTED_MODULE_1__.drawTimeSeries),
/* harmony export */   infoButton: () => (/* reexport safe */ _src_main_org_epics_archiverappliance_staticcontent_js_aa_card_js__WEBPACK_IMPORTED_MODULE_3__.infoButton),
/* harmony export */   preserveViewport: () => (/* reexport safe */ _src_main_org_epics_archiverappliance_staticcontent_js_aa_chart_viewport_js__WEBPACK_IMPORTED_MODULE_5__.preserveViewport),
/* harmony export */   setProfile: () => (/* reexport safe */ _src_main_org_epics_archiverappliance_staticcontent_js_aa_chart_profile_js__WEBPACK_IMPORTED_MODULE_2__.setProfile)
/* harmony export */ });
/* harmony import */ var _src_main_org_epics_archiverappliance_staticcontent_js_aa_chart_canvas_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var _src_main_org_epics_archiverappliance_staticcontent_js_aa_chart_draw_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(5);
/* harmony import */ var _src_main_org_epics_archiverappliance_staticcontent_js_aa_chart_profile_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(11);
/* harmony import */ var _src_main_org_epics_archiverappliance_staticcontent_js_aa_card_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(20);
/* harmony import */ var _src_main_org_epics_archiverappliance_staticcontent_js_aa_chart_hover_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3);
/* harmony import */ var _src_main_org_epics_archiverappliance_staticcontent_js_aa_chart_viewport_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(7);
// The offline bundle compiles the production modules without copying their implementation.







})();

SharedChart = __webpack_exports__;
/******/ })()
;