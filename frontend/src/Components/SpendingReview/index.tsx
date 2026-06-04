import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { apiFetch } from "../../lib/apiFetch";
import type { User } from "@supabase/supabase-js";
import Context from "../../Context";
import Dashboard from "./Dashboard";
import Transactions from "./Transactions";
import Budgets from "./Budgets";
import Account from "./Account";
import Goals, { type SavingsGoal } from "./Goals";
import { useToast } from "../Toast";
import type { ReviewResult } from "./shared";

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

const NavIcons: Record<Tab, React.FC<{ size?: number; color?: string }>> = {
  dashboard: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  transactions: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  budgets: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10" />
      <path d="M12 2a10 10 0 0 1 10 10h-10z" />
    </svg>
  ),
  goals: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  account: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
};

const NAV: { id: Tab; label: string }[] = [
  { id: "dashboard",    label: "Overview" },
  { id: "transactions", label: "Transactions" },
  { id: "budgets",      label: "Budgets" },
  { id: "goals",        label: "Goals" },
  { id: "account",      label: "Account" },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

const Sidebar = ({
  activeTab, onTab, userEmail, onSignOut, onLogoClick,
}: { activeTab: Tab; onTab: (t: Tab) => void; userEmail?: string; onSignOut: () => void; onLogoClick: () => void }) => (
  <div style={{
    width: "220px", position: "fixed", top: 0, left: 0, bottom: 0,
    background: "rgba(7,11,20,0.92)",
    backdropFilter: "blur(24px)",
    borderRight: "1px solid rgba(255,255,255,0.07)",
    display: "flex", flexDirection: "column",
    padding: "2.4rem 1rem",
    zIndex: 100,
  }}>
    {/* Logo */}
    <div style={{ marginBottom: "3rem", paddingLeft: "1.4rem" }}>
      <button onClick={onLogoClick} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
        <span style={{ fontSize: "1.85rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.04em" }}>
          Plu<span style={{ background: "linear-gradient(135deg, #34d399, #059669)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>tus</span>
        </span>
      </button>
      <div style={{ height: "1px", background: "linear-gradient(90deg, rgba(5,150,105,0.4), transparent)", marginTop: "1.6rem", marginLeft: "-1.4rem", marginRight: "-1rem" }} />
    </div>

    {/* Nav items */}
    <nav style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flex: 1 }}>
      {NAV.map(({ id, label }) => {
        const active = activeTab === id;
        const Icon = NavIcons[id];
        return (
          <button
            key={id}
            onClick={() => onTab(id)}
            style={{
              display: "flex", alignItems: "center", gap: "1rem",
              padding: "0.85rem 1.4rem",
              borderRadius: "0.9rem",
              border: "none",
              background: active ? "rgba(5,150,105,0.12)" : "transparent",
              color: active ? "#a7f3d0" : "#64748b",
              fontWeight: active ? 600 : 400,
              fontSize: "1.4rem",
              cursor: "pointer",
              textAlign: "left" as const,
              transition: "all 0.15s ease",
              width: "100%",
              letterSpacing: "-0.01em",
              position: "relative" as const,
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
              }
            }}
          >
            {active && (
              <div style={{
                position: "absolute", left: 0, top: "20%", bottom: "20%",
                width: "3px", borderRadius: "0 3px 3px 0",
                background: "linear-gradient(180deg, #34d399, #059669)",
              }} />
            )}
            <Icon size={17} color={active ? "#6ee7b7" : "#64748b"} />
            {label}
          </button>
        );
      })}
    </nav>

    {/* User footer */}
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1.4rem", paddingLeft: "0.4rem", paddingRight: "0.4rem" }}>
      {userEmail && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", marginBottom: "1rem", padding: "0 0.6rem" }}>
          <div style={{
            width: "2.8rem", height: "2.8rem", borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, #059669, #047857)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.1rem", fontWeight: 800, color: "#fff",
          }}>
            {userEmail[0].toUpperCase()}
          </div>
          <p style={{ margin: 0, fontSize: "1.2rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, flex: 1 }}>
            {userEmail}
          </p>
        </div>
      )}
      <button
        onClick={onSignOut}
        style={{
          width: "100%", padding: "0.8rem 1.4rem", borderRadius: "0.8rem",
          border: "1px solid rgba(255,255,255,0.07)",
          background: "transparent",
          color: "#64748b", fontSize: "1.35rem", fontWeight: 500,
          cursor: "pointer", textAlign: "left" as const, transition: "all 0.15s",
          letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: "0.8rem",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.25)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.06)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Sign out
      </button>
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────

const SpendingReview = () => {
  const _now = new Date();
  const { dispatch } = useContext(Context);
  const navigate = useNavigate();
  const { showToast } = useToast();

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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
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
    try {
      const { error: saveErr } = await supabase.from("transaction_notes").upsert(
        { user_id: user.id, transaction_id: transactionId, note, tag: tag || null, updated_at: new Date().toISOString() },
        { onConflict: "user_id,transaction_id" }
      );
      if (saveErr) showToast("Failed to save note", "error");
    } catch {
      showToast("Failed to save note", "error");
    }
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
      if (!resp.ok) {
        let errorMsg = `Request failed: ${resp.status}`;
        try {
          const errData = await resp.json();
          const code = errData?.error?.error_code ?? errData?.error_code;
          errorMsg = code ?? errData?.error?.error_message ?? errData?.message ?? errorMsg;
        } catch { /* ignore parse error */ }
        throw new Error(errorMsg);
      }
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

  const handleRefresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    try {
      await apiFetch("/api/refresh_transactions", { method: "POST" });
      await runReview();
      showToast("Transactions refreshed from your bank", "success");
    } catch {
      showToast("Refresh failed — please try again", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = () => supabase.auth.signOut();

  // ── Loading gate ────────────────────────────────────────────────────────────

  if (profileLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "2rem" }}>
        <div style={{ width: "4rem", height: "4rem", borderRadius: "50%", border: "3px solid rgba(5,150,105,0.2)", borderTopColor: "#059669", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontSize: "1.5rem", color: "#64748b", margin: 0 }}>Loading your profile…</p>
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
            refreshing={refreshing}
            error={error}
            monthOptions={monthOptions}
            onMonthChange={handleMonthChange}
            onSetupBudgets={() => setActiveTab("budgets")}
            onReconnect={handleReconnect}
            onRefresh={handleRefresh}
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
    <div style={{ display: "flex", minHeight: "100vh", position: "relative" }}>
      {/* Ambient background orbs */}
      <div style={{ position: "fixed", top: "10%", right: "20%", width: "40rem", height: "40rem", borderRadius: "50%", background: "radial-gradient(circle, rgba(5,150,105,0.05) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "5%", right: "5%", width: "30rem", height: "30rem", borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,153,0.04) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <Sidebar
        activeTab={activeTab}
        onTab={setActiveTab}
        userEmail={user?.email}
        onSignOut={handleSignOut}
        onLogoClick={() => navigate("/dashboard")}
      />
      <main style={{
        marginLeft: "220px",
        flex: 1,
        padding: "3.6rem 4rem 6rem",
        minHeight: "100vh",
        position: "relative",
        zIndex: 1,
      }}>
        {mainContent()}
      </main>
    </div>
  );
};

SpendingReview.displayName = "SpendingReview";
export default SpendingReview;
