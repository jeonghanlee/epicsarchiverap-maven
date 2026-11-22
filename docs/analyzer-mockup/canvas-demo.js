/* Independent consumers of the production canvas; no analyzer state, retrieval or profile API. */
"use strict";

const demoSignal = SIGNALS.find(signal => signal.id === 'temperature.response.normal_degC');
const demoSamples = demoSignal.samples.filter(sample => Number.isFinite(sample.value));
const demoValues = demoSamples.map(sample => sample.value);
const demoBins = d3.bin().thresholds(20)(demoValues);

function mountCanvas(host, options) {
    let xDomain = options.xDomain;
    const ranges = new Map();
    let surface;
    function render() {
        const focused = document.activeElement;
        const focusLabel = host.contains(focused) ? focused.getAttribute('aria-label') || focused.textContent : null;
        surface?.destroy();
        host.replaceChildren();
        host.classList.add('chart');
        const width = Math.max(260, host.clientWidth);
        const height = 300, margin = { left: 72, right: 18, top: 32, bottom: 48 };
        const x = options.xScale().domain(xDomain).range([margin.left, width - margin.right]);
        const y = d3.scaleLinear().domain(ranges.get(options.unit) || options.yDomain).range([height - margin.bottom, margin.top]);
        const choose = (low, high) => { xDomain = [low, high]; render(); };
        const reset = () => { xDomain = options.xDomain; ranges.clear(); render(); };
        surface = SharedChart.createPlotCanvas({ width, height, margin, x, scales: new Map([[options.unit, y]]),
            units: [options.unit], axisWidth: margin.left, onLeft: 1, unitLabels: true, axisLabelAnchor: 'start',
            xFormat: options.xFormat, xTickY: height - 25, xLabel: options.label, label: options.label });
        host.append(SharedChart.buildCanvasControls(x, choose, reset), surface.svg.node());
        options.draw(surface.marks, x, y);
        surface.bindInteractions(host, { ranges, onZoom: choose, onReset: reset, keyboardX: true, wheel: true }, render);
        const output = document.createElement('output');
        output.dataset.xDomain = JSON.stringify(x.domain().map(Number));
        output.dataset.yDomain = JSON.stringify(y.domain());
        output.textContent = `X: ${x.domain().map(options.xFormat).join(' to ')}; Y: ${y.domain().map(d3.format('.5~g')).join(' to ')}`;
        host.append(output);
        if (focusLabel) [...host.querySelectorAll('button, [tabindex]')].find(element =>
            (element.getAttribute('aria-label') || element.textContent) === focusLabel)?.focus({ preventScroll: true });
    }
    render();
    const resize = new ResizeObserver(render);
    resize.observe(host);
    return { destroy() { resize.disconnect(); surface?.destroy(); host.replaceChildren(); } };
}

mountCanvas(document.getElementById('time-plot'), {
    xScale: d3.scaleUtc, xDomain: d3.extent(demoSamples, sample => sample.time), yDomain: d3.extent(demoValues),
    xFormat: d3.utcFormat('%H:%M:%S'), label: 'Acquisition time / UTC', unit: demoSignal.unit,
    draw(marks, x, y) { marks.append('path').datum(demoSignal.samples).attr('fill', 'none').attr('stroke', '#007681')
        .attr('d', d3.line().defined(sample => Number.isFinite(sample.value)).x(sample => x(sample.time)).y(sample => y(sample.value))); },
});
mountCanvas(document.getElementById('value-plot'), {
    xScale: d3.scaleLinear, xDomain: [demoBins[0].x0, demoBins.at(-1).x1],
    yDomain: [0, d3.max(demoBins, bin => bin.length)], xFormat: d3.format('.4~g'),
    label: `Value / ${demoSignal.unit}`, unit: 'Sample count',
    draw(marks, x, y) { marks.selectAll('rect').data(demoBins).join('rect')
        .attr('x', bin => x(bin.x0) + 1).attr('width', bin => Math.max(0, x(bin.x1) - x(bin.x0) - 2))
        .attr('y', bin => y(bin.length)).attr('height', bin => y(0) - y(bin.length)).attr('fill', '#007681'); },
});
