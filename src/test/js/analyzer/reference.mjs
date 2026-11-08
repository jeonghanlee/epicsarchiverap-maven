// The reference values of generate-references.py and the comparison rules of the checks of the analyzer routines.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

export const reference = JSON.parse(readFileSync(new URL("./reference/references.json", import.meta.url), "utf8"));

/** The two numbers agree within rel times the expected one, and an absolute floor for expected values near zero. */
export function close(actual, expected, rel = 1e-9, floor = 1e-12, what = "value") {
    assert.ok(Number.isFinite(actual), `${what}: ${actual} is not a finite number`);
    assert.ok(Math.abs(actual - expected) <= rel * Math.abs(expected) + floor, `${what}: ${actual} differs from ${expected} by more than ${rel} relative`);
}

/** The two arrays agree element by element within rel times the largest expected magnitude of the array. */
export function closeArray(actual, expected, rel = 1e-9, what = "array") {
    assert.equal(actual.length, expected.length, `${what}: length`);
    const scale = expected.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    for (let i = 0; i < expected.length; i += 1) {
        assert.ok(Math.abs(actual[i] - expected[i]) <= rel * scale + 1e-300, `${what}[${i}]: ${actual[i]} differs from ${expected[i]} (scale ${scale})`);
    }
}
