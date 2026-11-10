// The expression parser of aa/expression.js: precedence, functions, constants, variables, and the refusals of malformed text.
import test from "node:test";
import assert from "node:assert/strict";

const { parse } = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/expression.js");
const value = (text, variables = {}) => parse(text).evaluate(variables);

test("arithmetic follows the usual precedence and associativity", () => {
    assert.equal(value("1 + 2 * 3"), 7);
    assert.equal(value("(1 + 2) * 3"), 9);
    assert.equal(value("2 ^ 3 ^ 2"), 512);
    assert.equal(value("-2 ^ 2"), -4);
    assert.equal(value("(-2) ^ 2"), 4);
    assert.equal(value("2 ^ -1"), 0.5);
    assert.equal(value("-(-3)"), 3);
    assert.equal(value("10 - 4 - 3"), 3);
    assert.equal(value("12 / 4 / 3"), 1);
    assert.equal(value("1.5e2 + .5"), 150.5);
});

test("functions, constants and variables evaluate, and the variables are listed in order of first use", () => {
    assert.equal(value("sqrt(16) + abs(-2) + max(1, 5) + min(3, 2) + pow(2, 3)"), 4 + 2 + 5 + 2 + 8);
    assert.ok(Math.abs(value("sin(pi / 2) + cos(0) + log(e) + log10(1000) + exp(0)") - 7) < 1e-12);
    const parsed = parse("SR:BEAM:CURRENT * 2 - SR:GEN:SINE + SR:BEAM:CURRENT");
    assert.deepEqual(parsed.variables, ["SR:BEAM:CURRENT", "SR:GEN:SINE"]);
    assert.equal(parsed.evaluate({ "SR:BEAM:CURRENT": 3, "SR:GEN:SINE": 1 }), 8);
    assert.ok(Number.isNaN(parsed.evaluate({ "SR:BEAM:CURRENT": 3 })), "a missing variable gives NaN");
});

test("malformed expressions are refused with a reason", () => {
    for (const text of ["", "1 +", "(1 + 2", "1 + 2)", "foo(1)", "sqrt(1, 2)", "1 $ 2", "2 3"]) {
        const parsed = parse(text);
        assert.equal(parsed.ok, false, text);
        assert.ok(parsed.reason.length > 0, text);
    }
});
