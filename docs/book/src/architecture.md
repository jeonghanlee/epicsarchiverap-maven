# Architecture

## Scope

This page describes the parts of the appliance and how data moves
through them.

**Out of scope:** how to install the parts ([Install the appliance from the release bundle](install-bundle.md))
and how to configure them ([Configuration](configuration.md)).

## Four web applications

The appliance is four web applications (WARs), each deployed in its own
Tomcat instance on the same host:

| Web application | Role |
| --- | --- |
| `mgmt` | The web interface and the management calls (BPL, business process layer); keeps the configuration of every PV in the configuration database; runs the policy file for new PVs. |
| `engine` | Connects to the PVs over Channel Access (CA) and PVAccess (PVA), buffers their samples in memory and writes them to the short term store. |
| `etl` | Moves data from one storage stage to the next (ETL: extract, transform, load). |
| `retrieval` | Answers data requests by reading every stage that holds the requested time range. |

The `mgmt` web application opens the `cluster_inetport` endpoint listed
in `appliances.xml`, and the other three connect to it to share the
appliance's state. The web applications call each other over HTTP at
the URLs listed in `appliances.xml`.

## Data flow

The appliance keeps data in three stores: the short term store (STS),
the medium term store (MTS) and the long term store (LTS).

```
 IOCs --CA/PVA--> engine --every write period--> STS
                                                  |
                                          etl (per partition)
                                                  v
                                                 MTS
                                                  |
                                          etl (per partition)
                                                  v
                                                 LTS

 clients --HTTP--> retrieval --reads--> STS + MTS + LTS
 operators --HTTP--> mgmt --> configuration database
```

- The engine keeps each PV's samples in a memory buffer and writes the
  buffers to the STS once per write period (`secondsToBuffer` in
  `archappl.properties`, 10 s in the default site).
- Each store splits its data into partitions of a fixed length, such as
  one hour or one day. ETL moves the data to the next store. By default
  it moves each partition as soon as it closes. A store with the `hold`
  and `gather` parameters keeps a partition until its first event is
  `hold+1` partitions old; the default MTS sets `hold=2` and `gather=1`.
- Retrieval merges the data of all stores for the requested range, so a
  client sees one continuous stream.

## The sample buffer

The engine holds the samples of each PV in a buffer in memory until the
next write to the STS. The figures follow a PV archived with the
MONITOR method on the default site, whose write period is 10 s.

![The path of an event through the sample buffer: the timestamp check,
the sample buffer, the swap at each write period and the write to the
short term store, with the three places where a sample is lost](images/sample-buffer-path.svg)

Every update of a MONITOR PV passes this path once; the sampling period
does not filter updates. A sample is lost in one of three places:

- **Wrong timestamp.** The time of the event is too far from the server
  clock (`engine.epics.server_ioc_drift_seconds`, 1800 s by default), is
  earlier than the previous sample, or equals it. An event with the same
  time as the previous one is dropped without being counted as lost.
- **Type change.** The type of the value differs from the type the PV
  was archived with.
- **Buffer full.** Every slot is taken, so the oldest sample is pushed
  out and counted as lost.

At each write period the buffer that holds samples becomes the batch to
write, and the engine continues with a new empty buffer. A buffer without
samples is not written. If the write fails, the same batch is tried again
at the next write while new samples fill the new buffer.

### How many slots a buffer has

The number of slots follows from the sampling period of the PV: the
samples expected in one write period plus a margin of one second. The
formula is in [What is the difference between SCAN and
MONITOR?](faq.md#what-is-the-difference-between-scan-and-monitor), and
the write period and the margin are the properties
`config.PVTypeInfo.secondsToBuffer` and
`config.PVTypeInfo.sampleBufferMarginSeconds` of
[Configuration](configuration.md).

![The slots of a buffer for a sampling period of 1.0 s and of 0.1 s: 10
expected samples and a margin of 1 give 11 slots, 100 expected samples
and a margin of 10 give 110 slots](images/sample-buffer-capacity.svg)

For a Channel Access PV, `getPVDetails` returns the number of slots as
Sample buffer capacity.

### When more samples arrive than the buffer holds

If more samples arrive between two writes than the buffer has slots,
each new sample pushes out the oldest one, and the batch that is written
holds the newest samples. A buffer of 11 slots that receives 20 samples
keeps samples 10 to 20 and loses the first 9.

![Twenty samples arrive between two writes into a buffer of 11 slots:
samples 1 to 9 are pushed out and counted as buffer-full losses, and
samples 10 to 20 are kept](images/sample-buffer-overflow.svg)

The losses begin when more updates arrive in one write period than the
buffer has slots, that is, above the number of slots divided by the
write period per second: 1.1 updates per second for 11 slots and 11 for
110 slots.

## Stores

A store is a storage plugin configured by a URL. The default policy
file sets up three stores of the `pb` plugin, which writes one file of
protocol buffer (PB) messages per PV and partition:

| Store | Default partition | Root folder variable |
| --- | --- | --- |
| STS | 1 hour | `${ARCHAPPL_SHORT_TERM_FOLDER}` |
| MTS | 1 day | `${ARCHAPPL_MEDIUM_TERM_FOLDER}` |
| LTS | 1 year | `${ARCHAPPL_LONG_TERM_FOLDER}` |

The site sets the three folder variables; they have no default
([Configuration](configuration.md#environment-variables)).

A common layout puts the STS on fast local storage (a RAM disk), the MTS
on a local disk, and the LTS on network storage. See
[Configuration](configuration.md#stores) for the store URL syntax and for
`hold` and `gather`.

## PV type information and policies

For every archived PV the appliance keeps a `PVTypeInfo` record: its
data type, sampling method and period, the stores it uses, and the
extra fields archived with it. The records live in the configuration
database ([Persistence](persistence.md)).

When a PV is added, the appliance first samples it for about 60 seconds to
measure its event rate and storage rate. It then calls the site policy
file, `policies.py`, with these measurements and the PV's fields
(`NAME`, `ADEL`, `MDEL`, `RTYP` and others). The policy returns the
sampling method and period, the stores and the extra fields, and the
appliance stores the result as the PV's `PVTypeInfo`. See
[Configuration](configuration.md#policies).
