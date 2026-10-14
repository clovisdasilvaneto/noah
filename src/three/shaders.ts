import * as THREE from 'three'
import { P } from './bricks'

/**
 * LEGO baseplate: studs are drawn procedurally in the fragment shader so a
 * huge ground costs a single quad. Lighting is a cheap half-lambert + fog.
 */
export function baseplateMaterial(color: THREE.ColorRepresentation, fogColor: THREE.ColorRepresentation, fogNear: number, fogFar: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uFog: { value: new THREE.Color(fogColor) },
      uFogNear: { value: fogNear },
      uFogFar: { value: fogFar },
      uSun: { value: new THREE.Vector3(0.5, 0.8, 0.35).normalize() },
      uPitch: { value: P },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying float vDepth;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vec4 mv = viewMatrix * w;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uFog, uSun;
      uniform float uFogNear, uFogFar, uPitch;
      varying vec3 vWorld;
      varying float vDepth;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 cell = vWorld.xz / uPitch;
        vec2 id = floor(cell);
        vec2 f = fract(cell) - 0.5;
        float d = length(f);
        // fade studs with distance to avoid shimmering (and save the eye)
        float lod = 1.0 - smoothstep(14.0, 26.0, vDepth);
        float studMask = (1.0 - smoothstep(0.28, 0.32, d)) * lod;
        // fake stud normal: top lit, rim dark on the far side of the sun
        vec2 sunXZ = normalize(uSun.xz);
        float edge = smoothstep(0.2, 0.3, d) * studMask;
        float shade = 1.0 + studMask * 0.06 - edge * (0.18 + 0.18 * dot(normalize(f + 1e-4), -sunXZ));
        // grid seams between plates
        vec2 g = abs(fract(vWorld.xz / (uPitch * 8.0)) - 0.5);
        float seam = 1.0 - smoothstep(0.494, 0.5, max(g.x, g.y)) * 0.12 * lod;
        float tint = 0.94 + hash(floor(vWorld.xz / (uPitch * 8.0))) * 0.08;
        vec3 col = uColor * shade * seam * tint;
        col *= 0.55 + 0.5 * max(dot(vec3(0.0, 1.0, 0.0), uSun), 0.0);
        float fog = smoothstep(uFogNear, uFogFar, vDepth);
        gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}

/** Vertical gradient sky dome with a soft sun glow. */
export function skyMaterial(top: string, horizon: string, sun: string, sunDir: THREE.Vector3) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uHorizon: { value: new THREE.Color(horizon) },
      uSunCol: { value: new THREE.Color(sun) },
      uSunDir: { value: sunDir.clone().normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uSunCol, uSunDir;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(h, 0.6));
        float s = max(dot(vDir, uSunDir), 0.0);
        col += uSunCol * (pow(s, 64.0) * 1.2 + pow(s, 6.0) * 0.25);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
}

/** Additive heavenly light shaft. Scrolling bands + edge fade, no textures. */
export function beamMaterial(color: string, intensity = 1) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFres;
      void main() {
        vUv = uv;
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFres = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uIntensity;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying float vFres;
      void main() {
        float bands = 0.65 + 0.35 * sin(vUv.x * 40.0 + uTime * 0.7) * sin(vUv.x * 17.0 - uTime * 0.4);
        float flow = 0.75 + 0.25 * sin(vUv.y * 12.0 - uTime * 2.0);
        float vertical = smoothstep(0.0, 0.15, vUv.y) * (1.0 - smoothstep(0.6, 1.0, vUv.y));
        float a = pow(vFres, 1.5) * bands * flow * vertical * uIntensity;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  })
}

/**
 * Floating motes / sparkles. All motion happens in the vertex shader from
 * a time uniform, so hundreds of particles cost zero CPU per frame.
 */
export function motesMaterial(color: string, size: number, rise: number, height: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uSize: { value: size },
      uRise: { value: rise },
      uHeight: { value: height },
      uPixelRatio: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uSize, uRise, uHeight, uPixelRatio;
      attribute float aSeed;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float t = uTime * uRise + aSeed * uHeight;
        p.y = mod(p.y + t, uHeight);
        p.x += sin(uTime * 0.6 + aSeed * 6.28) * 0.4;
        p.z += cos(uTime * 0.5 + aSeed * 4.0) * 0.4;
        vAlpha = smoothstep(0.0, 0.15, p.y / uHeight) * (1.0 - smoothstep(0.7, 1.0, p.y / uHeight));
        vAlpha *= 0.6 + 0.4 * sin(uTime * 3.0 + aSeed * 30.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // clamp so motes drifting past the lens don't become giant blobs
        gl_PointSize = min(uSize * uPixelRatio * (60.0 / -mv.z), 22.0 * uPixelRatio);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  })
}
