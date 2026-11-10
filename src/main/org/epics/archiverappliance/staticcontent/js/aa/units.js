// The change of unit of the analyzer: a unit of the engineering-unit text of a signal that is a base unit with an SI prefix (mm, uV,
// kHz) can be shown in another prefix of the same base unit, the values being multiplied by a power of ten. A unit that is not of
// this form (a compound such as mm/s, a text such as degC or Gs, an empty unit) offers no change, so that nothing is converted by
// a guess: "Gs" is gauss, not a gigasecond. Each base unit lists the prefixes that are in use with it.

const EXPONENT = { p: -12, n: -9, u: -6, "µ": -6, m: -3, "": 0, k: 3, M: 6, G: 9 };
// The prefixes in use with each base unit, in ascending order of the factor; the micro sign is written u, or as the source writes it.
const BASES = {
    Hz: ["m", "", "k", "M", "G"],
    Pa: ["m", "", "k", "M"],
    rad: ["u", "m", ""],
    Ohm: ["m", "", "k", "M"],
    m: ["p", "n", "u", "m", "", "k"],
    V: ["n", "u", "m", "", "k", "M"],
    A: ["p", "n", "u", "m", "", "k"],
    W: ["u", "m", "", "k", "M", "G"],
    s: ["p", "n", "u", "m", ""],
    T: ["n", "u", "m", ""],
    J: ["u", "m", "", "k", "M"],
    K: ["m", ""],
};
// The longer base names first, so that "Hz" is not read as a "z" and "mrad" as a "d".
const ORDER = Object.keys(BASES).sort((a, b) => b.length - a.length);

/** The prefix and the base unit of a unit text such as "mm", or null when the text is not a prefix and a base unit in use. */
export function parseUnit(text) {
    if (typeof text !== "string" || !text) return null;
    const unit = text.replace("Ω", "Ohm");
    for (const base of ORDER) {
        if (!unit.endsWith(base)) continue;
        const prefix = unit.slice(0, unit.length - base.length);
        const key = prefix === "µ" ? "u" : prefix;
        if (BASES[base].includes(key) && prefix in EXPONENT) return { prefix, base, exponent: EXPONENT[prefix] };
    }
    return null;
}

/** The units that the text can be shown in, its own among them, in ascending order of the factor; empty when it offers no change. */
export function compatibleUnits(text) {
    const parsed = parseUnit(text);
    if (!parsed) return [];
    const micro = text.includes("µ") ? "µ" : "u";
    return BASES[parsed.base].map((prefix) => `${prefix === "u" ? micro : prefix}${parsed.base === "Ohm" && text.endsWith("Ω") ? "Ω" : parsed.base}`);
}

/** The factor that turns a value in the unit from into a value in the unit to, or null when either is not a unit or their bases differ. */
export function conversionFactor(from, to) {
    const a = parseUnit(from);
    const b = parseUnit(to);
    if (!a || !b || a.base !== b.base) return null;
    return Number(`1e${a.exponent - b.exponent}`);
}
