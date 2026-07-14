-- ============================================================
-- 005_watchlists.sql
-- NJ Facilities Procurement Platform — Contract Watchlists
--
-- Run this entire file in the Supabase SQL editor.
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS.
-- ============================================================


-- ============================================================
-- 1. Table: watched_contracts
-- ============================================================

CREATE TABLE IF NOT EXISTS watched_contracts (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id        uuid        NOT NULL,
  contract_type      text        NOT NULL CHECK (contract_type IN ('cooperative', 'institution')),
  last_notified_days int,
  created_at         timestamptz DEFAULT now(),
  UNIQUE (user_id, contract_id, contract_type)
);


-- ============================================================
-- 2. Enable RLS
-- ============================================================

ALTER TABLE watched_contracts ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 3. RLS Policies — users own their rows; service_role bypasses
--    No UPDATE policy: only the cron's service-role client may
--    set last_notified_days.
-- ============================================================

DROP POLICY IF EXISTS "watched_contracts_select_own" ON watched_contracts;
DROP POLICY IF EXISTS "watched_contracts_insert_own" ON watched_contracts;
DROP POLICY IF EXISTS "watched_contracts_delete_own" ON watched_contracts;

CREATE POLICY "watched_contracts_select_own"
  ON watched_contracts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "watched_contracts_insert_own"
  ON watched_contracts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "watched_contracts_delete_own"
  ON watched_contracts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- ============================================================
-- 4. Explicit grants for authenticated role
--    (service_role has ALL via default privileges)
-- ============================================================

GRANT SELECT, INSERT, DELETE ON watched_contracts TO authenticated;
