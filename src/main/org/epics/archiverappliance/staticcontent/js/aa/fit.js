// The fits of the analyzer: linear least squares of a design matrix, the models that are linear in a transformed variable (line,
// polynomial, exponential, power, logarithm), the iterative least squares of Levenberg-Marquardt for the sine, Gaussian and
// Landau shapes with fixed and bounded parameters, the covariance of the parameters and the Landau density (the CERNLIB
// algorithm of ROOT TMath::Landau). The parameter errors come from the covariance scaled by the reduced chi-square, as an
// unweighted fit has them (SciPy curve_fit without absolute errors). The bundled D3 has none of these.
import { invert, transpose, multiply } from "./matrix.js";

const LM_ITERATIONS_MOST = 500;
const LM_DAMPING_START = 1e-3;
const LM_DAMPING_UP = 10;
const LM_DAMPING_DOWN = 0.1;
const LM_CHI2_RELATIVE_LEAST = 1e-15;
const LM_STEP_RELATIVE_LEAST = 1e-13;
const JACOBIAN_STEP = 1e-7;

/** The sum of squared residuals of y against the fitted values, each weighted (a weight is one over the variance of y). */
function chiSquare(y, fitted, weights) {
    let sum = 0;
    for (let i = 0; i < y.length; i += 1) sum += (weights ? weights[i] : 1) * (y[i] - fitted[i]) ** 2;
    return sum;
}

/** The covariance of the parameters from the inverse of the normal matrix: scaled by the reduced chi-square for an unweighted
 * fit (the spread of the data sets the scale), taken as it is for a weighted one (the weights carry the scale). */
function covarianceOf(inverse, chi2, dof, weighted) {
    return weighted ? inverse.map((row) => row.map((v) => v)) : inverse.map((row) => row.map((v) => (v * chi2) / dof));
}

/** The coefficient of determination: one minus the residual sum of squares over the total one, from the unweighted residuals also
 * for a weighted fit (it describes how much of the spread of y the model explains, not the weighted chi-square); null when y does not vary. */
function rSquaredOf(y, chi2) {
    const mean = y.reduce((s, v) => s + v, 0) / y.length;
    const total = y.reduce((s, v) => s + (v - mean) ** 2, 0);
    return total > 0 ? 1 - chi2 / total : null;
}

/**
 * Least squares of y on the columns of the design matrix (rows are observations), weighted when weights (one over the variance
 * of each y) are given: the coefficients, their errors, the covariance (scaled by the reduced chi-square for an unweighted fit),
 * the chi-square per degree of freedom, R squared and the degrees of freedom. Null when the system is singular or has no degree
 * of freedom.
 */
export function linearLeastSquares(design, y, weights = null) {
    const n = y.length;
    const p = design.length ? design[0].length : 0;
    if (n <= p || p === 0) {
        return null;
    }
    const weighted = design.map((row, i) => row.map((v) => v * (weights ? weights[i] : 1)));
    const dt = transpose(weighted);
    const normal = multiply(dt, design);
    const inverse = invert(normal);
    if (!inverse) {
        return null;
    }
    const rhs = dt.map((row) => row.reduce((s, v, i) => s + v * y[i], 0));
    const params = inverse.map((row) => row.reduce((s, v, k) => s + v * rhs[k], 0));
    const fitted = design.map((row) => row.reduce((s, v, k) => s + v * params[k], 0));
    const chi2 = chiSquare(y, fitted, weights);
    const dof = n - p;
    const covariance = covarianceOf(inverse, chi2, dof, Boolean(weights));
    return { params, errors: covariance.map((row, k) => Math.sqrt(Math.max(row[k], 0))), covariance, chi2PerDof: chi2 / dof, rSquared: rSquaredOf(y, chiSquare(y, fitted)), dof, weighted: Boolean(weights) };
}

// The Landau density (CERNLIB DENLAN, as ROOT TMath::Landau computes it): the density of the Landau variable at v. It equals
// SciPy's landau.pdf at the location log(pi/2) and the scale pi/2 within 5e-9 relative.
const P1 = [0.4259894875, -0.1249762550, 0.03984243700, -0.006298287635, 0.001511162253];
const Q1 = [1.0, -0.3388260629, 0.09594393323, -0.01608042283, 0.003778942063];
const P2 = [0.1788541609, 0.1173957403, 0.01488850518, -0.001394989411, 0.0001283617211];
const Q2 = [1.0, 0.7428795082, 0.3153932961, 0.06694219548, 0.008790609714];
const P3 = [0.1788544503, 0.09359161662, 0.006325387654, 0.00006611667319, -0.000002031049101];
const Q3 = [1.0, 0.6097809921, 0.2560616665, 0.04746722384, 0.006957301675];
const P4 = [0.9874054407, 118.6723273, 849.2794360, -743.7792444, 427.0262186];
const Q4 = [1.0, 106.8615961, 337.6496214, 2016.712389, 1597.063511];
const P5 = [1.003675074, 167.5702434, 4789.711289, 21217.86767, -22324.94910];
const Q5 = [1.0, 156.9424537, 3745.310488, 9834.698876, 66924.28357];
const P6 = [1.000827619, 664.9143136, 62972.92665, 475554.6998, -5743609.109];
const Q6 = [1.0, 651.4101098, 56974.73333, 165917.4725, -2815759.939];
const A1 = [0.04166666667, -0.01996527778, 0.02709538966];
const A2 = [-1.845568670, -4.284640743];
const ratio = (p, q, v) => (p[0] + (p[1] + (p[2] + (p[3] + p[4] * v) * v) * v) * v) / (q[0] + (q[1] + (q[2] + (q[3] + q[4] * v) * v) * v) * v);

/** The Landau density at the Landau variable v. */
export function landauDensity(v) {
    if (v < -5.5) {
        const u = Math.exp(v + 1.0);
        return 0.3989422803 * (Math.exp(-1 / u) / Math.sqrt(u)) * (1 + (A1[0] + (A1[1] + A1[2] * u) * u) * u);
    }
    if (v < -1) {
        const u = Math.exp(-v - 1);
        return Math.exp(-u) * Math.sqrt(u) * ratio(P1, Q1, v);
    }
    if (v < 1) return ratio(P2, Q2, v);
    if (v < 5) return ratio(P3, Q3, v);
    if (v < 12) { const u = 1 / v; return u * u * ratio(P4, Q4, u); }
    if (v < 50) { const u = 1 / v; return u * u * ratio(P5, Q5, u); }
    if (v < 300) { const u = 1 / v; return u * u * ratio(P6, Q6, u); }
    const u = 1 / (v - (v * Math.log(v)) / (v + 1));
    return u * u * (1 + (A2[0] + A2[1] * u) * u);
}

/**
 * The models of the fit panel. A linear model gives the design columns of x and, when it fits a transformed y, the transform and
 * the way back to the natural parameters; an iterative model gives its value at x and an initial guess from the data. params are
 * the natural parameters named in parameters.
 */
export const MODELS = {
    line: { kind: "linear", parameters: ["a", "b"], text: "a + b x", design: (x) => [1, x], evaluate: (x, [a, b]) => a + b * x },
    polynomial: { kind: "linear", parameters: ["c0", "c1", "c2"], text: "c0 + c1 x + c2 x^2", design: (x) => [1, x, x * x], evaluate: (x, c) => c.reduce((s, v, k) => s + v * x ** k, 0) },
    exponential: { kind: "linear", parameters: ["a", "b"], text: "a exp(b x)", design: (x) => [1, x], transformY: Math.log, domain: (x, y) => y > 0,
        natural: ([c0, c1], [e0, e1]) => ({ params: [Math.exp(c0), c1], errors: [Math.exp(c0) * e0, e1] }), evaluate: (x, [a, b]) => a * Math.exp(b * x) },
    power: { kind: "linear", parameters: ["a", "b"], text: "a x^b", design: (x) => [1, Math.log(x)], transformY: Math.log, domain: (x, y) => x > 0 && y > 0,
        natural: ([c0, c1], [e0, e1]) => ({ params: [Math.exp(c0), c1], errors: [Math.exp(c0) * e0, e1] }), evaluate: (x, [a, b]) => a * x ** b },
    logarithm: { kind: "linear", parameters: ["a", "b"], text: "a + b ln x", design: (x) => [1, Math.log(x)], domain: (x) => x > 0, evaluate: (x, [a, b]) => a + b * Math.log(x) },
    sine: { kind: "iterative", parameters: ["A", "f", "phi", "c"], text: "A sin(2 pi f x + phi) + c",
        evaluate: (x, [a, f, phi, c]) => a * Math.sin(2 * Math.PI * f * x + phi) + c, guess: guessSine },
    gaussian: { kind: "iterative", parameters: ["A", "mu", "sigma", "c"], text: "A exp(-(x - mu)^2 / (2 sigma^2)) + c",
        evaluate: (x, [a, mu, sigma, c]) => a * Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) + c, guess: guessPeak },
    landau: { kind: "iterative", parameters: ["A", "mpv", "w", "c"], text: "A landau((x - mpv) / w) / w + c",
        evaluate: (x, [a, mpv, w, c]) => (a * landauDensity((x - mpv) / w)) / w + c, guess: guessPeak },
};

export const MODEL_NAMES = Object.keys(MODELS);

/** An initial guess of a sine: the amplitude from the spread, the frequency from the zero crossings of the centred values. */
function guessSine(x, y) {
    const mean = y.reduce((s, v) => s + v, 0) / y.length;
    const amplitude = Math.sqrt((2 * y.reduce((s, v) => s + (v - mean) ** 2, 0)) / y.length) || 1;
    let crossings = 0;
    for (let i = 1; i < y.length; i += 1) if ((y[i] - mean) * (y[i - 1] - mean) < 0) crossings += 1;
    const span = x[x.length - 1] - x[0];
    const frequency = span > 0 && crossings > 0 ? crossings / (2 * span) : 1 / (span || 1);
    return [amplitude, frequency, 0, mean];
}

/** An initial guess of a peak: the height above the lowest value at the highest sample, with a width from the spread of x. */
function guessPeak(x, y) {
    let low = Infinity;
    let top = -Infinity;
    let at = x[0];
    for (let i = 0; i < y.length; i += 1) {
        if (y[i] < low) low = y[i];
        if (y[i] > top) { top = y[i]; at = x[i]; }
    }
    const span = x[x.length - 1] - x[0];
    return [top - low || 1, at, span / 10 || 1, low];
}

/** The numeric Jacobian of the model at params over the free indices, by central differences. */
function jacobian(model, x, params, free) {
    return free.map((k) => {
        const h = JACOBIAN_STEP * Math.max(1, Math.abs(params[k]));
        const up = [...params];
        const down = [...params];
        up[k] += h;
        down[k] -= h;
        return x.map((xi) => (model(xi, up) - model(xi, down)) / (2 * h));
    });
}

/**
 * Levenberg-Marquardt least squares of y against model(x, params) from the start params. options.fixed lists the indices held
 * at their start value; options.lower and options.upper bound each parameter (null or absent for none). Returns the parameters,
 * their errors (for every parameter not fixed, from the covariance at the solution scaled by the reduced chi-square), the
 * covariance, the chi-square per degree of freedom, R squared, the degrees of freedom, the iterations and whether the search
 * converged; null when no degree of freedom is left or the model is not finite at the start.
 */
export function levenbergMarquardt(model, x, y, start, options = {}) {
    const weights = options.weights || null;
    const fixed = new Set(options.fixed || []);
    const lower = options.lower || [];
    const upper = options.upper || [];
    const clamp = (p) => p.map((v, k) => Math.min(upper[k] ?? Infinity, Math.max(lower[k] ?? -Infinity, v)));
    const estimable = start.map((_, k) => k).filter((k) => !fixed.has(k));
    const n = y.length;
    const dof = n - estimable.length;
    if (dof <= 0 || estimable.length === 0) {
        return null;
    }
    let params = clamp([...start]);
    let fitted = x.map((xi) => model(xi, params));
    if (fitted.some((v) => !Number.isFinite(v))) {
        return null;
    }
    let chi2 = chiSquare(y, fitted, weights);
    let damping = LM_DAMPING_START;
    let converged = false;
    let iteration = 0;
    for (; iteration < LM_ITERATIONS_MOST; iteration += 1) {
        // A parameter resting on a bound that the gradient pushes outward stays there for this step.
        const residuals = y.map((v, i) => (v - fitted[i]) * (weights ? weights[i] : 1));
        const jAll = jacobian(model, x, params, estimable);
        const gradient = jAll.map((column) => column.reduce((s, v, i) => s + v * residuals[i], 0));
        const active = estimable.filter((k, j) => {
            const atLower = lower[k] !== undefined && lower[k] !== null && params[k] <= lower[k] && gradient[j] < 0;
            const atUpper = upper[k] !== undefined && upper[k] !== null && params[k] >= upper[k] && gradient[j] > 0;
            return !atLower && !atUpper;
        });
        if (!active.length) { converged = true; break; }
        const j = jacobian(model, x, params, active);
        const g = j.map((column) => column.reduce((s, v, i) => s + v * residuals[i], 0));
        const normal = j.map((a) => j.map((b) => a.reduce((s, v, i) => s + v * b[i] * (weights ? weights[i] : 1), 0)));
        let improved = false;
        for (let tries = 0; tries < 30; tries += 1) {
            const damped = normal.map((row, a) => row.map((v, b) => (a === b ? v * (1 + damping) : v)));
            const inverse = invert(damped);
            if (!inverse) { damping *= LM_DAMPING_UP; continue; }
            const step = inverse.map((row) => row.reduce((s, v, k) => s + v * g[k], 0));
            const candidate = clamp(params.map((v, k) => { const a = active.indexOf(k); return a < 0 ? v : v + step[a]; }));
            const candidateFitted = x.map((xi) => model(xi, candidate));
            const candidateChi2 = candidateFitted.some((v) => !Number.isFinite(v)) ? Infinity : chiSquare(y, candidateFitted, weights);
            if (candidateChi2 < chi2) {
                const stepSize = Math.sqrt(candidate.reduce((s, v, k) => s + (v - params[k]) ** 2, 0));
                const scale = Math.sqrt(params.reduce((s, v) => s + v * v, 0)) + 1;
                const relative = (chi2 - candidateChi2) / (chi2 || 1);
                params = candidate;
                fitted = candidateFitted;
                chi2 = candidateChi2;
                damping = Math.max(damping * LM_DAMPING_DOWN, 1e-15);
                improved = true;
                if (relative < LM_CHI2_RELATIVE_LEAST || stepSize < LM_STEP_RELATIVE_LEAST * scale) converged = true;
                break;
            }
            damping *= LM_DAMPING_UP;
        }
        if (!improved) { converged = true; break; }
        if (converged) break;
    }
    const j = jacobian(model, x, params, estimable);
    const normal = j.map((a) => j.map((b) => a.reduce((s, v, i) => s + v * b[i] * (weights ? weights[i] : 1), 0)));
    const inverse = invert(normal);
    const covariance = inverse ? covarianceOf(inverse, chi2, dof, Boolean(weights)) : null;
    const errors = covariance ? covariance.map((row, k) => Math.sqrt(Math.max(row[k], 0))) : estimable.map(() => NaN);
    return { params, free: estimable, errors, covariance, chi2PerDof: chi2 / dof, rSquared: rSquaredOf(y, chiSquare(y, fitted)), dof, iterations: iteration, converged, weighted: Boolean(weights) };
}

/**
 * Fits the named model to the points (x and y arrays of equal length): a linear model by least squares (on the transformed y when
 * the model has one, the natural parameters and their errors following), an iterative model by Levenberg-Marquardt from
 * options.start (or the model's guess) with options.fixed, options.lower and options.upper. Returns {ok: false, reason} when a
 * value is not finite, the data do not fit the model's domain or no degree of freedom is left.
 */
export function fitModel(name, x, y, options = {}) {
    const model = MODELS[name];
    if (!model || x.length !== y.length) {
        return { ok: false, reason: "Unknown model or unequal lengths." };
    }
    const notFinite = x.filter((v, i) => !Number.isFinite(v) || !Number.isFinite(y[i])).length;
    if (notFinite) {
        return { ok: false, reason: `${notFinite} of the ${x.length} points are not finite numbers.` };
    }
    if (model.domain) {
        const outside = x.filter((xi, i) => !model.domain(xi, y[i])).length;
        if (outside) {
            return { ok: false, reason: `${outside} of the ${x.length} points lie outside the domain of the model ${model.text}.` };
        }
    }
    if (model.kind === "linear") {
        const target = model.transformY ? y.map(model.transformY) : y;
        const fit = linearLeastSquares(x.map(model.design), target, model.transformY ? null : options.weights || null);
        if (!fit) {
            return { ok: false, reason: `The fit of ${model.text} needs more than ${model.parameters.length} points with distinct x.` };
        }
        const natural = model.natural ? model.natural(fit.params, fit.errors) : { params: fit.params, errors: fit.errors };
        return { ok: true, model: name, params: natural.params, errors: natural.errors, free: fit.params.map((_, k) => k), transformed: model.transformY ? fit : null,
            chi2PerDof: fit.chi2PerDof, rSquared: fit.rSquared, dof: fit.dof, covariance: fit.covariance, converged: true, iterations: 0, weighted: fit.weighted };
    }
    const start = options.start || model.guess(x, y);
    const fit = levenbergMarquardt(model.evaluate, x, y, start, options);
    if (!fit) {
        return { ok: false, reason: `The fit of ${model.text} needs more points than free parameters and a finite model at the start values.` };
    }
    return { ok: true, model: name, ...fit };
}

/** The value of the named model at x for the parameters. */
export function modelValue(name, x, params) {
    return MODELS[name].evaluate(x, params);
}

/**
 * The standard deviation of the fitted curve of the named model at x, from the covariance of its free parameters (the gradient of
 * the model with respect to them, by central differences, transported through the covariance): the half width of the one-sigma
 * confidence band. NaN without a covariance.
 */
export function fitUncertaintyAt(name, fit, x) {
    if (!fit.covariance) return NaN;
    const model = MODELS[name];
    const evaluate = model.kind === "linear" && model.transformY ? null : model.evaluate;
    if (!evaluate) return NaN;
    const gradient = fit.free.map((k) => {
        const h = JACOBIAN_STEP * Math.max(1, Math.abs(fit.params[k]));
        const up = [...fit.params];
        const down = [...fit.params];
        up[k] += h;
        down[k] -= h;
        return (evaluate(x, up) - evaluate(x, down)) / (2 * h);
    });
    let variance = 0;
    for (let a = 0; a < gradient.length; a += 1) for (let b = 0; b < gradient.length; b += 1) variance += gradient[a] * fit.covariance[a][b] * gradient[b];
    return Math.sqrt(Math.max(variance, 0));
}
