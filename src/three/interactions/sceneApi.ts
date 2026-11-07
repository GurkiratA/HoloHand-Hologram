/**
 * Bridge that lets non-React code (gesture engine, screenshot, UI buttons)
 * query the live 3D scene. Populated by the SceneController while mounted.
 */
export interface SceneApi {
  /** Component id under a viewport pixel, if any. */
  pick(px: number, py: number): string | null;
  /** Move a component by a screen-space delta (drag / "pull it out"). */
  dragPart(id: string, fromPx: [number, number], toPx: [number, number]): void;
  /** Viewport pixel -> world point on the hologram plane (z = 0). */
  screenToWorld(px: number, py: number): [number, number, number];
  /** Current world position of the hologram's home point. */
  home(): [number, number, number];
  canvas(): HTMLCanvasElement | null;
}

let api: SceneApi | null = null;
export const setSceneApi = (a: SceneApi | null) => {
  api = a;
};
export const sceneApi = () => api;
