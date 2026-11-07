import { HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { getFileset, MP_MODELS, resolveModel, withDelegate } from '../mediapipe';

export interface HandFrame {
  /** Normalised video landmarks per hand. */
  landmarks: { x: number; y: number; z: number }[][];
  handedness: string[];
  videoW: number;
  videoH: number;
  timestamp: number;
}

/** Latest hand result – read by the overlay renderer and the recogniser. */
export const latestHands: { frame: HandFrame | null } = { frame: null };

/**
 * Runs MediaPipe Hand Landmarker on a <video> element. Adapts its inference rate:
 * if a frame takes longer than ~30 ms it skips the next frame(s).
 */
export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private raf = 0;
  private running = false;
  private lastVideoTime = -1;
  private skip = 0;
  private frames = 0;
  private fpsT = performance.now();
  fps = 0;

  constructor(private onFrame: (f: HandFrame) => void) {}

  async init() {
    if (this.landmarker) return;
    const fs = await getFileset();
    const modelAssetPath = await resolveModel(MP_MODELS.hand);
    this.landmarker = await withDelegate((delegate) =>
      HandLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      }),
    );
  }

  start(video: HTMLVideoElement) {
    this.video = video;
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    this.raf = requestAnimationFrame(loop);
  }

  private tick() {
    const v = this.video;
    if (!v || !this.landmarker || v.readyState < 2 || !v.videoWidth) return;
    if (v.currentTime === this.lastVideoTime) return;
    if (this.skip > 0) {
      this.skip--;
      return;
    }
    this.lastVideoTime = v.currentTime;
    const t0 = performance.now();
    let res: HandLandmarkerResult;
    try {
      res = this.landmarker.detectForVideo(v, t0);
    } catch (e) {
      console.warn('[hands] inference error', e);
      return;
    }
    const cost = performance.now() - t0;
    this.skip = cost > 45 ? 2 : cost > 28 ? 1 : 0;
    const frame: HandFrame = {
      landmarks: res.landmarks.map((l) => l.map((p) => ({ x: p.x, y: p.y, z: p.z }))),
      handedness: res.handedness.map((h) => h[0]?.categoryName ?? 'Hand'),
      videoW: v.videoWidth,
      videoH: v.videoHeight,
      timestamp: t0,
    };
    latestHands.frame = frame;
    this.frames++;
    if (t0 - this.fpsT > 1000) {
      this.fps = (this.frames * 1000) / (t0 - this.fpsT);
      this.frames = 0;
      this.fpsT = t0;
    }
    this.onFrame(frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    latestHands.frame = null;
  }

  dispose() {
    this.stop();
    this.landmarker?.close();
    this.landmarker = null;
  }
}
