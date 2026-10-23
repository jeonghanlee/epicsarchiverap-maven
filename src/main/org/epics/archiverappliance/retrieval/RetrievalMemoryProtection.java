package org.epics.archiverappliance.retrieval;

import com.sun.management.HotSpotDiagnosticMXBean;
import com.sun.management.ThreadMXBean;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.EventStream;
import org.epics.archiverappliance.EventStreamDesc;
import org.epics.archiverappliance.retrieval.postprocessors.Optimized;
import org.epics.archiverappliance.retrieval.postprocessors.CAPlotBinning;
import org.epics.archiverappliance.retrieval.postprocessors.OptimizedWithLastSample;
import org.epics.archiverappliance.retrieval.postprocessors.PostProcessor;
import org.epics.archiverappliance.retrieval.postprocessors.PostProcessors;
import org.epics.archiverappliance.retrieval.postprocessors.SummaryStatsPostProcessor;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryPoolMXBean;
import java.lang.management.MemoryType;
import java.lang.management.MemoryUsage;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.Iterator;
import java.util.IdentityHashMap;
import java.util.Set;
import java.util.Collections;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.CompletionException;
import java.util.Properties;

/** Request-scoped admission, allocation accounting and cooperative memory-pressure checks. */
public final class RetrievalMemoryProtection {
    private static final Logger logger = LogManager.getLogger(RetrievalMemoryProtection.class);
    private static final ThreadLocal<Request> current = new ThreadLocal<>();
    private static final long ARRAY_REFERENCE_BYTES = 8;
    private static final long ARRAY_HEADER_BYTES = 24;
    private static final int DEFAULT_OPTIMIZED_POINTS = 1000;
    private static final String PROPERTY_PREFIX = "org.epics.archiverappliance.retrieval.memory.";
    private static final int DEFAULT_STUCK_SECONDS = 600;
    private static final int DEFAULT_INTERRUPT_SECONDS = 900;
    private static final Settings DEFAULT_SETTINGS = new Settings(
            .20, .50, .60, .01, 1024, Duration.ofMillis(100), 112, 256, 176);

    /** Read deployment limits as fractions of the actual maximum heap. */
    public static Settings deploymentSettings(Properties properties) {
        Settings defaults = DEFAULT_SETTINGS;
        return new Settings(
                decimal(properties, "budgetFraction", defaults.budgetFraction()),
                decimal(properties, "admissionFraction", defaults.admissionFraction()),
                decimal(properties, "pressureFraction", defaults.pressureFraction()),
                decimal(properties, "allocationFloorFraction", defaults.allocationFloorFraction()),
                Math.toIntExact(integer(properties, "checkEveryEvents", defaults.checkEveryEvents())),
                Duration.ofMillis(integer(properties, "collectionIntervalMillis", defaults.collectionInterval().toMillis())),
                integer(properties, "scalarBinBytes", defaults.scalarBinBytes()),
                integer(properties, "vectorBinBytes", defaults.vectorBinBytes()),
                integer(properties, "retainedPointBytes", defaults.retainedPointBytes()));
    }

    private static double decimal(Properties properties, String name, double fallback) {
        return Double.parseDouble(properties.getProperty(PROPERTY_PREFIX + name, Double.toString(fallback)).trim());
    }

    private static long integer(Properties properties, String name, long fallback) {
        return Long.parseLong(properties.getProperty(PROPERTY_PREFIX + name, Long.toString(fallback)).trim());
    }

    /** Validated limits shared by explicit measurements and deployment configuration. */
    public record Settings(double budgetFraction, double admissionFraction, double pressureFraction,
                           double allocationFloorFraction, int checkEveryEvents, Duration collectionInterval,
                           long scalarBinBytes, long vectorBinBytes, long retainedPointBytes) {
        public Settings {
            if (!(budgetFraction > 0 && budgetFraction < 1)
                    || !(admissionFraction > 0 && admissionFraction < pressureFraction && pressureFraction < 1)
                    || !(allocationFloorFraction >= 0 && allocationFloorFraction < 1)
                    || checkEveryEvents < 1 || collectionInterval == null
                    || collectionInterval.isNegative() || collectionInterval.isZero()
                    || scalarBinBytes < 1 || vectorBinBytes < scalarBinBytes || retainedPointBytes < 1) {
                throw new IllegalArgumentException("Invalid retrieval memory protection settings");
            }
            collectionInterval.toNanos();
        }
    }

    /** A rejected admission or stopped request; HTTP adapters use the associated status. */
    public static final class Rejected extends RuntimeException {
        private final int httpStatus;
        private final long collectionUsed;

        private Rejected(int httpStatus, String message, long collectionUsed) {
            super(message);
            this.httpStatus = httpStatus;
            this.collectionUsed = collectionUsed;
        }

        public int httpStatus() { return httpStatus; }
        public long collectionUsed() { return collectionUsed; }
    }

    private final Settings settings;
    private final MemoryPoolMXBean oldPool;
    private final ThreadMXBean threadBean;
    private final long maxHeap = Runtime.getRuntime().maxMemory();
    private final long budget;
    private final long admissionThreshold;
    private final long pressureThreshold;
    private final long allocationFloor;
    private long lastCollectionRequest;
    private long collectionRequests;
    private final long httpTimeoutNanos;

    /** Shared request cancellation survives consumed interrupts and never resets for a worker. */
    public static final class Cancellation {
        private final long started = System.nanoTime();
        private final long timeoutNanos;
        private final java.util.function.BooleanSupplier external;
        private final java.util.concurrent.atomic.AtomicReference<String> reason =
                new java.util.concurrent.atomic.AtomicReference<>();

        Cancellation(long timeoutNanos, java.util.function.BooleanSupplier external) {
            if (timeoutNanos < 0) throw new IllegalArgumentException("Negative retrieval timeout");
            this.timeoutNanos = timeoutNanos;
            this.external = java.util.Objects.requireNonNull(external);
        }

        public void cancel() {
            reason.compareAndSet(null, "Retrieval request interrupted");
        }

        private String reason() {
            if (reason.get() == null) {
                if (external.getAsBoolean()) cancel();
                if (timeoutNanos > 0 && System.nanoTime() - started >= timeoutNanos) {
                    reason.compareAndSet(null, "Retrieval request deadline exceeded");
                }
            }
            return reason.get();
        }
    }

    static long httpTimeoutNanos(Properties properties) {
        int stuck = Integer.parseInt(properties.getProperty(
                "archappl.valve.stuckThresholdSeconds", Integer.toString(DEFAULT_STUCK_SECONDS)));
        int interrupt = Integer.parseInt(properties.getProperty(
                "archappl.valve.interruptThresholdSeconds", Integer.toString(DEFAULT_INTERRUPT_SECONDS)));
        return stuck <= 0 || interrupt <= 0 ? 0 : Duration.ofSeconds(Math.max(stuck, interrupt)).toNanos();
    }

    public RetrievalMemoryProtection(Settings settings) {
        this(settings, ManagementFactory.getThreadMXBean());
    }

    RetrievalMemoryProtection(Settings settings, java.lang.management.ThreadMXBean bean) {
        this.settings = settings;
        httpTimeoutNanos = httpTimeoutNanos(System.getProperties());
        oldPool = ManagementFactory.getMemoryPoolMXBeans().stream()
                .filter(pool -> pool.getType() == MemoryType.HEAP && pool.isCollectionUsageThresholdSupported())
                .max(Comparator.comparingLong(pool -> pool.getUsage().getMax()))
                .orElseThrow(() -> new IllegalStateException("No old-generation collection-usage pool available"));
        threadBean = bean instanceof ThreadMXBean allocationBean ? allocationBean : null;
        budget = (long) (maxHeap * settings.budgetFraction());
        admissionThreshold = (long) (maxHeap * settings.admissionFraction());
        pressureThreshold = (long) (maxHeap * settings.pressureFraction());
        allocationFloor = (long) (maxHeap * settings.allocationFloorFraction());
        HotSpotDiagnosticMXBean diagnostic = ManagementFactory.getPlatformMXBean(HotSpotDiagnosticMXBean.class);
        if (diagnostic != null && Boolean.parseBoolean(diagnostic.getVMOption("DisableExplicitGC").getValue())) {
            logger.warn("DisableExplicitGC is enabled: retrieval cannot request collection to recover memory admission");
        }
        logger.info("Retrieval memory protection enabled: pool={}, maxHeap={}, budget={}, admission={}, pressure={}, settings={}",
                oldPool.getName(), maxHeap, budget, admissionThreshold, pressureThreshold, settings);
        logger.info("Retrieval HTTP deadline: {} ms from servlet entry; zero disables the deadline",
                httpTimeoutNanos / 1_000_000);
    }

    public String poolName() { return oldPool.getName(); }
    public long budgetBytes() { return budget; }
    public long pressureThresholdBytes() { return pressureThreshold; }
    public synchronized long collectionRequests() { return collectionRequests; }

    public long collectionUsedBytes() {
        MemoryUsage usage = oldPool.getCollectionUsage();
        return usage == null ? 0 : usage.getUsed();
    }

    /** Refresh collection usage under current or last-collected pressure, with a shared rate limit. */
    private synchronized long collectedUsage(long threshold) {
        long used = collectionUsedBytes();
        long now = System.nanoTime();
        if ((used > threshold || oldPool.getUsage().getUsed() > threshold) && (collectionRequests == 0
                || now - lastCollectionRequest >= settings.collectionInterval().toNanos())) {
            System.gc();
            lastCollectionRequest = System.nanoTime();
            collectionRequests++;
            used = collectionUsedBytes();
        }
        return used;
    }

    private long allocatedBytes() {
        return threadBean != null && threadBean.isThreadAllocatedMemorySupported()
                && threadBean.isThreadAllocatedMemoryEnabled() ? threadBean.getCurrentThreadAllocatedBytes() : -1;
    }

    public Request begin() {
        return begin(() -> false);
    }

    /** Account on this worker while observing the caller's persistent cancellation state. */
    public Request begin(java.util.function.BooleanSupplier cancelled) {
        return begin(new Cancellation(0, cancelled));
    }

    /** HTTP alone inherits the configured valve time limit, without waiting for a background interrupt. */
    public Request beginHttpRequest() {
        return begin(new Cancellation(httpTimeoutNanos, () -> false));
    }

    public static Cancellation currentCancellation() {
        Request request = current.get();
        return request == null ? new Cancellation(0, () -> false) : request.cancellation;
    }

    public Request begin(Cancellation cancellation) {
        if (current.get() != null) throw new IllegalStateException("Retrieval request already active on this thread");
        long used = collectedUsage(admissionThreshold);
        if (used > admissionThreshold) {
            throw new Rejected(503, "Retrieval memory admission refused: collection usage " + used
                    + " exceeds threshold " + admissionThreshold, used);
        }
        Request request = new Request(cancellation);
        current.set(request);
        return request;
    }

    public static void checkCurrent() {
        Request request = current.get();
        if (request != null) request.event();
    }

    /** Check request boundaries even when fewer than one interval of events was processed. */
    public static void checkCurrentNow() {
        Request request = current.get();
        if (request != null) request.check();
    }

    /** Output boundaries check cancellation without collecting memory on every write. */
    public static void checkCancellationNow() {
        Request request = current.get();
        if (request != null) request.checkCancellation();
    }

    public static boolean currentFailed() {
        Request request = current.get();
        return request != null && request.failure != null;
    }

    /** Preserve failures through futures and prevent successful response completion during unwinding. */
    public static RuntimeException fail(Throwable cause) {
        while ((cause instanceof ExecutionException || cause instanceof CompletionException) && cause.getCause() != null) {
            cause = cause.getCause();
        }
        if (cause instanceof InterruptedException) {
            Thread.currentThread().interrupt();
            cause = new Rejected(503, "Retrieval request interrupted", 0);
        }
        RuntimeException failure = cause instanceof RuntimeException runtime ? runtime
                : new IllegalStateException("Retrieval processing failed", cause);
        Request request = current.get();
        if (request != null) request.failure = failure;
        return failure;
    }

    /** Admission must precede estimates, which can initialize request-sized postprocessor state. */
    public static void admitCurrent(PostProcessor processor, Instant start, Instant end) {
        Request request = current.get();
        if (request != null && request.admitted.add(processor)) request.admit(processor, start, end, 0);
    }

    public static void estimateCurrent(long bytes) {
        Request request = current.get();
        if (request != null) request.estimate = saturatingAdd(request.estimate, Math.max(0, bytes));
    }

    public static EventStream guard(EventStream stream) {
        Request request = current.get();
        if (request == null) return stream;
        return stream instanceof RemotableOverRaw ? new GuardedRemotableStream(stream, request)
                : new GuardedStream(stream, request);
    }

    private static class GuardedStream implements EventStream {
        protected final EventStream stream;
        private final Request request;

        private GuardedStream(EventStream stream, Request request) {
            this.stream = stream;
            this.request = request;
        }

        @Override public EventStreamDesc getDescription() { return stream.getDescription(); }
        @Override public void close() throws IOException { stream.close(); }
        @Override public Iterator<Event> iterator() {
            Iterator<Event> events = stream.iterator();
            return new Iterator<>() {
                @Override public boolean hasNext() { return events.hasNext(); }
                @Override public Event next() { request.event(); return events.next(); }
            };
        }
    }

    private static final class GuardedRemotableStream extends GuardedStream implements RemotableOverRaw {
        private GuardedRemotableStream(EventStream stream, Request request) { super(stream, request); }
        @Override public RemotableEventStreamDesc getDescription() {
            return ((RemotableOverRaw) stream).getDescription();
        }
    }

    /** Scope is confined to the request thread and removed before that thread is reused. */
    public final class Request implements AutoCloseable {
        private final Thread owner = Thread.currentThread();
        private final Cancellation cancellation;
        private final long allocationStart = allocatedBytes();
        private long estimate;
        private long declared;
        private int events;
        private RuntimeException failure;
        private final Set<PostProcessor> admitted = Collections.newSetFromMap(new IdentityHashMap<>());

        private Request(Cancellation cancellation) {
            this.cancellation = java.util.Objects.requireNonNull(cancellation);
        }

        public long allocatedSinceStart() {
            long now = allocatedBytes();
            return allocationStart < 0 || now < allocationStart ? estimate : now - allocationStart;
        }

        public void admit(PostProcessor processor, Instant start, Instant end, long memoryEstimate) {
            requireOwner();
            estimate = saturatingAdd(estimate, Math.max(0, memoryEstimate));
            long bytes = 0;
            long seconds = Math.max(0, end.getEpochSecond() - start.getEpochSecond());
            if (processor instanceof Optimized || processor instanceof OptimizedWithLastSample) {
                String[] parts = processor.getExtension().split("_");
                long points = parts.length > 1 ? Long.parseLong(parts[1]) : DEFAULT_OPTIMIZED_POINTS;
                long interval = Math.max(1, Math.min(Integer.MAX_VALUE, seconds / points));
                long bins = Math.max(0, end.getEpochSecond() / interval - start.getEpochSecond() / interval) + 2;
                bytes = saturatingAdd(ARRAY_HEADER_BYTES, saturatingMultiply(points, ARRAY_REFERENCE_BYTES));
                bytes = saturatingAdd(bytes, saturatingMultiply(points, settings.retainedPointBytes()));
                bytes = saturatingAdd(bytes, saturatingMultiply(bins, settings.vectorBinBytes()));
            } else if (processor instanceof SummaryStatsPostProcessor || processor instanceof CAPlotBinning) {
                String[] parts = processor.getExtension().split("_");
                long interval = parts.length > 1 ? Long.parseLong(parts[1]) : PostProcessors.DEFAULT_SUMMARIZING_INTERVAL;
                long bins = Math.max(0, end.getEpochSecond() / interval - start.getEpochSecond() / interval) + 2;
                bytes = saturatingMultiply(bins,
                        processor instanceof SummaryStatsPostProcessor stats && !stats.isProvidingVectorData()
                                ? settings.scalarBinBytes() : settings.vectorBinBytes());
            }
            declared = saturatingAdd(declared, bytes);
            if (declared > budget) {
                reject(400, "Retrieval declared size " + declared + " exceeds request budget " + budget, 0);
            }
        }

        public void event() {
            requireOwner();
            if (++events >= settings.checkEveryEvents()) {
                events = 0;
                check();
            }
        }

        public void check() {
            checkCancellation();
            long used = collectedUsage(pressureThreshold);
            if (used > pressureThreshold && allocatedSinceStart() > allocationFloor) {
                reject(503, "Retrieval memory pressure: collection usage " + used + " exceeds threshold "
                        + pressureThreshold + " and request allocation exceeds floor " + allocationFloor, used);
            }
        }

        private void checkCancellation() {
            requireOwner();
            if (failure != null) throw failure;
            if (owner.isInterrupted()) cancellation.cancel();
            String reason = cancellation.reason();
            if (reason != null) reject(503, reason, collectionUsedBytes());
        }

        private void reject(int status, String message, long used) {
            failure = new Rejected(status, message, used);
            throw failure;
        }

        private void requireOwner() {
            if (Thread.currentThread() != owner || current.get() != this) {
                throw new IllegalStateException("Retrieval memory scope used outside its request thread");
            }
        }

        @Override public void close() {
            requireOwner();
            current.remove();
        }
    }

    private static long saturatingAdd(long a, long b) { return a > Long.MAX_VALUE - b ? Long.MAX_VALUE : a + b; }
    private static long saturatingMultiply(long a, long b) { return a > Long.MAX_VALUE / b ? Long.MAX_VALUE : a * b; }
}
