# SVG Viewer Asset

The retrieval web application serves an SVG-based data viewer whose assets are
vendored as a single committed archive rather than downloaded during the build,
so a clean build needs no outbound network access.

## Identity

- Committed archive: `src/main/org/epics/archiverappliance/retrieval/staticcontent/viewer.zip`
- Upstream source: `https://github.com/archiver-appliance/svg_viewer`, tag `v1.2.1`
- Archive layout: the contents of the tagged source tree, with no top-level
  folder. The path inside the archive must match what the tagged build produced.

## Build data flow

1. `stage-resources` (maven-resources-plugin, `prepare-package`) copies
   `src/main/org/epics/archiverappliance/retrieval/staticcontent/` into
   `target/stage/org/epics/archiverappliance/retrieval/staticcontent/`.
2. The retrieval WAR packaging copies that staged directory to `ui/`, so the
   deployed resource is `ui/viewer.zip`.

No build step downloads, unpacks, or re-zips the asset.

## Refreshing to a new upstream version

Run these from the repository root for a target tag `vX.Y.Z`. The tag carries a
leading `v`, but the folder it unpacks to drops it (`svg_viewer-X.Y.Z`).
Removing the existing archive before re-zipping is required, because `zip` adds
to an archive that already exists rather than replacing it.

```
curl -sL -o /tmp/svgv.zip https://github.com/archiver-appliance/svg_viewer/archive/vX.Y.Z.zip
rm -rf /tmp/svgv && mkdir /tmp/svgv && unzip -q /tmp/svgv.zip -d /tmp/svgv
rm -f src/main/org/epics/archiverappliance/retrieval/staticcontent/viewer.zip
( cd /tmp/svgv/svg_viewer-X.Y.Z && zip -r -X "$OLDPWD/src/main/org/epics/archiverappliance/retrieval/staticcontent/viewer.zip" . )
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 MAVEN_OPTS=-Xmx1g ./mvnw -o -B clean package -DskipTests
```

The `-o` flag builds offline, which assumes the Maven dependency cache is
already populated; on a fresh environment, run the build once online first.

Then:

1. Update the tag version in the `pom.xml` vendor comment and in this document.
2. Confirm `ui/viewer.zip` is present in `target/aa-*-retrieval.war`.
3. Commit the updated archive, the `pom.xml` comment, and this document.

The re-zip must exclude the top-level folder so the WAR resource path stays
`ui/viewer.zip`.
