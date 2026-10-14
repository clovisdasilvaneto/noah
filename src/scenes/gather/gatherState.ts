import * as THREE from 'three'
import { COAT_GOAL } from '../../store'

// Plain shared state for the gather level (kept out of the component files so
// Fast Refresh stays happy and nothing re-renders per frame).

type V3 = [number, number, number]

/** Optional per-interactable prompt text (keyed by interactable id), read by the player controller. */
export const buildLabels = new Map<number, { ready?: () => string; need?: () => string }>()

/**
 * Cinematic framing (the finished-ark celebration): while `on`, the camera
 * eases to look at (x, y, z) from far enough back to fit `width` units across.
 */
export const camCine = { on: false, x: 0, y: 0, z: 0, width: 20 }

export const ARK: V3 = [0, 0, -18]
export const WOODPILE: V3 = [16, 0, -6.5]
export const PLANK_DROP: V3 = [9.6, 0, -13.4]
export const DECK_SPOTS: V3[] = [
  [-5.6, 0, -14.4],
  [0, 0, -14.4],
  [5.6, 0, -14.4],
]
export const COAT_SPOTS: V3[] = [
  [-11.2, 0, -18],
  [-3.2, 0, -14.4],
  [3.2, 0, -14.4],
  [11.2, 0, -18],
]
export const ROOF_SPOT: V3 = [-8.4, 0, -14.4]
export const DOOR_SPOT: V3 = [0, 0, -13.2]

export const ARK_STAGES = 6 // 0 keel, 1–3 decks, 4 roof + window, 5 door

/** Build progress shared by the build spots and the ark model. */
export const arkBuild = {
  progress: new Float32Array(ARK_STAGES),
  coat: new Float32Array(COAT_GOAL),
  /** where each stage's bricks fly in from, in ark-local space */
  from: Array.from({ length: ARK_STAGES }, () => new THREE.Vector3(0, 0.5, 3.5)),
}

/** Bricks of `stage` fly in from world point `p`. */
export function flyFrom(stage: number, p: V3) {
  arkBuild.from[stage].set(p[0] - ARK[0], 0.6, p[2] - ARK[2])
}
