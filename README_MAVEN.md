# MAVEN port


## Build
```
mvn clean install -Djavafx.platform=linux -DskipTests -Dmaven.test.skip=true
```

## Status

The latest epicsarchiverap requires Java 21. So I need to set up Java 21 Debian

```
[INFO] --- maven-compiler-plugin:3.13.0:compile (default-compile) @ epicsarchiverap-test ---
[INFO] Recompiling the module because of changed source code.
[INFO] Compiling 484 source files with javac [debug release 21] to target/classes
[INFO] ------------------------------------------------------------------------
[INFO] BUILD FAILURE
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  7.342 s
[INFO] Finished at: 2025-05-28T23:57:26-07:00
[INFO] ------------------------------------------------------------------------
[ERROR] Failed to execute goal org.apache.maven.plugins:maven-compiler-plugin:3.13.0:compile (default-compile) on project epicsarchiverap-test: Fatal error compiling: error: release version 21 not supported -> [Help 1]
[ERROR]
[ERROR] To see the full stack trace of the errors, re-run Maven with the -e switch.
[ERROR] Re-run Maven using the -X switch to enable full debug logging.
[ERROR]
[ERROR] For more information about the errors and possible solutions, please read the following articles:
[ERROR] [Help 1] http://cwiki.apache.org/confluence/display/MAVEN/MojoExecutionException

```
