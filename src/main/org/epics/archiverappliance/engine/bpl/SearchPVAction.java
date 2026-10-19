package org.epics.archiverappliance.engine.bpl;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.LinkedHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.common.BPLAction;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.PVNames;
import org.epics.archiverappliance.data.DBRTimeEvent;
import org.epics.archiverappliance.engine.pv.PV;
import org.epics.archiverappliance.engine.pv.PVFactory;
import org.epics.archiverappliance.engine.pv.PVListener;
import org.epics.archiverappliance.utils.ui.MimeTypeConstants;
import org.json.simple.JSONValue;

/**
 * Searches one complete PV name on the control system network, over Channel Access or PV Access as the name and the
 * default protocol decide, and answers whether a server holds it. The search opens a channel of its own, waits for the
 * connection and for the first value (which carries the type) up to the timeout, and closes the channel again; nothing
 * is archived and the channels of the archived PVs are not touched. The answer is one JSON object: pvName, found,
 * protocol (CA or PVA), type (the ArchDBRTypes name, when the first value arrived in time), host (Channel Access only;
 * a PV Access channel reports none) and elapsedMs. The timeout is a request parameter in seconds, five by default and
 * at most thirty, since the search holds a request thread of the engine for that long.
 */
public class SearchPVAction implements BPLAction {
    private static final Logger logger = LogManager.getLogger(SearchPVAction.class);

    public static final int DEFAULT_TIMEOUT_SECONDS = 5;
    public static final int MAX_TIMEOUT_SECONDS = 30;
    private static final String DEFAULT_PROTOCOL_KEY = "org.epics.archiverappliance.mgmt.bpl.ArchivePVAction.defaultAccessProtocol";

    @Override
    public void execute(HttpServletRequest req, HttpServletResponse resp, ConfigService configService) throws IOException {
        String requestedName = req.getParameter("pv");
        if (requestedName == null || requestedName.isEmpty()) {
            resp.sendError(HttpServletResponse.SC_BAD_REQUEST, "The parameter pv is missing");
            return;
        }
        int timeoutSeconds = timeoutOf(req.getParameter("timeout"));
        String defaultProtocol = configService.getInstallationProperties().getProperty(DEFAULT_PROTOCOL_KEY, "CA");
        boolean usePVAccess = usePVAccess(requestedName, defaultProtocol);
        String pvName = PVNames.stripPrefixFromName(requestedName);

        LinkedHashMap<String, Object> answer = new LinkedHashMap<>();
        answer.put("pvName", requestedName);
        answer.put("protocol", usePVAccess ? "PVA" : "CA");
        long startNanos = System.nanoTime();
        CountDownLatch connected = new CountDownLatch(1);
        CountDownLatch valued = new CountDownLatch(1);
        PV pv = null;
        try {
            int jcaCommandThreadId = configService.getEngineContext().assignJCACommandThread(pvName, null);
            pv = PVFactory.createPV(pvName, configService, jcaCommandThreadId, usePVAccess);
            pv.addListener(new PVListener() {
                @Override
                public void pvConnectionRequestMade(PV pv) {}

                @Override
                public void pvConnected(PV pv) {
                    connected.countDown();
                }

                @Override
                public void pvDisconnected(PV pv) {}

                @Override
                public void pvValueUpdate(PV pv, DBRTimeEvent ev) {
                    valued.countDown();
                }

                @Override
                public void sampleDroppedTypeChange(PV pv, ArchDBRTypes newDBRType) {}
            });
            pv.start();
            long deadlineNanos = startNanos + TimeUnit.SECONDS.toNanos(timeoutSeconds);
            boolean found = connected.await(timeoutSeconds, TimeUnit.SECONDS);
            answer.put("found", found);
            if (found) {
                // The type travels with the first value; it is waited for within the same timeout.
                long leftNanos = Math.max(0, deadlineNanos - System.nanoTime());
                valued.await(leftNanos, TimeUnit.NANOSECONDS);
                ArchDBRTypes type = pv.getArchDBRTypes();
                if (type == null && pv.getTotalMetaInfo() != null) {
                    type = pv.getTotalMetaInfo().getArchDBRTypes();
                }
                if (type != null) {
                    answer.put("type", type.name());
                }
                String host = pv.getHostName();
                if (!usePVAccess && host != null && !host.isEmpty()) {
                    answer.put("host", host);
                }
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            answer.put("found", false);
        } catch (Exception ex) {
            logger.error("Exception searching for PV " + requestedName, ex);
            answer.put("found", false);
            answer.put("error", String.valueOf(ex.getMessage()));
        } finally {
            if (pv != null) {
                try {
                    pv.stop();
                } catch (Exception ex) {
                    logger.warn("Exception closing the search channel of " + requestedName, ex);
                }
            }
        }
        answer.put("elapsedMs", (System.nanoTime() - startNanos) / 1_000_000);
        resp.setContentType(MimeTypeConstants.APPLICATION_JSON);
        try (PrintWriter out = resp.getWriter()) {
            out.println(JSONValue.toJSONString(answer));
        }
    }

    /** The timeout of the request in seconds: the default when absent or unreadable, never above the maximum or below one. */
    static int timeoutOf(String parameter) {
        if (parameter == null || parameter.isEmpty()) {
            return DEFAULT_TIMEOUT_SECONDS;
        }
        try {
            int seconds = (int) Math.ceil(Double.parseDouble(parameter));
            return Math.max(1, Math.min(MAX_TIMEOUT_SECONDS, seconds));
        } catch (NumberFormatException ex) {
            return DEFAULT_TIMEOUT_SECONDS;
        }
    }

    /** The protocol of a name: pva:// and ca:// decide, and a plain name takes the default of the installation. */
    static boolean usePVAccess(String pvName, String defaultProtocol) {
        PVNames.EPICSVersion version = PVNames.pvNameVersion(pvName);
        switch (version) {
            case V3:
                return false;
            case V4:
                return true;
            default:
                return "PVA".equals(defaultProtocol);
        }
    }
}
