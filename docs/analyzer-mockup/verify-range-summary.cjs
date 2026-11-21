/* Observe actual UI range changes and compare displayed statistics with original saved observations. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/tmp/analyzer-design-browser-20261104/node_modules/playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const checks = [], errors = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
const statistics = values => {
    const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
    const mean = n ? values.reduce((sum, value) => sum + value, 0) / n : NaN;
    return { Samples: n, Mean: mean,
        'Std. deviation': n > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)) : NaN,
        Median: n ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2 : NaN };
};
const equal = (actual, expected) => Number.isFinite(expected)
    ? Math.abs(Number(String(actual).replace(/\u2212/g, '-')) - expected) <= Math.max(1e-10, Math.abs(expected) * 0.00006)
    : actual === 'Unavailable';

(async () => {
    const browser = await chromium.launch({ headless: true,
        executablePath: process.env.CHROMIUM_PATH || '/home/jeonglee/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
        page.on('pageerror', error => errors.push(error.message));
        const entry = key => page.locator(`[data-range-summary="${key}"]`);
        const metrics = async key => entry(key).locator('.metric').evaluateAll(elements => Object.fromEntries(elements.map(element =>
            [element.querySelector('small').textContent, element.querySelector('strong').textContent])));
        const choose = async (example, recipe) => {
            await page.selectOption('#example', example);
            await page.locator(`[data-recipe="${recipe}"]`).click();
        };
        const navigate = async (key, action) => page.locator(`[data-plot-key="${key}"]`).getByRole('button', { name: action, exact: true }).click();
        const histogramValues = async () => page.evaluate(() => {
            const range = state.chartViews['distribution:0']?.x || [-Infinity, Infinity];
            return currentSeries().samples.map(sample => sample.value).filter(value => Number.isFinite(value) && value >= range[0] && value <= range[1]);
        });
        const verifyHistogram = async name => {
            const expected = statistics(await histogramValues()), displayed = await metrics('distribution:0');
            check(name, Object.entries(expected).every(([label, value]) => equal(displayed[label], value)));
        };
        await page.goto(`file://${__dirname}/index.html`);
        await choose('temperature', 2);
        const fullSummary = await page.locator('#results-body > .metrics').innerText();
        await verifyHistogram('Histogram original range statistics match raw samples');
        await page.click('#run-fit');
        const fitBefore = await page.evaluate(() => JSON.stringify(activeFit.result));
        const exportBefore = await page.evaluate(() => JSON.stringify(resultExport));
        await navigate('distribution:0', 'Zoom in');
        await navigate('distribution:0', 'Pan right');
        await verifyHistogram('Histogram X zoom and pan recompute sample statistics');
        const visible = await metrics('distribution:0');
        check('Histogram visible count is a proper subset', Number(visible.Samples) > 0 && Number(visible.Samples) < 601);
        check('Original summary remains unchanged', await page.locator('#results-body > .metrics').innerText() === fullSummary);
        check('Fit and parameter uncertainty remain unchanged', await page.evaluate(() => JSON.stringify(activeFit.result)) === fitBefore);
        check('Analysis export remains unchanged', await page.evaluate(() => JSON.stringify(resultExport)) === exportBefore);
        await page.locator('[data-plot-key="distribution:0"] .axis-key[data-unit]').focus();
        await page.keyboard.press('+');
        check('Histogram Y zoom does not filter observations by bin height', JSON.stringify(await metrics('distribution:0')) === JSON.stringify(visible));
        check('Residual plot also has visible statistics', await entry('distribution:1').count() === 1);
        await page.screenshot({ path: path.join(__dirname, 'preview-range-histogram.png'), fullPage: true });
        await navigate('distribution:0', 'Reset axes');
        await verifyHistogram('Histogram reset restores full-range statistics');
        for (let i = 0; i < 5; i++) await navigate('distribution:0', 'Pan right');
        const empty = await metrics('distribution:0');
        check('Empty visible range reports zero and unavailable values', empty.Samples === '0' && ['Mean', 'Std. deviation', 'Median'].every(key => empty[key] === 'Unavailable'));
        const oneUrl = await page.evaluate(() => {
            const values = validSamples(currentSeries()).map(sample => sample.value).sort((a, b) => a - b);
            const middle = Math.floor(values.length / 2);
            const params = new URLSearchParams(location.hash.slice(1));
            params.set('chartViews', JSON.stringify({ 'distribution:0': { x: [(values[middle - 1] + values[middle]) / 2, (values[middle] + values[middle + 1]) / 2] } }));
            return `${location.href.split('#')[0]}#${params}`;
        });
        await page.goto(oneUrl); await page.waitForTimeout(80);
        await verifyHistogram('One-sample URL range has correct mean, median and unavailable deviation');
        check('One original observation is included', (await metrics('distribution:0')).Samples === '1');

        await choose('bpm', 0);
        const trendFull = await page.locator('#results-body > .table-scroll').innerText();
        await navigate('trend:0', 'Zoom in');
        await page.locator('[data-plot-key="trend:0"] .axis-key[data-unit="um"]').focus();
        await page.keyboard.press('+');
        const expectedTrend = await page.evaluate(() => series().filter(signal => !state.hidden.includes(signal.id)).map(signal => {
            const x = state.chartViews['trend:0'].x, y = state.ranges[signal.unit] || [-Infinity, Infinity];
            return { label: signal.label, values: signal.samples.filter(sample => Number.isFinite(sample.value)
                && sample.time >= x[0] && sample.time <= x[1] && sample.value >= y[0] && sample.value <= y[1]).map(sample => sample.value) };
        }));
        const trendRows = await entry('trend:0').locator('tbody tr').evaluateAll(rows => rows.map(row => [...row.cells].map(cell => cell.textContent)));
        fs.writeFileSync(path.join(__dirname, 'range-trend-observation.json'), JSON.stringify({
            expected: expectedTrend.map(signal => ({ label: signal.label, statistics: statistics(signal.values) })), displayed: trendRows,
            state: await page.evaluate(() => ({ ranges: state.ranges, views: state.chartViews })),
        }, null, 2));
        check('Trend X and per-unit Y changes update each signal statistics', expectedTrend.every((signal, index) => {
            const stats = statistics(signal.values), row = trendRows[index];
            return row[0] === signal.label && [stats.Samples, stats.Mean, stats['Std. deviation'], stats.Median].every((value, i) => equal(row[i + 1], value));
        }));
        check('Trend original summary remains unchanged', await page.locator('#results-body > .table-scroll').innerText() === trendFull);
        check('Trend Y keyboard focus survives statistics refresh', await page.locator('[data-plot-key="trend:0"] .axis-key[data-unit="um"]').evaluate(element => element === document.activeElement));
        await page.screenshot({ path: path.join(__dirname, 'preview-range-trend.png'), fullPage: true });
        await choose('bpm', 1);
        await navigate('correlation:0', 'Zoom in');
        const pairs = await page.evaluate(() => {
            const range = state.chartViews['correlation:0'].x;
            return resultExport.filter(pair => pair.x >= range[0] && pair.x <= range[1]).map(pair => [pair.x, pair.y]);
        });
        const xMean = statistics(pairs.map(pair => pair[0])).Mean, yMean = statistics(pairs.map(pair => pair[1])).Mean;
        const r = pairs.reduce((sum, pair) => sum + (pair[0] - xMean) * (pair[1] - yMean), 0)
            / Math.sqrt(pairs.reduce((sum, pair) => sum + (pair[0] - xMean) ** 2, 0) * pairs.reduce((sum, pair) => sum + (pair[1] - yMean) ** 2, 0));
        const scatter = await metrics('correlation:0');
        check('Scatter visible pair count and correlation match original pairs', scatter.Pairs === String(pairs.length) && equal(scatter['Pearson r'], r));
        await choose('bpm', 3);
        const fftBefore = await page.evaluate(() => JSON.stringify(resultExport));
        await navigate('spectrum:0', 'Zoom in');
        const fft = await page.evaluate(() => resultExport.filter(bin => bin.frequency_Hz >= state.chartViews['spectrum:0'].x[0] && bin.frequency_Hz <= state.chartViews['spectrum:0'].x[1]));
        const peak = fft.reduce((best, bin) => bin.amplitude > best.amplitude ? bin : best, fft[0]);
        const spectrum = await metrics('spectrum:0');
        check('Spectrum visible bin count and peak match calculated FFT', spectrum['Frequency bins'] === String(fft.length) && equal(spectrum['Peak frequency'], peak.frequency_Hz) && equal(spectrum['Peak amplitude'], peak.amplitude));
        check('Spectrum zoom retains original transform', await page.evaluate(() => JSON.stringify(resultExport)) === fftBefore);
        await choose('magnet_supply', 3);
        const referenceBefore = await metrics('compare:1');
        await navigate('compare:0', 'Zoom in');
        check('Comparison ranges have independent statistics', JSON.stringify(await metrics('compare:1')) === JSON.stringify(referenceBefore) && Number((await metrics('compare:0')).Samples) < 4000);
        await choose('rf_cavity', 1);
        await navigate('waveform:0', 'Zoom in');
        const waveRows = await page.evaluate(() => {
            const range = state.chartViews['waveform:0'].x;
            return resultExport.filter(sample => sample.frame_index === absoluteFrame() && sample.axis >= range[0] && sample.axis <= range[1]);
        });
        const wave = await metrics('waveform:0:1');
        check('Waveform viewport statistics use captured array values', wave.Elements === String(waveRows.length) && equal(wave.Mean, statistics(waveRows.map(sample => sample.value)).Mean));
        check('Waveform reference has separate statistics', await entry('waveform:0:0').count() === 1);
        await choose('camera', 0);
        const imageBefore = await page.locator('#results-body > .metrics').innerText();
        const yProfileBefore = await metrics('image:1');
        await navigate('image:0', 'Zoom in');
        check('Image profile statistics are independent', Number((await metrics('image:0'))['Profile points']) < 96 && JSON.stringify(await metrics('image:1')) === JSON.stringify(yProfileBefore));
        check('Profile zoom leaves full-frame centroid and widths unchanged', await page.locator('#results-body > .metrics').innerText() === imageBefore);
        await choose('bpm', 0); await page.click('#tab-dependency');
        check('Matrix shows current-selection statistics', (await metrics('dependency'))['Defined pairs'] === '3');

        await choose('temperature', 2);
        await page.locator('[data-plot-key="distribution:0"]').getByRole('button', { name: 'About Plot controls', exact: true }).click();
        check('Existing information card opens with full controls explanation', (await page.locator('#infoCard').innerText()).includes('Ctrl+wheel'));
        await page.keyboard.press('Escape');
        check('Escape closes help and restores focus', await page.locator('#infoCard').count() === 0 && await page.locator('[data-plot-key="distribution:0"]').getByRole('button', { name: 'About Plot controls', exact: true }).evaluate(element => element === document.activeElement));
        await page.getByRole('button', { name: 'About Normal response statistics', exact: true }).click();
        check('Statistics help explains sample selection and deviation', (await page.locator('#infoCard').innerText()).includes('N - 1'));
        await page.locator('#infoCard .close').click();
        check('Plot instructions are no longer a permanent paragraph', await page.locator('.canvas-help').count() === 0);
        for (const width of [1440, 720, 320]) {
            await page.setViewportSize({ width, height: 1100 }); await page.waitForTimeout(100);
            await page.locator('[data-plot-key="distribution:0"]').getByRole('button', { name: 'About Plot controls', exact: true }).click();
            const box = await page.locator('#infoCard').boundingBox();
            check(`Width ${width}: help fits viewport`, box.x >= 0 && box.x + box.width <= width + 1);
            check(`Width ${width}: help is visible vertically`, box.y >= 0 && box.y + box.height <= 1101 && await page.locator('#infoCard').isVisible());
            check(`Width ${width}: no page overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            if (width === 320) await page.screenshot({ path: path.join(__dirname, 'preview-range-help-320.png') });
            await page.keyboard.press('Escape');
        }
        check('No JavaScript errors', errors.length === 0);
        const sourceHashes = Object.fromEntries(['index.html', 'mockup.js', 'mockup.css', 'range-summary.js', 'mockup-help.js',
            'shared-plots.js', 'shared-chart.js', 'signal-data.js', 'signal-catalog.js', 'fit-ui.js', 'verify-range-summary.cjs']
            .map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex')]));
        const report = { observed_at: new Date().toISOString(), checks, errors, sourceHashes };
        fs.writeFileSync(path.join(__dirname, 'range-summary-check.json'), JSON.stringify(report, null, 2));
        process.stdout.write(`${checks.length} range summary and help checks passed.\n`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
