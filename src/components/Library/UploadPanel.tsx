import { UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { useHolo } from '@/state/store';
import { loadUploadedFile } from '@/services/modelActions';
import { Modal } from './Modal';

export function UploadPanel() {
  const s = useHolo();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  if (!s.panels.upload) return null;
  const close = () => s.togglePanel('upload', false);
  const take = async (f?: File | null) => {
    if (!f) return;
    close();
    await loadUploadedFile(f);
  };
  return (
    <Modal title="Manual model mode – upload a GLB / GLTF" onClose={close} testId="upload">
      <div
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center transition ${drag ? 'border-holo-cyan bg-holo-cyan/5' : 'border-white/15'}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => (e.preventDefault(), setDrag(false), void take(e.dataTransfer.files[0]))}
      >
        <UploadCloud className="text-holo-cyan" />
        <div className="mt-2 text-[12px] font-medium">Drop a .glb / .gltf here, or click to choose</div>
        <div className="mt-1 text-[10.5px] text-white/45">Each mesh or top-level node becomes an explodable component. The file stays in this browser (IndexedDB).</div>
        <input ref={input} type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" className="hidden" onChange={(e) => void take(e.target.files?.[0])} data-testid="upload-input" />
      </div>
      <ul className="mt-3 list-inside list-disc space-y-0.5 text-[10.5px] text-white/45">
        <li>Best results: separate, sensibly named meshes (e.g. <code>front_wing</code>, <code>wheel_fl</code>).</li>
        <li>Optional metadata: put a <code>holo</code> object in node extras (see README) for names, descriptions and explosion vectors.</li>
        <li>.gltf files must embed their buffers/textures. Draco / Meshopt compression is not supported.</li>
      </ul>
    </Modal>
  );
}
