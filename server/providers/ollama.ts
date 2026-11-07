import { z } from 'zod';
import { extractJson, ProviderError, type JsonRequest, type VisionProvider } from './types';

/** Local, free multimodal models via Ollama (e.g. `ollama pull llava` or `qwen2.5vl`). */
export function createOllamaProvider(): VisionProvider {
  const base = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
  const model = process.env.OLLAMA_MODEL || 'llava';
  return {
    id: 'ollama',
    model,
    async json<S extends z.ZodType>(req: JsonRequest<S>) {
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          format: z.toJSONSchema(req.schema),
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.prompt, ...(req.image ? { images: [req.image.data] } : {}) },
          ],
        }),
      }).catch((e: Error) => {
        throw new ProviderError(`Cannot reach Ollama at ${base}: ${e.message}`, 503);
      });
      if (!res.ok) throw new ProviderError(`Ollama returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { message?: { content?: string } };
      return extractJson(body.message?.content ?? '');
    },
  };
}
