import { describe, expect, it, vi } from 'vitest';
import fixtures from './fixtures/hands.json';
import { analyzeHand, type P3 } from '../src/vision/gestureRecognition/analyzeHand';
import { GestureEngine, type GestureHandlers, type EngineSettings } from '../src/vision/gestureRecognition/gestureEngine';

// Landmarks captured from MediaPipe Hand Landmarker running on real photos (see README → Testing).
const F = fixtures as unknown as Record<string, P3[][]>;

describe('analyzeHand (real MediaPipe landmarks)', () => {
  it('classifies a peace sign', () => expect(analyzeHand(F.victory[0]).pose).toBe('peace'));
  it('classifies pointing', () => expect(analyzeHand(F.pointing_up[0]).pose).toBe('point'));
  it('classifies a fist', () => expect(analyzeHand(F.fist[0]).pose).toBe('fist'));
  it('treats thumbs-up as a closed hand, not a pinch', () => expect(analyzeHand(F.thumb_up[0]).pose).not.toBe('pinch'));
  it('sees open fingers in the open-hands photo', () => {
    const a = F.woman_hands.map((h) => analyzeHand(h));
    expect(Math.max(...a.map((x) => x.openness))).toBeGreaterThan(0.66);
    expect(a.some((x) => x.pose === 'open')).toBe(true);
  });
  it('orders openness fist < point < open', () => {
    const fist = analyzeHand(F.fist[0]).openness;
    const point = analyzeHand(F.pointing_up[0]).openness;
    const open = Math.max(...F.woman_hands.map((h) => analyzeHand(h).openness));
    expect(fist).toBeLessThan(point);
    expect(point).toBeLessThan(open);
  });
  it('is scale invariant', () => {
    const big = F.victory[0].map(([x, y, z]) => [x * 2.5 + 100, y * 2.5 - 40, z * 2.5] as P3);
    expect(analyzeHand(big).pose).toBe('peace');
  });
});

function makeEngine(over: Partial<EngineSettings> = {}) {
  const h = {
    explodeToward: vi.fn(), rotate: vi.fn(), swipe: vi.fn(), move: vi.fn(), zoom: vi.fn(), pinch: vi.fn(),
    point: vi.fn(() => 'part-a'), pointSelect: vi.fn(), pointEnd: vi.fn(), peace: vi.fn(), active: vi.fn(),
  } satisfies GestureHandlers;
  const settings: EngineSettings = {
    enabled: true,
    toggles: { open: true, fist: true, move: true, swipe: true, point: true, pinch: true, twoHands: true, peace: true },
    sensitivity: 1, smoothing: 0, followHand: false, calibration: null, ...over,
  };
  return { engine: new GestureEngine(h, () => settings), h };
}
const VP = { w: 1280, h: 720 };
const run = (e: GestureEngine, hands: P3[][], from: number, ms: number) => {
  for (let t = from; t <= from + ms; t += 33) e.update(hands.map((pts) => ({ pts, handedness: 'Right' })), t, VP);
  return from + ms + 33;
};

describe('GestureEngine', () => {
  it('debounces and fires peace once per hold', () => {
    const { engine, h } = makeEngine();
    let t = run(engine, [F.victory[0]], 1000, 1500);
    expect(h.peace).toHaveBeenCalledTimes(1);
    t = run(engine, [F.victory[0]], t, 1500);
    expect(h.peace).toHaveBeenCalledTimes(1); // still holding – no repeat
  });
  it('fist drives explosion towards 0', () => {
    const { engine, h } = makeEngine();
    run(engine, [F.fist[0]], 0, 600);
    expect(h.explodeToward).toHaveBeenCalled();
    expect(h.explodeToward.mock.calls.at(-1)![0]).toBe(0);
  });
  it('open hand drives explosion up', () => {
    const { engine, h } = makeEngine();
    const open = F.woman_hands.find((x) => analyzeHand(x).pose === 'open')!;
    run(engine, [open], 0, 600);
    expect(h.explodeToward.mock.calls.at(-1)![0]).toBeGreaterThan(0.6);
  });
  it('pointing dwell selects the hovered part', () => {
    const { engine, h } = makeEngine();
    run(engine, [F.pointing_up[0]], 0, 1300);
    expect(h.point).toHaveBeenCalled();
    expect(h.pointSelect).toHaveBeenCalledWith('part-a');
  });
  it('two open hands zoom, and moving them apart raises the ratio', () => {
    const { engine, h } = makeEngine();
    const open = F.woman_hands.find((x) => analyzeHand(x).pose === 'open')!;
    const a = open;
    const b = open.map(([x, y, z]) => [x + 300, y, z] as P3);
    const c = open.map(([x, y, z]) => [x + 600, y, z] as P3);
    let t = 0;
    for (; t < 300; t += 33) engine.update([{ pts: a, handedness: 'Left' }, { pts: b, handedness: 'Right' }], t, VP);
    for (; t < 600; t += 33) engine.update([{ pts: a, handedness: 'Left' }, { pts: c, handedness: 'Right' }], t, VP);
    expect(h.zoom).toHaveBeenCalledWith(1, 'start');
    expect(h.zoom.mock.calls.at(-1)![0]).toBeGreaterThan(1.5);
    expect(engine.snapshot.active).toBe('twoHands');
  });
  it('respects disabled gestures', () => {
    const { engine, h } = makeEngine({ toggles: { open: true, fist: true, move: true, swipe: true, point: true, pinch: true, twoHands: true, peace: false } });
    run(engine, [F.victory[0]], 0, 1500);
    expect(h.peace).not.toHaveBeenCalled();
  });
  it('detects a fast horizontal swipe', () => {
    const { engine, h } = makeEngine();
    const open = F.woman_hands.find((x) => analyzeHand(x).pose === 'open')!;
    for (let i = 0, t = 0; i < 8; i++, t += 33) engine.update([{ pts: open.map(([x, y, z]) => [x + i * 60, y, z] as P3), handedness: 'Right' }], t, VP);
    expect(h.swipe).toHaveBeenCalledWith('right');
  });
});
