import { Router } from 'express';
import crypto from 'crypto';
import { config } from '../config.js';
import auth from '../middleware/auth.js';
import * as githubService from '../services/github-service.js';
import * as userService from '../services/user-service.js';

export const authRouter = Router();

// ─── OAuth state store (in-memory with TTL) ──────────────────────────

const pendingStates = new Map<string, number>(); // state → expiry timestamp

// Clean up expired states periodically (every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [state, expiry] of pendingStates) {
    if (expiry < now) pendingStates.delete(state);
  }
}, 60_000);

// ---------------------------------------------------------------------------
// GET /github — Start OAuth flow
// ---------------------------------------------------------------------------
authRouter.get('/github', (_req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({
      error: { message: 'GitHub OAuth is not configured', code: 'NOT_CONFIGURED' },
    });
    return;
  }

  const state = crypto.randomBytes(20).toString('hex');
  pendingStates.set(state, Date.now() + 5 * 60 * 1000); // 5 min TTL

  const redirectUri = `${config.dashboardUrl}/api/v1/auth/github/callback`;
  const url =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=repo` +
    `&state=${state}`;

  res.redirect(url);
});

// ---------------------------------------------------------------------------
// GET /github/callback — OAuth callback
// ---------------------------------------------------------------------------
authRouter.get('/github/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };

    if (!state || !pendingStates.has(state)) {
      res.status(400).json({
        error: { message: 'Invalid or expired OAuth state', code: 'INVALID_STATE' },
      });
      return;
    }

    const expiry = pendingStates.get(state)!;
    pendingStates.delete(state);

    if (expiry < Date.now()) {
      res.status(400).json({
        error: { message: 'OAuth state expired', code: 'STATE_EXPIRED' },
      });
      return;
    }

    if (!code) {
      res.status(400).json({
        error: { message: 'Missing code parameter', code: 'MISSING_CODE' },
      });
      return;
    }

    // Exchange code for token
    const accessToken = await githubService.exchangeCodeForToken(code);

    // Fetch GitHub user
    const ghUser = await githubService.getUser(accessToken);

    // Upsert user in DB
    const user = await userService.upsertUser(
      ghUser.id,
      ghUser.login,
      ghUser.avatar_url,
      accessToken,
    );

    // Generate JWT
    const jwt = userService.generateJwt(user);

    // Redirect to dashboard with token in hash
    res.redirect(`${config.dashboardUrl}/#token=${jwt}`);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /me — Current user info (requires auth)
// ---------------------------------------------------------------------------
authRouter.get('/me', auth, async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: { message: 'Unauthorized', code: 'AUTH_FAILED' },
      });
      return;
    }

    const user = await userService.getUser(req.user.id);
    if (!user) {
      res.status(404).json({
        error: { message: 'User not found', code: 'NOT_FOUND' },
      });
      return;
    }

    res.json({
      data: {
        id: user.id,
        github_login: user.github_login,
        github_avatar_url: user.github_avatar_url,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /logout — No-op server side
// ---------------------------------------------------------------------------
authRouter.post('/logout', (_req, res) => {
  res.json({ data: { ok: true } });
});
