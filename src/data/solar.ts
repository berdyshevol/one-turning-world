import { CITY_COUNT, SOLAR_POSITIONS } from './cities'
import { clamp, smootherstep } from '../lib/math'

/** Solar-curve parameter for the damped journey position (city units). */
export function solarT(cityFloat: number) {
  const f = clamp(cityFloat, 0, CITY_COUNT - 1e-6)
  const k = Math.floor(f)
  const u = f - k
  if (k >= CITY_COUNT - 1) return SOLAR_POSITIONS[CITY_COUNT - 1]
  return SOLAR_POSITIONS[k] + (SOLAR_POSITIONS[k + 1] - SOLAR_POSITIONS[k]) * smootherstep(0.5, 1, u)
}

/** Weight of the next city's look while the current one hands over. */
export function handoverWeight(local: number) {
  return smootherstep(0.74, 1, local)
}
