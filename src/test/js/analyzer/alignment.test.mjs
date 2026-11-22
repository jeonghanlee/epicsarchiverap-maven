// The alignment of several signals on the times all of them share (aa/alignment.js) against the intersection of NumPy, and the
// condition number and the collinear pairs of aa/dependency.js against np.linalg.cond and the pairs the correlation matrix gives.
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";
import { reference, close, closeArray } from "./reference.mjs";

const alignment = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/alignment.js");
const dependency = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/dependency.js");

test("signals with missing intervals are aligned on the times all of them have, with the counts of the union and the dropped", () => {
    const c = reference.alignmentCases;
    const result = alignment.alignOnTimes(c.series);
    assert.deepEqual(result.times, c.times);
    result.columns.forEach((column, k) => closeArray(column, c.columns[k], 1e-15, `column ${k}`));
    assert.equal(result.union, c.union);
    assert.equal(result.common, c.common);
    assert.equal(result.dropped, c.dropped);
    result.signals.forEach((s, k) => close(s.share, c.shares[k], 1e-15, 1e-15, `share ${k}`));
    assert.deepEqual(result.signals.map((s) => s.name), ["s0", "s1", "s2"]);
});

test("series that share no time, no series and a series without points align to nothing", () => {
    const disjoint = alignment.alignOnTimes([{ name: "a", points: [{ t: 0, v: 1 }] }, { name: "b", points: [{ t: 1000, v: 2 }] }]);
    assert.equal(disjoint.common, 0);
    assert.equal(disjoint.union, 2);
    assert.equal(disjoint.dropped, 2);
    assert.deepEqual(alignment.alignOnTimes([]).times, []);
    assert.equal(alignment.alignOnTimes([{ name: "a", points: [{ t: 0, v: 1 }] }, { name: "b", points: [] }]).common, 0);
});

test("the mutual information of a hundred thousand and of a million intervals is computed, not refused by the call stack", () => {
    for (const n of [130000, 1000000]) {
        const x = Array.from({ length: n }, (_, i) => Math.sin(i / 50));
        const y = Array.from({ length: n }, (_, i) => Math.cos(i / 70));
        const value = dependency.mutualInformation(x, y, 16);
        assert.ok(Number.isFinite(value) && value > 0, `n ${n}`);
    }
});

test("the condition number of the correlation matrix equals NumPy's and the collinear pairs are those above the threshold", () => {
    for (const name of ["well", "near"]) {
        const c = reference.conditionCases[name];
        close(dependency.conditionNumber(c.columns), c.cond, 1e-9, 1e-15, `${name} condition number`);
        const pairs = dependency.collinearPairs(c.columns, c.threshold);
        assert.equal(pairs.length, c.pairs.length, `${name} pair count`);
        pairs.forEach((p, k) => {
            assert.equal(p.i, c.pairs[k].i);
            assert.equal(p.j, c.pairs[k].j);
            close(p.r, c.pairs[k].r, 1e-9, 1e-15, `${name} r`);
        });
    }
    assert.equal(dependency.conditionNumber([[1, 1, 1], [1, 2, 3]]), null, "a column without spread has no condition number");
    assert.equal(dependency.conditionNumber([[1, 2, 3, 4], [2, 4, 6, 8]]), Infinity, "two columns that are multiples have an infinite one");
});
