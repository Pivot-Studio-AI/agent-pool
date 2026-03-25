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
  review_feedback: string | null;
  summary: string | null;
  compliance: Record<string, unknown> | null;
  audit: Record<string, unknown> | null;
  created_at: string;
}

export interface SubmitDiffData {
  diff_content: string;
  files_changed: unknown[];
  additions: number;
  deletions: number;
  summary?: string;
  compliance?: Record<string, unknown>;
  audit?: Record<string, unknown>;
}

// ─── Service ─────────────────────────────────────────────────────────

/**
 * Submit a diff for a task.
 */
export async function submitDiff(taskId: string, data: SubmitDiffData): Promise<DiffRow> {
  const result = await query<DiffRow>(
    `INSERT INTO diffs (task_id, diff_content, files_changed, additions, deletions, summary, compliance, audit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      taskId,
      data.diff_content,
      JSON.stringify(data.files_changed),
      data.additions,
      data.deletions,
      data.summary ?? null,
      data.compliance ? JSON.stringify(data.compliance) : null,
      data.audit ? JSON.stringify(data.audit) : null,
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

/**
 * Store review feedback on the latest diff for a task.
 * Throws if no diff exists for the task.
 */
export async function storeReviewFeedback(taskId: string, feedback: string): Promise<void> {
  const latest = await query<{ id: string }>(
    'SELECT id FROM diffs WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1',
    [taskId],
  );

  if (latest.rows.length === 0) {
    throw new Error(`No diffs found for task ${taskId}`);
  }

  await query(
    'UPDATE diffs SET review_feedback = $1 WHERE id = $2',
    [feedback, latest.rows[0].id],
  );
}

/**
 * Get the review feedback from the latest diff for a task.
 */
export async function getLatestDiffFeedback(taskId: string): Promise<string | null> {
  const result = await query<{ review_feedback: string | null }>(
    `SELECT review_feedback FROM diffs WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [taskId],
  );
  return result.rows[0]?.review_feedback ?? null;
}
