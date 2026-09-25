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
  round(max(secondsToBuffer / samplingPeriod * sampleBufferCapacityAdjustment, 1)) + 1
  ```

  samples, and at least 2. With the default write period of 10 s and a
  sampling period of 1 s, the buffer holds 11 samples; a PV that changes
  faster than that loses the updates that arrive while its buffer is
  full, until the next write.
- **SCAN** keeps only the latest update and writes it once per sampling
  period, so a PV scanned at 1 s gives one sample per second whatever its
  update rate.

## How are time zones handled?

EPICS timestamps are UTC, and the appliance stores and returns UTC. Any
conversion to local time, including daylight saving time, happens in
the client.

## Can one appliance archive the same PV twice?

No. A PV name is archived once; adding it again reports that it is
already archived or already submitted. Its extra fields are added to
the existing configuration.

## How do I stop archiving a PV and keep its data?

Pause the PV, then delete it with `deleteData=false`, the default
([Operating](operating.md#managing-a-pv)). The files stay in the stores,
but retrieval no longer knows the PV. To read them, pass the name of a
similar archived PV as the `retiredPVTemplate` retrieval parameter, or
set the `org.epics.archiverappliance.retrieval.SearchStoreForRetiredPvs`
key to `true` in `archappl.properties`.
