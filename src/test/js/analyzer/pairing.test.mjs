// The pairing of two signals of aa/pairing.js against the same gap rule written as its own loop in NumPy: the pairs at the union
// of the sample times, the samples left out for a hold too old or ended by a lost connection, and the aligned case.
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";
import { reference, close } from "./reference.mjs";

const pairing = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/pairing.js");
const points = (rows) => rows.map(([t, v, g]) => ({ t, v, g }));

test("the irregular case: pairs, exclusions and median spacings equal the reference loop", () => {
    const c = reference.pairingCases.irregular;
    const result = pairing.pairSeries(points(c.x), points(c.y));
    assert.equal(result.pairs.length, c.pairs.length);
    result.pairs.forEach((pair, i) => {
        assert.equal(pair.t, c.pairs[i][0], `time ${i}`);
        close(pair.x, c.pairs[i][1], 1e-12, 1e-15, `x ${i}`);
        close(pair.y, c.pairs[i][2], 1e-12, 1e-15, `y ${i}`);
    });
    assert.equal(result.excludedX, c.excludedX);
    assert.equal(result.excludedY, c.excludedY);
    assert.equal(result.medianX, c.medianX);
    assert.equal(result.medianY, c.medianY);
    assert.equal(result.countX, c.x.length);
    assert.equal(result.countY, c.y.length);
});

test("two signals sampled at the same times give one pair per time and no exclusion", () => {
    const c = reference.pairingCases.aligned;
    const result = pairing.pairSeries(points(c.x), points(c.y));
    assert.equal(result.pairs.length, c.x.length);
    assert.equal(result.excludedX + result.excludedY, 0);
    assert.deepEqual(result.overlap, { from: 0, to: 90000 });
});

test("a hold older than five median spacings and a hold ended by a lost connection are not paired", () => {
    const y = points([[0, 1, false], [10000, 2, false], [200000, 3, false], [210000, 4, true], [220000, 5, false]]);
    assert.equal(pairing.heldValue(y, 5000, 50000).v, 1, "inside the hold");
    assert.equal(pairing.heldValue(y, 100000, 50000), null, "too old");
    assert.equal(pairing.heldValue(y, 205000, 50000), null, "the next sample follows a lost connection");
    assert.equal(pairing.heldValue(y, 215000, 50000).v, 4, "the hold of the sample after the loss is fine");
    assert.equal(pairing.heldValue(y, -1, 50000), null, "before the first sample");
    assert.equal(pairing.medianSpacingMs([{ t: 0, v: 0 }]), null);
});
