// Brick-built animals. Each model is a handful of merged, vertex-coloured
// meshes sharing one plastic material: body, head (on a neck pivot), tail,
// two diagonal leg pairs (trot), and optional ears that flap. Built once per
// species and cached.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BH, COLORS, brickGeometry } from '../../three/bricks'
import type { SpeciesId } from '../../i18n/animals'

type V3 = [number, number, number]

export type Part = { geo: THREE.BufferGeometry; pivot: V3 }
export type AnimalModel = {
  body: THREE.BufferGeometry
  head: Part
  tail: Part | null
  legsA: THREE.BufferGeometry
  legsB: THREE.BufferGeometry
  earL: Part | null
  earR: Part | null
  /** world-space height of the top of the head, for icons/bubbles */
  height: number
  shadow: number
}

const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpE = new THREE.Euler()
const tmpC = new THREE.Color()
const ONE = new THREE.Vector3(1, 1, 1)
const tmpV = new THREE.Vector3()

function paint(src: THREE.BufferGeometry, color: string, pos: V3, rot: V3 = [0, 0, 0]) {
  const g = (src.index ? src.toNonIndexed() : src.clone()).applyMatrix4(tmpM.compose(tmpV.set(...pos), tmpQ.setFromEuler(tmpE.set(...rot)), ONE))
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k)
  tmpC.set(color)
  const n = g.attributes.position.count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    col[i * 3] = tmpC.r
    col[i * 3 + 1] = tmpC.g
    col[i * 3 + 2] = tmpC.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

/** A LEGO brick of w x d studs and h bricks; position is its bottom centre (world units). */
export const brick = (w: number, d: number, h: number, color: string, pos: V3, studs = true, rot: V3 = [0, 0, 0]) =>
  paint(brickGeometry(w, d, h, studs), color, pos, rot)
/** A plain box centred on pos. */
export const box = (sx: number, sy: number, sz: number, color: string, pos: V3, rot: V3 = [0, 0, 0]) =>
  paint(new THREE.BoxGeometry(sx, sy, sz), color, pos, rot)
const eyeGeo = new THREE.SphereGeometry(1, 8, 6)
const eye = (r: number, pos: V3, color = COLORS.black) => paint(eyeGeo.clone().scale(r, r, r), color, pos)
const cone = (r: number, h: number, color: string, pos: V3, rot: V3 = [0, 0, 0]) => paint(new THREE.ConeGeometry(r, h, 8), color, pos, rot)

export function merge(parts: THREE.BufferGeometry[], scale = 1) {
  const g = mergeGeometries(parts, false)!
  g.scale(scale, scale, scale)
  return g
}
const sv = (v: V3, s: number): V3 => [v[0] * s, v[1] * s, v[2] * s]

type Draft = {
  scale: number
  body: THREE.BufferGeometry[]
  head: { pivot: V3; parts: THREE.BufferGeometry[] }
  tail?: { pivot: V3; parts: THREE.BufferGeometry[] }
  legsA: THREE.BufferGeometry[]
  legsB: THREE.BufferGeometry[]
  earL?: { pivot: V3; parts: THREE.BufferGeometry[] }
  earR?: { pivot: V3; parts: THREE.BufferGeometry[] }
  height: number
  shadow: number
}

function finish(d: Draft): AnimalModel {
  const s = d.scale
  const part = (p?: { pivot: V3; parts: THREE.BufferGeometry[] }) => (p ? { geo: merge(p.parts, s), pivot: sv(p.pivot, s) } : null)
  return {
    body: merge(d.body, s),
    head: part(d.head)!,
    tail: part(d.tail),
    legsA: merge(d.legsA, s),
    legsB: merge(d.legsB, s),
    earL: part(d.earL),
    earR: part(d.earR),
    height: d.height * s,
    shadow: d.shadow,
  }
}

/** Four legs at (±x, ±z): A = front-left + back-right, B = the other diagonal. */
function legs(make: (x: number, z: number) => THREE.BufferGeometry[], x: number, z: number) {
  return { legsA: [...make(-x, z), ...make(x, -z)], legsB: [...make(x, z), ...make(-x, -z)] }
}

/* ------------------------------------------------------------------ */

function lion(maneless: boolean): AnimalModel {
  const fur = '#dca447'
  const light = '#f3d595'
  const mane = '#8a4b1c'
  const legH = 2 * BH
  const body = [brick(2, 4, 1, fur, [0, legH, 0]), brick(2, 3, 1 / 3, light, [0, legH - BH / 3, 0], false)]
  const head: THREE.BufferGeometry[] = []
  if (!maneless) {
    head.push(brick(4, 1, 2, mane, [0, -BH * 0.9, 0]))
    head.push(brick(2, 1, 1 / 3, mane, [0, BH * 1.1, 0]))
  } else {
    head.push(eye(0.09, [-0.26, BH * 0.95, 0.1], fur), eye(0.09, [0.26, BH * 0.95, 0.1], fur))
  }
  head.push(
    brick(2, 2, 1, fur, [0, -BH * 0.55, 0.3]),
    brick(2, 1, 1 / 3, light, [0, -BH * 0.55, 0.62], false),
    box(0.3, 0.14, 0.14, light, [0, -BH * 0.2, 0.66]),
    box(0.16, 0.08, 0.06, COLORS.black, [0, -BH * 0.06, 0.74]),
    eye(0.045, [-0.15, BH * 0.18, 0.705]),
    eye(0.045, [0.15, BH * 0.18, 0.705]),
  )
  if (maneless) head.push(eye(0.08, [-0.27, BH * 0.55, 0.3], fur), eye(0.08, [0.27, BH * 0.55, 0.3], fur))
  else head.push(eye(0.08, [-0.4, BH * 1.05, 0.05], mane), eye(0.08, [0.4, BH * 1.05, 0.05], mane))
  const tail = [box(0.1, 0.1, 0.7, fur, [0, 0.1, -0.35], [0.5, 0, 0]), box(0.2, 0.2, 0.2, mane, [0, -0.08, -0.7])]
  const leg = (x: number, z: number) => [brick(1, 1, 2, fur, [x, 0, z]), box(0.42, 0.12, 0.46, light, [x, 0.06, z + 0.04])]
  return finish({
    scale: 0.62,
    body,
    head: { pivot: [0, legH + BH * 0.95, 0.72], parts: head },
    tail: { pivot: [0, legH + BH * 0.8, -0.8], parts: tail },
    ...legs(leg, 0.2, 0.6),
    height: legH + BH * 2.4,
    shadow: 1.4,
  })
}

function elephant(): AnimalModel {
  const g = '#8f969c'
  const dk = '#6f767d'
  const legH = 2 * BH
  const body = [brick(4, 6, 2, g, [0, legH, 0]), brick(4, 5, 1 / 3, dk, [0, legH - BH / 3, 0], false)]
  const head = [
    brick(4, 2, 2, g, [0, -BH * 1.2, 0.35]),
    brick(2, 1, 1, g, [0, -BH * 1.9, 0.95], false),
    brick(1, 1, 1, g, [0, -BH * 2.85, 1.0], false),
    brick(1, 1, 1, dk, [0, -BH * 3.7, 1.08], false),
    box(0.32, 0.18, 0.36, dk, [0, -BH * 3.75, 1.25]),
    cone(0.07, 0.42, COLORS.white, [-0.34, -BH * 1.75, 0.95], [1.9, 0, 0]),
    cone(0.07, 0.42, COLORS.white, [0.34, -BH * 1.75, 0.95], [1.9, 0, 0]),
    eye(0.055, [-0.44, -BH * 0.35, 0.72]),
    eye(0.055, [0.44, -BH * 0.35, 0.72]),
  ]
  const earMesh = (side: number) => [box(0.1, 1.0, 0.9, '#a5abb1', [side * 0.05, -0.38, -0.32]), box(0.04, 0.8, 0.7, '#d9a3a3', [side * 0.11, -0.38, -0.32])]
  const tail = [box(0.08, 0.6, 0.08, dk, [0, -0.3, -0.05], [-0.3, 0, 0]), box(0.16, 0.18, 0.12, COLORS.black, [0, -0.62, -0.15])]
  const leg = (x: number, z: number) => [brick(2, 2, 2, g, [x, 0, z], false), box(0.84, 0.1, 0.84, '#d8d2c4', [x, 0.05, z])]
  return finish({
    scale: 0.85,
    body,
    head: { pivot: [0, legH + BH * 2.3, 1.2], parts: head },
    tail: { pivot: [0, legH + BH * 1.6, -1.2], parts: tail },
    earL: { pivot: [-0.8, legH + BH * 2.35, 1.4], parts: earMesh(-1) },
    earR: { pivot: [0.8, legH + BH * 2.35, 1.4], parts: earMesh(1) },
    ...legs(leg, 0.4, 0.8),
    height: legH + BH * 3,
    shadow: 2.4,
  })
}

function giraffe(): AnimalModel {
  const y = '#f2c14e'
  const spot = '#a35b1c'
  const legH = 4 * BH
  const body = [brick(2, 4, 1, y, [0, legH, 0])]
  for (const [sx, sz, sy] of [
    [1, 0.45, 0.3],
    [1, -0.4, 0.15],
    [-1, 0.2, 0.25],
    [-1, -0.5, 0.32],
  ])
    body.push(box(0.04, 0.2, 0.26, spot, [sx * 0.405, legH + sy, sz]))
  body.push(box(0.3, 0.06, 0.3, spot, [0.1, legH + BH + 0.1, -0.3]), box(0.3, 0.06, 0.3, spot, [-0.12, legH + BH + 0.1, 0.35]))
  const head: THREE.BufferGeometry[] = []
  for (let i = 0; i < 4; i++) head.push(brick(1, 1, 1, y, [0, i * BH, 0], false))
  head.push(box(0.04, 0.18, 0.2, spot, [0.205, BH * 1.5, 0]), box(0.04, 0.18, 0.2, spot, [-0.205, BH * 2.6, 0]))
  head.push(box(0.1, BH * 3.6, 0.1, spot, [0, BH * 2, -0.22]))
  head.push(
    brick(1, 2, 1, y, [0, BH * 4, 0.2]),
    box(0.36, 0.28, 0.24, '#e0a94a', [0, BH * 4.3, 0.55]),
    eye(0.04, [-0.17, BH * 4.75, 0.25]),
    eye(0.04, [0.17, BH * 4.75, 0.25]),
    brick(1, 1, 1 / 3, spot, [-0.1, BH * 5, 0.05], true),
    box(0.16, 0.1, 0.06, y, [-0.26, BH * 4.9, 0.02]),
    box(0.16, 0.1, 0.06, y, [0.26, BH * 4.9, 0.02]),
  )
  const tail = [box(0.06, 0.55, 0.06, y, [0, -0.27, -0.02], [-0.2, 0, 0]), box(0.12, 0.16, 0.12, spot, [0, -0.6, -0.08])]
  const leg = (x: number, z: number) => [brick(1, 1, 4, y, [x, 0, z], false), box(0.42, 0.12, 0.42, spot, [x, 0.06, z])]
  return finish({
    scale: 0.75,
    body,
    head: { pivot: [0, legH + BH * 0.9, 0.62], parts: head },
    tail: { pivot: [0, legH + BH * 0.9, -0.8], parts: tail },
    ...legs(leg, 0.2, 0.6),
    height: legH + BH * 6,
    shadow: 1.6,
  })
}

function zebra(): AnimalModel {
  const w = '#f6f5f0'
  const k = '#1d1d1f'
  const legH = 2 * BH
  const body = [brick(2, 4, 1, w, [0, legH, 0])]
  for (const z of [-0.6, -0.2, 0.2, 0.6]) body.push(box(0.84, 0.1, 0.1, k, [0, legH + BH * 0.55, z]), box(0.1, 0.36, 0.1, k, [0.38, legH + BH * 0.5, z]), box(0.1, 0.36, 0.1, k, [-0.38, legH + BH * 0.5, z]))
  const head = [
    brick(1, 1, 2, w, [0, -0.1, 0], false),
    box(0.42, 0.06, 0.06, k, [0, 0.35, 0.21]),
    box(0.42, 0.06, 0.06, k, [0, 0.6, 0.21]),
    box(0.1, 0.9, 0.12, k, [0, 0.45, -0.2]),
    brick(1, 2, 1, w, [0, BH * 1.6, 0.25], false),
    box(0.36, 0.3, 0.2, k, [0, BH * 1.85, 0.62]),
    eye(0.04, [-0.17, BH * 2.4, 0.3]),
    eye(0.04, [0.17, BH * 2.4, 0.3]),
    box(0.1, 0.2, 0.06, w, [-0.13, BH * 2.75, 0.1]),
    box(0.1, 0.2, 0.06, w, [0.13, BH * 2.75, 0.1]),
  ]
  const tail = [box(0.07, 0.5, 0.07, w, [0, -0.25, -0.03], [-0.25, 0, 0]), box(0.14, 0.18, 0.14, k, [0, -0.55, -0.1])]
  const leg = (x: number, z: number) => [brick(1, 1, 2, w, [x, 0, z], false), box(0.1, 0.06, 0.42, k, [x, BH, z]), box(0.42, 0.12, 0.42, k, [x, 0.06, z])]
  return finish({
    scale: 0.72,
    body,
    head: { pivot: [0, legH + BH * 0.8, 0.7], parts: head },
    tail: { pivot: [0, legH + BH * 0.8, -0.8], parts: tail },
    ...legs(leg, 0.2, 0.6),
    height: legH + BH * 3.6,
    shadow: 1.4,
  })
}

function sheep(): AnimalModel {
  const wool = '#f4f1ea'
  const k = '#2a2a2c'
  const legH = BH
  const body = [brick(2, 3, 1, wool, [0, legH, 0]), brick(3, 3, 1, wool, [0, legH + 0.06, 0], true, [0, 0, 0])]
  const head = [box(0.4, 0.42, 0.4, k, [0, 0, 0.12]), box(0.3, 0.14, 0.16, wool, [0, 0.27, 0.05]), box(0.18, 0.08, 0.14, k, [-0.26, 0.08, 0.08], [0, 0, 0.5]), box(0.18, 0.08, 0.14, k, [0.26, 0.08, 0.08], [0, 0, -0.5]), eye(0.035, [-0.1, 0.06, 0.33], COLORS.white), eye(0.035, [0.1, 0.06, 0.33], COLORS.white)]
  const tail = [brick(1, 1, 1 / 3, wool, [0, -0.08, -0.08])]
  const leg = (x: number, z: number) => [brick(1, 1, 1, k, [x, 0, z], false)]
  return finish({
    scale: 0.8,
    body,
    head: { pivot: [0, legH + BH * 1.3, 0.62], parts: head },
    tail: { pivot: [0, legH + BH * 1.6, -0.62], parts: tail },
    ...legs(leg, 0.25, 0.4),
    height: legH + BH * 2.3,
    shadow: 1.2,
  })
}

function rabbit(color: string): AnimalModel {
  const inner = '#f2b6c0'
  const legH = BH / 3
  const body = [brick(2, 2, 1, color, [0, legH, 0]), brick(2, 1, 1 / 3, color, [0, legH + BH, -0.2])]
  const head = [brick(2, 2, 1, color, [0, -BH * 0.3, 0.2]), box(0.18, 0.12, 0.1, COLORS.white, [0, -BH * 0.1, 0.62]), box(0.1, 0.07, 0.06, inner, [0, BH * 0.08, 0.64]), eye(0.05, [-0.2, BH * 0.4, 0.58]), eye(0.05, [0.2, BH * 0.4, 0.58])]
  const ear = (side: number) => [brick(1, 1, 2, color, [side * 0.02, 0, 0], false), box(0.05, BH * 1.5, 0.22, inner, [side * 0.02, BH * 1.05, 0.2])]
  const tail = [eye(0.17, [0, 0, -0.08], COLORS.white)]
  const leg = (x: number, z: number) => [box(0.32, legH, 0.4, color, [x, legH / 2, z + 0.05])]
  return finish({
    scale: 0.5,
    body,
    head: { pivot: [0, legH + BH * 1.2, 0.45], parts: head },
    tail: { pivot: [0, legH + BH * 0.6, -0.42], parts: tail },
    earL: { pivot: [-0.2, legH + BH * 1.85, 0.6], parts: ear(-1) },
    earR: { pivot: [0.2, legH + BH * 1.85, 0.6], parts: ear(1) },
    ...legs(leg, 0.22, 0.3),
    height: legH + BH * 4,
    shadow: 0.7,
  })
}

function turtle(): AnimalModel {
  const skin = '#8fae4a'
  const shell = '#2f7a3a'
  const body = [
    brick(4, 4, 1 / 3, '#c9a35a', [0, 0.14, 0], false),
    brick(4, 4, 1, shell, [0, 0.14 + BH / 3, 0], false),
    brick(3, 3, 1 / 3, '#3f9a48', [0, 0.14 + BH * 4 / 3, 0], true),
    box(1.64, 0.08, 1.64, '#6b4a1f', [0, 0.14 + BH / 3 + 0.04, 0]),
  ]
  const head = [box(0.36, 0.3, 0.42, skin, [0, 0, 0.2]), eye(0.045, [-0.15, 0.06, 0.34]), eye(0.045, [0.15, 0.06, 0.34]), box(0.2, 0.03, 0.04, COLORS.black, [0, -0.06, 0.41])]
  const tail = [cone(0.08, 0.26, skin, [0, 0, -0.1], [-Math.PI / 2, 0, 0])]
  const leg = (x: number, z: number) => [box(0.34, 0.2, 0.34, skin, [x * 1.15, 0.1, z * 1.1])]
  return finish({
    scale: 0.55,
    body,
    head: { pivot: [0, 0.4, 0.82], parts: head },
    tail: { pivot: [0, 0.35, -0.82], parts: tail },
    ...legs(leg, 0.62, 0.62),
    height: 1.2,
    shadow: 1.1,
  })
}

const cache = new Map<string, AnimalModel>()
export function animalModel(species: Exclude<SpeciesId, 'doves'>, variant = 0): AnimalModel {
  const key = `${species}|${variant}`
  const hit = cache.get(key)
  if (hit) return hit
  let m: AnimalModel
  switch (species) {
    case 'lions':
      m = lion(variant === 1)
      break
    case 'elephants':
      m = elephant()
      break
    case 'giraffes':
      m = giraffe()
      break
    case 'zebras':
      m = zebra()
      break
    case 'sheep':
      m = sheep()
      break
    case 'rabbits':
      m = rabbit(variant === 1 ? '#efe9df' : '#a77f5d')
      break
    case 'turtles':
      m = turtle()
      break
  }
  cache.set(key, m)
  return m
}

/* ------------------------------------------------------------------ */
/* Doves: three instanced parts (body, left wing, right wing).          */
/* ------------------------------------------------------------------ */

let doveGeos: { body: THREE.BufferGeometry; wingL: THREE.BufferGeometry; wingR: THREE.BufferGeometry } | null = null
export function doveGeometry() {
  if (doveGeos) return doveGeos
  const w = '#fbfbf8'
  const body = mergeGeometries(
    [
      box(0.2, 0.18, 0.36, w, [0, 0, 0]),
      box(0.16, 0.16, 0.16, w, [0, 0.1, 0.2]),
      box(0.06, 0.05, 0.08, COLORS.orange, [0, 0.08, 0.31]),
      eye(0.022, [-0.075, 0.13, 0.25]),
      eye(0.022, [0.075, 0.13, 0.25]),
      box(0.18, 0.04, 0.18, '#e8e8e2', [0, 0.02, -0.25]),
    ],
    false,
  )!
  const wing = (side: number) => mergeGeometries([box(0.34, 0.04, 0.22, w, [side * 0.17, 0, 0]), box(0.12, 0.045, 0.2, '#d9dde2', [side * 0.3, 0, -0.02])], false)!
  doveGeos = { body, wingL: wing(-1), wingR: wing(1) }
  return doveGeos
}

