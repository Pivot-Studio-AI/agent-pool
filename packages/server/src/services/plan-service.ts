import { query } from '../db/connection.js';
import { broadcast } from '../ws/broadcast.js';
import { createEvent } from './event-service.js';

// ─── Types ───────────────────────────────────────────────────────────

export type PlanStatus = 'pending' | 'approved' | 'rejected';

export interface PlanRow {
  id: string;
  task_id: string;
  content: string;
  file_manifest: string[];
  reasoning: string;
  estimate: string;
  status: PlanStatus;
  reviewer_feedback: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface SubmitPlanData {
  content: string;
  file_manifest: string[];
  reasoning: string;
  estimate: string;
}

// ─── Service ─────────────────────────────────────────────────────────

/**
 * Submit a new plan for a task.
 */
export async function submitPlan(taskId: string, data: SubmitPlanData): Promise<PlanRow> {
  const result = await query<PlanRow>(
    `INSERT INTO plans (task_id, content, file_manifest, reasoning, estimate)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      taskId,
      data.content,
      JSON.stringify(data.file_manifest),
      data.reasoning,
      data.estimate,
    ],
  );

  const plan = result.rows[0];

  await createEvent(taskId, null, 'plan_submitted', {
    plan_id: plan.id,
    file_count: data.file_manifest.length,
  });

  broadcast('plans', 'plan.submitted', plan);

  return plan;
}

/**
 * Get all plans for a task, most recent first.
 */
export async function getPlans(taskId: string): Promise<PlanRow[]> {
  const result = await query<PlanRow>(
    'SELECT * FROM plans WHERE task_id = $1 ORDER BY created_at DESC',
    [taskId],
  );

  return result.rows;
}

/**
 * Approve a plan.
 */
export async function approvePlan(planId: string): Promise<PlanRow> {
  const result = await query<PlanRow>(
    `UPDATE plans
     SET status = 'approved', reviewed_at = now()
     WHERE id = $1
     RETURNING *`,
    [planId],
  );

  if (result.rows.length === 0) {
    throw new Error(`Plan not found: ${planId}`);
  }

  const plan = result.rows[0];

  await createEvent(plan.task_id, null, 'plan_approved', {
    plan_id: plan.id,
  });

  broadcast('plans', 'plan.reviewed', { ...plan, action: 'approved' });

  return plan;
}

/**
 * Reject a plan with reviewer feedback.
 */
export async function rejectPlan(planId: string, feedback: string): Promise<PlanRow> {
  const result = await query<PlanRow>(
    `UPDATE plans
     SET status = 'rejected', reviewer_feedback = $1, reviewed_at = now()
     WHERE id = $2
     RETURNING *`,
    [feedback, planId],
  );

  if (result.rows.length === 0) {
    throw new Error(`Plan not found: ${planId}`);
  }

  const plan = result.rows[0];

  await createEvent(plan.task_id, null, 'plan_rejected', {
    plan_id: plan.id,
    feedback,
  });

  broadcast('plans', 'plan.reviewed', { ...plan, action: 'rejected' });

  return plan;
}
