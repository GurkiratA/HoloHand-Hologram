import clsx from 'clsx';
import { X } from 'lucide-react';
import { useHolo } from '@/state/store';
import { cardEl } from '@/components/Hologram/labels';

const SOURCE_LABEL: Record<string, string> = {
  catalog: 'Catalog metadata',
  procedural: 'Archetype template',
  ai: 'AI recogniser',
  'mesh-name': 'Mesh name in file',
  user: 'User',
};

/** Floating panel next to the selected component's label. */
export function InfoCard() {
  const s = useHolo();
  const part = s.model?.parts.find((p) => p.meta.id === s.selectedId)?.meta;
  const all = s.descriptor?.components ?? [];
  const path: string[] = [];
  let cur = part?.parentId ?? null;
  while (cur && path.length < 6) {
    const c = all.find((x) => x.id === cur);
    if (!c) break;
    path.unshift(c.name);
    cur = c.parentId;
  }
  return (
    <div ref={(el) => void (cardEl.current = el)} className="holo-panel pointer-events-auto absolute left-0 top-0 w-[270px] p-3 text-white transition-opacity duration-200" style={{ opacity: 0, visibility: part ? 'visible' : 'hidden' }} data-testid="info-card">
      {part && (
        <>
          <div className="flex items-start gap-2">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: part.color, boxShadow: `0 0 8px ${part.color}` }} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold leading-tight">{part.name}</div>
              <div className="mt-0.5 truncate text-[10px] text-white/40">{[s.descriptor?.name, ...path].filter(Boolean).join(' › ')}</div>
            </div>
            <button className="text-white/40 hover:text-white" onClick={() => s.select(null)} aria-label="Close">
              <X size={14} />
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-white/75">{part.description}</p>
          {part.aiNote && <p className="mt-1.5 rounded-md bg-holo-cyan/[0.07] p-1.5 text-[10.5px] leading-snug text-holo-cyan/90">AI: {part.aiNote}</p>}
          <dl className="mt-2 space-y-1 text-[10.5px]">
            {part.function && <Row k="Function" v={part.function} />}
            {part.location && <Row k="Position" v={part.location} />}
            {Object.entries(part.technical ?? {}).map(([k, v]) => <Row key={k} k={k} v={v} />)}
            <Row k="Source" v={SOURCE_LABEL[part.source] ?? part.source} />
          </dl>
          <div className="mt-2">
            <div className="flex justify-between text-[10px] text-white/45">
              <span>Identification confidence</span>
              <span className="font-mono">{Math.round(part.confidence * 100)}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded bg-white/10">
              <div className={clsx('h-full rounded', part.confidence >= 0.7 ? 'bg-emerald-400' : part.confidence >= 0.45 ? 'bg-holo-yellow' : 'bg-rose-400')} style={{ width: `${part.confidence * 100}%` }} />
            </div>
          </div>
          <div className="mt-2.5 flex gap-1.5">
            <button className={clsx('holo-btn flex-1', s.isolatedId === part.id && 'holo-btn-on')} onClick={() => s.isolate(s.isolatedId === part.id ? null : part.id)}>
              {s.isolatedId === part.id ? 'Show all' : 'Isolate'}
            </button>
            <button className={clsx('holo-btn flex-1', s.focusId === part.id && 'holo-btn-on')} onClick={() => s.focus(s.focusId === part.id ? null : part.id)}>
              {s.focusId === part.id ? 'Unzoom' : 'Zoom in'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[78px] shrink-0 text-white/40">{k}</dt>
      <dd className="text-white/80">{v}</dd>
    </div>
  );
}
