import { query } from '../db/connection.js';
import { broadcast } from '../ws/broadcast.js';
import { createEvent } from './event-service.js';

// ─── Types ───────────────────────────────────────────────────────────

export type SlotStatus = 'idle' | 'claimed' | 'active' | 'cleaning' | 'quarantined';

export interface SlotRow {
  id: string;
  slot_number: number;
  status: SlotStatus;
  worktree_path: string;
  branch_name: string | null;
  current_task_id: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateSlotFields {
  status?: SlotStatus;
  branch_name?: string | null;
}

// ─── Service ─────────────────────────────────────────────────────────

/**
 * List all slots ordered by slot_number.
 */
export async function listSlots(): Promise<SlotRow[]> {
  const result = await query<SlotRow>('SELECT * FROM slots ORDER BY slot_number');
  return result.rows;
}

/**
 * Atomically claim a specific slot (by slotId) for a given task.
 * Uses SELECT ... FOR UPDATE SKIP LOCKED to prevent race conditions.
 *
 * Call signatures:
 *   claimSlot(slotId, taskId, daemonId) — claim a specific slot
 *   claimSlot(taskId, daemonId)         — claim any idle slot (first available)
 */
export async function claimSlot(
  slotIdOrTaskId: string,
  taskIdOrDaemonId: string,
  daemonId?: string,
): Promise<SlotRow> {
  let _slotId: string | undefined;
  let _taskId: string;
  let _daemonId: string;

  if (daemonId !== undefined) {
    // 3-arg form: claimSlot(slotId, taskId, daemonId)
    _slotId = slotIdOrTaskId;
    _taskId = taskIdOrDaemonId;
    _daemonId = daemonId;
  } else {
    // 2-arg form: claimSlot(taskId, daemonId) — any idle slot
    _taskId = slotIdOrTaskId;
    _daemonId = taskIdOrDaemonId;
  }

  let result;

  if (_slotId) {
    // Claim a specific slot
    result = await query<SlotRow>(
      `UPDATE slots
       SET status = 'claimed',
           current_task_id = $1,
           claimed_at = now()
       WHERE id = $2 AND status = 'idle'
       RETURNING *`,
      [_taskId, _slotId],
    );
  } else {
    // Claim the first available idle slot
    result = await query<SlotRow>(
      `UPDATE slots
       SET status = 'claimed',
           current_task_id = $1,
           claimed_at = now()
       WHERE id = (
         SELECT id FROM slots
         WHERE status = 'idle'
         ORDER BY slot_number
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [_taskId],
    );
  }

  if (result.rows.length === 0) {
    throw new Error('No idle slots available');
  }

  const slot = result.rows[0];

  await createEvent(_taskId, slot.id, 'slot_claimed', {
    slot_number: slot.slot_number,
    daemon_id: _daemonId,
  });

  broadcast('slots', 'slot.updated', slot);

  return slot;
}

/**
 * Release a slot back to idle, clearing task assignment.
 */
export async function releaseSlot(slotId: string): Promise<SlotRow> {
  const result = await query<SlotRow>(
    `UPDATE slots
     SET status = 'idle',
         current_task_id = NULL,
         branch_name = NULL,
         claimed_at = NULL
     WHERE id = $1
     RETURNING *`,
    [slotId],
  );

  if (result.rows.length === 0) {
    throw new Error(`Slot not found: ${slotId}`);
  }

  const slot = result.rows[0];

  await createEvent(null, slot.id, 'slot_released', {
    slot_number: slot.slot_number,
  });

  broadcast('slots', 'slot.updated', slot);

  return slot;
}

/**
 * Update a slot's mutable fields (status, branch_name).
 */
export async function updateSlot(slotId: string, fields: UpdateSlotFields): Promise<SlotRow> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (fields.status !== undefined) {
    setClauses.push(`status = $${paramIdx++}`);
    params.push(fields.status);
  }

  if (fields.branch_name !== undefined) {
    setClauses.push(`branch_name = $${paramIdx++}`);
    params.push(fields.branch_name);
  }

  if (setClauses.length === 0) {
    const result = await query<SlotRow>('SELECT * FROM slots WHERE id = $1', [slotId]);
    if (result.rows.length === 0) throw new Error(`Slot not found: ${slotId}`);
    return result.rows[0];
  }

  const result = await query<SlotRow>(
    `UPDATE slots SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    [...params, slotId],
  );

  if (result.rows.length === 0) {
    throw new Error(`Slot not found: ${slotId}`);
  }

  const slot = result.rows[0];
  broadcast('slots', 'slot.updated', slot);

  return slot;
}

/**
 * Create a new slot entry.
 */
export async function createSlot(slotNumber: number, worktreePath: string): Promise<SlotRow> {
  const result = await query<SlotRow>(
    `INSERT INTO slots (slot_number, worktree_path)
     VALUES ($1, $2)
     RETURNING *`,
    [slotNumber, worktreePath],
  );

  return result.rows[0];
}
