import clsx from 'clsx';
import { Boxes, Expand, FolderOpen, Radar, Shrink, Upload, Compass } from 'lucide-react';
import { useHolo, holo } from '@/state/store';
import type { AppMode } from '@/types';

const MODES: { id: AppMode; label: string; Icon: typeof Boxes }[] = [
  { id: 'live', label: 'Live', Icon: Radar },
  { id: 'explore', label: 'Explore', Icon: Compass },
  { id: 'exploded', label: 'Exploded', Icon: Expand },
  { id: 'assembly', label: 'Assembly', Icon: Shrink },
  { id: 'library', label: 'Library', Icon: FolderOpen },
  { id: 'manual', label: 'Upload', Icon: Upload },
];

export function setMode(m: AppMode) {
  const s = holo();
  switch (m) {
    case 'live':
      s.rescan();
      break;
    case 'explore':
      s.set({ mode: 'explore' });
      break;
    case 'exploded':
      s.set({ mode: 'exploded', explode: 1 });
      break;
    case 'assembly':
      s.set({ mode: 'assembly', explode: 0, isolatedId: null });
      break;
    case 'library':
      s.set({ mode: 'library' });
      s.togglePanel('library', true);
      break;
    case 'manual':
      s.set({ mode: 'manual' });
      s.togglePanel('upload', true);
      break;
  }
}

export function ModeBar() {
  const mode = useHolo((s) => s.mode);
  const d = useHolo((s) => s.descriptor);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-40 flex justify-center">
      <div className="holo-panel pointer-events-auto flex items-center gap-1 !rounded-xl p-1">
        {MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            data-testid={`mode-${id}`}
            className={clsx('flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition', mode === id ? 'bg-holo-yellow/12 text-holo-yellow shadow-glow' : 'text-white/55 hover:text-white')}
          >
            <Icon size={12} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
        {d && (
          <button className="ml-1 flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[11px]" onClick={() => setMode('library')} title="Browse models">
            <span className="text-white/45">{d.category}</span>
            <span className="rounded-md bg-holo-yellow/15 px-1.5 py-0.5 font-medium text-holo-yellow">{d.name}</span>
          </button>
        )}
      </div>
    </div>
  );
}
