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

      for (const hand of snap.hands) {
        const pts = hand.pts;
        const A = hand.analysis;
        const isPrimary = hand.key === snap.primaryKey;
        const tint = isPrimary && snap.active ? activeColor(snap.active) : 'rgba(255,255,255,';
        if (st.showRings) {
          const r = A.palmSize * 2.35;
          ctx.save();
          ctx.shadowColor = 'rgba(255,255,255,0.8)';
          ctx.shadowBlur = 14;
          ctx.strokeStyle = `${tint}0.9)`;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(A.palm[0], A.palm[1], r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = `${tint}0.35)`;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 10]);
          ctx.lineDashOffset = -t * 30;
          ctx.beginPath();
          ctx.arc(A.palm[0], A.palm[1], r * 1.08, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          // openness arc
          ctx.strokeStyle = 'rgba(255,216,74,0.85)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(A.palm[0], A.palm[1], r * 1.15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * A.openness);
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

      // two-hand zoom line
      if (snap.twoHands) {
        const { a, b, ratio } = snap.twoHands;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,216,74,0.9)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '600 11px Inter, sans-serif';
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
        ctx.strokeStyle = '#ffd84a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 9 + Math.sin(t * 8) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      // pointer + dwell progress
      if (snap.pointTip) {
        const [x, y] = snap.pointTip;
        ctx.fillStyle = '#3ff0e0';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        if (snap.dwell > 0) {
          ctx.strokeStyle = '#3ff0e0';
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
      return 'rgba(255,236,170,';
    case 'point':
      return 'rgba(140,255,245,';
    case 'fist':
      return 'rgba(255,170,200,';
    default:
      return 'rgba(255,255,255,';
  }
}
