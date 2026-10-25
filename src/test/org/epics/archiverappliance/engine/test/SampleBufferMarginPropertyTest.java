package org.epics.archiverappliance.engine.test;

import org.epics.archiverappliance.engine.pv.EngineContext;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.Properties;

/**
 * The sample buffer margin comes from one installation property. A finite value of at least the minimum
 * is used as given, a finite value below the minimum is raised to it, and any other text falls back to
 * the default, so a bad entry can neither stop the engine nor hand a buffer a margin smaller than the one
 * the engine guarantees.
 */
public class SampleBufferMarginPropertyTest {

    private static Properties with(String value) {
        Properties properties = new Properties();
        properties.setProperty(EngineContext.SAMPLE_BUFFER_MARGIN_SECONDS_PROPERTY, value);
        return properties;
    }

    @Test
    public void valueAtOrAboveTheMinimumIsUsed() {
        Assertions.assertEquals(2.5, EngineContext.sampleBufferMarginSecondsFrom(with("2.5")));
        Assertions.assertEquals(1.5, EngineContext.sampleBufferMarginSecondsFrom(with(" 1.5 ")));
        Assertions.assertEquals(1.0, EngineContext.sampleBufferMarginSecondsFrom(with("1")));
    }

    @Test
    public void valueBelowTheMinimumIsRaisedToIt() {
        for (String low : new String[] {"0", "0.5", "0.999", "-1"}) {
            Assertions.assertEquals(EngineContext.MIN_SAMPLE_BUFFER_MARGIN_SECONDS,
                    EngineContext.sampleBufferMarginSecondsFrom(with(low)), "value: " + low);
        }
    }

    @Test
    public void nonFiniteOrUnparsableValueFallsBackToTheDefault() {
        for (String bad : new String[] {"NaN", "Infinity", "-Infinity", "abc", ""}) {
            Assertions.assertEquals(EngineContext.DEFAULT_SAMPLE_BUFFER_MARGIN_SECONDS,
                    EngineContext.sampleBufferMarginSecondsFrom(with(bad)), "value: " + bad);
        }
    }
}
