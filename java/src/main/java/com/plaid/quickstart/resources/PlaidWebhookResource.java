package com.plaid.quickstart.resources;

import com.fasterxml.jackson.databind.JsonNode;
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

  @POST
  public Response handleWebhook(JsonNode body) {
    if (body != null) {
      String type = body.path("webhook_type").asText("UNKNOWN");
      String code = body.path("webhook_code").asText("UNKNOWN");
      String itemId = body.path("item_id").asText("");
      LOG.info("Plaid webhook received: {}/{} for item={}", type, code, itemId);
      // TRANSACTIONS_SYNC_UPDATES_AVAILABLE → invalidate transaction cache for this item
      // TODO: look up user by item_id and clear SpendingReviewResource.TRANSACTION_CACHE
    }
    return Response.ok("{\"received\":true}").build();
  }
}
