import * as THREE from 'three'
import { BH, COLORS } from '../../three/bricks'

/** Terrain is built from 4x4 bricks scaled 2x: 3.2 units wide, 0.96 tall per layer. */
export const TERRAIN_SCALE = 2
export const CELL = 1.6 * TERRAIN_SCALE
export const LAYER = BH * TERRAIN_SCALE

/** Mesa top on Ararat where the ark comes to rest (4 layers up). */
export const MESA_LAYERS = 4
export const PL = MESA_LAYERS * LAYER

/** Where the ark rests (its hull's bottom centre) and where it was built. */
export const ARK_REST = new THREE.Vector3(0, PL, -2)
export const ARK_START = new THREE.Vector3(-24, 0, 18)
/** Bezier control for the voyage, so the ark sails a gentle curve. */
export const ARK_VIA = new THREE.Vector3(-20, 0, -4)

/** The far hill where the dove finds the olive tree. */
export const OLIVE = new THREE.Vector3(-36, 3 * LAYER, -4)

/** Highest the flood rises: above every peak (Genesis 7:19–20). */
export const FLOOD_TOP = 14.2

/** Ark deck height and the spot at the bow where Noah sends out the dove (ark-local). */
export const DECK_Y = BH * 4
export const BOW_NOAH = new THREE.Vector3(2.55, DECK_Y, 0.35)

type Peak = { x: number; z: number; h: number; r: number }
const PEAKS: Peak[] = [
  { x: -9, z: -19, h: 14, r: 13 }, // Greater Ararat
  { x: 11, z: -20, h: 10, r: 10 }, // Lesser Ararat
  { x: 32, z: -30, h: 7, r: 9 },
  { x: 40, z: 6, h: 5, r: 8 },
  { x: 22, z: -44, h: 6, r: 9 },
  { x: -16, z: -46, h: 6, r: 9 },
  { x: -32, z: -34, h: 6, r: 9 },
  { x: 30, z: 30, h: 3, r: 7 },
]

/** Integer layer count of the terrain at a cell centre. */
export function terrainLayers(x: number, z: number) {
  const r = Math.hypot(x, z)
  let n = r < 10.5 ? MESA_LAYERS : Math.round(MESA_LAYERS * THREE.MathUtils.clamp((14.5 - r) / 4, 0, 1))
  for (const p of PEAKS) {
    const d = Math.hypot(x - p.x, z - p.z)
    n = Math.max(n, Math.round(p.h * Math.pow(THREE.MathUtils.clamp(1 - d / p.r, 0, 1), 0.85)))
  }
  // olive hill: a flat top of 3 layers
  const o = Math.hypot(x - OLIVE.x, z - OLIVE.z)
  n = Math.max(n, o < 3.5 ? 3 : o < 6.5 ? 2 : o < 8.5 ? 1 : 0)
  return n
}

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export type TerrainBrick = { p: [number, number, number]; c: string }

/** Terraced brick heightfield: only bricks that can be seen (tops and exposed sides). */
export function buildTerrain(): TerrainBrick[] {
  const out: TerrainBrick[] = []
  const N = 15
  for (let i = -N; i <= N; i++) {
    for (let j = -N; j <= N; j++) {
      const x = i * CELL
      const z = j * CELL
      const n = terrainLayers(x, z)
      if (n <= 0) continue
      const low = Math.min(
        terrainLayers(x + CELL, z),
        terrainLayers(x - CELL, z),
        terrainLayers(x, z + CELL),
        terrainLayers(x, z - CELL),
      )
      for (let k = Math.max(0, Math.min(low, n - 1)); k < n; k++) {
        const top = k === n - 1
        const h = hash(x, z + k)
        let c: string
        if (top) c = n >= 11 ? COLORS.white : n >= 7 ? (h > 0.5 ? COLORS.grey : '#b8bcbf') : h > 0.7 ? COLORS.lime : h > 0.3 ? COLORS.green : COLORS.darkGreen
        else if (k >= 10) c = h > 0.4 ? COLORS.white : '#dde3e8'
        else c = k >= 5 ? (h > 0.5 ? COLORS.grey : COLORS.darkGrey) : h > 0.5 ? COLORS.darkTan : COLORS.tan
        out.push({ p: [x, k * LAYER, z], c })
      }
    }
  }
  return out
}

/** Ground height under a world point (terrain top, or 0 on the plain). */
export function groundAt(x: number, z: number) {
  const i = Math.round(x / CELL)
  const j = Math.round(z / CELL)
  return terrainLayers(i * CELL, j * CELL) * LAYER
}
