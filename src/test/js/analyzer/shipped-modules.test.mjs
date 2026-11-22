// The shipped modules of staticcontent/js/aa load under Node and answer, so that a routine check can import them the way
// the browser does. The modules of the data viewer import the shared ones through a path that exists in the deployed
// layout only, and are not loaded here.
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";

const STATIC = "../../../main/org/epics/archiverappliance";

globalThis.window ??= { localStorage: { getItem: () => null, setItem: () => {} }, addEventListener: () => {}, location: { hash: "", search: "" } };
globalThis.document ??= { documentElement: { dataset: {} }, readyState: "loading", querySelectorAll: () => [], querySelector: () => null, addEventListener: () => {} };
globalThis.localStorage ??= globalThis.window.localStorage;

test("chart/state.js reads and writes the durations and the times of the address", async () => {
    const state = await import(`${STATIC}/staticcontent/js/aa/chart/state.js`);
    assert.equal(state.isoDuration(5), "PT5S");
    assert.equal(state.parseIsoDuration("PT1.5S"), 1.5);
    assert.equal(state.timeOf("2026-11-07T00:00:00.123456789Z").getTime(), Date.UTC(2026, 10, 7, 0, 0, 0, 123));
    assert.equal(state.nanosOfTime("2026-11-07T00:00:00.000000001Z") % 1000000000n, 1n);
});

test("chart/series.js movingStats gives the mean and the sample deviation of the window at each position", async () => {
    const series = await import(`${STATIC}/staticcontent/js/aa/chart/series.js`);
    const stats = series.movingStats([1, 2, 3, 4], 2);
    assert.deepEqual(stats.map((s) => s.mean), [1, 1.5, 2.5, 3.5]);
    assert.equal(stats[0].deviation, 0);
    for (const s of stats.slice(1)) {
        assert.ok(Math.abs(s.deviation - Math.SQRT1_2) < 1e-12);
    }
});

test("chart/text.js writes a value by its magnitude with its unit", async () => {
    const text = await import(`${STATIC}/staticcontent/js/aa/chart/text.js`);
    assert.equal(text.format(0, "mA"), "0 mA");
    assert.equal(text.format(499.2, "mA"), "499.2 mA");
    assert.equal(text.format(0.0004, ""), "4.00e-4");
});
