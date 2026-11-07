import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useHolo, holo } from '@/state/store';
import { HoloVisuals } from '@/three/scene/holoVisuals';
import { applyExplosion } from '@/three/explosion/explosionEngine';
import { globalUniforms } from '@/three/shaders/holoMaterials';
import { viewState } from '@/three/interactions/viewState';
import { sceneApi, setSceneApi } from '@/three/interactions/sceneApi';
import { HoloEffects } from '@/three/effects/HoloEffects';
import { updateLabels } from './labels';

export const SIDEBAR_INSET = 214;

function SceneController() {
  const model = useHolo((s) => s.model);
  const quality = useHolo((s) => s.settings.quality);
  const resetToken = useHolo((s) => s.viewResetToken);
  const { camera, gl, size } = useThree();
  const root = useRef<THREE.Group>(null);
  const visuals = useRef<HoloVisuals | null>(null);
  const scratch = useMemo(() => new Map<string, THREE.Vector3>(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const state = useRef({ explode: 0, reveal: 0, focusOffset: new THREE.Vector3(), focusScale: 1, frames: 0, fpsT: performance.now(), labelsVis: 0 });

  // build render layers when the model changes
  useEffect(() => {
    const r = root.current;
    if (!r || !model) return;
    const v = new HoloVisuals(model, quality);
    visuals.current = v;
    model.content.position.set(0, 0, 0);
    r.add(model.content);
    state.current.reveal = 0;
    state.current.explode = Math.min(state.current.explode, 0.05);
    return () => {
      r.remove(model.content);
      v.dispose();
      visuals.current = null;
    };
  }, [model, quality]);

  useEffect(() => {
    viewState.reset();
  }, [resetToken]);

  // ------------------------------------------------------------------ helpers
  const home = useMemo(() => new THREE.Vector3(), []);
  const screenToWorld = (px: number, py: number, target = new THREE.Vector3()) => {
    const ndc = new THREE.Vector3((px / size.width) * 2 - 1, -(py / size.height) * 2 + 1, 0.5).unproject(camera);
    const dir = ndc.sub(camera.position).normalize();
    const t = -camera.position.z / dir.z;
    return target.copy(camera.position).addScaledVector(dir, t);
  };

  const pick = (px: number, py: number): string | null => {
    const m = holo().model;
    if (!m) return null;
    const ndc = new THREE.Vector2((px / size.width) * 2 - 1, -(py / size.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const meshes = m.parts.filter((p) => p.node.visible).flatMap((p) => p.meshes);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (hit) {
      const part = m.parts.find((p) => p.meshes.includes(hit.object as THREE.Mesh));
      if (part) return part.meta.id;
    }
    // fall back to the nearest label anchor in screen space (point clouds are sparse)
    let best: string | null = null;
    let bestD = 48;
    const v = new THREE.Vector3();
    for (const p of m.parts) {
      if (!p.node.visible) continue;
      p.node.localToWorld(v.copy(p.anchorLocal)).project(camera);
      const d = Math.hypot((v.x * 0.5 + 0.5) * size.width - px, (-v.y * 0.5 + 0.5) * size.height - py);
      if (d < bestD) {
        bestD = d;
        best = p.meta.id;
      }
    }
    return best;
  };

  useEffect(() => {
    setSceneApi({
      pick,
      screenToWorld: (px, py) => screenToWorld(px, py).toArray() as [number, number, number],
      home: () => home.toArray() as [number, number, number],
      canvas: () => gl.domElement,
      dragPart(id, from, to) {
        const m = holo().model;
        const r = root.current;
        const part = m?.parts.find((p) => p.meta.id === id);
        if (!part || !r || !m) return;
        const a = screenToWorld(from[0], from[1]);
        const b = screenToWorld(to[0], to[1]);
        const delta = b.sub(a);
        // world delta -> model content space
        const inv = new THREE.Matrix4().copy(m.content.matrixWorld).invert();
        const o = new THREE.Vector3().applyMatrix4(inv);
        const d = delta.applyMatrix4(inv).sub(o);
        part.drag.add(d);
        if (part.drag.length() > 2.5) part.drag.setLength(2.5);
      },
    });
    return () => setSceneApi(null);
  });

  // ------------------------------------------------------------------ mouse
  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number; moved: boolean; button: number; part: string | null } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, moved: false, button: e.button, part: e.shiftKey ? pick(e.clientX, e.clientY) : null };
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) {
        holo().hover(pick(e.clientX, e.clientY));
        el.style.cursor = holo().hoveredId ? 'pointer' : 'grab';
        return;
      }
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) down.moved = true;
      if (down.part) {
        sceneApiDrag(down.part, [down.x, down.y], [e.clientX, e.clientY]);
      } else if (down.button === 2) {
        holo().setExplode(holo().explode - dy * 0.004);
      } else {
        viewState.rotate(dx * 0.008, dy * 0.006);
      }
      down.x = e.clientX;
      down.y = e.clientY;
      el.style.cursor = 'grabbing';
    };
    const onUp = (e: PointerEvent) => {
      if (down && !down.moved && down.button === 0) {
        const id = pick(e.clientX, e.clientY);
        holo().select(id === holo().selectedId ? null : id);
      }
      down = null;
      el.style.cursor = 'grab';
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.shiftKey || e.altKey) holo().setExplode(holo().explode - Math.sign(e.deltaY) * 0.05);
      else viewState.zoomBy(Math.exp(-e.deltaY * 0.0012));
    };
    const onDbl = (e: MouseEvent) => {
      const id = pick(e.clientX, e.clientY);
      if (id) {
        holo().select(id);
        holo().focus(holo().focusId === id ? null : id);
      }
    };
    const onCtx = (e: Event) => e.preventDefault();
    const sceneApiDrag = (id: string, a: [number, number], b: [number, number]) => sceneApi()?.dragPart(id, a, b);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('dblclick', onDbl);
    el.addEventListener('contextmenu', onCtx);
    el.style.cursor = 'grab';
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dblclick', onDbl);
      el.removeEventListener('contextmenu', onCtx);
    };
  });

  // ------------------------------------------------------------------ frame loop
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((three, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    const s = holo();
    const st = state.current;
    const r = root.current;
    globalUniforms.uTime.value += dt;
    globalUniforms.uPixelRatio.value = gl.getPixelRatio();

    // home point: centre of the area right of the sidebar
    const inset = size.width > 760 ? SIDEBAR_INSET : 0;
    const rightInset = s.panels.explorer || s.panels.settings ? 300 : 0;
    screenToWorld(inset + (size.width - inset - rightInset) / 2, size.height * 0.47, home);

    // explode smoothing
    st.explode += (s.explode - st.explode) * (1 - Math.exp(-dt * 6));
    st.reveal = Math.min(1, st.reveal + dt / 1.4);
    globalUniforms.uReveal.value = st.reveal;

    // rotation with inertia + auto-spin
    viewState.idle += dt;
    viewState.yaw += viewState.yawVel * dt;
    viewState.pitch = THREE.MathUtils.clamp(viewState.pitch + viewState.pitchVel * dt, -1.2, 1.2);
    viewState.yawVel *= Math.exp(-dt * 2.2);
    viewState.pitchVel *= Math.exp(-dt * 2.2);
    if (s.autoSpin && viewState.idle > 2.5 && !s.focusId) viewState.yaw += dt * 0.25;
    viewState.scale += (viewState.scaleTarget - viewState.scale) * (1 - Math.exp(-dt * 6));
    viewState.pos.lerp(viewState.posTarget, 1 - Math.exp(-dt * 5));

    if (r) {
      // focus on a component: zoom and bring it to the home point
      const focusPart = s.focusId && s.model ? s.model.parts.find((p) => p.meta.id === s.focusId) : null;
      st.focusScale += ((focusPart ? 1.9 : 1) - st.focusScale) * (1 - Math.exp(-dt * 4));
      r.rotation.set(viewState.pitch, viewState.yaw, 0, 'XYZ');
      // auto-frame: shrink slightly as parts fly apart so the exploded view stays on screen
      const fit = focusPart ? 1 : 1 / (1 + st.explode * s.intensity * 0.32);
      r.scale.setScalar(viewState.scale * st.focusScale * fit);
      r.position.copy(home).add(viewState.pos).add(st.focusOffset);
      if (s.model) applyExplosion(s.model, st.explode, s.intensity, scratch);
      r.updateMatrixWorld(true);
      if (focusPart) {
        focusPart.node.localToWorld(tmp.copy(focusPart.anchorLocal));
        st.focusOffset.addScaledVector(tmp.sub(home).multiplyScalar(-1), 1 - Math.exp(-dt * 4));
      } else st.focusOffset.multiplyScalar(Math.exp(-dt * 4));
      globalUniforms.uScanY.value = r.position.y + Math.sin(globalUniforms.uTime.value * 0.9) * 1.1 * r.scale.x;
    }

    visuals.current?.update(dt, s.settings.renderMode, { selectedId: s.selectedId, hoveredId: s.hoveredId, isolatedId: s.isolatedId });

    // labels
    if (s.model && r) {
      st.labelsVis += ((st.explode > 0.12 ? 1 : 0) - st.labelsVis) * (1 - Math.exp(-dt * 5));
      updateLabels({
        model: s.model,
        camera: three.camera,
        width: size.width,
        height: size.height,
        leftInset: inset,
        rightInset: s.panels.explorer || s.panels.settings ? 300 : 0,
        autoVisibility: st.labelsVis,
        mode: s.settings.labels,
        selectedId: s.selectedId,
        hoveredId: s.hoveredId,
        rootCenter: r.position,
        rootRadiusWorld: r.scale.x * (1 + st.explode * s.intensity * 0.6),
        rootScale: r.scale.x,
      });
    }

    // fps
    st.frames++;
    const now = performance.now();
    if (now - st.fpsT > 1000) {
      useHolo.setState({ renderFps: Math.round((st.frames * 1000) / (now - st.fpsT)) });
      st.frames = 0;
      st.fpsT = now;
    }
  });

  return (
    <>
      <group ref={root} />
      <HoloEffects rootRef={root} />
    </>
  );
}

export function HoloCanvas() {
  return (
    <Canvas
      className="!fixed inset-0 z-10"
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.75]}
      camera={{ fov: 40, position: [0, 0, 6], near: 0.1, far: 100 }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} color="#7fdcff" />
      <SceneController />
    </Canvas>
  );
}
