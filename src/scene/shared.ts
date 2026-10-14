import * as THREE from 'three'

/** Scene-wide light state shared by custom shaders, updated once per frame. */
export const sharedLight = {
  color: new THREE.Color(1, 1, 1),
  dir: new THREE.Vector3(0, 0, 1),
}
