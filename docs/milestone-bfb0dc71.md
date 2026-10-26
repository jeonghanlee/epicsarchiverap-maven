# Work Register

Release line: master
Milestone index: bfb0dc71
Canonical path: `docs/milestone-bfb0dc71.md`
Canonical branch or ref: master
Git upstream: origin/master
Remote tracker: jeonghanlee/epicsarchiverap-maven (aa-maven); GitHub issues per row, no GitHub milestone
Peer register: aa-env at jeonghanlee/epicsarchiverap-env, `docs/milestone-265f580.md` on branch modernize (cross-referenced per decisions D2 and D3 of the previous document, commit bfb0dc71)

Next session entry point: open the next release cycle from this document with the `release-cycle` procedure: choose the release name, assign the Backlog rows that belong to it to the Milestone section and add its final release milestone. The Ready rows are M1, M2, M3, M4, M5, M9, M13, M14, M16, M18, M19, M20; M8 waits for G1. Outstanding from release 2026-10: the install and run check of the tag by the epicsarchiverap-env session, whose report belongs in the Closure Evidence of M85 (previous document, commit bfb0dc71).

## Milestone

This register covers the work that remains after release 2026-10 of the Maven appliance. The completed work and the decisions that only it needed are in the previous document at commit bfb0dc71; a row or decision of that document is named with that commit.

### Work

| Group | ID | Work unit | Type | Status | Ready | Deps | Done when / Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |

### Decisions

| ID | Decision | Decision Date |
| --- | --- | --- |
| D1 | The management interface is a console, not a set of documents: each page shows state and offers actions at a glance, and an explanation opens on demand (an information control or Help), not as standing text. The System pages provide status monitoring. The menu is organized by task, five entries: Archive PVs (adding PVs and controlling their archiving, with a control into the analyzer), Browse PVs (finding archived PVs, a table of the chosen ones with one chart of up to five and a Details window for each, and a control into the analyzer), System (status monitoring), Help, and Analyzer (the data analyzer opened directly); each entry opens its own page and marks the page in view. The old addresses (`reports.html`, `metrics.html`, `storage.html`, `appliance.html`) forward outside the menu. | 2026-10-12 |
| D2 | The analyzer, which replaces the data viewer of M47 (previous document, commit bfb0dc71), is a data analysis tool in the browser: an operator analyzes archived data in it without exporting to an external tool. It is built with every applicable tool of the bundled D3 package (7.9.0, `staticcontent/js/vendor/d3.min.js`); D3 is the only library: the bundled package first, then, where it lacks a tool, a module of the official D3 repositories outside the default bundle (such as `d3-hexbin`), vendored with its version, source and licence recorded as for `d3.min.js`; no third-party package is added. The tools of the bundled package are built first. A simple computation that D3 does not provide, such as the correlation and the linear regression, is implemented in the page's own code. | 2026-10-12 |
| D3 | The console checks run against one soft IOC and one local appliance. The IOC is the `consolechart` IOC of `ioc-runner` (local mode), started from `src/resources/test/st.cmd`, which loads `ConsoleChartPVs.db` and one record-change database chosen by the `RECORD_CHANGE` macro; a check that needs another record set switches the macro in the IOC configuration and restarts that IOC, and does not start a second one. The appliance is the kept local appliance (port base 27665); a check that needs another archiver state uses it, and does not start a second one. The procedure of this IOC is written into the book as M75 (previous document, commit bfb0dc71), in stage 1 of D43 (previous document, commit bfb0dc71) after M73 (previous document, commit bfb0dc71), so that it records the commands the M73 (previous document, commit bfb0dc71) checks ran. D20 (previous document, commit bfb0dc71) is unchanged: the Java test fixtures keep launching softIocPVX directly. | 2026-10-17 |
| D4 | The role of the archiver is to keep the signal without a gap: when the archived record changes, the archiver detects it and goes on storing under the new condition, with the earlier samples readable as they were stored. That is M10, deferred to the next major release, and one GitHub issue holds the direction. In this release the engine does only this much (M77 (previous document, commit bfb0dc71)): it writes to its log that the record is changing, naming the PV and the change, and it pauses what can be paused, which is a PV whose type changed; the other reactions stay as M73 (previous document, commit bfb0dc71) observed them. M77 (previous document, commit bfb0dc71) runs in stage 1 of D43 (previous document, commit bfb0dc71) after M75 (previous document, commit bfb0dc71). | 2026-10-17 |
| D5 | Before the merge of `modernize` into the default branch, the open work is closed down to what the shipped console needs: M67 (previous document, commit bfb0dc71) closes by a dated exception with its step 5 (the header of the analyzer) moved to M5; M78 (previous document, commit bfb0dc71), M79 (previous document, commit bfb0dc71) and M80 (previous document, commit bfb0dc71) move from the Backlog to the Milestone table and are done; the analyzer design (`docs/design-analyzer.md`) is in place. After the merge the analyzer is built in five phases, one row each, in the order A (M5, page, header and address), B (M11, interaction, options and export), C (M6, tools for one signal), D (M12, tools for two and several signals) and E (M7, waveforms and images), each phase accepted and authorized on its own and usable when it ends; then M9, M4, M3, M1, M2, M8 after G1, and M10 as deferred. Issue #39 stays the one issue of the analyzer, with a box per phase in its body. | 2026-10-19 |
| D6 | A `ZIP_PER_PV` store that is the source of an ETL move keeps the partition it moved (found by the check of M80 (previous document, commit bfb0dc71)). The defect goes to the Backlog as M13 (issue #52) for a later release, because the site uses no zip store and a zip store is the last store of a chain; the book's `compress` row says so, and M80 (previous document, commit bfb0dc71) covers the zip store for the explicit deletion only. | 2026-10-19 |
| D7 | The two findings of the audit of M85 (previous document, commit bfb0dc71) that its loops do not cover enter the Backlog as rows: the PVAccess answer that copies its array at every event and is held whole (M86 (previous document, commit bfb0dc71)), and the PVAccess server that bounds neither the calls at a time nor their duration (M14). Neither blocks M85 (previous document, commit bfb0dc71) or the merge of `modernize`; the owner assigns them to a table when the order is chosen. | 2026-10-21 |
| D8 | The retrieval memory protection keeps its shipped defaults (budget 0.20, admission 0.50, pressure 0.60, allocation floor 0.01, a check every 1024 events, a collection request at most every 100 ms) and the valve defaults (concurrency 100, stuck 600 s, interrupt 900 s); the connector `maxThreads` stays at Tomcat's default in the deployment template and at 40 in the development launcher. The valve concurrency is recorded as not derived from a load measurement, and the book states that a valve above `maxThreads` never refuses. The T7 and T8 results of M85 (previous document, commit bfb0dc71) are accepted as final within their recorded scope: on every measured configuration (HTTP and PVAccess; 512 MiB, 2 GiB and 4 GiB under G1; fill-operator pressure under Parallel and ZGC at 512 MiB) abnormal or excessive requests were refused or stopped, no run produced an OutOfMemoryError or a JVM exit, and recovery followed. The measurement of the thread and valve limits under combined load and the unmeasured qualification cells (Serial collector; Parallel and ZGC at 2 GiB and 4 GiB; pressure after commit; overshoot and headroom at the defaults; summary-pair admission at larger heaps) move to M16 / issue #58. The product question behind issue #56, the midpoint stamp of a summary bin against the request-end filter, moves to M17 / issue #59. | 2026-10-24 |
| D9 | Release scope of the Maven appliance: the protection of retrieval against memory exhaustion (M85 (previous document, commit bfb0dc71), issue #54) and the date correction of its summary test (M89 (previous document, commit bfb0dc71), issue #56) close before the release; every other open row and issue is worked after the release at its own pace. Open at this decision: M16 / #58, M17 / #59, M20 / #60, M15 / #55, M13 / #52, M10 / #48, M9 / #41, the analyzer rows M5, M6, M7, M11 and M12 / #39, the rows M1, M2, M3 and M4 without an issue, M8 blocked by G1, and the two deviations of M73 (previous document, commit bfb0dc71) that had no row, #45 and #47, which enter the Backlog as M18 and M19. The release cycle regroups these rows when it opens. | 2026-10-24 |
| D10 | The five candidates that the audit of the retrieval protection and the sweep of 2026-10-24 left unchecked (`FirstSamplePP`, `DeadBand`, `Fliers` and `IgnoreFliers` outside the declared-size check and the in-loop check; the values `Median`, `Kurtosis` and `Skewness` keep per bin against the 112 bytes per bin that the declared size counts; the number of `pv` parameters of `getDataForPVs`, of the names posted to `getDataAtTime` and `getDataAtTimeForAppliance`, and of the `;` separated names of the PVAccess call) are not checked before the merge to master. They enter the Backlog as M20 / issue #60 as long-term work, each to be run as a real request at a 512 MiB heap; `Nth` and `NCount` are bounded by `MAX_COUNT` and are recorded in `docs/CLOSED_DOORS.md` as CD-18; the fill operators of the audit's `Event per bin` row were checked and corrected by a27f260a, and the PVAccess name list is the one candidate that the audit did not name. The owner decided on 2026-10-24 to settle the fate of each candidate after its check. | 2026-10-24 |

### Milestone Details

No work is assigned yet.

## Backlog

Backlog rows are unassigned, use the same schema, and are excluded from the release tally.

### Work

| Group | ID | Work unit | Type | Status | Ready | Deps | Done when / Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Phase 2 | M1 | Modernize the retained state-changing sample scripts | Milestone | Not started | Yes |  | Each of the seven retained scripts that change appliance state has a defined input, response, timeout and failure contract, keeps its recorded procedure, and passes real-entry-point verification against the appliance; the scripting page documents each; [detail](#m1---modernize-the-retained-state-changing-sample-scripts) |
| Phase 2 | M2 | Mail delivery for the alert checks | Milestone | Not started | Yes |  | emailHandler.py's mail delivery is available to the on-demand alert checks of M37 (previous document, commit bfb0dc71) with a defined configuration, timeout and failure contract and is verified against a real SMTP endpoint; [detail](#m2---mail-delivery-for-the-alert-checks) |
| Phase 2 | M3 | Verify the proxy to an external Archiver Appliance | Milestone | Not started | Yes |  | An integration test on two appliances registers the second as an external `ARCHAPPL_PBRAW` server of the first and observes, through the first, the data, the name match and the value at a time of a PV archived only on the second; [detail](#m3---verify-the-proxy-to-an-external-archiver-appliance) |
| Interface console | M4 | Appliance status as PVA PVs | Milestone | Not started | Yes |  | The appliance publishes its status measures as PVA PVs through its own PVA server and archives them, so the analyzer plots them like any archived PV; [detail](#m4---appliance-status-as-pva-pvs) |
| Interface analyzer | M5 | Analyzer phase A: page, header and address | Milestone | Not started | Yes | D1, D2, D5 | The analyzer is an independent service with the header, menu and time zone choice of the console, a page composition the owner approved from a mockup (tabs by kind of analysis, a drawer of Signals, Axes, Options, Data and Export), the Trend tab drawn through the chart component, and an address that carries the PVs, the window, the zone and the options the component has; the console passes its options; [detail](#m5---analyzer-phase-a-page-header-and-address) |
| Interface analyzer | M6 | Analyzer phase C: tools for one signal | Milestone | Not started | No | M11, D2, D5 | The Distribution, Compare and Spectrum tabs: the summary and moments, histogram and box plot, moving statistics, the limits with the time beyond them, the pattern by hour and weekday, two ranges or two signals compared with their tests, and the spectrum by FFT with autocorrelation, computed by the page where the D3 bundle has no function and checked on signals of known parameters; [detail](#m6---analyzer-phase-c-tools-for-one-signal) |
| Interface analyzer | M7 | Analyzer phase E: waveform and image analysis | Milestone | Not started | No | M12, M6, D2, D5 | The analyzer draws an array at a time, over time and as a heatmap, computes its summary values and spectrum, and analyses an image by region, projections, centroid and size; [detail](#m7---analyzer-phase-e-waveform-and-image-analysis) |
| Verification | M8 | Integrated 24-hour ETL, journal and sample-buffer verification | Milestone | Blocked | No | G1 | Separate corrected-build campaign after four-hour acceptance and required Ansible tool readiness; independent product results; [detail](#m8---integrated-24-hour-etl-journal-and-sample-buffer-verification) |
| Interface console | M9 | PVA PVs keep the unit, precision, limits and host in their configuration | Milestone | Not started | Yes |  | The configuration of a PVA PV carries the unit, the precision, the display, control, warning and alarm limits and the host as the Channel Access PV of the same record does; [detail](#m9---pva-pvs-keep-the-unit-precision-limits-and-host-in-their-configuration) |
| Verification | M10 | Archiving continues across a change of the record | Milestone | Deferred | No | D4 | The engine detects a change of the archived record (type, rate, unit, precision or limits) on its own and goes on storing the signal under the new condition from the instant of the change, with the earlier samples readable as they were stored; deferred to the next major release by D4; the GitHub issue that holds the direction is filed; [detail](#m10---archiving-continues-across-a-change-of-the-record) |
| Interface analyzer | M11 | Analyzer phase B: interaction, options and export | Milestone | Not started | No | M5, D2, D5 | The gestures beyond the simple form (the drag tool chosen on the strip, wheel and pinch zoom, undo and redo of the range, two cursors, pinned samples), the options the reference tools offer (line width and style, a gap threshold, a fill between signals, fixed and soft ranges, the averaging interval or raw samples, the min-max band, a split by unit, SI prefixes, a legend table, tooltip modes), the Data tab and the full Export tab, each carried in the address; [detail](#m11---analyzer-phase-b-interaction-options-and-export) |
| Interface analyzer | M12 | Analyzer phase D: tools for two and several signals | Milestone | Not started | No | M6, D2, D5 | The Correlation tab (pairing by held values, scatter with projections and density, Pearson and Spearman, profile, the fit panel with fixed and bounded parameters) and the Dependency tab (correlation matrix ordered by clustering, ranking by mutual information, multiple regression, principal components), derived signals from a typed expression and a change of unit, the routines checked on signals of known parameters; [detail](#m12---analyzer-phase-d-tools-for-two-and-several-signals) |
|  | M13 | Delete the moved partition of a zip store that is an ETL source | Milestone | Not started | Yes | D6 | After a move out of a `ZIP_PER_PV` store the archive no longer holds the `.pb` entry of the moved partition nor its post-processor entries, the next store holds the data once, the explicit deletion keeps working and the suite passes; issue #52; [detail](#m13---delete-the-moved-partition-of-a-zip-store-that-is-an-etl-source) |
|  | M14 | Bound the concurrent calls of the PVAccess retrieval service | Milestone | Not started | Yes | D7 | The retrieval PVAccess service runs at most a measured number of calls at a time and refuses the next with a message in its log; a test with more long calls than that, on separate connections, fails on the old code and passes on the new; [detail](#m14---bound-the-concurrent-calls-of-the-pvaccess-retrieval-service) |
|  | M15 | Verify signal storage and important-signal delivery under client overload | Milestone | Deferred | No |  | Long-term plan, deferred on 2026-10-22: verify signal storage first, important-signal storage and delivery second, and client request handling last; issue #55; [detail](#m15---verify-signal-storage-and-important-signal-delivery-under-client-overload) |
|  | M16 | Measure the thread and valve limits and the remaining qualification cells of the retrieval protection | Milestone | Not started | Yes | D8 | A measured table of busy threads, response times, memory decisions and valve refusals against concurrency under combined console and retrieval load, at 512 MiB and 2 GiB and under two `maxThreads` values; the valve default recorded with the rule that produced it in the register, the book and `TESTING.md`, with a test that runs at that default; each unmeasured qualification cell measured or recorded as not measured with the reason; issue #58; [detail](#m16---measure-the-thread-and-valve-limits-and-the-remaining-qualification-cells-of-the-retrieval-protection) |
|  | M17 | Decide the stamping and filtering rule of summary bins at the window edges | Milestone | Open | No | D8 | A recorded decision on whether a bin whose samples lie inside the requested window is returned when its midpoint stamp lies after the window end, checked against the archive viewers and the Python clients; if the rule changes, such a bin is returned regardless of the request time and `VariousPostProcessorTest` passes with its original one-day window; if it stays, the retrieval page of the book states it; issue #59; [detail](#m17---decide-the-stamping-and-filtering-rule-of-summary-bins-at-the-window-edges) |
|  | M18 | Let a type change to a string or a waveform type succeed | Milestone | Not started | Yes | D9 | `changeTypeForPV` to `DBR_SCALAR_STRING` and to `DBR_WAVEFORM_DOUBLE` on a PV archived as `DBR_SCALAR_DOUBLE` returns 200, the PV resumes with the new type and its dropped-events count stops growing, the earlier samples stay readable across the change, and the record-change checks of `src/resources/test/st.cmd` with `RECORD_CHANGE=Types` pass for all four records; issue #45; [detail](#m18---let-a-type-change-to-a-string-or-a-waveform-type-succeed) |
|  | M19 | Carry the changed limits of a record into the type information at reconnect | Milestone | Not started | Yes | D9 | After an IOC restart with changed `HOPR`, `LOPR`, `HIGH` and `LOW`, `getPVTypeInfo` holds the new limits within one reconnect and the Details window shows them, the unit and the precision keep being updated, and the suite passes with a test that reconnects a PV with changed limits; issue #47; [detail](#m19---carry-the-changed-limits-of-a-record-into-the-type-information-at-reconnect) |
|  | M20 | Check the retrieval operators outside the declared-size check | Milestone | Not started | Yes | D10 | Each of the five candidates, `FirstSamplePP`, `DeadBand`, `Fliers` and `IgnoreFliers`; the per-bin values of `Median`, `Kurtosis` and `Skewness`; the number of `pv` parameters of `getDataForPVs`; the names posted to `getDataAtTime`; the `;` separated names of the PVAccess call, has a recorded real-request result at a 512 MiB heap, refused with a named condition or completed without exhausting the heap, and every candidate that exhausted it has a correction with a test that fails without it; issue #60; [detail](#m20---check-the-retrieval-operators-outside-the-declared-size-check) |
| Tracking | G1 | Ansible tools ready for the integrated 24-hour campaign | External gate | Open | No |  | ansible-provision supplies real-path readiness evidence for the corrected tools required by M8; [detail](#g1---ansible-tools-ready-for-the-integrated-24-hour-campaign) |

### Backlog Details

#### M1 - Modernize the retained state-changing sample scripts

Origin: bfb0dc71 / M1
Identity History: none
GitHub Issue: none
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

Title: none
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: not created

#### M2 - Mail delivery for the alert checks

Origin: bfb0dc71 / M2
Identity History: none
GitHub Issue: none
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

Title: none
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: not created

#### M3 - Verify the proxy to an external Archiver Appliance

Origin: bfb0dc71 / M3
Identity History: none
GitHub Issue: none
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

Title: none
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: not created

#### M4 - Appliance status as PVA PVs

Origin: bfb0dc71 / M4
Identity History: none
GitHub Issue: none
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

Title: none
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: not created

#### M5 - Analyzer phase A: page, header and address

Origin: bfb0dc71 / M5
Identity History: none
GitHub Issue: #39 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/39)
Status: Not started

##### Summary

The analyzer is the viewer of the retrieval web application (`archViewer.html`, `viewer.js`, `viewer.css`) with few drawing options and no analysis tool. Its menu entry `analyzer.html` forwards to it (`js/analyzer-forward.js`), it carries no site header, logo or menu, and it reads only `pv`, `from` and `to` from its address. The Browse PVs page of M58 (previous document, commit bfb0dc71) opens it and the chart component of M59 (previous document, commit bfb0dc71) draws the simple form; this phase gives the analyzer the site header, logo, menu and time zone choice of the console while it stays an independent service, the page composition the owner approves, and an address that carries the options of the page that opened it; the gestures and options beyond the simple form are phase B (M11) and the analysis tabs are phases C to E. Its input for plotting an archived PV, **Add**, can be taken for starting archiving.

##### Scope

Phase A of `docs/design-analyzer.md` (D5): the analyzer as a page of the console's family, with nothing of the analysis yet.

- The page composition, decided from a clickable mockup the owner reviews: the selection and the range strip at the top, tabs by kind of analysis in the middle (Trend, Distribution, Correlation, Dependency, Spectrum, Compare, Waveform, Image; a tab is enabled by the kind of the chosen signals), a drawer with the tabs Signals, Axes, Options, Data and Export, and the place of the range strip and the options (design, Page composition).
- The independent service with the header of the console: the site header and logo, the same menu as the console pages whose items navigate to the console pages at `mgmtURL`, the time zone choice of M67 (previous document, commit bfb0dc71) (its step 5 moves here), the Analyzer entry marked on both sides; the retrieval `BPLServlet` registers the management's `GetApplianceInfo` action so the page reads `mgmtURL` from its own origin; the marker blocks of the header on the page and the static check covering it; the input for plotting a PV named for what it does (design, Page and header; decisions D1, D2, D6 of the design document).
- The Trend tab drawn through the chart component in the simple form, with the drawer's Signals, Axes and Options tabs holding what the component has (one axis per unit, the legend, the Chart options), the Data tab with the table of statistics the component has, and the Export tab with Copy link and the CSV of the viewer as they are; the viewer's one chart per unit becomes the split option of phase B.
- The address: `pv`, `from`, `to`, `tz`, `view` (the tab), and the options the component has (`shape`, `yscale`, `marks`, `avg`, `band`, `window`, `yproj`, `yrange`), read on opening, written back as the page changes, unknown names and unreadable values ignored; the control of the Browse PVs page adds the options chosen on the page to the address it opens (design, Address; decisions of 2026-10-14 and D3 of the design document).
- The book: `interface.md` and `operating.md` for the page as it is after this phase; `MgmtPageLinksTest` for the page and the entry.

Out of scope: the gestures and options beyond the simple form, the Data table of samples and the full Export tab (M11, phase B); the analysis tabs (M6, M12, M7); the Browse PVs panels, which stay (D4 of the design).

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
- Decision Date 2026-10-14: the options pass as one named parameter per option in the query string of the analyzer's address (`?`, where the viewer reads `pv`, `from` and `to` today), so that an address can be read and edited by hand; M5 lists the names.
- Decision Date 2026-10-14: Open in the analyzer passes the PVs, the time window and the options the user chose; an option left at its default is not passed and the analyzer applies its own default.
- Decision Date 2026-10-14: Open in the analyzer carries the options chosen on the page as well as the PVs and the time window, so that the analyzer shows the picture the user was looking at; M5 gives the analyzer the parameters to read them.
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
Observed State: OPEN
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-26 11:02 PDT; `gh issue edit 39` replaced the body (the Current State names the release 2026-10 and not a deleted branch), read back OPEN

#### M6 - Analyzer phase C: tools for one signal

Origin: bfb0dc71 / M6
Identity History: none
GitHub Issue: #39 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/39)
Status: Not started

##### Summary

The Browse PVs page shows a distribution, a scatter plot of two PVs and a statistics table for the PVs of one chart (`plots.js`), and the viewer none. The scatter plot pairs only samples at exactly equal times, so raw samples of two records rarely pair, and it offers only a PV of the same unit at a fixed 150 px height. The bundled D3 has no correlation, regression, fit, FFT or principal component analysis. The analysis of one numeric signal and the comparison of two ranges are built in this phase on the page of phases A and B (M5, M11), from what the D3 bundle provides and from routines the page writes; two and several signals are phase D (M12).

##### Scope

Phase C of `docs/design-analyzer.md` (D5): the tools of one numeric signal and the comparison of two ranges, in the Distribution, Compare and Spectrum tabs of the page of phases A and B (design, Tools by kind of signal; Analysis functions).

- Distribution tab: the summary (samples, minimum, maximum, mean, median, standard deviation, skewness, kurtosis, the errors of the mean and of the standard deviation, quantiles, lost events); the histogram with the `bin` threshold rules, the box plot, a kernel density estimate; the statistics box and, when a fit of phase D exists, the fit box; the pattern by hour and weekday (`rollup`) and a time-value heatmap for a long span; the values beyond k standard deviations.
- Trend tab additions: the variation (running average, standard deviation band, rate of change), a slow trend (a linear fit against time), the limits of the PV (display, warning and alarm) as reference lines with the time outside them, a threshold line typed by the user with the time beyond it.
- Compare tab: two time ranges of one signal, or two signals, side by side with their ranges linked, the distributions drawn over one another and normalised, the difference of the means and of the spreads, and the tests (chi-square, Kolmogorov-Smirnov, Anderson-Darling).
- Spectrum tab: the FFT after resampling to an even interval (radix 2 with zero padding, or Bluestein), the window functions, the power spectral density, the peak frequency with its width, the spectrogram over time, the autocorrelation; the sampling frequency typed or read from a companion PV for a waveform.
- The routines the page writes for these: moments, moving statistics, the tests, the FFT, the kernel density estimate; each checked on signals of known parameters made with the `random*` generators.
- The address names of the tabs' options; the fixture records the checks need (a signal with a known distribution and a known period); the book.

Out of scope: two and several signals, fits, derived signals (M12); waveforms and images (M7); state and string signals (after the numeric tools).

##### Completion Criteria

- Each tool of the Scope is available in its tab and is observed on archived fixture data.
- The moments, the tests, the spectrum peak and the autocorrelation return the known parameters of a signal made for the check within the stated tolerance; a time series is resampled to an even interval before an FFT.
- The Compare tab shows two ranges with their ranges linked and reports the tests with their statistics.
- The default suite passes and the book describes the tools.

##### Dependencies And Decisions

- M11: the page with its gestures, options, Data and Export tabs, which the tools extend.
- D2: the analyzer as a self-contained analysis tool built with the bundled D3.
- The decisions of M59 (previous document, commit bfb0dc71) on the bundled D3 (its functions are used wherever it has one), on the analyzer as a general signal analysis tool, and on no external library bind this work; the page writes only what the bundle lacks.
- D5 (Decision Date 2026-10-19): phase C of the analyzer, planned from `docs/design-analyzer.md`; the tools of two and several signals, the fits and the derived signals are phase D (M12).
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
Observed State: OPEN
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-26 11:02 PDT; `gh issue edit 39` replaced the body (the Current State names the release 2026-10 and not a deleted branch), read back OPEN

#### M7 - Analyzer phase E: waveform and image analysis

Origin: bfb0dc71 / M7
Identity History: none
GitHub Issue: #39 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/39)
Status: Not started

##### Summary

The appliance stores an array PV as a waveform (`DBR_WAVEFORM_*`, or `DBR_V4_GENERIC_BYTES` for a PVA structure); it holds no image size, and the data viewer draws a waveform as a time series of its elements. The camera IOC of the site serves row and column profiles of 1920 and 1200 elements, time-series arrays of 2048 points, a histogram of 256 bins and the statistics of up to four regions of interest, and a frame of 1920 by 1200 sixteen-bit pixels at up to 50 Hz. The analysis of arrays and images is built in this phase on the page of phases A and B (M5, M11) and on the tools of phases C and D (M6, M12).

##### Scope

The analysis of waveforms and images in the analyzer.

- One waveform (an array PV): the array at a time, X as the element number or from a companion axis PV; several times overlaid, and the time against the element number as a heatmap; summary values of each array (maximum and its position, minimum, mean, RMS, sum, centre, FWHM) and their time series; the difference from a reference time; the spectrum by FFT with the sampling frequency given by the user or a companion PV, a window function and the peak frequency; a peak search with the position, height and width of each peak, and a background estimated and subtracted.
- An image (a waveform whose element count is width times height, the size given by the user or companion PVs): one frame as a heatmap on a canvas with a colour scale and iso-lines; a rectangle of interest chosen with the mouse; the X and Y projections; the centroid, the peak position, the total intensity and the size by a Gaussian fit in each direction; those values as time series; a background subtraction and the difference of two frames.
- Settled on 2026-10-14 on the recommendation the owner accepted:
  - A waveform: the X axis is the element number, or the array of a companion axis PV when the user names one; the length and the rate are read from `getPVTypeInfo` (the element count and the event rate). The camera IOC of the site, read for this plan, serves row and column profiles of 1920 and 1200 elements, time-series arrays of 2048 points, a histogram of 256 bins and the statistics of up to four regions of interest, so the analysis is built for arrays of that size first.
  - An image: the width and the height come from the companion PVs of the same array plugin (`ArraySize0_RBV` and `ArraySize1_RBV`, with `NDimensions_RBV`, `DataType_RBV` and `ColorMode_RBV`), and the user types them when those are not archived. The camera IOC of the site serves a frame of 1920 by 1200 sixteen-bit pixels (2304000 elements) at up to 50 Hz, so the archived data is expected to be the regional statistics and profiles, and a whole frame is read one at a time.

Out of scope: the page, drawing options and address of the analyzer (M5); the tools for numeric signals (M6); what the site archives of a camera, which the settings of the archiver decide.

##### Completion Criteria

- A waveform is drawn at a time, overlaid and as a heatmap over time; its summary values, their time series, its difference from a reference time and its spectrum are shown.
- An image of a known size is drawn as a heatmap with a colour scale, its region of interest chosen with the mouse, its projections and its centroid, peak, total and Gaussian size computed, and a frame is read one at a time.
- The values agree with the same arrays computed outside the page.
- The default suite passes and the book describes the tools.

##### Dependencies And Decisions

- M12 and M6: the numeric tools (fits, FFT, statistics) that arrays and images use.
- M5 and M11: the analyzer page, its gestures, options and address.
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
Observed State: OPEN
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-26 11:02 PDT; `gh issue edit 39` replaced the body (the Current State names the release 2026-10 and not a deleted branch), read back OPEN

#### M8 - Integrated 24-hour ETL, journal and sample-buffer verification

Origin: bfb0dc71 / M8
Identity History: none
GitHub Issue: none
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

Title: none
Labels: none
GitHub Milestone: none
Observed State: none
Observed Labels: none
Observed Milestone: none
Last Compared: not created

#### M9 - PVA PVs keep the unit, precision, limits and host in their configuration

Origin: bfb0dc71 / M9
Identity History: none
GitHub Issue: #41 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/41)
Status: Not started

##### Summary

The appliance archives a PV through PV Access without its unit, precision, limits and host. On a local appliance with one `softIocPVX` serving the same records over both protocols, the `pva://` PV of a record that sets `EGU` to `mm` reports no `units` and no `hostName`, `precision` 0.0 and all display, warning and alarm limits 0.0 in `getPVTypeInfo`, where the Channel Access PV of an equivalent record reports `units` `mm`, the host, `precision` 3.0 and NaN for the warning and alarm limits that are not set. `EPICS_V3_PV.updateTotalMetaInfo` fills `MetaInfo` from a control request; `EPICS_V4_PV.updateTotalMetaInfo` has an empty body, and its host name is never assigned. The source provides the values (`pvxget` returns `display.units`, the display limits and the precision).

##### Scope

Fill `MetaInfo` of a PV Access PV from the `display`, `control` and `valueAlarm` members of its structure and set its host name when the channel connects, so that the configuration of a PV is the same for both protocols.

Out of scope: how the consoles read a missing value (M58 (previous document, commit bfb0dc71)); the `meta` of the retrieval response of a PV Access PV, which is not examined here.

##### Completion Criteria

- `getPVTypeInfo` of a `pva://` PV of a record that sets `EGU`, `PREC` and limits reports the same `units`, `precision` and limits as the Channel Access PV of the same record, and the warning and alarm limits that the record does not set are NaN for both protocols.
- `getPVDetails` of the PV Access PV shows the unit and the precision, and `hostName` is set.
- An integration test archives one record over each protocol and compares the fields; the default suite passes.

##### Dependencies And Decisions

- Origin: recorded on 2026-10-15 at the owner's direction, from the observation made while checking the Details window of the Browse PVs page (M58 (previous document, commit bfb0dc71)).
- M58 (previous document, commit bfb0dc71) reads a value that the calls do not hold as "not provided" and does not wait for this item; M4 archives PVA PVs through `pva://` and benefits from it.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. Fill `MetaInfo` in `EPICS_V4_PV` from the structure and assign the host name; the test of T1 first. Closes with T1 and T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Integration | On a running appliance with one `softIocPVX` serving `src/resources/test/ConsoleChartPVs.db`, archive `SR:BPM:01:X` through `pva://` and `SR:BPM:02:X` over Channel Access and compare `getPVTypeInfo` and `getPVDetails` of the two | JDK 21, Tomcat 9, EPICS 7.0.10 | The units, precision, limits and host name are present and equal for both protocols |
| T2 | Suite | ./mvnw -B -ntp clean verify; Maven and Pages workflows | JDK 21; GitHub Actions | Pass |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | JDK 21, Tomcat 9, EPICS 7.0.10 | Pending | none |
| T2 | Not run | JDK 21; GitHub Actions | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: PV Access PVs are archived without unit, precision, limits and host
Labels: bug
GitHub Milestone: none
Observed State: OPEN
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-26 11:02 PDT; `gh issue edit 41` replaced the body (the Acceptance Criteria are checkboxes, all open), read back OPEN

#### M10 - Archiving continues across a change of the record

Origin: bfb0dc71 / M10
Identity History: none
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

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Engine and stores | The five checks of M73 (previous document, commit bfb0dc71) (`work/exp/m73/run_all.sh`) on the one IOC and the one appliance of D3, read for continuity instead of for loss | Packaged WARs, the IOC of D3 | Every change is followed; a window across the change holds both sides |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | Not run | Packaged WARs, the IOC of D3 | Pending | none |

##### Closure Evidence

- none

##### GitHub Projection

Title: Archiving continues across a change of the record

Body: The engine detects a change of an archived record but stops at counting, so a change on the IOC side ends the recording of the signal until an operator acts. Observed on a local appliance with a soft IOC: a record that posts faster than the rate estimated at the archive request loses most events to a sample buffer of 11 (58 samples and 445 lost in 46 s at 10 Hz); a changed unit, precision or limit reaches the archiver only through the property subscription or at a reconnect, and the display limits are never read again; a record that comes back under the same name with another type has every event dropped and counted while the type information keeps the old type; the way out, pause, `changeTypeForPV`, resume, converts the history (a double 0.0057 becomes the integer 0) and answers HTTP 500 for a string or a waveform (`UnsupportedOperationException` in `ThruNumberAndStringConversion`). The archiver should keep the signal without a gap: detect the change and go on storing under the new condition from the instant of the change, with the earlier samples readable as they were stored, which needs a type boundary on the time axis of a PV that the stores and the retrieval know. Planned for the next major release; in the current release the engine logs the change and pauses a PV whose type changed.

Labels: enhancement
GitHub Milestone: none
Observed State: OPEN
Observed Labels: enhancement
Observed Assignee: jeonghanlee
Last Compared: 2026-10-26 11:02 PDT; `gh issue edit 48` replaced the body (the Acceptance Criteria are checkboxes, all open), read back OPEN

#### M11 - Analyzer phase B: interaction, options and export

Origin: bfb0dc71 / M11
Identity History: none
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

Out of scope: the analysis tabs (M6, M12, M7); the Browse PVs page.

##### Completion Criteria

- Each gesture and option of the Scope is observed on archived fixture data with mouse, keyboard and touch, and a range change reads the data once after the gesture ends.
- The Data tab lists the samples in view and the Export tab produces each product of the Scope; a CSV of N bins carries minimum, mean and maximum per bin; the exported values equal the retrieval's for the same range and operator.
- Every option is in the address, and an address with the options of phase A alone opens as before.
- The default suite passes and the book describes the controls.

##### Dependencies And Decisions

- M5: the page, the drawer and the address of phase A.
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
Observed State: OPEN
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-26 11:02 PDT; `gh issue edit 39` replaced the body (the Current State names the release 2026-10 and not a deleted branch), read back OPEN; a box per phase is added to its body when the phase plans are accepted (D5).

#### M12 - Analyzer phase D: tools for two and several signals

Origin: bfb0dc71 / M12
Identity History: none
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

Out of scope: one signal and the comparison (M6); waveforms and images (M7); a vendored library for LOESS or a non-linear fit, and a typed formula as a fit model beyond the expression parser (open items of M6's decisions, settled before this plan is accepted).

##### Completion Criteria

- Each tool of the Scope is available in its tab and is observed on archived fixture data; a pair of different rates shows the number of pairs and of samples of the slower signal.
- A fit of each model, a correlation, a regression and a principal component analysis return the known parameters of signals made for the check within the stated tolerance; the fit panel fixes and bounds a parameter.
- The Dependency tab takes up to twenty signals; the matrix is symmetric with ones on its diagonal and its order follows the clustering.
- The default suite passes and the book describes the tools.

##### Dependencies And Decisions

- M6: the tools of one signal and the routines it writes (moments, tests, FFT), which the fits and the dependency tools use.
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
Observed State: OPEN
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-26 11:02 PDT; `gh issue edit 39` replaced the body (the Current State names the release 2026-10 and not a deleted branch), read back OPEN; a box per phase is added to its body when the phase plans are accepted (D5).

#### M13 - Delete the moved partition of a zip store that is an ETL source

Origin: bfb0dc71 / M13
Identity History: none
GitHub Issue: #52 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/52)
Status: Not started

##### Summary

A `pb` store with `compress=ZIP_PER_PV` that is the source of an ETL move keeps the partition it moved: `getETLStreams` keys each `ETLInfo` with `path.toAbsolutePath().toString()`, which for a path inside the zip file system is the entry's path without the `jar:` prefix; `markForDeletion` resolves that key on the local file system, finds nothing and ignores the `NoSuchFileException` by design, so the entry stays and the samples exist twice. `getETLStreamsForDeletion` keys its rows in the `jar:` form, so the explicit deletion works. Observed on 2026-10-19 with the shipped `ETLJob` over STS HOUR to a zip MTS HOUR with `pp=mean_60` to LTS YEAR: the LTS held the data and the archive still held both `.pb` and both `.mean_60` entries. A zip store is meant as the last store of a chain, where no move starts, so the shipped configurations do not reach this (D6).

##### Scope

- `getETLStreams` keys the `ETLInfo` of a zip path in the `jar:` form through the same helper as `getETLStreamsForDeletion`, so `markForDeletion` deletes the moved entry and its post-processor entries.
- A test over two hops with a zip MTS, which keeps the moved partition today, passes.

Out of scope: the uncompressed store (M80 (previous document, commit bfb0dc71)); where a zip store may sit in a chain (the book says the last store).

##### Completion Criteria

- After a move out of a zip store the archive no longer holds the `.pb` entry of the moved partition nor its post-processor entries, and the next store holds the data once.
- The explicit deletion of a PV from a zip store keeps working.
- The default suite passes.

##### Dependencies And Decisions

- D6 (Decision Date 2026-10-19): left to the Backlog for a later release; found by the check of M80 (previous document, commit bfb0dc71).

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. The key of `getETLStreams` through the shared helper. Check: T1.
2. The two-hop case with a zip MTS added to `PlainPBPostProcessorCleanupTest`. Check: T1.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit and suite | `PlainPBPostProcessorCleanupTest` with the two hops over a zip MTS; `./mvnw -B -ntp clean verify` | JDK 21, Tomcat 9.0.121 for the integration tests | After the second hop the archive holds only the entries of the newer partition; suite passes |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | pending | | | |

##### Closure Evidence

- none

##### GitHub Projection

Title: A zip store as an ETL source keeps the partition it moved
Labels: bug
GitHub Milestone: none
Observed State: OPEN
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-19 17:50 PDT; `gh issue list` read #52 OPEN with label bug and assignee jeonghanlee at its creation (2026-10-20T00:50:06Z).

#### M14 - Bound the concurrent calls of the PVAccess retrieval service

Origin: bfb0dc71 / M14
Identity History: none
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
Observed State: OPEN
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-26 11:02 PDT; filed from the draft body with `gh issue create`, read back OPEN with label enhancement and assignee jeonghanlee

#### M15 - Verify signal storage and important-signal delivery under client overload

Origin: bfb0dc71 / M15
Identity History: none
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
- Related evidence: M85 (previous document, commit bfb0dc71) request-protection measurements and M14 concurrency planning. No execution dependency is assigned by this record.
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
Observed State: OPEN
Observed Labels: enhancement
Observed Milestone: none
Observed Assignee: jeonghanlee
Last Compared: 2026-10-23T06:26:19.445179+00:00; issue #55 read back with exact draft-body equality; remote updatedAt 2026-10-23T06:25:39Z.

#### M16 - Measure the thread and valve limits and the remaining qualification cells of the retrieval protection

Origin: bfb0dc71 / M16
Identity History: none
GitHub Issue: #58 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/58)
Status: Not started

##### Summary

The retrieval memory protection of M85 (previous document, commit bfb0dc71) passed its functional checks on HTTP and PVAccess at 512 MiB, 2 GiB and 4 GiB under G1 with no OutOfMemoryError or JVM exit. Two groups of measurements remain. First, the thread and valve limits: the retrieval `SemaphoreValve` concurrency 100 and the connector `maxThreads` (Tomcat's default 200 in the deployment template, 40 in the development launcher) are not derived from a measurement; every busy-thread maximum recorded so far (4 in the whole integration set, 13 for fifteen console pages with their static files, 8 and 12 for eight and twelve overlapping heavy retrievals, 9 for the snapshot worker cases, 3 for the admission tests) equals the number of requests the test sent, no run combined console and heavy retrievals, and no run drove the concurrency to saturation or to a valve refusal at the default. Second, the qualification cells the plan of M85 (previous document, commit bfb0dc71) named and the runs did not cover: the Serial collector; Parallel and generational Z at 2 GiB and 4 GiB; pressure after the response is committed; overshoot above the pressure threshold and headroom to the heap maximum at the shipped defaults; memory admission of a held summary (`mean_1`) pair at 2 GiB and 4 GiB, which needs a hold at the transport stage because the file read hold keeps 129 bytes per record against about 900 when the answer is built.

##### Scope

- A long-running measurement that sends console and heavy retrieval requests together and raises the concurrency step by step, recording busy threads, response times, memory decisions and valve refusals at each step, on 512 MiB and 2 GiB heaps, under the deployment `maxThreads` and under 40.
- The valve default decided from that table by a stated rule and recorded in the register, the book (installing page) and `TESTING.md`, with a test that runs at the chosen default rather than at a lowered threshold.
- Each qualification cell above measured and recorded, or recorded as not measured with the reason; the summary-pair admission needs a transport-stage hold in the test, for example a forwarding proxy that stops delivering the server's answer.

Out of scope: bounding the number of concurrent PVAccess calls (M14); changing the memory thresholds without a measurement that motivates it; the cause of the 31 MB baseline difference between 2026-10-22 and 2026-10-24.

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
Observed State: OPEN (2026-10-24 19:57 UTC)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-26 11:02 PDT; `gh issue edit 58` replaced the body (the Acceptance Criteria are checkboxes, all open), read back OPEN

#### M17 - Decide the stamping and filtering rule of summary bins at the window edges

Origin: bfb0dc71 / M17
Identity History: none
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
Observed State: OPEN (2026-10-24 19:57 UTC)
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-26 11:02 PDT; `gh issue edit 59` replaced the body (the Acceptance Criteria are checkboxes, all open), read back OPEN

#### M18 - Let a type change to a string or a waveform type succeed

Origin: bfb0dc71 / M18
Identity History: none
GitHub Issue: #45 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/45)
Status: Not started

##### Summary

`changeTypeForPV` cannot change a numeric PV to a string or to a waveform type: it answers HTTP 500, leaves the PV paused with its old type, and a PV resumed without the change goes on dropping every event of the new type, so the signal stops being recorded until the operator deletes the PV and archives it again. Observed on 2026-10-17 and 2026-10-18 on the soft IOC of `src/resources/test/st.cmd` restarted with `RECORD_CHANGE=Types` (filed as a deviation of M73 (previous document, commit bfb0dc71)). `ChangeTypeForPV` converts the stored history through `etl/conversion/ThruNumberAndStringConversion.java`, whose sample conversion supports the numeric scalar types only; the `DBR_SCALAR_STRING` branch calls `getStringValue(0)` on a numeric sample and the `default` branch throws `UnsupportedOperationException` for every other target.

##### Scope

- The type change succeeds for every target type. Where the stored history cannot be converted into the new type (a number into a string, a scalar into a waveform), the history stays as it is under the old type and the new type starts from the instant of the change; where a conversion is defined (number to number), it is kept.
- The call reports its result in its JSON answer and in the engine log.

Out of scope: an automatic type change by the engine without an operator call; the console page that offers the change.

##### Completion Criteria

- `changeTypeForPV` to `DBR_SCALAR_STRING` and to `DBR_WAVEFORM_DOUBLE` on a PV archived as `DBR_SCALAR_DOUBLE` returns HTTP 200, the PV resumes as Being archived with the new type in `getPVTypeInfo`, and the dropped-events count stops growing.
- The samples stored before the change stay readable through `getData`, and a window across the change returns both the earlier and the later samples.
- The record-change checks on the soft IOC with `RECORD_CHANGE=Types` pass for all four records.

##### Dependencies And Decisions

- D9 (Decision Date 2026-10-24): worked after the release.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. `ChangeTypeForPV` keeps the history under the old type when no conversion is defined and starts the new type at the change, instead of converting or failing. Check: T1, T2.
2. The JSON answer and the engine log carry the result. Check: T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit | `ChangeTypeForPV` with a numeric history and each target type | JDK 21 | Numeric targets convert as before; string and waveform targets keep the history and start the new type; no exception |
| T2 | Integration | The record-change checks with `RECORD_CHANGE=Types` on the soft IOC, both calls, resume, retrieval across the change | JDK 21, Tomcat 9.0.121, `softIocPVX` | HTTP 200, new type in `getPVTypeInfo`, dropped-events count constant, earlier and later samples returned |

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
Observed State: OPEN (2026-10-24)
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-26 11:02 PDT; `gh issue edit 45` replaced the body (the Acceptance Criteria are checkboxes, all open), read back OPEN

#### M19 - Carry the changed limits of a record into the type information at reconnect

Origin: bfb0dc71 / M19
Identity History: none
GitHub Issue: #47 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/47)
Status: Not started

##### Summary

When a PV reconnects, the engine reads the unit and the precision of its record again but keeps the display, warning, alarm and control limits that it stored at the archive request, so after the limits of a record change and the IOC restarts, `getPVTypeInfo` and the Details window of the Browse PVs page keep the old limits while the IOC reports the new ones. Observed on 2026-10-17 and 2026-10-18 on the soft IOC of `src/resources/test/st.cmd` (filed as a deviation of M73 (previous document, commit bfb0dc71)). `MetaInfo.updateTypeInfo` in `src/main/org/epics/archiverappliance/config/MetaInfo.java` compares and writes only the unit, the precision and the host name; the limits that `applyBasicInfo` reads from the control DBR on every connection are never carried into the stored type information after the first time.

##### Scope

- `MetaInfo.updateTypeInfo` compares the display, warning, alarm and control limits of the connection with the stored type information and writes them when they differ, under the same rate limit as the unit and the precision, with one INFO line in the engine log naming the PV and the fields that changed.

Out of scope: a change of the limits while the channel stays connected and the property subscription is off; the fields carried in the samples by the property subscription.

##### Completion Criteria

- After an IOC restart with changed `HOPR`, `LOPR`, `HIGH` and `LOW`, `getPVTypeInfo` of the PV holds the new limits within one reconnect, and the Details window shows them.
- The unit and the precision keep being updated as before.
- The suite passes, including a test that reconnects a PV with changed limits.

##### Dependencies And Decisions

- D9 (Decision Date 2026-10-24): worked after the release.

##### Implementation Plan

Plan Status: draft
Plan Acceptance: none
Implementation Authorization: none
Superseded Plan Artifacts: none

1. `MetaInfo.updateTypeInfo` compares and writes the limits with the unit and the precision, and logs the changed fields. Check: T1, T2.

##### Test Plan

| Label | Layer | Method | Environment | Expected Result |
| --- | --- | --- | --- | --- |
| T1 | Unit | `MetaInfo.updateTypeInfo` with a connection whose limits differ from the stored type information | JDK 21 | The limits are written, the unit and the precision as before, one log line names the fields |
| T2 | Integration | A PV archived from the soft IOC, the IOC restarted with changed `HOPR`, `LOPR`, `HIGH` and `LOW`, `getPVTypeInfo` after the reconnect | JDK 21, Tomcat 9.0.121, `softIocPVX` | The new limits within one reconnect |

##### Verification Results

| Label | Observed At | Environment | Result | Evidence |
| --- | --- | --- | --- | --- |
| T1 | pending | | | |
| T2 | pending | | | |

##### Closure Evidence

- none

##### GitHub Projection

Title: Display limits not read again at reconnect
Labels: bug
GitHub Milestone: none
Observed State: OPEN (2026-10-24)
Observed Labels: bug
Observed Milestone: none
Last Compared: 2026-10-26 11:02 PDT; `gh issue edit 47` replaced the body (the Acceptance Criteria are checkboxes, all open), read back OPEN

#### M20 - Check the retrieval operators outside the declared-size check

Origin: bfb0dc71 / M20
Identity History: none
GitHub Issue: #60 (https://github.com/jeonghanlee/epicsarchiverap-maven/issues/60)
Status: Not started

##### Summary

The audit of the retrieval protection (M85 (previous document, commit bfb0dc71) / T2, 2026-10-21) classified candidates as hypotheses with a next check; the fill operators of its `Event per bin` row were checked and corrected (a27f260a), and the others neither ran nor were carried to a later row until D10; the fifth candidate below, the PVAccess name list, comes from the sweep of 2026-10-24. The declared-size estimate of `RetrievalMemoryProtection.Request.admit` covers `Optimized`, `OptimizedWithLastSample`, the `SummaryStatsPostProcessor` subclasses, `CAPlotBinning`, `FirstFill`, `LastFill` and `LastSample`; the in-flight check runs where `checkCurrent` is called (`MergeDedupConsumer`, `PvaMergeDedupConsumer`, `SummaryStatsCollectorEventStream`, `FillsCollectorEventStream`, `CAPlotBinning`, `OptimizedWithLastSample`, `GetDataAtTime`, and `DataRetrievalServlet` once before and once after it handles a request, lines 276 to 310). Outside both, read in the code on 2026-10-24 and not run: `FirstSamplePP`, `DeadBand`, `Fliers` and `IgnoreFliers` copy the events of their source streams into an `ArrayListEventStream` inside their own `wrap` loops (`FirstSamplePP.java:64-77`, `DeadBand.java:72-130`, `Fliers.java:66-76`, `IgnoreFliers.java:75-85`); `Median`, `Kurtosis` and `Skewness` keep every value of a bin in a `DescriptiveStatistics` while a scalar summary bin is counted at `scalarBinBytes`, 112 bytes by default; `getDataForPVs` (`DataRetrievalServlet.java:756`), `getDataAtTime`, `getDataAtTimeForAppliance` and the PVAccess call (`PvaGetPVData.java:452`) take a list of names with no limit found, while the declared sizes of one request add up in its single budget and a raw read declares nothing. `Nth` and `NCount` are bounded by `MAX_COUNT` (`Nth.java:31`), recorded as CD-18.

##### Scope

- Run each candidate as a real request through a built appliance at a 512 MiB heap, started through `RetrievalMemoryNetworkFixture` (heap from `archappl.memory.test.heap`, default 512m; a generated 1 Hz store of `MemoryQualification:SineV1` over 30 days; the Memory admission tests paragraph of `TESTING.md` describes it): `median_3600` over 30 days next to `mean_3600`; `firstSample`, `deadBand`, `flyers` and `ignoreflyers` over the raw range of one PV (the operator names are case sensitive, and a name that matches no operator is refused as unknown, which is not a result for the candidate); `getDataForPVs` with many `pv` parameters; `getDataAtTime` with a list of 10,000 names; the PVAccess call with a long list. Record the status, the memory after collection and whether the JVM stayed alive.
- For a candidate that exhausts the heap or ends the JVM, extend the declared-size estimate or add the in-loop check at the place named above, with a test that fails without it; for one that is refused or completes safely, record it as examined.

Out of scope: the thread and valve limits and the other qualification cells (M16); bounding the concurrent PVAccess calls (M14); a change of the memory thresholds without a measurement that motivates it.

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
Observed State: OPEN (2026-10-24)
Observed Labels: enhancement
Observed Milestone: none
Last Compared: 2026-10-26 11:02 PDT; `gh issue edit 60` replaced the body (the Acceptance Criteria are checkboxes, all open), read back OPEN

#### G1 - Ansible tools ready for the integrated 24-hour campaign

Origin: bfb0dc71 / G1
GitHub Issue: none
Status: Open

##### Summary

ansible-provision reports readiness of the actual collection, comparison and terminal-handling tools needed by M8 after their corrections. The condition is a report for this campaign, not closure of every Ansible follow-up issue. Affects M8.

##### Completion Criteria

- Required corrected tools demonstrate real-path capture, source/process/time selection, final handling and input/output comparison against retained or bounded real observations.
- The report identifies tools, supported scopes and unresolved limitations sufficiently to prepare M8 without treating a collector/evaluator failure as product failure.
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
