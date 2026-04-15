import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/connection.js';

export const daemonRouter = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  name: z.string().optional().default('default'),
  repo_path: z.string().min(1, 'repo_path is required'),
  pool_size: z.number().int().positive('pool_size must be a positive integer'),
  repo_id: z.string().uuid().optional(),
});

const heartbeatSchema = z.object({
  daemon_id: z.string().uuid('daemon_id must be a valid UUID'),
});

// ---------------------------------------------------------------------------
// POST /daemon/register — Register a daemon instance
// ---------------------------------------------------------------------------
daemonRouter.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    // Insert daemon row
    const daemonResult = await query(
      `INSERT INTO daemons (name, repo_path, pool_size, repo_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.name, data.repo_path, data.pool_size, data.repo_id ?? null],
    );
    const daemon = daemonResult.rows[0];

    // Auto-create slots for this daemon
    const slotRows = [];
    for (let i = 1; i <= data.pool_size; i++) {
      const worktreePath = `${data.repo_path}/.worktrees/slot-${i}`;
      const slotResult = await query(
        `INSERT INTO slots (slot_number, worktree_path, status, repo_id)
         VALUES ($1, $2, 'idle', $3)
         ON CONFLICT (slot_number, repo_id) DO UPDATE SET worktree_path = $2, status = 'idle'
         RETURNING *`,
        [i, worktreePath, data.repo_id ?? null],
      );
      slotRows.push(slotResult.rows[0]);
    }

    res.status(201).json({ data: { daemon, slots: slotRows } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /daemon/repo/ack — Daemon acknowledges it has a repo set up locally
// ---------------------------------------------------------------------------
daemonRouter.post('/repo/ack', async (req, res, next) => {
  try {
    const { daemon_id, repo_id, local_path } = z.object({
      daemon_id: z.string().uuid(),
      repo_id: z.string().uuid(),
      local_path: z.string().min(1),
    }).parse(req.body);

    await query(
      `UPDATE daemons SET repo_id = $1, repo_path = $2 WHERE id = $3`,
      [repo_id, local_path, daemon_id],
    );

    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /daemon/repo — Get latest selected repository
// ---------------------------------------------------------------------------
daemonRouter.get('/repo', async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT *, id AS repo_id FROM repositories ORDER BY created_at DESC LIMIT 1`,
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: { message: 'No repository selected', code: 'NOT_FOUND' },
      });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /daemon/repos — All repositories (for multi-repo daemon mode)
// ---------------------------------------------------------------------------
daemonRouter.get('/repos', async (_req, res, next) => {
  try {
    const result = await query('SELECT *, id AS repo_id FROM repositories ORDER BY created_at ASC');
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /daemon/repo-slots — Upsert slots for a specific repo (multi-repo mode)
// ---------------------------------------------------------------------------
daemonRouter.post('/repo-slots', async (req, res, next) => {
  try {
    const { repo_id, pool_size, base_path } = z.object({
      repo_id: z.string().uuid(),
      pool_size: z.number().int().positive(),
      base_path: z.string().min(1),
    }).parse(req.body);

    const slotRows = [];
    for (let i = 1; i <= pool_size; i++) {
      const worktreePath = `${base_path}/.worktrees/slot-${i}`;
      const slotResult = await query(
        `INSERT INTO slots (slot_number, worktree_path, status, repo_id)
         VALUES ($1, $2, 'idle', $3)
         ON CONFLICT (slot_number, repo_id) DO UPDATE SET worktree_path = $2, status = 'idle'
         RETURNING *`,
        [i, worktreePath, repo_id],
      );
      slotRows.push(slotResult.rows[0]);
    }

    res.status(201).json({ data: slotRows });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /daemon/heartbeat — Heartbeat
// ---------------------------------------------------------------------------
daemonRouter.post('/heartbeat', async (req, res, next) => {
  try {
    const { daemon_id } = heartbeatSchema.parse(req.body);

    const result = await query(
      `UPDATE daemons
       SET last_heartbeat = now()
       WHERE id = $1
       RETURNING *`,
      [daemon_id],
    );

    if (result.rowCount === 0) {
      res.status(404).json({
        error: { message: 'Daemon not found', code: 'NOT_FOUND' },
      });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});
