import clsx from 'clsx';
import { useHolo, holo } from '@/state/store';
import type { GestureId, ModelLevel } from '@/types';
import { nextModel } from '@/services/modelActions';
import { clearStage } from '@/services/recognitionService';
import { Slider } from './Slider';
import type { GestureToggles } from '@/state/settings';

const GESTURES: { id: GestureId; key: keyof GestureToggles; icon: string; title: string; sub: string }[] = [
  { id: 'open', key: 'open', icon: '🖐️', title: 'Open slowly', sub: 'explode it, see inside' },
  { id: 'fist', key: 'fist', icon: '✊', title: 'Close your hand', sub: 'reassemble · let go of a part' },
  { id: 'move', key: 'move', icon: '🤚', title: 'Move or twist', sub: 'rotate it · swipe to spin' },
  { id: 'point', key: 'point', icon: '☝️', title: 'Point and hold', sub: 'lock onto a part' },
  { id: 'pinch', key: 'pinch', icon: '🤏', title: 'Pinch a part', sub: 'pull it out, drag it' },
  { id: 'twoHands', key: 'twoHands', icon: '👐', title: 'Two hands', sub: 'apart or together to zoom' },
  { id: 'thumbsUp', key: 'thumbsUp', icon: '👍', title: 'Thumbs up, hold', sub: 'jump to the next model' },
  { id: 'clear', key: 'clear', icon: '🤘', title: 'Rock sign, hold', sub: 'clear the screen and rescan' },
];

export const LEVEL_BADGE: Record<ModelLevel, { text: string; cls: string }> = {
  catalog: { text: 'Catalog', cls: 'bg-holo-signal/10 text-holo-signal' },
  approximate: { text: 'Approximate', cls: 'bg-holo-pink/10 text-holo-pink' },
  recognition: { text: 'Recognition only', cls: 'bg-white/10 text-white/70' },
  user: { text: 'Uploaded', cls: 'bg-holo-purple/15 text-holo-purple' },
};

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <img src="/favicon.svg" alt="HoloHand logo" width={size} height={size} className="shrink-0 rounded-[22%] ring-1 ring-white/10" draggable={false} />
  );
}

export function Sidebar() {
  const s = useHolo();
  const d = s.descriptor;
  const partCount = s.model?.parts.length ?? d?.unmodelledComponents?.length ?? 0;
  const selected = s.model?.parts.find((p) => p.meta.id === s.selectedId)?.meta;
  const tracking =
    s.trackingStatus === 'on' ? (s.hands > 0 ? 'Hands on' : 'Ready') : s.trackingStatus === 'loading' ? 'Loading' : s.trackingStatus === 'error' ? 'Error' : 'Off';
  const conf = s.recognition ? Math.round(s.recognition.confidence * 100) : null;

  return (
    <aside className="holo-panel thin-scroll fixed right-3 top-3 z-40 max-h-[calc(100vh-44px)] w-[192px] overflow-y-auto p-3 text-white" aria-label="HoloHand controls">
      <div className="flex items-center gap-2">
        <Logo />
        <div className="leading-tight">
          <div className="text-[13px] font-semibold">HoloHand</div>
          <div className="text-[10px] text-white/45">Explode it. Look inside.</div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1">
        {d && <span className="holo-chip bg-holo-accent/15 text-holo-accent">{d.category}</span>}
        <span className="holo-chip bg-white/[0.06] text-white/55">{partCount} parts</span>
        {d && <span className={clsx('holo-chip', LEVEL_BADGE[d.level].cls)}>{LEVEL_BADGE[d.level].text}</span>}
      </div>
      <h1 className="mt-1.5 text-[16px] font-bold leading-tight tracking-tight" data-testid="object-name">
        {d?.name ?? (s.modelLoading ? 'Loading…' : 'No object yet')}
      </h1>
      <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-white/45">{d?.subtitle ?? 'Hold an object up to the camera'}</p>

      <div className="mt-2 grid grid-cols-[1.45fr_1fr_1fr] gap-1">
        <Stat label="Tracking" value={tracking} tone={s.trackingStatus === 'on' && s.hands > 0 ? 'ok' : s.trackingStatus === 'error' ? 'bad' : undefined} />
        <Stat label="Hands" value={String(s.hands)} />
        <Stat label="Match" value={conf !== null ? `${conf}%` : '—'} tone={conf !== null ? (conf >= 70 ? 'ok' : conf >= 45 ? 'warn' : 'bad') : undefined} />
      </div>

      <div className="mt-2 space-y-1.5">
        <Slider label="Explode" value={s.explode} onChange={(v) => s.setExplode(v)} display={`${Math.round(s.explode * 100)}%`} testId="explode-slider" />
        <Slider label="Explode intensity" value={(s.intensity - 0.2) / 1.8} onChange={(v) => s.setIntensity(0.2 + v * 1.8)} display={`${Math.round(s.intensity * 100)}%`} />
      </div>

      <div className="mt-2">
        <div className="mb-1 text-[10.5px] font-medium text-white/50">Gestures</div>
        <div className="space-y-[3px]">
          {GESTURES.map((g) => {
            const on = s.settings.gesturesEnabled && s.settings.gestures[g.key];
            const active = s.activeGesture === g.id || (g.id === 'move' && s.activeGesture === 'swipe');
            return (
              <div
                key={g.id}
                className={clsx(
                  'flex items-center gap-2 rounded-lg border px-2 py-[2px] transition',
                  active ? 'border-holo-accent/50 bg-holo-accent/[0.08] shadow-glow' : 'border-transparent bg-white/[0.025]',
                  !on && 'opacity-35',
                )}
                data-testid={`gesture-${g.id}`}
                data-active={active ? '1' : '0'}
              >
                <span className="text-[13px] leading-none">{g.icon}</span>
                <div className="min-w-0 leading-tight">
                  <div className="text-[10.5px] font-semibold text-white/90">{g.title}</div>
                  <div className="truncate text-[9.5px] text-white/40">{g.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="holo-card mt-2 px-2 py-1.5">
        {selected ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: selected.color, boxShadow: `0 0 6px ${selected.color}` }} />
              <span className="truncate text-[11px] font-semibold">{selected.name}</span>
            </div>
            <p className="mt-1 line-clamp-3 text-[10px] leading-snug text-white/50">{selected.description}</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-holo-accent">Locked · hold a fist to let go</p>
            <div className="mt-1.5 flex gap-1">
              <button className={clsx('holo-btn flex-1 !py-1', s.isolatedId === selected.id && 'holo-btn-on')} onClick={() => s.isolate(s.isolatedId === selected.id ? null : selected.id)}>
                Isolate
              </button>
              <button className={clsx('holo-btn flex-1 !py-1', s.focusId === selected.id && 'holo-btn-on')} onClick={() => s.focus(s.focusId === selected.id ? null : selected.id)}>
                Zoom
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              <span className="h-2 w-2 rounded-full bg-white/30" /> No part selected
            </div>
            <p className="mt-0.5 text-[10px] leading-snug text-white/45">Point at a part and hold to lock onto it, or click one.</p>
          </>
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1 pb-0.5">
        <button className="holo-btn !px-1" onClick={() => holo().set({ explode: 0, mode: 'assembly', isolatedId: null })} data-testid="btn-assemble" title="Reassemble (fist)">
          Assemble
        </button>
        <button className={clsx('holo-btn !px-1', s.explode > 0.98 && 'holo-btn-on')} onClick={() => holo().set({ explode: 1, mode: 'exploded' })} data-testid="btn-explode" title="Explode fully (open hand)">
          Explode
        </button>
        <button className={clsx('holo-btn !px-1', s.autoSpin && 'holo-btn-on')} onClick={() => holo().set({ autoSpin: !s.autoSpin })} title="Auto-spin: slowly rotate when idle">
          Spin
        </button>
        <button className="holo-btn !px-1" onClick={() => s.resetView()} data-testid="btn-reset" title="Reset rotation, zoom and selection">
          Reset
        </button>
        <button className="holo-btn !px-1" onClick={() => clearStage()} disabled={s.cameraStatus !== 'live'} title={s.cameraStatus !== 'live' ? 'Camera not available' : 'Clear the hologram and recognise a new object'}>
          Scan
        </button>
        <button className="holo-btn !px-1" onClick={() => void nextModel(1)} data-testid="btn-next" title="Next model (thumbs up)">
          Next
        </button>
      </div>
    </aside>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className="holo-card px-1.5 py-1">
      <div className="text-[9px] text-white/40">{label}</div>
      <div className={clsx('truncate text-[11px] font-semibold', tone === 'ok' && 'text-emerald-300', tone === 'warn' && 'text-holo-accent', tone === 'bad' && 'text-rose-300', !tone && 'text-white/85')}>{value}</div>
    </div>
  );
}
