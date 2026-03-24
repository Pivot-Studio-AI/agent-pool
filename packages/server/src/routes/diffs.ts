import { Router } from 'express';
import { z } from 'zod';
import { submitDiff, getDiffs } from '../services/diff-service.js';

export const diffRouter = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const submitDiffSchema = z.object({
  diff_content: z.string().min(1, 'diff_content is required'),
  files_changed: z.array(
    z.object({
      path: z.string(),
      additions: z.number().int().nonnegative(),
      deletions: z.number().int().nonnegative(),
    }),
  ),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
});

// ---------------------------------------------------------------------------
// POST /tasks/:id/diffs — Submit a diff
// ---------------------------------------------------------------------------
diffRouter.post('/:id/diffs', async (req, res, next) => {
  try {
    const data = submitDiffSchema.parse(req.body);
    const diff = await submitDiff(req.params.id, data);
    res.status(201).json({ data: diff });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /tasks/:id/diffs — Get diffs for a task
// ---------------------------------------------------------------------------
diffRouter.get('/:id/diffs', async (req, res, next) => {
  try {
    const diffs = await getDiffs(req.params.id);
    res.json({ data: diffs });
  } catch (err) {
    next(err);
  }
});
