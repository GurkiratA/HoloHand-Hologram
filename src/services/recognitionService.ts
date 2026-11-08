import { holo, useHolo } from '@/state/store';
import { LocalRecognizer, handBoxesFromLandmarks, type Box, type LocalObservation } from '@/vision/objectDetection/localRecognizer';
import { latestHands } from '@/vision/handTracking/handTracker';
import { analyzeHand, type P3 } from '@/vision/gestureRecognition/analyzeHand';
import { localResult, matchArchetype, type LabelEvidence } from '@/ai/knowledge/resolver';
import { ARCHETYPES } from '@/three/models/procedural';
import type { RecognitionResult } from '@/types';
import { applyRecognition, cancelModelLoads, showModel } from './modelActions';

export const localRecognizer = new LocalRecognizer();

interface Vote {
  key: string;
  score: number;
  evidence: LabelEvidence[];
  obs: LocalObservation;
}

const VOTE_WINDOW = 7;
const VOTES_NEEDED = 4;
/** A low-confidence guess resolves itself after this long, because the user's hands are busy with the object. */
const CONFIRM_TIMEOUT_MS = 5000;
let votes: Vote[] = [];
let inflight = false;
let lastCloud = 0;
let pending: { rec: RecognitionResult; thumb: string | null } | null = null;
/** Bumped when the stage is cleared, so a cloud answer still in flight is ignored. */
let scanEpoch = 0;
/** Consecutive ticks with a hand (or a detected object) in view – the open-vocabulary cloud trigger. */
let presenceTicks = 0;
/** Minimum gap between automatic cloud calls (keeps within the server's per-minute limit). */
const CLOUD_GAP_MS = 5000;

/** Tiny greyscale fingerprint of the last image sent, and whether the AI found nothing in it. */
let lastSig: Uint8Array | null = null;
let lastWasEmpty = false;
const sigCanvas = document.createElement('canvas');
sigCanvas.width = sigCanvas.height = 16;

function signature(src: HTMLCanvasElement | null): Uint8Array | null {
  if (!src || !src.width) return null;
  const ctx = sigCanvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, 16, 16);
  const d = ctx.getImageData(0, 0, 16, 16).data;
  const out = new Uint8Array(256);
  for (let i = 0; i < 256; i++) out[i] = (d[i * 4] * 3 + d[i * 4 + 1] * 6 + d[i * 4 + 2]) / 10;
  return out;
}
const sigDiff = (a: Uint8Array, b: Uint8Array) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;

/**
 * Poses that can only mean "no object in this hand". An open palm can present something lying on it,
 * a pinch can hold an earbud and a thumbs-up can be a grip, so only pointing and the rock sign count.
 */
const EMPTY_POSES = new Set(['point', 'clear']);
/** After the AI saw an empty hand, an unchanged scene is re-checked only after this long (in case it missed something). */
const EMPTY_RECHECK_MS = 20_000;
let lastFailToast = 0;
function handsLookEmpty(W: number, H: number): boolean {
  const lms = latestHands.frame?.landmarks ?? [];
  if (!lms.length) return false;
  return lms.every((l) => EMPTY_POSES.has(analyzeHand(l.map((p) => [p.x * W, p.y * H, p.z * W] as P3)).pose));
}

function cloudEnabled() {
  const s = holo();
  return !!s.server.provider && s.settings.useCloudAI;
}

export function getPending() {
  return pending;
}

function evidenceFrom(obs: LocalObservation): LabelEvidence[] {
  const ev: LabelEvidence[] = [];
  if (obs.heldLabel) ev.push({ label: obs.heldLabel.label, score: obs.heldLabel.score, source: 'detector' });
  obs.classifications.slice(0, 4).forEach((c) => ev.push({ label: c.label, score: c.score * 0.95, source: 'classifier' }));
  return ev;
}

/** One local recognition pass over the live video. Returns true when an object was locked. */
export async function recognitionTick(video: HTMLVideoElement): Promise<boolean> {
  if (!localRecognizer.ready || inflight || !video.videoWidth) return false;
  const frame = latestHands.frame;
  const hands = frame ? handBoxesFromLandmarks(frame.landmarks, video.videoWidth, video.videoHeight) : [];
  let obs: LocalObservation;
  try {
    obs = localRecognizer.analyze(video, hands);
  } catch (e) {
    console.warn('[recognition]', e);
    return false;
  }
  const evidence = evidenceFrom(obs);

  // Open vocabulary: with a cloud AI available, don't wait for the on-device models (which only know
  // ~1000 fixed labels) to agree on something – send the region around the hand and let the AI
  // identify whatever is there, or report that the hand is empty.
  if (cloudEnabled()) {
    // The free AI tier allows only a few requests a day, so skip frames that can't contain a new object:
    // a hand that is clearly gesturing, or the same scene the AI already said was empty.
    const gesturing = !obs.heldLabel && handsLookEmpty(video.videoWidth, video.videoHeight);
    presenceTicks = (hands.length || obs.heldLabel) && !gesturing ? presenceTicks + 1 : 0;
    const wait = CLOUD_GAP_MS - (Date.now() - lastCloud);
    const hint = !presenceTicks ? 'Hold any object up to the camera' : wait > 0 ? 'Hold the object steady in view…' : 'Object in view – identifying…';
    if (holo().recognitionMessage !== hint) useHolo.setState({ recognitionMessage: hint });
    if (presenceTicks < 2 || wait > 0) return false;
    const sig = signature(obs.crop);
    if (lastWasEmpty && sig && lastSig && sigDiff(sig, lastSig) < 14 && Date.now() - lastCloud < EMPTY_RECHECK_MS) {
      if (holo().recognitionMessage !== 'Hold any object up to the camera') useHolo.setState({ recognitionMessage: 'Hold any object up to the camera' });
      return false;
    }
    lastSig = sig;
    presenceTicks = 0;
    await lock(evidence, obs.crop, video, obs, true, hands);
    return holo().recognitionStatus !== 'scanning';
  }

  const match = matchArchetype(evidence);
  const top = [...evidence].sort((a, b) => b.score - a.score)[0];
  // A crop around an empty hand often yields spurious ImageNet labels ("ice lolly", "band aid"…), so
  // free labels must come from the detector box or a confident classification of a non-hand region.
  let key = '';
  if (match && match.score >= 0.25) key = `a:${match.archetype.id}`;
  else if (obs.heldLabel && obs.heldLabel.score >= 0.5) key = `l:${obs.heldLabel.label}`;
  else if (top && top.score >= 0.6 && obs.regionSource !== 'hand') key = `l:${top.label}`;
  votes.push({ key, score: match?.score ?? top?.score ?? 0, evidence, obs });
  if (votes.length > VOTE_WINDOW) votes.shift();

  const counts = new Map<string, Vote[]>();
  for (const v of votes) if (v.key) counts.set(v.key, [...(counts.get(v.key) ?? []), v]);
  let winner: [string, Vote[]] | null = null;
  for (const e of counts) if (!winner || e[1].length > winner[1].length) winner = e;

  const hint = winner ? `${winner[0].slice(2)} · ${winner[1].length}/${VOTES_NEEDED}` : hands.length ? 'Looking for an object in your hand…' : 'Hold an object up to the camera';
  if (holo().recognitionMessage !== hint) useHolo.setState({ recognitionMessage: hint });

  if (!winner || winner[1].length < VOTES_NEEDED) return false;
  const mean = winner[1].reduce((s, v) => s + v.score, 0) / winner[1].length;
  if (mean < 0.22) return false;

  // Merge evidence over the winning votes for a stable result.
  const merged = new Map<string, LabelEvidence>();
  for (const v of winner[1]) for (const e of v.evidence) {
    const cur = merged.get(e.label);
    merged.set(e.label, { ...e, score: Math.max(cur?.score ?? 0, e.score) * (cur ? 1 : 0.9) + (cur ? 0.02 : 0) });
  }
  const ev = [...merged.values()].sort((a, b) => b.score - a.score).slice(0, 6);
  const last = winner[1][winner[1].length - 1];
  votes = [];
  await lock(ev, last.obs.crop, video, last.obs);
  return true;
}

/** Analyse a still photo (camera unavailable or user upload). */
export async function analyzeImage(img: HTMLImageElement | HTMLCanvasElement) {
  await localRecognizer.init();
  const obs = localRecognizer.analyze(img, []);
  const ev = evidenceFrom(obs);
  await lock(ev, obs.crop, img, obs, true);
}

/** Force recognition now (Scan button) – skips voting. */
export async function scanNow(video: HTMLVideoElement) {
  await localRecognizer.init();
  const frame = latestHands.frame;
  const hands = frame ? handBoxesFromLandmarks(frame.landmarks, video.videoWidth, video.videoHeight) : [];
  const obs = localRecognizer.analyze(video, hands);
  await lock(evidenceFrom(obs), obs.crop, video, obs, true, hands);
}

/**
 * Image for the cloud model: a generous region around the hands and any detected object, so small
 * or oddly shaped things (an earbud, a pencil) are never cropped off. Falls back to the whole frame.
 */
function hiResCrop(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, obs: LocalObservation, hands: Box[] = []): string | null {
  const W = source instanceof HTMLVideoElement ? source.videoWidth : source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const H = source instanceof HTMLVideoElement ? source.videoHeight : source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!W || !H) return null;
  const boxes = [...hands, ...(obs.heldLabel ? [obs.heldLabel.box] : [])];
  let r: Box = { x: 0, y: 0, w: W, h: H };
  if (boxes.length) {
    const x0 = Math.min(...boxes.map((b) => b.x));
    const y0 = Math.min(...boxes.map((b) => b.y));
    const x1 = Math.max(...boxes.map((b) => b.x + b.w));
    const y1 = Math.max(...boxes.map((b) => b.y + b.h));
    const side = Math.max(x1 - x0, y1 - y0, Math.min(W, H) * 0.45) * 2.2;
    const w = Math.min(W, side);
    const h = Math.min(H, side);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2 - (y1 - y0) * 0.15; // objects sit at the fingertips, usually above the palm
    r = { x: Math.max(0, Math.min(W - w, cx - w / 2)), y: Math.max(0, Math.min(H - h, cy - h / 2)), w, h };
  }
  const c = document.createElement('canvas');
  const scale = Math.min(1, 1024 / Math.max(r.w, r.h));
  c.width = Math.round(r.w * scale);
  c.height = Math.round(r.h * scale);
  c.getContext('2d')!.drawImage(source, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

async function lock(
  evidence: LabelEvidence[],
  crop: HTMLCanvasElement | null,
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  obs: LocalObservation,
  force = false,
  hands: Box[] = [],
) {
  inflight = true;
  const epoch = scanEpoch;
  const thumb = crop ? crop.toDataURL('image/jpeg', 0.7) : null;
  let rec: RecognitionResult = localResult(evidence, matchArchetype(evidence));
  const s = holo();
  const cloud = s.server.provider && s.settings.useCloudAI;
  try {
    if (cloud && (force || Date.now() - lastCloud > 4000)) {
      lastCloud = Date.now();
      useHolo.setState({ recognitionStatus: 'analyzing', recognitionMessage: 'Identifying object…' });
      try {
        const res = await fetch('/api/recognize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // never leave the UI stuck on 'Asking…' if the provider hangs
          signal: AbortSignal.timeout(75_000),
          body: JSON.stringify({ image: hiResCrop(source, obs, hands) ?? thumb, hints: evidence, archetypes: ARCHETYPES.map((a) => a.id) }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        rec = { ...(body as RecognitionResult), evidence };
        lastWasEmpty = rec.holdingObject === false;
        if (rec.holdingObject === false) {
          if (epoch === scanEpoch) useHolo.setState({ recognitionStatus: 'scanning', recognitionMessage: 'No object in your hand yet – hold one up to the camera' });
          return;
        }
      } catch (e) {
        console.warn('[recognition] cloud failed:', (e as Error).message);
        // one notice per 30 s – automatic scans retry every few seconds
        if (Date.now() - lastFailToast > 30_000) {
          lastFailToast = Date.now();
          holo().toast(`AI recognition failed (${(e as Error).message}).`, 'warn');
        }
        // the on-device models only know a fixed list of labels, so a weak local guess is worse than retrying
        if (rec.confidence < 0.5) {
          if (epoch === scanEpoch) useHolo.setState({ recognitionStatus: 'scanning', recognitionMessage: 'AI unavailable – retrying shortly…' });
          return;
        }
      }
      if (epoch !== scanEpoch) return;
    }
    if (!rec.objectName || rec.confidence <= 0.05) {
      useHolo.setState({ recognitionStatus: 'scanning', recognitionMessage: 'Could not identify the object – try another angle or search manually' });
      return;
    }
    pending = { rec, thumb };
    if (rec.confidence < holo().settings.confirmBelow) {
      useHolo.setState({ recognition: rec, recognitionStatus: 'confirm' });
      setTimeout(() => {
        if (pending?.rec !== rec || holo().recognitionStatus !== 'confirm') return;
        // show the parts if there are any to show; otherwise keep scanning rather than stopping on a weak guess
        if (rec.archetype || rec.primitiveModel?.length || rec.components.length) void confirmPending();
        else rejectPending();
      }, CONFIRM_TIMEOUT_MS);
    } else {
      useHolo.setState({ recognition: rec, recognitionStatus: 'detected' });
      setTimeout(() => {
        if (pending?.rec === rec && holo().recognitionStatus === 'detected') void confirmPending();
      }, 2600);
    }
  } finally {
    inflight = false;
  }
}

export async function confirmPending() {
  const p = pending;
  pending = null;
  if (!p) return;
  await applyRecognition(p.rec, p.thumb);
}

export function rejectPending() {
  pending = null;
  votes = [];
  useHolo.setState({ recognitionStatus: 'scanning', recognition: null, recognitionMessage: 'Okay – scanning again. You can also search manually.' });
}

/**
 * Takes the hologram, its labels and any open panels off the screen and starts
 * scanning again. With `hideControls` the HUD goes too, leaving only the camera.
 */
export function clearStage({ hideControls = false } = {}) {
  scanEpoch++;
  cancelModelLoads();
  pending = null;
  votes = [];
  showModel(null, null);
  const s = holo();
  useHolo.setState({
    descriptor: null,
    recognition: null,
    stageClear: hideControls,
    panels: { ...s.panels, settings: false, explorer: false, library: false, scan: false, upload: false, cameraMenu: false },
  });
  if (s.cameraStatus === 'live' && s.settings.recognitionEnabled) s.rescan();
  else useHolo.setState({ mode: 'explore', recognitionStatus: 'idle', recognitionMessage: '' });
}

export function resetVotes() {
  votes = [];
}
