# Persistence

## Scope

This page covers the configuration database: what it holds, how the
appliance connects to it, and how to set it up with MariaDB or SQLite.

**Out of scope:** the archived samples, which live in the stores
([Architecture](architecture.md#stores)), not in the database.

## What the database holds

The configuration database holds four tables:

| Table | Content |
| --- | --- |
| `PVTypeInfo` | the archiving configuration of every PV |
| `PVAliases` | alias names and the PVs they point to |
| `ArchivePVRequests` | archive requests still in progress |
| `ExternalDataServers` | external data servers ([Redundancy](redundancy.md)) |

Only the mgmt web application opens the database.

## How the appliance connects

- The default layer is `MySQLPersistence`, a JDBC layer despite its
  name. `ARCHAPPL_PERSISTENCE_LAYER` selects another class
  ([Configuration](configuration.md#environment-variables)).
- The layer looks up the Java Naming and Directory Interface (JNDI)
  DataSource `java:/comp/env/jdbc/<name>`, where `<name>` is
  `ARCHAPPL_DB_NAME`, or `archappl` when that is unset. The mgmt WAR
  declares the resource `jdbc/archappl`.
- On the first connection it reads the database product name: a name
  that contains `sqlite` selects the SQLite dialect, anything else the
  MySQL dialect, which MariaDB uses.
- The MariaDB client (`mariadb-java-client`) and the SQLite driver
  (`sqlite-jdbc`) ship inside the WARs; they are not copied into
  Tomcat's `lib/`.

The other layers, `InMemoryPersistence`, `JDBM2Persistence` and
`RedisPersistence`, remain in the code; the tests use
`InMemoryPersistence`, which keeps nothing across a restart.

## Setting up MariaDB

1. Create the database and a user for the appliance:

   ```sql
   CREATE DATABASE archappl;
   CREATE USER 'archappl'@'localhost' IDENTIFIED BY '...';
   GRANT ALL PRIVILEGES ON archappl.* TO 'archappl'@'localhost';
   ```

2. Load the schema from the release bundle:

   ```bash
   mysql -u archappl -p archappl < install_scripts/archappl_mysql.sql
   ```

3. Define the DataSource in the mgmt instance's `conf/context.xml`:

   ```xml
   <Resource name="jdbc/archappl"
       auth="Container"
       factory="org.apache.tomcat.jdbc.pool.DataSourceFactory"
       type="javax.sql.DataSource"
       driverClassName="org.mariadb.jdbc.Driver"
       url="jdbc:mariadb://localhost:3306/archappl"
       username="archappl"
       password="..."
       maxActive="10"
       testOnBorrow="true"
       validationQuery="SELECT 1"/>
   ```

## Setting up SQLite

1. Create the database file from the schema, in a folder the Tomcat
   user can write to (SQLite writes lock files beside the database):

   ```bash
   sqlite3 /arch/config/archappl.sqlite < install_scripts/archappl_sqlite.sql
   ```

2. Define the DataSource with one connection, because SQLite locks the
   file on every write:

   ```xml
   <Resource name="jdbc/archappl"
       auth="Container"
       type="javax.sql.DataSource"
       driverClassName="org.sqlite.JDBC"
       url="jdbc:sqlite:/arch/config/archappl.sqlite?journal_mode=WAL"
       maxTotal="1"
       maxIdle="1"
       maxActive="1"/>
   ```

   The write-ahead log (WAL) journal mode improves write performance; it
   adds `.wal` and `.shm` files beside the database file.

## Checking the schema

After loading the schema, the four tables must exist. For MariaDB:

```bash
mysql -u archappl -p archappl -e "SHOW TABLES"
```

For SQLite:

```bash
sqlite3 /arch/config/archappl.sqlite ".tables"
```

Without the schema the appliance still starts, but writing a PV's
configuration fails, and the PVs are not archived again after a
restart.
