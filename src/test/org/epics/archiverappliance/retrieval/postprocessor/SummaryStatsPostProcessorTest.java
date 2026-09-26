package org.epics.archiverappliance.retrieval.postprocessor;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.common.PartitionGranularity;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.common.YearSecondTimestamp;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.data.ScalarValue;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.retrieval.CallableEventStream;
import org.epics.archiverappliance.retrieval.RemotableEventStreamDesc;
import org.epics.archiverappliance.retrieval.postprocessors.Mean;
import org.epics.archiverappliance.retrieval.postprocessors.PostProcessor;
import org.epics.archiverappliance.retrieval.postprocessors.PostProcessorWithConsolidatedEventStream;
import org.epics.archiverappliance.retrieval.postprocessors.PostProcessors;
import org.epics.archiverappliance.utils.simulation.SimulationEvent;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.time.Instant;

/**
 * The SummaryStatsPostProcessor provides the framework code for computing average, sigma etc on the server side.
 * This tests the framework itself; specifically, it tests that binning works as expected and fills all the bins.
 * The ArchiveViewer relies on this behavior to implement formulae.
 * @author mshankar
 *
 */
public class SummaryStatsPostProcessorTest {
	private static Logger logger = LogManager.getLogger(SummaryStatsPostProcessorTest.class.getName());
	private String pvName = "Test_SummaryStats1";


	/**
	 * Generate data from Jun 1 for a couple of months; one every two days.
	 * Ask for summary with a bin of one day and different periods and see that we get appropriate results.
	 * @throws Exception
	 */
	@Test
	public void testBeforeAndAfter() throws Exception {
		short currentYear = TimeUtils.getCurrentYear();
		int totalDays = 60;
		YearSecondTimestamp startOfSamples = TimeUtils.convertToYearSecondTimestamp(TimeUtils.convertFromISO8601String(currentYear + "-06-01T10:00:00.000Z"));
		for(int sampleIntervalInHours = 3; sampleIntervalInHours < 24*4; sampleIntervalInHours+=3) {
			int totSamples = totalDays*24/sampleIntervalInHours;
			logger.info("Creating " + totSamples + " samples " + sampleIntervalInHours + " hours apart");
			ArrayListEventStream testData = new ArrayListEventStream(0, new RemotableEventStreamDesc(ArchDBRTypes.DBR_SCALAR_DOUBLE, pvName, currentYear));
			for(int s = 0; s < totSamples; s++) {
				testData.add(new SimulationEvent(startOfSamples.getSecondsintoyear() + s * sampleIntervalInHours * PartitionGranularity.PARTITION_HOUR.getApproxSecondsPerChunk(), currentYear, ArchDBRTypes.DBR_SCALAR_DOUBLE, new ScalarValue<Double>((double) s)));
			}

			{ 
				Mean meanProcessor = new Mean();
				meanProcessor.initialize("mean_" + PartitionGranularity.PARTITION_DAY.getApproxSecondsPerChunk(), pvName);
				Instant start = TimeUtils.convertFromISO8601String(currentYear + "-06-03T10:00:00.000Z");
				Instant end = TimeUtils.convertFromISO8601String(currentYear + "-06-23T10:00:00.000Z");
				meanProcessor.estimateMemoryConsumption(pvName, new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1), start, end, null);
				meanProcessor.wrap(CallableEventStream.makeOneStreamCallable(testData, null, false)).call();

				int eventCount = 0;
				Instant previousTimeStamp = TimeUtils.convertFromYearSecondTimestamp(startOfSamples);
				for(Event e : meanProcessor.getConsolidatedEventStream()) {
					logger.debug(TimeUtils.convertToISO8601String(e.getEventTimeStamp()) + "=" + e.getSampleValue().toString());
					Instant eventTs = e.getEventTimeStamp();
					Assertions.assertTrue(eventTs.isAfter(previousTimeStamp), "Event timestamp " + TimeUtils.convertToISO8601String(eventTs) + " is the same or after previous timestamp " + TimeUtils.convertToISO8601String(previousTimeStamp));
					previousTimeStamp = eventTs;
					eventCount++;
				}
				Assertions.assertTrue(eventCount >= 19 && eventCount <= 22, "Expected around 21 events got " + eventCount);
			}

			// Test where we are missing the starting bin.
			{ 
				Mean meanProcessor = new Mean();
				meanProcessor.initialize("mean_" + PartitionGranularity.PARTITION_DAY.getApproxSecondsPerChunk(), pvName);
				Instant start = TimeUtils.convertFromISO8601String(currentYear + "-06-04T10:00:00.000Z");
				Instant end = TimeUtils.convertFromISO8601String(currentYear + "-06-23T10:00:00.000Z");
				meanProcessor.estimateMemoryConsumption(pvName, new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1), start, end, null);
				meanProcessor.wrap(CallableEventStream.makeOneStreamCallable(testData, null, false)).call();

				int eventCount = 0;
				Instant previousTimeStamp = TimeUtils.convertFromYearSecondTimestamp(startOfSamples);
				for(Event e : meanProcessor.getConsolidatedEventStream()) {
					logger.debug(TimeUtils.convertToISO8601String(e.getEventTimeStamp()) + "=" + e.getSampleValue().toString());
					Instant eventTs = e.getEventTimeStamp();
					Assertions.assertTrue(eventTs.isAfter(previousTimeStamp), "Event timestamp " + TimeUtils.convertToISO8601String(eventTs) + " is the same or after previous timestamp " + TimeUtils.convertToISO8601String(previousTimeStamp));
					previousTimeStamp = eventTs;
					eventCount++;
				}
				Assertions.assertTrue(eventCount >= 17 && eventCount <= 22, "Expected around 20 events got " + eventCount);
			}
			
			// Test where we are missing data in the start.
			{ 
				Mean meanProcessor = new Mean();
				meanProcessor.initialize("mean_" + PartitionGranularity.PARTITION_DAY.getApproxSecondsPerChunk(), pvName);
				Instant start = TimeUtils.convertFromISO8601String(currentYear + "-05-21T10:00:00.000Z");
				Instant end = TimeUtils.convertFromISO8601String(currentYear + "-06-21T10:00:00.000Z");
				meanProcessor.estimateMemoryConsumption(pvName, new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1), start, end, null);
				meanProcessor.wrap(CallableEventStream.makeOneStreamCallable(testData, null, false)).call();

				int eventCount = 0;
				Instant previousTimeStamp = start;
				for(Event e : meanProcessor.getConsolidatedEventStream()) {
					logger.debug(TimeUtils.convertToISO8601String(e.getEventTimeStamp()) + "=" + e.getSampleValue().toString());
					Instant eventTs = e.getEventTimeStamp();
					Assertions.assertTrue(eventTs.isAfter(previousTimeStamp), "Event timestamp " + TimeUtils.convertToISO8601String(eventTs) + " is the same or after previous timestamp " + TimeUtils.convertToISO8601String(previousTimeStamp));
					previousTimeStamp = eventTs;
					eventCount++;
				}
				Assertions.assertTrue(eventCount >= 17 && eventCount <= 23, "Expected around 21 events got " + eventCount);
			}

		}
	}

	/**
	 * rms_&lt;secs&gt; resolves through the registry and computes the root mean square per bin.
	 * Samples alternate between +3 and -3, so every bin has an RMS of 3 and a mean of 0.
	 */
	@Test
	public void testRMSThroughRegistry() throws Exception {
		short currentYear = TimeUtils.getCurrentYear();
		String rmsPvName = "Test_SummaryStatsRMS";
		YearSecondTimestamp startOfSamples = TimeUtils.convertToYearSecondTimestamp(TimeUtils.convertFromISO8601String(currentYear + "-06-01T00:00:00.000Z"));
		ArrayListEventStream testData = new ArrayListEventStream(0, new RemotableEventStreamDesc(ArchDBRTypes.DBR_SCALAR_DOUBLE, rmsPvName, currentYear));
		for(int s = 0; s < 10*24; s++) {
			double value = (s % 2 == 0) ? 3.0 : -3.0;
			testData.add(new SimulationEvent(startOfSamples.getSecondsintoyear() + s * PartitionGranularity.PARTITION_HOUR.getApproxSecondsPerChunk(), currentYear, ArchDBRTypes.DBR_SCALAR_DOUBLE, new ScalarValue<Double>(value)));
		}

		String ppArg = "rms_" + PartitionGranularity.PARTITION_DAY.getApproxSecondsPerChunk();
		PostProcessor rmsProcessor = PostProcessors.findPostProcessor(ppArg);
		Assertions.assertNotNull(rmsProcessor, "No post processor registered for " + ppArg);
		Assertions.assertEquals("rms", rmsProcessor.getIdentity());
		rmsProcessor.initialize(ppArg, rmsPvName);
		Instant start = TimeUtils.convertFromISO8601String(currentYear + "-06-02T00:00:00.000Z");
		Instant end = TimeUtils.convertFromISO8601String(currentYear + "-06-09T00:00:00.000Z");
		rmsProcessor.estimateMemoryConsumption(rmsPvName, new PVTypeInfo(rmsPvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1), start, end, null);
		rmsProcessor.wrap(CallableEventStream.makeOneStreamCallable(testData, null, false)).call();

		int eventCount = 0;
		for(Event e : ((PostProcessorWithConsolidatedEventStream) rmsProcessor).getConsolidatedEventStream()) {
			Assertions.assertEquals(3.0, e.getSampleValue().getValue().doubleValue(), 1e-9, "RMS at " + TimeUtils.convertToISO8601String(e.getEventTimeStamp()));
			eventCount++;
		}
		Assertions.assertTrue(eventCount >= 6, "Expected about 7 daily bins, got " + eventCount);
	}
}
