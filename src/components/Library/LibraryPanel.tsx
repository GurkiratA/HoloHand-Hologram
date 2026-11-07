import clsx from 'clsx';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useHolo } from '@/state/store';
import { ARCHETYPES } from '@/three/models/procedural';
import { loadCatalog } from '@/services/modelService';
import { storage, type HistoryItem, type UploadItem } from '@/services/storageService';
import { applyRecognition, loadModelKey } from '@/services/modelActions';
import type { CatalogEntry } from '@/types';
import { Modal } from './Modal';

type Tab = 'catalog' | 'archetypes' | 'uploads' | 'history';

export function LibraryPanel() {
  const s = useHolo();
  const [tab, setTab] = useState<Tab>('catalog');
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const open = s.panels.library;
  useEffect(() => {
    if (!open) return;
    void loadCatalog().then(setCatalog);
    void storage.listUploads().then(setUploads);
    void storage.listHistory().then(setHistory);
  }, [open]);
  if (!open) return null;
  const close = () => {
    s.togglePanel('library', false);
    if (s.mode === 'library') s.set({ mode: 'explore' });
  };
  const pick = (key: string) => {
    void loadModelKey(key);
    close();
  };
  return (
    <Modal title="Library" onClose={close} wide testId="library">
      <div className="mb-3 flex gap-1">
        {(['catalog', 'archetypes', 'uploads', 'history'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={clsx('rounded-md px-2.5 py-1 text-[11px] font-medium capitalize', tab === t ? 'bg-white/10' : 'text-white/50 hover:text-white')}>
            {t === 'archetypes' ? 'Approximate templates' : t === 'catalog' ? 'Catalog models' : t === 'uploads' ? 'Your uploads' : 'Recognition history'}
          </button>
        ))}
      </div>
      {tab === 'catalog' && (
        <Grid>
          {catalog.map((c) => (
            <Card key={c.id} title={c.name} sub={c.subtitle} tag={c.category} note={`${c.license} · ${c.note ?? ''}`} onClick={() => pick(`catalog:${c.id}`)} active={s.modelKey === `catalog:${c.id}`} />
          ))}
          {catalog.length === 0 && <Empty text="No catalog models found. Run npm run gen:models." />}
        </Grid>
      )}
      {tab === 'archetypes' && (
        <>
          <p className="mb-2 text-[10.5px] text-white/45">Procedural templates used as Level 2 approximate models when no catalog model matches. Add more in <code>src/three/models/procedural/</code>.</p>
          <Grid>
            {ARCHETYPES.map((a) => (
              <Card key={a.id} title={a.name} sub={a.subtitle} tag={a.category} onClick={() => pick(`archetype:${a.id}`)} active={s.modelKey === `archetype:${a.id}`} />
            ))}
          </Grid>
        </>
      )}
      {tab === 'uploads' && (
        <Grid>
          {uploads.map((u) => (
            <Card
              key={u.id}
              title={u.name}
              sub={`${(u.size / 1024 / 1024).toFixed(1)} MB · ${new Date(u.time).toLocaleDateString()}`}
              tag="GLB"
              onClick={() => pick(`upload:${u.id}`)}
              active={s.modelKey === `upload:${u.id}`}
              onDelete={() => void storage.deleteUpload(u.id).then(() => setUploads(uploads.filter((x) => x.id !== u.id)))}
            />
          ))}
          {uploads.length === 0 && <Empty text="No uploaded models yet – use Upload to add a GLB/GLTF." />}
        </Grid>
      )}
      {tab === 'history' && (
        <>
          <Grid>
            {history.map((h) => (
              <button key={h.id} onClick={() => (void applyRecognition(h.recognition, h.thumbnail), close())} className="holo-card flex gap-2 p-2 text-left hover:border-white/20">
                {h.thumbnail ? <img src={h.thumbnail} className="h-12 w-12 rounded-md object-cover" alt="" /> : <div className="h-12 w-12 rounded-md bg-white/5" />}
                <div className="min-w-0">
                  <div className="truncate text-[11.5px] font-semibold">{h.name}</div>
                  <div className="text-[10px] text-white/45">{h.category} · {Math.round(h.recognition.confidence * 100)}% · {h.recognition.provider}</div>
                  <div className="text-[10px] text-white/30">{new Date(h.time).toLocaleString()}</div>
                </div>
              </button>
            ))}
            {history.length === 0 && <Empty text="Objects you recognise will appear here (stored only in this browser)." />}
          </Grid>
          {history.length > 0 && (
            <button className="holo-btn mt-3" onClick={() => void storage.clearHistory().then(() => setHistory([]))}>
              Clear history
            </button>
          )}
        </>
      )}
    </Modal>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">{children}</div>;
const Empty = ({ text }: { text: string }) => <p className="col-span-full text-[11px] text-white/45">{text}</p>;

function Card({ title, sub, tag, note, onClick, active, onDelete }: { title: string; sub: string; tag: string; note?: string; onClick: () => void; active?: boolean; onDelete?: () => void }) {
  return (
    <div className={clsx('holo-card group relative cursor-pointer p-2.5 transition hover:border-white/20', active && '!border-holo-yellow/50')} onClick={onClick} data-testid={`lib-${title}`}>
      <span className="holo-chip bg-holo-yellow/12 text-holo-yellow">{tag}</span>
      <div className="mt-1 text-[12px] font-semibold">{title}</div>
      <div className="text-[10.5px] text-white/45">{sub}</div>
      {note && <div className="mt-1 line-clamp-2 text-[9.5px] text-white/30">{note}</div>}
      {onDelete && (
        <button className="absolute right-2 top-2 hidden text-white/40 hover:text-rose-300 group-hover:block" onClick={(e) => (e.stopPropagation(), onDelete())} aria-label="Delete">
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}
