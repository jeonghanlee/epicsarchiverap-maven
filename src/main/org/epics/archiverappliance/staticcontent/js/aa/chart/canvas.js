// Reusable SVG plot surface. Callers supply scales and data layers; the surface owns axes, clipping and input geometry.
import { attachGestures } from "./gestures.js";
import { bindPlotHover } from "./hover.js";
import { drawReferences } from "./references.js";

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
export function createPlotCanvas(config) {
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
        attachGestures({ svg, host, input, redraw, preview, x, scales, units, ranges: input.ranges,
            width, height, margin, plotTop, axisWidth, onLeft, onRight, axisAt });
        drawReferences(surface, host, input);
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
        bindHover(host, pick) { hover?.destroy(); hover = bindPlotHover(surface, host, pick); return hover; },
        destroy() { hover?.destroy(); svg.remove(); } };
    return surface;
}

/** Optional navigation controls. Domain values stay in the scale's native numeric or Date form. */
export function buildCanvasControls(x, onZoom, onReset) {
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
