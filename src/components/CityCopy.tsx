import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CITIES } from '../data/cities'
import { useActiveCity } from '../state/useActiveCity'

export function CityCopy() {
  const active = useActiveCity()
  const reduce = useReducedMotion()
  const city = CITIES[active]
  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: 'blur(6px)' }
  const rest = { opacity: 1, y: 0, filter: 'blur(0px)' }
  const exit = reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: 'blur(4px)' }

  return (
    <section className="copy" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={city.id}
          initial={enter}
          animate={rest}
          exit={exit}
          transition={{ duration: reduce ? 0.2 : 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="copy__city">{city.name}</h2>
          <p className="copy__line">{city.copy}</p>
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
