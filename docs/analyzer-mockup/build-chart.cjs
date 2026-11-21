/* Compile the production chart modules for file:// use and record their source identity. */
const webpack = require('webpack');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
webpack({ mode: 'none', devtool: false, entry: path.join(__dirname, 'chart-entry.js'),
    output: { path: __dirname, filename: 'shared-chart.js', library: { name: 'SharedChart', type: 'var' } },
    optimization: { minimize: false }, performance: { hints: false },
}, (error, stats) => {
    if (error || stats.hasErrors()) {
        process.stderr.write(String(error || stats.toString({ all: false, errors: true })) + '\n');
        process.exitCode = 1;
        return;
    }
    const sources = {};
    for (const file of [...stats.compilation.fileDependencies].sort()) {
        if (!file.endsWith('.js') || !file.startsWith(root + '/')) continue;
        sources[path.relative(root, file)] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    }
    fs.writeFileSync(path.join(__dirname, 'shared-chart-sources.json'), JSON.stringify(sources, null, 2) + '\n');
    process.stdout.write(`Bundled ${Object.keys(sources).length} source modules.\n`);
});
