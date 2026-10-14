// The finished ark: gopher-wood brick hull coated with pitch below the
// waterline, a cabin with windows, and the door in its side (Genesis 6:16)
// that folds down into the ramp and swings shut at the end. Noah's family
// waits at the ramp, greets the animals and gives hints.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { BlobShadow, StaticBricks, type StaticBrick } from '../../three/common'
import { BH, COLORS, plastic, plasticVC } from '../../three/bricks'
import { Minifig, makePose, type Look } from '../../three/Minifig'
import { colliders, newId, platforms, player, surfaceHeight } from '../../game/world'
import { STRINGS } from '../../i18n/strings'
import { ANIMALS_STRINGS, type FamilyId } from '../../i18n/animals'
import { useGame } from '../../store'
import { box, merge } from './models'
import { agents } from './Animals'
import { ARK, DECK_Y, DOOR_H, DOOR_W, DOOR_X, HULL_FRONT, HULL_HALF_L, HULL_HALF_W, RAMP_FOOT, RAMP_RUN, type V3 } from './layout'

/** Shared with the closing cutscene. */
export const arkFx = { doorAngle: (2 * Math.PI) / 3, cheer: 0 }
export const DOOR_OPEN = (2 * Math.PI) / 3

const S = 0.4 // one stud
const LAYERS = 9
const TOP = LAYERS * BH
const RECESS = 2.0
const GOPHER = [COLORS.gopher, '#a96a31']

function hullBricks(): StaticBrick[] {
  const out: StaticBrick[] = []
  const doorL = DOOR_X - DOOR_W / 2 - ARK.x
  const doorR = DOOR_X + DOOR_W / 2 - ARK.x
  const studs = (len: number) => Math.max(1, Math.round(len / S))
  // a slab from x0..x1, z0..z1 (local), one brick tall
  const slab = (x0: number, x1: number, z0: number, z1: number, y: number, c: string) =>
    out.push({ w: studs(x1 - x0), d: studs(z1 - z0), c, p: [(x0 + x1) / 2, y, (z0 + z1) / 2], studs: false })
  for (let k = 0; k < LAYERS; k++) {
    const y = k * BH
    const hl = HULL_HALF_L - Math.max(0, 3 - k) * 0.8
    const hw = HULL_HALF_W - Math.max(0, 2 - k) * 0.4
    const pitch = k < 2
    const c = pitch ? COLORS.pitch : GOPHER[k % 2]
    const front = hw - S
    if (k < 3) {
      slab(-hl, hl, -hw, front, y, c)
    } else {
      // leave a dark recess behind the door
      slab(-hl, doorL, -hw, front, y, c)
      slab(doorR, hl, -hw, front, y, c)
      slab(doorL, doorR, -hw, front - RECESS, y, c)
    }
    // the front face in staggered 1x4 bricks (running bond), with the door gap
    const off = k % 2 ? 0.8 : 0
    for (let x = -hl + off; x < hl - 0.01; x += 1.6) {
      const x0 = Math.max(x, -hl)
      const x1 = Math.min(x + 1.6, hl)
      const segs: [number, number][] =
        k >= 3 && x1 > doorL && x0 < doorR
          ? ([
              [x0, Math.min(x1, doorL)],
              [Math.max(x0, doorR), x1],
            ] as [number, number][]).filter(([a, b]) => b - a > 0.2)
          : [[x0, x1]]
      for (const [a, b] of segs) {
        const shade = pitch ? (((x / 1.6) | 0) % 2 ? COLORS.pitch : '#3a302a') : ((x / 1.6 + k) | 0) % 3 === 0 ? '#c4864a' : c
        out.push({ w: studs(b - a), d: 1, c: shade, p: [(a + b) / 2, y, hw - S / 2], studs: false })
      }
    }
    // back face shows on the far side only from above; the slab covers it
  }
  // pitch waterline stripe and a row of little windows near the top
  out.push({ w: studs(HULL_HALF_L * 2) - 2, d: 1, h: 1 / 3, c: COLORS.pitch, p: [0, 2 * BH, HULL_HALF_W - S / 2 + 0.06], studs: false })
  for (let x = -8; x <= 8; x += 2.4) {
    if (x + 0.4 > doorL - 0.2 && x - 0.4 < doorR + 0.2) continue
    out.push({ w: 2, d: 1, h: 1, c: '#2a1c12', p: [x, 7 * BH, HULL_HALF_W - S / 2 + 0.04], studs: false })
  }
  // deck, rails and the cabin with its stepped roof
  out.push({ w: studs(HULL_HALF_L * 2), d: studs(HULL_HALF_W * 2), h: 1 / 3, c: COLORS.darkTan, p: [0, TOP, 0], studs: false })
  const deck = TOP + BH / 3
  for (const z of [HULL_HALF_W - S / 2, -HULL_HALF_W + S / 2]) {
    for (let x = -9.2; x <= 9.2; x += 1.6) out.push({ w: 4, d: 1, c: COLORS.reddishBrown, p: [x, deck, z] })
  }
  const cx0 = -6.4
  const cx1 = 3.6
  const cz = 2.0
  for (let k = 0; k < 4; k++) {
    out.push({ w: studs(cx1 - cx0), d: studs(cz * 2), c: k % 2 ? '#a96a31' : COLORS.gopher, p: [(cx0 + cx1) / 2, deck + k * BH, 0], studs: false })
  }
  for (let x = cx0 + 1.2; x < cx1 - 0.6; x += 2) out.push({ w: 2, d: 1, h: 1, c: '#2a1c12', p: [x, deck + 1.5 * BH, cz + 0.02], studs: false })
  const roofY = deck + 4 * BH
  for (let k = 0; k < 6; k++) {
    const d = 13 - k * 2
    out.push({ w: studs(cx1 - cx0) + 2, d, h: 2 / 3, c: k % 2 ? '#8e3a22' : COLORS.reddishBrown, p: [(cx0 + cx1) / 2, roofY + k * BH * (2 / 3), 0], studs: k === 5 })
  }
  return out
}

/** The drawbridge door: planks with cleats on the walking face. */
function doorGeometry() {
  const parts: THREE.BufferGeometry[] = []
  const n = 6
  const ph = DOOR_H / n
  for (let i = 0; i < n; i++) parts.push(box(DOOR_W - 0.04, ph - 0.03, 0.2, i % 2 ? '#a96a31' : COLORS.gopher, [0, ph * (i + 0.5), 0.1]))
  // cleats so hooves and paws don't slip (they stick up when the ramp is down)
  for (let i = 1; i < n * 2; i += 2) parts.push(box(DOOR_W - 0.3, 0.07, 0.06, COLORS.reddishBrown, [0, (ph / 2) * i, -0.03]))
  // iron straps on the outer face
  for (const y of [0.5, DOOR_H - 0.5]) parts.push(box(DOOR_W - 0.2, 0.12, 0.04, COLORS.darkGrey, [0, y, 0.22]))
  return merge(parts)
}

export function Ark() {
  const bricks = useMemo(hullBricks, [])
  const door = useRef<THREE.Group>(null)
  const doorGeo = useMemo(doorGeometry, [])
  const dark = useMemo(() => new THREE.MeshBasicMaterial({ color: '#160e08', side: THREE.BackSide }), [])
  useEffect(() => {
    const hull = newId()
    const ramp = newId()
    platforms.set(hull, { x: ARK.x, z: ARK.z, hw: HULL_HALF_L + 0.2, hd: HULL_HALF_W + 0.1, top: 9 })
    platforms.set(ramp, { x: DOOR_X, z: HULL_FRONT + RAMP_RUN / 2, hw: DOOR_W / 2 + 0.1, hd: RAMP_RUN / 2, top: 3.6 })
    return () => {
      platforms.delete(hull)
      platforms.delete(ramp)
    }
  }, [])
  useFrame(() => {
    if (door.current) door.current.rotation.x = arkFx.doorAngle
  })
  return (
    <>
      <group position={[ARK.x, 0, ARK.z]}>
        <StaticBricks bricks={bricks} />
        <BlobShadow size={24} position={[0, 0.02, 0]} />
      </group>
      {/* darkness behind the door */}
      <mesh position={[DOOR_X, DECK_Y + DOOR_H / 2, HULL_FRONT - RECESS / 2 - 0.02]} material={dark}>
        <boxGeometry args={[DOOR_W, DOOR_H, RECESS]} />
      </mesh>
      <group ref={door} position={[DOOR_X, DECK_Y, HULL_FRONT]}>
        <mesh geometry={doorGeo} material={plasticVC()} />
      </group>
      {/* a little stone at the ramp foot */}
      <mesh position={[DOOR_X, 0.06, RAMP_FOOT[1] - 0.2]} material={plastic(COLORS.grey)}>
        <boxGeometry args={[DOOR_W + 0.3, 0.12, 0.5]} />
      </mesh>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Noah's family at the ramp.                                           */
/* ------------------------------------------------------------------ */

type FamilyDef = { id: FamilyId; look: Look; home: V3 }

export const FAMILY: FamilyDef[] = [
  { id: 'wife', home: [0.9, 0, -9.4], look: { robe: '#4a7ab8', legs: '#2f4f7a', hood: '#d9c7a5', beard: null } },
  { id: 'shem', home: [5.7, 0, -9.3], look: { robe: COLORS.white, legs: COLORS.brown, hood: COLORS.reddishBrown, beard: '#5a3a1e' } },
  { id: 'ham', home: [-1.6, 0, -11.4], look: { robe: COLORS.orange, legs: COLORS.darkTan, hood: COLORS.black, beard: COLORS.black } },
  { id: 'japheth', home: [7.8, 0, -11.2], look: { robe: COLORS.green, legs: COLORS.reddishBrown, hood: COLORS.sand, beard: '#a0522d' } },
]

/** Closing cutscene clock (seconds since everyone boarded; <0 = not started). */
export const closing = { t: -1 }

const TALK_R = 2.8
const LINE_S = 4

function FamilyMember({ def, order }: { def: FamilyDef; order: number }) {
  const lang = useGame((s) => s.lang) ?? 'en'
  const A = ANIMALS_STRINGS[lang]
  const name = STRINGS[lang].npcNames[def.id]
  const group = useRef<THREE.Group>(null)
  const pose = useRef(makePose())
  const facing = useRef(0)
  const pos = useRef(new THREE.Vector3(...def.home))
  const talking = useRef(false)
  const lineT = useRef(0)
  const [bubble, setBubble] = useState<number | null>(null)
  const id = useMemo(newId, [])
  useEffect(() => {
    colliders.set(id, { x: def.home[0], z: def.home[2], r: 0.35 })
    return () => {
      colliders.delete(id)
    }
  }, [id, def.home])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30)
    const g = group.current
    if (!g) return
    const p = pose.current
    const t = closing.t
    if (t >= 0) {
      // walk aboard: to the ramp foot, up, and in
      colliders.delete(id)
      if (talking.current) {
        talking.current = false
        setBubble(null)
      }
      const start = 0.4 + order * 0.7
      if (t > start) {
        const fx = DOOR_X + (order % 2 ? 0.4 : -0.4)
        let tx = fx
        let tz = RAMP_FOOT[1]
        if (Math.hypot(pos.current.x - fx, pos.current.z - RAMP_FOOT[1]) < 0.3 || pos.current.z < RAMP_FOOT[1] + 0.1) tz = HULL_FRONT - 1.8
        if (pos.current.z < RAMP_FOOT[1] + 0.1) tx = fx
        const dx = tx - pos.current.x
        const dz = tz - pos.current.z
        const d = Math.hypot(dx, dz)
        if (d > 0.05) {
          pos.current.x += (dx / d) * Math.min(d, 2.4 * dt)
          pos.current.z += (dz / d) * Math.min(d, 2.4 * dt)
          facing.current = Math.atan2(dx, dz)
          p.speed = 0.6
        } else p.speed = 0
        if (pos.current.z < HULL_FRONT - 1.4) g.visible = false
      }
      p.wave = 0
      p.raiseArms = 0
    } else {
      const dx = player.pos.x - pos.current.x
      const dz = player.pos.z - pos.current.z
      const near = dx * dx + dz * dz < TALK_R * TALK_R
      if (near && !talking.current) {
        talking.current = true
        lineT.current = 0
        setBubble((b) => (b === null ? 0 : (b + 1) % A.familyLines[def.id].length))
      } else if (!near && talking.current) {
        talking.current = false
        setBubble(null)
      }
      // greet animals walking by, otherwise watch Noah
      let wave = talking.current && lineT.current < 1.2
      let lookX = dx
      let lookZ = dz
      for (const a of agents) {
        if (a.state !== 'walk' && a.state !== 'ramp') continue
        const ax = a.x - pos.current.x
        const az = a.z - pos.current.z
        if (ax * ax + az * az < 9) {
          wave = true
          lookX = ax
          lookZ = az
          break
        }
      }
      const want = Math.atan2(lookX, lookZ)
      const diff = Math.atan2(Math.sin(want - facing.current), Math.cos(want - facing.current))
      facing.current += diff * (1 - Math.exp(-dt * 6))
      if (talking.current) {
        lineT.current += dt
        if (lineT.current > LINE_S) {
          lineT.current = 0
          setBubble((b) => ((b ?? 0) + 1) % A.familyLines[def.id].length)
        }
      }
      p.wave = wave ? 1 : 0
      p.raiseArms = arkFx.cheer > 0 ? 1 : 0
      p.speed = 0
    }
    const hop = arkFx.cheer > 0 && t < 0 ? Math.abs(Math.sin(arkFx.cheer * 9 + order)) * 0.25 : 0
    const ramp = THREE.MathUtils.clamp((HULL_FRONT + RAMP_RUN - pos.current.z) / RAMP_RUN, 0, 1) * DECK_Y
    g.position.set(pos.current.x, Math.max(surfaceHeight(pos.current.x, pos.current.z), ramp) + hop, pos.current.z)
    g.rotation.y = facing.current
  })

  return (
    <group ref={group}>
      <Minifig pose={pose} look={def.look} />
      <BlobShadow size={1.1} />
      {bubble !== null && (
        <Html position={[0, 2.25, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="npc-bubble" key={bubble}>
            <span className="npc-name">{name}</span>
            {A.familyLines[def.id][bubble]}
          </div>
        </Html>
      )}
    </group>
  )
}

export function Family() {
  return (
    <>
      {FAMILY.map((f, i) => (
        <FamilyMember key={f.id} def={f} order={i} />
      ))}
    </>
  )
}
