import { Router } from 'express';
import { z } from 'zod';
import { listSlots, claimSlot, releaseSlot } from '../services/slot-service.js';

export const slotRouter = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const claimSlotSchema = z.object({
  task_id: z.string().uuid('task_id must be a valid UUID'),
  daemon_id: z.string().uuid('daemon_id must be a valid UUID'),
});

// ---------------------------------------------------------------------------
// GET /slots — List all slots (optionally filtered by ?repo_id=)
// ---------------------------------------------------------------------------
slotRouter.get('/', async (req, res, next) => {
  try {
    const repoId = typeof req.query.repo_id === 'string' ? req.query.repo_id : undefined;
    const slots = await listSlots(repoId);
    res.json({ data: slots });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /slots/:id/claim — Claim a slot
// ---------------------------------------------------------------------------
slotRouter.post('/:id/claim', async (req, res, next) => {
  try {
    const data = claimSlotSchema.parse(req.body);
    const slot = await claimSlot(req.params.id, data.task_id, data.daemon_id);
    res.json({ data: slot });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /slots/:id/release — Release a slot
// ---------------------------------------------------------------------------
slotRouter.post('/:id/release', async (req, res, next) => {
  try {
    const slot = await releaseSlot(req.params.id);
    res.json({ data: slot });
  } catch (err) {
    next(err);
  }
});
