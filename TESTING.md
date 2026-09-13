# Testing

How the test platform is wired and how to run each test set. The build entry is the Maven Wrapper; JDK 21 and an exported `JAVA_HOME` are required.

## Layout and wiring

- Test sources live under `src/test` (packages `org/...` and `edu/...`); `pom.xml` sets `testSourceDirectory` accordingly.
- Test data files live beside the test sources and are copied to `target/test-classes` by a `testResources` entry that excludes `**/*.java`.
- The test-site configuration `src/sitespecific/tests/classpathfiles` (`archappl.properties`, `policies.py`, `appliances.xml`) is a second test resource, so configuration loads from the test classpath.
- Surefire sets `ARCHAPPL_SHORT_TERM_FOLDER`, `ARCHAPPL_MEDIUM_TERM_FOLDER`, `ARCHAPPL_LONG_TERM_FOLDER`, and `ARCHAPPL_XLTS_TERM_FOLDER` to subdirectories of `target/test-storage`, so tests never write outside the build directory.

## Test sets

Tests are selected by JUnit 5 tags. Untagged tests need no external environment.

| Set | Selection | Needs |
| --- | --- | --- |
| unit (default) | untagged; surefire excludes `integration,localEpics,slow,flaky` | nothing beyond JDK 21 |
| integration | `@Tag("integration")` | Tomcat 9 via `TOMCAT_HOME` |
| localEpics | `@Tag("localEpics")` | EPICS base and pvxs on `PATH` |
| slow / flaky | `@Tag("slow")` / `@Tag("flaky")` | as tagged |

```bash
./mvnw test                                       # unit set only (default)
./mvnw test -Dgroups='integration & !localEpics'  # by tag: Tomcat-only tests, excludes IOC-needing ones
./mvnw test -Dtest=PolicyExecutionTest            # a single test class
```

The default run executes the unit set only. Any tagged set is opted into with `-Dgroups`; the `-Dgroups` above selects one tag combination directly, whereas the profiles below name the common environment-based sets.

Most integration tests carry both `integration` and `localEpics`: they need Tomcat and a local IOC. Two Maven profiles select the environment-dependent sets, each requiring the environment its tests use:

```bash
./mvnw test -P integration    # every test needing Tomcat and/or a local EPICS IOC (integration | localEpics)
./mvnw test -P localEpics      # the EPICS-only subset that needs no Tomcat (localEpics & !integration)
```

## EPICS-dependent tests

The site standard for PVA serving is QSRV2 on pvxs. The fixture IOC is `softIocPVX` (pvxs module); `softIocPVA` remains only as a compatibility fallback for unconverted tests.

- Activate an EPICS environment that provides `softIocPVX`, `pvxget`, and `caget`, for example:

```bash
source /path/to/epics-environment/setEpicsEnv.bash
```

- The fixture must keep the IOC's stdin open (pipe it). A soft IOC started with `-S` and a closed stdin suspends its main thread and PVA never answers.
- Network isolation pins both ends to the loopback interface. The soft IOC's servers bind loopback via `EPICS_CAS_INTF_ADDR_LIST=127.0.0.1`, `EPICS_CAS_BEACON_ADDR_LIST=127.0.0.1`, and `EPICS_PVAS_INTF_ADDR_LIST=127.0.0.1`, set by `SIOCSetup` on the IOC process. The clients search only loopback via `EPICS_CA_ADDR_LIST=127.0.0.1`, `EPICS_CA_AUTO_ADDR_LIST=NO`, and the `EPICS_PVA_*` equivalents, set for the Surefire JVM in `pom.xml` and inherited by the child Tomcat. This keeps a test from reaching, or being answered by, an IOC on the wider network. Ports are left at their defaults; isolating from another IOC already bound to the same loopback ports would additionally require distinct `EPICS_*_SERVER_PORT` values, which the platform does not yet set.
- The fixture launches `softIocPVX` directly (no external supervisor). `SIOCSetup` does this from Java: it runs `softIocPVX -m P=<prefix> -d <db>` through a `ProcessBuilder` with stdin as a pipe, and stops the IOC by writing `exit` to that stdin. The database is the in-repo `src/resources/test/UnitTestPVs.db`.

## Tomcat integration tests

`TomcatSetup` starts one Tomcat instance per test from `TOMCAT_HOME` and creates per-test work folders under `archappl.tomcat.dir` (default `target/tomcats`). Use a user-owned Tomcat 9 unpacked from the Apache distribution, with a `conf_original` copy of its pristine `conf` beside it; a root-owned install with an unreadable `conf/` cannot serve as `TOMCAT_HOME`.

Two operational notes:

- Run the integration set after `package`. The WARs carry the build's date and commit in their name (see the artifact naming), so they must be freshly built before `TomcatSetup` copies them.
- A test that errors before its `tearDown` leaves its Tomcat holding the ports, which fails the next run with `Address already in use`. The test Tomcats run with `CATALINA_OPTS=-Deaatag=eaatesttm`; clear leftovers with `pkill -f 'eaatag=eaatesttm'` before re-running.

Browser tests are being rewritten to HTTP: instead of driving a page through Selenium, they GET the same page or BPL endpoint with the JDK HTTP client and poll for readiness with Awaitility, verifying the server response rather than the DOM.

## Principles

- The platform carries only the tests this site needs, on the paths it uses. The Channel Archiver migration tests were removed with that feature's disuse.
- Tests are hermetic and deterministic: temp directories under the build tree, no fixed host paths, readiness by polling (Awaitility) instead of sleeps, and a timeout that turns a hang into a failure. Existing tests that predate these rules are converted as they are touched.
- A test verifies the real shipped path. Internal spans of the path under test are never replaced by stand-ins; only outermost boundaries (an IOC, a browser, the clock) are controlled.
