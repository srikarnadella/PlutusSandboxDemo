import React, { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";

interface IncomeSetup {
  monthlyIncome: string;
  rent: string;
  utilities: string;
  otherFixed: string;
  monthlySavings: string;
}

interface AccountProps {
  income: IncomeSetup;
  user: User | null;
  onUpdateIncome: (income: IncomeSetup) => void;
  onSave: () => void;
  onSignOut: () => void;
}

const Field = ({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.4rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
    <span style={{ fontSize: "1.5rem", color: "#94a3b8", fontWeight: 500 }}>{label}</span>
    <div style={{ position: "relative", width: "18rem" }}>
      <span style={{ position: "absolute", left: "1.2rem", top: "50%", transform: "translateY(-50%)", fontSize: "1.6rem", color: "#475569", pointerEvents: "none" }}>$</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: "4.8rem",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: "0.9rem",
          paddingLeft: "3.2rem",
          paddingRight: "1.2rem",
          fontSize: "1.6rem",
          fontWeight: 600,
          color: "#f8fafc",
          outline: "none",
          fontFamily: "inherit",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.6)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
      />
    </div>
  </div>
);

const Account = ({ income, user, onUpdateIncome, onSave, onSignOut }: AccountProps) => {
  const [local, setLocal] = useState(income);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setLocal(income); }, [income]);

  const update = (key: keyof IncomeSetup, val: string) => {
    setLocal((p) => ({ ...p, [key]: val }));
    setSaved(false);
  };

  const handleSave = () => {
    onUpdateIncome(local);
    onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const initial = user?.email?.[0]?.toUpperCase() ?? "?";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  const card = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "1.6rem",
      padding: "2.8rem 3.2rem",
      marginBottom: "2rem",
      ...style,
    }}>{children}</div>
  );

  const sectionTitle = (text: string) => (
    <h3 style={{ margin: "0 0 0.4rem", fontSize: "1.8rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.01em" }}>{text}</h3>
  );

  return (
    <div style={{ maxWidth: "680px" }}>
      <div style={{ marginBottom: "3.2rem" }}>
        <h2 style={{ margin: "0 0 0.4rem", fontSize: "3rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em" }}>Account</h2>
        <p style={{ margin: 0, fontSize: "1.5rem", color: "#475569" }}>Manage your profile and financial settings.</p>
      </div>

      {/* Profile */}
      {card(
        <>
          {sectionTitle("Profile")}
          <p style={{ margin: "0 0 2rem", fontSize: "1.3rem", color: "#334155" }}>Your identity and membership</p>
          <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
            <div style={{
              width: "5.6rem", height: "5.6rem", borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #a855f7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "2.2rem", fontWeight: 800, color: "#fff",
              flexShrink: 0,
            }}>{initial}</div>
            <div>
              <p style={{ margin: "0 0 0.3rem", fontSize: "1.7rem", fontWeight: 700, color: "#f8fafc" }}>{user?.email}</p>
              {memberSince && (
                <p style={{ margin: 0, fontSize: "1.3rem", color: "#334155" }}>Member since {memberSince}</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Income */}
      {card(
        <>
          {sectionTitle("Monthly Finances")}
          <p style={{ margin: "0 0 0.4rem", fontSize: "1.3rem", color: "#334155" }}>Used to calculate your discretionary budget</p>
          <Field label="Take-Home Income" value={local.monthlyIncome} onChange={(v) => update("monthlyIncome", v)} />
          <Field label="Rent / Mortgage" value={local.rent} onChange={(v) => update("rent", v)} />
          <Field label="Utilities" value={local.utilities} onChange={(v) => update("utilities", v)} />
          <Field label="Other Fixed Costs" value={local.otherFixed} onChange={(v) => update("otherFixed", v)} />
          <Field label="Monthly Savings Goal" value={local.monthlySavings} onChange={(v) => update("monthlySavings", v)} />

          {/* Discretionary preview */}
          {parseFloat(local.monthlyIncome) > 0 && (() => {
            const disc = parseFloat(local.monthlyIncome)
              - (parseFloat(local.rent) || 0)
              - (parseFloat(local.utilities) || 0)
              - (parseFloat(local.otherFixed) || 0)
              - (parseFloat(local.monthlySavings) || 0);
            return (
              <div style={{ marginTop: "2rem", padding: "1.6rem 2rem", borderRadius: "1rem", background: disc >= 0 ? "rgba(99,102,241,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${disc >= 0 ? "rgba(99,102,241,0.2)" : "rgba(248,113,113,0.2)"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "1.4rem", color: "#475569", fontWeight: 600 }}>Discretionary budget</span>
                <span style={{ fontSize: "2rem", fontWeight: 900, color: disc >= 0 ? "#818cf8" : "#f87171", letterSpacing: "-0.02em" }}>
                  ${Math.max(disc, 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}/mo
                </span>
              </div>
            );
          })()}

          <div style={{ marginTop: "2.4rem" }}>
            <button
              onClick={handleSave}
              style={{
                background: saved ? "rgba(52,211,153,0.12)" : "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                border: saved ? "1px solid rgba(52,211,153,0.3)" : "none",
                color: saved ? "#34d399" : "#fff",
                fontWeight: 700,
                fontSize: "1.5rem",
                padding: "1.1rem 3rem",
                borderRadius: "0.9rem",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {saved ? "✓ Saved" : "Save Changes"}
            </button>
          </div>
        </>
      )}

      {/* Danger zone */}
      {card(
        <>
          {sectionTitle("Sign Out")}
          <p style={{ margin: "0 0 2rem", fontSize: "1.4rem", color: "#475569" }}>You'll be redirected to the login screen.</p>
          <button
            onClick={onSignOut}
            style={{
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.2)",
              borderRadius: "0.9rem",
              padding: "1rem 2.4rem",
              fontSize: "1.5rem",
              fontWeight: 600,
              color: "#f87171",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.14)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.08)"; }}
          >
            Sign out
          </button>
        </>
      )}
    </div>
  );
};

export default Account;
