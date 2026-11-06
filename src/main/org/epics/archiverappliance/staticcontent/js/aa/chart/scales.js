// The value scales of a chart, the least width of its plot and the width of its value axes.

const d3 = globalThis.d3;

// The least width of one value axis with its tick labels, and the width one label character needs at the font of the axes.
const AXIS_WIDTH_LEAST = 56;
const AXIS_CHAR = 8.6;

// The least width in pixels the plot keeps; a chart with more axes than its host holds is made wider than the host.
export const PLOT_LEAST = 240;

// The kinds of value scale a unit can be drawn on.
export const SCALE_KINDS = ["linear", "symlog", "log", "sqrt"];

/**
 * The value scale of one unit. kind is linear, symlog, log or sqrt. A kind the values do not suit (log needs values
 * above zero, square root values not below zero) falls back to symmetric log with the reason in the result.
 * chosen is a fixed range the viewer dragged out or typed, or undefined; the scale then keeps it (policy fixed).
 * Without it the domain follows the values (policy auto), widened to include the optional soft bounds of
 * settings.soft ([low or null, high or null], policy soft) and, with settings.zero, made symmetric around zero on a
 * linear or symmetric log scale. settings.symlog is the linear-region constant of a symmetric log scale.
 * The result names the policy applied.
 */
export function makeValueScale(kind, values, chosen, range, unit, tickCount, settings = {}) {
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
export function axisWidthOf(scales, tickCount, formats = new Map()) {
    const chars = Math.max(...[...scales.entries()].flatMap(([unit, scale]) => {
        const format = formats.get(unit) || d3.format(".4~g");
        return scale.ticks(tickCount).map((tick) => format(tick).length);
    }));
    return Math.max(AXIS_WIDTH_LEAST, Math.ceil(chars * AXIS_CHAR) + 14);
}
