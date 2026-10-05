package org.epics.archiverappliance.common;

import org.epics.archiverappliance.mgmt.bpl.SyncStaticContentHeadersFooters;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Applies a site folder to the staged static content of the build, in this order:
 * <ol>
 * <li>writes the version file with the project version;</li>
 * <li>when the site folder has <code>template_changes.html</code>, merges it into the staged management pages with
 * {@link SyncStaticContentHeadersFooters};</li>
 * <li>copies <code>img/</code> (with its subfolders) over the staged <code>staticcontent/img</code>, <code>css/main.css</code>
 * over the staged <code>staticcontent/css/main.css</code> and <code>css/mgmt.css</code> over the staged
 * <code>mgmt/staticcontent/css/mgmt.css</code>, replacing the staged defaults.</li>
 * </ol>
 * Each file of the site folder is optional, and the <code>classpathfiles</code> folder is packaged by the WAR build, not
 * here. A site folder that does not exist, or that still holds a <code>build.xml</code>, stops the build before anything
 * is staged. Files of the site folder that the overlay does not apply, which are other files under <code>css/</code> and
 * folders other than <code>img</code>, <code>css</code> and <code>classpathfiles</code>, are reported as warnings.
 *
 * <pre><code>Usage: java SiteOverlay &lt;site folder&gt; &lt;stage folder&gt; &lt;project version&gt;</code></pre>
 */
public final class SiteOverlay {
    private static final String COMMON_STATIC = "org/epics/archiverappliance/staticcontent";
    private static final String MGMT_STATIC = "org/epics/archiverappliance/mgmt/staticcontent";
    private static final String LEFTOVER_BUILD_FILE = "build.xml";
    private static final String VERSION_FILE = "version.txt";
    private static final String VERSION_PREFIX = "Archiver Appliance Version ";
    private static final String TEMPLATE_FILE = "template_changes.html";
    private static final Set<String> APPLIED_STYLESHEETS = Set.of("main.css", "mgmt.css");
    private static final Set<String> APPLIED_FOLDERS = Set.of("img", "css", "classpathfiles");

    private SiteOverlay() {}

    public static void main(String[] args) throws IOException {
        if (args.length != 3) {
            throw new IllegalArgumentException("Usage: java SiteOverlay <site folder> <stage folder> <project version>");
        }
        for (String warning : apply(Path.of(args[0]), Path.of(args[1]), args[2])) {
            System.out.println("WARNING: " + warning);
        }
    }

    /**
     * Applies the site folder to the stage folder.
     *
     * @param site    the site folder
     * @param stage   the stage folder that already holds the default static content
     * @param version the project version written to the version file
     * @return the warnings about files of the site folder that the overlay does not apply
     * @throws IOException           when a file cannot be read, written or merged
     * @throws IllegalStateException when the site folder does not exist or still holds a build.xml
     */
    public static List<String> apply(Path site, Path stage, String version) throws IOException {
        if (!Files.isDirectory(site)) {
            throw new IllegalStateException("The site folder " + site
                    + " does not exist. Name an existing folder of src/sitespecific with ARCHAPPL_SITEID.");
        }
        Path leftover = site.resolve(LEFTOVER_BUILD_FILE);
        if (Files.exists(leftover)) {
            throw new IllegalStateException("A site build.xml is no longer run. Remove " + leftover
                    + " and use img/, css/ and template_changes.html as described in the Building chapter.");
        }

        Path commonStage = stage.resolve(COMMON_STATIC);
        Path mgmtStage = stage.resolve(MGMT_STATIC);
        Files.createDirectories(commonStage);
        Files.writeString(commonStage.resolve(VERSION_FILE), VERSION_PREFIX + version, StandardCharsets.UTF_8);

        Path template = site.resolve(TEMPLATE_FILE);
        if (Files.isRegularFile(template)) {
            SyncStaticContentHeadersFooters.main(new String[] {template.toString(), mgmtStage + "/"});
        }

        copyTree(site.resolve("img"), commonStage.resolve("img"));
        copyFile(site.resolve("css/main.css"), commonStage.resolve("css/main.css"));
        copyFile(site.resolve("css/mgmt.css"), mgmtStage.resolve("css/mgmt.css"));
        return notApplied(site);
    }

    private static List<String> notApplied(Path site) throws IOException {
        List<String> warnings = new ArrayList<>();
        Path css = site.resolve("css");
        if (Files.isDirectory(css)) {
            try (Stream<Path> paths = Files.walk(css)) {
                paths.filter(Files::isRegularFile)
                        .filter(path -> !path.getParent().equals(css)
                                || !APPLIED_STYLESHEETS.contains(path.getFileName().toString()))
                        .sorted()
                        .forEach(path -> warnings.add("Not applied: " + path
                                + ", only css/main.css and css/mgmt.css are copied."));
            }
        }
        try (Stream<Path> paths = Files.list(site)) {
            paths.filter(Files::isDirectory)
                    .filter(path -> !APPLIED_FOLDERS.contains(path.getFileName().toString()))
                    .sorted()
                    .forEach(path -> warnings.add("Not applied: the folder " + path
                            + ", the site folders that are applied are img, css and classpathfiles."));
        }
        return warnings;
    }

    private static void copyFile(Path source, Path target) throws IOException {
        if (!Files.isRegularFile(source)) {
            return;
        }
        Files.createDirectories(target.getParent());
        Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
    }

    private static void copyTree(Path source, Path target) throws IOException {
        if (!Files.isDirectory(source)) {
            return;
        }
        try (Stream<Path> paths = Files.walk(source)) {
            for (Path path : (Iterable<Path>) paths.filter(Files::isRegularFile)::iterator) {
                copyFile(path, target.resolve(source.relativize(path).toString()));
            }
        }
    }
}
