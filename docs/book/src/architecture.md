# Architecture

## Scope

This page describes the parts of the appliance and how data moves
through them.

**Out of scope:** how to install the parts ([Installing](installing.md))
and how to configure them ([Configuration](configuration.md)).

## Four web applications

The appliance is four web applications (WARs), each deployed in its own
Tomcat instance on the same host:

| Web application | Role |
| --- | --- |
| `mgmt` | The web interface and the management calls (BPL, business process layer); keeps the configuration of every PV in the configuration database; runs the policy file for new PVs. |
| `engine` | Connects to the PVs over CA and PVA, buffers their samples in memory and writes them to the short term store. |
| `etl` | Moves data from one storage stage to the next (extract, transform, load). |
| `retrieval` | Answers data requests by reading every stage that holds the requested time range. |

The `mgmt` web application opens the `cluster_inetport` endpoint listed
in `appliances.xml`, and the other three connect to it to share the
appliance's state. The web applications call each other over HTTP at
the URLs listed in `appliances.xml`.

## Data flow

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
  one hour or one day. When a partition closes, or once the store holds
  the number of partitions its `hold` parameter sets, ETL moves the data
  to the next store.
- Retrieval merges the data of all stores for the requested range, so a
  client sees one continuous stream.

## Stores

A store is a storage plugin configured by a URL. The default policy
file sets up three stores of the `pb` plugin, which writes one file of
protocol buffer (PB) messages per PV and partition:

| Store | Default partition | Default location |
| --- | --- | --- |
| STS | 1 hour | `${ARCHAPPL_SHORT_TERM_FOLDER}` |
| MTS | 1 day | `${ARCHAPPL_MEDIUM_TERM_FOLDER}` |
| LTS | 1 year | `${ARCHAPPL_LONG_TERM_FOLDER}` |

A common layout puts the STS on fast local storage (a RAM disk), the MTS
on a local disk, and the LTS on network storage. See
[Configuration](configuration.md#stores) for the store URL syntax.

## PV type information and policies

For every archived PV the appliance keeps a `PVTypeInfo` record: its
data type, sampling method and period, the stores it uses, and the
extra fields archived with it. The records live in the configuration
database ([Persistence](persistence.md)).

When a PV is added, the appliance first samples it for a few minutes to
measure its event rate and storage rate. It then calls the site policy
file, `policies.py`, with these measurements and the PV's fields
(`NAME`, `ADEL`, `MDEL`, `RTYP` and others). The policy returns the
sampling method and period, the stores and the extra fields, and the
appliance stores the result as the PV's `PVTypeInfo`. See
[Configuration](configuration.md#policies).
