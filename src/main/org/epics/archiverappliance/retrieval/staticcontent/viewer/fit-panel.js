// The fit panel the Correlation and the Distribution tabs share: a model, its parameters with a start value, a fixed flag and
// bounds (regenerated from the model's guess when the data change), a fit range, Run fit, and the result with the parameters
// and their errors, the chi-square per degree of freedom, R squared, the degrees of freedom, the method and whether the search
// converged, plus the list of the earlier fits of the session. The fit runs from its button only; the tab draws the curve, the
// band and the residuals from the result through the helpers at the end.
import { node } from "../comm/js/aa/dom.js";
import { format } from "../comm/js/aa/chart/text.js";
import { finiteNumber } from "../comm/js/aa/chart/state.js";
import { MODELS, MODEL_NAMES, fitModel, modelValue, fitUncertaintyAt } from "../comm/js/aa/fit.js";

export const EARLIER_FITS_MOST = 5;
export const CURVE_POINTS = 200;
export const FIT_PANEL_DEFAULTS = Object.freeze({ model: "line", from: "", to: "" });

/** The text of a number for a field, short but exact enough to restart the fit. */
const fieldText = (v) => (Number.isFinite(v) ? Number(v.toPrecision(6)).toString() : "");

/**
 * Builds the panel into host. options: {label: the aria prefix of the controls, settings: {model, from, to} from the address,
 * changed(): called when a setting of the address changes, helpHref}. Returns {settings, result, earlier, setData(x, y, weights,
 * context), clear(), onResult(callback)}: setData gives the panel the points to fit (weights optional, context a text for the
 * list of earlier fits) and refreshes the parameter fields from the model's guess when the model or the data changed.
 */
export function createFitPanel(host, options) {
    const settings = { ...FIT_PANEL_DEFAULTS, ...(options.settings || {}) };
    const prefix = options.label || "Fit";
    const state = { x: [], y: [], weights: null, context: "", guessFor: null, result: null, earlier: [], listeners: [] };
    const model = node("select", { "aria-label": `${prefix} model` });
    for (const name of MODEL_NAMES) model.append(node("option", { value: name }, `${name[0].toUpperCase()}${name.slice(1)}: ${MODELS[name].text}`));
    model.value = settings.model;
    const from = node("input", { type: "text", inputmode: "decimal", size: "8", "aria-label": `${prefix} range from`, placeholder: "all" });
    const to = node("input", { type: "text", inputmode: "decimal", size: "8", "aria-label": `${prefix} range to`, placeholder: "all" });
    from.value = settings.from;
    to.value = settings.to;
    const run = node("button", { type: "button" }, "Run fit");
    const error = node("p", { class: "error", role: "alert" });
    const parameters = node("div", { class: "fit-parameters" });
    const results = node("div", { class: "fit-results" });
    const earlier = node("div", { class: "fit-earlier" });
    const field = (text, control) => node("label", null, text, control);
    host.replaceChildren(node("div", { class: "fit-controls" }, field("Model ", model), field("Fit from ", from), field("to ", to), run), parameters, error, results, earlier);

    const notify = () => { if (options.changed) options.changed(); };
    model.addEventListener("change", () => { settings.model = model.value; state.guessFor = null; buildParameters(); notify(); });
    for (const input of [from, to]) {
        input.addEventListener("change", () => {
            const text = input.value.trim();
            if (text !== "" && finiteNumber(text) === null) {
                error.textContent = "Enter a number for the fit range, or leave it empty for the whole range.";
                input.value = input === from ? settings.from : settings.to;
                return;
            }
            error.textContent = "";
            if (input === from) settings.from = text; else settings.to = text;
            notify();
        });
    }
    run.addEventListener("click", start);

    /** Names the model and the data the parameter fields were built for: the fields are rebuilt when the model, the data or the number of points inside the range changes. */
    const guessKey = () => `${settings.model}:${state.context}:${selected().x.length}`;

    /** The rows of parameter fields for the current model, with the start values from the model's guess over the data. */
    function buildParameters() {
        const definition = MODELS[settings.model];
        const inside = selected();
        const guess = definition.kind === "iterative" && inside.x.length ? definition.guess(inside.x, inside.y) : definition.parameters.map(() => 0);
        state.guessFor = guessKey();
        parameters.replaceChildren(...definition.parameters.map((name, k) => {
            const start = node("input", { type: "text", inputmode: "decimal", size: "9", "aria-label": `${prefix} start of ${name}`, "data-parameter": name });
            start.value = fieldText(guess[k]);
            const fixed = node("input", { type: "checkbox", "aria-label": `${prefix} fix ${name}` });
            const lower = node("input", { type: "text", inputmode: "decimal", size: "7", "aria-label": `${prefix} lower bound of ${name}`, placeholder: "none" });
            const upper = node("input", { type: "text", inputmode: "decimal", size: "7", "aria-label": `${prefix} upper bound of ${name}`, placeholder: "none" });
            const iterative = definition.kind === "iterative";
            for (const control of [start, fixed, lower, upper]) control.disabled = !iterative;
            return node("div", { class: "fit-parameter", "data-parameter": name }, node("span", { class: "fit-parameter-name" }, name), field("start ", start), node("label", { class: "check-inline" }, fixed, " fixed"), field("from ", lower), field("to ", upper));
        }));
        if (definition.kind === "linear") parameters.append(node("p", { class: "note" }, `${definition.text} is solved by least squares; it has no start values, fixed parameters or bounds.`));
    }

    /** The points inside the fit range. */
    function selected() {
        const low = settings.from === "" ? -Infinity : finiteNumber(settings.from);
        const high = settings.to === "" ? Infinity : finiteNumber(settings.to);
        const x = [];
        const y = [];
        const weights = state.weights ? [] : null;
        state.x.forEach((v, i) => {
            if (v >= low && v <= high) {
                x.push(v);
                y.push(state.y[i]);
                if (weights) weights.push(state.weights[i]);
            }
        });
        return { x, y, weights, low, high };
    }

    function start() {
        error.textContent = "";
        const definition = MODELS[settings.model];
        const inside = selected();
        if (!(inside.low < inside.high)) { error.textContent = "The fit range must start before it ends."; return; }
        if (!inside.x.length) { error.textContent = "No point lies in the fit range."; return; }
        const fields = [...parameters.querySelectorAll(".fit-parameter")];
        const startValues = [];
        const fixed = [];
        const lower = [];
        const upper = [];
        for (const [k, row] of fields.entries()) {
            const inputs = row.querySelectorAll("input");
            const value = finiteNumber(inputs[0].value);
            if (definition.kind === "iterative" && value === null) { error.textContent = `Enter a start value for ${definition.parameters[k]}.`; return; }
            startValues.push(value ?? 0);
            if (inputs[1].checked) fixed.push(k);
            const lo = inputs[2].value.trim() === "" ? null : finiteNumber(inputs[2].value);
            const hi = inputs[3].value.trim() === "" ? null : finiteNumber(inputs[3].value);
            if ((inputs[2].value.trim() !== "" && lo === null) || (inputs[3].value.trim() !== "" && hi === null)) { error.textContent = `Enter numbers for the bounds of ${definition.parameters[k]}, or leave them empty.`; return; }
            if (lo !== null && hi !== null && !(lo < hi)) { error.textContent = `The lower bound of ${definition.parameters[k]} must lie below the upper one.`; return; }
            if (lo !== null && value !== null && value < lo) { error.textContent = `The start value of ${definition.parameters[k]} lies below its lower bound.`; return; }
            if (hi !== null && value !== null && value > hi) { error.textContent = `The start value of ${definition.parameters[k]} lies above its upper bound.`; return; }
            lower.push(lo);
            upper.push(hi);
        }
        if (fixed.length === definition.parameters.length) { error.textContent = "Every parameter is fixed; nothing is left to fit."; return; }
        const fit = fitModel(settings.model, inside.x, inside.y, { start: startValues, fixed, lower, upper, weights: inside.weights });
        if (!fit.ok) { error.textContent = fit.reason; state.result = null; results.replaceChildren(); emit(); return; }
        state.result = { ...fit, model: settings.model, definition, range: [inside.low, inside.high], count: inside.x.length, fixed, lower, upper, weightsOffered: Boolean(inside.weights), context: state.context, at: new Date() };
        state.earlier.unshift(state.result);
        if (state.earlier.length > EARLIER_FITS_MOST) state.earlier.length = EARLIER_FITS_MOST;
        showResult();
        emit();
    }

    function showResult() {
        const r = state.result;
        results.replaceChildren();
        earlier.replaceChildren();
        if (!r) return;
        const rows = r.definition.parameters.map((name, k) => {
            const free = r.free.indexOf(k);
            const value = format(r.params[k], "");
            const text = r.fixed.includes(k) ? `${value} (fixed; no error)` : free >= 0 && Number.isFinite(r.errors[free]) ? `${value} ± ${format(r.errors[free], "")}${(r.lower[k] !== null && r.params[k] <= r.lower[k]) || (r.upper[k] !== null && r.params[k] >= r.upper[k]) ? " (at its bound)" : ""}` : `${value} (error not available)`;
            return [name, text];
        });
        rows.push(["Chi-square per degree of freedom", `${format(r.chi2PerDof, "")} (${r.dof} degrees of freedom, ${r.count} points${r.range[0] === -Infinity && r.range[1] === Infinity ? "" : ` in the range ${format(r.range[0], "")} to ${format(r.range[1], "")}`})`]);
        rows.push(["R squared", r.rSquared === null ? "not defined (the values do not vary)" : `${format(r.rSquared, "")}${r.weighted ? " (from the unweighted residuals)" : ""}`]);
        rows.push(["Method", methodText(r)]);
        results.append(node("table", { class: "chart-stats fit-table", "aria-label": `${prefix} result` }, node("tbody", null, ...rows.map(([name, value]) => node("tr", { "data-row": name }, node("th", { scope: "row" }, name), node("td", null, value))))));
        if (state.earlier.length > 1) {
            earlier.append(node("h4", { class: "fit-earlier-title" }, "Earlier fits"), node("ul", null, ...state.earlier.slice(1).map((f) => node("li", null,
                `${f.model} on ${f.context || "the data"}: ${f.definition.parameters.map((name, k) => `${name} ${format(f.params[k], "")}`).join(", ")}; chi-square per degree of freedom ${format(f.chi2PerDof, "")}`))));
        }
    }

    function emit() { for (const listener of state.listeners) listener(state.result); }

    return {
        settings,
        get result() { return state.result; },
        element: host,
        /** The points the next fit uses; the parameter fields follow the model's guess when the model or the number of points changed. */
        setData(x, y, weights, context) {
            state.x = x;
            state.y = y;
            state.weights = weights || null;
            state.context = context || "";
            model.value = settings.model;
            from.value = settings.from;
            to.value = settings.to;
            if (state.guessFor !== guessKey()) buildParameters();
        },
        /** Drops the result (the inputs changed), keeping the earlier fits list. */
        clear() { state.result = null; results.replaceChildren(); earlier.replaceChildren(); },
        onResult(listener) { state.listeners.push(listener); },
        setEnabled(enabled) { run.disabled = !enabled; },
    };
}

/**
 * The method of a fit result in words: least squares (weighted or not, or in a transformed variable) or Levenberg-Marquardt with
 * its iterations and convergence, and where the errors come from: the covariance as it is for a weighted fit, scaled by the
 * reduced chi-square for an unweighted one. Weights offered to a model fitted in a transformed variable are named as not applied.
 */
export function methodText(r) {
    const weighting = r.weighted ? "weighted by one over the count of each bin (Poisson), the errors from the covariance as it is" : "unweighted, the errors from the covariance scaled by the reduced chi-square";
    if (r.definition.kind === "linear" && r.definition.transformY) {
        return `least squares of the transformed values (${r.definition.text} is linear in a transformed variable), unweighted; the errors of the natural parameters follow from those of the transformed ones${r.weightsOffered ? "; the Poisson weights do not apply to a model fitted in a transformed variable" : ""}`;
    }
    if (r.definition.kind === "linear") return `least squares, ${weighting}`;
    return `Levenberg-Marquardt from the start values, ${r.iterations} iteration${r.iterations === 1 ? "" : "s"}, ${r.converged ? "converged" : "stopped before convergence"}; ${weighting}`;
}

/** The fitted curve over count points between low and high: [{x, y, sigma}] with the one-sigma half width of the band. */
export function fittedCurve(result, low, high, count = CURVE_POINTS) {
    const points = [];
    for (let i = 0; i < count; i += 1) {
        const x = low + ((high - low) * i) / (count - 1);
        const y = modelValue(result.model, x, result.params);
        if (Number.isFinite(y)) points.push({ x, y, sigma: fitUncertaintyAt(result.model, result, x) });
    }
    return points;
}

/** The residuals of the points inside the fit range: [{x, r}] with r the observed minus the fitted value. */
export function residualsOf(result, xs, ys) {
    const out = [];
    xs.forEach((x, i) => {
        if (x >= result.range[0] && x <= result.range[1]) out.push({ x, r: ys[i] - modelValue(result.model, x, result.params) });
    });
    return out;
}
