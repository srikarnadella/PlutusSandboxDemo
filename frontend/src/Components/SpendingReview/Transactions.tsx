import React, { useState, useMemo, useEffect, useRef } from "react";
import { CATEGORY_COLORS, PRESET_CATEGORIES, MerchantAvatar } from "./shared";

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
const PAGE_SIZE = 25;
const CUSTOM_SENTINEL = "__custom__";

const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const categoryStyle = (cat: string) => {
  const c = CATEGORY_COLORS[cat];
  return {
    bg:  c ? c.bg  : "rgba(255,255,255,0.06)",
    dot: c ? c.dot : "#64748b",
  };
};

const TAG_COLORS: Record<string, { color: string; bg: string }> = {
  Business:     { color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  Personal:     { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  Split:        { color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  Reimbursable: { color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
};

const Transactions = ({ transactions, selectedYear, selectedMonth, loading, monthOptions, onMonthChange, notes, noteTags, onNoteChange }: TransactionsProps) => {
  const [search, setSearch]                 = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [customCategory, setCustomCategory] = useState("");
  const [sortField, setSortField]           = useState<"name" | "amount" | "date">("date");
  const [sortDir, setSortDir]               = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId]         = useState<string | null>(null);
  const [draftNote, setDraftNote]           = useState("");
  const [draftTag, setDraftTag]             = useState("");
  const [page, setPage]                     = useState(0);
  const customInputRef                      = useRef<HTMLInputElement>(null);

  // All known categories: preset budget categories + any extra seen in transactions
  const categories = useMemo(() => {
    const fromTxns = new Set(transactions.map((t) => t.category).filter(Boolean));
    const merged = new Set([...PRESET_CATEGORIES, ...fromTxns]);
    return ["All", ...Array.from(merged).sort()];
  }, [transactions]);

  // Active filter string (either picked from dropdown or typed custom)
  const activeCategory = categoryFilter === CUSTOM_SENTINEL ? customCategory : categoryFilter;

  const filtered = useMemo(() => {
    let out = [...transactions];
    if (search) out = out.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
    if (activeCategory && activeCategory !== "All") {
      out = out.filter((t) => t.category?.toLowerCase().includes(activeCategory.toLowerCase()));
    }
    out.sort((a, b) => {
      const cmp = sortField === "amount" ? a.amount - b.amount
        : sortField === "date" ? a.date.localeCompare(b.date)
        : a.name.localeCompare(b.name);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return out;
  }, [transactions, search, activeCategory, sortField, sortDir]);

  useEffect(() => setPage(0), [search, categoryFilter, customCategory, sortField, sortDir]);

  // Auto-focus the custom input when it appears
  useEffect(() => {
    if (categoryFilter === CUSTOM_SENTINEL) customInputRef.current?.focus();
  }, [categoryFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (field: typeof sortField) => {
    if (field === sortField) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const totalFiltered = filtered.reduce((s, t) => s + t.amount, 0);

  const exportCSV = () => {
    const rows = [["Date", "Merchant", "Category", "Amount", "Note", "Tag"]];
    filtered.forEach((tx) => {
      const txId = tx.transaction_id ?? "";
      rows.push([tx.date, tx.name, tx.category || "Other", tx.amount.toFixed(2), notes[txId] ?? "", noteTags[txId] ?? ""]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
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
    <button onClick={() => handleSort(field)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 700, fontSize: "1.2rem", textTransform: "uppercase" as const, letterSpacing: "0.08em", color: sortField === field ? "#818cf8" : "#64748b", fontFamily: "inherit" }}>
      {label}{sortField === field && <span>{sortDir === "desc" ? " ▼" : " ▲"}</span>}
    </button>
  );

  const inputStyle: React.CSSProperties = {
    height: "4.4rem", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.09)", borderRadius: "0.9rem",
    padding: "0 1.4rem", fontSize: "1.4rem", fontWeight: 600,
    color: "#94a3b8", cursor: "pointer", outline: "none",
    fontFamily: "inherit",
  };

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
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6ee7b7"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(5,150,105,0.4)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
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
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: "20rem" }}>
          <span style={{ position: "absolute", left: "1.4rem", top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none", display: "flex", alignItems: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input type="text" placeholder="Search merchants…" value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", height: "4.4rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "0.9rem", paddingLeft: "4rem", paddingRight: "1.4rem", fontSize: "1.5rem", color: "#f8fafc", outline: "none", fontFamily: "inherit" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(5,150,105,0.5)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
          />
        </div>

        {/* Category dropdown */}
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); if (e.target.value !== CUSTOM_SENTINEL) setCustomCategory(""); }}
          style={{ ...inputStyle, minWidth: "16rem" }}
        >
          <option value="All" style={{ background: "#1e293b" }}>All Categories</option>
          {categories.filter((c) => c !== "All").map((c) => (
            <option key={c} value={c} style={{ background: "#1e293b" }}>{c}</option>
          ))}
          <option disabled style={{ background: "#1e293b", color: "#334155" }}>──────────</option>
          <option value={CUSTOM_SENTINEL} style={{ background: "#1e293b", color: "#818cf8" }}>Custom filter…</option>
        </select>

        {/* Custom category text input */}
        {categoryFilter === CUSTOM_SENTINEL && (
          <input
            ref={customInputRef}
            type="text"
            placeholder="Type any category…"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            style={{ ...inputStyle, minWidth: "18rem", color: "#f8fafc", cursor: "text", borderColor: customCategory ? "rgba(129,140,248,0.5)" : "rgba(255,255,255,0.09)" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(129,140,248,0.6)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = customCategory ? "rgba(129,140,248,0.5)" : "rgba(255,255,255,0.09)"; }}
          />
        )}

        {/* Clear button */}
        {(search || categoryFilter !== "All") && (
          <button
            onClick={() => { setSearch(""); setCategoryFilter("All"); setCustomCategory(""); }}
            style={{ height: "4.4rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "0.9rem", padding: "0 1.6rem", fontSize: "1.4rem", color: "#64748b", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ borderRadius: "1.4rem", padding: "5rem 3rem", textAlign: "center" as const, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ width: "5.6rem", height: "5.6rem", borderRadius: "1.4rem", background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.6rem" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
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
                  <th style={{ padding: "1.4rem 2rem", textAlign: "left", fontSize: "1.2rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Category</th>
                  <th style={{ padding: "1.4rem 2rem", textAlign: "right" }}><SortBtn field="amount" label="Amount" /></th>
                  <th style={{ padding: "1.4rem 2rem", width: "4rem" }} />
                </tr>
              </thead>
              <tbody>
                {paginated.map((tx, i) => {
                  const txId       = tx.transaction_id ?? tx.name + tx.date;
                  const isExpanded = expandedId === txId;
                  const existingNote = notes[txId];
                  const existingTag  = noteTags[txId];
                  const tagStyle     = existingTag ? TAG_COLORS[existingTag] : null;
                  const catStyle     = categoryStyle(tx.category);

                  return (
                    <React.Fragment key={i}>
                      <tr
                        style={{ borderBottom: isExpanded ? "none" : "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s", cursor: "pointer" }}
                        onClick={() => openNote(tx)}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.025)"; }}
                        onMouseLeave={(e) => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                      >
                        {/* Date */}
                        <td style={{ padding: "1.4rem 2rem", fontSize: "1.4rem", color: "#475569", whiteSpace: "nowrap" as const }}>
                          {new Date(tx.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>

                        {/* Merchant + note preview */}
                        <td style={{ padding: "1.4rem 2rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                            <MerchantAvatar name={tx.name} logoUrl={tx.logo_url} size="3rem" />
                            <div>
                              <div style={{ fontSize: "1.6rem", fontWeight: 600, color: "#f8fafc" }}>{tx.name}</div>
                              {existingNote && (
                                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.3rem" }}>
                                  {/* Pencil icon so it's clear this is a note */}
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                  {/* Brighter note text — was #475569 */}
                                  <span style={{ fontSize: "1.3rem", color: "#94a3b8", fontStyle: "italic" }}>{existingNote}</span>
                                  {existingTag && tagStyle && (
                                    <span style={{ fontSize: "1.1rem", fontWeight: 700, color: tagStyle.color, background: tagStyle.bg, borderRadius: "9999px", padding: "0.15rem 0.8rem" }}>{existingTag}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Category badge */}
                        <td style={{ padding: "1.4rem 2rem" }}>
                          <span style={{ fontSize: "1.25rem", fontWeight: 600, borderRadius: "9999px", padding: "0.4rem 1rem", background: catStyle.bg, color: "#cbd5e1", display: "inline-flex", alignItems: "center", gap: "0.5rem", whiteSpace: "nowrap" as const }}>
                            <span style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", background: catStyle.dot, flexShrink: 0, display: "inline-block" }} />
                            {tx.category || "Other"}
                          </span>
                        </td>

                        {/* Amount */}
                        <td style={{ padding: "1.4rem 2rem", textAlign: "right", fontSize: "1.6rem", fontWeight: 700, color: "#f87171" }}>
                          {fmt(tx.amount)}
                        </td>

                        {/* Expand chevron */}
                        <td style={{ padding: "1.4rem 1.6rem 1.4rem 0", textAlign: "center" as const, fontSize: "1.2rem", color: isExpanded ? "#818cf8" : "#475569" }}>
                          {isExpanded ? "▲" : "▼"}
                        </td>
                      </tr>

                      {/* Inline note editor */}
                      {isExpanded && (
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(129,140,248,0.04)" }}>
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
                                style={{ flex: 1, height: "3.6rem", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(129,140,248,0.4)", borderRadius: "0.7rem", padding: "0 1.2rem", fontSize: "1.4rem", color: "#f8fafc", outline: "none", fontFamily: "inherit" }}
                              />
                              <select value={draftTag} onChange={(e) => setDraftTag(e.target.value)}
                                onBlur={() => commitNote(tx)}
                                style={{ height: "3.6rem", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.7rem", padding: "0 1.2rem", fontSize: "1.4rem", color: draftTag ? "#f8fafc" : "#64748b", fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
                                <option value="" style={{ background: "#1e293b" }}>No tag</option>
                                {TAGS.filter(Boolean).map((t) => <option key={t} value={t} style={{ background: "#1e293b" }}>{t}</option>)}
                              </select>
                              <button onClick={() => { commitNote(tx); setExpandedId(null); }}
                                style={{ height: "3.6rem", padding: "0 1.6rem", background: "linear-gradient(135deg, #047857, #059669)", color: "#fff", fontWeight: 700, fontSize: "1.3rem", borderRadius: "0.7rem", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1.2rem", marginTop: "2.4rem" }}>
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.8rem", padding: "0.8rem 1.6rem", fontSize: "1.4rem", color: page === 0 ? "#334155" : "#94a3b8", cursor: page === 0 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                ←
              </button>
              <span style={{ fontSize: "1.4rem", color: "#64748b" }}>{page + 1} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.8rem", padding: "0.8rem 1.6rem", fontSize: "1.4rem", color: page >= totalPages - 1 ? "#334155" : "#94a3b8", cursor: page >= totalPages - 1 ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                →
              </button>
            </div>
          )}

          <div style={{ marginTop: "1.6rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "1.3rem", color: "#64748b" }}>Click any row to add a note or tag</span>
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
