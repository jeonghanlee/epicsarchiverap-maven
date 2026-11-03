package org.epics.archiverappliance.retrieval.pva;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

class PvaCallLimiterTest {

	@Test
	void onlyThePermitsAreGrantedUnderConcurrentTakers() throws Exception {
		int permits = 5;
		int takers = 40;
		PvaCallLimiter limiter = new PvaCallLimiter(permits);
		AtomicInteger granted = new AtomicInteger();
		CountDownLatch start = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(takers);
		try {
			List<Future<?>> futures = new ArrayList<>();
			for (int i = 0; i < takers; i++) {
				futures.add(pool.submit(() -> {
					start.await();
					if (limiter.tryAcquire()) {
						granted.incrementAndGet();
					}
					return null;
				}));
			}
			start.countDown();
			for (Future<?> future : futures) {
				future.get();
			}
		} finally {
			pool.shutdownNow();
		}
		assertEquals(permits, granted.get());
	}

	@Test
	void aReleasedPermitIsGrantedAgain() {
		PvaCallLimiter limiter = new PvaCallLimiter(1);
		assertTrue(limiter.tryAcquire());
		assertFalse(limiter.tryAcquire());
		limiter.release();
		assertTrue(limiter.tryAcquire());
	}

	@Test
	void theDefaultCountAppliesWithoutTheProperty() {
		assertEquals(100, PvaCallLimiter.fromProperties(new Properties()).total());
		Properties blank = new Properties();
		blank.setProperty(PvaCallLimiter.PROPERTY, " ");
		assertEquals(100, PvaCallLimiter.fromProperties(blank).total());
	}

	@Test
	void aSetValueReplacesTheDefault() {
		Properties properties = new Properties();
		properties.setProperty(PvaCallLimiter.PROPERTY, "3");
		PvaCallLimiter limiter = PvaCallLimiter.fromProperties(properties);
		assertEquals(3, limiter.total());
		assertTrue(limiter.tryAcquire());
		assertTrue(limiter.tryAcquire());
		assertTrue(limiter.tryAcquire());
		assertFalse(limiter.tryAcquire());
	}

	@Test
	void aValueThatIsNotAPositiveIntegerIsRejected() {
		Properties text = new Properties();
		text.setProperty(PvaCallLimiter.PROPERTY, "many");
		assertThrows(IllegalArgumentException.class, () -> PvaCallLimiter.fromProperties(text));
		Properties zero = new Properties();
		zero.setProperty(PvaCallLimiter.PROPERTY, "0");
		assertThrows(IllegalArgumentException.class, () -> PvaCallLimiter.fromProperties(zero));
	}
}
