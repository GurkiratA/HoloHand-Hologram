import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { ProviderError, type JsonRequest, type VisionProvider } from './types';

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export function createAnthropicProvider(): VisionProvider {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const model = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
  const effort = (process.env.ANTHROPIC_EFFORT as Effort) || 'low';
  return {
    id: 'anthropic',
    model,
    async json<S extends z.ZodType>(req: JsonRequest<S>) {
      const content: Anthropic.Beta.BetaContentBlockParam[] = [];
      if (req.image) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: req.image.mediaType as 'image/jpeg' | 'image/png', data: req.image.data },
        });
      }
      content.push({ type: 'text', text: req.prompt });
      try {
        const res = await client.beta.messages.parse({
          model,
          max_tokens: req.maxTokens ?? 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: req.system,
          output_config: { effort, format: betaZodOutputFormat(req.schema as never) },
          messages: [{ role: 'user', content }],
        });
        if (res.stop_reason === 'refusal') throw new ProviderError('The model declined to analyse this image', 422);
        if (res.parsed_output == null) throw new ProviderError('No structured output returned');
        return res.parsed_output;
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        if (e instanceof Anthropic.RateLimitError) throw new ProviderError('Anthropic rate limit – try again shortly', 429);
        if (e instanceof Anthropic.AuthenticationError) throw new ProviderError('Anthropic API key rejected', 401);
        if (e instanceof Anthropic.APIError) throw new ProviderError(`Anthropic error: ${e.message}`, e.status ?? 502);
        throw e;
      }
    },
  };
}
