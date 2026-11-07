import { X } from 'lucide-react';
import { motion } from 'framer-motion';

export function Modal({ title, onClose, children, wide, testId }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; testId?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={`holo-panel thin-scroll max-h-[82vh] w-full overflow-y-auto p-4 text-white ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        onClick={(e) => e.stopPropagation()}
        data-testid={testId}
      >
        <div className="mb-3 flex items-center">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          <button className="ml-auto text-white/40 hover:text-white" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
