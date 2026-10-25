package org.epics.archiverappliance;

import java.util.Properties;

import org.junit.jupiter.api.extension.AfterAllCallback;
import org.junit.jupiter.api.extension.AfterEachCallback;
import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.BeforeEachCallback;
import org.junit.jupiter.api.extension.ExtensionContext;

/**
 * Restores appliance overrides after each test and test class, including setup and teardown.
 * Tests run sequentially because these overrides are process-wide.
 */
public final class ArchapplPropertiesExtension
        implements BeforeAllCallback, AfterAllCallback, BeforeEachCallback, AfterEachCallback {
    private static final String PROPERTY_PREFIX = "ARCHAPPL_";
    private static final ExtensionContext.Namespace NAMESPACE =
            ExtensionContext.Namespace.create(ArchapplPropertiesExtension.class);

    @Override
    public void beforeAll(ExtensionContext context) {
        save(context);
    }

    @Override
    public void beforeEach(ExtensionContext context) {
        save(context);
    }

    @Override
    public void afterEach(ExtensionContext context) {
        restore(context);
    }

    @Override
    public void afterAll(ExtensionContext context) {
        restore(context);
    }

    private static void save(ExtensionContext context) {
        Properties snapshot = new Properties();
        Properties properties = System.getProperties();
        synchronized (properties) {
            properties.forEach((key, value) -> {
                if (isArchapplProperty(key)) {
                    snapshot.put(key, value);
                }
            });
        }
        context.getStore(NAMESPACE).put(context.getUniqueId(), snapshot);
    }

    private static void restore(ExtensionContext context) {
        Properties snapshot = context.getStore(NAMESPACE).remove(context.getUniqueId(), Properties.class);
        if (snapshot == null) {
            return;
        }
        Properties properties = System.getProperties();
        synchronized (properties) {
            properties.keySet().removeIf(ArchapplPropertiesExtension::isArchapplProperty);
            properties.putAll(snapshot);
        }
    }

    private static boolean isArchapplProperty(Object key) {
        return key instanceof String && ((String) key).startsWith(PROPERTY_PREFIX);
    }
}
