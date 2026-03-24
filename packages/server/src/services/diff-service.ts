import { query } from '../db/connection.js';
import { broadcast } from '../ws/broadcast.js';
import { createEvent } from './event-service.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface DiffRow {
  id: string;
  task_id: string;
  diff_content: string;
  files_changed: unknown[];
  additions: number;
  deletions: number;
  created_at: string;
}

export interface SubmitDiffData {
  diff_content: string;
  files_changed: unknown[];
  additions: number;
  deletions: number;
}

// ─── Service ─────────────────────────────────────────────────────────

/**
 * Submit a diff for a task.
 */
export async function submitDiff(taskId: string, data: SubmitDiffData): Promise<DiffRow> {
  const result = await query<DiffRow>(
    `INSERT INTO diffs (task_id, diff_content, files_changed, additions, deletions)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      taskId,
      data.diff_content,
      JSON.stringify(data.files_changed),
      data.additions,
      data.deletions,
    ],
  );

  const diff = result.rows[0];

  await createEvent(taskId, null, 'diff_ready', {
    diff_id: diff.id,
    additions: diff.additions,
    deletions: diff.deletions,
    files_count: data.files_changed.length,
  });

  broadcast('diffs', 'diff.ready', diff);

  return diff;
}

/**
 * Get all diffs for a task, most recent first.
 */
export async function getDiffs(taskId: string): Promise<DiffRow[]> {
  const result = await query<DiffRow>(
    'SELECT * FROM diffs WHERE task_id = $1 ORDER BY created_at DESC',
    [taskId],
  );

  return result.rows;
}
