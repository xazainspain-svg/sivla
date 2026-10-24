import * as THREE from 'three';

/** Entorno de estudio con paneles de color (ámbar, cobalto y blanco) que se reflejan en el cromo. Generado por código. */
export function studioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x151a38), side: THREE.BackSide })));
  const panels: Array<[number, number, [number, number, number], [number, number, number]]> = [
    [0xffffff, 7, [0, 14, 6], [18, 2, 16]],
    [0x2f5bee, 3.4, [-16, 2, 4], [2, 14, 14]],
    [0xe08a45, 4, [16, -2, 6], [2, 14, 14]],
    [0x2f5bee, 3, [0, -14, 2], [20, 2, 10]],
    [0xffffff, 3, [-4, 0, 18], [8, 8, 2]],
  ];
  for (const [color, power, pos, size] of panels) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power) }));
    m.position.set(...pos);
    env.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.03).texture;
  pmrem.dispose();
  env.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    (mesh.material as THREE.Material | undefined)?.dispose();
  });
  return tex;
}
