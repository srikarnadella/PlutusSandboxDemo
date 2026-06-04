# Plutus

I built Plutus because I wanted to understand what was actually happening with my money, not just see a number at the end of the month. After checking out Mint and other budgeting apps that all costed money, I found myself bouncing between spreadsheets and bank apps, I decided to build a replacement from scratch. The goal was simple: connect your bank once and get a real picture of your spending, without paying $15/month for a subscription or handing your data to another aggregator you don't control.

Plutus is a full-stack personal finance dashboard powered by [Plaid](https://plaid.com) for bank connectivity and [Supabase](https://supabase.com) for auth and persistence. It pulls live transaction data, categorizes spending, detects recurring subscriptions automatically, flags unusual transactions using standard deviation analysis, and lets you set per-category budgets and savings goals that persist across sessions. The backend is a Java/Dropwizard REST API with a three-tier transaction cache (in-memory → Supabase → Plaid delta sync) so the dashboard loads fast on repeat visits. The frontend is React + TypeScript with a dark glassmorphic design — no component libraries, just inline styles to keep it portable. This is a sandbox demo connected to Plaid's test environment; bank credentials are `user_good` / `pass_good` at any institution.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Auth + DB | Supabase (GoTrue + PostgreSQL) |
| Backend | Java 11 + Dropwizard |
| Bank data | Plaid Java SDK (sandbox / production) |

---

## Setup

### Prerequisites

- Java 11+, Maven
- Node 18+
- A [Plaid developer account](https://dashboard.plaid.com/signup) (free sandbox)
- A [Supabase project](https://supabase.com) (free tier)

### 1. Clone and configure

```bash
git clone https://github.com/srikarnadella/PlutusSandboxDemo.git
cd PlutusSandboxDemo
cp .env.example java/.env
cp frontend/.env.local.example frontend/.env.local
```

Fill in `java/.env` with your Plaid and Supabase credentials, and `frontend/.env.local` with your Supabase public keys.

### 2. Create Supabase tables

Run the following in your [Supabase SQL editor](https://supabase.com/dashboard/project/_/sql):

```sql
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_access_token text,
  plaid_item_id text,
  monthly_income numeric,
  rent numeric,
  utilities numeric,
  other_fixed numeric,
  monthly_savings numeric,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON user_profiles FOR ALL USING (auth.uid() = id);

CREATE TABLE spending_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  monthly_limit numeric,
  avoid boolean DEFAULT false,
  enabled boolean DEFAULT false,
  UNIQUE(user_id, category)
);
ALTER TABLE spending_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own goals" ON spending_goals FOR ALL USING (auth.uid() = user_id);

CREATE TABLE savings_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_amount numeric NOT NULL,
  current_amount numeric NOT NULL DEFAULT 0,
  deadline date,
  emoji text DEFAULT '🎯',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own savings goals" ON savings_goals FOR ALL USING (auth.uid() = user_id);

CREATE TABLE transaction_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id text NOT NULL,
  note text NOT NULL DEFAULT '',
  tag text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, transaction_id)
);
ALTER TABLE transaction_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notes" ON transaction_notes FOR ALL USING (auth.uid() = user_id);
```

### 3. Run locally

**Backend** (port 8000):
```bash
cd java && mvn package -DskipTests && ./start.sh
```

**Frontend** (port 3000):
```bash
cd frontend && npm install && npm start
```

Open [http://localhost:3000](http://localhost:3000).

---

## Features

- **Auth** — Google OAuth + magic link via Supabase
- **Bank connection** — one-time Plaid Link setup, persisted across sessions
- **Overview** — account balances, net worth, stat cards, 6-month spending trend, category breakdown, cash flow projection
- **Transactions** — searchable/filterable list with inline notes, tags, and CSV export
- **Budgets** — per-category monthly limits with discretionary budget tracker
- **Goals** — savings goal tracker with progress bars and deadline reminders
- **Account** — income and fixed expense settings for budget calculations

---

## Plaid Sandbox

Use these credentials when testing with Plaid Link:

| Field | Value |
|---|---|
| Username | `user_good` |
| Password | `pass_good` |

---

## Environment Variables

### `java/.env`

| Variable | Description |
|---|---|
| `PLAID_CLIENT_ID` | From [Plaid Dashboard](https://dashboard.plaid.com/team/keys) |
| `PLAID_SECRET` | Sandbox or production secret |
| `PLAID_ENV` | `sandbox` or `production` |
| `PLAID_PRODUCTS` | `auth,transactions,signal` |
| `PLAID_COUNTRY_CODES` | `US,CA` |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only, never expose to browser) |

### `frontend/.env.local`

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Same Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (safe for browser) |

---

## License

MIT
