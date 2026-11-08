// Puts the vendored D3 bundle of the pages on globalThis, as the pages load it with a script tag, so that the modules of
// staticcontent/js/aa run under Node the way they run in the browser. The checks of the Analyzer routines import this first.
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";

const BUNDLE = new URL("../../../main/org/epics/archiverappliance/staticcontent/js/vendor/d3.min.js", import.meta.url);

if (!globalThis.d3) {
    runInThisContext(readFileSync(BUNDLE, "utf8"), { filename: BUNDLE.pathname });
}

export const d3 = globalThis.d3;
