import { Router } from 'express';
import { z } from 'zod';
import { submitDiff, getDiffs, getLatestDiffFeedback, updateTestResults } from '../services/diff-service.js';

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
  summary: z.string().optional(),
  compliance: z.record(z.unknown()).optional(),
  audit: z.record(z.unknown()).optional(),
});

const updateTestResultsSchema = z.object({
  status: z.enum(['running', 'passed', 'failed', 'skipped']),
  tests_written: z.number().int().nonnegative().optional(),
  tests_passed: z.number().int().nonnegative().optional(),
  tests_failed: z.number().int().nonnegative().optional(),
  failures: z.array(z.string()).optional(),
  duration_ms: z.number().nonnegative().optional(),
  summary: z.string().optional(),
}).passthrough();

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

// ---------------------------------------------------------------------------
// GET /tasks/:id/diffs/feedback — Get review feedback from latest diff
// ---------------------------------------------------------------------------
diffRouter.get('/:id/diffs/feedback', async (req, res, next) => {
  try {
    const feedback = await getLatestDiffFeedback(req.params.id);
    res.json({ data: { feedback } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /tasks/:id/diffs/tests — Update test results on latest diff
// ---------------------------------------------------------------------------
diffRouter.patch('/:id/diffs/tests', async (req, res, next) => {
  try {
    const testResults = updateTestResultsSchema.parse(req.body);
    await updateTestResults(req.params.id, testResults);
    res.json({ data: { updated: true } });
  } catch (err) {
    next(err);
  }
});
