-- Delete orphaned slots that have repo_id IS NULL (accumulated from pre-multi-repo daemon restarts).
-- NULL repo_id slots bypass the (slot_number, repo_id) UNIQUE constraint since NULL != NULL in SQL,
-- causing unbounded growth on every daemon restart.
DELETE FROM slots WHERE repo_id IS NULL;

-- Reset any tasks stuck in executing/planning with no active slot back to queued
-- so they get picked up on the next daemon poll.
UPDATE tasks
SET status = 'queued', updated_at = now()
WHERE status IN ('executing', 'planning')
  AND id NOT IN (
    SELECT current_task_id FROM slots
    WHERE current_task_id IS NOT NULL
      AND status IN ('claimed', 'active')
  );
