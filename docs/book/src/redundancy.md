# Redundancy and EPICS 7

## Scope

This page covers archiving critical PVs on two independent appliances
and merging their data, and how PVs archived over PVAccess are stored.

**Out of scope:** clustering of appliances, which this fork does not
carry.

## Two appliances for critical PVs

Two independent appliances, each a complete installation of its own,
can archive the same small set of critical PVs:

- The **primary** appliance archives all PVs, the critical ones among
  them, with the site's usual policies, and answers most retrieval
  requests.
- The **secondary** appliance archives only the critical PVs, with
  shorter retention, for example an LTS that is a `blackhole` store.

On the secondary, add the primary as an external data server, on the
Integration page or with the `addExternalArchiverServer` call, giving the
type `ARCHAPPL_PBRAW` and the primary's `data_retrieval_url` with the
`mergeDuringRetrieval` parameter:

```
http://primary.example.org:17668/retrieval?mergeDuringRetrieval=true
```

- A retrieval request to the secondary then also fetches the same range
  from the primary and merges both. The stored data is not changed. The
  merge makes retrieval from the secondary slower; retrieval from the
  primary is unaffected and returns only the primary's data.
- The `skipExternalServers=true` retrieval parameter turns the merge off
  for one request.
- The `mergeInData` call, sent to the primary with the secondary's
  `data_retrieval_url` as `other` and a store name as `storage`, copies a
  PV's data from the secondary into that store of the primary. The PV
  must be paused on the primary while it runs.

## PVAccess and structured data

The appliance archives PVs over PVAccess as well as CA. Normative type
scalars and scalar arrays (`NTScalar`, `NTScalarArray`) are stored as
their CA counterparts; a PVA double is stored like a CA `DBR_DOUBLE`, so
every client reads them the same way. Other PVData structures are stored
in their PVAccess serialization and can be retrieved in the `raw` and
`json` formats.

The `archivePV` call and the Home page take the protocol from the PV
name: a name that starts with `pva://` is archived over PVAccess.
