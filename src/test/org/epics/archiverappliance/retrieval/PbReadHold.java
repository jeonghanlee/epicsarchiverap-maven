package org.epics.archiverappliance.retrieval;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/** Controls real Linux file reads without replacing the PB parser or retrieval pipeline. */
public final class PbReadHold implements AutoCloseable {
    private final Path directory;
    private final Path library;
    private final Path target;

    public PbReadHold(Path evidence, Path target) throws Exception {
        this.target = target.toRealPath();
        directory = Files.createDirectory(evidence.resolve("pb-read-hold"));
        library = directory.resolve("pb-read-hold.so");
        var build = new ProcessBuilder("gcc", "-shared", "-fPIC", "-O2", "-Wall", "-Wextra", "-Werror",
                "-o", library.toString(),
                "src/test/org/epics/archiverappliance/retrieval/pb-read-hold.c", "-ldl")
                .redirectErrorStream(true).redirectOutput(directory.resolve("build.log").toFile()).start();
        if (!build.waitFor(30, TimeUnit.SECONDS)) {
            build.destroyForcibly().waitFor();
            throw new IOException("PB read control compilation timed out");
        }
        if (build.exitValue() != 0) throw new IOException("PB read control compilation failed: " + directory);
    }

    public Map<String, String> environment() {
        return Map.of("LD_PRELOAD", library.toString(), "ARCHAPPL_TEST_READ_CONTROL", directory.toString(),
                "ARCHAPPL_TEST_READ_TARGET", target.toString());
    }

    /** Header and data are retained byte-for-byte; only the next sequential read is delayed. */
    public void holdAfterRecords(int records) throws IOException {
        long offset = 0;
        int lines = 0;
        try (var input = new BufferedInputStream(Files.newInputStream(target))) {
            while (lines < records + 1) {
                int value = input.read();
                if (value < 0) throw new IOException("PB input ends before the selected hold position");
                offset++;
                if (value == '\n') lines++;
            }
        }
        var next = directory.resolve("limit.next");
        Files.writeString(next, Long.toString(offset));
        Files.move(next, directory.resolve("limit"), StandardCopyOption.ATOMIC_MOVE,
                StandardCopyOption.REPLACE_EXISTING);
        Files.writeString(directory.resolve("selected-" + records + ".txt"), "records=" + records + "\noffset=" + offset + "\n");
    }

    /** Removes the hold position; held readers resume within one poll interval and a later hold sets a new one. */
    public void release() throws IOException {
        Files.deleteIfExists(directory.resolve("limit"));
    }

    public int heldReaders() throws IOException {
        long limit = Long.parseLong(Files.readString(directory.resolve("limit")));
        try (var entries = Files.list(directory)) {
            int count = 0;
            for (var path : entries.filter(path -> path.getFileName().toString().startsWith("held.")).toList()) {
                try {
                    String value = Files.readString(path).trim();
                    if (!value.isEmpty() && Long.parseLong(value) >= limit) count++;
                } catch (java.nio.file.NoSuchFileException ignored) {
                    // A resumed reader removes its marker before returning real file bytes.
                }
            }
            return count;
        }
    }

    public void assertHealthy() throws IOException {
        var events = directory.resolve("events.log");
        if (!Files.exists(events) || Files.readString(events).contains("EXPIRED")) {
            throw new IOException("PB read control did not load or exceeded its bounded hold: " + events);
        }
    }

    public void awaitReleased(Duration timeout) throws Exception {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (hasMarkers() && System.nanoTime() < deadline) Thread.sleep(10);
        if (hasMarkers()) throw new IOException("PB readers did not resume");
    }

    private boolean hasMarkers() throws IOException {
        try (var entries = Files.list(directory)) {
            return entries.anyMatch(path -> path.getFileName().toString().startsWith("held."));
        }
    }

    @Override public void close() throws IOException {
        Files.deleteIfExists(directory.resolve("limit"));
    }
}
