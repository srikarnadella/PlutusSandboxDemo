import React, { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  emoji: string;
  created_at: string;
}

interface GoalsProps {
  goalsData: SavingsGoal[];
  user: User | null;
  onUpdate: (goals: SavingsGoal[]) => void;
}

const EMOJIS = ["🎯", "🏠", "✈️", "🚗", "💍", "🎓", "💻", "🌴", "🏋️", "🐾", "💰", "🏖️"];

const fmtRound = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const daysUntil = (deadline: string) => {
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
};

const monthsUntil = (deadline: string) => {
  const d = new Date(deadline);
  const now = new Date();
  return Math.max(0, (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth());
};

const EMPTY_FORM = { name: "", target_amount: "", current_amount: "", deadline: "", emoji: "🎯" };

const Goals = ({ goalsData, user, onUpdate }: GoalsProps) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [addFundsId, setAddFundsId] = useState<string | null>(null);
  const [addFundsAmt, setAddFundsAmt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!user || !form.name || !form.target_amount) return;
    setSaving(true);
    const { data, error } = await supabase.from("savings_goals").insert({
      user_id: user.id,
      name: form.name,
      target_amount: parseFloat(form.target_amount),
      current_amount: parseFloat(form.current_amount) || 0,
      deadline: form.deadline || null,
      emoji: form.emoji,
    }).select().single();
    if (!error && data) onUpdate([...goalsData, data]);
    setForm(EMPTY_FORM);
    setShowForm(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await supabase.from("savings_goals").delete().eq("id", id).eq("user_id", user.id);
    onUpdate(goalsData.filter((g) => g.id !== id));
  };

  const handleAddFunds = async (goal: SavingsGoal) => {
    const amt = parseFloat(addFundsAmt);
    if (!user || isNaN(amt) || amt <= 0) return;
    const newAmt = Math.min(goal.current_amount + amt, goal.target_amount);
    const { error } = await supabase.from("savings_goals")
      .update({ current_amount: newAmt })
      .eq("id", goal.id).eq("user_id", user.id);
    if (!error) onUpdate(goalsData.map((g) => g.id === goal.id ? { ...g, current_amount: newAmt } : g));
    setAddFundsId(null);
    setAddFundsAmt("");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", height: "4.4rem", background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.9rem",
    padding: "0 1.4rem", fontSize: "1.5rem", color: "#f8fafc",
    outline: "none", fontFamily: "inherit",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3rem" }}>
        <div>
          <h2 style={{ margin: "0 0 0.4rem", fontSize: "3rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em" }}>Goals</h2>
          <p style={{ margin: 0, fontSize: "1.5rem", color: "#475569" }}>Track your savings milestones</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); }}
          style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", color: "#fff", fontWeight: 700, fontSize: "1.5rem", padding: "1rem 2.4rem", borderRadius: "1.1rem", border: "none", cursor: "pointer", boxShadow: "0 6px 24px rgba(99,102,241,0.3)" }}
        >
          + Add Goal
        </button>
      </div>

      {/* Add Goal form */}
      {showForm && (
        <div style={{ marginBottom: "3rem", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "1.6rem", padding: "2.8rem 3.2rem" }}>
          <h3 style={{ margin: "0 0 2.4rem", fontSize: "2rem", fontWeight: 800, color: "#f8fafc" }}>New Goal</h3>

          {/* Emoji picker */}
          <div style={{ marginBottom: "2rem" }}>
            <p style={{ margin: "0 0 0.8rem", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Icon</p>
            <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" as const }}>
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                  style={{ fontSize: "2.2rem", width: "4.4rem", height: "4.4rem", borderRadius: "0.9rem", border: `2px solid ${form.emoji === e ? "#6366f1" : "transparent"}`, background: form.emoji === e ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)", cursor: "pointer" }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "1.4rem", marginBottom: "2rem" }}>
            <div>
              <p style={{ margin: "0 0 0.6rem", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Goal name</p>
              <input style={inputStyle} placeholder="e.g. Emergency Fund" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <p style={{ margin: "0 0 0.6rem", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Target</p>
              <input style={inputStyle} type="number" min="0" placeholder="$5,000" value={form.target_amount} onChange={(e) => setForm((f) => ({ ...f, target_amount: e.target.value }))} />
            </div>
            <div>
              <p style={{ margin: "0 0 0.6rem", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Saved so far</p>
              <input style={inputStyle} type="number" min="0" placeholder="$0" value={form.current_amount} onChange={(e) => setForm((f) => ({ ...f, current_amount: e.target.value }))} />
            </div>
            <div>
              <p style={{ margin: "0 0 0.6rem", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Deadline</p>
              <input style={{ ...inputStyle, colorScheme: "dark" as any }} type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: "flex", gap: "1.2rem" }}>
            <button onClick={handleCreate} disabled={saving || !form.name || !form.target_amount}
              style={{ background: saving || !form.name || !form.target_amount ? "rgba(255,255,255,0.07)" : "#4f46e5", color: saving || !form.name || !form.target_amount ? "#334155" : "#fff", fontWeight: 700, fontSize: "1.5rem", padding: "1rem 2.8rem", borderRadius: "1rem", border: "none", cursor: "pointer" }}>
              {saving ? "Saving…" : "Create Goal"}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#475569", fontWeight: 600, fontSize: "1.5rem", padding: "1rem 2rem", borderRadius: "1rem", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {goalsData.length === 0 && !showForm && (
        <div style={{ borderRadius: "1.6rem", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)", padding: "6rem 3rem", textAlign: "center" as const }}>
          <p style={{ fontSize: "3.6rem", margin: "0 0 1.2rem" }}>🎯</p>
          <p style={{ margin: "0 0 0.6rem", fontSize: "2rem", fontWeight: 700, color: "#f8fafc" }}>No goals yet</p>
          <p style={{ margin: "0 0 2.8rem", fontSize: "1.5rem", color: "#475569" }}>Set a savings target — vacation, emergency fund, new gear — and track your progress.</p>
          <button onClick={() => setShowForm(true)}
            style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", color: "#fff", fontWeight: 700, fontSize: "1.5rem", padding: "1.2rem 3.2rem", borderRadius: "1.1rem", border: "none", cursor: "pointer" }}>
            Create your first goal
          </button>
        </div>
      )}

      {/* Goal cards */}
      {goalsData.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(32rem, 1fr))", gap: "2rem" }}>
          {goalsData.map((goal) => {
            const pct = goal.target_amount > 0 ? Math.min((goal.current_amount / goal.target_amount) * 100, 100) : 0;
            const remaining = goal.target_amount - goal.current_amount;
            const complete = pct >= 100;
            const days = goal.deadline ? daysUntil(goal.deadline) : null;
            const mos = goal.deadline ? monthsUntil(goal.deadline) : null;
            const perMonth = mos && mos > 0 && remaining > 0 ? remaining / mos : null;

            return (
              <div key={goal.id} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${complete ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.07)"}`, borderRadius: "1.6rem", padding: "2.4rem 2.8rem" }}>
                {/* Card header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.6rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
                    <span style={{ fontSize: "2.8rem" }}>{goal.emoji}</span>
                    <div>
                      <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.01em" }}>{goal.name}</p>
                      {goal.deadline && (
                        <p style={{ margin: 0, fontSize: "1.2rem", color: days === 0 ? "#f87171" : "#334155" }}>
                          {days === 0 ? "Due today" : `${days} day${days !== 1 ? "s" : ""} left`}
                        </p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(goal.id)}
                    style={{ background: "none", border: "none", color: "#334155", fontSize: "1.6rem", cursor: "pointer", padding: "0.2rem 0.6rem", borderRadius: "0.4rem" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#334155"; }}>
                    ×
                  </button>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: "1.2rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                    <span style={{ fontSize: "2.6rem", fontWeight: 900, color: complete ? "#34d399" : "#f8fafc", letterSpacing: "-0.02em" }}>
                      {fmtRound(goal.current_amount)}
                    </span>
                    <span style={{ fontSize: "1.4rem", color: "#334155", alignSelf: "flex-end", paddingBottom: "0.4rem" }}>
                      of {fmtRound(goal.target_amount)}
                    </span>
                  </div>
                  <div style={{ width: "100%", background: "rgba(255,255,255,0.08)", borderRadius: "9999px", height: "0.7rem" }}>
                    <div style={{ width: `${pct}%`, background: complete ? "#34d399" : "#6366f1", borderRadius: "9999px", height: "0.7rem", transition: "width 0.4s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
                    <span style={{ fontSize: "1.2rem", color: complete ? "#34d399" : "#475569", fontWeight: 600 }}>
                      {complete ? "✓ Complete!" : `${Math.round(pct)}% there`}
                    </span>
                    {!complete && <span style={{ fontSize: "1.2rem", color: "#334155" }}>{fmtRound(remaining)} to go</span>}
                  </div>
                </div>

                {/* Monthly needed */}
                {perMonth !== null && !complete && (
                  <div style={{ marginBottom: "1.6rem", background: "rgba(99,102,241,0.08)", borderRadius: "0.8rem", padding: "0.8rem 1.2rem" }}>
                    <span style={{ fontSize: "1.3rem", color: "#818cf8" }}>
                      Save {fmtRound(perMonth)}/mo to hit your deadline
                    </span>
                  </div>
                )}

                {/* Add funds */}
                {!complete && (
                  addFundsId === goal.id ? (
                    <div style={{ display: "flex", gap: "0.8rem" }}>
                      <input
                        type="number" min="0" placeholder="Amount"
                        value={addFundsAmt}
                        onChange={(e) => setAddFundsAmt(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddFunds(goal); if (e.key === "Escape") { setAddFundsId(null); setAddFundsAmt(""); } }}
                        autoFocus
                        style={{ flex: 1, height: "4rem", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(99,102,241,0.4)", borderRadius: "0.8rem", padding: "0 1.2rem", fontSize: "1.5rem", color: "#f8fafc", outline: "none", fontFamily: "inherit" }}
                      />
                      <button onClick={() => handleAddFunds(goal)}
                        style={{ height: "4rem", padding: "0 1.6rem", background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", color: "#fff", fontWeight: 700, fontSize: "1.4rem", borderRadius: "0.8rem", border: "none", cursor: "pointer" }}>
                        Add
                      </button>
                      <button onClick={() => { setAddFundsId(null); setAddFundsAmt(""); }}
                        style={{ height: "4rem", padding: "0 1.2rem", background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#475569", fontSize: "1.4rem", borderRadius: "0.8rem", cursor: "pointer" }}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => { setAddFundsId(goal.id); setAddFundsAmt(""); }}
                      style={{ width: "100%", height: "4rem", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "0.9rem", color: "#818cf8", fontWeight: 700, fontSize: "1.4rem", cursor: "pointer", transition: "all 0.15s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.18)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,102,241,0.1)"; }}>
                      + Add Funds
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Goals;
