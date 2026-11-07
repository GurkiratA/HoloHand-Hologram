import { Router, type Request, type Response } from 'express';
import type { VisionProvider } from '../providers/types';
import { ProviderError } from '../providers/types';
import { DescribeRequest, MeshDescribeRequest, MeshDescriptionsSchema, normalize, RecognitionSchema, RecognizeRequest } from '../recognition/schema';
import { describeUserPrompt, meshPrompt, recognizeUserPrompt, SYSTEM_PROMPT } from '../recognition/prompt';
import { remoteCatalog } from '../services/catalog';
import { rateLimit } from '../services/rateLimit';

export function apiRouter(provider: VisionProvider | null) {
  const r = Router();
  const limit = rateLimit(Number(process.env.AI_REQUESTS_PER_MINUTE || 12));

  r.get('/health', async (_req, res) => {
    const catalogs = await remoteCatalog().catch(() => []);
    res.json({ ok: true, provider: provider?.id ?? null, model: provider?.model ?? null, remoteCatalogModels: catalogs.length });
  });

  r.get('/catalog', async (_req, res) => {
    res.json({ models: await remoteCatalog().catch(() => []) });
  });

  const needProvider = (res: Response) => {
    if (!provider) {
      res.status(503).json({ error: 'No AI provider configured on the server. Running in local-only mode.' });
      return false;
    }
    return true;
  };

  r.post('/recognize', limit, async (req: Request, res: Response) => {
    if (!needProvider(res)) return;
    const body = RecognizeRequest.safeParse(req.body);
    if (!body.success) return void res.status(400).json({ error: 'Invalid request', details: body.error.issues.slice(0, 3) });
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.*)$/s.exec(body.data.image);
    const image = m ? { mediaType: m[1], data: m[2] } : { mediaType: 'image/jpeg', data: body.data.image };
    await handle(res, async () => {
      const raw = await provider!.json({
        system: SYSTEM_PROMPT,
        prompt: recognizeUserPrompt(body.data.hints, body.data.archetypes),
        image,
        schema: RecognitionSchema,
        schemaName: 'recognition',
      });
      return normalize(raw, provider!.id);
    });
  });

  r.post('/describe', limit, async (req, res) => {
    if (!needProvider(res)) return;
    const body = DescribeRequest.safeParse(req.body);
    if (!body.success) return void res.status(400).json({ error: 'Invalid request' });
    await handle(res, async () => {
      const raw = await provider!.json({ system: SYSTEM_PROMPT, prompt: describeUserPrompt(body.data.query, body.data.archetypes), schema: RecognitionSchema, schemaName: 'recognition' });
      return normalize(raw, provider!.id);
    });
  });

  r.post('/describe-meshes', limit, async (req, res) => {
    if (!needProvider(res)) return;
    const body = MeshDescribeRequest.safeParse(req.body);
    if (!body.success) return void res.status(400).json({ error: 'Invalid request' });
    await handle(res, async () => {
      const raw = await provider!.json({ system: SYSTEM_PROMPT, prompt: meshPrompt(body.data.objectName, body.data.meshNames), schema: MeshDescriptionsSchema, schemaName: 'mesh_descriptions' });
      return MeshDescriptionsSchema.parse(raw);
    });
  });

  return r;
}

async function handle(res: Response, fn: () => Promise<unknown>) {
  try {
    res.json(await fn());
  } catch (e) {
    const status = e instanceof ProviderError ? e.status : 500;
    console.error('[ai]', (e as Error).message);
    res.status(status >= 400 && status < 600 ? status : 502).json({ error: (e as Error).message });
  }
}
