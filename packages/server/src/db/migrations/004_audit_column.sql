-- Migration 004: Add audit report column to diffs

ALTER TABLE diffs ADD COLUMN IF NOT EXISTS audit JSONB;
