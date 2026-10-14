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
export const orbitView = { distance: 10, floorY: -Infinity }

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
  const k = 0.62
  const eased = s + (k / (2 * Math.PI)) * Math.sin(2 * Math.PI * s)
  return Math.PI - 2 * Math.PI * eased
}

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
   * Orbital angle as a critically damped spring with a speed limit, so a
   * fast jump never whips an object round its orbit; it travels on the same
   * path at a believable pace and can reverse without a jolt.
   */
  readonly angle: SpringState = { value: Math.PI, velocity: 0 }

  constructor(readonly config: OrbitConfig) {}

  /** Place the object at a hidden pole (behind the Earth) with no velocity. */
  park(theta: number) {
    this.angle.value = theta
    this.angle.velocity = 0
  }

  evaluate(local: number, sizeScale: number, dt: number, snap = false) {
    const c = this.config
    const radiusX = orbitRadiusX(c, sizeScale)
    const target = orbitTheta(local, c.window)
    if (snap) this.park(target)
    else smoothDamp(this.angle, target, 0.16, dt, 2.8)
    const theta = this.angle.value
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
      const floorAtZ = (orbitView.floorY * (d - z)) / d
      const hh = (c.size[1] * scale) / 2
      y = smax(y, floorAtZ + hh, 0.12)
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
