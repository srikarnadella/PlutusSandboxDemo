package com.plaid.quickstart.resources;

import java.io.IOException;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.plaid.client.model.Transaction;
import com.plaid.client.model.TransactionsSyncRequest;
import com.plaid.client.model.TransactionsSyncResponse;
import com.plaid.client.request.PlaidApi;
import com.plaid.quickstart.PlaidApiHelper;
import com.plaid.quickstart.QuickstartApplication;

import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;

@Path("/spending_review")
@Produces(MediaType.APPLICATION_JSON)
public class SpendingReviewResource {
  private final PlaidApi plaidClient;

  public SpendingReviewResource(PlaidApi plaidClient) {
    this.plaidClient = plaidClient;
  }

  // ── Request / inner model classes ──────────────────────────────────────────

  public static class BudgetGoal {
    @JsonProperty public String category;
    @JsonProperty("monthly_limit") public double monthly_limit;
  }

  public static class SpendingReviewRequest {
    @JsonProperty public List<BudgetGoal> budgets = new ArrayList<>();
    @JsonProperty("avoid_categories") public List<String> avoid_categories = new ArrayList<>();
    @JsonProperty public Integer year;
    @JsonProperty public Integer month;
  }

  public static class SimpleTransaction {
    @JsonProperty public String name;
    @JsonProperty public double amount;
    @JsonProperty public String date;

    SimpleTransaction(String name, double amount, String date) {
      this.name = name;
      this.amount = amount;
      this.date = date;
    }
  }

  public static class UnusualTransaction extends SimpleTransaction {
    @JsonProperty public List<String> category;
    @JsonProperty public String reason;

    UnusualTransaction(String name, double amount, String date, List<String> category, String reason) {
      super(name, amount, date);
      this.category = category;
      this.reason = reason;
    }
  }

  public static class GoalViolation {
    @JsonProperty public String category;
    @JsonProperty("monthly_limit") public double monthly_limit;
    @JsonProperty("amount_spent") public double amount_spent;
    @JsonProperty("over_by") public double over_by;
    @JsonProperty public List<SimpleTransaction> transactions;
    @JsonProperty("is_avoid_category") public boolean is_avoid_category;

    GoalViolation(String category, double monthlyLimit, double amountSpent,
                  double overBy, List<SimpleTransaction> transactions, boolean isAvoidCategory) {
      this.category = category;
      this.monthly_limit = monthlyLimit;
      this.amount_spent = amountSpent;
      this.over_by = overBy;
      this.transactions = transactions;
      this.is_avoid_category = isAvoidCategory;
    }
  }

  public static class ReviewStats {
    @JsonProperty("transactions_analyzed") public int transactions_analyzed;
    @JsonProperty("total_spent") public double total_spent;
    @JsonProperty public String period;

    ReviewStats(int analyzed, double totalSpent, String period) {
      this.transactions_analyzed = analyzed;
      this.total_spent = totalSpent;
      this.period = period;
    }
  }

  public static class MerchantSummary {
    @JsonProperty public String name;
    @JsonProperty("total_amount") public double total_amount;
    @JsonProperty("visit_count") public int visit_count;

    MerchantSummary(String name, double totalAmount, int visitCount) {
      this.name = name;
      this.total_amount = totalAmount;
      this.visit_count = visitCount;
    }
  }

  public static class SubscriptionItem {
    @JsonProperty public String name;
    @JsonProperty public double amount;
    @JsonProperty public String frequency;
    @JsonProperty("last_date") public String last_date;
    @JsonProperty("months_detected") public int months_detected;

    SubscriptionItem(String name, double amount, String frequency, String lastDate, int monthsDetected) {
      this.name = name;
      this.amount = amount;
      this.frequency = frequency;
      this.last_date = lastDate;
      this.months_detected = monthsDetected;
    }
  }

  public static class PreviousMonthSummary {
    @JsonProperty("total_spent") public double total_spent;
    @JsonProperty("transactions_analyzed") public int transactions_analyzed;

    PreviousMonthSummary(double totalSpent, int txCount) {
      this.total_spent = totalSpent;
      this.transactions_analyzed = txCount;
    }
  }

  public static class SpendingReviewResponse {
    @JsonProperty("unusual_transactions") public List<UnusualTransaction> unusual_transactions;
    @JsonProperty("goal_violations") public List<GoalViolation> goal_violations;
    @JsonProperty public ReviewStats stats;
    @JsonProperty("top_merchants") public List<MerchantSummary> top_merchants;
    @JsonProperty public List<SubscriptionItem> subscriptions;
    @JsonProperty("previous_month") public PreviousMonthSummary previous_month;

    SpendingReviewResponse(List<UnusualTransaction> unusual, List<GoalViolation> violations,
                           ReviewStats stats, List<MerchantSummary> topMerchants,
                           List<SubscriptionItem> subscriptions, PreviousMonthSummary previousMonth) {
      this.unusual_transactions = unusual;
      this.goal_violations = violations;
      this.stats = stats;
      this.top_merchants = topMerchants;
      this.subscriptions = subscriptions;
      this.previous_month = previousMonth;
    }
  }

  // ── Endpoint ───────────────────────────────────────────────────────────────

  @POST
  @Consumes(MediaType.APPLICATION_JSON)
  public SpendingReviewResponse runReview(SpendingReviewRequest request)
      throws IOException, InterruptedException {

    List<Transaction> all = fetchAllTransactions();

    List<Transaction> debits = all.stream()
        .filter(t -> t.getAmount() != null && t.getAmount() > 0)
        .collect(Collectors.toList());

    // Use requested month or default to current
    YearMonth targetMonth = (request.year != null && request.month != null)
        ? YearMonth.of(request.year, request.month)
        : YearMonth.now();

    List<Transaction> thisMonthDebits = debits.stream()
        .filter(t -> t.getDate() != null && YearMonth.from(t.getDate()).equals(targetMonth))
        .collect(Collectors.toList());

    // Previous month for delta comparison
    YearMonth prevMonth = targetMonth.minusMonths(1);
    List<Transaction> prevMonthDebits = debits.stream()
        .filter(t -> t.getDate() != null && YearMonth.from(t.getDate()).equals(prevMonth))
        .collect(Collectors.toList());
    PreviousMonthSummary previousMonthSummary = new PreviousMonthSummary(
        round2(prevMonthDebits.stream()
            .mapToDouble(t -> t.getAmount() != null ? t.getAmount() : 0).sum()),
        prevMonthDebits.size()
    );

    // Core analysis — unusual transactions use all-time baseline but flag only this month
    List<UnusualTransaction> unusual = detectUnusual(debits, thisMonthDebits);
    List<GoalViolation> violations = checkGoals(request, thisMonthDebits);

    double totalSpent = round2(thisMonthDebits.stream()
        .mapToDouble(t -> t.getAmount() != null ? t.getAmount() : 0)
        .sum());

    String period = targetMonth.format(DateTimeFormatter.ofPattern("MMMM yyyy"));

    List<MerchantSummary> topMerchants = computeTopMerchants(thisMonthDebits);
    List<SubscriptionItem> subscriptions = detectSubscriptions(debits);

    return new SpendingReviewResponse(unusual, violations,
        new ReviewStats(thisMonthDebits.size(), totalSpent, period),
        topMerchants, subscriptions, previousMonthSummary);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private List<Transaction> fetchAllTransactions() throws IOException, InterruptedException {
    String cursor = null;
    List<Transaction> added = new ArrayList<>();
    boolean hasMore = true;
    while (hasMore) {
      TransactionsSyncRequest req = new TransactionsSyncRequest()
          .accessToken(QuickstartApplication.accessToken)
          .cursor(cursor);
      TransactionsSyncResponse resp = PlaidApiHelper.callPlaid(plaidClient.transactionsSync(req));
      cursor = resp.getNextCursor();
      if (cursor.equals("")) { Thread.sleep(2000); continue; }
      added.addAll(resp.getAdded());
      hasMore = resp.getHasMore();
    }
    return added;
  }

  // Uses all-time baseline for mean/stddev but only flags transactions in thisMonth
  private List<UnusualTransaction> detectUnusual(List<Transaction> allDebits,
                                                  List<Transaction> thisMonthDebits) {
    if (allDebits.size() < 2) return new ArrayList<>();

    double[] amounts = allDebits.stream()
        .mapToDouble(t -> t.getAmount() != null ? t.getAmount() : 0)
        .toArray();

    double mean = 0;
    for (double a : amounts) mean += a;
    mean /= amounts.length;

    double variance = 0;
    for (double a : amounts) variance += (a - mean) * (a - mean);
    double stdDev = Math.sqrt(variance / amounts.length);

    double threshold = mean + 2 * stdDev;
    double finalMean = mean;

    List<UnusualTransaction> result = new ArrayList<>();
    for (Transaction t : thisMonthDebits) {
      double amount = t.getAmount() != null ? t.getAmount() : 0;
      boolean outlier = amount > threshold;
      boolean absolutelyLarge = amount > 500 && finalMean < 100;

      if (outlier || absolutelyLarge) {
        String reason;
        if (finalMean > 0) {
          double mult = round1(amount / finalMean);
          reason = String.format("%.1fx your avg transaction ($%.0f)", mult, finalMean);
        } else {
          reason = String.format("Unusually large: $%.2f", amount);
        }
        List<String> cats = t.getCategory() != null ? t.getCategory() : new ArrayList<>();
        String dateStr = t.getDate() != null ? t.getDate().toString() : "";
        result.add(new UnusualTransaction(t.getName(), amount, dateStr, cats, reason));
      }
    }
    return result;
  }

  private List<GoalViolation> checkGoals(SpendingReviewRequest request, List<Transaction> debits) {
    List<GoalViolation> violations = new ArrayList<>();

    for (BudgetGoal goal : request.budgets) {
      List<Transaction> matching = debits.stream()
          .filter(t -> matchesCategory(t, goal.category))
          .collect(Collectors.toList());

      double total = round2(matching.stream()
          .mapToDouble(t -> t.getAmount() != null ? t.getAmount() : 0)
          .sum());

      if (total > goal.monthly_limit) {
        violations.add(new GoalViolation(goal.category, goal.monthly_limit, total,
            round2(total - goal.monthly_limit), toSimple(matching), false));
      }
    }

    for (String avoidCat : request.avoid_categories) {
      List<Transaction> matching = debits.stream()
          .filter(t -> matchesCategory(t, avoidCat))
          .collect(Collectors.toList());

      if (!matching.isEmpty()) {
        double total = round2(matching.stream()
            .mapToDouble(t -> t.getAmount() != null ? t.getAmount() : 0)
            .sum());
        violations.add(new GoalViolation(avoidCat, 0, total, total, toSimple(matching), true));
      }
    }

    return violations;
  }

  private List<MerchantSummary> computeTopMerchants(List<Transaction> debits) {
    Map<String, double[]> byMerchant = new HashMap<>();
    for (Transaction t : debits) {
      String name = t.getName() != null ? t.getName() : "Unknown";
      double amount = t.getAmount() != null ? t.getAmount() : 0;
      byMerchant.computeIfAbsent(name, k -> new double[]{0, 0});
      byMerchant.get(name)[0] += amount;  // total
      byMerchant.get(name)[1] += 1;       // count
    }

    return byMerchant.entrySet().stream()
        .map(e -> new MerchantSummary(e.getKey(), round2(e.getValue()[0]), (int) e.getValue()[1]))
        .sorted(Comparator.comparingDouble((MerchantSummary m) -> m.total_amount).reversed())
        .limit(8)
        .collect(Collectors.toList());
  }

  private List<SubscriptionItem> detectSubscriptions(List<Transaction> allDebits) {
    // Group by merchant
    Map<String, List<Transaction>> byMerchant = new HashMap<>();
    for (Transaction t : allDebits) {
      if (t.getDate() == null) continue;
      String name = t.getName() != null ? t.getName() : "Unknown";
      byMerchant.computeIfAbsent(name, k -> new ArrayList<>()).add(t);
    }

    List<SubscriptionItem> result = new ArrayList<>();

    for (Map.Entry<String, List<Transaction>> entry : byMerchant.entrySet()) {
      List<Transaction> txs = entry.getValue();
      if (txs.size() < 2) continue;

      // Count distinct months this merchant appears in
      Set<YearMonth> months = txs.stream()
          .filter(t -> t.getDate() != null)
          .map(t -> YearMonth.from(t.getDate()))
          .collect(Collectors.toSet());

      if (months.size() < 2) continue;

      // Check amount consistency: 80%+ of transactions within 10% of average
      double avg = txs.stream()
          .mapToDouble(t -> t.getAmount() != null ? t.getAmount() : 0)
          .average().orElse(0);
      if (avg <= 0) continue;

      long consistent = txs.stream()
          .filter(t -> t.getAmount() != null && Math.abs(t.getAmount() - avg) / avg <= 0.10)
          .count();

      if (consistent < (long)(txs.size() * 0.8)) continue;

      String lastDate = txs.stream()
          .filter(t -> t.getDate() != null)
          .max(Comparator.comparing(Transaction::getDate))
          .map(t -> t.getDate().toString())
          .orElse("");

      String frequency = months.size() >= 3 ? "monthly" : "recurring";
      result.add(new SubscriptionItem(entry.getKey(), round2(avg), frequency, lastDate, months.size()));
    }

    return result.stream()
        .sorted(Comparator.comparingDouble((SubscriptionItem s) -> s.amount).reversed())
        .limit(10)
        .collect(Collectors.toList());
  }

  private boolean matchesCategory(Transaction t, String target) {
    if (t.getCategory() == null || t.getCategory().isEmpty()) return false;
    String lTarget = target.toLowerCase();
    return t.getCategory().stream()
        .anyMatch(c -> c.toLowerCase().equals(lTarget) ||
                       c.toLowerCase().contains(lTarget) ||
                       lTarget.contains(c.toLowerCase()));
  }

  private List<SimpleTransaction> toSimple(List<Transaction> txs) {
    return txs.stream()
        .map(t -> new SimpleTransaction(
            t.getName(),
            t.getAmount() != null ? t.getAmount() : 0,
            t.getDate() != null ? t.getDate().toString() : ""))
        .collect(Collectors.toList());
  }

  private static double round2(double v) { return Math.round(v * 100.0) / 100.0; }
  private static double round1(double v) { return Math.round(v * 10.0) / 10.0; }
}
