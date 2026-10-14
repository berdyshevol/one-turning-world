import * as THREE from 'three'
import { smoothstep } from '../../lib/math'
import { LAYER, setLayer } from '../layers'
import { OrbitTracker, type OrbitConfig, type OrbitMode } from '../orbit'
import { LayeredParticles } from '../particles'
import { sharedLight } from '../shared'

export interface FrameContext {
  /** Local progress within this city, 0 … 1. */
  local: number
  /** 0 at the city's edges, 1 through its body. Scales ambient material. */
  envelope: number
  elapsed: number
  dt: number
  /** How orbits track their targets this frame. */
  mode: OrbitMode
  /** Responsive multiplier for object sizes (smaller on narrow screens). */
  sizeScale: number
  reducedMotion: boolean
  /** Visible world half-width at the globe plane, for edge-hugging motion. */
  halfWidth: number
  /** Current key light colour and direction (world space). */
  light: THREE.Color
  sunDir: THREE.Vector3
}

/** Five focal moments per city; every window starts and ends hidden. */
export const SLOTS: [number, number][] = [
  [0.03, 0.39],
  [0.17, 0.53],
  [0.32, 0.68],
  [0.47, 0.83],
  [0.61, 0.97],
]

interface Motif {
  object: THREE.Object3D
  tracker: OrbitTracker
  spin: THREE.Vector3
  base: THREE.Euler
  materials: THREE.Material[]
  billboard: boolean
  update?: (ctx: FrameContext, theta: number) => void
}

export interface MotifOptions {
  /** Flat cutouts keep facing the viewer instead of spinning. */
  billboard?: boolean
  spin?: [number, number, number]
  rotation?: [number, number, number]
  update?: (ctx: FrameContext, theta: number) => void
}

/** A city's choreography root: orbiting motifs plus ambient particles. */
export class CityRoot {
  readonly group = new THREE.Group()
  readonly motifs: Motif[] = []
  readonly particles: LayeredParticles[] = []
  private readonly ambient: ((ctx: FrameContext) => void)[] = []

  constructor(readonly id: string) {
    this.group.name = id
    this.group.visible = false
  }

  addMotif(object: THREE.Object3D, config: OrbitConfig, options: MotifOptions = {}) {
    const materials: THREE.Material[] = []
    object.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.material) {
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        list.forEach((m) => {
          m.transparent = true
          materials.push(m)
        })
      }
    })
    setLayer(object, LAYER.REAR)
    object.userData.layer = LAYER.REAR
    this.group.add(object)
    const motif: Motif = {
      object,
      tracker: new OrbitTracker(config),
      spin: new THREE.Vector3(...(options.spin ?? [0, 0.15, 0])),
      base: new THREE.Euler(...(options.rotation ?? [0, 0, 0])),
      materials,
      billboard: options.billboard ?? false,
      update: options.update,
    }
    this.motifs.push(motif)
    return motif
  }

  addParticles(p: LayeredParticles) {
    p.addTo(this.group)
    this.particles.push(p)
    return p
  }

  /** True once every orbiting object is hidden behind the Earth. */
  allHidden() {
    return this.motifs.every((m) => !m.object.visible)
  }

  /** Park every orbit behind the Earth at the given pole (±π). */
  park(theta: number) {
    for (const m of this.motifs) m.tracker.park(theta)
  }

  /** Extra per-frame behaviour (shaders, lights) owned by the city. */
  onFrame(fn: (ctx: FrameContext) => void) {
    this.ambient.push(fn)
  }

  update(ctx: FrameContext) {
    const t = ctx.reducedMotion ? 0 : ctx.elapsed
    for (const m of this.motifs) {
      const s = m.tracker.evaluate(ctx.local, ctx.sizeScale, ctx.dt, ctx.mode)
      m.tracker.apply(m.object)
      m.object.scale.setScalar(s.scale)
      // Spin follows orbital progress so reversing scroll reverses rotation;
      // a slow ambient drift keeps still frames alive.
      const travel = Math.PI - s.theta
      if (!m.billboard) m.object.rotation.set(
        m.base.x + m.spin.x * travel + Math.sin(t * 0.31) * 0.03,
        m.base.y + m.spin.y * travel + Math.sin(t * 0.23) * 0.05,
        m.base.z + m.spin.z * travel,
      )
      for (const mat of m.materials) {
        mat.opacity = s.opacity * (mat.userData.baseOpacity ?? 1)
        const u = (mat as THREE.ShaderMaterial).uniforms
        if (u?.uOpacity) u.uOpacity.value = mat.opacity
      }
      m.update?.(ctx, s.theta)
    }
    for (const fn of this.ambient) fn(ctx)
    for (const p of this.particles) p.update(t, ctx.envelope)
  }
}

/** Ambient presence of a city: zero at both of its boundaries. */
export const cityEnvelope = (local: number) =>
  smoothstep(0.0, 0.08, local) * (1 - smoothstep(0.92, 1.0, local))

// ---------------------------------------------------------------------------
// Shared geometry
// ---------------------------------------------------------------------------

/** Cupped five-lobed sakura petal, about 1 unit long. */
export function petalGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(0.42, 0.2, 0.5, 0.75, 0.16, 1.0)
  shape.lineTo(0, 0.88)
  shape.lineTo(-0.16, 1.0)
  shape.bezierCurveTo(-0.5, 0.75, -0.42, 0.2, 0, 0)
  const geo = new THREE.ShapeGeometry(shape, 10)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    pos.setZ(i, x * x * 0.55 - y * 0.12)
  }
  geo.computeVertexNormals()
  geo.translate(0, -0.5, 0)
  return geo
}

/** Pointed, slightly folded leaf with a central vein crease. */
export function leafGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0, -0.5)
  shape.bezierCurveTo(0.38, -0.3, 0.42, 0.25, 0, 0.6)
  shape.bezierCurveTo(-0.42, 0.25, -0.38, -0.3, 0, -0.5)
  const geo = new THREE.ShapeGeometry(shape, 10)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    pos.setZ(i, Math.abs(x) * 0.35 + Math.sin(y * 2.2) * 0.05)
  }
  geo.computeVertexNormals()
  return geo
}

/** Flat ribbon strip along a curve; width tapers at both ends. */
export function ribbonGeometry(curve: THREE.Curve<THREE.Vector3>, width: number, segments = 160, twist = 0) {
  const positions: number[] = []
  const indices: number[] = []
  const frames = curve.computeFrenetFrames(segments, false)
  const p = new THREE.Vector3()
  const side = new THREE.Vector3()
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    curve.getPointAt(t, p)
    const w = width * Math.sin(Math.PI * t) ** 0.6
    const a = twist * t
    side
      .copy(frames.normals[i])
      .multiplyScalar(Math.cos(a))
      .addScaledVector(frames.binormals[i], Math.sin(a))
    positions.push(p.x + side.x * w, p.y + side.y * w, p.z + side.z * w)
    positions.push(p.x - side.x * w, p.y - side.y * w, p.z - side.z * w)
    if (i < segments) {
      const k = i * 2
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** Shell orbit: particles circle the Earth on tilted rings at varying radii. */
export function shellStep(
  rand: () => number,
  count: number,
  opts: { rMin: number; rMax: number; speed: number; size: [number, number]; tumble?: number; flatten?: number },
) {
  const data = Array.from({ length: count }, () => ({
    r: opts.rMin + (opts.rMax - opts.rMin) * Math.pow(rand(), 0.8),
    phase: rand() * Math.PI * 2,
    tilt: (rand() - 0.5) * 2.2,
    yaw: rand() * Math.PI * 2,
    speed: opts.speed * (0.6 + rand() * 0.8) * (rand() < 0.15 ? -1 : 1),
    size: opts.size[0] + (opts.size[1] - opts.size[0]) * rand(),
    spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(opts.tumble ?? 2),
    bob: rand() * Math.PI * 2,
  }))
  const flatten = opts.flatten ?? 0.85
  return (i: number, t: number, out: { position: THREE.Vector3; rotation: THREE.Euler; scale: number }) => {
    const d = data[i]
    const a = d.phase + t * d.speed
    const x = Math.cos(a) * d.r
    const z = Math.sin(a) * d.r
    const y = Math.sin(a * 2 + d.bob) * 0.08 * d.r
    // Tilt the ring around X, then yaw it around Y.
    const cy = Math.cos(d.tilt)
    const sy = Math.sin(d.tilt)
    const y1 = y * cy - z * sy * flatten
    const z1 = y * sy + z * cy
    const cyaw = Math.cos(d.yaw * 0.2)
    const syaw = Math.sin(d.yaw * 0.2)
    out.position.set(x * cyaw + z1 * syaw, y1, -x * syaw + z1 * cyaw)
    out.rotation.set(d.spin.x * t + d.bob, d.spin.y * t, d.spin.z * t)
    out.scale = d.size
  }
}

/** Falling field: particles drift down through a volume around the Earth. */
export function fallStep(
  rand: () => number,
  count: number,
  opts: {
    width: number
    height: number
    depth: number
    speed: number
    size: [number, number]
    sway?: number
    wind?: number
    tumble?: number
  },
) {
  const data = Array.from({ length: count }, () => ({
    x: (rand() - 0.5) * 2 * opts.width,
    y: rand(),
    z: (rand() - 0.5) * 2 * opts.depth,
    speed: opts.speed * (0.55 + rand() * 0.9),
    size: opts.size[0] + (opts.size[1] - opts.size[0]) * Math.pow(rand(), 1.6),
    phase: rand() * Math.PI * 2,
    spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(opts.tumble ?? 3),
  }))
  const sway = opts.sway ?? 0.12
  const wind = opts.wind ?? 0
  const h = opts.height
  return (i: number, t: number, out: { position: THREE.Vector3; rotation: THREE.Euler; scale: number }) => {
    const d = data[i]
    const yy = (((d.y - t * d.speed / (2 * h)) % 1) + 1) % 1
    const y = h - yy * 2 * h
    let x = d.x + Math.sin(t * 0.7 + d.phase) * sway + wind * (h - y)
    const w = opts.width
    x = ((((x + w) % (2 * w)) + 2 * w) % (2 * w)) - w
    out.position.set(x, y, d.z + Math.cos(t * 0.5 + d.phase) * sway * 0.6)
    out.rotation.set(d.spin.x * t + d.phase, d.spin.y * t, d.spin.z * t)
    // Fade in at the top and out at the bottom by size, never by popping.
    out.scale = d.size * Math.min(1, yy * 8, (1 - yy) * 8)
  }
}

export function physical(params: THREE.MeshPhysicalMaterialParameters) {
  return new THREE.MeshPhysicalMaterial({ envMapIntensity: 1, ...params })
}

const glassVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewW;
  varying vec3 vPosW;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const glassFragment = /* glsl */ `
  uniform vec3 uTint;
  uniform vec3 uLight;
  uniform vec3 uSunDir;
  uniform float uOpacity;
  uniform float uFlat;
  uniform float uIridescence;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  varying vec3 vPosW;
  void main() {
    vec3 n = normalize(vNormalW);
    if (uFlat > 0.5) n = normalize(cross(dFdx(vPosW), dFdy(vPosW)));
    vec3 v = normalize(vViewW);
    if (dot(n, v) < 0.0) n = -n;
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 2.4);
    vec3 h = normalize(uSunDir + v);
    float spec = pow(max(dot(n, h), 0.0), 120.0);
    // Thin-film shimmer shifts hue across the rim.
    vec3 film = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + fres * 1.4 + ndv * 0.6));
    vec3 rim = mix(uTint, uTint * film * 1.4, uIridescence) * mix(vec3(1.0), uLight, 0.4);
    // Faceted solids present many grazing faces at once; keep them quieter.
    float gain = mix(1.0, 0.3, uFlat);
    vec3 col = (rim * (0.03 + fres * 0.95) + uLight * spec * 1.2) * gain;
    col *= uOpacity;
    gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));
    #include <colorspace_fragment>
  }
`

/**
 * Glass and ice as pure light: a fresnel rim with a sun glint, composited
 * additively. Reads as clear glass over any background, including the Earth.
 */
export function glass(tint: THREE.ColorRepresentation, opts: { flat?: boolean; iridescence?: number } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: glassVertex,
    fragmentShader: glassFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneFactor,
    premultipliedAlpha: true,
    uniforms: {
      uTint: { value: new THREE.Color(tint) },
      uLight: { value: sharedLight.color },
      uSunDir: { value: sharedLight.dir },
      uOpacity: { value: 1 },
      uFlat: { value: opts.flat ? 1 : 0 },
      uIridescence: { value: opts.iridescence ?? 0 },
    },
  })
}
