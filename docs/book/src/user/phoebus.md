# Phoebus Data Browser

The [Phoebus](https://control-system-studio.readthedocs.io/) Data Browser
reads archived data from the appliance using the
[PB/HTTP](../developer/pb_pbraw.md) protocol.

## Configuring the Data Browser

The Data Browser takes the appliance's retrieval URL with the scheme
_http_ replaced by _pbraw_. Take the `data_retrieval_url` element of your
`appliances.xml`, for example `http://archiver.example.org:17668/retrieval`,
and list the resulting `pbraw://archiver.example.org:17668/retrieval` in
the Phoebus preferences file (`settings.ini`):

```ini
org.csstudio.trends.databrowser3/urls=pbraw://archiver.example.org:17668/retrieval|Appliance
org.csstudio.trends.databrowser3/archives=pbraw://archiver.example.org:17668/retrieval|Appliance
```

- `urls` lists the archive data servers offered in the Data Browser.
- `archives` sets the default data sources for newly added channels.

Several servers are separated by `*`, and the part after `|` is the name
the Data Browser shows. Once the URL is configured, the appliance can be
used in the Data Browser like any other archive data source: search for
PVs, retrieve their data and plot it.
