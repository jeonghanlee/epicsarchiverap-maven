# Closed Doors

Examined coherence candidates the owner decided to leave unchanged. Each row is
a door opened, checked, and marked closed, so a later sweep does not repeat the
investigation. These are decided-Keep verdicts, not tracked work items. Open
findings live in the milestone register, not here. A row named M6, M51 or M96 in this
file is a row of `docs/milestone-daff1b7.md` at commit bfb0dc71.

Columns: the candidate, the verdict, the premise that makes the divergence
principled, evidence to recheck it, the decision date, and the commit whose
state was examined.

## M6 selective adoption — conceptual-integrity sweep

Sweep of the 19 applied units for code sameness (agreement-points where one
concept is decided in more than one place). Examined state: commit `71d15083`.
Decision date: 2026-09-18.

| ID | Candidate | Verdict | Premise | Evidence |
| --- | --- | --- | --- | --- |
| CD-1 | PB event recovery reaches every parse path (PR520) | Keep | All 15 event classes unmarshal through the one `(short, ByteArray)` constructor, and both the local PlainPB read and the PBOverHTTP read use that same constructor, so `parseWithRecovery` is universal by construction | `PB/data/PBEventRecovery.java`; the 15 `PBScalar*`/`PBVector*`/`PBV4GenericBytes` classes; `PBOverHTTP/InputStreamBackedEventStreamIterator.java:110` |
| CD-2 | Three collector streams signal a year crossing (PR501/PR505) | Keep | `ArrayListCollectorEventStream`, `SummaryStatsCollectorEventStream`, and `FillsCollectorEventStream` all throw `ChangeInYearsException` on the same first-event guard; PR501 closed the gap. Nth/Optimized/OptimizedWithLastSample/CAPlotBinning all wrap consolidated output in the array collector | `retrieval/postprocessors/ArrayListCollectorEventStream.java:72`; `Nth.java:147`; `Optimized.java:127`; `CAPlotBinning.java:306` |
| CD-3 | Forward vs backward end-boundary seek (PR452) | Keep | The `POSITION` enum expresses a real difference: backward `getDataAtTime` seeks past the boundary sample to include it (value-before-window convention), forward range retrieval keeps the prior end position. Principled divergence, not an inconsistency | `PlainPB/FileBackedPBEventStream.java:172,376,414` |
| CD-4 | Crashed PB tail vs backward read (PR521/PR452) | Keep | PR521 physically truncates the partial tail at append time (`fc.truncate`), so the read path never meets it; no read/write seam. `seekToBeforePreviousLine` callers all pass the raw position, matching the function's own newline shaving | `PlainPB/AppendDataStateData.java:351`; `PlainPB/PBFileInfo.java:159,180,185`; `PB/utils/LineByteStream.java:258` |
| CD-5 | Channel-name normalization in bulk pause/resume (PR461) | Keep | Normalize-then-resolve-alias matches the sibling name-resolution sites; the single-PV GET path intentionally stays unnormalized (owner-scoped to the bulk path) | `mgmt/bpl/BulkPauseResumeUtils.java:50`; `mgmt/bpl/ArchivedPVsAction.java:56,62`; `mgmt/bpl/GetPVStatusAction.java:103` |
| CD-6 | Three hands on EPICS_V4_PV (PR360/PR454/PR516) | Keep | The three edits touch orthogonal regions: disconnect idempotency, the conversion error log, and the DBE_ARCHIVE subscribe option. They compose without overlap | `engine/pv/EPICS_V4_PV.java` (disconnect ~404; import/log; `dbeMask` subscribe ~460) |
| CD-7 | FieldValuesCache null filter (PR445 superseded by PR480) | Keep | PR480 centralized the null-value filter in `v3NamedValues`; `getUpdatedFieldValues` and `getCurrentFieldValues` both route through it, leaving no dead per-method guard. A complete Replace | `engine/pv/FieldValuesCache.java:375,443,468` |
| CD-8 | Array-count metadata key rename to EAA_COUNT (PR423) | Keep | The rename is complete: no `NELM` literal remains in the tree, a single writer emits `EAA_COUNT`, and no in-tree reader depends on the key (external API readers only) | `config/MetaInfo.java:715`; no `NELM` in `src/main` or `src/test` |
| CD-9 | Removed startup aggregate loop (PR408) | Keep | The deleted loop was redundant: the TYPEINFO change handler that builds `pvsForThisAppliance` also calls `applianceAggregateInfo.addInfoForPV` in the same block, so the aggregate is populated on the per-PV path | `config/DefaultConfigService.java:872,1824,1839` |
| CD-10 | Two hands on EPICS_V3_PV (PR417/PR425) | Keep | Orthogonal: PR417 lowers post-stop monitor logs to debug, PR425 moves disconnect cleanup into a scheduled task. Log severity vs control flow, no interaction | `engine/pv/EPICS_V3_PV.java` (log levels ~467-896; scheduled cleanup ~565-580) |

## M51 interface leftovers — unreferenced-code survey

Survey of what the interface replacement (d0932d1b) left behind and of every
main class whose simple name appears in no other source, resource, page,
script or the pom. Examined state: commit `0097bc2d`. Decision date:
2026-10-12. Candidates not listed here were removed under issue #34.

| ID | Candidate | Verdict | Premise | Evidence |
| --- | --- | --- | --- | --- |
| CD-11 | mgmt endpoints `getPolicyText`, `getStorageMetrics`, `getStoresForPV`, `reshardPV`, called by the old pages and by no current page | Keep | They are part of the mgmt API that scripts and other clients reach through `/mgmt/bpl/`; `reshardPV` is an operation on stored data. A page not calling an endpoint says nothing about the endpoint's users | `mgmt/BPLServlet.java` registry; `git show d0932d1b^:src/main/org/epics/archiverappliance/mgmt/staticcontent/js/mgmt.js` for the old callers; no `bpl/<name>` in the current `mgmt/staticcontent` |
| CD-12 | PB tools without a shipped script: `ChangePVName`, `SlicePBFile`, `MergePBFile`, `IsSubset`, `PrintFileInfo`, `PrintFirstAndLastTimes`, `PrintPBResponse`, `ReadAsDBRType`, `StatusSeverityCounts` in `PlainPB/utils`, and `utils/imprt/ExportCSV` | Keep | Each is a `main()` tool that runs from the mgmt WAR class path like the four scripted tools; rename, slice, merge, subset and header-less reading have no substitute. They are listed with their arguments in the developer guide's PB files section; a tool a site needs gets a script there. The three tools the scripts replace were removed instead | `docs/book/src/developer.md` (PB files); `install/pbutils/*.sh` for the scripted four |
| CD-13 | `mgmt/pva/package-info.java`, the only `package-info` in a tree that describes packages with `package.html`, and empty | Keep | Filled with the description of the pvAccess management interface (`PvaServlet`, the RPC PV `pvaMgmtService`, `PvaMgmtService` and its actions); it now carries the same kind of text as the `package.html` files | `src/main/org/epics/archiverappliance/mgmt/pva/package-info.java` |

## modernize branch before the merge — conceptual-integrity sweep

Sweep of the whole branch for agreement-points between the code, the book, the
Javadoc and the shipped configuration: store URL keys, `archappl.properties`
keys, environment variables, endpoint registries against the pages, operator
names, PV status strings, page limits, test tags, time constants, ETL margins,
the policy file, the book's table of contents and the log configuration.
Examined state: commit `a1dd96f5`. Decision date: 2026-10-19. The three
divergences found (the plugin Javadoc, the properties table and `docs/README.md`)
were corrected in the same state and are not listed here.

| ID | Candidate | Verdict | Premise | Evidence |
| --- | --- | --- | --- | --- |
| CD-14 | The environment variable `ARCHAPPL_ALL_APPS_ON_ONE_JVM`, read by the code, set by nothing in the tree and absent from the book | Keep | It lowers three Hazelcast thread counts for a deployment that runs the four WARs in one JVM; every deployment of this project runs four Tomcat instances, so the switch has no effect here. Left in place as upstream code, and the book names it as unused so it is not taken for a missing setting | `config/DefaultConfigService.java:424`; `scripts/run-local-appliance.bash` (four instances); `docs/book/src/configuration.md` (Environment variables) |
| CD-15 | The build step `syncStaticContentHeaderFooters` rewrites the `site_header`, `site_logo`, `site_navbar` and `site_footer` blocks of the seven menu pages under `src/main` from `index.html` on every build, so an edit to one page's block is undone by the next build | Keep | The step is the one writer of the four blocks: `index.html` holds them, the other pages receive them, and the `tests` site's `template_changes.html` replaces them the same way. The book names the mechanism and the static checks require the marker blocks on every management page; the tree is clean after a build because the pages already agree | `pom.xml` (execution `syncStaticContentHeaderFooters`, phase `process-classes`); `mgmt/bpl/SyncStaticContentHeadersFooters.java`; `docs/book/src/interface.md` (Files and site skin); `scripts/ui-static-checks.bash`; `src/sitespecific/tests/template_changes.html` |

## modernize branch before the merge to master - second conceptual-integrity sweep

Second sweep of the branch after the retrieval memory protection landed, for
agreement-points between the memory protection code, the book, the registers and
the shipped configuration, and for what the merge ties to the branch name. The
first sweep above had already examined the `archappl.properties` keys, the
environment variables and the endpoint registries; this one found the same
verdicts for them. Examined state: commit `c85c67bb`. Decision date: 2026-10-24.
The divergences found (the branch name in the Pages workflow, the README files
and the book links, and the unused `BPLTaglets` jar) were corrected in the next
state and are not listed here. The two metachannel keys, which the file explained only by a pointer to the code and the book did not name, were described in both in the same state (M96) and are not listed here.

| ID | Candidate | Verdict | Premise | Evidence |
| --- | --- | --- | --- | --- |
| CD-16 | Seven keys of the default `archappl.properties` (`pausePerGroupPVCount`, `pausePerGroupPauseTimeInSeconds`, `archivePVWorkflowBatchSize`, `archivePVWorkflowTickSeconds`, `initialDelayBeforeStartingArchiveRequests`, `defaultAccessProtocol`, `DocumentRoot`) that the code reads and the configuration page does not name | Keep | The page lists the keys the site file sets or carries as a comment with a behavior statement, and says that the file carries further keys as comments, with a description of each; each of the seven has that description in the file. Six have a default in the code; `DocumentRoot` has none, and unset it turns the client configuration calls off with HTTP 404. Naming them in the book would copy the file. | `grep -n "further keys" docs/book/src/configuration.md`; the comments above each key in `src/sitespecific/default/classpathfiles/archappl.properties`; the code defaults at `DefaultConfigService.java:913,914,1332`, `MgmtRuntimeState.java:51,55`, `ArchivePVAction.java:276`; `GetClientConfiguration.java:37` |
| CD-17 | The key `PVTypeInfo.maximumNumberOfLifetimesInInstallation`, present as a comment in the default and the tests `archappl.properties` and read by no code | Keep | Commit d3cbd009 (2015-08-04) removed its reader and deprecated the property; the file labels it as deprecated and keeps the explanation, so an operator who finds it in an older file reads why it has no effect. | `git grep -n maximumNumberOfLifetimes -- src` lists only the two comment lines; `git show d3cbd009` |
| CD-18 | The post-processors `nth` and `ncount` allocate their output buffer from a count the user's argument sets and are not in the declared-size check of the retrieval memory protection | Keep | `Nth` caps its count at `MAX_COUNT` = `Integer.MAX_VALUE/1000` (2,147,483 references, about 8.6 MB) and stops adding at that size, and `NCount` holds one event, so neither grows with the request; the audit of the retrieval protection classes both as no risk. | `Nth.java:31,79-83,123-124`; the audit table of the retrieval protection in the register, row `nth and ncount` |

## retrieval operators and name lists outside the declared-size check - real requests at 512 MiB

Five candidates of the audit of the retrieval protection, which the declared-size estimate does not count, were each
sent as a real request to the built WARs on a server with a 512 MiB heap and one PV of 1 Hz samples over 30 days
(`RetrievalOperatorMemoryNetworkTest` and `pva/PvaOperatorMemoryNetworkTest`). None exhausted the heap: there was no
OutOfMemoryError and no heap dump, and the JVM stayed alive. The verdicts hold for that input; a longer range, several
archived PVs and other formats were not run. The memory values below come from two runs and differ by up to about 15 MB between them. Examined state: commit `cab0ca44`. Decision date: 2026-11-02.

| ID | Candidate | Verdict | Premise | Evidence |
| --- | --- | --- | --- | --- |
| CD-19 | `FirstSamplePP`, `DeadBand`, `Fliers` and `IgnoreFliers` copy the events of their source streams into an `ArrayListEventStream` inside their own wrap loops and are not in the declared-size check of the retrieval memory protection | Keep | `CallableEventStream` wraps every source stream with `RetrievalMemoryProtection.guard`, so the loops read guarded events and the in-loop check compares the memory after collection with its thresholds every 1,024 events. Over the 30 days, `firstSample`, `deadBand` and `flyers` stayed at the baseline of about 117 MB, and `ignoreflyers`, which buffers a bin and the result, was refused with HTTP 503 `Retrieval memory pressure: collection usage 358391600 exceeds threshold 322122547` (the collection usage was 326 to 358 MB in two runs) while the JVM stayed alive. | `CallableEventStream.java:24`; `RetrievalMemoryProtection.java:288-315,372`; `IgnoreFliers.java:77`; the check T1 of the register row of this check |
| CD-20 | The values that `Median`, `Kurtosis` and `Skewness` keep per bin in a `DescriptiveStatistics`, against the 112 bytes per bin that the declared size counts | Keep | The same guard reads the source stream of these operators and checks the live memory every 1,024 events. `median_3600`, `kurtosis_3600` and `skewness_3600` over the 30 days completed at 115 to 120 MB after collection in two runs, like the control `mean_3600` at 119 MB. The 30 days hold about 2.6 million values, about 21 MB as doubles; a range long enough to hold a heap of values was not run. | `CallableEventStream.java:24`; `RetrievalMemoryProtection.java:372`; the check T1 of the register row of this check |
| CD-21 | The number of `pv` parameters of `getDataForPVs` | Keep | The names of a POST travel in the body (`PVsMatchingParameter.getPVNamesFromPostBody`): 10,000 names completed (3,228,220,006 bytes streamed, 138 to 141 MB after collection) and 10,000 distinct names `mean_<n>(name)` completed (4,587,675 bytes, 142 MB). A GET carries them in the request line, which the container limits to 8 KiB (`maxHttpHeaderSize`) and whose parameters beyond 10,000 it ignores (`maxParameterCount`); 246 names completed (79,414,218 bytes, 119 to 130 MB). | `DataRetrievalServlet.java:746-757`; `PVsMatchingParameter.java:195-210`; the check T1 of the register row of this check |
| CD-22 | The names posted to `getDataAtTime` | Keep | 10,000 names completed at 100 to 101 MB (the answer is a map, so the repeated name is one key and the answer has 153 bytes), and 10,000 distinct names that are not archived completed with `{}` at 87 to 88 MB. `getDataAtTimeForAppliance` was not run. | `GetDataAtTime.java`; the check T1 of the register row of this check |
| CD-23 | The `;` separated names of the PVAccess call | Keep | 10,000 names (269,999 characters) completed at 148 to 150 MB and 10,000 distinct names `mean_<n>(name)` (378,893 characters) completed at 153 MB, each with one entry in the answer; the handler builds a context and an executor result for each name. A name that is not archived ends the call at the first such name with a server error that leaves the client call pending. | `PvaGetPVData.java:452,576-600,765-770`; the check T1 of the register row of this check |

## The oversampling note of the Spectrum tab - the interval between half of the median spacing and the median spacing

One candidate of the second-person review of the Spectrum tab: the page warns that the points between samples are made by
the interpolation only when the typed interval is shorter than half of the median spacing (`prepareSeries`, `oversampled`),
while an interval between half of the median spacing and the median spacing also makes points that were not measured.
Examined state: commit `39061b8d`. Decision date: 2026-11-09.

| ID | Candidate | Verdict | Premise | Evidence |
| --- | --- | --- | --- | --- |
| CD-24 | The threshold of the note, half of the median spacing, against any interval shorter than the median spacing | Keep | The note names the frequency above which nothing was measured, half of the sampling frequency of the samples; at an interval between half of the median spacing and the median spacing that frequency is at or above the Nyquist frequency of the resampled series, so the spectrum shows no band that was not measured and the note would warn about nothing on the plot. The interpolation between samples is stated in the preparation line for every interval. The threshold is the value of the accepted plan and the routine checks fix it. | `staticcontent/js/aa/spectrum.js` (`oversampled: interval < median / 2`); `retrieval/staticcontent/viewer/spectrum.js` (the note); `src/test/js/analyzer/spectrum-tab.test.mjs` and the mutation `oversampling threshold moved` of the register row T2-5 |
