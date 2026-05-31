import React, { useState, useMemo } from "react";

interface AllTransaction { name: string; amount: number; date: string; category: string; logo_url?: string; transaction_id?: string; }

interface TransactionsProps {
  transactions: AllTransaction[];
  selectedYear: number;
  selectedMonth: number;
  loading: boolean;
  monthOptions: { year: number; month: number; label: string }[];
  onMonthChange: (yr: number, mo: number) => void;
  notes: Record<string, string>;
  noteTags: Record<string, string>;
  onNoteChange: (transactionId: string, note: string, tag: string) => void;
}

const TAGS = ["", "Business", "Personal", "Split", "Reimbursable"];

const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CATEGORY_ICONS: Record<string, string> = {
  "Food and Drink": "🍕", Shops: "🛍️", Travel: "✈️", Recreation: "🎮",
  Healthcare: "🏥", Service: "⚙️", Transfer: "↔️", Payment: "💳",
};

const categoryColor = (cat: string) => {
  const map: Record<string, string> = {
    "Food and Drink": "rgba(251,146,60,0.12)", Shops: "rgba(167,139,250,0.12)",
    Travel: "rgba(56,189,248,0.12)", Recreation: "rgba(52,211,153,0.12)",
    Healthcare: "rgba(248,113,113,0.12)", Service: "rgba(251,191,36,0.12)",
  };
  return map[cat] ?? "rgba(255,255,255,0.06)";
};

const TAG_COLORS: Record<string, { color: string; bg: string }> = {
  Business:     { color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  Personal:     { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  Split:        { color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  Reimbursable: { color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
};

const AVATAR_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#f87171", "#38bdf8"];
const MerchantAvatar = ({ name, logoUrl }: { name: string; logoUrl?: string }) => {
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  if (logoUrl) {
    return <img src={logoUrl} alt={name} style={{ width: "3rem", height: "3rem", borderRadius: "50%", objectFit: "contain", background: "#fff", flexShrink: 0 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />;
  }
  return (
    <div style={{ width: "3rem", height: "3rem", borderRadius: "50%", background: `${color}22`, border: `1px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontSize: "1.3rem", fontWeight: 800, color, lineHeight: 1 }}>{name.charAt(0).toUpperCase()}</span>
    </div>
  );
};

const Transactions = ({ transactions, selectedYear, selectedMonth, loading, monthOptions, onMonthChange, notes, noteTags, onNoteChange }: TransactionsProps) => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortField, setSortField] = useState<"name" | "amount" | "date">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [draftTag, setDraftTag] = useState("");

  const categories = useMemo(() => {
    const s = new Set(transactions.map((t) => t.category).filter(Boolean));
    return ["All", ...Array.from(s).sort()];
  }, [transactions]);

  const filtered = useMemo(() => {
    let out = [...transactions];
    if (search) out = out.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
    if (categoryFilter !== "All") out = out.filter((t) => t.category === categoryFilter);
    out.sort((a, b) => {
      const cmp = sortField === "amount" ? a.amount - b.amount
        : sortField === "date" ? a.date.localeCompare(b.date)
        : a.name.localeCompare(b.name);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return out;
  }, [transactions, search, categoryFilter, sortField, sortDir]);

  const handleSort = (field: typeof sortField) => {
    if (field === sortField) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const totalFiltered = filtered.reduce((s, t) => s + t.amount, 0);

  const exportCSV = () => {
    const rows = [["Date", "Merchant", "Category", "Amount", "Note", "Tag"]];
    filtered.forEach((tx) => {
      const txId = tx.transaction_id ?? "";
      rows.push([
        tx.date,
        tx.name,
        tx.category || "Other",
        tx.amount.toFixed(2),
        notes[txId] ?? "",
        noteTags[txId] ?? "",
      ]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openNote = (tx: AllTransaction) => {
    const id = tx.transaction_id ?? tx.name + tx.date;
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setDraftNote(notes[id] ?? "");
    setDraftTag(noteTags[id] ?? "");
  };

  const commitNote = (tx: AllTransaction) => {
    const id = tx.transaction_id ?? tx.name + tx.date;
    if (id) onNoteChange(id, draftNote, draftTag);
  };

  const SortBtn = ({ field, label }: { field: typeof sortField; label: string }) => (
    <button onClick={() => handleSort(field)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, fontSize: "1.2rem", textTransform: "uppercase" as const, letterSpacing: "0.08em", color: sortField === field ? "#818cf8" : "#334155" }}>
      {label}{sortField === field && <span>{sortDir === "desc" ? " ▼" : " ▲"}</span>}
    </button>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3rem" }}>
        <div>
          <h2 style={{ margin: "0 0 0.4rem", fontSize: "3rem", fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em" }}>Transactions</h2>
          <p style={{ margin: 0, fontSize: "1.5rem", color: "#475569" }}>
            {loading ? "Loading…" : `${filtered.length} transaction${filtered.length !== 1 ? "s" : ""}${filtered.length !== transactions.length ? ` (filtered from ${transactions.length})` : ""}`}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
          {filtered.length > 0 && (
            <button onClick={exportCSV}
              style={{ height: "4rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.9rem", padding: "0 1.6rem", fontSize: "1.4rem", fontWeight: 600, color: "#64748b", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.6rem" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#a5b4fc"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(99,102,241,0.4)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
            >
              ↓ Export CSV
            </button>
          )}
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

      {/* Filters */}
      <div style={{ display: "flex", gap: "1.2rem", marginBottom: "2.4rem", flexWrap: "wrap" as const }}>
        <div style={{ position: "relative", flex: 1, minWidth: "20rem" }}>
          <span style={{ position: "absolute", left: "1.4rem", top: "50%", transform: "translateY(-50%)", fontSize: "1.5rem", color: "#334155", pointerEvents: "none" }}>🔍</span>
          <input type="text" placeholder="Search merchants…" value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", height: "4.4rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "0.9rem", paddingLeft: "4rem", paddingRight: "1.4rem", fontSize: "1.5rem", color: "#f8fafc", outline: "none", fontFamily: "inherit" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
          />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ height: "4.4rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "0.9rem", padding: "0 1.6rem", fontSize: "1.4rem", fontWeight: 600, color: "#94a3b8", cursor: "pointer", outline: "none", fontFamily: "inherit", minWidth: "14rem" }}>
          {categories.map((c) => <option key={c} value={c} style={{ background: "#1e293b" }}>{c === "All" ? "All Categories" : c}</option>)}
        </select>
        {(search || categoryFilter !== "All") && (
          <button onClick={() => { setSearch(""); setCategoryFilter("All"); }}
            style={{ height: "4.4rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "0.9rem", padding: "0 1.6rem", fontSize: "1.4rem", color: "#64748b", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ borderRadius: "1.4rem", padding: "5rem", textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: "2.8rem", margin: "0 0 1rem" }}>🔍</p>
          <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: 600, color: "#64748b" }}>
            {loading ? "Loading transactions…" : "No transactions match your filters"}
          </p>
        </div>
      ) : (
        <>
          <div style={{ borderRadius: "1.4rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <th style={{ padding: "1.4rem 2rem", textAlign: "left" }}><SortBtn field="date" label="Date" /></th>
                  <th style={{ padding: "1.4rem 2rem", textAlign: "left" }}><SortBtn field="name" label="Merchant" /></th>
                  <th style={{ padding: "1.4rem 2rem", textAlign: "left", fontSize: "1.2rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>Category</th>
                  <th style={{ padding: "1.4rem 2rem", textAlign: "right" }}><SortBtn field="amount" label="Amount" /></th>
                  <th style={{ padding: "1.4rem 2rem", width: "4rem" }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx, i) => {
                  const txId = tx.transaction_id ?? tx.name + tx.date;
                  const isExpanded = expandedId === txId;
                  const existingNote = notes[txId];
                  const existingTag = noteTags[txId];
                  const tagStyle = existingTag ? TAG_COLORS[existingTag] : null;

                  return (
                    <React.Fragment key={i}>
                      <tr
                        style={{ borderBottom: isExpanded ? "none" : "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s", cursor: "pointer" }}
                        onClick={() => openNote(tx)}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.025)"; }}
                        onMouseLeave={(e) => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                      >
                        <td style={{ padding: "1.4rem 2rem", fontSize: "1.4rem", color: "#475569", whiteSpace: "nowrap" as const }}>
                          {new Date(tx.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td style={{ padding: "1.4rem 2rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                            <MerchantAvatar name={tx.name} logoUrl={tx.logo_url} />
                            <div>
                              <div style={{ fontSize: "1.6rem", fontWeight: 600, color: "#f8fafc" }}>{tx.name}</div>
                              {existingNote && (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.2rem" }}>
                                  <span style={{ fontSize: "1.2rem", color: "#475569" }}>{existingNote}</span>
                                  {existingTag && tagStyle && (
                                    <span style={{ fontSize: "1.1rem", fontWeight: 600, color: tagStyle.color, background: tagStyle.bg, borderRadius: "9999px", padding: "0.1rem 0.7rem" }}>{existingTag}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "1.4rem 2rem" }}>
                          <span style={{ fontSize: "1.2rem", fontWeight: 600, borderRadius: "9999px", padding: "0.3rem 1rem", background: categoryColor(tx.category), color: "#94a3b8" }}>
                            {CATEGORY_ICONS[tx.category] ?? ""} {tx.category || "Other"}
                          </span>
                        </td>
                        <td style={{ padding: "1.4rem 2rem", textAlign: "right", fontSize: "1.6rem", fontWeight: 700, color: "#f87171" }}>
                          {fmt(tx.amount)}
                        </td>
                        <td style={{ padding: "1.4rem 1.6rem 1.4rem 0", textAlign: "center" as const, fontSize: "1.2rem", color: "#334155" }}>
                          {isExpanded ? "▲" : "▼"}
                        </td>
                      </tr>

                      {/* Inline note editor */}
                      {isExpanded && (
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(99,102,241,0.04)" }}>
                          <td colSpan={5} style={{ padding: "1.2rem 2rem 1.6rem 7rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
                              <input
                                type="text"
                                placeholder="Add a note…"
                                value={draftNote}
                                onChange={(e) => setDraftNote(e.target.value)}
                                onBlur={() => commitNote(tx)}
                                onKeyDown={(e) => { if (e.key === "Enter") { commitNote(tx); setExpandedId(null); } if (e.key === "Escape") setExpandedId(null); }}
                                autoFocus
                                style={{ flex: 1, height: "3.6rem", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "0.7rem", padding: "0 1.2rem", fontSize: "1.4rem", color: "#f8fafc", outline: "none", fontFamily: "inherit" }}
                              />
                              <select value={draftTag} onChange={(e) => { setDraftTag(e.target.value); }}
                                onBlur={() => commitNote(tx)}
                                style={{ height: "3.6rem", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.7rem", padding: "0 1.2rem", fontSize: "1.4rem", color: draftTag ? "#f8fafc" : "#475569", fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
                                <option value="" style={{ background: "#1e293b" }}>No tag</option>
                                {TAGS.filter(Boolean).map((t) => <option key={t} value={t} style={{ background: "#1e293b" }}>{t}</option>)}
                              </select>
                              <button onClick={() => { commitNote(tx); setExpandedId(null); }}
                                style={{ height: "3.6rem", padding: "0 1.4rem", background: "#4f46e5", color: "#fff", fontWeight: 700, fontSize: "1.3rem", borderRadius: "0.7rem", border: "none", cursor: "pointer" }}>
                                Save
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: "1.6rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "1.3rem", color: "#334155" }}>Click any row to add a note</span>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "#475569" }}>
              Total shown: <span style={{ color: "#f8fafc" }}>{fmt(totalFiltered)}</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default Transactions;
