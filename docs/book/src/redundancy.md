# Redundancy and EPICS 7

## Scope

This page covers archiving critical PVs on two independent appliances
and merging their data, and how PVs archived over PVAccess are stored.

**Out of scope:** running several appliances as a cluster, which this
project does not support.

## Two appliances for critical PVs

Two independent appliances, each a complete installation of its own,
can archive the same small set of critical PVs:

- The **primary** appliance archives all PVs, the critical ones among
  them, with the site's usual policies, and answers most retrieval
  requests.
- The **secondary** appliance archives only the critical PVs, with
  shorter retention, for example a long term store (LTS) that is a
  `blackhole` store.

On the secondary, add the primary as an external data server, giving the
primary's `data_retrieval_url` with the `mergeDuringRetrieval` parameter:

```
http://primary.example.org:17668/retrieval?mergeDuringRetrieval=true
```

The External servers tab of System makes the two calls below for the
server address you enter. With the business process layer (BPL) calls,
send both:

1. `addExternalArchiverServer` with `externalarchiverserverurl` set to
   that address and `externalServerType` set to `ARCHAPPL_PBRAW`. The
   call only tests that the primary answers; it adds nothing.
2. `addExternalArchiverServerArchives` with `channelarchiverserverurl`
   set to the same address and `archives` set to `pbraw`. This call adds
   the server.

- A retrieval request to the secondary then also fetches the same range
  from the primary and merges both. The stored data is not changed. The
  merge makes retrieval from the secondary slower; retrieval from the
  primary is unaffected and returns only the primary's data.
- The `skipExternalServers=true` retrieval parameter turns the merge off
  for one request.
- The `mergeInData` call, sent to the primary with the PV name as `pv`,
  the secondary's `data_retrieval_url` as `other` and a store name as
  `storage`, copies that PV's data from the secondary into that store of
  the primary. The PV must be paused on the primary while it runs. The
  call changes the stored data: back up the store first, and consolidate
  the PV's data into that store first, so that merging in later data does
  not lose data in the other stores.

## Merging during ETL

A `merge` store merges the data of another appliance into the data of
this appliance when the extract, transform and load (ETL) process moves
it to the next store, and again when a request reads the store. The `dest` parameter names the store of this appliance, and the
`other` parameter names a `pbraw` store that reads the same PV from the
other appliance. The parameters are listed under
[Stores](configuration.md#stores).

- The other appliance only needs to archive the same PV. It can keep a
  short retention, for example with a `blackhole` LTS, because the merge
  never deletes data there.
- ETL out of a `merge` store stops for a PV while the other appliance
  does not answer, and resumes from where it left off when the other
  appliance answers again.
- Data outside the ETL window is merged in with the `mergeInData` call
  above.

## PVAccess and structured data

The appliance archives PVs over PVAccess as well as Channel Access (CA). Normative type
scalars and scalar arrays (`NTScalar`, `NTScalarArray`) are stored as
their CA counterparts; a PVA double is stored like a CA `DBR_DOUBLE`, so
every client reads them the same way. Other PVData structures are stored
in their PVAccess serialization and can be retrieved in the `raw` and
`json` formats.

The `archivePV` call and the Browse PVs page take the protocol from the PV
name: a name that starts with `pva://` is archived over PVAccess.
