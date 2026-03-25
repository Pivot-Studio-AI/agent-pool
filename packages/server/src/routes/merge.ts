import { Router } from 'express';
import { z } from 'zod';
import { updateTaskStatus } from '../services/task-service.js';
import { releaseLocks } from '../services/file-lock-service.js';
import { createEvent } from '../services/event-service.js';
import { storeReviewFeedback } from '../services/diff-service.js';

export const mergeRouter = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const requestChangesSchema = z.object({
  comments: z.string().min(1, 'comments are required'),
});

// ---------------------------------------------------------------------------
// POST /tasks/:id/merge/approve — Approve merge
// ---------------------------------------------------------------------------
mergeRouter.post('/:id/merge/approve', async (req, res, next) => {
  try {
    const task = await updateTaskStatus(req.params.id, 'merging');
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /tasks/:id/merge/reject — Reject merge
// ---------------------------------------------------------------------------
mergeRouter.post('/:id/merge/reject', async (req, res, next) => {
  try {
    const task = await updateTaskStatus(req.params.id, 'rejected');
    await releaseLocks(req.params.id);
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /tasks/:id/review/request-changes — Send back with comments
// ---------------------------------------------------------------------------
mergeRouter.post('/:id/review/request-changes', async (req, res, next) => {
  try {
    const { comments } = requestChangesSchema.parse(req.body);

    // Store feedback on the latest diff so the daemon can retrieve it
    await storeReviewFeedback(req.params.id, comments);

    const task = await updateTaskStatus(req.params.id, 'executing');
    await createEvent({
      task_id: req.params.id,
      event_type: 'review_changes_requested',
      payload: { comments },
    });
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
});
