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
| `renamePV` | `pv`, `newname` | copy paused configuration and data to an unused name; retain both names |
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

## Request archiving and inspect status

Use [archivePVList.bash](samples/archivePVList.bash) to submit requests and
[getPVStatus.py](samples/getPVStatus.py) to read the appliance's actual state.
Keep the archive script with [archiverClient.bash](samples/archiverClient.bash).
It requires Bash 4 or later, curl, jq, iconv, and awk.
Keep the status script with [archiverClient.py](samples/archiverClient.py) and
[listArchivedPVs.py](samples/listArchivedPVs.py). Status queries use Python 3's standard library.

Start the [local appliance](developer.md#run-a-local-appliance) or select an
existing appliance. Set `BPL_URL` to its management URL ending in `/bpl` and
`PV_FILE` to a UTF-8 file of PV names you intend to archive, one per line.
The archive command changes that appliance's configuration.
Then run from the repository root:

```bash
python3 -m venv --without-pip work/list-pvs-venv
samples=docs/book/src/samples
bpl=${BPL_URL:?Set BPL_URL to the management BPL base URL}
pv_file=${PV_FILE:?Set PV_FILE to your input file}
work/list-pvs-venv/bin/python "$samples/getPVStatus.py" "$bpl" "$pv_file"
bash "$samples/archivePVList.bash" "$bpl" "$pv_file"
work/list-pvs-venv/bin/python "$samples/getPVStatus.py" "$bpl" "$pv_file"
```

Both commands report per-PV results in an aligned ASCII table with `PV Name`
and `Status`, in input order, followed by total, successful and failed counts. Successful
status queries can report `Not being archived` or `Initial sampling`.
`Being archived` is separate from archive request acceptance, and does not
by itself prove that the IOC is connected. Repeat the status command to
observe progress; neither script waits for collection to begin.

The archive command accepts `--sampling-method MONITOR|SCAN` and
`--sampling-period SECONDS` (defaults MONITOR and 1). The period must be
positive and representable as a finite 32-bit float. The server can enforce
a minimum period. `Already submitted` is successful request handling; it
does not mean existing sampling settings were updated. Use the appliance's
sampling-parameter operation to change an existing configuration.

Input names must be printable ASCII without spaces, commas, `*` or `?`.
Blank lines are skipped, surrounding whitespace is stripped, and `#` is a
literal name character. LF, CRLF, and CR line endings are accepted.
There is no comment syntax. Archive inputs must be
independent: duplicate names, protocol/`.VAL` equivalents and configured
alias collisions are rejected before mutation. Multiple fields of the same
record are conservatively rejected in one archive batch because the server
may archive them as part of the parent stream. Read-only status queries may
repeat a name. IOC aliases not yet discovered by the appliance cannot be
resolved by this check; use canonical IOC names for new requests.

Both scripts accept `--timeout` with the listing script's bounds. Exit 0
means every query/request succeeded, exit 1 means at least one failed, and
exit 2 means local input or identity overlap was rejected. Local input
errors send no HTTP; alias overlap checks use only read requests.

Archive preflight failures print errors to stderr, produce no result table,
and send no archive request. Status query failures appear as `Query failed`
for the affected PV, with details on stderr; subsequent inputs are still queried.
Archive POST timeouts and unusable responses appear as `Outcome unknown`;
inspect actual status before retrying. A server rejection or uncertain archive
outcome is shown for its PV, details go to stderr, and subsequent independent
inputs are still processed. No automatic mutation retries or batch rollback
are performed. The server validates PV-specific syntax beyond the input-file
restrictions above.

The Bash archive client's timeout bounds the complete HTTP request.
It rounds the requested timeout up to the next millisecond, with a minimum
of 0.001 seconds. Its HTTP transport honors the curl proxy environment,
ignores curl configuration files, and does not follow redirects.
It preserves the supplied URL path, including braces and brackets.

The [test procedure](https://github.com/jeonghanlee/epicsarchiverap-maven/blob/modernize/TESTING.md#archive-and-status-examples)
uses the shipped IOC fixture to reproduce these states and sampling checks.

## Pause and resume archiving

Use [pausePVList.py](samples/pausePVList.py) and
[resumePVList.py](samples/resumePVList.py) for existing archived PVs. Keep
[archiverClient.py](samples/archiverClient.py) and
[listArchivedPVs.py](samples/listArchivedPVs.py) beside them. Both commands
use the Python standard library and the same explicit BPL URL, UTF-8 input
file, ASCII table and `--timeout` bounds as archive/status.

Set `BPL_URL` and `PV_FILE` as above; start with the listed PVs archiving.
From the repository root:

```bash
python3 docs/book/src/samples/pausePVList.py "$BPL_URL" "$PV_FILE"
python3 docs/book/src/samples/getPVStatus.py "$BPL_URL" "$PV_FILE"
python3 docs/book/src/samples/resumePVList.py "$BPL_URL" "$PV_FILE"
python3 docs/book/src/samples/getPVStatus.py "$BPL_URL" "$PV_FILE"
```

The request rows report `Pause accepted` and `Resume accepted`. Pause
requires successful management, engine and ETL responses; resume requires
management and engine responses. Status queries report `Paused` and
`Being archived` once those states are visible. Repeat the separate status
query if needed; the mutation commands return without polling. Request
acceptance and status do not prove stored data. The
[real verification procedure](https://github.com/jeonghanlee/epicsarchiverap-maven/blob/modernize/TESTING.md#python-pause-and-resume-examples)
checks unchanged stored data before resume, the baseline and resumed PB
persistence. The first current value received after resume keeps its IOC
timestamp, which can fall within the pause interval. That timestamp does
not mean the appliance received the value while paused.

The engine stops accepting samples into the paused channel's buffer and
finishes pending writes before removing the channel. A storage failure
keeps the pending data and returns an engine failure. Management metadata
may already show `Paused`, so the client reports `Outcome unknown`; inspect
the storage error before resuming. A retained channel must finish its
pending writes before sampling can resume.

If an append writes only part of a PB header or sample, the engine restores
that file to its length before the failed append. Earlier completed writes
remain intact. If file recovery also fails, the pending batch stays in
memory and recovery must succeed before another append can proceed.

Each line names one record or one ordinary field. One optional `ca://` or
`pva://` prefix and a terminal `.VAL` resolve to the canonical stored name.
Repeated protocol prefixes are rejected before any HTTP request.
Field modifiers such as `.VAL.[0:1]`, additional dot segments and fields
beginning with `VAL` other than the exact `VAL` are rejected. Configured
aliases resolve before mutation; use canonical IOC names for aliases the
appliance has not discovered. Duplicate, alias-equivalent and same-record
inputs are rejected together. These stricter name rules apply to
pause/resume; archive input behavior is unchanged.

The client sends one JSON POST per canonical PV in input order. Unknown
PVs and repeated operations (`pause` while paused, `resume` while archiving)
are `Rejected`. Missing, contradictory or failed component responses,
timeouts and unusable responses report `Outcome unknown`, because metadata
may already have changed. Inspect actual status before a manual retry.
Details go to stderr; independent later PVs still run. There is no automatic
retry or rollback.

Exit 0 means every request was accepted; exit 1 means a preflight or request
failed; exit 2 means invalid local input or overlapping identities. Local
input failures send no HTTP requests. Remote identity validation uses only
read requests and sends no mutations on failure.

## Rename a paused PV

Use [renamePVList.py](samples/renamePVList.py) with the companion
[archiverClient.py](samples/archiverClient.py) and
[listArchivedPVs.py](samples/listArchivedPVs.py) in the same folder. These
clients use only the Python 3 standard library.

Prepare three explicitly selected UTF-8 files: `SOURCE_FILE` lists the
archived source names, `PAIR_FILE` contains one `old,new` pair per line,
and `BOTH_FILE` lists both names from every pair for the final status check.
Each pair has exactly one comma and two nonempty printable ASCII PV names.
Blank lines are ignored and surrounding whitespace is stripped. Names are
case-sensitive; `#` is literal. There is no CSV quoting or comment syntax.
The pause/resume name restrictions apply to both columns, including one
optional protocol prefix and exact terminal `.VAL` normalization.

Every source must be paused and every destination unused. Independent pairs
cannot repeat either identity, form chains, or address fields of the same
record. The client rejects local overlap before HTTP and checks configured
aliases and type-info identities with read-only requests before mutation.
Undiscovered IOC aliases require canonical input names.

With `BPL_URL`, `SOURCE_FILE`, `PAIR_FILE` and `BOTH_FILE` set to your
selected URL and files, run:

```bash
python3 docs/book/src/samples/pausePVList.py "$BPL_URL" "$SOURCE_FILE"
python3 docs/book/src/samples/getPVStatus.py "$BPL_URL" "$SOURCE_FILE"
python3 docs/book/src/samples/renamePVList.py "$BPL_URL" "$PAIR_FILE"
python3 docs/book/src/samples/getPVStatus.py "$BPL_URL" "$BOTH_FILE"
```

The three-column table reports `Old PV Name`, `New PV Name` and `Status`,
followed by total, successful and failed counts. `Rename accepted` means
the API acknowledged the request. Verify copied sampling settings and the
same timestamp/value/status/severity records over a fixed interval under
both names before using the destination. The source configuration and data
remain present; both names remain paused. This command does not resume or
delete either name.

A copy failure may leave paused destination metadata and incomplete data.
Validation messages, HTTP errors, redirects, timeouts and unusable responses
therefore report `Outcome unknown`, with details on stderr. Independent
later pairs continue. Mutation redirects are never followed by rename,
archive, pause or resume; none of these clients retries automatically.
Inspect both configurations and stored samples before a manual recovery or
retry. A failed nonempty PB file must not be treated as an empty archive.

Exit 0 means all pairs were accepted, exit 1 means a preflight or operation
failed, and exit 2 means invalid local input or overlapping identities.
`--timeout` defaults to 30 seconds and accepts values greater than zero and
at most 86400 seconds. The [real verification procedure](https://github.com/jeonghanlee/epicsarchiverap-maven/blob/modernize/TESTING.md#python-rename-example)
checks source retention and exact copied records through actual retrieval
and PB readers, including filesystem failures during copying.

## Currently disconnected PVs

Use [printCurrentlyDisconnectedPVs.py](samples/printCurrentlyDisconnectedPVs.py)
with [archiverClient.py](samples/archiverClient.py) and
[listArchivedPVs.py](samples/listArchivedPVs.py) in the same folder.
Python 3 needs only the standard library. The script reads the management
report once and requires no PV file.

Start the [local appliance](developer.md#run-a-local-appliance) and an IOC,
then archive its PVs using the archive procedure above. Set `BPL_URL` to
the direct management URL. The
[disconnection test procedure](https://github.com/jeonghanlee/epicsarchiverap-maven/blob/modernize/TESTING.md#python-disconnection-example)
provides the shipped IOC setup and checks actual IOC loss and recovery.
From the repository root, read the report and its literal filters:

```bash
python3 -m venv --without-pip work/disconnected-venv
script=docs/book/src/samples/printCurrentlyDisconnectedPVs.py
bpl=${BPL_URL:-http://127.0.0.1:17665/mgmt/bpl}
work/disconnected-venv/bin/python "$script" "$bpl"
work/disconnected-venv/bin/python "$script" "$bpl" --timeout 15
work/disconnected-venv/bin/python "$script" "$bpl" --onlyNA
work/disconnected-venv/bin/python "$script" "$bpl" --noNA
```

The output groups rows under `Appliance <instance>:` and sorts appliance
identities and PV names. Each PV line contains its name and the exact
server-generated `connectionLostAt` string. Paused PVs are excluded.
A pending archive request does not prove that an engine channel exists;
the current-disconnection and never-connected reports answer different questions.

The CLI preserves locale text, including non-ASCII month names, and does
not parse, translate, or normalize either time field. Its stdout encoding
must represent that text. `Never` and `N/A` remain literal values.

| Argument | Behavior |
| --- | --- |
| `url` | Required HTTP(S) management base ending in `/bpl`, without credentials, query, or fragment |
| `--timeout SECONDS` | Socket connect/read limit greater than zero and at most 86400; default 30 |
| `--onlyNA` | Include only rows whose `connectionLostAt` equals the literal `N/A` |
| `--noNA` | Exclude those literal `N/A` rows; `--onlyNA` takes precedence when both are supplied |

These filters do not classify never-connected PVs. The engine normally
provides a timestamp for `connectionLostAt`, including its startup time
when no positive loss time exists.

A successful empty or filtered-empty report writes nothing and exits 0.
HTTP, transport, JSON, schema, and output failures produce stderr and exit 1.
Invalid arguments exit 2 before HTTP. The CLI validates the complete array
and its output encoding before writing PV lines, rejects duplicate identities,
and sends no mutations or automatic retries.

Management queries every configured engine before returning a successful
array. An unavailable, invalid, or timed-out engine produces HTTP 503 with
an `application/json` UTF-8 error object containing `status=error` and `desc`.
This failure must not be counted as zero disconnections. Engine requests
use five-second connect/pool limits and a ten-second read timeout; redirects
and automatic retries are disabled. Socket timeouts bound individual waits,
not the complete duration across multiple configured engines.

## Bash sample scripts

Seven Bash scripts in `docs/book/src/samples` compare PV lists with the
appliance, report type changes and engine activity, and run alert checks.
Each script sources [archiverClient.bash](samples/archiverClient.bash) from
its own folder, so keep them together; a symbolic link to a script works.
They need Bash 4 or later, `curl`, `jq`, `iconv`, GNU `find`, and GNU
coreutils.

Every HTTP script takes the management URL ending in `/bpl` as its first
argument and accepts `--timeout SEC`, a limit for each request greater than
0 and at most 86400 seconds (default 30). Redirects are not followed.
Results go to stdout and diagnostics to stderr. `-h` prints the usage.

| Exit status | Comparison and report scripts | Alert checks |
| --- | --- | --- |
| 0 | Complete output | Nothing to report |
| 1 | Request or response failure; for `checkForEngineActivity.bash`, no change seen | Alert reported on stdout |
| 2 | Invalid arguments or input, before any request | Invalid arguments |
| 3 | Not used | Check incomplete, reported on stderr; it takes precedence over 1 |

The management reports behind `listTypeChanges.bash`,
`checkTypeChangedPVs.bash`, and `storageSizeCheck.bash` skip an engine that
does not answer. For these scripts an unavailable engine looks like an
empty report.

### Compare a PV list with the appliance

[unarchivedPVs.bash](samples/unarchivedPVs.bash) prints the rows of a file
whose PV the appliance does not know. Known names include configured PVs,
aliases, fields, and pending archive requests.
[archivedPVsNotInList.bash](samples/archivedPVsNotInList.bash) prints the
configured PVs that the file does not list; aliases and pending requests
are not part of that set.

The file is UTF-8 CSV and the first column of each row names a PV. Blank
lines are skipped and surrounding whitespace is removed from the row and
from the first column. A file without names is rejected by
`archivedPVsNotInList.bash`. From the repository root, compare a file with
the appliance:

```bash
samples=docs/book/src/samples
bpl=${BPL_URL:-http://127.0.0.1:17665/mgmt/bpl}
"$samples/unarchivedPVs.bash" "$bpl" "$PV_FILE"
"$samples/archivedPVsNotInList.bash" "$bpl" "$PV_FILE"
```

Set `PV_FILE` to the CSV file. `unarchivedPVs.bash` prints the original
rows in byte order of their names; when a name repeats, its last row is
printed. `archivedPVsNotInList.bash` prints one name per line in byte
order.

### Report type changes and engine activity

[listTypeChanges.bash](samples/listTypeChanges.bash) lists each PV that
drops events because its type changed, with the type it started with and
the type Channel Access reports. A PV whose details cannot be read is
reported on stderr, the remaining PVs are listed, and the script exits 1.
[checkForEngineActivity.bash](samples/checkForEngineActivity.bash) walks a
storage folder twice, `-t` seconds apart, and counts files whose path or
size changed; it makes no HTTP request and exits 1 when nothing changed.
With `samples` and `bpl` set as in the previous block, list type changes
and check the short-term store for writes:

```bash
"$samples/listTypeChanges.bash" "$bpl"
"$samples/checkForEngineActivity.bash" -t 30 "$STS_FOLDER"
```

Set `STS_FOLDER` to the short-term store folder of the appliance; for the
[local appliance](developer.md#run-a-local-appliance) it is
`<run_folder>/stores/sts`.

### Run the alert checks

The alert checks run once and exit; a scheduler or an operator runs them.
They send no mail. Each prints its alert on stdout and exits 1, so a
scheduler can act on the exit status alone. With `samples` and `bpl` set
as above, run the three checks:

```bash
"$samples/checkConnectedPVs.bash" -d 5 "$bpl"
"$samples/checkTypeChangedPVs.bash" "$bpl"
"$samples/storageSizeCheck.bash" --limit 100 "$bpl" 50
```

- [checkConnectedPVs.bash](samples/checkConnectedPVs.bash) reports each
  appliance whose disconnected share of PVs exceeds `-d` percent (default
  5). An appliance without PVs raises no alert. An appliance whose counts
  are missing because its engine did not answer makes the check exit 3.
- [checkTypeChangedPVs.bash](samples/checkTypeChangedPVs.bash) prints the
  number of PVs that drop events because their type changed, then one name
  per line.
- [storageSizeCheck.bash](samples/storageSizeCheck.bash) prints the PVs
  whose estimated storage exceeds the given GB per year, highest first.
  `--limit` sets how many entries each appliance reports (default 100), so
  the alert covers only those entries. Each rate is printed in the largest
  of B, KB, MB, GB, and TB per year that keeps it at least 1, with three
  significant digits, for example `7.08 GB/year` or `157 KB/year`.

An alert from `storageSizeCheck.bash` looks like this, with your appliance
URL and PV names:

```text
PVs with estimated storage greater than 50 GB/year in http://127.0.0.1:17665/mgmt/bpl
PV: <pv_name> Size: 72.4 GB/year
PV: <pv_name> Size: 51.0 GB/year
```

## Extract samples to CSV files and compute statistics

Two Bash scripts in `docs/book/src/samples` extract the samples of several
PVs over a time range into one CSV file per PV, and compute statistics on
the client from such a file. They read the samples as the appliance stores
them and do not use the server's post-processing operators ([Retrieving
data](retrieval.md#post-processing)). Each script sources
[archiverClient.bash](samples/archiverClient.bash) from its own folder, so
keep them together. Both need Bash 4 or later and `awk`;
`getDataToCsv.bash` also needs `curl`, `jq`, `iconv` and GNU `date`.

### Extract the samples of several PVs

[getDataToCsv.bash](samples/getDataToCsv.bash) takes the data retrieval
base URL, a PV file, a start and an end time, and an output folder. The
base URL is the `data_retrieval_url` of `appliances.xml`, such as
`http://localhost:17668/retrieval`; the script appends
`/data/getData.json` ([Retrieving data](retrieval.md)). The PV file is
UTF-8 CSV and the first column of each row names a PV, as for the scripts
above. The times are ISO 8601 instants with seconds and with `Z` or a
numeric offset, such as `2026-09-24T08:00:00Z` or
`2026-09-24T01:00:00-07:00`; the script sends them to the appliance in
UTC.

The script makes one `getData.json` request per PV, one after the other.
It writes the file of a PV after the response of that PV is checked, so a
PV that fails leaves no file, the other PVs are still requested, and the
failure is reported on stderr with the PV name. A PV that the appliance
does not know answers HTTP 404 and is reported the same way. `--timeout
SEC` limits each request, as for the scripts above.

| Limit or check | Value |
| --- | --- |
| PVs per run | at most 10 |
| Time range | at most 7 days; the end is after the start |
| Names | no duplicate name; no two names with the same file name |
| Output | an existing file is not replaced; the folder is created when missing |

The script checks these before it sends a request. A file is named after
its PV, with every character other than letters, digits, `.`, `_` and `-`
replaced by `_`. Each file has the header line
`time_utc,secs,nanos,value,severity,status` and one row per sample:
`time_utc` is the UTC time with nine fraction digits, `secs` and `nanos`
are the epoch seconds and nanoseconds, and a waveform value is written as
its elements joined by spaces in one field. A PV whose samples have a
structured value, such as an object, fails as a whole: the script reports
it and writes no file for it.

| Exit status | Meaning |
| --- | --- |
| 0 | Every PV written |
| 1 | No PV written |
| 2 | Invalid arguments or input, before any request |
| 3 | Some PVs written and some failed |

The limits bound the requests, not the number of samples. A PV with a high
sample rate over seven days returns many samples, and `jq` holds the
response of one PV in memory, so choose a shorter range for such a PV.
Set `PV_FILE`, `FROM`, `TO` and `OUT_DIR`, then extract the samples:

```bash
samples=docs/book/src/samples
retrieval=${RETRIEVAL_URL:-http://127.0.0.1:17668/retrieval}
"$samples/getDataToCsv.bash" "$retrieval" "$PV_FILE" "$FROM" "$TO" "$OUT_DIR"
```

The script prints one line per written PV with its sample count and file.

### Compute statistics of an extracted file

[csvStats.bash](samples/csvStats.bash) reads a file written by
`getDataToCsv.bash`, or standard input when the file is `-`, and has three
modes. A row whose value is not a number, such as a waveform, a text or an
empty value, is counted, reported on stderr and skipped before any window
or bin is formed. The standard deviation is the sample standard deviation,
which divides by the count minus one and is 0 for one value.

| Mode | Output |
| --- | --- |
| `summary` | One line `n=… skipped=… mean=… sd=… min=… max=…` for all numeric values |
| `moving --window N` | A CSV with `time_utc,mean,sd` for every window of N consecutive numeric samples; the time is that of the last sample of the window |
| `histogram --bins N [--min X] [--max Y]` | A CSV with `bin_from,bin_to,count` for N equal bins, N from 1 to 10000; the bounds default to the minimum and maximum of the data, and values outside given bounds are reported on stderr and not counted |

The script exits 1 when the file has no numeric row or fewer numeric rows
than the window, and 2 for invalid arguments or a file that does not have
the header of `getDataToCsv.bash`. Set `CSV_FILE` to one of the written
files, then compute a summary, a moving window of 10 samples and a
histogram of 20 bins:

```bash
"$samples/csvStats.bash" summary "$CSV_FILE"
"$samples/csvStats.bash" moving --window 10 "$CSV_FILE"
"$samples/csvStats.bash" histogram --bins 20 "$CSV_FILE"
```

## Other sample scripts

The repository folder
[`docs/book/src/samples`](https://github.com/jeonghanlee/epicsarchiverap-maven/tree/modernize/docs/book/src/samples)
also holds Python 3 scripts for recovery and storage configuration, and
`emailHandler.py` for mail. This fork's tests do not run them. Each script
has its own arguments and dependencies; check its help and calls against
the API reference before you rely on it.

Do not use `stopArchivingCurrentlyDisconnectedPVs.py`. It deletes the
stored data of every disconnected PV whose last known event is `Never`,
and it does not check that the pause succeeded. To remove such PVs,
read `lastKnownEvent` in the `getCurrentlyDisconnectedPVs` response and
choose the PVs yourself. Then run `pausePVList.py` and `deletePVList.py`
as separate steps.

## Delete paused PVs

Use [deletePVList.py](samples/deletePVList.py) with
[archiverClient.py](samples/archiverClient.py) and
[listArchivedPVs.py](samples/listArchivedPVs.py) in the same folder.
Python 3 needs no third-party package. Set `BPL_URL`, `DELETE_PV` and
`DELETE_FILE` to an explicit management URL, an archived canonical PV
and a UTF-8 file path. For several PVs, prepare one name per line instead
of the single-PV file command below. Blank lines are ignored, surrounding
whitespace is stripped, case is preserved and `#` is literal.

The default removes archive configuration and configured aliases while
retaining stored data. This differs from the previous sample, which always
requested data deletion. The PV must first be paused:

```bash
printf '%s\n' "$DELETE_PV" > "$DELETE_FILE"
python3 docs/book/src/samples/pausePVList.py "$BPL_URL" "$DELETE_FILE"
python3 docs/book/src/samples/getPVStatus.py "$BPL_URL" "$DELETE_FILE"
python3 docs/book/src/samples/deletePVList.py "$BPL_URL" "$DELETE_FILE"
python3 docs/book/src/samples/getPVStatus.py "$BPL_URL" "$DELETE_FILE"
```

For a separate archived PV selected through the same variables, explicitly
request irreversible stored-data deletion:

```bash
printf '%s\n' "$DELETE_PV" > "$DELETE_FILE"
python3 docs/book/src/samples/pausePVList.py "$BPL_URL" "$DELETE_FILE"
python3 docs/book/src/samples/getPVStatus.py "$BPL_URL" "$DELETE_FILE"
python3 docs/book/src/samples/deletePVList.py "$BPL_URL" "$DELETE_FILE" --delete-data
python3 docs/book/src/samples/getPVStatus.py "$BPL_URL" "$DELETE_FILE"
```

The commands report `Pause accepted`, `Paused`, `Delete accepted` and
`Not being archived`. Mutation commands do not poll or retry. Status can
lag the accepted request; repeat a separate status query if needed.
The input uses the pause/resume name restrictions: one optional protocol
prefix, exact terminal `.VAL` normalization and ordinary field names.
Configured aliases resolve before mutation. Duplicate, alias-equivalent
and same-record inputs fail before any deletion; undiscovered IOC aliases
require canonical input names.

Each item sends one encoded GET with explicit `deleteData=false` or `true`.
`Delete accepted` confirms successful engine and ETL acknowledgements.
With `--delete-data`, ETL checks PV chunk enumeration, removal, and ZIP
persistence before acknowledging completion. Management removes configuration
and aliases only after confirming both responses.
Configuration-only deletion leaves unconfigured PB data;
normal retrieval becomes unavailable, so empty retrieval cannot establish
data erasure. Save store roots and inspect actual retained files before
recovery. The [real verification procedure](https://github.com/jeonghanlee/epicsarchiverap-maven/blob/modernize/TESTING.md#python-deletion-example)
checks both modes with actual PB readers after orderly shutdown.

HTTP errors, validation failures, redirects, timeout and unusable responses
report `Outcome unknown`; details go to stderr and independent later items
continue. Inspect configuration, aliases and all saved stores before a
manual retry or recovery. Reported storage failures retain the PV's paused
configuration and aliases, although some chunks might already be deleted.
A lost response can leave the outcome unknown after successful deletion.
There is no automatic pause, retry, rearchiving, rollback, or data recovery.
Removed samples cannot be restored by retrying.
Deleting an already removed configuration is an error.

Exit 0 means all items were acknowledged, exit 1 means a preflight or item
failed, and exit 2 means invalid input or overlapping identities. Local
validation failures send no HTTP request; failed remote identity checks
send no mutation. `--timeout` defaults to 30 seconds and accepts finite
values greater than zero and at most 86400 seconds.
