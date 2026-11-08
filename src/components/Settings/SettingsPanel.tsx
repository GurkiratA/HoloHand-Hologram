import clsx from 'clsx';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useHolo } from '@/state/store';
import { DEFAULT_SETTINGS, type GestureToggles } from '@/state/settings';
import { gestureRuntime } from '@/hooks/useHandTracking';
import type { RenderMode } from '@/types';

const GESTURE_NAMES: Record<keyof GestureToggles, string> = {
  open: 'Open palm → explode',
  fist: 'Closed fist → assemble',
  move: 'Move / twist → follow & rotate',
  swipe: 'Swipe → spin',
  point: 'Point and hold → lock onto part',
  pinch: 'Pinch → grab & drag part',
  twoHands: 'Two hands → zoom',
  thumbsUp: 'Thumbs up → next model',
  clear: 'Rock sign → clear the screen',
};

export function SettingsPanel() {
  const s = useHolo();
  const st = s.settings;
  if (!s.panels.settings) return null;
  const up = s.updateSettings;
  return (
    <aside className="holo-panel thin-scroll fixed left-3 top-[92px] bottom-9 z-[46] w-[300px] overflow-y-auto p-3 text-white" data-testid="settings">
      <div className="flex items-center">
        <div className="text-[13px] font-semibold">Settings</div>
        <button className="ml-auto text-white/40 hover:text-white" onClick={() => s.togglePanel('settings', false)} aria-label="Close settings">
          <X size={14} />
        </button>
      </div>

      <Section title="Gestures">
        <Toggle label="Gesture control" value={st.gesturesEnabled} onChange={(v) => up({ gesturesEnabled: v })} />
        <div className="mt-1 space-y-0.5 pl-1">
          {(Object.keys(GESTURE_NAMES) as (keyof GestureToggles)[]).map((k) => (
            <Toggle key={k} small label={GESTURE_NAMES[k]} value={st.gestures[k]} onChange={(v) => up({ gestures: { ...st.gestures, [k]: v } })} />
          ))}
        </div>
        <Range label="Sensitivity" value={st.sensitivity} min={0.5} max={2} step={0.05} onChange={(v) => up({ sensitivity: v })} fmt={(v) => `${v.toFixed(2)}×`} />
        <Range label="Tracking smoothing" value={st.smoothing} min={0} max={0.9} step={0.05} onChange={(v) => up({ smoothing: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Toggle label="Hologram follows hand" value={st.followHand} onChange={(v) => up({ followHand: v })} />
        <Calibration />
      </Section>

      <Section title="Display">
        <label className="flex items-center justify-between text-[11px]">
          <span className="text-white/60">Render mode</span>
          <select className="holo-input !w-32 !py-1" value={st.renderMode} onChange={(e) => up({ renderMode: e.target.value as RenderMode })}>
            <option value="hologram">Hologram</option>
            <option value="wireframe">Wireframe</option>
            <option value="points">Point cloud</option>
            <option value="solid">Solid</option>
            <option value="xray">X-ray</option>
          </select>
        </label>
        <label className="mt-1.5 flex items-center justify-between text-[11px]">
          <span className="text-white/60">Labels</span>
          <select className="holo-input !w-32 !py-1" value={st.labels} onChange={(e) => up({ labels: e.target.value as 'auto' | 'always' | 'off' })}>
            <option value="auto">When exploded</option>
            <option value="always">Always</option>
            <option value="off">Selected only</option>
          </select>
        </label>
        <label className="mt-1.5 flex items-center justify-between text-[11px]">
          <span className="text-white/60">Quality (points)</span>
          <select className="holo-input !w-32 !py-1" value={st.quality} onChange={(e) => up({ quality: e.target.value as 'low' | 'medium' | 'high' })}>
            <option value="low">Low – fastest</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <Toggle label="Hand skeleton" value={st.showSkeleton} onChange={(v) => up({ showSkeleton: v })} />
        <Toggle label="Holographic hand rings" value={st.showRings} onChange={(v) => up({ showRings: v })} />
        <Toggle label="Mirror camera (selfie view)" value={st.mirror} onChange={(v) => up({ mirror: v })} />
      </Section>

      <Section title="Recognition">
        <Toggle label="Automatic recognition (Live mode)" value={st.recognitionEnabled} onChange={(v) => up({ recognitionEnabled: v })} />
        <Range label="Scan interval" value={st.recognitionInterval} min={300} max={2000} step={50} onChange={(v) => up({ recognitionInterval: v })} fmt={(v) => `${Math.round(v)} ms`} />
        <Range label="Ask to confirm below" value={st.confirmBelow} min={0.2} max={0.9} step={0.05} onChange={(v) => up({ confirmBelow: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Toggle label="Use cloud AI when configured" value={st.useCloudAI} onChange={(v) => up({ useCloudAI: v })} />
        <div className="mt-1.5 rounded-lg bg-white/[0.04] p-2 text-[10.5px] leading-snug text-white/55">
          {s.server.provider ? (
            <>Cloud AI: <b className="text-white/85">connected</b>. When you hold something up, a cropped frame around your hand is sent to identify it.</>
          ) : s.server.reachable ? (
            <>API server running without an AI key – recognition is on-device only. Add a key to <code>.env</code> (see README) for brand/model detail and AI-generated approximations.</>
          ) : (
            <>API server not reachable – on-device recognition only. Start it with <code>npm run dev</code>.</>
          )}
        </div>
      </Section>

      <button className="holo-btn mt-3 w-full" onClick={() => up({ ...DEFAULT_SETTINGS })}>
        Reset all settings
      </button>
    </aside>
  );
}

function Calibration() {
  const [step, setStep] = useState<'idle' | 'open' | 'fist' | 'done'>('idle');
  const [msg, setMsg] = useState('');
  const s = useHolo();
  const sample = (ms: number) =>
    new Promise<number | null>((resolve) => {
      const vals: number[] = [];
      const t = setInterval(() => {
        const h = gestureRuntime.engine?.snapshot.hands[0];
        if (h) vals.push(h.analysis.ratios.reduce((a, b) => a + b, 0) / 4);
      }, 50);
      setTimeout(() => {
        clearInterval(t);
        resolve(vals.length > 8 ? vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)] : null);
      }, ms);
    });
  const run = async () => {
    if (s.trackingStatus !== 'on') return setMsg('Hand tracking is not running.');
    setStep('open');
    setMsg('Hold your hand fully OPEN facing the camera…');
    const open = await sample(2000);
    setStep('fist');
    setMsg('Now make a FIST…');
    const fist = await sample(2000);
    if (!open || !fist || open - fist < 0.3) {
      setStep('idle');
      return setMsg('Could not see a clear difference – make sure one hand is visible and try again.');
    }
    s.updateSettings({ calibration: { open: open - 0.08, fist: fist + 0.05 } });
    setStep('done');
    setMsg(`Calibrated: fist ${fist.toFixed(2)}, open ${open.toFixed(2)}`);
  };
  return (
    <div className="mt-2 rounded-lg bg-white/[0.04] p-2 text-[10.5px]">
      <div className="flex items-center justify-between">
        <span className="text-white/60">Hand calibration</span>
        <div className="flex gap-1">
          {s.settings.calibration && (
            <button className="holo-btn !py-0.5" onClick={() => (s.updateSettings({ calibration: null }), setMsg('Using default thresholds'))}>
              Clear
            </button>
          )}
          <button className="holo-btn !py-0.5" disabled={step === 'open' || step === 'fist'} onClick={() => void run()}>
            Calibrate
          </button>
        </div>
      </div>
      {msg && <p className={clsx('mt-1', step === 'open' || step === 'fist' ? 'text-holo-accent' : 'text-white/50')}>{msg}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 border-t border-white/[0.06] pt-2.5">
      <div className="holo-label mb-1.5">{title}</div>
      {children}
    </section>
  );
}

function Toggle({ label, value, onChange, small }: { label: string; value: boolean; onChange: (v: boolean) => void; small?: boolean }) {
  return (
    <label className={clsx('flex cursor-pointer items-center justify-between py-0.5', small ? 'text-[10.5px] text-white/55' : 'text-[11px] text-white/75')}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={clsx('relative h-4 w-7 rounded-full transition', value ? 'bg-holo-signal/70' : 'bg-white/15')}
      >
        <span className={clsx('absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all', value ? 'left-3.5' : 'left-0.5')} />
      </button>
    </label>
  );
}

function Range({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <label className="mt-1.5 block text-[11px]">
      <div className="flex justify-between">
        <span className="text-white/60">{label}</span>
        <span className="font-mono text-[10px] text-white/80">{fmt(value)}</span>
      </div>
      <input type="range" className="holo-range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ ['--fill' as string]: `${((value - min) / (max - min)) * 100}%` }} />
    </label>
  );
}
