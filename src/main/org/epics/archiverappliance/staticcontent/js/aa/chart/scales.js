// The value scales of a chart, the least width of its plot and the width of its value axes.

const d3 = globalThis.d3;

// The least width of one value axis with its tick labels, and the width one label character needs at the font of the axes.
const AXIS_WIDTH_LEAST = 56;
const AXIS_CHAR = 8.6;

// The least width in pixels the plot keeps; a chart with more axes than its host holds is made wider than the host.
export const PLOT_LEAST = 240;

/**
 * The value scale of one unit. kind is linear, symlog, log or sqrt. A kind the values do not suit (log needs values
 * above zero, square root values not below zero) falls back to symmetric log with the reason in the result.
 * chosen is a value range the viewer dragged out, or undefined.
 */
export function makeValueScale(kind, values, chosen, range, unit, tickCount) {
    let applied = kind;
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
    let [low, high] = fixed || d3.extent(values);
    if (!fixed) {
        const pad = (high - low) * 0.1 || Math.abs(high) * 0.05 || 1;
        if (applied === "log") {
            low /= 1.2;
            high *= 1.2;
        } else {
            // A series that never goes below zero keeps zero as its floor instead of a padded negative value.
            low = values.every((v) => v >= 0) ? Math.max(0, low - pad) : low - pad;
            high += pad;
        }
    }
    let scale;
    if (applied === "log") {
        scale = d3.scaleLog();
    } else if (applied === "sqrt") {
        scale = d3.scaleSqrt();
    } else if (applied === "symlog") {
        scale = d3.scaleSymlog().constant(Math.max(Math.abs(high), Math.abs(low)) / 100 || 1);
    } else {
        scale = d3.scaleLinear();
    }
    scale.domain([low, high]).range(range);
    if (!fixed) {
        scale.nice(tickCount);
    }
    return { scale, kind: applied, reason };
}

/** The width of a value axis for its widest tick label, so that a label such as 1.74e-9 stays clear of the next axis. */
export function axisWidthOf(scales, tickCount) {
    const chars = Math.max(...scales.flatMap((scale) => scale.ticks(tickCount).map((tick) => d3.format(".4~g")(tick).length)));
    return Math.max(AXIS_WIDTH_LEAST, Math.ceil(chars * AXIS_CHAR) + 14);
}
