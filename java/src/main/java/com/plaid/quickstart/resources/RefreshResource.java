package com.plaid.quickstart.resources;

import com.plaid.quickstart.JwtValidator;
import com.plaid.quickstart.QuickstartApplication;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.io.IOException;

@Path("/refresh_transactions")
@Produces(MediaType.APPLICATION_JSON)
public class RefreshResource {
  private static final Logger LOG = LoggerFactory.getLogger(RefreshResource.class);
  private final JwtValidator jwtValidator;

  public RefreshResource(JwtValidator jwtValidator) {
    this.jwtValidator = jwtValidator;
  }

  @POST
  public Response refresh(@HeaderParam("Authorization") String authHeader)
      throws IOException, InterruptedException {
    String userId = jwtValidator.requireUserId(authHeader);

    // Clear in-memory transaction cache so next spending_review re-reads from Supabase
    SpendingReviewResource.TRANSACTION_CACHE.remove(userId);

    // Mark Supabase transaction cache as stale so delta sync runs on next spending_review call
    try {
      QuickstartApplication.supabaseService.markTransactionCacheStale(userId);
    } catch (Exception e) {
      LOG.warn("Could not mark transaction cache stale for user {}: {}", userId, e.getMessage());
    }

    LOG.info("Transaction cache invalidated for user={} — delta sync will run on next load", userId);
    return Response.ok("{\"refreshing\":true}").build();
  }
}
