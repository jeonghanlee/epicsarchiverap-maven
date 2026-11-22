/* Exercise real pointer picking and redraws against the prototype's saved observations and computed exports. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/tmp/analyzer-design-browser-20261104/node_modules/playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const checks = [], errors = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
const close = (shown, expected) => Math.abs(Number(shown) - expected) <= Math.max(1e-12, Math.abs(expected) * 0.00006);
const numbers = text => [...text.replace(/\u2212/g, '-').matchAll(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)].map(match => Number(match[0]));

(async () => {
    const browser = await chromium.launch({ headless: true,
        executablePath: process.env.CHROMIUM_PATH || '/home/jeonglee/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        page.on('pageerror', error => errors.push(error.message));
        const open = async (example, view, recipe) => {
            await page.goto(`file://${__dirname}/index.html#example=${example}&view=${view}&panel=Options`);
            if (recipe !== undefined) await page.locator(`[data-recipe="${recipe}"]`).click();
            await frame();
        };
        const host = key => `[data-plot-key="${key}"]`;
        const svg = key => page.locator(`${host(key)} svg[data-chart-canvas]`);
        const tip = () => page.locator('.canvas-tip:not([hidden])');
        const exported = () => page.evaluate(() => resultExport);
        const frame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const coordinates = (key, point) => svg(key).evaluate((element, pair) => {
            const value = new DOMPoint(...pair).matrixTransform(element.getScreenCTM());
            return [value.x, value.y];
        }, point);
        const move = async (key, point) => {
            await svg(key).scrollIntoViewIfNeeded();
            await page.mouse.move(...await coordinates(key, point));
        };
        const across = async (key, fraction = 0.31) => {
            const width = await svg(key).evaluate(element => element.viewBox.baseVal.width);
            await move(key, [72 + (width - 90) * fraction, 90]);
        };
        const mark = async (key, kind, index) => {
            const location = await page.locator(`${host(key)} .plot-marks ${kind}`).nth(index).evaluate(element =>
                element.tagName === 'rect' ? [Number(element.getAttribute('x')) + Number(element.getAttribute('width')) / 2, 100]
                    : [Number(element.getAttribute('cx')), Number(element.getAttribute('cy'))]);
            await move(key, location);
        };

        await open('temperature', 'distribution', 2);
        let rows = await exported();
        let index = rows.reduce((best, row, i) => row.sample_count > rows[best].sample_count ? i : best, 0);
        await mark('distribution:0', 'rect', index);
        let text = await tip().innerText();
        check('Histogram hover shows the bin bounds and exact count', text.includes(`Bin ${index + 1}`)
            && text.includes(`Samples: ${rows[index].sample_count}`) && close(numbers(text.split('\n')[1])[0], rows[index].lower)
            && close(numbers(text.split('\n')[1])[1], rows[index].upper));
        await page.click('#run-fit');
        rows = await exported();
        const fitBefore = await page.evaluate(() => JSON.stringify(activeFit.result));
        await mark('distribution:0', 'rect', index);
        text = await tip().innerText();
        check('Histogram hover includes the completed fitted count', close(numbers(text.split('\n').find(row => row.startsWith('Fitted:')))[0], rows[index].fitted));
        await mark('distribution:0', 'rect', rows.length - 1);
        check('Last histogram bin advertises an inclusive upper bound', (await tip().innerText()).split('\n')[1].includes(']'));
        await mark('distribution:1', 'circle', 8);
        text = await tip().innerText();
        check('Residual hover reports actual observed, fitted and residual values', ['Observed:', 'Fitted:', 'Residual:'].every(label => text.includes(label))
            && close(numbers(text.split('\n').find(row => row.startsWith('Residual:')))[0], rows[8].residual));
        check('Hover leaves the fit unchanged', await page.evaluate(() => JSON.stringify(activeFit.result)) === fitBefore);
        await move('distribution:1', [20, 80]);
        check('Axis margins hide the tooltip', await tip().count() === 0);
        await page.locator(`${host('distribution:0')} .axis-key-x`).evaluate(element => element.focus({ preventScroll: true }));
        await mark('distribution:0', 'rect', index);
        await page.keyboard.press('Escape');
        check('Escape dismisses hover', await tip().count() === 0);
        await page.locator(host('distribution:0')).getByRole('button', { name: 'Zoom in', exact: true }).click();
        await across('distribution:0', 0.5);
        check('Hover survives an X redraw without refitting', await tip().count() === 1 && await page.evaluate(() => JSON.stringify(activeFit.result)) === fitBefore);
        await page.locator(host('distribution:0')).screenshot({ path: path.join(__dirname, 'preview-histogram-hover.png') });
        await page.locator('#custom-bins').fill('1000');
        await page.locator('#custom-bin-form').getByRole('button', { name: 'Apply', exact: true }).click();
        await mark('distribution:0', 'rect', 500);
        const denseBounds = numbers((await tip().innerText()).split('\n')[1]);
        check('Dense histogram bins retain distinguishable hover boundaries', denseBounds[0] < denseBounds[1]);

        await open('bpm', 'correlation', 1);
        rows = await exported(); index = 400;
        await mark('correlation:0', 'circle', index);
        text = await tip().innerText();
        check('Scatter hover identifies an actual pair with units and time', text.includes('Paired observation') && text.includes('Temperature:')
            && text.includes('BPM X:') && text.includes('UTC') && close(numbers(text.split('\n')[1])[0], rows[index].x)
            && close(numbers(text.split('\n')[2])[0], rows[index].y));
        await move('correlation:0', [73, 33]);
        check('Empty scatter space does not invent a sample', await tip().count() === 0);
        await page.click('#tab-dependency');
        rows = await exported();
        const cell = page.locator('#chart-area svg g[role="button"]').nth(1);
        await cell.hover(); text = await tip().innerText();
        check('Dependency hover shows the computed coefficient and pair count', text.includes(`Paired samples: ${rows[1].paired_samples}`)
            && close(numbers(text.split('\n')[1])[0], rows[1].pearson_r));
        await cell.focus(); await page.keyboard.press('Escape');
        check('Dependency keyboard hover dismisses with Escape', await tip().count() === 0);
        await cell.click();
        check('Dependency drill-down remains active', await page.locator('#tab-correlation').getAttribute('aria-selected') === 'true');

        await open('bpm', 'spectrum', 3);
        rows = await exported();
        await across('spectrum:0', 0.31);
        const spectral = rows.reduce((best, row) => Math.abs(row.frequency_Hz - 62) < Math.abs(best.frequency_Hz - 62) ? row : best);
        text = await tip().innerText();
        check('Spectrum hover shows a computed frequency bin and amplitude', close(numbers(text.split('\n')[1])[0], spectral.frequency_Hz)
            && close(numbers(text.split('\n')[2])[0], spectral.amplitude) && text.includes('Hz') && text.includes('um'));

        await open('magnet_supply', 'compare', 3);
        rows = await exported();
        for (const [number, range, elapsed] of [[0, 'A', 7.62], [1, 'B', 5.62]]) {
            await across(`compare:${number}`);
            const expected = rows.filter(row => row.range === range).reduce((best, row) => Math.abs(row.elapsed_s - elapsed) < Math.abs(best.elapsed_s - elapsed) ? row : best);
            text = await tip().innerText();
            check(`Compare ${range} uses its own acquisition time and value`, text.includes(`Range ${range}`) && text.includes('UTC')
                && close(numbers(text.split('\n').find(row => row.startsWith('Value:')))[0], expected.value));
            check(`Compare ${range} has one active tooltip`, await tip().count() === 1);
        }
        await open('temperature', 'trend', 1);
        await page.click('#tab-compare');
        const missingPosition = await page.evaluate(() => {
            const missing = currentSeries().samples.find(sample => !Number.isFinite(sample.value));
            return (missing.time - state.from) / (state.to - state.from);
        });
        await across('compare:0', missingPosition);
        check('Missing observations do not become fabricated hover values', await tip().count() === 0);
        await open('beam_current', 'compare');
        await across('compare:1');
        check('An empty comparison interval has no sample tooltip', await tip().count() === 0);

        await open('rf_cavity', 'waveform', 1);
        rows = await exported();
        await across('waveform:0');
        text = await tip().innerText();
        const frames = [1, 0].map(frameIndex => rows.filter(row => row.frame_index === frameIndex));
        const expectedWaves = frames.map(group => {
            const target = group[0].axis + (group.at(-1).axis - group[0].axis) * 0.31;
            return group.reduce((best, row) => Math.abs(row.axis - target) < Math.abs(best.axis - target) ? row : best);
        });
        const shownWaves = text.split('\n').filter(row => row.startsWith('Value:')).map(row => numbers(row)[0]);
        check('Waveform hover includes current and reference samples', shownWaves.length === 2 && expectedWaves.every((row, i) => close(shownWaves[i], row.value))
            && text.includes('us') && text.includes('MV'));

        await open('camera', 'image', 1);
        rows = await exported();
        const camera = page.locator('.image-layout canvas');
        await camera.scrollIntoViewIfNeeded();
        const pixelPoint = await camera.evaluate(element => { const box = element.getBoundingClientRect(); return [box.left + box.width * 10.5 / 96, box.top + box.height * (64 - 15.5) / 64]; });
        await page.mouse.move(...pixelPoint);
        text = await tip().innerText();
        const pixel = rows.find(row => row.x_pixel === 10 && row.y_pixel === 15);
        check('Image hover uses the lower-left pixel origin and saved ADU', text.includes('Pixel X: 10 / Y: 15') && text.includes(`Intensity: ${pixel.intensity_ADU} ADU`));
        for (const [number, axis] of [[0, 'X'], [1, 'Y']]) {
            await across(`image:${number}`);
            text = await tip().innerText();
            const position = numbers(text.split('\n')[1])[0];
            const pixels = rows.filter(row => axis === 'X' ? row.x_pixel === position : row.y_pixel === position);
            const mean = pixels.reduce((sum, row) => sum + row.intensity_ADU, 0) / pixels.length;
            check(`Image ${axis} profile hover matches the saved pixel mean`, text.includes(`Image ${axis} profile`)
                && close(numbers(text.split('\n')[2])[0], mean));
        }
        await page.click('#tab-waveform'); await page.selectOption('#profile-axis', 'histogram');
        await across('waveform:0');
        check('Camera intensity histogram hover labels the pixel count', (await tip().innerText()).includes('pixel count'));
        await page.selectOption('#demo-state', 'empty');
        check('Empty views remove prior hover elements', await page.locator('.canvas-tip').count() === 0);

        for (const width of [1440, 720, 320]) {
            await page.setViewportSize({ width, height: 700 });
            for (const view of ['distribution', 'trend']) {
                await open('temperature', view);
                const key = `${view}:0`;
                await svg(key).evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 80));
                const initial = await page.evaluate(() => ({ y: window.scrollY, data: JSON.stringify(resultExport) }));
                const drawingWidth = await svg(key).evaluate(element => element.viewBox.baseVal.width);
                const left = view === 'distribution' ? 72 : await page.locator(`${host(key)} clipPath rect`).evaluate(element => Number(element.getAttribute('x')) + 3);
                const start = await coordinates(key, [left + (drawingWidth - left - 18) * 0.2, 90]);
                const end = await coordinates(key, [left + (drawingWidth - left - 18) * 0.8, 90]);
                await page.mouse.move(...start); await page.mouse.down(); await page.mouse.move(...end, { steps: 8 });
                if (view === 'distribution') check(`Width ${width}: dragging hides hover`, await tip().count() === 0);
                await page.mouse.up(); await frame();
                const afterX = await page.evaluate(() => window.scrollY);
                check(`Width ${width}: ${view} X drag preserves scroll (${initial.y} to ${afterX})`, Math.abs(afterX - initial.y) <= 1);
                check(`Width ${width}: ${view} X drag preserves exported data`, await page.evaluate(() => JSON.stringify(resultExport)) === initial.data);
                check(`Width ${width}: ${view} X drag changes the displayed range`, await page.evaluate(key => !!state.chartViews[key]?.x, key));
                const beforeY = await page.evaluate(() => window.scrollY);
                const yRanges = () => page.evaluate(({ view, key }) => JSON.stringify(view === 'trend' ? state.ranges : state.chartViews[key]?.y), { view, key });
                const oldY = await yRanges();
                const yStart = await coordinates(key, [30, 80]), yEnd = await coordinates(key, [30, 220]);
                await page.mouse.move(...yStart); await page.mouse.down(); await page.mouse.move(...yEnd, { steps: 8 }); await page.mouse.up(); await frame();
                check(`Width ${width}: ${view} Y drag preserves scroll`, Math.abs(await page.evaluate(() => window.scrollY) - beforeY) <= 1);
                check(`Width ${width}: ${view} Y drag changes the displayed range`, await yRanges() !== oldY);
                const axis = page.locator(`${host(key)} .axis-key[data-unit]`).first();
                await axis.evaluate(element => { window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 550); element.focus({ preventScroll: true }); });
                const beforeKey = await page.evaluate(() => window.scrollY);
                const oldKeyY = await yRanges();
                await page.keyboard.press('+'); await frame();
                check(`Width ${width}: ${view} keyboard redraw preserves scroll`, Math.abs(await page.evaluate(() => window.scrollY) - beforeKey) <= 1);
                check(`Width ${width}: ${view} keyboard changes the displayed range`, await yRanges() !== oldKeyY);
                check(`Width ${width}: ${view} retains keyboard focus`, await page.locator(`${host(key)} .axis-key[data-unit]`).first().evaluate(element => element === document.activeElement));
            }
            await open('temperature', 'distribution', 2);
            await across('distribution:0', 0.9);
            const box = await tip().boundingBox();
            check(`Width ${width}: tooltip stays inside the viewport`, box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 701);
            check(`Width ${width}: hover causes no page overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            if (width === 320) await page.locator(host('distribution:0')).screenshot({ path: path.join(__dirname, 'preview-hover-320.png') });
        }
        const sources = JSON.parse(fs.readFileSync(path.join(__dirname, 'shared-chart-sources.json')));
        check('Bundle matches actual shared source modules', Object.entries(sources).every(([name, hash]) => crypto.createHash('sha256')
            .update(fs.readFileSync(path.resolve(__dirname, '../..', name))).digest('hex') === hash));
        check('No browser errors', errors.length === 0);
        const sourceHashes = Object.fromEntries(['mockup.js', 'mockup.css', 'shared-plots.js', 'fit-ui.js', 'shared-chart.js', 'signal-data.js', 'verify-hover.cjs']
            .map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex')]));
        fs.writeFileSync(path.join(__dirname, 'hover-check.json'), JSON.stringify({ observed_at: new Date().toISOString(), checks, errors, sourceHashes }, null, 2));
        process.stdout.write(`${checks.length} hover and viewport checks passed.\n`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
