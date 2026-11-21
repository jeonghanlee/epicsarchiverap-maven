/* Fit configuration and result presentation for Distribution and Correlation. */
"use strict";

const FIT_MODELS = {
    distribution: [["normal", "Gaussian"], ["normal-background", "Gaussian + constant background"], ["poisson", "Poisson / integer counts"]],
    correlation: [["linear", "Linear"], ["quadratic", "Quadratic"], ["peak", "Gaussian + offset"]],
};
const fitSessions = {};
let activeFit = null;

function fitConfiguration(data, model) {
    const xs = data.values || data.rows.map(row => row.x), ys = data.rows.map(row => row.y);
    const mean = d3.mean(xs), spread = d3.deviation(xs) || (data.high - data.low) / 6;
    const xScale = Math.max(data.high - data.low, 1e-12), yScale = Math.max((d3.max(ys) - d3.min(ys)) || Math.abs(d3.mean(ys)), 1e-12);
    const parameters = [];
    const add = (name, initial, unit, scale, min = "", max = "") => parameters.push({ name, initial, unit, scale, min, max, fixed: false });
    const total = d3.sum(ys), x0 = data.histogram ? 0 : mean;
    if (data.histogram) {
        add("n", total, "samples / full distribution", Math.max(total, 1), 1e-9);
        if (model === "poisson") add("lambda", Math.max(mean, 0), data.xUnit, Math.max(mean, 1), 0);
        else {
            add("mu", mean, data.xUnit, spread);
            add("sigma", spread, data.xUnit, spread, Math.max(1e-12, xScale * 1e-6));
            if (model === "normal-background") add("background", 0, `samples / ${data.xUnit}`, Math.max(total / xScale / 10, 1e-12), 0);
        }
    } else if (model === "peak") {
        add("b", d3.min(ys), data.yUnit, yScale);
        add("a", yScale, data.yUnit, yScale);
        add("mu", data.rows.reduce((best, row) => row.y > best.y ? row : best).x, data.xUnit, xScale);
        add("sigma", xScale / 4, data.xUnit, xScale / 4, Math.max(xScale * 1e-6, 1e-12));
    } else {
        const ym = d3.mean(ys), xx = d3.sum(xs, x => (x - x0) ** 2);
        add("b", ym, data.yUnit, yScale);
        add("m", xx > 0 ? d3.sum(data.rows, row => (row.x - x0) * (row.y - ym)) / xx : 0, `${data.yUnit} / ${data.xUnit}`, yScale / xScale);
        if (model === "quadratic") add("q", 0, `${data.yUnit} / ${data.xUnit}^2`, yScale / xScale ** 2);
    }
    return { model, low: data.low, high: data.high, x0, objective: data.histogram ? "poisson" : "least-squares", parameters, iterations: 200, tolerance: 1e-8, curve: true, residuals: true };
}

function prepareFit(data) {
    const key = JSON.stringify([state.example, state.acquisition, state.from, state.to, state.status, state.scope,
        data.histogram ? [state.signal, state.bins, data.low, data.high] : [state.x, state.y]]);
    let session = fitSessions[state.view];
    if (!session || session.key !== key) {
        const changed = Boolean(session);
        session = { key, data, config: fitConfiguration(data, FIT_MODELS[state.view][0][0]), result: null,
            message: changed ? "Inputs changed. Review the reset settings and run a new fit." : "Choose settings, then Run fit." };
        fitSessions[state.view] = session;
    }
    activeFit = session;
    return session;
}

function fitPanel() {
    if (!activeFit) return '<h3>Fit</h3><p>Select available observations to configure a fit.</p>';
    const { config, data, result, message } = activeFit;
    const field = (label, name, value, extra = "") => `<label>${label}<input id="fit-${name}" data-fit-setting="${name}" type="number" step="any" value="${escapeText(value)}" ${extra}></label>`;
    let html = '<hr class="panel-rule"><h3>Fit</h3>' + selectField("Model", "fit-model", FIT_MODELS[state.view], config.model);
    const equations = { normal: "n times Gaussian probability in each bin", "normal-background": "Gaussian bin count + background * bin width", poisson: "n times Poisson probability in each bin", linear: "y = b + m * (x - x0)", quadratic: "y = b + m * (x - x0) + q * (x - x0)^2", peak: "y = b + a * exp(-0.5 * ((x - mu) / sigma)^2)" };
    html += `<p class="fit-equation">${!data.histogram && config.model !== "peak" ? `x0 = ${fmt(config.x0)} ${escapeText(data.xUnit)}` : "Model"}${helpHint("Fit model", equations[config.model] + (!data.histogram && config.model !== "peak" ? "; x0 is a fixed reference." : ""))}</p>`;
    if (data.histogram) html += selectField("Objective", "fit-objective", [["poisson", "Poisson deviance"], ["least-squares", "Unweighted least squares"]], config.objective);
    else html += '<p>Unweighted least squares in Y. No X uncertainty or time-lag correction.</p>';
    html += `<div class="fit-range-label">Fit range / ${escapeText(data.xUnit)}${helpHint("Fit range", data.histogram ? "Only complete bins inside the range are used, including empty bins. Display zoom does not alter this fit range." : "Both X endpoints are included. Display zoom does not alter this fit range.")}</div><div class="panel-pair">${field("Minimum", "low", config.low)}${field("Maximum", "high", config.high)}</div>`;
    html += config.parameters.map((parameter, index) => `<fieldset class="fit-parameter"><legend>${parameter.name} <small>${escapeText(parameter.unit)}</small></legend><div class="panel-pair"><label>Initial value<input id="fit-param-${parameter.name}" type="number" step="any" value="${parameter.initial}" data-fit-parameter="${index}" data-fit-field="initial"></label><label class="check"><input id="fit-fixed-${parameter.name}" type="checkbox" ${parameter.fixed ? "checked" : ""} data-fit-parameter="${index}" data-fit-field="fixed">Fixed</label></div><div class="panel-pair"><label>Lower bound<input id="fit-min-${parameter.name}" type="number" step="any" value="${parameter.min}" placeholder="Unbounded" data-fit-parameter="${index}" data-fit-field="min"></label><label>Upper bound<input id="fit-max-${parameter.name}" type="number" step="any" value="${parameter.max}" placeholder="Unbounded" data-fit-parameter="${index}" data-fit-field="max"></label></div></fieldset>`).join("");
    html += `<details class="fit-advanced"><summary>Solver settings</summary><div class="panel-pair">${field("Max iterations", "iterations", config.iterations, 'min="1" max="500"')}${field("Relative tolerance", "tolerance", config.tolerance, 'min="1e-12" max="0.01"')}</div><p>Bounded damped least squares with numerical derivatives. A convergence message is a stopping criterion, not evidence that the model describes the data.</p></details>`;
    html += ["curve", "residuals"].map(name => `<label class="check"><input id="fit-${name}" data-fit-setting="${name}" type="checkbox" ${config[name] ? "checked" : ""}>Show ${name === "curve" ? "fitted curve" : "residuals"}</label>`).join("");
    html += '<div class="fit-actions"><button id="run-fit" class="primary" type="button">Run fit</button><button id="reset-fit" type="button">Reset estimates</button></div>';
    html += `<p id="fit-status" role="status" class="fit-status ${result && !result.success ? "warning" : ""}">${escapeText(message)}</p><p>Results include one-sigma parameter errors and approximate 95% normal intervals when estimable. Fixed and constrained cases are labeled explicitly. Curve confidence bands are not calculated.</p>`;
    return html;
}

function fitParameterRows() {
    const { config, result } = activeFit;
    return config.parameters.map(parameter => {
        const uncertainty = result.uncertainty.parameters[parameter.name];
        return { model: config.model, parameter: parameter.name, value: result.parameters[parameter.name], unit: parameter.unit,
            standard_error: uncertainty.standardError, lower_95: uncertainty.lower95, upper_95: uncertainty.upper95,
            uncertainty_status: uncertainty.status, confidence_level: result.uncertainty.confidenceLevel,
            initial_value: parameter.initial, fixed: parameter.fixed, lower_bound: parameter.min, upper_bound: parameter.max,
            method: result.uncertainty.method, interval_method: result.uncertainty.intervalMethod,
            assumptions: result.uncertainty.assumptions, uncertainty_note: result.uncertainty.reason, source: "synthetic" };
    });
}

function fitParameterTable() {
    const uncertainty = activeFit.result.uncertainty;
    const format = value => d3.format(".7g")(value);
    const rows = fitParameterRows().map(parameter => {
        const missing = parameter.fixed ? "Fixed" : "Unavailable";
        return [parameter.parameter, format(parameter.value), parameter.standard_error === null ? missing : format(parameter.standard_error),
            parameter.lower_95 === null ? missing : `${format(parameter.lower_95)} to ${format(parameter.upper_95)}`,
            parameter.unit, parameter.fixed ? "Fixed" : `${parameter.lower_bound === "" ? "-inf" : parameter.lower_bound} to ${parameter.upper_bound === "" ? "+inf" : parameter.upper_bound}`];
    });
    return `<div id="fit-parameters">${table(["Parameter", "Fitted value", "Std. error / 1 sigma", "Approx. 95% interval", "Unit", "Constraint"], rows)}</div><div id="fit-uncertainty" class="data-note ${uncertainty.status === "unavailable" ? "warning" : ""}"><strong>Parameter uncertainty: ${escapeText(uncertainty.status)}</strong>${helpHint("Parameter uncertainty", `${uncertainty.method}. ${uncertainty.reason} ${uncertainty.assumptions} Fixed parameters are treated as exact. Model mismatch and calibration errors are not included.`)}${uncertainty.status === "unavailable" ? `<p>${escapeText(uncertainty.reason)}</p>` : ""}</div>`;
}

function drawFit(p) {
    const { result, config, message, data } = activeFit;
    if (!result?.success) {
        $("results-body").insertAdjacentHTML("beforeend", `<p id="fit-summary" class="plot-caption fit-summary">Fit: ${escapeText(message)}</p>`);
        return;
    }
    p.hoverFit = new Map(result.rows.map(row => [row.index, row]));
    p.fitUnit = data.yUnit;
    if (config.curve) {
        const curve = data.histogram ? result.rows : d3.range(201).map(i => {
            const x = Math.max(+config.low, data.low) + i / 200 * (Math.min(+config.high, data.high) - Math.max(+config.low, data.low));
            return { x, fitted: FitEngine.predict(config.model, result.parameters, { x }, config.x0) };
        });
        p.marks.append("path").datum(curve).attr("class", "fit-curve").attr("fill", "none").attr("stroke", color(2)).attr("stroke-width", 2.5).attr("stroke-dasharray", "8 3").attr("d", d3.line().defined(row => Number.isFinite(row.fitted)).x(row => p.x(row.x)).y(row => p.y(row.fitted)));
    }
    $("chart-area").insertAdjacentHTML("beforeend", `<p class="plot-caption fit-caption">Dashed: ${escapeText(FIT_MODELS[state.view].find(([id]) => id === config.model)[1])}${data.histogram ? " / expected counts at bin centers" : ""}. Fit range: ${fmt(+config.low)} to ${fmt(+config.high)} ${escapeText(data.xUnit)}.</p>`);
    if (config.residuals) {
        const target = document.createElement("div"); target.className = "fit-residuals"; $("chart-area").append(target);
        const extent = Math.max(d3.max(result.rows, row => Math.abs(row.residual)) || 1e-12, 1e-12);
        const residualPlot = plot(target, p.x.domain(), [-extent * 1.1, extent * 1.1], `X / ${data.xUnit}`, `Observed - fitted / ${data.yUnit}`, { height: 180 });
        sampleRangeSummary(residualPlot, result.rows, row => row.x, row => row.residual, "Fit residuals", data.xUnit, data.yUnit,
            { countLabel: data.histogram ? "Bins" : "Pairs", note: "Residuals are observed minus fitted values from the existing model. Zoom does not refit it or change the reported overall RMSE." });
        residualPlot.marks.append("line").attr("x1", residualPlot.x.range()[0]).attr("x2", residualPlot.x.range()[1]).attr("y1", residualPlot.y(0)).attr("y2", residualPlot.y(0)).attr("stroke", "#52676e").attr("stroke-dasharray", "4 3");
        residualPlot.marks.selectAll("circle").data(result.rows).join("circle").attr("cx", row => residualPlot.x(row.x)).attr("cy", row => residualPlot.y(row.residual)).attr("r", data.histogram ? 3 : 1.8).attr("fill", color(2)).attr("opacity", 0.65);
        pointHover(residualPlot, result.rows, row => row.x, row => row.residual, row => ({ title: "Fit residual", rows: [
            `X: ${fmt(row.x)} ${data.xUnit}`, `Observed: ${fmt(row.y)} ${data.yUnit}`,
            `Fitted: ${fmt(row.fitted)} ${data.yUnit}`, `Residual: ${fmt(row.residual)} ${data.yUnit}`] }));
    }
    const metricName = config.objective === "poisson" ? "Poisson deviance" : "Residual SSE";
    $("results-body").insertAdjacentHTML("beforeend", `<div id="fit-summary" class="fit-summary"><h3>Fit result</h3><p class="plot-caption">${escapeText(result.status)} / ${result.iterations} iterations. ${result.atBounds.length ? `At bound: ${result.atBounds.join(", ")}.` : ""}</p>${metrics([["Fit observations", result.rows.length, data.histogram ? "Complete bins, including empty bins" : "Pairs within the X fit range"], [metricName, fmt(result.objective), `${result.df} degrees of freedom; no p-value`], ["Residual RMSE", fmt(result.rmse), data.yUnit], [data.histogram ? "Fitted samples" : "R squared", data.histogram ? d3.sum(result.rows, row => row.y) : fmt(result.r2), data.histogram ? "Observed counts in included bins" : "Within the fit range"]])}${fitParameterTable()}</div>`);
    const fitted = new Map(result.rows.map(row => [row.index, row]));
    resultExport.forEach((row, index) => Object.assign(row, { fit_model: config.model, included_in_fit: fitted.has(index), fitted: fitted.get(index)?.fitted ?? null, residual: fitted.get(index)?.residual ?? null }));
}

function changeFit(input) {
    if (!activeFit) return false;
    const session = activeFit;
    if (input.id === "fit-model") {
        session.config = fitConfiguration(session.data, input.value);
    } else if (input.id === "fit-objective") session.config.objective = input.value;
    else if (input.dataset.fitParameter !== undefined) session.config.parameters[Number(input.dataset.fitParameter)][input.dataset.fitField] = input.type === "checkbox" ? input.checked : input.value;
    else if (input.dataset.fitSetting) session.config[input.dataset.fitSetting] = input.type === "checkbox" ? input.checked : input.value;
    else return false;
    if (!["curve", "residuals"].includes(input.dataset.fitSetting)) { session.result = null; session.message = "Settings changed. Run fit to calculate a new result."; }
    render();
    return true;
}

function runFit() {
    if (!activeFit) return;
    try {
        activeFit.result = FitEngine.fit(activeFit.data, activeFit.config);
        activeFit.message = activeFit.result.status + (activeFit.result.success ? ". Inspect the residuals." : ". No fitted curve is displayed; adjust the model, range, or initial values.");
    } catch (error) { activeFit.result = { success: false, status: error.message }; activeFit.message = error.message; }
    render();
}

function downloadFit(format = "json") {
    if (!activeFit?.result?.success) return;
    const { key, config, result, data } = activeFit;
    const report = { source: "synthetic", view: state.view, example: state.example, selection: JSON.parse(key), x_unit: data.xUnit, y_unit: data.yUnit, config, result };
    const csv = format === "csv";
    const url = URL.createObjectURL(new Blob([csv ? d3.csvFormat(fitParameterRows()) : JSON.stringify(report, null, 2)], { type: csv ? "text/csv;charset=utf-8" : "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `analyzer-${state.example}-${state.view}-fit${csv ? "-parameters.csv" : ".json"}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
