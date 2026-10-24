package org.epics.archiverappliance.retrieval;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.Event;
import org.epics.archiverappliance.EventStream;
import org.epics.archiverappliance.StoragePlugin;
import org.epics.archiverappliance.common.BasicContext;
import org.epics.archiverappliance.common.BiDirectionalIterable;
import org.epics.archiverappliance.common.PoorMansProfiler;
import org.epics.archiverappliance.common.TimeUtils;
import org.epics.archiverappliance.common.BiDirectionalIterable.IterationDirection;
import org.epics.archiverappliance.config.ApplianceInfo;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.PVNames;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.config.StoragePluginURLParser;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.epics.archiverappliance.mgmt.bpl.PVsMatchingParameter;
import org.epics.archiverappliance.retrieval.postprocessors.DefaultRawPostProcessor;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.epics.archiverappliance.utils.ui.MetaFields;
import org.json.simple.JSONValue;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.Serializable;
import java.time.Instant;
import java.time.Period;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.stream.Collectors;
import java.util.concurrent.ExecutionException;
import java.util.function.Predicate;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.hazelcast.projection.Projection;

public class GetDataAtTime {
    private static final Logger logger = LogManager.getLogger(GetDataAtTime.class);
    private static final long HTTP_CANCELLATION_CHECK_MILLIS = 100;

    static class Appliance2PVs {
        ApplianceInfo applianceInfo;
        LinkedList<String> pvsFromAppliance;
        HashMap<String, HashMap<String, Object>> pvValues;

        Appliance2PVs(ApplianceInfo applianceInfo) {
            this.applianceInfo = applianceInfo;
            this.pvsFromAppliance = new LinkedList<String>();
            this.pvValues = new HashMap<String, HashMap<String, Object>>();
        }
    }

    private static Appliance2PVs getDataFromEngine(Appliance2PVs gatherer, Instant atTime,
            GetUrlContent.HttpRequests requests) {
        try {
            HashMap<String, HashMap<String, Object>> resp = GetUrlContent.postStringListAndGetJSON(
                    gatherer.applianceInfo.getEngineURL() + "/getDataAtTime?at="
                            + TimeUtils.convertToISO8601String(atTime),
                    "pv",
                    gatherer.pvsFromAppliance, false, requests);
            if (resp == null) return gatherer;
            logger.debug("Done calling engine for appliance {} with PVs {} and got data for {} PVs ",
                gatherer.applianceInfo.getIdentity(),
                String.join(",", gatherer.pvsFromAppliance),
                ((resp != null) ? String.join(",", resp.keySet()) : "no PVs"));
            for (String pvName : resp.keySet()) {
                if (!gatherer.pvValues.containsKey(pvName)) {
                    gatherer.pvValues.put(pvName, resp.get(pvName));
                }
            }
        } catch (IOException ex) {
            logger.error("Exception getting data from the engine", ex);
        }
        return gatherer;
    }

    private static Appliance2PVs getDataFromRetrieval(Appliance2PVs gatherer, Instant atTime, Period searchPeriod,
            GetUrlContent.HttpRequests requests) {
        try {
            HashSet<String> remainingPVs = new HashSet<String>(gatherer.pvsFromAppliance);
            // We only has for PVs that we do not already have the answer for.
            remainingPVs.removeAll(gatherer.pvValues.keySet());
            HashMap<String, HashMap<String, Object>> resp = GetUrlContent.postStringListAndGetJSON(
                    gatherer.applianceInfo.getRetrievalURL() + "/../data/getDataAtTimeForAppliance?at="
                            + TimeUtils.convertToISO8601String(atTime)+"&searchPeriod="+searchPeriod.toString(),
                    "pv",
                    remainingPVs, true, requests);
            if (resp == null) return gatherer;
            logger.debug("Done calling retrieval for appliance {} with PVs {} and got data for {}",
                gatherer.applianceInfo.getIdentity(),
                String.join(",", gatherer.pvsFromAppliance),
                ((resp != null) ? String.join(",", resp.keySet()) : "no PVs"));
            for (String pvName : resp.keySet()) {
                if (!gatherer.pvValues.containsKey(pvName)) {
                    gatherer.pvValues.put(pvName, resp.get(pvName));
                }
            }
        } catch (IOException ex) {
            throw new CompletionException(ex);
        }
        return gatherer;
    }

    /** Cancellation aborts the real HTTP requests and waits for their workers before servlet reuse. */
    private static void awaitRetrievalCalls(CompletableFuture<?> completed, GetUrlContent.HttpRequests requests) {
        try {
            while (true) {
                RetrievalMemoryProtection.checkCancellationNow();
                try {
                    completed.get(HTTP_CANCELLATION_CHECK_MILLIS, TimeUnit.MILLISECONDS);
                    RetrievalMemoryProtection.checkCancellationNow();
                    return;
                } catch (TimeoutException waiting) {
                    // Keep the original servlet deadline while the HTTP response is outstanding.
                }
            }
        } catch (InterruptedException interrupted) {
            requests.close();
            completed.handle((result, failure) -> null).join();
            Thread.currentThread().interrupt();
            throw RetrievalMemoryProtection.fail(interrupted);
        } catch (ExecutionException failure) {
            throw new CompletionException(failure.getCause());
        } catch (RuntimeException failure) {
            requests.close();
            completed.handle((result, error) -> null).join();
            throw failure;
        }
    }

    private static HashMap<String, HashMap<String, Object>> getDataFromRemoteArchApplicance(
            String applianceRetrievalURL, LinkedList<String> remainingPVs, Instant atTime,
            GetUrlContent.HttpRequests requests) {
        try {
            if (remainingPVs.size() <= 0) {
                return null;
            }
            HashMap<String, HashMap<String, Object>> resp = GetUrlContent.postStringListAndGetJSON(
                    applianceRetrievalURL + "?at=" + TimeUtils.convertToISO8601String(atTime) + "&includeProxies=false",
                    "pv",
                    remainingPVs, false, requests);
            if (resp == null) return null;
            logger.debug("Done calling remote appliance at " + applianceRetrievalURL + " and got PV count "
                    + +((resp != null) ? resp.size() : 0));
            return resp;
        } catch (Throwable t) {
            logger.error("Exception getting data from the remote appliance " + applianceRetrievalURL, t);
        }
        return null;
    }

    private static <T> CompletableFuture<T>[] toArray(List<CompletableFuture<T>> list) {
        @SuppressWarnings("unchecked")
        CompletableFuture<T>[] futures = list.toArray(new CompletableFuture[0]);
        return futures;
    }

    private static record PVNameMapping ( String nameFromRequest, String nameFromTypeInfo ) {};
    private static record ProjRecord ( String pvName, String appliance, ArchDBRTypes DBRType, String[] archiveFields ) implements Serializable {};
    private static class GDATProjection implements Projection<Map.Entry<String, PVTypeInfo>, ProjRecord> {
        @Override
        public ProjRecord transform(Map.Entry<String, PVTypeInfo> entry) {
            String pvName = entry.getKey();
            PVTypeInfo value = entry.getValue();
            return new ProjRecord(pvName, value.getApplianceIdentity(), entry.getValue().getDBRType(), entry.getValue().getArchiveFields()) ;
        }
    }

    /**
     * The main getDataAtTime function. Pass in a list of PVs and a time.
     * @param req
     * @param resp
     * @param configService
     * @throws ServletException
     * @throws IOException
     * @throws InterruptedException
     * @throws ExecutionException
     */
    public static void getDataAtTime(HttpServletRequest req, HttpServletResponse resp, ConfigService configService)
            throws ServletException, IOException, InterruptedException, ExecutionException {
        PoorMansProfiler pmansProfiler = new PoorMansProfiler();

        LinkedList<String> pvNames = PVsMatchingParameter.getPVNamesFromPostBody(req);
        String timeStr = req.getParameter("at");
        if (timeStr == null) {
            timeStr = TimeUtils.convertToISO8601String(TimeUtils.getCurrentEpochSeconds());
        }
        Instant atTime;
        try {
            atTime = TimeUtils.convertFromISO8601String(timeStr);
        } catch (IllegalArgumentException ex) {
            String msg = "Cannot parse time " + timeStr;
            logger.warn(msg, ex);
            resp.sendError(HttpServletResponse.SC_BAD_REQUEST, msg);
            return;
        }

        boolean fetchFromExternalAppliances =
                req.getParameter("includeProxies") != null && Boolean.parseBoolean(req.getParameter("includeProxies"));

        String searchPeriodStr = req.getParameter("searchPeriod");
        if(searchPeriodStr == null) {
            searchPeriodStr = "P1D";
        }
        Period searchPeriod = Period.parse(searchPeriodStr);

        pmansProfiler.mark("After request params.");
        
        HashSet<String> paddedPVNames = new HashSet<String>();
        LinkedList<PVNameMapping> nameMappings = new LinkedList<PVNameMapping>();
        for(String pvName : pvNames) {
            paddedPVNames.add(pvName);
            nameMappings.add(new PVNameMapping(pvName, pvName));
            // Patch pvNames to include PV's without any field names
            String cname = PVNames.channelNamePVName(pvName);
            if(!cname.equals(pvName)) {
                paddedPVNames.add(cname);
                nameMappings.add(new PVNameMapping(pvName, cname));
            }
            // Patch pvNames to add real names of any aliased PVs
            String realName = configService.getRealNameForAlias(cname);
            if(realName != null) {
                paddedPVNames.add(realName);
                nameMappings.add(new PVNameMapping(pvName, realName));
            }
        }
        Map<String, List<PVNameMapping>> reverseMapping = nameMappings.stream().collect(Collectors.groupingBy(p -> p.nameFromTypeInfo()));
        HashMap<String, String> pvName2TypeInfoName = new HashMap<String, String>();

        HashMap<String, Appliance2PVs> valuesGatherer = new HashMap<String, Appliance2PVs>();
        Collection<ProjRecord> projRecords = configService.projectPVTypeInfos(new HashSet<String>(paddedPVNames), new GDATProjection());
        Map<String, ProjRecord> pvName2proj = projRecords.stream().collect(Collectors.toMap(pr -> pr.pvName(), pr -> pr));

        pmansProfiler.mark("After running projection");

        Map<String, List<ProjRecord>> appliance2Records =  projRecords.stream().collect(Collectors.groupingBy(p -> p.appliance()));
        for (ApplianceInfo applianceInfo : configService.getAppliancesInCluster()) {
            Appliance2PVs gatherer = new Appliance2PVs(applianceInfo);
            valuesGatherer.put(applianceInfo.getIdentity(), gatherer);
            List<ProjRecord> recsInAppliance = appliance2Records.getOrDefault(applianceInfo.getIdentity(), new LinkedList<ProjRecord>());
            LinkedList<String> mappedPVsFromAppliance = new LinkedList<String>();
            for(ProjRecord recInAppliance : recsInAppliance) {
                List<PVNameMapping> mappedNms = reverseMapping.get(recInAppliance.pvName);
                if(mappedNms != null && !mappedNms.isEmpty()) {
                    mappedPVsFromAppliance.addAll(mappedNms.stream().map(pnm -> pnm.nameFromRequest).toList());
                    mappedNms.forEach((pn -> pvName2TypeInfoName.put(pn.nameFromRequest, recInAppliance.pvName)));
                }
            }
            gatherer.pvsFromAppliance = mappedPVsFromAppliance;
        }

        List<CompletableFuture<Appliance2PVs>> pvBreakdownCalls = new LinkedList<CompletableFuture<Appliance2PVs>>();

        CompletableFuture.allOf(toArray(pvBreakdownCalls)).join();
        pmansProfiler.mark("After filtering calls.");

        List<CompletableFuture<Appliance2PVs>> engineCalls = new LinkedList<CompletableFuture<Appliance2PVs>>();
        try (var requests = new GetUrlContent.HttpRequests()) {
            for (ApplianceInfo applianceInfo : configService.getAppliancesInCluster()) {
                try {
                    engineCalls.add(CompletableFuture.supplyAsync(() -> {
                        return getDataFromEngine(valuesGatherer.get(applianceInfo.getIdentity()), atTime, requests);
                    }));
                } catch (Throwable t) {
                    logger.error("Exception adding completable future", t);
                }
            }
            awaitRetrievalCalls(CompletableFuture.allOf(toArray(engineCalls)), requests);
        }
        pmansProfiler.mark("After engine calls.");

        List<CompletableFuture<Appliance2PVs>> retrievalCalls = new LinkedList<CompletableFuture<Appliance2PVs>>();
        try (var requests = new GetUrlContent.HttpRequests()) {
            for (ApplianceInfo applianceInfo : configService.getAppliancesInCluster()) {
                try {
                    retrievalCalls.add(CompletableFuture.supplyAsync(() -> {
                        return getDataFromRetrieval(valuesGatherer.get(applianceInfo.getIdentity()), atTime, searchPeriod,
                                requests);
                    }));
                } catch (Throwable t) {
                    logger.error("Exception adding completable future", t);
                }
            }
            try {
                awaitRetrievalCalls(CompletableFuture.allOf(toArray(retrievalCalls)), requests);
            } catch (CompletionException ex) {
                if (ex.getCause() instanceof GetUrlContent.HttpStatusException failure) {
                    resp.reset();
                    resp.setStatus(failure.status());
                    if (failure.contentType() != null) resp.setContentType(failure.contentType());
                    resp.getOutputStream().write(failure.body());
                    return;
                }
                throw ex;
            }
        }
        pmansProfiler.mark("After retrieval calls.");

        HashMap<String, HashMap<String, Object>> ret = new HashMap<String, HashMap<String, Object>>();
        for (CompletableFuture<Appliance2PVs> retcl : retrievalCalls) {
            Appliance2PVs a2pv = retcl.get();
            ret.putAll(a2pv.pvValues);
        }

        ret.forEach((pvName, jsonval) -> { 
            String typeInfoName = pvName2TypeInfoName.get(pvName);
            if(typeInfoName != null) {
                ProjRecord projRec = pvName2proj.get(typeInfoName);
                MetaFields.addMetaFieldValue(jsonval, "DBRType", projRec.DBRType().toString());
            }
        });

        if (fetchFromExternalAppliances) {
            Map<String, String> externalServers = configService.getExternalArchiverDataServers();
            if (externalServers != null) {
                HashSet<String> remainingPVs = new HashSet<String>(pvNames);
                // We only has for PVs that we do not already have the answer for.
                remainingPVs.removeAll(ret.keySet());
                if (remainingPVs.size() > 0) {
                    List<CompletableFuture<HashMap<String, HashMap<String, Object>>>> proxyCalls =
                            new LinkedList<CompletableFuture<HashMap<String, HashMap<String, Object>>>>();
                    try (var requests = new GetUrlContent.HttpRequests()) {
                        for (String serverUrl : externalServers.keySet()) {
                            String index = externalServers.get(serverUrl);
                            if (index.equals("pbraw")) {
                                logger.debug("Adding external EPICS Archiver Appliance " + serverUrl);
                                proxyCalls.add(CompletableFuture.supplyAsync(() -> {
                                    return getDataFromRemoteArchApplicance(
                                            serverUrl + "/data/getDataAtTime",
                                            new LinkedList<String>(remainingPVs),
                                            atTime,
                                            requests);
                                }));
                            }
                        }
                        awaitRetrievalCalls(CompletableFuture.allOf(toArray(proxyCalls)), requests);
                    }
                    pmansProfiler.mark("After calls to remote appliances.");
                    for (CompletableFuture<HashMap<String, HashMap<String, Object>>> proxyCall : proxyCalls) {
                        HashMap<String, HashMap<String, Object>> res = proxyCall.get();
                        if (res != null && res.size() > 0) {
                            for (String proxyPv : res.keySet()) {
                                if (!ret.containsKey(proxyPv)) {
                                    logger.debug("Adding data for PV from external server " + proxyPv);
                                    ret.put(proxyPv, res.get(proxyPv));
                                }
                            }
                        }
                    }
                } else {
                    logger.debug("Not calling external servers as there are no PV's left in the request.");
                }
            }
        }

        writeResponse(resp, ret);

        logger.info("Retrieval time for " + pvNames.size() + " PVs at " + timeStr + pmansProfiler.toString());
    }

    private static class PVWithData {
        String pvName;
        HashMap<String, Object> sample;

        public PVWithData(String pvName, HashMap<String, Object> sample) {
            this.pvName = pvName;
            this.sample = sample;
        }
    }

    private static class GetDataPredicate implements Predicate<Event> {
        String pvName;
        Instant atTime;
        Instant stopAtTime;
        HashMap<String, Object> evnt;
        boolean pickedUpValue = false;
        public GetDataPredicate(String pvName, Instant atTime) {
            this.pvName = pvName;
            this.atTime = atTime;
            this.stopAtTime = atTime.minus(1, ChronoUnit.DAYS);
            evnt = new HashMap<String, Object>();
        }

        public boolean test(Event event) {
            RetrievalMemoryProtection.checkCurrent();
            DBRTimeEvent dbrEvent = (DBRTimeEvent) event;
            // We are cruising backwards in time.
            // At the first sample whose record processing timestamp is before or equal to the specified time, we pick up the value
            // After that, we collect all the metadata 
            // We stop after a days worth of iteration.
            if(dbrEvent.getEventTimeStamp().isBefore(atTime) || dbrEvent.getEventTimeStamp().equals(atTime)) {
                if(!pickedUpValue) {
                    pickedUpValue = true;
                    evnt.put("secs", dbrEvent.getEpochSeconds());
                    this.stopAtTime = dbrEvent.getEventTimeStamp().minus(1, ChronoUnit.DAYS);
                    evnt.put(
                            "nanos",
                            dbrEvent
                                    .getEventTimeStamp()
                                    .getNano());
                    evnt.put("severity", dbrEvent.getSeverity());
                    evnt.put("status", dbrEvent.getStatus());
                    evnt.put(
                            "val",
                            JSONValue.parse(dbrEvent
                                    .getSampleValue()
                                    .toJSONString()));
                }
                if(pickedUpValue) {
                    var evFields = dbrEvent.getFields();
                    if(evFields != null && !evFields.isEmpty()) {
                        for(String fieldName : evFields.keySet()) {
                            MetaFields.addMetaFieldValue(evnt, fieldName, evFields.get(fieldName));
                        }
                    }
                }
            }

            if(dbrEvent.getEventTimeStamp().isBefore(this.stopAtTime)) {
                logger.debug("Stopping iteration for {} at {}", this.pvName, TimeUtils.convertToHumanReadableString(dbrEvent.getEventTimeStamp()));
                return false;
            }

            return true;
        }
    }

    /**
     * Uses the Reader last-known-value contract for stores without reverse iteration.
     * Metadata is read from the preceding day; only the latest value of each field is retained.
     */
    private static void getDataFromForwardStore(BasicContext context, StoragePlugin storagePlugin,
            String pvName, Instant atTime, Period searchPeriod, GetDataPredicate result) throws Exception {
        List<Callable<EventStream>> streams = storagePlugin.getDataForPV(
                context, pvName, atTime, atTime, new DefaultRawPostProcessor());
        if (streams == null) return;
        Event latest = null;
        for (Callable<EventStream> callable : streams) {
            try (EventStream stream = callable.call()) {
                if (stream == null) continue;
                for (Event event : stream) {
                    RetrievalMemoryProtection.checkCurrent();
                    Instant timestamp = event.getEventTimeStamp();
                    if (!timestamp.isAfter(atTime)
                            && (latest == null || timestamp.isAfter(latest.getEventTimeStamp()))) {
                        latest = event.makeClone();
                    }
                }
            }
        }
        if (latest == null || latest.getEventTimeStamp().isBefore(atTime.minus(searchPeriod.plusDays(31)))) return;
        result.test(latest);

        Instant sampleTime = latest.getEventTimeStamp();
        Instant metadataStart = sampleTime.minus(1, ChronoUnit.DAYS);
        Map<String, Instant> fieldTimes = new HashMap<>();
        Map<String, String> fieldValues = new HashMap<>();
        streams = storagePlugin.getDataForPV(
                context, pvName, metadataStart, sampleTime, new DefaultRawPostProcessor());
        if (streams == null) return;
        for (Callable<EventStream> callable : streams) {
            try (EventStream stream = callable.call()) {
                if (stream == null) continue;
                for (Event event : stream) {
                    RetrievalMemoryProtection.checkCurrent();
                    Instant timestamp = event.getEventTimeStamp();
                    if (timestamp.isBefore(metadataStart) || timestamp.isAfter(sampleTime)) continue;
                    var fields = ((DBRTimeEvent) event).getFields();
                    if (fields == null) continue;
                    for (Map.Entry<String, String> field : fields.entrySet()) {
                        Instant previousTime = fieldTimes.get(field.getKey());
                        if (previousTime == null || timestamp.isAfter(previousTime)) {
                            fieldTimes.put(field.getKey(), timestamp);
                            fieldValues.put(field.getKey(), field.getValue());
                        }
                    }
                }
            }
        }
        fieldValues.forEach((name, value) -> MetaFields.addMetaFieldValue(result.evnt, name, value));
    }

    /**
     * Async method for getting data for a pv from its list of stores.
     * Walk thru the store till you find the closest sample before the requested time.
     * @param pvName
     * @param atTime
     * @param configService
     * @return
     */
    private static PVWithData getDataAtTimeForPVFromStores(String pvName, Instant atTime, Period searchPeriod, ConfigService configService) {
        return getDataAtTimeForPVFromStores(pvName, atTime, searchPeriod, configService,
                RetrievalMemoryProtection.currentCancellation());
    }

    private static PVWithData getDataAtTimeForPVFromStores(String pvName, Instant atTime, Period searchPeriod,
            ConfigService configService, RetrievalMemoryProtection.Cancellation cancelled) {
        try (RetrievalMemoryProtection.Request scope = configService.getRetrievalRuntimeState()
                .beginMemoryRequest(cancelled)) {
            RetrievalMemoryProtection.checkCurrentNow();
            PVWithData result = readDataAtTimeForPVFromStores(pvName, atTime, searchPeriod, configService);
            RetrievalMemoryProtection.checkCurrentNow();
            return result;
        }
    }

    private static PVWithData readDataAtTimeForPVFromStores(String pvName, Instant atTime, Period searchPeriod, ConfigService configService) {
        String nameFromUser = pvName;

        PVTypeInfo typeInfo = PVNames.determineAppropriatePVTypeInfo(pvName, configService);
        if (typeInfo == null) return null;
        if (!typeInfo.getApplianceIdentity()
                .equals(configService.getMyApplianceInfo().getIdentity())) return null;

        pvName = typeInfo.getPvName();

        // There is a separate bulk call for the engine; so we can skip the engine.
        // The stores of a PV are in the order of the data they hold, the shortest term first. The newest sample at or
        // before the instant is in the first store that holds one, so the search stops there. A store that cannot answer,
        // for example a file whose samples all come later than the instant, does not stop the search of the next store.
        List<String> datastores = new ArrayList<String>(Arrays.asList(typeInfo.getDataStores()));
        for (String store : datastores) {
            try {
                StoragePlugin storagePlugin = StoragePluginURLParser.parseStoragePlugin(store, configService);
                // Check to see if there is a named flag that turns off this data source.
                String namedFlagForSkippingDataSource = "SKIP_" + storagePlugin.getName() + "_FOR_RETRIEVAL";
                if(configService.getNamedFlag(namedFlagForSkippingDataSource)) {
                    logger.warn("Skipping " + storagePlugin.getName() + " as the named flag " + namedFlagForSkippingDataSource + " is set");
                    continue;
                }

                try (BasicContext context = new BasicContext()) {
                    if(storagePlugin instanceof BiDirectionalIterable) {
                        Instant startAtTime = atTime.plus(5, ChronoUnit.MINUTES);
                        GetDataPredicate thePredicate = new GetDataPredicate(pvName, atTime);
                        // The searchPeriod here is only to get enough chunks to facilitate the search. The iteration should stop at the specified time period.
                        ((BiDirectionalIterable)storagePlugin).iterate(context, pvName, startAtTime, thePredicate, IterationDirection.BACKWARDS, searchPeriod.plusDays(31));
                        if(thePredicate.pickedUpValue) {
                            return new PVWithData(nameFromUser, thePredicate.evnt);
                        }
                    } else {
                        GetDataPredicate thePredicate = new GetDataPredicate(pvName, atTime);
                        getDataFromForwardStore(context, storagePlugin, pvName, atTime, searchPeriod, thePredicate);
                        if (thePredicate.pickedUpValue) {
                            return new PVWithData(nameFromUser, thePredicate.evnt);
                        }
                    }
                }
            } catch (Exception ex) {
                if (ex instanceof RetrievalMemoryProtection.Rejected || RetrievalMemoryProtection.currentFailed()) {
                    throw RetrievalMemoryProtection.fail(ex);
                }
                logger.warn("Getting data at time for PV " + pvName + " from the store " + store + " failed with " + ex
                        + "; the next store is searched");
                logger.debug("Getting data at time for PV " + pvName + " from the store " + store, ex);
            }
        }

        return null;
    }

    /**
     * Get data at a specified time from the data stores for the specified set of PV's.
     * This only returns data for those PV's that are on this appliance.
     */
    public static void getDataAtTimeForAppliance(
            HttpServletRequest req, HttpServletResponse resp, ConfigService configService)
            throws ServletException, IOException, InterruptedException, ExecutionException {
        LinkedList<String> pvNames = PVsMatchingParameter.getPVNamesFromPostBody(req);
        String timeStr = req.getParameter("at");
        if (timeStr == null) {
            timeStr = TimeUtils.convertToISO8601String(TimeUtils.getCurrentEpochSeconds());
        }
        Instant atTime;
        try {
            atTime = TimeUtils.convertFromISO8601String(timeStr);
        } catch (IllegalArgumentException ex) {
            String msg = "Cannot parse time " + timeStr;
            logger.warn(msg, ex);
            resp.sendError(HttpServletResponse.SC_BAD_REQUEST, msg);
            return;
        }
        String searchPeriodStr = req.getParameter("searchPeriod");
        if(searchPeriodStr == null) {
            searchPeriodStr = "P1D";
        }
        Period searchPeriod = Period.parse(searchPeriodStr);


        logger.debug("Getting data from instance for " + pvNames.size() + " PVs at "
                + TimeUtils.convertToHumanReadableString(atTime));

        List<CompletableFuture<PVWithData>> retrievalCalls = new LinkedList<CompletableFuture<PVWithData>>();
        var cancelled = RetrievalMemoryProtection.currentCancellation();
        if (Thread.currentThread().isInterrupted()) cancelled.cancel();
        for (String pvName : pvNames) {
            retrievalCalls.add(CompletableFuture.supplyAsync(() -> {
                return getDataAtTimeForPVFromStores(pvName, atTime, searchPeriod, configService, cancelled);
            }));
        }

        var completed = CompletableFuture.allOf(toArray(retrievalCalls));
        try {
            completed.get();
        } catch (InterruptedException ex) {
            cancelled.cancel();
            // Wait for every worker to leave its scope before the servlet thread can be reused.
            completed.handle((result, failure) -> null).join();
            throw RetrievalMemoryProtection.fail(ex);
        } catch (ExecutionException ex) {
            throw RetrievalMemoryProtection.fail(ex);
        }
        RetrievalMemoryProtection.checkCurrentNow();
        HashMap<String, HashMap<String, Object>> ret = new HashMap<String, HashMap<String, Object>>();
        for (CompletableFuture<PVWithData> res : retrievalCalls) {
            PVWithData pd = res.get();
            if (pd != null) {
                ret.put(pd.pvName, pd.sample);
            }
        }

        writeResponse(resp, ret);
    }

    /** Leave a failed response open for the servlet's committed-error path to abort it. */
    private static void writeResponse(HttpServletResponse resp, Object value) throws IOException {
        RetrievalMemoryProtection.checkCurrentNow();
        PrintWriter out = resp.getWriter();
        JSONValue.writeJSONString(value, out);
        RetrievalMemoryProtection.checkCancellationNow();
        out.flush();
        RetrievalMemoryProtection.checkCancellationNow();
        out.close();
    }

    public static HashMap<String, HashMap<String, Object>> testGetDataAtTimeForPVFromStores(String pvName, Instant atTime, Period searchPeriod, ConfigService configService) {
        HashMap<String, HashMap<String, Object>> ret = new HashMap<String, HashMap<String, Object>>();
        PVWithData pd = getDataAtTimeForPVFromStores(pvName, atTime, searchPeriod, configService);
        ret.put(pd.pvName, pd.sample);
        return ret;
    }
}
