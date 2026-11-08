import type { RenderMode } from '@/types';
import type { Quality } from '@/three/scene/holoVisuals';

export interface GestureToggles {
  open: boolean;
  fist: boolean;
  move: boolean;
  swipe: boolean;
  point: boolean;
  pinch: boolean;
  twoHands: boolean;
  thumbsUp: boolean;
  clear: boolean;
}

export interface Settings {
  gestures: GestureToggles;
  gesturesEnabled: boolean;
  /** 0.5 .. 2 – scales thresholds & gains. */
  sensitivity: number;
  /** 0 .. 0.95 – exponential landmark smoothing. */
  smoothing: number;
  followHand: boolean;
  /** Calibrated openness ratios (fingertip-to-wrist / palm size). */
  calibration: { fist: number; open: number } | null;
  showSkeleton: boolean;
  showRings: boolean;
  labels: 'auto' | 'always' | 'off';
  mirror: boolean;
  quality: Quality;
  renderMode: RenderMode;
  recognitionEnabled: boolean;
  /** ms between local recognition passes. */
  recognitionInterval: number;
  useCloudAI: boolean;
  /** below this confidence the user is asked to confirm. */
  confirmBelow: number;
}

export const DEFAULT_SETTINGS: Settings = {
  gestures: { open: true, fist: true, move: true, swipe: true, point: true, pinch: true, twoHands: true, thumbsUp: true, clear: true },
  gesturesEnabled: true,
  sensitivity: 1,
  smoothing: 0.55,
  followHand: true,
  calibration: null,
  showSkeleton: true,
  showRings: true,
  labels: 'auto',
  mirror: true,
  quality: 'medium',
  renderMode: 'hologram',
  recognitionEnabled: true,
  recognitionInterval: 650,
  useCloudAI: true,
  confirmBelow: 0.55,
};

const KEY = 'holohand.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed, gestures: { ...DEFAULT_SETTINGS.gestures, ...(parsed.gestures ?? {}) } };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable – settings stay in memory */
  }
}
