// The Details window of a PV: what getPVStatus, getPVTypeInfo and getPVDetails hold about it, in groups. A value is read by the exact
// name of the call. A name that a call does not hold reads "not provided"; a value that is present and empty, a pair of limits that
// are both 0 and a limit that is NaN read "not set". A time is shown as the call writes it, under the heading of its kind
// (docs/time-handling.md): the time of the data, received, recorded, moved, and the times of the connection, of the settings and of
// the last request.
const NOT_PROVIDED = "not provided";
const NOT_SET = "not set";

function node(tag, attributes, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes || {})) {
        if (value !== undefined && value !== null) {
            element.setAttribute(key, value);
        }
    }
    element.append(...children.filter((child) => child !== null && child !== undefined));
    return element;
}

/** The text of a value: undefined is a name the call does not hold, an empty value or NaN is not set. */
function written(value) {
    if (value === undefined) {
        return { text: NOT_PROVIDED, missing: true };
    }
    if (value === null || value === "" || String(value) === "NaN") {
        return { text: NOT_SET, missing: true };
    }
    return { text: Array.isArray(value) ? value.join(", ") : String(value), missing: false };
}

// ---- readers: each takes the three answers and returns the value, or undefined when the call does not hold the name ----

const details = (name) => (ctx) => (ctx.details.has(name) ? ctx.details.get(name) : undefined);
const info = (key) => (ctx) => (key in ctx.info ? ctx.info[key] : undefined);
const status = (key) => (ctx) => (key in ctx.status ? ctx.status[key] : undefined);
const extra = (key) => (ctx) => (ctx.info.extraFields && key in ctx.info.extraFields ? ctx.info.extraFields[key] : undefined);

/** A pair of limits: not provided when the call holds neither, not set when both are 0 or both are NaN, otherwise each limit by itself. */
function limits(lowKey, highKey) {
    return (ctx) => {
        const low = ctx.info[lowKey];
        const high = ctx.info[highKey];
        if (low === undefined && high === undefined) {
            return undefined;
        }
        const number = (value) => (value === undefined || value === "" || value === null ? Number.NaN : Number(value));
        const neither = Number.isNaN(number(low)) && Number.isNaN(number(high));
        if (neither || (number(low) === 0 && number(high) === 0)) {
            return "";
        }
        const part = (label, value) => `${label} ${Number.isNaN(number(value)) ? NOT_SET : value}`;
        return `${part("low", low)}, ${part("high", high)}`;
    };
}

function sampling(ctx) {
    const method = ctx.info.samplingMethod;
    const period = ctx.info.samplingPeriod;
    if (method === undefined && period === undefined) {
        return undefined;
    }
    return `${method === undefined ? NOT_PROVIDED : method}, period ${period === undefined ? NOT_PROVIDED : `${period} s`}`;
}

/** The names of the stores of the PV in the order the data moves through them, for example STS, MTS, LTS. */
function storeNames(ctx) {
    const urls = Array.isArray(ctx.info.dataStores) ? ctx.info.dataStores : [];
    return urls.map((url, index) => {
        const match = /name=([A-Za-z0-9_]+)/.exec(url);
        return match ? match[1] : `store ${index + 1}`;
    });
}

// ---- the groups ----------------------------------------------------------------------------------

// A row is {label, read}; a time row has the name of getPVDetails as its label. A section may have a heading, the kind of its times.
const row = (label, read) => ({ label, read });
const time = (name) => ({ label: name, read: details(name), time: true });

function groups(ctx) {
    const moves = [];
    const stores = storeNames(ctx);
    const known = new Set();
    for (const name of ctx.details.keys()) {
        const match = /^ETL (\d+) /.exec(name);
        if (match) {
            known.add(Number(match[1]));
        }
    }
    const count = Math.max(Math.max(stores.length - 1, 0), known.size ? Math.max(...known) + 1 : 0);
    for (let i = 0; i < count; i += 1) {
        const from = stores[i] || `store ${i + 1}`;
        const to = stores[i + 1] || `store ${i + 2}`;
        moves.push({
            heading: `From ${from} to ${to}`,
            rows: [
                row("Partition of the source", details(`ETL ${i} partition granularity of source`)),
                row("Partition of the destination", details(`ETL ${i} partition granularity of dest`)),
                row("Last job took (ms)", details(`ETL ${i} last job took (ms)`)),
                row("Times the move ran", details(`ETL ${i} number of times we performed ETL`)),
            ],
            kinds: [{ heading: "Moved between stores", rows: [time(`ETL ${i} last completed`), time(`ETL ${i} next job runs at`)] }],
        });
    }
    return [
        {
            title: "How it is stored",
            rows: [
                row("Appliance", status("appliance")),
                row("Sampling", sampling),
                row("Policy", info("policyName")),
                row("Estimated event rate (events/sec)", details("Estimated event rate (events/sec)")),
                row("Estimated storage rate (MB/day)", details("Estimated storage rate (MB/day)")),
                row("Estimated storage rate (GB/year)", details("Estimated storage rate (GB/year)")),
            ],
            kinds: [{ heading: "Recorded by the archiver", rows: [time("What did we last push the data to the short term store?")] }],
        },
        {
            title: "Amount",
            rows: [
                row("How many events so far?", details("How many events so far?")),
                row("How many raw scan events so far?", details("How many raw scan events so far?")),
                row("Average bytes per event", details("Average bytes per event")),
                row("Number of elements per event", info("elementCount")),
            ],
        },
        {
            title: "Connection",
            rows: [
                row("Is this PV currently connected?", details("Is this PV currently connected?")),
                row("Connection state at last connection changed event", details("Connection state at last connection changed event")),
                row("How many times have we lost and regained the connection to this PV?", details("How many times have we lost and regained the connection to this PV?")),
            ],
            kinds: [
                { heading: "Time of the data", rows: [time("Instant of last event from the IOC - correct or not.")] },
                { heading: "Received by the archiver", rows: [time("When did we receive the last event?")] },
                {
                    heading: "Times of the connection",
                    rows: [
                        time("When did we request CA to make a connection to this PV?"),
                        time("When did we first establish a connection to this PV?"),
                        time("When did we last lose and reestablish a connection to this PV?"),
                        time("When did we last lose a connection to this PV?"),
                    ],
                },
            ],
        },
        {
            title: "Lost events",
            rows: [
                row("How many events lost because the timestamp is in the far future or past so far?", details("How many events lost because the timestamp is in the far future or past so far?")),
                row("How many events lost because the sample buffer is full so far?", details("How many events lost because the sample buffer is full so far?")),
                row("How many events lost because the DBR_Type of the PV has changed from what it used to be?", details("How many events lost because the DBR_Type of the PV has changed from what it used to be?")),
                row("How many events lost totally so far?", details("How many events lost totally so far?")),
            ],
        },
        {
            title: "Who reads it",
            rows: [row("Number of Retrieval Requests", details("Number of Retrieval Requests")), row("Number of unique users", details("Number of unique users"))],
            kinds: [{ heading: "Last request for the data", rows: [time("Time of last Retrieval Request")] }],
        },
        {
            title: "The PV itself",
            rows: [
                row("Data type", info("DBRType")),
                row("Units", info("units")),
                row("Precision", info("precision")),
                row("Display limits", limits("lowerDisplayLimit", "upperDisplayLimit")),
                row("Control limits", limits("lowerCtrlLimit", "upperCtrlLimit")),
                row("Warning limits", limits("lowerWarningLimit", "upperWarningLimit")),
                row("Alarm limits", limits("lowerAlarmLimit", "upperAlarmLimit")),
                row("Record type", extra("RTYP")),
                row("Archived fields", info("archiveFields")),
                row("Host", info("hostName")),
            ],
            kinds: [{ heading: "Settings of the PV", rows: [time("Archival params creation time:"), time("Archival params modification time:")] }],
        },
        { title: "Moves between stores", moves },
    ];
}

function rowNode(spec, ctx) {
    const { text, missing } = written(spec.read(ctx));
    return { missing, node: [node("dt", { class: spec.time ? "time" : null }, spec.label), node("dd", { class: missing ? "none" : null }, text)] };
}

/**
 * The groups of the Details window as one element. ctx: {status, info, details}, the answers of getPVStatus (one row), getPVTypeInfo
 * (an object) and getPVDetails (a Map of the name to the value). A group of which the call holds nothing says so, and says why when
 * the PV is paused, which the archiver does not report on.
 */
export function buildDetails(ctx) {
    const paused = ctx.details.get("Is this PV paused:") === "Yes";
    const host = node("div", { class: "details-groups" });
    for (const group of groups(ctx)) {
        const section = node("section", { class: "details-group" }, node("h3", null, group.title));
        let anything = false;
        const list = (rows) => {
            const dl = node("dl", { class: "facts" });
            for (const spec of rows) {
                const made = rowNode(spec, ctx);
                anything = anything || !made.missing;
                dl.append(...made.node);
            }
            return dl;
        };
        const body = [];
        if (group.moves) {
            for (const move of group.moves) {
                body.push(node("h4", null, move.heading), list(move.rows));
                for (const kind of move.kinds) {
                    body.push(node("h5", null, kind.heading), list(kind.rows));
                }
            }
            if (!group.moves.length) {
                body.push(node("p", { class: "none" }, NOT_PROVIDED));
            }
        } else {
            body.push(list(group.rows));
            for (const kind of group.kinds || []) {
                body.push(node("h5", null, kind.heading), list(kind.rows));
            }
        }
        if (!anything && paused) {
            section.append(node("p", { class: "none" }, "The archiver does not report this while the PV is paused."));
        } else {
            section.append(...body);
        }
        host.append(section);
    }
    return host;
}
