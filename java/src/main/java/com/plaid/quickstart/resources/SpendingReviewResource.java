package com.plaid.quickstart.resources;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plaid.client.model.AccountsGetRequest;
import com.plaid.client.model.AccountsGetResponse;
import com.plaid.client.model.RemovedTransaction;
import com.plaid.client.model.Transaction;
import com.plaid.client.model.TransactionsSyncRequest;
import com.plaid.client.model.TransactionsSyncResponse;
import com.plaid.client.model.TransactionsUpdateStatus;
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
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Path("/spending_review")
@Produces(MediaType.APPLICATION_JSON)
public class SpendingReviewResource {
  private static final Logger LOG = LoggerFactory.getLogger(SpendingReviewResource.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("MMM yyyy");
  private static final DateTimeFormatter PERIOD_LABEL = DateTimeFormatter.ofPattern("MMMM yyyy");
  private static final TypeReference<List<StoredTx>> TX_LIST_TYPE = new TypeReference<List<StoredTx>>() {};

  // How long a Supabase transaction cache entry is considered fresh before a delta sync is needed
  private static final long CACHE_FRESH_MINUTES = 30;

  private final PlaidApi plaidClient;
  private final JwtValidator jwtValidator;

  // ── In-memory caches ──────────────────────────────────────────────────────
  public static final Map<String, CachedTransactions> TRANSACTION_CACHE = new ConcurrentHashMap<>();

  // One sync per user at a time — concurrent requests share the in-flight result instead of each hitting Plaid
  private static final Map<String, CompletableFuture<CachedTransactions>> IN_FLIGHT = new ConcurrentHashMap<>();

  // Items list cache — avoids a Supabase round-trip on every spending_review call
  public static final Map<String, CachedItems> ITEMS_CACHE = new ConcurrentHashMap<>();

  private static class CachedItems {
    final List<SupabaseService.PlaidItem> items;
    private final Instant cachedAt;
    CachedItems(List<SupabaseService.PlaidItem> items) { this.items = items; this.cachedAt = Instant.now(); }
    boolean isStale() { return Duration.between(cachedAt, Instant.now()).toMinutes() >= 5; }
  }

  // Account balance cache — saves a Plaid round-trip per dashboard load; 2-minute TTL
  public static final Map<String, CachedBalances> BALANCE_CACHE = new ConcurrentHashMap<>();

  private static class CachedBalances {
    final List<AccountSummary> accounts;
    private final Instant cachedAt;
    CachedBalances(List<AccountSummary> accounts) { this.accounts = accounts; this.cachedAt = Instant.now(); }
    boolean isStale() { return Duration.between(cachedAt, Instant.now()).toSeconds() >= 120; }
  }

  public static class CachedTransactions {
    public final List<StoredTx> transactions;
    public final Instant syncedAt;     // when data was last fetched from Plaid
    private final Instant cachedAt;    // when this entry was put in memory
    final boolean complete;

    public CachedTransactions(List<StoredTx> txns, Instant syncedAt) { this(txns, syncedAt, true); }

    CachedTransactions(List<StoredTx> txns, Instant syncedAt, boolean complete) {
      this.complete = complete;
      this.transactions = txns;
      this.syncedAt = syncedAt != null ? syncedAt : Instant.now();
      this.cachedAt = Instant.now();
    }

    public boolean isStale() {
      return Duration.between(cachedAt, Instant.now()).toMinutes() >= 5;
    }
  }

  // ── Minimal serializable transaction (avoids storing the full Plaid SDK object) ──
  public static class StoredTx {
    @JsonProperty public String tid;   // transaction_id
    @JsonProperty public String name;
    @JsonProperty public String merch; // merchant_name
    @JsonProperty public double amt;
    @JsonProperty public String dt;    // ISO date "YYYY-MM-DD"
    @JsonProperty public List<String> cats;
    @JsonProperty public String logo;
  }

  // ── Helper: convert Plaid Transaction → StoredTx ──────────────────────────
  private static StoredTx toStoredTx(Transaction t) {
    StoredTx s = new StoredTx();
    s.tid   = t.getTransactionId();
    s.name  = t.getName();
    s.merch = t.getMerchantName();
    s.amt   = t.getAmount() != null ? t.getAmount() : 0;
    s.dt    = t.getDate() != null ? t.getDate().toString() : null;
    s.cats  = t.getCategory();
    s.logo  = t.getLogoUrl();
    return s;
  }

  private static String ym(StoredTx t) {
    return (t.dt == null || t.dt.length() < 7) ? null : t.dt.substring(0, 7);
  }

  private static String displayName(StoredTx t) {
    return (t.merch != null && !t.merch.isEmpty()) ? t.merch : (t.name != null ? t.name : "Unknown");
  }

  // ── Request/response model classes ────────────────────────────────────────

  public static class BudgetGoal {
    @JsonProperty public String category;
    @JsonProperty("monthly_limit") public double monthly_limit;
  }

  public static class SpendingReviewRequest {
    @JsonProperty public List<BudgetGoal> budgets = new ArrayList<>();
    @JsonProperty("avoid_categories") public List<String> avoid_categories = new ArrayList<>();
    @JsonProperty public Integer year;
    @JsonProperty public Integer month;
    @JsonProperty("user_id") public String userId;
  }

  public static class SimpleTransaction {
    @JsonProperty public String name;
    @JsonProperty public double amount;
    @JsonProperty public String date;
    SimpleTransaction(String name, double amount, String date) {
      this.name = name; this.amount = amount; this.date = date;
    }
  }

  public static class UnusualTransaction extends SimpleTransaction {
    @JsonProperty public List<String> category;
    @JsonProperty public String reason;
    UnusualTransaction(String name, double amount, String date, List<String> cats, String reason) {
      super(name, amount, date); this.category = cats; this.reason = reason;
    }
  }

  public static class GoalViolation {
    @JsonProperty public String category;
    @JsonProperty("monthly_limit") public double monthly_limit;
    @JsonProperty("amount_spent")  public double amount_spent;
    @JsonProperty("over_by")       public double over_by;
    @JsonProperty public List<SimpleTransaction> transactions;
    @JsonProperty("is_avoid_category") public boolean is_avoid_category;
    GoalViolation(String cat, double limit, double spent, double over,
                  List<SimpleTransaction> txs, boolean isAvoid) {
      this.category = cat; this.monthly_limit = limit; this.amount_spent = spent;
      this.over_by = over; this.transactions = txs; this.is_avoid_category = isAvoid;
    }
  }

  public static class ReviewStats {
    @JsonProperty("transactions_analyzed") public int transactions_analyzed;
    @JsonProperty("total_spent") public double total_spent;
    @JsonProperty public String period;
    ReviewStats(int n, double spent, String period) {
      this.transactions_analyzed = n; this.total_spent = spent; this.period = period;
    }
  }

  public static class MerchantSummary {
    @JsonProperty public String name;
    @JsonProperty("total_amount") public double total_amount;
    @JsonProperty("visit_count")  public int visit_count;
    MerchantSummary(String name, double amt, int visits) {
      this.name = name; this.total_amount = amt; this.visit_count = visits;
    }
  }

  public static class SubscriptionItem {
    @JsonProperty public String name;
    @JsonProperty public double amount;
    @JsonProperty public String frequency;
    @JsonProperty("last_date")       public String last_date;
    @JsonProperty("months_detected") public int months_detected;
    SubscriptionItem(String name, double amt, String freq, String lastDate, int months) {
      this.name = name; this.amount = amt; this.frequency = freq;
      this.last_date = lastDate; this.months_detected = months;
    }
  }

  public static class PreviousMonthSummary {
    @JsonProperty("total_spent")           public double total_spent;
    @JsonProperty("transactions_analyzed") public int transactions_analyzed;
    PreviousMonthSummary(double spent, int n) { this.total_spent = spent; this.transactions_analyzed = n; }
  }

  public static class TransactionSummary {
    @JsonProperty public String name;
    @JsonProperty public double amount;
    @JsonProperty public String date;
    @JsonProperty public String category;
    @JsonProperty("logo_url")       public String logoUrl;
    @JsonProperty("transaction_id") public String transactionId;
    TransactionSummary(String name, double amount, String date, String cat, String logo, String tid) {
      this.name = name; this.amount = amount; this.date = date;
      this.category = cat; this.logoUrl = logo; this.transactionId = tid;
    }
  }

  public static class CategorySummary {
    @JsonProperty public String category;
    @JsonProperty("amount_spent")     public double amount_spent;
    @JsonProperty("monthly_limit")    public double monthly_limit;
    @JsonProperty public boolean avoid;
    @JsonProperty("transaction_count") public int transaction_count;
    CategorySummary(String cat, double spent, double limit, boolean avoid, int n) {
      this.category = cat; this.amount_spent = spent; this.monthly_limit = limit;
      this.avoid = avoid; this.transaction_count = n;
    }
  }

  public static class AccountSummary {
    @JsonProperty public String name;
    @JsonProperty public String type;
    @JsonProperty public String subtype;
    @JsonProperty public String mask;
    @JsonProperty public double current;
    @JsonProperty public double available;
    @JsonProperty public double limit;
    AccountSummary(String name, String type, String subtype, String mask,
                   double current, double available, double limit) {
      this.name = name; this.type = type; this.subtype = subtype; this.mask = mask;
      this.current = current; this.available = available; this.limit = limit;
    }
  }

  public static class MonthlyTrend {
    @JsonProperty public int year;
    @JsonProperty public int month;
    @JsonProperty public String label;
    @JsonProperty("total_spent") public double total_spent;
    MonthlyTrend(int year, int month, String label, double spent) {
      this.year = year; this.month = month; this.label = label; this.total_spent = spent;
    }
  }

  private static final List<String> PRESET_CATEGORIES = Arrays.asList(
      "Food and Drink", "Shops", "Travel", "Recreation",
      "Healthcare", "Service", "Transfer", "Payment");

  public static class SpendingReviewResponse {
    @JsonProperty("unusual_transactions") public List<UnusualTransaction> unusual_transactions;
    @JsonProperty("goal_violations")      public List<GoalViolation> goal_violations;
    @JsonProperty public ReviewStats stats;
    @JsonProperty("top_merchants")        public List<MerchantSummary> top_merchants;
    @JsonProperty public List<SubscriptionItem> subscriptions;
    @JsonProperty("previous_month")       public PreviousMonthSummary previous_month;
    @JsonProperty("all_transactions")     public List<TransactionSummary> all_transactions;
    @JsonProperty("category_spending")    public List<CategorySummary> category_spending;
    @JsonProperty public List<AccountSummary> accounts;
    @JsonProperty("monthly_trends")       public List<MonthlyTrend> monthly_trends;
    @JsonProperty("synced_at")            public String synced_at;  // ISO instant — when data was last fetched from Plaid
    @JsonProperty public boolean syncing;   // true while a bank's data is still settling; the UI re-fetches

    SpendingReviewResponse(List<UnusualTransaction> unusual, List<GoalViolation> violations,
                           ReviewStats stats, List<MerchantSummary> topMerchants,
                           List<SubscriptionItem> subscriptions, PreviousMonthSummary prevMonth,
                           List<TransactionSummary> allTxns, List<CategorySummary> catSpending,
                           List<AccountSummary> accounts, List<MonthlyTrend> trends, String syncedAt,
                           boolean syncing) {
      this.syncing = syncing;
      this.unusual_transactions = unusual; this.goal_violations = violations;
      this.stats = stats; this.top_merchants = topMerchants; this.subscriptions = subscriptions;
      this.previous_month = prevMonth; this.all_transactions = allTxns;
      this.category_spending = catSpending; this.accounts = accounts;
      this.monthly_trends = trends; this.synced_at = syncedAt;
    }
  }

  public SpendingReviewResource(PlaidApi plaidClient, JwtValidator jwtValidator) {
    this.plaidClient = plaidClient;
    this.jwtValidator = jwtValidator;
  }

  // ── Endpoint ───────────────────────────────────────────────────────────────

  @POST
  @Consumes(MediaType.APPLICATION_JSON)
  public SpendingReviewResponse runReview(
      @HeaderParam("Authorization") String authHeader,
      SpendingReviewRequest request)
      throws IOException, InterruptedException {

    String userId = jwtValidator.requireUserId(authHeader);
    List<SupabaseService.PlaidItem> items = resolveAllItems(userId);

    // Fetch transactions and account balances in parallel — they're independent Plaid calls
    CompletableFuture<CachedTransactions> txFuture = CompletableFuture.supplyAsync(() -> {
      try { return fetchAllTransactions(userId, items); }
      catch (Exception e) { throw new RuntimeException(e); }
    });
    CompletableFuture<List<AccountSummary>> balFuture = CompletableFuture.supplyAsync(() ->
        fetchAllAccountBalancesCached(userId, items));

    CachedTransactions cache;
    try {
      cache = txFuture.join();
    } catch (java.util.concurrent.CompletionException e) {
      throw unwrap(e);
    }
    List<AccountSummary> accounts = balFuture.join();

    List<StoredTx> outflows = cache.transactions.stream()
        .filter(t -> t.amt > 0)
        .collect(Collectors.toList());
    // Card payments and transfers move money between accounts; counting them double-counts real spending
    List<StoredTx> debits = outflows.stream()
        .filter(t -> !isMoneyMovement(t))
        .collect(Collectors.toList());

    YearMonth targetMonth = (request.year != null && request.month != null)
        ? YearMonth.of(request.year, request.month)
        : YearMonth.now();
    String targetKey = targetMonth.toString();

    List<StoredTx> thisMonthOutflows = outflows.stream()
        .filter(t -> targetKey.equals(ym(t)))
        .collect(Collectors.toList());
    List<StoredTx> thisMonthDebits = thisMonthOutflows.stream()
        .filter(t -> !isMoneyMovement(t))
        .collect(Collectors.toList());

    String prevKey = targetMonth.minusMonths(1).toString();
    List<StoredTx> prevMonthDebits = debits.stream()
        .filter(t -> prevKey.equals(ym(t)))
        .collect(Collectors.toList());
    PreviousMonthSummary prevSummary = new PreviousMonthSummary(
        round2(prevMonthDebits.stream().mapToDouble(t -> t.amt).sum()),
        prevMonthDebits.size());

    double totalSpent = round2(thisMonthDebits.stream().mapToDouble(t -> t.amt).sum());
    String period = targetMonth.format(PERIOD_LABEL);

    return new SpendingReviewResponse(
        detectUnusual(debits, thisMonthDebits),
        checkGoals(request, thisMonthOutflows),
        new ReviewStats(thisMonthDebits.size(), totalSpent, period),
        computeTopMerchants(thisMonthDebits),
        detectSubscriptions(debits),
        prevSummary,
        toTransactionSummaries(thisMonthOutflows),
        computeCategorySpending(request, thisMonthOutflows),
        accounts,
        computeMonthlyTrends(debits, targetMonth),
        cache.syncedAt.toString(),
        !cache.complete);
  }

  private static boolean isMoneyMovement(StoredTx t) {
    if (t.cats == null || t.cats.isEmpty()) return false;
    String top = t.cats.get(0);
    return "Transfer".equalsIgnoreCase(top) || "Payment".equalsIgnoreCase(top);
  }

  private static RuntimeException unwrap(Throwable e) {
    while ((e instanceof java.util.concurrent.CompletionException || e.getClass() == RuntimeException.class)
        && e.getCause() != null) e = e.getCause();
    return e instanceof RuntimeException ? (RuntimeException) e : new RuntimeException(e);
  }

  // ── Token resolution ───────────────────────────────────────────────────────

  private List<SupabaseService.PlaidItem> resolveAllItems(String userId) {
    CachedItems cached = ITEMS_CACHE.get(userId);
    if (cached != null && !cached.isStale()) return cached.items;

    try {
      List<SupabaseService.PlaidItem> items = QuickstartApplication.supabaseService.getItems(userId);
      if (!items.isEmpty()) {
        ITEMS_CACHE.put(userId, new CachedItems(items));
        return items;
      }
    } catch (Exception e) {
      LOG.warn("Could not load plaid_items for user {}: {}", userId, e.getMessage());
    }

    // Legacy fallback: single token from userTokens map or user_profiles
    String token = QuickstartApplication.userTokens.get(userId);
    if (token == null) {
      try {
        token = QuickstartApplication.supabaseService.getAccessToken(userId);
        if (token != null) QuickstartApplication.userTokens.put(userId, token);
      } catch (Exception e) {
        LOG.warn("Failed to fetch access token from Supabase for user {}: {}", userId, e.getMessage());
      }
    }
    if (token != null) {
      return List.of(new SupabaseService.PlaidItem("legacy", token, "Connected Bank", null));
    }

    throw new WebApplicationException(
        Response.status(Response.Status.FORBIDDEN)
            .entity("{\"error\":\"No Plaid connection found. Please connect your bank account.\"}")
            .type("application/json").build());
  }

  // ── Transaction fetching with 3-tier cache ─────────────────────────────────

  private CachedTransactions fetchAllTransactions(String userId,
      List<SupabaseService.PlaidItem> items) throws IOException, InterruptedException {

    // Tier 1: in-memory cache (5-min TTL — serves repeated requests without hitting Supabase)
    CachedTransactions mem = TRANSACTION_CACHE.get(userId);
    if (mem != null && !mem.isStale()) return mem;

    CompletableFuture<CachedTransactions> mine = new CompletableFuture<>();
    CompletableFuture<CachedTransactions> running = IN_FLIGHT.putIfAbsent(userId, mine);
    if (running != null) {
      try { return running.join(); }
      catch (java.util.concurrent.CompletionException e) { throw unwrap(e); }
    }
    try {
      CachedTransactions result = syncAllItems(userId, items);
      mine.complete(result);
      return result;
    } catch (RuntimeException e) {
      mine.completeExceptionally(e);
      throw e;
    } finally {
      IN_FLIGHT.remove(userId, mine);
    }
  }

  private CachedTransactions syncAllItems(String userId, List<SupabaseService.PlaidItem> items) {
    // Tier 2 + 3: per-item Supabase cache + delta sync
    List<StoredTx> merged = new ArrayList<>();
    Instant latestSync = Instant.EPOCH;
    RuntimeException lastError = null;
    int ok = 0;
    boolean allComplete = true;

    for (SupabaseService.PlaidItem item : items) {
      try {
        ItemSyncResult result = fetchTransactionsForItem(userId, item);
        merged.addAll(result.transactions);
        if (result.syncedAt.isAfter(latestSync)) latestSync = result.syncedAt;
        allComplete &= result.complete;
        ok++;
      } catch (Exception e) {
        LOG.warn("Skipping item={} for user={} — sync failed: {}", item.itemId, userId, e.getMessage());
        lastError = e instanceof RuntimeException ? (RuntimeException) e : new RuntimeException(e);
      }
    }
    if (ok == 0 && lastError != null) throw lastError;

    CachedTransactions cached = new CachedTransactions(merged, latestSync, allComplete);
    // Partial history (item still loading at Plaid) must not be served from memory for 5 minutes
    if (allComplete) TRANSACTION_CACHE.put(userId, cached);
    return cached;
  }

  private static class ItemSyncResult {
    final List<StoredTx> transactions;
    final Instant syncedAt;
    final boolean complete;
    ItemSyncResult(List<StoredTx> t, Instant s, boolean c) { transactions = t; syncedAt = s; complete = c; }
  }

  private static class SyncOutcome {
    final String cursor;
    final TransactionsUpdateStatus status;
    final int changes;
    SyncOutcome(String cursor, TransactionsUpdateStatus status, int changes) {
      this.cursor = cursor; this.status = status; this.changes = changes;
    }
  }

  private ItemSyncResult fetchTransactionsForItem(String userId, SupabaseService.PlaidItem item)
      throws IOException, InterruptedException {

    // Tier 2: Supabase persistent cache
    SupabaseService.TransactionCacheEntry supaCache = null;
    try {
      supaCache = QuickstartApplication.supabaseService.getTransactionCache(userId, item.itemId);
    } catch (Exception e) {
      LOG.warn("Could not load transaction cache from Supabase for item={}: {}", item.itemId, e.getMessage());
    }

    boolean cacheIsFresh = supaCache != null
        && Duration.between(supaCache.lastSyncedAt, Instant.now()).toMinutes() < CACHE_FRESH_MINUTES;

    if (cacheIsFresh) {
      // Serve from Supabase cache — zero Plaid API calls
      LOG.debug("Serving from Supabase cache for item={} (last synced {})", item.itemId, supaCache.lastSyncedAt);
      List<StoredTx> txns = deserializeTransactions(supaCache.transactionsJson);
      return new ItemSyncResult(txns, supaCache.lastSyncedAt, true);
    }

    // Tier 3: Plaid delta sync (or full sync on first ever use)
    String startCursor = supaCache != null ? supaCache.cursor : null;
    Map<String, StoredTx> existingById = new LinkedHashMap<>();
    if (supaCache != null) {
      for (StoredTx t : deserializeTransactions(supaCache.transactionsJson)) {
        if (t.tid != null) existingById.put(t.tid, t);
      }
    }

    String action = startCursor != null ? "delta sync" : "full sync";
    LOG.info("Plaid {} for item={} (existing={} txns)", action, item.itemId, existingById.size());

    SyncOutcome outcome = doSync(item.accessToken, startCursor, existingById);
    // A just-linked item returns nothing for a few seconds, even after Plaid reports the update complete
    for (int i = 0; i < 10 && existingById.isEmpty(); i++) {
      Thread.sleep(1000);
      outcome = doSync(item.accessToken, outcome.cursor, existingById);
    }
    String newCursor = outcome.cursor;
    // ponytail: "settled" = a pass with no changes. Early batches on new items get revised (late rows,
    // late categories), so changed data is served but kept stale until a quiet pass. Costs one extra
    // delta sync after each change; switch to webhook-driven freshness once PLAID_WEBHOOK_URL is set everywhere.
    boolean complete = outcome.changes == 0 && outcome.status != TransactionsUpdateStatus.NOT_READY;
    List<StoredTx> updated = new ArrayList<>(existingById.values());

    // Best-effort, off the request path: serializing + uploading full history is the slowest step of a sync
    CompletableFuture.runAsync(() -> {
      try {
        String json = serializeTransactions(updated);
        QuickstartApplication.supabaseService.storeTransactionCache(userId, item.itemId, json, newCursor, complete);
      } catch (Exception e) {
        LOG.warn("Could not persist transaction cache for item={}: {}", item.itemId, e.getMessage());
      }
    });

    return new ItemSyncResult(updated, Instant.now(), complete);
  }

  /**
   * Runs a Plaid TransactionsSync loop (delta if cursor is set, full if null).
   * Mutates {@code byId} in-place (add/modify/remove) and returns the final cursor.
   */
  private SyncOutcome doSync(String accessToken, String startCursor, Map<String, StoredTx> byId)
      throws IOException, InterruptedException {
    String cursor = startCursor;
    boolean hasMore = true;
    int retries = 0;
    int changes = 0;
    TransactionsUpdateStatus status = null;

    while (hasMore) {
      TransactionsSyncRequest req = new TransactionsSyncRequest()
          .accessToken(accessToken)
          .cursor(cursor);
      TransactionsSyncResponse resp = PlaidApiHelper.callPlaid(plaidClient.transactionsSync(req));
      status = resp.getTransactionsUpdateStatus();
      changes += size(resp.getAdded()) + size(resp.getModified()) + size(resp.getRemoved());

      // New transactions
      if (resp.getAdded() != null) {
        for (Transaction t : resp.getAdded()) {
          if (t.getTransactionId() != null) byId.put(t.getTransactionId(), toStoredTx(t));
        }
      }
      // Updated transactions
      if (resp.getModified() != null) {
        for (Transaction t : resp.getModified()) {
          if (t.getTransactionId() != null) byId.put(t.getTransactionId(), toStoredTx(t));
        }
      }
      // Deleted transactions
      if (resp.getRemoved() != null) {
        for (RemovedTransaction r : resp.getRemoved()) {
          if (r.getTransactionId() != null) byId.remove(r.getTransactionId());
        }
      }

      hasMore = Boolean.TRUE.equals(resp.getHasMore());
      String nc = resp.getNextCursor();
      if (nc != null && !nc.isEmpty()) {
        cursor = nc;
        retries = 0;
      } else if (hasMore) {
        if (++retries > 10) {
          LOG.warn("Plaid sync still incomplete after 10 retries — using {} transactions", byId.size());
          break;
        }
        Thread.sleep(2000);
      }
    }
    return new SyncOutcome(cursor, status, changes);
  }

  private static int size(List<?> l) { return l == null ? 0 : l.size(); }


  // ── Serialization helpers ──────────────────────────────────────────────────

  private String serializeTransactions(List<StoredTx> txns) throws IOException {
    return MAPPER.writeValueAsString(txns);
  }

  private List<StoredTx> deserializeTransactions(String json) {
    if (json == null || json.isEmpty() || "[]".equals(json)) return new ArrayList<>();
    try {
      return MAPPER.readValue(json, TX_LIST_TYPE);
    } catch (Exception e) {
      LOG.warn("Failed to deserialize transaction cache: {}", e.getMessage());
      return new ArrayList<>();
    }
  }

  // ── Account balances ───────────────────────────────────────────────────────

  private List<AccountSummary> fetchAllAccountBalancesCached(String userId, List<SupabaseService.PlaidItem> items) {
    CachedBalances cached = BALANCE_CACHE.get(userId);
    if (cached != null && !cached.isStale()) return cached.accounts;
    List<AccountSummary> accounts = fetchAllAccountBalances(items);
    BALANCE_CACHE.put(userId, new CachedBalances(accounts));
    return accounts;
  }

  private List<AccountSummary> fetchAllAccountBalances(List<SupabaseService.PlaidItem> items) {
    List<AccountSummary> merged = new ArrayList<>();
    for (SupabaseService.PlaidItem item : items) merged.addAll(fetchAccountBalances(item.accessToken));
    return merged;
  }

  private List<AccountSummary> fetchAccountBalances(String accessToken) {
    try {
      // /accounts/get returns Plaid's last-synced balances. /accounts/balance/get forces a live bank
      // round-trip (seconds, and billed per call in production) — not worth it for a dashboard.
      AccountsGetRequest req = new AccountsGetRequest().accessToken(accessToken);
      AccountsGetResponse resp = PlaidApiHelper.callPlaid(plaidClient.accountsGet(req));
      return resp.getAccounts().stream()
          .map(a -> new AccountSummary(
              a.getName() != null ? a.getName() : "Account",
              a.getType() != null ? a.getType().getValue() : "other",
              a.getSubtype() != null ? a.getSubtype().getValue() : "",
              a.getMask() != null ? a.getMask() : "",
              a.getBalances().getCurrent() != null ? a.getBalances().getCurrent() : 0,
              a.getBalances().getAvailable() != null ? a.getBalances().getAvailable() : 0,
              a.getBalances().getLimit() != null ? a.getBalances().getLimit() : 0))
          .collect(Collectors.toList());
    } catch (Exception e) {
      LOG.warn("Failed to fetch account balances: {}", e.getMessage());
      return new ArrayList<>();
    }
  }

  // ── Analysis methods (all use StoredTx) ───────────────────────────────────

  private List<MonthlyTrend> computeMonthlyTrends(List<StoredTx> debits, YearMonth anchor) {
    Map<String, Double> byMonth = new HashMap<>();
    for (StoredTx t : debits) {
      String k = ym(t);
      if (k != null) byMonth.merge(k, t.amt, Double::sum);
    }
    List<MonthlyTrend> result = new ArrayList<>();
    for (int i = 5; i >= 0; i--) {
      YearMonth m = anchor.minusMonths(i);
      double total = round2(byMonth.getOrDefault(m.toString(), 0.0));
      result.add(new MonthlyTrend(m.getYear(), m.getMonthValue(),
          m.format(MONTH_LABEL), total));
    }
    return result;
  }

  private List<UnusualTransaction> detectUnusual(List<StoredTx> allDebits, List<StoredTx> thisMonth) {
    if (allDebits.size() < 2) return new ArrayList<>();
    double[] amounts = allDebits.stream().mapToDouble(t -> t.amt).toArray();
    double mean = 0;
    for (double a : amounts) mean += a;
    mean /= amounts.length;
    double variance = 0;
    for (double a : amounts) variance += (a - mean) * (a - mean);
    double stdDev = amounts.length > 1 ? Math.sqrt(variance / (amounts.length - 1)) : 0;
    double threshold = mean + 2 * stdDev;
    double finalMean = mean;

    List<UnusualTransaction> result = new ArrayList<>();
    for (StoredTx t : thisMonth) {
      boolean outlier = t.amt > threshold;
      boolean absolutelyLarge = t.amt > 500 && finalMean < 100;
      if (outlier || absolutelyLarge) {
        String reason = finalMean > 0
            ? String.format("%.1fx your avg transaction ($%.0f)", round1(t.amt / finalMean), finalMean)
            : String.format("Unusually large: $%.2f", t.amt);
        result.add(new UnusualTransaction(t.name, t.amt, t.dt != null ? t.dt : "",
            t.cats != null ? t.cats : new ArrayList<>(), reason));
      }
    }
    return result;
  }

  private List<GoalViolation> checkGoals(SpendingReviewRequest request, List<StoredTx> debits) {
    List<GoalViolation> violations = new ArrayList<>();
    for (BudgetGoal goal : request.budgets) {
      List<StoredTx> matching = debits.stream().filter(t -> matchesCat(t.cats, goal.category)).collect(Collectors.toList());
      double total = round2(matching.stream().mapToDouble(t -> t.amt).sum());
      if (total > goal.monthly_limit) {
        violations.add(new GoalViolation(goal.category, goal.monthly_limit, total,
            round2(total - goal.monthly_limit), toSimple(matching), false));
      }
    }
    for (String avoid : request.avoid_categories) {
      List<StoredTx> matching = debits.stream().filter(t -> matchesCat(t.cats, avoid)).collect(Collectors.toList());
      if (!matching.isEmpty()) {
        double total = round2(matching.stream().mapToDouble(t -> t.amt).sum());
        violations.add(new GoalViolation(avoid, 0, total, total, toSimple(matching), true));
      }
    }
    return violations;
  }

  private List<MerchantSummary> computeTopMerchants(List<StoredTx> debits) {
    Map<String, double[]> byMerchant = new HashMap<>();
    for (StoredTx t : debits) {
      String name = displayName(t);
      byMerchant.computeIfAbsent(name, k -> new double[]{0, 0});
      byMerchant.get(name)[0] += t.amt;
      byMerchant.get(name)[1] += 1;
    }
    return byMerchant.entrySet().stream()
        .map(e -> new MerchantSummary(e.getKey(), round2(e.getValue()[0]), (int) e.getValue()[1]))
        .sorted(Comparator.comparingDouble((MerchantSummary m) -> m.total_amount).reversed())
        .limit(8).collect(Collectors.toList());
  }

  private List<SubscriptionItem> detectSubscriptions(List<StoredTx> allDebits) {
    Map<String, List<StoredTx>> byMerchant = new HashMap<>();
    for (StoredTx t : allDebits) {
      if (t.dt == null) continue;
      byMerchant.computeIfAbsent(displayName(t), k -> new ArrayList<>()).add(t);
    }

    List<SubscriptionItem> result = new ArrayList<>();
    for (Map.Entry<String, List<StoredTx>> e : byMerchant.entrySet()) {
      List<StoredTx> txs = e.getValue();
      if (txs.size() < 2) continue;
      Set<String> months = txs.stream().map(t -> ym(t)).filter(m -> m != null).collect(Collectors.toSet());
      if (months.size() < 2) continue;
      double avg = txs.stream().mapToDouble(t -> t.amt).average().orElse(0);
      if (avg <= 0) continue;
      long consistent = txs.stream().filter(t -> Math.abs(t.amt - avg) / avg <= 0.10).count();
      if (consistent < (long) (txs.size() * 0.8)) continue;
      String lastDate = txs.stream().filter(t -> t.dt != null)
          .max(Comparator.comparing(t -> t.dt)).map(t -> t.dt).orElse("");
      String freq = months.size() >= 3 ? "monthly" : "recurring";
      result.add(new SubscriptionItem(e.getKey(), round2(avg), freq, lastDate, months.size()));
    }
    return result.stream()
        .sorted(Comparator.comparingDouble((SubscriptionItem s) -> s.amount).reversed())
        .limit(10).collect(Collectors.toList());
  }

  private List<TransactionSummary> toTransactionSummaries(List<StoredTx> txs) {
    return txs.stream()
        .filter(t -> t.dt != null)
        .sorted(Comparator.comparing((StoredTx t) -> t.dt).reversed())
        .map(t -> new TransactionSummary(displayName(t), t.amt, t.dt, primaryCat(t.cats), t.logo, t.tid))
        .collect(Collectors.toList());
  }

  private List<CategorySummary> computeCategorySpending(SpendingReviewRequest request, List<StoredTx> debits) {
    Map<String, Double> budgetMap = new HashMap<>();
    for (BudgetGoal g : request.budgets) budgetMap.put(g.category, g.monthly_limit);
    Set<String> avoidSet = new java.util.HashSet<>(request.avoid_categories);
    Set<String> allCats = new java.util.LinkedHashSet<>(PRESET_CATEGORIES);
    allCats.addAll(budgetMap.keySet());
    allCats.addAll(avoidSet);

    List<CategorySummary> result = new ArrayList<>();
    for (String cat : allCats) {
      // Transfers/payments aren't in total_spent; only list them when the user tracks them
      boolean movement = "Transfer".equalsIgnoreCase(cat) || "Payment".equalsIgnoreCase(cat);
      if (movement && !budgetMap.containsKey(cat) && !avoidSet.contains(cat)) continue;
      List<StoredTx> matching = debits.stream().filter(t -> matchesCat(t.cats, cat)).collect(Collectors.toList());
      double total = round2(matching.stream().mapToDouble(t -> t.amt).sum());
      result.add(new CategorySummary(cat, total, budgetMap.getOrDefault(cat, 0.0), avoidSet.contains(cat), matching.size()));
    }
    return result;
  }

  // ── Category matching helpers ──────────────────────────────────────────────

  private boolean matchesCat(List<String> cats, String target) {
    return cats != null && !cats.isEmpty() && cats.get(0).equalsIgnoreCase(target);
  }

  private String primaryCat(List<String> cats) {
    return (cats == null || cats.isEmpty()) ? "Other" : cats.get(0);
  }

  private List<SimpleTransaction> toSimple(List<StoredTx> txs) {
    return txs.stream()
        .map(t -> new SimpleTransaction(t.name != null ? t.name : "Unknown", t.amt, t.dt != null ? t.dt : ""))
        .collect(Collectors.toList());
  }

  private static double round2(double v) { return Math.round(v * 100.0) / 100.0; }
  private static double round1(double v) { return Math.round(v * 10.0) / 10.0; }
}
