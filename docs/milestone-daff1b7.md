# Work Register

Release line: master
Milestone index: daff1b7
Canonical path: `docs/milestone-daff1b7.md`
Canonical branch or ref: modernize
Git upstream: origin/modernize
Remote tracker: jeonghanlee/epicsarchiverap-maven (aa-maven); GitHub issues per row once enabled, no GitHub milestone
Peer register: aa-env at jeonghanlee/epicsarchiverap-env, `docs/milestone-265f580.md` on branch modernize (cross-referenced per D2 and D3)

Next session entry point: M17 (issue #6), M29 (issue #13), M30 (issue #14), M31 (issue #15), M32 (issue #16), M33 (issue #19) and M38 (issue #23) are Complete. On 2026-10-02 the owner directed that the simpler Ready rows go first. M37 (issue #22) has every plan step done and T1 to T4 passing locally; push, the Maven workflow, and the reconciliation and closure of issue #22 remain. Every other Ready row (M12, M7, M26 and M39) needs an owner decision before implementation: M12 the backends to remove, M7 the site's item list, M26 the settled output form under D31, M39 the per-statement keep, enrich or demote decision. Read the chosen row's detail in this register and settle its plan before any implementation. M37 has a draft plan and issue #22; its owner decisions (language, timeouts, legacy failure handling) come first. M28 stays In progress until the soak report arrives. M36 remains Complete in dca485fd28d14cf91e988fae9ade13729a55c7ee with issue #21 closed; its reply to epicsarchiverap-env's request `live-to-20261001` was sent on 2026-10-02 (M36 Closure Evidence). Do not resend it; wait for that session's report. [jeonghanlee/epicsarchiverap-env#56](https://github.com/jeonghanlee/epicsarchiverap-env/issues/56) continues to own full VM revalidation under its unchanged criteria.

M8 completion checkpoint (2026-09-15): the corrections landed in origin/modernize as eb047c576948ad2ee770cd1e0a3b74808b64bb2e. A new clone from that remote compiled all 176 test sources into 220 class files and passed all 749 default tests; its tracked and untracked status was clean before and after verification. T1-T4 record the complete-set evidence, and T9-T17 retain the focused checks and original failure evidence. The original assertions remain intact, including DbdArchiveTest's three events and FailoverScoreAPITest's 480 hourly values.

## Milestone

This register covers the minimal modernization of the existing Java appliance on its current architecture (D12): Phase 1 consolidates the build on Maven against Tomcat 9 and ends with Ant removal; Phase 2 makes the persistence store selectable (MariaDB or SQLite, both drivers kept) and prunes unused backends, so the appliance runs as WARs on Tomcat 9 under aa-env's systemd units against either store (D28). Tomcat 9 is fixed and names stay as they are (D13, D14). Everything beyond this, the architecture replacement, lives in the EPICS-Arche register. Every row follows D8 (stable, current technology) and D10 (small and strong).

### Work

| Group | ID | Work unit | Type | Status | Ready | Deps | Done when / Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Phase 1 | M1 | Gradle removal (complete erasure) | Milestone | Complete | No | | `git grep -i gradle` returns only this register on the committed tree (2026-09-12); [detail](#m1---gradle-removal-complete-erasure) |
| Phase 1 | M2 | Maven Wrapper as the build entry | Milestone | Complete | No | | Fresh clone of c1dd0b1 builds four WARs through mvnw (2026-09-11); [detail](#m2---maven-wrapper-as-the-build-entry) |
| Phase 1 | M3 | Canonical pom as single source of truth | Milestone | Complete | No | D6 | Fresh clone of 9be652c builds four WARs from the tracked pom with no system scope (2026-09-12); [detail](#m3---canonical-pom-as-single-source-of-truth) |
| Phase 1 | M4 | Dependency refresh to stable current versions | Milestone | Complete | No | M3, M8 | Fixed versions, build and dependency checks pass; 749 default and 45 integration tests pass; landed as 977edf3d (2026-09-16); [detail](#m4---dependency-refresh-to-stable-current-versions) |
| Phase 1 | M5 | Maven-centric CI and docs build | Milestone | Complete | No | D24 | Maven CI builds and tests through mvnw on GitHub Actions (green run 35423900164, commit b0fcbb61, 2026-09-19); docs build moved to M9 (D29); [detail](#m5---maven-centric-ci-and-docs-build) |
| Phase 1 | M6 | Upstream core features: cherry-pick policy and application | Milestone | Complete | No | D25 | 105 PRs classified; 72 scored by five reviewers; 25 PRs owner-confirmed after exclusions (D26, D27); 28 PRs triaged: 19 applied, 6 skipped, 3 excluded; Tier A-D complete, committed and pushed; coherence sweep at 71d15083 recorded in docs/CLOSED_DOORS.md; [detail](#m6---upstream-core-features-cherry-pick-policy-and-application) |
| Phase 1 | M8 | Maven test platform | Milestone | Complete | No | | Fresh clone of eb047c57 compiles and passes 749 default tests; integration 98 and localEpics 26 pass (2026-09-15); [detail](#m8---maven-test-platform) |
| Phase 1 | M9 | Documentation for the Maven build | Milestone | Complete | No | D29 | Docs migrated to an mdBook published on GitHub Pages; the book builds cleanly, is served on GitHub Pages (T3 Pass), and describes the Maven build/test/deploy; content modernization deferred to M17 (D30); [detail](#m9---documentation-for-the-maven-build) |
| Phase 1 | M14 | Build self-sufficiency (no build-time network, pip, or scp) | Milestone | Complete | No | | Build runs offline: no svg_viewer download, no per-build sphinx pip install, no scp; [detail](#m14---build-self-sufficiency-no-build-time-network-pip-or-scp) |
| Phase 1 | M15 | Separate non-test utilities out of src/test | Milestone | Complete | No | | 16 of the 20 main() utilities move to src/tools; 4 @Test-referenced fixtures stay in src/test; [detail](#m15---separate-non-test-utilities-out-of-srctest) |
| Phase 1 | M16 | mgmt API reference generated from code | Milestone | Complete | No | D14 | mgmt WAR ships ui/api generated from the BPL registry and annotations; no scp, taglet, or sphinx in package; registry to document agreement test passes; [detail](#m16---mgmt-api-reference-generated-from-code) |
| Phase 2 | M11 | sqlite-jdbc runtime dependency | Milestone | Complete | No | | Driver org.xerial:sqlite-jdbc 3.53.4.0 added (runtime) and allowlisted; SQLite persistence path verified by SQLitePersistenceTest and the 777/777 regression; [detail](#m11---sqlite-jdbc-runtime-dependency) |
| Phase 2 | M12 | Persistence and storage backend pruning | Milestone | Not started | Yes | | Owner-approved backends removed, build and tests pass; [detail](#m12---persistence-and-storage-backend-pruning) |
| Phase 2 | M13 | Selectable persistence backend: MariaDB and SQLite | Milestone | Complete | No | M11, G2, G4 | Both drivers ship; the backend is chosen by the JNDI DataSource; MariaDB and SQLite paths verified; [detail](#m13---selectable-persistence-backend-mariadb-and-sqlite) |
| Phase 2 | M17 | Modernize the narrative doc content for the single-instance fork | Milestone | Complete | No | M34, M35 | Eight core commands are verified and landed; the final inventory classifies all 25 CLIs and both helpers (decision 2026-10-02), with script modernization moved to M37. The six live runners and 84 client boundary tests pass on the final tree; the corrected scripting page landed as ed2ff676 and is published; issue #6 closed as completed on 2026-10-02; [detail](#m17---modernize-the-narrative-doc-content-for-the-single-instance-fork) |
| Phase 2 | M7 | Site-required features and fixes | Milestone | Not started | Yes | | Owner-identified items implemented and verified; awaiting the owner's item list; [detail](#m7---site-required-features-and-fixes) |
| Phase 2 | M10 | Ant removal: final Maven-only consolidation | Milestone | Deferred | No | D7 | build.xml gone and antrun executions rehomed; only Maven remains; deferred per D7; [detail](#m10---ant-removal-final-maven-only-consolidation) |
| Phase 2 | M18 | Appliance logging model: journald-first log4j2 layout and lifecycle | Milestone | Complete | No | D31, G3 | The shipped log4j2.xml emits the <N> priority prefix with a ${env:ARCHAPPL_ROOT_LOGGER_LEVEL:-INFO} root level and a capped, commented RollingFile fallback; the operating-model page and the faq/install-guide fixes land; [detail](#m18---appliance-logging-model-journald-first-log4j2-layout-and-lifecycle) |
| Phase 2 | M19 | Tomcat log4j jar set from the build | Milestone | Complete | No | D32 | The build writes log4j-api, log4j-core, log4j-appserver and log4j-jul at ${log4j.version} to target/tomcat-log4j and the release tarball carries them; the logging page describes Tomcat and java.util.logging lines through log4j2; [detail](#m19---tomcat-log4j-jar-set-from-the-build) |
| Phase 2 | M20 | Runtime log-level control per component | Milestone | Complete | No | D31 | mgmt BPL getLogLevel and setLogLevel change a named logger or the root level in one running component without a restart, forwarded to that component's own BPL; [detail](#m20---runtime-log-level-control-per-component) |
| Phase 2 | M21 | Reject consolidateDataForPV for an unknown PV | Milestone | Complete | No | | consolidateDataForPV for a PV with no PVTypeInfo returns HTTP 400 with one ERROR line instead of HTTP 500 and a NullPointerException; issue #1 closed manually citing the fix commit; [detail](#m21---reject-consolidatedataforpv-for-an-unknown-pv) |
| Phase 2 | M22 | Local appliance launcher in one folder | Milestone | Complete | No | M13 | One bash script starts the four WARs of a local build as four Tomcat instances on SQLite, with every file under one temporary folder and no systemd; BPL and a PV archive round trip answer; [detail](#m22---local-appliance-launcher-in-one-folder) |
| Phase 2 | M23 | Code defects found while rewriting the docs | Milestone | Complete | No | | Each listed defect is fixed and verified, or kept with a recorded reason; [detail](#m23---code-defects-found-while-rewriting-the-docs) |
| Phase 2 | M24 | Per-request retrieval logging at DEBUG | Milestone | Complete | No | D31 | The five retrieval lines written for every data request log at DEBUG; a deployed retrieval WAR writes none of those a single-PV request passes through at the default level; the build and the default suite pass; [detail](#m24---per-request-retrieval-logging-at-debug) |
| Phase 2 | M25 | ETL pass scheduler in place of per-PV timers | Milestone | Complete | No | | The design of docs/design-etl-pass-scheduler.md is implemented: one pass driver per (transition index, cadence) fires on a fixed grid, the reported ETL values come from pass records, and the default suite and the slow-group test pass; [detail](#m25---etl-pass-scheduler-in-place-of-per-pv-timers) |
| Phase 2 | M26 | etl error bursts and mgmt workflow tick logging | Milestone | Not started | Yes | D31 | A failing store is reported in the settled bounded form, and the settled mgmt tick lines leave the default level; [detail](#m26---etl-error-bursts-and-mgmt-workflow-tick-logging) |
| Phase 2 | M27 | Reduced bins missing after ETL with a post-processor | Milestone | Complete | No | | The cause of the reduced-bin shortfall in ETLPostProcessorTest is found and fixed, and the test and the default suite pass on repeated runs; [detail](#m27---reduced-bins-missing-after-etl-with-a-post-processor) |
| Phase 2 | M28 | ETL pass scheduler soak on the deploy path | Milestone | In progress | No | M25, G4 | The ansible-provision lab runs the pass scheduler of M25 through the aa-env deploy path on the soak chain and on the aa-env default chain: passes fire on the grid, the reported rows read as designed, the unit's stop time is measured, and the comparison with the 2026-09-24 to 2026-09-26 run is recorded; [detail](#m28---etl-pass-scheduler-soak-on-the-deploy-path) |
| Phase 2 | M29 | Remaining per-request retrieval INFO lines | Milestone | Complete | No | | The five per-request retrieval messages and the same messages on the multi-PV and PVAccess paths log at DEBUG (d80eef3a); the retrieval tests' appliance output drops from 41 such lines to 0, 886 default tests and the Maven workflow pass; issue #13 closed as completed on 2026-10-03; [detail](#m29---remaining-per-request-retrieval-info-lines) |
| Phase 2 | M30 | ETLDetails post-processor time shown under the wrong label | Milestone | Complete | No | | The per-PV ETL details row labelled executePostETLTasks shows that phase's time (0fbd5592); ETLDetailsTest fails on the old label and passes after, 883 default tests and the Maven workflow pass; issue #14 closed as completed on 2026-10-03; [detail](#m30---etldetails-post-processor-time-shown-under-the-wrong-label) |
| Phase 2 | M31 | PlainPB stale-file age uses 60 instead of 1000 for seconds to milliseconds | Milestone | Complete | No | | The stale zero-byte and empty-file checks in PlainPBStoragePlugin compare the file age with the intended (hold + 1) partitions in milliseconds (54085ea0); PlainPBStaleEmptyFileTest fails on the old factor and passes after, 886 default tests and the Maven workflow pass; issue #15 closed as completed on 2026-10-03; [detail](#m31---plainpb-stale-file-age-uses-60-instead-of-1000-for-seconds-to-milliseconds) |
| Phase 2 | M32 | Unknown OutOfSpaceHandling value leaves PVs without ETL | Milestone | Complete | No | | A misspelled org.epics.archiverappliance.etl.common.OutOfSpaceHandling value falls back to the default with one ERROR line instead of leaving every PV without ETL (0e0c01dd); ETLOutOfSpaceHandlingTest fails on the old code and passes after, 884 default tests and the Maven workflow pass; issue #16 closed as completed on 2026-10-03; [detail](#m32---unknown-outofspacehandling-value-leaves-pvs-without-etl) |
| Phase 2 | M33 | ZipETLTest reads back fewer events than written | Milestone | Complete | No | | ETL truncated complete ZIP_PER_PV day entries because zip entry reads returned short; WrappedSeekableByteChannel fills each read (6c2cfc08); ZipETLTest reads back 31536000 events on two consecutive slow-group runs, ZipAppendTailTest fails 4 of 6 before and passes after, 892 default tests and the Maven workflow pass; issue #19 closed as completed on 2026-10-04; [detail](#m33---zipetltest-reads-back-fewer-events-than-written) |
| Phase 2 | M34 | Preserve pending samples when pausing archiving | Milestone | Complete | No | | Correction 759337d5 and verified CLI/tests/docs fbc32120 landed; local regression, integration and live checks pass; Maven CI and Pages pass; #17 closed on 2026-09-29; [detail](#m34---preserve-pending-samples-when-pausing-archiving) |
| Phase 2 | M36 | Honor nanosecond bounds in live retrieval | Milestone | Complete | No | | Correction dca485fd published on origin/modernize; 882 default tests, 4 selected integration tests and 70 real IOC checks pass, including exact/minus-one-nanosecond bounds and four-component restart; issue #21 closed as completed on 2026-10-02 UTC; [jeonghanlee/epicsarchiverap-env#56](https://github.com/jeonghanlee/epicsarchiverap-env/issues/56) retains full VM revalidation; [detail](#m36---honor-nanosecond-bounds-in-live-retrieval) |
| Phase 2 | M37 | Modernize the retained sample scripts | Milestone | In progress | No | | Each of the seven retained read-only and alert-check scripts has a defined input, response, timeout and failure contract, keeps its recorded procedure, and passes real-entry-point verification against the appliance; the scripting page documents each; [detail](#m37---modernize-the-retained-sample-scripts) |
| Phase 2 | M38 | PB last-line search reports a position past the end of a complete file | Milestone | Complete | No | | seekToBeforeLastLine sets lastReadPointer after readNextBatch (76c7707d); PBFileInfo reports the file size as the truncation point and the last line's start as the last-sample position for plain and ZIP_PER_PV files; PBFileInfoPositionTest fails 4 of 8 before and passes after, the slow LineByteStream tests pass before and after, 900 default tests and the Maven workflow pass; issue #23 closed as completed on 2026-10-04; [detail](#m38---pb-last-line-search-reports-a-position-past-the-end-of-a-complete-file) |
| Phase 2 | M39 | Per-request INFO logging without requester or outcome | Milestone | Not started | Yes | | Each remaining per-request INFO statement (BasicDispatcher Servicing, engine BPLServlet Beginning request, GetEngineDataAction Found a total) is kept with requester and outcome fields, replaced by one record per request, or moved below INFO, with the decision recorded; output at the default level under load contains only the kept lines; the default suite passes; [detail](#m39---per-request-info-logging-without-requester-or-outcome) |
| Tracking | G1 | aa-maven GitHub issues enabled | External gate | Complete | No | | Repository setting has_issues=true; [detail](#g1---aa-maven-github-issues-enabled) |
| Tracking | G2 | aa-env SQLite deploy path | External gate | Complete | No | | aa-env deploys the appliance with the SQLite backend in a landed commit (jeonghanlee/epicsarchiverap-env bbe0968); [detail](#g2---aa-env-sqlite-deploy-path) |
| Tracking | G3 | Journald layout observed on a deployed host | External gate | Complete | No | | epicsarchiverap-env reports its logging item's check at or after the M18 layout commit: per identifier, ERROR lines at PRIORITY 3 and INFO lines at 6 on a deployed host; [detail](#g3---journald-layout-observed-on-a-deployed-host) |
| Tracking | G4 | ansible-provision deploy path for aa-env with SQLite | External gate | Complete | No | | ansible-provision deploys aa-env at or past bbe0968 with the MariaDB and the SQLite backend on a lab VM, and LAB-ansible-provision reports it; [detail](#g4---ansible-provision-deploy-path-for-aa-env-with-sqlite) |

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
| D11 | Phase order: Phase 1 (Maven modernization on the existing Tomcat 9 environment, ending with Ant removal), then Phase 2 (SQLite replacing MariaDB, backend pruning). aa-env implements the runtime as systemd template units. (Store clause superseded by D28, 2026-09-18: MariaDB and SQLite are parallel/selectable, not SQLite-only.) | 2026-09-11 |
| D12 | This register covers only the minimal modernization of the existing architecture through Phase 2. The architecture replacement (storage, query, services, engine, API, MCP, viewer) is EPICS-Arche work and is not tracked here. | 2026-09-11 |
| D13 | Tomcat 9 is fixed for the existing appliance through the end of Phase 2. The jakarta/Tomcat 11 migration and the embedded-Tomcat runnable jars are retired (recorded in the prior generation at the History commit); tomcat-servlet-api tracks the current 9.0.x as a final value. Phase 2 end state: WARs on Tomcat 9, systemd-run by aa-env, SQLite (sqlite3) as the only store. (Store clause superseded by D28, 2026-09-18: the store is selectable MariaDB or SQLite.) | 2026-09-11 |
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
| D24 | M5 CI implementation is delegated; this supersedes D9's owner-only CI authorship. The scope remains Maven build and test automation plus Read the Docs, with no release publishing. (Read the Docs clause superseded by D29, 2026-09-18: narrative docs moved to an mdBook on GitHub Pages, M9.) | 2026-09-16 |
| D25 | M6 owner selection confirms 28 upstream PR units for ordered, selective adoption on the Maven, Java 21 and Tomcat 9 fork; Parquet/Hadoop units remain excluded, PR400 requires adaptation to the current PlainPB structure, and no source patch is authorized yet. | 2026-09-16 |
| D26 | Single-instance scope reduces the M6 selection from 28 to 26 upstream PR units. PR429 (appliance-to-appliance reassignment; ReassignAppliance absent) and PR458 (stored-chunkKey handling already implemented by the fork's ConvertPVNameToKey) are excluded. | 2026-09-16 |
| D27 | PR359 skipped during application review. The fork commit 103dab65 already fixes the underlying alias-conversion bug with a retained plain-name guard; the owner keeps the fork approach rather than PR359's guard removal. Selection reduces to 25 units. | 2026-09-16 |
| D28 | Phase 2 persistence store is selectable, not SQLite-only: both mariadb-java-client and sqlite-jdbc stay shipped and the backend is chosen at install by the JNDI DataSource. This supersedes the SQLite-only end state of D11 and D13 and aligns with the aa-env owner's parallel/selectable decision (2026-09-18); aa-env relies on both drivers shipping in the WARs. | 2026-09-18 |
| D29 | Narrative documentation publishes as an mdBook on GitHub Pages, not Sphinx on Read the Docs. The book lives at docs/book, is built by a pinned Dockerfile (mdBook 0.4.52 + mdbook-admonish 1.20.0, sha256-pinned), and deploys through the pages.yml workflow with the Pages source set to GitHub Actions. This supersedes the Sphinx/Read the Docs docs build and hosting of M5, which folds into M9; M5 retains only the Maven CI workflow. mdBook pins to 0.4.x until an mdbook-admonish release supports mdBook 0.5. | 2026-09-18 |
| D30 | M9 covers the docs publishing migration (mdBook on GitHub Pages) and build/test/deploy command accuracy, not modernizing the narrative content itself. The migrated pages are largely upstream-era (clustering, multi-appliance, CS-Studio, MySQL-first) and conflict with the single-instance scope (D23, D26) and the EPICS-Arche boundary (D12); content modernization is deferred to backlog item M17 pending an owner keep/cut list. | 2026-09-19 |
| D31 | Appliance logging model, agreed with aa-env: journald collects; one service whose launcher runs the four Tomcats in the foreground with systemd-cat --identifier=archappl-<component> --level-prefix=true; no catalina.out, no JULI FileHandlers, no logrotate; journald retention 8 weeks with the size cap winning; the access log kept as a file with maxDays=90; aa-maven owns the log4j2 layout, root level, fallback and operating-model docs, aa-env owns the unit, launcher, JULI configuration and the access-log bound. | 2026-09-23 |
| D32 | Tomcat internal logging and java.util.logging go through log4j2 (log4j-appserver and log4j-jul at the Tomcat level, as aa-env D25 decides, because no Tomcat 9 formatter emits a priority prefix). aa-maven's build emits the four jars at the WARs' log4j version into target/tomcat-log4j and the release tarball, so the Tomcat-level and WAR-level log4j always come from one build. aa-env installs and configures them. | 2026-09-24 |

### Conceptual-integrity findings

Coherence candidates from the 2026-09-17 sweep around the M6 Tier A and B applications; all are now decided and recorded below. Coverage: the sweep targeted the agreement-points the recent units touched (disconnect handling, metadata keys, null handling, name resolution), not every codebase dimension.

**CI-3 (Keep for now, tracked; deferred fix):** PV-name resolution diverges by thoroughness. The comprehensive resolver in `PVNames.java` tries both the full and the fieldless form against the alias map; `GetDataAtTime.java:199` normalizes first; the simpler BPL endpoints `AreWeArchivingPV.java:43` and `GetPVMetaData.java:49` do a single raw getRealNameForAlias(pvName). So an aliased PV with a field suffix (for example alias.HIHI) resolves in the comprehensive path but not at the simpler endpoints; latent-but-reachable, pre-existing (not an M6 unit), not observed in output. Owner decision 2026-09-17: keep as-is for now and track it here; generalize all entry points through one canonical resolver when capacity allows.

**CI-2 (Resolved, Replace, 2026-09-17):** the FieldValuesCache null path is now filtered once in the shared v3NamedValues, superseding PR445's per-method guard; PR480 applied. Verified by FieldValuesCacheTest (10/10, including testNullValues), a non-IOC regression (748 tests, no real failure), and ChangedFieldsTest against real softIocPVX. Follow-up observation: four sibling EPICS_V4_PV exception logs (connecting/disconnecting/subscribing/unsubscribing) still omit the PV name; a consistent pass is a separate optional cleanup, not tracked.

**CI-1 (Resolved, Replace, 2026-09-17):** EPICS_V4_PV's teardown `disconnect()` did not set state Disconnected, so after the reactive `handleDisconnected()` (added by PR360) fired, stop() fired pvDisconnected a second time. The double-notification is timing-dependent: a first reproduction on a real soft IOC happened to show one notification and was mistakenly recorded as Keep, but under the localEpics suite timing it reproduced as a double (total 2). Fix: `disconnect()` now sets state and fires only when state is not already Disconnected, so the notification is idempotent. Verified: EPICS_V4_PVDisconnectSeamTest and repeated runs show at most one notification, and the full localEpics suite (28 tests) passes. Observation: one run showed zero notifications under a re-search-then-stop timing, cause not fully isolated and not seen to recur, left for a later look.

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
| T2 | Unit | ./mvnw -B test -Dgroups='!integration & !localEpics & !slow & !flaky' (note 2026-09-28: pom.xml reads the groups from test.groups and test.excludedGroups, so -Dgroups had no effect; the run selected the pom defaults, which are the same set) | JDK 21, wrapper Maven | Same pass, fail, and error counts as the step 0 baseline or better |
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
Status: Complete

##### Summary

Build and test through the Maven Wrapper on GitHub Actions. The documentation build and hosting moved to M9 (mdBook on GitHub Pages, D29), so M5 now covers only the Maven CI workflow. M5 implementation is delegated under D24.

##### Scope

One GitHub Actions workflow at `.github/workflows/maven.yml` builds and tests with `./mvnw -B -ntp clean verify` on JDK 21. It runs the default test selection, generates WARs, and checks dependencies. Documentation build and hosting are out of scope here: they moved to M9 (D29), and the Sphinx/Read the Docs pipeline and its `.readthedocs.yaml` are retired.

Out of scope: publishing WAR artifacts as releases (owner decision pending).

##### Completion Criteria

- CI builds and tests run through mvnw on GitHub Actions. (Documentation build and hosting moved to M9, D29.)

##### Dependencies And Decisions

- D24 (delegated CI implementation, superseding D9's CI authorship restriction); D8; D29 (docs build/hosting moved to M9).
- Note (2026-09-19): `mvnw clean verify` was broken from M15/M9 and fixed. M15 moved TestRun (commons-cli's sole user) to src/tools, leaving commons-cli unused-declared, so it moved to the tools profile. M9 deleted docs/docs/source, breaking the mgmt-war deploy-script webResource (repointed to docs/book/src/samples) and the maven.yml docs-Python step (removed). Cause of the miss: M15/M9 were checked with `test`/`package`/mdbook, not `verify`; the analyze-only gate runs at `verify`.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner, 2026-09-16 (M5 scope and delegated execution)
Implementation Authorization: owner, 2026-09-16 (M5 execution)
Superseded Plan Artifacts: the Read the Docs parts of steps 2, 4, and 5 and the Read the Docs hosted verification are superseded by D29 (2026-09-18); documentation build and hosting moved to M9 (mdBook on GitHub Pages). The Maven CI parts of this plan stand.

1. Add one workflow for push, pull_request, and workflow_dispatch. Use a read-only repository token, cancel superseded runs, and allow 45 minutes for the build. Fetch full history because the existing release-notes step reads origin/master.
2. Set up Temurin JDK 21 and Python 3.10 (matching Read the Docs), cache Maven and pip dependencies, and install the existing docs requirements. Pin official actions to the verified release commit: checkout v7.0.1, setup-java v6.0.1, setup-python v7.0.0, and upload-artifact v7.0.1.
3. Execute `./mvnw -B -ntp clean verify` with the pom's default test exclusions. Preserve Surefire reports for 14 days even on failure. Tomcat/IOC integration provisioning and release publishing remain outside this workflow.
4. Correct the Read the Docs version field to numeric 2 and run `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./mvnw -B -q compile javadoc:javadoc` before Sphinx. Require a nonempty `target/site/apidocs/index.html` because the existing pom tolerates Javadoc errors. Use Ubuntu 26.04 LTS as requested on 2026-09-16; retain the Python selection and docs requirements. The hosted OS remains to be verified by T2.
5. Validate workflow syntax and the Read the Docs schema, then execute the shipped commands in fresh checkouts. Record local environment differences and confirm generated outputs as well as exit codes.
6. After authorized commit and push, observe the GitHub Actions run for that revision. For Read the Docs, identify the project and follow the hosted verification procedure below. Keep M5 In progress until both real services pass. (Superseded by D29: Read the Docs is retired, so only the GitHub Actions gate applies; it passed on 2026-09-19 via run 35423900164, so M5 is Complete.)

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
| T1 | 2026-09-19 05:25 UTC | GitHub Actions (modernize) | Pass | maven.yml run 35423900164 (commit b0fcbb61) completed success: `./mvnw -B -ntp clean verify` on JDK 21. https://github.com/jeonghanlee/epicsarchiverap-maven/actions/runs/35423900164 |
| T2 | Not run | Read the Docs (out of scope per D29) | Superseded | Narrative docs build and hosting moved to M9 (mdBook on GitHub Pages, D29); the Read the Docs pipeline is retired, so hosted RTD verification no longer applies to M5. |
| T3 | 2026-09-16 15:19 UTC | actionlint 1.7.12, official Read the Docs v2 JSON schema | Pass | actionlint exits 0; the Read the Docs configuration with the original Ubuntu 22.04 selection validates. The baseline string version fails the schema's numeric version constraint. Schema and tool checksum evidence are under /tmp/aa-m5.agygNtL7/. |
| T4 | 2026-09-16 15:31:25 UTC | Local JDK 21.0.12.1, Maven 3.9.9, Python 3.13.5 | Pass | Fresh checkout of 15892297: the workflow's pip install and clean verify commands exit 0. All 749 tests in 67 classes pass with zero failures/errors/skips; Maven takes 15 min 34 s wall time. Documentation, four WARs, all three enforcer rules, and dependency analysis pass. /tmp/aa-m5.agygNtL7/ci-result.json and ci-step-4.log retain the actual commands and results. |
| T5 | 2026-09-16 15:19:22 UTC | Local JDK 21.0.12.1, Python 3.13.5, Sphinx 7.2.6 | Pass | Fresh checkout of 15892297 plus the corrected commands (configuration still selected Ubuntu 22.04): compile/Javadoc, the output-file check, and Sphinx each exit 0. Management mappings, Javadoc index and scriptables, and Sphinx index are nonempty; no Javadoc error is present. Sphinx reports 45 existing document warnings. Actual commands and timestamps: /tmp/aa-m5.agygNtL7/rtd-final-result.json. |

Fresh-checkout baseline: the previous `javadoc:javadoc` command returned exit 0 despite a taglet FileNotFoundException for docs/api/mgmtpathmappings.txt, and generated no Javadoc index. The final output-file check exits 1 against that actual baseline and 0 against the corrected build. The fix runs the existing compile path to produce the required mappings; no fixture or generated file is substituted. Baseline evidence: /tmp/aa-m5.agygNtL7/rtd-baseline-pre-build-0.log. Local checks do not execute hosted setup actions or prove either hosted service passed.

Final audit: the XML suite totals and 749 testcase elements agree, and test identities match the M4 default-test baseline. The final workflow's pip and Maven commands match the executed snapshot; its report upload targets the generated Surefire directory. The current Read the Docs configuration differs from that snapshot only in build.os (Ubuntu 26.04 instead of 22.04). Its commands are unchanged; YAML parsing and the supported OS value were checked, but no Ubuntu 26.04 hosted build has run. Consolidated evidence and configuration hashes: /tmp/aa-m5.agygNtL7/verification.json.

##### Closure Evidence

- Local implementation and T3-T5 passed review on 2026-09-16. GitHub Actions T1 landed green on 2026-09-19: maven.yml run 35423900164 (commit b0fcbb61) completed success with `./mvnw -B -ntp clean verify` on JDK 21. Read the Docs T2 is superseded by D29 (narrative docs moved to M9). M5 is Complete (2026-09-19).

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
Status: Complete

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

Plan Status: accepted; application complete
Plan Acceptance: Survey method and owner selection accepted 2026-09-16; ordered application plan recorded 2026-09-16 (25 units in four tiers, after the D26 and D27 exclusions); source-patch application authorized 2026-09-16
Implementation Authorization: Source-patch application authorized 2026-09-16 and completed, one unit at a time under owner direction; each unit was curated by hunk and compile-verified, with per-unit runtime verification recorded in the Application status. This superseded D25's no-patch state.
Superseded Plan Artifacts: Initial six-candidate draft, superseded by the complete merge-unit survey

1. Follow EPICS-env `docs/upstream-fix-carry-procedure.md` for the full upstream range. Use the owner's merge-unit selection rule: 104 merge commits and one squash integration cover all 565 commits without duplication.
2. Classify actual diffs. Remove only exclusively documentation, CI or test changes; defer absent target implementations with prerequisites. Keep tool changes, refactors, formatting and features in the assessment. Preserve the Maven, Java 21 and Tomcat 9 adoption constraints.
3. Verify application and inspect build prerequisites. Give all surviving candidates to five independent reviewers in the owner-approved waves of three and two. Compute the eight per-axis medians and recommendation rule in code.
4. Present every score and dependency to the owner. The owner-confirmed set contains 25 PR units after the D26 and D27 exclusions; the ordered application list is recorded below.
5. After separate implementation authorization, reproduce accepted defects on the real code and shipped fixtures, apply the required source changes, and run only the focused regressions and affected existing tests. Broaden verification only for an observed failure or a newly affected path.

###### Complete merge-unit survey

The [decision evidence](archiverap-carry-d12382d1.md) covers aa-maven d12382d1 and upstream f86b5738e308e4482eb6dc8cf7aca852275cfcbc: 105 PR units, 19 exclusively documentation/CI/test exclusions, 14 absent-target deferrals, and 72 scoring candidates. All 565 commits are accounted for exactly once. Five independent reviewers supplied 360 assessments and 2,880 integer axis values. Code-computed per-axis medians place 21 PRs above at least one rule threshold and 51 below every threshold; all scores and raw vectors are retained in the evidence document. Owner decisions confirm 25 PRs for selective adoption after the D26 exclusions (PR429, PR458) and D27 (PR359), including the recorded re-review outcomes and PR400 adaptation; no source patch has been applied.

The panel is a static assessment with explicit reading and execution limits. Large formatting/generated/test/documentation payloads were not uniformly read line by line; source and lexical inspection do not establish runtime behavior. Candidate defects, platform conflicts and minimum prerequisites remain part of owner selection, including for rule-passing PRs.

Unmodified whole-PR application checks passed for 14 of 105 units. PR archiver-appliance/epicsarchiverap#409 then failed a bounded three-file compiler check on the missing `ConfigService.queryPVTypeInfos` API introduced by PR archiver-appliance/epicsarchiverap#368. The evidence document distinguishes these checks from complete project builds and runtime reproduction; the remaining dependency notes are static minimum requirements, not proven complete chains.

###### Ordered application plan

Owner-confirmed application order for the 25 retained units, grouped by adoption cost. Whole-PR application is not used; each unit is curated by hunk against the drifted fork tree and applied one at a time under separate source-patch authorization. Excluded during application review: PR429, PR458 (D26), PR359 (D27, superseded by fork commit 103dab65). This list is the fixed order; each unit's applied or skipped state is tracked in the Application status below, not here.

Tier A, independent (target files present, no missing prerequisite): 360, 364, 385, 396, 408, 417, 423, 433, 445, 454, 474, 481, 501, 516. `EPICS_V4_PV` is edited by 360, 454 and 516, so apply those in sequence with rebased context. PR474 touches documentation and takes a second-person pass before commit.

Tier B, in-set ordering (apply after the named unit): 425 after 417 (shared `EPICS_V3_PV`), 480 after 445 (shared `FieldValuesCache`), 505 after 501, 461 after 433 (`incoming2real`).

Tier C, PlainPB adaptation (retarget the upstream `plain/` paths onto the fork `PlainPB/` package): 452, 521, 400, 405 (after 385), 520. PR400 keeps the URI and URLKey change only; its reshard test hunk drops with PR429.

Tier D, missing-prerequisite adaptation: 448 (retrieval boundary fix; port the boundary logic into `PlainPB/FileBackedPBEventStream` without the absent FileInfo abstraction) and 527 (Jython classloader, engine-shutdown and static-to-instance fixes; the cluster-only peer-proxy timeout hunk is omitted).

###### Application status

Totals: 28 owner-confirmed, 3 excluded during application review, 25 retained. Applied 19 (compile-verified; the engine units PR360, PR364, PR425, PR454, PR516 additionally runtime-verified against a real soft IOC via the localEpics suite, 28 tests passing; PR461 runtime-verified end-to-end via PauseByFieldNameTest under a real Tomcat and soft IOC), queued 0 for owner decision, 6 skipped (PR433, PR385, PR400, PR405, PR448, PR527), pending 0. All 25 retained units are triaged: Tier A to D complete. Each retained unit's applied or skipped status is recorded here as it proceeds through the Tier A to D order above. Regression after the Tier A and B applications: the non-IOC default suite ran 747 tests with zero failures; the single error is PvaTest, which needs a PVA soft IOC absent in this environment and is normally excluded from the default run. No regression is attributable to the applied changes; the applied units' own runtime behavior still awaits the fixture environment.

| Unit | Disposition | Reason | Decision |
| --- | --- | --- | --- |
| PR429 | Excluded | Single-instance: no appliance-to-appliance reassignment; ReassignAppliance absent | D26 |
| PR458 | Excluded | Redundant: fork ConvertPVNameToKey already prefers the stored PVTypeInfo chunkKey | D26 |
| PR359 | Excluded | Superseded: fork commit 103dab65 already fixes the alias-conversion bug with a retained guard | D27 |
| PR364 | Applied (semantic-only) | Alias/.NAME workflow enabled for PVAccess PVs: two usePVAccess short-circuits removed, MetaTest parameterized; spotless churn not adopted. test-compile pass. Runtime verified 2026-09-17: MetaTest passed both usePVAccess values (12 metadata completions) against real softIocPVX. Third-person review 2026-09-17: complete and faithful. Below-floor (owner nod): anonymous blocks and assertTrue kept | - |
| PR360 | Applied | EPICS_V4_PV connection-lifecycle fix: handleMonitor routes to handleDisconnected and returns on null data (was falling through to GotMonitor), centralized idempotent handleDisconnected, connected set under lock; log info to debug. build.gradle core-pva bump omitted (fork at 5.0.5). test-compile pass; runtime IOC pending | - |
| PR385 | Skipped (superseded, owner decision 2026-09-17) | 385 fixes the chunk-boundary value bug in the upstream mechanism (remove the datastores Collections.reverse, add ArrayListEventStreamWithPositionedIterator). The fork replaced that mechanism with a BiDirectionalIterable backward iteration in GetDataAtTime.getDataAtTimeForPVFromStores (introduced by archiver-appliance/epicsarchiverap#134 9b55268f, refined by eb047c57), which crosses chunk boundaries by design; the class 385 adds is absent here and unneeded. Verified 2026-09-17 by the new GetDataAtTimeChunkBoundaryTest: a PARTITION_HOUR store with a gap spanning the hour boundary; a query in the gap returns the previous chunk's last sample, proving the backward cross-chunk retrieval. Out of scope: an observed latent quirk where a chunk holding exactly one sample yields nothing on backward iteration (not 385's bug; normal multi-sample data is correct) | - |
| PR396 | Applied (lint-only, owner decision 2026-09-17) | Remove the unused MimeResponse import from StaticContentServlet; its only occurrence was the import line. The upstream whole-file 4-space reformat and the cosmetic lints (@Serial, final modifiers, EXPIRES constant) are not adopted, keeping the fork's tab style per the session formatting policy. compile pass | - |
| PR408 | Applied | Remove the redundant guarded startup loop that populates applianceAggregateInfo in DefaultConfigService; the aggregate is still built on the per-PV paths. test-compile pass; regression suite pending | - |
| PR417 | Applied | Lower the two EPICS_V3_PV post-stop and post-cleanup "ignoring monitor events" logs from error to debug; behavior unchanged. test-compile pass | - |
| PR423 | Applied | MetaInfo emits the array-count metadata key as EAA_COUNT instead of NELM (archiver-appliance/epicsarchiverap#386). No in-tree consumer of the NELM key; external API readers of NELM are affected. test-compile pass | - |
| PR445 | Applied (semantic-only) | Guard a null cached value before putting it into the changed map in FieldValuesCache.getUpdatedFieldValues; reformat/import churn not adopted. test-compile pass | - |
| PR454 | Applied | Include the PV name in the EPICS_V4_PV monitor conversion error log. test-compile pass | - |
| PR481 | Applied | Remove the getPVNames function and its button from the mgmt static content (index.html, mgmt.js). No compiled code | - |
| PR516 | Applied | EPICS_V4_PV subscribes with RecordOptions.dbeMask(DBE_ARCHIVE); core-pva 5.0.5 provides the API (verified). libs.versions.toml hunk omitted. test-compile pass; runtime IOC pending | - |
| PR474 | Applied (semantic + admin.md blank lines, owner decision 2026-09-17) | Finish the fork's own migration of javadoc links to the _static/javadoc layout, which the fork had already applied to most developer-doc links. Adopt the semantic changes only: the ProcessMgmtScriptables taglet prepends ../_static/javadoc/ to the generated javadoc href; developersguide.md javadoc link api/index.html to ../_static/javadoc/index.html; details.md scriptables link api/mgmt_scriptables.html to mgmt_scriptables.md (the fork's own page in the same directory); admin.md blank-line cleanup. The upstream reformat churn (try-with-resources reindent) is not adopted, keeping fork tabs; the upstream admin.md SKIP_LTS_FOR_ETL paragraph is absent in the fork so its second hunk does not apply. compile pass; second-person doc pass passed 2026-09-17 (all changed links resolve, no residual reader-facing api/ links). | - |
| PR501 | Applied (consistency fix, owner decision 2026-09-17) | Align ArrayListCollectorEventStream with its sibling collectors. FillsCollectorEventStream and SummaryStatsCollectorEventStream already guard the first event (currentYear == -1) and throw ChangeInYearsException on a year crossing; ArrayListCollectorEventStream alone only logged and continued. Add the same guard and throw, matching the fork's exact block (kept tabs, not the upstream reformat). The consumers MergeDedupConsumer, PvaMergeDedupConsumer, and ArchiverValuesHandler already catch the exception, so no new unsafe path is introduced. Adopt the new OptimizedPostProcessorTest.testOptimizedCrossYearDetection. Verified 2026-09-17: that test plus the postprocessor suite (19 tests) and EventStreamWrapTest pass, no regression. Unblocks PR505 | - |
| PR425 | Applied | EPICS_V3_PV clears subscription and archive-field state inside a scheduled Runnable and drops the synchronized block around the field clear, per upstream disconnect handling. test-compile pass; runtime IOC pending | - |
| PR433 | Skipped (owner decision, 2026-09-17) | The fork's pauseResumeByAppliance already dealiases each incoming name up front and keys retValMap, the per-appliance lists, and the response merge by the real name, so pause/resume is functionally correct for aliases; 433 only preserves the incoming name in the response. The fork UI does not use it: pauseMultiplePVs and resumeMultiplePVs re-query via checkPVStatus and ignore the response body, and single-PV pause checks status without pvName matching. So incoming-name preservation is unneeded here. PR461's incoming2real dependency is moot; PR461 is reconsidered separately | - |
| PR480 | Applied (Replace of PR445 null path) | CI-2 owner decision Replace: adopt 480's shared null filter in FieldValuesCache.v3NamedValues (covers getUpdatedFieldValues and getCurrentFieldValues) plus containsKey in getUpdatedFieldValues, superseding PR445's narrower guard. EPICS_V4_PV log hunk excluded (piecemeal: one of five exception logs, unrelated to the null path). Verified 2026-09-17: FieldValuesCacheTest 10/10 including the new testNullValues (non-IOC); non-IOC regression 748 tests with no real failure (only the IOC-only PvaTest errors, normally excluded); ChangedFieldsTest passed against real softIocPVX (V4 field-change path). | - |
| PR461 | Applied (Adapt of the .VAL normalization, 2026-09-17) | Adopt the field-name normalization in BulkPauseResumeUtils.pauseResumeByAppliance: normalizeChannelName strips the ".VAL" suffix before the getRealNameForAlias and type-info lookups, so bulk pausing "pv.VAL" pauses the base PV. Adapted to the fork (targeted edit, not the upstream diff; PR433's incoming2real is moot per the PR433 skip). Verified 2026-09-17 by PauseByFieldNameTest (integration + localEpics): archived UnitTestNoNamingConvention:sine against real softIocPVX under a user-owned Tomcat, POSTed the ".VAL" name to the bulk pause endpoint, and the base PV became Paused; Tests run 1, 0 failures, 0 errors. Out of scope: the single-PV GET path (pauseSinglePV) does not normalize, a separate asymmetry | - |
| PR505 | Applied (consistency fix, owner decision 2026-09-17) | Wrap Nth.getConsolidatedEventStream's output in ArrayListCollectorEventStream, matching the sibling post-processors Optimized, OptimizedWithLastSample, and CAPlotBinning, which all wrap; Nth alone returned the raw ArrayListEventStream. One line, same package so no import; consumes the PR501 year-crossing wrapper. Verified 2026-09-17: NthAndNCountProcessorTest (4 tests) passes; the wrapper's year-crossing throw is already covered by the PR501 test | - |
| PR452 | Applied (Tier C, adapted to PlainPB, owner decision 2026-09-17) | Fix getDataAtTime for a slowly changing PV whose samples straddle a long gap in one file. FileBackedPBEventStream.seekToEndTime gains a POSITION{START,END} argument; the backward-iteration path passes POSITION.END so the end position lands past the last sample on or before the query, not on it, and the reverse iterator includes it. Retargeted from the upstream plain/pb path to the fork's PlainPB package; existing seekToEndTime callers keep POSITION.START via a delegator, so their behavior is unchanged. This fixes the class of defect flagged out-of-scope during PR385 (a sparse backward query returning a stale sample). Verified 2026-09-17 with a lightweight GetDataAtTimeSparseGapTest exercising the real path: without the fix it returns the sample one step early, with the fix it returns the correct last sample; the full non-IOC suite (754 tests) passes. The upstream integration test ExactSampleTest is not adopted (needs the fork's PlainPB API retarget and a Tomcat and LTS environment) | - |
| PR400 | Skipped (pure refactor, owner decision 2026-09-17) | 400 centralizes the storage-plugin URL query keys ("name", "rootFolder", "partitionGranularity", and the rest) into a new URLKey enum, adds a URIUtils.pluginString builder, and rewrites the plugin's roughly fifteen containsKey/get call sites to URLKey.key(). Behavior is unchanged: the enum values are the same strings and pluginString builds the same URL format. The fork's PlainPBStoragePlugin has the matching string-literal block and works as-is, so this is maintainability churn (a new enum plus a new class dependency from URIUtils onto the plain package) with no functional gain for the single-instance fork. The reshard hunk (ReassignApplianceTest) was already tied to the excluded PR429. Reconsider only if a later adopted unit needs URLKey or pluginString | - |
| PR521 | Applied (Tier C, adapted to PlainPB, owner decision 2026-09-17) | Recover from a crash that left a partial record at the end of a PB chunk. PBFileInfo computes a truncationPoint (the position just past the last complete record) and exposes it; AppendDataStateData.updateStateBasedOnExistingFile truncates the file to that point before resuming appends, so an incomplete tail never corrupts the stream. Also corrects the last-event backscan to pass the raw position to LineByteStream.seekToBeforePreviousLine (which already shaves the trailing newline), replacing the double-shaving posn-2. Retargeted from upstream plain/pb onto the fork's single PlainPB.AppendDataStateData. Verified 2026-09-17 by a lightweight PBAppendCrashRecoveryTest exercising the real append path: without the fix a resumed append after a corrupt tail yields a PBParseException on read, with the fix the tail is truncated and the file reads back as a clean ordered stream; the full non-IOC suite (755 tests) passes, so the seekToBeforePreviousLine correction regresses no last-event read. The upstream integration test PbAppendCrashRecoveryTest is not adopted (uses upstream-only plain/pb classes) | - |
| PR520 | Applied (Tier C, adapted to PlainPB, owner decision 2026-09-18) | Recover a PB event truncated by a bare LF. The on-disk format separates records with LF (0x0a); if a record body holds an unescaped LF (hardware corruption, external data), readLine truncates it, leaving an orphaned varint field tag so mergeFrom fails and the event is dropped silently. A new PBEventRecovery.parseWithRecovery centralizes parse-and-recover for all fifteen PB event types: on a parse failure whose last byte is an orphaned varint tag it re-appends LF and retries with buildPartial. Each PB data class's unmarshallEventIfNull now calls it. Also fixes FileBackedPBEventStreamTimeBasedIterator.popEvent to null the reference instead of clearing line1, which had zeroed the returned event's getRawForm (silent empty lines in raw responses). PBEventRecovery lives in the shared PB.data package; the iterator retargets to PlainPB. Verified 2026-09-18: the adopted PBLineFramingTest (19) and the fork-rewritten TimeBasedIteratorRawBytesTest (2) pass, each proven by mutation (disabling the recovery branch errors 15 of 19; restoring clear() fails both iterator tests); the full non-IOC suite (774) passes on the source changes and PBLineFramingTest | - |
| PR448 | Skipped (owner decision 2026-09-18, preserve retrieval convention) | 448 makes the last-sample-before-window prepend in getDataForPV conditional and rewrites FileBackedPBEventStream.seekToTimes to Instant comparisons plus a first==last case, to fix single-sample-per-partition PVs that dropped their last-before-window sample. Verified against the adopted IncludeLastSampleTest: both parts (seekToTimes and the conditional prepend) are needed to reach the expected result, and the boundary suite (FileBackedIteratorTest and the PlainPB tests) stays green. But the full non-IOC suite then fails ZipSingleDayRawFetchTest because 448 also changes dense-file retrieval to start at startTime instead of startTime-1, dropping the last-known value just before the window. That value-before-window is the established archiver convention (as in PI's Outside boundary and EPICS Channel Archiver): step-signal values need the left-edge value for correct plotting. The owner chose to keep the current behavior (unconditional prepend) rather than adopt 448's broader change. Reconsider only if the single-sample-partition edge is worth a fork-local fix that preserves the pre-window sample | - |
| PR527 | Skipped (owner decision 2026-09-18, decomposed) | 527 bundles unrelated changes across about 40 files: a Jython classloader pin in ExecutePolicy (5 lines), a JCACommandThread clean-shutdown fix (join before undeploy, break on interrupt; roughly 26 lines), a large static-to-instance refactor of ArchiveEngine (418 lines plus ripples through PVContext, CapacityPlanningData, and others), a cluster-only peer-proxy retrieval timeout in DataRetrievalServlet, and Gradle build files. The two small fixes (Jython, shutdown) are self-contained and separable, but both only prevent leaks on a hot webapp redeploy; a single-instance appliance restarts the whole Tomcat or JVM, so those leaks never accumulate and the fixes add little. The static-to-instance refactor is a high-risk engine-core change whose value is test isolation, not single-instance runtime. The cluster peer-proxy hunk is excluded per the single-instance lens, and the Gradle files do not apply to the Maven fork. Reconsider only if hot webapp reload becomes part of operations | - |
| PR405 | Skipped (incompatible refactor, owner decision 2026-09-17) | 405 makes DBRTimeEvent and SampleValue implement JSONAware and centralizes event-to-JSON serialization into a default toJSONString (about 30 files: every PBScalar/PBVector type plus consumers). Its central piece restructures GetDataAtTime onto a new common.DataAtTime abstraction, dropping the IterationDirection/Predicate flow. The fork's GetDataAtTime diverged the opposite way, to a BiDirectionalIterable backward iteration with GetDataPredicate (introduced by archiver-appliance/epicsarchiverap#134, refined by eb047c57), which is what PR385 and PR452 verified; adopting 405 would discard that verified retrieval mechanism and those fixes. The default toJSONString also emits an empty fields map, conflicting with the fork's meta-field JSON handling. Pure refactor, no bug fix, fundamentally incompatible with the fork's design | - |

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
| T3 | 2026-09-16 | aa-maven d12382d1; upstream f86b5738 | Partial | All 565 commits mapped to 105 PR units; 105 original apply checks completed. PR archiver-appliance/epicsarchiverap#409 compiler check confirmed its missing method. Static minimum dependencies recorded; complete chain verification remains candidate-specific. |
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

#### M8 - Maven test platform

Origin: daff1b7 / M8
Identity History: none
GitHub Issue: none
Status: Complete

##### Summary

Wire the test tree into Maven and rebuild the test selection the removed Gradle build had. Found 2026-09-12: the pom sets no testSourceDirectory and declares no JUnit dependency, so Maven has never compiled a single test (185 test sources under src/test/org and src/test/edu; Maven looked in src/test/java). The tests are JUnit 5 (151 classes) and already carry tags: integration 64, localEpics 49, slow 8, flaky 3; 67 classes are untagged and need no environment. Stage 1 (pulled forward as the prerequisite of M4) compiles the test tree and makes the untagged unit set the default `./mvnw test`; Stage 2 adds the Tomcat 9 and softIoc profiles.

##### Scope

Stage 1: testSourceDirectory and test resources, test-scope dependencies the tree needs (JUnit 5 with the platform suite, selenium-java and webdrivermanager for the browser tests, awaitility, jinjava for the AppliancesXMLGenerator helper), conversion of the one JUnit 4 suite (PvaTest.java) to a JUnit 5 suite, and Surefire configured so `./mvnw test` runs only the untagged set while the profiles select the others. Stage 2: an `integration` profile that runs `integration & !localEpics` against a user-owned Tomcat 9.0.121 through TOMCAT_HOME, a `localEpics` profile that runs the softIoc-based tests with EPICS base on PATH, and the documented invocations.

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
- Observation (2026-09-23, ansible-provision soak pilot at aa-maven 3c96141d): ETL moved STS to MTS for all 11 pilot PVs, whose names were deliberately varied (underscores, dashes, nested colons, a long multi-underscore name, and underscores inside colon-separated prefix segments). The underscore-in-prefix shape is the failing case of jeonghanlee/epicsarchiverap-env#25 (No mts and lts for some PVs), so this is real-deployment evidence that the STS-to-MTS half of jeonghanlee/epicsarchiverap-env#25 does not reproduce at 3c96141d, which carries the ConvertPVNameToKey.containsSiteSeparators find() correction; MTS to LTS was not yet reached (PARTITION_DAY hold=2, expected 2026-09-24/25). The underscore-in-prefix result (first seen in MTS 2026-09-23T03:34Z) comes from ansible-provision's written soak report of 2026-09-23; ansible-provision's 2026-09-22 comment on jeonghanlee/epicsarchiverap-env#25 covers only the underscore and dash shapes. Recheck: per-PV MTS and LTS file presence on the pilot host; the written soak report.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner, 2026-09-12
Implementation Authorization: owner, 2026-09-12
Superseded Plan Artifacts: none

Stage 1
1. pom: `<testSourceDirectory>${project.basedir}/src/test</testSourceDirectory>` and a testResources entry for src/test excluding `**/*.java`, so the data files beside the tests reach target/test-classes.
2. pom: test-scope dependencies at the current stable releases (verified at execution, versions recorded here): junit-jupiter (api, params, engine) and junit-platform-suite through the JUnit BOM; selenium-java and io.github.bonigarcia:webdrivermanager; org.awaitility:awaitility; com.hubspot.jinjava:jinjava. Add whatever else test-compile reports missing, one at a time, recording each.
3. Convert PvaTest.java from the JUnit 4 Suite runner to a JUnit 5 `@Suite` (junit-platform-suite-api) with `@SelectClasses`, and replace @BeforeClass/@AfterClass with @BeforeAll/@AfterAll or a suite-level extension; no JUnit 4 dependency is added.
4. pom: maven-surefire-plugin at the current 3.x with `<excludedGroups>integration,localEpics,slow,flaky</excludedGroups>` as the default, so `./mvnw test` is the unit set and the profiles (`-P integration`, `-P localEpics`) select the environment-dependent sets by clearing the exclusions.
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
Status: Complete

##### Summary

Bring the documentation in line with the Maven-only reality and change how it publishes: the narrative docs move from Sphinx/Read the Docs to an mdBook served on GitHub Pages (D29). The pages describe mvnw, the test platform (M8), and Phase 1 deployment on Tomcat 9. The Gradle-era text was rewritten minimally under M1; this row completes the documentation and its publishing pipeline.

##### Scope

The 18 narrative pages migrate to an mdBook under docs/book (book.toml + SUMMARY.md); MyST directives are converted to CommonMark plus mdbook-admonish. A pinned Dockerfile (docs/book/Dockerfile: mdBook 0.4.52 + mdbook-admonish 1.20.0) builds the book locally and in CI, and the pages.yml workflow deploys it to GitHub Pages. The Sphinx/Read the Docs pipeline is retired (build_docs scripts, docs/docs, .readthedocs.yaml). README and the developer/sysadmin guides are corrected to the mvnw build.

Out of scope: EPICS-Arche architecture docs; modernizing the narrative content itself. The migrated pages remain upstream-era, and reconciling their substance to the single-instance fork is deferred to backlog item M17 per D30.

##### Completion Criteria

- The docs describe the actual build, test, and deploy procedure; the mdBook builds cleanly from the pinned Dockerfile; and GitHub Pages serves the book (Pages source set to GitHub Actions). Narrative content currency is out of scope (M17, D30).

##### Dependencies And Decisions

- D11 (Phase 1); D8; D29 (mdBook on GitHub Pages, superseding the Sphinx/RTD docs pipeline of M5); D30 (content modernization deferred to M17).

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner, 2026-09-18
Implementation Authorization: owner, 2026-09-18
Superseded Plan Artifacts: the earlier Sphinx-audit plan (superseded 2026-09-18 by the mdBook/Pages pivot)

1. Migrate the 18 pages to docs/book/src, convert MyST directives, and build SUMMARY.md and book.toml.
2. Author docs/book/Dockerfile with pinned mdBook + mdbook-admonish, and the pages.yml GitHub Pages workflow.
3. Retire the Sphinx/RTD pipeline; correct README, the guides, and the sample build command to mvnw.
4. Verify the book builds cleanly from the Dockerfile; after push and setting the Pages source to GitHub Actions, verify the live site.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | docker build docs/book, then mdbook build | Docker | Book builds with no errors or broken links |
| T2 | Review | Second-person pass on the migrated pages | document | A cold reader can build, test, and deploy from the docs |
| T3 | Integration | pages.yml run, then fetch the live Pages URL | GitHub Actions | Live site serves the mdBook (mdBook markers, no Jekyll) |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-18 | Docker (alpine 3.24, mdBook 0.4.52, admonish 1.20.0) | Pass | Clean `mdbook build` rc=0, 22 HTML pages, admonish rendered, no broken-link or error warnings |
| T2 | 2026-09-19 | document (cold-reader pass) | Pass | Build and test procedures follow from the mvnw commands in developersguide/customization; the migration left 36 dead `_static/javadoc` links and 15 stray MyST attribute markers, now removed (0 residual, b12bb76a) and the book rebuilds clean. Deploy-artifact naming is upstream-era and deferred to M17 (D30), out of this scope. |
| T3 | 2026-09-19 | GitHub Actions + live Pages | Pass | pages.yml run for 263805a1 succeeded; https://jeonghanlee.github.io/epicsarchiverap-maven/index.html returns 200 with mdBook markers (mdBook, elasticlunr) and no Jekyll marker; subpages resolve. Required adding modernize to the github-pages environment deployment branches (Pages source was already build_type=workflow). |

##### Closure Evidence

- Deliverable: the 18 narrative pages publish as an mdBook at https://jeonghanlee.github.io/epicsarchiverap-maven/ (9668591f, 263805a1); Sphinx/Read the Docs retired; README and guides corrected to mvnw; 36 migration-broken javadoc links and 15 stray MyST attribute markers removed (b12bb76a).
- Verification: T1 Pass (clean Docker build, 22 pages), T3 Pass (live Pages serves the mdBook), T2 Pass (cold-reader pass on build/test procedures), 2026-09-18/19.
- Scope boundary: narrative content currency for the single-instance fork is deferred to backlog M17 (D30).

##### GitHub Projection

Title: Documentation for the Maven build
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
Status: Complete

##### Summary

Add the sqlite-jdbc runtime dependency. The SQLite dialect already exists in MySQLPersistence and archappl_sqlite.sql; only the driver dependency is missing. First step of Phase 2.

##### Scope

Add sqlite-jdbc (current stable) as a runtime dependency in the canonical pom and confirm the SQLite persistence path loads.

Out of scope: dialect or schema code changes; the selectable MariaDB/SQLite backend (M13).

##### Completion Criteria

- The SQLite persistence path works at runtime with the driver on the classpath.

##### Dependencies And Decisions

- D11 (Phase 2); D8.

##### Implementation Plan

Plan Status: accepted; application complete
Plan Acceptance: Owner selected current-stable sqlite-jdbc and integration-test verification 2026-09-18
Implementation Authorization: owner, 2026-09-18
Superseded Plan Artifacts: none

1. Add the sqlite-jdbc runtime dependency.
2. Start with the SQLite persistence configured and verify.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Bind a SQLite DataSource in JNDI and round-trip PVTypeInfo through MySQLPersistence | JDK 21, sqlite-jdbc 3.53.4.0 | Persistence selects the SQLite dialect and the round-trip succeeds |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-18 | JDK 21, sqlite-jdbc 3.53.4.0 | Pass | MySQLPersistence selected SQL Dialect SQLite; PVTypeInfo put/get/getAllForAppliance/delete round-trip; default suite 777/777, 0 failures |

##### Closure Evidence

- sqlite-jdbc 3.53.4.0 declared runtime in pom and allowlisted; SQLitePersistenceTest exercises the real SQLite persistence path; capped-heap default suite 777/777 with no failures

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
GitHub Issue: #4
Status: Not started

##### Summary

Remove persistence or storage code aa-maven does not need. Owner wording: unusual storage backends are to be dropped. Present backends are InMemory, JDBM2, MySQL, and Redis persistence, and PB, PBOverHTTP, and PlainPB storage plugins.

##### Scope

Inventory the persistence and storage backends first, then remove the ones the owner selects.

Out of scope: removing anything before the owner approves the drop list; the selectable MariaDB/SQLite backend (M13).

##### Completion Criteria

- The owner-approved backends are removed and the build and tests pass without them.

##### Dependencies And Decisions

- D11 (Phase 2); D10; inventory first; owner decides the drop list.
- 2026-09-26: M23 item 9 moves here: check whether RedisPersistence creates its connection pool only when ARCHAPPL_PERSISTENCE_LAYER_REDISURL is set although it logs localhost as the default (RedisPersistence.java lines 38-49), as part of the inventory.

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

Title: Prune the unneeded persistence and storage backends
Labels: enhancement
GitHub Milestone: none
Observed State: open
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-09-26 (gh issue view 4 --repo jeonghanlee/epicsarchiverap-maven --json state,labels,milestone)

#### M13 - Selectable persistence backend: MariaDB and SQLite

Origin: daff1b7 / M13
Identity History: none
GitHub Issue: #5
Status: Complete

##### Summary

Ship both mariadb-java-client and sqlite-jdbc and let the persistence backend be selected at install, rather than removing MariaDB. MySQLPersistence already detects the SQLite vs MySQL dialect from the DataSource (M11), so the selection is made by the JNDI DataSource wired per instance. This row completes Phase 2's persistence scope (alongside M12's backend pruning): the appliance runs as WARs on Tomcat 9 under aa-env's systemd units against either MariaDB or SQLite.

##### Scope

Keep both drivers shipped; confirm the persistence layer works against both the MariaDB and SQLite dialects; document the selectable-backend contract (which DataSource selects which backend) for aa-env. The backend selector itself lives in aa-env (context.xml DB_BACKEND).

Out of scope: removing either driver; the SQLite dialect itself (exists, M11); backend pruning (M12).

##### Completion Criteria

- Both mariadb-java-client and sqlite-jdbc ship in the WARs; the persistence path is verified against MariaDB and against SQLite on the deploy path, both on one aa-env commit (T4, T5); the selectable-backend contract is documented and agrees with aa-env's parallel model.

##### Dependencies And Decisions

- M11 (SQLite path, Complete); D8.
- D28 (2026-09-18): keep MariaDB and SQLite in parallel and select the backend at install, superseding the SQLite-only end state of D11 and D13. Aligns with the aa-env owner's parallel/selectable decision (2026-09-18); aa-env relies on both drivers staying in the WARs.
- 2026-09-21: jna and jna-platform (5.13.0, runtime) are declared explicitly in the pom and allowlisted for analyze-only, so the MariaDB Unix-socket (localSocket) path no longer relies on jna arriving transitively through mariadb-java-client and waffle-jna; a future drop now shows as a visible dependency change rather than a runtime-only socket failure. Landed 85f0f179; coordinated with the aa-env JNA gate.
- Observation (2026-09-23, ansible-provision soak pilot: one Rocky Linux 8.10 VM, aa-maven 3c96141d built by aa-env 6a026d4, four instances, 11 scalar PVs at 1 Hz, 31.5 h continuous): archiving, STS-to-MTS ETL and spot retrieval ran against MariaDB 10.3.39 over loopback TCP through the JNDI DataSource jdbc/archappl with zero JVM restarts and flat memory. The configuration schema had not been loaded on that deployment (SHOW TABLES empty; mgmt logs Table 'archappl.PVTypeInfo' doesn't exist, and the same for PVAliases), so every MySQLPersistence write failed and PV configuration lived only in memory, which would not survive an appliance restart; archiving, ETL and retrieval were unaffected, which is why functional checks pass. The cause is in the aa-env provisioning path, confirmed by aa-env and filed as jeonghanlee/epicsarchiverap-env#47 (open as of 2026-09-23): sql.fill checks the database through an admin account that the externally provisioned mode never creates, so the check fails and sql.fill exits 0 without loading the schema. The artifact is not the cause: the 3c96141d release tarball ships install_scripts/archappl_mysql.sql and install_scripts/archappl_sqlite.sql, and archappl_mysql.sql defines PVTypeInfo, PVAliases, ArchivePVRequests and ExternalDataServers (verified 2026-09-23). Scope implication for plan step 2: the documented selectable-backend contract must state that the matching schema file is loaded at install and name a post-load table check. Related jeonghanlee/epicsarchiverap-env#21 and jeonghanlee/epicsarchiverap-env#30. Recheck: SHOW TABLES on the deployed config database; ansible-provision's written soak report (received 2026-09-23); the state of jeonghanlee/epicsarchiverap-env#47.
- Observation (2026-09-24 to 2026-09-26, ansible-provision soak and load test reported by LAB-ansible-provision: one Rocky Linux 8.10 VM with 2 vCPU and 3.6 GiB RAM, aa-maven 3c96141d built by aa-env 9eed006, four instances with a 256M heap each, MariaDB 10.3.39 over loopback TCP, a shortened store chain of STS PARTITION_5MIN, MTS PARTITION_HOUR and LTS PARTITION_DAY): the configuration schema was loaded and PVTypeInfo matched every registration, so the pilot's empty-schema gap is closed on this path. Day 1 archived 100 PVs of six name shapes and several types for 24 h; every PV reached STS, MTS and LTS, and after a service restart all 100 were archived again within about a minute (gap 55 s). The load test grew to 903 PVs (about 1874 events/s, 8.1 GB/day) with the heap unchanged: no instance or mgmt outage, every PV reached LTS, and 42417 retrieval requests from four clients over 6 h all answered HTTP 200 (median 31 ms, p99 98 ms); heap peaked at 251 MiB (etl, 10 full GCs) of 256. The ETL metric "Approximate time taken by last job in ETL(0>1)" grew about 9 s per hour to 277 s against the 300 s STS partition period; the per-run figures sent on 2026-09-27 show ETL kept up (0.69 s per pass, weekly usage 0.18 %) and the value was a running sum of per-PV durations (M25). Logging: retrieval writes about two INFO lines per request (RetrievalState.java line 209, DataRetrievalServlet.java lines 336 and 740, PlainPBStoragePlugin.java line 331), 12.8 MB/h under the load; etl writes one ERROR with a stack trace per STS partition per pass while a store is unwritable (2709 records in 10 minutes). The deployment predates the journald layout, so these lines went to catalina.out.
- G2 (2026-09-23): SQLite on the deploy path needs aa-env's SQLite deploy path (jeonghanlee/epicsarchiverap-env#43, open). This row is Blocked on G2; resume as Not started.
- G2 Complete (2026-09-27, bbe0968): this row resumed as Not started.
- G4 (2026-09-27): T4 and T5 need ansible-provision to deploy aa-env at or past bbe0968 with each backend; T5 can run as soon as the aa-env range deploys (item M17 of the ansible-provision register), T4 once the SQLite species also lands (item M18). T1 and T3 have passed; this row is Blocked on G4; resume as In progress.
- G4 Complete (2026-09-28): this row resumed as In progress, and T4 and T5 passed the same day on the deploy path (LAB-ansible-provision's report of 2026-09-28, recorded below), so the row is Complete.
- Observation (2026-09-24 02:18-02:37 UTC, LAB-epicsarchiverap-maven on a lab VM, not the deploy path): with a hand-built four-instance Tomcat 9.0.120 layout, the jdbc/archappl DataSource on mgmt only, no JDBC driver in any Tomcat lib directory, and WARs built at b7d4b1e4, both backends loaded the four tables from the shipped schema files, reported SQL Dialect MySQL and SQL Dialect SQLite, archived and retrieved a softIocPVX PV (71 and 96 samples), held its PVTypeInfo row, and kept archiving after a restart, with no SQLITE_BUSY, driver-loading or persistence error. The owner directed a rerun on the real deploy path, so this is not recorded as T2; it shows the artifact's persistence path works when the environment is wired as the contract states. The harness scripts were held in that session and the VM is destroyed, so this observation cannot be rechecked as run.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-09-27, owner accepted the plan as revised on 2026-09-27
Implementation Authorization: 2026-09-27, owner authorized implementation of this plan
Superseded Plan Artifacts: the earlier remove-MariaDB plan (superseded 2026-09-18); the new page docs/book/src/sysadmin/persistence-backends.md and the trims of installguide.md and sqlite.md in step 2 (superseded 2026-09-25: the book rewrite at 37c9aadc removed both pages and made docs/book/src/persistence.md the contract page); step 3 as written on 2026-09-24, which deployed aa-env at the ansible-provision pin and ran SQLite only after G2 (superseded 2026-09-27: both backends now run on one aa-env commit with the SQLite path)

Owner direction (2026-09-23): the contract is a new single page covering both backends. Owner direction (2026-09-23): the integration checks run on the real deploy path, ansible-provision (archiver_dev) plus aa-env, on a lab VM, executed by LAB-epicsarchiverap-maven on this session's request; nothing in the deployment is built by hand. MariaDB ran first (T2, aa-env 1fc20a8); with the SQLite path landed (G2), both backends run on one aa-env commit (T4, T5).

1. No code change for backend selection: MySQLPersistence already chooses the dialect from the JNDI DataSource's database product name (MySQLPersistence.java lines 69-77), and the DataSource name is jdbc/<dbname>, where <dbname> is the ARCHAPPL_DB_NAME environment variable and defaults to archappl (lines 54-62). Keep both drivers in the pom. Closes with T1.
2. Complete docs/book/src/persistence.md, written with the book rewrite (37c9aadc) and listed in docs/book/src/SUMMARY.md, as the selectable-backend contract page. The page must state: ARCHAPPL_PERSISTENCE_LAYER unset (MySQLPersistence is the default, DefaultConfigService.java lines 1948-1950) or set to the full class name org.epics.archiverappliance.config.persistence.MySQLPersistence; one JNDI DataSource named jdbc/<dbname> (ARCHAPPL_DB_NAME, default jdbc/archappl) whose driver selects MariaDB or SQLite, required only by the mgmt WAR, the only WAR that initializes the persistence layer (DefaultConfigService.java line 725, MGMT branch); the JDBC drivers come from the WARs (mariadb-java-client and sqlite-jdbc in each WAR's WEB-INF/lib) and are not copied into the Tomcat lib directory; the matching schema file loaded at install; a post-load check that PVTypeInfo, PVAliases, ArchivePVRequests and ExternalDataServers exist; and the consequence of a missing schema (configuration writes fail and PV configuration does not survive a restart). Compare the page with the context.xml template and DB_BACKEND selection that aa-env deploys (read from jeonghanlee/epicsarchiverap-env once its SQLite plan is revised), including where it places the JDBC drivers and which schema file it loads (the mgmt WAR's install/ or the release tarball's install_scripts/), and record each difference on the page or here. Closes with T3. Known differences from aa-env bbe0968 (site-template/context-sqlite.xml.in, configure/RULES_SQL), to apply on the page or record here: the page's SQLite example sets maxTotal, maxIdle and maxActive without a factory, while aa-env uses the tomcat-jdbc factory (org.apache.tomcat.jdbc.pool.DataSourceFactory) with maxActive 1, maxIdle 1, minIdle 0, initialSize 0, maxWait 10000, testOnBorrow true, validationInterval 30000 and validationQuery SELECT 1, so the example takes that form, with one line that the Tomcat 9 default factory (org.apache.tomcat.dbcp.dbcp2.BasicDataSourceFactory, confirmed in the Tomcat 9.0.121 catalina.jar and tomcat-dbcp.jar) reads maxTotal instead of maxActive; aa-env loads the schema from the source tree's archappl_sqlite.sql rewritten with IF NOT EXISTS through make sql.fill, while the page's manual setup loads the tarball's install_scripts/archappl_sqlite.sql, and both stay described; aa-env renders jdbc/archappl in every instance's context.xml (reported by aa-env), while only mgmt uses it, recorded as a harmless difference. The file /arch/config/archappl.sqlite, WAL, the drivers from the WARs and the resource name already match.
3. Deploy the appliance on a lab VM with ansible-provision and aa-env, with aa-env at bbe0968 or later instead of the ansible-provision pin recorded on 2026-09-24 (1fc20a8, which predates the SQLite path), and aa-maven at the commit under test; record both commits with each result. Run the checks for both backends on that same aa-env commit, because bbe0968 also changed the MariaDB path (the backend selection in configure/RULES_PROPERTIES and configure/RULES_SQL, and the unit's mariadb.service dependency): MariaDB with the default backend (T5), SQLite with DB_BACKEND:=sqlite in ../CONFIG_SITE.local (T4). The test PV comes from softIocPVX run on the VM as a test input; it is not part of the deployment under test. Check, on each deployed appliance: the deploy loaded the schema itself, the mgmt log reports the matching SQL Dialect, where the JDBC driver is loaded from, archive and retrieve of a softIocPVX PV, its PVTypeInfo row, and archiving after a restart through the deployed service. Deployment tooling (LAB-ansible-provision, 2026-09-27, from roles/archiver_build/defaults/main.yml on its branch m14-middleware-reconcile at 3e38060): archiver_env_ref sets the aa-env commit (default 9eed006) and archiver_maven_src_tag sets the aa-maven commit written to aa-env as SRC_TAG (default 3c96141d), each overridden with -e in ANSIBLE_OPTS. An aa-env ref at or past bbe0968 has not been deployed through ansible-provision; it needs the journald unit, the log4j2 routing that requires aa-maven 9bbd69bf or later and the WAR layout of aa-maven 67be91d7 or later, which ansible-provision plans as item M17 of its register. A SQLite backend is not supported yet: the role writes ../CONFIG_SITE.local without a DB_BACKEND passthrough, and a sqlite operator with an archiver-dev-sqlite species (archiver_db_backend: sqlite) is planned as item M18 of its register, after its M17. T4 and T5 therefore wait for those two items, tracked here as G4.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Static | Confirm both mariadb-java-client and sqlite-jdbc are declared and ship in the WARs | repository and built WARs | Both present |
| T2 | Integration | MariaDB on the deploy path: deploy with ansible-provision and aa-env (aa-env at the pinned commit, aa-maven at the commit under test); serve one PV from softIocPVX on the VM; SHOW TABLES; mgmt log RDB Engine and SQL Dialect lines; driver source (WAR WEB-INF/lib or a Tomcat lib jar); archivePV, getPVStatus, getData.json; PVTypeInfo row (mysql); restart through the deployed service, then getPVStatus and getData.json; error scan of every instance log | Lab VM (Rocky Linux 8.10) deployed by ansible-provision and aa-env | The deployed aa-env and aa-maven commits are recorded; the deploy loaded the four tables; SQL Dialect MySQL; the PV archives and retrieves; PVTypeInfo holds its row; the PV is still archived after the restart; no driver-loading, persistence or ConfigException line |
| T3 | Review | Second-person pass on docs/book/src/persistence.md; mdbook build | docs/book Docker build | A cold reader can select either backend, load its schema and confirm the tables; the contract agrees with aa-env's deployed context.xml and DB_BACKEND selection, or each difference is recorded; the book builds with no broken links |
| T4 | Integration | SQLite on the deploy path: T2's checks with aa-env's SQLite backend (sqlite3 .tables and query) | Lab VM deployed by ansible-provision and aa-env at bbe0968 or later with DB_BACKEND:=sqlite | Same as T2 with SQL Dialect SQLite and no SQLITE_BUSY line |
| T5 | Integration | MariaDB on the deploy path again: T2's checks on the same aa-env commit as T4 | Lab VM deployed by ansible-provision and aa-env at bbe0968 or later, default backend | Same as T2 |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-27 | repository and the WARs built from 9c1a3df6 | Pass | pom.xml declares mariadb-java-client 3.3.3 and sqlite-jdbc 3.53.4.0 at runtime scope; the mgmt, engine, etl and retrieval WARs of ./mvnw -B -ntp clean package -DskipTests each hold both jars in WEB-INF/lib |
| T2 | 2026-09-24 08:48-09:02 UTC | Lab VM, Rocky Linux 8.10, deployed by ansible-provision a3f9949 (species archiver_dev, PLAY RECAP failed=0) with aa-env 1fc20a8 and aa-maven b7d4b1e4 (SRC_TAG, WARs built on the VM by aa-env); OpenJDK 21.0.12.1, Tomcat 9.0.121, MariaDB 10.3.39; executed by LAB-epicsarchiverap-maven | Pass | The deploy created PVTypeInfo, PVAliases, ArchivePVRequests and ExternalDataServers (create_time inside the apply window, nothing loaded by hand); mgmt log RDB Engine MariaDB 10.3.39, RDB Driver MariaDB Connector/J 3.3.3, SQL Dialect MySQL, again after the restart; the drivers exist only in each webapp's WEB-INF/lib and the Tomcat lib holds only tomcat-jdbc.jar; aatest:ramp reached Being archived and returned 105 samples; its PVTypeInfo row holds DBR_SCALAR_DOUBLE for appliance0; after systemctl restart of the unit it was Being archived again and returned 197 samples with one 53 s gap; no ClassNotFoundException, No suitable driver, ConfigException, persistence or SQLException line in any instance log. Recheck: make archiver_dev.rocky8 with archiver_maven_src_tag set, then SHOW TABLES, the mgmt log grep, archivePV, getPVStatus, getData.json, the PVTypeInfo query, a unit restart and the error grep |
| T3 | 2026-09-27 | docs/book Docker build, pinned mdBook 0.4.52 and mdbook-admonish 1.20.0 | Pass | persistence.md compared with aa-env bbe0968: the SQLite example takes the tomcat-jdbc form of site-template/context-sqlite.xml.in with the DBCP2 maxTotal note, a deployment-path section records DB_BACKEND, make sql.fill (as root for SQLite) and its IF NOT EXISTS schema, and unused Resources in the other instances are noted. Second-person pass, first round: four minor findings applied (create the SQLite file as the Tomcat user, the -wal and -shm file names, the MariaDB Resource of aa-env differing in pool values, sql.fill run as root); second round against aa-env's docs/README.install.md: sql.fill needs root only for SQLite, one sentence over 40 words split, and make sql.show added as the deployment-path check; a third reading found nothing further. The schema load and .tables ran with sqlite3 on the repository's archappl_sqlite.sql (four tables), WAL mode produced archappl.sqlite-wal and archappl.sqlite-shm, and the book builds with only the mdbook-admonish 0.4.51 notice; the sudo -u form was not run, as the build host has no Tomcat account |
| T4 | 2026-09-28 16:20-16:33 UTC | Two fresh lab VMs (2 vCPU, 4 GiB), Rocky Linux 8.10 and Debian 13, deployed by ansible-provision 0a3d4e4 (branch m14-middleware-reconcile, jeonghanlee/ansible-provision#28; make archiver_dev_sqlite.rocky8 and make archiver_dev_sqlite.debian13, failed=0) with aa-env d09dca7a and aa-maven 2fc12f01 (SRC_TAG), CONFIG_SITE.local carrying DB_BACKEND:=sqlite and no DB_USER_PASS or DB_SOCKET; executed and reported by LAB-ansible-provision | Pass | Reported by LAB-ansible-provision, not inspected from this session: no MariaDB package or unit on either host and the unit's Requires= holds only sysinit.target and system.slice; /arch/config/archappl.sqlite (mid-srv, 0644, 36864 bytes) lists ArchivePVRequests, PVAliases, ExternalDataServers and PVTypeInfo through make sql.show and sqlite3 .tables; mgmt log RDB Engine SQLite 3.53.4 and SQL Dialect SQLite; the driver is the mgmt WAR's WEB-INF/lib/sqlite-jdbc-3.53.4.0.jar (mariadb-java-client-3.3.3.jar beside it); the softIocPVX PV M18:T:CNT reached Being archived, getData.json returned 24 (Rocky) and 21 (Debian) samples over two minutes, and its PVTypeInfo row reads back with sqlite3; after systemctl restart of the unit (10 s) it was Being archived again with 44 and 43 samples over the next minute; SQLITE_BUSY 0 over the whole unit journal; the only ERROR lines are the two BasicDispatcher start-up lines per start; a re-apply of the species reported changed=0. Recheck: the same make target with archiver_env_ref, archiver_maven_src_tag and the archiver_dev_sqlite species, then make sql.show, the mgmt log grep, archivePV, getPVStatus, getData.json, the sqlite3 query, a unit restart and the journal grep |
| T5 | 2026-09-28 16:20-16:33 UTC | One fresh lab VM (2 vCPU, 4 GiB), Rocky Linux 8.10, deployed by ansible-provision 0a3d4e4 (make archiver_dev.rocky8, failed=0) with the same aa-env d09dca7a and aa-maven 2fc12f01, CONFIG_SITE.local carrying DB_BACKEND:=mariadb, DB_USER_PASS and DB_SOCKET:=/run/mariadb/mariadb.sock; executed and reported by LAB-ansible-provision | Pass | Reported by LAB-ansible-provision, not inspected from this session: the unit's Requires= includes mariadb.service and the DataSource uses the socket; SHOW TABLES lists the same four tables; mgmt log RDB Engine MariaDB 10.3.39 and SQL Dialect MySQL; the same two driver jars in the mgmt WAR; M18:T:CNT reached Being archived with 26 samples, its PVTypeInfo row reads back over the socket with mysql, and after the 10 s restart it was Being archived again with 45 samples; SQLITE_BUSY 0 and the same four start-up ERROR lines only; re-apply changed=0. Recheck: as T4 with the archiver_dev species and mysql in place of sqlite3 |

##### Closure Evidence

- Deliverable: both drivers declared at runtime scope in pom.xml and shipped in every WAR (T1 at 9c1a3df6; the explicit jna declaration for the MariaDB socket path at 85f0f179); the contract page docs/book/src/persistence.md written in the book rewrite (37c9aadc) and matched to aa-env bbe0968 at 82709929 (T3).
- Verification: T1 to T5 Pass; T2 (2026-09-24) and T4 and T5 (2026-09-28) on the real deploy path, both backends of T4 and T5 on one aa-env commit (d09dca7a) as the plan requires.
- Gates: G2 Complete 2026-09-27; G4 Complete 2026-09-28.
- Issue #5 closed 2026-09-28T17:07:50Z (reason completed) under Issue scope, after its body was brought in line with the shipped page and the deploy-path results; observed closed the same day (GitHub Projection).

##### GitHub Projection

Title: Make the configuration database selectable between MariaDB and SQLite
Labels: enhancement
GitHub Milestone: none
Observed State: closed
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-09-28 (gh issue view 5 --repo jeonghanlee/epicsarchiverap-maven --json state,closed,closedAt,labels,milestone,assignees,updatedAt: closed 2026-09-28T17:07:50Z, enhancement, no milestone, assignee jeonghanlee; the close ran with --reason completed; the body was re-projected under Issue scope the same day with the deploy-path results and the checked acceptance list, and the close comment names the commits)

#### M14 - Build self-sufficiency (no build-time network, pip, or scp)

Origin: daff1b7 / M14
Identity History: none
GitHub Issue: none
Status: Complete

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
- The scp and sphinx items are superseded by M16 (2026-09-18); this row retains the svg_viewer vendoring (owner decision 2026-09-18: vendor the built viewer.zip and let the build copy it).

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner, 2026-09-18
Implementation Authorization: owner, 2026-09-18
Superseded Plan Artifacts: none

1. Vendor svg_viewer as a committed viewer.zip; the existing stage-resources copy stages it into the retrieval WAR (a30d8cd3).
2. Sphinx and scp were removed from the build by M16 (D14); no per-build pip install or scp invocation remains.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Build with outbound network blocked | JDK 21, wrapper Maven, offline | Four WARs build; no network, scp, or pip step runs |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-18 | JDK 21, wrapper Maven, offline (-o) | Pass | Offline clean package BUILD SUCCESS; four WARs; retrieval WAR ui/viewer.zip sha256 663ff74d equals the vendored source; pom has no get/scp/pip step; a30d8cd3 |

##### Closure Evidence

- Deliverable: svg_viewer vendored as src/main/org/epics/archiverappliance/retrieval/staticcontent/viewer.zip; the build-time GitHub download is removed from pom (a30d8cd3). scp and sphinx were removed earlier by M16 (D14).
- Verification: T1 Pass (2026-09-18) - offline clean package produced the four WARs with no network, scp, or pip; the retrieval WAR ships ui/viewer.zip identical to the vendored source.
- Refresh procedure documented in docs/svg-viewer.md.

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
Status: Complete

##### Summary

The test source tree holds 20 classes that are not tests but main() dev and data-generation utilities (for example GenerateData, Generate100KPerfHarness, GetFileTime, GZIPUtil, GenerateLargeDB). They are compiled with the tests and four of them carry hard-coded /scratch or /tmp paths. They are not run by Surefire; the standalone ones do not belong in src/test, though a few support @Test classes and stay as fixtures.

##### Scope

Move the main() utilities to a dedicated source location (a tools module or src/tools), or remove the ones with no current use; fix or drop the hard-coded /scratch and /tmp paths in the ones that are kept.

Out of scope: the actual @Test classes; the 17665 literal cleanup (M8 reinforcement).

##### Completion Criteria

- src/test contains only JUnit test classes and their support; standalone utilities live under src/tools or are removed. A test-referenced fixture may stay in src/test and retain a documented main(); no kept utility carries a hard-coded absolute path.

##### Dependencies And Decisions

- D11 (Phase 1); D14.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner, 2026-09-18
Implementation Authorization: owner, 2026-09-18
Superseded Plan Artifacts: none

1. Move the 16 utilities not referenced by any @Test to a new src/tools source root, compiled only under the opt-in -Ptools profile (build-helper add-test-source), out of the default build and the WARs.
2. Keep the four @Test-referenced fixtures (GenerateData, PVCaPut, GenerateLargeDB, GZIPUtil) in src/test; drop the dead GZIPUtil.main() and parameterize the /scratch and /tmp paths via the archappl.tools.dataDir system property (default java.io.tmpdir).
3. Confirm default test-compile and the unit set are unaffected, and that src/tools compiles under -Ptools.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Static | Search src/test for `static void main` in non-fixture classes and for absolute /scratch or /tmp paths | source tree | Only @Test-referenced fixtures retain main(); no absolute path remains |
| T2 | Unit | ./mvnw -o test with bounded heaps | JDK 21, wrapper Maven | Same unit-set result as before the move |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-18 | source tree | Pass | 16 utilities moved to src/tools; the four remaining src/test main() are @Test-referenced fixtures; no /scratch or /tmp absolute path remains in src/test or src/tools (grep) |
| T2 | 2026-09-18 | JDK 21, wrapper Maven, offline capped heaps | Pass | ./mvnw -o test (MAVEN_OPTS=-Xmx1g, -DargLine=-Xmx2g, -DforkCount=1, -DreuseForks=true): 778 tests, 0 failures, 0 errors, identical to the pre-move unit set; default test-compile 169 and -Ptools 185 both SUCCESS |

##### Closure Evidence

- Deliverable: 16 non-test main() utilities relocated from src/test to a new src/tools source root, compiled only under the opt-in -Ptools profile and excluded from the WARs. The four @Test-referenced fixtures stay in src/test; GZIPUtil.main() (dead demo) removed; hard-coded /scratch and /tmp paths in ConvertGnuplotData, GetFileTime, and GeneratePBFileAndCompress parameterized via the archappl.tools.dataDir system property.
- Verification: T1 Pass and T2 Pass (778/778) on 2026-09-18, both observed by execution.

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
Status: Complete

##### Summary

D2 and D3 require one GitHub issue per M row in this repository. GitHub issues are currently disabled on aa-maven, so no row can be projected to an issue until the owner enables the repository issues setting. This gate blocks the per-row issue projection, not the milestone deliverables themselves.

##### Completion Criteria

- gh api repos/jeonghanlee/epicsarchiverap-maven reports has_issues=true.

##### Verification Results

| Observed At | Result | Evidence |
| --- | --- | --- |
| 2026-09-11 | Pending | gh api reports has_issues=false |
| 2026-09-24 | Complete | gh api reports has_issues=true after the owner enabled Issues; the first issue, #1, was created the same day |

##### Closure Evidence

- 2026-09-24: gh api repos/jeonghanlee/epicsarchiverap-maven reports has_issues=true (owner enabled the repository Issues setting); issue #1 exists.

#### G2 - aa-env SQLite deploy path

Origin: daff1b7 / G2
GitHub Issue: none
Status: Complete

##### Summary

M13 verifies each backend on the real deploy path. aa-env deployed only MariaDB when this gate was opened (2026-09-23); its selectable-backend work (jeonghanlee/epicsarchiverap-env#43) adds the SQLite path. Until it landed, M13 / T4 could not run.

##### Completion Criteria

- A landed aa-env commit deploys the appliance with the SQLite backend. (Revised 2026-09-27 from "jeonghanlee/epicsarchiverap-env#43 is closed by such a commit": #43 also carries a MariaDB Unix-socket transport step that M13 does not need, because M13 verified MariaDB over TCP.)

##### Verification Results

| Observed At | Result | Evidence |
| --- | --- | --- |
| 2026-09-23 | Pending | gh api reports jeonghanlee/epicsarchiverap-env#43 open |
| 2026-09-27 | Pass | jeonghanlee/epicsarchiverap-env bbe0968 (Select MariaDB or SQLite for the configuration database) is an ancestor of the fetched aa-env origin/modernize (git merge-base --is-ancestor bbe0968 origin/modernize in the aa-env checkout); aa-env reported the SQLite deploy verified on a disposable Rocky Linux 8.10 VM without mariadb-server on 2026-09-26 |

##### Closure Evidence

- Owner decision (2026-09-27): close the gate on the landed SQLite deploy path instead of waiting for #43, whose remaining MariaDB Unix-socket step is not scheduled and does not change the SQLite path (aa-env, 2026-09-27).
- Landed: bbe0968 on aa-env origin/modernize. Install with DB_BACKEND:=sqlite in ../CONFIG_SITE.local and the ordered steps of docs/README.install.md, step 5 (make sql.fill) as root.

#### G3 - Journald layout observed on a deployed host

Origin: daff1b7 / G3
GitHub Issue: none
Status: Complete

##### Summary

M18's layout and its page take effect only on a deployment where epicsarchiverap-env runs the four JVMs in the foreground through systemd-cat and no longer ships its own log4j2.xml. That observation belongs to aa-env's second logging item, which is itself gated on M18's layout commit (aa-env G14).

##### Completion Criteria

- epicsarchiverap-env reports, for a deployed host running a WAR at or after M18's layout commit, that each archappl-<component> identifier carries ERROR lines at PRIORITY 3 and INFO lines at PRIORITY 6.

##### Verification Results

| Observed At | Result | Evidence |
| --- | --- | --- |
| 2026-09-24 | Pending | aa-env's first logging item awaits its owner's acceptance; the second follows it |
| 2026-09-25 01:15 UTC | Complete (aa-env observation) | aa-env M34 / T2 on a Rocky Linux 8.10 VM, systemd 239, Tomcat 9.0.121, WARs built by aa-env from 67be91d7 and installed by make install (aa-env 1400ae7): every webapp carries WEB-INF/classes/log4j2.xml with monitorInterval="30"; archappl-mgmt, archappl-engine, archappl-etl and archappl-retrieval carry INFO at PRIORITY 6 and WARN at 4; a provoked mgmt ERROR arrived at 3; ARCHAPPL_ROOT_LOGGER_LEVEL=WARN removed INFO lines; a site copy and log4j2-tomcat.xml stayed separate and reloaded without a restart |
| 2026-09-25 02:59 UTC | Complete (this repository's run) | The four real WARs built from 5e6c1266 as four Tomcat 9.0.121 instances under systemd-cat --identifier=archappl-<component>-g3 on a Debian 13 host, one provoked ERROR per component (mgmt modifyMetaFields, engine changeArchivalParameters, etl consolidateDataForPV, retrieval getClientConfig): each identifier carried its ERROR at PRIORITY 3 and its INFO lines at 6, covering the ERROR mapping for the three components the aa-env report did not provoke |

##### Closure Evidence

- Owner decision (2026-09-25): closed on the aa-env M34 / T2 report together with this repository's four-instance run, which together show ERROR at PRIORITY 3 and INFO at 6 under every archappl-<component> identifier.

#### G4 - ansible-provision deploy path for aa-env with SQLite

Origin: daff1b7 / G4
GitHub Issue: none
Status: Complete

##### Summary

M13 / T4 and T5 run on the real deploy path, ansible-provision plus aa-env on a lab VM, with aa-env at or past bbe0968 (the commit that adds the SQLite path). On 2026-09-27 LAB-ansible-provision reported that its archiver_build role has not deployed that aa-env range yet (item M17 of the ansible-provision register: the journald unit, the log4j2 routing and the WAR layout it needs) and cannot select a SQLite backend yet (item M18 of that register: a sqlite operator and an archiver-dev-sqlite species). T5 (MariaDB) needs only the first item and can run once it lands; T4 (SQLite) needs both. The gate closes when both have landed.

##### Completion Criteria

- LAB-ansible-provision reports that ansible-provision deploys aa-env at or past bbe0968 with the MariaDB backend and with the SQLite backend, and names the variables that select the aa-env commit, the aa-maven commit and the backend.

##### Verification Results

| Observed At | Result | Evidence |
| --- | --- | --- |
| 2026-09-27 | Pending | LAB-ansible-provision: neither item has landed; it will report when they do |
| 2026-09-28 | Complete | LAB-ansible-provision (cross-session report, 2026-09-28): ansible-provision 0a3d4e4 (branch m14-middleware-reconcile, jeonghanlee/ansible-provision#28) deployed aa-env d09dca7a with aa-maven 2fc12f01 on three fresh lab VMs, 16:20 to 16:28 UTC, failed=0: Rocky Linux 8.10 and Debian 13 with SQLite (species archiver-dev-sqlite) and Rocky Linux 8.10 with MariaDB (species archiver-dev). The selecting variables, read from that commit: archiver_env_ref (roles/archiver_build/defaults/main.yml line 20) for the aa-env commit; archiver_maven_src_tag (line 28) for the aa-maven commit, written as SRC_TAG into configure/RELEASE.local of the aa-env tree (roles/archiver_build/tasks/main.yml line 212); archiver_db_backend (line 136, default mariadb; inventory/group_vars/archiver_dev_sqlite.yml line 10 sets sqlite for the archiver-dev-sqlite species) for the backend, written as DB_BACKEND into CONFIG_SITE.local (tasks/main.yml line 172). The three values are stamped on each host in /var/tmp/archiver-build.config as envref, srctag and db |

##### Closure Evidence

- Closed 2026-09-28 on LAB-ansible-provision's report; the deployed hosts were not inspected from this session. M13 / T4 and T5 ran on that deployment the same day.

#### M16 - mgmt API reference generated from code

Origin: daff1b7 / M16
Identity History: none
GitHub Issue: none
Status: Complete

##### Summary

The mgmt API reference is produced by a relay of nine build steps across four folders: `BPLServlet` dumps the action registry to `docs/api`, a javadoc taglet emits marker text, `scp` copies it, `ProcessMgmtScriptables` stitches a template, and sphinx renders the result into the mgmt WAR's `ui/help`, using java, scp, and Python. Replace the relay with one Java generator that reads the `BPLServlet` action registry and a `@BPLEndpoint` annotation on each action and writes the API reference directly into the mgmt WAR stage, so the reference is a byproduct of compilation with no intermediate files, no scp, and no Python.

##### Scope

Define `@BPLEndpoint` (with `@Param`) carrying summary, parameters, and the scriptable flag; annotate the BPL action classes with the descriptions now held in taglet comments, incrementally (an unannotated action still lists by path); one exec-java generator at `process-classes` that joins the registry (paths) with the annotations (metadata) and writes `ui/api/index.html` and `api.json` into the mgmt staticcontent stage; remove the relay executions (`generateBPLActionsMappings`, `copy-mgmtpathmappings-for-processing`, `check-mappings-file-before-javadoc`, `copy-mgmt_scriptables-for-package`, `generateJavaDocTagletScriptables`), the taglet wiring, the `docs/api` text handoffs and template, and the sphinx execution from the package phase. Optional: a `/mgmt/bpl/getEndpoints` action serving the same data at runtime.

Out of scope: the narrative Sphinx content and its delivery (M9, M5); svg_viewer vendoring (M14); plain javadoc for the Java API (may remain, off the critical path).

##### Completion Criteria

- `./mvnw -B clean package -DskipTests` produces the four WARs with no scp, taglet, sphinx, or network step for documentation.
- The mgmt WAR contains `ui/api/index.html` listing every action registered in `BPLServlet` (GET and POST) with its annotation metadata.
- A test asserts that every registered action appears in the generated reference (registry to document agreement).

##### Dependencies And Decisions

- D14 (small and strong). Supersedes the scp and sphinx items of M14; M14 retains svg_viewer vendoring.

##### Implementation Plan

Plan Status: accepted; implementation authorized
Plan Acceptance: Design accepted by owner 2026-09-18 (code as the single source, one generator, in-place output, sphinx decoupled from package)
Implementation Authorization: owner, 2026-09-18
Superseded Plan Artifacts: none

1. Add the `@BPLEndpoint` and `@Param` annotations.
2. Write the generator that reads the `BPLServlet` registries and annotations and emits `ui/api/index.html` and `api.json` into the mgmt staticcontent stage.
3. Wire one exec-java execution at `process-classes`; remove the five relay executions, the taglet wiring, the scp exec, and the sphinx exec from package.
4. Annotate the BPL actions, moving descriptions out of the taglet comments.
5. Add the registry to document agreement test.
6. Optional: add the `/mgmt/bpl/getEndpoints` action.
7. Verify the offline package and the mgmt WAR content.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit | Run the generator against the `BPLServlet` registries and compare with the emitted reference | JDK 21 | Every registered GET and POST action appears in the generated HTML and JSON |
| T2 | Integration | `./mvnw -B clean package -DskipTests` with outbound network blocked | JDK 21, wrapper Maven, offline | Four WARs; mgmt WAR contains `ui/api/index.html`; no scp, taglet, or sphinx step runs |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-18 | JDK 21 | Pass | ApiReferenceGeneratorTest: all 90 registered actions (GET and POST) appear in generated index.html and api.json |
| T2 | 2026-09-18 | JDK 21, wrapper Maven, offline (-o) | Pass | mvn -o package -DskipTests: four WARs; mgmt WAR ui/api/index.html + api.json with 90 documented endpoints; no scp/taglet/sphinx step; javadoc clean |

##### Closure Evidence

- ApiReferenceGenerator emits ui/api into the mgmt staticcontent stage; 53 taglet descriptions moved to @BPLEndpoint and 37 undocumented actions annotated (summaries from javadoc, action logs, or execute behavior; nothing invented); relay executions, taglet, scp, and package-phase sphinx removed; default suite 778/778; Help link points at ui/api

##### GitHub Projection

Title: Generate the mgmt API reference from code
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: never

#### M17 - Modernize the narrative doc content for the single-instance fork

Origin: daff1b7 / M17
Identity History: none
GitHub Issue: #6
Status: Complete

##### Summary

The mdBook pages migrated by M9 are largely upstream (SLAC) content and describe features and assumptions this fork does not carry: appliance clustering and multi-appliance deployment (retired by D23, D26), CS-Studio and ArchiveViewer integration, MySQL-first persistence, and other pre-modernization material. M9 migrated their format and corrected the build/test/deploy commands but did not modernize the substance (D30).

##### Scope

Reconcile the narrative content to the single-instance fork and the EPICS-Arche boundary (D12): correct or remove clustering/multi-appliance material, retired integrations, and stale runtime assumptions, and update the feature overview. The remaining scripting work delivers usable examples for the fork's supported operations, with the appliance implementation and actual behavior as their basis.

Out of scope: the docs publishing pipeline (M9, done); EPICS-Arche architecture docs; a general Python SDK; new appliance architecture or unrelated server features. Existing BPL defects that prevent a required example are identified before deciding whether their correction belongs here or in an existing milestone.

##### Dependencies And Decisions

- D30 (content modernization deferred here); D12, D23, D26 (scope basis). The remaining scripting work follows the revised purpose recorded below.
- M35 is the separately authorized correction for the real hidden deletion failure reproduced by T26 on 2026-09-30. It is Complete on 2026-10-01: the correction landed as 48c0a692, the unchanged real fault assertions and T10/affected deletion workflow checks pass, and issue #18 is closed as completed. This satisfies the server dependency for M17's deletion scope; disconnection reporting and final inventory remain separate.
- Decision Date: 2026-10-01. Include the disconnection endpoint's server error propagation in M17's next draft scope. Reproduce the real engine-query failure before correcting the server, then implement and verify the CLI. The server correction is a behavioral prerequisite for distinguishing a healthy empty report from an unavailable report. Scope selection alone did not accept the full plan or authorize implementation; the separate approvals are recorded below. This scope does not reopen M35 or issue #18.
- Owner decision (2026-09-24), the first cut item: remove the upstream-era install samples, because this fork deploys through aa-env. That covers the release-tarball fileSets in src/assembly/release.xml for quickstart.sh, install_scripts (sampleStartup.sh, deployMultipleTomcats.py, addMysqlConnPool.py, single_machine_install.sh) and sample_site_specific_content, whose source docs/docs/source/samples no longer exists, so the tarball has shipped none of them since the docs moved to docs/book (observed 2026-09-24: a tarball of be070db5 lists none); the same scripts under docs/book/src/samples; the mgmt WAR's install/deployMultipleTomcats.py (pom.xml mgmt-war webResources); and the passages that cite them in sysadmin/installguide.md, sysadmin/site_specific.md and sysadmin/quickstart.md. The rest of the keep/cut list is still the owner's to give.
- Owner decision (2026-09-24), further cut items: src/sitespecific/slacdev, the SLAC development site, whose own build script fails (src/sitespecific/slacdev/build.xml line 27, "Java returned: 1", observed 2026-09-24 with -Darchapplsite=slacdev) and which only sysadmin/customization.md (as its example) and multipleBuildAndDeploy.sh reference; and docs/book/src/samples/multipleBuildAndDeploy.sh, the upstream script that builds and deploys four Tomcat 7 instances with jsvc, superseded by aa-env. The customization.md example is rewritten when the site goes.
- Owner decision (2026-09-24), cut candidates to check first: the operator Python scripts under docs/book/src/samples (the top-level *.py BPL clients, pythonPBRaw/ and debug/), cut unless they still run against this fork's BPL on the current Python; and TESTING.md and mvnw.cmd, cut unless TESTING.md still describes this fork's test platform and a Windows build is still wanted.
- Owner decision (2026-09-25), the TESTING.md and mvnw.cmd candidates of step 2: keep TESTING.md, because it describes this fork's test platform (the default excludedGroups and the integration and localEpics profiles match pom.xml, and README.md and docs/book/src/developer.md defer the test wiring to it), with its one stale sentence on the browser-test rewrite corrected to the finished state; remove mvnw.cmd, because no Windows build is supported: CI runs only on ubuntu-24.04 and ubuntu-latest, the integration fixture runs catalina.sh (TomcatSetup.java line 188), and the book and README.md give only ./mvnw. After the removal ./mvnw -B -ntp validate passed (Maven 3.9.16). Step 2 now leaves only the Python BPL clients, checked by T5.

- Direction (2026-09-28): define the needed operations, implement and verify working behavior, then provide scripts such as getPVList.py and matching documentation. Existing sample survival is not the objective. This supersedes the Python keep/cut criterion of 2026-09-24; the completed install-sample, TESTING.md and mvnw.cmd decisions remain recorded above. The revised plan below is a draft requested on this date.
- Decision Date: 2026-10-02. Bash is the preferred language for the modularization investigation. Preserve the operational purpose accumulated in the existing scripts by mapping shared mechanics separately from target selection, request order, side effects and recovery checks. Scores and expected use frequency do not authorize removal. The completed research and this tracking update do not authorize a Bash replacement, a final support list, dependency changes or deletion; the delivered Python baseline and its accepted checks remain in force until a separately accepted amendment.
- Decision Date: 2026-10-02. Final inventory of the 25 CLIs and both helpers under `docs/book/src/samples`. No sample file is removed by this decision. Script modernization, including the implementation-language choice and the Bash/curl/jq proposal recorded below, is M37's scope and is no longer a completion criterion here.

  | Classification | Scripts |
  | --- | --- |
  | Supported; verified by this milestone | listArchivedPVs.py; getPVStatus.py; archivePVList.py; pausePVList.py; resumePVList.py; renamePVList.py; deletePVList.py; printCurrentlyDisconnectedPVs.py; helper archiverClient.py |
  | Retained unchanged; modernization assigned to M37 | unarchivedPVs.py; archivedPVsNotInList.py; listTypeChanges.py; checkConnectedPVs.py; checkTypeChangedPVs.py; storageSizeCheck.py; checkForEngineActivity.py; abortNeverConnectedPVs.py; resumePausedPVsMatchingPattern.py; consolidatePausedPVs.py; consolidateArchivedData.py; changeArchiveStore.py; addPostProcessingOperator.py; removeMetaFields.py; helper emailHandler.py |
  | Retained unchanged; unassigned until a later decision adds them to M37 | archiveFromDB.py (loads libdbStaticHost.so before argument parsing); pingCurrentlyDisconnectedPVs.py (requires PyEpics; Channel Access only) |
  | Excluded from the supported operations | stopArchivingCurrentlyDisconnectedPVs.py: it requests deleteData=true for every PV reported with lastKnownEvent Never without checking the pause result. The selection remains available from the lastKnownEvent field of the getCurrentlyDisconnectedPVs response, and the action from pausePVList.py and deletePVList.py as separate explicit steps. printCurrentlyDisconnectedPVs.py prints connectionLostAt only and does not show lastKnownEvent |

##### Completion Criteria

- Each page reflects the single-instance fork and its supported operations.
- Each required operation has an executable Python example, explicit inputs and dependencies, documented output and errors, and direct verification against the current appliance.
- A reader can start the M22 launcher and shipped IOC fixture and reproduce the documented workflow without editing a hostname in source or adding a routing proxy.
- The example inventory identifies the supported operations and any explicitly excluded operations; passing an old script alone does not satisfy these criteria.
- The final inventory accounts for all 25 current CLIs and both helpers, including distinct procedures that share endpoints, and classifies each as supported, retained for M37, retained without assignment, or excluded. The scripting page presents only the supported operations as verified. Modernization or replacement of a retained script is M37's criterion; research alone verifies no retained script.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-09-28, the listing contract under the new filename listArchivedPVs.py, followed by archive/status with option 1 (ASCII table); 2026-09-29, the pause/resume scope and the reviewed rename plan carried by 29447c39. 2026-09-30, the deletion scope reviewed as 9e17fea82c67a3fc9da1f7bd70ba1a53de31ba6924ab3750685a7c6daf8ae83e. 2026-10-01, the reviewed disconnection-reporting scope accepted at SHA-256 a8ca8ca88e5da72c2763ff617b76d16583ac7bfd45008327639eaae0b981db5e.
Implementation Authorization: 2026-09-28, implement and verify listing under a different name, then proceed with archive/status using the selected table output; 2026-09-29, implement pause/resume and resolve the server defect through M34 before returning to its verification, then implement the reviewed rename plan. 2026-09-30, implement and verify the reviewed deletion scope; any reproduced hidden deletion error requires separately authorized production correction. 2026-10-01, implement the accepted disconnection-reporting scope, including actual baseline failure reproduction, its management correction, CLI, tests, and documentation.
Review Findings Accepted: 2026-09-28, all four findings from the first third-person review: data assertions, partial batch failure, timeout/response tests, and server regression checks. The three findings from the third review (second-person) were also accepted on 2026-09-28: overlapping inputs, observable storage checks and process sequencing. Those review acceptances authorized draft revision. The later listing-stage authorization is recorded separately above. On 2026-09-28, the three code-review findings were accepted for correction: validate all output encoding before writing, clean up owned JVMs after launcher death, and reject unsupported timeout values.
Superseded Plan Artifacts: the 2026-09-25 plan was accepted and authorized, with steps 1 and 3 landed as recorded in Closure Evidence. Its Python keep/cut step 2 and T5 are superseded by this draft. The 2026-09-25 full book rewrite superseded the earlier page-by-page plan whose interim edits landed as 587907c8.

Owner decisions (2026-09-25) that shape this plan: in sysadmin/installguide.md, delete the four passages that cite the removed scripts and leave the rest of the page to step 3; delete sysadmin/quickstart.md; delete the site_specific_content sample and, in sysadmin/site_specific.md, only the sentences that depend on the removed scripts; drop slacdev from the example list in the ARCHAPPL_SITEID javadoc; run the T5 check on the M22 local launcher, so steps 1 and 3 and T1 to T4 proceed first and T5 waits for M22; delete the Python 2 samples without a run check, pythonPBRaw/ with it, because its only script reads the PB/HTTP stream in Python 2 and retrieval's JSON and CSV formats and the mgmt WAR's install/pbutils/pb2json.sh already cover that use.

1. Completed scope (landed 2026-09-25): apply the decided removals.
   - src/assembly/release.xml: delete the four fileSets that read docs/docs/source/samples (quickstart.sh; install_scripts with sampleStartup.sh, deployMultipleTomcats.py, addMysqlConnPool.py, single_machine_install.sh; the two sample_site_specific_content sets). The install_scripts *.sql and tomcat-log4j fileSets stay. Put the four WARs into the tarball as mgmt.war, engine.war, etl.war and retrieval.war: the WAR fileSet still listed those names after 5397967c renamed the built WARs to aa-<date>-<hash>-<component>.war, so the tarball has carried no WAR since, and Tomcat takes the context path from the file name.
   - pom.xml: delete the mgmt-war webResource that copies deployMultipleTomcats.py into install/. The install/*.sql and install/pbutils resources stay.
   - docs/book/src/samples: delete quickstart.sh, sampleStartup.sh, deployMultipleTomcats.py, addMysqlConnPool.py, single_machine_install.sh, multipleBuildAndDeploy.sh and site_specific_content/; delete pythonPBRaw/ (printDBRDouble.py and EPICSEvent_pb2.py) and debug/ (sumUpETLTimesFromPVDetails.py and typeInfoFromBackup.py), the Python 2 samples.
   - Delete src/sitespecific/slacdev; in src/main/org/epics/archiverappliance/config/ConfigService.java, drop slacdev from the ARCHAPPL_SITEID javadoc example list.
   - sysadmin/installguide.md: delete the "Using an install script" section, the provided-Python-script clause of "Details" item 4, the "Create individual Tomcat containers for each of the web apps" section, and the sampleStartup.sh sentence that ends "Stopping and starting the individual Tomcats"; point the opening sentence at jeonghanlee/epicsarchiverap-env instead of the Quickstart.
   - Delete sysadmin/quickstart.md and its SUMMARY.md entry; point the Quickstart link in index.md at jeonghanlee/epicsarchiverap-env.
   - sysadmin/site_specific.md: delete the sentence citing quickstart.sh and single_machine_install.sh and the three bullets on the site_specific_content folder; keep the @begin/@end tag and SyncStaticContentHeadersFooters description.
   - sysadmin/admin.md: replace the sentence that points at a samples folder under the mgmt webapp's ui/help/samples/, which the mgmt WAR does not ship, with a pointer to docs/book/src/samples in the repository.
   - sysadmin/customization.md: replace the slacdev example (an `ls src/sitespecific/` listing and `export ARCHAPPL_SITEID=slacdev`) with one that shows src/sitespecific holding default and tests and selects a site through ARCHAPPL_SITEID; correct the default site to `default` (pom.xml archapplsite), delete the build message no build step prints and the Downloads quickstart package, and replace the note that links the archived jeonghanlee/epicsarchiverap-sites with a pointer to jeonghanlee/epicsarchiverap-env.
   - sysadmin/installguide.md "Details" item 4 and sysadmin/admin.md: link item 4 to "Stopping and starting the individual Tomcats" and the samples sentence to the repository folder on GitHub.
2. Implement usable operation examples and verify the real workflow. Proposed scope for this revision:
   1. Define the operation contract in this detail and `docs/book/src/scripting.md`: purpose, BPL endpoint, inputs, output, state changes, dependencies, and an observable acceptance check. Start with the core operation table below. Map the other old samples to reporting, configuration, consolidation, IOC database import or notification needs; present any added scope or removal before implementing it. A missing local package is an environment finding, not a reason to remove a needed operation.
   2. Trace each core operation through `src/main/org/epics/archiverappliance/mgmt/BPLServlet.java`, its action implementation, and applicable `src/test` coverage. Use the existing BPL where it provides the contract. For a gap, record the actual failing operation and the smallest required correction before expanding server work; do not substitute a different response or bypass the failing path.
   3. Implement the Python 3 command-line examples under `docs/book/src/samples`, beginning with listArchivedPVs.py. Every HTTP example accepts an explicit BPL URL, has a finite timeout, validates HTTP and JSON/application responses, sends errors to stderr and returns nonzero on failure. Use a documented dependency set installable with system Python in an isolated environment; the core BPL examples must not require pyepics, an IOC parsing library or SMTP. A small shared HTTP helper is appropriate only for behavior actually shared by these examples; no general SDK is planned. Apply the batch and HTTP contracts below to every applicable example.
   4. Run listArchivedPVs.py directly against the current four-WAR appliance before implementing the remaining core examples. Then exercise archive, status, pause, resume, rename, disconnect reporting and deletion with real fixture PVs. Mutating tests use their own PV prefix and verify the resulting state and stored data. Keep the launcher, IOC, commands, outputs and API observations reproducible in a repository test procedure or runner; define its final path during implementation using the existing test layout. T5 uses every state/data assertion below. After any approved server correction, rebuild the WARs and run T10 before accepting the affected example checks; associate observations with the tested source revision and WAR digests.
   5. Write the user workflow in scripting.md: dependency installation, launcher and IOC setup links, exact command lines, expected output and state, and failure handling. Explain rename and deletion effects and require explicit selection of test PVs and data deletion. Execute the documented commands verbatim. Reconcile old sample links and files only against the accepted operation inventory and replacement coverage.

   Proposed core examples:

   | Operation | Deliverable under docs/book/src/samples | Required behavior |
   | --- | --- | --- |
   | List archived PVs | listArchivedPVs.py | Explicit BPL URL; optional glob; sorted unique PV names, one per line; explicit limit option; default complete listing using the supported limit=-1 request; empty match exits 0 |
   | Request archiving | archivePVList.py | Read a PV list, submit actual archive requests with sampling parameters, and distinguish request acceptance from Being archived |
   | Inspect status | getPVStatus.py | Report each requested PV's actual status, including pending and unknown PVs without claiming that a request is already archiving |
   | Pause and resume | pausePVList.py, resumePVList.py | Operate on the supplied PV list and report per-PV API failures; verification waits for the required state |
   | Rename | renamePVList.py | Consume old/new name pairs; require paused source PVs; copy configuration and data to the new name while retaining the paused old name; deletion of the old name is a separate explicit operation |
   | Delete | deletePVList.py | Consume an explicit PV list; default to deleteData=false; send deleteData=true only with --delete-data; report failed items and the paused-PV precondition |
   | Report disconnections | printCurrentlyDisconnectedPVs.py | Report actual disconnected PVs from the appliance; empty and nonempty reports are both valid results |

   This is an eight-script proposal covering seven operations. Additional configuration, ETL, import and notification examples require a stated user operation and acceptance check before inclusion; the 23 old script names do not set the required count.

   Batch and HTTP contracts:

   - Validate all arguments and input-file syntax before the first mutation. An unreadable file, malformed rename pair or invalid argument exits 2 with no request sent. Process valid records in input order. A per-PV API rejection is reported with that PV name, and processing continues for the remaining records; do not roll back successful earlier operations. Report each input's result, return 0 only when every requested operation succeeds, and return 1 if any request fails. Empty valid query results and an explicitly requested status of Not being archived are normal query results, not mutation successes.
   - Independent mutation records must not address the same PV identity. Strip surrounding whitespace but preserve case. Before any HTTP request, reject duplicate literal PV entries and reject rename inputs with old==new, repeated sources, repeated destinations, or any source also appearing as a destination (including A->B followed by B->C). Reject the whole input with exit 2 and identify the conflicting line numbers; do not silently deduplicate. Mutation inputs name individual PVs, not comma lists or glob patterns that expand to overlapping targets.
   - Before mutation, use read-only getPVTypeInfo lookups for existing names and compare the returned pvName identities as well as the input names, so aliases cannot bypass the overlap check. Repeat the disjointness check using these identities; a collision exits 2 with no mutation sent. A name confirmed absent uses its literal identity and remains subject to the requested operation's normal per-PV validation. If a lookup cannot distinguish absence from a transport or response failure, exit 1 before any mutation. Only the read-only identity checks may precede this validation failure; malformed local input still sends no HTTP request.
   - If a mutation times out, loses its connection or returns an invalid/unusable response, report the outcome as unknown rather than claiming rejection or success. Return 1, continue to the remaining records that passed the disjointness checks above, and do not retry mutations automatically. Document checking the PV's actual state before a manual retry. No transaction across a batch is promised.
   - Expose --timeout as a positive number of seconds, default 30 (listArchivedPVs.py accepts at most 86400 seconds), for finite connection and response-read timeouts on each HTTP request. Validate HTTP status, JSON syntax, expected response structure and endpoint-specific success fields. A nonempty validation message or explicit failure status fails the operation; a successful response containing an empty validation value remains valid. Unknown response structures fail rather than becoming empty successful output.

   T5 state and data assertions:

   - Establish a fixed pre-operation interval containing at least three numeric value samples from the real fixture, saving timestamp, value, status and severity as the baseline. Keep real retrieval responses and the actual request/response evidence for each operation.
   - For pause, wait for getPVStatus to return Paused, verify the saved baseline in actual PB files and retain the complete target tuple set. Record t0, then observe 2*B+5 seconds using the effective buffer interval B while the real IOC and archived control keep updating. Before sending resume, require both PB and retrieval tuple sets to remain identical to the paused snapshot; record t1 immediately before the request. After resume, a new sample timestamped before t1 is allowed only as the single current IOC value: require the last real monitor update before t1 to match its value exactly and its timestamp within the monitor's 500-nanosecond rounding bound, startup/reconnection fields consistent with receipt after resume, and exact PB persistence. Do not retimestamp or discard it. Require at least three additional value samples timestamped after the resume command completed, each persisted in PB. The baseline must remain unchanged; numeric connection/startup samples remain counted.
   - For rename, keep the source paused and use an unused destination name. After completion, both names must exist and remain Paused. Retrieve the same fixed interval under both names; their timestamp/value/status/severity records must match the baseline. Do not delete the source as part of the rename example or its success criterion.
   - Exercise deletion twice on separate paused fixture PVs with known stored samples. With no --delete-data option, verify deleteData=false in the actual request, disappearance of the archive configuration, and preservation of the recorded PB data in the configured stores. With --delete-data, verify deleteData=true, disappearance of the configuration, and absence of the target's PB data from every configured store. Configuration disappearance or an empty retrieval response alone is insufficient evidence of data deletion. Use the stopped-store comparison procedure below for both deletion modes, where metadata removal may prevent normal retrieval. Keep a separate control PV paused throughout; its configuration and baseline data must remain unchanged in both cases.
   - For connection reporting, capture the initially connected result, stop the real IOC, wait for actual disconnection and verify the named fixture PVs in the report. All waits have recorded deadlines; expiry fails the check rather than weakening an assertion.

   Storage observations and deadlines:

   - Record B from the engine's effective installation properties: org.epics.archiverappliance.config.PVTypeInfo.secondsToBuffer, using 10 seconds only when the property is absent, as defined by PVTypeInfo.getSecondsToBuffer. Record the property source and any override used by the launched process. Capture each test PV's getPVTypeInfo dataStores and the resolved STS/MTS/LTS directories from the launcher configuration before removing metadata.
   - Read the real PB files through the shipped edu.stanford.slac.archiverappliance.PlainPB.PBFileInfo and FileBackedPBEventStream classes. A test-side adapter may expose getPVName and each DBRTimeEvent as epoch seconds, nanoseconds, numeric value, status and severity; it must call these real readers and must not reconstruct their parsing logic. Match retrieval records using the same timestamp precision and numeric type. The deployed mgmt/install/pbutils/pb2json.sh can provide human-readable diagnostics, but its PB2JSON formatter truncates timestamps to milliseconds and is insufficient for the exact comparison. Identify files by their PB header PV name and saved store roots, including data moved between stores; do not rely only on a filename substring. Persistence is confirmed when the decoded records contain every baseline timestamp/value/status/severity tuple. Poll every second for at most 120 seconds; a file changing during a read is retried within that same deadline. An absent tuple or persistent decoding failure fails the check and retains the evidence. This checks the recorded baseline, not a claim that every internal queue is empty.
   - Before each deletion case, confirm baseline persistence as above and retain the relevant PB inventory and decoded baseline. After the CLI response, record target/control configuration through BPL, then stop that run's launcher through its recorded PID with SIGTERM. Require its normal exit 143 and disappearance of every owned JVM before reading the final store inventory. Use the launcher's configured stop timeout (default 300 seconds) plus its 5-second reap allowance and 2 seconds of observation tolerance as the maximum wait; forced or incomplete shutdown fails the check. With no remaining writer, decode the retained target records for deleteData=false or confirm no PB header for the target in any saved store root for deleteData=true. Compare the paused control PV's baseline in both cases. Restart the same retained run folder for any following case and confirm readiness and control configuration; create a separate target PV for the second deletion mode.
   - Bound getPVStatus transitions and retrieval waits at 120 seconds, except initial archive preparation at 360 seconds. Record monotonic elapsed time and the last response on expiry. Verify B and timing parameters before starting; do not extend a deadline or treat an expiry as success to obtain a passing run.

   T8 failure assertions:

   - Exercise duplicate PV entries, identical rename source/destination, repeated rename sources/destinations and a chained A->B, B->C input. Each must exit 2 before any HTTP request, with conflicting lines reported. Exercise alias-equivalent existing inputs through the live identity lookup; require exit 2 and no mutation. Verify state/data remain unchanged for these rejected inputs, and verify disjoint pairs proceed normally.
   - Run real batch examples with successful and failing items in first, middle and last positions. Use real API rejection conditions, such as unpaused deletion or an occupied rename destination. Verify one outcome per input, successful operations before and after the failure, unchanged state/data for rejected items, and final exit 1. Repeat with all-success input for exit 0 and malformed input for exit 2 before any mutation. Never substitute a transport-generated rejection for these appliance tests.
   - Test the shipped CLI and its real HTTP/response-handling code against a separate local HTTP fault server for a delayed response, malformed JSON and valid JSON with an unexpected structure. This substitutes only the outer HTTP boundary and proves client error handling, not appliance behavior. With --timeout 1, have the server accept the connection and delay its response for 10 seconds; require timeout-specific stderr and exit 1 within 5 seconds, retaining monotonic duration and the request log. Malformed/invalid responses must also give useful stderr and exit 1. Run these read-only requests separately from T5; do not inject an internal-function mock or use the fault server to count a BPL integration check as passed.
   - Retain live-appliance cases for HTTP errors and HTTP 200 validation failures, and a successful deletion response with validation empty. Verify the latter remains success. For each tested failure record the command, exit code, stdout/stderr, relevant response and independent state/data observation when the appliance received a mutation.

   - For the listing example, reject unpaired Unicode surrogates and names incompatible with the stdout encoding before any PV output. Accept --timeout 86400 and reject larger values with exit 2 before HTTP. Kill the real verification launcher during startup and require runner failure plus no surviving owned JVM; identify signal targets by the saved boot ID, PID and start time, use a bounded shutdown, and retain the failure/cleanup evidence.

   Process order for T10 and subsequent example verification:

   1. Before a build or Maven integration run, stop the example-verification launcher via its recorded PID and stop its owned IOC through its open stdin. Verify all owned processes have exited using the run folder's children.tsv and the IOC process handle. Retain the run folder and logs. Do not stop unrelated processes; if another process owns a required port, report it and fail setup.
   2. Confirm the configured integration fixture ports are free. The launcher and DeletePVTest both default to HTTP port 17665, so the example appliance and Maven integration fixtures must run sequentially even when their folders differ. Run the T10 clean build and selected integration tests; let TomcatSetup and SIOCSetup own their fixture lifecycle. Require their teardown to finish and verify no owned test Tomcat or IOC remains before continuing.
   3. Identify the four WARs from that completed build and record their digests. Start the example-verification launcher against those WARs in a fresh dedicated run folder, then start the fixture IOC and wait for appliance readiness and actual PV connections. Recreate the test prefix and baselines and rerun the affected T5-T9 cases; a surviving appliance process from the earlier build cannot provide evidence for the new WARs. After verification, stop only this run's launcher and IOC and verify their termination.

3. Completed scope (landed 2026-09-25): rewrite the narrative book under docs/book/src from scratch, concise and exact, for the single-instance fork, without keeping the upstream page layout. Pages: Introduction; Architecture; Building; Installing (jeonghanlee/epicsarchiverap-env as the deployment path, then a manual reference); Configuration; Persistence (a placeholder whose content M13 writes); Operating; Logging (the current logging.md, kept); Retrieving data (including Phoebus and Matlab); Scripting (mgmt BPL, the generated API reference, the samples); Redundancy and EPICS 7; Developer guide (test platform, PB file format); FAQ and License where they still hold. Every stated default, parameter, endpoint and file name is checked against the code; every screenshot is a marked placeholder naming what the owner captures later; source text follows the markdown-authoring rules (Scope and Out of scope, fenced code, ASCII punctuation) and the applicable IEEE Editorial Style Manual rules.

###### Current implementation scope: archive requests and status

Plan Status: accepted
Plan Acceptance: 2026-09-28, archive/status scope with option 1: a human-readable ASCII table.
Implementation Authorization: 2026-09-28, proceed with the next scope and the selected table output.

Output contract: columns `PV Name` and `Status`, aligned with three spaces, dash separators and a summary with total/successful/failed counts. Preserve input order; include failed items in the table and put detailed errors on stderr. Read-only success means the status was retrieved, not that the PV is Being archived.

This scope delivers `docs/book/src/samples/archivePVList.py` and `docs/book/src/samples/getPVStatus.py`, with Python tests under `src/test/pythontests/` and usage in `docs/book/src/scripting.md` and `TESTING.md`. It covers archive submission and status reporting; the later pause/resume, rename, delete and disconnection-report examples keep their separate acceptance checks above.

Implementation order:

1. Define both CLIs with an explicit BPL URL, a UTF-8 input file containing one PV per line, and the listing example's timeout bounds. Strip surrounding whitespace and skip blank lines; preserve case and literal `#` characters rather than treating them as comments. Reject empty input, control characters, comma lists and wildcard selectors before HTTP. Report invalid local input with exit 2. Validate all names and sampling arguments before the first mutation.
2. Implement `getPVStatus.py` first as a read-only prerequisite for the workflow checks. Query explicit names and report one result per input in input order, retaining the appliance status and returned identity. Require a usable response for every requested name. `Not being archived`, `Initial sampling`, `Appliance assigned`, `Being archived`, `Paused` and `Appliance Down` are reported states, not evidence that a mutation succeeded. A valid status query exits 0 even when its PV is unknown or disconnected; transport or invalid-response failures exit 1.
3. Implement `archivePVList.py` with `--sampling-method MONITOR|SCAN` and a finite positive `--sampling-period`, defaulting to MONITOR and 1 second. Send the period explicitly with the method because `ArchivePVAction.processJSONRequest` uses the presence of `samplingperiod` to enable the override. Document that the server may enforce its configured minimum period; confirm the effective value through the real status/type-info response.
4. Apply the existing identity and batch contracts before mutations. Check literal duplicates and equivalent names using the actual server naming rules and read-only type-info lookups; a missing type-info response does not establish that a request is absent from the archive workflow. Send one JSON archive request per validated independent input, in order, so a failed response does not hide the outcomes of subsequent inputs. Validate both the returned PV identity and application result. Report `Archive request submitted` and `Already submitted` distinctly; neither establishes Being archived, and the latter does not confirm that requested sampling settings were applied. Do not retry an uncertain mutation automatically.
5. Use one HTTP helper per client for requests and validation, reusing only behavior the two new clients actually share. Keep the standard-library-only installation contract. Define a stable per-PV output format before implementation, include useful stderr for failed inputs, and preserve the overall exit 0/1/2 contract above.
6. Add subprocess tests of the shipped scripts with only the outer HTTP boundary controlled. Verify input rejection before HTTP, finite sampling/timeout bounds, identity checks, malformed or incomplete responses, application failures, uncertain mutation outcomes, and continued reporting after a failed independent input. Do not count these as real-appliance acceptance.
7. Add a real workflow runner using `scripts/run-local-appliance.bash`, the current four WARs, and unchanged `UnitTestPVs.db` with its own prefix. Reuse the established bounded process cleanup and retained evidence procedure. Verify an unknown PV before submission, a deliberately unavailable PV in Initial sampling, a real fixture PV reaching Being archived, both sampling methods and effective periods, and a repeated submission without changing existing sampling settings. Use actual BPL alias setup to exercise duplicate identities. Retain exact commands, responses, source/WAR digests, deadlines and cleanup results.
8. Run the applicable T5/T8/T9 assertions. Find and record a genuine archive API rejection before claiming that a mixed success/failure archive batch is verified; `Already submitted` is not a rejection, and a fabricated HTTP response cannot satisfy this check. If the real server prevents the required contract, record the failing operation and resolve the server scope before modifying it, then apply T10. Execute the final documentation commands verbatim, rebuild the book and rerun the listing tests if shared client code affects listing.

Completion requires the two scripts, reproducible client and real-appliance checks, matching documentation, and observed results for every applicable assertion. The implementation and local checks are complete (T11-T13); the changes landed as 14218555 on origin/modernize. Both CLIs use `archiverClient.py` and the existing listing URL/timeout validators. Input names are printable ASCII. Archive preflight also reads configured aliases and conservatively rejects multiple fields of one record; undiscovered IOC aliases require canonical IOC input names, as documented in scripting.md.

The real negative case uses a PV name ending in a dot. `ArchivePVAction` rejects it with `PV name fails syntax check`, but returns incomplete JSON, so the client correctly reports `Outcome unknown` and exit 1. Independent status queries confirm that the invalid names are not archived and all six good names from the three mixed batches reach Being archived. This verifies continuation through the real error path; a controlled HTTP boundary separately verifies structured validation rejections. No server change was required for this client contract.

The first local run, `work/archive-status-implementation-1/`, was interrupted before completion and is not acceptance evidence. Its cleanup completed without surviving owned processes. The final run, `work/archive-status-implementation-2/`, pins the tested source and WAR digests and passes all 22 checks plus normal cleanup. Pause/resume, rename, deletion and disconnection reporting remain outside this completed implementation scope; M17 remains In progress.

###### Current implementation scope: pause and resume

Plan Status: accepted
Plan Acceptance: 2026-09-29, revised pause/resume plan accepted after the second third-person review; the subsequent timestamp decision preserves IOC values and timestamps and verifies storage before resume separately from the current value received after resume.
Implementation Authorization: 2026-09-29, implement and verify the accepted pause/resume plan, including the selected timestamp contract below.

This scope updates the existing `docs/book/src/samples/pausePVList.py` and `resumePVList.py` to the current CLI contract. It adds a shared operation helper only where needed in `archiverClient.py`, subprocess checks in `src/test/pythontests/test_pause_resume_clients.py`, and a real workflow runner in `src/test/pythontests/verify_pause_resume.py`. A test-only Java adapter, `src/test/org/epics/archiverappliance/verification/PVSampleDump.java`, exposes the shipped PB readers for exact storage comparisons. Usage and reproduction instructions belong in scripting.md and TESTING.md. Rename, deletion, disconnection reporting and unrelated old samples are outside this scope.

Source findings (code inspection, not runtime verification):

- `BPLServlet` registers both GET and POST operations. POST enters `BulkPauseResumeUtils`, normalizes `.VAL` names and resolves configured aliases; `PauseByFieldNameTest` covers this POST path. `PVsMatchingParameter.getPVNamesFromPostBody` accepts a JSON array of PV strings with Content-Type exactly `application/json`. Use this path consistently, including one-item inputs.
- `BulkPauseResumeUtils.pauseResumeByAppliance` sets top-level `status=ok` when updating type info, before the component calls. Pause adds `engine_*` and `etl_*` results; resume adds `engine_*`. Top-level success alone cannot prove component success. Missing or failed component results can follow an already-applied metadata change.
- Unknown PVs, already-paused pause requests and unpaused resume requests return nonempty `validation`. The shared server path sometimes uses pause wording even for resume errors. Detect failure from the response fields, not English message matching.
- The current scripts send one whole-file POST without a timeout or application-result exit status. No repository Python caller imports their `pausePVs` or `resumePVs` functions; `renamePVList.py` mentions their filenames in its usage text. Preserve filenames and the two positional arguments; document the new table and exit behavior.
- `PBFileInfo` provides the stored PV identity and type; `FileBackedPBEventStream` reads actual events. `PVTypeInfo.getSecondsToBuffer` reads the effective installation property with a default of 10 seconds. The current code does not establish whether the proposed live storage assertions pass; T14 must execute them.

Implementation order:

1. Reuse explicit BPL URL validation, the UTF-8 PV-file grammar, printable ASCII names, finite timeout bounds, input ordering and exit 0/1/2 from archive/status. Keep the two-column `PV Name` / `Status` table and total/successful/failed summary. Both commands use only the Python standard library. They report API request handling and return without polling; `getPVStatus.py` remains the explicit status query.
2. Move the existing archive input-resolution logic into the shared helper without changing archive behavior. Add pause/resume-specific name validation before resolution: after removing one optional `ca://` or `pva://` prefix, support a bare record name with no dot, or that name followed by one field matching `[A-Za-z_][A-Za-z0-9_]*`. Keep the existing printable-ASCII and forbidden-character checks. Accept the exact field `VAL`, but reject other fields beginning with `VAL`, because the server also rewrites those names. Field modifiers and additional dot segments are unsupported in this scope; reject them locally with exit 2 before any HTTP request. In particular, reject `TEST:A.VAL.[0:1]` rather than allowing preflight and mutation to address different names. Strip the exact terminal `.VAL`, resolve configured aliases and type-info identities before mutations, and retain conservative same-record overlap rejection. Apply the same supported-form checks and normalization to resolved aliases; reject unsupported or contradictory remote identities with exit 1 before any mutation. Require the canonical target to remain unchanged by the server's `PVNames.normalizeChannelName`; use that same target for type-info lookup, POST payload and response identity comparison. A type-info 404 leaves this canonical name available for the actual operation's per-PV rejection; other preflight failures stop the whole command with exit 1 and no mutation. Local malformed or overlapping inputs exit 2; only remote identity checks may precede remote-overlap rejection.
3. Submit one JSON array containing one PV string per POST, in input order, to pauseArchivingPV or resumeArchivingPV. Require a one-row array, the resolved `pvName`, and correctly typed validation/status fields. Pause success requires top-level, engine and ETL status all equal to `ok`; resume requires top-level and engine status equal to `ok`. Required component PV identities must also match. A nonempty component validation fails even alongside `ok`; an empty string remains valid.
4. Display `Pause accepted` or `Resume accepted` only after the complete response contract passes. A top-level validation rejection is `Rejected`; incomplete, contradictory, transport-failed or component-failed mutations are `Outcome unknown`, because metadata may already have changed. Print details on stderr, continue other independent records, and return 1 when any record fails. Preserve the actual server diagnostic without requiring its wording to name the right operation. Do not retry, undo prior successes, or silently treat repeated pause/resume as success.
5. Add actual CLI subprocess tests with only the outer HTTP boundary controlled. Cover exact JSON method/payload, canonical target and original-name display, success with empty validation, component failures hidden by top-level `ok`, missing/wrong component identities, malformed/truncated JSON, unexpected status/types, HTTP errors, closed port, timeout, input and alias collisions, and failures at each batch position. Include bare names, protocol prefixes, exact `.VAL`, ordinary fields, and local rejection of `.VAL.[0:1]`, `.VALA` and other unsupported forms with zero HTTP requests; unsupported identities returned by alias/type-info preflight must produce zero mutation requests. Compare supported canonical names with the real Java `PVNames.normalizeChannelName`, without mocking or reproducing that function, and require identical lookup, POST and expected response identities. Require useful per-PV output, no automatic retry and exit 0/1/2. Rerun the archive/status and listing suites after shared-helper changes.
6. Build the test-only PB adapter before starting the appliance, using the repository's Maven test compilation and resolved test classpath. It calls `PBFileInfo` and `FileBackedPBEventStream`, emits PV identity plus epoch seconds, nanoseconds, numeric value, status, severity, event type and the complete event field map, and closes every stream. Retain stream/header metadata separately from sample records. It neither reproduces PB decoding nor changes production packaging. The runner retains adapter/source/classpath and WAR digests so reader and server provenance are explicit. Verify it against the actual fixture files generated by the run, including a numeric event carrying connection/startup fields; assert that its value and metadata survive decoding and sample classification.
7. Execute T14 on a fresh local appliance with SQLite, existing Tomcat, current WARs and unchanged UnitTestPVs.db under a dedicated prefix. Use bounded cleanup and retain all evidence. Keep a continuously archived control PV and real CA monitor. Establish at least three baseline samples, pause through the shipped CLI, await Paused and confirm exact baseline PB persistence before observing 2*B+5 seconds. Capture all target PB tuples after pause and require the complete PB and retrieval tuple sets to remain unchanged immediately before resume. Observe the next real IOC update with a bounded 20-millisecond monitor poll, then record t1 and send resume immediately. Require exactly one resumed current value timestamped before t1 so this fixture run exercises the accepted case. Await Being archived and retrieve at least three samples timestamped after the command completed. Require every exact timestamp/value/status/severity tuple in PB within 120 seconds. Apply the accepted current-value contract below to any new sample timestamped before t1, and require its exact PB persistence too. The IOC and control must each produce at least three distinct timestamps and values during the interval. Count every numeric sample, including connection/startup fields; exclude only headers without sample payloads. Retain boundary records and metadata separately. Unexpected nonnumeric or unclassifiable samples fail verification; status alone cannot satisfy these checks.
8. Extend the live cases to `.VAL`, configured aliases, duplicate/alias-equivalent input rejection, repeated-operation rejection, unknown PV rejection, and a real mixed batch with the failure first, middle and last for each command. Use fresh independent fixture PVs or explicitly restore their state between cases. Assert every good PV's resulting state and the rejected PV's unchanged state; compare stored baseline data for overlap/rejection cases. Each mixed case exits 1 and retains one row per input. An unavailable component is tested at the HTTP boundary as uncertain outcome; it is not counted as a live component-failure test.
9. Document the exact pause/status/resume/status workflow, companion files, exit codes, repeated-operation errors and the distinction between request acceptance and verified collection. Execute the command block verbatim, rebuild the book, and verify source/copy equality and links. Rerun the existing archive/status live runner after shared identity-resolution changes. If a real server defect prevents the required contract, retain the failure, determine its scope before editing production code, and apply T10; otherwise record T10 as not applicable.

Decision Date: 2026-09-29. Preserve IOC values and timestamps. Verify stopped recording through unchanged PB and retrieval tuple sets before resume. After resume, allow at most one new sample timestamped before the request, only when it matches the last actual IOC monitor update before that request within its 500-nanosecond rounding bound and carries startup/reconnection fields consistent with receipt after resume. Require exact PB persistence for this current value as well as subsequent updates. Numeric startup samples are never excluded as metadata. This replaces the post-resume requirement that the entire pause timestamp interval be empty; the failed original assertion remains recorded in T14.

Deadlines and cleanup: initial archiving is bounded at 360 seconds; state transitions, retrieval readiness, baseline persistence and resumed-sample persistence at 120 seconds each. Start the resumed-persistence deadline when the post-resume tuples have been captured. Use a one-second storage poll and retry concurrent-file reads only within that deadline. The monitor must stay alive through the pause interval and its timestamps must support the IOC-progress assertion. Record monotonic elapsed time, UTC interval boundaries and the last observation on expiry; no deadline extension converts a failure to success. Stop the owned launcher, IOC and monitor in every exit path; require normal launcher exit 143, IOC exit 0 and no surviving owned JVM/monitor. Retain the run folder on success or failure.

Completion requires T14-T16 passing on the shipped paths, no archive/status/listing regression, matching documentation, and recorded source/WAR provenance. Existing legacy-script observations and source inspection do not satisfy these new checks. The revised plan was accepted on 2026-09-29. Implementation was authorized on 2026-09-29; T14-T16 remain required before completion.

Current implementation: the pause/resume CLIs, shared helper, HTTP boundary tests, PB adapter, real workflow runner and documentation landed as fbc32120, following the M34 server correction in 759337d5. M34 preserves pending buffers and rolls back partial PB appends before retry. Verification passes 818 default tests, eight affected integration cases, 43 Python client tests, 58 real pause/resume checks and 22 real archive/status checks. T14-T16 record the results on the rebuilt WARs, including exact PB persistence of the earlier-timestamped IOC current value. Both commits are on the fetched origin/modernize; Maven CI and Pages pass on fbc32120. M34 is Complete and #17 is closed, satisfying the server dependency. Rename, deletion and disconnection reporting remain outside the accepted implementation scope.

###### Completed implementation scope: rename

Plan Status: accepted
Plan Acceptance: 2026-09-29, the reviewed rename plan carried by 29447c39, including all accepted review corrections.
Implementation Authorization: 2026-09-29, implement and verify the accepted rename plan.
Review Findings Accepted: 2026-09-29, all three findings from the first third-person review of the rename draft: prevent automatic mutation redirects, specify WAR selection for the Java fixture, and verify actual filesystem failure during copying. This accepts the plan corrections, not rename implementation. On 2026-09-29, both findings from the first second-person review were accepted: prepare the WAR bundle and reader before live execution, and inspect failed destination files separately from source/control preservation checks.

This scope modernizes `docs/book/src/samples/renamePVList.py`, adds client checks in `src/test/pythontests/test_rename_client.py` and a real workflow runner in `src/test/pythontests/verify_rename.py`, and documents usage in scripting.md and TESTING.md. It reuses `archiverClient.py` for transport, supported-name validation and identity checks, and `PVSampleDump.java` for actual PB decoding. The existing management `RenamePVTest.java` is updated to assert the same retention contract. Automatic pause, resume, source deletion, data deletion, a transactional server rename and other operation examples are outside this scope.

Premise classification (source inspection at ac7fd6a0, not new runtime verification):

- Confirmed: `BPLServlet` registers renamePV as a GET action with `pv` and `newname`. `RenamePVAction.execute` resolves a configured source alias, requires a paused source and rejects a destination with an existing appliance mapping or type info. It creates a copied PVTypeInfo before invoking each configured storage plugin. `PVTypeInfo(String, PVTypeInfo)` retains the paused flag, sampling settings, store URLs and archived fields; creation time is retained and modification time changes.
- Confirmed: `PlainPBStoragePlugin.renamePV` appends source streams under the destination name and does not delete the source files. The required behavior is configuration and data copying with both names retained; the CLI must not perform the later resume/delete workflow automatically.
- Confirmed: `RenamePVAction` returns an object with `status=ok` and `desc` on success, without machine-readable source/destination fields. It also uses `validation` for exceptions after destination registration. Its writer closes before the exception handler writes another response. Therefore a validation message, HTTP error or unusable response cannot generally prove that nothing changed; outcome reporting must remain conservative.
- Confirmed coverage gap: `src/test/org/epics/archiverappliance/mgmt/RenamePVTest.java` checks only that destination retrieval has at least the original event count. Its class comment incorrectly says the old data disappears. It does not assert both paused configurations or exact old/new sample equality. Strengthening this test belongs to the rename verification scope; no production correction is established by that coverage gap.
- Hypothesis: the existing BPL and PB copy path satisfy the complete retention contract on the current WARs. T17 and T20 must establish this through the real path. A failure must retain commands, responses and storage observations before any production change is proposed.

Review observations (2026-09-30 UTC, actual helper and fixture execution): the shipped `_request` followed a local HTTP 302 and sent two rename GET requests before returning the second response's status=ok. This used only a controlled outer HTTP boundary. The actual compiled `TomcatSetup.warFile` selected a nonexistent aa-20260930-ac7fd6a0-mgmt.war for the current build name, while aa-20260929-14218555-mgmt.war existed. These observations establish the two setup/client gaps; they do not establish any new appliance copy or filesystem-failure result.

Implementation order:

1. Preserve the existing filename and two positional arguments: explicit BPL URL and UTF-8 pair file. Each nonblank line contains exactly two nonempty PV names separated by one comma; strip surrounding whitespace and preserve case and literal `#`. Use the existing printable-ASCII, selector and supported-field restrictions from pause/resume, including at most one protocol prefix, exact terminal `.VAL` normalization and local rejection of field modifiers or repeated prefixes. Document that this is a plain pair format with no CSV quoting or comment syntax. Reject unreadable/empty input, malformed pairs and unsupported names with exit 2 before HTTP. Add --timeout with the existing greater-than-zero, at-most-86400-second bounds and default 30.
2. Validate independence across both columns before mutation. Reject old==new after canonicalization, repeated sources, repeated destinations, chains and any source/destination identity overlap; retain conservative same-record rejection. Report both conflicting line numbers and column roles. Resolve configured aliases and getPVTypeInfo identities for both names using read-only preflight, then repeat the whole-pair overlap check. Apply supported-name validation to remote identities, fail contradictory/cyclic/invalid lookup responses with exit 1, and send no rename requests on a preflight failure. Only a type-info 404 establishes absence for this lookup; other errors do not. Use the same canonical identities for lookups and mutation parameters. An occupied destination or an absent/unpaused source remains an independent per-pair operation failure rather than aborting an otherwise valid batch. Undiscovered IOC aliases require canonical input names, as in the existing clients.
3. Send one GET renamePV request per independent pair, in input order, through the shared _request function. Add an explicit mutation transport mode that disables automatic HTTP redirects; mark rename and the existing archive/pause/resume mutation calls with that mode, while preserving read-only transport behavior. Any 3xx response must return an uncertain outcome without following Location or resending the mutation, including a redirect to the same host. Require a JSON object, correctly typed optional validation/description fields, no nonempty validation and status exactly ok before reporting `Rename accepted`. Do not invent response identity fields absent from the actual BPL contract. A nonempty validation, failure status, HTTP failure, redirect, timeout or incomplete/contradictory response is `Outcome unknown`, with the actual diagnostic on stderr, because configuration or data copying may already have begun. Continue subsequent independent pairs; never retry, undo, pause, resume or delete automatically. Print an aligned ASCII table with `Old PV Name`, `New PV Name` and `Status`, plus total/successful/failed counts. Return 0 only for all accepted pairs, 1 for any failed or uncertain operation, and 2 for input/overlap rejection. Acceptance does not prove copied data; document checking both configurations and stored samples before manual recovery or retry.
4. Keep shared-helper changes limited to behavior used by the actual clients. Extend table formatting only enough to support the pair columns while preserving existing two-column output. Add subprocess checks of the shipped CLI with only the outer HTTP boundary controlled: zero-request local failures, read-only remote-overlap rejection, source and destination aliases, canonical parameter equality, exact method/encoding, success with empty validation, validation-only and contradictory bodies, malformed/truncated JSON, invalid types, HTTP errors, closed port, and delayed response. Add 301, 302, 303, 307 and 308 mutation responses with same-origin and different-origin Location targets. Each case must show exactly one received mutation, no request at the redirect target, Outcome unknown, exit 1 and continued handling of later independent records. Pin this invariant for archive/pause/resume as well as rename; retain the request logs from both boundary servers. With --timeout 1 and a ten-second boundary delay, require exit 1 with timeout-specific stderr within five seconds. Check failures in first/middle/last positions, one row per input and zero automatic retries. These checks establish client handling, not appliance behavior.
5. Prepare the adapter and dependency classpath before any appliance starts using Maven test compilation and dependency resolution. Select exactly one complete four-WAR build bundle by an explicit common basename, record all four digests and verify them against its build evidence and unchanged production-source/resource digests before reuse. Put only that bundle in the runner's selected --war-dir. For the fully qualified management test class under the integration profile, explicitly pass archappl.war.dir and archappl.final.name matching that bundle; never infer its name from the current date or HEAD. Confirm all four files exist before starting the Java IOC/Tomcat fixture. If the recorded bundle is missing, inconsistent or cannot be tied to the current production sources/resources, build a new complete bundle and retain its build evidence; production/runtime changes still require T10. Require the Java test and Python runs to use the same recorded four WARs, and verify deployed-copy digests. Do not replace any internal path or fixture.
6. Execute T17 with the local launcher, current four WARs, SQLite and unchanged UnitTestPVs.db under an isolated prefix. Archive source and control PVs through the shipped archive CLI, establish at least three numeric baseline samples and pause sources through the shipped pause CLI. Await Paused and confirm exact baseline PB persistence before rename. Save source type info and the complete sample multiset for a fixed interval ending before rename; record every source store URL and resolved root. Use destinations absent from type info and the alias map. Invoke the shipped rename CLI, await both Paused configurations, and compare each name's timestamp/value/status/severity multiset with the saved source interval through both real retrieval and PVSampleDump. Identify PB streams by header PV name across every saved store root, retain numeric startup/connection samples, and preserve duplicate counts. Compare copied sampling method/period, DBR type, element count, policy, store URLs, archiveFields, protocol flags and creation time; only the PV identity and modification time may differ for these checks. The source configuration and baseline remain unchanged, and the archived control continues updating.
7. Extend T17 to disjoint all-success pairs, a configured source alias and exact .VAL input, rejected local/alias-equivalent chains and repeated identities, and actual BPL failures in each batch position. Use fresh sources/destinations for each case. Exercise occupied destinations, unpaused sources and unknown sources without substituting an HTTP rejection. For known rejected cases, independently verify unchanged source/destination configuration and baseline and successful copies before and after the failed item. Verify rejected input leaves the archive inventory unchanged and sends no rename request. Preserve all CLI output, actual request/response evidence and independent observations; the client's conservative outcome label does not weaken the server-state assertions.

   - T21 adds actual copying failures through the shipped CLI and deployed RenamePVAction. Use separate sources/destinations with real IOC baselines and a healthy control. First fail a destination filesystem write after its configuration is registered, then exercise a write failure after at least one actual destination sample or completed partition has been copied. Inject failure only at the outer filesystem boundary, using a destination-specific permission/path failure or a path-filtered strace syscall fault in the owned management process; do not mock a storage plugin, rename action, HTTP response or PB reader. Determine any syscall fault point from the actual trace and prove that it reached the intended destination. Record the trace, affected path, configuration and PB records before and after the request. Require exit 1 with Outcome unknown, no automatic retry or source deletion, exact source-baseline retention, unchanged control baseline/configuration and successful later independent pairs. Record the destination's actual paused configuration and incomplete data without claiming rollback or asserting that it must be absent. Keep the fault restricted to the selected destination so later independent pairs can execute safely. Restore it in a finally block before that destination is reused or another fixture case starts; if safe restoration cannot be confirmed, fail and stop the case. Await component readiness after restoration. Inspect each retained PB file independently before and after orderly launcher shutdown. Require successful decoding and exact saved-interval sample multisets for the source and control; a failed destination reader must not prevent those checks. For every destination file, retain its path, existence, byte size, digest when present, reader exit code, stdout and stderr. Record absent, zero-byte and undecodable destination files explicitly, using the traced destination path when no header can identify the PV. Preserve every record the real reader decodes, but never replace an undecodable nonempty file with an empty sample set. These destination observations are allowed only when the intended filesystem fault is proven and source/control preservation and the remaining T21 assertions pass; unexplained reader failures fail the case. The partial-copy case still requires observed copying before the fault even if recovery leaves no readable destination records. A signal-related process crash, an unexercised fault or a silent skip fails this check. Document Linux/strace and process-attachment prerequisites; missing capability fails setup rather than replacing the real path with an HTTP boundary test.

8. Update the existing management RenamePVTest to validate the returned response, both retained Paused names, copied configuration and exact timestamp/value/status/severity records over a fixed interval. Correct its class comment to describe source retention. Run all four Python client suites (listing, archive/status, pause/resume and rename) and rerun the real archive/status and pause/resume runners: the mutation transport changes make both regression runs required. If production code or runtime configuration must change, record the observed defect and its smallest correction scope before proceeding, then follow T10 with the concrete affected Java classes and fresh WARs. No production edit is authorized by this draft.
9. Document the pair-file grammar, companion files, table, exit codes, paused-source and unused-destination requirements, retained source data and uncertain outcomes, including redirects and partial-copy failures. State that a failed copy can leave destination metadata and some data; inspect both identities and stored samples before a manual recovery or retry. Provide pause/status/rename/status commands using explicitly selected files; do not include source deletion in this rename example. Document adapter/classpath preparation, explicit WAR-bundle selection and filesystem-fault prerequisites in TESTING.md. Execute the final documented commands verbatim through T17, build the book and compare copied scripts and links. Record source, reader/classpath and WAR digests, real test counts and cleanup results in the verification rows below. T17-T21 must pass before this scope is complete; deletion, disconnection reporting and final inventory acceptance still keep M17 open.

Deadlines and process ownership: use the existing 360-second initial archive deadline and 120-second state/retrieval/PB deadlines, with one-second storage polls and concurrent-file retries only within the same deadline. Freeze interval boundaries once the paused baseline is persisted; never widen them to obtain agreement. Retain the last observation and monotonic elapsed time on expiry. The Java integration fixture and Python appliance run sequentially, with their required ports free and teardown verified between runs. Stop only the owned launcher/IOC in every exit path; require launcher exit 143, IOC exit 0 and no surviving owned JVMs. Normal cleanup and retained evidence are required for passing runs.

Current implementation: rename CLI, shared redirect protection, Java integration assertions, client/live verification and documentation landed as 6552a9f5. T17-T21 retain the executed results, including the final 132-check run and actual tracer-timeout cleanup failure. Maven CI and Pages pass on the same commit. Issue #6's reconciled body records these results; deletion, disconnection reporting and final inventory acceptance keep M17 In progress.

###### Completed implementation scope: deletion

Plan Status: accepted
Plan Acceptance: 2026-09-30; deletion plan reviewed as 9e17fea82c67a3fc9da1f7bd70ba1a53de31ba6924ab3750685a7c6daf8ae83e.
Implementation Authorization: 2026-09-30; implement and verify this deletion scope. Any reproduced hidden deletion error requires separately authorized server correction before completion.
Review Findings Accepted: 2026-09-30; require explicit T26 CLI failure, no-retry, independent-item data effects and unchanged failing-before/passing-after assertions.

This scope modernizes the existing `docs/book/src/samples/deletePVList.py`, adds subprocess checks in `src/test/pythontests/test_delete_client.py` and a real workflow runner in `src/test/pythontests/verify_delete.py`, and documents usage in `docs/book/src/scripting.md` and `TESTING.md`. It reuses `archiverClient.py` and the shipped PB-reader adapter. The existing `src/test/org/epics/archiverappliance/mgmt/pauseresume/DeletePVTest.java` receives deletion-response and real-data assertions. Automatic pause, rearchiving, retries, data recovery, disconnection reporting and unrelated sample changes are outside this scope. No production correction is authorized by this scope.

Premise classification (source inspection at 6552a9f5 on 2026-09-30, not deletion runtime verification):

- Confirmed contract mismatch: the current `deletePVList.py` always sends `deleteData=true`, uses `requests` without a timeout and reports a status without a batch exit contract. The accepted core-operation direction requires configuration-only deletion by default and explicit `--delete-data` for stored-data deletion. No other repository Python caller of its `deletePV` function was found.
- Confirmed API contract: management `BPLServlet` registers GET and POST `deletePV`. A single GET resolves configured aliases, requires existing appliance/type information and a paused PV, defaults `deleteData` to false, calls engine then ETL, removes the archive configuration and configured aliases, and returns `status=ok` with empty `validation`. It does not return a PV identity or component acknowledgements. A validation-only unpaused response and an unknown-PV HTTP error are real failure cases.
- Confirmed failure-reporting gap: management `DeletePV.deleteSinglePV` tests only whether the engine JSON is null and does not validate its status. It merges ETL JSON into an internal timing map, then removes metadata without requiring an ETL success response; that map is not returned. ETL `DeletePV.execute` catches per-store errors and later returns `status=ok`. `PlainPBStoragePlugin.markForDeletion` also logs filesystem exceptions or a changed file size without reporting failure to its caller. A management acknowledgement therefore cannot establish complete data deletion. T26 must reproduce the actual filesystem path before any server correction is proposed.
- Confirmed storage behavior: engine `DeletePV` destroys the channel; ETL removes its jobs and, only for `deleteData=true`, enumerates the configured stores and marks their streams for deletion. `deleteETLJobs` can consolidate data before deletion, and `PlainPBStoragePlugin.markForDeletion` removes actual files. Store paths can change, so final verification must identify PB headers across all saved roots after writers exit. The existing launcher retains its SQLite database and stores when restarted with the same run folder.
- Confirmed coverage gap: `DeletePVTest` and `DeletePVAfterRestartTest` reissue deletion while polling status and check `Not being archived`; they do not establish configuration-only data retention or deletion in every store. New acceptance evidence must send each mutation once and poll only read-only observations. The unchanged restart and multiple-PV tests remain server regressions, not storage acceptance substitutes.
- Hypothesis: the normal API path satisfies both data-mode contracts on the current WARs. T22 and T25 must establish that using the unchanged IOC fixture. Partial deletion, hidden filesystem errors and metadata removal before complete deletion remain risks requiring T26 observations.

Implementation order:

1. Preserve the filename and positional explicit BPL URL and UTF-8 PV file. Use the existing standard-library-only URL, file, printable-ASCII name and timeout contract: default 30 seconds, finite and greater than zero, at most 86400 seconds. Strip surrounding whitespace, skip blank lines, preserve case and literal `#`, and reject empty/unreadable input, selectors, comma lists, control characters and unsupported field forms with exit 2 before HTTP. Add `--delete-data`; send the string `false` explicitly when absent and `true` only when supplied. State that this changes the old sample's always-delete-data behavior.
2. Apply `operation_name` and `resolve_inputs` before any mutation. Normalize the supported protocol prefix and exact terminal `.VAL`, resolve configured aliases and type-info identities, and reject literal/canonical/same-record overlap for the whole input with conflicting line numbers. A type-info 404 establishes absence only for that lookup; keep that canonical name for the actual API rejection. Other preflight failures exit 1 before deletion. Use the same canonical name in type-info lookups and the encoded mutation parameter; display the original input. An unpaused or absent PV remains a per-item API failure so later independent inputs continue.
3. Send exactly one encoded GET `deletePV` per independent item, with explicit `pv` and `deleteData`, through `_request(..., mutation=True)`. Require a JSON object, correctly typed optional `validation`/`desc`, empty or absent validation and status exactly `ok` before reporting `Delete accepted`. Do not invent absent component or identity fields. Nonempty validation, HTTP errors, redirects, timeout, transport loss and incomplete/contradictory responses report `Outcome unknown`, with the actual diagnostic on stderr. Continue independent items; do not follow redirects, retry, pause, resume, rearchive, undo earlier deletions or remove files locally. Use the existing `PV Name` / `Status` ASCII table and totals; exit 0 for all acknowledged items, 1 for any failed/uncertain item and 2 for input/overlap errors. Acceptance confirms the API response, not PB erasure; document inspecting configuration and stored data before recovery. Configuration-only deletion removes normal retrieval metadata, so empty retrieval is not proof of data removal.
4. Test the shipped CLI as subprocesses against a controlled outer HTTP boundary. Cover the default false and explicit true query, exact method/encoding/canonical identity, empty-validation success, validation-only/contradictory/failure responses, invalid types, malformed/truncated JSON, closed port and timeout. Reject invalid local input with zero requests and remote identity collisions with zero mutations. Cover 301/302/303/307/308 for both same-origin and different-origin locations with one received mutation, zero redirect-target requests and no retry. Cover a failed item first, middle and last, one row per input and continued independent requests. Use `--timeout 1` against a ten-second response delay and require timeout-specific stderr/exit 1 within five seconds. Run all existing client suites; rerun affected live workflows if shared behavior changes.
5. Prepare the PB adapter, Maven test classpath and one explicitly selected complete four-WAR bundle before launching any fixture. Record source, reader/classpath, IOC fixture and WAR digests and verify deployed copies. Reuse the rename bundle only if current production/resource/configuration digests still match its successful build evidence; otherwise build a fresh complete bundle. Pass matching `archappl.war.dir` and `archappl.final.name` to Java fixtures. Run Java and Python appliances sequentially with free fixture ports and confirmed teardown. Any separately approved production/runtime change invokes T10, including a regression failing on the defective real path, fresh WARs and repeated affected workflow checks.
6. Implement T22 on the actual SQLite launcher and unchanged `UnitTestPVs.db`, using a dedicated prefix and independent paused target/control PVs with at least three persisted numeric samples each. Save configuration, aliases, store URLs, resolved roots, fixed retrieval intervals and exact PB timestamp/value/status/severity multisets before removing metadata. For both modes, use separate real targets with retained data in STS, MTS and LTS across the case matrix. Prepare later-store data through the real `consolidateDataForPV` path with a recorded future processing date and actual PB inspection; never copy fixture files, synthesize PB records or replace ETL. A claimed store case requires decoded target records in that store before deletion. Allow consolidation to move files, but compare the fixed-interval records across every saved root without losing duplicate counts.
7. Execute the default mode without the option and prove `deleteData=false` in the actual request. Await archive-configuration/type-info/alias removal and record target/control responses, then stop the owned launcher normally before scanning every saved store root with `PVSampleDump`. Require exact target-record retention across the roots and unchanged control configuration and baseline. For the explicit mode, prove `deleteData=true`, require metadata/alias removal, orderly shutdown and no target PB headers or target stream paths in any saved root, with the control unchanged. An undecodable or unexplained leftover file fails verification rather than becoming an empty result. Retain each file's path, size, reader result and header identity. Restart the same retained run folder for following cases; verify SQLite readiness, continued absence of deleted metadata and preserved control configuration. Use fresh targets for subsequent mutations; do not rearchive a deleted PV to make its data accessible.
8. Add configured alias and exact `.VAL` success cases, overlap rejection and real unpaused/unknown/repeated-delete failures. Exercise each failure first, middle and last with fresh independent good targets in both data modes. Require one request/outcome per input, exit 1, correct data effects for all accepted items and unchanged configuration/baseline for known precondition rejections. A repeated request after configuration removal is an error and cannot be treated as idempotent success. Boundary responses do not satisfy these real BPL cases.
9. Strengthen `DeletePVTest` to retain actual IOC/PB baselines for both modes, validate the actual management acknowledgement and send deletion once before polling read-only status/type-info. Include both data modes, aliases and the paused precondition without reconstructed data fixtures. Run the three concrete server classes `DeletePVTest`, `DeletePVAfterRestartTest` and `DeleteMultiplePVTest` from `org.epics.archiverappliance.mgmt.pauseresume` under the integration profile with the same explicit bundle; only the strengthened real-data assertions count for T25's storage contract. Run existing Python client checks and applicable live regressions after shared-helper changes.
10. Execute T26 as a separate real filesystem-failure diagnostic before accepting deletion completion. Restrict a permission or path-filtered syscall failure to a saved target PB deletion in the owned ETL process, prove that the actual delete syscall was attempted and the target file survived, and retain management/ETL responses, logs, target/control metadata and actual PB records. Require the shipped CLI to report `Outcome unknown` for the failed item, never `Delete accepted` for that item, and exit 1 for the batch. Send exactly one mutation per independent item with no automatic retry; later healthy items must report `Delete accepted` and satisfy the configuration/alias removal and actual PB-data effects for the selected mode defined in steps 6-7. Preserve control configuration and baseline data. Restore the fault in `finally`, inspect every store after normal shutdown and record any partially removed data or configuration without claiming rollback. No internal-function mock or substituted component response is allowed. If `ok` masks retained target data, record the real defect and its smallest server correction as separate milestone/issue work for owner direction, complete that correction and T10, then return to T22-T26. Retain both executions: the same fault and unchanged CLI/state/data assertions through the shipped CLI and real management/ETL/storage/reader path must fail before the server correction and pass after it. Do not weaken assertions or count false success as complete deletion; this scope does not authorize the production correction.
11. Document explicit file setup and pause/status/delete/status workflows for each mode, acknowledgement limits, data retained after configuration removal, irreversible partial deletion, error exits and manual inspection before retry. Execute the final commands verbatim through T22, rebuild the book and compare all affected sample copies and links. Record real test counts, commands, responses, source/WAR provenance and normal cleanup in the Verification Results. Deletion requires T22-T26 outcomes satisfying the contracts below; record only actually executed deletion results. Disconnection reporting and final inventory remain later scopes.

Deadlines and cleanup: use 360 seconds for initial archive preparation and 120 seconds for state, consolidation, retrieval and PB-read observations, with one-second storage polls and no deadline extensions. Retain the last observation and monotonic elapsed time on expiry. Before any stopped-store scan, require launcher exit 143, disappearance of every owned JVM and no forced-stop fallback within its configured stop timeout plus seven seconds. Fault restoration, launcher teardown and IOC teardown are independent cleanup steps in every exit path; a failure in one must not skip the others. Final cleanup requires IOC exit 0 and no surviving owned JVM/IOC/tracer. Forced, incomplete or unproven cleanup fails the run. Retain all run folders on success or failure.

Completion requires executed default/explicit data effects with nonempty pre-deletion store coverage, alias/canonical/batch/error checks, documented commands, source/copy/link equality, passing affected regressions and resolution of any reproduced hidden deletion error. T26 requires the failed item's conservative report and batch exit 1, one mutation per item without retry, correct later-item configuration/data effects and retained evidence that the unchanged real-path assertions fail before any required correction and pass after it. API acknowledgement, disappearing metadata and legacy-script observations alone cannot satisfy deletion completion. Plan acceptance and implementation authorization are recorded above; production correction remains a separate authorization.

Current implementation: the deletion CLI, fourteen client tests, real verification runner, strengthened Java tests and documentation landed in origin/modernize as 48c0a692b60547969819ccf469bb6343215c60aa on 2026-10-01. M35's separately authorized six-file production correction confirms explicit PB/ZIP deletion and component acknowledgements before metadata removal, including literal ZIP paths. The original 418-check run with one filesystem-fault failure remains the defective baseline. The current complete bundle passes 857 default tests, 4 Java integration executions and all 664 real-appliance checks, including actual PB/ZIP faults, metadata/data preservation across restart and normal cleanup. The unchanged clients retain 70 passing tests, and the fresh book has eight identical linked samples. Current evidence is work/delete-zip-key-evidence.json. Completion recorded on 2026-10-01 after verifying the landed commit, executed T22-T26/T10 results and M35 issue #18's completed closure. The deletion and disconnection scopes are complete and landed; final inventory acceptance remains, so M17 remains In progress.

Deletion acceptance checked on 2026-10-01 against the accepted eleven-step plan: T22 establishes both data modes, nonempty STS/MTS/LTS baselines, aliases, canonical identities, independent batches, retained-folder restarts and exact target/control data effects; T23 establishes the client error/no-retry contract; T24 establishes verbatim workflows, source/copy/link equality and the pinned book; T25 establishes all four selected Java integration executions; T26 and M35 / T1-T7 establish the unchanged real failure regression, checked ZIP persistence and failed-target preservation before and after restart. T10 establishes the fresh default suite, matching source/WAR hashes and fixture teardown. Closure Evidence records the remote commit and observed issue closure. These results satisfy this deletion scope's completion criteria without satisfying the later disconnection or inventory criteria.

###### Completed implementation scope: disconnection reporting

Plan Status: accepted
Plan Acceptance: 2026-10-01; accepted document SHA-256 a8ca8ca88e5da72c2763ff617b76d16583ac7bfd45008327639eaae0b981db5e after the third third-person review and first second-person review returned no must-fix/minor findings.
Implementation Authorization: 2026-10-01; implement the accepted disconnection-reporting plan, including baseline fault reproduction, management correction, CLI, tests and documentation.
Decision Date: 2026-10-01. Include actual failure reproduction and the required server correction before CLI implementation and verification.
Review Findings Accepted: 2026-10-01; all three findings from the first third-person review of this scope at document SHA-256 857e221dce621ca75c8c9abb9491ad452c34e308c7a7cb1fead0ed13140fd67c: assert the final action's HTTP/JSON response, bound engine stop and launcher suspension with verified restoration, and assert exact outbound request counts for retry/redirect failures. Acceptance of these review corrections did not itself accept the full plan or authorize implementation.
Review Findings Accepted: 2026-10-01; the timestamp finding from the second third-person review at document SHA-256 80afd0f995e553769606aec86288bb86a0a8e39ceb3a3c9540707634c89294bc: preserve Unicode server time strings, reject control characters, and add locale checks to T27/T28. Acceptance of these review corrections did not itself accept the full plan or authorize implementation.

This scope corrects `src/main/org/epics/archiverappliance/mgmt/bpl/reports/CurrentlyDisconnectedPVs.java`, modernizes `docs/book/src/samples/printCurrentlyDisconnectedPVs.py`, and adds tests under `src/test/org/epics/archiverappliance/mgmt` and `src/test/pythontests`. Usage belongs in `docs/book/src/scripting.md` and `TESTING.md`. The CLI reads one report; it does not pause, resume, delete, ping, send email or poll for recovery. Other report endpoints, a general SDK, changes to engine connection tracking and the final sample inventory are outside this scope.

Premise classification (source inspection at bc190542 on 2026-10-01; the formatter observation below is a direct helper execution, not a deployed report or T27-T30 result):

- Confirmed error-propagation gap: management `CurrentlyDisconnectedPVs.execute` calls `GetUrlContent.combineJSONArrays(List<String>)`. That helper catches engine I/O and JSON parse failures, logs them and returns the accumulated array. The action writes it without an error status. In this single-instance deployment, a failed engine query can therefore take the same response path as a healthy empty report. The helper's `getURLContentAsStream` also has no explicit connect/read timeout. Source inspection establishes the gap; T27 must establish its actual deployed behavior.
- Confirmed report semantics: engine `CurrentlyDisconnectedPVsAction` selects real channels with `PVMetrics.isConnected()` false and excludes paused PVs. It returns string fields `pvName`, `instance`, `lastKnownEvent`, `connectionLostAt`, `noConnectionAsOfEpochSecs`, `hostName` and `commandThreadID`. The lost-connection time uses appserver startup when no positive loss time exists. `TimeUtils.convertToHumanReadableString` returns `Never` for epoch zero. A pending archive request is not automatically a disconnected engine channel, and `getPVStatus` alone does not prove a connection.
- Confirmed timestamp constraint: `TimeUtils.convertToHumanReadableString` uses the default locale. Direct execution on 2026-10-01 with epoch 1767225600 and Locale.US/FRANCE/JAPAN produced printable ASCII for US and non-ASCII month text for France and Japan. The current source digest matched the recorded successful bundle, and the executed class matched its engine WAR byte for byte. Server and CLI validation must preserve those Unicode time strings rather than require ASCII. This observation does not establish deployed endpoint encoding or locale behavior; the action and client checks below must execute those paths.
- Confirmed client gaps: the legacy script uses `requests` without a timeout or response-schema/exit contract. Its grouped dictionaries silently overwrite duplicate identities. Its `--onlyNA` and `--noNA` options filter the literal `connectionLostAt` value `N/A`; they do not test `lastKnownEvent=Never`. Current engine code normally supplies a timestamp for `connectionLostAt`. Preserve the filename, positional URL, grouped output and literal filter behavior for this scope; do not silently redefine these options as never-connected filters.
- Hypothesis: the deployed baseline returns HTTP 200 and an empty array when its actual engine is unavailable, and the corrected endpoint can preserve healthy reports while returning a detectable failure. T27 must execute both versions with the same failure and assertions. IOC loss, paused-channel exclusion and recovery remain unverified until T29 runs.

Implementation order:

1. Prepare a reproducible baseline using one explicitly selected complete four-WAR bundle tied to its successful build and current production/resource/configuration digests. Record source revision, all WAR/deployed-copy digests, unchanged `UnitTestPVs.db` digest, launcher/IOC commands, ports and process identities. Run the real management endpoint while the actual engine is available, then induce engine unavailability as described below. Retain raw HTTP status/body, management logs, engine lifecycle and an independent failed connection to its port. The acceptance assertion is HTTP 503 rather than a successful empty/partial report; retain its actual failure on the baseline. Do not implement the correction first or replace an internal component response to manufacture this evidence.
2. Confine production changes to this management report. Replace its tolerant aggregation with strict fetching that finishes and validates every configured engine response before writing a successful response. Reuse the existing Apache HTTP dependency with explicit five-second connect/connection-pool limits and a ten-second response-read timeout, resource closure and explicit disabling of automatic retries and redirect handling in the HTTP client configuration. Preserve the existing internal `ARCHAPPL_COMPONENT: true` request header and configured engine URL. Require HTTP 200, a JSON array and report rows satisfying the field/type contract in step 5; reject null, objects, malformed JSON and missing/wrongly typed required fields. Preserve successful array shape, fields and Unicode timestamp strings, including a genuine empty array. Apply the same timestamp control-character rules as the CLI; do not impose an ASCII restriction, parse, translate or normalize time strings. Set UTF-8 response encoding before obtaining the writer, with application/json as the media type. For an unavailable, timed-out or invalid engine response, return HTTP 503 with that JSON media type/encoding and an error object containing status=error and a nonempty string desc; never write an accumulated array before the complete query succeeds. Keep the shared tolerant `GetUrlContent` helper unchanged so other endpoints do not acquire unrelated behavior changes.
3. Add `src/test/org/epics/archiverappliance/mgmt/bpl/reports/CurrentlyDisconnectedPVsResponseTest.java` to exercise the shipped `CurrentlyDisconnectedPVs.execute` action with the real configuration test fixture, controlling only outer engine HTTP and servlet request/response boundaries. Do not mock the fetch function, validator, action or configuration-service behavior. Every case must inspect the action's final HTTP status, Content-Type and complete response body, rather than stopping at a fetch exception. Healthy empty/nonempty responses require HTTP 200 and the corresponding JSON array. Non-200 engine statuses, redirects, response loss, null/object/malformed JSON, invalid rows and timeout require HTTP 503, Content-Type application/json, status=error and nonempty string desc; reject any leading/trailing successful array or partial report. Include a valid first row followed by an invalid row. With a twenty-second silent boundary, require the final timeout error response within fifteen seconds and retain elapsed time/request evidence. Have a boundary accept and log the GET, then close before response headers; require exactly one outbound engine request. For 301/302/303/307/308, use same-origin and different-origin redirect targets with independent logs; require exactly one outbound engine request and zero redirect-target requests. Keep request logs and assert counts, including the preserved internal header, for these cases. Execute the locale checks below through the same action and inspect actual UTF-8 response bytes. These are action/HTTP-boundary checks, not deployed-appliance verification. Add `src/test/org/epics/archiverappliance/mgmt/CurrentlyDisconnectedPVsTest.java` under the integration profile to query the actual deployed management and engine handlers with `TomcatSetup`, `SIOCSetup` and the shipped database. Cover connected absence, actual IOC-stop inclusion, paused exclusion and reconnect absence through real endpoint responses. Run this concrete class and unchanged `org.epics.archiverappliance.mgmt.MetricsTest` after the T10 clean build. Java and Python fixtures run sequentially with teardown verified between them.
4. Build a fresh complete four-WAR bundle for the production correction, record its source/build digests and use it explicitly for T10 and T27-T30. Pass matching `archappl.war.dir` and `archappl.final.name` to Java fixtures; do not infer a WAR basename from today's date or HEAD. Repeat the same actual engine-unavailability case and unchanged raw-response assertions on the corrected bundle. Require HTTP 503, Content-Type application/json, the complete status=error/desc object, no successful array and bounded owned-process cleanup. Retain both baseline and corrected evidence. A different fault, a weakened assertion or the client timeout alone cannot establish the server correction.
5. Modernize the CLI using only Python's standard library and the existing `bpl_url`, `positive_timeout`, `_request` and `diagnostic` behavior. Use an argparse parser with one explicit BPL URL and no PV input file. Add `--timeout`, default 30 seconds, finite and greater than zero, at most 86400. Query GET `getCurrentlyDisconnectedPVs` with no mutations or automatic retries. Validate the complete array before output: each row is an object with nonempty printable-ASCII `pvName` and `instance`. Require `connectionLostAt` and `lastKnownEvent` to be nonempty Unicode strings; reject control characters U+0000 through U+001F and U+007F through U+009F, and line separators U+2028/U+2029. Preserve accepted time strings exactly, including locale text and the literal values Never/N/A; do not parse, translate or normalize them. The epoch field is a nonnegative decimal string, and other supplied report fields have their documented string types. Reject duplicate `(instance, pvName)` identities instead of overwriting them. Preserve case and names; sort by instance then PV name. Retain `Appliance <instance>:` grouping and `<pvName> <connectionLostAt>` lines. Preserve literal `--onlyNA`/`--noNA` behavior and existing `--onlyNA` precedence when both are supplied. Document that these are legacy value filters, not never-connected classification. A valid empty/filtered-empty array produces no PV output and exits 0; HTTP/transport/JSON/schema/output failures produce useful stderr, no partial report and exit 1; invalid arguments exit 2 before HTTP. Prevalidate the entire output against stdout's encoding before printing; an encoding that cannot represent a valid Unicode timestamp is an output failure, not a malformed server response. Report failure as an unavailable report, never as zero disconnections.
6. Add actual subprocess checks in `src/test/pythontests/test_disconnected_client.py` with only the outer management HTTP boundary controlled. Cover method/path, URL and timeout bounds, zero-request argument failures, unsorted/empty/nonempty reports, literal filters, duplicate identities, wrong types/missing fields, control characters, unsupported output encoding, malformed/truncated JSON, HTTP 503 and connection loss. With `--timeout 1` and a ten-second response delay, require timeout-specific stderr and exit 1 within five seconds. Execute the locale checks below through the shipped CLI with UTF-8 and ASCII stdout. Verify a malformed later row produces no earlier PV output and errors do not become a valid empty report. Run every existing Python client suite; any shared-helper change additionally requires its affected existing real workflows. Do not add report semantics to the mutation parser or change existing operation output.
7. Add `src/test/pythontests/verify_disconnected.py` using the existing launcher, SQLite and unchanged `softIocPVX`/`UnitTestPVs.db` fixture under a dedicated prefix. Execute T29 as described below, including the final documentation commands verbatim. After the CLI exists, also repeat T27 through this same shipped CLI against both recorded WAR versions: the healthy unfiltered query exits 0; the unavailable-engine query must exit 1 with no report output on the correction. Retain the failed assertion on the original server, which may still give the CLI an indistinguishable valid empty array. Do not add a separate health probe and count it as proof that this report completed successfully.
8. Document dependencies, direct launcher/IOC setup, the unfiltered report, timeout and optional literal filters, exclusion of paused PVs, exact server-generated Unicode time strings, required stdout encoding support, exit codes and unavailable-report handling. Document the test runner and fault procedure in TESTING.md. Execute the final command block against the real appliance, build the book with pinned T3 tools, and verify source/copy equality and all affected sample links. Record only executed counts and results with their source/WAR provenance. Do not close M17 until the subsequent supported-operation inventory and its separate acceptance are complete; prepare any GitHub issue/body change separately under the normal issue workflow.

Locale checks for T27/T28: in the action tests, call the shipped TimeUtils.convertToHumanReadableString for both time fields with one fixed positive epoch under Locale.US, Locale.FRANCE and Locale.JAPAN. Save the original default locale and restore it in finally; do not modify the engine formatter or launcher locale. Retain the generated rows with source/class provenance, and serve them as UTF-8 JSON at the outer engine HTTP boundary. Run the actual management action, require HTTP 200 with application/json and UTF-8 response encoding, decode its complete response bytes and assert exact equality of both time fields with the formatter output. Reuse those captured formatter values in the outer management HTTP fixtures for the actual CLI subprocess checks; do not reimplement date formatting. With UTF-8 stdout, require exit 0 and exact grouped output for the France/Japan connectionLostAt strings. With ASCII stdout and those same valid strings, require output-encoding stderr, exit 1 and no partial report. Test the defined control characters and line separators in each time field: the server action must return the complete HTTP 503 JSON error, and the CLI must reject an invalid HTTP 200 report with exit 1 and no report output. These are action/client HTTP-boundary checks; the direct formatter observation and controlled responses do not establish deployed engine behavior.

Actual engine-failure procedure for T27: the launcher supervises all four component JVMs and shuts the run down when a child exits, so simply killing the engine and racing a management request is insufficient. Run direct HTTP and shipped-CLI observations in separate owned fault runs, using the same engine-stop procedure and unchanged assertions before and after correction. After all four components are ready, identify the owned launcher and engine by recorded boot ID, PID and start time. Start one monotonic 60-second suspension deadline when sending SIGSTOP to only that launcher. Within five seconds, verify its matching /proc identity and stopped state before signalling the engine. Stop only the owned engine gracefully with SIGTERM; within 30 seconds require its original identity to be exited or a zombie awaiting parent reaping, its port to refuse a connection and management to remain alive. Treat zombie detection as process-exit evidence only; final cleanup must reap it. Then perform the actual management query: direct HTTP has a 15-second timeout; the CLI uses --timeout 15 and a 20-second subprocess limit. Reserve the final five seconds of the shared 60-second budget for SIGCONT and its acknowledgement; start restoration no later than elapsed second 55. Cap each earlier phase at the remaining pre-restoration budget; do not extend either deadline. If a phase expires, fail the case and immediately enter restoration. In every finally path, send SIGCONT to the matching owned launcher and verify within five seconds that it resumed or exited; restoration runs even after setup, HTTP or CLI failure. On a successful intended fault case, require launcher exit 1, the exact engine component-exit diagnostic and retained status=stopped; another nonzero exit is not evidence of the intended fault. Await supervision cleanup within the configured 300-second grace plus seven-second allowance after resumption. If setup failed while the engine remained alive, resume the launcher and request its ordinary SIGTERM shutdown within the same cleanup bound; do not accept that run as a reproduced fault. Restoration, appliance teardown and IOC teardown are independent cleanup steps so one failure cannot skip the others. Require no forced stop, no paused process, every original child reaped and no surviving owned JVM or IOC. Never suspend/stop an unrelated process or change firewall rules, URLs, deployed responses or launcher supervision. If this procedure cannot safely hold management available and complete cleanup, fail setup and return the retained evidence for plan revision rather than substituting a component. A fresh healthy run follows each fault case.

Actual IOC workflow for T29: start a fresh healthy appliance and the real shipped IOC, archive independent active and paused-control targets through the shipped CLIs, wait for actual connections using the engine-sourced `getPVDetails` metric `Is this PV currently connected?=yes`, and retain at least three real numeric samples. Capture the healthy empty report before pausing any target. Pause the control through the shipped pause CLI and await Paused. Stop the IOC through its open stdin, require its exit 0, await the active targets' connection metric `no`, and require the unfiltered report to contain exactly those active target names, excluding the paused control and an unsubmitted unknown name. Compare CLI lines with retained raw management/engine rows and require a positive recorded loss epoch; do not parse a display timestamp to infer its timezone. Restart the same IOC command/database/prefix, await connection metric `yes`, require active targets absent from the report and at least three new real samples. For each report query, compare type information, archive inventory and fixed pre-query retrieval samples to prove the client changed no configuration or stored baseline. Allow real recording to continue outside the fixed interval. Test successful empty reports independently from unavailable-engine errors. Preserve pending-request and never-connected distinctions; do not infer a channel state from archive-request acceptance alone.

Deadlines and ownership: prepare the shipped PB adapter/classpath before any fixture when PB baseline inspection is used. Keep the 180-second launcher startup, 360-second initial archive and 120-second connection/report/retrieval deadlines, with one-second polls and retained last observations/monotonic durations; never extend a deadline to obtain a passing result. IOC exit waits are bounded at 30 seconds, and restart retains a separate owned process handle. Before each fixture, require its TCP/UDP ports free; port conflicts fail setup without stopping another process. Ordinary launcher shutdown requires exit 143 within its configured 300-second grace plus seven-second allowance, all owned JVMs gone and IOC exit 0. The deliberately stopped-engine case has the separate 60-second suspension, 30-second engine-exit and five-second stop/resume acknowledgement limits above, followed by cleanup bounded at 300 plus seven seconds after resumption. Its intended launcher exit is exactly 1 with the engine-exit diagnostic and status=stopped; forced, incomplete, unproven or unrelated-error cleanup fails the run. Retain all run folders, manifests, responses and logs on failure or success.

Completion requires T27-T30 and applicable T10 passing on the shipped paths: actual hidden-failure reproduction before correction, final action HTTP 503/application-json/error-object assertions after correction without any partial successful report, exactly one outbound engine request and zero redirect-target requests in the defined transport cases, healthy empty/nonempty reports with exact Unicode time-string preservation and UTF-8 response encoding, executed locale and control-character checks with explicit output-encoding failure behavior, real IOC disconnection/recovery and paused exclusion, strict CLI failure behavior, unchanged existing clients, reproducible documentation and bounded owned-process cleanup with verified restoration. The plan is accepted and implementation is authorized on 2026-10-01. The original deployed engine-failure assertion has failed as predicted, and the management correction, CLI, and tests are implemented. Fresh T10 passes all 882 default tests, final action checks pass 25 cases, Python clients pass 84 cases, and the final book has nine identical linked sample copies. The corrected four-WAR bundle is retained in work/disconnected-bundle/. Final Java integration passes both CurrentlyDisconnectedPVsTest and unchanged MetricsTest. Corrected actual engine failures return HTTP 503 and CLI exit 1; the same assertions fail on the original WARs. All 26 IOC workflow checks, verbatim commands, fresh healthy runs and bounded cleanup pass. work/disconnected-final-evidence.json confirms 610 production-source hashes and final client/test/doc digests; only this management action differs from the original production sources. Implementation, local verification and landing are complete: c4516e76765733a3f0d4426bf41a3a5c1e9c71d8 is on origin/modernize. Issue #6's body was updated at 2026-10-01T23:46:54Z to include deletion and disconnection results, with eight checked criteria and one unchecked final-inventory criterion. Final operation inventory acceptance remains; M17 stays In progress.

###### Final inventory research and modularization proposal

Plan Status: accepted
Plan Acceptance: 2026-10-02, the inventory classification recorded in Dependencies And Decisions and the closing steps at the end of this subsection. The Bash/curl/jq module proposal is not accepted; it is carried to M37 as research input.
Implementation Authorization: 2026-10-02, correct the scripting page's sample-script paragraph and execute the remaining T9 checks. None for a Bash replacement, dependency changes or source removal.
Superseded Plan Artifacts: none; prior accepted implementation scopes and executed results above remain intact

Research basis: source commit b2eae22a80f573a4dad30b93c2ce125060c778ff, inspected on 2026-10-02. The 27 Python files under `docs/book/src/samples` comprise 25 CLIs and two helpers, with 1,774 lines. Sixteen files contain 31 direct `requests.get`/`requests.post` call sites; these establish repeated transport responsibility, not 31 identical algorithms. Nineteen CLIs use HTTP without a DB/native/mail boundary, one observes filesystem sizes, and five combine HTTP with DB parsing, CA diagnosis or SMTP. The eight modernized core commands already share strict behavior through `archiverClient.py` and `listArchivedPVs.py`.

The complete function map is retained here so the inventory does not depend on local research artifacts. Names below use the `docs/book/src/samples/` prefix.

| Function group | Current CLIs | Distinct behavior retained for the inventory |
| --- | --- | --- |
| Inventory | listArchivedPVs.py; unarchivedPVs.py; archivedPVsNotInList.py | Complete listing; incoming rows absent from expanded inventory; configured names absent from incoming input |
| Status and reports | getPVStatus.py; printCurrentlyDisconnectedPVs.py; listTypeChanges.py | Explicit appliance states; grouped disconnection report and literal N/A filters; reported type-change details |
| Explicit PV actions | archivePVList.py; pausePVList.py; resumePVList.py; deletePVList.py; renamePVList.py | Full identity preflight; action-specific acknowledgement; no automatic mutation retry; distinct stored-data and copy semantics |
| Recovery selection | abortNeverConnectedPVs.py; resumePausedPVsMatchingPattern.py; stopArchivingCurrentlyDisconnectedPVs.py | Age-based pending-workflow cancellation; paused-pattern resume; Never-selected pause followed by deleteData=true |
| Storage and configuration | consolidatePausedPVs.py; consolidateArchivedData.py; changeArchiveStore.py; addPostProcessingOperator.py; removeMetaFields.py | Leave-paused consolidation versus consolidation/resume; store substring replacement; LTS operator addition; extra-field removal |
| Alerts | checkConnectedPVs.py; checkTypeChangedPVs.py; storageSizeCheck.py | Different metrics, thresholds, message content and SMTP effects |
| Diagnostics | checkForEngineActivity.py; pingCurrentlyDisconnectedPVs.py | Filesystem path/size comparison; HTTP report followed by native CA diagnosis from the client environment |
| IOC database provisioning | archiveFromDB.py | Real EPICS static DB parser with includes/macros/info tags and bulk archive submission |

Helper coverage: `archiverClient.py` supplies input, HTTP, identity, response and pause/resume behavior. `emailHandler.py` supplies configuration, MIME, recipient and SMTP/TLS/auth behavior. A missing optional dependency is not evidence that the associated operational need can be removed.

Proposed boundaries: Bash entry points and explicit procedures; a shared curl transport; named jq request/response programs; common input and identity preflight; inventory/report/PV-action/type-info modules owning their own success predicates; output and batch aggregation; separate DB, CA, mail and filesystem adapters. HTTP management of archived PVA PVs and direct PVXS operations remain separate interfaces. Current samples do not execute PVXS tools; server PVA management actions exist independently. This is a proposal, not an implementation or support decision.

Constraints carried into the next scope decision:

- Preserve separate consolidation procedures. `consolidatePausedPVs.py` leaves its selected PVs paused; `consolidateArchivedData.py` resumes after consolidation. Commit 81e7a3867472170b0fa04ca1cc41f0788a601c5b records the long-paused MTS cleanup purpose. Commit 5b41bb52c0270b0de662fcd8c54f246581068318 removes internal pause/resume from `removeMetaFields.py`; a generic lifecycle wrapper would change that recorded behavior.
- Preserve comparison populations and outputs. `UnarchivedPVsAction` uses `DefaultConfigService.getAllExpandedNames`, including aliases, fields and pending requests, and the client emits original rows. `ArchivedPVsNotInListAction` uses configured `getAllPVs` and emits names. One local set subtraction over a listing does not reproduce both.
- Preserve full input validation and preflight. File decoding, CR/CRLF/LF normalization, trimming and command-specific validation occur in that order; globally removing CR or comments changes targets. File UTF-8 validation and binary HTTP JSON decoding have different contracts. Positive finite float32 validation does not mean sending the float32-rounded value; the current archive payload uses the original Python float's string.
- Keep transport results separate from operation acceptance. HTTP 200 alone does not establish success; pause and resume have different component checks. Unknown outcomes can include partial server changes. Continuation belongs to each procedure; stricter legacy failure handling and recovery are explicit behavior changes.
- Set timeout and dependency policies before any replacement. The existing urllib blocking-operation timeout is not equivalent to curl's whole-transfer deadline. A per-request limit is not a deadline for a complete procedure. Retain the real DB parser and native/mail behavior until equivalent replacements are demonstrated.
- Use current sequential behavior as the comparison baseline. Bounded reads and connection reuse remain unverified optimizations; per-PV curl processes do not share a connection pool. No server speedup or concurrent-mutation safety was measured.

Closing steps after the 2026-10-02 inventory decision:

1. Completed 2026-10-02: in `docs/book/src/scripting.md`, the `Other sample scripts` section states that this fork's tests do not run the further scripts in the samples folder, and tells the reader not to use stopArchivingCurrentlyDisconnectedPVs.py, to select PVs from the lastKnownEvent field of getCurrentlyDisconnectedPVs, and to act with pausePVList.py and deletePVList.py. Closed by T9.
2. Completed 2026-10-02: the six live runners ran on the current tree and the book, copy and link checks ran on the corrected page. Closed by T9.
3. Completed 2026-10-02: issue #6's body was reconciled with this detail and the issue closed as completed (Closure Evidence).

Defining each retained procedure's conditions and recovery checks, any replacement, and the comparison of original and replacement entry points belong to M37. No Bash equivalence, live protocol result or performance acceptance is recorded here.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | ./mvnw -B -ntp clean verify after step 1 | JDK 21, wrapper Maven | Build and the default test suite pass |
| T2 | Integration | List the release tarball and the mgmt WAR that T1 built | T1 output under target/ | The mgmt WAR has no install/deployMultipleTomcats.py and still has install/*.sql and install/pbutils. The tarball holds mgmt.war, engine.war, etl.war and retrieval.war at its root; for the rest, a no-regression check because the deleted fileSets already read a missing directory, it still has tomcat-log4j/ and *.sql under install_scripts and has no quickstart.sh or sample_site_specific_content |
| T3 | Integration | Build the book with docs/book/Dockerfile after steps 1 to 3 (docker build -t aa-mdbook docs/book, then docker run --rm --user "$(id -u):$(id -g)" -v "$PWD/docs/book:/book" aa-mdbook build, as pages.yml runs it) | Docker, pinned mdBook 0.4.52 and mdbook-admonish 1.20.0 | Exit 0, and no Warning line other than the mdbook-admonish notice that it was built against mdBook 0.4.51, which the current tree already prints |
| T4 | Static | git grep for quickstart.sh, sampleStartup.sh, deployMultipleTomcats, addMysqlConnPool, single_machine_install, multipleBuildAndDeploy, sample_site_specific_content, samples/site_specific_content, pythonPBRaw, samples/debug, ui/help/samples, slacdev, and a link to quickstart.md or (quickstart), excluding docs/archiverap-carry-d12382d1.md and this register; template_changes.html is not searched because src/sitespecific/tests keeps its own copy | Working tree after step 1 | No match |
| T5 | Integration | Execute every core example and every T5 state/data assertion above using the documented commands against the current four WARs | M22 launcher with SQLite; softIocPVX with shipped UnitTestPVs.db; system Python with declared dependencies; direct explicit URL, no routing proxy | Pause stops new value samples, resume restores them, rename preserves matching old/new data, both deletion modes have the specified data effects, and actual disconnections are reported; record per-operation state/data evidence and exit codes |
| T6 | Static | LC_ALL=C grep -rnP '[^\x00-\x7F]' docs/book/src --include='*.md' after step 3 | Working tree after step 3 | No match |
| T7 | Integration | Run listArchivedPVs.py for all names, a glob, no matches and explicit limits; include more than 500 archived PVs loaded from the shipped fixture | Same real appliance and Python environment as T5 | Complete sorted unique default output, correct filtering and requested limit; no silent truncation at the BPL default of 500 |
| T8 | Integration and client boundary | Execute every T8 failure assertion above, including mixed batch results, duplicate/chained/alias-equivalent input rejection, closed port, delayed response, malformed JSON, unexpected structure and live API validation errors | Real isolated T5 appliance for batch/state checks; separate local HTTP fault server only for client transport/response checks | Exit 0/1/2 follows the batch contract; every input outcome is reported; rejected mutations preserve checked state/data; delayed response exits 1 within 5 seconds with --timeout 1; invalid responses cannot appear successful |
| T9 | Documentation | Set up dependencies from the documented instructions, then execute the scripting page's commands verbatim and rebuild the book using T3 | System Python in an isolated environment; real M22 appliance and shipped IOC fixture | Setup and commands reproduce the documented output and state; all shipped example links resolve; book builds with only the existing permitted warning |
| T10 | Regression | If server code or build/runtime configuration changes, follow the process order above: stop the example appliance/IOC, verify free fixture ports, run ./mvnw -B -ntp clean verify to build fresh WARs and the default suite, then ./mvnw -B -ntp test -P integration -Dtest=<affected-test-classes> with the concrete class list recorded before execution; include a regression for each corrected BPL defect, verify fixture teardown, then start a fresh example appliance on those WARs and rerun the affected T5-T9 cases | JDK 21, wrapper Maven, Tomcat 9, real EPICS environment per TESTING.md; explicit integration profile clears default tag exclusions | Default suite and all selected integration tests execute with zero failures/errors; each bug regression fails on the defective real path and passes on the correction; evidence identifies source revision, WAR digests, test names/counts and example results. If there is no server/configuration change, record the inspected diff and an explicit not-applicable result |
| T11 | Integration | Run src/test/pythontests/verify_archive_status.py per TESTING.md with the actual archive/status CLIs | Four current WARs; local launcher, SQLite, real softIocPVX and unchanged UnitTestPVs.db; own PV prefix and CA port | Unknown, pending and archived states; effective MONITOR/SCAN periods; unchanged settings on repeat; configured alias resolution and overlap rejection; real failure in every batch position with successful independent items; normal owned-process cleanup |
| T12 | Client boundary | Run test_archive_status_clients.py and the existing listing unittest suite as documented in TESTING.md | Actual CLI subprocesses; only the outer HTTP transport controlled | Input and alias validation, finite timeout/period bounds, structured rejections, malformed/truncated responses, continued batch reporting and exact ASCII table output; no listing regression |
| T13 | Documentation | Execute the archive/status scripting command block verbatim through T11, build the book using T3, and compare the four copied Python files with source | Standard-library-only venv; real T11 appliance; pinned mdBook image | Status/archive/status commands reproduce the documented results; linked scripts match source; obsolete getPVList.py is absent; build exits 0 with only the permitted warning |
| T14 | Integration and storage | Run verify_pause_resume.py with the shipped CLIs, real IOC monitor, retrieval and the real PB-reader adapter | Local four-WAR appliance with SQLite; unchanged UnitTestPVs.db; dedicated prefix, owned ports and bounded cleanup | PB and retrieval tuple sets stay unchanged before resume while IOC/control keep updating; a resumed current value with an earlier IOC timestamp satisfies the accepted provenance and PB-persistence checks; at least three post-resume tuples match retrieval and actual PB within the persistence deadline; numeric samples with connection/startup fields remain counted; baseline stays identical; alias/.VAL and mixed/repeated/unknown rejection cases satisfy the per-PV contract |
| T15 | Client boundary and regression | Run test_pause_resume_clients.py, existing archive/status and listing suites; compare canonical names with the real Java normalizer; rerun verify_archive_status.py after shared-helper changes | Actual CLI subprocesses, controlled outer HTTP boundary, shipped Java PVNames implementation; existing real archive/status fixture runner | Supported names use one canonical identity for lookup, mutation and response; unsupported local forms send no HTTP requests and unsupported remote identities send no mutations; component-aware response validation, finite timeout and continued batch reporting; existing CLI and real archive/status checks still pass |
| T16 | Documentation | Execute the documented pause/status/resume/status commands verbatim, build the book using T3 and compare all affected sample copies | Isolated standard-library-only Python environment and real T14 appliance; pinned book image | Commands reproduce the output and state described; companion-file links resolve, copied files match and only the permitted build warning remains |
| T17 | Integration and storage | Run verify_rename.py through the shipped archive, pause, rename and status CLIs; compare real retrieval and PVSampleDump records | Current four-WAR SQLite appliance, existing Tomcat 9, unchanged UnitTestPVs.db, dedicated prefix/ports and real PB readers | Both names remain Paused with copied settings and exact baseline multisets; source retained; all-success, aliases/.VAL, overlap rejection and actual mixed BPL failures in each position satisfy state/data/exit contracts; normal owned-process cleanup |
| T18 | Client boundary and regression | Run test_rename_client.py and all existing client suites, including mutation redirect cases; rerun both existing live archive/status and pause/resume workflows | Shipped CLI subprocesses; only outer HTTP boundary controlled; existing actual appliance runners | Whole-pair validation, canonical parameters, conservative reporting, three-column table and bounded timeout; 301/302/303/307/308 cause one mutation request with no Location follow; later independent records continue; existing script behavior preserved |
| T19 | Documentation | Execute rename workflow commands verbatim through T17; build book using T3 and compare linked/copied scripts | Standard-library-only Python environment, real T17 appliance and pinned book image | Pair-file setup and pause/status/rename/status commands reproduce stated outcomes; source retention and recovery limits are explicit; sample copies/links match and build has only permitted warning |
| T20 | Server integration | Use the adapter, dependency classpath and verified four-WAR bundle prepared before T17; pass its directory and basename explicitly to the strengthened org.epics.archiverappliance.mgmt.RenamePVTest under the integration profile; apply T10 for production/runtime changes | JDK 21, same explicitly selected WARs as T17, TomcatSetup/SIOCSetup with shipped IOC fixture | All selected and deployed WAR digests match build evidence; no date/HEAD naming mismatch; actual BPL success, both retained Paused configurations and exact old/new baseline records; fixture teardown completes; any approved server correction has a failing-before/passing-after real regression |
| T21 | Integration and filesystem boundary | Run real destination-write and partial-copy failures through verify_rename.py, the shipped CLI and deployed RenamePVAction; independently inspect configuration, retrieval and each retained PB file before and after orderly shutdown | Isolated T17 appliance and real IOC fixture; destination-specific filesystem fault; Linux/strace capability recorded when used; same explicit WAR bundle | Intended fault observed after metadata registration and, separately, after actual data copying begins; Outcome unknown/exit 1, no retry or source deletion, source/control decode independently and exactly preserve saved-interval multisets; destination file sizes, reader results and absent/empty/undecodable states recorded without hiding healthy-file checks; partial-copy onset proven; fault restored, later independent pair succeeds and normal owned-process cleanup completes |
| T22 | Integration and storage | Run verify_delete.py through the shipped archive/pause/delete/status CLIs; inspect saved PB roots after every orderly stop and verify retained-folder restarts | Same explicitly selected four-WAR SQLite appliance, real softIocPVX and unchanged UnitTestPVs.db; independent targets with actual STS/MTS/LTS records prepared through real ETL | Default false preserves exact baseline records; explicit true removes target streams across all saved roots; both remove configuration/aliases while control metadata/data remain unchanged; store cases have nonempty pre-deletion evidence; aliases/.VAL, overlap and real mixed failures satisfy request/exit/state/data contracts |
| T23 | Client boundary and regression | Run test_delete_client.py and every existing Python client suite; rerun existing real workflows affected by shared code | Shipped CLI subprocesses; only outer HTTP transport controlled; actual existing live runners for regressions | Explicit false/true parameters, identity validation, ASCII output, conservative response handling and bounded timeout; one mutation per item, no redirects/retries and continued independent outcomes; no existing client or affected workflow regression |
| T24 | Documentation | Execute both documented deletion command blocks verbatim through T22; build book using T3; compare affected source/copies and links | Standard-library-only Python environment, actual T22 appliance/IOC and pinned book image | Mode selection and pause/status/delete/status reproduce the stated results; acknowledgement/storage limits and recovery instructions are accurate; all affected copies/links match and only the permitted build warning remains |
| T25 | Server integration | Strengthen DeletePVTest with real IOC/PB assertions; run DeletePVTest, DeletePVAfterRestartTest and DeleteMultiplePVTest sequentially under the integration profile with explicit bundle selection | JDK 21, TomcatSetup/SIOCSetup, same four WARs as T22, shipped PB reader | The strengthened test verifies actual response/configuration and both data-mode contracts, sends each deletion once and polls only read-only state; selected/deployed WAR hashes match. Original restart/bulk checks still execute as regressions, not storage or no-retry evidence; fixture teardown completes |
| T26 | Integration and filesystem boundary | Attempt actual target PB deletion with a target-specific permission/syscall fault through the shipped CLI and real management/ETL/storage/reader path; retain executions before and after any required server correction with the same fault and unchanged assertions | Isolated real appliance/IOC; saved store roots; owned ETL process only; Linux/strace capability when required | Prove failed delete syscall and retained target data; failed item reports Outcome unknown and never Delete accepted, batch exits 1; exactly one mutation per item, no automatic retry; later healthy items are accepted with correct configuration/alias removal and selected-mode PB effects; control configuration/data remain unchanged; restore fault and stop normally. Hidden success requires separate server correction and T10, with unchanged real-path assertions failing before and passing after, before deletion completion |
| T27 | Server regression and actual component failure | Execute the defined actual engine-stop procedure against the recorded baseline and fresh corrected four-WAR bundle in separate direct-HTTP and shipped-CLI fault runs; run actual action/HTTP-boundary tests, CurrentlyDisconnectedPVsTest and unchanged MetricsTest with T10 | Real owned management/engine/launcher, unchanged IOC fixture and verified WARs; only separately labelled action tests control the outer engine HTTP and servlet boundaries | Same actual fault and assertions fail before and pass after correction; final action returns HTTP 503, Content-Type application/json and status=error/nonempty desc for unavailable/invalid/timed-out engine responses, with no partial successful array; accepted-GET response loss and every same/different-origin redirect case have exactly one engine request and zero redirect-target requests; corrected CLI exits 1 without PV output; healthy arrays retain their contract, including exact US/France/Japan TimeUtils strings through UTF-8 response bytes; timestamp controls/line separators produce the specified JSON error; 60-second suspension/30-second engine stop/five-second acknowledgements hold, launcher restoration is verified and the intended fault ends with exit 1, engine-exit diagnostic, status=stopped and complete bounded cleanup |
| T28 | Client boundary and regression | Run test_disconnected_client.py and all existing client suites; execute the shipped report subprocess with controlled outer management HTTP responses | Standard-library-only Python; actual CLI/helper; outer HTTP transport controlled for client checks only | Sorted grouped output and literal filters, exact captured Unicode time strings with UTF-8 stdout and exit 0, ASCII stdout encoding failure with exit 1/no partial output, rejection of timestamp controls/line separators, valid empty exit 0, strict whole-response/output validation, no partial output, useful stderr/exit 1, invalid arguments exit 2 before HTTP, bounded timeout and no automatic retries; existing clients remain unchanged |
| T29 | Real appliance and IOC lifecycle | Run verify_disconnected.py through the shipped archive/pause/report clients, actual connection metrics, raw reports and retrieval; stop and restart the actual IOC and retain fixed baselines | Fresh corrected four-WAR SQLite launcher, real softIocPVX and unchanged UnitTestPVs.db, isolated prefix/ports | Initially connected report is empty; after IOC stop all active targets appear with actual loss information and paused/unknown targets are excluded; after restart targets reconnect and disappear from the report while sampling resumes; report queries preserve configuration/inventory/baselines; deadlines and ordinary cleanup pass |
| T30 | Documentation | Execute final disconnection command block verbatim in T29; build book with T3 tools and compare affected copies/links | Actual corrected appliance/IOC, standard-library Python and pinned mdBook/admonish | Reproducible explicit-URL report, timeout and documented literal filters; paused exclusion and unavailable-report errors are clear; all affected sample copies/links match and only the permitted build warning remains |
| T31 | Static inventory and contract review | Read all 25 CLIs and two helpers, inspect relevant server actions and source history, map shared mechanics and distinct procedures, and compare all source bytes with the recorded commit | Source commit b2eae22a80f573a4dad30b93c2ce125060c778ff; official tool/API documentation | Exactly 25 unique CLI mappings and both helpers; explicit native/mail boundaries and compatibility constraints; source unchanged; no implementation equivalence or performance inferred from research |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T5 | 2026-10-02 15:55-16:28 UTC | The T9 run of the same time below: one four-WAR bundle aa-20261002-b2eae22a, real SQLite appliance, softIocPVX and unchanged `UnitTestPVs.db`, direct explicit URLs, standard-library Python | Pass | Every core example ran against the real appliance in one sequence with no failed check: listing 13, archive/status 22, pause/resume 58, rename 132, deletion 664 and disconnection reporting 26. These runners carry the state and data assertions of T11, T14, T17, T22, T26 and T29, so disconnection reporting, the part open in the 2026-10-01 roll-up, is covered. Evidence: work/inventory-final-status.txt and the work/inventory-final-*-run folders |
| T8 | 2026-10-02 20:02-20:03 UTC (client boundary); 15:55-16:28 UTC (real appliance) | Python 3.13.5; shipped CLI subprocesses against a local HTTP fault server on the tree at 3229d61643561195b4c84d147a383f578a5be0d9, whose `docs/book/src/samples` equals the tree the runners used; real-appliance batch checks from the T5 run above | Pass | The archive/status, pause/resume, rename, deletion and disconnection client suites ran 70 tests and the listing suite 14, all passing with no failure, error or skip (work/inventory-final-clients.log, work/inventory-final-listing-clients.log). The real mixed-batch, overlap, repeated-operation and storage-failure cases pass inside the T5 runners. The launcher-death cleanup test was not rerun; its result of 2026-09-30 below stands |
| T9 | 2026-10-02 16:57 UTC | Pinned mdBook 0.4.52/admonish 1.20.0 Docker image; working tree on b2eae22a80f573a4dad30b93c2ce125060c778ff after the `Other sample scripts` section replaced its print-command advice with the lastKnownEvent field of getCurrentlyDisconnectedPVs | Pass | The book builds with exit 0 and only the permitted admonish version warning (work/inventory-book-2.log), again through `build -d` into a separate output folder. All 257 relative links and anchors read from 14 of the 17 built pages resolve, and the nine linked sample files match their source bytes (work/inventory-book-links-2.json). The fenced command blocks of the page are byte-identical to those at b2eae22a80f573a4dad30b93c2ce125060c778ff, so the 15:55-16:28 UTC runner results below apply to this text unchanged |
| T9 | 2026-10-02 15:55-16:28 UTC | JDK 21.0.12.1, Tomcat 9.0.122, softIocPVX and unchanged `UnitTestPVs.db`; one four-WAR bundle aa-20261002-b2eae22a built from the working tree on b2eae22a80f573a4dad30b93c2ce125060c778ff with the corrected scripting page; standard-library Python | Pass | The six shipped runners ran sequentially against the real four-WAR SQLite appliance and IOC and each exited 0 with no failed check: listing 13, archive/status 22, pause/resume 58, rename 132, deletion 664 and disconnection (ioc mode) 26. Each run executed its scripting-page command block verbatim and stopped its owned appliance and IOC; no appliance port or owned process remained afterwards. work/inventory-final-status.txt records step times and exit codes, work/inventory-final-bundle/manifest.json the bundle, and the work/inventory-final-*-run folders the commands and outputs. Together with the 15:49 UTC book, link and copy check below, this completes T9 |
| T9 | 2026-10-02 15:49 UTC | Pinned mdBook 0.4.52/admonish 1.20.0 Docker image; working tree with the corrected `Other sample scripts` paragraph on b2eae22a80f573a4dad30b93c2ce125060c778ff | Partial | The book builds with exit 0 and only the permitted admonish version warning (work/inventory-book.log). The build wrote to a separate output folder through `build -d`, because the existing docs/book/book output is owned by root and the pinned image, run as the invoking user, cannot clear it. All 257 relative links and anchors read from 14 of the 17 built pages resolve (print.html, toc.html and 404.html were not read for links), and the nine sample files linked from the scripting page match their source bytes (work/inventory-book-links.json). The corrected paragraph contains no command. The page's command blocks were not executed in this run; their evidence remains the per-operation runs recorded under T13, T16, T19, T24 and T30 |
| T31 | 2026-10-02 07:12-07:33 UTC | Frozen source b2eae22a80f573a4dad30b93c2ce125060c778ff; Bash 5.2.37, curl 8.14.1 and jq 1.7 observations | Pass for research scope only | All 27 sample sources were read and matched the recorded commit byte-for-byte. The complete 25-CLI/two-helper map and constraints are preserved above. Actual jq observations expose last-result, multi-document and invalid-byte pitfalls; the real pausePVList.py parser interpreted CR/CRLF/LF as two records and reported overlap exit 2. These observations verify only those tool/parser paths. No Bash candidate, new appliance workflow, adapter equivalence or benchmark was executed; T9 and final inventory acceptance remain incomplete |
| T10 / T27 | 2026-10-01 21:46 UTC; evidence rechecked 2026-10-01 21:58 UTC | JDK 21; Tomcat 9.0.122; real SIOCSetup/TomcatSetup; unchanged DB; CA port 29875; explicit corrected bundle | Pass | CurrentlyDisconnectedPVsTest and unchanged MetricsTest execute two tests with zero failures/errors/skips and BUILD SUCCESS in work/disconnected-java-final.log. All eight deployed WAR hashes match the bundle. Actual IOC loss, paused exclusion and reconnect pass; both owned report-test IOC processes exit 0. Fixture HTTP port refuses connections and no matching Java/IOC process remains before Python starts. work/disconnected-java-final-evidence.json retains counts, hashes and lifecycle observations. The first prefix failure and native-stream logs remain in work/disconnected-java-first/ |
| T27 | 2026-10-01 21:48 UTC; evidence rechecked 2026-10-01 21:58 UTC | Corrected four-WAR SQLite appliance; actual engine SIGTERM under bounded owned-launcher suspension | Pass | All seven checks pass in work/disconnected-corrected-raw/. The actual engine becomes a zombie and its port refuses with errno 111 while management remains alive; the unchanged assertion observes HTTP 503, application/json;charset=UTF-8 and complete status=error/nonempty desc in 0.004 seconds. Suspension is 10.246 seconds; restoration, intended launcher exit 1, engine-exit diagnostic, status=stopped and every original child reaped pass. The fresh work/disconnected-corrected-raw-healthy/ run passes all three checks, including HTTP 200 empty and ordinary exit 143 |
| T27 | 2026-10-01 21:52 UTC; evidence rechecked 2026-10-01 21:58 UTC | Recorded original aa-20261001-6552a9f5 WARs; same final shipped CLI and actual engine-stop procedure | Fail | work/disconnected-baseline-cli/ retains the unchanged CLI-exit-1 assertion failing on actual exit 0 with empty stdout/stderr. Healthy CLI, actual refused engine port/live management, restoration, suspension budget and intended cleanup pass independently. The original source/WAR/build/fixture provenance is checked through the recorded baseline manifest. A fresh original-bundle healthy run passes in work/disconnected-baseline-cli-healthy/. This failing assertion is retained as the original behavior, not counted as corrected verification |
| T27 | 2026-10-01 21:53 UTC; final healthy and evidence rechecked 2026-10-01 21:58 UTC | Corrected WARs; same final CLI digest and engine-stop procedure; independent fresh healthy run | Pass | All eight checks pass in work/disconnected-corrected-cli/: unavailable report exits 1, stdout is empty and stderr identifies HTTP 503. Restoration and intended fault cleanup pass. The first final healthy setup fails its bind preflight with errno 98 before starting processes and remains in work/disconnected-corrected-cli-healthy/. The separate fresh run on ports 29665-29668/29670 and CA 29675 passes all three checks in work/disconnected-corrected-cli-healthy-2/, including HTTP 200 empty, normal exit 143 and no remaining child. The original and corrected executions use the same CLI and final source hashes |
| T29 | 2026-10-01 21:51 UTC; evidence rechecked 2026-10-01 21:58 UTC | Corrected complete SQLite appliance; actual softIocPVX, unchanged UnitTestPVs.db and short unique prefix; CA 27675 | Pass | All 26 checks pass in work/disconnected-ioc/. All three targets connect and produce at least three numeric samples. Connected report is empty; after IOC exit 0, exactly two active targets appear with positive real loss epochs and matching engine-generated loss strings, excluding paused and unsubmitted targets. Restart reconnects active targets, produces at least three new samples and restores empty reports. Every report workflow preserves type information, sorted inventory and fixed-interval retrieval exactly. Normal launcher exit 143, both IOC exits 0, no surviving original child and empty cleanup errors are retained |
| T30 | 2026-10-01 21:51 UTC; final copies and evidence rechecked 2026-10-01 21:58 UTC | Actual corrected IOC-loss report, standard-library venv and pinned book tools | Pass | The scripting page's final command block executes verbatim with exit 0 and empty stderr; default, timeout and noNA produce the exact actual two-row report, while onlyNA is empty. work/disconnected-ioc/documented-commands.json retains exact shell text/output. Final book exits 0 with only the permitted warning; all nine linked copies remain identical to current source bytes. work/disconnected-book-final.log, work/disconnected-book-copies-final.json and work/disconnected-final-evidence.json retain the final provenance |
| T10 | 2026-10-01 21:10 UTC | JDK 21; fresh clean verify; corrected production action | Pass | All 882 default tests pass with zero failures/errors/skips and BUILD SUCCESS in work/disconnected-clean-verify.log. The separately prepared complete aa-20261001-bc190542 bundle has successful build logs and source/fixture/four-WAR digests in work/disconnected-bundle/manifest.json. Selected integration checks remain pending |
| T27 | 2026-10-01 21:18 UTC | Final action tests; real configuration fixture and controlled outer HTTP/servlet boundaries | Pass | Final CurrentlyDisconnectedPVsResponseTest passes all 25 tests with zero failures/errors/skips in work/disconnected-action-final.log. Each execute retains outbound request snapshots and independent same/different-origin target logs, actual complete response bytes and elapsed times. Captured TimeUtils locale values include current source/class hashes. These are action-boundary checks |
| T28 | 2026-10-01 21:26 UTC | Final actual CLI subprocesses, real closed stdout pipe, and controlled outer HTTP boundary | Pass | All 84 client tests pass: 70 in work/disconnected-clients-complete.log and 14 listing checks in work/disconnected-listing-final.log. The added closed-pipe assertion first fails with actual exit 120 in work/disconnected-closed-stdout-before.log; the final real CLI exits 1 with useful stderr, one HTTP GET, and no shutdown flush error. Final per-case stdout/stderr, exit, commands, request counts, locale source/class checks, and timeout observations are retained in work/disconnected-client-evidence/ |
| T30 | 2026-10-01 21:25 UTC | Pinned mdBook 0.4.52/admonish 1.20.0; final CLI and source book | Partial | Final book exits 0 with only the permitted version warning in work/disconnected-book-final.log. All nine unique linked samples exist and match source bytes in work/disconnected-book-copies-final.json. Actual IOC command-block execution remains pending |
| T27 | 2026-10-01 21:36 UTC | First actual Java integration run on the explicit corrected bundle, CA port 29875 | Fail | The new test prefix expands three shipped DB names to 65-67 characters; actual IOC loading fails and its observed exit is 2. The archive deadline fails at 360 seconds; independent unchanged MetricsTest passes with its valid shorter prefix and actual data. work/disconnected-java-first/ retains logs, reports, and native stream errors; work/disconnected-java-91724903453695/ioc-lifecycle.json retains the IOC exit. The DB is unchanged. The new Java and Python runner prefixes are shortened for the final real verification; no passing integration result is claimed yet |
| T27 | 2026-10-01 20:22 UTC | Original aa-20261001-6552a9f5 bundle; all production/build/fixture/WAR digests verified; owned four-process SQLite launcher on ports 27665-27668/27670 | Fail | Before production correction, actual engine SIGTERM leaves its original identity as a zombie after 10.140 seconds and its port unavailable while management remains alive. The unchanged HTTP-503/error-object assertion fails: management returns HTTP 200, application/json;charset=ISO-8859-1 and [] in 0.004 seconds. Suspension is 10.246 seconds; SIGCONT restoration and intended launcher exit 1, engine-exit diagnostic, status=stopped and complete child reaping pass. work/disconnected-baseline-raw/ retains raw responses, process identities, deployed hashes, waits, logs, results and cleanup. This is actual component-failure evidence, not an HTTP substitute |
| T27 | 2026-10-01 20:24 UTC | Fresh original-bundle appliance on ports 28665-28668/28670 | Pass | work/disconnected-baseline-healthy-2/ records matching deployed hashes, HTTP 200 with a genuine empty report, ordinary launcher exit 143 and no remaining original children. The first attempted healthy folder, work/disconnected-baseline-healthy/, failed its port-bind preflight without launching processes and is retained separately |
| T27 | 2026-10-01 20:32 UTC | Shipped management action, real ConfigServiceForTests, controlled outer engine HTTP/servlet boundaries, JDK 21 | Pass | All 25 action tests execute with zero failures/errors/skips in work/disconnected-action-first.log. Complete HTTP status/type/UTF-8 bytes and JSON bodies are checked for healthy reports, malformed documents/rows, later invalid rows, controls, HTTP failures, response loss, silent timeout, and same/different-origin redirects. Failure cases send exactly one engine GET with the internal header and zero redirect-target requests. Actual TimeUtils values under US/France/Japan survive both fields; locale is restored. work/disconnected-action-evidence/ and work/disconnected-locale.json retain responses, elapsed times, requests and formatter source/class hashes. These are action/HTTP-boundary checks; corrected deployed verification remains pending |
| T28 | 2026-10-01 20:35 UTC | Actual shipped CLI subprocesses and outer management HTTP boundary; standard-library Python | Partial | Initial suites pass all 83 tests: 13 report cases, 56 existing mutation/status cases and 14 listing cases, recorded in work/disconnected-clients-first.log and work/disconnected-listing-first.log. Report checks cover full validation, grouping, filters, literal precedence, actual captured locale text, ASCII output failure, no partial output, argument rejection before requests, malformed/truncated bodies, HTTP 503, one-request connection loss and bounded timeout. work/disconnected-client-evidence/ retains commands, stdout/stderr, durations and requests. Final source/provenance checks remain pending |
| T30 | 2026-10-01 20:45 UTC | Pinned mdBook 0.4.52/admonish 1.20.0 Docker image; current source and generated book | Partial | The image and book build succeed in work/disconnected-book-image.log and work/disconnected-book.log, with only the permitted admonish version warning. All nine unique scripting sample links resolve to matching copied source bytes in work/disconnected-book-copies.json. Actual IOC workflow and verbatim disconnection command-block execution remain pending |
| T1 | 2026-09-25 08:43 UTC | JDK 21.0.12.1, wrapper Maven; step 1 including the tarball WAR item applied on dc3aa1f4 | Pass | ./mvnw -B -ntp clean verify: 782 tests, 0 failures, 0 errors; enforcer and analyze-only clean; BUILD SUCCESS |
| T2 | 2026-09-25 08:43 UTC | T1 output under target/ (aa-20260925-dc3aa1f4) | Pass | The mgmt WAR's install/ holds archappl_sqlite.sql, archappl_mysql.sql and pbutils/ (pb2json.sh, validate.sh, printTimes.sh, repair.sh) and no deployMultipleTomcats.py, which the c953fb07 WAR carried; the tarball holds mgmt.war, engine.war, etl.war and retrieval.war, each byte-identical (cmp) to its aa-20260925-dc3aa1f4-<component>.war, plus LICENSE, RELEASE_NOTES, LICENCES/, the four tomcat-log4j jars and the two install_scripts *.sql files, with no quickstart.sh or sample_site_specific_content |
| T3 | 2026-09-25 15:47 UTC | Docker, pinned mdBook 0.4.52 and mdbook-admonish 1.20.0; rewritten book, working tree | Pass | Exit 0; the only Warning line is the mdbook-admonish 0.4.51 notice. A link check of every relative link and anchor against the built HTML found no problem |
| T4 | 2026-09-25 15:49 UTC | Working tree after step 3 | Pass | git grep for the listed strings, with the two exclusions, and grep over the new untracked pages under docs/book/src returned no match (exit 1) |
| T5 | 2026-09-30 08:08 UTC, recorded operation subsets | Roll-up of executed direct-appliance checks below | Partial | Archive/status, pause/resume, rename and ordinary deletion data modes pass under T11, T14, T17/T21 and T22. T26 reproduces an actual hidden deletion failure requiring separate M35 correction and unchanged regression acceptance. Disconnection reporting remains pending; legacy sample observations do not satisfy these acceptance tests |
| T6 | 2026-09-25 15:47 UTC | Working tree after step 3 | Pass | LC_ALL=C grep -rnP '[^\x00-\x7F]' docs/book/src --include='*.md' returned no match |
| T7 | 2026-09-29 01:59 UTC | listArchivedPVs.py; four 50e7382a WARs; Tomcat 9.0.122; real softIocPVX and unchanged UnitTestPVs.db; Python 3.13 in a standard-library-only venv; CA port 17675 | Pass | All 600 requested PVs reached Being archived. Default and explicit -1 returned 600 sorted unique names; the unqualified API returned 500. Glob returned the expected 10 names, no match returned empty/exit 0, limits 1/17/500/700 returned 1/17/500/600 names, and glob plus limit returned 5. The 13 live checks, including actual HTTP 404 and verbatim documentation commands, passed. Recheck with src/test/pythontests/verify_list_archived_pvs.py per TESTING.md. Local evidence: work/m17-list-pvs-review-fixes/results.json, manifest.json, http.jsonl and cleanup.json; launcher exit 143, no owned JVM, IOC exit 0 |
| T8 | 2026-09-30 08:08 UTC, recorded operation subsets | Roll-up of shipped CLI subprocesses, outer HTTP boundary and real appliance/launcher checks | Partial | Listing's 14 CLI tests and real launcher-death regression pass: the latter records runner exit 1, fallback TERM to its four owned JVMs, no forced kills and no survivors in work/listing-cleanup-p5rzrw7o/observation.json. Earlier failing CLI/cleanup evidence remains in work/listing-cleanup-66vmi5da/observation.json. Archive/status checks pass under T11/T12, pause/resume under T14/T15 and rename under T17/T18/T21, including 56 client tests and both real copying failures. Deletion client and real mixed-batch checks pass under T22/T23, while T26 fails on an actual hidden storage error and requires separately approved correction |
| T9 | 2026-09-30 08:08 UTC, recorded operation subsets | Roll-up of standard-library-only CLI commands, real appliances and pinned book builds | Partial | Listing's three documented commands returned 600, 600 and 17 names and its copied script/links matched. Archive/status documentation passes under T13, pause/resume under T16 and rename under T19. The final rename book build has seven matching affected scripts and seven unique resolved sample links, with only the permitted admonish warning. Deletion documentation passes under T24 with both verbatim workflows and eight matching linked sample copies. Disconnection reporting and final inventory documentation remain pending |
| T10 | 2026-09-29 20:06 UTC (default), 20:24 UTC (integration) | JDK 21; rebuilt four WARs; Tomcat 9.0.122; softIocPVX | Pass | M34 changes server code, including partial-write rollback. Fresh clean verify passes 818 tests; the six selected integration classes pass all eight cases in one run, including the real filter values 0.0, 0.15 and 1.0. M34 / T4-T5 record logs, source/WAR digests and cleanup. The same WARs pass all 58 T14 checks and the 22-check archive/status regression |
| T11 | 2026-09-29 03:51 UTC | Working tree on b11abd53; four 50e7382a WARs; Tomcat 9.0.122; Python 3.13; real softIocPVX and unchanged UnitTestPVs.db; CA port 18675 | Pass | All 22 live checks pass. MONITOR uses 1 second, SCAN uses 2 seconds, and 0.000_1 is normalized and limited by the server to 0.1 second. Repeat requests preserve settings; aliases resolve; overlapping inputs exit 2 without changing configuration. Each real mixed batch exits 1, keeps one result per input, and archives both valid names. Local evidence: work/archive-status-implementation-2/results.json, manifest.json, http.jsonl, CLI stdout/stderr, mgmt console.log and cleanup.json. Launcher exit 143, IOC exit 0, no fallback signals, forced stops or surviving owned JVMs. Recheck with verify_archive_status.py per TESTING.md |
| T12 | 2026-09-29 | Python 3.13, actual CLI subprocesses and local HTTP boundary server | Pass | All 20 archive/status tests pass (14.399 seconds); all 14 existing listing tests pass (8.822 seconds). The numeric-literal regression failed with samplingperiod=1_0 before correction and passes with the Java-compatible 10.0 payload. Tests exercise actual scripts with no internal-function substitution. Recheck both unittest commands in TESTING.md |
| T13 | 2026-09-29 03:49 UTC (book), 03:51 UTC (live commands) | T11 real appliance and standard-library-only venv; pinned mdBook 0.4.52 and mdbook-admonish 1.20.0 | Pass | The scripting page's exact command block returns Being archived, Already submitted and Being archived for the configured alias; T11 retains shell text and stdout/stderr. Book build exits 0 with only the permitted admonish version warning. All four linked Python copies match source bytes, getPVList.py is absent from source/output, and the sample links resolve |
| T14 | 2026-09-29 20:28 UTC | Working tree on 14218555; rebuilt four WARs; Tomcat 9.0.122; real softIocPVX, unchanged UnitTestPVs.db, camonitor -t s and Java PB adapter | Pass | All 58 checks pass in work/pause-partial-live/. PB and retrieval tuples remain unchanged before resume during 26.307 seconds; IOC and control each produce 27 updates. The resumed current value is 28, with IOC timestamp 20:28:18.322811227Z before the request at 2026-09-29T20:28:18.331810045Z; it matches the real monitor within 227 ns and persists exactly in PB. Baseline and three samples timestamped after command completion persist exactly. Alias/.VAL, overlap, repeated and unknown rejections, mixed batches in all positions and verbatim documentation commands pass. Cleanup: launcher 143, IOC 0, monitor -15, no fallback signals or surviving owned JVMs. Manifest, HTTP/CLI output and PB reads retain provenance. Earlier observations remain below |
| T15 | 2026-09-29 19:51 UTC (clients), 20:28 UTC (pause/resume), 20:36 UTC (archive/status) | Python 3.13; actual CLI subprocesses and controlled outer HTTP boundary; JDK 21; final WARs | Pass | All 43 client tests pass: 9 pause/resume, 20 archive/status and 14 listing cases in work/pause-partial-pause_resume_clients.log, work/pause-partial-archive_status_clients.log and work/pause-partial-list_archived_pvs.log. The earlier repeated-prefix regression failure remains in work/pause-prefix-before.log. The real Java canonical-name comparison passes in T14. All 22 live archive/status checks pass in work/pause-partial-archive/, with launcher exit 143, IOC exit 0 and no fallback signals or surviving owned JVMs |
| T16 | 2026-09-29 19:54 UTC (book), 20:28 UTC (live commands) | Pinned mdBook 0.4.52/admonish 1.20.0; source and built samples; final T14 appliance | Pass | Book build passes with only the permitted version warning; six sample copies match source bytes and all nine sample links resolve. The new partial-write behavior is present in the generated page. The documented pause/status/resume/status commands return Pause accepted, Paused, Resume accepted and Being archived. work/pause-partial-book.log and work/pause-partial-live/documented-commands.stdout retain evidence |
| T10 | 2026-09-30 03:34 UTC | Rename scope; current working diff and recorded production/configuration digests | Not applicable | The inspected diff under src/main, src/resources, src/sitespecific, scripts and pom.xml is empty. No production code or build/runtime configuration changed. work/rename-bundle-final/manifest.json pins 610 production/resource/configuration files and unchanged UnitTestPVs.db to the successful package build. Java and Python use its same four WARs |
| T17 | 2026-09-30 03:50 UTC | Python 3.13, JDK 21, Tomcat 9.0.122, SQLite; unchanged softIocPVX fixture; explicit aa-20260930-29447c39 bundle | Pass | All 132 checks pass in work/rename-live-5/. Both paused names, copied settings and exact timestamp/value/status/severity multisets pass through real retrieval and per-file PVSampleDump. All-success, alias/.VAL, overlap rejection and occupied/unpaused/unknown failures in each batch position pass. All 66 retained PB files are inspected after shutdown. Launcher exit 143, IOC exit 0, no fallback signals or surviving owned JVMs; commands, responses, reader results, dependency and deployed-WAR digests are retained |
| T18 | 2026-09-30 03:26 UTC (clients), 03:58 UTC (archive/status), 04:01 UTC (pause/resume) | Actual CLI subprocesses, two controlled outer HTTP boundary servers; same final four-WAR bundle and unchanged IOC fixture | Pass | All 56 client tests pass: 42 archive/status, pause/resume and rename tests in work/rename-client-final-external.log, and 14 listing tests in work/rename-listing-final.log. The 40 mutation-redirect cases retain 220 actual requests with zero redirect-target requests under work/rename-client-evidence/. All 22 live archive/status checks pass in work/rename-archive-regression/ and all 58 pause/resume checks pass in work/rename-pause-regression/, including real Java canonical-name comparison, actual IOC monitor, exact PB persistence and verbatim documented commands. Both manifests pin the same four WARs. Both launchers exit 143, both IOCs exit 0, the pause monitor exits -15, with no fallback signals or surviving owned JVMs |
| T19 | 2026-09-30 03:45 UTC (book), 03:50 UTC (live commands) | Final scripting page, real T17 appliance; pinned mdBook 0.4.52 and admonish 1.20.0 | Pass | The final pause/status/rename/status command block executes verbatim and returns Pause accepted, Paused, Rename accepted and both Paused names. work/rename-live-5/documented-commands.stdout and results.json retain output and exact commands. Book build exits 0 with only the permitted version warning in work/rename-book-final-owner.log. All seven affected Python copies match source bytes and all seven unique sample links resolve (12 occurrences), recorded in work/rename-doc-final.json |
| T20 | 2026-09-30 03:34 UTC | JDK 21; real TomcatSetup/SIOCSetup; explicit bundle directory and aa-20260930-29447c39 basename | Pass | org.epics.archiverappliance.mgmt.RenamePVTest executes one test with zero failures/errors/skips; BUILD SUCCESS in work/rename-java-final.log. It verifies actual rename acknowledgement, both retained Paused configurations, copied fields, unchanged source configuration and exact baseline multisets. All four deployed WAR digests match work/rename-bundle-final/manifest.json, recorded in work/rename-java-final-wars.json. Fixture teardown finishes before Python starts |
| T21 | 2026-09-30 03:50 UTC | Real T17 CLI, RenamePVAction and PB reader; strace attached only to the owned management JVM; destination-specific paths | Pass | The first destination open fails with traced O_WRONLY/EACCES after metadata registration. A successful probe records writes of 8189, 8181, 8175 and 4135 bytes; the second write to a fresh destination then fails with traced injected EIO and a five-second entry delay. The real reader observes 343 copied destination samples before failure. Both batches report Outcome unknown/exit 1, send one request per pair and successfully copy the later independent pair. Checked source/control settings and fixed-interval retrieval/PB records remain exact. Faults are restored in finally; both failed destination files are zero bytes after recovery and their actual reader failures are retained separately. Post-shutdown inspection and normal cleanup pass in work/rename-live-5/ |
| T17 | 2026-09-30 04:40 UTC | Current runner with independent tracer/appliance teardown; unchanged final four-WAR bundle and IOC fixture | Pass | All 132 checks pass again in work/rename-precommit-normal/. Its manifest matches every current client, runner, Java test and reader source digest. Both retained names, copied configuration and exact retrieval/PB multisets pass, including final documented commands. All 66 PB files are decoded after shutdown. Launcher exit 143, IOC exit 0, no fallback signals or surviving owned JVMs |
| T21 | 2026-09-30 04:40 UTC | Real filesystem faults in the current T17 runner | Pass | Both destination-specific faults pass again. The successful probe records writes of 8186, 8177, 8173 and 4034 bytes; the real reader observes 344 copied samples before the second-write EIO. Source/control preservation, uncertain CLI outcome, one request per pair, later-pair copying, fault restoration and post-shutdown reads pass in work/rename-precommit-normal/ |
| T17 | 2026-09-30 04:46 UTC | Additional failure-path teardown check; shipped runner, real appliance/IOC and attached strace, isolated ports | Pass | work/rename-precommit-tracer-timeout-2/ retains an actual SIGSTOP of the owned tracer followed by runner SIGTERM. The real tracer wait expires; cleanup records tracer_forced_stop=true and tracer_exit=-9, then launcher_exit=143, ioc_exit=0 and empty owned-JVM/fallback lists. The runner exits 1 as required for forced cleanup; the outer verification exits 0 in work/rename-cleanup-precommit-2.log. No internal runner function, launcher, IOC fixture or HTTP path is replaced. This negative termination check does not claim completion of the interrupted copying case |
| T23 | 2026-09-30 06:40 UTC and 07:23 UTC | Python 3.13; shipped CLI subprocesses; two controlled outer HTTP boundary servers | Pass | All 70 client tests pass in work/delete-client-first.log: deletion 14 and existing clients 56. After retaining actual commands, inputs, stdout/stderr and request observations, the final deletion suite passes all 14 tests in work/delete-client-final.log; per-test evidence is in work/delete-client-evidence/. Redirects are not followed, mutations are sent once and later independent items continue. No shared client helper changed, so existing live workflows are unaffected |
| T24 | 2026-09-30 07:05 UTC (book), 08:08 UTC (live commands and final run) | Pinned mdBook 0.4.52/admonish 1.20.0 image; source and generated samples; actual T22 appliance | Pass | Both final deletion command blocks execute verbatim and produce Pause accepted, Paused, Delete accepted and Not being archived; each sends one deletion with the correct mode. work/delete-live-third/ retains exact shell text, syscall observations and stdout/stderr. The book builds with exit 0 and only the permitted version warning in work/delete-book-final.log. Docker uses UID 0 for this build because previously generated files are owned by UID 0 inside the container; the initial UID 1000 build failed with permission denied and remains in work/delete-book-first.log. All eight unique linked sample copies match source bytes in work/delete-doc-final.json |
| T25 | 2026-09-30 07:37 UTC | JDK 21; Tomcat 9.0.122; real SIOCSetup/TomcatSetup; unchanged UnitTestPVs.db; CA port 21875; explicit aa-20260930-29447c39 bundle | Pass | DeletePVTest runs two parameterized real-data modes, DeleteMultiplePVTest runs one case and DeletePVAfterRestartTest runs one case: four tests, zero failures/errors/skips, BUILD SUCCESS in work/delete-java-final.log. Actual PB retention/erasure, acknowledgement, alias removal and unchanged control baseline pass in the strengthened test. All twelve deployed WAR hashes match the selected bundle. Fixture ports are free and no matching owned Java/IOC processes survive; work/delete-java-final-evidence.json records report counts, hashes and teardown observations |
| T22 | 2026-09-30 08:08 UTC | Python 3.13, JDK 21, Tomcat 9.0.122, SQLite; real softIocPVX and unchanged UnitTestPVs.db; explicit aa-20260930-29447c39 bundle; CA port 21675 | Pass | Both ordinary deletion modes pass in work/delete-live-third/: nonempty actual STS/MTS/LTS target records, metadata/alias removal, exact retained baselines for false and absent target headers/stream paths for true. Alias/.VAL, all overlap cases and unpaused/unknown/repeated failures first/middle/last in each mode pass with exactly one request per independent item. Retained-folder restarts preserve complete prepared control settings and exact baseline data. All four normal stops exit 143; IOC exits 0, tracer is restored and no owned JVM survives. The current tested CLI/runner/Java/reader source hashes match the manifest. The separate T26 failure prevents overall deletion completion |
| T26 | 2026-09-30 08:08 UTC | Shipped CLI and actual management/ETL/PlainPB path; path-filtered strace on the owned ETL JVM; same real T22 fixture and selected WARs | Fail | The trace proves actual unlink EACCES (INJECTED) for a saved LTS file; ETL logs an AccessDeniedException. Management still returns HTTP 200 with validation empty and status ok, removes the failed target's metadata, and the CLI prints Delete accepted with batch exit 0. All 37 actual baseline tuples survive in the failed target's PB file. Exactly one mutation per item, later healthy target metadata removal and actual PB erasure, paused control settings/data, fault restoration and normal cleanup pass independently. Of 418 checks, 417 pass and filesystem-fault fails; the runner exits 1. work/delete-live-third/ retains results.json, manifests, CLI/HTTP/filesystem traces, component logs, fault-metadata.json and real PB-reader results. Keep this failing-before evidence and unchanged assertions for M35's correction |
| T10 | 2026-09-30 08:09 UTC | Deletion implementation diff and selected bundle provenance | Not applicable | The inspected diff under src/main, src/resources, src/sitespecific, scripts and pom.xml is empty. No production or build/runtime configuration changed; production/resource/configuration digests match the existing successfully built bundle. Any later M35 correction requires fresh WARs and the complete T10 sequence before returning to T22-T26 |
| T10 | 2026-10-01, corrected deletion source and explicit bundle | JDK 21; fresh clean verify; actual Tomcat 9.0.122 and softIocPVX on aa-20261001-6552a9f5 | Pass | M35 / T2 records 853 default tests and 4 selected deletion integration tests, zero failures/errors/skips, fresh per-class reports and all 12 deployed WAR hashes matching the explicit bundle. Java fixtures exit before the fresh CLI appliance starts. M35 / T1, T3 and T6 then pass all 664 complete real-path checks and normal cleanup. work/delete-corrected-evidence.json confirms current production-source hashes still match the 610-source bundle manifest. Landing remains separately authorized |
| T26 | 2026-10-01, corrected complete real appliance run | Shipped CLI, actual management/ETL/PlainPB, unchanged IOC fixture and original fault/assertions plus strict target-preservation and ZIP checks | Pass | work/delete-corrected-live/ passes 664 checks with exit 0. Actual PB unlink and physical ZIP-finalization unlink EACCES are witnessed; failed items report Outcome unknown/exit 1, retain paused configuration/inventory/aliases before stop and after restart, and preserve target data. Independent later deletions, controls, both data modes, original batch/identity/document-command assertions, one request per item and normal cleanup pass. M35 / T1-T6 retain corrected evidence separately from the failing baseline; this verifies the correction without closing M17 or replacing its earlier failure record |

###### Literal ZIP key correction verification

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T10 | 2026-10-01 09:26-09:50 UTC, literal ZIP key follow-up | JDK 21; new complete bundle pinned in work/delete-zip-key-bundle/manifest.json; real Java/IOC/Tomcat fixtures | Pass | Current M35 / T2 executes 857 default tests and 4 integration tests with zero failures/errors/skips, fresh per-class reports and all 12 deployed WAR hashes matching. All 610 current production-source hashes match the bundle. Java teardown precedes the complete 664-check CLI appliance run. work/delete-zip-key-evidence.json records the current source version; earlier 853-test results remain historical. Landing is outstanding |
| T26 | 2026-10-01 09:49 UTC, literal ZIP key follow-up | Shipped CLI and complete management/ETL/PlainPB path; unchanged real IOC and original fault/assertions | Pass | work/delete-zip-key-live/ passes all 664 checks, exit 0. Both actual PB-file and physical ZIP-finalization unlink EACCES faults are witnessed. Failed targets report Outcome unknown/exit 1 and retain paused configuration/inventory/aliases and actual surviving records across restart. Independent later items, controls, both data modes, documented commands and eight normal stops pass; final IOC exit 0, no owned JVM/tracer and no cleanup error. M35 / T1-T7 record the current correction; this does not complete M17 |
| T22 | 2026-10-01 09:38-09:49 UTC; evidence rechecked 16:57 UTC | Current complete four-WAR bundle, shipped CLI/IOC/ETL/PB readers; retained run-folder restarts | Pass | The 664-check work/delete-zip-key-live/results.json includes nonempty actual STS/MTS/LTS baselines, both request modes, stopped-store exact retention/erasure, aliases/.VAL, input overlap, real rejection at each batch position, independent later items and preserved controls. Eight normal stops and retained-folder restarts pass. All current production and recorded client/runner/fixture hashes match the tested manifests |
| T23 | 2026-10-01, executed client results and unchanged-source recheck | Actual CLI subprocesses; controlled outer HTTP boundary only | Pass | work/delete-corrected-clients.log and work/delete-corrected-list-client.log retain 56 plus 14 passing tests. The sample hashes in work/delete-zip-key-evidence.json match current sources. No client/helper source changed after those executions; the corrected 664-check appliance run separately proves conservative storage-fault outcomes, one request per independent item and later-item continuation |
| T24 | 2026-10-01 09:21 UTC book; 09:38-09:49 UTC commands | Current scripting page, real complete appliance/IOC and pinned mdBook/admonish | Pass | retain-documented-commands and erase-documented-commands execute verbatim and pass in the current 664-check results. work/delete-zip-key-mdbook.log records the successful pinned build with only the permitted version warning; all eight linked sample copies match the recorded source hashes |
| T25 | 2026-10-01 09:37-09:38 UTC | Fresh selected WAR bundle, actual Java Tomcat/IOC fixtures and PB readers | Pass | work/delete-zip-key-integration-reports/ and work/delete-zip-key-java-evidence.json establish DeletePVTest 2, DeletePVAfterRestartTest 1 and DeleteMultiplePVTest 1, zero failures/errors/skips, all 12 deployed WAR hashes matching and completed fixture teardown. These are the same WARs used by T22/T26 |
| T5 | 2026-10-01 16:57 UTC, recorded-result roll-up | Prior executed listing/archive/pause/rename paths plus current T22-T26 deletion evidence | Partial | Listing, archive/status, pause/resume, rename and deletion satisfy their accepted operation contracts. M35's landed correction and completed issue #18 close the hidden-deletion dependency. Actual disconnection reporting remains unimplemented and unverified; M17 is not complete |
| T8 | 2026-10-01 16:57 UTC, recorded-result roll-up | Actual client tests, HTTP-boundary checks and real mutation workflows | Partial | All implemented mutation clients, including deletion, satisfy their recorded validation, batch, bounded-timeout and uncertain-outcome checks. The previously failing actual PB fault passes on the correction, including no retry and correct independent-item data effects. Disconnection reporting still needs its own response/error checks |
| T9 | 2026-10-01 16:57 UTC, recorded-result roll-up | Executed documented workflows and pinned book builds | Partial | Listing, archive/status, pause/resume, rename and both deletion workflows have verbatim command evidence. The current deletion book has eight identical linked sample copies. Disconnection reporting and the final supported inventory remain outstanding |

###### Earlier deletion observations

- work/delete-live-first/ prepares real paused baselines and nonempty STS/MTS/LTS target records, then fails the overlap-state assertion because getPVTypeInfo returns paused as the string "true", while the runner compared a Boolean. The actual CLI exits 2 with no mutation. The corrected check requires the real string value, unchanged full configuration and unchanged retrieval baseline. Launcher exit 143, IOC exit 0 and no surviving owned JVMs are recorded in stop-1.json and cleanup.json. This setup failure does not establish T22 or T26 acceptance.
- work/delete-live-second/ passes default-mode CLI, alias/.VAL, overlap, all failure-position batches, verbatim commands and all stopped-store baseline checks. Its retained-folder restart then fails complete control-setting equality because DefaultConfigService.upgradeTypeInfo initializes the previously absent chunkKey. The observed difference is only that key; both stops exit 143, IOC exits 0 and no owned JVM survives. The runner now performs a preparation restart before deletion, checks every previous control field and baseline exactly and checks the initialized key against the real PB path. All later setting comparisons remain complete equality; this interrupted execution does not establish explicit-mode or fault acceptance.
- The first two Java executions were stopped after identifying an IOC record-name prefix exceeding the fixture's supported length and an incorrect PB directory assumption. work/delete-java-first.log and work/delete-java-second.log retain the failures; the two guarded cleanup observations record no survivors. The third execution passes all four tests but uses an occupied default CA port. The final T25 execution selects the free dedicated CA port 21875 and retains independent fixture evidence.

###### Earlier rename observations

- work/rename-live-1/ and work/rename-live-2/ stop during setup at the 120-second sample-count deadline. The fixture requests used a one-second MONITOR period; source data retained by the real engine buffer was insufficient for the intended copy fault. The final runner requests a 0.1-second period and checks real paused PB persistence and a source file exceeding 16 KiB. It does not change the IOC fixture or production configuration.
- work/rename-live-3/ passes 107 checks, then fails the intended destination fault: the test predicted a flat path for a name containing hyphens while actual storage used nested directories. No filesystem fault was exercised. The final destinations use underscores and the real trace proves the affected path.
- work/rename-live-4/ passes 128 checks, including both real filesystem failures and 346 observed copied samples, then fails the verbatim documentation commands because getPVStatus.py does not support --expect. The final page uses its supported arguments and the unchanged runner passes all 132 checks in work/rename-live-5/. Each failed run retains its evidence and normal cleanup: launcher 143, IOC 0, no fallback signals or surviving owned JVMs.

###### Earlier pause/resume observations

- 2026-09-29 16:29 UTC: work/pause-persistence-final-1/ passes baseline PB persistence and three post-resume PB tuples, then fails the unchanged strict pause-gap assertion. The interval is 16:28:39.279479999Z through 16:29:04.283361594Z. One resumed startup sample has value 26, IOC timestamp 16:29:03.686667449Z and cnxregainedepsecs 1790699344; the actual IOC monitor reports that value at the same timestamp to its displayed precision. It is a numeric sample and was not excluded as metadata. The run stops before later control, alias, mixed-batch and documentation checks. Cleanup: launcher 143, IOC 0, monitor -15, no fallback signals or surviving JVMs. The original data-loss failure remains in work/pause-resume-implementation-1/: all three baseline tuples absent at the 120-second deadline (121.114 seconds observed) and after shutdown, with no target header/sample in 11 PB files. The intermediate work/pause-persistence-diagnostic-1/ passes storage/gap checks but fails the invalid -t a monitor option; it is diagnostic only. Recheck using verify_pause_resume.py per TESTING.md
- 2026-09-29 16:44 UTC: work/pause-persistence-final-2/ passes all 58 checks and normal cleanup, but its resume coincides with an IOC update and does not exercise an earlier-timestamped current value. The final runner waits for a fresh real monitor update before resume and requires that case.
- 2026-09-29 16:49 UTC: work/pause-persistence-final-3/ receives the earlier current value but fails the monitor comparison: IOC nanoseconds 641210765 are displayed as 641211 microseconds, a 235 ns rounding difference. The corrected runner allows only the monitor display rounding bound of 500 ns; retrieval/PB tuples still require exact nanoseconds. Cleanup completes normally.

###### Legacy sample observations (not revised-plan acceptance)

Observed 2026-09-28 23:24 to 23:26 UTC against commit 50e7382a1a3bab64c2f44b6dcf6aa34b01116780. The current build, `./mvnw -B -ntp clean package`, passed 805 tests with zero failures, errors or skips. The launcher started all four resulting WARs with SQLite and the existing Tomcat distribution. The IOC loaded the shipped `src/resources/test/UnitTestPVs.db` without changes. Eight PVs reached Being archived, and retrieval returned three real samples before candidate execution.

Evidence is retained locally in `work/m17-t5-20260928T232239Z/`: `results.json` records exact commands, exit codes and observations; each case has stdout and stderr; `sample-http.jsonl` contains actual sample requests and appliance responses; `setup-http.jsonl` contains setup and independent state checks; `smtp.json` contains three locally received messages. Recheck with `python3 work/m17-t5-verify.py`; the harness and build log (`work/m17-t5-build.log`) are ignored verification artifacts. All 24 source-file SHA-256 values matched before and after execution. The launcher exited 143 after SIGTERM, and no verification Tomcat or IOC process remained.

An HTTP forwarding proxy recorded traffic and sent requests to the real local appliance without changing paths, bodies or responses. It also redirected getPVList.py's fixed SLAC hostname locally; that observation does not verify direct local execution. SMTP used a local receiver with no TLS or authentication; no external mail was sent. Pass below means exit 0 plus the stated real response or state observation, not exhaustive branch coverage. Two scripts had both empty and nonempty type-report cases, giving 25 CLI executions in total.

| Candidate | Result | Observed behavior or limit |
| --- | --- | --- |
| abortNeverConnectedPVs.py | Pass | Aborted a real request for a nonexistent PV; it disappeared from getNeverConnectedPVs |
| addPostProcessingOperator.py | Pass | The paused PV's LTS configuration gained pp=mean_3600 |
| archiveFromDB.py | Blocked | Exit 1 before HTTP: libdbStaticHost.so is absent from the installed EPICS Base 7.0.10 environment |
| archivedPVsNotInList.py | Pass | Reported archived PVs absent from the supplied list |
| changeArchiveStore.py | Pass | The paused PV's dataStores contained the requested LTS_TEST name |
| checkConnectedPVs.py | Pass | Read the live connection report; a threshold of -1 exercised local email delivery |
| checkForEngineActivity.py | Pass | Detected actual STS PB file growth during a 70-second interval; this candidate uses the filesystem, not BPL |
| checkTypeChangedPVs.py | Pass | Empty report produced no alert; a real configured-type mismatch produced a local email naming the PV |
| consolidateArchivedData.py | Pass | Pause, consolidate into MTS and resume returned successful responses; PV returned to Being archived |
| consolidatePausedPVs.py | Pass | Listed the paused PV and received successful consolidation into MTS |
| deletePVList.py | Pass | Successful delete response and absence of the renamed PV from getAllPVs |
| emailHandler.py | Pass | Imported and executed by checkConnectedPVs.py, storageSizeCheck.py and checkTypeChangedPVs.py; three messages received locally |
| getPVList.py | Does not support direct local execution | Proxy-assisted exit 0 is diagnostic only; the source fixes the appliance URL to SLAC and accepts no local URL argument |
| listTypeChanges.py | Pass | Empty report and nonempty report both succeeded; the latter printed DBR_SCALAR_FLOAT and DBR_SCALAR_DOUBLE |
| pausePVList.py | Pass | Independent getPVStatus returned Paused |
| pingCurrentlyDisconnectedPVs.py | Blocked | Exit 1 before HTTP: ModuleNotFoundError for epics in system Python |
| printCurrentlyDisconnectedPVs.py | Pass | Reported actual disconnected PVs after the IOC stopped |
| removeMetaFields.py | Pass | Independent getPVTypeInfo showed archiveFields changed from six fields to an empty list |
| renamePVList.py | Pass | Successful rename response and getPVTypeInfo for the new name |
| resumePVList.py | Pass | Independent getPVStatus returned Being archived |
| resumePausedPVsMatchingPattern.py | Pass | Matched a paused PV and returned it to Being archived |
| stopArchivingCurrentlyDisconnectedPVs.py | Pass | The live report had one PV with lastKnownEvent Never; the script paused and deleted it, while preserving PVs with timestamps; getAllPVs confirmed both outcomes |
| storageSizeCheck.py | Pass | Read actual storage rates and sent a local email with a threshold of -1 GB/year |
| unarchivedPVs.py | Pass | Reported only the nonexistent PV from a mixed input list |

The type-report cases changed a paused PV's configured DBRType through putPVTypeInfo and resumed it while the real IOC continued publishing doubles. This exercised the real engine's mismatch reporting; it did not change the IOC record type or substitute report fixtures. After IOC shutdown, that resumed mismatched channel appeared with lastKnownEvent Never and exercised the deletion branch of stopArchivingCurrentlyDisconnectedPVs.py.

The two dependency failures do not establish defects in their unexecuted BPL paths. getPVList.py's local URL portability is also unresolved. No sample source was modified or removed. These observations inform the operation-based implementation above; they are not a keep/cut decision or acceptance of the revised examples.

##### Closure Evidence

- Step 1 landed 2026-09-25 09:23 UTC: commits 4aebc724 (release tarball WARs), 39d92baa (removed samples, slacdev and quickstart page with the page edits) and 6b34d0a3 (this plan and its checks) are ancestors of the fetched origin/modernize (6b34d0a3); the Maven workflow run 36118161053 and the Pages run 36118161044 on 6b34d0a3 succeeded.
- Step 3 landed 2026-09-25 16:23 UTC: commits 587907c8 (interim page edits), 37c9aadc (the rewritten book) and d3456ba1 (this plan's checks and M23) are ancestors of the fetched origin/modernize (d3456ba1); the Maven workflow run 36160480069 and the Pages run 36160480080 on d3456ba1 succeeded, and the published architecture page answers HTTP 200.
- Pause/resume landed 2026-09-29: server commit 759337d5 and CLI/test/documentation commit fbc32120 are on the fetched origin/modernize at fbc32120b83f4999f0d7f4408e3719abf8dac8bd. At 22:25 UTC, fetch and diff against origin/modernize confirmed all changed implementation, test and documentation paths match. The [Maven workflow](https://github.com/jeonghanlee/epicsarchiverap-maven/actions/runs/36630658575) completed successfully at 21:21 UTC, including the JDK 21 build, test and dependency-check step; [Pages](https://github.com/jeonghanlee/epicsarchiverap-maven/actions/runs/36630658665) completed successfully at 21:03 UTC. The remaining operation scopes keep M17 In progress.
- Rename landed as 6552a9f51b25ee2f99985f2ddabe62a8b9b2a9a5. On 2026-09-30 at 05:42 UTC, `git ls-remote origin refs/heads/modernize` confirms that exact remote tip; local HEAD and origin/modernize match it. T17-T21 retain the 132-check current-runner result, 56 client tests, Java integration test, 22 archive/status and 58 pause/resume regression checks, final documentation and actual tracer-timeout cleanup evidence. The [Maven workflow](https://github.com/jeonghanlee/epicsarchiverap-maven/actions/runs/36671274755) completed successfully at 05:17:48 UTC and [Pages](https://github.com/jeonghanlee/epicsarchiverap-maven/actions/runs/36671274832) at 04:59:08 UTC on that commit. These CI observations do not replace the recorded local real-path checks.
- Deletion completed on 2026-10-01: CLI, tests, documentation and the separately authorized M35 production correction landed as 48c0a692b60547969819ccf469bb6343215c60aa. At 16:57 UTC, `git ls-remote --exit-code origin refs/heads/modernize` confirms that commit; 610 current production-source hashes match the tested bundle and all 664 recorded real-appliance checks pass. T22-T26/T10 and M35 / T1-T7 establish the accepted deletion criteria, including 857 default tests, four Java integration executions, unchanged client results, both actual filesystem faults and normal cleanup. Issue #18 closed as completed at 16:47:15 UTC; API readback confirms the reconciled body with ten checked criteria and the exact closure comment. M35 is Complete. Disconnection reporting, final inventory and issue #6's body update remain; M17 stays In progress.
- Disconnection implementation and local verification completed on 2026-10-01; evidence rechecked 2026-10-01 21:58 UTC. T10 records 882 default tests and two selected Java integration tests; T27 records actual failing original HTTP/CLI assertions and passing corrected failures with verified restoration; T28 records 84 clients; T29 records 26 real IOC checks; T30 records verbatim commands and nine matching book samples. work/disconnected-final-evidence.json pins the current sources and explicit four-WAR bundle. The nine authored implementation/test/documentation paths landed in c4516e76765733a3f0d4426bf41a3a5c1e9c71d8. Local HEAD and origin/modernize match; at 2026-10-02 00:04 UTC, `git ls-remote --heads origin refs/heads/modernize` independently confirms that exact remote tip. The source and verification-log digests were checked against the final evidence before issue preparation; no verification rerun is claimed by this documentation update. Final inventory acceptance remains; M17 stays In progress.
- The server dependency #17 closed as completed on 2026-09-29 at 22:31:30 UTC. Issue #6's earlier rename body was updated at 2026-09-30T05:32:33Z with five checked and four unchecked criteria. Its latest body update at 2026-10-01T23:46:54Z includes the landed deletion and disconnection implementations and results. Readback confirms an exact match to work/issue-docs-disconnection-body.md (SHA-256 9b53bcc3ffdcba6cd93e465f28621948c9fb495eac8959ed243b5cfebf8067a7), unchanged title/documentation label/assignee/no milestone and OPEN state. Eight criteria are checked; only final supported-operation inventory acceptance remains unchecked. The server dependencies #17 and #18 remain closed; M17 remains In progress.
- Inventory research completed on 2026-10-02 under T31. The full current function map and compatibility constraints are now preserved in this canonical detail. The earlier core implementation and runtime results remain valid evidence for those Python commands; they do not establish Bash replacement behavior. Final support selection, an accepted amendment, applicable implementation and T9 verification still determine completion. M17 and issue #6 remain open work.
- Final inventory decided on 2026-10-02 after that research: the classification is recorded in Dependencies And Decisions and script modernization moved to M37. T9 passed on 2026-10-02 with the corrected scripting page. Publication of that correction and issue #6 reconciliation and closure determine completion.
- Final inventory landed on 2026-10-02: the scripting page correction is ed2ff67680c422edb3f731b5ca8b96f6be9e4482 and the inventory record 3229d61643561195b4c84d147a383f578a5be0d9. Directly after the push at 19:04 UTC, fetch showed local HEAD and origin/modernize both at 3229d616, and `git ls-remote --exit-code origin refs/heads/modernize` returned the same commit. On 3229d616 the Maven workflow run 37051696493 and the Pages run 37051696504 succeeded, and the published scripting page carries the corrected section. T5, T8 and T9 pass on the final tree.
- Linked issue #6: body reconciled with this detail, all nine acceptance criteria checked, and closed as completed on 2026-10-02 at 19:57:49 UTC with a [closure comment](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/6#issuecomment-5960384928). M17 is Complete.
- The closure record landed as 6ae206d1eac17a81d49f31d44c638b204541c9e2. On 2026-10-02 at 20:27 UTC, directly after the push, fetch showed local HEAD and origin/modernize both at that commit, and `git ls-remote --exit-code origin refs/heads/modernize` returned it. Its Maven workflow run 37060653191 succeeded at 20:58 UTC. The commit changes only this register, and no Pages run started for it.

##### GitHub Projection

Title: Modernize the narrative docs for the single-instance fork
Labels: documentation
GitHub Milestone: none
Observed State: closed
Observed Labels: documentation
Observed Milestone: none
Last Compared: 2026-10-02 19:58 UTC; `gh api repos/jeonghanlee/epicsarchiverap-maven/issues/6` confirms state closed with state_reason completed, closed_at 2026-10-02T19:57:49Z, the title above, documentation label, no milestone and assignee jeonghanlee. All nine criteria are checked. Readback of the body exactly matches `work/issue-docs-inventory-close-body.md` and the closure comment matches `work/issue-docs-inventory-close.md`.

#### M7 - Site-required features and fixes

Origin: daff1b7 / M7
Identity History: none
GitHub Issue: #2
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

Title: Implement the site-required features and fixes
Labels: enhancement
GitHub Milestone: none
Observed State: open
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-09-25 (gh issue view 2 --repo jeonghanlee/epicsarchiverap-maven --json state,labels,milestone)

#### M10 - Ant removal: final Maven-only consolidation

Origin: daff1b7 / M10
Identity History: none
GitHub Issue: #3
Status: Deferred

##### Summary

Remove the Ant build file and rehome the two remaining maven-antrun-plugin executions onto native Maven plugins. Deferred per D7, as the final move to a Maven-only build once the other build work is complete; D7's "run last in Phase 1" no longer applies since the row moved to Phase 2 (see Dependencies And Decisions). Upstream still carries the same build.xml and sitespecific hook (verified 2026-09-11), so no upstream solution exists to borrow.

##### Scope

Delete build.xml. Replace the two antrun executions create-version-txt and sitespecificantscript with Maven-plugin equivalents.

Out of scope: exec-maven-plugin steps that are not antrun.

##### Completion Criteria

- No maven-antrun-plugin execution remains and build.xml is deleted, with the two tasks still performed during the Maven build.

##### Dependencies And Decisions

- D7: deferred to run last in Phase 1, after the other build work completes.
- 2026-09-19: moved to backlog in the Phase 1 closeout; "run last in Phase 1" is superseded, and M10 is now unassigned backlog work.
- 2026-09-22: moved into Phase 2 with the rest of the backlog; remains Deferred under D7 until a new dated decision returns it to Not started.
- 2026-09-25: three of the original five antrun executions are gone: create-api-docs-directory and check-mappings-file-before-javadoc were removed by 2debb17f (M16), download-unpack-and-stage-svg-viewer by a30d8cd3 (M14). The pom now holds create-version-txt and sitespecificantscript.
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
| T1 | Integration | ./mvnw -B clean package | JDK 21, wrapper Maven | Build produces the same outputs from both former antrun tasks without antrun |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, wrapper Maven | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Remove the Ant build and rehome its antrun executions
Labels: enhancement
GitHub Milestone: none
Observed State: open
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-09-25 (gh issue view 3 --repo jeonghanlee/epicsarchiverap-maven --json state,labels,milestone)

#### M18 - Appliance logging model: journald-first log4j2 layout and lifecycle

Origin: daff1b7 / M18
Identity History: none
GitHub Issue: none
Status: Complete

##### Summary

The appliance's four Tomcat JVMs today write three file streams each: catalina.out (the application log4j2 output and process stdout together), the Tomcat JULI dated files, and the access log; catalina.out grows without bound. D31 moves collection and rotation to journald. This row delivers the aa-maven half: the one shipped log4j2.xml and the documentation of the operating model. The aa-env half (unit type, launcher, JULI configuration, access-log bound) is aa-env register work.

##### Scope

- src/resources/main/log4j2.xml (site-independent, on every WAR's classpath; moved from src/sitespecific/default/classpathfiles on 2026-09-24): a Console PatternLayout that emits the journald priority prefix (FATAL <2>, ERROR <3>, WARN <4>, INFO <6>, DEBUG and TRACE <7>), level, logger and thread, with no in-line timestamp; Root level ${env:ARCHAPPL_ROOT_LOGGER_LEVEL:-INFO}; the named loggers operators tune; a commented RollingFile fallback bounded by SizeBasedTriggeringPolicy 50 MB, DefaultRolloverStrategy max=10 and gzip; monitorInterval="30", so a site copy pointed to by LOG4J_CONFIGURATION_FILE is reread without a restart.
- An operating-model page in docs/book/src/sysadmin: the stream inventory and the bound on each stream, filtering by identifier and priority, the fallback, and the known limit that a multi-line stack trace spans several journal entries.
- docs/book/src/faq.md lines 48 and 146 (arch.log) and the install-guide logging sample corrected to the model.

Out of scope: the aa-env unit, launcher, logging.properties and access-log changes; journald host settings (LAB-ansible-provision); runtime log-level control (a separate request, not yet a row).

##### Completion Criteria

- The shipped log4j2.xml produces lines whose priority journald records correctly, the root level follows ARCHAPPL_ROOT_LOGGER_LEVEL with INFO as the default, the fallback is present and commented out, and the documentation matches the shipped configuration.

##### Dependencies And Decisions

- D31 (2026-09-23): the model and the ownership split. Owner decisions (2026-09-23): root level INFO through ${env:ARCHAPPL_ROOT_LOGGER_LEVEL:-INFO}; fallback caps 50 MB x 10 with gzip.
- Coordination with aa-env (2026-09-23): aa-env enables systemd-cat --level-prefix=true in its first logging item, so Tomcat JULI lines map to a journal priority at once and application lines take the default priority 6 until this layout lands. aa-env's second item (drop its site log4j2.xml, export ARCHAPPL_ROOT_LOGGER_LEVEL) is gated on this row's layout commit (aa-env G14). The commit hash is sent to aa-env when it lands.
- G3 (2026-09-24): the operating-model page describes a layout that exists only after aa-env's two logging items land, so M18 closes on observing it: aa-env's second logging item checks, on a deployed host with a WAR at or after this row's layout commit, each archappl-<component> identifier's ERROR and INFO lines at PRIORITY 3 and 6 and reports the result here. This row is Blocked on G3; resume as In progress.
- Observation (2026-09-24, verified here against Tomcat 9.0.121's tomcat-juli.jar): org.apache.juli.SystemdFormatter, which aa-env's logging.properties names, does not exist; the jar ships JdkLoggerFormatter, JsonFormatter, OneLineFormatter and VerbatimFormatter only, so Tomcat's own lines carry no priority prefix and arrive at priority 6. The page states this. Recheck: unzip -l $CATALINA_HOME/bin/tomcat-juli.jar.
- Logger-name fix (2026-09-24): ArchServletContextListener built its config logger from the Class object ("config." + ArchServletContextListener.class), so its lines were named "config.class org.epics...". It now uses getName(), like the other 13 config.* loggers. The config logger level listed on the operating-model page already covered it, because the name still started with "config.". Observed 2026-09-24 21:20 UTC on the four real WARs (Tomcat 9.0.121, systemd-cat): the lines read config.org.epics.archiverappliance.config.ArchServletContextListener, and no line kept the old form.
- Site-build packaging fix (2026-09-24, aa-env G16): the file lived only in src/sitespecific/default/classpathfiles, and each WAR takes the classpathfiles of the selected site only, so a site build (aa-env builds ARCHAPPL_SITEID=als) shipped no log4j2.xml and log4j2 ran unconfigured; T1 had checked the default site only. aa-env's own site file had hidden this until its M34 removed it. The file now lives in src/resources/main, declared as the build's main resource directory, and carries monitorInterval="30" (aa-env direction (a), its owner's decision 2026-09-24). Reproduced and fixed with a file-only site like aa-env's (M18 / T4).

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner accepted 2026-09-24; T2 revision accepted 2026-09-24
Implementation Authorization: owner authorized 2026-09-24, including the T2 revision
Superseded Plan Artifacts: T2 with the mgmt WAR alone (superseded 2026-09-24: BasicDispatcher refuses every BPL action until all four components report started, so the WARN and ERROR requests never reach their actions)

1. Rewrite the default site log4j2.xml as scoped above; build the WARs and confirm the file ships in each WAR's classpath. Closes with T1.
2. Run the four WARs in one Tomcat base under systemd-cat --level-prefix=true and read the journal: priorities map per level, the root level follows the variable, and the fallback enabled once caps and rotates. Closes with T2.
3. Write the operating-model page and correct faq.md and the install-guide sample; mdbook build. Closes with T3.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Static | ./mvnw -B clean package -DskipTests; unzip -p each WAR's log4j2.xml and compare with the source | JDK 21, wrapper Maven | The four WARs carry the new log4j2.xml |
| T2 | Integration | Start the four real WARs in one Tomcat 9 base under a one-appliance appliances.xml, and wait until mgmt reports all components started (ARCHAPPL_APPLIANCES, ARCHAPPL_MYIDENTITY), with stdout piped to systemd-cat --identifier=archappl-test --level-prefix=true; produce INFO lines from startup, a WARN line from mgmt/bpl/getPVTypeInfo for an unknown PV (GetPVTypeInfo.java line 48, Cannot find typeinfo) and an ERROR line from mgmt/bpl/modifyMetaFields for an unknown PV with any command value (ModifyMetaFieldsAction.java line 55, Cannot find typeinfo for pv; route registered at mgmt BPLServlet.java line 154); journalctl -t archappl-test -p err and -o verbose; repeat with ARCHAPPL_ROOT_LOGGER_LEVEL=WARN; enable the fallback with a small size cap | JDK 21, Tomcat 9, systemd journald | -p err shows only ERROR lines; PRIORITY matches each level; WARN hides INFO; the fallback rolls at the cap and keeps at most the configured file count |
| T3 | Review | Second-person pass on the operating-model page, faq.md and the install-guide sample; mdbook build | docs/book Docker build | A cold reader can find and filter each component's log and knows each stream's bound; the book builds with no broken links |
| T4 | Static | Package with a file-only site (appliances.xml, archappl.properties and policies.py in classpathfiles, no log4j2.xml) via -Darchapplsite and -Dsitespecific.path; unzip each WAR's WEB-INF/classes/log4j2.xml | JDK 21, wrapper Maven | All four WARs carry the file, identical to src/resources/main/log4j2.xml and with monitorInterval="30"; the same build of the previous tree ships none |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-24 08:50 UTC | JDK 21.0.12.1, wrapper Maven, working tree on d82ffac5 with the new log4j2.xml | Pass | ./mvnw -B clean package -DskipTests exit 0; aa-20260924-d82ffac5-{mgmt,engine,etl,retrieval}.war each carry exactly one WEB-INF/classes/log4j2.xml, byte-identical to src/sitespecific/default/classpathfiles/log4j2.xml (cmp) |
| T2 | 2026-09-24 08:57-09:01 UTC | Debian 13 host, systemd 257, JDK 21.0.12.1, Tomcat 9.0.121; the four real WARs in one CATALINA_BASE with a one-appliance appliances.xml and InMemoryPersistence; catalina.sh run piped to systemd-cat --identifier=archappl-m18-<run> --level-prefix=true | Pass | Default run: journal PRIORITY 3 for all 10 ERROR lines, 4 for all 32 WARN, 6 for all 253 INFO, no message kept a leading <N>; getPVTypeInfo for an unknown PV logged WARN Cannot find typeinfo at PRIORITY 4 and modifyMetaFields logged ERROR Cannot find typeinfo for pv at PRIORITY 3; journalctl -p err returned only the 10 ERROR lines. ARCHAPPL_ROOT_LOGGER_LEVEL=WARN run: zero INFO lines, the same WARN and ERROR lines. Fallback (mgmt WAR, LOG4J_CONFIGURATION_FILE pointing at a copy of the shipped file with the RollingFile block uncommented, size 20 KB, max 3): archappl.log rolled at about 20.5 KB to archappl-1..3.log.gz and older archives were deleted, so at most three archives remained while stdout kept flowing to the journal. Tomcat's own JULI lines and stack-trace continuation lines arrive at the default PRIORITY 6 |
| T3 | 2026-09-24 17:00 UTC | docs/book Docker build (mdBook 0.4.52) | Pass | Second-person passes on sysadmin/logging.md, faq.md and installguide.md converged after the applied findings (a target-layout note stating that the page applies once aa-env runs the JVMs in the foreground and stops shipping its own log4j2.xml, with today's catalina.out and dated JULI files; the unit name; host-owned retention; the access-log bound as aa-env's setting; Tomcat's own lines at priority 6 because no Tomcat 9 formatter emits a prefix; the qualified catalina.out sentence); mdbook build exit 0; sysadmin/logging.html is generated and the faq.md and installguide.md links resolve to it |
| T4 | 2026-09-24 23:10-23:37 UTC | JDK 21.0.12.1, wrapper Maven, offline; a site with only appliances.xml, archappl.properties and policies.py in classpathfiles, selected with -Darchapplsite and -Dsitespecific.path | Pass | With the file in src/resources/main, all four WARs carry WEB-INF/classes/log4j2.xml, byte-identical to the source and with monitorInterval="30"; the default site build does too. The same site build of be070db5, before the move, ships no log4j2.xml in any WAR. A clean verify of be070db5 plus only this change passed: 778 tests, 0 failures, enforcer and analyze-only clean. monitorInterval reread (23:38-23:40 UTC, mgmt WAR from the working tree, Tomcat 9.0.121, systemd-cat, LOG4J_CONFIGURATION_FILE pointing at a copy of the file): before the edit requests logged 6 WARN and 8 ERROR lines; after the copy's root level was edited to ERROR and 40 s passed, the same requests logged 0 WARN and 21 ERROR lines, with no restart |

##### Closure Evidence

- Landed and closed 2026-09-25: the layout in a1155ef0, the site-independent location with monitorInterval in 67be91d7 and the logger-name fix in d838a548 are ancestors of the fetched origin/modernize; the Maven workflow run 36087147476 on 3070c518, which contains them, succeeded; T1 to T4 passed; G3 is Complete.

#### M19 - Tomcat log4j jar set from the build

Origin: daff1b7 / M19
Identity History: none
GitHub Issue: none
Status: Complete

##### Summary

Tomcat's own log lines and java.util.logging lines (the CA client's beacon warnings among them) pass through JULI, and no Tomcat 9 formatter emits a priority prefix, so they reach the journal at priority 6 and journalctl -p cannot filter them. aa-env routes them through log4j2 (its D25): log4j-appserver replaces Tomcat's internal log and log4j-jul becomes the java.util.logging manager. This row makes the aa-maven build emit those jars at the WARs' own log4j version, so the two log4j copies in one JVM always match (aa-env gate G15).

##### Scope

- pom.xml: a maven-dependency-plugin copy execution at package that writes log4j-api, log4j-core, log4j-appserver and log4j-jul at ${log4j.version} to target/tomcat-log4j, without declaring them as project dependencies.
- src/assembly/release.xml: the release tarball carries the jars under tomcat-log4j/.
- docs/book/src/sysadmin/logging.md: Tomcat's own lines and java.util.logging lines described as passing through log4j2 once aa-env installs the jars.

Out of scope: installing the jars, setenv.sh, LOGGING_MANAGER and log4j2-tomcat.xml (aa-env M35).

##### Completion Criteria

- A clean build writes exactly the four jars at ${log4j.version} to target/tomcat-log4j and into the tarball's tomcat-log4j/, the verify gates still pass, the jars route Tomcat and java.util.logging lines through log4j2 on a real Tomcat 9, and the page matches.

##### Dependencies And Decisions

- D32 (2026-09-24). Owner decisions (2026-09-24): accept aa-env's request as this row; include the jars in the release tarball; ask aa-env to cover, in its M35 check, java.util.logging lines raised inside a WAR (the CA client in engine), which the JVM-wide log4j-jul manager formats with log4j2-tomcat.xml rather than the WAR's log4j2.xml; update the logging page in this row.
- The WARs carry log4j-jul, but no WAR code sets java.util.logging.manager (verified 2026-09-24 by grep over src/main, src/resources and pom.xml), so the JVM-level manager from the Tomcat CLASSPATH is the only one active.
- The commit hash and the output directory name are reported to aa-env for its G15.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner accepted 2026-09-24
Implementation Authorization: owner authorized 2026-09-24
Superseded Plan Artifacts: none

1. Add the copy execution to pom.xml and the fileSet to release.xml. Closes with T1.
2. On a real Tomcat 9.0.121 with the four jars on CLASSPATH, LOGGING_MANAGER set to the log4j-jul LogManager and a log4j2-tomcat.xml carrying the M18 pattern, start the four WARs under systemd-cat and read the journal. Closes with T2.
3. Update logging.md; mdbook build. Closes with T3.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Static | ./mvnw -B clean verify -DskipTests; list target/tomcat-log4j and the tarball's tomcat-log4j/ | JDK 21, wrapper Maven | Exactly log4j-api, log4j-core, log4j-appserver and log4j-jul, each at ${log4j.version}; enforcer and analyze-only pass |
| T2 | Integration | Tomcat 9.0.121 with the T1 jars on CLASSPATH, -Djava.util.logging.manager=org.apache.logging.log4j.jul.LogManager and a log4j2-tomcat.xml with the M18 pattern; the four WARs; catalina.sh run piped to systemd-cat --level-prefix=true; journalctl -o json | Tomcat startup lines carry a priority from the <N> prefix instead of arriving unprefixed; no leading <N> remains in MESSAGE |
| T3 | Review | Second-person pass on logging.md; mdbook build | docs/book Docker build | The page states how Tomcat and java.util.logging lines reach the journal; the book builds |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-24 19:11 UTC | JDK 21.0.12.1, wrapper Maven, working tree on 6e4f1cbc | Pass | ./mvnw -B clean verify -DskipTests: BUILD SUCCESS with copy-tomcat-log4j run at package, DependencyConvergence, RequireUpperBoundDeps and BanDuplicateClasses passed and analyze-only clean; target/tomcat-log4j and the tarball's tomcat-log4j/ each hold exactly log4j-api, log4j-core, log4j-appserver and log4j-jul at 2.26.1, the pom's log4j.version |
| T2 | 2026-09-24 19:11-19:13 UTC | Debian 13 host, systemd 257, JDK 21.0.12.1, Tomcat 9.0.121; the four real WARs in one CATALINA_BASE whose bin/setenv.sh puts the T1 jars and a directory holding log4j2-tomcat.xml (a copy of the shipped M18 log4j2.xml) on CLASSPATH and sets LOGGING_MANAGER to org.apache.logging.log4j.jul.LogManager; catalina.sh run piped to systemd-cat --level-prefix=true | Pass | Tomcat's own lines left JULI and used the M18 pattern: org.apache.catalina lines arrived at PRIORITY 6 for INFO (53), 4 for WARN (3) and 3 for SEVERE mapped to ERROR (1), and no line in Tomcat's dated JULI format remained; java.util.logging lines raised inside the engine WAR by the CA client (com.cosylab.epics.caj beacon messages, 166 at INFO) arrived in the same pattern at PRIORITY 6, so the JVM-wide log4j-jul manager formats them with log4j2-tomcat.xml; no MESSAGE kept a leading <N>; appliance lines unchanged (ERROR 3, WARN 4, INFO 6) |
| T3 | 2026-09-24 19:18 UTC | docs/book Docker build (mdBook 0.4.52) | Pass | Second-person pass on sysadmin/logging.md converged after one finding was applied (the jar source named as both target/tomcat-log4j and the release tarball's tomcat-log4j/); the page states that Tomcat and java.util.logging lines carry a priority only through log4j2 with the jar set, and are formatted by log4j2-tomcat.xml JVM-wide; mdbook build exit 0 |

##### Closure Evidence

- Landed 2026-09-24 19:28 UTC: commit 9bbd69bf (pom.xml, src/assembly/release.xml, docs/book/src/sysadmin/logging.md, docs/milestone-daff1b7.md) is an ancestor of the fetched origin/modernize (9bbd69bf); T1, T2 and T3 passed. Reported to aa-env for its G15 on 2026-09-24. Closed by owner decision 2026-09-24 on this row's own checks; the deployed-host observation of the jars is aa-env M35's.

#### M20 - Runtime log-level control per component

Origin: daff1b7 / M20
Identity History: none
GitHub Issue: none
Status: Complete

##### Summary

aa-env asked, for its owner, for a way to raise one running component (mgmt, engine, etl or retrieval) to DEBUG while a problem is live and lower it again, without a restart. Today levels are fixed from log4j2.xml at startup: nothing in src/main calls Configurator.setLevel, uses LoggerContext or sets monitorInterval (verified 2026-09-24). Each WAR carries its own log4j-core, so a level change applies only inside the JVM and webapp that makes it; mgmt therefore forwards the request to the target component's own BPL, as ChangeArchivalParamsAction and BulkPauseResumeUtils already forward to engine and ETL.

##### Scope

- mgmt BPL actions getLogLevel and setLogLevel (component, logger or root, level), forwarded to the component's BPLServlet.
- A matching action in each component's BPLServlet (mgmt, engine, etl, retrieval) that reads or sets the level with log4j-core's Configurator (setLevel, setRootLevel) in its own LoggerContext.
- Documentation on the operating-model page.

Out of scope: a PVA interface to the same control (a separate decision); an automatic revert timer (a candidate the owner has not accepted); Tomcat-level loggers.

##### Completion Criteria

- On the four real WARs, setLogLevel raises one component's logger to DEBUG, its DEBUG lines appear only for that component, getLogLevel reports the change, and setting it back stops them, all without a restart; the operating-model page documents the actions.

##### Dependencies And Decisions

- D31 (the logging model); aa-env's request relayed on 2026-09-23, with BPL first and PVA later as the aa-maven recommendation (owner has not yet chosen the shape).
- Settled in T2 (2026-09-24): with the Tomcat-level jar set configured as in M19 / T2, java.util.logging loggers (the CA client under com.cosylab) belong to the JVM-wide Tomcat-level context, so a WAR-side setLevel does not change them; the operating-model page states this. aa-env observed the same for LOG4J_CONFIGURATION_FILE on its VM.
- Implementation notes (2026-09-24): log4j-core moved from runtime to compile scope and left the analyze-only ignore list, because Configurator and LoggerContext are log4j-core API and log4j-api offers no way to set a level. Every reply carries the component, taken from the ConfigService WAR type. T2's input changed from sampling to a new archivePV while raised: the engine writes DEBUG lines when it connects a PV, not per sample.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner accepted 2026-09-24, choosing the BPL shape first
Implementation Authorization: owner authorized 2026-09-24
Superseded Plan Artifacts: none

1. Add the component-side get and set actions to each BPLServlet and the forwarding mgmt actions; unit-test the level parsing and the logger lookup. Closes with T1.
2. Run the four real WARs, change one component's level through mgmt, and read the journal. Closes with T2.
3. Document the actions on the logging page; mdbook build. Closes with T3.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit | ./mvnw test for the new actions' parameter handling | JDK 21, wrapper Maven | Invalid component or level is rejected; a valid request maps to the named logger or the root |
| T2 | Integration | Four real WARs under systemd-cat, with one softIocPVX PV archived, and a second PV archived while the level is raised and a third after it is reset, because the engine writes DEBUG lines when it connects a PV; setLogLevel on engine for org.epics.archiverappliance.engine to DEBUG, getLogLevel, then back to INFO; then, with the Tomcat-level jar set configured as in M19 / T2 (setenv.sh CLASSPATH, LOGGING_MANAGER, log4j2-tomcat.xml), repeat for com.cosylab | JDK 21, Tomcat 9.0.121, journald | DEBUG lines appear only under the engine identifier while raised and stop after reset; the com.cosylab result settles the hypothesis |
| T3 | Review | Second-person pass on the logging page; mdbook build | docs/book Docker build | An operator can raise and lower one component's level from the page |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-24 22:53 UTC | JDK 21.0.12.1, wrapper Maven | Pass | LogLevelsTest against the real log4j2 LoggerContext: root selection for empty, blank and root names; case-insensitive level parsing that rejects unknown names; a named logger set to TRACE while the root stays unchanged; the root set to ERROR; levels restored after each test (4 tests, 0 failures) |
| T2 | 2026-09-25 00:44-00:46 UTC | Debian 13 host, systemd 257, JDK 21.0.12.1, Tomcat 9.0.121; the four real WARs built from 67be91d7 plus this work in one CATALINA_BASE, InMemoryPersistence, softIocPVX calc records; catalina.sh run piped to systemd-cat --level-prefix=true | Pass | Through mgmt: engine's org.epics.archiverappliance.engine went INFO to DEBUG and back with previousLevel reported, while mgmt's same logger stayed INFO; with it raised, archiving a new PV wrote 23 engine DEBUG lines at PRIORITY 7, and after the reset archiving another wrote none; an unknown level and an unknown component returned HTTP 400. With the Tomcat-level jar set, setting engine's com.cosylab to ERROR left the CA client's beacon INFO lines flowing (40 while lowered, 40 after), settling the hypothesis. With LOG4J_CONFIGURATION_FILE on a site copy, a runtime DEBUG reverted to INFO within 45 s of editing the copy |
| T3 | 2026-09-25 00:52 UTC | docs/book Docker build (mdBook 0.4.52) | Pass | Second-person pass (operator on an appliance host) on the new logging-page section about getLogLevel and setLogLevel converged after one finding was applied (set DEBUG back, because a busy logger can exceed the journald rate limit); every stated behavior matches T2's observations (the reply fields, the WARN audit line, HTTP 400, the reload revert, the com.cosylab exception); mdbook build exit 0 and the section renders |

##### Closure Evidence

- Landed 2026-09-25 02:40 UTC: commit 3070c518 (the common and mgmt log-level actions, the four BPL registrations, pom.xml, LogLevelsTest, docs/book/src/sysadmin/logging.md, docs/milestone-daff1b7.md) is an ancestor of the fetched origin/modernize (3070c518); the Maven workflow run 36087147476 on 3070c518 succeeded; T1, T2 and T3 passed.

#### M21 - Reject consolidateDataForPV for an unknown PV

Origin: daff1b7 / M21
Identity History: none
GitHub Issue: #1
Status: Complete

##### Summary

`ETLExecutor.runPvETLsBeforeOneStorage` (src/main/org/epics/archiverappliance/etl/ETLExecutor.java lines 67-68) calls `getDataStores()` on the result of `getTypeInfoForPV` without a null check, so `/etl/bpl/consolidateDataForPV` for an unknown PV fails with HTTP 500 and a NullPointerException stack trace at ERROR. The lookup came with upstream 48e373b0 (2024-02-19) and is in the fork baseline. Found on 2026-09-24 while provoking one ERROR per component for the M18 / G3 supplement.

##### Scope

- Throw an IOException naming the PV when `getTypeInfoForPV` returns null, so the existing handler in `ConsolidatePBFilesForOnePV` answers HTTP 400.

Out of scope: other BPL actions that look up a PVTypeInfo.

##### Completion Criteria

- On the real WARs, consolidateDataForPV for an unknown PV returns HTTP 400 with one ERROR line naming the PV and no NullPointerException; consolidation of a known PV is unchanged and the default suite passes; issue #1 is closed manually with a comment citing the fix commit, because the fix lands on modernize and the Closes #1 footer acts only when it reaches the default branch, master.

##### Dependencies And Decisions

- Owner decision (2026-09-24): fix it now as its own row, tracked by issue #1.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: owner accepted 2026-09-24 (issue #1 first, then the fix)
Implementation Authorization: owner authorized 2026-09-24
Superseded Plan Artifacts: none

1. Add the null check in `runPvETLsBeforeOneStorage`. Closes with T1 and T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Four real WARs as four Tomcat instances under systemd-cat; GET /etl/bpl/consolidateDataForPV for an unknown PV and storage=MTS; read the etl identifier's journal | JDK 21, Tomcat 9.0.121, journald | HTTP 400; one ERROR line naming the PV; no NullPointerException |
| T2 | Unit and integration | ./mvnw -B clean verify, which runs the existing consolidation tests (ConsolidateETLJobsForOnePVTest) | JDK 21, wrapper Maven | All tests pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-25 03:18 UTC | Debian 13 host, systemd 257, JDK 21.0.12.1, Tomcat 9.0.121; the four real WARs built from c953fb07 plus the fix as four Tomcat instances under systemd-cat | Pass | GET /etl/bpl/consolidateDataForPV for an unknown PV and storage=MTS returned HTTP 400; the etl journal held one ERROR line at PRIORITY 3 from ConsolidatePBFilesForOnePV naming the PV, followed by the IOException "has no PVTypeInfo on this appliance" that the existing handler logs with it, and no NullPointerException. The same request before the fix returned HTTP 500 with a NullPointerException |
| T2 | 2026-09-25 03:31 UTC | JDK 21.0.12.1, wrapper Maven | Pass | ./mvnw -B clean verify: 782 tests, 0 failures, including ConsolidateETLJobsForOnePVTest (6 tests); enforcer and analyze-only clean |

##### Closure Evidence

- Landed 2026-09-25 04:30 UTC: commit 25606494 (src/main/org/epics/archiverappliance/etl/ETLExecutor.java, docs/milestone-daff1b7.md) is an ancestor of the fetched origin/modernize; the Maven workflow run 36093615092 on 25606494 succeeded; T1 and T2 passed. Issue #1 was closed manually on 2026-09-25 04:16 UTC with a comment citing 25606494.

#### M22 - Local appliance launcher in one folder

Origin: daff1b7 / M22
Identity History: none
GitHub Issue: #7
Status: Complete

##### Summary

The upstream install samples that M17 removes (single_machine_install.sh, quickstart.sh) let a user start a whole appliance from the release bundle; the fork deploys through jeonghanlee/epicsarchiverap-env, which needs a provisioned host and systemd. A local launcher lets a developer build in this repository and run the whole archiver on one machine without that repository, and gives BPL checks such as M17 / T5 an appliance to run against.

##### Scope

One bash script that starts the four WARs of a local build (mgmt, engine, etl, retrieval) as four Tomcat instances in the foreground, with SQLite as the configuration database, and creates every file it needs (the Tomcat instance directories, the STS, MTS and LTS stores, the SQLite database with its schema, the logs) under one temporary folder, so that deleting the folder removes the run. No systemd unit or service manager.

Out of scope: deployment and its verification (systemd, journald, MariaDB, host provisioning), which stay in jeonghanlee/epicsarchiverap-env; production use.

##### Completion Criteria

- From a clean checkout and a Maven build, the script starts the four WARs on SQLite in one folder; the mgmt BPL answers, a PV is archived and retrieved, the PV configuration survives a stop and start in the same folder, and no file is written outside the folder.

##### Dependencies And Decisions

- M13 (work ordering): owner direction (2026-09-25) to start after the SQLite backend is complete, so the launcher uses the SQLite contract M13 documents.
- Consumer: M17 / T5 runs the candidate Python BPL clients against an appliance started by this launcher.
- Decision Date: 2026-09-28. Use an existing Tomcat 9 when available; otherwise download a pinned Tomcat 9 distribution into the run folder and verify its checksum before extraction.
- Decision Date: 2026-09-28. Use the existing softIocPVX and src/resources/test/UnitTestPVs.db for verification. The IOC is a separate test input; the launcher starts the appliance.
- Decision Date: 2026-09-28. Place the launcher at scripts/run-local-appliance.bash.
- Existing implementation: src/test/org/epics/archiverappliance/TomcatSetup.java deploys all four WARs into one Tomcat, defaults to InMemoryPersistence, and clears its appliance folder during setup. The M22 checks must invoke the new launcher with the shipped WARs and the normal configuration service, so that they exercise four instances and persistent SQLite configuration.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-09-28, reviewed plan in 23c02907
Implementation Authorization: 2026-09-28, implement the reviewed plan and run T1 to T8
Superseded Plan Artifacts: the two-step outline awaiting Tomcat, PV-source and script-location decisions, replaced on 2026-09-28

1. Add scripts/run-local-appliance.bash with an explicit run-folder argument and an optional WAR-directory argument, defaulting to target/. The caller builds the WARs first. Select one complete set of mgmt, engine, etl and retrieval WARs with the same build name; reject missing or ambiguous sets before starting a JVM. Require JDK 21 and the local tools the selected path uses; print the run folder, component URLs and log paths. Before downloading, copying WARs, generating configuration or opening SQLite, resolve the physical run-folder path and acquire a nonblocking exclusive flock on a stable lock file in that folder; only creation of a missing run folder and its lock file may precede acquisition. Retain the lock for preparation, execution and cleanup, and never unlink the lock file. Reject a competing invocation without changing the existing run's files or processes, including when the first invocation is still preparing the folder. Retain the folder on normal stop and failure so it can be inspected and restarted. Closes with T1, T5, T6 and T8.
2. Resolve Tomcat from the configured TOMCAT_HOME or CATALINA_HOME, then standard local installation locations and a previously downloaded copy in the run folder. Check that a candidate is a usable Tomcat 9 before reuse; an explicitly configured invalid installation is an error. If none is available, download the pinned Apache core tar.gz and its SHA-512 checksum over HTTPS into the run folder, verify before extraction, and retain the verified distribution for subsequent runs. The initial download version proposed by this plan is 9.0.122; store the version and source URLs explicitly in the script rather than resolving a moving latest version at startup. Keep downloaded archives, partial downloads and extracted files inside the run folder. Closes with T4.
3. Create one CATALINA_BASE for each component under the run folder, with its own conf, logs, temp, work and webapps directories. Share the selected CATALINA_HOME and leave an existing installation unchanged. Generate a single-appliance appliances.xml with loopback URLs, distinct component ports and a configurable port base. Copy each WAR under its component name. Put STS, MTS, LTS, generated configuration, logs and application/JVM temporary files under the same run folder; explicitly set the relevant paths instead of inheriting unrelated appliance configuration. Follow docs/book/src/installing.md and docs/book/src/configuration.md for the four-instance configuration. Closes with T1 and T3.
4. Initialize a new SQLite database from the shipped archappl_sqlite.sql in the mgmt WAR, then check PVTypeInfo, PVAliases, ArchivePVRequests and ExternalDataServers. On restart, retain the database and check its schema without replaying CREATE statements or clearing configuration. Configure jdbc/archappl in mgmt's context.xml using the single-connection tomcat-jdbc pool and WAL settings from docs/book/src/persistence.md. Use the JDBC driver in the WAR and the normal MySQLPersistence implementation. Closes with T1 and T2.
5. Keep the launcher in the foreground and run each component with catalina.sh run, starting mgmt, engine, etl and retrieval in that order. After all four have been launched, wait for completed startup and responding component endpoints within a bounded startup timeout. Track only the child processes started by this invocation. On SIGINT, SIGTERM, partial startup failure or unexpected component exit, begin one monotonic shutdown deadline shared by all components, send SIGTERM and wait in reverse component order, and do not restart the deadline for another component or signal. The proposed --stop-timeout default is 300 seconds; accept only a positive value and report the configured limit at startup. This is the total graceful-stop allowance, not the ETLPassStopWaitSeconds value: ETL performs additional consolidation after its two bounded waits. If the deadline expires, send SIGKILL to every remaining owned child and allow a separate bounded reap period of 5 seconds. Any forced or incomplete stop returns nonzero and records the affected components; retain the database, stores and logs without claiming that buffered data was flushed. If a child still has not exited after the reap period, record its PID and process start identity and reject later reuse of the folder while that process remains alive. Never signal unrelated processes. Closes with T1, T2, T5 and T7.
6. Exercise the shipped launcher directly for T1 to T5, T7 and T8 with the WARs of the recorded build. Serve the existing UnitTestPVs.db through softIocPVX on loopback with a unique prefix, and archive a changing PV from that fixture. Keep the IOC and verification output inside the verification run folder. Record the commands, selected Tomcat, build identity, HTTP results, process shutdown and filesystem evidence. Internal launcher functions, the appliance configuration service and persistence are not substituted in these checks. Closes with T1 to T5, T7 and T8.
7. Add a local-launcher section to docs/book/src/developer.md covering prerequisites, the Maven build, Tomcat reuse/download, starting in a new folder, stopping, restarting the same folder, component URLs and logs. Document the exclusive run-folder lock, --stop-timeout, forced-stop failure status and possible unflushed samples, and the refusal to reuse a folder with a surviving owned process. State the development-only scope and that the launcher retains the run folder. Run the script checks and build the book. Closes with T6.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Build with ./mvnw -B -ntp clean package, start scripts/run-local-appliance.bash in a fresh folder, check all four component endpoints and /mgmt/bpl/getApplianceInfo, archive a changing UnitTestPVs.db PV through /mgmt/bpl/archivePV, then inspect /mgmt/bpl/getPVStatus, its PVTypeInfo row and /retrieval/data/getData.json | JDK 21, four current-build WARs, Tomcat 9, sqlite3, softIocPVX with a unique fixture prefix on loopback | Four distinct Tomcat processes serve their component WARs; all four schema tables exist; SQLite is used; the PV reaches Being archived and retrieval returns its samples |
| T2 | Integration | Stop the launcher, verify its four JVMs exit, restart with the same run folder, and query the PV from T1 without another archivePV request; retrieve samples from before and after the restart | Same as T1; IOC remains running | The PV configuration remains in SQLite, the PV returns to Being archived, old samples remain readable and new samples arrive |
| T3 | Integration | Trace filesystem operations of the real launcher and its descendants during fresh setup, download, T1, T2 and shutdown; resolve relative paths and inspect file creation, writes, renames and deletion; compare the reused Tomcat installation before and after | Linux with strace, dedicated run folder; run after the Maven build | Every file created or changed by the launcher and its children is inside the run folder; the reused Tomcat installation is unchanged; logs, SQLite native extraction and application/JVM temporary files are included in the check |
| T4 | Integration | Run T1 and T2 once with an existing Tomcat 9 and once with no available Tomcat; inspect the selected home, actual download and checksum result, and repeat with the downloaded copy while only outbound HTTPS to the Tomcat distribution and checksum download servers is blocked. Keep loopback HTTP between appliance components and from the verification client allowed. Exercise a checksum mismatch by changing only the downloaded HTTP response in the failure check | Real launcher and Apache distribution; separate run folders; HTTP boundary substitution only for the mismatch case | The existing installation is reused; the missing-installation path downloads and verifies the pinned version; a retained installation runs without another download; a mismatched archive is neither extracted nor executed |
| T5 | Integration | Invoke the real launcher with a missing WAR, an invalid explicit Tomcat home and an occupied component port; terminate one owned component after a healthy start; separately stop healthy runs with SIGINT and SIGTERM | Same as T1; a separate listener occupies the port for the collision case | Invalid inputs fail clearly; failed or interrupted runs leave no owned JVM alive; the independent listener remains alive; SQLite, stored samples and diagnostic logs remain available |
| T6 | Static, documentation build | Run bash -n and shellcheck -S warning on scripts/run-local-appliance.bash; inspect the full plain shellcheck output; compare the developer-guide commands with the exercised CLI and build the book using docs/book/Dockerfile | Bash, ShellCheck, existing mdBook Docker build | Syntax and the warning/error gate pass; all diagnostics are examined; the book builds and its commands match the verified launcher behavior |
| T7 | Integration | Start the real appliance with a short positive --stop-timeout, send SIGSTOP to its actual ETL JVM, then SIGTERM to the launcher. Measure elapsed shutdown time with a monotonic clock, inspect the launcher exit status and child processes, and restart the retained folder. Also reject zero, negative and malformed timeout arguments before preparation | Same as T1; actual JVM suspended by a process signal, with no internal substitution | The suspended JVM receives SIGKILL after the shared graceful deadline; the launcher returns nonzero within that deadline plus the 5-second reap allowance and at most 2 seconds of scheduling tolerance; no owned JVM remains in this case; unrelated processes survive; the retained database and previously persisted samples remain usable after restart; invalid arguments change no existing run files |
| T8 | Integration | While T1 is archiving, trace a second invocation using the same physical run folder, including through a symlink alias; compare WAR and configuration hashes, query the existing PV configuration, and check continued retrieval before and after rejection. Separately start two real launchers concurrently against one fresh run folder and observe lock ownership during preparation | Same as T1, flock and strace; real launchers and WARs | Only one invocation prepares or owns the folder; the rejected invocation writes no existing WAR, configuration, database or store file and signals no process; the first invocation retains its configuration and continues archiving; normal SQLite and store writes from the first invocation are attributed to that process rather than mistaken for changes by the rejected invocation |

##### Verification Results

Verified on 2026-09-28 with build `aa-20260928-23c02907`, OpenJDK 21.0.12.1, Tomcat 9.0.122, SQLite JDBC 3.53.4.0, Python 3.13.5, and the installed softIocPVX 1.5.1 serving the shipped UnitTestPVs.db. The final launcher SHA-256 is `ef2b4e63d13e8e2bbe2fcd5e606781e93354f302c82ddc24e280509f6f1388f1`.

The real integration command was `python3 work/m22-additional.py`, using `work/m22-verify.py`; it exited 0. Observations from 21:19:44 to 21:29:38 UTC are in `work/m22-final-verification/results.json`. Each run retains its command, component logs, HTTP responses, SQLite row, and strace output. `work/m22-trace.py` resolves traced filesystem mutations and reports outside or unresolved paths. Only the checksum-failure case substitutes an outer HTTP response; the launcher, four WARs, configuration service, persistence, and IOC fixture run unchanged.

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-28 | Recorded build, four Tomcat JVMs, SQLite, softIocPVX and UnitTestPVs.db | Pass | `./mvnw -B -ntp clean package` completed with 805 tests, zero failures/errors/skips (`work/m22-build.log`). Both final Tomcat selection paths served four component endpoints and getApplianceInfo, contained all four schema tables and the PVTypeInfo row, reached Being archived, and returned changing samples through getData.json. |
| T2 | 2026-09-28 | Same as T1; same IOC and run folders | Pass | Both paths stopped all four JVMs and restarted without another archivePV request. Previously retrieved sample timestamps and values remained present, and new timestamps arrived after restart; see `results.json` and each run's `latest-data.json`. |
| T3 | 2026-09-28 | Linux, strace 6.13; fresh and restarted downloaded/reused Tomcat | Pass | Four complete lifecycle trace analyses report zero outside paths and zero unresolved records: `download/trace-analysis-fresh.json`, `analysis-restart.json`, `analysis-existing-fresh.json`, and `analysis-existing-restart.json` under the final evidence folder. SQLite native extraction is under mgmt/temp. All 645 reused Tomcat file hashes remained unchanged. |
| T4 | 2026-09-28 | Real Apache download and existing Tomcat; HTTPS proxy denial; corrupted HTTP response for the negative case | Pass | Fresh setup downloaded 9.0.122 and verified its SHA-512; both paths passed T1/T2. Cached restart succeeded with download HTTPS blocked and loopback HTTP available. The corrupted archive returned exit 1 with SHA-512 mismatch, an empty distribution folder, and no Tomcat children. |
| T5 | 2026-09-28 | Real launcher, WARs and independent listener | Pass | Missing WARs, an invalid explicit Tomcat home, and an occupied port were rejected. Healthy SIGINT/SIGTERM returned 130/143 and stopped every owned JVM. Terminating the engine caused exit 1 and cleanup of the other JVMs; the unrelated listener survived. Logs, database and samples remained available. |
| T6 | 2026-09-28 | Bash, ShellCheck 0.10.0; docs/book/Dockerfile with mdBook 0.4.52 | Pass | bash -n and shellcheck -S warning exited 0. Full plain ShellCheck output was inspected: SC2317 info diagnostics concern EXIT-trap functions exercised by the lifecycle tests. The documented Docker build and mdBook build exited 0; mdbook-admonish reported its existing 0.4.51/0.4.52 build-version warning. The guide matches the exercised CLI, URLs and logs. |
| T7 | 2026-09-28 | Actual ETL JVM suspended with SIGSTOP; --stop-timeout 3 | Pass | SIGTERM stopped the launcher in 3.171 seconds with exit 1 and no owned JVM remaining; the unrelated listener survived. Restart retained the SQLite PV and earlier samples and produced new samples. Zero, negative, non-integer and malformed stop timeouts failed before run-folder preparation. |
| T8 | 2026-09-28 | Real concurrent launchers, physical folder and symlink alias; flock and strace | Pass | One fresh invocation owned preparation; its competitor exited 1 before readiness. Active-run and symlink-alias competitors also failed while PV sampling continued and WAR/configuration hashes stayed unchanged. The three rejected traces show only opening the stable lock file and writing their error log, with no process signals or database/store/configuration writes. |

##### Closure Evidence

- Local deliverables: `scripts/run-local-appliance.bash` and the local-appliance section of `docs/book/src/developer.md`; implementation checked against plan steps 1 to 7 and T1 to T8.
- Verification artifacts: `work/m22-final-verification/`, with the executed helpers `work/m22-verify.py`, `work/m22-additional.py`, and `work/m22-trace.py`.
- Complete on 2026-09-28: implementation and developer guide committed as 63113582170c011def817c534ba40bb2357afb8f; T1 to T8 passed as recorded above.
- Upstream landing observed on 2026-09-28 at 22:43 UTC: after `git fetch origin`, `origin/modernize` resolved to 63113582170c011def817c534ba40bb2357afb8f. `git diff --exit-code 63113582170c011def817c534ba40bb2357afb8f origin/modernize -- scripts/run-local-appliance.bash docs/book/src/developer.md docs/milestone-daff1b7.md` returned 0.
- Linked issue #7: body reconciled with the implementation and verification; closed as completed on 2026-09-28 at 22:38:53 UTC, with closure comment https://github.com/jeonghanlee/epicsarchiverap-maven/issues/7#issuecomment-5880002740. Closed state and body read back on 2026-09-28 at 22:43 UTC.

##### GitHub Projection

Title: Add a local launcher that runs the appliance in one folder
Labels: enhancement
GitHub Milestone: none
Observed State: closed
Observed Labels: enhancement
Observed Milestone: none
Observed Updated At: 2026-09-28T22:38:53Z
Last Compared: 2026-09-28 22:43 UTC (gh issue view 7 --repo jeonghanlee/epicsarchiverap-maven --json state,closedAt,body,comments,url,labels,milestone,updatedAt)

#### M23 - Code defects found while rewriting the docs

Origin: daff1b7 / M23
Identity History: none
GitHub Issue: #8
Status: Complete

##### Summary

Checking the rewritten book against the code on 2026-09-25 (M17 step 3) turned up defects in the code, outside the docs work. Each is recorded with its evidence; the confirmed ones were read in the source, none was run.

##### Scope

Confirmed by reading the source:

1. `importConfig` skips an appliance group that holds exactly one PV: `if(pvsForAppliance.size() > 1)` at src/main/org/epics/archiverappliance/mgmt/bpl/ImportConfig.java line 72, so importing a one-PV export imports nothing.
2. Two reports of the Reports page call BPL actions that no servlet registers: `getPVsByScanCopyTime` and `getPVsByMaxTimeBetweenScans` (src/main/org/epics/archiverappliance/mgmt/staticcontent/js/mgmt.js lines 943 and 973); no Java file defines either.
3. The pages' help handlers open `help/user/userguide.html` (for example src/main/org/epics/archiverappliance/mgmt/staticcontent/index.html line 228), which the mgmt WAR does not contain.
4. The `3DaysMTSOnly` branch of the default site's policies.py records `policyName = '2HzPVs'` (src/sitespecific/default/classpathfiles/policies.py, the `3DaysMTSOnly` branch).
5. `TimeUtils.fromString` falls back to the offset format only on `IllegalArgumentException` (src/main/org/epics/archiverappliance/common/TimeUtils.java, `fromString`), but `Instant.parse` throws `DateTimeParseException`, which is not one, so the retrieval servlet's `catch (IllegalArgumentException)` around it does not answer a malformed time with HTTP 400. (Corrected 2026-09-26 by T3: an offset timestamp such as `2012-11-03T00:00:00-07:00` is accepted, because `Instant.parse` takes an offset since JDK 12; only the malformed-time answer is wrong.)
6. The retrieval servlet reads `donotchunk` into a local `useChunkedEncoding` (src/main/org/epics/archiverappliance/retrieval/DataRetrievalServlet.java lines 348 and 760) and never uses it, so the parameter has no effect.
7. The `rms` post-processor (retrieval/postprocessors/RMS.java) is not in the registry of PostProcessors.java, so `rms_<secs>` is not accepted.
8. The tests site's build.xml uses `${classes}` (src/sitespecific/tests/build.xml lines 8 and 21), while the pom passes the class path as `ant.classes` (pom.xml, the `sitespecificantscript` execution).

Hypotheses, to check first:

9. `RedisPersistence` creates its connection pool only when `ARCHAPPL_PERSISTENCE_LAYER_REDISURL` is set, although it logs `localhost` as the default (RedisPersistence.java lines 38-49).

Out of scope: the docs, which describe the behavior as it is.

##### Completion Criteria

- Each item is fixed with a test on the real path, or kept with a recorded reason; the owner decides which.

##### Dependencies And Decisions

- Found during M17 / step 3 (2026-09-25). No dependency.
- Owner decision (2026-09-26): fix items 1 to 8 in three groups, each reproduced on the real code first, then fixed, verified and reflected in the book: site configuration (4, 8), retrieval request handling (5, 6, 7), mgmt UI and BPL (1, 2, 3). Item 2: remove the two reports whose BPL actions do not exist from the Reports page rather than implementing the actions. Item 3: point the help handlers at the published book instead of the missing userguide.html (superseded the same day, below). Item 6: make donotchunk take effect rather than removing it (superseded the same day, below). Item 9 moves to M12's backend inventory.
- Owner decision (2026-09-26), revising item 6: remove donotchunk. Its only use, a Transfer-Encoding header, has been commented out since the first commit of this history (a949151c, 2015); the servlet streams every response, so Tomcat chunks it, and honoring the flag would mean holding a whole response in memory to send a Content-Length. The same unused handling in PvaGetPVData goes with it.
- Owner decision (2026-09-26), revising item 3: remove the seven help click handlers. Every Help link is already `<a href="api/index.html" id="help">`, the generated API reference that the book describes; the handlers opened help/user/userguide.html in a second window, which the WAR does not ship.
- Premise of item 2 (2026-09-26): 1a7f24ef (Get rid of the scan threads) removed the server side of the SCAN reports and left their two report entries in reports.html and mgmt.js.
- Pattern found by T3 (2026-09-26): convertFromISO8601String and convertFromDateTimeStringWithOffset throw DateTimeParseException, while every caller (TimeUtils.fromString, the timeranges parsing in DataRetrievalServlet, and the from, to and timeranges parsing in PvaGetPVData) catches IllegalArgumentException; the fix goes into the two converters so all five callers see the exception they expect.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-09-26, owner accepted this plan with the recommended outcomes for items 2, 3, 6 and 9; revised the same day by owner direction for item 6 (remove donotchunk) and item 3 (remove the help click handlers)
Implementation Authorization: 2026-09-26, owner authorized implementation of this plan and of both revisions
Superseded Plan Artifacts: the one-step plan to settle the item list (2026-09-25), replaced by this plan; in step 2, honoring donotchunk in DataRetrievalServlet (item 6), and in step 3, pointing the help handlers at the published book (item 3), both replaced on 2026-09-26 by the revisions above

1. Site configuration. Correct the policyName of the 3DaysMTSOnly branch in src/sitespecific/default/classpathfiles/policies.py (item 4) and the class-path property that src/sitespecific/tests/build.xml reads (item 8); update the policy table in docs/book/src/configuration.md if it names the policy. Closes with T1, T2 and T8.
2. Retrieval request handling. Make the two TimeUtils converters throw IllegalArgumentException when parsing fails, so the retrieval servlet answers a malformed time with HTTP 400 (item 5); remove the unused donotchunk handling from DataRetrievalServlet and PvaGetPVData (item 6); register RMS in PostProcessors (item 7); update docs/book/src/retrieval.md. Closes with T3, T4, T5 and T8.
3. mgmt UI and BPL. Import a one-PV group in ImportConfig by testing for a non-empty group instead of size() > 1 (item 1); remove the two SCAN report entries and their functions from reports.html and mgmt.js (item 2); remove the seven help click handlers from the mgmt pages (item 3). The book's Reports list and Help row already match. Closes with T6, T7 and T8.
4. Second-person pass and mdbook build for each group's book changes. Closes with T9.

##### Test Plan

Each regression test runs the shipped class or a deployed WAR, and is shown to fail on the code before its fix.

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit | Execute the default site's policies.py through the real policy engine for a PV that selects 3DaysMTSOnly | JDK 21, wrapper Maven | policyName is 3DaysMTSOnly; before the fix it is 2HzPVs |
| T2 | Build | Package with -Darchapplsite=tests and inspect the site build step's effect on the WARs | JDK 21, wrapper Maven | The step resolves the class path from the pom's property; before the fix it does not |
| T3 | Unit and integration | TimeUtilsTest on an ISO time, an offset time and a malformed value; DataRetrievalServletTest.testTimeParameterStatusCodes against a deployed retrieval WAR | JDK 21, wrapper Maven; Tomcat 9, integration profile | Both converters and fromString throw IllegalArgumentException on a malformed value; the deployed servlet answers a malformed from with HTTP 400 and an offset from for an unknown PV with HTTP 404; before the fix the malformed value throws DateTimeParseException and the servlet answers HTTP 500 |
| T4 | Unit | Resolve rms_60 through PostProcessors and run it on a real event stream | JDK 21, wrapper Maven | An RMS post-processor is returned and computes per-bin RMS; before the fix none is returned |
| T5 | Static | git grep -i for donotchunk and useChunkedEncoding under src/main after the removal | working tree | No match |
| T6 | Integration | ImportConfigTest: POST to the deployed mgmt importConfig an export of one PV, produced by the JSONEncoder that exportConfigForAppliance uses, then read getPVTypeInfo and exportConfig | Tomcat 9, integration profile | One import response; the PV has a type info and is in the export; before the fix the response is empty |
| T7 | Unit and integration | StaticContentBPLCallsTest: every ../bpl/ path in the mgmt HTML and JavaScript against the BPLServlet GET and POST registries; MgmtPageLinksTest: fetch eight pages from the deployed mgmt WAR, then their Help link and every window.open target | JDK 21, wrapper Maven; Tomcat 9, integration profile | No unregistered action; every target answers HTTP 200; before the fix the two SCAN actions are unregistered and the userguide.html targets answer 404 |
| T8 | Integration | ./mvnw -B -ntp clean verify after each group | JDK 21, wrapper Maven | Build and the default suite pass |
| T9 | Review | Second-person pass on the changed book pages; mdbook build | docs/book Docker build | A reader can use each corrected behavior from the page; the book builds |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-26 10:00 UTC | JDK 21, wrapper Maven; working tree on 7bebca0c | Pass | PolicyExecutionTest.testPolicyOverrideReportsItsOwnName, run with ARCHAPPL_POLICIES set to each site's policies.py, failed on both files before the fix (expected 3DaysMTSOnly but was 2HzPVs) and passed after it; the tests site carried the same defect and was corrected with the default site |
| T2 | 2026-09-26 10:01 UTC | JDK 21, wrapper Maven; working tree on 7bebca0c | Pass | ./mvnw -B -ntp package -DskipTests -Darchapplsite=tests failed before the fix (Classes folder - ${classes}, ClassNotFoundException for SyncStaticContentHeadersFooters, tests/build.xml:20 Java returned: 1); after ${ant.classes} it built, SyncStaticContentHeadersFooters rewrote the mgmt pages and ui/index.html carries the tests site header |
| T3 | 2026-09-26 18:59 UTC | JDK 21, wrapper Maven; Tomcat 9.0.121 (a user-owned distribution with conf_original) as TOMCAT_HOME, integration profile | Pass | Before the fix TimeUtilsTest.testMalformedTimesThrowIllegalArgumentException failed (DateTimeParseException) and, with the WARs built from the unfixed TimeUtils, testTimeParameterStatusCodes failed with expected 400 but was 500 (18:54 UTC); the offset case already passed. After the fix TimeUtilsTest passed 14 of 14 and DataRetrievalServletTest passed 2 of 2; rerun at 19:22 UTC with two more cases, an offset +09:00 sent unencoded (HTTP 400; the servlet logs the time with a space in place of +) and sent as %2B09:00 (HTTP 404), it passed 2 of 2 |
| T4 | 2026-09-26 | JDK 21, wrapper Maven | Pass | SummaryStatsPostProcessorTest.testRMSThroughRegistry failed before the fix (No post processor registered for rms_86400) and passed after RMS was registered, every daily bin of alternating +3 and -3 samples giving 3.0 |
| T5 | 2026-09-26 | working tree | Pass | git grep -n -i for donotchunk and useChunkedEncoding under src/main returned no match |
| T6 | 2026-09-26 20:28 UTC | JDK 21, wrapper Maven; Tomcat 9.0.121 as TOMCAT_HOME, integration profile | Pass | ImportConfigTest failed on the unfixed WARs (20:01 UTC: One response per appliance in the export, expected 1 but was 0) and passed after !isEmpty() (20:02 and 20:28 UTC); no other size() > 1 check exists under src/main |
| T7 | 2026-09-26 20:28 UTC | JDK 21, wrapper Maven; Tomcat 9.0.121 as TOMCAT_HOME, integration profile | Pass | StaticContentBPLCallsTest failed before the removal (unregistered /getPVsByMaxTimeBetweenScans, /getPVsByScanCopyTime) and passed after it; MgmtPageLinksTest failed on the unfixed WARs (20:25 UTC: six help/user/userguide.html targets not served) and passed after the handlers were removed |
| T8 | 2026-09-26 20:40 UTC | JDK 21, wrapper Maven; group 3 applied on a23670a2 | Pass | ./mvnw -B -ntp clean verify: after group 1 (10:14 UTC) 784 tests, after group 2 (19:12 UTC) 787 tests, after group 3 788 tests, each 0 failures, 0 errors and BUILD SUCCESS |
| T9 | 2026-09-26 19:25 UTC | docs/book Docker build, pinned mdBook 0.4.52 and mdbook-admonish 1.20.0 | Pass | Group 3 changed no book page, because the Reports list and the Help row of the book already matched the fixed behavior. Second-person pass on building.md and retrieval.md: one minor finding (an unencoded + of an offset arrives as a space) and one info finding (where staged files land in the WARs), both applied; the book builds with exit 0 and only the mdbook-admonish 0.4.51 notice |

##### Closure Evidence

- Groups 1 and 2 landed 2026-09-26: commits 7162e178 (item 4), 938f22d8 (item 8), f0366dff (item 5), 94b15626 (item 7), e9772efe (item 6) and a23670a2 (this register).
- Group 3 landed 2026-09-26: commits d5a749dc (item 1), 53740e62 (item 2), 8ed1eeff (item 3) and f2c35e0b (this register); the Maven workflow run 36271002724 on f2c35e0b succeeded.
- All are ancestors of the fetched origin/modernize (7d2337f9). #8 was updated with the implementing commits and closed as completed at 2026-09-27T02:59:58Z (gh issue view 8 --repo jeonghanlee/epicsarchiverap-maven --json state,closedAt).

##### GitHub Projection

Title: Fix the code defects found while rewriting the docs
Labels: bug
GitHub Milestone: none
Observed State: closed
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-09-27 (gh issue view 8 --repo jeonghanlee/epicsarchiverap-maven --json state,labels,milestone)

#### M24 - Per-request retrieval logging at DEBUG

Origin: daff1b7 / M24
Identity History: none
GitHub Issue: #10
Status: Complete

##### Summary

The retrieval web application wrote several INFO lines for every data request, each naming a part of the same request: RetrievalState.java line 209 (Update metrics for the PV), DataRetrievalServlet.java lines 336 and 740 (the response format), and PlainPBStoragePlugin.java lines 327 and 331 (the cached entries and the matching files per store). The soak and load test of 2026-09-24 to 2026-09-26 (M13 Dependencies) measured 12.8 MB/h under four retrieval clients; the per-request count first reported as about two lines was corrected on 2026-09-27 to about eight (350263 INFO lines for 42610 requests over 6 h; LAB-ansible-provision pattern counts of 2026-09-27, not yet posted to an issue), of which the five calls of this item are three per single-PV request and the other five call sites are M29. Under the journald model of D31 these lines share the retention cap with warnings and errors, while the Tomcat access log already records every request with its URL, status and size for 90 days.

##### Scope

Log those five lines at DEBUG.

Out of scope: the etl ERROR bursts while a store is unwritable, discussed separately; engine and CA client logging; the access log.

##### Completion Criteria

- The five calls log at DEBUG in the source; a deployed retrieval WAR at the default level writes none of the three that a single-PV request passes through (RetrievalState line 209, DataRetrievalServlet line 336, PlainPBStoragePlugin line 331), and errors are still written. The multi-PV line (DataRetrievalServlet line 740) and the cached-entries line (PlainPBStoragePlugin line 327) are the same one-word change on paths the check does not reach. The build and the default suite pass apart from ETLPostProcessorTest, which fails without this change (M27).

##### Dependencies And Decisions

- D31 (journald collects; the access log is kept as a file with maxDays=90).
- Owner decision (2026-09-26): one record per request is enough; lower the per-request lines to DEBUG and leave the per-request record to the access log.
- Correction (2026-09-27, projected to #10 on 2026-09-28): the soak measured about eight INFO lines per request, not two; the five calls of this item cover three of them, and the remaining call sites (DataRetrievalServlet 'For the complete request', MergeDedupConsumer 'Found a total of' and 'was an empty stream', PBOverHTTPStoragePlugin 'URL to fetch data is', RetrievalState 'Found a data source') stay at INFO after d9250d23. Owner decision (2026-09-28): this item stays Complete on its own criteria; the remaining call sites are Backlog M29.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-09-26, owner direction to lower the per-request lines to DEBUG
Implementation Authorization: 2026-09-26, the same owner direction
Superseded Plan Artifacts: none

1. Change the five logger.info calls to logger.debug. Closes with T1 and T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Run DataRetrievalServletTest against deployed WARs before and after the change and count Update metrics for, Mime is and matching files for pv in the appliance output | Tomcat 9, integration profile | Before, the lines appear; after, none appears and the RetrievalError lines for the malformed time remain |
| T2 | Integration | ./mvnw -B -ntp clean verify | JDK 21, wrapper Maven | The build passes, and the default suite passes apart from ETLPostProcessorTest, which fails without this change (M27) |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-26 21:13 UTC | JDK 21, wrapper Maven; Tomcat 9.0.121 as TOMCAT_HOME, integration profile | Pass | Covers the single-PV path (lines 209, 336 and 331). Before the change (the 19:22 UTC run) the output held Update metrics for 3 times, Mime is 5 times and matching files for pv 2 times; after it none of them, with the 2 RetrievalError lines for the malformed time still present and DataRetrievalServletTest passing 2 of 2 |
| T2 | 2026-09-26 21:25 UTC | JDK 21, wrapper Maven | Pass apart from M27 | ./mvnw -B -ntp clean verify: 788 tests, 1 failure (ETLPostProcessorTest.testPostProcessorDuringETL, expected 384 reduced events, got 368); the same test failed five more times on this tree and once on the HEAD source f2c35e0b with the change reverted, so the failure does not come from this change; tracked as M27 |

##### Closure Evidence

- d9250d23 (the change) and a766de08 (this register) are ancestors of the fetched origin/modernize (7d2337f9); the Maven workflow run 36278109280 on a766de08 succeeded. T2's exception ended with M27: the default suite passes with 788 tests on 7d2337f9 (Maven workflow run 36289020914).
- #10 was updated and closed as completed at 2026-09-27T03:00:04Z (gh issue view 10 --repo jeonghanlee/epicsarchiverap-maven --json state,closedAt).

##### GitHub Projection

Title: Log the per-request retrieval lines at DEBUG
Labels: enhancement
GitHub Milestone: none
Observed State: closed
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-09-28 (gh issue view 10 --repo jeonghanlee/epicsarchiverap-maven --json title,state,labels,assignees; body re-projected 2026-09-28 with the corrected per-request count and the pointer to #13)

#### M25 - ETL pass scheduler in place of per-PV timers

Origin: daff1b7 / M25
Identity History: renamed 2026-09-27 from "ETL STS-to-MTS job time growth" when the soak figures showed the growth was the metric, not ETL; renamed 2026-09-27 from "ETL last-job metric reports a running sum" when the design review found the per-PV timers to be the cause and replaced them with one pass driver per transition
GitHub Issue: #11
Status: Complete

##### Summary

The ETL metric "Approximate time taken by last job in ETL(0>1)" (ETLMetrics.java line 74) does not show the last job: it is a running sum of per-PV ETL durations that resets only after 15 minutes without an update (ETLMetricsForLifetime.updateApproximateGlobalLastETLTime, lines 108-123). The ansible-provision soak and load test of 2026-09-24 to 2026-09-26 (M13 Dependencies; STS PARTITION_5MIN) read it rising about 9 s per hour to 277 s against the 300 s STS partition period, which was first taken as ETL falling behind. The other figures of the same metrics page show that ETL kept up: the "Average time spent in ETL(0>1) (s/run)" row is the running sum divided by the largest per-PV run count, that is the pass count, so it is the busy time of one pass over all PVs (0.36 s at 500 PVs, 0.49 s at 903, then 0.69 s as lifetime values; the growth of the sum per run gives one pass at about 0.43 s at 500 PVs, 0.68 to 1.03 s at 903 PVs, 0.78 s under the 6 h retrieval load, 0.69 s in the final hold; LAB-ansible-provision and aa-env corrections of 2026-09-27, jeonghanlee/epicsarchiverap-env#50), the "last job" value equalled runs times that average at every sample (401 x 0.69 s = 277 s at 2026-09-26T18:50Z), and the estimated weekly usage stayed at 0.18 %. The design review of 2026-09-27 (docs/design-etl-pass-scheduler.md) found the cause in the scheduling: each PV runs on its own timer whose initial delay is clamped to zero, so the jobs of a transition spread over the cadence, no pass exists to measure, and the metric can only estimate one. The design replaces the per-PV timers with one pass driver per (transition index, cadence) that fires on a fixed grid, records each pass, and derives every reported value from the records. aa-env asked aa-maven to own the item; ansible-provision sent the corrected reading, and aa-env was told of the re-scope.

##### Scope

Implement docs/design-etl-pass-scheduler.md: the pass driver, the ticker, the pass record and the reported rows, the job reporting in ETLJob, the consolidation queue of pause and delete, the shutdown order, the environment reader for ARCHAPPL_SKIP_ETL_FOR_STORE, and the tests its Testing section names; align the book page that describes the skip-store variable (docs/book/src/configuration.md), and set the two ETL pass properties in the default site's archappl.properties and on that page (owner decision 2026-09-28).

Out of scope: what one ETL job moves and how (ETLJob.processETL, the store plugins, hold and gather, post-processors); aa-env's store variables and partition settings; host sizing; ETL throughput (ETLPassWorkers stays 1); the consolidate BPL through ETLExecutor; the carry-forward items of the design review, recorded in the Backlog when the owner directs.

##### Completion Criteria

- The two before-evidence runs on HEAD are recorded (T2) before any code change.
- The driver, record, rows and consolidation order behave as the design states on the real ETL path with only the clock and the environment reader substituted (T1, T4 to T9); build and the default suite pass (T3); the slow-group in-progress test passes (T10). The soak on the deploy path is M28.

##### Dependencies And Decisions

- Owner decision (2026-09-26): take the item into this register at aa-env's request.
- Related: aa-env's register records this item as handled here.
- Cause (2026-09-27): ETL runs one job per PV with no global job that has a start and an end, and the metric adds each PV's duration to one sum that resets only after a 15-minute gap; the per-PV jobs of a 5-minute partition leave no such gap. Confirmed against the soak figures above.
- Observation (2026-09-27, read in the source, not yet run): PBThreeTierETLPVLookup computes each PV's initial delay as Duration.between(nextExpectedETLRunInSecs, currentTime) (line 180), which is negative while the expected run is in the future and is clamped to zero by the executor, so a job starts when its PV is registered instead of at the predictable time the comment describes; that spreads the per-PV jobs over the period and removes any gap in which the sum could reset.
- Owner decision (2026-09-27): fix the metric rather than only document it; tracked as #11.
- Owner decision (2026-09-27): replace the per-PV timers with a pass driver per the design; the design's Decisions table D1 to D15 records the rulings (driver key, processing time, tick, metrics keys, skip-store scope, shutdown bound, failure definition, consolidation queue, slow-group test, removal of the per-index sums).
- Design review (2026-09-27): two lane rounds, two paired debates and a bounded fresh-context check; closure report accepted 2026-09-27 20:07 (session work/review_sessions/20260927_160405_etl-pass-scheduler, removed after the closure commit; the design document carries the decisions).
- Finding and owner decision (2026-09-28, step 2): on the real PlainPB path a source whose root folder is a regular file lists as empty without an exception, so the design's unreadable-source test case cannot fail as written; the case is dropped from T6 and the design states the limit; the failure condition on an incomplete listing stays for other listing errors.
- Step 3 result (2026-09-28): PBThreeTierETLPVLookup takes a Clock and an environment reader (the one-argument constructor passes Clock.systemUTC() and System::getenv), and its two existing reads, the current time for the initial delay and ARCHAPPL_SKIP_ETL_FOR_STORE, go through them with the same production values, so the seams are exercised now rather than left unused until step 5; ETLLookupClockAndEnvironmentTest checks the skip, the unset variable and the clock-derived initial delay (-480 s at a fixed 00:02:00). The test log4j configuration uses asynchronous loggers, so a test that reads a log line waits for it within a bound. ./mvnw -B -ntp clean verify on the step 3 tree: 793 tests, 0 failures (08:02 to 08:15 UTC).
- Step 4 result (2026-09-28): ETLPassRecord, ETLPassDriver and ETLPassTicker as new classes, not yet wired; the busy time of a job is measured by the driver around ETLJob.run() rather than taken from the job's own duration, because the job records no duration when its source listing fails.
- Step 5 result (2026-09-28): PBThreeTierETLPVLookup creates the drivers, the ticker and one worker thread per transition index in postStartup; the per-PV futures are gone; deleteETLJobs (called by pause and by delete) removes the PV from its drivers and then, index by index, runs its consolidation on the worker thread of that index (between the jobs of the pass when one is running) and waits for it, or runs it on the calling thread once the workers are stopped; shutdown reads ETLPassStopWaitSeconds from the installation properties; ETLDetails reads the next-job time from the driver; ETLMetrics rows and keys come from the records; ETLMetricsForLifetime keeps only getLifeTimeId and the FileStore cache. ETLLookupClockAndEnvironmentTest reads the planned time of the start-up pass in place of the initial delay of step 3. The first mutation check of ETLLookupPassTest found two assertions that held without the consolidation, because the passes had already moved every closed partition; the delete and shutdown tests were changed to append samples into the open partition after the last pass and read the last event in the destination, after which each of four mutations (delete-time consolidation removed, shutdown consolidation removed, the skip check of the delete-time consolidation removed, the skip branch of the shutdown removed) fails exactly its own test. The nine test classes of org.epics.archiverappliance.etl that this item did not change pass in the same run.
- Step 6 result (2026-09-28): ETLPassInProgressTest, tagged slow, drives the lookup over 64 PVs each holding a day of 5-minute partitions at one sample per second (18432 partitions); a pass over that fixture is busy for 2.6 to 2.9 s. The cost of a job is set by its partition count, not its bytes: a first fixture of 16 PVs and 6 hours ran in 0.2 to 0.3 s whether it held 5 MB or 64 MB. The slow tag keeps the class out of the default suite and of the Maven workflow, which run clean verify with the default groups. ./mvnw -B -ntp clean verify on the step 6 tree: 805 tests, 0 failures, BUILD SUCCESS (15:45 to 16:00 UTC), the class compiled and not selected.
- Step 7 result (2026-09-28): docs/book/src/configuration.md describes ARCHAPPL_SKIP_ETL_FOR_STORE as skipping every ETL job into the named store (the jobs of a pass, the consolidation on pause and delete, and the consolidation at shutdown), the ERROR lines each skip leaves, and the restart of the etl instance that a change of the variable needs; the book builds with the pinned image (mdBook 0.4.52, 17:19 and 17:34 UTC) and the page renders. The archappl.properties table of that page lists only keys set in the default site's file, which carried neither ETLPassWorkers nor ETLPassStopWaitSeconds; on the owner's decision below both are set there at their code defaults (1 and 60, each with a comment) and listed in the table. The tests read src/sitespecific/tests, not the default site, so the default suite was not rerun for this step; the step 8 run covers the tree.
- Owner decision (2026-09-28): widen step 7 to the two ETL pass properties, set in the default site's archappl.properties at the code defaults and listed on the configuration page, so that a deployment finds ETLPassStopWaitSeconds where it sizes the unit's stop timeout.
- Step 8 result (2026-09-28): clean verify and the Maven workflow pass on the pushed tree 6e2fda20 (T3); with T1 to T10 recorded, the eight steps are done and the item is Complete. M28 (the soak on the deploy path) is Ready and waits for the owner's acceptance of its plan before LAB-ansible-provision is asked.
- Owner decision (2026-09-28): the plan is ordered so that new classes are built and tested before one cut-over commit, each step leaving the default suite green; the before-evidence of step 1 is a temporary test on HEAD that is not committed, its values and source path recorded in T2.
- Owner decision (2026-09-27): the soak on the deploy path is its own item, M28, depending on this item and on G4, so this row is not Blocked while the code is written; the design's Register sentence that made the soak gate M25 is superseded by that split (the design text is aligned in the same commit).
- Owner decision (2026-09-27): the two test gaps the design review carried forward (the Current pass and Weekly usage rows; the shutdown consolidation under the skip store) are covered here by T10, T5 and T9, extending the design's Testing items 11, 3 and 7.
- GitHub (2026-09-28): #11 title and body re-projected to this scope under Issue scope.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-09-28, owner acceptance of the eight-step plan committed at d4ee97bc
Implementation Authorization: 2026-09-28, owner authorization of the same plan
Superseded Plan Artifacts: the investigation plan of 2026-09-26 (find what the job time grows with) and the metric-fix plan of 2026-09-27 (pass delimiter, reproduce, initial delay), both answered by the design; the first pass-driver plan of 2026-09-27 (driver before job reporting, futures removed before the cut-over), reordered 2026-09-28

Each step is one commit and ends with the default suite green. The only failing-before evidence is step 1: the driver and the pass record are new classes, so their tests are acceptance tests that cannot run on HEAD.

1. Before-evidence on HEAD, with no code change: run a temporary test on the HEAD tree (not committed) that runs ETLJob several times over PlainPB stores with a 5-minute source partition and reads the ETL(0>1) last-job value after each run, then registers one PV and, within a bounded wait until the run count reads 1, reads getNumberofTimesWeETLed, the DEBUG initialDelay line of addETLJobs and getCancellingFuture().getDelay. Record the values, the HEAD commit, and the method in enough detail to rerun it (fixture granularity, number of runs, the log line read) in Verification Results. Closes with T2.
2. ETLJob reporting, behavior unchanged: whether getETLStreams completed, streams returned, partitions moved (appended and committed), their bytes, streams deleted for space, and the commit result, stored on ETLPVLookupItems; the existing writes into ETLMetricsForLifetime stay until step 5. Closes with T6 (job part) and T3.
3. The Clock and environment-reader seams, added beside the current code paths without changing them. Closes with T3.
4. ETLPassDriver, ETLPassTicker and the pass record as new classes, not yet wired into PBThreeTierETLPVLookup; their tests drive them directly over PlainPB stores. Closes with T1, T4, T5 (record part) and T6 (pass part).
5. Cut-over: PBThreeTierETLPVLookup creates the drivers, the ticker and one worker thread per transition index in postStartup and keeps the sticky test stop; the per-PV futures go; pause and delete queue their consolidation on the worker thread; the shutdown order with ETLPassStopWaitSeconds; ETLDetails reads the next-job time from the driver; ETLMetrics rows and keys come from the records; ETLMetricsForLifetime keeps only getLifeTimeId and the FileStore cache. Closes with T5 (rows part), T7, T8, T9 and T3, with every existing ETL test still passing.
6. The slow-group in-progress test. Closes with T10.
7. Book page: docs/book/src/configuration.md line 29, which describes ARCHAPPL_SKIP_ETL_FOR_STORE, gains the widened skip; no book page lists the ETL metrics rows. Closes with T3.
8. ./mvnw -B -ntp clean verify and the Maven workflow on the pushed commit; then M28 is handed to LAB-ansible-provision. Closes with T3.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit, real jobs | Design Testing item 1: driver over PlainPB stores with a test Clock, ticks across three boundaries on a 5MIN and a 15MIN source, a stepping Clock for the overrun case | JDK 21, wrapper Maven | plannedAt, processingTime and the moved partition per pass as planned; the start-up pass first; overrun recorded; a backwards Clock reschedules |
| T2 | Before-evidence on HEAD | Design Register, run as a temporary test on the HEAD tree and not committed (owner decision 2026-09-28): the last-job value over several passes of a 5-minute source; after one registration, within a bounded wait until the run count reads 1, the DEBUG initialDelay and getDelay | JDK 21, wrapper Maven, HEAD before the change | The value grows with each pass; initialDelay negative in the log, run count 1, getDelay between cadence minus the job duration and cadence |
| T3 | Integration | ./mvnw -B -ntp clean verify | JDK 21, wrapper Maven | Build and the default suite pass |
| T4 | Unit, real jobs | Design Testing item 2: index 0 and index 1 due at the same tick | JDK 21, wrapper Maven | The index-1 pass starts after the index-0 pass ended; plannedAt unchanged |
| T5 | Unit, real jobs | Design Testing item 3, extended: several PVs over two passes; ETLMetrics.details and metrics() read afterwards; the Weekly usage row after passes on two Clock days (record part: the record sums, slowest PV, max partitions and busyMillis; rows part: ETLMetrics.details and metrics() and the Weekly usage row) | JDK 21, wrapper Maven | Record sums, slowest PV, max partitions and busyMillis match the jobs; Passes so far 2; the average and the three keys from the records; the Weekly usage row equals the per-day totals over the counted seconds |
| T6 | Unit, real jobs | Design Testing item 4: destination root as a regular file | JDK 21, wrapper Maven | The pass completes, jobsFailed counts the job, nextPlannedAt set; a usable folder reports a skip (job part: the ETLJob reports streams returned larger than partitions moved; pass part: the pass completes, jobsFailed counts it, nextPlannedAt set) |
| T7 | Unit, real jobs | Design Testing item 5: PV added between passes; PV registered after the start-up pass; deleteETLJobs between passes | JDK 21, wrapper Maven | In the next snapshot; joins the next planned pass; absent and consolidated |
| T8 | Unit, real jobs | Design Testing item 6: environment reader returns the destination name unique to the test | JDK 21, wrapper Maven | No job writes to it in a pass or in the consolidation on delete; jobsSkipped counts the PVs |
| T9 | Unit, real jobs | Design Testing item 7, extended: stop flag on an idle driver with ETLPassStopWaitSeconds 0; then the same with the environment reader returning the destination store name | JDK 21, wrapper Maven | A following tick starts no pass; the consolidation runs for every PV; with the skip set, the shutdown consolidation writes nothing to the named store and logs the count of PVs left unconsolidated |
| T10 | Unit, real jobs, slow group | Design Testing item 11 with ./mvnw -B -ntp test -Dtest.groups=slow -Dtest.excludedGroups=integration,localEpics,flaky | JDK 21, wrapper Maven | (a) to (d) as the item states, (d) being the Current pass row read from the record in progress; a run whose precondition did not hold reports inconclusive |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-28 08:47 UTC | OpenJDK 21.0.12.1, wrapper Maven, step 4 working tree on 9554df94 | Pass | ETLPassDriverTest over real PlainPB stores and the shipped ETLJob, with a settable test clock: a 5MIN source at index 0 runs the start-up pass planned at its start (processing time start minus 60 s, the partition closed at 00:05 moved), none before 00:10, then passes at 00:10 (nothing new) and 00:15 (the partition closed at 00:10); a 15MIN source plans 00:35 after a start at 00:20; a clock stepping 400 s per read records an overrun and the next planned time lands on the grid after the end; a tick before the last start reschedules to the grid after that tick. Mutations checked: offset 0 fails 1 test, margin 30 s fails 2. ./mvnw -B -ntp clean verify on the same tree: 800 tests, 0 failures, BUILD SUCCESS (08:32 to 08:47 UTC). |
| T2 | 2026-09-28 05:03 to 05:04 UTC | OpenJDK 21.0.12.1, wrapper Maven, HEAD d4ee97bc, no code change | Pass | A temporary JUnit test on the HEAD tree (not committed): STS PlainPB PARTITION_5MIN, MTS PARTITION_HOUR, default hold; (1) 50 PVs registered through ConfigServiceForTests, then manualControlForUnitTests, one 1 Hz sample per second over four 5-minute partitions from the start of the year, ETLExecutor.runETLs three times as of year start plus 5 min 10 s, 10 min 10 s and 15 min 10 s, reading ETLMetricsForLifetime(0).getApproximateLastGlobalETLTimeInMillis after each: 5 ms after the registration runs, then 70, 102, 115 ms against per-pass job sums of 65, 32, 13 ms; every value equalled the running sum of all jobs so far, while every pass moved one partition for all 50 PVs; (2) one PV registered with an appender capturing PBThreeTierETLPVLookup at DEBUG: within the bounded wait the run count read 1 (job 3 ms), the log read "Scheduled ETL job for ... with initial delay of -366 and between job delay of 300", and getCancellingFuture().getDelay read 299 s. Both assertions held (surefire: 2 tests, 0 failures). The method above is enough to rerun it; the test source is not kept. |
| T3 | 2026-09-28 17:42-17:58 UTC (local), 17:39-18:00 UTC (CI) | OpenJDK 21.0.12.1, wrapper Maven, the pushed tree 6e2fda20; the Maven workflow on ubuntu-24.04 with JDK 21 | Pass | ./mvnw -B -ntp clean verify on 6e2fda20: 805 tests, 0 failures, BUILD SUCCESS; the etl and mgmt WARs of that build carry ETLPassWorkers=1 and ETLPassStopWaitSeconds=60 in WEB-INF/classes/archappl.properties (unzip -p). Maven workflow run 36459700615 on 6e2fda20: success, job Build and test on JDK 21 from 17:39:44 to 18:00:19 UTC (gh run view). Each earlier code step's tree also passed the default suite, as the step lines above record (step 7 changed no code and was not rerun), and the workflow run on each pushed register commit succeeded (c112d13c 36399841867, d8a7813f 36441761981, 69030894 36456937111). |
| T4 | 2026-09-28 08:47 UTC | OpenJDK 21.0.12.1, wrapper Maven, step 4 working tree on 9554df94 | Pass | ETLPassTicker with index 0 and index 1 drivers due at one tick: only index 0 starts; the next tick starts index 1 with its planned time unchanged and its start not before the end of index 0. Removing the ordering rule fails the test. ./mvnw -B -ntp clean verify on the same tree: 800 tests, 0 failures, BUILD SUCCESS (08:32 to 08:47 UTC). |
| T5 | 2026-09-28 08:47 UTC (record part), 09:47 UTC (rows part) | OpenJDK 21.0.12.1, wrapper Maven, step 4 working tree on 9554df94 (record part), step 5 working tree on c112d13c (rows part) | Pass | Record part: two PVs with 15 and 5 minutes of data: 2 jobs, 0 failed, 3 partitions moved, max 2 by one PV, bytes above 0, busy time not below the slowest job; a second pass on the next clock day gives 2 completed passes, the busy total as the sum of the two records, and the weekly usage equal to the busy total over the seconds since the first counted day. ./mvnw -B -ntp clean verify on the same tree: 800 tests, 0 failures, BUILD SUCCESS (08:32 to 08:47 UTC). Rows part: ETLLookupPassTest through the lookup with two PVs of 15 minutes of data, a pass at 00:12 and one on the next clock day: Passes so far 2, the average busy time as the mean of the two records, the last pass busy time and partitions moved from the second record, Current pass none, the Weekly usage row as the driver's value (its derivation is the record part), and the keys totalETLRuns(0) 2, timeForOverallETLInSeconds(0) as the busy total in seconds and maxETLPercentage as the second record's busy time as a percent of the 300 s cadence. ./mvnw -B -ntp clean verify on the step 5 tree: 805 tests, 0 failures, BUILD SUCCESS (09:32 to 09:47 UTC). |
| T6 | 2026-09-28 07:37 UTC (job part), 08:47 UTC (pass part) | OpenJDK 21.0.12.1, wrapper Maven, step 2 working tree on ab99a598 | Pass | ETLJobRunReportTest over real PlainPB stores: a normal move reports 2 streams returned, 2 moved, bytes above 0, commit succeeded; a destination root that is a regular file reports 2 returned and 0 moved; 2 tests, 0 failures. ./mvnw -B -ntp clean verify on the same tree: 790 tests, 0 failures, BUILD SUCCESS (07:24 to 07:37 UTC). Pass part: a driver with one PV into a good store and one into a destination root that is a regular file runs 2 jobs, counts 1 failed, and sets its next planned time. ./mvnw -B -ntp clean verify on the same tree: 800 tests, 0 failures, BUILD SUCCESS (08:32 to 08:47 UTC). |
| T7 | 2026-09-28 09:47 UTC | OpenJDK 21.0.12.1, wrapper Maven, step 5 working tree on c112d13c | Pass | ETLLookupPassTest: one PV with 10 minutes of data registered before the start-up pass at 00:12 (1 PV counted); a second PV registered after it joins the same driver and the 00:15 pass counts 2; deleteETLJobs of the first between passes removes it from the driver and its consolidation moves the samples appended into the open 00:15 partition (last destination event at second 1199 into the year, 599 before), and the 00:20 pass counts 1. Mutation: the delete-time consolidation removed fails the test (599 in place of 1199). ./mvnw -B -ntp clean verify on the step 5 tree: 805 tests, 0 failures, BUILD SUCCESS (09:32 to 09:47 UTC). |
| T8 | 2026-09-28 09:47 UTC | OpenJDK 21.0.12.1, wrapper Maven, step 5 working tree on c112d13c | Pass | ETLLookupPassTest with the environment reader returning MTS, the destination name of the test: a pass over two PVs counts 2 skipped and 0 run; deleteETLJobs of one PV runs no consolidation job (no run report) and neither PV reaches the MTS. Mutation: the skip check of the delete-time consolidation removed fails the test (a run report with 2 partitions moved). ./mvnw -B -ntp clean verify on the step 5 tree: 805 tests, 0 failures, BUILD SUCCESS (09:32 to 09:47 UTC). |
| T9 | 2026-09-28 09:47 UTC | OpenJDK 21.0.12.1, wrapper Maven, step 5 working tree on c112d13c | Pass | ETLLookupPassTest with ETLPassStopWaitSeconds 0: after a pass at 00:12, shutdown() flags the driver so a tick at 00:15 starts no pass, and the shutdown consolidation moves the samples appended into the open partition of both PVs (last destination event at second 1199); with the reader returning MTS, the same shutdown writes nothing to the MTS and the ERROR line "2 PVs left unconsolidated in store STS at shutdown" is read within a 10 s bound. Mutations: the shutdown consolidation removed fails the first case (599 in place of 1199); the skip branch of the shutdown removed fails the second (the MTS holds data). ./mvnw -B -ntp clean verify on the step 5 tree: 805 tests, 0 failures, BUILD SUCCESS (09:32 to 09:47 UTC). |
| T10 | 2026-09-28 15:42 and 15:44 UTC | OpenJDK 21.0.12.1, wrapper Maven, step 6 working tree on d8a7813f, the slow-group command of the Test Plan with -Dtest=ETLPassInProgressTest | Pass | ETLPassInProgressTest: 4 tests, 0 failures, none inconclusive, in two consecutive runs. (a) A PV two positions past the cursor, deleted while the pass ran, held every partition in the destination when the call returned, the pass was still open, and the closed record counts 63 jobs run and 1 skipped, naming that PV. (b) With ETLPassStopWaitSeconds 0, shutdown() closed the record as aborted with 2 jobs run, at most one more than before the call; a later tick started no pass; every PV but the one running at the flag held every partition afterwards. (c) The PV at the cursor, deleted during its own job (position 1 in both runs), was run once and not skipped, its consolidation returned, and the destination holds its 86400 events once. (d) While the pass ran, the Current pass rows read the started-at time of the record in progress, an elapsed value, and n of 64 with n between the two reads of the record. The whole slow group on the same tree (16:01 to 16:16 UTC): 7 classes, 12 tests, 1 failure, ZipETLTest.testETLIntoZipPerPV reading back 31534907 of 31536000 events; it fails with the same count on d4ee97bc, before any code of this item, so it is not an effect of this item; ETLPassInProgressTest passed in that run as well (4 tests). |

##### Closure Evidence

- Design: docs/design-etl-pass-scheduler.md at 4a964b08 (draft 3, review closed 2026-09-27), aligned at ed16a99d.
- Design review session work/review_sessions/20260927_160405_etl-pass-scheduler removed from the working tree on 2026-09-28 after its closure report was accepted and the design and register landed (4a964b08, ed16a99d); work/ is gitignored, so the removal is local and this line is its record.
- Deliverable, landed on modernize (origin at 6e2fda20 on 2026-09-28): the job report 44be9dc5 (step 2); the clock and environment seams 327d65af (step 3); the driver, ticker and record 38914963 (step 4); the cut-over d04e4a08 (step 5); the slow-group test c939a7d4 (step 6); the configuration page and the default site properties 5ddd9ba1 (step 7); the design limit c78c7922; the register at d4ee97bc, ab99a598, 9554df94, c112d13c, d8a7813f, 69030894 and 6e2fda20.
- Verification: T1 to T10 Pass (T2 as the before-evidence on d4ee97bc); the default suite green on every step's tree and the Maven workflow green on every pushed commit (T3).
- Issue #11 closed 2026-09-28T18:06:48Z (reason completed) under Issue scope, after its body was brought in line with the landed steps; observed closed the same day (GitHub Projection).

##### GitHub Projection

Title: Replace the per-PV ETL timers with one pass driver per transition
Labels: bug
GitHub Milestone: none
Observed State: closed
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-09-28 (gh issue view 11 --repo jeonghanlee/epicsarchiverap-maven --json state,closed,closedAt,labels,milestone,assignees,updatedAt: closed 2026-09-28T18:06:48Z, bug, no milestone, assignee jeonghanlee; the close ran with --reason completed; the body was re-projected under Issue scope the same day with the landed commits and the checked acceptance list, and the close comment names them)

#### M26 - etl error bursts and mgmt workflow tick logging

Origin: daff1b7 / M26
Identity History: none
GitHub Issue: [#20](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/20)
Status: Not started

##### Summary

The same soak test measured two further application log sources. While the MTS tree could not be written for 10 minutes, etl logged ERROR "Exception processing <STS partition>" with a full stack trace once per partition per ETL pass (ETLJob.java line 205): 2709 records, 10836 lines and about 5 MB in 10 minutes, with peaks of 808 and 1616 lines per minute; ETL cleared the backlog within 15 minutes of the restore. mgmt writes two INFO lines per archive PV workflow tick, one of them "Running the archive PV workflow with N requests pending" (MgmtRuntimeState.java line 162), about 800 lines per hour regardless of PV count. Under the journald model of D31 both share the retention cap with the lines an operator needs.

##### Scope

Bound the etl error output while a store cannot be written, and quiet the mgmt workflow tick lines, keeping one clear ERROR for a failing store and the workflow lines at DEBUG.

Out of scope: the retrieval per-request lines (M24); engine and CA client logging; the cause of a store failure.

##### Completion Criteria

- With a store made unwritable on the real ETL path, etl reports the failure in the form settled in step 1 instead of one stack trace per partition per pass, and a deployed mgmt at the default level no longer writes the tick lines settled in step 1; build and the default suite pass.

##### Dependencies And Decisions

- D31 (journald collects).
- Owner decision (2026-09-26): take the item into this register.
- Closure ordering: the default suite of T3 passes only after M27, because ETLPostProcessorTest fails until then; work can start now.
- Open for the plan: the reproduction environment for T1, a local run of the real ETL or the ansible-provision lab VM with aa-env's deploy path.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Settle with the owner how a failing store is reported (for example one ERROR per store per pass with the partition count, and the stack trace at DEBUG) and which mgmt tick lines move to DEBUG.
2. Reproduce both on the real path, change the logging, and verify.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Make the MTS unwritable during a real ETL pass and count the etl ERROR records per pass before and after the change | JDK 21; the environment left open for the plan | Before, one record with a stack trace per partition; after, the agreed bounded report |
| T2 | Integration | Count the mgmt workflow tick lines of a deployed mgmt at the default level before and after the change | Tomcat 9, integration profile | Before, lines on every tick; after, none of the settled lines |
| T3 | Integration | ./mvnw -B -ntp clean verify | JDK 21, wrapper Maven | Build and the default suite pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21 | Pending | none |
| T2 | Not run | Tomcat 9, integration profile | Pending | none |
| T3 | Not run | JDK 21, wrapper Maven | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Bound ETL storage-error logging and quiet management workflow ticks
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-09-30 09:40:26 UTC; issue #20 read back with matching title and body, assignee jeonghanlee and no GitHub milestone. Recheck with gh issue view 20 on jeonghanlee/epicsarchiverap-maven.

#### M27 - Reduced bins missing after ETL with a post-processor

Origin: daff1b7 / M27
Identity History: none
GitHub Issue: #9
Status: Complete

##### Summary

ETLPostProcessorTest.testPostProcessorDuringETL writes five days of 1 Hz samples to an STS, runs ETL into an MTS whose URL carries a firstSample post-processor, and expects the reduced stream to hold one sample per 900 s bin, within 10 bins. On 2026-09-26 the reduced stream fell short by a growing number of bins: at 20:40 UTC the run passed with 376 of 384 bins on day 3 and 472 of 480 on day 4; from 21:25 UTC every run failed with 368 of 384 on day 3 (the default suite, five reruns, and a run on the HEAD source f2c35e0b with no working-tree change). The test data are deterministic, so the missing bins come from the ETL or post-processor path, or from the test's timing (it sleeps 2 ms between runs where its comment asks for a couple of seconds so that modification times differ). The default suite does not pass while this test fails.

##### Scope

Find why reduced bins go missing and fix the cause, in the code or in the test.

Out of scope: the ETL last-job metric (M25).

##### Completion Criteria

- The cause of the missing bins is identified on the real path; the fixed code or test gives the expected bin count on repeated runs, and the default suite passes.

##### Dependencies And Decisions

- Owner decision (2026-09-26): investigate as its own item; found by the M24 / T2 run.
- Cause (2026-09-26 23:03 UTC, from the files the failing run left in target/test-storage/mts/ETLPostProcessorTest/dest): the reduced files of 2026-01-02 and 2026-01-04 held 88 of 96 bins, missing exactly the last two-hour ETL run of the day, and on both days the raw .pb and the .firstSample file carried the same modification time to the nanosecond (for example 1790457857.775069840 for both), while on the complete days the reduced file was newer. PlainPBStoragePlugin regenerates a PP file only when the raw file is strictly newer (the rawPathTime.compareTo(ppPathTime) > 0 test in getListOfPathsWithMissingOrOlderPostProcessorData, PlainPBStoragePlugin.java line 1160, the comparison at line 1199 before the fix and 1201 after it), and file times advance with the kernel clock tick (CONFIG_HZ=250, about 4 ms on the build host) while the test sleeps 2 ms between ETL runs, so a raw append in the same tick as the previous PP write was taken as already reduced. The other two file-time uses in PlainPBStoragePlugin compare a file's age against the ETL hold, not two files, and do not share the assumption.
- Reach (2026-09-26): observed only in this test; no missing PP data was reported from a deployed appliance. It needs a raw append in the same clock tick as the previous PP write of the same partition, and a deployed ETL runs once per source partition period (minutes), so it is expected to be rare outside a test that runs ETL back to back; this is an expectation, not a measurement.
- Owner decision (2026-09-26): fix the code, not the test: treat an equal time as not up to date, because an equal time does not show that the PP file holds the latest raw data.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-09-26, owner direction to proceed with step 1 and to take the code fix in step 2
Implementation Authorization: 2026-09-26, the same owner direction
Superseded Plan Artifacts: none

1. Reproduce the shortfall and find which bins are missing and why. Done: see Cause above.
2. Change the check in getListOfPathsWithMissingOrOlderPostProcessorData in PlainPBStoragePlugin from compareTo > 0 to compareTo >= 0. Closes with T1 and T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit | ETLPostProcessorTest repeated at least five times after the fix | JDK 21, wrapper Maven | The reduced count matches the expected bins on every run |
| T2 | Integration | ./mvnw -B -ntp clean verify | JDK 21, wrapper Maven | Build and the default suite pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-27 02:17 UTC | JDK 21, wrapper Maven | Pass | Before the fix the test failed on every run (368 of 384 on day 3); after it, eight consecutive runs from 02:15 UTC passed with the exact bin count every day, 480 of 480 on day 4 |
| T2 | 2026-09-27 02:30 UTC | JDK 21, wrapper Maven; the fix applied on a766de08 | Pass | ./mvnw -B -ntp clean verify: 788 tests, 0 failures, 0 errors; BUILD SUCCESS; ETLPostProcessorTest gave 480 of 480 reduced events on day 4 |

##### Closure Evidence

- 9c46ce3d (the fix) and 7d2337f9 (this register) are ancestors of the fetched origin/modernize (7d2337f9); the Maven workflow run 36289020914 on 7d2337f9 succeeded.
- #9 was updated with the root cause and closed as completed at 2026-09-27T03:00:01Z (gh issue view 9 --repo jeonghanlee/epicsarchiverap-maven --json state,closedAt).

##### GitHub Projection

Title: Fix the reduced bins missing after ETL with a post-processor
Labels: bug
GitHub Milestone: none
Observed State: closed
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-09-27 (gh issue view 9 --repo jeonghanlee/epicsarchiverap-maven --json state,labels,milestone)

#### M28 - ETL pass scheduler soak on the deploy path

Origin: daff1b7 / M28
Identity History: none
GitHub Issue: #12
Status: In progress

##### Summary

The pass scheduler of M25 changes when ETL runs, how the appliance stops, and what the metrics page reports. Those effects are observable only on a deployed appliance: the ansible-provision lab runs aa-env's deploy path on a VM (M13 Dependencies, G4). This item is the soak of the landed M25 code on that path, compared with the run of 2026-09-24 to 2026-09-26 that found the running-sum metric, through the mapping of retired rows to new rows in docs/design-etl-pass-scheduler.md, Testing item 10.

##### Scope

Run the soak on the soak chain (STS PARTITION_5MIN, MTS PARTITION_HOUR) and on the aa-env default chain (STS PARTITION_HOUR, MTS PARTITION_DAY); read the per-pass records from the etl log and the ETL metrics rows over the run; measure the stop time of the unit; record the comparison table.

Out of scope: the code and unit tests (M25); aa-env's store variables; host sizing.

##### Completion Criteria

- On both chains the passes fire on the grid of the design (boundary plus 5 min x (transition index + 1), within one tick), the reported rows read as the design states, no overrun is recorded under the soak load, the stop of the unit stays within aa-env's TimeoutStopSec, and the comparison table is recorded here.

##### Dependencies And Decisions

- Owner decision (2026-09-27): split from M25 so that M25 is not Blocked while the code is written; supersedes the design's Register sentence that made the soak gate M25.
- Depends on M25 (the code) and G4 (the deploy path); resume as Not started when both are Complete.
- G4 Complete (2026-09-28): this row resumed as Not started; it is not Ready until M25 is Complete.
- M25 Complete (2026-09-28, 6e2fda20): this row is Ready; its plan is a draft that needs the owner's acceptance and implementation authorization before step 1.
- Plan review (2026-09-28): the metrics rows alone cannot show that a pass started within one tick of its grid time, because the "late by (s)" row carries a value only past one cadence (ETLPassDriver.java line 414) and hourly samples of "Last pass started at" see one pass in twelve; the driver logs every closed record at DEBUG (line 317), which the mgmt setLogLevel BPL of M20 turns on for one logger at run time. The comparison with the run of 2026-09-24 to 2026-09-26 (903 PVs, 0.69 s of busy time per pass, 0.18 % weekly usage) needs a comparable PV count and a run across a UTC midnight, which the draft did not state.
- Owner decision (2026-09-28): observe through the per-pass DEBUG lines of org.epics.archiverappliance.etl.common.ETLPassDriver in the etl journal, raised through setLogLevel for the run, plus the metrics rows sampled hourly; the soak chain carries about 900 PVs as the earlier run did and the default chain aa-env's default PV set; each chain runs at least 24 h across a UTC midnight; the two chains run in parallel on two hosts when the lab has them, else in sequence, at the lab's choice.
- Step 1 started (2026-09-28): the request was sent to LAB-ansible-provision by cross-session message after the plan was accepted and authorized; this row is In progress until its report is recorded.
- To confirm with LAB-ansible-provision in the request: the partitions of aa-env's default chain (taken from the design as STS PARTITION_HOUR, MTS PARTITION_DAY), and whether the deployed archappl.properties comes from the aa-maven default site (which sets ETLPassWorkers and ETLPassStopWaitSeconds since 5ddd9ba1) or from an aa-env template; the behavior is the same either way, since the code defaults are the same values.
- aa-env is told the stop-time measurement so that SYSTEMD_TIMEOUT_STOP_SECONDS is sized against it (design, Deployment).

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-09-28, owner acceptance of the two-step plan as revised by the plan review of the same day
Implementation Authorization: 2026-09-28, owner authorization of the same plan
Superseded Plan Artifacts: the draft of 2026-09-27 (hourly rows and one measured stop, without the per-pass records, the PV count and the run length)

1. Ask LAB-ansible-provision for the soak on its deploy path with aa-maven pinned at 3bdf378c (archiver_maven_src_tag; the code is unchanged since 5ddd9ba1) and aa-env at d09dca7a or later: the soak chain (STS PARTITION_5MIN, MTS PARTITION_HOUR) with about 900 PVs as in the run of 2026-09-24 to 2026-09-26, and the aa-env default chain with aa-env's default PV set, each for at least 24 h across a UTC midnight, in parallel on two hosts or in sequence at the lab's choice. Observation on each host: the etl logger org.epics.archiverappliance.etl.common.ETLPassDriver at DEBUG through the mgmt setLogLevel BPL for the whole run, so that every pass leaves its record in the journal; the ETL rows of the metrics page sampled hourly; one measured systemctl stop of the unit at the end, with the unit's TimeoutStopSec noted. The request also asks the two confirmations listed under Dependencies And Decisions. Closes with T1.
2. Record here, per chain: the grid check from the per-pass lines (plannedAt on the boundary plus 5 min x (transition index + 1), startedAt within one tick of it, overrun false throughout), the comparison table of the design's Testing item 10 against the earlier run (busy time of a pass, weekly usage), the sampled rows, and the stop time against TimeoutStopSec; send the stop time to aa-env for SYSTEMD_TIMEOUT_STOP_SECONDS. Closes with T1.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Soak | Design Testing item 10 on the ansible-provision lab: two chains of at least 24 h across a UTC midnight, the soak chain with about 900 PVs; the per-pass DEBUG records of ETLPassDriver in the etl journal plus the metrics rows sampled hourly; one measured stop of the unit per chain | Lab VMs through the deploy path (G4), aa-maven 3bdf378c, aa-env d09dca7a or later | Every pass planned on the grid and started within one tick (5 s) of its planned time, no overrun; the rows of the design present with the values of the records; the busy time per pass and the weekly usage compared with 0.69 s and 0.18 % of the earlier run; the stop within the unit's TimeoutStopSec; the comparison table recorded |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | Lab VM through the deploy path | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Soak the ETL pass scheduler on the deploy path
Labels: enhancement
GitHub Milestone: none
Observed State: open
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-09-28 (gh issue view 12 --repo jeonghanlee/epicsarchiverap-maven --json title,state,labels,assignees)

#### M29 - Remaining per-request retrieval INFO lines

Origin: daff1b7 / M29
Identity History: none
GitHub Issue: #13
Status: Complete

##### Summary

After d9250d23 (M24) a single-PV retrieval request still writes about four INFO lines (DataRetrievalServlet 491, MergeDedupConsumer 211, PBOverHTTPStoragePlugin 70, and RetrievalState 108 whenever a store holds data older than the request start), five when a store returns an empty stream (MergeDedupConsumer 179): DataRetrievalServlet "For the complete request, found a total of ..." (line 491 at HEAD), MergeDedupConsumer "Found a total of ... deduping involved ..." (line 211) and "was an empty stream" (line 179, rare), PBOverHTTPStoragePlugin "URL to fetch data is ..." (line 70, naming the engine address), and RetrievalState "Found a data source ... older than the request start time" (line 108); the multi-PV path has the same two lines at DataRetrievalServlet 1051 and PBOverHTTPStoragePlugin 85. The soak of 2026-09-24 to 2026-09-26 measured about eight INFO lines per request before M24 (350263 lines for 42610 requests over 6 h); M24 removed three. Under the journald model of D31 the remaining lines still push out warnings and errors at load.

##### Scope

Decide for each of the five call sites whether it logs at DEBUG or is wanted at INFO, and change the ones that move.

Out of scope: the access log; engine and CA client logging; the etl ERROR bursts (M26).

##### Completion Criteria

- Each of the five call sites logs at DEBUG or has a recorded reason to stay at INFO; a deployed retrieval WAR at the default level writes no per-request line other than those recorded to stay at INFO, for a plain single-PV request (no function-call syntax, no .VAL suffix, no post-processor; the conditional lines at DataRetrievalServlet 801 and 814 and PlainPBStoragePlugin 313 are outside this item); build and the default suite pass.

##### Dependencies And Decisions

- Origin: LAB-ansible-provision pattern counts of 2026-09-27 (not yet posted to an issue), compared against d9250d23 by class and line.
- Owner decision (2026-09-28): tracked as its own item rather than by reopening M24.
- Decision Date: 2026-10-03. All five per-request lines move to DEBUG, none stays at INFO. The same messages on the multi-PV and PVAccess retrieval paths move with them: DataRetrievalServlet line 1051, PvaGetPVData lines 429 and 970, and PvaMergeDedupConsumer lines 126 and 204 (line numbers at 61c0c79b; the five lines are DataRetrievalServlet 491, MergeDedupConsumer 186 and 218, PBOverHTTPStoragePlugin 69 and 84, and RetrievalState 108). RawDataRetrievalAsEventStream, GetEngineDataAction and RetrievalServlet are outside the retrieval WAR's request path and stay unchanged.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-10-03, this plan with the decision above and the T1 method below
Implementation Authorization: 2026-10-03, implement and verify this plan
Superseded Plan Artifacts: the earlier draft T1 method that ran only DataRetrievalServletTest

1. Completed 2026-10-03: no line stays at INFO (Dependencies And Decisions).
2. Count the moved patterns in the retrieval logs of the existing tests before the change. Closes with T1 (before part).
3. Change the listed calls to DEBUG and count again. Closes with T1 and T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Before and after the change, run DataRetrievalServletTest (single PV over HTTP), MultiPVClusterRetrievalTest (several PVs over HTTP) and PvaGetPVDataTest (single and several PVs over PVAccess) against freshly built WARs, and count each moved message pattern in the retrieval component logs those tests leave under their Tomcat folders | Tomcat 9, integration and localEpics profiles, softIocPVX | Before, the patterns appear; after, none of them appears at the default level and the three tests pass |
| T2 | Integration | ./mvnw -B -ntp clean verify | JDK 21, wrapper Maven | Build and the default suite pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-10-03 08:28-08:38 UTC (before) and 08:39-08:49 UTC (after) | JDK 21.0.12.1, Tomcat 9.0.122, softIocPVX; `./mvnw -B -ntp -DskipTests package`, then `./mvnw -B -ntp test -P integration -Dtest=DataRetrievalServletTest,MultiPVClusterRetrievalTest,PvaGetPVDataTest` on 61c0c79b914edc62a2bebbc7c2861c30606f4736 without and with the change | Pass | Lines the appliance relayed into the test output, before and after: "For the complete request, found a total of" 5 and 0, "deduping involved" 20 and 0, "URL to fetch data is" 14 and 0, "older than the request start time" 2 and 0. All five tests pass in both runs. "was an empty stream" appears 0 times in both runs; these tests do not reach it, so its two calls are verified only as `logger.debug` in source. Evidence: work/m29-before/ and work/m29-after/ (status.txt, tests.log) |
| T2 | 2026-10-03 08:49-09:17 UTC | JDK 21.0.12.1, wrapper Maven, `./mvnw -B -ntp clean verify` on the working tree with the change | Pass | Build success; the default suite runs 886 tests with no failure, error or skip (work/m29-t2.log) |

##### Closure Evidence

- Landed on 2026-10-03: the change is d80eef3a1d6d5f47b4167e7be7a934e7dfc39a64 and the decision, plan and test record a1db109e1b0229776c698aac62566a5d5abd35c6. Directly after the push at 17:43 UTC, fetch showed local HEAD and origin/modernize both at a1db109e, and `git ls-remote --exit-code origin refs/heads/modernize` returned it. The Maven workflow run 37141555213 on a1db109e succeeded at 18:16 UTC.
- Linked issue #13: body reconciled with the decision, the change and its verification, all three acceptance criteria checked, and closed as completed on 2026-10-03 at 20:12:32 UTC with a [closure comment](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/13#issuecomment-5973053026). M29 is Complete.

##### GitHub Projection

Title: Lower the remaining per-request retrieval INFO lines
Labels: enhancement
GitHub Milestone: none
Observed State: closed
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-03 20:13 UTC; `gh api repos/jeonghanlee/epicsarchiverap-maven/issues/13` confirms state closed with state_reason completed, closed_at 2026-10-03T20:12:32Z, the title above, enhancement label, no milestone and assignee jeonghanlee. Readback of the body matches `work/issue-loglevel-body.md` and the closure comment matches `work/issue-loglevel-close.md`.

#### M30 - ETLDetails post-processor time shown under the wrong label

Origin: daff1b7 / M30
Identity History: none
GitHub Issue: #14
Status: Complete

##### Summary

ETLDetails.java lines 104-107 print getTime4runPostProcessors() under the row labelled "executePostETLTasks()", so the per-PV ETL details page shows the post-processor time twice and the post-ETL-tasks time never. Found by the design review of 2026-09-27 of docs/design-etl-pass-scheduler.md; the per-PV rows are unchanged by that design, so the defect stays whichever way M25 lands.

##### Scope

Print getTime4executePostETLTasks() under its label.

Out of scope: the per-transition rows, which M25 replaces.

##### Completion Criteria

- The row shows the post-ETL-tasks time; a test reads the details rows for one PV after a real ETL job and finds both values under their labels; build and the default suite pass.

##### Dependencies And Decisions

- Origin: the design review of 2026-09-27 of docs/design-etl-pass-scheduler.md; the defect is recorded only here.
- Decision Date: 2026-10-02. ETLJob accumulates both phase times as millisecond wall-clock differences, so a small test job records zero or equal values and the present defect would pass unnoticed. After the real ETLJob, the test adds distinct known amounts to both phases through the production accumulator `ETLPVLookupItems.addInfoAboutDetailedTime`, so the two totals cannot be equal; no internal function is replaced.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-10-02, this plan with the T1 method below
Implementation Authorization: 2026-10-02, implement and verify this plan
Superseded Plan Artifacts: the earlier draft T1 method without the added distinct amounts

1. Add the test and observe it fail on the current label. Fix the getter and observe it pass. Closes with T1 and T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit | Run one real ETLJob over PlainPB stores, add distinct known amounts to the runPostProcessors and executePostETLTasks totals through `addInfoAboutDetailedTime`, then read ETLDetails for the PV | JDK 21, wrapper Maven | Both rows carry the value of their own phase; before the fix the test fails on the label |
| T2 | Integration | ./mvnw -B -ntp clean verify | JDK 21, wrapper Maven | Build and the default suite pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-10-03 00:18 UTC | JDK 21.0.12.1, wrapper Maven, `./mvnw -B -ntp test -Dtest=ETLDetailsTest` on 0c941984f6747e301b3c2d9e739d1c0ff6cf813b plus the new test, before and after the one-line correction | Pass | Before the correction the test fails at the executePostETLTasks row: expected 3000000, actual 1000000, the runPostProcessors total (work/m30-t1-before.log). After `ETLDetails` prints `getTime4executePostETLTasks()` under that label, the same test passes: 1 test, no failure, error or skip (work/m30-t1-after.log). The real ETLJob moved 2 partitions before the details were read |
| T2 | 2026-10-03 00:19-00:46 UTC | JDK 21.0.12.1, wrapper Maven, `./mvnw -B -ntp clean verify` on the working tree with the correction and the new test | Pass | Build success; the default suite runs 883 tests, including ETLDetailsTest, with no failure, error or skip (work/m30-t2.log) |

##### Closure Evidence

- Landed on 2026-10-03: the correction and `ETLDetailsTest` are 0fbd559259aacb7a8d023950d53d09b926413ffb and the plan and test record 81575aed33368b71b0b366731060a3685fc03063. Directly after the push at 01:11 UTC, fetch showed local HEAD and origin/modernize both at 81575aed, and `git ls-remote --exit-code origin refs/heads/modernize` returned it. The Maven workflow run 37085156529 on 81575aed succeeded at 01:45 UTC.
- Linked issue #14: body reconciled with the change and its verification, both acceptance criteria checked, and closed as completed on 2026-10-03 at 01:54:46 UTC with a [closure comment](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/14#issuecomment-5964331323). M30 is Complete.

##### GitHub Projection

Title: Show the post-ETL-tasks time under its own label in ETLDetails
Labels: bug
GitHub Milestone: none
Observed State: closed
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-03 01:55 UTC; `gh api repos/jeonghanlee/epicsarchiverap-maven/issues/14` confirms state closed with state_reason completed, closed_at 2026-10-03T01:54:46Z, the title above, bug label, no milestone and assignee jeonghanlee. Readback of the body matches `work/issue-etldetails-label-body.md` and the closure comment matches `work/issue-etldetails-label-close.md`.

#### M31 - PlainPB stale-file age uses 60 instead of 1000 for seconds to milliseconds

Origin: daff1b7 / M31
Identity History: none
GitHub Issue: #15
Status: Complete

##### Summary

PlainPBStoragePlugin.java lines 812-815 and 847-850 decide whether a zero-byte or empty source file is stale by comparing its age in milliseconds (currentTimeInMillis minus lastModifiedInMillis) with (hold + 1) x getApproxSecondsPerChunk() x 60, which mixes seconds and milliseconds, so such a file is deleted after (hold + 1) x partition x 0.06 s: 54 s for a 5-minute partition and about 4.3 h for a daily one, both with hold 2, instead of the (hold + 1) partitions the code reads as intending, which needs a factor of 1000. Files are deleted early, not late. Found by the design review of 2026-09-27 of docs/design-etl-pass-scheduler.md; pre-existing and unrelated to scheduling.

##### Scope

Compare the age in one unit, and settle with the owner what the intended age is ((hold + 1) partitions as the code reads, or another value).

Out of scope: the ETL scheduling (M25).

##### Completion Criteria

- The stale checks compare the age with the recorded intended age in the same unit; a test over real PlainPB files fails on the current factor and passes after; build and the default suite pass.

##### Dependencies And Decisions

- Origin: the design review of 2026-09-27 of docs/design-etl-pass-scheduler.md; the defect is recorded only here.
- The default hold is 0 (line 205). With (hold + 1) partitions as the intended age, hold 0 moves the threshold from 18 s to 5 min for a 5-minute partition and from 86.4 min to 1 day for a daily one; hold 2 moves it from 54 s to 15 min and from about 4.3 h to 3 days.
- The empty-file check runs only when hold or gather is not 0 (line 794). getETLStreams examines only files named for partitions before the one that contains the processing time (PlainPBPathNameUtility.getPathsBeforeCurrentPartition), so a test file named for the current partition is never checked.
- Plan review, 2026-10-03: the test files are named for an earlier partition, the processing times are taken from the files' actual modification times, and the header-only file is cut from a file the real writer produced at the first-sample position PBFileInfo reports; the two age checks share one helper.
- Decision Date: 2026-10-03. The intended age is (hold + 1) partitions, as the code reads: a zero-byte or header-only source file is deleted once its modification time is more than (hold + 1) x the partition length before the processing time.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-10-03, this plan with the T1 method below and the intended age above
Implementation Authorization: 2026-10-03, implement and verify this plan
Superseded Plan Artifacts: the earlier draft T1 method that did not fix the file partition names or the processing-time base

1. Completed 2026-10-03: the intended age is (hold + 1) partitions (Dependencies And Decisions).
2. Add the test and observe it fail on the current factor. Closes with T1 (before part).
3. Compute the stale age in milliseconds with the unit conversion in one helper used by both checks. Closes with T1 and T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit | On a real PlainPB store with PARTITION_5MIN and hold 2, create a zero-byte file and a header-only file, both named for a partition before the processing time; the header-only file is a file the real writer produced, cut at the first-sample position PBFileInfo reports. Call getETLStreams with processing times of each file's modification time plus 120 s and plus 1000 s | JDK 21, wrapper Maven | At plus 120 s both files are kept, and before the fix both are deleted; at plus 1000 s both are deleted |
| T2 | Integration | ./mvnw -B -ntp clean verify | JDK 21, wrapper Maven | Build and the default suite pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-10-03 06:38-06:40 UTC | JDK 21.0.12.1, wrapper Maven, `./mvnw -B -ntp test -Dtest=PlainPBStaleEmptyFileTest` on b7b9c0a9c2340c6f7ad3ef086a5915f077d623ec plus the new test, before and after the correction | Pass | Before the correction both cases fail at 120 s after modification because the file is already deleted (work/m31-t1-before.log). After both checks use one helper with the millisecond conversion, both cases pass: the zero-byte and the header-only file are kept at 120 s and deleted at 1000 s; 2 tests, no failure, error or skip (work/m31-t1-after.log). The header-only case asserts that PBFileInfo reads no first event before getETLStreams runs |
| T2 | 2026-10-03 06:40-07:07 UTC | JDK 21.0.12.1, wrapper Maven, `./mvnw -B -ntp clean verify` on the working tree with the correction and the new test | Pass | Build success; the default suite runs 886 tests, including PlainPBStaleEmptyFileTest, HoldAndGatherTest and ZeroByteFilesTest, with no failure, error or skip (work/m31-t2.log) |

##### Closure Evidence

- Landed on 2026-10-03: the correction and `PlainPBStaleEmptyFileTest` are 54085ea0a18d0f597f985938eb6536b86a98ad07 and the decision, plan and test record c8c9ca12a296927d306cc3e8f4c87f2d3947e619. Directly after the push at 07:24 UTC, fetch showed local HEAD and origin/modernize both at c8c9ca12, and `git ls-remote --exit-code origin refs/heads/modernize` returned it. The Maven workflow run 37106225550 on c8c9ca12 succeeded at 07:55 UTC.
- Linked issue #15: body reconciled with the decision, the change and its verification, all three acceptance criteria checked, and closed as completed on 2026-10-03 at 08:16:44 UTC with a [closure comment](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/15#issuecomment-5967099274). M31 is Complete.

##### GitHub Projection

Title: Compare the PlainPB stale-file age in one unit
Labels: bug
GitHub Milestone: none
Observed State: closed
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-03 08:17 UTC; `gh api repos/jeonghanlee/epicsarchiverap-maven/issues/15` confirms state closed with state_reason completed, closed_at 2026-10-03T08:16:44Z, the title above, bug label, no milestone and assignee jeonghanlee. Readback of the body matches `work/issue-stale-age-body.md` and the closure comment matches `work/issue-stale-age-close.md`.

#### M32 - Unknown OutOfSpaceHandling value leaves PVs without ETL

Origin: daff1b7 / M32
Identity History: none
GitHub Issue: #16
Status: Complete

##### Summary

PBThreeTierETLPVLookup.determineOutOfSpaceHandling (lines 579-585 at 14fc08a1) turns the property org.epics.archiverappliance.etl.common.OutOfSpaceHandling into an enum with valueOf, which throws on an unknown value; the call (line 297) sits inside the per-transition try of addETLJobs (lines 265-315), so a misspelled value logs one ERROR line per PV and transition and leaves every PV without ETL while the engine keeps writing the STS. Found by the design review of 2026-09-27 of docs/design-etl-pass-scheduler.md; pre-existing.

##### Scope

Fall back to the default handling with one ERROR line naming the bad value, read once rather than per PV.

Out of scope: the handling values themselves.

##### Completion Criteria

- A misspelled value leaves ETL running with the default handling and one ERROR line; a test fails on the current behavior and passes after; build and the default suite pass.

##### Dependencies And Decisions

- Origin: the design review of 2026-09-27 of docs/design-etl-pass-scheduler.md; the defect is recorded only here.
- ETLExecutor.java line 92 calls the same method, so the fallback applies to that path too.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-10-03, this plan with the T1 method below
Implementation Authorization: 2026-10-03, implement and verify this plan
Superseded Plan Artifacts: the earlier draft T1 method that registered one PV and did not count ERROR lines

1. Add the test and observe it fail on the current code. Closes with T1 (before part).
2. Make determineOutOfSpaceHandling fall back to the default handling with one ERROR line naming the bad value, and have the lookup read the property once instead of per PV and transition. Closes with T1 and T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit | Set the property to a misspelled value on the test config service, register two PVs through the real registration path, and capture the lookup's ERROR lines with a log appender | JDK 21, wrapper Maven | Both PVs have lookup items with the default handling and exactly one ERROR line names the bad value; before the fix no lookup item exists |
| T2 | Integration | ./mvnw -B -ntp clean verify | JDK 21, wrapper Maven | Build and the default suite pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-10-03 04:52 UTC | JDK 21.0.12.1, wrapper Maven, `./mvnw -B -ntp test -Dtest=ETLOutOfSpaceHandlingTest` on 14fc08a13bb049256e665b376b74f8609eb3a777 plus the new test, before and after the correction | Pass | Before the correction the test fails because the first PV has no lookup item (expected 1, actual 0; work/m32-t1-before.log). After it, both PVs have lookup items with DELETE_SRC_STREAMS_IF_FIRST_DEST_WHEN_OUT_OF_SPACE and exactly one ERROR line names the bad value: 1 test, no failure, error or skip (work/m32-t1-after.log). With only the read-once call reverted to a per-PV read, the same test fails on two ERROR lines (work/m32-t1-mutant.log); the correction was restored byte for byte |
| T2 | 2026-10-03 04:53-05:20 UTC | JDK 21.0.12.1, wrapper Maven, `./mvnw -B -ntp clean verify` on the working tree with the correction and the new test | Pass | Build success; the default suite runs 884 tests, including ETLOutOfSpaceHandlingTest, with no failure, error or skip (work/m32-t2.log) |

##### Closure Evidence

- Landed on 2026-10-03: the correction and `ETLOutOfSpaceHandlingTest` are 0e0c01ddad9731cdf2b65c8c5181c4ca2c3d78ad and the plan and test record 6c8a548f946448f3efb111380eea57a9f53c12f1. Directly after the push at 05:27 UTC, fetch showed local HEAD and origin/modernize both at 6c8a548f, and `git ls-remote --exit-code origin refs/heads/modernize` returned it. The Maven workflow run 37099889193 on 6c8a548f succeeded at 05:58 UTC.
- Linked issue #16: body reconciled with the change and its verification, both acceptance criteria checked, and closed as completed on 2026-10-03 at 06:00:54 UTC with a [closure comment](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/16#issuecomment-5966167825). M32 is Complete.

##### GitHub Projection

Title: Fall back to the default OutOfSpaceHandling on an unknown value
Labels: bug
GitHub Milestone: none
Observed State: closed
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-03 06:01 UTC; `gh api repos/jeonghanlee/epicsarchiverap-maven/issues/16` confirms state closed with state_reason completed, closed_at 2026-10-03T06:00:54Z, the title above, bug label, no milestone and assignee jeonghanlee. Readback of the body matches `work/issue-fallback-body.md` and the closure comment matches `work/issue-fallback-close.md`.

#### M33 - ZipETLTest reads back fewer events than written

Origin: daff1b7 / M33
Identity History: none
GitHub Issue: [#19](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/19)
Status: Complete

##### Summary

ZipETLTest.testETLIntoZipPerPV (slow group) writes one year of samples at one per second (31536000 events) for one PV into a PlainPB PARTITION_DAY source, runs ETLExecutor.runETLs as of the current time (plus 35 days in January) into a PARTITION_DAY destination with compress=ZIP_PER_PV, then counts the events read back over the year from the source and the destination together and requires at least 31535999. On 2026-09-28 the count was 31534907, 1093 short, in the whole slow-group run of M25 / T10 (16:01 to 16:16 UTC) and identically on a checkout of d4ee97bc, before any code of M25, so the shortfall predates the pass scheduler. The slow group is selected by neither the default suite nor the Maven workflow, so the date the test started failing is unknown. The test drives ETL through ETLExecutor and the stopped lookup, not through the pass drivers.

##### Scope

Find on the real path which events go missing (the ETL into the zip per PV, the read-back from the zip, or the test's own boundary at the run date, since the run date decides which day stays in the source) and fix the cause in the code or in the test.

Out of scope: the pass scheduler (M25); the other slow-group tests.

##### Completion Criteria

- The cause is identified on the real path with the source and destination counts recorded separately; the test passes on repeated runs with the slow-group command narrowed to the class, and the default suite passes.

##### Dependencies And Decisions

- Origin: the whole slow-group run of M25 / T10 on 2026-09-28; the shortfall is recorded there and here only.
- Observation (2026-09-28): 31534907 events read back on the step 6 tree (d8a7813f plus the slow-group test) and on d4ee97bc; the assertion accepts 31535999 or more.
- Cause (2026-10-03): ETL truncates complete ZIP_PER_PV day entries. After the bulk append, AppendDataStateData.updateStateBasedOnExistingFile reads PBFileInfo of the entry; WrappedSeekableByteChannel.read returns fewer bytes than a 16 KiB read asks near the end of a deflated entry (229 of 276 entries), so LineByteStream.seekToBeforeLastLine picks an earlier line as the last one and truncateCorruptFile (9faee2e3) cuts the entry there. In the run of 2026-10-03 the source held 7689600 events and the destination 23845307; 25 day entries were each short by the lines cut at their end, 1093 in total, with one truncation warning per entry.
- Decision Date: 2026-10-03. The fix goes into WrappedSeekableByteChannel: read fills the buffer until it is full or the entry ends, and position repeats skip until it reaches the target. The position overshoot of seekToBeforeLastLine found during verification is M38, not part of this milestone; ZipAppendTailTest checks only that the truncation point does not cut into a complete entry.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-10-03; owner accepted the two-step plan below.
Implementation Authorization: 2026-10-03; owner authorized step 1 and the report of the located cause; the fix in step 2 follows the owner's direction on that cause.
Superseded Plan Artifacts: none

1. In ZipETLTest, log the source and destination counts separately and name both in the assertion message, leaving the threshold unchanged. Rerun the class alone with the slow-group command and locate the gap (the day of the run date, a zip entry, or the read-back), counting per day file or per zip entry read-only where needed. Report the located cause to the owner. Closes with T1 (before part).
2. Fix the cause in the code or in the test as the owner directs and rerun; run the default suite. Closes with T1 and T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration, slow group | ./mvnw -B -ntp test -Dtest=ZipETLTest -Dtest.groups=slow -Dtest.excludedGroups=integration,localEpics,flaky, with the source and destination counts recorded before and after the fix | JDK 21, wrapper Maven | Before: 31534907 read back and the located gap; after: at least 31535999 on two consecutive runs |
| T2 | Integration | ./mvnw -B -ntp clean verify | JDK 21, wrapper Maven | Build and the default suite pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-10-04 01:52 UTC (before); 02:29 and 02:30 UTC (after) | JDK 21, wrapper Maven, slow group, tree 6a1fb7c8 plus the change | Pass | Before the change: 31534907 read back, 7689600 from the source and 23845307 from the destination, 25 truncation warnings; the destination zip's 25 short day entries were short by 1093 lines in total. After: 31536000 on two consecutive runs, 7689600 and 23846400, no truncation warning. ZipAppendTailTest (default suite): 4 of 6 fail on the unchanged channel (short 16 KiB read, wrong last sample, re-append and crashed tail in a zip entry), 6 of 6 pass after. |
| T2 | 2026-10-04 02:58 UTC | JDK 21, wrapper Maven, tree 6a1fb7c8 plus the change | Pass | ./mvnw -B -ntp clean verify: BUILD SUCCESS, 892 tests, 0 failures, 0 errors, 0 skipped. |

##### Closure Evidence

- Landed on 2026-10-04: the change is 6c2cfc08 and the cause, plan and test record 2a531b59f35622cbdae75363ccd03ca194f32112. Directly after the push at 04:20 UTC, fetch showed local HEAD and origin/modernize both at 2a531b59, and `git ls-remote --exit-code origin refs/heads/modernize` returned it. The Maven workflow run 37176720211 on 2a531b59 succeeded at 04:50 UTC.
- Linked issue #19: body reconciled with the cause, the change and its verification, all four acceptance criteria checked, the position overshoot linked to #23 under Out of Scope, and closed as completed on 2026-10-04 at 05:02:59 UTC with a [closure comment](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/19#issuecomment-5976778451). M33 is Complete.

##### GitHub Projection

Title: Find and fix the event shortfall in ZipETLTest
Labels: bug
GitHub Milestone: none
Observed State: closed
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-04 05:03 UTC; `gh api repos/jeonghanlee/epicsarchiverap-maven/issues/19` confirms state closed with state_reason completed, closed_at 2026-10-04T05:02:59Z, the title above, bug label, no milestone and assignee jeonghanlee. Readback of the body matches `work/issue-zip-etl-event-shortfall-body.md` and the closure comment matches `work/issue-zip-etl-event-shortfall-close.md`.

#### M34 - Preserve pending samples when pausing archiving

Origin: daff1b7 / M34
Identity History: none
GitHub Issue: [#17](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/17)
Status: Complete

##### Summary

Pausing a PV can discard samples that retrieval already returned. On 2026-09-29, the real pause/resume workflow accepted pause and reported Paused, but all three baseline samples were absent from PB after the 120-second persistence deadline and after orderly shutdown. `ArchiveEngine.pauseArchivingPV` calls `destoryPv`; `WriterRunnable.removeChannel` removes the pending buffer without writing it. The writer's unsynchronized running flag can also skip a concurrent flush, and buffer rotation can replace a batch whose append failed.

##### Scope

Preserve pending samples through engine pause: stop new buffer input, serialize periodic/year-change/pause writes, persist pending batches before removing the channel, retain batches on failure, and propagate storage failure to the engine pause response. Include PlainPB stream-close failure handling when required to establish successful persistence. Reuse the real CLI workflow and unchanged IOC fixture for storage, paused-recording and resumed-current-value verification.

Out of scope: changing delete semantics, changing archival parameters, new storage formats, CLI redesign, unrelated ETL defects, and broad writer performance changes.

##### Completion Criteria

- Every baseline timestamp/value/status/severity tuple survives pause in actual PB files; a successful pause response follows completed persistence.
- Concurrent periodic/year-change writing and pause cannot skip pending data, write through a removed channel, or mistake a stale buffer for a resumed channel.
- A real filesystem write failure preserves retryable samples and returns failure; retry cannot silently skip data merely because an earlier append updated an in-memory timestamp. Partial headers and samples from a failed append are rolled back to its starting file length before retry; completed writes remain intact.
- The real regression fails on the old server and passes with the correction; the default Maven suite, affected integration tests, and rebuilt-WAR pause/resume workflow pass.
- Return to M17 and complete its pause/resume CLI and documentation checks. Landing evidence and linked-issue closure are required before marking this milestone Complete.

##### Dependencies And Decisions

- Decision Date: 2026-09-29. Execute this server correction first, then return to M17 pause/resume. No dependency on M17 completion exists; its unfinished runner and PB adapter are verification inputs.
- Confirmed evidence: M17 / T14, `work/pause-resume-implementation-1/`, records three missing baseline tuples, accepted pause, Paused status, and absence after orderly shutdown. The failed persistence assertion remains unchanged.
- Source concerns requiring execution: concurrent writer completion, in-flight input, retry after append failure, and stream-close error propagation. Source inspection alone does not establish runtime results for these cases.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-09-29, preserve pending data through pause using the server correction described in the preceding diagnosis and requested as a separate milestone.
Implementation Authorization: 2026-09-29, add the milestone and issue, execute the server correction, then return to the current CLI work.
Superseded Plan Artifacts: none

1. Establish regressions through `ArchiveEngine`, `WriterRunnable`, real `SampleBuffer`, PlainPB storage and readers. Control only filesystem or clock boundaries; do not replace internal writers with mocks. Record the old failure before production edits. Closes with T1.
2. Coordinate input termination, pending-batch ownership, successful-write acknowledgment and channel removal. Keep explicit deletion separate. Inspect sibling removal paths without expanding their behavior. Closes with T1-T3.
3. Require successful PlainPB output close before acknowledgment. Remember the starting file length for each open append; on failure, restore that length and the acknowledged timestamp. Retain a failed recovery until it succeeds before another append. Closes with T3.
4. Stop owned runtime fixtures, build fresh WARs with `./mvnw -B -ntp clean verify`, then run the named affected integration classes. Record the exact class selection before execution. Closes with T4-T5.
5. Run `verify_pause_resume.py` on the rebuilt WARs and unchanged `UnitTestPVs.db`; retain source/WAR hashes and cleanup evidence. Return to M17 / T10 and T14-T16, preserving the original failure and adding the new result. Closes with T6.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Engine/storage regression | Pause a real engine channel with pending samples, then decode its actual PB files; execute against old and corrected main code | JDK 21; real engine, PlainPB writer/reader; temporary filesystem | Old path loses pending samples; corrected path retains every tuple before removal |
| T2 | Concurrency | Execute periodic writing and pause concurrently through shipped writer and buffer, including stale year-change work and stopped input | JDK 21; actual engine/storage; controlled outer filesystem boundary when needed | Pause waits for the active append, drains pending data, and leaves no accepted sample unpersisted |
| T3 | Failure/retry | Cause real directory, full-device and file-size-limit failures; retry via shipped engine/writer; interrupt a PB header, first sample, next sample and an append to an existing file | JDK 21; Linux prlimit and Bash for isolated JVM limits; real PlainPB serialization and reads | Failed pause retains its channel and data; partial bytes return to the starting length; completed bytes survive; retry persists all tuples without false success or loss |
| T4 | Build/default suite | `./mvnw -B -ntp clean verify` with all owned appliance and IOC processes stopped | JDK 21; wrapper Maven | Build and default tests pass; four new WARs exist |
| T5 | Affected integration | `./mvnw -B -ntp -P integration -Dtest=PauseByFieldNameTest,ResumePVAfterRestartTest,PauseResumeV4Test,ArchiveFieldsTest,ArchiveFieldsWorkflowTest,ScanSamplingMethodTest test` (selection recorded 2026-09-29 before execution) | JDK 21; rebuilt WARs; installed Tomcat and real IOC where required | Pause/resume, fields and sampling-related affected tests pass; no owned processes remain |
| T6 | Real appliance/CLI | `src/test/pythontests/verify_pause_resume.py` per `TESTING.md`, retaining exact baseline and resumed tuples, IOC monitor and control PV evidence | Rebuilt four WARs; Tomcat 9.0.122; softIocPVX; unchanged UnitTestPVs.db; real Java PB reader | Baseline and resumed tuples exist in PB; PB/retrieval data remain unchanged before resume; any earlier-timestamped resumed current value matches actual IOC evidence; control and IOC continue; CLI and documentation cases pass; normal cleanup |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-29 08:26 UTC (original failure), 19:49 UTC (focused correction), 20:06 UTC (default suite) | JDK 21; real engine and PlainPB writer/reader | Pass | The five initial regressions fail on the old main code in work/pause-persistence-before.log. The final 13-case PausePersistenceTest plus PBAppendCrashRecoveryTest pass all 14 cases in work/pause-partial-after.log and are included in the fresh default suite. The four partial-write regressions also fail before rollback in work/pause-partial-before-final.log; the original live data-loss failure remains under M17 / T14 |
| T2 | 2026-09-29 19:49 UTC (focused), 20:06 UTC (default suite) | JDK 21; real file output, writer, buffer and scheduler | Pass | Active append blocks pause until output close; pause drains the next batch. The actual queued year-change callback leaves a removed buffer and its replacement untouched. Late input to the paused buffer is rejected. work/pause-partial-after.log and work/pause-partial-clean-verify.log |
| T3 | 2026-09-29 19:48 UTC (before), 19:49 UTC (after), 20:00 UTC (recovery failure) | JDK 21; directory obstruction, /dev/full, isolated Linux prlimit and real ftruncate failures injected with strace | Pass | Four partial-write cases fail before correction, then pass with the real engine/PB fixture: header, first sample, next sample and an existing file. Failed output restores the prior bytes; retry preserves exact timestamp/value/status/severity tuples. Existing failure, BPL response, resume, repeated-write and healthy-PV cases also pass. work/pause-partial-before-final.log and work/pause-partial-after.log. In work/pause-partial-recovery-failure.log, three ftruncate errors keep two pause attempts failed with the channel retained; the next attempt recovers and decodes both samples. The actual syscall trace is work/pause-review/recovery-1790712047709353201/truncate.log |
| T4 | 2026-09-29 20:06 UTC | JDK 21; wrapper Maven; working tree on 14218555 | Pass | Fresh clean verify passes all 818 tests with zero failures/errors/skips, including 13 PausePersistenceTest cases. Four WARs built; eight changed or reader/normalizer classes match target/classes in every WAR (32 comparisons). work/pause-partial-clean-verify.log and work/pause-partial-build.json retain counts and source/WAR digests |
| T5 | 2026-09-29 20:24 UTC | JDK 21; final T4 WARs; Tomcat 9.0.122; softIocPVX; CA port 27675 | Pass | The six named classes pass all eight cases in one run, including ArchiveFieldsTest.testArchiveFilterPV with real values 0.0, 0.15 and 1.0 and the unchanged three-event assertion. work/pause-partial-integration.log. No owned Tomcat, IOC or monitor process remained before the CLI run |
| T6 | 2026-09-29 20:28 UTC | Final T4 WARs; real appliance/IOC, camonitor and PB reader | Pass | All 58 checks pass in work/pause-partial-live/, including exact baseline and resumed PB persistence, unchanged stored data before resume, the earlier-timestamped resumed current value, continuing IOC/control updates, all CLI cases and verbatim documentation commands. M17 / T14-T16 retain exact results and earlier failure evidence. Normal cleanup: launcher 143, IOC 0, monitor -15; no fallback signals or surviving owned JVMs |

##### Closure Evidence

- The correction and all required checks pass, including partial-write rollback and retry after failed recovery. The original partial header and first-sample corruption is retained in work/pause-review/partial-write-repeat.log; the results above verify the correction. M17 pause/resume and archive/status checks pass on the same rebuilt WARs.
- Landing observed 2026-09-29 at 22:25 UTC: server correction 759337d5e48b0af5ae90ae1fd92cb1676e3d21d6 and CLI/test/documentation commit fbc32120b83f4999f0d7f4408e3719abf8dac8bd are on the fetched origin/modernize at fbc32120. The implementation, test and documentation paths match that upstream. Recheck with fetch, rev-parse and diff against origin/modernize.
- Remote checks observed 2026-09-29: [Maven run 36630658575](https://github.com/jeonghanlee/epicsarchiverap-maven/actions/runs/36630658575) and [Pages run 36630658665](https://github.com/jeonghanlee/epicsarchiverap-maven/actions/runs/36630658665) completed successfully on fbc32120. Maven's JDK 21 build, test and dependency-check step passed.
- Linked issue #17: body reconciled with the landed correction, partial-write recovery, verification and checked acceptance criteria; closed as completed on 2026-09-29 at 22:31:30 UTC. The [closure comment](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/17#issuecomment-5900342506) records the commits and results. GitHub API readback confirms state closed, state_reason completed and an exact body match. All completion criteria are satisfied; M34 is Complete and work returns to M17's remaining operation scopes.

##### GitHub Projection

Title: Preserve pending samples when pausing archiving
Labels: bug
GitHub Milestone: none
Observed State: closed
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-09-29; gh api repos/jeonghanlee/epicsarchiverap-maven/issues/17; exact projected body, closed state, completed reason, title, bug label, no milestone and assignee jeonghanlee verified; remote closed_at and updated_at 2026-09-29T22:31:30Z.

#### M36 - Honor nanosecond bounds in live retrieval

Origin: daff1b7 / M36
Identity History: none
GitHub Issue: [#21](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/21)
Status: Complete

##### Summary

Live retrieval can return an event later than the requested inclusive `to` timestamp. The real live-IOC probe on source d8a7813f40083c1bf7148e6c3b7bffd368d70ee0 returns the target at `2026-10-01T20:41:43.205032201Z`, value 66.0, even when `to` is `2026-10-01T20:41:43.205032200Z`; the exact timestamp includes it with no overflow. Separate stored-history controls exclude their target at minus one nanosecond and include it at equality. These observations establish the reported live-path defect, not verification of a correction or every storage backend.

Issue #21 also records the original post-restart acquisition failure on Debian 13, MariaDB socket configuration, EPICS 7.0.10 and the committed `src/resources/test/UnitTestPVs.db`, with 10,018 IOC records loaded. Initial CA-to-retrieval verification passed; after restarting the four appliance JVMs, a fresh acquisition response contained an event 9.276784 ms after its requested `to`. This is the issue's recorded original observation, not a new execution in this source session.

##### Scope

Preserve the public retrieval request's timestamp precision through parsing, internal engine-request serialization, engine event streaming and final merging. Enforce the inclusive upper bound with complete event timestamps on live and mixed live/stored output. Inspect callers of the shared streaming helper for the same seconds-only assumption and preserve the supported preceding-value behavior at the lower boundary.

The public live retrieval path is `DataRetrievalServlet -> RetrievalState -> StoragePluginURLParser -> PBOverHTTPStoragePlugin -> GetEngineDataAction -> StreamPBIntoOutput -> InputStreamBackedEventStream -> MergeDedupConsumer`. At c4516e76, both plugin request methods truncate bounds to milliseconds, the engine streamer compares epoch seconds, and the merge consumer has no final upper-bound check. The correction serializes complete `Instant` bounds in both plugin methods and filters full timestamps in engine streaming and before merge buffering/output. Pending first events therefore obey the same bound on close and PV switch. The separate Java retrieval client `RawDataRetrievalAsEventStream` retains its millisecond formatter; boundary verification sends exact timestamps directly over public HTTP.

`RetrievalState` selects the engine when `endEpochSeconds >= currentEpochSeconds` or `currentEpochSeconds - endEpochSeconds < 2 * engineWriteThreadInSeconds`. The buffer setting comes from `org.epics.archiverappliance.config.PVTypeInfo.secondsToBuffer`: the shipped default site sets 10 seconds, the Java test site sets 2 seconds, and `RetrievalState` falls back to 60 only when the property is absent. The runner reads the selected engine WAR's property and records its actual value. Live acceptance requires an observed engine request and an independently confirmed target in the actual engine buffer throughout the paired boundary requests. An old timestamp can select only stored sources and cannot establish live correctness.

Out of scope: disconnection reporting and the M17 sample inventory; a new retrieval API or storage architecture; timestamp normalization of IOC events; changes to the original IOC database; relaxing aa-env's retrieval acceptance criteria; unrelated formatter callers without an observed requirement. Full VM revalidation remains owned by epicsarchiverap-env.

##### Completion Criteria

- Actual live-engine HTTP retrieval excludes the same fresh target for `to = sample timestamp - 1 ns` and includes it for `to = sample timestamp`. Record the exact target timestamp/value, configured buffer interval, engine buffer presence and engine participation in both public requests; an aged or missing target or absent engine request fails setup.
- Stored-history retrieval retains those exact upper-bound results; mixed live/stored output contains no event after `to`.
- Named regression checks exercise shipped parsing, single/multiple-PV request serialization, engine streaming and merge/flush paths with original fixtures. No replacement of an internal path counts as integration evidence; record the actual selected tests, commands and reports.
- Same-second fractional boundaries and a second rollover are covered; the supported lower-bound preceding-value behavior is preserved.
- Real IOC/HTTP verification passes after the correction, including a new target acquired after restarting all four appliance components. Use explicit complete WAR bundles, bounded waits and normal verified cleanup; any missing evidence, skipped required check or forced/incomplete cleanup fails verification.
- The correction, source/WAR provenance and executed boundary results identify a published source commit for jeonghanlee/epicsarchiverap-env#56 to rerun its existing full VM checks without relaxing the requested bounds. Issue #21's body is reconciled and its completed closure is observed under separate issue authority.

##### Dependencies And Decisions

- Decision Date: 2026-10-01. Record issue #21 as owner-assigned M36 in this canonical document. The existing M21 continues to own unknown-PV consolidation rejection; its row and detail are unchanged.
- The defect blocks integrated deployment verification in jeonghanlee/epicsarchiverap-env#56. This is a downstream impact, not a dependency blocking source correction. Keep the env baseline and acceptance checks unchanged.
- Issue #21's reproduction, root-cause description and six acceptance criteria define the initial scope. Initial documentation authorization covered the draft only. Subsequent owner plan acceptance and implementation authorization are recorded below.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-10-01; owner accepted the revised M36 Implementation Plan and Test Plan in document SHA-256 7b569b0542e42aaceb6f7c39473407bf5f0a9b4a17ad1db35ac5caebfbc57151.
Implementation Authorization: 2026-10-01; owner explicitly authorized the accepted M36 Implementation Plan and Test Plan.
Superseded Plan Artifacts: none

Review Findings Accepted: Decision Date: 2026-10-01. Apply all three findings from the first M36 self-review of document SHA-256 b935a7bdac94a34ed2653826a807c43f6862668f08b9ac8789e4fadef04d5af3: correct the actual retrieval-to-engine path (C1); require fresh engine-buffer targets and observed engine participation (C3); specify executable verification, bundle selection, deadlines and exit judgments (C3). That review direction authorized draft revision only; subsequent owner plan acceptance and implementation authorization are recorded above.

1. Trace the original reproduction through the public live path listed in Scope. Inspect both `PBOverHTTPStoragePlugin` request methods, the actual `InputStreamBackedEventStream` reader, buffered first/last events and all `MergeDedupConsumer` output/flush sites. Inspect shared-helper callers and lower-bound behavior. Preserve a complete defective four-WAR bundle and its manifest before production edits.
2. Define `src/test/org/epics/archiverappliance/retrieval/LiveRetrievalBoundsTest.java` and `src/test/pythontests/verify_retrieval_bounds.py` as the Java integration fixture and real IOC/HTTP acceptance runner. Use actual `TomcatSetup`, `SIOCSetup`, unchanged `UnitTestPVs.db`, PB readers and `scripts/run-local-appliance.bash`. Capture the defective runtime with the same exact boundary assertions that will judge the correction; setup failure or absent engine participation cannot count as defect reproduction.
3. Preserve nanosecond precision at the actual internal HTTP serialization boundary and filter inclusive upper bounds using complete timestamps through engine streaming and final output/flush. Choose the narrowest correction covering those paths; assess both request methods without changing unrelated formatter contracts without evidence. Verify with the named regressions and retained baseline below.
4. Cover minus-one-nanosecond/equality, same-second and rollover boundaries, stored/live merging, single-event final flush and the supported lower-bound preceding value. Controlled tests may replace only outer HTTP, filesystem or clock boundaries; real integration checks retain the original IOC fixture and every internal production span.
5. Run the default suite and the explicitly selected integration classes below, then run real IOC/HTTP checks against one corrected complete bundle before and after a four-component restart. Retain source/WAR digests, unchanged baseline assertions, exact requests/responses, engine participation evidence and bounded cleanup results. Prepare the source commit and issue update under their separate authorities, then provide the published revision and results for the env-owned full VM rerun.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Real live retrieval | verify_retrieval_bounds.py records a fresh native timestamp and independent engine-buffer presence; pair direct public HTTP minus-one-nanosecond/equality requests with actual engine request evidence; replay unchanged assertions on defective/corrected bundles | Explicit four-WAR appliance, real softIocPVX and unchanged UnitTestPVs.db | Defective live assertion fails for overflow; corrected target is excluded at minus 1 ns and included at equality with no output after to; missing live preconditions fail setup |
| T2 | Stored and mixed retrieval | Runner establishes actual stored records, stored-only engine exclusion and mixed stored plus engine participation before paired boundary requests | Same real appliance, shipped storage and PB/retrieval readers | Stored boundaries remain correct; mixed output obeys to with exact timestamp/value/status/severity baselines and evidence for both sources |
| T3 | Regression | LiveRetrievalBoundsTest exercises public parsing, both real plugin serialization methods, engine streaming and merge/flush; execute DataRetrievalServletTest, SinglePVRetrievalTest and default TimeUtilsTest as regressions | Explicit Maven selections below; actual fixtures and HTTP/PB paths | Required classes/cases execute without failures/errors/skips; exact timestamp precision and inclusive filtering survive every boundary |
| T4 | Boundary regression | Named Java test and runner cover same-second events, second rollover, single-event/final flush and supported lower-bound preceding values | Shipped code and original fixtures; outer boundaries only when controlled | Exact upper bounds remain inclusive across rollover and flush; preceding-value behavior remains correct |
| T5 | Real restart and regression | Execute the commands below; stop all four owned components, retain storage, restart the same corrected bundle and query a new post-restart live target | Corrected WAR manifest, real Tomcat/IOC; bounded runtime contract below | Default and selected integration suites pass; fresh post-restart exact boundary pair passes; hashes match and normal cleanup is observed |
| T6 | Landing and issue verification | Verify published correction commit and updated/closed issue #21 after separately authorized commit/push and issue operations | Fetched source remote and GitHub readback | Published revision and real boundary results are available for unchanged env full VM revalidation; linked issue closure is observed |

**Execution contract for T1-T5.** The Java integration fixture and Python runner above are implemented. The runner accepts a positional evidence folder and explicit `--war-dir`, `--war-basename`, `--bundle-manifest`, `--classpath-file`, `--tomcat-home`, `--ioc`, `--port-base` and `--ca-port`. It performs live, stored, mixed and restart checks with the same assertions on both revisions; a failing run exits nonzero and retains all evidence. Only a recorded boundary assertion with confirmed live preconditions counts as the expected defective baseline. Corrected acceptance requires exit 0 and every required assertion passing. `TESTING.md` documents the same executable procedure.

Run from the repository root with JDK 21, exported `JAVA_HOME` and `TOMCAT_HOME`, and real `softIocPVX` on PATH. Prepare a separate new bundle/evidence folder per source revision. Preserve the defective bundle before editing production sources; repeat corrected preparation after the correction. The existing bundle preparer selects and records one successful complete build, exact WAR basename and four digests. Pass that basename explicitly to Java and Python and compare deployed WAR hashes with the manifest. Reusing defective WARs after production edits requires retaining their original manifest and digests; never infer provenance from a filename or the current HEAD.

The following corrected-run commands executed successfully on 2026-10-02 UTC. For defective replay, select the retained defective bundle's directory, manifest, classpath and basename and use a different new evidence folder; keep runner assertions and fixtures unchanged. After production edits, pass `--baseline-manifest` with the original executed run's manifest to validate the retained defective bundle against its original provenance.

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

Require successful Java fixture teardown before Python starts, and free selected ports before either fixture starts; a collision fails setup. Record executed test names/counts and retain Surefire reports. Default-suite exclusions follow `TESTING.md`; any skipped required selected boundary or integration case fails acceptance. Run the real network checks outside a process sandbox when it cannot support CA/PVA discovery, with unchanged assertions and wait limits.

For each live pair, choose a fresh acquired event using the shipped native retrieval/PB reader and integer seconds/nanoseconds; retain timestamp, value, status and severity. Use direct engine HTTP/PB queries with a wider observation interval to confirm the target remains in the buffer before and after the pair. Retain actual engine HTTP request/response evidence correlated with each public request, including the serialized `from` and `to`, configured buffer interval and observation times. On the correction the internal request must preserve each exact bound. CA display precision or floating-point conversion cannot determine the target. Both paired requests use the same immutable target while engine selection and buffer presence hold. Missing/expired target, absent engine participation, malformed data or timeout fails setup or verification, with no stored-only fallback or silent target replacement. Stored-only control must prove engine exclusion; mixed control must prove actual stored records and a participating engine target.

Bound launcher readiness at 180 seconds, initial archiving at 360 seconds and each acquisition/storage/connection observation at 120 seconds. HTTP calls use 15 seconds and reader/helper subprocesses 20 seconds; read-only polls are one second and every call is limited by the remaining phase deadline. Record the URL before HTTP transport starts and retain received response bytes, status and error on non-200 responses, truncation or timeout; incomplete responses cannot count as successful observations. Do not extend deadlines or restart them after failed observations. Capture actual rollover samples and exact bounds with the same timestamp rules.

Restart retains storage and evidence, stops the owned launcher with exit 143 within 300 plus seven seconds, and confirms all old appliance children have exited before starting the same four WARs. Keep the IOC alive through the appliance restart; require full four-component readiness and a target acquired after the new appliance startup. Each restart startup/acquisition uses the same limits. Final IOC exit is bounded at 30 seconds and must return 0; final launcher cleanup also requires exit 143 within 300 plus seven seconds and every recorded owned child gone. Forced cleanup, an unexpected launcher exit, surviving children, teardown errors or missing evidence makes the run fail even if boundary assertions pass. Cleanup runs on success and failure and retains all manifests, requests/responses, process identities, logs and failed assertions.

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-10-01; original evidence re-read 2026-10-02 00:04 UTC | Peer-owned actual VM/original IOC, source d8a7813f40083c1bf7148e6c3b7bffd368d70ee0 | Fail | Existing live probe returns the 66.0 target one nanosecond after to; equality includes it with no overflow. epicsarchiverap-env/work/m10-validation/retrieval-live-upper-bound-3.json has SHA-256 51eb2a578c421b1b6fadcb6528013862dab19a3228f75bec63b602d8097650d6. Reading that executed observation is not a new local runtime execution |
| T1 | 2026-10-02 02:04-02:08 UTC | Retained original aa-20261002-c4516e76 four-WAR bundle; real softIocPVX, unchanged UnitTestPVs.db, deployed 10-second buffer | Fail as required before correction | work/retrieval-bounds-baseline-ioc-3/ records 70 checks, 43 pass and 27 boundary/precision failures, with no run-error or cleanup failure. The live target 2026-10-02T02:06:59.594706845Z, value 99.0, status 3, severity 2, is returned at to minus 1 ns and included at equality. Independent buffer and engine-participation checks pass. Stored-only boundaries pass; live, mixed and fresh post-restart upper bounds fail. Both launcher stops exit 143 with all recorded children gone; IOC exits 0. The immutable original bundle and manifest are in work/retrieval-bounds-baseline-bundle/ |
| T3 | 2026-10-02 02:00-02:02 UTC | JDK 21, real Tomcat/IOC, retained original four-WAR bundle and native PB bytes | Fail as required before correction | work/retrieval-bounds-baseline-java-2.log and work/retrieval-bounds-baseline-java-2-reports/ retain one executed LiveRetrievalBoundsTest case, one failure with seven expected assertion failures, zero errors/skips. Public/engine/merge overflow, actual single-event close/PV-switch overflow, second rollover and plugin serialization fail; ordinary Tomcat/IOC teardown assertions pass |
| T1 | 2026-10-02 02:57-03:01 UTC | Same retained defective four-WAR bundle; final runner, real original IOC, separate ports 31665/31675 | Fail as required on retained defective bundle | work/retrieval-bounds-baseline-ioc-4/ completes the same 70 cases, with 46 pass and 24 boundary/precision failures. Minus-one exclusion, exact internal precision and rollover remain defective for live, mixed and fresh restart targets; source-selection and stored-only controls pass. Three preceding-query upper-bound verdicts differ from the original run because the new targets' fractional seconds change which later events can fall inside the requested observation. No assertion or lifecycle method changed. Both launcher exits are 143 with no surviving children; IOC exits 0, with no run-error or forced cleanup |
| T1 | 2026-10-02 02:42-02:46 UTC | Debian 13.7, JDK 21, Tomcat 9.0.122, real softIocPVX/EPICS 7.0.10, original IOC DB and corrected four-WAR SQLite appliance | Pass | work/retrieval-bounds-corrected-ioc/ passes all 70 unchanged assertions; its runner, Java test and fixture hashes equal work/retrieval-bounds-baseline-ioc-3/. The live target 2026-10-02T02:44:42.937454094Z, value 100.0, status 3, severity 2, is excluded at minus 1 ns and included at equality. Actual internal from/to preserve full precision, engine participation and buffer presence pass, and every public result obeys to. The selected bundle manifest pins 610 production/resource/configuration sources and four WAR hashes; only the three approved production files differ from the retained defective manifest |
| T2 | 2026-10-02 02:44-02:46 UTC | Same corrected real appliance; actual retained PB files and native readers | Pass | Stored-only minus-one/equality controls pass with engine exclusion. Mixed requests confirm engine participation, preserve the original stored timestamp/value/status/severity tuple and enforce the complete upper bound. The stored baseline also survives four-component restart. Native PB snapshots, exact HTTP responses and source-selection logs are retained in the corrected IOC evidence folder |
| T3 | 2026-10-02 02:35 UTC default; 02:36-02:41 UTC selected integration | JDK 21; real default fixtures; corrected explicit WARs, TomcatSetup/SIOCSetup and original IOC DB for integration | Pass | Fresh clean verify passes 882 tests with zero failures/errors/skips; 84 XML reports and the log are retained in work/retrieval-bounds-corrected-default-reports/ and work/retrieval-bounds-corrected-default.log. TimeUtilsTest executes 14 cases. Separate integration executes LiveRetrievalBoundsTest 1, DataRetrievalServletTest 2 and SinglePVRetrievalTest 1, all non-skipped with zero failures/errors; reports/log and 12 matching retained deployed WAR digests are in work/retrieval-bounds-corrected-integration-reports/, work/retrieval-bounds-corrected-integration.log and work/retrieval-bounds-corrected-java-evidence.json. No Java or softIocPVX process remains before Python starts |
| T4 | 2026-10-02 02:38 UTC Java; 02:44-02:46 UTC real appliance | Native captured IOC PB bytes, actual streamer/merge/JSON response and public HTTP | Pass | Same-second minus-one/equality, actual single-event close/PV-switch rejection, second rollover and supported lower-bound preceding values pass. Both actual plugin serialization methods retain precise bounds. Seven expected assertions failed on original Java production classes before correction; the unchanged Java test passes on corrected classes/WARs. The real runner's rollover and preceding-value checks also pass for live, mixed and fresh restart targets |
| T5 | 2026-10-02 02:45-02:46 UTC | Same corrected four-WAR bundle; IOC kept alive, actual SQLite/PB storage retained | Pass | Restart requires all old JVMs gone and the same deployed hashes. The fresh post-startup target 2026-10-02T02:45:51.937413064Z, value 68.0, status 4, severity 1, is excluded at minus 1 ns and included at equality with exact internal bounds and buffer evidence. Both launcher stops return 143, status stopped and no remaining owned children; final IOC exit is 0. No run-error, forced stop or cleanup error occurs. All 70 checks pass and the runner exits 0 |
| T6 | 2026-10-02 04:16 UTC | Fetched origin/modernize and live GitHub REST readback | Pass | HEAD and fetched upstream both resolve to dca485fd28d14cf91e988fae9ade13729a55c7ee, with ahead/behind 0/0. Published production/runner/fixture bytes match the retained corrected verification evidence. Issue #21 is closed with state_reason completed, closed_at and updated_at 2026-10-02T04:07:43Z; all six acceptance criteria are checked, and the body and closure comment match the authorized drafts exactly. Title, bug label, assignee jeonghanlee and no milestone are preserved. The env-owned full VM rerun remains separate and was not executed here |
| T1 | 2026-10-02 03:01-03:05 UTC | Same corrected bundle, final runner, Debian 13.7/JDK 21/Tomcat 9.0.122, real original IOC and 10-second engine buffer | Pass | work/retrieval-bounds-corrected-ioc-2/ completes all 70 cases with zero failures and exit 0. The live target 2026-10-02T03:04:10.587915144Z, value 100.0, status 3, severity 2, is excluded at minus 1 ns and included at equality. Engine buffer presence, participation and exact internal bounds pass. All 14 physical public responses independently obey their integer-nanosecond upper bounds. This run and the final defective replay use runner SHA-256 ae5e51524ddc669672228b366a31388a7ac55c8e9ff839ac8c7594f175b5ea59 and identical Java/fixture hashes; actual request/response bytes and digest checks are retained |
| T5 | 2026-10-02 03:04-03:05 UTC | Final runner, same corrected four-WAR bundle, retained SQLite/PB storage and IOC alive through restart | Pass | Stored-only boundaries pass with no engine request. Mixed responses preserve the exact original stored tuple and obey to. All old owned JVMs exit before restart; the fresh target 2026-10-02T03:05:20.587987520Z, value 69.0, status 4, severity 1, passes minus-one/equality, buffer, precision, rollover and preceding checks while preserving the original stored sample. Both launcher exits are 143, status stopped, with no children remaining; IOC exits 0. No run-error, forced stop or cleanup error occurs. Independent evidence verifies the original/retained PB bytes and all deployed WAR digests |
| T5 | 2026-10-02 02:53 UTC | Final runner request method and real controlled outer HTTP server; separate from appliance integration | Pass | work/retrieval-bounds-http-evidence/ and work/retrieval-bounds-http-evidence.log retain actual HTTP 503, truncated HTTP 200 and slow HTTP 200 executions. All three errors propagate with the original URL, status and received body retained; truncation and timeout are marked partial. The slow response fails at the unchanged 15-second deadline. Server shutdown is verified. This establishes runner failure-evidence handling, not appliance boundary correctness |

The earlier work/retrieval-bounds-baseline-ioc/ setup failure from an overlong IOC prefix and work/retrieval-bounds-baseline-ioc-2/ restart port-probe failure remain retained. Neither supplies complete baseline credit. work/retrieval-bounds-baseline-ioc-3/ is the complete execution before production edits. The final replay is work/retrieval-bounds-baseline-ioc-4/. Between the two runner versions only request evidence handling changes; an AST comparison confirms identical boundary assertions and lifecycle methods, and both runs retain all 70 cases with passing setup, source-selection and normal cleanup checks.

##### Closure Evidence

- Local source verification: T1-T5 pass with retained defective and corrected complete bundles, actual IOC/PB/HTTP evidence, normal teardown and unchanged regression assertions. work/retrieval-bounds-corrected-evidence.json and work/retrieval-bounds-corrected-evidence-2.log record actual report totals, provenance, native PB input digests, every physical public response and independent integer-nanosecond result checks. HTTP failure evidence is verified separately. Published correction and completed issue closure satisfy T6 and the six source completion criteria; Status is Complete. The boundary results are available for the env-owned full VM rerun, which was not executed in this source verification. Delivery to the env session remains a separate handoff.
- Implementation self-review, 2026-10-02 UTC: four passes cover the author retrospective, initial third-person review, third-person re-review and second-person procedure review. C1 verifies exact serialization and inclusive engine/merge/flush bounds; C2 verifies real IOC/PB paths, retained source/WAR/fixture digests and ordinary cleanup; C3 verifies executable documentation and failure evidence. The initial third-person finding identified missing HTTP failure request/body evidence. The final request method satisfies the approved evidence-retention requirement, and actual HTTP failure checks plus both complete-bundle executions pass their expected judgments without changing boundary or lifecycle assertions. The full re-review and reader procedure review have no remaining must-fix or minor findings; T1-T5 are accepted as local implementation evidence. This is self-review, not independent reviewer approval. T6 now passes with the landing and issue observations below. The env-owned full VM revalidation remains separate and was not executed in this source verification.

- Landing observed 2026-10-02 04:16 UTC: after fetching origin, HEAD and origin/modernize both resolve to dca485fd28d14cf91e988fae9ade13729a55c7ee with ahead/behind 0/0. The published production sources, original fixture and acceptance runner match the executed corrected-bundle evidence. Recheck with `git -C /data/gitsrc/epicsarchiverap-maven fetch origin`, then `git -C /data/gitsrc/epicsarchiverap-maven rev-parse HEAD origin/modernize`.
- Issue closure observed 2026-10-02 04:16 UTC: [#21](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/21) is closed as completed at 2026-10-02T04:07:43Z. All six checked criteria, the updated body and the [closure comment](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/21#issuecomment-5945423730) match the authorized drafts. Recheck with `gh api repos/jeonghanlee/epicsarchiverap-maven/issues/21` and `gh api repos/jeonghanlee/epicsarchiverap-maven/issues/21/comments`.
- Peer reply sent 2026-10-02 at about 23:16 UTC: the response to epicsarchiverap-env's request `live-to-20261001` went by cross-session message to the OFFICE-epicsarchiverap-env session and was queued there. It carries the published correction, the executed boundary results and the next step for jeonghanlee/epicsarchiverap-env#56, and adds that origin/modernize at 6ae206d1eac17a81d49f31d44c638b204541c9e2 has production sources identical to dca485fd. A one-line follow-up corrected the stated recheck time. Queue acceptance does not show that the peer has read or acted on it; no reply is recorded yet.

##### GitHub Projection

Title: Honor nanosecond bounds in live retrieval
Labels: bug
GitHub Milestone: none
Observed State: closed
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-02 04:16 UTC; `gh api repos/jeonghanlee/epicsarchiverap-maven/issues/21` and `gh api repos/jeonghanlee/epicsarchiverap-maven/issues/21/comments` confirm the title above, closed state, state_reason completed, bug label, assignee jeonghanlee, no milestone, and closed_at/updated_at 2026-10-02T04:07:43Z. The body has six checked acceptance criteria and exactly matches the authorized body SHA-256 9fed423b29f6ba2b3b3009c76f95a8c01cd2c61c7290a3917398802ee884da65; the single closure comment exactly matches SHA-256 17d4f63affb99b87b2bcf5caeb19c285d39b2a0054606d69e3a3bfbf602d2c35. Source verification is complete; the env-owned full VM rerun remains outside this completion.

#### M37 - Modernize the retained sample scripts

Origin: daff1b7 / M37
Identity History: none
GitHub Issue: [#22](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/22)
Status: In progress

##### Summary

M17 delivered eight verified commands on a shared client, `archiverClient.py`, and its final inventory (2026-10-02) retains fourteen further scripts and the `emailHandler.py` helper under `docs/book/src/samples` in their upstream form. On 2026-09-28 each of the fourteen completed its operation against the real local appliance at 50e7382a1a3bab64c2f44b6dcf6aa34b01116780 (M17, legacy sample observations). They do not yet meet the contract the eight commands meet. Source at b2eae22a80f573a4dad30b93c2ce125060c778ff shows:

- Thirteen of the fourteen call `requests.get` or `requests.post` directly at 26 sites, none with a timeout; `emailHandler.py` opens its SMTP connection without one.
- `consolidatePausedPVs.py` and `resumePausedPVsMatchingPattern.py` accept any HTTP 200 response as success and do not read the returned validation.
- `consolidateArchivedData.py` pauses, consolidates and resumes with no check between the steps, and resumes a PV that was already paused before it ran.
- `addPostProcessingOperator.py`, `changeArchiveStore.py` and `removeMetaFields.py` post a complete previously read PVTypeInfo with override=true.
- `addPostProcessingOperator.py` selects its targets through getAllPVs without a limit, so the server's default of 500 names applies.
- `checkConnectedPVs.py` divides by the sum of the connected and disconnected counts with no guard for zero.
- `emailHandler.py` reads its configuration file at import, before the three alert scripts parse their arguments.

On 2026-10-04 the scope narrowed to the seven read-only and alert-check scripts; the state-changing scripts moved to M40 and mail delivery to M41, so the bullets above about them are carried there.

##### Scope

Bring the seven retained read-only and alert-check scripts to a defined and verified contract while keeping what each one is for: unarchivedPVs.py, archivedPVsNotInList.py, listTypeChanges.py, checkForEngineActivity.py, checkConnectedPVs.py, checkTypeChangedPVs.py and storageSizeCheck.py. The three alert checks run on demand and report by stdout and exit status. Extract the mechanics they repeat (input reading, HTTP transport, response validation, result output) and keep each script's target selection, request order, side effects and final state explicit. Document each in the scripting page.

Out of scope: emailHandler.py and mail delivery from the alert checks, moved to M41; the seven state-changing scripts, moved to M40 (abortNeverConnectedPVs.py, resumePausedPVsMatchingPattern.py, consolidatePausedPVs.py, consolidateArchivedData.py, changeArchiveStore.py, addPostProcessingOperator.py, removeMetaFields.py); the eight commands delivered by M17 and archiverClient.py, unless the accepted plan names a change to them; archiveFromDB.py and pingCurrentlyDisconnectedPVs.py, retained unchanged until a later decision adds them; stopArchivingCurrentlyDisconnectedPVs.py, excluded by M17's inventory; server corrections, which take their own scope when a script exposes a defect; performance or concurrency claims without measurement.

##### Completion Criteria

- Each of the seven scripts has a defined input, response, dependency, timeout and failure contract. It reports an application-level rejection and an uncertain outcome as such, and does not report success on HTTP 200 alone.
- Each script keeps the distinct procedure recorded in M17's function map: its target selection, request order, side effects and final state. Every intentional change from the legacy behavior is named with its reason.
- Each script is verified by executing its shipped entry point against the real appliance and the shipped IOC fixture. Where an implementation is replaced, the original and the replacement entry points are compared on the same fixtures before the original is removed.
- The scripting page documents each script with commands that reproduce the verified behavior.

##### Dependencies And Decisions

- Origin: M17's final inventory decision of 2026-10-02.
- Research input: M17 / T31 and M17's `Final inventory research and modularization proposal`, which hold the function map of all 25 CLIs, the Bash/curl/jq module proposal and the compatibility constraints. That proposal is neither accepted nor authorized.
- Decision Date: 2026-10-02. Bash is the preferred language (recorded at M17). The language is selected when this plan is accepted, not before.
- Decision Date: 2026-10-04. The implementation language is Bash; curl and jq are the proposed transport and JSON tools from M17's research.
- Decision Date: 2026-10-04. Timeouts apply per HTTP request: `--timeout` takes positive seconds, default 30 and at most 86400, applied to each curl request as its whole-transfer limit. No whole-procedure deadline is imposed, because multi-step procedures scale with the number of PVs and a per-request limit already prevents a hung request.
- Decision Date: 2026-10-04. Legacy behaviors that change: consolidateArchivedData.py checks the result of each step and resumes only the PVs it paused itself; addPostProcessingOperator.py requests getAllPVs with an explicit limit so the server default of 500 names does not truncate its targets; checkConnectedPVs.py handles a zero connected-plus-disconnected total explicitly; emailHandler.py reads its configuration file after the calling script has parsed its arguments (carried with emailHandler.py to M41). The three type-info scripts (addPostProcessingOperator.py, changeArchiveStore.py, removeMetaFields.py) keep posting the complete PVTypeInfo with override=true, add a readback that confirms only the intended field changed, and document that a concurrent change between read and post can be overwritten. Rejecting success on HTTP 200 alone is already a completion criterion.
- Decision Date: 2026-10-04. The recovery-selection and storage-and-configuration groups, which change appliance state, move to M40 in the Backlog; this milestone keeps the read-only and alert groups.
- Decision Date: 2026-10-04. The alert checks run on demand and exit, not as resident monitors; they report on stdout and by exit status and send no mail. emailHandler.py and mail delivery move to M41 in the Backlog. The legacy-behavior decisions above for consolidateArchivedData.py, addPostProcessingOperator.py and the three type-info scripts are carried to M40.
- Decision Date: 2026-10-04. Each replacement is `docs/book/src/samples/<name>.bash`, keeping the script's name with the `.bash` extension; the repeated mechanics (input reading, curl request, response validation, output) live in `docs/book/src/samples/archiverClient.bash`, which each script sources. A script's `.py` original is removed in the same commit as its replacement, after the comparison on the same fixtures.
- Decision Date: 2026-10-04. Tests reuse the Python standard-library harness of M17 under `src/test/pythontests/`: `test_*.py` client-boundary tests run the Bash entry points as subprocesses against a local HTTP server, and a `verify_*.py` runner checks them against the real launcher and IOC fixture. No new test tool is added.
- Decision Date: 2026-10-04. Every `.bash` file passes `bash -n` and `shellcheck` as part of T1.
- Decision Date: 2026-10-04. The alert checks exit 3 when the check could not complete, separate from 1 for a found alert condition, so a scheduler can tell a failed check from an alert.
- Decision Date: 2026-10-04. archiveFromDB.py and pingCurrentlyDisconnectedPVs.py stay out of this milestone, retained unchanged for a later milestone: the first needs libdbStaticHost.so, absent from the installed EPICS Base 7.0.10, and the second needs PyEpics, absent from system Python, so neither can meet the real entry-point verification here.
- Constraints carried from the research: the two consolidation scripts end in different states and stay separate procedures; unarchivedPVs.py and archivedPVsNotInList.py compare different populations and emit different output; the three type-info scripts share transport and keep separate transformations, and removeMetaFields.py has no internal pause or resume; no automatic retry of a mutation; sequential requests are the comparison baseline.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-10-04; owner accepted the five-step plan, the script contracts of both groups and the Test Plan after the first third-person review, whose six findings are applied (loopback SMTP for the original alert scripts in T2, exact JSON Content-Type, byte-order sorting, alert exit 3, 404 handling in listTypeChanges, the scope note in the Summary).
Implementation Authorization: 2026-10-04; owner authorized the accepted plan.
Superseded Plan Artifacts: none

1. Settle the owner decisions and record them here (done 2026-10-04: language, timeout, legacy behaviors, scope, file layout, test harness, static checks).
2. Write each script's contract in this detail (done 2026-10-04: Script contracts below).
3. (done 2026-10-04) Write `archiverClient.bash` with the common mechanics and its client-boundary tests first; then, by group, read-only comparisons and reports (unarchivedPVs, archivedPVsNotInList, listTypeChanges, checkForEngineActivity) and alert checks (checkConnectedPVs, checkTypeChangedPVs, storageSizeCheck): for each script, write the `.bash` replacement and its `test_*.py` cases, run the original and the replacement on the same fixtures, and remove the `.py` original. Each group closes with T1 and T2 before the next begins.
4. (done 2026-10-04) Run the default suite. Closes with T3.
5. (done 2026-10-04) Document each script in `docs/book/src/scripting.md`, including the server constraints recorded in the contracts, and update TESTING.md with the commands of T1 and T2; execute the documented commands verbatim. Closes with T4.

###### Script contracts

Common to every HTTP script: the first positional argument is the explicit BPL URL; `--timeout` applies per request as decided; exit 0 means the operation completed and its output is complete, 1 means the operation was rejected, failed or has an uncertain outcome, 2 means invalid arguments or input detected before any HTTP request; results go to stdout and diagnostics to stderr. A JSON request body is sent with the Content-Type exactly `application/json`, because `PVsMatchingParameter.getPVNamesFromPostBody` matches the header literally and reads any other value, such as one with a charset parameter, as plain-text PV names. Names are sorted in byte order (`LC_ALL=C`), which matches Python's `sorted()` of the originals. Source evidence is origin/modernize 1fda8403.

Group 1, read-only comparisons and reports:

| Script | Purpose and target selection | Request and response | Output and exit | Intentional changes |
| --- | --- | --- | --- | --- |
| unarchivedPVs.py | Rows of a CSV file whose first column names a PV that the appliance does not know; "known" is `getAllExpandedNames` (configured PVs, aliases, fields and pending requests) | One POST `/unarchivedPVs` with the names; the server returns a JSON array of the input names absent from the expanded inventory, and an empty input returns an empty array (`UnarchivedPVsAction`) | The original input row of each returned name, sorted by name; when a name repeats, the last row wins, as today; exit 0 | Send the names as a JSON array body instead of a comma-joined form field, so the request is not bound by the servlet form-size limit; skip blank lines instead of sending an empty name; trim the first column, so `NAME ,meta` names the PV `NAME` instead of `NAME ` with a trailing space, which matches no PV and was reported as unarchived even when `NAME` is archived (decided 2026-10-04 after T2 showed the difference); reject a response that is not a JSON array of input names |
| archivedPVsNotInList.py | Configured PVs (`getAllPVs`, no aliases or pending requests) whose names are absent from the CSV file's first column | One POST `/archivedPVsNotInList`; the server answers 400 for an empty list and otherwise a JSON array of names (`ArchivedPVsNotInListAction`) | Returned names sorted, one per line; exit 0 | Same JSON body, blank-line handling and first-column trimming; an input with no names exits 2 before HTTP, where the original sends one empty name and lists every configured PV (observed in T2 on 2026-10-04) |
| listTypeChanges.py | PVs the engines report as dropping events because of a type change (paused PVs excluded by the engine) | GET `/getPVsByDroppedEventsTypeChange`, then GET `/getPVDetails?pv=` per PV, reading `Archiver DBR type (initial)` and `Archiver DBR type (from CA)`, which mgmt merges from the engine's details | One line per PV in report order, in today's `PV: <name> Previous <type> Current <type>` layout; exit 0 when every PV resolved; a PV whose details lack either field, or whose `/getPVDetails` answers 404 because no appliance holds it any more, is reported on stderr and the run exits 1 after the remaining PVs | Missing detail fields and a 404 are reported instead of stopping the run with a Python KeyError or HTTP error |
| checkForEngineActivity.py | Files under one storage folder whose path and size changed between two walks; no HTTP | Two filesystem walks separated by the interval `-t` seconds (positive integer, default 30) | Today's change-count or no-change message; exit 0 when changes are seen, 1 when none are seen; an unreadable folder exits 2 | A file removed between listing and reading its size, as ETL does when it moves partitions, is skipped instead of aborting the walk; no change exits 1 instead of -1 (status 255). Unchanged from the original: an unreadable subfolder is skipped, and a symbolic link to a file counts with the size of its target |

Constraints found in the source: `/getPVsByDroppedEventsTypeChange` on mgmt combines the engines' reports through `GetUrlContent.combineJSONArrays`, which logs an engine failure and returns what it gathered, so an unavailable engine is indistinguishable from an empty report; correcting that server action is outside this milestone and is reported in the scripting page.
- Decision Date: 2026-10-04. checkForEngineActivity.py exits 1 when no change is seen, like the other scripts, instead of -1 (status 255); a monitoring caller that tests for 255 must test for a nonzero status.

Group 2, alert checks run on demand. Each script is run by an operator or a scheduler, performs one check and exits; it is not a resident monitor and sends no mail. Exit 0 means the check completed and found nothing to report; 1 means the check completed and found the alert condition, reported on stdout; 2 means invalid arguments; 3 means the check could not complete, wholly or for some appliance or report, reported on stderr, and takes precedence over 1 while any alert lines found are still printed. A scheduler can therefore tell an alert from a failed check by status alone.

| Script | Purpose and target selection | Request and response | Output and exit | Intentional changes |
| --- | --- | --- | --- | --- |
| checkConnectedPVs.py | Appliances whose disconnected share of PVs exceeds `-d` percent (default 5.0) | GET `/getApplianceMetrics`; mgmt returns one object per appliance and merges `connectedPVCount` and `disconnectedPVCount` from that appliance's engine, omitting them when the engine does not answer (`ApplianceMetrics`, `EngineMetrics`, `GetUrlContent.combineJSONObjects`) | The mail body on stdout, a `Disconnected PVs in <BPL_URL>` line followed by one line per appliance over the threshold in today's wording, and exit 1; an appliance without counts is reported on stderr as metrics unavailable and the run exits 3; an empty report exits 3 with "Cannot obtain appliance metrics" on stderr; otherwise exit 0 | Reports on stdout and by exit status instead of mail; a zero connected-plus-disconnected total raises no alert instead of a division error; missing counts are reported instead of a KeyError; a URL not ending in `bpl` exits 2 instead of 1; `-d` takes a plain decimal (negative allowed), not the exponent forms Python's float() also accepts |
| checkTypeChangedPVs.py | Any PV the engines report as dropping events because of a type change | GET `/getPVsByDroppedEventsTypeChange` (`DroppedEventsTypeChangeReport`) | The count and one PV name per line on stdout and exit 1, or "No PVs have changed type" and exit 0; an HTTP or response failure exits 3 | Reports on stdout and by exit status instead of mail; same URL rule and response validation |
| storageSizeCheck.py | PVs whose estimated storage rate exceeds `maxsize` GB per year among the report's top entries | GET `/getStorageRateReport?limit=` (default 100); mgmt forwards the limit to every engine and concatenates their reports, so the limit applies per appliance (`StorageRateReport`) | PV and GB per year in descending rate on stdout and exit 1, or no output and exit 0; an HTTP or response failure exits 3 | Reports on stdout and by exit status instead of mail; rejects a non-numeric `storageRate_GBperYear` as a malformed response; prints each rate as the server formats it (Java `Double.toString`, for example `1.5E-4`) and MAXSIZE as given, where the original printed Python float text (`0.00015`, `1.0`); `--limit` must be a positive integer |

Constraints found in the source: `/getPVsByDroppedEventsTypeChange` and `/getStorageRateReport` on mgmt both combine engine reports through `GetUrlContent.combineJSONArrays`, so an unavailable engine reads as "no PVs" and these two checks exit 0 for it; checkConnectedPVs.py does see an unavailable engine through the missing counts. Correcting the two server actions is outside this milestone and is stated on the scripting page.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Client boundary and static | `bash -n` and `shellcheck` on every `.bash` file; `src/test/pythontests/test_*.py` run each shipped `.bash` entry point as a subprocess with only the HTTP transport (a local HTTP server), the filesystem or the clock controlled; no internal function replaced | System Python standard library, bash, curl, jq, shellcheck; loopback HTTP | No static finding; for every script, valid, rejected, malformed, truncated, timed-out and uncertain responses and invalid input produce the contract's stdout, stderr and exit status |
| T2 | Real appliance | A `verify_*.py` runner starts the real launcher with the shipped IOC fixture and runs each script's original `.py` and its `.bash` replacement on the same fixtures, with independent BPL readback; for checkForEngineActivity a real storage folder with and without engine writes; the original alert scripts run with a test `ARCHAPPL_NAGIOS_EMAIL_CONFIG` pointing at a loopback SMTP receiver without TLS or authentication, and the mail each sends is compared with the replacement's stdout | JDK 21, Tomcat 9, SQLite appliance, softIocPVX and the shipped IOC database; loopback SMTP receiver for the original alert scripts | Original and replacement agree except for the named intentional changes, mail content compared with stdout for the alert checks; each script's recorded procedure and output are observed; the runner stops only its own processes |
| T3 | Integration | ./mvnw -B -ntp clean verify | JDK 21, wrapper Maven | Build and the default suite pass |
| T4 | Documentation | Execute the scripting page's and TESTING.md's commands for these scripts verbatim and build the book with the pinned tools | T2 environment; pinned mdBook and mdbook-admonish | Commands reproduce the documented output; the book builds and every sample link resolves |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-10-04 18:40 UTC | System Python 3.13 standard library, bash 5.2, curl 8.14.1, jq 1.7, shellcheck; loopback HTTP | Pass | `bash -n` and `shellcheck -x` clean on archiverClient.bash and the seven scripts; 66 client boundary cases pass in the eight `test_*_bash.py` files (shared client 18, unarchivedPVs 9, archivedPVsNotInList 7, listTypeChanges 8, checkForEngineActivity 7, checkConnectedPVs 8, checkTypeChangedPVs 4, storageSizeCheck 5), covering valid, rejected, malformed, truncated, timed-out and incomplete responses, invalid input, a symlinked entry point, pipe input, character padding, unreadable subfolders and symbolic links. Per-script runs closed each script before its commit. |
| T2 | 2026-10-04 18:37 UTC | Launcher with WARs aa-20261004-30109eaf rebuilt by T3, Tomcat 9.0.122, softIocPVX from EPICS-env-distribution 1.3.0 debian-13 7.0.10, shipped UnitTestPVs.db, 20 archived PVs; originals from git at d1cd363c; loopback SMTP receiver for the original alert scripts | Pass | verify_bash_samples.py for all seven scripts in one run, evidence work/m37-t2-all-2: 18 comparisons pass, both empty type-change reports compared before the real type change, every difference one of the named intentional changes; launcher exit 143, IOC exit 0, no owned JVM left. Earlier per-script and group runs: work/m37-t2-unarchived-3, m37-t2-notinlist, m37-t2-typechanges-2, m37-t2-engineactivity-2, m37-t2-group1, m37-t2-connected, m37-t2-typechangedcheck, m37-t2-storagesize. |
| T3 | 2026-10-04 18:29 UTC | JDK 21, wrapper Maven, tree 30109eaf | Pass | ./mvnw -B -ntp clean verify: BUILD SUCCESS, 900 tests, 0 failures, 0 errors, 0 skipped. |
| T4 | 2026-10-04 18:38 UTC | T2 environment; aa-mdbook image rebuilt from docs/book (mdBook 0.4.52 with mdbook-admonish) | Pass | The documented-commands case of the T2 run executed the scripting page's three Bash blocks verbatim with `bash -e` (exit 0, expected rows and engine changes); the book built into work/m37-book and every `samples/` link and the developer-page anchor on the scripting page resolve. |

##### Closure Evidence

- none

##### GitHub Projection

Title: Modernize the retained sample scripts
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-04 10:07 UTC; issue #22 body updated with the accepted plan's exit 3, Content-Type, sort order and loopback SMTP comparison, and read back matching `work/issue-script-modernization-body.md`, with the title above, assignee jeonghanlee and no GitHub milestone; remote updatedAt is 2026-10-04T10:07:31Z. Recheck with gh issue view 22 on jeonghanlee/epicsarchiverap-maven.

#### M38 - PB last-line search reports a position past the end of a complete file

Origin: daff1b7 / M38
Identity History: none
GitHub Issue: [#23](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/23)
Status: Complete

##### Summary

LineByteStream.seekToBeforeLastLine sets lastReadPointer to the seek position before it calls readNextBatch, and readNextBatch first adds the previous batch's bytesRead to lastReadPointer. Every position read after the search is therefore too large by the size of the previous batch, up to 16384 bytes. seekToBeforePreviousLine sets lastReadPointer after readNextBatch and is correct. PBFileInfo.lookupLastEvent takes the last-sample position and the truncation point from this search. On a complete day file of ZipAppendTailTest the truncation point was 1405597 for a 1389213-byte entry (observed 2026-10-03 while working on M33, with the channel correction of M33 in place). AppendDataStateData.truncateCorruptFile cuts only below the file size, so the overshoot truncates nothing today, and a crashed tail is located through seekToBeforePreviousLine. In main code getTruncationPoint has that one caller and getPositionOfLastSample has none.

##### Scope

Correct the position bookkeeping of seekToBeforeLastLine so that the positions read after it are file offsets, and confirm PBFileInfo's last-sample position and truncation point on plain and ZIP_PER_PV files, complete and with a crashed tail.

Out of scope: the zip channel short reads (M33); other LineByteStream methods unless the accepted plan names them.

##### Completion Criteria

- For a complete PB file, plain and ZIP_PER_PV, PBFileInfo reports the file size as the truncation point and the start of the last line as the last-sample position; for a crashed tail it reports the end of the last complete record.
- A test on the real files fails on the current order and passes after; the existing LineByteStream tests, slow-tagged methods included, pass before and after; the default suite passes.

##### Dependencies And Decisions

- Origin: found while verifying M33 on 2026-10-03; the owner directed the same day that it be recorded as its own milestone and issue rather than fixed under M33.
- M33's ZipAppendTailTest checks only that the truncation point does not cut into a complete entry; this milestone tightens the check to the exact value.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-10-04; owner accepted the four-step plan below after its first third-person review, whose one finding (the slow-tagged LineByteStream tests as T2) is applied.
Implementation Authorization: 2026-10-04; owner authorized the accepted plan.
Superseded Plan Artifacts: none

1. Add a test that reads PBFileInfo of complete and crashed-tail PB files, plain and ZIP_PER_PV, and checks the truncation point and the last-sample position against the file bytes; observe it fail on the current order. Closes with T1 (before part).
2. Set lastReadPointer after readNextBatch in seekToBeforeLastLine, as seekToBeforePreviousLine does, and rerun; tighten ZipAppendTailTest to the exact truncation point. Closes with T1.
3. Run LineByteStreamTest and LineByteStreamByteArrayTest with the slow group included, before and after the change: their slow-tagged testLargeLinesSeekToLastLine and testLastAndFirstLinesWithBoundedStream call seekToBeforeLastLine and are outside the default suite, and testSeekToPreviousLine passes the position read after it to seekToBeforePreviousLine. Closes with T2.
4. Run the default suite. Closes with T3.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit, real files | ./mvnw -B -ntp test with the new test and ZipAppendTailTest | JDK 21, wrapper Maven | Before: the truncation point of a complete file exceeds its size; after: it equals the size and the last-sample position is the start of the last line, plain and ZIP_PER_PV |
| T2 | Unit, slow group | ./mvnw -B -ntp test -Dtest='LineByteStreamTest,LineByteStreamByteArrayTest' -Dtest.excludedGroups=integration,localEpics,flaky, before and after the change | JDK 21, wrapper Maven | All methods of both classes pass before and after, including testLargeLinesSeekToLastLine, testLastAndFirstLinesWithBoundedStream and testSeekToPreviousLine |
| T3 | Integration | ./mvnw -B -ntp clean verify | JDK 21, wrapper Maven | Build and the default suite pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-10-04 06:21 UTC (before and after) | JDK 21, wrapper Maven, tree 351302fe plus the test (before) and the change (after) | Pass | PBFileInfoPositionTest before the change: the four complete-file cases fail (last-sample position 396 for 190 with 10 samples, 1405586 for 1389202 with 86400, plain and ZIP_PER_PV), the four crashed-tail cases pass. After: all 8 pass, and ZipAppendTailTest passes 6 of 6 with the exact truncation point. |
| T2 | 2026-10-04 05:58 UTC (before); 06:33 UTC (after) | JDK 21, wrapper Maven, slow group included, tree 351302fe (before) and with the change (after) | Pass | LineByteStreamTest 8 and LineByteStreamByteArrayTest 7 methods, including testLargeLinesSeekToLastLine, testLastAndFirstLinesWithBoundedStream and testSeekToPreviousLine: 15 pass before and 15 pass after. |
| T3 | 2026-10-04 07:00 UTC | JDK 21, wrapper Maven, tree 351302fe plus the change | Pass | ./mvnw -B -ntp clean verify: BUILD SUCCESS, 900 tests, 0 failures, 0 errors, 0 skipped. |

##### Closure Evidence

- Landed on 2026-10-04: the change is 76c7707d and the plan, review and test record 145b2b5af8c90deee76b5b21e3e32ce953df6a59. Directly after the push at 07:06 UTC, fetch showed local HEAD and origin/modernize both at 145b2b5a, and `git ls-remote --exit-code origin refs/heads/modernize` returned it. The Maven workflow run 37184774667 on 145b2b5a succeeded at 07:39 UTC.
- Linked issue #23: body reconciled with the cause, the change and its verification, all three acceptance criteria checked, and closed as completed on 2026-10-04 at 08:15:11 UTC with a [closure comment](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/23#issuecomment-5978018833). M38 is Complete.

##### GitHub Projection

Title: Report file offsets after the PB last-line search
Labels: bug
GitHub Milestone: none
Observed State: closed
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-04 08:15 UTC; `gh api repos/jeonghanlee/epicsarchiverap-maven/issues/23` confirms state closed with state_reason completed, closed_at 2026-10-04T08:15:11Z, the title above, bug label, no milestone and assignee jeonghanlee. Readback of the body matches `work/issue-pb-last-line-position-body.md` and the closure comment matches `work/issue-pb-last-line-position-close.md`.

#### M39 - Per-request INFO logging without requester or outcome

Origin: daff1b7 / M39
Identity History: none
GitHub Issue: [#24](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/24)
Status: Not started

##### Summary

The ansible-provision lab measured on 2026-10-04, on a Rocky 8.10 deployment of epicsarchiverap-env d09dca7 with 3bdf378c, 32,191 journal lines in 29 minutes under a 903-PV fixture and a two-worker retrieval probe every five minutes, about 31,800 of them seven INFO lines per retrieval request. Five of the seven moved to DEBUG in d80eef3a (M29), which that deployment did not include. At 254a6542 these per-request INFO statements remain: BasicDispatcher.java:44 "Servicing <path>" for every BPL request in all four components, before validation; engine BPLServlet.java:106 and :120 "Beginning request into Engine servlet"; GetEngineDataAction.java:72 "Found a total of N in N(ms)" for every retrieval-to-engine data request. None carries the requester, the HTTP status or a request identifier. On Rocky 8.10 (systemd 239) journald silently drops lines from concurrent request bursts (65 to 137 lines per run with two client workers, none with one; none on Debian 13 with systemd 257), so per-request volume raises the chance of losing lines that matter.

##### Scope

Decide for each remaining per-request INFO statement whether it is used and for what; either replace the statements with one record per external request at its end (requester, path and key parameters, HTTP status, events and elapsed time, with a request identifier the retrieval-to-engine hop carries) or move them below INFO; keep the log level controls able to restore the detail.

Out of scope: the journald version or host configuration; ETL storage-error logging and the mgmt workflow tick (M26); the retrieval lines already at DEBUG (M29).

##### Completion Criteria

- Each listed statement is kept with added fields, replaced by the single request record, or moved below INFO, with the decision and its reason recorded here.
- Under a retrieval and BPL request load, appliance output at the default level contains only the lines the decision keeps; the build and the default suite pass.

##### Dependencies And Decisions

- Origin: request from the ansible-provision session on 2026-10-04, relaying the owner's direction that this logging carry who, what, outcome and a correlation id if it is useful, and go below INFO if it is not.
- Decision Date: 2026-10-04. File the issue adjusted to the current HEAD and track it as its own milestone rather than inside M26.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Settle with the owner, statement by statement, whether a single request record is wanted and which fields it carries, or whether the statements move to DEBUG.
2. Implement the settled form, verify it on the real request path before and after, and run the default suite.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Count the appliance output lines of a real retrieval and BPL request load at the default level before and after the change, from freshly built WARs | JDK 21, Tomcat 9, integration profile | Before, the listed lines per request; after, only the lines the decision keeps |
| T2 | Integration | ./mvnw -B -ntp clean verify | JDK 21, wrapper Maven | Build and the default suite pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, Tomcat 9, integration profile | Pending | none |
| T2 | Not run | JDK 21, wrapper Maven | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Study per-request INFO logging that lacks requester and outcome
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-04 08:46 UTC; issue #24 read back with matching title and body, assignee jeonghanlee and no GitHub milestone; remote updatedAt is 2026-10-04T08:46:17Z. Recheck with gh issue view 24 on jeonghanlee/epicsarchiverap-maven.

## Backlog

### Work

| Group | ID | Work unit | Type | Status | Ready | Deps | Done when / Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Phase 2 | M35 | Report stored-data deletion failures through management BPL | Milestone | Complete | No | | Correction landed as 48c0a692; 857 default tests, 4 Java integration executions and 664 real CLI/PB/ZIP checks pass; issue #18 body reconciled and closed as completed on 2026-10-01; [detail](#m35---report-stored-data-deletion-failures-through-management-bpl) |
| Phase 2 | M40 | Modernize the retained state-changing sample scripts | Milestone | Not started | No | M37 | Each of the seven retained scripts that change appliance state has a defined input, response, timeout and failure contract, keeps its recorded procedure, and passes real-entry-point verification against the appliance; the scripting page documents each; [detail](#m40---modernize-the-retained-state-changing-sample-scripts) |
| Phase 2 | M41 | Mail delivery for the alert checks | Milestone | Not started | No | M37 | emailHandler.py's mail delivery is available to the on-demand alert checks of M37 with a defined configuration, timeout and failure contract and is verified against a real SMTP endpoint; [detail](#m41---mail-delivery-for-the-alert-checks) |

### Backlog Details

#### M35 - Report stored-data deletion failures through management BPL

Origin: daff1b7 / M35
Identity History: none
GitHub Issue: [#18](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/18)
Status: Complete

##### Summary

An actual PlainPB unlink fails with EACCES, but the ETL and management deletion endpoints still report success. Management removes configuration while the target data survives. The shipped CLI therefore reports Delete accepted and batch exit 0. M17 / T26 reproduces this defect through the real appliance path on the existing four-WAR bundle.

##### Scope

Selected correction direction (2026-09-30): propagate failures from explicit deletion's file enumeration through actual file removal, ZIP persistence/finalization and the management acknowledgement. Ordinary ETL retains getETLStreams, markForDeletion and BasicContext.close with their existing selection, logging and deferred/failed-cleanup behavior. Production targets are ETLSource, PlainPBStoragePlugin, PlainPBPathNameUtility, MergeDedupStoragePlugin, etl/bpl/DeletePV and mgmt/bpl/DeletePV. Explicit deletion cannot treat an unsupported source, failed enumeration, failed removal or failed ZIP finalization as successful completion. Management retains configuration and aliases until component deletion and storage finalization are confirmed; files already removed are not restored.

Out of scope: a general deletion transaction, rollback, data restoration, automatic retry/pause/rearchive, storage-format changes, unrelated BPL operations and new CLI behavior.

##### Completion Criteria

- The same actual syscall fault and unchanged M17 / T26 assertions fail on the defective WARs and pass on fresh corrected WARs.
- The failed item reports Outcome unknown, never Delete accepted, with batch exit 1 and exactly one mutation per independent item.
- Later healthy items have correct configuration/alias and PB-data deletion effects; paused control settings and exact baseline records remain unchanged.
- Default configuration-only deletion and explicit data deletion still satisfy M17 / T22-T25.
- Fresh-WAR T10, affected ordinary ETL regressions and normal owned-process cleanup pass; production correction has separate authorization and landing evidence.
- Real storage checks establish strict enumeration and deletion, enumeration failure, changed-size failure, already-absent handling and preserved ordinary getETLStreams/markForDeletion behavior; no internal storage implementation is replaced.
- Failed explicit deletion retains the target's paused configuration and aliases. Existing M17 / T26 assertions remain intact; additional assertions verify this target state.
- Null, non-object, malformed or unsuccessful component responses produce a non-successful acknowledgement before metadata removal, and later independent batch items continue. Component-boundary response checks and complete four-WAR end-to-end checks are reported separately.
- ZIP deletion success is verified by reopening the physical archive after checked finalization and confirming target removal. A real ZIP finalization fault produces an ETL error and nonempty management validation with paused target metadata/aliases retained; shared ordinary ETL cleanup behavior remains unchanged.
- Prepare and execute the strengthened defective-bundle regressions before changing production sources. Current-source, fixture, WAR and build-evidence hash guards remain intact in both defective and corrected runs; retain separate immutable evidence directories.
- Fresh default-suite reports confirm actual execution of PlainPBExplicitDeletionTest, ETLJobRunReportTest, ETLPassDriverTest and ConsolidateETLJobsForOnePVTest; fresh integration-profile reports confirm actual execution of DeletePVTest, DeletePVAfterRestartTest and DeleteMultiplePVTest. Each required class has tests greater than zero, at least one non-skipped execution and zero failures/errors; BUILD SUCCESS with no executed tests is insufficient.

##### Dependencies And Decisions

- Recorded on 2026-09-30 under M17's accepted instruction to record a reproduced hidden deletion defect as separate work for owner direction. The explicit-deletion-only plan and implementation are authorized on 2026-09-30. Authorized verification has started; this row is In progress in its existing Backlog location.
- Decision Date: 2026-09-30. Select option 1: add failure propagation for explicit PV deletion and preserve the ordinary ETL markForDeletion contract. This selects the correction direction; it does not accept or authorize the newly detailed implementation plan.
- Decision Date: 2026-09-30. Following the first plan review, select option 1 to cover enumeration through actual deletion. Add strict explicit enumeration, failed-target metadata/alias assertions and malformed component-response checks to the draft. This scope selection authorizes revising the plan; complete plan acceptance and production implementation authorization remain none.
- Decision Date: 2026-09-30. Apply both findings from the second plan review: require checked ZIP finalization before a successful acknowledgement and move strengthened defective-bundle verification before production changes. This authorizes the plan revision only; plan acceptance and production implementation authorization remain none.
- Decision Date: 2026-09-30. Apply the third plan review finding: verify the three ordinary ETL classes in the default suite and the three deletion classes under the integration profile, with fresh per-class execution counts. This authorizes the plan revision only; plan acceptance and production implementation authorization remain none.
- Confirmed test-selection evidence: pom.xml's integration profile selects integration or localEpics tags, which the three ordinary ETL classes do not carry. On 2026-10-01 05:19:31 UTC, actual Surefire 3.6.0 execution with that profile and ETLJobRunReportTest, ETLPassDriverTest and ConsolidateETLJobsForOnePVTest selected reported Tests run: 0 and BUILD SUCCESS. This confirms the selection defect; it does not verify ordinary ETL behavior or the future production correction.
- Confirmed ZIP boundary evidence: the shipped BasicContext.close suppresses ArchPaths.close exceptions. With an actual ZIP entry deleted and its physical parent moved before close, BasicContext.close returned normally while the entry remained in the reopened on-disk archive; directly closing the shipped ArchPaths raised NoSuchFileException with the entry still retained. This probe checks the storage boundary. The complete corrected four-WAR ZIP success/failure regression is recorded separately under T6.
- Confirmed verification constraint: verify_delete.py compares current production-source digests with the selected bundle manifest before starting. Running strengthened assertions on defective WARs after modifying production would violate this guard. Preserve the guard and execute the defective baseline first; no mismatched-source run has been executed.
- Confirmed review evidence: ordinary PlainPBStoragePlugin.getETLStreams suppresses per-file IOException and applies ETL selection; PlainPBPathNameUtility.getDirectoryStreamsForPV converts NotDirectoryException into an empty stream. GetUrlContent.getURLContentAsJSONObject casts parsed JSON to JSONObject without handling a non-object response. The defective runner initially recorded failed-target metadata without asserting its preservation. T1/T4/T5/T6 record executed checks for the separate strict-deletion path, caller-boundary response handling and strengthened target assertions; ordinary ETL and shared HTTP helper behavior remain unchanged.
- Decision Date: 2026-09-30. Accept the current nine-step plan after its fourth review, including checked ZIP finalization, strengthened defective-bundle verification before production changes and separate default/integration test execution with per-class counts. Recorded at 2026-10-01 05:30:58 UTC. Implementation authorization remains none.
- Decision Date: 2026-09-30. Authorize implementation of the accepted nine-step plan. Begin with the strengthened defective-bundle verification before production changes; transition from Open through Not started to In progress when authorized verification starts. GitHub mutations, commit and push remain separate operations.
- Baseline evidence is M17 / T26, work/delete-live-third/. Plan acceptance does not authorize implementation or GitHub mutations.
- M17 deletion completion depends on this correction and the unchanged fault regression. The correction does not require M17 completion first.
- Confirmed defective source chain: PlainPBStoragePlugin.markForDeletion logs and suppresses deletion exceptions; the defective etl/bpl/DeletePV unconditionally returned status ok, and management removed metadata without requiring successful component results. The six-file correction uses checked explicit deletion and confirmed engine/ETL acknowledgements; the ordinary markForDeletion contract remains unchanged.
- Decision Date: 2026-10-01. Authorize correcting the explicit ZIP key before commit preparation. ArchPaths consumes literal archive and entry paths; obtain them from the decoded URI scheme-specific part so # and literal percent sequences retain their original meaning. Add real writer/reader cases for PV names with #, %23 and + and a storage root with spaces, #, % and +. Shared ArchPaths and ordinary ETL remain unchanged. Fresh verification and commit preparation are authorized; commit, push and GitHub mutations remain separate.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-09-30; current nine-step plan accepted after the fourth review, recorded at 2026-10-01 05:30:58 UTC.
Implementation Authorization: 2026-09-30; explicit owner authorization for the accepted nine-step plan. Start with strengthened defective-bundle verification before production changes. On 2026-10-01, option 1 separately authorizes the literal ZIP key correction, four real writer/reader cases, fresh verification and commit preparation.
Superseded Plan Artifacts: none

1. Before any production-source modification, strengthen verify_delete.py while retaining its existing EACCES fault and every CLI/state/data assertion. Add failed-target paused configuration, inventory and real configured alias-preservation assertions before normal stop and after restart. Preserve independent control/later-target checks. Add the real ZIP success/finalization-fault case described in T6 through the shipped CLI, management, ETL and PlainPB path, controlling only the outer filesystem boundary. Execute T1 and T6 on a fresh dedicated fixture with the matching defective complete bundle and unchanged production sources; retain failing assertions, independent observations and normal cleanup in new evidence directories without replacing work/delete-live-third/. Keep source/fixture/WAR/build-log guards intact. Confirm the intended regressions actually fail before proceeding to production changes.
2. Add ETLSource.getETLStreamsForDeletion(String, ETLContext) and deleteETLStream(ETLInfo, ETLContext) with checked IOException contracts. Defaults report unsupported explicit deletion; they neither call the ordinary ETL methods nor assume success. Leave getETLStreams, markForDeletion and the ETLJob call path intact.
3. Add a checked explicit-enumeration path in PlainPBPathNameUtility using the shipped PV mapping, parent path and filename rules. Preserve the ordinary helper's behavior. Strict enumeration propagates listing/iteration failures and a non-directory parent instead of returning an empty stream. A confirmed absent PV parent or a genuinely empty matching set is successful absence. Match the exact target PV and cover its files without a future cutoff, named flag or hold/gather selection. PlainPBStoragePlugin creates deletion metadata from actual paths and observed sizes without decoding PB payloads or silently skipping empty/corrupt files. Actual filesystem access failures propagate. Its checked removal uses the context path, size comparison and Files.delete: already-absent files succeed, size changes and removal failures raise IOException. Preserve ordinary markForDeletion's current logged skip and exception suppression. MergeDedupStoragePlugin delegates both checked operations to its actual destination ETLSource without wrapping deletion-only handles as readable streams.
4. Switch only etl/bpl/DeletePV's deleteData=true enumeration and removal to the checked operations. An unsupported/unusable source, null stream result, failed enumeration, failed removal or failed storage finalization produces status error and a usable diagnostic, never status ok. Finalize each explicit-deletion store through the actual checked ArchPaths/FileSystem close path before acknowledging success; do not rely on BasicContext.close's suppressed exceptions. Attempt finalization/cleanup of every opened store even after an earlier failure, preserve the failure for the response, and prevent ordinary best-effort cleanup from hiding it. Catch failures while the response writer is open and emit one response. Keep this checked behavior local to explicit deletion; leave shared BasicContext.close and ordinary ETL behavior intact. Do not promise rollback or retry. Configuration-only deletion still removes ETL jobs without deleting stored streams.
5. In mgmt/bpl/DeletePV, require usable engine and ETL acknowledgement objects with status exactly ok and no nonempty or incorrectly typed validation before removing configuration/aliases or returning success. Handle non-object JSON and other component-response failures at this caller boundary without changing the shared HTTP helper. Null, malformed, failed or unconfirmed results return a nonempty management validation. Keep GET/POST batch paths and later independent-item processing. Retain paused target metadata and aliases without undoing earlier engine or storage effects, including when ZIP persistence fails after in-memory entry removal.
6. Add PlainPBExplicitDeletionTest under src/test/edu/stanford/slac/archiverappliance/PlainPB using actual shipped PB writers/readers, path mapping and plugins. Verify complete explicit enumeration independent of ordinary ETL flags/hold rules, exact target isolation, empty-file inclusion, absent handling, a real invalid-parent/listing failure, checked removal, changed-size failure with retained data, ordinary cleanup behavior and real MergeDedup destination delegation. Include actual ZIP_PER_PV deletion and checked finalization: reopen the physical archive after closing, verify target removal on success and retained target data with a propagated exception after an actual filesystem finalization fault. Control only the outer filesystem boundary. Add component-boundary tests through the shipped management handler with actual configuration and controlled outer HTTP responses for null, non-object, malformed, error and invalid validation/status results, checking metadata preservation and later independent batch processing. Do not substitute any internal component in the full four-WAR end-to-end regressions.
7. Stop the example fixture and verify free ports; execute fresh clean verify without the integration profile. Confirm that this default suite actually executes PlainPBExplicitDeletionTest, ETLJobRunReportTest, ETLPassDriverTest and ConsolidateETLJobsForOnePVTest. Retain its fresh Surefire XML reports and build log before another invocation can replace them. Then run only DeletePVTest, DeletePVAfterRestartTest and DeleteMultiplePVTest under the integration profile with those same newly built explicit WARs, retaining that invocation's fresh reports and log separately. For each required class, check the class identity, tests greater than zero, at least one non-skipped execution and zero failures/errors; neither aggregate BUILD SUCCESS nor stale reports establish execution. This set checks both deletion and preserved ordinary ETL behavior without changing existing tags or profile filters. Confirm matching deployed hashes and full fixture teardown before Python starts.
8. Run the same strengthened verify_delete.py regressions from step 1 on a fresh dedicated appliance/IOC with the corrected complete bundle and matching production-source manifest. Require all T22-T26 data, CLI, batch, documentation, control and cleanup assertions plus T6's ZIP persistence/failure checks. Compare the recorded defective failures with corrected passes without weakening hash guards or assertions; retain separate corrected manifests and fault traces. Update documentation's acknowledgement limitation only after the real corrected behavior is observed, then rebuild the book and compare linked sample copies.
9. Record the source/WAR evidence and actual counts, prepare the separate issue projection, and complete landing and issue closure only under their own git-workflow authorization. Return to M17 deletion acceptance before disconnection reporting and final inventory.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Real defect regression | Before production changes, keep the fault and all existing CLI/state/data assertions; add failed-target paused configuration, inventory and real configured alias checks before stop and after restart; execute the same EACCES fault on matching defective sources/WARs, then repeat on matching corrected sources/WARs | Dedicated SQLite appliance, unchanged IOC fixture, real PB reader and owned ETL strace; unchanged manifest guards and separate evidence directories for each bundle | Defective WARs fail conservative CLI and added target-preservation assertions; corrected WARs report Outcome unknown/exit 1, one request per item, retained target metadata/aliases, correct later-item effects and preserved control |
| T2 | Default and affected integration regression | Run fresh clean verify without the integration profile and confirm PlainPBExplicitDeletionTest plus ETLJobRunReportTest, ETLPassDriverTest and ConsolidateETLJobsForOnePVTest in its fresh reports; retain those reports/log before running DeletePVTest, DeletePVAfterRestartTest and DeleteMultiplePVTest under the integration profile with the newly built explicit bundle; retain that invocation's reports/log separately | JDK 21; actual default-suite storage/ETL fixtures; Tomcat 9, real SIOCSetup/TomcatSetup and selected four WARs for deletion integration | Default suite and required classes pass; every required class has tests greater than zero, at least one non-skipped execution and zero failures/errors in its own fresh report; ordinary ETL cleanup behavior is preserved, deployment hashes match and fixture teardown completes before Python starts; zero-test BUILD SUCCESS and stale reports do not count |
| T3 | Integration and documentation | Re-run original M17 / T22-T26 assertions plus the added target-preservation checks, verbatim command blocks and pinned book/copy/link checks | Same corrected complete bundle and fresh real fixture | Both ordinary data modes, batch and identity contracts, storage failure reporting and complete normal cleanup pass; documentation matches observed behavior |
| T4 | Storage regression | Execute PlainPBExplicitDeletionTest with actual PB writer/reader, strict explicit enumeration, real path mapping and PlainPB/MergeDedup plugins; control filesystem failures and file growth; delete actual ZIP_PER_PV entries, finalize through the shipped checked close path and reopen physical archives | Isolated test-owned files under the existing storage layout, including real ZIP_PER_PV archives | Exact target files include empty streams and files excluded from ordinary ETL selection; enumeration failures propagate; absent handling succeeds; changed size fails with data retained; ZIP success persists target removal, a real finalization fault raises an error with target data retained; ordinary cleanup remains unchanged; checked destination delegation works |
| T5 | Management component-boundary regression | Execute the shipped management handler with real configuration and controlled outer HTTP responses; exercise engine/ETL null, non-object, malformed, error and invalid validation/status acknowledgements in single and mixed batches | Isolated management/configuration fixture; component HTTP transport is the controlled boundary | Unconfirmed items produce nonempty validation, retain paused metadata/aliases and do not prevent later independent items; reported separately from the real four-WAR end-to-end run |
| T6 | Real ZIP deletion regression | Through the shipped CLI and actual management/ETL/PlainPB endpoints, delete a paused PV stored with ZIP_PER_PV; verify physical archive contents after finalization; induce an actual filesystem failure during ZIP persistence and prove the owned ETL JVM's failing operation with a path-filtered trace; check target metadata/aliases before stop and after restart plus independent later/control items | Dedicated real appliance/IOC with actual PB data, real ZIP archives and matching source/WAR manifest; run strengthened assertions on the defective bundle before production changes, then on the fresh corrected bundle; no internal substitute | Normal deletion persists target removal; defective WARs fail finalization-error acknowledgement/metadata assertions; corrected WARs produce ETL status error, nonempty management validation and CLI Outcome unknown/exit 1 with retained target metadata/aliases and actual surviving ZIP data; later items, controls, fault restoration and normal cleanup pass independently |
| T7 | Literal ZIP path regression | Execute preservesLiteralZipPathsDuringDeletion through shipped PB writers, mapped paths, checked deletion and PB readers; reopen physical archives and retain a separate control; run the same cases before and after the key correction | JDK 21, real ZIP_PER_PV filesystem, test-owned roots and four parameter cases | Before correction, # and %23 PV names and the special storage root fail with NoSuchFileException while + succeeds. After correction all four cases persist target removal and preserve the control's three actual samples. Fresh default and complete-bundle regressions must also pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-10-01, defective run started 05:41 UTC; corrected run started 08:04 UTC | Matching defective and corrected complete four-WAR bundles, shipped CLI/IOC/PB readers and owned ETL strace | Pass after correction; defective failure preserved | work/delete-defective-strengthened/ records 539 checks, 531 pass and 8 fail, before production changes. Actual PB EACCES retains data but CLI acknowledgement and failed-target configuration/inventory/aliases are wrong before stop and after restart; ZIP normal deletion persistence also fails. Separate work/delete-defective-zip/ records 80 checks, 71 pass and 9 fail; its absent physical fault witness is described under T6. The same strengthened full runner on matching aa-20261001-6552a9f5 passes all 664 checks in work/delete-corrected-live/, including original T22-T26 assertions, actual PB and ZIP faults, target preservation, later/control effects and one mutation per item. All runs exit through normal cleanup. Original work/delete-live-third/ remains intact |
| T2 | 2026-10-01 07:47 UTC default; 07:59 UTC integration; fixture exit checked before Python | JDK 21; fresh clean verify; aa-20261001-6552a9f5 explicit four-WAR bundle, actual Tomcat 9.0.122 and softIocPVX | Pass | Fresh default suite: 853 tests, zero failures/errors/skips, 83 fresh XML reports retained in work/delete-corrected-default-reports/ with work/delete-corrected-default.log. Required class counts: PlainPBExplicitDeletionTest 7, ETLJobRunReportTest 2, ETLPassDriverTest 7, ConsolidateETLJobsForOnePVTest 6. Separate integration: DeletePVTest 2, DeletePVAfterRestartTest 1, DeleteMultiplePVTest 1, all non-skipped and zero failures/errors. work/delete-corrected-integration-reports/, work/delete-corrected-integration.log and work/delete-corrected-java-evidence.json retain class identity/counts and all 12 deployed WAR hashes matching work/delete-corrected-bundle/manifest.json, which pins 610 production/resource/configuration sources. After normal teardown no Java or softIocPVX process remains and TCP 17665/17670 and UDP 21875 are free. Earlier zero-test selection provides no behavior-verification credit |
| T3 | 2026-10-01, corrected CLI run and 08:30 UTC book build | Same corrected complete bundle, real CLI/appliance/IOC, actual PB readers, pinned mdBook 0.4.52 and mdbook-admonish 1.20.0 | Pass | All 664 real-path checks pass, including original data modes, batch/identity contracts, exact scripting command blocks, controls and normal cleanup. Python client suites separately pass 56 plus 14 tests. The acknowledgement documentation describes checked deletion and retained failed-target metadata. The pinned image builds successfully; the book builds with only the permitted 0.4.51/0.4.52 admonish warning. Output is isolated at work/delete-corrected-book/ because the default output contains files owned by another user. All 8 scripting sample copies are byte-identical and linked. work/delete-corrected-evidence.json, work/delete-corrected-mdbook-isolated.log and client logs retain the checks |
| T4 | 2026-10-01 07:15 UTC focused; fresh default suite completed 07:47 UTC | JDK 21; shipped PlainPB/MergeDedup plugins, PB writer/reader and actual filesystem/ZIP fixtures | Pass | PlainPBExplicitDeletionTest executes 7 tests with zero failures/errors/skips in both focused and fresh default invocations. Actual exact enumeration, empty/corrupt files, ordinary-selection independence, changed-size rejection, already-absent handling, invalid-parent/removal errors, ZIP persisted success and real finalization failure, and MergeDedup delegation pass. work/delete-corrected-focused.log, work/delete-corrected-focused-reports/ and the separately retained default reports/log establish actual execution |
| T5 | 2026-10-01 07:15 UTC | Shipped management DeletePV and actual ConfigServiceForTests; controlled outer component HTTP and servlet boundaries | Pass | DeletePVAcknowledgementTest executes 28 parameter cases with zero failures/errors/skips, each exercising GET single/batch and POST form/JSON. Engine/ETL null, non-object, malformed, unsuccessful and invalid validation/status acknowledgements preserve paused target metadata/aliases and permit independent later items. Same focused log/reports as T4; this is separate from four-WAR appliance verification |
| T6 | 2026-10-01, defective run before production changes; corrected ZIP fault at 08:14 UTC | Real CLI/management/ETL/PlainPB ZIP_PER_PV path, matching complete bundles and actual IOC data | Pass after correction; defective limitation preserved | The defective ZIP continuation records 80 checks, 71 pass and 9 fail. Normal ZIP deletion retains samples and the fault request falsely succeeds, removing target metadata/aliases. No physical archive replacement occurs there, so injected EACCES is not witnessed; that failed assertion remains part of the defective record. On the corrected complete runner, normal ZIP deletion persists removal. zip-filesystem.trace witnesses physical archive unlink EACCES (INJECTED); actual ETL logs show finalization AccessDeniedException, management returns nonempty validation and the CLI reports Outcome unknown/exit 1. Target exact ZIP records, paused configuration/inventory/aliases survive before stop and after restart; later healthy deletion, controls, fault restoration and normal cleanup pass. work/delete-corrected-live/ and work/delete-corrected-evidence.json retain the actual path and all 664 passing checks |

###### Literal ZIP key correction verification

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-10-01 09:38-09:49 UTC; evidence rechecked 09:50 UTC | Fresh matching literal-key correction bundle, actual CLI/IOC/management/ETL/PB path | Pass | work/delete-zip-key-live/ passes all 664 unchanged full-run assertions. Actual PB-file EACCES reports Outcome unknown/exit 1; paused failed-target configuration/inventory/aliases and surviving data remain before stop and after restart. Later independent items, controls and normal cleanup pass. The defective 539/80-check observations above remain unchanged; work/delete-zip-key-evidence.json pins current source/WAR/fixture hashes |
| T2 | 2026-10-01 09:26 UTC default; 09:37 UTC integration; 09:38 UTC teardown check | JDK 21; fresh clean verify, Tomcat 9.0.122 and real softIocPVX; work/delete-zip-key-bundle/ | Pass | 857 default tests, zero failures/errors/skips, 83 fresh XMLs in work/delete-zip-key-default-reports/. Required class counts: PlainPBExplicitDeletionTest 11, DeletePVAcknowledgementTest 28, ETLJobRunReportTest 2, ETLPassDriverTest 7 and ConsolidateETLJobsForOnePVTest 6. Separate integration reports execute DeletePVTest 2, DeletePVAfterRestartTest 1 and DeleteMultiplePVTest 1, zero failures/errors/skips. All 12 deployed WAR copies match the new four-WAR manifest; no JVM/IOC or TCP/UDP listener survives integration. work/delete-zip-key-default.log, work/delete-zip-key-integration-reports/, work/delete-zip-key-integration.log and work/delete-zip-key-java-evidence.json retain actual execution |
| T3 | 2026-10-01 09:21 UTC book; 09:38-09:49 UTC real appliance; evidence rechecked 09:50 UTC | Current complete bundle, real CLI/PB readers; pinned mdBook 0.4.52 and mdbook-admonish 1.20.0 | Pass | All 664 real-appliance checks include both modes, batch/identity contracts, verbatim scripting commands, controls and normal cleanup. Earlier 56 plus 14 client tests remain applicable: all eight sample hashes match those tested sources. The fresh pinned book build exits 0 with only the permitted preprocessor-version warning; all eight sample copies and links match. work/delete-zip-key-book/, work/delete-zip-key-mdbook.log and work/delete-zip-key-evidence.json retain current checks |
| T4 | 2026-10-01 09:26 UTC | Fresh default suite, actual PlainPB/MergeDedup writers/readers/filesystems | Pass | PlainPBExplicitDeletionTest executes 11 non-skipped cases with zero failures/errors, including all seven original storage cases and four literal ZIP path cases. work/delete-zip-key-default-reports/ and work/delete-zip-key-default.log preserve the current-version reports separately from the earlier seven-case execution |
| T5 | 2026-10-01 09:26 UTC | Actual management handler and configuration; outer component HTTP/servlet boundaries controlled | Pass | DeletePVAcknowledgementTest executes 28 non-skipped cases with zero failures/errors in the fresh default suite. Unconfirmed responses retain metadata/aliases and later independent GET/POST items proceed. This component-boundary result remains separate from the complete four-WAR run |
| T6 | 2026-10-01 09:38-09:49 UTC | Real ZIP_PER_PV CLI/management/ETL/PlainPB path on the new matching complete bundle | Pass | Normal ZIP deletion persists removal. work/delete-zip-key-live/zip-filesystem.trace witnesses physical archive unlink EACCES (INJECTED), and zip-finalization-fault-observed passes. The CLI reports Outcome unknown/exit 1; exact target ZIP records and paused configuration/inventory/aliases survive normal stop and restart. Later healthy deletion, controls and fault restoration pass. All eight stops exit 143 without fallback; final IOC exit is 0 with no owned JVM/tracer or cleanup errors |
| T7 | 2026-10-01, focused before/after correction; fresh default completed 09:26 UTC | Same four preservesLiteralZipPathsDuringDeletion parameter cases over shipped writers/readers/plugins and physical archives | Pass after correction | work/delete-zip-key-baseline.log executes four cases: three NoSuchFileException errors for #, literal %23 and the special storage root; the + case succeeds. work/delete-zip-key-after.log executes the same four cases with zero failures/errors/skips. Target removal persists after checked close and reopening the physical archive; a separate control retains all three actual PB samples. The current fresh default suite and rebuilt-bundle integration/real regressions also pass |

##### Closure Evidence

- The current implementation satisfies the accepted nine-step plan and the separately accepted literal ZIP key correction under T1-T7. work/delete-zip-key-evidence.json records 857 default tests, 4 Java integration executions and 664 real-appliance checks with no failures/errors/skips, 70 passing tests on unchanged client sources, eight identical linked samples and normal owned-process cleanup. The four literal ZIP cases fail with three errors before correction and all pass after correction. The six production targets retain checked explicit enumeration/removal, per-store ZIP finalization and conservative management acknowledgement without changing ordinary ETL or shared BasicContext/HTTP-helper contracts. Earlier work/delete-corrected-* evidence remains the record of the preceding source version.
- Landing: 48c0a692b60547969819ccf469bb6343215c60aa on origin/modernize, observed 2026-10-01 16:33 UTC. The fetched upstream was current before the authorized commit/push. The commit contains exactly the 16 authored production/client/test/documentation files; generated build and Python cache files are excluded. After push, git ls-remote --exit-code origin refs/heads/modernize and local HEAD/upstream all resolve to that exact commit, with ahead/behind 0/0. The 610 production-source and four-WAR digests remain pinned in work/delete-zip-key-bundle/manifest.json and match the landed correction.
- Issue closure: completed at 2026-10-01 16:47:15 UTC, observed by `gh api repos/jeonghanlee/epicsarchiverap-maven/issues/18` and the closure-comment API readback. The issue body exactly matches work/issue-delete-errors-body.md, all ten criteria are checked, and [the closure comment](https://github.com/jeonghanlee/epicsarchiverap-maven/issues/18#issuecomment-5936116942) exactly matches work/issue-delete-errors-close.md. A 16:57 UTC API recheck confirms state closed, state_reason completed and updated_at 2026-10-01T16:47:15Z, unchanged title/bug label/assignee and no milestone. The accepted implementation, required executed checks, remote landing and linked issue closure are satisfied; M35 is Complete.

##### GitHub Projection

Title: Report stored-data deletion failures instead of acknowledging success
Labels: bug
GitHub Milestone: none
Observed State: CLOSED
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-01 16:57 UTC; `gh api repos/jeonghanlee/epicsarchiverap-maven/issues/18` confirms closed/completed, the title above, bug label, assignee jeonghanlee, no milestone and updated_at/closed_at 2026-10-01T16:47:15Z. The remote body records the landed 48c0a692 correction and actual verification, exactly matches the prepared body and has ten checked criteria. The closure comment was read back and exactly matches the prepared file. No projection difference remains.

#### M40 - Modernize the retained state-changing sample scripts

Origin: daff1b7 / M40
Identity History: split from M37 on 2026-10-04
GitHub Issue: none
Status: Not started

##### Summary

M37 originally held fourteen retained sample scripts. On 2026-10-04 the owner kept the read-only and alert groups in M37 and moved the two groups that change appliance state here: recovery selection (abortNeverConnectedPVs.py, resumePausedPVsMatchingPattern.py) and storage and configuration (consolidatePausedPVs.py, consolidateArchivedData.py, changeArchiveStore.py, addPostProcessingOperator.py, removeMetaFields.py). M37's Summary records their current defects: no timeouts, HTTP 200 taken as success, the unchecked pause, consolidate and resume sequence with an unconditional resume, the full PVTypeInfo post with override=true, and the getAllPVs default limit of 500.

##### Scope

Bring these seven scripts to the contract M37 defines for its scripts (explicit BPL URL, per-request `--timeout`, exit 0, 1 and 2, results on stdout and diagnostics on stderr), reusing M37's shared Bash mechanics, while keeping each script's target selection, request order, side effects and final state explicit. Document each in the scripting page.

Out of scope: the M37 scripts; the eight commands delivered by M17; server corrections, which take their own scope when a script exposes a defect.

##### Completion Criteria

- Each of the seven scripts has a defined input, response, dependency, timeout and failure contract, reports an application-level rejection and an uncertain outcome as such, and does not report success on HTTP 200 alone.
- Each keeps the procedure recorded in M17's function map, and every intentional change from the legacy behavior is named with its reason.
- Each is verified by executing its shipped entry point against the real appliance and the shipped IOC fixture, with the original and the replacement compared on the same fixtures before the original is removed; the scripting page documents each.

##### Dependencies And Decisions

- Origin: split from M37 by the owner on 2026-10-04; unassigned until the owner assigns it.
- M37: the language (Bash), the per-request timeout and the shared mechanics come from M37.
- Decisions carried from M37 (Decision Date 2026-10-04): consolidateArchivedData.py checks the result of each step and resumes only the PVs it paused itself; addPostProcessingOperator.py requests getAllPVs with an explicit limit; the three type-info scripts keep posting the complete PVTypeInfo with override=true, add a readback that confirms only the intended field changed, and document that a concurrent change between read and post can be overwritten.
- Constraints carried from the research: the two consolidation scripts end in different states and stay separate procedures; removeMetaFields.py has no internal pause or resume; no automatic retry of a mutation.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Write each script's contract in this detail from the server actions it calls.
2. Implement by group, recovery selection then storage and configuration, each closed by T1 and T2.
3. Run the default suite and document each script. Closes with T3 and T4.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Client boundary | Run each shipped entry point as a subprocess with only the HTTP transport, filesystem or clock controlled | Selected shell tools; loopback endpoints | Valid, rejected, malformed, timed-out and uncertain responses produce the contract's output and exit status |
| T2 | Real appliance | Run each shipped entry point against the four-WAR appliance and the shipped IOC fixture with independent readback of the resulting state; compare original and replacement on the same fixtures | JDK 21, Tomcat 9, SQLite appliance, softIocPVX | Each recorded procedure and final state are observed |
| T3 | Integration | ./mvnw -B -ntp clean verify | JDK 21, wrapper Maven | Build and the default suite pass |
| T4 | Documentation | Execute the scripting page's commands for these scripts verbatim and build the book with the pinned tools | T2 environment; pinned book tools | Commands reproduce the documented output and state |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | Selected shell tools; loopback endpoints | Pending | none |
| T2 | Not run | Real appliance and shipped IOC fixture | Pending | none |
| T3 | Not run | JDK 21, wrapper Maven | Pending | none |
| T4 | Not run | T2 environment; pinned book tools | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: none
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: not created

#### M41 - Mail delivery for the alert checks

Origin: daff1b7 / M41
Identity History: split from M37 on 2026-10-04
GitHub Issue: none
Status: Not started

##### Summary

The three alert scripts (checkConnectedPVs.py, checkTypeChangedPVs.py, storageSizeCheck.py) send their alerts by mail through the emailHandler.py helper. On 2026-10-04 the owner made them on-demand checks in M37 that report by stdout and exit status and send no mail, and moved emailHandler.py and mail delivery here. Today the helper reads its JSON configuration (named by `ARCHAPPL_NAGIOS_EMAIL_CONFIG`, default `/arch/tools/config/archappl_email_config`) at import, before the calling script parses its arguments; opens its SMTP connection without a timeout; and names only the first recipient in the To header while sending to all.

##### Scope

Provide mail delivery for the alert checks as an option on top of their stdout and exit-status contract: configuration read after argument parsing, a per-connection timeout, credentials kept off the command line, and a defined failure status.

Out of scope: the alert checks themselves (M37).

##### Completion Criteria

- Mail delivery has a defined configuration, timeout and failure contract and is verified by sending through a real SMTP endpoint; a configuration or SMTP failure is reported and reflected in the exit status.

##### Dependencies And Decisions

- Origin: split from M37 by the owner on 2026-10-04; unassigned until the owner assigns it.
- M37: the alert checks and their stdout and exit-status contract come from M37.
- Decision carried from M37 (Decision Date 2026-10-04): emailHandler.py reads its configuration after the calling script has parsed its arguments.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Settle with the owner whether mail stays in Bash through curl's SMTP support or another sender, and how the alert checks enable it.
2. Implement and verify against a real SMTP endpoint.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Client boundary | Run the alert checks with mail enabled against a local SMTP endpoint, including a refused and a silent server | Selected shell tools; loopback SMTP | Mail is delivered with the expected headers and body; failures are reported with a nonzero exit within the timeout |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | Selected shell tools; loopback SMTP | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: none
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: not created

## Assignment History

| Date | ID | From | To | Sync Commit | Note |
| --- | --- | --- | --- | --- | --- |
| 2026-09-19 | M7 | Milestone (Phase 1) | Backlog | 3c96141d | No owner item list yet; unassigned until the site-required list is provided. |
| 2026-09-19 | M10 | Milestone (Phase 1) | Backlog | 3c96141d | Ant removal deferred (D7); moved to backlog to close out Phase 1's active work. |
| 2026-09-22 | M17 | Backlog | Milestone (Phase 2) | f03029b8 | Assigned to Phase 2 with the rest of the backlog; execution still waits on the owner's keep/cut list. |
| 2026-09-22 | M7 | Backlog | Milestone (Phase 2) | f03029b8 | Assigned to Phase 2 with the rest of the backlog; execution still waits on the owner's item list. |
| 2026-09-22 | M10 | Backlog | Milestone (Phase 2) | f03029b8 | Assigned to Phase 2 with the rest of the backlog; remains Deferred under D7. |
| 2026-09-25 | M23 | Backlog | Milestone (Phase 2) | this synchronization commit | Assigned to Phase 2; the items to fix still wait on the owner's choice. |
| 2026-09-28 | M29 | Backlog | Milestone (Phase 2) | this synchronization commit | Assigned to Phase 2 with the rest of the backlog on the owner's direction; the plan stays draft. |
| 2026-09-28 | M30 | Backlog | Milestone (Phase 2) | this synchronization commit | Assigned to Phase 2 with the rest of the backlog on the owner's direction; the plan stays draft. |
| 2026-09-28 | M31 | Backlog | Milestone (Phase 2) | this synchronization commit | Assigned to Phase 2 with the rest of the backlog on the owner's direction; the plan stays draft. |
| 2026-09-28 | M32 | Backlog | Milestone (Phase 2) | this synchronization commit | Assigned to Phase 2 with the rest of the backlog on the owner's direction; the plan stays draft. |
| 2026-10-04 | M40 | Milestone (Phase 2), part of M37 | Backlog | this synchronization commit | The owner moved M37's recovery-selection and storage-and-configuration groups into a new Backlog row; M37 keeps the read-only and alert groups. |
| 2026-10-04 | M41 | Milestone (Phase 2), part of M37 | Backlog | this synchronization commit | The owner made M37's alert scripts on-demand checks without mail and moved emailHandler.py and mail delivery into a new Backlog row. |

## History

| Reset Date | Prior State Commit |
| --- | --- |
| 2026-09-11 | daff1b7da2834bdb121aa2cac6c841a6ce9d43fa |
