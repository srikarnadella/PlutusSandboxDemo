# CLAUDE.md — Plutus

Plutus is a personal finance dashboard (Mint/YNAB replacement) built on Plaid + Supabase. This is a real app, not a quickstart demo. Features should be production-quality and user-facing.

## App Goal

User logs in with Supabase Auth → connects their bank via Plaid (once, persisted) → lands directly on a full spending dashboard every subsequent visit. All profile data, budgets, savings goals, and transaction notes are persisted per user in Supabase.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite (port 3000) |
| Styling | Inline styles only — dark glassmorphic design system |
| Auth + DB | Supabase (GoTrue auth + PostgreSQL) |
| Backend | Java 11 + Dropwizard (port 8000) |
| Bank data | Plaid Java SDK v40.1.0 (sandbox env) |

## Running Locally

**Backend:**
```bash
cd java && mvn package -DskipTests
./start.sh          # auto-kills port 8000, reads java/.env, starts server
```

**Frontend:**
```bash
cd frontend && npm install && npm start
# → http://localhost:3000 (auto-kills ports 3000/3001 before starting)
```

Vite proxies `/api/*` → `http://127.0.0.1:8000`. Start Java backend first.

## Environment Variables

**`java/.env`** (read by `start.sh` — Java backend):
```
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=sandbox
PLAID_PRODUCTS=auth,transactions,signal
PLAID_COUNTRY_CODES=US,CA
PLAID_REDIRECT_URI=
SIGNAL_RULESET_KEY=
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # backend only, never expose to browser
```

**`frontend/.env.local`** (gitignored — Vite/React reads these):
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

**Important:** `start.sh` reads `java/.env` (not root `.env`). The root `.env` is only used if running the server manually with `env $(cat ../.env | grep -v "#" | xargs)`.

## Architecture

### Frontend (`frontend/src/`)
- `App.tsx` — auth gate + routing: Auth → Landing (connect bank) → SpendingReview dashboard
- `Context/index.tsx` — global state: `supabaseUser`, `isAuthLoading`, `hasPlaidConnection`, `linkSuccess`; checks `user_profiles.plaid_item_id` on login to skip bank connect step
- `lib/supabase.ts` — Supabase client singleton
- `lib/apiFetch.ts` — wraps `fetch` to attach Supabase JWT as `Authorization: Bearer` on every API call
- `Components/Auth/` — login screen (Google OAuth + magic link)
- `Components/Landing/` — "Connect your bank" one-time setup screen
- `Components/Link/` — Plaid Link button; on success upserts `plaid_item_id` directly to Supabase AND calls backend to store `plaid_access_token`
- `Components/SpendingReview/` — full dashboard (see tabs below)

### SpendingReview Tabs
| File | Tab | Description |
|---|---|---|
| `Dashboard.tsx` | Overview | Account balances, net worth, stat cards, spending trends chart, category bars, cash flow, top merchants, subscriptions, recent transactions |
| `Transactions.tsx` | Transactions | Full transaction list with search, category filter, sort, inline notes/tags, CSV export |
| `Budgets.tsx` | Budgets | Per-category monthly limits and avoid flags; discretionary overview; preset quick-fill (Tight/Standard/Generous) |
| `Goals.tsx` | Goals | Savings goals tracker with progress bars, add-funds, monthly savings needed calculation |
| `Account.tsx` | Account | Income + fixed expenses editor; live discretionary preview; sign out |
| `index.tsx` | Shell | Fixed 220px sidebar, tab routing, shared state, Supabase load/save for all profile data |

### Backend (`java/src/main/java/com/plaid/quickstart/`)
- `QuickstartApplication.java` — wires all resources; `userTokens: ConcurrentHashMap<String,String>` for per-user tokens; initializes `SupabaseService`
- `SupabaseService.java` — Java 11 `HttpClient` calls to Supabase REST API using service role key; `storeAccessToken(userId, accessToken, itemId)` and `getAccessToken(userId)`
- `resources/AccessTokenResource.java` — POST `/api/set_access_token`; JWT-validated; exchanges public_token with Plaid; stores in `userTokens` map + Supabase
- `resources/SpendingReviewResource.java` — POST `/api/spending_review`; JWT-validated; full analysis pipeline (see response shape below)
- `JwtValidator.java` — validates Supabase JWTs by calling `/auth/v1/user` endpoint (network round-trip per request, no local caching)

### SpendingReviewResponse Fields
```
stats              — total_spent, transactions_analyzed, period
previous_month     — total_spent, transactions_analyzed
monthly_trends     — last 6 months: year, month, label, total_spent
accounts           — name, type, subtype, mask, current, available, limit
category_spending  — per-category: amount_spent, monthly_limit, avoid, transaction_count
top_merchants      — name, total_amount, visit_count (prefers merchantName, falls back to name)
subscriptions      — name, amount, frequency, last_date, months_detected
unusual_transactions — name, amount, date, category, reason (2-sigma outlier detection)
goal_violations    — category, monthly_limit, amount_spent, over_by, transactions, is_avoid_category
all_transactions   — name, amount, date, category, logo_url, transaction_id
```

Token resolution order: `resolveAccessToken(userId)` → in-memory `userTokens` map → Supabase DB → throws 403.

### Supabase Schema
```sql
user_profiles (
  id uuid PK → auth.users,
  plaid_access_token text,      -- stored by backend via service role key
  plaid_item_id text,           -- written by frontend after Plaid Link succeeds
  monthly_income, rent, utilities, other_fixed, monthly_savings numeric,
  updated_at timestamptz
)
spending_goals (
  id uuid PK, user_id → auth.users,
  category text, monthly_limit numeric, avoid bool, enabled bool,
  UNIQUE(user_id, category)
)
savings_goals (
  id uuid PK, user_id → auth.users,
  name text, target_amount numeric, current_amount numeric,
  deadline date, emoji text, created_at timestamptz
)
transaction_notes (
  id uuid PK, user_id → auth.users,
  transaction_id text, note text, tag text, updated_at timestamptz,
  UNIQUE(user_id, transaction_id)
)
```
RLS enabled on all tables. Backend uses service role key to bypass RLS for `plaid_access_token` writes.

## Plaid Flow

1. `POST /api/create_link_token` → frontend opens Plaid Link widget
2. User picks institution → Plaid returns `public_token`
3. Frontend: `POST /api/set_access_token { public_token, user_id }` → backend JWT-validates, exchanges + stores access token
4. Frontend: also upserts `{ id, plaid_item_id }` directly to Supabase (belt-and-suspenders so `checkPlaidConnection` always works)
5. `POST /api/spending_review { user_id, budgets, avoid_categories, year, month }` → full analysis

## Design Principles

- **Dark glassmorphic** — background `#070b14`, cards `rgba(255,255,255,0.04–0.08)`, green accents (`#34d399`, `#059669`, `#6ee7b7`)
- **Big numbers** — stat values at 3–7rem, never require squinting
- **Merchant avatars** — 8-color palette keyed on first char, or Plaid `logo_url` if present
- **Inline styles only in SpendingReview** — no Tailwind classes; pure inline for portability
- No comments unless the WHY is non-obvious
- No extra abstractions beyond what the task requires

## Known Gotchas

- **Plaid sandbox credentials:** `user_good` / `pass_good` at any institution
- **`unusual_transactions`** is computed by the backend but NOT YET surfaced in the dashboard UI
- **`goal_violations`** is computed but only used for the health grade — no dedicated alerts panel yet
- **Backend restart:** token is fetched from Supabase on first request via `resolveAccessToken`. Requires `plaid_access_token` column in `user_profiles` (added 2026-05-31).
- **Port conflicts:** `start.sh` and `npm start` both auto-kill their ports before binding
- **LinkTokenResource uses a timestamp as `clientUserId`** — not tied to the authenticated user; Plaid can't correlate items across sessions properly
- **`clientName` is still "Quickstart Client"** in `LinkTokenResource.java` — must be changed to "Plutus" for production
- **Quickstart leftover resources** — many files under `java/src/main/java/.../resources/` (AccountsResource, AssetsResource, AuthResource, etc.) are from the Plaid quickstart template and are not used by the app. They use the global `QuickstartApplication.accessToken` which is a single-user variable — these endpoints are NOT multi-user safe and should be removed or never exposed.
- **Global static mutable state in `QuickstartApplication.java`** — `accessToken`, `userToken`, `userId`, `itemId` are legacy globals set on each `set_access_token` call. They persist for legacy quickstart endpoints only. `SpendingReviewResource` does NOT use them; it uses `userTokens` map.
- **Tailwind is imported in `vite.config.ts`** (`@tailwindcss/vite`) even though SpendingReview uses inline styles. Safe to leave; just don't use Tailwind in SpendingReview components.
- **`result: any` type** in `SpendingReview/index.tsx` (line ~212) — typed properly in Dashboard but not at shell level
- **JwtValidator makes a network call to Supabase per request** — no caching. Under load this adds 50–200ms per API call.
- **TransactionsSync cursor is not persisted** — resets to null on every spending_review call. For real users with 2+ years of history, this means full re-sync on every page load.
- **Only one bank per user** — `user_profiles.plaid_item_id` is a single column; connecting a second bank overwrites the first.

## Code Quality Issues to Know

- `CATEGORY_COLORS` and `MerchantAvatar` are duplicated between `Dashboard.tsx` and `Transactions.tsx` — extract to `SpendingReview/shared.ts` when touching both files
- `IncomeSetup` and `GoalRow` interfaces are re-declared in `Account.tsx` and `Dashboard.tsx` — canonical definitions are in `index.tsx` and exported
- Unused/orphaned frontend components: `Components/Endpoint/`, `Components/Error/`, `Components/Table/`, `Components/ProductTypes/`, `Components/Home/` — leftover quickstart boilerplate, safe to delete
- Category matching in `SpendingReviewResource.matchesCategory()` uses fuzzy `contains()` — can cause false matches (e.g. "Payment" matches "Payment Initiation")
- `primaryCategory()` returns `cats.get(cats.size()-1)` (most specific subcategory) — this may not match the top-level category names used in `PRESET_CATEGORIES`

## Rebuilding

After any Java source change: `cd java && mvn package -DskipTests`

---

## Switching from Plaid Sandbox → Production

### What Changes

1. **`java/.env`** — two env vars:
   ```
   PLAID_ENV=production        # was: sandbox
   PLAID_SECRET=<prod-secret>  # different key from sandbox; get from Plaid dashboard → Team → Keys
   ```
   `PLAID_CLIENT_ID` stays the same.

2. **`LinkTokenResource.java`** — change client name:
   ```java
   .clientName("Plutus")       // was: "Quickstart Client"
   ```

3. **Remove sandbox-only products** from `PLAID_PRODUCTS` if not approved:
   - `signal` requires separate Plaid approval
   - Start with just `transactions` or `transactions,auth` for production

4. **`PLAID_REDIRECT_URI`** — must be set to your deployed frontend URL (e.g. `https://plutus.yourdomain.com/dashboard`) if using OAuth-based institutions (Chase, Wells Fargo, etc.)

5. **Apply for Plaid production access** at https://dashboard.plaid.com — requires:
   - App description, use case, privacy policy URL
   - Estimated transaction volume
   - Review takes 2–7 business days

6. **Set up Plaid webhooks** — production transactions are not immediately available; Plaid fires `TRANSACTIONS_SYNC_UPDATES_AVAILABLE` when new data arrives. Without this, users see stale data until they refresh.

7. **Update Plaid webhook URL** in the Plaid dashboard to your backend's `/api/plaid_webhook` endpoint (endpoint not yet built — see TODO).

### What Does NOT Change

- Supabase config (same URL and keys)
- Frontend code (no changes needed)
- Plaid Java SDK version
- Auth flow
- All Supabase schema

### Test Before Go-Live

- Connect a real bank account in production and verify transactions load
- Test with an OAuth institution (Chase) — requires the redirect URI to be set correctly
- Verify the Plaid Link modal shows "Plutus" not "Quickstart Client"
- Check that `plaid_access_token` stored in Supabase is a production token (starts with `access-production-`)

---

## Deployment Notes

### Frontend (Vercel)
- `frontend/vercel.json` exists and routes `/api/*` to backend
- Set env vars in Vercel dashboard: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `frontend/public/_redirects` handles SPA routing on Netlify if used instead

### Backend (Java)
- No Dockerfile — manual deployment currently; containerize with Docker for cloud hosting
- Needs a persistent server (Railway, Fly.io, EC2, etc.) — not serverless-friendly due to in-memory token map
- Set all `java/.env` vars as server environment variables in production
- The in-memory `userTokens` map is lost on restart — fine because `resolveAccessToken` falls back to Supabase, but first request after restart per user pays a Supabase lookup

### No CI/CD pipeline exists — all deployments are manual
