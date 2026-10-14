import type { CityId } from './cities'

/**
 * Generated landmark cutouts and the orbit each one follows around the Earth.
 * Sizes are in world units where the globe radius is 1; `window` is the span
 * of the city's local progress during which the landmark travels from behind
 * the Earth, around one limb, through the foreground and back around the other.
 */
export interface LandmarkConfig {
  id: string
  city: CityId
  src: string
  /** Pixel size of the trimmed sprite, for its aspect ratio. */
  pixels: [number, number]
  /** Displayed height at scale 1. */
  height: number
  /** Entry → exit window within the city (local progress). */
  window: [number, number]
  /** Limb it emerges from first: +1 right, -1 left. */
  side: 1 | -1
  scaleBack: number
  scaleFront: number
  /** Height while hidden behind the Earth, and at its focal point. */
  yBack: number
  yFront: number
  /** Horizontal offset of the focal point. */
  focusX: number
  /** Orbit depth in front of / behind the Earth. */
  depth: number
  /** Peak opacity in the foreground. */
  opacity?: number
}

export const LANDMARKS: LandmarkConfig[] = [
  // Cairo — monumental stone, low and wide.
  {
    id: 'pyramids', city: 'cairo', src: '/sprites/pyramids.webp', pixels: [1100, 499],
    height: 0.72, window: [0.03, 0.43], side: -1, scaleBack: 0.32, scaleFront: 1,
    yBack: -0.12, yFront: -0.66, focusX: 0.08, depth: 1.95,
  },
  {
    id: 'sphinx', city: 'cairo', src: '/sprites/sphinx.webp', pixels: [1100, 651],
    height: 0.66, window: [0.4, 0.8], side: 1, scaleBack: 0.32, scaleFront: 1,
    yBack: -0.1, yFront: -0.62, focusX: 0.46, depth: 1.95,
  },

  // Paris — a credible Eiffel Tower and Pont Alexandre III low in the frame.
  {
    id: 'eiffel', city: 'paris', src: '/sprites/eiffel.webp', pixels: [520, 1100],
    height: 1.42, window: [0.03, 0.43], side: 1, scaleBack: 0.3, scaleFront: 1,
    yBack: 0.05, yFront: 0.14, focusX: 0.62, depth: 1.85,
  },
  {
    id: 'pont-alexandre', city: 'paris', src: '/sprites/pont-alexandre.webp', pixels: [1100, 373],
    height: 0.56, window: [0.36, 0.78], side: -1, scaleBack: 0.3, scaleFront: 1,
    yBack: -0.12, yFront: -0.8, focusX: 0.05, depth: 2.05,
  },

  // New York — Empire State, Brooklyn Bridge, Statue of Liberty.
  {
    id: 'empire-state', city: 'new-york', src: '/sprites/empire-state.webp', pixels: [330, 1100],
    height: 1.45, window: [0.03, 0.4], side: -1, scaleBack: 0.3, scaleFront: 1,
    yBack: 0.05, yFront: 0.12, focusX: -0.64, depth: 1.85,
  },
  {
    id: 'brooklyn-bridge', city: 'new-york', src: '/sprites/brooklyn-bridge.webp', pixels: [1100, 457],
    height: 0.64, window: [0.3, 0.7], side: 1, scaleBack: 0.3, scaleFront: 1,
    yBack: -0.12, yFront: -0.78, focusX: 0.12, depth: 2.05,
  },
  {
    id: 'liberty', city: 'new-york', src: '/sprites/liberty.webp', pixels: [551, 1100],
    height: 1.25, window: [0.57, 0.97], side: -1, scaleBack: 0.3, scaleFront: 1,
    yBack: 0.05, yFront: 0.1, focusX: -0.6, depth: 1.85,
  },

  // Ushuaia — lighthouse on its islet and the End of the World Train.
  {
    id: 'lighthouse', city: 'ushuaia', src: '/sprites/lighthouse.webp', pixels: [804, 971],
    height: 0.95, window: [0.03, 0.43], side: 1, scaleBack: 0.3, scaleFront: 1,
    yBack: 0, yFront: -0.22, focusX: 0.6, depth: 1.9,
  },
  {
    id: 'train', city: 'ushuaia', src: '/sprites/train.webp', pixels: [1100, 614],
    height: 0.66, window: [0.42, 0.84], side: -1, scaleBack: 0.3, scaleFront: 1,
    yBack: -0.12, yFront: -0.7, focusX: -0.05, depth: 2.0,
  },
]

export const landmarksFor = (city: CityId) => LANDMARKS.filter((l) => l.city === city)
