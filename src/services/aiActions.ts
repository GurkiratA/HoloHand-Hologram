import { holo, useHolo } from '@/state/store';
import { ARCHETYPES } from '@/three/models/procedural';
import type { RecognitionResult } from '@/types';
import { applyRecognition } from './modelActions';

/** Text-only identification ("I typed what it is") via the configured provider. */
export async function describeWithAI(query: string) {
  const res = await fetch('/api/describe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, archetypes: ARCHETYPES.map((a) => a.id) }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  await applyRecognition({ ...(body as RecognitionResult), provider: (body as RecognitionResult).provider }, null);
}

/** For uploaded models: ask the AI to turn mesh names into readable component names + descriptions. */
export async function describeMeshesWithAI() {
  const s = holo();
  const m = s.model;
  if (!m) return;
  s.toast('Asking AI to describe the meshes…');
  try {
    const res = await fetch('/api/describe-meshes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ objectName: m.descriptor.name, meshNames: m.parts.map((p) => p.node.name || p.meta.name) }),
    });
    const body = (await res.json()) as { error?: string; components?: { meshName: string; name: string; description: string; confidence: number }[] };
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    for (const c of body.components ?? []) {
      const p = m.parts.find((x) => (x.node.name || x.meta.name) === c.meshName);
      if (!p) continue;
      p.meta.name = c.name;
      p.meta.description = c.description;
      p.meta.confidence = Math.max(0, Math.min(1, c.confidence)) * 0.8;
      p.meta.source = 'ai';
    }
    m.descriptor = { ...m.descriptor, components: [...m.groups, ...m.parts.map((p) => p.meta)] };
    useHolo.setState({ descriptor: m.descriptor, model: m });
    s.toast('Component names updated (AI-generated – verify before relying on them)', 'ok');
  } catch (e) {
    s.toast(`AI description failed: ${(e as Error).message}`, 'error');
  }
}
