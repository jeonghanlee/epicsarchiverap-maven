/**
 * The pvAccess interface of the <code>mgmt</code> webapp. {@link org.epics.archiverappliance.mgmt.pva.PvaServlet},
 * registered in the mgmt web.xml, starts a PVA server that serves the RPC PV <code>pvaMgmtService</code>, and
 * {@link org.epics.archiverappliance.mgmt.pva.PvaMgmtService} hands each request, an NTURI or an NTTable, to the
 * action of the same name in the <code>actions</code> package: list all PVs, report the appliance, archive PVs, list
 * the archived PVs and report the status of PVs.
 *
 * @author Kunal Shroff
 */
package org.epics.archiverappliance.mgmt.pva;
