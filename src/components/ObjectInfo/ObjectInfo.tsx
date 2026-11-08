import { AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useHolo } from '@/state/store';
import { sourceLabel } from '@/utils/text';
import { LEVEL_BADGE } from '@/components/Sidebar/Sidebar';

const LEVEL_TEXT = {
  catalog: 'Level 1 · Catalog model with named component meshes.',
  approximate: 'Level 2 · Approximate model – not an accurate reconstruction.',
  recognition: 'Level 3 · Recognition only – no reliable 3D component model.',
  user: 'Your model – components come from the file’s mesh names.',
};

/** Structured recognition details + model provenance. */
export function ObjectInfo() {
  const s = useHolo();
  const d = s.descriptor;
  const r = s.recognition;
  if (!d) return <p className="text-[11px] text-white/45">Nothing loaded yet.</p>;
  return (
    <div className="space-y-3 text-[11px]" data-testid="object-info">
      <div>
        <div className="text-[14px] font-semibold">{d.name}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          <span className="holo-chip bg-holo-accent/15 text-holo-accent">{d.category}</span>
          <span className={clsx('holo-chip', LEVEL_BADGE[d.level].cls)}>{LEVEL_BADGE[d.level].text}</span>
        </div>
        <p className="mt-1.5 text-white/55">{LEVEL_TEXT[d.level]}</p>
      </div>
      {d.disclaimer && (
        <div className="flex gap-2 rounded-lg border border-holo-accent/25 bg-holo-accent/[0.06] p-2 text-[10.5px] leading-snug text-holo-accent/90">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>{d.disclaimer}</span>
        </div>
      )}
      {r && (
        <section>
          <div className="holo-label mb-1">Recognition</div>
          <dl className="space-y-0.5">
            <KV k="Object" v={r.objectName} />
            <KV k="Category" v={r.category} />
            <KV k="Brand" v={r.brand ?? 'Not identifiable'} />
            <KV k="Model" v={r.model ?? 'Not identifiable'} />
            <KV k="Confidence" v={`${Math.round(r.confidence * 100)}%`} />
            <KV k="Source" v={sourceLabel(r.provider)} />
            {r.orientation && <KV k="Orientation" v={r.orientation} />}
          </dl>
          {r.characteristics.length > 0 && (
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-white/60">
              {r.characteristics.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
          {r.notes && <p className="mt-1.5 text-[10.5px] text-white/45">{r.notes}</p>}
          {r.evidence && r.evidence.length > 0 && (
            <div className="mt-1.5">
              <div className="text-[10px] text-white/40">On-device evidence</div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {r.evidence.map((e, i) => (
                  <span key={i} className="holo-chip bg-white/[0.05] text-white/60">
                    {e.label.split(',')[0]} {Math.round(e.score * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}
          {r.searchTerms.length > 0 && <KV k="Search terms" v={r.searchTerms.join(', ')} />}
        </section>
      )}
      {d.unmodelledComponents && d.unmodelledComponents.length > 0 && (
        <section>
          <div className="holo-label mb-1">Identified but not modelled</div>
          <ul className="space-y-1">
            {d.unmodelledComponents.map((c, i) => (
              <li key={i}>
                <span className="font-medium text-white/85">{c.name}</span>
                <span className="text-white/45"> – {c.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <div className="holo-label mb-1">Model source</div>
        <KV k="Source" v={d.sourceLabel} />
        {d.license && <KV k="License" v={d.license} />}
        {d.attribution && <KV k="Attribution" v={d.attribution} />}
        {s.recognitionMessage && s.recognitionStatus === 'locked' && <p className="mt-1 text-[10px] text-white/40">Pipeline: {s.recognitionMessage}</p>}
      </section>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-white/40">{k}</dt>
      <dd className="text-white/85">{v}</dd>
    </div>
  );
}
