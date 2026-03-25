import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// ─── Custom Error Classes ───────────────────────────────────────────

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// ─── Handler ────────────────────────────────────────────────────────

function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation errors → 400
  if (err instanceof ZodError) {
    const messages = err.errors.map(
      (e) => `${e.path.join('.')}: ${e.message}`,
    );
    res.status(400).json({
      error: {
        message: messages.join('; '),
        code: 'VALIDATION_ERROR',
      },
    });
    return;
  }

  // Typed errors
  if (err instanceof NotFoundError) {
    res.status(404).json({
      error: { message: err.message, code: 'NOT_FOUND' },
    });
    return;
  }

  if (err instanceof ConflictError) {
    res.status(409).json({
      error: { message: err.message, code: 'CONFLICT' },
    });
    return;
  }

  const message = err.message ?? 'Internal server error';

  // Legacy string-matching fallback (for errors not yet converted to typed classes)
  if (/not found/i.test(message) && !message.toLowerCase().includes('connection')) {
    res.status(404).json({
      error: { message, code: 'NOT_FOUND' },
    });
    return;
  }

  if (
    message.includes('Invalid transition') ||
    message.includes('No idle slots') ||
    message.includes('already locked')
  ) {
    res.status(409).json({
      error: { message, code: 'CONFLICT' },
    });
    return;
  }

  // Everything else → 500
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
  });
}

export default errorHandler;
