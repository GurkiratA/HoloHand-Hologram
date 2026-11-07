export type CameraErrorKind = 'denied' | 'unavailable' | 'error';

export class CameraError extends Error {
  constructor(public kind: CameraErrorKind, message: string) {
    super(message);
  }
}

/** Starts the webcam. Prefers 1280×720; falls back to any camera. */
export async function startCamera(deviceId?: string | null): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('unavailable', 'This browser does not support camera access (needs HTTPS or localhost).');
  }
  const video: MediaTrackConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
  };
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: false });
  } catch (e) {
    const err = e as DOMException;
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') throw new CameraError('denied', 'Camera permission was denied. Allow camera access in the address bar and try again.');
    if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
      if (deviceId) return startCamera(null);
      throw new CameraError('unavailable', 'No camera was found.');
    }
    if (err.name === 'NotReadableError') throw new CameraError('error', 'The camera is in use by another application.');
    throw new CameraError('error', err.message || 'Could not start the camera.');
  }
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  try {
    return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  } catch {
    return [];
  }
}
