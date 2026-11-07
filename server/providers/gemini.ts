import { z } from 'zod';
import { extractJson, ProviderError, type JsonRequest, type VisionProvider } from './types';

export function createGeminiProvider(): VisionProvider {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const key = process.env.GEMINI_API_KEY || '';
  return {
    id: 'gemini',
    model,
    async json<S extends z.ZodType>(req: JsonRequest<S>) {
      const parts: unknown[] = [];
      if (req.image) parts.push({ inline_data: { mime_type: req.image.mediaType, data: req.image.data } });
      parts.push({ text: `${req.prompt}\n\nJSON schema:\n${JSON.stringify(z.toJSONSchema(req.schema))}` });
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: req.maxTokens ?? 4000 },
        }),
      });
      if (!res.ok) throw new ProviderError(`Gemini returned ${res.status}: ${(await res.text()).slice(0, 200)}`, res.status === 403 ? 401 : 502);
      const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      return extractJson(body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '');
    },
  };
}
