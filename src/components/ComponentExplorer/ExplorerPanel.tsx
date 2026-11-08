import clsx from 'clsx';
import { ChevronDown, ChevronRight, Eye, Focus, X, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useHolo } from '@/state/store';
import type { ComponentMeta } from '@/types';
import { ObjectInfo } from '@/components/ObjectInfo/ObjectInfo';
import { describeMeshesWithAI } from '@/services/aiActions';

interface Node {
  c: ComponentMeta;
  children: Node[];
}

function buildTree(components: ComponentMeta[]): Node[] {
  const map = new Map<string, Node>(components.map((c) => [c.id, { c, children: [] }]));
  const roots: Node[] = [];
  for (const n of map.values()) {
    const p = n.c.parentId ? map.get(n.c.parentId) : undefined;
    if (p) p.children.push(n);
    else roots.push(n);
  }
  // groups without children are noise
  const prune = (ns: Node[]): Node[] => ns.filter((n) => !n.c.isGroup || n.children.length).map((n) => ({ ...n, children: prune(n.children) }));
  return prune(roots);
}

export function ExplorerPanel() {
  const s = useHolo();
  const open = s.panels.explorer;
  const tab = s.panels.explorerTab;
  const tree = useMemo(() => buildTree(s.descriptor?.components ?? []), [s.descriptor, s.model]);
  if (!open) return null;
  const setTab = (t: 'components' | 'info') => s.set({ panels: { ...s.panels, explorerTab: t } });
  return (
    <aside className="holo-panel thin-scroll fixed left-3 top-[92px] bottom-9 z-[45] flex w-[280px] flex-col overflow-hidden text-white" data-testid="explorer">
      <div className="flex items-center gap-1 border-b border-white/[0.06] p-2">
        {(['components', 'info'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={clsx('rounded-md px-2 py-1 text-[11px] font-medium', tab === t ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}>
            {t === 'components' ? 'Components' : 'Object info'}
          </button>
        ))}
        <button className="ml-auto text-white/40 hover:text-white" onClick={() => s.togglePanel('explorer', false)} aria-label="Close explorer">
          <X size={14} />
        </button>
      </div>
      <div className="thin-scroll flex-1 overflow-y-auto p-2">
        {tab === 'components' ? (
          <>
            <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">{s.descriptor?.name ?? 'No model'}</div>
            {tree.length === 0 && <p className="px-1 text-[11px] text-white/45">No component-level model for this object. See “Object info”.</p>}
            <div className="text-[11.5px]">
              <div className="px-1 py-0.5 text-white/40">Assembly</div>
              {tree.map((n) => <TreeNode key={n.c.id} n={n} depth={0} />)}
            </div>
            {s.model && s.descriptor?.level === 'user' && s.server.provider && (
              <button className="holo-btn mt-3 w-full" onClick={() => void describeMeshesWithAI()}>
                <Sparkles size={12} /> Describe meshes with AI
              </button>
            )}
          </>
        ) : (
          <ObjectInfo />
        )}
      </div>
    </aside>
  );
}

function TreeNode({ n, depth }: { n: Node; depth: number }) {
  const s = useHolo();
  const [open, setOpen] = useState(true);
  const sel = s.selectedId === n.c.id;
  const isGroup = n.c.isGroup;
  return (
    <div>
      <div
        className={clsx('group flex cursor-pointer items-center gap-1 rounded-md py-[3px] pr-1', sel ? 'bg-holo-accent/10 text-holo-accent' : 'text-white/80 hover:bg-white/[0.05]')}
        style={{ paddingLeft: 4 + depth * 12 }}
        onClick={() => (isGroup ? setOpen(!open) : s.select(sel ? null : n.c.id))}
        onMouseEnter={() => !isGroup && s.hover(n.c.id)}
        onMouseLeave={() => s.hover(null)}
        data-testid={`tree-${n.c.id}`}
      >
        <span className="w-3 text-white/30">{n.children.length ? (open ? <ChevronDown size={11} /> : <ChevronRight size={11} />) : '·'}</span>
        {!isGroup && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: n.c.color }} />}
        <span className={clsx('flex-1 truncate', isGroup && 'font-semibold text-white/65')}>{n.c.name}</span>
        {!isGroup && (
          <span className="hidden gap-1 group-hover:flex">
            <button title="Isolate" onClick={(e) => (e.stopPropagation(), s.isolate(s.isolatedId === n.c.id ? null : n.c.id))} className={clsx('hover:text-white', s.isolatedId === n.c.id ? 'text-holo-accent' : 'text-white/40')}>
              <Eye size={11} />
            </button>
            <button title="Zoom" onClick={(e) => (e.stopPropagation(), s.select(n.c.id), s.focus(s.focusId === n.c.id ? null : n.c.id))} className="text-white/40 hover:text-white">
              <Focus size={11} />
            </button>
          </span>
        )}
        {!isGroup && <span className="font-mono text-[9.5px] text-white/30">{Math.round(n.c.confidence * 100)}</span>}
      </div>
      {open && n.children.map((ch) => <TreeNode key={ch.c.id} n={ch} depth={depth + 1} />)}
    </div>
  );
}
