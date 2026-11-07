import { createAnthropicProvider } from './anthropic';
import { createGeminiProvider } from './gemini';
import { createOllamaProvider } from './ollama';
import { createOpenAIProvider } from './openai';
import type { VisionProvider } from './types';

/**
 * Picks the provider from AI_PROVIDER, or auto-detects from whichever API key is set.
 * Returns null when nothing is configured – the app then runs in local-only mode.
 */
export function createProvider(env = process.env): VisionProvider | null {
  const wanted = (env.AI_PROVIDER || '').toLowerCase().trim();
  const pick = wanted || (env.ANTHROPIC_API_KEY ? 'anthropic' : env.OPENAI_API_KEY ? 'openai' : env.GEMINI_API_KEY ? 'gemini' : '');
  switch (pick) {
    case 'anthropic':
      return env.ANTHROPIC_API_KEY ? createAnthropicProvider() : warn('anthropic', 'ANTHROPIC_API_KEY');
    case 'openai':
      return env.OPENAI_API_KEY || env.OPENAI_BASE_URL ? createOpenAIProvider() : warn('openai', 'OPENAI_API_KEY');
    case 'gemini':
      return env.GEMINI_API_KEY ? createGeminiProvider() : warn('gemini', 'GEMINI_API_KEY');
    case 'ollama':
      return createOllamaProvider();
    case '':
    case 'none':
    case 'local':
      return null;
    default:
      console.warn(`[ai] Unknown AI_PROVIDER "${pick}" – running local-only`);
      return null;
  }
}

function warn(p: string, key: string): null {
  console.warn(`[ai] AI_PROVIDER=${p} but ${key} is not set – running local-only`);
  return null;
}
