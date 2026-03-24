import { Router } from 'express';
import { z } from 'zod';
import {
  acquireLocks,
  releaseLocks,
  checkConflicts,
} from '../services/file-lock-service.js';

export const fileLockRouter = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const acquireLocksSchema = z.object({
  task_id: z.string().uuid('task_id must be a valid UUID'),
  files: z.array(z.string().min(1)).min(1, 'files must contain at least one path'),
});

const releaseLocksQuerySchema = z.object({
  task_id: z.string().uuid('task_id must be a valid UUID'),
});

const checkConflictsQuerySchema = z.object({
  files: z.string().min(1, 'files query parameter is required'),
  exclude_task_id: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// POST /file-locks — Acquire locks
// ---------------------------------------------------------------------------
fileLockRouter.post('/', async (req, res, next) => {
  try {
    const data = acquireLocksSchema.parse(req.body);
    const locks = await acquireLocks(data.task_id, data.files);
    res.status(201).json({ data: locks });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /file-locks — Release all locks for a task
// ---------------------------------------------------------------------------
fileLockRouter.delete('/', async (req, res, next) => {
  try {
    const { task_id } = releaseLocksQuerySchema.parse(req.query);
    await releaseLocks(task_id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /file-locks/check — Check for conflicts
// ---------------------------------------------------------------------------
fileLockRouter.get('/check', async (req, res, next) => {
  try {
    const queryParams = checkConflictsQuerySchema.parse(req.query);
    const files = queryParams.files.split(',').map((f) => f.trim()).filter(Boolean);
    const conflicts = await checkConflicts(files, queryParams.exclude_task_id);
    res.json({ data: conflicts });
  } catch (err) {
    next(err);
  }
});
