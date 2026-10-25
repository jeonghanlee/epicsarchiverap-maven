import { partsInZone } from "../timezone.js";

// The texts of a chart: a value with its unit, an interval, the time window and the names of the lines.

/** A value with a precision by magnitude: values below 0.001 in exponent form so that a pressure never reads as 0. */
export function format(value, egu) {
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
export function intervalText(low, high, lowIncluded, highIncluded, text) {
    return `${lowIncluded ? "[" : "("}${text(low)}, ${text(high)}${highIncluded ? "]" : ")"}`;
}

/**
 * The time window as text. The precision follows the span: seconds up to 10 minutes, minutes above. What both ends share is
 * written once, in front of the brackets: the date when the day is the same and the hour too when that is the same as well;
 * when only the year is the same, the end leaves it out. {text, full} where full is the whole interval for a tooltip.
 */
export function windowLabel(from, to, fromIncluded, toIncluded, zone) {
    const pad = (number) => String(number).padStart(2, "0");
    // The fields are read in the chosen zone (Browser and UTC included), so that both ends share the same clock.
    const fields = (date) => {
        const p = partsInZone(date, zone);
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
export function shortNames(names) {
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
