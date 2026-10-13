// The usage treemap of the Operations page: the stored data or the event rate of the archived PVs, grouped by the
// prefix of the PV name, drawn with the d3-hierarchy treemap of the bundled D3. A prefix is a link that finds its PVs
// in the Work page; the blocks inside it are its largest PVs.
import { prefixOf } from "./judge.js";

const d3 = globalThis.d3;

const COLORS = ["#1f6f7c", "#9a5b12", "#6b4c9a", "#3c7a39", "#a2403a", "#3f6a9e", "#6f6f1f", "#86557a", "#2c6e5a", "#8c2f6a", "#5b5b5b"];
const GROUP_LIMIT = 24;
const LEAF_LIMIT = 300;
const HEADER = 22;
const OTHER = "More prefixes";

/** One color for one prefix, whatever the metric, so a prefix keeps its color when the size basis changes. */
function colorOf(name) {
    let hash = 0;
    for (const character of name) {
        hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    return COLORS[hash % COLORS.length];
}

/**
 * The PVs of the rows grouped by name prefix, each with its value. The largest GROUP_LIMIT prefixes are kept and the
 * rest are one group; at most LEAF_LIMIT PVs are listed one by one and the remainder of a prefix is one block.
 */
export function usageGroups(rows, nameOf, valueOf) {
    const byPrefix = new Map();
    for (const row of rows) {
        const name = nameOf(row);
        const value = valueOf(row);
        const prefix = prefixOf(name);
        let group = byPrefix.get(prefix);
        if (!group) {
            group = { name: prefix, count: 0, total: 0, items: [] };
            byPrefix.set(prefix, group);
        }
        group.count += 1;
        if (value > 0) {
            group.total += value;
            group.items.push({ name, value });
        }
    }
    const all = Array.from(byPrefix.values()).filter((group) => group.total > 0).sort((a, b) => b.total - a.total);
    const kept = all.slice(0, GROUP_LIMIT);
    const folded = all.slice(GROUP_LIMIT);
    const listed = new Map(kept.map((group) => [group, []]));
    kept.flatMap((group) => group.items.map((item) => [group, item]))
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, LEAF_LIMIT)
        .forEach(([group, item]) => listed.get(group).push(item));
    const groups = kept.map((group) => {
        const items = listed.get(group);
        const rest = group.total - items.reduce((sum, item) => sum + item.value, 0);
        const more = group.count - items.length;
        const children = items.slice();
        if (more > 0 && rest > 0) {
            children.push({ name: `${more} more PV${more === 1 ? "" : "s"}`, value: rest });
        }
        return { name: group.name, count: group.count, total: group.total, children, link: true };
    });
    if (folded.length) {
        const total = folded.reduce((sum, group) => sum + group.total, 0);
        const count = folded.reduce((sum, group) => sum + group.count, 0);
        groups.push({ name: OTHER, count, total, children: [{ name: `${count} PVs in ${folded.length} prefixes`, value: total }], link: false });
    }
    return {
        groups,
        pvs: rows.length,
        listedPVs: Array.from(listed.values()).reduce((sum, items) => sum + items.length, 0),
        foldedPrefixes: folded.length,
        total: all.reduce((sum, group) => sum + group.total, 0),
    };
}

/**
 * Draws the groups into the host element at the given width. options.format turns a value into text and
 * options.href gives the address a prefix links to.
 */
export function drawUsage(host, model, options) {
    host.textContent = "";
    const width = Math.max(280, Math.floor(options.width));
    const height = width < 560 ? 420 : 460;
    const root = d3
        .hierarchy({ name: "all", children: model.groups }, (d) => d.children)
        .sum((d) => (d.children ? 0 : d.value))
        .sort((a, b) => b.value - a.value);
    d3.treemap().size([width, height]).paddingInner(2).paddingOuter(2).paddingTop((d) => (d.depth === 1 ? HEADER : 2)).round(true)(root);

    const svg = d3.select(host).append("svg").attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);
    for (const group of root.children) {
        const data = group.data;
        const color = colorOf(data.name);
        const boxWidth = group.x1 - group.x0;
        const boxHeight = group.y1 - group.y0;
        const summary = `${data.name}: ${options.format(group.value)}, ${data.count} PV${data.count === 1 ? "" : "s"}`;
        const outer = svg.append(data.link ? "a" : "g").attr("transform", `translate(${group.x0},${group.y0})`);
        if (data.link) {
            outer.attr("href", options.href(data.name)).attr("aria-label", `${summary}. Find its PVs in Work.`);
        }
        outer.append("title").text(summary);
        outer.append("rect").attr("width", boxWidth).attr("height", boxHeight).attr("fill", color).attr("fill-opacity", 0.16).attr("stroke", color).attr("stroke-width", 1.5);
        let label = "";
        if (boxWidth > 150) {
            label = `${data.name}  ${options.format(group.value)}  ${data.count} PV${data.count === 1 ? "" : "s"}`;
        } else if (boxWidth > 70) {
            label = data.name;
        }
        outer.append("text").attr("x", 6).attr("y", 15).attr("font-size", 14).attr("font-weight", 600).attr("fill", color).text(label);
        for (const leaf of group.leaves()) {
            const w = leaf.x1 - leaf.x0;
            const h = leaf.y1 - leaf.y0;
            const cell = outer.append("g").attr("transform", `translate(${leaf.x0 - group.x0},${leaf.y0 - group.y0})`);
            cell.append("title").text(`${leaf.data.name}: ${options.format(leaf.value)}`);
            cell.append("rect").attr("width", w).attr("height", h).attr("fill", color).attr("fill-opacity", 0.78);
            if (w > 92 && h > 20) {
                const name = leaf.data.name;
                const shown = name.startsWith(`${data.name}:`) ? name.slice(data.name.length + 1) : name;
                cell.append("text").attr("x", 5).attr("y", 15).attr("font-size", 14).attr("fill", "#fff").text(shown);
            }
        }
    }
}
