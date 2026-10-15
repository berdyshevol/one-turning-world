import * as THREE from 'three'
import { seeded, LayeredParticles } from '../particles'
import { CityRoot, physical, shellStep } from './common'

export function createCairo() {
  const root = new CityRoot('cairo')

  // The landmark sprites (pyramids, Sphinx) carry Cairo on their own; only
  // the summer haze accompanies them: gold motes, dense and slow.
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
