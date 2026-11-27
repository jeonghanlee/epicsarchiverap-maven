package org.epics.archiverappliance.mgmt;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.DefaultConfigService;
import org.epics.archiverappliance.mgmt.policy.ExecutePolicy;
import org.epics.archiverappliance.mgmt.policy.PolicyConfig;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;

public class PolicyExecutionTest {
    /** The two policies files that every test of the chosen policy runs against: the shipped one and the test one. */
    private static final String SHIPPED_POLICIES = "src/sitespecific/default/classpathfiles/policies.py";

    private static final String TEST_POLICIES = "src/sitespecific/tests/classpathfiles/policies.py";

    Logger logger = LogManager.getLogger(PolicyExecutionTest.class);

    /**
     * A test configuration that hands over the named policies file. The test configuration otherwise reads the
     * policies.py of the classpath and ignores ARCHAPPL_POLICIES, so a test of a named file has to give it here.
     */
    private static DefaultConfigService configServiceReading(String policiesFile) throws Exception {
        return new ConfigServiceForTests(-1) {
            @Override
            public InputStream getPolicyText() throws IOException {
                return new FileInputStream(policiesFile);
            }
        };
    }

    @Test
    public void testSimplePolicyExecution() throws Exception {
        DefaultConfigService configService = new ConfigServiceForTests(-1);
        HashMap<String, Object> pvInfo = new HashMap<String, Object>();
        pvInfo.put("eventRate", 1.0f);
        pvInfo.put("storageRate", 1.0f);
        pvInfo.put("RTYP", "ai");
        try (ExecutePolicy executePolicy = new ExecutePolicy(configService)) {
            PolicyConfig policyConfig = executePolicy.computePolicyForPV("test", pvInfo);
            Assertions.assertNotNull(policyConfig, "policyConfig is null");
            Assertions.assertTrue(
                    policyConfig.getDataStores() != null && policyConfig.getDataStores().length > 1,
                    "dataStores is null");
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {SHIPPED_POLICIES, TEST_POLICIES})
    public void testPolicyOverrideReportsItsOwnName(String policiesFile) throws Exception {
        DefaultConfigService configService = configServiceReading(policiesFile);
        HashMap<String, Object> pvInfo = new HashMap<String, Object>();
        pvInfo.put("pvName", "test:policy:override");
        pvInfo.put("eventRate", 1.0f);
        pvInfo.put("storageRate", 1.0f);
        pvInfo.put("RTYP", "ai");
        pvInfo.put("policyName", "3DaysMTSOnly");
        try (ExecutePolicy executePolicy = new ExecutePolicy(configService)) {
            PolicyConfig policyConfig = executePolicy.computePolicyForPV("test:policy:override", pvInfo);
            Assertions.assertEquals("3DaysMTSOnly", policyConfig.getPolicyName());
            Assertions.assertEquals(3, policyConfig.getDataStores().length);
            Assertions.assertTrue(policyConfig.getDataStores()[2].startsWith("blackhole://"));
        }
    }

    /**
     * Runs the named policies file for one PV with the given inputs, as the archive request passes them; a null rate is
     * left out of the inputs.
     */
    private static PolicyConfig policyFor(
            String policiesFile, String pvName, Double eventRate, Double storageRate, String policyName)
            throws Exception {
        DefaultConfigService configService = configServiceReading(policiesFile);
        HashMap<String, Object> pvInfo = new HashMap<String, Object>();
        if (eventRate != null) pvInfo.put("eventRate", eventRate);
        if (storageRate != null) pvInfo.put("storageRate", storageRate);
        if (policyName != null) pvInfo.put("policyName", policyName);
        try (ExecutePolicy executePolicy = new ExecutePolicy(configService)) {
            return executePolicy.computePolicyForPV(pvName, pvInfo);
        }
    }

    private static void assertPolicy(String name, float period, PolicyConfig policyConfig, String inputs) {
        Assertions.assertEquals(name, policyConfig.getPolicyName(), inputs);
        Assertions.assertEquals(period, policyConfig.getSamplingPeriod(), 1e-6f, inputs);
    }

    /** The event rate measured at the archive request selects 2HzPVs above 2 per second, with a period of 0.1 s. */
    @ParameterizedTest
    @ValueSource(strings = {SHIPPED_POLICIES, TEST_POLICIES})
    public void testPolicyChosenByTheEventRate(String policiesFile) throws Exception {
        assertPolicy("Default", 1.0f, policyFor(policiesFile, "test:rate", 2.0, 1.0, null), "rate 2.0");
        assertPolicy("2HzPVs", 0.1f, policyFor(policiesFile, "test:rate", 2.5, 1.0, null), "rate 2.5");
    }

    /**
     * A name that starts with BPMS above 35 bytes per second selects BPMS, with the period of 1.0 s of the other
     * policies; another name at the same storage rate does not.
     */
    @ParameterizedTest
    @ValueSource(strings = {SHIPPED_POLICIES, TEST_POLICIES})
    public void testBpmsChosenByTheStorageRate(String policiesFile) throws Exception {
        assertPolicy("BPMS", 1.0f, policyFor(policiesFile, "BPMS:test", 1.0, 36.0, null), "storage rate 36");
        assertPolicy("Default", 1.0f, policyFor(policiesFile, "BPMS:test", 1.0, 34.0, null), "storage rate 34");
        assertPolicy("Default", 1.0f, policyFor(policiesFile, "BPM:test", 1.0, 36.0, null),
                "storage rate 36 without the BPMS prefix");
    }

    /** A policy chosen by its name keeps that name and its period. */
    @ParameterizedTest
    @ValueSource(strings = {SHIPPED_POLICIES, TEST_POLICIES})
    public void testPolicyChosenByItsName(String policiesFile) throws Exception {
        assertPolicy("2HzPVs", 0.1f, policyFor(policiesFile, "test:name", 1.0, 1.0, "2HzPVs"), "2HzPVs");
        assertPolicy("BPMS", 1.0f, policyFor(policiesFile, "test:name", 1.0, 1.0, "BPMS"), "BPMS");
        assertPolicy(
                "3DaysMTSOnly", 1.0f, policyFor(policiesFile, "test:name", 1.0, 1.0, "3DaysMTSOnly"), "3DaysMTSOnly");
        assertPolicy("Default", 1.0f, policyFor(policiesFile, "test:name", 1.0, 1.0, "Default"), "Default");
    }

    /**
     * The retrieval looks up the stores of a PV that is not archived with the name, an empty policy name and an event
     * rate of 1.0 only; the policies answer it without reading another input.
     */
    @ParameterizedTest
    @ValueSource(strings = {SHIPPED_POLICIES, TEST_POLICIES})
    public void testInputOfTheRetrievalLookup(String policiesFile) throws Exception {
        PolicyConfig policyConfig = policyFor(policiesFile, "test:retrieval", 1.0, null, "");
        assertPolicy("Default", 1.0f, policyConfig, "retrieval lookup");
        Assertions.assertEquals(3, policyConfig.getDataStores().length);
    }

    @Test
    public void testForLeaks() throws Exception {
        DefaultConfigService configService = new ConfigServiceForTests(-1);
        for (int i = 0; i < 10000; i++) {
            HashMap<String, Object> pvInfo = new HashMap<String, Object>();
            pvInfo.put("eventRate", 1.0f);
            pvInfo.put("storageRate", 1.0f);
            pvInfo.put("RTYP", "ai");
            try (ExecutePolicy executePolicy = new ExecutePolicy(configService)) {
                PolicyConfig policyConfig = executePolicy.computePolicyForPV("test" + i, pvInfo);
                Assertions.assertNotNull(policyConfig, "policyConfig is null");
                Assertions.assertTrue(
                        policyConfig.getDataStores() != null && policyConfig.getDataStores().length > 1,
                        "dataStores is null");
            }
        }
    }
}
