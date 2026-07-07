-- ============================================================
-- 002_admin_auth.sql
-- NJ Facilities Procurement Platform — Admin user registry
--
-- Run this entire file in the Supabase SQL editor.
--
-- After running, add yourself as admin:
-- INSERT INTO admin_users (email) VALUES ('your@email.com');
-- ============================================================

-- ── admin_users table ──────────────────────────────────────
-- Stores the list of email addresses that are allowed to
-- access the admin portal. RLS is enabled with NO policies,
-- so only the service-role key (bypasses RLS) can read it.
-- The anon key and authenticated users cannot query this table.

CREATE TABLE IF NOT EXISTS admin_users (
  email      text        PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- No policies added — effective deny for anon + authenticated.
-- Only the service-role key (used by lib/supabase-admin.ts) can read.

-- ── Add yourself ───────────────────────────────────────────
-- Uncomment and edit the line below, then run it separately
-- after the table is created:
--
-- INSERT INTO admin_users (email) VALUES ('you@yourinstitution.edu');
