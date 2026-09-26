# Work Register

Release line: master
Milestone index: daff1b7
Canonical path: `docs/milestone-daff1b7.md`
Canonical branch or ref: modernize
Git upstream: origin/modernize
Remote tracker: jeonghanlee/epicsarchiverap-maven (aa-maven); GitHub issues per row once enabled, no GitHub milestone
Peer register: aa-env at jeonghanlee/epicsarchiverap-env, `docs/milestone-265f580.md` on branch modernize (cross-referenced per D2 and D3)

Next session entry point: M16 (mgmt API reference generated from code) is complete (2026-09-18): the reference is generated from the BPLServlet registry and @BPLEndpoint annotations into the mgmt WAR ui/api, replacing the scp/taglet/sphinx relay; M14 is complete (2026-09-18): svg_viewer is vendored as a committed viewer.zip and the build is offline-self-sufficient (a30d8cd3). M6 is complete (upstream selective adoption). M11 is complete: sqlite-jdbc runtime dependency added and the SQLite persistence path verified (2026-09-18); with M11 done, M13 (reframed 2026-09-18 to a selectable MariaDB/SQLite backend, both drivers kept, per the aa-env parallel decision) is unblocked and coordinated with aa-env. Nineteen units are applied (PR360, PR364, PR408, PR417, PR423, PR425, PR445, PR454, PR480, PR481, PR516, PR461, PR396, PR474, PR501, PR505, PR452, PR521, PR520 committed). PR433, PR385, PR400, PR405, and PR448 are skipped (PR385 superseded by the fork's backward cross-chunk retrieval, verified by GetDataAtTimeChunkBoundaryTest; PR400 a pure URLKey refactor with no behavior change; PR405 a JSONAware refactor fundamentally incompatible with the fork's diverged GetDataAtTime; PR448 would change the archiver's value-before-window retrieval convention). All 25 retained units are triaged (Tier A to D complete): 19 applied, 6 skipped (PR433, PR385, PR400, PR405, PR448, PR527). Three are excluded (PR429, PR458 by D26; PR359 by D27). Next: M6 selective adoption is done. M9 is complete (2026-09-19): docs migrated to an mdBook published live at https://jeonghanlee.github.io/epicsarchiverap-maven/ (D29; T1/T2/T3 Pass), Sphinx/Read the Docs retired. Narrative content currency for the single-instance fork is deferred to backlog M17 (D30). This retired Sphinx/Read the Docs and folded the docs pipeline out of M5, which now covers only the Maven CI workflow; M5 is complete (2026-09-19): the maven.yml run 35423900164 (commit b0fcbb61) landed green. Maven 3.9.16 is committed as d12382d1 with CI skipped; Wrapper startup and validate passed locally. Phase 1 is complete: with M5 closed, M7 (site-required features, no owner item list yet) and M10 (Ant removal, deferred by D7) moved to the backlog on 2026-09-19, leaving every Phase 1 row Complete; the next active work is Phase 2 (M12 backend pruning, M13 selectable MariaDB/SQLite). On 2026-09-22 the backlog (M17, M7, M10) was assigned to Phase 2, so Phase 2 now carries M12, M13, M17, M7, and the deferred M10, and the Backlog is empty. Sustained-operation evidence (2026-09-23, ansible-provision soak pilot at 3c96141d): 31.5 h continuous, STS-to-MTS ETL observed for all 11 pilot PVs including the jeonghanlee/epicsarchiverap-env#25 name shape, MTS-to-LTS pending 2026-09-24/25, zero restarts and flat memory; the pilot exposed an aa-env provisioning gap (jeonghanlee/epicsarchiverap-env#47: configuration schema not loaded, so PV configuration is not persisted there) that M13's contract documentation must close. Single host, light workload and a 256M heap override, so capacity, retention, retrieval under load, connection pool and restart survival remain unmeasured. Current (2026-09-25): M13 / T2 (MariaDB on the real deploy path) passed; M13 stays Blocked on G2 for its SQLite check, and its plan is a draft awaiting owner acceptance. M18 (logging model, D31) is Complete: its layout landed as a1155ef0, which closed aa-env's G14, and G3 closed on 2026-09-25. M19 (Tomcat log4j jar set, D32) is Complete: 9bbd69bf landed and was reported to aa-env for its G15. M18's layout moved to src/resources/main with monitorInterval in 67be91d7 so every site build ships it (aa-env G16). M20 (runtime log-level control, BPL) is Complete at 3070c518. G1 is Complete (Issues enabled 2026-09-24); the owner decided on 2026-09-25 to project the M rows to GitHub issues, as D2 and D3 require. M21 (issue #1, consolidateDataForPV for an unknown PV) is Complete at 25606494 with #1 closed. The open M rows were projected to GitHub issues on 2026-09-25 as summaries without milestone and decision IDs: M7 #2, M10 #3, M12 #4, M13 #5, M17 #6; completed rows are not projected. On 2026-09-25 M22 and M23 were projected as #7 and #8, and the bodies of #3, #5 and #6 were brought in line with the code and the rewritten book. Next action: M12 is Ready; M17 is In progress under its accepted plan with steps 1 and 3 landed, and what remains of step 2 is T5, the Python BPL client check, which waits for M22, the local launcher that follows M13 (the TESTING.md and mvnw.cmd candidates were settled on 2026-09-25); M7 is Ready but its items wait on the owner's list; M13 waits on G2 and on owner acceptance of its plan (on 2026-09-25 aa-env scheduled jeonghanlee/epicsarchiverap-env#43 to start after its current item and will send its revised SQLite plan here for comment); M10 stays Deferred under D7. M23 (the code defects found while rewriting the docs) is In progress since 2026-09-26 under an accepted plan in three groups (site configuration, retrieval request handling, mgmt UI and BPL); its item 9 moved to M12; the Backlog is empty.

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
| Phase 2 | M13 | Selectable persistence backend: MariaDB and SQLite | Milestone | Blocked | No | M11, G2 | Both drivers ship; the backend is chosen by the JNDI DataSource; MariaDB and SQLite paths verified; [detail](#m13---selectable-persistence-backend-mariadb-and-sqlite) |
| Phase 2 | M17 | Modernize the narrative doc content for the single-instance fork | Milestone | In progress | No | | Upstream-era content reconciled to the single-instance scope and the EPICS-Arche boundary per an owner keep/cut list; [detail](#m17---modernize-the-narrative-doc-content-for-the-single-instance-fork) |
| Phase 2 | M7 | Site-required features and fixes | Milestone | Not started | Yes | | Owner-identified items implemented and verified; awaiting the owner's item list; [detail](#m7---site-required-features-and-fixes) |
| Phase 2 | M10 | Ant removal: final Maven-only consolidation | Milestone | Deferred | No | D7 | build.xml gone and antrun executions rehomed; only Maven remains; deferred per D7; [detail](#m10---ant-removal-final-maven-only-consolidation) |
| Phase 2 | M18 | Appliance logging model: journald-first log4j2 layout and lifecycle | Milestone | Complete | No | D31, G3 | The shipped log4j2.xml emits the <N> priority prefix with a ${env:ARCHAPPL_ROOT_LOGGER_LEVEL:-INFO} root level and a capped, commented RollingFile fallback; the operating-model page and the faq/install-guide fixes land; [detail](#m18---appliance-logging-model-journald-first-log4j2-layout-and-lifecycle) |
| Phase 2 | M19 | Tomcat log4j jar set from the build | Milestone | Complete | No | D32 | The build writes log4j-api, log4j-core, log4j-appserver and log4j-jul at ${log4j.version} to target/tomcat-log4j and the release tarball carries them; the logging page describes Tomcat and java.util.logging lines through log4j2; [detail](#m19---tomcat-log4j-jar-set-from-the-build) |
| Phase 2 | M20 | Runtime log-level control per component | Milestone | Complete | No | D31 | mgmt BPL getLogLevel and setLogLevel change a named logger or the root level in one running component without a restart, forwarded to that component's own BPL; [detail](#m20---runtime-log-level-control-per-component) |
| Phase 2 | M21 | Reject consolidateDataForPV for an unknown PV | Milestone | Complete | No | | consolidateDataForPV for a PV with no PVTypeInfo returns HTTP 400 with one ERROR line instead of HTTP 500 and a NullPointerException; issue #1 closed manually citing the fix commit; [detail](#m21---reject-consolidatedataforpv-for-an-unknown-pv) |
| Phase 2 | M22 | Local appliance launcher in one folder | Milestone | Not started | No | M13 | One bash script starts the four WARs of a local build as four Tomcat instances on SQLite, with every file under one temporary folder and no systemd; BPL and a PV archive round trip answer; [detail](#m22---local-appliance-launcher-in-one-folder) |
| Phase 2 | M23 | Code defects found while rewriting the docs | Milestone | In progress | No | | Each listed defect is fixed and verified, or kept with a recorded reason; [detail](#m23---code-defects-found-while-rewriting-the-docs) |
| Tracking | G1 | aa-maven GitHub issues enabled | External gate | Complete | No | | Repository setting has_issues=true; [detail](#g1---aa-maven-github-issues-enabled) |
| Tracking | G2 | aa-env SQLite deploy path | External gate | Open | No | | aa-env deploys the appliance with the SQLite backend (jeonghanlee/epicsarchiverap-env#43 closed with a landed commit); [detail](#g2---aa-env-sqlite-deploy-path) |
| Tracking | G3 | Journald layout observed on a deployed host | External gate | Complete | No | | epicsarchiverap-env reports its logging item's check at or after the M18 layout commit: per identifier, ERROR lines at PRIORITY 3 and INFO lines at 6 on a deployed host; [detail](#g3---journald-layout-observed-on-a-deployed-host) |

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
Status: Blocked

##### Summary

Ship both mariadb-java-client and sqlite-jdbc and let the persistence backend be selected at install, rather than removing MariaDB. MySQLPersistence already detects the SQLite vs MySQL dialect from the DataSource (M11), so the selection is made by the JNDI DataSource wired per instance. This row completes Phase 2's persistence scope (alongside M12's backend pruning): the appliance runs as WARs on Tomcat 9 under aa-env's systemd units against either MariaDB or SQLite.

##### Scope

Keep both drivers shipped; confirm the persistence layer works against both the MariaDB and SQLite dialects; document the selectable-backend contract (which DataSource selects which backend) for aa-env. The backend selector itself lives in aa-env (context.xml DB_BACKEND).

Out of scope: removing either driver; the SQLite dialect itself (exists, M11); backend pruning (M12).

##### Completion Criteria

- Both mariadb-java-client and sqlite-jdbc ship in the WARs; the persistence path is verified against MariaDB and against SQLite; the selectable-backend contract is documented and agrees with aa-env's parallel model.

##### Dependencies And Decisions

- M11 (SQLite path, Complete); D8.
- D28 (2026-09-18): keep MariaDB and SQLite in parallel and select the backend at install, superseding the SQLite-only end state of D11 and D13. Aligns with the aa-env owner's parallel/selectable decision (2026-09-18); aa-env relies on both drivers staying in the WARs.
- 2026-09-21: jna and jna-platform (5.13.0, runtime) are declared explicitly in the pom and allowlisted for analyze-only, so the MariaDB Unix-socket (localSocket) path no longer relies on jna arriving transitively through mariadb-java-client and waffle-jna; a future drop now shows as a visible dependency change rather than a runtime-only socket failure. Landed 85f0f179; coordinated with the aa-env JNA gate.
- Observation (2026-09-23, ansible-provision soak pilot: one Rocky Linux 8.10 VM, aa-maven 3c96141d built by aa-env 6a026d4, four instances, 11 scalar PVs at 1 Hz, 31.5 h continuous): archiving, STS-to-MTS ETL and spot retrieval ran against MariaDB 10.3.39 over loopback TCP through the JNDI DataSource jdbc/archappl with zero JVM restarts and flat memory. The configuration schema had not been loaded on that deployment (SHOW TABLES empty; mgmt logs Table 'archappl.PVTypeInfo' doesn't exist, and the same for PVAliases), so every MySQLPersistence write failed and PV configuration lived only in memory, which would not survive an appliance restart; archiving, ETL and retrieval were unaffected, which is why functional checks pass. The cause is in the aa-env provisioning path, confirmed by aa-env and filed as jeonghanlee/epicsarchiverap-env#47 (open as of 2026-09-23): sql.fill checks the database through an admin account that the externally provisioned mode never creates, so the check fails and sql.fill exits 0 without loading the schema. The artifact is not the cause: the 3c96141d release tarball ships install_scripts/archappl_mysql.sql and install_scripts/archappl_sqlite.sql, and archappl_mysql.sql defines PVTypeInfo, PVAliases, ArchivePVRequests and ExternalDataServers (verified 2026-09-23). Scope implication for plan step 2: the documented selectable-backend contract must state that the matching schema file is loaded at install and name a post-load table check. Related jeonghanlee/epicsarchiverap-env#21 and jeonghanlee/epicsarchiverap-env#30. Recheck: SHOW TABLES on the deployed config database; ansible-provision's written soak report (received 2026-09-23); the state of jeonghanlee/epicsarchiverap-env#47.
- G2 (2026-09-23): SQLite on the deploy path needs aa-env's SQLite deploy path (jeonghanlee/epicsarchiverap-env#43, open). This row is Blocked on G2; resume as Not started.
- Observation (2026-09-24 02:18-02:37 UTC, LAB-epicsarchiverap-maven on a lab VM, not the deploy path): with a hand-built four-instance Tomcat 9.0.120 layout, the jdbc/archappl DataSource on mgmt only, no JDBC driver in any Tomcat lib directory, and WARs built at b7d4b1e4, both backends loaded the four tables from the shipped schema files, reported SQL Dialect MySQL and SQL Dialect SQLite, archived and retrieved a softIocPVX PV (71 and 96 samples), held its PVTypeInfo row, and kept archiving after a restart, with no SQLITE_BUSY, driver-loading or persistence error. The owner directed a rerun on the real deploy path, so this is not recorded as T2; it shows the artifact's persistence path works when the environment is wired as the contract states. The harness scripts were held in that session and the VM is destroyed, so this observation cannot be rechecked as run.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: the earlier remove-MariaDB plan (superseded 2026-09-18); the new page docs/book/src/sysadmin/persistence-backends.md and the trims of installguide.md and sqlite.md in step 2 (superseded 2026-09-25: the book rewrite at 37c9aadc removed both pages and made docs/book/src/persistence.md the contract page)

Owner direction (2026-09-23): the contract is a new single page covering both backends. Owner direction (2026-09-23): the integration checks run on the real deploy path, ansible-provision (archiver_dev) plus aa-env, on a lab VM, executed by LAB-epicsarchiverap-maven on this session's request; nothing in the deployment is built by hand. MariaDB runs now (T2); SQLite runs once aa-env has a SQLite deploy path (T4, gated by G2).

1. No code change for backend selection: MySQLPersistence already chooses the dialect from the JNDI DataSource's database product name (MySQLPersistence.java lines 69-77), and the DataSource name is jdbc/<dbname>, where <dbname> is the ARCHAPPL_DB_NAME environment variable and defaults to archappl (lines 54-62). Keep both drivers in the pom. Closes with T1.
2. Complete docs/book/src/persistence.md, written with the book rewrite (37c9aadc) and listed in docs/book/src/SUMMARY.md, as the selectable-backend contract page. The page must state: ARCHAPPL_PERSISTENCE_LAYER unset (MySQLPersistence is the default, DefaultConfigService.java lines 1948-1950) or set to the full class name org.epics.archiverappliance.config.persistence.MySQLPersistence; one JNDI DataSource named jdbc/<dbname> (ARCHAPPL_DB_NAME, default jdbc/archappl) whose driver selects MariaDB or SQLite, required only by the mgmt WAR, the only WAR that initializes the persistence layer (DefaultConfigService.java line 725, MGMT branch); the JDBC drivers come from the WARs (mariadb-java-client and sqlite-jdbc in each WAR's WEB-INF/lib) and are not copied into the Tomcat lib directory; the matching schema file loaded at install; a post-load check that PVTypeInfo, PVAliases, ArchivePVRequests and ExternalDataServers exist; and the consequence of a missing schema (configuration writes fail and PV configuration does not survive a restart). Compare the page with the context.xml template and DB_BACKEND selection that aa-env deploys (read from jeonghanlee/epicsarchiverap-env once its SQLite plan is revised), including where it places the JDBC drivers and which schema file it loads (the mgmt WAR's install/ or the release tarball's install_scripts/), and record each difference on the page or here. Closes with T3.
3. Deploy the appliance on a lab VM with ansible-provision and aa-env, aa-env at ansible-provision's pinned commit (archiver_env_ref, 1fc20a8 as of 2026-09-24) and aa-maven at the commit under test (archiver_maven_src_tag, whose default 3c96141d must be overridden), and record both commits with the result. The test PV comes from softIocPVX run on the VM as a test input; it is not part of the deployment under test, so preparing it is not a hand-built deployment step. Check, on the deployed appliance: the deploy loaded the schema itself, the mgmt log reports the matching SQL Dialect, where the JDBC driver is loaded from, archive and retrieve of a softIocPVX PV, its PVTypeInfo row, and archiving after a restart through the deployed service. MariaDB closes with T2; SQLite closes with T4 after G2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Static | Confirm both mariadb-java-client and sqlite-jdbc are declared and ship in the WARs | repository and built WARs | Both present |
| T2 | Integration | MariaDB on the deploy path: deploy with ansible-provision and aa-env (aa-env at the pinned commit, aa-maven at the commit under test); serve one PV from softIocPVX on the VM; SHOW TABLES; mgmt log RDB Engine and SQL Dialect lines; driver source (WAR WEB-INF/lib or a Tomcat lib jar); archivePV, getPVStatus, getData.json; PVTypeInfo row (mysql); restart through the deployed service, then getPVStatus and getData.json; error scan of every instance log | Lab VM (Rocky Linux 8.10) deployed by ansible-provision and aa-env | The deployed aa-env and aa-maven commits are recorded; the deploy loaded the four tables; SQL Dialect MySQL; the PV archives and retrieves; PVTypeInfo holds its row; the PV is still archived after the restart; no driver-loading, persistence or ConfigException line |
| T3 | Review | Second-person pass on docs/book/src/persistence.md; mdbook build | docs/book Docker build | A cold reader can select either backend, load its schema and confirm the tables; the contract agrees with aa-env's deployed context.xml and DB_BACKEND selection, or each difference is recorded; the book builds with no broken links |
| T4 | Integration | SQLite on the deploy path: T2's checks with aa-env's SQLite backend (sqlite3 .tables and query) | Lab VM deployed by ansible-provision and aa-env, after G2 | Same as T2 with SQL Dialect SQLite and no SQLITE_BUSY line |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | repository and built WARs | Pending | none |
| T2 | 2026-09-24 08:48-09:02 UTC | Lab VM, Rocky Linux 8.10, deployed by ansible-provision a3f9949 (species archiver_dev, PLAY RECAP failed=0) with aa-env 1fc20a8 and aa-maven b7d4b1e4 (SRC_TAG, WARs built on the VM by aa-env); OpenJDK 21.0.12.1, Tomcat 9.0.121, MariaDB 10.3.39; executed by LAB-epicsarchiverap-maven | Pass | The deploy created PVTypeInfo, PVAliases, ArchivePVRequests and ExternalDataServers (create_time inside the apply window, nothing loaded by hand); mgmt log RDB Engine MariaDB 10.3.39, RDB Driver MariaDB Connector/J 3.3.3, SQL Dialect MySQL, again after the restart; the drivers exist only in each webapp's WEB-INF/lib and the Tomcat lib holds only tomcat-jdbc.jar; aatest:ramp reached Being archived and returned 105 samples; its PVTypeInfo row holds DBR_SCALAR_DOUBLE for appliance0; after systemctl restart of the unit it was Being archived again and returned 197 samples with one 53 s gap; no ClassNotFoundException, No suitable driver, ConfigException, persistence or SQLException line in any instance log. Recheck: make archiver_dev.rocky8 with archiver_maven_src_tag set, then SHOW TABLES, the mgmt log grep, archivePV, getPVStatus, getData.json, the PVTypeInfo query, a unit restart and the error grep |
| T3 | Not run | docs/book Docker build | Pending | none |
| T4 | Not run | Lab VM deployed by ansible-provision and aa-env | Pending (gated by G2) | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Make the configuration database selectable between MariaDB and SQLite
Labels: enhancement
GitHub Milestone: none
Observed State: open
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-09-25 (gh issue view 5 --repo jeonghanlee/epicsarchiverap-maven --json state,labels,milestone)

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
Status: Open

##### Summary

M13 verifies each backend on the real deploy path. aa-env deploys only MariaDB today; its selectable-backend work (jeonghanlee/epicsarchiverap-env#43) adds the SQLite path. Until then M13 / T4 cannot run.

##### Completion Criteria

- jeonghanlee/epicsarchiverap-env#43 is closed by a landed aa-env commit that deploys the appliance with the SQLite backend.

##### Verification Results

| Observed At | Result | Evidence |
| --- | --- | --- |
| 2026-09-23 | Pending | gh api reports jeonghanlee/epicsarchiverap-env#43 open |

##### Closure Evidence

- none

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
Status: In progress

##### Summary

The mdBook pages migrated by M9 are largely upstream (SLAC) content and describe features and assumptions this fork does not carry: appliance clustering and multi-appliance deployment (retired by D23, D26), CS-Studio and ArchiveViewer integration, MySQL-first persistence, and other pre-modernization material. M9 migrated their format and corrected the build/test/deploy commands but did not modernize the substance (D30).

##### Scope

Reconcile the narrative content to the single-instance fork and the EPICS-Arche boundary (D12): correct or remove clustering/multi-appliance material, retired integrations, and stale runtime assumptions, and update the feature overview. The exact keep/cut list is the owner's to provide, as with M7 and M12.

Out of scope: the docs publishing pipeline (M9, done); EPICS-Arche architecture docs.

##### Dependencies And Decisions

- D30 (content modernization deferred here); D12, D23, D26 (scope basis). Execution waits on the owner's keep/cut list.
- Owner decision (2026-09-24), the first cut item: remove the upstream-era install samples, because this fork deploys through aa-env. That covers the release-tarball fileSets in src/assembly/release.xml for quickstart.sh, install_scripts (sampleStartup.sh, deployMultipleTomcats.py, addMysqlConnPool.py, single_machine_install.sh) and sample_site_specific_content, whose source docs/docs/source/samples no longer exists, so the tarball has shipped none of them since the docs moved to docs/book (observed 2026-09-24: a tarball of be070db5 lists none); the same scripts under docs/book/src/samples; the mgmt WAR's install/deployMultipleTomcats.py (pom.xml mgmt-war webResources); and the passages that cite them in sysadmin/installguide.md, sysadmin/site_specific.md and sysadmin/quickstart.md. The rest of the keep/cut list is still the owner's to give.
- Owner decision (2026-09-24), further cut items: src/sitespecific/slacdev, the SLAC development site, whose own build script fails (src/sitespecific/slacdev/build.xml line 27, "Java returned: 1", observed 2026-09-24 with -Darchapplsite=slacdev) and which only sysadmin/customization.md (as its example) and multipleBuildAndDeploy.sh reference; and docs/book/src/samples/multipleBuildAndDeploy.sh, the upstream script that builds and deploys four Tomcat 7 instances with jsvc, superseded by aa-env. The customization.md example is rewritten when the site goes.
- Owner decision (2026-09-24), cut candidates to check first: the operator Python scripts under docs/book/src/samples (the top-level *.py BPL clients, pythonPBRaw/ and debug/), cut unless they still run against this fork's BPL on the current Python; and TESTING.md and mvnw.cmd, cut unless TESTING.md still describes this fork's test platform and a Windows build is still wanted.
- Owner decision (2026-09-25), the TESTING.md and mvnw.cmd candidates of step 2: keep TESTING.md, because it describes this fork's test platform (the default excludedGroups and the integration and localEpics profiles match pom.xml, and README.md and docs/book/src/developer.md defer the test wiring to it), with its one stale sentence on the browser-test rewrite corrected to the finished state; remove mvnw.cmd, because no Windows build is supported: CI runs only on ubuntu-24.04 and ubuntu-latest, the integration fixture runs catalina.sh (TomcatSetup.java line 188), and the book and README.md give only ./mvnw. After the removal ./mvnw -B -ntp validate passed (Maven 3.9.16). Step 2 now leaves only the Python BPL clients, checked by T5.

##### Completion Criteria

- Each page reflects the single-instance fork: no content describes a retired feature as current, and the owner-approved keep/cut list is fully applied and verified.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-09-25, owner accepted this plan; revised the same day by owner direction to add the tarball WAR item and the customization.md, installguide.md and admin.md corrections in step 1, and again to replace step 3 with a full rewrite of the book
Implementation Authorization: 2026-09-25, owner authorized implementation of this plan and of both revisions
Superseded Plan Artifacts: the page-by-page review of step 3 (2026-09-25), replaced by the full rewrite; its interim edits landed as 587907c8 and are the input to the rewrite

Owner decisions (2026-09-25) that shape this plan: in sysadmin/installguide.md, delete the four passages that cite the removed scripts and leave the rest of the page to step 3; delete sysadmin/quickstart.md; delete the site_specific_content sample and, in sysadmin/site_specific.md, only the sentences that depend on the removed scripts; drop slacdev from the example list in the ARCHAPPL_SITEID javadoc; run the T5 check on the M22 local launcher, so steps 1 and 3 and T1 to T4 proceed first and T5 waits for M22; delete the Python 2 samples without a run check, pythonPBRaw/ with it, because its only script reads the PB/HTTP stream in Python 2 and retrieval's JSON and CSV formats and the mgmt WAR's install/pbutils/pb2json.sh already cover that use.

1. Apply the decided removals.
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
2. Check the candidates: run each top-level *.py BPL client under docs/book/src/samples against an appliance started by the M22 launcher on the current Python and keep or remove it by the T5 result, judging the module emailHandler.py with the scripts that import it; keep or remove TESTING.md and mvnw.cmd after checking whether TESTING.md describes this fork's test platform and whether a Windows build is still wanted.
3. Rewrite the narrative book under docs/book/src from scratch, concise and exact, for the single-instance fork, without keeping the upstream page layout. Pages: Introduction; Architecture; Building; Installing (jeonghanlee/epicsarchiverap-env as the deployment path, then a manual reference); Configuration; Persistence (a placeholder whose content M13 writes); Operating; Logging (the current logging.md, kept); Retrieving data (including Phoebus and Matlab); Scripting (mgmt BPL, the generated API reference, the samples); Redundancy and EPICS 7; Developer guide (test platform, PB file format); FAQ and License where they still hold. Every stated default, parameter, endpoint and file name is checked against the code; every screenshot is a marked placeholder naming what the owner captures later; source text follows the markdown-authoring rules (Scope and Out of scope, fenced code, ASCII punctuation) and the applicable IEEE Editorial Style Manual rules.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | ./mvnw -B -ntp clean verify after step 1 | JDK 21, wrapper Maven | Build and the default test suite pass |
| T2 | Integration | List the release tarball and the mgmt WAR that T1 built | T1 output under target/ | The mgmt WAR has no install/deployMultipleTomcats.py and still has install/*.sql and install/pbutils. The tarball holds mgmt.war, engine.war, etl.war and retrieval.war at its root; for the rest, a no-regression check because the deleted fileSets already read a missing directory, it still has tomcat-log4j/ and *.sql under install_scripts and has no quickstart.sh or sample_site_specific_content |
| T3 | Integration | Build the book with docs/book/Dockerfile after steps 1 to 3 (docker build -t aa-mdbook docs/book, then docker run --rm --user "$(id -u):$(id -g)" -v "$PWD/docs/book:/book" aa-mdbook build, as pages.yml runs it) | Docker, pinned mdBook 0.4.52 and mdbook-admonish 1.20.0 | Exit 0, and no Warning line other than the mdbook-admonish notice that it was built against mdBook 0.4.51, which the current tree already prints |
| T4 | Static | git grep for quickstart.sh, sampleStartup.sh, deployMultipleTomcats, addMysqlConnPool, single_machine_install, multipleBuildAndDeploy, sample_site_specific_content, samples/site_specific_content, pythonPBRaw, samples/debug, ui/help/samples, slacdev, and a link to quickstart.md or (quickstart), excluding docs/archiverap-carry-d12382d1.md and this register; template_changes.html is not searched because src/sitespecific/tests keeps its own copy | Working tree after step 1 | No match |
| T5 | Integration | Run each candidate Python script against the four WARs of the build current at the time, started by the M22 launcher; runs after M22 is Complete | System python3; M22 launcher with SQLite | A script is kept only if it exits 0 and its BPL calls return the expected response for a PV the appliance archives; the per-script result is recorded |
| T6 | Static | LC_ALL=C grep -rnP '[^\x00-\x7F]' docs/book/src --include='*.md' after step 3 | Working tree after step 3 | No match |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-09-25 08:43 UTC | JDK 21.0.12.1, wrapper Maven; step 1 including the tarball WAR item applied on dc3aa1f4 | Pass | ./mvnw -B -ntp clean verify: 782 tests, 0 failures, 0 errors; enforcer and analyze-only clean; BUILD SUCCESS |
| T2 | 2026-09-25 08:43 UTC | T1 output under target/ (aa-20260925-dc3aa1f4) | Pass | The mgmt WAR's install/ holds archappl_sqlite.sql, archappl_mysql.sql and pbutils/ (pb2json.sh, validate.sh, printTimes.sh, repair.sh) and no deployMultipleTomcats.py, which the c953fb07 WAR carried; the tarball holds mgmt.war, engine.war, etl.war and retrieval.war, each byte-identical (cmp) to its aa-20260925-dc3aa1f4-<component>.war, plus LICENSE, RELEASE_NOTES, LICENCES/, the four tomcat-log4j jars and the two install_scripts *.sql files, with no quickstart.sh or sample_site_specific_content |
| T3 | 2026-09-25 15:47 UTC | Docker, pinned mdBook 0.4.52 and mdbook-admonish 1.20.0; rewritten book, working tree | Pass | Exit 0; the only Warning line is the mdbook-admonish 0.4.51 notice. A link check of every relative link and anchor against the built HTML found no problem |
| T4 | 2026-09-25 15:49 UTC | Working tree after step 3 | Pass | git grep for the listed strings, with the two exclusions, and grep over the new untracked pages under docs/book/src returned no match (exit 1) |
| T5 | Not run | System python3; M22 launcher with SQLite | Pending | none |
| T6 | 2026-09-25 15:47 UTC | Working tree after step 3 | Pass | LC_ALL=C grep -rnP '[^\x00-\x7F]' docs/book/src --include='*.md' returned no match |

##### Closure Evidence

- Step 1 landed 2026-09-25 09:23 UTC: commits 4aebc724 (release tarball WARs), 39d92baa (removed samples, slacdev and quickstart page with the page edits) and 6b34d0a3 (this plan and its checks) are ancestors of the fetched origin/modernize (6b34d0a3); the Maven workflow run 36118161053 and the Pages run 36118161044 on 6b34d0a3 succeeded.
- Step 3 landed 2026-09-25 16:23 UTC: commits 587907c8 (interim page edits), 37c9aadc (the rewritten book) and d3456ba1 (this plan's checks and M23) are ancestors of the fetched origin/modernize (d3456ba1); the Maven workflow run 36160480069 and the Pages run 36160480080 on d3456ba1 succeeded, and the published architecture page answers HTTP 200.

##### GitHub Projection

Title: Modernize the narrative docs for the single-instance fork
Labels: documentation
GitHub Milestone: none
Observed State: open
Observed Labels: documentation
Observed Milestone: none
Last Compared: 2026-09-25 (gh issue view 6 --repo jeonghanlee/epicsarchiverap-maven --json state,labels,milestone)

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
Status: Not started

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
- Open for the plan: where the Tomcat distribution comes from, which PVs the appliance archives in a check (for example a local softIoc), and where the script lives in the repository.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Settle the open items above with the owner.
2. Write the script and a short page in the developer guide that runs it.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | ./mvnw -B -ntp clean package, then start the appliance with the script; call /mgmt/bpl/getApplianceInfo, archive a PV through /mgmt/bpl/archivePV, and retrieve it through /retrieval/data/getData.json | JDK 21, Tomcat 9, SQLite, a local PV source | All four components answer; the PV is archived and its samples are retrieved |
| T2 | Integration | Stop the appliance with the script, start it again in the same folder, and call /mgmt/bpl/getPVStatus for the PV from T1 | Same as T1 | The status is Being archived without the PV being added again |
| T3 | Static | Create a marker file after the build and before T1; after T2, run find on $HOME and /tmp for files newer than the marker, excluding the launcher's folder | Same as T1 | No file |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, Tomcat 9, SQLite, a local PV source | Pending | none |
| T2 | Not run | Same as T1 | Pending | none |
| T3 | Not run | Same as T1 | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Add a local launcher that runs the appliance in one folder
Labels: enhancement
GitHub Milestone: none
Observed State: open
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-09-25 (gh issue view 7 --repo jeonghanlee/epicsarchiverap-maven --json state,labels,milestone)

#### M23 - Code defects found while rewriting the docs

Origin: daff1b7 / M23
Identity History: none
GitHub Issue: #8
Status: In progress

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
- Owner decision (2026-09-26): fix items 1 to 8 in three groups, each reproduced on the real code first, then fixed, verified and reflected in the book: site configuration (4, 8), retrieval request handling (5, 6, 7), mgmt UI and BPL (1, 2, 3). Item 2: remove the two reports whose BPL actions do not exist from the Reports page rather than implementing the actions. Item 3: point the help handlers at the published book instead of the missing userguide.html. Item 6: make donotchunk take effect rather than removing it (superseded the same day, below). Item 9 moves to M12's backend inventory.
- Owner decision (2026-09-26), revising item 6: remove donotchunk. Its only use, a Transfer-Encoding header, has been commented out since the first commit of this history (a949151c, 2015); the servlet streams every response, so Tomcat chunks it, and honoring the flag would mean holding a whole response in memory to send a Content-Length. The same unused handling in PvaGetPVData goes with it.
- Pattern found by T3 (2026-09-26): convertFromISO8601String and convertFromDateTimeStringWithOffset throw DateTimeParseException, while every caller (TimeUtils.fromString, the timeranges parsing in DataRetrievalServlet, and the from, to and timeranges parsing in PvaGetPVData) catches IllegalArgumentException; the fix goes into the two converters so all five callers see the exception they expect.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-09-26, owner accepted this plan with the recommended outcomes for items 2, 3, 6 and 9
Implementation Authorization: 2026-09-26, owner authorized implementation of this plan
Superseded Plan Artifacts: the one-step plan to settle the item list (2026-09-25), replaced by this plan

1. Site configuration. Correct the policyName of the 3DaysMTSOnly branch in src/sitespecific/default/classpathfiles/policies.py (item 4) and the class-path property that src/sitespecific/tests/build.xml reads (item 8); update the policy table in docs/book/src/configuration.md if it names the policy. Closes with T1, T2 and T8.
2. Retrieval request handling. Make the two TimeUtils converters throw IllegalArgumentException when parsing fails, so the retrieval servlet answers a malformed time with HTTP 400 (item 5); remove the unused donotchunk handling from DataRetrievalServlet and PvaGetPVData (item 6); register RMS in PostProcessors (item 7); update docs/book/src/retrieval.md. Closes with T3, T4, T5 and T8.
3. mgmt UI and BPL. Import a one-PV group in ImportConfig (item 1); remove the two reports without BPL actions from mgmt.js and its page (item 2); point the help handlers at the published book (item 3); update docs/book/src/operating.md and docs/book/src/scripting.md. Closes with T6, T7 and T8.
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
| T6 | Integration | exportConfig of a one-PV appliance, then importConfig into a fresh appliance, through the deployed mgmt WAR | Tomcat 9, integration profile | The PV is archived after the import; before the fix nothing is imported |
| T7 | Integration | GET the Reports page script and the help target from the deployed mgmt WAR | Tomcat 9, integration profile | No report calls an unregistered action; the help target is the book; before the fix both fail |
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
| T6 | Not run | Tomcat 9, integration profile | Pending | none |
| T7 | Not run | Tomcat 9, integration profile | Pending | none |
| T8 | 2026-09-26 19:12 UTC | JDK 21, wrapper Maven; groups 1 and 2 applied on 7bebca0c | Pass (groups 1 and 2) | ./mvnw -B -ntp clean verify: after group 1 (10:14 UTC) 784 tests, after group 2 787 tests, each 0 failures, 0 errors and BUILD SUCCESS |
| T9 | 2026-09-26 19:25 UTC | docs/book Docker build, pinned mdBook 0.4.52 and mdbook-admonish 1.20.0 | Pass (groups 1 and 2) | Second-person pass on building.md and retrieval.md: one minor finding (an unencoded + of an offset arrives as a space) and one info finding (where staged files land in the WARs), both applied; the book builds with exit 0 and only the mdbook-admonish 0.4.51 notice |

##### Closure Evidence

- none

##### GitHub Projection

Title: Fix the code defects found while rewriting the docs
Labels: bug
GitHub Milestone: none
Observed State: open
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-09-26 (gh issue view 8 --repo jeonghanlee/epicsarchiverap-maven --json state,labels,milestone)

## Backlog

### Work

| Group | ID | Work unit | Type | Status | Ready | Deps | Done when / Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |

### Backlog Details

## Assignment History

| Date | ID | From | To | Sync Commit | Note |
| --- | --- | --- | --- | --- | --- |
| 2026-09-19 | M7 | Milestone (Phase 1) | Backlog | 3c96141d | No owner item list yet; unassigned until the site-required list is provided. |
| 2026-09-19 | M10 | Milestone (Phase 1) | Backlog | 3c96141d | Ant removal deferred (D7); moved to backlog to close out Phase 1's active work. |
| 2026-09-22 | M17 | Backlog | Milestone (Phase 2) | f03029b8 | Assigned to Phase 2 with the rest of the backlog; execution still waits on the owner's keep/cut list. |
| 2026-09-22 | M7 | Backlog | Milestone (Phase 2) | f03029b8 | Assigned to Phase 2 with the rest of the backlog; execution still waits on the owner's item list. |
| 2026-09-22 | M10 | Backlog | Milestone (Phase 2) | f03029b8 | Assigned to Phase 2 with the rest of the backlog; remains Deferred under D7. |
| 2026-09-25 | M23 | Backlog | Milestone (Phase 2) | this synchronization commit | Assigned to Phase 2; the items to fix still wait on the owner's choice. |

## History

| Reset Date | Prior State Commit |
| --- | --- |
| 2026-09-11 | daff1b7da2834bdb121aa2cac6c841a6ce9d43fa |
