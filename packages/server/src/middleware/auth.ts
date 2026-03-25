import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { verifyJwt } from '../services/user-service.js';

function auth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({
      error: { message: 'Unauthorized', code: 'AUTH_FAILED' },
    });
    return;
  }

  const token = header.slice(7);

  // 1. Check if it's the shared API key (daemon auth)
  if (token === config.apiKey) {
    next();
    return;
  }

  // 2. Try to verify as JWT (user auth)
  if (config.jwtSecret) {
    try {
      const payload = verifyJwt(token, config.jwtSecret);
      req.user = {
        id: payload.sub,
        githubLogin: payload.login,
        githubAvatarUrl: payload.avatar,
      };
      next();
      return;
    } catch {
      // Invalid JWT — fall through to 401
    }
  }

  res.status(401).json({
    error: { message: 'Unauthorized', code: 'AUTH_FAILED' },
  });
}

export default auth;
