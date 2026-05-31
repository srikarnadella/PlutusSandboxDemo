package com.plaid.quickstart;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class SupabaseService {
  private static final Logger LOG = LoggerFactory.getLogger(SupabaseService.class);

  private final String supabaseUrl;
  private final String serviceRoleKey;
  private final HttpClient httpClient;
  private final boolean configured;

  public SupabaseService(String supabaseUrl, String serviceRoleKey) {
    this.supabaseUrl = supabaseUrl != null ? supabaseUrl.replaceAll("/$", "") : null;
    this.serviceRoleKey = serviceRoleKey;
    this.configured = supabaseUrl != null && !supabaseUrl.isEmpty()
                   && serviceRoleKey != null && !serviceRoleKey.isEmpty();
    this.httpClient = HttpClient.newHttpClient();
    if (!configured) {
      LOG.warn("SupabaseService: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — Plaid tokens will not be persisted across restarts");
    }
  }

  public void storeAccessToken(String userId, String accessToken, String itemId)
      throws IOException, InterruptedException {
    if (!configured) return;
    String body = String.format(
        "{\"id\":\"%s\",\"plaid_access_token\":\"%s\",\"plaid_item_id\":\"%s\"}",
        userId, accessToken, itemId);
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(supabaseUrl + "/rest/v1/user_profiles"))
        .header("apikey", serviceRoleKey)
        .header("Authorization", "Bearer " + serviceRoleKey)
        .header("Content-Type", "application/json")
        .header("Prefer", "resolution=merge-duplicates")
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) {
      throw new IOException("Supabase upsert failed: " + response.statusCode() + " — " + response.body());
    }
    LOG.info("Stored Plaid access token for user {}", userId);
  }

  public String getAccessToken(String userId) throws IOException, InterruptedException {
    if (!configured || userId == null || userId.isEmpty()) return null;
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(supabaseUrl + "/rest/v1/user_profiles?id=eq." + userId + "&select=plaid_access_token"))
        .header("apikey", serviceRoleKey)
        .header("Authorization", "Bearer " + serviceRoleKey)
        .header("Accept", "application/json")
        .GET()
        .build();
    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) {
      throw new IOException("Supabase fetch failed: " + response.statusCode() + " — " + response.body());
    }
    // Response: [{"plaid_access_token":"access-sandbox-xxx"}]
    String body = response.body();
    int markerIdx = body.indexOf("\"plaid_access_token\":\"");
    if (markerIdx == -1) return null;
    int start = markerIdx + "\"plaid_access_token\":\"".length();
    int end = body.indexOf("\"", start);
    if (end == -1) return null;
    String token = body.substring(start, end);
    return token.isEmpty() ? null : token;
  }
}
