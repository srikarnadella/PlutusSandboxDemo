# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the official Plaid quickstart repository. It has multiple backend implementations (Java, Python, Node, Go, Ruby) that all share a single React/Vite frontend. The frontend runs on port 3000 and proxies all `/api` requests to the backend on port 8000.

## Java Backend Setup

```bash
# 1. Fill in credentials (already done if .env exists with values)
cp .env.example .env   # then edit PLAID_CLIENT_ID and PLAID_SECRET

# 2. Build
cd java && mvn package -DskipTests

# 3. Run (from the java/ directory)
env $(cat ../.env | grep -v "#" | xargs) java -jar target/quickstart-1.0-SNAPSHOT.jar server config.yml
# or just: ./start.sh  (reads ../.env automatically)
```

## Frontend Setup

```bash
cd frontend && npm install && npm start
# runs on http://localhost:3000
```

Run the Java backend first, then the frontend. The Vite dev server proxies `/api/*` → `http://127.0.0.1:8000`.

## Architecture

### Java backend (`java/`)
- **Framework**: Dropwizard, runs on port 8000 (`/api` root path)
- **Entry point**: `QuickstartApplication.java` — wires up the Plaid API client and registers all resource classes
- **Config**: `config.yml` reads env vars (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `PLAID_PRODUCTS`, `PLAID_COUNTRY_CODES`, `PLAID_REDIRECT_URI`)
- **Resources** (`src/main/java/com/plaid/quickstart/resources/`): one class per API endpoint (e.g. `LinkTokenResource`, `PublicTokenResource`, `TransactionsResource`, etc.)
- State (access token, item ID) is stored in static fields on `QuickstartApplication` — fine for dev, not for production

### Frontend (`frontend/`)
- React + TypeScript, bundled with Vite
- `App.tsx` — main component, orchestrates the Plaid Link flow
- `dataUtilities.ts` — helpers for formatting API responses into display tables

## Plaid Flow

1. `POST /api/create_link_token` → frontend opens Plaid Link widget
2. User picks institution → Plaid returns `public_token` via JS callback
3. `POST /api/set_access_token` with `{public_token}` → backend exchanges for `access_token`
4. Frontend calls product endpoints (`/api/auth`, `/api/transactions`, `/api/identity`, etc.)

## Environment Variables

| Var | Value |
|---|---|
| `PLAID_ENV` | `sandbox` (or `production`) |
| `PLAID_CLIENT_ID` | from Plaid dashboard |
| `PLAID_SECRET` | sandbox or production secret |
| `PLAID_PRODUCTS` | comma-separated, e.g. `auth,transactions,signal` |
| `PLAID_COUNTRY_CODES` | comma-separated, e.g. `US,CA` |
| `PLAID_REDIRECT_URI` | optional, for OAuth institutions |
| `SIGNAL_RULESET_KEY` | optional, for Signal product |

## Rebuilding

After any Java source change: `cd java && mvn package -DskipTests`
