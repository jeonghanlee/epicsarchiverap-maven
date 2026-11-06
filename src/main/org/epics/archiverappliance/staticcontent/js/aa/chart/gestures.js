// The pointer, wheel, touch and keyboard gestures of a chart. Navigation (pan, Ctrl+wheel, pinch) runs through d3.zoom,
// a drag over the plot (the time window, a box zoom or a candidate selection) through d3.brush, a drag or the keys along
// an axis choose the value range of that axis, and a double-click returns to the automatic ranges. The caller owns the
// active tool, the ranges, the candidate selection and the redraw; this module reports completed gestures only.

const d3 = globalThis.d3;

// The value ranges a viewer chose by a drag along an axis, by unit, kept per chart host across redraws.
export const RANGES = new WeakMap();

// The navigation behavior of each chart host, installed once and shared by the drawings that replace one another in it:
// a gesture that starts on one drawing continues over the drawings that redraw under it.
const NAVIGATION = new WeakMap();

// The tools a drag over the plot can serve. A caller without a tool keeps the simple form of the console: a drag chooses
// the time window.
export const TOOLS = ["select", "pan", "box"];

// The axes navigation can move: x alone, one value axis, or both.
export const NAVIGATION_TARGETS = ["x", "y", "xy"];

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
function navigationOf(host) {
    let entry = NAVIGATION.get(host);
    if (entry) {
        return entry;
    }
    entry = { context: null, gesture: null, brushing: false, touchNavigated: false, brushCut: false, frame: 0 };
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
    const keepTouchNode = (gesture) => {
        const node = gesture.touchNode;
        if (node && !node.isConnected) {
            node.style.display = "none";
            node.setAttribute("aria-hidden", "true");
            host.append(node);
        }
    };
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
            const byTouch = Boolean(event.sourceEvent && event.sourceEvent.type === "touchstart");
            // The browser delivers the rest of a touch gesture to the element it began on. A redraw replaces that
            // drawing, so the old one stays in the host, hidden, until the gesture ends; its events then still reach
            // the host. A mouse gesture needs none of this: d3.zoom follows it on the window.
            entry.gesture = { context, start: event.transform, x: scales.x, y: scales.y, touchNode: byTouch ? context.svg : null };
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
                    keepTouchNode(live);
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
            if (gesture.touchNode) {
                gesture.touchNode.remove();
            }
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
        context.brushLayer.on(".brush", null);
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
export function attachGestures({ svg, host, input, redraw, preview, x, scales, units, ranges, width, height, margin, plotTop, axisWidth, onLeft, onRight, axisAt }) {
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
                }
            })
            .on("end", (event) => {
                // A move by the program (restoring the selection, clearing it) has no source event and reports nothing.
                if (!event.sourceEvent) {
                    return;
                }
                navigation.brushing = false;
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
