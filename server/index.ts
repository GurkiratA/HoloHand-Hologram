import 'dotenv/config';
import { join } from 'node:path';
import { createApp } from './app';
import { createProvider } from './providers';

const provider = createProvider();
const port = Number(process.env.API_PORT || process.env.PORT || 8787);
const app = createApp(provider, { serveStatic: process.env.NODE_ENV === 'production' ? join(import.meta.dirname, '..', 'dist') : undefined });

app.listen(port, () => {
  console.log(`[holohand] API on http://localhost:${port}`);
  console.log(provider ? `[holohand] AI provider: ${provider.id} (${provider.model})` : '[holohand] No AI provider configured – local-only recognition');
});
