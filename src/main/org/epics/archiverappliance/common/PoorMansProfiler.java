package org.epics.archiverappliance.common;

import java.util.LinkedHashMap;

/**
 * Small easy to use profiler.
 * Not much functionality here... Keep walking.
 * @author mshankar
 *
 */
public class PoorMansProfiler {
	private LinkedHashMap<String, Long> steps = new LinkedHashMap<String, Long>();
	// Readings of the monotonic clock, in nanoseconds; the report writes the differences in milliseconds.
	private long startingTimeNanos = -1;
	private long latestMarkNanos = -1;
	
	public PoorMansProfiler() { 
		this.startingTimeNanos = System.nanoTime();
	}

	public void mark(String location) { 
		latestMarkNanos = System.nanoTime();
		steps.put(location, latestMarkNanos);
	}
	
	public String toString() { 
		StringBuilder buf = new StringBuilder();
		buf.append("\n");
		long previousNanos = startingTimeNanos;
		for(String location : steps.keySet()) {
			Long currentNanos = steps.get(location);
			buf.append(location);
			buf.append(" --> ");
			buf.append((currentNanos - previousNanos) / 1_000_000);
			buf.append("(ms)\n");
			previousNanos = currentNanos;
		}
		buf.append("Total");
		buf.append(" --> ");
		buf.append((latestMarkNanos - startingTimeNanos) / 1_000_000);
		buf.append("(ms)\n");
		
		return buf.toString();
	}
	
	public long totalTimeMS() { 
		return (latestMarkNanos - startingTimeNanos) / 1_000_000;
	}
}
