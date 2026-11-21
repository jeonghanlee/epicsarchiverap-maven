/* Verify histogram boundaries and derived results through the actual offline UI and saved observations. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/tmp/analyzer-design-browser-20261104/node_modules/playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const checks = [], errors = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

(async () => {
    const browser = await chromium.launch({ headless: true,
        executablePath: process.env.CHROMIUM_PATH || '/home/jeonglee/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
        page.on('pageerror', error => errors.push(error.message));
        const choose = async (example, recipe) => {
            await page.selectOption('#example', example); await page.locator(`[data-recipe="${recipe}"]`).click();
            await page.click('#panel-tab-Options');
        };
        const apply = async (low, high) => {
            await page.locator('#bin-low').fill(String(low)); await page.locator('#bin-high').fill(String(high));
            await page.getByRole('button', { name: 'Apply bin range', exact: true }).click();
        };
        const rows = () => page.evaluate(() => resultExport);
        const raw = () => page.evaluate(() => currentSeries().samples.map(sample => sample.value).filter(Number.isFinite));
        const verifyCounts = async name => {
            const observed = await raw(), bins = await rows();
            check(name, bins.every((bin, index) => bin.sample_count === observed.filter(value =>
                value >= bin.lower && (index === bins.length - 1 ? value <= bin.upper : value < bin.upper)).length));
            return { observed, bins };
        };
        const exportFit = async name => {
            await page.click('#run-fit');
            check(`${name}: fit converged`, /Converged|Fixed parameters evaluated/.test(await page.locator('#fit-status').innerText()));
            await page.click('#panel-tab-Export');
            for (const [button, suffix] of [['download-fit', '.json'], ['download-csv', '.csv'], ['download-fit-parameters', '-parameters.csv']]) {
                const downloading = page.waitForEvent('download'); await page.click(`#${button}`);
                await (await downloading).saveAs(path.join(__dirname, `fit-${name}${suffix}`));
            }
            await page.click('#panel-tab-Options');
        };
        await page.goto(`file://${__dirname}/index.html`);
        await choose('temperature', 2);
        const originalSummary = await page.locator('#results-body > .metrics').innerText();
        const automatic = [Number(await page.locator('#bin-low').inputValue()), Number(await page.locator('#bin-high').inputValue())];
        check('Automatic bounds are shown before editing', automatic[0] < automatic[1] && await page.locator('#bin-range-mode').innerText() === 'Auto');
        await page.click('#run-fit');
        check('Initial fit exists', await page.locator('.fit-curve').count() === 1);
        const originalBins = JSON.stringify(await rows());
        const originalBounds = [(await rows())[0].lower, (await rows()).at(-1).upper];
        check('Automatic boundary labels use concise numbers', JSON.stringify(automatic) === JSON.stringify(originalBounds.map(value => Number(value.toPrecision(6)))));
        await page.getByRole('button', { name: 'Apply bin range', exact: true }).click();
        check('Applying untouched labels preserves exact bins and fit', JSON.stringify(await rows()) === originalBins && await page.locator('.fit-curve').count() === 1
            && await page.locator('#bin-range-mode').innerText() === 'Auto');
        await page.locator('#bin-low').fill(String(automatic[0]));
        await page.getByRole('button', { name: 'Apply bin range', exact: true }).click();
        check('Editing one boundary retains the other full-precision value', (await rows())[0].lower === automatic[0] && (await rows()).at(-1).upper === originalBounds[1]);
        await apply(24.98, 25.02);
        const range = await page.evaluate(() => state.binRange);
        check('Apply stores the explicit bin range', JSON.stringify(range) === '[24.98,25.02]');
        let result = await verifyCounts('Each manual bin counts original observations at its exact edges');
        const count = result.bins.reduce((sum, bin) => sum + bin.sample_count, 0);
        check('Exact count and range determine bin edges', result.bins.length === 20 && result.bins[0].lower === 24.98 && result.bins.at(-1).upper === 25.02
            && result.bins.every((bin, index) => index === 0 || bin.lower === result.bins[index - 1].upper));
        check('Included and excluded counts are explicit', (await page.locator('#bin-counts').innerText()) === `Included: ${count} / Excluded: ${result.observed.length - count}`);
        check('Bin width is shown', (await page.locator('#bin-width').innerText()).includes('0.002'));
        check('Bin range change clears old fit and display zoom', await page.locator('.fit-curve').count() === 0 && await page.evaluate(() => !state.chartViews['distribution:0']));
        check('Original Summary retains all selected observations', await page.locator('#results-body > .metrics').innerText() === originalSummary);
        check('Fit range starts at the new bin boundaries', Number(await page.locator('#fit-low').inputValue()) === 24.98 && Number(await page.locator('#fit-high').inputValue()) === 25.02);
        await exportFit('bin-range-gaussian');
        const fitBefore = await page.evaluate(() => JSON.stringify(activeFit.result));
        const binsBefore = await page.evaluate(() => JSON.stringify(resultExport));
        const plot = page.locator('[data-plot-key="distribution:0"]');
        await plot.getByRole('button', { name: 'Zoom in', exact: true }).click();
        await plot.getByRole('button', { name: 'Pan right', exact: true }).click();
        await plot.getByRole('button', { name: 'Pan right', exact: true }).click();
        check('Display zoom preserves binning and fit', await page.evaluate(() => JSON.stringify(resultExport)) === binsBefore && await page.evaluate(() => JSON.stringify(activeFit.result)) === fitBefore);
        const visibleCount = await page.evaluate(() => {
            const range = state.chartViews['distribution:0'].x;
            return validSamples(currentSeries()).filter(sample => sample.value >= state.binRange[0] && sample.value <= state.binRange[1]
                && sample.value >= range[0] && sample.value <= range[1]).length;
        });
        const visibleMetrics = await page.locator('[data-range-summary="distribution:0"] .metric').evaluateAll(elements => Object.fromEntries(elements.map(element =>
            [element.querySelector('small').textContent, element.querySelector('strong').textContent])));
        check('Visible statistics intersect the bin range with the viewport', Number(visibleMetrics.Samples) === visibleCount);
        await page.selectOption('#bins', '40');
        check('Changing count preserves manual bounds and clears fit', (await rows()).length === 40 && await page.locator('.fit-curve').count() === 0 && await page.evaluate(() => !state.chartViews['distribution:0']));
        check('Changing count updates width', (await page.locator('#bin-width').innerText()).includes('0.001'));
        const link = await page.evaluate(() => address());
        await page.goto(link); await page.reload();
        check('Copied link restores manual bin range and count', await page.locator('#bins').inputValue() === '40' && Number(await page.locator('#bin-low').inputValue()) === 24.98 && Number(await page.locator('#bin-high').inputValue()) === 25.02);
        await verifyCounts('Reloaded bins retain the exact observed counts');
        const unchanged = JSON.stringify(await rows());
        for (const [low, high] of [[25.02, 24.98], [25, 25], ['', 25], [1, 1.0000000000000002], [-1e308, 1e308]]) {
            await apply(low, high);
            check(`Invalid bounds ${low}, ${high} preserve the current result`, JSON.stringify(await rows()) === unchanged && (await page.locator('#bin-range-error').innerText()).length > 0);
        }
        await page.click('#bin-range-auto');
        check('Auto restores the data range and included observations', await page.evaluate(() => state.binRange === null) && Number(await page.locator('#bin-low').inputValue()) === automatic[0]
            && (await rows()).reduce((sum, bin) => sum + bin.sample_count, 0) === 601);
        await apply(0, 1);
        check('Empty bin range displays zero bins and no fit controls', (await rows()).every(bin => bin.sample_count === 0) && await page.locator('#run-fit').count() === 0 && await page.locator('.fit-curve').count() === 0);
        await page.click('#bin-range-auto');
        check('Returning from an empty range does not revive an earlier fit', await page.locator('#run-fit').count() === 1 && await page.locator('.fit-curve').count() === 0);

        await choose('photon_counts', 1); await page.selectOption('#bins', '40'); await apply(60, 100);
        result = await verifyCounts('Integer observations at bin edges are counted once');
        check('Last bin includes the chosen maximum', result.observed.some(value => value === 100) && result.bins.at(-1).upper_inclusive
            && result.bins.at(-1).sample_count === result.observed.filter(value => value >= 99 && value <= 100).length);
        await page.selectOption('#fit-model', 'poisson');
        await exportFit('bin-range-poisson');
        await page.screenshot({ path: path.join(__dirname, 'preview-bin-range.png'), fullPage: true });
        await apply(0, 1e12); await page.selectOption('#fit-model', 'poisson'); await page.click('#run-fit');
        check('Large finite range does not expand an unbounded integer array', (await page.locator('#fit-status').innerText()).includes('bin maximum') && await page.locator('.fit-curve').count() === 0);
        await choose('temperature', 2); await apply(24.98, 25.02);
        await page.selectOption('#active-signal', 'temperature.response.slow_degC');
        check('Changing signal restores automatic bin bounds', await page.evaluate(() => state.binRange === null));
        const params = new URLSearchParams(new URL(await page.evaluate(() => address())).hash.slice(1));
        params.set('binLow', '25'); params.set('binHigh', '24');
        await page.goto(`file://${__dirname}/index.html#${params}`);
        check('Invalid URL bin bounds use automatic limits', await page.evaluate(() => state.binRange === null));
        await page.setViewportSize({ width: 320, height: 1100 }); await page.waitForTimeout(100);
        await apply(24.98, 25.02);
        check('Compact layout accepts bin settings without page overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.getByRole('button', { name: 'About Histogram bins', exact: true }).click();
        check('Information card explains endpoint and zoom behavior', (await page.locator('#infoCard').innerText()).includes('last bin also includes the maximum'));
        await page.keyboard.press('Escape');

        await choose('temperature', 2); await page.selectOption('#bins', '20'); await apply(24.9, 25.1);
        await page.click('#run-fit');
        check('Fit exists before applying a custom count', await page.locator('.fit-curve').count() === 1);
        const presets = () => page.locator('#bins option').evaluateAll(options => options.map(option => option.value));
        check('Original preset choices are retained', JSON.stringify(await presets()) === '["5","12","20","40","80"]');
        const custom = async count => {
            await page.locator('#custom-bins').fill(String(count));
            await page.locator('#custom-bin-form').getByRole('button', { name: 'Apply', exact: true }).click();
        };
        await page.locator('#custom-bins').fill('37');
        check('Typing a custom count waits for Apply', (await rows()).length === 20 && await page.locator('.fit-curve').count() === 1);
        await page.locator('#custom-bin-form').getByRole('button', { name: 'Apply', exact: true }).click();
        check('Custom count creates exactly 37 bins and clears the old fit', (await rows()).length === 37 && await page.locator('.fit-curve').count() === 0);
        check('Custom count retains the manual range', JSON.stringify(await page.evaluate(() => state.binRange)) === '[24.9,25.1]');
        check('Dropdown identifies the active custom value', await page.locator('#bins option:checked').innerText() === 'Custom: 37');
        const customOptions = await presets();
        check('Custom dropdown preserves every original option', ['5', '12', '20', '40', '80'].every(value => customOptions.includes(value)));
        await verifyCounts('Custom bins retain exact observation counts');
        await exportFit('custom-count-gaussian');
        await page.selectOption('#bins', '40');
        check('Existing dropdown still applies a preset', (await rows()).length === 40 && await page.locator('#custom-bins').inputValue() === '40');
        await page.locator('#custom-bins').fill('128'); await page.locator('#custom-bins').press('Enter');
        check('Custom count above the old maximum applies with Enter', (await rows()).length === 128);
        await page.reload();
        check('Copied settings restore custom count without clamping to a preset', (await rows()).length === 128
            && await page.locator('#bins').inputValue() === '128' && await page.locator('#custom-bins').inputValue() === '128');
        const customRows = JSON.stringify(await rows());
        for (const count of ['', 0, -1, 2.5, 1001]) {
            await custom(count);
            check(`Invalid custom count ${count} preserves the result`, JSON.stringify(await rows()) === customRows
                && await page.locator('#custom-bins').getAttribute('aria-invalid') === 'true' && (await page.locator('#bin-count-error').innerText()).includes('integer'));
        }
        await custom(1);
        check('A single custom bin preserves all included observations', (await rows()).length === 1 && (await rows())[0].sample_count === 601);
        await custom(1000);
        check('Maximum custom count is bounded and count-preserving', (await rows()).length === 1000 && (await rows()).reduce((sum, bin) => sum + bin.sample_count, 0) === 601);
        check('Dense bins retain positive rendered widths', await page.locator('[data-plot-key="distribution:0"] .plot-marks rect').evaluateAll(bars =>
            bars.length === 1000 && bars.every(bar => Number(bar.getAttribute('width')) > 0)));
        await custom(37);
        check('Preset and custom fields fit at compact width', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.locator('#panel-content').screenshot({ path: path.join(__dirname, 'preview-custom-bin-count.png') });
        await apply(1, 1.00000001);
        check('Narrow ranges retain distinguishable boundary labels', Number(await page.locator('#bin-low').inputValue()) < Number(await page.locator('#bin-high').inputValue())
            && (await rows())[0].lower === 1 && (await rows()).at(-1).upper === 1.00000001);
        check('No browser errors', errors.length === 0);
        const sourceHashes = Object.fromEntries(['mockup.js', 'mockup.css', 'fit-ui.js', 'fit-engine.js', 'range-summary.js', 'signal-data.js', 'verify-bin-range.cjs']
            .map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex')]));
        fs.writeFileSync(path.join(__dirname, 'bin-range-check.json'), JSON.stringify({ observed_at: new Date().toISOString(), checks, errors, sourceHashes }, null, 2));
        process.stdout.write(`${checks.length} bin range checks passed.\n`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
