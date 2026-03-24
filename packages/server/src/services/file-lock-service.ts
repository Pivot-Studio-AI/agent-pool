import { query } from '../db/connection.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface FileLockRow {
  id: string;
  task_id: string;
  file_path: string;
  lock_type: string;
  locked_at: string;
}

export interface ConflictInfo {
  filePath: string;
  taskId: string;
  taskTitle: string;
}

// ─── Service ─────────────────────────────────────────────────────────

/**
 * Acquire file locks for a task. Uses ON CONFLICT DO NOTHING so
 * re-acquiring the same lock is idempotent.
 */
export async function acquireLocks(taskId: string, filePaths: string[]): Promise<FileLockRow[]> {
  if (filePaths.length === 0) return [];

  const locks: FileLockRow[] = [];

  for (const filePath of filePaths) {
    const result = await query<FileLockRow>(
      `INSERT INTO file_locks (task_id, file_path)
       VALUES ($1, $2)
       ON CONFLICT (file_path, task_id) DO NOTHING
       RETURNING *`,
      [taskId, filePath],
    );

    if (result.rows.length > 0) {
      locks.push(result.rows[0]);
    }
  }

  return locks;
}

/**
 * Release all file locks held by a task.
 */
export async function releaseLocks(taskId: string): Promise<void> {
  await query('DELETE FROM file_locks WHERE task_id = $1', [taskId]);
}

/**
 * Check for file conflicts: find active locks on the given paths held
 * by other tasks (optionally excluding one task).
 */
export async function checkConflicts(
  filePaths: string[],
  excludeTaskId?: string,
): Promise<ConflictInfo[]> {
  if (filePaths.length === 0) return [];

  const placeholders = filePaths.map((_, i) => `$${i + 1}`).join(', ');
  const params: unknown[] = [...filePaths];

  let excludeClause = '';
  if (excludeTaskId) {
    excludeClause = `AND fl.task_id != $${params.length + 1}`;
    params.push(excludeTaskId);
  }

  const result = await query<{ file_path: string; task_id: string; title: string }>(
    `SELECT fl.file_path, fl.task_id, t.title
     FROM file_locks fl
     JOIN tasks t ON t.id = fl.task_id
     WHERE fl.file_path IN (${placeholders})
     ${excludeClause}`,
    params,
  );

  return result.rows.map((row) => ({
    filePath: row.file_path,
    taskId: row.task_id,
    taskTitle: row.title,
  }));
}
