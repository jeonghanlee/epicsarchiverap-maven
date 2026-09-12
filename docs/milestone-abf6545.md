# Work Register

Release line: master
Milestone index: abf6545
Canonical path: `docs/milestone-abf6545.md`
Canonical branch or ref: modernize
Git upstream: origin/modernize
Remote tracker: jeonghanlee/epicsarchiverap-maven (aa-maven); GitHub issues per row once enabled, no GitHub milestone
Peer register: aa-env at jeonghanlee/epicsarchiverap-env, `docs/milestone-265f580.md` on branch modernize (cross-referenced per D2 and D3)
Peer register: EPICS-Arche (session OFFICE-EPICS-Arche), path pending its creation; carries Phase 3 and later per D22

Next session entry point: re-apply the lost working-tree changes of M7 (Gradle, CI, docker, legacy README removal; docs and readthedocs rewrite) on the owner's go, run a second-person pass on the docs, then commit them together with this register and the M15 wrapper files.

## Milestone

This register covers the existing Java appliance through two phases, carried in the `Group` column (D22): Phase 1 modernizes the build on Maven against the existing Tomcat 9 environment and ends with Ant removal; Phase 2 keeps the WARs on Tomcat 9 (D24) and closes with SQLite replacing MariaDB and the backend pruning, leaving no external database; aa-env runs the result under systemd, and artifact and configuration names stay as they are (D25). The Tomcat 11 migration and the embedded-runtime idea are retired (D23, D24) because the EPICS-Arche architecture replaces the runtime altogether. Phase 3 and later (architecture replacement, new engine, API, MCP, viewer) live in the EPICS-Arche register. Every row follows D11 (stable, current technology) and D14 (small and strong).

### Work

| Group | ID | Work unit | Type | Status | Ready | Deps | Done when / Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline | M1 | Baseline deployment tag NewHope on abf6545 | Milestone | Complete | No | | Annotated tag on origin peeling to abf6545; [detail](#m1---baseline-deployment-tag-newhope) |
| Phase 1 | M7 | Gradle removal (complete erasure) | Milestone | In progress | No | | `git grep -i gradle` empty outside this register, committed; [detail](#m7---gradle-removal-complete-erasure) |
| Phase 1 | M15 | Maven Wrapper as the build entry | Milestone | In progress | No | | mvnw committed, pinned Maven version builds all WARs; [detail](#m15---maven-wrapper-as-the-build-entry) |
| Phase 1 | M2 | Canonical pom as single source of truth | Milestone | Not started | Yes | D8 | pom.xml self-sufficient for a clean build with no external copy; [detail](#m2---canonical-pom-as-single-source-of-truth) |
| Phase 1 | M3 | Dependency refresh to stable current versions | Milestone | Not started | No | M2 | Pinned current versions build and pass tests; [detail](#m3---dependency-refresh-to-stable-current-versions) |
| Phase 1 | M5 | Maven-centric CI and docs build | Milestone | Not started | Yes | | Owner-authored GitHub Actions on mvnw; readthedocs on mvnw; [detail](#m5---maven-centric-ci-and-docs-build) |
| Phase 1 | M9 | Upstream core features: cherry-pick policy and application | Milestone | Not started | Yes | | Policy accepted and selected upstream changes applied; [detail](#m9---upstream-core-features-cherry-pick-policy-and-application) |
| Phase 1 | M10 | Site-required features and fixes | Milestone | Not started | Yes | | Owner-identified items implemented and verified; [detail](#m10---site-required-features-and-fixes) |
| Phase 1 | M13 | Maven test platform | Milestone | Not started | Yes | | Unit and integration tests run under Maven against Tomcat 9; [detail](#m13---maven-test-platform) |
| Phase 1 | M14 | Documentation for the Maven build | Milestone | Not started | Yes | | Build, test, and deploy docs match the Maven-only reality; [detail](#m14---documentation-for-the-maven-build) |
| Phase 1 | M4 | Ant removal: final Maven-only consolidation | Milestone | Deferred | No | D9 | build.xml gone and antrun executions rehomed; only Maven remains; [detail](#m4---ant-removal-final-maven-only-consolidation) |
| Phase 2 | M6 | jakarta.servlet migration for Tomcat 11 | Milestone | Complete | No | | Retired by D24 on 2026-09-11, no deliverable; [detail](#m6---jakartaservlet-migration-for-tomcat-11) |
| Phase 2 | M16 | Embedded Tomcat runnable jars | Milestone | Complete | No | | Retired by D23 on 2026-09-11, no deliverable; [detail](#m16---embedded-tomcat-runnable-jars) |
| Phase 2 | M8 | sqlite-jdbc runtime dependency | Milestone | Not started | Yes | | SQLite persistence path works at runtime; [detail](#m8---sqlite-jdbc-runtime-dependency) |
| Phase 2 | M11 | Persistence and storage backend pruning | Milestone | Not started | Yes | | Owner-approved backends removed, build and tests pass; [detail](#m11---persistence-and-storage-backend-pruning) |
| Phase 2 | M17 | MariaDB dependency removal | Milestone | Not started | No | M8 | No mariadb-java-client dependency; SQLite is the configuration store; Phase 2 closes here; [detail](#m17---mariadb-dependency-removal) |
| Tracking | G1 | aa-maven GitHub issues enabled | External gate | Open | No | | Repository setting has_issues=true; [detail](#g1---aa-maven-github-issues-enabled) |

### Decisions

| ID | Decision | Decision Date |
| --- | --- | --- |
| D1 | aa-maven is maintained independently; no further upstream merges. It left the GitHub fork network. | 2026-09-11 |
| D2 | Two-session split: aa-maven owns this repository and register, aa-env owns its own. Cross-references use canonical path plus local ID; each M row gets an issue in its own repository. | 2026-09-11 |
| D3 | Issue location shape 1: aa-maven keeps its own issues and register here; aa-env keeps its own. Registers cross-link by issue URL. | 2026-09-11 |
| D4 | Repository names: aa-maven = jeonghanlee/epicsarchiverap-maven, aa-env = jeonghanlee/epicsarchiverap-env. The project name EPICS Arche (repository slug epics-arche) is under consideration for the rename; not yet applied. | 2026-09-11 |
| D5 | Deployment baseline is abf6545 as-is, frozen by annotated tag NewHope. | 2026-09-11 |
| D6 | Tomcat 11 is the servlet target; tomcat-servlet-api 9.0.121 is an interim step on Tomcat 9. Superseded by D24. | 2026-09-11 |
| D7 | sqlite-jdbc runtime support stays in Backlog for now. Superseded by D10 and D22. | 2026-09-11 |
| D8 | The canonical pom base variant is aa-env's tracked pom.xml (tomcat-servlet-api 9.0.113, commons-lang3 3.12.0, guava range). | 2026-09-11 |
| D9 | Ant removal (M4) is deferred; it runs last in Phase 1, after the other build work completes, as the final move to a Maven-only build. | 2026-09-11 |
| D10 | Phase plan. Phase 1: Maven modernization on the existing Tomcat 9 environment (Gradle erasure, canonical pom, dependency refresh, upstream core features, site-required features, Maven test platform, documentation, then Ant removal), tested in the existing environment; aa-env implements the runtime as systemd template units. Phase 2: Tomcat 11 with embedded runnable jars (jakarta migration included). Phase X: an independent track holding persistence modernization (MariaDB removal, SQLite, backend pruning), API performance rework, an MCP server, and web viewer modernization. The mgmt UI rewrite stays in Backlog. Phase placement superseded by D22. | 2026-09-11 |
| D11 | Modernization principle: use stable, current technology throughout. Each row's plan selects the current stable release of its toolchain and libraries at execution time and records the chosen versions as evidence. | 2026-09-11 |
| D12 | Embedded Tomcat runnable jars (aa-env request) are adopted as Phase 2 work: one launcher per component on tomcat-embed-core, packaged as `java -jar` artifacts, with a runtime contract published to aa-env. Superseded by D23. | 2026-09-11 |
| D13 | Gradle is removed ahead of the CI and jakarta work, not after them. CI is rewritten by the owner as Maven-centric; the docker tree and top-level Dockerfile are removed as unused; the legacy upstream README is removed since README.md is the Maven README. | 2026-09-11 |
| D14 | Design principle: small and strong. Minimize dependencies, components, and languages; never concede performance or robustness. | 2026-09-11 |
| D15 | Platform breadth is not the goal. The core stays small (archive and retrieve); capability is exposed to agents and clients through the API and an MCP server rather than built into the platform. | 2026-09-11 |
| D16 | Phase order: Phase 1, Phase 2, Phase X pre-3, Phase 3, Phase X post-3. Superseded by D22. | 2026-09-11 |
| D17 | Phase 3 is an architecture replacement, not a modernization of the existing design. Replaced: file-based per-PV single-owner PB storage with STS/MTS/LTS ETL tiering, the four-webapp HTTP topology, and the MariaDB plus in-memory cluster state. Carried by the EPICS-Arche register (D22). | 2026-09-11 |
| D18 | Phase 3 storage: Parquet files on disk, time-partitioned and PV-sorted, with Arrow types including nested list and struct columns for arrays and structures, queried in-process by DuckDB; no database server. QuestDB is the fallback if the benchmark shows Parquet direct writes cannot sustain site ingestion. Carried by the EPICS-Arche register (D22). | 2026-09-11 |
| D19 | PB is dropped as the storage format and kept only as a retrieval compatibility facade (getData.raw, PB over HTTP) for Phoebus and existing clients. The primary API serves Arrow or JSON streaming. Carried by the EPICS-Arche register (D22). | 2026-09-11 |
| D20 | A full rewrite is permitted, engine included, with the engine last. Engine behaviors are extracted as a specification from the existing engine (about 8k lines in engine/pv, epics, model, metadata) and the new engine is accepted only on a parity test against the current one. Carried by the EPICS-Arche register (D22). | 2026-09-11 |
| D21 | Languages for the new architecture: engine in C++ on pvxs (PVA) plus an in-house thin C++ RAII wrapper over libca (CA), per-PV protocol explicit by prefix; services (retrieval API, management, MCP) in Go; web viewer in TypeScript. Java remains only for the existing appliance through Phases 1 and 2. Carried by the EPICS-Arche register (D22). | 2026-09-11 |
| D22 | Phase 2 closes with SQLite: M8 (sqlite-jdbc), M11 (backend pruning), and M17 (MariaDB removal) move into Phase 2, so Phase 2 ends with no external database. Phase 3 and later (M21-M27, M18-M20, and Backlog M12) are transferred to the EPICS-Arche repository and its register; this register ends at Phase 2. | 2026-09-11 |
| D23 | Embedded Tomcat runnable jars (M16) are retired: the existing appliance stays WARs on an external Tomcat through Phase 2 (version fixed by D24), and the runtime is replaced altogether by the EPICS-Arche architecture. Supersedes D12; aa-env's plan to stop installing Tomcat before Arche is withdrawn on the aa-maven side. | 2026-09-11 |
| D24 | Tomcat 9 is fixed for the existing appliance through the end of Phase 2; the jakarta/Tomcat 11 migration (M6) is retired. tomcat-servlet-api tracks the current 9.0.x as a final value, not an interim. Phase 2 end state: WARs on Tomcat 9, run by aa-env under systemd template units, with SQLite (sqlite3) as the only store. Supersedes D6. | 2026-09-11 |
| D25 | Naming stays as it is through Phase 2: artifact names archappl-<version>-<component>.war, ARCHAPPL_* variables, and the instance layout are not renamed, so aa-env's templates need no naming change. | 2026-09-11 |

### Assignment History

| Work Identity | From Canonical | To Canonical | Target Commit | Authority Moved At |
| --- | --- | --- | --- | --- |
| M8 sqlite-jdbc runtime dependency | Backlog, `docs/milestone-abf6545.md`, modernize | Milestone (Phase 2), same path and branch | pending register commit | D10, D22, 2026-09-11 |
| M9 Upstream cherry-pick policy and first pass | Backlog, `docs/milestone-abf6545.md`, modernize | Milestone (Phase 1), same path and branch | pending register commit | D10, 2026-09-11 |
| M10 Independent fork bug fixes | Backlog, `docs/milestone-abf6545.md`, modernize | Milestone (Phase 1), same path and branch | pending register commit | D10, 2026-09-11 |
| M11 Persistence and storage backend pruning | Backlog, `docs/milestone-abf6545.md`, modernize | Milestone (Phase 2), same path and branch | pending register commit | D10, D22, 2026-09-11 |
| M12 Management web interface rewrite | Backlog, `docs/milestone-abf6545.md`, modernize | EPICS-Arche register (path pending its creation) | pending target commit | D22, 2026-09-11; not moved until the target reports its path and ID |
| M18 API performance rework | Milestone, `docs/milestone-abf6545.md`, modernize | EPICS-Arche register (path pending) | pending target commit | D22, 2026-09-11; not moved until the target reports |
| M19 MCP server for archived data | Milestone, `docs/milestone-abf6545.md`, modernize | EPICS-Arche register (path pending) | pending target commit | D22, 2026-09-11; not moved until the target reports |
| M20 Web viewer modernization | Milestone, `docs/milestone-abf6545.md`, modernize | EPICS-Arche register (path pending) | pending target commit | D22, 2026-09-11; not moved until the target reports |
| M21 Storage benchmark and selection | Milestone, `docs/milestone-abf6545.md`, modernize | EPICS-Arche register (path pending) | pending target commit | D22, 2026-09-11; not moved until the target reports |
| M22 Storage and query layer | Milestone, `docs/milestone-abf6545.md`, modernize | EPICS-Arche register (path pending) | pending target commit | D22, 2026-09-11; not moved until the target reports |
| M23 Retrieval API and PB compatibility facade | Milestone, `docs/milestone-abf6545.md`, modernize | EPICS-Arche register (path pending) | pending target commit | D22, 2026-09-11; not moved until the target reports |
| M24 Engine policy specification | Milestone, `docs/milestone-abf6545.md`, modernize | EPICS-Arche register (path pending) | pending target commit | D22, 2026-09-11; not moved until the target reports |
| M25 New engine on pvxs and libca | Milestone, `docs/milestone-abf6545.md`, modernize | EPICS-Arche register (path pending) | pending target commit | D22, 2026-09-11; not moved until the target reports |
| M26 Management and configuration service | Milestone, `docs/milestone-abf6545.md`, modernize | EPICS-Arche register (path pending) | pending target commit | D22, 2026-09-11; not moved until the target reports |
| M27 Legacy PB archive access | Milestone, `docs/milestone-abf6545.md`, modernize | EPICS-Arche register (path pending) | pending target commit | D22, 2026-09-11; not moved until the target reports |

### Milestone Details

#### M1 - Baseline deployment tag NewHope

Origin: abf6545 / M1
Identity History: none
GitHub Issue: none
Status: Complete

##### Summary

The deployment freeze point for aa-maven. aa-env pins SRC_TAG to this tag so the middleware deployment builds from a fixed source state.

##### Scope

Create and publish one annotated tag NewHope on commit abf6545.

Out of scope: any source change on abf6545; release note authoring; artifact publishing.

##### Completion Criteria

- An annotated tag named NewHope exists on origin and peels to commit abf6545.

##### Dependencies And Decisions

- D5.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner, 2026-09-11
Implementation Authorization: owner tag-push delegation, 2026-09-11
Superseded Plan Artifacts: none

1. Create the annotated tag on abf6545 with a freeze message.
2. Push the tag to origin after the tag-push preflight.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | git ls-remote --tags origin refs/tags/NewHope | origin | Remote tag object id equals the local annotated tag object id, peeling to abf6545 |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-11 | origin | Pass | Remote refs/tags/NewHope = ffbea94 (annotated), peels to abf6545; equals local tag object id |

##### Closure Evidence

- Tag-push preflight passed and the pushed remote tag object id matched the local tag; peeled commit abf6545 is contained in origin/master.

##### GitHub Projection

Title: Baseline deployment tag NewHope on abf6545
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M7 - Gradle removal (complete erasure)

Origin: abf6545 / M7
Identity History: none
GitHub Issue: none
Status: In progress

##### Summary

Erase Gradle from the repository completely: build files, CI consumers, docker scaffolding that ran Gradle, documentation that described the Gradle workflow, and ignore rules. The goal is `git grep -i gradle` returning nothing outside this register. The removal and the docs rewrite were executed in the working tree on 2026-09-11 and then lost, before commit, to an assistant-run `git reset --hard` during an unrelated applicability check; they are to be re-applied on the owner's go.

##### Scope

Remove build.gradle, gradlew, gradlew.bat, and gradle/; remove the two Gradle-driven GitHub Actions workflows; remove the docker tree and top-level Dockerfile (unused, D13); remove the legacy upstream README; rewrite developersguide.md and customization.md to the Maven build; point .readthedocs.yaml at the Maven javadoc goal; strip Gradle rules from .gitignore (owner-authored rewrite).

Out of scope: writing the new CI (M5); Ant removal (M4).

##### Completion Criteria

- `git grep -i gradle` returns only this register, on a committed tree.
- The Maven build and the readthedocs javadoc step succeed with no Gradle artifact present.

##### Dependencies And Decisions

- D13 (Gradle removed first; docker and legacy README removed; CI rewritten by the owner).

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner, 2026-09-11
Implementation Authorization: owner, 2026-09-11 (delete instructions in session)
Superseded Plan Artifacts: none

1. Remove the Gradle build files, the two workflows, the docker tree, the top-level Dockerfile, and the legacy README. Executed 2026-09-11, lost before commit; re-apply.
2. Rewrite the developer and customization docs and the readthedocs pre_build to Maven. Executed 2026-09-11, lost before commit; re-apply.
3. Owner rewrites .gitignore Maven-centric. Pending.
4. Commit after a second-person pass on the rewritten docs.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Static | git grep -il gradle | committed tree | Only docs/milestone-abf6545.md |
| T2 | Integration | ./mvnw -B clean package -DskipTests | JDK 21, wrapper Maven | Four WARs build with no Gradle file present |
| T3 | Integration | ./mvnw -B -q javadoc:javadoc | JDK 21, with and without JAVA_HOME | Exit 0, target/site/apidocs produced |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-11 | working tree before the reset | Partial | Remaining hits were .gitignore (owner rewrite pending) and this register; the tree has since reverted and must be re-checked after re-application |
| T2 | 2026-09-11 | JDK 21.0.12.1, Maven 3.9.9 via mvnw | Pass | target/archappl-2025-6-{engine,etl,mgmt,retrieval}.war |
| T3 | 2026-09-11 | JDK 21, JAVA_HOME set and unset | Pass | Exit 0 both runs, target/site/apidocs present |

##### Closure Evidence

- none yet (pending re-application, .gitignore rewrite, and commit)

##### GitHub Projection

Title: Remove Gradle completely from the repository
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M15 - Maven Wrapper as the build entry

Origin: abf6545 / M15
Identity History: none
GitHub Issue: none
Status: In progress

##### Summary

Add the Apache Maven Wrapper so no host needs a system Maven; the documented build entry is `./mvnw -B clean package -DskipTests`. aa-env sets its MAVEN_CMD to the wrapper and stops installing Maven. The wrapper files exist untracked in the working tree and survived the 2026-09-11 reset.

##### Scope

Generate mvnw, mvnw.cmd, and .mvn/wrapper/maven-wrapper.properties with the official wrapper plugin, pinned to the Maven version the build is verified with.

Out of scope: pom changes (M2); CI (M5).

##### Completion Criteria

- The wrapper files are committed and `./mvnw -B clean package -DskipTests` builds all four WARs from a clean checkout.

##### Dependencies And Decisions

- D11 (current stable Maven 3.9 line); aa-env gate G8 references this row.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner, 2026-09-11
Implementation Authorization: owner, 2026-09-11 ("mvnw로 진행해")
Superseded Plan Artifacts: none

1. Run `mvn wrapper:wrapper -Dmaven=3.9.9`. Done.
2. Verify the wrapper build. Done.
3. Commit the wrapper files and report the commit and pinned version to aa-env.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | ./mvnw -B clean package -DskipTests | JDK 21, JAVA_HOME exported | Four WARs build; wrapper downloads Maven 3.9.9 |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-11 | JDK 21.0.12.1, JAVA_HOME exported | Pass | Exit 0; distributionType=only-script, distributionUrl apache-maven-3.9.9-bin.zip; WARs in target/ |

##### Closure Evidence

- none yet (pending commit)

##### GitHub Projection

Title: Add the Maven Wrapper as the build entry
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M2 - Canonical pom as single source of truth

Origin: abf6545 / M2
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Make the tracked pom.xml the single build definition for aa-maven, so aa-env no longer overwrites a copied pom during `make init`. Fold in the system-scope removal and lib packaging of the lib/ jars.

##### Scope

Reconcile the aa-maven pom with the chosen base variant, remove system-scope local jar references in favor of a supported packaging path for lib/jamtio and lib/redisnio, and confirm a clean build needs no external pom copy.

Out of scope: version pin changes (M3); jakarta changes (M6); CI (M5).

##### Completion Criteria

- A clean checkout builds all four WARs from the tracked pom.xml with no external pom substitution.
- lib/jamtio and lib/redisnio are consumed through a packaging path that survives without a system-scope path.

##### Dependencies And Decisions

- D8: the canonical pom base variant is aa-env's tracked pom.xml (tomcat-servlet-api 9.0.113, commons-lang3 3.12.0, guava range), decided 2026-09-11. The considered alternatives were aa-env's untracked pom.xml.aa (9.0.98, commons-lang3 3.18.0, guava 33.4.0-jre pinned) and aa-maven's own tracked value (9.0.74).
- D11.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Merge the aa-maven pom to the D8 base (aa-env tracked pom.xml) and remove any external-copy dependency.
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

#### M3 - Dependency refresh to stable current versions

Origin: abf6545 / M3
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Refresh and pin the third-party dependency versions on the canonical pom to the current stable releases (D11), on Tomcat 9, the fixed runtime (D24).

##### Scope

Set tomcat-servlet-api to the current 9.0.x (Tomcat 9 is the fixed runtime, D24), refresh log4j, mariadb-java-client, jca, commons-* and guava to current stable releases, and pin every range to a fixed version. Record the chosen versions as evidence. Upstream's catalog on 2026-09-02 (jca 2.4.12, log4j 2.20.0, mariadb 3.3.3, protobuf-java 4.33.0, junit 5.9.3) is a reference point, not a target.

Out of scope: jakarta artifact swaps (M6, retired); adding sqlite-jdbc (M8).

##### Completion Criteria

- All dependencies are pinned to fixed, current stable versions (no open ranges) and the build passes tests.

##### Dependencies And Decisions

- M2 (refresh applies to the canonical pom); D24; D11.

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

Origin: abf6545 / M5
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Rebuild continuous integration around the Maven Wrapper. The Gradle workflows are removed under M7; the owner authors the new GitHub Actions workflows (D13). The readthedocs javadoc step moves to mvnw under M7.

##### Scope

Owner-authored GitHub Actions workflows that build and test with `./mvnw` (JAVA_HOME exported, JDK 21). Keep .readthedocs.yaml on `./mvnw -B -q javadoc:javadoc`.

Out of scope: Gradle file removal (M7); publishing WAR artifacts as releases (owner decision pending).

##### Completion Criteria

- CI builds and tests run through mvnw on GitHub Actions, and readthedocs builds javadoc through mvnw; no workflow or docs step references Gradle.

##### Dependencies And Decisions

- D13 (owner authors the CI); D11 (current stable actions and JDK setup).

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
| T2 | Not run | readthedocs | Pending | local goal verified under M7 / T3 on 2026-09-11 |

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

#### M9 - Upstream core features: cherry-pick policy and application

Origin: abf6545 / M9
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Define the policy for selecting upstream changes since the fork base a81b5e4 and bring the core ones into aa-maven during Phase 1. Verified in a local clone of upstream on 2026-09-11: master f86b573 (2026-09-02) is exactly 565 commits past a81b5e4; releases 2.3.1, 2.4.0, and 2.4.1 (2025-07-21) fall in that range; upstream now tags weekly. Upstream's jakarta migration is the single commit 97ae03d6 (180 files, mostly import renames); a dry `git apply --check` on our base fails on 14 files and 2 files absent here, so it serves M6 as a checklist rather than as a patch.

##### Scope

Establish which upstream change classes are picked (core features, bug fixes, CVE bumps) and which are skipped, produce the candidate list, and apply the accepted picks on the Maven build.

Out of scope: wholesale upstream merges (D1); Gradle-era build changes.

##### Completion Criteria

- A written pick/skip policy accepted by the owner.
- The accepted upstream changes are applied, build, and pass tests on the Maven build.

##### Dependencies And Decisions

- D1; D10 (Phase 1).

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

#### M10 - Site-required features and fixes

Origin: abf6545 / M10
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Implement the features and fixes this site needs in aa-maven, independent of upstream.

##### Scope

Owner-identified features and defects implemented directly in the fork on the Maven build.

Out of scope: upstream picks (M9).

##### Completion Criteria

- Each owner-identified item is implemented and verified.

##### Dependencies And Decisions

- D10 (Phase 1); awaiting the owner's item list.

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

#### M13 - Maven test platform

Origin: abf6545 / M13
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Rebuild the test platform on Maven. The Gradle build carried categorized test tasks (unit, epics, integration, flaky), a `testRun` development server, and a Tomcat shutdown helper; none of that exists under Maven. Phase 1 needs a Maven-native way to run unit tests, EPICS-dependent tests, and Tomcat 9 integration tests in the existing environment.

##### Scope

Surefire for unit tests and Failsafe (or an equivalent current-stable mechanism) for integration tests, JUnit 5 tags or profiles to select unit, EPICS, and integration sets, and a documented way to run the integration set against a local Tomcat 9.

Out of scope: CI wiring (M5).

##### Completion Criteria

- `./mvnw test` runs the unit set; a documented invocation runs the EPICS and Tomcat 9 integration sets; each set passes in the existing environment.

##### Dependencies And Decisions

- D10 (Phase 1); D11 (current stable JUnit 5 and Surefire/Failsafe).

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

#### M14 - Documentation for the Maven build

Origin: abf6545 / M14
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Bring the documentation in line with the Maven-only reality: build, test, customization, and deployment on Tomcat 9, and the readthedocs pipeline. The Gradle-era text is rewritten minimally under M7; this row completes the documentation.

##### Scope

Developer guide, sysadmin customization and install guides, README.md, and the Sphinx pipeline, all describing mvnw, the test platform (M13), and the Phase 1 deployment.

Out of scope: EPICS-Arche architecture docs.

##### Completion Criteria

- Docs describe the actual build, test, and deploy procedure, and the Sphinx site builds cleanly.

##### Dependencies And Decisions

- D10 (Phase 1); D11.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Audit the docs against the Maven build and the M13 test platform.
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

#### M4 - Ant removal: final Maven-only consolidation

Origin: abf6545 / M4
Identity History: none
GitHub Issue: none
Status: Deferred

##### Summary

Remove the Ant build file and rehome the five maven-antrun-plugin executions onto native Maven plugins. Deferred per D9 to run last in Phase 1, as the final move to a Maven-only build once the other build work is complete. Upstream still carries the same build.xml and sitespecific hook (verified 2026-09-11), so no upstream solution exists to borrow.

##### Scope

Delete build.xml. Replace the five antrun executions create-api-docs-directory, check-mappings-file-before-javadoc, download-unpack-and-stage-svg-viewer, create-version-txt, and sitespecificantscript with Maven-plugin equivalents.

Out of scope: Gradle (M7); exec-maven-plugin steps that are not antrun.

##### Completion Criteria

- No maven-antrun-plugin execution remains and build.xml is deleted, with the five tasks still performed during the Maven build.

##### Dependencies And Decisions

- D9: deferred to run last in Phase 1, after the other build work completes.
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

#### M6 - jakarta.servlet migration for Tomcat 11

Origin: abf6545 / M6
Identity History: none
GitHub Issue: none
Status: Complete

##### Summary

Retired on 2026-09-11 by D24 without a deliverable: Tomcat 9 is fixed for the existing appliance, and a Tomcat 11 move would be discarded when EPICS-Arche replaces the runtime. The record is kept for reference. The work would have migrated the servlet API from javax.servlet to jakarta.servlet on our 181 files as a mechanical rename; upstream's single migration commit 97ae03d6 (2025-07-31) remains the checklist if the decision is ever revisited.

##### Scope

Move the 181 javax.servlet imports to jakarta.servlet, switch to the Tomcat 11 servlet API, and adopt jakarta-compatible commons-fileupload2 and jakarta.validation (upstream reference versions on 2026-09-02: tomcat 11.0.12, jakarta-validation 3.1.1, commons-fileupload 2.0.0-M3).

Out of scope: the interim 9.0.x bump (M3).

##### Completion Criteria

- No source file imports javax.servlet and the components deploy and run on Tomcat 11.

##### Dependencies And Decisions

- D24 (retired); D6 superseded.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Retired before any step ran (D24).

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Static | grep for javax.servlet imports | source tree | No matches |
| T2 | Integration | Deploy the components on Tomcat 11 | Tomcat 11, JDK 21 | Services start and respond |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | source tree | Retired | none; row retired by D24 |
| T2 | Not run | Tomcat 11, JDK 21 | Retired | none; row retired by D24 |

##### Closure Evidence

- Retired by owner decision D24 on 2026-09-11; no deliverable, no verification.

##### GitHub Projection

Title: Migrate javax.servlet to jakarta.servlet for Tomcat 11 (retired)
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M16 - Embedded Tomcat runnable jars

Origin: abf6545 / M16
Identity History: none
GitHub Issue: none
Status: Complete

##### Summary

Retired on 2026-09-11 by D23 without a deliverable. The idea was to package each component (mgmt, engine, etl, retrieval) as a runnable jar with embedded Tomcat 11 so aa-env could stop installing Tomcat (D12). The owner withdrew it because the EPICS-Arche architecture replaces the runtime altogether (Go services, C++ engine, no Tomcat), so embedding Tomcat into the Java appliance would be discarded work. Through Phase 2 the appliance stays WARs on an external Tomcat 9 (D24). The scope and plan below are kept as the record of what was retired.

##### Scope

Launcher classes, embedded-Tomcat packaging (shaded or layered jar per component), and the runtime contract published to aa-env: (a) artifact names and version stamping (baseline tag in name or manifest); (b) configuration intake through environment variables or one properties file per component, covering port, DataSource (driver, URL, user, pool size; MariaDB until M17, SQLite after), and ARCHAPPL_* paths, replacing server.xml, per-instance context.xml JNDI, and the archappl.bash env file; (c) logging to stdout/stderr for journald; (d) the JDK requirement and any JVM flags.

Out of scope: aa-env's systemd units and templates; MariaDB removal (M17).

##### Completion Criteria

- Each of the four jars starts with `java -jar`, serves its component on the configured port, and reads its configuration per the published contract.
- The runtime contract (a)-(d) is recorded in this detail and sent to aa-env.

##### Dependencies And Decisions

- D12 (superseded); D23 (retired). aa-env gate G9 referenced this row and is notified of the retirement.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Retired before any step ran (D23).

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | java -jar archappl-<component>.jar with a properties file | JDK 21 | Component starts on the configured port and answers its health endpoint |
| T2 | Integration | Four jars running together with appliances.xml URLs | JDK 21, MariaDB | Components communicate and archive a test PV |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21 | Retired | none; row retired by D23 |
| T2 | Not run | JDK 21, MariaDB | Retired | none; row retired by D23 |

##### Closure Evidence

- Retired by owner decision D23 on 2026-09-11; no deliverable, no verification. Supersedes the aa-env request that created it.

##### GitHub Projection

Title: Embedded Tomcat runnable jars per component (retired)
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M8 - sqlite-jdbc runtime dependency

Origin: abf6545 / M8
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Add the sqlite-jdbc runtime dependency. The SQLite dialect already exists in MySQLPersistence and archappl_sqlite.sql; only the driver dependency is missing. First step of the Phase 2 closing sequence (D22); the SQLite configuration store carries into EPICS-Arche.

##### Scope

Add sqlite-jdbc (current stable) as a runtime dependency in the canonical pom and confirm the SQLite persistence path loads.

Out of scope: dialect or schema code changes; MariaDB removal (M17).

##### Completion Criteria

- The SQLite persistence path works at runtime with the driver on the classpath.

##### Dependencies And Decisions

- D22 (Phase 2 closes with SQLite, superseding D7's Backlog placement); D11.

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

#### M11 - Persistence and storage backend pruning

Origin: abf6545 / M11
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Remove persistence or storage code aa-maven does not need. Owner wording: unusual storage backends are to be dropped. Present backends are InMemory, JDBM2, MySQL, and Redis persistence, and PB, PBOverHTTP, and PlainPB storage plugins. Part of the Phase 2 closing sequence (D22).

##### Scope

Inventory the persistence and storage backends first, then remove the ones the owner selects.

Out of scope: removing anything before the owner approves the drop list; MariaDB removal (M17); the EPICS-Arche storage replacement.

##### Completion Criteria

- The owner-approved backends are removed and the build and tests pass without them.

##### Dependencies And Decisions

- D22 (Phase 2); inventory first; owner decides the drop list.

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

#### M17 - MariaDB dependency removal

Origin: abf6545 / M17
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Drop the MariaDB dependency once SQLite is the configuration store, so the runtime needs no external database server. This row closes Phase 2 (D22, D24): after it, the appliance runs as WARs on Tomcat 9 under aa-env's systemd units with SQLite and no external database. The SQLite store carries into EPICS-Arche as the configuration backing for its management service.

##### Scope

Remove mariadb-java-client and the MariaDB-specific configuration paths after the SQLite path (M8) is verified, make SQLite the default persistence, and update the per-instance context.xml DataSource guidance for aa-env accordingly.

Out of scope: the SQLite dialect itself (exists); backend pruning (M11).

##### Completion Criteria

- No mariadb-java-client dependency in the pom; the components run with SQLite persistence and pass tests; the DataSource guidance sent to aa-env reflects SQLite.

##### Dependencies And Decisions

- M8 (SQLite must work first); D22 (Phase 2 close); D11.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Make SQLite the default persistence configuration.
2. Remove the MariaDB dependency and configuration; update the runtime contract.
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

Origin: abf6545 / G1
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

No unassigned work remains in this register; the former Backlog row M12 is transferred to EPICS-Arche (D22, Assignment History).

### Backlog Details

None.
