// A series of equal values has no spread, and every routine of the analyzer that divides by a spread answers the same way: no
// answer (null) where it has none to give. The mean of eight 0.1 is not 0.1, so a sum of squared deviations of equal values is
// not always 0 and a decision taken on it passes some constants and refuses others; the decision belongs to hasSpread (aa/stats.js).
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";

const AA = "../../../main/org/epics/archiverappliance/staticcontent/js/aa/";
const { hasSpread, moments, silvermanBandwidth } = await import(`${AA}stats.js`);
const { pearson, correlationMatrix } = await import(`${AA}correlation.js`);
const { multipleRegression, principalComponents, conditionNumber, mutualInformation } = await import(`${AA}dependency.js`);
const { linearFit } = await import(`${AA}trend.js`);
const { autocorrelation, prepareSeries } = await import(`${AA}spectrum.js`);

// Values that sum to something other than n times themselves in floating point (0.1, 0.3, 0.7), and ones that do not.
const CONSTANTS = [7, 0.1, 0.3, 0.7, -0.1, 1e9 + 0.1, 123.456];
const N = 16;
const ramp = Array.from({ length: N }, (_, i) => i + 1);
const wave = Array.from({ length: N }, (_, i) => Math.sin(i / 2) + 0.1 * i);
const flat = (value) => Array(N).fill(value);

test("hasSpread is false for equal values and true when two differ, whatever the length", () => {
    for (const value of CONSTANTS) assert.equal(hasSpread(flat(value)), false, `constant ${value}`);
    assert.equal(hasSpread([]), false);
    assert.equal(hasSpread([3]), false);
    assert.equal(hasSpread([0.1, 0.1, 0.1 + Number.EPSILON]), true);
    assert.equal(hasSpread(ramp), true);
    assert.equal(hasSpread(new Float64Array(200000).fill(2)), false, "a long array does not overflow the call stack");
});

test("Pearson's r is null when either variable is constant", () => {
    for (const value of CONSTANTS) {
        assert.equal(pearson(ramp, flat(value)), null, `y constant ${value}`);
        assert.equal(pearson(flat(value), wave), null, `x constant ${value}`);
    }
    assert.ok(pearson(ramp, wave), "varying variables still correlate");
});

test("a correlation matrix, the principal components and the condition number have no answer for a constant column", () => {
    for (const value of CONSTANTS) {
        const columns = [ramp, wave, flat(value)];
        assert.ok(correlationMatrix(columns).flat().some(Number.isNaN), `matrix ${value}`);
        assert.equal(principalComponents(columns), null, `components ${value}`);
        assert.equal(conditionNumber(columns), null, `condition ${value}`);
    }
    assert.ok(principalComponents([ramp, wave]), "varying columns still decompose");
});

test("the multiple regression has no answer for a constant target or a constant column", () => {
    for (const value of CONSTANTS) {
        assert.equal(multipleRegression([ramp, wave], flat(value)), null, `target ${value}`);
        assert.equal(multipleRegression([ramp, flat(value)], wave), null, `column ${value}`);
    }
    assert.ok(multipleRegression([ramp], wave.map((v, i) => v + 0.3 * ramp[i])), "a varying target still fits");
});

test("the linear fit of a constant series is the exact line through it and has no coefficient of determination", () => {
    for (const value of CONSTANTS) {
        for (const length of [16, 80, 81, 200]) {
            const fit = linearFit(Array.from({ length }, (_, i) => ({ t: 1.7e12 + i * 1000, v: value })));
            assert.equal(fit.slope, 0, `slope ${value} over ${length}`);
            assert.equal(fit.intercept, value, `intercept ${value} over ${length}`);
            assert.equal(fit.slopeError, 0, `slope error ${value} over ${length}`);
            assert.equal(fit.rSquared, null, `r squared ${value} over ${length}`);
        }
    }
    const varying = linearFit(wave.map((v, i) => ({ t: 1.7e12 + i * 1000, v })));
    assert.ok(varying.rSquared > 0 && varying.rSquared < 1);
});

test("the autocorrelation of a constant series is null", () => {
    for (const value of CONSTANTS) assert.equal(autocorrelation(flat(value), 4), null, `constant ${value}`);
    const r = autocorrelation(wave, 4);
    assert.equal(r[0], 1);
});

test("every routine agrees on every constant: no answer from all of them or from none", () => {
    for (const value of CONSTANTS) {
        const column = flat(value);
        const answers = [
            pearson(ramp, column) === null,
            principalComponents([ramp, column]) === null,
            conditionNumber([ramp, wave, column]) === null,
            multipleRegression([ramp], column) === null,
            linearFit(column.map((v, i) => ({ t: 1.7e12 + i * 1000, v }))).rSquared === null,
            autocorrelation(column, 4) === null,
        ];
        assert.deepEqual(answers, answers.map(() => !hasSpread(column)), `constant ${value}`);
    }
});

test("the routines that decide for themselves, on the two ends or on exact sums, agree with hasSpread on every constant", () => {
    const times = Array.from({ length: N }, (_, i) => i);
    for (const value of CONSTANTS) {
        const column = flat(value);
        assert.equal(moments(column).sd, 0, `standard deviation ${value}`);
        assert.equal(moments(column).skewness, null, `skewness ${value}`);
        assert.equal(silvermanBandwidth(column), null, `bandwidth ${value}`);
        assert.equal(mutualInformation(ramp, column, 4), null, `mutual information ${value}`);
        assert.equal(prepareSeries(times, column, {}).ok, false, `spectrum series ${value}`);
    }
    assert.ok(moments(wave).sd > 0);
    assert.ok(mutualInformation(ramp, wave, 4) !== null, "varying variables still have a mutual information");
    assert.equal(prepareSeries(times, wave, {}).ok, true, "a varying series is still prepared");
});
