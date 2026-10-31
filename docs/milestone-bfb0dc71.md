# Work Register

Release line: master
Milestone index: bfb0dc71
Canonical path: `docs/milestone-bfb0dc71.md`
Canonical branch or ref: master; release Ahsoka is worked on the branch ahsoka until its merge into master
Git upstream: origin/master
Remote tracker: jeonghanlee/epicsarchiverap-maven (aa-maven); GitHub issues per row, no GitHub milestone
Peer register: aa-env at jeonghanlee/epicsarchiverap-env, `docs/milestone-2.0.1.md` on branch release-2.0.1 (cross-referenced per decisions D2 and D3 of the previous document, commit bfb0dc71)

Next session entry point: M14 is Complete on branch ahsoka in c959153afa8169945d6804d292a0094aa14ddb3d; T1, T2 and T3 passed, origin/ahsoka contains the verified changes, and issue #47 is closed as completed. M7 implementation and local verification are finished: T1 passes with the real IOC in an isolated network namespace, T2 passes all 1,163 default-suite tests, and T3 passes all four Java PVA metadata regressions. M7 is Complete in 0ce3996fafe03e39587ca15bbe1c3e8995f69fc9, verified on origin/ahsoka; issue #41 is closed as completed. M25 is Complete: implementation fc52f0807b371990137bcd975ac62dc0a6c18094, milestone record c1b08d94b289585259b44d07389ad65d1066f2cf, and operator guide with final verification record 50fa32baf4dfcdf7b50d60f8091a639037df198f are on origin/ahsoka; the 25 metadata/cache tests and all 1,174 default-suite tests pass, native IOC comparison, metadata-change delivery and real browser checks passed against WARs rebuilt from c1b08d94, and issue #69 is closed as completed with six checked acceptance criteria. M27 records the requested viewer follow-up for distinct line styles, color-vision options and browser-session defaults for time/display settings and is linked to issue #71 in e42a8efd98279f807c08c23753566864045ddf44; origin/ahsoka was observed at that tip on 2026-10-30 10:59 PDT. Next: M26 is Complete: implementation f3f458e70b588f296716cc07fb7e58fdffc45fdf and its default-policy native check e91fef785f26fe5934d7f55519924c6e8bfb9b11 are on origin/ahsoka, the default verify (1,209 tests), the native checks and the browser checks passed on WARs built from the commit, and issue #70 is closed as completed with seven checked acceptance criteria. Next: M13, which is Ready; review its plan before any implementation, as its plan awaits its own acceptance and implementation authority. The M13 and M21 plans await their own implementation authority. M12 is committed and pushed as 1bc1d76c and issue #52 is closed; its local closure record still needs reconciliation. The recorded release rows are four Complete, one In progress and two Not started. The Ready rows of the Backlog are M1, M6, M8, M9, M11, M16, M17, M18, M22, M23, M24, M27, M28; M20 waits for G1. For the viewer follow-ups, start at `src/main/org/epics/archiverappliance/mgmt/staticcontent/js/browse.js`: M22 covers selection restoration, M23 bulk selection and Find, and M24 sampling help and confirmation visibility. For M28, a study of configuration reload, start at `DefaultConfigService.initialize()`, `EngineContext` and `JCACommandThread`.

## Milestone

This register covers the work that remains after release 2026-10 of the Maven appliance. The completed work and the decisions that only it needed are in the previous document at commit bfb0dc71; a row or decision of that document is named with that commit.

### Work

| Group | ID | Work unit | Type | Status | Ready | Deps | Done when / Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Appliance defects | M12 | Delete the moved partition of a zip store that is an ETL source | Milestone | In progress | No | D6, D12 | After a move out of a `ZIP_PER_PV` store the archive no longer holds the `.pb` entry of the moved partition nor its post-processor entries, the next store holds the data once, the explicit deletion keeps working and the suite passes; issue #52; [detail](#m12---delete-the-moved-partition-of-a-zip-store-that-is-an-etl-source) |
| Appliance defects | M14 | Carry the changed limits of a record into the type information at reconnect | Milestone | Complete | No | D9, D12 | After an IOC restart with changed `HOPR`, `LOPR`, `HIGH` and `LOW`, `getPVTypeInfo` holds the new limits within one reconnect and the Details window shows them, the unit and the precision keep being updated, and the suite passes with a test that reconnects a PV with changed limits; issue #47; [detail](#m14---carry-the-changed-limits-of-a-record-into-the-type-information-at-reconnect) |
| Interface console | M7 | PVA PVs keep the unit, precision, limits and host in their configuration | Milestone | Complete | No | D12 | The configuration of a PVA PV carries the unit, the precision, the display, control, warning and alarm limits and the host as the Channel Access PV of an equivalent record does; [detail](#m7---pva-pvs-keep-the-unit-precision-limits-and-host-in-their-configuration) |
| Appliance defects | M25 | Preserve remaining PVA metadata across collection and retrieval | Milestone | Complete | No | M7 | Enum labels reach metadata consumers, precision is never taken from minStep, and DESC/HYST paths and API-to-screen values and explanations have verified outcomes; issue #69; [detail](#m25---preserve-remaining-pva-metadata-across-collection-and-retrieval) |
| Appliance defects | M26 | Preserve Channel Access metadata across reception and updates | Milestone | Complete | No | M25 | Precision-only and host changes reach stored configuration, short, float and byte control limits are preserved, and property-event, field metadata and API-to-screen paths have verified values and explanations; issue #70; [detail](#m26---preserve-channel-access-metadata-across-reception-and-updates) |
| Appliance defects | M13 | Let a type change to a string or a waveform type succeed | Milestone | Not started | Yes | D9, D12 | `changeTypeForPV` to `DBR_SCALAR_STRING` and to `DBR_WAVEFORM_DOUBLE` on a PV archived as `DBR_SCALAR_DOUBLE` returns 200, the PV resumes with the new type and its dropped-events count stops growing, the earlier samples stay readable across the change, and the record-change checks of `src/resources/test/st.cmd` with `RECORD_CHANGE=Types` pass for all four records; issue #45; [detail](#m13---let-a-type-change-to-a-string-or-a-waveform-type-succeed) |
| Release Ahsoka | M21 | Release Ahsoka | Milestone | Not started | No | M12, M14, M7, M13, D12 | Release Ahsoka is built, tagged and installed from its bundle with every Release Verification of the detail Pass and the issues of M12, M14, M7 and M13 closed; [detail](#m21---release-ahsoka) |

### Decisions

| ID | Decision | Decision Date |
| --- | --- | --- |
| D1 | The management interface is a console, not a set of documents: each page shows state and offers actions at a glance, and an explanation opens on demand (an information control or Help), not as standing text. The System pages provide status monitoring. The menu is organized by task, five entries: Archive PVs (adding PVs and controlling their archiving, with a control into the analyzer), Browse PVs (finding archived PVs, a table of the chosen ones with one chart of up to five and a Details window for each, and a control into the analyzer), System (status monitoring), Help, and Analyzer (the data analyzer opened directly); each entry opens its own page and marks the page in view. The old addresses (`reports.html`, `metrics.html`, `storage.html`, `appliance.html`) forward outside the menu. | 2026-10-12 |
| D2 | The analyzer, which replaces the data viewer of M47 (previous document, commit bfb0dc71), is a data analysis tool in the browser: an operator analyzes archived data in it without exporting to an external tool. It is built with every applicable tool of the bundled D3 package (7.9.0, `staticcontent/js/vendor/d3.min.js`); D3 is the only library: the bundled package first, then, where it lacks a tool, a module of the official D3 repositories outside the default bundle (such as `d3-hexbin`), vendored with its version, source and licence recorded as for `d3.min.js`; no third-party package is added. The tools of the bundled package are built first. A simple computation that D3 does not provide, such as the correlation and the linear regression, is implemented in the page's own code. | 2026-10-12 |
| D3 | The console checks run against one soft IOC and one local appliance. The IOC is the `consolechart` IOC of `ioc-runner` (local mode), started from `src/resources/test/st.cmd`, which loads `ConsoleChartPVs.db` and one record-change database chosen by the `RECORD_CHANGE` macro; a check that needs another record set switches the macro in the IOC configuration and restarts that IOC, and does not start a second one. The appliance is the kept local appliance (port base 27665); a check that needs another archiver state uses it, and does not start a second one. The procedure of this IOC is written into the book as M75 (previous document, commit bfb0dc71), in stage 1 of D43 (previous document, commit bfb0dc71) after M73 (previous document, commit bfb0dc71), so that it records the commands the M73 (previous document, commit bfb0dc71) checks ran. D20 (previous document, commit bfb0dc71) is unchanged: the Java test fixtures keep launching softIocPVX directly. | 2026-10-17 |
| D4 | The role of the archiver is to keep the signal without a gap: when the archived record changes, the archiver detects it and goes on storing under the new condition, with the earlier samples readable as they were stored. That is M15, deferred to the next major release, and one GitHub issue holds the direction. In this release the engine does only this much (M77 (previous document, commit bfb0dc71)): it writes to its log that the record is changing, naming the PV and the change, and it pauses what can be paused, which is a PV whose type changed; the other reactions stay as M73 (previous document, commit bfb0dc71) observed them. M77 (previous document, commit bfb0dc71) runs in stage 1 of D43 (previous document, commit bfb0dc71) after M75 (previous document, commit bfb0dc71). | 2026-10-17 |
| D5 | Before the merge of `modernize` into the default branch, the open work is closed down to what the shipped console needs: M67 (previous document, commit bfb0dc71) closes by a dated exception with its step 5 (the header of the analyzer) moved to M1; M78 (previous document, commit bfb0dc71), M79 (previous document, commit bfb0dc71) and M80 (previous document, commit bfb0dc71) move from the Backlog to the Milestone table and are done; the analyzer design (`docs/design-analyzer.md`) is in place. After the merge the analyzer is built in five phases, one row each, in the order A (M1, page, header and address), B (M2, interaction, options and export), C (M3, tools for one signal), D (M4, tools for two and several signals) and E (M5, waveforms and images), each phase accepted and authorized on its own and usable when it ends; then M7, M6, M18, M16, M17, M20 after G1, and M15 as deferred. Issue #39 stays the one issue of the analyzer, with a box per phase in its body. | 2026-10-19 |
| D6 | A `ZIP_PER_PV` store that is the source of an ETL move keeps the partition it moved (found by the check of M80 (previous document, commit bfb0dc71)). The defect goes to the Backlog as M12 (issue #52) for a later release, because the site uses no zip store and a zip store is the last store of a chain; the book's `compress` row says so, and M80 (previous document, commit bfb0dc71) covers the zip store for the explicit deletion only. | 2026-10-19 |
| D7 | The two findings of the audit of M85 (previous document, commit bfb0dc71) that its loops do not cover enter the Backlog as rows: the PVAccess answer that copies its array at every event and is held whole (M86 (previous document, commit bfb0dc71)), and the PVAccess server that bounds neither the calls at a time nor their duration (M8). Neither blocks M85 (previous document, commit bfb0dc71) or the merge of `modernize`; the owner assigns them to a table when the order is chosen. | 2026-10-21 |
| D8 | The retrieval memory protection keeps its shipped defaults (budget 0.20, admission 0.50, pressure 0.60, allocation floor 0.01, a check every 1024 events, a collection request at most every 100 ms) and the valve defaults (concurrency 100, stuck 600 s, interrupt 900 s); the connector `maxThreads` stays at Tomcat's default in the deployment template and at 40 in the development launcher. The valve concurrency is recorded as not derived from a load measurement, and the book states that a valve above `maxThreads` never refuses. The T7 and T8 results of M85 (previous document, commit bfb0dc71) are accepted as final within their recorded scope: on every measured configuration (HTTP and PVAccess; 512 MiB, 2 GiB and 4 GiB under G1; fill-operator pressure under Parallel and ZGC at 512 MiB) abnormal or excessive requests were refused or stopped, no run produced an OutOfMemoryError or a JVM exit, and recovery followed. The measurement of the thread and valve limits under combined load and the unmeasured qualification cells (Serial collector; Parallel and ZGC at 2 GiB and 4 GiB; pressure after commit; overshoot and headroom at the defaults; summary-pair admission at larger heaps) move to M9 / issue #58. The product question behind issue #56, the midpoint stamp of a summary bin against the request-end filter, moves to M10 / issue #59. | 2026-10-24 |
| D9 | Release scope of the Maven appliance: the protection of retrieval against memory exhaustion (M85 (previous document, commit bfb0dc71), issue #54) and the date correction of its summary test (M89 (previous document, commit bfb0dc71), issue #56) close before the release; every other open row and issue is worked after the release at its own pace. Open at this decision: M9 / #58, M10 / #59, M11 / #60, M19 / #55, M12 / #52, M15 / #48, M7 / #41, the analyzer rows M1, M3, M5, M2 and M4 / #39, the rows M16, M17, M18 and M6 without an issue, M20 blocked by G1, and the two deviations of M73 (previous document, commit bfb0dc71) that had no row, #45 and #47, which enter the Backlog as M13 and M14. The release cycle regroups these rows when it opens. | 2026-10-24 |
| D10 | The five candidates that the audit of the retrieval protection and the sweep of 2026-10-24 left unchecked (`FirstSamplePP`, `DeadBand`, `Fliers` and `IgnoreFliers` outside the declared-size check and the in-loop check; the values `Median`, `Kurtosis` and `Skewness` keep per bin against the 112 bytes per bin that the declared size counts; the number of `pv` parameters of `getDataForPVs`, of the names posted to `getDataAtTime` and `getDataAtTimeForAppliance`, and of the `;` separated names of the PVAccess call) are not checked before the merge to master. They enter the Backlog as M11 / issue #60 as long-term work, each to be run as a real request at a 512 MiB heap; `Nth` and `NCount` are bounded by `MAX_COUNT` and are recorded in `docs/CLOSED_DOORS.md` as CD-18; the fill operators of the audit's `Event per bin` row were checked and corrected by a27f260a, and the PVAccess name list is the one candidate that the audit did not name. The owner decided on 2026-10-24 to settle the fate of each candidate after its check. | 2026-10-24 |
| D11 | The install and run check of release 2026-10 is accepted on the day run of the appliance built from tag `2026-10` (commit e0a8e66e) by the installer of jeonghanlee/epicsarchiverap-env: 903 PVs archived for 24 hours (registration 2026-10-26T17:02Z, collector cycles 2026-10-26T17:32Z to 2026-10-27T17:02Z, 142 cycles with no error cycle), with the service, the archived and connected counts, the sample completeness, the dropped and stale counts, the move from the short-term to the medium-term store, a retrieval over the whole day of 16 PVs (16 of 16 complete, 2,351.6 MiB in total) and the health service all passing their checks; memory and disk are recorded as observed values only (appliance JVM 2613 MiB at the first cycle, 3007 MiB at the peak, 2639 MiB at the last; disk use unchanged at 42 percent). The statistics and the method are the record `docs/reports/soak-903pv-20261026.md` of jeonghanlee/epicsarchiverap-env at commit 587df6e0aa7163f6f28ba5f810d737212818cc36 (branch `release-2.0.1`); the raw measurements are not kept. Not shown by this run: the retrieval memory protection acting (no retrieval was refused or cut), the move from the medium-term to the long-term store and its reduction, and the first 30 minutes after registration, which were checked by hand only. This closes release 2026-10; the next release cycle opens from this document. | 2026-10-27 |
| D12 | Release scope of release Ahsoka: the rows M12, M14, M7 and M13, which D9 left to work after the release, worked and released in this order on the branch ahsoka, which the owner opens from master and merges into master at the release; every other row stays in the Backlog. The release is named Ahsoka, its tag is named Ahsoka, and the project version is set to Ahsoka at the release. M12 comes first because it does not depend on the other three (whether M13 touches the same storage plugin is settled by the investigation step of M13), and M14 comes before M7 because both change what `MetaInfo` carries (M7 fills it for PV Access PVs, M14 updates it for Channel Access PVs at reconnect), so the two rows are worked in succession; M13 follows and also changes `PVTypeInfo`, so the comparison of M7 / T1 runs again on the combined branch (Release Verification 1); no dependency between the rows is recorded. | 2026-10-27 |

### ID Migration

Row numbers changed on 2026-10-26, before any work of this generation started, so that the rows of one topic are consecutive.

| Old ID | Current ID | Reason | Updated References |
| --- | --- | --- | --- |
| M5 | M1 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M11 | M2 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M6 | M3 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M12 | M4 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M7 | M5 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M4 | M6 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M9 | M7 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M14 | M8 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M16 | M9 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M17 | M10 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M20 | M11 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M13 | M12 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M18 | M13 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M19 | M14 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M10 | M15 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M1 | M16 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M2 | M17 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M3 | M18 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M15 | M19 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |
| M8 | M20 | Grouped by topic | Deps of the work table, detail headings and links, Identity History, `docs/design-analyzer.md` |

### Assignment History

Rows moved from the Backlog to the Milestone section of this document on 2026-10-27, with their details. Where the Test Plan environments of the four rows name a Tomcat patch version, it is 9.0.122, the version the repository pins; the Backlog text read 9.0.121.

| Work Identity | From Canonical | To Canonical | Target Commit | Authority Moved At |
| --- | --- | --- | --- | --- |
| M12 | docs/milestone-bfb0dc71.md, Backlog | docs/milestone-bfb0dc71.md, Milestone | this synchronization commit | this synchronization commit |
| M14 | docs/milestone-bfb0dc71.md, Backlog | docs/milestone-bfb0dc71.md, Milestone | this synchronization commit | this synchronization commit |
| M7 | docs/milestone-bfb0dc71.md, Backlog | docs/milestone-bfb0dc71.md, Milestone | this synchronization commit | this synchronization commit |
| M13 | docs/milestone-bfb0dc71.md, Backlog | docs/milestone-bfb0dc71.md, Milestone | this synchronization commit | this synchronization commit |

### Milestone Details

#### M12 - Delete the moved partition of a zip store that is an ETL source

Origin: bfb0dc71 / M13
Identity History: M13 to M12 on 2026-10-26
GitHub Issue: #52 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/52)
Status: In progress

##### Summary

A `pb` store with `compress=ZIP_PER_PV` that is the source of an ETL move keeps the partition it moved: `getETLStreams` keys each `ETLInfo` with `path.toAbsolutePath().toString()`, which for a path inside the zip file system is the entry's path without the `jar:` prefix; `markForDeletion` resolves that key on the local file system, finds nothing and ignores the `NoSuchFileException` by design, so the entry stays and the samples exist twice. `getETLStreamsForDeletion` keys its rows in the `jar:` form, so the explicit deletion works. Observed on 2026-10-19 with the shipped `ETLJob` over STS HOUR to a zip MTS HOUR with `pp=mean_60` to LTS YEAR: the LTS held the data and the archive still held both `.pb` and both `.mean_60` entries. A zip store is meant as the last store of a chain, where no move starts, so the shipped configurations do not reach this.

##### Scope

- `getETLStreams` keys the `ETLInfo` of a zip path in the `jar:` form through the same helper as `getETLStreamsForDeletion`, so `markForDeletion` deletes the moved entry and its post-processor entries (the `.mean_60` entry of a partition archived with `pp=mean_60`).
- A test over two hops with a zip MTS is added; it fails on the code of today, which keeps the moved partition, and passes after the change.
- After T1 passes, the `compress` row of `docs/book/src/configuration.md` no longer says that a zip store that is the source of a move keeps the partition it moved. Its advice to use a zip store for the last store of a chain stays, because the test covers two hops.

Out of scope: the uncompressed store, which an earlier check covered; where a zip store may sit in a chain (the book says the last store).

##### Completion Criteria

- After a move out of a zip store the archive no longer holds the `.pb` entry of the moved partition nor its post-processor entries, and the next store holds the data once.
- The explicit deletion of a PV from a zip store keeps working.
- The default suite passes.
- The `compress` row of the book no longer says that the data would exist twice, and keeps the advice to use a zip store for the last store of a chain (T2).

##### Dependencies And Decisions

- D6 (Decision Date 2026-10-19): left to the Backlog for a later release; found by the check of M80 (previous document, commit bfb0dc71).
- D12 (Decision Date 2026-10-27): carried by release Ahsoka as row 1 of 4, before M21.
- The owner decided on 2026-10-27 that the book keeps its advice to use a zip store for the last store of a chain, and that the book is changed last, after T1 passes.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-10-27, accepted by the owner in the planning conversation, with the book change as the last step
Implementation Authorization: 2026-10-29, owner directed work on Ahsoka to proceed; M12 is the first item in the accepted order
Superseded Plan Artifacts: none

1. In `src/main/edu/stanford/slac/archiverappliance/PlainPB/PlainPBStoragePlugin.java`, `getETLStreams` takes the key of each `ETLInfo` from the private helper `deletionKey(Path)`, which `getETLStreamsForDeletion` already uses and which builds the `jar:` form for `ZIP_PER_PV`. Check: T1.
2. The two-hop case with a zip MTS is added to `src/test/edu/stanford/slac/archiverappliance/PlainPB/PlainPBPostProcessorCleanupTest.java`, which already has the helpers `hop`, `item` and `mtsFileNames` and a zip test for the explicit deletion; the class comment, which says a zip store is not an ETL source, is updated. Check: T1.
3. After T1 passes, the `compress` row of `docs/book/src/configuration.md` drops the sentence that a zip store that is the source of a move keeps the partition it moved, so that the data would exist twice; the advice to use a zip store for the last store of a chain stays. Check: T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit and suite | `PlainPBPostProcessorCleanupTest` with the two hops over a zip MTS; `./mvnw -B -ntp clean verify` | JDK 21, Tomcat 9.0.122 for the integration tests | After the second hop `mtsFileNames()` lists only the entries of the newer partition (the old behaviour keeps the entries of the older one) and the next store holds the data once; suite passes |
| T2 | Book | The mdBook build and the link check with the corrected `compress` row | `aa-mdbook` image | The book builds with no broken link and the row no longer says the data would exist twice |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-10-29 11:38 PDT | OpenJDK 21.0.13, wrapper Maven, offline cached dependencies; Maven heap 1 GiB and one reused test fork with 2 GiB heap | Pass | The new shipped-ETL regression failed before the fix because the old partition remained in the zip; after the fix the cleanup and explicit-deletion classes passed all 14 tests. `./mvnw -B -ntp -o clean verify -DargLine=-Xmx2g -DforkCount=1 -DreuseForks=true` with `MAVEN_OPTS=-Xmx1g` completed successfully: 1,146 tests, zero failures, errors or skips. The two-hop regression checks removal of raw and mean_60 entries, retention of the newer partition and exactly 3,600 destination samples with the expected timestamp and value after a repeated ETL pass. Local logs: `work/ahsoka-m12-red-20261029.log`, `work/ahsoka-m12-green-20261029.log`, `work/ahsoka-m12-verify-20261029.log`. Environment-dependent integration profiles were not selected. |
| T2 | 2026-10-29 11:38 PDT | Existing aa-mdbook image, mdBook 0.4.52; Python HTMLParser over its generated HTML | Pass for build and internal links | The corrected compress row retains the last-store advice and removes the duplicate-data warning. The image built the real book into `work/ahsoka-m12-book-20261029`; `python3 work/check-book-links-m12.py work/ahsoka-m12-book-20261029` checked 21 HTML pages and 1,181 local links and fragments with zero errors; 52 external references were excluded from this internal check. Build log: `work/ahsoka-m12-book-20261029.log`. The existing admonish version warning did not prevent the build. |

##### Closure Evidence

- Implementation rechecked against the accepted plan and its completion criteria on 2026-10-29: getETLStreams uses the existing deletionKey helper, the real two-hop regression covers the moved and retained partitions and destination data, explicit deletion passes, and the book preserves the last-store restriction. No scope deviation found.
- Local verification is complete; repository changes are uncommitted. Commit, upstream landing evidence and linked-issue reconciliation remain pending, so M12 stays In progress.

##### GitHub Projection

Title: A zip ETL source keeps the partition it moved
Labels: bug
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-28 00:46 PDT; `gh issue edit 52` replaced the body with the projection of this detail, read back OPEN with a body equal to the draft, label bug, assignee jeonghanlee, no milestone, remote updatedAt 2026-10-28T07:46:15Z

#### M14 - Carry the changed limits of a record into the type information at reconnect

Origin: bfb0dc71 / M19
Identity History: M19 to M14 on 2026-10-26
GitHub Issue: #47 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/47)
Status: Complete

##### Summary

Before this fix, the engine read the record metadata again at reconnect but retained the display, warning, alarm and control limits stored at the archive request. After the IOC limits changed and the IOC restarted, `getPVTypeInfo` and the Details window therefore retained the old limits. This behavior was observed on 2026-10-17 and 2026-10-18 with `src/resources/test/st.cmd` (a follow-up of issue #44): `MetaInfo.applyBasicInfo` read the new control DBR, but `MetaInfo.updateTypeInfo` did not copy its limits into the stored type information.

The current implementation compares all eight received limits independently of units, saves changed values in one configuration update, and emits one INFO line naming the PV and changed fields. Identical numeric limits and repeated NaN values cause no additional limit update. The existing unit, precision and hostname rules remain: precision is written with a unit change, and the hostname is filled only when the stored value is null. The verified source and regression are committed in c959153afa8169945d6804d292a0094aa14ddb3d and present on `origin/ahsoka`. This completes the defect fix; release and production deployment remain part of M21.

##### Scope

- Update the eight stored Channel Access limits (lower and upper display, warning, alarm and control) from successful connection metadata. `MetaInfo.applyBasicInfo` remains the public parsing entry point, and `MetaInfo.updateTypeInfo` remains the common update path for reconnect and daily metadata refresh.
- Compare each received limit independently of units. Use `Double.compare` so repeated NaN values compare equal; numeric-to-NaN and NaN-to-numeric transitions are changes. Zero and negative values remain valid inputs and are not treated as missing.
- Preserve the existing primitive `double` fields of `PVTypeInfo`. Its `Double` getters box those values; they do not establish a nullable stored-limit state. Do not introduce a nullable schema or a fallback that replaces missing metadata with zero.
- Apply changed limits in one configuration update and emit one INFO line naming the PV and changed fields on `config.org.epics.archiverappliance.config.MetaInfo`. Preserve existing units, precision and hostname behavior; verify that simultaneous unit/precision and limit updates do not produce duplicate configuration lines.
- Verify that an IOC outage retains the last received limits and that the next successful reconnect replaces them. The existing CA callbacks check response success before calling `applyBasicInfo`; an outage test does not by itself prove that a failed GET callback ran.

Out of scope: PVA metadata (M7), record type changes (M13), new metadata retry or scheduling policy, changes to the samples' property subscription, nullable storage, and independent precision-only or hostname refresh changes. No claim of new behavior for malformed protocol payloads or partially initialized Java DBR objects is part of this fix.

##### Completion Criteria

- Each of the eight limits can change on its own while units stay unchanged, and the other seven limits remain unchanged (T1).
- Numeric-to-numeric, numeric-to-NaN and NaN-to-numeric changes are saved; repeated identical numeric or NaN metadata causes no additional limit update or INFO line (T1).
- Zero and negative limits remain numeric values, without fallback or rejection (T1).
- Existing unit/precision updates still work alongside a changed limit, with one configuration update and one INFO line naming the PV and changed fields (T1).
- The regression exercises `applyBasicInfo` with fully populated JCA control-double metadata and the shipped `ConfigServiceForTests`; it fails on the defective implementation for the missing limit update, not while preparing the fixture (T1).
- Before an actual test IOC outage, `getPVTypeInfo` reports lower display/control limits -20 and upper display/control limits 80. During the outage those nonzero values remain unchanged, so an unintended reset to zero fails the check. After restarting that IOC with `HOPR=50` and `LOPR=10`, the same archived PV has upper display/control limits 50 and lower display/control limits 10 within one reconnect, without re-archiving the PV or restarting the appliance between the baseline and final observations (T2).
- The default Maven suite passes on the final source tree. Runtime evidence identifies the actual JDK, EPICS and Tomcat versions and the built WARs used (T3, T2).

##### Dependencies And Decisions

- D3 (Decision Date 2026-10-17): T2 reuses the existing `consolechart` IOC and the kept local appliance at port base 27665; it does not create a second IOC or appliance.
- D9 (Decision Date 2026-10-24): worked after the release.
- D12 (Decision Date 2026-10-27): carried by release Ahsoka as row 2 of 4, before M21.
- The owner decided on 2026-10-27 that the log line of a changed limit stays at INFO like the line of the unit and the precision, and that the unit test covers the control-double branch.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-10-29; revised plan with both accepted review findings incorporated
Implementation Authorization: 2026-10-29; implement and verify the accepted plan
Superseded Plan Artifacts: M14 plan in commit 1bc1d76c3007210dc3c353224708fb56e8f4a4d3; its nullable stored-limit premise is contradicted by the primitive fields and the observed setter failures

1. Correct `src/test/org/epics/archiverappliance/config/MetaInfoLimitsTest.java`: remove the impossible stored-null cases, retain the eight independent-limit regression cases, and cover both directions of the numeric/NaN transition, unchanged input, zero and negative values, and simultaneous unit/precision changes. Populate all JCA control metadata fields explicitly. Observe real configuration-service calls through `CapturedLog`; do not replace the parser, comparison or configuration update with a mock. Run the corrected tests before changing production code and record the actual assertion failures. Check: T1.
2. In `src/main/org/epics/archiverappliance/config/MetaInfo.java`, compare all eight received limits with the stored limits using `Double.compare`, update the differing fields, and invoke the existing configuration update once. Consolidate the configuration INFO message so it names all fields changed in that update. Preserve the CA success check and the storage field types. Check: T1.
3. Run the corrected targeted tests, then the complete default Maven verification. Build all four WARs from the tested source tree. Check: T1, T3.
4. Follow the local appliance and test IOC procedures in `docs/book/src/developer.md` and the T2 preparation and recovery steps below. Reuse D3's `consolechart` IOC and kept appliance at port base 27665. Deploy the four tested WARs to that appliance before establishing the baseline. Set `CAV2_TEMP_LOPR=-20` and `CAV2_TEMP_HOPR=80` for the shipped `SR:RF:CAV2:TEMP` fixture and confirm all four display/control values through `getPVTypeInfo`; archive the PV only if it is not already archived. Stop only `consolechart`, verify disconnection and unchanged nonzero limits, then reinstall its configuration with `CAV2_TEMP_LOPR=10` and `CAV2_TEMP_HOPR=50` and start it. Read the API after reconnect and record the limits and connection evidence. Perform the recovery steps on success or failure and retain evidence files. Check: T2.
5. Compare the final diff and observed results with every completion criterion. Record any unexecuted check as pending; prepare issue reconciliation and commit artifacts only under their own authority.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit | Corrected `MetaInfoLimitsTest` calls real `MetaInfo.applyBasicInfo` with fully populated `DBR_CTRL_Double` objects and real `ConfigServiceForTests`; inspect stored values and `CapturedLog` events for each independent limit, numeric/NaN transitions, zero/negative values, unchanged input and simultaneous unit/precision updates; run before and after the fix | JDK 21 | Defective code fails on actual stale limits; corrected code saves every required change once and does not repeat unchanged updates; no fixture preparation error |
| T2 | Integration, local IOC and appliance | Reuse D3's `consolechart` IOC and kept local appliance with the four tested WARs; confirm initial lower display/control limits -20 and upper display/control limits 80, observe an outage with those values unchanged, then reconnect after setting `CAV2_TEMP_HOPR=50` and `CAV2_TEMP_LOPR=10`; read `getPVTypeInfo` and connection status; follow preparation and recovery below | JDK 21, Tomcat 9.0.122, EPICS 7.0.10; existing loopback CA settings and appliance port base 27665 | Nonzero limits survive the outage; new display/control limits appear within one reconnect without re-archiving or restarting the appliance after the baseline; original runtime configuration, deployment and running/stopped state are restored |
| T3 | Default suite and build | Run `./mvnw -B -ntp -o clean verify -DargLine=-Xmx2g -DforkCount=1 -DreuseForks=true` with `MAVEN_OPTS=-Xmx1g` on the final source tree; record the selected profiles and test totals | JDK 21, cached Maven dependencies | Default suite and WAR packaging pass; unselected integration profiles are not claimed as tested |

T2 preparation and recovery:

1. Identify the kept appliance's absolute run folder from its `run.json`, port base 27665 and process command lines; check `launcher.pid` and the process start identities in `children.tsv` before stopping anything. Record the initial running/stopped state of both that appliance and `ioc-runner --local list` for `consolechart`. Save the installed `consolechart.conf`, launcher environment and arguments, all four deployed WARs and their checksums, and the appliance configuration files outside the run folder. Name the saved WAR set `<build>-mgmt.war`, `<build>-engine.war`, `<build>-etl.war` and `<build>-retrieval.war` using the original build name in `run.json`, so the launcher can read it during recovery. Before stopping services, compare the saved configuration with the configuration generated from both the tested and saved WAR sets; identify the `--property` overrides needed for each. If the kept folder, ownership or original startup settings cannot be established, or a customization cannot be preserved by the launcher, leave T2 pending before replacement rather than creating another instance.
2. Gracefully stop the identified appliance if running and confirm its owned JVMs have exited. Start `scripts/run-local-appliance.bash` with the same run folder, `--port-base 27665`, `--war-dir target`, the selected Tomcat installation, recorded CA settings and verified property overrides. The launcher copies all four WARs into the existing component instances and retains SQLite and the stores. It regenerates configuration, including `policies.py` and `archappl.properties`; compare those files with the expected configuration from preparation before testing. Verify the deployed application contents against the tested WARs, including any expanded web applications, and record actual runtime versions. Change the saved working copy of `consolechart.conf` through the documented stop, force-install and start sequence, preserving its other settings and CA ports. Establish the -20/80 API baseline only after this preparation is complete.
3. After recording the final result or a failure, stop the same IOC and appliance gracefully. Restore the original IOC configuration and four WARs, retaining SQLite, stores and evidence. For an appliance originally running, restart the same run folder using a complete WAR set copied from the saved deployment and the original environment, arguments and property overrides; verify restored configuration and deployed contents against the saved copies. For an appliance originally stopped, restore the saved deployment and configuration in place and leave it stopped. Restart `consolechart` only if it was originally running. Confirm both original running/stopped states and configuration checksums; record any recovery failure explicitly. Restoration concerns runtime settings and deployment, not erasing archived samples or test observations.

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-10-29 16:39 PDT | OpenJDK 21.0.13, default Maven test profile | Pass | Corrected `MetaInfoLimitsTest`: before the implementation, 13 tests with 12 stale-limit assertion failures and zero errors; afterward, all 13 pass. Covers eight independent limits, numeric/NaN transitions in both directions, identical input, zero/negative values, and simultaneous units/precision/limit changes with configuration-write and INFO counts. Invalid stored-null cases were removed. Logs: `work/ahsoka-m14-corrected-red-20261029.log`, `work/ahsoka-m14-targeted-20261029.log`. |
| T2 | 2026-10-29 16:52 PDT | OpenJDK 21.0.13, Tomcat 9.0.122, EPICS 7.0.10; D3's existing `consolechart` IOC and kept appliance at port base 27665 | Pass | The real IOC supplied -20/80; the API reported those lower/upper display and control limits while connected and in three observations while disconnected. After one IOC restart with 10/50, the same PV reported 10/50 and its reconnect count changed from 0 to 1; appliance process identities remained unchanged and the PV was not re-archived. All deployed WARs and expanded contents matched the tested build. Original IOC configuration, appliance configuration and deployment were restored and checksum-checked; both services returned to their original stopped state, with no recovery errors. Recovery restored files in place because both services were initially stopped; restarting a previously running deployment from the backup WAR set was not exercised. Evidence: `work/m14-runtime-20261029-165128/` (raw HTTP responses, baseline/outage/reconnect readings, runtime versions, WAR hashes and recovery result); method: `work/m14-runtime-check.py`. The build name `aa-20261029-1bc1d76c` identifies the base commit plus the tested uncommitted changes, not a committed fix. |
| T3 | 2026-10-29 16:51 PDT | OpenJDK 21.0.13, offline Maven, default test selection, `MAVEN_OPTS=-Xmx1g`, fork heap 2 GiB | Pass | Planned `clean verify` completed with 1,159 tests, zero failures, zero errors and zero skipped tests, and packaged the mgmt, engine, etl and retrieval WARs. Dependency analysis passed. Explicit `integration`, `localEpics` and `tools` profiles were not selected; default exclusions remain `integration,localEpics,slow,flaky`. Log: `work/ahsoka-m14-verify-20261029.log`. |

##### Closure Evidence

- Completed on 2026-10-29: commit c959153afa8169945d6804d292a0094aa14ddb3d contains the implementation, regression and verification record. T1, T2 and T3 passed as recorded above; the committed production and test files match the tested source fingerprints.
- Repository landing observed at 2026-10-29 19:44 PDT: after `git fetch origin`, `origin/ahsoka` resolves to c959153afa8169945d6804d292a0094aa14ddb3d. An ancestor check and comparison of all three paths changed by the commit confirm that the implementation, regression and recorded verification are present on the fetched branch. The release branch is the implementation landing target under D12; the merge into master and release remain M21 work.
- Issue #47 was closed as completed at 2026-10-29 19:22:56 PDT. Its body records the implemented numeric/NaN contract and satisfied criteria; closure comment: https://github.com/jeonghanlee/epicsarchiverap-maven/issues/47#issuecomment-6513393997 . The body and comment were read back and matched their prepared content after closure.
- External state rechecked at 2026-10-29 19:44 PDT through `gh api repos/jeonghanlee/epicsarchiverap-maven/issues/47`: CLOSED, reason completed, label bug, assignee jeonghanlee, no milestone. No required defect verification or external gate remains open.

##### GitHub Projection

Title: Display limits not read again at reconnect
Labels: bug
GitHub Milestone: none
Observed State: CLOSED (2026-10-29 19:44 PDT; reason completed)
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-29 19:44 PDT; issue #47 body and completion comment reconciled with the implemented scope and verification, read back CLOSED with reason completed, label bug, assignee jeonghanlee, no milestone, remote updatedAt 2026-10-30T02:22:57Z

#### M7 - PVA PVs keep the unit, precision, limits and host in their configuration

Origin: bfb0dc71 / M9
Identity History: M9 to M7 on 2026-10-26
GitHub Issue: #41 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/41)
Status: Complete

##### Summary

The appliance archives a PV through PV Access without its unit, precision, limits and host. On a local appliance with one `softIocPVX` serving the same records over both protocols, the `pva://` PV of a record that sets `EGU` to `mm` reports no `units` and no `hostName`, `precision` 0.0 and all display, warning and alarm limits 0.0 in `getPVTypeInfo`, where the Channel Access PV of an equivalent record reports `units` `mm`, the host, `precision` 3.0 and NaN for the warning and alarm limits that are not set. `EPICS_V3_PV.updateTotalMetaInfo` fills `MetaInfo` from a control request; `EPICS_V4_PV.updateTotalMetaInfo` has an empty body, and its host name is never assigned. The source provides the values (`pvxget` returns `display.units`, the display limits and the precision).

##### Scope

Fill `MetaInfo` of a PV Access PV from the `display`, `control` and `valueAlarm` members of its structure and set its host name when the channel connects, so that the configuration of a PV is the same for both protocols. `EPICS_V4_PV` assigns no host name today; the host name is the server address that `PVAChannel.getRemoteAddress()` reports at connect, and its exact form is not fixed by this change. The type information takes the host name at the archive request, through `PVTypeInfo.absorbMetaInfo`. A member that the structure lacks leaves its limit NaN. An opt-in integration test (T1) compares the two protocols on two equivalent records, because one record under both protocols is one PV name: the archive call drops the `pva://` prefix.

Out of scope: following a change of limits at the reconnect of a PV Access PV (M14 covers Channel Access PVs); how the consoles read a missing value (they already treat it as not provided); the `meta` of the retrieval response of a PV Access PV, which is not examined here.

##### Completion Criteria

- `getPVTypeInfo` of a `pva://` PV of a record that sets `EGU`, `PREC` and limits reports the same `units`, `precision` and limits as the Channel Access PV of an equivalent record, and the warning and alarm limits that the record does not set are NaN for both protocols. A limit whose member the structure lacks is NaN too.
- `getPVDetails` of the PV Access PV shows the unit and the precision, and `hostName` is set and not empty there and in `getPVTypeInfo`; the host name need not equal that of the Channel Access PV, because the exact form of that name is not fixed by this change.
- An opt-in integration test archives equivalent records over each protocol and compares the fields. A default-suite test uses a Java PVA server to exercise metadata reception and transfer into the stored type information, including absent limit members; the default suite passes.

##### Dependencies And Decisions

- Origin: recorded on 2026-10-15 at the owner's direction, from the observation made while checking the Details window of the Browse PVs page (M58 (previous document, commit bfb0dc71)).
- M58 (previous document, commit bfb0dc71) reads a value that the calls do not hold as "not provided" and does not wait for this item; M6 archives PVA PVs through `pva://` and benefits from it.
- D12 (Decision Date 2026-10-27): carried by release Ahsoka as row 3 of 4, before M21.
- The owner decided on 2026-10-27 that the host name comes from `PVAChannel.getRemoteAddress()` and is shown in `getPVDetails` and in `getPVTypeInfo`, and that T1 is a JUnit test in the default suite. The test placement is superseded by the decision below.
- Decision Date 2026-10-29: keep the real IOC comparison in the opt-in integration suite; add Java PVA server coverage to the default suite. No EPICS installation is added to CI.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-10-29, revised test placement accepted; implementation scope remains as accepted on 2026-10-27
Implementation Authorization: 2026-10-29, proceed with the revised plan
Superseded Plan Artifacts: none

1. Add the real IOC comparison (T1) and Java PVA server regression (T3); establish a failing regression before changing production code. Check: T1, T3.
2. In `src/main/org/epics/archiverappliance/engine/pv/EPICS_V4_PV.java`, `subscribe()` reads the structure at connect (`pvaChannel.read("")`); from it the code fills `totalMetaInfo`: the unit from `display.units`, the precision from `display.precision`, the display limits from `display.limitLow` and `display.limitHigh`, the control limits from `control.limitLow` and `control.limitHigh`, the warning and alarm limits from `valueAlarm.lowWarningLimit`, `highWarningLimit`, `lowAlarmLimit` and `highAlarmLimit`; a member that is absent leaves NaN. The member names are those of the table in `FieldValuesCache`, which maps `control.minStep` to PREC; that entry is not used for the precision. The names are confirmed with `pvxget` on the soft IOC before the code is written. The host name is set from `PVAChannel.getRemoteAddress()` at connect. Check: T1.
3. `PVTypeInfo.absorbMetaInfo` copies the host name of the `MetaInfo`, so that `getPVTypeInfo` carries it as the Channel Access PV does after its first connect. Check: T1, T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | An opt-in JUnit integration test in the pattern of `PVAccessIntegrationTest` and `TypeChangePauseTest` (`SIOCSetup.startSIOCWithDB`, the soft IOC of `src/resources/test/st.cmd` and `ConsoleChartPVs.db`): archive `SR:RF:CAV2:TEMP` through `pva://` and `SR:RF:CAV2:POWER` over Channel Access, with the same non-zero values for `EGU`, `PREC`, `HOPR` and `LOPR` in their `CAV2_*` macros (with the default 0 the old behaviour equals the new one and the comparison cannot fail), and compare `getPVTypeInfo` and `getPVDetails` of the two once the type information exists | JDK 21, Tomcat 9.0.122, EPICS 7.0.10 | The units, precision, display limits and control limits are equal for both protocols; the warning and alarm limits are NaN for both, because neither record sets a severity; `hostName` is set and not empty for the PV Access PV, in `getPVDetails` and in `getPVTypeInfo` |
| T2 | Suite | ./mvnw -B -ntp clean verify | JDK 21 | Pass |
| T3 | Component integration | A Java PVA server sends metadata over the real PVA connection; the PV listener receives it and `PVTypeInfo.absorbMetaInfo` transfers it into the configuration service. Cover non-zero limits, zero, NaN, missing groups and missing members, and host availability at connection notification | JDK 21; default suite, no native IOC | Exact metadata is preserved; missing limits are NaN; host is non-empty |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-10-29 22:40 PDT | JDK 21, Tomcat 9.0.122, EPICS 7.0.10 / PVXS 1.5.2; isolated network namespace | Pass | `PVAccessMetadataIntegrationTest` via `./mvnw -B -ntp -o test -Pintegration -Dtest=PVAccessMetadataIntegrationTest`: the shipped IOC database is archived through both protocols, with units `mm`, precision 3, display/control limits -20 and 80, and warning/alarm limits NaN. `getPVTypeInfo` and `getPVDetails` expose non-empty hosts; Details also carries the unit and precision. `work/m7-integration-isolated.log`; initial field names confirmed by `work/m7-pvxget.log` |
| T2 | 2026-10-29 22:36 PDT | JDK 21 | Pass | `./mvnw -B -ntp -o clean verify -DargLine=-Xmx2g -DforkCount=1 -DreuseForks=true`: 1,163 tests, no failures, errors or skips; WAR packaging and dependency checks pass. `work/m7-verify.log` |
| T3 | 2026-10-29 22:24 PDT | JDK 21; Java PVA server | Pass | `PVAccessMetadataTest`: four tests fail on the previous implementation and pass after the change; includes real PVA reception, all eight limits, unit, precision, missing groups/members, numeric zero and NaN, and host at connection notification and in type information. `work/m7-default-red.log`, `work/m7-targeted.log`; the latter also passes all 13 existing `MetaInfoLimitsTest` checks |

##### Closure Evidence

- Implementation commit: 0ce3996fafe03e39587ca15bbe1c3e8995f69fc9 on ahsoka; required T1, T2 and T3 passed as recorded above.
- Landing observed 2026-10-29 23:00 PDT: after fetching origin, HEAD and origin/ahsoka both resolve to 0ce3996fafe03e39587ca15bbe1c3e8995f69fc9; the tree comparison has no differences.
- Issue #41 observed CLOSED with reason completed on 2026-10-29 23:00 PDT. Its body matches the implemented test placement and completed acceptance criteria; completion comment: https://github.com/jeonghanlee/epicsarchiverap-maven/issues/41#issuecomment-6516125983.

##### GitHub Projection

Title: PV Access PVs are archived without unit, precision, limits and host
Labels: bug
GitHub Milestone: none
Observed State: CLOSED, completed (2026-10-29 23:00 PDT)
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-29 23:00 PDT; issue #41 body and completion comment read back equal to the prepared content; CLOSED with reason completed, label bug, assignee jeonghanlee, no milestone, remote updatedAt 2026-10-30T06:00:21Z

#### M25 - Preserve remaining PVA metadata across collection and retrieval

Origin: bfb0dc71 / M25
Identity History: none
GitHub Issue: #69 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/69)
Status: Complete

##### Summary

PVA metadata has paths beyond the initial configuration fields repaired by M7. `EPICS_V4_PV` does not fill `MetaInfo.label`, which `MetaGet.parseOtherInfo` needs to translate SCAN enum indexes into names. The real IOC run in `work/m7-integration-isolated.log` records `SCAN does not seem to be a valid label`. `FieldValuesCache` maps `control.minStep` to PREC instead of `display.precision`; the pre-fix production receiver regression returned PREC 0.125 instead of display precision 3. DESC and HYST have separate cache mappings, so absence from the M7 method alone does not establish data loss.

##### Scope

- Trace PVA enum choices through `MetaInfo`, SCAN interpretation, sample metadata and retrieval; repair confirmed missing connections.
- Reproduce and correct the precision mapping in `FieldValuesCache`, checking both initial and later metadata values while keeping minStep distinct from decimal precision.
- Trace DESC and HYST from the server response through the cache, archived samples and retrieval. Record supported behavior and repair confirmed omissions within these paths.
- Compare the metadata fields carried by the CA and PVA implementations to identify further gaps; classify any additional findings before expanding implementation scope.

- Extend the PVA metadata path through management/retrieval APIs to PV Details and the Operations/System host views. Include SCAN, enum labels, DESC and HYST display requirements, correcting API or UI omissions where supported values should be visible.
- Correct obsolete PVA unit/host explanations in `mgmt/staticcontent/js/operations.js` and `docs/book/src/interface.md`; inspect shared formatting in `mgmt/staticcontent/js/browse/details.js`, including zero limits versus missing or NaN values.

Out of scope: new acquisition or buffer policies, automatic sampling changes, arbitrary new PVA structure support, and CI installation of a native IOC.

##### Completion Criteria

- A real PVA enum supplies its choice names to metadata consumers, and a shipped IOC SCAN field is interpreted by name without the missing-label warning.
- Precision comes from `display.precision` on every examined path; a distinct nonzero `control.minStep` cannot replace it.
- DESC and HYST have explicit, verified outcomes for initial reception, changes, archive storage and retrieval; any intentional exclusions are documented.
- Tests exercise production paths and fail on each confirmed defective behavior before its correction; the default suite and the relevant native IOC comparison pass.

- PVA values agree only when compared at the same observation point: initial reception with stored configuration, received changes with latest engine metadata, and archived samples with retrieval at their sample times. PV Details identifies stored configuration separately from latest received metadata; Operations/System host observations are compared with connection state. SCAN, enum labels, DESC and HYST have a defined display source and explicit unavailable behavior.
- Shared limit formatting distinguishes valid zero values, including a valid 0/0 pair, from absent or NaN values. Display policy and help text agree with the implemented metadata semantics.
- Operations and the interface manual no longer claim that PVA units or hosts are categorically unavailable; descriptions distinguish stored configuration from connection observations where their update times differ.

##### Dependencies And Decisions

- Decision Date: 2026-10-29. Record this follow-up as a separate milestone and work it immediately after M7, before proceeding to M13.
- M7 is a work-order dependency requested by the owner; it is not a claim that the defects cannot be repaired independently.
- Confirmed source findings: missing PVA assignment to `MetaInfo.label`; `FieldValuesCache` maps `control.minStep` to PREC. On 2026-10-29, direct execution of the production cache at b95203ec37e3c55a899db85f92ac32aa8f76bf68 with display precision 3 and minStep 0.125 returned PREC 0.125 for both latest metadata and sample changes. DESC and HYST were present in that method-level check.
- The same cache check returned native PVA field names for full snapshots, versus EGU/PREC/DESC/HYST-style names for mapped changes. Preserve compatibility while making mapped fields available consistently; do not rewrite historical samples.
- Source finding requiring real-monitor reproduction: `EPICS_V4_PV.handleMonitor` returns before cache updates when the timestamp bits are absent. A metadata-only update may therefore be lost rather than retained for the next sample. Root-bit notifications also need verification.
- UI source findings: PV Details has no SCAN/enum/DESC/HYST rows; Operations and the interface manual contain obsolete PVA host/unit explanations. Stored initial configuration and latest engine metadata must not be silently presented as the same observation.
- The next-work decision does not by itself revise M21 release acceptance or publication actions; reconcile release coverage when the implementation plan is accepted.

- Decision Date: 2026-10-29. Include metadata delivery through APIs to PV Details, Operations/System and related explanations in this milestone; define concrete display behavior in the implementation plan before implementation.

- Observed 2026-10-30: the real PVXS 1.5.2 IOC updates PREC through the main PVA monitor, but a changed DESC remains stale in both an independent PVA monitor and the archiver while a fresh main-PV read returns the changed description. Main-PV HYST remains NaN even with HSV=MINOR; direct `.HYST` reads return 0.75 and direct `.DESC` reads return the changed text. Evidence: `work/m25-ioc-field-probe.log`, produced by the shipped `SIOCSetup` fixture and production PVA receiver with an independent PVA client. No subscription-mask defect is established by these observations.
- Decision Date: 2026-10-30. Implement separate PVA field subscriptions for DESC/HYST, explicitly selected and authorized by the owner. Received field values take precedence over main-PV aliases; absent field channels retain main-PV fallback. Field updates accumulate for the next timestamped sample. Parent disconnect/stop closes field subscriptions, and parent reconnection establishes fresh subscriptions.
- Decision Date: 2026-10-30. Apply the first implementation third-person review finding: independent DESC/HYST field loss releases its cached override and pending field value, then queues the current main-PV fallback if available. Later main-PV updates remain effective; a reconnected field resumes precedence only after a valid value is received. The regression exercises real field-channel closure and recreation with PB serialization.
- Decision Date: 2026-10-30. Apply implementation review 4: retain PVA metadata until the archive buffer accepts a sample carrying it. `ArchiveChannel` acknowledges the exact accepted sample through the compatible `PV` callback; only matching pending values are removed. Pending full snapshots refresh from current metadata before each candidate sample until acceptance. Verify both SCAN selection paths, intervening changes, empty enum choices, PB file persistence, and removal of already accepted metadata.
- The daily snapshot regression reproduced later DESC metadata being attached to an earlier buffered sample. PVA snapshots now attach at sample creation, including the initial sample after reconnection; the writer hook no longer attaches a newer cache to an older timestamp.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-10-30; revised plan after two third-person passes and one second-person pass
Implementation Authorization: 2026-10-30; explicit owner direction to proceed with the reviewed plan, followed by acceptance and authorization of separate DESC/HYST field subscriptions
Superseded Plan Artifacts: none

1. Extend `PVAccessMetadataTest` with real Java PVA enum and numeric servers. Establish failing regressions for enum choices, distinct display precision/minStep, metadata-only notifications followed by timestamped samples, root-bit notifications, zero precision, and DESC/HYST updates. Exercise actual production reception and sample serialization; retain existing fixtures for integration checks. Checks: T1, T2.
2. In `EPICS_V4_PV`, populate enum labels from the received enum structure and retain metadata changes before the timestamp gate. Accumulate changed metadata until a real value sample carrying it is accepted by the archive buffer; do not manufacture samples for property-only updates. Verify label refresh and changed-to-empty choices explicitly. Check: T1.
3. Add optional DESC/HYST field monitors to archived PVA channels through `ArchiveChannel` and `EPICS_V4_PV`; accept field changes without requiring parent timestamps, preserve main-PV fallback when fields are unavailable, and manage reconnect/stop lifecycle. In `FieldValuesCache`, map `display.precision` to PREC and keep `control.minStep` distinct. Use the field-name contract below for initial/daily snapshots and changed-sample metadata; preserve existing native snapshot keys and add the corrected aliases without rewriting historical samples. Update the existing cache tests that currently expect minStep as PREC. Validate actual PB serialization and retrieval, including DESC/HYST and enum labels using existing metadata conventions. Checks: T1, T2.
4. Define API/display sources explicitly: keep `getPVTypeInfo` as stored configuration; expose available latest engine metadata through the existing engine/management PV Details path, using `ArchiveChannel.getLatestMetadata`. Apply the source/time contract below to every displayed metadata row, including SCAN, units, precision, limits and host. Expose enum labels/DESC/HYST from latest engine metadata separately from stored configuration; distinguish unavailable engine metadata while paused or disconnected from an empty value. No new top-level persistence schema or historical-data rewrite is proposed. Checks: T2, T4.
5. In `browse/details.js`, add the agreed metadata rows and preserve valid zero limits, including 0/0. Correct the PVA host wording in `operations.js`; verify `system.js` and `system/judge.js` grouping with actual CA/PVA addresses without assuming identical address formats or one IOC per host. Synchronize `docs/book/src/interface.md`, including the Details content description and affected screenshot when its displayed content changes. Check: T4.
6. Run targeted regressions, opt-in real IOC archive/retrieval checks, the default Maven verify lifecycle, UI static checks and browser verification against the shipped pages and live APIs. Compare values at the observation points below, prove native IOC change delivery through the production subscription, and preserve CA behavior. Checks: T1, T2, T3, T4.

Metadata source/time contract:

| Consumer | Source and comparison point | Display or verification rule |
| --- | --- | --- |
| Stored configuration and existing PV Details units/precision/limits/host/SCAN rows | `getPVTypeInfo`, including SCAN in `extraFields`; configuration snapshot captured at archival setup | Label these values as stored configuration. Runtime metadata changes do not require this snapshot to match the latest engine values. |
| Latest received metadata in PV Details | `ArchiveChannel.getLatestMetadata` through engine/management PV Details | Present enum labels, DESC and HYST as latest received metadata. If units/precision/limits are also shown from this source, keep them separate from stored values. Compare after the corresponding monitor callback has been received. An unavailable engine response is not an empty IOC value. |
| Operations/System host observations | Existing engine connection metrics | Compare with the current connection observation, independently of the host stored at archival setup. |
| Archived sample metadata and retrieval | Metadata retained until a carrying timestamped sample is accepted by the buffer, including initial/daily snapshots | Compare sample fields at that sample's timestamp. Retrieval response headers may contain latest engine metadata and must not be used as proof of historical sample metadata. |

Field-name compatibility contract:

- Newly written initial/daily snapshots retain existing native PVA keys and also contain the mapped aliases. Changed samples contain mapped aliases for changed supported fields, retaining the existing policy for unmapped native fields. `control.minStep` remains a native field and never supplies PREC.
- For new data, `display.precision` supplies PREC; `display.units` supplies EGU; `display.description` supplies DESC; `valueAlarm.hysteresis` supplies HYST. Retain the existing limit mappings. Native keys retain the main-PV response. DESC/HYST aliases use separately received record fields when available, so they may differ from stale or unsupported main-PV native values. A corrected alias takes precedence over stale `MetaInfo` fallback values during snapshot assembly.
- Decision Date: 2026-10-30. Add `ENUM_COUNT` alongside `ENUM_<index>` metadata for PVA choice lists, as explicitly authorized. Every label-list update carries its full current labels and count, including zero for an empty list. Retrieval applies the latest applicable count to omit older labels beyond that count; samples without a count retain their existing interpretation. No PB schema change is required.
- Do not rewrite or reinterpret existing PB files. Retrieve a file produced by the pre-change writer and compare its decoded metadata before and after the change, including an old PREC value originating from minStep. Test new snapshots and subsequent changes separately; corrected new writes must not silently change old stored values.

Native IOC change-delivery procedure (T2):

1. Archive the shipped IOC fixtures and capture initial IOC values, stored configuration, latest engine metadata and timestamped retrieved sample metadata.
2. Through the IOC's supported field-write interface, change PREC, DESC and HYST one at a time to distinct values; hold record processing while observing property-only delivery, then process the record to produce the next timestamped sample. Use only fields the shipped IOC exposes and record any unsupported field explicitly. Retain the production PVA subscription options, including its current `DBE_ARCHIVE` mask, for the baseline.
3. Observe whether each change reaches the production monitor callback, latest metadata, the next archived sample and retrieval. A Java server test cannot substitute for this IOC delivery check. If the production subscription does not receive a change, establish the cause and define the required subscription correction or explicit supported-behavior exclusion before claiming completion.
4. Read historical and changed samples separately and reopen PV Details. Assert the changed values against latest received metadata and changed sample fields, while asserting that stored configuration still represents its original snapshot. Verify SCAN name interpretation and compare CA/PVA only for equivalent supported fields at equivalent observation points.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Component integration | Real Java PVA server sends enum choices, distinct precision/minStep, description and hysteresis through shipped reception, metadata and serialization paths; inspect initial and changed values | JDK 21; default suite | Exact values reach their intended consumers without substitutes for internal production functions |
| T2 | Integration | Run the native IOC change-delivery procedure above through the production subscription, storage and retrieval; compare SCAN interpretation and equivalent CA/PVA fields; verify pre-change PB compatibility | JDK 21, Tomcat 9.0.122, EPICS 7.0.10; opt-in integration suite | Initial snapshots, received changes and timestamped samples match their respective source observations; old PB values remain unchanged; missing-label warnings are absent |
| T3 | Suite | Run the default Maven verify lifecycle after the corrections | JDK 21 | No regression |
| T4 | UI integration | Archive shipped PVA fixtures and use the real management/retrieval APIs and shipped web pages; compare supported SCAN, enum labels, DESC, HYST, units, precision, limits and host with their source values; cover valid zero, NaN and missing members, reopen PV Details after updates, and inspect Operations/System host grouping and help text | Local appliance and IOC; browser; interface manual | Stored and latest values are visibly distinguished and agree with their respective sources; historical sample checks do not use latest response headers; supported values are visible and absent values are explicit; shared CA display remains correct |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-10-30 08:06 PDT | JDK 21; real Java PVA server, SCAN channel, writer, PB files and production reader | Pass: 25 metadata/cache tests; three SCAN regressions pass: both numeric selection paths preserve latest DESC/PREC/HYST and refreshed native snapshots across skipped samples, and the event-triggered path preserves an empty enum list; accepted metadata stops repeating; independent field loss/reconnection and legacy PB decoding also pass | `/tmp/m25-review-7-tests.log` (25 tests, zero failures, errors or skips); `work/m25-scan-red.log` (three pre-fix failures), `work/m25-scan-green.log` (25 targeted passes), `work/m25-scan-verify-2.log`; `work/m25-scan-ack-review.log` confirms older-sample acknowledgement preserves newer metadata |
| T2 | 2026-10-30 08:30 PDT | JDK 21, Tomcat 9.0.122, EPICS 7.0.10 / PVXS 1.5.2; isolated network namespace; WARs rebuilt from c1b08d94b289585259b44d07389ad65d1066f2cf | Pass: shipped native IOC baseline and change-delivery tests both complete with exit 0. Equivalent CA/PVA initial configuration agrees, SCAN is interpreted by name without the missing-label warning, and changed PREC/DESC/HYST reach latest metadata and retrieved sample fields while stored precision remains unchanged. Legacy PB decoding passes separately in T1 | `work/m25-final-runtime.log`, `work/m25-final/manifest.json`; shipped `PVAccessMetadataIntegrationTest.equivalentRecordsHaveEquivalentMetadata` and `changedIocMetadataReachesEngineAndArchivedSamples` run with their real setup and teardown; no internal production-path substitutes |
| T3 | 2026-10-30 02:44 PDT | JDK 21 | Pass after SCAN correction: default Maven verify completed 1,174 tests with zero failures, errors or skips; BUILD SUCCESS, exit 0 | `work/m25-scan-verify-2.log`; the preceding `work/m25-scan-verify.log` ended with exit 143 and is not counted as a completed verify run |
| T4 | 2026-10-30 08:30 PDT | Shipped interface from c1b08d94 WARs; Firefox, local appliance and native IOC | Pass: changed DESC/HYST and SCAN, stored/latest separation, valid 0/0 limits, NaN and absent values, CA Details, pause/resume field reception and disconnected availability. After IOC shutdown, Operations shows all three disconnected PVs in the two actual CA/PVA host groups and System shows 0 of 3 connected. The final Details screenshot was visually inspected. The earlier 431 static checks remain valid for the unchanged UI source | `work/m25-final-runtime.log`, `work/m25-final/m25-details*.txt`, `work/m25-final/m25-details.png`, `work/m25-final/m25-disconnected-api.json`, `work/m25-final/m25-operations-disconnected.txt`, `work/m25-final/m25-system-disconnected.txt`; static checks: `work/m25-field-ui-static.log`; manual screenshot: `docs/book/src/images/browse-details.png`; both fixture teardowns completed and the final driver exited 0 |

T4 documentation verification, observed 2026-10-30 08:42 PDT: `docs/book/src/interface.md` explains parent-channel availability, empty enum choices, independent DESC/HYST field loss, main-PV fallback, and valid-value reception after reconnection. The manual screenshot is the actual final native/browser capture from 08:30 PDT. Its SHA-256 is `b7c9207cbe197713547aaeca3a3bf48e1fce1adefc0d5ec43c30b6f6bd4211ac`; source capture, tracked image, and generated-book image agree. The existing `aa-mdbook` image built the book successfully with exit 0, and the generated HTML contains the updated explanations and image reference. The documentation follow-up is committed in 50fa32baf4dfcdf7b50d60f8091a639037df198f.

Implementation review evidence (2026-10-30): third-person pass 1 reported one must-fix for independent field disconnection; the accepted correction is covered by T1 and the post-fix T3 run. Third-person pass 2 and document second-person pass 3 reported no new findings. Implementation review 4 reported one must-fix for SCAN metadata loss, accepted by the owner and corrected in fc52f0807b371990137bcd975ac62dc0a6c18094. Third-person review 5 and document second-person review 6 have no new findings. Open findings: zero. The additional real PVA/SCAN/writer/file-reader check in `work/m25-scan-ack-review.log` stores an older sample with DESC=First, then stores DESC=Second on the next sample after the newer metadata arrives before the older sample is accepted. Additional execution through the production `GetDataAtTime.GetDataPredicate` with real received and serialized enum samples confirmed that an empty choice list does not restore older labels. This is a component consumer check, not an HTTP end-to-end test. T2 and T4 were repeated successfully against the final committed code after the SCAN correction.

##### Closure Evidence

- Implementation: fc52f0807b371990137bcd975ac62dc0a6c18094; milestone record: c1b08d94b289585259b44d07389ad65d1066f2cf; operator guide, final screenshot and final verification record: 50fa32baf4dfcdf7b50d60f8091a639037df198f. All three are on `origin/ahsoka`. Observed 2026-10-30 10:59 PDT: the live branch ref and the fetched `origin/ahsoka` both returned e42a8efd98279f807c08c23753566864045ddf44, local HEAD agrees, and the three commits are ancestors of that tip. Recheck with `gh api repos/jeonghanlee/epicsarchiverap-maven/git/ref/heads/ahsoka` and compare with local `origin/ahsoka`.
- Final native/browser build: `aa-20261030-c1b08d94-{mgmt,engine,etl,retrieval}.war`, packaged successfully at 2026-10-30 08:21 PDT from the recorded tip. SHA-256 values, respectively: `78a5845ef92ba865fde7bcc16e6e6787d5475858b8b487112f5123985b9a7a6c`, `0a4c2e74df2705e2c1d9be8801d4cbbaa57bb2bb2def95e65ebe9a5d2807c1b6`, `303d6dad37607545ea0062d6e42dd5bd7e6c9af00119a16f05344c11839bd147`, `2b2045003c3fbd52352aadd8e1cacb709bf9f22ce49796538ebfc4a415c018d1`. Evidence: `work/m25-final-package.log`, `work/m25-final/manifest.json`.
- All four required checks have passing observations. Issue #69 body was replaced with the implemented behavior and six checked acceptance criteria, the outcome comment was posted, and the issue was closed as completed at 2026-10-30T17:43:09Z; observed CLOSED at 2026-10-30 10:59 PDT. Recheck with `gh issue view 69 --repo jeonghanlee/epicsarchiverap-maven --json state,closedAt`. Completion recorded 2026-10-30.

##### GitHub Projection

Title: Preserve PVA metadata through storage and web views
Labels: bug
GitHub Milestone: none
Observed State: CLOSED, completed (2026-10-30 10:59 PDT)
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-30 10:59 PDT; issue #69 body equals the projected final body with six checked acceptance criteria, one outcome comment is posted, and the issue is closed as completed at 2026-10-30T17:43:09Z. Label bug, assignee jeonghanlee, no milestone; remote updatedAt 2026-10-30T17:43:09Z

#### M26 - Preserve Channel Access metadata across reception and updates

Origin: bfb0dc71 / M26
Identity History: none
GitHub Issue: #70 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/70)
Status: Complete

##### Summary

Channel Access receives initial metadata, but some values do not reach or refresh stored configuration. At source commit b95203ec37e3c55a899db85f92ac32aa8f76bf68, `MetaInfo.updateTypeInfo` updates precision only when units change and does not replace an existing host. `MetaInfo.applyBasicInfo` handles `DBR_CTRL_Short` through the `GR` branch, which assigns zero to both control limits. Direct execution of the production methods on 2026-10-29 reproduced received precision 5 with stored precision 2, a changed received host with the old stored host, and received short control limits -12/34 with parsed limits 0/0. These are method-level observations using JCA response objects and `ConfigServiceForTests`, not IOC-to-storage verification.

Further defects at the same source commit were found by source reading on 2026-10-30 and each was then reproduced by running the production classes (T1). In JCA 2.4.10 `DBR_CTRL_Short`, `DBR_CTRL_Float` and `DBR_CTRL_Byte` implement `CTRL`, which extends `GR`, and none was handled by the `DBR_CTRL_Double` or `DBR_CTRL_Int` branches, so their control limits became zero. The optional `EPICS_V3_PV.processDBEPropertiesMonitorEvent` accepted `DBR_CTRL_Int` in a branch that cast to `DBR_CTRL_Double`, which cannot succeed because `DBR_CTRL_Int` extends `DBR_GR_Int`, and the other numeric control types reached only an error log. The handler runs only for a PV with `useDBEProperties` and updates field values, not the stored type information. It stored enum labels under the key `LABELS` as one comma-joined value that no code reads, while `MetaInfo.addToDict` and PV Details use `ENUM_<n>`, and no Channel Access path wrote `ENUM_COUNT`. `EPICS_V3_PV.aboutToWriteBuffer` attached changed field values to the last sample of the batch being written, the structure that M25 corrected for PVA, so a field change arriving after an earlier buffered sample was stored with that sample. A PV with only property-event fields had no metadata storage because `ArchiveChannel` never created it, so its first control response raised a NullPointerException, and a control response without units also made the handler throw. CA already receives enum labels, while DESC and HYST use field subscriptions and policy-dependent storage paths; missing data in those paths is not established.

##### Scope

- Correct precision-only and host changes in the CA metadata-to-configuration update path.
- Preserve control limits for every numeric `CTRL` response type, including short, integer, byte, float and double, by reading them from the `CTRL` interface rather than listing types; keep precision from `PRECISION` types only.
- Reproduce property-event handling for every numeric type and for enum metadata, including initialization, updates and persistence; correct the cast and share the field extraction with the metadata-to-configuration path; repair confirmed defects within this path.
- Attach metadata at sample creation, as M25 does for PVA, so that a field change arriving after an earlier buffered sample is not stored with that earlier sample.
- Make the enum label key and the label count agree between the property-event path, latest metadata and stored samples, as PVA does.
- Trace enum labels, DESC and HYST through reception, configuration, sample metadata and retrieval, separating policy exclusions from lost values.
- Retain the existing CA limit reconnect behavior and PVA metadata behavior with regression coverage.

- Verify CA metadata updates through management/retrieval APIs and PV Details, Operations and System views, reusing shared rendering from M25. Correct CA-specific display or API omissions for precision, limits, hosts, enum labels, SCAN, DESC and HYST.
- Update the host description in `mgmt/staticcontent/js/retrieval.js` when stored hosts follow connection changes; align relevant interface-manual and screen explanations with the actual update behavior.

Out of scope: PVA-specific reception and mapping repairs owned by M25, sampling or buffer policies, broad metadata schema redesign, arbitrary server extensions, and native IOC installation in CI.

##### Completion Criteria

- A precision change with unchanged units reaches stored type information; a changed non-empty host replaces the previous host.
- Short, integer, byte, float and double metadata preserve supported control limits, including non-zero and zero values.
- Enabled property-event handling accepts every supported numeric response type without invalid casts or uninitialized metadata storage, and observed changes reach the intended metadata consumers.
- A metadata change is stored with the sample current at its reception or with the next accepted sample, never with an older buffered sample.
- Enum labels, DESC and HYST have explicit verified outcomes for initial reception, updates, archive storage and retrieval; intentional policy exclusions are documented, and the enum label key and count follow the decided policy on every path.
- Regression tests exercise the shipped processing paths and fail on each reproduced defect before correction; the default suite and relevant real IOC integration checks pass.

- After CA metadata changes or reconnect, reopened PV Details and retrieval information show the updated supported values. Operations/System connection-host observations and stored configuration agree once the update completes; any temporary difference is explained accurately.
- Retrieval no longer describes an updated host as the host where the PV was first seen. CA and PVA use consistent zero/missing/NaN display rules and accurate metadata descriptions.

##### Dependencies And Decisions

- Decision Date: 2026-10-29. Keep M25 scoped to PVA and register CA metadata separately, to be worked next after M25 and before M13.
- M25 is a work-order dependency, not a technical prerequisite for the CA fixes.
- The three method-level reproductions of 2026-10-29 establish parser and configuration-update defects only; the property-event and field-storage defects were reproduced and verified afterwards (T1, T2).
- This registration does not change M21 release acceptance; reconcile release coverage when the implementation plan is accepted.
- Decision Date: 2026-10-30. A changed non-empty host replaces the stored host, matching the completion criterion; Retrieval then describes the host as the current connection host, not the host where the PV was first seen.
- Decision Date: 2026-10-30. Include `DBR_CTRL_Float` and `DBR_CTRL_Byte` with `DBR_CTRL_Short`; the three share one cause, so the correction reads control limits from every `CTRL` type.
- Decision Date: 2026-10-30. Channel Access enum labels are stored as PVA does: `ENUM_<n>` and `ENUM_COUNT` are written to stored samples and the `LABELS` key is removed. Consumers already read `ENUM_<n>` and `ENUM_COUNT`, and shrinking choice lists are handled as for PVA, at the cost of a new Channel Access write path. Implementation Plan item 1 first reads the label content of stored samples; if that result contradicts the premise that samples carry no labels, the decision returns to the owner. Result of that reading on 2026-10-30: the premise held. In the default setting a stored sample carried no enum labels, because the daily snapshot omitted them and the property-event path wrote the unread `LABELS` key, and the unfixed handler stored no `ENUM_<n>` or `ENUM_COUNT`; the decision stands. The daily snapshot now carries the connection-time labels without property events, and a changed choice list is stored with property events (T1, T2).
- Impact: attaching metadata at sample creation applies to every Channel Access PV that archives fields, which the default policies do for most record types, not only to PVs with property events. It changes which sample carries a metadata change, not the PB schema; samples written before this change keep their stored fields and interpretation, and no historical file is rewritten. The default path is verified by T1, the default suite and a native check of a default-policy PV that asserts the stored sample fields (T2).
- M25 already changed the shared Operations host text to name Channel Access and PVA endpoints, and its browser checks covered Channel Access Details, zero and NaN limits, and availability states. M26 therefore verifies only what its own changes alter and corrects the remaining Retrieval host wording.

- Decision Date: 2026-10-29. Include metadata delivery through APIs to PV Details, Operations/System and related explanations in this milestone; define concrete display behavior in the implementation plan before implementation.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-10-30; owner acceptance of the revised plan after source review and the enum label storage decision
Implementation Authorization: 2026-10-30; explicit owner direction to implement the accepted plan
Superseded Plan Artifacts: none

1. Reproduce before correcting. With valid JCA response objects, run the production `MetaInfo.applyBasicInfo` for precision-only and host changes and for short, integer, byte, float and double control limits; with the shipped IOC and `useDBEProperties` enabled, drive the property-event handler for each numeric type and for an enum; reproduce a field change arriving after an earlier buffered sample; read the enum label content of stored samples with and without property events. Each regression must fail on the defective behavior. Checks: T1, T2.
2. Correct `MetaInfo`: compare precision independently of units, confirming that a stored precision of an integer PV is not overwritten unexpectedly; replace the stored host when a changed non-empty host arrives; read control limits from every `CTRL` type and precision from `PRECISION` types. Keep the M14 reconnect behavior. Checks: T1.
3. Correct `EPICS_V3_PV.processDBEPropertiesMonitorEvent`: read through the shared `CTRL` extraction instead of the cast, and write enum labels as `ENUM_<n>` and `ENUM_COUNT` and remove the `LABELS` key. Attach metadata at sample creation if the reproduction of item 1 confirms the older-sample defect. Checks: T1, T2.
4. Verify initial registration, metadata updates and reconnect through the shipped IOC and archive paths, reusing the M25 IOC fixture and CA/PVA comparison with appliance WARs rebuilt from the commit under test; keep the PVA metadata tests and the legacy PB decoding check passing. Checks: T2, T3.
5. Verify the Channel Access display path through `browse/details.js`, `retrieval.js`, `operations.js`, `system.js` and `system/judge.js` only where this milestone changes values; correct the Retrieval host wording, update the interface manual, and keep the shared M25 display behavior. Check: T4.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Component | Exercise production metadata parsing and configuration transfer with valid JCA response objects for supported types; cover precision-only changes, changed hosts, and non-zero and zero control limits for short, integer, byte, float and double responses | JDK 21; default suite | Values reach the intended consumers without internal-function substitutes; each regression fails before its correction |
| T2 | Integration | Use shipped IOC fixtures and the real archive APIs to verify initial metadata, field/property changes, reconnect, stored configuration, sample storage and retrieval; include enabled and disabled property-event handling for every supported numeric type and for enum, compare stored sample fields with the metadata received, and include a field change arriving after an earlier buffered sample | JDK 21, Tomcat 9.0.122, EPICS 7.0.10; opt-in integration suite | Supported metadata is preserved across the full path; configured exclusions are explicit; no CA or PVA regression |
| T3 | Suite | Run the default Maven verify lifecycle after the corrections | JDK 21 | No regression |
| T4 | UI integration | Use the shipped IOC, real archive APIs and web pages before and after precision-only changes, host changes, limit changes and reconnect; verify PV Details, Retrieval and Operations/System host views, including enum/SCAN and DESC/HYST behavior under the configured field policy; reopen or refresh views and compare with PVA | Local appliance and IOC; browser; interface manual | Updated CA metadata reaches the displayed values; descriptions match stored versus connection metadata; valid zero is preserved; no shared PVA display regression |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | 2026-10-30 20:59 PDT | JDK 21; valid JCA response objects of every numeric control type, the shipped PV class and the shipped engine start path | Pass: 35 new tests (17 in `MetaInfoCtrlTypesTest`, 17 in `EPICS_V3_PVMetadataTest`, 1 in `ArchiveChannelPropertyEventWiringTest`) and the 13 `MetaInfoLimitsTest` tests pass. Before the correction 5 of 17 tests and 8 of the 9 that can run on the unfixed class failed (the 3 that call the new attachment and acknowledgement methods cannot compile there): precision-only change, host replacement, short, byte and float control limits, property-event fields of every numeric type including integer, enum label keys and count, and a later change stored with an earlier sample. The review round added 4 failing regressions before their correction (a shorter choice list with connection-time labels present, an empty list, a pending change of a removed index, and absent units), the wiring test fails with the NullPointerException when the `ArchiveChannel` line is removed, and a second round added 2 more regressions that failed before their correction (a label response without a label array, which raised a NullPointerException, and concurrent reads whose label keys differed from the count). A further test shows that the daily snapshot carries the connection-time enum labels with `ENUM_COUNT` without property events. The property-event body is called through a package-visible method that takes the response, because a JCA monitor event cannot be built without a channel | `work/m26-ctrl-red.log`, `work/m26-ctrl-green.log`, `work/m26-handler-red.log`, `work/m26-handler-green.log`, `work/m26-review-red.log`, `work/m26-wiring-red.log`, `work/m26-review-green.log`, `work/m26-info-red.log`, `work/m26-info-green.log` |
| T2 | 2026-10-30 21:38 PDT | JDK 21, Tomcat 9.0.122, EPICS 7.0.10 / PVXS 1.5.2; isolated network namespace; WARs `aa-20261031-b362b589-*` packaged at 21:13 PDT from HEAD b362b589346d476d71fa3e469b847f4384203b34 with the uncommitted working-tree changes | Pass: the three `CAMetadataIntegrationTest` methods and the two `PVAccessMetadataIntegrationTest` methods ran with their real fixture setup and teardown. Channel Access: precision 3 to 5 and display limit 80 to 90 reach stored configuration after pause and resume with the unit unchanged, and the stored host equals the connection host the engine reports; with property events enabled, changed `HOPR` and `PREC` reach the latest engine metadata and an archived sample; a changed enum choice reaches the latest metadata as `ENUM_<n>` with `ENUM_COUNT` and an archived sample, with no `LABELS` key. PVA behavior is unchanged. A fourth Channel Access method, run on 2026-10-30 23:45 PDT on the WARs built from the committed HEAD (`work/m26-final-runtime-6.log`), shows for a default-policy PV that SCAN is stored with the configuration and shown in PV Details, that DESC appears in the latest metadata and in an archived sample, that HYST is absent from the latest metadata, that `HOPR` is stored with the first samples and that a changed `HOPR` is stored with a later sample. The shipped IOC fixtures have no short, float or byte records and keep one constant host, so those control types and a host change are covered by T1 only. Not run natively from the method: property events for every supported numeric type (only double and enum ran) and a field change arriving after an earlier buffered sample, which T1 covers | `work/m26-final-runtime-4.log`, `work/m26-final/manifest-working-tree-wars.json` (WAR SHA-256 values; a repeat run rewrites `manifest.json`, so this copy is the record of the working-tree WARs) |
| T3 | 2026-10-30 21:13 PDT | JDK 21 | Pass: default Maven verify completed 1,209 tests with zero failures, errors or skips, BUILD SUCCESS | `work/m26-verify-3.log` |
| T4 | 2026-10-30 21:38 PDT | Shipped interface from the T2 WARs; headless Firefox, local appliance and native IOC | Pass: after the reconnect, PV Details of the Channel Access PV shows stored precision 5.0, display and control limits with high 90.0, and the host; Retrieval shows "Host of the latest connection" and no "first seen" wording; the 431 interface static checks pass. Operations and System host views are not changed by this milestone and keep the M25 verification. Not run from the method: the enum and SCAN display, the DESC and HYST display, views before and after host and limit changes other than the precision and display-limit change above, the zero-limit display and the comparison with PVA; M25 verified this shared rendering, and this milestone changes none of `browse/details.js`, `operations.js` or `system.js` | `work/m26-final/m26-details-ca.txt`, `work/m26-final/m26-retrieval-ca.txt`, `work/m26-final/m26-retrieval-ca.png` (SHA-256 ad4edd483aa937b147cd84b589c66473bbc26cc899857f7c46f25f3e1a47ad2b), `work/m26-ui-static.log` |

Implementation review evidence (2026-10-30): third-person pass 1 read the whole diff, re-ran the tests and four edge cases against the production classes, and reported one must-fix, one minor and three info findings, all accepted by the owner and applied. The must-fix was that a shorter property-event choice list left the labels received at connection in the latest metadata, so PV Details still listed them beyond `ENUM_COUNT`. The minor was that a pending change of an index removed by a shorter list was stored with the next sample. The info items were the missing regression for the `ArchiveChannel` wiring, a control response without units that made the handler throw, and the missing observation that the stored host agrees with the connection host after an update; each is covered by a regression that failed before its correction or by the T2 assertion. Third-person pass 2 re-read the corrected code from consumers and concurrency and reported no finding above the floor; its two info observations were then fixed at the owner's direction: a label response with no label array leaves the metadata unchanged and logs a warning, and the label update and the latest-metadata read share one lock, so that a read no longer sees label keys that differ from the count. Second-person pass 3 read the changed text from the seat of the session that resumes this work and reported four minor findings on the Summary, one completion criterion, the label decision and the steps after the commit, all applied. Second-person pass 4 read the corrected text from the seat that prepares the issue body and the commit text and reported two minor and two info findings, on a decision line that was no longer true, on what the T2 and T4 passes do not cover, on a conditional Scope sentence and on an unexplained test count; all were applied except the conditional sentence in the accepted Implementation Plan, which stays as accepted. Second-person pass 5 read the verification rows from the seat of the session that repeats the checks after the commit and reported two minor findings, on the missing repeat procedure and on the manifest that a repeat overwrites, both applied. Second-person pass 6 read the text from the seat of the owner who approves the commit and reported one minor finding, that the impact on every Channel Access PV with archived fields, the compatibility of stored samples and the evidence level of that path were not stated; it was applied as a Decisions entry. Second-person pass 7 read the text from the seat of a maintainer who meets this code months later and reported no finding above the floor. Its one info observation, that the reason for the shared lock was recorded in no code comment, was fixed at the owner's direction with comments on the lock and on the latest-metadata read; the compiled class is identical to the class in the verified WARs. The third-person and second-person loops have converged, and no further review pass is required before the commit.

##### Closure Evidence

- Implementation: f3f458e70b588f296716cc07fb7e58fdffc45fdf on branch ahsoka, on top of b362b589346d476d71fa3e469b847f4384203b34. Its four checks were observed on the working tree before the commit, after the review findings were applied, with WARs packaged from that tree; the commit adds only the nine files of the working tree. Landing, observed 2026-10-30 23:02 PDT: the live branch ref, the fetched `origin/ahsoka` and the local HEAD all returned 2c05b37667a8277cd1c13c16dbafdc63d022499a, which holds this commit and the register commit that records it. Recheck with `gh api repos/jeonghanlee/epicsarchiverap-maven/git/ref/heads/ahsoka` and compare with local `origin/ahsoka`. Repeat on the commit, observed 2026-10-30 23:28 PDT: the default verify (1,209 tests, zero failures, errors or skips), T2 and T4 passed with WARs `aa-20261031-2c05b376-*` built from HEAD 2c05b37667a8277cd1c13c16dbafdc63d022499a with a clean working tree, and the engine WAR holds the same compiled `EPICS_V3_PV` class as the build; evidence `work/m26-verify-4.log`, `work/m26-final-runtime-5.log`, `work/m26-final/manifest-commit-wars.json` (WAR SHA-256 values) and the Retrieval capture `work/m26-final/m26-retrieval-ca.png` (SHA-256 e974c012415f049d974402e893339dea1553da7eb58bef9784c762353b2d1409). The SCAN, DESC and HYST outcomes that issue #70 lists are existing behavior, not changed here, and a native check of a default-policy PV now evidences them (T2): SCAN is stored in the extra fields at archive time, DESC is a runtime key that the latest metadata reports and the daily snapshot stores without storing each change, and HYST is not collected by default. That check is committed in e91fef785f26fe5934d7f55519924c6e8bfb9b11. To repeat: run `./mvnw verify` to build the WARs, then `unshare -rn python3 work/m26-final/run.py`, which runs the Channel Access and PVA integration tests and the browser check against the newest WARs named for the current HEAD and writes `work/m26-final/manifest.json`. The driver, the browser script and their output are in the untracked `work/m26-final` on the workstation that holds this checkout.
- Final landing, observed 2026-10-30 23:48 PDT: the live branch ref, the fetched `origin/ahsoka` and the local HEAD all returned e48b2319c044b92ad4abe8e2ac2ce15f4af5fba3, which holds the implementation f3f458e70b588f296716cc07fb7e58fdffc45fdf, the native check e91fef785f26fe5934d7f55519924c6e8bfb9b11 and the register commits that record them. Recheck as above. The register commit 66e3ef58cd7d268c50795bea62a18cfed1c041fe, which records the completion and the closure of issue #70, also landed on `origin/ahsoka`, observed 2026-10-30 23:57 PDT with the live branch ref and the local HEAD both returning it.
- Issue #70: its body was replaced with the implemented behavior and seven checked acceptance criteria, the outcome comment was posted, and the issue was closed as completed at 2026-10-31T06:54:24Z; observed CLOSED, reason completed, at 2026-10-30 23:54 PDT with the live body and comment equal to the projected drafts. Recheck with `gh issue view 70 --repo jeonghanlee/epicsarchiverap-maven --json state,closedAt`. Completion recorded 2026-10-30.

##### GitHub Projection

Title: Preserve CA metadata through updates and web views
Labels: bug
GitHub Milestone: none
Observed State: CLOSED, completed (2026-10-30 23:54 PDT)
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-30 23:54 PDT; issue #70 body equals the projected final body with seven checked acceptance criteria, one outcome comment is posted, and the issue is closed as completed at 2026-10-31T06:54:24Z. Label bug, assignee jeonghanlee, no milestone; remote updatedAt 2026-10-31T06:54:24Z

#### M13 - Let a type change to a string or a waveform type succeed

Origin: bfb0dc71 / M18
Identity History: M18 to M13 on 2026-10-26
GitHub Issue: #45 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/45)
Status: Not started

##### Summary

`changeTypeForPV` cannot change a numeric PV to a string or to a waveform type: it answers HTTP 500, leaves the PV paused with its old type, and a PV resumed without the change goes on dropping every event of the new type, so the signal stops being recorded until the operator deletes the PV and archives it again. Observed on 2026-10-17 and 2026-10-18 on the soft IOC of `src/resources/test/st.cmd` restarted with `RECORD_CHANGE=Types` (a follow-up of issue #44). `ChangeTypeForPV` converts the stored history through `etl/conversion/ThruNumberAndStringConversion.java`, whose sample conversion supports the numeric scalar types only; the `DBR_SCALAR_STRING` branch calls `getStringValue(0)` on a numeric sample, which throws the same exception, and the `default` branch throws `UnsupportedOperationException` for every other target.

##### Scope

- The type change succeeds for every target type. The stored history is converted into the new type by the rewrite of the stores that the type change already uses: a number becomes its text, and a scalar becomes a waveform of one element; a conversion that is already defined (number to number) is kept. The earlier samples are therefore readable in the new type, not as they were stored; keeping them under their old type is the design of the deferred row for the automatic reaction to a changed record (issue #48).
- The call reports its result in its JSON answer and in the log of the management web application, where `ChangeTypeForPV` runs.

Out of scope: an automatic type change by the engine without an operator call; keeping the earlier samples under their old type (issue #48); the console page that offers the change.

##### Completion Criteria

- `changeTypeForPV` to `DBR_SCALAR_STRING` and to `DBR_WAVEFORM_DOUBLE` on a PV archived as `DBR_SCALAR_DOUBLE` returns HTTP 200, the PV resumes as Being archived with the new type in `getPVTypeInfo`, and the dropped-events count stops growing.
- The samples stored before the change are readable through `getData` in the new type (a number as its text, a scalar as a waveform of one element), and a window across the change returns both the earlier and the later samples.
- The JSON answer of the call names the old and the new type and says that the stored history was converted, and the log of the management web application names the PV, the old type and the new type.
- The record-change checks on the soft IOC with `RECORD_CHANGE=Types` pass for all four records of `ConsoleChartPVsRecordChangeTypes.db`: `SR:BPM:04:X` (`longin`), `SR:BPM:04:Y` (`stringin`), `SR:BPM:03:X` (`waveform`) and `SR:BPM:03:Y` (`longin`). For each record, archived first as a scalar double with the default databases, the IOC restarts with `RECORD_CHANGE=Types`, the PV is paused, `changeTypeForPV` is called with the type of the new record (`DBR_SCALAR_INT`, `DBR_SCALAR_STRING`, `DBR_WAVEFORM_DOUBLE`, `DBR_SCALAR_INT`) and the PV is resumed, and the first criterion holds.

##### Dependencies And Decisions

- D9 (Decision Date 2026-10-24): worked after the release.
- D12 (Decision Date 2026-10-27): carried by release Ahsoka as row 4 of 4, before M21.
- The owner decided on 2026-10-28 that the history is converted (a number into its text, a scalar into a waveform of one element) and not kept under the old type, that the string and the waveform targets are both in this row, and that the content of the JSON answer is as the Completion Criteria state. If the investigation of step 2 shows a change of the read path or of the engine beyond the type information, the work stops and returns to the owner.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-10-28, accepted by the owner in the planning conversation, with a stop condition at step 2
Implementation Authorization: none
Superseded Plan Artifacts: none

1. T1 first: the unit test fails on the code of today. Check: T1.
2. Before the code is written, find where the element count of a waveform PV comes from when the PV resumes (the record through the channel, or a parameter of the call) and what the engine does when the count differs from the type information; the answer is recorded in this detail. `ChangeTypeForPV` sets `isScalar` and the element count for a waveform target by that answer. If the answer needs a change of the read path or of the engine beyond the type information, the work stops and returns to the owner. Check: the recorded answer.
3. In `src/main/org/epics/archiverappliance/etl/conversion/ThruNumberAndStringConversion.java` the string target converts a numeric sample into the text of its number, and the waveform targets convert a scalar sample into a vector of one element; whether the serializing constructor of each waveform type accepts that value is answered by T1, starting with `DBR_WAVEFORM_DOUBLE`. Check: T1.
4. The JSON answer and the log of the management web application carry the result of the third Completion Criterion above. Check: T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit | `ChangeTypeForPV` with a numeric history and each target type, through a real `ConfigService` of the suite (`ConfigServiceForTests`) with only the HTTP request and response as stand-ins | JDK 21 | Numeric targets convert as before; the string target converts each number into its text; the waveform target converts each sample into a vector of one element; no exception |
| T2 | Integration, manual with `ioc-runner` | Follow the section "Run the test IOC of the console checks" of `docs/book/src/developer.md` (the step with `RECORD_CHANGE=Types`): archive the four records of `ConsoleChartPVsRecordChangeTypes.db` as scalar doubles over Channel Access with the default databases, restart the IOC with `RECORD_CHANGE=Types`, and for each PV call `pauseArchivingPV`, `changeTypeForPV` with the new type of its record and `resumeArchivingPV`; read `getPVTypeInfo`, the report `getPVsByDroppedEventsTypeChange` and `getData` over a window around the change; the exact calls and the instant of the change are written into the result row at the run | JDK 21, Tomcat 9.0.122, EPICS 7.0.10 | HTTP 200, new type in `getPVTypeInfo`, dropped-events count constant, earlier samples (in the new type) and later samples returned in one window, and the JSON answer and the management log as the content named in the third Completion Criterion |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | pending | | | |
| T2 | pending | | | |

##### Closure Evidence

- none

##### GitHub Projection

Title: Type change to string or waveform fails
Labels: bug
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-28 00:46 PDT; `gh issue edit 45` replaced the body with the projection of this detail, read back OPEN with a body equal to the draft, label bug, assignee jeonghanlee, no milestone, remote updatedAt 2026-10-28T07:46:19Z

#### M21 - Release Ahsoka

Origin: bfb0dc71 / M21
Identity History: none
GitHub Issue: none
Status: Not started

##### Summary

Release Ahsoka carries the four rows M12, M14, M7 and M13, in that order, on the branch ahsoka. It follows release 2026-10, whose install and run check D11 accepts. This row owns the release-wide re-runs, the version change, the release actions and the final checks; the work of the four rows is implemented, verified and accepted in their own details. The combined branch is the branch ahsoka once the four rows are Complete. Phase 4 is the cycle planning of the `release-cycle` procedure, in which the owner reviews and accepts each plan and records the implementation authority separately. The soft IOC is the one of D3.

##### Scope

- Each of M12, M14, M7 and M13 is Complete in its own detail before this row starts its checks.
- The Integrated Verification rows run on the combined branch before the version change.
- The project version in `pom.xml` is set to Ahsoka, the branch ahsoka is merged into master with a merge commit, the annotated tag Ahsoka is created on that merge commit, and issues #52, #47, #41 and #45 close through `Closes` trailers of the version commit when it reaches master.
- The sentence of `README.md` that names the form of a release tag is changed in a docs commit of its own, before the version change.
- The documented install-from-bundle path runs on Debian 13 and on Rocky Linux 8.10 with the bundle built from the tag Ahsoka.

Out of scope: any other Backlog row; a long run of the tag in the environment repository, which the owner decides after the release; the analyzer rows.

##### Completion Criteria

- M12, M14, M7 and M13 are Complete.
- Every Release Verification row below reads Pass with reachable evidence.
- The tag Ahsoka is an annotated tag on the merge commit, that commit is on origin/master, and the Maven workflow succeeded on it.
- Issues #52, #47, #41 and #45 are observed closed.
- `README.md` names the tag of a release as the name of the release, for example `2026-10` or `Ahsoka`, and no longer as a form `YYYY-MM` (Release Verification 14).

##### Dependencies And Decisions

- M12, M14, M7, M13: the checks of this row run on their combined result.
- D12 (Decision Date 2026-10-27): the scope, the name and the order.
- The owner decided on 2026-10-28 that the sentence of `README.md` about the tag name is changed in a docs commit of its own before the version change, that the clean hosts of the installation check are test guests requested from the provisioning session when the check starts and returned with a finished notice, and that a long run of the tag is not part of this row.
- The Integrated Verification rows are shared-surface candidates: M7 fills `MetaInfo` and M14 updates it (details of M7 and M14), and `ChangeTypeForPV` of M13 reads and writes the same `PVTypeInfo` as `MetaInfo.updateTypeInfo` through `getTypeInfoForPV` and `updateTypeInfoForPV`. The plan review of phase 4 confirms or removes each.

##### Implementation Plan

Plan Status: accepted
Plan Acceptance: 2026-10-28, accepted by the owner in the planning conversation
Implementation Authorization: none
Superseded Plan Artifacts: none

1. When the four rows are Complete, run the Integrated Verification rows on the combined branch. Closes with Release Verification 13, 1 and 2.
2. Commit the README sentence, push the branch ahsoka (Release Execution 1) and read the Maven workflow on its tip. Closes with Release Verification 14 and 3.
3. Check the version, change it, commit it with the trailers, push the branch (Release Execution 2 and 3) and read the Maven workflow on the version commit. Closes with Release Verification 4, 5 and 6.
4. Merge into master, push master, create and push the tag (Release Execution 4 to 7) and read the Maven workflow runs on the merge commit, the one of the master push and the one that the tag push starts. Closes with Release Verification 7 and 8.
5. Install from the bundle of the tag on the two supported distributions, observe the closed issues, delete the branch (Release Execution 8) and record the results in this register (Release Execution 9). Closes with Release Verification 9, 10, 11 and 12.

##### Integrated Verification

| Source Check | Re-run Trigger | Shared Surface | Release Verification Label | Expected Result | Result Evidence |
| --- | --- | --- | --- | --- | --- |
| M7 / T1 | the change of M13 to the type change is in the same tree as the type information written by M7 and M14 | `PVTypeInfo` through `getTypeInfoForPV` and `updateTypeInfoForPV`; `getPVTypeInfo` and `getPVDetails` of archived PVs | Release Verification 1 | the units, precision, limits and host name are present and equal for both protocols on the combined branch | pending |
| M14 / T2 | the change of M13 and the type information written by M7 are in the same tree | `getPVTypeInfo` after an IOC restart with changed limits, and the unit and precision of `SR:BPM:03:Y` after its type change, the soft IOC of `src/resources/test/st.cmd` | Release Verification 2 | the new display limits within one reconnect on the combined branch, and the unit and precision still present after a type change | pending |

##### Production Environment Tests

| Release Verification Label | Timing | System | Version | Architecture | Deployment Path | Method | Expected Result | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Release Verification 9 | post-release | Debian 13, a clean test guest requested from the provisioning session for this check, with `curl`, which step 4 of the install page uses; a finished notice returns it | the bundle built from the tag Ahsoka, once, on the development host (JDK 21 and git installed) in a fresh clone of origin after Release Execution 7 with the tag checked out and `./mvnw -B clean package -DskipTests` (`docs/book/src/building.md`); the file name `aa-<date>-<commit>.tar.gz` is recorded, its commit part equals the first eight characters of the merge commit recorded at Release Execution 4, and the file is copied to the clean host | x86_64, confirmed with `uname -m` at the run | `docs/book/src/install-bundle.md` | follow every step of the install page with that bundle, the soft IOC of `src/resources/test/st.cmd` started on the development host as `<ioc_address>` (reachable from the clean host over Channel Access, UDP 5064 and the server TCP port), and `SR:BPM:01:X` of `ConsoleChartPVs.db` as `<pv_name>` | the four instances report `STARTUP_COMPLETE`, the PV reaches `connectionState` true, and the read-back reply holds at least one sample, counted by `curl -s "http://localhost:17668/retrieval/data/getData.json?pv=<pv_name>" \| grep -o '"val"' \| wc -l` | the four `startupState` lines, the `getPVStatus` reply, the sample count, the bundle file name, the `uname -m` output and the `sha256sum` of the bundle on the development host and on this host, written into the result row |
| Release Verification 10 | post-release | Rocky Linux 8.10, a clean test guest requested the same way, with `curl`; a finished notice returns it | the same bundle, copied to this host | x86_64, confirmed with `uname -m` at the run | `docs/book/src/install-bundle.md` | the same steps with the same bundle, IOC and PV | the same result | the same items, written into the result row; the two `sha256sum` values are equal to those of the Debian 13 row |

##### Version Changes

| Field | File | Before | Planned After | Pre-check | Pre-check Label | Post-check | Post-check Label |
| --- | --- | --- | --- | --- | --- | --- | --- |
| project version | `pom.xml` | 2026-10 | Ahsoka | `grep -m1 -E '^  <version>' pom.xml` prints the version line | Release Verification 4 | the same command prints the new value | Release Verification 5 |

##### Release Execution

The owner's push trigger for steps 1, 3 and 5 covers the outgoing commits named in the step: the commits of the four rows and the register commits, and at step 5 the merge commit as well; the executor reads them with the preflight of the Push scope. A push to a ref cancels the Maven run still in progress on that ref, so the executor waits for the run of the previous push to finish before the next push. The evidence of a step is the command output named in its Expected Result, copied into the Evidence column when the step runs.

| Step | Action | Authorization | Expected Result | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Change the sentence of `README.md` that names the form of a release tag to "A release is an annotated tag named after the release, for example `2026-10` or `Ahsoka`." and commit it on its own; then push the branch ahsoka with a plain `git push` (the branch exists on origin with its upstream) and record the tip with `git rev-parse HEAD` | commit delegation and push delegation | the README commit is separate from the version commit; origin/ahsoka equals the recorded tip and the Maven workflow runs on it | pending |
| 2 | After Release Verification 3 reads Pass, run the pre-check (Release Verification 4), edit the version line of `pom.xml` (`  <version>2026-10</version>` to `  <version>Ahsoka</version>`), run the post-check (Release Verification 5), commit it on the branch ahsoka with the trailers `Closes #52`, `Closes #47`, `Closes #41` and `Closes #45` and record the commit with `git rev-parse HEAD` | commit delegation | `git show --stat` lists only `pom.xml` with one line changed, the message carries the four trailers, and the commit ID is recorded | pending |
| 3 | Push the branch ahsoka | push delegation | the Maven workflow runs on the version commit recorded at step 2 | pending |
| 4 | After Release Verification 6 reads Pass, run `git fetch`, check out master (`git rev-list --count ahsoka..master` prints 0 and `git rev-parse master origin/master` prints one ID twice), merge with `git merge --no-ff ahsoka -m "Merge ahsoka: Ahsoka release"` and record the merge commit with `git rev-parse HEAD` | user-run | a merge commit on master (`git rev-list --parents -n 1 HEAD` prints three IDs); `git rev-list --count ahsoka ^HEAD` prints 0; the merge commit ID is recorded | pending |
| 5 | Push master | push delegation | origin/master equals the merge commit, the four issues close and the Maven workflow runs on it | pending |
| 6 | After Release Verification 7 reads Pass, create the annotated tag Ahsoka on the merge commit with the message `Release Ahsoka` | tag create delegation | the tag object peels to the merge commit | pending |
| 7 | Push the tag Ahsoka | tag push delegation | the remote tag object equals the local tag object | pending |
| 8 | Delete the branch ahsoka, local and on origin | user-run | `git branch --list ahsoka` and `git ls-remote --heads origin ahsoka` print nothing | pending |
| 9 | Record the results of Release Verification 1 to 14 in this register, commit it and push master | commit delegation and push delegation | `git rev-parse master origin/master` prints one ID twice; the push changes only the register and starts no run | pending |

##### Release Verification Plan

| Label | Layer | Timing | Method | Environment | Expected Result | Evidence Target |
| --- | --- | --- | --- | --- | --- | --- |
| Release Verification 1 | Integration | pre-change | the method of M7 / T1 on the combined branch | JDK 21, Tomcat 9.0.122, EPICS 7.0.10, soft IOC | the result of M7 / T1 | the observed values of the two protocols |
| Release Verification 2 | Integration | pre-change | the method of M14 / T2 on the combined branch, and, on `SR:BPM:03:Y` after the `changeTypeForPV` call of M13 / T2, a read of `getPVTypeInfo` | JDK 21, Tomcat 9.0.122, soft IOC | the result of M14 / T2, and `SR:BPM:03:Y` still reports the unit mm and the precision 3 after the type change; its limits are 0 before and after | `getPVTypeInfo` before and after the restart |
| Release Verification 3 | Suite | pre-change | the Maven workflow on the tip of the pushed branch | GitHub Actions: Ubuntu 24.04, Debian 13, Rocky Linux 8.10 | the three jobs succeed | the run URL and the tip recorded at Release Execution 1 |
| Release Verification 4 | Version | pre-change | the pre-check of Version Changes | the working tree | the version line reads 2026-10 | the command output |
| Release Verification 5 | Version | post-change | the post-check of Version Changes | the working tree | the version line reads Ahsoka | the command output |
| Release Verification 6 | Suite | post-change | the Maven workflow on the version commit | GitHub Actions: Ubuntu 24.04, Debian 13, Rocky Linux 8.10 | the three jobs succeed | the run URL and the commit recorded at Release Execution 2 |
| Release Verification 7 | Suite | post-change | the Maven workflow run of the master push on the merge commit; the Pages run of the master push when it changes `docs/book/` | GitHub Actions: Ubuntu 24.04, Debian 13, Rocky Linux 8.10 | the three jobs succeed in the Maven run and the Pages run succeeds | the run URLs |
| Release Verification 8 | Release object | post-release | `git cat-file -t refs/tags/Ahsoka`, `git rev-parse refs/tags/Ahsoka`, `git rev-parse 'refs/tags/Ahsoka^{commit}'`, `git branch -r --contains <merge-commit>` and `git ls-remote --tags origin refs/tags/Ahsoka`, where `<merge-commit>` is the ID recorded at Release Execution 4; the Maven workflow run that the tag push starts on the same commit once Release Execution 7 is done | the repository, origin and GitHub Actions | an annotated tag on the merge commit, that commit contained in origin/master, the remote tag object equal to the local one, and the three jobs of the tag run succeed | the object IDs and the run URL |
| Release Verification 9 | Production | post-release | the production test of the Debian 13 row | Debian 13 | the expected result of that row | the record named there |
| Release Verification 10 | Production | post-release | the production test of the Rocky Linux 8.10 row | Rocky Linux 8.10 | the expected result of that row | the record named there |
| Release Verification 11 | Tracker | post-release | `gh issue view` of #52, #47, #41 and #45 | GitHub | the four issues are closed | the observed states |
| Release Verification 12 | Branch | post-release | `git branch --list ahsoka` and `git ls-remote --heads origin ahsoka` after Release Execution 8 | the repository and origin | both print nothing | the command output |
| Release Verification 13 | Status | pre-change | read the Status line of the details of M12, M14, M7 and M13 in this register | this register | all four read Complete | the four Status lines |
| Release Verification 14 | Documentation | pre-change | `grep -n "annotated tag" README.md` on the tip recorded at Release Execution 1 | the working tree | the line names the tag as the name of the release and not as a form `YYYY-MM` | the command output |

##### Release Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| Release Verification 1 | Not run | combined branch | Pending | none |
| Release Verification 2 | Not run | combined branch | Pending | none |
| Release Verification 3 | Not run | GitHub Actions | Pending | none |
| Release Verification 4 | Not run | working tree | Pending | none |
| Release Verification 5 | Not run | working tree | Pending | none |
| Release Verification 6 | Not run | GitHub Actions | Pending | none |
| Release Verification 7 | Not run | GitHub Actions | Pending | none |
| Release Verification 8 | Not run | repository and origin | Pending | none |
| Release Verification 9 | Not run | Debian 13 | Pending | none |
| Release Verification 10 | Not run | Rocky Linux 8.10 | Pending | none |
| Release Verification 11 | Not run | GitHub | Pending | none |
| Release Verification 12 | Not run | repository and origin | Pending | none |
| Release Verification 13 | Not run | this register | Pending | none |
| Release Verification 14 | Not run | working tree | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

none: the issues of the four rows carry the work; this row has no issue.

## Backlog

Backlog rows are unassigned, use the same schema, and are excluded from the release tally.

### Work

| Group | ID | Work unit | Type | Status | Ready | Deps | Done when / Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Interface analyzer | M1 | Analyzer phase A: page, header and address | Milestone | Not started | Yes | D1, D2, D5 | The analyzer is an independent service with the header, menu and time zone choice of the console, a page composition the owner approved from a mockup (tabs by kind of analysis, a drawer of Signals, Axes, Options, Data and Export), the Trend tab drawn through the chart component, and an address that carries the PVs, the window, the zone and the options the component has; the console passes its options; [detail](#m1---analyzer-phase-a-page-header-and-address) |
| Interface analyzer | M2 | Analyzer phase B: interaction, options and export | Milestone | Not started | No | M1, D2, D5 | The gestures beyond the simple form (the drag tool chosen on the strip, wheel and pinch zoom, undo and redo of the range, two cursors, pinned samples), the options the reference tools offer (line width and style, a gap threshold, a fill between signals, fixed and soft ranges, the averaging interval or raw samples, the min-max band, a split by unit, SI prefixes, a legend table, tooltip modes), the Data tab and the full Export tab, each carried in the address; [detail](#m2---analyzer-phase-b-interaction-options-and-export) |
| Interface analyzer | M3 | Analyzer phase C: tools for one signal | Milestone | Not started | No | M2, D2, D5 | The Distribution, Compare and Spectrum tabs: the summary and moments, histogram and box plot, moving statistics, the limits with the time beyond them, the pattern by hour and weekday, two ranges or two signals compared with their tests, and the spectrum by FFT with autocorrelation, computed by the page where the D3 bundle has no function and checked on signals of known parameters; [detail](#m3---analyzer-phase-c-tools-for-one-signal) |
| Interface analyzer | M4 | Analyzer phase D: tools for two and several signals | Milestone | Not started | No | M3, D2, D5 | The Correlation tab (pairing by held values, scatter with projections and density, Pearson and Spearman, profile, the fit panel with fixed and bounded parameters) and the Dependency tab (correlation matrix ordered by clustering, ranking by mutual information, multiple regression, principal components), derived signals from a typed expression and a change of unit, the routines checked on signals of known parameters; [detail](#m4---analyzer-phase-d-tools-for-two-and-several-signals) |
| Interface analyzer | M5 | Analyzer phase E: waveform and image analysis | Milestone | Not started | No | M4, M3, D2, D5 | The analyzer draws an array at a time, over time and as a heatmap, computes its summary values and spectrum, and analyses an image by region, projections, centroid and size; [detail](#m5---analyzer-phase-e-waveform-and-image-analysis) |
| Interface console | M6 | Appliance status as PVA PVs | Milestone | Not started | Yes |  | The appliance publishes its status measures as PVA PVs through its own PVA server and archives them, so the analyzer plots them like any archived PV; [detail](#m6---appliance-status-as-pva-pvs) |
| Retrieval protection | M8 | Bound the concurrent calls of the PVAccess retrieval service | Milestone | Not started | Yes | D7 | The retrieval PVAccess service runs at most a measured number of calls at a time and refuses the next with a message in its log; a test with more long calls than that, on separate connections, fails on the old code and passes on the new; [detail](#m8---bound-the-concurrent-calls-of-the-pvaccess-retrieval-service) |
| Retrieval protection | M9 | Measure the thread and valve limits and the remaining qualification cells of the retrieval protection | Milestone | Not started | Yes | D8 | A measured table of busy threads, response times, memory decisions and valve refusals against concurrency under combined console and retrieval load, at 512 MiB and 2 GiB and under two `maxThreads` values; the valve default recorded with the rule that produced it in the register, the book and `TESTING.md`, with a test that runs at that default; each unmeasured qualification cell measured or recorded as not measured with the reason; issue #58; [detail](#m9---measure-the-thread-and-valve-limits-and-the-remaining-qualification-cells-of-the-retrieval-protection) |
| Retrieval protection | M10 | Decide the stamping and filtering rule of summary bins at the window edges | Milestone | Open | No | D8 | A recorded decision on whether a bin whose samples lie inside the requested window is returned when its midpoint stamp lies after the window end, checked against the archive viewers and the Python clients; if the rule changes, such a bin is returned regardless of the request time and `VariousPostProcessorTest` passes with its original one-day window; if it stays, the retrieval page of the book states it; issue #59; [detail](#m10---decide-the-stamping-and-filtering-rule-of-summary-bins-at-the-window-edges) |
| Retrieval protection | M11 | Check the retrieval operators outside the declared-size check | Milestone | Not started | Yes | D10 | Each of the five candidates, `FirstSamplePP`, `DeadBand`, `Fliers` and `IgnoreFliers`; the per-bin values of `Median`, `Kurtosis` and `Skewness`; the number of `pv` parameters of `getDataForPVs`; the names posted to `getDataAtTime`; the `;` separated names of the PVAccess call, has a recorded real-request result at a 512 MiB heap, refused with a named condition or completed without exhausting the heap, and every candidate that exhausted it has a correction with a test that fails without it; issue #60; [detail](#m11---check-the-retrieval-operators-outside-the-declared-size-check) |
| Appliance defects | M15 | Archiving continues across a change of the record | Milestone | Deferred | No | D4 | The engine detects a change of the archived record (type, rate, unit, precision or limits) on its own and goes on storing the signal under the new condition from the instant of the change, with the earlier samples readable as they were stored; deferred to the next major release by D4; the GitHub issue that holds the direction is filed; [detail](#m15---archiving-continues-across-a-change-of-the-record) |
| Scripts and checks | M16 | Modernize the retained state-changing sample scripts | Milestone | Not started | Yes |  | Each of the seven retained scripts that change appliance state has a defined input, response, timeout and failure contract, keeps its recorded procedure, and passes real-entry-point verification against the appliance; the scripting page documents each; [detail](#m16---modernize-the-retained-state-changing-sample-scripts) |
| Scripts and checks | M17 | Mail delivery for the alert checks | Milestone | Not started | Yes |  | emailHandler.py's mail delivery is available to the on-demand alert checks of M37 (previous document, commit bfb0dc71) with a defined configuration, timeout and failure contract and is verified against a real SMTP endpoint; [detail](#m17---mail-delivery-for-the-alert-checks) |
| Scripts and checks | M18 | Verify the proxy to an external Archiver Appliance | Milestone | Not started | Yes |  | An integration test on two appliances registers the second as an external `ARCHAPPL_PBRAW` server of the first and observes, through the first, the data, the name match and the value at a time of a PV archived only on the second; [detail](#m18---verify-the-proxy-to-an-external-archiver-appliance) |
| Verification | M19 | Verify signal storage and important-signal delivery under client overload | Milestone | Deferred | No |  | Long-term plan, deferred on 2026-10-22: verify signal storage first, important-signal storage and delivery second, and client request handling last; issue #55; [detail](#m19---verify-signal-storage-and-important-signal-delivery-under-client-overload) |
| Verification | M20 | Integrated 24-hour ETL, journal and sample-buffer verification | Milestone | Blocked | No | G1 | Separate corrected-build campaign after four-hour acceptance and required Ansible tool readiness; independent product results; [detail](#m20---integrated-24-hour-etl-journal-and-sample-buffer-verification) |
| Interface console | M22 | Restore viewed PVs after tab navigation | Milestone | Not started | Yes |  | Returning to the viewer restores the previously selected and plotted PVs without entering them again; deliberate removal remains effective; issue #72; [detail](#m22---restore-viewed-pvs-after-tab-navigation) |
| Interface console | M23 | Select matching PVs together and improve Find | Milestone | Not started | Yes |  | The operator can select matching PVs together; search assistance preserves exact Glob behavior and makes selection limits explicit; issue #73; [detail](#m23---select-matching-pvs-together-and-improve-find) |
| Interface console | M24 | Explain sampling changes and hide irrelevant confirmation controls | Milestone | Not started | Yes |  | Change sampling shows only applicable controls and explains MONITOR, SCAN and the period; required confirmations of other operations remain visible; issue #74; [detail](#m24---explain-sampling-changes-and-hide-irrelevant-confirmation-controls) |
| Interface console | M27 | Distinguish plotted lines and retain accessible display preferences | Milestone | Not started | Yes |  | Plot lines differ beyond color; color-vision display options and time/display defaults survive navigation within the browser session; issue #71; [detail](#m27---distinguish-plotted-lines-and-retain-accessible-display-preferences) |
| Configuration | M28 | Study dynamic configuration reload and immediate API application | Milestone | Not started | Yes |  | A recommendation, supported by code references and by measurement on the real configuration and acquisition paths, classifies each configuration setting as dynamically applicable, requiring Channel Access context recreation or requiring a restart, compares 60-second polling with explicit API application, and states its unsupported cases and the behavior that remains unverified; issue #68; [detail](#m28---study-dynamic-configuration-reload-and-immediate-api-application) |
| Tracking | G1 | Ansible tools ready for the integrated 24-hour campaign | External gate | Open | No |  | ansible-provision supplies real-path readiness evidence for the corrected tools required by M20; [detail](#g1---ansible-tools-ready-for-the-integrated-24-hour-campaign) |

### Backlog Details

#### M1 - Analyzer phase A: page, header and address

Origin: bfb0dc71 / M5
Identity History: M5 to M1 on 2026-10-26
GitHub Issue: #39 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/39)
Status: Not started

##### Summary

The analyzer is the viewer of the retrieval web application (`archViewer.html`, `viewer.js`, `viewer.css`) with few drawing options and no analysis tool. Its menu entry `analyzer.html` forwards to it (`js/analyzer-forward.js`), it carries no site header, logo or menu, and it reads only `pv`, `from` and `to` from its address. The Browse PVs page of M58 (previous document, commit bfb0dc71) opens it and the chart component of M59 (previous document, commit bfb0dc71) draws the simple form; this phase gives the analyzer the site header, logo, menu and time zone choice of the console while it stays an independent service, the page composition the owner approves, and an address that carries the options of the page that opened it; the gestures and options beyond the simple form are phase B (M2) and the analysis tabs are phases C to E. Its input for plotting an archived PV, **Add**, can be taken for starting archiving.

##### Scope

Phase A of `docs/design-analyzer.md` (D5): the analyzer as a page of the console's family, with nothing of the analysis yet.

- The page composition, decided from a clickable mockup the owner reviews: the selection and the range strip at the top, tabs by kind of analysis in the middle (Trend, Distribution, Correlation, Dependency, Spectrum, Compare, Waveform, Image; a tab is enabled by the kind of the chosen signals), a drawer with the tabs Signals, Axes, Options, Data and Export, and the place of the range strip and the options (design, Page composition).
- The independent service with the header of the console: the site header and logo, the same menu as the console pages whose items navigate to the console pages at `mgmtURL`, the time zone choice of M67 (previous document, commit bfb0dc71) (its step 5 moves here), the Analyzer entry marked on both sides; the retrieval `BPLServlet` registers the management's `GetApplianceInfo` action so the page reads `mgmtURL` from its own origin; the marker blocks of the header on the page and the static check covering it; the input for plotting a PV named for what it does (design, Page and header; decisions D1, D2, D6 of the design document).
- The Trend tab drawn through the chart component in the simple form, with the drawer's Signals, Axes and Options tabs holding what the component has (one axis per unit, the legend, the Chart options), the Data tab with the table of statistics the component has, and the Export tab with Copy link and the CSV of the viewer as they are; the viewer's one chart per unit becomes the split option of phase B.
- The address: `pv`, `from`, `to`, `tz`, `view` (the tab), and the options the component has (`shape`, `yscale`, `marks`, `avg`, `band`, `window`, `yproj`, `yrange`), read on opening, written back as the page changes, unknown names and unreadable values ignored; the control of the Browse PVs page adds the options chosen on the page to the address it opens (design, Address; decisions of 2026-10-14 and D3 of the design document).
- The book: `interface.md` and `operating.md` for the page as it is after this phase; `MgmtPageLinksTest` for the page and the entry.

Out of scope: the gestures and options beyond the simple form, the Data table of samples and the full Export tab (M2, phase B); the analysis tabs (M3, M4, M5); the Browse PVs panels, which stay (D4 of the design).

##### Completion Criteria

- The analyzer opens from its menu entry and from the Browse PVs page with the site header, logo, menu and time zone choice above it; each menu item opens its console page; the Analyzer entry is marked; the address of the viewer opens on its own.
- No analyzer control uses the wording of archiving a PV.
- The page shows the composition the owner approved: the tabs by kind of analysis with the Trend tab live and the others present but empty or disabled by the kind of signal, and the drawer with its five tabs.
- The Browse PVs page with options set opens the analyzer with the same PVs, window, zone and options; an address with `pv`, `from` and `to` alone opens as before; a name the page does not know or a value it cannot read is ignored; the address follows every change of the page.
- The static check covers the analyzer page's marker blocks; the default suite passes; the book describes the page as shipped.

##### Dependencies And Decisions

- M59 (previous document, commit bfb0dc71): the chart component and its simple form, which the analyzer extends.
- M58 (previous document, commit bfb0dc71): the Browse PVs page and its control that opens the analyzer.
- D1: console pages.
- D2: the analyzer as a self-contained analysis tool built with the bundled D3.
- The decisions of M59 (previous document, commit bfb0dc71) on the bundled D3, on the analyzer as a general signal analysis tool and on no external library bind this work as well.
- Decision Date 2026-10-15: the analyzer is an independent service, an application of its own that may be split out of the appliance in the long term, and it carries the same header as the console (logo, menu, time zone choice); the menu items are links that navigate to the console pages at the address of the console, and the analyzer is not shown in a frame of a console page (the owner chose this over the frame of 2026-10-14, which it replaces).
- Decision Date 2026-10-14, replaced on 2026-10-15 by the decision above: the analyzer is shown inside a console page in a frame (the console's content security policy gains `frame-src`; the retrieval web application sets no frame-blocking header), so that the site header, logo and menu are not copied into the retrieval web application; the viewer keeps working on its own address for its own window. The frame is sized by CSS to the window below the header, without `postMessage`. The two origins share only the address.
- Decision Date 2026-10-14: the options pass as one named parameter per option in the query string of the analyzer's address (`?`, where the viewer reads `pv`, `from` and `to` today), so that an address can be read and edited by hand; M1 lists the names.
- Decision Date 2026-10-14: Open in the analyzer passes the PVs, the time window and the options the user chose; an option left at its default is not passed and the analyzer applies its own default.
- Decision Date 2026-10-14: Open in the analyzer carries the options chosen on the page as well as the PVs and the time window, so that the analyzer shows the picture the user was looking at; M1 gives the analyzer the parameters to read them.
- Decision Date 2026-10-15: the data viewer passes `strip: false` to the chart component, which draws a range strip above every chart otherwise; this item decides where the strip of the analyzer goes (one for the stack of charts, or one for each).
- Decision Date 2026-10-15: the Distribution, scatter plot and summary panels leave the Browse PVs page in this item, when the analyzer carries them (they stay on the page in M58 (previous document, commit bfb0dc71)).
- Decision Date 2026-10-15: the control of the Browse PVs page, which M58 (previous document, commit bfb0dc71) builds with the PVs and the time window, gets the options added by this item, so the parameters are named where they are read.
- Decision Date 2026-10-14: the analyzer reads, from its address, the PVs, the time window and the options of the simple form (line, Y scale, sample marks, running average, standard deviation band and its window, the Y projection, and the range of each axis), so that the control into the analyzer of the other pages opens the same picture; an option the user did not set is not in the address and the analyzer applies its own default; each option is one named parameter in the query string, a name it does not know or a value it cannot read is ignored so that an address with `pv`, `from` and `to` alone opens as before, and the range of an axis is given by the unit of the axis (`none` for a PV with no unit); the names and form of the parameters are settled in this milestone.
- D5 (Decision Date 2026-10-19): the analyzer is built in five phases; this row is phase A, planned from `docs/design-analyzer.md`, whose decisions D1 to D6 of 2026-10-19 bind it (the independent service with the console's menu, `getApplianceInfo` on the retrieval, the defaults of the options, the Browse PVs panels staying, the time axis as drawn, the menu that navigates to the other side).
- M67 (previous document, commit bfb0dc71) step 5 (the header of the analyzer with the time zone box and the hand-over of `tz`) is done here.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. The mockup of the page composition (tabs, drawer, strip and options placement) for the owner's review; the decision is recorded in the design document and here. Check: the owner's approval.
2. The retrieval `BPLServlet` registers `GetApplianceInfo`; the analyzer page gains the header markup with its marker blocks, the menu linking to `mgmtURL`, the time zone box (`mountTimeZoneSelect`) and the renamed input; `analyzer-forward.js` unchanged; the static check covers the page. Check: T1, T4.
3. The composition built: the tabs by kind of analysis with the Trend tab drawn through `createChart`, the drawer with Signals, Axes, Options, Data (the statistics table) and Export (Copy link, the CSV as it is). Check: T1.
4. The address: read and written with `view`, `tz` and the options of the component; the Browse PVs control adds its options. Check: T2.
5. The book and `MgmtPageLinksTest`. Check: T3, T4.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Browser | Open the analyzer from the menu and from the Browse PVs page; read the header, use each menu item and the time zone box; open the address of the viewer on its own; read the tabs and the drawer; look at the page at 720 and 320 px | The one appliance and the one IOC of D3 | The header of the console with its menu and zone box; each menu item opens its console page; the composition of the mockup; no sideways scroll |
| T2 | Browser | Set options on the Browse PVs page and press Open in the analyzer; edit the address by hand; add an unknown name and a value that cannot be read; open an address with `pv`, `from` and `to` alone | The one appliance of D3 | The analyzer shows the options of the address; the unknown name and the unreadable value are ignored; the old address opens as before; the address follows a change on the page |
| T3 | Book | `mdbook build docs/book`; the pages read against the shipped page | Local | Every control the pages name is on the page |
| T4 | Static and suite | `bash scripts/ui-static-checks.bash` with the analyzer page in its header check; `MgmtPageLinksTest` on the WARs packaged the same UTC day; `./mvnw -B -ntp clean verify`; Maven and Pages workflows | JDK 21, Tomcat 9.0.121; GitHub Actions | Pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | The one appliance and the one IOC of D3 | Pending | none |
| T2 | Not run | The one appliance of D3 | Pending | none |
| T3 | Not run | Local | Pending | none |
| T4 | Not run | JDK 21; GitHub Actions | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Analyzer for archived data
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #39 OPEN, label enhancement, milestone none, remote updatedAt 2026-10-26T17:58:00Z, no difference of metadata from the Observed fields; earlier record: 2026-10-26 11:02 PDT; `gh issue edit 39` replaced the body (the Current State names the release 2026-10 and not a deleted branch), read back OPEN

#### M2 - Analyzer phase B: interaction, options and export

Origin: bfb0dc71 / M11
Identity History: M11 to M2 on 2026-10-26
GitHub Issue: #39 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/39)
Status: Not started

##### Summary

Phase B of `docs/design-analyzer.md` (D5): the gestures and options the reference tools offer beyond the simple form, and the Data and Export tabs in full, on the page of phase A.

##### Scope

- Gestures (design, Drawing options and gestures; Reference tools): the drag tool chosen on the range strip (select, pan, box zoom), the wheel and the trackpad pinch zooming the time axis around the pointer within limits, Shift and a drag panning, undo and redo of the range, a double-click back, one finger selecting and two fingers panning and zooming on a touch screen, a click on a legend item hiding its line, a click on a series bringing it to the front, a click on a sample pinning its values, two reference cursors with the difference of time and value, the nearest sample found with `d3-delaunay` or `d3-quadtree`, one batch of data requests after a gesture.
- Options (design, Reference tools, Options the tools offer): line width and style, a gap threshold that disconnects the line, a fill between two signals, soft and fixed axis ranges typed per unit, grid lines, centered zero, SI prefixes, an axis label, the averaging interval in seconds or raw samples forced, the min-max band from the retrieval `min` and `max` operators with the mean, a split by unit (one plot per unit sharing the time axis), the legend in table mode with computed values, the tooltip in single or all mode with a sort order, decimals and a display name per signal, transitions on range changes.
- The Data tab: the table of the samples in view with their time, value, severity and status, and the statistics table of the component.
- The Export tab (design, Export): the range (shown or typed), the source (the samples shown, the raw samples, N bins with minimum, mean and maximum, a linear interpolation), the format (wide or long CSV, severity and status, digits, ISO 8601 in the zone or UNIX milliseconds, the unit in the header), the products (data CSV, statistics CSV, plot as PNG or SVG, the address copied), and the retrieval's own `getData.csv` and `getData.mat` addresses for large ranges.
- The address names of every new option, read and written as in phase A; the book.

Out of scope: the analysis tabs (M3, M4, M5); the Browse PVs page.

##### Completion Criteria

- Each gesture and option of the Scope is observed on archived fixture data with mouse, keyboard and touch, and a range change reads the data once after the gesture ends.
- The Data tab lists the samples in view and the Export tab produces each product of the Scope; a CSV of N bins carries minimum, mean and maximum per bin; the exported values equal the retrieval's for the same range and operator.
- Every option is in the address, and an address with the options of phase A alone opens as before.
- The default suite passes and the book describes the controls.

##### Dependencies And Decisions

- M1: the page, the drawer and the address of phase A.
- D2: the analyzer as a self-contained analysis tool built with the bundled D3.
- D5 (Decision Date 2026-10-19): phase B of the analyzer, planned from `docs/design-analyzer.md`.
- Open in the design document: the assignment of the drag (the reference tools choose the drag tool on a toolbar with the wheel and hover always on), the labels at the line ends (the legend names the lines), and whether the running average and the band share one window (`window`); each is settled before this plan is accepted.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. The three open decisions above, with the owner. Check: the decisions recorded in the design document.
2. The gestures in the chart component (`staticcontent/js/aa/chart/gestures.js` and a zoom module on `d3-zoom`), with the strip's drag tool control, undo and redo, cursors and pins; the simple form of the console pages unchanged. Check: T1.
3. The options in `options.js` and `draw.js`, the split by unit, the min-max band through the retrieval operators, the interval choice. Check: T1.
4. The Data tab and the Export tab (`viewer.js`), the CSV through `d3-dsv`, the PNG and SVG export, the retrieval addresses. Check: T2.
5. The address names and the book. Check: T3, T4.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Browser | Exercise each gesture and option of the Scope with mouse, keyboard and touch on archived fixture PVs, and count the data requests of the browser after a drag that chooses a range | The one appliance and the one IOC of D3 | Each behavior is observed; a chosen range issues one batch of requests after the gesture |
| T2 | Browser and retrieval | Export each product of the Export tab for a known range and compare the CSV with the retrieval's `getData.csv` of the same range and operator; open the retrieval addresses the tab hands out | The one appliance of D3 | The values equal; the N-bin CSV carries minimum, mean and maximum; the addresses answer |
| T3 | Book | `mdbook build docs/book`; the pages read against the shipped page | Local | Every control the pages name is on the page |
| T4 | Static and suite | `bash scripts/ui-static-checks.bash`; `MgmtPageLinksTest`; `./mvnw -B -ntp clean verify`; Maven and Pages workflows | JDK 21, Tomcat 9.0.121; GitHub Actions | Pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | The one appliance and the one IOC of D3 | Pending | none |
| T2 | Not run | The one appliance of D3 | Pending | none |
| T3 | Not run | Local | Pending | none |
| T4 | Not run | JDK 21; GitHub Actions | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Analyzer for archived data
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #39 OPEN, label enhancement, milestone none, remote updatedAt 2026-10-26T17:58:00Z, no difference of metadata from the Observed fields; earlier record: 2026-10-26 11:02 PDT; `gh issue edit 39` replaced the body (the Current State names the release 2026-10 and not a deleted branch), read back OPEN; a box per phase is added to its body when the phase plans are accepted (D5).

#### M3 - Analyzer phase C: tools for one signal

Origin: bfb0dc71 / M6
Identity History: M6 to M3 on 2026-10-26
GitHub Issue: #39 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/39)
Status: Not started

##### Summary

The Browse PVs page shows a distribution, a scatter plot of two PVs and a statistics table for the PVs of one chart (`plots.js`), and the viewer none. The scatter plot pairs only samples at exactly equal times, so raw samples of two records rarely pair, and it offers only a PV of the same unit at a fixed 150 px height. The bundled D3 has no correlation, regression, fit, FFT or principal component analysis. The analysis of one numeric signal and the comparison of two ranges are built in this phase on the page of phases A and B (M1, M2), from what the D3 bundle provides and from routines the page writes; two and several signals are phase D (M4).

##### Scope

Phase C of `docs/design-analyzer.md` (D5): the tools of one numeric signal and the comparison of two ranges, in the Distribution, Compare and Spectrum tabs of the page of phases A and B (design, Tools by kind of signal; Analysis functions).

- Distribution tab: the summary (samples, minimum, maximum, mean, median, standard deviation, skewness, kurtosis, the errors of the mean and of the standard deviation, quantiles, lost events); the histogram with the `bin` threshold rules, the box plot, a kernel density estimate; the statistics box and, when a fit of phase D exists, the fit box; the pattern by hour and weekday (`rollup`) and a time-value heatmap for a long span; the values beyond k standard deviations.
- Trend tab additions: the variation (running average, standard deviation band, rate of change), a slow trend (a linear fit against time), the limits of the PV (display, warning and alarm) as reference lines with the time outside them, a threshold line typed by the user with the time beyond it.
- Compare tab: two time ranges of one signal, or two signals, side by side with their ranges linked, the distributions drawn over one another and normalised, the difference of the means and of the spreads, and the tests (chi-square, Kolmogorov-Smirnov, Anderson-Darling).
- Spectrum tab: the FFT after resampling to an even interval (radix 2 with zero padding, or Bluestein), the window functions, the power spectral density, the peak frequency with its width, the spectrogram over time, the autocorrelation; the sampling frequency typed or read from a companion PV for a waveform.
- The routines the page writes for these: moments, moving statistics, the tests, the FFT, the kernel density estimate; each checked on signals of known parameters made with the `random*` generators.
- The address names of the tabs' options; the fixture records the checks need (a signal with a known distribution and a known period); the book.

Out of scope: two and several signals, fits, derived signals (M4); waveforms and images (M5); state and string signals (after the numeric tools).

##### Completion Criteria

- Each tool of the Scope is available in its tab and is observed on archived fixture data.
- The moments, the tests, the spectrum peak and the autocorrelation return the known parameters of a signal made for the check within the stated tolerance; a time series is resampled to an even interval before an FFT.
- The Compare tab shows two ranges with their ranges linked and reports the tests with their statistics.
- The default suite passes and the book describes the tools.

##### Dependencies And Decisions

- M2: the page with its gestures, options, Data and Export tabs, which the tools extend.
- D2: the analyzer as a self-contained analysis tool built with the bundled D3.
- The decisions of M59 (previous document, commit bfb0dc71) on the bundled D3 (its functions are used wherever it has one), on the analyzer as a general signal analysis tool, and on no external library bind this work; the page writes only what the bundle lacks.
- D5 (Decision Date 2026-10-19): phase C of the analyzer, planned from `docs/design-analyzer.md`; the tools of two and several signals, the fits and the derived signals are phase D (M4).
- Decision Date 2026-10-14: the tools are added by the kind of signal; the page decides the kind from the type information and the user chooses the purpose within it.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. The routines the page writes (new modules under `staticcontent/js/aa/`): moments and their errors, moving statistics, the kernel density estimate, the tests, the resampling and the FFT with its windows, the autocorrelation; each with a unit check on generated signals. Check: T2.
2. The Distribution tab and the Trend additions through the component and the D3 functions of the decision of M59 (previous document, commit bfb0dc71). Check: T1.
3. The Compare tab as a split view with linked ranges. Check: T1.
4. The Spectrum tab. Check: T1, T2.
5. The fixture records, the address names and the book. Check: T3, T4.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Browser | In the analyzer, use each tool of the three tabs and the Trend additions on archived fixture PVs with real mouse and keys; compare the numbers with the same data computed outside the page | The one appliance and the one IOC of D3 | Each tool is observed and agrees with the numbers computed outside the page |
| T2 | Unit | Feed the routines generated signals of known parameters (a normal sample, a sine of known period, two samples that differ by a known shift) and read the moments, the test statistics, the spectrum peak and the autocorrelation | Local, the page's modules under a JavaScript test runner | Each value is returned within the stated tolerance |
| T3 | Book | `mdbook build docs/book`; the pages read against the shipped page | Local | Every control the pages name is on the page |
| T4 | Static and suite | `bash scripts/ui-static-checks.bash`; `MgmtPageLinksTest`; `./mvnw -B -ntp clean verify`; Maven and Pages workflows | JDK 21, Tomcat 9.0.121; GitHub Actions | Pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | The one appliance and the one IOC of D3 | Pending | none |
| T2 | Not run | Local | Pending | none |
| T3 | Not run | Local | Pending | none |
| T4 | Not run | JDK 21; GitHub Actions | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Analyzer for archived data
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #39 OPEN, label enhancement, milestone none, remote updatedAt 2026-10-26T17:58:00Z, no difference of metadata from the Observed fields; earlier record: 2026-10-26 11:02 PDT; `gh issue edit 39` replaced the body (the Current State names the release 2026-10 and not a deleted branch), read back OPEN

#### M4 - Analyzer phase D: tools for two and several signals

Origin: bfb0dc71 / M12
Identity History: M12 to M4 on 2026-10-26
GitHub Issue: #39 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/39)
Status: Not started

##### Summary

Phase D of `docs/design-analyzer.md` (D5): the tools of two and of several numeric signals, the fits and the derived signals, in the Correlation and Dependency tabs of the page of phases A to C (design, Tools by kind of signal; Analysis functions).

##### Scope

- Correlation tab: a scatter plot of two signals with each axis in its own unit, the samples paired by the value each holds at the other's sample times (`bisector`), with the number of pairs and of samples of the slower signal; the correlation (Pearson, Spearman through `rank`, a cross-correlation over a lag); a profile (the mean of Y with its error in each bin of X); the fit panel after the reference tools: a model chosen (line, polynomial, exponential, power, logarithm, sine, Gaussian, Landau) or typed, initial values, fixed and bounded parameters, a range by sliders, the parameters with their errors, the chi-square per degree of freedom, R², a confidence band, the residuals, earlier fits kept in a list; X and Y projections beside the axes; point size and transparency, points coloured by time, a density contour (`contourDensity`) for dense data, a rectangle brush; the two trends under one another sharing the time axis; derived signals (difference, sum, ratio, one divided by the other).
- Dependency tab, for three to twenty signals averaged over one common interval: the mutual information of each pair and a ranking by how much each explains the chosen one; a correlation matrix as a heatmap ordered by hierarchical clustering with its dendrogram; a scatter plot matrix; the partial correlation; a multiple linear regression with each coefficient, its standardised size, R² and the residuals; a principal component analysis with the variance of each component; a graph of dependence (`forceSimulation`).
- General functions: a derived signal from a typed expression parsed by the page, a change of unit, the export of a fit, a statistics table and a derived signal through the Export tab.
- The routines the page writes: least squares and an iterative least squares (Levenberg-Marquardt) with fixed and bounded parameters, the covariance of the parameters, correlation and partial correlation, mutual information, a small matrix module (multiply, invert, solve, Cholesky, Jacobi eigen decomposition), hierarchical clustering, the expression parser; each checked on signals of known parameters.
- The address names of the tabs' options and the book.

Out of scope: one signal and the comparison (M3); waveforms and images (M5); a vendored library for LOESS or a non-linear fit, and a typed formula as a fit model beyond the expression parser (open items of M3's decisions, settled before this plan is accepted).

##### Completion Criteria

- Each tool of the Scope is available in its tab and is observed on archived fixture data; a pair of different rates shows the number of pairs and of samples of the slower signal.
- A fit of each model, a correlation, a regression and a principal component analysis return the known parameters of signals made for the check within the stated tolerance; the fit panel fixes and bounds a parameter.
- The Dependency tab takes up to twenty signals; the matrix is symmetric with ones on its diagonal and its order follows the clustering.
- The default suite passes and the book describes the tools.

##### Dependencies And Decisions

- M3: the tools of one signal and the routines it writes (moments, tests, FFT), which the fits and the dependency tools use.
- D2: the analyzer as a self-contained analysis tool built with the bundled D3; no regression package is added (`d3-regression` is outside the official D3 repositories).
- D5 (Decision Date 2026-10-19): phase D of the analyzer, planned from `docs/design-analyzer.md`.
- Decision Date 2026-10-12: the correlation and the linear regression are computed by the page; the bundled D3 has neither.
- Decision Date 2026-10-14: the fit models are those listed; the Correlation tab opens with the first two plotted PVs as X and Y; the dependency analysis takes up to 20 PVs.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. The open items (a vendored fit library, a typed fit model) with the owner. Check: the decisions recorded.
2. The matrix module, the fits, the correlations, the mutual information and the clustering as modules under `staticcontent/js/aa/`, each with a unit check on generated signals. Check: T2.
3. The Correlation tab with the fit panel and the derived signals. Check: T1.
4. The Dependency tab. Check: T1, T3.
5. The address names and the book. Check: T4, T5.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Browser | In the analyzer, use each tool of the Correlation tab on two archived fixture PVs with real mouse and keys, fit each model with and without a fixed parameter, and compare the numbers with the same data computed outside the page | The one appliance and the one IOC of D3 | Each tool is observed and agrees with the numbers computed outside the page |
| T2 | Unit | Feed the routines generated signals (a line with noise, an exponential decay, a sine, a Gaussian, two signals of known correlation, a matrix of known eigenvalues) and read the parameters, their errors and the decompositions | Local, the page's modules under a JavaScript test runner | Each value is returned within the stated tolerance |
| T3 | Browser | Choose five to twenty PVs for the Dependency tab and read the matrix, the ranking, the regression and the components; a pair of different rates shows the number of samples of the slower PV | The one appliance and the one IOC of D3 | The matrix is symmetric with ones on the diagonal and ordered by the clustering; the numbers agree with the same data computed outside the page |
| T4 | Book | `mdbook build docs/book`; the pages read against the shipped page | Local | Every control the pages name is on the page |
| T5 | Static and suite | `bash scripts/ui-static-checks.bash`; `MgmtPageLinksTest`; `./mvnw -B -ntp clean verify`; Maven and Pages workflows | JDK 21, Tomcat 9.0.121; GitHub Actions | Pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | The one appliance and the one IOC of D3 | Pending | none |
| T2 | Not run | Local | Pending | none |
| T3 | Not run | The one appliance and the one IOC of D3 | Pending | none |
| T4 | Not run | Local | Pending | none |
| T5 | Not run | JDK 21; GitHub Actions | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Analyzer for archived data
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #39 OPEN, label enhancement, milestone none, remote updatedAt 2026-10-26T17:58:00Z, no difference of metadata from the Observed fields; earlier record: 2026-10-26 11:02 PDT; `gh issue edit 39` replaced the body (the Current State names the release 2026-10 and not a deleted branch), read back OPEN; a box per phase is added to its body when the phase plans are accepted (D5).

#### M5 - Analyzer phase E: waveform and image analysis

Origin: bfb0dc71 / M7
Identity History: M7 to M5 on 2026-10-26
GitHub Issue: #39 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/39)
Status: Not started

##### Summary

The appliance stores an array PV as a waveform (`DBR_WAVEFORM_*`, or `DBR_V4_GENERIC_BYTES` for a PVA structure); it holds no image size, and the data viewer draws a waveform as a time series of its elements. The camera IOC of the site serves row and column profiles of 1920 and 1200 elements, time-series arrays of 2048 points, a histogram of 256 bins and the statistics of up to four regions of interest, and a frame of 1920 by 1200 sixteen-bit pixels at up to 50 Hz. The analysis of arrays and images is built in this phase on the page of phases A and B (M1, M2) and on the tools of phases C and D (M3, M4).

##### Scope

The analysis of waveforms and images in the analyzer.

- One waveform (an array PV): the array at a time, X as the element number or from a companion axis PV; several times overlaid, and the time against the element number as a heatmap; summary values of each array (maximum and its position, minimum, mean, RMS, sum, centre, FWHM) and their time series; the difference from a reference time; the spectrum by FFT with the sampling frequency given by the user or a companion PV, a window function and the peak frequency; a peak search with the position, height and width of each peak, and a background estimated and subtracted.
- An image (a waveform whose element count is width times height, the size given by the user or companion PVs): one frame as a heatmap on a canvas with a colour scale and iso-lines; a rectangle of interest chosen with the mouse; the X and Y projections; the centroid, the peak position, the total intensity and the size by a Gaussian fit in each direction; those values as time series; a background subtraction and the difference of two frames.
- Settled on 2026-10-14 on the recommendation the owner accepted:
  - A waveform: the X axis is the element number, or the array of a companion axis PV when the user names one; the length and the rate are read from `getPVTypeInfo` (the element count and the event rate). The camera IOC of the site, read for this plan, serves row and column profiles of 1920 and 1200 elements, time-series arrays of 2048 points, a histogram of 256 bins and the statistics of up to four regions of interest, so the analysis is built for arrays of that size first.
  - An image: the width and the height come from the companion PVs of the same array plugin (`ArraySize0_RBV` and `ArraySize1_RBV`, with `NDimensions_RBV`, `DataType_RBV` and `ColorMode_RBV`), and the user types them when those are not archived. The camera IOC of the site serves a frame of 1920 by 1200 sixteen-bit pixels (2304000 elements) at up to 50 Hz, so the archived data is expected to be the regional statistics and profiles, and a whole frame is read one at a time.

Out of scope: the page, drawing options and address of the analyzer (M1); the tools for numeric signals (M3); what the site archives of a camera, which the settings of the archiver decide.

##### Completion Criteria

- A waveform is drawn at a time, overlaid and as a heatmap over time; its summary values, their time series, its difference from a reference time and its spectrum are shown.
- An image of a known size is drawn as a heatmap with a colour scale, its region of interest chosen with the mouse, its projections and its centroid, peak, total and Gaussian size computed, and a frame is read one at a time.
- The values agree with the same arrays computed outside the page.
- The default suite passes and the book describes the tools.

##### Dependencies And Decisions

- M4 and M3: the numeric tools (fits, FFT, statistics) that arrays and images use.
- M1 and M2: the analyzer page, its gestures, options and address.
- D5 (Decision Date 2026-10-19): phase E of the analyzer, planned from `docs/design-analyzer.md` (Waveforms and images).
- D2: the analyzer as a self-contained analysis tool built with the bundled D3.
- The decisions of M59 (previous document, commit bfb0dc71) on the bundled D3, on the analyzer as a general signal analysis tool and on no external library bind this work; a frame is drawn on a canvas with the D3 colour scales and `contours`, the axes and text staying SVG.
- The retrieval response for an array PV and the size limit of one response are read on the fixture before the page is built.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Settled with the owner on 2026-10-14: the X axis, the source of the image size and the sizes the analysis is built for (the Scope). Still for the owner: whether the site archives the frames, the profiles or only the regional statistics, which fixes how much of the image tools is used.
2. Read the retrieval response of a waveform and of an image on the fixture extended by a waveform record and an image record of known size and content, and the size of one response. Check: T1.
3. The array tools: the array at a time, overlay, heatmap over time, summary values and their series, the difference from a reference, the spectrum, the peak search with a background. Check: T2.
4. The image tools on a canvas: the frame as a heatmap, iso-lines, the region of interest, the projections, the centroid, peak, total and Gaussian size, the background subtraction and the difference of two frames. Check: T3.
5. The book and the static checks. Check: T4 and T5.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Archive a waveform record and an image record of known size and content on a local appliance and read each through the retrieval call the page uses | Local appliance, soft IOC fixture extended by a waveform and an image record | The response is read, its size is known, and the elements equal those the record holds |
| T2 | Browser | Use each array tool on the waveform of known content with real mouse and keys, and compare the summary values and the spectrum with the same array computed outside the page | Local appliance, soft IOC fixture with the waveform record | Each value agrees within the stated tolerance; the peak of a known sine is at its frequency |
| T3 | Browser | Use each image tool on the image of known content: the region, the projections, the centroid, the peak, the total and the Gaussian size | Local appliance, soft IOC fixture with the image record | Each value agrees with the same image computed outside the page |
| T4 | Static | `bash scripts/ui-static-checks.bash` and `MgmtPageLinksTest` on the WARs packaged the same UTC day | Local, JDK 21, Tomcat 9.0.121 | The ids and links of the pages pass |
| T5 | Suite | ./mvnw -B -ntp clean verify; Maven and Pages workflows | JDK 21; GitHub Actions | Pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | Local appliance, soft IOC fixture extended by a waveform and an image record | Pending | none |
| T2 | Not run | Local appliance, soft IOC fixture with the waveform record | Pending | none |
| T3 | Not run | Local appliance, soft IOC fixture with the image record | Pending | none |
| T4 | Not run | Local, JDK 21, Tomcat 9.0.121 | Pending | none |
| T5 | Not run | JDK 21; GitHub Actions | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Analyzer for archived data
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #39 OPEN, label enhancement, milestone none, remote updatedAt 2026-10-26T17:58:00Z, no difference of metadata from the Observed fields; earlier record: 2026-10-26 11:02 PDT; `gh issue edit 39` replaced the body (the Current State names the release 2026-10 and not a deleted branch), read back OPEN

#### M6 - Appliance status as PVA PVs

Origin: bfb0dc71 / M4
Identity History: M4 to M6 on 2026-10-26
GitHub Issue: #66 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/66)
Status: Not started

##### Summary

The System pages show the appliance's own measures (event rate, dropped samples, write load, stored data and free space, process heap, host load). They are not archived PVs: the appliance keeps a few hours of the process measures in memory and serves them through mgmt calls, and the Operations tab draws them itself, so the viewer, which reads archived PVs from retrieval, cannot show them. The appliance already runs PVA servers: retrieval and mgmt create PVs on the `PVAServer` of `core-pva` (`retrieval/pva/PvaDataRetrievalServlet.java`, `mgmt/pva/`).

##### Scope

Publish the status measures as PVA PVs on the appliance's own PVA server, updated periodically, and archive them through `pva://` on the same appliance, so the analyzer plots them over any span.

- A stacked area view (`d3-shape` `stack`) of the event rate and of the stored data by store over a chosen span, drawn from the archived status PVs; it moved here from M56 (previous document, commit bfb0dc71), whose treemap shows the current values only.

Out of scope: a separate soft IOC fed from the mgmt calls; Channel Access names for the measures; monitoring whether the appliance runs, which stays outside it because a self-archived measure records nothing while the appliance is down.

##### Completion Criteria

- Each status measure the System pages show is a PVA PV with a defined name, type and update period, readable with a PVA client.
- The appliance archives them and the analyzer plots them from retrieval.
- The event rate and the stored data by store show as stacked areas over a chosen span, drawn from the archived PVs.
- An integration test reads the PVs and their archived data on a running appliance; the default suite passes.

##### Dependencies And Decisions

- Origin: recorded on 2026-10-12 at the owner's direction, who chose publication by the appliance's own PVA server over a separate soft IOC.
- Decision Date 2026-10-13: the stacked areas of the event rate and the stored data over time are part of this item, because the history they need is what this item archives.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Settle with the owner the measures, their PV names and the update period.
2. Publish, archive and test them, and document the names. Closes with T1 and T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | On a running appliance, read each status PV with a PVA client and its archived data through retrieval | JDK 21, Tomcat 9 | Values match the System pages; archived data covers the run |
| T2 | Suite | ./mvnw -B -ntp clean verify | JDK 21, wrapper Maven | Pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, Tomcat 9 | Pending | none |
| T2 | Not run | JDK 21, wrapper Maven | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Appliance status measures are not archived PVs
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #66 OPEN, label enhancement, milestone none, remote updatedAt 2026-10-26T18:56:40Z, no difference of metadata from the Observed fields; earlier record: 2026-10-26 11:57 PDT; filed from the draft body with `gh issue create`, read back OPEN with label enhancement and assignee jeonghanlee

#### M8 - Bound the concurrent calls of the PVAccess retrieval service

Origin: bfb0dc71 / M14
Identity History: M14 to M8 on 2026-10-26
GitHub Issue: #62 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/62)
Status: Not started

##### Summary

The PVAccess server of `core-pva` 5.0.5 runs an RPC call on the receive thread of the TCP connection that carried it (executed on 2026-10-21 in the audit of M85 (previous document, commit bfb0dc71): a call of 2 s took 2,008 ms alone, two calls on one connection took 4,003 ms, two calls on two connections took 2,002 ms). It sets no limit on the connections and none on the calls at a time, and a long call holds the other calls of its connection. The Tomcat valves of M85 (previous document, commit bfb0dc71) do not reach it, because the PVAccess server is not behind the Tomcat pipeline. M85 (previous document, commit bfb0dc71) bounds a request by the memory it declares and the memory pressure, but the number of PVAccess retrievals in flight, each holding its answer whole (M86 (previous document, commit bfb0dc71)), is not bounded.

##### Scope

- The retrieval PVAccess service (`PvaDataRetrievalService`) takes a permit for each call and refuses the call when none is free, with a message in the log of the retrieval application; as for any refused PVAccess call, the caller sees its own timeout (decision (4) of M85 (previous document, commit bfb0dc71)).
- The number of permits is a measured value; the valve concurrency that M85 (previous document, commit bfb0dc71) chooses is its starting point.

Out of scope: the duration of a call, which no layer bounds in PVAccess; the management PVAccess service (`PvaMgmtService`); the HTTP valves (M85 (previous document, commit bfb0dc71)).

##### Completion Criteria

- With more long calls than permits, on separate connections, the permits are used and the next call is refused with a message in the log of the retrieval application.
- When a call ends, the next call is accepted.
- The default suite and the PVAccess integration classes pass.

##### Dependencies And Decisions

- D7 (Decision Date 2026-10-21): entered from the audit of M85 (previous document, commit bfb0dc71); it does not block M85 (previous document, commit bfb0dc71) or the merge.
- Open at the plan: the number of permits; whether the duration of a call is bounded and how; whether the management service takes the same limiter.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. A limiter class with a fixed number of permits that never waits. Check: T1.
2. The retrieval service takes a permit around each call and releases it in a `finally`. Check: T1 and T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit | The limiter with more concurrent takers than permits, and a release | JDK 21 | Only the permits are granted, the others are refused at once, and a released permit is granted again |
| T2 | Integration | A PVAccess retrieval service with a call that takes long, called from more connections than permits, with the logger of the library on | JDK 21, Tomcat 9.0.121, `softIocPVX` | The calls up to the permits are answered, the next is refused with a message in the log, a call after one has ended is answered; fails on the old code |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | pending | | | |
| T2 | pending | | | |

##### Closure Evidence

- none

##### GitHub Projection

Title: Bound the concurrent calls of the PVAccess retrieval service
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #62 OPEN, label enhancement, milestone none, remote updatedAt 2026-10-26T17:58:21Z, no difference of metadata from the Observed fields; earlier record: 2026-10-26 11:02 PDT; filed from the draft body with `gh issue create`, read back OPEN with label enhancement and assignee jeonghanlee

#### M9 - Measure the thread and valve limits and the remaining qualification cells of the retrieval protection

Origin: bfb0dc71 / M16
Identity History: M16 to M9 on 2026-10-26
GitHub Issue: #58 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/58)
Status: Not started

##### Summary

The retrieval memory protection of M85 (previous document, commit bfb0dc71) passed its functional checks on HTTP and PVAccess at 512 MiB, 2 GiB and 4 GiB under G1 with no OutOfMemoryError or JVM exit. Two groups of measurements remain. First, the thread and valve limits: the retrieval `SemaphoreValve` concurrency 100 and the connector `maxThreads` (Tomcat's default 200 in the deployment template, 40 in the development launcher) are not derived from a measurement; every busy-thread maximum recorded so far (4 in the whole integration set, 13 for fifteen console pages with their static files, 8 and 12 for eight and twelve overlapping heavy retrievals, 9 for the snapshot worker cases, 3 for the admission tests) equals the number of requests the test sent, no run combined console and heavy retrievals, and no run drove the concurrency to saturation or to a valve refusal at the default. Second, the qualification cells the plan of M85 (previous document, commit bfb0dc71) named and the runs did not cover: the Serial collector; Parallel and generational Z at 2 GiB and 4 GiB; pressure after the response is committed; overshoot above the pressure threshold and headroom to the heap maximum at the shipped defaults; memory admission of a held summary (`mean_1`) pair at 2 GiB and 4 GiB, which needs a hold at the transport stage because the file read hold keeps 129 bytes per record against about 900 when the answer is built.

##### Scope

- A long-running measurement that sends console and heavy retrieval requests together and raises the concurrency step by step, recording busy threads, response times, memory decisions and valve refusals at each step, on 512 MiB and 2 GiB heaps, under the deployment `maxThreads` and under 40.
- The valve default decided from that table by a stated rule and recorded in the register, the book (installing page) and `TESTING.md`, with a test that runs at the chosen default rather than at a lowered threshold.
- Each qualification cell above measured and recorded, or recorded as not measured with the reason; the summary-pair admission needs a transport-stage hold in the test, for example a forwarding proxy that stops delivering the server's answer.

Out of scope: bounding the number of concurrent PVAccess calls (M8); changing the memory thresholds without a measurement that motivates it; the cause of the 31 MB baseline difference between 2026-10-22 and 2026-10-24.

##### Completion Criteria

- The measurement table exists with its evidence folder named, for two heaps and two `maxThreads` values.
- The valve default and the connector recommendation are recorded with their rule in the three documents, and the test at the default passes.
- Every qualification cell is measured or recorded as not measured with the reason.

##### Dependencies And Decisions

- D8 (Decision Date 2026-10-24): the shipped defaults stay; the measurements move here from M85 (previous document, commit bfb0dc71).

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. A load driver in the test code that mixes console page requests and heavy retrievals and raises the concurrency in steps, sampling `currentThreadsBusy`, response times and the console lines of the memory protection and the valve. Check: T1.
2. The rule and the chosen default, applied to the WAR declaration and the three documents, with the valve test run at the default. Check: T2.
3. The qualification cells, one run each, recorded in the Verification Results. Check: T3.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration, measurement | The load driver at 512 MiB and 2 GiB, `maxThreads` 200 and 40, concurrency raised until the connector saturates or the valve refuses | JDK 21, Tomcat 9.0.121, built WARs | A table of busy threads, response times, memory decisions and refusals per step; no OutOfMemoryError |
| T2 | Integration | `ValveConcurrencyTest` and the console check at the chosen default | same | The valve refuses above the default and admits below it; the console pages answer 200 below it |
| T3 | Integration, measurement | The qualification cells: Serial; Parallel and ZGC at 2 GiB and 4 GiB; pressure after commit; overshoot and headroom at the defaults; summary-pair admission at 2 GiB and 4 GiB with a transport-stage hold | same, with the collectors and heaps named | Each cell recorded with its result, or recorded as not measured with the reason |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | pending | | | |
| T2 | pending | | | |
| T3 | pending | | | |

##### Closure Evidence

- none

##### GitHub Projection

Title: Measure thread and valve limits under load
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #58 OPEN, label enhancement, milestone none, remote updatedAt 2026-10-26T19:22:06Z, no difference of metadata from the Observed fields; earlier record: 2026-10-26 12:23 PDT; `gh issue edit 58` replaced the body (the Acceptance Criteria no longer name the register), read back OPEN

#### M10 - Decide the stamping and filtering rule of summary bins at the window edges

Origin: bfb0dc71 / M17
Identity History: M17 to M10 on 2026-10-26
GitHub Issue: #59 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/59)
Status: Open

##### Summary

`SummaryStatsCollectorEventStream` stamps the event of each bin at the bin midpoint and `MergeDedupConsumer.java:154` drops every event stamped after the requested end. When the bin is longer than the time between the request end and the last sample, the event of the last bin lies after the end and is dropped: a `mean_432000` request whose window ends inside the current five-day bin returns no event for that bin although its samples are inside the window (observed 2026-10-24 with `VariousPostProcessorTest`, 101 samples, HTTP 200 and an empty stream; the raw retrieval returned all 101). The test was corrected in 5efbd25b by ending its request at the next bin edge (M89 (previous document, commit bfb0dc71), issue #56); the product behaviour is unchanged and the rule has not been decided.

##### Scope

- Decide whether a bin whose samples lie inside the requested window is returned when its midpoint stamp lies outside the window, and with which timestamp (midpoint, bin start or window end); whether the inherited first bin follows the same rule; what the archive viewers and the Python clients expect.
- If the rule changes: the retrieval returns one event for such a bin regardless of the request time, the raw retrieval is unchanged, and `VariousPostProcessorTest` passes with its original one-day window again. If it stays: the retrieval page of the book states it.

Out of scope: the test window of `VariousPostProcessorTest` (M89 (previous document, commit bfb0dc71)); post-processors that are not summaries.

##### Completion Criteria

- The decision is recorded with the clients it was checked against.
- The product or the book reflects the decision as stated in Scope.

##### Dependencies And Decisions

- D8 (Decision Date 2026-10-24): entered from M89 (previous document, commit bfb0dc71); the row stays Open until the owner decides the rule.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Read how the archive viewers and the Python clients consume summary bins at the window edges and present the choices to the owner. Check: T1.
2. Apply the decided rule to the product or the book. Check: T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Review | The consumers of summary bins read against the three choices | repository and client sources | A decision record naming the clients checked |
| T2 | Integration or book | If the rule changes, `VariousPostProcessorTest` with its original one-day window on a date just after a bin edge; if it stays, the book build with the stated rule | JDK 21, Tomcat 9.0.121, `softIocPVX`; or the `aa-mdbook` image | One event per operator on any date; or the page states the rule |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | pending | | | |
| T2 | pending | | | |

##### Closure Evidence

- none

##### GitHub Projection

Title: Summary bin event stamped past the request end
Labels: bug
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #59 OPEN, label bug, milestone none, remote updatedAt 2026-10-26T17:58:11Z, no difference of metadata from the Observed fields; earlier record: 2026-10-26 11:02 PDT; `gh issue edit 59` replaced the body (the Acceptance Criteria are checkboxes, all open), read back OPEN

#### M11 - Check the retrieval operators outside the declared-size check

Origin: bfb0dc71 / M20
Identity History: M20 to M11 on 2026-10-26
GitHub Issue: #60 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/60)
Status: Not started

##### Summary

The audit of the retrieval protection (M85 (previous document, commit bfb0dc71) / T2, 2026-10-21) classified candidates as hypotheses with a next check; the fill operators of its `Event per bin` row were checked and corrected (a27f260a), and the others neither ran nor were carried to a later row until D10; the fifth candidate below, the PVAccess name list, comes from the sweep of 2026-10-24. The declared-size estimate of `RetrievalMemoryProtection.Request.admit` covers `Optimized`, `OptimizedWithLastSample`, the `SummaryStatsPostProcessor` subclasses, `CAPlotBinning`, `FirstFill`, `LastFill` and `LastSample`; the in-flight check runs where `checkCurrent` is called (`MergeDedupConsumer`, `PvaMergeDedupConsumer`, `SummaryStatsCollectorEventStream`, `FillsCollectorEventStream`, `CAPlotBinning`, `OptimizedWithLastSample`, `GetDataAtTime`, and `DataRetrievalServlet` once before and once after it handles a request, lines 276 to 310). Outside both, read in the code on 2026-10-24 and not run: `FirstSamplePP`, `DeadBand`, `Fliers` and `IgnoreFliers` copy the events of their source streams into an `ArrayListEventStream` inside their own `wrap` loops (`FirstSamplePP.java:64-77`, `DeadBand.java:72-130`, `Fliers.java:66-76`, `IgnoreFliers.java:75-85`); `Median`, `Kurtosis` and `Skewness` keep every value of a bin in a `DescriptiveStatistics` while a scalar summary bin is counted at `scalarBinBytes`, 112 bytes by default; `getDataForPVs` (`DataRetrievalServlet.java:756`), `getDataAtTime`, `getDataAtTimeForAppliance` and the PVAccess call (`PvaGetPVData.java:452`) take a list of names with no limit found, while the declared sizes of one request add up in its single budget and a raw read declares nothing. `Nth` and `NCount` are bounded by `MAX_COUNT` (`Nth.java:31`), recorded as CD-18.

##### Scope

- Run each candidate as a real request through a built appliance at a 512 MiB heap, started through `RetrievalMemoryNetworkFixture` (heap from `archappl.memory.test.heap`, default 512m; a generated 1 Hz store of `MemoryQualification:SineV1` over 30 days; the Memory admission tests paragraph of `TESTING.md` describes it): `median_3600` over 30 days next to `mean_3600`; `firstSample`, `deadBand`, `flyers` and `ignoreflyers` over the raw range of one PV (the operator names are case sensitive, and a name that matches no operator is refused as unknown, which is not a result for the candidate); `getDataForPVs` with many `pv` parameters; `getDataAtTime` with a list of 10,000 names; the PVAccess call with a long list. Record the status, the memory after collection and whether the JVM stayed alive.
- For a candidate that exhausts the heap or ends the JVM, extend the declared-size estimate or add the in-loop check at the place named above, with a test that fails without it; for one that is refused or completes safely, record it as examined.

Out of scope: the thread and valve limits and the other qualification cells (M9); bounding the concurrent PVAccess calls (M8); a change of the memory thresholds without a measurement that motivates it.

##### Completion Criteria

- Each of the five candidates has a recorded real-request result at 512 MiB: refused, meaning HTTP 400 or 503 with the name of the condition in the response; or completed, meaning HTTP 200 with the whole answer and the JVM still running; or exhausted, meaning an `OutOfMemoryError` in the console log or the JVM ended. A refusal for an operator name that matches no operator is not a result. For the PVAccess call there is no HTTP status: refused means the retrieval log names the condition and the client ends at its own timeout, and completed means the whole answer arrives.
- Every candidate that exhausted the heap has a correction with a test that fails without it and passes with it.
- The retrieval page of the book names the operators that declare no size, if any remain.

##### Dependencies And Decisions

- D10 (Decision Date 2026-10-24): long-term, not checked before the merge to master.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. A request harness that sends each candidate at a 512 MiB heap and records the status, the memory after collection and the JVM state. Check: T1.
2. For each candidate that exhausts the heap, the estimate or the in-loop check and its test. Check: T2.
3. The book page. Check: T3.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration, measurement | The five candidates as real requests at a 512 MiB heap through `RetrievalMemoryNetworkFixture`, in the forms named in Scope | JDK 21, Tomcat 9.0.121, built WARs, `softIocPVX` | A recorded result for each: refused with 400 or 503 and a named condition, or completed without exhausting the heap; no OutOfMemoryError that ends the JVM |
| T2 | Integration | For each candidate that exhausted the heap, the same request on the corrected code and on the code before it | same | Fails without the correction and is refused or completes with it |
| T3 | Book | The mdBook build and the link check with the retrieval page naming the operators that declare no size | `aa-mdbook` image | The book builds with no broken link |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | pending | | | |
| T2 | pending | | | |
| T3 | pending | | | |

##### Closure Evidence

- none

##### GitHub Projection

Title: Check retrieval operators outside the size check
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #60 OPEN, label enhancement, milestone none, remote updatedAt 2026-10-26T17:58:13Z, no difference of metadata from the Observed fields; earlier record: 2026-10-26 11:02 PDT; `gh issue edit 60` replaced the body (the Acceptance Criteria are checkboxes, all open), read back OPEN

#### M15 - Archiving continues across a change of the record

Origin: bfb0dc71 / M10
Identity History: M10 to M15 on 2026-10-26
GitHub Issue: #48 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/48)
Status: Deferred

##### Summary

M73 (previous document, commit bfb0dc71) observed, on 2026-10-17 and again on 2026-10-18 on the one IOC and the one appliance of D3, that the engine detects a change of the archived record but stops at counting: a record that posts faster than the rate estimated at the archive request loses most events to a sample buffer of 11 (T1); a changed unit, precision or limit reaches the archiver only through the property subscription or, for the unit and the precision, at a reconnect, and the display limits are never read again (T2); a record that comes back under the same name with another type has every event dropped and counted while the type information keeps the old type (T3, T5); the way out is manual, pause and `changeTypeForPV` and resume, converts the history (a double 0.0057 becomes the integer 0) and refuses a string or a waveform with HTTP 500 (T4). The role of the archiver is the opposite: to keep the signal without a gap (D4).

##### Scope

- The engine detects each change that M73 (previous document, commit bfb0dc71) names and goes on storing under the new condition from the instant of the change, on its own: a changed type opens a new type from that instant, a faster record gets a buffer and a sampling that follow it, changed metadata is read again.
- The earlier samples stay readable as they were stored: a PV has a type boundary on its time axis, and the stores and the retrieval know it, because a PB file holds one type.
- The console and the manual show the boundary and the change.

Out of scope until the plan is written: the exact store layout of the boundary; the policy for a change the engine cannot follow.

##### Completion Criteria

- The five checks of M73 (previous document, commit bfb0dc71), run again, store the signal through each change without a manual step, and a window of `getData` across the change returns the earlier samples with their stored type and the later samples with the new one.
- No event is dropped for a reason the engine could have followed; what is dropped is logged with its reason.

##### Dependencies And Decisions

- M73 (previous document, commit bfb0dc71) is the observation this row answers; D4 defers the row to the next major release (Decision Date: 2026-10-17) and limits this release to M77 (previous document, commit bfb0dc71).
- Transition: Deferred on 2026-10-17 by D4; it returns to Not started when the next major release opens.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Design of the type boundary in the stores and the retrieval, with the data-change rules of the PB files.
2. The engine reactions, one per change of M73 (previous document, commit bfb0dc71).
3. The console and the manual.

Buffer adaptation ideas for plan evaluation, recorded on 2026-10-29; these do not select a design or authorize implementation:

- The operator reports that changing a MONITOR period from 1.0 s to 0.1 s stopped the observed buffer loss. This is operator evidence, not an independently measured before-and-after result; the observation duration and counter continuity were not recorded. `ArchiveEngine.computeBufferCapacity` derives capacity from the configured period, while `SampleBuffer` holds a final capacity and drops the oldest event when full.
- Prefer evaluating automatic buffer capacity adjustment independently of the configured sampling method and period. MONITOR should continue receiving its subscribed events; SCAN timing and operator settings must not silently change to resolve a capacity shortage.
- Measure incoming valid events before overflow handling, buffer occupancy and actual buffer-swap/write delay over bounded windows. Include events involved in overflow in the incoming-rate measure; `ArchiveChannel` increments its existing event count only when `buffer.add` reports no overflow, so that counter alone understates input during loss. Separate a faster source or burst from a persistently slow or failing storage writer.
- Estimate capacity from observed input rate, the write interval and a bounded allowance for bursts and write delay. Evaluate growth before overflow, with a rapid response to bursts; choose thresholds, observation windows and growth limits from measurements. A periodic check alone cannot guarantee preservation of an abrupt burst before it reacts.
- Enforce both per-PV and appliance-wide memory budgets, accounting for waveform payloads, the current buffer, a pending write and temporary memory during resizing. Preserve queued events and their order while coordinating with callbacks and buffer swaps; evaluate a resize path that does not recreate the CA/PVA connection. Do not discard an unacknowledged write batch to make room.
- Add a minimum interval between adjustments and a separate sustained-low-load condition before any shrink. At the memory limit or during persistent storage failure, stop growth and report the cause, capacity, occupancy and loss counters; automatic growth cannot repair inadequate sustained write throughput or recover previously dropped samples.
- Show each automatic adjustment and its reason in Operations and PV Details. Define an enable/disable policy, manual override precedence and whether learned capacity survives restart; these remain planning decisions.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Engine and stores | The five checks of M73 (previous document, commit bfb0dc71) (`work/exp/m73/run_all.sh`) on the one IOC and the one appliance of D3, read for continuity instead of for loss | Packaged WARs, the IOC of D3 | Every change is followed; a window across the change holds both sides |
| T2 | Engine and storage integration | After plan acceptance, drive the shipped engine with independently counted sequenced input: steady rate increases, abrupt bursts, delayed or failed writes, recovery, many PVs and waveform payloads; compare stored sequence, timestamps and values, memory use, adjustment records and connection continuity | Isolated appliance, real CA/PVA source and actual storage writer; resource limits fixed by the accepted plan | Within the declared load and memory envelope, adaptation preserves queued samples without duplicates or changed sampling settings; outside that envelope, bounded memory and explicit loss or write-failure reporting; no claim of zero loss outside the measured scope |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | Packaged WARs, the IOC of D3 | Pending | none |
| T2 | Not run | Isolated appliance and real source | Pending | Buffer adaptation is a planning idea only; no implementation or runtime verification |

##### Closure Evidence

- none

##### GitHub Projection

Title: Archiving continues across a change of the record

Body: The engine detects a change of an archived record but stops at counting, so a change on the IOC side ends the recording of the signal until an operator acts. Observed on a local appliance with a soft IOC: a record that posts faster than the rate estimated at the archive request loses most events to a sample buffer of 11 (58 samples and 445 lost in 46 s at 10 Hz); a changed unit, precision or limit reaches the archiver only through the property subscription or at a reconnect, and the display limits are never read again; a record that comes back under the same name with another type has every event dropped and counted while the type information keeps the old type; the way out, pause, `changeTypeForPV`, resume, converts the history (a double 0.0057 becomes the integer 0) and answers HTTP 500 for a string or a waveform (`UnsupportedOperationException` in `ThruNumberAndStringConversion`). The archiver should keep the signal without a gap: detect the change and go on storing under the new condition from the instant of the change, with the earlier samples readable as they were stored, which needs a type boundary on the time axis of a PV that the stores and the retrieval know. Planned for the next major release; in the current release the engine logs the change and pauses a PV whose type changed.

Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: enhancement
Observed Assignee: jeonghanlee
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #48 OPEN, label enhancement, milestone none, remote updatedAt 2026-10-26T17:58:08Z, no difference of metadata from the Observed fields; earlier record: 2026-10-26 11:02 PDT; `gh issue edit 48` replaced the body (the Acceptance Criteria are checkboxes, all open), read back OPEN

#### M16 - Modernize the retained state-changing sample scripts

Origin: bfb0dc71 / M1
Identity History: M1 to M16 on 2026-10-26
GitHub Issue: #63 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/63)
Status: Not started

##### Summary

M37 (previous document, commit bfb0dc71) originally held fourteen retained sample scripts. On 2026-10-04 the owner kept the read-only and alert groups in M37 (previous document, commit bfb0dc71) and moved the two groups that change appliance state here: recovery selection (abortNeverConnectedPVs.py, resumePausedPVsMatchingPattern.py) and storage and configuration (consolidatePausedPVs.py, consolidateArchivedData.py, changeArchiveStore.py, addPostProcessingOperator.py, removeMetaFields.py). M37 (previous document, commit bfb0dc71)'s Summary records their current defects: no timeouts, HTTP 200 taken as success, the unchecked pause, consolidate and resume sequence with an unconditional resume, the full PVTypeInfo post with override=true, and the getAllPVs default limit of 500.

##### Scope

Bring these seven scripts to the contract M37 (previous document, commit bfb0dc71) defines for its scripts (explicit BPL URL, per-request `--timeout`, exit 0, 1 and 2, results on stdout and diagnostics on stderr), reusing M37 (previous document, commit bfb0dc71)'s shared Bash mechanics, while keeping each script's target selection, request order, side effects and final state explicit. Document each in the scripting page.

Out of scope: the M37 (previous document, commit bfb0dc71) scripts; the eight commands delivered by M17 (previous document, commit bfb0dc71); server corrections, which take their own scope when a script exposes a defect.

##### Completion Criteria

- Each of the seven scripts has a defined input, response, dependency, timeout and failure contract, reports an application-level rejection and an uncertain outcome as such, and does not report success on HTTP 200 alone.
- Each keeps the procedure recorded in M17 (previous document, commit bfb0dc71)'s function map, and every intentional change from the legacy behavior is named with its reason.
- Each is verified by executing its shipped entry point against the real appliance and the shipped IOC fixture, with the original and the replacement compared on the same fixtures before the original is removed; the scripting page documents each.

##### Dependencies And Decisions

- Origin: split from M37 (previous document, commit bfb0dc71) by the owner on 2026-10-04; unassigned until the owner assigns it.
- M37 (previous document, commit bfb0dc71): the language (Bash), the per-request timeout and the shared mechanics come from M37 (previous document, commit bfb0dc71).
- Decisions carried from M37 (previous document, commit bfb0dc71) (Decision Date 2026-10-04): consolidateArchivedData.py checks the result of each step and resumes only the PVs it paused itself; addPostProcessingOperator.py requests getAllPVs with an explicit limit; the three type-info scripts keep posting the complete PVTypeInfo with override=true, add a readback that confirms only the intended field changed, and document that a concurrent change between read and post can be overwritten.
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

Title: State-changing sample scripts lack a timeout and outcome contract
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #63 OPEN, label enhancement, milestone none, remote updatedAt 2026-10-26T18:56:34Z, no difference of metadata from the Observed fields; earlier record: 2026-10-26 11:57 PDT; filed from the draft body with `gh issue create`, read back OPEN with label enhancement and assignee jeonghanlee

#### M17 - Mail delivery for the alert checks

Origin: bfb0dc71 / M2
Identity History: M2 to M17 on 2026-10-26
GitHub Issue: #64 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/64)
Status: Not started

##### Summary

The three alert scripts (checkConnectedPVs.py, checkTypeChangedPVs.py, storageSizeCheck.py) send their alerts by mail through the emailHandler.py helper. On 2026-10-04 the owner made them on-demand checks in M37 (previous document, commit bfb0dc71) that report by stdout and exit status and send no mail, and moved emailHandler.py and mail delivery here. Today the helper reads its JSON configuration (named by `ARCHAPPL_NAGIOS_EMAIL_CONFIG`, default `/arch/tools/config/archappl_email_config`) at import, before the calling script parses its arguments; opens its SMTP connection without a timeout; and names only the first recipient in the To header while sending to all.

##### Scope

Provide mail delivery for the alert checks as an option on top of their stdout and exit-status contract: configuration read after argument parsing, a per-connection timeout, credentials kept off the command line, and a defined failure status.

Out of scope: the alert checks themselves (M37 (previous document, commit bfb0dc71)).

##### Completion Criteria

- Mail delivery has a defined configuration, timeout and failure contract and is verified by sending through a real SMTP endpoint; a configuration or SMTP failure is reported and reflected in the exit status.

##### Dependencies And Decisions

- Origin: split from M37 (previous document, commit bfb0dc71) by the owner on 2026-10-04; unassigned until the owner assigns it.
- M37 (previous document, commit bfb0dc71): the alert checks and their stdout and exit-status contract come from M37 (previous document, commit bfb0dc71).
- Decision carried from M37 (previous document, commit bfb0dc71) (Decision Date 2026-10-04): emailHandler.py reads its configuration after the calling script has parsed its arguments.

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

Title: Mail delivery for the alert checks
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #64 OPEN, label enhancement, milestone none, remote updatedAt 2026-10-26T18:56:36Z, no difference of metadata from the Observed fields; earlier record: 2026-10-26 11:57 PDT; filed from the draft body with `gh issue create`, read back OPEN with label enhancement and assignee jeonghanlee

#### M18 - Verify the proxy to an external Archiver Appliance

Origin: bfb0dc71 / M3
Identity History: M3 to M18 on 2026-10-26
GitHub Issue: #65 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/65)
Status: Not started

##### Summary

An appliance can register another EPICS Archiver Appliance as an external data server (`addExternalArchiverServer` and `addExternalArchiverServerArchives` with the archive `pbraw`, server type `ARCHAPPL_PBRAW` on the Integration page). For a PV it does not archive, retrieval asks each registered appliance `areWeArchivingPV` and, on a positive answer, reads the data from that appliance's `getData.raw` through the `pbraw://` plugin and returns it (`DataRetrievalServlet.checkIfPVisServedByExternalServer`); `GetMatchingPVs` and `GetDataAtTime` also consult the registered servers. No test calls the registration calls or exercises this decision path. The failover tests (`common/Failover*Test.java`) read another appliance through the same `pbraw://` plugin, but through a `merge://` data store set on one PV, not through a registered external server.

##### Scope

Establish by a real run whether the proxy to an external Archiver Appliance works on this platform, and keep the run as an integration test.

Out of scope: the Channel Archiver XML-RPC data server (`CA_XMLRPC`); the interface for registering servers; corrections, which take their own scope when the run exposes a defect.

##### Completion Criteria

- An integration test starts two appliances, archives a PV from the shipped IOC fixture on the second only, registers the second as an external server of the first through the mgmt calls, and observes through the first appliance: the PV's data from `getData`, the PV in the name match, and its value from the value-at-time call, each matching the second appliance's own answer.
- The test also observes that removing the server (`removeExternalArchiverServer`) ends the proxy, and that a PV neither appliance archives returns no data.
- The outcome is recorded: the proxy works as described, or the defect found is recorded as separate work for owner direction.

##### Dependencies And Decisions

- Origin: recorded on 2026-10-12 at the owner's direction during the review of the management interface, where the Integration page keeps only the external Archiver Appliance servers.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Build the two-appliance setup from the existing test support (`TomcatSetup.setUpFailoverWithWebApps`) and the shipped IOC fixture.
2. Write the test against the real calls and run it. Closes with T1 and T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | Run the new test with the integration profile: two appliances, the shipped IOC fixture, registration and removal through the mgmt calls, reads through the first appliance's retrieval | JDK 21, Tomcat 9, softIocPVX | Data, name match and value at a time through the first appliance match the second's; removal ends the proxy |
| T2 | Integration | ./mvnw -B -ntp clean verify | JDK 21, wrapper Maven | Build and the default suite pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, Tomcat 9, softIocPVX | Pending | none |
| T2 | Not run | JDK 21, wrapper Maven | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: The proxy to an external Archiver Appliance is not tested
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #65 OPEN, label enhancement, milestone none, remote updatedAt 2026-10-26T18:56:38Z, no difference of metadata from the Observed fields; earlier record: 2026-10-26 11:57 PDT; filed from the draft body with `gh issue create`, read back OPEN with label enhancement and assignee jeonghanlee

#### M19 - Verify signal storage and important-signal delivery under client overload

Origin: bfb0dc71 / M15
Identity History: M15 to M19 on 2026-10-26
GitHub Issue: #55 - https://github.com/jeonghanlee/epicsarchiverap-maven/issues/55
Status: Deferred

##### Summary

Verify appliance behavior under excessive client requests according to the operational priorities: first, signal storage; second, storage and delivery of important signals; last, client request handling. Rejecting or stopping client requests is acceptable when required to preserve the higher-priority functions. Process survival and memory thresholds alone do not establish this behavior.

##### Scope

- Combine real IOC updates, actual archiving and delivery, and concurrent HTTP/PVA retrieval load in an isolated appliance using the intended deployment layout.
- Compare emitted sequence numbers, values and timestamps with stored records and destination receipts before, during and after overload; account explicitly for configured sampling and deadband.
- Cover oversized requests, concurrent accumulation, in-flight memory growth, slow or disconnected clients, repeated retries and repeated overload/recovery cycles.
- Retain memory, GC, worker and connection observations to explain the storage, delivery, rejection and recovery results. Keep controlled-exposure checks separate from operation without test-driven GC or filesystem read holds.

Out of scope: immediate implementation or execution; changing M85 (previous document, commit bfb0dc71) / T6, T7 or T8 completion criteria; selecting a new collector, admission policy or signal-priority mechanism without a separate accepted plan.

##### Completion Criteria

- An accepted contract defines important signals, delivery destinations and protocols, expected stored/delivered records, allowed delays and client rejection/recovery behavior.
- Real combined-load tests demonstrate the required storage and important-signal delivery throughout overload, with no unexplained missing, duplicated or corrupted records against that contract.
- Excessive requests are refused or stopped with observable failure, and request handling recovers within the agreed bound without restarting the appliance; failures and missing exposure remain explicit.

##### Dependencies And Decisions

- Decision Date: 2026-10-22. Retain this work as a long-term Backlog plan; exclude it from current execution. Existing M85 (previous document, commit bfb0dc71) scope and completion criteria remain unchanged.
- Priority order: signal storage; important-signal storage and delivery; client requests.
- Related evidence: M85 (previous document, commit bfb0dc71) request-protection measurements and M8 concurrency planning. No execution dependency is assigned by this record.
- Open planning details: important-signal selection, delivery semantics, allowable storage/delivery latency, client behavior during overload, deployment resources and observation duration. These are future plan inputs, not permission to implement.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Define the operational contract and record a normal-load baseline with independently observed IOC emissions, stored records and delivery receipts. Check: T1.
2. Combine continuous signal production with the overload scenarios and normal client probes, judging storage and important-signal delivery before request service. Check: T2.
3. Repeat overload/recovery cycles and the selected heap profiles; verify final data integrity and resource recovery. Check: T3.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Operational baseline | Observe real IOC emissions, stored records, important-signal delivery receipts and normal client responses | Isolated appliance; resources and signal contract to be defined | Actual records and delays satisfy the accepted contract before overload |
| T2 | Combined-load integration | Continue T1 production while applying oversized, concurrent, growing, slow/disconnected and retrying HTTP/PVA requests | Same appliance and signal contract; no substituted internal request path | Storage and important-signal delivery meet their higher-priority requirements; client requests complete correctly or fail observably |
| T3 | Repeated recovery | Repeat normal/overload/recovery cycles and selected heap profiles; compare final records and worker/connection state | Same deployed code; duration and limits to be defined | Data integrity and agreed recovery bounds hold without restart or accumulating abandoned work |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | Not scheduled | Pending | none |
| T2 | Not run | Not scheduled | Pending | none |
| T3 | Not run | Not scheduled | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Verify storage and important-signal delivery under client overload
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: enhancement
Observed Milestone: none
Observed Assignee: jeonghanlee
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #55 OPEN, label enhancement, milestone none, remote updatedAt 2026-10-23T06:25:39Z, no difference of metadata from the Observed fields; earlier record: 2026-10-23T06:26:19.445179+00:00; issue #55 read back with exact draft-body equality; remote updatedAt 2026-10-23T06:25:39Z.

#### M20 - Integrated 24-hour ETL, journal and sample-buffer verification

Origin: bfb0dc71 / M8
Identity History: M8 to M20 on 2026-10-26
GitHub Issue: #67 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/67)
Status: Blocked

##### Summary

A later 24-hour campaign combines corrected engine buffer verification with ETL and journal checks after the required Ansible tools are ready. This is additional integration evidence, independent of the accepted ETL/journal results and four-hour buffer-fix acceptance.

##### Scope

Use a build carrying 6c6b973a, the agreed 903-PV fixture and the shortened/default ETL and journal contracts established in jeonghanlee/ansible-provision#30 and jeonghanlee/ansible-provision#31. Coordinate the campaign while retaining independently bounded deployments, inputs, timelines and verdicts. Include all-PV buffer counters and M46 (previous document, commit bfb0dc71)'s declared fast-input/unreduced-PB comparison scope. Freeze tool/artifact identities and boundaries before execution.

Out of scope: reopening completed ETL/journal acceptance because this campaign is pending; delaying #29 closure after G6 (previous document, commit bfb0dc71) succeeds; unrelated tool variants, product changes, host sizing or new fault categories.

##### Completion Criteria

- G1 supplies real-path readiness evidence for the specific corrected tools needed here; unrelated Ansible issue closure is not required.
- Every declared observation completes at least 86400 elapsed seconds with valid process/clock and original-record coverage on the corrected build.
- ETL movement/transformation/retention/retrieval and repeated passes, journal delivery/live retention/collection and buffer preservation receive independent evidence-backed verdicts within explicit comparison scopes.
- Counter/input-activity checks cover all 903 PVs; exact event/value claims are limited to independently compared inputs. Preserve failures, evidence gaps and tool findings without silent exclusions or automatic reruns.

##### Dependencies And Decisions

- G1: ansible-provision's external report that the required corrected tools are ready. Initial block; resume as Not started when G1 completes and all work dependencies are satisfied.
- M46 (previous document, commit bfb0dc71): the owner placed this additional campaign after four-hour buffer-fix acceptance.
- Decision Date: 2026-10-15. Keep this unassigned in Backlog until the required Ansible tools are ready. It does not block independent current functionality acceptances.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Confirm G1 and M46 (previous document, commit bfb0dc71) completion, then freeze deployments, corrected build, fixture, actual-input comparison scopes and independent per-product acceptance rules. Closes with T1.
2. Prepare and execute the separately authorized 24-hour campaign through the real shipped application, journal and corrected collection/evaluation paths. Closes with T2.
3. Reconcile unchanged original inputs and results through native readers/evaluators and publish scoped conclusions. Closes with T3.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Readiness | Read actual readiness evidence and perform bounded real-path capture/comparison checks for this campaign | Prepared corrected-build deployments | Required tools and independent inputs support frozen contracts |
| T2 | Integrated campaign | Execute actual application, ETL, journal and buffer checks for at least 86400 seconds per declared observation | Shipped 903-PV fixture; corrected engine/tools | Complete independently judged product evidence, with no hidden missing intervals |
| T3 | Evidence reconciliation | Run actual frozen readers/evaluators against unchanged originals and compare each declared scope | Retained campaign evidence | Reproducible scoped product and evidence/tool verdicts |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | Future prepared deployments | Pending | G1 is Open |
| T2 | Not run | T1 deployments | Pending | No campaign started |
| T3 | Not run | T2 originals | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Integrated 24-hour ETL, journal and sample-buffer verification
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-28)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-28 00:36 PDT; `gh issue list` read #67 OPEN, label enhancement, milestone none, remote updatedAt 2026-10-26T18:56:42Z, no difference of metadata from the Observed fields; earlier record: 2026-10-26 11:57 PDT; filed from the draft body with `gh issue create`, read back OPEN with label enhancement and assignee jeonghanlee

#### M22 - Restore viewed PVs after tab navigation

Origin: bfb0dc71 / M22
Identity History: none
GitHub Issue: #72 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/72)
Status: Not started

##### Summary

The reported viewer behavior loses the previously viewed PVs when the operator changes tabs. Preserve the PV selection so returning to the viewer restores the working list and plotted PVs without entering their names again.

##### Scope

- Identify the affected viewer and navigation path, then preserve and restore its selected PV list and plotted subset across leaving and returning to the view.
- Define the storage mechanism, retention duration and precedence of an explicit address over saved state during planning; retain the existing PV limits and address behavior.
- Keep deliberate PV removal and clearing effective when the operator returns.

Out of scope: changing acquisition, sampling or archived data; implementing the analyzer phases; a general browsing-history service or cross-device synchronization.

##### Completion Criteria

- After selecting and plotting PVs, navigating to another tab and returning restores the same PV names and plotted subset without manual re-entry.
- Repeated navigation introduces no duplicate PVs, and removed or cleared PVs do not reappear from saved state.
- Explicit addresses continue to open their requested PVs according to the documented precedence; missing or unusable saved state leaves the viewer usable.

##### Dependencies And Decisions

- Decision Date: 2026-10-29. Record PV selection persistence as a separate work item; no implementation is authorized by this entry.
- No execution dependency is established. M1 also concerns viewer address state; coordinate any shared paths when planning without making this item depend on the analyzer redesign.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Reproduce the reported navigation through the shipped viewer, identify its state initialization and address handling, and define storage, retention and restoration precedence. Check: T1.
2. After separate plan acceptance and implementation authorization, preserve and restore the selected and plotted PVs through that path and verify removal, clearing and explicit-address behavior. Checks: T1, T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Browser integration | Select and plot multiple archived PVs in the shipped viewer, follow the reported tab navigation and return repeatedly through the real UI | Browser and deployed appliance | The same selected and plotted PVs return without manual re-entry or duplicates |
| T2 | Browser integration | Remove or clear PVs and revisit; open an explicit PV address; exercise missing or unusable saved state through the shipped restore path | Same browser and appliance | Deliberate removal persists, explicit addresses follow the agreed precedence, and the viewer remains usable |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | Browser and deployed appliance | Pending | none |
| T2 | Not run | Browser and deployed appliance | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Restore viewed PVs after tab navigation
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-31 00:12 PDT)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-31 00:12 PDT; issue #72 read back with body equal to the prepared draft, three unchecked acceptance criteria, label enhancement, assignee jeonghanlee, no milestone; remote updatedAt 2026-10-31T07:12:13Z

#### M23 - Select matching PVs together and improve Find

Origin: bfb0dc71 / M23
Identity History: none
GitHub Issue: #73 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/73)
Status: Not started

##### Summary

After narrowing the viewer's Find results by a prefix and Glob pattern, the operator needs one action to select the matching PVs. The search should also provide more useful assistance when the exact name is not known.

##### Scope

- Add selection of matching results as one operation, accounting for existing selections, duplicates, partial results and the current selection limit.
- Evaluate search assistance against the existing Worker-based Contains, Glob and Regex modes. Preserve exact Glob matching and distinguish approximate suggestions from exact results.
- Evaluate Fuse.js for ranked approximate matches and Tom Select for search and selection controls before selecting a dependency; neither library is approved by this record.

Out of scope: changing acquisition or archived data; automatically plotting every selected PV; changing the current 100-PV selection or five-PV plot limits without a separate decision; implementing selection persistence covered by M22.

##### Completion Criteria

- A prefix and Glob query can select its matching PVs together, without duplicates or unexpected removal of earlier selections.
- The interface explains limits and partial results instead of silently claiming that all matches were selected.
- Exact Glob results retain their meaning, including the difference between one-character `?` and arbitrary-length `*`; approximate suggestions cannot silently become exact bulk selections.
- The accepted search assistance works with the real PV list and remains responsive at the supported list size.

##### Dependencies And Decisions

- Decision Date: 2026-10-29. Record the viewer requests as later work; implementation and dependency selection remain pending.
- No execution dependency is established. Coordinate shared selection handling with M22 when planning.
- Source inspection on 2026-10-29: `browse.js` uses a Worker, limits selection to 100 and plots to five; `names-worker.js` implements exact Contains, Glob and Regex matching. Library references: https://www.fusejs.io/ and https://tom-select.js.org/docs/ . No library benchmark or browser verification has run.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Use the shipped Find path in `browse.js` and `browse/names-worker.js` to define bulk selection, partial-result handling and search-assistance behavior; compare the candidate libraries on representative PV names before accepting a plan. Checks: T1, T2.
2. After separate plan acceptance and implementation authorization, implement and verify the accepted controls through the real UI. Checks: T1, T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Browser integration | Narrow a real PV list by prefix and Glob; select results together with existing selections, duplicate names, empty results and results exceeding the selection limit | Browser and deployed appliance | Correct selected names, explicit limits and no duplicate or unintended selections |
| T2 | Search and browser integration | Exercise shipped search with exact identifiers, one- and two-digit suffixes, approximate queries, partial server results and a representative large PV list | Browser, shipped Worker and appliance | Exact modes retain their contract; assistance and responsiveness meet the accepted plan |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | Browser and deployed appliance | Pending | none |
| T2 | Not run | Browser and deployed appliance | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Select matching PVs together and improve Find
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-31 00:12 PDT)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-31 00:12 PDT; issue #73 read back with body equal to the prepared draft, four unchecked acceptance criteria, label enhancement, assignee jeonghanlee, no milestone; remote updatedAt 2026-10-31T07:12:15Z

#### M24 - Explain sampling changes and hide irrelevant confirmation controls

Origin: bfb0dc71 / M24
Identity History: none
GitHub Issue: #74 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/74)
Status: Not started

##### Summary

The operator reports an unlabeled checkbox in Change sampling and needs an explanation of its controls. The dialog shares `maintainAckRow` with operations such as type conversion, whose checkbox confirms a data backup; sampling supplies no confirmation text and should hide the row.

##### Scope

- Reproduce the unexpected checkbox in the shipped dialog and correct its visibility without removing confirmations required by other operations.
- Explain MONITOR and SCAN, the meaning of their period, and how the MONITOR period affects sample-buffer sizing rather than imposing an event-throttling interval.
- State the behavior of a sampling change using the actual backend path, including its effect on existing data and any collection interruption that the implementation entails.

Out of scope: changing acquisition behavior, buffer sizing rules or sampling defaults; unrelated dialog redesign.

##### Completion Criteria

- Change sampling has no unlabeled or irrelevant checkbox, including after another maintenance dialog was opened.
- Type conversion still displays and requires its backup confirmation.
- The dialog explains method and period accurately enough to distinguish MONITOR buffer sizing from SCAN timing, and its help remains readable with keyboard navigation.

##### Dependencies And Decisions

- Decision Date: 2026-10-29. Record the reported control and explanation problem for later implementation.
- Source inspection on 2026-10-29: `openMaintain` sets `maintainAckRow.hidden` from `config.ack`; `openChangeSampling` provides no `ack`, while `openChangeType` does. `browse.css` sets `dialog label` to `display: block`, a suspected override of hidden presentation; browser reproduction remains pending.
- No execution dependency is established.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Reproduce the dialog visibility through `index.html`, `browse.js` and `browse.css`; trace the sampling API and buffer behavior to draft accurate help. Checks: T1, T2.
2. After separate plan acceptance and implementation authorization, correct visibility and add the accepted explanation, then exercise both sampling and type-conversion dialogs. Checks: T1, T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Browser integration | Open sampling directly and after type conversion; inspect visibility and keyboard focus; check required confirmation on type conversion without submitting that operation | Browser and deployed appliance | No irrelevant checkbox in sampling; backup confirmation remains visible and required for type conversion |
| T2 | Contract and browser integration | Compare dialog help against the shipped sampling API and buffer allocation, then change sampling on a test PV through the actual UI | Isolated test PV, browser and appliance | Help matches actual method, period, buffer and stored-data behavior |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | Browser and deployed appliance | Pending | none |
| T2 | Not run | Isolated test PV, browser and appliance | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Hide the irrelevant checkbox in Change sampling and explain it
Labels: bug
GitHub Milestone: none
Observed State: OPEN (2026-10-31 00:12 PDT)
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-31 00:12 PDT; issue #74 read back with body equal to the prepared draft, three unchecked acceptance criteria, label bug, assignee jeonghanlee, no milestone; remote updatedAt 2026-10-31T07:12:17Z

#### M27 - Distinguish plotted lines and retain accessible display preferences

Origin: bfb0dc71 / M27
Identity History: none
GitHub Issue: #71 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/71)
Status: Not started

##### Summary

Plots need distinguishable line styles as well as colors. Operators need display options for differing color-vision needs, with their selected time and display settings reused during the browser session.

##### Scope

- Assign distinct line styles automatically when signals are selected for plotting; keep the legend consistent with each plotted line.
- Provide selectable web display options for differing color-vision needs. Use line patterns, labels and other non-color cues wherever color conveys meaning.
- Reuse selected time settings and display options as defaults within the browser session, including tab navigation and reopening the relevant page.
- Define supported color-vision profiles, the meaning of time settings, and browser-session boundaries during plan review.

Out of scope: changing archived samples, acquisition settings, account-wide preferences or cross-device synchronization.

##### Completion Criteria

- Simultaneously plotted signals remain distinguishable without relying on color alone, with matching legends and an explicit policy for the supported number of lines.
- Display options preserve readable text, controls and status distinctions for the agreed color-vision profiles.
- Selected time/display options survive the agreed browser-session navigation and reset behavior; an explicit later selection takes precedence over a saved default.

##### Dependencies And Decisions

- Decision Date: 2026-10-30. Record this viewer follow-up after the current PVA metadata implementation. This is a planning request, not implementation authorization.
- Coordinate preference storage with M22 selection restoration without assuming a technical dependency before inspecting the existing navigation and storage paths.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Inspect Browse and viewer line assignment, legends, status colors, time controls and existing browser storage. Define profile and session behavior for plan acceptance. Checks: T1, T2, T3.
2. After separate acceptance and implementation authorization, implement the agreed line styles and display options consistently across affected views. Checks: T1, T2.
3. Persist the agreed preferences for the browser session and apply them on navigation while honoring explicit user selections. Check: T3.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Browser integration | Select multiple real PVs and compare lines with legends before and after selection changes | Shipped viewer and local appliance | Signals have consistent, distinguishable styles within the supported line count |
| T2 | Accessibility and browser | Inspect all agreed profiles, including non-color cues, contrast, controls and status displays | Shipped pages and agreed color-vision assessment tools | Information remains distinguishable without color alone |
| T3 | Browser integration | Change time/display options, navigate between tabs, reopen pages and exercise the agreed session reset boundary | Real browser session | Defaults are reused only for the agreed lifetime; explicit selections take precedence |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | Shipped viewer and local appliance | Pending | none |
| T2 | Not run | Shipped pages and agreed assessment tools | Pending | none |
| T3 | Not run | Real browser session | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Add accessible chart styles and session display defaults
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-30 10:19 PDT)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-30 10:19 PDT; issue #71 read back with body equal to the prepared draft, three unchecked acceptance criteria, label enhancement, assignee jeonghanlee, no milestone; remote updatedAt 2026-10-30T17:18:50Z

#### M28 - Study dynamic configuration reload and immediate API application

Origin: bfb0dc71 / M28
Identity History: none
GitHub Issue: #68 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/68)
Status: Not started

##### Summary

Selected configuration changes might be applied to a running appliance through a 60-second reload cycle or an explicit API request, while other settings must keep requiring a restart. This study decides which. `DefaultConfigService.initialize()` loads the installation properties at start. `EngineContext` sets `jca.use_env` to true before it creates the command threads, and each `JCACommandThread` constructs its own `CAJContext`. The execution-policy cache expires one minute after it is written and is read on demand; that is separate from a general configuration reload.

##### Scope

- Inventory the configuration settings by source, consumer and read time, and classify each as dynamically applicable, requiring recreation of the Channel Access context, or requiring a component or JVM restart, with code references.
- Compare 60-second polling with explicit API application: change detection, validation, concurrent updates, and how a caller distinguishes an accepted change from a successfully applied one.
- Evaluate Channel Access reconnection, channel and monitor recreation, pending commands, buffered samples and collection gaps, and define how interruption, loss and duplication would be measured.
- Define persistence across restarts and the precedence among environment variables, JVM properties, configuration files and API updates, separating changes to startup files from configuration available to a running process.
- Define behavior for invalid input, partial application, an unavailable component and a failed recreation of the Channel Access context, including retention or restoration of the last valid configuration.
- Define consistency across the management and engine components, access control of the API, and visibility of requested versus effective configuration.
- Produce a recommendation, the explicit unsupported cases and a verification plan on the real configuration and acquisition paths, and name the runtime behavior that remains unverified.

Out of scope: implementing configuration reload or an API; preparing environment-side `config.d` support; treating the existing policy-cache expiration as a general configuration reload.

##### Completion Criteria

- Every configuration setting has a recorded source, consumer, read time and classification, each supported by a code reference.
- The comparison of polling and explicit API application states change detection, validation, concurrent-update handling and the distinction between accepted and applied changes.
- Interruption, loss and duplication across the recreation of the Channel Access context are defined and measured on a real appliance with an IOC, or the reason a case cannot be measured is recorded.
- Persistence, precedence, failure behavior, cross-component consistency, access control and the visibility of requested versus effective configuration are defined.
- A recommendation, its unsupported cases and a verification plan are recorded, and the runtime behavior that remains unverified is named.

##### Dependencies And Decisions

- Decision Date: 2026-10-31. Register issue #68 as backlog work. This entry records a study; no implementation of reload or of an API is authorized.
- No execution dependency is established.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Inventory the settings through the shipped initialization and runtime paths (`DefaultConfigService.initialize()`, `EngineContext`, `JCACommandThread`), then classify each and record its code reference. Check: T1.
2. Compare polling and explicit API application and define persistence, precedence, validation, failure behavior, consistency, access control and visibility of requested versus effective configuration. Check: T1.
3. Measure the recreation of the Channel Access context under real acquisition: interruption, loss and duplication, and the effect on pending commands and buffered samples. Check: T2.
4. Write the recommendation with its unsupported cases, the verification plan and the unverified behavior. Checks: T1, T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Source and runtime analysis | Trace each setting from its source to its consumer and read time in the shipped paths, then change a value on a running appliance and observe when the consumer reads it | Source tree and a local appliance | Each setting has a source, consumer, read time and classification confirmed by a code reference and an observation |
| T2 | Integration | Recreate the Channel Access context while a real IOC publishes known samples, then compare the samples archived and retrieved against the published ones | Local appliance, IOC and JDK 21 | Interruption, loss and duplication are measured and stated, and unmeasured cases are listed |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | Source tree and a local appliance | Pending | none |
| T2 | Not run | Local appliance, IOC and JDK 21 | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Study dynamic configuration reload and immediate API application
Labels: enhancement
GitHub Milestone: none
Observed State: OPEN (2026-10-31 00:14 PDT)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-31 00:14 PDT; issue #68 read back with the acceptance criteria registered as scope and completion criteria, label enhancement, assignee jeonghanlee, no milestone; remote updatedAt 2026-10-29T07:35:45Z

#### G1 - Ansible tools ready for the integrated 24-hour campaign

Origin: bfb0dc71 / G1
GitHub Issue: none
Status: Open

##### Summary

ansible-provision reports readiness of the actual collection, comparison and terminal-handling tools needed by M20 after their corrections. The condition is a report for this campaign, not closure of every Ansible follow-up issue. Affects M20.

##### Completion Criteria

- Required corrected tools demonstrate real-path capture, source/process/time selection, final handling and input/output comparison against retained or bounded real observations.
- The report identifies tools, supported scopes and unresolved limitations sufficiently to prepare M20 without treating a collector/evaluator failure as product failure.
- ETL/journal verdicts remain independent and original unsuccessful records remain preserved.

##### Verification Results

| Observed At | Result | Evidence |
| --- | --- | --- |
| Not run | Pending | No readiness report for the combined corrected-build campaign |

##### Closure Evidence

- none

## History

| Reset Date | Prior State Commit |
| --- | --- |
| 2026-10-26 | bfb0dc71f6c3e3eca3846e4cc1f3183d19b6e5c1 |
