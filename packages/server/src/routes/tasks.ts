import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import {
  createTask,
  getTask,
  listTasks,
  updateTaskStatus,
  updateTask,
  deleteTask,
  createTaskWithAttachments,
} from '../services/task-service.js';
import { updateTestResults } from '../services/diff-service.js';

export const taskRouter = Router();

// ---------------------------------------------------------------------------
// Multer Configuration for File Uploads
// ---------------------------------------------------------------------------

// Configure multer for memory storage (files stored in memory as Buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10, // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createTaskSchema = z.object({
  title: z.string().min(1, 'title is required'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  target_branch: z.string().optional(),
  model_tier: z.string().optional(),
  repo_id: z.string().uuid().optional(),
});

const updateTaskSchema = z.object({
  status: z.string().optional(),
  reason: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.string().optional(),
});

const listTasksQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().positive().default(50),
  repo_id: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// POST /tasks — Create a task (handles both JSON and multipart form data)
// ---------------------------------------------------------------------------
taskRouter.post('/', upload.array('attachments'), async (req, res, next) => {
  try {
    // Check if this is a multipart request with files
    const files = req.files as Express.Multer.File[] | undefined;

    if (files && files.length > 0) {
      // Handle multipart form data with attachments
      const formData: Record<string, unknown> = {};

      if (req.body.title) formData.title = req.body.title;
      if (req.body.description) formData.description = req.body.description;
      if (req.body.priority) formData.priority = req.body.priority;
      if (req.body.target_branch) formData.target_branch = req.body.target_branch;
      if (req.body.model_tier) formData.model_tier = req.body.model_tier;
      if (req.body.repo_id) formData.repo_id = req.body.repo_id;

      const data = createTaskSchema.parse(formData);
      const task = await createTaskWithAttachments(data, files);
      res.status(201).json({ data: task });
    } else {
      // Handle regular JSON request
      const data = createTaskSchema.parse(req.body);
      const task = await createTask(data);
      res.status(201).json({ data: task });
    }
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /tasks — List tasks
// ---------------------------------------------------------------------------
taskRouter.get('/', async (req, res, next) => {
  try {
    const query = listTasksQuerySchema.parse(req.query);
    const statuses = query.status
      ? query.status.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const tasks = await listTasks({ statuses, limit: query.limit, repo_id: query.repo_id });
    res.json({ data: tasks });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /tasks/:id — Get task detail
// ---------------------------------------------------------------------------
taskRouter.get('/:id', async (req, res, next) => {
  try {
    const task = await getTask(req.params.id);
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /tasks/:id — Update task
// ---------------------------------------------------------------------------
taskRouter.patch('/:id', async (req, res, next) => {
  try {
    const body = updateTaskSchema.parse(req.body);
    let task;
    if (body.status) {
      task = await updateTaskStatus(req.params.id, body.status, body.reason);
    } else {
      const { status: _status, reason: _reason, ...fields } = body;
      task = await updateTask(req.params.id, fields);
    }
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /tasks/:id/cancel — Cancel a task (from any non-terminal state)
// ---------------------------------------------------------------------------
taskRouter.post('/:id/cancel', async (req, res, next) => {
  try {
    const task = await updateTaskStatus(req.params.id, 'cancelled', 'Cancelled by user');
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /tasks/:id/test-results — Update test results on latest diff
// ---------------------------------------------------------------------------
taskRouter.post('/:id/test-results', async (req, res, next) => {
  try {
    await updateTestResults(req.params.id, req.body);
    res.json({ data: { updated: true } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /tasks/:id — Cancel / delete a task (only if queued)
// ---------------------------------------------------------------------------
taskRouter.delete('/:id', async (req, res, next) => {
  try {
    await deleteTask(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
