package com.plaid.quickstart.resources;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.plaid.client.model.CountryCode;
import com.plaid.client.model.LinkTokenCreateRequest;
import com.plaid.client.model.LinkTokenCreateRequestUser;
import com.plaid.client.model.LinkTokenCreateResponse;
import com.plaid.client.model.Products;
import com.plaid.client.request.PlaidApi;
import com.plaid.quickstart.JwtValidator;
import com.plaid.quickstart.PlaidApiHelper;

import javax.ws.rs.HeaderParam;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Path("/create_link_token")
@Produces(MediaType.APPLICATION_JSON)
public class LinkTokenResource {
  private final PlaidApi plaidClient;
  private final List<Products> products;
  private final List<CountryCode> countryCodes;
  private final String redirectUri;
  private final JwtValidator jwtValidator;

  public static class LinkToken {
    @JsonProperty("link_token") public final String linkToken;
    public LinkToken(String lt) { this.linkToken = lt; }
  }

  public LinkTokenResource(PlaidApi plaidClient, List<Products> products,
      List<CountryCode> countryCodes, String redirectUri, JwtValidator jwtValidator) {
    this.plaidClient = plaidClient;
    this.products = products;
    this.countryCodes = countryCodes;
    this.redirectUri = redirectUri;
    this.jwtValidator = jwtValidator;
  }

  @POST
  public LinkToken getLinkToken(@HeaderParam("Authorization") String authHeader) throws IOException {
    // Use authenticated user's UUID as clientUserId when available; fall back to random UUID
    String clientUserId = jwtValidator.tryGetUserId(authHeader);
    if (clientUserId == null) clientUserId = UUID.randomUUID().toString();

    LinkTokenCreateRequestUser user = new LinkTokenCreateRequestUser().clientUserId(clientUserId);

    LinkTokenCreateRequest request = new LinkTokenCreateRequest()
        .user(user)
        .clientName("Plutus")
        .products(products)
        .countryCodes(countryCodes)
        .language("en");

    if (redirectUri != null && !redirectUri.isEmpty()) request.redirectUri(redirectUri);

    LinkTokenCreateResponse responseBody = PlaidApiHelper.callPlaid(plaidClient.linkTokenCreate(request));
    return new LinkToken(responseBody.getLinkToken());
  }
}
