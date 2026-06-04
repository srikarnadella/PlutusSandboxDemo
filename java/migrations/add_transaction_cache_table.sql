-- Run this in the Supabase SQL editor.
-- Stores serialized transactions per user+item so Plaid is only called on delta sync.
-- Backend-only access (no RLS needed — service role key bypasses RLS regardless).

CREATE TABLE IF NOT EXISTS plaid_transaction_cache (
  user_id        uuid REFERENCES auth.users NOT NULL,
  item_id        text NOT NULL,
  transactions_json text NOT NULL DEFAULT '[]',
  sync_cursor    text,
  last_synced_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
