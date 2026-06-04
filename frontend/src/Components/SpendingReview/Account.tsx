import React, { useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { usePlaidLink } from "react-plaid-link";
import { supabase } from "../../lib/supabase";
import { apiFetch } from "../../lib/apiFetch";
import Context from "../../Context";

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

interface PlaidItem {
  id: string;
  item_id: string;
  institution_name: string | null;
  created_at: string;
}

const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.4rem 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
    <span style={{ fontSize: "1.5rem", color: "#94a3b8", fontWeight: 500 }}>{label}</span>
    <div style={{ position: "relative", width: "18rem" }}>
      <span style={{ position: "absolute", left: "1.2rem", top: "50%", transform: "translateY(-50%)", fontSize: "1.6rem", color: "#475569", pointerEvents: "none" }}>$</span>
      <input
        type="number" min="0" value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", height: "4.8rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "0.9rem", paddingLeft: "3.2rem", paddingRight: "1.2rem", fontSize: "1.6rem", fontWeight: 600, color: "#f8fafc", outline: "none", fontFamily: "inherit" }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(5,150,105,0.6)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
      />
    </div>
  </div>
);

// ── Add Bank Button (self-contained Plaid Link flow) ──────────────────────────

const AddBankButton = ({ onSuccess }: { onSuccess: (itemId: string, institutionName: string) => void }) => {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async (publicToken, metadata) => {
      const resp = await apiFetch("/api/set_access_token", {
        method: "POST",
        body: JSON.stringify({
          public_token: publicToken,
          institution_name: (metadata as any)?.institution?.name ?? "",
          institution_id: (metadata as any)?.institution?.institution_id ?? "",
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        onSuccess(data.item_id, (metadata as any)?.institution?.name ?? "Connected Bank");
      }
      setLinkToken(null);
    },
    onExit: () => setLinkToken(null),
  });

  // Open automatically once token is ready
  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  const handleClick = async () => {
    if (fetching) return;
    setFetching(true);
    try {
      const resp = await apiFetch("/api/create_link_token", { method: "POST" });
      if (resp.ok) {
        const data = await resp.json();
        setLinkToken(data.link_token);
      }
    } finally {
      setFetching(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={fetching}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.8rem",
        background: fetching ? "rgba(5,150,105,0.08)" : "rgba(5,150,105,0.12)",
        border: "1px solid rgba(5,150,105,0.25)",
        borderRadius: "0.9rem", padding: "1rem 2rem",
        fontSize: "1.4rem", fontWeight: 600, color: "#34d399",
        cursor: fetching ? "not-allowed" : "pointer",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => { if (!fetching) (e.currentTarget as HTMLButtonElement).style.background = "rgba(5,150,105,0.2)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = fetching ? "rgba(5,150,105,0.08)" : "rgba(5,150,105,0.12)"; }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      {fetching ? "Loading…" : "Add another bank"}
    </button>
  );
};

// ── Connected Banks section ───────────────────────────────────────────────────

const ConnectedBanks = ({ user, onLastRemoved }: { user: User | null; onLastRemoved: () => void }) => {
  const { dispatch } = React.useContext(Context);
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("plaid_items")
      .select("id, item_id, institution_name, created_at")
      .eq("user_id", user.id)
      .order("created_at")
      .then(({ data }) => setItems(data ?? []));
  }, [user]);

  const handleRemove = async (itemId: string) => {
    setRemoving(itemId);
    try {
      await apiFetch("/api/remove_item", { method: "POST", body: JSON.stringify({ item_id: itemId }) });
      const remaining = items.filter((i) => i.item_id !== itemId);
      setItems(remaining);
      if (remaining.length === 0) {
        dispatch({ type: "SET_STATE", state: { hasPlaidConnection: false, linkSuccess: false } });
        onLastRemoved();
      }
    } finally {
      setRemoving(null);
    }
  };

  const handleBankAdded = (itemId: string, institutionName: string) => {
    // Optimistically add to list; real data will load on next Supabase query
    setItems((prev) => [
      ...prev,
      { id: itemId, item_id: itemId, institution_name: institutionName, created_at: new Date().toISOString() },
    ]);
    dispatch({ type: "SET_STATE", state: { hasPlaidConnection: true } });
  };

  const INSTITUTION_COLORS = ["#059669", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899", "#38bdf8"];

  return (
    <div>
      {items.length === 0 ? (
        <p style={{ margin: "0 0 2rem", fontSize: "1.4rem", color: "#475569" }}>No banks connected yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
          {items.map((item, i) => {
            const name = item.institution_name ?? "Connected Bank";
            const color = INSTITUTION_COLORS[i % INSTITUTION_COLORS.length];
            const connectedDate = new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            const isRemoving = removing === item.item_id;
            return (
              <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.4rem 1.8rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "1.2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1.4rem" }}>
                  <div style={{ width: "3.6rem", height: "3.6rem", borderRadius: "50%", background: `${color}22`, border: `1px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "1.4rem", fontWeight: 800, color }}>{name[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#f8fafc" }}>{name}</p>
                    <p style={{ margin: 0, fontSize: "1.2rem", color: "#475569" }}>Connected {connectedDate}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(item.item_id)}
                  disabled={isRemoving}
                  style={{ background: "none", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "0.7rem", padding: "0.55rem 1.2rem", fontSize: "1.3rem", fontWeight: 500, color: "#f87171", cursor: isRemoving ? "not-allowed" : "pointer", opacity: isRemoving ? 0.5 : 1, transition: "all 0.15s", fontFamily: "inherit" }}
                  onMouseEnter={(e) => { if (!isRemoving) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.1)"; }}}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                >
                  {isRemoving ? "Removing…" : "Remove"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      <AddBankButton onSuccess={handleBankAdded} />
    </div>
  );
};

// ── Main Account component ────────────────────────────────────────────────────

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
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "1.6rem", padding: "2.8rem 3.2rem", marginBottom: "2rem", ...style }}>
      {children}
    </div>
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
          <p style={{ margin: "0 0 2rem", fontSize: "1.3rem", color: "#64748b" }}>Your identity and membership</p>
          <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
            <div style={{ width: "5.6rem", height: "5.6rem", borderRadius: "50%", background: "linear-gradient(135deg, #059669, #047857)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.2rem", fontWeight: 800, color: "#fff", flexShrink: 0 }}>
              {initial}
            </div>
            <div>
              <p style={{ margin: "0 0 0.3rem", fontSize: "1.7rem", fontWeight: 700, color: "#f8fafc" }}>{user?.email}</p>
              {memberSince && <p style={{ margin: 0, fontSize: "1.3rem", color: "#64748b" }}>Member since {memberSince}</p>}
            </div>
          </div>
        </>
      )}

      {/* Connected Banks */}
      {card(
        <>
          {sectionTitle("Connected Banks")}
          <p style={{ margin: "0 0 2rem", fontSize: "1.3rem", color: "#64748b" }}>Add multiple accounts for a complete financial picture</p>
          <ConnectedBanks user={user} onLastRemoved={onSignOut} />
        </>
      )}

      {/* Monthly Finances */}
      {card(
        <>
          {sectionTitle("Monthly Finances")}
          <p style={{ margin: "0 0 0.4rem", fontSize: "1.3rem", color: "#64748b" }}>Used to calculate your discretionary budget</p>
          <Field label="Take-Home Income"   value={local.monthlyIncome}  onChange={(v) => update("monthlyIncome", v)} />
          <Field label="Rent / Mortgage"    value={local.rent}           onChange={(v) => update("rent", v)} />
          <Field label="Utilities"          value={local.utilities}      onChange={(v) => update("utilities", v)} />
          <Field label="Other Fixed Costs"  value={local.otherFixed}     onChange={(v) => update("otherFixed", v)} />
          <Field label="Monthly Savings Goal" value={local.monthlySavings} onChange={(v) => update("monthlySavings", v)} />

          {parseFloat(local.monthlyIncome) > 0 && (() => {
            const disc = parseFloat(local.monthlyIncome)
              - (parseFloat(local.rent) || 0)
              - (parseFloat(local.utilities) || 0)
              - (parseFloat(local.otherFixed) || 0)
              - (parseFloat(local.monthlySavings) || 0);
            return (
              <div style={{ marginTop: "2rem", padding: "1.6rem 2rem", borderRadius: "1rem", background: disc >= 0 ? "rgba(5,150,105,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${disc >= 0 ? "rgba(5,150,105,0.2)" : "rgba(248,113,113,0.2)"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "1.4rem", color: "#475569", fontWeight: 600 }}>Discretionary budget</span>
                <span style={{ fontSize: "2rem", fontWeight: 900, color: disc >= 0 ? "#34d399" : "#f87171", letterSpacing: "-0.02em" }}>
                  ${Math.max(disc, 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}/mo
                </span>
              </div>
            );
          })()}

          <div style={{ marginTop: "2.4rem" }}>
            <button
              onClick={handleSave}
              style={{ background: saved ? "rgba(52,211,153,0.12)" : "linear-gradient(135deg, #047857 0%, #059669 100%)", border: saved ? "1px solid rgba(52,211,153,0.3)" : "none", color: saved ? "#34d399" : "#fff", fontWeight: 700, fontSize: "1.5rem", padding: "1.1rem 3rem", borderRadius: "0.9rem", cursor: "pointer", transition: "all 0.2s" }}
            >
              {saved ? "✓ Saved" : "Save Changes"}
            </button>
          </div>
        </>
      )}

      {/* Sign out */}
      {card(
        <>
          {sectionTitle("Sign Out")}
          <p style={{ margin: "0 0 2rem", fontSize: "1.4rem", color: "#475569" }}>You'll be redirected to the login screen.</p>
          <button
            onClick={onSignOut}
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "0.9rem", padding: "1rem 2.4rem", fontSize: "1.5rem", fontWeight: 600, color: "#f87171", cursor: "pointer", transition: "all 0.15s" }}
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
