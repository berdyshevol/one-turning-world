import * as THREE from 'three'
import { clamp, lerp, smoothDamp, smoothstep, type SpringState } from '../lib/math'
import { LAYER, nextLayer, setLayer, type LayerId } from './layers'

/** Earth silhouette radius used for clearance, slightly beyond the surface. */
export const LIMB_RADIUS = 1.05
/** Depth band (fraction of orbit depth) around z = 0 used for layer hysteresis. */
export const LAYER_BAND = 0.16

/**
 * Viewport facts the orbits respect: the camera distance (for perspective)
 * and the lowest world y at the globe plane that stays clear of the
 * navigation. Updated on resize.
 */
export const orbitView = {
  distance: 10,
  floorY: -Infinity,
  /** City copy keep-out (lower left): its top edge and right edge, world units. */
  copyTopY: -Infinity,
  copyRightX: -Infinity,
}

/** Smooth maximum: continuous and differentiable, so motion never kinks. */
const smax = (a: number, b: number, k: number) => (a + b + Math.sqrt((a - b) * (a - b) + k * k)) / 2

/**
 * One object travelling a globe-centred orbit during a window of its city:
 * behind the Earth → around one limb → across the foreground → around the
 * opposite limb → behind the Earth again.
 */
export interface OrbitConfig {
  /** Window of the city's local progress during which the orbit runs. */
  window: [number, number]
  /** +1 enters around the right limb, -1 around the left limb. */
  side: 1 | -1
  /** Displayed size in world units at scale 1 (globe radius = 1). */
  size: [number, number]
  scaleBack: number
  scaleFront: number
  /** Vertical position while hidden behind the Earth and at the focal point. */
  yBack: number
  yFront: number
  /** Horizontal offset of the focal point. */
  focusX: number
  /** Orbit depth: z at the focal point (and -z while hidden). */
  depth: number
  /** Extra limb clearance in world units. */
  margin?: number
}

export interface OrbitSample {
  position: THREE.Vector3
  scale: number
  /** 0 hidden behind the Earth … 1 visible. */
  opacity: number
  layer: LayerId
  theta: number
  /** Radius of the horizontal swing, derived from limb clearance. */
  radiusX: number
}

/**
 * Minimum horizontal distance from the globe centre at which a rectangle of
 * half-size (hw, hh) centred at height y no longer overlaps the Earth disc.
 */
export function clearanceX(hw: number, hh: number, y: number, radius = LIMB_RADIUS) {
  const dy = Math.max(0, Math.abs(y) - hh)
  return hw + Math.sqrt(Math.max(0, radius * radius - dy * dy))
}

/** Radius of the swing so the object clears the limb at both layer switches. */
export function orbitRadiusX(c: OrbitConfig, sizeScale = 1) {
  // At the layer switch |cos θ| = LAYER_BAND, so the object is slightly
  // forward of or behind the limb; evaluate the swing there.
  const front = (1 + LAYER_BAND) / 2
  const scale = lerp(c.scaleBack, c.scaleFront, front) * sizeScale
  const hw = (c.size[0] * scale) / 2
  const hh = (c.size[1] * scale) / 2
  const y = lerp(c.yBack, c.yFront, front)
  const sinAtSwitch = Math.sqrt(1 - LAYER_BAND * LAYER_BAND)
  // Perspective enlarges the nearer object relative to the Earth silhouette.
  const perspective = 1.07
  return ((clearanceX(hw, hh, y) + (c.margin ?? 0.04)) * perspective) / sinAtSwitch
}

/**
 * Eased orbital angle: fast while hidden, slow around the focal point so the
 * object holds the foreground before it moves on.
 */
export function orbitTheta(local: number, window: [number, number]) {
  const s = clamp((local - window[0]) / (window[1] - window[0]))
  const k = 0.84
  const eased = s + (k / (2 * Math.PI)) * Math.sin(2 * Math.PI * s)
  return Math.PI - 2 * Math.PI * eased
}

/**
 * follow: track scroll; limited: paced spring during jumps; retreat: leave
 * by the nearer hidden pole behind the Earth; snap: exact.
 */
export type OrbitMode = 'follow' | 'limited' | 'retreat' | 'snap'

export class OrbitTracker {
  layer: LayerId = LAYER.REAR
  readonly sample: OrbitSample = {
    position: new THREE.Vector3(),
    scale: 0,
    opacity: 0,
    layer: LAYER.REAR,
    theta: Math.PI,
    radiusX: 0,
  }

  /**
   * Orbital angle. While scrolling normally it follows the scroll exactly;
   * during a jump it becomes a speed-limited critically damped spring, so an
   * object never whips round its orbit and always rejoins without a jolt.
   */
  readonly angle: SpringState = { value: Math.PI, velocity: 0 }

  constructor(readonly config: OrbitConfig) {}

  /** Whether the angle is locked to the scroll-driven target. */
  private locked = true

  /** Place the object at a hidden pole (behind the Earth) with no velocity. */
  park(theta: number) {
    this.angle.value = theta
    this.angle.velocity = 0
    this.locked = false
  }

  evaluate(local: number, sizeScale: number, dt: number, mode: OrbitMode = 'follow') {
    const c = this.config
    const radiusX = orbitRadiusX(c, sizeScale)
    const target = orbitTheta(local, c.window)
    const a = this.angle
    if (mode === 'snap') {
      a.value = target
      a.velocity = 0
      this.locked = true
    } else if (mode === 'limited') {
      this.locked = false
      smoothDamp(a, target, 0.16, dt, 4.5)
    } else if (mode === 'retreat') {
      // Both ends of the orbit are behind the Earth: go back the way it came
      // or carry on, whichever is shorter, never round the front.
      this.locked = false
      smoothDamp(a, a.value > 0 ? Math.PI : -Math.PI, 0.16, dt, 4.5)
    } else {
      // Rejoin the scroll path continuously, then stay locked to it.
      if (!this.locked && Math.abs(target - a.value) < 0.003) this.locked = true
      if (this.locked) {
        // Keep a velocity estimate so a later spring phase starts from the
        // object's real motion.
        a.velocity = dt > 0 ? (target - a.value) / dt : 0
        a.value = target
      } else {
        smoothDamp(a, target, 0.14, dt, 3)
      }
    }
    const theta = a.value
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    const front = (1 + cos) / 2
    const focus = smoothstep(0, 1, cos)

    const scale = lerp(c.scaleBack, c.scaleFront, Math.pow(front, 1.15)) * sizeScale
    const x = c.side * radiusX * sin + c.focusX * focus
    const z = c.depth * cos
    let y = lerp(c.yBack, c.yFront, front)
    // Keep the lower edge above the navigation, accounting for perspective:
    // nearer objects project lower, so the floor rises toward the camera.
    if (orbitView.floorY > -Infinity) {
      const d = orbitView.distance
      const toZ = (d - z) / d
      let floor = orbitView.floorY * toZ
      // Over the city copy, the floor rises to the copy's top edge so
      // objects pass above the text rather than across it.
      if (orbitView.copyTopY > orbitView.floorY) {
        const hw = (c.size[0] * scale) / 2
        const leftEdge = (x - hw) / toZ
        const over = 1 - smoothstep(orbitView.copyRightX - 0.15, orbitView.copyRightX + 0.25, leftEdge)
        floor = lerp(floor, orbitView.copyTopY * toZ, over)
      }
      const hh = (c.size[1] * scale) / 2
      y = smax(y, floor + hh, 0.12)
    }

    this.layer = nextLayer(this.layer, z, c.depth * LAYER_BAND)

    // Fade only once every corner is tucked inside the Earth disc.
    let opacity = 1
    if (z < 0) {
      const hw = (c.size[0] * scale) / 2
      const hh = (c.size[1] * scale) / 2
      const corner = Math.hypot(Math.abs(x) + hw, Math.abs(y) + hh)
      opacity = 1 - smoothstep(0.0, 0.08, 0.98 - corner)
    }

    const s = this.sample
    s.position.set(x, y, z)
    s.scale = scale
    s.opacity = opacity
    s.layer = this.layer
    s.theta = theta
    s.radiusX = radiusX
    return s
  }

  /** Applies the sample to an object, switching its compositing layer. */
  apply(object: THREE.Object3D) {
    const s = this.sample
    object.position.copy(s.position)
    object.visible = s.opacity > 0.002
    if (object.userData.layer !== s.layer) {
      setLayer(object, s.layer)
      object.userData.layer = s.layer
    }
  }
}
