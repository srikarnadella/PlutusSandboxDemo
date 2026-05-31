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
- `resources/AccessTokenResource.java` — POST `/api/set_access_token`; accepts JSON `{ public_token, user_id }`; exchanges token with Plaid; stores in `userTokens` map + Supabase
- `resources/SpendingReviewResource.java` — POST `/api/spending_review`; full analysis pipeline (see response shape below)

### SpendingReviewResponse Fields
```
stats              — total_spent, transactions_analyzed, period
previous_month     — total_spent, transactions_analyzed
monthly_trends     — last 6 months: year, month, label, total_spent
accounts           — name, type, subtype, mask, current, available, limit
category_spending  — per-category: amount_spent, monthly_limit, avoid, transaction_count
top_merchants      — name, total_amount, visit_count (uses getMerchantName() for normalized names)
subscriptions      — name, amount, frequency, last_date, months_detected
unusual_transactions — name, amount, date, category, reason (statistical outlier detection)
goal_violations    — category, monthly_limit, amount_spent, over_by, transactions, is_avoid_category
all_transactions   — name, amount, date, category, logo_url, transaction_id
```

Token resolution: `resolveAccessToken(userId)` checks in-memory map → Supabase → global fallback.

### Supabase Schema
```sql
user_profiles (
  id uuid PK → auth.users,
  plaid_access_token text,      -- stored by backend via service role key
  plaid_item_id text,           -- also written by frontend after Plaid Link succeeds
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
3. Frontend: `POST /api/set_access_token { public_token, user_id }` → backend exchanges + stores access token in `userTokens` map AND Supabase
4. Frontend: also upserts `{ id, plaid_item_id }` directly to Supabase (belt-and-suspenders so `checkPlaidConnection` always works)
5. `POST /api/spending_review { user_id, budgets, avoid_categories, year, month }` → full analysis

## Design Principles

- **Dark glassmorphic** — background `#070b14`, cards `rgba(255,255,255,0.04–0.08)`, indigo/violet accents (`#6366f1`, `#818cf8`, `#a5b4fc`)
- **Big numbers** — stat values at 3–7rem, never require squinting
- **Merchant avatars** — colored letter circle (8-color palette keyed on first char), or Plaid `logo_url` if present
- **No Tailwind classes in SpendingReview** — all styling is inline for portability
- No comments unless the WHY is non-obvious
- No extra abstractions beyond what the task requires

## Known Gotchas

- **Plaid sandbox credentials:** `user_good` / `pass_good` at any institution
- **`unusual_transactions`** is computed by the backend but not yet surfaced in the dashboard UI
- **`goal_violations`** is computed but only used for the health grade — no dedicated alerts panel yet
- **Backend restart:** token is fetched from Supabase on first request via `resolveAccessToken`. This requires `plaid_access_token` column to exist in `user_profiles` (was missing, added 2026-05-31).
- **Port conflicts:** `start.sh` and `npm start` both auto-kill their ports before binding

## Rebuilding

After any Java source change: `cd java && mvn package -DskipTests`
