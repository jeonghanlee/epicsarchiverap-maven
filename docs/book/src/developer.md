# Developer guide

## Scope

This page covers the source layout, the test sets and how to run them,
the documentation build, and the PB file and PB/HTTP formats.

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
