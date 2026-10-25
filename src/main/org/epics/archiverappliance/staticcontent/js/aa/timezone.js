// The time zone in which the charts and the time texts of the application are written: one choice for the whole application,
// kept in the browser store, offered in a selection box at the right end of the menu bar, and read from the address as tz.
// Browser (the default) and UTC are the zones of the Date object; the five cities are computed with Intl at each instant, so a
// change of daylight saving time inside a window falls at its true place.

const STORE_KEY = "aa.timeZone";
const BROWSER = "browser";
const EVENT = "aa-timezone";

/** The choices of the selection box: the value kept in the store (an IANA identifier, UTC or browser) and the label shown. */
export const ZONES = [
    { id: BROWSER, label: "Browser" },
    { id: "UTC", label: "UTC" },
    { id: "America/Los_Angeles", label: "Berkeley" },
    { id: "America/Chicago", label: "Chicago" },
    { id: "America/New_York", label: "NYC" },
    { id: "Asia/Seoul", label: "Seoul" },
    { id: "Europe/Berlin", label: "Berlin" },
];

let current = null;

/** The identifier is one of the choices; anything else reads as the default. */
function known(id) {
    return ZONES.some((zone) => zone.id === id) ? id : BROWSER;
}

function stored() {
    try {
        return window.localStorage.getItem(STORE_KEY);
    } catch (error) {
        return null;
    }
}

/** The zone in force: tz of the address wins and is kept, then the store, then the browser. */
export function currentZone() {
    if (current === null) {
        const fromAddress = new URLSearchParams(window.location.hash.slice(1)).get("tz") || new URLSearchParams(window.location.search).get("tz");
        current = known(fromAddress || stored() || BROWSER);
        if (fromAddress && known(fromAddress) === fromAddress) {
            keep(current);
        }
    }
    return current;
}

function keep(id) {
    try {
        window.localStorage.setItem(STORE_KEY, id);
    } catch (error) {
        // The choice holds for this visit only.
    }
}

/** Changes the zone, keeps it, and tells the page through the aa-timezone event on document. */
export function setZone(id) {
    current = known(id);
    keep(current);
    for (const select of document.querySelectorAll("select.timezone")) {
        select.value = current;
    }
    document.dispatchEvent(new CustomEvent(EVENT, { detail: { zone: current } }));
}

/** Calls the function each time the zone changes. */
export function onZoneChange(handler) {
    document.addEventListener(EVENT, handler);
}

/** The IANA identifier for Intl, undefined for the browser. */
function intlZone(zone) {
    return zone === BROWSER || !zone ? undefined : zone;
}

const partFormatters = new Map();

/** The calendar fields of an instant in the zone: {year, month, day, hour, minute, second}. */
export function partsInZone(date, zone) {
    const key = intlZone(zone) || "";
    let formatter = partFormatters.get(key);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: intlZone(zone),
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
        partFormatters.set(key, formatter);
    }
    const out = {};
    for (const part of formatter.formatToParts(date)) {
        if (part.type !== "literal") {
            out[part.type] = Number(part.value);
        }
    }
    return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (number) => String(number).padStart(2, "0");

/**
 * Writes an instant in the zone with a pattern of %Y %m %d %b %H %M %S (year, month, day, month name, hour, minute, second);
 * the other characters stay.
 */
export function formatInZone(date, pattern, zone) {
    const p = partsInZone(date, zone);
    const values = { Y: String(p.year), m: pad(p.month), d: pad(p.day), b: MONTHS[p.month - 1], H: pad(p.hour), M: pad(p.minute), S: pad(p.second) };
    return pattern.replace(/%([YmdbHMS])/g, (match, letter) => values[letter]);
}

/** The short name of the zone at the instant, such as PDT, UTC or KST; the name of the city when the browser gives none. */
export function zoneName(zone, date) {
    try {
        const part = new Intl.DateTimeFormat("en-US", { timeZone: intlZone(zone), timeZoneName: "short" })
            .formatToParts(date || new Date())
            .find((item) => item.type === "timeZoneName");
        if (part && !/^GMT[+-]/.test(part.value)) {
            return part.value;
        }
    } catch (error) {
        // An unknown zone is written by its label below.
    }
    const choice = ZONES.find((item) => item.id === zone);
    return choice ? choice.label : String(zone);
}

/** A time as the server writes it, MMM/dd/yyyy HH:mm:ss and the zone, but in the chosen zone. */
export function serverStyleText(epochSeconds, zone) {
    const date = new Date(epochSeconds * 1000);
    return `${formatInZone(date, "%b/%d/%Y %H:%M:%S", zone)} ${zoneName(zone, date)}`;
}

/** Puts the selection box at the right end of the menu bar of the page, once; a page without a menu bar gets none. */
export function mountTimeZoneSelect() {
    const nav = document.querySelector("nav.nav");
    if (!nav || nav.querySelector("select.timezone")) {
        return;
    }
    const select = document.createElement("select");
    select.className = "timezone";
    select.id = "timeZone";
    select.setAttribute("aria-label", "Time zone of the charts and the times");
    select.title = "Time zone in which every chart and time of the console is written";
    for (const zone of ZONES) {
        const option = document.createElement("option");
        option.value = zone.id;
        option.textContent = zone.label;
        select.append(option);
    }
    select.value = currentZone();
    select.addEventListener("change", () => setZone(select.value));
    const label = document.createElement("label");
    label.className = "timezone";
    label.append(document.createTextNode("Time zone "), select);
    nav.append(label);
}

if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mountTimeZoneSelect);
    } else {
        mountTimeZoneSelect();
    }
}
