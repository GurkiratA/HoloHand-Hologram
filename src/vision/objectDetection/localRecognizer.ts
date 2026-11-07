import { ImageClassifier, ObjectDetector } from '@mediapipe/tasks-vision';
import { getFileset, MP_MODELS, resolveModel, withDelegate } from '../mediapipe';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Detection {
  label: string;
  score: number;
  box: Box;
}

export interface LocalObservation {
  detections: Detection[];
  /** Region believed to contain the held object (source pixels). */
  region: Box | null;
  regionSource: 'detector' | 'hand' | 'frame';
  heldLabel: Detection | null;
  classifications: { label: string; score: number }[];
  /** Cropped region (for cloud recognition / thumbnails). */
  crop: HTMLCanvasElement | null;
  /** Fraction of the region inside the frame and its sharpness proxy. */
  visibility: number;
}

/** COCO classes that are never "the object being held". */
const IGNORE = new Set(['person', 'dining table', 'bed', 'couch', 'tv', 'refrigerator', 'toilet', 'potted plant', 'sink', 'oven']);

/**
 * On-device recognition: MediaPipe ObjectDetector (EfficientDet-Lite0, 80 COCO
 * classes) finds objects and boxes; ImageClassifier (EfficientNet-Lite0, 1000
 * ImageNet classes) refines the label of the held region. Runs entirely in the
 * browser – no API key required.
 */
export class LocalRecognizer {
  private detector: ObjectDetector | null = null;
  private classifier: ImageClassifier | null = null;
  private loading: Promise<void> | null = null;
  private crop = document.createElement('canvas');
  private ts = 0;

  init() {
    if (!this.loading) {
      this.loading = (async () => {
        const fs = await getFileset();
        const [detPath, clsPath] = await Promise.all([resolveModel(MP_MODELS.detector), resolveModel(MP_MODELS.classifier)]);
        this.detector = await withDelegate((delegate) =>
          ObjectDetector.createFromOptions(fs, {
            baseOptions: { modelAssetPath: detPath, delegate },
            runningMode: 'VIDEO',
            scoreThreshold: 0.3,
            maxResults: 8,
          }),
        );
        this.classifier = await withDelegate((delegate) =>
          ImageClassifier.createFromOptions(fs, {
            baseOptions: { modelAssetPath: clsPath, delegate },
            runningMode: 'VIDEO',
            maxResults: 6,
          }),
        );
      })();
    }
    return this.loading;
  }

  get ready() {
    return !!this.detector && !!this.classifier;
  }

  /**
   * @param source video, image or canvas
   * @param handBoxes hand bounding boxes in source pixels
   */
  analyze(source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement, handBoxes: Box[]): LocalObservation {
    if (!this.detector || !this.classifier) throw new Error('Local recogniser not initialised');
    const W = source instanceof HTMLVideoElement ? source.videoWidth : source instanceof HTMLImageElement ? source.naturalWidth : source.width;
    const H = source instanceof HTMLVideoElement ? source.videoHeight : source instanceof HTMLImageElement ? source.naturalHeight : source.height;
    this.ts = Math.max(this.ts + 1, performance.now());
    const det = this.detector.detectForVideo(source, this.ts);
    const detections: Detection[] = det.detections
      .map((d) => ({
        label: d.categories[0]?.categoryName ?? 'object',
        score: d.categories[0]?.score ?? 0,
        box: { x: d.boundingBox?.originX ?? 0, y: d.boundingBox?.originY ?? 0, w: d.boundingBox?.width ?? 0, h: d.boundingBox?.height ?? 0 },
      }))
      .filter((d) => !IGNORE.has(d.label) && d.box.w * d.box.h < W * H * 0.85);

    // Prefer the detection closest to / overlapping a hand – that's the held object.
    let held: Detection | null = null;
    let best = 0;
    for (const d of detections) {
      let s = d.score;
      if (handBoxes.length) {
        const prox = Math.max(...handBoxes.map((h) => proximity(d.box, h)));
        s *= 0.35 + prox;
      }
      if (s > best) {
        best = s;
        held = d;
      }
    }
    if (held && handBoxes.length && Math.max(...handBoxes.map((h) => proximity(held!.box, h))) < 0.15) held = null;

    let region: Box | null = null;
    let regionSource: LocalObservation['regionSource'] = 'frame';
    if (held) {
      region = expand(held.box, 1.15, W, H);
      regionSource = 'detector';
    } else if (handBoxes.length) {
      // Objects are usually held at the fingertips: take an enlarged box around the hand.
      const h = handBoxes[0];
      region = expand({ x: h.x, y: h.y - h.h * 0.25, w: h.w, h: h.h }, 1.9, W, H);
      regionSource = 'hand';
    } else {
      const side = Math.min(W, H) * 0.7;
      region = { x: (W - side) / 2, y: (H - side) / 2, w: side, h: side };
    }

    const crop = this.crop;
    const size = 320;
    const aspect = region.w / region.h;
    crop.width = aspect >= 1 ? size : Math.round(size * aspect);
    crop.height = aspect >= 1 ? Math.round(size / aspect) : size;
    const ctx = crop.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(source, region.x, region.y, region.w, region.h, 0, 0, crop.width, crop.height);
    this.ts += 1;
    const cls = this.classifier.classifyForVideo(crop, this.ts);
    const classifications = (cls.classifications[0]?.categories ?? []).map((c) => ({ label: c.categoryName, score: c.score }));

    const inside = Math.min(1, Math.max(0, (Math.min(W, region.x + region.w) - Math.max(0, region.x)) * (Math.min(H, region.y + region.h) - Math.max(0, region.y))) / (region.w * region.h));
    return { detections, region, regionSource, heldLabel: held, classifications, crop, visibility: inside };
  }
}

function proximity(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  if (inter > 0) return Math.min(1, 0.5 + inter / Math.min(a.w * a.h, b.w * b.h));
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  const gap = Math.hypot(dx, dy) / Math.max(b.w, b.h);
  return Math.max(0, 0.5 - gap);
}

function expand(b: Box, f: number, W: number, H: number): Box {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const w = Math.min(W, b.w * f);
  const h = Math.min(H, b.h * f);
  return { x: Math.max(0, Math.min(W - w, cx - w / 2)), y: Math.max(0, Math.min(H - h, cy - h / 2)), w, h };
}

export function handBoxesFromLandmarks(landmarks: { x: number; y: number }[][], W: number, H: number): Box[] {
  return landmarks.map((l) => {
    const xs = l.map((p) => p.x * W);
    const ys = l.map((p) => p.y * H);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  });
}
