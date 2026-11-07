import { forwardRef } from 'react';
import { useHolo } from '@/state/store';

/** Full-screen live webcam feed (the app's background). */
export const CameraView = forwardRef<HTMLVideoElement>(function CameraView(_, ref) {
  const showFeed = useHolo((s) => s.showFeed);
  const mirror = useHolo((s) => s.settings.mirror);
  const live = useHolo((s) => s.cameraStatus === 'live');
  return (
    <>
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,#101a2c_0%,#05070d_70%)]" />
      <video
        ref={ref}
        className="fixed inset-0 z-0 h-full w-full object-cover transition-opacity duration-500"
        style={{ transform: mirror ? 'scaleX(-1)' : undefined, opacity: showFeed && live ? 1 : 0 }}
        playsInline
        muted
        autoPlay
        data-testid="camera-video"
      />
      {/* subtle vignette + scanlines so the hologram reads well on any background */}
      <div className="scanline-bg pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.45)_100%)]" />
    </>
  );
});
