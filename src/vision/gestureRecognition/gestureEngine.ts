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
  pointSelect(id: string): void;
  pointEnd(): void;
  peace(): void;
  active(g: GestureId | null): void;
}

export interface EngineSettings {
  enabled: boolean;
  toggles: GestureToggles;
  sensitivity: number;
  smoothing: number;
  followHand: boolean;
  calibration: { fist: number; open: number } | null;
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
}

const POSE_DEBOUNCE_MS = 110;
const PRIORITY: Record<HandPose, number> = { pinch: 5, point: 4, peace: 3, fist: 2, open: 1, neutral: 0 };

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
  private peaceSince = 0;
  private peaceFired = false;
  private lastPeace = -1e9;
  private lastSwipe = -1e9;
  private swipeFlashUntil = 0;
  private lastRoll: number | null = null;
  private lastT = 0;
  snapshot: EngineSnapshot = { hands: [], active: null, twoHands: null, primaryKey: null, pinchPoint: null, pointTip: null, dwell: 0 };

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
      this.setActive(null);
      this.snap(hands, null);
      return;
    }

    const T = s.toggles;

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
      if (s.followHand) this.h.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
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
      const id = this.h.point(A.indexTip[0], A.indexTip[1]);
      this.pointing = true;
      if (id !== this.pointId) {
        this.pointId = id;
        this.pointSince = now;
        this.pointFired = false;
      } else if (id && !this.pointFired && now - this.pointSince > 900) {
        this.pointFired = true;
        this.h.pointSelect(id);
      }
      active = 'point';
    } else if (this.pointing && pose !== 'point') this.endPoint();

    // ---- peace: next model (hold, then require release)
    if (!active && pose === 'peace' && T.peace) {
      if (!this.peaceSince) this.peaceSince = now;
      if (!this.peaceFired && now - this.peaceSince > 450 && now - this.lastPeace > 1800) {
        this.peaceFired = true;
        this.lastPeace = now;
        this.h.peace();
      }
      active = 'peace';
    } else if (pose !== 'peace') {
      this.peaceSince = 0;
      this.peaceFired = false;
    }

    // ---- open / fist / move
    if (!active && (pose === 'open' || pose === 'fist' || pose === 'neutral')) {
      if (pose === 'open' || pose === 'fist') this.engaged = true;
      if (this.engaged) {
        const target = Math.max(0, Math.min(1, (A.openness - 0.22) / 0.62));
        if ((pose === 'fist' && T.fist) || (pose !== 'fist' && T.open)) this.h.explodeToward(target, dt);
        active = pose === 'fist' ? 'fist' : pose === 'open' ? 'open' : 'move';
      }
      if (T.move) {
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
      if (T.swipe && primary.history.length > 3 && now - this.lastSwipe > 700) {
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

  private snap(hands: TrackedHand[], active: GestureId | null) {
    const primary = hands.find((h) => h.key === this.primary) ?? null;
    this.snapshot = {
      hands,
      active,
      twoHands: this.two ? { a: this.two.a, b: this.two.b, ratio: this.two.ratio } : null,
      primaryKey: this.primary,
      pinchPoint: this.pinching && primary ? primary.analysis.pinchPoint : null,
      pointTip: this.pointing && primary ? primary.analysis.indexTip : null,
      dwell: this.pointing && this.pointId && !this.pointFired ? Math.min(1, (this.lastT - this.pointSince) / 900) : 0,
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
