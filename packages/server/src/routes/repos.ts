import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/connection.js';
import * as githubService from '../services/github-service.js';
import * as userService from '../services/user-service.js';

export const repoRouter = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const selectRepoSchema = z.object({
  full_name: z.string().min(1, 'full_name is required'),
  github_url: z.string().min(1, 'github_url is required'),
  default_branch: z.string().optional().default('main'),
});

// ---------------------------------------------------------------------------
// GET /repos/github — Fetch repos from GitHub
// ---------------------------------------------------------------------------
repoRouter.get('/github', async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: { message: 'Unauthorized', code: 'AUTH_FAILED' },
      });
      return;
    }

    const token = await userService.getUserGithubToken(req.user.id);
    const repos = await githubService.listRepos(token);

    res.json({ data: repos });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /repos/select — Select / upsert a repository
// ---------------------------------------------------------------------------
repoRouter.post('/select', async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: { message: 'Unauthorized', code: 'AUTH_FAILED' },
      });
      return;
    }

    const data = selectRepoSchema.parse(req.body);

    const result = await query(
      `INSERT INTO repositories (github_full_name, github_url, default_branch, user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (github_full_name) DO UPDATE
         SET github_url = EXCLUDED.github_url,
             default_branch = EXCLUDED.default_branch,
             user_id = EXCLUDED.user_id
       RETURNING *`,
      [data.full_name, data.github_url, data.default_branch, req.user.id],
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /repos — List repos from DB for this user
// ---------------------------------------------------------------------------
repoRouter.get('/', async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: { message: 'Unauthorized', code: 'AUTH_FAILED' },
      });
      return;
    }

    const result = await query(
      'SELECT * FROM repositories WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id],
    );

    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});
