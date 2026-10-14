import * as THREE from 'three'
import { LAYER } from './layers'

const RINGS: { radius: number; tilt: [number, number]; speed: number; dash: number }[] = [
  { radius: 1.32, tilt: [1.2, 0.25], speed: 0.018, dash: 0 },
  { radius: 1.62, tilt: [1.38, -0.4], speed: -0.012, dash: 0.035 },
  { radius: 2.05, tilt: [1.1, 0.6], speed: 0.008, dash: 0 },
]

/**
 * Orbital guide lines. They live only in the rear layer, so the Earth always
 * paints over their near half and they read as wrapping behind it. Rotation is
 * a continuous function of time and journey position: no steps or snaps.
 */
export class OrbitGuides {
  readonly group = new THREE.Group()
  private readonly rings: { line: THREE.Line; spec: (typeof RINGS)[number] }[] = []
  private readonly materials: THREE.LineBasicMaterial[] = []

  constructor() {
    for (const spec of RINGS) {
      const pts = new THREE.EllipseCurve(0, 0, spec.radius, spec.radius, 0, Math.PI * 2).getPoints(256)
      const geo = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, p.y, 0)))
      const mat = spec.dash
        ? new THREE.LineDashedMaterial({ transparent: true, depthWrite: false, dashSize: spec.dash, gapSize: spec.dash * 1.6 })
        : new THREE.LineBasicMaterial({ transparent: true, depthWrite: false })
      const line = new THREE.LineLoop(geo, mat)
      if (spec.dash) line.computeLineDistances()
      line.rotation.set(spec.tilt[0], 0, spec.tilt[1])
      line.layers.set(LAYER.REAR)
      this.group.add(line)
      this.rings.push({ line, spec })
      this.materials.push(mat)
    }
  }

  update(elapsed: number, cityFloat: number, color: THREE.Color) {
    this.rings.forEach(({ line, spec }, i) => {
      // Spin within the ring's own plane: smooth in time and with scroll.
      line.rotation.z = spec.tilt[1] + elapsed * spec.speed + cityFloat * 0.12 * (i % 2 ? -1 : 1)
      // Gentle precession of the ring plane.
      line.rotation.x = spec.tilt[0] + Math.sin(cityFloat * 0.6 + i) * 0.05
      line.rotation.y = Math.sin(elapsed * 0.04 + i * 2.1) * 0.12 + cityFloat * 0.07 * (i % 2 ? 1 : -1)
      const m = this.materials[i]
      m.color.copy(color)
      m.opacity = 0.22 - i * 0.04
    })
  }
}
