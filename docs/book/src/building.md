# Building

## Scope

This page covers building the four WARs and the release bundle from
this repository, and building them for a site.

**Out of scope:** running the test sets in depth
([Developer guide](developer.md)) and deploying the build
([Installing](installing.md)).

## Requirements

- JDK 21, with `JAVA_HOME` exported.
- A Git clone of this repository: the build names its outputs after the
  commit ID and writes `RELEASE_NOTES` from the Git log.
- No system Maven: the committed Maven Wrapper (`./mvnw`) downloads
  Maven 3.9.16.

## Build commands

```bash
./mvnw -B clean package
```
```bash
./mvnw -B clean package -DskipTests
```
```bash
./mvnw -B clean verify
```

- `package` compiles, runs the default test set and builds the outputs.
- `verify` does the same and then runs the dependency checks
  (dependency convergence, upper-bound versions, duplicate classes, and
  unused or undeclared dependencies). The continuous integration (CI)
  workflow runs `./mvnw -B -ntp clean verify` on every push.

## Outputs

All outputs are under `target/`. `<date>` is the build date as
`yyyyMMdd` and `<commit>` is the first eight characters of the commit
ID.

| Output | Content |
| --- | --- |
| `aa-<date>-<commit>-mgmt.war` | the mgmt web application |
| `aa-<date>-<commit>-engine.war` | the engine web application |
| `aa-<date>-<commit>-etl.war` | the ETL web application |
| `aa-<date>-<commit>-retrieval.war` | the retrieval web application |
| `aa-<date>-<commit>.tar.gz` | the release bundle, below |
| `tomcat-log4j/` | the log4j jars for Tomcat's own logging ([Logging](logging.md)) |
| `site/apidocs/` | the Javadoc |

The release bundle holds:

- `mgmt.war`, `engine.war`, `etl.war` and `retrieval.war`, the four WARs
  under their plain names, so that Tomcat deploys each at `/mgmt`,
  `/engine`, `/etl` and `/retrieval`;
- `install_scripts/archappl_mysql.sql` and
  `install_scripts/archappl_sqlite.sql`, the configuration database
  schemas;
- `tomcat-log4j/`, the same jars as above;
- `LICENSE`, `LICENCES/` and `RELEASE_NOTES`.

The mgmt WAR also carries the two schema files under `install/`, and the
PB file utilities (`pb2json.sh`, `printTimes.sh`, `validate.sh`,
`repair.sh`) under `install/pbutils/` ([Developer guide](developer.md#pb-files)).

## Building for a site

Site-specific files live in `src/sitespecific/<site>/`. The folder
`classpathfiles/` must exist; `img/`, the two stylesheets and
`template_changes.html` are optional. The build applies them in this
order:

| Site file | Result in the build |
| --- | --- |
| `template_changes.html` | Each block between `<!-- @begin(name) -->` and `<!-- @end(name) -->` replaces the block of the same name in every management page, before the files below are copied. The pages carry the blocks `main_includes`, `site_header`, `site_navbar` and `site_footer`, and the index page also `site_contact_text`; a block the pages do not carry has no effect. |
| `img/` with its subfolders | Copied to `ui/comm/img/` of all four WARs, replacing the default images of the same path. |
| `css/main.css` | Copied to `ui/comm/css/main.css` of all four WARs, replacing the default stylesheet. |
| `css/mgmt.css` | Copied to `ui/css/mgmt.css` of the mgmt WAR, replacing the default stylesheet. |
| `classpathfiles/` | Copied into `WEB-INF/classes` of all four WARs, so the web applications find `policies.py`, `archappl.properties` and, if present, `appliances.xml` there. |

The build writes the version file `ui/comm/version.txt` of all four WARs
from the project version. A file the site does not provide keeps the
default of this repository.

The build prints a warning for each file under `css/` other than
`main.css` and `mgmt.css`, and for each folder of the site other than
`img`, `css` and `classpathfiles`, because it does not apply them. A
site name without a folder under `src/sitespecific/`, and a site folder
that holds a `build.xml`, stop the build with an error that names the
folder or the file; move the site's changes into the files of the table.
The build runs no other site step, so a change that the table does not
cover has to be made in this repository. `src/sitespecific/tests/` is a
working example.

The site is chosen with the `ARCHAPPL_SITEID` environment variable at
build time; without it the build uses the `default` site.

```bash
ls src/sitespecific/
```
```
default  tests
```
To build for a new site, start from a copy of the `default` site, edit
its files, and name it at build time:

```bash
cp -r src/sitespecific/default src/sitespecific/mysite
```
```bash
ARCHAPPL_SITEID=mysite ./mvnw -B clean package -DskipTests
```

- `default` carries a `policies.py` and an `archappl.properties`, and no
  `appliances.xml`.
- `tests` is the site the test suite uses.

A site folder is not required at deployment: every file it provides can
also be given to the running appliance through an environment variable
([Configuration](configuration.md#configuration-files)).
