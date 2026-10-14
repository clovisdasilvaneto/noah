import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export type V3 = [number, number, number]

/** A camera pose: position, look target and vertical field of view. */
export type Cam = { p: V3; l: V3; fov?: number }

export type Ease = 'inOut' | 'out' | 'in' | 'linear'

/**
 * One shot per dialogue line. The camera moves from `a` to `b` over `dur`
 * seconds (a dolly, crane or orbit when `orbit` is set), blending in from
 * wherever the previous shot left it over `blend` seconds (0 = hard cut).
 */
export type Shot = {
  a: Cam
  b: Cam
  dur?: number
  blend?: number
  ease?: Ease
  /** handheld breathing amplitude (world units, ~0.02–0.08) */
  shake?: number
  /** camera roll in radians (dutch angle) */
  roll?: number
  /** orbit around this point from a to b instead of moving in a straight line */
  orbit?: V3
}

/** Mutable shared state written by the dialogue overlay. */
export type CutsceneState = { line: number; total: number }

const ease = (e: Ease, u: number) => {
  if (e === 'linear') return u
  if (e === 'in') return u * u * u
  if (e === 'out') return 1 - Math.pow(1 - u, 3)
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}
const smooth = (u: number) => u * u * (3 - 2 * u)

const tmpA = new THREE.Vector3()
const tmpB = new THREE.Vector3()
const tmpC = new THREE.Vector3()

/** Position along an orbit: interpolate angle, radius and height around `c`. */
function orbitLerp(out: THREE.Vector3, a: V3, b: V3, c: V3, e: number) {
  const ax = a[0] - c[0]
  const az = a[2] - c[2]
  const bx = b[0] - c[0]
  const bz = b[2] - c[2]
  const angA = Math.atan2(az, ax)
  let angB = Math.atan2(bz, bx)
  // shortest way round
  while (angB - angA > Math.PI) angB -= Math.PI * 2
  while (angB - angA < -Math.PI) angB += Math.PI * 2
  const ang = angA + (angB - angA) * e
  const r = Math.hypot(ax, az) + (Math.hypot(bx, bz) - Math.hypot(ax, az)) * e
  return out.set(c[0] + Math.cos(ang) * r, a[1] + (b[1] - a[1]) * e, c[2] + Math.sin(ang) * r)
}

/**
 * Cinematic camera for cutscenes: eased moves inside each shot, blends or
 * cuts between shots, handheld breathing, dutch roll, a ground clamp so the
 * lens never dips into the bricks, wider lens on portrait screens, and a
 * view offset that keeps the subject in the part of the screen the dialogue
 * box does not cover.
 */
export function useCinematicCamera(
  state: CutsceneState,
  shots: (Shot | Shot[])[],
  ground: (x: number, z: number) => number,
  onTick?: (line: number, tLine: number, dt: number, t: number) => void,
) {
  const { camera, size } = useThree()
  const cam = camera as THREE.PerspectiveCamera
  const r = useRef({
    line: -1,
    sub: -1,
    start: 0,
    subStart: 0,
    fromP: new THREE.Vector3(),
    fromL: new THREE.Vector3(),
    fromFov: 45,
    curP: new THREE.Vector3(),
    curL: new THREE.Vector3(),
    curFov: 45,
    offX: 0,
    offY: 0,
    tgtX: 0,
    tgtY: 0,
    lastMeasure: -1,
    first: true,
  })
  const look = useMemo(() => new THREE.Vector3(), [])

  useFrame((st, rawDt) => {
    const s = r.current
    const dt = Math.min(rawDt, 1 / 20)
    const t = st.clock.elapsedTime
    const line = Math.max(0, Math.min(state.line, shots.length - 1))
    const entry = shots[line]
    const seq = Array.isArray(entry) ? entry : [entry]
    if (line !== s.line) {
      s.line = line
      s.start = t
      s.sub = -1
    }
    const tLine = t - s.start
    // a line can hold several shots in sequence; the last one holds
    let sub = 0
    let subAt = 0
    while (sub < seq.length - 1 && tLine >= subAt + (seq[sub].dur ?? 9)) {
      subAt += seq[sub].dur ?? 9
      sub++
    }
    const shot = seq[sub]
    if (sub !== s.sub) {
      s.sub = sub
      s.subStart = s.start + subAt
      if (s.first) {
        s.first = false
        s.curP.set(...shot.a.p)
        s.curL.set(...shot.a.l)
        s.curFov = shot.a.fov ?? 45
      }
      s.fromP.copy(s.curP)
      s.fromL.copy(s.curL)
      s.fromFov = s.curFov
    }
    const tl = t - s.subStart
    const u = Math.min(1, tl / (shot.dur ?? 9))
    const e = ease(shot.ease ?? 'inOut', u)
    if (shot.orbit) orbitLerp(tmpA, shot.a.p, shot.b.p, shot.orbit, e)
    else tmpA.set(...shot.a.p).lerp(tmpC.set(...shot.b.p), e)
    tmpB.set(...shot.a.l).lerp(tmpC.set(...shot.b.l), e)
    let fov = (shot.a.fov ?? 45) + ((shot.b.fov ?? shot.a.fov ?? 45) - (shot.a.fov ?? 45)) * e

    const blend = shot.blend ?? 1.4
    const w = blend <= 0 ? 1 : smooth(Math.min(1, tl / blend))
    s.curP.copy(s.fromP).lerp(tmpA, w)
    s.curL.copy(s.fromL).lerp(tmpB, w)
    fov = s.fromFov + (fov - s.fromFov) * w
    s.curFov = fov

    // handheld breathing: a few incommensurate sines read as organic drift
    const sh = shot.shake ?? 0.03
    const hx = (Math.sin(t * 0.83) * 0.6 + Math.sin(t * 1.91 + 1.3) * 0.3 + Math.sin(t * 3.7 + 0.4) * 0.1) * sh
    const hy = (Math.sin(t * 0.67 + 2.1) * 0.6 + Math.sin(t * 2.3 + 0.2) * 0.3 + Math.sin(t * 4.1) * 0.1) * sh
    camera.position.set(s.curP.x + hx, s.curP.y + hy, s.curP.z - hx * 0.5)
    const floor = ground(camera.position.x, camera.position.z) + 0.35
    if (camera.position.y < floor) camera.position.y = floor
    look.set(s.curL.x + hx * 0.4, s.curL.y + hy * 0.5, s.curL.z)
    camera.lookAt(look)
    const roll = (shot.roll ?? 0) * w + Math.sin(t * 0.5) * sh * 0.15
    if (roll) camera.rotateZ(roll)

    // portrait screens are narrow: open the lens so wide shots keep their sides
    const aspect = size.width / size.height
    const widen = aspect < 1 ? 1 + Math.min(0.42, (1 - aspect) * 0.75) : 1
    const finalFov = Math.min(80, fov * widen)

    // find the free part of the screen: left of a side dialogue, above a bottom one
    if (t - s.lastMeasure > 0.25) {
      s.lastMeasure = t
      const el = document.querySelector('.dialogue')
      s.tgtX = 0
      s.tgtY = 0
      if (el) {
        const rect = el.getBoundingClientRect()
        if (rect.left > size.width * 0.3) s.tgtX = size.width / 2 - rect.left / 2
        else s.tgtY = Math.max(0, (size.height / 2 - rect.top / 2) * 0.82)
      }
    }
    const k = 1 - Math.exp(-dt * 3)
    s.offX += (s.tgtX - s.offX) * k
    s.offY += (s.tgtY - s.offY) * k
    if (Math.abs(s.offX) > 0.5 || Math.abs(s.offY) > 0.5) cam.setViewOffset(size.width, size.height, s.offX, s.offY, size.width, size.height)
    else if (cam.view) cam.clearViewOffset()
    if (cam.fov !== finalFov || cam.view) {
      cam.fov = finalFov
      cam.updateProjectionMatrix()
    }

    onTick?.(line, tLine, dt, t)
  })

  return r
}

/** Reset helper the scenes call on unmount. */
export function resetCamera(camera: THREE.Camera) {
  const c = camera as THREE.PerspectiveCamera
  c.clearViewOffset()
  c.fov = 45
  c.up.set(0, 1, 0)
  c.updateProjectionMatrix()
}

/** Damped approach towards a target (frame-rate independent). */
export const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt))

/** 0→1 ramp between two times. */
export const ramp = (t: number, a: number, b: number) => (t <= a ? 0 : t >= b ? 1 : smooth((t - a) / (b - a)))
