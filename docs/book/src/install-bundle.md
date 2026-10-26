# Install the appliance from the release bundle

This procedure installs the four web applications of a release bundle as four Tomcat 9 instances on one host, with
SQLite as the configuration database. The steps need no root privileges; installing the prerequisites does.

## Prerequisites

- A Linux host with a Java 21 runtime, `curl`, `tar`, `sha512sum` and `sqlite3`. On Debian 13, install the missing ones with
  `sudo apt-get install -y openjdk-21-jre-headless sqlite3`; on Rocky Linux 8.10, with
  `sudo dnf install -y java-21-openjdk-headless sqlite`.
- The release bundle `aa-<date>-<commit>.tar.gz` on the host ([Building](building.md#outputs)).
- Network access from the host to `archive.apache.org` over HTTPS, and to the IOCs over Channel Access
  ([Configuration](configuration.md)).
- The TCP ports 17665 to 17668, 17670 and 17675 to 17678 free on the host. To use other ports, change them in steps 9 and 10
  ([Installation layout and settings](installing.md#tomcat-instances)).

## Steps

1. Set the variables that the later steps use. Run every step in this same shell, because the later steps need these
   variables and the folder that step 4 enters:

   ```bash
   export JAVA_HOME=<jdk_home>
   export DEPLOY_DIR="${HOME}/archiver"
   export CATALINA_HOME="${DEPLOY_DIR}/apache-tomcat-9.0.122"
   BUNDLE=<bundle_path>
   IOC_ADDRESS=<ioc_address>
   ```

   `<jdk_home>` is the folder that contains `bin/java` of the Java 21 installation: `/usr/lib/jvm/java-21-openjdk-amd64` on
   Debian 13 and `/usr/lib/jvm/jre-21-openjdk` on Rocky Linux 8.10. `<bundle_path>` is the path of the
   release bundle. `<ioc_address>` is the address of the host that serves your PVs over Channel Access.

2. Create the folders of the four instances, the configuration, and the three stores:

   ```bash
   mkdir -p "${DEPLOY_DIR}"/{config,stores/sts,stores/mts,stores/lts}
   for c in mgmt engine etl retrieval; do mkdir -p "${DEPLOY_DIR}/${c}"/{bin,conf,logs,temp,work,webapps}; done
   ```

3. Unpack the release bundle:

   ```bash
   mkdir -p "${DEPLOY_DIR}/bundle" && tar -xzf "${BUNDLE}" -C "${DEPLOY_DIR}/bundle"
   ```

4. In `${DEPLOY_DIR}`, download Tomcat 9.0.122 and its checksum:

   ```bash
   cd "${DEPLOY_DIR}"
   TOMCAT_URL=https://archive.apache.org/dist/tomcat/tomcat-9/v9.0.122/bin/apache-tomcat-9.0.122.tar.gz
   curl -fLO "${TOMCAT_URL}"
   curl -fLO "${TOMCAT_URL}.sha512"
   ```

5. Check the Tomcat archive against its checksum:

   ```bash
   sha512sum -c apache-tomcat-9.0.122.tar.gz.sha512
   ```

   The command must print `apache-tomcat-9.0.122.tar.gz: OK`.

6. Unpack Tomcat:

   ```bash
   tar -xzf apache-tomcat-9.0.122.tar.gz
   ```

7. Copy the configuration of the Tomcat installation into each instance:

   ```bash
   for c in mgmt engine etl retrieval; do cp -r "${CATALINA_HOME}/conf/." "${DEPLOY_DIR}/${c}/conf/"; done
   ```

8. Copy each WAR of the bundle into the `webapps/` folder of its instance:

   ```bash
   for c in mgmt engine etl retrieval; do cp "${DEPLOY_DIR}/bundle/${c}.war" "${DEPLOY_DIR}/${c}/webapps/"; done
   ```

   The plain file names make Tomcat deploy the web applications at `/mgmt`, `/engine`, `/etl` and `/retrieval`.

9. In the `conf/server.xml` of each instance, set the HTTP port of its web application and a shutdown port that is
   unique on the host:

   ```bash
   i=0
   for c in mgmt engine etl retrieval; do
       sed -i "s/<Server port=\"8005\"/<Server port=\"$((17675 + i))\"/" "${DEPLOY_DIR}/${c}/conf/server.xml"
       sed -i "s/<Connector port=\"8080\"/<Connector port=\"$((17665 + i))\"/" "${DEPLOY_DIR}/${c}/conf/server.xml"
       i=$((i + 1))
   done
   ```

   The HTTP ports are 17665 for mgmt, 17666 for engine, 17667 for etl and 17668 for retrieval. The `server.xml` of
   Tomcat 9.0.122 has the AJP connector commented out, so nothing else needs removing.

10. Write `appliances.xml`, which describes the appliance and the URLs of its web applications
    ([Installation layout and settings](installing.md#appliancesxml)):

    ```bash
    cat > "${DEPLOY_DIR}/config/appliances.xml" <<EOF
    <appliances>
       <appliance>
         <identity>appliance0</identity>
         <cluster_inetport>localhost:17670</cluster_inetport>
         <mgmt_url>http://localhost:17665/mgmt/bpl</mgmt_url>
         <engine_url>http://localhost:17666/engine/bpl</engine_url>
         <etl_url>http://localhost:17667/etl/bpl</etl_url>
         <retrieval_url>http://localhost:17668/retrieval/bpl</retrieval_url>
         <data_retrieval_url>http://localhost:17668/retrieval</data_retrieval_url>
       </appliance>
    </appliances>
    EOF
    ```

11. Create the SQLite configuration database from the schema of the bundle:

    ```bash
    sqlite3 "${DEPLOY_DIR}/config/archappl.sqlite" < "${DEPLOY_DIR}/bundle/install_scripts/archappl_sqlite.sql"
    ```

12. Define the DataSource in the `conf/context.xml` of the mgmt instance
    ([Persistence](persistence.md#setting-up-sqlite)):

    ```bash
    cat > "${DEPLOY_DIR}/mgmt/conf/context.xml" <<EOF
    <Context>
        <Resource name="jdbc/archappl" auth="Container"
            factory="org.apache.tomcat.jdbc.pool.DataSourceFactory" type="javax.sql.DataSource"
            driverClassName="org.sqlite.JDBC" url="jdbc:sqlite:${DEPLOY_DIR}/config/archappl.sqlite?journal_mode=WAL"
            maxActive="1" maxIdle="1" minIdle="0" initialSize="0" maxWait="10000"
            testOnBorrow="true" validationInterval="30000" validationQuery="SELECT 1"/>
    </Context>
    EOF
    ```

13. Write the environment that every instance reads at start ([Installation layout and settings](installing.md#environment)):

    ```bash
    cat > "${DEPLOY_DIR}/config/setenv.sh" <<EOF
    export ARCHAPPL_APPLIANCES="${DEPLOY_DIR}/config/appliances.xml"
    export ARCHAPPL_MYIDENTITY=appliance0
    export ARCHAPPL_SHORT_TERM_FOLDER="${DEPLOY_DIR}/stores/sts"
    export ARCHAPPL_MEDIUM_TERM_FOLDER="${DEPLOY_DIR}/stores/mts"
    export ARCHAPPL_LONG_TERM_FOLDER="${DEPLOY_DIR}/stores/lts"
    export EPICS_CA_AUTO_ADDR_LIST=NO
    export EPICS_CA_ADDR_LIST="${IOC_ADDRESS}"
    export CATALINA_PID="\${CATALINA_BASE}/temp/catalina.pid"
    export CATALINA_OPTS="-Xms256m -Xmx512m -XX:+ExitOnOutOfMemoryError -XX:+HeapDumpOnOutOfMemoryError"
    export CATALINA_OPTS="\${CATALINA_OPTS} -XX:HeapDumpPath=\${CATALINA_BASE}/logs -Duser.home=\${CATALINA_BASE}/work"
    export CATALINA_OPTS="\${CATALINA_OPTS} -Dorg.sqlite.tmpdir=\${CATALINA_BASE}/temp"
    export CATALINA_OPTS="\${CATALINA_OPTS} -Dpython.cachedir=\${CATALINA_BASE}/temp/jython"
    EOF
    ```

    The backslash before `${CATALINA_BASE}` keeps that variable for Tomcat to fill in at start, so one file serves all
    four instances. The heap of `-Xmx512m` suits a first check; size it for the site
    ([Configuration](configuration.md)).

14. Copy the environment file into the `bin/` folder of each instance, where `catalina.sh` reads it as `setenv.sh`:

    ```bash
    for c in mgmt engine etl retrieval; do cp "${DEPLOY_DIR}/config/setenv.sh" "${DEPLOY_DIR}/${c}/bin/setenv.sh"; done
    ```

15. Start the four instances in this order:

    ```bash
    for c in mgmt engine etl retrieval; do
        CATALINA_BASE="${DEPLOY_DIR}/${c}" "${CATALINA_HOME}/bin/catalina.sh" start
    done
    ```

    The command returns at once; the instances start in the background and do not wait for each other. The output of
    each instance is in `${DEPLOY_DIR}/<instance>/logs/catalina.out`, where `<instance>` is `mgmt`, `engine`, `etl` or
    `retrieval`.

## Verification

Wait until every instance reports that its start-up is complete. Each of the four calls prints a JSON object:

```bash
i=0
for c in mgmt engine etl retrieval; do
    curl -s "http://localhost:$((17665 + i))/${c}/bpl/startupState"; echo
    i=$((i + 1))
done
```

Each line must read `{"status":"STARTUP_COMPLETE"}`. The four instances take about 50 seconds to get there and report
`READY_TO_JOIN_APPLIANCE` and `POST_STARTUP_RUNNING` on the way. Until then the `mgmt` pages answer with HTTP 503 and its calls with HTTP 500.

Check that the appliance describes itself:

```bash
curl -s http://localhost:17665/mgmt/bpl/getApplianceInfo
```

The reply is a JSON object with the identity `appliance0` and the URLs of `appliances.xml`.

Archive one PV. Replace `<pv_name>` with a PV that the IOC at `<ioc_address>` serves:

```bash
curl -s "http://localhost:17665/mgmt/bpl/archivePV?pv=<pv_name>"
```

The reply reads `Archive request submitted`. The appliance then takes about 100 seconds to connect to the PV and start
archiving it. Repeat this call until the reply shows `connectionState` as `true`:

```bash
curl -s "http://localhost:17665/mgmt/bpl/getPVStatus?pv=<pv_name>"
```

Read the PV back:

```bash
curl -s "http://localhost:17668/retrieval/data/getData.json?pv=<pv_name>"
```

The reply is a JSON array whose `data` holds the stored samples of the PV.

Open `http://<host_name>:17665/mgmt/ui/system.html` in a browser, where `<host_name>` is the name or address of the host. The *Components* row must read *all running*.

To stop the appliance, see [Starting and stopping](installing.md#starting-and-stopping).
