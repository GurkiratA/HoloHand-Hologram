import { z } from 'zod';
import { extractJson, ProviderError, type JsonRequest, type VisionProvider } from './types';

/** Per-attempt limit: an overloaded model can accept the request and never answer. */
const ATTEMPT_TIMEOUT_MS = 18_000;
/** A model that was overloaded or timed out is skipped for this long, so scans go straight to one that answers. */
const COOLDOWN_MS = 60_000;
const cooldownUntil = new Map<string, number>();
/** Skips a model for `ms`; a quota error says exactly how long ("retryDelay": "25882s"), up to a day. */
const coolDown = (m: string, ms = COOLDOWN_MS) => cooldownUntil.set(m, Date.now() + Math.min(ms, 86_400_000));
const retryDelayMs = (body: string) => {
  const s = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body);
  return s ? Number(s[1]) * 1000 : COOLDOWN_MS;
};

export function createGeminiProvider(): VisionProvider {
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const key = process.env.GEMINI_API_KEY || '';
  // Tried in order when a model is overloaded (429/5xx), retired (404) or times out.
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.5-flash,gemini-3.1-flash-lite,gemini-flash-latest')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const chain = [...new Set([model, ...fallbacks])];
  // Gemini 3 models think before answering; "low" is ~3x faster than the default with the same output.
  const thinking = (process.env.GEMINI_THINKING || 'low').trim();
  return {
    id: 'gemini',
    model,
    async json<S extends z.ZodType>(req: JsonRequest<S>) {
      const parts: unknown[] = [];
      if (req.image) parts.push({ inline_data: { mime_type: req.image.mediaType, data: req.image.data } });
      parts.push({ text: `${req.prompt}\n\nJSON schema:\n${JSON.stringify(z.toJSONSchema(req.schema))}` });
      const payload = (withThinking: boolean) =>
        JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: req.maxTokens ?? 16000,
            ...(withThinking && thinking && thinking !== 'default' ? { thinkingConfig: { thinkingLevel: thinking } } : {}),
          },
        });

      let lastError: ProviderError | null = null;
      const now = Date.now();
      const ready = chain.filter((m) => (cooldownUntil.get(m) ?? 0) <= now);
      for (const m of ready.length ? ready : chain) {
        for (const withThinking of [true, false]) {
        let res: Response;
        try {
          res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
            body: payload(withThinking),
            signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
          });
        } catch (e) {
          const timedOut = (e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError';
          lastError = new ProviderError(timedOut ? `Gemini (${m}) did not answer within ${ATTEMPT_TIMEOUT_MS / 1000}s` : `Gemini (${m}) request failed: ${(e as Error).message}`, 504);
          console.warn(`[ai] ${lastError.message} – trying next model`);
          coolDown(m);
          break;
        }
        if (res.ok) {
          cooldownUntil.delete(m);
          const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
          return extractJson(body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '');
        }
        const fullBody = await res.text();
        const detail = fullBody.slice(0, 200);
        // models without thinking levels reject the field – retry this model without it
        if (res.status === 400 && withThinking && /think/i.test(detail)) continue;
        if (res.status === 401 || res.status === 403) throw new ProviderError(`Gemini rejected the API key (${res.status}): ${detail}`, 401);
        lastError = new ProviderError(`Gemini (${m}) returned ${res.status}: ${detail}`, res.status === 429 ? 429 : 502);
        if (res.status === 404 || res.status === 429 || res.status >= 500) {
          const wait = res.status === 429 ? retryDelayMs(fullBody) : COOLDOWN_MS;
          console.warn(`[ai] Gemini (${m}) returned ${res.status} – skipping it for ${Math.round(wait / 60000)} min, trying next model`);
          coolDown(m, wait);
          break;
        }
        throw lastError;
        }
      }
      throw lastError ?? new ProviderError('Gemini: no model available');
    },
  };
}
