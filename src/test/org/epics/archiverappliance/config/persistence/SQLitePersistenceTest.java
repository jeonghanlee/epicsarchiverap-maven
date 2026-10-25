package org.epics.archiverappliance.config.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Hashtable;
import java.util.List;

import javax.naming.Context;
import javax.naming.spi.InitialContextFactory;
import javax.sql.DataSource;

import org.epics.archiverappliance.config.ArchDBRTypes;
import org.epics.archiverappliance.config.PVTypeInfo;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Exercises the SQLite branch of MySQLPersistence end to end against the real
 * sqlite-jdbc driver (runtime scope). A file-backed SQLite database is bound
 * into JNDI under jdbc/archappl exactly where the persistence layer looks it
 * up, the shipped archappl_sqlite.sql schema is applied, and PVTypeInfo is
 * round-tripped through the real put/get/delete SQL. A successful put proves
 * the SQLite dialect was selected: the SQLite path emits ON CONFLICT syntax
 * that the MySQL path (ON DUPLICATE KEY UPDATE) would not.
 */
public class SQLitePersistenceTest {

    private static final Path SCHEMA_PATH =
            Path.of("src/main/org/epics/archiverappliance/config/persistence/archappl_sqlite.sql");
    private static final String APPLIANCE = "appliance0";

    private static Path dbFile;
    static String jdbcUrl;

    @BeforeAll
    public static void setupDatabase() throws Exception {
        dbFile = Files.createTempFile("sqlite-persistence-test", ".db");
        Files.deleteIfExists(dbFile);
        jdbcUrl = "jdbc:sqlite:" + dbFile.toAbsolutePath();

        // JDBC 4 auto-registration usually suffices; load explicitly as a fallback.
        try {
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException ignored) {
            // The ServiceLoader registration will still apply.
        }

        assertTrue(Files.exists(SCHEMA_PATH), "Schema file must exist at " + SCHEMA_PATH.toAbsolutePath());
        String schema = Files.readString(SCHEMA_PATH, StandardCharsets.UTF_8);
        try (Connection conn = DriverManager.getConnection(jdbcUrl);
                Statement stmt = conn.createStatement()) {
            for (String statement : splitStatements(schema)) {
                stmt.execute(statement);
            }
        }

        System.setProperty(Context.INITIAL_CONTEXT_FACTORY, TestContextFactory.class.getName());
    }

    @AfterAll
    public static void teardown() throws Exception {
        System.clearProperty(Context.INITIAL_CONTEXT_FACTORY);
        if (dbFile != null) {
            Files.deleteIfExists(dbFile);
        }
    }

    @Test
    public void sqlitePersistenceRoundTrip() throws Exception {
        MySQLPersistence persistence = new MySQLPersistence();

        String pvName = "TEST:sqlite:pv1";
        PVTypeInfo typeInfo = new PVTypeInfo(pvName, ArchDBRTypes.DBR_SCALAR_DOUBLE, true, 1);
        typeInfo.setApplianceIdentity(APPLIANCE);

        persistence.putTypeInfo(pvName, typeInfo);

        assertTrue(persistence.getTypeInfoKeys().contains(pvName), "Stored PV must appear in the key listing");

        PVTypeInfo readBack = persistence.getTypeInfo(pvName);
        assertNotNull(readBack, "getTypeInfo must return the stored PVTypeInfo");
        assertEquals(pvName, readBack.getPvName(), "PV name must survive the round trip");
        assertEquals(APPLIANCE, readBack.getApplianceIdentity(), "Appliance identity must survive the round trip");

        assertEquals(
                1,
                persistence.getAllTypeInfosForAppliance(APPLIANCE).size(),
                "The appliance query (JSON_EXTRACT on SQLite) must return the stored PV");

        persistence.deleteTypeInfo(pvName);
        assertTrue(persistence.getTypeInfoKeys().isEmpty(), "The key listing must be empty after deletion");
    }

    /**
     * Splits a SQL script into individual statements, keeping a CREATE TRIGGER
     * body (BEGIN ... END;) as one statement rather than breaking on the inner
     * semicolons.
     */
    private static List<String> splitStatements(String script) {
        List<String> statements = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int blockDepth = 0;
        for (String line : script.split("\n")) {
            String trimmed = line.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            current.append(line).append("\n");
            String upper = trimmed.toUpperCase();
            if (upper.equals("BEGIN")) {
                blockDepth++;
            } else if (upper.startsWith("END")) {
                blockDepth--;
            }
            if (blockDepth <= 0 && trimmed.endsWith(";")) {
                statements.add(current.toString());
                current.setLength(0);
                blockDepth = 0;
            }
        }
        return statements;
    }

    /** Supplies an InitialContext whose lookups resolve the SQLite DataSource. */
    public static class TestContextFactory implements InitialContextFactory {
        @Override
        public Context getInitialContext(Hashtable<?, ?> environment) {
            ClassLoader loader = TestContextFactory.class.getClassLoader();
            DataSource dataSource = (DataSource) Proxy.newProxyInstance(
                    loader, new Class<?>[] {DataSource.class}, new DataSourceHandler());
            return (Context) Proxy.newProxyInstance(
                    loader, new Class<?>[] {Context.class}, new ContextHandler(dataSource));
        }
    }

    /** Resolves java:/comp/env to itself and jdbc/archappl to the DataSource. */
    private static class ContextHandler implements InvocationHandler {
        private final DataSource dataSource;

        ContextHandler(DataSource dataSource) {
            this.dataSource = dataSource;
        }

        @Override
        public Object invoke(Object proxy, Method method, Object[] args) {
            if ("lookup".equals(method.getName()) && args != null && args.length == 1 && args[0] instanceof String) {
                String name = (String) args[0];
                if ("java:/comp/env".equals(name)) {
                    return proxy;
                }
                return dataSource;
            }
            return defaultValue(method);
        }
    }

    /** Returns a real connection to the file-backed SQLite database. */
    private static class DataSourceHandler implements InvocationHandler {
        @Override
        public Object invoke(Object proxy, Method method, Object[] args) throws Exception {
            if ("getConnection".equals(method.getName())) {
                return DriverManager.getConnection(jdbcUrl);
            }
            return defaultValue(method);
        }
    }

    private static Object defaultValue(Method method) {
        Class<?> returnType = method.getReturnType();
        if (returnType == boolean.class) {
            return false;
        }
        if (returnType == int.class || returnType == long.class || returnType == short.class) {
            return 0;
        }
        return null;
    }
}
