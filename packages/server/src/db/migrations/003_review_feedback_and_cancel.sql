-- Migration 003: Add review_feedback to diffs, add cancelled status, add task_cancelled event type

-- Add review_feedback column to diffs table
ALTER TABLE diffs ADD COLUMN IF NOT EXISTS review_feedback TEXT;

-- Add summary column (for future agent-generated change summaries)
ALTER TABLE diffs ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add compliance column (for plan compliance check)
ALTER TABLE diffs ADD COLUMN IF NOT EXISTS compliance JSONB;

-- Add 'cancelled' to the task_status enum
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Add 'task_cancelled' to the event_type enum
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'task_cancelled';
