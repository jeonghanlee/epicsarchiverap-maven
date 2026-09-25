# Introduction

The EPICS Archiver Appliance records the values of EPICS process
variables (PVs) over Channel Access (CA) and PVAccess (PVA), stores them
in a chain of storage stages, and serves them back over HTTP. This book
documents the Maven fork at
[jeonghanlee/epicsarchiverap-maven](https://github.com/jeonghanlee/epicsarchiverap-maven),
which runs the appliance as one single-instance service.

## Scope

This book covers what the appliance does, how to build it, how to
install and configure it, how to operate it, and how to retrieve data
from it.

**Out of scope:** the deployment automation (systemd units, per-site
configuration, host provisioning), which lives in
[jeonghanlee/epicsarchiverap-env](https://github.com/jeonghanlee/epicsarchiverap-env);
the reference for each management call, which the build generates into
the mgmt web application (see [Scripting](scripting.md)).

## What the appliance does

- Archives PVs over CA and PVA, sampled by monitor or by scan at a
  per-PV period.
- Chooses the archiving parameters and storage stages for each new PV
  through a site policy file.
- Stores samples in three stages, short term (STS), medium term (MTS)
  and long term (LTS), and moves them from stage to stage.
- Serves data over HTTP as JSON, CSV, MATLAB files, raw protocol buffers
  and other formats, with optional server-side post-processing such as
  binned means.
- Provides a web interface and an HTTP management interface to add,
  pause, rename and delete PVs and to watch the appliance's metrics.

## What this fork does not carry

- Clustering of several appliances. The appliance is one host running
  four web applications.
- The Gradle build, the upstream install scripts, and the ArchiveViewer
  and CS-Studio 4 integrations.

## How this book is organized

| Page | For |
| --- | --- |
| [Architecture](architecture.md) | how the four web applications, the storage stages and the policies fit together |
| [Building](building.md) | building the WARs and the release bundle |
| [Installing](installing.md) | deploying the appliance |
| [Configuration](configuration.md) | environment variables, properties, policies and stores |
| [Persistence](persistence.md) | the configuration database |
| [Operating](operating.md) | the web interface, PV lifecycle, reports and backup |
| [Logging](logging.md) | where the logs go and how to change log levels |
| [Retrieving data](retrieval.md) | the data retrieval URLs, formats and post-processing |
| [Scripting](scripting.md) | the management calls from scripts |
| [Redundancy and EPICS 7](redundancy.md) | merging data from a second appliance; structured PVA data |
| [Developer guide](developer.md) | the test platform and the file formats |
