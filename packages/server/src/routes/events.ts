import { Router } from 'express';
import { z } from 'zod';
import { listEvents } from '../services/event-service.js';

export const eventRouter = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const listEventsQuerySchema = z.object({
  task_id: z.string().uuid().optional(),
  type: z.string().optional(),
  limit: z.coerce.number().int().positive().default(100),
  before: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET /events — List events
// ---------------------------------------------------------------------------
eventRouter.get('/', async (req, res, next) => {
  try {
    const query = listEventsQuerySchema.parse(req.query);
    const events = await listEvents({
      task_id: query.task_id,
      type: query.type,
      limit: query.limit,
      before: query.before,
    });
    res.json({ data: events });
  } catch (err) {
    next(err);
  }
});
