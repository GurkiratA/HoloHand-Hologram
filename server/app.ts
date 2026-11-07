import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { apiRouter } from './api/routes';
import type { VisionProvider } from './providers/types';

export function createApp(provider: VisionProvider | null, opts: { serveStatic?: string } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '8mb' }));
  app.use('/api', apiRouter(provider));
  if (opts.serveStatic && existsSync(opts.serveStatic)) {
    app.use(express.static(opts.serveStatic, { maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(opts.serveStatic!, 'index.html')));
  }
  return app;
}
