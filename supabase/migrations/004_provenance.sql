-- ============================================================
-- 004_provenance.sql
-- NJ Facilities Procurement Platform — Data provenance fields
-- Run this entire file in the Supabase SQL editor.
--
-- Note: The earlier migrations set up GRANT SELECT to anon and
-- authenticated on these tables via ALTER DEFAULT PRIVILEGES.
-- New columns inherit the parent table's grants automatically,
-- so no new GRANT statements are strictly required. They are
-- included below defensively to be explicit.
-- ============================================================

-- ── contracts table ─────────────────────────────────────────
-- verified_at: date the data was spot-checked against the co-op's published award list
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS verified_at date;

-- verified_by: name or role of the person who verified this record
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS verified_by text;

-- award_doc_url: URL to the public award document or bid tab published by the cooperative
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS award_doc_url text;

-- ── institution_contracts table ─────────────────────────────
-- verified_at: date the shared contract data was checked for accuracy
ALTER TABLE institution_contracts ADD COLUMN IF NOT EXISTS verified_at date;

-- verified_by: name/role of person who verified this record
ALTER TABLE institution_contracts ADD COLUMN IF NOT EXISTS verified_by text;

-- statutory_basis: NJ procurement law mechanism under which piggybacking is authorized
ALTER TABLE institution_contracts ADD COLUMN IF NOT EXISTS statutory_basis text;

-- dlgs_registration_number: DLGS cooperative pricing system registration #, if applicable
ALTER TABLE institution_contracts ADD COLUMN IF NOT EXISTS dlgs_registration_number text;

-- ── Defensive grants ────────────────────────────────────────
-- These are inherited from the table-level grants set in earlier migrations,
-- but included here for documentation and to survive any future RLS policy refresh.
GRANT SELECT ON contracts TO anon, authenticated;
GRANT SELECT ON institution_contracts TO anon, authenticated;
