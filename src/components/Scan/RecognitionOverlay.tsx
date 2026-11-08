import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useHolo } from '@/state/store';
import { confirmPending, rejectPending } from '@/services/recognitionService';
import { sourceLabel } from '@/utils/text';

const band = (c: number) => (c >= 0.75 ? 'High confidence' : c >= 0.5 ? 'Medium confidence' : 'Low confidence');

/** Scanning HUD, "OBJECT DETECTED" card and the low-confidence confirmation prompt. */
export function RecognitionOverlay() {
  const status = useHolo((s) => s.recognitionStatus);
  const msg = useHolo((s) => s.recognitionMessage);
  const rec = useHolo((s) => s.recognition);
  const mode = useHolo((s) => s.mode);
  const openScan = () => useHolo.getState().togglePanel('scan', true);
  const scanning = mode === 'live' && (status === 'scanning' || status === 'analyzing' || status === 'loading');
  const hasModel = useHolo((s) => !!s.model);

  return (
    <>
      {/* scanning pill */}
      <AnimatePresence>
        {scanning && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="pointer-events-none fixed inset-x-0 top-3 z-30 flex justify-center">
            <div className="holo-panel flex items-center gap-2 px-3.5 py-1.5 text-[11px] text-white/85" data-testid="scan-pill">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-holo-signal opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-holo-signal" />
              </span>
              <span className="font-semibold tracking-wider text-holo-signal">{status === 'analyzing' ? 'ANALYZING' : status === 'loading' ? 'LOADING' : 'SCANNING'}</span>
              <span className="text-white/60">{msg}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* scan frame (only when nothing is displayed): corners only, so the object stays in plain view */}
      <AnimatePresence>
        {scanning && !hasModel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-[12%] z-[15]">
            <span className="scan-corner left-0 top-0 border-b-0 border-r-0" />
            <span className="scan-corner right-0 top-0 border-b-0 border-l-0" />
            <span className="scan-corner bottom-0 left-0 border-r-0 border-t-0" />
            <span className="scan-corner bottom-0 right-0 border-l-0 border-t-0" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* object detected */}
      <AnimatePresence>
        {status === 'detected' && rec && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            className="pointer-events-none fixed inset-x-0 top-14 z-30 flex justify-center"
            data-testid="detected-card"
          >
            <div className="holo-panel pointer-events-auto w-[320px] overflow-hidden !border-holo-signal/40 p-4 shadow-signal">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-holo-signal">
                <span className="h-1.5 w-1.5 rounded-full bg-holo-signal shadow-[0_0_8px_#a7b4ff]" /> OBJECT DETECTED
              </div>
              <dl className="space-y-1 font-mono text-[11.5px]">
                <Line k="Object" v={rec.objectName} />
                <Line k="Category" v={rec.category} />
                {rec.brand && <Line k="Brand" v={rec.brand} />}
                <Line k="Recognition" v={`${band(rec.confidence)} (${Math.round(rec.confidence * 100)}%)`} />
                <Line k="Components" v={`${rec.components.length} identified`} />
                <Line k="Source" v={sourceLabel(rec.provider)} />
              </dl>
              <div className="mt-3 h-0.5 overflow-hidden rounded bg-white/10">
                <motion.div className="h-full bg-holo-signal" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2.5, ease: 'linear' }} />
              </div>
              <div className="mt-2.5 flex gap-1.5">
                <button className="holo-btn flex-1" onClick={() => void confirmPending()}>Continue</button>
                <button className="holo-btn" onClick={rejectPending}>Not it</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* confirm (low confidence) */}
      <AnimatePresence>
        {status === 'confirm' && rec && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-x-0 top-14 z-30 flex justify-center" data-testid="confirm-card">
            <div className="holo-panel pointer-events-auto w-[320px] p-4 text-white">
              <div className="text-[11px] font-bold tracking-[0.2em] text-holo-accent">NOT SURE</div>
              <p className="mt-1.5 text-[13px]">
                Is this a <span className="font-semibold text-holo-accent">{rec.objectName}</span>?
              </p>
              <p className="mt-1 text-[10.5px] text-white/50">
                {band(rec.confidence)} ({Math.round(rec.confidence * 100)}%).{' '}
                {rec.evidence?.slice(0, 3).map((e) => e.label.split(',')[0]).join(', ')}
              </p>
              <div className="mt-3 h-0.5 overflow-hidden rounded bg-white/10">
                <motion.div className="h-full bg-holo-accent" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 5, ease: 'linear' }} />
              </div>
              <div className="mt-3 flex gap-1.5">
                <button className="holo-btn holo-btn-on flex-1" onClick={() => void confirmPending()} data-testid="confirm-yes">Yes</button>
                <button className="holo-btn flex-1" onClick={rejectPending}>No, rescan</button>
                <button
                  className="holo-btn"
                  onClick={() => {
                    rejectPending();
                    openScan();
                  }}
                  title="Search manually"
                >
                  <Search size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 text-white/40">{k}:</dt>
      <dd className="flex-1 text-white">{v}</dd>
    </div>
  );
}
