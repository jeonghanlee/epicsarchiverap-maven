# MAVEN port


## Build
```
JAVA_HOME=/opt/java-env/JDK/ /opt/java-env/MAVEN/bin/mvn clean install -Djavafx.platform=linux -DskipTests -Dmaven.test.skip=true

JAVA_HOME=/opt/java-env/JDK/ /opt/java-env/MAVEN/bin/mvn clean package -Djavafx.platform=linux -DskipTests -Dmaven.test.skip=true

```

## Status

The latest epicsarchiverap requires Java 21. So I need to set up Java 21 Debian

```
[INFO] --- war:3.4.0:war (mgmt-war) @ epicsarchiverap-test ---
[WARNING]  Parameter 'warName' is read-only, must not be used in configuration
[INFO] Packaging webapp
[INFO] Assembling webapp [epicsarchiverap-test] in [/home/jeonglee/gitsrc/epicsarchiverap-maven/target/epicsarchiverap-test-1.0.0-SNAPSHOT]
[INFO] Processing war project
[INFO] Copying webapp webResources [/home/jeonglee/gitsrc/epicsarchiverap-maven/target/stage/org/epics/archiverappliance/staticcontent] to [/home/jeonglee/gitsrc/epicsarchiverap-maven/target/epicsarchiverap-test-1.0.0-SNAPSHOT]
[INFO] Copying webapp webResources [/home/jeonglee/gitsrc/epicsarchiverap-maven/src/resources/test] to [/home/jeonglee/gitsrc/epicsarchiverap-maven/target/epicsarchiverap-test-1.0.0-SNAPSHOT]
[INFO] Copying webapp webResources [/home/jeonglee/gitsrc/epicsarchiverap-maven/src/sitespecific/${env.ARCHAPPL_SITEID == null ? "tests" : env.ARCHAPPL_SITEID}/classpathfiles] to [/home/jeonglee/gitsrc/epicsarchiverap-maven/target/epicsarchiverap-test-1.0.0-SNAPSHOT]
[INFO] ------------------------------------------------------------------------
[INFO] BUILD FAILURE
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  13.235 s
[INFO] Finished at: 2025-05-29T19:07:56-07:00
[INFO] ------------------------------------------------------------------------
[ERROR] Failed to execute goal org.apache.maven.plugins:maven-war-plugin:3.4.0:war (mgmt-war) on project epicsarchiverap-test: Execution mgmt-war of goal org.apache.maven.plugins:maven-war-plugin:3.4.0:war failed: basedir /home/jeonglee/gitsrc/epicsarchiverap-maven/src/sitespecific/${env.ARCHAPPL_SITEID == null ? "tests" : env.ARCHAPPL_SITEID}/classpathfiles does not exist -> [Help 1]
[ERROR] 
[ERROR] To see the full stack trace of the errors, re-run Maven with the -e switch.
[ERROR] Re-run Maven using the -X switch to enable full debug logging.
[ERROR] 
[ERROR] For more information about the errors and possible solutions, please read the following articles:
[ERROR] [Help 1] http://cwiki.apache.org/confluence/display/MAVEN/PluginExecutionException
jeonglee@parity: epicsarchiverap-maven (master)$ git st


```
