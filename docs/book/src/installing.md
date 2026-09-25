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
- Storage for the three stores, and network access to the IOCs over CA
  and PVA.

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
3. Copy each WAR from the release bundle into its instance's `webapps/`
   under its plain name (`mgmt.war`, and so on). Tomcat takes the context
   path from the file name, and the URLs in `appliances.xml` expect
   `/mgmt`, `/engine`, `/etl` and `/retrieval`.
4. In the mgmt instance's `conf/context.xml`, define the configuration
   database DataSource ([Persistence](persistence.md)).

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
its four web applications.

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
- The host part of `cluster_inetport` must be `localhost` or the host's
  fully qualified name.
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

### Starting and stopping

Each instance runs in the foreground with `catalina.sh run`:

```bash
CATALINA_HOME=${TOMCAT_HOME} CATALINA_BASE=${DEPLOY_DIR}/mgmt ${TOMCAT_HOME}/bin/catalina.sh run
```

Start `mgmt` first, then `engine`, `etl` and `retrieval`, each as its own
process, and stop them in the reverse order. Until all four have
started, the web interface answers with HTTP 503.

### Checking the deployment

```bash
curl -s http://archiver.example.org:17665/mgmt/bpl/getApplianceInfo
```

The reply is a JSON object with the appliance's identity and URLs. The
web interface is at `http://archiver.example.org:17665/mgmt/ui/index.html`.

```admonish note title="Screenshot"
Placeholder: the mgmt Home page right after a fresh deployment.
```
