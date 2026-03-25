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
      `INSERT INTO daemons (name, repo_path, pool_size)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.name, data.repo_path, data.pool_size],
    );
    const daemon = daemonResult.rows[0];

    // Auto-create slots for this daemon
    const slotRows = [];
    for (let i = 1; i <= data.pool_size; i++) {
      const worktreePath = `${data.repo_path}/.worktrees/slot-${i}`;
      const slotResult = await query(
        `INSERT INTO slots (slot_number, worktree_path, status)
         VALUES ($1, $2, 'idle')
         ON CONFLICT (slot_number) DO UPDATE SET worktree_path = $2, status = 'idle'
         RETURNING *`,
        [i, worktreePath],
      );
      slotRows.push(slotResult.rows[0]);
    }

    res.status(201).json({ data: { daemon, slots: slotRows } });
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
