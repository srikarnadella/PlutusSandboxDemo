import React from "react";

const CATEGORY_COLORS: Record<string, string> = {
  "Food and Drink": "#fb923c", Shops: "#a78bfa", Travel: "#38bdf8",
  Recreation: "#34d399", Healthcare: "#f87171", Service: "#fbbf24",
  Transfer: "#818cf8", Payment: "#e879f9",
};

const PRESETS: Record<string, Record<string, number>> = {
  Tight:    { "Food and Drink": 0.15, Shops: 0.08, Travel: 0.05, Recreation: 0.03, Healthcare: 0.08, Service: 0.03, Transfer: 0.05, Payment: 0.05 },
  Standard: { "Food and Drink": 0.25, Shops: 0.12, Travel: 0.10, Recreation: 0.06, Healthcare: 0.10, Service: 0.05, Transfer: 0.08, Payment: 0.08 },
  Generous: { "Food and Drink": 0.35, Shops: 0.20, Travel: 0.15, Recreation: 0.10, Healthcare: 0.15, Service: 0.08, Transfer: 0.10, Payment: 0.10 },
};
const PRESET_ABS: Record<string, Record<string, number>> = {
  Tight:    { "Food and Drink": 200, Shops: 100, Travel: 80,  Recreation: 40,  Healthcare: 80,  Service: 40,  Transfer: 100, Payment: 100 },
  Standard: { "Food and Drink": 350, Shops: 175, Travel: 150, Recreation: 75,  Healthcare: 150, Service: 75,  Transfer: 150, Payment: 150 },
  Generous: { "Food and Drink": 500, Shops: 300, Travel: 250, Recreation: 125, Healthcare: 200, Service: 100, Transfer: 200, Payment: 200 },
};

export interface GoalRow { category: string; enabled: boolean; monthlyLimit: string; avoid: boolean; }

interface BudgetsProps {
  goals: GoalRow[];
  discretionary: number;
  allocated: number;
  loading: boolean;
  error: string | null;
  onUpdateGoals: (goals: GoalRow[]) => void;
  onRunReview: () => void;
}

const fmtRound = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const Budgets = ({ goals, discretionary, allocated, loading, error, onUpdateGoals, onRunReview }: BudgetsProps) => {
  const toggle = (i: number) =>
    onUpdateGoals(goals.map((g, idx) => idx === i ? { ...g, enabled: !g.enabled, avoid: false } : g));

  const toggleAvoid = (i: number) =>
    onUpdateGoals(goals.map((g, idx) =>
      idx === i ? { ...g, avoid: !g.avoid, enabled: !g.avoid, monthlyLimit: "" } : g));

  const setLimit = (i: number, val: string) =>
    onUpdateGoals(goals.map((g, idx) => idx === i ? { ...g, monthlyLimit: val } : g));

  const applyPreset = (name: string) => {
    const fracs = PRESETS[name];
    const abs = PRESET_ABS[name];
    onUpdateGoals(goals.map((g) => {
      const limit = discretionary > 0
        ? Math.round((discretionary * (fracs[g.category] || 0)) / 5) * 5
        : abs[g.category] || 0;
      return { ...g, enabled: true, avoid: false, monthlyLimit: limit > 0 ? String(limit) : "" };
    }));
  };

  const hasAny = goals.some((g) => g.enabled || g.avoid);
  const pct = discretionary > 0 ? Math.min((allocated / discretionary) * 100, 100) : 0;
  const overBudget = allocated > discretionary && discretionary > 0;

  return (
    <div style={{ maxWidth: "860px" }}>
      <div style={{ marginBottom: "3.2rem" }}>
        <h2 style={{ margin: "0 0 0.4rem", fontSize: "3rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em" }}>Budgets</h2>
        <p style={{ margin: 0, fontSize: "1.5rem", color: "#475569" }}>Set monthly limits per category. We'll flag anything over budget.</p>
      </div>

      {/* Discretionary overview */}
      {discretionary > 0 && (
        <div style={{ marginBottom: "2.4rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "1.6rem", padding: "2.4rem 3.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.4rem" }}>
            <div>
              <p style={{ margin: "0 0 0.3rem", fontSize: "1.2rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Discretionary Budget</p>
              <p style={{ margin: 0, fontSize: "3.6rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em", lineHeight: 1 }}>
                {fmtRound(discretionary)}<span style={{ fontSize: "1.5rem", fontWeight: 500, color: "#64748b", marginLeft: "0.6rem" }}>/mo</span>
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "0 0 0.3rem", fontSize: "1.2rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>{overBudget ? "Over by" : "Unallocated"}</p>
              <p style={{ margin: 0, fontSize: "2.4rem", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, color: overBudget ? "#f87171" : "#818cf8" }}>
                {fmtRound(Math.abs(discretionary - allocated))}
              </p>
            </div>
          </div>
          <div style={{ width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: "9999px", height: "0.7rem" }}>
            <div style={{ width: `${pct}%`, background: overBudget ? "#f87171" : "#059669", borderRadius: "9999px", height: "0.7rem", transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {/* Presets */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.2rem", marginBottom: "2rem" }}>
        <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Quick-fill:</span>
        {["Tight", "Standard", "Generous"].map((name) => (
          <button key={name} onClick={() => applyPreset(name)} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "9999px", padding: "0.7rem 2rem", fontSize: "1.4rem", fontWeight: 600,
            color: "#64748b", cursor: "pointer", transition: "all 0.15s",
          }}
            onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "rgba(5,150,105,0.5)"; b.style.color = "#6ee7b7"; b.style.background = "rgba(5,150,105,0.08)"; }}
            onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "rgba(255,255,255,0.1)"; b.style.color = "#64748b"; b.style.background = "rgba(255,255,255,0.05)"; }}
          >{name}</button>
        ))}
      </div>

      {/* Goals table */}
      <div style={{ borderRadius: "1.6rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "2.4rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <th style={{ padding: "1.4rem 2.4rem", textAlign: "left", fontSize: "1.2rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Category</th>
              <th style={{ padding: "1.4rem 2.4rem", textAlign: "left", fontSize: "1.2rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Monthly Limit</th>
              <th style={{ padding: "1.4rem 2.4rem", textAlign: "center", fontSize: "1.2rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Avoid</th>
            </tr>
          </thead>
          <tbody>
            {goals.map((g, i) => (
              <tr key={g.category} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: (g.enabled || g.avoid) ? "rgba(5,150,105,0.04)" : undefined }}>
                <td style={{ padding: "1.6rem 2.4rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "1.4rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={g.enabled} onChange={() => toggle(i)}
                      style={{ width: "1.8rem", height: "1.8rem", accentColor: "#059669", cursor: "pointer", flexShrink: 0 }} />
                    <span style={{ display: "flex", alignItems: "center", gap: "0.9rem", fontSize: "1.7rem", fontWeight: g.enabled || g.avoid ? 700 : 400, color: g.enabled || g.avoid ? "#f8fafc" : "#64748b" }}>
                      <span style={{ width: "0.7rem", height: "0.7rem", borderRadius: "50%", background: CATEGORY_COLORS[g.category] ?? "#64748b", flexShrink: 0, display: "inline-block", opacity: g.enabled || g.avoid ? 1 : 0.45 }} />
                      {g.category}
                    </span>
                  </label>
                </td>
                <td style={{ padding: "1.6rem 2.4rem" }}>
                  <div style={{ position: "relative", width: "16rem" }}>
                    <span style={{ position: "absolute", left: "1.2rem", top: "50%", transform: "translateY(-50%)", fontSize: "1.6rem", color: "#64748b", pointerEvents: "none", fontWeight: 600 }}>$</span>
                    <input type="number" min="0" placeholder="e.g. 200" value={g.monthlyLimit}
                      disabled={g.avoid || !g.enabled} onChange={(e) => setLimit(i, e.target.value)}
                      style={{ width: "100%", height: "4.8rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "0.9rem", paddingLeft: "3.6rem", paddingRight: "1rem", fontSize: "1.7rem", fontWeight: 600, color: "#f8fafc", outline: "none", opacity: (g.avoid || !g.enabled) ? 0.25 : 1, fontFamily: "inherit" }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(5,150,105,0.6)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }} />
                  </div>
                </td>
                <td style={{ padding: "1.6rem 2.4rem", textAlign: "center" }}>
                  <input type="checkbox" checked={g.avoid} onChange={() => toggleAvoid(i)}
                    style={{ width: "1.8rem", height: "1.8rem", accentColor: "#f87171", cursor: "pointer" }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <div style={{ marginBottom: "1.6rem", borderRadius: "1rem", padding: "1.4rem 2rem", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", fontSize: "1.5rem", color: "#f87171" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
        <button
          onClick={onRunReview}
          disabled={loading || !hasAny}
          style={{
            background: loading || !hasAny ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg, #047857 0%, #059669 100%)",
            color: loading || !hasAny ? "#64748b" : "#fff",
            fontWeight: 700, fontSize: "1.6rem", padding: "1.3rem 3.6rem",
            borderRadius: "1.1rem", border: "none",
            cursor: loading || !hasAny ? "not-allowed" : "pointer",
            boxShadow: loading || !hasAny ? undefined : "0 8px 28px rgba(5,150,105,0.4)",
            transition: "opacity 0.15s",
          }}
        >
          {loading ? "Analyzing…" : "Save & Analyze →"}
        </button>
        {!hasAny && <span style={{ fontSize: "1.4rem", color: "#64748b" }}>Enable at least one category to continue.</span>}
      </div>
    </div>
  );
};

export default Budgets;
