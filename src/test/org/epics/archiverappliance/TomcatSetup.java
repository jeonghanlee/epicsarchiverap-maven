/*******************************************************************************
 * Copyright (c) 2011 The Board of Trustees of the Leland Stanford Junior University
 * as Operator of the SLAC National Accelerator Laboratory.
 * Copyright (c) 2011 Brookhaven National Laboratory.
 * EPICS archiver appliance is distributed subject to a Software License Agreement found
 * in file LICENSE that is included with this distribution.
 *******************************************************************************/
package org.epics.archiverappliance;


import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.config.ConfigServiceForTests;
import org.epics.archiverappliance.config.DefaultConfigService;
import org.epics.archiverappliance.config.persistence.InMemoryPersistence;
import org.epics.archiverappliance.config.persistence.JDBM2Persistence;

import javax.management.MBeanServerConnection;
import javax.management.ObjectName;
import javax.management.remote.JMXConnector;
import javax.management.remote.JMXConnectorFactory;
import javax.management.remote.JMXServiceURL;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Setup Tomcat without having to import all the tomcat jars into your project.
 * @author mshankar
 *
 */
public class TomcatSetup {
	private static final Logger logger = LogManager.getLogger(TomcatSetup.class.getName());
	private static final int STARTUP_TIMEOUT_SECONDS = 120;
	private static final int SHUTDOWN_TIMEOUT_SECONDS = 15;
	private static final int FORCED_SHUTDOWN_TIMEOUT_SECONDS = 5;
	private static final File TEST_PROPERTIES_FILE = new File("src/sitespecific/tests/classpathfiles/archappl.properties");
	LinkedList<Process> watchedProcesses = new LinkedList<Process>();
	LinkedList<File> cleanupFolders = new LinkedList<File>();
	// The child Tomcat and the last lines of its console, by the name of the appliance that it runs.
	final Map<String, Process> processesByAppliance = new LinkedHashMap<>();
	private final Map<String, ConcurrentLinkedDeque<String>> consoleByAppliance = new ConcurrentHashMap<>();
	private final Map<String, Integer> jmxPortsByAppliance = new ConcurrentHashMap<>();
	private static final int CONSOLE_LINES_KEPT = 5000;
	/**
	 * With -Darchappl.fixture.sampleBusyThreads=true every Tomcat that the fixture starts opens JMX and a sampler reads
	 * currentThreadsBusy of its connector every 200 ms; tearDown appends the largest value to
	 * target/busy-threads.tsv. It is how the busy threads of a whole run of the integration set are measured.
	 */
	private static final boolean SAMPLE_BUSY_THREADS = Boolean.getBoolean("archappl.fixture.sampleBusyThreads");
	private static final long BUSY_SAMPLE_INTERVAL_MILLIS = 200;
	private static final Path BUSY_THREADS_FILE = Path.of(System.getProperty("archappl.fixture.busyThreadsFile", "target/busy-threads.tsv"));
	private final Map<String, BusySampler> samplersByAppliance = new ConcurrentHashMap<>();
	private final Map<String, String> testNamesByAppliance = new ConcurrentHashMap<>();
	// Set before a setUp method; they apply to every Tomcat that the setUp method starts.
	private final List<String> extraJvmOptions = new ArrayList<>();
	private final Map<String, String> extraEnvironment = new java.util.HashMap<>();
	private Integer engineBackgroundProcessorDelaySeconds = null;
	private boolean jmxEnabled = false;
	private boolean productionConfig = false;
	protected static final int DEFAULT_SERVER_STARTUP_PORT = 16000;
	// Set once tearDown starts, so the log-reader threads treat the resulting closed streams as
	// an expected shutdown rather than a read error.
	private volatile boolean stopping = false;
	// The setups that have started a Tomcat and not stopped it. A test that fails before its own tearDown leaves its
	// setup here; the next setup stops it, and the end of the JVM stops whatever is left.
	private static final Set<TomcatSetup> RUNNING = ConcurrentHashMap.newKeySet();

	static {
		Runtime.getRuntime().addShutdownHook(new Thread(() -> {
			for (TomcatSetup left : RUNNING) {
				try {
					left.tearDown();
				} catch (Exception ex) {
					System.err.println("Could not stop a Tomcat left running: " + ex);
				}
			}
		}, "TomcatSetup-shutdown"));
	}

	private static void overrideEnvWithSystemProperty(Map<String, String> environment, String key) {
		if (System.getProperties().containsKey(key)) {
			String value = (String) System.getProperties().get(key);
			logger.debug("Overriding " + key + " from the system properties " + value);
			environment.put(key, value);
		}

	}


	/**
	 * Adds JVM options to the CATALINA_OPTS of every Tomcat that a later setUp method starts: a heap such as
	 * -Xmx256m, the options of the first protection layer, or system properties such as the concurrency and the
	 * thresholds of a valve whose attributes read ${name:-default} in the context.xml of a WAR. Call it before the
	 * setUp method.
	 */
	public TomcatSetup withJvmOptions(String... options) {
		extraJvmOptions.addAll(List.of(options));
		return this;
	}

	/** Sets process-local environment overrides for an isolated test server. */
	public TomcatSetup withEnvironment(Map<String, String> values) {
		extraEnvironment.putAll(values);
		return this;
	}

	/** Uses the normal startup configuration without the sample retrieval implementation. */
	public TomcatSetup withProductionConfig() {
		productionConfig = true;
		return this;
	}

	/**
	 * Sets the backgroundProcessorDelay, in seconds, of the Engine in the generated server.xml. Tomcat runs the
	 * background processing of its containers and valves, such as the detection of a stuck thread, at this interval;
	 * its default is 10 seconds. Call it before the setUp method.
	 */
	public TomcatSetup withEngineBackgroundProcessorDelay(int seconds) {
		this.engineBackgroundProcessorDelaySeconds = seconds;
		return this;
	}

	/**
	 * Opens JMX on a free loopback port of every Tomcat that a later setUp method starts, without authentication or
	 * SSL, so that a test can read the beans of the child JVM with currentThreadsBusy. Call it before the setUp method.
	 */
	public TomcatSetup withJmx() {
		this.jmxEnabled = true;
		return this;
	}

	/**
	 * The exit status of the Tomcat of an appliance, or null while it runs.
	 */
	public Integer exitStatus(String applianceName) {
		Process process = processesByAppliance.get(applianceName);
		if (process == null) throw new IllegalArgumentException("No Tomcat was started for the appliance " + applianceName);
		return process.isAlive() ? null : process.exitValue();
	}

	/**
	 * Waits until the Tomcat of an appliance has ended and returns its exit status, or null on timeout.
	 */
	public Integer waitForExit(String applianceName, long timeout, TimeUnit unit) throws InterruptedException {
		Process process = processesByAppliance.get(applianceName);
		if (process == null) throw new IllegalArgumentException("No Tomcat was started for the appliance " + applianceName);
		return process.waitFor(timeout, unit) ? process.exitValue() : null;
	}

	/**
	 * The lines of the console of an appliance that were read, the last 5000 at most. The reader keeps reading after the
	 * Tomcat has ended, so the last lines of a JVM that ended on an OutOfMemoryError are included.
	 */
	public List<String> consoleLines(String applianceName) {
		ConcurrentLinkedDeque<String> lines = consoleByAppliance.get(applianceName);
		return lines == null ? List.of() : new ArrayList<>(lines);
	}

	/**
	 * The loopback port of the JMX of the Tomcat of an appliance. Needs withJmx().
	 */
	public int jmxPort(String applianceName) {
		Integer port = jmxPortsByAppliance.get(applianceName);
		if (port == null) throw new IllegalStateException("JMX is not open for the appliance " + applianceName + "; call withJmx() before the setUp method");
		return port;
	}

	/**
	 * The number of threads of the HTTP connector of an appliance that are serving a request now, read over JMX
	 * (currentThreadsBusy of the ThreadPool bean). The Tomcat of the fixture runs the four web applications of the
	 * appliance in one JVM, so this is the sum over them. Needs withJmx().
	 */
	public int currentThreadsBusy(String applianceName) throws Exception {
		int port = jmxPort(applianceName);
		JMXServiceURL url = new JMXServiceURL("service:jmx:rmi:///jndi/rmi://127.0.0.1:" + port + "/jmxrmi");
		try (JMXConnector connector = JMXConnectorFactory.connect(url)) {
			MBeanServerConnection connection = connector.getMBeanServerConnection();
			Set<ObjectName> pools = connection.queryNames(new ObjectName("Catalina:type=ThreadPool,name=\"http-nio-*\""), null);
			if (pools.size() != 1) throw new IllegalStateException("Expected one HTTP thread pool bean, found " + pools);
			return ((Number) connection.getAttribute(pools.iterator().next(), "currentThreadsBusy")).intValue();
		}
	}

	/**
	 * Set up an individual tomcat with the webapps loaded.
	 * We create a work folder appropriate for the test; create the webapps/logs/conf folders and then call catalina.sh run.
	 * @throws Exception
	 */
	public void setUpWebApps(String testName) throws Exception {
		initialSetup(testName);
		AppliancesXMLGenerator.ApplianceXMLConfig applianceXMLConfig = new AppliancesXMLGenerator.ApplianceXMLConfig(testName, 1);
		Path xml = applianceXMLConfig.writeAppliancesXML();
		AppliancesXMLGenerator.AppliancePorts ports = applianceXMLConfig.appliancePortsList().get(0);
		createAndStartTomcatInstance(testName, ports.identity(), ports.retrievalPort(), ports.serverStartUpPort(), xml);
	}

	/**
	 * Set up a cluster of tomcat instances.
	 * Note that these are NOT clustered using tomcat's clustering technology (which is geared towards session replication and the such).
	 * @param clusterCount
	 * @throws Exception
	 */
	public void setUpClusterWithWebApps(String testName, int clusterCount) throws Exception {
		initialSetup(testName);
		AppliancesXMLGenerator.ApplianceXMLConfig applianceXMLConfig = new AppliancesXMLGenerator.ApplianceXMLConfig(testName, clusterCount);
		Path xml = applianceXMLConfig.writeAppliancesXML();
		for (AppliancesXMLGenerator.AppliancePorts appliancePorts : applianceXMLConfig.appliancePortsList()) {
			logger.info(String.format("Starting up %s", appliancePorts.identity()));
			createAndStartTomcatInstance(testName, appliancePorts.identity(), appliancePorts.retrievalPort(), appliancePorts.serverStartUpPort(), xml);
			logger.info(String.format("Done starting up %s", appliancePorts.identity()));
		}
	}

	/**
	 * Set up a dest/other pair to test failover.
	 * @param testName
	 * @throws Exception
	 */
	public void setUpFailoverWithWebApps(String testName) throws Exception {
		initialSetup(testName);
		logger.info("Starting up dest appliance");
		// We are in the tomcat logs folder...
		System.getProperties().put("ARCHAPPL_SHORT_TERM_FOLDER", "../sts");
		System.getProperties().put("ARCHAPPL_MEDIUM_TERM_FOLDER", "../mts");
		System.getProperties().put("ARCHAPPL_LONG_TERM_FOLDER", "../lts");

		createAndStartTomcatInstance(testName, "dest_appliance", ConfigServiceForTests.RETRIEVAL_TEST_PORT, DEFAULT_SERVER_STARTUP_PORT, Path.of("src/sitespecific/tests/classpathfiles/failover_dest.xml"));
		logger.info("Done starting up dest appliance");
		logger.info("Starting up other appliance");
		createAndStartTomcatInstance(testName, "other_appliance", ConfigServiceForTests.RETRIEVAL_TEST_PORT + 4, DEFAULT_SERVER_STARTUP_PORT + 4, Path.of("src/sitespecific/tests/classpathfiles/failover_other.xml"));
		logger.info("Done starting up other appliance");
	}

	private void initialSetup(String testName) throws IOException {
		stopLeftovers();
		stopping = false;
		File testFolder = testFolder(testName);
		if (testFolder.exists()) {
			FileUtils.deleteDirectory(testFolder);
		}
		assert testFolder.mkdirs();
		cleanupFolders.add(testFolder);

	}
	/**
	 * Stops the Tomcats that earlier setups left running, so a failed test does not hold the ports of the tests after it.
	 */
	private void stopLeftovers() {
		for (TomcatSetup left : RUNNING) {
			if (left == this) continue;
			logger.warn("Stopping the Tomcat that an earlier test left running");
			try {
				left.tearDown();
			} catch (Exception ex) {
				logger.error("Could not stop the Tomcat that an earlier test left running", ex);
			}
		}
	}

	public void tearDown() throws Exception {
		stopping = true;
		boolean interrupted = Thread.interrupted();
		for (Map.Entry<String, BusySampler> sampler : samplersByAppliance.entrySet()) {
			sampler.getValue().stopAndReport(testNamesByAppliance.getOrDefault(sampler.getKey(), "?"));
		}
		samplersByAppliance.clear();
		IOException failure = null;
		for(Process process : watchedProcesses) {
			if (!process.isAlive()) continue;
			process.destroy();
			logger.info("Sending a signal to " + process.pid());
			for (int attempt = 0; attempt < 2 && process.isAlive(); attempt++) {
				int timeout = attempt == 0 ? SHUTDOWN_TIMEOUT_SECONDS : FORCED_SHUTDOWN_TIMEOUT_SECONDS;
				try {
					if (process.waitFor(timeout, TimeUnit.SECONDS)) break;
				} catch (InterruptedException ex) {
					interrupted = true;
				}
				process.destroyForcibly();
			}
			if (process.isAlive()) {
				IOException ex = new IOException("Tomcat process " + process.pid() + " did not stop");
				if (failure == null) failure = ex;
				else failure.addSuppressed(ex);
			}
		}
		if (interrupted) Thread.currentThread().interrupt();
		if (failure != null) throw failure;
		RUNNING.remove(this);
	}

	private void catchApplianceLog(String applianceName, Process p, CompletableFuture<Void> startup, BufferedReader li) {
		Logger applianceLogger = LogManager.getLogger("APP" + applianceName);
		try (li) {
			String msg;
			ConcurrentLinkedDeque<String> console = consoleByAppliance.computeIfAbsent(applianceName, name -> new ConcurrentLinkedDeque<>());
			while((msg = li.readLine()) != null) {
				applianceLogger.info(applianceName + " | " + msg);
				console.addLast(msg);
				if (console.size() > CONSOLE_LINES_KEPT) console.pollFirst();
				if (msg.contains("Failed to initialize component [Connector[")) {
					startup.completeExceptionally(new IOException(msg));
				}
				if(msg.contains("All components in this appliance have started up")) {
					logger.info(applianceName + " has started up.");
					startup.complete(null);
				}
			}
			startup.completeExceptionally(new IOException("Tomcat log ended before startup completed"));
		} catch(IOException ex) {
			startup.completeExceptionally(ex);
			// tearDown destroys the process, which closes this stream while readLine is blocked;
			// that is an expected shutdown artifact, not a startup failure.
			if(stopping || !p.isAlive()) {
				logger.debug("Appliance log for " + applianceName + " closed on shutdown");
			} else {
				logger.error("Error reading the appliance log for " + applianceName, ex);
			}
		} catch(Exception ex) {
			startup.completeExceptionally(ex);
			logger.error("Unexpected error reading the appliance log for " + applianceName, ex);
		}
	}

	private void createAndStartTomcatInstance(String testName, final String applianceName,
	                                          int port, int startupPort, Path appliancesXML) throws IOException {
		try {
			File workFolder = makeTomcatFolders(testName, applianceName, port, startupPort);
			File logsFolder = new File(workFolder, "logs");
			assert (logsFolder.exists());

			ProcessBuilder pb = new ProcessBuilder(System.getenv("TOMCAT_HOME") + File.separator + "bin" + File.separator + "catalina.sh", "run");
			createEnvironment(testName, applianceName, pb.environment(), appliancesXML);
			pb.environment().putAll(extraEnvironment);
			pb.directory(logsFolder);
			pb.redirectErrorStream(true);
			pb.redirectOutput(ProcessBuilder.Redirect.PIPE);
			Process p = pb.start();
			watchedProcesses.add(p);
			processesByAppliance.put(applianceName, p);
			consoleByAppliance.put(applianceName, new ConcurrentLinkedDeque<>());
			RUNNING.add(this);

			final CompletableFuture<Void> startup = new CompletableFuture<>();
			p.onExit().thenAccept(process -> startup.completeExceptionally(
					new IOException("Tomcat exited with status " + process.exitValue())));

			final BufferedReader li = new BufferedReader(new InputStreamReader(p.getInputStream()));
			Thread t = new Thread(() -> {
				catchApplianceLog(applianceName, p, startup, li);
			});
			t.start();

			startup.get(STARTUP_TIMEOUT_SECONDS, TimeUnit.SECONDS);
			if (!p.isAlive()) throw new IOException("Tomcat exited during startup");
			logger.info("Done starting " + applianceName);
			if (SAMPLE_BUSY_THREADS) {
				BusySampler sampler = new BusySampler(applianceName);
				samplersByAppliance.put(applianceName, sampler);
				testNamesByAppliance.put(applianceName, testName);
				sampler.start();
			}
		} catch (IOException | InterruptedException | ExecutionException | TimeoutException ex) {
			Throwable cause = ex instanceof ExecutionException ? ex.getCause() : ex;
			IOException failure = new IOException("Could not start Tomcat appliance " + applianceName, cause);
			try {
				tearDown();
			} catch (Exception cleanupFailure) {
				failure.addSuppressed(cleanupFailure);
			}
			if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
			throw failure;
		}
	}

	/**
	 * @param testName
	 * @param applianceName
	 * @param port
	 * @param startupPort
	 * @return Returns the CATALINA_BASE for this instance
	 * @throws IOException
	 */
	/**
	 * The base directory that holds the per-test Tomcat work folders.
	 * Supplied by the build as archappl.tomcat.dir; defaults to target/tomcats for a direct run.
	 */
	private static File tomcatBaseDir() {
		return new File(System.getProperty("archappl.tomcat.dir", "target/tomcats"));
	}

	private static File testFolder(String testName) {
		return new File(tomcatBaseDir(), "tomcat_" + testName);
	}

	/**
	 * Resolves the shared appliance directory for Tomcat and generated storage data.
	 */
	public static File getApplianceFolder(String testName, String applianceName) {
		return new File(testFolder(testName), applianceName);
	}

	/**
	 * The built WAR for a component, resolved from the build-supplied output directory and final name.
	 * archappl.war.dir defaults to target. archappl.final.name has no default, because the final name carries the
	 * build day and commit; the Maven test configuration sets it, and a run outside Maven must set it to the name of
	 * the built WARs without the component suffix.
	 */
	private static File warFile(String component) throws IOException {
		String warDir = System.getProperty("archappl.war.dir", "target");
		String finalName = System.getProperty("archappl.final.name");
		if(finalName == null || finalName.isBlank()) {
			throw new IOException("The system property archappl.final.name is not set; Maven sets it to the final name of the "
					+ "built WARs, such as aa-20261012-fcf01d9c. Set it when running the integration tests outside Maven.");
		}
		return new File(warDir, finalName + "-" + component + ".war");
	}

	private File makeTomcatFolders(String testName, String applianceName, int port, int startupPort) throws IOException {
		File workFolder = getApplianceFolder(testName, applianceName);
		// Start from a clean work folder so a leftover from an earlier run does not fail the setup.
		if(workFolder.exists()) FileUtils.deleteDirectory(workFolder);
		File webAppsFolder = new File(workFolder, "webapps");
		File logsFolder = new File(workFolder, "logs");
		File tempFolder = new File(workFolder, "temp");
		for(File dir : new File[] {workFolder, webAppsFolder, logsFolder, tempFolder}) {
			if(!dir.mkdirs()) throw new IOException("Could not create the Tomcat work folder " + dir.getAbsolutePath());
		}

		FileUtils.copyFile(new File("src/resources/test/log4j2.xml"), new File(logsFolder, "log4j2.xml"));

		logger.debug("Copying the webapps wars to " + webAppsFolder.getAbsolutePath());
		for(String component : new String[] {"mgmt", "retrieval", "etl", "engine"}) {
			File builtWar = warFile(component);
			if(!builtWar.exists()) throw new IOException("Cannot find the built WAR " + builtWar.getAbsolutePath() + "; run the Maven package phase before the integration tests.");
			FileUtils.copyFile(builtWar, new File(webAppsFolder, component + ".war"));
		}

		File confOriginal = new File(System.getenv("TOMCAT_HOME"), "conf_original");
		File confFolder = new File(workFolder, "conf");
		logger.debug("Copying the config from " + confOriginal.getAbsolutePath() + " to " + confFolder.getAbsolutePath());
		if (!confOriginal.exists()) {
			throw new IOException("For the tomcat tests to work, we expect that when you extract the tomcat distrbution to " + System.getenv("TOMCAT_HOME") + ", you copy the pristine conf folder to a folder called conf_original. This folder " + confOriginal.getAbsolutePath() + " does not seem to exist.");
		}
		// We expect that when you set up TOMCAT_HOME,
		FileUtils.copyDirectory(confOriginal, confFolder);

		// We then replace the server.xml with one we generate.
		// TomcatSampleServer.xml is a simple MessageFormat template with entries for
		// 0) server http port
		// 1) server startup port
		String serverXML = new String(Files.readAllBytes(Paths.get("./src/test/org/epics/archiverappliance/TomcatSampleServer.xml")));
		String formattedServerXML = MessageFormat.format(serverXML, port, startupPort);
		if (engineBackgroundProcessorDelaySeconds != null) {
			String engineTag = "<Engine name=\"Catalina\" defaultHost=\"localhost\">";
			if (!formattedServerXML.contains(engineTag)) throw new IOException("TomcatSampleServer.xml has no " + engineTag);
			formattedServerXML = formattedServerXML.replace(engineTag,
					"<Engine name=\"Catalina\" defaultHost=\"localhost\" backgroundProcessorDelay=\"" + engineBackgroundProcessorDelaySeconds + "\">");
		}
		Files.write(Paths.get(confFolder.getAbsolutePath(), "server.xml"), formattedServerXML.getBytes(), StandardOpenOption.TRUNCATE_EXISTING);
		logger.debug("Done generating server.xml");

		return workFolder;
	}

	/**
	 * Reads currentThreadsBusy of one Tomcat until it is stopped and keeps the largest value.
	 */
	private final class BusySampler implements Runnable {
		private final String applianceName;
		private volatile boolean running = true;
		private volatile int maxBusy = 0;
		private volatile long samples = 0;
		private final CompletableFuture<Void> ready = new CompletableFuture<>();
		private final long startedMillis = System.currentTimeMillis();
		private final long startedNanos = System.nanoTime();
		private volatile long firstMillis = 0;
		private volatile long lastMillis = 0;
		private volatile long lastNanos = startedNanos;
		private volatile long maxGapMillis = 0;
		private volatile String failure = "";
		private final Thread thread;

		BusySampler(String applianceName) {
			this.applianceName = applianceName;
			this.thread = new Thread(this, "BusyThreadsSampler-" + applianceName);
			this.thread.setDaemon(true);
		}

		void start() throws IOException {
			thread.start();
			try {
				ready.get(10, TimeUnit.SECONDS);
			} catch (InterruptedException | ExecutionException | TimeoutException ex) {
				if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
				throw new IOException("The busy-thread sampler did not become ready for " + applianceName, ex);
			}
		}

		@Override
		public void run() {
			try {
				JMXServiceURL url = new JMXServiceURL("service:jmx:rmi:///jndi/rmi://127.0.0.1:" + jmxPort(applianceName) + "/jmxrmi");
				try (JMXConnector connector = JMXConnectorFactory.connect(url)) {
					MBeanServerConnection connection = connector.getMBeanServerConnection();
					Set<ObjectName> pools = connection.queryNames(new ObjectName("Catalina:type=ThreadPool,name=\"http-nio-*\""), null);
					if (pools.size() != 1) throw new IOException("Expected one HTTP connector, found " + pools.size());
					ObjectName pool = pools.iterator().next();
					while (running) {
						int busy = ((Number) connection.getAttribute(pool, "currentThreadsBusy")).intValue();
						long now = System.nanoTime();
						maxGapMillis = Math.max(maxGapMillis, TimeUnit.NANOSECONDS.toMillis(now - lastNanos));
						lastNanos = now;
						lastMillis = System.currentTimeMillis();
						if (samples == 0) firstMillis = lastMillis;
						maxBusy = Math.max(maxBusy, busy);
						samples++;
						ready.complete(null);
						Thread.sleep(BUSY_SAMPLE_INTERVAL_MILLIS);
					}
				}
			} catch (InterruptedException ex) {
				Thread.currentThread().interrupt();
				if (running) failure = "InterruptedException";
				ready.completeExceptionally(ex);
			} catch (Exception ex) {
				failure = ex.getClass().getSimpleName();
				ready.completeExceptionally(ex);
				logger.debug("The busy-thread sampler of " + applianceName + " ended: " + ex);
			}
		}

		void stopAndReport(String testName) {
			running = false;
			thread.interrupt();
			try {
				thread.join(5000);
			} catch (InterruptedException ex) {
				Thread.currentThread().interrupt();
			}
			long stoppedMillis = System.currentTimeMillis();
			long stoppedNanos = System.nanoTime();
			maxGapMillis = Math.max(maxGapMillis, TimeUnit.NANOSECONDS.toMillis(stoppedNanos - lastNanos));
			if (thread.isAlive()) failure = "SamplerStillRunning";
			String outcome = failure.isEmpty() && samples > 0 ? "complete" : "incomplete:" + failure;
			// TSV: test, appliance, maximum, samples, child PID, start/first/last/end epoch milliseconds,
			// elapsed milliseconds, largest sample gap milliseconds, and capture outcome.
			String line = testName + "\t" + applianceName + "\t" + maxBusy + "\t" + samples
					+ "\t" + processesByAppliance.get(applianceName).pid() + "\t" + startedMillis
					+ "\t" + firstMillis + "\t" + lastMillis + "\t" + stoppedMillis
					+ "\t" + TimeUnit.NANOSECONDS.toMillis(stoppedNanos - startedNanos)
					+ "\t" + maxGapMillis + "\t" + outcome + "\n";
			logger.info("Busy threads of " + testName + " " + applianceName + ": max " + maxBusy + " in " + samples + " samples");
			try {
				Files.createDirectories(BUSY_THREADS_FILE.getParent());
				Files.writeString(BUSY_THREADS_FILE, line, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
			} catch (IOException ex) {
				logger.warn("Could not append to " + BUSY_THREADS_FILE, ex);
			}
		}
	}

	private static int freeLoopbackPort() {
		try (ServerSocket socket = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
			return socket.getLocalPort();
		} catch (IOException ex) {
			throw new IllegalStateException("No free loopback port for JMX", ex);
		}
	}

	private void createEnvironment(String testName, String applianceName, Map<String, String> environment, Path appliancesXML) {
		environment.putAll(System.getenv());
		environment.remove("CLASSPATH");
		environment.put("CATALINA_HOME", System.getenv("TOMCAT_HOME"));
		File workFolder = getApplianceFolder(testName, applianceName);
		assert (workFolder.exists());
		environment.put("CATALINA_BASE", workFolder.getAbsolutePath());
		List<String> jvmOptions = new ArrayList<>();
		jvmOptions.add("-Deaatag=eaatesttm"); // The tag is for pkill during testing
		jvmOptions.addAll(extraJvmOptions);
		if (jmxEnabled || SAMPLE_BUSY_THREADS) {
			int jmxPort = freeLoopbackPort();
			jmxPortsByAppliance.put(applianceName, jmxPort);
			jvmOptions.add("-Dcom.sun.management.jmxremote.port=" + jmxPort);
			jvmOptions.add("-Dcom.sun.management.jmxremote.rmi.port=" + jmxPort);
			jvmOptions.add("-Dcom.sun.management.jmxremote.host=127.0.0.1");
			jvmOptions.add("-Dcom.sun.management.jmxremote.authenticate=false");
			jvmOptions.add("-Dcom.sun.management.jmxremote.ssl=false");
			jvmOptions.add("-Djava.rmi.server.hostname=127.0.0.1");
		}
		environment.put("CATALINA_OPTS", String.join(" ", jvmOptions));

		environment.put("LOG4J_CONFIGURATION_FILE", (new File("src/resources/test/log4j2.xml")).getAbsolutePath());
		if (productionConfig) environment.remove(ConfigService.ARCHAPPL_CONFIGSERVICE_IMPL);
		else environment.put(ConfigService.ARCHAPPL_CONFIGSERVICE_IMPL, ConfigServiceForTests.class.getName());
		environment.put(DefaultConfigService.SITE_FOR_UNIT_TESTS_NAME, DefaultConfigService.SITE_FOR_UNIT_TESTS_VALUE);
		environment.put(ConfigService.ARCHAPPL_PROPERTIES_FILENAME, TEST_PROPERTIES_FILE.getAbsolutePath());

		environment.put(ConfigService.ARCHAPPL_MYIDENTITY, applianceName);
		if (!System.getProperties().containsKey(ConfigService.ARCHAPPL_APPLIANCES)) {
			environment.put(ConfigService.ARCHAPPL_APPLIANCES, appliancesXML.toAbsolutePath().toString());
		} else {
			environment.put(ConfigService.ARCHAPPL_APPLIANCES, (String) System.getProperties().get(ConfigService.ARCHAPPL_APPLIANCES));
		}

		if (!System.getProperties().containsKey(ConfigService.ARCHAPPL_PERSISTENCE_LAYER) || System.getProperties().get(ConfigService.ARCHAPPL_PERSISTENCE_LAYER).equals(InMemoryPersistence.class.getName())) {
			environment.put(ConfigService.ARCHAPPL_PERSISTENCE_LAYER, "org.epics.archiverappliance.config.persistence.InMemoryPersistence");
		} else {
			String persistenceFile = (String) System.getProperties().get(JDBM2Persistence.ARCHAPPL_JDBM2_FILENAME);
			logger.info("Persistence layer is provided by " + System.getProperties().get(ConfigService.ARCHAPPL_PERSISTENCE_LAYER));
			assert (persistenceFile != null);
			String persistenceFileForMember = persistenceFile.replace(".jdbm2", "_" + applianceName + ".jdbm2");
			environment.put(ConfigService.ARCHAPPL_PERSISTENCE_LAYER, (String) System.getProperties().get(ConfigService.ARCHAPPL_PERSISTENCE_LAYER));
			environment.put(JDBM2Persistence.ARCHAPPL_JDBM2_FILENAME, persistenceFileForMember);
			logger.info("Persistence file for member " + persistenceFileForMember);
		}

		overrideEnvWithSystemProperty(environment, "ARCHAPPL_SHORT_TERM_FOLDER");
		overrideEnvWithSystemProperty(environment, "ARCHAPPL_MEDIUM_TERM_FOLDER");
		overrideEnvWithSystemProperty(environment, "ARCHAPPL_LONG_TERM_FOLDER");
		overrideEnvWithSystemProperty(environment, "ARCHAPPL_POLICIES");
		overrideEnvWithSystemProperty(environment, ConfigService.ARCHAPPL_PROPERTIES_FILENAME);

		if (logger.isDebugEnabled()) {
			for (String key : environment.keySet()) {
				logger.debug("Env " + key + "=" + environment.get(key));
			}
		}

	}

}
