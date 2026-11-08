import * as THREE from 'three';

/**
 * Mutable hologram transform targets. Written by gestures / mouse, read and
 * smoothed every frame by the scene controller. Kept out of React state so
 * 60 Hz updates never re-render the UI.
 */
export const viewState = {
  yaw: -0.6,
  pitch: 0.18,
  yawVel: 0,
  pitchVel: 0,
  scale: 1.1,
  scaleTarget: 1.1,
  /** Offset of the hologram from its home position (world units). */
  pos: new THREE.Vector3(),
  posTarget: new THREE.Vector3(),
  /** Seconds since the user last manipulated rotation (pauses auto-spin). */
  idle: 10,
  reset() {
    this.yaw = -0.6;
    this.pitch = 0.18;
    this.yawVel = 0;
    this.pitchVel = 0;
    this.scaleTarget = 1.1;
    this.posTarget.set(0, 0, 0);
  },
  /** Stop all motion right now, e.g. while the user is aiming at a part. */
  hold() {
    this.yawVel = 0;
    this.pitchVel = 0;
    this.idle = 0;
  },
  rotate(dYaw: number, dPitch = 0) {
    this.yaw += dYaw;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dPitch, -1.2, 1.2);
    this.idle = 0;
  },
  impulse(vYaw: number, vPitch = 0) {
    this.yawVel += vYaw;
    this.pitchVel += vPitch;
    this.idle = 0;
  },
  zoomBy(f: number) {
    this.scaleTarget = THREE.MathUtils.clamp(this.scaleTarget * f, 0.35, 4);
  },
};
