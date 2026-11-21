/* Page adapters for the production canvas. Viewing a plot never changes its selected observations or fit. */
let plotNumber = 0;
let plotSelection = null;
const HOVER_POINT_RADIUS = 16;

function fitHoverRows(plot, index) {
    const row = plot.hoverFit?.get(index);
    return row ? [`Fitted: ${fmt(row.fitted)} ${plot.fitUnit}`, `Residual: ${fmt(row.residual)} ${plot.fitUnit}`] : [];
}

function sampleHover(plot, groups) {
    const prepared = groups.map(group => ({ ...group, points: group.samples.map((sample, index) =>
        ({ sample, index, x: group.x(sample), y: group.y(sample) })).filter(point => Number.isFinite(point.x))
        .sort((a, b) => a.x - b.x) }));
    const nearest = d3.bisector(point => point.x).center;
    plot.bindHover(plot.host, pointer => {
        const matches = prepared.flatMap(group => {
            if (!group.points.length || +pointer.x < group.points[0].x || +pointer.x > group.points.at(-1).x) return [];
            const point = group.points[nearest(group.points, +pointer.x)];
            if (!insideRange(point.x, plot.x.domain()) || !insideRange(point.y, plot.y.domain())) return [];
            return [{ group, point }];
        });
        if (!matches.length) return null;
        const { point } = matches[0];
        return { title: matches.length > 1 ? "Captured values" : matches[0].group.title,
            rows: matches.flatMap(({ group, point: item }) => [
                ...(matches.length > 1 ? [group.title] : []), ...group.rows(item.sample, item.index)]),
            px: plot.x(point.x), py: plot.y(point.y) };
    });
}

function pointHover(plot, points, xValue, yValue, describe) {
    const visible = points.map((point, index) => ({ point, index, x: xValue(point), y: yValue(point) }))
        .filter(point => insideRange(point.x, plot.x.domain()) && insideRange(point.y, plot.y.domain()));
    plot.bindHover(plot.host, pointer => {
        const matrix = plot.svg.node().getScreenCTM();
        let nearest = null, distance = HOVER_POINT_RADIUS ** 2;
        for (const item of visible) {
            const dx = plot.x(item.x) - pointer.px, dy = plot.y(item.y) - pointer.py;
            const squared = (matrix.a * dx + matrix.c * dy) ** 2 + (matrix.b * dx + matrix.d * dy) ** 2;
            if (squared <= distance) { nearest = item; distance = squared; }
        }
        return nearest ? { ...describe(nearest.point, nearest.index), px: plot.x(nearest.x), py: plot.y(nearest.y) } : null;
    });
}

function preparePlots() {
    closeHelp();
    rangeSummaries.clear();
    plotNumber = 0;
    const key = JSON.stringify([state.example, state.acquisition, state.from, state.to, state.pvs,
        state.signal, state.x, state.y, state.frame, state.profileAxis, state.waveformComponent, state.referenceFrom, state.referenceTo]);
    if (plotSelection !== null && plotSelection !== key) state.chartViews = {};
    plotSelection = key;
}

function redrawPlots() {
    const focused = document.activeElement;
    const key = focused?.closest('[data-plot-key]')?.dataset.plotKey;
    const label = focused?.getAttribute('aria-label');
    const button = focused?.tagName === 'BUTTON' ? focused.textContent : null;
    render();
    if (key) {
        const host = [...document.querySelectorAll('[data-plot-key]')].find(element => element.dataset.plotKey === key);
        const target = [...(host?.querySelectorAll('[aria-label], button') || [])].find(element =>
            label ? element.getAttribute('aria-label') === label : button && element.textContent === button);
        target?.focus({ preventScroll: true });
    }
}

function plotHost(target, key) {
    const host = document.createElement('div');
    host.className = 'chart canvas-host';
    host.dataset.plotKey = key;
    target.append(host);
    return host;
}

function navigation(host, x, choose, reset) {
    const controls = SharedChart.buildCanvasControls(x, choose, reset);
    controls.append(SharedChart.infoButton('Plot controls',
        'Drag plot: zoom X. Drag value axis: zoom Y. Tab to an axis for keyboard controls. Ctrl+wheel: zoom X. Double-click: reset. Visible range statistics follow the displayed axes; the selected data and fitted model are retained.'));
    host.append(controls);
}

function makeSharedPlot(target, xDomain, yDomain, xLabel, yLabel, options = {}) {
    const key = `${state.view}:${plotNumber++}`;
    const host = plotHost(target, key);
    const saved = state.chartViews[key] || {};
    const width = Math.max(260, Math.min(options.width || 760, target.clientWidth || 760));
    const height = options.height || 330;
    const margin = { left: 72, right: 18, top: 32, bottom: 52 };
    const x = (options.time ? d3.scaleTime() : d3.scaleLinear())
        .domain(saved.x || xDomain).range([margin.left, width - margin.right]);
    const factory = { linear: d3.scaleLinear, symlog: d3.scaleSymlog, log: d3.scaleLog, sqrt: d3.scaleSqrt }[options.scale || 'linear'];
    const y = factory().domain(saved.y || yDomain).range([height - margin.bottom, margin.top]);
    if (!saved.y) y.nice(5);
    const ranges = new Map(saved.y ? [[yLabel, saved.y]] : []);
    const choose = (low, high) => {
        if (!Number.isFinite(+low) || !Number.isFinite(+high) || +low >= +high) return;
        state.chartViews[key] = { ...state.chartViews[key], x: [+low, +high] };
        redrawPlots();
    };
    const reset = () => { delete state.chartViews[key]; redrawPlots(); };
    const canvas = SharedChart.createPlotCanvas({ width, height, margin, x,
        scales: new Map([[yLabel, y]]), units: [yLabel], axisWidth: margin.left, onLeft: 1,
        unitLabels: true, axisLabelAnchor: 'start', label: `${yLabel} against ${xLabel}`, xLabel, xTickY: height - 28,
        xTicks: [0, 1 / 3, 2 / 3, 1].map(fraction => x.invert(margin.left + fraction * (width - margin.left - margin.right))),
        xFormat: options.time ? value => dateText(+value).slice(11, 19) : d3.format('.4~g') });
    navigation(host, x, choose, reset);
    host.append(canvas.svg.node());
    canvas.bindInteractions(host, { ranges, onZoom: choose, onReset: reset, keyboardX: true, wheel: true }, () => {
        const next = { ...state.chartViews[key] };
        if (ranges.has(yLabel)) next.y = [...ranges.get(yLabel)];
        else delete next.y;
        state.chartViews[key] = next;
        redrawPlots();
    });
    return { ...canvas, y, host };
}

function drawSharedTrend(data) {
    const key = 'trend:0';
    const host = plotHost($('chart-area'), key);
    const chart = document.createElement('div');
    chart.className = 'chart';
    host.append(chart);
    const saved = state.chartViews[key] || {};
    const bounds = saved.x || [state.from, state.to];
    const choose = (low, high) => {
        if (!Number.isFinite(+low) || !Number.isFinite(+high) || +low >= +high) return;
        state.chartViews[key] = { x: [+low, +high] };
        redrawPlots();
    };
    const reset = () => { delete state.chartViews[key]; state.ranges = {}; redrawPlots(); };
    SharedChart.setProfile(state.profile);
    const input = data.map(signal => ({ name: signal.label, egu: signal.unit,
        points: signal.samples.map((sample, index) => ({ t: sample.time, v: sample.value, s: 0,
            g: index > 0 && !Number.isFinite(signal.samples[index - 1].value) })) }));
    const ranges = new Map(Object.entries(state.ranges));
    const surface = SharedChart.drawTimeSeries(chart, { series: input, from: new Date(bounds[0]), to: new Date(bounds[1]),
        gapMs: Infinity, legend: true, strip: false, fitWidth: true, height: 330, timeZone: zone(),
        options: { shape: state.shape, yscale: state.scale, marks: state.marks, average: state.avg, band: state.band, window: state.window },
        projection: state.projection, statisticsHost: document.createElement('div'), ranges,
        hidden: new Set(state.hidden.map(id => SIGNALS.find(signal => signal.id === id)?.label)),
        onZoom: choose, onReset: reset, keyboardX: true, wheel: true,
        onRangesChange: next => { state.ranges = Object.fromEntries(next); renderRangeSummaries(); renderPanel(); saveAddress(); },
        onVisibilityChange: hidden => {
            state.hidden = data.filter(signal => hidden.includes(signal.label)).map(signal => signal.id);
            redrawPlots();
        },
        overlay: surface => {
            trendRangeSummary(surface, data);
            for (const event of documentData().events) {
                if (!Number.isFinite(event.elapsed_s) || event.table) continue;
                const time = BASE_START + event.elapsed_s * 1000;
                if (time < state.from || time >= state.to) continue;
                surface.marks.append('line').attr('x1', surface.x(time)).attr('x2', surface.x(time))
                    .attr('y1', surface.margin.top).attr('y2', surface.height - surface.margin.bottom)
                    .attr('stroke', '#ad7545').attr('stroke-dasharray', '3 4')
                    .append('title').text(`Scenario annotation: ${event.name} at ${event.elapsed_s} s`);
            }
        },
    });
    if (surface) navigation(host, surface.x, choose, reset);
    host.append(chart);
}
