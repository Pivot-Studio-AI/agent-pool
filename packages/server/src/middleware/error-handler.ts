import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

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

  const message = err.message ?? 'Internal server error';

  // Not found → 404
  if (/not found/i.test(message)) {
    res.status(404).json({
      error: { message, code: 'NOT_FOUND' },
    });
    return;
  }

  // Conflict cases → 409
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
