# EPICS Archiver Appliance with MAVEN

A workaround and guide for building the EPICS Archiver Appliance using Apache Maven. This setup is tailored for a specific environment and build configuration.

**Warning:** This Maven configuration is currently a test setup. It will be integrated with [jeonghanlee/epicsarchiverap-env](https://github.com/jeonghanlee/epicsarchiverap-env).

## Overview

This project provides the necessary Maven `pom.xml` and instructions to compile and package the Archiver Appliance. It is configured to bypass test execution for a quicker build, focusing solely on artifact generation.

## Prerequisites

Before you begin, ensure you have the following installed and configured:

* **Java Development Kit (JDK)**: Version 21 or newer.
* **Apache Maven**: A version compatible with Java 21.
    * For a quick setup of a compatible Java and Maven environment, you might find this resource helpful: [jeonghanlee/java-env](https://github.com/jeonghanlee/java-env)
* **Operating System**: This build process is intended for **Linux** environments only.

## Build Instructions

To build the Archiver Appliance artifacts, execute the following command from the root directory of this project (where the `pom.xml` file is located):

```bash
JAVA_HOME=/opt/java-env/JDK/ /opt/java-env/MAVEN/bin/mvn clean package
```
