// The legend under a chart and the names of the lines a viewer has hidden through it.

import { SVG_NS } from "../dom.js";
import { lineLook } from "./series.js";

// The names of the lines a viewer has hidden through the legend, kept per chart host across redraws.
export const HIDDEN = new WeakMap();

/** The legend under a chart: one button per series with its line, name and unit; a click hides or shows that line. */
export function buildLegend(host, all, hidden, redraw) {
    const box = document.createElement("div");
    box.className = "legend";
    box.setAttribute("aria-label", "Legend");
    all.forEach((s, slot) => {
        const off = hidden.has(s.name);
        const look = lineLook(s, slot);
        const item = document.createElement("button");
        item.type = "button";
        item.className = "item";
        item.dataset.series = s.name;
        item.setAttribute("aria-pressed", String(!off));
        item.title = `${off ? "Show" : "Hide"} ${s.name}`;
        const swatch = document.createElementNS(SVG_NS, "svg");
        swatch.setAttribute("width", "30");
        swatch.setAttribute("height", "10");
        swatch.setAttribute("aria-hidden", "true");
        const line = document.createElementNS(SVG_NS, "line");
        for (const [name, value] of [["x1", "1"], ["x2", "29"], ["y1", "5"], ["y2", "5"], ["stroke", look.color], ["stroke-width", String(look.width)]]) {
            line.setAttribute(name, value);
        }
        if (look.dash) {
            line.setAttribute("stroke-dasharray", look.dash);
        }
        swatch.append(line);
        item.append(swatch, document.createTextNode(s.name));
        if (s.egu) {
            const unit = document.createElement("span");
            unit.className = "unit";
            unit.textContent = s.egu;
            item.append(" ", unit);
        }
        item.addEventListener("click", () => {
            if (hidden.has(s.name)) {
                hidden.delete(s.name);
            } else {
                hidden.add(s.name);
            }
            redraw();
            // The redraw replaced the buttons; the keyboard stays on the item that was pressed.
            for (const button of host.querySelectorAll(".legend button")) {
                if (button.dataset.series === s.name) {
                    button.focus();
                }
            }
        });
        box.append(item);
    });
    return box;
}
