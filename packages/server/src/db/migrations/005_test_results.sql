-- Migration 005: Add test_results column for async QA agent results

ALTER TABLE diffs ADD COLUMN IF NOT EXISTS test_results JSONB;
