-- Run in the Supabase SQL editor (safe to re-run).
--
-- Tables in `public` are reachable through the REST API with the public anon key. Without RLS,
-- anyone could read every user's cached transactions. Without column grants, a signed-in user's
-- browser session (or an XSS payload in it) could read Plaid access tokens.
-- The backend uses the service role key, which bypasses all of this.

-- plaid_items (created earlier outside this repo; included so a fresh project matches)
CREATE TABLE IF NOT EXISTS plaid_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  item_id          text NOT NULL,
  access_token     text NOT NULL,
  institution_name text,
  institution_id   text,
  created_at       timestamptz DEFAULT now(),
  UNIQUE (user_id, item_id)
);

-- 1. Transaction cache: backend-only. RLS on with no policies = no client access at all.
ALTER TABLE plaid_transaction_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON plaid_transaction_cache FROM anon, authenticated;

-- 2. plaid_items: users may list their own banks, never see the token. Writes go through the backend.
ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON plaid_items FROM anon, authenticated;
GRANT SELECT (id, user_id, item_id, institution_name, institution_id, created_at) ON plaid_items TO authenticated;
DROP POLICY IF EXISTS "own plaid_items read" ON plaid_items;
CREATE POLICY "own plaid_items read" ON plaid_items FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 3. user_profiles: everything except plaid_access_token stays readable/writable by the owner.
REVOKE ALL ON user_profiles FROM anon;
REVOKE SELECT, INSERT, UPDATE ON user_profiles FROM authenticated;
GRANT SELECT (id, plaid_item_id, monthly_income, rent, utilities, other_fixed, monthly_savings, updated_at)
  ON user_profiles TO authenticated;
GRANT INSERT (id, plaid_item_id, monthly_income, rent, utilities, other_fixed, monthly_savings, updated_at)
  ON user_profiles TO authenticated;
-- id is included because supabase-js upserts SET every column in the payload; RLS still pins it to auth.uid()
GRANT UPDATE (id, plaid_item_id, monthly_income, rent, utilities, other_fixed, monthly_savings, updated_at)
  ON user_profiles TO authenticated;
