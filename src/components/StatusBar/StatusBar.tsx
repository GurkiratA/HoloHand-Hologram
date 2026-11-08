import clsx from 'clsx';
import { useHolo } from '@/state/store';

function Dot({ tone }: { tone: 'ok' | 'warn' | 'bad' | 'off' }) {
  return <span className={clsx('inline-block h-1.5 w-1.5 rounded-full', tone === 'ok' && 'bg-emerald-400 shadow-[0_0_6px_#34d399]', tone === 'warn' && 'bg-holo-accent', tone === 'bad' && 'bg-rose-400', tone === 'off' && 'bg-white/25')} />;
}

export function StatusBar() {
  const s = useHolo();
  const cam = s.cameraStatus === 'live' ? 'ok' : s.cameraStatus === 'requesting' ? 'warn' : s.cameraStatus === 'idle' ? 'off' : 'bad';
  const rec = s.recognitionStatus;
  const recTone = rec === 'error' ? 'bad' : rec === 'scanning' || rec === 'analyzing' || rec === 'loading' ? 'warn' : rec === 'idle' ? 'off' : 'ok';
  const ai = s.server.provider ? 'cloud' : s.server.reachable ? 'local only' : 'local (no API server)';
  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 flex h-6 items-center gap-4 overflow-hidden border-t border-white/[0.06] bg-[rgba(8,11,19,0.82)] px-3 font-mono text-[10px] text-white/55 backdrop-blur-md" data-testid="status-bar">
      <span className="flex items-center gap-1.5"><Dot tone={cam} />Camera: {s.cameraStatus}</span>
      <span className="flex items-center gap-1.5"><Dot tone={recTone} />Recognition: {rec}</span>
      <span className="hidden items-center gap-1.5 md:flex"><Dot tone={s.server.provider ? 'ok' : 'off'} />AI: {ai}</span>
      <span className="flex items-center gap-1.5"><Dot tone={s.trackingStatus === 'on' ? 'ok' : s.trackingStatus === 'error' ? 'bad' : s.trackingStatus === 'loading' ? 'warn' : 'off'} />Hands: {s.trackingStatus === 'on' ? s.hands : s.trackingStatus}</span>
      <span className="hidden truncate lg:inline">Object: {s.descriptor?.name ?? '—'}</span>
      <span>Explode: {Math.round(s.explode * 100)}%</span>
      <span className="ml-auto">{s.renderFps} FPS{s.trackingStatus === 'on' ? ` · track ${s.trackFps}` : ''}</span>
      <span className="capitalize">Mode: {s.settings.renderMode}</span>
    </footer>
  );
}
