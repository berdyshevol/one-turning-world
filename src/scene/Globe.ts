import * as THREE from 'three'
import { CITIES } from '../data/cities'
import { LAYER } from './layers'

const surfaceVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const surfaceFragment = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uWater;
  uniform vec3 uSunDir;
  uniform vec3 uLight;
  uniform vec3 uTint;
  uniform vec3 uCityLights;
  uniform vec3 uRim;
  uniform float uLightsStrength;
  uniform float uExposure;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewW;

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(vViewW);
    float ndl = dot(n, uSunDir);
    float dayMix = smoothstep(-0.18, 0.28, ndl);

    vec3 day = texture2D(uDay, vUv).rgb;
    day = pow(day, vec3(1.05)) * uTint;
    vec3 lit = day * (0.06 + 1.05 * max(ndl, 0.0)) * mix(vec3(1.0), uLight, 0.35);

    float water = texture2D(uWater, vUv).r;
    vec3 h = normalize(uSunDir + v);
    float spec = pow(max(dot(n, h), 0.0), 90.0) * water * 0.22;
    lit += uLight * spec * dayMix;

    vec3 night = texture2D(uNight, vUv).rgb;
    float lum = dot(night, vec3(0.299, 0.587, 0.114));
    vec3 lights = uCityLights * pow(lum, 1.4) * 1.8 * uLightsStrength;
    vec3 nightBase = day * 0.035 + lights;

    vec3 color = mix(nightBase, lit, dayMix);

    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    color += uRim * fres * 0.45 * smoothstep(0.0, 0.7, ndl);

    color *= uExposure;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

const cloudFragment = /* glsl */ `
  uniform sampler2D uClouds;
  uniform vec3 uSunDir;
  uniform vec3 uLight;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    vec4 c = texture2D(uClouds, vUv);
    // Coverage is stored in the red channel; drop the faint haze.
    float a = smoothstep(0.1, 0.85, c.r);
    float ndl = dot(normalize(vNormalW), uSunDir);
    float lit = smoothstep(-0.25, 0.45, ndl);
    vec3 col = mix(vec3(0.05, 0.06, 0.09), mix(vec3(1.0), uLight, 0.25), lit);
    float fres = 1.0 - max(dot(normalize(vNormalW), normalize(vViewW)), 0.0);
    gl_FragColor = vec4(col, a * uOpacity * (0.35 + 0.65 * lit) * (1.0 - fres * 0.6));
    #include <colorspace_fragment>
  }
`

const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    vec3 n = normalize(vNormalW);
    // Back faces of the shell: n·v runs from 0 at the outer edge to about -0.4
    // where the shell meets the Earth's silhouette.
    float d = dot(n, normalize(vViewW));
    float glow = pow(clamp(-d / 0.4, 0.0, 1.0), 3.0);
    float lit = 0.25 + 0.75 * smoothstep(-0.5, 0.7, dot(n, uSunDir));
    vec3 col = uColor * glow * lit * 0.75;
    // Premultiplied light: alpha tracks brightness so the transparent canvas
    // composites as pure glow over the page sky.
    gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));
    #include <colorspace_fragment>
  }
`

/** Additive light that keeps canvas alpha in step with brightness. */
export const ADDITIVE_PREMULTIPLIED = {
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneFactor,
  premultipliedAlpha: true,
} as const

const WHITE = new THREE.Color(1, 1, 1)
const scratch = new THREE.Vector3()

export interface GlobeTheme {
  light: THREE.Color
  atmosphere: THREE.Color
  rim: THREE.Color
  surfaceTint: THREE.Color
  cityLights: THREE.Color
  cloudOpacity: number
  lightsStrength: number
  exposure: number
}

/** Unit vector on the sphere for a latitude/longitude, matching equirectangular UVs. */
export function latLonToVector(lat: number, lon: number, radius = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat)
  const theta = THREE.MathUtils.degToRad(lon + 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

/** Rotation that brings a lat/lon to face the camera (+Z) with north up. */
export function orientationFor(lat: number, lon: number) {
  const target = latLonToVector(lat, lon).normalize()
  // Yaw first so the meridian faces the viewer, then pitch to the latitude.
  const yaw = Math.atan2(target.x, target.z)
  const pitch = THREE.MathUtils.degToRad(lat)
  const e = new THREE.Euler(pitch, -yaw, 0, 'XYZ')
  return new THREE.Quaternion().setFromEuler(e)
}

export class Globe {
  readonly group = new THREE.Group()
  /** Rotates with the Earth surface; markers live inside it. */
  readonly spin = new THREE.Group()
  readonly markers: THREE.Mesh[] = []
  private readonly markerHalos: THREE.Sprite[] = []
  private readonly surface: THREE.ShaderMaterial
  private readonly clouds: THREE.Mesh
  private readonly cloudMat: THREE.ShaderMaterial
  private readonly atmoMat: THREE.ShaderMaterial
  private readonly markerMats: THREE.MeshBasicMaterial[] = []

  constructor(loader: THREE.TextureLoader, maxAnisotropy: number) {
    const load = (url: string, srgb = true) => {
      const t = loader.load(url)
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
      t.anisotropy = Math.min(8, maxAnisotropy)
      return t
    }

    this.surface = new THREE.ShaderMaterial({
      vertexShader: surfaceVertex,
      fragmentShader: surfaceFragment,
      uniforms: {
        uDay: { value: load('/textures/earth-day.webp') },
        uNight: { value: load('/textures/earth-night.webp') },
        uWater: { value: load('/textures/earth-water.webp', false) },
        uSunDir: { value: new THREE.Vector3(0, 0, 1) },
        uLight: { value: new THREE.Color() },
        uTint: { value: new THREE.Color() },
        uCityLights: { value: new THREE.Color() },
        uRim: { value: new THREE.Color() },
        uLightsStrength: { value: 1 },
        uExposure: { value: 1 },
      },
    })
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), this.surface)
    this.spin.add(sphere)

    this.cloudMat = new THREE.ShaderMaterial({
      vertexShader: surfaceVertex,
      fragmentShader: cloudFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uClouds: { value: load('/textures/clouds.webp') },
        uSunDir: this.surface.uniforms.uSunDir,
        uLight: this.surface.uniforms.uLight,
        uOpacity: { value: 0.5 },
      },
    })
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(1.008, 96, 72), this.cloudMat)
    this.spin.add(this.clouds)

    this.atmoMat = new THREE.ShaderMaterial({
      vertexShader: surfaceVertex,
      fragmentShader: atmosphereFragment,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      ...ADDITIVE_PREMULTIPLIED,
      uniforms: {
        uColor: { value: new THREE.Color() },
        uSunDir: this.surface.uniforms.uSunDir,
      },
    })
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.09, 96, 64), this.atmoMat)
    this.group.add(atmosphere)

    const haloTex = makeHaloTexture()
    const markerGeo = new THREE.SphereGeometry(0.011, 16, 12)
    const hitGeo = new THREE.SphereGeometry(0.07, 8, 6)
    CITIES.forEach((city, i) => {
      const pos = latLonToVector(city.lat, city.lon, 1.004)
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })
      this.markerMats.push(mat)
      const dot = new THREE.Mesh(markerGeo, mat)
      dot.position.copy(pos)
      this.spin.add(dot)

      const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }))
      hit.position.copy(pos)
      hit.userData.cityIndex = i
      this.spin.add(hit)
      this.markers.push(hit)

      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: haloTex,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      halo.position.copy(latLonToVector(city.lat, city.lon, 1.02))
      halo.scale.setScalar(0.09)
      this.spin.add(halo)
      this.markerHalos.push(halo)
    })

    this.group.add(this.spin)
    this.group.traverse((o) => o.layers.set(LAYER.GLOBE))
  }

  update(
    dt: number,
    elapsed: number,
    theme: GlobeTheme,
    sunDir: THREE.Vector3,
    cityWeights: number[],
    reducedMotion: boolean,
  ) {
    const u = this.surface.uniforms
    u.uSunDir.value.copy(sunDir)
    u.uLight.value.copy(theme.light)
    u.uTint.value.copy(theme.surfaceTint)
    u.uCityLights.value.copy(theme.cityLights)
    u.uRim.value.copy(theme.rim)
    u.uLightsStrength.value = theme.lightsStrength
    u.uExposure.value = theme.exposure
    this.cloudMat.uniforms.uOpacity.value = theme.cloudOpacity
    this.atmoMat.uniforms.uColor.value.copy(theme.atmosphere)
    if (!reducedMotion) this.clouds.rotation.y += dt * 0.006

        this.markerHalos.forEach((halo, i) => {
      const w = cityWeights[i]
      const pulse = reducedMotion ? 1 : 1 + Math.sin(elapsed * 2.4) * 0.12
      halo.getWorldPosition(scratch)
      // Hide halos on the far side of the Earth.
      const facing = THREE.MathUtils.smoothstep(scratch.z, -0.05, 0.25)
      halo.scale.setScalar((0.05 + w * 0.12 * pulse) * (0.4 + 0.6 * facing))
      halo.material.opacity = (0.22 + 0.78 * w) * facing
      halo.material.color.copy(theme.cityLights).lerp(WHITE, 0.35 + w * 0.3)
      this.markerMats[i].color.copy(halo.material.color)
      this.markerMats[i].opacity = 0.55 + 0.45 * w
    })
  }
}

function makeHaloTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.12, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.28, 'rgba(255,255,255,0.28)')
  g.addColorStop(0.62, 'rgba(255,255,255,0.06)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
