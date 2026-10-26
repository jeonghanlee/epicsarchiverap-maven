# Building

## Scope

This page covers building the four WARs and the release bundle from
this repository, and building them for a site.

**Out of scope:** running the test sets in depth
([Developer guide](developer.md)) and deploying the build
([Install the appliance from the release bundle](install-bundle.md)).

## Requirements

- JDK 21: the `java` on `PATH`, or the install that `JAVA_HOME` names.
- A Git clone of this repository: the build names its outputs after the
  commit ID and writes `RELEASE_NOTES` from the Git log of
  `remotes/origin/master`, so the clone needs that remote-tracking branch.
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
  workflow first runs `bash scripts/ui-static-checks.bash`, which checks
  the interface files, and then `./mvnw -B -ntp clean verify`. It runs on
  every push except one that changes only `docs/milestone-*.md` and
  `docs/CLOSED_DOORS.md`.

## Outputs

All outputs are under `target/`. `<date>` is the build date as
`yyyyMMdd` and `<commit>` is the first eight characters of the commit
ID.

| Output | Content |
| --- | --- |
| `aa-<date>-<commit>-mgmt.war` | the mgmt web application |
| `aa-<date>-<commit>-engine.war` | the engine web application |
| `aa-<date>-<commit>-etl.war` | the web application of ETL, the process that moves data between stores |
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
`classpathfiles/` must exist; `img/`, `css/main.css` and
`template_changes.html` are optional. The build applies them in this
order:

| Site file | Result in the build |
| --- | --- |
| `template_changes.html` | Each block between `<!-- @begin(name) -->` and `<!-- @end(name) -->` replaces the block of the same name in every management page, before the files below are copied. The pages carry the blocks `site_header`, `site_logo`, `site_navbar` and `site_footer`; a block the pages do not carry has no effect. The page header frame, `<div class="pageheader">`, stays outside the blocks: `site_header` holds only the header logo on the left, as `<span><img ... /></span>`, and `site_logo` only the site logo on the right, as `<span id="siteimages"><img ... /></span>` with an optional link around the image; the size rules of the stylesheet apply to these forms. A block that carries its own `<div class="pageheader">` puts a second header inside the first. A site that fills only `site_logo` keeps the default header logo; `src/sitespecific/tests/template_changes.html` fills both. |
| `img/` with its subfolders | Copied to `ui/comm/img/` of the mgmt and retrieval WARs; a file of the same path replaces the default image. The default set is `archiverheader.svg` (the header logo), `wordmark.svg` (the header logo below 360 px) and `sitelogo.svg` (the default site logo). The stylesheet sizes both logos by height: 44 px, 30 px at 720 px and below, and the site logo 24 px at 380 px and below. `scripts/logo/make_header_logo.py` and `scripts/logo/make_site_logo.py` regenerate the three images into `src/main/org/epics/archiverappliance/staticcontent/img`, or into the folder given as their argument; they need fontTools and the Inter Display fonts of the Debian package `fonts-inter`. |
| `css/main.css` | Copied to `ui/comm/css/main.css` of the mgmt and retrieval WARs, replacing the default stylesheet. |
| `classpathfiles/` | Copied into `WEB-INF/classes` of all four WARs, so the web applications find `policies.py`, `archappl.properties` and, if present, `appliances.xml` there. |

The build writes the version file `ui/comm/version.txt` of all four WARs
with the commit of the build and the day it was built, in UTC, such as
`Archiver Appliance Version 84ae8a83, built 2026-10-12`; the WAR names
carry the same commit and day (`aa-20261012-84ae8a83-mgmt.war`). The
System page and the `getVersion` and `getApplianceInfo` calls report this
text, and the System page compares it across the four web applications.
The etl and engine WARs, which serve no page, carry no other interface
file. A file the site does not provide keeps the default of this
repository.

The build prints a warning for each file under `css/` other than
`main.css`, and for each folder of the site other than
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
