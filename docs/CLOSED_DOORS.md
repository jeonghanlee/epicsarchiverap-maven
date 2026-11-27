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

## The precision of a PV whose new record has none - Release Verification 2 of release Ahsoka

One candidate of Release Verification 2 of M21: after `SR:BPM:03:Y` changes from a `calc` record with `PREC` 3 to a
`longin` record, which has no precision, `getPVTypeInfo` reports precision 0 and no longer 3.
Examined state: commit `0d2c83cf`. Decision date: 2026-11-18.

| ID | Candidate | Verdict | Premise | Evidence |
| --- | --- | --- | --- | --- |
| CD-25 | Store precision 0 for a Channel Access type that carries no precision, instead of keeping the earlier value or storing none | Keep | The integer control and graphic types of Channel Access carry no precision, so the IOC sends none for the new record; 0 shows the integer values with no fractional digits, while keeping 3 would report a field of a record that no longer exists, and storing none would change what every reader of `getPVTypeInfo` receives. `updateTypeInfo` stores the value the IOC sends, as M14 decided. | `config/MetaInfo.java` (`applyBasicInfo`: `dbr instanceof PRECISION ? ... : 0`; `updateTypeInfo`); the engine log line `Updating metadata for pv SR:BPM:03:Y: precision=0` of the run on commit `0d2c83cf` |

## The text of a stored metadata number - conceptual-integrity review of release Ahsoka

One candidate of the review of the branch of release Ahsoka: the text of a limit in the metadata of a PV depends on the
path that wrote it and on the type of the record, for example "80.0" from the stored type information and "80" from the
property event of an integer record, and "1.0" or "1" from a double or an integer member of a PVAccess structure.
Examined state: commit `a0c29732`. Decision date: 2026-11-23.

| ID | Candidate | Verdict | Premise | Evidence |
| --- | --- | --- | --- | --- |
| CD-26 | The text of a stored limit differs between the stored type information (`Double.toString`, "80.0"), the property event of an integer Channel Access record ("80") and an integer member of a PVAccess structure ("1") | Keep | Each path writes the number as its own source gives it: the type information holds doubles, a control response holds the number class of its record type, a PVAccess member holds its member type. With the property events on, the fields that a control response carries are not monitored as fields of their own, so a PV has one source for each of them. A change is judged by comparing the text of one property event with the next, and the text of the type information is replaced by the event text when the latest values are combined, so no comparison crosses paths and the same value does not read as a change. Every reader parses the text as a number (`number()` of the Details window, `limitsOf` of the Analyzer), Two of the tests that meet the difference remove a trailing ".0" or accept both texts before they compare, and `FieldValuesCacheTest` pins the text of each member type. Only an external script that compares the text itself would see "80" and "80.0". | `config/MetaInfo.java` (`addToDict`, `controlFieldValues`); `engine/pv/EPICS_V3_PV.java` (`combineLatestMetadata`, `addUpdateChangedDBEPropertyMetaField`); `engine/model/ArchiveChannel.java` (`fieldsAvailableFromDBRControl`); `engine/pv/FieldValuesCache.java`; `mgmt/staticcontent/js/browse/details.js`; `staticcontent/js/aa/trend.js`; `EPICS_V3_PVMetadataTest`, `FieldValuesCacheTest` |

## The colours that stand outside the display profile - conceptual-integrity review of release Ahsoka

One candidate of the review of the branch of release Ahsoka: the display profile (Default, Red-green, Monochrome) gives each plotted line its own colour, dash pattern and marker, while some drawings of the data viewer carry colours that no profile changes, for example the box of an image region (`#ff3b30`), the iso-lines of an image (`#fff`) and the disabled controls of the range strip (`#a9b6ba`).
Examined state: commit `764ac562`. Decision date: 2026-11-24.

| ID | Candidate | Verdict | Premise | Evidence |
| --- | --- | --- | --- | --- |
| CD-27 | Fixed colours in the drawings of the analysis tools against the promise of the display profile | Keep | The profile exists so that a reader who cannot tell colours apart can tell the plotted lines of a chart apart, and the code that applies it is the shared line table (`lineLook`), which the shared chart modules call for the Trend chart of the viewer and for the console charts. Where an analysis drawing holds several lines, the lines differ by dash pattern and not by colour alone: Compare draws A solid and B dashed, the limit lines of the Trend tools have four different dash patterns, and the iso-lines of an image are solid, long-dashed and short-dashed. What stays fixed is a single object with nothing to tell it from (the region box), a colour that carries the time order by lightness (the overlay of waveform frames, the current frame in black), a colour scale of a heat map, whose lightness carries the magnitude (Viridis in Spectrum, Distribution, Correlation and Image, a red-blue scale for a signed image difference and for the correlation matrix of Dependency, a sequential scale for its mutual information matrix), or a disabled control. This was read in the stylesheets and modules; no chart was rendered through a colour-vision simulation. | `retrieval/staticcontent/viewer/viewer.css` (`cmp-trend-*`, `trend-alarm`, `trend-warning`, `trend-display`, `trend-threshold`, `img-iso-*`, `img-region-box`); `staticcontent/css/chart.css` (`strip-tool.dim`); `staticcontent/js/aa/chart/series.js` (`lineLook`) and `profile.js`; `lineLook` is called by `draw.js`, `legend.js`, `projection.js` and `viewer.js` and by no analysis-tool module (`compare.js`, `correlation.js`, `dependency.js`, `distribution.js`, `spectrum.js`, `trend-tools.js`, `waveform.js`, `image.js`) |

## The two gap factors of five - conceptual-integrity review of release Ahsoka

One candidate of the review of the branch of release Ahsoka: the constant `GAP_FACTOR` is 5 in `aa/pairing.js` and in `aa/spectrum.js`, under one name and with no shared definition.
Examined state: commit `e031cd18`. Decision date: 2026-11-26.

| ID | Candidate | Verdict | Premise | Evidence |
| --- | --- | --- | --- | --- |
| CD-28 | `GAP_FACTOR = 5` is defined twice, in the pairing of the Correlation tab and in the preparation of the Spectrum tab | Keep | Each rule has its own base and its own origin. The pairing keeps a value of the other signal while it is not older than five times the median spacing of that signal; the register records this rule as a decision of 2026-11-09, and the reference file checks it against an independent loop. The spectrum calls a spacing a gap when it exceeds five resampling intervals, and the interval is the one typed or, by default, the median spacing; a gap stops the preparation unless the policy interpolates. The base of the first never changes, while the base of the second follows the typed interval, so the same five gives different thresholds. Neither the register nor the commits tie the two values to each other, and one shared constant would make a change of one rule change the other. Each constant builds its own user-visible text, so a change of either value is stated by its own page. | `staticcontent/js/aa/pairing.js` (`GAP_FACTOR`, `pairSeries`); `staticcontent/js/aa/spectrum.js` (`GAP_FACTOR`, `prepareSeries`); `retrieval/staticcontent/viewer/correlation.js` and `viewer/spectrum.js` (the texts built from the constants); commits `0583d3a0` and `c83905f5`; the decision of 2026-11-09 on the gap rule of the pairing in `docs/milestone-bfb0dc71.md` |

## The chart address and the chart widget validate the same settings - conceptual-integrity review of release Ahsoka

One candidate of the review of the branch of release Ahsoka: `aa/chart/state.js`, which reads and writes the chart part of the address, keeps its own copies of the lists and limits that `aa/chart/widget.js` validates too (the tools, the navigation targets, the scales, the legend statistics, the display choices and defaults, the dash names, the axis prefix, the width, the decimals and the length of a name), and nothing compared the two.
Examined state: commit `bd8e8662`. Decision date: 2026-11-26.

| ID | Candidate | Verdict | Premise | Evidence |
| --- | --- | --- | --- | --- |
| CD-29 | The address and the widget validate the same lists and limits in two places, and the two are compared by their declarations and not by running both validators | Keep | The two validators are plain membership and range tests over the same declarations, and the lists and limits agree today. `chart-agreement.test.mjs` reads the declarations of the address from the shipped source and compares them with what the owner modules export and with the declarations of the widget, so a list or limit that drifts in either place fails the routine checks, and it fails also when a declaration is rewritten so that it can no longer be read. Running the validator of the widget as well would need `widget.js` to export it or `createChart` to run without a page, which changes what the widget publishes for a gain that the declaration test already gives. | `staticcontent/js/aa/chart/state.js` (the lists, `TEXT_MOST`, the limits and the prefix of the address); `widget.js` (`DISPLAY_CHOICES`, `DASH_CHOICES`, `PREFIX_CHOICES`, `NAME_MOST`, `signalSettings`, of which only `createChart` is exported); `gestures.js`, `scales.js`, `legend.js` and `draw.js` (the owners of the lists); `src/test/js/analyzer/chart-agreement.test.mjs` |

## The first protection layer cannot be reached by a retrieval request - conceptual-integrity review of release Ahsoka

One candidate of the review of the branch of release Ahsoka: Part B of `RetrievalOutOfMemoryExitTest` was written to show that a retrieval JVM started with `-XX:+ExitOnOutOfMemoryError` and `-XX:+HeapDumpOnOutOfMemoryError` ends and leaves a heap dump when one request exhausts its heap, and it fails.
Examined state: commit `2a4117a9`. Decision date: 2026-11-26.

| ID | Candidate | Verdict | Premise | Evidence |
| --- | --- | --- | --- | --- |
| CD-30 | Part B of the out-of-memory exit test fails because no retrieval request exhausts the heap, and nothing checks the exit of the JVM | Keep | The layers between a request and the heap hold it first. The request budget refuses `optimized_2000000` over 80 days with status 400, because the request declares 957,824,536 bytes against a budget of 107,374,182 on a heap of 512 MiB; the budget and that rule came in the commit that introduced the test. With the byte model of the budget lowered to one byte and the admission and pressure fractions at 0.98 and 0.99, the request passes the budget and the pressure layer stops it at 532,039,496 of 536,870,912 bytes with status 503 and "Retrieval memory pressure", and the settings rule keeps the pressure fraction below one, so configuration cannot take a request further. The JVM options end a JVM that throws an `OutOfMemoryError` from any cause and the book states no more; no Java code of the project is on that path; the options are set by `scripts/run-local-appliance.bash` and the install pages, which Part B never used. Part B is disabled with this reason and Part A, which records the status 400 of each format, stays. The second result was observed on 2026-11-26 by running `./mvnw -o test -Dtest='RetrievalOutOfMemoryExitTest#partBHeapExhaustionWithTheOptionsEndsTheJvm' -Dtest.excludedGroups=` with Part B enabled and `ARCHAPPL_PROPERTIES_FILENAME` set to a copy of `src/sitespecific/tests/classpathfiles/archappl.properties` that adds `org.epics.archiverappliance.retrieval.memory.scalarBinBytes=1`, `vectorBinBytes=1`, `retainedPointBytes=1`, `admissionFraction=0.98` and `pressureFraction=0.99`. | `src/test/org/epics/archiverappliance/retrieval/RetrievalOutOfMemoryExitTest.java` (`partBHeapExhaustionWithTheOptionsEndsTheJvm`, disabled); `src/main/org/epics/archiverappliance/retrieval/RetrievalMemoryProtection.java` (`admit`, `Settings`, `Cancellation`); `docs/book/src/retrieval.md` (the layers that limit a request, the first layer) |

## The decision that a series has no spread - conceptual-integrity review of release Ahsoka

One candidate of the review of the branch of release Ahsoka: after `hasSpread` was introduced for the routines of the Analyzer that divide by a spread, the other places that decide whether all the values of a series are equal were examined for copies of the decision that disagree with it.
Examined state: commit `198ac565`. Decision date: 2026-11-26.

| ID | Candidate | Verdict | Premise | Evidence |
| --- | --- | --- | --- | --- |
| CD-31 | "All the values are equal" is decided in more places than `hasSpread`: `moments` and `silvermanBandwidth` (exact sums), `mutualInformation` and `prepareSeries` (the two ends), `testRefusal` of `compare.js` (the two ends of both datasets together), and in the viewer `analyse` of the Dependency tab and the constant test of the Correlation tab (`d3.extent`) | Keep | Each one answers as `hasSpread` does for every constant it was run on, and each needs the end values or the exact sum for what it does next: the bins of `mutualInformation`, the name of the constant variable in `correlation.js`. `testRefusal` asks another question, whether both datasets are constant together, and stays. `moments` is a variance test made safe by `d3.fsum`, which sums without the error that makes the mean of eight 0.1 differ from 0.1; it is correct only while that summation is kept. `no-spread.test.mjs` runs `moments`, `silvermanBandwidth`, `mutualInformation` and `prepareSeries` on the constants 7, 0.1, 0.3, 0.7, -0.1, 1e9+0.1 and 123.456 together with the routines that use `hasSpread`, and it fails when `moments` sums with a plain loop or when `mutualInformation` or `prepareSeries` decides on a variance; each of the three was observed to fail on 2026-11-26. The Correlation tab was seen on a constant PV of 0.1 ("not defined: X does not vary over the pairs"); the Dependency tab was read and not run, because its `analyse` refuses a flat signal before any routine of the tab is called. | `staticcontent/js/aa/stats.js` (`hasSpread`, `moments`, `silvermanBandwidth`); `dependency.js` (`mutualInformation`); `spectrum.js` (`prepareSeries`); `compare.js` (`testRefusal`); `retrieval/staticcontent/viewer/dependency.js` (`analyse`) and `correlation.js`; `src/test/js/analyzer/no-spread.test.mjs` |

## The fit of values without a usable spread - conceptual-integrity review of release Ahsoka

Three candidates of the review of the branch of release Ahsoka, examined after `rSquaredOf` of `fit.js` was made to ask `hasSpread` first: the other places of `fit.js` that meet a series of equal, huge or nearly equal values.
Examined state: commit `2ec620bf`. Decision date: 2026-11-27.

| ID | Candidate | Verdict | Premise | Evidence |
| --- | --- | --- | --- | --- |
| CD-32 | `guessSine` takes the amplitude of its starting values from a mean-based sum of squares, so for equal values it starts at about 1e-17 or 1e-12 and not at its fallback of 1 | Keep | The starting values are not a decision, and for equal values the start that results is already at the minimum: for a constant of 0.1 the iteration starts at an amplitude of 1.96e-17 and ends after 0 iterations with the offset equal to the value. Starting from `hasSpread` instead (amplitude 1, the value itself as the offset) was run on 600 random constants of magnitudes from 1e-10 up to 1e9: all 600 converged, but the amplitude stayed near 1e-12 after 3 iterations, which is large against a constant of 1e-10, and 467 of the 600 ended with an amplitude of at most a millionth of the value plus 1e-12 and an offset that differs from the value by at most a billionth of it plus 1e-12, against 578 of the 600 for the present start (the counts come from a scratch script that is not kept, and that criterion defines them). The 200 fits of varying data gave the same result before and after. The change was made and withdrawn on 2026-11-27. | `staticcontent/js/aa/fit.js` (`guessSine`, `fitModel`) |
| CD-33 | The R squared of a fit is NaN when the values are of the order of 1e200, because their squares overflow | Keep | The squares overflow where the values pass about 1e154 (the square root of the largest double, 1.34e154), and there the chi-square per degree of freedom and the errors of the same fit are infinite as well (a line through 1e200 and 2e200 alternating over six points: R squared NaN, chi-square per degree of freedom `Infinity`, both errors `Infinity`), so the R squared is not the only quantity of the fit that fails. Values of that size can be archived (the boundary tests of the archiver store values near the largest double), so the Keep rests on the failure of the fit as a whole and not on the absence of such values. Refusing the R squared alone would leave the others and would show "the values do not vary", which is not true of these values; scaling the values would change the fit as a whole. The answer is the same before and after the change of `rSquaredOf`. | `staticcontent/js/aa/fit.js` (`rSquaredOf`, `chiSquare`); `src/test/edu/stanford/slac/archiverappliance/PB/data/BoundaryConditionsSimulationValueGenerator.java` (values near `Double.MAX_VALUE`) |
| CD-34 | The R squared of a fit is -21.67 when the values differ in two units in the last place, for example five 0.1 and one 0.1 + 0.1 * 2^-52, which is two units of the last place above 0.1 | Keep | The values do have spread by the decision of `hasSpread` (the two ends differ), and a fit through them is at the rounding of the numbers: the chi-square per degree of freedom is 6.5e-33 and the offset is 0.10000000000000014, so both the residual and the total sum of squares are rounding error and their ratio is noise, not a wrong decision. A bound under which the spread counts as none would change `hasSpread` for every routine of the Analyzer and contradict the decision on the two exact ends (CD-31). The answer is the same before and after the change of `rSquaredOf`. | `staticcontent/js/aa/fit.js` (`rSquaredOf`); `staticcontent/js/aa/stats.js` (`hasSpread`) |
