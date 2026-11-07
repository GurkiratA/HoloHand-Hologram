import { ImageUp, Loader2, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHolo } from '@/state/store';
import { analyzeImage, scanNow } from '@/services/recognitionService';
import { localResult, searchArchetypes, searchCatalog } from '@/ai/knowledge/resolver';
import { loadCatalog } from '@/services/modelService';
import { applyRecognition, loadModelKey } from '@/services/modelActions';
import { describeWithAI } from '@/services/aiActions';
import type { CatalogEntry } from '@/types';
import { Modal } from '@/components/Library/Modal';

/** Photo upload (camera-free recognition) + manual object search. */
export function ScanPanel({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const s = useHolo();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const open = s.panels.scan;
  useEffect(() => {
    if (open) void loadCatalog().then(setCatalog);
  }, [open]);
  const archetypeHits = useMemo(() => searchArchetypes(q), [q]);
  const catHit = useMemo(() => (q.trim() ? searchCatalog(catalog, [q]) : null), [q, catalog]);
  if (!open) return null;
  const close = () => s.togglePanel('scan', false);

  const onPhoto = async (f?: File | null) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPreview(url);
    setBusy('Analysing photo…');
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      await analyzeImage(img);
      close();
    } catch (e) {
      s.toast(`Photo analysis failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const pickArchetype = async (id: string, name: string) => {
    const hit = archetypeHits.find((h) => h.archetype.id === id) ?? null;
    const rec = { ...localResult([{ label: name, score: 0.9, source: 'manual' }], hit), provider: 'manual' as const, confidence: 0.9, notes: 'Chosen manually by the user.' };
    close();
    await applyRecognition(rec, null);
  };

  const askAI = async () => {
    setBusy(`Asking ${s.server.provider}…`);
    try {
      await describeWithAI(q);
      close();
    } catch (e) {
      s.toast(`AI lookup failed: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title="Recognise an object" onClose={close} testId="scan-panel">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="holo-card p-3">
          <div className="holo-label mb-1.5">From a photo</div>
          <button className="flex h-28 w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-white/15 text-[11px] text-white/60 hover:border-holo-cyan/60" onClick={() => file.current?.click()}>
            {preview ? <img src={preview} className="h-full w-full object-contain" alt="Uploaded" /> : (<><ImageUp size={18} className="mb-1 text-holo-cyan" />Upload a photo of the object</>)}
          </button>
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} data-testid="photo-input" />
          {s.cameraStatus === 'live' && (
            <button
              className="holo-btn mt-2 w-full"
              disabled={!!busy}
              onClick={async () => {
                if (!videoRef.current) return;
                setBusy('Scanning current frame…');
                try {
                  await scanNow(videoRef.current);
                  close();
                } catch (e) {
                  s.toast((e as Error).message, 'error');
                } finally {
                  setBusy(null);
                }
              }}
            >
              Scan current camera frame now
            </button>
          )}
        </div>
        <div className="holo-card p-3">
          <div className="holo-label mb-1.5">Search manually</div>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2 text-white/35" />
            <input className="holo-input !pl-7" placeholder="e.g. formula 1 car, phone, brain…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus data-testid="search-input" />
          </div>
          <div className="mt-2 space-y-1">
            {catHit && (
              <button className="holo-btn w-full !justify-start" onClick={() => (void loadModelKey(`catalog:${catHit.entry.id}`), close())}>
                <span className="holo-chip bg-holo-cyan/10 text-holo-cyan">Catalog</span> {catHit.entry.name}
              </button>
            )}
            {archetypeHits.map((h) => (
              <button key={h.archetype.id} className="holo-btn w-full !justify-start" onClick={() => void pickArchetype(h.archetype.id, h.archetype.name)} data-testid={`search-hit-${h.archetype.id}`}>
                <span className="holo-chip bg-holo-pink/10 text-holo-pink">Approx.</span> {h.archetype.name}
              </button>
            ))}
            {q.trim() && s.server.provider && (
              <button className="holo-btn w-full !justify-start" onClick={() => void askAI()} disabled={!!busy}>
                <Sparkles size={12} className="text-holo-yellow" /> Ask {s.server.provider} about “{q}”
              </button>
            )}
            {q.trim() && !catHit && archetypeHits.length === 0 && !s.server.provider && (
              <p className="text-[10.5px] text-white/45">No local template matches. Configure an AI provider for open-ended lookups, or upload a GLB.</p>
            )}
          </div>
        </div>
      </div>
      {busy && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-holo-cyan">
          <Loader2 size={13} className="animate-spin" /> {busy}
        </div>
      )}
    </Modal>
  );
}
