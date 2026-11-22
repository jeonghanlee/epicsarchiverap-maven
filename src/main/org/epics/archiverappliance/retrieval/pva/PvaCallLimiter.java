package org.epics.archiverappliance.retrieval.pva;

import java.util.Properties;
import java.util.concurrent.Semaphore;

/**
 * A fixed number of permits for the calls in flight. A permit is never waited for: when none is free the caller is
 * refused at once.
 */
public final class PvaCallLimiter {

	/** System property that sets the number of permits. */
	public static final String PROPERTY = "archappl.valve.pvaConcurrency";

	/** Number of permits when the property is not set; the default of the concurrency valve of the web applications. */
	public static final int DEFAULT_PERMITS = 100;

	private final Semaphore permits;
	private final int total;

	public PvaCallLimiter(int total) {
		if (total < 1) {
			throw new IllegalArgumentException("The number of permits must be at least 1: " + total);
		}
		this.total = total;
		this.permits = new Semaphore(total);
	}

	/** Build the limiter from the property in the given properties; the default applies when it is not set. */
	public static PvaCallLimiter fromProperties(Properties properties) {
		String value = properties.getProperty(PROPERTY);
		if (value == null || value.isBlank()) {
			return new PvaCallLimiter(DEFAULT_PERMITS);
		}
		try {
			return new PvaCallLimiter(Integer.parseInt(value.trim()));
		} catch (NumberFormatException e) {
			throw new IllegalArgumentException(PROPERTY + " is not an integer: " + value, e);
		}
	}

	/** Take a permit without waiting; false when none is free. */
	public boolean tryAcquire() {
		return permits.tryAcquire();
	}

	/** Return a permit taken with {@link #tryAcquire()}. */
	public void release() {
		permits.release();
	}

	public int total() {
		return total;
	}
}
