// Shared value tooltip and pointer geometry; callers supply the actual observations and their labels.
const d3 = globalThis.d3;
const TIP_GAP = 12;
const TIP_WIDTH = 300;

/** A text-only tooltip inside a positioned host. show accepts client coordinates and {title, rows}. */
export function createHoverTip(host) {
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
export function bindPlotHover(surface, host, pick) {
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
