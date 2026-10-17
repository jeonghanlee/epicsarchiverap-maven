// The options a viewer can change on a chart and the controls that change them.

/** The options a viewer can change on a chart, with the value each has until it is changed (see buildChartOptions). */
export const CHART_OPTIONS = { shape: "step", yscale: "linear", marks: "auto", average: false, band: false, window: 30 };

/**
 * The controls of the options of a chart: line shape, value scale, sample marks, running average, standard deviation
 * band and their window in samples. options is the object the page holds; onChange(next) is called with a new object
 * after each change, and the page draws the chart again with it. The page puts the returned element in its panel.
 * info is an element, an information control of the page, put at the end of the first row.
 */
export function buildChartOptions(options, onChange, info) {
    const current = { ...CHART_OPTIONS, ...options };
    const body = document.createElement("div");
    body.className = "opt-controls";
    const row = () => {
        const element = document.createElement("div");
        element.className = "opt-row";
        body.append(element);
        return element;
    };
    const apply = (name, value) => {
        current[name] = value;
        onChange({ ...current });
    };
    const select = (label, name, choices, convert = (v) => v) => {
        const wrap = document.createElement("label");
        wrap.append(`${label} `);
        const element = document.createElement("select");
        for (const [value, text] of choices) {
            const option = document.createElement("option");
            option.value = String(value);
            option.textContent = text;
            element.append(option);
        }
        element.value = String(current[name]);
        element.addEventListener("change", () => apply(name, convert(element.value)));
        wrap.append(element);
        return wrap;
    };
    const check = (label, name) => {
        const wrap = document.createElement("label");
        const element = document.createElement("input");
        element.type = "checkbox";
        element.checked = Boolean(current[name]);
        element.addEventListener("change", () => apply(name, element.checked));
        wrap.append(element, ` ${label}`);
        return wrap;
    };
    row().append(
        select("Line", "shape", [["step", "Step"], ["line", "Straight"], ["smooth", "Smooth"], ["points", "Points"]]),
        select("Y scale", "yscale", [["linear", "Linear"], ["symlog", "Symmetric log"], ["log", "Log"], ["sqrt", "Square root"]]),
        select("Marks", "marks", [["auto", "Auto"], ["on", "On"], ["off", "Off"]]),
        select("Window", "window", [[10, "10 samples"], [30, "30 samples"], [60, "60 samples"]], Number)
    );
    if (info) {
        info.classList.add("opt-info");
        body.firstElementChild.append(info);
    }
    row().append(check("Running average", "average"), check("Standard deviation band", "band"));
    return body;
}
