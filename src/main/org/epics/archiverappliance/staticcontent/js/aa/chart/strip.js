// The range strip above a chart: the time window, the controls that move it and the value ranges chosen on the axes.

import { SVG_NS } from "../dom.js";
import { format, intervalText, windowLabel } from "./text.js";
import { zoneName } from "../timezone.js";

// The paths of the icons of the range strip, in a drawing of 24 by 24: earlier, later, back to the chosen range, and a
// value axis.
const STRIP_ICONS = {
    earlier: "M14.5 6.5 9 12l5.5 5.5",
    later: "M9.5 6.5 15 12l-5.5 5.5",
    back: "M4.5 8.5v4h4M5 12.5A7.5 7.5 0 1 0 8 6.5",
    value: "M12 4v16M8.5 7.5 12 4l3.5 3.5M8.5 16.5 12 20l3.5-3.5",
};

/** The icon of a control of the range strip: an SVG drawing of one path that takes the color of the text. */
export function stripIcon(pathData) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", pathData);
    svg.append(path);
    return svg;
}

/** Moves the tooltip of a control sideways so that it stays inside the box of its chart and inside the window. */
export function keepTipInside(button, tip) {
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
export function stripControl(icon, tip, label, active, onClick) {
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
export function buildRangeStrip(input, ranges, units, redraw) {
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
    const label = windowLabel(input.from, input.to, input.fromIncluded !== false, input.toIncluded !== false, input.timeZone);
    windowText.textContent = label.text;
    windowText.title = label.full;
    time.append(windowText);
    // The zone the window is written in, after the interval, so that a reader in another zone sees which clock it is.
    const zone = document.createElement("span");
    zone.className = "strip-zone";
    zone.textContent = zoneName(input.timeZone, input.to);
    zone.title = "The time zone of the charts and the times; chosen in the menu bar";
    time.append(zone);
    strip.append(time);
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
            text.textContent = intervalText(range[0], range[1], true, true, (value) => format(value, ""));
            values.append(text);
        }
    }
    strip.append(values);
    // One control that returns the time window and every value range at once.
    const anything = chosen || ranges.size > 0;
    strip.append(
        stripControl("back", "Reset all: the time window and every value range", "All", anything, () => {
            ranges.clear();
            if (chosen && typeof input.onReset === "function") {
                input.onReset();
            } else {
                redraw();
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
