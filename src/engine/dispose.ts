import * as THREE from 'three';

/** Libera geometrías, materiales y texturas de un árbol de objetos. */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      for (const key of Object.keys(m)) {
        const v = (m as unknown as Record<string, unknown>)[key];
        if (v instanceof THREE.Texture) v.dispose();
      }
      m.dispose();
    }
  });
}
