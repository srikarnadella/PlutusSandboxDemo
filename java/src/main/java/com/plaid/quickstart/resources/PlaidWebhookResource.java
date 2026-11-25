package com.plaid.quickstart.resources;

import com.fasterxml.jackson.databind.JsonNode;
import com.plaid.quickstart.QuickstartApplication;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

@Path("/plaid_webhook")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class PlaidWebhookResource {
  private static final Logger LOG = LoggerFactory.getLogger(PlaidWebhookResource.class);

  // ponytail: Plaid-Verification JWT is not checked. Worst case a forged call forces an early re-sync
  // for a known item_id; add /webhook_verification_key/get + ES256 check before trusting payload contents.
  @POST
  public Response handleWebhook(JsonNode body) {
    if (body == null) return Response.ok("{\"received\":true}").build();
    String type = body.path("webhook_type").asText("UNKNOWN");
    String code = body.path("webhook_code").asText("UNKNOWN");
    String itemId = body.path("item_id").asText("");
    LOG.info("Plaid webhook received: {}/{} for item={}", type, code, itemId);

    if ("TRANSACTIONS".equals(type) && !itemId.isEmpty()) {
      try {
        String userId = QuickstartApplication.supabaseService.findUserIdByItem(itemId);
        if (userId != null) {
          QuickstartApplication.supabaseService.markTransactionCacheStale(userId, itemId);
          SpendingReviewResource.TRANSACTION_CACHE.remove(userId);
          SpendingReviewResource.BALANCE_CACHE.remove(userId);
        }
      } catch (Exception e) {
        LOG.warn("Webhook cache invalidation failed for item={}: {}", itemId, e.getMessage());
      }
    }
    return Response.ok("{\"received\":true}").build();
  }
}
