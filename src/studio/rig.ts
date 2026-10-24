import * as THREE from 'three';
import { clamp, damp } from '../engine/math';

const wrap = (a: number): number => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export interface View { yaw: number; pitch: number; fov: number }

/** Cámara en el centro del estudio: gira (yaw/pitch) con inercia y amortiguación, y hace zoom por campo de visión (sin atravesar objetos). */
export class CameraRig {
  yaw = 0; pitch = 0; fov: number;
  private ty = 0; private tp = 0; private tf: number;
  private vy = 0;
  private dragging = false;
  private px = 0; private py = 0; // paralaje del cursor
  private readonly fovMin = 34; private readonly fovMax: number;
  constructor(private readonly camera: THREE.PerspectiveCamera, readonly home: View, fovMax = 80) {
    this.fov = this.tf = home.fov; this.fovMax = fovMax;
    this.yaw = this.ty = home.yaw; this.pitch = this.tp = home.pitch;
    camera.rotation.order = 'YXZ';
  }
  begin(): void { this.dragging = true; this.vy = 0; }
  drag(dx: number, dy: number, dt: number, allowPitch: boolean): void {
    const k = 0.0042 * (this.fov / 62);
    this.ty -= dx * k;
    this.vy = dt > 0 ? clamp((-dx * k) / dt, -4, 4) : 0;
    if (allowPitch) this.tp = clamp(this.tp - dy * k, -0.6, 0.55);
  }
  end(): void { this.dragging = false; }
  zoom(delta: number): void { this.tf = clamp(this.tf + delta, this.fovMin, this.fovMax); }
  focus(v: View): void {
    this.ty = this.yaw + wrap(v.yaw - this.yaw);
    this.tp = clamp(v.pitch, -0.6, 0.55);
    this.tf = clamp(v.fov, this.fovMin, this.fovMax);
    this.vy = 0;
  }
  reset(): void { this.focus(this.home); }
  setParallax(x: number, y: number): void { this.px = x; this.py = y; }
  update(dt: number, sway: number, still: boolean): void {
    if (!this.dragging && !still) { this.ty += this.vy * dt; this.vy = damp(this.vy, 0, 3.2, dt); }
    this.yaw = damp(this.yaw, this.ty, 7, dt);
    this.pitch = damp(this.pitch, this.tp, 7, dt);
    this.fov = damp(this.fov, this.tf, 6, dt);
    const s = still ? 0 : 1;
    this.camera.rotation.set(this.pitch + this.py * 0.025 * s + sway * 0.004 * s, this.yaw - this.px * 0.04 * s, 0);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }
  }
}
