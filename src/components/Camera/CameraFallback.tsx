import { CameraOff, ImageUp, Box } from 'lucide-react';
import { useHolo } from '@/state/store';

/** Shown when the webcam can't be used – the rest of the app keeps working. */
export function CameraFallback() {
  const s = useHolo();
  if (!['denied', 'unavailable', 'error'].includes(s.cameraStatus) || s.panels.scan || s.panels.upload || s.panels.library) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-14 z-30 flex justify-center">
      <div className="holo-panel pointer-events-auto flex max-w-md items-start gap-3 p-3 text-white" data-testid="camera-fallback">
        <CameraOff size={18} className="mt-0.5 shrink-0 text-rose-300" />
        <div className="text-[11.5px]">
          <div className="font-semibold">Camera unavailable</div>
          <div className="mt-0.5 text-white/55">{s.cameraError}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button className="holo-btn" onClick={() => s.set({ cameraAttempt: s.cameraAttempt + 1 })}>Retry</button>
            <button className="holo-btn" onClick={() => s.togglePanel('scan', true)}><ImageUp size={12} /> Recognise a photo</button>
            <button className="holo-btn" onClick={() => s.togglePanel('upload', true)}><Box size={12} /> Load a 3D model</button>
          </div>
        </div>
      </div>
    </div>
  );
}
