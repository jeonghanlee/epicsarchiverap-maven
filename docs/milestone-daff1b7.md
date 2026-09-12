# Work Register

Release line: master
Milestone index: daff1b7
Canonical path: `docs/milestone-daff1b7.md`
Canonical branch or ref: modernize
Git upstream: origin/modernize
Remote tracker: jeonghanlee/epicsarchiverap-maven (aa-maven); GitHub issues per row once enabled, no GitHub milestone
Peer register: aa-env at jeonghanlee/epicsarchiverap-env, `docs/milestone-265f580.md` on branch modernize (cross-referenced per D2 and D3)

Next session entry point: execute M8 stage 1 (wire the test tree into Maven, unit set as the default test) as the prerequisite of the accepted M4 plan; the owner's Maven-centric .gitignore rewrite closes M1 whenever it lands.

## Milestone

This register covers the minimal modernization of the existing Java appliance on its current architecture (D12): Phase 1 consolidates the build on Maven against Tomcat 9 and ends with Ant removal; Phase 2 replaces MariaDB with SQLite and prunes unused backends, so the appliance runs as WARs on Tomcat 9 under aa-env's systemd units with no external database. Tomcat 9 is fixed and names stay as they are (D13, D14). Everything beyond this, the architecture replacement, lives in the EPICS-Arche register. Every row follows D8 (stable, current technology) and D10 (small and strong).

### Work

| Group | ID | Work unit | Type | Status | Ready | Deps | Done when / Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Phase 1 | M1 | Gradle removal (complete erasure) | Milestone | In progress | No | | `git grep -i gradle` empty outside this register on a committed tree; [detail](#m1---gradle-removal-complete-erasure) |
| Phase 1 | M2 | Maven Wrapper as the build entry | Milestone | Complete | No | | Fresh clone of c1dd0b1 builds four WARs through mvnw (2026-09-11); [detail](#m2---maven-wrapper-as-the-build-entry) |
| Phase 1 | M3 | Canonical pom as single source of truth | Milestone | Complete | No | D6 | Fresh clone of 9be652c builds four WARs from the tracked pom with no system scope (2026-09-12); [detail](#m3---canonical-pom-as-single-source-of-truth) |
| Phase 1 | M4 | Dependency refresh to stable current versions | Milestone | Not started | No | M3, M8 | Pinned current versions build and pass the unit set; [detail](#m4---dependency-refresh-to-stable-current-versions) |
| Phase 1 | M5 | Maven-centric CI and docs build | Milestone | Not started | Yes | | Owner-authored GitHub Actions on mvnw; readthedocs on mvnw; [detail](#m5---maven-centric-ci-and-docs-build) |
| Phase 1 | M6 | Upstream core features: cherry-pick policy and application | Milestone | Not started | Yes | | Policy accepted and selected upstream changes applied; [detail](#m6---upstream-core-features-cherry-pick-policy-and-application) |
| Phase 1 | M7 | Site-required features and fixes | Milestone | Not started | Yes | | Owner-identified items implemented and verified; [detail](#m7---site-required-features-and-fixes) |
| Phase 1 | M8 | Maven test platform | Milestone | In progress | No | | Stage 1: test tree compiles and the unit set runs by default; Stage 2: Tomcat 9 and softIoc profiles; [detail](#m8---maven-test-platform) |
| Phase 1 | M9 | Documentation for the Maven build | Milestone | Not started | Yes | | Build, test, and deploy docs match the Maven-only reality; [detail](#m9---documentation-for-the-maven-build) |
| Phase 1 | M10 | Ant removal: final Maven-only consolidation | Milestone | Deferred | No | D7 | build.xml gone and antrun executions rehomed; only Maven remains; [detail](#m10---ant-removal-final-maven-only-consolidation) |
| Phase 2 | M11 | sqlite-jdbc runtime dependency | Milestone | Not started | Yes | | SQLite persistence path works at runtime; [detail](#m11---sqlite-jdbc-runtime-dependency) |
| Phase 2 | M12 | Persistence and storage backend pruning | Milestone | Not started | Yes | | Owner-approved backends removed, build and tests pass; [detail](#m12---persistence-and-storage-backend-pruning) |
| Phase 2 | M13 | MariaDB dependency removal | Milestone | Not started | No | M11 | No mariadb-java-client dependency; SQLite is the store; Phase 2 closes here; [detail](#m13---mariadb-dependency-removal) |
| Tracking | G1 | aa-maven GitHub issues enabled | External gate | Open | No | | Repository setting has_issues=true; [detail](#g1---aa-maven-github-issues-enabled) |

### Decisions

| ID | Decision | Decision Date |
| --- | --- | --- |
| D1 | aa-maven is maintained independently; no further upstream merges. It left the GitHub fork network. | 2026-09-11 |
| D2 | Two-session split: aa-maven owns this repository and register, aa-env owns its own. Cross-references use canonical path plus local ID; each M row gets an issue in its own repository. | 2026-09-11 |
| D3 | Issue location shape 1: aa-maven keeps its own issues and register here; aa-env keeps its own. Registers cross-link by issue URL. | 2026-09-11 |
| D4 | Repository names: aa-maven = jeonghanlee/epicsarchiverap-maven, aa-env = jeonghanlee/epicsarchiverap-env. The project name EPICS Arche (repository slug epics-arche) is under consideration; not yet applied. | 2026-09-11 |
| D5 | Deployment baseline is abf6545 as-is, frozen by annotated tag NewHope (on origin, tag object ffbea94). aa-env pins SRC_TAG to it. | 2026-09-11 |
| D6 | The canonical pom base variant is aa-env's tracked pom.xml (tomcat-servlet-api 9.0.113, commons-lang3 3.12.0, guava range). Alternatives considered: aa-env's untracked pom.xml.aa (9.0.98, commons-lang3 3.18.0, guava 33.4.0-jre) and aa-maven's own value (9.0.74). | 2026-09-11 |
| D7 | Ant removal (M10) is deferred; it runs last in Phase 1, after the other build work completes, as the final move to a Maven-only build. | 2026-09-11 |
| D8 | Modernization principle: use stable, current technology throughout. Each row's plan selects the current stable release of its toolchain and libraries at execution time and records the chosen versions as evidence. | 2026-09-11 |
| D9 | Gradle is removed because it is not used: the build is Maven. Its GitHub Actions workflows, the docker tree with the top-level Dockerfile, and the legacy upstream README are removed as unused; the owner rewrites CI and .gitignore Maven-centric. | 2026-09-11 |
| D10 | Design principle: small and strong. Minimize dependencies, components, and languages; never concede performance or robustness. | 2026-09-11 |
| D11 | Phase order: Phase 1 (Maven modernization on the existing Tomcat 9 environment, ending with Ant removal), then Phase 2 (SQLite replacing MariaDB, backend pruning). aa-env implements the runtime as systemd template units. | 2026-09-11 |
| D12 | This register covers only the minimal modernization of the existing architecture through Phase 2. The architecture replacement (storage, query, services, engine, API, MCP, viewer) is EPICS-Arche work and is not tracked here. | 2026-09-11 |
| D13 | Tomcat 9 is fixed for the existing appliance through the end of Phase 2. The jakarta/Tomcat 11 migration and the embedded-Tomcat runnable jars are retired (recorded in the prior generation at the History commit); tomcat-servlet-api tracks the current 9.0.x as a final value. Phase 2 end state: WARs on Tomcat 9, systemd-run by aa-env, SQLite (sqlite3) as the only store. | 2026-09-11 |
| D14 | Naming stays as it is through Phase 2: artifact names archappl-<version>-<component>.war, ARCHAPPL_* variables, and the instance layout are not renamed. | 2026-09-11 |
| D15 | jython-standalone 2.7 stays through Phase 2: it is the execution engine for policies.py, which is Python 2 syntax, and no Python 3 Jython exists. Replacing the policy engine is EPICS-Arche work, not minimal modernization. | 2026-09-12 |
| D16 | redisnio (the Redis NIO FileSystemProvider jar) is removed. ArchPaths resolves only `jar:file://` (zip) specially and everything else on the default filesystem; no code, configuration, template, or document names a redis scheme, so the provider is unreachable. | 2026-09-12 |
| D17 | Test platform scope: do not carry the whole upstream suite; keep only the tests this site needs, on the paths it uses. The upstream tests are not trusted as-is; the platform is built on Java testing fundamentals (hermetic, deterministic, temp-dir based, no hard-coded host paths, fast unit set by default) and reinforced where upstream tests fall short. IOC-dependent tests reuse the test definitions of the epics-ioc-runner project rather than upstream's SIOCSetup where they fit. | 2026-09-12 |
| D18 | Test selection (owner rulings): Matlab export, PVA management API, and zipfs compressed-storage tests stay; the Channel Archiver migration tests are dropped (the site does not use that migration). Whether the main-code ChannelArchiver support itself is removed is decided in the M12 inventory. | 2026-09-12 |
| D19 | The site standard for PVA serving is QSRV2 on pvxs. Test fixtures use softIocPVX (pvxs 1.5.1); softIocPVA (QSRV1) remains only as a compatibility fallback for unconverted tests. | 2026-09-12 |

### Milestone Details

#### M1 - Gradle removal (complete erasure)

Origin: daff1b7 / M1
Identity History: none
GitHub Issue: none
Status: In progress

##### Summary

Erase Gradle from the repository completely: build files, CI consumers, docker scaffolding that ran Gradle, documentation that described the Gradle workflow, and ignore rules. The goal is `git grep -i gradle` returning nothing outside this register. The removal and the docs rewrite are committed (ff67460); the .gitignore rewrite remains.

##### Scope

Removed: build.gradle, gradlew, gradlew.bat, gradle/; the two Gradle-driven GitHub Actions workflows; the docker tree and top-level Dockerfile (D9); the legacy upstream README. Rewritten: developersguide.md and customization.md to the Maven build; .readthedocs.yaml to the Maven javadoc goal. Remaining: strip Gradle rules from .gitignore (owner-authored rewrite).

Out of scope: writing the new CI (M5); Ant removal (M10).

##### Completion Criteria

- `git grep -i gradle` returns only this register, on a committed tree.
- The Maven build and the readthedocs javadoc step succeed with no Gradle artifact present.

##### Dependencies And Decisions

- D9.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner, 2026-09-11
Implementation Authorization: owner, 2026-09-11
Superseded Plan Artifacts: none

1. Remove the Gradle build files, the two workflows, the docker tree, the top-level Dockerfile, and the legacy README. Done (ff67460).
2. Rewrite the developer and customization docs and the readthedocs pre_build to Maven. Done (ff67460).
3. Owner rewrites .gitignore Maven-centric. Pending.
4. Re-run T1 on the committed tree and close.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Static | git grep -il gradle | committed tree | Only docs/milestone-daff1b7.md |
| T2 | Integration | ./mvnw -B clean package -DskipTests | JDK 21, wrapper Maven | Four WARs build with no Gradle file present |
| T3 | Integration | ./mvnw -B -q javadoc:javadoc | JDK 21, with and without JAVA_HOME | Exit 0, target/site/apidocs produced |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-11 | committed tree at ff67460 | Partial | Hits: .gitignore (owner rewrite pending) and the register |
| T2 | 2026-09-11 | JDK 21.0.12.1, Maven 3.9.9 via mvnw | Pass | target/archappl-2025-6-{engine,etl,mgmt,retrieval}.war |
| T3 | 2026-09-11 | JDK 21, JAVA_HOME set and unset | Pass | Exit 0 both runs, target/site/apidocs present; re-run without JAVA_HOME on the tree committed as ff67460, exit 0 |

##### Closure Evidence

- none yet (pending .gitignore rewrite and final T1)

##### GitHub Projection

Title: Remove Gradle completely from the repository
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M2 - Maven Wrapper as the build entry

Origin: daff1b7 / M2
Identity History: none
GitHub Issue: none
Status: Complete

##### Summary

The Apache Maven Wrapper is the build entry so no host needs a system Maven; aa-env sets its MAVEN_CMD to the wrapper and stops installing Maven. The wrapper files are committed (ff67460) and a fresh clone of c1dd0b1 builds all four WARs through the wrapper.

##### Scope

mvnw, mvnw.cmd, and .mvn/wrapper/maven-wrapper.properties generated by the official wrapper plugin, pinned to Maven 3.9.9 (distributionType only-script). Documented build entry: `./mvnw -B clean package -DskipTests` with JAVA_HOME exported.

Out of scope: pom changes (M3); CI (M5).

##### Completion Criteria

- `./mvnw -B clean package -DskipTests` builds all four WARs from a fresh clone of the committed tree.

##### Dependencies And Decisions

- D8 (current stable Maven 3.9 line). aa-env gate G8 references this row.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner, 2026-09-11
Implementation Authorization: owner, 2026-09-11
Superseded Plan Artifacts: none

1. Generate the wrapper pinned to 3.9.9. Done.
2. Verify the wrapper build in this checkout. Done.
3. Commit the wrapper files. Done (ff67460).
4. Verify from a fresh clone and close. Done (2026-09-11).

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | ./mvnw -B clean package -DskipTests in this checkout | JDK 21, JAVA_HOME exported | Four WARs build; wrapper downloads Maven 3.9.9 |
| T2 | Integration | Same command from a fresh clone of the committed tree | JDK 21, JAVA_HOME exported | Four WARs build |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-11 | JDK 21.0.12.1, JAVA_HOME exported | Pass | Exit 0; distributionUrl apache-maven-3.9.9-bin.zip; WARs in target/ |
| T2 | 2026-09-11 | fresh clone of modernize at c1dd0b1, JDK 21.0.12.1, JAVA_HOME exported | Pass | `./mvnw -B -q clean package -DskipTests` exit 0; target/archappl-2025-6-{engine,etl,mgmt,retrieval}.war produced |

##### Closure Evidence

- Wrapper committed in ff67460 (Maven 3.9.9, only-script); T1 and T2 passed on 2026-09-11; no external gate.

##### GitHub Projection

Title: Add the Maven Wrapper as the build entry
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M3 - Canonical pom as single source of truth

Origin: daff1b7 / M3
Identity History: none
GitHub Issue: none
Status: Complete

##### Summary

Make the tracked pom.xml the single build definition for aa-maven, so aa-env no longer overwrites a copied pom during `make init`. Fold in the system-scope removal and lib packaging of the lib/ jars.

##### Scope

Reconcile the aa-maven pom with the D6 base variant, remove system-scope local jar references in favor of a supported packaging path for lib/jamtio and lib/redisnio, and confirm a clean build needs no external pom copy.

Out of scope: version pin changes (M4); CI (M5).

##### Completion Criteria

- A clean checkout builds all four WARs from the tracked pom.xml with no external pom substitution.
- No system-scope dependency remains; the local jars still needed (BPLTaglets for javadoc, pbrawclient for tests) resolve from the project-local repository lib/repo, and no dead jar is packaged into the WARs.

##### Dependencies And Decisions

- D6; D8; D10.
- Findings (2026-09-11) the plan rests on: the tracked pom differs from aa-env's tracked pom.xml (D6 base) in exactly two lines, tomcat-servlet-api 9.0.74 versus 9.0.113; aa-env's `make init` overwrites the pom with `cp -rf $(TOP)/pom.xml $(SRC_PATH)` (configure/RULES_SRC). lib/jamtio_071005.jar is dead: its dependency and its WEB-INF/lib include are commented out. lib/redisnio_0.0.1.jar is a Redis NIO FileSystemProvider (edu.stanford.slac.archiverappliance.PlainPB.fs.redis, registered through META-INF/services, built 2016) with no source reference; it is packaged into every WAR through a webResources include and is used only if a PlainPB store path names a redis filesystem. lib/test holds awaitility 4.2.0, commons-cli 1.5.0, and junit-platform-console-standalone 1.10.0 (all on Maven Central) plus two custom jars, BPLTaglets.jar (javadoc taglet, tagletpath) and pbrawclient-0.2.1.jar (test client), all declared with system scope.
- D16 resolves step 3: redisnio is dropped. Code reading on 2026-09-12: ArchPaths.get handles only the `jar:file://` prefix (JDK zip provider looked up by the "jar" scheme) and sends every other path to FileSystems.getDefault(); src/main contains no URI-based Path or FileSystem lookup that could dispatch by scheme, and no `redis://` appears in code, sitespecific configuration, aa-env templates, or docs.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner, 2026-09-12
Implementation Authorization: owner, 2026-09-12
Superseded Plan Artifacts: none

1. Align the pom to the D6 base: set tomcat-servlet-api to 9.0.113, the only difference at that point. After the rest of this row the tracked pom is the canonical build definition and diverges from aa-env's copy by design (83 lines on 2026-09-12), so aa-env must remove its `make init` pom copy (their M6, gated on this row) in the same step it takes this change; otherwise its build regresses to the stale pom and fails on the removed lib/test jars. Deployment builds pinned to NewHope are unaffected. Done 2026-09-12.
2. Remove the dead jamtio artifact: delete lib/jamtio_071005.jar, the commented dependency and include blocks, and the jamtio.name and jamtio.ver properties. Done.
3. Drop redisnio (D16): remove the system dependency, the five WEB-INF/lib include blocks, the redisnio.name and redisnio.ver properties, and lib/redisnio_0.0.1.jar. Done.
4. lib/test: awaitility, commons-cli, and junit-platform-console-standalone were referenced by nothing in the pom and are deleted (not re-declared). BPLTaglets 1.0 and pbrawclient 0.2.1 are installed into lib/repo (jar and pom only) under groupId local.org.epics, served by a `project-local` file repository; BPLTaglets is the javadoc plugin's tagletArtifact (no dependency), pbrawclient is a test-scope dependency because only tests use it (main code mentions it in a comment only) and its bundled EPICSEvent duplicate must not reach the WARs. lib.dir property removed. Done.
5. No `<scope>system</scope>` or `<systemPath>` remains; the build prints no system-scope warning. Done; T1 from a fresh clone of commit 9be652c passed on 2026-09-12.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | ./mvnw -B clean package on a fresh checkout with no pom copy | JDK 21, wrapper Maven | Four WARs build |
| T2 | Integration | Purge ~/.m2/repository/local/org/epics, then package, javadoc:javadoc, and test-compile | JDK 21, wrapper Maven | Artifacts download from the project-local file repository; no system-scope warning; no local jar inside the WARs |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-12 | fresh clone of modernize at 9be652c, ~/.m2 local.org.epics purged, JDK 21.0.12.1, wrapper Maven 3.9.9 | Pass | Exit 0; four WARs; 4 downloads logged from the project-local lib/repo; 0 system-scope warnings; no local jar in any WAR; javadoc:javadoc exit 0. test-compile also exited 0 but compiled nothing: the pom sets no testSourceDirectory and declares no JUnit dependency, so no test is wired into Maven (found 2026-09-12; test wiring is M8) |
| T2 | 2026-09-12 | this checkout after purging the cached local.org.epics artifacts | Pass | Build log shows "Downloaded from project-local: file:///.../lib/repo/local/org/epics/pbrawclient/0.2.1/..."; BPLTaglets re-cached from lib/repo by javadoc; 0 system-scope warnings; engine WAR contains no redisnio, pbrawclient, or BPLTaglets; javadoc exit 0; test-compile exit 0 is vacuous (no test source wired, see T1) |

##### Closure Evidence

- Executed as commit 9be652c (pom, lib/repo, jar removals, NOTICE); T1 and T2 passed on 2026-09-12; no external gate. aa-env is notified that its pom copy step must be removed at the same time it takes this commit.

##### GitHub Projection

Title: Make pom.xml the canonical single-source build definition
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M4 - Dependency refresh to stable current versions

Origin: daff1b7 / M4
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Refresh and pin the third-party dependency versions on the canonical pom to the current stable releases (D8), on Tomcat 9, the fixed runtime (D13).

##### Scope

Pin the two open version ranges, move every dependency to the current release of its stable line, keep Tomcat 9 (D13) and jython (D15), and record the chosen versions as evidence.

Out of scope: adding sqlite-jdbc (M11); removing MariaDB (M13) or Redis (M12); replacing the aged libraries jdbm, jmatio, json-simple, and commons-math3 (left as-is under minimal modernization).

##### Completion Criteria

- All dependencies are pinned to fixed, current stable versions (no open ranges) and the build passes tests.

##### Dependencies And Decisions

- M3 (refresh applies to the canonical pom); M8 stage 1 (compiled tests for T2 and T4); D8; D13; D15.
- Full dependency audit, 2026-09-12 (`dependency:list`, `dependency:analyze`, `versions:display-dependency-updates` through mvnw): 30 direct dependencies, 53 resolved artifacts (50 compile and runtime). No used-undeclared dependency. Eight unused-declared are runtime or plugin loaded and legitimate (four log4j bindings, mariadb driver, disruptor, BPLTaglets, redisnio). Two open ranges resolve to floating versions and make the build non-reproducible: guava `[32.0.0-android,)` (resolved 33.7.1-jre on 2026-09-12) and commons-io `[2.14.0,)` (resolved 2.22.0).

| Dependency | Declared | Current stable line | Action |
| --- | --- | --- | --- |
| guava | range | 33.x jre | pin |
| commons-io | range | 2.22.x | pin |
| log4j api, core, jul, slf4j2-impl, 1.2-api | 2.20.0 | 2.25.x (3.0 is beta, excluded) | update |
| disruptor | 3.4.4 | 4.0.0 (check log4j compatibility) | update if compatible |
| tomcat-servlet-api | 9.0.74 (9.0.113 after M3) | latest 9.0.x (D13) | update within 9.0.x |
| jca | 2.4.10 | 2.4.12 | update |
| core-pva | 5.0.0 | 5.0.5 | update |
| protobuf-java | 4.36.1 | current | keep |
| hazelcast | 5.4.0 | 5.7.0 | update |
| commons-lang3, commons-codec, commons-validator | 3.12.0, 1.15, 1.7 | 3.20.0, 1.22.1, 1.11.0 | update |
| commons-fileupload | 1.5 | 1.6.0 | update |
| opencsv | 5.7.1 | 5.12.0 | update |
| httpclient, httpcore | 4.5.14, 4.4.16 | last of the 4.x line | keep the 4.x line |
| mariadb-java-client | 3.3.3 | 3.5.10 | leave; removed by M13 |
| jedis | 4.4.0 | 6.x (8.1 is beta) | leave; M12 decides the Redis backend |
| jython-standalone | 2.7.3 | 2.7.x | keep (D15) |
| jdbm, jmatio, json-simple, commons-math3 | 2.4, 1.0, 1.1.1, 3.6.1 | effectively unmaintained | keep; note only |
| redisnio, BPLTaglets, pbrawclient | system scope | local jars | handled by M3 |

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner, 2026-09-12
Implementation Authorization: none
Superseded Plan Artifacts: none

Targets measured on 2026-09-12 with `versions:display-dependency-updates -DallowMajorUpdates=false` (latest within the current major line); re-checked at execution, and the executed value is recorded as evidence.

0. Baseline before any change: run the unit set on the unchanged tree, `./mvnw -B test -Dgroups='!integration & !localEpics & !slow & !flaky'` (the 67 untagged JUnit 5 classes; the tagged sets need Tomcat or softIoc and belong to M8), and record pass, fail, and error counts. Only a change in that outcome counts against a version bump. Add build-time dependency-set checks that stay in the pom: maven-enforcer-plugin with dependencyConvergence and requireUpperBoundDeps, extra-enforcer-rules banDuplicateClasses, and dependency:analyze-only with failOnWarning for used-undeclared; run them on the unchanged tree first and record the baseline.
1. Pin the two ranges to their current resolution: guava `[32.0.0-android,)` to 33.7.1-jre, commons-io `[2.14.0,)` to 2.22.0. No range remains.
2. Runtime and servlet line: tomcat-servlet-api 9.0.113 to 9.0.121 (the value aa-env fixed; D13). log4j api, core, jul, slf4j2-impl, 1.2-api 2.20.0 to 2.26.1 via the log4j.version property. disruptor: try 4.0.0 (log4j 2.26 supports the 4.x line); if the async logger fails at runtime, keep 3.4.4 and record why.
3. EPICS and appliance libraries: jca 2.4.10 to 2.4.12; core-pva 5.0.0 to 5.0.5; hazelcast 5.4.0 to 5.7.0 (cluster state; smoke-test appliance start after the bump).
4. Apache Commons and utilities: commons-lang3 3.12.0 to 3.20.0; commons-codec 1.15 to 1.22.1; commons-validator 1.7 to 1.11.0; commons-fileupload 1.5 to 1.6.0; opencsv 5.7.1 to 5.12.0.
5. Keep as recorded: httpclient 4.5.14 and httpcore 4.4.16 (last of the 4.x line); jython-standalone 2.7.3 (D15; 2.7.4 is the latest stable and may be taken if it builds, 2.7.5b1 is a beta and is excluded); mariadb-java-client 3.3.3 (removed by M13); jedis 4.4.0 (M12 decides); protobuf-java 4.36.1 (current); jdbm, jmatio, json-simple, commons-math3 unchanged.
6. Apply in the order above, one group per build: `./mvnw -B clean package -DskipTests` plus the enforcer and analyze checks after each group, then the unit set from step 0 at the end; on a failure, hold that group at its previous version, record the failure, and continue.
7. Tomcat 9 start smoke: run the `integration` tests that are not `localEpics` (`-Dgroups='integration & !localEpics'`, TomcatSetup-based) so the hazelcast, log4j, and disruptor bumps are exercised at appliance start. Host facts (2026-09-12): /opt/tomcat9 is Tomcat 9.0.113 owned by tomcat with an unreadable conf/ directory, so it cannot serve as TOMCAT_HOME for a user-run test; use a user-owned Apache Tomcat 9.0.121 unpacked under the scratch directory as TOMCAT_HOME (matches the target version). If that cannot be arranged, record the smoke as deferred to M8, not as passed.
8. Record every executed version in the table above as evidence; confirm `dependency:list` shows no range and no system scope.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | ./mvnw -B clean package -DskipTests | JDK 21, wrapper Maven | Build succeeds with every version pinned |
| T2 | Unit | ./mvnw -B test -Dgroups='!integration & !localEpics & !slow & !flaky' | JDK 21, wrapper Maven | Same pass, fail, and error counts as the step 0 baseline or better |
| T3 | Static | enforcer (dependencyConvergence, requireUpperBoundDeps, banDuplicateClasses) and dependency:analyze-only failOnWarning | JDK 21, wrapper Maven | No convergence conflict, no duplicate class, no used-undeclared dependency |
| T4 | Integration | ./mvnw -B test -Dgroups='integration & !localEpics' | JDK 21, Tomcat 9.0.121 via TOMCAT_HOME | Appliance starts under TomcatSetup and the tests pass; deferred to M8 if no Tomcat 9 on the host |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, wrapper Maven | Pending | none |
| T2 | Not run | JDK 21, wrapper Maven | Pending | none |
| T3 | Not run | JDK 21, wrapper Maven | Pending | none |
| T4 | Not run | JDK 21, Tomcat 9.0.121 | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Refresh and pin dependencies to current stable versions
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M5 - Maven-centric CI and docs build

Origin: daff1b7 / M5
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Rebuild continuous integration around the Maven Wrapper. The Gradle workflows are gone (M1); the owner authors the new GitHub Actions workflows (D9). The readthedocs javadoc step already runs on mvnw.

##### Scope

Owner-authored GitHub Actions workflows that build and test with `./mvnw` (JAVA_HOME exported, JDK 21). Keep .readthedocs.yaml on `./mvnw -B -q javadoc:javadoc`.

Out of scope: publishing WAR artifacts as releases (owner decision pending).

##### Completion Criteria

- CI builds and tests run through mvnw on GitHub Actions, and readthedocs builds javadoc through mvnw.

##### Dependencies And Decisions

- D9 (owner authors the CI); D8.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Owner writes the Maven-centric workflow(s) under .github/workflows.
2. Trigger on a branch push and confirm the build and tests pass.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Trigger the workflow on a branch push | GitHub Actions | mvnw build and tests succeed |
| T2 | Integration | readthedocs build | readthedocs | javadoc builds through mvnw |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | GitHub Actions | Pending | none |
| T2 | Not run | readthedocs | Pending | local goal verified under M1 / T3 on 2026-09-11 |

##### Closure Evidence

- none

##### GitHub Projection

Title: Rebuild CI and docs build around the Maven Wrapper
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M6 - Upstream core features: cherry-pick policy and application

Origin: daff1b7 / M6
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Define the policy for selecting upstream changes since the fork base a81b5e4 and bring the core ones into aa-maven during Phase 1. Verified in a local clone of upstream (archiver-appliance/epicsarchiverap) on 2026-09-11: master f86b573 (2026-09-02) is exactly 565 commits past a81b5e4; releases 2.3.1, 2.4.0, and 2.4.1 (2025-07-21) fall in that range; upstream now tags weekly, builds with Gradle Kotlin DSL on a Java 25 toolchain, and runs jakarta on Tomcat 11, none of which is a target here (D13).

##### Scope

Establish which upstream change classes are picked (core features, bug fixes, CVE bumps) and which are skipped, produce the candidate list, and apply the accepted picks on the Maven build.

Out of scope: wholesale upstream merges (D1); build-system or servlet-API changes.

##### Completion Criteria

- A written pick/skip policy accepted by the owner.
- The accepted upstream changes are applied, build, and pass tests on the Maven build.

##### Dependencies And Decisions

- D1; D11 (Phase 1).

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Draft the pick/skip policy.
2. Produce the candidate list from the upstream range.
3. Apply the accepted picks and verify.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Review | Owner review of the policy and candidate list | document | Accepted policy and list |
| T2 | Integration | ./mvnw -B clean package and test after applying picks | JDK 21, wrapper Maven | Build and tests pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | document | Pending | none |
| T2 | Not run | JDK 21, wrapper Maven | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Define upstream cherry-pick policy and apply core features
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M7 - Site-required features and fixes

Origin: daff1b7 / M7
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Implement the features and fixes this site needs in aa-maven, independent of upstream.

##### Scope

Owner-identified features and defects implemented directly in the fork on the Maven build.

Out of scope: upstream picks (M6).

##### Completion Criteria

- Each owner-identified item is implemented and verified.

##### Dependencies And Decisions

- D11 (Phase 1); awaiting the owner's item list.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Collect the owner's list.
2. Implement and verify each item.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Reproduce and re-test each item | JDK 21, Tomcat 9 | Each item resolved |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, Tomcat 9 | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Site-required features and fixes
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M8 - Maven test platform

Origin: daff1b7 / M8
Identity History: none
GitHub Issue: none
Status: In progress

##### Summary

Wire the test tree into Maven and rebuild the test selection the removed Gradle build had. Found 2026-09-12: the pom sets no testSourceDirectory and declares no JUnit dependency, so Maven has never compiled a single test (185 test sources under src/test/org and src/test/edu; Maven looked in src/test/java). The tests are JUnit 5 (151 classes) and already carry tags: integration 64, localEpics 49, slow 8, flaky 3; 67 classes are untagged and need no environment. Stage 1 (pulled forward as the prerequisite of M4) compiles the test tree and makes the untagged unit set the default `./mvnw test`; Stage 2 adds the Tomcat 9 and softIoc profiles.

##### Scope

Stage 1: testSourceDirectory and test resources, test-scope dependencies the tree needs (JUnit 5 with the platform suite, selenium-java and webdrivermanager for the browser tests, awaitility, jinjava for the AppliancesXMLGenerator helper), conversion of the one JUnit 4 suite (PvaTest.java) to a JUnit 5 suite, and Surefire configured so `./mvnw test` runs only the untagged set while `-Dgroups` can select the others. Stage 2: an `integration` profile that runs `integration & !localEpics` against a user-owned Tomcat 9.0.121 through TOMCAT_HOME, a `localEpics` profile that runs the softIoc-based tests with EPICS base on PATH, and the documented invocations.

Out of scope: CI wiring (M5); the pythontests scripts.

Selection and reinforcement (D17, D18): the platform keeps only the tests this site needs — kept: PlainPB and PB, ETL, retrieval with postprocessors, saverestore, Matlab export, zipfs compressed storage, mgmt (policies and PVA management API), config, common, engine including PVA (V4); dropped: retrieval/channelarchiver (migration from the 2011 Channel Archiver, not used; removed 2026-09-12). Reinforcement backlog on the kept tests, applied incrementally: Thread.sleep waits (253 calls in 56 files) replaced with Awaitility; hard-coded /scratch and /tmp paths replaced with @TempDir and a ConfigServiceForTests default under target; the static shared ConfigServiceForTests instances (8 files) isolated; a global JUnit timeout so a hang fails instead of blocking; the two-minute V4 tests tagged slow; JaCoCo coverage wired so the kept set is selected by measured coverage of the site's paths, not by folder name.

##### Completion Criteria

- Stage 1: `./mvnw test-compile` compiles every test source; `./mvnw test` runs the untagged set and its pass, fail, and error counts are recorded as the baseline; a fresh clone reproduces both.
- Stage 2: the `integration` and `localEpics` sets run through their profiles in the existing environment and their results are recorded.

##### Dependencies And Decisions

- D11 (Phase 1); D8 (current stable JUnit 5, Surefire, and test libraries, pinned and recorded at execution).
- Stage 1 is the prerequisite of M4 (its T2 and T4 need compiled tests); M4 waits on it.
- softIoc for Stage 2 (owner direction 2026-09-12, "make one easily"): no build was needed. The installed ALSU EPICS environment already provides it at /data/gitsrc/alsu-epics-environment/1.2.2/debian-13/7.0.10/base/bin/linux-x86_64 (EPICS base 7.0.10 for this Debian 13 host). Verified end to end: softIoc served a PINI ai record over CA on a pinned port (EPICS_CA_SERVER_PORT=5097, ADDR_LIST 127.0.0.1) and caget returned its value. SIOCSetup actually launches softIocPVA (the PVA-enabled variant), provided by the same tree. Verified end to end on 2026-09-12 with the tree's setEpicsEnv.bash: CA with caget, PVA with pvxget (pvxs 1.5.1, NTScalar returned). Two operational facts the Stage 2 fixture must honor: softIocPVA needs stdin held open (SIOCSetup pipes it; with -S and closed stdin the main thread suspends on epicsThreadExitMain and PVA never answers), and port isolation must use the server-side variables EPICS_PVAS_SERVER_PORT, EPICS_PVAS_BROADCAST_PORT, and EPICS_PVAS_INTF_ADDR_LIST=127.0.0.1 on the IOC with the matching EPICS_PVA_BROADCAST_PORT and EPICS_PVA_ADDR_LIST on the client; client-style EPICS_PVA_* alone does not move the server, and the default 5076 search cannot see a loopback-only server (another PVA server already listens on this host's interface broadcast addresses). softIocPVX (pvxs 1.5.1, QSRV2) from the same tree is the fixture IOC (D19, site standard QSRV2): verified 2026-09-12 on the pinned ports — PVA answers pvxget with the full NTScalar (value 42) and CA answers caget, QSRV2 reports loaded and enabled, zero errors in the IOC log. SIOCSetup currently launches softIocPVA by name; the Stage 2 fixture targets softIocPVX and keeps softIocPVA available for unconverted tests. Stage 2 puts the tree's bin directories on PATH in the localEpics profile.
- Facts the plan rests on (2026-09-12): every selenium test and every TomcatSetup or SIOCSetup test is tagged, so the untagged set starts no browser, Tomcat, or IOC; AppliancesXMLGenerator (untagged helper used by TomcatSetup) imports com.hubspot.jinjava, which no pom declares; PvaTest.java uses org.junit.runners.Suite with @RunWith, @BeforeClass, @AfterClass, and @Category; test data files live beside the sources under src/test (retrieval/channelarchiver, retrieval/postprocessor/data, mgmt).

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner, 2026-09-12
Implementation Authorization: owner, 2026-09-12
Superseded Plan Artifacts: none

Stage 1
1. pom: `<testSourceDirectory>${project.basedir}/src/test</testSourceDirectory>` and a testResources entry for src/test excluding `**/*.java`, so the data files beside the tests reach target/test-classes.
2. pom: test-scope dependencies at the current stable releases (verified at execution, versions recorded here): junit-jupiter (api, params, engine) and junit-platform-suite through the JUnit BOM; selenium-java and io.github.bonigarcia:webdrivermanager; org.awaitility:awaitility; com.hubspot.jinjava:jinjava. Add whatever else test-compile reports missing, one at a time, recording each.
3. Convert PvaTest.java from the JUnit 4 Suite runner to a JUnit 5 `@Suite` (junit-platform-suite-api) with `@SelectClasses`, and replace @BeforeClass/@AfterClass with @BeforeAll/@AfterAll or a suite-level extension; no JUnit 4 dependency is added.
4. pom: maven-surefire-plugin at the current 3.x with `<excludedGroups>integration,localEpics,slow,flaky</excludedGroups>` as the default, so `./mvnw test` is the unit set and `-Dgroups=...` still selects any set.
5. Run `./mvnw -B test-compile` until every test source compiles; then `./mvnw -B test` and record the unit baseline counts (this is also M4 step 0).
6. Fresh clone: repeat step 5 on the committed tree.

Stage 2 (after M4)
7. `integration` profile: groups `integration & !localEpics`, TOMCAT_HOME pointing at a user-owned Tomcat 9.0.121 under the scratch directory (/opt/tomcat9 on this host is 9.0.113 with an unreadable conf/); record results.
8. `localEpics` profile: softIoc from the EPICS-env build on PATH; record results.
9. Document the three invocations in the developer guide (feeds M9). The standing platform document is TESTING.md at the repository root (layout, sets, fixture contracts, principles); M9 links it from the developer guide and keeps the two consistent.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Static | ./mvnw -B test-compile; count *.class under target/test-classes | JDK 21, wrapper Maven | Every test source compiles (185 sources) |
| T2 | Unit | ./mvnw -B test (default excludedGroups) | JDK 21, wrapper Maven | The untagged set runs (about 67 classes); counts recorded as baseline |
| T3 | Integration | ./mvnw -B test -Pintegration | JDK 21, Tomcat 9.0.121 via TOMCAT_HOME | Stage 2: integration set runs and results recorded |
| T4 | Integration | ./mvnw -B test -PlocalEpics | JDK 21, softIoc on PATH | Stage 2: localEpics set runs and results recorded |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-12 | JDK 21.0.12.1, wrapper Maven 3.9.9 | Pass | ./mvnw -B test-compile exit 0; 233 class files under target/test-classes from 185 sources; test data and the tests-site classpathfiles (archappl.properties, policies.py, appliances.xml) present in target/test-classes |
| T2 | 2026-09-12 | JDK 21.0.12.1, wrapper Maven 3.9.9, surefire 3.6.0, default excludedGroups | Pass | ./mvnw -B test: 69 classes, 739 tests, 0 failures, 0 errors, 0 skipped, BUILD SUCCESS; storage folders under target/test-storage; PvaTest suite excluded by default (its members are tagged integration and localEpics) |
| T3 | Not run | JDK 21, Tomcat 9.0.121 | Pending | none |
| T4 | Not run | JDK 21, softIoc | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Build the Maven test platform
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M9 - Documentation for the Maven build

Origin: daff1b7 / M9
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Bring the documentation in line with the Maven-only reality: build, test, customization, and deployment on Tomcat 9, and the readthedocs pipeline. The Gradle-era text was rewritten minimally under M1; this row completes the documentation.

##### Scope

Developer guide, sysadmin customization and install guides, README.md, and the Sphinx pipeline, all describing mvnw, the test platform (M8), and the Phase 1 deployment.

Out of scope: EPICS-Arche architecture docs.

##### Completion Criteria

- Docs describe the actual build, test, and deploy procedure, and the Sphinx site builds cleanly.

##### Dependencies And Decisions

- D11 (Phase 1); D8.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Audit the docs against the Maven build and the M8 test platform.
2. Rewrite the affected pages and verify the Sphinx build.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | docs/build_docs.sh | Python 3, Sphinx | Site builds with no errors |
| T2 | Review | Second-person pass on the rewritten pages | document | A cold reader can build, test, and deploy from the docs |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | Python 3, Sphinx | Pending | none |
| T2 | Not run | document | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Documentation for the Maven build
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M10 - Ant removal: final Maven-only consolidation

Origin: daff1b7 / M10
Identity History: none
GitHub Issue: none
Status: Deferred

##### Summary

Remove the Ant build file and rehome the five maven-antrun-plugin executions onto native Maven plugins. Deferred per D7 to run last in Phase 1, as the final move to a Maven-only build once the other build work is complete. Upstream still carries the same build.xml and sitespecific hook (verified 2026-09-11), so no upstream solution exists to borrow.

##### Scope

Delete build.xml. Replace the five antrun executions create-api-docs-directory, check-mappings-file-before-javadoc, download-unpack-and-stage-svg-viewer, create-version-txt, and sitespecificantscript with Maven-plugin equivalents.

Out of scope: exec-maven-plugin steps that are not antrun.

##### Completion Criteria

- No maven-antrun-plugin execution remains and build.xml is deleted, with the five tasks still performed during the Maven build.

##### Dependencies And Decisions

- D7: deferred to run last in Phase 1, after the other build work completes.
- Open item: the sitespecificantscript execution runs each site's own build.xml via Ant (build.xml target sitespecificbuild, which runs `ant` in src/sitespecific/<siteid>). The classpathfiles half of the site overlay is pure Maven (webResources into all four WARs) and survives; the per-site build.xml execution is the Ant-coupled half. Removing Ant requires defining how the Maven build consumes a site's build step, or retiring per-site build.xml in favor of pure classpathfiles resources. aa-env's Ant-cleanup row is gated on this.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Define the replacement for the per-site build.xml execution (open item above).
2. Move each antrun task to a native Maven plugin.
3. Remove the antrun plugin block and build.xml.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | ./mvnw -B clean package | JDK 21, wrapper Maven | Build produces the same outputs from all five former antrun tasks without antrun |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, wrapper Maven | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Remove Ant build.xml and rehome antrun executions
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M11 - sqlite-jdbc runtime dependency

Origin: daff1b7 / M11
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Add the sqlite-jdbc runtime dependency. The SQLite dialect already exists in MySQLPersistence and archappl_sqlite.sql; only the driver dependency is missing. First step of Phase 2.

##### Scope

Add sqlite-jdbc (current stable) as a runtime dependency in the canonical pom and confirm the SQLite persistence path loads.

Out of scope: dialect or schema code changes; MariaDB removal (M13).

##### Completion Criteria

- The SQLite persistence path works at runtime with the driver on the classpath.

##### Dependencies And Decisions

- D11 (Phase 2); D8.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Add the sqlite-jdbc runtime dependency.
2. Start with the SQLite persistence configured and verify.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Start with the SQLite persistence configured | JDK 21, Tomcat 9 | Persistence loads via SQLite |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, Tomcat 9 | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Add sqlite-jdbc runtime dependency
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M12 - Persistence and storage backend pruning

Origin: daff1b7 / M12
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Remove persistence or storage code aa-maven does not need. Owner wording: unusual storage backends are to be dropped. Present backends are InMemory, JDBM2, MySQL, and Redis persistence, and PB, PBOverHTTP, and PlainPB storage plugins.

##### Scope

Inventory the persistence and storage backends first, then remove the ones the owner selects.

Out of scope: removing anything before the owner approves the drop list; MariaDB removal (M13).

##### Completion Criteria

- The owner-approved backends are removed and the build and tests pass without them.

##### Dependencies And Decisions

- D11 (Phase 2); D10; inventory first; owner decides the drop list.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Inventory the backends and their usage.
2. Remove the owner-selected backends.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | ./mvnw -B clean package and test after removal | JDK 21, wrapper Maven | Build and tests pass without the dropped backends |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, wrapper Maven | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Prune unneeded persistence and storage backends
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M13 - MariaDB dependency removal

Origin: daff1b7 / M13
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Drop the MariaDB dependency once SQLite is the configuration store, so the runtime needs no external database server. This row closes Phase 2 (D11, D13): after it, the appliance runs as WARs on Tomcat 9 under aa-env's systemd units with SQLite and no external database.

##### Scope

Remove mariadb-java-client and the MariaDB-specific configuration paths after the SQLite path (M11) is verified, make SQLite the default persistence, and update the per-instance context.xml DataSource guidance for aa-env accordingly.

Out of scope: the SQLite dialect itself (exists); backend pruning (M12).

##### Completion Criteria

- No mariadb-java-client dependency in the pom; the components run with SQLite persistence and pass tests; the DataSource guidance sent to aa-env reflects SQLite.

##### Dependencies And Decisions

- M11 (SQLite must work first); D11; D13; D8.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Make SQLite the default persistence configuration.
2. Remove the MariaDB dependency and configuration; update the DataSource guidance.
3. Build and test.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Static | grep for mariadb in pom.xml and config | repository | No matches |
| T2 | Integration | Run the components on SQLite only | JDK 21, Tomcat 9 | Archive and retrieve a test PV without MariaDB |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | repository | Pending | none |
| T2 | Not run | JDK 21, Tomcat 9 | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Remove the MariaDB dependency in favor of SQLite
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### G1 - aa-maven GitHub issues enabled

Origin: daff1b7 / G1
GitHub Issue: none
Status: Open

##### Summary

D2 and D3 require one GitHub issue per M row in this repository. GitHub issues are currently disabled on aa-maven, so no row can be projected to an issue until the owner enables the repository issues setting. This gate blocks the per-row issue projection, not the milestone deliverables themselves.

##### Completion Criteria

- gh api repos/jeonghanlee/epicsarchiverap-maven reports has_issues=true.

##### Verification Results

| Observed At | Result | Evidence |
| --- | --- | --- |
| 2026-09-11 | Pending | gh api reports has_issues=false |

##### Closure Evidence

- none

## Backlog

### Work

| Group | ID | Work unit | Type | Status | Ready | Deps | Done when / Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |

No unassigned work in this generation.

### Backlog Details

None.

## History

| Reset Date | Prior State Commit |
| --- | --- |
| 2026-09-11 | daff1b7da2834bdb121aa2cac6c841a6ce9d43fa |
