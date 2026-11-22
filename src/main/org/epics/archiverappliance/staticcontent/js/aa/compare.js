// The comparison of two sets of values of the Compare tab: the common bins, the rules that say when a test can run, and the numbers and
// tests of two samples. The values are arrays of finite numbers; the page decides which samples belong to a range or a signal.
import { moments } from "./stats.js";
import { chiSquareHomogeneity, kolmogorovSmirnov, andersonDarling, compareSamples } from "./tests.js";

const d3 = globalThis.d3;

export const COMPARE_METHOD_NAMES = ["chi2", "ks", "ad"];
// Each test needs this many samples in each of the two datasets before it gives a p-value.
export const SAMPLES_LEAST = 8;
// The chi-square test is refused when more than this share of the cells of its table (a bin of A and a bin of B) has an expected count
// below EXPECTED_LEAST, the rule of thumb of Pearson's test, which SciPy's chi2_contingency exposes as expected_freq.
export const EXPECTED_LEAST = 5;
export const SPARSE_SHARE_MOST = 0.2;

/** The counts of the values in the equal-width bins between the minimum and the maximum, the last bin including the maximum. */
export function binCounts(values, minimum, maximum, number) {
    const width = (maximum - minimum) / number;
    const edges = Array.from({ length: number - 1 }, (_, i) => minimum + (i + 1) * width);
    return d3.bin().domain([minimum, maximum]).thresholds(edges)(values).map((bin) => bin.length);
}

/**
 * The reason a test cannot run on the two samples, or null when it can. For the chi-square test the cells are the bins that either
 * sample uses, in the row of A and the row of B; the expected count of a cell is the bin total times the share of that sample in the
 * pooled samples.
 */
export function testRefusal(method, valuesA, valuesB, countsA, countsB) {
    for (const [side, values] of [["A", valuesA], ["B", valuesB]]) {
        if (values.length < SAMPLES_LEAST) return `The test needs at least ${SAMPLES_LEAST} samples in each dataset; ${side} holds ${values.length}.`;
    }
    const lowest = Math.min(d3.min(valuesA), d3.min(valuesB));
    const highest = Math.max(d3.max(valuesA), d3.max(valuesB));
    if (!(highest > lowest)) return "All the samples of A and B have one value; there is no distribution to compare.";
    if (method === "chi2") {
        const na = valuesA.length;
        const nb = valuesB.length;
        const totals = countsA.map((c, i) => c + countsB[i]).filter((total) => total > 0);
        if (totals.length < 2) return "The two histograms use fewer than 2 bins.";
        const cells = totals.length * 2;
        const sparse = totals.reduce((count, total) => count + (total * na / (na + nb) < EXPECTED_LEAST ? 1 : 0) + (total * nb / (na + nb) < EXPECTED_LEAST ? 1 : 0), 0);
        if (sparse / cells > SPARSE_SHARE_MOST) {
            return `${sparse} of the ${cells} cells of the table (the ${totals.length} bins used, for A and for B) are expected to hold fewer than ${EXPECTED_LEAST} samples; the chi-square approximation needs most cells to hold at least ${EXPECTED_LEAST}. Choose Kolmogorov-Smirnov or Anderson-Darling.`;
        }
    }
    return null;
}

/** The comparison of the two sets of values: the numbers, the common bins and the result of each test (a result or a refusal). */
export function compute(valuesA, valuesB, unitsDiffer) {
    const m = { a: moments(valuesA), b: moments(valuesB) };
    // The values of the two datasets in one array, for the number of bins and the common range.
    const pooled = new Float64Array(valuesA.length + valuesB.length);
    pooled.set(valuesA);
    pooled.set(valuesB, valuesA.length);
    const lowest = d3.min(pooled);
    const highest = d3.max(pooled);
    const number = Math.min(1000, Math.max(1, Math.round(d3.thresholdSturges(pooled))));
    const flat = !(highest > lowest);
    const countsA = flat ? [valuesA.length] : binCounts(valuesA, lowest, highest, number);
    const countsB = flat ? [valuesB.length] : binCounts(valuesB, lowest, highest, number);
    const difference = unitsDiffer ? null : compareSamples(valuesA, valuesB);
    const tests = {};
    for (const method of COMPARE_METHOD_NAMES) {
        const refusal = unitsDiffer ? "The units differ; unlike units are not compared." : testRefusal(method, valuesA, valuesB, countsA, countsB);
        if (refusal) {
            tests[method] = { refusal };
        } else if (method === "chi2") {
            tests[method] = { result: chiSquareHomogeneity(countsA, countsB) };
        } else if (method === "ks") {
            tests[method] = { result: kolmogorovSmirnov(valuesA, valuesB) };
        } else {
            tests[method] = { result: andersonDarling([valuesA, valuesB]) };
        }
        if (!tests[method].refusal && !tests[method].result) tests[method] = { refusal: "The test has no result for these samples." };
    }
    return { m, lowest, highest, number, countsA, countsB, difference, tests };
}
