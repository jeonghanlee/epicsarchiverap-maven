// The chart address (aa/chart/state.js) and the chart widget (aa/chart/widget.js) each validate the same settings: the
// tools, the navigation targets, the scales, the legend statistics, the display choices and defaults, the dash names, the
// width and decimals limits, the axis prefix and the length of a name. state.js keeps its own copies, which must say what the modules that own
// the lists say, or an address would accept a value the chart refuses (or the reverse). The declarations are read from the
// shipped sources and compared with the values the owners export.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import "./load-d3.mjs";

globalThis.window ??= { localStorage: { getItem: () => null, setItem: () => {} }, addEventListener: () => {}, location: { hash: "", search: "" } };
globalThis.document ??= { documentElement: { dataset: {} }, readyState: "loading", querySelectorAll: () => [], querySelector: () => null,
    addEventListener: () => {}, createElement: () => ({ style: {}, getContext: () => null }) };
globalThis.localStorage ??= globalThis.window.localStorage;

const CHART = "../../../main/org/epics/archiverappliance/staticcontent/js/aa/chart/";
const source = (file) => readFileSync(new URL(CHART + file, import.meta.url), "utf8");
const stateSource = source("state.js");
const widgetSource = source("widget.js");
const drawSource = source("draw.js");

/** The value of the literal declared as `const NAME = <literal>;` in a source; a declaration that cannot be found fails. */
const declared = (text, name) => {
    const match = text.match(new RegExp(`^const ${name} = ([\\s\\S]*?);$`, "m"));
    assert.ok(match, `the declaration of ${name} was not found`);
    return vm.runInNewContext(`(${match[1]})`);
};
/** The two numbers of a limit written in a source, by the pattern that holds them. */
const limit = (text, pattern, what) => {
    const match = text.match(pattern);
    assert.ok(match, `the ${what} was not found`);
    return [Number(match[1]), Number(match[2])];
};
const sorted = (list) => [...list].sort();
/** A copy of a value made in this realm, so that a literal evaluated in another context compares by its content. */
const plain = (value) => JSON.parse(JSON.stringify(value));

const gestures = await import(CHART + "gestures.js");
const scales = await import(CHART + "scales.js");
const legend = await import(CHART + "legend.js");
const draw = await import(CHART + "draw.js");

test("the tools and the navigation targets of the address are those of the gestures", () => {
    assert.deepEqual(sorted(declared(stateSource, "TOOLS")), sorted(gestures.TOOLS));
    assert.deepEqual(sorted(declared(stateSource, "NAVIGATION_TARGETS")), sorted(gestures.NAVIGATION_TARGETS));
});

test("the scales and the legend statistics of the address are those of the scales and the legend", () => {
    assert.deepEqual(sorted(declared(stateSource, "SCALES")), sorted(scales.SCALE_KINDS));
    assert.deepEqual(sorted(declared(stateSource, "LEGEND_STATISTICS")), sorted(legend.LEGEND_STATISTICS));
});

test("the display defaults of the address are those of the drawing", () => {
    assert.deepEqual(plain(declared(stateSource, "DISPLAY_DEFAULTS")), plain(draw.DISPLAY_DEFAULTS));
});

test("the display choices of the address are those of the widget, whatever their order", () => {
    const address = declared(stateSource, "DISPLAY");
    const widget = declared(widgetSource, "DISPLAY_CHOICES");
    assert.deepEqual(sorted(Object.keys(address)), sorted(Object.keys(widget)));
    for (const key of Object.keys(address)) {
        assert.deepEqual(sorted(address[key]), sorted(widget[key]), `the choices of ${key}`);
    }
});

test("the dash names of the address are the dash names of the widget and of the drawing", () => {
    const address = sorted(declared(stateSource, "DASHES"));
    assert.deepEqual(sorted(declared(widgetSource, "DASH_CHOICES").filter((name) => name !== "auto")), address);
    assert.deepEqual(sorted(Object.keys(declared(drawSource, "DASH_PATTERNS"))), address);
});

test("the length of a name, the width and the decimals are limited alike by the address and by the widget", () => {
    assert.equal(declared(stateSource, "TEXT_MOST"), declared(widgetSource, "NAME_MOST"));
    assert.deepEqual(limit(stateSource, /width !== null && width >= ([0-9.]+) && width <= ([0-9.]+)/, "width limit of the address"),
        limit(widgetSource, /input\.width >= ([0-9.]+) && input\.width <= ([0-9.]+)/, "width limit of the widget"));
    assert.deepEqual(limit(stateSource, /integerIn\(targetsOf\("decimals"\)\.get\(name\), (\d+), (\d+)\)/, "decimals limit of the address"),
        limit(widgetSource, /input\.decimals >= (\d+) && input\.decimals <= (\d+)/, "decimals limit of the widget"));
});

test("the axis prefix that the address reads and writes is the one prefix of the widget besides none", () => {
    const read = stateSource.match(/targetsOf\("axisPrefix"\)\.get\(unit\) === "([a-z]+)"/);
    const written = stateSource.match(/settings\.prefix === "([a-z]+)"/);
    assert.ok(read, "the prefix that the address reads was not found");
    assert.ok(written, "the prefix that the address writes was not found");
    const widget = plain(declared(widgetSource, "PREFIX_CHOICES")).filter((name) => name !== "none");
    assert.deepEqual([read[1]], widget);
    assert.deepEqual([written[1]], widget);
});
