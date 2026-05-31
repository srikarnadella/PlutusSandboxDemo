import React, { useState, useEffect, useRef, useContext } from "react";
import { supabase } from "../../lib/supabase";
import { apiFetch } from "../../lib/apiFetch";
import type { User } from "@supabase/supabase-js";
import Context from "../../Context";
import Dashboard from "./Dashboard";
import Transactions from "./Transactions";
import Budgets from "./Budgets";
import Account from "./Account";
import Goals, { type SavingsGoal } from "./Goals";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface IncomeSetup {
  monthlyIncome: string; rent: string; utilities: string;
  otherFixed: string; monthlySavings: string;
}

export interface GoalRow {
  category: string; enabled: boolean; monthlyLimit: string; avoid: boolean;
}

const PRESET_CATEGORIES = [
  "Food and Drink", "Shops", "Travel", "Recreation",
  "Healthcare", "Service", "Transfer", "Payment",
];

// ── Nav definition ────────────────────────────────────────────────────────────

type Tab = "dashboard" | "transactions" | "budgets" | "goals" | "account";

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard",    label: "Overview",      icon: "⊞" },
  { id: "transactions", label: "Transactions",  icon: "≡" },
  { id: "budgets",      label: "Budgets",       icon: "◎" },
  { id: "goals",        label: "Goals",         icon: "◇" },
  { id: "account",      label: "Account",       icon: "○" },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

const Sidebar = ({
  activeTab, onTab, userEmail, onSignOut,
}: { activeTab: Tab; onTab: (t: Tab) => void; userEmail?: string; onSignOut: () => void }) => (
  <div style={{
    width: "220px", position: "fixed", top: 0, left: 0, bottom: 0,
    background: "rgba(7,11,20,0.85)",
    backdropFilter: "blur(20px)",
    borderRight: "1px solid rgba(255,255,255,0.07)",
    display: "flex", flexDirection: "column",
    padding: "2.4rem 1.2rem",
    zIndex: 100,
  }}>
    {/* Logo */}
    <div style={{ marginBottom: "3.2rem", paddingLeft: "1.2rem" }}>
      <span style={{ fontSize: "1.8rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.04em" }}>
        Plu<span style={{ background: "linear-gradient(135deg, #818cf8, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>tus</span>
      </span>
    </div>

    {/* Nav items */}
    <nav style={{ display: "flex", flexDirection: "column", gap: "0.2rem", flex: 1 }}>
      {NAV.map(({ id, label, icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTab(id)}
            style={{
              display: "flex", alignItems: "center", gap: "1rem",
              padding: "0.9rem 1.2rem",
              borderRadius: "0.8rem",
              border: "none",
              borderLeft: active ? "2px solid #818cf8" : "2px solid transparent",
              background: active ? "rgba(99,102,241,0.1)" : "transparent",
              color: active ? "#c7d2fe" : "#475569",
              fontWeight: active ? 600 : 400,
              fontSize: "1.45rem",
              cursor: "pointer",
              textAlign: "left" as const,
              transition: "all 0.15s",
              width: "100%",
              letterSpacing: "-0.01em",
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "#475569";
              }
            }}
          >
            <span style={{ fontSize: "1.3rem", opacity: active ? 1 : 0.45, width: "1.6rem", textAlign: "center" as const, flexShrink: 0 }}>{icon}</span>
            {label}
          </button>
        );
      })}
    </nav>

    {/* User footer */}
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1.4rem" }}>
      {userEmail && (
        <p style={{ margin: "0 0 1rem", fontSize: "1.15rem", color: "#2d3748", paddingLeft: "0.4rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          {userEmail}
        </p>
      )}
      <button
        onClick={onSignOut}
        style={{
          width: "100%", padding: "0.8rem 1.2rem", borderRadius: "0.8rem",
          border: "1px solid rgba(255,255,255,0.07)",
          background: "transparent",
          color: "#334155", fontSize: "1.35rem", fontWeight: 500,
          cursor: "pointer", textAlign: "left" as const, transition: "all 0.15s",
          letterSpacing: "-0.01em",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.25)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.05)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#334155"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        Sign out
      </button>
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────

const SpendingReview = () => {
  const _now = new Date();
  const { dispatch } = useContext(Context);

  const handleReconnect = () => {
    dispatch({ type: "SET_STATE", state: { hasPlaidConnection: false, linkSuccess: false } });
  };

  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [income, setIncome] = useState<IncomeSetup>({ monthlyIncome: "", rent: "", utilities: "", otherFixed: "", monthlySavings: "" });
  const [goals, setGoals] = useState<GoalRow[]>(PRESET_CATEGORIES.map((cat) => ({ category: cat, enabled: false, monthlyLimit: "", avoid: false })));
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteTags, setNoteTags] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState(_now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(_now.getMonth() + 1);
  const [user, setUser] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const monthOptions = Array.from({ length: 13 }, (_, i) => {
    const d = new Date(_now.getFullYear(), _now.getMonth() - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
  });

  const grossIncome = parseFloat(income.monthlyIncome) || 0;
  const discretionary = grossIncome
    - (parseFloat(income.rent) || 0)
    - (parseFloat(income.utilities) || 0)
    - (parseFloat(income.otherFixed) || 0)
    - (parseFloat(income.monthlySavings) || 0);

  const allocated = goals
    .filter((g) => g.enabled && !g.avoid && g.monthlyLimit !== "")
    .reduce((sum, g) => sum + (parseFloat(g.monthlyLimit) || 0), 0);

  // ── Supabase load/save ──────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) loadProfile(data.user.id);
      else setProfileLoading(false);
    });
  }, []);

  const loadProfile = async (uid: string) => {
    setProfileLoading(true);
    try {
      const [profileRes, goalsRes, savingsRes, notesRes] = await Promise.all([
        supabase.from("user_profiles").select("monthly_income, rent, utilities, other_fixed, monthly_savings").eq("id", uid).maybeSingle(),
        supabase.from("spending_goals").select("*").eq("user_id", uid),
        supabase.from("savings_goals").select("*").eq("user_id", uid).order("created_at"),
        supabase.from("transaction_notes").select("transaction_id, note, tag").eq("user_id", uid),
      ]);
      if (profileRes.data) {
        const p = profileRes.data;
        setIncome({
          monthlyIncome: p.monthly_income?.toString() ?? "",
          rent: p.rent?.toString() ?? "",
          utilities: p.utilities?.toString() ?? "",
          otherFixed: p.other_fixed?.toString() ?? "",
          monthlySavings: p.monthly_savings?.toString() ?? "",
        });
      }
      const savedGoals = goalsRes.data ?? [];
      if (savedGoals.length > 0) {
        setGoals((prev) => prev.map((g) => {
          const saved = savedGoals.find((sg: any) => sg.category === g.category);
          return saved ? { ...g, enabled: saved.enabled, avoid: saved.avoid, monthlyLimit: saved.monthly_limit?.toString() ?? "" } : g;
        }));
      }
      setSavingsGoals(savingsRes.data ?? []);
      const notesMap: Record<string, string> = {};
      const tagsMap: Record<string, string> = {};
      (notesRes.data ?? []).forEach((n: any) => {
        notesMap[n.transaction_id] = n.note;
        if (n.tag) tagsMap[n.transaction_id] = n.tag;
      });
      setNotes(notesMap);
      setNoteTags(tagsMap);
    } finally {
      setProfileLoading(false);
    }
  };

  // Trigger review after profile loads
  useEffect(() => {
    if (!profileLoading && user) runReview();
  }, [profileLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = async (uid: string, data: IncomeSetup) => {
    await supabase.from("user_profiles").upsert({
      id: uid,
      monthly_income: parseFloat(data.monthlyIncome) || null,
      rent: parseFloat(data.rent) || null,
      utilities: parseFloat(data.utilities) || null,
      other_fixed: parseFloat(data.otherFixed) || null,
      monthly_savings: parseFloat(data.monthlySavings) || null,
      updated_at: new Date().toISOString(),
    });
  };

  const saveGoals = async (uid: string, currentGoals: GoalRow[]) => {
    await supabase.from("spending_goals").upsert(
      currentGoals.map((g) => ({ user_id: uid, category: g.category, monthly_limit: g.monthlyLimit ? parseFloat(g.monthlyLimit) : null, avoid: g.avoid, enabled: g.enabled })),
      { onConflict: "user_id,category" }
    );
  };

  const handleNoteChange = async (transactionId: string, note: string, tag: string) => {
    if (!user) return;
    setNotes((prev) => ({ ...prev, [transactionId]: note }));
    setNoteTags((prev) => ({ ...prev, [transactionId]: tag }));
    await supabase.from("transaction_notes").upsert(
      { user_id: user.id, transaction_id: transactionId, note, tag: tag || null, updated_at: new Date().toISOString() },
      { onConflict: "user_id,transaction_id" }
    );
  };

  // Debounced income save
  useEffect(() => {
    if (!user) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { saveProfile(user.id, income); }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [income, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Review API ──────────────────────────────────────────────────────────────

  const runReview = async (overrideYear?: number, overrideMonth?: number) => {
    setLoading(true);
    setError(null);
    const yr = overrideYear ?? selectedYear;
    const mo = overrideMonth ?? selectedMonth;
    const budgets = goals.filter((g) => g.enabled && !g.avoid && g.monthlyLimit !== "").map((g) => ({ category: g.category, monthly_limit: parseFloat(g.monthlyLimit) }));
    const avoid_categories = goals.filter((g) => g.avoid).map((g) => g.category);
    try {
      const resp = await apiFetch("/api/spending_review", {
        method: "POST",
        body: JSON.stringify({ budgets, avoid_categories, year: yr, month: mo, user_id: user?.id ?? "" }),
      });
      if (!resp.ok) throw new Error(`Request failed: ${resp.status}`);
      const data = await resp.json();
      setResult(data);
      if (user) saveGoals(user.id, goals);
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

  const handleSignOut = () => supabase.auth.signOut();

  // ── Loading gate ────────────────────────────────────────────────────────────

  if (profileLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "2rem" }}>
        <div style={{ width: "4rem", height: "4rem", borderRadius: "50%", border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "#6366f1", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontSize: "1.5rem", color: "#334155", margin: 0 }}>Loading your profile…</p>
      </div>
    );
  }

  // ── Layout ──────────────────────────────────────────────────────────────────

  const mainContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <Dashboard
            result={result}
            income={income}
            goals={goals}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            loading={loading}
            error={error}
            monthOptions={monthOptions}
            onMonthChange={handleMonthChange}
            onSetupBudgets={() => setActiveTab("budgets")}
            onReconnect={handleReconnect}
          />
        );
      case "transactions":
        return (
          <Transactions
            transactions={result?.all_transactions ?? []}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            loading={loading}
            monthOptions={monthOptions}
            onMonthChange={handleMonthChange}
            notes={notes}
            noteTags={noteTags}
            onNoteChange={handleNoteChange}
          />
        );
      case "budgets":
        return (
          <Budgets
            goals={goals}
            discretionary={discretionary}
            allocated={allocated}
            loading={loading}
            error={error}
            onUpdateGoals={(g) => setGoals(g)}
            onRunReview={() => { runReview(); setActiveTab("dashboard"); }}
          />
        );
      case "goals":
        return (
          <Goals
            goalsData={savingsGoals}
            user={user}
            onUpdate={setSavingsGoals}
          />
        );
      case "account":
        return (
          <Account
            income={income}
            user={user}
            onUpdateIncome={(inc) => setIncome(inc)}
            onSave={() => { if (user) saveProfile(user.id, income); }}
            onSignOut={handleSignOut}
          />
        );
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        activeTab={activeTab}
        onTab={setActiveTab}
        userEmail={user?.email}
        onSignOut={handleSignOut}
      />
      <main style={{
        marginLeft: "220px",
        flex: 1,
        padding: "3.6rem 4rem 6rem",
        minHeight: "100vh",
      }}>
        {mainContent()}
      </main>
    </div>
  );
};

SpendingReview.displayName = "SpendingReview";
export default SpendingReview;
