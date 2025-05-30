# EPICS Archiver Appliance with Maven

A Maven-based build system for the EPICS Archiver Appliance.

**Warning:** This is a specialized Maven configuration, currently under refinement. It will be integrated with [jeonghanlee/epicsarchiverap-env](https://github.com/jeonghanlee/epicsarchiverap-env).

## Overview

This project provides a Maven `pom.xml` to compile and package the Archiver Appliance. By default, it focuses on artifact generation and may bypass extensive test suites.

## Prerequisites

* **JDK 21+**: Java Development Kit version 21 or newer is required.
* **Apache Maven**: A recent version (e.g., 3.8.x or 3.9.x).
    * For easy Java/Maven setup, see [jeonghanlee/java-env](https://github.com/jeonghanlee/java-env).
* **Git**: Required for generating release notes from commit history (this is part of the documentation generation process).
* **Operating System**:
    * Core build (JARs/WARs) is generally OS-agnostic.
    * Sphinx documentation (`build_docs.sh`) is primarily for Linux.

## Build Instructions

Execute these commands from the project's root directory (where `pom.xml` is located).

### Standard Build (Package/Install)

This command cleans the project, compiles the code, and packages it into JAR/WAR files located in the `target/` directory.

```bash
mvn clean package
```
To also install the artifacts into your local Maven repository (for use by other local projects):

```bash
mvn clean install
```
### Building Sphinx Documentation

To build the project and specifically include Sphinx documentation (assuming Sphinx is skipped by default in the POM):
```bash
mvn clean package -Dsphinx.skip=false
```

### Using a Specific `java-env`

If you use java-env or need to specify the JDK/Maven paths:

```bash
# Example for package:
JAVA_HOME=/opt/java-env/JDK /opt/java-env/MAVEN/bin/mvn clean package

# Example for package including Sphinx:
JAVA_HOME=/opt/java-env/JDK /opt/java-env/MAVEN/bin/mvn clean package -Dsphinx.skip=false
```
Important: Ensure JAVA_HOME points to a JDK 21+ installation.

## Output Artifacts

* Packaged Application (`WARs/JARs`): Found in the `target/` directory.
* Javadoc API Documentation: Found in the the `target/site/apidocs`.
* Sphinx HTML Documentation: If built, usually in `docs/docs/build`.
* Assembly Package: Found in the `target/archappl_v*****.tar.gz`

## Troubleshooting

* Java Version Errors (UnsupportedClassVersionError): Ensure your `JAVA_HOME`, `PATH`, and the java command used by Maven all refer to JDK 21 or newer. Check with `java -version`.
* File Not Found / Other Issues: Run your Maven command with -e (for detailed errors) and -X (for debug logging) to get more information. For example: mvn clean package -e -X.

