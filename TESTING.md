# Testing

How the test platform is wired and how to run each test set. The build entry is the Maven Wrapper; JDK 21 and an exported `JAVA_HOME` are required.

## Layout and wiring

- Test sources live under `src/test` (packages `org/...` and `edu/...`); `pom.xml` sets `testSourceDirectory` accordingly.
- Test data files live beside the test sources and are copied to `target/test-classes` by a `testResources` entry that excludes `**/*.java`.
- The test-site configuration `src/sitespecific/tests/classpathfiles` (`archappl.properties`, `policies.py`, `appliances.xml`) is a second test resource, so configuration loads from the test classpath.
- Surefire sets `ARCHAPPL_SHORT_TERM_FOLDER`, `ARCHAPPL_MEDIUM_TERM_FOLDER`, `ARCHAPPL_LONG_TERM_FOLDER`, and `ARCHAPPL_XLTS_TERM_FOLDER` to subdirectories of `target/test-storage`. `ETLSourceGetStreamsTest` uses a JUnit `@TempDir` for each invocation so earlier runs cannot affect its partition counts; JUnit removes each temporary directory after the invocation.
- `junit-platform.properties` enables automatic registration of `ArchapplPropertiesExtension` and keeps execution sequential. The extension saves `ARCHAPPL_*` JVM properties before class and test setup, then restores them after teardown, including failed setup or teardown. Storage and persistence overrides cannot carry into the next test; pre-existing overrides are preserved.

## Test sets

Tests are selected by JUnit 5 tags. Untagged tests need no external environment.

| Set | Selection | Needs |
| --- | --- | --- |
| unit (default) | untagged; surefire excludes `integration,localEpics,slow,flaky` | nothing beyond JDK 21 |
| integration | `@Tag("integration")` | Tomcat 9 via `TOMCAT_HOME` |
| localEpics | `@Tag("localEpics")` | EPICS base and pvxs on `PATH` |
| slow / flaky | `@Tag("slow")` / `@Tag("flaky")` | as tagged |

```bash
MAVEN_OPTS=-Xmx1g ./mvnw -o test -DargLine=-Xmx2g -DforkCount=1 -DreuseForks=true  # unit set, bounded heaps
./mvnw test                                       # unit set only (default)
./mvnw test -Dtest=PolicyExecutionTest            # a single test class
```

On a large-memory host, run the first form: `MAVEN_OPTS` bounds the Maven process and `-DargLine` bounds each reused Surefire fork, so the JVM ergonomic default (25% of host RAM per JVM) cannot exhaust memory; `-o` runs offline once dependencies are cached (drop `-o` on the first run to populate `~/.m2`). The pom sets no Surefire `argLine`, so `-DargLine` replaces nothing.

The default run executes the unit set only; the default `excludedGroups` (`integration,localEpics,slow,flaky`) keeps every tagged set out, and those exclusions take precedence over an include filter. A tagged set is opted into with the Maven profiles below, which clear the exclusions and select the set.

Most integration tests carry both `integration` and `localEpics`: they need Tomcat and a local IOC. Two Maven profiles select the environment-dependent sets, each requiring the environment its tests use:

```bash
./mvnw test -P integration    # every test needing Tomcat and/or a local EPICS IOC (integration | localEpics)
./mvnw test -P localEpics      # the EPICS-only subset that needs no Tomcat (localEpics & !integration)
```

## EPICS-dependent tests

The site standard for PVA serving is QSRV2 on pvxs. The fixture IOC is `softIocPVX` (pvxs module); `softIocPVA` remains only as a compatibility fallback for unconverted tests.

The execution environment must support real CA/PVA discovery and communication between local servers and clients. Run these checks on the host when a process sandbox does not provide the required networking; HTTP connectivity alone does not verify PVA discovery. Keep the same test and configuration when comparing environments so a connection timeout is not hidden by changing the assertion or wait limit.

- Activate an EPICS environment that provides `softIocPVX`, `pvxget`, and `caget`, for example:

```bash
source /path/to/epics-environment/setEpicsEnv.bash
```

- The fixture must keep the IOC's stdin open (pipe it). A soft IOC started with `-S` and a closed stdin suspends its main thread and PVA never answers.
- Network isolation pins the soft IOC servers and client searches to loopback. `SIOCSetup` sets `EPICS_CAS_INTF_ADDR_LIST=127.0.0.1`, `EPICS_CAS_BEACON_ADDR_LIST=127.0.0.1`, and `EPICS_PVAS_INTF_ADDR_LIST=224.0.1.1,1@127.0.0.1` on the IOC process. PVXS derives the TCP loopback interface from that multicast entry; a separate explicit loopback entry is unnecessary. Surefire sets `EPICS_CA_ADDR_LIST=127.0.0.1` and disables automatic CA/PVA address lists; child Tomcat processes inherit these settings. PVA searches use `EPICS_PVA_ADDR_LIST=127.0.0.1 224.0.1.1,1@127.0.0.1`. The IOC and local Java PVA servers receive direct multicast through loopback, avoiding dependence on which process receives a unicast search. Ports are left at their defaults; isolation from other local servers additionally requires distinct server and discovery ports, which the platform does not yet set.
- The fixture launches `softIocPVX` directly (no external supervisor). `SIOCSetup` does this from Java: it runs `softIocPVX -m P=<prefix> -d <db>` through a `ProcessBuilder` with stdin as a pipe, and stops the IOC by writing `exit` to that stdin. The database is the in-repo `src/resources/test/UnitTestPVs.db`.

## Tomcat integration tests

`TomcatSetup` starts one Tomcat instance per test from `TOMCAT_HOME` and creates per-test work folders under `archappl.tomcat.dir` (default `target/tomcats`). Use a user-owned Tomcat 9 unpacked from the Apache distribution, with a `conf_original` copy of its pristine `conf` beside it; a root-owned install with an unreadable `conf/` cannot serve as `TOMCAT_HOME`.

Fixture lifecycle:

- `DbdArchiveTest` supplies its STS, MTS, and LTS paths from a per-test JUnit `@TempDir`. The exact three-event assertion therefore excludes samples retained by earlier runs; the global property extension restores the storage settings after teardown. Retrieval response streams are closed before fixture cleanup.
- `TomcatSetup.getApplianceFolder` resolves each appliance under the configured base. Fixture preparation, `CATALINA_BASE`, failover data generators, destination storage overrides, and retrieval/ETL verification use that same directory. Setup clears the test's own directory before starting its appliances.
- Run the integration set after `package`. The WARs carry the build's date and commit in their name (see the artifact naming), so they must be freshly built before `TomcatSetup` copies them.
- `TomcatSetup` passes `src/sitespecific/tests/classpathfiles/archappl.properties` through `ARCHAPPL_PROPERTIES_FILENAME`. All webapps use the test-site settings even when the WARs contain the default site's properties. An explicit JVM property with the same name can select a different file for a test.
- `TomcatSetup` waits for the appliance's completed-startup message. A failed connector, early process exit, unreadable startup log, or startup timeout fails setup and stops all processes owned by that fixture. Cleanup waits for process termination and may be called repeatedly.
- `PvaGetPVDataTest`, `PvaGetArchivedPVsTest`, and `PvaGetPVStatusTest` propagate setup failures. Their teardown checks partially initialized resources and attempts all cleanup actions even when one fails. `SIOCSetup.stopSIOC` also accepts a fixture whose process never started.
- `TomcatSetupTest` occupies the real HTTP port to verify failed-startup cleanup and a subsequent healthy start. `PvaGetPVDataFixtureTest` directs PVA discovery to a nonresponding UDP endpoint and invokes the actual retrieval test setup and teardown to verify partial-failure cleanup.
- PVA restart tests poll the real retrieval endpoint. `PVAEpicsIntegrationTest` requires samples timestamped after the IOC restarts; `PVAFlakyIntegrationTest` compares the complete expected timestamp/value map before disconnecting and after reconnecting. Each retrieval wait is bounded at two minutes and each response stream is closed.
- The test Tomcats carry `CATALINA_OPTS=-Deaatag=eaatesttm`. If an interrupted runner leaves processes behind, identify them by their PID, parent, and per-test `CATALINA_BASE` before stopping only the processes owned by that run.

The browser tests that the fork kept call the same page or BPL endpoint over HTTP, through the appliance's `GetUrlContent` helper or the JDK HTTP client, and poll for readiness with Awaitility, verifying the server response rather than the DOM. Selenium is not a test dependency.

## Python listing example

The listing checks invoke the shipped `docs/book/src/samples/listArchivedPVs.py`
as a subprocess. Python 3's standard library is sufficient; Maven does not
run these Python checks.

For argument validation, HTTP errors, timeout, malformed/truncated responses,
and result formatting, run the client boundary tests. They control only a
local HTTP server, with no internal-function mocks:

```bash
python3 -m venv --without-pip work/list-pvs-venv
work/list-pvs-venv/bin/python -m unittest discover -s src/test/pythontests -p test_list_archived_pvs.py -v
```

For real BPL acceptance, first build the four WARs with `./mvnw -B -ntp package`.
Export `JAVA_HOME` and `TOMCAT_HOME` and activate the EPICS environment as
described above; `softIocPVX` must be on `PATH`. Stop any earlier example
appliance or Maven integration fixture before this run. Use a new evidence
folder each time:

```bash
work/list-pvs-venv/bin/python src/test/pythontests/verify_list_archived_pvs.py work/list-pvs-check
```

The runner starts the real local launcher on ports 17665 through 17668 and
17670 with a separate CA server/search port 17675, loads the unchanged
`src/resources/test/UnitTestPVs.db`, and requests
archiving for 600 of its PVs. It waits up to 360 seconds for all 600 to report
Being archived, then verifies complete listing, globs, empty matches,
explicit limits and an actual HTTP 404. It also executes the listing page's
shell commands verbatim and checks their output. No proxy or substitute BPL is used.
The runner records the real commands, stdout/stderr, status responses,
fixture/script/WAR digests and process cleanup in the retained folder.

`--tomcat-home`, `--ioc`, `--war-dir`, `--port-base` and `--ca-port` allow
explicit paths and ports. The runner stops only its own launcher and IOC in cleanup and
requires the launcher's normal exit 143 with no owned JVM remaining.
If the launcher exits early, the runner checks the recorded boot ID, PID and
start time before stopping its surviving JVMs. It shares the shutdown deadline,
records any fallback or forced stop, and still fails verification for that run.
Client boundary checks do not count as appliance acceptance.

With the same Tomcat/EPICS environment and built WARs, verify this failure
path by killing the real launcher during startup. The test uses appliance
ports 24665 through 24668 and 24670, and CA port 24675. It requires runner
failure and no surviving owned JVM, and retains its evidence under `work/`:

```bash
work/list-pvs-venv/bin/python -m unittest discover -s src/test/pythontests -p test_listing_runner_cleanup.py -v
```

## Python archive and status examples

The shipped `archivePVList.py` and `getPVStatus.py` share `archiverClient.py`
and the URL/timeout validators in `listArchivedPVs.py`. Run their subprocess
tests against a controlled outer HTTP boundary:

```bash
work/list-pvs-venv/bin/python -m unittest discover -s src/test/pythontests -p test_archive_status_clients.py -v
```

With the same built WARs, JDK 21, Tomcat and EPICS environment as the listing
procedure, run the real workflow in a new retained folder:

```bash
work/list-pvs-venv/bin/python src/test/pythontests/verify_archive_status.py work/archive-status-check
```

The runner uses appliance ports 18665 through 18668 and 18670 and CA port
18675; `--port-base`, `--ca-port`, `--tomcat-home`, `--ioc` and `--war-dir`
provide overrides. It starts with the IOC stopped, invokes the actual CLI
files to observe unknown and Initial sampling states, then loads unchanged
`UnitTestPVs.db` and waits up to 360 seconds for the requested fixture PVs
to reach Being archived. It checks MONITOR/SCAN and effective sampling
periods, repeated submissions, a configured alias, rejected overlaps, and
real mixed archive batches with a server-invalid name in each position.
An unusable error response must report an unknown outcome; independent
good requests still reach Being archived. The runner also executes the
documentation command block verbatim.

Evidence includes CLI inputs, exact commands and outputs, independent BPL
observations, source/fixture/WAR digests, and cleanup results. It imports the
listing runner's real bounded JVM cleanup helper. A forced stop or surviving
owned process fails the run. Boundary tests do not count as appliance
acceptance, and Maven does not run these Python tests.

## Python pause and resume examples

The engine persistence regression runs in the default Maven suite and can
also run alone:

```bash
./mvnw -B -ntp -Dtest=PausePersistenceTest,PBAppendCrashRecoveryTest test
```

It uses the actual engine, sample buffers, PlainPB serializer and file
reader. A directory at the output path tests append failure; Linux
`/dev/full` tests a buffered output-close failure. The latter case requires
Linux and is skipped when that device is absent. Four partial-write cases use
Linux `/usr/bin/prlimit` and `/bin/bash` in a separate JVM, keeping the
test runner's file-size limit unchanged. They interrupt the header, first
sample, next sample, and an append to an existing file. The failed append
must restore the preceding file bytes; a retry must preserve every sample
tuple. These four cases are skipped when either executable is absent.
The concurrency case
controls only the real file output's close boundary. The engine BPL case
controls only the HTTP request and response; its engine and storage paths
run unchanged. A queued year-change task is exercised through the actual
engine scheduler. These checks require no IOC or Tomcat.

The pause/resume commands use the archive client's shared transport and
identity checks. Run the real CLI subprocess tests with a controlled outer
HTTP boundary, plus both existing suites:

```bash
work/list-pvs-venv/bin/python -m unittest discover -s src/test/pythontests -p test_pause_resume_clients.py -v
work/list-pvs-venv/bin/python -m unittest discover -s src/test/pythontests -p test_archive_status_clients.py -v
work/list-pvs-venv/bin/python -m unittest discover -s src/test/pythontests -p test_list_archived_pvs.py -v
```

With JDK 21, compile the test adapter and resolve its dependency classpath
before starting any appliance. This does not rebuild the four WARs; build
those first using the normal build procedure when production code changes.

```bash
./mvnw -B -ntp -DskipTests test-compile
./mvnw -B -ntp dependency:build-classpath -Dmdep.outputFile=work/pause-resume-classpath.txt
```

Use the listing procedure's `TOMCAT_HOME` and `softIocPVX` environment, and
put the matching EPICS Base `camonitor` on PATH. The standard-library-only
runner invokes the real Java `PVSampleDump` adapter, which calls
`PBFileInfo` and `FileBackedPBEventStream`. No PB parser is reproduced in
Python. It also compares the client's supported canonical names against
the server's actual `PVNames.normalizeChannelName` function.

```bash
work/list-pvs-venv/bin/python src/test/pythontests/verify_pause_resume.py work/pause-resume-check
work/list-pvs-venv/bin/python src/test/pythontests/verify_archive_status.py work/archive-status-regression
```

Use fresh evidence folders. The pause/resume runner defaults to HTTP ports
19665 through 19668 and 19670, and CA port 19675. Overrides are
`--port-base`, `--ca-port`, `--tomcat-home`, `--ioc`, `--monitor`,
`--war-dir` and `--classpath-file`. Run the two real workflows sequentially.

The runner loads unchanged `UnitTestPVs.db` under a unique prefix. It saves
at least three baseline samples, pauses through the shipped CLI, waits for
`Paused` and verifies the baseline in actual PB files. It then observes
`2*B+5` seconds using the launched engine's buffer property. The real CA
monitor and a continuously archived control PV must keep producing data
during this interval. Before sending resume, the runner requires the target's
PB and retrieval tuple sets to equal the snapshot captured after pause.
After resume, at least three samples timestamped after the command completed
must match retrieval and actual PB tuples, including nanoseconds, value,
status and severity. The baseline must remain unchanged.

The runner sends resume just after observing an IOC update, so its first
resumed current value must retain an IOC timestamp preceding the request.
Exactly one new sample with that earlier timestamp must be present. It
must match the last real IOC monitor update before the request
within 500 nanoseconds of its rounded microsecond timestamp, carry startup and reconnection
fields consistent with receipt after resume, and persist in actual PB.
Numeric samples with connection or startup fields remain samples; only
headers without sample payloads are excluded. Boundary records are retained.

Initial archiving has a 360-second deadline. State transitions, retrieval,
baseline persistence and resumed persistence each have a 120-second
deadline; PB polling uses one second. Expiry fails the run. Alias and `.VAL`
requests, overlap and repeated-operation rejections, and mixed batches with
an unknown PV at every position run against the actual appliance. The
scripting page's pause/status/resume/status block executes verbatim.

Evidence includes exact commands and outputs, retrieval responses, decoded
PB records, monitor output, configured store roots, source/fixture/WAR and
adapter/classpath digests, deadlines and cleanup results. Every exit path
stops the owned monitor, launcher and IOC. Normal launcher exit is 143 and
IOC exit is 0; forced cleanup or surviving owned processes fails the run.
These Python checks are separate from Maven's default suite. Component
failure injection at the HTTP boundary verifies client reporting only.

## Python rename example

Run the shipped rename CLI boundary suite together with listing,
archive/status and pause/resume:

```bash
work/list-pvs-venv/bin/python -m unittest discover -s src/test/pythontests -p test_rename_client.py -v
work/list-pvs-venv/bin/python -m unittest discover -s src/test/pythontests -p test_list_archived_pvs.py -v
work/list-pvs-venv/bin/python -m unittest discover -s src/test/pythontests -p test_archive_status_clients.py -v
work/list-pvs-venv/bin/python -m unittest discover -s src/test/pythontests -p test_pause_resume_clients.py -v
```

These are actual CLI subprocesses. Only their outer HTTP boundary is
controlled. Rename uses GET with encoded `pv` and `newname`; 301, 302,
303, 307 and 308 mutation responses must produce one request, no request
at the Location target, an uncertain outcome and continued handling of
later independent records. Archive, pause and resume have the same redirect
checks. Request logs from both boundary servers and CLI commands/outputs
are retained under `work/rename-client-evidence/`. No client result
establishes appliance data-copy completion.

The live runner requires JDK 21, the existing Tomcat 9 distribution and
`softIocPVX` environment from the listing procedure, and Linux `strace` on
PATH. The user must be able to attach strace to the owned management JVM;
an attachment failure fails setup. The runner records actual HTTP syscalls
without forwarding or replacing requests. Its filesystem failures affect
only a selected destination path. Run the Java fixture and all appliance
runners sequentially and use fresh evidence folders.

Prepare the adapter, dependency classpath and one isolated four-WAR bundle
before starting any fixture. The preparation mode runs the normal package
build with tests skipped, records source/resource and WAR digests and the
successful build logs, and copies only that build's four WARs. It obtains
the basename from the actual build output.

```bash
RENAME_RUNNER=src/test/pythontests/verify_rename.py
WAR_DIR="$PWD/work/rename-bundle"
python3 "$RENAME_RUNNER" "$WAR_DIR" --prepare-bundle
BUNDLE_MANIFEST="$WAR_DIR/manifest.json"
WAR_BASENAME=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["war_basename"])' "$BUNDLE_MANIFEST")
export MAVEN_ARGS="-Darchappl.war.dir=$WAR_DIR -Darchappl.final.name=$WAR_BASENAME"
./mvnw -B -ntp test -P integration -Dtest=org.epics.archiverappliance.mgmt.RenamePVTest
unset MAVEN_ARGS
RENAME_OPTIONS=(--war-dir "$WAR_DIR" --war-basename "$WAR_BASENAME")
RENAME_OPTIONS+=(--bundle-manifest "$BUNDLE_MANIFEST")
python3 "$RENAME_RUNNER" work/rename-check "${RENAME_OPTIONS[@]}"
```

The Java test calls actual BPL endpoints through TomcatSetup/SIOCSetup and
compares exact timestamp/value/status/severity multisets over a fixed
interval, copied sampling/storage settings and both retained Paused names.
The explicit WAR directory and basename must select the same bundle used
by Python; do not infer them from a later date or HEAD. The runner verifies
build evidence, production-source/resource digests and deployed-copy digests.

The live run loads unchanged `UnitTestPVs.db` under its own prefix. It
archives sources and a healthy control through the shipped CLI, establishes
at least three real numeric samples, pauses sources, fixes the baseline
interval and confirms PB persistence. It verifies successful copies, aliases,
`.VAL`, rejected chains and repeated identities, and actual occupied,
unpaused and unknown-source failures in every batch position. Successes
before and after each failure must preserve exact source/destination
multisets. Sampling settings, protocol flags, archived fields, store URLs
and creation time are copied; both names remain Paused.

The archive requests specify a 0.1-second MONITOR period. One source is
processed repeatedly through the actual IOC console before pause; its
persisted PB data must exceed 16 KiB to exercise multiple destination writes.
A successful copy first records the actual destination write sequence.
The filesystem cases verify a destination write denied after metadata
registration and a fault on the second destination write, with real samples
observed during its five-second entry delay. No storage plugin, action, HTTP response or PB
reader is replaced. Faults are restored before later checks. An unexercised
fault or unproven partial-copy onset fails the run.

Each PB file is decoded independently with the actual PVSampleDump adapter.
Source and control files must decode and preserve exact baseline multisets.
Destination observations retain path, existence, size, digest, reader exit,
stdout and stderr, including absent, zero-byte and undecodable files. A
nonempty undecodable file is never treated as an empty sample set. Such
destination failures are allowed only with proof of the intended filesystem
fault and passing source/control and later-pair checks. Files are read again
after orderly shutdown, and the scripting page's exact rename command block
is executed against the same appliance.

Initial archive readiness has a 360-second deadline; other state, retrieval
and PB checks have 120-second deadlines. Expiry retains the last observation
and fails. Defaults are HTTP ports 20665 through 20668 and 20670, and CA
port 20675, with explicit port overrides available. Cleanup requires launcher
exit 143, IOC exit 0 and no surviving owned JVMs. Tracer shutdown is bounded;
its failure cannot bypass appliance or IOC teardown. Forced tracer
termination fails the run. Then rerun the existing
live archive/status and pause/resume runners against the same selected WAR
directory, since their shared mutation transport changed. Build the book
and compare all affected copied scripts and links before accepting the scope.

## Python disconnection example

The report checks execute the shipped management action, CLI, and real
appliance/IOC lifecycle. The live runner requires Linux. Prepare the JDK 21,
Tomcat 9, and `softIocPVX` environment above. Set `TOMCAT_HOME` to the user-owned Tomcat distribution
and place `softIocPVX` on `PATH`. Stop earlier owned fixtures and require
free ports before each run; the runner never stops unrelated processes.

The default Java suite includes `CurrentlyDisconnectedPVsResponseTest`.
It uses real `ConfigServiceForTests` and controls only engine HTTP and
servlet boundaries. Each case checks the final response bytes, status,
media type, and UTF-8 encoding. It retains exact request counts, timeout
durations, and responses in `work/disconnected-action-evidence/`.
Locale checks call shipped `TimeUtils` under US, France, and Japan locales,
restore the original locale, and capture rows with source/class hashes in
`work/disconnected-locale.json`. These checks do not establish deployed
engine locale behavior.

Build fresh WARs and generate that locale evidence before Python tests:

```bash
./mvnw -B -ntp clean verify
python3 -m unittest discover -s src/test/pythontests -p 'test_*client*.py'
python3 -m unittest discover -s src/test/pythontests -p test_list_archived_pvs.py
```

The Python report suite uses actual subprocesses and only outer management
HTTP responses. It checks grouping, literal filters, full schema validation,
no partial output, controls, captured locale text, ASCII output failure,
HTTP errors, connection loss, closed stdout, argument rejection before HTTP, and timeout.
`--timeout 1` against a ten-second delay must fail within five seconds.

Select and record one complete successful four-WAR build before starting
Java or Python fixtures. Bundle preparation reuses the rename runner's
build/log/source/fixture hashing; it does not replace the clean verification:

```bash
DISCONNECT_RUNNER=src/test/pythontests/verify_disconnected.py
WAR_DIR="$PWD/work/disconnected-bundle"
CLASSPATH_FILE="$PWD/work/disconnected-classpath.txt"
python3 src/test/pythontests/verify_rename.py "$WAR_DIR" --prepare-bundle --classpath-file "$CLASSPATH_FILE"
BUNDLE_MANIFEST="$WAR_DIR/manifest.json"
WAR_BASENAME=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["war_basename"])' "$BUNDLE_MANIFEST")
export MAVEN_ARGS="-Darchappl.war.dir=$WAR_DIR -Darchappl.final.name=$WAR_BASENAME"
DISCONNECT_TESTS=org.epics.archiverappliance.mgmt.CurrentlyDisconnectedPVsTest
DISCONNECT_TESTS+=,org.epics.archiverappliance.mgmt.MetricsTest
export EPICS_CA_SERVER_PORT=29875 EPICS_CAS_SERVER_PORT=29875
./mvnw -B -ntp test -P integration -Dtest="$DISCONNECT_TESTS"
unset MAVEN_ARGS EPICS_CA_SERVER_PORT EPICS_CAS_SERVER_PORT
DISCONNECT_OPTIONS=(--war-dir "$WAR_DIR" --war-basename "$WAR_BASENAME")
DISCONNECT_OPTIONS+=(--bundle-manifest "$BUNDLE_MANIFEST" --tomcat-home "$TOMCAT_HOME")
DISCONNECT_OPTIONS+=(--ioc "$(command -v softIocPVX)")
python3 "$DISCONNECT_RUNNER" work/disconnected-ioc --mode ioc "${DISCONNECT_OPTIONS[@]}"
```

Java uses actual `TomcatSetup`, `SIOCSetup`, and unchanged `UnitTestPVs.db`.
`CurrentlyDisconnectedPVsTest` covers connected absence, IOC-loss inclusion,
paused exclusion, and recovery; unchanged `MetricsTest` runs as a regression.
Require fixture teardown before Python starts.

Python starts the existing four-process SQLite launcher and actual IOC with
the unchanged database, a unique prefix, and recorded commands and identities.
Default ports are 27665-27668 and 27670, with CA port 27675; explicit
`--port-base` and `--ca-port` select another free set. It archives active
and paused-control PVs through shipped CLIs and waits for actual engine
connection metrics and at least three numeric samples. After an IOC stdin
exit, only active targets must appear with positive loss epochs. A fresh
owned IOC process must reconnect and produce at least three new samples.
Report queries preserve type information, inventory, and fixed-interval
retrieval records. The runner executes the scripting page's command block
verbatim against actual disconnected rows.

Startup, initial archive, and connection/report/retrieval deadlines are
180, 360, and 120 seconds. IOC exit is bounded at 30 seconds. Ordinary
launcher cleanup requires exit 143 within 300 plus seven seconds, IOC exit
0, and every recorded child gone. Retain all evidence folders.

For component-failure verification, run separate `--mode raw-fault` and
`--mode cli-fault` cases, each followed by a fresh `--mode healthy` run.
Use a new folder and free ports for every case. Select recorded original
and corrected bundles explicitly; baseline replay uses `--baseline-manifest`
with the original raw run's `manifest.json` to verify unchanged old WAR
provenance after production sources change. The same HTTP-503 and CLI-exit-1
assertions must fail on the original server and pass on the correction.

The fault runner records boot ID, PID, and start ticks; suspends only its
launcher with SIGSTOP; confirms stopped state within five seconds; and
gracefully stops only its engine within 30 seconds. It independently checks
the refused engine port and live management process before the report.
Direct HTTP uses 15 seconds; the CLI uses timeout 15 and a 20-second process
limit. One shared 60-second suspension budget reserves five seconds for
SIGCONT and acknowledgement. Every failure enters restoration and bounded
cleanup. The intended fault must end with launcher exit 1, the engine-exit
diagnostic, `status=stopped`, and all children reaped. Another exit 1,
forced shutdown, incomplete cleanup, or unverified restoration fails.

Build the book with the pinned tools from `docs/book/Dockerfile`, then
compare linked sample copies with their sources. HTTP-boundary tests and
formatter captures are separate from actual appliance acceptance.

## Exact retrieval bounds

These checks cover the public retrieval request, internal PB/HTTP request,
engine streaming and final merge output. Use JDK 21, exported `JAVA_HOME`
and `TOMCAT_HOME`, and the real `softIocPVX` on PATH. The Java fixture and
Python runner use unchanged `src/resources/test/UnitTestPVs.db` and shipped
PB readers. Run from the repository root. Execute fixtures sequentially on
Linux with free selected ports and networking that supports local CA
communication.

Verify the default suite, retain its Surefire reports, then prepare one
complete bundle. Preparation builds with tests skipped and records source,
fixture, build-log and four-WAR digests; it does not replace verification.
Use a new bundle and evidence directory for each source revision.

```bash
./mvnw -B -ntp clean verify
BOUNDS_RUNNER=src/test/pythontests/verify_retrieval_bounds.py
WAR_DIR="$PWD/work/retrieval-bounds-corrected-bundle"
CLASSPATH_FILE="$PWD/work/retrieval-bounds-corrected-classpath.txt"
python3 src/test/pythontests/verify_rename.py "$WAR_DIR" --prepare-bundle --classpath-file "$CLASSPATH_FILE"
MANIFEST="$WAR_DIR/manifest.json"
WAR_BASENAME=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["war_basename"])' "$MANIFEST")
export MAVEN_ARGS="-Darchappl.war.dir=$WAR_DIR -Darchappl.final.name=$WAR_BASENAME"
BOUNDS_TESTS=org.epics.archiverappliance.retrieval.LiveRetrievalBoundsTest
BOUNDS_TESTS+=,org.epics.archiverappliance.retrieval.DataRetrievalServletTest
BOUNDS_TESTS+=,org.epics.archiverappliance.retrieval.client.SinglePVRetrievalTest
export EPICS_CA_SERVER_PORT=29875 EPICS_CAS_SERVER_PORT=29875
./mvnw -B -ntp test -P integration -Dtest="$BOUNDS_TESTS"
unset MAVEN_ARGS EPICS_CA_SERVER_PORT EPICS_CAS_SERVER_PORT
BOUNDS_OPTIONS=(--war-dir "$WAR_DIR" --war-basename "$WAR_BASENAME")
BOUNDS_OPTIONS+=(--bundle-manifest "$MANIFEST" --classpath-file "$CLASSPATH_FILE")
BOUNDS_OPTIONS+=(--tomcat-home "$TOMCAT_HOME" --ioc "$(command -v softIocPVX)")
BOUNDS_OPTIONS+=(--port-base 30665 --ca-port 30675)
python3 "$BOUNDS_RUNNER" work/retrieval-bounds-corrected-ioc-2 "${BOUNDS_OPTIONS[@]}"
```

Inspect fresh reports for all three selected classes: each must have a
nonzero count and zero failures, errors and skipped cases. Retain these
reports separately from the default suite, which includes `TimeUtilsTest`.
Compare deployed WAR copies with the bundle manifest and require Java
fixture teardown before starting Python.

`LiveRetrievalBoundsTest` acquires real IOC events through the engine,
retains native PB bytes and uses those bytes for engine streaming and merge
checks. It covers minus-one-nanosecond exclusion, exact inclusion, second
rollover, preceding values and single-event output on close and PV switch.
Both `PBOverHTTPStoragePlugin` request methods execute against a controlled
outer HTTP server returning the captured PB response. Internal functions
are unchanged in these checks.

Python starts the existing four-JVM SQLite launcher and original IOC under
a unique prefix. It records each target as integer seconds/nanoseconds,
value, status and severity. The same immutable live target must be in the
engine buffer before and after the public minus-one-nanosecond/equality
pair. Production logs must show the actual internal engine URL and engine
handler completion for each request; exact internal bounds must match the
public bounds. Stored-only controls require engine exclusion and actual PB
records; mixed controls require both stored records and engine participation.

The runner checks second rollover and the supported preceding value at
`from`. It retains storage and keeps the IOC alive while stopping and
restarting all four appliance components with the same WARs. The restart
pair must use a new target acquired after appliance startup and preserve
the original stored sample. It never substitutes an aged target or a
stored-only request for live verification.

Startup, initial archiving and each observation have deadlines of 180, 360
and 120 seconds. HTTP requests use 15 seconds and native reader processes
20 seconds, limited by the remaining observation deadline. Normal launcher
cleanup requires exit 143 within 300 plus seven seconds and no surviving
owned children; IOC exit must return 0 within 30 seconds. Forced cleanup,
malformed data, missing engine evidence or timeout fails the run.

HTTP evidence records the URL before transport starts and retains received
response bytes, status and errors on HTTP failure, truncation or timeout.
Partial responses remain marked incomplete; they never count as a successful
observation.

Evidence includes requests and response bytes, native decoded records,
source/WAR/fixture/runner digests, logs, process identities, results and
cleanup records. A run returns 0 only when every assertion passes. Python
is separate from Maven's default suite. Preserve a defective bundle before
production edits and run unchanged assertions on both revisions. Replaying
that bundle after edits requires `--baseline-manifest` pointing to the
original executed run's `manifest.json`; setup failures do not establish
the retrieval defect.

## Principles

- The platform carries only the tests this site needs, on the paths it uses. The Channel Archiver migration tests were removed with that feature's disuse.
- Tests are hermetic and deterministic: storage owned by each test, JUnit temporary directories or directories under the build tree, no fixed host paths, readiness by polling (Awaitility) instead of sleeps, and a timeout that turns a hang into a failure. Existing tests that predate these rules are converted as they are touched.
- A test verifies the real shipped path. Internal spans of the path under test are never replaced by stand-ins; only outermost boundaries (an IOC, a browser, the clock) are controlled.

## Python deletion example

Run the shipped client suites with only the outer HTTP boundary controlled:

```bash
python3 -m unittest discover -s src/test/pythontests -p 'test_*client*.py'
python3 -m unittest discover -s src/test/pythontests -p 'test_list_archived_pvs.py'
```

`test_delete_client.py` checks both explicit data parameters, canonical names,
alias/record overlap, UTF-8 input, ASCII output, timeout, actual subprocess
exit codes, malformed and contradictory responses, every failure position,
one mutation per item and 301/302/303/307/308 redirect refusal. These client
checks do not establish stored-data effects.

The live runner uses the listing procedure's JDK 21, Tomcat 9 and
`softIocPVX` environment, unchanged `UnitTestPVs.db` and Linux `strace`.
The user must be able to attach strace to the owned ETL JVM. Failure to
attach or observe the intended filesystem fault fails the run. HTTP syscall
traces observe the shipped CLIs directly without forwarding their requests.

Prepare the PB-reader adapter, classpath and one isolated complete four-WAR
bundle before any fixture starts. The deletion runner reuses the actual
bundle preparation and HTTP/PB observation functions from the rename runner.
It validates production/resource/configuration, IOC fixture, successful
build-log, WAR and deployed-copy digests and records CLI/runner/reader
sources, dependency classpath and adapter digests.

```bash
DELETE_RUNNER=src/test/pythontests/verify_delete.py
WAR_DIR="$PWD/work/delete-bundle"
python3 "$DELETE_RUNNER" "$WAR_DIR" --prepare-bundle
BUNDLE_MANIFEST="$WAR_DIR/manifest.json"
WAR_BASENAME=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["war_basename"])' "$BUNDLE_MANIFEST")
export MAVEN_ARGS="-Darchappl.war.dir=$WAR_DIR -Darchappl.final.name=$WAR_BASENAME"
DELETE_TESTS=org.epics.archiverappliance.mgmt.pauseresume.DeletePVTest
DELETE_TESTS+=,org.epics.archiverappliance.mgmt.pauseresume.DeletePVAfterRestartTest
DELETE_TESTS+=,org.epics.archiverappliance.mgmt.pauseresume.DeleteMultiplePVTest
export EPICS_CA_SERVER_PORT=21875 EPICS_CAS_SERVER_PORT=21875
./mvnw -B -ntp test -P integration -Dtest="$DELETE_TESTS"
unset MAVEN_ARGS EPICS_CA_SERVER_PORT EPICS_CAS_SERVER_PORT
DELETE_OPTIONS=(--war-dir "$WAR_DIR" --war-basename "$WAR_BASENAME")
DELETE_OPTIONS+=(--bundle-manifest "$BUNDLE_MANIFEST")
python3 "$DELETE_RUNNER" work/delete-check "${DELETE_OPTIONS[@]}"
```

Java fixtures and the Python appliance run sequentially after teardown and
with free ports; the Java command uses CA port 21875 and the Python
runner uses its separate default CA port 21675. The strengthened `DeletePVTest` uses the real IOC, retrieval
and PB readers for both modes, sends each deletion once and polls read-only
state. Original restart/bulk tests remain regressions; they do not establish
PB retention/erasure or the no-retry contract.

The Python runner archives separate targets under a dedicated prefix and
saves at least three real numeric samples, fixed intervals, exact
timestamp/value/status/severity multisets, configuration/aliases and store
URLs/roots. Before deletion, it restarts the retained appliance so the
server initializes persisted chunk keys. Existing control settings and
baseline data must remain exact; the control's initialized key must match
its actual PB path. Later comparisons require the complete saved settings.
STS/MTS/LTS cases require actual target records in the selected
store before mutation. Later stores are prepared through real
`consolidateDataForPV` with a recorded future processing date; no PB files
are synthesized or copied to construct a fixture.

Default requests explicitly send `deleteData=false`. After configuration and
alias removal, orderly shutdown must leave exact baseline records across all
saved roots. Explicit `--delete-data` requests must remove all target PB
headers and stream paths. Control metadata and fixed-interval data remain
unchanged. All PB files decode independently with the shipped reader; an
unexplained or undecodable leftover fails. File movement during consolidation
is allowed without losing baseline records or duplicate counts.

The retained SQLite database and stores are reused across restarts, with
readiness, deleted metadata absence and preserved control checks. Fresh
independent targets cover aliases, exact `.VAL`, overlapping identities and
unpaused/unknown/repeated-delete errors first, middle and last in both modes.
Accepted items must satisfy their actual data mode. The scripting page's
two command blocks execute verbatim.

The filesystem case attaches a path-filtered tracer to the owned ETL
process and injects an `EACCES` error into actual `unlink`/`unlinkat` calls
for one saved target PB file. Its trace must prove the attempted failed
delete; the file and actual target records must survive. Failed items must
report `Outcome unknown` with batch exit 1 and never `Delete accepted`.
Later independent items must be accepted and have correct configuration
and PB-data effects, with exactly one request per item and no retry.
The failed target must retain its paused configuration, inventory entry,
and actual configured aliases before normal stop and after restart.

The ZIP case uses real `ZIP_PER_PV` LTS data prepared through
`consolidateDataForPV`. Normal deletion must persist target removal in the
reopened physical archive. A second target receives an actual `EACCES`
during archive replacement at ZIP finalization; the trace must identify
the failed physical archive operation. The target's exact ZIP records and
paused configuration/aliases must survive normal stop and restart.
Later healthy deletion and control settings/data are checked independently.

The default suite includes `PlainPBExplicitDeletionTest` over shipped PB
writers/readers, strict deletion, real ZIP filesystems, and actual
MergeDedup delegation. Its ZIP path cases preserve literal `#`, `%23` and
`+` in PV names and spaces, `#`, `%` and `+` in the storage root. They reopen
physical archives after deletion and read the retained control's PB samples.
`DeletePVAcknowledgementTest` executes the shipped
management handler and configuration with only outer HTTP/servlet boundaries
controlled. It checks unconfirmed component responses and later independent
GET/POST items; it does not replace the complete four-WAR regressions.
Run these tests and the ordinary ETL regressions under the default profile.
Run the three Java deletion classes under the integration profile with the
same explicit fresh bundle. Preserve each invocation's fresh XML and log;
every required class must execute non-skipped tests with zero failures/errors.

A hidden successful acknowledgement fails the run. Retain HTTP/filesystem
traces, CLI stdout/stderr, component logs, metadata, file sizes/digests and
actual PB records, including partial deletion. Preserve matching-source
defective and corrected runs separately, with the same fault and
CLI/state/data assertions. Fresh WARs must pass the default suite, selected
Java integration classes, and complete real CLI regression before deletion
is accepted.

Archive readiness has a 360-second deadline; state, consolidation, retrieval
and PB observations have 120 seconds with one-second polls and no extension.
Defaults use HTTP ports 21665-21668/21670 and CA port 21675. Cleanup restores
the tracer, stops the launcher normally (exit 143) and stops the IOC (exit 0)
independently on every exit path. Forced stop, incomplete cleanup or a
surviving owned JVM/IOC/tracer fails. Store acceptance scans occur only after
normal shutdown; retain every run folder on success or failure.
