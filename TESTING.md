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

## Principles

- The platform carries only the tests this site needs, on the paths it uses. The Channel Archiver migration tests were removed with that feature's disuse.
- Tests are hermetic and deterministic: storage owned by each test, JUnit temporary directories or directories under the build tree, no fixed host paths, readiness by polling (Awaitility) instead of sleeps, and a timeout that turns a hang into a failure. Existing tests that predate these rules are converted as they are touched.
- A test verifies the real shipped path. Internal spans of the path under test are never replaced by stand-ins; only outermost boundaries (an IOC, a browser, the clock) are controlled.
