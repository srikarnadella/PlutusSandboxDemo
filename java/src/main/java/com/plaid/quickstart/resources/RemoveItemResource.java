package com.plaid.quickstart.resources;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.plaid.client.model.ItemRemoveRequest;
import com.plaid.client.request.PlaidApi;
import com.plaid.quickstart.JwtValidator;
import com.plaid.quickstart.PlaidApiHelper;
import com.plaid.quickstart.QuickstartApplication;
import com.plaid.quickstart.SupabaseService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.io.IOException;
import java.util.List;

@Path("/remove_item")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class RemoveItemResource {
  private static final Logger LOG = LoggerFactory.getLogger(RemoveItemResource.class);
  private final PlaidApi plaidClient;
  private final JwtValidator jwtValidator;

  public static class RemoveItemRequest {
    @JsonProperty("item_id") public String itemId;
  }

  public RemoveItemResource(PlaidApi plaidClient, JwtValidator jwtValidator) {
    this.plaidClient = plaidClient;
    this.jwtValidator = jwtValidator;
  }

  @POST
  public Response removeItem(@HeaderParam("Authorization") String authHeader,
                              RemoveItemRequest req) throws IOException, InterruptedException {
    String userId = jwtValidator.requireUserId(authHeader);
    if (req == null || req.itemId == null || req.itemId.isEmpty()) {
      throw new WebApplicationException(
          Response.status(Response.Status.BAD_REQUEST)
              .entity("{\"error\":\"item_id is required\"}")
              .type("application/json").build());
    }

    // Look up the access token for this item
    String accessToken = null;
    try {
      List<SupabaseService.PlaidItem> items = QuickstartApplication.supabaseService.getItems(userId);
      for (SupabaseService.PlaidItem item : items) {
        if (req.itemId.equals(item.itemId)) {
          accessToken = item.accessToken;
          break;
        }
      }
    } catch (Exception e) {
      LOG.warn("Could not load items for user {} when removing: {}", userId, e.getMessage());
    }

    // Tell Plaid to remove the item (best-effort — don't fail if this errors)
    if (accessToken != null) {
      try {
        PlaidApiHelper.callPlaid(plaidClient.itemRemove(new ItemRemoveRequest().accessToken(accessToken)));
      } catch (Exception e) {
        LOG.warn("Plaid itemRemove failed for item={}: {} — removing from Supabase anyway", req.itemId, e.getMessage());
      }
    }

    // Remove from Supabase
    try {
      QuickstartApplication.supabaseService.removeItem(userId, req.itemId);
    } catch (Exception e) {
      LOG.error("Failed to remove item from Supabase for user={} item={}: {}", userId, req.itemId, e.getMessage());
    }

    // Invalidate in-memory caches
    SpendingReviewResource.TRANSACTION_CACHE.remove(userId);
    // Clear primary userToken if it matched (next spending_review will reload from Supabase)
    if (accessToken != null && accessToken.equals(QuickstartApplication.userTokens.get(userId))) {
      QuickstartApplication.userTokens.remove(userId);
    }

    LOG.info("Removed item={} for user={}", req.itemId, userId);
    return Response.ok("{\"removed\":true}").build();
  }
}
