import { holo, useHolo } from '@/state/store';
import type { LoadedModel } from '@/three/models/prepareModel';
import type { RecognitionResult } from '@/types';
import { viewState } from '@/three/interactions/viewState';
import { loadByKey, modelFromUpload, playlist, resolveModel } from './modelService';
import { storage } from './storageService';

let current: LoadedModel | null = null;

/** Swap the displayed model, disposing GPU resources of the previous one. */
export function showModel(model: LoadedModel | null, key: string | null) {
  const prev = current;
  current = model;
  useHolo.setState({
    model,
    descriptor: model?.descriptor ?? holo().descriptor,
    modelKey: key,
    selectedId: null,
    hoveredId: null,
    isolatedId: null,
    focusId: null,
    explode: 0,
  });
  viewState.reset();
  if (prev && prev !== model) setTimeout(() => prev.dispose(), 100);
}

export async function loadModelKey(key: string) {
  const s = holo();
  s.set({ modelLoading: true });
  try {
    const model = await loadByKey(key);
    showModel(model, key);
    holo().set({ recognition: null, mode: holo().mode === 'live' ? 'explore' : holo().mode });
  } catch (e) {
    holo().toast(`Could not load model: ${(e as Error).message}`, 'error');
  } finally {
    holo().set({ modelLoading: false });
  }
}

export async function nextModel(direction = 1) {
  const list = await playlist();
  if (!list.length) return;
  const i = list.findIndex((p) => p.key === holo().modelKey);
  const next = list[(i + direction + list.length) % list.length];
  await loadModelKey(next.key);
  holo().toast(`${next.category} · ${next.name}`, 'info');
}

export async function loadUploadedFile(file: File) {
  if (!/\.(glb|gltf)$/i.test(file.name)) {
    holo().toast('Please choose a .glb or .gltf file (self-contained, textures embedded).', 'warn');
    return;
  }
  if (file.size > 80 * 1024 * 1024) {
    holo().toast('That file is larger than 80 MB – please simplify the model first.', 'warn');
    return;
  }
  holo().set({ modelLoading: true });
  try {
    const data = await file.arrayBuffer();
    const id = `${Date.now().toString(36)}`;
    const model = await modelFromUpload(file.name, data, id);
    await storage.addUpload({ id, time: Date.now(), name: file.name.replace(/\.(glb|gltf)$/i, ''), size: file.size, data });
    showModel(model, `upload:${id}`);
    holo().set({ mode: 'manual', recognition: null });
    holo().toast(`Loaded ${model.parts.length} components from ${file.name}`, 'ok');
  } catch (e) {
    holo().toast(`Could not read model: ${(e as Error).message}. Draco/Meshopt-compressed files are not supported.`, 'error');
  } finally {
    holo().set({ modelLoading: false });
  }
}

/** Pipeline steps 3–5 for a recognition result, plus history logging. */
export async function applyRecognition(rec: RecognitionResult, thumbnail: string | null) {
  holo().set({ modelLoading: true, recognition: rec });
  try {
    const res = await resolveModel(rec);
    if (res.model) {
      showModel(res.model, res.model.descriptor.id);
      holo().set({ explode: 0.0 });
      setTimeout(() => holo().model === res.model && holo().setExplode(0.35), 1600);
    } else {
      showModel(null, null);
      useHolo.setState({ descriptor: res.descriptor });
      holo().togglePanel('explorer', true);
      holo().set({ panels: { ...holo().panels, explorer: true, explorerTab: 'info' } });
    }
    holo().set({ mode: 'explore', recognitionStatus: 'locked', recognitionMessage: res.steps.join(' → ') });
    await storage.addHistory({
      id: `${Date.now()}`,
      time: Date.now(),
      name: rec.objectName,
      category: rec.category,
      thumbnail,
      recognition: rec,
      modelRef: res.model?.descriptor.id ?? null,
    });
  } catch (e) {
    holo().toast(`Model resolution failed: ${(e as Error).message}`, 'error');
  } finally {
    holo().set({ modelLoading: false });
  }
}
