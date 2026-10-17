// The pointer and keyboard gestures of a chart: a drag across the plot, a drag or the keys along an axis, and a double-click.

// The value ranges a viewer chose by a drag along an axis, by unit, kept per chart host across redraws.
export const RANGES = new WeakMap();

// A drag shorter than this many pixels is a click and chooses nothing.
const DRAG_LEAST = 6;

export function attachGestures({ svg, host, input, redraw, x, scales, units, ranges, width, height, margin, plotTop, axisWidth, onLeft, onRight, axisAt }) {
    // A drag across the plot asks the page for that time window (when it passes onZoom); a drag along an axis chooses
    // the value range of that axis and redraws at once; a short click chooses nothing; a double-click returns to the
    // automatic value ranges and, through onReset, to the time window the page was asked for first.
    const plotBottom = height - margin.bottom;
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
    const band = svg.append("rect").attr("class", "brush").attr("visibility", "hidden");
    const pointAt = (event) => {
        const box = svg.node().getBoundingClientRect();
        return [((event.clientX - box.left) / box.width) * width, ((event.clientY - box.top) / box.height) * height];
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
    let drag = null;
    svg.style("touch-action", "pan-y");
    svg.on("pointermove.cursor", (event) => {
        const [px, py] = pointAt(event);
        svg.style("cursor", axisIndexAt(px, py) >= 0 ? "ns-resize" : null);
    });
    svg.on("pointerdown", (event) => {
        if (event.button !== 0) {
            return;
        }
        const [px, py] = pointAt(event);
        const inPlot = px > margin.left - 1 && px < width - margin.right + 1 && py >= plotTop && py <= plotBottom;
        const index = inPlot ? -1 : axisIndexAt(px, py);
        if (inPlot && typeof input.onZoom === "function") {
            drag = { kind: "x", start: clamp(px, margin.left, width - margin.right) };
        } else if (index >= 0) {
            drag = { kind: "y", start: clamp(py, plotTop, plotBottom), index };
        } else {
            return;
        }
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
        const [px, py] = pointAt(event);
        if (drag.kind === "x") {
            const now = clamp(px, margin.left, width - margin.right);
            band.attr("visibility", "visible").attr("x", Math.min(drag.start, now)).attr("width", Math.abs(now - drag.start))
                .attr("y", plotTop).attr("height", plotBottom - plotTop);
        } else {
            const { rightSide, x: axisX } = axisAt(drag.index);
            const now = clamp(py, plotTop, plotBottom);
            band.attr("visibility", "visible").attr("x", rightSide ? axisX : axisX - axisWidth).attr("width", axisWidth)
                .attr("y", Math.min(drag.start, now)).attr("height", Math.abs(now - drag.start));
        }
    });
    svg.on("pointerup", (event) => {
        if (drag === null) {
            return;
        }
        const chosen = drag;
        drag = null;
        band.attr("visibility", "hidden");
        const [px, py] = pointAt(event);
        if (chosen.kind === "x") {
            const now = clamp(px, margin.left, width - margin.right);
            if (Math.abs(now - chosen.start) >= DRAG_LEAST + 2) {
                input.onZoom(x.invert(Math.min(chosen.start, now)), x.invert(Math.max(chosen.start, now)));
            }
            return;
        }
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
                            element.focus();
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
