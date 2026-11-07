import { holo, useHolo } from '@/state/store';
import { LocalRecognizer, handBoxesFromLandmarks, type LocalObservation } from '@/vision/objectDetection/localRecognizer';
import { latestHands } from '@/vision/handTracking/handTracker';
import { localResult, matchArchetype, type LabelEvidence } from '@/ai/knowledge/resolver';
import { ARCHETYPES } from '@/three/models/procedural';
import type { RecognitionResult } from '@/types';
import { applyRecognition } from './modelActions';

export const localRecognizer = new LocalRecognizer();

interface Vote {
  key: string;
  score: number;
  evidence: LabelEvidence[];
  obs: LocalObservation;
}

const VOTE_WINDOW = 7;
const VOTES_NEEDED = 4;
let votes: Vote[] = [];
let inflight = false;
let lastCloud = 0;
let pending: { rec: RecognitionResult; thumb: string | null } | null = null;

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
  await lock(evidenceFrom(obs), obs.crop, video, obs, true);
}

function hiResCrop(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, obs: LocalObservation): string | null {
  if (!obs.region) return null;
  const c = document.createElement('canvas');
  const r = obs.region;
  const scale = Math.min(1, 768 / Math.max(r.w, r.h));
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
) {
  inflight = true;
  const thumb = crop ? crop.toDataURL('image/jpeg', 0.7) : null;
  let rec: RecognitionResult = localResult(evidence, matchArchetype(evidence));
  const s = holo();
  const cloud = s.server.provider && s.settings.useCloudAI;
  try {
    if (cloud && (force || Date.now() - lastCloud > 4000)) {
      lastCloud = Date.now();
      useHolo.setState({ recognitionStatus: 'analyzing', recognitionMessage: `Asking ${s.server.provider}…` });
      try {
        const res = await fetch('/api/recognize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image: hiResCrop(source, obs) ?? thumb, hints: evidence, archetypes: ARCHETYPES.map((a) => a.id) }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        rec = { ...(body as RecognitionResult), evidence };
      } catch (e) {
        holo().toast(`Cloud recognition failed (${(e as Error).message}). Using on-device result.`, 'warn');
      }
    }
    if (!rec.objectName || rec.confidence <= 0.05) {
      useHolo.setState({ recognitionStatus: 'scanning', recognitionMessage: 'Could not identify the object – try another angle or search manually' });
      return;
    }
    pending = { rec, thumb };
    if (rec.confidence < holo().settings.confirmBelow) {
      useHolo.setState({ recognition: rec, recognitionStatus: 'confirm' });
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

export function resetVotes() {
  votes = [];
}
