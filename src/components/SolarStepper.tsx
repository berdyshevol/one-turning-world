import { useEffect, useRef } from 'react'
import { CITIES, SOLAR_POSITIONS } from '../data/cities'
import { solarT } from '../data/solar'
import { quad } from '../lib/math'
import { scrollToCity, subscribe } from '../state/journey'
import { useActiveCity } from '../state/useActiveCity'

// Solar course geometry: M 52 106 Q 500 -76 948 106 in a 1000 × 126 box.
const VIEW_W = 1000
const VIEW_H = 126
const P0 = { x: 52, y: 106 }
const P1 = { x: 500, y: -76 }
const P2 = { x: 948, y: 106 }
const HORIZON = 106

const solarPoint = (t: number) => ({
  x: quad(P0.x, P1.x, P2.x, t),
  y: quad(P0.y, P1.y, P2.y, t),
})

/** Exact sub-curve from 0 to t (de Casteljau), for the travelled arc. */
const travelledPath = (t: number) => {
  const c = { x: P0.x + (P1.x - P0.x) * t, y: P0.y + (P1.y - P0.y) * t }
  const e = solarPoint(t)
  return `M ${P0.x} ${P0.y} Q ${c.x} ${c.y} ${e.x} ${e.y}`
}

const ARC = `M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`

export function SolarStepper() {
  const active = useActiveCity()
  const sunRef = useRef<SVGGElement>(null)
  const travelRef = useRef<SVGPathElement>(null)
  const glowRef = useRef<SVGPathElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(
    () =>
      subscribe((s) => {
        const t = solarT(s.cityFloat)
        const p = solarPoint(t)
        sunRef.current?.setAttribute('transform', `translate(${p.x} ${p.y})`)
        const d = travelledPath(t)
        travelRef.current?.setAttribute('d', d)
        glowRef.current?.setAttribute('d', d)
        if (progressRef.current) progressRef.current.style.transform = `scaleX(${s.cityFloat / CITIES.length})`
      }),
    [],
  )

  const dots = SOLAR_POSITIONS.map(solarPoint)
  const rise = dots[0]
  const zenith = dots[2]
  const set = dots[4]

  return (
    <>
      <nav className="solar" aria-label="Cities along the course of the sun">
        <svg className="solar__svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true">
          <defs>
            <linearGradient id="arc-grad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#f6b8c8" />
              <stop offset="0.25" stopColor="#f0c27a" />
              <stop offset="0.5" stopColor="#ffe2a8" />
              <stop offset="0.75" stopColor="#f29a84" />
              <stop offset="1" stopColor="#9cc8f4" />
            </linearGradient>
            <radialGradient id="sun-glow">
              <stop offset="0" stopColor="#fff4dc" stopOpacity="0.95" />
              <stop offset="0.35" stopColor="#ffd9a0" stopOpacity="0.35" />
              <stop offset="1" stopColor="#ffd9a0" stopOpacity="0" />
            </radialGradient>
            <clipPath id="half-clip">
              <rect x="-20" y="-20" width="40" height="20" />
            </clipPath>
            <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          {/* Horizon: the sun rises from it at Tokyo and sets into it at Ushuaia. */}
          <line className="solar__horizon" x1="16" x2={VIEW_W - 16} y1={HORIZON} y2={HORIZON} />

          <path className="solar__arc" d={ARC} />
          <path ref={glowRef} className="solar__travelled-glow" d={travelledPath(0)} stroke="url(#arc-grad)" filter="url(#soft)" />
          <path ref={travelRef} className="solar__travelled" d={travelledPath(0)} stroke="url(#arc-grad)" />

          {/* Sunrise: a half sun resting on the horizon with short rays. */}
          <g className="solar__glyph solar__glyph--rise" transform={`translate(${rise.x} ${HORIZON})`}>
            <circle r="13" className="solar__half" clipPath="url(#half-clip)" />
            {[-60, -30, 0, 30, 60].map((a) => (
              <line key={a} x1="0" y1="-18" x2="0" y2="-24" transform={`rotate(${a})`} className="solar__ray" />
            ))}
          </g>

          {/* Zenith: a full radiant sun at the top of the arc. */}
          <g className="solar__glyph solar__glyph--zenith" transform={`translate(${zenith.x} ${zenith.y})`}>
            {Array.from({ length: 12 }, (_, i) => (
              <line key={i} x1="0" y1="-12" x2="0" y2={i % 2 ? '-16' : '-19'} transform={`rotate(${i * 30})`} className="solar__ray" />
            ))}
          </g>

          {/* Sunset: a half sun sinking, with its reflection lines below. */}
          <g className="solar__glyph solar__glyph--set" transform={`translate(${set.x} ${HORIZON})`}>
            <circle r="13" className="solar__half solar__half--set" clipPath="url(#half-clip)" />
            <line x1="-12" x2="12" y1="5" y2="5" className="solar__reflect" />
            <line x1="-8" x2="8" y1="9" y2="9" className="solar__reflect" />
            <line x1="-4" x2="4" y1="13" y2="13" className="solar__reflect" />
          </g>

          <g ref={sunRef} className="solar__sun" transform={`translate(${rise.x} ${rise.y})`}>
            <circle r="24" fill="url(#sun-glow)" />
            <circle r="6.5" className="solar__sun-core" />
          </g>
        </svg>

        <ol className="solar__cities">
          {CITIES.map((city, i) => {
            const p = dots[i]
            return (
              <li
                key={city.id}
                className="solar__city"
                style={{ left: `${(p.x / VIEW_W) * 100}%`, top: `${(p.y / VIEW_H) * 100}%` }}
              >
                <button
                  type="button"
                  className="solar__dot"
                  aria-current={i === active ? 'step' : undefined}
                  aria-label={`${city.name}, ${city.season}`}
                  onClick={() => scrollToCity(i)}
                >
                  <span className="solar__pip" aria-hidden="true" />
                  <span className="solar__name">{city.name}</span>
                  <span className="solar__season">{city.season}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
      <div className="journey-line" aria-hidden="true">
        <div ref={progressRef} className="journey-line__fill" />
      </div>
    </>
  )
}
