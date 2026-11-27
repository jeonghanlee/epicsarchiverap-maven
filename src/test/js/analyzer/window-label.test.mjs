// The time window of the range strip written as text (aa/chart/text.js): an interval in square brackets, which include the data
// at both ends, with what both ends share written once in front of them, and the unit ranges of the axes.
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";

globalThis.window ??= { localStorage: { getItem: () => null, setItem: () => {} }, addEventListener: () => {}, location: { hash: "", search: "" } };
globalThis.document ??= { documentElement: { dataset: {} }, readyState: "loading", querySelectorAll: () => [], querySelector: () => null,
    addEventListener: () => {}, createElement: () => ({ style: {}, getContext: () => null }) };
globalThis.localStorage ??= globalThis.window.localStorage;

const { windowLabel, intervalText } = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/chart/text.js");

const at = (iso) => new Date(iso);

test("a window of ten minutes or less is written to the second, with the day once in front of the brackets", () => {
    const label = windowLabel(at("2026-10-15T10:51:45Z"), at("2026-10-15T11:01:45Z"), "UTC");
    assert.equal(label.text, "2026-10-15 [10:51:45, 11:01:45]");
    assert.equal(label.full, "[2026-10-15 10:51:45, 2026-10-15 11:01:45]");
});

test("a window inside one hour writes the hour once as well", () => {
    const label = windowLabel(at("2026-10-15T10:51:45Z"), at("2026-10-15T10:51:50Z"), "UTC");
    assert.equal(label.text, "2026-10-15 10:[51:45, 51:50]");
    assert.equal(label.full, "[2026-10-15 10:51:45, 2026-10-15 10:51:50]");
});

test("a window above ten minutes is written to the minute", () => {
    const label = windowLabel(at("2026-10-15T10:00:00Z"), at("2026-10-15T12:30:00Z"), "UTC");
    assert.equal(label.text, "2026-10-15 [10:00, 12:30]");
});

test("a window over midnight in one year leaves the year out of its end", () => {
    const label = windowLabel(at("2026-10-15T23:50:00Z"), at("2026-10-16T00:10:00Z"), "UTC");
    assert.equal(label.text, "[2026-10-15 23:50, 10-16 00:10]");
    assert.equal(label.full, "[2026-10-15 23:50, 2026-10-16 00:10]");
});

test("a window over a year end is written in full", () => {
    const label = windowLabel(at("2026-12-31T23:50:00Z"), at("2027-01-01T00:10:00Z"), "UTC");
    assert.equal(label.text, "[2026-12-31 23:50, 2027-01-01 00:10]");
    assert.equal(label.text, label.full);
});

test("the ends are read in the chosen zone", () => {
    assert.equal(windowLabel(at("2026-10-15T10:51:45Z"), at("2026-10-15T11:01:45Z"), "Asia/Seoul").text, "2026-10-15 [19:51:45, 20:01:45]");
});

test("an interval of numbers is written in square brackets with each end through the given text", () => {
    assert.equal(intervalText(0.5, 2, String), "[0.5, 2]");
    assert.equal(intervalText(-5, 5, (value) => value.toFixed(1)), "[-5.0, 5.0]");
});
