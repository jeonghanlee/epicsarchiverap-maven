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
| `ARCHAPPL_SHORT_TERM_FOLDER` | STS folder, used in the store URLs | none |
| `ARCHAPPL_MEDIUM_TERM_FOLDER` | MTS folder, used in the store URLs | none |
| `ARCHAPPL_LONG_TERM_FOLDER` | LTS folder, used in the store URLs | none |
| `ARCHAPPL_ROOT_LOGGER_LEVEL` | root log level ([Logging](logging.md)); read by `log4j2.xml` (environment only) | `INFO` |
| `ARCHAPPL_SKIP_ETL_FOR_STORE` | name of a store to stop moving data into, for emergencies (environment only) | no store is skipped |

The three folder variables are not read by the code directly: they are
`${...}` macros in the store URLs of the policy file, expanded when a
store URL is parsed. An unknown macro is logged as an error and left in
the URL as its bare name.

The engine also reads the EPICS client variables `EPICS_CA_ADDR_LIST`,
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

The keys below are set in the `default` site's file. Each key starts
with `org.epics.archiverappliance.`, left out here.

| Key | Default site | Meaning |
| --- | --- | --- |
| `config.ConvertPVNameToKey.siteNameSpaceSeparators` | `[\\:\\-]` | characters of a PV name that become folder separators in the store paths |
| `config.ConvertPVNameToKey.siteNameSpaceTerminator` | `:` | character that ends a store path |
| `mgmt.bpl.ArchivePVAction.minimumSamplingPeriod` | `0.1` | smallest sampling period accepted, in seconds |
| `config.PVTypeInfo.secondsToBuffer` | `10` | engine write period, in seconds |
| `config.PVTypeInfo.sampleBufferCapacityAdjustment` | `1.0` | multiplier on every PV's buffer size |
| `retrieval.DefaultUseReducedPostProcessor` | `...postprocessors.TwoWeekRaw` | post-processor used when a request asks for reduced data |
| `engine.epics.JCAConfigGen.useCAJ` | `true` | use the pure Java CA client |
| `engine.epics.commandThreadCount` | `10` | number of CA contexts |
| `engine.epics.scanThreadCount` | `1` | threads that serve SCAN sampling |
| `engine.epics.scanJitterFactor` | `0.95` | factor applied to SCAN periods |
| `etl.common.OutOfSpaceHandling` | `DELETE_SRC_STREAMS_IF_FIRST_DEST_WHEN_OUT_OF_SPACE` | what ETL does when a destination store is full |
| `config.RuntimeKeys` | `DESC` | fields kept in engine memory |
| `engine.util.EngineContext.disconnectCheckTimeoutInMinutes` | `0` | disconnect check interval; `0` turns it off |
| `engine.archivePVSonStartup.determineLastKnownEventFromStores` | `false` | `false` starts from server time, not from the last stored sample |

The file carries further keys as comments, with a description of each.

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
| `3DaysMTSOnly` | chosen by the operator | STS, an MTS that keeps 3 days, and a `blackhole` LTS |
| `Default` | otherwise | STS, MTS, LTS |

Except for `BPMS`, the policies sample by monitor at 1 s. The file
archives the fields `HIHI`, `HIGH`,
`LOW`, `LOLO`, `LOPR` and `HOPR` with every PV, adding `DRVH` and `DRVL`
for output records.

## Stores

A store is written as a URL. The scheme selects the plugin:

| Scheme | Plugin |
| --- | --- |
| `pb` | PB files on a file system; the plugin of the three default stores |
| `pbraw` | another appliance over HTTP, read only |
| `blackhole` | discards data; only as the last store |
| `merge` | merges a local store with a remote appliance ([Redundancy](redundancy.md)) |
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
| `hold`, `gather` | ETL starts once the oldest sample is older than `hold` partitions and then moves `gather` partitions at a time; both default to 0, which moves each partition as soon as it closes |
| `consolidateOnShutdown` | move the data to the next store when the appliance stops; for a STS on a RAM disk |
| `reducedata` | post-processor applied to data moved into this store; the raw samples are dropped |
| `pp` | post-processors computed and cached while data moves into this store; a retrieval request that matches one exactly reads the cached result |
| `etlIntoStoreIf` | name of a flag ([Operating](operating.md#named-flags)); while the flag is false, data moved into this store is discarded |
| `etlOutofStoreIf` | name of a flag; while the flag is false, data stays in this store and accumulates |

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
