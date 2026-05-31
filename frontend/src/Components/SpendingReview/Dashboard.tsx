import React from "react";

const CATEGORY_ICONS: Record<string, string> = {
  "Food and Drink": "🍕", Shops: "🛍️", Travel: "✈️", Recreation: "🎮",
  Healthcare: "🏥", Service: "⚙️", Transfer: "↔️", Payment: "💳",
};

const ACCOUNT_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  checking:   { color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  savings:    { color: "#38bdf8", bg: "rgba(56,189,248,0.1)" },
  credit:     { color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  "credit card": { color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  investment: { color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  loan:       { color: "#f87171", bg: "rgba(248,113,113,0.1)" },
};

const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtRound = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

interface IncomeSetup { monthlyIncome: string; rent: string; utilities: string; otherFixed: string; monthlySavings: string; }
interface GoalRow { category: string; enabled: boolean; monthlyLimit: string; avoid: boolean; }
interface CategorySummary { category: string; amount_spent: number; monthly_limit: number; avoid: boolean; transaction_count: number; }
interface AllTransaction { name: string; amount: number; date: string; category: string; logo_url?: string; }
interface MerchantSummary { name: string; total_amount: number; visit_count: number; }
interface SubscriptionItem { name: string; amount: number; frequency: string; last_date: string; months_detected: number; }
interface ReviewStats { transactions_analyzed: number; total_spent: number; period: string; }
interface PreviousMonthSummary { total_spent: number; transactions_analyzed: number; }
interface GoalViolation { category: string; monthly_limit: number; amount_spent: number; over_by: number; is_avoid_category: boolean; }
interface AccountSummary { name: string; type: string; subtype: string; mask: string; current: number; available: number; limit: number; }
interface MonthlyTrend { year: number; month: number; label: string; total_spent: number; }

interface ReviewResult {
  stats: ReviewStats;
  goal_violations: GoalViolation[];
  top_merchants: MerchantSummary[];
  subscriptions: SubscriptionItem[];
  previous_month: PreviousMonthSummary;
  all_transactions: AllTransaction[];
  category_spending: CategorySummary[];
  accounts: AccountSummary[];
  monthly_trends: MonthlyTrend[];
}

interface DashboardProps {
  result: ReviewResult | null;
  income: IncomeSetup;
  goals: GoalRow[];
  selectedYear: number;
  selectedMonth: number;
  loading: boolean;
  error?: string | null;
  monthOptions: { year: number; month: number; label: string }[];
  onMonthChange: (yr: number, mo: number) => void;
  onSetupBudgets: () => void;
  onReconnect?: () => void;
}

const getGrade = (violations: number, pct: number | null) => {
  if (violations === 0 && (pct === null || pct < 0.8))  return { letter: "A", label: "Excellent",   color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.18)" };
  if (violations <= 1 && (pct === null || pct < 1.0))   return { letter: "B", label: "Good",        color: "#38bdf8", bg: "rgba(56,189,248,0.08)",  border: "rgba(56,189,248,0.18)" };
  if (violations <= 2 && (pct === null || pct < 1.2))   return { letter: "C", label: "Fair",        color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.18)" };
  if (violations <= 4)                                   return { letter: "D", label: "Over Budget", color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.18)" };
  return                                                        { letter: "F", label: "Critical",   color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.18)" };
};

const StatCard = ({ label, value, sub, subColor, bg, border }: { label: string; value: string; sub?: string; subColor?: string; bg?: string; border?: string }) => (
  <div style={{ padding: "2.4rem 2.8rem", borderRadius: "1.6rem", background: bg ?? "rgba(255,255,255,0.04)", border: `1px solid ${border ?? "rgba(255,255,255,0.07)"}` }}>
    <p style={{ margin: "0 0 0.8rem", fontSize: "1.1rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</p>
    <p style={{ margin: 0, fontSize: "3.4rem", fontWeight: 900, color: "#f8fafc", lineHeight: 1, letterSpacing: "-0.03em" }}>{value}</p>
    {sub && <p style={{ margin: "0.6rem 0 0", fontSize: "1.3rem", fontWeight: 600, color: subColor ?? "#475569" }}>{sub}</p>}
  </div>
);

const AVATAR_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#f87171", "#38bdf8"];
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const MerchantAvatar = ({ name, logoUrl, size = "3.2rem" }: { name: string; logoUrl?: string | null; size?: string }) => {
  const color = avatarColor(name);
  if (logoUrl) {
    return <img src={logoUrl} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "contain", background: "#fff", flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `${color}22`, border: `1px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontSize: `calc(${size} * 0.42)`, fontWeight: 800, color, lineHeight: 1 }}>{name.charAt(0).toUpperCase()}</span>
    </div>
  );
};

const Dashboard = ({ result, income, goals, selectedYear, selectedMonth, loading, error, monthOptions, onMonthChange, onSetupBudgets, onReconnect }: DashboardProps) => {
  const now = new Date();
  const grossIncome = parseFloat(income.monthlyIncome) || 0;
  const discretionary = grossIncome
    - (parseFloat(income.rent) || 0)
    - (parseFloat(income.utilities) || 0)
    - (parseFloat(income.otherFixed) || 0)
    - (parseFloat(income.monthlySavings) || 0);
  const savingsGoal = parseFloat(income.monthlySavings) || 0;

  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === (now.getMonth() + 1);
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const dayOfMonth = isCurrentMonth ? now.getDate() : daysInMonth;

  const totalSpent = result?.stats.total_spent ?? 0;
  const prevSpent = result?.previous_month?.total_spent ?? null;
  const spendDelta = prevSpent !== null ? totalSpent - prevSpent : null;
  const spendDeltaPct = prevSpent && prevSpent > 0 ? Math.round((spendDelta! / prevSpent) * 100) : null;
  const budgetPct = discretionary > 0 ? totalSpent / discretionary : null;
  const violations = result?.goal_violations.length ?? 0;
  const grade = getGrade(violations, budgetPct);

  const dailyPace = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0;
  const projectedTotal = dailyPace * daysInMonth;
  const dailyBudget = discretionary > 0 ? discretionary / daysInMonth : 0;

  const categoryData = result?.category_spending ?? [];
  const visibleCategories = categoryData.filter((c) => c.amount_spent > 0 || c.monthly_limit > 0);

  const recentTxns = (result?.all_transactions ?? []).slice(0, 8);
  const topMerchants = result?.top_merchants ?? [];
  const maxMerchant = topMerchants.length > 0 ? Math.max(...topMerchants.map((m) => m.total_amount)) : 1;
  const subscriptions = result?.subscriptions ?? [];
  const subTotal = subscriptions.reduce((s, x) => s + x.amount, 0);

  const accounts = result?.accounts ?? [];
  const netWorth = accounts.reduce((sum, a) => {
    if (a.type === "credit" || a.type === "loan") return sum - a.current;
    return sum + a.current;
  }, 0);

  const monthlyTrends = result?.monthly_trends ?? [];
  const maxTrend = Math.max(...monthlyTrends.map((t) => t.total_spent), 1);

  const hasGoals = goals.some((g) => g.enabled || g.avoid);

  const loadingOverlay = loading && (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(7,11,20,0.6)", borderRadius: "1rem", zIndex: 5 }}>
      <div style={{ width: "3.2rem", height: "3.2rem", borderRadius: "50%", border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "#6366f1", animation: "spin 0.8s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ position: "relative" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3.2rem" }}>
        <div>
          <h2 style={{ margin: "0 0 0.3rem", fontSize: "3rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em" }}>Overview</h2>
          <p style={{ margin: 0, fontSize: "1.4rem", color: "#475569" }}>
            {result ? result.stats.period : "Loading your finances…"}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
          {loading && <span style={{ fontSize: "1.3rem", color: "#475569" }}>Updating…</span>}
          <select
            value={`${selectedYear}-${selectedMonth}`}
            disabled={loading}
            onChange={(e) => { const [yr, mo] = e.target.value.split("-").map(Number); onMonthChange(yr, mo); }}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "9999px", padding: "0.6rem 3rem 0.6rem 1.4rem", fontSize: "1.4rem", fontWeight: 600, color: "#94a3b8", cursor: "pointer", outline: "none", fontFamily: "inherit", appearance: "none" as any, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 1rem center" }}
          >
            {monthOptions.map((opt) => (
              <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`} style={{ background: "#1e293b" }}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Reconnect banner — shown when spending review fails */}
      {!loading && !result && (
        <div style={{ marginBottom: "3rem", borderRadius: "1.4rem", border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.07)", padding: "2.4rem 3rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2rem" }}>
          <div>
            <p style={{ margin: "0 0 0.4rem", fontSize: "1.7rem", fontWeight: 700, color: "#f87171" }}>Bank connection unavailable</p>
            <p style={{ margin: 0, fontSize: "1.4rem", color: "#475569" }}>
              {error ? `Error: ${error}` : "Could not load transactions. Your bank connection may need to be refreshed."}
            </p>
          </div>
          {onReconnect && (
            <button
              onClick={onReconnect}
              style={{ flexShrink: 0, background: "#4f46e5", color: "#fff", fontWeight: 700, fontSize: "1.5rem", padding: "1rem 2.4rem", borderRadius: "1rem", border: "none", cursor: "pointer", whiteSpace: "nowrap" as const }}
            >
              Reconnect bank →
            </button>
          )}
        </div>
      )}

      {/* Account Balances */}
      {accounts.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "1.6rem", padding: "2.4rem 2.8rem", marginBottom: "3rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.01em" }}>Accounts</h3>
            <div style={{ textAlign: "right" as const }}>
              <p style={{ margin: "0 0 0.2rem", fontSize: "1.1rem", fontWeight: 700, color: "#334155", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Net Worth</p>
              <p style={{ margin: 0, fontSize: "2.4rem", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, color: netWorth >= 0 ? "#34d399" : "#f87171" }}>
                {netWorth < 0 ? "-" : ""}{fmtRound(Math.abs(netWorth))}
              </p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(22rem, 1fr))", gap: "1.2rem" }}>
            {accounts.map((a, i) => {
              const isCredit = a.type === "credit";
              const chip = ACCOUNT_TYPE_COLORS[a.subtype] ?? ACCOUNT_TYPE_COLORS[a.type] ?? { color: "#94a3b8", bg: "rgba(148,163,184,0.1)" };
              return (
                <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "1.2rem", padding: "1.8rem 2rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.2rem" }}>
                    <div>
                      <p style={{ margin: "0 0 0.3rem", fontSize: "1.5rem", fontWeight: 700, color: "#f8fafc" }}>{a.name}</p>
                      {a.mask && <p style={{ margin: 0, fontSize: "1.2rem", color: "#334155" }}>•••• {a.mask}</p>}
                    </div>
                    <span style={{ fontSize: "1.1rem", fontWeight: 700, color: chip.color, background: chip.bg, borderRadius: "9999px", padding: "0.3rem 0.9rem", textTransform: "capitalize" as const, whiteSpace: "nowrap" as const }}>
                      {a.subtype || a.type}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "3rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {fmtRound(a.current)}
                  </p>
                  {isCredit && a.limit > 0 && (
                    <p style={{ margin: "0.5rem 0 0", fontSize: "1.2rem", color: "#475569" }}>
                      {Math.round((a.current / a.limit) * 100)}% of {fmtRound(a.limit)} limit
                    </p>
                  )}
                  {!isCredit && a.available > 0 && a.available !== a.current && (
                    <p style={{ margin: "0.5rem 0 0", fontSize: "1.2rem", color: "#334155" }}>
                      {fmtRound(a.available)} available
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1.4rem", marginBottom: "3rem", position: "relative" }}>
        {loadingOverlay}
        <StatCard label="Total Spent" value={fmtRound(totalSpent)}
          sub={spendDeltaPct !== null ? `${spendDelta! > 0 ? "↑" : "↓"} ${Math.abs(spendDeltaPct)}% vs last month` : result?.stats.period ?? ""}
          subColor={spendDelta !== null && spendDelta > 0 ? "#f87171" : "#34d399"} />
        <StatCard label="Budget Remaining"
          value={discretionary > 0 ? fmtRound(Math.max(discretionary - totalSpent, 0)) : "—"}
          sub={budgetPct !== null ? `${Math.round(budgetPct * 100)}% of budget used` : "Set income to track"}
          subColor={budgetPct !== null && budgetPct > 1 ? "#f87171" : budgetPct !== null && budgetPct > 0.85 ? "#fbbf24" : "#34d399"} />
        <StatCard label="Savings Goal"
          value={savingsGoal > 0 ? fmtRound(savingsGoal) : "—"}
          sub={savingsGoal > 0 ? `${grossIncome > 0 ? Math.round((savingsGoal / grossIncome) * 100) : 0}% of income` : "Set in Account"} />
        <StatCard label="Health" value={grade.letter} sub={grade.label} subColor={grade.color} bg={grade.bg} border={grade.border} />
      </div>

      {/* Spending Trends */}
      {monthlyTrends.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "1.6rem", padding: "2.4rem 2.8rem", marginBottom: "3rem" }}>
          <h3 style={{ margin: "0 0 2.4rem", fontSize: "1.8rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.01em" }}>Spending Trends</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "1rem", height: "14rem" }}>
            {monthlyTrends.map((t, i) => {
              const isSelected = t.year === selectedYear && t.month === selectedMonth;
              const barPct = maxTrend > 0 ? Math.max((t.total_spent / maxTrend) * 100, t.total_spent > 0 ? 4 : 0) : 0;
              const shortLabel = t.label.split(" ")[0];
              return (
                <div
                  key={i}
                  onClick={() => onMonthChange(t.year, t.month)}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8rem", cursor: "pointer", height: "100%" }}
                >
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", width: "100%", alignItems: "center", gap: "0.5rem" }}>
                    {t.total_spent > 0 && (
                      <span style={{ fontSize: "1.15rem", fontWeight: 700, color: isSelected ? "#a5b4fc" : "#475569", whiteSpace: "nowrap" as const }}>
                        {t.total_spent >= 1000 ? `$${(t.total_spent / 1000).toFixed(1)}k` : fmtRound(t.total_spent)}
                      </span>
                    )}
                    <div
                      style={{
                        width: "100%",
                        height: `${barPct}%`,
                        background: isSelected ? "#6366f1" : "rgba(99,102,241,0.25)",
                        borderRadius: "0.5rem 0.5rem 0.2rem 0.2rem",
                        transition: "all 0.2s",
                        minHeight: t.total_spent > 0 ? "0.4rem" : "0",
                        border: isSelected ? "1px solid rgba(99,102,241,0.6)" : "1px solid rgba(99,102,241,0.15)",
                      }}
                      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "rgba(99,102,241,0.4)"; }}
                      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "rgba(99,102,241,0.25)"; }}
                    />
                  </div>
                  <span style={{ fontSize: "1.2rem", fontWeight: isSelected ? 700 : 400, color: isSelected ? "#a5b4fc" : "#334155", letterSpacing: "-0.01em" }}>
                    {shortLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category spending + Cash flow */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "2rem", marginBottom: "3rem" }}>
        {/* Category breakdown */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "1.6rem", padding: "2.4rem 2.8rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.01em" }}>Spending by Category</h3>
            {!hasGoals && (
              <button onClick={onSetupBudgets} style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "9999px", padding: "0.5rem 1.4rem", fontSize: "1.2rem", fontWeight: 600, color: "#818cf8", cursor: "pointer" }}>
                Set budgets →
              </button>
            )}
          </div>
          {visibleCategories.length === 0 && !loading ? (
            <div style={{ textAlign: "center", padding: "3rem 0" }}>
              <p style={{ fontSize: "2.4rem", margin: "0 0 0.8rem" }}>📊</p>
              <p style={{ margin: 0, fontSize: "1.5rem", color: "#475569" }}>No spending data for this month</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>
              {(visibleCategories.length > 0 ? visibleCategories : categoryData.slice(0, 6)).map((c) => {
                const pct = c.monthly_limit > 0 ? Math.min((c.amount_spent / c.monthly_limit) * 100, 100) : 0;
                const overLimit = c.monthly_limit > 0 && c.amount_spent > c.monthly_limit;
                const barColor = c.avoid ? "#f87171" : pct >= 100 ? "#f87171" : pct >= 80 ? "#fbbf24" : "#6366f1";
                return (
                  <div key={c.category}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "1.5rem", fontWeight: 600, color: c.amount_spent > 0 ? "#f8fafc" : "#334155" }}>
                        {CATEGORY_ICONS[c.category] ?? ""} {c.category}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        {overLimit && <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f87171", background: "rgba(248,113,113,0.1)", borderRadius: "9999px", padding: "0.2rem 0.8rem" }}>over by {fmtRound(c.amount_spent - c.monthly_limit)}</span>}
                        <span style={{ fontSize: "1.4rem", fontWeight: 700, color: c.amount_spent > 0 ? "#f8fafc" : "#334155" }}>{fmtRound(c.amount_spent)}</span>
                        {c.monthly_limit > 0 && <span style={{ fontSize: "1.3rem", color: "#334155" }}>/ {fmtRound(c.monthly_limit)}</span>}
                      </div>
                    </div>
                    {c.monthly_limit > 0 ? (
                      <div style={{ width: "100%", background: "rgba(255,255,255,0.07)", borderRadius: "9999px", height: "0.55rem" }}>
                        <div style={{ width: `${pct}%`, background: barColor, borderRadius: "9999px", height: "0.55rem", transition: "width 0.4s" }} />
                      </div>
                    ) : (
                      <div style={{ width: "100%", background: "rgba(255,255,255,0.04)", borderRadius: "9999px", height: "0.3rem" }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cash flow */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "1.6rem", padding: "2.4rem 2.8rem" }}>
          <h3 style={{ margin: "0 0 2rem", fontSize: "1.8rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.01em" }}>
            {isCurrentMonth ? "Cash Flow" : "Month Summary"}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.8rem" }}>
            <div>
              <p style={{ margin: "0 0 0.3rem", fontSize: "1.1rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Spent</p>
              <p style={{ margin: 0, fontSize: "3.2rem", fontWeight: 900, color: "#f8fafc", lineHeight: 1, letterSpacing: "-0.03em" }}>{fmtRound(totalSpent)}</p>
            </div>
            {isCurrentMonth && (
              <>
                <div style={{ width: "100%", height: "1px", background: "rgba(255,255,255,0.06)" }} />
                <div>
                  <p style={{ margin: "0 0 0.3rem", fontSize: "1.1rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Daily Pace</p>
                  <p style={{ margin: 0, fontSize: "2.4rem", fontWeight: 900, color: dailyBudget > 0 && dailyPace > dailyBudget ? "#f87171" : "#f8fafc", lineHeight: 1, letterSpacing: "-0.02em" }}>{fmtRound(dailyPace)}/day</p>
                  {dailyBudget > 0 && <p style={{ margin: "0.3rem 0 0", fontSize: "1.3rem", color: "#475569" }}>budget: {fmtRound(dailyBudget)}/day</p>}
                </div>
                <div>
                  <p style={{ margin: "0 0 0.3rem", fontSize: "1.1rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Projected</p>
                  <p style={{ margin: 0, fontSize: "2.4rem", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em", color: discretionary > 0 && projectedTotal > discretionary ? "#f87171" : "#f8fafc" }}>{fmtRound(projectedTotal)}</p>
                  {discretionary > 0 && <p style={{ margin: "0.3rem 0 0", fontSize: "1.3rem", color: projectedTotal > discretionary ? "#f87171" : "#34d399" }}>{projectedTotal > discretionary ? `${fmtRound(projectedTotal - discretionary)} over` : `${fmtRound(discretionary - projectedTotal)} under`} budget</p>}
                </div>
                <div>
                  <p style={{ margin: "0 0 0.3rem", fontSize: "1.1rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Days Left</p>
                  <p style={{ margin: 0, fontSize: "2.4rem", fontWeight: 900, color: "#f8fafc", lineHeight: 1 }}>{daysInMonth - dayOfMonth} <span style={{ fontSize: "1.3rem", color: "#475569", fontWeight: 500 }}>of {daysInMonth}</span></p>
                </div>
              </>
            )}
            {!isCurrentMonth && prevSpent !== null && (
              <>
                <div style={{ width: "100%", height: "1px", background: "rgba(255,255,255,0.06)" }} />
                <div>
                  <p style={{ margin: "0 0 0.3rem", fontSize: "1.1rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>vs Previous Month</p>
                  <p style={{ margin: 0, fontSize: "2.4rem", fontWeight: 900, lineHeight: 1, color: spendDelta !== null && spendDelta > 0 ? "#f87171" : "#34d399" }}>
                    {spendDelta !== null && spendDelta > 0 ? "+" : ""}{fmtRound(spendDelta ?? 0)}
                  </p>
                  {spendDeltaPct !== null && <p style={{ margin: "0.3rem 0 0", fontSize: "1.3rem", color: "#475569" }}>{Math.abs(spendDeltaPct)}% {spendDelta! > 0 ? "more" : "less"} than prior month</p>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Merchants + Subscriptions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "3rem" }}>
        {/* Top merchants */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "1.6rem", padding: "2.4rem 2.8rem" }}>
          <h3 style={{ margin: "0 0 2rem", fontSize: "1.8rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.01em" }}>Top Merchants</h3>
          {topMerchants.length === 0 ? (
            <p style={{ color: "#334155", fontSize: "1.4rem" }}>No data for this period</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              {topMerchants.slice(0, 6).map((m, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <MerchantAvatar name={m.name} size="2.8rem" />
                      <span style={{ fontSize: "1.5rem", fontWeight: 600, color: "#f8fafc" }}>{m.name}</span>
                    </div>
                    <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f8fafc" }}>{fmt(m.total_amount)}</span>
                  </div>
                  <div style={{ marginLeft: "3.8rem" }}>
                    <div style={{ width: "100%", background: "rgba(255,255,255,0.06)", borderRadius: "9999px", height: "0.5rem" }}>
                      <div style={{ width: `${Math.round((m.total_amount / maxMerchant) * 100)}%`, background: i === 0 ? "#6366f1" : i === 1 ? "#818cf8" : "#a5b4fc", borderRadius: "9999px", height: "0.5rem", transition: "width 0.4s" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subscriptions */}
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "1.6rem", padding: "2.4rem 2.8rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.01em" }}>Recurring Charges</h3>
            {subTotal > 0 && <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fbbf24" }}>{fmtRound(subTotal)}/mo</span>}
          </div>
          {subscriptions.length === 0 ? (
            <p style={{ color: "#334155", fontSize: "1.4rem" }}>No recurring charges detected</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {subscriptions.slice(0, 6).map((sub, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.1rem 0", borderBottom: i < Math.min(subscriptions.length, 6) - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <MerchantAvatar name={sub.name} size="2.8rem" />
                    <div>
                      <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600, color: "#f8fafc" }}>{sub.name}</p>
                      <p style={{ margin: 0, fontSize: "1.2rem", color: "#334155" }}>{sub.frequency} · {sub.months_detected}mo</p>
                    </div>
                  </div>
                  <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fbbf24" }}>{fmt(sub.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "1.6rem", padding: "2.4rem 2.8rem" }}>
        <h3 style={{ margin: "0 0 2rem", fontSize: "1.8rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.01em" }}>Recent Transactions</h3>
        {recentTxns.length === 0 ? (
          <p style={{ color: "#334155", fontSize: "1.4rem" }}>No transactions for this period</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {recentTxns.map((tx, i) => (
                <tr key={i}
                  style={{ borderBottom: i < recentTxns.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", transition: "background 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.025)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                >
                  <td style={{ padding: "1rem 0.8rem 1rem 0", width: "7rem" }}>
                    <span style={{ fontSize: "1.3rem", color: "#475569" }}>
                      {new Date(tx.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </td>
                  <td style={{ padding: "1rem 1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <MerchantAvatar name={tx.name} logoUrl={tx.logo_url} size="2.8rem" />
                      <span style={{ fontSize: "1.5rem", fontWeight: 600, color: "#f8fafc" }}>{tx.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "1rem 1rem" }}>
                    <span style={{ fontSize: "1.2rem", color: "#475569" }}>{CATEGORY_ICONS[tx.category] ?? ""} {tx.category || "Other"}</span>
                  </td>
                  <td style={{ padding: "1rem 0 1rem 1rem", textAlign: "right" as const, fontSize: "1.5rem", fontWeight: 700, color: "#f87171" }}>{fmt(tx.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
