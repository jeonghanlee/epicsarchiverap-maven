import { currentZone, formatInZone } from "../../comm/js/aa/timezone.js";

// How the table of PVs writes a sample value and the time of a sample.
// The record types of the archiver whose values are whole numbers.
const WHOLE_TYPES = /(INT|SHORT|BYTE|ENUM|LONG)/;

/**
 * A value as the table writes it. A number is split into its whole part and the rest (the decimal point and what follows),
 * so that the rows of a column line up on the decimal point; a value that is not a finite number is one piece of text and an
 * array reads "array of N". dbrType is the record type of the sample (meta.DBRType), which tells a whole-number type from a
 * floating-point one.
 */
export function valueParts(value, dbrType) {
    if (Array.isArray(value)) {
        return { text: `array of ${value.length}` };
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return { text: value === null || value === undefined ? "" : String(value) };
    }
    if (WHOLE_TYPES.test(dbrType || "") && Number.isInteger(value)) {
        return { whole: String(value), rest: "" };
    }
    const magnitude = Math.abs(value);
    let text;
    if (magnitude !== 0 && (magnitude >= 1e9 || magnitude < 0.001)) {
        text = value.toExponential(2);
    } else {
        text = value.toFixed(magnitude >= 100 ? 1 : magnitude >= 1 ? 3 : 4);
    }
    const dot = text.indexOf(".");
    return dot < 0 ? { whole: text, rest: "" } : { whole: text.slice(0, dot), rest: text.slice(dot) };
}

/** The date and time of a sample as Mon/DD/YYYY hh:mm:ss in the time zone of the browser. */
export function dateTimeText(seconds) {
    return formatInZone(new Date(seconds * 1000), "%b/%d/%Y %H:%M:%S", currentZone());
}

/** The instant of a sample written in UTC to the millisecond, with the zone the table shows it in. */
export function instantTitle(seconds, nanos) {
    const instant = new Date(seconds * 1000 + Math.floor((nanos || 0) / 1e6)).toISOString();
    const zone = currentZone() === "browser" ? Intl.DateTimeFormat().resolvedOptions().timeZone : currentZone();
    return `${instant} (UTC); shown in ${zone}`;
}
