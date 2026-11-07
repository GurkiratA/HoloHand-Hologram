import type { NextFunction, Request, Response } from 'express';

/** Tiny in-memory token bucket per IP – protects the paid AI endpoint from runaway clients. */
export function rateLimit(perMinute: number) {
  const buckets = new Map<string, { tokens: number; t: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'anon';
    const now = Date.now();
    const b = buckets.get(key) ?? { tokens: perMinute, t: now };
    b.tokens = Math.min(perMinute, b.tokens + ((now - b.t) / 60000) * perMinute);
    b.t = now;
    if (b.tokens < 1) {
      res.status(429).json({ error: 'Too many recognition requests – slow down.' });
      return;
    }
    b.tokens -= 1;
    buckets.set(key, b);
    next();
  };
}
