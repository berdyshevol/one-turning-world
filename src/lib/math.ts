export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

export const smootherstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/** Frame-rate independent exponential approach. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

/** Damping factor for use with Vector3.lerp / Color.lerp / Quaternion.slerp. */
export const dampFactor = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt)

export interface SpringState {
  value: number
  velocity: number
}

/**
 * Critically damped spring (Game Programming Gems 4, "smooth damp").
 * Velocity stays continuous, so reversing the target never produces a jolt,
 * and `maxSpeed` keeps long jumps between distant cities paced.
 */
export function smoothDamp(
  state: SpringState,
  target: number,
  smoothTime: number,
  dt: number,
  maxSpeed = Infinity,
) {
  const omega = 2 / Math.max(0.0001, smoothTime)
  const x = omega * dt
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  let change = state.value - target
  const maxChange = maxSpeed * smoothTime
  change = clamp(change, -maxChange, maxChange)
  const clampedTarget = state.value - change
  const temp = (state.velocity + omega * change) * dt
  state.velocity = (state.velocity - omega * temp) * exp
  let output = clampedTarget + (change + temp) * exp
  // Prevent overshoot.
  if (target - state.value > 0 === output > target) {
    output = target
    state.velocity = 0
  }
  state.value = output
}

/** Quadratic Bézier evaluation for a single axis. */
export const quad = (p0: number, p1: number, p2: number, t: number) =>
  (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2
