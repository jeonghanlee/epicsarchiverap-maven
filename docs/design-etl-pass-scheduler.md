# ETL pass scheduler design

Date: 2026-09-27
Status: draft 3, review closed (two rounds and two paired debates on 2026-09-27; the round-2 findings F024 to F037 are applied in this draft)
Register: `docs/milestone-daff1b7.md` M25 (issue #11), extended to this design

## Scope

This document covers how the ETL of one appliance is scheduled: when the
ETL jobs of one lifetime transition run, what one ETL pass is, and which
per-pass values the appliance reports. It replaces the per-PV timers with
one pass driver per (transition index, cadence).

**Out of scope:** what one ETL job moves and how (`ETLJob.processETL`, the
`ETLSource` and `ETLDest` plugins, hold and gather, post-processors); the
store layout; the cluster-wide distribution of PVs across appliances; the
mgmt UI beyond the ETL metrics rows and the per-PV ETL details rows; the
consolidate BPL run through `ETLExecutor`.

## Terms

- **Lifetime transition:** one source-to-destination store pair of a PV, numbered from 0 (STS to MTS is `0>1`). The number is the transition index.
- **ETL job:** one run of `ETLJob.processETL` for one PV and one transition.
- **Cadence:** `min(source partition seconds, 8 h)`, the interval between the planned firings of a driver.
- **Driver:** the object that owns the PV set, the running pass, and the pass records of one (transition index, cadence). The drivers of one transition index share that index's one worker thread.
- **Pass:** one run of the ETL jobs of every PV of one driver, started by one firing.
- **Grid:** the planned firing times of a driver: the epoch plus whole multiples of the cadence, plus the offset `5 min x (transition index + 1)`.
- **Tick:** one call of `tick(Instant now)` on a driver by the appliance's tick thread, or by a test.

## Current structure

- `PBThreeTierETLPVLookup.addETLJobs` registers one `ScheduledFuture` per PV and per transition on a single-thread `ScheduledThreadPoolExecutor` per transition index, with `scheduleWithFixedDelay(job, initialDelay, cadence)`. The executor, the PV map and the `ETLMetricsForLifetime` of an index are created at the first PV registered for that index.
- The cadence, the processing-time padding and the skip-store check are computed per PV from that PV's own source and destination store (`typeInfo.getDataStores()`).
- `initialDelay` is `Duration.between(nextExpectedETLRun, now)`, which is negative while the expected run is in the future; the executor clamps it to zero, so the first job runs at registration and every later job runs `cadence + own duration` after the previous one. Each PV keeps its own phase, and the config sync thread registers PVs at 5-minute intervals, so the jobs of one transition spread over the cadence.
- Which partitions a job moves is decided by the data, not by the timer: `ETLSource.getETLStreams` takes a processing time (`now - 10 % of the source partition`) and returns the partitions past hold and gather.
- The appliance-wide values in `ETLMetricsForLifetime` are sums of per-PV values, except `totalETLRuns`, which is the largest per-PV run count. The "last job" value adds each job's duration to one sum and resets it after 15 minutes without a job; no gap appears with a 5-minute cadence, so the value grows without bound. The same method is the only writer of the seven weekly-usage buckets.
- `ETLDetails` builds the per-PV row "ETL N next job runs at" from `getCancellingFuture().getDelay`.
- `ETLMetrics.metrics()` serves three keys to the mgmt appliance list (`totalETLRuns(N)`, `timeForOverallETLInSeconds(N)`, `maxETLPercentage`); `mgmt.js` reads `maxETLPercentage` for the "Max ETL(%)" column. `ETLMetrics.details()` serves the per-transition rows; no code, UI page or book page references their names.
- The ETL tests call `manualControlForUnitTests`, which shuts down the executors that exist at that moment; because the executors are created at the first registration, the call is effective only after registration, and the first job of each PV has already run at registration. `ZeroByteFilesTest` calls it before registering, so a scheduled job runs during that test. No test calls `postStartup`.

## Reference behavior

Linux services that move or expire files by age share one shape (logrotate, fstrim, systemd-tmpfiles-clean, cron with anacron, HSM policy engines):

1. One timer per cadence, and one process per firing that walks every target.
2. The targets are selected by their own state (age, size, boundary), not by the timer; logrotate and tmpfiles-clean do so, fstrim trims every mounted filesystem on each run.
3. A firing missed while the service was down is made up once at start when a run was missed (`Persistent=true` on `OnCalendar=` timers, anacron); `systemd-tmpfiles-clean.timer` is a monotonic timer with a fixed post-boot delay instead.
4. The pass itself is the unit of record: start, end, and counts come from the one process.

The current ETL has item 2, lacks items 1 and 4, and has item 3 only as the side effect of the negative initial delay. The references randomize their firing (`RandomizedDelaySec`) to spread load across many hosts; a single appliance has no such reason, so this design fires at a predictable time.

## Requirements

- R1. The ETL jobs of one transition run at a predictable time: shortly after the source partition boundary, offset per transition so that the earlier transition finishes first.
- R2. After a start, the first pass of every started driver runs at once; a PV registered later joins the next planned pass.
- R3. Passes of one transition index do not overlap, and a pass of transition t+1 does not start while a pass of transition t runs. A pass that ends past its next planned firing time is recorded as an overrun.
- R4. Adding or removing a PV needs no timer of its own. A new PV joins the next pass; a removed PV leaves the set before its consolidation runs, and no PV is processed by two jobs at once.
- R5. The values the appliance reports per transition come from pass records: the last completed pass, the pass in progress, and the weekly usage.
- R6. `ETLJob.processETL`, the store plugins, hold and gather, `ETLExecutor`, and the test entry `ETLJob(item, asIfTime).run()` keep their behavior; `ETLJob` only reports more about what it did.
- R7. `ARCHAPPL_SKIP_ETL_FOR_STORE` keeps its effect and gains one: no ETL job that the ETL lookup runs, in a pass or in the consolidation by pause, delete and shutdown, writes to the named destination. A consolidate request through `ETLExecutor` is not affected.
- R8. The scheduling path is tested through the real `ETLJob` and store plugins, with only the clock and the environment reader under test control.

## Proposed design

### Components

| Component | Owns | Change |
| --- | --- | --- |
| `ETLPassDriver` (new, one per (transition index, cadence)) | the PV set, the running pass, the pass records, the completed-pass count and busy total, the per-day busy totals | new class |
| `ETLPassTicker` (new, one per appliance) | the tick thread that calls `tick` on every driver every 5 s, in transition order | new class; created and started by `PBThreeTierETLPVLookup.postStartup` together with the per-index worker threads, all daemon threads named `ETL tick` and `ETL - <index>`, so tests and the non-ETL WARs have none and an abandoned job never keeps the JVM alive after the hook returns |
| `PBThreeTierETLPVLookup` | creation of drivers; the ticker and one worker thread per transition index (in `postStartup`); PV add and delete forward to the driver; the sticky test stop | `addETLJobs` and `deleteETLJobs` lose the per-PV futures; `deleteETLJobs` queues the consolidation on the index's worker thread (PV add and remove) |
| `ETLPVLookupItems` | per-PV state and per-PV metrics, read by `ETLDetails` and `StorageWithLifetime` | `cancellingFuture` and its accessors removed; the writes into `ETLMetricsForLifetime` in `addETLDurationInMillis` and `addInfoAboutDetailedTime` removed; a job reports whether `getETLStreams` completed, the count of streams it returned, the count of partitions moved (streams appended and committed), the bytes of those, the count of streams deleted for lack of space, and whether the commit succeeded |
| `ETLMetricsForLifetime` | the `FileStore` cache of one transition index | the per-index sums (`timeForOverallETLInMilliSeconds`, `totalETLRuns`, `startOfMetricsMeasurementInEpochSeconds`, the eight `timeinMillSecond4*` fields, `totalSrcBytes`) and their getters are removed with their writers; `updateApproximateGlobalLastETLTime`, `getApproximateLastGlobalETLTimeInMillis`, `getWeeklyETLUsageInPercent` and the weekly buckets are removed; the class keeps `getLifeTimeId` and `getFileStore` over a `ConcurrentHashMap`, because the cache is read from BPL and sync threads as well |
| `ETLMetrics` | `details()` rows and `metrics()` keys | `details()` rows replaced by the pass rows below; `metrics()` keeps its three keys, computed from pass records |
| `ETLDetails` | per-PV rows on the PV details page | the "next job runs at" row is sourced from the owning driver's next planned firing time |
| `ETLJob` | one ETL job | unchanged in behavior; reports to its lookup item the values listed under `ETLPVLookupItems` |

### Driver keying

Drivers are keyed by (transition index, cadence). A PV joins, at each transition, the driver of its own cadence, derived from its own source store partition; the offset depends on the index only. All drivers of one transition index share that index's one worker thread: their passes run one after another. While an index's worker thread runs, every `ETLJob` of that index runs on it, in a pass or in a consolidation, so the jobs of an index have one order and its pass records one writer. A pass whose planned time arrives while another driver of the index is running starts when that pass ends; its `plannedAt` is unchanged. The report rows of a transition index aggregate its drivers as stated under each row.

### Timing

- Grid: the planned firing times of a driver are the epoch plus whole multiples of the cadence, plus the offset `5 min x (transition index + 1)`. For a source partition longer than 8 hours the cadence is 8 hours, so DAY, MONTH and YEAR sources share one grid and one driver per index.
- Next planned firing time (`nextPlannedAt`, kept state of the driver): the earliest grid time later than both the `plannedAt` and the `endedAt` of the last pass; when the driver Clock reads earlier than the `startedAt` of the last pass, the clock went backwards, and it is the earliest grid time later than the Clock time. A late tick (a VM pause, a clock step forward) runs the one late pass at once; lateness beyond one cadence is recorded in the pass record.
- Processing time of a pass: `startedAt`, the firing time read from the driver Clock when the pass starts, minus 60 s; computed once per pass and given to every `ETLJob` of the pass. A pass does not use the 10 % padding of `ETLJob.run()`; the offset and the ordering rule below give the earlier transition its time to finish.
- Ordering rule: no pass of transition index t+1 starts while a pass of index t is running; `tick` visits the drivers in transition order, and a pass held back by this rule starts at the first tick after the pass of index t ends, with its `plannedAt` unchanged.
- Worked example, hold 0: STS 5MIN to MTS: the partition that closes at k+5 min is moved by the pass fired at k+10 (processing time k+9). STS HOUR to MTS: the hour that closes at H:00 is moved by the pass fired at H:05 (processing time H:04). MTS DAY to LTS: the day that closes at 00:00 UTC is moved by the pass fired at 00:10 UTC (processing time 00:09). With hold n the move is n source partitions later; on the aa-env default chain (hold 2) at (H+2):05, and at 00:10 UTC two days later.
- Waiting: the driver exposes `tick(Instant now)`. The ticker calls `tick(clock.instant())` on every driver every 5 s; a Throwable from one call is logged and neither stops the ticker nor skips the other drivers. `tick` starts a pass when `now` is at or past the driver's next planned firing time, no pass of the driver is running, and the ordering rule allows it; it hands the pass to the worker thread of its transition index and returns a `Future` that completes when the pass record is closed; otherwise it returns null. Tests call `tick` with instants of their own `Clock` and wait on the returned `Future`; no test waits on real time for a firing.
- Start-up: after each completed loop, the config sync thread calls `start()` on every driver; `start()` on a started driver does nothing. `start()` arms the start-up pass: it records `plannedAt` as the driver Clock's instant and marks the driver due, whatever the time of day; the next `tick` starts that pass through the same path and `Future` as every other pass, under the ordering rule, so the drivers of transition t+1 start theirs when every driver of transition t has ended its own. A driver created by a later sync loop is started at the end of that loop. A driver created by `addETLJobs` is idle until started, so a test that never calls `start()` and `tick` gets no pass.
- Test stop: `manualControlForUnitTests` stops the ticker and sets a sticky flag on the lookup, so a driver created later stays idle; the existing tests that drive `ETLJob` directly keep working.

### Pass execution

- A pass takes a snapshot of the driver's PV set, sorted by PV name, at its start and runs the `ETLJob` of every PV in the snapshot, one after another, on the index's worker thread; between two jobs the worker runs the consolidation jobs queued by pause and delete (PV add and remove). `ETLPassWorkers` is 1 (Configuration); an invalid value never leaves ETL off.
- Every job runs under a per-job `catch (Throwable)`. A job counts as failed (`jobsFailed`) when `getETLStreams` did not complete (its `IOException` is caught inside `processETL` and leaves no other trace), or the count of streams it returned is larger than the count of partitions moved plus the count deleted for lack of space, or its commit failed (including a commit that threw), or `getExceptionFromLastRun()` is non-null; a job whose Throwable escaped counts in `jobsAborted` as well. PlainPB lists a source whose root folder path is a regular file as empty, without an exception (observed 2026-09-28), so for that store the rule cannot tell a broken source from an empty one; an `IOException` from other listing errors still counts. The pass continues with the next PV. Closing the pass record and computing the next planned firing time run in a `finally`, so a failure never leaves the driver without a next firing.
- Before each job the pass checks the stop flag and whether the PV is still in the set; a PV removed after the snapshot is skipped and listed in the record.
- Skip store: a job whose destination store name equals the value the environment reader returns for `ARCHAPPL_SKIP_ETL_FOR_STORE` is skipped, logged with the store name, and counted in `jobsSkipped`.

### PV add and remove

- `addETLJobs` creates the lookup item and adds the PV to the driver of its (index, cadence), creating the driver when it is the first PV of that key. No job runs at registration. A PV registered after a driver's start-up pass joins the next planned pass; the worst-case wait is one cadence plus one tick interval (5 min 5 s for a 5MIN source, 1 h 5 s for an HOUR source, 8 h 5 s for a DAY source).
- `deleteETLJobs` (pause and delete PV) removes the PV from the driver sets. Then, index by index in transition order, it queues the consolidation job on that index's worker thread and waits for it to end before queuing the next index. The worker runs queued consolidation jobs between the jobs of a pass, so the wait is at most the running job plus the consolidations queued earlier, and the BPL request completes as today when the consolidation has run. When the index has no worker thread yet (before `postStartup`) or the threads are stopped for tests (after `manualControlForUnitTests`), the job runs on the calling thread. After the shutdown hook has run, `deleteETLJobs` queues nothing and runs nothing: it logs the PV at ERROR, because a worker the hook interrupted may still hold that PV's job. The job runs under the skip-store rule. No PV is processed by two jobs at once: the membership check, the pass job and the consolidation job of an index run on its one worker thread, and no pass runs without that thread.
- Skip store and consolidation: while the skip is in effect the source keeps its data across a stop, and a PV deleted meanwhile keeps its source data with no lookup item to move it later; on volatile storage that data survives a process restart, not a host reboot. The consolidation paths read the variable through the same environment reader as the driver; the appliance logs the active skip at ERROR at start.

### Shutdown

- The hook stops the ticker and sets the stop flag of every driver; a running pass starts no job after the flag is set and closes its record with `aborted = true`. The hook waits up to `ETLPassStopWaitSeconds` for the running job of every index, concurrently under one deadline, then interrupts each worker thread (never the executor, whose queue holds consolidations) and waits up to the same bound again under one deadline; an interrupted job's source partitions stay in the source, because a source is marked for deletion only after a commit. After the second wait the hook runs, on its own thread and index by index in transition order as today, under the skip-store rule, the shutdown consolidation of every PV but the one whose job is still running after the second wait, plus any pause or delete consolidation still queued on a worker whose job is still running; that PV is logged at ERROR and left in its source store, so no PV is processed by two jobs at once. At shutdown the hook logs at ERROR, per source store, the count of PVs left unconsolidated.

### Pass record

| Field | Source | Meaning |
| --- | --- | --- |
| `plannedAt` | grid or start | the planned firing time; the start time for a start-up pass; kept for the log and the lateness value |
| `startedAt`, `endedAt` | driver Clock | start and end of the pass |
| `lateSeconds` | driver Clock | `startedAt - plannedAt` when it exceeds one cadence, else 0 |
| `processingTime` | driver Clock | `startedAt - 60 s`, given to every job; kept for the log and the timing test |
| `pvCount` | snapshot | PVs in the snapshot |
| `jobsRun`, `jobsFailed`, `jobsAborted`, `jobsSkipped` | pass | jobs run; failed per Pass execution; escaped Throwable; skipped for the skip store or a removed PV |
| `streamsReturned`, `partitionsMoved`, `bytesMoved`, `streamsDeletedForSpace` | jobs | sums over the jobs: streams `getETLStreams` returned; streams appended and committed; their bytes; streams deleted for lack of space under the out-of-space handling |
| `busyMillis` | wall clock | sum of the job durations as `ETLJob` measures them |
| `slowestPv`, `slowestMillis` | wall clock | the job with the longest duration |
| `maxPartitionsMovedByOnePv` | jobs | the largest count of partitions one job moved |
| `overrun` | driver Clock | true when `endedAt` is past the next grid time after `plannedAt` |
| `aborted` | pass | true when the stop flag ended the pass |

The driver keeps the last completed record, the record in progress, `nextPlannedAt`, `completedPasses`, `busyMillisTotal`, and the per-day busy totals of the last seven days.

### Reported rows per transition index

| Row | Source |
| --- | --- |
| Passes so far | the largest `completedPasses` over the drivers of the index |
| Last pass: started at, duration (s), busy time (s), % of cadence | last record of each driver; % of cadence is `100 x busyMillis / cadence in milliseconds` |
| Last pass: PVs, jobs failed, jobs aborted, jobs skipped, partitions moved, bytes moved | last record of each driver |
| Last pass: slowest PV and its time (s) | last record of each driver |
| Last pass: max partitions moved by one PV | last record; 1 when ETL keeps up, more when it catches up |
| Last pass overran the cadence, late by (s) | last record |
| Current pass: started at, elapsed (s), jobs done of PVs | record in progress of each driver, or none |
| Average busy time per pass (s) | `busyMillisTotal / completedPasses` of each driver |
| Weekly usage (%) | per-day busy totals over the seconds of the counted days; the current day is partial |

With one driver per index, which is the aa-env deployment, each row is one line; with several drivers the row names the cadence of each.

`ETLMetrics.metrics()` keeps its three keys for the mgmt appliance list, computed over the drivers of transition index N: `totalETLRuns(N)` is the largest `completedPasses`, `timeForOverallETLInSeconds(N)` the sum of `busyMillisTotal / 1000`, and `maxETLPercentage` the largest, over all drivers, of `100 x busyMillis / cadence in milliseconds` of the last completed pass. `maxETLPercentage` thereby changes from a lifetime average to the last pass; the column label is unchanged.

The per-PV rows of `ETLDetails` and `StorageWithLifetime` are unchanged except the "next job runs at" row (Components).

## Interfaces that change

- `ETLPVLookupItems.getCancellingFuture` and `setCancellingFuture` are removed; `PBThreeTierETLPVLookup` and `ETLDetails` are their readers, and both change as stated above.
- `ETLMetricsForLifetime` loses the per-index sums and their getters, `updateApproximateGlobalLastETLTime`, `getApproximateLastGlobalETLTimeInMillis`, `getWeeklyETLUsageInPercent` and the weekly buckets; the writes in `ETLPVLookupItems.addETLDurationInMillis` and `addInfoAboutDetailedTime` are removed with them. `ETLMetrics.details()` and `metrics()` were their only readers and now read the driver's records. `ETLMetrics.add(int)` and `get(int)` stay as the registry of the per-index `ETLMetricsForLifetime` that the lookup items and `StorageWithLifetime` use as `StorageMetricsContext`.
- `ETLMetrics.details()` row names change; nothing references the current names. `ETLMetrics.metrics()` keys are kept with the meanings stated above.
- `ETLJob` gains the reporting listed under `ETLPVLookupItems`; its behavior is unchanged.
- The driver and the consolidation paths take an environment reader (production value `System::getenv`) in place of direct `System.getenv` calls.

## Configuration

| Property | Default | Meaning |
| --- | --- | --- |
| `org.epics.archiverappliance.etl.common.ETLPassWorkers` | 1 | worker threads per transition index, shared by all drivers of that index; a value other than 1 is replaced by 1 and logged at ERROR at start, because the pass records of an index have one writer and its jobs one order only while one thread runs every job of the index |
| `org.epics.archiverappliance.etl.common.ETLPassStopWaitSeconds` | 60 | seconds the shutdown hook waits for a running job before interrupting it, and again after the interrupt; a value below 0 is replaced by the default and logged at ERROR; 0 interrupts at once |

The cadence and the offset are not configuration; they follow the store partition as today.

## Deployment

The stop time of the etl instance is at most twice the wait bound plus the consolidation of every PV with `consolidateOnShutdown`. `TimeoutStopSec` covers the ordered stop of all four Tomcats, so aa-env sizes `SYSTEMD_TIMEOUT_STOP_SECONDS` against a measured stop of the whole unit with this driver. No ansible-provision role reads the ETL metric rows.

## Register

M25 is extended from the metric fix to this design. Before any code change, two before-evidence runs on HEAD are recorded in M25: the ETL(0>1) last-job value growing across passes of a 5-minute source partition; and, after one registration, within a bounded wait (up to 10 s) until `getNumberofTimesWeETLed()` reads 1, the negative computed `initialDelay` in the DEBUG line of `addETLJobs` and `getCancellingFuture().getDelay` between the cadence minus the job duration and the cadence, which together show that the job ran at registration (a negative `getDelay` is not producible; the JDK clamps the delay to 0). M25's T1 becomes the driver timing test, T2 the before-evidence run; its Scope and Completion Criteria name the pass driver; its throughput exclusion stands because `ETLPassWorkers` is fixed at 1. Testing item 11 is an M25 Test Plan row of its own. The soak (Testing item 10) is the register's own item M28, which depends on M25 and on the deploy gate G4, so the code item is not blocked while it is written (owner decision 2026-09-27, superseding the earlier rule that the soak gates M25).

## Testing

Every item below runs the shipped `ETLJob`, lookup items and PlainPB plugins; the only substitutes are the driver's `Clock` and the environment reader (R8). Items 1 to 3 wait on the `Future` that `tick` returns, for the start-up pass as for every other.

1. **Driver timing (unit, real jobs):** a driver over PlainPB stores, PVs with data in the source, and a test `Clock`. The test calls `tick` with instants of its own across three partition boundaries and waits on each returned `Future`. Two cases: a 5MIN source at index 0, and a 15MIN source at index 0 (where offset and cadence differ). It asserts, per pass, `plannedAt`, `processingTime`, and the source partition each pass moved; that the start-up pass ran first (`plannedAt` equals its start); that a tick before the grid time returns null; and, with a stepping `Clock` that reads past the next grid time during a pass, that the record has `overrun` true, `endedAt` past the grid time, and the next pass starts at the following grid time. A tick with an instant earlier than the last `startedAt` reschedules to the first grid time after that instant.
2. **Ordering (unit, real jobs):** two drivers at index 0 and index 1 due at the same tick; the index-1 pass starts only after the index-0 pass ended; its `plannedAt` is unchanged.
3. **Pass record and rows (unit, real jobs):** several PVs with different amounts of data over two passes; the record's sums, `slowestPv`, `maxPartitionsMovedByOnePv` and `busyMillis` match the jobs that ran; then `ETLMetrics.details` shows "Passes so far" 2 and the average equal to `busyMillisTotal / 2`, and `ETLMetrics.metrics()` shows the three keys from the same records; the "Weekly usage" row after passes on two Clock days equals the per-day totals over the counted seconds.
4. **Failure (unit, real jobs):** with the shipped plugins and no substitute, a destination whose root folder path is a regular file, so directory creation under it fails for every user including root; the pass completes, `jobsFailed` counts the job, and `nextPlannedAt` is set. A source whose root folder path is a regular file has no test: PlainPB lists it as empty (Pass execution). A case whose folder proves usable is reported as skipped through JUnit `Assumptions`, not as a pass.
5. **Add and remove (unit, real jobs):** a PV added between passes is in the next snapshot; a PV registered after the start-up pass joins the next planned pass; `deleteETLJobs` called between passes removes the PV and runs its consolidation, observed through the destination store and the closed record. The behavior while a pass is running (D11) is covered by item 11.
6. **Skip store (unit, real jobs):** with the environment reader returning the destination store name (unique to this test) for `ARCHAPPL_SKIP_ETL_FOR_STORE`, no job writes to it in a pass or in the consolidation on delete; `jobsSkipped` counts the PVs.
7. **Shutdown (unit, real jobs):** with `ETLPassStopWaitSeconds` 0, the hook stops the ticker and sets the stop flag on an idle driver; a following `tick` starts no pass, and the consolidation runs for every PV; with the environment reader returning the destination store name, the shutdown consolidation writes nothing to that store and logs the count of PVs left unconsolidated. The abort of a running pass (D9) is covered by item 11.
8. **Before-evidence on HEAD (register M25 / T2):** the two runs named under Register, recorded before any code change.
9. **Default suite:** `./mvnw -B -ntp clean verify`.
10. **Soak:** the ansible-provision lab run after the aa-env build, compared with the 2026-09-24 to 2026-09-26 run (register M13 Dependencies), once on the soak chain (STS 5MIN, MTS HOUR) and once on the aa-env default chain (STS HOUR, MTS DAY); the stop time of the unit is measured. Mapping of the retired rows: "Approximate time taken by last job" (277 s, the defect) has no counterpart; "Average time spent (s/run)" (0.69 s, already the busy time of one pass over all PVs, because its divisor is the largest per-PV run count, that is the pass count) compares directly with `busyMillis` of the last pass and with "Average busy time per pass"; "Estimated weekly usage (%)" compares with "Weekly usage (%)".
11. **In-progress behavior (`slow` group, real jobs):** a fixture of N PVs each holding several source partitions so that a pass lasts seconds. The test starts a pass through `tick`, waits, bounded, until the record in progress shows `jobsRun >= 1`, then acts: (a) `deleteETLJobs` for a PV at least two positions past `jobsRun` in name order returns after its consolidation ran, checked through the destination store, while the record in progress is still open; the closed record lists the PV as skipped and `jobsRun` never counts it. (b) The shutdown hook with `ETLPassStopWaitSeconds` 0 closes the record with `aborted` true, no job starts after the flag, and the consolidation runs for every PV except the one whose job is still running after the second wait; the test observes which PV that was through the record. (c) The same call as (a) for the PV at position `jobsRun` in name order at the moment of the call (the job running or the next one) returns after its consolidation; the record shows that PV run once or skipped, never both, and the destination store holds its data once. (d) While the pass runs, `ETLMetrics.details` shows the "Current pass" row from the record in progress. A run in which the pass had already ended before the test acted, or in which the record shows the PV chosen for (a) was run rather than skipped, is reported as inconclusive through JUnit `Assumptions`, not as a pass. The item runs with `./mvnw -B -ntp test -Dtest.groups=slow -Dtest.excludedGroups=integration,localEpics,flaky` and is an M25 Test Plan row of its own that gates closure; no default or CI run selects the `slow` group.

## Decisions

| ID | Decision | Date |
| --- | --- | --- |
| D1 | M25 is extended to this design; before-evidence per Register | 2026-09-27 |
| D2 | Worker default 1; other values replaced by 1 and logged | 2026-09-27 |
| D3 | Unconditional start-up pass for every started driver with PVs | 2026-09-27 |
| D4 | Processing time is `startedAt - 60 s`; the 10 % padding is not used by a pass | 2026-09-27 |
| D5 | Drivers keyed by (transition index, cadence); skip store per job | 2026-09-27 |
| D6 | `tick(now)` on one ticker thread every 5 s; passes on the index's worker thread; grid as defined | 2026-09-27 |
| D7 | `metrics()` keys kept; `maxETLPercentage` is the last pass's value; `totalETLRuns(N)` the largest `completedPasses` | 2026-09-27 |
| D8 | The skip extends to pause, delete and shutdown consolidation; the consolidate BPL is not affected | 2026-09-27 |
| D9 | Stop wait bound 60 s, applied twice; the still-running PV is left unconsolidated | 2026-09-27 |
| D10 | A job fails when `getETLStreams` did not complete, or the streams it returned exceed the partitions moved plus those deleted for space, or the commit failed, or an exception is recorded | 2026-09-27 |
| D11 | Pause and delete wait for the PV's running job before consolidation | 2026-09-27 |
| D12 | Pause and delete consolidation queued per index in transition order on the index's worker thread between pass jobs, on the calling thread before `postStartup` or under the test stop, refused after the hook; shutdown consolidation on the hook thread for every PV but one still running after the second wait | 2026-09-27 |
| D13 | In-progress clauses moved to a `slow`-group test with a bounded-wait handle and its own M25 row; the default suite keeps deterministic clauses | 2026-09-27 |
| D14 | Per-index sums of `ETLMetricsForLifetime` removed with their writers and getters; the class keeps the `FileStore` cache | 2026-09-27 |
| D15 | Draft 3 applies F024 to F037 and closes the review without a third lane round; a fresh-context reader checks the D12 to D14 clauses; the soak gate clause is superseded by D16 | 2026-09-27 |
| D16 | The soak (Testing item 10) is the register's own item M28, depending on M25 and G4; M25 is not blocked while the code is written | 2026-09-27 |
