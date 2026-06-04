package com.plaid.quickstart.resources;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.plaid.client.model.CountryCode;
import com.plaid.client.model.LinkTokenCreateRequest;
import com.plaid.client.model.LinkTokenCreateRequestUser;
import com.plaid.client.model.LinkTokenCreateResponse;
import com.plaid.client.request.PlaidApi;
import com.plaid.quickstart.JwtValidator;
import com.plaid.quickstart.PlaidApiHelper;
import com.plaid.quickstart.QuickstartApplication;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.io.IOException;
import java.util.List;

@Path("/create_update_link_token")
@Produces(MediaType.APPLICATION_JSON)
public class UpdateLinkTokenResource {
  private static final Logger LOG = LoggerFactory.getLogger(UpdateLinkTokenResource.class);
  private final PlaidApi plaidClient;
  private final JwtValidator jwtValidator;
  private final List<CountryCode> countryCodes;

  public static class LinkToken {
    @JsonProperty("link_token") public final String linkToken;
    public LinkToken(String linkToken) { this.linkToken = linkToken; }
  }

  public UpdateLinkTokenResource(PlaidApi plaidClient, JwtValidator jwtValidator, List<CountryCode> countryCodes) {
    this.plaidClient = plaidClient;
    this.jwtValidator = jwtValidator;
    this.countryCodes = countryCodes;
  }

  @POST
  public LinkToken getUpdateToken(@HeaderParam("Authorization") String authHeader)
      throws IOException, InterruptedException {
    String userId = jwtValidator.requireUserId(authHeader);

    String accessToken = QuickstartApplication.userTokens.get(userId);
    if (accessToken == null) {
      try {
        accessToken = QuickstartApplication.supabaseService.getAccessToken(userId);
      } catch (Exception e) {
        LOG.warn("Could not load access token for user {}: {}", userId, e.getMessage());
      }
    }
    if (accessToken == null) {
      throw new WebApplicationException(
          Response.status(Response.Status.FORBIDDEN)
              .entity("{\"error\":\"No existing bank connection found\"}")
              .type("application/json").build());
    }

    LinkTokenCreateRequest request = new LinkTokenCreateRequest()
        .user(new LinkTokenCreateRequestUser().clientUserId(userId))
        .clientName("Plutus")
        .accessToken(accessToken)
        .countryCodes(countryCodes)
        .language("en");

    LinkTokenCreateResponse resp = PlaidApiHelper.callPlaid(plaidClient.linkTokenCreate(request));
    return new LinkToken(resp.getLinkToken());
  }
}
