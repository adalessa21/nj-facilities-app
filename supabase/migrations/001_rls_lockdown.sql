-- ============================================================
-- 001_rls_lockdown.sql
-- NJ Facilities Procurement Platform — RLS lockdown
--
-- Run this entire file in the Supabase SQL editor.
-- Safe to re-run: uses CREATE OR REPLACE / IF NOT EXISTS / DROP IF EXISTS.
--
-- Execution order matters:
--   1. Schema changes  (ADD COLUMN)
--   2. Helper function (get_caller_entity_id)
--   3. Trigger         (force approved_by_admin = false on INSERT)
--   4. Enable RLS
--   5. SELECT policies (public read)
--   6. Write policies  (restricted)
-- ============================================================


-- ============================================================
-- 1. Schema: add entity_id to institution_contracts
--    Nullable UUID FK — existing rows keep NULL until backfilled.
--    New rows from the app will populate it going forward.
-- ============================================================

ALTER TABLE institution_contracts
  ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES entities(id);


-- ============================================================
-- 2. Helper: resolve the JWT caller's entity
--
-- Takes auth.jwt()->>'email', splits off the domain, and looks up
-- entities.email_domain. Returns NULL if no match or not logged in.
-- SECURITY DEFINER so it runs as the function owner, not the caller,
-- which lets it query entities even when the caller is anon.
-- SET search_path = public prevents search-path hijacking.
-- ============================================================

CREATE OR REPLACE FUNCTION get_caller_entity_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id
  FROM   entities
  WHERE  email_domain = split_part(
           COALESCE(auth.jwt() ->> 'email', ''),
           '@',
           2
         )
  LIMIT  1;
$$;


-- ============================================================
-- 3. Trigger: force approved_by_admin = false on every INSERT
--
-- Prevents any client — anon or authenticated — from self-approving
-- a contract by including approved_by_admin: true in the payload.
-- Approval must happen via the admin portal (service-role key).
-- ============================================================

CREATE OR REPLACE FUNCTION _force_approved_false_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.approved_by_admin := false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS institution_contracts_force_unapproved
  ON institution_contracts;

CREATE TRIGGER institution_contracts_force_unapproved
  BEFORE INSERT ON institution_contracts
  FOR EACH ROW
  EXECUTE FUNCTION _force_approved_false_on_insert();


-- ============================================================
-- 4. Enable RLS on all six tables
-- ============================================================

ALTER TABLE entities              ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooperatives          ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors               ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships           ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_contracts ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 5. Public SELECT — the platform data is public to read
-- ============================================================

-- Drop first so re-runs don't error on duplicate names
DROP POLICY IF EXISTS "entities_public_read"              ON entities;
DROP POLICY IF EXISTS "cooperatives_public_read"          ON cooperatives;
DROP POLICY IF EXISTS "vendors_public_read"               ON vendors;
DROP POLICY IF EXISTS "contracts_public_read"             ON contracts;
DROP POLICY IF EXISTS "memberships_public_read"           ON memberships;
DROP POLICY IF EXISTS "institution_contracts_public_read" ON institution_contracts;

-- Anyone (anon or authenticated) can SELECT from these tables
CREATE POLICY "entities_public_read"
  ON entities FOR SELECT
  USING (true);
  -- Reason: institution list powers the dropdown; no sensitive data.

CREATE POLICY "cooperatives_public_read"
  ON cooperatives FOR SELECT
  USING (true);
  -- Reason: co-op list is shown publicly on the main platform.

CREATE POLICY "vendors_public_read"
  ON vendors FOR SELECT
  USING (true);
  -- Reason: vendor names and contact info are already public.

CREATE POLICY "contracts_public_read"
  ON contracts FOR SELECT
  USING (true);
  -- Reason: contract data is public procurement information.

CREATE POLICY "memberships_public_read"
  ON memberships FOR SELECT
  USING (true);
  -- Reason: memberships drive the eligibility filter; must be readable by
  -- the anon client to filter contracts by institution.

CREATE POLICY "institution_contracts_public_read"
  ON institution_contracts FOR SELECT
  USING (true);
  -- Reason: approved shared contracts appear publicly on the platform.


-- ============================================================
-- 6. Write policies — restricted
--
-- entities, cooperatives, vendors, contracts:
--   NO write policies at all → effectively denied for anon and
--   authenticated users with the anon key. Admin operations on
--   these tables require the service-role key (next task).
-- ============================================================


-- ── memberships ────────────────────────────────────────────────────────────
-- Authenticated users can INSERT / UPDATE / DELETE memberships, but only
-- for their own institution (entity_id must match their resolved entity).
-- This powers app/my-institution/page.tsx membership self-management.

DROP POLICY IF EXISTS "memberships_insert_own" ON memberships;
DROP POLICY IF EXISTS "memberships_update_own" ON memberships;
DROP POLICY IF EXISTS "memberships_delete_own" ON memberships;

CREATE POLICY "memberships_insert_own"
  ON memberships FOR INSERT
  TO authenticated
  WITH CHECK (entity_id = get_caller_entity_id());
  -- Reason: users may only add co-op memberships for their own institution.

CREATE POLICY "memberships_update_own"
  ON memberships FOR UPDATE
  TO authenticated
  USING     (entity_id = get_caller_entity_id())
  WITH CHECK (entity_id = get_caller_entity_id());
  -- Reason: users may only modify their own institution's membership rows.

CREATE POLICY "memberships_delete_own"
  ON memberships FOR DELETE
  TO authenticated
  USING (entity_id = get_caller_entity_id());
  -- Reason: users may only remove their own institution's membership rows.


-- ── institution_contracts ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "institution_contracts_public_insert"  ON institution_contracts;
DROP POLICY IF EXISTS "institution_contracts_update_own"     ON institution_contracts;
DROP POLICY IF EXISTS "institution_contracts_delete_own"     ON institution_contracts;

-- Anyone (anon or authenticated) may INSERT a contract submission.
-- The BEFORE INSERT trigger above forces approved_by_admin = false,
-- so no client can self-approve regardless of what it sends.
CREATE POLICY "institution_contracts_public_insert"
  ON institution_contracts FOR INSERT
  WITH CHECK (true);
  -- Reason: the public form at /piggyback allows anonymous submissions.

-- Authenticated users may UPDATE only their own institution's contracts.
-- entity_id is populated by the app when the user is logged in.
CREATE POLICY "institution_contracts_update_own"
  ON institution_contracts FOR UPDATE
  TO authenticated
  USING     (entity_id = get_caller_entity_id())
  WITH CHECK (entity_id = get_caller_entity_id());
  -- Reason: institutions should be able to correct their own contract data
  -- (editing via /my-institution), but not other institutions' rows.

-- Authenticated users may DELETE only their own institution's contracts.
CREATE POLICY "institution_contracts_delete_own"
  ON institution_contracts FOR DELETE
  TO authenticated
  USING (entity_id = get_caller_entity_id());
  -- Reason: same ownership principle as UPDATE.
