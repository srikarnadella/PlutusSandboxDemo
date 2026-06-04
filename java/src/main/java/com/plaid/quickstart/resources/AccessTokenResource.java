package com.plaid.quickstart.resources;

import java.io.IOException;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.plaid.client.model.ItemPublicTokenExchangeRequest;
import com.plaid.client.model.ItemPublicTokenExchangeResponse;
import com.plaid.client.request.PlaidApi;
import com.plaid.quickstart.JwtValidator;
import com.plaid.quickstart.PlaidApiHelper;
import com.plaid.quickstart.QuickstartApplication;
import com.plaid.quickstart.SupabaseService;

import javax.ws.rs.Consumes;
import javax.ws.rs.HeaderParam;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Path("/set_access_token")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AccessTokenResource {
  private static final Logger LOG = LoggerFactory.getLogger(AccessTokenResource.class);
  private final PlaidApi plaidClient;
  private final SupabaseService supabaseService;
  private final JwtValidator jwtValidator;

  public static class SetAccessTokenRequest {
    @JsonProperty("public_token") public String publicToken;
    @JsonProperty("user_id") public String userId;
    @JsonProperty("institution_name") public String institutionName;
    @JsonProperty("institution_id")   public String institutionId;
  }

  public static class SetAccessTokenResponse {
    @JsonProperty("item_id") public final String itemId;
    public SetAccessTokenResponse(String itemId) { this.itemId = itemId; }
  }

  public AccessTokenResource(PlaidApi plaidClient, SupabaseService supabaseService,
                              JwtValidator jwtValidator) {
    this.plaidClient = plaidClient;
    this.supabaseService = supabaseService;
    this.jwtValidator = jwtValidator;
  }

  @POST
  public SetAccessTokenResponse setAccessToken(
      @HeaderParam("Authorization") String authHeader,
      SetAccessTokenRequest req) throws IOException {

    // Extract userId from verified JWT — request body userId is ignored
    String userId = jwtValidator.requireUserId(authHeader);

    ItemPublicTokenExchangeRequest request = new ItemPublicTokenExchangeRequest()
        .publicToken(req.publicToken);
    ItemPublicTokenExchangeResponse responseBody = PlaidApiHelper.callPlaid(
        plaidClient.itemPublicTokenExchange(request));

    String accessToken = responseBody.getAccessToken();
    String itemId = responseBody.getItemId();

    // Per-user map for fast in-memory lookup (primary/last item)
    QuickstartApplication.userTokens.put(userId, accessToken);

    // Clear any old items before storing the new one (single-bank: prevents stale tokens surviving reconnect)
    try {
      supabaseService.removeAllItems(userId);
    } catch (Exception e) {
      LOG.warn("Failed to remove old plaid_items for user {}: {}", userId, e.getMessage());
    }

    // Persist to plaid_items (multi-bank) and user_profiles (legacy single-bank compat)
    try {
      supabaseService.storeItem(userId, accessToken, itemId, req.institutionName, req.institutionId);
    } catch (Exception e) {
      LOG.error("Failed to persist plaid_item to Supabase for user {}: {}", userId, e.getMessage());
    }
    try {
      supabaseService.storeAccessToken(userId, accessToken, itemId);
    } catch (Exception e) {
      LOG.error("Failed to persist access token to user_profiles for user {}: {}", userId, e.getMessage());
    }
    // Invalidate all caches so next review re-fetches fresh data
    com.plaid.quickstart.resources.SpendingReviewResource.TRANSACTION_CACHE.remove(userId);
    com.plaid.quickstart.resources.SpendingReviewResource.ITEMS_CACHE.remove(userId);
    com.plaid.quickstart.resources.SpendingReviewResource.BALANCE_CACHE.remove(userId);

    LOG.info("access token set for user={} item={}", userId, itemId);
    // Return only item_id — the access token must not leave the server
    return new SetAccessTokenResponse(itemId);
  }
}
