import * as THREE from 'three'

/** Total story beats: 14 scripture lines, then the end card counts as beat 14. */
export const END_BEAT = 14

/**
 * Smoothed scene values, written once per frame by the director and read by
 * every effect in its own frame callback. Plain numbers: no allocation, no React.
 */
export const sim = {
  t: 0,
  /** frame-time clamp (raised only by the dev handle for slow headless test runs) */
  maxDt: 0.1,
  /** current beat: line index, or END_BEAT on the end card */
  beat: 0,
  /** sim time each beat was first reached (NOT_YET = not yet); index END_BEAT is the end card */
  reached: new Array<number>(END_BEAT + 1).fill(-1e9),
  level: -1,
  amp: 1,
  storm: 0.6,
  rain: 0.2,
  clear: 0,
  part: 0,
  rays: 0,
  arkT: 0,
  cut: 0,
  door: 1,
  renew: 0,
  flash: 0,
  ark: {
    pos: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    roll: 0,
  },
  dove: {
    pos: new THREE.Vector3(),
    fwd: new THREE.Vector3(0, 0, -1),
    u: 0,
  },
}

/** Marks a beat that hasn't been reached (reached times can be negative after a skip). */
export const NOT_YET = -1e9

/** Seconds since `beat` was first reached, or -1 if it hasn't been. */
export function since(beat: number) {
  const r = sim.reached[beat]
  return r === NOT_YET ? -1 : sim.t - r
}
