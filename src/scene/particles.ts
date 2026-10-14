import * as THREE from 'three'
import { LAYER, nextLayer, type LayerId } from './layers'

export interface ParticleState {
  position: THREE.Vector3
  rotation: THREE.Euler
  scale: number
}

export type ParticleStep = (i: number, elapsed: number, out: ParticleState) => void

const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
const m = new THREE.Matrix4()
const q = new THREE.Quaternion()
const s = new THREE.Vector3()

/**
 * A particle system split across the rear and foreground layers. Each
 * particle lives in exactly one of the two instanced meshes, decided by its
 * depth with hysteresis, so particles really pass behind and in front of the
 * Earth. Particles that would sit inside the Earth are culled.
 */
export class LayeredParticles {
  readonly rear: THREE.InstancedMesh
  readonly front: THREE.InstancedMesh
  private readonly layers: LayerId[]
  private readonly state: ParticleState = {
    position: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    scale: 1,
  }

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    readonly count: number,
    private readonly step: ParticleStep,
    colors?: THREE.Color[],
  ) {
    this.rear = new THREE.InstancedMesh(geometry, material, count)
    this.front = new THREE.InstancedMesh(geometry, material, count)
    this.rear.layers.set(LAYER.REAR)
    this.front.layers.set(LAYER.FRONT)
    for (const mesh of [this.rear, this.front]) {
      mesh.frustumCulled = false
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      if (colors) colors.forEach((c, i) => mesh.setColorAt(i, c))
    }
    this.layers = new Array(count).fill(LAYER.REAR)
  }

  addTo(parent: THREE.Object3D) {
    parent.add(this.rear, this.front)
  }

  update(elapsed: number, envelope: number) {
    const st = this.state
    for (let i = 0; i < this.count; i++) {
      st.scale = 1
      this.step(i, elapsed, st)
      const p = st.position
      // Never render inside the Earth; shrink smoothly as the surface nears.
      const r = p.length()
      const scale = st.scale * envelope * THREE.MathUtils.smoothstep(r, 1.05, 1.16)
      if (scale <= 0.0005) {
        this.rear.setMatrixAt(i, hidden)
        this.front.setMatrixAt(i, hidden)
        continue
      }
      const layer = (this.layers[i] = nextLayer(this.layers[i], p.z, 0.08))
      q.setFromEuler(st.rotation)
      s.setScalar(scale)
      m.compose(p, q, s)
      if (layer === LAYER.FRONT) {
        this.front.setMatrixAt(i, m)
        this.rear.setMatrixAt(i, hidden)
      } else {
        this.rear.setMatrixAt(i, m)
        this.front.setMatrixAt(i, hidden)
      }
    }
    this.rear.instanceMatrix.needsUpdate = true
    this.front.instanceMatrix.needsUpdate = true
  }
}

/** Deterministic pseudo-random sequence so every load composes identically. */
export function seeded(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
