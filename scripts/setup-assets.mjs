// Copies the MediaPipe WASM runtime into /public and (optionally) downloads the
// on-device vision models so the app works fully offline after setup.
import { cpSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const wasmDst = join(root, 'public/mediapipe/wasm');

if (existsSync(wasmSrc)) {
  mkdirSync(wasmDst, { recursive: true });
  cpSync(wasmSrc, wasmDst, { recursive: true });
  console.log('[assets] MediaPipe WASM copied to public/mediapipe/wasm');
} else {
  console.warn('[assets] @mediapipe/tasks-vision not installed yet; skipping WASM copy');
}

if (process.argv.includes('--wasm-only')) process.exit(0);

export const MODELS = [
  ['hand_landmarker.task', 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'],
  ['efficientdet_lite0.tflite', 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite'],
  ['efficientnet_lite0.tflite', 'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite'],
];

const modelDir = join(root, 'public/models/mediapipe');
mkdirSync(modelDir, { recursive: true });
for (const [name, url] of MODELS) {
  const dst = join(modelDir, name);
  if (existsSync(dst) && statSync(dst).size > 1000) { console.log(`[assets] ${name} present`); continue; }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(dst, Buffer.from(await res.arrayBuffer()));
    console.log(`[assets] downloaded ${name}`);
  } catch (e) {
    console.warn(`[assets] could not download ${name} (${e.message}). The app will fall back to the Google CDN at runtime.`);
  }
}
