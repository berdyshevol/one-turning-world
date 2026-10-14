import * as THREE from 'three'
import { seeded, LayeredParticles } from '../particles'
import { CityRoot, glass, physical, shellStep } from './common'

const BRASS = { color: '#d9a85a', metalness: 1, roughness: 0.28 }

function bubbles() {
  const g = new THREE.Group()
  const glassMat = glass('#ffe2b8', { iridescence: 0.28 })
  const spots: [number, number, number, number][] = [
    [0, 0, 0, 0.17],
    [0.22, 0.14, -0.05, 0.1],
    [-0.2, 0.16, 0.06, 0.075],
    [0.12, -0.2, 0.08, 0.065],
    [-0.16, -0.14, -0.04, 0.05],
  ]
  for (const [x, y, z, r] of spots) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), glassMat)
    m.position.set(x, y, z)
    g.add(m)
  }
  return g
}

function fanous() {
  const g = new THREE.Group()
  const brass = physical(BRASS)
  const glow = physical({
    color: '#ffb35c',
    emissive: '#ff9a2e',
    emissiveIntensity: 1.3,
    roughness: 0.3,
  })
  // Octagonal body with a domed cap and a finial: the Ramadan lantern.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.075, 0.26, 8, 1, true), glow)
  g.add(body)
  const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.077, 0.26, 8, 3, true), brass)
  ;(frame.material as THREE.MeshPhysicalMaterial).wireframe = true
  g.add(frame)
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), brass)
  dome.position.y = 0.13
  g.add(dome)
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 8), brass)
  finial.position.y = 0.3
  g.add(finial)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 24), brass)
  ring.position.y = 0.39
  g.add(ring)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.05, 8), brass)
  base.position.y = -0.155
  g.add(base)
  g.add(new THREE.PointLight('#ffb35c', 0.9, 1.4, 2))
  return g
}

function stoneFacets() {
  const g = new THREE.Group()
  const rand = seeded(23)
  const stone = new THREE.MeshStandardMaterial({ color: '#9a6a3e', roughness: 0.95, flatShading: true })
  const geo = new THREE.IcosahedronGeometry(0.1, 0)
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(geo, stone)
    m.position.set((rand() - 0.5) * 0.6, (rand() - 0.5) * 0.35, (rand() - 0.5) * 0.3)
    m.scale.set(0.6 + rand(), 0.5 + rand() * 0.8, 0.6 + rand())
    m.rotation.set(rand() * 3, rand() * 3, rand() * 3)
    g.add(m)
  }
  return g
}

export function createCairo() {
  const root = new CityRoot('cairo')

  // Landmark sprites (pyramids, Sphinx) take the main focal moments; these
  // procedural pieces carry material and atmosphere between them.
  root.addMotif(fanous(), {
    window: [0.2, 0.56], side: 1, size: [0.26, 0.6], scaleBack: 0.4, scaleFront: 1.1,
    yBack: 0.2, yFront: 0.42, focusX: 0.72, depth: 1.7,
  }, { spin: [0, 0.6, 0] })

  root.addMotif(bubbles(), {
    window: [0.52, 0.88], side: -1, size: [0.6, 0.5], scaleBack: 0.4, scaleFront: 1.0,
    yBack: 0.1, yFront: 0.42, focusX: -0.7, depth: 1.8,
  }, { spin: [0.1, 0.25, 0] })

  root.addMotif(stoneFacets(), {
    window: [0.62, 0.97], side: 1, size: [0.7, 0.45], scaleBack: 0.35, scaleFront: 0.85,
    yBack: 0.1, yFront: 0.5, focusX: 0.5, depth: 1.9,
  }, { spin: [0.1, 0.35, 0.05] })

  // Ambient summer: drifting gold motes, dense and slow like heat haze.
  const rand = seeded(31)
  const motes = 260
  root.addParticles(
    new LayeredParticles(
      new THREE.OctahedronGeometry(1, 0),
      physical({ color: '#ffd58a', emissive: '#ffb347', emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.3 }),
      motes,
      shellStep(rand, motes, { rMin: 1.15, rMax: 2.6, speed: 0.06, size: [0.006, 0.016], tumble: 1 }),
    ),
  )
  return root
}
