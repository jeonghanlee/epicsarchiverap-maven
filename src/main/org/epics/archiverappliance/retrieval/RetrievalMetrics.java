package org.epics.archiverappliance.retrieval;

import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.common.reports.Details;
import org.epics.archiverappliance.config.ConfigService;

import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.Map;
import java.util.Set;

/**
 * The retrieval metrics of one PV, or the sum over the PVs of an appliance: the number of requests, the time of the
 * last request and the distinct callers. Several request threads update one entry at once, so an update and the
 * snapshot a report reads are synchronized on the entry; a sum adds the snapshots of the entries into its own object.
 */
public class RetrievalMetrics implements Details {
    public static final String NUMBER_OF_RETRIEVAL_REQUESTS = "Number of Retrieval Requests";
    public static final String LAST_RETRIEVAL_REQUEST = "Time of last Retrieval Request";
    public static final String NUMBER_OF_UNIQUE_USERS = "Number of unique users";
    private long numberOfRequests = 0;
    private Instant lastRequest = null;
    private final Set<String> userIdentifiers = new HashSet<>();

    public RetrievalMetrics() {}

    public static final RetrievalMetrics EMPTY_METRICS = new RetrievalMetrics();

    /** The consistent values of an entry at one moment, taken under its lock. */
    private record Snapshot(long numberOfRequests, Instant lastRequest, Set<String> userIdentifiers) {}

    private synchronized Snapshot snapshot() {
        return new Snapshot(numberOfRequests, lastRequest, new HashSet<>(userIdentifiers));
    }

    public synchronized void updateMetrics(Instant lastRequest, String user) {
        this.numberOfRequests += 1;
        this.userIdentifiers.add(user);
        this.lastRequest = lastRequest;
    }

    public synchronized RetrievalMetrics sumMetrics(RetrievalMetrics newMetrics) {
        Snapshot other = newMetrics.snapshot();
        this.numberOfRequests += other.numberOfRequests();
        this.userIdentifiers.addAll(other.userIdentifiers());
        if (other.lastRequest() != null) {
            if (this.lastRequest == null) {
                this.lastRequest = other.lastRequest();
            } else {
                long latestEpochMillis =
                        Long.max(this.lastRequest.toEpochMilli(), other.lastRequest().toEpochMilli());
                this.lastRequest = Instant.ofEpochMilli(latestEpochMillis);
            }
        }
        return this;
    }

    public static RetrievalMetrics calculateSummedMetrics(ConfigService configService) {
        var allMetrics = configService.getRetrievalRuntimeState().getRetrievalMetrics();
        return allMetrics.values().stream().reduce(new RetrievalMetrics(), RetrievalMetrics::sumMetrics);
    }

    public Map<String, String> getMetrics() {
        Snapshot now = snapshot();
        return Map.of(
                NUMBER_OF_RETRIEVAL_REQUESTS,
                String.valueOf(now.numberOfRequests()),
                LAST_RETRIEVAL_REQUEST,
                TimeUtils.convertToHumanReadableString(now.lastRequest()),
                NUMBER_OF_UNIQUE_USERS,
                String.valueOf(now.userIdentifiers().size()));
    }

    @Override
    public ConfigService.WAR_FILE source() {
        return ConfigService.WAR_FILE.RETRIEVAL;
    }

    @Override
    public LinkedList<Map<String, String>> details(ConfigService configService) {
        Snapshot now = snapshot();
        LinkedList<Map<String, String>> result = new LinkedList<>();
        result.add(metricDetail(NUMBER_OF_RETRIEVAL_REQUESTS, String.valueOf(now.numberOfRequests())));
        result.add(timeDetail(LAST_RETRIEVAL_REQUEST, now.lastRequest() == null ? 0 : now.lastRequest().getEpochSecond()));
        result.add(metricDetail(NUMBER_OF_UNIQUE_USERS, String.valueOf(now.userIdentifiers().size())));
        return result;
    }
}
