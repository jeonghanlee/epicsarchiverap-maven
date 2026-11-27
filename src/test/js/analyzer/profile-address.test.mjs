// The display profile in force is decided in one place, currentProfile of aa/chart/profile.js, which the viewer, the Analyzer and
// the selection boxes read: a valid parameter of the address wins and is kept, an invalid one is the default and not the stored
// choice, and with no parameter the stored choice stands. Each case loads the module afresh, as a page does.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const AA = "../../../main/org/epics/archiverappliance/staticcontent/js/aa/";
const KEY = "aa.chartProfile";
let loads = 0;

async function profileOf({ search = "", hash = "", stored = null }) {
    const store = stored === null ? {} : { [KEY]: stored };
    globalThis.window = {
        localStorage: { getItem: (key) => store[key] ?? null, setItem: (key, value) => { store[key] = value; } },
        location: { search, hash },
    };
    globalThis.document = { querySelector: () => null, querySelectorAll: () => [], dispatchEvent: () => {}, addEventListener: () => {} };
    globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
    loads += 1;
    const { currentProfile } = await import(`${AA}chart/profile.js?case=${loads}`);
    return { profile: currentProfile(), store };
}

test("a valid parameter of the address wins over the stored choice and is kept", async () => {
    const { profile, store } = await profileOf({ search: "?profile=redgreen", stored: "mono" });
    assert.equal(profile, "redgreen");
    assert.equal(store[KEY], "redgreen");
});

test("an invalid parameter of the address is the default, not the stored choice, and is not kept", async () => {
    const { profile, store } = await profileOf({ search: "?profile=bad", stored: "mono" });
    assert.equal(profile, "default");
    assert.equal(store[KEY], "mono");
});

test("with no parameter the stored choice stands, and an unknown stored choice is the default", async () => {
    assert.equal((await profileOf({ stored: "mono" })).profile, "mono");
    assert.equal((await profileOf({ stored: "bad" })).profile, "default");
    assert.equal((await profileOf({})).profile, "default");
});

test("the data viewer leaves the reading of the profile to chart/profile.js: it holds neither the store key nor a read of the parameter", () => {
    const viewer = readFileSync(fileURLToPath(new URL("../../../main/org/epics/archiverappliance/retrieval/staticcontent/viewer/viewer.js", import.meta.url)), "utf8");
    assert.ok(!viewer.includes(KEY), "the store key of the profile");
    assert.ok(!/\.get\(\s*["']profile["']\s*\)/.test(viewer), "a read of the profile parameter");
    assert.ok(/currentProfile/.test(viewer), "the profile in force comes from currentProfile");
});

test("the parameter in the hash of the address is read before the one in the query", async () => {
    const { profile } = await profileOf({ search: "?profile=mono", hash: "#profile=redgreen" });
    assert.equal(profile, "redgreen");
});
