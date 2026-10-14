// Map layout for chapter 4 plus level-local registries (interactables with
// their own prompts, camera override). Physics colliders/platforms reuse the
// shared registries in game/world.ts, which the level clears on mount.
import type { ActionIcon } from './state'
import type { SpeciesId } from '../../i18n/animals'
import { surfaceHeight } from '../../game/world'

export type V3 = [number, number, number]
export type V2 = [number, number]

/* ------------------------------------------------------------------ */
/* The ark                                                              */
/* ------------------------------------------------------------------ */

export const ARK = { x: 0, z: -17 }
export const HULL_HALF_L = 10
export const HULL_HALF_W = 3.4
export const HULL_FRONT = ARK.z + HULL_HALF_W // south face, towards the camera
/** Door sill / deck height: three bricks. */
export const DECK_Y = 1.44
export const DOOR_X = 3.2
export const DOOR_W = 2.4
/** The door is a drawbridge: it folds down to become the ramp. */
export const DOOR_H = 2.88
export const RAMP_RUN = Math.sqrt(DOOR_H * DOOR_H - DECK_Y * DECK_Y)
export const RAMP_FOOT: V2 = [DOOR_X, HULL_FRONT + RAMP_RUN + 0.4]
export const APPROACH: V2 = [DOOR_X, HULL_FRONT + RAMP_RUN + 3]

export const START: V3 = [0.5, 0, -6]

/* ------------------------------------------------------------------ */
/* Where everyone lives                                                 */
/* ------------------------------------------------------------------ */

/** Giraffe hill: three stacked tiers you hop up. */
export const HILL = { x: -19, z: 1 }
export const HILL_TIERS = [
  { hw: 4.8, top: 0.96 },
  { hw: 3.6, top: 1.92 },
  { hw: 2.4, top: 2.88 },
]
export function hillHeight(x: number, z: number) {
  const dx = Math.abs(x - HILL.x)
  const dz = Math.abs(z - HILL.z)
  let h = 0
  for (const t of HILL_TIERS) if (dx < t.hw && dz < t.hw) h = t.top
  return h
}
/** Ground height for animals (they ignore the player's physics). */
export function animalGround(x: number, z: number) {
  return Math.max(surfaceHeight(x, z), hillHeight(x, z))
}

/** The dove tree with the bell platform beside it. */
export const DOVE_TREE = { x: -17, z: -15 }
export const BELL = { x: -13.6, z: -12.6 }
export const BELL_TOP = 0.96

/** Elephant clearing: a ring of trees, a fallen log in the gap facing the ark. */
export const CLEARING = { x: 19.5, z: -15, r: 4.4 }
export const LOG = { x: CLEARING.x - CLEARING.r, z: CLEARING.z }

/** Zebra meadow beyond the stream. */
export const STREAM_X = 17.5
export const STREAM_Z: V2 = [-8.6, 8.8]
export const BRIDGE_Z = 0
export const BRIDGE_PILE: V2 = [15.6, 0.2]

/** Rabbit pen: fenced, with a gate on the north side. */
export const PEN = { x: 16, z: 16, hw: 4.6, hd: 3.4, gateX: 14.2, gateW: 2.4 }

/** Lions hide in the tall grass. */
export const GRASS: V2[] = [
  [-18.5, 10.5],
  [-15.2, 11.8],
  [-11.8, 10.6],
  [-19.6, 14.6],
  [-16.2, 15.6],
  [-12.4, 14.8],
  [-17.8, 18.8],
  [-13.6, 18.6],
]
export const LION_GRASS = [4, 2] // indices into GRASS

/** Turtles sunbathe on the far side of the pond. */
export const POND = { x: -1, z: 16.5, r: 3 }

export const SHEEP_HOMES: V2[] = [
  [-8, 2],
  [9, 4],
  [-5, 9.5],
  [8, 11],
  [-23, -7],
  [24, 13.5],
]

/** Exit routes from each hiding place to the ark's approach point (kept clear of trees). */
export const EXIT: Record<SpeciesId, V2[]> = {
  lions: [],
  sheep: [],
  turtles: [],
  doves: [],
  elephants: [
    [CLEARING.x, CLEARING.z],
    [LOG.x - 1, LOG.z],
    [12, -10.2],
    [7, -8.4],
  ],
  giraffes: [
    [HILL.x + 1, HILL.z],
    [HILL.x + 6.2, HILL.z],
    [-9, -4],
    [-2, -8],
  ],
  zebras: [
    [STREAM_X + 2.5, BRIDGE_Z],
    [STREAM_X - 2.5, BRIDGE_Z],
    [12, -2],
    [7, -6.5],
  ],
  rabbits: [
    [PEN.gateX, PEN.z - PEN.hd + 1.2],
    [PEN.gateX, PEN.z - PEN.hd - 1.5],
    [10, 8],
    [5, -2],
  ],
}

/** Map edges for Noah. */
export const LEVEL_BOUNDS = { minX: -27, maxX: 27, minZ: -24, maxZ: 24 }

/* ------------------------------------------------------------------ */
/* Level-local registries                                               */
/* ------------------------------------------------------------------ */

export type AInteract = {
  id: number
  x: number
  z: number
  r: number
  icon: ActionIcon
  label: () => string
  /** hold the action button to build */
  hold?: boolean
  /** Noah must be standing at least this high (on a crate or hill) to use it */
  minY?: number
  /** shows blockedLabel instead while this returns true */
  blocked?: () => boolean
  /** prompt shown while it can't be used yet (e.g. "climb up") */
  blockedLabel?: () => string
  enabled?: () => boolean
  hit?: () => void
  build?: (dt: number) => number
}

export const ainteract = new Map<number, AInteract>()

/** Camera override for the closing cutscene. */
export const camOverride = { active: false, x: 0, y: 0, z: 0, dist: 1 }

/** Next goal the guide arrow points at. */
export const guide = { active: false, x: 0, z: 0 }

/** Short-lived "wave" request for Noah's minifig (after calling an animal). */
export const noahFx = { wave: 0 }

/** Closing cutscene: the director walks Noah aboard (physics off). */
export const noahScript = { active: false, x: 0, y: 0, z: 0, facing: 0, speed: 0, visible: true }

export function clearLevelRegistries() {
  ainteract.clear()
  noahScript.active = false
  noahScript.visible = true
  camOverride.active = false
  guide.active = false
  noahFx.wave = 0
}

export function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/** Distance from a point to a polyline. */
export function distToPath(x: number, z: number, pts: V2[]) {
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]
    const [bx, bz] = pts[i + 1]
    const vx = bx - ax
    const vz = bz - az
    const l2 = vx * vx + vz * vz || 1
    const k = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2))
    best = Math.min(best, Math.hypot(x - (ax + vx * k), z - (az + vz * k)))
  }
  return best
}
