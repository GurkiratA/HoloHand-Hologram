import { z } from 'zod';
import { extractJson, ProviderError, type JsonRequest, type VisionProvider } from './types';

/**
 * OpenAI Chat Completions – also works with any OpenAI-compatible endpoint
 * (Azure OpenAI proxies, OpenRouter, Groq, LM Studio, vLLM …) via OPENAI_BASE_URL.
 */
export function createOpenAIProvider(): VisionProvider {
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const key = process.env.OPENAI_API_KEY || '';
  return {
    id: 'openai',
    model,
    async json<S extends z.ZodType>(req: JsonRequest<S>) {
      const user: unknown[] = [{ type: 'text', text: req.prompt }];
      if (req.image) user.push({ type: 'image_url', image_url: { url: `data:${req.image.mediaType};base64,${req.image.data}`, detail: 'low' } });
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({
          model,
          max_tokens: req.maxTokens ?? 4000,
          response_format: { type: 'json_schema', json_schema: { name: req.schemaName, schema: z.toJSONSchema(req.schema), strict: false } },
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) throw new ProviderError(`OpenAI-compatible endpoint returned ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status === 401 ? 401 : 502);
      const body = (await res.json()) as { choices?: { message?: { content?: string; refusal?: string } }[] };
      const msg = body.choices?.[0]?.message;
      if (msg?.refusal) throw new ProviderError('The model declined to analyse this image', 422);
      return extractJson(msg?.content ?? '');
    },
  };
}
