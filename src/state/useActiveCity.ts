import { useEffect, useState } from 'react'
import { subscribe } from './journey'

/** Index of the active city; re-renders only when the city changes. */
export function useActiveCity() {
  const [active, setActive] = useState(0)
  useEffect(() => subscribe((s) => setActive((prev) => (prev === s.active ? prev : s.active))), [])
  return active
}
