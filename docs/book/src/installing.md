# Installing

## Scope

This page covers deploying the appliance on one host: the supported
path through jeonghanlee/epicsarchiverap-env, and a manual reference
that lists what that path sets up.

**Out of scope:** the configuration database setup
([Persistence](persistence.md)), the meaning of each configuration item
([Configuration](configuration.md)), and the log collection
([Logging](logging.md)).

## Deploying with epicsarchiverap-env

The appliance is deployed through
[jeonghanlee/epicsarchiverap-env](https://github.com/jeonghanlee/epicsarchiverap-env).
On Debian 13 it installs the system packages, sets up MariaDB and loads
the configuration database schema, builds this repository, creates the
four Tomcat 9 instances, and installs the `epicsarchiverap-maven.service`
systemd unit, which starts and stops the instances in their required
order. Follow its README for the steps.

## Manual reference

The rest of this page describes the layout that a deployment needs.
It is a reference for understanding and troubleshooting a deployment,
not a separate supported procedure.

### Host requirements

- JDK 21.
- Apache Tomcat 9.
- A configuration database: MariaDB or SQLite ([Persistence](persistence.md)).
- Storage for the three stores: the short term store (STS), the medium
  term store (MTS) and the long term store (LTS).
- Network access to the IOCs over Channel Access (CA) and PVAccess
  (PVA).

### Tomcat instances

One Tomcat installation (`CATALINA_HOME`) serves four instances, one per
web application, each with its own folder (`CATALINA_BASE`). Below,
`${TOMCAT_HOME}` is the Tomcat installation and `${DEPLOY_DIR}` the parent
folder of the instances:

```
${DEPLOY_DIR}/mgmt/       conf/  logs/  temp/  webapps/mgmt.war       work/
${DEPLOY_DIR}/engine/     conf/  logs/  temp/  webapps/engine.war     work/
${DEPLOY_DIR}/etl/        conf/  logs/  temp/  webapps/etl.war        work/
${DEPLOY_DIR}/retrieval/  conf/  logs/  temp/  webapps/retrieval.war  work/
```

1. Create the folders shown for each instance, and copy `conf/` from the
   Tomcat installation into each of them.
2. In each instance's `conf/server.xml`, set the HTTP connector port to
   the port of that web application in `appliances.xml`, give the
   shutdown port a value unique on the host, and remove the AJP
   connector.
3. Copy each WAR from the release bundle ([Building](building.md#outputs))
   into its instance's `webapps/` under its plain name (`mgmt.war`, and so on). Tomcat takes the context
   path from the file name, and the URLs in `appliances.xml` expect
   `/mgmt`, `/engine`, `/etl` and `/retrieval`.
4. In the mgmt instance's `conf/context.xml`, define the configuration
   database DataSource as a `<Resource>` element inside the `<Context>`
   element ([Persistence](persistence.md)).

The examples in this book use these ports:

| Web application | Port |
| --- | --- |
| mgmt | 17665 |
| engine | 17666 |
| etl | 17667 |
| retrieval | 17668 |
| `cluster_inetport` | 17670 |

### appliances.xml

`appliances.xml` describes the appliance: its identity and the URLs of
its four web applications. This project supports one appliance per
installation, not several appliances run as a cluster.

```xml
<appliances>
   <appliance>
     <identity>appliance0</identity>
     <cluster_inetport>archiver.example.org:17670</cluster_inetport>
     <mgmt_url>http://archiver.example.org:17665/mgmt/bpl</mgmt_url>
     <engine_url>http://archiver.example.org:17666/engine/bpl</engine_url>
     <etl_url>http://archiver.example.org:17667/etl/bpl</etl_url>
     <retrieval_url>http://archiver.example.org:17668/retrieval/bpl</retrieval_url>
     <data_retrieval_url>http://archiver.example.org:17668/retrieval</data_retrieval_url>
   </appliance>
</appliances>
```

- `identity` must equal the identity the appliance finds for itself: the
  `ARCHAPPL_MYIDENTITY` Java system property or environment variable,
  or the host's fully qualified name when neither is set.
- The host part of `cluster_inetport` must be `localhost`, the host's
  fully qualified name or an IP address.
- `retrieval_url` is used by the other web applications;
  `data_retrieval_url` is the URL that data clients use.

### Environment

Each instance needs the same environment, set for example in each
instance's `bin/setenv.sh`, which `catalina.sh` reads at start, or in the
service unit that starts the instances:

| Variable | Value |
| --- | --- |
| `ARCHAPPL_APPLIANCES` | path to `appliances.xml` |
| `ARCHAPPL_MYIDENTITY` | the `identity` from `appliances.xml` |
| `ARCHAPPL_SHORT_TERM_FOLDER` | STS folder |
| `ARCHAPPL_MEDIUM_TERM_FOLDER` | MTS folder |
| `ARCHAPPL_LONG_TERM_FOLDER` | LTS folder |
| `JAVA_OPTS` | JVM options, for example `-Xmx4G -Xms4G` |

The other variables are listed in [Configuration](configuration.md).

Include `-XX:+ExitOnOutOfMemoryError` and `-XX:+HeapDumpOnOutOfMemoryError`
in each instance's `JAVA_OPTS`, with `-XX:HeapDumpPath` pointing to that
instance's writable logs directory. These options terminate a JVM after an
OOM and retain diagnostic data; they do not prevent memory exhaustion.
A heap dump can be larger than the configured heap, and repeated failures
create additional files, so provide space and a retention policy for them.
Each independently managed instance exits on its own; the development
launcher stops the whole appliance when any component exits.

Retrieval memory protection is activated during web application startup.
It uses the maximum heap to calculate request and pressure limits. Keep
explicit collection enabled: `-XX:+DisableExplicitGC` prevents the guard
from requesting collection to recover admission after a load ends.
Validate the memory limits with the intended heap, collector and concurrent
HTTP/PVAccess workload before production use.

HTTP data retrieval also checks a request deadline independently of Tomcat's
background interrupt. Set `archappl.valve.stuckThresholdSeconds` and
`archappl.valve.interruptThresholdSeconds` as JVM system properties before
startup; their defaults are 600 and 900 seconds. When both are positive,
retrieval uses the larger value as its duration limit from servlet entry.
Setting either to zero or a negative value disables this deadline as well
as the valve's interruption path. Restart the instance after changing these
properties; editing a valve attribute directly or changing it through JMX
does not update the application's deadline.

The request and its local `getDataAtTimeForAppliance` workers share cancellation
state. An expired request is rejected with HTTP 503 before the response is
committed; after commit, the incomplete response ends as a transport failure.
Checks run while processing events, writing output and completing the response.
They take effect after a blocking I/O operation returns, so the duration limit
does not guarantee immediate termination of a blocked socket write. This HTTP
deadline does not apply to PVAccess calls.

Two Tomcat valves limit the retrieval and the management web applications.
Each web application declares them in its `META-INF/context.xml`, and each
attribute reads a JVM system property:

| System property | Valve attribute | Default |
| --- | --- | --- |
| `archappl.valve.concurrency` | `SemaphoreValve` `concurrency` | 100 |
| `archappl.valve.stuckThresholdSeconds` | `StuckThreadDetectionValve` `threshold` | 600 |
| `archappl.valve.interruptThresholdSeconds` | `StuckThreadDetectionValve` `interruptThreadThreshold` | 900 |

The semaphore valve answers HTTP 503 at once to a request above the
concurrency. A valve declared on a context counts every URL of the web
application, including the calls the other web applications make. The
stuck-thread valve logs a request that runs past the threshold and interrupts
it past the interrupt threshold. Tomcat evaluates both in its background
processing, so an interrupt is late by up to the `backgroundProcessorDelay`
of the engine, 10 seconds by default. To change a limit, set the system
property and restart the instance.

The semaphore valve refuses only requests that reach it. When the connector's
`maxThreads` is below the concurrency, every request gets a thread before the
valve can count 100, so the valve never refuses and requests above
`maxThreads` wait in the connector's queue. The deployment template of
epicsarchiverap-env leaves `maxThreads` at Tomcat's default of 200; the
development launcher sets it to 40, where the valve does not act. The
concurrency default is not derived from a load measurement; set it below the
instance's `maxThreads` and above the concurrent requests the instance is
expected to serve.

A PVAccess call that a memory check refuses or stops gets no answer, so a
PVAccess client must set its own call timeout. The valves cover HTTP only,
and the PVAccess service does not limit its concurrent calls.

### Starting and stopping

Each instance runs in the foreground with `catalina.sh run`:

```bash
CATALINA_HOME=${TOMCAT_HOME} CATALINA_BASE=${DEPLOY_DIR}/mgmt ${TOMCAT_HOME}/bin/catalina.sh run
```

Start `mgmt` first, then `engine`, `etl` and `retrieval`, each as its own
process. Stop them in the order `engine`, `retrieval`, `etl`, `mgmt`,
which the launcher of epicsarchiverap-env (`archappl.bash`) uses. The
stop order is not the reverse of the start order.

Until all four have started, the pages under `/mgmt/ui/` answer with
HTTP 503 and the calls of the business process layer (BPL) answer with
HTTP 500.

### Checking the deployment

```bash
curl -s http://archiver.example.org:17665/mgmt/bpl/getApplianceInfo
```

The reply is a JSON object with the appliance's identity and URLs. The
web interface is at `http://archiver.example.org:17665/mgmt/ui/index.html`.

The System page, at
`http://archiver.example.org:17665/mgmt/ui/system.html`, shows the state
of the appliance. When the four web applications run at one version,
the **Components** row reads *all running* and the version line names
the appliance version.

![The System overview of a running appliance](images/system-overview.png)
