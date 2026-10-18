# Developer guide

## Scope

This page covers the source layout, the test sets and how to run them,
the local appliance launcher, the documentation build, and the PB file
and PB/HTTP formats.

**Out of scope:** the details of the test wiring, which `TESTING.md` at
the repository root describes.

## Source layout

| Path | Content |
| --- | --- |
| `src/main/` | the code of the four web applications, their `web.xml` and web pages |
| `src/resources/main/` | `log4j2.xml`, packed into every WAR |
| `src/sitespecific/` | the site folders ([Building](building.md#building-for-a-site)) |
| `src/test/` | the tests and their data |
| `src/tools/` | stand-alone utilities, compiled only with `-Ptools` |
| `src/assembly/release.xml` | the release bundle layout |
| `docs/book/` | this book |

## Test sets

| Set | Needs | Command |
| --- | --- | --- |
| unit (default) | JDK 21 | `./mvnw test` |
| one test class | JDK 21 | `./mvnw test -Dtest=PolicyExecutionTest` |
| `localEpics` | EPICS base and pvxs on `PATH` | `./mvnw test -P localEpics` |
| `integration` | Tomcat 9 in `TOMCAT_HOME`, and what `localEpics` needs | `./mvnw test -P integration` |

- The default set leaves out the tests tagged `integration`,
  `localEpics`, `slow` and `flaky`.
- The EPICS tests start their own IOC with `softIocPVX` (or
  `softIocPVA`), and the build limits CA and PVA to the loopback
  interface, so they do not reach IOCs on the network.
- The integration tests start Tomcat instances from `TOMCAT_HOME` under
  `target/tomcats/` and deploy the WARs of the current build, so they
  run after `package`.
- The tests write their stores under `target/test-storage/` and their
  log to `target/arch.log`.

## Run a local appliance

The development launcher runs management, engine, ETL, and retrieval in
four foreground Tomcat instances. One run folder holds their configuration,
SQLite database, storage, logs, and temporary files. The folder remains
after shutdown and can be reused for the next run.

Prerequisites:

- Linux with Bash 4 or later and JDK 21.
- Python 3.9 or later, `sqlite3`, `curl`, `unzip`, `tar`, `sha512sum`,
  `flock`, and standard coreutils.
- A readable Tomcat 9 installation, or HTTPS access to the Apache archive.
- Free loopback ports 17665 through 17668 and 17670.

1. In the repository root, build the four WARs:

   ```bash
   ./mvnw -B -ntp clean package
   ```

2. Start the appliance with a dedicated run folder:

   ```bash
   scripts/run-local-appliance.bash <run_folder>
   ```

   Replace `<run_folder>` with an absolute or relative folder path. Quote
   paths containing spaces. The launcher prints each component URL, PID,
   and log path, then prints `Appliance ready.` when startup completes.

3. To stop the appliance, press Ctrl-C in its terminal or send SIGTERM to
   the PID in `<run_folder>/launcher.pid`. Wait for the launcher to exit.

4. To resume archiving, repeat step 2 with the same folder. The launcher
   retains PV configuration and stored samples in that folder.

For verification, open `http://127.0.0.1:17665/mgmt/bpl/getApplianceInfo`
after the ready message. It returns the appliance configuration as JSON.
Use the management page to add PVs from a separately running IOC.
Channel Access and PVAccess discovery default to loopback;
`EPICS_CA_ADDR_LIST` and `EPICS_PVA_ADDR_LIST` select other addresses.

| Component | Default URL | Console log relative to the run folder |
| --- | --- | --- |
| Management | `http://127.0.0.1:17665/mgmt/` | `instances/mgmt/logs/console.log` |
| Engine | `http://127.0.0.1:17666/engine/` | `instances/engine/logs/console.log` |
| ETL | `http://127.0.0.1:17667/etl/` | `instances/etl/logs/console.log` |
| Retrieval | `http://127.0.0.1:17668/retrieval/` | `instances/retrieval/logs/console.log` |

### Tomcat selection and options

`--tomcat-home` selects an installation explicitly. Otherwise the launcher
checks `TOMCAT_HOME`, then `CATALINA_HOME`, standard installation paths,
and its retained download. An invalid explicit installation is an error.
When no usable Tomcat 9 is found, the launcher downloads version 9.0.122
inside the run folder and verifies its Apache SHA-512 checksum before
extraction. An existing installation remains unchanged.

| Option | Default | Meaning |
| --- | --- | --- |
| `--war-dir DIR` | `target` | One complete build's four WARs |
| `--tomcat-home DIR` | automatic selection | Existing readable Tomcat 9 |
| `--port-base PORT` | `17665` | Four HTTP ports starting at `PORT`; cluster port at `PORT+5` |
| `--start-timeout SEC` | `180` | Startup timeout, 1 through 86400 seconds |
| `--stop-timeout SEC` | `300` | Total graceful shutdown timeout, 1 through 86400 seconds |

### Folder ownership and shutdown

The launcher holds an exclusive lock throughout preparation, operation,
and shutdown. A second invocation using the same folder, including a
symlink alias, is rejected. Keep `.launcher.lock` in place. Symlinks
inside the run folder are unsupported.

Shutdown proceeds in reverse component order under one shared deadline.
At that deadline, the launcher sends SIGKILL to remaining owned JVMs and
allows five seconds to reap them. A forced stop returns failure and can
leave buffered samples unflushed; the database, stores, and logs remain.
Ordinary SIGINT and SIGTERM stops return 130 and 143, respectively.

`children.tsv` records each owned PID with its process start identity.
If an owned process survives shutdown, the launcher refuses to reuse the
folder while that process remains alive. Inspect the retained logs and
process before restarting. The launcher does not manage production
services or systemd units.

## Run the test IOC of the console checks

The browser checks of the console read the records of one soft IOC, which
`ioc-runner` runs as a user service from `src/resources/test/st.cmd`.
`st.cmd` loads `ConsoleChartPVs.db` and one of two files for the four
records `SR:BPM:03:X`, `SR:BPM:03:Y`, `SR:BPM:04:X` and `SR:BPM:04:Y`:
`ConsoleChartPVsRecordChange.db` (scalar doubles, the default) or
`ConsoleChartPVsRecordChangeTypes.db` (the same names as an integer, a
string, a waveform and an integer), chosen by the `RECORD_CHANGE` variable
of the IOC configuration. The `CAV2_*` variables of the same file give
`SR:RF:CAV2:TEMP` and `SR:RF:CAV2:POWER` another unit, precision and limits.

Prerequisites:

- EPICS 7.0.10 with the pvxs module, which provides `softIocPVX`,
  `caget`, `cainfo` and `pvget`. A shell gets them on `PATH` from
  `setEpicsEnv.bash` of the installation.
- `ioc-runner` from the `epics-ioc-runner` repository, on `PATH`, with
  its local mode set up (`~/.config/procServ.d`).
- A free Channel Access server port for the IOC. The local appliance has to
  use the same port, so start it with `EPICS_CA_SERVER_PORT` set to that
  value.

1. Copy the configuration file out of the repository:

   ```bash
   cp src/resources/test/consolechart.conf <work_dir>/consolechart.conf
   ```

   Replace `<work_dir>` with a folder of your own; the installed copy is
   named after the file, so keep the name `consolechart.conf`.

2. In the copy, replace each placeholder:

   | Placeholder | Value |
   | --- | --- |
   | `<user>`, `<group>` | The user and the group the IOC runs as |
   | `<repository>` | The absolute path of this repository |
   | `<epics_pvxs_bin>` | The folder of `softIocPVX`, such as `<epics_base>/../modules/pvxs/bin/linux-x86_64` |
   | `<ca_port>` | The Channel Access server port of the IOC; 5064 is the EPICS default |
   | `<ca_repeater_port>` | The repeater port, usually `<ca_port>` plus one |

3. To install the IOC, validate the file with `ioc-runner`:

   ```bash
   ioc-runner --local install <work_dir>/consolechart.conf
   ```

   ```text
   Validation passed successfully.
   IOC consolechart installed in local mode. Use 'start' command to run it.
   ```

4. Start the IOC and list it:

   ```bash
   ioc-runner --local start consolechart
   ```

   ```bash
   ioc-runner --local list
   ```

   ```text
   IOC NAME             | STATUS   | STARTED           | UDS PATH
   consolechart         | active   | 2026-10-17 23:48  | /run/user/1000/procserv/consolechart/control
   ```

5. To give the four records their other types, set `RECORD_CHANGE=Types` in
   the copy, then stop the IOC, install the file again and start it; a
   running IOC refuses another installation:

   ```bash
   ioc-runner --local stop consolechart
   ```

   ```bash
   ioc-runner --local -f install <work_dir>/consolechart.conf
   ```

   ```bash
   ioc-runner --local start consolechart
   ```

   An empty `RECORD_CHANGE=` and the same three commands put the scalar
   doubles back. The `CAV2_*` variables change the same way.

6. To stop the IOC, stop its service:

   ```bash
   ioc-runner --local stop consolechart
   ```

   `ioc-runner --local remove consolechart` also removes the installed
   configuration.

Verification: read one record over Channel Access and over PVAccess with
the port and the loopback address of the IOC.

```bash
EPICS_CA_SERVER_PORT=<ca_port> EPICS_CA_ADDR_LIST=127.0.0.1 EPICS_CA_AUTO_ADDR_LIST=NO caget SR:TICK
```

```bash
EPICS_PVA_ADDR_LIST=127.0.0.1 EPICS_PVA_AUTO_ADDR_LIST=NO pvget SR:TICK
```

```text
SR:TICK                        7
SR:TICK 2026-10-17 23:48:49.779  7
```

`SR:TICK` counts the seconds since the IOC started. After step 5,
`cainfo SR:BPM:04:X` with the same variables reports `DBF_LONG` as the
native data type, and `DBF_DOUBLE` after the change back.

## Tools

```bash
./mvnw -B -Ptools test-compile
```

The utilities under `src/tools/` generate test data and load, such as
large IOC databases and performance harnesses. They are compiled as
test sources and are not packed into the WARs.

## Documentation

```bash
docker build -t aa-mdbook docs/book
```
```bash
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD/docs/book:/book" aa-mdbook build
```

The image pins mdBook 0.4.52 and mdbook-admonish 1.20.0. The output is
`docs/book/book/`. A push to `modernize` that changes `docs/book/`
publishes the book on GitHub Pages.

## PB files

The `pb` plugin stores each sample as one protocol buffer (PB) message.
The messages are defined in
`src/main/edu/stanford/slac/archiverappliance/PB/EPICSEvent.proto`,
one message type per DBR type.

```
PayloadInfo header: PV name, DBR type, year, element count
sample
sample
...
```

- A file holds one PV for one partition. The first line is a
  `PayloadInfo` message; each further line is one sample.
- Each serialized message is escaped so that it holds no newline, which
  keeps one sample per line: `0x1B` becomes `0x1B 0x01`, `0x0A` becomes
  `0x1B 0x02`, and `0x0D` becomes `0x1B 0x03`.
- The year is stored once in the header; each sample stores only its
  seconds into the year and its nanoseconds. A file therefore belongs to
  one year, and a scalar double takes about 21 bytes per sample.
- Samples are in increasing time order, so a file can be searched
  without an index, and `wc -l` counts its samples.

The mgmt WAR ships utilities for PB files under `install/pbutils/`:

| Script | Purpose |
| --- | --- |
| `printTimes.sh` | print the timestamps of the samples |
| `pb2json.sh` | print the samples as JSON |
| `validate.sh` | check files or folders |
| `repair.sh` | check files and rewrite a damaged file with its valid samples, optionally keeping a backup |

The scripts expect to run from inside an unpacked mgmt WAR, whose
`WEB-INF/lib` and `WEB-INF/classes` form their class path.

The same class path runs the PB tools that have no script, as
`java -cp "<WEB-INF>/classes:<WEB-INF>/lib/*" <class> <arguments>`. A
tool that a site needs gets its script and its description in the table
above.

| Class in `edu.stanford.slac.archiverappliance.PlainPB.utils` | Purpose |
| --- | --- |
| `ChangePVName <old PV> <new PV> <files>` | rewrite the header of PB files for a renamed PV |
| `SlicePBFile <source> <start> <end> <destination>` | copy the samples between two ISO 8601 times into a new file |
| `MergePBFile <file A> <file B> <destination>` | merge two files of the same PV and year into a new file |
| `IsSubset <file A> <file B>` | report the timestamps of file A that file B lacks |
| `PrintFileInfo <files or folder>` | print PV name, year, type and first and last sample time per file |
| `PrintFirstAndLastTimes <files or folders>` | print the time range of each file |
| `PrintPBResponse <saved response>` | decode a saved PB/HTTP retrieval response |
| `ReadAsDBRType <type> <year> <file>` | read a file as the given type without its header, for a damaged header |
| `StatusSeverityCounts <folder>` | count the status and severity values of every file under the folder |

`org.epics.archiverappliance.utils.imprt.ExportCSV <file>` writes the
samples of one file as ChannelArchiver CSV (EPICS epoch seconds,
nanoseconds, value, status, severity) to standard output.

## PB/HTTP

The `raw` retrieval format streams the same layout over HTTP, in one or
more chunks. Each chunk is a `PayloadInfo` line followed by sample
lines, and an empty line separates two chunks:

```
PayloadInfo
sample
sample
                 <- empty line
PayloadInfo
sample
```

The server splits the data into chunks by source and partition; a client
reads the chunks in turn as one stream of samples. The
[pbrawclient](https://github.com/slacmshankar/epicsarchiverap_pbrawclient/)
Java library reads this format.
