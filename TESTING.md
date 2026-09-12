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
./mvnw test
./mvnw test -Dgroups='integration & !localEpics'
./mvnw test -Dtest=PolicyExecutionTest
```

The default run executes the unit set only. Any tagged set is opted into with `-Dgroups`.

## EPICS-dependent tests

The site standard for PVA serving is QSRV2 on pvxs. The fixture IOC is `softIocPVX` (pvxs module); `softIocPVA` remains only as a compatibility fallback for unconverted tests.

- Activate an EPICS environment that provides `softIocPVX`, `pvxget`, and `caget`, for example:

```bash
source /path/to/epics-environment/setEpicsEnv.bash
```

- The fixture must keep the IOC's stdin open (pipe it). A soft IOC started with `-S` and a closed stdin suspends its main thread and PVA never answers.
- Port isolation uses the server-side variables on the IOC process: `EPICS_PVAS_SERVER_PORT`, `EPICS_PVAS_BROADCAST_PORT`, `EPICS_PVAS_INTF_ADDR_LIST=127.0.0.1`, and `EPICS_CA_SERVER_PORT`. Clients set the matching `EPICS_PVA_BROADCAST_PORT`, `EPICS_PVA_ADDR_LIST=127.0.0.1`, `EPICS_PVA_AUTO_ADDR_LIST=NO` (and the CA equivalents). Client-style `EPICS_PVA_*` variables alone do not move the server, and default ports cannot isolate from other PVA servers on the same host.
- IOC lifecycle for new fixtures follows the epics-ioc-runner local-mode contract: `ioc-runner --local generate | install | start <name> | stop <name>`, with a `<name>.conf` EnvironmentFile carrying `IOC_CMD`, the database, and all `EPICS_*` variables. It requires a user systemd instance.

## Tomcat integration tests

`TomcatSetup` starts one Tomcat instance per test from `TOMCAT_HOME` and creates per-test work folders. Use a user-owned Tomcat 9 unpacked from the Apache distribution; a root-owned install with an unreadable `conf/` cannot serve as `TOMCAT_HOME`.

## Principles

- The platform carries only the tests this site needs, on the paths it uses. The Channel Archiver migration tests were removed with that feature's disuse.
- Tests are hermetic and deterministic: temp directories under the build tree, no fixed host paths, readiness by polling (Awaitility) instead of sleeps, and a timeout that turns a hang into a failure. Existing tests that predate these rules are converted as they are touched.
- A test verifies the real shipped path. Internal spans of the path under test are never replaced by stand-ins; only outermost boundaries (an IOC, a browser, the clock) are controlled.
