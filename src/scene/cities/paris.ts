import * as THREE from 'three'
import { seeded, LayeredParticles } from '../particles'
import { CityRoot, glass, leafGeometry, physical, fallStep, shellStep } from './common'

function cathedralLines() {
  const g = new THREE.Group()
  const mat = new THREE.LineBasicMaterial({ color: '#f1c48f', transparent: true })
  // Nested pointed (Gothic) arches and a rose window.
  for (let k = 0; k < 4; k++) {
    // Equilateral pointed arch: two arcs of radius 2w centred on the far jamb.
    const w = 0.3 - k * 0.06
    const leg = 0.36 - k * 0.04
    const left: THREE.Vector3[] = []
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI - (Math.PI / 3) * (i / 20)
      left.push(new THREE.Vector3(w + 2 * w * Math.cos(a), 2 * w * Math.sin(a), 0))
    }
    const right = left.slice(0, -1).reverse().map((p) => new THREE.Vector3(-p.x, p.y, 0))
    const outline = [new THREE.Vector3(-w, -leg, 0), ...left, ...right, new THREE.Vector3(w, -leg, 0)]
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(outline), mat)
    line.position.set(0, -0.12, -k * 0.05)
    g.add(line)
  }
  const rose = new THREE.Group()
  for (let i = 0; i < 12; i++) {
    const petal = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        new THREE.EllipseCurve(0, 0.045, 0.02, 0.045, 0, Math.PI * 2).getPoints(24).map((p) => new THREE.Vector3(p.x, p.y, 0)),
      ),
      mat,
    )
    petal.rotation.z = (i / 12) * Math.PI * 2
    rose.add(petal)
  }
  rose.position.y = 0.06
  g.add(rose)
  return g
}

function glassFacets() {
  const g = new THREE.Group()
  const rand = seeded(41)
  const glassMat = glass('#b8865a', { flat: true, iridescence: 0.2 })
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.09 + rand() * 0.06, 0), glassMat)
    m.position.set((rand() - 0.5) * 0.55, (rand() - 0.5) * 0.4, (rand() - 0.5) * 0.25)
    m.scale.y = 1.4 + rand()
    m.rotation.set(rand(), rand() * 3, rand())
    g.add(m)
  }
  return g
}

function leafVortex() {
  const g = new THREE.Group()
  const geo = leafGeometry()
  const colors = ['#c8742e', '#a4501f', '#d99a45', '#7d3a1a']
  for (let i = 0; i < 26; i++) {
    const t = i / 26
    const a = t * Math.PI * 4
    const m = new THREE.Mesh(
      geo,
      physical({ color: colors[i % colors.length], roughness: 0.6, sheen: 0.6, side: THREE.DoubleSide }),
    )
    m.position.set(Math.cos(a) * (0.1 + t * 0.25), (t - 0.5) * 0.5, Math.sin(a) * (0.1 + t * 0.25))
    m.rotation.set(a, a * 0.5, t * 2)
    m.scale.setScalar(0.07 + (1 - t) * 0.03)
    g.add(m)
  }
  return g
}

export function createParis() {
  const root = new CityRoot('paris')

  // The Eiffel Tower and Pont Alexandre III sprites lead; these follow.
  root.addMotif(cathedralLines(), {
    window: [0.17, 0.53], side: -1, size: [0.7, 0.75], scaleBack: 0.4, scaleFront: 1.0,
    yBack: 0.1, yFront: 0.3, focusX: -0.72, depth: 1.8,
  }, { spin: [0, 0.3, 0] })

  root.addMotif(glassFacets(), {
    window: [0.5, 0.86], side: 1, size: [0.6, 0.5], scaleBack: 0.4, scaleFront: 0.95,
    yBack: 0.05, yFront: 0.45, focusX: 0.7, depth: 1.85,
  }, { spin: [0.2, 0.4, 0.1] })

  root.addMotif(leafVortex(), {
    window: [0.62, 0.97], side: -1, size: [0.6, 0.6], scaleBack: 0.4, scaleFront: 1.1,
    yBack: 0.05, yFront: 0.3, focusX: -0.55, depth: 1.9,
  }, { spin: [0, 0.9, 0] })

  // Ambient autumn: leaves falling through the scene and a few circling.
  const rand = seeded(53)
  const palette = ['#c8742e', '#a4501f', '#d99a45', '#8b3f1c', '#e0b25c'].map((c) => new THREE.Color(c))
  const leafMat = physical({ color: '#ffffff', roughness: 0.62, sheen: 0.5, side: THREE.DoubleSide })
  const falling = 120
  root.addParticles(
    new LayeredParticles(
      leafGeometry(),
      leafMat,
      falling,
      fallStep(rand, falling, { width: 2.7, height: 1.9, depth: 1.7, speed: 0.13, size: [0.035, 0.07], sway: 0.3, wind: -0.1, tumble: 2.5 }),
      Array.from({ length: falling }, () => palette[Math.floor(rand() * palette.length)]),
    ),
  )
  const circling = 60
  root.addParticles(
    new LayeredParticles(
      leafGeometry(),
      leafMat,
      circling,
      shellStep(rand, circling, { rMin: 1.25, rMax: 2.2, speed: 0.09, size: [0.03, 0.06], tumble: 2 }),
      Array.from({ length: circling }, () => palette[Math.floor(rand() * palette.length)]),
    ),
  )
  return root
}
