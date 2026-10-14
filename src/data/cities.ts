export type CityId = 'tokyo' | 'cairo' | 'paris' | 'new-york' | 'ushuaia'

export interface CityTheme {
  /** Page background, top and bottom of the vertical gradient. */
  skyTop: string
  skyBottom: string
  /** Key light colour that reaches the globe and the choreography. */
  light: string
  /** Fresnel atmosphere around the globe. */
  atmosphere: string
  /** Back-light that outlines the globe silhouette. */
  rim: string
  /** Multiplier applied to the daytime surface. */
  surfaceTint: string
  /** Colour of night-side city lights. */
  cityLights: string
  /** Text accent used for the active city name and the stepper sun. */
  accent: string
  cloudOpacity: number
  lightsStrength: number
  exposure: number
}

export interface City {
  id: CityId
  name: string
  season: string
  daylight: string
  lat: number
  lon: number
  copy: string
  theme: CityTheme
}

export const CITIES: City[] = [
  {
    id: 'tokyo',
    name: 'Tokyo',
    season: 'Spring',
    daylight: 'Sunrise',
    lat: 35.68,
    lon: 139.69,
    copy: 'The city exhales in pink light, where tradition rises and tomorrow quietly takes shape.',
    theme: {
      skyTop: '#1a0f1c',
      skyBottom: '#3a1d2c',
      light: '#ffc2cf',
      atmosphere: '#ff9fc0',
      rim: '#ffd6e2',
      surfaceTint: '#f4dfe6',
      cityLights: '#ffc9a8',
      accent: '#f6b8c8',
      cloudOpacity: 0.55,
      lightsStrength: 0.9,
      exposure: 1.0,
    },
  },
  {
    id: 'cairo',
    name: 'Cairo',
    season: 'Summer',
    daylight: 'Rising daylight',
    lat: 30.04,
    lon: 31.24,
    copy: 'Light becomes architecture, casting the river, stone and sky in molten gold.',
    theme: {
      skyTop: '#1c1207',
      skyBottom: '#4a2e10',
      light: '#ffd28a',
      atmosphere: '#ffbf66',
      rim: '#ffe2a8',
      surfaceTint: '#fbe6c4',
      cityLights: '#ffcf86',
      accent: '#f0c27a',
      cloudOpacity: 0.28,
      lightsStrength: 0.45,
      exposure: 1.12,
    },
  },
  {
    id: 'paris',
    name: 'Paris',
    season: 'Autumn',
    daylight: 'Solar zenith',
    lat: 48.86,
    lon: 2.35,
    copy: 'The afternoon folds into bronze, glass and the slow choreography of fallen leaves.',
    theme: {
      skyTop: '#160e0a',
      skyBottom: '#3d2414',
      light: '#f2b27a',
      atmosphere: '#e7a26a',
      rim: '#ffd0a0',
      surfaceTint: '#efd8c0',
      cityLights: '#ffb878',
      accent: '#dca06a',
      cloudOpacity: 0.5,
      lightsStrength: 0.55,
      exposure: 1.08,
    },
  },
  {
    id: 'new-york',
    name: 'New York',
    season: 'Late Autumn',
    daylight: 'Descending coral light',
    lat: 40.71,
    lon: -74.01,
    copy: 'Steel catches the final coral light as the first snow edits the city into silence.',
    theme: {
      skyTop: '#120c14',
      skyBottom: '#3a1c22',
      light: '#ff9c80',
      atmosphere: '#ff8f7a',
      rim: '#ffc4b0',
      surfaceTint: '#e8d4d2',
      cityLights: '#ffb08a',
      accent: '#f29a84',
      cloudOpacity: 0.62,
      lightsStrength: 1.15,
      exposure: 0.98,
    },
  },
  {
    id: 'ushuaia',
    name: 'Ushuaia',
    season: 'Deep Winter',
    daylight: 'Sunset',
    lat: -54.8,
    lon: -68.3,
    copy: 'At the end of the continent, ice, wind and southern light move as one.',
    theme: {
      skyTop: '#040914',
      skyBottom: '#0e2140',
      light: '#a8d2ff',
      atmosphere: '#6fb8ff',
      rim: '#c6e6ff',
      surfaceTint: '#cfe0f4',
      cityLights: '#9fd0ff',
      accent: '#9cc8f4',
      cloudOpacity: 0.72,
      lightsStrength: 1.25,
      exposure: 0.92,
    },
  },
]

export const CITY_COUNT = CITIES.length
/** Each city owns this many scroll states. */
export const STATES_PER_CITY = 5
export const TOTAL_STATES = CITY_COUNT * STATES_PER_CITY

/** Positions of the five cities along the solar curve (Bézier parameter). */
export const SOLAR_POSITIONS = [0.015, 0.25, 0.5, 0.75, 0.985]

/** Where a city click lands inside its own section (local progress). */
export const CITY_LANDING = 0.08
