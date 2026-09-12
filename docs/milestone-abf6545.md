# Work Register

Release line: master
Milestone index: abf6545
Canonical path: `docs/milestone-abf6545.md`
Canonical branch or ref: modernize
Git upstream: none
Remote tracker: jeonghanlee/epicsarchiverap-maven (aa-maven); GitHub issues per row once enabled, no GitHub milestone
Peer register: aa-env at jeonghanlee/epicsarchiverap-env, `docs/milestone-265f580.md` on branch modernize (cross-referenced per D2 and D3)

Next session entry point: draft the M2 implementation plan on the D8 pom base (aa-env tracked pom.xml).

## Milestone

### Work

| Group | ID | Work unit | Type | Status | Ready | Deps | Done when / Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline | M1 | Baseline deployment tag NewHope on abf6545 | Milestone | Complete | No | | Annotated tag on origin peeling to abf6545; [detail](#m1---baseline-deployment-tag-newhope) |
| Build | M2 | Canonical pom as single source of truth | Milestone | Not started | Yes | D8 | pom.xml self-sufficient for a clean build with no external copy; [detail](#m2---canonical-pom-as-single-source-of-truth) |
| Build | M3 | Dependency refresh | Milestone | Not started | No | M2 | Pinned versions build and pass tests; [detail](#m3---dependency-refresh) |
| Build | M4 | Ant remnants removal | Milestone | Not started | Yes | | build.xml gone and antrun executions rehomed; [detail](#m4---ant-remnants-removal) |
| CI | M5 | CI and docs build on Maven | Milestone | Not started | Yes | | GitHub Actions and readthedocs build with Maven, not Gradle; [detail](#m5---ci-and-docs-build-on-maven) |
| Platform | M6 | jakarta.servlet migration for Tomcat 11 | Milestone | Not started | No | M3 | No javax.servlet imports; WARs run on Tomcat 11; [detail](#m6---jakartaservlet-migration-for-tomcat-11) |
| Cleanup | M7 | Gradle files removal | Milestone | Not started | No | M5, M6 | build.gradle, gradlew, gradle/ removed; [detail](#m7---gradle-files-removal) |
| Tracking | G1 | aa-maven GitHub issues enabled | External gate | Open | No | | Repository setting has_issues=true; [detail](#g1---aa-maven-github-issues-enabled) |

### Decisions

| ID | Decision | Decision Date |
| --- | --- | --- |
| D1 | aa-maven is maintained independently; no further upstream merges. It left the GitHub fork network. | 2026-09-11 |
| D2 | Two-session split: aa-maven owns this repository and register, aa-env owns its own. Cross-references use canonical path plus local ID; each M row gets an issue in its own repository. | 2026-09-11 |
| D3 | Issue location shape 1: aa-maven keeps its own issues and register here; aa-env keeps its own. Registers cross-link by issue URL. | 2026-09-11 |
| D4 | Repository names: aa-maven = jeonghanlee/epicsarchiverap-maven, aa-env = jeonghanlee/epicsarchiverap-env. | 2026-09-11 |
| D5 | Deployment baseline is abf6545 as-is, frozen by annotated tag NewHope. | 2026-09-11 |
| D6 | Tomcat 11 is the servlet target; tomcat-servlet-api 9.0.121 is an interim step on Tomcat 9. | 2026-09-11 |
| D7 | sqlite-jdbc runtime support stays in Backlog for now. | 2026-09-11 |
| D8 | The canonical pom base variant is aa-env's tracked pom.xml (tomcat-servlet-api 9.0.113, commons-lang3 3.12.0, guava range). | 2026-09-11 |

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
| T1 | Integration | mvn -B clean package on a fresh checkout with no pom copy | JDK 21, Maven 3.9.9 | Four WARs build |
| T2 | Integration | Inspect built WARs for the lib jars | JDK 21, Maven 3.9.9 | jamtio and redisnio present without a system-scope path |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, Maven 3.9.9 | Pending | none |
| T2 | Not run | JDK 21, Maven 3.9.9 | Pending | none |

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

#### M3 - Dependency refresh

Origin: abf6545 / M3
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Refresh and pin the third-party dependency versions on the canonical pom.

##### Scope

Set tomcat-servlet-api to 9.0.121 as the Tomcat 9 interim (D6), refresh log4j, mariadb-java-client, and jca, and pin guava and commons-lang3 to fixed versions instead of ranges.

Out of scope: jakarta artifact swaps (M6); adding sqlite-jdbc (Backlog M8).

##### Completion Criteria

- All target versions are pinned (no open ranges) and the build passes tests.

##### Dependencies And Decisions

- M2 (refresh applies to the canonical pom); D6.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Update the version properties and pin guava and commons-lang3.
2. Build and run tests.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | mvn -B clean package | JDK 21, Maven 3.9.9 | Build succeeds with pinned versions |
| T2 | Unit | mvn -B test | JDK 21, Maven 3.9.9 | Tests pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, Maven 3.9.9 | Pending | none |
| T2 | Not run | JDK 21, Maven 3.9.9 | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Refresh and pin third-party dependency versions
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M4 - Ant remnants removal

Origin: abf6545 / M4
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Remove the Ant build file and rehome the five maven-antrun-plugin executions onto native Maven plugins.

##### Scope

Delete build.xml. Replace the five antrun executions create-api-docs-directory, check-mappings-file-before-javadoc, download-unpack-and-stage-svg-viewer, create-version-txt, and sitespecificantscript with Maven-plugin equivalents.

Out of scope: Gradle files (M7); exec-maven-plugin steps that are not antrun.

##### Completion Criteria

- No maven-antrun-plugin execution remains and build.xml is deleted, with the five tasks still performed during the Maven build.

##### Dependencies And Decisions

- none

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Move each antrun task to a native Maven plugin.
2. Remove the antrun plugin block and build.xml.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | mvn -B clean package | JDK 21, Maven 3.9.9 | Build produces the same outputs from all five former antrun tasks without antrun |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, Maven 3.9.9 | Pending | none |

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

#### M5 - CI and docs build on Maven

Origin: abf6545 / M5
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Move the GitHub Actions workflows and the readthedocs build off Gradle onto Maven.

##### Scope

Rewrite .github/workflows/test-and-build.yml and build-and-push.yml to build with Maven, and change the .readthedocs.yaml pre_build javadoc step from gradlew to Maven.

Out of scope: removing the Gradle files themselves (M7).

##### Completion Criteria

- CI builds and tests run with Maven, and readthedocs builds javadoc with Maven; no workflow or docs step invokes gradlew.

##### Dependencies And Decisions

- none

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Rewrite both workflows to Maven with JAVA_HOME exported.
2. Change the readthedocs javadoc step to Maven.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Trigger the workflows on a branch push | GitHub Actions | Maven build and tests succeed |
| T2 | Integration | readthedocs build | readthedocs | javadoc builds with Maven |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | GitHub Actions | Pending | none |
| T2 | Not run | readthedocs | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Move CI and docs build from Gradle to Maven
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
Status: Not started

##### Summary

Migrate the servlet API from javax.servlet to jakarta.servlet so the WARs run on Tomcat 11.

##### Scope

Move the 181 javax.servlet imports to jakarta.servlet, switch to the Tomcat 11 servlet API, and adopt jakarta-compatible commons-fileupload2 and jakarta.validation.

Out of scope: the interim 9.0.121 bump (M3).

##### Completion Criteria

- No source file imports javax.servlet and the WARs deploy and run on Tomcat 11.

##### Dependencies And Decisions

- M3 (interim servlet-api bump precedes the target move); D6.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Swap the servlet API and fileupload/validation artifacts.
2. Rewrite javax.servlet imports to jakarta.servlet.
3. Deploy and test on Tomcat 11.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Static | grep for javax.servlet imports | source tree | No matches |
| T2 | Integration | Deploy the WARs on Tomcat 11 | Tomcat 11, JDK 21 | Services start and respond |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | source tree | Pending | none |
| T2 | Not run | Tomcat 11, JDK 21 | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Migrate javax.servlet to jakarta.servlet for Tomcat 11
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M7 - Gradle files removal

Origin: abf6545 / M7
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Remove the Gradle build files once nothing references them.

##### Scope

Delete build.gradle, gradlew, gradlew.bat, and gradle/.

Out of scope: CI and docs rewrite (M5); jakarta (M6).

##### Completion Criteria

- The Gradle files are removed and no CI, docs, or build path references them.

##### Dependencies And Decisions

- M5 (CI and readthedocs must build on Maven first); M6 (jakarta work uses the Gradle files as a reference until done).

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Confirm no CI, docs, or build path references Gradle.
2. Delete the Gradle files.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Static | grep for gradlew and build.gradle references | repository | No references outside removed files |
| T2 | Integration | mvn -B clean package | JDK 21, Maven 3.9.9 | Build unaffected by removal |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | repository | Pending | none |
| T2 | Not run | JDK 21, Maven 3.9.9 | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Remove Gradle build files
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
| Persistence | M8 | sqlite-jdbc runtime dependency | Milestone | Open | No | | D7 backlog; assign when a persistence milestone opens; [detail](#m8---sqlite-jdbc-runtime-dependency) |
| Upstream | M9 | Upstream cherry-pick policy and first pass | Milestone | Open | No | | Owner-defined policy and a first selection pass; [detail](#m9---upstream-cherry-pick-policy-and-first-pass) |
| Bugfix | M10 | Independent fork bug fixes | Milestone | Open | No | | Owner-identified bugs fixed without upstream; [detail](#m10---independent-fork-bug-fixes) |
| Persistence | M11 | Persistence and storage backend pruning | Milestone | Open | No | | Inventory first; owner decides the drop list; [detail](#m11---persistence-and-storage-backend-pruning) |
| UI | M12 | Management web interface rewrite | Milestone | Open | No | | Modern rewrite of mgmt static content; [detail](#m12---management-web-interface-rewrite) |

### Backlog Details

#### M8 - sqlite-jdbc runtime dependency

Origin: abf6545 / M8
Identity History: none
GitHub Issue: none
Status: Open

##### Summary

Add the sqlite-jdbc runtime dependency. The SQLite dialect already exists in MySQLPersistence and archappl_sqlite.sql; only the driver dependency is missing.

##### Scope

Add sqlite-jdbc as a runtime dependency in the canonical pom.

Out of scope: dialect or schema code changes.

##### Completion Criteria

- The SQLite persistence path works at runtime with the driver on the classpath.

##### Dependencies And Decisions

- D7 (kept in Backlog on 2026-09-11); assign when a persistence milestone opens.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Add the sqlite-jdbc runtime dependency.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Start with the SQLite persistence configured | JDK 21, Tomcat | Persistence loads via SQLite |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, Tomcat | Pending | none |

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

#### M9 - Upstream cherry-pick policy and first pass

Origin: abf6545 / M9
Identity History: none
GitHub Issue: none
Status: Open

##### Summary

Define the policy for selecting upstream commits since the fork base a81b5e4 and perform a first selection pass. Per the aa-env session's report, upstream master is about 565 commits ahead of a81b5e4; this count is not re-derived in this checkout, which has no upstream remote configured (D1: no blanket merges).

##### Scope

Establish which upstream commit classes are picked (bug fixes, CVE bumps) and which are skipped, then produce a first candidate list.

Out of scope: applying the picks.

##### Completion Criteria

- A written pick/skip policy and a first candidate list reviewed by the owner.

##### Dependencies And Decisions

- D1; awaiting owner assignment.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Draft the pick/skip policy.
2. Produce the first candidate list from the upstream range.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Review | Owner review of the policy and candidate list | document | Accepted policy and list |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | document | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Define upstream cherry-pick policy and first pass
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M10 - Independent fork bug fixes

Origin: abf6545 / M10
Identity History: none
GitHub Issue: none
Status: Open

##### Summary

Fix bugs the owner chooses to address in aa-maven without waiting for upstream.

##### Scope

Owner-identified defects fixed directly in the fork.

Out of scope: upstream picks (M9).

##### Completion Criteria

- Each owner-identified bug is fixed and verified.

##### Dependencies And Decisions

- awaiting owner-identified bugs.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Collect the owner's bug list.
2. Fix and verify each.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Reproduce and re-test each fixed bug | JDK 21 | Each defect resolved |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21 | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Independent fork bug fixes
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
Status: Open

##### Summary

Remove persistence or storage code aa-maven does not need. Owner wording: unusual storage backends are to be dropped. Present backends are InMemory, JDBM2, MySQL, and Redis persistence, and PB, PBOverHTTP, and PlainPB storage plugins.

##### Scope

Inventory the persistence and storage backends first, then remove the ones the owner selects.

Out of scope: removing anything before the owner approves the drop list.

##### Completion Criteria

- The owner-approved backends are removed and the build and tests pass without them.

##### Dependencies And Decisions

- Inventory first; owner decides the drop list.

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
| T1 | Integration | mvn -B clean package and test after removal | JDK 21, Maven 3.9.9 | Build and tests pass without the dropped backends |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, Maven 3.9.9 | Pending | none |

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

#### M12 - Management web interface rewrite

Origin: abf6545 / M12
Identity History: none
GitHub Issue: none
Status: Open

##### Summary

Modern rewrite of the management web interface. The mgmt static content lives in aa-maven under src/main/org/epics/archiverappliance/mgmt/staticcontent; aa-env holds only the site-specific skin.

##### Scope

Rewrite the mgmt static content to a modern front end.

Out of scope: the aa-env site-specific skin.

##### Completion Criteria

- The rewritten mgmt UI replaces the current static content and serves the same functions.

##### Dependencies And Decisions

- awaiting owner assignment.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Scope the current mgmt static content.
2. Rewrite and replace it.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Load the mgmt UI against a running appliance | Tomcat, JDK 21 | The rewritten UI serves the current functions |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | Tomcat, JDK 21 | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Rewrite the management web interface
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never
