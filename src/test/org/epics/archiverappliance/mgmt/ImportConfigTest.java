package org.epics.archiverappliance.mgmt;

import org.epics.archiverappliance.TomcatSetup;
import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.epics.archiverappliance.mgmt.policy.PolicyConfig.SamplingMethod;
import org.epics.archiverappliance.utils.ui.GetUrlContent;
import org.epics.archiverappliance.utils.ui.JSONEncoder;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedList;

/**
 * Imports a configuration export that holds exactly one PV through the deployed mgmt BPL.
 * The export entry is produced by the same JSONEncoder that exportConfigForAppliance uses.
 */
@Tag("integration")
public class ImportConfigTest {
    private static final String PV_NAME = "test:import:onepv";

    TomcatSetup tomcatSetup = new TomcatSetup();

    @BeforeEach
    public void setUp() throws Exception {
        tomcatSetup.setUpWebApps(this.getClass().getSimpleName());
    }

    @AfterEach
    public void tearDown() throws Exception {
        tomcatSetup.tearDown();
    }

    @Test
    public void testImportOfOnePV() throws Exception {
        PVTypeInfo typeInfo = new PVTypeInfo(PV_NAME, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        typeInfo.setApplianceIdentity(ConfigServiceForTests.TESTAPPLIANCE0);
        typeInfo.setSamplingMethod(SamplingMethod.MONITOR);
        typeInfo.setSamplingPeriod(1.0f);
        typeInfo.setPaused(true);
        typeInfo.setDataStores(new String[] {
            "pb://localhost?name=STS&rootFolder=${ARCHAPPL_SHORT_TERM_FOLDER}&partitionGranularity=PARTITION_HOUR"
        });
        LinkedList<JSONObject> export = new LinkedList<JSONObject>();
        export.add(JSONEncoder.getEncoder(PVTypeInfo.class).encode(typeInfo));

        JSONArray importResponses = GetUrlContent.postDataAndGetContentAsJSONArray(
                ConfigServiceForTests.MGMT_URL + "/importConfig", export);
        Assertions.assertEquals(1, importResponses.size(), "One response per appliance in the export");

        JSONObject importedTypeInfo = GetUrlContent.getURLContentAsJSONObject(ConfigServiceForTests.MGMT_URL
                + "/getPVTypeInfo?pv=" + URLEncoder.encode(PV_NAME, StandardCharsets.UTF_8));
        Assertions.assertNotNull(importedTypeInfo, "The imported PV has a type info");
        Assertions.assertEquals(PV_NAME, importedTypeInfo.get("pvName"));

        JSONArray exported = GetUrlContent.getURLContentAsJSONArray(ConfigServiceForTests.MGMT_URL + "/exportConfig");
        Assertions.assertEquals(1, exported.size(), "The export holds the imported PV");
        Assertions.assertEquals(PV_NAME, ((JSONObject) exported.get(0)).get("pvName"));
    }
}
