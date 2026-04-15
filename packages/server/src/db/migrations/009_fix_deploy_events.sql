-- Fix: ensure deploy_started and deploy_completed event types exist
-- This is idempotent (IF NOT EXISTS) and runs outside transaction
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'deploy_started';
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'deploy_completed';
