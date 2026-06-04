# Plutus — Dev Log

Running log of high-level changes, decisions, and in-progress work.
Newest entries at the top.

---

## 2026-06-03 — Multi-bank support + production hardening

### Multi-bank account support

Users can now connect multiple bank institutions (Truist, Discover, Chase, etc.) for a unified financial view.

**New Supabase table:** `plaid_items (id, user_id, item_id, access_token, institution_name, institution_id, created_at)` with RLS — frontend can read/delete own rows, backend uses service role key for writes. Run `java/migrations/add_plaid_items_table.sql`.

**Backend changes:**
- `SupabaseService` — added `PlaidItem` class, `storeItem()`, `getItems()`, `removeItem()`
- `AccessTokenResource` — accepts `institution_name` and `institution_id` from Plaid Link metadata, writes to both `plaid_items` (new) and `user_profiles` (legacy compat), invalidates transaction cache on connect
- `SpendingReviewResource` — replaced single-token `resolveAccessToken()` with `resolveAllItems()` which queries `plaid_items` first, falls back to `user_profiles` legacy token. `fetchAllTransactions()` now loops over all items and merges results. `fetchAllAccountBalances()` same. Each item fetched independently, results merged before analysis.
- New `RemoveItemResource` — `POST /api/remove_item { item_id }` — JWT-validated, calls Plaid `/item/remove`, deletes from `plaid_items`, invalidates memory caches

**Frontend changes:**
- `Link/index.tsx` — `onSuccess` now passes `institution_name` and `institution_id` from Plaid metadata to `set_access_token`. Also fixed post-connect redirect from `/` to `/dashboard`.
- `Context/index.tsx` — `checkPlaidConnection` now queries `plaid_items` table first, falls back to `user_profiles.plaid_item_id` for legacy users
- `Account.tsx` — new "Connected Banks" section: lists all connected institutions, per-bank remove button, "Add another bank" button (self-contained Plaid Link flow without leaving the page)

### Production hardening (same session)

**Backend:**
- Fixed `clientName` → "Plutus" in `LinkTokenResource`
- Fixed `clientUserId` to use authenticated user UUID (was a timestamp)
- Added CORS filter via `CrossOriginFilter` — reads `FRONTEND_ORIGIN` env var, defaults to `*`
- Removed all 15 legacy quickstart endpoints from registration (they used a global single-user `accessToken`)
- Added 5-minute JWT validation cache in `JwtValidator` — eliminates one Supabase round-trip per API call
- Added 5-minute in-memory transaction cache per user in `SpendingReviewResource`
- Fixed sample standard deviation in `detectUnusual` (was using population stddev `/ n`, now `/ (n-1)`)
- Added `GET /api/health` — returns `{"status":"ok"}`
- Added `POST /api/plaid_webhook` — logs Plaid webhook events (foundation for cache invalidation)
- Added `POST /api/create_update_link_token` — creates Plaid Link token in update mode for re-auth flows
- Fixed `ApiClient.Development` (doesn't exist in SDK v40) → removed; only `Sandbox` and `Production`
- Fixed `PropertyNamingStrategy.SNAKE_CASE` deprecation → `PropertyNamingStrategies.SNAKE_CASE`
- Persists Plaid sync cursor to `user_profiles.plaid_sync_cursor` after full sync (run `java/migrations/add_sync_cursor.sql`)

**Frontend:**
- Surfaced `unusual_transactions` as "Unusual Charges" card in Dashboard
- Surfaced `goal_violations` as "Budget Alerts" banner in Dashboard
- `ITEM_LOGIN_REQUIRED` detected and shown as "Bank session expired" with reconnect prompt
- Extracted `CATEGORY_COLORS`, `MerchantAvatar`, and all shared types to `SpendingReview/shared.tsx`
- Fixed `result: any` → properly typed `ReviewResult | null`
- Added toast notification system (`Toast.tsx` + `useToast` hook), note save errors surface as toasts
- Added 25-per-page pagination to Transactions tab
- Deleted orphaned quickstart components: `Endpoint/`, `Error/`, `Table/`, `ProductTypes/`
- `App.tsx` uses `apiFetch` for link token creation so JWT is included (real userId passed to Plaid as clientUserId)

---

## 2026-06-02 — Code review bug fixes, round 2 (8 issues)

Eight more bugs surfaced by a second automated multi-angle code review and fixed.

---

### Bug 7: QuickstartApplication.accessToken never written after AccessTokenResource refactor

**File:** `java/.../resources/AccessTokenResource.java`

**Bug:** The JWT security refactor removed the two lines that set `QuickstartApplication.accessToken` and `QuickstartApplication.itemId`. Fourteen legacy Dropwizard resource classes (AccountsResource, TransactionsResource, BalanceResource, ItemResource, AuthResource, and ten others) still read `QuickstartApplication.accessToken` as their sole token source with no fallback. After any bank connection, those resources received `null` as the access token and every call returned an `INVALID_ACCESS_TOKEN` error from Plaid.

**Fix:** Restored the two global assignments in `setAccessToken()`. The globals are server-side only (never returned in the response), so this doesn't re-introduce the security issue that was fixed earlier.

---

### Bug 8: computeMonthlyTrends anchored to wall-clock time, ignores selected month

**File:** `java/.../resources/SpendingReviewResource.java`

**Bug:** `computeMonthlyTrends()` used `YearMonth.now()` as its 6-month window anchor regardless of the `year`/`month` from the request. When a user selected a past month (e.g. November 2025), the main stat cards correctly showed that month's data but the trend bar chart showed Jan–Jun 2026 — a completely different window that didn't include the selected month.

**Fix:** Added `YearMonth anchor` parameter to `computeMonthlyTrends()` and passed `targetMonth` from the call site. The trend window now always ends at the selected month.

---

### Bug 9: fetchAllTransactions could still loop forever — no retry limit

**File:** `java/.../resources/SpendingReviewResource.java`

**Bug:** The previous fix moved `addAll`/`hasMore` before the cursor check, preventing dropped transactions. But when Plaid returns `hasMore=true` with an empty cursor (initial sync still in progress), the code sleeps and retries with the same null cursor indefinitely — no exit condition existed. Under sustained Plaid sync delay a Dropwizard worker thread could be parked forever.

**Fix:** Added `syncRetries` counter; breaks out of the loop and logs a warning after 10 consecutive empty-cursor retries (~20 seconds), returning whatever transactions were collected so far.

---

### Bug 10: HTTP read timeout missing — connectTimeout only covered TCP handshake

**Files:** `java/.../JwtValidator.java`, `java/.../SupabaseService.java`

**Bug:** Both classes set `connectTimeout(10s)` on the `HttpClient`, which only limits the TCP connection phase. Once Supabase accepted the socket but stalled sending a response, `httpClient.send()` would block the worker thread indefinitely — same thread-exhaustion DoS as having no timeout at all.

**Fix:** Added `.timeout(Duration.ofSeconds(10))` to every `HttpRequest.newBuilder()` call in both classes. `HttpRequest.timeout()` bounds the entire request duration (connect + transfer), not just the handshake.

---

### Bug 11: checkPlaidConnection unhandled rejection left isAuthLoading=true forever

**File:** `frontend/src/Context/index.tsx`

**Bug:** `checkPlaidConnection` was always awaited before `dispatch({ isAuthLoading: false })`, but had no error handling. If the Supabase query threw (network timeout, unexpected RLS rejection), the async `onAuthStateChange` callback would throw before reaching the dispatch. `isAuthLoading` would stay `true` and the app would show the loading screen forever.

**Fix:** Wrapped `await checkPlaidConnection(...)` in a `try/catch` with an empty catch block. Auth-gate clearing is now guaranteed regardless of Plaid/Supabase connectivity.

---

### Bug 12: MAPPER.readTree("") threw on empty Supabase response body

**File:** `java/.../SupabaseService.java`

**Bug:** `getAccessToken()` called `MAPPER.readTree(response.body())` with no guard on whether the body was empty. A 200 OK with an empty body (network truncation, PostgREST misconfiguration) would cause `readTree("")` to throw `MismatchedInputException`, propagating as a 500 or 403 even though the token might be correctly stored in the database.

**Fix:** Added `if (body == null || body.isEmpty()) return null;` before the `readTree` call.

---

### Bug 13: InterruptedException catch cleared thread interrupt flag without restoring it

**File:** `java/.../JwtValidator.java`

**Bug:** The broad `catch (Exception e)` block in `requireUserId()` silently swallowed `InterruptedException`, which clears the thread's interrupt flag. The code then threw a `WebApplicationException(401)` without calling `Thread.currentThread().interrupt()`. During server shutdown, interrupted worker threads lost their interrupted status, preventing clean Dropwizard shutdown.

**Fix:** Added an explicit `catch (InterruptedException e)` before the generic catch that calls `Thread.currentThread().interrupt()` to restore the flag before re-throwing as 401.

---

### Bug 14: Failed Plaid exchange dispatch stored sentinel strings in Context state

**File:** `frontend/src/Components/Link/index.tsx`

**Bug:** On a failed `/api/set_access_token` response, the error dispatch set `accessToken: "no access_token retrieved"` and `itemId: "no item_id retrieved"` — truthy non-null strings. Any code path reading `context.accessToken` to check for a live connection would incorrectly find a truthy value after a failed connection attempt. The sentinel strings also persisted for the rest of the session (the success dispatch didn't overwrite them).

**Fix:** Changed the failure dispatch to set both fields to `null`.

---

## 2026-06-02 — Code review bug fixes (6 issues)

Six bugs surfaced by automated multi-angle code review and fixed.

---

### Bug 1: fetchAllTransactions — infinite loop + dropped transactions + NPE

**File:** `java/src/main/java/com/plaid/quickstart/resources/SpendingReviewResource.java`

**Bug:** The Plaid TransactionsSync pagination loop had three compounding errors:
1. `cursor = resp.getNextCursor()` ran before the empty-string check, so if Plaid returned `null` (initial sync) the subsequent `.equals("")` threw a NullPointerException.
2. When the cursor was `""` (Plaid still syncing), the code called `continue` **before** `added.addAll(resp.getAdded())` and `hasMore = resp.getHasMore()` — so all transactions from that page were silently dropped.
3. Because `hasMore` was never updated, the loop ran forever on any account still in its initial sync.

**Fix:** Reordered operations so `addAll` and `hasMore` update always happen first, then the cursor is only advanced when Plaid returns a non-empty value. Sleep-and-retry only triggers when `hasMore` is still true with an empty cursor.

```java
// Before
cursor = resp.getNextCursor();
if (cursor.equals("")) { Thread.sleep(2000); continue; }
added.addAll(resp.getAdded());
hasMore = resp.getHasMore();

// After
added.addAll(resp.getAdded());
hasMore = resp.getHasMore();
String nextCursor = resp.getNextCursor();
if (nextCursor != null && !nextCursor.isEmpty()) {
  cursor = nextCursor;
} else if (hasMore) {
  Thread.sleep(2000);
}
```

---

### Bug 2: No HTTP timeout on JwtValidator and SupabaseService

**Files:** `java/.../JwtValidator.java`, `java/.../SupabaseService.java`

**Bug:** Both classes used `HttpClient.newHttpClient()` with no connect or read timeout. If Supabase was slow or unreachable, every API request would block a Dropwizard worker thread indefinitely, exhausting the thread pool under any load.

**Fix:** Switched to `HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()` in both classes.

---

### Bug 3: SupabaseService.getAccessToken — fragile manual JSON parsing

**File:** `java/.../SupabaseService.java`

**Bug:** `getAccessToken()` extracted `plaid_access_token` using `indexOf` + `substring` on the raw response body. This silently returned wrong data if Supabase ever changed serialization (e.g. added whitespace after `:`) and would truncate tokens containing JSON escape sequences. `ObjectMapper` was already declared in the same class and used in `storeAccessToken`.

**Fix:** Replaced string scanning with `MAPPER.readTree()` + `JsonNode.path()`:

```java
JsonNode arr = MAPPER.readTree(response.body());
if (!arr.isArray() || arr.isEmpty()) return null;
JsonNode tokenNode = arr.get(0).path("plaid_access_token");
if (tokenNode.isMissingNode() || tokenNode.isNull()) return null;
String token = tokenNode.asText(null);
return (token == null || token.isEmpty()) ? null : token;
```

---

### Bug 4: Transfer category color inconsistent across Dashboard vs Transactions/Budgets

**File:** `frontend/src/Components/SpendingReview/Dashboard.tsx`

**Bug:** `Dashboard.tsx` defined Transfer's dot color as `#64748b` (slate/gray), while `Transactions.tsx` and `Budgets.tsx` both used `#818cf8` (indigo). Users switching between the Overview and Transactions tabs saw the same category rendered in different colors.

**Fix:** Updated Dashboard's `CATEGORY_COLORS` Transfer entry to `{ dot: "#818cf8", bg: "rgba(129,140,248,0.15)" }` to match the other two files.

---

### Bug 5: linkSuccess dispatched even when bank exchange fails

**File:** `frontend/src/Components/Link/index.tsx`

**Bug:** `dispatch({ linkSuccess: true })` ran unconditionally after the if/else block in `onSuccess`, so if `/api/set_access_token` returned an error, `linkSuccess` became `true` in Context even though `hasPlaidConnection` stayed `false`. Any UI reading `linkSuccess` would incorrectly show a success state after a failed connection.

**Fix:** Moved `linkSuccess: true` into each dispatch path explicitly — added to the success dispatch inside `exchangePublicTokenForAccessToken`, and inlined into the payment-initiation / CRA branches. Removed the unconditional outer dispatch.

---

### Bug 6: TOKEN_REFRESHED event updated hasPlaidConnection without await

**File:** `frontend/src/Context/index.tsx`

**Bug:** For auth events other than `INITIAL_SESSION` / `SIGNED_IN`, `checkPlaidConnection` was called fire-and-forget (no `await`) before the `dispatch` that clears `isAuthLoading`. If a TOKEN_REFRESHED event fired while route guards were re-evaluating, `hasPlaidConnection` could briefly be stale.

**Fix:** Removed the `if/else` distinction — `await checkPlaidConnection(session.user.id)` is now always awaited for any event with a valid session. Since `checkPlaidConnection` is idempotent and the await only delays clearing `isAuthLoading` by one Supabase round-trip, there is no meaningful performance cost.

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
