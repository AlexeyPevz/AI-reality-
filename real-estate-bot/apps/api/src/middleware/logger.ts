import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  (req as any).rid = (req.headers['x-request-id'] as string) || randomUUID();
  res.setHeader('x-request-id', (req as any).rid);

  res.on('finish', () => {
    const ms = Date.now() - start;
    const log = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms rid=${(req as any).rid}`;
    if (res.statusCode >= 500) console.error(log);
    else if (res.statusCode >= 400) console.warn(log);
    else console.log(log);
  });

  next();
}