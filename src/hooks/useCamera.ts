import { useEffect, useRef } from 'react';
import { useHolo } from '@/state/store';
import { CameraError, listCameras, startCamera, stopStream } from '@/services/cameraService';

/** Owns the MediaStream lifecycle for the shared <video> element. */
export function useCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const deviceId = useHolo((s) => s.deviceId);
  const attempt = useHolo((s) => s.cameraAttempt);
  const streamRef = useRef<MediaStream | null>(null);
  const activeDevice = useRef<string | null>(null);
  const lastAttempt = useRef(-1);

  useEffect(() => {
    const sameDevice = deviceId === null || deviceId === activeDevice.current;
    if (streamRef.current && sameDevice && attempt === lastAttempt.current) return;
    lastAttempt.current = attempt;
    let cancelled = false;
    const set = useHolo.getState().set;
    set({ cameraStatus: 'requesting', cameraError: null });
    startCamera(deviceId)
      .then(async (stream) => {
        if (cancelled) return stopStream(stream);
        stopStream(streamRef.current);
        streamRef.current = stream;
        activeDevice.current = stream.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        set({ cameraStatus: 'live', devices: await listCameras(), deviceId: activeDevice.current });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const ce = e instanceof CameraError ? e : new CameraError('error', String(e));
        set({ cameraStatus: ce.kind, cameraError: ce.message });
      });
    return () => {
      cancelled = true;
    };
  }, [deviceId, attempt, videoRef]);

  useEffect(() => () => stopStream(streamRef.current), []);
}
