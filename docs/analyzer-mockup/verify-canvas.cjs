/* Exercise shipped canvas code through real browser input and saved signal fixtures. */
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
        const domain = async (host, axis = 'x') => JSON.parse(await page.locator(`${host} output`).getAttribute(`data-${axis}-domain`));
        const click = async (host, label) => page.locator(host).getByRole('button', { name: label, exact: true }).click();
        const xy = async (svg, x, y) => page.locator(svg).evaluate((element, pair) => {
            const point = new DOMPoint(...pair).matrixTransform(element.getScreenCTM());
            return [point.x, point.y];
        }, [x, y]);
        const drag = async (selector, start, end) => {
            await page.locator(selector).scrollIntoViewIfNeeded();
            const a = await xy(selector, ...start), b = await xy(selector, ...end);
            await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 8 }); await page.mouse.up();
        };
        await page.goto(`file://${__dirname}/canvas-demo.html`);
        await page.waitForSelector('#value-plot output');
        const originalTime = await domain('#time-plot'), originalValue = await domain('#value-plot');
        await click('#time-plot', 'Zoom in');
        const timeZoom = await domain('#time-plot');
        check('Time canvas zoom narrows its Date domain', Math.abs((timeZoom[1] - timeZoom[0]) / (originalTime[1] - originalTime[0]) - 0.5) < 1e-6);
        check('Time zoom leaves numeric canvas unchanged', JSON.stringify(await domain('#value-plot')) === JSON.stringify(originalValue));
        await click('#value-plot', 'Pan right');
        const valuePan = await domain('#value-plot');
        check('Numeric pan preserves span and moves domain', valuePan[0] > originalValue[0] && Math.abs((valuePan[1] - valuePan[0]) - (originalValue[1] - originalValue[0])) < 1e-8);
        check('Numeric pan leaves time canvas unchanged', JSON.stringify(await domain('#time-plot')) === JSON.stringify(timeZoom));
        await click('#value-plot', 'Reset axes');
        const yOriginal = await domain('#value-plot', 'y');
        await page.locator('#value-plot .axis-key[data-unit]').focus();
        await page.keyboard.press('+');
        const yZoom = await domain('#value-plot', 'y');
        check('Y keyboard zoom changes only Y', (yZoom[1] - yZoom[0]) === (yOriginal[1] - yOriginal[0]) / 2 && JSON.stringify(await domain('#value-plot')) === JSON.stringify(originalValue));
        check('Y focus survives redraw', await page.locator('#value-plot .axis-key[data-unit]').evaluate(element => element === document.activeElement));
        await page.keyboard.press('Home');
        check('Y Home restores automatic domain', JSON.stringify(await domain('#value-plot', 'y')) === JSON.stringify(yOriginal));
        await page.locator('#value-plot .axis-key-x').focus();
        await page.keyboard.press('+');
        check('X keyboard zoom and focus survive redraw', (await domain('#value-plot'))[0] > originalValue[0] && await page.locator('#value-plot .axis-key-x').evaluate(element => element === document.activeElement));
        await page.keyboard.press('Home');
        check('X Home restores its domain', JSON.stringify(await domain('#value-plot')) === JSON.stringify(originalValue));
        const clips = await page.locator('clipPath').evaluateAll(elements => elements.map(element => element.id));
        check('Independent surfaces have unique clip IDs', clips.length === 2 && new Set(clips).size === 2);
        await page.screenshot({ path: path.join(__dirname, 'preview-canvas-demo.png'), fullPage: true });

        await page.goto(`file://${__dirname}/index.html`);
        await page.selectOption('#example', 'temperature');
        await page.locator('[data-recipe="2"]').click();
        await page.click('#panel-tab-Options');
        await page.click('#run-fit');
        const fitBefore = await page.evaluate(() => JSON.stringify(resultExport));
        const fitTable = await page.locator('#fit-parameters').innerText();
        const selection = await page.evaluate(() => [state.from, state.to, state.bins]);
        const histogram = '[data-plot-key="distribution:0"]';
        await click(histogram, 'Zoom in');
        const histogramX = await page.evaluate(() => state.chartViews['distribution:0'].x);
        check('Histogram zoom retains observed and fitted export values', await page.evaluate(() => JSON.stringify(resultExport)) === fitBefore);
        check('Histogram zoom retains parameter errors and intervals', await page.locator('#fit-parameters').innerText() === fitTable);
        check('Plot zoom does not change interval or bins', JSON.stringify(await page.evaluate(() => [state.from, state.to, state.bins])) === JSON.stringify(selection));
        check('Histogram toolbar retains keyboard focus', await page.getByRole('button', { name: 'Zoom in', exact: true }).first().evaluate(element => element === document.activeElement));
        const share = await page.evaluate(() => address());
        await page.reload();
        check('Reload preserves plot range', JSON.stringify(await page.evaluate(() => state.chartViews['distribution:0'].x)) === JSON.stringify(histogramX));
        check('Copied link includes explicit display range', share.includes('chartViews='));
        await page.click('#tab-trend');
        check('Trend uses the production time-series layer', await page.locator('[data-chart-canvas="shared"] .line').count() > 0);
        await page.click('#tab-distribution');
        check('Tab changes preserve independent ranges', JSON.stringify(await page.evaluate(() => state.chartViews['distribution:0'].x)) === JSON.stringify(histogramX));
        await click(histogram, 'Reset axes');
        const xDomain = await page.evaluate(() => padded(validSamples(currentSeries()).map(sample => sample.value)));
        for (const width of [1440, 720, 320]) {
            await page.setViewportSize({ width, height: 1100 });
            await page.waitForTimeout(120);
            await click(histogram, 'Reset axes');
            const svg = `${histogram} svg[data-chart-canvas]`;
            const box = await page.locator(svg).evaluate(element => element.viewBox.baseVal.width);
            const left = 72, span = box - 18 - left;
            await drag(svg, [left + span * 0.25, 140], [left + span * 0.75, 140]);
            const chosen = await page.evaluate(() => state.chartViews['distribution:0'].x);
            // The brush reads mouse events, whose coordinates the browser delivers as whole screen pixels, so a drag
            // lands within one screen pixel of the intended point: that pixel in the units of the X domain is the tolerance.
            const rendered = await page.locator(svg).evaluate(element => element.getBoundingClientRect().width);
            const pixel = (xDomain[1] - xDomain[0]) / span * (box / rendered) * 1.01;
            check(`Width ${width}: drag uses rendered SVG coordinates`, Math.abs(chosen[0] - (xDomain[0] + (xDomain[1] - xDomain[0]) * 0.25)) < pixel && Math.abs(chosen[1] - (xDomain[0] + (xDomain[1] - xDomain[0]) * 0.75)) < pixel);
            await drag(svg, [40, 80], [40, 220]);
            check(`Width ${width}: Y drag sets finite numeric range`, await page.evaluate(() => state.chartViews['distribution:0'].y.every(Number.isFinite)));
            check(`Width ${width}: no page overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            if (width === 320) await page.screenshot({ path: path.join(__dirname, 'preview-canvas-compact.png'), fullPage: true });
        }
        const svg = `${histogram} svg[data-chart-canvas]`;
        await page.locator(svg).dblclick({ position: { x: 130, y: 100 } });
        check('Double-click resets both ranges', await page.evaluate(() => !state.chartViews['distribution:0']));
        await page.locator(svg).scrollIntoViewIfNeeded();
        const point = await xy(svg, 150, 140);
        await page.mouse.move(...point);
        await page.keyboard.down('Control'); await page.mouse.wheel(0, -100); await page.keyboard.up('Control');
        await page.waitForTimeout(200);
        check('Ctrl+wheel zooms X', await page.evaluate(() => !!state.chartViews['distribution:0']?.x));
        const beforeScroll = await page.evaluate(() => JSON.stringify(state.chartViews));
        await page.mouse.wheel(0, -40); await page.waitForTimeout(100);
        check('Ordinary wheel scrolling leaves ranges unchanged', await page.evaluate(() => JSON.stringify(state.chartViews)) === beforeScroll);
        await page.setViewportSize({ width: 1440, height: 1100 });
        await page.selectOption('#example', 'bpm');
        await page.locator('[data-recipe="1"]').click();
        await page.click('#panel-tab-Options'); await page.click('#run-fit');
        const pairs = await page.evaluate(() => JSON.stringify(resultExport));
        await click('[data-plot-key="correlation:0"]', 'Zoom in');
        check('Scatter zoom preserves pairs, fit and errors', await page.evaluate(() => JSON.stringify(resultExport)) === pairs && await page.locator('.fit-curve').count() === 1);
        await page.screenshot({ path: path.join(__dirname, 'preview-canvas-scatter.png'), fullPage: true });
        await page.selectOption('#example', 'beam_current');
        check('Changing input clears previous plot ranges', await page.evaluate(() => Object.keys(state.chartViews).length === 0));
        const trendBefore = await page.evaluate(() => JSON.stringify(resultExport));
        await click('[data-plot-key="trend:0"]', 'Zoom in');
        check('Trend navigation retains selected samples', await page.evaluate(() => JSON.stringify(resultExport)) === trendBefore);
        await page.screenshot({ path: path.join(__dirname, 'preview-canvas-trend.png'), fullPage: true });
        for (const [example, recipe, view] of [['bpm', 3, 'spectrum'], ['magnet_supply', 3, 'compare'],
            ['rf_cavity', 1, 'waveform'], ['camera', 0, 'image'], ['vacuum', 0, 'trend']]) {
            await page.selectOption('#example', example);
            await page.locator(`[data-recipe="${recipe}"]`).click();
            const count = await page.locator('[data-chart-canvas="shared"]').count();
            check(`${example}: ${view} uses shared numeric or time surfaces`, count > 0);
            await page.locator('[data-plot-key]').first().getByRole('button', { name: 'Zoom in', exact: true }).click();
            check(`${example}: zoom renders finite geometry`, await page.locator('#chart-area path[d]').evaluateAll(elements =>
                elements.every(element => !/NaN|Infinity/.test(element.getAttribute('d')))));
        }
        const invalidViews = encodeURIComponent(JSON.stringify({ 'trend:0': { x: [1e100, 1e101] }, 'distribution:0': { x: [-1e308, 1e308] } }));
        await page.goto(`file://${__dirname}/index.html#chartViews=${invalidViews}`);
        check('Invalid date and overflowing numeric domains are ignored', await page.evaluate(() => Object.keys(state.chartViews).length === 0));
        check('No browser errors', errors.length === 0);
        const sourceHashes = JSON.parse(fs.readFileSync(path.join(__dirname, 'shared-chart-sources.json')));
        for (const [file, hash] of Object.entries(sourceHashes)) {
            assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', file))).digest('hex'), hash, file);
        }
        check('Bundle identity matches actual production sources', true);
        fs.writeFileSync(path.join(__dirname, 'canvas-browser-check.json'), JSON.stringify({ checks, errors, sourceHashes }, null, 2));
        process.stdout.write(`${checks.length} canvas checks passed.\n`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
