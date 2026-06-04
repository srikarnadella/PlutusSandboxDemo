import React from "react";

export const PRESET_CATEGORIES = [
  "Food and Drink", "Shops", "Travel", "Recreation",
  "Healthcare", "Service", "Transfer", "Payment",
];

export const CATEGORY_COLORS: Record<string, { dot: string; bg: string }> = {
  "Food and Drink": { dot: "#fb923c", bg: "rgba(251,146,60,0.15)" },
  Shops:            { dot: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  Travel:           { dot: "#38bdf8", bg: "rgba(56,189,248,0.15)" },
  Recreation:       { dot: "#34d399", bg: "rgba(52,211,153,0.15)" },
  Healthcare:       { dot: "#f87171", bg: "rgba(248,113,113,0.15)" },
  Service:          { dot: "#fbbf24", bg: "rgba(251,191,36,0.15)" },
  Transfer:         { dot: "#818cf8", bg: "rgba(129,140,248,0.15)" },
  Payment:          { dot: "#e879f9", bg: "rgba(232,121,249,0.15)" },
};

export const AVATAR_COLORS = ["#059669", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#f87171", "#38bdf8"];
export const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

export const MerchantAvatar = ({ name, logoUrl, size = "3.2rem" }: { name: string; logoUrl?: string | null; size?: string }) => {
  const color = avatarColor(name);
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "contain", background: "#fff", flexShrink: 0 }}
        onError={(e: React.SyntheticEvent<HTMLImageElement>) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `${color}22`, border: `1px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontSize: `calc(${size} * 0.42)`, fontWeight: 800, color, lineHeight: 1 }}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
};

// Shared types
export interface ReviewStats { transactions_analyzed: number; total_spent: number; period: string; }
export interface PreviousMonthSummary { total_spent: number; transactions_analyzed: number; }
export interface MonthlyTrend { year: number; month: number; label: string; total_spent: number; }
export interface AccountSummary { name: string; type: string; subtype: string; mask: string; current: number; available: number; limit: number; }
export interface CategorySummary { category: string; amount_spent: number; monthly_limit: number; avoid: boolean; transaction_count: number; }
export interface AllTransaction { name: string; amount: number; date: string; category: string; logo_url?: string; transaction_id?: string; }
export interface MerchantSummary { name: string; total_amount: number; visit_count: number; }
export interface SubscriptionItem { name: string; amount: number; frequency: string; last_date: string; months_detected: number; }
export interface GoalViolation { category: string; monthly_limit: number; amount_spent: number; over_by: number; is_avoid_category: boolean; }
export interface UnusualTransaction { name: string; amount: number; date: string; category: string[]; reason: string; }
export interface ReviewResult {
  stats: ReviewStats;
  goal_violations: GoalViolation[];
  top_merchants: MerchantSummary[];
  subscriptions: SubscriptionItem[];
  previous_month: PreviousMonthSummary;
  all_transactions: AllTransaction[];
  category_spending: CategorySummary[];
  accounts: AccountSummary[];
  monthly_trends: MonthlyTrend[];
  unusual_transactions: UnusualTransaction[];
  synced_at?: string;  // ISO instant — when data was last fetched from Plaid
}
