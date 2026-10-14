import { Vector3 } from 'three'

// Plain mutable registries shared between level objects and the player
// controller. Kept outside React so per-frame reads cost nothing.

/** A solid cylinder. `top` is its height: Noah can stand on low ones (default: too tall). */
export type Collider = { x: number; z: number; r: number; top?: number }

export type Interactable = {
  id: number
  kind: 'chop' | 'smash' | 'build'
  x: number
  z: number
  r: number
  /** For builds: whether the player currently has what's needed. */
  ready?: () => boolean
  /** Tap action (chop/smash). */
  hit?: () => void
  /** Hold action (build). Called each frame while held; returns 0..1 progress. */
  build?: (dt: number) => number
}

/** Axis-aligned box you can stand on (and bump into from the side). */
export type Platform = { x: number; z: number; hw: number; hd: number; top: number }

export type Pickup = { id: number; x: number; z: number; collect: () => void }

export const colliders = new Map<number, Collider>()
export const interactables = new Map<number, Interactable>()
export const pickups = new Map<number, Pickup>()
export const platforms = new Map<number, Platform>()

/**
 * Walkable floor plates (paths, the ark site) on a fixed grid so they never
 * overlap. Maps grid cell -> surface height. Cell size = one 4x4 plate.
 */
export const SURFACE_CELL = 1.6
export const surface = new Map<string, number>()
export const cellKey = (ix: number, iz: number) => `${ix},${iz}`
export function surfaceHeight(x: number, z: number) {
  return surface.get(cellKey(Math.round(x / SURFACE_CELL), Math.round(z / SURFACE_CELL))) ?? 0
}

/** Juice: camera shake amount (decays in the camera rig) and the level intro pan. */
export const camFx = { shake: 0, introT: 0 }

export const player = {
  pos: new Vector3(0, 0, 0),
  vel: new Vector3(),
  facing: 0,
  grounded: true,
  building: false,
  swingT: 0,
}

/** Current objective target the guidance beacon/arrow points to. */
export const objective = { active: false, x: 0, z: 0 }

let nextId = 1
export const newId = () => nextId++

export function clearWorld() {
  colliders.clear()
  interactables.clear()
  pickups.clear()
  platforms.clear()
  surface.clear()
  objective.active = false
  camFx.shake = 0
  camFx.introT = 0
}

export const BOUNDS = { minX: -27, maxX: 27, minZ: -25, maxZ: 25 }
