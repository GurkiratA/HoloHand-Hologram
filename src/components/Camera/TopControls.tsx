import clsx from 'clsx';
import { Aperture, Box, Camera, Check, Cuboid, Expand, Eye, EyeOff, Grip, ListTree, ScanEye, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useHolo } from '@/state/store';
import type { RenderMode } from '@/types';
import { captureScreenshot } from '@/utils/screenshot';
import { sceneApi } from '@/three/interactions/sceneApi';

const MODES: { id: RenderMode; label: string; Icon: typeof Box }[] = [
  { id: 'hologram', label: 'Hologram', Icon: Sparkles },
  { id: 'wireframe', label: 'Wireframe', Icon: Box },
  { id: 'points', label: 'Point cloud', Icon: Grip },
  { id: 'solid', label: 'Solid', Icon: Cuboid },
  { id: 'xray', label: 'X-ray', Icon: ScanEye },
];

export function TopControls({ videoRef, overlayRef }: { videoRef: React.RefObject<HTMLVideoElement | null>; overlayRef: React.RefObject<HTMLCanvasElement | null> }) {
  const s = useHolo();
  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => s.toast('Fullscreen not allowed here', 'warn'));
  };
  return (
    <div className="fixed left-3 top-3 z-40 flex flex-col items-start gap-2">
      <div className="flex gap-1.5">
        <div className="relative">
          <button className={clsx('holo-icon-btn', s.panels.cameraMenu && '!border-holo-signal/50')} title="Camera" aria-label="Select camera" onClick={() => s.togglePanel('cameraMenu')}>
            <Camera size={15} />
          </button>
          {s.panels.cameraMenu && (
            <div className="holo-panel absolute left-0 top-10 w-64 p-1.5 text-[11px]">
              <div className="holo-label px-2 py-1">Camera</div>
              {s.devices.length === 0 && <div className="px-2 py-1.5 text-white/50">{s.cameraError ?? 'No cameras listed yet'}</div>}
              {s.devices.map((d, i) => (
                <button
                  key={d.deviceId || i}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-white/80 hover:bg-white/5"
                  onClick={() => {
                    s.set({ deviceId: d.deviceId });
                    s.togglePanel('cameraMenu', false);
                  }}
                >
                  <span className="w-3">{d.deviceId === s.deviceId && <Check size={12} className="text-holo-signal" />}</span>
                  <span className="truncate">{d.label || `Camera ${i + 1}`}</span>
                </button>
              ))}
              <button className="holo-btn mt-1 w-full" onClick={() => s.set({ cameraAttempt: s.cameraAttempt + 1 })}>
                Restart camera
              </button>
            </div>
          )}
        </div>
        <button className="holo-icon-btn" title="Screenshot" aria-label="Capture screenshot" onClick={() => captureScreenshot(videoRef.current, sceneApi()?.canvas() ?? null, overlayRef.current)}>
          <Aperture size={15} />
        </button>
        <button className="holo-icon-btn" title={s.showFeed ? 'Hide camera feed' : 'Show camera feed'} aria-label="Toggle camera overlay" onClick={() => s.set({ showFeed: !s.showFeed })}>
          {s.showFeed ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        <button className={clsx('holo-icon-btn', s.panels.explorer && '!border-holo-signal/50 !text-holo-signal')} title="Component explorer" aria-label="Component explorer" onClick={() => s.togglePanel('explorer')} data-testid="btn-explorer">
          <ListTree size={15} />
        </button>
        <button className={clsx('holo-icon-btn', s.panels.settings && '!border-holo-signal/50 !text-holo-signal')} title="Settings" aria-label="Settings" onClick={() => s.togglePanel('settings')} data-testid="btn-settings">
          <SlidersHorizontal size={15} />
        </button>
        <button className="holo-icon-btn" title="Fullscreen" aria-label="Fullscreen" onClick={toggleFs}>
          <Expand size={15} />
        </button>
      </div>
      <div className="holo-panel flex gap-0.5 !rounded-md p-1">
        {MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            title={label}
            aria-label={`Render mode: ${label}`}
            data-testid={`render-${id}`}
            onClick={() => s.setRenderMode(id)}
            className={clsx('flex h-7 w-7 items-center justify-center rounded-lg transition', s.settings.renderMode === id ? 'bg-holo-signal/15 text-holo-signal' : 'text-white/50 hover:text-white')}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>
    </div>
  );
}
