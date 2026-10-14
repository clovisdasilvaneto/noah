import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Minifig, makePose, type Look } from '../../three/Minifig'
import { BlobShadow } from '../../three/common'
import { COLORS, plasticVC } from '../../three/bricks'
import { colliders, newId, player, surfaceHeight } from '../../game/world'
import { fx } from '../../three/Effects'
import { sfx } from '../../game/audio'
import { gatherStep, useGame, useT } from '../../store'
import type { NpcId } from '../../i18n/strings'

type V3 = [number, number, number]

const TALK_RADIUS = 2.6
const LINE_SECONDS = 3.6

/**
 * Wander inside a circle around `home`, pausing now and then. Returns the
 * current planar speed (0..1) so the caller can animate legs. Also keeps a
 * moving collider registered so Noah bumps into the character.
 */
function useWander(home: V3, radius: number, speed: number, bodyR: number, stop: () => boolean) {
  const pos = useRef(new THREE.Vector3(...home))
  const target = useRef(new THREE.Vector3(...home))
  const wait = useRef(Math.random() * 2)
  const facing = useRef(Math.random() * Math.PI * 2)
  const id = useMemo(newId, [])
  useEffect(() => {
    colliders.set(id, { x: home[0], z: home[2], r: bodyR })
    return () => {
      colliders.delete(id)
    }
  }, [id, home, bodyR])

  const step = (dt: number) => {
    let moving = 0
    if (stop()) {
      wait.current = 1.5
    } else if (wait.current > 0) {
      wait.current -= dt
      if (wait.current <= 0) {
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random()) * radius
        target.current.set(home[0] + Math.cos(a) * r, 0, home[2] + Math.sin(a) * r)
      }
    } else {
      const dx = target.current.x - pos.current.x
      const dz = target.current.z - pos.current.z
      const d = Math.hypot(dx, dz)
      if (d < 0.15) {
        wait.current = 1.5 + Math.random() * 3
      } else {
        pos.current.x += (dx / d) * speed * dt
        pos.current.z += (dz / d) * speed * dt
        const want = Math.atan2(dx, dz)
        const diff = Math.atan2(Math.sin(want - facing.current), Math.cos(want - facing.current))
        facing.current += diff * (1 - Math.exp(-dt * 8))
        moving = 1
      }
    }
    const c = colliders.get(id)
    if (c) {
      c.x = pos.current.x
      c.z = pos.current.z
    }
    return moving
  }
  return { pos, facing, step }
}

export type NpcDef = {
  id: NpcId
  look: Look
  home: V3
  radius: number
  /** Noah's family: their first line is a hint for the current step (0 or 1 picks the variant) */
  hint?: 0 | 1
  /** where they cheer once the ark is finished */
  party?: V3
}

function Npc({ def }: { def: NpcDef }) {
  const s = useT()
  const group = useRef<THREE.Group>(null)
  const pose = useRef(makePose())
  const talking = useRef(false)
  const lineT = useRef(0)
  const [bubble, setBubble] = useState<number | null>(null)
  const partying = useRef(false)
  const { pos, facing, step } = useWander(def.home, def.radius, 1.3, 0.35, () => talking.current || partying.current)
  const levelStep = useGame(gatherStep)
  const lines = useMemo(
    () => (def.hint === undefined ? s.npcLines[def.id] : [s.hints[levelStep]?.[def.hint] ?? '', ...s.npcLines[def.id]].filter(Boolean)),
    [s, def.id, def.hint, levelStep],
  )
  const lineCount = useRef(lines.length)
  useEffect(() => {
    lineCount.current = lines.length
  }, [lines])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const g = group.current
    if (!g) return
    if (def.party && useGame.getState().arkComplete) {
      // the ark is finished: pop over to it and cheer
      if (!partying.current) {
        partying.current = true
        talking.current = false
        setBubble(null)
        fx.puff(pos.current.x, 0.1, pos.current.z)
        pos.current.set(def.party[0], 0, def.party[2])
        fx.puff(pos.current.x, 0.1, pos.current.z)
      }
      step(dt)
      facing.current += (0 - facing.current) * (1 - Math.exp(-dt * 6))
      pose.current.speed = 0
      pose.current.wave = 0
      pose.current.raiseArms = 1
      const hop = Math.max(0, Math.sin(state.clock.elapsedTime * 7 + def.party[0]))
      g.position.set(pos.current.x, surfaceHeight(pos.current.x, pos.current.z) + hop * 0.3, pos.current.z)
      g.rotation.y = facing.current
      return
    }
    const dx = player.pos.x - pos.current.x
    const dz = player.pos.z - pos.current.z
    const near = dx * dx + dz * dz < TALK_RADIUS * TALK_RADIUS
    if (near && !talking.current) {
      talking.current = true
      lineT.current = 0
      setBubble((b) => (b === null ? 0 : (b + 1) % lineCount.current))
    } else if (!near && talking.current) {
      talking.current = false
      setBubble(null)
    }
    if (talking.current) {
      // turn to Noah, wave, and cycle through lines
      const want = Math.atan2(dx, dz)
      const diff = Math.atan2(Math.sin(want - facing.current), Math.cos(want - facing.current))
      facing.current += diff * (1 - Math.exp(-dt * 8))
      lineT.current += dt
      if (lineT.current > LINE_SECONDS) {
        lineT.current = 0
        setBubble((b) => ((b ?? 0) + 1) % lineCount.current)
      }
    }
    const moving = step(dt)
    pose.current.speed += (moving * 0.45 - pose.current.speed) * (1 - Math.exp(-dt * 8))
    pose.current.wave = talking.current && lineT.current < 1.2 ? 1 : 0
    g.position.set(pos.current.x, surfaceHeight(pos.current.x, pos.current.z), pos.current.z)
    g.rotation.y = facing.current
  })

  return (
    <group ref={group}>
      <Minifig pose={pose} look={def.look} />
      <BlobShadow size={1.1} />
      {bubble !== null && (
        <Html position={[0, 2.25, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="npc-bubble" key={bubble}>
            <span className="npc-name">{s.npcNames[def.id]}</span>
            {lines[bubble % lines.length]}
          </div>
        </Html>
      )}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Sheep: one merged vertex-coloured mesh each, with a hop when walking */
/* ------------------------------------------------------------------ */

let sheepGeo: THREE.BufferGeometry | null = null
function sheepGeometry() {
  if (sheepGeo) return sheepGeo
  const paint = (g: THREE.BufferGeometry, color: string, x: number, y: number, z: number) => {
    const ng = g.toNonIndexed().translate(x, y, z)
    const c = new THREE.Color(color)
    const n = ng.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3)
    ng.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    return ng
  }
  const wool = '#f4f1ea'
  const parts = [
    paint(new THREE.BoxGeometry(0.62, 0.42, 0.9), wool, 0, 0.55, 0),
    paint(new THREE.BoxGeometry(0.5, 0.12, 0.7), wool, 0, 0.8, 0),
    paint(new THREE.BoxGeometry(0.3, 0.3, 0.32), COLORS.black, 0, 0.72, 0.55),
    paint(new THREE.BoxGeometry(0.1, 0.06, 0.16), COLORS.black, -0.18, 0.8, 0.5),
    paint(new THREE.BoxGeometry(0.1, 0.06, 0.16), COLORS.black, 0.18, 0.8, 0.5),
  ]
  for (const [x, z] of [
    [-0.2, -0.3],
    [0.2, -0.3],
    [-0.2, 0.3],
    [0.2, 0.3],
  ])
    parts.push(paint(new THREE.BoxGeometry(0.12, 0.36, 0.12), COLORS.black, x, 0.18, z))
  sheepGeo = mergeGeometries(parts, false)!
  sheepGeo.computeVertexNormals()
  return sheepGeo
}

function Sheep({ home }: { home: V3 }) {
  const group = useRef<THREE.Group>(null)
  const baaCooldown = useRef(0)
  const { pos, facing, step } = useWander(home, 3, 0.8, 0.45, () => false)
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const g = group.current
    if (!g) return
    const moving = step(dt)
    baaCooldown.current -= dt
    const d = Math.hypot(player.pos.x - pos.current.x, player.pos.z - pos.current.z)
    if (d < 2 && baaCooldown.current <= 0) {
      sfx.baa()
      baaCooldown.current = 6
    }
    const floor = surfaceHeight(pos.current.x, pos.current.z)
    g.position.set(pos.current.x, floor + (moving ? Math.abs(Math.sin(state.clock.elapsedTime * 10)) * 0.08 : 0), pos.current.z)
    g.rotation.y = facing.current
  })
  return (
    <group ref={group}>
      <mesh geometry={sheepGeometry()} material={plasticVC()} />
      <BlobShadow size={1.2} />
    </group>
  )
}

const NPCS: NpcDef[] = [
  { id: 'wife', home: [-9, 0, 7.6], radius: 1.4, hint: 0, party: [-2.2, 0, -12.4], look: { robe: '#4a7ab8', legs: '#2f4f7a', hood: '#d9c7a5', beard: null } },
  { id: 'shem', home: [-4, 0, -10.5], radius: 1.5, hint: 1, party: [-3.7, 0, -13.1], look: { robe: COLORS.white, legs: COLORS.brown, hood: COLORS.reddishBrown, beard: '#5a3a1e' } },
  { id: 'ham', home: [6.5, 0, -1.5], radius: 1.5, hint: 0, party: [2.2, 0, -12.4], look: { robe: COLORS.orange, legs: COLORS.darkTan, hood: COLORS.black, beard: COLORS.black } },
  { id: 'japheth', home: [4.5, 0, -10.5], radius: 1.5, hint: 1, party: [3.7, 0, -13.1], look: { robe: COLORS.green, legs: COLORS.reddishBrown, hood: COLORS.sand, beard: '#a0522d' } },
  { id: 'villagerA', home: [-15.5, 0, 1.5], radius: 2, party: [-6.6, 0, -11.6], look: { robe: COLORS.red, legs: COLORS.darkGrey, hood: COLORS.white, beard: COLORS.grey } },
  { id: 'villagerB', home: [-9, 0, -3.5], radius: 1.6, party: [6.6, 0, -11.6], look: { robe: '#8e5bb0', legs: COLORS.brown, hood: COLORS.yellow, beard: null } },
]

export function Npcs() {
  return (
    <>
      {NPCS.map((n) => (
        <Npc key={n.id} def={n} />
      ))}
      <Sheep home={[7, 0, 8]} />
      <Sheep home={[8.5, 0, 9]} />
    </>
  )
}
