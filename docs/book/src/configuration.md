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
| `appliances.xml` | the appliance identity and URLs ([Installing](installing.md#appliancesxml)) | `ARCHAPPL_APPLIANCES`, else the WAR |
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
  index; only `1` is supported. Site file and unset `1`.
- `etl.common.ETLPassStopWaitSeconds`: the seconds the etl shutdown waits
  for a running ETL job before interrupting it, and again after the
  interrupt; `0` interrupts at once. Site file and unset `60`.
- `config.RuntimeKeys`: the fields kept in engine memory. Site file
  `DESC`; unset none.
- `engine.util.EngineContext.disconnectCheckTimeoutInMinutes`: the seconds
  a channel may stay unconnected after its search request before the
  engine counts it as disconnected, which decides when the engine starts
  the metadata channels; the name says minutes and the code reads seconds.
  `0` turns the count off. Site file `0`; unset `10`.
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
change needs a restart of the management.

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
| `compress` | `ZIP_PER_PV` keeps the files of a PV in one zip archive instead of a folder. For the last store of a chain only: a zip store that is the source of a move keeps the partition it moved, so the data would exist twice. The move out of an uncompressed store deletes the moved partition and its cached files |

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
