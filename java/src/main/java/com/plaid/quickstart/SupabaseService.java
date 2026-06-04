package com.plaid.quickstart;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.time.Duration;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

public class SupabaseService {
  private static final Logger LOG = LoggerFactory.getLogger(SupabaseService.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final String supabaseUrl;
  private final String serviceRoleKey;
  private final HttpClient httpClient;
  private final boolean configured;

  public SupabaseService(String supabaseUrl, String serviceRoleKey) {
    this.supabaseUrl = supabaseUrl != null ? supabaseUrl.replaceAll("/$", "") : null;
    this.serviceRoleKey = serviceRoleKey;
    this.configured = supabaseUrl != null && !supabaseUrl.isEmpty()
                   && serviceRoleKey != null && !serviceRoleKey.isEmpty();
    this.httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();
    if (!configured) {
      LOG.warn("SupabaseService: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — Plaid tokens will not be persisted across restarts");
    }
  }

  public void storeAccessToken(String userId, String accessToken, String itemId)
      throws IOException, InterruptedException {
    if (!configured) return;
    // Use ObjectMapper to build JSON safely — avoids injection via unescaped string interpolation
    ObjectNode node = MAPPER.createObjectNode();
    node.put("id", userId);
    node.put("plaid_access_token", accessToken);
    node.put("plaid_item_id", itemId);
    String body = MAPPER.writeValueAsString(node);

    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(supabaseUrl + "/rest/v1/user_profiles"))
        .header("apikey", serviceRoleKey)
        .header("Authorization", "Bearer " + serviceRoleKey)
        .header("Content-Type", "application/json")
        .header("Prefer", "resolution=merge-duplicates")
        .timeout(Duration.ofSeconds(10))
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
    String encodedId = URLEncoder.encode(userId, StandardCharsets.UTF_8);
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(supabaseUrl + "/rest/v1/user_profiles?id=eq." + encodedId + "&select=plaid_access_token"))
        .header("apikey", serviceRoleKey)
        .header("Authorization", "Bearer " + serviceRoleKey)
        .header("Accept", "application/json")
        .timeout(Duration.ofSeconds(10))
        .GET()
        .build();
    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) {
      throw new IOException("Supabase fetch failed: " + response.statusCode() + " — " + response.body());
    }
    String body = response.body();
    if (body == null || body.isEmpty()) return null;
    JsonNode arr = MAPPER.readTree(body);
    if (!arr.isArray() || arr.isEmpty()) return null;
    JsonNode tokenNode = arr.get(0).path("plaid_access_token");
    if (tokenNode.isMissingNode() || tokenNode.isNull()) return null;
    String token = tokenNode.asText(null);
    return (token == null || token.isEmpty()) ? null : token;
  }

  public String getSyncCursor(String userId) throws IOException, InterruptedException {
    if (!configured || userId == null || userId.isEmpty()) return null;
    String encodedId = URLEncoder.encode(userId, StandardCharsets.UTF_8);
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(supabaseUrl + "/rest/v1/user_profiles?id=eq." + encodedId + "&select=plaid_sync_cursor"))
        .header("apikey", serviceRoleKey)
        .header("Authorization", "Bearer " + serviceRoleKey)
        .header("Accept", "application/json")
        .timeout(Duration.ofSeconds(10))
        .GET()
        .build();
    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) return null;
    String body = response.body();
    if (body == null || body.isEmpty()) return null;
    JsonNode arr = MAPPER.readTree(body);
    if (!arr.isArray() || arr.isEmpty()) return null;
    JsonNode node = arr.get(0).path("plaid_sync_cursor");
    if (node.isMissingNode() || node.isNull()) return null;
    String cursor = node.asText(null);
    return (cursor == null || cursor.isEmpty()) ? null : cursor;
  }

  // ── Multi-bank: plaid_items table ─────────────────────────────────────────

  public static class PlaidItem {
    public final String itemId;
    public final String accessToken;
    public final String institutionName;
    public final String institutionId;

    public PlaidItem(String itemId, String accessToken, String institutionName, String institutionId) {
      this.itemId = itemId;
      this.accessToken = accessToken;
      this.institutionName = institutionName != null ? institutionName : "Connected Bank";
      this.institutionId = institutionId;
    }
  }

  public void storeItem(String userId, String accessToken, String itemId,
                        String institutionName, String institutionId)
      throws IOException, InterruptedException {
    if (!configured) return;
    ObjectNode node = MAPPER.createObjectNode();
    node.put("user_id", userId);
    node.put("item_id", itemId);
    node.put("access_token", accessToken);
    if (institutionName != null) node.put("institution_name", institutionName);
    if (institutionId  != null) node.put("institution_id", institutionId);
    String body = MAPPER.writeValueAsString(node);

    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(supabaseUrl + "/rest/v1/plaid_items"))
        .header("apikey", serviceRoleKey)
        .header("Authorization", "Bearer " + serviceRoleKey)
        .header("Content-Type", "application/json")
        .header("Prefer", "resolution=merge-duplicates")
        .timeout(Duration.ofSeconds(10))
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) {
      throw new IOException("Supabase plaid_items upsert failed: " + response.statusCode() + " — " + response.body());
    }
    LOG.info("Stored plaid_item for user={} item={} institution={}", userId, itemId, institutionName);
  }

  public java.util.List<PlaidItem> getItems(String userId) throws IOException, InterruptedException {
    if (!configured || userId == null || userId.isEmpty()) return new java.util.ArrayList<>();
    String encodedId = URLEncoder.encode(userId, StandardCharsets.UTF_8);
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(supabaseUrl + "/rest/v1/plaid_items?user_id=eq." + encodedId
            + "&select=item_id,access_token,institution_name,institution_id&order=created_at.asc"))
        .header("apikey", serviceRoleKey)
        .header("Authorization", "Bearer " + serviceRoleKey)
        .header("Accept", "application/json")
        .timeout(Duration.ofSeconds(10))
        .GET()
        .build();
    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) return new java.util.ArrayList<>();
    String body = response.body();
    if (body == null || body.isEmpty()) return new java.util.ArrayList<>();
    JsonNode arr = MAPPER.readTree(body);
    if (!arr.isArray()) return new java.util.ArrayList<>();
    java.util.List<PlaidItem> items = new java.util.ArrayList<>();
    for (JsonNode n : arr) {
      String itemId = n.path("item_id").asText(null);
      String token  = n.path("access_token").asText(null);
      if (itemId == null || token == null) continue;
      items.add(new PlaidItem(itemId, token,
          n.path("institution_name").asText(null),
          n.path("institution_id").asText(null)));
    }
    return items;
  }

  public void removeAllItems(String userId) throws IOException, InterruptedException {
    if (!configured || userId == null || userId.isEmpty()) return;
    String encodedUser = URLEncoder.encode(userId, StandardCharsets.UTF_8);
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(supabaseUrl + "/rest/v1/plaid_items?user_id=eq." + encodedUser))
        .header("apikey", serviceRoleKey)
        .header("Authorization", "Bearer " + serviceRoleKey)
        .timeout(Duration.ofSeconds(10))
        .DELETE()
        .build();
    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) {
      LOG.warn("Failed to remove all plaid_items for user={}: {}", userId, response.statusCode());
    } else {
      LOG.info("Removed all plaid_items for user={}", userId);
    }
  }

  public void removeItem(String userId, String itemId) throws IOException, InterruptedException {
    if (!configured) return;
    String encodedUser = URLEncoder.encode(userId, StandardCharsets.UTF_8);
    String encodedItem = URLEncoder.encode(itemId, StandardCharsets.UTF_8);
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(supabaseUrl + "/rest/v1/plaid_items?user_id=eq." + encodedUser
            + "&item_id=eq." + encodedItem))
        .header("apikey", serviceRoleKey)
        .header("Authorization", "Bearer " + serviceRoleKey)
        .timeout(Duration.ofSeconds(10))
        .DELETE()
        .build();
    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) {
      LOG.warn("Failed to remove plaid_item for user={} item={}: {}", userId, itemId, response.statusCode());
    } else {
      LOG.info("Removed plaid_item for user={} item={}", userId, itemId);
    }
  }

  // ── Transaction cache: plaid_transaction_cache table ─────────────────────

  public static class TransactionCacheEntry {
    public final String transactionsJson;
    public final String cursor;
    public final java.time.Instant lastSyncedAt;

    public TransactionCacheEntry(String json, String cursor, java.time.Instant syncedAt) {
      this.transactionsJson = json;
      this.cursor = cursor;
      this.lastSyncedAt = syncedAt;
    }
  }

  public TransactionCacheEntry getTransactionCache(String userId, String itemId)
      throws IOException, InterruptedException {
    if (!configured || userId == null || itemId == null) return null;
    String encUser = URLEncoder.encode(userId, StandardCharsets.UTF_8);
    String encItem = URLEncoder.encode(itemId, StandardCharsets.UTF_8);
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(supabaseUrl + "/rest/v1/plaid_transaction_cache"
            + "?user_id=eq." + encUser + "&item_id=eq." + encItem
            + "&select=transactions_json,sync_cursor,last_synced_at"))
        .header("apikey", serviceRoleKey)
        .header("Authorization", "Bearer " + serviceRoleKey)
        .header("Accept", "application/json")
        .timeout(Duration.ofSeconds(15))
        .GET()
        .build();
    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) return null;
    String body = response.body();
    if (body == null || body.isEmpty()) return null;
    JsonNode arr = MAPPER.readTree(body);
    if (!arr.isArray() || arr.isEmpty()) return null;
    JsonNode row = arr.get(0);
    String json     = row.path("transactions_json").asText("[]");
    String cursor   = row.path("sync_cursor").isNull() ? null : row.path("sync_cursor").asText(null);
    String syncedAt = row.path("last_synced_at").asText(null);
    java.time.Instant at = syncedAt != null ? java.time.Instant.parse(syncedAt) : java.time.Instant.EPOCH;
    return new TransactionCacheEntry(json, cursor, at);
  }

  public void storeTransactionCache(String userId, String itemId, String json, String cursor)
      throws IOException, InterruptedException {
    if (!configured) return;
    ObjectNode node = MAPPER.createObjectNode();
    node.put("user_id", userId);
    node.put("item_id", itemId);
    node.put("transactions_json", json);
    if (cursor != null) node.put("sync_cursor", cursor); else node.putNull("sync_cursor");
    node.put("last_synced_at", java.time.Instant.now().toString());
    String body = MAPPER.writeValueAsString(node);
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(supabaseUrl + "/rest/v1/plaid_transaction_cache"))
        .header("apikey", serviceRoleKey)
        .header("Authorization", "Bearer " + serviceRoleKey)
        .header("Content-Type", "application/json")
        .header("Prefer", "resolution=merge-duplicates")
        .timeout(Duration.ofSeconds(15))
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) {
      LOG.warn("Failed to store transaction cache for user={} item={}: {}", userId, itemId, response.statusCode());
    }
  }

  /** Marks all transaction caches for a user as stale so the next spending_review triggers a delta sync. */
  public void markTransactionCacheStale(String userId) throws IOException, InterruptedException {
    if (!configured || userId == null) return;
    String encUser = URLEncoder.encode(userId, StandardCharsets.UTF_8);
    ObjectNode node = MAPPER.createObjectNode();
    node.put("last_synced_at", java.time.Instant.EPOCH.toString());
    String body = MAPPER.writeValueAsString(node);
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(supabaseUrl + "/rest/v1/plaid_transaction_cache?user_id=eq." + encUser))
        .header("apikey", serviceRoleKey)
        .header("Authorization", "Bearer " + serviceRoleKey)
        .header("Content-Type", "application/json")
        .header("Prefer", "return=minimal")
        .timeout(Duration.ofSeconds(10))
        .method("PATCH", HttpRequest.BodyPublishers.ofString(body))
        .build();
    httpClient.send(request, HttpResponse.BodyHandlers.ofString());
  }

  public void storeSyncCursor(String userId, String cursor) throws IOException, InterruptedException {
    if (!configured || userId == null || cursor == null) return;
    ObjectNode node = MAPPER.createObjectNode();
    node.put("id", userId);
    node.put("plaid_sync_cursor", cursor);
    String body = MAPPER.writeValueAsString(node);
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create(supabaseUrl + "/rest/v1/user_profiles"))
        .header("apikey", serviceRoleKey)
        .header("Authorization", "Bearer " + serviceRoleKey)
        .header("Content-Type", "application/json")
        .header("Prefer", "resolution=merge-duplicates")
        .timeout(Duration.ofSeconds(10))
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() >= 300) {
      LOG.warn("Failed to store sync cursor for user {}: {}", userId, response.statusCode());
    }
  }
}
