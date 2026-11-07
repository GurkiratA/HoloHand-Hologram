import * as THREE from 'three';
import type { LoadedModel } from '@/three/models/prepareModel';

/**
 * Imperative label layout. React renders one element per component once;
 * every frame the scene controller projects anchors and writes positions
 * straight to the DOM (no React re-render).
 */
interface LabelEls {
  label: HTMLDivElement;
  line: SVGPathElement;
  dot: SVGCircleElement;
}

const els = new Map<string, LabelEls>();
export const cardEl: { current: HTMLDivElement | null } = { current: null };
export const labelLayout = new Map<string, { x: number; y: number; ax: number; ay: number; side: 'l' | 'r'; visible: boolean }>();

export function registerLabel(id: string, e: Partial<LabelEls>) {
  const cur = els.get(id) ?? ({} as LabelEls);
  Object.assign(cur, e);
  els.set(id, cur);
}
export function unregisterLabel(id: string) {
  els.delete(id);
  labelLayout.delete(id);
}

const v = new THREE.Vector3();
const c = new THREE.Vector3();

export interface LabelParams {
  model: LoadedModel;
  camera: THREE.Camera;
  width: number;
  height: number;
  /** pixels reserved on the left for the sidebar */
  leftInset: number;
  /** pixels covered on the right by an open side panel */
  rightInset: number;
  /** 0..1 fade for automatic labels */
  autoVisibility: number;
  mode: 'auto' | 'always' | 'off';
  selectedId: string | null;
  hoveredId: string | null;
  rootCenter: THREE.Vector3;
  rootRadiusWorld: number;
  rootScale: number;
}

const GAP = 22;

export function updateLabels(p: LabelParams) {
  const { model, camera, width: W, height: H } = p;
  const toPx = (world: THREE.Vector3) => {
    v.copy(world).project(camera);
    return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H] as const;
  };
  const [cx] = toPx(p.rootCenter);
  c.copy(p.rootCenter).add(new THREE.Vector3(p.rootRadiusWorld, 0, 0));
  const [ex] = toPx(c);
  const rPx = Math.abs(ex - cx);
  const pxPerUnit = rPx / Math.max(1e-3, p.rootRadiusWorld);
  let minX = cx - rPx;
  let maxX = cx + rPx;

  type Item = { id: string; ax: number; ay: number; y: number; side: 'l' | 'r'; strong: boolean };
  const left: Item[] = [];
  const right: Item[] = [];
  for (const part of model.parts) {
    const e = els.get(part.meta.id);
    if (!e?.label) continue;
    const strong = part.meta.id === p.selectedId || part.meta.id === p.hoveredId;
    const show = part.node.visible && (strong || (p.mode !== 'off' && (p.mode === 'always' || p.autoVisibility > 0.02)));
    if (!show) {
      e.label.style.opacity = '0';
      e.line?.setAttribute('opacity', '0');
      e.dot?.setAttribute('opacity', '0');
      const prev = labelLayout.get(part.meta.id);
      if (prev) prev.visible = false;
      continue;
    }
    part.node.updateWorldMatrix(true, true);
    // radial parts (e.g. 9 cylinders) anchor on one of their instances rather than the empty centre
    const world = part.radial?.length
      ? part.radial[(model.parts.indexOf(part) * 3) % part.radial.length].obj.localToWorld(v.set(0, 0, 0))
      : part.node.localToWorld(v.copy(part.anchorLocal));
    const [ax, ay] = toPx(world.clone());
    const reach = part.size * p.rootScale * pxPerUnit;
    minX = Math.min(minX, ax - reach);
    maxX = Math.max(maxX, ax + reach);
    const item: Item = { id: part.meta.id, ax, ay, y: ay, side: ax >= cx ? 'r' : 'l', strong };
    (item.side === 'r' ? right : left).push(item);
  }

  const resolve = (items: Item[]) => {
    items.sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) if (items[i].y < items[i - 1].y + GAP) items[i].y = items[i - 1].y + GAP;
    const maxY = H - 70;
    if (items.length && items[items.length - 1].y > maxY) {
      items[items.length - 1].y = maxY;
      for (let i = items.length - 2; i >= 0; i--) if (items[i].y > items[i + 1].y - GAP) items[i].y = items[i + 1].y - GAP;
    }
    for (const it of items) it.y = Math.max(60, it.y);
  };
  resolve(left);
  resolve(right);
  // label columns sit just outside the exploded parts, clamped to the free screen area
  const rightX = Math.min(W - p.rightInset - 150, Math.max(cx + 60, maxX + 28));
  const leftW = left.reduce((m, it) => Math.max(m, els.get(it.id)?.label.offsetWidth ?? 0), 0);
  const leftX = Math.max(p.leftInset + 22 + leftW, Math.min(cx - 60, minX - 28));

  for (const it of [...left, ...right]) {
    const e = els.get(it.id)!;
    const lx = it.side === 'r' ? rightX : leftX;
    const op = it.strong ? 1 : p.mode === 'always' ? 0.9 : p.autoVisibility * 0.9;
    e.label.style.opacity = String(op);
    e.label.style.transform = `translate(${it.side === 'r' ? lx + 6 : lx - 6}px, ${it.y}px) translate(${it.side === 'r' ? '0' : '-100%'}, -50%)`;
    e.label.dataset.side = it.side;
    e.label.dataset.strong = it.strong ? '1' : '0';
    const elbowX = it.side === 'r' ? Math.max(it.ax + 12, lx - 40) : Math.min(it.ax - 12, lx + 40);
    e.line?.setAttribute('d', `M${it.ax.toFixed(1)},${it.ay.toFixed(1)} L${elbowX.toFixed(1)},${it.y.toFixed(1)} L${lx.toFixed(1)},${it.y.toFixed(1)}`);
    e.line?.setAttribute('opacity', String(op * 0.75));
    e.dot?.setAttribute('cx', it.ax.toFixed(1));
    e.dot?.setAttribute('cy', it.ay.toFixed(1));
    e.dot?.setAttribute('opacity', String(op));
    labelLayout.set(it.id, { x: lx, y: it.y, ax: it.ax, ay: it.ay, side: it.side, visible: true });
  }

  // floating info card next to the selected part
  const card = cardEl.current;
  if (card) {
    const lay = p.selectedId ? labelLayout.get(p.selectedId) : undefined;
    if (lay?.visible) {
      const cw = card.offsetWidth || 280;
      const ch = card.offsetHeight || 200;
      let x = lay.side === 'r' ? lay.x + 8 : lay.x - cw - 8;
      x = Math.max(p.leftInset + 12, Math.min(W - p.rightInset - cw - 12, x));
      let y = lay.y + 18;
      if (y + ch > H - 70) y = lay.y - ch - 18;
      y = Math.max(60, y);
      card.style.transform = `translate(${x}px, ${y}px)`;
      card.style.opacity = '1';
    } else {
      card.style.opacity = '0';
    }
  }
}
