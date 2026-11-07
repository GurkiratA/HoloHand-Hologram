import { z } from 'zod';

const Entry = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  subtitle: z.string().default(''),
  file: z.string(),
  keywords: z.array(z.string()).default([]),
  license: z.string(),
  attribution: z.string(),
  note: z.string().optional(),
  archetype: z.string().optional(),
});

let cache: { t: number; models: z.infer<typeof Entry>[] } | null = null;

/**
 * External model catalogs: MODEL_CATALOG_URLS is a comma-separated list of JSON
 * documents shaped like public/models/catalog.json. Relative `file` URLs are
 * resolved against the catalog URL. Entries without a licence are rejected.
 */
export async function remoteCatalog(urls = (process.env.MODEL_CATALOG_URLS || '').split(',').map((s) => s.trim()).filter(Boolean)) {
  if (!urls.length) return [];
  if (cache && Date.now() - cache.t < 5 * 60_000) return cache.models;
  const all: (z.infer<typeof Entry> & { source: string })[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { models?: unknown[] };
      for (const m of body.models ?? []) {
        const p = Entry.safeParse(m);
        if (!p.success) continue;
        all.push({ ...p.data, id: `remote-${p.data.id}`, file: new URL(p.data.file, url).toString(), source: new URL(url).host });
      }
    } catch (e) {
      console.warn(`[catalog] ${url}: ${(e as Error).message}`);
    }
  }
  cache = { t: Date.now(), models: all };
  return all;
}
