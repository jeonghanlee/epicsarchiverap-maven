# EPICS Archiver Appliance (Maven fork)

A single-instance EPICS Archiver Appliance, built with Maven on JDK 21 and
run on Tomcat 9. It is a hard fork of the
[EPICS Archiver Appliance](https://github.com/archiver-appliance/epicsarchiverap)
at upstream commit `a81b5e46`; the upstream changes adopted after that point
are recorded in `docs/archiverap-carry-d12382d1.md`.

## Documentation

For the details, see the book:
<https://jeonghanlee.github.io/epicsarchiverap-maven/>. It covers the
architecture, building, installation, configuration, operation, and data
retrieval. Its source is under `docs/book`.

## Build

The build needs JDK 21 and a Git clone with the `origin/master` branch:

```bash
./mvnw -B clean package
```

The four WARs and the release bundle `aa-<date>-<commit>.tar.gz` are written
under `target/`. A release is an annotated tag named `YYYY-MM`.

## Deployment

The systemd units, per-site configuration, and deployment automation are in
[jeonghanlee/epicsarchiverap-env](https://github.com/jeonghanlee/epicsarchiverap-env).

## License

See [LICENSE](LICENSE) and the third-party notices in [LICENCES](LICENCES).
