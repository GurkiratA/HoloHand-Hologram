import { FilesetResolver } from '@mediapipe/tasks-vision';

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

/** Models are served from /public when `npm run setup:assets` has run, otherwise from Google's CDN. */
export const MP_MODELS = {
  hand: { local: '/models/mediapipe/hand_landmarker.task', cdn: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' },
  detector: { local: '/models/mediapipe/efficientdet_lite0.tflite', cdn: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite' },
  classifier: { local: '/models/mediapipe/efficientnet_lite0.tflite', cdn: 'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite' },
} as const;

let fileset: Promise<WasmFileset> | null = null;

export function getFileset(): Promise<WasmFileset> {
  if (!fileset) fileset = FilesetResolver.forVisionTasks('/mediapipe/wasm');
  return fileset;
}

const resolved = new Map<string, Promise<string>>();

export function resolveModel(m: { local: string; cdn: string }): Promise<string> {
  let p = resolved.get(m.local);
  if (!p) {
    p = fetch(m.local, { method: 'HEAD' })
      .then((r) => {
        const type = r.headers.get('content-type') ?? '';
        // Vite's SPA fallback answers missing files with index.html
        return r.ok && !type.includes('text/html') ? m.local : m.cdn;
      })
      .catch(() => m.cdn);
    resolved.set(m.local, p);
  }
  return p;
}

/** Try GPU first, fall back to CPU (e.g. headless browsers or blocked WebGL). */
export async function withDelegate<T>(create: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<T> {
  try {
    return await create('GPU');
  } catch (e) {
    console.warn('[mediapipe] GPU delegate failed, falling back to CPU', e);
    return create('CPU');
  }
}
