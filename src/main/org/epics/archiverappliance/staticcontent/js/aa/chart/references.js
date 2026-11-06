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
export function drawReferences(surface, host, input) {
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
