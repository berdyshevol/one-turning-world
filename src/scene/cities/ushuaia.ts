import * as THREE from 'three'
import { ADDITIVE_PREMULTIPLIED } from '../Globe'
import { LAYER } from '../layers'
import { seeded, LayeredParticles } from '../particles'
import { CityRoot, glass, physical, fallStep, ribbonGeometry, shellStep } from './common'

const auroraVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const auroraFragment = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uLow;
  uniform vec3 uHigh;
  varying vec2 vUv;

  float hash(float n) { return fract(sin(n) * 43758.5453); }
  float noise(float x) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
  }

  void main() {
    float x = vUv.x;
    float y = vUv.y;
    // Vertical rays drifting sideways along the curtain.
    float rays = noise(x * 70.0 + uTime * 0.5) * 0.55 + noise(x * 19.0 - uTime * 0.22) * 0.45;
    float fold = 0.5 + 0.5 * sin(x * 8.0 + uTime * 0.3 + noise(x * 3.0 + uTime * 0.05) * 4.0);
    // Ragged upper boundary so the curtain dissolves rather than ending flat.
    float top = 0.32 + 0.38 * noise(x * 6.0 + uTime * 0.1) + 0.22 * noise(x * 23.0 - uTime * 0.3);
    float body = smoothstep(0.0, 0.18, y) * (1.0 - smoothstep(top * 0.4, top, y));
    float edges = smoothstep(0.0, 0.32, x) * (1.0 - smoothstep(0.68, 1.0, x));
    float a = body * edges * (0.3 + 0.7 * rays) * (0.5 + 0.5 * fold) * uIntensity * 0.75;
    vec3 col = mix(uLow, uHigh, smoothstep(0.1, 0.9, y / max(top, 0.2)));
    vec3 c = col * a;
    gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
    #include <colorspace_fragment>
  }
`

function auroraCurtain(radius: number, arc: number, start: number, height: number, uniforms: Record<string, THREE.IUniform>) {
  const seg = 120
  const geo = new THREE.PlaneGeometry(1, 1, seg, 1)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5
    const v = pos.getY(i) + 0.5
    const a = start + arc * u
    const wave = Math.sin(u * Math.PI * 3) * 0.12
    const r = radius + wave
    pos.setXYZ(i, Math.cos(a) * r, v * height, Math.sin(a) * r)
  }
  geo.computeVertexNormals()
  const mat = new THREE.ShaderMaterial({
    vertexShader: auroraVertex,
    fragmentShader: auroraFragment,
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    ...ADDITIVE_PREMULTIPLIED,
  })
  return new THREE.Mesh(geo, mat)
}

function glacialShards() {
  // A calved cluster of long ice shards leaning out from a common base.
  const g = new THREE.Group()
  const rand = seeded(83)
  const ice = glass('#6fb2ea', { flat: true, iridescence: 0.12 })
  for (let i = 0; i < 9; i++) {
    const h = 0.22 + rand() * 0.42
    const geo = new THREE.OctahedronGeometry(0.06 + rand() * 0.035, 0)
    geo.scale(1, h / 0.12, 0.7)
    const m = new THREE.Mesh(geo, ice)
    const a = (i / 9) * Math.PI * 2 + rand() * 0.4
    m.position.set(Math.cos(a) * 0.09, h * 0.42 - 0.22, Math.sin(a) * 0.09)
    m.rotation.set(Math.sin(a) * 0.35, rand() * 3, -Math.cos(a) * 0.35)
    g.add(m)
  }
  return g
}

function iceFacets() {
  const g = new THREE.Group()
  const rand = seeded(89)
  const ice = glass('#d6efff', { flat: true, iridescence: 0.25 })
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06 + rand() * 0.07, 0), ice)
    m.position.set((rand() - 0.5) * 0.6, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.3)
    m.scale.set(1, 0.6 + rand() * 0.8, 1)
    m.rotation.set(rand() * 3, rand() * 3, 0)
    g.add(m)
  }
  return g
}

function windStreaks() {
  const g = new THREE.Group()
  const mat = physical({ color: '#eef6ff', emissive: '#bcdcff', emissiveIntensity: 0.6, roughness: 0.4, side: THREE.DoubleSide })
  for (let i = 0; i < 5; i++) {
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 8; k++) {
      const t = k / 8
      pts.push(new THREE.Vector3((t - 0.5) * 1.1, Math.sin(t * Math.PI * 1.5 + i) * 0.05 + (i - 2) * 0.07, Math.cos(t * 4 + i) * 0.08))
    }
    g.add(new THREE.Mesh(ribbonGeometry(new THREE.CatmullRomCurve3(pts), 0.008 + i * 0.002, 100), mat))
  }
  return g
}

export function createUshuaia() {
  const root = new CityRoot('ushuaia')

  // The lighthouse and the End of the World Train lead; ice follows.
  root.addMotif(glacialShards(), {
    window: [0.17, 0.53], side: -1, size: [0.62, 0.7], scaleBack: 0.35, scaleFront: 1.0,
    yBack: -0.05, yFront: 0.3, focusX: -0.7, depth: 1.85,
  }, { spin: [0, 0.35, 0] })

  root.addMotif(iceFacets(), {
    window: [0.5, 0.86], side: 1, size: [0.65, 0.5], scaleBack: 0.4, scaleFront: 1.0,
    yBack: 0.1, yFront: 0.42, focusX: 0.68, depth: 1.85,
  }, { spin: [0.2, 0.4, 0.1] })

  root.addMotif(windStreaks(), {
    window: [0.62, 0.97], side: 1, size: [1.15, 0.4], scaleBack: 0.3, scaleFront: 1.0,
    yBack: 0.1, yFront: 0.62, focusX: 0.15, depth: 2.0,
  }, { spin: [0.05, 0.2, 0] })

  // Aurora curtains: a large one behind the Earth, a smaller arc above it.
  const auroraUniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 0 },
    uLow: { value: new THREE.Color('#3dffb4') },
    uHigh: { value: new THREE.Color('#8a6bff') },
  }
  const rearCurtain = auroraCurtain(1.55, Math.PI * 0.8, Math.PI * 1.1, 1.7, auroraUniforms)
  rearCurtain.position.y = 0.4
  rearCurtain.layers.set(LAYER.REAR)
  const highCurtain = auroraCurtain(2.0, Math.PI * 0.55, Math.PI * 1.22, 0.85, auroraUniforms)
  highCurtain.position.y = 1.0
  highCurtain.layers.set(LAYER.REAR)
  root.group.add(rearCurtain, highCurtain)
  root.onFrame((ctx) => {
    auroraUniforms.uTime.value = ctx.reducedMotion ? 2 : ctx.elapsed
    auroraUniforms.uIntensity.value = ctx.envelope * (0.75 + 0.25 * Math.sin(ctx.local * Math.PI))
    rearCurtain.rotation.y = (ctx.local - 0.5) * 0.3
    highCurtain.rotation.y = -(ctx.local - 0.5) * 0.22
  })

  // Deep winter: abundant snow plus windblown ice motes circling the Earth.
  const rand = seeded(101)
  const snow = 420
  root.addParticles(
    new LayeredParticles(
      new THREE.OctahedronGeometry(1, 0),
      physical({ color: '#ffffff', emissive: '#dceaff', emissiveIntensity: 0.6, roughness: 0.35 }),
      snow,
      fallStep(rand, snow, { width: 2.9, height: 2.0, depth: 1.9, speed: 0.12, size: [0.007, 0.022], sway: 0.14, wind: 0.22, tumble: 1.5 }),
    ),
  )
  const motes = 110
  root.addParticles(
    new LayeredParticles(
      new THREE.TetrahedronGeometry(1, 0),
      physical({ color: '#cfe8ff', roughness: 0.15, metalness: 0.1, emissive: '#9fd0ff', emissiveIntensity: 0.3 }),
      motes,
      shellStep(rand, motes, { rMin: 1.15, rMax: 2.3, speed: 0.16, size: [0.008, 0.02], tumble: 2 }),
    ),
  )
  return root
}
