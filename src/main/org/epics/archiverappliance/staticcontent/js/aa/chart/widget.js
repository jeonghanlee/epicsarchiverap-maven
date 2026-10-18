// The chart widget: a chart with everything it needs, placed by a page. It builds the row with the Options button, the link into
// the analyzer and the Enlarge chart button, the Options panel with its Projection and Chart tabs, the large window, and the
// information cards, and it keeps the options between draws. A page gives the series and the window at each refresh.
import { infoButton } from "../card.js";
import { node } from "../dom.js";
import { MARKER_LIMIT, drawTimeSeries } from "./draw.js";
import { currentZone, onZoneChange } from "../timezone.js";
import { buildChartOptions, CHART_OPTIONS } from "./options.js";

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
 * Builds the chart in host and returns {draw(data), message(text), options}.
 * config, given once: id (the key of the choices the widget keeps), idPrefix (puts a prefix before the id of each control, for a
 * page with more than one chart; without it the ids are options, enlarge, chart and so on), title and dialogTitle (the headings of
 * the row and of the large window; both optional), help ([title, rows, action, helpHref] of the card of how to read this chart,
 * optional), helpHref (the help page of the cards of the widget), legend, labelNames, strip, timeZone (the zone the times are written
 * in; without it the choice of the application, which the widget follows when it changes), and the optional callbacks
 * onZoom(from, to), onPan(direction), onReset() and onOptionsChange(options). A chart with none of the three time callbacks has no
 * drag over the plot and no Earlier, Later or Back to the selected range.
 * draw(data), at each refresh: series, from, to, gapMs, windowChosen, canPanLater and analyzerHref (a string, or null for no link).
 * message(text) shows a text in place of the chart. options is the object of the options the person chose.
 */
export function createChart(host, config) {
    const memory = MEMORY.get(config.id) || { options: { ...CHART_OPTIONS }, optionsOpen: false, optionsTab: "projection" };
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
    const area = node("div", { id: idOf("plotArea"), class: "chart-area" }, panel, chartHost);
    host.textContent = "";
    host.append(head, area);

    // A change of the zone of the application redraws the last data in the new zone.
    onZoneChange(() => redraw());

    /** The projection is on while the panel is open on its Projection tab. */
    const projectionOn = () => memory.optionsOpen && memory.optionsTab === "projection";

    function redraw() {
        if (last) {
            draw(last);
        }
    }

    function draw(data) {
        last = data;
        for (const anchor of links) {
            anchor.hidden = !data.analyzerHref;
            anchor.setAttribute("href", data.analyzerHref || "#");
        }
        drawTimeSeries(chartHost, {
            series: data.series,
            from: data.from,
            to: data.to,
            gapMs: data.gapMs,
            legend: config.legend,
            labelNames: config.labelNames,
            strip: config.strip,
            timeZone: config.timeZone || currentZone(),
            projection: projectionOn(),
            // The table of the Y projection is in the Projection tab above the chart, on the page and in the large window alike.
            statisticsHost: projectionStats,
            info: (topic) => (topic === "statistics" ? infoButton(...cards.statistics) : topic === "range" ? infoButton(...cards.range) : null),
            windowChosen: data.windowChosen,
            canPanLater: data.canPanLater,
            onPan: config.onPan,
            height: enlarged ? Math.max(ENLARGED_LEAST, window.innerHeight - ENLARGED_ROOM) : undefined,
            options: memory.options,
            onZoom: config.onZoom,
            onReset: config.onReset,
        });
    }

    function message(text) {
        last = null;
        chartHost.textContent = text;
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
    }

    toggles[0].addEventListener("click", openOptions);
    for (const [tab, name] of [[tabProjection, "projection"], [tabChart, "chart"]]) {
        tab.addEventListener("click", () => {
            memory.optionsTab = name;
            showOptions();
            tab.focus();
        });
        tab.addEventListener("keydown", (event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                memory.optionsTab = memory.optionsTab === "projection" ? "chart" : "projection";
                showOptions();
                (memory.optionsTab === "projection" ? tabProjection : tabChart).focus();
            }
        });
    }
    panelChart.append(
        buildChartOptions(
            memory.options,
            (next) => {
                memory.options = next;
                if (typeof config.onOptionsChange === "function") {
                    config.onOptionsChange(next);
                }
                redraw();
            },
            infoButton(...cards.options),
        ),
    );

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
            bigLink.setAttribute("href", last.analyzerHref);
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
    showOptions();

    return {
        draw,
        message,
        get options() {
            return memory.options;
        },
    };
}
