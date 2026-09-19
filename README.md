# EPICS Archiver Appliance (Maven fork)

A Maven-built, single-instance modernization of the EPICS Archiver Appliance,
maintained independently of the upstream project.

## Overview

The goal of this fork is to take a long-maintained EPICS Archiver Appliance and,
on its existing architecture, run it as a single service that is small and
strong — light in footprint, solid in operation. This is a modernization of the
existing design, not a re-architecture.

This repository is a fork of the [EPICS Archiver Appliance](https://github.com/archiver-appliance/epicsarchiverap),
frozen at the `NewHope` baseline and maintained on its own from there. It no
longer tracks upstream and has left the GitHub fork network: rather than
merging upstream, it has **selectively adopted upstream patches — primarily
bug fixes** — through a per-change review, keeping only what fits a
single-instance appliance. It did not follow upstream's changes to data
retrieval and selection, keeping the fork's own retrieval behavior instead.

What makes this fork distinct from upstream:

- **Build**: Maven-only through the committed Maven Wrapper (`./mvnw`); the
  Gradle build is removed, and the one remaining site-specific Ant step runs
  inside Maven.
- **Tests**: the test platform was rebuilt on JUnit 5 — hermetic and
  HTTP-based rather than Selenium (see `TESTING.md`).
- **Toolchain**: JDK 21 and Tomcat 9.
- **Scope**: a single-instance appliance (no appliance clustering).
- **Persistence**: MariaDB and SQLite3 are both shipped and selectable at
  install through the JNDI DataSource. Access moves to a local method that
  fits a single host — MariaDB over a Unix domain socket (UDS) rather than
  TCP, or a serverless SQLite3 file.
- **Documentation**: a different system from upstream — the mgmt API reference
  is generated from the code into the mgmt WAR, and the narrative docs are an
  mdBook on GitHub Pages (upstream's Sphinx/Read the Docs pipeline is retired).

Feature scope is shifting to fit the appliance's role: some capabilities are
being scaled back (for example appliance clustering and unused storage
backends), while others the site needs are being reinforced.

The runtime (systemd units, per-site configuration, deployment) is provided by
[jeonghanlee/epicsarchiverap-env](https://github.com/jeonghanlee/epicsarchiverap-env),
which builds against this repository.

## Prerequisites

- **JDK 21+** with `JAVA_HOME` exported.
- **Maven Wrapper**: the build runs through `./mvnw`; the wrapper pins the
  Maven version, so no system Maven is required.
- **Git**: the build reads commit history to name artifacts and generate
  release notes.
- **Docker** (documentation only): the mdBook docs build through
  `docs/book/Dockerfile`; Docker is not needed for the WARs.

## Build

Run from the repository root:

```bash
./mvnw -B clean package            # compile, test, and package the WARs
./mvnw -B clean package -DskipTests # artifacts only, skipping tests
./mvnw -B clean verify             # package plus the dependency and enforcer gates
```

Set `JAVA_HOME` to a JDK 21+ install (the exec steps require it):

```bash
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./mvnw -B clean package
```

The developer-only utilities under `src/tools` are excluded from the default
build and every WAR; compile them on demand with `-Ptools`.

## Documentation

The package goal builds no documentation. Two independent, Sphinx-free paths:

- **mgmt API reference**: generated from the code at `process-classes` (the
  `BPLServlet` registry plus the `@BPLEndpoint` annotations) into the mgmt WAR
  at `ui/api/index.html` and `ui/api/api.json`, so it always matches the
  deployed code.
- **Narrative docs**: an mdBook under `docs/book`, built with the pinned tools
  in `docs/book/Dockerfile` and published to GitHub Pages at
  <https://jeonghanlee.github.io/epicsarchiverap-maven/> by the `pages.yml`
  workflow. The pages currently carry the migrated upstream content and are
  being rewritten for this fork. Build or preview it locally:

```bash
docker build -t aa-mdbook docs/book
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD/docs/book:/book" aa-mdbook build   # output in docs/book/book
```

## Output Artifacts

- **WARs**: `target/aa-<date>-<commit>-{mgmt,engine,etl,retrieval}.war`.
- **Release assembly**: `target/aa-<date>-<commit>.tar.gz`.
- **Javadoc**: `target/site/apidocs` (when the javadoc goal is run).
- **Narrative docs**: rendered to `docs/book/book`, served from GitHub Pages at
  <https://jeonghanlee.github.io/epicsarchiverap-maven/>.

## Continuous Integration

`.github/workflows/maven.yml` runs `./mvnw -B -ntp clean verify` on JDK 21 for
every push and pull request. `.github/workflows/pages.yml` builds and deploys
the mdBook when `docs/book` changes.
