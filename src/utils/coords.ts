/**
 * Maps normalised video coordinates (as returned by MediaPipe) to viewport
 * pixels for a <video> displayed with object-fit: cover, optionally mirrored.
 */
export function videoToViewport(
  x: number,
  y: number,
  video: { w: number; h: number },
  view: { w: number; h: number },
  mirror: boolean,
): [number, number] {
  const s = Math.max(view.w / video.w, view.h / video.h);
  const dw = video.w * s;
  const dh = video.h * s;
  const ox = (view.w - dw) / 2;
  const oy = (view.h - dh) / 2;
  const nx = mirror ? 1 - x : x;
  return [ox + nx * dw, oy + y * dh];
}

/** Inverse: viewport pixel -> normalised video coordinate. */
export function viewportToVideo(
  px: number,
  py: number,
  video: { w: number; h: number },
  view: { w: number; h: number },
  mirror: boolean,
): [number, number] {
  const s = Math.max(view.w / video.w, view.h / video.h);
  const dw = video.w * s;
  const dh = video.h * s;
  const ox = (view.w - dw) / 2;
  const oy = (view.h - dh) / 2;
  const nx = (px - ox) / dw;
  return [mirror ? 1 - nx : nx, (py - oy) / dh];
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
