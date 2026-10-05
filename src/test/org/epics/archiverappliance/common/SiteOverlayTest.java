package org.epics.archiverappliance.common;

import org.epics.archiverappliance.mgmt.bpl.SyncStaticContentHeadersFooters;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Stream;

/**
 * The site overlay of the shipped SiteOverlay over a stage folder filled from the real default static content and a site
 * folder in the documented layout, with the real SyncStaticContentHeadersFooters and the real test site template. The
 * stage and the site folders are temporary folders; nothing of the overlay is replaced.
 */
public class SiteOverlayTest {
    private static final Path MAIN = Path.of("src/main/org/epics/archiverappliance");
    private static final Path TEMPLATE = Path.of("src/sitespecific/tests/template_changes.html");
    private static final String COMMON_STATIC = "org/epics/archiverappliance/staticcontent";
    private static final String MGMT_STATIC = "org/epics/archiverappliance/mgmt/staticcontent";
    private static final String VERSION = "2099-1";
    @TempDir
    Path temp;

    private Path stage;
    private Path site;

    @BeforeEach
    public void setUp() throws IOException {
        stage = temp.resolve("stage");
        copyTree(MAIN.resolve("staticcontent"), stage.resolve(COMMON_STATIC));
        copyTree(MAIN.resolve("mgmt/staticcontent"), stage.resolve(MGMT_STATIC));
        site = temp.resolve("site");
        Files.createDirectories(site.resolve("classpathfiles"));
    }

    private static void copyTree(Path from, Path to) throws IOException {
        try (Stream<Path> paths = Files.walk(from)) {
            for (Path source : (Iterable<Path>) paths::iterator) {
                Path target = to.resolve(from.relativize(source).toString());
                if (Files.isDirectory(source)) {
                    Files.createDirectories(target);
                } else {
                    Files.createDirectories(target.getParent());
                    Files.copy(source, target);
                }
            }
        }
    }

    private static Map<String, String> digests(Path folder) throws IOException {
        Map<String, String> result = new TreeMap<>();
        try (Stream<Path> paths = Files.walk(folder)) {
            for (Path file : (Iterable<Path>) paths.filter(Files::isRegularFile)::iterator) {
                byte[] hash = MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(file));
                result.put(folder.relativize(file).toString(), HexFormat.of().formatHex(hash));
            }
        } catch (java.security.NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
        return result;
    }

    private void writeSite(String relative, String content) throws IOException {
        Path file = site.resolve(relative);
        Files.createDirectories(file.getParent());
        Files.writeString(file, content, StandardCharsets.UTF_8);
    }

    @Test
    public void siteFilesOverwriteTheStagedDefaults() throws Exception {
        Path mainCss = stage.resolve(COMMON_STATIC + "/css/main.css");
        Path mgmtCss = stage.resolve(MGMT_STATIC + "/css/mgmt.css");
        Path defaultImage = stage.resolve(COMMON_STATIC + "/img/archiverheader.svg");
        Assertions.assertTrue(Files.isRegularFile(mainCss) && Files.isRegularFile(mgmtCss), "the defaults are staged");
        Assertions.assertTrue(Files.isRegularFile(defaultImage), "the default image is staged");
        writeSite("css/main.css", "site main stylesheet\n");
        writeSite("css/mgmt.css", "site management stylesheet\n");
        writeSite("img/archiverheader.svg", "site header image\n");
        writeSite("img/sitelogo.svg", "site logo\n");
        writeSite("img/more/nested.svg", "nested image\n");

        SiteOverlay.apply(site, stage, VERSION);

        Assertions.assertEquals("site main stylesheet\n", Files.readString(mainCss));
        Assertions.assertEquals("site management stylesheet\n", Files.readString(mgmtCss));
        Assertions.assertEquals("site header image\n", Files.readString(defaultImage));
        Assertions.assertEquals("site logo\n", Files.readString(stage.resolve(COMMON_STATIC + "/img/sitelogo.svg")));
        Assertions.assertEquals(
                "nested image\n", Files.readString(stage.resolve(COMMON_STATIC + "/img/more/nested.svg")));
    }

    @Test
    public void theTemplateIsMergedIntoTheStagedManagementPages() throws Exception {
        Files.copy(TEMPLATE, site.resolve("template_changes.html"));
        Path expected = temp.resolve("expected");
        copyTree(MAIN.resolve("mgmt/staticcontent"), expected);
        SyncStaticContentHeadersFooters.main(new String[] {TEMPLATE.toString(), expected + "/"});
        Map<String, String> defaults = digests(MAIN.resolve("mgmt/staticcontent"));
        Assertions.assertNotEquals(defaults, digests(expected), "the template changes the default pages");

        SiteOverlay.apply(site, stage, VERSION);

        Assertions.assertEquals(digests(expected), digests(stage.resolve(MGMT_STATIC)));
        Assertions.assertTrue(
                Files.readString(stage.resolve(MGMT_STATIC + "/index.html")).contains("archiverheadertest.svg"));
    }

    @Test
    public void aSiteWithoutOptionalFilesChangesOnlyTheVersionFile() throws Exception {
        Map<String, String> before = digests(stage);

        SiteOverlay.apply(site, stage, VERSION);

        Map<String, String> after = digests(stage);
        Map<String, String> added = new TreeMap<>(after);
        before.keySet().forEach(added::remove);
        Assertions.assertEquals(
                java.util.Set.of(COMMON_STATIC + "/version.txt"), added.keySet(), "only the version file is new");
        after.remove(COMMON_STATIC + "/version.txt");
        Assertions.assertEquals(before, after, "no staged default changes");
    }

    @Test
    public void theVersionFileHasTheProjectVersionAndNoLineEnd() throws Exception {
        SiteOverlay.apply(site, stage, VERSION);

        Assertions.assertEquals(
                "Archiver Appliance Version " + VERSION,
                Files.readString(stage.resolve(COMMON_STATIC + "/version.txt")));
    }

    @Test
    public void filesTheOverlayDoesNotApplyAreReported() throws Exception {
        writeSite("css/main.css", "site main stylesheet\n");
        writeSite("css/extra.css", "not applied\n");
        writeSite("js/app.js", "not applied\n");
        writeSite("README.md", "documentation of the site\n");
        writeSite("img/logo.svg", "site logo\n");

        java.util.List<String> warnings = SiteOverlay.apply(site, stage, VERSION);

        Assertions.assertEquals(
                java.util.List.of(
                        "Not applied: " + site.resolve("css/extra.css")
                                + ", only css/main.css and css/mgmt.css are copied.",
                        "Not applied: the folder " + site.resolve("js")
                                + ", the site folders that are applied are img, css and classpathfiles."),
                warnings);
        Assertions.assertFalse(Files.exists(stage.resolve(COMMON_STATIC + "/css/extra.css")));
    }

    @Test
    public void aSiteWithOnlyAppliedFilesHasNoWarning() throws Exception {
        writeSite("css/main.css", "site main stylesheet\n");
        writeSite("img/logo.svg", "site logo\n");
        writeSite("template_changes.html", Files.readString(TEMPLATE));
        writeSite("README.md", "documentation of the site\n");

        Assertions.assertEquals(java.util.List.of(), SiteOverlay.apply(site, stage, VERSION));
    }

    @Test
    public void aMissingSiteFolderFailsWithAClearMessage() throws Exception {
        Path missing = temp.resolve("no-such-site");
        Map<String, String> before = digests(stage);

        IllegalStateException failure = Assertions.assertThrows(
                IllegalStateException.class, () -> SiteOverlay.apply(missing, stage, VERSION));

        Assertions.assertEquals(
                "The site folder " + missing + " does not exist. Name an existing folder of src/sitespecific"
                        + " with ARCHAPPL_SITEID.",
                failure.getMessage());
        Assertions.assertEquals(before, digests(stage), "the stage is untouched");
    }

    @Test
    public void aLeftoverSiteBuildFileFailsBeforeAnythingIsStaged() throws Exception {
        writeSite("build.xml", "<project/>\n");
        writeSite("css/main.css", "site main stylesheet\n");
        Map<String, String> before = digests(stage);

        IllegalStateException failure =
                Assertions.assertThrows(IllegalStateException.class, () -> SiteOverlay.apply(site, stage, VERSION));

        Assertions.assertEquals(
                "A site build.xml is no longer run. Remove " + site.resolve("build.xml")
                        + " and use img/, css/ and template_changes.html as described in the Building chapter.",
                failure.getMessage());
        Assertions.assertEquals(before, digests(stage), "the stage is untouched");
    }
}
