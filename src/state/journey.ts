import { CITY_COUNT, CITY_LANDING } from '../data/cities'
import { clamp } from '../lib/math'

/**
 * Shared journey state. Scroll writes `target`; the render loop owns the damped
 * `progress` and publishes it here so DOM overlays stay in lockstep with WebGL.
 */
export interface JourneySnapshot {
  /** Damped progress in city units, 0 … CITY_COUNT. */
  cityFloat: number
  /** Index of the city that owns the composition right now. */
  active: number
  /** Local progress within the active city, 0 … 1. */
  local: number
}

type Listener = (s: JourneySnapshot) => void

const listeners = new Set<Listener>()

export const journey = {
  /** Scroll-derived target in city units. */
  target: 0,
  snapshot: { cityFloat: 0, active: 0, local: 0 } as JourneySnapshot,
  reducedMotion: false,
  /**
   * True while a click-initiated journey to a city is under way. Hand-driven
   * scrolling clears it: then every orbit follows the scroll exactly.
   */
  jumping: false,
  /** Destination of the current jump, in city units. */
  destination: 0,
}

export function splitCityFloat(cityFloat: number) {
  const f = clamp(cityFloat, 0, CITY_COUNT - 1e-6)
  const active = Math.floor(f)
  return { active, local: f - active }
}

export function publish(cityFloat: number) {
  const { active, local } = splitCityFloat(cityFloat)
  journey.snapshot = { cityFloat, active, local }
  listeners.forEach((l) => l(journey.snapshot))
}

export function subscribe(listener: Listener) {
  listeners.add(listener)
  listener(journey.snapshot)
  return () => {
    listeners.delete(listener)
  }
}

const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - window.innerHeight)

export function readScroll() {
  journey.target = clamp(window.scrollY / maxScroll()) * CITY_COUNT
}

export function scrollToCity(index: number) {
  const top = ((index + CITY_LANDING) / CITY_COUNT) * maxScroll()
  journey.jumping = !journey.reducedMotion
  journey.destination = index + CITY_LANDING
  window.scrollTo({ top, behavior: journey.reducedMotion ? 'auto' : 'smooth' })
}
