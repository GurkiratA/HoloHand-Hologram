import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app';
import { createProvider } from '../server/providers';
import { normalize } from '../server/recognition/schema';
import { extractJson } from '../server/providers/types';

const sampleReply = {
  objectName: 'Toy Formula 1 car',
  category: 'Toy / Motorsport',
  brand: null,
  model: null,
  characteristics: ['red die-cast body', 'about 7 cm long'],
  components: [
    { name: 'Front wing', description: 'Moulded front wing', parent: null, confidence: 0.9 },
    { name: 'Wheels', description: 'Four plastic wheels', parent: null, confidence: 1.4 },
  ],
  confidence: 0.82,
  searchTerms: ['formula 1 car', 'race car'],
  archetype: 'formula-car',
  orientation: 'side view',
  primitiveModel: [{ component: 'Body', shape: 'box', size: [4, 1], position: [0, 0, 0], rotation: null, color: '#ff0000' }],
  notes: null,
};

describe('schema normalisation', () => {
  it('clamps values and fills vectors', () => {
    const n = normalize(sampleReply, 'openai');
    expect(n.components[1].confidence).toBe(1);
    expect(n.primitiveModel![0].size).toEqual([4, 1, 1]);
    expect(n.provider).toBe('openai');
  });
  it('accepts nulls and wrong types from smaller models instead of failing', () => {
    const n = normalize(
      { holdingObject: false, objectName: null, category: null, confidence: null, components: [{ name: null, description: 3 }], primitiveModel: [{ shape: 'blob', size: null }], characteristics: null },
      'gemini',
    );
    expect(n.objectName).toBe('');
    expect(n.confidence).toBe(0);
    expect(n.components[0]).toMatchObject({ name: 'Part', description: '3' });
    expect(n.primitiveModel![0]).toMatchObject({ shape: 'box', size: [1, 1, 1] });
    expect(normalize({ objectName: 'Earbud', category: null, confidence: 0.8 }, 'gemini')).toMatchObject({ objectName: 'Earbud', category: 'Unknown', holdingObject: true });
  });
  it('treats an empty hand as no object', () => {
    const n = normalize({ ...sampleReply, holdingObject: false }, 'anthropic');
    expect(n.holdingObject).toBe(false);
    expect(n.objectName).toBe('');
    expect(n.confidence).toBe(0);
    expect(normalize(sampleReply, 'anthropic').holdingObject).toBe(true);
  });
  it('extracts JSON from fenced replies', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"a":2} hope this helps')).toEqual({ a: 2 });
  });
});

describe('provider selection', () => {
  it('runs local-only without keys', () => expect(createProvider({})).toBeNull());
  it('auto-detects from keys', () => {
    expect(createProvider({ OPENAI_API_KEY: 'x' })?.id).toBe('openai');
    expect(createProvider({ ANTHROPIC_API_KEY: 'x' })?.id).toBe('anthropic');
    expect(createProvider({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'x' })?.id).toBe('gemini');
  });
});

describe('API (OpenAI-compatible provider against a local stub upstream)', () => {
  let upstream: http.Server;
  let api: http.Server;
  let base = '';
  let lastBody: Record<string, unknown> | null = null;

  beforeAll(async () => {
    upstream = http.createServer((req, res) => {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        lastBody = JSON.parse(data);
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(sampleReply) } }] }));
      });
    });
    await new Promise<void>((r) => upstream.listen(0, r));
    const up = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}/v1`;
    process.env.OPENAI_BASE_URL = up;
    const provider = createProvider({ AI_PROVIDER: 'openai', OPENAI_BASE_URL: up, OPENAI_API_KEY: 'test' });
    api = createApp(provider).listen(0);
    await new Promise((r) => api.once('listening', r));
    base = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    upstream.close();
    api.close();
  });

  it('reports the provider in /api/health', async () => {
    const j = await (await fetch(`${base}/api/health`)).json();
    expect(j.provider).toBe('openai');
  });
  it('POST /api/recognize returns a normalised recognition', async () => {
    const res = await fetch(`${base}/api/recognize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image: 'data:image/jpeg;base64,' + 'A'.repeat(200), hints: [{ label: 'racer', score: 0.6, source: 'classifier' }] }),
    });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.objectName).toBe('Toy Formula 1 car');
    expect(j.archetype).toBe('formula-car');
    // the image is forwarded as a data URL and hints are in the prompt
    const msgs = (lastBody as { messages: { content: unknown }[] }).messages;
    expect(JSON.stringify(msgs[1].content)).toContain('data:image/jpeg;base64,AAAA');
    expect(JSON.stringify(msgs[1].content)).toContain('racer');
  });
  it('rejects malformed requests', async () => {
    const res = await fetch(`${base}/api/recognize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"image":"x"}' });
    expect(res.status).toBe(400);
  });
  it('returns 503 when no provider is configured', async () => {
    const s = createApp(null).listen(0);
    await new Promise((r) => s.once('listening', r));
    const res = await fetch(`http://127.0.0.1:${(s.address() as AddressInfo).port}/api/describe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"query":"phone"}' });
    expect(res.status).toBe(503);
    s.close();
  });
});

describe('remote model catalogs', () => {
  it('loads licensed entries, resolves relative URLs and rejects unlicensed ones', async () => {
    const { remoteCatalog } = await import('../server/services/catalog');
    const srv = http.createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ models: [
        { id: 'drone', name: 'Drone', category: 'Electronics', file: 'models/drone.glb', keywords: ['drone'], license: 'CC-BY-4.0', attribution: 'Jane Doe' },
        { id: 'nolicense', name: 'Bad', category: 'X', file: 'x.glb' },
      ] }));
    });
    await new Promise<void>((r) => srv.listen(0, r));
    const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/catalog.json`;
    const models = await remoteCatalog([url]);
    srv.close();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('remote-drone');
    expect(models[0].file).toBe(url.replace('catalog.json', 'models/drone.glb'));
  });
});
