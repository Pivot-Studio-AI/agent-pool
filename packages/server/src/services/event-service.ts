import { query } from '../db/connection.js';
import { broadcast } from '../ws/broadcast.js';

// ─── Types ───────────────────────────────────────────────────────────

export type EventType =
  | 'task_created' | 'task_assigned'
  | 'plan_submitted' | 'plan_approved' | 'plan_rejected'
  | 'execution_started' | 'execution_progress' | 'agent_question' | 'execution_completed'
  | 'diff_ready'
  | 'review_approved' | 'review_rejected' | 'review_changes_requested'
  | 'merge_started' | 'merge_completed' | 'merge_failed'
  | 'task_completed' | 'task_errored' | 'task_rejected'
  | 'slot_claimed' | 'slot_released'
  | 'conflict_detected';

export interface EventRow {
  id: string;
  task_id: string | null;
  slot_id: string | null;
  event_type: EventType;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ListEventsFilters {
  taskId?: string;
  task_id?: string;
  eventType?: EventType;
  type?: string;
  limit?: number;
  before?: string; // ISO-8601 timestamp
}

/** Object-style input for createEvent — used by routes */
export interface CreateEventInput {
  task_id: string | null;
  slot_id?: string | null;
  event_type: EventType;
  payload?: Record<string, unknown>;
}

// ─── Service ─────────────────────────────────────────────────────────

/**
 * Insert a new event and broadcast it over WebSocket.
 *
 * Supports two call signatures:
 *   createEvent(taskId, slotId, eventType, payload)   — positional
 *   createEvent({ task_id, slot_id?, event_type, payload? }) — object
 */
export async function createEvent(
  taskIdOrInput: string | null | CreateEventInput,
  slotId?: string | null,
  eventType?: EventType,
  payload?: Record<string, unknown>,
): Promise<EventRow> {
  let _taskId: string | null;
  let _slotId: string | null;
  let _eventType: EventType;
  let _payload: Record<string, unknown>;

  if (taskIdOrInput !== null && typeof taskIdOrInput === 'object') {
    // Object-style call
    const input = taskIdOrInput as CreateEventInput;
    _taskId = input.task_id;
    _slotId = input.slot_id ?? null;
    _eventType = input.event_type;
    _payload = input.payload ?? {};
  } else {
    // Positional call
    _taskId = taskIdOrInput as string | null;
    _slotId = slotId ?? null;
    _eventType = eventType!;
    _payload = payload ?? {};
  }

  const result = await query<EventRow>(
    `INSERT INTO events (task_id, slot_id, event_type, payload)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [_taskId, _slotId, _eventType, JSON.stringify(_payload)],
  );

  const event = result.rows[0];

  broadcast('events', 'event.new', event);

  return event;
}

/**
 * List events with optional filters, ordered by created_at DESC.
 * Accepts both camelCase and snake_case filter keys for route compatibility.
 */
export async function listEvents(filters: ListEventsFilters = {}): Promise<EventRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const taskId = filters.taskId ?? filters.task_id;
  if (taskId) {
    conditions.push(`task_id = $${paramIdx++}`);
    params.push(taskId);
  }

  const evtType = filters.eventType ?? filters.type;
  if (evtType) {
    conditions.push(`event_type = $${paramIdx++}`);
    params.push(evtType);
  }

  if (filters.before) {
    conditions.push(`created_at < $${paramIdx++}`);
    params.push(filters.before);
  }

  const limit = filters.limit ?? 100;
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<EventRow>(
    `SELECT * FROM events ${where} ORDER BY created_at DESC LIMIT $${paramIdx}`,
    [...params, limit],
  );

  return result.rows;
}
