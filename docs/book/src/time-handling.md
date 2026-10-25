# Times in the archiver appliance

A signal passes through several clocks on its way from an instrument to a chart. This page names each time that a reader meets, says which clock decides its value, how it is written, and which time a viewer shows. Every statement describes the code as shipped.

## The time of the data

The time of the data is the timestamp that comes with the value. Two things can set it:

- **Device time**: the clock of the instrument, when the instrument supplies a time.
- **Record processing time**: the time at which an EPICS record processed, taken from the clock of the IOC. The `TSE` and `TSEL` fields of the record select whether the IOC clock, the device or another record supplies it.

The archiver receives one timestamp for each event, in the `DBR_TIME` of a Channel Access monitor or in the `timeStamp` of a PVAccess structure. It cannot tell a device time from a record processing time. The timestamp is stored with every sample as UTC seconds and nanoseconds, and it is the only time of the sample itself. After a start-up or a regained connection, the engine adds two fields to the first sample, `cnxlostepsecs` and `cnxregainedepsecs`: the epoch seconds, on the clock of the archiver server, at which the connection was last lost and at which the data came back.

## The times of the archiver

The archiver stamps three more times with the clock of its own server. None of the three is stored with a sample; each PV keeps only the last value of each.

| Time | What it is | Name in `getPVDetails` |
| --- | --- | --- |
| Received | The second at which the engine received the last event | `When did we receive the last event?` |
| Recorded | The second at which the engine last passed its sample buffer to the short term store | `What did we last push the data to the short term store?` |
| Moved | The second at which ETL last moved data between stores, and the time of its next run | `ETL 0 last completed`, `ETL 0 next job runs at` |

`getPVStatus` returns the received time as `lastEvent`, while the Last event column of the Browse PVs page shows the time of the data of the last sample; the two differ by the time the event spent on its way. The time of the data of the last event is `Instant of last event from the IOC - correct or not.` in `getPVDetails`. It covers every event the engine kept; an event dropped for its time, and a repeat of the same time stamp, leave it unchanged. `getLastKnownTimeStampReport` of the engine web application (`.../engine/bpl/`, not the management interface) returns it for every PV of the engine as epoch seconds under the same key `lastEvent`.

The archiver also keeps times that describe the PV and not its data, written the same way. Four describe the connection:

- `When did we request CA to make a connection to this PV?`
- `When did we first establish a connection to this PV?`
- `When did we last lose and reestablish a connection to this PV?`
- `When did we last lose a connection to this PV?`

Two describe the settings of the PV: `Archival params creation time:` and `Archival params modification time:`. One describes the last request for the data: `Time of last Retrieval Request`.

Three more time fields of `getPVDetails` repeat or summarize those. `Last monitor received at` is the time of the last monitor callback, which equals the received time of a PV read by monitor and differs for a PV read by scan, whose received time follows every scan. `Last monitor event timestamp` is the time of the data of the last monitor event before the engine judges it. `Daily metadata last saved at` is the time at which the archiver last wrote the values of all archived fields (such as `EGU` and `HIHI`) together with a sample; it does so once every 24 hours.

## The source of a time

The source of a time is the clock that decides its value.

| Time | Source |
| --- | --- |
| Device time | The clock of the instrument |
| Record processing time | The system clock of the IOC, or the device or record that `TSE` and `TSEL` select |
| Received, recorded, moved | The system clock of the archiver server |
| The present moment of a real-time view | The clock of the browser, which is the clock of the computer on which the page is shown |

Three clocks take part: the IOC and instrument, the archiver server, and the browser. The code compares two of them at one place, where the engine drops an event for its time of the data when:

- the time is before 1991-01-01;
- the time is later than the server clock plus the drift;
- the time is earlier than the server clock minus the drift, from the second sample of a connection on;
- the time is before the time of the last event the engine kept;
- the time equals the time of the last event the engine kept.

The drift is the key `org.epics.archiverappliance.engine.epics.server_ioc_drift_seconds` of `archappl.properties`, 1800 seconds by default.

## How a time is written

The same instant is written three ways.

- **UTC**: epoch seconds and nanoseconds in JSON, CSV and SVG, and the seconds into the year (counted from 00:00:00 UTC of that year) with the nanoseconds in the protocol buffer files; ISO 8601 with a trailing `Z`, to the millisecond, where the code writes an ISO string. A data request states a time as ISO 8601 with `Z` or a numeric offset; `getData`, `getDataAtTime` and the engine calls refuse a time without a zone with HTTP 400 and a message that names the time.
- **The time of the server**: a string such as `Oct/15/2026 14:24:42 PDT`. It is written in the time zone of the server JVM, with its abbreviation and to the second; the name of the month is English whatever the locale of the server. The text is `Never` when there is no time, and `N/A` for the time of the data of an event that has not arrived. Reports, `getPVStatus`, `getPVDetails` and the `txt` response write it. Beside each such text the management calls also carry the same instant as epoch seconds, so that a client can write it in any zone: a time element of `getPVDetails` has `epochSeconds`, and a time of `getPVStatus` or of a report has a field of its name with `EpochSeconds` appended (`lastEventEpochSeconds`, `creationTimeEpochSeconds`); a time that reads `Never` has none. The `mat` response adds `isDST`, which is the daylight saving state in that zone.
- **The time of the viewer**: the time zone that the console offers, the browser zone by default, which [Management interface](interface.md#pages) describes. The zone changes how an instant is written, not the instant. The charts write dates and times on a 24 hour clock. The tooltip reads `YYYY-MM-DD HH:mm:ss`. The axis labels read `MM-DD HH:mm`, `HH:mm` or `HH:mm:ss`, by the span of the window. The range strip is an interval: the date is written once in front of it when both ends fall on one day, and the year is left off the end when only the year is shared. The System pages write the format of the locale of the browser.

The archiver has no setting for a time zone. The time zone of the server is the one the JVM takes from the host, so it follows the time zone of the host or the `user.timezone` property of the Tomcat JVM.

## Stored data and time zones

A protocol buffer file holds the year in its header and, for each sample, the seconds into that year and the nanoseconds. The start of the year is 00:00:00 UTC, so a reader in any time zone restores the same instant. The file names of a partition are UTC as well: `SR/TICK:2026_10_16_00.pb` holds the hour from 00:00 UTC of 2026-10-16; the folders are the path of the PV name. The file records no time zone and no place of origin for a sample. The configuration of a PV (`getPVTypeInfo`) carries `hostName`, which for a Channel Access PV is the host of the Channel Access server that the archiver connected to.

## The times of looking

A viewer looks at data in one of two ways.

- **Real time**: the window ends at the present moment of the viewer clock. The default window of the data viewer is the last hour up to that moment.
- **Recorded**: the window is a pair of instants, `from` and `to`, compared with the time of the data of the stored samples.

When the clock of the browser differs from the clock that stamped the samples, the end of a real-time window and the time of the newest sample differ by that difference.
