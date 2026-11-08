import { describe, expect, it, vi } from 'vitest';
import fixtures from './fixtures/hands.json';
import { analyzeHand, type P3 } from '../src/vision/gestureRecognition/analyzeHand';
import { GestureEngine, type GestureHandlers, type EngineSettings } from '../src/vision/gestureRecognition/gestureEngine';

// Landmarks captured from MediaPipe Hand Landmarker running on real photos (see README → Testing).
const F = fixtures as unknown as Record<string, P3[][]>;

describe('analyzeHand (real MediaPipe landmarks)', () => {
  it('classifies a thumbs-up', () => expect(analyzeHand(F.thumb_up[0]).pose).toBe('thumbsUp'));
  it('does not read a peace sign as thumbs-up', () => expect(analyzeHand(F.victory[0]).pose).not.toBe('thumbsUp'));
  it('classifies pointing', () => expect(analyzeHand(F.pointing_up[0]).pose).toBe('point'));
  it('classifies a fist', () => expect(analyzeHand(F.fist[0]).pose).toBe('fist'));
  it('does not read the other poses as thumbs-up', () => {
    for (const k of ['victory', 'fist', 'pointing_up', 'woman_hands']) for (const h of F[k]) expect(analyzeHand(h).pose).not.toBe('thumbsUp');
    expect(analyzeHand(holdingHand()).pose).not.toBe('thumbsUp');
  });
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
  it('classifies the rock sign', () => expect(analyzeHand(rockHand()).pose).toBe('clear'));
  it('does not read the other poses as the rock sign', () => {
    for (const k of ['victory', 'fist', 'pointing_up', 'thumb_up', 'woman_hands']) for (const h of F[k]) expect(analyzeHand(h).pose).not.toBe('clear');
  });
  it('is scale invariant', () => {
    const big = F.thumb_up[0].map(([x, y, z]) => [x * 2.5 + 100, y * 2.5 - 40, z * 2.5] as P3);
    expect(analyzeHand(big).pose).toBe('thumbsUp');
  });
});

/**
 * No photo of this pose in the fixtures: a real pointing hand with the pinky
 * raised, built by giving it the same direction and length as the index finger.
 */
const rockHand = (): P3[] => {
  const pts = F.pointing_up[0].map((p) => [...p] as P3);
  const mcp = pts[17];
  ([[18, 6, 0.8], [19, 7, 0.8], [20, 8, 0.8]] as const).forEach(([pinky, index, k]) => {
    pts[pinky] = [0, 1, 2].map((i) => mcp[i] + (F.pointing_up[0][index][i] - F.pointing_up[0][5][i]) * k) as P3;
  });
  return pts;
};
/** A relaxed, half-curled hand, like one wrapped around an object. */
const holdingHand = (): P3[] => {
  const pts = F.fist[0].map((p) => [...p] as P3);
  const w = pts[0];
  const palm = Math.hypot(pts[9][0] - w[0], pts[9][1] - w[1], pts[9][2] - w[2]);
  for (const tip of [8, 12, 16, 20]) {
    const k = (1.33 * palm) / Math.hypot(pts[tip][0] - w[0], pts[tip][1] - w[1], pts[tip][2] - w[2]);
    pts[tip] = [w[0] + (pts[tip][0] - w[0]) * k, w[1] + (pts[tip][1] - w[1]) * k, w[2] + (pts[tip][2] - w[2]) * k];
  }
  return pts;
};

function makeEngine(over: Partial<EngineSettings> = {}) {
  const h = {
    explodeToward: vi.fn(), rotate: vi.fn(), swipe: vi.fn(), move: vi.fn(), zoom: vi.fn(), pinch: vi.fn(),
    point: vi.fn((): string | null => 'part-a'), pointHover: vi.fn(), pointSelect: vi.fn(), pointEnd: vi.fn(), thumbsUp: vi.fn(), release: vi.fn(), clear: vi.fn(), active: vi.fn(),
  } satisfies GestureHandlers;
  const settings: EngineSettings = {
    enabled: true,
    toggles: { open: true, fist: true, move: true, swipe: true, point: true, pinch: true, twoHands: true, thumbsUp: true, clear: true },
    sensitivity: 1, smoothing: 0, followHand: false, calibration: null, partLocked: false, ...over,
  };
  return { engine: new GestureEngine(h, () => settings), h };
}
const VP = { w: 1280, h: 720 };
const run = (e: GestureEngine, hands: P3[][], from: number, ms: number) => {
  for (let t = from; t <= from + ms; t += 33) e.update(hands.map((pts) => ({ pts, handedness: 'Right' })), t, VP);
  return from + ms + 33;
};

describe('GestureEngine', () => {
  it('debounces and fires thumbs-up once per hold', () => {
    const { engine, h } = makeEngine();
    let t = run(engine, [F.thumb_up[0]], 1000, 1500);
    expect(h.thumbsUp).toHaveBeenCalledTimes(1);
    t = run(engine, [F.thumb_up[0]], t, 1500);
    expect(h.thumbsUp).toHaveBeenCalledTimes(1); // still holding – no repeat
  });
  it('closing an open hand drives explosion towards 0', () => {
    const { engine, h } = makeEngine();
    const open = F.woman_hands.find((x) => analyzeHand(x).pose === 'open')!;
    const t = run(engine, [open], 0, 300);
    run(engine, [F.fist[0]], t, 600);
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
    const { engine, h } = makeEngine({ toggles: { open: true, fist: true, move: true, swipe: true, point: true, pinch: true, twoHands: true, thumbsUp: false, clear: true } });
    run(engine, [F.thumb_up[0]], 0, 1500);
    expect(h.thumbsUp).not.toHaveBeenCalled();
  });
  describe('pointing at a part', () => {
    const point = (e: GestureEngine, t: number) => e.update([{ pts: F.pointing_up[0], handedness: 'Right' }], t, VP);
    /** Runs frames, with the fingertip over `hit(t)`. */
    const aim = (e: GestureEngine, h: ReturnType<typeof makeEngine>['h'], from: number, ms: number, hit: (t: number) => string | null) => {
      for (let t = from; t <= from + ms; t += 33) {
        h.point.mockReturnValue(hit(t));
        point(e, t);
      }
      return from + ms + 33;
    };

    it('locks in spite of the fingertip flickering off the part', () => {
      const { engine, h } = makeEngine();
      const t = aim(engine, h, 0, 200, () => 'part-a');
      aim(engine, h, t, 1000, (ts) => (Math.floor(ts / 33) % 5 === 4 ? 'part-b' : Math.floor(ts / 33) % 7 === 6 ? null : 'part-a'));
      expect(h.pointSelect).toHaveBeenCalledWith('part-a');
      expect(h.pointSelect).not.toHaveBeenCalledWith('part-b');
      expect(h.pointHover).not.toHaveBeenCalledWith('part-b');
    });
    it('moves to another part once the fingertip really stays there', () => {
      const { engine, h } = makeEngine();
      const t = aim(engine, h, 0, 1000, () => 'part-a');
      aim(engine, h, t, 1200, () => 'part-b');
      expect(h.pointSelect).toHaveBeenLastCalledWith('part-b');
    });
    it('survives the pose dropping out for a moment', () => {
      const { engine, h } = makeEngine();
      let t = aim(engine, h, 0, 300, () => 'part-a');
      t = run(engine, [holdingHand()], t, 200);
      aim(engine, h, t, 200, () => 'part-a');
      expect(h.pointEnd).not.toHaveBeenCalled();
    });
    it('keeps the hologram still while a part is locked, whatever the hand does', () => {
      const { engine, h } = makeEngine({ partLocked: true, followHand: true });
      const open = F.woman_hands.find((x) => analyzeHand(x).pose === 'open')!;
      const t = run(engine, [open], 0, 800);
      for (let i = 0, ts = t; i < 8; i++, ts += 33) engine.update([{ pts: open.map(([x, y, z]) => [x + i * 60, y, z] as P3), handedness: 'Right' }], ts, VP);
      run(engine, [holdingHand()], t + 400, 800);
      expect(h.move).not.toHaveBeenCalled();
      expect(h.explodeToward).not.toHaveBeenCalled();
      expect(h.swipe).not.toHaveBeenCalled();
      expect(h.rotate).not.toHaveBeenCalled();
      expect(h.release).not.toHaveBeenCalled();
    });
    it('lets go of the part on a held fist', () => {
      const { engine, h } = makeEngine({ partLocked: true });
      run(engine, [F.fist[0]], 0, 400);
      expect(h.release).not.toHaveBeenCalled();
      run(engine, [F.fist[0]], 433, 400);
      expect(h.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('holding an object', () => {
    it('reads as a neutral pose', () => expect(analyzeHand(holdingHand()).pose).toBe('neutral'));
    it.each([['a loose grip', holdingHand], ['a tight grip', () => F.fist[0]]])('does not drag or collapse the hologram with %s', (_, grip) => {
      const { engine, h } = makeEngine({ followHand: true });
      run(engine, [grip()], 0, 1500);
      expect(h.move).not.toHaveBeenCalled();
      expect(h.explodeToward).not.toHaveBeenCalled();
    });
    it('stops steering soon after a deliberate pose ends', () => {
      const { engine, h } = makeEngine({ followHand: true });
      const open = F.woman_hands.find((x) => analyzeHand(x).pose === 'open')!;
      const t = run(engine, [open], 0, 400);
      run(engine, [holdingHand()], t, 1000);
      h.move.mockClear();
      h.explodeToward.mockClear();
      run(engine, [holdingHand()], t + 1033, 500);
      expect(h.move).not.toHaveBeenCalled();
      expect(h.explodeToward).not.toHaveBeenCalled();
    });
  });

  describe('clear gesture', () => {
    it('fires once per hold, after the hold time', () => {
      const { engine, h } = makeEngine();
      const t = run(engine, [rockHand()], 0, 500);
      expect(h.clear).not.toHaveBeenCalled();
      expect(engine.snapshot.clear?.progress).toBeGreaterThan(0);
      const t2 = run(engine, [rockHand()], t, 1500);
      expect(h.clear).toHaveBeenCalledTimes(1);
      run(engine, [holdingHand()], t2, 300);
      run(engine, [rockHand()], t2 + 333, 900);
      expect(h.clear).toHaveBeenCalledTimes(2);
    });
    it('works from the free hand while the other hand holds an object', () => {
      const { engine, h } = makeEngine();
      for (let t = 0; t <= 900; t += 33) engine.update([{ pts: holdingHand(), handedness: 'Left' }, { pts: rockHand(), handedness: 'Right' }], t, VP);
      expect(h.clear).toHaveBeenCalledTimes(1);
    });
    it('can be turned off', () => {
      const { engine, h } = makeEngine({ toggles: { open: true, fist: true, move: true, swipe: true, point: true, pinch: true, twoHands: true, thumbsUp: true, clear: false } });
      run(engine, [rockHand()], 0, 1500);
      expect(h.clear).not.toHaveBeenCalled();
    });
  });

  it('detects a fast horizontal swipe', () => {
    const { engine, h } = makeEngine();
    const open = F.woman_hands.find((x) => analyzeHand(x).pose === 'open')!;
    for (let i = 0, t = 0; i < 8; i++, t += 33) engine.update([{ pts: open.map(([x, y, z]) => [x + i * 60, y, z] as P3), handedness: 'Right' }], t, VP);
    expect(h.swipe).toHaveBeenCalledWith('right');
  });
});
