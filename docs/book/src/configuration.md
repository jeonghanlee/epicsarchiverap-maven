# Configuration

## Scope

This page lists the environment variables, the configuration files and
their lookup, the `archappl.properties` keys, the policy file and the
store URL syntax.

**Out of scope:** the configuration database ([Persistence](persistence.md))
and the log configuration ([Logging](logging.md)).

## Environment variables

Unless noted, each variable is read as a Java system property first and
then as an environment variable.

| Variable | Controls | When unset |
| --- | --- | --- |
| `ARCHAPPL_APPLIANCES` | path to `appliances.xml` (environment first) | `WEB-INF/classes/appliances.xml`; startup fails if neither exists |
| `ARCHAPPL_MYIDENTITY` | the identity of this appliance | the host's fully qualified name |
| `ARCHAPPL_POLICIES` | path to `policies.py` | `WEB-INF/classes/policies.py` |
| `ARCHAPPL_PROPERTIES_FILENAME` | path to `archappl.properties` | `archappl.properties` on the class path |
| `ARCHAPPL_PERSISTENCE_LAYER` | class of the configuration database layer (environment first) | the JDBC layer (`MySQLPersistence`) |
| `ARCHAPPL_DB_NAME` | DataSource name, looked up as `jdbc/<name>` (environment only) | `archappl` |
| `ARCHAPPL_SHORT_TERM_FOLDER` | short term store (STS) folder, used in the store URLs | none |
| `ARCHAPPL_MEDIUM_TERM_FOLDER` | medium term store (MTS) folder, used in the store URLs | none |
| `ARCHAPPL_LONG_TERM_FOLDER` | long term store (LTS) folder, used in the store URLs | none |
| `ARCHAPPL_ROOT_LOGGER_LEVEL` | root log level ([Logging](logging.md)); read by `log4j2.xml` (environment only) | `INFO` |
| `ARCHAPPL_SKIP_ETL_FOR_STORE` | name of a store that the extract, transform and load (ETL) process stops moving data into, for emergencies (environment only) | no store is skipped |

The three folder variables are not read by the code directly: they are
`${...}` macros in the store URLs of the policy file, expanded when a
store URL is parsed. An unknown macro is logged as an error and left in
the URL as its bare name.

`ARCHAPPL_SKIP_ETL_FOR_STORE` names a store by the `name` in its store
URL. While the etl instance runs with it set, every ETL job whose
destination is that store is skipped: the jobs of each ETL pass, the
consolidation that runs when a PV is paused or deleted, and the
consolidation at shutdown. Each skipped job of a pass is logged at
ERROR, and the shutdown logs the number of PVs left unconsolidated per
source store. The data stays in the source store. The variable is read
from the process environment, so unset it and restart the etl instance
to resume the moves.

The code also reads `ARCHAPPL_ALL_APPS_ON_ONE_JVM`, which lowers the thread
counts of the cluster library when the four web applications run in one
JVM. This project runs them in four Tomcat instances, so the variable is
not used.

The engine also reads the EPICS Channel Access (CA) client variables `EPICS_CA_ADDR_LIST`,
`EPICS_CA_AUTO_ADDR_LIST`, `EPICS_CA_CONN_TMO`,
`EPICS_CA_BEACON_PERIOD`, `EPICS_CA_REPEATER_PORT`,
`EPICS_CA_SERVER_PORT` and `EPICS_CA_MAX_ARRAY_BYTES`.

## Configuration files

| File | Content | Found through |
| --- | --- | --- |
| `appliances.xml` | the appliance identity and URLs ([Installation layout and settings](installing.md#appliancesxml)) | `ARCHAPPL_APPLIANCES`, else the WAR |
| `policies.py` | the archiving policies ([Policies](#policies)) | `ARCHAPPL_POLICIES`, else the WAR |
| `archappl.properties` | the tuning keys ([below](#archapplproperties)) | `ARCHAPPL_PROPERTIES_FILENAME`, else the WAR |

"The WAR" means `WEB-INF/classes`, where the build puts the files of the
site it was built for ([Building](building.md#building-for-a-site)).
Pointing the variables at files outside the WARs keeps one build usable
on several hosts.

## archappl.properties

The keys below are read by the code. The `default` site's file sets each
one or carries it as a comment. Each entry gives the value in that file
and the behavior when the key is unset, which matters for a file kept
outside the WAR ([Configuration files](#configuration-files)); one value
stands for both when they are equal. Each key starts with
`org.epics.archiverappliance.`, left out here.

- `config.ConvertPVNameToKey.siteNameSpaceSeparators`: the characters of
  a PV name that become folder separators in the store paths. Site file
  `[\\:\\-]`; unset, the startup fails.
- `config.ConvertPVNameToKey.siteNameSpaceTerminator`: the character that
  ends a store path. Site file `:`; unset, the startup fails.
- `mgmt.bpl.ArchivePVAction.minimumSamplingPeriod`: the smallest sampling
  period accepted, in seconds. Site file and unset `0.1`.
- `mgmt.MgmtRuntimeState.holdArchiveRequestInMins`: the minutes after
  which an archive request whose name no server answered is held: the
  engine stops searching, the request reads Held with the reason, and the
  operator resumes or cancels it; `0` turns the hold off. Site file
  (a comment) and unset `10`.
- `mgmt.MgmtRuntimeState.abortArchiveRequestInMins`: the minutes after
  which an archive request still unfinished is aborted; a held request is
  left out. An abort shorter than the hold makes the hold moot, since the
  abort check runs on the same tick after the hold check. Site file (a
  comment) and unset `1440`.
- `config.PVTypeInfo.secondsToBuffer`: the engine write period, in
  seconds. Site file `10`; unset `10`, and `60` in the retrieval web
  application.
- `config.PVTypeInfo.sampleBufferMarginSeconds`: the write delay every
  PV's buffer absorbs without dropping a sample, in seconds; a value
  below 1.0 is raised to 1.0. Site file and unset `1.0`.
- `retrieval.DefaultUseReducedPostProcessor`: the post-processor class
  used when a request asks for reduced data. Site file
  `org.epics.archiverappliance.retrieval.postprocessors.TwoWeekRaw`;
  unset `FirstSamplePP`.
- `retrieval.DataRetrievalServlet.proxyRetrievalRequest`: how a
  single-PV request for a PV held by another appliance is answered.
  `false` proxies the request to that appliance; `true` answers with an
  HTTP redirect to it, which can fail behind a load balancer. Site file
  and unset `false`.
- `retrieval.memory.budgetFraction`: the largest size a request can
  declare, as a fraction of the maximum heap; a larger request is refused
  with HTTP 400. Not in the site file; unset `0.20`.
- `retrieval.memory.admissionFraction`: the fraction of the maximum heap
  above which the memory after collection refuses new requests with
  HTTP 503. Not in the site file; unset `0.50`.
- `retrieval.memory.pressureFraction`: the fraction of the maximum heap
  above which the memory after collection stops a running request that has
  allocated more than the floor. Not in the site file; unset `0.60`.
- `retrieval.memory.allocationFloorFraction`: the fraction of the maximum
  heap that a request can allocate before pressure stops it. Not in the
  site file; unset `0.01`.
- `retrieval.memory.checkEveryEvents`: the number of events between two
  pressure checks. Not in the site file; unset `1024`.
- `retrieval.memory.collectionIntervalMillis`: the shortest time between
  two collection requests of the checks, in milliseconds. Not in the site
  file; unset `100`.
- `retrieval.memory.scalarBinBytes`, `retrieval.memory.vectorBinBytes`,
  `retrieval.memory.retainedPointBytes`: the bytes the declared size counts
  for a scalar bin, a vector bin, and a retained point. Not in the site
  file; unset `112`, `256`, and `176`.
- `engine.epics.JCAConfigGen.useCAJ`: use the pure Java CA client, the
  only one the engine supports. Site file `true`; unset, the startup
  fails.
- `engine.epics.JCAConfigGen.dispatcher`: the class that dispatches the
  CA events. Site file
  `org.epics.archiverappliance.engine.epics.JCAEventDispatcherBasedOnPVName`,
  which gives each PV one dispatch thread by its name; unset
  `gov.aps.jca.event.QueuedEventDispatcher`, the queue of the JCA library.
- `engine.epics.commandThreadCount`: the number of CA contexts. Site file
  and unset `10`.
- `engine.epics.scanThreadCount`: the threads that serve SCAN sampling.
  Site file and unset `1`.
- `engine.epics.scanJitterFactor`: the factor applied to SCAN periods.
  Site file and unset `0.95`.
- `etl.common.OutOfSpaceHandling`: what ETL does when a destination store
  is full. Site file and unset
  `DELETE_SRC_STREAMS_IF_FIRST_DEST_WHEN_OUT_OF_SPACE`.
- `etl.common.ETLPassWorkers`: the worker threads per ETL transition
  index; only `1` is supported, another value or one that is not a whole
  number is replaced by `1` and logged at ERROR. Site file and unset `1`.
- `etl.common.ETLPassStopWaitSeconds`: the seconds the etl shutdown waits
  for the running ETL passes before it interrupts their jobs, and again
  after the interrupt. A value that is not a whole number of at least 0,
  such as `-1`, `1.5` or `60s`, is replaced by `60` and logged at ERROR.
  Site file and unset `60`.
  - Stop time: the stop of the etl instance takes at most twice this value
    plus the consolidation of every PV whose source consolidates on
    shutdown. `0` interrupts the running jobs at once.
  - Data left behind: the partitions of an interrupted job stay in the
    source store, and so do the PVs that the shutdown does not
    consolidate because their job still runs. On a RAM disk source, the
    usual case of `consolidateOnShutdown`, this data survives a restart of
    the process but not a reboot or power-off of the host. After a stop
    that hangs or writes the lines below, restart the etl process (each
    instance is its own process, see
    [Installation layout and settings](installing.md#starting-and-stopping)) and not the host. After the restart the PVs register again and the start-up
    pass moves the partitions that hold and gather allow.
  - A pause or delete that is already waiting for a consolidation when the
    first wait of the shutdown has ended (at once with `0`) waits at most
    this many seconds more for a consolidation that another thread runs,
    or for the running job of that PV, and then logs an ERROR and returns.
    Such a call can last up to twice this value from the start of the
    shutdown, and longer when a job of that PV blocks it at several
    transition indices. Otherwise it consolidates the PV itself, also with
    `0`.
  - A pause or delete of a PV that the etl lookup holds, arriving after
    the shutdown has started, returns at once, logs an ERROR and leaves
    the PV to the shutdown consolidation.
  - The HTTP answer of these calls reports success whatever the
    consolidation did, and an error only for other failures, such as a
    failed deletion of stored data. The etl log shows what was skipped.
  - The lines of the etl log, and what each one means for the data. A
    delete with `deleteData` set to `true` removes the stored data of the
    PV right after these steps, whatever the lines say:
    - `A pass of ... is still running after the stop wait` (WARN): after the
      first wait, a pass is running and its jobs are interrupted next. Only
      the first such driver is named, and with `0` the line is not written.
      After the second wait, the same line has one of two meanings. A job
      did not end after the interrupt, and its PV is left unconsolidated.
      Or a pass was queued behind another pass of the same index and never
      started, and no PV is left behind.
    - `Not consolidating <pv> from <store> at shutdown: its ETL job is still
      running after the stop wait`, then `<n> PVs left unconsolidated in
      store <store> at shutdown`: the data of these PVs stays in the source
      store. The count covers these PVs and the PVs left out by
      `ARCHAPPL_SKIP_ETL_FOR_STORE`, but not a PV for which a pause or delete
      gave up, as the entries below describe.
    - `The shutdown hook has run; not consolidating <pv> on delete`: the
      call arrived after the shutdown started. For a source that
      consolidates on shutdown nothing is left to do, because the shutdown
      consolidates the PV; for another source the line is written and
      nothing moves.
    - `The consolidation of <pv> at transition index <n> is still running
      after the stop wait; not waiting for it`: the consolidation goes on in
      another thread and the exit of the process may cut it. Check the data
      of the PV after the next start.
    - `Not consolidating <pv> at transition index <n>: its ETL job is still
      running after the stop wait`: a pause or delete gave up. Nobody
      consolidates the PV and the count above does not include it. Its data
      stays in the source store.
    - `Not running the queued consolidation of <pv> at shutdown`: the
      shutdown took a queued pause or delete task and did not run it,
      because the job of its PV was running. The call that waits for the task
      can consolidate the PV when that job ends, or give up with the line
      above. The PV is not in the count.
    - `Interrupted while waiting for the consolidation of ...`: the thread
      of the call was interrupted and stopped waiting; each later index
      writes its own line. The interrupted call runs nothing itself. A thread
      that has claimed the task goes on with it, and the shutdown may take
      the task from the queue and run it; otherwise the data of the PV stays
      in the source store. The PV is not in the count.
    - `Skipping the consolidation of ... into store ... as
      ARCHAPPL_SKIP_ETL_FOR_STORE names it`: a pause or delete left the data
      of the PV in the source store, because the variable names its
      destination.
    - `Not consolidating <pv> from <store> at shutdown:
      ARCHAPPL_SKIP_ETL_FOR_STORE names its destination`: the same at
      shutdown; the PV is in the count above.
    - `Exception processing ETL for ...`, `IOException processing ETL for pv
      ...` and `Unsuccessful commiting ETL for pv ...`: written by the ETL
      job itself when a pass job or a consolidation fails. The partitions
      that were not moved stay in the source store.
    - `ETL job failed to move <n> partitions for PV ...`: written by a
      consolidation (pause, delete or shutdown) whose partitions failed to
      move. A pass writes `ETL pass failed to move partitions:
      transition=... source=... destination=... failedPartitions=...
      firstPV=... firstError=...` instead, one line for each pair of stores
      that failed in that pass, and not the line above.
    - `Error running a queued consolidation at shutdown` and `Error when
      consolidating data on shutdown for pv <pv>`: an unexpected error ended
      that consolidation, and the shutdown goes on with the next one. The PV
      is not in the count.
    - `No space on dest when moving ETLInfo ...` (ERROR), `Not enough space
      on dest. Deleting src stream ...` (ERROR) and `Not enough space on
      dest. Skipping ETL this time for pv ...` (WARN): the destination store
      is full. Depending on the out-of-space handling the ETL job skips the
      PV, or deletes the source stream after it has moved the rest; the
      default deletes it at the first transition index. This holds for a
      pass and for a consolidation alike.
    - The list is not complete. The ETL job and the pass driver also write
      lines for unexpected failures, such as `IOException from
      prepareForNewPartition`, `Exception running post processors for pv`,
      `Invalid status when processing ETLInfo` (WARN), `A pass of ... ended
      with an exception` and `Exception in a task queued between ETL jobs
      of ...`. Read them as a failure of the job or pass that wrote them.
- `config.RuntimeKeys`: the fields kept in engine memory. Site file
  `DESC`; unset none.
- `engine.util.EngineContext.disconnectCheckTimeoutInMinutes`: the seconds
  a channel may stay unconnected after its search request before the
  engine counts it as disconnected, which decides when the engine starts
  the metadata channels; the name says minutes and the code reads seconds.
  `0` turns the count off. Site file `0`; unset `10`.
- `engine.maximum_disconnected_channel_percentage_before_starting_metachannels`:
  the percentage of disconnected channels below which the engine starts the
  metadata channels, the channels that read the extra fields archived with a
  PV. At each run of its check of disconnected channels the engine tests the
  share of the channels of this appliance that count as disconnected, by the
  rule of `engine.util.EngineContext.disconnectCheckTimeoutInMinutes`, and
  with several appliances also the share of every other appliance; it
  starts the metadata channels only when every share is below the
  percentage. With the site file's `0` of that timeout no channel counts as
  disconnected, so the percentage never holds them back. Site file (a
  comment) and unset `5.0`.
- `engine.metachannels_to_start_at_a_time`: the most PVs whose metadata
  channels the engine starts in one run of that check; the other PVs wait
  for the next run. Site file (a comment) and unset `10000`.
- `engine.archivePVSonStartup.determineLastKnownEventFromStores`: `false`
  starts a PV from the server time, not from the last stored sample.
  Site file `false`; unset `true`.
- `engine.epics.server_ioc_drift_seconds`: the seconds the time of an
  event may lead the server clock, or lag it from the second sample of a
  connection on, before the engine drops the event; an event before
  1991-01-01 is dropped whatever the drift. Site file (a comment) and
  unset `1800`.

The file carries further keys as comments, with a description of each.
The two `MgmtRuntimeState` keys are read when the management starts, so a
change needs a restart of the management. The `retrieval.memory` keys are
read when the retrieval starts, and an invalid value fails that start; the
log names `Invalid retrieval memory protection settings`. The budget must be
above 0 and below 1. The admission fraction must be above 0 and below the
pressure fraction, which must be below 1. The floor must be at least 0 and
below 1.

## Policies

`policies.py` is a Python file run by an embedded Jython interpreter.
The appliance calls it for every new PV with the measured event rate
and storage rate and the PV's fields, and it returns the PV's sampling
method and period, its stores and the extra fields to archive.

The `default` site's file defines four policies, which an operator can
also choose when adding a PV:

| Policy | Chosen when | Stores |
| --- | --- | --- |
| `2HzPVs` | the event rate is above 2 Hz | STS, MTS, LTS |
| `BPMS` | the name starts with `BPMS` and the storage rate is above 35 bytes/s | STS, MTS, LTS, with a sampling period that limits storage to about 1 GB per year |
| `3DaysMTSOnly` | chosen by the operator | STS, an MTS with `hold=4` and `gather=1`, which keeps 4 to 5 completed days, and a `blackhole` LTS |
| `Default` | otherwise | STS, MTS, LTS; when an operator chooses it, or for the PV `mshankar:arch:sine`, the LTS also caches the post-processors `firstSample` and `firstSample_3600` (`pp`) |

Except for `BPMS`, the policies sample by monitor at 1 s. The file sets
the fields archived with a PV by the record type (`RTYP`) of the PV:

| Record type | Fields |
| --- | --- |
| `ai`, `calc`, `calcout`, `longin`, `dfanout`, `sub` | `HIHI`, `HIGH`, `LOW`, `LOLO`, `LOPR`, `HOPR` |
| `ao`, `longout` | the six above and `DRVH`, `DRVL` |
| any other type, or no record type | none |

These eight fields are also the ones the file lets the appliance store in
the stream of the PV; a field outside them that a request names is
archived as a PV of its own.

The management keeps the loaded file for one minute when it chooses the
policy and the fields archived with every PV. The list of policies reads the
file at every call, and the retrieval reads it when it looks up the stores
of a PV that is not archived. An edited file takes effect without a
restart.

## Stores

A store is written as a URL. The scheme selects the plugin:

| Scheme | Plugin |
| --- | --- |
| `pb` | PB files on a file system; the plugin of the three default stores |
| `pbraw` | another appliance over HTTP, read only |
| `blackhole` | discards data; only as the last store |
| `merge` | merges a local store with the data of another appliance ([Redundancy](redundancy.md#merging-during-etl)) |
| `rtree` | a Channel Archiver index, read only |

The default STS, for example:

```
pb://localhost?name=STS&rootFolder=${ARCHAPPL_SHORT_TERM_FOLDER}&partitionGranularity=PARTITION_HOUR&consolidateOnShutdown=true
```

Parameters of the `pb` plugin:

| Parameter | Meaning |
| --- | --- |
| `name` | store name, such as `STS`; required |
| `rootFolder` | folder of the store; required |
| `partitionGranularity` | partition length: `PARTITION_5MIN`, `PARTITION_15MIN`, `PARTITION_30MIN`, `PARTITION_HOUR`, `PARTITION_DAY`, `PARTITION_MONTH` or `PARTITION_YEAR`; required |
| `hold`, `gather` | A partition moves once its first event is `hold+1` partitions old, counted from its start, or `hold+2` partitions old when `gather` is 0 and `hold` is not. A pass then moves every partition up to `hold-(gather-1)` partitions before the time of the pass, one minute before its start, so a pass on schedule moves `gather` partitions and a late pass more. Between two moves nothing leaves the store, and at least `hold-gather+1` completed partitions stay in it. Just before a move it holds `hold+1` completed partitions, or `hold+2` when `gather` is 0 and `hold` is not, plus the one being written. `gather` must not exceed `hold`; both default to 0, which skips the rule above and moves each partition as soon as it closes |
| `consolidateOnShutdown` | move the data to the next store when the appliance stops; for a STS on a RAM disk |
| `reducedata` | post-processor applied to data moved into this store; the raw samples are dropped. An operator with a bin width in seconds applies, such as `firstSample_3600` or `mean_60`; `optimized` and `optimLastSample` do not, because they are defined by the range of a retrieval request, and the store refuses them. Not combined with `pp` on one store |
| `pp` | post-processors computed and cached while data moves into this store; a retrieval request that matches one exactly reads the cached result. The cached files of a partition leave the store with its data when the ETL moves it on or the PV is deleted. Not combined with `reducedata` on one store, since the caches would be computed from the reduced data |
| `etlIntoStoreIf` | name of a flag ([Operating](operating.md#named-flags)); while the flag is false, data moved into this store is discarded |
| `etlOutofStoreIf` | name of a flag; while the flag is false, data stays in this store and accumulates |
| `compress` | `ZIP_PER_PV` keeps the files of a PV in one zip archive instead of a folder. For the last store of a chain only. The move out of an uncompressed store deletes the moved partition and its cached files |

Parameters of the `merge`, `pbraw` and `rtree` plugins:

| Store | Parameter | Meaning |
| --- | --- | --- |
| `merge` | `name` | store name, such as `MTS`; required |
| `merge` | `dest` | store of this appliance that receives the merged data, as a URL-encoded `pb` store URL; required |
| `merge` | `other` | store that reads the other appliance, as a URL-encoded `pbraw` store URL; required |
| `pbraw` | `rawURL` | the `data_retrieval_url` of the other appliance followed by `/data/getData.raw`, URL-encoded; required |
| `pbraw` | `name` | store name; the host of `rawURL` when absent |
| `pbraw` | `skipExternalServers` | `true` asks the other appliance to leave out the data of its own external servers; default `false` |
| `rtree` | `serverURL` | URL of the Channel Archiver data server; required |
| `rtree` | `archiveKey` | integer key of the archive on that server; required |
| `rtree` | `reducedArchiveKey` | integer key of a reduced archive on that server; optional |
| `rtree` | `name` | store name; the host of `serverURL` when absent |

A `merge` store for the MTS, whose `dest` is the default MTS and whose
`other` reads the retrieval of another appliance (the `dest` and `other`
values are encoded, and the `rawURL` inside `other` is encoded twice):

```
merge://localhost?name=MTS&dest=pb%3A%2F%2Flocalhost%3Fname%3DMTS%26rootFolder%3D%24%7BARCHAPPL_MEDIUM_TERM_FOLDER%7D%26partitionGranularity%3DPARTITION_DAY%26hold%3D2%26gather%3D1&other=pbraw%3A%2F%2Flocalhost%3Fname%3DMTS%26rawURL%3Dhttp%253A%252F%252Fother.example.org%253A17668%252Fretrieval%252Fdata%252FgetData.raw
```

### File names in a pb store

A `pb` store keeps one file per PV and partition. The file path is the
PV name with the separator characters (`:` and `-` by default, the
`siteNameSpaceSeparators` key) turned into folders, followed by the
partition:

| Partition | File for `TEST:PV:1` |
| --- | --- |
| hour | `TEST/PV/1:2026_09_24_16.pb` |
| day | `TEST/PV/1:2026_09_24.pb` |
| year | `TEST/PV/1:2026.pb` |

PV names that share prefixes therefore share folders, which keeps each
folder small when the names follow a naming convention. A site can
replace this mapping with its own class, named by the
`org.epics.archiverappliance.config.DefaultConfigService.PVName2KeyMappingClassName`
key.
