# Install Guide

This fork is deployed through
[epicsarchiverap-env](https://github.com/jeonghanlee/epicsarchiverap-env).

## Details

For a finer control over your installation, installation and
configuration consists of these steps.

1. Create an appliances.xml
2. Optionally, create your policies.py file

In addition to installing the JDK, EPICS (see [System requirements](../developer/details.md#system-requirements)), for the appliance

1. Install and configure Tomcat
2. Install MySQL (or other persistence provider)
   1. Create the tables
   2. Create a connection pool in Tomcat
3. Set up storage
4. Create one Tomcat instance for each of the four WAR files (see
   [Stopping and starting the individual Tomcats](#stopping-and-starting-the-individual-tomcats)).
5. Deploy the WAR files into their respective containers - This is the
   deployment step that will be run when you upgrade to a new release.
6. Stop/Start each of the Tomcats

## Appliances XML

The `appliances.xml` file describes the appliance. The details of the
file are outlined in the ConfigService javadoc. A sample
`appliances.xml` looks like

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

- The archiver appliance looks at the environment variable
  `ARCHAPPL_APPLIANCES` for the location of the `appliances.xml` file.
  Use an export statement like so

  ```bash
      export ARCHAPPL_APPLIANCES=/arch/appliances.xml
  ```

  to set the location of the `appliances.xml` file.

- The `appliances.xml` has one `<appliance>` section. Certain BPL, most
  importantly, the `/archivePV` BPL, are suspended until all four
  webapps of the appliance have started up.

- The `identity` must match the identity the appliance determines for
  itself: the `ARCHAPPL_MYIDENTITY` Java system property or environment
  variable, or the machine's fully qualified hostname when neither is set.

- The `cluster_inetport` is the `TCPIP address:port` combination on
  which the `mgmt` webapp listens and to which the other three webapps
  connect. There is a check made to ensure that the hostname portion of
  the `cluster_inetport` is either `localhost` or the same as that
  obtained from a call to
  `InetAddress.getLocalHost().getCanonicalHostName()` which typically
  returns the fully qualified domain name (FQDN).

- For the ports, it is convenient if the `mgmt_url` has the smallest
  port number amongst all the web apps and the port numbers for the
  other three web apps increment in the order shown above. There is no
  requirement that this be the case.

- There are two URL\'s for the `retrieval` webapp.

  1. The `retrieval_url` is the URL used by the `mgmt` webapp to talk
     to the `retrieval` webapp.
  2. The `data_retrieval_url` is used by archive data retrieval
     clients to talk to the appliance.

## Create your policies file

The EPICS archiver appliance ships with a sample
[`policies.py`](customization.md#policies) (from the `tests` site)
that creates a three stage storage environment. These are

1. **STS** - A datastore that uses the
   PlainPBStoragePlugin
   to store data in a folder specified by the environment variable
   `ARCHAPPL_SHORT_TERM_FOLDER` at the granularity of an hour.
2. **MTS** - A datastore that uses the
   PlainPBStoragePlugin
   to store data in a folder specified by the environment variable
   `ARCHAPPL_MEDIUM_TERM_FOLDER` at the granularity of a day.
3. **LTS** - A datastore that uses the
   PlainPBStoragePlugin
   to store data in a folder specified by the environment variable
   `ARCHAPPL_LONG_TERM_FOLDER` at the granularity of an year.

If you are using the generic build and would like to point to a
different `policies.py` file, you can use the `ARCHAPPL_POLICIES`
environment variable, like so.

```bash
    export ARCHAPPL_POLICIES=/nfs/epics/archiver/production_policies.py
```

On the other hand, if you are using a site specific build, you can
bundle your site-specific `policies.py` as part of the `mgmt WAR` during
the site specific build. Just add your `policies.py` to the source code
repository under `src/sitespecific/YOUR_SITE/classpathfiles` and build
the war by setting the `ARCHAPPL_SITEID` during the build using
something like `export ARCHAPPL_SITEID=YOUR_SITE`. In this case, you do
not need to specify the `ARCHAPPL_POLICIES` environment variable.

## Installing Tomcat

Installing Tomcat consists of

1. Untar\'ing the Tomcat distribution. It is best to set the
   environment variable `TOMCAT_HOME` to the location where the Tomcat
   distribution is expanded. Many of the following steps require a
   `TOMCAT_HOME` to be set.

2. Editing the `conf/server.xml` file to change the ports to better
   suit your installation.

   1. By default, the connector port for the HTTP connector is set
      to 8080. Change this to the port used by the `mgmt` webapp for
      this appliance, in this example, 17665.

      ```xml
      <Connector connectionTimeout="20000" port="808017665" protocol="HTTP/1.1" redirectPort="8443"/>
      ```

   2. Remove/comment out the sections for the AJP connector.

   3. At the end, there should be two ports active in the
      `conf/server.xml` file, one for the HTTP connector and the other
      for the `SHUTDOWN` command.

3. Logging needs no file in the Tomcat `lib` folder: each WAR ships its
   `log4j2.xml`, which writes to standard output for the systemd journal.
   Set the root level with the `ARCHAPPL_ROOT_LOGGER_LEVEL` environment
   variable (default `INFO`). See [Logging](logging.md) for the line
   format, the journal identifiers and the file fallback.

## Installing MySQL

The version of MySQL that is available from your distribution is
acceptable; though this is completely untuned. Please look at the more
than excellent chapters on MySQL optimization at the MySQL web site to
tune your MySQL instance. In addition to various parameters, even
something as simple as setting `innodb_flush_log_at_trx_commit=0`
(assuming you are ok with this) will go a long way in improving
performace (especially when importing channel archiver configuration
files etc). Each appliance has its own installation of MySQL. In each
appliance,

- Make sure MySQL is set to start on powerup (using `chkconfig`)

- Create a schema for the archiver appliance called `archappl` and
  grant a user (in this example, also called `archappl`) permissions
  for this schema.

  ```sql
      CREATE DATABASE archappl;
      GRANT ALL ON archappl.* TO 'archappl'@localhost IDENTIFIED BY '<password>';
  ```

- The archiver appliance ships with DDL, for MySQL, this is a file
  called `archappl_mysql.sql` that is included as part of the `mgmt`
  WAR file. Execute this script in you newly created schema. Confirm
  that the tables have been created using a `SHOW TABLES` command.
  There should be at least these tables

  1. `PVTypeInfo` - This table stores the archiving parameters for
     the PVs
  2. `PVAliases` - This table stores EPICS alias mappings
  3. `ExternalDataServers` - This table stores information about
     external data servers.
  4. `ArchivePVRequests` - This table stores archive requests that
     are still pending.

- Download and install the [MySQL
  Connector/J](http://dev.mysql.com/downloads/connector/j/) jar file
  into your Tomcat\'s `lib` folder. In addition to the log4j2.xml
  file, you should have a `mysql-connector-java-XXX.jar` as show here.

  ```bash
  $ ls -ltra
  ...
  -rw-r--r-- 1 mshankar cd     505 Nov 13 10:29 log4j2.xml
  -rw-r--r-- 1 mshankar cd 1007505 Nov 13 10:29 mysql-connector-java-5.1.47-bin.jar
  ```

- Add a connection pool in Tomcat named `jdbc/archappl`. You can use
  the Tomcat management UI or directly add an entry in
  `conf/context.xml` like so

  ```xml
  <Resource   name="jdbc/archappl"
        auth="Container"
        type="javax.sql.DataSource"
        factory="org.apache.tomcat.jdbc.pool.DataSourceFactory"
        username="archappl"
        password="XXXXXXX"
        testWhileIdle="true"
        testOnBorrow="true"
        testOnReturn="false"
        validationQuery="SELECT 1"
        validationInterval="30000"
        timeBetweenEvictionRunsMillis="30000"
        maxActive="10"
        minIdle="2"
        maxWait="10000"
        initialSize="2"
        removeAbandonedTimeout="60"
        removeAbandoned="true"
        logAbandoned="true"
        minEvictableIdleTimeMillis="30000"
        jmxEnabled="true"
        driverClassName="com.mysql.jdbc.Driver"
        url="jdbc:mysql://localhost:3306/archappl"
   />
  ```

  Of course, please do make changes appropriate to your installation.
  The only parameter that is fixed is the name of the pool and this
  needs to be `jdbc/archappl`. All other parameters are left to your
  discretion.

  - Note for Debian/Ubuntu users: The Tomcat packages shipped with
    Debian/Ubuntu do not include the Tomcat JDBC Connection Pool.
    Download it from the web and drop the `tomcat-jdbc.jar` file
    into `/usr/share/tomcat7/lib`.

## Setting up storage

This is specific to the needs of your `policies.py`. However, if you are
using the default `policies.py` that ships with the box or a variant
thereof, you\'ll need to set up three stages of storage. A useful way to
do this is to create a folder called `/arch` and then create soft links
in this folder to the actual physical location. For example,

```bash
$ ls -ltra
total 32
lrwxrwxrwx    1 archappl archappl      8 Jun 21  2013 sts -> /dev/shm
lrwxrwxrwx    1 archappl archappl      4 Jun 21  2013 mts -> data
lrwxrwxrwx    1 archappl archappl     40 Feb 12  2014 lts -> /nfs/site/archappl/archappl01
drwxr-xr-x  195 archappl archappl    4096 Oct 15 15:05 data
```

We then set environment variables in the startup script that point to
the locations within `/arch`. For example,

```bash
    export ARCHAPPL_SHORT_TERM_FOLDER=/arch/sts/ArchiverStore
    export ARCHAPPL_MEDIUM_TERM_FOLDER=/arch/mts/ArchiverStore
    export ARCHAPPL_LONG_TERM_FOLDER=/arch/lts/ArchiverStore
```

## Deploy the WAR files onto their respective containers

Deploying/upgrading a WAR file in a Tomcat container is very easy. Each
container has a `webapps` folder; all we have to do is to copy the
(newer) WAR into this folder and Tomcat (should) will expand the WAR
file and deploy the WAR file on startup. The deployment/upgrade steps
are

1. Stop all four Tomcat containers.
2. Remove the older WAR file and expanded WAR file from the `webapps`
   folder (if present).
3. Copy the newer WAR file into the `webapps` folder.
4. Optionally expand the WAR file after copying it over to the
   `webapps` folder
   - This lets you replace individual files in the expanded WAR file
     (for example, images, policies etc) giving you one more way to
     do site specific deployments.
5. Start all four Tomcat containers.

If `DEPLOY_DIR` is the parent folder of the individual Tomcat containers
and `WARSRC_DIR` is the location where the WAR files are present, then
the deploy steps (steps 2 and 3 in the list above) look something like

```bash
pushd ${DEPLOY_DIR}/mgmt/webapps && rm -rf mgmt*; cp ${WARSRC_DIR}/mgmt.war .; mkdir mgmt; cd mgmt; jar xf ../mgmt.war; popd;
pushd ${DEPLOY_DIR}/engine/webapps && rm -rf engine*; cp ${WARSRC_DIR}/engine.war .; mkdir engine; cd engine; jar xf ../engine.war; popd;
pushd ${DEPLOY_DIR}/etl/webapps && rm -rf etl*; cp ${WARSRC_DIR}/etl.war .; mkdir etl; cd etl; jar xf ../etl.war; popd;
pushd ${DEPLOY_DIR}/retrieval/webapps && rm -rf retrieval*; cp ${WARSRC_DIR}/retrieval.war .; mkdir retrieval; cd retrieval; jar xf ../retrieval.war; popd;
```

## Stopping and starting the individual Tomcats

Running multiple Tomcats on a single machine using the same install
requires two enviromnent variables

1. `CATALINA_HOME` - This is the install folder for Tomcat that is
   common to all Tomcat instances; in our case this is `$TOMCAT_HOME`
2. `CATALINA_BASE` - This is the deploy folder for Tomcat that is
   specific to each Tomcat instance; in our case this is
   - `${DEPLOY_DIR}/mgmt`
   - `${DEPLOY_DIR}/etl`
   - `${DEPLOY_DIR}/engine`
   - `${DEPLOY_DIR}/retrieval`

Each Tomcat instance runs in the foreground with `catalina.sh run`,
one per `CATALINA_BASE`, for example

```bash
CATALINA_HOME=${TOMCAT_HOME} CATALINA_BASE=${DEPLOY_DIR}/mgmt ${TOMCAT_HOME}/bin/catalina.sh run
```

Start `mgmt` first, then `engine`, `etl` and `retrieval`, each in its
own process, and stop them in the reverse order.
[epicsarchiverap-env](https://github.com/jeonghanlee/epicsarchiverap-env)
runs the four instances this way under one systemd service; see
[Logging](logging.md) for where their output goes.

Remember to set all the appropriate environment variables from the
previous steps

1. `JAVA_HOME`

2. `TOMCAT_HOME`

3. `ARCHAPPL_APPLIANCES`

4. `ARCHAPPL_MYIDENTITY`

5. `ARCHAPPL_SHORT_TERM_FOLDER` or equivalent

6. `ARCHAPPL_MEDIUM_TERM_FOLDER` or equivalent

7. `ARCHAPPL_LONG_TERM_FOLDER` or equivalent

8. `JAVA_OPTS` - This is the environment variable typically used by
   Tomcat to pass arguments to the VM. You can pass in appropriate
   arguments like so

   ```bash
       export JAVA_OPTS="-XX:+UseG1GC -Xmx4G -Xms4G -ea"
   ```

9. `LD_LIBRARY_PATH` - If you are using JCA, please make sure your
   LD_LIBRARY_PATH includes the paths to the JCA and EPICS base
   `.so`\'s.

## Other containers

It is possible to deploy the 4 WAR files of the archiver appliance on
other servlet containers or to use other industry standard provisioning
software to provision an appliance. The details outlined here are
guidelines on how to provision an appliance using Tomcat as a servlet
container. If you generate scripts for industry standard provisioning
software and are willing to share them, please add them to the
repositorty and contact the collaboration; we\'ll be happy to modify
these documents to accomodate the same.
