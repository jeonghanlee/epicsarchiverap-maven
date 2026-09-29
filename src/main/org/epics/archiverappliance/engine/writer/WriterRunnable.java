
/*******************************************************************************
 * Copyright (c) 2011 The Board of Trustees of the Leland Stanford Junior University
 * as Operator of the SLAC National Accelerator Laboratory.
 * Copyright (c) 2011 Brookhaven National Laboratory.
 * EPICS archiver appliance is distributed subject to a Software License Agreement found
 * in file LICENSE that is included with this distribution.
 *******************************************************************************/

package org.epics.archiverappliance.engine.writer;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.epics.archiverappliance.engine.membuf.ArrayListEventStream;
import org.epics.archiverappliance.engine.model.ArchiveChannel;
import org.epics.archiverappliance.engine.model.SampleBuffer;

/**
 * WriterRunnable is scheduled by the executor in the engine context every writing period.
 * @author Luofeng Li
 *
 */
public class WriterRunnable implements Runnable {
	private static final Logger logger = LogManager.getLogger(WriterRunnable.class);
	/** Minimum write period [seconds] */
	private static final double MIN_WRITE_PERIOD = 1.0;
    /**the sample buffer hash map*/
	private final ConcurrentHashMap<String, SampleBuffer> buffers = new ConcurrentHashMap<String, SampleBuffer>();

	/**the configservice used by this WriterRunnable*/
	private ConfigService configservice = null;
/**
 * the constructor
 * @param configservice the configservice used by this WriterRunnable
 */
	public WriterRunnable(ConfigService configservice) {

		this.configservice = configservice;
	}

	/** Add a channel's buffer that this thread reads 
	 * @param channel ArchiveChannel
	 */
	public void addChannel(final ArchiveChannel channel) {
		addSampleBuffer(channel.getName(), channel.getSampleBuffer());
	}
/**
 * remove one sample buffer from the buffer hash map.
 * At the same time. it also removes the channel from the channel hash map in the engine context
 * @param channelName the name of the channel who and whose sample buffer are removed
 */
	public synchronized void removeChannel(final String channelName) {
		buffers.remove(channelName);
	}

	/**
	 * add sample buffer into this writer runnable and add year listener to each sample buffer
	 * @param name the name of the channel
	 * @param buffer the sample buffer for this channel
	 */
	synchronized void addSampleBuffer(final String name, final SampleBuffer buffer) {
		// buffers.add(buffer);
		buffers.put(name, buffer);
		buffer.addYearListener(sampleBuffer -> {
            //
            configservice.getEngineContext().getScheduler().execute(() -> {
                try {
                    write(sampleBuffer);
                    logger.info(sampleBuffer.getChannelName() + ":year change");
                } catch (IOException e) {
                    logger.error("Exception", e);
                }

            });

        });
	}

/**
 * set the writing period. when the writing period is at least 10 seonds.
 * When write_period &lt; 10 , the writing period is 10 seconds actually.
 * @param write_period  the writing period in second
 * @return the actual writing period in second
 */
	public double setWritingPeriod(double write_period) {
		double tempwrite_period=write_period;
		if (tempwrite_period < MIN_WRITE_PERIOD) {
		
			tempwrite_period = MIN_WRITE_PERIOD;
		}
		return tempwrite_period;
		
	}
	

  
	@Override
	public void run() {
		try {
			// final long written = write();
			long startTime = System.currentTimeMillis();
			write();
			long endTime = System.currentTimeMillis();
			configservice.getEngineContext().setSecondsConsumedByWriter(
					(double) (endTime - startTime) / 1000);
		} catch (Exception e) {
			logger.error("Exception", e);
		}

	}
   /**
    * write the sample buffer to the short term storage
    * @param buffer the sample buffer to be written
    * @throws IOException  error occurs during writing the sample buffer to the short term storage
    */
	private synchronized void write(SampleBuffer buffer) throws IOException {
		String name = buffer.getChannelName();
		ArchiveChannel channel = configservice.getEngineContext().getChannelList().get(name);
		// A queued year-change task can outlive the channel that registered it.
		if (buffers.get(name) != buffer || channel == null || channel.getSampleBuffer() != buffer) return;
		boolean retry = buffer.hasPendingWrite();
		writeBatch(channel, buffer);
		if (retry) writeBatch(channel, buffer);
	}

	private void writeBatch(ArchiveChannel channel, SampleBuffer buffer) throws IOException {
		ArrayListEventStream samples = buffer.samplesToWrite();
		if (samples == null) return;
		try (BasicContext context = new BasicContext()) {
			channel.aboutToWriteBuffer((DBRTimeEvent) samples.getLast());
			channel.getWriter().appendData(context, channel.getName(), samples);
		}
		buffer.samplesWritten();
		channel.setlastRotateLogsEpochSeconds(System.currentTimeMillis() / 1000);
	}

	/** Wait for active writes and persist this channel's pending batches. */
	public synchronized void flushChannel(ArchiveChannel channel) throws IOException {
		if (buffers.get(channel.getName()) != channel.getSampleBuffer()
				|| configservice.getEngineContext().getChannelList().get(channel.getName()) != channel) {
			throw new IOException("Channel changed before its buffer could be written: " + channel.getName());
		}
		write(channel.getSampleBuffer());
	}

	/** Serialize periodic writes, explicit flushes and buffer removal. */
	private synchronized void write() throws IOException {
		IOException failure = null;
		for (SampleBuffer buffer : buffers.values()) {
			try {
				write(buffer);
			} catch (IOException ex) {
				if (failure == null) failure = ex;
				else failure.addSuppressed(ex);
			}
		}
		if (failure != null) throw failure;
	}

	/**
	 * flush out the sample buffer to the short term storage before shutting down the engine
	 * @throws Exception  error occurs during writing the sample buffer to the short term storage
	 */
	public void flushBuffer() throws Exception {
		
			write();
	}

}
