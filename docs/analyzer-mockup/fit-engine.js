/* Bounded least-squares calculations for the offline fitting prototype. */
"use strict";

const FitEngine = (() => {
    const DIFFERENCE_STEP = 1e-4;
    const MIN_EXPECTED = 1e-12;
    const RANK_TOLERANCE = 1e-5;
    const NORMAL_95 = 1.959963984540054;
    const MAX_INFORMATION_CONDITION = 1e10;
    const RESIDUAL_ROUNDOFF_FACTOR = 64;
    const sumSquares = values => values.reduce((sum, value) => sum + value * value, 0);
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

    function normalCdf(value) {
        const x = Math.abs(value) / Math.SQRT2;
        const t = 1 / (1 + 0.3275911 * x);
        const tail = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
        return value < 0 ? tail / 2 : 1 - tail / 2;
    }

    function logFactorial(n) {
        let total = 0;
        for (let k = 2; k <= n; k++) total += Math.log(k);
        return total;
    }

    function predict(model, p, row, x0 = 0) {
        if (model === "linear") return p.b + p.m * (row.x - x0);
        if (model === "quadratic") return p.b + p.m * (row.x - x0) + p.q * (row.x - x0) ** 2;
        if (model === "peak") return p.b + p.a * Math.exp(-0.5 * ((row.x - p.mu) / p.sigma) ** 2);
        if (model === "poisson") {
            let probability = 0;
            for (let k = row.firstInteger; k <= row.lastInteger; k++) {
                probability += p.lambda === 0 ? Number(k === 0) : Math.exp(k * Math.log(p.lambda) - p.lambda - row.logFactorials[k - row.firstInteger]);
            }
            return p.n * probability;
        }
        const mass = normalCdf((row.upper - p.mu) / p.sigma) - normalCdf((row.lower - p.mu) / p.sigma);
        return p.n * Math.max(0, mass) + (model === "normal-background" ? p.background * (row.upper - row.lower) : 0);
    }

    function residual(observed, expected, objective) {
        if (!Number.isFinite(expected)) return NaN;
        if (objective !== "poisson") return observed - expected;
        if (expected < 0) return NaN;
        const mu = Math.max(MIN_EXPECTED, expected);
        const deviance = observed === 0 ? 2 * mu : 2 * (mu - observed + observed * Math.log(observed / mu));
        return Math.sign(observed - mu) * Math.sqrt(Math.max(0, deviance));
    }

    function solve(matrix, vector) {
        const a = matrix.map((row, i) => [...row, vector[i]]);
        for (let i = 0; i < a.length; i++) {
            let pivot = i;
            for (let j = i + 1; j < a.length; j++) if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
            if (Math.abs(a[pivot][i]) < 1e-20) return null;
            [a[i], a[pivot]] = [a[pivot], a[i]];
            const divisor = a[i][i];
            for (let k = i; k <= a.length; k++) a[i][k] /= divisor;
            for (let j = 0; j < a.length; j++) if (j !== i) {
                const factor = a[j][i];
                for (let k = i; k <= a.length; k++) a[j][k] -= factor * a[i][k];
            }
        }
        return a.map(row => row.at(-1));
    }

    function independentColumns(columns) {
        const basis = [];
        for (const column of columns) {
            const length = Math.sqrt(sumSquares(column));
            if (!Number.isFinite(length) || length < 1e-12) return false;
            let vector = column.map(value => value / length);
            for (let pass = 0; pass < 2; pass++) for (const direction of basis) {
                const projection = vector.reduce((sum, value, i) => sum + value * direction[i], 0);
                vector = vector.map((value, i) => value - projection * direction[i]);
            }
            const remaining = Math.sqrt(sumSquares(vector));
            if (remaining < RANK_TOLERANCE) return false;
            basis.push(vector.map(value => value / remaining));
        }
        return true;
    }

    function parameterUncertainty(result, config, parameters) {
        const free = parameters.filter(parameter => !parameter.fixed);
        const poisson = config.objective === "poisson";
        const uncertainty = {
            status: "unavailable", method: poisson ? "Poisson expected Fisher information" : "Residual-scaled local covariance",
            confidenceLevel: 0.95, intervalMethod: "Normal approximation", criticalValue: NORMAL_95,
            parameterOrder: free.map(parameter => parameter.name), covariance: null, varianceScale: null, condition: null,
            assumptions: poisson ? "Independent Poisson bin counts; local large-sample approximation. No overdispersion correction."
                : "Independent, equal-variance Y errors; locally linear model. No X-error or serial-correlation correction.",
            parameters: Object.fromEntries(parameters.map(parameter => [parameter.name, {
                status: parameter.fixed ? "fixed" : "unavailable", standardError: null, lower95: null, upper95: null,
            }])),
            reason: "",
        };
        const unavailable = reason => { uncertainty.reason = reason; return uncertainty; };
        if (!result.success) return unavailable("The fit did not converge successfully.");
        if (!free.length) { uncertainty.status = "fixed"; return unavailable("All parameters are fixed; no uncertainty is estimated."); }
        if (result.atBounds.length) return unavailable(`A free parameter is at a bound (${result.atBounds.join(", ")}); symmetric uncertainty is not reliable.`);
        if (!(result.df > 0)) return unavailable("Positive residual degrees of freedom are required.");
        const scale = poisson ? 1 : sumSquares(result.rows.map(row => row.residual)) / result.df;
        if (!poisson && scale <= RESIDUAL_ROUNDOFF_FACTOR * Number.EPSILON ** 2 * sumSquares(result.rows.map(row => row.y)) / result.rows.length) {
            return unavailable("Residual variance is zero or below numerical resolution; measurement uncertainty cannot be estimated.");
        }
        const columns = free.map(parameter => {
            const value = result.parameters[parameter.name];
            const low = Math.max(parameter.min, value - DIFFERENCE_STEP * parameter.scale);
            const high = Math.min(parameter.max, value + DIFFERENCE_STEP * parameter.scale);
            const minus = { ...result.parameters, [parameter.name]: low }, plus = { ...result.parameters, [parameter.name]: high };
            return result.rows.map(row => {
                const derivative = (predict(config.model, plus, row, config.x0) - predict(config.model, minus, row, config.x0)) / (high - low) * parameter.scale;
                return poisson ? derivative / Math.sqrt(Math.max(MIN_EXPECTED, row.fitted)) : derivative;
            });
        });
        if (!independentColumns(columns)) return unavailable("Parameter sensitivities are singular or too dependent for a covariance estimate.");
        const lengths = columns.map(column => Math.sqrt(sumSquares(column)));
        const normalized = columns.map((column, i) => column.map(value => value / lengths[i]));
        const information = normalized.map(a => normalized.map(b => a.reduce((sum, value, i) => sum + value * b[i], 0)));
        const inverses = free.map((_, i) => solve(information, free.map((_, j) => Number(i === j))));
        if (inverses.some(column => !column || column.some(value => !Number.isFinite(value)))) return unavailable("The information matrix could not be inverted.");
        const inverse = information.map((_, i) => information.map((_, j) => (inverses[i][j] + inverses[j][i]) / 2));
        const matrixNorm = matrix => Math.max(...matrix.map(row => row.reduce((sum, value) => sum + Math.abs(value), 0)));
        uncertainty.condition = matrixNorm(information) * matrixNorm(inverse);
        if (!Number.isFinite(uncertainty.condition) || uncertainty.condition > MAX_INFORMATION_CONDITION) return unavailable("The information matrix is too ill-conditioned for reliable uncertainty.");
        const covariance = inverse.map((row, i) => row.map((value, j) => value * scale * free[i].scale * free[j].scale / lengths[i] / lengths[j]));
        if (covariance.some((row, i) => row.some(value => !Number.isFinite(value)) || row[i] <= 0)) return unavailable("The covariance does not have finite positive parameter variances.");
        const estimates = free.map((parameter, i) => {
            const standardError = Math.sqrt(covariance[i][i]), value = result.parameters[parameter.name];
            return { name: parameter.name, status: "estimated", standardError, lower95: value - NORMAL_95 * standardError, upper95: value + NORMAL_95 * standardError };
        });
        if (estimates.some((estimate, i) => estimate.lower95 <= free[i].min || estimate.upper95 >= free[i].max)) {
            return unavailable("An approximate 95% interval reaches a parameter bound; symmetric uncertainty is not reliable. Intervals are not clipped.");
        }
        uncertainty.status = "estimated";
        uncertainty.covariance = covariance;
        uncertainty.varianceScale = scale;
        for (const { name, ...estimate } of estimates) uncertainty.parameters[name] = estimate;
        uncertainty.reason = "Standard errors are one-sigma local estimates; 95% intervals use estimate +/- 1.96 SE, not small-sample t or profile intervals.";
        return uncertainty;
    }

    function fit(data, config) {
        const number = (value, name) => {
            if (String(value).trim() === "" || !Number.isFinite(Number(value))) throw new Error(`${name} must be a finite number.`);
            return Number(value);
        };
        const low = number(config.low, "Fit minimum"), high = number(config.high, "Fit maximum");
        if (low >= high) throw new Error("Fit minimum must be smaller than fit maximum.");
        const maxIterations = number(config.iterations, "Iteration limit"), tolerance = number(config.tolerance, "Tolerance");
        if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 500) throw new Error("Iteration limit must be an integer from 1 to 500.");
        if (tolerance < 1e-12 || tolerance > 0.01) throw new Error("Relative tolerance must be between 1e-12 and 0.01.");
        if (config.model === "poisson" && !data.integerCounts) throw new Error("Poisson requires nonnegative integer observations with unit count; observations and the bin maximum must not exceed 10000.");
        const rows = data.rows.filter(row => data.histogram ? row.lower >= low && row.upper <= high : row.x >= low && row.x <= high);
        const parameters = config.parameters.map(parameter => {
            const initial = number(parameter.initial, `${parameter.name} initial value`);
            const min = parameter.min === "" ? -Infinity : number(parameter.min, `${parameter.name} minimum`);
            const max = parameter.max === "" ? Infinity : number(parameter.max, `${parameter.name} maximum`);
            if (min > max || initial < min || initial > max) throw new Error(`${parameter.name}: initial value must be inside ordered bounds.`);
            if (!parameter.fixed && min === max) throw new Error(`${parameter.name}: use Fixed for equal bounds.`);
            if (["n", "sigma"].includes(parameter.name) && (!(initial > 0) || !(min > 0))) throw new Error(`${parameter.name} requires a positive initial value and lower bound.`);
            if (["lambda", "background"].includes(parameter.name) && (initial < 0 || min < 0)) throw new Error(`${parameter.name} requires a nonnegative initial value and lower bound.`);
            return { ...parameter, initial, min, max };
        });
        const free = parameters.filter(parameter => !parameter.fixed);
        if (!rows.length || rows.length <= free.length) throw new Error("Select more observations or complete bins than free parameters.");
        const informative = config.model === "poisson" ? rows.filter(row => row.firstInteger <= row.lastInteger).length : rows.length;
        if (informative <= free.length) throw new Error("Select more bins containing possible integer outcomes than free parameters.");
        if (data.histogram && !rows.some(row => row.y > 0)) throw new Error("The fit range contains no observations.");
        if (!data.histogram && new Set(rows.map(row => row.x)).size <= free.length) throw new Error("The fit needs more distinct X values than free parameters.");
        const origin = Object.fromEntries(parameters.map(parameter => [parameter.name, parameter.initial]));
        const unpack = q => Object.fromEntries(parameters.map(parameter => {
            const index = free.indexOf(parameter);
            return [parameter.name, index < 0 ? parameter.initial : parameter.initial + q[index] * parameter.scale];
        }));
        const bounds = free.map(p => [(p.min - p.initial) / p.scale, (p.max - p.initial) / p.scale]);
        const evaluate = q => {
            const p = unpack(q);
            return rows.map(row => residual(row.y, predict(config.model, p, row, config.x0), config.objective));
        };
        const jacobian = q => free.map((_, j) => {
            const plus = q.slice(), minus = q.slice();
            plus[j] = clamp(q[j] + DIFFERENCE_STEP, ...bounds[j]); minus[j] = clamp(q[j] - DIFFERENCE_STEP, ...bounds[j]);
            const step = plus[j] - minus[j], rp = evaluate(plus), rm = evaluate(minus);
            return rp.map((value, i) => (value - rm[i]) / step);
        });
        let q = free.map(() => 0), r = evaluate(q), cost = sumSquares(r), damping = 1e-3;
        if (!Number.isFinite(cost)) throw new Error("Initial parameters produce invalid model values.");
        let status = free.length ? "Iteration limit reached" : "Fixed parameters evaluated", success = !free.length, iterations = 0;
        for (; iterations < maxIterations && !success; iterations++) {
            const columns = jacobian(q);
            if (columns.some(column => column.some(value => !Number.isFinite(value)))) { status = "Invalid numerical derivative"; break; }
            const gradient = columns.map(column => column.reduce((sum, value, i) => sum + value * r[i], 0));
            const normal = columns.map(a => columns.map(b => a.reduce((sum, value, i) => sum + value * b[i], 0)));
            const active = gradient.map((value, j) => (q[j] <= bounds[j][0] && value > 0) || (q[j] >= bounds[j][1] && value < 0));
            const projected = gradient.map((value, j) => active[j] ? 0 : Math.abs(value) / Math.sqrt(Math.max(normal[j][j], 1e-24)));
            if (Math.max(...projected) <= tolerance * Math.max(1, Math.sqrt(cost))) { success = true; status = "Converged: projected gradient"; break; }
            let accepted = false;
            for (let attempt = 0; attempt < 18; attempt++) {
                const matrix = normal.map((row, i) => row.map((value, j) => active[i] || active[j] ? Number(i === j) : value + (i === j ? damping * Math.max(normal[i][i], 1e-12) : 0)));
                const step = solve(matrix, gradient.map((value, j) => active[j] ? 0 : -value));
                if (!step) { damping *= 10; continue; }
                const next = q.map((value, j) => clamp(value + step[j], ...bounds[j]));
                const nextResidual = evaluate(next), nextCost = sumSquares(nextResidual);
                if (Number.isFinite(nextCost) && nextCost < cost) {
                    const change = cost - nextCost;
                    q = next; r = nextResidual; cost = nextCost; damping = Math.max(1e-12, damping / 3); accepted = true;
                    if (change <= tolerance * Math.max(1, cost)) { success = true; status = "Converged: relative objective change"; }
                    break;
                }
                damping *= 10;
            }
            if (!accepted) { status = "Search stalled; convergence not established"; break; }
        }
        if (success && free.length && !independentColumns(jacobian(q))) {
            success = false; status = "Parameters are not independently determined; fix a parameter or change the range";
        }
        const values = free.length ? unpack(q) : origin;
        const fitted = rows.map(row => ({ ...row, fitted: predict(config.model, values, row, config.x0) }));
        fitted.forEach(row => { row.residual = row.y - row.fitted; });
        const sse = sumSquares(fitted.map(row => row.residual));
        const mean = rows.reduce((total, row) => total + row.y, 0) / rows.length;
        const totalVariance = sumSquares(rows.map(row => row.y - mean));
        const result = { success, status, iterations, objective: cost, parameters: values, rows: fitted, free: free.length, informative, df: informative - free.length,
            rmse: Math.sqrt(sse / rows.length), r2: totalVariance > 0 ? 1 - sse / totalVariance : null,
            atBounds: free.filter(p => Math.abs(values[p.name] - p.min) <= 1e-7 * p.scale || Math.abs(values[p.name] - p.max) <= 1e-7 * p.scale).map(p => p.name) };
        result.uncertainty = parameterUncertainty(result, config, parameters);
        return result;
    }

    return { fit, predict, logFactorial };
})();
