// The observation a cursor reads (aa/chart/cursors.js): the last sample at or before the cursor, unavailable where the line is
// disconnected, and held after the last sample up to the gap threshold.
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";

globalThis.window ??= { localStorage: { getItem: () => null, setItem: () => {} }, addEventListener: () => {}, location: { hash: "", search: "" } };
globalThis.document ??= { documentElement: { dataset: {} }, readyState: "loading", querySelectorAll: () => [], querySelector: () => null, addEventListener: () => {} };
globalThis.localStorage ??= globalThis.window.localStorage;

const { heldObservation } = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/chart/cursors.js");

const GAP = 50;
const two = [{ t: 0, v: 1 }, { t: 100, v: 2 }];
const valueAt = (points, gap, t) => heldObservation(points, gap, t)?.v ?? null;

test("a cursor before the first sample reads nothing", () => {
    assert.equal(valueAt(two, GAP, -1), null);
});

test("a cursor reads the last sample at or before it while the samples are connected", () => {
    const close = [{ t: 0, v: 1 }, { t: 40, v: 2 }, { t: 80, v: 3 }];
    assert.equal(valueAt(close, GAP, 0), 1);
    assert.equal(valueAt(close, GAP, 39), 1);
    assert.equal(valueAt(close, GAP, 40), 2);
    assert.equal(valueAt(close, GAP, 79), 2);
});

test("between two samples whose step is wider than the gap threshold the line is disconnected and nothing is read", () => {
    assert.equal(valueAt(two, GAP, 0), 1);
    assert.equal(valueAt(two, GAP, 30), null);
    assert.equal(valueAt(two, GAP, 99), null);
    assert.equal(valueAt(two, GAP, 100), 2);
});

test("after the last sample its value holds up to the gap threshold and no further", () => {
    assert.equal(valueAt(two, GAP, 130), 2);
    assert.equal(valueAt(two, GAP, 150), 2);
    assert.equal(valueAt(two, GAP, 151), null);
});

test("without a gap threshold the last sample holds and the samples are never disconnected", () => {
    assert.equal(valueAt(two, Infinity, 30), 1);
    assert.equal(valueAt(two, Infinity, 1e9), 2);
});

test("a lost connection disconnects the line whatever the spacing", () => {
    const lost = [{ t: 0, v: 1 }, { t: 10, v: 2, g: true }];
    assert.equal(valueAt(lost, Infinity, 5), null);
    assert.equal(valueAt(lost, Infinity, 10), 2);
});
