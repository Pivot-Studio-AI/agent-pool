import { query } from '../db/connection.js';
import { checkConflicts } from './file-lock-service.js';

// ─── Types ───────────────────────────────────────────────────────────

interface QueuedTaskRow {
  id: string;
  title: string;
}

interface PlanManifestRow {
  file_manifest: string[];
}

// ─── Service ─────────────────────────────────────────────────────────

/**
 * Get the next queued task that can be safely assigned without file conflicts.
 *
 * Algorithm:
 * 1. Fetch queued tasks ordered by priority (critical > high > medium > low), then created_at.
 * 2. For each candidate, look up the most recent plan's file_manifest (if any).
 * 3. If a manifest exists, check for active locks on those files.
 * 4. Return the first task with no conflicts, or null if none can be assigned.
 */
export async function getNextAssignableTask(): Promise<QueuedTaskRow | null> {
  const tasksResult = await query<QueuedTaskRow>(
    `SELECT id, title FROM tasks
     WHERE status = 'queued'
     ORDER BY
       CASE priority
         WHEN 'critical' THEN 0
         WHEN 'high'     THEN 1
         WHEN 'medium'   THEN 2
         WHEN 'low'      THEN 3
       END ASC,
       created_at ASC`,
  );

  for (const task of tasksResult.rows) {
    // Check if there's a prior plan with a file manifest (e.g., from a re-queued task)
    const planResult = await query<PlanManifestRow>(
      `SELECT file_manifest FROM plans
       WHERE task_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [task.id],
    );

    if (planResult.rows.length > 0) {
      const manifest = planResult.rows[0].file_manifest;

      if (Array.isArray(manifest) && manifest.length > 0) {
        const conflicts = await checkConflicts(manifest, task.id);

        if (conflicts.length > 0) {
          // This task has file conflicts — skip and try the next one
          continue;
        }
      }
    }

    // No conflicts (or no known manifest) — this task is assignable
    return task;
  }

  return null;
}
