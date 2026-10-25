# FAQ

## Where are the logs?

Each of the four web applications writes its log to standard output,
and the service passes it to the systemd journal under the identifier
`archappl-<component>`:

```bash
journalctl -u epicsarchiverap-maven.service -t archappl-etl
```

See [Logging](logging.md).

## What is the difference between SCAN and MONITOR?

Both receive every update of the PV from the IOC; they differ in what
they keep.

- **MONITOR** keeps every update, up to a buffer per PV that is written
  out once per write period. The buffer holds

  ```
  round(max(secondsToBuffer / samplingPeriod, 1)) + max(ceil(sampleBufferMarginSeconds / samplingPeriod), 1)
  ```

  samples, and at least 2. The second term is a margin of
  `sampleBufferMarginSeconds` (default 1 s, never below 1 s) converted
  to samples, so a late write pass costs a 0.1 s PV and a 1 s PV the
  same amount of time.
  With the default write period of 10 s, a 1 s PV holds 11 samples and
  a 0.1 s PV holds 110. A PV that changes faster than its sampling
  period fills its buffer before the next write; each further update
  then drops the oldest sample in the buffer.
- **SCAN** keeps only the latest update and writes at most one sample
  per sampling period, and only when the update has a new timestamp. A
  PV scanned at 1 s gives at most one sample per second, and none while
  its timestamp does not change.

## How are time zones handled?

EPICS timestamps are UTC, and the appliance stores them as UTC. The
machine readable responses (JSON, CSV, SVG, protocol buffers, the
MATLAB file) return UTC, and a client converts to local time. The text
responses and the reports write the time zone of the server, and the
console writes the time zone of the browser. [Times](time-handling.md)
names every time a reader meets and its clock.

## Can one appliance archive the same PV twice?

No. A PV name is archived once; adding it again answers **Already
submitted**, whether the PV is archived or its request is pending. Its
extra fields are added to the existing configuration.

## How do I stop archiving a PV and keep its data?

Select **Stop archiving** on the PV and leave **Delete the stored data**
unticked, or pause the PV and delete it with `deleteData=false`, the
default of the `deletePV` call ([Operating](operating.md#managing-a-pv)).
The files stay in the stores,
but retrieval no longer knows the PV. To read them, pass the name of a
similar archived PV as the `retiredPVTemplate` retrieval parameter, or
set the `org.epics.archiverappliance.retrieval.SearchStoreForRetiredPvs`
key to `true` in `archappl.properties`.
