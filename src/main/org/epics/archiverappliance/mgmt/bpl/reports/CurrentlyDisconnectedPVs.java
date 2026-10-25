package org.epics.archiverappliance.mgmt.bpl.reports;

import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.epics.archiverappliance.common.BPLAction;
import org.epics.archiverappliance.common.BPLEndpoint;
import org.epics.archiverappliance.config.ApplianceInfo;
import org.epics.archiverappliance.config.ConfigService;
import org.epics.archiverappliance.utils.ui.MimeTypeConstants;
import org.json.simple.JSONArray;
import org.json.simple.JSONValue;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.json.simple.parser.ParseException;

/**
 * 
 * 
 * 
 * @author mshankar
 *
 */
@BPLEndpoint(summary = "Get a list of PVs that are currently disconnected.")
public class CurrentlyDisconnectedPVs implements BPLAction {
	private static Logger logger = LogManager.getLogger(CurrentlyDisconnectedPVs.class.getName());
	private static final int CONNECT_TIMEOUT_MILLIS = 5000;
	private static final int READ_TIMEOUT_MILLIS = 10000;

	@Override
	public void execute(HttpServletRequest req, HttpServletResponse resp, ConfigService configService) throws IOException {
		logger.info("Getting the list of pvs that are currently disconnected.");
		resp.setContentType(MimeTypeConstants.APPLICATION_JSON);
		resp.setCharacterEncoding(StandardCharsets.UTF_8.name());
		Object result;
		RequestConfig requestConfig = RequestConfig.custom()
				.setConnectTimeout(CONNECT_TIMEOUT_MILLIS)
				.setConnectionRequestTimeout(CONNECT_TIMEOUT_MILLIS)
				.setSocketTimeout(READ_TIMEOUT_MILLIS).build();
		try (CloseableHttpClient client = HttpClients.custom().setDefaultRequestConfig(requestConfig)
				.disableAutomaticRetries().disableRedirectHandling().build()) {
			JSONArray rows = new JSONArray();
			Set<List<String>> identities = new HashSet<>();
			for (ApplianceInfo info : configService.getAppliancesInCluster()) {
				HttpGet query = new HttpGet(info.getEngineURL() + "/getCurrentlyDisconnectedPVsForThisAppliance");
				query.setHeader("ARCHAPPL_COMPONENT", "true");
				try (CloseableHttpResponse response = client.execute(query)) {
					if (response.getStatusLine().getStatusCode() != HttpServletResponse.SC_OK
							|| response.getEntity() == null) {
						throw new IOException("Engine report did not return HTTP 200 with content");
					}
					Object body = new JSONParser().parse(EntityUtils.toString(response.getEntity(), StandardCharsets.UTF_8));
					if (!(body instanceof JSONArray engineRows)) {
						throw new IllegalArgumentException("Engine report must be a JSON array");
					}
					for (Object row : engineRows) {
						validateRow(row, identities);
						rows.add(row);
					}
				}
			}
			result = rows;
		} catch (IOException | ParseException | IllegalArgumentException error) {
			logger.warn("Could not obtain a complete disconnection report", error);
			resp.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
			JSONObject failure = new JSONObject();
			failure.put("status", "error");
			failure.put("desc", "Disconnection report unavailable: " + error.getMessage());
			result = failure;
		}
		try (PrintWriter out = resp.getWriter()) {
			out.println(JSONValue.toJSONString(result));
		}
	}

	private static void validateRow(Object value, Set<List<String>> identities) {
		if (!(value instanceof Map<?, ?> row)) {
			throw new IllegalArgumentException("Engine report row must be an object");
		}
		for (String field : List.of("pvName", "instance")) {
			if (!(row.get(field) instanceof String text) || text.isEmpty()
					|| text.chars().anyMatch(c -> c < 32 || c > 126)) {
				throw new IllegalArgumentException("Expected nonempty printable ASCII " + field);
			}
		}
		for (String field : List.of("connectionLostAt", "lastKnownEvent")) {
			if (!(row.get(field) instanceof String text) || text.isEmpty()
					|| text.chars().anyMatch(c -> c < 32 || (c >= 127 && c <= 159) || c == 0x2028 || c == 0x2029)) {
				throw new IllegalArgumentException("Expected nonempty time string without controls: " + field);
			}
		}
		if (!(row.get("noConnectionAsOfEpochSecs") instanceof String epoch) || !epoch.matches("[0-9]+")) {
			throw new IllegalArgumentException("Expected nonnegative decimal epoch string");
		}
		for (String field : List.of("hostName", "commandThreadID")) {
			if (row.containsKey(field) && !(row.get(field) instanceof String)) {
				throw new IllegalArgumentException("Expected string " + field);
			}
		}
		if (!identities.add(List.of((String) row.get("instance"), (String) row.get("pvName")))) {
			throw new IllegalArgumentException("Duplicate disconnection report identity");
		}
	}
}
