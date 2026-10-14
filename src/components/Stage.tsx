import { useEffect, useRef } from 'react'
import { Experience } from '../scene/Experience'
import { journey, readScroll, scrollToCity } from '../state/journey'

declare global {
  interface Window {
    __experience?: Experience
    __journey?: typeof journey
  }
}

/** Pinned full-viewport WebGL stage. Owns the single persistent scene. */
export function Stage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    readScroll()
    const experience = new Experience(canvas)
    experience.onMarkerClick = (i) => scrollToCity(i)
    if (import.meta.env.DEV) {
      // Inspection hooks for browser validation runs.
      window.__experience = experience
      window.__journey = journey
    }

    let raf = 0
    const loop = () => {
      experience.tick()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onScroll = () => readScroll()
    const onResize = () => {
      experience.resize()
      readScroll()
    }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotion = () => (journey.reducedMotion = motion.matches)
    onMotion()

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    motion.addEventListener('change', onMotion)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      motion.removeEventListener('change', onMotion)
      experience.dispose()
      delete window.__experience
      delete window.__journey
    }
  }, [])

  return <canvas ref={canvasRef} className="stage" aria-hidden="true" />
}
