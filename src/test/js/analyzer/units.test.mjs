// The change of unit (aa/units.js) against the factors of powers of ten that the reference generator computes with decimals: the units
// that a unit text can be shown in, the factors between them, and the texts that offer no change.
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";
import { reference, close } from "./reference.mjs";

const units = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/units.js");

test("the factor between two prefixes of one base unit equals the power of ten of the reference", () => {
    for (const c of reference.unitCases.conversions) {
        close(units.conversionFactor(c.from, c.to), c.factor, 1e-15, 0, `${c.from} to ${c.to}`);
    }
    assert.equal(units.conversionFactor("mm", "mm"), 1);
});

test("a value converted there and back is the value", () => {
    for (const c of reference.unitCases.conversions) {
        const there = units.conversionFactor(c.from, c.to);
        const back = units.conversionFactor(c.to, c.from);
        close(there * back, 1, 1e-12, 0, `${c.from} and ${c.to}`);
    }
});

test("a unit that is not a prefix and a base unit in use, another base, and an empty text offer no change", () => {
    for (const [from, to] of reference.unitCases.refused) {
        assert.equal(units.conversionFactor(from, to), null, `${from} to ${to}`);
    }
    for (const text of ["Gs", "mm/s", "", "degC", "min", "dm", "Mm"]) {
        assert.deepEqual(units.compatibleUnits(text), [], text);
    }
    assert.equal(units.compatibleUnits(undefined).length, 0);
});

test("each unit lists the units of its base in ascending order of the factor, its own among them", () => {
    for (const [text, expected] of Object.entries(reference.unitCases.compatible)) {
        assert.deepEqual(units.compatibleUnits(text), expected, text);
        assert.ok(units.compatibleUnits(text).includes(text), `${text} lists itself`);
    }
});

test("the micro sign is read as u and written as the source writes it", () => {
    assert.equal(units.conversionFactor("µm", "mm"), 0.001);
    assert.equal(units.conversionFactor("um", "µm"), 1);
    assert.deepEqual(units.compatibleUnits("µm"), ["pm", "nm", "µm", "mm", "m", "km"]);
    assert.deepEqual(units.compatibleUnits("kΩ"), ["mΩ", "Ω", "kΩ", "MΩ"]);
});
