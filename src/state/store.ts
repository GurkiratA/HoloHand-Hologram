import { create } from 'zustand';
import type { LoadedModel } from '@/three/models/prepareModel';
import type { AppMode, GestureId, ModelDescriptor, RecognitionResult, RenderMode } from '@/types';
import { loadSettings, saveSettings, type Settings } from './settings';

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'unavailable' | 'error';
export type TrackingStatus = 'off' | 'loading' | 'on' | 'error';
export type RecognitionStatus =
  | 'idle'
  | 'loading'
  | 'scanning'
  | 'analyzing'
  | 'detected'
  | 'confirm'
  | 'locked'
  | 'error';

export interface ServerInfo {
  reachable: boolean;
  provider: string | null;
  model: string | null;
  remoteCatalogs: number;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'warn' | 'error' | 'ok';
}

export interface HoloState {
  // model
  model: LoadedModel | null;
  /** Descriptor without geometry – used for recognition-only (Level 3) results too. */
  descriptor: ModelDescriptor | null;
  modelLoading: boolean;
  modelKey: string | null;

  // exploded view
  explode: number;
  intensity: number;
  autoSpin: boolean;
  selectedId: string | null;
  hoveredId: string | null;
  isolatedId: string | null;
  focusId: string | null;
  viewResetToken: number;

  // recognition
  recognition: RecognitionResult | null;
  recognitionStatus: RecognitionStatus;
  recognitionMessage: string;
  scanToken: number;

  // camera & tracking
  cameraStatus: CameraStatus;
  cameraError: string | null;
  cameraAttempt: number;
  devices: MediaDeviceInfo[];
  deviceId: string | null;
  showFeed: boolean;
  trackingStatus: TrackingStatus;
  hands: number;
  activeGesture: GestureId | null;
  gestureHint: string | null;
  renderFps: number;
  trackFps: number;

  mode: AppMode;
  settings: Settings;
  server: ServerInfo;

  panels: {
    settings: boolean;
    explorer: boolean;
    explorerTab: 'components' | 'info';
    library: boolean;
    scan: boolean;
    upload: boolean;
    cameraMenu: boolean;
  };
  toasts: Toast[];

  // actions
  set: (p: Partial<HoloState>) => void;
  setExplode: (v: number) => void;
  setIntensity: (v: number) => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  isolate: (id: string | null) => void;
  focus: (id: string | null) => void;
  setRenderMode: (m: RenderMode) => void;
  updateSettings: (p: Partial<Settings>) => void;
  togglePanel: (k: keyof HoloState['panels'], v?: boolean) => void;
  resetView: () => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  rescan: () => void;
}

let toastId = 0;

export const useHolo = create<HoloState>((set, get) => ({
  model: null,
  descriptor: null,
  modelLoading: false,
  modelKey: null,

  explode: 0,
  intensity: 1.4,
  autoSpin: true,
  selectedId: null,
  hoveredId: null,
  isolatedId: null,
  focusId: null,
  viewResetToken: 0,

  recognition: null,
  recognitionStatus: 'idle',
  recognitionMessage: '',
  scanToken: 0,

  cameraStatus: 'idle',
  cameraError: null,
  cameraAttempt: 0,
  devices: [],
  deviceId: null,
  showFeed: true,
  trackingStatus: 'off',
  hands: 0,
  activeGesture: null,
  gestureHint: null,
  renderFps: 0,
  trackFps: 0,

  mode: 'live',
  settings: loadSettings(),
  server: { reachable: false, provider: null, model: null, remoteCatalogs: 0 },

  panels: { settings: false, explorer: false, explorerTab: 'components', library: false, scan: false, upload: false, cameraMenu: false },
  toasts: [],

  set: (p) => set(p),
  setExplode: (v) => set({ explode: Math.max(0, Math.min(1, v)) }),
  setIntensity: (v) => set({ intensity: Math.max(0.2, Math.min(2, v)) }),
  select: (id) => set((s) => ({ selectedId: id, focusId: id === null ? null : s.focusId === id ? id : null })),
  hover: (id) => {
    if (get().hoveredId !== id) set({ hoveredId: id });
  },
  isolate: (id) => set({ isolatedId: id, selectedId: id ?? get().selectedId }),
  focus: (id) => set({ focusId: id }),
  setRenderMode: (m) => get().updateSettings({ renderMode: m }),
  updateSettings: (p) => {
    const settings = { ...get().settings, ...p };
    saveSettings(settings);
    set({ settings });
  },
  togglePanel: (k, v) =>
    set((s) => {
      if (k === 'explorerTab') return s;
      const next = v ?? !s.panels[k];
      const panels = { ...s.panels, [k]: next };
      // the explorer and settings share the right-hand column
      if (next && k === 'settings') panels.explorer = false;
      if (next && k === 'explorer') panels.settings = false;
      return { panels };
    }),
  resetView: () =>
    set((s) => ({
      viewResetToken: s.viewResetToken + 1,
      selectedId: null,
      isolatedId: null,
      focusId: null,
    })),
  toast: (text, tone = 'info') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200);
  },
  rescan: () => set((s) => ({ scanToken: s.scanToken + 1, recognitionStatus: 'scanning', mode: 'live', recognitionMessage: 'Hold an object in front of the camera' })),
}));

export const holo = () => useHolo.getState();
