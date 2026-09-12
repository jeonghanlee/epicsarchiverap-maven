# Work Register

Release line: master
Milestone index: daff1b7
Canonical path: `docs/milestone-daff1b7.md`
Canonical branch or ref: modernize
Git upstream: origin/modernize
Remote tracker: jeonghanlee/epicsarchiverap-maven (aa-maven); GitHub issues per row once enabled, no GitHub milestone
Peer register: aa-env at jeonghanlee/epicsarchiverap-env, `docs/milestone-265f580.md` on branch modernize (cross-referenced per D2 and D3)

Next session entry point: owner rewrites .gitignore Maven-centric to close M1, then draft the M3 canonical-pom plan.

## Milestone

This register covers the minimal modernization of the existing Java appliance on its current architecture (D12): Phase 1 consolidates the build on Maven against Tomcat 9 and ends with Ant removal; Phase 2 replaces MariaDB with SQLite and prunes unused backends, so the appliance runs as WARs on Tomcat 9 under aa-env's systemd units with no external database. Tomcat 9 is fixed and names stay as they are (D13, D14). Everything beyond this, the architecture replacement, lives in the EPICS-Arche register. Every row follows D8 (stable, current technology) and D10 (small and strong).

### Work

| Group | ID | Work unit | Type | Status | Ready | Deps | Done when / Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Phase 1 | M1 | Gradle removal (complete erasure) | Milestone | In progress | No | | `git grep -i gradle` empty outside this register on a committed tree; [detail](#m1---gradle-removal-complete-erasure) |
| Phase 1 | M2 | Maven Wrapper as the build entry | Milestone | In progress | No | | `./mvnw -B clean package -DskipTests` builds four WARs from a fresh clone; [detail](#m2---maven-wrapper-as-the-build-entry) |
| Phase 1 | M3 | Canonical pom as single source of truth | Milestone | Not started | Yes | D6 | pom.xml self-sufficient for a clean build with no external copy; [detail](#m3---canonical-pom-as-single-source-of-truth) |
| Phase 1 | M4 | Dependency refresh to stable current versions | Milestone | Not started | No | M3 | Pinned current versions build and pass tests on Tomcat 9; [detail](#m4---dependency-refresh-to-stable-current-versions) |
| Phase 1 | M5 | Maven-centric CI and docs build | Milestone | Not started | Yes | | Owner-authored GitHub Actions on mvnw; readthedocs on mvnw; [detail](#m5---maven-centric-ci-and-docs-build) |
| Phase 1 | M6 | Upstream core features: cherry-pick policy and application | Milestone | Not started | Yes | | Policy accepted and selected upstream changes applied; [detail](#m6---upstream-core-features-cherry-pick-policy-and-application) |
| Phase 1 | M7 | Site-required features and fixes | Milestone | Not started | Yes | | Owner-identified items implemented and verified; [detail](#m7---site-required-features-and-fixes) |
| Phase 1 | M8 | Maven test platform | Milestone | Not started | Yes | | Unit and integration tests run under Maven against Tomcat 9; [detail](#m8---maven-test-platform) |
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
Status: In progress

##### Summary

The Apache Maven Wrapper is the build entry so no host needs a system Maven; aa-env sets its MAVEN_CMD to the wrapper and stops installing Maven. The wrapper files are committed (ff67460); a fresh-clone verification remains.

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
4. Verify from a fresh clone and close.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | ./mvnw -B clean package -DskipTests in this checkout | JDK 21, JAVA_HOME exported | Four WARs build; wrapper downloads Maven 3.9.9 |
| T2 | Integration | Same command from a fresh clone of the committed tree | JDK 21, JAVA_HOME exported | Four WARs build |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-11 | JDK 21.0.12.1, JAVA_HOME exported | Pass | Exit 0; distributionUrl apache-maven-3.9.9-bin.zip; WARs in target/ |
| T2 | Not run | fresh clone | Pending | none |

##### Closure Evidence

- none yet (pending T2)

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
Status: Not started

##### Summary

Make the tracked pom.xml the single build definition for aa-maven, so aa-env no longer overwrites a copied pom during `make init`. Fold in the system-scope removal and lib packaging of the lib/ jars.

##### Scope

Reconcile the aa-maven pom with the D6 base variant, remove system-scope local jar references in favor of a supported packaging path for lib/jamtio and lib/redisnio, and confirm a clean build needs no external pom copy.

Out of scope: version pin changes (M4); CI (M5).

##### Completion Criteria

- A clean checkout builds all four WARs from the tracked pom.xml with no external pom substitution.
- lib/jamtio and lib/redisnio are consumed through a packaging path that survives without a system-scope path.

##### Dependencies And Decisions

- D6; D8.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Merge the aa-maven pom to the D6 base and remove any external-copy dependency.
2. Rehome lib/jamtio and lib/redisnio off system scope.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | ./mvnw -B clean package on a fresh checkout with no pom copy | JDK 21, wrapper Maven | Four WARs build |
| T2 | Integration | Inspect built WARs for the lib jars | JDK 21, wrapper Maven | jamtio and redisnio present without a system-scope path |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, wrapper Maven | Pending | none |
| T2 | Not run | JDK 21, wrapper Maven | Pending | none |

##### Closure Evidence

- none

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

Set tomcat-servlet-api to the current 9.0.x, refresh log4j, mariadb-java-client, jca, commons-* and guava to current stable releases, and pin every range to a fixed version. Record the chosen versions as evidence. Upstream's catalog on 2026-09-02 (jca 2.4.12, log4j 2.20.0, mariadb 3.3.3, protobuf-java 4.33.0, junit 5.9.3) is a reference point, not a target.

Out of scope: adding sqlite-jdbc (M11).

##### Completion Criteria

- All dependencies are pinned to fixed, current stable versions (no open ranges) and the build passes tests.

##### Dependencies And Decisions

- M3 (refresh applies to the canonical pom); D8; D13.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Determine the current stable release of each dependency at execution time and update the version properties.
2. Pin guava and commons-* to fixed versions.
3. Build and run tests; record the versions.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | ./mvnw -B clean package | JDK 21, wrapper Maven | Build succeeds with pinned versions |
| T2 | Unit | ./mvnw -B test | JDK 21, wrapper Maven | Tests pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, wrapper Maven | Pending | none |
| T2 | Not run | JDK 21, wrapper Maven | Pending | none |

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
Status: Not started

##### Summary

Rebuild the test platform on Maven. The removed Gradle build carried categorized test tasks (unit, epics, integration, flaky), a `testRun` development server, and a Tomcat shutdown helper; none of that exists under Maven. Phase 1 needs a Maven-native way to run unit tests, EPICS-dependent tests, and Tomcat 9 integration tests in the existing environment.

##### Scope

Surefire for unit tests and Failsafe (or an equivalent current-stable mechanism) for integration tests, JUnit 5 tags or profiles to select unit, EPICS, and integration sets, and a documented way to run the integration set against a local Tomcat 9.

Out of scope: CI wiring (M5).

##### Completion Criteria

- `./mvnw test` runs the unit set; a documented invocation runs the EPICS and Tomcat 9 integration sets; each set passes in the existing environment.

##### Dependencies And Decisions

- D11 (Phase 1); D8 (current stable JUnit 5 and Surefire/Failsafe).

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Inventory the existing tests and their environment needs (none, EPICS, Tomcat).
2. Define the tag or profile split and configure Surefire/Failsafe.
3. Run each set in the existing environment and record results.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit | ./mvnw test | JDK 21 | Unit set passes |
| T2 | Integration | Documented integration invocation | JDK 21, EPICS, Tomcat 9 | EPICS and Tomcat sets pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21 | Pending | none |
| T2 | Not run | JDK 21, EPICS, Tomcat 9 | Pending | none |

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
