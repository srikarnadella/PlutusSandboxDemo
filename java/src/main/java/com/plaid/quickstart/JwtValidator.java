package com.plaid.quickstart;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Response;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.ConcurrentHashMap;

public class JwtValidator {
  private static final Logger LOG = LoggerFactory.getLogger(JwtValidator.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Duration CACHE_TTL = Duration.ofMinutes(5);

  private final String supabaseUrl;
  private final String serviceRoleKey;
  private final HttpClient httpClient;
  private final boolean enabled;

  private static class CachedResult {
    final String userId;
    final Instant expiresAt;
    CachedResult(String userId) {
      this.userId = userId;
      this.expiresAt = Instant.now().plus(CACHE_TTL);
    }
    boolean isExpired() { return Instant.now().isAfter(expiresAt); }
  }

  // Key: Bearer token string → validated userId + expiry
  private final ConcurrentHashMap<String, CachedResult> cache = new ConcurrentHashMap<>();

  public JwtValidator(String supabaseUrl, String serviceRoleKey) {
    this.supabaseUrl = supabaseUrl != null ? supabaseUrl.replaceAll("/$", "") : null;
    this.serviceRoleKey = serviceRoleKey;
    this.httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();
    this.enabled = supabaseUrl != null && !supabaseUrl.isEmpty()
                && serviceRoleKey != null && !serviceRoleKey.isEmpty();
    if (!enabled) {
      LOG.error("JwtValidator: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — JWT validation is DISABLED.");
    }
  }

  /** Validates and returns userId, throws HTTP 401 on failure. */
  public String requireUserId(String authorizationHeader) {
    String userId = tryGetUserId(authorizationHeader);
    if (userId == null) {
      throw new WebApplicationException(Response.Status.UNAUTHORIZED);
    }
    return userId;
  }

  /** Validates and returns userId, or null if invalid/missing. Never throws. */
  public String tryGetUserId(String authorizationHeader) {
    if (!enabled) return null;
    if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) return null;

    CachedResult cached = cache.get(authorizationHeader);
    if (cached != null && !cached.isExpired()) return cached.userId;
    // Remove expired entry if present
    if (cached != null) cache.remove(authorizationHeader);

    try {
      HttpRequest req = HttpRequest.newBuilder()
          .uri(URI.create(supabaseUrl + "/auth/v1/user"))
          .header("apikey", serviceRoleKey)
          .header("Authorization", authorizationHeader)
          .timeout(Duration.ofSeconds(10))
          .GET()
          .build();

      HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
      if (resp.statusCode() != 200) {
        LOG.warn("Supabase token validation rejected with status {}", resp.statusCode());
        return null;
      }

      JsonNode user = MAPPER.readTree(resp.body());
      String userId = user.path("id").asText(null);
      if (userId == null || userId.isEmpty()) return null;

      cache.put(authorizationHeader, new CachedResult(userId));
      return userId;

    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return null;
    } catch (Exception e) {
      LOG.warn("JWT validation failed: {}", e.getMessage());
      return null;
    }
  }
}
