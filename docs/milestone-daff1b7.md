# Work Register

Release line: master
Milestone index: daff1b7
Canonical path: `docs/milestone-daff1b7.md`
Canonical branch or ref: modernize
Git upstream: origin/modernize
Remote tracker: jeonghanlee/epicsarchiverap-maven (aa-maven); GitHub issues per row once enabled, no GitHub milestone
Peer register: aa-env at jeonghanlee/epicsarchiverap-env, `docs/milestone-265f580.md` on branch modernize (cross-referenced per D2 and D3)

Next session entry point: M6 Tier A and B are triaged. Ten units are applied and committed (PR360, PR364, PR408, PR417, PR423, PR425, PR445, PR454, PR481, PR516; compile-verified, runtime IOC verification pending the fixture environment). Eight are queued for owner decision, each with its reason in the M6 Application status (PR385, PR396, PR433, PR461, PR474, PR480, PR501, PR505). Three are excluded (PR429, PR458 by D26; PR359 by D27). Next: resolve the eight queued decisions, then reach Tier C and D (PR400, PR405, PR448, PR452, PR520, PR521, PR527), not yet started. M5 hosted verification remains to be recorded; Read the Docs is not connected. Maven 3.9.16 is committed as d12382d1 with CI skipped; Wrapper startup and validate passed locally.

M8 completion checkpoint (2026-09-15): the corrections landed in origin/modernize as eb047c576948ad2ee770cd1e0a3b74808b64bb2e. A new clone from that remote compiled all 176 test sources into 220 class files and passed all 749 default tests; its tracked and untracked status was clean before and after verification. T1-T4 record the complete-set evidence, and T9-T17 retain the focused checks and original failure evidence. The original assertions remain intact, including DbdArchiveTest's three events and FailoverScoreAPITest's 480 hourly values.

## Milestone

This register covers the minimal modernization of the existing Java appliance on its current architecture (D12): Phase 1 consolidates the build on Maven against Tomcat 9 and ends with Ant removal; Phase 2 replaces MariaDB with SQLite and prunes unused backends, so the appliance runs as WARs on Tomcat 9 under aa-env's systemd units with no external database. Tomcat 9 is fixed and names stay as they are (D13, D14). Everything beyond this, the architecture replacement, lives in the EPICS-Arche register. Every row follows D8 (stable, current technology) and D10 (small and strong).

### Work

| Group | ID | Work unit | Type | Status | Ready | Deps | Done when / Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Phase 1 | M1 | Gradle removal (complete erasure) | Milestone | Complete | No | | `git grep -i gradle` returns only this register on the committed tree (2026-09-12); [detail](#m1---gradle-removal-complete-erasure) |
| Phase 1 | M2 | Maven Wrapper as the build entry | Milestone | Complete | No | | Fresh clone of c1dd0b1 builds four WARs through mvnw (2026-09-11); [detail](#m2---maven-wrapper-as-the-build-entry) |
| Phase 1 | M3 | Canonical pom as single source of truth | Milestone | Complete | No | D6 | Fresh clone of 9be652c builds four WARs from the tracked pom with no system scope (2026-09-12); [detail](#m3---canonical-pom-as-single-source-of-truth) |
| Phase 1 | M4 | Dependency refresh to stable current versions | Milestone | Complete | No | M3, M8 | Fixed versions, build and dependency checks pass; 749 default and 45 integration tests pass; landed as 977edf3d (2026-09-16); [detail](#m4---dependency-refresh-to-stable-current-versions) |
| Phase 1 | M5 | Maven-centric CI and docs build | Milestone | In progress | No | D24 | Workflow and docs checks pass locally, including 749 tests; landing and hosted builds pending; [detail](#m5---maven-centric-ci-and-docs-build) |
| Phase 1 | M6 | Upstream core features: cherry-pick policy and application | Milestone | In progress | No | D25 | 105 PRs classified; 72 scored by five reviewers; 25 PRs owner-confirmed after exclusions (D26, D27); ordered application plan recorded; source changes pending; [detail](#m6---upstream-core-features-cherry-pick-policy-and-application) |
| Phase 1 | M7 | Site-required features and fixes | Milestone | Not started | Yes | | Owner-identified items implemented and verified; [detail](#m7---site-required-features-and-fixes) |
| Phase 1 | M8 | Maven test platform | Milestone | Complete | No | | Fresh clone of eb047c57 compiles and passes 749 default tests; integration 98 and localEpics 26 pass (2026-09-15); [detail](#m8---maven-test-platform) |
| Phase 1 | M9 | Documentation for the Maven build | Milestone | Not started | Yes | | Build, test, and deploy docs match the Maven-only reality; [detail](#m9---documentation-for-the-maven-build) |
| Phase 1 | M14 | Build self-sufficiency (no build-time network, pip, or scp) | Milestone | Not started | Yes | | Build runs offline: no svg_viewer download, no per-build sphinx pip install, no scp; [detail](#m14---build-self-sufficiency-no-build-time-network-pip-or-scp) |
| Phase 1 | M15 | Separate non-test utilities out of src/test | Milestone | Not started | Yes | | The 20 main() dev/generator utilities move out of the test source tree; [detail](#m15---separate-non-test-utilities-out-of-srctest) |
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
| D17 | Test platform scope: do not carry the whole upstream suite; keep only the tests this site needs, on the paths it uses. The upstream tests are not trusted as-is; the platform is built on Java testing fundamentals (hermetic, deterministic, temp-dir based, no hard-coded host paths, fast unit set by default) and reinforced where upstream tests fall short. IOC-dependent tests run against a directly launched softIocPVX (see D20, which supersedes an earlier plan to reuse epics-ioc-runner). | 2026-09-12 |
| D18 | Test selection (owner rulings): Matlab export, PVA management API, and zipfs compressed-storage tests stay; the Channel Archiver migration tests are dropped (the site does not use that migration). Whether the main-code ChannelArchiver support itself is removed is decided in the M12 inventory. | 2026-09-12 |
| D19 | The site standard for PVA serving is QSRV2 on pvxs. Test fixtures use softIocPVX (pvxs 1.5.1); softIocPVA (QSRV1) remains only as a compatibility fallback for unconverted tests. | 2026-09-12 |
| D20 | EPICS test fixtures launch softIocPVX directly from Java (SIOCSetup: ProcessBuilder, stdin pipe, `exit` to stop), not through epics-ioc-runner. The runner needs a user systemd instance, which a headless build host lacks; direct launch keeps the fixture self-contained. SIOCSetup now runs softIocPVX (was softIocPVA). | 2026-09-12 |
| D21 | Build artifact final name is the variable scheme aa-<yyyyMMdd>-<git short hash> (maven.build.timestamp plus git-commit-id), replacing archappl-<version>; the WAR and assembly names use the one project finalName, ending the earlier dash/underscore split. Tests resolve it through the archappl.final.name system property; aa-env will be notified on the commit because it deploys the WARs and the name change affects its deploy paths. | 2026-09-12 |
| D22 | The 29 Selenium browser integration tests are rewritten to exercise the mgmt BPL HTTP endpoints directly (archivePV, getPVStatus, areWeArchivingPV, getMatchingPVs), not the mgmt UI DOM. They verify server behavior, not the UI, so the browser, chromedriver, and WebDriverManager dependencies are dropped; the UI itself is EPICS-Arche's concern. | 2026-09-12 |
| D23 | aa-maven's test platform is complete at single-instance scope. Of the 29 browser tests, 20 were rewritten to HTTP; the remaining 9 (multi-appliance cluster and large-volume data) are deleted rather than rewritten, because multi-appliance clustering is not carried forward by the EPICS-Arche successor and large-volume verification is owned by Arche (storage-path done in Arche M1 at the 100k-signal scale; network-borne end-to-end large-volume is Arche Phase 2, ahead). The appliance's own 100k-PV performance campaign remains the historical end-to-end large-volume record. | 2026-09-14 |
| D24 | M5 CI implementation is delegated; this supersedes D9's owner-only CI authorship. The scope remains Maven build and test automation plus Read the Docs, with no release publishing. | 2026-09-16 |
| D25 | M6 owner selection confirms 28 upstream PR units for ordered, selective adoption on the Maven, Java 21 and Tomcat 9 fork; Parquet/Hadoop units remain excluded, PR400 requires adaptation to the current PlainPB structure, and no source patch is authorized yet. | 2026-09-16 |
| D26 | Single-instance scope reduces the M6 selection from 28 to 26 upstream PR units. PR429 (appliance-to-appliance reassignment; ReassignAppliance absent) and PR458 (stored-chunkKey handling already implemented by the fork's ConvertPVNameToKey) are excluded. | 2026-09-16 |
| D27 | PR359 skipped during application review. The fork commit 103dab65 already fixes the underlying alias-conversion bug with a retained plain-name guard; the owner keeps the fork approach rather than PR359's guard removal. Selection reduces to 25 units. | 2026-09-16 |

### Conceptual-integrity findings

Coherence candidates from the 2026-09-17 sweep around the M6 Tier A and B applications; all are now decided and recorded below. Coverage: the sweep targeted the agreement-points the recent units touched (disconnect handling, metadata keys, null handling, name resolution), not every codebase dimension.

**CI-3 (Keep for now, tracked; deferred fix):** PV-name resolution diverges by thoroughness. The comprehensive resolver in `PVNames.java` tries both the full and the fieldless form against the alias map; `GetDataAtTime.java:199` normalizes first; the simpler BPL endpoints `AreWeArchivingPV.java:43` and `GetPVMetaData.java:49` do a single raw getRealNameForAlias(pvName). So an aliased PV with a field suffix (for example alias.HIHI) resolves in the comprehensive path but not at the simpler endpoints; latent-but-reachable, pre-existing (not an M6 unit), not observed in output. Owner decision 2026-09-17: keep as-is for now and track it here; generalize all entry points through one canonical resolver when capacity allows.

**CI-2 (Resolved, Replace, 2026-09-17):** the FieldValuesCache null path is now filtered once in the shared v3NamedValues, superseding PR445's per-method guard; PR480 applied. Verified by FieldValuesCacheTest (10/10, including testNullValues), a non-IOC regression (748 tests, no real failure), and ChangedFieldsTest against real softIocPVX. Follow-up observation: four sibling EPICS_V4_PV exception logs (connecting/disconnecting/subscribing/unsubscribing) still omit the PV name; a consistent pass is a separate optional cleanup, not tracked.

**CI-1 (Keep, examined, no action):** EPICS_V4_PV's teardown `disconnect()` (`EPICS_V4_PV.java:392`) does not set state Disconnected, unlike the reactive `handleDisconnected()` (`:410`, added by PR360). A reproduction on real softIocPVX (2026-09-17, EPICS_V4_PVDisconnectSeamTest) fired pvDisconnected exactly once in both a clean stop() and an IOC-kill-then-stop: pvxs re-searches on a drop (CONNECTED to SEARCHING, not Disconnected) and disconnect() clears connected before closing, so the reactive path is not scheduled during teardown. The structural asymmetry is real but does not manifest as an observable double-disconnect in the scenarios tested; left as-is.

**CI-4 (Keep, examined, no action):** the NELM to EAA_COUNT metadata key rename (PR423). A whole-tree search found only the producer `MetaInfo.java:715` and no in-tree reader of the NELM key in Java, JS, HTML or docs; only external API clients are affected, already noted in PR423's status. No in-tree coherence break, so the key is left as renamed. Recorded so a later sweep does not re-open this door.

### Milestone Details

#### M1 - Gradle removal (complete erasure)

Origin: daff1b7 / M1
Identity History: none
GitHub Issue: none
Status: Complete

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
| T1 | 2026-09-12 | committed tree | Pass | After the Maven-centric .gitignore rewrite, git grep -il gradle returns only docs/milestone-daff1b7.md |
| T2 | 2026-09-11 | JDK 21.0.12.1, Maven 3.9.9 via mvnw | Pass | target/archappl-2025-6-{engine,etl,mgmt,retrieval}.war |
| T3 | 2026-09-11 | JDK 21, JAVA_HOME set and unset | Pass | Exit 0 both runs, target/site/apidocs present; re-run without JAVA_HOME on the tree committed as ff67460, exit 0 |

##### Closure Evidence

- Gradle build files, workflows, docker tree, and legacy README removed (ff67460); docs and readthedocs moved to Maven; .gitignore rewritten Maven-centric; on the committed tree git grep -i gradle returns only this register; the Maven build and javadoc goal pass without any Gradle artifact.

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
Status: Complete

##### Summary

Refresh and pin the third-party dependency versions on the canonical pom to the current stable releases (D8), on Tomcat 9, the fixed runtime (D13).

##### Scope

Pin all open version ranges, move every in-scope dependency to the current release of its stable line, keep Tomcat 9 (D13) and jython (D15), and record the chosen versions as evidence.

Out of scope: adding sqlite-jdbc (M11); removing MariaDB (M13) or Redis (M12); replacing the aged libraries jdbm, jmatio, json-simple, and commons-math3 (left as-is under minimal modernization).

##### Completion Criteria

- All dependencies are pinned to fixed, current stable versions (no open ranges) and the build passes tests.

##### Dependencies And Decisions

- M3 (refresh applies to the canonical pom); M8 stage 1 (compiled tests for T2 and T4); D8; D13; D15.
- Full dependency audit, 2026-09-12 (`dependency:list`, `dependency:analyze`, `versions:display-dependency-updates` through mvnw): 30 direct dependencies, 53 resolved artifacts (50 compile and runtime). No used-undeclared dependency. Eight unused-declared are runtime or plugin loaded and legitimate (four log4j bindings, mariadb driver, disruptor, BPLTaglets, redisnio). Two open ranges resolve to floating versions and make the build non-reproducible: guava `[32.0.0-android,)` (resolved 33.7.1-jre on 2026-09-12) and commons-io `[2.14.0,)` (resolved 2.22.0).

| Dependency | Before M4 | Executed version | Action |
| --- | --- | --- | --- |
| guava | [32.0.0-android,) | 33.7.1-jre | pin |
| commons-io | [2.14.0,) | 2.22.0 | pin |
| log4j api, core, jul, slf4j2-impl, 1.2-api | 2.20.0 | 2.26.1 | update; exclude 3.0 beta |
| disruptor | 3.4.4 | 4.0.0 | update; runtime tests passed |
| tomcat-servlet-api | 9.0.113 | 9.0.122 | latest stable 9.0.x observed at execution |
| jca | 2.4.10 | 2.4.12 | update |
| core-pva | 5.0.0 | 5.0.5 | update |
| protobuf-java | [3.25.5,) | 4.36.1 | pin existing resolved version |
| hazelcast | 5.4.0 | 5.7.0 | update |
| commons-lang3, commons-codec, commons-validator | 3.12.0, 1.15, 1.7 | 3.20.0, 1.22.1, 1.11.0 | update |
| commons-fileupload | 1.5 | 1.6.0 | update |
| opencsv | 5.7.1 | 5.12.0 | update |
| Javadoc plugin: commons-io, commons-lang3 | [2.14.0,), 3.12.0 | 2.22.0, 3.20.0 | share fixed properties with project dependencies |
| commons-compress (test) | 1.27.1 | 1.28.0 | update |
| httpclient, httpcore | 4.5.14, 4.4.16 | 4.5.14, 4.4.16 | keep the 4.x line |
| mariadb-java-client | 3.3.3 | 3.3.3 | leave; removed by M13 |
| jedis | 4.4.0 | 4.4.0 | leave; M12 decides the Redis backend |
| jython-standalone | 2.7.3 | 2.7.4 | update within the stable 2.7 line (D15) |
| jdbm, jmatio, json-simple, commons-math3 | 2.4, 1.0, 1.1.1, 3.6.1 | 2.4, 1.0, 1.1.1, 3.6.1 | keep |
| junit-jupiter, junit-platform-suite (test) | 5.14.4, 1.14.4 | 5.14.4, 1.14.4 | keep; declare directly used API and params artifacts explicitly |
| awaitility, commons-cli, jinjava (test) | 4.3.0, 1.11.0, 2.8.4 | 4.3.0, 1.11.0, 2.8.4 | keep |
| pbrawclient (test) | local.org.epics:0.2.1 | local.org.epics:0.2.1 | project-local Maven repository; no system scope |

Executed targets were checked against official Maven Central metadata on 2026-09-15; raw metadata and the actual resolved dependency list are retained under `/tmp/aa-m4.GlFhTyob/`. Transitive conflicts are aligned through dependencyManagement: SLF4J API 2.0.19, Commons Logging 1.4.0, checker-qual 3.32.0, error_prone_annotations 2.50.0, immutables-exceptions 1.9, and Jackson BOM 2.20.1, plus the shared Guava, Commons IO, Codec, and Lang versions above. The Jackson BOM preserves Jinjava's selected 2.20/2.20.1 family. Commons Logging supplies the JCL API and Log4j routing, so MariaDB's duplicate jcl-over-slf4j is excluded. FindBugs annotations already supplies javax.annotation classes, so Jinjava's duplicate jsr305 is excluded. No convergence or duplicate-class rule is suppressed.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner, 2026-09-12
Implementation Authorization: owner, 2026-09-15 (M4 execution)
Superseded Plan Artifacts: none

Targets measured on 2026-09-12 with `versions:display-dependency-updates -DallowMajorUpdates=false` (latest within the current major line); re-checked at execution, and the executed value is recorded as evidence.

Execution premise checked on 2026-09-15: the shipped pom also declares protobuf-java as [3.25.5,), resolved to 4.36.1 in the fresh-clone baseline. Pinning this third project range is required by the existing no-range completion criterion. A full-pom scan also found the Javadoc plugin repeating the Commons IO range; the plugin now shares fixed Commons IO and Lang properties with the project dependencies. The baseline source and pom are unchanged since that 749-test pass; test source changes are not needed for the dependency inventory.

0. Baseline before any change: run the unit set on the unchanged tree, `./mvnw -B test -Dgroups='!integration & !localEpics & !slow & !flaky'` (the 67 untagged JUnit 5 classes; the tagged sets need Tomcat or softIoc and belong to M8), and record pass, fail, and error counts. Only a change in that outcome counts against a version bump. Add build-time dependency-set checks that stay in the pom: maven-enforcer-plugin with dependencyConvergence and requireUpperBoundDeps, extra-enforcer-rules banDuplicateClasses, and dependency:analyze-only with failOnWarning for used-undeclared; run them on the unchanged tree first and record the baseline.
1. Pin the three ranges to their current resolution: guava `[32.0.0-android,)` to 33.7.1-jre, commons-io `[2.14.0,)` to 2.22.0, and protobuf-java `[3.25.5,)` to 4.36.1. Pin the Javadoc plugin declarations to the same fixed Commons IO and Lang properties. No range remains in project or plugin declarations.
2. Runtime and servlet line: tomcat-servlet-api 9.0.113 to the latest stable 9.0.x at execution (9.0.122 observed; the planned runtime fixture remains 9.0.121, D13). log4j api, core, jul, slf4j2-impl, 1.2-api 2.20.0 to 2.26.1 via the log4j.version property. disruptor: try 4.0.0 (log4j 2.26 supports the 4.x line); if the async logger fails at runtime, keep 3.4.4 and record why.
3. EPICS and appliance libraries: jca 2.4.10 to 2.4.12; core-pva 5.0.0 to 5.0.5; hazelcast 5.4.0 to 5.7.0 (cluster state; smoke-test appliance start after the bump).
4. Apache Commons and utilities: commons-lang3 3.12.0 to 3.20.0; commons-codec 1.15 to 1.22.1; commons-validator 1.7 to 1.11.0; commons-fileupload 1.5 to 1.6.0; opencsv 5.7.1 to 5.12.0.
5. Keep as recorded: httpclient 4.5.14 and httpcore 4.4.16 (last of the 4.x line); jython-standalone 2.7.3 (D15; 2.7.4 is the latest stable and may be taken if it builds, 2.7.5b1 is a beta and is excluded); mariadb-java-client 3.3.3 (removed by M13); jedis 4.4.0 (M12 decides); protobuf-java 4.36.1 (current); jdbm, jmatio, json-simple, commons-math3 unchanged.
6. Apply in the order above, one group per build: `./mvnw -B clean package -DskipTests` plus the enforcer and analyze checks after each group, then the unit set from step 0 at the end; on a failure, hold that group at its previous version, record the failure, and continue.
7. Tomcat 9 start smoke: run the `integration` tests that are not `localEpics` (`-Pintegration -Dtest.groups='integration & !localEpics'`, TomcatSetup-based) so the hazelcast, log4j, and disruptor bumps are exercised at appliance start. Host facts (2026-09-12): /opt/tomcat9 is Tomcat 9.0.113 owned by tomcat with an unreadable conf/ directory, so it cannot serve as TOMCAT_HOME for a user-run test; use a user-owned Apache Tomcat 9.0.121 unpacked under the scratch directory as TOMCAT_HOME (runtime fixture; the API dependency was rechecked as 9.0.122). If that cannot be arranged, record the smoke as deferred to M8, not as passed.
8. Record every executed version in the table above as evidence; confirm `dependency:list` shows no range and no system scope.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | ./mvnw -B clean package -DskipTests | JDK 21, wrapper Maven | Build succeeds with every version pinned |
| T2 | Unit | ./mvnw -B test -Dgroups='!integration & !localEpics & !slow & !flaky' | JDK 21, wrapper Maven | Same pass, fail, and error counts as the step 0 baseline or better |
| T3 | Static | enforcer (dependencyConvergence, requireUpperBoundDeps, banDuplicateClasses) and dependency:analyze-only failOnWarning | JDK 21, wrapper Maven | No convergence conflict, no duplicate class, no used-undeclared dependency |
| T4 | Integration | ./mvnw -B test -Pintegration -Dtest.groups='integration & !localEpics' | JDK 21, Tomcat 9.0.121 via TOMCAT_HOME | Appliance starts under TomcatSetup and the tests pass; deferred to M8 if no Tomcat 9 on the host |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-15 23:58:53 PDT | JDK 21.0.12.1, wrapper Maven 3.9.9 | Pass | Final `clean verify -DskipTests dependency:list dependency:tree` exited 0 in 21.786 s; documentation, four WARs, and release archive built. No open range or system scope remains. `/tmp/aa-m4.GlFhTyob/final-verify/` contains the pom, command, timestamps, and log. |
| T2 | 2026-09-15 23:57:56 PDT | JDK 21.0.12.1, wrapper Maven 3.9.9, Surefire 3.6.0 | Pass | `./mvnw -B -ntp test`: 67 classes, 749 tests, zero failures/errors/skips, exit 0, 13 min 44 s. `/tmp/aa-m4.GlFhTyob/final-unit/` retains the exact pom, log, timestamps, and reports. The subsequent Javadoc-only alignment leaves all project dependencies and dependencyManagement unchanged after property expansion. Unchanged baseline: 749/0/0/0 at 2026-09-15 23:15:20 PDT on eb047c57, `/tmp/aa-m8-fresh.K496KKtT/verification.json`. |
| T3 | 2026-09-15 23:58:53 PDT | JDK 21, wrapper Maven; test dependencies included | Pass | All three enforcer rules passed and analyze-only reported no dependency problems in `final-verify/maven.log`. Before library changes, `baseline-enforcer/` failed on 11 convergence conflicts, three upper-bound violations, and two duplicate-class groups; `baseline-analysis/` found three undeclared JUnit APIs and six runtime/aggregate false-positive unused declarations. Explicit API dependencies and specific runtime/aggregate analysis exceptions resolve the latter. |
| T4 | 2026-09-16 00:53:50 PDT | JDK 21.0.12.1, Maven 3.9.9, Surefire 3.6.0, Tomcat 9.0.121, EPICS 1.2.0 / base 7.0.10 | Pass | `test -Pintegration -Dtest.groups='integration & !localEpics'`: 27 classes, 45 tests, zero failures/errors/skips, exit 0, 53 min 45 s. Actual WARs, Tomcat, Java PVA servers, and required soft IOCs ran; no test or assertion changed. Evidence: `/tmp/aa-m4.GlFhTyob/final-integration/`. This tag selection includes IOC users such as DbdArchiveTest, so the established EPICS environment was sourced as well. |

Group evidence: `pinned-package/` passed before version upgrades. `runtime-package/`, `epics-package/`, and `utilities-package/` each completed compilation, documentation, WARs, and dependency analysis; their trailing enforcer checks retained baseline conflicts, with Commons Logging version convergence also reported after the utility refresh. `aligned-verify/` resolves all of these conflicts without suppressing rules. Archive inspection confirmed identical sets of 49 runtime libraries in all four WARs, the intended Log4j/Disruptor/SLF4J/JCA/PVA/Hazelcast/Jython versions, and no JUnit, jcl-over-slf4j, or jsr305 jars. All logs are under `/tmp/aa-m4.GlFhTyob/`.

Final verification: Maven summaries, XML suite totals, and individual testcase elements agree for both test selections, with 794 distinct tests and no overlap. The 749 unit test identities match the unchanged baseline. A read-only process check after completion found no owned Tomcat, softIocPVX, or Surefire process remaining. The integration run emitted the same native-stream warning observed in M8; its dumpstream is retained with the reports. Consolidated run evidence and the verified pom hash are in `/tmp/aa-m4.GlFhTyob/verification.json`.

##### Closure Evidence

- Local implementation satisfies the accepted scope and T1-T4 all passed. Source code and test assertions are unchanged.
- Complete 2026-09-16, implementation commit 977edf3d0f1bb12b0a5bb3a9793cb0dfcd0de868. Review confirmed the fixed versions, build and dependency checks, and recorded 794-test pass against the accepted scope; no blocking finding remains.
- Landing observed at 2026-09-16 15:08:52 UTC: after fetching origin, HEAD and origin/modernize both resolved to 977edf3d0f1bb12b0a5bb3a9793cb0dfcd0de868. Comparing that commit with origin/modernize for pom.xml and docs/milestone-daff1b7.md returned no difference. No linked issue or external gate is required for M4 closure.

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
Status: In progress

##### Summary

Build and test through the Maven Wrapper on GitHub Actions, and generate Javadoc and Sphinx documentation on Read the Docs. M5 implementation is delegated under D24.

##### Scope

One GitHub Actions workflow at `.github/workflows/maven.yml` builds and tests with `./mvnw -B -ntp clean verify` on JDK 21. It runs the default test selection, generates documentation and WARs, and checks dependencies. `.readthedocs.yaml` runs `compile javadoc:javadoc` through the same wrapper with JAVA_HOME set; compile generates the management mappings consumed by the Javadoc taglets.

Out of scope: publishing WAR artifacts as releases (owner decision pending).

##### Completion Criteria

- CI builds and tests run through mvnw on GitHub Actions, and readthedocs builds javadoc through mvnw.

##### Dependencies And Decisions

- D24 (delegated CI implementation, superseding D9's CI authorship restriction); D8.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner, 2026-09-16 (M5 scope and delegated execution)
Implementation Authorization: owner, 2026-09-16 (M5 execution)
Superseded Plan Artifacts: none

1. Add one workflow for push, pull_request, and workflow_dispatch. Use a read-only repository token, cancel superseded runs, and allow 45 minutes for the build. Fetch full history because the existing release-notes step reads origin/master.
2. Set up Temurin JDK 21 and Python 3.10 (matching Read the Docs), cache Maven and pip dependencies, and install the existing docs requirements. Pin official actions to the verified release commit: checkout v7.0.1, setup-java v6.0.1, setup-python v7.0.0, and upload-artifact v7.0.1.
3. Execute `./mvnw -B -ntp clean verify` with the pom's default test exclusions. Preserve Surefire reports for 14 days even on failure. Tomcat/IOC integration provisioning and release publishing remain outside this workflow.
4. Correct the Read the Docs version field to numeric 2 and run `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./mvnw -B -q compile javadoc:javadoc` before Sphinx. Require a nonempty `target/site/apidocs/index.html` because the existing pom tolerates Javadoc errors. Use Ubuntu 26.04 LTS as requested on 2026-09-16; retain the Python selection and docs requirements. The hosted OS remains to be verified by T2.
5. Validate workflow syntax and the Read the Docs schema, then execute the shipped commands in fresh checkouts. Record local environment differences and confirm generated outputs as well as exit codes.
6. After authorized commit and push, observe the GitHub Actions run for that revision. For Read the Docs, identify the project and follow the hosted verification procedure below. Keep M5 In progress until both real services pass.

###### Read the Docs hosted verification

- Dashboard: [Read the Docs project dashboard](https://app.readthedocs.org/dashboard/).
- Repository connection: not configured, as confirmed by the owner on 2026-09-16. No connected project URL is available. Project setup is required before T2.
- Expected source repository: `https://github.com/jeonghanlee/epicsarchiverap-maven` (an equivalent SSH URL is acceptable).
- Git branch to verify: `modernize`. Confirm the corresponding Read the Docs version in the project; do not infer it from the default `latest` version.

1. Complete project setup with the owner and connect the expected source repository. Sign in to the dashboard, open the project, and confirm its repository settings. Record the actual project URL and the connection observation date here. Keep T2 Pending until setup is complete.
2. In the project's Versions tab, locate the version backed by Git branch `modernize` and confirm that it is Active. Record the version URL or identifier here. If absent or inactive, resolve version setup before running T2. Read the Docs documents branch/version mapping and activation in [Versions](https://docs.readthedocs.com/platform/stable/versions.html).
3. Open the project's Builds page and select the build for that version and the exact pushed commit. If no matching build exists, keep T2 Pending until it is run. Check the commit hash, completed status, and success result; a successful build of another commit does not satisfy T2. The platform exposes these values in its [build details](https://docs.readthedocs.com/platform/stable/api/v3.html#build-details).
4. Read the build log and confirm that the configured Maven compile/Javadoc command, nonempty Javadoc index check, and Sphinx build succeeded. Record the project URL, version, build URL, full commit hash, completion time, and result in M5 / T2. Only then mark T2 Pass.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Trigger the workflow on a branch push | GitHub Actions | mvnw build and tests succeed |
| T2 | Integration | Follow the Read the Docs hosted verification procedure above for the pushed commit on modernize | Confirmed project and active version | Maven compile/Javadoc, index check, and Sphinx succeed; project/build URLs and commit are recorded |
| T3 | Static | actionlint and the official Read the Docs v2 JSON schema | Local validation tools | Workflow and configuration validate |
| T4 | Integration | Execute the workflow's pip install and clean verify commands in a fresh checkout | Local JDK 21, Python 3.13; hosted Python 3.10 checked by T1 | Default tests, docs, WARs, and dependency checks pass |
| T5 | Integration | Execute the Read the Docs pre_build command and Sphinx in a separate fresh checkout | Local JDK 21, Python 3.13; hosted Python 3.10 checked by T2 | Management mappings, Javadoc, and Sphinx output are generated without Javadoc errors |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | GitHub Actions | Pending | none |
| T2 | Not run | Read the Docs not connected; owner confirmation on 2026-09-16 | Pending | Complete project setup, record its URL, confirm the repository and active modernize version, then record the matching hosted build's URL, full commit hash, completion time, and result. |
| T3 | 2026-09-16 15:19 UTC | actionlint 1.7.12, official Read the Docs v2 JSON schema | Pass | actionlint exits 0; the Read the Docs configuration with the original Ubuntu 22.04 selection validates. The baseline string version fails the schema's numeric version constraint. Schema and tool checksum evidence are under /tmp/aa-m5.agygNtL7/. |
| T4 | 2026-09-16 15:31:25 UTC | Local JDK 21.0.12.1, Maven 3.9.9, Python 3.13.5 | Pass | Fresh checkout of 15892297: the workflow's pip install and clean verify commands exit 0. All 749 tests in 67 classes pass with zero failures/errors/skips; Maven takes 15 min 34 s wall time. Documentation, four WARs, all three enforcer rules, and dependency analysis pass. /tmp/aa-m5.agygNtL7/ci-result.json and ci-step-4.log retain the actual commands and results. |
| T5 | 2026-09-16 15:19:22 UTC | Local JDK 21.0.12.1, Python 3.13.5, Sphinx 7.2.6 | Pass | Fresh checkout of 15892297 plus the corrected commands (configuration still selected Ubuntu 22.04): compile/Javadoc, the output-file check, and Sphinx each exit 0. Management mappings, Javadoc index and scriptables, and Sphinx index are nonempty; no Javadoc error is present. Sphinx reports 45 existing document warnings. Actual commands and timestamps: /tmp/aa-m5.agygNtL7/rtd-final-result.json. |

Fresh-checkout baseline: the previous `javadoc:javadoc` command returned exit 0 despite a taglet FileNotFoundException for docs/api/mgmtpathmappings.txt, and generated no Javadoc index. The final output-file check exits 1 against that actual baseline and 0 against the corrected build. The fix runs the existing compile path to produce the required mappings; no fixture or generated file is substituted. Baseline evidence: /tmp/aa-m5.agygNtL7/rtd-baseline-pre-build-0.log. Local checks do not execute hosted setup actions or prove either hosted service passed.

Final audit: the XML suite totals and 749 testcase elements agree, and test identities match the M4 default-test baseline. The final workflow's pip and Maven commands match the executed snapshot; its report upload targets the generated Surefire directory. The current Read the Docs configuration differs from that snapshot only in build.os (Ubuntu 26.04 instead of 22.04). Its commands are unchanged; YAML parsing and the supported OS value were checked, but no Ubuntu 26.04 hosted build has run. Consolidated evidence and configuration hashes: /tmp/aa-m5.agygNtL7/verification.json.

##### Closure Evidence

- Local implementation and T3-T5 passed review on 2026-09-16. Commit, upstream landing, GitHub Actions T1, and hosted Read the Docs T2 remain pending; M5 remains In progress.

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
Status: In progress

##### Summary

Define the policy for selecting upstream changes since the fork base a81b5e4 and bring the core ones into aa-maven during Phase 1. Verified in a local clone of upstream (archiver-appliance/epicsarchiverap) on 2026-09-11: master f86b573 (2026-09-02) is exactly 565 commits past a81b5e4; releases 2.3.1, 2.4.0, and 2.4.1 (tag target committed 2026-07-21) fall in that range; upstream now tags weekly, builds with Gradle Kotlin DSL on a Java 25 toolchain, and runs jakarta on Tomcat 11, none of which is a target here (D13).

##### Scope

Establish which upstream change classes are picked (core features, bug fixes, CVE bumps) and which are skipped, produce the candidate list, and apply the accepted picks on the Maven build.

Out of scope: wholesale upstream merges (D1); build-system or servlet-API changes.

##### Completion Criteria

- A written pick/skip policy accepted by the owner.
- The accepted upstream changes are applied, build, and pass tests on the Maven build.

##### Dependencies And Decisions

- D1; D11; D25 (Phase 1).

##### Implementation Plan

Plan Status: accepted; application in progress
Plan Acceptance: Survey method and owner selection accepted 2026-09-16; ordered application plan recorded 2026-09-16 (25 units in four tiers, after the D26 and D27 exclusions); source-patch application authorized 2026-09-16
Implementation Authorization: Source-patch application authorized and underway from 2026-09-16, one unit at a time under owner direction; each unit is curated by hunk and compile-verified, with runtime verification deferred to the fixture environment. This supersedes D25's no-patch state.
Superseded Plan Artifacts: Initial six-candidate draft, superseded by the complete merge-unit survey

1. Follow EPICS-env `docs/upstream-fix-carry-procedure.md` for the full upstream range. Use the owner's merge-unit selection rule: 104 merge commits and one squash integration cover all 565 commits without duplication.
2. Classify actual diffs. Remove only exclusively documentation, CI or test changes; defer absent target implementations with prerequisites. Keep tool changes, refactors, formatting and features in the assessment. Preserve the Maven, Java 21 and Tomcat 9 adoption constraints.
3. Verify application and inspect build prerequisites. Give all surviving candidates to five independent reviewers in the owner-approved waves of three and two. Compute the eight per-axis medians and recommendation rule in code.
4. Present every score and dependency to the owner. The owner-confirmed set contains 25 PR units after the D26 and D27 exclusions; the ordered application list is recorded below.
5. After separate implementation authorization, reproduce accepted defects on the real code and shipped fixtures, apply the required source changes, and run only the focused regressions and affected existing tests. Broaden verification only for an observed failure or a newly affected path.

###### Complete merge-unit survey

The [decision evidence](archiverap-carry-d12382d1.md) covers aa-maven d12382d1 and upstream f86b5738e308e4482eb6dc8cf7aca852275cfcbc: 105 PR units, 19 exclusively documentation/CI/test exclusions, 14 absent-target deferrals, and 72 scoring candidates. All 565 commits are accounted for exactly once. Five independent reviewers supplied 360 assessments and 2,880 integer axis values. Code-computed per-axis medians place 21 PRs above at least one rule threshold and 51 below every threshold; all scores and raw vectors are retained in the evidence document. Owner decisions confirm 25 PRs for selective adoption after the D26 exclusions (PR429, PR458) and D27 (PR359), including the recorded re-review outcomes and PR400 adaptation; no source patch has been applied.

The panel is a static assessment with explicit reading and execution limits. Large formatting/generated/test/documentation payloads were not uniformly read line by line; source and lexical inspection do not establish runtime behavior. Candidate defects, platform conflicts and minimum prerequisites remain part of owner selection, including for rule-passing PRs.

Unmodified whole-PR application checks passed for 14 of 105 units. PR #409 then failed a bounded three-file compiler check on the missing `ConfigService.queryPVTypeInfos` API introduced by PR #368. The evidence document distinguishes these checks from complete project builds and runtime reproduction; the remaining dependency notes are static minimum requirements, not proven complete chains.

###### Ordered application plan

Owner-confirmed application order for the 25 retained units, grouped by adoption cost. Whole-PR application is not used; each unit is curated by hunk against the drifted fork tree and applied one at a time under separate source-patch authorization. Excluded during application review: PR429, PR458 (D26), PR359 (D27, superseded by fork commit 103dab65). This list is the fixed order; each unit's applied or skipped state is tracked in the Application status below, not here.

Tier A, independent (target files present, no missing prerequisite): 360, 364, 385, 396, 408, 417, 423, 433, 445, 454, 474, 481, 501, 516. `EPICS_V4_PV` is edited by 360, 454 and 516, so apply those in sequence with rebased context. PR474 touches documentation and takes a second-person pass before commit.

Tier B, in-set ordering (apply after the named unit): 425 after 417 (shared `EPICS_V3_PV`), 480 after 445 (shared `FieldValuesCache`), 505 after 501, 461 after 433 (`incoming2real`).

Tier C, PlainPB adaptation (retarget the upstream `plain/` paths onto the fork `PlainPB/` package): 452, 521, 400, 405 (after 385), 520. PR400 keeps the URI and URLKey change only; its reshard test hunk drops with PR429.

Tier D, missing-prerequisite adaptation: 448 (retrieval boundary fix; port the boundary logic into `PlainPB/FileBackedPBEventStream` without the absent FileInfo abstraction) and 527 (Jython classloader, engine-shutdown and static-to-instance fixes; the cluster-only peer-proxy timeout hunk is omitted).

###### Application status

Totals: 28 owner-confirmed, 3 excluded during application review, 25 retained. Applied 10 (compile-verified; runtime IOC verification pending the fixture environment), queued 8 for owner decision, pending 17. Each retained unit's applied or skipped status is recorded here as it proceeds through the Tier A to D order above. Regression after the Tier A and B applications: the non-IOC default suite ran 747 tests with zero failures; the single error is PvaTest, which needs a PVA soft IOC absent in this environment and is normally excluded from the default run. No regression is attributable to the applied changes; the applied units' own runtime behavior still awaits the fixture environment.

| Unit | Disposition | Reason | Decision |
| --- | --- | --- | --- |
| PR429 | Excluded | Single-instance: no appliance-to-appliance reassignment; ReassignAppliance absent | D26 |
| PR458 | Excluded | Redundant: fork ConvertPVNameToKey already prefers the stored PVTypeInfo chunkKey | D26 |
| PR359 | Excluded | Superseded: fork commit 103dab65 already fixes the alias-conversion bug with a retained guard | D27 |
| PR364 | Applied (semantic-only) | Alias/.NAME workflow enabled for PVAccess PVs: two usePVAccess short-circuits removed, MetaTest parameterized; spotless churn not adopted. test-compile pass. Runtime verified 2026-09-17: MetaTest passed both usePVAccess values (12 metadata completions) against real softIocPVX. Third-person review 2026-09-17: complete and faithful. Below-floor (owner nod): anonymous blocks and assertTrue kept | - |
| PR360 | Applied | EPICS_V4_PV connection-lifecycle fix: handleMonitor routes to handleDisconnected and returns on null data (was falling through to GotMonitor), centralized idempotent handleDisconnected, connected set under lock; log info to debug. build.gradle core-pva bump omitted (fork at 5.0.5). test-compile pass; runtime IOC pending | - |
| PR385 | Queued (owner decision) | Fork-diverged GetDataAtTime and FileStreamCreator conflict. 385 removes the Collections.reverse of datastores and adds a boundary iterator (new ArrayListEventStreamWithPositionedIterator) for the chunk-boundary value bug. Reconciling with the fork's reworked store iteration is a judgment call, and the fix is retrieval correctness needing IOC runtime verification unavailable here. All-or-nothing: partial apply of a boundary fix is unsafe | pending |
| PR396 | Queued (owner decision) | Conflict between the carry-doc acceptance (carry the bounded StaticContentServlet cleanup) and this session's formatting policy (do not adopt reformats, keep tab style). 396 is a 1025-line whole-file reformat to 4-space plus small lints (drop unused MimeResponse import, @Serial, final modifiers, EXPIRES constant). Applies clean. Owner reconciles: adopt whole as a bounded exception, or lint-only keeping tabs | pending |
| PR408 | Applied | Remove the redundant guarded startup loop that populates applianceAggregateInfo in DefaultConfigService; the aggregate is still built on the per-PV paths. test-compile pass; regression suite pending | - |
| PR417 | Applied | Lower the two EPICS_V3_PV post-stop and post-cleanup "ignoring monitor events" logs from error to debug; behavior unchanged. test-compile pass | - |
| PR423 | Applied | MetaInfo emits the array-count metadata key as EAA_COUNT instead of NELM (upstream #386). No in-tree consumer of the NELM key; external API readers of NELM are affected. test-compile pass | - |
| PR445 | Applied (semantic-only) | Guard a null cached value before putting it into the changed map in FieldValuesCache.getUpdatedFieldValues; reformat/import churn not adopted. test-compile pass | - |
| PR454 | Applied | Include the PV name in the EPICS_V4_PV monitor conversion error log. test-compile pass | - |
| PR481 | Applied | Remove the getPVNames function and its button from the mgmt static content (index.html, mgmt.js). No compiled code | - |
| PR516 | Applied | EPICS_V4_PV subscribes with RecordOptions.dbeMask(DBE_ARCHIVE); core-pva 5.0.5 provides the API (verified). libs.versions.toml hunk omitted. test-compile pass; runtime IOC pending | - |
| PR474 | Queued (owner decision) | Fork docs diverged (admin.md conflict) and the ProcessMgmtScriptables hunk is broader than the href-prefix change; low-value doc tooling needing a second-person doc pass. Owner decides scope | pending |
| PR501 | Queued (owner decision) | Fork ArrayListCollectorEventStream already tracks currentYear; 501 adds a ChangeInYearsException throw on year crossing, changing retrieval behavior that needs judgment on the fork's multi-year handling, plus PR489 import drift. PR505 depends on it | pending |
| PR425 | Applied | EPICS_V3_PV clears subscription and archive-field state inside a scheduled Runnable and drops the synchronized block around the field clear, per upstream disconnect handling. test-compile pass; runtime IOC pending | - |
| PR433 | Queued (owner decision) | Fork BulkPauseResumeUtils is restructured (realName resolved in a different loop; retValMap read via an extracted mainResponse), so the incoming2real alias mapping does not map onto it cleanly. PR461 depends on it | pending |
| PR480 | Applied (Replace of PR445 null path) | CI-2 owner decision Replace: adopt 480's shared null filter in FieldValuesCache.v3NamedValues (covers getUpdatedFieldValues and getCurrentFieldValues) plus containsKey in getUpdatedFieldValues, superseding PR445's narrower guard. EPICS_V4_PV log hunk excluded (piecemeal: one of five exception logs, unrelated to the null path). Verified 2026-09-17: FieldValuesCacheTest 10/10 including the new testNullValues (non-IOC); non-IOC regression 748 tests with no real failure (only the IOC-only PvaTest errors, normally excluded); ChangedFieldsTest passed against real softIocPVX (V4 field-change path). | - |
| PR461 | Queued (owner decision) | Depends on PR433 (incoming2real) and conflicts in the diverged PauseArchivingPV. Blocked until PR433 is resolved | pending |
| PR505 | Queued (owner decision) | Depends on PR501 (queued): consumes the ArrayListCollectorEventStream year-crossing wrapper | pending |

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Review | Owner selection from complete PR scores and prerequisites | decision evidence | Accepted PR set and named implementation scope |
| T2 | Regression | Reproduce accepted defects on real shipped paths, apply fixes, run affected tests | JDK 21, Maven Wrapper; real Tomcat/IOC fixture where required | Focused regression fails before correction and passes afterward; affected tests pass |
| T3 | Static / compiler | Enumerate and classify all PR units; check original diff application and build prerequisites | local Git objects and target fork d12382d1 | No omitted commits; explicit application results, prerequisites and limits |
| T4 | Independent review | Five reviewers assess the same 72 PRs; validate keys/axes and compute medians and OR rule | frozen candidate SHA256 and raw score files | Five complete independent score sets and a reproducible complete table |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-16 | decision evidence | Pass | Owner confirmed 28 PR units; the selected set and exceptions are recorded in archiverap-carry-d12382d1.md. Reduced to 26 on 2026-09-16 single-instance review (D26). |
| T2 | Not run | JDK 21, wrapper Maven | Pending | No source patch applied; no runtime reproduction. |
| T3 | 2026-09-16 | aa-maven d12382d1; upstream f86b5738 | Partial | All 565 commits mapped to 105 PR units; 105 original apply checks completed. PR #409 compiler check confirmed its missing method. Static minimum dependencies recorded; complete chain verification remains candidate-specific. |
| T4 | 2026-09-16 20:45 UTC | fixed 72-candidate set; five independent reviewers in two groups | Pass | Final raw files passed exact membership/hash/schema validation; panel.mjs computed all eight medians and the OR rule: 21 of 72 meet it. The complete table and 360 raw score vectors are in the decision evidence. This verifies score coverage/arithmetic, not runtime behavior or exhaustive line-by-line review. |

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
Status: Complete

##### Summary

Wire the test tree into Maven and rebuild the test selection the removed Gradle build had. Found 2026-09-12: the pom sets no testSourceDirectory and declares no JUnit dependency, so Maven has never compiled a single test (185 test sources under src/test/org and src/test/edu; Maven looked in src/test/java). The tests are JUnit 5 (151 classes) and already carry tags: integration 64, localEpics 49, slow 8, flaky 3; 67 classes are untagged and need no environment. Stage 1 (pulled forward as the prerequisite of M4) compiles the test tree and makes the untagged unit set the default `./mvnw test`; Stage 2 adds the Tomcat 9 and softIoc profiles.

##### Scope

Stage 1: testSourceDirectory and test resources, test-scope dependencies the tree needs (JUnit 5 with the platform suite, selenium-java and webdrivermanager for the browser tests, awaitility, jinjava for the AppliancesXMLGenerator helper), conversion of the one JUnit 4 suite (PvaTest.java) to a JUnit 5 suite, and Surefire configured so `./mvnw test` runs only the untagged set while `-Dgroups` can select the others. Stage 2: an `integration` profile that runs `integration & !localEpics` against a user-owned Tomcat 9.0.121 through TOMCAT_HOME, a `localEpics` profile that runs the softIoc-based tests with EPICS base on PATH, and the documented invocations.

Out of scope: CI wiring (M5); the pythontests scripts.

Selection and reinforcement (D17, D18): the platform keeps only the tests this site needs — kept: PlainPB and PB, ETL, retrieval with postprocessors, saverestore, Matlab export, zipfs compressed storage, mgmt (policies and PVA management API), config, common, engine including PVA (V4); dropped: retrieval/channelarchiver (migration from the 2011 Channel Archiver, not used; removed 2026-09-12). Selenium browser tests are rewritten to HTTP BPL calls (D22), dropping the browser dependency. Complete 2026-09-14: of the 29, 20 were rewritten to mgmt BPL HTTP (GetUrlContent plus Awaitility) and each verified by a real integration run on Tomcat 9.0.121 plus softIocPVX, never left green unrun; the other 9 (the multi-appliance cluster tests and the large-volume data tests) were deleted as out of scope for aa's single-instance platform (D23). With no Selenium consumers left, selenium-java and webdrivermanager were removed from the pom, and commons-compress — previously pulled in transitively through Selenium and used by the PB compression utilities — became an explicit test dependency. Rewriting the alias tests surfaced and fixed a real code defect: ConvertPVNameToKey.containsSiteSeparators used String.matches (whole-string anchor), so a multi-character PV name never matched the single-character separator class (for example `[\:\-]`), silently disabling the alias-to-real-name conversion in the archive workflow; changed to a precompiled find(), with a unit test. A light single-instance RenamePVTest (archive, pause, rename, confirm the data follows to the new name) replaces the deleted multi-year rename test. One pre-existing concurrency flake found while running the unit set (EventStreamWrapTest.testMultiThreadWrapper, the multi-threaded mean yields NaN intermittently) is tagged flaky so the default run excludes it, pending a fix. Reinforcement backlog on the kept tests, applied incrementally: Thread.sleep waits (253 calls in 56 files) replaced with Awaitility; hard-coded /scratch and /tmp paths replaced with @TempDir and a ConfigServiceForTests default under target; the static shared ConfigServiceForTests instances (8 files) isolated; a global JUnit timeout so a hang fails instead of blocking; the two-minute V4 tests tagged slow; JaCoCo coverage wired so the kept set is selected by measured coverage of the site's paths, not by folder name.

##### Completion Criteria

- Stage 1: `./mvnw test-compile` compiles every test source; `./mvnw test` runs the untagged set and its pass, fail, and error counts are recorded as the baseline; a fresh clone reproduces both.
- Stage 2: the `integration` and `localEpics` sets run through their profiles in the existing environment and their results are recorded.

##### Dependencies And Decisions

- D11 (Phase 1); D8 (current stable JUnit 5, Surefire, and test libraries, pinned and recorded at execution).
- Stage 1 is the prerequisite of M4 (its T2 and T4 need compiled tests); completion on 2026-09-15 satisfies that dependency. EPICS fixtures launch softIocPVX directly (D20), not through epics-ioc-runner.
- softIoc for Stage 2 (owner direction 2026-09-12, "make one easily"): no build was needed. The installed ALSU EPICS environment already provides it (EPICS base 7.0.10 on this Debian 13 host), activated through its setEpicsEnv.bash, which puts softIoc, softIocPVX, caget, and pvxget on PATH. Verified end to end: softIoc served a PINI ai record over CA on a pinned port (EPICS_CA_SERVER_PORT=5097, ADDR_LIST 127.0.0.1) and caget returned its value. SIOCSetup launches the PVA-enabled soft IOC from the same tree; per D20 it now launches softIocPVX (it launched softIocPVA before). Verified end to end on 2026-09-12 with the tree's setEpicsEnv.bash: CA with caget, PVA with pvxget (pvxs 1.5.1, NTScalar returned), for both softIocPVA and softIocPVX. Two operational facts the Stage 2 fixture must honor: the soft IOC needs stdin held open (SIOCSetup pipes it; with -S and closed stdin the main thread suspends on epicsThreadExitMain and PVA never answers), and port isolation must use the server-side variables EPICS_PVAS_SERVER_PORT, EPICS_PVAS_BROADCAST_PORT, and EPICS_PVAS_INTF_ADDR_LIST=127.0.0.1 on the IOC with the matching EPICS_PVA_BROADCAST_PORT and EPICS_PVA_ADDR_LIST on the client; client-style EPICS_PVA_* alone does not move the server, and the default 5076 search cannot see a loopback-only server (another PVA server already listens on this host's interface broadcast addresses). softIocPVX (pvxs 1.5.1, QSRV2) from the same tree is the fixture IOC (D19, site standard QSRV2): verified 2026-09-12 on the pinned ports — PVA answers pvxget with the full NTScalar (value 42) and CA answers caget, QSRV2 reports loaded and enabled, zero errors in the IOC log. SIOCSetup launches softIocPVX by name (D20); softIocPVA stays available in the tree as the QSRV1 compatibility fallback for any unconverted test. Stage 2 puts the tree's bin directories on PATH in the localEpics profile.
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
8. `localEpics` profile: softIocPVX from the EPICS environment on PATH (SIOCSetup launches it directly, D20); record results.
9. Document the three invocations in the developer guide (feeds M9). The standing platform document is TESTING.md at the repository root (layout, sets, fixture contracts, principles); M9 links it from the developer guide and keeps the two consistent.

Incremental reinforcement (accepted and authorized 2026-09-15)

10. Replace the fixed two-minute wait in PvaGetArchivedPVsTest with Awaitility polling of the real PVA status response, at one-second intervals with a two-minute timeout. Submit the archive request once and preserve both assertions over all 1,000 PV names and statuses. Run the unchanged and changed tests with the shipped TomcatSetup, SIOCSetup, and UnitTestPVs.db fixtures (T5).

Fixture failure handling (accepted and authorized 2026-09-15)

11. Make TomcatSetup reject failed startup and stop all owned processes before returning from cleanup. Cover an occupied HTTP port, cleanup after failure, and a subsequent real Tomcat start (T6).
12. Make the PVA retrieval and management test fixtures propagate setup failures and attempt every cleanup action after partial setup. Make IOC cleanup safe when startup did not create a process, and release the sample PVA client's resources on failure. Force a PVA discovery failure at a real UDP endpoint while running the shipped PvaGetPVDataTest setup and teardown (T7).
13. Compare the unchanged SampleV4PVAClientTest in the sandbox and on the host before changing PVA settings. Verify the affected PVA tests and following HTTP metrics test in a fresh host run, then rerun the localEpics profile (T8). Record execution-environment requirements in TESTING.md. For multiple Java PVA servers, add direct multicast through the loopback interface to the test discovery addresses and verify the real retrieval path with the shipped configuration.

Remaining failure fixes (accepted and authorized 2026-09-15)

14. Give each ETLSourceGetStreamsTest invocation a JUnit TempDir instead of the persistent ETLSrcStreamsTest directory. Keep the existing data and all seven partition assertions; run the shipped test repeatedly through the default forked Maven runner (T9).
15. Make TomcatSetup supply the test site's archappl.properties through ARCHAPPL_PROPERTIES_FILENAME, with an explicit JVM property override following its existing override convention. The default WAR contains secondsToBuffer=10, while the test site specifies 2; preserve MetricsTest's expected capacity of 3 and verify the complete real HTTP test (T10).
16. Run the default unit set and both complete profiles on the host after the focused checks. Record every failure and its actual cause, without weakening assertions or excluding failed tests (T2, T3, T4).

Full-run failure corrections within the authorized remaining-failure work

17. Restore ARCHAPPL system properties around test setup, execution, and teardown, including class-level setup and teardown. Preserve the values supplied before the test and remove values introduced by it. Verify the shipped persistence-changing tests followed by real Tomcat tests in the same JVM, then rerun the complete sets (T11, T2, T3, T4).
18. Make SIOCSetup receive the loopback multicast searches already sent by the saved client configuration. Verify the shipped PauseResumeV4Test with its IOC-before-Tomcat startup order; preserve the archive, pause, resume, and PVAccess assertions (T12).
19. Replace premature retrieval after restart in PVAEpicsIntegrationTest and PVAFlakyIntegrationTest with bounded polling of actual retrieved data. Require samples from the restarted IOC and retain the complete expected timestamp/value map for the Java PVA server. Preserve the intentional disconnect intervals and run both real tests (T13).
20. Resolve the failover data generators' work directories through TomcatSetup's configured base instead of hard-coded build/tomcats paths. Use the same path for fixture preparation, CATALINA_BASE, generated data, destination storage overrides, and verification. Preserve the real data generators and all retrieval/ETL assertions; run the affected shipped tests, then verify the complete sets after the shared-fixture correction (T14, T2, T3, T4).
21. Preserve the complete field and channel-filter suffix in PVNames.transferField when resolving a record name. Exercise the original implementation with regression cases for plain fields, implicit and explicit VAL filters, array modifiers, and aliases; confirm the defective cases fail before the correction. Rebuild the real WARs and run the shipped DbdArchiveTest with its three-event deadband assertion, then the complete sets (T15, T2, T3, T4).
22. Restore getDataAtTime support for stores without BiDirectionalIterable by using their shipped Reader last-known-value path. Preserve the reverse-iteration path, named flags, timestamp selection, and latest metadata from the preceding day. Verify real merge plugins with the existing PB metadata fixture before and after correction, then run unchanged FailoverScoreAPITest with two Tomcats and all 480 hourly value assertions (T16, T2, T3, T4).
23. Isolate DbdArchiveTest storage with a per-test JUnit TempDir supplied through its three ARCHAPPL storage properties. The Reader contract includes the last known value before the query interval, so retained samples from an earlier run must not enter this exact-count test. Preserve the real IOC updates and the expected three events; repeat the actual test, then complete integration verification (T17, T3).

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Static | ./mvnw -B test-compile in a fresh clone; count *.class under target/test-classes | JDK 21, wrapper Maven | Every shipped test source compiles and test resources are copied |
| T2 | Unit | ./mvnw -B test (default excludedGroups) | JDK 21, wrapper Maven | The untagged set runs (about 67 classes); counts recorded as baseline |
| T3 | Integration | ./mvnw -B test -Pintegration | JDK 21, Tomcat 9.0.121 via TOMCAT_HOME | Stage 2: integration set runs and results recorded |
| T4 | Integration | ./mvnw -B test -PlocalEpics | JDK 21, softIoc on PATH | Stage 2: localEpics set runs and results recorded |
| T5 | Integration | Package WARs, then ./mvnw -o -B test -Pintegration -Dtest=PvaGetArchivedPVsTest before and after the wait change | JDK 21, user-owned Tomcat 9.0.121, softIocPVX on PATH; shipped fixtures | Both runs execute one test with zero failures, errors, or skips; the changed test preserves the full PV-name and status assertions and polls until they hold |
| T6 | Integration | Run TomcatSetupTest against real WARs with an occupied HTTP port, then release it and start the same fixture again | JDK 21, Tomcat 9.0.121 | Old implementation fails the regression; fixed startup throws on failure, leaves no owned process, and permits a healthy restart |
| T7 | Integration | Run PvaGetPVDataFixtureTest with PVA searches directed to a real nonresponding UDP endpoint | JDK 21, Tomcat 9.0.121; actual PvaGetPVDataTest setup and teardown | Old teardown fails on a null channel; fixed teardown closes all resources, stops Tomcat, and tolerates repeated cleanup |
| T8 | Integration | Compare SampleV4PVAClientTest by execution environment; run affected PVA tests followed by MetricsTest; run localEpics profile | JDK 21, Tomcat 9.0.121 and softIocPVX, host execution | PVA connects in the supported environment, subsequent metrics start empty, and EPICS-only tests pass |
| T9 | Unit | Run ETLSourceGetStreamsTest twice with default Maven forking and existing storage retained | JDK 21, host execution | All seven partitions pass on each run with separate temporary storage |
| T10 | Integration | Run the unchanged MetricsTest against real WARs and softIocPVX after selecting test-site properties | JDK 21, Tomcat 9.0.121, host execution | All four WARs load test-site properties; capacity remains 3 and all metrics assertions pass |
| T11 | Integration | Run shipped persistence-changing tests and following Tomcat tests in the same JVM, then the complete profiles | JDK 21, real WARs, Tomcat 9.0.121, softIocPVX | Test settings are restored and later fixtures no longer load deleted DB paths |
| T12 | Integration | Run PauseResumeV4Test with its shipped IOC-before-Tomcat startup order | JDK 21, real WARs, Tomcat 9.0.121, softIocPVX | PVA discovery, archive, pause, and resume complete without changing assertions |
| T13 | Integration | Run PVAEpicsIntegrationTest and PVAFlakyIntegrationTest through actual stop, restart, and retrieval | JDK 21, real WARs, Tomcat 9.0.121, softIocPVX and Java PVA server | Restarted data is retrieved and all original count, type, timestamp, and value assertions hold |
| T14 | Integration | Run the affected failover and external-store tests with the real generators and saved Maven path configuration | JDK 21, real WARs, Tomcat 9.0.121 | Generated files and server storage resolve to the same configured directory; all original retrieval, merge, ETL, and score assertions pass |
| T15 | Unit and integration | Run transferField regression cases before and after the production correction; rebuild WARs and run DbdArchiveTest | JDK 21, Tomcat 9.0.121, shipped UnitTestPVs.db and softIocPVX | The real PV-name method preserves filters during name resolution; the actual filtered PV reaches Being archived and returns the original three expected events |
| T16 | Unit and integration | Run the existing PB metadata fixture through real merge plugins before and after correction, then rebuild WARs and run FailoverScoreAPITest | JDK 21, real PB files, real merge plugin, two Tomcats for the HTTP test | The requested value and latest metadata are returned without reverse-iteration support; all original HTTP value assertions pass |
| T17 | Integration | Give DbdArchiveTest independent temporary stores and repeat the original test with the real IOC and WARs | JDK 21, Tomcat 9.0.121, softIocPVX, JUnit TempDir | Every run returns exactly the original three events without retained data from another run; storage overrides are restored afterward |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-15 22:59:39 PDT | Fresh remote clone of eb047c576948ad2ee770cd1e0a3b74808b64bb2e; JDK 21.0.12.1, wrapper Maven 3.9.9, existing dependency cache | Pass | ./mvnw -o -B test-compile: exit 0 in 6.292 s. Real javac compiled 484 production and 176 test sources; 220 test class files were generated. Test data, test-site properties/policy/appliances XML, junit-platform.properties, and extension registration reached target/test-classes. The clone began clean with no target/ or build/. Evidence: /tmp/aa-m8-fresh.K496KKtT/test-compile.log and verification.json. The initial 2026-09-12 baseline compiled 185 test sources into 233 class files before the accepted test selection changes. |
| T2 | 2026-09-15 23:15:20 PDT | Same fresh clone and host toolchain as T1; Surefire 3.6.0, default selection, saved pom, existing Maven cache | Pass | ./mvnw -o -B test: 67 classes, 749 tests, zero failures/errors/skips; exit 0, 15 min 41 s. Maven summary, archived XML suite totals, and all 749 testcase elements agree. Includes all seven ETL partitions, ten field/filter regression cases, and five real merged-store metadata cases. HEAD remained eb047c576948ad2ee770cd1e0a3b74808b64bb2e and git status --porcelain --untracked-files=all remained empty. Evidence: /tmp/aa-m8-fresh.K496KKtT/unit.log, unit-reports/, and verification.json. The earlier working-tree 749-test pass remains under /tmp/aa-m8-complete.xrp4jyu7/; prior 734-test passes remain under /tmp/aa-m8-final.gcsqxo7c/ and /tmp/aa-m8-remaining.4CxTb4/. |
| T3 | 2026-09-15 22:41:17 PDT | JDK 21.0.12.1, Maven 3.9.9, Surefire 3.6.0, Tomcat 9.0.121, softIocPVX; host, fresh WARs, saved configuration | Pass | ./mvnw -o -B test -Pintegration: 63 classes, 98 tests, zero failures/errors/skips; exit 0, 2 h 29 min 46 s. Maven totals, all archived XML totals, and individual testcase counts agree. All six failover/external-store tests, PVA tests, persistence-changing sequences, MetricsTest, alias/field workflows, and DbdArchiveTest passed. Evidence: /tmp/aa-m8-dbd-isolation.15cg2nm4/integration.log, integration-reports/, and verification.json. The prior retained-data failure remains under /tmp/aa-m8-complete.xrp4jyu7/; earlier seven-failure and 2-failure/24-error runs remain under /tmp/aa-m8-final.gcsqxo7c/ and /tmp/aa-m8-remaining.4CxTb4/. |
| T4 | 2026-09-15 20:04:34 PDT | JDK 21.0.12.1, Maven 3.9.9, Surefire 3.6.0, softIocPVX from EPICS environment 1.2.0 (base 7.0.10); host, saved pom configuration | Pass | ./mvnw -o -B test -PlocalEpics: 11 classes, 26 tests, zero failures/errors/skips; exit 0, 11 min 36 s. Maven and all archived XML totals agree. Evidence: /tmp/aa-m8-complete.xrp4jyu7/localEpics.log, localEpics-reports/, and verification.json. The later T17 change is confined to DbdArchiveTest, which is excluded from this profile; all selected sources and shared fixtures remain unchanged. Prior full passes remain under /tmp/aa-m8-final.gcsqxo7c/ and /tmp/aa-m8-remaining.4CxTb4/. |
| T5 | 2026-09-15 00:15:10 and 00:18:12 PDT | JDK 21.0.12.1, Maven Wrapper 3.9.9, Tomcat 9.0.121, softIocPVX from EPICS environment 1.2.0 (base 7.0.10) | Pass | WAR package with -DskipTests -Dsphinx.skip=true succeeded; both real focused integration runs: 1 test, 0 failures, 0 errors, 0 skipped. Surefire archivedPVTest time: 120.958 s before, 81.792 s after; server log confirms repeated PVA status queries. Changed-test report: /tmp/aa-m8-full.U8c2kU/prior-reports/TEST-org.epics.archiverappliance.mgmt.pva.PvaGetArchivedPVsTest.xml; execution logs: /tmp/m8-pva-before.log and /tmp/m8-pva-after.log. Full-profile results are recorded separately in T3 and T4. |
| T6 | 2026-09-15 08:30:28 PDT | JDK 21.0.12.1, Maven 3.9.9, Tomcat 9.0.121; host execution, real packaged WARs | Pass | TomcatSetupTest failed against the original fixture (135.6 s: startup returned despite an occupied HTTP port). With the fix it passed in 46.17 s, covering rejected startup, termination, healthy restart, and repeated cleanup. Combined T6/T7 run: 2 tests, zero failures/errors/skips, exit 0. Logs: /tmp/aa-m8-fixture-fix.fPMaiu/fixture-{before,after}.log; reports in matching fixture-{before,after}-reports/ directories. |
| T7 | 2026-09-15 08:30:28 PDT | Same environment as T6; real nonresponding UDP endpoint and shipped retrieval fixture | Pass | PvaGetPVDataFixtureTest failed against original teardown with a null-channel exception (55.71 s). The changed fixture passed in 51.36 s: setup timed out as intended, teardown completed, the captured Tomcat process exited, and repeated cleanup succeeded. Evidence in the T6 logs and report directories. |
| T8 | 2026-09-15 09:14:18 PDT | Same host toolchain as T4; Tomcat 9.0.121 and aa-20260915-35282494 WARs for appliance tests | Fail | Final PVA/fixture run: 5 classes, 6 tests, zero failures/errors/skips, exit 0 at 09:02:11 PDT; real retrieval, both management tests, and both failure-cleanup regressions passed with the saved pom and no temporary JVM options. localEpics passed as T4 records. The earlier ordered PVA/HTTP run verified MetricsTest starts empty, but its buffer-capacity assertion failed (expected 3, actual 11); the subsequent correction is verified in T10. Logs and selected reports: /tmp/aa-m8-fixture-fix.fPMaiu/final-pva.log, final-pva-reports/, pva-functional.log, and pva-functional-reports/. |
| T9 | 2026-09-15 09:56:25 and 09:57:07 PDT | JDK 21.0.12.1, Maven 3.9.9, Surefire 3.6.0; host, default forked runner | Pass | The modified ETLSourceGetStreamsTest passed twice: 7 tests per run, zero failures/errors/skips, both exit 0. Earlier target/test-storage data remained present; each invocation used its own JUnit TempDir. Logs: /tmp/aa-m8-remaining.4CxTb4/etl-after-1.log and etl-after-2.log; matching report directories preserve both runs. |
| T10 | 2026-09-15 10:00:07 PDT | JDK 21.0.12.1, Maven 3.9.9, Tomcat 9.0.121, softIocPVX; host, real packaged WARs | Pass | The unchanged MetricsTest passed: 1 test, zero failures/errors/skips, exit 0. All four webapps logged the test-site properties path; actual PV details reported capacity 3 in all three snapshots and the retrieval metrics assertions passed. Log: /tmp/aa-m8-remaining.4CxTb4/metrics-after.log; report: metrics-after-reports/TEST-org.epics.archiverappliance.mgmt.MetricsTest.xml in the same directory. |
| T11 | 2026-09-15 16:49:58 PDT | Same host environment as T3 | Pass | Focused CnxLostTest then AppendAndAliasPVTest passed in one JVM (/tmp/aa-m8-followup.w9MAx0/). The subsequent complete integration run passed both CnxLostTest and InactiveClusterMemberArchivePVTest, plus every following fixture startup: zero errors across 98 tests. The default and localEpics sets also passed. The seven integration assertion failures are separately recorded in T14-T15. Evidence: /tmp/aa-m8-final.gcsqxo7c/verification.json, profile logs, and archived reports. |
| T12 | 2026-09-15 13:46:34 PDT | Same host environment as T3 | Pass | Unchanged PauseResumeV4Test passed in 158.044 s with IOC-before-Tomcat startup, real PVA discovery, archive, pause, and resume. The combined IOC check ran 2 tests with zero failures/errors/skips, exit 0. Evidence: /tmp/aa-m8-final.gcsqxo7c/focused.log and focused-reports/. The first multicast configuration's duplicate TCP bind and 549.283 s error remain preserved under /tmp/aa-m8-followup.w9MAx0/. |
| T13 | 2026-09-15 13:46:34 PDT | Same host environment as T3 | Pass | PVAEpicsIntegrationTest passed in 217.446 s, including actual IOC stop, 61-second disconnect, restart, and retrieval of more than five post-restart samples. Evidence: /tmp/aa-m8-final.gcsqxo7c/focused.log and focused-reports/. PVAFlakyIntegrationTest passed in 276.292 s, including its two-minute disconnect and all three expected timestamp/value entries; evidence: /tmp/aa-m8-followup.w9MAx0/focused.log and focused-reports/. The latter directory also preserves the failed intermediate IOC configuration. |
| T14 | 2026-09-15 17:09:05 PDT | Same host environment as T3, fresh WARs | Pass | Five path-corrected tests passed together: FailoverETLTest, FailoverUpgradeTest, FailoverMultiStepETLTest, FailoverRetrievalTest, and MergeDataFromExternalStoreTest. FailoverScoreAPITest passed generation and raw retrieval there, exposed T16, then passed all 480 original hourly HTTP assertions after that correction. Evidence: /tmp/aa-m8-path-filter.EbpbHW/failover.log, failover-reports/, and score-focused/verification.json with its score log/report. The original six null-stream failures remain under /tmp/aa-m8-final.gcsqxo7c/. All six also passed in the final complete integration run recorded in T3. |
| T15 | 2026-09-15 16:55:14 PDT | JDK 21.0.12.1, Tomcat 9.0.121, softIocPVX, fresh WARs; host execution | Pass | The original transferField method failed six of ten regression cases; after preserving the full field/modifier suffix, all 395 PVNameRegexTest cases passed. Unchanged DbdArchiveTest then passed in 148.2 s with freshly packaged WARs: actual filtered-PV archiving and all three events, zero failures/errors/skips. Evidence: /tmp/aa-m8-path-filter.EbpbHW/filter-before*, filter-after*, dbd.log, dbd-reports/, and verification.json. The original 645.9 s integration failure and invalid trailing-dot name remain in /tmp/aa-m8-final.gcsqxo7c/integration-reports/. Final complete-set passes after this correction are recorded in T2-T4. |
| T16 | 2026-09-15 17:09:05 PDT | JDK 21.0.12.1, Maven 3.9.9, shipped PB fixture, actual merge plugins, fresh WARs and two Tomcats | Pass | Before correction, all five merged-store cases returned no sample (five errors in the existing test helper). After correction, all ten direct/merged PB cases passed their timestamp and metadata assertions. Fresh-WAR FailoverScoreAPITest then passed all 480 hourly HTTP value assertions: 1 test, zero failures/errors/skips, exit 0. Evidence: /tmp/aa-m8-path-filter.EbpbHW/score-before*, score-after*, and score-focused/verification.json, score.log, score-reports/. The final full run also checks the generated PB value equals its timestamp in all ten metadata cases. |
| T17 | 2026-09-15 22:41:17 PDT | JDK 21.0.12.1, Maven 3.9.9, real WARs, Tomcat 9.0.121 and softIocPVX; host | Pass | DbdArchiveTest passed twice consecutively at 20:08:58 and 20:11:31 PDT, then passed in the complete integration run (146.017 s). All three executions preserved the original three-event assertion, with zero failures/errors/skips. Actual logs show distinct JUnit temporary STS/MTS/LTS roots; none remained after fixture cleanup. Evidence: /tmp/aa-m8-dbd-isolation.15cg2nm4/dbd-first.log, dbd-second.log, integration.log, their archived reports, and verification.json. The original retained fourth event remains recorded in /tmp/aa-m8-complete.xrp4jyu7/integration-reports/. |

Final complete-set verification (2026-09-15): the selected production code and shared fixtures passed T2-T4. The final source change affected only DbdArchiveTest, which is excluded from the default and localEpics sets; T3 reran the entire integration selection after that change. Independently summed XML suite attributes and testcase elements match all three Maven summaries. These selections overlap and must not be added as unique coverage. A read-only host process check at 22:41 PDT found no Tomcat, softIocPVX, or Surefire process owned by that run. The corrections were subsequently committed and pushed as eb047c57; T1 and T2 now also reproduce compilation and the default set from a fresh remote clone. Maven dependencies were reused from the existing cache; this verifies checkout completeness, not a fresh dependency cache or the separate M14 build-self-sufficiency scope.

Full-profile observations before fixture fixes (2026-09-15):

- The initial full-profile runs were sequential in the sandbox on HEAD 3528249462d54b295e9a9277882f7f3c0fc1cc62 with the uncommitted PvaGetArchivedPVsTest wait change and the packaged aa-20260915-35282494 WARs. The pom selects `integration OR localEpics` for T3 and `localEpics AND NOT integration` for T4; the default PvaTest suite exclusion remained active. The counts overlap and must not be added as unique coverage.
- T3 first errored in PvaGetPVDataTest.setup at the PVA management-channel connection. Its teardown then dereferenced the uninitialized retrieval channel before reaching Tomcat cleanup. Later Tomcat starts logged address-in-use errors, while requests were served by the earlier PvaGetPVDataTest appliance. At that revision, TomcatSetup ignored the false return from its two-minute startup latch wait. MetricsTest later expected zero PVs but received 23. These observations prevent treating downstream successes as independent fixture verification.
- PvaGetArchivedPVsTest failed in T3 because pvaMgmtService was not connected, before reaching the new polling block. The initial localEpics run completed at 04:55:45 PDT with 26 tests, zero failures, one error, and zero skips (exit 1, 13 min 15 s): SampleV4PVAClientTest.testGet timed out even after T3 exited. Evidence: /tmp/aa-m8-full.U8c2kU/localEpics.log and localEpics-reports/. T4 above records the subsequent successful host run.
- Read-only host process checks after each profile found no remaining test Tomcat, softIocPVX, or Surefire process. Recheck with `ps -eo pid,ppid,args`, identifying only the current run's processes. Generated test data under build/ and target/ was retained; no fixture code or profile selection was changed during these runs. Both runs emitted Surefire's native-stream warning; the dumpstream files are preserved with the reports.

Fixture and discovery verification (2026-09-15):

- The unchanged SampleV4PVAClientTest failed in the sandbox (2 tests, one connection error, 08:17:35 PDT) and passed on the host (2 tests, zero failures/errors, 08:18:09 PDT), with identical test and PVA address settings. Logs: /tmp/aa-m8-fixture-fix.fPMaiu/pva-before.log and pva-host.log; matching report directories preserve both results.
- The first ordered host run used repaired fixtures with unicast-only PVA discovery. It finished with 6 tests, one failure, and one error: retrieval setup still timed out when its additional Java PVA server started, both management tests and the sample PVA client passed, and MetricsTest started with zero PVs before failing the capacity assertion. No null-channel teardown error recurred.
- Adding direct multicast through loopback allowed the real retrieval test to complete both requests: 2 tests passed in the diagnostic run at 08:47:10 PDT. The saved pom then passed the final 6-test PVA/fixture run without temporary JVM options. Evidence: /tmp/aa-m8-fixture-fix.fPMaiu/pva-multicast.log, pva-multicast-reports/, final-pva.log, and final-pva-reports/.
- ETLSourceGetStreamsTest used a persistent ETLSrcStreamsTest directory and found prior-date files during the default unit run. A controlled comparison ran the unchanged shipped class through Maven with `-Dtest=ETLSourceGetStreamsTest -DforkCount=0`, using environment variables for the four storage roots. Fresh storage passed all 7 cases at 09:31:48 PDT; existing target/test-storage reproduced 5 failures out of 7 at 09:32:40 PDT. Both used the same launcher settings; only the storage roots differed. No internal test function or fixture was replaced, and existing data was retained. Logs: /tmp/aa-m8-fixture-fix.fPMaiu/etl-clean-storage.log and etl-existing-storage.log; matching report directories preserve both outcomes. The subsequent source fix and repeated default-runner verification are recorded in T9.

##### Closure Evidence

- Completion Date: 2026-09-15.
- Implementation Commit: eb047c576948ad2ee770cd1e0a3b74808b64bb2e, including the production corrections, test fixtures, regression cases, and test-platform documentation.
- Landing: at 23:16 PDT, git fetch origin succeeded; HEAD and origin/modernize both resolved to that implementation commit, and the committed implementation paths had no difference against the fetched upstream.
- Reproduction: a fresh clone from origin/modernize had no target/ or build/ before execution; T1 compiled every shipped test source and T2 passed 749 tests. Its HEAD and clean tracked/untracked status remained unchanged afterward. Evidence: /tmp/aa-m8-fresh.K496KKtT/verification.json, test-compile.log, unit.log, and unit-reports/.
- Full profiles: T3 passed all 98 integration tests and T4 passed all 26 localEpics tests on the source committed above. No required verification or external gate remains open for M8; it has no linked GitHub issue. M4 is now Ready.

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

#### M14 - Build self-sufficiency (no build-time network, pip, or scp)

Origin: daff1b7 / M14
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

The build reaches outside itself in three ways that break an offline or air-gapped build and violate D14 (small and strong): the package phase downloads the svg_viewer zip from GitHub, the sphinx step builds a Python venv and pip-installs on every build, and a local file copy is done with the scp executable.

##### Scope

Remove the build-time network fetch of svg_viewer (vendor the asset or make it an ordinary resolved dependency); make the sphinx documentation build opt-in or environment-provided rather than a per-build pip install; replace the scp invocation with a plain in-JVM or filesystem copy. After this, `./mvnw -B clean package -DskipTests` completes with no outbound network.

Out of scope: the Sphinx content itself (M9); the antrun executions as such (M10).

##### Completion Criteria

- A clean build with the network disabled produces the four WARs (offline-resolved dependencies aside).
- No build step invokes scp, downloads svg_viewer, or pip-installs.

##### Dependencies And Decisions

- D11 (Phase 1); D14 (small and strong).

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Vendor or dependency-resolve svg_viewer instead of downloading it.
2. Make sphinx opt-in (profile or provided environment), not a per-build pip install.
3. Replace scp with a filesystem copy.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Build with outbound network blocked | JDK 21, wrapper Maven, offline | Four WARs build; no network, scp, or pip step runs |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | offline | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Make the build self-sufficient (no build-time network, pip, or scp)
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M15 - Separate non-test utilities out of src/test

Origin: daff1b7 / M15
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

The test source tree holds 20 classes that are not tests but main() dev and data-generation utilities (for example GenerateData, Generate100KPerfHarness, GetFileTime, GZIPUtil, GenerateLargeDB). They are compiled with the tests and four of them carry hard-coded /scratch or /tmp paths. They are not run by Surefire but do not belong in src/test.

##### Scope

Move the main() utilities to a dedicated source location (a tools module or src/tools), or remove the ones with no current use; fix or drop the hard-coded /scratch and /tmp paths in the ones that are kept.

Out of scope: the actual @Test classes; the 17665 literal cleanup (M8 reinforcement).

##### Completion Criteria

- src/test contains only JUnit test classes and their support; the utilities live elsewhere or are removed; no kept utility carries a hard-coded absolute path.

##### Dependencies And Decisions

- D11 (Phase 1); D14.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Inventory the 20 main() utilities and their callers.
2. Move the kept ones out of src/test and drop the unused; fix absolute paths.
3. Confirm test-compile and the unit set are unaffected.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Static | Search src/test for `static void main` and absolute /scratch or /tmp paths | source tree | None remain under src/test |
| T2 | Unit | ./mvnw -B test | JDK 21, wrapper Maven | Same unit-set result as before the move |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | source tree | Pending | none |
| T2 | Not run | JDK 21, wrapper Maven | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Move non-test utilities out of the test source tree
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
