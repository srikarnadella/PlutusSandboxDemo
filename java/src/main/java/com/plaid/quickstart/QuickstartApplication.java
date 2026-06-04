package com.plaid.quickstart;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.plaid.client.ApiClient;
import com.plaid.client.model.CountryCode;
import com.plaid.client.model.Products;
import com.plaid.client.request.PlaidApi;
import com.plaid.quickstart.resources.*;
import io.dropwizard.Application;
import io.dropwizard.configuration.EnvironmentVariableSubstitutor;
import io.dropwizard.configuration.SubstitutingSourceProvider;
import io.dropwizard.setup.Bootstrap;
import io.dropwizard.setup.Environment;
import org.eclipse.jetty.servlets.CrossOriginFilter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.DispatcherType;
import javax.servlet.FilterRegistration;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

public class QuickstartApplication extends Application<QuickstartConfiguration> {
  private static final Logger LOG = LoggerFactory.getLogger(QuickstartApplication.class);

  // Per-user Plaid access tokens
  public static final Map<String, String> userTokens = new ConcurrentHashMap<>();
  public static SupabaseService supabaseService;

  // Legacy globals kept for unregistered quickstart resource source files that still compile
  public static String accessToken;
  public static String userToken;
  public static String userId;
  public static String itemId;
  public static String paymentId;
  public static String authorizationId;
  public static String accountId;

  private PlaidApi plaidClient;
  private ApiClient apiClient;

  public static void main(final String[] args) throws Exception {
    new QuickstartApplication().run(args);
  }

  @Override
  public String getName() { return "Plutus"; }

  @Override
  public void initialize(final Bootstrap<QuickstartConfiguration> bootstrap) {
    bootstrap.getObjectMapper().setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);
    bootstrap.setConfigurationSourceProvider(
        new SubstitutingSourceProvider(bootstrap.getConfigurationSourceProvider(),
            new EnvironmentVariableSubstitutor(false)));
  }

  @Override
  public void run(final QuickstartConfiguration configuration, final Environment environment) {
    // ── Plaid client ──────────────────────────────────────────────────────────
    String plaidEnv;
    switch (configuration.getPlaidEnv()) {
      case "production": plaidEnv = ApiClient.Production; break;
      default: plaidEnv = ApiClient.Sandbox;
    }

    String plaidClientId = System.getenv("PLAID_CLIENT_ID");
    String plaidSecret   = System.getenv("PLAID_SECRET");

    Map<String, String> apiKeys = Map.of(
        "clientId", plaidClientId != null ? plaidClientId : "",
        "secret",   plaidSecret   != null ? plaidSecret   : "",
        "plaidVersion", "2020-09-14");
    apiClient = new ApiClient(apiKeys);
    apiClient.setPlaidAdapter(plaidEnv);
    plaidClient = apiClient.createService(PlaidApi.class);

    // ── Parse product + country lists once (not per-request) ─────────────────
    List<Products> products = Arrays.stream(configuration.getPlaidProducts().split(","))
        .map(String::trim).map(Products::fromValue).collect(Collectors.toList());
    List<CountryCode> countryCodes = Arrays.stream(configuration.getPlaidCountryCodes().split(","))
        .map(String::trim).map(CountryCode::fromValue).collect(Collectors.toList());
    String redirectUri = configuration.getPlaidRedirectUri();
    if (redirectUri != null && redirectUri.isEmpty()) redirectUri = null;

    // ── Supabase + JWT ────────────────────────────────────────────────────────
    supabaseService = new SupabaseService(
        System.getenv("SUPABASE_URL"),
        System.getenv("SUPABASE_SERVICE_ROLE_KEY"));

    JwtValidator jwtValidator = new JwtValidator(
        System.getenv("SUPABASE_URL"),
        System.getenv("SUPABASE_SERVICE_ROLE_KEY"));

    // ── CORS ──────────────────────────────────────────────────────────────────
    String allowedOrigin = System.getenv("FRONTEND_ORIGIN");
    if (allowedOrigin == null || allowedOrigin.isEmpty()) allowedOrigin = "*";
    FilterRegistration.Dynamic cors = environment.servlets().addFilter("CORS", CrossOriginFilter.class);
    cors.setInitParameter(CrossOriginFilter.ALLOWED_ORIGINS_PARAM, allowedOrigin);
    cors.setInitParameter(CrossOriginFilter.ALLOWED_HEADERS_PARAM, "Authorization,Content-Type,X-Requested-With,Accept,Origin");
    cors.setInitParameter(CrossOriginFilter.ALLOWED_METHODS_PARAM, "GET,POST,PUT,DELETE,OPTIONS,HEAD");
    cors.setInitParameter(CrossOriginFilter.CHAIN_PREFLIGHT_PARAM, "false");
    cors.addMappingForUrlPatterns(EnumSet.allOf(DispatcherType.class), true, "/*");

    // ── Resources ─────────────────────────────────────────────────────────────
    environment.jersey().register(new PlaidApiExceptionMapper());
    environment.jersey().register(new HealthResource());
    environment.jersey().register(new PlaidWebhookResource());
    environment.jersey().register(new InfoResource(Arrays.asList(configuration.getPlaidProducts().split(","))));
    environment.jersey().register(new LinkTokenResource(plaidClient, products, countryCodes, redirectUri, jwtValidator));
    environment.jersey().register(new LinkTokenWithPaymentResource(plaidClient, Arrays.asList(configuration.getPlaidProducts().split(",")), Arrays.asList(configuration.getPlaidCountryCodes().split(",")), redirectUri));
    environment.jersey().register(new AccessTokenResource(plaidClient, supabaseService, jwtValidator));
    environment.jersey().register(new LinkExitErrorResource());
    environment.jersey().register(new UserTokenResource(plaidClient, Arrays.asList(configuration.getPlaidProducts().split(","))));
    environment.jersey().register(new SpendingReviewResource(plaidClient, jwtValidator));
    environment.jersey().register(new UpdateLinkTokenResource(plaidClient, jwtValidator, countryCodes));
    environment.jersey().register(new RemoveItemResource(plaidClient, jwtValidator));
    environment.jersey().register(new RefreshResource(jwtValidator));

    LOG.info("Plutus backend started — Plaid env: {}, CORS origin: {}", plaidEnv, allowedOrigin);
  }

  protected PlaidApi client() { return plaidClient; }
  protected ApiClient apiClient() { return apiClient; }
}
