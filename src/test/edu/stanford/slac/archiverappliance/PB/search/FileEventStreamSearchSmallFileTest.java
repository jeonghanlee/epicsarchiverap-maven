package edu.stanford.slac.archiverappliance.PB.search;

import edu.stanford.slac.archiverappliance.PB.utils.LineByteStream;
import edu.stanford.slac.archiverappliance.PB.utils.LineEscaper;

import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Search files of one to three sample lines, as in the first hours of a freshly started store, with and without a header line.
 * A search for a number earlier than every line ends with not found, and a search for a number inside the range of the file
 * positions at the newest line at or before it.
 */
public class FileEventStreamSearchSmallFileTest {
    private static final int FIRST = 100;
    private static final int STEP = 100;
    private static final String HEADER = "HEADER";
    private final String pathName = ConfigServiceForTests.getDefaultPBTestFolder() + "/" + "FileEventStreamSearchSmallFileTest.txt";
    private final Path path = Paths.get(pathName);

    @BeforeEach
    public void setUp() throws Exception {
        Files.deleteIfExists(path);
    }

    @AfterEach
    public void tearDown() throws Exception {
        Files.deleteIfExists(path);
    }

    private void writeFile(boolean withHeader, int numLines) throws Exception {
        try (PrintStream fos = new PrintStream(new BufferedOutputStream(new FileOutputStream(new File(pathName), false)))) {
            if (withHeader) {
                fos.print(HEADER + LineEscaper.NEWLINE_CHAR_STR);
            }
            for (int i = 0; i < numLines; i++) {
                fos.print((FIRST + STEP * i) + LineEscaper.NEWLINE_CHAR_STR);
            }
        }
    }

    private static CompareEventLine compareFor(int searchNum) {
        return (line1, line2) -> {
            int inputNum1 = Integer.parseInt(new String(line1));
            int inputNum2 = line2 != null ? Integer.parseInt(new String(line2)) : Integer.MAX_VALUE;
            if (inputNum1 > searchNum) {
                return CompareEventLine.NextStep.GO_LEFT;
            } else if (inputNum2 <= searchNum) {
                return CompareEventLine.NextStep.GO_RIGHT;
            } else {
                return CompareEventLine.NextStep.STAY_WHERE_YOU_ARE;
            }
        };
    }

    @Test
    public void testSeekToTimeInSmallFiles() throws Exception {
        for (boolean withHeader : new boolean[] {false, true}) {
            for (int numLines = 1; numLines <= 3; numLines++) {
                writeFile(withHeader, numLines);
                long startPosition = withHeader ? HEADER.length() + 1 : 0;
                int lastLine = FIRST + STEP * (numLines - 1);
                for (int searchNum = FIRST - 50; searchNum <= lastLine + 50; searchNum += 25) {
                    String what = "searching for " + searchNum + " in a file with " + numLines + " lines"
                            + (withHeader ? " and a header" : "");
                    FileEventStreamSearch search = new FileEventStreamSearch(path, startPosition);
                    boolean found = search.seekToTime(compareFor(searchNum));
                    if (searchNum < FIRST) {
                        Assertions.assertFalse(found, "Found a line when " + what);
                    } else if (searchNum < lastLine) {
                        Assertions.assertTrue(found, "No line found when " + what);
                    }
                    if (found) {
                        try (LineByteStream lis = new LineByteStream(path, search.getFoundPosition())) {
                            lis.seekToFirstNewLine();
                            int line1 = Integer.parseInt(new String(lis.readLine()));
                            byte[] bytes2 = lis.readLine();
                            Assertions.assertTrue(line1 <= searchNum, "The line " + line1 + " is later than the number when " + what);
                            if (bytes2 != null) {
                                Assertions.assertTrue(
                                        searchNum < Integer.parseInt(new String(bytes2)),
                                        "The line after " + line1 + " is not later than the number when " + what);
                            }
                        }
                    }
                }
            }
        }
    }
}
