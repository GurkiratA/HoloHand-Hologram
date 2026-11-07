import { useEffect, useRef } from 'react';
import { CameraView } from '@/components/Camera/CameraView';
import { CameraFallback } from '@/components/Camera/CameraFallback';
import { TopControls } from '@/components/Camera/TopControls';
import { HoloCanvas } from '@/components/Hologram/HoloCanvas';
import { LabelLayer } from '@/components/Hologram/LabelLayer';
import { HandOverlay } from '@/components/GestureControls/HandOverlay';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { StatusBar } from '@/components/StatusBar/StatusBar';
import { ModeBar, setMode } from '@/components/StatusBar/ModeBar';
import { Toasts } from '@/components/StatusBar/Toasts';
import { ExplorerPanel } from '@/components/ComponentExplorer/ExplorerPanel';
import { SettingsPanel } from '@/components/Settings/SettingsPanel';
import { LibraryPanel } from '@/components/Library/LibraryPanel';
import { UploadPanel } from '@/components/Library/UploadPanel';
import { ScanPanel } from '@/components/Scan/ScanPanel';
import { RecognitionOverlay } from '@/components/Scan/RecognitionOverlay';
import { useCamera } from '@/hooks/useCamera';
import { useHandTracking } from '@/hooks/useHandTracking';
import { useRecognition } from '@/hooks/useRecognition';
import { useServerStatus } from '@/hooks/useServerStatus';
import { holo } from '@/state/store';
import { loadModelKey, nextModel } from '@/services/modelActions';
import type { RenderMode } from '@/types';

const RENDER_KEYS: RenderMode[] = ['hologram', 'wireframe', 'points', 'solid', 'xray'];

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  useServerStatus();
  useCamera(videoRef);
  useHandTracking(videoRef);
  useRecognition(videoRef);

  // Show a hologram immediately so the scene is never empty.
  useEffect(() => {
    void loadModelKey('catalog:f1-car').then(() => holo().set({ mode: 'live' }));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, select, textarea')) return;
      const s = holo();
      if (e.key === 'e') s.set({ explode: s.explode > 0.5 ? 0 : 1 });
      else if (e.key === 'a') setMode('assembly');
      else if (e.key === 'r') s.resetView();
      else if (e.key === 'n') void nextModel(1);
      else if (e.key === 'l') setMode('live');
      else if (e.key === 'Escape') s.set({ selectedId: null, isolatedId: null, focusId: null });
      else if (/^[1-5]$/.test(e.key)) s.setRenderMode(RENDER_KEYS[Number(e.key) - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden text-white">
      <CameraView ref={videoRef} />
      <HoloCanvas />
      <HandOverlay ref={overlayRef} />
      <LabelLayer />
      <RecognitionOverlay />
      <Sidebar />
      <TopControls videoRef={videoRef} overlayRef={overlayRef} />
      <ModeBar />
      <StatusBar />
      <ExplorerPanel />
      <SettingsPanel />
      <CameraFallback />
      <LibraryPanel />
      <UploadPanel />
      <ScanPanel videoRef={videoRef} />
      <Toasts />
    </div>
  );
}
