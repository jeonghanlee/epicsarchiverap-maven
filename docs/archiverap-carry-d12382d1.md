# Upstream PR Selection: d12382d1

## Scope

Evidence for M6 in `milestone-daff1b7.md`: classify the complete upstream range and score each surviving merge unit for selective adoption into the Maven fork. The canonical milestone owns the implementation plan and status.

**Out of scope:** applying patches, adopting a new build system or servlet platform, and running the full test suite. Owner-confirmed selection is recorded below; implementation remains outside this evidence document.

## Basis and selection rules

- Fork base: `a81b5e46de081fd16093923f7152b659ba8ebc56` (upstream 2.0.10).
- Target fork: `d12382d1cdda77c620b85739c7fc0e5ad2cb7703` (Maven, Java 21, Tomcat 9).
- Upstream snapshot: `f86b5738e308e4482eb6dc8cf7aca852275cfcbc`, committed 2026-09-02; remote HEAD/master verified with `git ls-remote` on 2026-09-16.
- Newer release tags exist, including 2.4.1. D1 and D13 retain independent maintenance and Tomcat 9; this survey adapts the carry procedure to selective fork adoption, not a release bump.
- Governing procedure: EPICS-env `docs/upstream-fix-carry-procedure.md`, adopted 2026-09-16. Owner direction selects merge units and permits five independent reviewers in waves of three and two.
- Enumerate every commit, then group by first-parent integration. Each merge is compared with its first parent; PR #414 is a squash integration. Internal commits are evidence, not separate score rows.
- Remove only changes exclusively to documentation, CI, or tests, judged from the actual diff. Executable tools, formatting, refactors and features remain candidates. Defer missing target implementations with their prerequisites named. A renamed path alone does not mean missing functionality.
- Every retained PR is assessed as a whole, including prerequisite cost. Eight integer axes run from 0 to 10: security, safety, bug, perf, ops, urgency, fit, locality. Take each axis median over five reviewers, then sum; recommend when total >= 40 OR bug >= 5 OR safety >= 5 OR urgency >= 5.
- Recommendation does not authorize adoption. Selection, hunk curation, ordered application and affected-path verification follow owner decision.

### Score axes

Every axis uses integers from 0 to 10. Higher values indicate more benefit, better fit or a smaller change surface, as defined below. Benefit estimates are not measured runtime outcomes.

| Axis | Meaning |
| --- | --- |
| security | Reduction in remote exposure |
| safety | Robustness, memory/lifetime safety and null handling |
| bug | Functional correctness fixed |
| perf | Expected runtime performance benefit |
| ops | Operational value for the facility |
| urgency | Harm of postponing the change |
| fit | Application compatibility and low regression cost, including prerequisites |
| locality | Smaller affected area scores higher; deep core changes score lower |

## Coverage

| Stage | Count |
| --- | ---: |
| Enumerated commits | 565 |
| PR integration units: 104 merges plus one squash | 105 |
| Removed as documentation / CI / tests only | 19 |
| Deferred for absent target implementation | 14 |
| Frozen scoring candidates | 72 |
| Completed five-reviewer panel | 72 PRs x 5 reviewers |
| Met the numerical rule | 21 |
| Added by owner decision | 8 |
| Rejected from numerical recommendations after re-review | 1 |
| Owner-resolved re-review PRs | 11 |
| Owner-selected PRs | 26 |
| Excluded by owner after single-instance review | 2 |

All 565 commit identities are assigned exactly once. The frozen candidate data has SHA256 `caa12d722b412adce8ddebeea62ee422cf374c81be2ccefb12e7a21ab9cc48f1`.

## Owner-confirmed selection

The owner confirmed 20 numerical recommendations and added eight previously non-recommended PRs. All eleven re-review decisions are resolved. On single-instance review (2026-09-16), PR429 and PR458 were excluded, leaving 26 retained units.

| PR | Selection basis |
| ---: | --- |
| 359 | Panel recommendation confirmed by owner after re-review |
| 360 | Panel recommendation confirmed by owner |
| 364 | Panel recommendation confirmed by owner |
| 385 | Panel recommendation confirmed by owner |
| 396 | Added by owner decision after re-review |
| 400 | Added by owner decision after re-review; adapt to the current PlainPB structure |
| 405 | Panel recommendation confirmed by owner |
| 408 | Added by unanimous three-reviewer re-review |
| 417 | Added by unanimous three-reviewer re-review |
| 423 | Panel recommendation confirmed by owner |
| 425 | Panel recommendation confirmed by owner |
| 433 | Panel recommendation confirmed by owner |
| 445 | Panel recommendation confirmed by owner |
| 448 | Panel recommendation confirmed by owner |
| 452 | Panel recommendation confirmed by owner |
| 454 | Added by unanimous three-reviewer re-review |
| 461 | Panel recommendation confirmed by owner |
| 474 | Added by owner decision |
| 480 | Added by owner decision |
| 481 | Added by owner decision |
| 501 | Panel recommendation confirmed by owner |
| 505 | Panel recommendation confirmed by owner |
| 516 | Panel recommendation confirmed by owner |
| 520 | Panel recommendation confirmed by owner |
| 521 | Panel recommendation confirmed by owner |
| 527 | Panel recommendation confirmed by owner |

## Application and verification limits

The unmodified whole-PR patches were checked with `git apply --cached --check` against the clean index matching d12382d1: 14 of 105 apply without conflict. This includes removed documentation/test units. Apply success alone is neither a build result nor a recommendation. Failure may reflect a removed build file, renamed path, prior upstream changes, or a local fix; it is not by itself an applicability decision.

PR #409 demonstrates a build dependency despite clean application: its three actual Java files were copied from HEAD and modified with the original merge diff. `javac -implicit:none`, using existing compiled project classes and assembled runtime JARs, exited 1 because `ConfigService.queryPVTypeInfos` is missing. PR #368 introduces that method. This was a bounded compiler check, not a clean whole-project build or runtime test.

Other dependency entries are observed static prerequisites, not a complete verified dependency closure. Candidate-specific chains and overlapping hunks require confirmation before implementation. No runtime reproduction or full test suite was run for this survey. Large formatting diffs have supplemental token comparisons derived from the actual before/after Java files; lexical matches are not behavioral equivalence.

## Complete disposition

`retain` means score, `remove` means the mechanical documentation/CI/test exclusion, and `defer` means the stated target prerequisite is absent. Neither retain nor a clean apply result means selected.

| Order | PR | Change | Disposition | Whole PR apply |
| ---: | --- | --- | --- | --- |
| 1 | [#359](https://github.com/archiver-appliance/epicsarchiverap/pull/359) | Remove the check for NAME/NAME$ fields containing site name separators | retain | Conflict |
| 2 | [#364](https://github.com/archiver-appliance/epicsarchiverap/pull/364) | Allow pvAccess for alias workflow | retain | Clean |
| 3 | [#366](https://github.com/archiver-appliance/epicsarchiverap/pull/366) | Update the user guide to use requests and bokeh | remove | Clean |
| 4 | [#365](https://github.com/archiver-appliance/epicsarchiverap/pull/365) | Remove Selenium from the unit tests. | retain | Conflict |
| 5 | [#368](https://github.com/archiver-appliance/epicsarchiverap/pull/368) | Refactor ETL threading to support consolidateOnShutdown on multiple dataStores for a PV - Version 2 | retain | Conflict |
| 6 | [#373](https://github.com/archiver-appliance/epicsarchiverap/pull/373) | Move Time utils test | remove | Clean |
| 7 | [#372](https://github.com/archiver-appliance/epicsarchiverap/pull/372) | Move compression mode out to pbcompressionmode | retain | Conflict |
| 8 | [#374](https://github.com/archiver-appliance/epicsarchiverap/pull/374) | Document searchPeriod | remove | Clean |
| 9 | [#371](https://github.com/archiver-appliance/epicsarchiverap/pull/371) | Test pvAccess works with alias | remove | Conflict |
| 10 | [#370](https://github.com/archiver-appliance/epicsarchiverap/pull/370) | Preformat file with spotless before adding the parquet changes | retain | Conflict |
| 11 | [#360](https://github.com/archiver-appliance/epicsarchiverap/pull/360) | slightly nicer disconnects handling | retain | Conflict |
| 12 | [#382](https://github.com/archiver-appliance/epicsarchiverap/pull/382) | Fix javadoc errors | retain | Conflict |
| 13 | [#378](https://github.com/archiver-appliance/epicsarchiverap/pull/378) | Add integration tests to ci | retain | Conflict |
| 14 | [#376](https://github.com/archiver-appliance/epicsarchiverap/pull/376) | BPL for dynamic reassign appliance | retain | Conflict |
| 15 | [#384](https://github.com/archiver-appliance/epicsarchiverap/pull/384) | Clean up gradle file | defer | Conflict |
| 16 | [#385](https://github.com/archiver-appliance/epicsarchiverap/pull/385) | Fix for #375 - getDataAtTime sometimes picks incorrect values at boundaries of chunks | retain | Conflict |
| 17 | [#387](https://github.com/archiver-appliance/epicsarchiverap/pull/387) | Rename PlainPB to plain | retain | Conflict |
| 18 | [#388](https://github.com/archiver-appliance/epicsarchiverap/pull/388) | Update docs for new PlainStoragePlugin location and rootFolder property | remove | Conflict |
| 19 | [#389](https://github.com/archiver-appliance/epicsarchiverap/pull/389) | Rename ComparePBEvent to CompareEvent | retain | Conflict |
| 20 | [#393](https://github.com/archiver-appliance/epicsarchiverap/pull/393) | Cleanup and rename ValidatePBFile.java | retain | Conflict |
| 21 | [#390](https://github.com/archiver-appliance/epicsarchiverap/pull/390) | Remove unused class GetFileTime | retain | Conflict |
| 22 | [#391](https://github.com/archiver-appliance/epicsarchiverap/pull/391) | Improve FailoverETLServerDownTest | remove | Conflict |
| 23 | [#394](https://github.com/archiver-appliance/epicsarchiverap/pull/394) | Pbcommonsetup to plaincommonsetup | remove | Conflict |
| 24 | [#397](https://github.com/archiver-appliance/epicsarchiverap/pull/397) | Add helper method TimeUtils.getSecondsIntoYear for instant | retain | Conflict |
| 25 | [#396](https://github.com/archiver-appliance/epicsarchiverap/pull/396) | Format and fix small lints in static content servlet | retain | Clean |
| 26 | [#392](https://github.com/archiver-appliance/epicsarchiverap/pull/392) | Expose the protobuf.Message in each data type | retain | Conflict |
| 27 | [#398](https://github.com/archiver-appliance/epicsarchiverap/pull/398) | Use buildRelease instead of assemble in pipeline | remove | Conflict |
| 28 | [#399](https://github.com/archiver-appliance/epicsarchiverap/pull/399) | Fix typo in printtimes.sh | remove | Conflict |
| 29 | [#400](https://github.com/archiver-appliance/epicsarchiverap/pull/400) | Add helper enum URLKey | retain | Conflict |
| 30 | [#402](https://github.com/archiver-appliance/epicsarchiverap/pull/402) | Use a TTL cache for the filestore disk available and total space. | retain | Conflict |
| 31 | [#403](https://github.com/archiver-appliance/epicsarchiverap/pull/403) | Urlkeys usage | retain | Conflict |
| 32 | [#406](https://github.com/archiver-appliance/epicsarchiverap/pull/406) | Run startETLJobsOnStartup in the background. | retain | Conflict |
| 33 | [#408](https://github.com/archiver-appliance/epicsarchiverap/pull/408) | Remove computing ApplianceAggregateInfo on startup. | retain | Conflict |
| 34 | [#409](https://github.com/archiver-appliance/epicsarchiverap/pull/409) | Use queryPVTypeInfos to determine the breakdown of pvcounts in a cluster | retain | Clean |
| 35 | [#404](https://github.com/archiver-appliance/epicsarchiverap/pull/404) | Etlbulkstream refactor | retain | Conflict |
| 36 | [#405](https://github.com/archiver-appliance/epicsarchiverap/pull/405) | Rather than supporting bidirectional iterator for plain | retain | Conflict |
| 37 | [#410](https://github.com/archiver-appliance/epicsarchiverap/pull/410) | Pv overridable siteNameTerminator | retain | Conflict |
| 38 | [#395](https://github.com/archiver-appliance/epicsarchiverap/pull/395) | Add unit test version of MissingDataYearSpanRetrievalTest | remove | Clean |
| 39 | [#412](https://github.com/archiver-appliance/epicsarchiverap/pull/412) | Fix MissingDataYearSpanRetrievalUnitTest | remove | Conflict |
| 40 | [#414](https://github.com/archiver-appliance/epicsarchiverap/pull/414) | * Abstract FileInfo  * Update Validaters for Abstract FileInfo  * Update ExportCSV for Abstract FileInfo  * First event of empty file is Max time | retain | Conflict |
| 41 | [#417](https://github.com/archiver-appliance/epicsarchiverap/pull/417) | Lower log levels | retain | Clean |
| 42 | [#416](https://github.com/archiver-appliance/epicsarchiverap/pull/416) | Add a report showing Command thread command queue depths | retain | Conflict |
| 43 | [#418](https://github.com/archiver-appliance/epicsarchiverap/pull/418) | GitHub release | remove | Conflict |
| 44 | [#420](https://github.com/archiver-appliance/epicsarchiverap/pull/420) | Fix a couple of data driven unit tests | remove | Conflict |
| 45 | [#423](https://github.com/archiver-appliance/epicsarchiverap/pull/423) | #386 - Use a different name for the array count from the API | retain | Clean |
| 46 | [#421](https://github.com/archiver-appliance/epicsarchiverap/pull/421) | Fix for HashMapEvent parsing exception | retain | Conflict |
| 47 | [#415](https://github.com/archiver-appliance/epicsarchiverap/pull/415) | Abstract the file handling | retain | Conflict |
| 48 | [#425](https://github.com/archiver-appliance/epicsarchiverap/pull/425) | Fix potential deadlocks in EPICS_V3_PV | retain | Clean |
| 49 | [#429](https://github.com/archiver-appliance/epicsarchiverap/pull/429) | Do not throw a AlreadyRegisteredException when reassigning a PV | retain | Conflict |
| 50 | [#433](https://github.com/archiver-appliance/epicsarchiverap/pull/433) | Need to remember incoming PV names to cater to aliases in bulkpauseresume | retain | Conflict |
| 51 | [#434](https://github.com/archiver-appliance/epicsarchiverap/pull/434) | Jakarta/Tomcat migration | retain | Conflict |
| 52 | [#439](https://github.com/archiver-appliance/epicsarchiverap/pull/439) | Update dependencies | retain | Conflict |
| 53 | [#440](https://github.com/archiver-appliance/epicsarchiverap/pull/440) | Update pbrawclient to 0.2.2 | remove | Conflict |
| 54 | [#442](https://github.com/archiver-appliance/epicsarchiverap/pull/442) | No git build | defer | Conflict |
| 55 | [#444](https://github.com/archiver-appliance/epicsarchiverap/pull/444) | Create a master release | remove | Conflict |
| 56 | [#452](https://github.com/archiver-appliance/epicsarchiverap/pull/452) | Fix for  #447 | retain | Conflict |
| 57 | [#454](https://github.com/archiver-appliance/epicsarchiverap/pull/454) | Add pv name to error log | retain | Conflict |
| 58 | [#445](https://github.com/archiver-appliance/epicsarchiverap/pull/445) | Fix null pointer exception in FieldValuesCache | retain | Clean |
| 59 | [#448](https://github.com/archiver-appliance/epicsarchiverap/pull/448) | Last event bug | retain | Conflict |
| 60 | [#461](https://github.com/archiver-appliance/epicsarchiverap/pull/461) | Fix for #460 pause/resume with .VAL's | retain | Conflict |
| 61 | [#463](https://github.com/archiver-appliance/epicsarchiverap/pull/463) | Gradle 9 | defer | Conflict |
| 62 | [#465](https://github.com/archiver-appliance/epicsarchiverap/pull/465) | Add a prerequisites section to the development readme | defer | Conflict |
| 63 | [#462](https://github.com/archiver-appliance/epicsarchiverap/pull/462) | fix sampleStartup.sh multipleBuildAndDeploy.sh | retain | Clean |
| 64 | [#467](https://github.com/archiver-appliance/epicsarchiverap/pull/467) | Fix the build reports upload on unittests | remove | Conflict |
| 65 | [#458](https://github.com/archiver-appliance/epicsarchiverap/pull/458) | Only use the chunkKey from the PVTypeInfo | retain | Conflict |
| 66 | [#436](https://github.com/archiver-appliance/epicsarchiverap/pull/436) | Add Parquet support | retain | Conflict |
| 67 | [#470](https://github.com/archiver-appliance/epicsarchiverap/pull/470) | Add a basic example of testing http requests without tomcat | remove | Conflict |
| 68 | [#473](https://github.com/archiver-appliance/epicsarchiverap/pull/473) | Skip etl named flag | retain | Conflict |
| 69 | [#474](https://github.com/archiver-appliance/epicsarchiverap/pull/474) | Fix sphinx javadoc links | retain | Conflict |
| 70 | [#427](https://github.com/archiver-appliance/epicsarchiverap/pull/427) | Change store mgmt method | retain | Conflict |
| 71 | [#476](https://github.com/archiver-appliance/epicsarchiverap/pull/476) | Update documentation for parquet changes | remove | Conflict |
| 72 | [#480](https://github.com/archiver-appliance/epicsarchiverap/pull/480) | Handle null values from epics v4 metadata. | retain | Conflict |
| 73 | [#481](https://github.com/archiver-appliance/epicsarchiverap/pull/481) | Remove the getPVNames function and button | retain | Clean |
| 74 | [#483](https://github.com/archiver-appliance/epicsarchiverap/pull/483) | Fixes misaligned urls and query param names in ChangeStore | defer | Conflict |
| 75 | [#486](https://github.com/archiver-appliance/epicsarchiverap/pull/486) | Fix the tests not running on the extended tasks | remove | Conflict |
| 76 | [#488](https://github.com/archiver-appliance/epicsarchiverap/pull/488) | Async etl shutdown | retain | Conflict |
| 77 | [#485](https://github.com/archiver-appliance/epicsarchiverap/pull/485) | Swap to using a version catalog | defer | Conflict |
| 78 | [#491](https://github.com/archiver-appliance/epicsarchiverap/pull/491) | Issue 469 Remove pb compression mode | retain | Conflict |
| 79 | [#493](https://github.com/archiver-appliance/epicsarchiverap/pull/493) | Use new template for docs | retain | Conflict |
| 80 | [#498](https://github.com/archiver-appliance/epicsarchiverap/pull/498) | Cache the total and paused PV count on the appliance | retain | Conflict |
| 81 | [#497](https://github.com/archiver-appliance/epicsarchiverap/pull/497) | fix: add hadoop runtime dependency - parquet archive issue | defer | Conflict |
| 82 | [#489](https://github.com/archiver-appliance/epicsarchiverap/pull/489) | Resolve circular depend | retain | Conflict |
| 83 | [#501](https://github.com/archiver-appliance/epicsarchiverap/pull/501) | fix: throw ChangeInYearsException for streams spanning multiple years | retain | Conflict |
| 84 | [#499](https://github.com/archiver-appliance/epicsarchiverap/pull/499) | Dependancy checks | defer | Conflict |
| 85 | [#505](https://github.com/archiver-appliance/epicsarchiverap/pull/505) | Fix nth post processor to correctly handle switch in year | retain | Conflict |
| 86 | [#504](https://github.com/archiver-appliance/epicsarchiverap/pull/504) | Refactor ArchPaths to better support NIO2 syntax. | retain | Conflict |
| 87 | [#512](https://github.com/archiver-appliance/epicsarchiverap/pull/512) | Fix the docker tomcat version | defer | Conflict |
| 88 | [#507](https://github.com/archiver-appliance/epicsarchiverap/pull/507) | Improve performance of the writer | retain | Conflict |
| 89 | [#515](https://github.com/archiver-appliance/epicsarchiverap/pull/515) | Support for using tar files as an PlainStoragePlugin rootFolder | retain | Conflict |
| 90 | [#516](https://github.com/archiver-appliance/epicsarchiverap/pull/516) | Archiver support for adel and nelm | retain | Conflict |
| 91 | [#509](https://github.com/archiver-appliance/epicsarchiverap/pull/509) | Embedded tomcat testing | retain | Conflict |
| 92 | [#520](https://github.com/archiver-appliance/epicsarchiverap/pull/520) | Broken bytes | retain | Conflict |
| 93 | [#517](https://github.com/archiver-appliance/epicsarchiverap/pull/517) | Delete any existing entry in the tar file only after successfully appending the updated content. | defer | Conflict |
| 94 | [#521](https://github.com/archiver-appliance/epicsarchiverap/pull/521) | fix: truncate corrupt tail before appending to PB file | retain | Conflict |
| 95 | [#523](https://github.com/archiver-appliance/epicsarchiverap/pull/523) | Java 5 migrations | retain | Conflict |
| 96 | [#525](https://github.com/archiver-appliance/epicsarchiverap/pull/525) | Update jca | defer | Conflict |
| 97 | [#513](https://github.com/archiver-appliance/epicsarchiverap/pull/513) | Docker test fix | retain | Conflict |
| 98 | [#527](https://github.com/archiver-appliance/epicsarchiverap/pull/527) | Embedded problems | retain | Conflict |
| 99 | [#494](https://github.com/archiver-appliance/epicsarchiverap/pull/494) | Swap to new structure of documentation | retain | Conflict |
| 100 | [#530](https://github.com/archiver-appliance/epicsarchiverap/pull/530) | docs: add & configure the mermaid plugin | retain | Conflict |
| 101 | [#490](https://github.com/archiver-appliance/epicsarchiverap/pull/490) | Upgrade to java 25 | retain | Conflict |
| 102 | [#536](https://github.com/archiver-appliance/epicsarchiverap/pull/536) | Fix install scripts executable | defer | Conflict |
| 103 | [#534](https://github.com/archiver-appliance/epicsarchiverap/pull/534) | For packed files, return the path of the file system if a root folder | defer | Conflict |
| 104 | [#535](https://github.com/archiver-appliance/epicsarchiverap/pull/535) | Fix mgmt help links | retain | Clean |
| 105 | [#539](https://github.com/archiver-appliance/epicsarchiverap/pull/539) | gradle: don't install doc's doctrees | defer | Conflict |

## Classification evidence and prerequisites

### PR359

Merge/squash: `2a3cf8d36a625aab8f589d799094130f79667b15`. Removes runtime alias separator restriction.

ArchivePVState.convertAliasToRealWorkflow becomes unconditional for distinct real names.

Owner decision: Accepted after re-review. Treat a differing NAME value as the real PV name regardless of site separator presence.

### PR364

Merge/squash: `7c436960a4c9439becbcef9e58d87fed76522400`. Changes PVA alias metadata behavior.

MetaGet.java runtime implementation changes, with MetaTest changes.

### PR366

Merge/squash: `968823af686b7d5fca7bcb56a0d48e5cc7e28a05`. Documentation only.

Installguide prose, userguide fenced illustrative Python and screenshot; no executable repository code.

### PR365

Merge/squash: `fac6765ce3a38b66ac3181932d0054658197bcb6`. Runtime changes alongside substantial test conversion.

MergeDedupStoragePlugin implements BiDirectionalIterable; EngineContext skips zero-count appliance; GetUrlContent JSON helpers change.

### PR368

Merge/squash: `f0f113fc320536b7f53db114df8aee4e7fc46953`. Introduces cluster bulk operations and ETL state model.

ConfigService.queryPVTypeInfos, DefaultConfigService implementation, ETLStage/ETLStages and ETLMetricsIntoStore added.

Owner decision: Rejected after unanimous three-reviewer re-review. The cancellation path does not cancel the actual scheduled future.

### PR373

Merge/squash: `dd5ab2ab67767c7021b97f4db4190eb3ff832e7c`. Test code only.

TimeUtilsTest package relocation and redundant imports removal.

### PR372

Merge/squash: `0ac34e0d690b8b8e7cd3ca7ff30d6c906eb32666`. Runtime compression type extraction.

AppendDataStateData and PlainPBPathNameUtility change parameter type to new PBCompressionMode.

### PR374

Merge/squash: `27b85596855905a2bbc677803e4565f5cebcaa45`. Documentation only.

Userguide searchPeriod description added.

### PR371

Merge/squash: `c2ea7f275b4e32a9e09326f6800f21d0d7641402`. Test code only.

ClusterAliasTest parameterized boolean pvAccess setup.

### PR370

Merge/squash: `38f9ed984d72fadd8c47c6e43b094eb8eb501e5b`. Broad source formatting survives mechanical stage.

176-file diff includes production Java source formatting; cosmetic source edits are not a permitted removal category.

### PR360

Merge/squash: `c33e8581d4d32c6d5a4fecb17448f9cafa5a0b7b`. Runtime connection lifecycle fix.

EPICS_V4_PV.handleMonitor null branch returns; handleDisconnected centralizes state and notification. Gradle raises core-pva to5.0.2; fork Maven already5.0.5.

### PR382

Merge/squash: `d00e65c8e90c3c3103958a868e383abf47c6da0f`. Build behavior and source edits accompany Javadoc fixes.

build.gradle deletes failOnError=false; PVContext imports/modifiers and GetUrlContent formatting change.

### PR378

Merge/squash: `47d180646df58a9678ba53e0841cb5f936c736d4`. Developer image implementation changes accompany CI/tests.

Dockerfile.dev modifies package installations, downloads, build stages and library-path environment. All three Docker/CI paths absent in fork; retain conservatively pending parent applicability decision.

### PR376

Merge/squash: `5da51e54b7271fe2af448a518dd2e115eef0956a`. Appliance reassignment and worker lifecycle implementation.

Adds PBThreeTierETLPVLookup.scheduleWorker/startETLJobsOnStartup; calls queryPVTypeInfos and edits ETLStageDetails.

Prerequisites: PR368: ConfigService.queryPVTypeInfos and ETLStageDetails

### PR384

Merge/squash: `2a890e5f57c0595568f1ba96c4a5f1482682fe06`. Only Gradle build implementation replaced; fork deliberately uses Maven.

Deletes build.gradle and adds build.gradle.kts; required Gradle build system absent in d12382d1.

Prerequisites: Gradle build system absent; introducing it violates fixed Maven baseline

### PR385

Merge/squash: `b818911aee07b242b90a3b3580b855ed9164e834`. Changes actual sample retrieval boundary handling.

Adds ArrayListEventStreamWithPositionedIterator, small-file path, first-event boundary check and removes store reversal in GetDataAtTime.

### PR387

Merge/squash: `d55d96975cacd41c5de988a51120908b4ad24fd1`. Renames production storage namespace and classes.

PlainPB to plain renames affect runtime imports and plugin wiring. Existing functionality means path absence alone is not a deferral.

Prerequisites: PR372: PBCompressionMode; PR385: ArrayListEventStreamWithPositionedIterator

### PR388

Merge/squash: `9210bce0c5054d55053a9be71b2da6f5de36f010`. Documentation and test support only.

Five documentation/link/template edits and test PBCommonSetup property rename; no product execution edit.

### PR389

Merge/squash: `7f1210de8a69d3bc6c2d2dd2a02c19e2efe617a0`. Production comparator class rename.

FileEventStreamSearch imports/instantiates CompareEvent; ComparePBEvent renamed.

Prerequisites: PR387: plain namespace

### PR393

Merge/squash: `491c8952ba192c8b22f7c88e384eaf7d513952a2`. Runtime validation utility changes.

ValidatePBFile renamed ValidatePlainFile; validation compares Instant timestamps instead of seconds.

Prerequisites: PR387: plain namespace

### PR390

Merge/squash: `7e074d3f76e5b675c3f8e5a6615c686792ea2798`. Standalone timing utility deletion, conservatively tool-only.

Deleted GetFileTime has main() and methods timing decompression of actual filesystem paths, not JUnit checks. src/test location alone does not justify removal.

### PR391

Merge/squash: `dbd0eca2846526c8e3fe31dd016e15a7f8fbde43`. Test code only.

FailoverETLServerDownTest setup/teardown, fixture paths, test data times and assertions change.

### PR394

Merge/squash: `ddafd04c020ac33ee411c22c64138f1a52b5eb5f`. Test fixture rename and test consumers only.

PBCommonSetup renamed PlainCommonSetup; all18 files are setup/helper/test calls under src/test, no operational launcher added.

### PR397

Merge/squash: `9215b9b1ab366c92270f3cde03402cfa7c09396d`. Production time and event constructor changes.

TimeUtils replaces two-long overload with Instant; SimulationEvent adds Instant/SampleValue constructor.

### PR396

Merge/squash: `08ab9d7c42432cbb19dacaa22749010844f9e529`. Production servlet formatting survives mechanical stage.

StaticContentServlet whole-file source reformat; not documentation-only.

Owner decision: Accepted after re-review. Carry the bounded StaticContentServlet maintenance cleanup.

### PR392

Merge/squash: `0260684bda124cf220711905a7958387c30c2cce`. New production protobuf interface.

Event.getProtobufMessage and DBR2PBTypeMapping Message.Builder constructor mapping plus implementations.

Owner decision: Rejected after re-review. The current selected scope does not require the expanded protobuf Event interface.

### PR398

Merge/squash: `e6d2a04ab6717e1755b9b7c5a0a85a5f0266855d`. CI configuration only.

build-and-push workflow changes two Gradle invocations from assemble to buildRelease.

### PR399

Merge/squash: `8d8535971fc7a1ee519b540fc85a0e0b0f64098f`. Documentation comment only in shell script.

printtimes.sh changes only its comment from ValidatePBFile to ValidatePlainFile.

### PR400

Merge/squash: `88f077b80a1d4abc7cee58eec86705640ce03088`. Production plugin URI type/helpers.

New URLKey enum and URIUtils.pluginString(Map); PlainStoragePlugin consumes keys.

Prerequisites: PR387: PlainStoragePlugin namespace

Owner decision: Accepted after re-review. Port the URI key and encoding changes to the current PlainPB structure and preserve repeated parameter support.

### PR402

Merge/squash: `0fd151b1a3a1e9a8d9947223c7b5ec3686ce9c37`. Runtime disk-capacity cache changes.

StorageMetricsContext replaces getFileStore; ETLMetricsIntoStore introduces ten-minute LoadingCache; PlainStoragePlugin uses it.

Prerequisites: PR368: ETLMetricsIntoStore; PR387: PlainStoragePlugin

Owner decision: Rejected after re-review. Cached disk-capacity values must not control ETL movement or source-deletion decisions.

### PR403

Merge/squash: `b40dc06d1f162ef11e497b267611c911498ea368`. Production URI helper overload accompanies tests.

URIUtils.pluginString(String,String,String) and SampleRetrievalState runtime calls.

Prerequisites: PR400: URLKey and pluginString(Map); PR387: PlainStoragePlugin namespace; PR394: test PlainCommonSetup only

### PR406

Merge/squash: `e5803ca742af120962cf1a4f55dd3b299bce72b1`. Changes ETL startup scheduling.

postStartup submits startETLJobsOnStartup to scheduleWorker.

Prerequisites: PR376: scheduleWorker/startETLJobsOnStartup; PR368: transitive ETL state model

### PR408

Merge/squash: `1a87b9f3ae2f95c28352462a52500f6642c69f34`. Changes startup aggregation.

DefaultConfigService deletes applianceAggregateInfo population loop; fork has related loop but context differs.

Owner decision: Accepted after unanimous three-reviewer re-review. Remove the redundant guarded startup aggregation loop.

### PR409

Merge/squash: `e71f130c982a7bfa3e9d9b8f07b7025a49af511d`. Fixes per-appliance counts; hidden build dependency.

ApplianceMetrics invokes ConfigService.queryPVTypeInfos; fork rg found no declaration although common whole-PR apply check exits0.

Prerequisites: PR368: ConfigService.queryPVTypeInfos and implementation

### PR404

Merge/squash: `122949d82d05154f75e846ddb03aa193aeb5df1a`. ETL bulk stream interface refactor.

AppendDataStateData adds stream subtype validation and ETLPBByteStream; ETLStages and other ETL contracts change.

Prerequisites: PR368: ETLStages state model; PR387: plain namespace

### PR405

Merge/squash: `a612ee11ae794fe8d390bbc6acc29258dde2de03`. Runtime getDataAtTime refactor and new stream abstraction.

036-PR405.patch adds DataAtTime, PlainStreams, PBPlainStreams and changes GetDataAtTime.getDataAtTimeForPVFromStores.

Prerequisites: PR387 supplies the plain package paths; PR385 changes the existing getDataAtTime implementation. Exact patch closure not established.

### PR410

Merge/squash: `5b696dffc31461a04cfdd8301ca32dd31a8ef1f0`. Runtime key conversion and type-info event API changes.

037-PR410.patch adds PVNameToKeyMapping.overrideTerminator, removes configured custom mapper loading, and removes stored chunkKey lookup from ConvertPVNameToKey.

Prerequisites: PR400 supplies URLKey; PR387 supplies PlainStoragePlugin paths; PR359 removed containsSiteSeparators from the interface.

### PR395

Merge/squash: `4847aa106ff55dc47c14a3bb8d6d045528163653`. Exclusively test code.

038-PR395.patch contains one new MissingDataYearSpanRetrievalUnitTest with generated test events and retrieval assertions.

### PR412

Merge/squash: `f3ac1abd4e11d7276c1ce1be822ca2422053aa4a`. Exclusively test code.

039-PR412.patch only changes the setup helper import and constructor in MissingDataYearSpanRetrievalUnitTest.

### PR414

Merge/squash: `70c22336b9e4dde36c842c90afaebce7aaee4268`. Production FileInfo abstraction and runtime consumers.

040-PR414.patch adds FileInfo, makes PBFileInfo extend it, and changes FileBackedPBEventStream accessors.

Prerequisites: PR387 supplies plain/pb paths; PR393 supplies ValidatePlainFile path. Test rename additionally follows PR394 helper rename.

### PR417

Merge/squash: `17def68a1daadc1500c19354ae3a1cb453e444d9`. Runtime log severity changes.

041-PR417.patch changes three monitorChanged error calls to debug in EPICS_V3_PV.

Prerequisites: No new symbol dependency observed; formatting overlap is not a semantic prerequisite.

Owner decision: Accepted after unanimous three-reviewer re-review. Keep the counter and early-return behavior while lowering the three log messages to debug.

### PR416

Merge/squash: `6957e80a7efee170fb415d8322bece1505d7e601`. Production command-thread diagnostics.

042-PR416.patch adds getCommandThreadDetails endpoint, queue-size accessors, and numbered JCACommandThread constructor.

Prerequisites: EngineContext.getAllChannelsForPV and command-thread support exist in the fork; no newly missing API identified in inspected hunks.

Owner decision: Rejected after re-review. Unsynchronized queue diagnostics are outside the selected scope.

### PR418

Merge/squash: `9351a71e99b989bd7c63d94148116c0c83f8fc76`. Exclusively CI configuration.

043-PR418.patch only edits build-and-push.yml to add tag metadata and prerelease job.

### PR420

Merge/squash: `3c489fefd1707bf60bc9cb5495e2bedf9aa7bfc7`. Exclusively test code.

044-PR420.patch only changes expected file paths in DataDrivenPostProcessorTest and DeadBandTest.

### PR423

Merge/squash: `e38ce3aaf6c9dc5b003745184d5a9bc84b0f7c00`. Runtime metadata key changes.

045-PR423.patch changes MetaInfo output key NELM to EAA_COUNT.

Prerequisites: No added symbol dependency.

### PR421

Merge/squash: `fc4d23c2017121d88bd7566fdb0e57a39b2eb6a8`. Runtime waveform and event-value conversion changes.

046-PR421.patch changes HashMapEvent.getSampleValue and adds RAW_VALUE_FIELD_NAME; ArchiverValuesHandler changes event serialization.

Prerequisites: PR405 changed HashMapEvent to the typed constructor used here; org.json.JSONArray is newly imported, and explicit org.json Gradle dependency appears later in PR439. Maven dependency/transitive availability needs confirmation.

Owner decision: Rejected after unanimous three-reviewer re-review. The JSON string waveform path checks an incompatible array type.

### PR415

Merge/squash: `b85f088e0fa23c029d9ecb74b5ec338eeaffde33`. Production storage append and file-handler abstraction.

047-PR415.patch introduces PlainFileHandler extends PlainStreams and PlainETLStreamCreator holding FileInfo; renames PBPlainStreams to PBPlainFileHandler.

Prerequisites: PR405 supplies PlainStreams/PBPlainStreams; PR414 supplies FileInfo; PR404 supplies ETL stream refactor; PR387 supplies plain package. Test helper prerequisites also exist.

### PR425

Merge/squash: `d8beb20b0b89de09ce73a95a11c8ca22d36f57ac`. CA disconnect handling changes thread and synchronization behavior.

048-PR425.patch moves subscription/state clearing into scheduled Runnable and removes synchronized around changedarchiveFieldsData.clear.

Prerequisites: PVContext.scheduleCommand and subscription fields exist in fork; PR417 overlap changes nearby formatting/logging, not the required scheduling API.

### PR429

Merge/squash: `70770ecbfe6a48e0bbabeda2cd0541192007fb3b`. Runtime reassign behavior changes; missing feature precursor recorded.

049-PR429.patch adds PVRegistrationType and changes ReassignAppliance to register with REASSIGNING.

Prerequisites: PR376 introduces ReassignAppliance, absent from fork. ConfigService/DefaultConfigService signature edits alone do not supply that endpoint.

Owner decision: Excluded on single-instance review (2026-09-16). A single instance never reassigns a PV between appliances, and the ReassignAppliance endpoint (PR376) is absent from the fork.

### PR433

Merge/squash: `d1d9b81a1cb09ab27447e11e21f3680d37be4c7a`. Runtime bulk pause/resume alias handling changes.

050-PR433.patch introduces incoming2real and uses realName when reading retValMap.

Prerequisites: Fork BulkPauseResumeUtils has an earlier implementation; PR368 introduces the bulk-operation implementation edited here. Exact textual closure not established.

### PR434

Merge/squash: `4adafd8dbd8e0efc8cdf8e506908cd94261b6d2f`. Production servlet migration, not mechanical doc/CI/test removal. Whole-PR adoption conflicts with the frozen Tomcat 9 baseline and needs explicit baseline disposition.

051-PR434.patch replaces javax.servlet imports with jakarta.servlet and Tomcat 9.0.74 dependency with 11.0.12, plus FileUpload 2 Jakarta API.

Prerequisites: Jakarta servlet container/API and FileUpload 2; the fork uses javax.servlet/Tomcat 9. PR384 provides absent Gradle Kotlin build file.

### PR439

Merge/squash: `0dfd4661203100ef20535e39b93dad86672999d4`. Runtime dependency and generated protobuf build changes.

052-PR439.patch deletes generated EPICSEvent.java, adds Gradle protobuf plugin/src/proto, and upgrades runtime dependencies.

Prerequisites: PR384 Gradle Kotlin build; PR434 Jakarta/Tomcat 11 baseline. Fork Maven needs its own protoc generation wiring before removing generated Java.

### PR440

Merge/squash: `7b8630ef1314c46cbe0cd05a7d2b87050c0d99fc`. Exclusively test dependency change.

053-PR440.patch changes testImplementation pbrawclient 0.2.1 to 0.2.2 and replaces only lib/test JARs. Binary payload not behavior-reviewed.

### PR442

Merge/squash: `96c16c1d9dce39b062b8f2057c00bb859e962911`. Only target is absent Gradle Kotlin build logic; Maven baseline does not execute it.

054-PR442.patch edits build.gradle.kts gitVersion fallback, release notes and Spotless configuration; current build.gradle.kts does not exist.

Prerequisites: PR384 creates build.gradle.kts. A build-system change is outside this charter.

### PR444

Merge/squash: `1a7dd4363e458f6fd44ef56ea7137fc159a0dbb2`. Exclusively CI configuration.

055-PR444.patch adds create-master-release job only in build-and-push.yml.

### PR452

Merge/squash: `0a65148f904295994468f2a569d5bab50d786ca5`. Runtime exact-time backwards retrieval fix with test.

056-PR452.patch introduces POSITION.END and advances endPosition after reading the matching sample in FileBackedPBEventStream.seekToEndTime.

Prerequisites: PR387 relocated existing FileBackedPBEventStream; PR414 changed accessors. Target functionality exists under PlainPB in fork; rename alone is not absence.

### PR454

Merge/squash: `ee018cfd5a94b903a36e7ba4c8bec31801b459f7`. Runtime diagnostic output.

057-PR454.patch includes PV name in EPICS_V4_PV monitor conversion exception message.

Prerequisites: No new symbol dependency.

Owner decision: Accepted after unanimous three-reviewer re-review. Include the PV name in the existing conversion-error log.

### PR445

Merge/squash: `a1564097f555dd53522efb790e4f0896aaa3228f`. Runtime null filtering before map collection.

058-PR445.patch guards cachedFieldValues.get(key) against null before changed.put in getUpdatedFieldValues.

Prerequisites: FieldValuesCache and used collections exist in fork.

### PR448

Merge/squash: `145e4dd390941b4572603137700390bae052fdea`. Runtime boundary retrieval and last-sample changes.

059-PR448.patch adds previous-partition stream for missing/late current data and adjusts FileBackedPBEventStreamTimeBasedIterator/PBPlainFileHandler.

Prerequisites: PR415 supplies PBPlainFileHandler; PR414 supplies FileInfo.getFirstEventInstant/getLastEventInstant; PR387 supplies paths; PR452 modifies same seek code.

### PR461

Merge/squash: `99e4ec22ff1a995e996a7b4d56b251893981960e`. Runtime PV normalization and correct pause overload call.

060-PR461.patch uses PVNames.normalizeChannelName and incoming2real; PauseArchivingPV passes pvNames rather than req.

Prerequisites: PR433 introduces incoming2real, absent from fork; PR368 introduces the bulk pause/resume implementation. PVNames.normalizeChannelName exists in fork.

### PR463

Merge/squash: `ee5517a1c3ff1e72871992008a14a6b18c244b1b`. Only Gradle build/wrapper machinery, absent from Maven baseline.

061-PR463.patch upgrades wrapper 8.5 to 9.3.0 and replaces Gradle fileMode declarations with filePermissions.

Prerequisites: Gradle build/runtime and PR384 build.gradle.kts; fork has neither build.gradle nor build.gradle.kts.

### PR465

Merge/squash: `2a53b5ff1c1236d30388f2073f6b8de80f436da8`. Prose plus only executable change to absent Gradle plugin; not documentation-only.

062-PR465.patch changes README and com.diffplug.spotless version 6.25.0 to 8.1.0 in absent build.gradle.kts.

Prerequisites: PR384 Gradle Kotlin build and PR463 Gradle 9 compatibility context.

### PR462

Merge/squash: `58f6d06e7958f744508c8508d44f59643c30861a`. Executable startup scripts, although located under docs.

063-PR462.patch removes -XX:MaxPermSize=128M from JAVA_OPTS in multipleBuildAndDeploy.sh and sampleStartup.sh.

Prerequisites: No new symbol dependency; inspect whether fork already removed option before adoption.

### PR467

Merge/squash: `8312337def7e31c782a7315bcaef3c0e6f2d763f`. Exclusively CI configuration.

064-PR467.patch renames a build report artifact and formats test-and-build.yml.

### PR458

Merge/squash: `b631a8ceb28e2751a999742ab9e1eae4d5090269`. Runtime stored chunk-key mapping restoration.

065-PR458.patch introduces ChunkKeyKeyMapping implements PVNameToKeyMapping and overrides overrideTerminator; PlainStoragePlugin instantiates it.

Prerequisites: PR410 introduces overrideTerminator and removes containsSiteSeparators. Fork interface still requires containsSiteSeparators and has no overrideTerminator, so new class alone is incompatible.

Owner decision: Excluded on single-instance review (2026-09-16). The fork's ConvertPVNameToKey already returns the stored PVTypeInfo chunkKey before generating one, so the fix is already present; adopting it would duplicate the behavior and require the absent overrideTerminator interface method (PR410).

### PR436

Merge/squash: `e21ad775f07ba8d55d18b2bbdf12d82d52f2ef31`. Production Parquet feature and dependencies.

066-PR436.patch adds parquet storage handlers, DBR2PBMessageTypeMapping, PlainStorageType and Hadoop/Parquet runtime dependencies.

Prerequisites: PR415 file-handler/append abstractions; PR414 FileInfo; PR392 exposed protobuf messages; PR387 package migration. Maven dependency translation is required; Gradle changes alone do not wire fork build.

### PR470

Merge/squash: `c6290a3d0e8413235ba8cd42d9dc46e537686282`. Exclusively test code/dependency.

067-PR470.patch adds only Mockito testImplementation and PVsMatchingParameterTest with mocked outer HTTP request.

### PR473

Merge/squash: `31608e3f8987a8768c3f0de94d59e747ac300759`. Runtime ETL operational flag.

068-PR473.patch reads SKIP_<store>_FOR_ETL and returns before processing the ETL job; accompanying admin prose documents it.

Prerequisites: No new class dependency observed; check getName/getNamedFlag on fork interfaces before scoring.

### PR474

Merge/squash: `e51b135484a4a134e1fa228fc66a542ebaec2aa9`. Documentation-generator executable Java change; tool-only changes survive the procedure.

069-PR474.patch changes ProcessMgmtScriptables out.print href prefix to ../_static/javadoc/ as well as prose links.

Prerequisites: Generated documentation directory layout must match; Java class exists independently of Gradle build migration.

Owner decision: Accepted.

### PR427

Merge/squash: `029ada1470f820182ebd4a8fe821ee82e6d78c02`. Production backend conversion, writer API and administrative endpoints.

070-PR427.patch adds EventFileWriter, ParquetEventFileWriter, PBEventFileWriter, ConvertFile and ChangeStore BPL endpoints.

Prerequisites: PR436 supplies PlainStorageType/Parquet classes; PR415 supplies file handlers; PR434 Jakarta servlet imports in new ChangeStore endpoints conflict with fork javax API.

### PR476

Merge/squash: `e67ad4626a5944212d2da470e52bde79a81242ba`. Documentation prose and example blocks only; six Markdown files describe storage backends.

developer/parquet.md and sysadmin/storage_plugins.md added as narrative/example documentation.

### PR480

Merge/squash: `dc83e1052bd25a2e4492d600b53511705f35a564`. Changes production null metadata handling and logs.

FieldValuesCache.v3NamedValues skips null values; getUpdatedFieldValues uses containsKey.

Prerequisites: PR445: prior null-handling hunk differs at baseline; baseline has original FieldValuesCache and needs adaptation.

Owner decision: Accepted.

### PR481

Merge/squash: `ce1bb4b50770fc5848aac6e62253125dd59bac38`. Changes management UI execution.

mgmt.js removes getPVNames, updates deleteMultiplePVs success handling, and index.html removes a button.

Owner decision: Accepted.

### PR483

Merge/squash: `90ad2812196fda073af52be08416dfd99298ce13`. Both production ChangeStore target classes are absent at baseline.

ChangeStore endpoint naming, proxy routing and typeInfo storage updates.

Prerequisites: PR427: adds etl/bpl/ChangeStore.java and mgmt/bpl/ChangeStore.java.

### PR486

Merge/squash: `3300543a83578ce107313097b133f812a76472a1`. Exclusively configures test task class directories and runtime classpath.

build.gradle.kts tasks.withType<Test> adds exactly three lines.

### PR488

Merge/squash: `866c478ae120bd97d5b3634083d2e5ab4350e48f`. Changes live ETL cancellation and shutdown scheduling.

ETLStages.cancelJob returns CompletableFuture; PBThreeTierETLPVLookup shutdown waits all futures.

Prerequisites: PR415: abstract AppendDataStateData shape; PR473: skip-destination log hunk.

### PR485

Merge/squash: `584295da51371479eef46c06bacb7dbd6d07e2bc`. Only Gradle dependency catalog machinery; build.gradle.kts and gradle.properties absent at Maven baseline.

Replaces hardcoded Gradle dependencies with libs catalog; adds gradle/libs.versions.toml.

Prerequisites: Gradle build/catalog is absent; Maven remains governing build.

### PR491

Merge/squash: `824779006ad4a21b26e0f9fa567d77d957904379`. Removes production PB compression configuration and changes default path behavior.

PBPlainFileHandler drops ZIP_PER_PV branches; PlainFileHandler supplies default path methods.

Prerequisites: PR415: PlainFileHandler abstraction; PR436: ParquetPlainFileHandler. Baseline legacy PB compression functionality exists.

### PR493

Merge/squash: `4a9448a3dcd60af8ec6ebdf346d9caf0ff5c8d27`. Documentation build tools execute different install and rendering logic; conservative retain under tool-only rule.

build_docs.sh/.bat install local project; conf.py replaces extensions; pyproject supplies build dependencies.

### PR498

Merge/squash: `0a33c838d9707a610077b78c53c83f7b35f13cff`. Changes production PV count caching and cluster calls.

ConfigService.CachedPVCounts and DefaultConfigService event counters feed EngineContext/ApplianceMetrics.

Prerequisites: PR368, internal f4a3551c: EAABulkOperation/executeClusterWide missing at baseline; PR409 query code replaced here.

### PR497

Merge/squash: `0e2c284254298eff6fccfb7c102ca3ca2d002cc2`. Parquet Hadoop runtime fix targets an absent backend and absent Gradle catalog.

runtimeOnly(hadoop.client) becomes client.api plus client.runtime.

Prerequisites: PR436 Parquet/Hadoop backend; PR485 Gradle catalog.

### PR489

Merge/squash: `b2c791315e36a5c021aae45da6c35ec3fe8ca68c`. Production class/package relocation and interface dependencies change.

InputStreamBackedEventStream imports common.remotable; ArrayListEventStream/HashMapEvent move packages.

Prerequisites: PR436 adds parquet source modified here; package overlaps require ordered application.

### PR501

Merge/squash: `3533aa2415afc23857bec2513e99fc91e1dae9fe`. Changes year-transition behavior of an existing retrieval stream.

ArrayListCollectorEventStream iterator initializes currentYear then throws ChangeInYearsException on crossing.

Prerequisites: PR489 relocates imports used as patch context; same baseline classes exist under original packages.

### PR499

Merge/squash: `890267189d9a3465177f0ef5e6f732ce69733c41`. Mixed CI/test and Gradle dependency-analyzer exemption; sole non-test tool target absent.

build.gradle.kts permitUsedUndeclared(libs.stax.api); Gradle catalog gains stax-api.

Prerequisites: PR485 catalog and Gradle analyze plugin.

### PR505

Merge/squash: `9787e085bc89d227f0d97619180dca9141ca09e9`. Changes production postprocessor result stream.

Nth.getConsolidatedEventStream returns new ArrayListCollectorEventStream(data).

Prerequisites: PR501 improves wrapper year-crossing correctness; baseline wrapper class exists, relation needs apply/order verification.

### PR504

Merge/squash: `2a57e095d929fde30692627b0941c6a17ab9a4f1`. Production path representation refactor adds functionality to existing ArchPaths.

Adds PVPath and replaces ad hoc path construction; append backup path uses resolveSibling.

Prerequisites: Earlier plain storage refactors PR387/PR415 and Parquet PR436 affect source context; do not infer hard chain from names alone.

### PR512

Merge/squash: `e961d0639fb57190fbe22654d3dc2f77916426ba`. Sole executable target Dockerfile is absent at baseline; the diff switches its Tomcat base image from 9 to 11.

Dockerfile FROM tomcat:9 becomes tomcat:11.

Prerequisites: Jakarta servlet migration PR434; baseline explicitly retains Tomcat 9.

### PR507

Merge/squash: `8907f33737b704ced7172a3e2aea1b7a42b8105e`. Production parallel writer scheduling, queue behavior and monitoring change.

EngineMetrics adds channel IO seconds, skipped write cycles and scheduling metrics; WriterRunnable/EngineContext change.

Prerequisites: PR489 package relocation affects writer ArrayListEventStream imports.

### PR515

Merge/squash: `31d05acfc52e0665e3cae86ea83b0c3c86f5f401`. Adds a TAR storage feature and changes existing file IO.

New tar provider/channel classes and ETL postoptimizers; ReverseLineByteStream replaces path.toFile().length with Files.size.

Prerequisites: PR504 PVPath and ArchPaths abstraction; PR436 adds Parquet support, and PR427 introduces the ParquetEventFileWriter class modified here. The writer introduction is commit b931c504 in PR427; PR436 alone is insufficient.

### PR516

Merge/squash: `d4de4e5a8a16bbee9374fe181572a9a556b54620`. Production subscription switches to DBE_ARCHIVE.

EPICS_V4_PV subscribes with RecordOptions.builder().dbeMask(DBE_ARCHIVE).

Prerequisites: core-pva 5.0.5 already in baseline pom; actual JAR contains RecordOptions classes. Gradle version hunk must be omitted/adapted.

### PR509

Merge/squash: `97a31758eeca8899c1a0fe9b57258d6bc36cbfb9`. Mostly CI/test changes, but conservative retain pending whole tool/build review.

Adds explodeWars Sync tasks and rewrites integrationTestSetup; embedded test runtime additions.

Prerequisites: PR485 catalog; embedded Tomcat API version follows upstream Tomcat 11. No production src/main files in file inventory.

### PR520

Merge/squash: `a966378b689b654ca7bab90a44381cd1632b5331`. Changes production protobuf decoding and retrieval framing.

PBEventRecovery.parseWithRecovery appended LF and buildPartial fallback; all event decoders call it.

Prerequisites: PR392 generated message exposure and PR387/PR415 renamed file stream context require adaptation checks.

### PR517

Merge/squash: `c7839f7dc968e6d6aecfb07ac265d6f4b52d1431`. Sole modified production class is absent at baseline.

TarSeekableByteChannel delays deleting an old tar entry until append completes.

Prerequisites: PR515 introduces TarSeekableByteChannel and TAR provider.

### PR521

Merge/squash: `b3e7eb01660a5843bc667e855534629d5787170a`. Changes existing PB append/recovery behavior despite target class split.

PBAppendDataStateData truncates damaged tail at PBFileInfo truncationPoint before appending.

Prerequisites: PR415 splits baseline AppendDataStateData into abstract/PB classes; PR414 FileInfo abstraction; path rename alone is not missing behavior.

### PR523

Merge/squash: `15b4cbba9bc46f0258e69d4fb1e98faf64dea6e3`. Production refactor is neither prose, CI nor test-only.

ProcessMetricsChartData replaces indexed loop with enhanced for; multiple production classes change.

Prerequisites: Upstream post-baseline ETL and count shapes cause overlapping source contexts; exact minimum chain unproven.

### PR525

Merge/squash: `f0c1c568896989e054cc6340ec5dc43cecad7aa9`. Only Gradle JCA version edit; Maven already has the target version.

gradle/libs.versions.toml jca 2.4.7 -> 2.4.12; current pom.xml jca is 2.4.12.

Prerequisites: PR485 absent catalog; no remaining Maven dependency upgrade to carry.

### PR513

Merge/squash: `58fa7b12951dbe99507a641d272ddcd34361ad6e`. Contains production Hazelcast classloader changes plus Docker/build tooling.

DefaultConfigService sets context classloader on member config and clientConfig before Hazelcast creation.

Prerequisites: PR485 catalog and upstream Docker layout affect non-Java hunks.

### PR527

Merge/squash: `7d3f7e9ff7a7db48d52fde68bad4d94874fd4af7`. Contains substantial production lifecycle, PVA, validation and retrieval fixes.

DataRetrievalServlet gains HTTP proxy timeouts and Jython classloader pinning; shutdown paths change.

Prerequisites: PR509 embedded test infrastructure; PR507 writer changes; PR516 subscription context; full symbol closure pending.

### PR494

Merge/squash: `d428c82bcd6e162cdae980db767349d60b2323dc`. Documentation reorganization also changes executable build and packaging behavior.

build.gradle.kts introduces docsVenv/docsInstall tasks; Dockerfile Sphinx build and copy source paths change.

Prerequisites: PR493 docs environment and PR513 Docker multi-stage build context.

### PR530

Merge/squash: `c51ce0f99358db011bd0ef7e2bf3e1196c66d3fb`. Conservative retention of documentation build dependency/configuration change.

pyproject adds sphinxcontrib-mermaid and conf.py enables its extension.

Prerequisites: PR494 moves conf.py; docs build config exists in older layout, so path absence alone is not a gate.

### PR490

Merge/squash: `93a4d15e465e6200e173169d4d774c2cb964cf67`. Toolchain feature remains a scoring candidate: mixed executable configuration, including existing .readthedocs.yaml. Fixed Java 21 is an adoption constraint, not a mechanical removal category.

build.gradle.kts languageVersion 21 -> 25; Docker build/runtime JDK changes to 25.

Prerequisites: Gradle and Java 25 migration are outside fixed platform boundary.

### PR536

Merge/squash: `4d91526a65af457cfe1a6db1cb4a7fb0c36c9639`. Sole change targets Gradle release packaging absent at Maven baseline.

buildRelease sample script filePermissions adds execute for user/group/other.

Prerequisites: Absent build.gradle.kts/buildRelease; Maven equivalent requires a separate adaptation decision.

### PR534

Merge/squash: `5aac57d8076a944ce7f24c0233a0b60907e356e4`. Fix exclusively targets the new PVPath-based getPath implementation absent at baseline.

ArchPaths root-folder branch checks pvPath.isPackFile and getParentPathForCreation.

Prerequisites: PR504 adds PVPath and this ArchPaths control flow.

### PR535

Merge/squash: `a7a938e56811f29786a8aefe91103614cb3e4430`. Production browser behavior changes even though links point at help.

Six help handlers change target URL; index.html also removes duplicate ready/click registration.

Prerequisites: PR494 help document reorganization explains target change; baseline help layout differs.

### PR539

Merge/squash: `f86b5738e308e4482eb6dc8cf7aca852275cfcbc`. Sole change targets absent Gradle WAR packaging.

mgmtWar excludes **/.doctrees from docs/build copy.

Prerequisites: Absent Gradle mgmtWar; PR494 doc output path change.

## Source review findings

The following concerns come from original merge source inspected by the independent reviewers. They are static findings or source-derived risks, not reproduced runtime failures. The bounded PR409 compiler failure is the separate executed result described above. A numerical recommendation does not resolve these concerns or prove the complete prerequisite chain.

- **PR368, PR376, PR488:** the ETL scheduler stores its scheduled future on `ETLStages`, while cancellation inspects the individual `ETLStage` futures. Reassignment adds property/type and ordering concerns; later asynchronous cancellation changes what callers can know about completion. Pause, delete, reassignment and shutdown need actual lifecycle verification if this chain is selected.
- **PR397:** the new `SimulationEvent(Instant, ...)` constructor assigns year and whole seconds without assigning the Instant's nanoseconds. Timestamp precision requires verification before using that API.
- **PR405, PR415:** the new event JSON path creates an empty fields map without populating event metadata; plugin URL serialization uses the compression key for every options-map entry. These affect output contracts beyond the storage abstraction itself.
- **PR410, PR458, PR491:** stored chunk-key loading and ZIP configuration interpretation change. `ChunkKeyKeyMapping` uses `String.replace(char, char)` to change a terminator, affecting internal occurrences as well as the suffix. Existing data paths and configured compression URLs need preservation checks.
- **PR421:** JSON-simple parsing is followed by an `org.json.JSONArray` type check. The string waveform path can therefore return an empty list. The generic-bytes branch also converts `value.toString()` to bytes instead of preserving the original `ByteBuffer` payload.
- **PR427:** management conversion requests use `/convertFiles` or `/consolidateDataForPV`, while the new ETL action is `/changeStore`; request parameters also differ (`newbackend` and `newPlugin`). Lower layers can log conversion failure without returning it to the caller. The helper-level tests do not establish the management-to-ETL HTTP contract.
- **PR429, PR433, PR461:** reassignment closes the response writer inside the PV loop. The alias missing-status branch still indexes the status map by the incoming name rather than the real name. The later normalization change does not by itself prove that branch safe.
- **PR436:** Parquet iteration can stop at one file's EOF before advancing to the next file. Reader cleanup and suppressed storage errors need real-file checks. The ZSTD URL-options branch constructs a map without returning it. A failed source read may be omitted from the data stream while the input still appears in the moved-path list.
- **PR480:** present null metadata values can reach `Collectors.toMap` when `excludeV4Changes` is true, before the later null filter. The added false-flag test does not cover this production branch or establish preservation of PR445's null handling.
- **PR504:** a post-processing lookup map stores String URI keys but is queried with a `Path`. Existing post-processed output can be classified as missing.
- **PR507, PR527:** periodic flush, year-change and removal use different coordination paths around shared sample buffers and file writes. The later JCA shutdown change shortens the queue-drain wait before interruption. No stress or shutdown test was executed for these candidate changes.
- **PR515:** NIO full-read code uses inconsistent offset/limit accounting and does not consistently reject short reads. TAR replacement marks an old entry deleted before append and logs failures without propagating them. Failed replacement must preserve readable data and report failure; the inspected source does not establish that invariant.
- **PR520, PR521:** the useful raw-byte lifetime correction is bundled with recovery that accepts partial protobuf messages. Subsequent tail truncation also changes data acceptance and preservation. The complete recovery path needs actual malformed-record and interrupted-write verification before adoption.
- **PR434, PR439, PR490, PR509:** Jakarta/Tomcat 11, Java 25, Gradle protobuf generation and embedded test/runtime changes carry integration costs incompatible with assuming an unchanged Maven/Java 21/Tomcat 9 platform. A dependency version change alone is not verified CVE remediation.
- **PR494, PR535:** the documentation reorganization deletes `docs/build_docs.sh` and moves sample paths still referenced by the fork's `pom.xml`. Its management-scriptables include traverses outside the repository, and some relative Javadoc links retain their old depth. Direct application of the help-link PR does not verify a working Maven/Sphinx/WAR output.

Full per-candidate reviewer notes and exact source/check references remain in the local raw score files and reports. The list above groups consequential findings for owner review; it does not authorize corrective implementation. Reviewers used original diffs, source objects and lexical comparisons, with varying coverage of large formatting, generated, test and documentation payloads. The score table must not be read as an exhaustive line-by-line audit or a passing runtime verification.

## Five-reviewer results

All 72 candidates have five independent score rows (360 assessments). 21 meet the numerical rule; 51 do not. No row is an adoption decision. This is a static assessment: no reviewer executed a clean build or runtime test of the candidates. Generated output, formatting, test bodies and documentation do not have uniform line-by-line coverage; substantive production/build inspection used original source and lexical comparisons.

Each value below is the median of five integer scores on that axis. Total is the sum of the eight medians, out of 80. The rule is total >= 40 OR bug >= 5 OR safety >= 5 OR urgency >= 5. Rows retain upstream integration order; prerequisites and application results remain in the disposition details above.

| PR | security | safety | bug | perf | ops | urgency | fit | locality | Total | Conditions met |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| [#359](#pr359) | 0 | 1 | 6 | 0 | 6 | 4 | 6 | 7 | 30 | bug>=5 |
| [#364](#pr364) | 0 | 2 | 6 | 0 | 6 | 4 | 8 | 7 | 33 | bug>=5 |
| [#365](#pr365) | 0 | 2 | 3 | 1 | 3 | 2 | 3 | 3 | 17 | None |
| [#368](#pr368) | 0 | 3 | 5 | 6 | 6 | 3 | 1 | 1 | 25 | bug>=5 |
| [#372](#pr372) | 0 | 0 | 0 | 0 | 1 | 0 | 4 | 5 | 10 | None |
| [#370](#pr370) | 0 | 0 | 0 | 0 | 1 | 0 | 2 | 1 | 4 | None |
| [#360](#pr360) | 0 | 5 | 6 | 0 | 6 | 5 | 5 | 6 | 33 | bug>=5, safety>=5, urgency>=5 |
| [#382](#pr382) | 0 | 0 | 0 | 0 | 1 | 0 | 3 | 5 | 9 | None |
| [#378](#pr378) | 0 | 0 | 0 | 0 | 2 | 0 | 1 | 3 | 6 | None |
| [#376](#pr376) | 0 | 2 | 3 | 2 | 6 | 2 | 1 | 1 | 17 | None |
| [#385](#pr385) | 0 | 2 | 7 | 1 | 7 | 5 | 4 | 4 | 30 | bug>=5, urgency>=5 |
| [#387](#pr387) | 0 | 0 | 0 | 0 | 2 | 0 | 2 | 1 | 5 | None |
| [#389](#pr389) | 0 | 0 | 0 | 0 | 1 | 0 | 3 | 7 | 11 | None |
| [#393](#pr393) | 0 | 1 | 3 | 0 | 3 | 2 | 3 | 6 | 18 | None |
| [#390](#pr390) | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 9 | 14 | None |
| [#397](#pr397) | 0 | 0 | 1 | 0 | 2 | 0 | 5 | 7 | 15 | None |
| [#396](#pr396) | 0 | 1 | 1 | 0 | 2 | 0 | 9 | 8 | 21 | None |
| [#392](#pr392) | 0 | 0 | 1 | 1 | 2 | 0 | 2 | 2 | 8 | None |
| [#400](#pr400) | 0 | 0 | 1 | 0 | 2 | 0 | 3 | 5 | 11 | None |
| [#402](#pr402) | 0 | 1 | 2 | 6 | 4 | 2 | 2 | 4 | 21 | None |
| [#403](#pr403) | 0 | 0 | 1 | 0 | 1 | 0 | 3 | 4 | 9 | None |
| [#406](#pr406) | 0 | 1 | 3 | 3 | 4 | 2 | 2 | 4 | 19 | None |
| [#408](#pr408) | 0 | 0 | 1 | 4 | 3 | 2 | 3 | 5 | 18 | None |
| [#409](#pr409) | 0 | 0 | 4 | 4 | 6 | 3 | 1 | 5 | 23 | None |
| [#404](#pr404) | 0 | 1 | 2 | 2 | 3 | 1 | 1 | 2 | 12 | None |
| [#405](#pr405) | 0 | 2 | 5 | 2 | 5 | 3 | 1 | 2 | 20 | bug>=5 |
| [#410](#pr410) | 0 | 0 | 1 | 0 | 2 | 1 | 1 | 2 | 7 | None |
| [#414](#pr414) | 0 | 1 | 1 | 0 | 3 | 1 | 2 | 3 | 11 | None |
| [#417](#pr417) | 0 | 0 | 1 | 0 | 4 | 1 | 9 | 9 | 24 | None |
| [#416](#pr416) | 0 | 0 | 1 | 0 | 6 | 2 | 4 | 6 | 19 | None |
| [#423](#pr423) | 0 | 1 | 5 | 0 | 5 | 3 | 9 | 9 | 32 | bug>=5 |
| [#421](#pr421) | 0 | 1 | 3 | 0 | 4 | 2 | 1 | 4 | 15 | None |
| [#415](#pr415) | 0 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | 8 | None |
| [#425](#pr425) | 0 | 7 | 7 | 1 | 7 | 6 | 8 | 7 | 43 | total>=40, bug>=5, safety>=5, urgency>=5 |
| [#429](#pr429) | 0 | 1 | 5 | 0 | 5 | 2 | 1 | 3 | 17 | bug>=5 |
| [#433](#pr433) | 0 | 2 | 5 | 0 | 5 | 3 | 2 | 5 | 22 | bug>=5 |
| [#434](#pr434) | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 2 | None |
| [#439](#pr439) | 0 | 1 | 1 | 1 | 2 | 0 | 0 | 1 | 6 | None |
| [#452](#pr452) | 0 | 2 | 7 | 1 | 7 | 5 | 2 | 5 | 29 | bug>=5, urgency>=5 |
| [#454](#pr454) | 0 | 0 | 0 | 0 | 4 | 1 | 6 | 9 | 20 | None |
| [#445](#pr445) | 0 | 7 | 6 | 0 | 7 | 5 | 9 | 8 | 42 | total>=40, bug>=5, safety>=5, urgency>=5 |
| [#448](#pr448) | 0 | 3 | 7 | 1 | 7 | 5 | 2 | 2 | 27 | bug>=5, urgency>=5 |
| [#461](#pr461) | 0 | 2 | 6 | 0 | 6 | 4 | 2 | 5 | 25 | bug>=5 |
| [#462](#pr462) | 0 | 0 | 4 | 0 | 4 | 3 | 9 | 9 | 29 | None |
| [#458](#pr458) | 0 | 1 | 5 | 0 | 5 | 4 | 1 | 3 | 19 | bug>=5 |
| [#436](#pr436) | 0 | 1 | 1 | 4 | 3 | 1 | 0 | 0 | 10 | None |
| [#473](#pr473) | 0 | 1 | 4 | 0 | 6 | 4 | 3 | 7 | 25 | None |
| [#474](#pr474) | 0 | 0 | 2 | 0 | 2 | 1 | 4 | 8 | 17 | None |
| [#427](#pr427) | 0 | 1 | 1 | 1 | 3 | 1 | 0 | 0 | 7 | None |
| [#480](#pr480) | 0 | 3 | 4 | 0 | 5 | 3 | 3 | 7 | 25 | None |
| [#481](#pr481) | 0 | 0 | 1 | 0 | 2 | 1 | 8 | 8 | 20 | None |
| [#488](#pr488) | 0 | 2 | 3 | 4 | 4 | 2 | 1 | 2 | 18 | None |
| [#491](#pr491) | 0 | 0 | 1 | 0 | 2 | 0 | 1 | 2 | 6 | None |
| [#493](#pr493) | 0 | 0 | 1 | 0 | 2 | 0 | 2 | 6 | 11 | None |
| [#498](#pr498) | 0 | 1 | 3 | 6 | 5 | 3 | 1 | 2 | 21 | None |
| [#489](#pr489) | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 1 | 3 | None |
| [#501](#pr501) | 0 | 3 | 7 | 0 | 7 | 4 | 4 | 6 | 31 | bug>=5 |
| [#505](#pr505) | 0 | 2 | 6 | 0 | 6 | 4 | 3 | 8 | 29 | bug>=5 |
| [#504](#pr504) | 0 | 1 | 1 | 2 | 3 | 1 | 0 | 1 | 9 | None |
| [#507](#pr507) | 0 | 2 | 3 | 8 | 6 | 3 | 1 | 1 | 24 | None |
| [#515](#pr515) | 0 | 0 | 1 | 3 | 3 | 0 | 0 | 0 | 7 | None |
| [#516](#pr516) | 0 | 1 | 6 | 2 | 7 | 4 | 5 | 7 | 32 | bug>=5 |
| [#509](#pr509) | 0 | 1 | 1 | 0 | 3 | 0 | 1 | 2 | 8 | None |
| [#520](#pr520) | 0 | 2 | 5 | 0 | 4 | 3 | 1 | 2 | 17 | bug>=5 |
| [#521](#pr521) | 0 | 6 | 7 | 0 | 7 | 5 | 2 | 4 | 31 | bug>=5, safety>=5, urgency>=5 |
| [#523](#pr523) | 0 | 0 | 1 | 1 | 2 | 0 | 2 | 2 | 8 | None |
| [#513](#pr513) | 0 | 2 | 4 | 0 | 4 | 2 | 1 | 2 | 15 | None |
| [#527](#pr527) | 0 | 6 | 7 | 1 | 6 | 4 | 1 | 1 | 26 | bug>=5, safety>=5 |
| [#494](#pr494) | 0 | 0 | 1 | 0 | 2 | 0 | 1 | 3 | 7 | None |
| [#530](#pr530) | 0 | 0 | 2 | 0 | 2 | 1 | 3 | 9 | 17 | None |
| [#490](#pr490) | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 2 | None |
| [#535](#pr535) | 0 | 0 | 3 | 0 | 3 | 1 | 8 | 9 | 24 | None |

### Raw score vectors

Axis order: security / safety / bug / perf / ops / urgency / fit / locality. These original values preserve the arithmetic independently of the working directory. Full reviewer notes, source coverage limits and command records remain in the local audit artifacts.

| PR | Reviewer 1 | Reviewer 2 | Reviewer 3 | Reviewer 4 | Reviewer 5 |
| --- | --- | --- | --- | --- | --- |
| PR359 | 0/1/6/0/5/3/5/6 | 0/1/5/0/6/4/6/7 | 0/0/4/0/4/3/5/8 | 0/1/6/0/6/4/6/7 | 0/2/6/0/6/4/6/7 |
| PR364 | 0/2/6/0/6/4/9/8 | 0/2/5/0/6/4/8/8 | 0/3/6/0/6/5/8/6 | 0/1/6/0/6/4/8/7 | 0/2/6/0/6/4/8/7 |
| PR365 | 0/3/4/1/3/2/3/2 | 0/1/2/1/3/1/2/2 | 0/2/3/0/3/2/3/3 | 0/2/3/1/3/2/2/3 | 0/1/3/1/4/2/3/3 |
| PR368 | 0/3/5/5/6/3/1/0 | 0/2/4/7/6/3/1/1 | 0/2/3/7/5/2/1/0 | 0/4/5/6/6/4/0/1 | 0/3/5/5/7/4/2/1 |
| PR372 | 0/0/0/0/0/0/4/5 | 0/1/1/1/2/1/4/4 | 0/0/0/0/1/0/4/5 | 0/0/0/0/1/0/4/5 | 0/0/0/0/1/0/5/5 |
| PR370 | 0/0/0/0/1/0/2/0 | 0/1/1/1/2/1/2/2 | 0/0/0/0/1/0/2/1 | 0/0/0/0/1/0/1/1 | 0/0/0/0/1/0/1/1 |
| PR360 | 0/5/5/0/6/4/5/5 | 0/5/5/0/5/4/5/6 | 0/5/6/0/6/5/4/6 | 0/7/7/1/8/7/5/6 | 0/7/7/1/7/6/6/7 |
| PR382 | 0/0/0/0/1/0/3/5 | 0/0/0/0/1/0/2/3 | 0/0/0/0/1/0/2/8 | 0/0/0/0/1/0/3/4 | 0/0/0/0/2/0/4/5 |
| PR378 | 0/0/0/0/2/0/1/3 | 0/0/0/0/2/0/2/3 | 0/0/0/0/2/0/1/7 | 0/1/1/0/3/1/1/3 | 0/0/0/0/3/1/3/4 |
| PR376 | 0/2/5/1/6/2/1/1 | 0/2/3/3/6/3/1/1 | 0/1/1/2/4/1/1/1 | 0/2/4/2/6/3/0/1 | 0/1/2/2/5/2/1/1 |
| PR385 | 0/2/7/1/7/5/6/5 | 0/2/6/6/7/5/3/3 | 0/2/6/1/5/4/3/4 | 0/3/8/2/8/7/4/4 | 0/3/7/1/7/5/4/5 |
| PR387 | 0/0/0/0/1/0/2/0 | 0/1/1/1/2/1/1/1 | 0/0/0/0/1/0/2/1 | 0/0/1/0/2/1/1/1 | 0/0/0/0/2/0/2/1 |
| PR389 | 0/0/0/0/1/0/3/6 | 0/0/0/0/1/0/3/4 | 0/0/0/0/1/0/3/7 | 0/0/0/0/1/0/3/7 | 0/0/0/0/1/0/4/8 |
| PR393 | 0/1/3/0/3/1/3/5 | 0/2/4/0/4/2/2/3 | 0/1/1/0/2/1/3/6 | 0/2/5/0/5/3/3/6 | 0/1/3/0/3/2/3/6 |
| PR390 | 0/0/0/0/0/0/4/9 | 0/0/0/0/1/0/5/8 | 0/0/0/0/0/0/5/9 | 0/0/0/0/0/0/5/9 | 0/0/0/0/1/0/5/10 |
| PR397 | 0/0/1/0/1/0/5/7 | 0/0/1/0/2/0/4/6 | 0/0/1/0/1/0/6/8 | 0/0/1/0/2/1/5/7 | 0/0/1/0/2/1/5/7 |
| PR396 | 0/0/0/0/1/0/9/8 | 0/2/1/0/2/1/8/8 | 0/1/1/0/1/0/9/8 | 0/1/1/0/2/1/8/7 | 0/1/1/0/2/0/9/8 |
| PR392 | 0/0/0/0/1/0/4/2 | 0/1/1/1/3/1/2/2 | 0/0/0/1/1/0/2/2 | 0/1/1/1/2/1/2/2 | 0/0/1/0/2/0/3/2 |
| PR400 | 0/0/0/0/1/0/3/5 | 0/1/1/0/2/1/2/3 | 0/0/0/0/1/0/3/6 | 0/0/1/0/2/1/3/5 | 0/0/1/0/2/0/4/6 |
| PR402 | 0/1/1/5/4/1/2/4 | 0/1/3/7/6/3/2/3 | 0/0/1/6/4/2/2/5 | 0/1/2/5/4/2/2/4 | 0/2/2/6/5/3/2/3 |
| PR403 | 0/0/0/0/1/0/2/3 | 0/1/2/1/3/1/3/3 | 0/0/0/0/1/0/4/7 | 0/0/1/0/1/0/3/5 | 0/0/1/0/2/0/3/4 |
| PR406 | 0/1/3/3/4/2/1/2 | 0/1/4/6/6/3/2/3 | 0/1/1/3/3/1/2/4 | 0/2/3/2/4/2/2/5 | 0/1/2/5/5/3/2/4 |
| PR408 | 0/0/1/3/3/1/2/3 | 0/1/3/6/5/2/3/4 | 0/0/1/4/3/1/3/5 | 0/0/2/4/3/2/3/6 | 0/0/1/5/4/2/5/5 |
| PR409 | 0/0/4/2/4/2/1/2 | 0/1/3/7/6/3/2/3 | 0/0/1/6/4/2/1/5 | 0/0/6/1/7/5/1/6 | 0/1/6/4/7/4/2/6 |
| PR404 | 0/1/1/1/2/0/1/1 | 0/2/3/5/5/2/1/2 | 0/0/0/2/2/0/2/2 | 0/3/3/3/4/2/1/2 | 0/1/2/2/3/1/2/1 |
| PR405 | 0/2/6/3/6/3/1/1 | 0/2/5/4/6/4/1/1 | 0/1/2/2/3/1/2/2 | 0/2/5/1/5/3/0/3 | 0/1/4/2/5/3/2/2 |
| PR410 | 0/0/1/0/2/0/1/1 | 0/1/2/0/3/2/2/2 | 0/0/1/0/2/1/1/2 | 0/0/1/0/2/1/2/4 | 0/0/1/0/3/1/1/1 |
| PR414 | 0/2/3/0/3/1/2/2 | 0/1/1/1/3/1/2/2 | 0/1/1/1/2/1/3/4 | 0/1/1/0/2/1/2/3 | 0/2/2/0/3/1/3/3 |
| PR417 | 0/0/1/0/3/1/9/9 | 0/0/1/0/4/1/9/9 | 0/0/0/1/3/1/9/9 | 0/1/2/0/4/2/9/8 | 0/0/0/1/5/2/9/9 |
| PR416 | 0/2/2/1/6/2/4/3 | 0/0/1/0/5/1/4/7 | 0/0/1/1/4/2/5/7 | 0/0/1/0/6/2/4/5 | 0/1/1/0/7/3/6/6 |
| PR423 | 0/0/4/0/5/3/9/8 | 0/1/5/0/6/4/8/8 | 0/1/5/0/5/4/9/9 | 0/1/5/0/5/3/9/9 | 0/1/5/0/5/3/9/9 |
| PR421 | 0/1/1/0/1/0/1/4 | 0/1/3/0/4/2/2/2 | 0/0/2/0/2/1/1/5 | 0/2/4/1/4/3/1/3 | 0/1/3/0/4/2/1/5 |
| PR415 | 0/1/1/1/2/0/1/0 | 0/1/1/2/3/1/1/1 | 0/0/1/2/2/0/1/1 | 0/1/1/1/2/1/1/1 | 0/1/2/1/3/1/2/1 |
| PR425 | 0/7/6/1/7/5/8/5 | 0/1/2/0/3/2/7/8 | 0/7/7/1/7/6/8/7 | 0/8/8/1/9/8/8/7 | 0/8/7/0/8/6/9/7 |
| PR429 | 0/1/5/0/5/2/1/2 | 0/1/2/0/4/2/1/2 | 0/1/3/0/3/2/1/3 | 0/2/5/0/6/3/1/4 | 0/1/5/0/5/3/1/3 |
| PR433 | 0/2/5/0/5/3/2/3 | 0/1/4/0/5/3/2/3 | 0/3/4/0/4/3/2/5 | 0/2/6/0/6/4/2/7 | 0/3/5/0/6/4/2/6 |
| PR434 | 0/0/0/0/0/0/0/0 | 1/1/1/1/1/0/0/0 | 0/0/0/0/1/0/0/0 | 0/1/1/0/1/0/0/1 | 0/0/1/0/2/0/0/0 |
| PR439 | 1/1/1/1/1/0/0/1 | 1/1/1/1/2/0/0/1 | 0/0/1/1/2/1/0/1 | 0/1/1/0/2/1/0/1 | 0/1/1/0/2/0/0/1 |
| PR452 | 0/2/7/0/7/5/4/6 | 0/2/6/1/6/4/2/3 | 0/2/7/1/6/5/2/5 | 0/2/7/0/7/6/2/5 | 0/3/7/1/7/5/3/5 |
| PR454 | 0/0/0/0/4/1/7/9 | 0/0/1/0/4/1/6/9 | 0/0/0/0/3/1/6/10 | 0/0/2/0/5/2/6/9 | 0/0/0/0/6/2/7/10 |
| PR445 | 0/7/6/0/7/5/9/8 | 0/5/5/0/5/4/8/8 | 0/6/6/0/6/5/9/8 | 0/7/7/0/8/7/9/9 | 0/7/7/0/7/6/9/9 |
| PR448 | 0/2/7/1/7/4/2/2 | 0/2/6/2/6/4/1/2 | 0/3/7/1/6/5/2/4 | 0/3/8/1/8/7/1/3 | 0/3/7/0/7/5/2/2 |
| PR461 | 0/2/6/0/6/4/2/3 | 0/1/5/0/6/4/2/2 | 0/3/5/0/5/4/2/5 | 0/2/7/0/7/5/2/6 | 0/3/7/0/7/5/2/6 |
| PR462 | 0/0/4/0/5/3/9/8 | 0/0/0/0/1/0/6/8 | 0/1/4/0/4/3/9/9 | 0/0/4/0/4/2/10/10 | 0/1/5/0/5/3/9/10 |
| PR458 | 0/1/5/0/5/2/1/2 | 0/1/5/0/6/4/1/2 | 0/1/5/0/5/4/1/3 | 0/2/5/0/5/3/2/4 | 0/2/7/0/7/4/1/3 |
| PR436 | 0/1/1/4/3/0/0/0 | 0/1/1/4/2/1/0/0 | 0/1/1/6/4/0/0/0 | 0/1/2/2/3/1/0/1 | 0/0/2/4/5/2/1/0 |
| PR473 | 0/1/4/0/6/3/3/4 | 0/1/5/0/6/4/2/3 | 0/0/1/0/3/1/3/7 | 0/2/4/0/7/4/2/8 | 0/2/2/0/8/4/3/8 |
| PR474 | 0/0/1/0/2/0/4/7 | 0/0/1/0/2/0/4/7 | 0/0/2/0/2/1/4/9 | 0/0/2/0/2/1/4/8 | 0/0/2/0/3/1/5/8 |
| PR427 | 0/0/1/1/2/0/0/0 | 0/2/1/2/3/1/0/0 | 0/1/1/2/4/0/0/1 | 0/1/3/0/3/1/0/2 | 0/0/2/1/5/1/0/0 |
| PR480 | 0/5/4/0/5/3/5/7 | 0/5/5/0/5/4/6/7 | 0/2/3/0/3/2/2/6 | 0/3/4/0/5/3/3/8 | 0/2/3/0/4/2/3/7 |
| PR481 | 0/0/0/0/1/0/9/8 | 0/0/2/0/3/1/8/9 | 0/0/0/1/1/0/7/8 | 0/0/1/0/2/1/7/8 | 0/0/3/0/3/1/9/9 |
| PR488 | 0/2/3/2/4/2/1/2 | 0/1/2/4/4/2/1/2 | 0/2/2/6/4/2/1/2 | 0/4/5/2/6/4/1/3 | 0/2/4/6/6/3/2/2 |
| PR491 | 0/0/1/1/1/0/1/2 | 0/1/1/1/2/0/1/2 | 0/0/0/0/1/0/1/3 | 0/0/1/0/2/1/1/3 | 0/0/1/0/2/0/2/2 |
| PR493 | 0/0/0/0/1/0/2/6 | 0/0/1/0/2/0/2/3 | 0/0/0/0/2/0/2/7 | 0/0/1/0/2/1/2/5 | 0/0/1/0/2/0/3/7 |
| PR498 | 0/1/3/5/4/2/1/2 | 0/1/3/7/6/3/1/2 | 0/1/2/6/4/2/1/2 | 0/1/3/6/5/3/1/2 | 0/1/3/6/6/3/2/2 |
| PR489 | 0/0/0/0/1/0/1/0 | 0/0/0/0/2/0/1/1 | 0/0/0/0/1/0/1/1 | 0/0/0/0/1/0/1/2 | 0/0/0/0/2/0/1/1 |
| PR501 | 0/2/7/0/7/4/4/6 | 0/2/6/1/6/4/3/3 | 0/3/6/0/6/4/4/6 | 0/3/7/0/7/5/3/6 | 0/3/7/0/7/5/7/8 |
| PR505 | 0/1/6/0/6/4/3/6 | 0/1/5/0/5/3/3/4 | 0/2/6/0/5/4/5/8 | 0/2/6/0/6/4/3/8 | 0/2/6/0/6/4/6/9 |
| PR504 | 0/1/1/1/3/0/0/0 | 0/1/1/2/3/1/0/1 | 0/0/1/2/3/0/0/1 | 0/2/2/1/3/2/0/2 | 0/1/3/2/4/2/1/1 |
| PR507 | 0/2/4/8/6/3/1/0 | 0/1/2/8/6/2/1/1 | 0/2/3/8/5/2/1/1 | 0/3/4/7/6/3/1/1 | 0/2/3/7/7/3/2/1 |
| PR515 | 0/0/0/3/1/0/0/0 | 0/1/0/3/2/0/0/0 | 0/0/1/6/4/0/0/0 | 0/1/2/2/3/1/0/1 | 0/0/2/3/4/1/0/0 |
| PR516 | 0/1/6/2/6/4/5/5 | 0/1/6/2/7/5/5/7 | 0/1/3/5/6/3/5/7 | 0/2/6/0/7/5/5/8 | 0/2/5/4/7/4/6/7 |
| PR509 | 0/0/1/2/2/0/0/1 | 0/1/1/0/3/1/0/1 | 0/0/0/0/2/0/1/5 | 0/2/2/0/3/1/1/2 | 0/1/0/0/3/0/1/2 |
| PR520 | 0/1/5/0/3/3/1/1 | 0/2/3/0/4/2/1/2 | 0/4/7/0/6/5/2/4 | 0/4/6/0/6/4/1/2 | 0/1/3/0/4/2/2/3 |
| PR521 | 0/3/6/0/6/4/2/3 | 0/2/5/0/6/4/1/2 | 0/6/7/0/7/5/2/4 | 0/6/7/0/7/6/2/4 | 0/7/8/0/8/6/3/4 |
| PR523 | 0/1/1/1/2/0/2/1 | 0/1/1/1/2/0/1/2 | 0/0/0/1/1/0/3/3 | 0/0/1/0/1/0/2/2 | 0/0/1/1/2/0/2/2 |
| PR513 | 0/2/4/1/4/1/1/2 | 0/1/1/1/4/1/1/2 | 0/2/4/0/4/2/1/3 | 0/3/4/0/4/2/1/2 | 0/3/4/0/4/2/2/2 |
| PR527 | 0/5/6/2/6/3/1/0 | 0/5/5/1/5/3/1/1 | 0/6/7/2/6/4/0/0 | 1/7/8/1/8/6/1/1 | 1/7/7/1/7/5/2/1 |
| PR494 | 0/0/1/0/2/0/1/2 | 0/0/1/0/2/0/0/1 | 0/0/1/0/2/0/1/6 | 0/0/1/0/3/1/1/3 | 0/0/2/0/3/0/1/3 |
| PR530 | 0/0/2/0/2/1/2/6 | 0/0/2/0/2/0/3/6 | 0/0/0/0/1/0/3/10 | 0/0/2/0/2/1/3/9 | 0/0/2/0/2/1/4/9 |
| PR490 | 0/0/0/1/0/0/0/1 | 0/0/0/1/1/0/0/0 | 0/0/0/0/1/0/0/5 | 0/0/0/0/0/0/0/2 | 0/0/0/0/1/0/0/1 |
| PR535 | 0/0/3/0/3/1/4/8 | 0/0/3/0/4/2/8/9 | 0/0/3/0/3/2/8/9 | 0/0/3/0/3/1/9/9 | 0/0/3/0/3/1/9/9 |

### Score provenance

- Reviewer 1: `panel_r1_scores_corrected.json`, SHA256 `3f05a62577fac8b2d06e366c031356cb6798a05c5eae25042e6ede94c75e895f`.
- Reviewer 2: `panel_r2_scores.json`, SHA256 `14ef10f0a5868308ca3a18ffe85a04b8d1828cdefae8f531e6a57209e33d914a`.
- Reviewer 3: `panel_r3_scores.json`, SHA256 `75a8d80c37e2903501209825fcaee1df6432d89c544196f1d84d47175737d1c1`.
- Reviewer 4: `panel_r4_scores_superseding_20260916_204111.json`, SHA256 `5364bcd519cb0e80e94032e4e842aff09b43e590cdf1ec854695a5094352d89f`.
- Reviewer 5: `panel_r5_scores.json`, SHA256 `7dfecfa4bc5f8b809d9c46746a5ea4c573633d799867c3c1023e717087194cd6`.

## Owner decision

The complete score table is available; owner selection is pending. No PR is selected or authorized for implementation. The 21 rule-passing rows are recommendations, including rows with unresolved source defects or substantial prerequisites. Complete dependency closure and affected real-path verification remain required for whichever PRs the owner selects.

## Audit material

Local original diffs, membership, application logs, classification data, scoring harness and raw reviewer output are under `work/archiverap-carry/` and the session named by its `session-path.txt`. Original changes remain reproducible from the full Git identities above.
