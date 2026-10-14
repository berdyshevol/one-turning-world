import * as THREE from 'three'
import { seeded, LayeredParticles } from '../particles'
import { CityRoot, SLOTS, petalGeometry, physical, ribbonGeometry, shellStep, fallStep } from './common'

const VERMILION = new THREE.Color('#c8402c')

function torii() {
  const g = new THREE.Group()
  const lacquer = physical({ color: VERMILION, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 })
  const black = physical({ color: '#140c0c', roughness: 0.35, clearcoat: 1 })
  const pillar = new THREE.CylinderGeometry(0.034, 0.04, 0.78, 24)
  for (const x of [-0.27, 0.27]) {
    const p = new THREE.Mesh(pillar, lacquer)
    p.position.set(x, -0.05, 0)
    p.rotation.z = x > 0 ? -0.03 : 0.03
    g.add(p)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 24), black)
    base.position.set(x * 1.015, -0.43, 0)
    g.add(base)
  }
  // Kasagi: the upswept top beam, built along a gentle curve.
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.5, 0.42, 0),
    new THREE.Vector3(0, 0.31, 0),
    new THREE.Vector3(0.5, 0.42, 0),
  )
  const kasagi = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.032, 12), black)
  g.add(kasagi)
  const shimaki = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.026, 12), lacquer)
  shimaki.position.y = -0.05
  g.add(shimaki)
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.04, 0.035), lacquer)
  nuki.position.y = 0.16
  g.add(nuki)
  return g
}

function lanterns() {
  const g = new THREE.Group()
  const profile: THREE.Vector2[] = []
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    profile.push(new THREE.Vector2(0.03 + Math.sin(Math.PI * t) * 0.11, t * 0.3 - 0.15))
  }
  const body = new THREE.LatheGeometry(profile, 32)
  const paper = physical({
    color: '#e9b597',
    emissive: '#ff7a3d',
    emissiveIntensity: 0.32,
    roughness: 0.7,
    side: THREE.DoubleSide,
  })
  const ribs = new THREE.MeshStandardMaterial({ color: '#2a1410', roughness: 0.5 })
  const cap = new THREE.CylinderGeometry(0.045, 0.045, 0.025, 20)
  const spots: [number, number, number, number][] = [
    [-0.18, 0.08, 0.05, 1],
    [0.06, 0.2, -0.04, 0.82],
    [0.2, -0.06, 0.06, 0.92],
  ]
  for (const [x, y, z, s] of spots) {
    const l = new THREE.Group()
    l.add(new THREE.Mesh(body, paper))
    for (const yy of [-0.155, 0.155]) {
      const c = new THREE.Mesh(cap, ribs)
      c.position.y = yy
      l.add(c)
    }
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.3, 4), ribs)
    cord.position.y = 0.31
    l.add(cord)
    l.position.set(x, y, z)
    l.scale.setScalar(s)
    g.add(l)
  }
  const glow = new THREE.PointLight('#ffb08a', 0.6, 1.2, 2)
  g.add(glow)
  return g
}

function lacquerRibbon() {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    pts.push(new THREE.Vector3((t - 0.5) * 1.1, Math.sin(t * Math.PI * 2.2) * 0.16, Math.cos(t * Math.PI * 1.6) * 0.18))
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  const g = new THREE.Group()
  g.add(
    new THREE.Mesh(
      ribbonGeometry(curve, 0.06, 200, Math.PI * 2.5),
      physical({ color: '#7a0f1e', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }),
    ),
  )
  const inner = new THREE.Mesh(
    ribbonGeometry(curve, 0.02, 200, Math.PI * 2.5),
    physical({ color: '#e7b98a', metalness: 1, roughness: 0.2, side: THREE.DoubleSide }),
  )
  inner.position.set(0, 0.035, 0.02)
  g.add(inner)
  return g
}

function needles() {
  const g = new THREE.Group()
  const chrome = physical({ color: '#f4eef2', metalness: 1, roughness: 0.08 })
  const rand = seeded(11)
  const geo = new THREE.ConeGeometry(0.008, 0.62, 10)
  for (let i = 0; i < 11; i++) {
    const n = new THREE.Mesh(geo, chrome)
    const a = (i / 11) * Math.PI * 2
    n.position.set(Math.cos(a) * 0.06, (rand() - 0.5) * 0.18, Math.sin(a) * 0.06)
    n.rotation.set((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.6)
    n.scale.y = 0.6 + rand() * 0.6
    g.add(n)
  }
  return g
}

function blossom() {
  const g = new THREE.Group()
  const petal = petalGeometry()
  const mat = physical({
    color: '#ffd3df',
    emissive: '#ff8fb0',
    emissiveIntensity: 0.18,
    roughness: 0.55,
    sheen: 1,
    sheenColor: new THREE.Color('#ffe4ee'),
    side: THREE.DoubleSide,
  })
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(petal, mat)
    const a = (i / 5) * Math.PI * 2
    p.scale.setScalar(0.22)
    p.position.set(Math.sin(a) * 0.11, Math.cos(a) * 0.11, 0)
    p.rotation.set(0.35, 0, -a)
    g.add(p)
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 16, 12),
    physical({ color: '#c8405a', roughness: 0.4 }),
  )
  g.add(center)
  return g
}

export function createTokyo() {
  const root = new CityRoot('tokyo')
  const [a, b, c, d, e] = SLOTS

  root.addMotif(torii(), {
    window: a, side: 1, size: [1.0, 0.9], scaleBack: 0.35, scaleFront: 1.05,
    yBack: 0.05, yFront: 0.18, focusX: 0.35, depth: 1.9,
  }, { spin: [0, 0.32, 0], rotation: [0.08, -0.3, 0] })

  root.addMotif(lanterns(), {
    window: b, side: -1, size: [0.55, 0.6], scaleBack: 0.4, scaleFront: 1.25,
    yBack: 0.2, yFront: 0.42, focusX: -0.55, depth: 1.8,
  }, { spin: [0, 0.4, 0] })

  root.addMotif(lacquerRibbon(), {
    window: c, side: 1, size: [1.15, 0.85], scaleBack: 0.3, scaleFront: 1.0,
    yBack: 0, yFront: -0.28, focusX: 0.25, depth: 2.0,
  }, { spin: [0.25, 0.2, 0.1], rotation: [0.3, 0, -0.15] })

  root.addMotif(needles(), {
    window: d, side: -1, size: [0.4, 0.7], scaleBack: 0.35, scaleFront: 1.15,
    yBack: 0.1, yFront: 0.28, focusX: -0.62, depth: 1.85,
  }, { spin: [0.1, 0.6, 0.15] })

  root.addMotif(blossom(), {
    window: e, side: 1, size: [0.5, 0.5], scaleBack: 0.4, scaleFront: 1.5,
    yBack: 0.05, yFront: 0.3, focusX: 0.48, depth: 1.9,
  }, { spin: [0.2, 0.3, 0.45], rotation: [0.2, 0.4, 0] })

  // Ambient spring: petals swirling around the Earth and drifting down.
  const rand = seeded(7)
  const petalMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#ff7aa2',
    emissiveIntensity: 0.12,
    roughness: 0.75,
    side: THREE.DoubleSide,
  })
  const tints = ['#f48aab', '#ee7398', '#f9a9c1', '#e06690', '#fbc6d6'].map((c) => new THREE.Color(c))
  const swirl = 130
  root.addParticles(
    new LayeredParticles(
      petalGeometry(),
      petalMat,
      swirl,
      shellStep(rand, swirl, { rMin: 1.2, rMax: 2.5, speed: 0.12, size: [0.04, 0.08], tumble: 2.2 }),
      Array.from({ length: swirl }, () => tints[Math.floor(rand() * tints.length)]),
    ),
  )
  const drift = 70
  root.addParticles(
    new LayeredParticles(
      petalGeometry(),
      petalMat,
      drift,
      fallStep(rand, drift, { width: 2.6, height: 1.9, depth: 1.6, speed: 0.11, size: [0.035, 0.07], sway: 0.25, wind: 0.08 }),
      Array.from({ length: drift }, () => tints[Math.floor(rand() * tints.length)]),
    ),
  )
  return root
}
