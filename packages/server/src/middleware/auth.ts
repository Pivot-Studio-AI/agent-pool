import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

function auth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({
      error: { message: 'Unauthorized', code: 'AUTH_FAILED' },
    });
    return;
  }

  const key = header.slice(7);

  if (key !== config.apiKey) {
    res.status(401).json({
      error: { message: 'Unauthorized', code: 'AUTH_FAILED' },
    });
    return;
  }

  next();
}

export default auth;
