# Operating

## Scope

This page covers daily operation: adding and managing PVs through the
mgmt web interface, the PV states, reports and metrics, monitoring,
aliases, named flags, backup and recovery, and inspecting the CA and PVA
traffic.

**Out of scope:** the same operations from scripts
([Scripting](scripting.md)) and the logs ([Logging](logging.md)).

## The web interface

The web interface is served by the mgmt web application at
`http://<host>:17665/mgmt/ui/index.html`. Its pages:

| Page | Purpose |
| --- | --- |
| Home | check, add, pause, resume and delete PVs |
| Reports | lists of PVs by connection state, rates, storage and dropped events |
| Metrics | event rate, data rate and PV count of the appliance |
| Storage | total and free space of each store |
| Appliances | JVM and process metrics of the four web applications |
| Integration | external data servers and Channel Archiver configuration |
| Help | the generated management API reference ([Scripting](scripting.md)) |

```admonish note title="Screenshot"
Placeholder: the Home page with a PV status table.
```

## Adding PVs

1. On the Home page, enter PV names, one per line. A name may contain the
   glob characters `*` and `?` for the check and pause actions.
2. Select **Archive**, or **Archive (specify sampling period)** to set the
   period and the method.
3. The appliance samples each new PV for a few minutes to measure its
   rates, applies the policy, and starts archiving it.

**Check Status** shows the state of each PV; the page checks again every
60 s while a PV is not yet archived.

| State | Meaning |
| --- | --- |
| Initial sampling | the archive request is in progress; the PV is being measured |
| Appliance assigned | the configuration is stored; the channel is not open yet |
| Being archived | the engine is archiving the PV |
| Paused | the PV is configured but the engine does not archive it |
| Not being archived | the appliance knows nothing about the PV |
| Appliance Down | the engine does not answer |

A PV that never connects stays in Initial sampling. Its archive request
can be cancelled from the Details column.

## Managing a PV

The PV Details page, opened from the Details column, shows the PV's
configuration and state, and offers these actions:

| Action | Condition |
| --- | --- |
| Change sampling method and period | none |
| Pause, Resume | none |
| Stop archiving, optionally deleting the data | the PV is paused |
| Consolidate data into a store | the PV is paused |
| Rename | the PV is paused |

```admonish note title="Screenshot"
Placeholder: the PV Details page of an archived PV.
```

## Reports and metrics

The Reports page lists, among others:

- PVs that may not exist (never connected);
- PVs that are currently disconnected;
- paused PVs;
- the PVs with the highest event rate and storage rate;
- recently added and recently modified PVs;
- PVs by storage consumed, by lost connections and by last known
  timestamp;
- PVs that dropped events because of incorrect timestamps, buffer
  overflows or type changes.

The Metrics and Storage pages show the appliance's rates and the space
left in each store. When a store runs full, ETL follows the
`OutOfSpaceHandling` key ([Configuration](configuration.md#archapplproperties)).

```admonish note title="Screenshot"
Placeholder: the Reports page with the currently disconnected PVs.
```

## Monitoring

- **Logs:** watch for ERROR and FATAL lines, and for `OutOfMemoryError`,
  with `journalctl -p err` ([Logging](logging.md)). An error in the engine
  or ETL needs attention; one in retrieval or mgmt may come from a bad
  request.
- **Free space** of each store, from the Storage page or the host.
- **Disconnected PVs**, from the Currently disconnected PVs report or the
  `getCurrentlyDisconnectedPVs` call. Pausing PVs that stay disconnected,
  and resuming paused PVs that are alive again, keeps this list short.
- **Type changes:** when a PV changes its data type, the appliance stops
  archiving its new samples; the PVs by dropped events from type changes
  report lists them. Either rename the paused PV and archive it again
  under its name, which keeps the old data under the new name, or
  convert its archived data with the `changeTypeForPV` call on the paused
  PV, which rewrites the data (back it up first), and then resume it.

## Aliases

When a PV is added under an alias, the appliance reads the PV's `NAME`
field, archives it under the real name, and records the alias in the
`PVAliases` table. Retrieval and management then work under both names,
and the PV Details page notes the alias.

## Named flags

Named flags are appliance-wide boolean values, all false at startup.
They are set with the `setNamedFlag` call ([Scripting](scripting.md)) or
loaded at startup from a properties file named by the
`org.epics.archiverappliance.config.NamedFlags.readFromFile` key.

- `SKIP_<store>_FOR_RETRIEVAL`, for example `SKIP_LTS_FOR_RETRIEVAL`,
  leaves that store out of retrieval, for example while the LTS storage
  is unavailable.
- A store URL can name a flag in `etlIntoStoreIf` or `etlOutofStoreIf`
  ([Configuration](configuration.md#stores)).

## Backup

- **The configuration database** holds the archiving configuration of
  every PV. Back it up with the database's own tools, for example
  `mysqldump` for MariaDB or a copy of the file for SQLite while the
  appliance is stopped.
- **The stores** hold the samples as ordinary files, one per PV and
  partition, and can be backed up with file tools.
- The `exportConfig` call returns the `PVTypeInfo` records of the
  appliance as JSON, and `importConfig` loads such a file into an
  appliance that does not yet archive those PVs. Aliases and named
  flags are not part of the export.

## Recovering a lost appliance

Install a new host with the same identity in `appliances.xml`, restore
the configuration database from its backup, restore or remount the
stores, and start the appliance; it archives the PVs of the restored
configuration. Giving the new host the IP address of the old one avoids
clients holding a cached address.

## Inspecting the CA and PVA traffic

A packet capture between the appliance and an IOC shows searches,
connections and subscriptions:

```bash
tcpdump -i <interface> 'host <ioc> and host <appliance>' -w capture.pcap
```

The [cashark](https://github.com/mdavidsaver/cashark/) plugin decodes CA
and PVA in Wireshark and `tshark`. The PV Details page shows the CA
client, server and subscription IDs of a PV, and pausing and resuming
the PV during the capture shows the channel's whole life cycle.

