import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { holo } from '@/state/store';
import { gestureRuntime } from '@/hooks/useHandTracking';
import { HAND_CONNECTIONS } from '@/vision/gestureRecognition/analyzeHand';

/** Draws hand skeletons, holographic rings and gesture feedback on a 2D canvas. */
export const HandOverlay = forwardRef<HTMLCanvasElement>(function HandOverlay(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(ref, () => canvas.current!);

  useEffect(() => {
    let raf = 0;
    let t = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      t += 1 / 60;
      const c = canvas.current;
      if (!c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = window.innerWidth;
      const H = window.innerHeight;
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      }
      const ctx = c.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const st = holo().settings;
      const snap = gestureRuntime.engine?.snapshot;
      if (!snap) return;
      // a cleared screen stays clear: no hand graphics over the object
      const hands = holo().stageClear ? [] : snap.hands;

      for (const hand of hands) {
        const pts = hand.pts;
        const A = hand.analysis;
        const isPrimary = hand.key === snap.primaryKey;
        const tint = isPrimary && snap.active ? activeColor(snap.active) : 'rgba(255,255,255,';
        if (st.showRings) {
          // corner brackets around the hand, with an openness meter along the bottom
          const r = A.palmSize * 1.9;
          const arm = r * 0.3;
          const [x, y] = A.palm;
          ctx.save();
          ctx.strokeStyle = `${tint}0.9)`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            ctx.moveTo(x + sx * r, y + sy * (r - arm));
            ctx.lineTo(x + sx * r, y + sy * r);
            ctx.lineTo(x + sx * (r - arm), y + sy * r);
          }
          ctx.stroke();
          ctx.strokeStyle = 'rgba(200,245,96,0.9)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x - r, y + r + 8);
          ctx.lineTo(x - r + 2 * r * A.openness, y + r + 8);
          ctx.stroke();
          ctx.restore();
        }
        if (st.showSkeleton) {
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          for (const [a, b] of HAND_CONNECTIONS) {
            ctx.moveTo(pts[a][0], pts[a][1]);
            ctx.lineTo(pts[b][0], pts[b][1]);
          }
          ctx.stroke();
          ctx.fillStyle = 'white';
          for (const p of pts) {
            ctx.beginPath();
            ctx.arc(p[0], p[1], 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // clear gesture: hold progress
      if (snap.clear) {
        const { at: [x, y], progress } = snap.clear;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#ff6b7d';
        ctx.beginPath();
        ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // two-hand zoom line
      if (snap.twoHands) {
        const { a, b, ratio } = snap.twoHands;
        ctx.save();
        ctx.strokeStyle = 'rgba(200,245,96,0.9)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '600 11px "Space Grotesk", sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(`zoom ${ratio.toFixed(2)}x`, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 10);
        ctx.restore();
      }
      // pinch cursor
      if (snap.pinchPoint) {
        const [x, y] = snap.pinchPoint;
        ctx.strokeStyle = '#c8f560';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 9 + Math.sin(t * 8) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      // pointer + dwell progress
      if (snap.pointTip) {
        const [x, y] = snap.pointTip;
        ctx.fillStyle = '#a7b4ff';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        if (snap.dwell > 0) {
          ctx.strokeStyle = '#a7b4ff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(x, y, 13, -Math.PI / 2, -Math.PI / 2 + snap.dwell * Math.PI * 2);
          ctx.stroke();
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvas} className="pointer-events-none fixed inset-0 z-20 h-full w-full" />;
});

function activeColor(g: string) {
  switch (g) {
    case 'pinch':
    case 'twoHands':
    case 'open':
      return 'rgba(200,245,96,';
    case 'point':
      return 'rgba(167,180,255,';
    case 'fist':
      return 'rgba(255,170,200,';
    case 'clear':
      return 'rgba(255,107,125,';
    default:
      return 'rgba(255,255,255,';
  }
}
