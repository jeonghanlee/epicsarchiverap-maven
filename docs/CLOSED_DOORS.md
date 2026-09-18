# Closed Doors

Examined coherence candidates the owner decided to leave unchanged. Each row is
a door opened, checked, and marked closed, so a later sweep does not repeat the
investigation. These are decided-Keep verdicts, not tracked work items. Open
findings live in the milestone register, not here.

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
