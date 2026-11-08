import { useEffect, useRef } from 'react';
import { holo, useHolo } from '@/state/store';
import { HandTracker, type HandFrame } from '@/vision/handTracking/handTracker';
import { GestureEngine, type GestureHandlers, type RawHand } from '@/vision/gestureRecognition/gestureEngine';
import type { P3 } from '@/vision/gestureRecognition/analyzeHand';
import { videoToViewport } from '@/utils/coords';
import { viewState } from '@/three/interactions/viewState';
import { sceneApi } from '@/three/interactions/sceneApi';
import { nextModel } from '@/services/modelActions';
import { clearStage } from '@/services/recognitionService';
import type { GestureId } from '@/types';

/** Shared with the overlay renderer. */
export const gestureRuntime: { engine: GestureEngine | null; viewportHands: P3[][] } = { engine: null, viewportHands: [] };

const HINTS: Partial<Record<GestureId, string>> = {
  open: 'Opening – exploding',
  fist: 'Closing – reassembling',
  move: 'Moving / twisting',
  point: 'Pointing – hold to lock this part',
  pinch: 'Pinch – grab a part',
  twoHands: 'Two hands – zoom',
  thumbsUp: 'Thumbs up – next model',
  swipe: 'Swipe – spin',
  clear: 'Hold to clear the screen',
};

function createHandlers(): GestureHandlers {
  let pinchPart: string | null = null;
  let pinchLast: [number, number] | null = null;
  let zoomStart = 1;
  return {
    explodeToward(target, dt) {
      const s = holo();
      const rate = 1.4 * s.settings.sensitivity;
      const cur = s.explode;
      const step = Math.sign(target - cur) * Math.min(Math.abs(target - cur), rate * dt);
      if (Math.abs(step) > 1e-4) s.setExplode(cur + step);
    },
    rotate(dYaw, dPitch) {
      viewState.rotate(dYaw, dPitch);
    },
    swipe(dir) {
      const v = 5 * holo().settings.sensitivity;
      if (dir === 'left') viewState.impulse(-v);
      else if (dir === 'right') viewState.impulse(v);
      else if (dir === 'up') viewState.impulse(0, -v * 0.5);
      else viewState.impulse(0, v * 0.5);
    },
    move(px, py) {
      const api = sceneApi();
      if (!api || holo().focusId) return;
      const w = api.screenToWorld(px, py);
      const h = api.home();
      // keep the hologram slightly above the palm, like it's resting on the hand
      viewState.posTarget.set(w[0] - h[0], w[1] - h[1] + 0.35, 0);
    },
    zoom(ratio, phase) {
      if (phase === 'start') zoomStart = viewState.scaleTarget;
      viewState.scaleTarget = Math.max(0.35, Math.min(4, zoomStart * Math.pow(ratio, 1.2)));
    },
    pinch(phase, px, py) {
      const api = sceneApi();
      if (!api) return;
      if (phase === 'start') {
        pinchPart = api.pick(px, py);
        pinchLast = [px, py];
        if (pinchPart) holo().select(pinchPart);
      } else if (phase === 'move' && pinchLast) {
        if (pinchPart) api.dragPart(pinchPart, pinchLast, [px, py]);
        else viewState.rotate((px - pinchLast[0]) * 0.008, (py - pinchLast[1]) * 0.006);
        pinchLast = [px, py];
      } else {
        api.releasePart();
        pinchPart = null;
        pinchLast = null;
      }
    },
    point(px, py) {
      viewState.hold();
      return sceneApi()?.pick(px, py) ?? null;
    },
    pointHover(id) {
      holo().hover(id);
    },
    pointSelect(id) {
      holo().select(id);
    },
    pointEnd() {
      holo().hover(null);
    },
    thumbsUp() {
      // with an empty stage the user is scanning, so don't drop a sample model on top of the object
      if (holo().model) void nextModel(1);
    },
    release() {
      holo().set({ selectedId: null, isolatedId: null, focusId: null });
    },
    clear() {
      clearStage({ hideControls: true });
    },
    active(g) {
      useHolo.setState({ activeGesture: g, gestureHint: g ? HINTS[g] ?? null : null });
    },
  };
}

/** Runs MediaPipe hand tracking on the camera video and feeds the gesture engine. */
export function useHandTracking(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const cameraLive = useHolo((s) => s.cameraStatus === 'live');
  const trackerRef = useRef<HandTracker | null>(null);

  useEffect(() => {
    if (!cameraLive) return;
    let disposed = false;
    const engine = new GestureEngine(createHandlers(), () => {
      const st = holo().settings;
      return {
        enabled: st.gesturesEnabled,
        toggles: st.gestures,
        sensitivity: st.sensitivity,
        smoothing: st.smoothing,
        followHand: st.followHand,
        calibration: st.calibration,
        partLocked: !!holo().selectedId,
      };
    });
    gestureRuntime.engine = engine;
    let lastHands = -1;
    let lastFpsPush = 0;
    const onFrame = (f: HandFrame) => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const mirror = holo().settings.mirror;
      const vw = { w: f.videoW, h: f.videoH };
      const s = Math.max(W / f.videoW, H / f.videoH) * f.videoW;
      const raw: RawHand[] = f.landmarks.map((lm, i) => ({
        handedness: f.handedness[i],
        pts: lm.map((p) => {
          const [x, y] = videoToViewport(p.x, p.y, vw, { w: W, h: H }, mirror);
          return [x, y, p.z * s] as P3;
        }),
      }));
      gestureRuntime.viewportHands = raw.map((r) => r.pts);
      engine.update(raw, performance.now(), { w: W, h: H });
      if (raw.length !== lastHands) {
        lastHands = raw.length;
        useHolo.setState({ hands: raw.length });
      }
      const now = performance.now();
      if (now - lastFpsPush > 1000 && trackerRef.current) {
        lastFpsPush = now;
        useHolo.setState({ trackFps: Math.round(trackerRef.current.fps) });
      }
    };
    const tracker = new HandTracker(onFrame);
    trackerRef.current = tracker;
    useHolo.setState({ trackingStatus: 'loading' });
    tracker
      .init()
      .then(() => {
        if (disposed || !videoRef.current) return;
        tracker.start(videoRef.current);
        useHolo.setState({ trackingStatus: 'on' });
      })
      .catch((e) => {
        console.error(e);
        if (!disposed) {
          useHolo.setState({ trackingStatus: 'error' });
          holo().toast('Hand tracking failed to load – mouse controls still work.', 'error');
        }
      });
    return () => {
      disposed = true;
      tracker.dispose();
      trackerRef.current = null;
      gestureRuntime.engine = null;
      gestureRuntime.viewportHands = [];
      useHolo.setState({ trackingStatus: 'off', hands: 0, activeGesture: null });
    };
  }, [cameraLive, videoRef]);
}
