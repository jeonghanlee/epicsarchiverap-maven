package org.epics.archiverappliance.mgmt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.time.Instant;

import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.mgmt.archivepv.ArchivePVState;
import org.epics.archiverappliance.mgmt.archivepv.ArchivePVState.ArchivePVStateMachine;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * The hold of an archive request whose name no server answers, on the workflow runner of the management without an
 * engine: a request still gathering meta information is held once the hold time has passed since the engine was asked,
 * with the sentence of the reason, and its clock is cleared so that the abort check cannot act on it; a request asked
 * more recently, or not gathering, is left alone; a held request resumes from the start with an empty reason, and a
 * request that is not held cannot be resumed. The skip of a channel that connected within the last minute needs the
 * meta gets report of an engine and is exercised by the integration test of the hold, not here.
 */
public class HoldArchiveRequestStateTest {
    private static final String PV = "NO:SUCH:PV";
    private ConfigServiceForTests configService;

    @BeforeEach
    public void setUp() throws Exception {
        configService = new ConfigServiceForTests(-1);
    }

    @AfterEach
    public void tearDown() throws Exception {
        configService.shutdownNow();
    }

    @Test
    public void aRequestNoServerAnsweredIsHeldAfterTheHoldTime() throws Exception {
        MgmtRuntimeState runner = configService.getMgmtRuntimeState();
        int minutes = runner.getHoldArchiveRequestInMins();
        assertEquals(10, minutes, "the hold time is ten minutes by default");
        runner.startPVWorkflow(PV);
        ArchivePVState request = runner.getArchivePVState(PV);
        request.metaInfoRequestAcknowledged(Instant.now().minus(Duration.ofMinutes(minutes + 1)));

        runner.holdIfNoServerAnswered(request);

        assertEquals(ArchivePVStateMachine.HELD, request.getCurrentState());
        assertEquals("No server answered in 10 minutes", request.getHoldReason());
        assertNull(request.getMetaInfoRequestedSubmitted(), "the clock of the abort is cleared by the hold");
        assertTrue(runner.isPVInWorkflow(PV), "the held request stays in the workflow");
    }

    @Test
    public void aRequestAskedRecentlyOrNotGatheringIsLeftAlone() throws Exception {
        MgmtRuntimeState runner = configService.getMgmtRuntimeState();
        runner.startPVWorkflow(PV);
        ArchivePVState request = runner.getArchivePVState(PV);

        runner.holdIfNoServerAnswered(request);
        assertEquals(ArchivePVStateMachine.START, request.getCurrentState(), "a request not yet asked of the engine");

        request.metaInfoRequestAcknowledged(Instant.now().minus(Duration.ofMinutes(1)));
        runner.holdIfNoServerAnswered(request);
        assertEquals(ArchivePVStateMachine.METAINFO_GATHERING, request.getCurrentState(), "a request asked a minute ago");
        assertEquals("", request.getHoldReason());
    }

    @Test
    public void aHeldRequestResumesFromTheStart() throws Exception {
        MgmtRuntimeState runner = configService.getMgmtRuntimeState();
        runner.startPVWorkflow(PV);
        ArchivePVState request = runner.getArchivePVState(PV);
        assertFalse(runner.resumeArchiveRequest(PV), "a request that is not held cannot be resumed");
        request.metaInfoRequestAcknowledged(Instant.now().minus(Duration.ofMinutes(20)));
        runner.holdIfNoServerAnswered(request);
        assertEquals(ArchivePVStateMachine.HELD, request.getCurrentState());

        assertTrue(runner.resumeArchiveRequest(PV));

        assertEquals(ArchivePVStateMachine.START, request.getCurrentState());
        assertEquals("", request.getHoldReason());
        assertNull(request.getMetaInfoRequestedSubmitted());
        assertFalse(runner.resumeArchiveRequest("NOT:IN:WORKFLOW"), "no request, nothing to resume");
    }
}
