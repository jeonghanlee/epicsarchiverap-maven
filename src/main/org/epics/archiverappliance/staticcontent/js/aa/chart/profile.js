// The display profiles of the charts: for a reader who sees colors as most do (Default), for a reader who cannot tell red
// from green (Red-green) and for a reader who sees no color (Monochrome). A profile is a table of combinations of a color, a
// dash pattern and a marker, one for each line of a chart by its position; no two combinations of a table are alike, and the
// first FIRM_LINES of them also differ from each other in color and in dash pattern, so that a line is told apart by its color
// and its dash without its marker, which a dense line does not show. More lines are supported by adding combinations here.
// The choice is one for the whole application, kept in the browser store, read from the address (parameter `profile`, which
// wins and is kept, as `tz` does), offered in a selection box next to the time zone and announced by an event on document.
// The menu script (js/menu.js of the console) is not a module: it reads the same store key and listens to the same event.

const STORE_KEY = "aa.chartProfile";
const PARAM = "profile";
const EVENT = "aa-chart-profile";
const DEFAULT = "default";

/** The lines of a chart that every profile keeps apart by color and dash pattern alone. */
export const FIRM_LINES = 5;

/** The dash patterns, by position; each of the first FIRM_LINES differs from the others. */
export const DASHES = ["", "14 4", "6 3", "2 3", "9 3 2 3"];

/** The markers, by position (the names of the d3 symbols). */
export const MARKERS = ["circle", "square", "triangle", "diamond", "cross"];

// The combinations of a table: the dash pattern and the marker follow the position; from the sixth combination on the dash
// pattern is moved on by two places when spread is true, for a table whose colors repeat, so that no combination repeats.
function table(colors, spread = false) {
    return colors.map((color, i) => ({
        color,
        dash: DASHES[(i + (spread ? Math.floor(i / FIRM_LINES) * 2 : 0)) % DASHES.length],
        marker: MARKERS[i % MARKERS.length],
    }));
}

// The colors of Red-green were chosen from a grid of colors that have a contrast of at least 3.2:1 against white and against the
// chart background, so that the first five have a CIEDE2000 difference of at least 26 from each other for a reader with normal
// color vision and with protanopia, deuteranopia and tritanopia (the simulations of Machado et al., 2009); the other three keep
// at least 13 from every color before them. The grays of Monochrome are five steps of lightness (CIE L* 0, 14, 28, 43 and 57)
// down to the lightest gray that keeps 3.2:1 against the chart background.
const RED_GREEN = ["#00007a", "#f50000", "#339985", "#c400f5", "#5c1f2b", "#00627a", "#b83d56", "#7a0000"];
const MONOCHROME = ["#000000", "#242424", "#434343", "#656565", "#898989", "#000000", "#242424", "#434343"];

/** The profiles, with the label of the selection box and the table of combinations of each. */
export const PROFILES = [
    {
        id: DEFAULT,
        label: "Default",
        combos: table(["#007681", "#5a6b70", "#b36b00", "#6a4c93", "#b3261e", "#2e7d32", "#c2185b", "#1565c0", "#7b5e00", "#455a64"]),
    },
    { id: "redgreen", label: "Red-green", combos: table(RED_GREEN) },
    { id: "mono", label: "Monochrome", combos: table(MONOCHROME, true) },
];

let current = null;

function known(id) {
    return PROFILES.some((profile) => profile.id === id) ? id : DEFAULT;
}

function stored() {
    try {
        return window.localStorage.getItem(STORE_KEY);
    } catch (error) {
        return null;
    }
}

function keep(id) {
    try {
        window.localStorage.setItem(STORE_KEY, id);
    } catch (error) {
        // The choice holds for this visit only.
    }
}

/** The profile in force: the parameter of the address wins and is kept, then the store, then Default. */
export function currentProfile() {
    if (current === null) {
        const hash = new URLSearchParams(window.location.hash.slice(1)).get(PARAM);
        const query = new URLSearchParams(window.location.search).get(PARAM);
        const fromAddress = hash || query;
        current = known(fromAddress || stored() || DEFAULT);
        if (fromAddress && known(fromAddress) === fromAddress) {
            keep(current);
        }
    }
    return current;
}

/** Changes the profile, keeps it, and tells the page through the aa-chart-profile event on document. */
export function setProfile(id) {
    current = known(id);
    keep(current);
    for (const select of document.querySelectorAll("select.chart-profile")) {
        select.value = current;
    }
    document.dispatchEvent(new CustomEvent(EVENT, { detail: { profile: current } }));
}

/** Calls the function each time the profile changes. */
export function onProfileChange(handler) {
    document.addEventListener(EVENT, handler);
}

/** The combination of color, dash pattern and marker of the line at position slot, in the profile in force. */
export function combination(slot) {
    const profile = PROFILES.find((p) => p.id === currentProfile());
    return profile.combos[slot % profile.combos.length];
}

/** The address parameter that carries the profile to another page, empty for Default. */
export function profileParameter() {
    return currentProfile() === DEFAULT ? "" : `${PARAM}=${encodeURIComponent(currentProfile())}`;
}

/** The address with the profile parameter added when the profile is not Default; an address that has one keeps it. */
export function withProfile(address) {
    const parameter = profileParameter();
    if (!parameter || new RegExp(`[?&#]${PARAM}=`).test(address)) {
        return address;
    }
    const hash = address.indexOf("#");
    const base = hash < 0 ? address : address.slice(0, hash);
    const tail = hash < 0 ? "" : address.slice(hash);
    return `${base}${base.includes("?") ? "&" : "?"}${parameter}${tail}`;
}

function build() {
    const select = document.createElement("select");
    select.className = "chart-profile";
    select.id = "chartProfile";
    select.setAttribute("aria-label", "Display profile of the charts");
    select.title = "How the lines of the charts are told apart: Default, Red-green for readers who cannot tell red from green, Monochrome for readers who see no color";
    for (const profile of PROFILES) {
        const option = document.createElement("option");
        option.value = profile.id;
        option.textContent = profile.label;
        select.append(option);
    }
    select.value = currentProfile();
    select.addEventListener("change", () => setProfile(select.value));
    const label = document.createElement("label");
    label.className = "chart-profile";
    label.append(document.createTextNode("Profile "), select);
    return label;
}

/** Puts the selection box in the menu bar of the page before the time zone, once; a page without a menu bar gets none. */
export function mountProfileSelect() {
    const nav = document.querySelector("nav.nav");
    if (!nav || nav.querySelector("select.chart-profile")) {
        return;
    }
    nav.insertBefore(build(), nav.querySelector("label.timezone"));
}

/** Puts the selection box at the end of the element, once, for a page that has no menu bar. */
export function mountProfileSelectIn(element) {
    if (!element || element.querySelector("select.chart-profile")) {
        return;
    }
    element.append(build());
}

if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mountProfileSelect);
    } else {
        mountProfileSelect();
    }
}
