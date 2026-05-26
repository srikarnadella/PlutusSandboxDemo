import React, { useState } from "react";
import StepProgress from "../StepProgress";

const PRESET_CATEGORIES = [
  "Food and Drink",
  "Shops",
  "Travel",
  "Recreation",
  "Healthcare",
  "Service",
  "Transfer",
  "Payment",
];

const CATEGORY_ICONS: Record<string, string> = {
  "Food and Drink": "🍕",
  Shops: "🛍️",
  Travel: "✈️",
  Recreation: "🎮",
  Healthcare: "🏥",
  Service: "⚙️",
  Transfer: "↔️",
  Payment: "💳",
};

const PRESETS: Record<string, Record<string, number>> = {
  Tight:    { "Food and Drink": 0.15, Shops: 0.08, Travel: 0.05, Recreation: 0.03, Healthcare: 0.08, Service: 0.03, Transfer: 0.05, Payment: 0.05 },
  Standard: { "Food and Drink": 0.25, Shops: 0.12, Travel: 0.10, Recreation: 0.06, Healthcare: 0.10, Service: 0.05, Transfer: 0.08, Payment: 0.08 },
  Generous: { "Food and Drink": 0.35, Shops: 0.20, Travel: 0.15, Recreation: 0.10, Healthcare: 0.15, Service: 0.08, Transfer: 0.10, Payment: 0.10 },
};

const PRESET_ABSOLUTE: Record<string, Record<string, number>> = {
  Tight:    { "Food and Drink": 200, Shops: 100, Travel: 80,  Recreation: 40,  Healthcare: 80,  Service: 40,  Transfer: 100, Payment: 100 },
  Standard: { "Food and Drink": 350, Shops: 175, Travel: 150, Recreation: 75,  Healthcare: 150, Service: 75,  Transfer: 150, Payment: 150 },
  Generous: { "Food and Drink": 500, Shops: 300, Travel: 250, Recreation: 125, Healthcare: 200, Service: 100, Transfer: 200, Payment: 200 },
};

interface IncomeSetup {
  monthlyIncome: string;
  rent: string;
  utilities: string;
  otherFixed: string;
  monthlySavings: string;
}

interface GoalRow { category: string; enabled: boolean; monthlyLimit: string; avoid: boolean; }
interface SimpleTx { name: string; amount: number; date: string; }
interface UnusualTx extends SimpleTx { category: string[]; reason: string; }

interface GoalViolation {
  category: string;
  monthly_limit: number;
  amount_spent: number;
  over_by: number;
  transactions: SimpleTx[];
  is_avoid_category: boolean;
}

interface ReviewStats { transactions_analyzed: number; total_spent: number; period: string; }

interface MerchantSummary { name: string; total_amount: number; visit_count: number; }
interface SubscriptionItem { name: string; amount: number; frequency: string; last_date: string; months_detected: number; }
interface PreviousMonthSummary { total_spent: number; transactions_analyzed: number; }

interface ReviewResult {
  unusual_transactions: UnusualTx[];
  goal_violations: GoalViolation[];
  stats: ReviewStats;
  top_merchants: MerchantSummary[];
  subscriptions: SubscriptionItem[];
  previous_month: PreviousMonthSummary;
}

type SortField = "name" | "amount" | "date";
type SortDir = "asc" | "desc";

const fmt = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtRound = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

// ── Big input for the income step ─────────────────────────────────────────────

const BigInput = ({
  label, value, placeholder, onChange, accent,
}: {
  label: string; value: string; placeholder: string;
  onChange: (v: string) => void; accent?: boolean;
}) => (
  <div>
    <label style={{
      display: "block",
      fontSize: "1.3rem",
      fontWeight: 700,
      color: "#475569",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      marginBottom: "1rem",
    }}>
      {label}
    </label>
    <div style={{ position: "relative" }}>
      <span style={{
        position: "absolute",
        left: "2.8rem",
        top: "50%",
        transform: "translateY(-50%)",
        fontSize: "2.8rem",
        fontWeight: 700,
        color: "#334155",
        pointerEvents: "none",
        userSelect: "none",
      }}>$</span>
      <input
        type="number"
        min="0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: "9rem",
          background: accent ? "rgba(99,102,241,0.07)" : "rgba(255,255,255,0.05)",
          border: `1.5px solid ${accent ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.09)"}`,
          borderRadius: "1.4rem",
          paddingLeft: "6.8rem",
          paddingRight: "2.4rem",
          fontSize: "3.2rem",
          fontWeight: 700,
          color: "#f8fafc",
          outline: "none",
          transition: "border-color 0.2s, background 0.2s",
          fontFamily: "inherit",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "rgba(99,102,241,0.7)";
          e.currentTarget.style.background = "rgba(99,102,241,0.1)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = accent ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.09)";
          e.currentTarget.style.background = accent ? "rgba(99,102,241,0.07)" : "rgba(255,255,255,0.05)";
        }}
      />
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────

const SpendingReview = () => {
  const _now = new Date();

  const [view, setView] = useState<"income" | "goals" | "results">("income");
  const [income, setIncome] = useState<IncomeSetup>({
    monthlyIncome: "", rent: "", utilities: "", otherFixed: "", monthlySavings: "",
  });
  const [goals, setGoals] = useState<GoalRow[]>(
    PRESET_CATEGORIES.map((cat) => ({ category: cat, enabled: false, monthlyLimit: "", avoid: false }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [sortField, setSortField] = useState<SortField>("amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedViolations, setExpandedViolations] = useState<Set<number>>(new Set());

  // Month picker — defaults to current month
  const [selectedYear, setSelectedYear] = useState(_now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(_now.getMonth() + 1);

  // Last 13 months as options (current + 12 prior)
  const monthOptions = Array.from({ length: 13 }, (_, i) => {
    const d = new Date(_now.getFullYear(), _now.getMonth() - i, 1);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
  });

  const grossIncome = parseFloat(income.monthlyIncome) || 0;
  const discretionary =
    grossIncome
    - (parseFloat(income.rent) || 0)
    - (parseFloat(income.utilities) || 0)
    - (parseFloat(income.otherFixed) || 0)
    - (parseFloat(income.monthlySavings) || 0);

  const allocated = goals
    .filter((g) => g.enabled && !g.avoid && g.monthlyLimit !== "")
    .reduce((sum, g) => sum + (parseFloat(g.monthlyLimit) || 0), 0);

  const toggleEnabled = (i: number) =>
    setGoals((p) => p.map((g, idx) => idx === i ? { ...g, enabled: !g.enabled, avoid: false } : g));

  const toggleAvoid = (i: number) =>
    setGoals((p) => p.map((g, idx) =>
      idx === i ? { ...g, avoid: !g.avoid, enabled: !g.avoid, monthlyLimit: "" } : g
    ));

  const setLimit = (i: number, val: string) =>
    setGoals((p) => p.map((g, idx) => idx === i ? { ...g, monthlyLimit: val } : g));

  const applyPreset = (name: string) => {
    const fractions = PRESETS[name];
    const absolutes = PRESET_ABSOLUTE[name];
    setGoals((p) => p.map((g) => {
      const limit = discretionary > 0
        ? Math.round((discretionary * (fractions[g.category] || 0)) / 5) * 5
        : absolutes[g.category] || 0;
      return { ...g, enabled: true, avoid: false, monthlyLimit: limit > 0 ? String(limit) : "" };
    }));
  };

  const runReview = async (overrideYear?: number, overrideMonth?: number) => {
    setLoading(true);
    setError(null);
    const yr = overrideYear ?? selectedYear;
    const mo = overrideMonth ?? selectedMonth;
    const budgets = goals
      .filter((g) => g.enabled && !g.avoid && g.monthlyLimit !== "")
      .map((g) => ({ category: g.category, monthly_limit: parseFloat(g.monthlyLimit) }));
    const avoid_categories = goals.filter((g) => g.avoid).map((g) => g.category);
    try {
      const resp = await fetch("/api/spending_review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgets, avoid_categories, year: yr, month: mo }),
      });
      if (!resp.ok) throw new Error(`Request failed: ${resp.status}`);
      const data: ReviewResult = await resp.json();
      setResult(data);
      setExpandedViolations(new Set(data.goal_violations.map((_, i) => i)));
      setView("results");
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (yr: number, mo: number) => {
    setSelectedYear(yr);
    setSelectedMonth(mo);
    runReview(yr, mo);
  };

  const toggleViolation = (i: number) =>
    setExpandedViolations((p) => {
      const n = new Set(p);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });

  const handleSort = (field: SortField) => {
    if (field === sortField) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const exportCSV = () => {
    if (!result) return;
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [
      "Section,Merchant,Amount,Date,Note",
      ...result.unusual_transactions.map((tx) =>
        `Unusual,${esc(tx.name)},${tx.amount},${tx.date},${esc(tx.reason)}`),
      ...result.goal_violations.flatMap((v) =>
        v.transactions.map((tx) =>
          `${esc("Violation:" + v.category)},${esc(tx.name)},${tx.amount},${tx.date},`)),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), {
      href: url, download: `spending-${result.stats.period.replace(" ", "-")}.csv`,
    }).click();
    URL.revokeObjectURL(url);
  };

  const getGrade = (data: ReviewResult) => {
    const v = data.goal_violations.length;
    const pct = discretionary > 0 ? data.stats.total_spent / discretionary : null;
    if (v === 0 && (pct === null || pct < 0.8))  return { letter: "A", label: "Excellent",   color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.18)" };
    if (v <= 1 && (pct === null || pct < 1.0))   return { letter: "B", label: "Good",        color: "#38bdf8", bg: "rgba(56,189,248,0.08)",  border: "rgba(56,189,248,0.18)" };
    if (v <= 2 && (pct === null || pct < 1.2))   return { letter: "C", label: "Fair",        color: "#fbbf24", bg: "rgba(251,191,36,0.08)",  border: "rgba(251,191,36,0.18)" };
    if (v <= 4)                                   return { letter: "D", label: "Over Budget", color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.18)" };
    return                                               { letter: "F", label: "Critical",   color: "#f87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.18)" };
  };

  const hasAnyGoal = goals.some((g) => g.enabled || g.avoid);

  const panelPad = { flex: 1, padding: "2rem 5vw 6rem", maxWidth: "1200px", margin: "0 auto", width: "100%" };

  // ── PHASE 0: Income ──────────────────────────────────────────────────────────
  if (view === "income") {
    const previewDisc = grossIncome
      - (parseFloat(income.rent) || 0)
      - (parseFloat(income.utilities) || 0)
      - (parseFloat(income.otherFixed) || 0)
      - (parseFloat(income.monthlySavings) || 0);

    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", animation: "fadeSlideUp 0.4s ease-out both" }}>
        <StepProgress current={2} total={4} />

        <div style={panelPad}>
          <div style={{ marginBottom: "3.6rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1.6rem", marginBottom: "0.8rem" }}>
              <span style={{ fontSize: "3.2rem" }}>💰</span>
              <h2 style={{ fontSize: "3.6rem", fontWeight: 900, color: "#f8fafc", margin: 0, letterSpacing: "-0.02em" }}>Budget Setup</h2>
            </div>
            <p style={{ fontSize: "1.6rem", color: "#475569", margin: 0 }}>
              Enter your monthly numbers so we can figure out how much you have to spend.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.6rem", marginBottom: "1.6rem" }}>
            <BigInput label="Monthly Take-Home Income" value={income.monthlyIncome} placeholder="4,000"
              onChange={(v) => setIncome((p) => ({ ...p, monthlyIncome: v }))} />
            <BigInput label="Rent / Mortgage" value={income.rent} placeholder="1,500"
              onChange={(v) => setIncome((p) => ({ ...p, rent: v }))} />
            <BigInput label="Utilities" value={income.utilities} placeholder="200"
              onChange={(v) => setIncome((p) => ({ ...p, utilities: v }))} />
            <BigInput label="Other Fixed (subscriptions, insurance…)" value={income.otherFixed} placeholder="150"
              onChange={(v) => setIncome((p) => ({ ...p, otherFixed: v }))} />
          </div>

          <BigInput label="🎯  How much do you want to save per month?" value={income.monthlySavings}
            placeholder="500" accent onChange={(v) => setIncome((p) => ({ ...p, monthlySavings: v }))} />

          {grossIncome > 0 && (
            <div style={{
              marginTop: "2.4rem", borderRadius: "1.4rem", padding: "2.4rem 3.2rem",
              background: previewDisc < 0 ? "rgba(239,68,68,0.08)" : "rgba(99,102,241,0.08)",
              border: `1.5px solid ${previewDisc < 0 ? "rgba(239,68,68,0.2)" : "rgba(99,102,241,0.2)"}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              animation: "fadeSlideUp 0.25s ease-out both",
            }}>
              <div>
                <p style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Left to spend after savings
                </p>
                <p style={{ margin: "0.6rem 0 0", fontSize: "5.6rem", fontWeight: 900, color: previewDisc < 0 ? "#f87171" : "#818cf8", lineHeight: 1, letterSpacing: "-0.03em" }}>
                  {fmtRound(Math.max(previewDisc, 0))}
                  <span style={{ fontSize: "2rem", fontWeight: 500, color: "#334155", marginLeft: "1rem" }}>/month</span>
                </p>
              </div>
              {(parseFloat(income.monthlySavings) || 0) > 0 && (
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>Going to savings</p>
                  <p style={{ margin: "0.6rem 0 0", fontSize: "3.6rem", fontWeight: 900, color: "#34d399", lineHeight: 1, letterSpacing: "-0.02em" }}>
                    {fmtRound(parseFloat(income.monthlySavings) || 0)}/mo
                  </p>
                </div>
              )}
              {previewDisc < 0 && (
                <p style={{ fontSize: "1.5rem", fontWeight: 600, color: "#f87171", margin: 0 }}>⚠️ Expenses exceed income</p>
              )}
            </div>
          )}

          <div style={{ marginTop: "3.2rem", display: "flex", alignItems: "center", gap: "2rem" }}>
            <button
              onClick={() => setView("goals")}
              style={{
                background: "#4f46e5", color: "#fff", fontWeight: 700, fontSize: "1.7rem",
                padding: "1.4rem 4rem", borderRadius: "1.2rem", border: "none", cursor: "pointer",
                boxShadow: "0 8px 28px rgba(99,102,241,0.4)", letterSpacing: "-0.01em", transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#4338ca"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#4f46e5"; }}
            >
              Set spending goals →
            </button>
            <button
              onClick={() => setView("goals")}
              style={{ background: "none", border: "none", color: "#334155", fontSize: "1.5rem", cursor: "pointer", fontWeight: 500 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#334155"; }}
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE 2: Results ─────────────────────────────────────────────────────────
  if (view === "results" && result) {
    const grade = getGrade(result);
    const budgetPct = discretionary > 0
      ? Math.round((result.stats.total_spent / discretionary) * 100) : null;

    const sorted = [...result.unusual_transactions].sort((a, b) => {
      const cmp =
        sortField === "amount" ? a.amount - b.amount
        : sortField === "date" ? a.date.localeCompare(b.date)
        : a.name.localeCompare(b.name);
      return sortDir === "desc" ? -cmp : cmp;
    });

    const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
      <button
        onClick={() => handleSort(field)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: "0.4rem",
          fontWeight: 700, fontSize: "1.2rem", textTransform: "uppercase",
          letterSpacing: "0.08em", color: sortField === field ? "#818cf8" : "#334155",
          transition: "color 0.15s",
        }}
      >
        {label}
        {sortField === field && <span>{sortDir === "desc" ? "▼" : "▲"}</span>}
      </button>
    );

    // Delta vs previous month
    const prevSpent = result.previous_month?.total_spent ?? null;
    const spendDelta = prevSpent !== null ? result.stats.total_spent - prevSpent : null;
    const spendDeltaPct = (prevSpent !== null && prevSpent > 0)
      ? Math.round((spendDelta! / prevSpent) * 100) : null;

    const prevTxCount = result.previous_month?.transactions_analyzed ?? null;
    const txDelta = prevTxCount !== null ? result.stats.transactions_analyzed - prevTxCount : null;

    // Cash flow forecast (only relevant for current month)
    const isCurrentMonth = selectedYear === _now.getFullYear() && selectedMonth === _now.getMonth() + 1;
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const dayOfMonth = isCurrentMonth ? _now.getDate() : daysInMonth;
    const daysRemaining = isCurrentMonth ? daysInMonth - dayOfMonth : 0;
    const dailyPace = dayOfMonth > 0 ? result.stats.total_spent / dayOfMonth : 0;
    const projectedTotal = dailyPace * daysInMonth;
    const dailyBudget = discretionary > 0 ? discretionary / daysInMonth : 0;

    // Savings data
    const savingsGoal = parseFloat(income.monthlySavings) || 0;
    const annualGoal = savingsGoal * 12;

    // Top merchant bar chart max
    const topMerchants = result.top_merchants ?? [];
    const maxMerchantAmount = topMerchants.length > 0
      ? Math.max(...topMerchants.map((m) => m.total_amount)) : 1;

    const subscriptions = result.subscriptions ?? [];
    const subMonthlyTotal = subscriptions.reduce((s, x) => s + x.amount, 0);

    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", animation: "fadeSlideUp 0.4s ease-out both" }}>
        <StepProgress current={4} total={4} />

        <div style={{ ...panelPad, maxWidth: "1400px" }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3.2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
              <button
                onClick={() => { setResult(null); setView("goals"); }}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "0.9rem",
                  padding: "0.9rem 1.8rem",
                  cursor: "pointer",
                  fontSize: "1.5rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  letterSpacing: "-0.01em",
                  transition: "background 0.15s, border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.background = "rgba(255,255,255,0.09)";
                  b.style.borderColor = "rgba(255,255,255,0.25)";
                  b.style.color = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.background = "rgba(255,255,255,0.05)";
                  b.style.borderColor = "rgba(255,255,255,0.15)";
                  b.style.color = "#94a3b8";
                }}
              >
                ← Goals
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: "1.6rem" }}>
                <span style={{ fontSize: "3rem" }}>📊</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: "3.2rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em" }}>Spending Review</h2>
                  {/* Month picker */}
                  <div style={{ marginTop: "0.4rem" }}>
                    <select
                      value={`${selectedYear}-${selectedMonth}`}
                      disabled={loading}
                      onChange={(e) => {
                        const [yr, mo] = e.target.value.split("-").map(Number);
                        handleMonthChange(yr, mo);
                      }}
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: "9999px",
                        padding: "0.5rem 1.4rem",
                        fontSize: "1.4rem",
                        fontWeight: 600,
                        color: "#94a3b8",
                        cursor: "pointer",
                        outline: "none",
                        fontFamily: "inherit",
                        appearance: "none",
                        paddingRight: "2.8rem",
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 1rem center",
                        transition: "border-color 0.15s",
                      }}
                    >
                      {monthOptions.map((opt) => (
                        <option
                          key={`${opt.year}-${opt.month}`}
                          value={`${opt.year}-${opt.month}`}
                          style={{ background: "#1e293b", color: "#f8fafc" }}
                        >
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.6rem" }}>
              {loading && (
                <span style={{ fontSize: "1.4rem", color: "#475569", fontWeight: 500 }}>Loading…</span>
              )}
              <button
                onClick={exportCSV}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.4rem", color: "#334155", fontWeight: 500 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#334155"; }}
              >
                ↓ Export CSV
              </button>
              <button
                onClick={() => { setResult(null); setView("goals"); }}
                style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: "0.8rem", padding: "0.8rem 1.8rem",
                  fontSize: "1.3rem", color: "#94a3b8", cursor: "pointer", fontWeight: 500,
                }}
              >
                Set new goals
              </button>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1.6rem", marginBottom: "4rem" }}>
            {/* Transactions */}
            <div style={{ padding: "2.8rem 3.2rem", borderRadius: "1.6rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ margin: "0 0 0.8rem", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em" }}>Transactions</p>
              <p style={{ margin: 0, fontSize: "7rem", fontWeight: 900, color: "#f8fafc", lineHeight: 1, letterSpacing: "-0.04em" }}>
                {result.stats.transactions_analyzed}
              </p>
              {txDelta !== null ? (
                <p style={{ margin: "0.8rem 0 0", fontSize: "1.4rem", fontWeight: 600, color: txDelta > 0 ? "#f87171" : txDelta < 0 ? "#34d399" : "#334155" }}>
                  {txDelta > 0 ? `↑ ${txDelta}` : txDelta < 0 ? `↓ ${Math.abs(txDelta)}` : "—"} vs last month
                </p>
              ) : (
                <p style={{ margin: "0.8rem 0 0", fontSize: "1.4rem", color: "#334155" }}>analyzed</p>
              )}
            </div>

            {/* Total Spent */}
            <div style={{ padding: "2.8rem 3.2rem", borderRadius: "1.6rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ margin: "0 0 0.8rem", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em" }}>Total Spent</p>
              <p style={{ margin: 0, fontSize: "4.8rem", fontWeight: 900, color: "#f8fafc", lineHeight: 1, letterSpacing: "-0.03em" }}>
                {fmt(result.stats.total_spent)}
              </p>
              {spendDelta !== null && spendDeltaPct !== null ? (
                <p style={{ margin: "0.8rem 0 0", fontSize: "1.4rem", fontWeight: 600, color: spendDelta > 0 ? "#f87171" : "#34d399" }}>
                  {spendDelta > 0 ? `↑ ${fmtRound(spendDelta)} (+${spendDeltaPct}%)` : `↓ ${fmtRound(Math.abs(spendDelta))} (${spendDeltaPct}%)`} vs last month
                </p>
              ) : budgetPct !== null ? (
                <p style={{ margin: "0.8rem 0 0", fontSize: "1.4rem", fontWeight: 600, color: budgetPct > 100 ? "#f87171" : "#334155" }}>
                  {budgetPct}% of budget
                </p>
              ) : null}
            </div>

            {/* Violations */}
            <div style={{
              padding: "2.8rem 3.2rem", borderRadius: "1.6rem",
              background: result.goal_violations.length === 0 ? "rgba(52,211,153,0.07)" : "rgba(248,113,113,0.07)",
              border: `1px solid ${result.goal_violations.length === 0 ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)"}`,
            }}>
              <p style={{ margin: "0 0 0.8rem", fontSize: "1.2rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: result.goal_violations.length === 0 ? "#34d399" : "#f87171" }}>
                Violations
              </p>
              <p style={{ margin: 0, fontSize: "7rem", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", color: result.goal_violations.length === 0 ? "#6ee7b7" : "#fca5a5" }}>
                {result.goal_violations.length}
              </p>
              <p style={{ margin: "0.8rem 0 0", fontSize: "1.4rem", color: result.goal_violations.length === 0 ? "#065f46" : "#7f1d1d" }}>
                {result.goal_violations.length === 0 ? "all clear" : "goals exceeded"}
              </p>
            </div>

            {/* Health Grade */}
            <div style={{ padding: "2.8rem 3.2rem", borderRadius: "1.6rem", background: grade.bg, border: `1px solid ${grade.border}` }}>
              <p style={{ margin: "0 0 0.8rem", fontSize: "1.2rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: grade.color, opacity: 0.7 }}>
                Health
              </p>
              <p style={{ margin: 0, fontSize: "7rem", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", color: grade.color }}>
                {grade.letter}
              </p>
              <p style={{ margin: "0.8rem 0 0", fontSize: "1.4rem", color: grade.color, opacity: 0.7 }}>{grade.label}</p>
            </div>
          </div>

          {/* Cash Flow Forecast (current month only) */}
          {isCurrentMonth && daysRemaining > 0 && (
            <div style={{ marginBottom: "4rem" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "1.2rem", marginBottom: "1.6rem" }}>
                <h3 style={{ margin: 0, fontSize: "2.2rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>Cash Flow Forecast</h3>
                <span style={{ fontSize: "1.4rem", color: "#334155" }}>projected end-of-month</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.2rem" }}>
                {/* Daily pace */}
                <div style={{ padding: "2rem 2.4rem", borderRadius: "1.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p style={{ margin: "0 0 0.4rem", fontSize: "1.1rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em" }}>Daily Pace</p>
                  <p style={{ margin: 0, fontSize: "3.2rem", fontWeight: 900, color: "#f8fafc", lineHeight: 1, letterSpacing: "-0.02em" }}>{fmtRound(dailyPace)}</p>
                  {dailyBudget > 0 && (
                    <p style={{ margin: "0.6rem 0 0", fontSize: "1.3rem", fontWeight: 600, color: dailyPace > dailyBudget ? "#f87171" : "#34d399" }}>
                      {dailyPace > dailyBudget ? "above" : "under"} {fmtRound(dailyBudget)}/day budget
                    </p>
                  )}
                </div>
                {/* Projected total */}
                <div style={{ padding: "2rem 2.4rem", borderRadius: "1.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p style={{ margin: "0 0 0.4rem", fontSize: "1.1rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em" }}>Projected Total</p>
                  <p style={{ margin: 0, fontSize: "3.2rem", fontWeight: 900, color: discretionary > 0 && projectedTotal > discretionary ? "#f87171" : "#f8fafc", lineHeight: 1, letterSpacing: "-0.02em" }}>
                    {fmtRound(projectedTotal)}
                  </p>
                  {discretionary > 0 && (
                    <p style={{ margin: "0.6rem 0 0", fontSize: "1.3rem", fontWeight: 600, color: projectedTotal > discretionary ? "#f87171" : "#34d399" }}>
                      {projectedTotal > discretionary ? `${fmtRound(projectedTotal - discretionary)} over budget` : `${fmtRound(discretionary - projectedTotal)} under budget`}
                    </p>
                  )}
                </div>
                {/* Days remaining */}
                <div style={{ padding: "2rem 2.4rem", borderRadius: "1.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p style={{ margin: "0 0 0.4rem", fontSize: "1.1rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em" }}>Days Remaining</p>
                  <p style={{ margin: 0, fontSize: "3.2rem", fontWeight: 900, color: "#f8fafc", lineHeight: 1, letterSpacing: "-0.02em" }}>{daysRemaining}</p>
                  <p style={{ margin: "0.6rem 0 0", fontSize: "1.3rem", color: "#475569" }}>of {daysInMonth} this month</p>
                </div>
                {/* Safe to spend */}
                {discretionary > 0 && (
                  <div style={{
                    padding: "2rem 2.4rem", borderRadius: "1.4rem",
                    background: discretionary - result.stats.total_spent > 0 ? "rgba(99,102,241,0.08)" : "rgba(248,113,113,0.08)",
                    border: `1px solid ${discretionary - result.stats.total_spent > 0 ? "rgba(99,102,241,0.2)" : "rgba(248,113,113,0.2)"}`,
                  }}>
                    <p style={{ margin: "0 0 0.4rem", fontSize: "1.1rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em" }}>Safe to Spend</p>
                    <p style={{ margin: 0, fontSize: "3.2rem", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em", color: discretionary - result.stats.total_spent > 0 ? "#818cf8" : "#f87171" }}>
                      {fmtRound(Math.max(discretionary - result.stats.total_spent, 0))}
                    </p>
                    <p style={{ margin: "0.6rem 0 0", fontSize: "1.3rem", color: "#475569" }}>left in budget</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Savings Goal */}
          {savingsGoal > 0 && (
            <div style={{ marginBottom: "4rem" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "1.2rem", marginBottom: "1.6rem" }}>
                <h3 style={{ margin: 0, fontSize: "2.2rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>Savings Goal</h3>
                <span style={{ fontSize: "1.4rem", color: "#334155" }}>monthly target</span>
              </div>
              <div style={{
                borderRadius: "1.4rem", padding: "2.4rem 3.2rem",
                background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.14)",
                display: "flex", alignItems: "center", gap: "4rem",
              }}>
                <div>
                  <p style={{ margin: "0 0 0.4rem", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Monthly Target</p>
                  <p style={{ margin: 0, fontSize: "4.8rem", fontWeight: 900, color: "#34d399", lineHeight: 1, letterSpacing: "-0.03em" }}>
                    {fmtRound(savingsGoal)}
                  </p>
                </div>
                <div style={{ width: "1px", height: "6rem", background: "rgba(52,211,153,0.15)" }} />
                <div>
                  <p style={{ margin: "0 0 0.4rem", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Annual Goal</p>
                  <p style={{ margin: 0, fontSize: "3.2rem", fontWeight: 900, color: "#6ee7b7", lineHeight: 1, letterSpacing: "-0.02em" }}>
                    {fmtRound(annualGoal)}
                  </p>
                </div>
                {discretionary > 0 && (
                  <>
                    <div style={{ width: "1px", height: "6rem", background: "rgba(52,211,153,0.15)" }} />
                    <div>
                      <p style={{ margin: "0 0 0.4rem", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Savings Rate</p>
                      <p style={{ margin: 0, fontSize: "3.2rem", fontWeight: 900, color: "#6ee7b7", lineHeight: 1, letterSpacing: "-0.02em" }}>
                        {grossIncome > 0 ? Math.round((savingsGoal / grossIncome) * 100) : 0}%
                      </p>
                      <p style={{ margin: "0.4rem 0 0", fontSize: "1.3rem", color: "#475569" }}>of take-home</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Goal Violations */}
          <div style={{ marginBottom: "4rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "1.2rem", marginBottom: "1.6rem" }}>
              <h3 style={{ margin: 0, fontSize: "2.2rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>Goal Violations</h3>
              <span style={{ fontSize: "1.4rem", color: "#334155" }}>this month</span>
            </div>
            {result.goal_violations.length === 0 ? (
              <div style={{ borderRadius: "1.4rem", padding: "4rem", textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: "3rem", margin: "0 0 1rem" }}>🎯</p>
                <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: 600, color: "#64748b" }}>You're within all your spending goals</p>
                <p style={{ margin: "0.6rem 0 0", fontSize: "1.4rem", color: "#334155" }}>Nice work staying on budget this month.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                {result.goal_violations.map((v, i) => {
                  const isExpanded = expandedViolations.has(i);
                  const icon = CATEGORY_ICONS[v.category] ?? "";
                  const pct = v.is_avoid_category ? 100 : (v.amount_spent / v.monthly_limit) * 100;
                  const barColor = pct < 80 ? "#34d399" : pct < 100 ? "#fbbf24" : "#f87171";

                  return (
                    <div key={i} style={{ borderRadius: "1.4rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <button
                        onClick={() => toggleViolation(i)}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "2rem 2.8rem", background: "none", border: "none", cursor: "pointer",
                          textAlign: "left", transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = ""; }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "1.6rem", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "2.4rem" }}>{icon}</span>
                          <span style={{ fontSize: "1.9rem", fontWeight: 700, color: "#f8fafc" }}>{v.category}</span>
                          {v.is_avoid_category ? (
                            <span style={{ fontSize: "1.3rem", borderRadius: "9999px", padding: "0.4rem 1.2rem", fontWeight: 600, background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                              Avoided · {fmt(v.amount_spent)} spent
                            </span>
                          ) : (
                            <span style={{ fontSize: "1.3rem", borderRadius: "9999px", padding: "0.4rem 1.2rem", fontWeight: 600, background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                              Over by {fmt(v.over_by)}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "1.2rem", color: "#334155", flexShrink: 0, marginLeft: "1rem" }}>{isExpanded ? "▼" : "▶"}</span>
                      </button>

                      {isExpanded && (
                        <div style={{ padding: "0 2.8rem 2.4rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                          {!v.is_avoid_category && (
                            <div style={{ marginTop: "2rem", marginBottom: "2.4rem" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.3rem", color: "#334155", marginBottom: "0.8rem" }}>
                                <span>$0</span>
                                <span style={{ fontWeight: 700, color: "#94a3b8" }}>{fmt(v.amount_spent)} ({Math.round(pct)}%)</span>
                                <span>{fmt(v.monthly_limit)} limit</span>
                              </div>
                              <div style={{ width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: "9999px", height: "0.8rem" }}>
                                <div style={{ width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: "9999px", height: "0.8rem", transition: "width 0.3s" }} />
                              </div>
                            </div>
                          )}
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ color: "#334155" }}>
                                <th style={{ textAlign: "left", paddingBottom: "1rem", fontSize: "1.2rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Merchant</th>
                                <th style={{ textAlign: "left", paddingBottom: "1rem", fontSize: "1.2rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Amount</th>
                                <th style={{ textAlign: "left", paddingBottom: "1rem", fontSize: "1.2rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {v.transactions.map((tx, j) => (
                                <tr key={j} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                  <td style={{ padding: "1.2rem 1.2rem 1.2rem 0", fontSize: "1.6rem", color: "#94a3b8", fontWeight: 500 }}>{tx.name}</td>
                                  <td style={{ padding: "1.2rem 1.2rem 1.2rem 0", fontSize: "1.6rem", color: "#94a3b8" }}>{fmt(tx.amount)}</td>
                                  <td style={{ padding: "1.2rem 0", fontSize: "1.4rem", color: "#475569" }}>{tx.date}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Merchants */}
          {topMerchants.length > 0 && (
            <div style={{ marginBottom: "4rem" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "1.2rem", marginBottom: "1.6rem" }}>
                <h3 style={{ margin: 0, fontSize: "2.2rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>Top Merchants</h3>
                <span style={{ fontSize: "1.4rem", color: "#334155" }}>where your money went</span>
              </div>
              <div style={{ borderRadius: "1.4rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
                {topMerchants.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "1.8rem 2.4rem",
                      borderBottom: i < topMerchants.length - 1 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                      display: "grid",
                      gridTemplateColumns: "2.4rem 1fr auto",
                      alignItems: "center",
                      gap: "1.6rem",
                    }}
                  >
                    <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "#334155", textAlign: "center" }}>
                      {i + 1}
                    </span>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                        <span style={{ fontSize: "1.7rem", fontWeight: 700, color: "#f8fafc" }}>{m.name}</span>
                        <span style={{ fontSize: "1.4rem", color: "#475569" }}>{m.visit_count} visit{m.visit_count !== 1 ? "s" : ""}</span>
                      </div>
                      <div style={{ width: "100%", background: "rgba(255,255,255,0.06)", borderRadius: "9999px", height: "0.6rem" }}>
                        <div style={{
                          width: `${Math.round((m.total_amount / maxMerchantAmount) * 100)}%`,
                          background: i === 0 ? "#6366f1" : i === 1 ? "#818cf8" : "#a5b4fc",
                          borderRadius: "9999px", height: "0.6rem", transition: "width 0.4s",
                        }} />
                      </div>
                    </div>
                    <span style={{ fontSize: "2rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em", textAlign: "right", minWidth: "10rem" }}>
                      {fmt(m.total_amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subscriptions */}
          {subscriptions.length > 0 && (
            <div style={{ marginBottom: "4rem" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "1.2rem", marginBottom: "1.6rem" }}>
                <h3 style={{ margin: 0, fontSize: "2.2rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>Recurring Charges</h3>
                <span style={{ fontSize: "1.4rem", color: "#334155" }}>detected subscriptions</span>
                <span style={{ marginLeft: "auto", fontSize: "1.5rem", fontWeight: 700, color: "#f87171" }}>
                  {fmtRound(subMonthlyTotal)}/mo total
                </span>
              </div>
              <div style={{ borderRadius: "1.4rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
                {subscriptions.map((sub, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "1.8rem 2.4rem",
                      borderBottom: i < subscriptions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "1.6rem" }}>
                      <span style={{ fontSize: "2rem" }}>🔄</span>
                      <div>
                        <p style={{ margin: 0, fontSize: "1.7rem", fontWeight: 700, color: "#f8fafc" }}>{sub.name}</p>
                        <p style={{ margin: "0.3rem 0 0", fontSize: "1.3rem", color: "#475569" }}>
                          {sub.frequency} · seen {sub.months_detected} months · last {sub.last_date}
                        </p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: 0, fontSize: "2rem", fontWeight: 900, color: "#fbbf24", letterSpacing: "-0.01em" }}>
                        {fmt(sub.amount)}
                      </p>
                      <p style={{ margin: "0.2rem 0 0", fontSize: "1.2rem", color: "#475569" }}>/mo avg</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unusual Purchases */}
          <div style={{ marginBottom: "4rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "1.2rem", marginBottom: "1.6rem" }}>
              <h3 style={{ margin: 0, fontSize: "2.2rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>Unusual Purchases</h3>
              <span style={{ fontSize: "1.4rem", color: "#334155" }}>transactions significantly above your average</span>
            </div>
            {sorted.length === 0 ? (
              <div style={{ borderRadius: "1.4rem", padding: "4rem", textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p style={{ fontSize: "3rem", margin: "0 0 1rem" }}>✅</p>
                <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: 600, color: "#64748b" }}>Your spending looks consistent</p>
                <p style={{ margin: "0.6rem 0 0", fontSize: "1.4rem", color: "#334155" }}>No unusually large transactions detected.</p>
              </div>
            ) : (
              <div style={{ borderRadius: "1.4rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <th style={{ padding: "1.6rem 2.4rem", textAlign: "left" }}><SortBtn field="name" label="Merchant" /></th>
                      <th style={{ padding: "1.6rem 2.4rem", textAlign: "left" }}><SortBtn field="amount" label="Amount" /></th>
                      <th style={{ padding: "1.6rem 2.4rem", textAlign: "left" }}><SortBtn field="date" label="Date" /></th>
                      <th style={{ padding: "1.6rem 2.4rem", textAlign: "left", fontSize: "1.2rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#334155" }}>Why flagged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((tx, i) => (
                      <tr key={i}
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.03)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}>
                        <td style={{ padding: "2rem 2.4rem", fontSize: "1.8rem", fontWeight: 700, color: "#f8fafc" }}>{tx.name}</td>
                        <td style={{ padding: "2rem 2.4rem", fontSize: "2rem", fontWeight: 900, color: "#f87171", letterSpacing: "-0.01em" }}>{fmt(tx.amount)}</td>
                        <td style={{ padding: "2rem 2.4rem", fontSize: "1.5rem", color: "#475569" }}>{tx.date}</td>
                        <td style={{ padding: "2rem 2.4rem", fontSize: "1.4rem", color: "#475569" }}>{tx.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE 1: Goals ───────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", animation: "fadeSlideUp 0.4s ease-out both" }}>
      <StepProgress current={3} total={4} />

      <div style={{ ...panelPad, maxWidth: "1200px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem", marginBottom: "3.2rem" }}>
          <button
            onClick={() => setView("income")}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "0.9rem",
              padding: "0.9rem 1.8rem",
              cursor: "pointer",
              fontSize: "1.5rem",
              fontWeight: 600,
              color: "#94a3b8",
              letterSpacing: "-0.01em",
              flexShrink: 0,
              transition: "background 0.15s, border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.background = "rgba(255,255,255,0.09)";
              b.style.borderColor = "rgba(255,255,255,0.25)";
              b.style.color = "#f8fafc";
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.background = "rgba(255,255,255,0.05)";
              b.style.borderColor = "rgba(255,255,255,0.15)";
              b.style.color = "#94a3b8";
            }}
          >
            ← Back
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "1.6rem" }}>
            <span style={{ fontSize: "3rem" }}>🎯</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "3.2rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em" }}>Spending Goals</h2>
              <p style={{ margin: 0, fontSize: "1.4rem", color: "#475569" }}>Set monthly budgets or mark categories to avoid entirely.</p>
            </div>
          </div>
        </div>

        {discretionary > 0 && (
          <div style={{ marginBottom: "2.4rem", borderRadius: "1.4rem", padding: "2.4rem 3.2rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.6rem" }}>
              <div>
                <p style={{ margin: "0 0 0.4rem", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Discretionary budget</p>
                <p style={{ margin: 0, fontSize: "4rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {fmtRound(discretionary)}<span style={{ fontSize: "1.6rem", fontWeight: 500, color: "#334155", marginLeft: "0.8rem" }}>/mo</span>
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: "0 0 0.4rem", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {allocated > discretionary ? "Over by" : "Remaining"}
                </p>
                <p style={{ margin: 0, fontSize: "4rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1, color: allocated > discretionary ? "#f87171" : "#818cf8" }}>
                  {fmtRound(Math.abs(discretionary - allocated))}
                </p>
              </div>
            </div>
            <div style={{ width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: "9999px", height: "0.6rem" }}>
              <div style={{
                width: `${Math.min((allocated / discretionary) * 100, 100)}%`,
                background: allocated > discretionary ? "#f87171" : "#6366f1",
                borderRadius: "9999px", height: "0.6rem", transition: "width 0.3s",
              }} />
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "1.2rem", marginBottom: "2rem" }}>
          <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Auto-fill:</span>
          {["Tight", "Standard", "Generous"].map((name) => (
            <button
              key={name}
              onClick={() => applyPreset(name)}
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "9999px", padding: "0.8rem 2rem",
                fontSize: "1.4rem", fontWeight: 600, color: "#64748b", cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(99,102,241,0.5)";
                (e.currentTarget as HTMLButtonElement).style.color = "#a5b4fc";
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)";
                (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
              }}
            >
              {name}
            </button>
          ))}
        </div>

        <div style={{ borderRadius: "1.6rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "2.4rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <th style={{ padding: "1.4rem 2.4rem", textAlign: "left", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Category</th>
                <th style={{ padding: "1.4rem 2.4rem", textAlign: "left", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Monthly Limit</th>
                <th style={{ padding: "1.4rem 2.4rem", textAlign: "center", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Avoid</th>
              </tr>
            </thead>
            <tbody>
              {goals.map((g, i) => (
                <tr
                  key={g.category}
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    background: (g.enabled || g.avoid) ? "rgba(99,102,241,0.05)" : undefined,
                    transition: "background 0.15s",
                  }}
                >
                  <td style={{ padding: "1.8rem 2.4rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "1.6rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={g.enabled}
                        onChange={() => toggleEnabled(i)}
                        style={{ width: "2rem", height: "2rem", accentColor: "#6366f1", cursor: "pointer", flexShrink: 0 }}
                      />
                      <span style={{
                        display: "flex", alignItems: "center", gap: "1rem",
                        fontSize: "1.8rem", fontWeight: g.enabled || g.avoid ? 700 : 400,
                        color: g.enabled || g.avoid ? "#f8fafc" : "#334155",
                        transition: "color 0.15s",
                      }}>
                        <span style={{ fontSize: "2rem" }}>{CATEGORY_ICONS[g.category] ?? ""}</span>
                        {g.category}
                      </span>
                    </label>
                  </td>
                  <td style={{ padding: "1.8rem 2.4rem" }}>
                    <div style={{ position: "relative", width: "18rem" }}>
                      <span style={{
                        position: "absolute", left: "1.4rem", top: "50%", transform: "translateY(-50%)",
                        fontSize: "1.8rem", color: "#334155", pointerEvents: "none", fontWeight: 600,
                      }}>$</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 200"
                        value={g.monthlyLimit}
                        disabled={g.avoid || !g.enabled}
                        onChange={(e) => setLimit(i, e.target.value)}
                        style={{
                          width: "100%", height: "5.2rem",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.09)",
                          borderRadius: "1rem", paddingLeft: "4rem", paddingRight: "1.2rem",
                          fontSize: "1.8rem", fontWeight: 600, color: "#f8fafc", outline: "none",
                          opacity: (g.avoid || !g.enabled) ? 0.25 : 1,
                          fontFamily: "inherit", transition: "border-color 0.2s",
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.6)"; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
                      />
                    </div>
                  </td>
                  <td style={{ padding: "1.8rem 2.4rem", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={g.avoid}
                      onChange={() => toggleAvoid(i)}
                      style={{ width: "2rem", height: "2rem", accentColor: "#f87171", cursor: "pointer" }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && (
          <div style={{ marginBottom: "1.6rem", borderRadius: "1rem", padding: "1.4rem 2rem", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", fontSize: "1.5rem", color: "#f87171", fontWeight: 500 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <button
            onClick={() => runReview()}
            disabled={loading || !hasAnyGoal}
            style={{
              background: loading || !hasAnyGoal ? "rgba(255,255,255,0.07)" : "#4f46e5",
              color: loading || !hasAnyGoal ? "#334155" : "#fff",
              fontWeight: 700, fontSize: "1.7rem", padding: "1.4rem 4rem",
              borderRadius: "1.2rem", border: "none",
              cursor: loading || !hasAnyGoal ? "not-allowed" : "pointer",
              boxShadow: loading || !hasAnyGoal ? undefined : "0 8px 28px rgba(99,102,241,0.4)",
              letterSpacing: "-0.01em", transition: "background 0.15s",
            }}
          >
            {loading ? "Analyzing…" : "Run Spending Review →"}
          </button>
          {!hasAnyGoal && (
            <span style={{ fontSize: "1.4rem", color: "#334155" }}>Check at least one category to continue.</span>
          )}
        </div>
      </div>
    </div>
  );
};

SpendingReview.displayName = "SpendingReview";

export default SpendingReview;
