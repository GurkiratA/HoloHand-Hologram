import type { z } from 'zod';

export interface JsonRequest<S extends z.ZodType> {
  system: string;
  prompt: string;
  image?: { data: string; mediaType: string };
  schema: S;
  schemaName: string;
  maxTokens?: number;
}

/** A multimodal model that can return JSON matching a schema. */
export interface VisionProvider {
  id: 'openai' | 'anthropic' | 'gemini' | 'ollama';
  model: string;
  json<S extends z.ZodType>(req: JsonRequest<S>): Promise<unknown>;
}

export class ProviderError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

/** Pull the first JSON object out of a model's text reply. */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(t);
  } catch {
    const s = t.indexOf('{');
    const e = t.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(t.slice(s, e + 1));
    throw new ProviderError('Provider did not return JSON');
  }
}
