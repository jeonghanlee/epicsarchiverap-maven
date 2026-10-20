package org.epics.archiverappliance.retrieval.postprocessor;

import org.epics.archiverappliance.retrieval.postprocessors.DefaultRawPostProcessor;
import org.epics.archiverappliance.retrieval.postprocessors.ExtraFieldsPostProcessor;
import org.epics.archiverappliance.retrieval.postprocessors.Mean;
import org.epics.archiverappliance.retrieval.postprocessors.PostProcessor;
import org.epics.archiverappliance.retrieval.postprocessors.PostProcessors;
import org.epics.archiverappliance.retrieval.postprocessors.TwoWeekRaw;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

/**
 * Checks the validation of the retrieval operator string against the real registry of post processors.
 * The operators that take one integer of at least 1 are checked together; the others have their own cases.
 */
public class PostProcessorsValidationTest {

    private static final String BAD_ARGUMENT = "bad argument";
    private static final String NOT_KNOWN = "is not known";

    /**
     * The registered operators whose argument is one integer of at least 1.
     */
    private static final List<String> INTEGER_OPERATORS = List.of(
            "firstSample",
            "lastSample",
            "firstFill",
            "lastFill",
            "mean",
            "meanSample",
            "median",
            "std",
            "variance",
            "popvariance",
            "rms",
            "jitter",
            "kurtosis",
            "skewness",
            "max",
            "min",
            "count",
            "errorbar",
            "linear",
            "loess",
            "stats",
            "caplotbinning",
            "nth",
            "optimized",
            "optimizedSample",
            "optimLastSample",
            "optimLastSampleSample");

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "   "})
    public void blankMeansRaw(String operator) {
        Assertions.assertNull(PostProcessors.checkPostProcessorUserArg(operator));
    }

    @ParameterizedTest
    @ValueSource(strings = {"pb", "twoweek", "extraFields"})
    public void rawAndInternalNamesAreAccepted(String operator) {
        Assertions.assertNull(PostProcessors.checkPostProcessorUserArg(operator));
    }

    @Test
    public void namesSentToOtherAppliancesAreAccepted() {
        Assertions.assertNull(PostProcessors.checkPostProcessorUserArg(new DefaultRawPostProcessor().getExtension()));
        Assertions.assertNull(PostProcessors.checkPostProcessorUserArg(new TwoWeekRaw().getExtension()));
        Assertions.assertNull(
                PostProcessors.checkPostProcessorUserArg(new ExtraFieldsPostProcessor("HIHI").getExtension()));
    }

    /**
     * An appliance sends getExtension() of the post processor of a request to the appliance of a PV;
     * the string has to pass the check there.
     */
    @ParameterizedTest
    @ValueSource(
            strings = {
                "mean",
                "mean_60",
                "firstSample",
                "firstSample_10",
                "lastSample_5",
                "firstFill_5",
                "lastFill_5",
                "flyers",
                "flyers_60_3.5",
                "ignoreflyers",
                "ignoreflyers_30_2.5",
                "nth",
                "nth_10",
                "ncount",
                "optimized_100",
                "optimLastSample_100",
                "caplotbinning_30",
                "deadBand",
                "deadBand_2.5"
            })
    public void extensionOfAShippedPostProcessorIsAccepted(String operator) throws Exception {
        PostProcessor postProcessor = PostProcessors.findPostProcessor(operator);
        Assertions.assertNotNull(postProcessor, operator);
        postProcessor.initialize(operator, "PV:validation");
        String extension = postProcessor.getExtension();
        Assertions.assertNull(PostProcessors.checkPostProcessorUserArg(extension), extension);
    }

    @Test
    public void everyIntegerOperatorAcceptsNoArgumentAndAnIntegerOfAtLeastOne() {
        for (String name : INTEGER_OPERATORS) {
            Assertions.assertNull(PostProcessors.checkPostProcessorUserArg(name), name);
            Assertions.assertNull(PostProcessors.checkPostProcessorUserArg(name + "_1"), name + "_1");
            Assertions.assertNull(PostProcessors.checkPostProcessorUserArg(name + "_60"), name + "_60");
        }
    }

    @Test
    public void everyIntegerOperatorRejectsABadArgument() {
        for (String name : INTEGER_OPERATORS) {
            for (String argument : List.of("", "_5", "0", "-1", "abc", "60.5", "NaN", "Infinity", "60_7", "99999999999")) {
                assertBadArgument(name + "_" + argument);
            }
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"mean_", "mean__5", "mean_60.5", "mean_NaN", "mean_Infinity", "mean_abc", "mean_0", "nth_-1"})
    public void badArgumentNamesTheOperatorAndTheReason(String operator) {
        String message = PostProcessors.checkPostProcessorUserArg(operator);
        Assertions.assertNotNull(message, operator);
        Assertions.assertTrue(message.contains("\"" + operator + "\""), message);
        Assertions.assertTrue(message.contains(BAD_ARGUMENT), message);
        Assertions.assertTrue(message.contains("integer of at least 1"), message);
    }

    @ParameterizedTest
    @ValueSource(strings = {"bogus", "meanx", "meanx_60", "Mean_60", "mea", "pb_5", "twoweek_5", "extraFields_1", "_60", "_"})
    public void unknownOperatorNamesTheOperator(String operator) {
        String message = PostProcessors.checkPostProcessorUserArg(operator);
        Assertions.assertNotNull(message, operator);
        Assertions.assertTrue(message.contains("\"" + operator + "\""), message);
        Assertions.assertTrue(message.contains(NOT_KNOWN), message);
    }

    @Test
    public void nameIsTheTextBeforeTheFirstUnderscore() {
        Assertions.assertNull(PostProcessors.checkPostProcessorUserArg("mean_60"));
        Assertions.assertNull(PostProcessors.checkPostProcessorUserArg("flyers_60_3.5"));
        assertNotKnown("flyers60_3.5");
    }

    @ParameterizedTest
    @ValueSource(strings = {"flyers", "flyers_1", "flyers_60", "flyers_60_3", "flyers_60_0.5", "flyers_60_1.0E-5", "flyers_60_3.0"})
    public void flyersAcceptsAnIntegerAndAFiniteNumberAboveZero(String operator) {
        Assertions.assertNull(PostProcessors.checkPostProcessorUserArg(operator), operator);
        Assertions.assertNull(
                PostProcessors.checkPostProcessorUserArg(operator.replace("flyers", "ignoreflyers")), operator);
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "flyers_",
                "flyers__3",
                "flyers_0",
                "flyers_-1",
                "flyers_abc",
                "flyers_60.5",
                "flyers_60_",
                "flyers_60_0",
                "flyers_60_-1",
                "flyers_60_NaN",
                "flyers_60_Infinity",
                "flyers_60_abc",
                "flyers_60_1e50",
                "flyers_60_3_4"
            })
    public void flyersRejectsABadArgument(String operator) {
        assertBadArgument(operator);
        assertBadArgument(operator.replace("flyers", "ignoreflyers"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"deadBand", "deadBand_0", "deadBand_0.0", "deadBand_2", "deadBand_0.5", "deadBand_1e3"})
    public void deadBandAcceptsAFiniteNumberOfAtLeastZero(String operator) {
        Assertions.assertNull(PostProcessors.checkPostProcessorUserArg(operator), operator);
    }

    @ParameterizedTest
    @ValueSource(
            strings = {"deadBand_", "deadBand_-1", "deadBand_-0.5", "deadBand_NaN", "deadBand_Infinity", "deadBand_abc", "deadBand_1_2"})
    public void deadBandRejectsABadArgument(String operator) {
        assertBadArgument(operator);
    }

    @Test
    public void ncountTakesNoArgument() {
        Assertions.assertNull(PostProcessors.checkPostProcessorUserArg("ncount"));
        assertBadArgument("ncount_");
        assertBadArgument("ncount_5");
    }

    /**
     * The store lookup keeps matching on the start of the string; only the request check is strict.
     */
    @Test
    public void storeLookupKeepsMatchingTheStartOfTheString() {
        Assertions.assertInstanceOf(Mean.class, PostProcessors.findPostProcessor("meanx"));
        Assertions.assertNotNull(PostProcessors.checkPostProcessorUserArg("meanx"));
        Assertions.assertNull(PostProcessors.findPostProcessor("twoweek"));
        Assertions.assertNull(PostProcessors.findPostProcessor("extraFields"));
    }

    private static void assertBadArgument(String operator) {
        String message = PostProcessors.checkPostProcessorUserArg(operator);
        Assertions.assertNotNull(message, operator);
        Assertions.assertTrue(message.contains("\"" + operator + "\""), message);
        Assertions.assertTrue(message.contains(BAD_ARGUMENT), message);
    }

    private static void assertNotKnown(String operator) {
        String message = PostProcessors.checkPostProcessorUserArg(operator);
        Assertions.assertNotNull(message, operator);
        Assertions.assertTrue(message.contains(NOT_KNOWN), message);
    }
}
