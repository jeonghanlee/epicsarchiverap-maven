package org.epics.archiverappliance.mgmt.bpl;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.LineNumberReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Small utility to sync the headers and footers from index.html to the other html files.
 * Typically called from the build script on demand.
 * This can also be used to do some simple site specific customization at startup time.
 * <pre><code>Usage: java SyncStaticContentHeadersFooters &lt;IndexFileName&gt; &lt;Locations of static html files&gt;</code></pre>
 * @author mshankar
 *
 */
public class SyncStaticContentHeadersFooters {
    private static final Pattern COMMON_PREFIX = Pattern.compile("data-common-prefix=[\"']((?:\\.\\./)*)[\"']");
    private static final Pattern ASSET_ATTRIBUTE = Pattern.compile(
            "(\\b(?:src|href|srcset)\\s*=\\s*)([\"'])(.*?)\\2", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    /** Adapts shared asset references in a template block to the destination page's directory depth. */
    private static String rebaseAssets(String chunk, String prefix) {
        if (prefix.isEmpty()) return chunk;
        Matcher matcher = ASSET_ATTRIBUTE.matcher(chunk);
        StringBuilder output = new StringBuilder();
        while (matcher.find()) {
            String value = matcher.group(3);
            if (matcher.group(1).trim().toLowerCase(java.util.Locale.ROOT).startsWith("srcset")) {
                value = rebaseSrcset(value, prefix);
            } else {
                value = value.replaceFirst("^(\\s*)comm/", "$1" + Matcher.quoteReplacement(prefix + "comm/"));
            }
            matcher.appendReplacement(output, Matcher.quoteReplacement(
                    matcher.group(1) + matcher.group(2) + value + matcher.group(2)));
        }
        matcher.appendTail(output);
        return output.toString();
    }

    /** Walks candidate URLs separately from descriptors; commas inside a URL remain part of that URL. */
    private static String rebaseSrcset(String value, String prefix) {
        StringBuilder output = new StringBuilder();
        int cursor = 0;
        while (cursor < value.length()) {
            int start = cursor;
            while (cursor < value.length() && (Character.isWhitespace(value.charAt(cursor)) || value.charAt(cursor) == ',')) cursor++;
            output.append(value, start, cursor);
            start = cursor;
            while (cursor < value.length() && !Character.isWhitespace(value.charAt(cursor))) cursor++;
            String url = value.substring(start, cursor);
            if (url.startsWith("comm/")) output.append(prefix);
            output.append(url);
            if (url.endsWith(",")) continue;
            start = cursor;
            int parentheses = 0;
            while (cursor < value.length()) {
                char character = value.charAt(cursor++);
                if (character == '(') parentheses++;
                else if (character == ')' && parentheses > 0) parentheses--;
                else if (character == ',' && parentheses == 0) break;
            }
            output.append(value, start, cursor);
        }
        return output.toString();
    }

    public static void main(String[] args) throws IOException {
        if (args.length < 2) {
            System.err.println(
                    "Usage: java SyncStaticContentHeadersFooters <IndexFileName> <Locations of other html files>");
            return;
        }
        String srcFileName = args[0];
        final File srcFile = new File(srcFileName);
        LinkedList<File> filesToModify = getFilesToModify(args, srcFile);

        LinkedList<TextChunk> srcTextChunks = breakFileIntoChunks(srcFile);
        HashMap<String, String> mainSrcFileTextChunks = new HashMap<String, String>();
        for (TextChunk textChunk : srcTextChunks) {
            if (!textChunk.typeOfChunk.equals(REGULAR_TEXT)) {
                mainSrcFileTextChunks.put(textChunk.typeOfChunk, textChunk.textChunk);
            }
        }

        for (File fileToModify : filesToModify) {
            Matcher prefixMarker = COMMON_PREFIX.matcher(Files.readString(fileToModify.toPath()));
            String prefix = prefixMarker.find() ? prefixMarker.group(1) : "";
            System.out.println("Changing headers and footers for " + fileToModify.getAbsolutePath());
            File outputFile = new File(fileToModify.getAbsolutePath().concat("_generated"));
            try (PrintWriter out = new PrintWriter(new FileOutputStream(outputFile))) {
                LinkedList<TextChunk> destTextChunks = breakFileIntoChunks(fileToModify);
                for (TextChunk destTextChunk : destTextChunks) {
                    if (destTextChunk.typeOfChunk.equals(REGULAR_TEXT)) {
                        out.print(destTextChunk.textChunk);
                    } else {
                        String srcChunk = mainSrcFileTextChunks.get(destTextChunk.typeOfChunk);
                        if (srcChunk == null) {
                            out.print(destTextChunk.textChunk);
                        } else {
                            out.print(rebaseAssets(srcChunk, prefix));
                        }
                    }
                }
            }
            if (outputFile.exists() && outputFile.length() > 0) {
                Files.move(outputFile.toPath(), fileToModify.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }
        }
    }

    private static LinkedList<File> getFilesToModify(String[] args, File srcFile) {
        String[] fileLocations = Arrays.copyOfRange(args, 1, args.length);
        LinkedList<File> filesToModify = new LinkedList<File>();

        for (String fileLocation : fileLocations) {
            File fileLocationFile = new File(fileLocation);
            if (fileLocationFile.isDirectory()) {
                File[] htmlFiles = fileLocationFile.listFiles(
                        pathname -> pathname.getName().endsWith(".html") && !pathname.equals(srcFile));
                filesToModify.addAll(Arrays.asList(htmlFiles));
            } else {
                filesToModify.add(fileLocationFile);
            }
        }
        return filesToModify;
    }

    public record TextChunk(String typeOfChunk, String textChunk) {}

    private static final String REGULAR_TEXT = "RegularText";
    /**
     * Break down a file into a list of text chunks each of which is identified by the text string in the @begin(...) if any...
     * Regular text chunks come as REGULAR_TEXT chunks
     * @param file File
     * @return LinkedList TextChunk
     * @throws IOException  &emsp;
     */
    public static LinkedList<TextChunk> breakFileIntoChunks(File file) throws IOException {
        String startOfChunkIndicator = "<!-- @begin(";
        String endOfChunkIndicator = "<!-- @end(";
        FileInputStream fis = new FileInputStream(file);
        return breakFileIntoChunks(fis, startOfChunkIndicator, endOfChunkIndicator);
    }

    /**
     * Break down a file into a list of text chunks each of which is identified by the text string in the @begin(...) if any...
     * Regular text chunks come as REGULAR_TEXT chunks
     * This method closes the inputstream is after it is done.
     * @param is InputStream
     * @param startOfChunkIndicator  &emsp;
     * @param endOfChunkIndicator   &emsp;
     * @return LinkedList TextChunk
     * @throws IOException &emsp;
     */
    public static LinkedList<TextChunk> breakFileIntoChunks(
            InputStream is, String startOfChunkIndicator, String endOfChunkIndicator) throws IOException {
        LinkedList<TextChunk> textChunks = new LinkedList<TextChunk>();
        String currentChunkType = REGULAR_TEXT;
        StringBuilder currentTextChunk = new StringBuilder();
        try (LineNumberReader lineReader = new LineNumberReader(new InputStreamReader(is))) {
            String line = lineReader.readLine();
            while (line != null) {
                if (line.contains(startOfChunkIndicator)) {
                    if (!currentTextChunk.isEmpty()) {
                        textChunks.add(new TextChunk(currentChunkType, currentTextChunk.toString()));
                        currentTextChunk = new StringBuilder();
                    }

                    currentTextChunk.append(line);
                    currentTextChunk.append("\n");
                    int startOfChunkType = line.indexOf(startOfChunkIndicator) + startOfChunkIndicator.length();
                    int endOfChunkType = line.indexOf(')', startOfChunkType);
                    currentChunkType = line.substring(startOfChunkType, endOfChunkType);
                } else {
                    if (line.contains(endOfChunkIndicator)) {
                        currentTextChunk.append(line);
                        currentTextChunk.append("\n");
                        textChunks.add(new TextChunk(currentChunkType, currentTextChunk.toString()));
                        currentTextChunk = new StringBuilder();
                        currentChunkType = REGULAR_TEXT;
                    } else {
                        currentTextChunk.append(line);
                        currentTextChunk.append("\n");
                    }
                }
                line = lineReader.readLine();
            }
        }
        textChunks.add(new TextChunk(currentChunkType, currentTextChunk.toString()));

        return textChunks;
    }

    /**
     * Breaks the HTML inputstream is into chunks and replaces the templates with the content in templateReplacements.
     * The inputstream is is closed after this operation.
     * @param is InputStream
     * @param templateReplacements HashMap
     * @return ByteArrayInputStream  &emsp;
     * @throws IOException &emsp;
     */
    public static ByteArrayInputStream templateReplaceChunksHTML(
            InputStream is, HashMap<String, String> templateReplacements) throws IOException {
        String startOfChunkIndicator = "<!-- @begin(";
        String endOfChunkIndicator = "<!-- @end(";
        String closingText = ") -->";
        return templateReplaceChunks(is, templateReplacements, startOfChunkIndicator, endOfChunkIndicator, closingText);
    }

    /**
     * Breaks the Javascript inputstream is into chunks and replaces the templates with the content in templateReplacements.
     * The inputstream is is closed after this operation.
     * @param is InputStream
     * @param templateReplacements  HashMap
     * @return ByteArrayInputStream  &emsp;
     * @throws IOException  &emsp;
     */
    public static ByteArrayInputStream templateReplaceChunksJavascript(
            InputStream is, HashMap<String, String> templateReplacements) throws IOException {
        String startOfChunkIndicator = "// @begin(";
        String endOfChunkIndicator = "// @end(";
        String closingText = ")";
        return templateReplaceChunks(is, templateReplacements, startOfChunkIndicator, endOfChunkIndicator, closingText);
    }

    private static ByteArrayInputStream templateReplaceChunks(
            InputStream is,
            HashMap<String, String> templateReplacements,
            String startOfChunkIndicator,
            String endOfChunkIndicator,
            String closingText)
            throws IOException {
        LinkedList<TextChunk> destTextChunks =
                SyncStaticContentHeadersFooters.breakFileIntoChunks(is, startOfChunkIndicator, endOfChunkIndicator);
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        try (PrintWriter out = new PrintWriter(new OutputStreamWriter(bos))) {
            for (TextChunk destTextChunk : destTextChunks) {
                if (destTextChunk.typeOfChunk.equals(REGULAR_TEXT)) {
                    out.print(destTextChunk.textChunk);
                } else {
                    String srcChunk = templateReplacements.get(destTextChunk.typeOfChunk);
                    if (srcChunk == null) {
                        out.print(destTextChunk.textChunk);
                    } else {
                        out.println(startOfChunkIndicator + destTextChunk.typeOfChunk + closingText);
                        out.println(srcChunk);
                        out.println(endOfChunkIndicator + destTextChunk.typeOfChunk + closingText);
                    }
                }
            }
        }
        return new ByteArrayInputStream(bos.toByteArray());
    }
}
