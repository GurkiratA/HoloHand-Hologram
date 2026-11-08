import type { GestureId, HandPose } from '@/types';
import type { GestureToggles } from '@/state/settings';
import { analyzeHand, type HandAnalysis, type P3 } from './analyzeHand';

export interface GestureHandlers {
  /** Move explode towards `target` (0..1). */
  explodeToward(target: number, dt: number): void;
  rotate(dYaw: number, dPitch: number): void;
  swipe(dir: 'left' | 'right' | 'up' | 'down'): void;
  /** Hologram should follow this viewport point. */
  move(px: number, py: number): void;
  /** Two-hand zoom: ratio relative to when the gesture started. */
  zoom(ratio: number, phase: 'start' | 'move' | 'end'): void;
  pinch(phase: 'start' | 'move' | 'end', px: number, py: number): void;
  /** Returns the component id under the fingertip (for dwell selection). */
  point(px: number, py: number): string | null;
  /** The part being aimed at, after jitter filtering. */
  pointHover(id: string | null): void;
  pointSelect(id: string): void;
  pointEnd(): void;
  thumbsUp(): void;
  /** Let go of the locked part. */
  release(): void;
  /** Remove everything from the screen. */
  clear(): void;
  active(g: GestureId | null): void;
}

export interface EngineSettings {
  enabled: boolean;
  toggles: GestureToggles;
  sensitivity: number;
  smoothing: number;
  followHand: boolean;
  calibration: { fist: number; open: number } | null;
  /** A part is selected: the hologram holds still until the part is released. */
  partLocked: boolean;
}

export interface RawHand {
  /** Landmarks in viewport pixels. */
  pts: P3[];
  handedness: string;
}

export interface TrackedHand {
  key: string;
  pts: P3[];
  analysis: HandAnalysis;
  pose: HandPose;
  /** Candidate pose + since when (debounce). */
  cand: HandPose;
  candSince: number;
  history: { t: number; x: number; y: number }[];
}

export interface EngineSnapshot {
  hands: TrackedHand[];
  active: GestureId | null;
  twoHands: { a: [number, number]; b: [number, number]; ratio: number } | null;
  primaryKey: string | null;
  pinchPoint: [number, number] | null;
  pointTip: [number, number] | null;
  dwell: number;
  /** Clear gesture hold progress, drawn at the hand making the gesture. */
  clear: { at: [number, number]; progress: number } | null;
}

const POSE_DEBOUNCE_MS = 110;
/** How long the fingertip must stay on a part to lock it. */
const POINT_DWELL_MS = 700;
/** How long the fingertip must stay on a different part / on nothing before the aim changes. */
const POINT_SWITCH_MS = 220;
const POINT_LOST_MS = 450;
/** A pointing hand can drop out of the pose for this long without losing its aim. */
const POINT_GRACE_MS = 300;
const RELEASE_HOLD_MS = 500;
const CLEAR_HOLD_MS = 600;
/**
 * A hand gripping an object reads as neutral or as a fist, and must not steer the hologram.
 * So both only count just after an open hand: they mean "closing", not "holding".
 */
const NEUTRAL_AFTER_OPEN_MS = 800;
const FIST_AFTER_OPEN_MS = 2000;
const PRIORITY: Record<HandPose, number> = { clear: 6, pinch: 5, point: 4, thumbsUp: 3, fist: 2, open: 1, neutral: 0 };

/**
 * Turns per-frame hand landmarks into debounced, mutually exclusive gestures.
 * Pure TypeScript – no DOM / Three.js – so it can be unit-tested.
 */
export class GestureEngine {
  private hands = new Map<string, TrackedHand>();
  private active: GestureId | null = null;
  private primary: string | null = null;
  private engaged = false;
  private two: { startDist: number; ratio: number; a: [number, number]; b: [number, number] } | null = null;
  private twoMiss = 0;
  private pinching = false;
  private pointId: string | null = null;
  private pointSince = 0;
  private pointFired = false;
  private pointing = false;
  /** Different aim waiting to take over (undefined = none; null = aiming at nothing). */
  private pointNext: string | null | undefined = undefined;
  private pointNextSince = 0;
  private pointLostAt = 0;
  private releaseSince = 0;
  private clearSince = 0;
  private clearFired = false;
  private lastOpen = -1e9;
  private thumbsUpSince = 0;
  private thumbsUpFired = false;
  private lastThumbsUp = -1e9;
  private lastSwipe = -1e9;
  private swipeFlashUntil = 0;
  private lastRoll: number | null = null;
  private lastT = 0;
  snapshot: EngineSnapshot = { hands: [], active: null, twoHands: null, primaryKey: null, pinchPoint: null, pointTip: null, dwell: 0, clear: null };

  constructor(private h: GestureHandlers, private getSettings: () => EngineSettings) {}

  update(raw: RawHand[], now: number, viewport: { w: number; h: number }) {
    const s = this.getSettings();
    const dt = this.lastT ? Math.min(0.1, (now - this.lastT) / 1000) : 1 / 30;
    this.lastT = now;

    // ---- smoothing + analysis per hand
    const seen = new Set<string>();
    raw.forEach((r, i) => {
      let key = r.handedness || `hand${i}`;
      if (seen.has(key)) key = `${key}${i}`;
      seen.add(key);
      const prev = this.hands.get(key);
      const a = Math.min(0.95, Math.max(0, s.smoothing));
      const pts: P3[] = prev
        ? r.pts.map((p, j) => [
            prev.pts[j][0] * a + p[0] * (1 - a),
            prev.pts[j][1] * a + p[1] * (1 - a),
            prev.pts[j][2] * a + p[2] * (1 - a),
          ])
        : r.pts.map((p) => [...p] as P3);
      const analysis = analyzeHand(pts, {
        fistRatio: s.calibration?.fist,
        openRatio: s.calibration?.open,
        sensitivity: s.sensitivity,
      });
      const hand: TrackedHand = prev ?? { key, pts, analysis, pose: 'neutral', cand: analysis.pose, candSince: now, history: [] };
      hand.pts = pts;
      hand.analysis = analysis;
      if (analysis.pose !== hand.cand) {
        hand.cand = analysis.pose;
        hand.candSince = now;
      }
      // pinch release should be quick; entering needs to persist
      const need = hand.pose === 'pinch' && hand.cand !== 'pinch' ? 60 : POSE_DEBOUNCE_MS;
      if (hand.cand !== hand.pose && now - hand.candSince >= need) hand.pose = hand.cand;
      hand.history.push({ t: now, x: analysis.palm[0], y: analysis.palm[1] });
      while (hand.history.length && now - hand.history[0].t > 260) hand.history.shift();
      this.hands.set(key, hand);
    });
    for (const k of [...this.hands.keys()]) if (!seen.has(k)) this.hands.delete(k);

    const hands = [...this.hands.values()];
    let active: GestureId | null = null;

    if (!s.enabled || hands.length === 0) {
      this.endAll();
      this.primary = null;
      this.engaged = false;
      this.lastRoll = null;
      this.releaseSince = 0;
      this.clearSince = 0;
      this.clearFired = false;
      this.setActive(null);
      this.snap(hands, null);
      return;
    }

    const T = s.toggles;

    // ---- clear: checked across all hands first, so the free hand works while the other one holds an object
    const clearHand = T.clear ? hands.find((x) => x.pose === 'clear') : undefined;
    if (clearHand) {
      this.endAll();
      if (!this.clearSince) this.clearSince = now;
      if (!this.clearFired && now - this.clearSince >= CLEAR_HOLD_MS) {
        this.clearFired = true;
        this.h.clear();
      }
      this.setActive('clear');
      this.snap(hands, 'clear', { at: clearHand.analysis.palm, progress: Math.min(1, (now - this.clearSince) / CLEAR_HOLD_MS) });
      return;
    }
    this.clearSince = 0;
    this.clearFired = false;

    // ---- two-handed zoom
    const bothOpen = hands.length >= 2 && hands[0].pose !== 'fist' && hands[1].pose !== 'fist' &&
      hands[0].analysis.openness > 0.6 && hands[1].analysis.openness > 0.6;
    if (T.twoHands && bothOpen) {
      this.twoMiss = 0;
      const a = hands[0].analysis.palm;
      const b = hands[1].analysis.palm;
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (!this.two) {
        this.endSingle();
        this.two = { startDist: dist, ratio: 1, a, b };
        this.h.zoom(1, 'start');
      }
      this.two.ratio = dist / Math.max(1, this.two.startDist);
      this.two.a = a;
      this.two.b = b;
      this.h.zoom(this.two.ratio, 'move');
      if (s.followHand && !s.partLocked) this.h.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      active = 'twoHands';
      this.setActive(active);
      this.snap(hands, active);
      return;
    }
    if (this.two) {
      if (++this.twoMiss > 4) {
        this.h.zoom(this.two.ratio, 'end');
        this.two = null;
      } else {
        this.snap(hands, 'twoHands');
        return;
      }
    }

    // ---- choose primary hand (sticky unless another hand shows a stronger intent)
    let primary = hands.find((x) => x.key === this.primary) ?? hands[0];
    for (const x of hands) if (PRIORITY[x.pose] > PRIORITY[primary.pose] + 1) primary = x;
    if (primary.key !== this.primary) {
      this.endSingle();
      this.primary = primary.key;
      this.lastRoll = null;
    }
    const A = primary.analysis;
    const pose = primary.pose;

    // ---- pinch: select / drag
    if (pose === 'pinch' && T.pinch) {
      if (!this.pinching) {
        this.endPoint();
        this.pinching = true;
        this.h.pinch('start', A.pinchPoint[0], A.pinchPoint[1]);
      } else this.h.pinch('move', A.pinchPoint[0], A.pinchPoint[1]);
      active = 'pinch';
    } else if (this.pinching) {
      this.pinching = false;
      this.h.pinch('end', A.pinchPoint[0], A.pinchPoint[1]);
    }

    // ---- point: hover + dwell select
    if (!active && pose === 'point' && T.point) {
      this.pointing = true;
      this.pointLostAt = 0;
      const id = this.settlePoint(this.h.point(A.indexTip[0], A.indexTip[1]), now);
      if (id && !this.pointFired && now - this.pointSince >= POINT_DWELL_MS) {
        this.pointFired = true;
        this.h.pointSelect(id);
      }
      active = 'point';
    } else if (this.pointing && pose !== 'point') {
      if (!this.pointLostAt) this.pointLostAt = now;
      if (now - this.pointLostAt >= POINT_GRACE_MS) this.endPoint();
      else active = 'point';
    }

    // ---- thumbs up: next model (hold, then require release)
    if (!active && pose === 'thumbsUp' && T.thumbsUp) {
      if (!this.thumbsUpSince) this.thumbsUpSince = now;
      if (!this.thumbsUpFired && now - this.thumbsUpSince > 450 && now - this.lastThumbsUp > 1800) {
        this.thumbsUpFired = true;
        this.lastThumbsUp = now;
        this.h.thumbsUp();
      }
      active = 'thumbsUp';
    } else if (pose !== 'thumbsUp') {
      this.thumbsUpSince = 0;
      this.thumbsUpFired = false;
    }

    // ---- open / fist / move
    if (pose !== 'fist' || !s.partLocked) this.releaseSince = 0;
    if (!active && s.partLocked) {
      // the hologram holds still around the locked part; a held fist lets go of it
      this.lastRoll = null;
      if (pose === 'fist' && T.fist) {
        if (!this.releaseSince) this.releaseSince = now;
        if (now - this.releaseSince >= RELEASE_HOLD_MS) {
          this.releaseSince = 0;
          this.h.release();
        }
        active = 'fist';
      }
    } else if (!active && (pose === 'open' || pose === 'fist' || pose === 'neutral')) {
      if (pose === 'open') {
        this.engaged = true;
        this.lastOpen = now;
      }
      const deliberate = this.engaged && now - this.lastOpen < (pose === 'fist' ? FIST_AFTER_OPEN_MS : NEUTRAL_AFTER_OPEN_MS);
      if (deliberate) {
        const target = Math.max(0, Math.min(1, (A.openness - 0.22) / 0.62));
        if ((pose === 'fist' && T.fist) || (pose !== 'fist' && T.open)) this.h.explodeToward(target, dt);
        active = pose === 'fist' ? 'fist' : pose === 'open' ? 'open' : 'move';
      }
      if (T.move && deliberate) {
        if (s.followHand) this.h.move(A.palm[0], A.palm[1]);
        // twist: roll change rotates the hologram
        if (pose === 'open') {
          if (this.lastRoll !== null) {
            let dr = A.roll - this.lastRoll;
            if (dr > Math.PI) dr -= Math.PI * 2;
            if (dr < -Math.PI) dr += Math.PI * 2;
            if (Math.abs(dr) > 0.012) {
              this.h.rotate(-dr * 1.6 * s.sensitivity, 0);
              if (Math.abs(dr) > 0.03) active = 'move';
            }
          }
          this.lastRoll = A.roll;
        } else this.lastRoll = null;
      }
      // swipe
      if (T.swipe && deliberate && primary.history.length > 3 && now - this.lastSwipe > 700) {
        const h0 = primary.history[0];
        const h1 = primary.history[primary.history.length - 1];
        const dx = (h1.x - h0.x) / viewport.w;
        const dy = (h1.y - h0.y) / viewport.h;
        const thr = 0.2 / s.sensitivity;
        if (Math.abs(dx) > thr && Math.abs(dx) > Math.abs(dy) * 1.8) {
          this.h.swipe(dx < 0 ? 'left' : 'right');
          this.lastSwipe = now;
          this.swipeFlashUntil = now + 450;
        } else if (Math.abs(dy) > thr * 1.2 && Math.abs(dy) > Math.abs(dx) * 1.8) {
          this.h.swipe(dy < 0 ? 'up' : 'down');
          this.lastSwipe = now;
          this.swipeFlashUntil = now + 450;
        }
      }
      if (now < this.swipeFlashUntil) active = 'swipe';
    }

    this.setActive(active);
    this.snap(hands, active);
  }

  /** Filters fingertip jitter: a new aim has to persist before it replaces the current one. */
  private settlePoint(hit: string | null, now: number): string | null {
    if (hit === this.pointId) {
      this.pointNext = undefined;
      return this.pointId;
    }
    if (this.pointNext !== hit) {
      this.pointNext = hit;
      this.pointNextSince = now;
    }
    const hold = this.pointId === null ? 0 : hit === null ? POINT_LOST_MS : POINT_SWITCH_MS;
    if (now - this.pointNextSince >= hold) {
      this.pointId = hit;
      this.pointSince = now;
      this.pointFired = false;
      this.pointNext = undefined;
      this.h.pointHover(hit);
    }
    return this.pointId;
  }

  private snap(hands: TrackedHand[], active: GestureId | null, clear: EngineSnapshot['clear'] = null) {
    const primary = hands.find((h) => h.key === this.primary) ?? null;
    this.snapshot = {
      hands,
      active,
      twoHands: this.two ? { a: this.two.a, b: this.two.b, ratio: this.two.ratio } : null,
      primaryKey: this.primary,
      pinchPoint: this.pinching && primary ? primary.analysis.pinchPoint : null,
      pointTip: this.pointing && primary ? primary.analysis.indexTip : null,
      dwell: this.pointing && this.pointId && !this.pointFired ? Math.min(1, (this.lastT - this.pointSince) / POINT_DWELL_MS) : 0,
      clear,
    };
  }

  private setActive(g: GestureId | null) {
    if (g !== this.active) {
      this.active = g;
      this.h.active(g);
    }
  }

  private endPoint() {
    if (this.pointing) {
      this.pointing = false;
      this.pointId = null;
      this.pointNext = undefined;
      this.pointLostAt = 0;
      this.h.pointEnd();
    }
  }

  private endSingle() {
    if (this.pinching) {
      this.pinching = false;
      this.h.pinch('end', 0, 0);
    }
    this.endPoint();
  }

  private endAll() {
    this.endSingle();
    if (this.two) {
      this.h.zoom(this.two.ratio, 'end');
      this.two = null;
    }
  }
}
