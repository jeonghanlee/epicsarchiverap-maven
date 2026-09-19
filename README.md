# EPICS Archiver Appliance with Maven

A Maven-based build system for the EPICS Archiver Appliance.

**Warning:** This is a specialized Maven configuration, currently under refinement. It will be integrated with [jeonghanlee/epicsarchiverap-env](https://github.com/jeonghanlee/epicsarchiverap-env).

## Overview

This project provides a Maven `pom.xml` to compile and package the Archiver Appliance. By default, it focuses on artifact generation and may bypass extensive test suites.

## Prerequisites

* **JDK 21+**: Java Development Kit version 21 or newer is required.
* **Apache Maven**: A recent version (e.g., 3.9.x).
    * For easy Java/Maven setup, see [jeonghanlee/java-env](https://github.com/jeonghanlee/java-env).
* **Git**: Required for generating release notes from commit history (this is part of the documentation generation process).
* **Operating System**:
    * Core build (JARs/WARs) is generally OS-agnostic.
* **Docker** (documentation only): the narrative documentation is an mdBook built through `docs/book/Dockerfile`; Docker is required only to build or preview those docs, not for the WARs.

## Build Instructions

Execute these commands from the project's root directory (where `pom.xml` is located).

### Standard Build (Package/Install)

This command cleans the project, compiles the code, and packages it into `JAR/WAR` files located in the `target/` directory.

```bash
mvn clean package
```

To also install the artifacts into your local Maven repository (for use by other local projects):

```bash
mvn clean install
```


### Documentation and the Build

The package goal does not build any documentation. The mgmt API reference is generated from the code by the `generateApiReference` step at `process-classes`: it reads the `BPLServlet` action registry and the `@BPLEndpoint` annotation on each action class and writes `ui/api/index.html` and `ui/api/api.json` into the mgmt WAR, so the reference always matches the deployed code and the build needs no Python, taglet, or network access for it.

The narrative documentation is an mdBook under `docs/book`, built with the pinned tools in `docs/book/Dockerfile` and published to GitHub Pages by the `pages.yml` workflow. Build or preview it locally with:

```bash
docker build -t aa-mdbook docs/book
docker run --rm -v "$PWD/docs/book:/book" aa-mdbook build   # output in docs/book/book
```


### Using a Specific `java-env`
If you use java-env or need to specify the JDK/Maven paths:

```bash
JAVA_HOME=/opt/java-env/JDK /opt/java-env/MAVEN/bin/mvn clean package
```
**Important:** Ensure `JAVA_HOME` points to a **JDK 21+** installation.

## Output Artifacts
* Packaged Application (`WARs/JARs`): Found in the `target/` directory.
* Javadoc API Documentation: Found in the the `target/site/apidocs`.
* Narrative Documentation: The mdBook renders to `docs/book/book` and is published to GitHub Pages by the `pages.yml` workflow.
* Assembly Package: If configured, often found in `target/archappl_<VERSION>.tar.gz` (e.g., `target/archappl_2025-06-05.tar.gz`).

## Troubleshooting

* Java Version Errors (`UnsupportedClassVersionError`): Ensure your `JAVA_HOME`, `PATH`, and the java command used by Maven all refer to JDK 21 or newer. Check with `java -version`.
* File Not Found / Other Issues: Run your Maven command with `-e` (for detailed errors) and `-X` (for debug logging) to get more information. For example: `mvn clean package -e -X`.

