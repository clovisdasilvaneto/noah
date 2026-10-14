// Props that make each species a little challenge: the fallen log, the tall
// grass, the bridge build, the bell, the rabbit pen, the stream, the giraffe
// hill, the pond and the dove tree.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BlobShadow, Brick, StaticBricks, type StaticBrick } from '../../three/common'
import { BH, COLORS, plastic, plasticVC } from '../../three/bricks'
import { fx } from '../../three/Effects'
import { camFx, colliders, newId, platforms, type Collider, type Platform } from '../../game/world'
import { sfx } from '../../game/audio'
import { useGame } from '../../store'
import { ANIMALS_STRINGS } from '../../i18n/animals'
import { asfx } from './asfx'
import { box, brick, merge } from './models'
import { bridgeDone, hillPlatforms, lvl, revealLion, ringBell } from './Animals'
import {
  BELL,
  BELL_TOP,
  BRIDGE_PILE,
  BRIDGE_Z,
  DOVE_TREE,
  GRASS,
  HILL,
  HILL_TIERS,
  LION_GRASS,
  LOG,
  PEN,
  POND,
  STREAM_X,
  STREAM_Z,
  ainteract,
  type AInteract,
} from './layout'

const L = () => ANIMALS_STRINGS[useGame.getState().lang ?? 'en']

/** Registers colliders/platforms/interactables while `enabled`. */
function useRegistry(enabled: boolean, make: () => { colliders?: Collider[]; platforms?: Platform[]; interact?: Omit<AInteract, 'id'>[] }) {
  const makeRef = useRef(make)
  useEffect(() => {
    makeRef.current = make
  })
  useEffect(() => {
    if (!enabled) return
    const m = makeRef.current()
    const ids: { kind: 'c' | 'p' | 'i'; id: number }[] = []
    m.colliders?.forEach((c) => {
      const id = newId()
      colliders.set(id, c)
      ids.push({ kind: 'c', id })
    })
    m.platforms?.forEach((p) => {
      const id = newId()
      platforms.set(id, p)
      ids.push({ kind: 'p', id })
    })
    m.interact?.forEach((it) => {
      const id = newId()
      ainteract.set(id, { id, ...it })
      ids.push({ kind: 'i', id })
    })
    return () => {
      for (const { kind, id } of ids) {
        if (kind === 'c') colliders.delete(id)
        else if (kind === 'p') platforms.delete(id)
        else ainteract.delete(id)
      }
    }
  }, [enabled])
}

/* ------------------------------------------------------------------ */
/* Fallen log in front of the elephant clearing: three hits.            */
/* ------------------------------------------------------------------ */

export function FallenLog() {
  const [alive, setAlive] = useState(true)
  const shake = useRef(0)
  const ref = useRef<THREE.Group>(null)
  const geo = useMemo(
    () =>
      merge([
        brick(3, 10, 1, COLORS.reddishBrown, [0, 0, 0], false),
        brick(3, 10, 1 / 3, COLORS.brown, [0, BH, 0], true),
        brick(2, 9, 1 / 3, '#8a5a2b', [0, BH + BH / 3, 0], true),
        brick(4, 1, 2, '#9b6a3a', [0, 0, 2.05], false),
        brick(1, 1, 1, COLORS.brown, [0.6, BH * 1.3, -0.8], false),
        brick(2, 2, 1, COLORS.darkGreen, [0.9, BH * 1.2, -1.6]),
        brick(2, 2, 1, COLORS.green, [-0.7, BH * 1.2, 1.1]),
        box(0.9, 0.9, 0.06, '#d9b380', [0, BH, 2.47]),
      ]),
    [],
  )
  useRegistry(alive, () => ({
    colliders: [-1.4, -0.45, 0.45, 1.4].map((k) => ({ x: LOG.x, z: LOG.z + k, r: 0.75 })),
    interact: [
      {
        x: LOG.x + 0.5,
        z: LOG.z,
        r: 1.4,
        icon: 'smash',
        label: () => L().promptSmashLog,
        hit: () => {
          lvl.logHits++
          shake.current = 1
          camFx.shake = Math.max(camFx.shake, 0.4)
          sfx.chop()
          fx.burst(LOG.x, 0.8, LOG.z, [COLORS.reddishBrown, COLORS.brown], 6, 0.6)
          fx.studs(LOG.x + 0.6, 0.8, LOG.z, 40)
          if (lvl.logHits >= 3) {
            sfx.smash()
            camFx.shake = 1
            fx.burst(LOG.x, 0.6, LOG.z, [COLORS.reddishBrown, COLORS.brown, COLORS.green, COLORS.darkGreen], 30, 1.2)
            fx.studs(LOG.x + 0.8, 0.6, LOG.z, 300)
            lvl.logGone = true
            asfx.trumpet()
            useGame.getState().toast(L().toastLogGone)
            setAlive(false)
          } else useGame.getState().toast(L().toastLogHit)
        },
      },
    ],
  }))
  useFrame((_, dt) => {
    if (!ref.current || shake.current <= 0) return
    shake.current = Math.max(0, shake.current - dt * 4)
    ref.current.rotation.x = Math.sin(shake.current * 40) * 0.05 * shake.current
  })
  if (!alive) return null
  return (
    <group position={[LOG.x, 0, LOG.z]}>
      <group ref={ref}>
        <mesh geometry={geo} material={plasticVC()} />
      </group>
      <BlobShadow size={4} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Tall grass clumps. Two hide a lion (the tail gives it away).         */
/* ------------------------------------------------------------------ */

let grassGeo: THREE.BufferGeometry | null = null
function grassGeometry() {
  if (grassGeo) return grassGeo
  const parts = [brick(4, 4, 1 / 3, COLORS.darkGreen, [0, 0, 0], false)]
  const cols = [COLORS.green, COLORS.lime, '#2f7d33', '#9fd04a']
  let k = 0
  for (let i = -1.5; i <= 1.5; i++) {
    for (let j = -1.5; j <= 1.5; j++) {
      if ((i === 1.5 && j === -1.5) || (i === -1.5 && j === 1.5)) continue
      const h = 2 + ((k * 7) % 3 === 0 ? 1 : 0) - (Math.abs(i) + Math.abs(j) > 2.5 ? 1 : 0)
      parts.push(brick(1, 1, h, cols[k % cols.length], [i * 0.4, BH / 3, j * 0.4], false))
      parts.push(box(0.12, 0.3, 0.12, cols[(k + 1) % cols.length], [i * 0.4 + 0.05, BH / 3 + h * BH + 0.15, j * 0.4], [0.3, 0, 0.2]))
      k++
    }
  }
  grassGeo = merge(parts)
  return grassGeo
}

function GrassClump({ index }: { index: number }) {
  const [alive, setAlive] = useState(true)
  const [x, z] = GRASS[index]
  const ref = useRef<THREE.Group>(null)
  const hasLion = LION_GRASS.includes(index)
  const t0 = index * 1.3
  useRegistry(alive, () => ({
    colliders: [{ x, z, r: 0.7, top: BH * 2 }],
    interact: [
      {
        x,
        z,
        r: 0.8,
        icon: 'search',
        label: () => L().promptSearchGrass,
        hit: () => {
          sfx.smash()
          fx.burst(x, 0.5, z, [COLORS.green, COLORS.lime, COLORS.darkGreen], 18, 0.8)
          lvl.grassAlive[index] = false
          if (!revealLion(index)) {
            fx.studs(x, 0.5, z, 80)
            useGame.getState().toast(L().toastEmptyGrass)
          } else fx.studs(x, 0.5, z, 200)
          setAlive(false)
        },
      },
    ],
  }))
  useFrame((state) => {
    if (!ref.current) return
    // the lions' clumps rustle every few seconds
    const t = state.clock.elapsedTime + t0
    const r = hasLion ? Math.max(0, Math.sin(t * 1.4)) ** 6 : 0
    ref.current.rotation.z = Math.sin(t * 24) * 0.05 * r
    ref.current.rotation.x = Math.sin(t * 19) * 0.04 * r
  })
  if (!alive) return null
  return (
    <group position={[x, 0, z]}>
      <group ref={ref}>
        <mesh geometry={grassGeometry()} material={plasticVC()} />
      </group>
    </group>
  )
}

export function TallGrass() {
  return (
    <>
      {GRASS.map((_, i) => (
        <GrassClump key={i} index={i} />
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Stream with an invisible bank wall, and the bridge you build.        */
/* ------------------------------------------------------------------ */

const BRIDGE_SECONDS = 2.4
const BRIDGE_GAP = 1.6

export function StreamAndBridge() {
  const [built, setBuilt] = useState(false)
  const progress = useRef(0)
  const bridge = useRef<THREE.Group>(null)
  const pile = useRef<THREE.Group>(null)
  const pop = useRef(0)
  const [z0, z1] = STREAM_Z
  // walls either side of the bridge gap (always), and the gap itself until built
  useRegistry(true, () => ({
    platforms: [
      { x: STREAM_X, z: (z0 + BRIDGE_Z - BRIDGE_GAP) / 2, hw: 0.9, hd: (BRIDGE_Z - BRIDGE_GAP - z0) / 2, top: 6 },
      { x: STREAM_X, z: (BRIDGE_Z + BRIDGE_GAP + z1) / 2, hw: 0.9, hd: (z1 - BRIDGE_Z - BRIDGE_GAP) / 2, top: 6 },
    ],
  }))
  useRegistry(!built, () => ({
    platforms: [{ x: STREAM_X, z: BRIDGE_Z, hw: 0.9, hd: BRIDGE_GAP, top: 6 }],
    interact: [
      {
        x: BRIDGE_PILE[0],
        z: BRIDGE_PILE[1],
        r: 0.9,
        icon: 'build',
        hold: true,
        label: () => L().promptBuildBridge,
        build: (dt) => {
          progress.current = Math.min(1, progress.current + dt / BRIDGE_SECONDS)
          if (progress.current >= 1 && !lvl.bridgeBuilt) {
            sfx.built()
            fx.burst(STREAM_X, 0.6, BRIDGE_Z, ['#ffe08a', '#ffffff', COLORS.gopher, COLORS.brown], 24, 0.9)
            fx.studs(STREAM_X - 1, 0.6, BRIDGE_Z, 300)
            useGame.getState().toast(L().toastBridge)
            bridgeDone()
            setBuilt(true)
          }
          return progress.current
        },
      },
    ],
  }))
  const water = useMemo(() => {
    const m = plastic('#3a8fd8', { rough: 0.08 }).clone()
    m.transparent = true
    m.opacity = 0.92
    return m
  }, [])
  const banks = useMemo(() => {
    const out: StaticBrick[] = []
    for (let z = z0; z <= z1; z += 1.6) {
      out.push({ w: 2, d: 4, h: 1 / 3, c: COLORS.darkTan, p: [STREAM_X - 1.2, 0, z] })
      out.push({ w: 2, d: 4, h: 1 / 3, c: COLORS.darkTan, p: [STREAM_X + 1.2, 0, z] })
      if (Math.abs(z - BRIDGE_Z) > 2.2) {
        out.push({ w: 1, d: 1, h: 1, c: COLORS.grey, p: [STREAM_X - 1.15, BH / 3, z + 0.4] })
        out.push({ w: 2, d: 2, h: 1, c: COLORS.darkGrey, p: [STREAM_X + 1.25, BH / 3, z - 0.3] })
      }
    }
    return out
  }, [z0, z1])
  const bridgeBricks = useMemo(() => {
    const out: StaticBrick[] = []
    for (let i = -2; i <= 2; i++) out.push({ w: 10, d: 2, h: 1 / 3, c: i % 2 ? COLORS.gopher : '#a96a31', p: [0, 0.3, i * 0.8] })
    for (const side of [-1, 1]) {
      out.push({ w: 10, d: 1, h: 1 / 3, c: COLORS.reddishBrown, p: [0, 0.94, side * 2.0] })
      for (const x of [-1.8, 0, 1.8]) out.push({ w: 1, d: 1, h: 1, c: COLORS.brown, p: [x, 0.46, side * 2.0] })
    }
    return out
  }, [])
  useFrame((state, dt) => {
    if (pile.current) {
      const t = state.clock.elapsedTime
      pile.current.scale.setScalar(Math.max(0.001, 1 - progress.current))
      pile.current.children.forEach((c, i) => (c.position.y = Math.abs(Math.sin(t * 5 + i * 1.7)) * 0.16))
    }
    if (bridge.current && built && pop.current < 1) {
      pop.current = Math.min(1, pop.current + dt * 2.5)
      const k = pop.current
      bridge.current.scale.set(1, 1, 0.2 + 0.8 * (1 - (1 - k) ** 3))
      bridge.current.position.y = Math.sin(k * Math.PI) * 0.4
    }
  })
  const len = z1 - z0
  return (
    <>
      <mesh position={[STREAM_X, 0.03, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} material={water}>
        <planeGeometry args={[1.8, len]} />
      </mesh>
      <StaticBricks bricks={banks} />
      {!built && (
        <group ref={pile} position={[BRIDGE_PILE[0], 0, BRIDGE_PILE[1]]}>
          {[COLORS.gopher, '#a96a31', COLORS.brown, COLORS.gopher, COLORS.reddishBrown, '#a96a31'].map((c, i) => (
            <group key={i} position={[Math.cos(i * 2.4) * 0.45, 0, Math.sin(i * 2.4) * 0.45]}>
              <Brick w={2 + (i % 2) * 2} d={1} color={c} rotation={[0, i * 0.7, 0]} />
            </group>
          ))}
        </group>
      )}
      {built && (
        <group position={[STREAM_X, 0, BRIDGE_Z]} rotation={[0, Math.PI / 2, 0]}>
          <group ref={bridge}>
            <StaticBricks bricks={bridgeBricks} />
          </group>
        </group>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Bell on a crate under the dove tree.                                 */
/* ------------------------------------------------------------------ */

export function BellPost() {
  const swing = useRef(0)
  const bell = useRef<THREE.Group>(null)
  useRegistry(true, () => ({
    platforms: [{ x: BELL.x, z: BELL.z, hw: 0.8, hd: 0.8, top: BELL_TOP }],
    interact: [
      {
        x: BELL.x,
        z: BELL.z,
        r: 0.9,
        icon: 'bell',
        minY: BELL_TOP,
        label: () => L().promptRingBell,
        blockedLabel: () => L().promptClimbBell,
        hit: () => {
          swing.current = 1
          asfx.bell()
          fx.burst(BELL.x, BELL_TOP + 2, BELL.z, ['#ffe08a', '#ffffff'], 8, 0.5)
          if (!lvl.bellRung) fx.studs(BELL.x, BELL_TOP + 1, BELL.z, 200)
          ringBell()
        },
      },
    ],
  }))
  useFrame((state, dt) => {
    if (!bell.current) return
    swing.current = Math.max(0, swing.current - dt * 0.5)
    bell.current.rotation.z = Math.sin(state.clock.elapsedTime * 9) * 0.5 * swing.current
  })
  const bricks = useMemo<StaticBrick[]>(
    () => [
      { w: 4, d: 4, c: COLORS.brown, p: [0, 0, 0] },
      { w: 4, d: 4, c: COLORS.darkTan, p: [0, BH, 0] },
      { w: 1, d: 1, h: 5, c: COLORS.reddishBrown, p: [-0.6, BELL_TOP, -0.6] },
      { w: 4, d: 1, h: 1 / 3, c: COLORS.reddishBrown, p: [0, BELL_TOP + 5 * BH, -0.6] },
    ],
    [],
  )
  return (
    <group position={[BELL.x, 0, BELL.z]}>
      <StaticBricks bricks={bricks} />
      <group ref={bell} position={[0.3, BELL_TOP + 5 * BH, -0.6]}>
        <mesh position={[0, -0.12, 0]} material={plastic(COLORS.brown)}>
          <cylinderGeometry args={[0.03, 0.03, 0.24, 6]} />
        </mesh>
        <mesh position={[0, -0.5, 0]} material={plastic(COLORS.gold, { rough: 0.15, emissive: 0.15 })}>
          <cylinderGeometry args={[0.16, 0.34, 0.5, 14, 1, true]} />
        </mesh>
        <mesh position={[0, -0.25, 0]} material={plastic(COLORS.gold, { rough: 0.15 })}>
          <sphereGeometry args={[0.17, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, -0.72, 0]} material={plastic(COLORS.darkGrey)}>
          <sphereGeometry args={[0.07, 8, 6]} />
        </mesh>
      </group>
      <BlobShadow size={2.6} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* The big dove tree.                                                   */
/* ------------------------------------------------------------------ */

export function DoveTree() {
  useRegistry(true, () => ({ colliders: [{ x: DOVE_TREE.x, z: DOVE_TREE.z, r: 0.6 }] }))
  const bricks = useMemo<StaticBrick[]>(() => {
    const out: StaticBrick[] = []
    for (let k = 0; k < 6; k++) out.push({ w: 2, d: 2, c: k % 2 ? COLORS.brown : COLORS.reddishBrown, p: [0, k * BH, 0] })
    out.push({ w: 8, d: 8, c: COLORS.darkGreen, p: [0, 6 * BH, 0] })
    out.push({ w: 6, d: 6, c: COLORS.green, p: [0, 7 * BH, 0] })
    out.push({ w: 4, d: 4, c: COLORS.lime, p: [0, 8 * BH, 0] })
    // little white blossoms
    for (const [x, z] of [
      [1.4, 0.6],
      [-1.2, -1.3],
      [-1.5, 1.0],
    ])
      out.push({ w: 1, d: 1, h: 1 / 3, c: COLORS.white, p: [x, 7 * BH, z] })
    return out
  }, [])
  return (
    <group position={[DOVE_TREE.x, 0, DOVE_TREE.z]}>
      <StaticBricks bricks={bricks} fade />
      <BlobShadow size={4.5} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Giraffe hill: three tiers Noah hops up; an acacia on top.            */
/* ------------------------------------------------------------------ */

export function GiraffeHill() {
  const ids = useMemo(() => HILL_TIERS.map(() => newId()), [])
  useEffect(() => {
    HILL_TIERS.forEach((t, i) => {
      const p = { x: HILL.x, z: HILL.z, hw: t.hw, hd: t.hw, top: t.top }
      platforms.set(ids[i], p)
      hillPlatforms.add(p)
    })
    const tree = newId()
    colliders.set(tree, { x: HILL.x - 1.4, z: HILL.z - 1.4, r: 0.45 })
    return () => {
      ids.forEach((id) => {
        const p = platforms.get(id)
        if (p) hillPlatforms.delete(p)
        platforms.delete(id)
      })
      colliders.delete(tree)
    }
  }, [ids])
  const bricks = useMemo(() => {
    const out: StaticBrick[] = []
    HILL_TIERS.forEach((t, ti) => {
      const base = ti * 2 * BH
      const cell = ti === 1 ? 0.8 : 1.6
      const n = Math.round((t.hw * 2) / cell)
      const w = cell === 0.8 ? 2 : 4
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const x = -t.hw + cell / 2 + i * cell
          const z = -t.hw + cell / 2 + j * cell
          // only the rim below the next tier is visible: skip hidden bricks
          const inner = HILL_TIERS[ti + 1]
          const covered = inner && Math.abs(x) + cell / 2 <= inner.hw && Math.abs(z) + cell / 2 <= inner.hw
          out.push({ w, d: w, c: (i + j) % 3 === 0 ? '#7a5c36' : '#8a6a3f', p: [x, base, z], studs: false })
          if (!covered) out.push({ w, d: w, c: (i * 3 + j) % 5 === 0 ? COLORS.lime : COLORS.green, p: [x, base + BH, z] })
          else out.push({ w, d: w, c: '#8a6a3f', p: [x, base + BH, z], studs: false })
        }
      }
    })
    // acacia: thin trunk, flat wide canopy giraffes nibble
    const top = HILL_TIERS[2].top
    for (let k = 0; k < 5; k++) out.push({ w: 1, d: 1, c: COLORS.brown, p: [-1.4, top + k * BH, -1.4] })
    out.push({ w: 8, d: 6, h: 1 / 3, c: COLORS.darkGreen, p: [-1.0, top + 5 * BH, -1.2] })
    out.push({ w: 6, d: 4, h: 1 / 3, c: COLORS.green, p: [-1.0, top + 5 * BH + BH / 3, -1.2] })
    return out
  }, [])
  return (
    <group position={[HILL.x, 0, HILL.z]}>
      <StaticBricks bricks={bricks} fade />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Rabbit pen and the pond.                                             */
/* ------------------------------------------------------------------ */

export function RabbitPen() {
  const { bricks, posts } = useMemo(() => {
    const bricks: StaticBrick[] = []
    const posts: { x: number; z: number }[] = []
    const x0 = PEN.x - PEN.hw
    const x1 = PEN.x + PEN.hw
    const z0 = PEN.z - PEN.hd
    const z1 = PEN.z + PEN.hd
    const gate = (x: number, z: number) => z === z0 && Math.abs(x - PEN.gateX) < PEN.gateW / 2
    const edge = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az)
      const n = Math.round(len / 0.8)
      for (let i = 0; i <= n; i++) {
        const x = ax + ((bx - ax) * i) / n
        const z = az + ((bz - az) * i) / n
        if (gate(x, z)) continue
        posts.push({ x, z })
        bricks.push({ w: 1, d: 1, h: 2, c: COLORS.brown, p: [x, 0, z] })
      }
    }
    edge(x0, z0, x1, z0)
    edge(x0, z1, x1, z1)
    edge(x0, z0, x0, z1)
    edge(x1, z0, x1, z1)
    // rails between neighbouring posts
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i]
      const b = posts[i + 1]
      if (Math.hypot(a.x - b.x, a.z - b.z) > 0.9) continue
      const along = Math.abs(a.x - b.x) > 0.1
      bricks.push({ w: along ? 2 : 1, d: along ? 1 : 2, h: 1 / 3, c: COLORS.reddishBrown, p: [(a.x + b.x) / 2, BH * 1.3, (a.z + b.z) / 2] })
    }
    // carrots and lettuce inside
    for (const [x, z] of [
      [-2.5, 1.6],
      [-1.5, 1.6],
      [2.2, 2.2],
      [3.0, -1.6],
    ]) {
      bricks.push({ w: 1, d: 1, h: 1 / 3, c: COLORS.orange, p: [PEN.x + x, 0, PEN.z + z] })
      bricks.push({ w: 1, d: 1, h: 1 / 3, c: COLORS.lime, p: [PEN.x + x, BH / 3, PEN.z + z] })
    }
    return { bricks, posts }
  }, [])
  useRegistry(true, () => ({ colliders: posts.map((p) => ({ x: p.x, z: p.z, r: 0.38, top: BH * 2 })) }))
  return <StaticBricks bricks={bricks} />
}

export function Pond() {
  useRegistry(true, () => ({ colliders: [{ x: POND.x, z: POND.z, r: POND.r - 0.2 }] }))
  const reeds = useMemo<StaticBrick[]>(() => {
    const out: StaticBrick[] = []
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7 + 2.4
      const r = POND.r + 0.15
      out.push({ w: 1, d: 1, h: 2 + (i % 2), c: i % 3 ? COLORS.green : COLORS.lime, p: [Math.cos(a) * r, 0, Math.sin(a) * r], studs: false })
    }
    // lily pads
    out.push({ w: 2, d: 2, h: 1 / 3, c: COLORS.lime, p: [0.8, 0.04, -0.6] }, { w: 2, d: 2, h: 1 / 3, c: COLORS.green, p: [-1.1, 0.04, 0.9] })
    return out
  }, [])
  const water = useMemo(() => {
    const m = plastic('#3a8fd8', { rough: 0.06 }).clone()
    m.transparent = true
    m.opacity = 0.92
    return m
  }, [])
  return (
    <group position={[POND.x, 0, POND.z]}>
      <mesh position={[0, 0.02, 0]} material={plastic(COLORS.darkTan)}>
        <cylinderGeometry args={[POND.r + 0.35, POND.r + 0.45, 0.06, 28]} />
      </mesh>
      <mesh position={[0, 0.05, 0]} material={water}>
        <cylinderGeometry args={[POND.r, POND.r, 0.04, 28]} />
      </mesh>
      <StaticBricks bricks={reeds} />
    </group>
  )
}

