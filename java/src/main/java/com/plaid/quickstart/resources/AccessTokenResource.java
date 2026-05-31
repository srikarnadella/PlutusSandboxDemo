package com.plaid.quickstart.resources;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.plaid.client.model.ItemPublicTokenExchangeRequest;
import com.plaid.client.model.ItemPublicTokenExchangeResponse;
import com.plaid.client.request.PlaidApi;
import com.plaid.quickstart.PlaidApiHelper;
import com.plaid.quickstart.QuickstartApplication;
import com.plaid.quickstart.SupabaseService;

import javax.ws.rs.Consumes;
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
  private final List<String> plaidProducts;
  private final SupabaseService supabaseService;

  public static class SetAccessTokenRequest {
    @JsonProperty("public_token") public String publicToken;
    @JsonProperty("user_id") public String userId;
  }

  public AccessTokenResource(PlaidApi plaidClient, List<String> plaidProducts, SupabaseService supabaseService) {
    this.plaidClient = plaidClient;
    this.plaidProducts = plaidProducts;
    this.supabaseService = supabaseService;
  }

  @POST
  public InfoResource.InfoResponse setAccessToken(SetAccessTokenRequest req) throws IOException {
    ItemPublicTokenExchangeRequest request = new ItemPublicTokenExchangeRequest()
        .publicToken(req.publicToken);
    ItemPublicTokenExchangeResponse responseBody = PlaidApiHelper.callPlaid(
        plaidClient.itemPublicTokenExchange(request));

    String accessToken = responseBody.getAccessToken();
    String itemId = responseBody.getItemId();

    // Keep the global token set for backward-compat with other API Dashboard endpoints
    QuickstartApplication.accessToken = accessToken;
    QuickstartApplication.itemId = itemId;

    // Per-user map so multi-user and post-restart lookups work
    if (req.userId != null && !req.userId.isEmpty()) {
      QuickstartApplication.userTokens.put(req.userId, accessToken);
      try {
        supabaseService.storeAccessToken(req.userId, accessToken, itemId);
      } catch (Exception e) {
        LOG.error("Failed to persist access token to Supabase for user {}: {}", req.userId, e.getMessage());
      }
    }

    LOG.info("access token set for user={} item={}", req.userId, itemId);
    return new InfoResource.InfoResponse(Arrays.asList(), accessToken, itemId);
  }
}
