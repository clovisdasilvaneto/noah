import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BH, COLORS, P, PLATE } from '../../three/bricks'
import { Brick, StaticBricks, type StaticBrick } from '../../three/common'
import type { HoloBrick } from './fx'
import type { V3 } from './rig'

/* ------------------------------------------------------------------ */
/* The ark (300 x 50 x 30 cubits, roughly 6 : 1 : 0.6)                   */
/* ------------------------------------------------------------------ */

type Part = 'hull' | 'deck' | 'cabin' | 'roof' | 'door'
type ArkBrick = StaticBrick & { part: Part }

/** A ring of 1x2 bricks, L x W studs, centred on the origin at height y. */
function ring(L: number, W: number, y: number, color: (i: number, x: number, z: number) => string, part: Part, out: ArkBrick[]) {
  const zEdge = (W / 2 - 0.5) * P
  for (let i = 0; i < L / 2; i++) {
    const x = (-L / 2 + 1 + i * 2) * P
    out.push({ w: 2, d: 1, c: color(i, x, zEdge), p: [x, y, zEdge], part })
    out.push({ w: 2, d: 1, c: color(i, x, -zEdge), p: [x, y, -zEdge], part })
  }
  const xEdge = (L / 2 - 0.5) * P
  for (let j = 0; j < (W - 2) / 2; j++) {
    const z = (-(W - 2) / 2 + 1 + j * 2) * P
    out.push({ w: 1, d: 2, c: color(j, xEdge, z), p: [xEdge, y, z], part })
    out.push({ w: 1, d: 2, c: color(j, -xEdge, z), p: [-xEdge, y, z], part })
  }
}

const DOOR_X = 2 * P
const DOOR = '#3a2312'

/** Bricks of the finished ark in local space (length along x, door on the +z side). */
export function arkBricks(): ArkBrick[] {
  const out: ArkBrick[] = []
  const rows: [number, number][] = [
    [22, 6],
    [26, 8],
    [30, 8],
    [32, 10],
    [32, 10],
  ]
  // keel / floor
  for (let x = -5; x <= 5; x++) for (let z = -1; z <= 1; z++) out.push({ w: 2, d: 2, c: '#3b2a1d', p: [x * 2 * P, 0, z * 2 * P], part: 'hull' })
  rows.forEach(([L, W], r) => {
    const base = r % 2 ? COLORS.brown : COLORS.reddishBrown
    ring(
      L,
      W,
      r * BH,
      (_i, x, z) => {
        // the door: a dark opening in the side, two rows tall
        if (z > 0 && (r === 1 || r === 2) && Math.abs(x - DOOR_X) < 2.1 * P) return DOOR
        return r === 0 ? '#3b2a1d' : base
      },
      'hull',
      out,
    )
  })
  // deck plates
  const deckY = rows.length * BH
  for (let x = 0; x < 4; x++) for (let z = 0; z < 2; z++) out.push({ w: 8, d: 5, h: 1 / 3, studs: false, c: COLORS.tan, p: [(-12 + x * 8) * P, deckY, (-2.5 + z * 5) * P], part: 'deck' })
  // cabin with a window strip "a cubit from the top"
  const cabY = deckY + PLATE
  ring(20, 6, cabY, () => COLORS.gopher, 'cabin', out)
  ring(20, 6, cabY + BH, (i) => (i % 2 ? COLORS.black : COLORS.gopher), 'cabin', out)
  ring(20, 6, cabY + BH * 2, () => COLORS.darkTan, 'cabin', out)
  // stepped roof
  const roofY = cabY + BH * 3
  const steps: [number, number][] = [
    [24, 8],
    [22, 6],
    [22, 4],
    [20, 2],
  ]
  steps.forEach(([L, W], i) =>
    out.push({ w: L, d: W, h: 2 / 3, studs: false, c: i % 2 ? '#8a3b22' : COLORS.reddishBrown, p: [0, roofY + i * BH * (2 / 3), 0], part: 'roof' }),
  )
  return out
}

/** Order of construction for the blueprint: bottom to top, centre outwards. */
export function arkBlueprint(at: V3, scale = 1): HoloBrick[] {
  const list = arkBricks()
  const sorted = [...list].sort((a, b) => a.p[1] - b.p[1] || Math.abs(a.p[0]) - Math.abs(b.p[0]))
  return sorted.map((b, i) => ({ ...b, p: [at[0] + b.p[0] * scale, at[1] + b.p[1] * scale, at[2] + b.p[2] * scale] as V3, o: (i / sorted.length) * 0.98 }))
}

/** Height of the top of the ark's roof in local units. */
export const ARK_TOP = 5 * BH + PLATE + BH * 3 + BH * (2 / 3) * 4
export const ARK_DOOR: V3 = [DOOR_X, BH, 5 * P]
/** Boarding ramp, local units: hinge just outside the hull at sill height, length and tilt chosen so
 *  the far end touches the ground when the ark sits BH * 0.34 above it (as in AnimalsCallScene). */
export const RAMP_HINGE_Z = 4.5 * P
export const RAMP_LEN = 6 * P
export const RAMP_TILT = Math.asin((BH + BH * 0.34) / RAMP_LEN)

/** The finished ark with an open door and a boarding ramp. */
export function Ark({ position, rotation = 0, scale = 1 }: { position: V3; rotation?: number; scale?: number }) {
  const bricks = useMemo(() => arkBricks().map(({ part: _p, ...b }) => b), [])
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <StaticBricks bricks={bricks} />
      {/* ramp down from the door: hinged at the sill with its top surface at y=0,
          tilted so the far end lands on the ground (see RAMP_* in AnimalsCallScene) */}
      <group position={[DOOR_X, BH, RAMP_HINGE_Z]} rotation={[RAMP_TILT, 0, 0]}>
        <Brick w={3} d={6} h={1 / 3} color={COLORS.gopher} position={[0, -PLATE, RAMP_LEN / 2]} studs={false} />
        {[0, 1, 2, 3].map((i) => (
          <Brick key={i} w={3} d={1} h={1 / 3} color={COLORS.brown} position={[0, 0, 0.4 + i * 0.55]} studs={false} />
        ))}
      </group>
      {/* wooden blocks under the hull */}
      {[-4, 0, 4].map((x) => (
        <Brick key={x} w={2} d={6} h={1 / 3} color={COLORS.darkTan} position={[x * P, -PLATE, 0]} studs={false} />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Brick animals                                                        */
/* ------------------------------------------------------------------ */

export type AnimalKind = 'sheep' | 'cow' | 'elephant' | 'giraffe' | 'lion' | 'camel'

/** Local bricks of an animal facing +x, feet at y=0. */
export function animalBricks(kind: AnimalKind): StaticBrick[] {
  const legs = (h: number, x: number, z: number, c: string): StaticBrick[] => [
    { w: 1, d: 1, h, c, p: [x, 0, z], studs: false },
    { w: 1, d: 1, h, c, p: [x, 0, -z], studs: false },
    { w: 1, d: 1, h, c, p: [-x, 0, z], studs: false },
    { w: 1, d: 1, h, c, p: [-x, 0, -z], studs: false },
  ]
  switch (kind) {
    case 'sheep':
      return [
        ...legs(0.8, 0.4, 0.2, COLORS.darkGrey),
        { w: 3, d: 2, c: COLORS.white, p: [0, 0.8 * BH, 0] },
        { w: 2, d: 2, h: 1 / 3, c: COLORS.white, p: [-0.1, 1.8 * BH, 0] },
        { w: 1, d: 2, c: COLORS.black, p: [0.75, 1.15 * BH, 0], studs: false },
      ]
    case 'cow':
      return [
        ...legs(1.1, 0.6, 0.2, COLORS.white),
        { w: 4, d: 2, h: 1.1, c: COLORS.white, p: [0, 1.1 * BH, 0] },
        { w: 2, d: 2, h: 1 / 3, c: COLORS.black, p: [-0.3, 2.2 * BH, 0], studs: false },
        { w: 2, d: 2, c: COLORS.reddishBrown, p: [1.0, 1.6 * BH, 0], studs: false },
        { w: 1, d: 3, h: 1 / 3, c: COLORS.tan, p: [1.0, 2.6 * BH, 0], studs: false },
      ]
    case 'elephant':
      return [
        ...legs(1.5, 0.6, 0.4, COLORS.grey),
        { w: 4, d: 3, h: 1.6, c: COLORS.grey, p: [0, 1.5 * BH, 0] },
        { w: 1, d: 4, h: 1.4, c: COLORS.darkGrey, p: [1.0, 2.0 * BH, 0], studs: false },
        { w: 2, d: 2, h: 1.3, c: COLORS.grey, p: [1.3, 2.1 * BH, 0], studs: false },
        { w: 1, d: 1, h: 1.8, c: COLORS.grey, p: [1.75, 0.6 * BH, 0], studs: false },
      ]
    case 'giraffe':
      return [
        ...legs(2.2, 0.4, 0.2, '#e9b44c'),
        { w: 3, d: 2, c: '#e9b44c', p: [0, 2.2 * BH, 0] },
        { w: 1, d: 1, h: 1 / 3, c: '#a0612b', p: [-0.3, 3.2 * BH, 0.2], studs: false },
        { w: 1, d: 1, h: 3, c: '#e9b44c', p: [0.6, 3.2 * BH, 0], studs: false },
        { w: 2, d: 1, h: 0.8, c: '#e9b44c', p: [0.8, 6.2 * BH, 0], studs: false },
        { w: 1, d: 1, h: 1 / 3, c: '#a0612b', p: [0.6, 4.4 * BH, 0.05], studs: false },
      ]
    case 'lion':
      return [
        ...legs(1, 0.4, 0.2, '#d98b2b'),
        { w: 3, d: 2, c: '#d98b2b', p: [0, BH, 0] },
        { w: 2, d: 3, h: 1.7, c: '#8a4a1a', p: [0.55, 0.85 * BH, 0], studs: false },
        { w: 1, d: 2, c: '#e9a040', p: [0.95, 1.2 * BH, 0], studs: false },
        { w: 1, d: 1, h: 1 / 3, c: '#8a4a1a', p: [-0.75, 1.7 * BH, 0], studs: false },
      ]
    case 'camel':
      return [
        ...legs(1.8, 0.5, 0.2, '#c99a5b'),
        { w: 4, d: 2, c: '#c99a5b', p: [0, 1.8 * BH, 0] },
        { w: 2, d: 2, c: '#b5854a', p: [-0.1, 2.8 * BH, 0] },
        { w: 1, d: 1, h: 2, c: '#c99a5b', p: [0.9, 2.4 * BH, 0], studs: false },
        { w: 2, d: 1, h: 0.8, c: '#c99a5b', p: [1.1, 4.4 * BH, 0], studs: false },
      ]
  }
}

/** A solid brick animal. `walk` > 0 bobs it along; `graze` dips the whole body. */
export function Animal({ kind, position, rotation = 0, walk = 0, seed = 0 }: { kind: AnimalKind; position?: V3; rotation?: number; walk?: number; seed?: number }) {
  const bricks = useMemo(() => animalBricks(kind), [kind])
  const g = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!g.current) return
    const t = state.clock.elapsedTime * (walk > 0 ? 7 : 1.3) + seed * 10
    g.current.position.y = walk > 0 ? Math.abs(Math.sin(t)) * 0.06 * walk : 0
    g.current.rotation.z = walk > 0 ? Math.sin(t) * 0.05 * walk : Math.sin(t * 0.5) * 0.02
  })
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group ref={g}>
        <StaticBricks bricks={bricks} />
      </group>
    </group>
  )
}

/** Holographic pairs for the visions: places a list of animals and assigns build order. */
export function holoAnimals(list: { kind: AnimalKind; p: V3; ry: number; o: number }[]): HoloBrick[] {
  const out: HoloBrick[] = []
  for (const a of list) {
    const cos = Math.cos(a.ry)
    const sin = Math.sin(a.ry)
    for (const b of animalBricks(a.kind)) {
      out.push({
        ...b,
        p: [a.p[0] + b.p[0] * cos + b.p[2] * sin, a.p[1] + b.p[1], a.p[2] - b.p[0] * sin + b.p[2] * cos],
        ry: (b.ry ?? 0) + a.ry,
        o: a.o,
      })
    }
  }
  return out
}

/** A white dove with flapping wings, flying in a circle. */
export function Dove({ center, radius, height, speed = 0.5, phase = 0, color = COLORS.white, emissive = 0 }: { center: V3; radius: number; height: number; speed?: number; phase?: number; color?: string; emissive?: number }) {
  const g = useRef<THREE.Group>(null)
  const wl = useRef<THREE.Group>(null)
  const wr = useRef<THREE.Group>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const a = t * speed + phase
    if (g.current) {
      g.current.position.set(center[0] + Math.cos(a) * radius, center[1] + height + Math.sin(t * 1.3 + phase) * 0.3, center[2] + Math.sin(a) * radius)
      g.current.rotation.set(0, -a - (speed > 0 ? 0 : Math.PI), Math.sin(t * 0.8 + phase) * 0.15)
    }
    const flap = Math.sin(t * 11 + phase * 3) * 0.7
    if (wl.current) wl.current.rotation.x = flap
    if (wr.current) wr.current.rotation.x = -flap
  })
  return (
    <group ref={g}>
      <Brick w={1} d={2} h={2 / 3} color={color} emissive={emissive} studs={false} position={[0, 0, 0]} />
      <Brick w={1} d={1} h={2 / 3} color={COLORS.yellow} emissive={emissive} studs={false} position={[0, 0.1, -0.5]} />
      <group ref={wl} position={[0.2, 0.2, 0]}>
        <Brick w={2} d={1} h={1 / 3} color={color} emissive={emissive} studs={false} position={[0.4, 0, 0]} />
      </group>
      <group ref={wr} position={[-0.2, 0.2, 0]}>
        <Brick w={2} d={1} h={1 / 3} color={color} emissive={emissive} studs={false} position={[-0.4, 0, 0]} />
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Scenery                                                              */
/* ------------------------------------------------------------------ */

/** A small flat-roofed mud-brick house. */
export function houseBricks(at: V3, ry: number, wall: string, roof: string): StaticBrick[] {
  const cos = Math.cos(ry)
  const sin = Math.sin(ry)
  const local: StaticBrick[] = [
    { w: 6, d: 4, c: wall, p: [0, 0, 0] },
    { w: 6, d: 4, c: wall, p: [0, BH, 0] },
    { w: 7, d: 5, h: 1 / 3, c: roof, p: [0, BH * 2, 0], studs: false },
    { w: 2, d: 2, c: wall, p: [-0.6, BH * 2 + PLATE, 0] },
  ]
  return local.map((b) => ({ ...b, p: [at[0] + b.p[0] * cos + b.p[2] * sin, at[1] + b.p[1], at[2] - b.p[0] * sin + b.p[2] * cos] as V3, ry }))
}

/** A stepped household tent. */
export function tentBricks(at: V3, size: 'big' | 'small', a: string, b: string): StaticBrick[] {
  const s: StaticBrick[] =
    size === 'big'
      ? [
          { w: 6, d: 6, c: a, p: [0, 0, 0] },
          { w: 4, d: 6, c: b, p: [0, BH, 0] },
          { w: 2, d: 6, c: a, p: [0, BH * 2, 0] },
          { w: 2, d: 1, c: COLORS.reddishBrown, p: [0, 0, 1.1] },
        ]
      : [
          { w: 4, d: 4, c: a, p: [0, 0, 0] },
          { w: 2, d: 4, c: b, p: [0, BH, 0] },
        ]
  return s.map((x) => ({ ...x, p: [at[0] + x.p[0], at[1] + x.p[1], at[2] + x.p[2]] as V3 }))
}

/** Olive tree whose canopy sways in the wind. */
export function OliveTree({ position, wind = 1, scale = 1 }: { position: V3; wind?: number; scale?: number }) {
  const crown = useRef<THREE.Group>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (crown.current) {
      crown.current.rotation.z = (Math.sin(t * 1.3) * 0.04 + Math.sin(t * 2.9) * 0.015) * wind
      crown.current.rotation.x = Math.sin(t * 1.1 + 1) * 0.03 * wind
    }
  })
  return (
    <group position={position} scale={scale}>
      {[0, 1, 2, 3].map((i) => (
        <Brick key={i} w={1} d={1} color={COLORS.brown} position={[i === 3 ? 0.1 : 0, i * BH, 0]} />
      ))}
      <group ref={crown} position={[0, 4 * BH, 0]}>
        <Brick w={4} d={4} color={'#5c7d3a'} position={[0, 0, 0]} />
        <Brick w={3} d={5} color={'#6f9446'} position={[0.3, BH, -0.1]} />
        <Brick w={3} d={3} color={'#86a957'} position={[-0.1, 2 * BH, 0.1]} />
        <Brick w={2} d={2} color={'#9cbc68'} position={[0.2, 3 * BH, 0]} />
      </group>
    </group>
  )
}
