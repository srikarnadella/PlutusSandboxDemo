# Plutus — Dev Log

Running log of high-level changes, decisions, and in-progress work.
Newest entries at the top.

---

## 2026-05-31 — Fix: plaid_access_token column missing from user_profiles

**Bug:** Backend restarts always lost the Plaid access token. Dashboard showed "Bank connection unavailable" after every restart even though the bank had been connected.

**Root cause:** The `plaid_access_token` column did not exist in the `user_profiles` Supabase table. Every call to `SupabaseService.storeAccessToken()` was silently failing with a Postgres 42703 "column does not exist" error (caught and swallowed). Only `plaid_item_id` was being persisted (written directly by the frontend). So `checkPlaidConnection` returned true (bank "connected") but `getAccessToken` always returned null (no token to load).

**Fix:** Added `ALTER TABLE user_profiles ADD COLUMN plaid_access_token text;` in Supabase SQL editor. After reconnecting once, the token now persists across restarts.

**Lesson:** `SupabaseService` error responses were being caught and only logged — no surfacing to the caller. Be careful with silent catch blocks around storage operations.

---

## 2026-05-31 — Savings Goals, CSV Export, Transaction Notes

**Savings Goals (`Goals.tsx` + Supabase `savings_goals` table):**
- New ◇ Goals tab in sidebar
- Create goals with emoji, name, target, current balance, optional deadline
- Progress bar, % complete, monthly savings needed to hit deadline
- "Add Funds" inline updater — persists to Supabase immediately
- Empty state with CTA to create first goal

**CSV Export (`Transactions.tsx`):**
- "↓ Export CSV" button in Transactions header (only shown when transactions exist)
- Exports current filtered view — respects active search/category filter
- Columns: Date, Merchant, Category, Amount, Note, Tag
- Pure frontend: `Blob` → `URL.createObjectURL` → programmatic `<a>` click

**Transaction Notes (`Transactions.tsx` + Supabase `transaction_notes` table):**
- Click any transaction row to expand inline note editor
- Free-text note + tag dropdown (Business / Personal / Split / Reimbursable)
- Note + tag shown inline under merchant name in collapsed row
- Saves to Supabase on blur/save; loaded on profile mount alongside other profile data
- Backend: added `transaction_id` field to `TransactionSummary` via `t.getTransactionId()` (SDK v40.1.0 confirmed)

**New Supabase tables:**
```sql
savings_goals (id, user_id, name, target_amount, current_amount, deadline, emoji, created_at)
transaction_notes (id, user_id, transaction_id, note, tag, updated_at) — UNIQUE(user_id, transaction_id)
```

---

## 2026-05-30 — Account balances, spending trends chart, merchant avatars

**Account Balances widget:**
- `SpendingReviewResource` now calls `/accounts/balance/get` on every review and returns `accounts: AccountSummary[]` (name, type, subtype, mask, current, available, limit)
- `Dashboard.tsx` shows a grid of account cards above the stat cards: balance, account type chip, credit utilization or available balance
- Net worth computed as sum of depository/investment accounts minus credit/loan balances

**Spending Trends chart:**
- Backend computes `monthly_trends: MonthlyTrend[]` — last 6 months of spending totals from the full transaction sync
- Dashboard renders an interactive bar chart; clicking a bar switches the selected month
- Selected month bar is full indigo; others are dimmed

**Merchant avatars:**
- Backend now uses `getMerchantName()` (Plaid's normalized name) over `getName()` in `toTransactionSummaries()`, `computeTopMerchants()`, and `detectSubscriptions()`
- `TransactionSummary` now includes `logo_url` from `transaction.getLogoUrl()`
- `MerchantAvatar` component added to `Dashboard.tsx` and `Transactions.tsx`: renders the Plaid logo URL if present, otherwise a colored letter circle keyed on merchant name

---

## 2026-05-30 — Fix: bank connection not persisting across logins

**Bug:** Re-logging in always showed the "Connect your bank" landing screen even after bank was previously connected.

**Root cause:** `Link/index.tsx` `onSuccess` callback was missing `supabaseUser` in its `useCallback` dependency array. The closure captured `supabaseUser` as `null` at mount time and always sent `user_id: ""` to the backend. The backend's `AccessTokenResource` skips both the `userTokens` map write and the Supabase upsert when `userId` is empty, so `plaid_item_id` was never stored. On next login `checkPlaidConnection` queried Supabase, found no `plaid_item_id`, and set `hasPlaidConnection: false`.

**Fix:** Added `supabaseUser` to the `useCallback` deps in `Link/index.tsx` line 78.

---

## 2026-05-30 — Persistent Plaid token storage (Supabase)

**Problem:** Plaid access token was stored only in a static Java field — lost on every server restart. Users had to re-connect their bank every session. `user_profiles.plaid_item_id` was never written so `hasPlaidConnection` always returned false on re-login.

**Root cause:** `SupabaseService.java` was described in CLAUDE.md but never created. `AccessTokenResource` stored only to `QuickstartApplication.accessToken`. `Link/index.tsx` didn't pass `user_id` to the backend.

**Changes made:**
- Created `SupabaseService.java` — HTTP client using Java 11 `HttpClient` to upsert/fetch `plaid_access_token` + `plaid_item_id` from `user_profiles` via Supabase REST API (service role key)
- Rewrote `AccessTokenResource.java` — now accepts JSON `{ public_token, user_id }`, stores token in `userTokens` map + Supabase; keeps global `accessToken` for backward compat with API Dashboard endpoints
- Updated `SpendingReviewResource.java` — `SpendingReviewRequest` now has `user_id` field; added `resolveAccessToken(userId)` that checks in-memory map first, then Supabase, then falls back to global token
- Updated `QuickstartApplication.java` — added `userTokens: ConcurrentHashMap<String,String>`, `supabaseService: SupabaseService`; initializes service from `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars
- Updated `Link/index.tsx` — `set_access_token` now sends JSON with `user_id`; on success sets `hasPlaidConnection: true` in Context
- Updated `SpendingReview/index.tsx` — `spending_review` now passes `user_id`
- Added `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (empty) to `.env`

**Verified (2026-05-30 headless test):**
- ✅ Auth screen renders (dark glassmorphic, Google + magic link)
- ✅ Magic link submits email → "Check your email" confirmation screen
- ✅ `set_access_token` accepts JSON `{ public_token, user_id }` (new format confirmed)
- ✅ `spending_review` token lookup chain works: in-memory map → Supabase → global fallback
- ✅ No "Supabase not configured" warning in backend logs (service role key loaded)
- ⚠️ Google OAuth redirect requires real browser — not testable headlessly

---

## 2026-05-30 — Session start, state audit

**Status:** Auditing codebase state after last session. No code changes this session yet.

**Uncommitted working-tree changes:**
- `CLAUDE.md` — updated from generic Plaid quickstart docs to Plutus-specific instructions (not yet committed)
- `frontend/src/Components/SpendingReview/index.tsx` — added `onOpenDashboard?: () => void` prop to component signature (not yet committed)
- `frontend/.env.local.example` — deleted (not yet committed)

---

## 2026-05-26 — Commit `6390723`: Supabase Auth + persistent user profiles

**What was added:**
- `Components/Auth/index.tsx` — login screen with Google OAuth and magic link
- `Context/index.tsx` — added `supabaseUser`, `isAuthLoading`, `hasPlaidConnection` to global state; listens to Supabase auth state changes; checks `user_profiles.plaid_item_id` to determine if bank is connected
- `lib/supabase.ts` — Supabase client singleton
- `lib/apiFetch.ts` — wraps `fetch` to attach Supabase JWT as `Authorization: Bearer` header on every API call
- `SpendingReview/index.tsx` — loads income + goals from Supabase on mount; auto-saves income (debounced 1.5s); saves goals after successful review run; skips income/goals setup if saved goals exist (goes straight to results)
- `App.tsx` — full auth gate: shows Auth → Landing → SpendingReview based on `supabaseUser` + `hasPlaidConnection`

**Supabase schema used:**
- `user_profiles(id, plaid_access_token, plaid_item_id, monthly_income, rent, utilities, other_fixed, monthly_savings)`
- `spending_goals(id, user_id, category, monthly_limit, avoid, enabled)`
- RLS: users can only read/write their own rows; backend bypasses RLS with service role key

---

## 2026-05-26 — Commit `ab693ab`: UI redesign + spending analysis

**What was added:**
- Dark glassmorphic design system: `#070b14` background, frosted-glass cards, indigo/violet accents
- Big-number stats (4.8–7rem) for transactions, total spent, violations, health grade
- Month picker (last 13 months) in the dashboard header
- Cash flow forecast section (current month only): daily pace, projected total, days remaining, safe-to-spend
- Savings goal panel with annual projection and savings rate
- Goal violations with collapsible transaction drill-down and progress bars
- Top merchants section with relative bar chart
- Recurring charges (subscription) detection
- Unusual purchases table with sortable columns (name, amount, date)
- CSV export for unusual transactions + goal violations
- Spending health grade (A–F) based on violations and budget utilization
- Delta vs. previous month for transaction count and total spent

---

## Earlier — Commit `7b95e2e`: Initial Plutus revamp

- Converted Plaid quickstart repo into a personal finance dashboard
- Java Dropwizard backend with `SpendingReviewResource.java` for transaction analysis
- Single-user in-memory access token (later replaced with per-user Supabase storage)
- Initial step-progress flow and `StepProgress` component
