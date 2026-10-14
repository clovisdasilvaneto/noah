import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** One stud pitch in world units. A 1x1 brick is P wide, BH tall. */
export const P = 0.4
export const BH = 0.48
export const PLATE = BH / 3

const geoCache = new Map<string, THREE.BufferGeometry>()

let studGeo: THREE.BufferGeometry | null = null
function stud() {
  if (!studGeo) studGeo = new THREE.CylinderGeometry(P * 0.3, P * 0.3, P * 0.17, 10, 1, false)
  return studGeo
}

/**
 * A brick of w x d studs and h brick-heights (h=1/3 is a plate). Origin sits at
 * the bottom centre so bricks stack by adding heights.
 */
export function brickGeometry(w: number, d: number, h = 1, studs = true): THREE.BufferGeometry {
  const key = `${w}|${d}|${h}|${studs}`
  const hit = geoCache.get(key)
  if (hit) return hit
  const height = h * BH
  const body = new THREE.BoxGeometry(w * P - 0.012, height, d * P - 0.012)
  body.translate(0, height / 2, 0)
  const parts: THREE.BufferGeometry[] = [body]
  // Very large bricks skip studs to stay cheap on mobile GPUs.
  if (studs && w * d <= 48) {
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < d; j++) {
        const s = stud().clone()
        s.translate((i - (w - 1) / 2) * P, height + P * 0.085, (j - (d - 1) / 2) * P)
        parts.push(s)
      }
    }
  }
  const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()), false)!
  merged.computeVertexNormals()
  geoCache.set(key, merged)
  return merged
}

const matCache = new Map<string, THREE.MeshStandardMaterial>()

/**
 * Glossy ABS plastic: low roughness PBR plus a warm fresnel rim, the look of
 * the LEGO games. All plastic materials share one compiled shader program.
 */
export function plastic(color: THREE.ColorRepresentation, opts: { emissive?: number; rough?: number } = {}) {
  const c = new THREE.Color(color)
  const key = `${c.getHexString()}|${opts.emissive ?? 0}|${opts.rough ?? 0.32}`
  const hit = matCache.get(key)
  if (hit) return hit
  const m = new THREE.MeshStandardMaterial({
    color: c,
    roughness: opts.rough ?? 0.32,
    metalness: 0,
    emissive: opts.emissive ? c : new THREE.Color(0),
    emissiveIntensity: opts.emissive ?? 0,
  })
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
      gl_FragColor.rgb += rimF * 0.22 * vec3(1.0, 0.94, 0.82);`,
    )
  }
  m.customProgramCacheKey = () => 'plastic-rim'
  matCache.set(key, m)
  return m
}

export const COLORS = {
  green: '#3d9b3a',
  darkGreen: '#2a6e2c',
  lime: '#8ec63f',
  brown: '#7a4a24',
  reddishBrown: '#6b3a1e',
  tan: '#d8b47a',
  darkTan: '#a58357',
  sand: '#e8d29c',
  white: '#f4f4f0',
  grey: '#a0a5a9',
  darkGrey: '#5b6066',
  black: '#1d1d1f',
  yellow: '#f5c518',
  skin: '#f6d23c',
  red: '#c9292f',
  blue: '#1e5aa8',
  orange: '#e57a1f',
  gold: '#e8b923',
  gopher: '#b9783c',
  pitch: '#26201c',
}

let vcMat: THREE.MeshStandardMaterial | null = null
/** Plastic driven by per-vertex colours, so a whole multi-coloured figure part is one draw. */
export function plasticVC() {
  if (vcMat) return vcMat
  vcMat = plastic('#ffffff').clone()
  vcMat.vertexColors = true
  vcMat.onBeforeCompile = plastic('#ffffff').onBeforeCompile
  vcMat.customProgramCacheKey = () => 'plastic-rim-vc'
  return vcMat
}

/**
 * Shared uniforms for see-through occluders. The camera rig writes Noah's
 * screen position (drawing-buffer pixels) and view depth each frame.
 */
export const occlusion = {
  uOccPlayer: { value: new THREE.Vector2(-9999, -9999) },
  uOccDepth: { value: 0 },
  uOccRadius: { value: 140 },
}

const fadeCache = new Map<string, THREE.MeshStandardMaterial>()

/**
 * Plastic that dithers away where it stands between the camera and Noah,
 * like scenery in the LEGO games. Screen-door transparency keeps it opaque
 * (no sorting, no blending cost).
 */
export function plasticFade(color: THREE.ColorRepresentation) {
  const c = new THREE.Color(color)
  const key = c.getHexString()
  const hit = fadeCache.get(key)
  if (hit) return hit
  const m = plastic(color).clone()
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, occlusion)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform vec2 uOccPlayer;
        uniform float uOccDepth;
        uniform float uOccRadius;
        float bayer4(vec2 p) {
          vec2 q = mod(floor(p), 4.0);
          int i = int(q.x) + int(q.y) * 4;
          int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
          return (float(m[i]) + 0.5) / 16.0;
        }
        void main() {
          float occD = length(gl_FragCoord.xy - uOccPlayer);
          if (occD < uOccRadius && vViewPosition.z < uOccDepth - 0.6) {
            float fade = smoothstep(uOccRadius, uOccRadius * 0.55, occD) * 0.85;
            if (bayer4(gl_FragCoord.xy) < fade) discard;
          }`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
        gl_FragColor.rgb += rimF * 0.22 * vec3(1.0, 0.94, 0.82);`,
      )
  }
  m.customProgramCacheKey = () => 'plastic-fade'
  fadeCache.set(key, m)
  return m
}

let blobTex: THREE.Texture | null = null
/** Soft radial gradient used for cheap blob shadows (no shadow maps). */
export function blobTexture() {
  if (blobTex) return blobTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(0,0,0,0.55)')
  grad.addColorStop(0.6, 'rgba(0,0,0,0.25)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  blobTex = new THREE.CanvasTexture(c)
  return blobTex
}

let blobMat: THREE.MeshBasicMaterial | null = null
export function blobMaterial() {
  if (!blobMat) blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })
  return blobMat
}

export const planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
