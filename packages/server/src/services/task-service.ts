import { query } from '../db/connection.js';
import { broadcast } from '../ws/broadcast.js';
import { createEvent } from './event-service.js';
import { sendNotification } from '../messaging/notifications.js';
import type { PlanRow } from './plan-service.js';

// ─── Types ───────────────────────────────────────────────────────────

export type TaskStatus =
  | 'queued' | 'planning' | 'awaiting_approval' | 'executing'
  | 'awaiting_review' | 'merging' | 'completed' | 'errored' | 'rejected' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TaskAttachmentRow {
  id: string;
  task_id: string;
  filename: string;
  content_type: string;
  file_size: number;
  created_at: string;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  model_tier: string;
  target_branch: string;
  parent_task_id: string | null;
  attachments?: TaskAttachmentRow[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  priority?: TaskPriority;
  target_branch?: string;
  model_tier?: string;
  repo_id?: string;
}

export interface ListTasksFilters {
  status?: TaskStatus | TaskStatus[];
  /** Alias for status — accepts an array of statuses (used by some routes) */
  statuses?: string[];
  limit?: number;
  repo_id?: string;
}

export interface UpdateTaskFields {
  title?: string;
  description?: string;
  priority?: string;
}

// ─── State Machine ───────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  queued:             ['planning', 'cancelled'],
  planning:           ['awaiting_approval', 'cancelled', 'errored'],
  awaiting_approval:  ['planning', 'executing', 'rejected', 'cancelled'],
  executing:          ['awaiting_review', 'errored', 'cancelled'],
  awaiting_review:    ['merging', 'executing', 'rejected', 'cancelled'],
  merging:            ['completed', 'errored', 'cancelled'],
  // Terminal states — no outgoing transitions
  completed:          [],
  errored:            [],
  rejected:           [],
  cancelled:          [],
};

const TERMINAL_STATES: Set<TaskStatus> = new Set(['completed', 'errored', 'rejected', 'cancelled'] as const);

const ALL_STATUSES: Set<TaskStatus> = new Set([
  'queued', 'planning', 'awaiting_approval', 'executing',
  'awaiting_review', 'merging', 'completed', 'errored', 'rejected', 'cancelled',
] as const);

/**
 * Map a status transition to its corresponding event type.
 */
function eventTypeForTransition(from: TaskStatus, to: TaskStatus): string {
  if (to === 'planning' && from === 'queued') return 'task_assigned';
  if (to === 'planning' && from === 'awaiting_approval') return 'plan_rejected';
  if (to === 'awaiting_approval') return 'plan_submitted';
  if (to === 'executing' && from === 'awaiting_approval') return 'execution_started';
  if (to === 'executing' && from === 'awaiting_review') return 'review_changes_requested';
  if (to === 'awaiting_review') return 'execution_completed';
  if (to === 'merging') return 'merge_started';
  if (to === 'completed') return 'task_completed';
  if (to === 'errored') return 'task_errored';
  if (to === 'rejected') return 'task_rejected';
  if (to === 'cancelled') return 'task_cancelled';
  return 'task_assigned';
}

// ─── Service ─────────────────────────────────────────────────────────

/**
 * Create a new task.
 */
export async function createTask(data: CreateTaskData): Promise<TaskRow> {
  const result = await query<TaskRow>(
    `INSERT INTO tasks (title, description, priority, target_branch, model_tier, repo_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.title,
      data.description ?? '',
      data.priority ?? 'medium',
      data.target_branch ?? 'main',
      data.model_tier ?? 'default',
      data.repo_id ?? null,
    ],
  );

  const task = result.rows[0];

  await createEvent(task.id, null, 'task_created', {
    title: task.title,
    priority: task.priority,
  });

  broadcast('tasks', 'task.created', task);

  return task;
}

/**
 * Create a new task with file attachments.
 */
export async function createTaskWithAttachments(
  data: CreateTaskData,
  files: Express.Multer.File[]
): Promise<TaskRow> {
  // Create the task first
  const task = await createTask(data);

  // Process and store attachments
  const attachmentPromises = files.map(async (file) => {
    const result = await query<TaskAttachmentRow>(
      `INSERT INTO task_attachments (task_id, filename, content_type, file_size, file_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, task_id, filename, content_type, file_size, created_at`,
      [
        task.id,
        file.originalname,
        file.mimetype,
        file.size,
        file.buffer,
      ]
    );
    return result.rows[0];
  });

  const attachments = await Promise.all(attachmentPromises);

  // Return task with attachments
  return {
    ...task,
    attachments,
  };
}

/**
 * Get a task by ID. Throws if not found.
 */
export async function getTask(id: string): Promise<TaskRow> {
  const taskResult = await query<TaskRow>('SELECT * FROM tasks WHERE id = $1', [id]);

  if (taskResult.rows.length === 0) {
    throw new Error(`Task not found: ${id}`);
  }

  const task = taskResult.rows[0];

  // Fetch attachments for the task
  const attachmentResult = await query<TaskAttachmentRow>(
    'SELECT id, task_id, filename, content_type, file_size, created_at FROM task_attachments WHERE task_id = $1 ORDER BY created_at ASC',
    [id]
  );

  return {
    ...task,
    attachments: attachmentResult.rows,
  };
}

/**
 * List tasks with optional filters.
 * Ordered by priority DESC (critical > high > medium > low), then created_at ASC.
 */
export async function listTasks(filters: ListTasksFilters = {}): Promise<TaskRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  // Merge status and statuses into a single array
  let statusList: string[] | undefined;
  if (filters.statuses && filters.statuses.length > 0) {
    statusList = filters.statuses;
  } else if (filters.status) {
    statusList = Array.isArray(filters.status) ? filters.status : [filters.status];
  }

  if (statusList && statusList.length > 0) {
    const placeholders = statusList.map(() => `$${paramIdx++}`);
    conditions.push(`status IN (${placeholders.join(', ')})`);
    params.push(...statusList);
  }

  if (filters.repo_id) {
    conditions.push(`repo_id = $${paramIdx++}`);
    params.push(filters.repo_id);
  }

  const limit = filters.limit ?? 100;
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<TaskRow & { attachment_count?: number }>(
    `SELECT t.*,
       (SELECT COUNT(*) FROM task_attachments ta WHERE ta.task_id = t.id) as attachment_count
     FROM tasks t ${where}
     ORDER BY
       CASE t.priority
         WHEN 'critical' THEN 0
         WHEN 'high'     THEN 1
         WHEN 'medium'   THEN 2
         WHEN 'low'      THEN 3
       END ASC,
       t.created_at ASC
     LIMIT $${paramIdx}`,
    [...params, limit],
  );

  return result.rows.map(row => {
    const { attachment_count, ...task } = row;
    return {
      ...task,
      attachments: [], // Don't load full attachments in list view for performance
      attachment_count: Number(attachment_count || 0),
    };
  });
}

/**
 * Transition a task to a new status. Validates the transition against the state machine.
 * Throws an Error if the transition is invalid.
 * Accepts status as a string (validated at runtime) for route compatibility.
 */
export async function updateTaskStatus(
  id: string,
  newStatus: string,
  reason?: string,
): Promise<TaskRow> {
  if (!ALL_STATUSES.has(newStatus as TaskStatus)) {
    throw new Error(`Invalid status: '${newStatus}'`);
  }

  const typedStatus = newStatus as TaskStatus;
  const task = await getTask(id);
  const allowed = VALID_TRANSITIONS[task.status];

  if (!allowed || !allowed.includes(typedStatus)) {
    throw new Error(
      `Invalid transition: cannot move task from '${task.status}' to '${typedStatus}'`,
    );
  }

  const isTerminal = TERMINAL_STATES.has(typedStatus);

  const result = await query<TaskRow>(
    `UPDATE tasks
     SET status = $1,
         completed_at = CASE WHEN $2 THEN now() ELSE completed_at END
     WHERE id = $3
     RETURNING *`,
    [typedStatus, isTerminal, id],
  );

  const updated = result.rows[0];
  if (!updated) {
    throw new Error(`Task ${id} disappeared during status update (concurrent delete?)`);
  }

  const evtType = eventTypeForTransition(task.status, typedStatus);
  await createEvent(updated.id, null, evtType as any, {
    from: task.status,
    to: typedStatus,
    ...(reason ? { reason } : {}),
  });

  broadcast('tasks', 'task.updated', updated);

  // Dispatch messaging notifications for key transitions (fire-and-forget)
  dispatchNotification(task.status, typedStatus, updated).catch((err) => {
    console.error(`Notification dispatch failed for task ${id}:`, err);
  });

  return updated;
}

/**
 * Dispatch notifications for key task transitions.
 * Async, fire-and-forget — never blocks the status update.
 */
async function dispatchNotification(
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  task: TaskRow,
): Promise<void> {
  switch (toStatus) {
    case 'awaiting_approval': {
      // Plan is ready for review — fetch latest plan for notification
      const planResult = await query<PlanRow>(
        'SELECT * FROM plans WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1',
        [task.id],
      );
      if (planResult.rows[0]) {
        await sendNotification('plan_ready', task, { plan: planResult.rows[0] });
      }
      break;
    }
    case 'awaiting_review': {
      // Diff is ready for review — fetch latest diff for notification
      const diffResult = await query<{ additions: number; deletions: number; files_changed: unknown[] }>(
        'SELECT additions, deletions, files_changed FROM diffs WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1',
        [task.id],
      );
      if (diffResult.rows[0]) {
        await sendNotification('review_ready', task, { diff: diffResult.rows[0] });
      }
      break;
    }
    case 'completed': {
      const diffResult = await query<{ additions: number; deletions: number; files_changed: unknown[] }>(
        'SELECT additions, deletions, files_changed FROM diffs WHERE task_id = $1 ORDER BY created_at DESC LIMIT 1',
        [task.id],
      );
      if (diffResult.rows[0]) {
        await sendNotification('merge_completed', task, { diff: diffResult.rows[0] });
      }
      break;
    }
    case 'errored': {
      await sendNotification('task_errored', task, { error: 'Task errored' });
      break;
    }
  }
}

/**
 * Update non-status fields on a task (title, description, priority).
 */
export async function updateTask(id: string, fields: UpdateTaskFields): Promise<TaskRow> {
  // Ensure the task exists
  await getTask(id);

  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (fields.title !== undefined) {
    setClauses.push(`title = $${paramIdx++}`);
    params.push(fields.title);
  }

  if (fields.description !== undefined) {
    setClauses.push(`description = $${paramIdx++}`);
    params.push(fields.description);
  }

  if (fields.priority !== undefined) {
    setClauses.push(`priority = $${paramIdx++}`);
    params.push(fields.priority);
  }

  if (setClauses.length === 0) {
    return getTask(id);
  }

  const result = await query<TaskRow>(
    `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    [...params, id],
  );

  const updated = result.rows[0];
  if (!updated) {
    throw new Error(`Task ${id} disappeared during update (concurrent delete?)`);
  }
  broadcast('tasks', 'task.updated', updated);

  return updated;
}

/**
 * Delete a task. Only allowed if the task is in 'queued' status.
 */
export async function deleteTask(id: string): Promise<void> {
  const task = await getTask(id);

  if (task.status !== 'queued') {
    throw new Error(`Cannot delete task in '${task.status}' status — only queued tasks can be deleted`);
  }

  await createEvent(task.id, null, 'task_rejected', {
    reason: 'Task deleted while queued',
    title: task.title,
  });

  await query('DELETE FROM tasks WHERE id = $1', [id]);

  broadcast('tasks', 'task.updated', { id, deleted: true });
}
