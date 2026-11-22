/* Viewport statistics use original observations and never change analysis inputs or fitted results. */
const rangeSummaries = new Map();
const insideRange = (value, domain) => Number.isFinite(value) && value >= +domain[0] && value <= +domain[1];

function visiblePoints(plot, samples, xValue, yValue) {
    return samples.filter(sample => insideRange(xValue(sample), plot.x.domain()) && insideRange(yValue(sample), plot.y.domain()));
}

function valueStatistics(values, unit, countLabel = 'Samples') {
    return [[countLabel, values.length, ''], ['Mean', fmt(d3.mean(values)), unit],
        ['Std. deviation', fmt(d3.deviation(values)), unit], ['Median', fmt(d3.median(values)), unit]];
}

function shownRange(plot, xUnit, yUnit, time = false) {
    const x = plot.x.domain().map(value => time ? dateText(+value) : fmt(+value)).join(' to ');
    const y = plot.y ? plot.y.domain().map(fmt).join(' to ') : '';
    return `X: ${x} ${xUnit}${y ? ` / Y: ${y} ${yUnit}` : ''}`;
}

function setRangeSummary(key, title, range, body, explanation) {
    rangeSummaries.set(key, { title, range, body, explanation });
}

function histogramRangeSummary(plot, values, unit, title, key = plot.host.dataset.plotKey, countLabel = 'Samples') {
    const selected = values.filter(value => insideRange(value, plot.x.domain()));
    setRangeSummary(key, title, shownRange({ x: plot.x }, unit), metrics(valueStatistics(selected, unit, countLabel)),
        'Original finite values inside the displayed X range, including both endpoints. Counts are not estimated from bin centers. Y zoom changes bar heights only. Standard deviation uses N - 1 and is unavailable for fewer than two observations. Empty ranges have zero observations and unavailable statistics.');
}

function trendRangeSummary(surface, signals) {
    const rows = signals.filter(signal => !state.hidden.includes(signal.id)).map(signal => {
        const y = surface.scales.get(signal.unit || '');
        if (!y) return null;
        const values = visiblePoints({ x: surface.x, y }, signal.samples, sample => sample.time, sample => sample.value)
            .map(sample => sample.value);
        return [signal.label, values.length, fmt(d3.mean(values)), fmt(d3.deviation(values)), fmt(d3.median(values)),
            fmt(d3.min(values)), fmt(d3.max(values)), signal.unit, y.domain().map(fmt).join(' to ')];
    }).filter(Boolean);
    setRangeSummary('trend:0', 'Visible signals', shownRange(surface, zone(), '', true),
        table(['Signal', 'Samples', 'Mean', 'Std. dev.', 'Median', 'Min', 'Max', 'Unit', 'Y range'], rows),
        'Original finite samples inside the displayed time range and each signal unit\'s Y range. Both display endpoints are included; the selected source interval still excludes To. Hidden signals are omitted. No interpolated line segments are counted. Standard deviation uses N - 1.');
}

function correlationRangeSummary(plot, pairs, xUnit, yUnit) {
    const visible = visiblePoints(plot, pairs, pair => pair.x, pair => pair.y);
    setRangeSummary(plot.host.dataset.plotKey, 'Paired observations', shownRange(plot, xUnit, yUnit),
        metrics([['Pairs', visible.length, ''], ['Pearson r', fmt(pearson(visible)), ''],
            ['X mean', fmt(d3.mean(visible, pair => pair.x)), xUnit], ['Y mean', fmt(d3.mean(visible, pair => pair.y)), yUnit]])
        + table(['Axis', 'Std. deviation', 'Median', 'Unit'], [
            ['X', fmt(d3.deviation(visible, pair => pair.x)), fmt(d3.median(visible, pair => pair.x)), xUnit],
            ['Y', fmt(d3.deviation(visible, pair => pair.y)), fmt(d3.median(visible, pair => pair.y)), yUnit]]),
        'Exact timestamp pairs inside both displayed axes, including both endpoints. Pearson r is unavailable for fewer than two pairs or a constant coordinate. Standard deviation uses N - 1. Zoom does not refit the model or change its parameter uncertainty.');
}

function sampleRangeSummary(plot, samples, xValue, yValue, title, xUnit, yUnit, options = {}) {
    const visible = visiblePoints(plot, samples, xValue, yValue);
    const values = visible.map(yValue);
    const stats = valueStatistics(values, yUnit, options.countLabel || 'Samples');
    if (options.peak) {
        const peak = d3.greatest(visible, yValue);
        stats.push(['Peak position', peak ? fmt(xValue(peak)) : 'Unavailable', xUnit],
            ['Maximum', peak ? fmt(yValue(peak)) : 'Unavailable', yUnit]);
    }
    setRangeSummary(options.key || plot.host.dataset.plotKey, title, shownRange(plot, xUnit, yUnit, options.time), metrics(stats),
        'Original finite points inside both displayed axes, including both endpoints. Standard deviation uses N - 1; fewer than two points have no estimated standard deviation. No interpolated points are counted. ' + (options.note || ''));
}

function spectrumRangeSummary(plot, bins, unit) {
    const visible = visiblePoints(plot, bins, bin => bin.frequency, bin => bin.amplitude);
    const peak = d3.greatest(visible, bin => bin.amplitude);
    setRangeSummary(plot.host.dataset.plotKey, 'Amplitude spectrum', shownRange(plot, 'Hz', unit),
        metrics([['Frequency bins', visible.length, ''], ['Peak frequency', peak ? fmt(peak.frequency) : 'Unavailable', 'Hz'],
            ['Peak amplitude', peak ? fmt(peak.amplitude) : 'Unavailable', unit], ['Mean amplitude', fmt(d3.mean(visible, bin => bin.amplitude)), unit]]),
        'Existing FFT bins inside the displayed frequency and amplitude ranges. Peak means the greatest visible bin, including a range endpoint; it is not an interpolated peak. Mean amplitude is an arithmetic bin mean, not integrated power or RMS. Zoom does not change the input interval, window, FFT length or resolution.');
}

function renderRangeSummaries() {
    closeHelp();
    document.getElementById('visible-summary')?.remove();
    if (!rangeSummaries.size) return;
    const section = document.createElement('section');
    section.id = 'visible-summary';
    section.className = 'visible-summary';
    section.setAttribute('aria-label', state.view === 'dependency' ? 'Current selection statistics' : 'Visible range statistics');
    section.innerHTML = `<h3>${state.view === 'dependency' ? 'Current selection' : 'Visible range'}</h3>`
        + [...rangeSummaries].map(([key, item]) => `<div class="range-summary" data-range-summary="${escapeText(key)}"><h4>${escapeText(item.title)}${helpHint(item.title + ' statistics', item.explanation)}</h4><p class="range-values">${escapeText(item.range)}</p>${item.body}</div>`).join('');
    const fit = document.getElementById('fit-summary');
    if (fit) fit.before(section);
    else $('results-body').append(section);
    activateHelp(section);
}
