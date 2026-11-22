// The plan of the Analyzer tools builds on what the vendored D3 bundle has and writes only what it lacks. These checks
// read the real bundle and fail when a D3 upgrade changes that, so that the plan is read again before the routines are.
import test from "node:test";
import assert from "node:assert/strict";
import { d3 } from "./load-d3.mjs";

test("the bundle is D3 7.9.0", () => {
    assert.equal(d3.version, "7.9.0");
});

test("the bundle has the functions the tools use", () => {
    for (const name of ["bin", "thresholdSturges", "thresholdScott", "thresholdFreedmanDiaconis", "quantile", "quantileSorted",
        "mean", "median", "variance", "deviation", "extent", "rollup", "group", "bisector", "randomLcg", "randomNormal", "ticks"]) {
        assert.equal(typeof d3[name], "function", name);
    }
});

test("the bundle lacks what the page routines write", () => {
    for (const name of ["skewness", "kurtosis", "correlation", "regression", "kde", "fft", "ttest"]) {
        assert.equal(typeof d3[name], "undefined", `${name} is in the bundle now; read the plan of the tools again`);
    }
});

test("the seeded generators give the same numbers on every run", () => {
    const first = Array.from({ length: 3 }, d3.randomNormal.source(d3.randomLcg(42))(0, 1));
    const second = Array.from({ length: 3 }, d3.randomNormal.source(d3.randomLcg(42))(0, 1));
    assert.deepEqual(first, second);
});
