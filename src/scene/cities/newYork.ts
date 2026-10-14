import * as THREE from 'three'
import { smoothstep } from '../../lib/math'
import { seeded, LayeredParticles } from '../particles'
import { CityRoot, leafGeometry, physical, fallStep } from './common'

const GOLD = { color: '#e3b07a', metalness: 1, roughness: 0.22 }

function decoFan() {
  const g = new THREE.Group()
  const gold = physical(GOLD)
  const dark = physical({ color: '#1a1416', metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide })
  const plate = new THREE.Mesh(new THREE.CircleGeometry(0.42, 64, 0, Math.PI), dark)
  g.add(plate)
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.42, 0.012), gold)
    rib.position.set(Math.cos(a) * 0.21, Math.sin(a) * 0.21, 0.01)
    rib.rotation.z = a - Math.PI / 2
    g.add(rib)
  }
  for (const r of [0.14, 0.28, 0.42]) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 8, 80, Math.PI), gold)
    arc.position.z = 0.012
    g.add(arc)
  }
  g.position.y = -0.15
  const wrap = new THREE.Group()
  wrap.add(g)
  return wrap
}

function clock() {
  const g = new THREE.Group()
  const gold = physical(GOLD)
  const face = physical({ color: '#efe2cc', roughness: 0.35, emissive: '#ffcfa0', emissiveIntensity: 0.35 })
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 64).rotateX(Math.PI / 2), face))
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.018, 16, 96), gold))
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.008, i % 3 === 0 ? 0.05 : 0.028, 0.01), gold)
    tick.position.set(Math.sin(a) * 0.17, Math.cos(a) * 0.17, 0.015)
    tick.rotation.z = -a
    g.add(tick)
  }
  const hour = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.008).translate(0, 0.05, 0), gold)
  hour.position.z = 0.02
  hour.name = 'hour'
  const minute = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.15, 0.008).translate(0, 0.075, 0), gold)
  minute.position.z = 0.025
  minute.name = 'minute'
  g.add(hour, minute)
  // Four-faced Grand Central-style orb above.
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 24, 16), gold)
  orb.position.y = 0.26
  g.add(orb)
  return g
}

export function createNewYork() {
  const root = new CityRoot('new-york')

  // Empire State, Brooklyn Bridge and Liberty sprites lead; Art Deco follows.
  root.addMotif(decoFan(), {
    window: [0.15, 0.51], side: 1, size: [0.86, 0.45], scaleBack: 0.35, scaleFront: 0.95,
    yBack: 0.15, yFront: 0.62, focusX: 0.55, depth: 1.85,
  }, { spin: [0, 0.3, 0] })

  const clockMotif = root.addMotif(clock(), {
    window: [0.42, 0.78], side: 1, size: [0.45, 0.55], scaleBack: 0.4, scaleFront: 1.05,
    yBack: 0.1, yFront: 0.42, focusX: 0.66, depth: 1.8,
  }, {
    spin: [0, 0.22, 0],
    update: (ctx, theta) => {
      const t = ctx.local * 12 + (ctx.reducedMotion ? 0 : ctx.elapsed * 0.02) + theta * 0.05
      clockMotif.object.getObjectByName('hour')!.rotation.z = -t * 0.5
      clockMotif.object.getObjectByName('minute')!.rotation.z = -t * 6
    },
  })

  // Late autumn hands over to first snow as the city progresses.
  const rand = seeded(71)
  const palette = ['#c0562c', '#9c3f22', '#d98a4a', '#6f2e1a'].map((c) => new THREE.Color(c))
  const leafCount = 80
  const leafStep = fallStep(rand, leafCount, { width: 2.7, height: 1.9, depth: 1.6, speed: 0.14, size: [0.035, 0.065], sway: 0.28, wind: 0.12 })
  const leafWeight = { v: 1 }
  root.addParticles(
    new LayeredParticles(
      leafGeometry(),
      physical({ color: '#ffffff', roughness: 0.6, sheen: 0.4, side: THREE.DoubleSide }),
      leafCount,
      (i, t, out) => {
        leafStep(i, t, out)
        out.scale *= leafWeight.v
      },
      Array.from({ length: leafCount }, () => palette[Math.floor(rand() * palette.length)]),
    ),
  )
  const snowCount = 260
  const snowStep = fallStep(rand, snowCount, { width: 2.8, height: 2.0, depth: 1.8, speed: 0.09, size: [0.008, 0.02], sway: 0.1, tumble: 1.5 })
  const snowWeight = { v: 0 }
  root.addParticles(
    new LayeredParticles(
      new THREE.OctahedronGeometry(1, 0),
      physical({ color: '#ffffff', emissive: '#e8eeff', emissiveIntensity: 0.5, roughness: 0.3 }),
      snowCount,
      (i, t, out) => {
        snowStep(i, t, out)
        // Snow arrives progressively: more flakes appear as the city advances.
        out.scale *= smoothstep(i / snowCount - 0.15, i / snowCount + 0.05, snowWeight.v)
      },
    ),
  )
  root.onFrame((ctx) => {
    leafWeight.v = 1 - smoothstep(0.45, 0.95, ctx.local) * 0.85
    snowWeight.v = smoothstep(0.2, 0.9, ctx.local)
  })
  return root
}
