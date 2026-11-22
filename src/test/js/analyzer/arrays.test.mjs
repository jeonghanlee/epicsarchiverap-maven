// The reading of arrays (aa/arrays.js): the plan of a request from the type information, the bounded reading of a response, the frames of
// a response, the thinning, the frame at or before a time, the element axis, the series of a summary value and the frames of an overlay.
// The response bodies have the shape the retrieval gives (measured on the appliance in the check of the retrieval of arrays).
import test from "node:test";
import assert from "node:assert/strict";
import "./load-d3.mjs";

const arrays = await import("../../../main/org/epics/archiverappliance/staticcontent/js/aa/arrays.js");

const frameBody = (rows) => [{ meta: { name: "SR:GEN:WAVE", EGU: "V", PREC: "3" }, data: rows.map(([secs, val, extra = {}]) => ({ secs, val, nanos: 0, severity: 0, status: 0, ...extra })) }];

test("the step of the thinning is the frames expected over the most frames, at least 1", () => {
    assert.equal(arrays.thinningStep(0.1, 3600), 2, "360 frames over 200 take every second");
    assert.equal(arrays.thinningStep(0.1, 1000), 1, "100 frames need no thinning");
    assert.equal(arrays.thinningStep(50, 60, 200), 15, "3000 frames over 200");
    assert.equal(arrays.thinningStep(0, 3600), 1);
    assert.equal(arrays.thinningStep("not a number", 3600), 1);
    assert.equal(arrays.thinningStep(0.1, -5), 1);
});

test("the plan of a request fits the frames in the most elements of a request, and a single frame above it is refused", () => {
    assert.equal(arrays.ELEMENTS_MOST, 2304000, "one camera frame of 1920 by 1200");
    const wave = arrays.requestPlan({ elementCount: 2048, eventRate: 0.1, seconds: 3600 });
    assert.equal(wave.ok, true);
    assert.equal(wave.framesAllowed, 200, "1125 frames of 2048 elements fit, the most frames is 200");
    assert.equal(wave.byElements, false);
    assert.equal(wave.step, 2);
    assert.equal(wave.expected, 360);
    assert.equal(wave.estimatedElements, 180 * 2048);
    const image = arrays.requestPlan({ elementCount: 307200, eventRate: 0.1, seconds: 3600 });
    assert.equal(image.framesAllowed, 7, "7 frames of 640 by 480 hold 2,150,400 elements, 8 would hold 2,457,600");
    assert.equal(image.byElements, true);
    assert.equal(image.step, 52, "360 frames expected over 7");
    const camera = arrays.requestPlan({ elementCount: 2304000, eventRate: 1, seconds: 3600 });
    assert.equal(camera.ok, true, "a frame of exactly the most elements is read");
    assert.equal(camera.framesAllowed, 1, "a camera frame is read alone");
    const above = arrays.requestPlan({ elementCount: 2304001, eventRate: 1, seconds: 60 });
    assert.equal(above.ok, false);
    assert.match(above.reason, /One frame of this array holds 2,304,001 elements, more than the 2,304,000 the page reads in one request to keep the browser responsive/);
    assert.equal(arrays.requestPlan({ elementCount: 0, eventRate: 1, seconds: 60 }).ok, false);
    assert.equal(arrays.requestPlan({ elementCount: 12.5, eventRate: 1, seconds: 60 }).ok, false);
    assert.equal(arrays.requestPlan({ elementCount: 2048, eventRate: 0, seconds: 60 }).expected, null, "an unknown rate leaves the size unestimated");
});

test("a response is read in chunks and stopped as soon as it exceeds the limit", async () => {
    const chunk = new TextEncoder().encode("0123456789");
    const stream = (count) => new ReadableStream({ pull(controller) { if (count-- > 0) controller.enqueue(chunk); else controller.close(); } });
    const whole = await arrays.readBounded(new Response(stream(5)), 100);
    assert.equal(whole.text.length, 50);
    const exact = await arrays.readBounded(new Response(stream(10)), 100);
    assert.equal(exact.text.length, 100, "a response of exactly the limit is read");
    const over = await arrays.readBounded(new Response(stream(11)), 100);
    assert.equal(over.exceeded, true);
    assert.equal(over.bytes, 110);
    assert.equal(over.text, undefined);
    const utf8 = new TextEncoder().encode("é");
    const split = new ReadableStream({ start(controller) { controller.enqueue(utf8.slice(0, 1)); controller.enqueue(utf8.slice(1)); controller.close(); } });
    assert.equal((await arrays.readBounded(new Response(split), 100)).text, "é", "a character split between two chunks is decoded whole");
});

test("the frames of a response are typed arrays with their times, and a record that is not an array of numbers carries its reason", () => {
    const body = frameBody([[1000, [1, 2, 3]], [1010, [4, 5, 6], { nanos: 500000000 }], [1020, 7], [1030, [1, "x", 3]], [1040, []], [1050, [1, 2]]]);
    const parsed = arrays.parseFrames(body);
    assert.equal(parsed.form, "Mixed samples");
    assert.deepEqual(parsed.meta, { name: "SR:GEN:WAVE", EGU: "V", PREC: "3" });
    assert.equal(parsed.frames.length, 6);
    assert.ok(parsed.frames[0].values instanceof Float64Array);
    assert.deepEqual(Array.from(parsed.frames[1].values), [4, 5, 6]);
    assert.equal(parsed.frames[1].t, 1010 * 1000 + 500, "the nanoseconds count in the time");
    assert.equal(parsed.frames[2].values, null);
    assert.match(parsed.frames[2].problem, /scalar/);
    assert.match(parsed.frames[3].problem, /Element 1 .* not a finite number/);
    assert.match(parsed.frames[4].problem, /no elements/);
    assert.deepEqual(parsed.lengths, [{ length: 3, first: 0 }, { length: 0, first: 4 }, { length: 2, first: 5 }]);
});

test("a response says whether it holds no samples, array samples or scalar samples", () => {
    assert.equal(arrays.parseFrames([{ meta: {}, data: [] }]).form, "No samples");
    assert.equal(arrays.parseFrames([]).form, "No samples");
    assert.equal(arrays.parseFrames(null).form, "No samples");
    assert.equal(arrays.parseFrames(frameBody([[1, 5], [2, 6]])).form, "Scalar samples");
    assert.equal(arrays.parseFrames(frameBody([[1, [5]], [2, [6]]])).form, "Array samples");
});

test("the frames of a range are those inside it, and the frame before the range, which the retrieval adds, is kept apart", () => {
    const frames = [5, 10, 20, 30, 40].map((t) => ({ t }));
    const range = arrays.framesInside(frames, 20, 30);
    assert.deepEqual(range.inside.map((f) => f.t), [20, 30], "both ends are inside");
    assert.equal(range.before.t, 10, "the last frame before the range");
    const none = arrays.framesInside(frames, 11, 19);
    assert.deepEqual(none.inside, []);
    assert.equal(none.before.t, 10);
    assert.equal(arrays.framesInside(frames, 0, 4).before, null, "no frame before the first");
    assert.equal(arrays.framesInside([], 0, 4).inside.length, 0);
});

test("the distinct element counts of frames are listed with their first frame, scalar records leave them out", () => {
    const f = (length, problem = null, scalar = false) => ({ length, values: problem ? null : new Float64Array(length), problem, scalar });
    assert.deepEqual(arrays.lengthsOf([f(3), f(3), f(5), f(3), f(5)]), [{ length: 3, first: 0 }, { length: 5, first: 2 }]);
    assert.deepEqual(arrays.lengthsOf([f(0, "The record is a scalar, not an array.", true), f(4)]), [{ length: 4, first: 1 }]);
    assert.deepEqual(arrays.lengthsOf([]), []);
});

test("the frames are thinned again on the page to at most the most, every Mth, and the step is reported", () => {
    const frames = Array.from({ length: 360 }, (_, i) => ({ t: i * 10000 }));
    const thinned = arrays.thinOnPage(frames, 200);
    assert.equal(thinned.step, 2);
    assert.equal(thinned.frames.length, 180);
    assert.equal(thinned.total, 360);
    assert.equal(thinned.frames[1].t, 20000);
    const odd = arrays.thinOnPage(Array.from({ length: 401 }, (_, i) => ({ t: i })), 200);
    assert.equal(odd.step, 3);
    assert.ok(odd.frames.length <= 200);
    const few = arrays.thinOnPage(frames.slice(0, 5), 200);
    assert.equal(few.step, 1);
    assert.equal(few.frames.length, 5);
});

test("the frames are also thinned to at most the most elements in all, in the three sizes measured in the browser", () => {
    const of = (count, length) => Array.from({ length: count }, (_, i) => ({ t: i, length }));
    const wave = arrays.thinOnPage(of(360, 2048), 200, 2304000);
    assert.deepEqual([wave.step, wave.frames.length, wave.elements, wave.byElements], [2, 180, 737280, false], "737,280 elements: the most frames sets the step");
    const image = arrays.thinOnPage(of(10, 307200), 200, 2304000);
    assert.deepEqual([image.step, image.frames.length, image.elements, image.byElements], [2, 5, 3072000, true], "3,072,000 elements: every second frame, 1,536,000 kept");
    const camera = arrays.thinOnPage(of(2, 2304000), 200, 2304000);
    assert.deepEqual([camera.step, camera.frames.length, camera.elements, camera.byElements], [2, 1, 4608000, true], "4,608,000 elements: one camera frame kept");
    const exact = arrays.thinOnPage(of(1, 2304000), 200, 2304000);
    assert.deepEqual([exact.step, exact.frames.length, exact.byElements], [1, 1, false], "exactly the most elements is kept whole");
    const uneven = arrays.thinOnPage([{ t: 0, length: 2000000 }, { t: 1, length: 10 }, { t: 2, length: 2000000 }], 200, 2304000);
    assert.ok(uneven.frames.reduce((s, f) => s + f.length, 0) <= 2304000, "with unequal lengths the step grows until the kept frames fit");
    assert.equal(uneven.step, 3);
});

test("the frame at or before a time is found by bisection, and a time before the first frame has none", () => {
    const frames = [10, 20, 30, 40].map((t) => ({ t }));
    assert.equal(arrays.frameAtOrBefore(frames, 25), 1);
    assert.equal(arrays.frameAtOrBefore(frames, 30), 2);
    assert.equal(arrays.frameAtOrBefore(frames, 1000), 3);
    assert.equal(arrays.frameAtOrBefore(frames, 10), 0);
    assert.equal(arrays.frameAtOrBefore(frames, 9), -1);
    assert.equal(arrays.frameAtOrBefore([], 9), -1);
});

test("the axis is the element number, a typed start and step, or a companion array of the length of the frame that does not decrease", () => {
    assert.deepEqual(Array.from(arrays.axisValues({ mode: "index" }, 4).x), [0, 1, 2, 3]);
    assert.deepEqual(Array.from(arrays.axisValues({ mode: "typed", start: "-1", step: "0.5" }, 4).x), [-1, -0.5, 0, 0.5]);
    assert.match(arrays.axisValues({ mode: "typed", start: "", step: "1" }, 4).reason, /start/);
    assert.match(arrays.axisValues({ mode: "typed", start: "0", step: "0" }, 4).reason, /nonzero/);
    assert.match(arrays.axisValues({ mode: "typed", start: "0", step: "abc" }, 4).reason, /nonzero/);
    assert.match(arrays.axisValues({ mode: "typed", start: "x", step: "1" }, 4).reason, /start/);
    assert.deepEqual(Array.from(arrays.axisValues({ mode: "typed", start: "5", step: "-2" }, 3).x), [5, 3, 1], "a negative step is a decreasing axis that was typed");
    assert.match(arrays.axisValues({ mode: "companion" }, 4, null).reason, /No axis array/);
    assert.match(arrays.axisValues({ mode: "companion" }, 4, Float64Array.from([0, 1, 2])).reason, /3 elements and the frame has 4/);
    assert.match(arrays.axisValues({ mode: "companion" }, 3, Float64Array.from([0, 2, 1])).reason, /decreases at element 2/);
    assert.match(arrays.axisValues({ mode: "companion" }, 3, Float64Array.from([0, NaN, 2])).reason, /Element 1 .* not a finite number/);
    assert.equal(arrays.axisValues({ mode: "companion" }, 3, Float64Array.from([0, 0, 2])).ok, true, "equal neighbours do not decrease");
    assert.match(arrays.axisValues({ mode: "polar" }, 3).reason, /not known/);
});

test("a summary value over the frames is one point for each frame where it is defined, and the others are counted", () => {
    const frames = [1, 2, 3, 4].map((k) => ({ t: k * 1000, values: Float64Array.from([k, 2 * k, 3 * k, 2 * k, k]), length: 5 }));
    frames.push({ t: 5000, values: Float64Array.from([-1, -2, -3, -2, -1]), length: 5 });
    const summaries = arrays.frameSummaries(frames);
    assert.equal(summaries.length, 5);
    const max = arrays.summarySeries(summaries, "max");
    assert.deepEqual(max.points.map((p) => p.v), [3, 6, 9, 12, -1]);
    assert.deepEqual(max.points.map((p) => p.t), [1000, 2000, 3000, 4000, 5000]);
    assert.equal(max.undefinedCount, 0);
    assert.deepEqual(arrays.summarySeries(summaries, "maxAt").points.map((p) => p.v), [2, 2, 2, 2, 0]);
    const centre = arrays.summarySeries(summaries, "centre");
    assert.equal(centre.points.length, 4, "the centre of a negative sum is not defined");
    assert.equal(centre.undefinedCount, 1);
    assert.ok(centre.points.every((p) => Math.abs(p.v - 2) < 1e-12), "a symmetric array has its centre in the middle");
    const mean = arrays.summarySeries(summaries, "mean");
    assert.deepEqual(mean.points.map((p) => p.v), [1.8, 3.6, 5.4, 7.2, -1.8]);
    assert.throws(() => arrays.summarySeries(summaries, "median"), /not known/);
    const unreadable = arrays.frameSummaries([{ t: 1, values: null }, ...frames.slice(0, 1)]);
    assert.equal(unreadable.length, 1, "a frame that cannot be read has no summary");
});

test("a line drawing uses every element when they are few, else the lowest and the highest of each block of elements, in order", () => {
    const small = Float64Array.from([3, 1, 2]);
    assert.deepEqual(arrays.drawingIndices(small, 5), [0, 1, 2]);
    const values = Float64Array.from({ length: 1000 }, (_, i) => (i === 503 ? 100 : i === 217 ? -50 : Math.sin(i / 10)));
    const indices = arrays.drawingIndices(values, 100);
    assert.ok(indices.length <= 200, `at most two for each block, ${indices.length}`);
    assert.ok(indices.includes(503) && indices.includes(217), "a single narrow peak and a single narrow dip are kept");
    assert.deepEqual([...indices].sort((a, b) => a - b), indices, "element order");
    assert.equal(new Set(indices).size, indices.length);
    const flat = arrays.drawingIndices(new Float64Array(1000).fill(2), 100);
    assert.equal(flat.length, 100, "one element for each block of equal values");
    assert.equal(arrays.drawingIndices(new Float64Array(6), 3).length, 6, "6 elements are no more than twice 3 columns, so all are used");
    assert.equal(arrays.drawingIndices(new Float64Array(7), 3).length, 3, "7 elements are more than twice 3 columns: one for each block of equal values");
});

test("the frames of one drawing must all be readable and of one length", () => {
    const f = (values) => ({ values: values ? Float64Array.from(values) : null, length: values ? values.length : 0, problem: values ? null : "bad" });
    assert.doesNotThrow(() => arrays.checkFrames([f([1, 2]), f([3, 4])]));
    assert.throws(() => arrays.checkFrames([]), /no frame/);
    assert.throws(() => arrays.checkFrames([f([1, 2]), f([3, 4, 5])]), /Frame 1 has 3 elements and the first has 2/);
    assert.throws(() => arrays.checkFrames([f([1, 2]), f(null)]), /Frame 1 cannot be read: bad/);
});

test("an overlay holds the current frame and others spaced evenly over the frames, in time order, at most the count", () => {
    const frames = Array.from({ length: 101 }, (_, i) => ({ t: i }));
    assert.deepEqual(arrays.overlayFrames(frames, 37, 1), [37]);
    const five = arrays.overlayFrames(frames, 50, 5);
    assert.deepEqual(five, [0, 25, 50, 75, 100]);
    const withOdd = arrays.overlayFrames(frames, 37, 5);
    assert.equal(withOdd.length, 5);
    assert.ok(withOdd.includes(37), "the current frame is always drawn");
    assert.deepEqual([...withOdd].sort((a, b) => a - b), withOdd, "time order");
    assert.equal(new Set(withOdd).size, 5);
    assert.equal(arrays.overlayFrames(frames, 0, 500).length, arrays.OVERLAY_MOST, "no more than the most");
    assert.deepEqual(arrays.overlayFrames(frames.slice(0, 3), 1, 10), [0, 1, 2], "fewer frames than asked");
});
