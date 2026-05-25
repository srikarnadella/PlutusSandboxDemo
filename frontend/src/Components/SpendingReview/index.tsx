import React, { useState } from "react";

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
  "Shops": "🛍️",
  "Travel": "✈️",
  "Recreation": "🎮",
  "Healthcare": "🏥",
  "Service": "⚙️",
  "Transfer": "↔️",
  "Payment": "💳",
};

const PRESETS: Record<string, Record<string, number>> = {
  Tight:    { "Food and Drink":0.15, "Shops":0.08, "Travel":0.05, "Recreation":0.03, "Healthcare":0.08, "Service":0.03, "Transfer":0.05, "Payment":0.05 },
  Standard: { "Food and Drink":0.25, "Shops":0.12, "Travel":0.10, "Recreation":0.06, "Healthcare":0.10, "Service":0.05, "Transfer":0.08, "Payment":0.08 },
  Generous: { "Food and Drink":0.35, "Shops":0.20, "Travel":0.15, "Recreation":0.10, "Healthcare":0.15, "Service":0.08, "Transfer":0.10, "Payment":0.10 },
};

const PRESET_ABSOLUTE: Record<string, Record<string, number>> = {
  Tight:    { "Food and Drink":200, "Shops":100, "Travel":80,  "Recreation":40,  "Healthcare":80,  "Service":40,  "Transfer":100, "Payment":100 },
  Standard: { "Food and Drink":350, "Shops":175, "Travel":150, "Recreation":75,  "Healthcare":150, "Service":75,  "Transfer":150, "Payment":150 },
  Generous: { "Food and Drink":500, "Shops":300, "Travel":250, "Recreation":125, "Healthcare":200, "Service":100, "Transfer":200, "Payment":200 },
};

interface IncomeSetup {
  monthlyIncome: string;
  rent: string;
  utilities: string;
  otherFixed: string;
}

interface GoalRow {
  category: string;
  enabled: boolean;
  monthlyLimit: string;
  avoid: boolean;
}

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

interface ReviewResult {
  unusual_transactions: UnusualTx[];
  goal_violations: GoalViolation[];
  stats: ReviewStats;
}

type SortField = "name" | "amount" | "date";
type SortDir   = "asc"  | "desc";

const fmt = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtRound = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

// ── Module-level sub-components (must NOT be inside SpendingReview or they
//    lose identity on every render, causing inputs to unmount/lose focus) ────

const CardHeader = ({
  icon, title, subtitle, right,
}: {
  icon: string; title: string; subtitle?: string; right?: React.ReactNode;
}) => (
  <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 px-8 py-7 flex items-center justify-between">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0 backdrop-blur-sm">
        {icon}
      </div>
      <div>
        <h2 className="text-white text-xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {right && <div className="flex items-center gap-3">{right}</div>}
  </div>
);

const IncomeInput = ({
  label, value, placeholder, onChange,
}: {
  label: string; value: string; placeholder: string;
  onChange: (v: string) => void;
}) => (
  <div>
    <label className="block text-xs font-bold text-slate-400 uppercase tracking-[0.1em] mb-3">
      {label}
    </label>
    <div className="relative">
      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-lg pointer-events-none select-none">
        $
      </span>
      <input
        type="number"
        min="0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl pl-10 pr-5 py-5
                   text-slate-800 font-semibold text-lg placeholder-slate-300
                   focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100
                   hover:border-slate-300 hover:bg-white
                   transition-all duration-200"
      />
    </div>
  </div>
);

const SpendingReview = () => {
  const [view, setView] = useState<"income" | "goals" | "results">("income");
  const [income, setIncome] = useState<IncomeSetup>({ monthlyIncome: "", rent: "", utilities: "", otherFixed: "" });
  const [goals, setGoals] = useState<GoalRow[]>(
    PRESET_CATEGORIES.map((cat) => ({ category: cat, enabled: false, monthlyLimit: "", avoid: false }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [sortField, setSortField] = useState<SortField>("amount");
  const [sortDir, setSortDir]     = useState<SortDir>("desc");
  const [expandedViolations, setExpandedViolations] = useState<Set<number>>(new Set());

  const discretionary =
    (parseFloat(income.monthlyIncome) || 0)
    - (parseFloat(income.rent) || 0)
    - (parseFloat(income.utilities) || 0)
    - (parseFloat(income.otherFixed) || 0);

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

  const runReview = async () => {
    setLoading(true);
    setError(null);
    const budgets = goals
      .filter((g) => g.enabled && !g.avoid && g.monthlyLimit !== "")
      .map((g) => ({ category: g.category, monthly_limit: parseFloat(g.monthlyLimit) }));
    const avoid_categories = goals.filter((g) => g.avoid).map((g) => g.category);
    try {
      const resp = await fetch("/api/spending_review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgets, avoid_categories }),
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
    const v   = data.goal_violations.length;
    const pct = discretionary > 0 ? data.stats.total_spent / discretionary : null;
    if (v === 0 && (pct === null || pct < 0.8))  return { letter: "A", label: "Excellent",   ring: "ring-emerald-400", text: "text-emerald-400", bg: "bg-emerald-400/10" };
    if (v <= 1 && (pct === null || pct < 1.0))   return { letter: "B", label: "Good",        ring: "ring-sky-400",     text: "text-sky-400",     bg: "bg-sky-400/10"     };
    if (v <= 2 && (pct === null || pct < 1.2))   return { letter: "C", label: "Fair",        ring: "ring-yellow-400",  text: "text-yellow-400",  bg: "bg-yellow-400/10"  };
    if (v <= 4)                                   return { letter: "D", label: "Over Budget", ring: "ring-orange-400",  text: "text-orange-400",  bg: "bg-orange-400/10"  };
    return                                               { letter: "F", label: "Critical",   ring: "ring-red-400",     text: "text-red-400",     bg: "bg-red-400/10"     };
  };

  const hasAnyGoal = goals.some((g) => g.enabled || g.avoid);

  // ── PHASE 0: Income ───────────────────────────────────────────────────────
  if (view === "income") {
    const previewIncome = parseFloat(income.monthlyIncome) || 0;
    const previewDisc   = previewIncome
      - (parseFloat(income.rent) || 0)
      - (parseFloat(income.utilities) || 0)
      - (parseFloat(income.otherFixed) || 0);

    return (
      <div
        className="w-full mt-8 rounded-2xl overflow-hidden shadow-2xl shadow-slate-300/60"
        style={{ animation: "fadeSlideUp 0.35s ease-out both" }}
      >
        <CardHeader
          icon="💰"
          title="Budget Setup"
          subtitle="Enter your monthly income and fixed costs to frame your card spending."
        />
        <div className="bg-white px-8 py-9">
          <div className="grid grid-cols-2 gap-6">
            <IncomeInput
              label="Monthly Take-Home Income"
              value={income.monthlyIncome}
              placeholder="4,000"
              onChange={(v) => setIncome((p) => ({ ...p, monthlyIncome: v }))}
            />
            <IncomeInput
              label="Rent / Mortgage"
              value={income.rent}
              placeholder="1,500"
              onChange={(v) => setIncome((p) => ({ ...p, rent: v }))}
            />
            <IncomeInput
              label="Utilities"
              value={income.utilities}
              placeholder="200"
              onChange={(v) => setIncome((p) => ({ ...p, utilities: v }))}
            />
            <IncomeInput
              label="Other Fixed (subscriptions, insurance…)"
              value={income.otherFixed}
              placeholder="150"
              onChange={(v) => setIncome((p) => ({ ...p, otherFixed: v }))}
            />
          </div>

          {previewIncome > 0 && (
            <div
              className={`mt-7 rounded-2xl border px-7 py-6 ${
                previewDisc < 0
                  ? "bg-red-50 border-red-100"
                  : "bg-gradient-to-r from-indigo-50 via-violet-50 to-indigo-50 border-indigo-100"
              }`}
              style={{ animation: "fadeSlideUp 0.25s ease-out both" }}
            >
              <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.1em]">
                Available for discretionary spending
              </p>
              <p className={`text-5xl font-black mt-2 tracking-tight ${previewDisc < 0 ? "text-red-600" : "text-indigo-700"}`}>
                {fmtRound(Math.max(previewDisc, 0))}
                <span className="text-lg font-medium text-slate-400 ml-3">/month</span>
              </p>
              {previewDisc < 0 && (
                <p className="text-red-600 text-sm font-semibold mt-3">⚠️ Fixed expenses exceed income.</p>
              )}
            </div>
          )}

          <div className="mt-8 flex items-center gap-5">
            <button
              onClick={() => setView("goals")}
              className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold px-8 py-4 rounded-2xl transition-all duration-200 shadow-xl shadow-indigo-200 hover:shadow-indigo-300 text-sm tracking-wide"
            >
              Set spending goals →
            </button>
            <button
              onClick={() => setView("goals")}
              className="text-slate-400 hover:text-slate-600 text-sm transition-colors font-medium"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE 2: Results ──────────────────────────────────────────────────────
  if (view === "results" && result) {
    const grade     = getGrade(result);
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
        className={`flex items-center gap-1 font-semibold text-xs uppercase tracking-wider transition-colors ${
          sortField === field ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
        }`}
      >
        {label}
        {sortField === field && <span>{sortDir === "desc" ? "▼" : "▲"}</span>}
      </button>
    );

    return (
      <div
        className="w-full mt-8 rounded-2xl overflow-hidden shadow-2xl shadow-slate-300/60"
        style={{ animation: "fadeSlideUp 0.35s ease-out both" }}
      >
        {/* Dark header */}
        <CardHeader
          icon="📊"
          title="Spending Review"
          subtitle={result.stats.period}
          right={
            <>
              <button
                onClick={exportCSV}
                className="text-slate-400 hover:text-white text-xs font-medium transition-colors flex items-center gap-1"
              >
                ↓ Export CSV
              </button>
              <button
                onClick={() => { setResult(null); setView("goals"); }}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Set new goals
              </button>
            </>
          }
        />

        {/* Stats bar (dark) */}
        <div className="bg-slate-900 px-8 py-5 grid grid-cols-4 gap-4 border-b border-slate-700/50">
          <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transactions</p>
            <p className="text-3xl font-bold text-white mt-1">{result.stats.transactions_analyzed}</p>
            <p className="text-xs text-slate-500 mt-0.5">analyzed</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Spent</p>
            <p className="text-2xl font-bold text-white mt-1 tracking-tight">{fmt(result.stats.total_spent)}</p>
            {budgetPct !== null && (
              <p className={`text-xs mt-0.5 font-medium ${budgetPct > 100 ? "text-red-400" : "text-slate-500"}`}>
                {budgetPct}% of budget
              </p>
            )}
          </div>
          <div className={`rounded-xl border px-4 py-4 ${result.goal_violations.length === 0 ? "bg-emerald-400/10 border-emerald-400/20" : "bg-red-400/10 border-red-400/20"}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider ${result.goal_violations.length === 0 ? "text-emerald-400" : "text-red-400"}`}>
              Violations
            </p>
            <p className={`text-3xl font-bold mt-1 ${result.goal_violations.length === 0 ? "text-emerald-300" : "text-red-300"}`}>
              {result.goal_violations.length}
            </p>
            <p className={`text-xs mt-0.5 ${result.goal_violations.length === 0 ? "text-emerald-500" : "text-red-500"}`}>
              {result.goal_violations.length === 0 ? "all clear" : "goals exceeded"}
            </p>
          </div>
          <div className={`rounded-xl border px-4 py-4 ring-1 ${grade.ring} ${grade.bg}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider ${grade.text} opacity-70`}>Health</p>
            <p className={`text-3xl font-bold mt-1 ${grade.text}`}>{grade.letter}</p>
            <p className={`text-xs mt-0.5 ${grade.text} opacity-70`}>{grade.label}</p>
          </div>
        </div>

        {/* White content area */}
        <div className="bg-white px-8 py-7">
          {/* Unusual Purchases */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-base font-bold text-slate-800">Unusual Purchases</h3>
              <span className="text-xs text-slate-400 font-normal">· transactions significantly above your average</span>
            </div>
            {sorted.length === 0 ? (
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-5 py-6 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-sm font-medium text-slate-600">Your spending looks consistent</p>
                <p className="text-xs text-slate-400 mt-1">No unusually large transactions detected.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-5 py-3 text-left"><SortBtn field="name" label="Merchant" /></th>
                      <th className="px-5 py-3 text-left"><SortBtn field="amount" label="Amount" /></th>
                      <th className="px-5 py-3 text-left"><SortBtn field="date" label="Date" /></th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Why flagged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((tx, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-slate-800">{tx.name}</td>
                        <td className="px-5 py-3.5 font-bold text-red-500">{fmt(tx.amount)}</td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs">{tx.date}</td>
                        <td className="px-5 py-3.5 text-slate-400 text-xs">{tx.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Goal Violations */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-base font-bold text-slate-800">Goal Violations</h3>
              <span className="text-xs text-slate-400 font-normal">· this month</span>
            </div>
            {result.goal_violations.length === 0 ? (
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-5 py-6 text-center">
                <p className="text-2xl mb-2">🎯</p>
                <p className="text-sm font-medium text-slate-600">You're within all your spending goals</p>
                <p className="text-xs text-slate-400 mt-1">Nice work staying on budget this month.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {result.goal_violations.map((v, i) => {
                  const isExpanded = expandedViolations.has(i);
                  const icon = CATEGORY_ICONS[v.category] ?? "";
                  const pct = v.is_avoid_category ? 100 : (v.amount_spent / v.monthly_limit) * 100;
                  const barColor = pct < 80 ? "bg-emerald-500" : pct < 100 ? "bg-yellow-400" : "bg-red-500";

                  return (
                    <div key={i} className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <button
                        onClick={() => toggleViolation(i)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-lg">{icon}</span>
                          <span className="font-bold text-slate-800 text-sm">{v.category}</span>
                          {v.is_avoid_category ? (
                            <span className="text-xs bg-red-50 text-red-600 border border-red-100 rounded-full px-3 py-0.5 font-medium">
                              Avoided · {fmt(v.amount_spent)} spent
                            </span>
                          ) : (
                            <span className="text-xs bg-red-50 text-red-600 border border-red-100 rounded-full px-3 py-0.5 font-medium">
                              Over by {fmt(v.over_by)}
                            </span>
                          )}
                        </div>
                        <span className="text-slate-300 text-xs ml-3 flex-shrink-0">{isExpanded ? "▼" : "▶"}</span>
                      </button>

                      {isExpanded && (
                        <div className="px-5 pb-5 border-t border-slate-100">
                          {!v.is_avoid_category && (
                            <div className="mt-4 mb-5">
                              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                                <span>$0</span>
                                <span className="font-semibold text-slate-600">
                                  {fmt(v.amount_spent)} <span className="text-slate-400 font-normal">({Math.round(pct)}%)</span>
                                </span>
                                <span>{fmt(v.monthly_limit)} limit</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2.5">
                                <div
                                  className={`${barColor} h-2.5 rounded-full transition-all`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-slate-400">
                                <th className="pb-2 font-semibold uppercase tracking-wider">Merchant</th>
                                <th className="pb-2 font-semibold uppercase tracking-wider">Amount</th>
                                <th className="pb-2 font-semibold uppercase tracking-wider">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {v.transactions.map((tx, j) => (
                                <tr key={j} className="border-t border-slate-50">
                                  <td className="py-2 pr-4 text-slate-700 font-medium">{tx.name}</td>
                                  <td className="py-2 pr-4 text-slate-700">{fmt(tx.amount)}</td>
                                  <td className="py-2 text-slate-400">{tx.date}</td>
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
        </div>
      </div>
    );
  }

  // ── PHASE 1: Goals ────────────────────────────────────────────────────────
  return (
    <div
      className="w-full mt-8 rounded-2xl overflow-hidden shadow-2xl shadow-slate-300/60"
      style={{ animation: "fadeSlideUp 0.35s ease-out both" }}
    >
      <CardHeader
        icon="🎯"
        title="Spending Goals"
        subtitle="Set monthly budgets or mark categories to avoid entirely"
      />

      <div className="bg-white px-8 py-7">
        {/* Budget allocation banner */}
        {discretionary > 0 && (
          <div className="mb-6 rounded-xl bg-gradient-to-r from-slate-50 to-indigo-50 border border-slate-200 px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Discretionary budget</span>
                <p className="text-2xl font-bold text-slate-800 mt-0.5 tracking-tight">{fmtRound(discretionary)}<span className="text-sm font-normal text-slate-400">/mo</span></p>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {allocated > discretionary ? "Over by" : "Remaining"}
                </span>
                <p className={`text-2xl font-bold mt-0.5 tracking-tight ${allocated > discretionary ? "text-red-600" : "text-indigo-600"}`}>
                  {fmtRound(Math.abs(discretionary - allocated))}
                </p>
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${allocated > discretionary ? "bg-red-400" : "bg-indigo-500"}`}
                style={{ width: `${Math.min((allocated / discretionary) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Preset buttons */}
        <div className="mb-5 flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Auto-fill:</span>
          {["Tight", "Standard", "Generous"].map((name) => (
            <button
              key={name}
              onClick={() => applyPreset(name)}
              className="text-xs font-semibold border-2 border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-slate-500 rounded-full px-4 py-1.5 transition-all"
            >
              {name}
            </button>
          ))}
        </div>

        {/* Goals table */}
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly Limit</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Avoid</th>
              </tr>
            </thead>
            <tbody>
              {goals.map((g, i) => (
                <tr
                  key={g.category}
                  className={`border-b border-slate-100 last:border-0 transition-colors ${g.enabled || g.avoid ? "bg-indigo-50/40" : "hover:bg-slate-50/50"}`}
                >
                  <td className="px-5 py-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={g.enabled}
                        onChange={() => toggleEnabled(i)}
                        className="accent-indigo-600 w-4 h-4"
                      />
                      <span className={`flex items-center gap-2 ${g.enabled || g.avoid ? "text-slate-800 font-semibold" : "text-slate-400"}`}>
                        <span className="text-base">{CATEGORY_ICONS[g.category] ?? ""}</span>
                        {g.category}
                      </span>
                    </label>
                  </td>
                  <td className="px-5 py-3">
                    <div className="relative w-32">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">$</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 200"
                        value={g.monthlyLimit}
                        disabled={g.avoid || !g.enabled}
                        onChange={(e) => setLimit(i, e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-300 transition-all"
                      />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={g.avoid}
                      onChange={() => toggleAvoid(i)}
                      className="accent-red-500 w-4 h-4"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 font-medium">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center gap-5">
          <button
            onClick={runReview}
            disabled={loading || !hasAnyGoal}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400
                       text-white font-semibold px-7 py-3 rounded-xl transition-all
                       shadow-lg shadow-indigo-200 hover:shadow-indigo-300 disabled:shadow-none text-sm"
          >
            {loading ? "Analyzing…" : "Run Spending Review"}
          </button>
          {!hasAnyGoal && (
            <span className="text-xs text-slate-400">Check at least one category to continue.</span>
          )}
        </div>
      </div>
    </div>
  );
};

SpendingReview.displayName = "SpendingReview";

export default SpendingReview;
