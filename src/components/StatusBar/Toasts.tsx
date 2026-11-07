import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useHolo } from '@/state/store';

export function Toasts() {
  const toasts = useHolo((s) => s.toasts);
  const hint = useHolo((s) => s.gestureHint);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-14 z-[60] flex flex-col items-center gap-1.5">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={clsx('holo-panel !rounded-full px-3 py-1 text-[11px]', t.tone === 'error' && 'text-rose-200', t.tone === 'warn' && 'text-holo-yellow', t.tone === 'ok' && 'text-emerald-200', t.tone === 'info' && 'text-white/85')}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
      <AnimatePresence>
        {hint && (
          <motion.div key={hint} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed bottom-[76px] left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium text-holo-yellow backdrop-blur" data-testid="gesture-hint">
            {hint}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
