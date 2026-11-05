// The chart portion of an analyzer address, shared by source links and the analyzer.
import { CHART_OPTIONS, normalizeOptions } from "./options.js";
import { currentProfile } from "./profile.js";
import { currentZone } from "../timezone.js";

const OPTION_PARAMETERS = { shape: "shape", yscale: "yscale", marks: "marks", average: "avg", band: "band", window: "window" };

/** Copies valid per-unit ranges; an empty unit denotes a signal with no engineering unit. */
export function validRanges(entries = []) {
    return entries.filter(([unit, range]) => typeof unit === "string" && Array.isArray(range)
        && range.length === 2 && range.every(Number.isFinite) && range[0] < range[1])
        .map(([unit, range]) => [unit, [...range]]);
}

export function readChartState(parameters) {
    const options = normalizeOptions({
        shape: parameters.get("shape"), yscale: parameters.get("yscale"), marks: parameters.get("marks"),
        average: parameters.get("avg") === "1", band: parameters.get("band") === "1", window: Number(parameters.get("window")),
    });
    const ranges = new Map();
    for (const text of parameters.getAll("yrange")) {
        const match = /^(.*):([^:]+):([^:]+)$/.exec(text);
        if (!match || !match[1] || !match[2].trim() || !match[3].trim()) {
            continue;
        }
        const entries = validRanges([[match[1] === "none" ? "" : match[1], [Number(match[2]), Number(match[3])]]]);
        if (entries.length) {
            ranges.set(...entries[0]);
        }
    }
    return { options, projection: parameters.get("yproj") === "1", ranges: [...ranges] };
}

/** Writes explicit cross-origin preferences and only non-default chart options. */
export function writeChartParameters(parameters, state = {}, zone = currentZone(), profile = currentProfile()) {
    parameters.set("tz", zone);
    parameters.set("profile", profile);
    const options = normalizeOptions(state.options);
    for (const [name, parameter] of Object.entries(OPTION_PARAMETERS)) {
        parameters.delete(parameter);
        if (options[name] !== CHART_OPTIONS[name]) {
            parameters.set(parameter, typeof options[name] === "boolean" ? "1" : String(options[name]));
        }
    }
    parameters.delete("yproj");
    if (state.projection === true) {
        parameters.set("yproj", "1");
    }
    parameters.delete("yrange");
    for (const [unit, [low, high]] of validRanges(state.ranges)) {
        parameters.append("yrange", `${unit || "none"}:${low}:${high}`);
    }
}

/** Enriches a source link without changing its relative path or its fragment. */
export function withChartState(address, state = {}) {
    const hash = address.indexOf("#");
    const tail = hash < 0 ? "" : address.slice(hash);
    const base = hash < 0 ? address : address.slice(0, hash);
    const question = base.indexOf("?");
    const path = question < 0 ? base : base.slice(0, question);
    const parameters = new URLSearchParams(question < 0 ? "" : base.slice(question + 1));
    writeChartParameters(parameters, state);
    parameters.set("view", "trend");
    return `${path}?${parameters}${tail}`;
}
