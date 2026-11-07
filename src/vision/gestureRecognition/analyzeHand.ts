import type { HandPose } from '@/types';

/** Landmark in viewport pixels (z scaled like x). Index layout = MediaPipe hand model. */
export type P3 = [number, number, number];

export const LM = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
} as const;

export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const FINGERS = [
  { tip: 8, pip: 6, mcp: 5 },
  { tip: 12, pip: 10, mcp: 9 },
  { tip: 16, pip: 14, mcp: 13 },
  { tip: 20, pip: 18, mcp: 17 },
];

export interface HandAnalysis {
  palmSize: number;
  /** 0 = closed fist, 1 = fully open (calibrated). */
  openness: number;
  /** [thumb, index, middle, ring, pinky] */
  extended: boolean[];
  /** Fingertip-to-wrist distance / palm size, for index..pinky. */
  ratios: number[];
  pinchRatio: number;
  pose: HandPose;
  palm: [number, number];
  indexTip: [number, number];
  pinchPoint: [number, number];
  /** Angle of the wrist→middle-MCP vector (radians). */
  roll: number;
}

export interface AnalyzeOptions {
  /** Openness calibration: ratio for a fist and for an open hand. */
  fistRatio?: number;
  openRatio?: number;
  /** 0.5..2 – larger = easier to trigger pinch. */
  sensitivity?: number;
}

const d3 = (a: P3, b: P3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function analyzeHand(pts: P3[], opts: AnalyzeOptions = {}): HandAnalysis {
  const fistR = opts.fistRatio ?? 1.0;
  const openR = opts.openRatio ?? 1.85;
  const sens = opts.sensitivity ?? 1;
  const w = pts[LM.WRIST];
  const palmSize = Math.max(1e-6, d3(w, pts[LM.MIDDLE_MCP]));

  const ratios = FINGERS.map((f) => d3(pts[f.tip], w) / palmSize);
  const extendedFingers = FINGERS.map((f, i) => {
    const tipFar = d3(pts[f.tip], w) > d3(pts[f.pip], w) * 1.12;
    return tipFar && ratios[i] > (fistR + openR) / 2 - 0.05;
  });
  const curled = FINGERS.map((f, i) => d3(pts[f.tip], w) < d3(pts[f.pip], w) * 1.05 || ratios[i] < fistR + (openR - fistR) * 0.35);
  const thumbExt = d3(pts[LM.THUMB_TIP], pts[LM.INDEX_MCP]) / palmSize > 0.5 && d3(pts[LM.THUMB_TIP], w) > d3(pts[LM.THUMB_IP], w);
  const extended = [thumbExt, ...extendedFingers];

  const openness = ratios.reduce((s, r) => s + clamp01((r - fistR) / (openR - fistR)), 0) / 4;
  const pinchRatio = d3(pts[LM.THUMB_TIP], pts[LM.INDEX_TIP]) / palmSize;
  const pinchThresh = 0.22 + 0.07 * sens;
  // In a fist the thumb rests on the curled index finger, so the index must be clearly un-curled for a pinch.
  const pinching = pinchRatio < pinchThresh && ratios[0] > fistR + (openR - fistR) * 0.3;
  const fistLike = openness < 0.25 && curled.every(Boolean);

  let pose: HandPose = 'neutral';
  if (fistLike && !pinching) pose = 'fist';
  else if (pinching && !(extendedFingers[0] && extendedFingers[1] && !curled[2])) pose = 'pinch';
  else if (extendedFingers[0] && extendedFingers[1] && curled[2] && curled[3]) pose = 'peace';
  else if (extendedFingers[0] && curled[1] && curled[2] && curled[3]) pose = 'point';
  else if (openness > 0.66 && extendedFingers.every(Boolean)) pose = 'open';

  const palmIdx = [0, 5, 9, 13, 17];
  const palm: [number, number] = [
    palmIdx.reduce((s, i) => s + pts[i][0], 0) / 5,
    palmIdx.reduce((s, i) => s + pts[i][1], 0) / 5,
  ];
  const m = pts[LM.MIDDLE_MCP];
  return {
    palmSize,
    openness,
    extended,
    ratios,
    pinchRatio,
    pose,
    palm,
    indexTip: [pts[LM.INDEX_TIP][0], pts[LM.INDEX_TIP][1]],
    pinchPoint: [(pts[4][0] + pts[8][0]) / 2, (pts[4][1] + pts[8][1]) / 2],
    roll: Math.atan2(m[1] - w[1], m[0] - w[0]),
  };
}
