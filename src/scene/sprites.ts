import * as THREE from 'three'
import type { LandmarkConfig } from '../data/landmarks'
import type { CityRoot } from './cities/common'

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Premultiplied sampling keeps cutout edges free of dark or bright halos.
const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uLight;
  uniform vec3 uSunDir;
  uniform float uOpacity;
  uniform float uFront;
  varying vec2 vUv;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.002) discard;
    vec3 rgb = tex.rgb / tex.a;
    // Grade into the city's light, a touch warmer on the sun-facing side.
    float side = 1.0 + 0.1 * uSunDir.x * (vUv.x - 0.5) * 2.0;
    vec3 graded = rgb * mix(vec3(1.0), uLight, 0.28) * side;
    // Aerial perspective: objects travelling behind the Earth sit back in haze.
    graded *= mix(0.62, 1.0, uFront);
    float a = tex.a * uOpacity;
    gl_FragColor = vec4(graded * a, a);
    #include <colorspace_fragment>
  }
`

export function createLandmarkSprite(config: LandmarkConfig, loader: THREE.TextureLoader) {
  const aspect = config.pixels[0] / config.pixels[1]
  const width = config.height * aspect
  const texture = loader.load(config.src)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.premultiplyAlpha = true
  texture.anisotropy = 4

  const material = new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    uniforms: {
      uMap: { value: texture },
      uLight: { value: new THREE.Color(1, 1, 1) },
      uSunDir: { value: new THREE.Vector3(0, 0, 1) },
      uOpacity: { value: 0 },
      uFront: { value: 0 },
    },
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, config.height), material)
  mesh.name = config.id
  mesh.userData.landmark = config.id
  mesh.frustumCulled = false
  return { mesh, material, width }
}

/** Adds every landmark for a city to its choreography root. */
export function addLandmarks(root: CityRoot, configs: LandmarkConfig[], loader: THREE.TextureLoader) {
  for (const config of configs) {
    const { mesh, material, width } = createLandmarkSprite(config, loader)
    material.userData.baseOpacity = config.opacity ?? 1
    root.addMotif(
      mesh,
      {
        window: config.window,
        side: config.side,
        size: [width, config.height],
        scaleBack: config.scaleBack,
        scaleFront: config.scaleFront,
        yBack: config.yBack,
        yFront: config.yFront,
        focusX: config.focusX,
        depth: config.depth,
        margin: 0.06,
      },
      {
        billboard: true,
        update: (ctx, theta) => {
          const u = material.uniforms
          u.uOpacity.value = material.opacity
          u.uFront.value = (1 + Math.cos(theta)) / 2
          u.uLight.value.copy(ctx.light)
          u.uSunDir.value.copy(ctx.sunDir)
        },
      },
    )
  }
}
