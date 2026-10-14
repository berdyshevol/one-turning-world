import type * as THREE from 'three'

/**
 * Compositing layers, rendered in this order with the depth buffer cleared
 * between them: rear choreography, the Earth, then foreground choreography.
 */
export const LAYER = { REAR: 1, GLOBE: 2, FRONT: 3 } as const
export type LayerId = (typeof LAYER)[keyof typeof LAYER]

export function setLayer(object: THREE.Object3D, layer: LayerId) {
  object.traverse((o) => o.layers.set(layer))
}

/**
 * Depth hysteresis: an object only changes layer once it has travelled
 * `band` beyond the globe's centre plane, so it never flickers at z = 0.
 */
export function nextLayer(current: LayerId, z: number, band: number): LayerId {
  if (current === LAYER.FRONT && z < -band) return LAYER.REAR
  if (current === LAYER.REAR && z > band) return LAYER.FRONT
  return current
}
