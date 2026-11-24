// The wide table of the Export tab (viewer/export.js): a series without a sample at a time carries the sample before it,
// except where its next sample marks a lost connection. The module is loaded as it is; only the deployed path
// ../comm/js of its import is mapped to the shared scripts of the source tree.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

const SHARED = new URL("../../../main/org/epics/archiverappliance/staticcontent/js/", import.meta.url).href;
const hooks = `export async function resolve(specifier, context, next) {
    if (specifier.startsWith("../comm/js/")) return next(${JSON.stringify(SHARED)} + specifier.slice("../comm/js/".length), context);
    return next(specifier, context);
}`;
register(`data:text/javascript,${encodeURIComponent(hooks)}`);

const { wideTable } = await import("../../../main/org/epics/archiverappliance/retrieval/staticcontent/viewer/export.js");

const cell = { time: (t) => String(t), value: (v) => (v === null || v === undefined ? "" : String(v)), plain: (v) => (v === null || v === undefined ? "" : String(v)) };
const OPTIONS = { alarms: false, units: false, bins: false, quality: false };
const column = (table, index) => table.rows.map((row) => row[index]);

const steady = { name: "A", rows: [{ t: 10n, value: 1 }, { t: 20n, value: 2 }, { t: 30n, value: 3 }] };
const other = { name: "B", rows: [{ t: 15n, value: 7 }, { t: 25n, value: 8 }] };

test("a series carries its sample at or before a time it has none at", () => {
    const table = wideTable([steady, other], OPTIONS, cell);
    assert.deepEqual(column(table, 0), ["10", "15", "20", "25", "30"]);
    assert.deepEqual(column(table, 1), ["1", "1", "2", "2", "3"]);
    assert.deepEqual(column(table, 2), ["", "7", "7", "8", "8"]);
});

test("a series has no value before its first sample", () => {
    const table = wideTable([steady, other], OPTIONS, cell);
    assert.equal(column(table, 2)[0], "");
});

test("a time before a sample that marks a lost connection is empty for that series", () => {
    const lost = { name: "B", rows: [{ t: 15n, value: 7 }, { t: 28n, value: 8, lost: true }] };
    const table = wideTable([steady, lost], OPTIONS, cell);
    assert.deepEqual(column(table, 0), ["10", "15", "20", "28", "30"]);
    assert.deepEqual(column(table, 2), ["", "7", "", "8", "8"]);
});

test("a sample that marks a lost connection is itself shown at its own time", () => {
    const lost = { name: "A", rows: [{ t: 10n, value: 1 }, { t: 20n, value: 2, lost: true }] };
    const table = wideTable([lost], OPTIONS, cell);
    assert.deepEqual(column(table, 1), ["1", "2"]);
});

test("after the last sample the value carries on, as nothing marks a loss", () => {
    const short = { name: "B", rows: [{ t: 12n, value: 5 }] };
    const table = wideTable([steady, short], OPTIONS, cell);
    assert.deepEqual(column(table, 2), ["", "5", "5", "5"]);
});
