import { Router } from 'express';
import { z } from 'zod';
import {
  submitPlan,
  getPlans,
  approvePlan,
  rejectPlan,
} from '../services/plan-service.js';

export const planRouter = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const submitPlanSchema = z.object({
  content: z.string().min(1, 'content is required'),
  file_manifest: z.array(z.string()),
  reasoning: z.string(),
  estimate: z.string(),
});

const rejectPlanSchema = z.object({
  feedback: z.string().min(1, 'feedback is required'),
});

// ---------------------------------------------------------------------------
// POST /tasks/:id/plans — Submit a plan
// ---------------------------------------------------------------------------
planRouter.post('/:id/plans', async (req, res, next) => {
  try {
    const data = submitPlanSchema.parse(req.body);
    const plan = await submitPlan(req.params.id, data);
    res.status(201).json({ data: plan });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /tasks/:id/plans — Get plans for a task
// ---------------------------------------------------------------------------
planRouter.get('/:id/plans', async (req, res, next) => {
  try {
    const plans = await getPlans(req.params.id);
    res.json({ data: plans });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /tasks/:id/plans/:planId/approve — Approve a plan
// ---------------------------------------------------------------------------
planRouter.post('/:id/plans/:planId/approve', async (req, res, next) => {
  try {
    const plan = await approvePlan(req.params.planId);
    res.json({ data: plan });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /tasks/:id/plans/:planId/reject — Reject a plan with feedback
// ---------------------------------------------------------------------------
planRouter.post('/:id/plans/:planId/reject', async (req, res, next) => {
  try {
    const { feedback } = rejectPlanSchema.parse(req.body);
    const plan = await rejectPlan(req.params.planId, feedback);
    res.json({ data: plan });
  } catch (err) {
    next(err);
  }
});
