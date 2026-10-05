package org.epics.archiverappliance.config.persistence;

import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.DefaultConfigService;
import org.epics.archiverappliance.config.exception.ConfigException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

/**
 * The persistence layer selection of the shipped DefaultConfigService, run through its own initialization method with
 * the layer named by the ARCHAPPL_PERSISTENCE_LAYER system property. A layer that is no longer shipped must stop the
 * initialization with a ConfigException that names it, and a shipped layer must initialize, so that a selection that
 * never ran cannot pass.
 */
public class RemovedPersistenceLayerTest {
    private static final String REMOVED_LAYER = "org.epics.archiverappliance.config.persistence.RedisPersistence";
    private static final String SHIPPED_LAYER = "org.epics.archiverappliance.config.persistence.InMemoryPersistence";
    private String previousProperty;
    private ConfigServiceForTests configService;

    @BeforeEach
    public void setUp() throws Exception {
        Assumptions.assumeTrue(
                System.getenv(ConfigService.ARCHAPPL_PERSISTENCE_LAYER) == null,
                "the environment variable takes precedence over the system property");
        previousProperty = System.getProperty(ConfigService.ARCHAPPL_PERSISTENCE_LAYER);
        configService = new ConfigServiceForTests(-1) {
            Class<?> persistenceLayerClass() {
                return persistanceLayer.getClass();
            }
        };
    }

    @AfterEach
    public void tearDown() throws Exception {
        if (previousProperty == null) {
            System.clearProperty(ConfigService.ARCHAPPL_PERSISTENCE_LAYER);
        } else {
            System.setProperty(ConfigService.ARCHAPPL_PERSISTENCE_LAYER, previousProperty);
        }
        configService.shutdownNow();
    }

    private void initializePersistenceLayer() throws Throwable {
        Method initialize = DefaultConfigService.class.getDeclaredMethod("initializePersistenceLayer");
        initialize.setAccessible(true);
        try {
            initialize.invoke(configService);
        } catch (InvocationTargetException ex) {
            throw ex.getCause();
        }
    }

    @Test
    public void aShippedLayerInitializes() throws Throwable {
        System.setProperty(ConfigService.ARCHAPPL_PERSISTENCE_LAYER, SHIPPED_LAYER);
        initializePersistenceLayer();
        Method layer = configService.getClass().getDeclaredMethod("persistenceLayerClass");
        layer.setAccessible(true);
        Assertions.assertEquals(SHIPPED_LAYER, ((Class<?>) layer.invoke(configService)).getName());
    }

    @Test
    public void aRemovedLayerStopsTheInitializationAndIsNamed() {
        System.setProperty(ConfigService.ARCHAPPL_PERSISTENCE_LAYER, REMOVED_LAYER);
        ConfigException failure = Assertions.assertThrows(ConfigException.class, this::initializePersistenceLayer);
        Assertions.assertTrue(failure.getMessage().contains(REMOVED_LAYER), failure.getMessage());
    }
}
