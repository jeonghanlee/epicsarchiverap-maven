# Logging

The appliance runs as four Tomcat JVMs, one each for the `mgmt`,
`engine`, `etl` and `retrieval` components. Each JVM writes its log to
standard output only. The service that launches the JVMs passes each
stream to the systemd journal, and journald timestamps, stores and
rotates the lines. The appliance writes no log files of its own.

## Scope

This page covers the log streams, their line format, reading them, and
changing log levels.

**Out of scope:** the journald retention and rate limit settings of the
host.

## Line format

The shipped `log4j2.xml` (in each WAR's `WEB-INF/classes`) writes one
line per event:

```text
<3>ERROR [http-nio-17665-exec-1] org.epics.archiverappliance.mgmt.bpl.ModifyMetaFieldsAction - Cannot find typeinfo for pv ...
```

- The leading `<N>` is a syslog priority prefix: `<2>` FATAL, `<3>`
  ERROR, `<4>` WARN, `<6>` INFO, `<7>` DEBUG and TRACE. `systemd-cat`
  strips it and stores it as the journal `PRIORITY` field.
- The line carries the level, the thread and the logger name. It
  carries no timestamp; the journal records one for every entry.

## Streams and their bounds

| Stream | Destination | Bounded by |
| --- | --- | --- |
| Application log (log4j2), one per JVM | journal, identifier `archappl-<component>` | the host's journald retention, set on provisioned hosts to 8 weeks and capped by `SystemMaxUse` |
| Tomcat's own log and `java.util.logging`, through log4j2 | same journal stream | same |
| Process stdout and stderr | same journal stream | same |
| Service launcher messages | journal, the service unit's own lines | same |
| Tomcat access log, one per instance | file, `logs/localhost_access_log.<yyyy-MM-dd>.txt` | Tomcat deletes files older than 90 days (`maxDays="90"`, set by epicsarchiverap-env) |

In the journal layout there is no `catalina.out` and no `logrotate`
configuration. The service unit, the launcher and Tomcat's
`logging.properties` and `server.xml` are installed by the deployment
repository
([epicsarchiverap-env](https://github.com/jeonghanlee/epicsarchiverap-env)).
The journald retention and rate limits are host settings.

## Reading the logs

```bash
journalctl -u epicsarchiverap-maven.service -t archappl-etl
```
```bash
journalctl -u epicsarchiverap-maven.service -t archappl-mgmt -p err
```
```bash
journalctl -u epicsarchiverap-maven.service -t archappl-engine -f
```

`epicsarchiverap-maven.service` is the unit that epicsarchiverap-env
installs.

`-t` selects one component, `-p err` shows only ERROR and FATAL lines,
and `-f` follows new lines.

## Log levels

The root level comes from the `ARCHAPPL_ROOT_LOGGER_LEVEL` environment
variable and defaults to `INFO`. Setting it to `WARN` drops INFO lines
from every component.

The shipped file lists the loggers operators most often tune, commented
out:

| Logger | Covers |
| --- | --- |
| `config` | startup and configuration (`config.*`) |
| `cluster` | cluster membership (`cluster.*`) |
| `org.epics.archiverappliance.engine` | PV connection and sampling |
| `org.epics.archiverappliance.etl` | store-to-store data movement |
| `org.epics.archiverappliance.retrieval` | data retrieval requests |
| `com.hazelcast` | the embedded cluster library |

To change a logger's level, copy the shipped `log4j2.xml`, edit the copy,
and point the `LOG4J_CONFIGURATION_FILE` environment variable at it. The
file carries `monitorInterval="30"`, so log4j2 rereads the copy and an
edited level takes effect within 30 seconds, without a restart. Every WAR
ships the same `log4j2.xml`, whatever the site the build was made for.

## Changing a level while the appliance runs

The mgmt BPL reads and sets a logger's level in one running component,
with no restart and no file edit:

```bash
curl -s "http://localhost:17665/mgmt/bpl/getLogLevel?component=engine&logger=org.epics.archiverappliance.engine"
```
```bash
curl -s "http://localhost:17665/mgmt/bpl/setLogLevel?component=engine&logger=org.epics.archiverappliance.engine&level=DEBUG"
```
```bash
curl -s "http://localhost:17665/mgmt/bpl/setLogLevel?component=engine&logger=org.epics.archiverappliance.engine&level=INFO"
```

- `component` is `mgmt` (the default), `engine`, `etl` or `retrieval`;
  mgmt forwards the request to that component, because each WAR keeps its
  own log4j2 configuration. A change in one component leaves the others
  unchanged.
- `logger` is a logger name; empty or `root` selects the root logger.
  `level` is one of `OFF`, `FATAL`, `ERROR`, `WARN`, `INFO`, `DEBUG`,
  `TRACE`, `ALL`. An unknown level or component returns HTTP 400.
- The reply is a JSON object with `component`, `logger`, `level` and, for
  a change, `previousLevel`. Each change also writes a WARN line naming
  the logger and both levels, so the change is visible in the journal.
- A change lasts until the next change, a reread of an edited site copy,
  or a restart of the component.
- DEBUG on a busy logger can exceed the host's journald rate limit for
  the unit, which then drops lines; set the level back when the
  investigation ends.
- Tomcat's own lines and `java.util.logging` lines, the CA client's
  (`com.cosylab`) among them, do not follow these requests: they are
  formatted by the Tomcat-level configuration (`log4j2-tomcat.xml` when
  the deployment routes them through log4j2), which is JVM-wide.

## File fallback without a collector

On a host with no journal (a container or a developer machine), the
shipped `log4j2.xml` carries a commented `RollingFile` appender. After
it is enabled in a copy of the file:

- each JVM writes `logs/archappl.log` under its `CATALINA_BASE`, with its
  own timestamp on every line;
- the file rolls at 50 MB into `archappl-<n>.log.gz`, and at most ten
  archives are kept, so one JVM holds at most about 550 MB of log files;
- each JVM needs its own `fileName` when several components share one
  `CATALINA_BASE`.

## Known limits

- The journal records each output line as its own entry. A multi-line
  message or stack trace spans several entries; only its first line
  carries the priority, and the continuation lines arrive at the default
  priority 6 (INFO).
- Tomcat's own log lines and `java.util.logging` lines (the CA client's
  beacon messages among them) carry a priority only through log4j2: the
  deployment puts the `log4j-api`, `log4j-core`, `log4j-appserver` and
  `log4j-jul` jars that the build writes to `target/tomcat-log4j` (and
  ships in the release tarball's `tomcat-log4j/`) on Tomcat's `CLASSPATH`, sets the `java.util.logging` manager to
  `org.apache.logging.log4j.jul.LogManager`, and supplies a
  `log4j2-tomcat.xml` with the same pattern. Without them, Tomcat's JULI
  writes these lines with no prefix, at priority 6, because no formatter
  shipped with Tomcat 9 emits one.
- The `java.util.logging` manager is JVM-wide, so `java.util.logging`
  lines raised inside a WAR are formatted by `log4j2-tomcat.xml`, not by
  the WAR's `log4j2.xml`.
