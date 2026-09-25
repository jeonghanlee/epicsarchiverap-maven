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

The former Selenium browser tests call the same page or BPL endpoint over HTTP, through the appliance's `GetUrlContent` helper or the JDK HTTP client, and poll for readiness with Awaitility, verifying the server response rather than the DOM. Selenium is not a test dependency.

## Principles

- The platform carries only the tests this site needs, on the paths it uses. The Channel Archiver migration tests were removed with that feature's disuse.
- Tests are hermetic and deterministic: storage owned by each test, JUnit temporary directories or directories under the build tree, no fixed host paths, readiness by polling (Awaitility) instead of sleeps, and a timeout that turns a hang into a failure. Existing tests that predate these rules are converted as they are touched.
- A test verifies the real shipped path. Internal spans of the path under test are never replaced by stand-ins; only outermost boundaries (an IOC, a browser, the clock) are controlled.
