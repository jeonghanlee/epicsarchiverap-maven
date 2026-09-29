# Scripting

## Scope

This page covers calling the management interface from scripts: where
the calls are, where their reference is, and the common ones.

**Out of scope:** the data retrieval URLs ([Retrieving data](retrieval.md)).

## The management calls

Every action of the web interface, and a few more, is an HTTP call to
the business process layer (BPL) of the mgmt web application:

```
http://archiver.example.org:17665/mgmt/bpl/<call>?<parameters>
```

Most calls take GET parameters and return JSON. Calls that take long
PV lists also accept POST, with the names in the body.

## The API reference

The build generates the reference of every call, with its HTTP methods
and parameters, from the code into the mgmt web application:

- `http://<host>:17665/mgmt/ui/api/index.html`, the readable reference;
- `http://<host>:17665/mgmt/ui/api/api.json`, the same content for tools.

The **Help** link of the web interface opens it. Because it is generated
from the deployed code, it is the authority on names and parameters.

## Common calls

| Call | Parameters | Purpose |
| --- | --- | --- |
| `getAllPVs` | `pv` (glob), `limit` | names of the archived PVs |
| `getPVStatus` | `pv` (glob or comma list) | the state of each PV |
| `getPVTypeInfo` | `pv` | the archiving configuration of a PV |
| `archivePV` | `pv`, `samplingperiod` (s, default 1.0), `samplingmethod` (`MONITOR` or `SCAN`, default `MONITOR`), `policy` | start archiving |
| `pauseArchivingPV`, `resumeArchivingPV` | `pv` (glob or comma list) | pause or resume |
| `changeArchivalParameters` | `pv`, `samplingperiod`, `samplingmethod` | change sampling |
| `deletePV` | `pv`, `deleteData` (`true` or `false`, default `false`) | stop archiving; the PV must be paused |
| `renamePV` | `pv`, `newname` | rename; the PV must be paused |
| `getNeverConnectedPVs`, `getCurrentlyDisconnectedPVs`, `getPausedPVsReport` | none | the reports |
| `exportConfig`, `importConfig` | none; `importConfig` takes the export as POST body | the archiving configuration as JSON |
| `getNamedFlag`, `setNamedFlag` | `name`, `value` | named flags ([Operating](operating.md#named-flags)) |
| `getLogLevel`, `setLogLevel` | `component`, `logger`, `level` | log levels ([Logging](logging.md)) |
| `getApplianceInfo` | none | the appliance's identity and URLs |

## Examples

```bash
curl -s "http://archiver.example.org:17665/mgmt/bpl/getPVStatus?pv=TEST:*"
```
```bash
curl -s "http://archiver.example.org:17665/mgmt/bpl/archivePV?pv=TEST:PV:1&samplingperiod=0.5"
```

```python
import requests

mgmt = "http://archiver.example.org:17665/mgmt/bpl"
for status in requests.get(f"{mgmt}/getPVStatus", params={"pv": "TEST:*"}, timeout=30).json():
    print(status["pvName"], status["status"])
```

## List archived PVs

Use [listArchivedPVs.py](samples/listArchivedPVs.py) with Python 3. It uses
only the standard library and requires no packages, credentials in source,
or source edits.

First start an appliance with the [local launcher](developer.md#run-a-local-appliance),
or export `BPL_URL` with an existing appliance's management BPL URL. The local
launcher starts with no archived PVs. The [test procedure](https://github.com/jeonghanlee/epicsarchiverap-maven/blob/modernize/TESTING.md#python-listing-example)
loads the shipped IOC fixture and archives 600 PVs with an `M17LIST:` prefix.
Then run these commands from the repository root:

```bash
python3 -m venv --without-pip work/list-pvs-venv
script=docs/book/src/samples/listArchivedPVs.py
bpl=${BPL_URL:-http://127.0.0.1:17665/mgmt/bpl}
work/list-pvs-venv/bin/python "$script" "$bpl"
work/list-pvs-venv/bin/python "$script" "$bpl" --glob 'M17LIST:*'
work/list-pvs-venv/bin/python "$script" "$bpl" --limit 17
```

Output contains sorted, unique PV names, one per line. An empty appliance or
unmatched glob produces no output and exits 0. The script reads archive
configuration; a listed PV may be paused or disconnected.

| Argument | Behavior |
| --- | --- |
| `bpl_url` | Required HTTP or HTTPS base URL ending in `/bpl`; no query, fragment or embedded credentials |
| `--glob PATTERN` | Optional server filter; quote `*` and `?` to prevent shell expansion |
| `--limit N` | `-1` (default) requests all matches; otherwise 1 through 2147483647 |
| `--timeout SECONDS` | Connect/read timeout greater than 0 and at most 86400 seconds; default 30 |

The default request explicitly sends `limit=-1`, overriding the API's
500-name default. A positive limit applies on the server before client
sorting and deduplication; it does not select the alphabetically first N
names. The HTTP library honors the usual proxy environment variables; use
`NO_PROXY=127.0.0.1,localhost` for direct local access if a proxy is configured.

HTTP errors, timeout, malformed JSON, unexpected response structures and
names that cannot be encoded as UTF-8 or in the stdout encoding
produce a message on stderr and exit 1, with no PV output. Invalid arguments
exit 2 before any request. The script makes no archive changes or automatic
retries. A read timeout bounds a socket read, not the total time for a server
that continuously sends a large response.

## Other sample scripts

The repository folder
[`docs/book/src/samples`](https://github.com/jeonghanlee/epicsarchiverap-maven/tree/modernize/docs/book/src/samples)
holds Python 3 scripts that use these calls, for example to pause,
resume or delete a list of PVs, or to report disconnected PVs. Each
script has its own arguments and dependencies; check its help and calls
against the API reference before relying on it. The older `getPVList.py`
uses a fixed site URL; use `listArchivedPVs.py` for an explicit appliance URL.
