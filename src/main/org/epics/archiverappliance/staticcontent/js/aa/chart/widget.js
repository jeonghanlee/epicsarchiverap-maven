// The chart widget: a chart with everything it needs, placed by a page. It builds the row with the Options button, the link into
// the analyzer and the Enlarge chart button, the Options panel with its Projection and Chart tabs, the large window, and the
// information cards, and it keeps the options between draws. A page gives the series and the window at each refresh.
import { infoButton } from "../card.js";
import { node } from "../dom.js";
import { MARKER_LIMIT, drawTimeSeries } from "./draw.js";
import { currentZone, formatInZone, onZoneChange } from "../timezone.js";
import { onProfileChange } from "./profile.js";
import { NAVIGATION_TARGETS, TOOLS } from "./gestures.js";
import { buildChartOptions, CHART_OPTIONS, normalizeOptions } from "./options.js";
import { validRanges, withChartState } from "./state.js";
import { buildRangeStrip } from "./strip.js";
import { heldObservation } from "./cursors.js";
import { format } from "./text.js";

// The time of a pin or a cursor reading in the toolbar.
const TOOL_TIME_FORMAT = "%Y-%m-%d %H:%M:%S";

/** The navigation, reference and history state of a chart with the tools, validated; fields absent or unreadable are left alone. */
function applyToolState(memory, state) {
    if (TOOLS.includes(state.tool)) {
        memory.tool = state.tool;
    }
    for (const name of ["wheel", "hover"]) {
        if (typeof state[name] === "boolean") {
            memory[name] = state[name];
        }
    }
    if (NAVIGATION_TARGETS.includes(state.nav)) {
        memory.nav = state.nav;
        memory.navUnit = state.nav === "x" ? null : typeof state.navUnit === "string" ? state.navUnit : null;
    }
    if (Array.isArray(state.cursors)) {
        memory.cursors = [0, 1].map((index) => {
            const time = state.cursors[index];
            const date = time === null || time === undefined ? null : new Date(time);
            return date && Number.isFinite(date.getTime()) ? date : null;
        });
    }
    if (Array.isArray(state.pins)) {
        memory.pins = state.pins
            .filter((pin) => pin && typeof pin.name === "string" && Number.isFinite(pin.t) && Number.isFinite(pin.v))
            .map((pin) => ({ name: pin.name, egu: typeof pin.egu === "string" ? pin.egu : "", t: pin.t, v: pin.v, s: Number(pin.s) || 0 }));
    }
}

// The options, the open tab and the state of the panel of each chart, by the id the page gives it. A page that builds its
// host again at each refresh builds the widget again and finds the choice of the person here.
const MEMORY = new Map();

// The least height of the large window's drawing, and the room that its head and the table take.
const ENLARGED_LEAST = 380;
const ENLARGED_ROOM = 320;

/**
 * The information cards of the chart, with their link into the help page: [title, rows, action, help], the title a question
 * and In short the first row. A chart without time controls has no drag window.
 */
function cardsOf(helpHref, timed) {
    return {
        range: [
            "Time and value range: how do I zoom?",
            [
                [
                    "In short",
                    timed
                        ? "Drag across the plot for a time window, or along an axis for a value range; the line above the chart writes both."
                        : "Drag along an axis for a value range; the line above the chart writes the time window and the ranges.",
                ],
                [
                    "Time window",
                    timed
                        ? "Drag across the plot to look at that window. Earlier and Later move it by half its span, also before you drag; Back to the selected range, or a double-click, returns to that range. The date and hour both ends share are written once, before the brackets."
                        : "The line above the chart writes the time window of the chart. The date and hour both ends share are written once, before the brackets.",
                ],
                [
                    "Value range",
                    timed
                        ? "Drag along an axis, or Tab to it and use the arrow keys, + and -, to choose the range of that unit. The control of its unit returns it to the automatic range; so does Home or a double-click, and All resets the window and every range. The statistics follow it."
                        : "Drag along an axis, or Tab to it and use the arrow keys, + and -, to choose the range of that unit. The control of its unit returns it to the automatic range; so does Home or a double-click, and All resets every range. The statistics follow it.",
                ],
                ["Notation", "A bracket includes the data at that end and a parenthesis leaves it out: [a, b] includes both ends, (a, b] leaves the start out."],
            ],
            null,
            helpHref,
        ],
        options: [
            "Chart options: how is the line drawn?",
            [
                ["In short", "Line, Y scale and Marks change how the samples are drawn; the running average and the band add a smoothed view over a window of samples."],
                ["Line", "Step holds a value until the next sample, Straight joins the samples, Smooth curves between them, Points draws the samples only."],
                ["Y scale", "Symmetric log and Log compress large values. Log needs values above zero and Square root values not below zero; otherwise Symmetric log is shown, with the reason."],
                ["Marks", `Auto marks the samples when at most ${MARKER_LIMIT} are in view, On marks every sample, Off hides them.`],
                ["Window", "How many of the last samples the running average and the band use at each point."],
                ["Running average and band", "The running average is the mean of the samples of the window at each point; the band is one standard deviation around that mean."],
            ],
            null,
            helpHref,
        ],
        statistics: [
            "Statistics: what do the columns count?",
            [
                ["In short", "The table counts the samples now inside the chart: the time window shown and any value range dragged on an axis."],
                ["Columns", "Samples is their number; Min, Mean, Median and Max their smallest value, mean, median and largest value; Std dev their standard deviation; Unit the unit of the PV."],
                ["Histogram", "The histogram at the right edge shows how the samples spread over the value axis; its line is the mean."],
            ],
            null,
            helpHref,
        ],
    };
}

/**
 * Builds the chart in host and returns {draw(data), message(text), getState(), setState(patch), options}.
 * config, given once: id (the key of the choices the widget keeps), idPrefix (puts a prefix before the id of each control, for a
 * page with more than one chart; without it the ids are options, enlarge, chart and so on), title and dialogTitle (the headings of
 * the row and of the large window; both optional), help ([title, rows, action, helpHref] of the card of how to read this chart,
 * optional), helpHref (the help page of the cards of the widget), legend, labelNames, strip, timeZone (the zone the times are written
 * in; without it the choice of the application, which the widget follows when it changes), and the optional callbacks
 * onZoom(from, to), onPan(direction), onReset() and onOptionsChange(options). A chart with none of the three time callbacks has no
 * drag over the plot and no Earlier, Later or Back to the selected range.
 * draw(data), at each refresh: series, from, to, gapMs, windowChosen, canPanLater and analyzerHref (a string, or null for no link).
 * message(text) shows a text in place of the chart. options is the object of the options the person chose.
 * initialState initializes {options, projection, ranges: [[unit, [low, high]]], hidden: [name]}.
 * getState() returns a copy; setState(patch) validates, redraws and reports through onStateChange(state).
 * controlsHost places the option controls outside the widget and leaves its ordinary toolbar out. statisticsHost
 * places statistics independently of projection; rangeHost places a time-only strip outside the drawing.
 * fitWidth scales a drawing with many axes to its host instead of scrolling it horizontally.
 * tools true adds the toolbar of the analyzer: the drag tool (Select, Pan, Box zoom), Ctrl+wheel zoom, hover, the axes
 * navigation moves, Undo, Redo and Reset of the window and the ranges, the two cursors and the pinned samples. It goes
 * into toolbarHost, or above the chart. onApply(from, to) receives the candidate selection when Apply is pressed. The
 * history, the pins and the selection belong to one dataset: a draw whose data carries a new datasetKey starts them anew.
 * initialState and setState also take tool, wheel, hover, nav, navUnit, cursors and pins; getState returns them.
 */
export function createChart(host, config) {
    const memory = MEMORY.get(config.id) || { options: { ...CHART_OPTIONS }, optionsOpen: false, optionsTab: "projection" };
    memory.ranges ||= new Map();
    memory.hidden ||= new Set();
    memory.projection ??= null;
    memory.tool ||= "select";
    memory.wheel ??= false;
    memory.hover ??= true;
    memory.nav ||= "x";
    memory.navUnit ??= null;
    memory.selection ??= null;
    memory.cursors ||= [null, null];
    memory.pins ||= [];
    memory.history ||= { undo: [], redo: [] };
    memory.recorded ??= null;
    if (config.initialState) {
        memory.options = normalizeOptions(config.initialState.options);
        memory.projection = config.initialState.projection === true;
        memory.ranges = new Map(validRanges(config.initialState.ranges));
        memory.hidden = new Set(config.initialState.hidden || []);
        applyToolState(memory, config.initialState);
    }
    MEMORY.set(config.id, memory);
    const idOf = (role) => (config.idPrefix ? `${config.idPrefix}-${role}` : role);
    const helpHref = config.helpHref || "help.html";
    const timed = ["onZoom", "onPan", "onReset"].some((name) => typeof config[name] === "function");
    const cards = cardsOf(helpHref, timed);
    let last = null;
    let enlarged = false;
    let home = null;
    let dialog = null;
    let dialogBody = null;

    const toggle = (role) =>
        node("button", { type: "button", id: idOf(role), class: "opt-toggle", "aria-expanded": String(memory.optionsOpen), "aria-controls": idOf("optionsPanel") }, "Options");
    const analyzerLink = (role) => node("a", { id: idOf(role), class: "plain-link", href: "#", target: "_blank", rel: "noopener", hidden: "" }, "Open in the analyzer");
    const links = [];
    const trackLink = (anchor) => {
        links.push(anchor);
        return anchor;
    };

    const toggles = [toggle("optionsToggle")];
    const enlargeButton = node("button", { type: "button", id: idOf("enlarge"), class: "plain" }, "Enlarge chart");
    const pageLink = trackLink(analyzerLink("openAnalyzer"));
    const infoSlot = node("span", { id: idOf("chartInfo") });
    const head = node(
        "div",
        { class: "inspect-head" },
        config.title ? node("h2", { class: "area" }, `${config.title} `, infoSlot) : null,
        toggles[0],
        node("span", { class: "chart-tools" }, pageLink, " ", enlargeButton),
    );
    if (config.help) {
        infoSlot.append(infoButton(...config.help));
    }

    const tabProjection = node("button", { type: "button", role: "tab", class: "opt-tab", id: idOf("tabProjection"), "aria-controls": idOf("panelProjection") }, "Projection");
    const tabChart = node("button", { type: "button", role: "tab", class: "opt-tab", id: idOf("tabChart"), "aria-controls": idOf("panelChart") }, "Chart");
    const projectionStats = node("div", { id: idOf("projectionStats") });
    const panelProjection = node("div", { class: "opt-body", id: idOf("panelProjection"), role: "tabpanel", "aria-labelledby": idOf("tabProjection") }, projectionStats);
    const panelChart = node("div", { class: "opt-body", id: idOf("panelChart"), role: "tabpanel", "aria-labelledby": idOf("tabChart") });
    const panel = node(
        "div",
        { class: "opt-panel", id: idOf("optionsPanel") },
        node("div", { class: "opt-tabs", role: "tablist", "aria-label": "Options" }, tabProjection, tabChart),
        panelProjection,
        panelChart,
    );
    const chartHost = node("div", { id: idOf("chart"), class: "chart" });
    const toolbarHost = config.tools === true ? config.toolbarHost || node("div", { id: idOf("tools") }) : null;
    const area = node("div", { id: idOf("plotArea"), class: "chart-area" }, config.controlsHost ? null : panel,
        toolbarHost && !config.toolbarHost ? toolbarHost : null, chartHost);
    host.textContent = "";
    host.append(...(config.controlsHost ? [area] : [head, area]));
    let restoring = false;

    // A change of the zone of the application redraws the last data in the new zone.
    onZoneChange(() => redraw());
    // A change of the display profile draws the last data again with the combinations of the new profile.
    onProfileChange(() => redraw());

    /** The projection is on while the panel is open on its Projection tab. */
    const projectionOn = () => memory.projection === null ? memory.optionsOpen && memory.optionsTab === "projection" : memory.projection;

    function getState() {
        return { options: { ...memory.options }, projection: projectionOn(),
            ranges: validRanges([...memory.ranges]), hidden: [...memory.hidden],
            tool: memory.tool, wheel: memory.wheel, hover: memory.hover, nav: memory.nav, navUnit: memory.navUnit,
            cursors: memory.cursors.map((time) => (time ? new Date(time) : null)), pins: memory.pins.map((pin) => ({ ...pin })) };
    }

    /** The window and the ranges as drawn, the unit of the history; null before the first drawing. */
    function snapshot() {
        if (!last) {
            return null;
        }
        const ranges = validRanges([...memory.ranges]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
        return { from: last.from, to: last.to, ranges };
    }

    function sameSnapshot(a, b) {
        return Boolean(a && b) && +a.from === +b.from && +a.to === +b.to && a.ranges.length === b.ranges.length
            && a.ranges.every(([unit, range], index) => b.ranges[index][0] === unit
                && b.ranges[index][1][0] === range[0] && b.ranges[index][1][1] === range[1]);
    }

    /** Records the state as drawn: a change since the last record is one step of the history, and clears Redo. */
    function remember() {
        const now = snapshot();
        if (!now) {
            return;
        }
        if (!restoring && memory.recorded && !sameSnapshot(now, memory.recorded)) {
            memory.history.undo.push(memory.recorded);
            memory.history.redo.length = 0;
        }
        memory.recorded = now;
    }

    /** Returns to a recorded window and ranges: through the page when the window differs, which retrieves it again. */
    function restoreSnapshot(target) {
        restoring = true;
        memory.ranges = new Map(validRanges(target.ranges));
        const moved = last && (+last.from !== +target.from || +last.to !== +target.to);
        if (moved && typeof config.onZoom === "function") {
            config.onZoom(target.from, target.to);
        } else {
            redraw();
        }
        memory.recorded = target;
        restoring = false;
        changed();
    }

    function undo() {
        const target = memory.history.undo.pop();
        if (!target) {
            return;
        }
        const now = snapshot();
        if (now) {
            memory.history.redo.push(now);
        }
        restoreSnapshot(target);
    }

    function redo() {
        const target = memory.history.redo.pop();
        if (!target) {
            return;
        }
        const now = snapshot();
        if (now) {
            memory.history.undo.push(now);
        }
        restoreSnapshot(target);
    }

    /** Back to the selected range and the automatic ranges, as the All control of the strip; one step of the history. */
    function resetAll() {
        memory.ranges.clear();
        if (last && last.windowChosen && typeof config.onReset === "function") {
            config.onReset();
        } else {
            redraw();
        }
        changed();
    }

    function onSelect(range) {
        memory.selection = range;
        toolbarControls();
    }

    function onPin(observation) {
        if (memory.pins.some((pin) => pin.name === observation.name && pin.t === observation.t)) {
            return;
        }
        memory.pins.push({ ...observation });
        redraw();
        changed();
    }

    function onCursorChange(index, time) {
        memory.cursors[index] = time;
        redraw();
        changed();
    }

    /** Pins, for every drawn line, the observation the cursor reads: the keyboard's way to a pin. */
    function pinAtCursor(index) {
        const time = memory.cursors[index];
        if (!last || !time) {
            return;
        }
        const hidden = memory.hidden;
        let added = false;
        for (const series of last.series) {
            if (hidden.has(series.name)) {
                continue;
            }
            const observation = heldObservation(series.points.filter((p) => Number.isFinite(p.v)), last.gapMs, +time);
            if (observation && !memory.pins.some((pin) => pin.name === series.name && pin.t === observation.t)) {
                memory.pins.push({ name: series.name, egu: series.egu || "", t: observation.t, v: observation.v, s: observation.s });
                added = true;
            }
        }
        if (added) {
            redraw();
            changed();
        }
    }

    /** The toolbar of the analyzer plot, built again after each change; the control that had the focus keeps it. */
    function toolbarControls() {
        if (!toolbarHost) {
            return;
        }
        const focused = toolbarHost.contains(document.activeElement) ? document.activeElement.dataset.role : null;
        toolbarHost.replaceChildren(buildToolbar());
        if (focused) {
            const control = toolbarHost.querySelector(`[data-role="${focused}"]`);
            if (control) {
                control.focus({ preventScroll: true });
            }
        }
    }

    function buildToolbar() {
        const zone = config.timeZone || currentZone();
        const button = (label, role, active, action) => {
            const element = node("button", { type: "button", class: "tool", "data-role": role, disabled: active ? null : "" }, label);
            element.addEventListener("click", action);
            return element;
        };
        const toggle = (label, name) => {
            const box = node("input", { type: "checkbox", "data-role": name });
            box.checked = memory[name] === true;
            box.addEventListener("change", () => {
                memory[name] = box.checked;
                redraw();
                changed();
            });
            return node("label", { class: "tool-toggle" }, box, ` ${label}`);
        };
        const tools = node("span", { class: "tool-group", role: "radiogroup", "aria-label": "Drag tool" });
        for (const [value, label] of [["select", "Select"], ["pan", "Pan"], ["box", "Box zoom"]]) {
            const active = memory.tool === value;
            const element = node("button", { type: "button", role: "radio", "aria-checked": String(active),
                class: active ? "tool active" : "tool", "data-role": `tool-${value}` }, label);
            element.addEventListener("click", () => {
                if (!active) {
                    memory.tool = value;
                    memory.selection = null;
                    redraw();
                    changed();
                }
            });
            tools.append(element);
        }
        const apply = button("Apply selection", "apply", Boolean(memory.selection), () => {
            const range = memory.selection;
            if (range && typeof config.onApply === "function") {
                memory.selection = null;
                config.onApply(range[0], range[1]);
            }
        });
        const clear = button("Clear selection", "clear", Boolean(memory.selection), () => {
            memory.selection = null;
            redraw();
            changed();
        });
        const navSelect = node("select", { "aria-label": "Axes that Pan, Box zoom and the wheel move", "data-role": "nav" });
        const units = last ? [...new Set(last.series.map((s) => s.egu || ""))] : [];
        const choices = [["x", "", "Time axis"]];
        for (const unit of units) {
            choices.push(["y", unit, `Value axis: ${unit || "no unit"}`], ["xy", unit, `Both axes: ${unit || "no unit"}`]);
        }
        for (const [nav, unit, label] of choices) {
            const option = node("option", { value: `${nav}\n${unit}` }, label);
            option.selected = memory.nav === nav && (nav === "x" || memory.navUnit === unit);
            navSelect.append(option);
        }
        navSelect.addEventListener("change", () => {
            const [nav, unit] = navSelect.value.split("\n");
            memory.nav = nav;
            memory.navUnit = nav === "x" ? null : unit;
            redraw();
            changed();
        });
        const history = node("span", { class: "tool-group" },
            button("Undo", "undo", memory.history.undo.length > 0, undo),
            button("Redo", "redo", memory.history.redo.length > 0, redo),
            button("Reset", "reset", Boolean(last), resetAll));
        const cursors = node("span", { class: "tool-group" });
        [0, 1].forEach((index) => {
            const box = node("input", { type: "checkbox", "data-role": `cursor-${index}` });
            box.checked = memory.cursors[index] !== null;
            box.addEventListener("change", () => {
                if (box.checked && last) {
                    memory.cursors[index] = new Date(last.from.getTime() + ((last.to - last.from) * (index + 1)) / 3);
                } else {
                    memory.cursors[index] = null;
                }
                redraw();
                changed();
            });
            const time = memory.cursors[index] ? ` ${formatInZone(memory.cursors[index], TOOL_TIME_FORMAT, zone)}` : "";
            cursors.append(node("label", { class: "tool-toggle" }, box, ` Cursor ${index + 1}${time}`));
            if (memory.cursors[index]) {
                cursors.append(button(`Pin at cursor ${index + 1}`, `pin-cursor-${index}`, true, () => pinAtCursor(index)));
            }
        });
        const pins = memory.pins.length === 0 ? null : node("ul", { class: "tool-pins", "aria-label": "Pinned samples" },
            ...memory.pins.map((pin, index) => {
                const remove = node("button", { type: "button", class: "plain", "aria-label": `Unpin ${pin.name}` }, "Unpin");
                remove.addEventListener("click", () => {
                    memory.pins.splice(index, 1);
                    redraw();
                    changed();
                });
                return node("li", null, `${pin.name} ${format(pin.v, pin.egu)} at ${formatInZone(new Date(pin.t), TOOL_TIME_FORMAT, zone)} `, remove);
            }));
        return node("div", { class: "chart-toolbar", role: "toolbar", "aria-label": "Plot tools" },
            tools, apply, clear, toggle("Ctrl+wheel zoom", "wheel"), toggle("Hover", "hover"),
            node("label", { class: "tool-toggle" }, "Navigate ", navSelect), history, cursors, pins);
    }

    function updateLinks() {
        for (const anchor of links) {
            anchor.hidden = !last?.analyzerHref;
            anchor.setAttribute("href", last?.analyzerHref ? withChartState(last.analyzerHref, getState()) : "#");
        }
    }

    /** The time-only strip of the page's rangeHost; window names a window other than the drawn one while a gesture runs. */
    function rangeControls(window) {
        if (config.rangeHost && last) {
            config.rangeHost.replaceChildren(buildRangeStrip({ ...last, ...(window || {}), timeZone: config.timeZone || currentZone(),
                onPan: config.onPan, onReset: config.onReset, values: false }, memory.ranges, [], redraw));
        }
    }

    function changed() {
        remember();
        updateLinks();
        rangeControls();
        toolbarControls();
        if (typeof config.onStateChange === "function") {
            config.onStateChange(getState());
        }
    }

    function setState(patch) {
        if (patch.options) {
            memory.options = normalizeOptions({ ...memory.options, ...patch.options });
            optionControls();
        }
        if (typeof patch.projection === "boolean") {
            memory.projection = patch.projection;
        }
        if (patch.ranges) {
            memory.ranges = new Map(validRanges(patch.ranges));
        }
        if (patch.hidden) {
            memory.hidden = new Set(patch.hidden);
        }
        applyToolState(memory, patch);
        redraw();
        changed();
    }

    function redraw() {
        if (last) {
            draw(last);
        }
    }

    function draw(data) {
        last = data;
        // A new dataset (other PVs or another selected range) starts the history, the pins and the selection anew.
        if (data.datasetKey !== undefined && data.datasetKey !== memory.datasetKey) {
            const first = memory.datasetKey === undefined;
            memory.datasetKey = data.datasetKey;
            if (!first) {
                memory.history = { undo: [], redo: [] };
                memory.recorded = null;
                memory.pins = [];
                memory.selection = null;
            }
        }
        const input = {
            tool: config.tools === true ? memory.tool : undefined,
            wheel: config.tools === true ? memory.wheel : undefined,
            hover: memory.hover,
            nav: memory.nav,
            navUnit: memory.navUnit,
            selection: memory.selection,
            cursors: memory.cursors,
            pins: memory.pins,
            onSelect,
            onPin,
            onCursorChange,
            series: data.series,
            from: data.from,
            to: data.to,
            gapMs: data.gapMs,
            legend: config.legend,
            labelNames: config.labelNames,
            strip: config.rangeHost ? false : config.strip,
            fitWidth: config.fitWidth,
            timeZone: config.timeZone || currentZone(),
            projection: projectionOn(),
            // The table of the Y projection is in the Projection tab above the chart, on the page and in the large window alike.
            statisticsHost: config.statisticsHost || projectionStats,
            statistics: Boolean(config.statisticsHost),
            ranges: memory.ranges,
            hidden: memory.hidden,
            onRangesChange: changed,
            onVisibilityChange: changed,
            info: (topic) => (topic === "statistics" ? infoButton(...cards.statistics) : topic === "range" ? infoButton(...cards.range) : null),
            windowChosen: data.windowChosen,
            canPanLater: data.canPanLater,
            onPan: config.onPan,
            height: enlarged ? Math.max(ENLARGED_LEAST, window.innerHeight - ENLARGED_ROOM) : undefined,
            options: memory.options,
            onZoom: config.onZoom,
            onReset: config.onReset,
        };
        // While a navigation gesture runs, the chart and the strip of the page follow the pointer with the data at hand.
        input.onNavigate = (low, high) => {
            const window = { from: low, to: high, windowChosen: true };
            drawTimeSeries(chartHost, { ...input, ...window });
            rangeControls(window);
        };
        drawTimeSeries(chartHost, input);
        remember();
        updateLinks();
        rangeControls();
        toolbarControls();
    }

    function message(text) {
        last = null;
        chartHost.textContent = text;
        for (const element of [].concat(config.statisticsHost || projectionStats)) {
            element.textContent = "";
        }
        for (const anchor of links) {
            anchor.hidden = true;
            anchor.setAttribute("href", "#");
        }
    }

    /** Shows or hides the Options panel and its tabs, and draws the chart with or without the Y projection. */
    function showOptions() {
        const projection = memory.optionsTab === "projection";
        panel.hidden = !memory.optionsOpen;
        for (const button of toggles) {
            button.setAttribute("aria-expanded", String(memory.optionsOpen));
        }
        tabProjection.setAttribute("aria-selected", String(projection));
        tabProjection.tabIndex = projection ? 0 : -1;
        tabChart.setAttribute("aria-selected", String(!projection));
        tabChart.tabIndex = projection ? -1 : 0;
        panelProjection.hidden = !projection;
        panelChart.hidden = projection;
        redraw();
    }

    function openOptions() {
        memory.optionsOpen = !memory.optionsOpen;
        showOptions();
        changed();
    }

    toggles[0].addEventListener("click", openOptions);
    for (const [tab, name] of [[tabProjection, "projection"], [tabChart, "chart"]]) {
        tab.addEventListener("click", () => {
            memory.optionsTab = name;
            showOptions();
            changed();
            tab.focus();
        });
        tab.addEventListener("keydown", (event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                memory.optionsTab = memory.optionsTab === "projection" ? "chart" : "projection";
                showOptions();
                changed();
                (memory.optionsTab === "projection" ? tabProjection : tabChart).focus();
            }
        });
    }
    function optionControls() {
        (config.controlsHost || panelChart).replaceChildren(buildChartOptions(
            memory.options,
            (next) => {
                memory.options = next;
                if (typeof config.onOptionsChange === "function") {
                    config.onOptionsChange(next);
                }
                redraw();
                changed();
            },
            infoButton(...cards.options),
        ));
    }
    optionControls();

    /** Builds the large window the first time it is wanted; a window left by an earlier widget of the same id is replaced. */
    function buildDialog() {
        const old = document.getElementById(idOf("chartDialog"));
        if (old) {
            old.remove();
        }
        const bigToggle = toggle("optionsToggleBig");
        toggles.push(bigToggle);
        bigToggle.addEventListener("click", openOptions);
        const bigLink = trackLink(analyzerLink("openAnalyzerBig"));
        bigLink.hidden = !(last && last.analyzerHref);
        if (last && last.analyzerHref) {
            bigLink.setAttribute("href", withChartState(last.analyzerHref, getState()));
        }
        const bigInfo = node("span", { id: idOf("chartDialogInfo") });
        if (config.help) {
            bigInfo.append(infoButton(...config.help));
        }
        const close = node("button", { type: "button", id: idOf("chartDialogClose"), class: "plain" }, "Close");
        const body = node("div", { id: idOf("chartDialogBody") });
        const box = node(
            "div",
            { class: "chart-dialog-box" },
            node(
                "div",
                { class: "chart-dialog-head" },
                node("h2", { id: idOf("chartDialogTitle") }, `${config.dialogTitle || config.title || "Chart"} `, bigInfo),
                bigToggle,
                bigLink,
                close,
            ),
            body,
        );
        const element = node("dialog", { id: idOf("chartDialog"), class: "chart-dialog", "aria-labelledby": idOf("chartDialogTitle") }, box);
        close.addEventListener("click", () => element.close());
        element.addEventListener("close", restore);
        // A click on the dark backdrop, which is the dialog element itself, closes the window; Esc closes it natively.
        element.addEventListener("click", (event) => {
            if (event.target === element) {
                element.close();
            }
        });
        document.body.append(element);
        return { element, body };
    }

    /** Moves the chart, its options and its table into the large window and draws them at its size. */
    function enlarge() {
        if (!dialog) {
            ({ element: dialog, body: dialogBody } = buildDialog());
        }
        home = { parent: area.parentNode, next: area.nextSibling };
        dialogBody.append(area);
        enlarged = true;
        dialog.showModal();
        redraw();
    }

    /** Puts the chart area back on the page, draws it at the page size and returns the focus to its button. */
    function restore() {
        if (!home) {
            return;
        }
        home.parent.insertBefore(area, home.next);
        home = null;
        enlarged = false;
        redraw();
        enlargeButton.focus();
    }

    enlargeButton.addEventListener("click", enlarge);
    if (toolbarHost) {
        // Escape clears the candidate selection wherever the keyboard is on the page.
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && memory.selection) {
                memory.selection = null;
                redraw();
                changed();
            }
        });
    }
    showOptions();

    return {
        draw,
        message,
        getState,
        setState,
        get options() {
            return memory.options;
        },
    };
}
