import { useEffect } from 'react';
import { useHolo } from '@/state/store';
import { registerLabel, unregisterLabel } from './labels';
import { InfoCard } from '@/components/ObjectInfo/InfoCard';

/** Floating component labels with thin leader lines (positions written imperatively each frame). */
export function LabelLayer() {
  const model = useHolo((s) => s.model);
  const parts = model?.parts ?? [];
  useEffect(() => () => parts.forEach((p) => unregisterLabel(p.meta.id)), [parts]);
  return (
    <div className="pointer-events-none fixed inset-0 z-[25]" data-testid="label-layer">
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        {parts.map((p) => (
          <g key={p.meta.id}>
            <path ref={(el) => { if (el) registerLabel(p.meta.id, { line: el }); }} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={0.8} opacity={0} />
            <circle ref={(el) => { if (el) registerLabel(p.meta.id, { dot: el }); }} r={2.2} fill={p.meta.color ?? 'white'} opacity={0} />
          </g>
        ))}
      </svg>
      {parts.map((p) => (
        <div key={p.meta.id} ref={(el) => { if (el) registerLabel(p.meta.id, { label: el }); }} className="holo-tag" style={{ opacity: 0 }} data-part={p.meta.id}>
          {p.meta.name}
        </div>
      ))}
      <InfoCard />
    </div>
  );
}
