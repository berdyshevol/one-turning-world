import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { CITIES, CITY_COUNT } from '../data/cities'
import { handoverWeight, solarT } from '../data/solar'
import { clamp, damp, dampFactor, smoothDamp, smootherstep, type SpringState } from '../lib/math'
import { journey, publish, splitCityFloat } from '../state/journey'
import { Globe, orientationFor, type GlobeTheme } from './Globe'
import { LAYER } from './layers'
import { orbitView, type OrbitMode } from './orbit'
import { OrbitGuides } from './guides'
import { cityEnvelope, type CityRoot, type FrameContext } from './cities/common'
import { createTokyo } from './cities/tokyo'
import { createCairo } from './cities/cairo'
import { createParis } from './cities/paris'
import { createNewYork } from './cities/newYork'
import { createUshuaia } from './cities/ushuaia'
import { landmarksFor } from '../data/landmarks'
import { addLandmarks } from './sprites'
import { sharedLight } from './shared'

const FOV = 30

interface Layout {
  width: number
  height: number
  /** Globe centre and radius in CSS pixels. */
  cx: number
  cy: number
  radius: number
  /** Visible half-width of the globe plane in world units. */
  halfWidth: number
  sizeScale: number
}

const themeFrom = (i: number): GlobeTheme => {
  const t = CITIES[i].theme
  return {
    light: new THREE.Color(t.light),
    atmosphere: new THREE.Color(t.atmosphere),
    rim: new THREE.Color(t.rim),
    surfaceTint: new THREE.Color(t.surfaceTint),
    cityLights: new THREE.Color(t.cityLights),
    cloudOpacity: t.cloudOpacity,
    lightsStrength: t.lightsStrength,
    exposure: t.exposure,
  }
}

export class Experience {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)
  readonly globe: Globe
  readonly cities: CityRoot[]
  layout: Layout = { width: 1, height: 1, cx: 0, cy: 0, radius: 1, halfWidth: 1, sizeScale: 1 }

  private lastTime = performance.now()
  /** Duration of the last frame, for inspection. */
  lastDt = 0
  private readonly spring: SpringState = { value: 0, velocity: 0 }
  private readonly themes = CITIES.map((_, i) => themeFrom(i))
  private readonly orientations = CITIES.map((c) => orientationFor(c.lat, c.lon))
  private readonly theme = themeFrom(0)
  private readonly targetTheme = themeFrom(0)
  private readonly sunDir = new THREE.Vector3()
  private readonly targetSun = new THREE.Vector3()
  private readonly orientation = new THREE.Quaternion()
  private readonly targetOrientation = new THREE.Quaternion()
  private readonly drag = { yaw: 0, pitch: 0, active: false, lastX: 0, lastY: 0, startX: 0, startY: 0, idle: 0 }
  private readonly keyLight = new THREE.DirectionalLight(0xffffff, 2.2)
  private readonly rimLight = new THREE.DirectionalLight(0xffffff, 1.2)
  private readonly hemi = new THREE.HemisphereLight(0xffffff, 0x221a1a, 0.6)
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly cssColors = { top: new THREE.Color(), bottom: new THREE.Color() }
  private readonly targetCss = { top: new THREE.Color(), bottom: new THREE.Color() }
  private shown = -1
  private envelope = 0
  /** Validation hook: orbits follow scroll exactly, with no speed limit. */
  snapChoreography = false
  private transit = 0
  private transitRelease = 0
  private transitEdge = 0
  private elapsed = 0
  private frame = 0
  private disposed = false
  private cityWeights = CITIES.map(() => 0)
  private readonly guides = new OrbitGuides()

  onMarkerClick?: (index: number) => void

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.autoClear = false
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    const loader = new THREE.TextureLoader()
    this.globe = new Globe(loader, this.renderer.capabilities.getMaxAnisotropy())
    this.scene.add(this.globe.group)
    this.scene.add(this.guides.group)

    for (const light of [this.keyLight, this.rimLight, this.hemi]) {
      light.layers.enableAll()
      this.scene.add(light)
    }

    this.cities = [createTokyo(), createCairo(), createParis(), createNewYork(), createUshuaia()]
    this.cities.forEach((c, i) => {
      addLandmarks(c, landmarksFor(CITIES[i].id), loader)
      this.scene.add(c.group)
    })

    this.raycaster.layers.set(LAYER.GLOBE)

    const start = journey.target
    this.spring.value = start
    this.snapTo(start)

    this.resize()
    this.bindPointer()
  }

  /** Initialise every damped value at a journey position without easing. */
  private snapTo(cityFloat: number) {
    this.computeTargets(cityFloat)
    this.copyTheme(this.theme, this.targetTheme)
    this.sunDir.copy(this.targetSun)
    this.orientation.copy(this.targetOrientation)
    this.cssColors.top.copy(this.targetCss.top)
    this.cssColors.bottom.copy(this.targetCss.bottom)
  }

  resize() {
    const width = window.innerWidth
    const height = window.innerHeight
    const mobile = width < 700
    const tablet = !mobile && width < 1100
    // Globe radius in CSS pixels; keeps the Earth dominant but never clipped.
    const radius = mobile
      ? Math.min(width * 0.36, height * 0.2)
      : tablet
        ? Math.min(width * 0.27, height * 0.27)
        : Math.min(height * 0.28, width * 0.21)
    const cy = mobile ? height * 0.4 : height * 0.44
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const distance = Math.sqrt(1 + Math.pow(height / (2 * radius * tanHalf), 2))
    this.camera.aspect = width / height
    this.camera.position.set(0, 0, distance)
    this.camera.lookAt(0, 0, 0)
    // Shift the projection so the globe centre lands at (width/2, cy).
    this.camera.setViewOffset(width, height, 0, height / 2 - cy, width, height)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)

    const worldPerPx = (distance * tanHalf * 2) / height
    // Lowest point choreography may reach: above the solar navigation.
    const nav = document.querySelector('.solar')?.getBoundingClientRect()
    const floorPx = nav ? nav.top - 10 : height * 0.86
    orbitView.distance = distance
    orbitView.floorY = -(floorPx - cy) * worldPerPx
    // Copy keep-out applies where the copy sits beside the globe (not on
    // phones, where it sits beneath it across the full width).
    const copy = document.querySelector('.copy')?.getBoundingClientRect()
    if (copy && !mobile) {
      orbitView.copyTopY = -(copy.top - 12 - cy) * worldPerPx
      orbitView.copyRightX = (copy.right + 12 - width / 2) * worldPerPx
    } else {
      orbitView.copyTopY = -Infinity
      orbitView.copyRightX = -Infinity
    }
    const halfWidth = (width / 2) * worldPerPx
    const sizeScale = clamp(halfWidth / 2.3, 0.62, 1)
    this.layout = { width, height, cx: width / 2, cy, radius, halfWidth, sizeScale }
  }

  private bindPointer() {
    const c = this.canvas
    c.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.hitsGlobe(e.clientX, e.clientY)) return
    this.drag.active = true
    this.drag.lastX = this.drag.startX = e.clientX
    this.drag.lastY = this.drag.startY = e.clientY
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.drag.active) {
      const dx = e.clientX - this.drag.lastX
      const dy = e.clientY - this.drag.lastY
      this.drag.lastX = e.clientX
      this.drag.lastY = e.clientY
      const k = 1.6 / this.layout.radius
      this.drag.yaw = clamp(this.drag.yaw + dx * k * 0.5, -Math.PI, Math.PI)
      this.drag.pitch = clamp(this.drag.pitch + dy * k * 0.5, -0.9, 0.9)
      this.drag.idle = 0
      this.canvas.style.cursor = 'grabbing'
      return
    }
    this.canvas.style.cursor = this.markerAt(e.clientX, e.clientY) >= 0 ? 'pointer' : this.hitsGlobe(e.clientX, e.clientY) ? 'grab' : ''
  }

  private onPointerUp = (e: PointerEvent) => {
    if (!this.drag.active) return
    this.drag.active = false
    this.canvas.style.cursor = ''
    const moved = Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY)
    if (moved < 6) {
      const index = this.markerAt(e.clientX, e.clientY)
      if (index >= 0) this.onMarkerClick?.(index)
    }
  }

  private hitsGlobe(x: number, y: number) {
    const { cx, cy, radius } = this.layout
    return Math.hypot(x - cx, y - cy) < radius * 1.04
  }

  /** Index of the front-facing city marker under a viewport point, or -1. */
  markerAt(x: number, y: number) {
    this.pointer.set((x / this.layout.width) * 2 - 1, -(y / this.layout.height) * 2 + 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObjects(this.globe.markers, false)
    const world = new THREE.Vector3()
    for (const h of hits) {
      h.object.getWorldPosition(world)
      if (world.z > 0.15) return h.object.userData.cityIndex as number
    }
    return -1
  }

  /** Screen position of a city marker and whether it faces the viewer. */
  markerScreen(index: number) {
    const world = new THREE.Vector3()
    this.globe.markers[index].getWorldPosition(world)
    const facing = world.z > 0.15
    world.project(this.camera)
    return {
      x: ((world.x + 1) / 2) * this.layout.width,
      y: ((1 - world.y) / 2) * this.layout.height,
      facing,
    }
  }

  private copyTheme(out: GlobeTheme, from: GlobeTheme) {
    out.light.copy(from.light)
    out.atmosphere.copy(from.atmosphere)
    out.rim.copy(from.rim)
    out.surfaceTint.copy(from.surfaceTint)
    out.cityLights.copy(from.cityLights)
    out.cloudOpacity = from.cloudOpacity
    out.lightsStrength = from.lightsStrength
    out.exposure = from.exposure
  }

  /** Targets for a journey position: theme, sun, globe orientation, sky. */
  private computeTargets(cityFloat: number) {
    const { active, local } = splitCityFloat(cityFloat)
    const next = Math.min(active + 1, CITY_COUNT - 1)
    const w = active === next ? 0 : handoverWeight(local)
    const a = this.themes[active]
    const b = this.themes[next]
    const t = this.targetTheme
    t.light.copy(a.light).lerp(b.light, w)
    t.atmosphere.copy(a.atmosphere).lerp(b.atmosphere, w)
    t.rim.copy(a.rim).lerp(b.rim, w)
    t.surfaceTint.copy(a.surfaceTint).lerp(b.surfaceTint, w)
    t.cityLights.copy(a.cityLights).lerp(b.cityLights, w)
    t.cloudOpacity = a.cloudOpacity + (b.cloudOpacity - a.cloudOpacity) * w
    t.lightsStrength = a.lightsStrength + (b.lightsStrength - a.lightsStrength) * w
    t.exposure = a.exposure + (b.exposure - a.exposure) * w

    this.targetOrientation.copy(this.orientations[active]).slerp(this.orientations[next], w)

    // The sun follows the solar arc: rising left, overhead at Paris, setting right.
    const angle = Math.PI * solarT(cityFloat)
    this.targetSun.set(-Math.cos(angle) * 0.95, 0.12 + Math.sin(angle) * 0.6, 1.05).normalize()

    const ca = CITIES[active].theme
    const cb = CITIES[next].theme
    this.targetCss.top.set(ca.skyTop).lerp(new THREE.Color(cb.skyTop), w)
    this.targetCss.bottom.set(ca.skyBottom).lerp(new THREE.Color(cb.skyBottom), w)

    this.cityWeights = CITIES.map((_, i) => (i === active ? 1 - w : i === next ? w : 0))
  }

  tick = () => {
    if (this.disposed) return
    const now = performance.now()
    const dt = Math.min((now - this.lastTime) / 1000, 1 / 20)
    this.lastTime = now
    this.lastDt = dt
    const reduced = journey.reducedMotion
    this.elapsed += reduced ? 0 : dt
    this.frame++

    // Journey position: critically damped, speed-limited so jumps between
    // distant cities stay paced rather than snapping.
    if (reduced) {
      this.spring.value = journey.target
      this.spring.velocity = 0
    } else {
      // A large gap between scroll and journey (scrollbar drag, End key, a
      // hard fling) is treated like a click jump to wherever the scroll is.
      if (Math.abs(journey.target - this.spring.value) > 0.4 && !journey.jumping) {
        journey.jumping = true
        journey.followTarget = true
      }
      if (journey.jumping && journey.followTarget) journey.destination = journey.target
      // During a click jump the journey waits at the edge of the city on
      // screen until its objects have gone round behind the Earth, so a
      // city's landmarks never linger once the next city's light arrives.
      let target = journey.target
      const shown = this.cities[this.shown]
      if (journey.jumping && shown && !shown.allHidden()) {
        target = clamp(target, this.shown + 0.002, this.shown + 0.998)
      }
      smoothDamp(this.spring, target, 0.42, dt, 2.4)
    }
    const cityFloat = this.spring.value
    publish(cityFloat)
    this.computeTargets(cityFloat)

    // Second-order smoothing for look and orientation absorbs fast jumps.
    const look = reduced ? 1 : dampFactor(4.5, dt)
    const t = this.theme
    const g = this.targetTheme
    t.light.lerp(g.light, look)
    t.atmosphere.lerp(g.atmosphere, look)
    t.rim.lerp(g.rim, look)
    t.surfaceTint.lerp(g.surfaceTint, look)
    t.cityLights.lerp(g.cityLights, look)
    t.cloudOpacity = damp(t.cloudOpacity, g.cloudOpacity, 4.5, reduced ? 1e3 : dt)
    t.lightsStrength = damp(t.lightsStrength, g.lightsStrength, 4.5, reduced ? 1e3 : dt)
    t.exposure = damp(t.exposure, g.exposure, 4.5, reduced ? 1e3 : dt)
    this.sunDir.lerp(this.targetSun, look).normalize()
    this.cssColors.top.lerp(this.targetCss.top, look)
    this.cssColors.bottom.lerp(this.targetCss.bottom, look)

    // Drag offsets ease home after a pause so the active city recentres.
    if (!this.drag.active) {
      this.drag.idle += dt
      if (this.drag.idle > 1.6) {
        this.drag.yaw = damp(this.drag.yaw, 0, 1.4, dt)
        this.drag.pitch = damp(this.drag.pitch, 0, 1.4, dt)
      }
    }
    this.orientation.slerp(this.targetOrientation, reduced ? 1 : dampFactor(3.2, dt))
    const dragQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.drag.pitch, this.drag.yaw, 0, 'YXZ'))
    // Very slow ambient turn keeps the Earth alive between scroll moves.
    const drift = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), reduced ? 0 : Math.sin(this.elapsed * 0.05) * 0.06)
    this.globe.spin.quaternion.copy(dragQ).multiply(drift).multiply(this.orientation)

    this.globe.update(dt, this.elapsed, this.theme, this.sunDir, this.cityWeights, reduced)
    this.guides.update(this.elapsed, cityFloat, this.theme.atmosphere)
    sharedLight.color.copy(this.theme.light)
    sharedLight.dir.copy(this.sunDir)

    this.keyLight.position.copy(this.sunDir).multiplyScalar(6)
    this.keyLight.color.copy(this.theme.light)
    this.rimLight.position.set(-this.sunDir.x * 4, 2, -5)
    this.rimLight.color.copy(this.theme.rim)
    this.hemi.color.copy(this.theme.light).lerp(new THREE.Color(1, 1, 1), 0.5)
    this.renderer.toneMappingExposure = 1.05 * this.theme.exposure

    this.updateChoreography(cityFloat, dt, reduced)

    const root = document.documentElement.style
    root.setProperty('--sky-top', `#${this.cssColors.top.getHexString()}`)
    root.setProperty('--sky-bottom', `#${this.cssColors.bottom.getHexString()}`)
    root.setProperty('--key-light', `#${this.theme.light.getHexString()}`)

    this.render()
  }

  /**
   * City ownership. The journey's active city drives copy, light and globe;
   * the choreography root shown on screen only hands over once every object
   * of the outgoing city has travelled round behind the Earth. Exactly one
   * root is visible at any time.
   */
  private updateChoreography(cityFloat: number, dt: number, reduced: boolean) {
    const { active, local } = journey.snapshot
    const snap = reduced || this.snapChoreography
    // A click-initiated jump still travelling toward its destination.
    // The jump ends only once the journey has come to rest at its destination.
    const settled = Math.abs(journey.destination - cityFloat) < 0.01 && Math.abs(this.spring.velocity) < 0.03
    // A scroll-detected jump ends once the journey has caught up; orbits then
    // rejoin the scroll smoothly.
    const caughtUp = journey.followTarget ? Math.abs(journey.target - cityFloat) < 0.15 : settled
    if (journey.jumping && caughtUp) journey.jumping = false
    const jumping = journey.jumping
    // The envelope is already a smooth function of scroll; it is only eased
    // when an outgoing city is retired mid-way through a jump.
    const ctx = (cityLocal: number, envelope: number, mode: OrbitMode, ease = false): FrameContext => {
      this.envelope = ease && !snap ? damp(this.envelope, envelope, 10, dt) : envelope
      return {
        local: cityLocal,
        envelope: this.envelope,
        elapsed: this.elapsed,
        dt,
        mode: snap ? 'snap' : mode,
        sizeScale: this.layout.sizeScale,
        reducedMotion: reduced,
        halfWidth: this.layout.halfWidth,
        light: this.theme.light,
        sunDir: this.sunDir,
      }
    }

    if (this.shown < 0) this.show(active, local < 0.5 ? Math.PI : -Math.PI, cityFloat)

    if (active !== this.shown) {
      // Retire the outgoing city: its orbits carry on, at a believable pace,
      // to the exit pole behind the Earth before the next city takes over.
      const forward = active > this.shown
      const outgoing = this.cities[this.shown]
      outgoing.update(ctx(forward ? 1 : 0, 0, 'limited', true))
      if (!outgoing.allHidden() || this.envelope > 0.02) return
      this.show(active, forward ? Math.PI : -Math.PI, cityFloat)
    }

    // Leaving this city on a click jump: its objects head for the exit pole
    // in the direction of travel. Parked objects are already behind the
    // Earth, so they are moved to that pole directly.
    const city = this.cities[active]
    if (jumping && Math.floor(journey.destination) !== active) {
      const exitEdge = journey.destination > active ? 1 : 0
      if (this.transit >= 0.999 && this.transitEdge !== exitEdge && city.allHidden()) {
        city.park(exitEdge === 0 ? Math.PI : -Math.PI)
        this.transitEdge = exitEdge
      }
      city.update(ctx(exitEdge, 0, 'limited', true))
      return
    }

    if (this.transit > 0) {
      // Arrival is judged against the click's destination, not the scroll
      // position, which can sweep through a city on its way elsewhere.
      const goal = journey.jumping ? journey.destination : journey.target
      const arrived = Math.abs(goal - cityFloat) < 0.12 && Math.floor(goal) === active
      // While fully parked, both ends of the city are equally hidden poles
      // behind the Earth, so the park point may follow the nearer end: the
      // orbits are moved between poles directly, never round the front.
      if (this.transit >= 0.999) {
        const edge = local < 0.5 ? 0 : 1
        if (edge !== this.transitEdge && this.cities[active].allHidden()) {
          this.transitEdge = edge
          this.cities[active].park(edge === 0 ? Math.PI : -Math.PI)
        }
      }
      // On arrival the parked choreography eases (in and out) onto the scroll.
      if (arrived) {
        this.transitRelease = Math.min(1, this.transitRelease + dt / 1.4)
        this.transit = this.transitRelease >= 1 ? 0 : 1 - smootherstep(0, 1, this.transitRelease)
      }
    }
    const choreoLocal = local + (this.transitEdge - local) * this.transit
    const mode: OrbitMode = jumping ? 'limited' : 'follow'
    city.update(ctx(choreoLocal, cityEnvelope(local) * (1 - this.transit), mode, jumping))
  }

  /** Make a city's root the visible one, its orbits starting hidden. */
  private show(index: number, pole: number, cityFloat: number) {
    this.cities.forEach((c, i) => (c.group.visible = i === index))
    this.cities[index].park(pole)
    // Transit: when a jump carries the journey through or deep into a city,
    // its choreography stays parked behind the Earth instead of whipping
    // round its orbits.
    const far = Math.abs(journey.destination - cityFloat) > 0.5
    this.transit = this.shown >= 0 && far && journey.jumping ? 1 : 0
    this.transitRelease = 0
    this.transitEdge = pole > 0 ? 0 : 1
    this.envelope = 0
    this.shown = index
  }

  /**
   * Inspection data for validation: every visible choreography object of the
   * active city with its layer, opacity and projected overlap with the Earth.
   */
  inspect() {
    const { active, local } = journey.snapshot
    const shown = this.shown
    const v = new THREE.Vector3()
    const box = new THREE.Box3()
    const { cx, cy, radius } = this.layout
    const visibleRoots = this.cities.filter((c) => c.group.visible).map((c) => c.id)
    const motifs = this.cities[shown].motifs.map((m) => {
      const s = m.tracker.sample
      box.setFromObject(m.object)
      // Project the 8 box corners to get a screen rect.
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(this.camera)
        const sx = ((v.x + 1) / 2) * this.layout.width
        const sy = ((1 - v.y) / 2) * this.layout.height
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy)
      }
      const nx = Math.max(x0, Math.min(cx, x1))
      const ny = Math.max(y0, Math.min(cy, y1))
      const overlapsDisc = Math.hypot(nx - cx, ny - cy) < radius
      const insideDisc = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].every(([x, y]) => Math.hypot(x - cx, y - cy) < radius)
      return {
        name: m.object.name || m.object.type,
        visible: m.object.visible,
        layer: s.layer === LAYER.FRONT ? 'front' : 'rear',
        z: +s.position.z.toFixed(3),
        opacity: +s.opacity.toFixed(3),
        rect: [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)],
        overlapsDisc,
        insideDisc,
      }
    })
    return { active, shown, local: +local.toFixed(4), visibleRoots, layout: this.layout, motifs }
  }

  private render() {
    const r = this.renderer
    r.clear()
    this.camera.layers.set(LAYER.REAR)
    r.render(this.scene, this.camera)
    r.clearDepth()
    this.camera.layers.set(LAYER.GLOBE)
    r.render(this.scene, this.camera)
    r.clearDepth()
    this.camera.layers.set(LAYER.FRONT)
    r.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    this.renderer.dispose()
  }
}
