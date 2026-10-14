import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BlobShadow, Brick, Motes } from '../../three/common'
import { BH, COLORS, brickGeometry, plastic } from '../../three/bricks'
import { fx } from '../../three/Effects'
import { camFx, colliders, interactables, newId, pickups, platforms, player } from '../../game/world'
import { sfx } from '../../game/audio'
import { useGame } from '../../store'
import { buildLabels } from './gatherState'

type V3 = [number, number, number]

/** Registers a collider + interactable for the component's lifetime. */
function useRegister(
  enabled: boolean,
  make: (id: number) => { collider?: { x: number; z: number; r: number }; interact?: Parameters<typeof interactables.set>[1] },
) {
  const id = useMemo(newId, [])
  const makeRef = useRef(make)
  makeRef.current = make
  useEffect(() => {
    if (!enabled) return
    const { collider, interact } = makeRef.current(id)
    if (collider) colliders.set(id, collider)
    if (interact) interactables.set(id, interact)
    return () => {
      colliders.delete(id)
      interactables.delete(id)
    }
  }, [enabled, id])
  return id
}

/* ------------------------------------------------------------------ */
/* Gopher wood tree: three chops, it topples and bursts into bricks.   */
/* ------------------------------------------------------------------ */

export function GopherTree({ position, onWood }: { position: V3; onWood: () => void }) {
  const [state, setState] = useState<'standing' | 'falling' | 'gone'>('standing')
  const hits = useRef(0)
  const shake = useRef(0)
  const fall = useRef(0)
  const fallDir = useRef(0)
  const tree = useRef<THREE.Group>(null)
  const [x, , z] = position

  useRegister(state === 'standing', (id) => ({
    collider: { x, z, r: 0.55 },
    interact: {
      id,
      kind: 'chop',
      x,
      z,
      r: 0.55,
      hit: () => {
        hits.current++
        shake.current = 1
        camFx.shake = Math.max(camFx.shake, 0.35)
        sfx.chop()
        fx.burst(x, 1.0, z, [COLORS.gopher, COLORS.brown], 5, 0.5)
        fx.studs(x, 1, z, 30)
        if (hits.current >= 3) {
          fallDir.current = Math.atan2(x - player.pos.x, z - player.pos.z)
          setState('falling')
        }
      },
    },
  }))

  // the stump that remains is solid and low enough to stand on
  useRegister(state === 'gone', () => ({ collider: { x, z, r: 0.45, top: BH } }))

  useFrame((_, dt) => {
    const g = tree.current
    if (!g) return
    if (shake.current > 0) {
      shake.current = Math.max(0, shake.current - dt * 4)
      g.rotation.z = Math.sin(shake.current * 40) * 0.08 * shake.current
    }
    if (state === 'falling') {
      fall.current += dt * 2.2
      const f = Math.min(1, fall.current * fall.current)
      g.rotation.set(0, fallDir.current, 0)
      g.rotateX(f * (Math.PI / 2))
      if (fall.current >= 1) {
        const tx = x + Math.sin(fallDir.current) * 1.6
        const tz = z + Math.cos(fallDir.current) * 1.6
        fx.burst(tx, 0.3, tz, [COLORS.gopher, COLORS.green, COLORS.darkGreen, COLORS.lime], 26, 1.1)
        fx.studs(tx, 0.3, tz, 200)
        sfx.smash()
        camFx.shake = 1
        onWood()
        setState('gone')
      }
    }
  })

  return (
    <group position={position}>
      {/* stump stays behind */}
      <Brick w={2} d={2} h={1} color={COLORS.gopher} />
      {state !== 'gone' && (
        <group ref={tree} position={[0, BH, 0]}>
          {[0, 1, 2, 3].map((i) => (
            <Brick key={i} w={2} d={2} color={i % 2 ? COLORS.gopher : '#a96a31'} position={[0, i * BH, 0]} fade />
          ))}
          <Brick w={6} d={6} color={COLORS.darkGreen} position={[0, 4 * BH, 0]} fade />
          <Brick w={5} d={5} color={COLORS.green} position={[0, 5 * BH, 0]} fade />
          <Brick w={3} d={3} color={COLORS.lime} position={[0, 6 * BH, 0]} fade />
          {/* golden glint marks the trees God's builder needs */}
          {state === 'standing' && <Motes count={10} area={[1.6, 1.6]} height={3} color="#ffd75e" size={9} rise={0.5} />}
        </group>
      )}
      <BlobShadow size={2.6} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* One-hit smashables: bushes, crates, pots, fences.                    */
/* ------------------------------------------------------------------ */

export type SmashKind = 'bush' | 'crate' | 'pot' | 'fence'

// `top` = standing height, so Noah can hop onto them
const SMASH_DEF: Record<SmashKind, { colors: string[]; studs: number; r: number; top: number }> = {
  bush: { colors: [COLORS.green, COLORS.lime, COLORS.darkGreen], studs: 60, r: 0.6, top: BH * 2 },
  crate: { colors: [COLORS.brown, COLORS.darkTan], studs: 120, r: 0.5, top: BH + BH / 3 },
  pot: { colors: [COLORS.orange, COLORS.red], studs: 150, r: 0.4, top: 0.76 },
  fence: { colors: [COLORS.brown, COLORS.reddishBrown], studs: 40, r: 0.5, top: BH * 2 },
}

export function Smashable({ kind, position, rotation = 0 }: { kind: SmashKind; position: V3; rotation?: number }) {
  const [alive, setAlive] = useState(true)
  const def = SMASH_DEF[kind]
  const [x, , z] = position
  useRegister(alive, (id) => ({
    collider: { x, z, r: def.r, top: def.top },
    interact: {
      id,
      kind: 'smash',
      x,
      z,
      r: def.r,
      hit: () => {
        sfx.smash()
        fx.burst(x, 0.4, z, def.colors, 16)
        fx.studs(x, 0.4, z, def.studs)
        setAlive(false)
      },
    },
  }))
  if (!alive) return null
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {kind === 'bush' && (
        <>
          <Brick w={3} d={3} color={COLORS.darkGreen} />
          <Brick w={2} d={2} color={COLORS.green} position={[0, BH, 0]} />
        </>
      )}
      {kind === 'crate' && (
        <>
          <Brick w={2} d={2} color={COLORS.brown} />
          <Brick w={2} d={2} h={1 / 3} color={COLORS.darkTan} position={[0, BH, 0]} />
        </>
      )}
      {kind === 'pot' && (
        <>
          <mesh geometry={potGeo} material={plastic(COLORS.orange)} position={[0, 0.3, 0]} />
          <Brick w={1} d={1} h={1 / 3} color={COLORS.red} position={[0, 0.6, 0]} />
        </>
      )}
      {kind === 'fence' && (
        <>
          <Brick w={1} d={1} h={2} color={COLORS.brown} position={[-0.6, 0, 0]} />
          <Brick w={1} d={1} h={2} color={COLORS.brown} position={[0.6, 0, 0]} />
          <Brick w={4} d={1} h={1 / 3} color={COLORS.reddishBrown} position={[0, BH * 1.3, 0]} />
        </>
      )}
      <BlobShadow size={def.r * 2.6} />
    </group>
  )
}

const potGeo = new THREE.CylinderGeometry(0.22, 0.3, 0.6, 12)

/* ------------------------------------------------------------------ */
/* Hold-to-build: a bouncing brick pile assembles into a model.         */
/* ------------------------------------------------------------------ */

export type ModelBrick = { w: number; d: number; h?: number; c: string; p: V3; ry?: number }

const BUILD_SECONDS = 2.4

export function BuildPile({
  position,
  model,
  radius,
  ready,
  onBuilt,
  built,
  pileColors,
  children,
}: {
  position: V3
  model: ModelBrick[]
  radius: number
  ready: () => boolean
  onBuilt: () => void
  built: boolean
  pileColors: string[]
  children?: React.ReactNode
}) {
  const progress = useRef(built ? 1 : 0)
  const done = useRef(built)
  const [shown, setShown] = useState(built ? model.length : 0)
  const pile = useRef<THREE.Group>(null)
  const drops = useRef<(THREE.Object3D | null)[]>([])
  const dropT = useRef<number[]>(model.map(() => 0))
  const [x, , z] = position

  useRegister(!built, (id) => ({
    collider: { x, z, r: radius * 0.7 },
    interact: {
      id,
      kind: 'build',
      x,
      z,
      r: radius * 0.7,
      ready,
      build: (dt) => {
        progress.current = Math.min(1, progress.current + dt / BUILD_SECONDS)
        const n = Math.ceil(progress.current * model.length)
        setShown((prev) => (prev === n ? prev : n))
        if (progress.current >= 1 && !done.current) {
          done.current = true
          sfx.built()
          fx.burst(x, 1, z, ['#ffe08a', '#ffffff', ...pileColors], 24, 0.9)
          fx.studs(x, 1, z, 300)
          onBuilt()
        }
        return progress.current
      },
    },
  }))

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    if (pile.current) {
      const p = 1 - shown / model.length
      pile.current.scale.setScalar(Math.max(0.001, p))
      pile.current.visible = p > 0.01
      pile.current.children.forEach((c, i) => {
        // the jiggling "you can build me" pile
        c.position.y = Math.abs(Math.sin(t * 5 + i * 1.7)) * 0.18
        c.rotation.y = Math.sin(t * 2 + i) * 0.3
      })
    }
    for (let i = 0; i < shown; i++) {
      const o = drops.current[i]
      if (!o) continue
      if (dropT.current[i] < 1) {
        dropT.current[i] = Math.min(1, dropT.current[i] + dt * 5)
        const k = dropT.current[i]
        // fly in from the pile with a little overshoot bounce
        const bounce = Math.sin(k * Math.PI) * 1.2
        o.position.set(model[i].p[0] * k, model[i].p[1] + bounce * (1 - k * 0.5), model[i].p[2] * k)
        o.scale.setScalar(0.6 + 0.4 * k)
      }
    }
  })

  const pileBricks = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        p: [Math.cos(i * 2.4) * radius * 0.45 * ((i % 3) / 2 + 0.3), 0, Math.sin(i * 2.4) * radius * 0.45 * ((i % 3) / 2 + 0.3)] as V3,
        c: pileColors[i % pileColors.length],
        w: 1 + (i % 2),
      })),
    [pileColors, radius],
  )

  return (
    <group position={position}>
      <group ref={pile}>
        {pileBricks.map((b, i) => (
          <group key={i} position={b.p}>
            <Brick w={b.w} d={2} color={b.c} />
          </group>
        ))}
      </group>
      {model.slice(0, shown).map((b, i) => (
        <mesh
          key={i}
          ref={(o) => {
            drops.current[i] = o
          }}
          geometry={brickGeometry(b.w, b.d, b.h ?? 1)}
          material={plastic(b.c)}
          position={built ? b.p : [0, b.p[1], 0]}
          rotation={[0, b.ry ?? 0, 0]}
        />
      ))}
      {shown === model.length && children}
      <BlobShadow size={radius * 2.4} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Build spot: a hold-to-build pile that drives someone else's model.  */
/* ------------------------------------------------------------------ */

/**
 * A jiggling brick pile you hold the action on. Unlike BuildPile it renders
 * no model itself: it reports 0..1 progress so a bigger structure (the ark)
 * can grow from it. Mount it only while its step is active.
 */
export function BuildSpot({
  position,
  radius = 0.8,
  seconds = BUILD_SECONDS,
  pileColors,
  ready,
  onProgress,
  onBuilt,
  label,
  needLabel,
  pile = true,
  children,
}: {
  position: V3
  radius?: number
  seconds?: number
  pileColors: string[]
  ready?: () => boolean
  onProgress?: (p: number) => void
  onBuilt: () => void
  label?: () => string
  needLabel?: () => string
  /** show the default brick pile (turn off to use custom children as the visual) */
  pile?: boolean
  children?: React.ReactNode
}) {
  const progress = useRef(0)
  const done = useRef(false)
  const appear = useRef(0)
  const root = useRef<THREE.Group>(null)
  const pileRef = useRef<THREE.Group>(null)
  const [x, , z] = position
  const cb = useRef({ onProgress, onBuilt, ready, label, needLabel })
  useEffect(() => {
    cb.current = { onProgress, onBuilt, ready, label, needLabel }
  })

  const id = useRegister(true, (rid) => ({
    collider: { x, z, r: radius * 0.6 },
    interact: {
      id: rid,
      kind: 'build',
      x,
      z,
      r: radius * 0.7,
      ready: () => (cb.current.ready ? cb.current.ready() : true),
      build: (dt) => {
        if (done.current) return 1
        progress.current = Math.min(1, progress.current + dt / seconds)
        cb.current.onProgress?.(progress.current)
        if (progress.current >= 1) {
          done.current = true
          sfx.built()
          fx.burst(x, 1, z, ['#ffe08a', '#ffffff', ...pileColors], 24, 0.9)
          fx.studs(x, 1, z, 300)
          cb.current.onBuilt()
        }
        return progress.current
      },
    },
  }))
  useEffect(() => {
    buildLabels.set(id, { ready: () => cb.current.label?.() ?? '', need: () => cb.current.needLabel?.() ?? '' })
    // a little pop so a newly unlocked spot catches the eye
    fx.burst(x, 0.4, z, ['#ffe08a', '#ffffff'], 8, 0.5)
    return () => {
      buildLabels.delete(id)
    }
  }, [id, x, z])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    if (root.current && appear.current < 1) {
      appear.current = Math.min(1, appear.current + dt * 3)
      const k = appear.current
      root.current.scale.setScalar(Math.max(0.001, k + Math.sin(k * Math.PI) * 0.35))
    }
    const g = pileRef.current
    if (g) {
      g.scale.setScalar(Math.max(0.001, 1 - progress.current * 0.85))
      g.children.forEach((c, i) => {
        c.position.y = Math.abs(Math.sin(t * 5 + i * 1.7)) * 0.18
        c.rotation.y = Math.sin(t * 2 + i) * 0.3
      })
    }
  })

  const pileBricks = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        p: [Math.cos(i * 2.4) * radius * 0.5 * ((i % 3) / 2 + 0.3), 0, Math.sin(i * 2.4) * radius * 0.5 * ((i % 3) / 2 + 0.3)] as V3,
        c: pileColors[i % pileColors.length],
        w: 1 + (i % 2),
      })),
    [pileColors, radius],
  )

  return (
    <group position={position}>
      <group ref={root}>
        {pile && (
          <group ref={pileRef}>
            {pileBricks.map((b, i) => (
              <group key={i} position={b.p}>
                <Brick w={b.w} d={2} color={b.c} />
              </group>
            ))}
          </group>
        )}
        {children}
      </group>
      <BlobShadow size={radius * 2.2} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Pickups                                                              */
/* ------------------------------------------------------------------ */

export function PitchJar({ position, onCollect }: { position: V3; onCollect: () => void }) {
  const [alive, setAlive] = useState(true)
  const ref = useRef<THREE.Group>(null)
  const id = useMemo(newId, [])
  const onCollectRef = useRef(onCollect)
  onCollectRef.current = onCollect
  useEffect(() => {
    if (!alive) return
    pickups.set(id, {
      id,
      x: position[0],
      z: position[2],
      collect: () => {
        sfx.pickup()
        fx.burst(position[0], 0.8, position[2], ['#ffe08a', COLORS.pitch], 10, 0.6)
        onCollectRef.current()
        setAlive(false)
      },
    })
    return () => {
      pickups.delete(id)
    }
  }, [alive, id, position])

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = 0.35 + Math.sin(state.clock.elapsedTime * 3 + position[0]) * 0.12
      ref.current.rotation.y = state.clock.elapsedTime * 1.6
    }
  })
  if (!alive) return null
  return (
    <group position={position}>
      <group ref={ref}>
        <mesh geometry={potGeo} material={plastic(COLORS.pitch, { rough: 0.15 })} scale={0.7} position={[0, 0.2, 0]} />
        <Brick w={1} d={1} h={1 / 3} color={COLORS.gold} position={[0, 0.41, 0]} emissive={0.25} />
      </group>
      <Motes count={8} area={[1, 1]} height={1.6} color="#ffd75e" size={8} rise={0.6} />
      <BlobShadow size={0.9} />
    </group>
  )
}

/** Collects pickups when Noah walks over them. */
export function PickupCollector() {
  useFrame(() => {
    for (const p of pickups.values()) {
      if (Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 0.9 && player.pos.y < 1.2) {
        pickups.delete(p.id)
        p.collect()
      }
    }
  })
  return null
}


/* ------------------------------------------------------------------ */
/* Crate stack you can jump onto.                                       */
/* ------------------------------------------------------------------ */

export function CrateStack({ position, levels }: { position: V3; levels: number }) {
  const id = useMemo(newId, [])
  const [x, , z] = position
  useEffect(() => {
    platforms.set(id, { x, z, hw: 0.8, hd: 0.8, top: levels * BH * 2 })
    return () => {
      platforms.delete(id)
    }
  }, [id, x, z, levels])
  return (
    <group position={position}>
      {Array.from({ length: levels * 2 }, (_, i) => (
        <Brick key={i} w={4} d={4} color={i % 2 ? COLORS.darkTan : COLORS.brown} position={[0, i * BH, 0]} />
      ))}
      <BlobShadow size={2.6} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Studs placed in the world (trails, rewards on ledges). One draw call. */
/* ------------------------------------------------------------------ */

export type PlacedStud = { p: V3; value: 10 | 100 | 1000 }

const PLACED_COLORS = { 10: new THREE.Color('#d9dde2'), 100: new THREE.Color('#f2c230'), 1000: new THREE.Color('#3a8ee6') }

export function PlacedStuds({ studs }: { studs: PlacedStud[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const alive = useRef(studs.map(() => true))
  const geo = useMemo(() => new THREE.CylinderGeometry(0.16, 0.16, 0.08, 14).rotateX(Math.PI / 2), [])
  const mat = useMemo(() => {
    const m = plastic('#ffffff', { rough: 0.12 }).clone()
    m.metalness = 0.6
    m.emissive = new THREE.Color('#333')
    return m
  }, [])
  const o = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    const m = ref.current
    if (!m) return
    studs.forEach((s, i) => m.setColorAt(i, PLACED_COLORS[s.value]))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [studs])
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    const t = state.clock.elapsedTime
    let got = 0
    studs.forEach((s, i) => {
      if (!alive.current[i]) return
      const dx = player.pos.x - s.p[0]
      const dy = player.pos.y + 0.7 - s.p[1]
      const dz = player.pos.z - s.p[2]
      if (dx * dx + dy * dy + dz * dz < 0.8) {
        alive.current[i] = false
        got += s.value
        sfx.stud(s.value)
        o.scale.setScalar(0)
        o.updateMatrix()
        m.setMatrixAt(i, o.matrix)
        return
      }
      o.position.set(s.p[0], s.p[1] + Math.sin(t * 3 + i * 0.5) * 0.08, s.p[2])
      o.rotation.set(0, t * 2.5 + i * 0.3, 0)
      o.scale.setScalar(s.value >= 1000 ? 1.6 : s.value >= 100 ? 1.25 : 1)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    if (got) useGame.getState().addStuds(got)
  })
  return <instancedMesh ref={ref} args={[geo, mat, studs.length]} frustumCulled={false} />
}
